"use client";

import React, { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

export const THEMES = ["light", "sepia", "dark"] as const;

/** Keeps the browser chrome (status bar, tab strip) the same colour as the page. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    if (!color) return;
    let metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (!metas.length) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
      metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    }
    metas.forEach((meta) => {
      meta.content = color;
      meta.removeAttribute("media");
    });
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      themes={[...THEMES]}
      // "sepia" would collide with Tailwind's sepia filter utility
      value={{ light: "light", dark: "dark", sepia: "theme-sepia" }}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
