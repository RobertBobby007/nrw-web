import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export default function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 border-t md:border-t-0 md:border-l border-neutral-200/70">
        {children}
      </main>
    </div>
  );
}
