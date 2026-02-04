import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { HydrationFlag } from "@/components/hydration-flag";
import { ThemeProvider } from "@/components/theme-provider";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased bg-white text-neutral-900"
        suppressHydrationWarning
      >
        <HydrationFlag />
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}
