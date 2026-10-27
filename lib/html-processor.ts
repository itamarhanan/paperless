import {
  createSmartPages,
  findExtras,
  paginationKey,
  resolveTocPages,
  type BlockKind,
  type DocumentStructure,
  type Emphasis,
  type Heading,
  type ProcessedDocument,
  type ReaderSettings,
  type TableOfContentsItem,
} from "./pdf-processor";

/**
 * Builds a document from a book published as HTML (Project Gutenberg). The
 * markup already says what is a chapter, a quote, a poem or an italic word,
 * so nothing has to be guessed from the layout as it is for PDFs.
 */

/** Never part of the book: Gutenberg's header and licence, page numbers, pictures. */
const REMOVE = [
  "script",
  "style",
  "#pg-header",
  "#pg-footer",
  ".pg-boilerplate",
  ".pagenum",
  ".pageno",
  "img",
  "figure",
  ".figcenter",
  ".figleft",
  ".figright",
  ".caption",
  "sup",
  "a.fnanchor",
  ".fnanchor",
].join(",");

const HEADING = /^H([1-6])$/;
const PARAGRAPH = new Set(["P", "LI", "DD", "DT", "TD", "CAPTION"]);

type Block = { text: string; emphasis: Emphasis[]; heading?: number; kind?: BlockKind };

/** A paragraph's plain text, with its italic and bold runs as offsets into it. */
function readInline(element: Element, keepBreaks: boolean): { text: string; emphasis: Emphasis[] } {
  let text = "";
  const emphasis: Emphasis[] = [];

  const add = (raw: string) => {
    const collapsed = raw.replace(keepBreaks ? /[^\S\n]+/g : /\s+/g, " ");
    text += /[ \n]$/.test(text) || !text ? collapsed.replace(/^ /, "") : collapsed;
  };

  const walk = (node: Node, style: number) => {
    if (node.nodeType === Node.TEXT_NODE) {
      add(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.tagName === "BR") {
      text = text.replace(/ $/, "") + (keepBreaks ? "\n" : " ");
      return;
    }
    let next = style;
    if (/^(I|EM|CITE|VAR)$/.test(el.tagName)) next |= 1;
    if (/^(B|STRONG)$/.test(el.tagName)) next |= 2;
    const start = text.length;
    el.childNodes.forEach((child) => walk(child, next));
    if (next !== style && next) {
      // Trim the run to its words; spaces at the edges aren't emphasised
      let s = start;
      let e = text.length;
      while (s < e && /\s/.test(text[s])) s++;
      while (e > s && /\s/.test(text[e - 1])) e--;
      if (e > s) emphasis.push([s, e, (next & 3) as 1 | 2 | 3]);
    }
  };

  element.childNodes.forEach((child) => walk(child, 0));

  // Trim, and shift the runs with the text
  const lead = text.length - text.trimStart().length;
  const trimmed = text.trim().replace(/ *\n */g, "\n");
  const shifted = emphasis
    .map(([s, e, st]) => [Math.max(0, s - lead), Math.min(trimmed.length, e - lead), st] as Emphasis)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  // Nested runs (bold inside italic) can overlap; keep the outer one
  const spans: Emphasis[] = [];
  for (const span of shifted) if (!spans.length || span[0] >= spans[spans.length - 1][1]) spans.push(span);
  return { text: trimmed, emphasis: spans };
}

/** A printed contents list: every bit of text is a link to a place in the book. */
function isContentsLinks(el: Element): boolean {
  const links = el.querySelectorAll('a[href^="#"]');
  if (!links.length) return false;
  const linked = [...links].reduce((n, a) => n + (a.textContent?.trim().length ?? 0), 0);
  const total = el.textContent?.replace(/\s+/g, "").length ?? 0;
  return linked >= total * 0.6;
}

function collectBlocks(root: Element): Block[] {
  const blocks: Block[] = [];
  let titleSeen = false;

  const push = (el: Element, extra: Partial<Block> = {}, keepBreaks = false) => {
    if (isContentsLinks(el)) return;
    const { text, emphasis } = readInline(el, keepBreaks);
    if (!text || !/[\p{L}\p{N}]/u.test(text)) return;
    blocks.push({ text, emphasis, ...extra });
  };

  const walk = (el: Element, inQuote: boolean) => {
    const tag = el.tagName;
    const heading = HEADING.exec(tag);
    if (heading) {
      const level = Number(heading[1]);
      // The book's title page heading; the library already shows the title
      if (level === 1 && !titleSeen) {
        titleSeen = true;
        return;
      }
      push(el, { heading: level });
      return;
    }
    if (tag === "TABLE" && isContentsLinks(el)) return;
    const verse = /\b(poem|stanza|verse|poetry)\b/i.test(el.className);
    if (verse && !el.querySelector("p, div.stanza")) {
      push(el, { kind: "quote" }, true);
      return;
    }
    if (tag === "PRE") {
      push(el, { kind: "quote" }, true);
      return;
    }
    if (PARAGRAPH.has(tag)) {
      const lines = el.querySelectorAll("br").length > 0 && (inQuote || verse);
      push(el, inQuote ? { kind: "quote" } : {}, lines);
      return;
    }
    const quote = inQuote || tag === "BLOCKQUOTE" || /\bblockquot/i.test(el.className) || verse;
    // A container with loose text of its own reads as one paragraph
    const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
    if (ownText && !el.querySelector("p, div, h1, h2, h3, h4, h5, h6, blockquote, table, ul, ol")) {
      push(el, quote ? { kind: "quote" } : {}, quote);
      return;
    }
    for (const child of el.children) walk(child, quote);
  };

  walk(root, false);
  return blocks;
}

export function processHtmlBook(
  html: string,
  settings: ReaderSettings,
  meta: { title: string; language?: string }
): ProcessedDocument {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(REMOVE).forEach((el) => el.remove());
  // Title-page lines and an emptied contents heading come first, each a heading
  // with no text under it ("By Marcus Aurelius", "BOOKS"). They aren't chapters.
  const all = collectBlocks(doc.body);
  let start = 0;
  const nextIsHeading = (i: number) => i + 1 >= all.length || !!all[i + 1].heading;
  while (start < all.length && all[start].heading && nextIsHeading(start)) start++;
  const blocks = all.slice(start);
  if (!blocks.length) throw new Error("This book has no readable text.");

  // Heading levels by rank among the tags the book uses: h2 chapters → 1, h3 → 2…
  const tags = [...new Set(blocks.filter((b) => b.heading).map((b) => b.heading!))].sort((a, b) => a - b);
  const paragraphs: string[] = [];
  const headings: Heading[] = [];
  const emphasis: Record<number, Emphasis[]> = {};
  const kinds: Record<number, BlockKind> = {};

  for (const block of blocks) {
    const index = paragraphs.length;
    paragraphs.push(block.text);
    if (block.heading) {
      headings.push({ paragraph: index, level: Math.min(3, tags.indexOf(block.heading) + 1), title: block.text });
      continue;
    }
    if (block.kind) kinds[index] = block.kind;
    const covered = block.emphasis.reduce((n, [s, e]) => n + e - s, 0);
    // A whole quote in italics says nothing the quote styling doesn't
    if (block.emphasis.length && !(block.kind && covered >= block.text.length * 0.9)) {
      emphasis[index] = block.emphasis;
    }
  }

  const toc: TableOfContentsItem[] = headings
    .filter((h) => h.level <= 2 && h.title.length < 120)
    .slice(0, 300)
    .map((h) => ({ title: h.title.replace(/\s+/g, " "), level: h.level, page: 1, paragraph: h.paragraph }));
  const extras = findExtras(toc as (TableOfContentsItem & { paragraph: number })[], paragraphs);
  // Untitled text before the first chapter is the title page, publisher's notes
  // or an editor's preface: front matter, unless it's a large part of the book
  const firstHeading = headings[0]?.paragraph ?? 0;
  const before = paragraphs.slice(0, firstHeading).reduce((n, p) => n + p.length, 0);
  const total = paragraphs.reduce((n, p) => n + p.length, 0);
  if (firstHeading > 0 && before <= total * 0.15 && !extras.some(([s]) => s === 0)) {
    extras.unshift([0, firstHeading]);
  }
  const structure: DocumentStructure = { headings, emphasis, kinds, extras };
  const pages = createSmartPages(paragraphs, settings, structure);
  const language = meta.language ?? doc.documentElement.lang ?? undefined;

  return {
    title: meta.title,
    language: language || undefined,
    totalPages: pages.length,
    pages,
    tableOfContents: resolveTocPages(toc, pages, settings.showExtras ? undefined : extras),
    rawParagraphs: paragraphs,
    ...structure,
    paginatedWith: paginationKey(settings),
  };
}
