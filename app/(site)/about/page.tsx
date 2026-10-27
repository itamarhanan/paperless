import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Caption,
  NextPage,
  PageTitle,
  Prose,
  Screenshot,
} from "@/components/site/page-parts";
import { pageMetadata } from "@/lib/metadata";
import desktopLight from "@/public/screenshots/meditations-desktop-light.png";
import desktopDark from "@/public/screenshots/meditations-desktop-dark.png";
import iphoneLight from "@/public/screenshots/meditations-iphone-light.png";
import iphoneDark from "@/public/screenshots/meditations-iphone-dark.png";

const DESCRIPTION =
  "Read PDFs and EPUBs as pages sized for your screen. Paperless keeps chapters and formatting, removes page numbers and running heads, and stores your library in your browser.";

export const metadata = pageMetadata({
  title: "Paperless: read PDF and EPUB books as clean pages",
  absoluteTitle: true,
  description: DESCRIPTION,
  path: "/about",
});

export default function AboutPage() {
  return (
    <article>
      <PageTitle
        title="Read PDF and EPUB books as clean pages"
        lede="Paperless turns a PDF or EPUB into pages sized for your screen. It keeps the book’s chapters, headings, quotes and italics, and removes page numbers and running heads. Your library stays in your browser."
      />
      <div className="mx-auto mt-8 flex max-w-170 flex-wrap items-center gap-2">
        <Button asChild size="lg" className="font-semibold">
          <Link href="/library">Open Paperless</Link>
        </Button>
        <Button asChild size="lg" variant="ghost" className="font-semibold">
          <Link href="/how-it-works">
            How it works <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>

      <figure className="mx-auto mt-12 max-w-5xl sm:mt-16">
        <div className="grid items-start gap-4 sm:grid-cols-[2.865fr_1fr] sm:gap-5">
          <Screenshot
            preload
            sizes="(min-width: 1024px) 45rem, (min-width: 640px) 72vw, 100vw"
            shot={{
              light: desktopLight,
              dark: desktopDark,
              alt: "Paperless on a desktop: the contents of Meditations in a sidebar, and the first page of The First Book set in a serif typeface.",
            }}
          />
          <Screenshot
            className="mx-auto w-full max-w-[16rem] sm:max-w-none"
            sizes="(min-width: 1024px) 16rem, (min-width: 640px) 25vw, 16rem"
            shot={{
              light: iphoneLight,
              dark: iphoneDark,
              alt: "The same page of Meditations on an iPhone, with large text and a toolbar at the bottom.",
            }}
          />
        </div>
        <Caption>
          <span className="mx-auto block max-w-[42.5rem] sm:mx-0">
            Meditations by Marcus Aurelius, a free book from Project Gutenberg,
            on a desktop with the contents open and on an iPhone.
          </span>
        </Caption>
      </figure>

      <Prose className="mt-14 sm:mt-20">
        <h2>Why I built it</h2>
        <p>
          I read a lot of books as PDFs, and every PDF reader I tried either
          showed me a tiny fixed page or a wall of broken text. A PDF records
          where each letter sits on a printed page. It doesn’t record which line
          is a chapter title, which is a page number, or where a paragraph ends.
          So on a phone you either zoom and pan around a page made for paper, or
          read text that a converter has flattened into one long stream.
        </p>
        <p>
          Paperless reads that layout back into a book. You get chapters,
          paragraphs, quotes and italics, set in a typeface made for reading on
          screens, one screen of text at a time.
        </p>
        <p className="font-sans text-[0.9375rem] text-muted-foreground">
          Itamar Hanan
        </p>

        <h2>What it does</h2>
        <p>
          <strong>It finds the book’s structure.</strong> Chapters come from the
          PDF’s own outline and are matched to the headings on the page. Drop
          caps join their word again, epigraphs keep their credit line, and
          italics come back from the font names in the file.
        </p>
        <p>
          <strong>It removes what was only there for paper.</strong> Running
          heads and page numbers go. Praise, copyright and index pages are
          hidden, and one tap in the contents brings them back.
        </p>
        <p>
          <strong>Pages fit the screen.</strong> Each page is about 3,500
          characters you scroll through, and chapters start on a new page. At
          the bottom, a large Next button names the next chapter when one
          begins.
        </p>
        <p>
          <strong>EPUBs and free books work too.</strong> EPUB files are
          unzipped and read in your browser. Discover searches Open Library and
          Project Gutenberg, and Gutenberg’s books come in through their HTML
          editions, which already mark chapters, quotes and verse.
        </p>
        <p>
          <strong>You set the page.</strong> Light, sepia and dark themes;
          serif, sans or mono type; text size, line spacing, width and page
          length. There are bookmarks, search within the book, and a panel for
          asking questions about the page you’re on.
        </p>

        <h2>Who it’s for</h2>
        <p>
          Anyone with books as PDF or EPUB files who wants to read them on a
          phone without zooming, or at a desk without a fixed page floating in
          the middle of the screen. Files can be up to 50 MB.
        </p>
        <p>
          It works best on books with selectable text. A scanned PDF holds only
          pictures of pages, and Paperless tells you so rather than opening an
          empty book.
        </p>

        <h2>AI can mark the layout, not rewrite the book</h2>
        <p>
          An earlier version of Paperless asked an AI model to rewrite each page
          as clean text. A rewrite can paraphrase, or come back in a different
          language than the book’s, and the reader has no way to tell.
        </p>
        <p>
          So this version gives the AI a narrower job. It sees the paragraphs on
          a page and answers with labels only: this one is a heading, that one
          is a quote, this stray page number should be hidden. It may also point
          at up to two key passages, which must be exact quotes. Paperless
          checks every answer on the server and again in your browser, and every
          page the AI touched has a Show original link.
        </p>
        <p>
          Labels can be wrong, but they can’t put words in an author’s mouth.{" "}
          <Link href="/how-it-works#ai">How the checks work</Link>.
        </p>

        <h2>Your books stay on your device</h2>
        <p>
          There are no accounts. Your library lives in your browser, with
          reading positions, bookmarks and settings. Back up library saves all
          of it to one file you can restore here or on another device. Turn AI
          off and no text from your books leaves your device.
        </p>
        <p>
          On an iPhone, add Paperless to your Home Screen. Safari can clear a
          site’s storage after a few weeks away, and the Home Screen app keeps
          your books. <Link href="/privacy">Privacy</Link> has the details.
        </p>

        <h2>Try it</h2>
        <p>
          Open Paperless and tap Try it with Meditations to add a free book, or
          choose a PDF or EPUB of your own. It runs in the browser on phones and
          computers, and you can install it like an app.
        </p>
      </Prose>

      <NextPage href="/how-it-works" title="How a PDF becomes pages" />
    </article>
  );
}
