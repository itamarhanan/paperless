import type React from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The public pages are set like a page in the reader: Literata at the reader’s
 * default size and measure (.reader-prose), with the interface in Inter.
 */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("reader-prose mx-auto", className)}>{children}</div>;
}

export function PageTitle({ title, lede }: { title: string; lede: React.ReactNode }) {
  return (
    <header className="reader-prose mx-auto">
      <h1 className="mt-0 text-[2.25rem] leading-[1.12] sm:text-[3rem]">{title}</h1>
      <p className="mt-5 text-muted-foreground">{lede}</p>
    </header>
  );
}

type Shot = { light: StaticImageData; dark: StaticImageData; alt: string };

/** A screenshot in the current appearance: the light one, or the dark one in dark mode (dark-mode.md › Icons and images). */
export function Screenshot({
  shot,
  sizes,
  preload = false,
  className,
}: {
  shot: Shot;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  const frame = "h-auto w-full rounded-xl border";
  return (
    <div className={className}>
      <Image src={shot.light} alt={shot.alt} sizes={sizes} preload={preload} className={cn(frame, "dark:hidden")} />
      <Image src={shot.dark} alt={shot.alt} sizes={sizes} className={cn(frame, "hidden dark:block")} />
    </div>
  );
}

export function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="mt-3 text-[0.8125rem] leading-snug text-muted-foreground">{children}</figcaption>;
}

/** The reader’s page turn: a large Next button that names where it goes. */
export function NextPage({ href, title, label = "Next" }: { href: string; title: string; label?: string }) {
  return (
    <nav aria-label="Next page" className="mx-auto mt-14 max-w-[42.5rem] border-t pt-6">
      <Link
        href={href}
        className="group flex w-full items-center justify-between gap-4 rounded-xl bg-primary px-5 py-4 text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="min-w-0">
          <span className="block text-[0.8125rem] opacity-70">{label}</span>
          <span className="block text-[1.0625rem] font-semibold">{title}</span>
        </span>
        <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </nav>
  );
}
