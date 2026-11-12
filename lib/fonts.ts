import { IBM_Plex_Sans, IBM_Plex_Mono, Newsreader } from "next/font/google";

// IBM Plex: an engineering grotesk with real character for a cost-engineering
// tool, and a matching mono so every figure lines up in tabular columns.
export const fontSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-next",
  display: "swap",
});

export const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-next",
  display: "swap",
});

/** Editorial display serif — marketing headlines only, so the app never loads it. */
export const fontDisplay = Newsreader({
  subsets: ["latin"],
  variable: "--font-display-next",
  display: "swap",
  style: ["normal", "italic"],
});
