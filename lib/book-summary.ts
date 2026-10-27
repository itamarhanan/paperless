import { pageIndices, type AiKind, type ProcessedDocument, type TableOfContentsItem } from "./pdf-processor";

/**
 * What Paperless made of a book, worked out from the stored document: its size,
 * what it hides, and what the AI labelled. Nothing here changes the document.
 */

/** Silent reading of non-fiction averages about 240 words a minute (Brysbaert, 2019). */
export const WORDS_PER_MINUTE = 240;

const countWords = (text: string) => text.match(/\S+/g)?.length ?? 0;

/** Words on the pages from `fromPage` (1-based) to the end. Hidden pages don't count. */
export function wordsOnPages(document: ProcessedDocument, fromPage = 1): number {
  let words = 0;
  for (const page of document.pages.slice(Math.max(0, fromPage - 1))) {
    for (const i of pageIndices(document, page)) {
      if (document.ai?.labels[i]?.kind !== "drop") words += countWords(document.rawParagraphs[i] ?? "");
    }
  }
  return words;
}

/** "About 25 min", "About 3 h 40 min", "About 12 h". */
export function readingTime(words: number): string {
  const minutes = words / WORDS_PER_MINUTE;
  if (minutes < 1) return "Under a minute";
  if (minutes < 10) return `About ${Math.round(minutes)} min`;
  if (minutes < 60) return `About ${Math.round(minutes / 5) * 5} min`;
  if (minutes >= 600) return `About ${Math.round(minutes / 60)} h`;
  const rounded = Math.round(minutes / 10) * 10;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m ? `About ${h} h ${m} min` : `About ${h} h`;
}

/** The page each paragraph is on, for the current pagination. */
export function pageOfParagraph(document: ProcessedDocument): Map<number, number> {
  const map = new Map<number, number>();
  for (const page of document.pages) {
    for (const i of pageIndices(document, page)) map.set(i, page.pageNumber);
  }
  return map;
}

export interface HiddenRange {
  /** Before the first chapter, or after the last. */
  where: "start" | "end";
  /** Contents entries inside the range: Praise, Copyright, Index… */
  entries: string[];
  /** The range's first line of text. */
  firstLine: string;
  words: number;
}

/** Front and back matter set aside on import. */
export function hiddenRanges(document: ProcessedDocument): HiddenRange[] {
  const paragraphs = document.rawParagraphs ?? [];
  return (document.extras ?? []).map(([start, end]) => {
    const inRange = (item: TableOfContentsItem) =>
      item.paragraph !== undefined && item.paragraph >= start && item.paragraph < end;
    const slice = paragraphs.slice(start, end);
    return {
      where: start === 0 ? "start" : "end",
      entries: (document.tableOfContents ?? []).filter(inRange).map((t) => t.title),
      firstLine: slice.find((p) => p.trim())?.trim() ?? "",
      words: slice.reduce((n, p) => n + countWords(p), 0),
    };
  });
}

export type ChangeKind = AiKind | "join";

export interface AiSummary {
  /** Pages the AI has looked at in full. */
  pagesChecked: number;
  /** Paragraphs relabelled, by kind. */
  changes: Partial<Record<ChangeKind, number>>;
  totalChanges: number;
  /** Key passages in reading order, each an exact quote from its paragraph. */
  passages: { paragraph: number; text: string }[];
  /** Paragraphs the AI hid, in reading order. */
  dropped: number[];
}

export function summarizeAi(document: ProcessedDocument): AiSummary | null {
  const ai = document.ai;
  if (!ai || !Object.keys(ai.checked).length) return null;
  const changes: AiSummary["changes"] = {};
  let totalChanges = 0;
  const byIndex = (a: [string, unknown], b: [string, unknown]) => Number(a[0]) - Number(b[0]);
  for (const label of Object.values(ai.labels)) {
    // A split paragraph put back together keeps its kind; "text" there isn't a change of its own
    if (label.joinNext) changes.join = (changes.join ?? 0) + 1;
    if (!label.joinNext || label.kind !== "text") changes[label.kind] = (changes[label.kind] ?? 0) + 1;
    totalChanges++;
  }
  return {
    pagesChecked: document.pages.filter((p) => p.isEnhanced).length,
    changes,
    totalChanges,
    passages: Object.entries(ai.passages)
      .sort(byIndex)
      .flatMap(([i, quotes]) => quotes.map((text) => ({ paragraph: Number(i), text }))),
    dropped: Object.entries(ai.labels)
      .filter(([, label]) => label.kind === "drop")
      .map(([i]) => Number(i))
      .sort((a, b) => a - b),
  };
}

/** "English", "Hebrew"; the tag itself when the browser doesn't know it. */
export function languageName(tag: string | undefined): string | null {
  if (!tag) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
