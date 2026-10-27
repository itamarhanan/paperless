"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// On phones the name itself leads to About, so the bar keeps room for the button
const NAV = [
  { href: "/about", label: "About", wide: true },
  { href: "/how-it-works", label: "How it works", wide: false },
];

/**
 * The public pages’ bar: where you are, and one way into the app.
 * Glass only on this floating layer, never on the text (translucency.md).
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="bar-glass pt-safe sticky top-0 z-40 border-b">
      <div className="px-safe mx-auto flex h-14 max-w-5xl items-center gap-1 sm:px-6">
        <Link
          href="/about"
          className="-ml-2 mr-auto flex h-11 items-center rounded-md px-2 text-[1.0625rem] font-semibold tracking-tight"
        >
          Paperless
        </Link>
        <nav aria-label="Site" className="flex items-center">
          {NAV.map(({ href, label, wide }) => {
            const current = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center whitespace-nowrap rounded-md px-2.5 text-[0.9375rem] text-muted-foreground transition-colors hover:text-foreground sm:px-3",
                  current && "font-medium text-foreground",
                  wide && "hidden sm:flex"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Button asChild className="-mr-1 ml-1 shrink-0 font-semibold pointer-coarse:px-3.5 sm:ml-3">
          <Link href="/">Open Paperless</Link>
        </Button>
      </div>
    </header>
  );
}
