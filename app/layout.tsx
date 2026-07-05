import type { Metadata } from "next";
import "./globals.css";
import { fontSans, fontMono } from "@/lib/fonts";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "shouldcost.io — Energy procurement should-cost models",
  description:
    "Build transparent, defensible should-cost models for energy-industry equipment and services.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
