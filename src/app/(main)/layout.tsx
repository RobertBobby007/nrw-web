import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProfileBadge } from "@/components/layout/ProfileBadge";
import { NexaBubble } from "@/components/layout/NexaBubble";

export default function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col md:flex-row">
      <Sidebar />
      <main className="relative flex-1 overflow-x-hidden border-t md:border-t-0 md:border-l border-neutral-200/70 pb-20 md:pb-0">
        <ProfileBadge />
        <NexaBubble />
        {children}
      </main>
    </div>
  );
}
