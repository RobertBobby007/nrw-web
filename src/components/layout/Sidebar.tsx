"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/news", label: "nNews", icon: Newspaper },
  { href: "/real", label: "nReal", icon: BookOpen },
  { href: "/chat", label: "nChat", icon: MessageCircle },
  { href: "/love", label: "nLove", icon: Heart },
  { href: "/id", label: "nID", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const mobileNavItems = NAV_ITEMS.filter((item) => item.href !== "/chat");

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200/70 bg-white px-4 py-3 md:hidden">
        <Link href="/" className="text-base font-semibold tracking-tight">
          NRW
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/create"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:text-neutral-900"
            aria-label="Přidat příspěvek nebo video"
          >
            <PlusCircle className="h-5 w-5" />
          </Link>
          <Link
            href="/chat"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:text-neutral-900"
            aria-label="nChat"
          >
            <MessageCircle className="h-5 w-5" />
          </Link>
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:text-neutral-900"
            aria-label="Oznámení"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
              •
            </span>
          </Link>
        </div>
      </div>

      <aside className="hidden w-full border-b border-neutral-200/70 bg-white md:block md:w-64 md:border-b-0 md:border-r">
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 md:max-w-full md:px-5 md:py-6">
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
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200/70 bg-white text-neutral-600 shadow-sm transition hover:-translate-y-0.5 hover:text-neutral-900"
              aria-label="Oznámení"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                •
              </span>
            </Link>
            <Link
              href="/create"
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
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900">
              <Settings className="h-5 w-5" />
              <span>Nastavení</span>
            </button>
            <Link
              href="/support"
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <LifeBuoy className="h-5 w-5" />
              <span>Podpora</span>
            </Link>
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
