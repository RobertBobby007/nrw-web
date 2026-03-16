import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, resolveLocale } from "@/lib/i18n";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  const cookieLocale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  if (cookieStore.get(LOCALE_COOKIE_NAME)?.value) {
    return cookieLocale;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language")?.toLowerCase() ?? "";
  for (const candidate of acceptLanguage.split(",")) {
    const value = candidate.trim().split(";")[0];
    if (value.startsWith("sk")) return "sk";
    if (value.startsWith("en")) return "en";
    if (value.startsWith("cs")) return "cs";
  }

  return cookieLocale;
}
