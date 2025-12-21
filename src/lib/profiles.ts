"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";
import { containsBlockedContent, containsBlockedIdentityContent } from "./content-filter";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banned_at?: string | null;
  ban_reason?: string | null;
  verified?: boolean | null;
  verification_label?: string | null;
  can_post_without_review?: boolean | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "profiles";
const AVATAR_BUCKET = "avatars";
const PROFILE_CACHE_TTL_MS = 60000;
let cachedProfile: Profile | null = null;
let cachedAt = 0;
let inflightProfile: Promise<Profile | null> | null = null;

export function getCachedProfile(): Profile | null {
  return cachedProfile;
}

// Vrátí profil přihlášeného uživatele (nebo null)
export async function fetchCurrentProfile(options?: { force?: boolean }): Promise<Profile | null> {
  const force = options?.force ?? false;
  const now = Date.now();
  if (!force && cachedProfile && now - cachedAt < PROFILE_CACHE_TTL_MS) {
    return cachedProfile;
  }
  if (!force && inflightProfile) {
    return inflightProfile;
  }

  inflightProfile = (async () => {
    try {
      const response = await fetch("/api/profile", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        return cachedProfile;
      }

      const payload = await response.json().catch(() => null);
      const profile = payload?.data as Profile | null | undefined;
      if (profile) {
        cachedProfile = profile;
        cachedAt = Date.now();
        return profile;
      }
      cachedAt = Date.now();
      return cachedProfile;
    } finally {
      inflightProfile = null;
    }
  })();

  return inflightProfile;
}

// Vytvoří / aktualizuje profil pro daného usera
export async function upsertProfileFromAuth(options: {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { userId, username, displayName, avatarUrl, bio } = options;
  const normalizedUsername = (username ?? "").trim().replace(/^@+/, "");
  const normalizedDisplayName = (displayName ?? "").trim();
  const normalizedBio = (bio ?? "").trim();

  if (normalizedUsername && containsBlockedIdentityContent(normalizedUsername).hit) {
    console.error("upsertProfileFromAuth blocked username");
    return;
  }
  if (normalizedDisplayName && containsBlockedIdentityContent(normalizedDisplayName).hit) {
    console.error("upsertProfileFromAuth blocked display name");
    return;
  }
  if (normalizedBio && containsBlockedContent(normalizedBio).hit) {
    console.error("upsertProfileFromAuth blocked bio");
    return;
  }

  const { error } = await supabase.from(TABLE).upsert(
    {
      id: userId,
      username: normalizedUsername || null,
      display_name: normalizedDisplayName || null,
      avatar_url: avatarUrl ?? null,
      bio: normalizedBio || null,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("upsertProfileFromAuth error", error);
  }
}

export async function deleteAvatarByUrl(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return;
  const supabase = getSupabaseBrowserClient();
  const prefix = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const idx = publicUrl.indexOf(prefix);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + prefix.length);
  if (!path) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.error("deleteAvatarByUrl error", error);
}

// Aktualizuje profil přihlášeného uživatele a vrátí uloženou hodnotu
export async function updateCurrentProfile(options: {
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("updateCurrentProfile no user", userError);
    return null;
  }

  const { username, displayName, avatarUrl, bio } = options;
  const normalizedUsername = (username ?? "").trim().replace(/^@+/, "");
  const normalizedDisplayName = (displayName ?? "").trim();
  const normalizedBio = (bio ?? "").trim();
  if (normalizedUsername && containsBlockedIdentityContent(normalizedUsername).hit) {
    console.error("updateCurrentProfile blocked username");
    return null;
  }
  if (normalizedDisplayName && containsBlockedIdentityContent(normalizedDisplayName).hit) {
    console.error("updateCurrentProfile blocked display name");
    return null;
  }
  if (normalizedBio && containsBlockedContent(normalizedBio).hit) {
    console.error("updateCurrentProfile blocked bio");
    return null;
  }

  const { error } = await supabase.from(TABLE).upsert(
    {
      id: user.id,
      username: normalizedUsername || null,
      display_name: normalizedDisplayName || null,
      avatar_url: avatarUrl ?? null,
      bio: normalizedBio || null,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("updateCurrentProfile error", error);
    return null;
  }

  return fetchCurrentProfile({ force: true });
}

// Nahraje avatar do bucketu "avatars" a vrátí veřejnou URL (nutný veřejný bucket)
export async function uploadAvatar(file: File): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("uploadAvatar no user", userError);
    return null;
  }

  const fileExt = file.name.split(".").pop() || "png";
  const filePath = `${user.id}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadError) {
    console.error("uploadAvatar error", uploadError);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

  return publicUrl || null;
}
