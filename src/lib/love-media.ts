"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";

const LOVE_MEDIA_BUCKET = "nlove_media";

export async function uploadLovePhoto(file: File): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("uploadLovePhoto no user", userError);
    return null;
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from(LOVE_MEDIA_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadError) {
    console.error("uploadLovePhoto error", uploadError);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(LOVE_MEDIA_BUCKET).getPublicUrl(filePath);

  return publicUrl || null;
}
