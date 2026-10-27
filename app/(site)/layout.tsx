import type React from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/** About, How it works and Privacy: pages anyone can read, with or without a library. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2.5 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="content" className="px-safe w-full flex-1 pt-10 sm:px-6 sm:pt-16">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
