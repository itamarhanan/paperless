import type React from "react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Caption, NextPage, Prose, Screenshot } from "@/components/site/page-parts";
import { pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";
import iphoneLight from "@/public/screenshots/meditations-iphone-light.png";
import iphoneDark from "@/public/screenshots/meditations-iphone-dark.png";
import passageLight from "@/public/screenshots/meditations-passage-light.png";
import passageDark from "@/public/screenshots/meditations-passage-dark.png";

const DESCRIPTION =
  "Open a PDF or EPUB and read it as pages that fit your phone or desktop, with the book’s chapters, headings and italics kept. Free, no account, and your books stay on your device.";

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

const CHAPTERS = [
  { id: "books", title: "Any book you have" },
  { id: "pages", title: "One screen at a time" },
  { id: "structure", title: "The book as it was printed" },
  { id: "ai", title: "AI that labels and never writes" },
  { id: "yours", title: "Your books stay with you" },
] as const;

const NUMERALS = ["I", "II", "III", "IV", "V"];

/** Small capitals in the interface face: the title page's imprint, running labels. */
const smallCaps = "text-balance font-sans text-[0.75rem] font-medium uppercase tracking-[0.14em] text-muted-foreground";

/**
 * The front page is set like the opening of a printed book: a title page,
 * a contents page, five short chapters and a colophon. Each chapter is a
 * paragraph or two; About and How it works carry the long versions.
 */
export default function FrontPage() {
  return (
    <article className="-mt-10 sm:-mt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Title page */}
      <header className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-[42.5rem] flex-col items-center px-2 text-center">
        <div className="flex flex-1 flex-col items-center justify-center py-16">
          <h1 className="font-serif text-[3.5rem] font-medium leading-none tracking-[-0.02em] sm:text-[5rem]">
            Paperless
          </h1>
          <p className="mt-5 text-balance font-serif text-[1.375rem] italic leading-snug text-muted-foreground sm:text-[1.625rem]">
            A reader for the books you already have.
          </p>
          <p className="mt-8 max-w-[30rem] text-[1.0625rem] leading-relaxed text-muted-foreground">
            Open a PDF or EPUB and read it as pages that fit your phone or desktop, with the book’s chapters, headings
            and italics kept.
          </p>
          <div className="mt-9 flex w-full max-w-xs flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="font-semibold">
              <Link href="/library">Open your library</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-semibold">
              <Link href="/library?sample">Start with Meditations</Link>
            </Button>
          </div>

          <figure className="mt-16 max-w-[26rem]">
            <div aria-hidden className="mx-auto mb-7 w-12 border-t border-foreground/25" />
            <blockquote className="font-serif text-[1.0625rem] italic leading-relaxed">
              <p>To read with diligence; not to rest satisfied with a light and superficial knowledge.</p>
            </blockquote>
            <figcaption className={`mt-3 ${smallCaps}`}>
              Marcus Aurelius, <cite className="not-italic">Meditations</cite>, Book One
            </figcaption>
          </figure>
        </div>

        {/* The foot of a title page: the publisher's device and imprint */}
        <div className="flex flex-col items-center gap-3 pb-8">
          <LogoMark className="size-7" />
          <p className={smallCaps}>Free · No account · Your books stay on your device</p>
        </div>
      </header>

      {/* Contents */}
      <nav aria-labelledby="contents" className="mx-auto max-w-[42.5rem] border-t pt-14 sm:pt-20">
        <h2 id="contents" className={`text-center ${smallCaps}`}>
          Contents
        </h2>
        <ol className="mt-8 font-serif text-[1.1875rem]">
          {CHAPTERS.map(({ id, title }, i) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="group flex min-h-11 items-baseline gap-4 rounded-md py-2.5 underline-offset-4 hover:underline"
              >
                <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">{NUMERALS[i]}</span>
                <span>{title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Prose className="mt-6">
        <Chapter index={0}>
          <p>
            Choose a PDF or EPUB on your device, paste a link to one, or find a free classic in{" "}
            <Link href="/discover">Discover</Link>, which searches Project Gutenberg and Open Library. Files can be up to
            50 MB.
          </p>
          <p>
            It needs books with real text. A scanned PDF holds only pictures of pages, and Paperless tells you so
            instead of opening an empty book.
          </p>
        </Chapter>

        <Chapter index={1}>
          <p>
            Each page is one screen of text you scroll, about 3,500 characters long. Chapters start on a new page, and
            at the bottom a large Next button names the chapter that comes next.
          </p>
          <p>
            You set the type: light, sepia or dark; serif, sans or mono; size, spacing and width. Bookmarks and search
            work across the whole book.
          </p>
        </Chapter>
      </Prose>

      <figure className="mx-auto mt-10 max-w-[18rem]">
        <Screenshot
          sizes="18rem"
          shot={{
            light: iphoneLight,
            dark: iphoneDark,
            alt: "The first page of Meditations on an iPhone: the chapter title The First Book, large serif text, and a toolbar at the bottom.",
          }}
        />
        <Caption>The first page of Meditations on an iPhone.</Caption>
      </figure>

      <Prose className="mt-6">
        <Chapter index={2}>
          <p>
            A PDF stores where each letter sits on paper. It doesn’t say which line is a chapter title or where a
            paragraph ends. Paperless reads the layout back into a book: chapters from the book’s own outline, italics
            from its fonts, drop caps joined to their word, epigraphs kept with their credit line.
          </p>
          <p>
            What was only there for paper goes. Running heads and page numbers are removed, and praise and copyright
            pages are tucked away, one tap from the contents. <Link href="/how-it-works">How a PDF becomes pages</Link>.
          </p>
        </Chapter>

        <Chapter index={3}>
          <p>
            In the background, an AI model looks at each page and answers with labels only: this line is a heading,
            that one is a quote, this number is a stray page number. It can mark up to two key passages, and they must
            be exact quotes.
          </p>
          <p>
            Paperless checks every answer and drops anything that doesn’t match the page. Each page it touched has Show
            original, and reading works fully with the AI turned off.
          </p>
        </Chapter>
      </Prose>

      <figure className="mx-auto mt-10 max-w-[18rem]">
        <Screenshot
          sizes="18rem"
          shot={{
            light: passageLight,
            dark: passageDark,
            alt: "A page of Meditations with one sentence underlined, a note under it reading Key passages marked by AI, and a Show original link.",
          }}
        />
        <Caption>A key passage, quoted exactly, with Show original under it.</Caption>
      </figure>

      <Prose className="mt-6">
        <Chapter index={4}>
          <p>
            There are no accounts. Your library, reading positions and bookmarks live in your browser, and after one
            visit it opens offline. Back up the library to a file and restore it on another device.
          </p>
          <p>
            On an iPhone, add Paperless to your Home Screen: Safari can clear a website’s storage after a few weeks
            away, and the Home Screen app keeps your books. <Link href="/privacy">Privacy</Link> has the details.
          </p>
        </Chapter>
      </Prose>

      <NextPage href="/library" label="Begin" title="Open your library" />
      <p className="mx-auto mt-4 max-w-[42.5rem] text-[0.9375rem] text-muted-foreground">
        Or{" "}
        <Link href="/library?sample" className="font-medium text-foreground underline underline-offset-4">
          start with Meditations
        </Link>
        , a free book, and a short tour will show you around.
      </p>

      {/* Colophon */}
      <section aria-labelledby="colophon" className="mx-auto mt-20 max-w-[30rem] text-center">
        <h2 id="colophon" className={smallCaps}>
          Colophon
        </h2>
        <p className="mt-4 font-serif text-[1rem] leading-relaxed text-muted-foreground">
          Set in Literata, a typeface made for reading on screens, with Inter for the interface. Made by Itamar Hanan,
          who reads a lot of books as PDFs.{" "}
          <Link href="/about" className="underline underline-offset-4 hover:text-foreground">
            Why I built it
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

function Chapter({ index, children }: { index: number; children: React.ReactNode }) {
  const { id, title } = CHAPTERS[index];
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-20 pt-12 [&>*+*]:mt-[1em]">
      <p className={smallCaps}>Chapter {NUMERALS[index]}</p>
      <h2 id={`${id}-title`} className="!mt-2">
        {title}
      </h2>
      {children}
    </section>
  );
}
