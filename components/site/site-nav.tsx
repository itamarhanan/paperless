"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Site" className="flex items-center">
      {NAV.map(({ href, label }) => {
        const current = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "hidden h-11 items-center whitespace-nowrap rounded-md px-3 text-[0.9375rem] text-muted-foreground transition-colors hover:text-foreground sm:flex",
              current && "font-medium text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
