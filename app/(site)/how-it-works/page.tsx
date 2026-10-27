import Link from "next/link";
import { Caption, NextPage, PageTitle, Prose, Screenshot } from "@/components/site/page-parts";
import { pageMetadata } from "@/lib/metadata";
import passageLight from "@/public/screenshots/meditations-passage-light.png";
import passageDark from "@/public/screenshots/meditations-passage-dark.png";

export const metadata = pageMetadata({
  title: "How it works",
  description:
    "How Paperless turns PDFs into readable pages, keeps chapter and text formatting, and checks the labels suggested by AI.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <article>
      <PageTitle
        title="How Paperless reads a book"
        lede="A PDF stores letters, fonts and positions on printed pages. Paperless uses that information to rebuild the text as readable pages. AI can suggest paragraph labels, and Paperless checks each suggestion before using it."
      />

      <BeforeAfter />

      <Prose className="mt-14 sm:mt-20">
        <h2>From a PDF to pages</h2>
        <p>
          Paperless opens the file with pdf.js, Mozilla’s PDF library, and reads every line on every page with its
          font, size and position. Then it works through the lines in order.
        </p>

        <h3>Chapters</h3>
        <p>
          If the PDF has an outline, the list of chapters a PDF viewer shows in its sidebar, Paperless uses it and
          looks for each entry’s heading on its page or the next. A heading set over two lines, like “Part I” and
          “Perception”, keeps both. Without an outline, headings come from font sizes. The largest heading size in the
          book is a chapter, the next is a section, and anything smaller is a subsection.
        </p>

        <h3>Running heads and page numbers</h3>
        <p>
          A line is a running head when it sits in the top or bottom two lines of a page and repeats on more than 30
          percent of the pages. Numbers are masked first, so “Chapter 3 · 41” and “Chapter 3 · 42” count as the same
          line. Bare page numbers, like “41” or “Page 41 of 300”, go too. Only lines at a page’s edges qualify, so a
          chapter title that repeats inside the text stays.
        </p>

        <h3>Drop caps</h3>
        <p>
          A large capital beside the first lines of a paragraph is taken out and put back in front of its word, so “T”
          and “his” read as “This” again. That works for small caps too.
        </p>

        <h3>Italics and bold</h3>
        <p>
          A PDF rarely says which words are in italics, but its font names do: “Minion-BoldIt”, “Arial-ItalicMT”.
          Paperless reads them and puts the book’s italics and bold back, word for word.
        </p>

        <h3>Quotes and verse</h3>
        <p>
          A block quote or epigraph is indented on every line and also smaller, in italics, or inset from the right
          margin. Indentation alone isn’t enough, because some books indent ordinary lines. The credit under an
          epigraph (“—Seneca”) stays with its quote, and a poem whose lines all stop short keeps its line breaks.
        </p>

        <h3>Paragraphs</h3>
        <p>
          A paragraph that runs over a page break is joined back together. Ligatures like “ﬁ” become plain letters, a
          word split by a soft hyphen at the end of a line becomes one word, and stray icon glyphs and control
          characters are dropped.
        </p>

        <h3>Front and back matter</h3>
        <p>
          Praise, copyright, dedication and contents pages at the start, and acknowledgments, notes, bibliography and
          index at the end, are found from the book’s top-level contents and hidden. A line at the bottom of the
          contents says so, with a Show button. On this guess Paperless never hides more than a quarter of the book at
          the front, or 30 percent at the back.
        </p>

        <h3>Pages</h3>
        <p>
          Last, the text is cut into pages of about 3,500 characters, or 2,500 and 5,000 if you pick Short or Long.
          Chapters start on a new page, a heading never ends one, and a page too short to stand alone joins its
          neighbor. The Next button at the bottom of each page names the next chapter when one begins.
        </p>
        <p>
          A scanned PDF has little or no text behind its pictures. When a file averages fewer than 40 letters a page,
          Paperless says it’s a scan instead of opening an empty book.
        </p>

        <h2>EPUBs, Gutenberg and links</h2>
        <p>
          An EPUB is a zip of HTML chapters with a file that lists them in reading order. Paperless unzips it in your
          browser, joins the chapters in that order and reads them like any HTML book. Chapter titles come from the
          book’s own contents, so a chapter marked only by its styling still gets its name. EPUBs whose chapters are
          locked with DRM can’t be read.
        </p>
        <p>
          Free books from Project Gutenberg come in through their HTML editions, where the markup already says what is
          a chapter, a quote, a poem or an italic word. Nothing has to be guessed from the layout. Gutenberg’s header
          and license, page numbers and pictures are left out.
        </p>
        <p>
          A PDF or EPUB from a link is downloaded by the Paperless server, because most sites don’t let a browser fetch
          files from another site. The file goes straight to your browser and isn’t kept.
        </p>

        <h2 id="ai">What the AI may do</h2>
        <p>
          With <em>Check layout with AI</em> on, Paperless sends the page you’re reading to Google Gemini once you’ve
          stayed on it for 0.8 seconds, then the next page, one request at a time. Each paragraph goes with an id and
          the label Paperless gave it. The model answers with ids and labels. It never sends back the book’s text.
        </p>
        <ul>
          <li>
            <strong>heading</strong>, at level 1, 2 or 3, for a title that was read as text
          </li>
          <li>
            <strong>text</strong>, for a paragraph wrongly marked as a heading or a quote
          </li>
          <li>
            <strong>quote</strong>, <strong>list</strong> or <strong>caption</strong>
          </li>
          <li>
            <strong>drop</strong>, for what isn’t the book: page numbers, stray symbols, chart labels, watermarks
          </li>
          <li>
            <strong>join</strong>, for a paragraph that stops mid-sentence and goes on in the next
          </li>
        </ul>
        <p>
          It may also pick up to two key passages on the page, copied character for character, each with the id of
          its paragraph. Paperless underlines them.
        </p>

        <h2>How answers are checked</h2>
        <p>The server checks first.</p>
        <ul>
          <li>Labels for ids that weren’t sent are dropped.</li>
          <li>A paragraph longer than 160 characters can’t become a heading.</li>
          <li>
            A passage must be 20 to 400 characters long and appear word for word in its paragraph. At most two are
            kept.
          </li>
        </ul>
        <p>Then your browser checks again, against the page it has.</p>
        <ul>
          <li>Only paragraphs on this page can be labeled.</li>
          <li>A passage must still be an exact part of its paragraph, and can’t sit in a paragraph the AI hid.</li>
          <li>Headings from the book’s own contents are the author’s, and the AI can’t change them.</li>
          <li>If the AI would hide more than 35 percent of the page’s text, none of its hiding is applied.</li>
        </ul>
      </Prose>

      <figure className="mx-auto mt-10 max-w-[42.5rem]">
        <Screenshot
          className="mx-auto max-w-[18rem]"
          sizes="18rem"
          shot={{
            light: passageLight,
            dark: passageDark,
            alt: "The end of a page of Meditations on an iPhone. The last sentence is underlined as a key passage. Below the text: “Key passages marked by AI” and a Show original link, then the Next button.",
          }}
        />
        <Caption>
          <span className="block text-center">
            The end of a page with one key passage underlined. For this screenshot the AI’s answer was a fixed test
            reply.
          </span>
        </Caption>
      </figure>

      <Prose className="mt-10">
        <h2>Show original</h2>
        <p>
          Every page the AI changed says what it did, under the text: “Layout tidied by AI” or “Key passages marked by
          AI”, with a Show original link beside it. The page menu has the same switch. The original layout is always
          kept, so you can go back and forth.
        </p>

        <h2>Why labels and not rewrites</h2>
        <p>
          An earlier version asked the model to rewrite each page as clean text. It read well, but a rewrite can
          paraphrase, or come back in another language than the book’s, and nothing on the page tells you it happened.
        </p>
        <p>
          A label can be wrong too. Then a heading lands in the wrong place, and Show original puts it back in one tap.
          What a label can’t do is put words in an author’s mouth.
        </p>

        <h2>Turning it off, or using your own key</h2>
        <p>
          <em>Check layout with AI</em> and <em>Underline key passages</em> are switches in Appearance › Pages and AI.
          With AI off, no text from your books leaves your device. You can also add your own Gemini key there. It stays
          in your browser and goes only with your own AI requests.
        </p>
        <p>
          Without a key of your own, everyone shares the site’s key, with up to 90 page checks an hour per person and a
          daily cap for the whole site. See <Link href="/privacy">Privacy</Link> for what is sent where.
        </p>
      </Prose>

      <NextPage href="/privacy" title="What leaves your device" />
    </article>
  );
}

/**
 * An illustration, not a screenshot: the opening of Book Two of Meditations as
 * the lines might sit in a PDF, and the page Paperless makes from them.
 * What was removed is struck through and labeled, not shown by color alone.
 */
function BeforeAfter() {
  const note = "ml-3 font-sans text-[0.75rem] not-italic text-muted-foreground no-underline";
  return (
    <figure className="mx-auto mt-12 max-w-5xl sm:mt-16">
      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <div className="rounded-xl border p-5 sm:p-6">
          <p className="mb-4 text-[0.8125rem] font-medium text-muted-foreground">In the PDF</p>
          <div className="space-y-1 overflow-x-auto font-mono text-[0.875rem] leading-relaxed">
            <p>
              <s className="text-muted-foreground">MEDITATIONS</s>
              <span className={note}>running head, removed</span>
            </p>
            <p className="pt-3 text-[1.0625rem]">The Second Book</p>
            <p className="pt-2">
              <span className="text-[1.5rem] leading-none">R</span>
              <span className={note}>drop cap, joined to its word</span>
            </p>
            <p>emember how long thou hast already</p>
            <p>put off these things, and how often a</p>
            <p>certain day and hour as it were, having</p>
            <p>been set unto thee by the gods, thou</p>
            <p>hast neglected it.</p>
            <p className="pt-3">
              <s className="text-muted-foreground">16</s>
              <span className={note}>page number, removed</span>
            </p>
          </div>
        </div>
        <div className="rounded-xl border p-5 sm:p-6">
          <p className="mb-4 text-[0.8125rem] font-medium text-muted-foreground">In Paperless</p>
          <div className="reader-prose">
            <p className="text-[1.35em] font-semibold leading-tight tracking-[-0.01em]">The Second Book</p>
            <p>
              Remember how long thou hast already put off these things, and how often a certain day and hour as it
              were, having been set unto thee by the gods, thou hast neglected it.
            </p>
          </div>
        </div>
      </div>
      <Caption>
        An illustration with the opening of Book Two of Meditations: lines as a PDF might store them, and the page
        Paperless makes from them.
      </Caption>
    </figure>
  );
}
