export type NrealPost = {
  id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url?: string | null;
    verified?: boolean | null;
    verification_label?: string | null;
  } | null;
};
