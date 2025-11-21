import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Domů" },
];

export function MainNav() {
  return (
    <header className="border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          NRW Web
        </Link>
        <nav className="flex items-center gap-4 text-sm text-neutral-600">
          {NAV_ITEMS.map((item) => (
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
