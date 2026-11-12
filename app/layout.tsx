import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontSans, fontMono } from "@/lib/fonts";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shouldcost-io.vercel.app";
const DESCRIPTION =
  "Rebuild any bought part or service from its cost drivers, link them to live commodity indices, and benchmark supplier quotes line by line. 7-day free trial.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "shouldcost.io — Should-cost models for energy procurement",
    template: "%s · shouldcost.io",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "shouldcost.io",
    title: "shouldcost.io — Know what it should cost",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: "summary", title: "shouldcost.io — Know what it should cost", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable}`}
    >
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-overlay"
        >
          Skip to content
        </a>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
