export type NrealProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  verified?: boolean | null;
  verification_label?: string | null;
};

export type NrealPostStatus = "pending" | "approved" | "rejected";

export type NrealPost = {
  id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  status: NrealPostStatus;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  is_deleted?: boolean | null;
  profiles: NrealProfile[];
  likesCount: number;
  likedByCurrentUser: boolean;
  commentsCount?: number;
};
