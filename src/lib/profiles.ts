"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  verified?: boolean | null;
  verification_label?: string | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "profiles";
const AVATAR_BUCKET = "avatars";

// Vrátí profil přihlášeného uživatele (nebo null)
export async function fetchCurrentProfile(): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (error) {
    console.error("fetchCurrentProfile error", error);
    return null;
  }

  if (data) return data;
  return null;
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

  const { error } = await supabase.from(TABLE).upsert(
    {
      id: userId,
      username: username ?? null,
      display_name: displayName ?? null,
      avatar_url: avatarUrl ?? null,
      bio: bio ?? null,
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

  const { error } = await supabase.from(TABLE).upsert(
    {
      id: user.id,
      username: username ?? null,
      display_name: displayName ?? null,
      avatar_url: avatarUrl ?? null,
      bio: bio ?? null,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("updateCurrentProfile error", error);
    return null;
  }

  const { data, error: fetchError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (fetchError) {
    console.error("updateCurrentProfile refetch error", fetchError);
    return null;
  }

  return data;
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
