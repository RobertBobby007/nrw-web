import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import "./globals.css";
import { HydrationFlag } from "@/components/hydration-flag";
import { ThemeProvider } from "@/components/theme-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="cs">
      <head>
        <Script
          id="google-adsense"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7637666188210157"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className="antialiased bg-white text-neutral-900"
        suppressHydrationWarning
      >
        <HydrationFlag />
        <ThemeProvider />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
