"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that keeps the library and reader working
 * offline (public/sw.js). Production only: in development it would serve
 * stale code, so any worker left from a production run is removed.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => r.unregister()));
      return;
    }
    const version = encodeURIComponent(process.env.SW_VERSION ?? "1");
    navigator.serviceWorker
      .register(`/sw.js?v=${version}`, { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Scripts this page loaded before the worker was running
        const urls = performance.getEntriesByType("resource").map((entry) => entry.name);
        registration.active?.postMessage({ type: "cache", urls });
      })
      .catch(() => {
        // Without a worker the app still works online
      });
  }, []);
  return null;
}
