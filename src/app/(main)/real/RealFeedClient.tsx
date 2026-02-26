/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { subscribeToTable } from "@/lib/realtime";
import { containsBlockedContent, safeIdentityLabel } from "@/lib/content-filter";
import { MAX_POST_MEDIA_IMAGES, serializeMediaUrls } from "@/lib/media";
import type { NrealPost, NrealProfile } from "@/types/nreal";
import { PostCard } from "./PostCard";
import { fetchCurrentProfile, type Profile } from "@/lib/profiles";
import { getFeedVariant, rankPosts } from "@/lib/nreal-feed-ranking";
import {
  AUTH_SESSION_KEY,
  AUTH_SESSION_TTL_MS,
  canHydrateFromSession,
  readSessionCache,
  writeSessionCache,
} from "@/lib/session-cache";

type SupabasePost = Omit<NrealPost, "profiles" | "likesCount" | "likedByCurrentUser" | "status"> & {
  status?: NrealPost["status"] | null;
  profiles?: NrealProfile | NrealProfile[] | null;
  likesCount?: number;
  likedByCurrentUser?: boolean;
  commentsCount?: number;
};

const MAX_POST_CHARS = 3000;
const POST_CACHE_TTL_MS = 30000;
const POST_CACHE_LIMIT = 60;
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_QUALITY = 0.8;
const VIDEO_COMPRESS_TRIGGER_BYTES = 55 * 1024 * 1024;
const VIDEO_SOFT_UPLOAD_LIMIT_BYTES = 95 * 1024 * 1024;
const VIDEO_TARGET_BITRATE = 1_500_000;
const AUDIO_TARGET_BITRATE = 128_000;
const VIDEO_MAX_DURATION_DIFF_SECONDS = 0.75;

type CropPreset = "4:5" | "1:1" | "16:9";
type CropRect = { x: number; y: number; width: number; height: number };
type EditablePhotoAsset = {
  localId: string;
  originalFile: File;
  previewUrl: string;
  cropPreset: CropPreset;
  cropRect: CropRect | null;
  processedFile: File | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};
type CropGestureState =
  | {
      mode: "drag";
      startOffsetX: number;
      startOffsetY: number;
      startClientX: number;
      startClientY: number;
      frameWidth: number;
      frameHeight: number;
    }
  | {
      mode: "pinch";
      startZoom: number;
      startOffsetX: number;
      startOffsetY: number;
      startDistance: number;
      startCenterX: number;
      startCenterY: number;
      frameWidth: number;
      frameHeight: number;
    }
  | { mode: "none" };

const DEFAULT_CROP_PRESET: CropPreset = "4:5";
const CROP_PRESETS: CropPreset[] = ["4:5", "1:1", "16:9"];
let nrealPostsCache: { userId: string | null; posts: NrealPost[]; fetchedAt: number } | null = null;
const POST_SESSION_KEY = "nrw.feed.nreal";
const POST_SESSION_TTL_MS = 30000;

function replaceFileExtension(fileName: string, nextExt: string) {
  const base = fileName.replace(/\.[^/.]+$/, "");
  return `${base}.${nextExt}`;
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nepodařilo se načíst obrázek pro kompresi."));
    image.src = src;
  });
}

function cropPresetRatio(preset: CropPreset) {
  if (preset === "1:1") return 1;
  if (preset === "16:9") return 16 / 9;
  return 4 / 5;
}

function computeCropRect(
  imageWidth: number,
  imageHeight: number,
  preset: CropPreset,
  zoom: number,
  offsetX: number,
  offsetY: number,
): CropRect {
  const safeZoom = Math.max(1, Math.min(3, zoom));
  const safeOffsetX = Math.max(-1, Math.min(1, offsetX));
  const safeOffsetY = Math.max(-1, Math.min(1, offsetY));
  const targetRatio = cropPresetRatio(preset);
  const imageRatio = imageWidth / imageHeight;

  let baseCropWidth = imageWidth;
  let baseCropHeight = imageHeight;
  if (imageRatio > targetRatio) {
    baseCropWidth = imageHeight * targetRatio;
  } else {
    baseCropHeight = imageWidth / targetRatio;
  }

  const cropWidth = baseCropWidth / safeZoom;
  const cropHeight = baseCropHeight / safeZoom;
  const maxX = Math.max(0, (imageWidth - cropWidth) / 2);
  const maxY = Math.max(0, (imageHeight - cropHeight) / 2);
  const centerX = imageWidth / 2 + safeOffsetX * maxX;
  const centerY = imageHeight / 2 + safeOffsetY * maxY;
  const x = Math.round(Math.max(0, Math.min(imageWidth - cropWidth, centerX - cropWidth / 2)));
  const y = Math.round(Math.max(0, Math.min(imageHeight - cropHeight, centerY - cropHeight / 2)));

  return {
    x,
    y,
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}

function withComputedCrop(asset: EditablePhotoAsset): EditablePhotoAsset {
  if (!asset.width || !asset.height) return asset;
  return {
    ...asset,
    cropRect: computeCropRect(asset.width, asset.height, asset.cropPreset, asset.zoom, asset.offsetX, asset.offsetY),
    processedFile: null,
  };
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/")) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", IMAGE_QUALITY);
    });
    if (!compressedBlob) return file;
    if (compressedBlob.size >= file.size) return file;
    return new File([compressedBlob], replaceFileExtension(file.name, "webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function createPhotoAsset(file: File, indexSeed: number, preset: CropPreset = DEFAULT_CROP_PRESET) {
  const previewUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(previewUrl);
    const asset: EditablePhotoAsset = {
      localId: `${Date.now()}-${indexSeed}-${Math.random().toString(36).slice(2, 8)}`,
      originalFile: file,
      previewUrl,
      cropPreset: preset,
      cropRect: null,
      processedFile: null,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      width: image.naturalWidth || 0,
      height: image.naturalHeight || 0,
    };
    return withComputedCrop(asset);
  } catch {
    const fallback: EditablePhotoAsset = {
      localId: `${Date.now()}-${indexSeed}-${Math.random().toString(36).slice(2, 8)}`,
      originalFile: file,
      previewUrl,
      cropPreset: preset,
      cropRect: null,
      processedFile: null,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      width: 0,
      height: 0,
    };
    return fallback;
  }
}

async function renderCroppedPhotoFile(asset: EditablePhotoAsset) {
  const objectUrl = URL.createObjectURL(asset.originalFile);
  try {
    const image = await loadImageElement(objectUrl);
    const width = image.naturalWidth || asset.width || 0;
    const height = image.naturalHeight || asset.height || 0;
    if (!width || !height) return asset.originalFile;

    const cropRect =
      asset.cropRect ??
      computeCropRect(width, height, asset.cropPreset, asset.zoom ?? 1, asset.offsetX ?? 0, asset.offsetY ?? 0);

    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(cropRect.width, cropRect.height));
    const outWidth = Math.max(1, Math.round(cropRect.width * scale));
    const outHeight = Math.max(1, Math.round(cropRect.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return asset.originalFile;

    ctx.drawImage(
      image,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      outWidth,
      outHeight,
    );

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", IMAGE_QUALITY));
    if (!blob) return asset.originalFile;
    return new File([blob], replaceFileExtension(asset.originalFile.name, "webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return asset.originalFile;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function getVideoDuration(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = objectUrl;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Nepodařilo se načíst metadata videa."));
    });
    return Number.isFinite(video.duration) ? video.duration : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressVideoFilePreserveAudio(file: File, onProgress?: (progress: number) => void) {
  if (!file.type.startsWith("video/")) return file;
  if (file.size < VIDEO_COMPRESS_TRIGGER_BYTES) return file;
  if (typeof MediaRecorder === "undefined") return file;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = objectUrl;
  video.preload = "auto";
  video.playsInline = true;
  video.muted = false;
  video.volume = 1;

  const sourceDuration = await getVideoDuration(file);
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Nepodařilo se načíst video pro kompresi."));
    });

    const captureStreamFn =
      (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream })
        .captureStream ??
      (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
    if (!captureStreamFn) return file;

    const sourceStream = captureStreamFn.call(video);
    const hasAudioTrack = sourceStream.getAudioTracks().length > 0;
    const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const supportedMimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type));
    if (!supportedMimeType) return file;

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(sourceStream, {
      mimeType: supportedMimeType,
      videoBitsPerSecond: VIDEO_TARGET_BITRATE,
      audioBitsPerSecond: hasAudioTrack ? AUDIO_TARGET_BITRATE : undefined,
    });

    const blobPromise = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Kompresní rekordér videa selhal."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: supportedMimeType }));
    });

    video.ontimeupdate = () => {
      if (video.duration > 0) {
        onProgress?.(Math.min(1, video.currentTime / video.duration));
      }
    };

    recorder.start(500);
    await video.play();

    await new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error("Přehrávání videa selhalo při kompresi."));
    });

    if (recorder.state !== "inactive") recorder.stop();
    const compressedBlob = await blobPromise;
    sourceStream.getTracks().forEach((track) => track.stop());

    if (compressedBlob.size >= file.size) return file;
    const compressedFile = new File([compressedBlob], replaceFileExtension(file.name, "webm"), {
      type: compressedBlob.type || "video/webm",
      lastModified: Date.now(),
    });

    const compressedDuration = await getVideoDuration(compressedFile);
    if (
      sourceDuration !== null &&
      compressedDuration !== null &&
      Math.abs(sourceDuration - compressedDuration) > VIDEO_MAX_DURATION_DIFF_SECONDS
    ) {
      return file;
    }

    return compressedFile;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
    onProgress?.(1);
  }
}

export function RealFeedClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const canHydrate = canHydrateFromSession();
  const initialUserId = canHydrate
    ? readSessionCache<string | null>(AUTH_SESSION_KEY, AUTH_SESSION_TTL_MS) ?? null
    : null;
  const initialFeed = canHydrate
    ? readSessionCache<NrealPost[]>(POST_SESSION_KEY, POST_SESSION_TTL_MS, initialUserId)
    : null;
  const hasInitialFeed = initialFeed !== null;
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<NrealPost[]>(() => initialFeed ?? []);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(() => !hasInitialFeed);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [currentUserMetaProfile, setCurrentUserMetaProfile] = useState<NrealProfile | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [photoAssets, setPhotoAssets] = useState<EditablePhotoAsset[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [photoCropPreset, setPhotoCropPreset] = useState<CropPreset>(DEFAULT_CROP_PRESET);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const deletedPostsRef = useRef<Map<string, NrealPost>>(new Map());
  const cropGestureRef = useRef<CropGestureState>({ mode: "none" });

  const cachePosts = (nextPosts: NrealPost[], cacheUserId: string | null) => {
    nrealPostsCache = {
      userId: cacheUserId,
      posts: nextPosts.slice(0, POST_CACHE_LIMIT),
      fetchedAt: Date.now(),
    };
    writeSessionCache(POST_SESSION_KEY, nrealPostsCache.posts, cacheUserId);
  };

  const setPostsWithCache = (updater: (prev: NrealPost[]) => NrealPost[], cacheUserId: string | null) => {
    setPosts((prev) => {
      const next = updater(prev);
      cachePosts(next, cacheUserId);
      return next;
    });
  };

  const normalizePost = (post: SupabasePost): NrealPost => {
    const rawProfiles = post?.profiles;
    const profiles = Array.isArray(rawProfiles) ? rawProfiles : rawProfiles ? [rawProfiles] : [];
    return {
      ...post,
      status: post.status ?? "approved",
      is_deleted: (post as SupabasePost).is_deleted ?? null,
      profiles,
      likesCount: post.likesCount ?? 0,
      likedByCurrentUser: post.likedByCurrentUser ?? false,
      commentsCount: post.commentsCount ?? 0,
    };
  };

  useEffect(() => {
    let active = true;
    async function load() {
      setError(null);
      const cachedUserId = readSessionCache<string | null>(AUTH_SESSION_KEY, AUTH_SESSION_TTL_MS);
      const optimisticUserId = cachedUserId ?? null;
      if (optimisticUserId && optimisticUserId !== currentUserId) {
        setCurrentUserId(optimisticUserId);
      }

      const cacheKey = optimisticUserId;
      const cacheValid =
        nrealPostsCache &&
        nrealPostsCache.userId === cacheKey &&
        Date.now() - nrealPostsCache.fetchedAt < POST_CACHE_TTL_MS;

      const sessionCached = !cacheValid
        ? readSessionCache<NrealPost[]>(POST_SESSION_KEY, POST_SESSION_TTL_MS, cacheKey)
        : null;

      if (sessionCached) {
        setPosts(sessionCached);
        cachePosts(sessionCached, cacheKey);
      }

      setLoading(!(cacheValid || Boolean(sessionCached)));

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user ?? null;
      const resolvedUserId = user?.id ?? null;
      writeSessionCache(AUTH_SESSION_KEY, resolvedUserId, resolvedUserId ?? null);

      if (!active) return;
      setUserId(resolvedUserId);
      setCurrentUserId(resolvedUserId);
      if (user) {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        setCurrentUserMetaProfile({
          username: typeof meta.username === "string" ? meta.username : null,
          display_name: typeof meta.display_name === "string" ? meta.display_name : null,
          avatar_url: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
          verified: typeof meta.verified === "boolean" ? meta.verified : null,
          verification_label: typeof meta.verification_label === "string" ? meta.verification_label : null,
        });
      } else if (active) {
        setCurrentUserMetaProfile(null);
      }
      if (user?.id) {
        const profileData = await fetchCurrentProfile();
        if (active) setCurrentProfile(profileData);
      } else if (active) {
        setCurrentProfile(null);
      }

      const { variant: variantToUse } = getFeedVariant(user?.id ?? null);

      const confirmedCacheKey = resolvedUserId;
      const confirmedCacheValid =
        nrealPostsCache &&
        nrealPostsCache.userId === confirmedCacheKey &&
        Date.now() - nrealPostsCache.fetchedAt < POST_CACHE_TTL_MS;

      if (confirmedCacheValid && nrealPostsCache) {
        let followingSet = new Set<string>();
        if (user?.id) {
          const { data: followRows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);
          followingSet = new Set(
            (followRows ?? [])
              .map((row) => (row as { following_id?: string | null }).following_id)
              .filter(Boolean) as string[],
          );
        }
        const now = new Date();
        const ranked = rankPosts(nrealPostsCache.posts, followingSet, variantToUse, now);
        setPosts(ranked);
        cachePosts(ranked, confirmedCacheKey);
      }

      let query = supabase
        .from("nreal_posts")
        .select(
          `
            id,
            user_id,
            content,
            created_at,
            status,
            media_url,
            media_type,
            is_deleted,
            profiles (
              username,
              display_name,
              avatar_url,
              verified,
              verification_label
            )
          `,
        )
        .eq("is_deleted", false);

      if (user?.id) {
        query = query.or(`status.eq.approved,status.is.null,user_id.eq.${user.id}`);
      } else {
        query = query.or("status.eq.approved,status.is.null");
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        setError(error.message);
      } else if (data) {
        const normalized = (data as SupabasePost[]).map((post) => normalizePost(post));
        const postIds = normalized.map((post) => post.id);
        const likesCountMap: Record<string, number> = {};
        const commentsCountMap: Record<string, number> = {};
        const likedPostIds = new Set<string>();

        if (postIds.length > 0) {
          const { data: likesData } = await supabase
            .from("nreal_likes")
            .select("post_id")
            .in("post_id", postIds);

          likesData?.forEach((row) => {
            const pid = (row as { post_id: string }).post_id;
            likesCountMap[pid] = (likesCountMap[pid] ?? 0) + 1;
          });

          if (user?.id) {
            const { data: likedData } = await supabase
              .from("nreal_likes")
              .select("post_id")
              .eq("user_id", user.id)
              .in("post_id", postIds);

            likedData?.forEach((row) => {
              const pid = (row as { post_id: string }).post_id;
              likedPostIds.add(pid);
            });
          }

          const { data: commentsData } = await supabase
            .from("nreal_comments")
            .select("post_id")
            .in("post_id", postIds)
            .eq("is_deleted", false);

          commentsData?.forEach((row) => {
            const pid = (row as { post_id: string }).post_id;
            commentsCountMap[pid] = (commentsCountMap[pid] ?? 0) + 1;
          });
        }

        let followingSet = new Set<string>();
        if (user?.id) {
          const { data: followRows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);
          followingSet = new Set(
            (followRows ?? [])
              .map((row) => (row as { following_id?: string | null }).following_id)
              .filter(Boolean) as string[],
          );
        }

        const withCounts = normalized.map((post) => ({
          ...post,
          likesCount: likesCountMap[post.id] ?? 0,
          likedByCurrentUser: likedPostIds.has(post.id),
          commentsCount: commentsCountMap[post.id] ?? 0,
        }));
        const visible = withCounts.filter((post) => !post.is_deleted);
        const now = new Date();
        const nextPosts = rankPosts(visible, followingSet, variantToUse, now);
        setPosts(nextPosts);
        cachePosts(nextPosts, cacheKey);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    const profileCache = new Map<string, NrealProfile>();

    const fetchProfileForUser = async (id: string): Promise<NrealProfile | null> => {
      if (id === currentUserId && currentProfile) {
        return {
          username: currentProfile.username ?? null,
          display_name: currentProfile.display_name ?? null,
          avatar_url: currentProfile.avatar_url ?? null,
          verified: currentProfile.verified ?? null,
          verification_label: currentProfile.verification_label ?? null,
        };
      }
      if (id === currentUserId && currentUserMetaProfile) {
        return currentUserMetaProfile;
      }
      const cached = profileCache.get(id);
      if (cached) return cached;
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, verified, verification_label")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      const profile: NrealProfile = {
        username: data.username ?? null,
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
        verified: data.verified ?? null,
        verification_label: data.verification_label ?? null,
      };
      profileCache.set(id, profile);
      return profile;
    };

    const shouldIncludePost = (row: SupabasePost) => {
      if (row.is_deleted) return false;
      const status = row.status ?? "approved";
      if (status === "approved") return true;
      return row.user_id === currentUserId;
    };

    const handlePostInsert = async (row: SupabasePost) => {
      if (!shouldIncludePost(row)) return;
      const profile = await fetchProfileForUser(row.user_id);
      if (!active) return;
      const normalized = normalizePost({
        ...row,
        profiles: profile ? [profile] : [],
      });
      const newPost: NrealPost = {
        ...normalized,
        likesCount: 0,
        likedByCurrentUser: false,
        commentsCount: 0,
      };
      setPostsWithCache((prev) => {
        if (prev.some((post) => post.id === newPost.id)) {
          return prev;
        }
        const tempIndex = prev.findIndex(
          (post) =>
            post.id.startsWith("temp-") &&
            post.user_id === newPost.user_id &&
            (post.content ?? "") === (newPost.content ?? "") &&
            (post.media_url ?? null) === (newPost.media_url ?? null),
        );
        if (tempIndex !== -1) {
          const next = [...prev];
          next[tempIndex] = newPost;
          return next;
        }
        return [newPost, ...prev];
      }, currentUserId);
    };

    const unsubscribePosts = subscribeToTable("nreal_posts", (payload) => {
      if (!payload || payload.eventType !== "INSERT") return;
      const row = payload.new as SupabasePost;
      if (!row) return;
      void handlePostInsert(row);
    });

    const unsubscribeLikes = subscribeToTable("nreal_likes", (payload) => {
      if (!payload || payload.eventType !== "INSERT") return;
      const row = payload.new as { post_id?: string | null; user_id?: string | null };
      const postId = row?.post_id ?? null;
      if (!postId) return;
      setPostsWithCache(
        (prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            if (row.user_id === currentUserId) {
              if (post.likedByCurrentUser) return post;
              return { ...post, likesCount: post.likesCount + 1, likedByCurrentUser: true };
            }
            return { ...post, likesCount: post.likesCount + 1 };
          }),
        currentUserId,
      );
    });

    const unsubscribeComments = subscribeToTable("nreal_comments", (payload) => {
      if (!payload || payload.eventType !== "INSERT") return;
      const row = payload.new as { post_id?: string | null; is_deleted?: boolean | null };
      const postId = row?.post_id ?? null;
      if (!postId || row?.is_deleted) return;
      setPostsWithCache(
        (prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            return { ...post, commentsCount: (post.commentsCount ?? 0) + 1 };
          }),
        currentUserId,
      );
    });

    return () => {
      active = false;
      unsubscribePosts();
      unsubscribeLikes();
      unsubscribeComments();
    };
  }, [currentProfile, currentUserId, currentUserMetaProfile, supabase]);

  const resetMedia = () => {
    const allUrls = new Set<string>([...mediaPreviews, ...photoAssets.map((asset) => asset.previewUrl)]);
    allUrls.forEach((url) => URL.revokeObjectURL(url));
    setMediaFiles([]);
    setMediaPreviews([]);
    setPhotoAssets([]);
    setActivePhotoId(null);
    setPhotoCropPreset(DEFAULT_CROP_PRESET);
    setMediaType(null);
  };

  const syncPhotoAssets = (nextAssets: EditablePhotoAsset[]) => {
    setPhotoAssets(nextAssets);
    setMediaFiles(nextAssets.map((asset) => asset.originalFile));
    setMediaPreviews(nextAssets.map((asset) => asset.previewUrl));
    setMediaType(nextAssets.length > 0 ? "image" : null);
    setActivePhotoId((prev) => {
      if (nextAssets.length === 0) return null;
      if (prev && nextAssets.some((asset) => asset.localId === prev)) return prev;
      return nextAssets[0].localId;
    });
    if (nextAssets.length > 0) {
      setPhotoCropPreset(nextAssets[0].cropPreset);
    }
  };

  const updateActivePhotoAsset = (updater: (asset: EditablePhotoAsset) => EditablePhotoAsset) => {
    setPhotoAssets((prev) => {
      if (prev.length === 0) return prev;
      const targetId = activePhotoId ?? prev[0].localId;
      const next = prev.map((asset) =>
        asset.localId === targetId ? withComputedCrop(updater(asset)) : asset,
      );
      setMediaFiles(next.map((asset) => asset.originalFile));
      setMediaPreviews(next.map((asset) => asset.previewUrl));
      return next;
    });
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const applyActivePhotoGesture = (nextZoom: number, nextOffsetX: number, nextOffsetY: number) => {
    updateActivePhotoAsset((asset) => ({
      ...asset,
      zoom: clamp(nextZoom, 1, 3),
      offsetX: clamp(nextOffsetX, -1, 1),
      offsetY: clamp(nextOffsetY, -1, 1),
      processedFile: null,
    }));
  };

  const startDragGesture = (clientX: number, clientY: number, frameWidth: number, frameHeight: number) => {
    const current = photoAssets.find((asset) => asset.localId === activePhotoId) ?? photoAssets[0] ?? null;
    if (!current) return;
    cropGestureRef.current = {
      mode: "drag",
      startOffsetX: current.offsetX,
      startOffsetY: current.offsetY,
      startClientX: clientX,
      startClientY: clientY,
      frameWidth,
      frameHeight,
    };
  };

  const updateDragGesture = (clientX: number, clientY: number) => {
    const state = cropGestureRef.current;
    if (state.mode !== "drag") return;
    const deltaX = clientX - state.startClientX;
    const deltaY = clientY - state.startClientY;
    const nextOffsetX = state.startOffsetX + (deltaX / Math.max(1, state.frameWidth)) * 2;
    const nextOffsetY = state.startOffsetY + (deltaY / Math.max(1, state.frameHeight)) * 2;
    const current =
      photoAssets.find((asset) => asset.localId === activePhotoId) ?? photoAssets[0] ?? null;
    const currentZoom = current?.zoom ?? 1;
    applyActivePhotoGesture(currentZoom, nextOffsetX, nextOffsetY);
  };

  const stopCropGesture = () => {
    cropGestureRef.current = { mode: "none" };
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      updateDragGesture(event.clientX, event.clientY);
    };
    const onMouseUp = () => {
      stopCropGesture();
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  });

  const removePhotoAsset = (localId: string) => {
    setPhotoAssets((prev) => {
      const target = prev.find((asset) => asset.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((asset) => asset.localId !== localId);
      setMediaFiles(next.map((asset) => asset.originalFile));
      setMediaPreviews(next.map((asset) => asset.previewUrl));
      setMediaType(next.length > 0 ? "image" : null);
      setActivePhotoId((current) => {
        if (next.length === 0) return null;
        if (current && next.some((asset) => asset.localId === current)) return current;
        return next[0].localId;
      });
      return next;
    });
  };

  const uploadFileWithProgress = async (
    file: File,
    path: string,
    accessToken: string,
    onProgress: (progress: number) => void,
  ) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Chybí konfigurace úložiště.");
    }

    const encodedPath = path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const endpoint = `${supabaseUrl}/storage/v1/object/nreal_media/${encodedPath}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);
      xhr.setRequestHeader("apikey", supabaseAnonKey);
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.setRequestHeader("x-upsert", "true");
      xhr.setRequestHeader("cache-control", "3600");
      xhr.setRequestHeader("content-type", file.type || "application/octet-stream");

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress(event.total > 0 ? event.loaded / event.total : 0);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(1);
          resolve();
        } else {
          const responseText = (xhr.responseText || "").slice(0, 220);
          reject(new Error(`Nahrání selhalo (${xhr.status})${responseText ? `: ${responseText}` : ""}`));
        }
      };
      xhr.onerror = () => reject(new Error("Nahrání selhalo (síť/chyba připojení)."));
      xhr.send(file);
    });
  };

  const handleFileChange = async (fileList?: FileList | null) => {
    setError(null);
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      resetMedia();
      return;
    }
    const containsVideo = files.some((file) => file.type.startsWith("video"));
    const hasExistingMedia = mediaType === "image" ? photoAssets.length > 0 : mediaFiles.length > 0;
    if (containsVideo) {
      if (files.length > 1 || hasExistingMedia) {
        setError("Video nelze kombinovat s fotkami a jde nahrát jen jedno.");
        return;
      }
      const file = files.find((f) => f.type.startsWith("video")) ?? files[0];
      resetMedia();
      setMediaFiles([file]);
      setMediaPreviews([URL.createObjectURL(file)]);
      setMediaType("video");
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setError("Podporujeme jen obrázky nebo jedno video.");
      return;
    }

    const existingAssets = mediaType === "image" ? photoAssets : [];
    const availableSlots = Math.max(0, MAX_POST_MEDIA_IMAGES - existingAssets.length);
    const filesToAdd = imageFiles.slice(0, availableSlots);

    if (filesToAdd.length < imageFiles.length) {
      setError(`Maximálně ${MAX_POST_MEDIA_IMAGES} fotky.`);
    }

    if (filesToAdd.length === 0 && existingAssets.length > 0) return;
    if (filesToAdd.length === 0) {
      setError(`Maximálně ${MAX_POST_MEDIA_IMAGES} fotky.`);
      return;
    }

    if (mediaType !== "image") {
      mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
      setMediaFiles([]);
      setMediaPreviews([]);
      setPhotoAssets([]);
      setActivePhotoId(null);
    }

    const created = await Promise.all(
      filesToAdd.map((file, index) => createPhotoAsset(file, index, photoCropPreset)),
    );
    const nextAssets = [...(mediaType === "image" ? existingAssets : []), ...created].slice(0, MAX_POST_MEDIA_IMAGES);
    syncPhotoAssets(nextAssets);
  };

  const preparePhotoFilesForUpload = async (assets: EditablePhotoAsset[]) => {
    const prepared: File[] = [];
    if (assets.length === 0) return prepared;
    setUploadStatus("Aplikuji crop…");
    setUploadProgress(3);

    for (const [index, asset] of assets.entries()) {
      const cropProgress = 3 + ((index + 1) / assets.length) * 10;
      let cropped = asset.processedFile;
      if (!cropped) {
        cropped = await renderCroppedPhotoFile(asset);
        setPhotoAssets((prev) =>
          prev.map((item) => (item.localId === asset.localId ? { ...item, processedFile: cropped ?? null } : item)),
        );
      }
      const compressed = await compressImageFile(cropped ?? asset.originalFile);
      prepared.push(compressed);
      setUploadProgress(Math.round(cropProgress));
    }

    return prepared;
  };

  const uploadMedia = async (files: File[], userId: string, options?: { skipImageOptimization?: boolean }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Musíš být přihlášený.");
      return null;
    }

    const optimizedFiles: File[] = [];
    if (options?.skipImageOptimization) {
      setUploadStatus("Připravuji upload…");
      setUploadProgress((prev) => Math.max(prev ?? 0, 15));
    } else {
      setUploadStatus("Optimalizuji média…");
      setUploadProgress(3);
    }

    for (const [index, file] of files.entries()) {
      const fileProgressEnd = ((index + 1) / files.length) * 25;

      let optimized = file;
      if (file.type.startsWith("image/") && !options?.skipImageOptimization) {
        setUploadStatus("Optimalizuji fotky…");
        optimized = await compressImageFile(file);
      } else if (file.type.startsWith("video/")) {
        setUploadStatus(file.size >= VIDEO_COMPRESS_TRIGGER_BYTES ? "Komprimuji video…" : "Připravuji video…");
        optimized = await compressVideoFilePreserveAudio(file, (progress) => {
          const next = ((index + progress) / files.length) * 25;
          setUploadProgress(Math.max(3, Math.round(next)));
        });
        if (optimized.size > VIDEO_SOFT_UPLOAD_LIMIT_BYTES) {
          setError(
            `Video je moc velké (${Math.round(optimized.size / 1024 / 1024)} MB). Zkus nižší kvalitu nebo kratší klip.`,
          );
          return null;
        }
      }

      optimizedFiles.push(optimized);
      setUploadProgress(Math.round(fileProgressEnd));
    }

    const uploaded: string[] = [];
    const totalBytes = optimizedFiles.reduce((sum, file) => sum + file.size, 0) || 1;
    let uploadedBytesDone = 0;
    setUploadStatus("Nahrávám média…");
    setUploadProgress((prev) => Math.max(prev ?? 0, 25));

    for (const [index, file] of optimizedFiles.entries()) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${index}.${ext}`;
      let uploadFailed = false;
      try {
        await uploadFileWithProgress(file, path, accessToken, (progress) => {
          const bytesUploaded = uploadedBytesDone + file.size * Math.max(0, Math.min(1, progress));
          const uploadPart = bytesUploaded / totalBytes;
          const totalProgress = 25 + uploadPart * 75;
          setUploadProgress(Math.max(25, Math.round(totalProgress)));
        });
      } catch {
        // Fallback for environments where XHR upload endpoint can fail (CORS/proxy/auth edge cases).
        const { error: fallbackError } = await supabase.storage.from("nreal_media").upload(path, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
        });
        if (fallbackError) {
          uploadFailed = true;
          setError(`Nahrání souboru selhalo: ${fallbackError.message}`);
        }
      }

      if (uploadFailed) return null;

      uploadedBytesDone += file.size;
      const { data } = supabase.storage.from("nreal_media").getPublicUrl(path);
      if (data.publicUrl) uploaded.push(data.publicUrl);
    }

    setUploadProgress(100);
    return uploaded;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posting) return;
    if (!userId) {
      setError("Musíš být přihlášený.");
      return;
    }
    const trimmed = content.trim();
    const hasSelectedMedia = mediaType === "image" ? photoAssets.length > 0 : mediaFiles.length > 0;
    if (!trimmed && !hasSelectedMedia) return;
    if (trimmed.length > MAX_POST_CHARS) {
      setError(`Text je moc dlouhý (max ${MAX_POST_CHARS} znaků).`);
      return;
    }
    if (trimmed) {
      const { hit } = containsBlockedContent(trimmed);
      if (hit) {
        setError("Uprav text – obsahuje zakázané výrazy, které mohou být urážlivé. Pokud si myslíš, že jde o omyl, kontaktuj podporu.");
        return;
      }
    }

    setPosting(true);
    setError(null);
    setUploadProgress(hasSelectedMedia ? 1 : null);
    setUploadStatus(hasSelectedMedia ? "Připravuji upload…" : null);
    const preparedPhotoFiles =
      mediaType === "image" && photoAssets.length > 0 ? await preparePhotoFilesForUpload(photoAssets) : [];
    const sourceMediaFiles = mediaType === "image" ? preparedPhotoFiles : mediaFiles;
    const mediaUrls =
      hasSelectedMedia
        ? await uploadMedia(sourceMediaFiles, userId, { skipImageOptimization: mediaType === "image" })
        : null;
    if (hasSelectedMedia && !mediaUrls) {
      setPosting(false);
      setUploadProgress(null);
      setUploadStatus(null);
      return;
    }
    const mediaUrl = mediaUrls ? serializeMediaUrls(mediaUrls) : null;
    if (hasSelectedMedia && !mediaUrl) {
      setPosting(false);
      setUploadProgress(null);
      setUploadStatus(null);
      return;
    }
    const optimisticId = `temp-${Date.now()}`;
    const optimisticStatus = currentProfile?.can_post_without_review ? "approved" : "pending";
    const optimisticProfiles = currentProfile
      ? [
          {
            username: currentProfile.username ?? null,
            display_name: currentProfile.display_name ?? null,
            avatar_url: currentProfile.avatar_url ?? null,
            verified: currentProfile.verified ?? null,
            verification_label: currentProfile.verification_label ?? null,
          },
        ]
      : currentUserMetaProfile
        ? [currentUserMetaProfile]
        : [];
    const optimisticPost: NrealPost = {
      id: optimisticId,
      user_id: userId,
      content: trimmed || null,
      created_at: new Date().toISOString(),
      status: optimisticStatus,
      media_url: mediaUrl,
      media_type: mediaType,
      is_deleted: false,
      profiles: optimisticProfiles,
      likesCount: 0,
      likedByCurrentUser: false,
      commentsCount: 0,
    };
    setPostsWithCache((prev) => [optimisticPost, ...prev], userId);

    let response: Response;
    let payload: { error?: string; message?: string; data?: unknown; max?: number } | null = null;
    try {
      response = await fetch("/api/nreal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed || null,
          media_url: mediaUrl,
          media_type: mediaType,
        }),
      });
      payload = await response.json().catch(() => null);
    } catch (err) {
      setPosting(false);
      setUploadProgress(null);
      setUploadStatus(null);
      setPostsWithCache((prev) => prev.filter((post) => post.id !== optimisticId), userId);
      setError(err instanceof Error ? err.message : "Publikace selhala.");
      return;
    }

    setPosting(false);
    setUploadProgress(null);
    setUploadStatus(null);

    if (!response.ok) {
      setPosts((prev) => prev.filter((post) => post.id !== optimisticId));
      if (payload?.error === "blocked_content") {
        setError("Uprav text – obsahuje zakázané výrazy.");
      } else if (payload?.error === "content_too_long") {
        setError(`Text je moc dlouhý (max ${payload?.max ?? MAX_POST_CHARS} znaků).`);
      } else if (payload?.error === "unauthorized") {
        setError("Musíš být přihlášený.");
      } else {
        setError(payload?.message ?? "Publikace selhala.");
      }
      return;
    }
    const data = payload?.data as SupabasePost | undefined;
      if (data) {
      const typed = normalizePost(data as SupabasePost);
      const resolvedStatus = data.status ?? optimisticStatus;
      const fallbackProfiles = typed.profiles.length
        ? typed.profiles
        : currentProfile
          ? [
              {
                username: currentProfile.username ?? null,
                display_name: currentProfile.display_name ?? null,
                avatar_url: currentProfile.avatar_url ?? null,
                verified: currentProfile.verified ?? null,
                verification_label: currentProfile.verification_label ?? null,
              },
            ]
          : currentUserMetaProfile
            ? [currentUserMetaProfile]
            : [];
      const withProfile: NrealPost = {
        ...typed,
        status: resolvedStatus,
        is_deleted: false,
        profiles: fallbackProfiles,
        likesCount: 0,
        likedByCurrentUser: false,
        commentsCount: 0,
      };
      setPostsWithCache((prev) => prev.map((post) => (post.id === optimisticId ? withProfile : post)), userId);
      setContent("");
      resetMedia();
    } else {
      setPostsWithCache((prev) => prev.filter((post) => post.id !== optimisticId), userId);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!currentUserId) {
      setError("Musíš být přihlášený.");
      return;
    }

    if (likingPostIds.has(postId)) return;

    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const wasLiked = targetPost.likedByCurrentUser;
    const previousLikes = targetPost.likesCount;

    setLikingPostIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });

    setPostsWithCache(
      (prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const nextLiked = !wasLiked;
          const nextLikes = Math.max(0, previousLikes + (nextLiked ? 1 : -1));
          return { ...post, likedByCurrentUser: nextLiked, likesCount: nextLikes };
        }),
      currentUserId,
    );

    const { error } = wasLiked
      ? await supabase.from("nreal_likes").delete().eq("post_id", postId).eq("user_id", currentUserId)
      : await supabase.from("nreal_likes").insert({ post_id: postId, user_id: currentUserId });

    if (error) {
      setPostsWithCache(
        (prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            return { ...post, likedByCurrentUser: wasLiked, likesCount: previousLikes };
          }),
        currentUserId,
      );
      setError(error.message);
    }

    setLikingPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm">
        Načítám příspěvky…
      </div>
    );
  }

  const sanitizeVerificationLabel = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === "null" || lower === "undefined") return null;
    return trimmed;
  };
  const hasSelectedMedia = mediaType === "image" ? photoAssets.length > 0 : mediaFiles.length > 0;
  const activePhotoAsset = photoAssets.find((asset) => asset.localId === activePhotoId) ?? photoAssets[0] ?? null;
  const activeCropAspectClass =
    photoCropPreset === "1:1"
      ? "aspect-square"
      : photoCropPreset === "16:9"
        ? "aspect-video"
        : "aspect-[4/5]";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          <textarea
            value={content}
            maxLength={MAX_POST_CHARS}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_POST_CHARS))}
            placeholder="Co se děje v NRW?"
            className="min-h-[120px] w-full resize-none border-none bg-transparent text-base outline-none placeholder:text-neutral-400 md:text-sm"
          />
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{content.length}/{MAX_POST_CHARS}</span>
            {content.length >= MAX_POST_CHARS ? (
              <span className="font-semibold text-red-600">Limit dosažen</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-500">
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                multiple
                onChange={(e) => handleFileChange(e.target.files)}
              />
              {mediaType === "video" ? (
                <VideoIcon className="h-4 w-4 text-neutral-500" />
              ) : (
                <ImageIcon className="h-4 w-4 text-neutral-500" />
              )}
              {hasSelectedMedia ? "Přidat další" : "Přidat foto/video"}
            </label>
            <button
              type="submit"
              disabled={posting || (!content.trim() && !hasSelectedMedia) || !userId}
              className="ml-auto rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting
                ? uploadProgress !== null
                  ? `Odesílám… ${Math.max(1, Math.min(100, Math.round(uploadProgress)))}%`
                  : "Odesílám…"
                : "Přidat příspěvek"}
            </button>
          </div>
          {posting && uploadProgress !== null ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-600">
                <span>{uploadStatus ?? "Nahrávám…"}</span>
                <span className="font-semibold">{Math.max(1, Math.min(100, Math.round(uploadProgress)))}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-black transition-all duration-200"
                  style={{ width: `${Math.max(1, Math.min(100, Math.round(uploadProgress)))}%` }}
                />
              </div>
            </div>
          ) : null}
          {hasSelectedMedia && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={resetMedia}
                className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400"
              >
                Odebrat
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                {mediaType === "video" ? "Video" : "Foto"}
              </span>
            </div>
          )}
          {hasSelectedMedia && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-700">Náhled</div>
              {mediaType === "video" ? (
                <video
                  src={mediaPreviews[0]}
                  controls
                  className="w-full max-h-[480px] rounded-2xl border border-neutral-200 object-contain"
                />
              ) : (
                <div className="space-y-3">
                  {activePhotoAsset ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {CROP_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setPhotoCropPreset(preset);
                              setPhotoAssets((prev) =>
                                prev.map((asset) =>
                                  withComputedCrop({
                                    ...asset,
                                    cropPreset: preset,
                                    zoom: 1,
                                    offsetX: 0,
                                    offsetY: 0,
                                    processedFile: null,
                                  }),
                                ),
                              );
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              photoCropPreset === preset
                                ? "bg-black text-white"
                                : "border border-neutral-300 text-neutral-700 hover:border-neutral-500"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <div
                        className={`relative overflow-hidden rounded-2xl border border-neutral-200 bg-black ${activeCropAspectClass}`}
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          startDragGesture(e.clientX, e.clientY, rect.width, rect.height);
                        }}
                        onWheel={(e) => {
                          e.preventDefault();
                          const currentZoom = activePhotoAsset.zoom;
                          const delta = e.deltaY > 0 ? -0.08 : 0.08;
                          applyActivePhotoGesture(currentZoom + delta, activePhotoAsset.offsetX, activePhotoAsset.offsetY);
                        }}
                        onTouchStart={(e) => {
                          if (!activePhotoAsset) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (e.touches.length >= 2) {
                            const t1 = e.touches[0];
                            const t2 = e.touches[1];
                            const centerX = (t1.clientX + t2.clientX) / 2;
                            const centerY = (t1.clientY + t2.clientY) / 2;
                            const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                            cropGestureRef.current = {
                              mode: "pinch",
                              startZoom: activePhotoAsset.zoom,
                              startOffsetX: activePhotoAsset.offsetX,
                              startOffsetY: activePhotoAsset.offsetY,
                              startDistance: Math.max(1, distance),
                              startCenterX: centerX,
                              startCenterY: centerY,
                              frameWidth: rect.width,
                              frameHeight: rect.height,
                            };
                            return;
                          }
                          if (e.touches.length === 1) {
                            const t = e.touches[0];
                            startDragGesture(t.clientX, t.clientY, rect.width, rect.height);
                          }
                        }}
                        onTouchMove={(e) => {
                          if (!activePhotoAsset) return;
                          const state = cropGestureRef.current;
                          if (state.mode === "pinch" && e.touches.length >= 2) {
                            const t1 = e.touches[0];
                            const t2 = e.touches[1];
                            const centerX = (t1.clientX + t2.clientX) / 2;
                            const centerY = (t1.clientY + t2.clientY) / 2;
                            const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                            const zoomRatio = Math.max(0.5, Math.min(2.5, distance / Math.max(1, state.startDistance)));
                            const nextZoom = state.startZoom * zoomRatio;
                            const centerDx = centerX - state.startCenterX;
                            const centerDy = centerY - state.startCenterY;
                            const nextOffsetX = state.startOffsetX + (centerDx / Math.max(1, state.frameWidth)) * 2;
                            const nextOffsetY = state.startOffsetY + (centerDy / Math.max(1, state.frameHeight)) * 2;
                            applyActivePhotoGesture(nextZoom, nextOffsetX, nextOffsetY);
                            e.preventDefault();
                            return;
                          }
                          if (state.mode === "drag" && e.touches.length === 1) {
                            const t = e.touches[0];
                            updateDragGesture(t.clientX, t.clientY);
                            e.preventDefault();
                          }
                        }}
                        onTouchEnd={() => {
                          stopCropGesture();
                        }}
                        onTouchCancel={() => {
                          stopCropGesture();
                        }}
                        style={{ touchAction: "none" }}
                      >
                        <img
                          src={activePhotoAsset.previewUrl}
                          alt="Crop náhled"
                          className="h-full w-full object-cover"
                          style={{
                            transform: `translate(${activePhotoAsset.offsetX * 22}%, ${activePhotoAsset.offsetY * 22}%) scale(${activePhotoAsset.zoom})`,
                            transformOrigin: "center center",
                          }}
                        />
                        <div className="pointer-events-none absolute inset-0">
                          <div className="absolute left-1/3 top-0 h-full w-px bg-white/50" />
                          <div className="absolute left-2/3 top-0 h-full w-px bg-white/50" />
                          <div className="absolute left-0 top-1/3 h-px w-full bg-white/50" />
                          <div className="absolute left-0 top-2/3 h-px w-full bg-white/50" />
                        </div>
                      </div>
                      <div className="text-xs text-neutral-600">
                        Drag pro posun. Pinch (2 prsty) nebo kolečko myši pro zoom.
                      </div>
                    </>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {photoAssets.map((asset, index) => (
                      <div
                        key={asset.localId}
                        className={`relative overflow-hidden rounded-2xl border bg-neutral-100 ${
                          activePhotoAsset?.localId === asset.localId ? "border-black" : "border-neutral-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActivePhotoId(asset.localId)}
                          className="absolute inset-0 z-10"
                          aria-label={`Upravit náhled ${index + 1}`}
                        />
                        <img
                          src={asset.previewUrl}
                          alt={`Náhled ${index + 1}`}
                          className="h-full w-full object-cover"
                          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                        />
                        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {asset.cropPreset}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removePhotoAsset(asset.localId);
                          }}
                          className="absolute right-2 top-2 z-20 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-neutral-700 shadow-sm"
                        >
                          Odebrat
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {mediaType === "image" && photoAssets.length > 0 ? (
            <div className="rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
              Crop se použije při publikaci. V carouselu bude výška stabilní, single foto se zobrazí v originálním poměru.
            </div>
          ) : null}
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </form>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            postUserId={post.user_id}
            isDeleted={post.is_deleted ?? false}
            author={{
              displayName: safeIdentityLabel(
                post.profiles?.[0]?.display_name ?? null,
                safeIdentityLabel(post.profiles?.[0]?.username ?? null, "") || "NRW uživatel",
              ),
              username: (() => {
                const safeUsername = safeIdentityLabel(post.profiles?.[0]?.username ?? null, "");
                return safeUsername ? `@${safeUsername}` : null;
              })(),
              avatarUrl: post.profiles?.[0]?.avatar_url ?? null,
              isCurrentUser: post.user_id === currentUserId,
              verified: Boolean(post.profiles?.[0]?.verified),
              verificationLabel: sanitizeVerificationLabel(post.profiles?.[0]?.verification_label),
            }}
            postId={post.id}
            content={post.content ?? ""}
            createdAt={post.created_at}
            status={post.status}
            mediaUrl={post.media_url ?? null}
            mediaType={(post.media_type as "image" | "video" | null) ?? null}
            likesCount={post.likesCount}
            likedByCurrentUser={post.likedByCurrentUser}
            commentsCount={post.commentsCount ?? 0}
            onToggleLike={toggleLike}
            likeDisabled={!currentUserId || likingPostIds.has(post.id)}
            currentUserProfile={currentProfile}
            onDeletePost={(id) =>
              setPostsWithCache((prev) => {
                const found = prev.find((p) => p.id === id);
                if (found) deletedPostsRef.current.set(id, found);
                return prev.filter((p) => p.id !== id);
              }, currentUserId)
            }
            onRestorePost={(id) => {
              const cached = deletedPostsRef.current.get(id);
              if (cached) {
                setPostsWithCache((prev) => {
                  if (prev.some((p) => p.id === id)) return prev;
                  return [cached, ...prev];
                }, currentUserId);
                deletedPostsRef.current.delete(id);
              }
            }}
          />
        ))}
      {posts.length === 0 && (
        <div className="rounded-3xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm">
          Zatím žádné příspěvky.
        </div>
      )}
    </div>
  </div>
);
}
