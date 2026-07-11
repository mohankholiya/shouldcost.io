"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** App-wide theme context. `.dark` class on <html> flips the runtime tokens in globals.css. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
