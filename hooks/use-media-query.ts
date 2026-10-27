"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverDefault = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault
  );
}

/** Regular width: sidebar + toolbar layout. Below it, the compact phone layout. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
