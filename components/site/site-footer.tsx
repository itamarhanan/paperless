import Link from "next/link";
import { PUBLIC_PAGES } from "@/lib/metadata";

const linkClass =
  "flex h-11 items-center rounded-sm underline-offset-4 hover:text-foreground hover:underline pointer-fine:h-8";

export function SiteFooter() {
  return (
    <footer className="px-safe pb-safe mx-auto mt-20 w-full max-w-5xl border-t text-[0.8125rem] text-muted-foreground sm:px-6">
      <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5">
            <li>
              <Link href="/library" className={linkClass}>
                Library
              </Link>
            </li>
            {PUBLIC_PAGES.map(({ path, label }) => (
              <li key={path}>
                <Link href={path} className={linkClass}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>
          Made by{" "}
          <a href="https://itamar-hanan.web.app" className="underline underline-offset-4 hover:text-foreground">
            Itamar Hanan
          </a>
          . MIT licensed.
        </p>
      </div>
    </footer>
  );
}
