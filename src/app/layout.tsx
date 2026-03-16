import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";
import { HydrationFlag } from "@/components/hydration-flag";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { getRequestLocale } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: {
    default: "NRW",
    template: "%s | NRW",
  },
  description: "NRW",
  applicationName: "NRW",
  appleWebApp: {
    title: "NRW",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  },
  other: {
    "google-adsense-account": "ca-pub-7637666188210157",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body className="antialiased bg-white text-neutral-900" suppressHydrationWarning>
        <Script
          id="google-adsense"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7637666188210157"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <LocaleProvider initialLocale={locale}>
          <HydrationFlag />
          <ThemeProvider />
          {children}
          <SpeedInsights />
        </LocaleProvider>
      </body>
    </html>
  );
}
