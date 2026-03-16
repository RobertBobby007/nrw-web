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
  if (acceptLanguage.startsWith("en") || acceptLanguage.includes(",en")) {
    return "en";
  }

  return cookieLocale;
}
