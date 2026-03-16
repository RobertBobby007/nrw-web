import { getRequestLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

const listItemClassName = "text-sm text-neutral-700 space-y-2";
const cardClassName = "rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3";

export default async function PrivacyPage() {
  const locale = await getRequestLocale();

  const listSections = [
    {
      titleKey: "legal.privacy.sections.processedData.title",
      itemKeys: [
        "legal.privacy.sections.processedData.items.account",
        "legal.privacy.sections.processedData.items.profile",
        "legal.privacy.sections.processedData.items.content",
        "legal.privacy.sections.processedData.items.love",
        "legal.privacy.sections.processedData.items.location",
        "legal.privacy.sections.processedData.items.superLikes",
        "legal.privacy.sections.processedData.items.support",
        "legal.privacy.sections.processedData.items.technical",
      ],
    },
    {
      titleKey: "legal.privacy.sections.purposes.title",
      itemKeys: [
        "legal.privacy.sections.purposes.items.service",
        "legal.privacy.sections.purposes.items.matching",
        "legal.privacy.sections.purposes.items.realtime",
        "legal.privacy.sections.purposes.items.payments",
        "legal.privacy.sections.purposes.items.security",
        "legal.privacy.sections.purposes.items.analytics",
        "legal.privacy.sections.purposes.items.legal",
      ],
    },
    {
      titleKey: "legal.privacy.sections.loveVisibility.title",
      itemKeys: [
        "legal.privacy.sections.loveVisibility.items.profile",
        "legal.privacy.sections.loveVisibility.items.distance",
        "legal.privacy.sections.loveVisibility.items.swipes",
        "legal.privacy.sections.loveVisibility.items.chat",
        "legal.privacy.sections.loveVisibility.items.photos",
      ],
    },
    {
      titleKey: "legal.privacy.sections.payments.title",
      itemKeys: [
        "legal.privacy.sections.payments.items.credits",
        "legal.privacy.sections.payments.items.provider",
        "legal.privacy.sections.payments.items.metadata",
      ],
    },
    {
      titleKey: "legal.privacy.sections.rights.title",
      itemKeys: [
        "legal.privacy.sections.rights.items.access",
        "legal.privacy.sections.rights.items.restriction",
        "legal.privacy.sections.rights.items.objection",
      ],
    },
    {
      titleKey: "legal.privacy.sections.faq.title",
      itemKeys: [
        "legal.privacy.sections.faq.items.copy",
        "legal.privacy.sections.faq.items.delete",
        "legal.privacy.sections.faq.items.sharing",
        "legal.privacy.sections.faq.items.location",
      ],
    },
  ];

  const textSections = [
    "supportMetadata",
    "access",
    "retention",
    "contact",
  ] as const;

  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">{translate(locale, "legal.eyebrow")}</p>
        <h1 className="text-3xl font-semibold text-neutral-900">{translate(locale, "legal.privacy.title")}</h1>
        <p className="text-sm text-neutral-700">{translate(locale, "legal.privacy.description")}</p>
      </header>

      {listSections.map((section) => (
        <section key={section.titleKey} className={cardClassName}>
          <h2 className="text-lg font-semibold text-neutral-900">{translate(locale, section.titleKey)}</h2>
          <ul className={listItemClassName}>
            {section.itemKeys.map((itemKey) => (
              <li key={itemKey}>• {translate(locale, itemKey)}</li>
            ))}
          </ul>
        </section>
      ))}

      {textSections.map((sectionKey) => (
        <section key={sectionKey} className={cardClassName}>
          <h2 className="text-lg font-semibold text-neutral-900">
            {translate(locale, `legal.privacy.sections.${sectionKey}.title`)}
          </h2>
          <p className="text-sm text-neutral-700">{translate(locale, `legal.privacy.sections.${sectionKey}.body`)}</p>
        </section>
      ))}
    </main>
  );
}
