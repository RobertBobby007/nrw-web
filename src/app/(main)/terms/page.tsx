import { getRequestLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

const listItemClassName = "text-sm text-neutral-700 space-y-2";
const cardClassName = "rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-3";

export default async function TermsPage() {
  const locale = await getRequestLocale();

  const listSections = [
    {
      titleKey: "legal.terms.sections.account.title",
      itemKeys: [
        "legal.terms.sections.account.items.security",
        "legal.terms.sections.account.items.usage",
        "legal.terms.sections.account.items.restriction",
        "legal.terms.sections.account.items.age",
      ],
    },
    {
      titleKey: "legal.terms.sections.content.title",
      itemKeys: [
        "legal.terms.sections.content.items.responsibility",
        "legal.terms.sections.content.items.moderation",
        "legal.terms.sections.content.items.respect",
        "legal.terms.sections.content.items.sensitive",
        "legal.terms.sections.content.items.lovePhotos",
      ],
    },
    {
      titleKey: "legal.terms.sections.love.title",
      itemKeys: [
        "legal.terms.sections.love.items.truthful",
        "legal.terms.sections.love.items.abuse",
        "legal.terms.sections.love.items.actions",
        "legal.terms.sections.love.items.location",
        "legal.terms.sections.love.items.chat",
      ],
    },
    {
      titleKey: "legal.terms.sections.payments.title",
      itemKeys: [
        "legal.terms.sections.payments.items.creditSystem",
        "legal.terms.sections.payments.items.gateway",
        "legal.terms.sections.payments.items.transfer",
        "legal.terms.sections.payments.items.billing",
      ],
    },
    {
      titleKey: "legal.terms.sections.support.title",
      itemKeys: [
        "legal.terms.sections.support.items.chat",
        "legal.terms.sections.support.items.context",
        "legal.terms.sections.support.items.thread",
      ],
    },
    {
      titleKey: "legal.terms.sections.community.title",
      itemKeys: [
        "legal.terms.sections.community.items.harassment",
        "legal.terms.sections.community.items.spam",
        "legal.terms.sections.community.items.illegal",
      ],
    },
    {
      titleKey: "legal.terms.sections.faq.title",
      itemKeys: [
        "legal.terms.sections.faq.items.abuse",
        "legal.terms.sections.faq.items.delete",
        "legal.terms.sections.faq.items.logout",
        "legal.terms.sections.faq.items.location",
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-white mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">{translate(locale, "legal.eyebrow")}</p>
        <h1 className="text-3xl font-semibold text-neutral-900">{translate(locale, "legal.terms.title")}</h1>
        <p className="text-sm text-neutral-700">{translate(locale, "legal.terms.description")}</p>
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

      <section className={cardClassName}>
        <h2 className="text-lg font-semibold text-neutral-900">{translate(locale, "legal.terms.sections.changes.title")}</h2>
        <p className="text-sm text-neutral-700">{translate(locale, "legal.terms.sections.changes.body")}</p>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">{translate(locale, "legal.terms.sections.contact.title")}</h2>
        <p className="text-sm text-neutral-700">{translate(locale, "legal.terms.sections.contact.body")}</p>
      </section>
    </main>
  );
}
