"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  Home,
  MessageCircle,
  Heart,
  BookOpen,
  Newspaper,
  User,
  Settings,
  Bell,
  Search,
  PlusCircle,
  LifeBuoy,
  Clapperboard,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { requestAuth } from "@/lib/auth-required";
import { subscribeToTable } from "@/lib/realtime";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/news", label: "nNews", icon: Newspaper },
  { href: "/real", label: "nReal", icon: BookOpen },
  { href: "/chat", label: "nChat", icon: MessageCircle },
  { href: "/clips", label: "nClips", icon: Clapperboard },
  { href: "/love", label: "nLove", icon: Heart },
  { href: "/id", label: "nID", icon: User },
];

const PROTECTED_HREFS = new Set(["/create", "/notifications", "/settings", "/chat", "/id", "/love"]);

export function Sidebar() {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const mobileNavItems = NAV_ITEMS.filter((item) => item.href !== "/chat");
  const hideMobileHeader = pathname?.startsWith("/chat") || pathname?.startsWith("/clips");

  useEffect(() => {
    let active = true;
    let realtimeUnsubscribe: (() => void) | null = null;

    const ensureRealtime = (userId: string | null) => {
      if (currentUserIdRef.current === userId) return;
      currentUserIdRef.current = userId;
      if (realtimeUnsubscribe) {
        realtimeUnsubscribe();
        realtimeUnsubscribe = null;
      }
      if (!userId) return;
      realtimeUnsubscribe = subscribeToTable("notifications", (payload) => {
        if (!payload) return;
        if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return;
        const targetUserId =
          (payload.new as { user_id?: string | null })?.user_id ??
          (payload.old as { user_id?: string | null })?.user_id ??
          null;
        if (targetUserId && targetUserId !== userId) return;
        void loadUnread();
      });
    };

    const loadUnread = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthenticated(Boolean(user?.id));
      if (!active) return;
      ensureRealtime(user?.id ?? null);
      if (!user?.id) {
        setUnreadCount(0);
        return;
      }
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (!active) return;
      if (error) {
        console.error("Sidebar unread notifications error", error);
        setUnreadCount(0);
        return;
      }
      setUnreadCount(count ?? 0);
    };

    void loadUnread();
    const onUpdated = () => void loadUnread();
    window.addEventListener("nrw:notifications_updated", onUpdated);
    window.addEventListener("focus", onUpdated);
    document.addEventListener("visibilitychange", onUpdated);
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      if (!active) return;
      void loadUnread();
    });

    return () => {
      active = false;
      window.removeEventListener("nrw:notifications_updated", onUpdated);
      window.removeEventListener("focus", onUpdated);
      document.removeEventListener("visibilitychange", onUpdated);
      authSub.subscription.unsubscribe();
      if (realtimeUnsubscribe) {
        realtimeUnsubscribe();
      }
    };
  }, [supabase]);

  const handleProtectedClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!isAuthenticated && PROTECTED_HREFS.has(href)) {
      event.preventDefault();
      requestAuth();
    }
  };

  return (
    <>
      <div
        className={`border-b border-neutral-200/70 bg-white px-4 py-3 md:hidden ${
          hideMobileHeader ? "hidden" : "flex items-center justify-between"
        }`}
      >
        <Link href="/" className="text-base font-semibold tracking-tight">
          NRW
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/create"
            onClick={(event) => handleProtectedClick(event, "/create")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:text-neutral-900"
            aria-label="Přidat příspěvek nebo video"
          >
            <PlusCircle className="h-5 w-5" />
          </Link>
          <Link
            href="/chat"
            onClick={(event) => handleProtectedClick(event, "/chat")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:text-neutral-900"
            aria-label="nChat"
          >
            <MessageCircle className="h-5 w-5" />
          </Link>
          <Link
            href="/notifications"
            onClick={(event) => handleProtectedClick(event, "/notifications")}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:text-neutral-900"
            aria-label="Oznámení"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/settings"
            onClick={(event) => handleProtectedClick(event, "/settings")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:text-neutral-900"
            aria-label="Nastavení"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <aside className="hidden w-full border-b border-neutral-200/70 bg-white md:sticky md:top-0 md:block md:h-screen md:w-64 md:border-b-0 md:border-r md:overflow-y-auto">
        <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col gap-6 px-4 py-4 md:max-w-full md:px-5 md:py-6">
          <div className="flex items-center justify-between md:justify-start pr-24">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              NRW
            </Link>
          </div>

          <div className="absolute right-4 top-4 hidden items-center gap-2 md:flex">
            <Link
              href="/search"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:-translate-y-0.5 hover:text-neutral-900"
              aria-label="Vyhledávání příspěvků"
            >
              <Search className="h-5 w-5" />
            </Link>
            <Link
              href="/notifications"
              onClick={(event) => handleProtectedClick(event, "/notifications")}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:-translate-y-0.5 hover:text-neutral-900"
              aria-label="Oznámení"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/create"
              onClick={(event) => handleProtectedClick(event, "/create")}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-neutral-800"
              aria-label="Přidat příspěvek nebo video"
            >
              <PlusCircle className="h-5 w-5" />
            </Link>
          </div>

          <nav className="flex flex-row gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(event) => handleProtectedClick(event, item.href)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-neutral-100 text-neutral-900 font-semibold"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden border-t border-neutral-200/70 pt-4 md:block">
            <Link
              href="/settings"
              onClick={(event) => handleProtectedClick(event, "/settings")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <Settings className="h-5 w-5" />
              <span>Nastavení</span>
            </Link>
            <Link
              href="/support"
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <LifeBuoy className="h-5 w-5" />
              <span>Podpora</span>
            </Link>
            <div className="ml-8 mt-2 space-y-1 text-xs text-neutral-500">
              <Link href="/privacy" className="block transition-colors hover:text-neutral-900">
                Ochrana soukromí
              </Link>
              <Link href="/terms" className="block transition-colors hover:text-neutral-900">
                Smluvní podmínky
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
        aria-label="Hlavní navigace"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => handleProtectedClick(event, item.href)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${
                  active ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
