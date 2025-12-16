import { createServerClient } from "@supabase/ssr";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProfileBadge } from "@/components/layout/ProfileBadge";
import { NexaBubble } from "@/components/layout/NexaBubble";
import { OnlineHeartbeat } from "@/components/online-heartbeat";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase env vars");
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      getAll() {
        return cookieStore.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      set() {
        // no-op in layout (Next 15 – cookies lze měnit jen v route handleru nebo server action)
      },
      remove() {
        // no-op
      },
      setAll() {
        // no-op – cookies se nesmí nastavovat v layoutu,
        // nastavují se jen v API routách / server actions
      },
    },
  });

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
