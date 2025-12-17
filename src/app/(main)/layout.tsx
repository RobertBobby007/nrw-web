import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProfileBadge } from "@/components/layout/ProfileBadge";
import { NexaBubble } from "@/components/layout/NexaBubble";
import { OnlineHeartbeat } from "@/components/online-heartbeat";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // V server componentu to někdy Next blokne -> necrashnout
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        } catch {
          // ignore (server components)
        }
      },
    },
  });
}

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

  if (userError || !user) {
    redirect("/auth/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("banned")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Failed to fetch profile in layout", profileError);
    redirect("/auth/login");
  }

  if (profile?.banned) {
    redirect("/auth/login?banned=1");
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col md:flex-row">
      <OnlineHeartbeat />
      <Sidebar />
      <main className="relative flex-1 overflow-x-hidden border-t md:border-t-0 md:border-l border-neutral-200/70 pb-20 md:pb-0">
        <ProfileBadge />
        <NexaBubble />
        {children}
      </main>
    </div>
  );
}
