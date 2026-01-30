import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProfileBadge } from "@/components/layout/ProfileBadge";
import { OnlineHeartbeat } from "@/components/online-heartbeat";
import { BanWatcher } from "@/components/ban-watcher";
import { FullscreenAnnouncement } from "@/components/announcements/FullscreenAnnouncement";
import { AuthRequiredDialog } from "@/components/ui/AuthRequiredDialog";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (user && !userError) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("banned_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to fetch profile in layout", profileError);
    }

    if (profile?.banned_at) {
      redirect("/auth/banned");
    }
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col md:flex-row">
      <OnlineHeartbeat />
      <BanWatcher />
      <Sidebar />
      <main className="relative flex-1 overflow-x-hidden border-t md:border-t-0 md:border-l border-neutral-200/70 pb-20 md:pb-0">
        <div className="hidden md:block">
          <ProfileBadge />
        </div>
        {children}
      </main>
      <AuthRequiredDialog />
      <FullscreenAnnouncement userId={user?.id ?? null} />
    </div>
  );
}
