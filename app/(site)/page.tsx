import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, FileText, LayoutTemplate, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Caption, Screenshot } from "@/components/site/page-parts";
import { pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";
import desktopLight from "@/public/screenshots/meditations-desktop-light.png";
import desktopDark from "@/public/screenshots/meditations-desktop-dark.png";
import iphoneLight from "@/public/screenshots/meditations-iphone-light.png";
import iphoneDark from "@/public/screenshots/meditations-iphone-dark.png";
import passageLight from "@/public/screenshots/meditations-passage-light.png";
import passageDark from "@/public/screenshots/meditations-passage-dark.png";

const DESCRIPTION =
  "Read PDFs and EPUBs as pages sized for your screen. Keep chapters and italics, lose running heads and page numbers. Your library stays in your browser.";

export const metadata = pageMetadata({
  title: "Paperless: a reader for the books you already have",
  absoluteTitle: true,
  description: DESCRIPTION,
  path: "/",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Paperless",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "ReferenceApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with JavaScript.",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  image: `${SITE_URL}/opengraph-image`,
  screenshot: [
    `${SITE_URL}/screenshots/meditations-iphone-light.png`,
    `${SITE_URL}/screenshots/meditations-desktop-light.png`,
  ],
  featureList: [
    "Reads PDF and EPUB books",
    "Chapters from the PDF outline, headings from font sizes",
    "Removes running heads and page numbers",
    "Hides front and back matter",
    "Free books from Project Gutenberg",
    "Library stored on your device, with backup and restore",
    "AI labels layout without changing the text",
  ],
  author: { "@type": "Person", name: "Itamar Hanan", url: "https://itamar-hanan.web.app" },
};

const FEATURES: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  link?: { href: string; label: string };
}[] = [
  {
    icon: FileText,
    title: "Any book you have",
    text: "Import a PDF or EPUB from your device, paste a link to one, or find a free classic in Discover. Files up to 50 MB.",
    link: { href: "/discover", label: "Find a free book" },
  },
  {
    icon: BookOpen,
    title: "One screen at a time",
    text: "Pages are sized to your screen and scroll like a book. Chapters start fresh, and a large Next button names what comes.",
  },
  {
    icon: LayoutTemplate,
    title: "The book as it was printed",
    text: "Chapters from the outline, italics and drop caps kept. Running heads, page numbers and copyright pages are set aside.",
    link: { href: "/how-it-works", label: "How it works" },
  },
  {
    icon: ShieldCheck,
    title: "Only on your device",
    text: "No account. Your library lives in your browser and opens offline. Back it up to a file and restore it anywhere.",
    link: { href: "/privacy", label: "Privacy" },
  },
];

/**
 * Shared type styles for section headings.
 */
const display = "font-serif font-medium tracking-[-0.02em] text-balance";
const eyebrow = "font-sans text-[0.75rem] font-medium uppercase tracking-[0.14em] text-muted-foreground";

export default function FrontPage() {
  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <section aria-label="Paperless, a reader for the books you already have" className="px-safe pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
            <h1 className={`${display} text-[2.75rem] leading-[1.06] sm:text-[4.25rem] sm:leading-[1.04]`}>
              Read the books you already have.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Open a PDF or EPUB to read one screen at a time. Chapters, italics and quotes stay; running heads and page
              numbers go.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild size="lg" className="font-semibold">
                <Link href="/library">Open your library</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-semibold">
                <Link href="/library?sample">Start with Meditations</Link>
              </Button>
            </div>
            <p className="mt-5 text-[0.8125rem] text-muted-foreground">
              Free · No account · Your books stay on your device
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-14 max-w-4xl sm:mt-20">
          <div
            aria-hidden
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 absolute -inset-x-4 sm:-inset-x-10 -top-8 bottom-0 rounded-3xl bg-gradient-to-b from-muted to-transparent sm:-top-12"
          />
          <div className="relative motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
            <Image
              src={desktopLight}
              alt="Meditations open in the reader on a desktop: the contents list on the left, the first book set in large serif text on the right."
              sizes="(min-width: 1024px) 56rem, 92vw"
              preload
              className="w-full rounded-xl border shadow-xl dark:hidden"
            />
            <Image
              src={desktopDark}
              alt=""
              sizes="(min-width: 1024px) 56rem, 92vw"
              className="hidden w-full rounded-xl border shadow-xl dark:block"
            />
            <div className="absolute -right-3 -bottom-8 w-[24%] sm:right-6 sm:-bottom-12">
              <Image
                src={iphoneLight}
                alt="The same book on an iPhone: one screen of large serif text with the toolbar below."
                sizes="(min-width: 640px) 16rem, 24vw"
                className="w-full rounded-xl border shadow-2xl dark:hidden"
              />
              <Image
                src={iphoneDark}
                alt=""
                sizes="(min-width: 640px) 16rem, 24vw"
                className="hidden w-full rounded-xl border shadow-2xl dark:block"
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-title" className="px-safe mt-24 sm:mt-32">
        <h2 id="features-title" className="sr-only">
          What Paperless does
        </h2>
        <ul className="mx-auto max-w-5xl divide-y border-y">
          {FEATURES.map(({ icon: Icon, title, text, link }) => (
            <li key={title} className="flex gap-4 py-6 sm:gap-6">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon aria-hidden className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.0625rem] font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</p>
                {link && (
                  <Link
                    href={link.href}
                    className="mt-2 inline-block text-[0.9375rem] font-medium underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ai-title" className="px-safe mt-24 sm:mt-32">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-prose">
            <p className={eyebrow}>A narrow job for AI</p>
            <h2 id="ai-title" className={`${display} mt-3 text-[2rem] leading-tight sm:text-[2.5rem]`}>
              AI labels the page. It does not rewrite it.
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground sm:text-[1.0625rem]">
              A model labels headings, quotes and stray page numbers. Paperless checks each answer against the book and
              ignores anything that does not match.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground sm:text-[1.0625rem]">
              Pages it touched keep a Show original link, and reading works fully with the AI turned off.
            </p>
            <Link
              href="/how-it-works"
              className="mt-6 inline-block text-[1.0625rem] font-medium underline-offset-4 hover:underline"
            >
              How the AI works
            </Link>
          </div>
          <figure className="mx-auto w-full max-w-sm">
            <Screenshot
              sizes="24rem"
              shot={{
                light: passageLight,
                dark: passageDark,
                alt: "A page of Meditations with one sentence underlined, a note under it reading Key passages marked by AI, and a Show original link.",
              }}
            />
            <Caption>A key passage, quoted exactly, with Show original under it.</Caption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="try-title" className="px-safe mt-24 pb-10 sm:mt-32">
        <div className="mx-auto max-w-3xl rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12 sm:py-16">
          <h2 id="try-title" className={`${display} text-[2rem] leading-tight sm:text-[2.75rem]`}>
            Try it with a real book.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed opacity-70">
            Meditations is free from Project Gutenberg. Open it to see how the reader works. No account or setup needed.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" variant="secondary" className="font-semibold">
              <Link href="/library?sample">Start with Meditations</Link>
            </Button>
          </div>
          <p className="mt-5 text-[0.9375rem] opacity-70">
            Or{" "}
            <Link href="/library" className="font-medium underline underline-offset-4 hover:opacity-90">
              open your library
            </Link>{" "}
            and add your own.
          </p>
        </div>
      </section>
    </article>
  );
}
