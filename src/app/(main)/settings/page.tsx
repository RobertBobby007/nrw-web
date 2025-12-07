"use client";

import {
  Bell,
  BriefcaseBusiness,
  EyeOff,
  Globe2,
  Link,
  Lock,
  Map,
  MessageCircle,
  MessageSquare,
  Shield,
  Tag,
  User,
  Users,
  ShieldCheck,
  BadgeCheck,
  Crown,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";

type SectionKey =
  | "profile"
  | "notifications"
  | "pro"
  | "creator"
  | "privacy"
  | "closeFriends"
  | "blocked"
  | "story"
  | "messages"
  | "tags"
  | "comments"
  | "security"
  | "verification"
  | "subscription";

type NavSection = {
  title: string;
  items: { key: SectionKey; label: string; icon: ComponentType<{ className?: string }> }[];
};

const navSections: NavSection[] = [
  {
    title: "Jak používáš NRW",
    items: [
      { key: "profile", label: "Upravit profil", icon: User },
      { key: "notifications", label: "Upozornění", icon: Bell },
      { key: "pro", label: "Pro účet a značky", icon: BriefcaseBusiness },
      { key: "creator", label: "Nástroje tvůrců", icon: Shield },
    ],
  },
  {
    title: "Kdo vidí tvůj obsah",
    items: [
      { key: "privacy", label: "Soukromí účtu", icon: Lock },
      { key: "closeFriends", label: "Blízcí přátelé", icon: Users },
      { key: "blocked", label: "Blokovaní", icon: EyeOff },
      { key: "story", label: "Příběh a lokalita", icon: Map },
    ],
  },
  {
    title: "Jak s tebou mluví ostatní",
    items: [
      { key: "messages", label: "Zprávy a žádosti", icon: MessageSquare },
      { key: "tags", label: "Označení a zmínky", icon: Tag },
      { key: "comments", label: "Komentáře", icon: MessageCircle },
    ],
  },
  {
    title: "Zabezpečení a účet",
    items: [
      { key: "security", label: "Bezpečnost", icon: ShieldCheck },
      { key: "verification", label: "Ověření účtu", icon: BadgeCheck },
      { key: "subscription", label: "Předplatné NRW+", icon: Crown },
    ],
  },
];

const BIO_LIMIT = 150;

export default function SettingsPage() {
  const [web, setWeb] = useState("");
  const [bio, setBio] = useState("🖥️ ajťák & herec 🤘\nPoslouchej: @arvickopodcast");
  const [showThreads, setShowThreads] = useState(true);
  const [gender, setGender] = useState("Muž");
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");

  const bioCount = useMemo(() => bio.length, [bio]);

  const isActive = (key: SectionKey) => activeSection === key;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">Nastavení</p>
            <h1 className="text-3xl font-semibold text-neutral-900">Upravit profil</h1>
            <p className="text-sm text-neutral-700">
              Přepínej sekce vlevo a uprav svůj NRW účet. Vše zatím staticky, ale navržené
              pro snadné napojení na backend.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
              {navSections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.key);
                      return (
                        <button
                          key={item.label}
                          onClick={() => setActiveSection(item.key)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition ${
                            active
                              ? "bg-neutral-900 text-white shadow-sm"
                              : "text-neutral-700 hover:bg-neutral-100"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="flex-1 text-left">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="space-y-6">{renderSection(activeSection, { bio, bioCount, setBio, gender, setGender, web, setWeb, showThreads, setShowThreads })}</section>
        </div>
      </div>
    </main>
  );
}

function renderSection(
  key: SectionKey,
  {
    bio,
    bioCount,
    setBio,
    gender,
    setGender,
    web,
    setWeb,
    showThreads,
    setShowThreads,
  }: {
    bio: string;
    bioCount: number;
    setBio: (val: string) => void;
    gender: string;
    setGender: (val: string) => void;
    web: string;
    setWeb: (val: string) => void;
    showThreads: boolean;
    setShowThreads: (val: boolean) => void;
  }
) {
  switch (key) {
    case "profile":
      return (
        <>
          <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-neutral-200">
                  <img
                    src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=facearea&w=200&q=60&facepad=2"
                    alt="Profilová fotka"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-900">@robert_bobby_knobloch</div>
                  <div className="text-xs text-neutral-600">Robert Knobloch</div>
                </div>
              </div>
              <button className="w-full rounded-lg border border-neutral-200/70 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto">
                Změnit fotku
              </button>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
            <Field label="Web" description="Upravuj odkazy i z mobilu.">
              <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 py-2 text-sm text-neutral-400">
                Web
              </div>
            </Field>

            <Field
              label="Životopis"
              description="Krátký popis profilu. Náhled se propíše do NRW a nID."
              count={`${bioCount} / ${BIO_LIMIT}`}
            >
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_LIMIT))}
                rows={3}
                className="w-full resize-none rounded-lg border border-neutral-200/70 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-neutral-400"
                placeholder="Napiš svůj bio…"
              />
            </Field>

            <Field label="Zobrazit štítek Threads">
              <Toggle
                checked={showThreads}
                onChange={() => setShowThreads(!showThreads)}
                label={showThreads ? "Štítek je vidět" : "Štítek je skrytý"}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Pohlaví"
                description="Na tvém veřejném profilu se to neukáže."
              >
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200/70 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                >
                  <option>Muž</option>
                  <option>Žena</option>
                  <option>Nechci uvádět</option>
                </select>
              </Field>
              <Field label="Web (beta)" description="Odkaz pro NRW profil.">
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200/70 px-3 py-2">
                  <Link className="h-4 w-4 text-neutral-500" />
                  <input
                    value={web}
                    onChange={(e) => setWeb(e.target.value)}
                    className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-500 outline-none"
                    placeholder="https://nrw.app/..."
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition hover:text-neutral-900">
              Zrušit
            </button>
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800">
              Uložit změny
            </button>
          </div>
        </>
      );
    case "security":
      return (
        <>
          <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Rychlá ochrana</div>
                <p className="text-xs text-neutral-600">
                  Štíty jsou zatím mock, připravené k propojení s API.
                </p>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">
                NRW shield
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ShieldCard
                icon={Lock}
                title="Dvoufázové ověření"
                note="Přihlášení ověříme kódem nebo push."
              />
              <ShieldCard
                icon={Globe2}
                title="Viditelnost profilu"
                note="Načteme z nID a synchronizujeme s feedem."
              />
              <ShieldCard
                icon={Bell}
                title="Upozornění"
                note="Nastavení notifikací na /notifications/preferences."
              />
              <ShieldCard
                icon={Tag}
                title="Označení a zmínky"
                note="Upravíme, kdo tě může tagovat."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Bezpečnost</div>
                <p className="text-xs text-neutral-600">
                  Přepni klíčové ochrany. Stavy jsou zatím mock.
                </p>
              </div>
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white">
                Safe
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <Toggle
                checked
                onChange={() => {}}
                label="Dvoufázové ověření (zapnuto)"
              />
              <Toggle
                checked
                onChange={() => {}}
                label="Výstrahy při novém zařízení"
              />
              <Toggle
                checked
                onChange={() => {}}
                label="Schvalování přihlášení"
              />
              <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-600">
                Napojíme na `/auth/security` a zobrazíme poslední pokusy.
              </div>
            </div>
          </div>
        </>
      );
    case "verification":
      return (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Ověření účtu</div>
              <p className="text-xs text-neutral-600">
                Připravujeme propojení s nID pro ověřené profily.
              </p>
            </div>
            <BadgeCheck className="h-5 w-5 text-neutral-800" />
          </div>
          <div className="mt-4 space-y-3">
            <InfoRow icon={User} title="Identita" text="nID · základní" />
            <InfoRow icon={ShieldCheck} title="Stav" text="Čeká na upgrade" />
            <InfoRow icon={Tag} title="Veřejný štítek" text="NRW Verified (soon)" />
            <button className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800">
              Požádat o ověření
            </button>
          </div>
        </div>
      );
    case "subscription":
      return (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Předplatné NRW+</div>
              <p className="text-xs text-neutral-600">
                Více analytik, rychlejší podpora a brzký přístup k experimentům.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5" />
              Beta
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <PlanCard
              title="Starter"
              price="0 Kč"
              perks={["Základní ochrana", "Notifikace", "Komunita"]}
            />
            <PlanCard
              highlight
              title="NRW+"
              price="169 Kč/měs"
              perks={["Prioritní podpora", "Detailní analýzy", "Ověření profilu"]}
            />
            <PlanCard
              title="NRW Pro"
              price="389 Kč/měs"
              perks={["Týmové role", "API přístup", "Brand kit & štítky"]}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-neutral-800">
              Aktivovat NRW+
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-neutral-200/70 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50">
              <CreditCard className="h-4 w-4" />
              Spravovat platby
            </button>
          </div>
        </div>
      );
    default:
      return (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 text-sm text-neutral-700 shadow-sm">
          Tato sekce bude doplněna později. Vyber jinou položku vlevo.
        </div>
      );
  }
}

function Field({
  label,
  description,
  count,
  children,
}: {
  label: string;
  description?: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
        <div className="flex items-center gap-2">
          <span>{label}</span>
        </div>
        {count ? <span className="text-xs font-medium text-neutral-500">{count}</span> : null}
      </div>
      {children}
      {description ? <p className="text-xs text-neutral-600">{description}</p> : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-200/70 px-4 py-2.5 transition hover:border-neutral-300 hover:bg-neutral-50"
      aria-pressed={checked}
    >
      <span className="text-sm font-medium text-neutral-900">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-neutral-900" : "bg-neutral-200"
        }`}
      >
        <span
          className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function ShieldCard({
  icon: Icon,
  title,
  note,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  note: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-neutral-800 shadow-sm ring-1 ring-neutral-200">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-600">{note}</div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200/70 px-3 py-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-50 text-neutral-800 ring-1 ring-neutral-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-[11px] text-neutral-600">{text}</div>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  perks,
  highlight,
}: {
  title: string;
  price: string;
  perks: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-neutral-200/70 bg-white px-4 py-3 shadow-sm ${
        highlight ? "ring-2 ring-neutral-900" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-600">{price}</div>
      </div>
      <ul className="space-y-1 text-xs text-neutral-600">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" aria-hidden />
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );
}
