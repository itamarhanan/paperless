import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SiteNav } from "./site-nav";

/**
 * The public pages’ bar: where you are, and one way into the app.
 * Glass only on this floating layer, never on the text (translucency.md).
 */
export function SiteHeader() {
  return (
    <header className="bar-glass pt-safe sticky top-0 z-40 border-b">
      <div className="px-safe mx-auto flex h-14 max-w-5xl items-center gap-1 sm:px-6">
        <Link
          href="/"
          className="-ml-2 mr-auto flex h-11 items-center gap-2 rounded-md px-2 text-[1.0625rem] font-semibold tracking-tight"
        >
          <LogoMark className="size-[1.375rem]" />
          Paperless
        </Link>
        <SiteNav />
        <Button asChild className="-mr-1 ml-1 shrink-0 font-semibold pointer-coarse:px-3.5 sm:ml-3">
          <Link href="/library">Open Paperless</Link>
        </Button>
      </div>
    </header>
  );
}
