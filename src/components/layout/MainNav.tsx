import Link from "next/link";
import { translate } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";

export async function MainNav() {
  const locale = await getRequestLocale();
  const navItems = [{ href: "/", label: translate(locale, "nav.home") }];

  return (
    <header className="border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          NRW Web
        </Link>
        <nav className="flex items-center gap-4 text-sm text-neutral-600">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-neutral-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
