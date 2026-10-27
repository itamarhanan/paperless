import { test as base, expect, type Page } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";

/**
 * Test books, made on the fly so the repo carries no copyrighted text:
 * a PDF printed by the browser itself, an EPUB zipped in memory, and a
 * Gutenberg-style HTML page.
 */

const paragraph = (n: string) =>
  `<p>Paragraph ${n}. The ﬁrst principle of good reading interfaces is that the text itself carries the experience; ` +
  `everything else should recede. Comfortable measure, generous leading and consistent rhythm matter more than ` +
  `ornament. When a document is extracted from a PDF, the reader inherits every artefact of the layout engine: ` +
  `running heads, folios and broken hyphenation. A careful pipeline removes these without changing a word.</p>`;

const chapter = (c: number) =>
  `<h1 style="font-size:28px">Chapter ${c}: On Reading</h1>` +
  `<h2 style="font-size:20px">Section ${c}.1 Measure</h2>${[1, 2, 3, 4, 5].map((i) => paragraph(`${c}.${i}`)).join("")}` +
  `<h2 style="font-size:20px">Section ${c}.2 Rhythm</h2>${[6, 7, 8, 9, 10].map((i) => paragraph(`${c}.${i}`)).join("")}`;

/** Four chapters, with a running head and page numbers to be removed. */
export async function makePdf(page: Page): Promise<Buffer> {
  await page.setContent(
    `<html lang="en"><body style="font: 11px/1.5 Georgia; width: 480px">${[1, 2, 3, 4]
      .map(chapter)
      .join('<div style="page-break-after:always"></div>')}</body></html>`
  );
  return page.pdf({
    format: "A5",
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8px;width:100%;text-align:center">The Reading Book — Draft</div>',
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center"><span class="pageNumber"></span></div>',
    margin: { top: "40px", bottom: "40px", left: "40px", right: "40px" },
  });
}

/** Three chapters; the second has no heading of its own, only an entry in the book's contents. */
export function makeEpub(): Buffer {
  const xhtml = (body: string) =>
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;
  const prose = (n: number) =>
    Array.from({ length: 6 }, (_, i) => `<p>Line ${n}.${i}: a sentence with <i>italic words</i> in it, long enough to read as prose and fill a page.</p>`).join("");
  const files = {
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(
      `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
    ),
    "OEBPS/content.opf": strToU8(
      `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>The Test Garden</dc:title><dc:language>en</dc:language></metadata>
      <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/two.xhtml" media-type="application/xhtml+xml"/><item id="c3" href="text/three.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="nav" linear="no"/><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/></spine></package>`
    ),
    "OEBPS/nav.xhtml": strToU8(
      xhtml(`<nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="text/one.xhtml">Seeds</a></li><li><a href="text/two.xhtml">Roots</a></li><li><a href="text/three.xhtml">Leaves</a></li></ol></nav>`)
    ),
    "OEBPS/text/one.xhtml": strToU8(xhtml(`<h1>Seeds</h1>${prose(1)}`)),
    "OEBPS/text/two.xhtml": strToU8(xhtml(`<p class="chapter-title">Roots</p>${prose(2)}`)),
    "OEBPS/text/three.xhtml": strToU8(xhtml(`<h1>Leaves</h1>${prose(3)}`)),
  };
  return Buffer.from(zipSync(files));
}

/** A small book in Project Gutenberg's HTML layout, licence header and all. */
export const GUTENBERG_HTML = `<!DOCTYPE html><html lang="en"><body>
<section id="pg-header"><p>The Project Gutenberg eBook of Meditations. This eBook is for the use of anyone anywhere.</p></section>
<h1>MEDITATIONS</h1><h2>By Marcus Aurelius</h2>
<h2>THE FIRST BOOK</h2>
${Array.from({ length: 5 }, (_, i) => `<p>${i + 1}. Of my grandfather Verus I have learned to be gentle and meek, and to refrain from all anger and passion. <i>Diligence</i> in all things.</p>`).join("")}
<h2>THE SECOND BOOK</h2>
<p>Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial.</p>
<section id="pg-footer"><p>End of the Project Gutenberg eBook. Licence text.</p></section>
</body></html>`;

type AiCalls = { enhance: number };

/**
 * Every test starts with an empty library, no network to outside services,
 * and an AI that answers with labels only: it marks the last plain paragraph
 * of a page as a quote and picks one key passage (plus one it must reject).
 */
export const test = base.extend<{ ai: AiCalls; tourSeen: boolean; seedTour: void }>({
  // The sample opens with the guided tour. Other tests start as returning readers;
  // the tour's own tests opt out with test.use({ tourSeen: false }).
  tourSeen: [true, { option: true }],
  seedTour: [
    async ({ page, tourSeen }, use) => {
      if (tourSeen) await page.addInitScript(() => localStorage.setItem("paperless:tour-seen", "1"));
      await use();
    },
    { auto: true },
  ],
  ai: async ({ page }, use) => {
    const calls: AiCalls = { enhance: 0 };
    await page.route("**/api/enhance", async (route) => {
      calls.enhance++;
      const { paragraphs } = route.request().postDataJSON() as { paragraphs: { id: number; text: string; kind: string }[] };
      const plain = paragraphs.filter((p) => p.kind === "text");
      const last = plain[plain.length - 1];
      const first = plain[0];
      await route.fulfill({
        json: {
          labels: last && plain.length > 1 ? [{ id: last.id, kind: "quote" }] : [],
          passages: first
            ? [
                { id: first.id, text: first.text.split(". ")[0] },
                { id: first.id, text: "A sentence the book never says." },
              ]
            : [],
        },
      });
    });
    await page.route("**/api/discover/gutenberg?id=2680", (route) =>
      route.fulfill({ body: GUTENBERG_HTML, contentType: "text/html" })
    );
    await use(calls);
  },
});

export { expect };

export const pageIndicator = (page: Page) => page.getByRole("button", { name: /^Page \d+ of \d+/ });
