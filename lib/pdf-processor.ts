import { loadPdfJs } from "./pdf-loader";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { displayTitle } from "./text";

export interface ProcessedPage {
  pageNumber: number;
  content: string;
  markdownContent: string;
  enhancedContent: string;
  hasPageBreak: boolean;
  isEnhanced?: boolean;
  enhancedAt?: string;
  /** Index into rawParagraphs of this page's first paragraph. */
  startParagraph?: number;
  /** Indices into rawParagraphs of the paragraphs on this page. */
  indices?: number[];
}

/** How the AI says a paragraph should be shown. Labels never carry text. */
export type AiKind = "heading" | "text" | "quote" | "list" | "caption" | "drop";

export interface AiLabel {
  kind: AiKind;
  /** For headings: 1 chapter, 2 section, 3 subsection. */
  level?: number;
  /** The paragraph was split mid-sentence: join it with the next one. */
  joinNext?: boolean;
}

export interface DocumentAi {
  /** Paragraphs whose layout the AI corrected, by paragraph index. */
  labels: Record<number, AiLabel>;
  /** Key passages, each an exact substring of its paragraph, by paragraph index. */
  passages: Record<number, string[]>;
  /** Paragraphs the AI has looked at. */
  checked: Record<number, 1>;
}

export interface Heading {
  paragraph: number;
  level: number;
  title: string;
}

/** Italic (1), bold (2) or both (3) over [start, end) of a paragraph's plain text. */
export type Emphasis = [start: number, end: number, style: 1 | 2 | 3];

export type BlockKind = "quote" | "attribution";

export interface ProcessedDocument {
  title: string;
  /** BCP 47 language tag from the PDF, when it declares one. */
  language?: string;
  totalPages: number;
  pages: ProcessedPage[];
  tableOfContents: TableOfContentsItem[];
  rawParagraphs: string[];
  /** Headings, from the PDF outline when it has one, otherwise from font sizes. */
  headings?: Heading[];
  /** The book's own italics and bold, by paragraph index. */
  emphasis?: Record<number, Emphasis[]>;
  /** Paragraphs set apart from the text, by paragraph index. */
  kinds?: Record<number, BlockKind>;
  /** Paragraph ranges [start, end) of front and back matter: praise, copyright, index… */
  extras?: [number, number][];
  /** Layout corrections and key passages from the AI, by paragraph. */
  ai?: DocumentAi;
  /** Rewritten pages from older versions; no longer used. */
  cleanupCache?: Record<string, string>;
  /** paginationKey() of the settings the pages were built with. */
  paginatedWith?: string;
}

/** The parts of a document that pagination and markdown are built from. */
export type DocumentStructure = Pick<ProcessedDocument, "headings" | "emphasis" | "kinds" | "extras">;

export interface TableOfContentsItem {
  title: string;
  page: number;
  level: number;
  /** Index into rawParagraphs; page is derived from it after pagination. */
  paragraph?: number;
  /** In front or back matter that's currently hidden. */
  hidden?: boolean;
}

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: "serif" | "sans" | "mono";
  /** Kept for older saved settings; appearance is handled by next-themes. */
  theme: "light" | "dark" | "sepia";
  maxWidth: number;
  textAlign: "left" | "justify";
  charsPerPage: number;
  enableSmartBreaks: boolean;
  proseMode: boolean;
  /** Clean up each page's text with AI as you read. */
  autoCleanup: boolean;
  /** Include front and back matter (praise, copyright, index…) in the pages. */
  showExtras: boolean;
  /** Underline the passages the AI picked as most important. */
  keyPassages: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 19,
  lineHeight: 1.6,
  fontFamily: "serif",
  theme: "light",
  maxWidth: 680,
  textAlign: "left",
  charsPerPage: 3500,
  enableSmartBreaks: true,
  proseMode: true,
  autoCleanup: true,
  showExtras: false,
  keyPassages: true,
};

export const PAGE_LENGTHS = { short: 2500, medium: 3500, long: 5000 } as const;

export function withDefaults(settings: Partial<ReaderSettings> | null | undefined): ReaderSettings {
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}

/** Identifies the settings that affect page boundaries. */
export function paginationKey(
  settings: Pick<ReaderSettings, "charsPerPage" | "enableSmartBreaks" | "showExtras">
) {
  return `v4:${settings.charsPerPage}:${settings.enableSmartBreaks ? 1 : 0}:${settings.showExtras ? 1 : 0}`;
}

export type ProgressCallback = (fraction: number) => void;

// ========== TEXT NORMALIZATION ==========

/**
 * Deterministic cleanup applied to every extracted line: folds ligatures and
 * full-width forms (NFKC), drops private-use glyphs (icon fonts, broken
 * symbol mappings), control characters and soft hyphens.
 */
export function normalizeLine(text: string): string {
  return text
    .normalize("NFKC")
    // A soft or Unicode hyphen ending the line marks a word broken across lines
    .replace(/[\u00AD\u2010\u2011]\s*$/, "-")
    .replace(/[\uE000-\uF8FF\u00AD\uFFFD\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/(\p{L}) ([.,;:!?])(?=\s|$)/gu, "$1$2") // space left where a glyph was removed
    .trim();
}

function letterRatio(text: string): number {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  return letters / Math.max(1, text.replace(/\s/g, "").length);
}

/** Short paragraphs made mostly of symbols are chart labels, dot leaders or garbage. */
function isGarbage(text: string): boolean {
  if (text.length > 200) return false;
  return letterRatio(text) < 0.45;
}

function shouldSkipParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.length >= 150) return false;
  return [
    /^©.*copyright/i,
    /^all rights reserved/i,
    /^printed in/i,
    /^isbn:?\s*[\d-]+$/i,
    /^(page\s*)?\d+(\s*of\s*\d+)?$/i,
  ].some((pattern) => pattern.test(normalized));
}

function isCopyrightPage(content: string): boolean {
  const indicators = [
    "copyright",
    "all rights reserved",
    "published by",
    "isbn",
    "library of congress",
    "printed in",
  ];
  const lower = content.toLowerCase();
  const matches = indicators.filter((i) => lower.includes(i)).length;
  return matches >= 3 && content.length < 1000;
}

export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ":" + text.length;
}

// ========== SMART PAGINATION ==========

const MIN_WORDS_PER_PAGE = 30;

/**
 * Heading levels that start a new page. Top-level headings always do; a deeper
 * level does too when its sections are long enough to fill pages of their own
 * (chapters inside parts), but not when they're short (sections of a chapter).
 */
function breakingLevels(paragraphs: string[], headings: Heading[], target: number): Set<number> {
  const levels = new Set<number>();
  if (!headings.length) return levels;
  const top = Math.min(...headings.map((h) => h.level));
  levels.add(top);

  const offset: number[] = [];
  let total = 0;
  for (const p of paragraphs) {
    offset.push(total);
    total += p.length;
  }
  for (let level = top + 1; level <= 3; level++) {
    const starts = headings.filter((h) => h.level <= level).map((h) => offset[h.paragraph] ?? 0);
    if (starts.length < 2) continue;
    const average = (total - starts[0]) / starts.length;
    if (average >= target * 1.5) levels.add(level);
  }
  return levels;
}

export function isInRanges(index: number, ranges: [number, number][] | undefined) {
  return !!ranges?.some(([start, end]) => index >= start && index < end);
}

export function createSmartPages(
  paragraphs: string[],
  settings: ReaderSettings,
  structure: DocumentStructure = {}
): ProcessedPage[] {
  const target = settings.charsPerPage;
  const minChars = Math.floor(target * 0.8);
  const maxChars = Math.floor(target * 1.4);
  const headings = structure.headings ?? [];
  const headingAt = new Map(headings.map((h) => [h.paragraph, h.level]));
  const breaks = breakingLevels(paragraphs, headings, target);
  const startsChapter = (i: number) => settings.enableSmartBreaks && breaks.has(headingAt.get(i) ?? 0);
  const hidden = settings.showExtras ? undefined : structure.extras;

  const groups: { start: number; indices: number[] }[] = [];
  let current: number[] = [];
  let length = 0;
  let hasText = false;

  const flush = () => {
    // A heading never ends a page: it moves to the top of the next one
    const carry: number[] = [];
    while (current.length > 1 && headingAt.has(current[current.length - 1])) carry.unshift(current.pop()!);
    if (current.length) groups.push({ start: current[0], indices: current });
    current = carry;
    length = carry.reduce((n, i) => n + paragraphs[i].length + 2, 0);
    hasText = false;
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (isInRanges(i, hidden) || shouldSkipParagraph(para)) continue;

    // Chapters start on a new page, once the current page has text of its own
    if (startsChapter(i) && hasText) flush();

    if (length > 0 && length + para.length + 2 > maxChars) flush();

    current.push(i);
    length += para.length + 2;
    if (!headingAt.has(i)) hasText = true;

    if (length < minChars) continue;

    const next = paragraphs[i + 1];
    const nextWouldExceed = next !== undefined && length + next.length + 2 > maxChars;

    if (settings.enableSmartBreaks) {
      const endsSentence = /[.!?:]["'”’)\]]?\s*$/.test(para);
      const beforeHeading = headingAt.has(i + 1);
      if ((endsSentence || beforeHeading) && (length >= target || nextWouldExceed)) flush();
    } else if (length >= target) {
      flush();
    }
  }
  flush();
  if (current.length) groups.push({ start: current[0], indices: current });

  // Merge pages that are too short to stand alone into their neighbour,
  // unless they open a chapter. A chapter's short last page joins the page
  // before it when the two fit on one.
  const chars = (group: (typeof groups)[number]) => group.indices.reduce((n, i) => n + paragraphs[i].length + 2, 0);
  const merged: typeof groups = [];
  groups.forEach((group, g) => {
    const words = group.indices.reduce((n, i) => n + paragraphs[i].split(/\s+/).length, 0);
    const prev = merged[merged.length - 1];
    const next = groups[g + 1];
    const chapterTail =
      prev && (!next || startsChapter(next.start)) && chars(group) < target * 0.35 && chars(prev) + chars(group) <= maxChars;
    if (prev && (words <= MIN_WORDS_PER_PAGE || chapterTail) && !startsChapter(group.start)) {
      prev.indices.push(...group.indices);
    } else {
      merged.push({ start: group.start, indices: [...group.indices] });
    }
  });
  if (merged.length > 1) {
    const first = merged[0];
    const words = first.indices.reduce((n, i) => n + paragraphs[i].split(/\s+/).length, 0);
    if (words <= MIN_WORDS_PER_PAGE) {
      merged[1] = { start: first.start, indices: [...first.indices, ...merged[1].indices] };
      merged.shift();
    }
  }

  return merged.map((group, index) => {
    const paras = group.indices.map((i) => paragraphs[i]);
    return {
      pageNumber: index + 1,
      content: paras.join("\n\n"),
      markdownContent: paragraphsToMarkdown(group.indices, paragraphs, headingAt, structure),
      enhancedContent: "",
      hasPageBreak: true,
      startParagraph: group.start,
      indices: group.indices,
    };
  });
}

/**
 * Renders paragraphs as markdown. With AI labels, those override the detected
 * layout; the words always come from the paragraphs themselves.
 */
function paragraphsToMarkdown(
  indices: number[],
  paragraphs: string[],
  headingAt: Map<number, number>,
  structure: DocumentStructure,
  labels?: Record<number, AiLabel>
): string {
  const out: string[] = [];
  const kinds = structure.kinds ?? {};
  const inline = (i: number) => renderInline(paragraphs[i].trim(), structure.emphasis?.[i]);
  const levelOf = (i: number) => {
    const label = labels?.[i];
    return label ? (label.kind === "heading" ? (label.level ?? 2) : undefined) : headingAt.get(i);
  };
  const kindOf = (i: number): BlockKind | undefined => {
    const label = labels?.[i];
    return label ? (label.kind === "quote" ? "quote" : undefined) : kinds[i];
  };

  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    const para = paragraphs[i].trim();
    if (!para || labels?.[i]?.kind === "drop") continue;
    const level = levelOf(i);
    const kind = kindOf(i);

    if (level) {
      out.push(`${"#".repeat(Math.min(4, level + 1))} ${renderInline(displayTitle(para))}`);
    } else if (kind === "quote" || kind === "attribution") {
      // Consecutive quotes, and the credit line under them, form one block
      const block = [inline(i)];
      while (k + 1 < indices.length && !levelOf(indices[k + 1]) && kindOf(indices[k + 1])) {
        block.push(inline(indices[++k]));
      }
      out.push(block.map((line) => `> ${line.replace(/\n/g, "\\\n> ")}`).join("\n>\n"));
    } else if (labels?.[i]?.kind === "list") {
      out.push(`- ${inline(i).replace(/^(\\?[•▪◦‣\-*]|\d+[.)])\s*/, "")}`);
    } else if (labels?.[i]?.kind === "caption") {
      out.push(`*${escapeInline(para)}*`);
    } else if (labels?.[i]?.joinNext) {
      // Put back together a paragraph the extraction split mid-sentence
      let text = inline(i);
      let j = i;
      while (labels?.[j]?.joinNext && k + 1 < indices.length) {
        const next = indices[k + 1];
        if (levelOf(next) || kindOf(next) || labels?.[next]?.kind === "drop") break;
        k++;
        const nextText = inline(next);
        text = /\p{L}-$/u.test(text) && /^\p{Ll}/u.test(nextText) ? text.slice(0, -1) + nextText : `${text} ${nextText}`;
        j = next;
      }
      out.push(escapeBlockStart(text));
    } else if (/^\d+[.)]\s+/.test(para)) {
      out.push(inline(i).replace(/^(\d+)[.)]/, "$1."));
    } else if (/^[•▪◦‣\-*]\s+/.test(para)) {
      out.push(inline(i).replace(/^[•▪◦‣\-*]/, "-"));
    } else {
      out.push(escapeBlockStart(inline(i)));
    }
    out.push("");
  }
  return out.join("\n").trim();
}

/** Stops stray PDF characters from being read as markdown syntax. */
function escapeInline(text: string): string {
  return text.replace(/([\\*_`[\]<])/g, "\\$1");
}

function escapeBlockStart(text: string): string {
  return text.replace(/^(\d+)([.)])(?=\s)/, "$1\\$2").replace(/^(#{1,6}|>|[-+])(?=\s)/, "\\$1");
}

/** Plain text with the book's own italics and bold put back as markdown. */
function renderInline(text: string, spans: Emphasis[] = []): string {
  let out = "";
  let pos = 0;
  for (const [start, end, style] of spans) {
    if (start < pos || end > text.length) continue;
    const marker = style === 1 ? "*" : style === 2 ? "**" : "***";
    out += escapeInline(text.slice(pos, start)) + marker + escapeInline(text.slice(start, end)) + marker;
    pos = end;
  }
  return out + escapeInline(text.slice(pos));
}

/** Assigns smart page numbers to TOC entries from their paragraph index. */
export function resolveTocPages(
  toc: TableOfContentsItem[],
  pages: ProcessedPage[],
  hidden?: [number, number][]
): TableOfContentsItem[] {
  if (!pages.length) return toc;
  return toc.map(({ hidden: _, ...item }) => {
    if (item.paragraph === undefined) return item;
    let page = 1;
    for (const p of pages) {
      if ((p.startParagraph ?? 0) <= item.paragraph) page = p.pageNumber;
      else break;
    }
    return isInRanges(item.paragraph, hidden) ? { ...item, page, hidden: true } : { ...item, page };
  });
}

// ========== PDF EXTRACTION ==========

/** A run of italic (1), bold (2) or bold italic (3) text within a line. */
type Mark = { text: string; style: 1 | 2 | 3 };

type Line = {
  text: string;
  y: number;
  height: number;
  x: number;
  right: number;
  marks: Mark[];
  /** Share of the line's characters set in italics. */
  italic: number;
  /** The line starts with a drop cap that was put back in front of it. */
  dropCap: boolean;
  /** Set off from the line above by extra space (or first on its page). */
  spaced?: boolean;
};

type TextItem = { text: string; x: number; y: number; width: number; height: number; style: number };

const LINE_Y_TOLERANCE = 2;
const WORD_GAP_TOLERANCE = 1.5;

const ITALIC_FONT = /italic|oblique|(?:[-_,]|bold|semibold)it(?![a-z])/i;
const BOLD_FONT = /bold|black|heavy|semibold|demi(?![a-z]*light)/i;

/** Font names carry the style ("Arial-ItalicMT", "Minion-BoldIt"); pdf.js knows them once fonts load. */
function fontStyle(page: PDFPageProxy, fontName: string, cache: Map<string, number>): number {
  const known = cache.get(fontName);
  if (known !== undefined) return known;
  try {
    const font = page.commonObjs.get(fontName);
    const name = String(font?.name ?? "");
    const style = (font?.italic || ITALIC_FONT.test(name) ? 1 : 0) | (font?.bold || font?.black || BOLD_FONT.test(name) ? 2 : 0);
    cache.set(fontName, style);
    return style;
  } catch {
    return 0; // Font not loaded: treat as regular
  }
}

async function readLines(page: PDFPageProxy, fontCache: Map<string, number>): Promise<Line[]> {
  try {
    await page.getOperatorList(); // loads the page's fonts, so their names are known
  } catch {
    // Styles are a nicety; the text is still readable without them
  }
  const textContent = await page.getTextContent();
  const items: TextItem[] = [];
  for (const item of textContent.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const [, , , height, x, y] = item.transform;
    items.push({
      text: item.str,
      x,
      y,
      width: item.width || 0,
      height: Math.abs(height),
      style: fontStyle(page, item.fontName, fontCache),
    });
  }

  // Drop caps: a single large capital beside the first lines of a paragraph.
  // Taken out here and put back in front of the line it belongs to.
  const typical = median(items.map((i) => i.height)) || 10;
  const caps = items.filter((i) => /^["“‘']?\p{Lu}$/u.test(i.text.trim()) && i.height >= typical * 1.8);

  const rows: { y: number; items: TextItem[]; cap?: TextItem }[] = [];
  for (const item of items) {
    if (caps.includes(item)) continue;
    const row = rows.find((r) => Math.abs(r.y - item.y) < LINE_Y_TOLERANCE);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  for (const cap of caps) {
    let target: (typeof rows)[number] | null = null;
    for (const row of rows) {
      const inReach = row.y > cap.y - 3 && row.y <= cap.y + cap.height;
      if (inReach && Math.min(...row.items.map((i) => i.x)) > cap.x && (!target || row.y > target.y)) target = row;
    }
    const first = target ? [...target.items].sort((a, b) => a.x - b.x)[0].text.trim() : "";
    // "T" + "his" or "T" + "HIS" (small caps); not "A" + "Aaron" in an index
    if (target && !target.cap && /^(\p{Ll}|\p{Lu}{2})/u.test(first)) target.cap = cap;
    else rows.push({ y: cap.y, items: [cap] });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      let text = row.cap ? row.cap.text.trim() : "";
      let lastRight: number | null = null;
      let italicChars = 0;
      const marks: Mark[] = [];
      for (const item of sorted) {
        if (lastRight !== null && item.x - lastRight > WORD_GAP_TOLERANCE && !text.endsWith(" ")) {
          text += " ";
        }
        text += item.text;
        lastRight = item.x + item.width;
        if (item.style & 1) italicChars += item.text.trim().length;
        if (item.style) {
          const markText = normalizeLine(item.text);
          if (markText) marks.push({ text: markText, style: item.style as Mark["style"] });
        }
      }
      const normalized = normalizeLine(text);
      return {
        text: normalized,
        y: row.y,
        height: Math.max(...sorted.map((i) => i.height)),
        x: sorted[0].x,
        right: lastRight ?? sorted[0].x,
        marks,
        italic: italicChars / Math.max(1, normalized.replace(/\s/g, "").length),
        dropCap: !!row.cap,
      };
    })
    .filter((line) => line.text.length > 1);
}

/**
 * Finds each styled run in the paragraph's final text, in order. Runs broken
 * across lines ("obsta-" + "cles", or two items in a row) are joined.
 */
function locateEmphasis(text: string, marks: Mark[]): Emphasis[] {
  const spans: Emphasis[] = [];
  let cursor = 0;
  for (const mark of marks) {
    const needle = mark.text.replace(/-$/, "").trim();
    if (needle.length < 2) continue;
    const at = text.indexOf(needle, cursor);
    if (at < 0) continue;
    spans.push([at, at + needle.length, mark.style]);
    cursor = at + needle.length;
  }
  const merged: Emphasis[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && last[2] === span[2] && /^[\s-]*$/.test(text.slice(last[1], span[0]))) last[1] = span[1];
    else merged.push([...span]);
  }
  return merged;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

type OutlineItem = NonNullable<Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>>[number];

async function readOutline(pdf: PDFDocumentProxy): Promise<{ title: string; level: number; pageIndex: number }[]> {
  try {
    const outline = await pdf.getOutline();
    if (!outline?.length) return [];
    const result: { title: string; level: number; pageIndex: number }[] = [];

    const walk = async (items: OutlineItem[], level: number) => {
      for (const item of items) {
        if (result.length >= 200) return;
        try {
          const dest = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
          if (Array.isArray(dest) && dest[0]) {
            const pageIndex =
              typeof dest[0] === "number" ? dest[0] : await pdf.getPageIndex(dest[0]);
            const title = normalizeLine(item.title ?? "");
            if (title) result.push({ title, level, pageIndex });
          }
        } catch {
          // Unresolvable destination: skip the entry
        }
        if (level < 2 && item.items?.length) await walk(item.items, level + 1);
      }
    };

    await walk(outline, 1);
    return result;
  } catch {
    return [];
  }
}

function titleFromMetadata(info: { Title?: unknown } | undefined): string | null {
  const raw = typeof info?.Title === "string" ? normalizeLine(info.Title) : "";
  if (raw.length < 3) return null;
  if (/^(untitled|microsoft word|document\d*|about:|https?:\/\/|file:)/i.test(raw)) return null;
  if (/^[\w-]+\.\w{2,4}$/.test(raw)) return null; // a bare file name
  if (/\.(docx?|pdf|indd|tex|qxd)$/i.test(raw)) return null;
  return raw;
}

export function titleFromFilename(name: string): string {
  return name
    .replace(/\.(pdf|epub)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Untitled";
}

async function extractAndCleanPdfText(
  arrayBuffer: ArrayBuffer,
  settings: ReaderSettings,
  options: { fallbackTitle?: string; onProgress?: ProgressCallback } = {}
): Promise<ProcessedDocument> {
  const pdfjsLib = await loadPdfJs();
  const loading = pdfjsLib.getDocument({ data: arrayBuffer, fontExtraProperties: true });
  const pdf = await loading.promise;
  const { onProgress } = options;

  // Pass 1: read every page's lines
  const pageLines: Line[][] = [];
  const fontCache = new Map<string, number>();
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    pageLines.push(await readLines(page, fontCache));
    page.cleanup?.();
    onProgress?.((n / pdf.numPages) * 0.9);
  }

  // A scan is pictures of pages: little or no text layer behind them
  const letters = pageLines.reduce((n, lines) => n + lines.reduce((m, l) => m + l.text.length, 0), 0);
  if (letters < pdf.numPages * 40) {
    void loading.destroy();
    throw new Error(
      "This PDF is scanned pages without text, so there’s nothing to read here yet. Try a version with selectable text."
    );
  }

  // Running headers and footers: lines at a page's top or bottom edge that repeat
  // across many pages. Digits are masked so "Chapter 3 · 41" and "· 42" count as one.
  // Only edge lines qualify, so repeated headings inside the text ("Chapter 1",
  // "Chapter 2"…) are never mistaken for page furniture.
  const EDGE_LINES = 2;
  const mask = (t: string) => t.replace(/\d+/g, "#").toLowerCase();
  const edges = (lines: Line[]) =>
    lines.length <= EDGE_LINES * 2 ? lines : [...lines.slice(0, EDGE_LINES), ...lines.slice(-EDGE_LINES)];
  const frequency = new Map<string, number>();
  for (const lines of pageLines) {
    for (const key of new Set(edges(lines).map((l) => mask(l.text)))) {
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
    }
  }
  const isRunningLine = (line: Line, lines: Line[]) => {
    if (!edges(lines).includes(line)) return false;
    if (line.height > bodySize * 1.15) return false; // running heads are small; this is a heading
    if (/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(line.text)) return true; // bare folio
    return (
      pdf.numPages >= 4 &&
      line.text.length < 100 &&
      (frequency.get(mask(line.text)) ?? 0) / pdf.numPages > 0.3
    );
  };

  const bodySize = median(pageLines.flat().map((l) => l.height)) || 10;

  // Heading levels follow the document's own size ranking: its largest heading
  // size is level 1, the next is level 2, anything smaller level 3.
  const looksLikeHeading = (l: Line) =>
    l.text.length < 120 &&
    !/[.,;]$/.test(l.text) &&
    !/^[—―–]/.test(l.text) && // a quote's credit line
    letterRatio(l.text) > 0.6 &&
    l.height >= bodySize * 1.2;
  const headingSizes = [
    ...new Set(pageLines.flat().filter(looksLikeHeading).map((l) => Math.round(l.height * 2) / 2)),
  ].sort((a, b) => b - a);
  const headingLevel = (l: Line) =>
    looksLikeHeading(l) ? Math.min(3, headingSizes.indexOf(Math.round(l.height * 2) / 2) + 1) : 0;

  // Pass 2: merge lines into paragraphs, tracking headings and where each PDF page starts
  const paragraphs: string[] = [];
  const marksOf: Mark[][] = [];
  const kinds: Record<number, BlockKind> = {};
  const fontHeadings: Heading[] = [];
  const pageStart: number[] = [];
  const indent = bodySize * 0.8;

  for (const lines of pageLines) {
    pageStart.push(paragraphs.length);
    const kept = lines.filter((l) => !isRunningLine(l, lines));
    if (isCopyrightPage(kept.map((l) => l.text).join(" "))) continue;

    const typicalRight = median(kept.map((l) => l.right));
    const typicalLeft = median(kept.map((l) => l.x));
    let buffer = "";
    let bufferMarks: Mark[] = [];
    let bufferLines: Line[] = [];
    let bufferIsHeading = 0;
    let prev: Line | null = null;
    let firstOfPage = true;

    // Set apart from the text: indented on every line, and smaller, in italics,
    // or inset from the right margin too. Indentation alone isn't enough: some
    // layouts indent ordinary lines.
    const looksLikeQuote = (ls: Line[]) => {
      if (!ls.length || ls.some((l) => l.dropCap)) return false;
      if (!ls.every((l) => l.x >= typicalLeft + indent)) return false;
      const smaller = ls.every((l) => l.height <= bodySize * 0.9);
      const italic = ls.every((l) => l.italic >= 0.9);
      const inset = ls.length >= 2 && ls.slice(0, -1).every((l) => l.right <= typicalRight - indent);
      // One italic line at the paragraph indent is a quote only when set off by space
      // or right under another quote; otherwise it's an italic sentence
      if (ls.length === 1 && !smaller) return italic && (!!ls[0].spaced || kinds[paragraphs.length - 1] === "quote");
      return smaller || italic || inset;
    };

    const flush = () => {
      // Verse and stacked lists: a quote whose lines all stop short keeps its line breaks
      const verse =
        !bufferIsHeading &&
        bufferLines.length >= 2 &&
        looksLikeQuote(bufferLines) &&
        bufferLines.slice(0, -1).every((l) => l.right <= typicalRight - indent);
      const text = verse ? bufferLines.map((l) => l.text).join("\n") : buffer.trim();
      const index = paragraphs.length;
      const last = paragraphs[index - 1];
      const lastIsHeading = fontHeadings.at(-1)?.paragraph === index - 1;
      // A paragraph that runs over the page break continues here: join it back
      const continues =
        firstOfPage && last && !lastIsHeading && !bufferIsHeading && !kinds[index - 1] &&
        !/[.!?:"”’)]$/.test(last) && /^\p{Ll}/u.test(text);
      if (text && continues) {
        paragraphs[index - 1] = /\p{L}-$/u.test(last) ? last.slice(0, -1) + text : `${last} ${text}`;
        marksOf[index - 1].push(...bufferMarks);
      } else if (text && !isGarbage(text)) {
        if (bufferIsHeading) {
          fontHeadings.push({ paragraph: index, level: bufferIsHeading, title: text });
        } else if (isAttribution(text, kinds[index - 1] === "quote")) {
          kinds[index] = "attribution";
          // The quote it credits, when that wasn't recognised by its layout
          if (last && !lastIsHeading && !kinds[index - 1] && last.length < 600) kinds[index - 1] = "quote";
        } else if (looksLikeQuote(bufferLines)) {
          kinds[index] = "quote";
        }
        paragraphs.push(text);
        marksOf.push(bufferMarks);
      }
      if (text) firstOfPage = false;
      buffer = "";
      bufferMarks = [];
      bufferLines = [];
      bufferIsHeading = 0;
    };

    for (const line of kept) {
      const level = headingLevel(line);
      line.spaced = !prev || prev.y - line.y > Math.max(prev.height, line.height) * 1.75;

      if (prev && buffer) {
        const bigGap = !!line.spaced;
        const prevEndedShort =
          /[.!?:"”’)]$/.test(prev.text) && prev.right < typicalRight - bodySize * 2;
        const listStart = /^([•▪◦‣\-*]|\d+[.)])\s/.test(line.text);
        const headingChange = level !== bufferIsHeading;
        const sizeChange = Math.abs(line.height - prev.height) > Math.max(line.height, prev.height) * 0.2;
        // First-line indent: a new paragraph in most books
        const indentStart =
          !bufferIsHeading && line.x > prev.x + indent && Math.abs(prev.x - typicalLeft) < bodySize * 0.5;
        // Back to the margin after a block quote
        const quoteEnd = line.x < typicalLeft + bodySize * 0.5 && looksLikeQuote(bufferLines);

        if (bigGap || prevEndedShort || listStart || headingChange || sizeChange || indentStart || quoteEnd) {
          flush();
        }
      }

      if (!buffer) {
        buffer = line.text;
        bufferIsHeading = level;
      } else if (/\p{L}-$/u.test(buffer) && /^\p{Ll}/u.test(line.text)) {
        buffer = buffer.slice(0, -1) + line.text; // dehyphenate across lines
      } else {
        buffer += " " + line.text;
      }
      bufferMarks.push(...line.marks);
      bufferLines.push(line);
      prev = line;
    }
    flush();
  }

  // Table of contents: the PDF's own outline when it has one, otherwise detected headings
  const paragraphForPage = (pageIndex: number) =>
    pageStart[Math.min(Math.max(pageIndex, 0), pageStart.length - 1)] ?? 0;
  const outline = await readOutline(pdf);
  let headings = fontHeadings;
  let toc: TableOfContentsItem[];

  if (outline.length) {
    // The outline is the author's structure: find each entry's heading on its page
    const anchored = new Map<number, number>();
    toc = outline.map((entry) => {
      const paragraph = anchorOutlineEntry(entry, paragraphs, pageStart, anchored);
      return { title: entry.title, level: entry.level, page: 1, paragraph: paragraph ?? paragraphForPage(entry.pageIndex) };
    });
    // Size-detected headings the outline doesn't list become subheadings
    const deepest = Math.max(...outline.map((o) => o.level));
    for (const h of fontHeadings) {
      if (!anchored.has(h.paragraph)) anchored.set(h.paragraph, Math.min(3, deepest + 1));
    }
    headings = [...anchored]
      .sort((a, b) => a[0] - b[0])
      .map(([paragraph, level]) => ({ paragraph, level, title: paragraphs[paragraph] }));
  } else {
    toc = fontHeadings
      .filter((h) => h.title.length > 2 && h.title.length < 100)
      .slice(0, 200)
      .map((h) => ({ title: h.title, level: h.level, page: 1, paragraph: h.paragraph }));
  }

  // The book's own italics and bold. A heading's, or a block quote's, whole-paragraph
  // style says nothing the layout doesn't already.
  const headingSet = new Set(headings.map((h) => h.paragraph));
  const emphasis: Record<number, Emphasis[]> = {};
  marksOf.forEach((marks, i) => {
    if (!marks.length || headingSet.has(i)) return;
    const spans = locateEmphasis(paragraphs[i], marks);
    const covered = spans.reduce((n, [start, end]) => n + end - start, 0);
    if (kinds[i] && covered >= paragraphs[i].length * 0.9) return;
    if (spans.length) emphasis[i] = spans;
  });

  const extras = findExtras(
    toc.filter((t) => t.paragraph !== undefined) as (TableOfContentsItem & { paragraph: number })[],
    paragraphs
  );
  const structure: DocumentStructure = { headings, emphasis, kinds, extras };
  const pages = createSmartPages(paragraphs, settings, structure);

  let title = options.fallbackTitle ?? "Untitled";
  let language: string | undefined;
  try {
    const meta = await pdf.getMetadata();
    const info = meta?.info as { Title?: unknown; Language?: unknown } | undefined;
    title = titleFromMetadata(info) ?? title;
    const lang = String(info?.Language ?? "").trim();
    if (/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(lang)) language = lang;
  } catch {
    // Metadata is optional
  }

  onProgress?.(1);
  void loading.destroy(); // frees the worker's copy of the file

  return {
    title,
    language,
    totalPages: pages.length,
    pages,
    tableOfContents: resolveTocPages(toc, pages, settings.showExtras ? undefined : extras),
    rawParagraphs: paragraphs,
    ...structure,
    cleanupCache: {},
    paginatedWith: paginationKey(settings),
  };
}

/** "—SENECA", "— Robert Greene, author of…": the credit under a quote. */
function isAttribution(text: string, afterQuote: boolean): boolean {
  if (!/^[—―–]\s*\S/.test(text) || text.length > 150) return false;
  return afterQuote || /^[—―–]\s*\p{Lu}[\p{Lu}\s.'’-]{2,}(,|$)/u.test(text);
}

const normalizeTitle = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Finds the paragraph that is an outline entry's heading, on its page or the
 * next. Headings set over two lines ("PART I" / "Perception") are both marked.
 */
function anchorOutlineEntry(
  entry: { title: string; level: number; pageIndex: number },
  paragraphs: string[],
  pageStart: number[],
  anchored: Map<number, number>
): number | null {
  const title = normalizeTitle(entry.title);
  if (!title) return null;
  const from = pageStart[entry.pageIndex] ?? paragraphs.length;
  const to = pageStart[entry.pageIndex + 2] ?? paragraphs.length;

  const isPart = (i: number) => {
    const text = normalizeTitle(paragraphs[i]);
    return paragraphs[i].length < 100 && (text === title || (text.length >= 3 && title.includes(text)));
  };

  for (let i = from; i < to; i++) {
    if (anchored.has(i)) continue;
    const text = normalizeTitle(paragraphs[i]);
    const isHeading = isPart(i) || (text.startsWith(title) && text.length <= title.length + 3);
    if (!isHeading) continue;
    anchored.set(i, entry.level);
    for (let j = i + 1; j < to && isPart(j) && !anchored.has(j); j++) anchored.set(j, entry.level);
    return i;
  }
  return null;
}

const FRONT_MATTER =
  /^(advance praise|praise|title page|half title|copyright|(table of )?contents|dedication|also by|other books|books by|cover|frontispiece|about the publisher)/;
const BACK_MATTER =
  /(acknowledg|bibliography|^index$|^about the authors?$|reading list|further reading|recommended reading|reading recommendations|^(end)?notes$|^references$|^works cited$|^sources$|^also by|^books by|^credits$|^permissions|^colophon|^about the publisher)/;

/**
 * Front and back matter, from the top-level contents entries: the leading run
 * of entries like Praise, Copyright and Contents, and the trailing run of
 * entries like Acknowledgments, Bibliography and Index.
 */
export function findExtras(
  entries: (TableOfContentsItem & { paragraph: number })[],
  paragraphs: string[]
): [number, number][] {
  if (!entries.length) return [];
  const topLevel = Math.min(...entries.map((e) => e.level));
  const top = entries.filter((e) => e.level === topLevel);
  const label = (e: TableOfContentsItem) => e.title.toLowerCase().replace(/^(the|selected|a)\s+/, "").trim();

  let first = 0;
  while (first < top.length && FRONT_MATTER.test(label(top[first]))) first++;
  let last = top.length;
  while (last > first && BACK_MATTER.test(label(top[last - 1]))) last--;

  const total = paragraphs.reduce((n, p) => n + p.length, 0);
  const chars = (from: number, to: number) => paragraphs.slice(from, to).reduce((n, p) => n + p.length, 0);
  const ranges: [number, number][] = [];
  // Never hide a large share of the document on a guess
  if (first > 0 && first < top.length) {
    const end = top[first].paragraph;
    if (chars(0, end) <= total * 0.25) ranges.push([0, end]);
  }
  if (last < top.length && last > first) {
    const start = top[last].paragraph;
    if (chars(start, paragraphs.length) <= total * 0.3) ranges.push([start, paragraphs.length]);
  }
  return ranges;
}

// ========== PUBLIC API ==========

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Reads a PDF's text, structure and contents into a document. */
export function processPdf(
  data: ArrayBuffer,
  settings: ReaderSettings = DEFAULT_SETTINGS,
  options: { fallbackTitle?: string; onProgress?: ProgressCallback } = {}
): Promise<ProcessedDocument> {
  return extractAndCleanPdfText(data, settings, options);
}

/**
 * Re-paginate with new settings. AI labels and key passages are kept by
 * paragraph, so they carry over to the new pages.
 */
export function repaginateDocument(
  document: ProcessedDocument,
  settings: ReaderSettings
): ProcessedDocument {
  const pages = createSmartPages(document.rawParagraphs, settings, document);
  const { cleanupCache: _, ...rest } = document;
  return renderAiPages({
    ...rest,
    totalPages: pages.length,
    pages,
    tableOfContents: resolveTocPages(
      document.tableOfContents ?? [],
      pages,
      settings.showExtras ? undefined : document.extras
    ),
  });
}

// ========== AI LAYOUT ==========

/** The paragraphs on a page (older documents only store where each page starts). */
export function pageIndices(document: ProcessedDocument, page: ProcessedPage): number[] {
  if (page.indices) return page.indices;
  const start = page.startParagraph ?? 0;
  const end = document.pages[page.pageNumber]?.startParagraph ?? document.rawParagraphs.length;
  return Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k);
}

/** Whether the AI changed how anything on this page is laid out. */
export function pageHasAiChanges(document: ProcessedDocument, page: ProcessedPage | undefined): boolean {
  const labels = document.ai?.labels;
  return !!page && !!labels && pageIndices(document, page).some((i) => labels[i]);
}

export function pagePassages(document: ProcessedDocument, page: ProcessedPage | undefined): string[] {
  const passages = document.ai?.passages;
  if (!page || !passages) return [];
  return pageIndices(document, page).flatMap((i) => passages[i] ?? []);
}

/** Sets each page's AI layout once the AI has looked at every paragraph on it. */
export function renderAiPages(document: ProcessedDocument): ProcessedDocument {
  const ai = document.ai;
  const headingAt = new Map((document.headings ?? []).map((h) => [h.paragraph, h.level]));
  const pages = document.pages.map((page) => {
    const indices = pageIndices(document, page);
    const checked = !!ai && indices.length > 0 && indices.every((i) => ai.checked[i]);
    if (!checked) return { ...page, enhancedContent: "", isEnhanced: false };
    return {
      ...page,
      isEnhanced: true,
      enhancedContent: pageHasAiChanges(document, page)
        ? paragraphsToMarkdown(indices, document.rawParagraphs, headingAt, document, ai.labels)
        : page.markdownContent,
    };
  });
  return { ...document, pages };
}
