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

  return (
    <aside className="bg-white border-b md:border-b-0 md:border-r border-neutral-200/70 w-full md:w-64">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 md:max-w-full md:px-5 md:py-6">
        <div className="flex items-center justify-between md:justify-start">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            NRW
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
        </div>
      </div>
    </aside>
  );
}
