"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useReaderStore } from "@/lib/store/reader-store";
import { useCleanupStore } from "@/hooks/use-page-cleanup";
import { pageHasAiChanges, pagePassages, withDefaults, type ProcessedDocument } from "@/lib/pdf-processor";
import { displayTitle } from "@/lib/text";
import { escapeRegExp } from "./search-controls";

const FONT_STACKS = {
  serif: "var(--font-reading), Georgia, serif",
  sans: "var(--font-ui)",
  mono: "var(--font-code), ui-monospace, monospace",
} as const;

/** Swap the AI layout in only while the reader is still near the top of the page. */
const SWAP_THRESHOLD_PX = 160;

/** The chapter or section this page is in: the last contents entry at or before it. */
function sectionFor(doc: ProcessedDocument, page: number): string | null {
  let title: string | null = null;
  for (const item of doc.tableOfContents ?? []) {
    if (!item.hidden && item.page <= page) title = item.title;
  }
  return title;
}

function nextHeading(doc: ProcessedDocument, page: number): string | null {
  return doc.tableOfContents?.find((item) => !item.hidden && item.page === page + 1)?.title ?? null;
}

// Injected at runtime: the build's CSS parser doesn't know ::highlight() yet
const HIGHLIGHT_CSS = `
::highlight(search-hit) { background-color: var(--search-hit); color: inherit; }
::highlight(search-hit-current) { background-color: var(--search-hit-current); color: var(--search-hit-current-fg); }
::highlight(key-passage) { background-color: var(--key-passage-bg); text-decoration: underline; text-decoration-color: var(--key-passage); text-decoration-thickness: 0.08em; text-underline-offset: 0.24em; }`;

function ensureHighlightStyles() {
  if (document.getElementById("search-highlight-css")) return;
  const style = document.createElement("style");
  style.id = "search-highlight-css";
  style.textContent = HIGHLIGHT_CSS;
  document.head.appendChild(style);
}

/** Paints search matches with the CSS Custom Highlight API; no DOM changes. */
function useSearchHighlight(container: React.RefObject<HTMLElement | null>, query: string, contentKey: string) {
  useEffect(() => {
    const highlights = (globalThis as any).CSS?.highlights;
    if (!highlights) return;
    ensureHighlightStyles();
    highlights.delete("search-hit");
    highlights.delete("search-hit-current");
    const root = container.current;
    if (!root || query.length < 2) return;

    const pattern = new RegExp(escapeRegExp(query), "gi");
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (const m of text.matchAll(pattern)) {
        const range = new Range();
        range.setStart(node, m.index ?? 0);
        range.setEnd(node, (m.index ?? 0) + m[0].length);
        ranges.push(range);
      }
    }
    if (!ranges.length) return;

    const Highlight = (globalThis as any).Highlight;
    highlights.set("search-hit", new Highlight(...ranges.slice(1)));
    highlights.set("search-hit-current", new Highlight(ranges[0]));
    const rect = ranges[0].getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 3 });

    return () => {
      highlights.delete("search-hit");
      highlights.delete("search-hit-current");
    };
  }, [container, query, contentKey]);
}

/**
 * Underlines the AI's key passages, found in the rendered text. Like search
 * hits, they're painted over the text, so they never move it.
 */
function useKeyPassages(container: React.RefObject<HTMLElement | null>, passages: string[], contentKey: string) {
  const key = passages.join("\u0000");
  useEffect(() => {
    const highlights = (globalThis as any).CSS?.highlights;
    if (!highlights) return;
    ensureHighlightStyles();
    highlights.delete("key-passage");
    const root = container.current;
    if (!root || !passages.length) return;

    // The page's text as one string, so a passage can span italics and links
    const nodes: { node: Text; start: number }[] = [];
    let text = "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push({ node: node as Text, start: text.length });
      text += node.textContent ?? "";
    }
    const locate = (offset: number) => {
      let k = nodes.length - 1;
      while (k > 0 && nodes[k].start > offset) k--;
      return { node: nodes[k].node, offset: offset - nodes[k].start };
    };

    const ranges: Range[] = [];
    for (const passage of passages) {
      const at = text.indexOf(passage);
      if (at < 0) continue;
      const start = locate(at);
      const end = locate(at + passage.length);
      const range = new Range();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      ranges.push(range);
    }
    if (!ranges.length) return;
    highlights.set("key-passage", new (globalThis as any).Highlight(...ranges));
    return () => highlights.delete("key-passage");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, key, contentKey]);
}

export function ReaderPage({ onCleanNow }: { onCleanNow: (page: number) => void }) {
  const document = useReaderStore((s) => s.document)!;
  const currentPage = useReaderStore((s) => s.currentPage);
  const settings = withDefaults(useReaderStore((s) => s.settings));
  const setCurrentPage = useReaderStore((s) => s.setCurrentPage);
  const showOriginal = useReaderStore((s) => !!s.showOriginal[s.currentPage]);
  const setShowOriginal = useReaderStore((s) => s.setShowOriginal);
  const searchQuery = useReaderStore((s) => s.searchQuery);
  const setSearchQuery = useReaderStore((s) => s.setSearchQuery);
  const cleanup = useCleanupStore((s) => s.status[currentPage]);

  const page = document.pages[currentPage - 1];
  const total = document.totalPages;
  // The AI layout differs from the extracted one only when it changed something
  const cleanedAvailable = Boolean(page?.isEnhanced && pageHasAiChanges(document, page));
  const passages = useMemo(() => (page?.isEnhanced ? pagePassages(document, page) : []), [document, page]);

  // What is on screen. Cleaned text that arrives mid-read waits behind a pill.
  const [displayCleaned, setDisplayCleaned] = useState(cleanedAvailable);
  const [pendingSwap, setPendingSwap] = useState(false);
  const shownPage = useRef(currentPage);

  useLayoutEffect(() => {
    if (shownPage.current !== currentPage) {
      shownPage.current = currentPage;
      setDisplayCleaned(cleanedAvailable);
      setPendingSwap(false);
      return;
    }
    if (cleanedAvailable && !displayCleaned) {
      if (window.scrollY < SWAP_THRESHOLD_PX) setDisplayCleaned(true);
      else setPendingSwap(true);
    }
    if (!cleanedAvailable && displayCleaned) setDisplayCleaned(false);
  }, [currentPage, cleanedAvailable, displayCleaned]);

  const useCleaned = displayCleaned && cleanedAvailable && !showOriginal;
  const markdown = useCleaned ? page.enhancedContent : page?.markdownContent || page?.content || "";

  const articleRef = useRef<HTMLDivElement>(null);
  useSearchHighlight(articleRef, searchQuery, `${currentPage}:${useCleaned}`);
  useKeyPassages(
    articleRef,
    settings.keyPassages && !showOriginal ? passages : [],
    `${currentPage}:${useCleaned}`
  );

  const section = useMemo(() => sectionFor(document, currentPage), [document, currentPage]);
  const sectionLabel = section && !/^#{1,6}\s/.test(markdown.trimStart()) ? section : null;
  const upcoming = useMemo(() => nextHeading(document, currentPage), [document, currentPage]);

  if (!page) return null;

  const proseStyle = {
    "--reader-font": FONT_STACKS[settings.fontFamily],
    "--reader-font-size": `${settings.fontSize / 16}rem`,
    "--reader-line-height": settings.lineHeight,
    "--reader-measure": `${settings.maxWidth / 16}rem`,
    // "start" rather than "left", so right-to-left paragraphs align to their own edge
    "--reader-align": settings.textAlign === "justify" ? "justify" : "start",
  } as CSSProperties;

  return (
    <div className="px-5 pb-10 pt-6 sm:px-8 lg:pt-10" style={proseStyle}>
      <div className="mx-auto" style={{ maxWidth: "var(--reader-measure)" }}>
        {/* The section, unless the page opens with a heading of its own */}
        {sectionLabel && (
          <p className="mb-6 truncate text-[0.8125rem] text-muted-foreground">{displayTitle(sectionLabel)}</p>
        )}

        {searchQuery && (
          <div className="mb-6 flex items-center justify-between gap-2 rounded-lg bg-muted py-1 pl-3 pr-1 text-[0.8125rem]">
            <span className="truncate">
              Showing matches for <span className="font-medium">“{searchQuery}”</span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Clear search highlights" onClick={() => setSearchQuery("")}>
              <X />
            </Button>
          </div>
        )}

        <div
          ref={articleRef}
          key={`${currentPage}-${useCleaned}`}
          className="reader-prose animate-in fade-in-0 duration-200"
          data-align={settings.textAlign}
          lang={document.language}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
            {markdown}
          </ReactMarkdown>
        </div>

        {/* What the AI did here: said once, quietly, after the text (generative-ai.md) */}
        <div className="mt-10 flex min-h-6 items-center text-[0.8125rem] text-muted-foreground">
          <CleanupStatus
            status={cleanup}
            cleaned={useCleaned}
            hasCleaned={cleanedAvailable}
            passages={settings.keyPassages ? passages.length : 0}
            showingOriginal={showOriginal}
            onShowOriginal={(show) => {
              setShowOriginal(currentPage, show);
              if (!show) setDisplayCleaned(true);
            }}
            onRetry={() => onCleanNow(currentPage)}
          />
        </div>

        <PageTurn
          page={currentPage}
          total={total}
          upcoming={upcoming}
          onPrev={() => setCurrentPage(currentPage - 1)}
          onNext={() => setCurrentPage(currentPage + 1)}
          onJump={setCurrentPage}
        />
      </div>

      {pendingSwap && !showOriginal && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 flex justify-center lg:bottom-8">
          <button
            type="button"
            className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[0.9375rem] font-medium text-primary-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
            onClick={() => {
              setDisplayCleaned(true);
              setPendingSwap(false);
            }}
          >
            Tidied layout ready · Show
          </button>
        </div>
      )}
    </div>
  );
}

function CleanupStatus({
  status,
  cleaned,
  hasCleaned,
  passages,
  showingOriginal,
  onShowOriginal,
  onRetry,
}: {
  status?: "cleaning" | "failed";
  cleaned: boolean;
  hasCleaned: boolean;
  passages: number;
  showingOriginal: boolean;
  onShowOriginal: (show: boolean) => void;
  onRetry: () => void;
}) {
  const linkClass =
    "underline decoration-control underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring rounded-sm pointer-coarse:py-2.5";

  if (status === "cleaning") {
    return (
      <span className="flex shrink-0 items-center gap-1.5" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Checking layout…
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex shrink-0 items-center gap-2" role="status">
        Couldn’t check this page.
        <button type="button" className={linkClass} onClick={onRetry}>
          Try again
        </button>
      </span>
    );
  }
  if (showingOriginal && (hasCleaned || passages)) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        Original layout
        <button type="button" className={linkClass} onClick={() => onShowOriginal(false)}>
          Show AI layout
        </button>
      </span>
    );
  }
  // Say what the AI did on this page: tidied the layout, marked passages, or both
  const did = [cleaned && "Layout tidied", passages > 0 && "key passages marked"].filter(Boolean).join(", ");
  if (!did) return null;
  return (
    <span className="flex shrink-0 items-center gap-2">
      {did.charAt(0).toUpperCase() + did.slice(1)} by AI
      <button type="button" className={linkClass} onClick={() => onShowOriginal(true)}>
        Show original
      </button>
    </span>
  );
}

function PageTurn({
  page,
  total,
  upcoming,
  onPrev,
  onNext,
  onJump,
}: {
  page: number;
  total: number;
  upcoming: string | null;
  onPrev: () => void;
  onNext: () => void;
  onJump: (page: number) => void;
}) {
  const [target, setTarget] = useState(page);
  useEffect(() => setTarget(page), [page]);
  const isLast = page >= total;

  return (
    <nav aria-label="Pages" className="mt-4 border-t pt-6">
      {!isLast ? (
        <button
          type="button"
          onClick={onNext}
          className="group flex w-full items-center justify-between gap-4 rounded-xl bg-primary px-5 py-4 text-left text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="min-w-0">
            <span className="block text-[0.8125rem] opacity-70">Next · page {page + 1}</span>
            <span className="block truncate text-[1.0625rem] font-semibold">
              {upcoming ? displayTitle(upcoming) : "Continue reading"}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      ) : (
        <div className="rounded-xl bg-muted px-5 py-4 text-center">
          <p className="text-[1.0625rem] font-semibold">The end</p>
          <p className="text-[0.8125rem] text-muted-foreground">You’ve reached the last page.</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onPrev} disabled={page <= 1} className="-ml-3 text-muted-foreground">
          <ArrowLeft /> Previous
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="tabular -mr-3 text-muted-foreground" aria-label={`Page ${page} of ${total}. Go to page`}>
              Page {page} of {total}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onJump(target);
              }}
            >
              <div className="flex items-baseline justify-between">
                <label htmlFor="jump-page" className="text-[0.9375rem] font-medium">
                  Go to page
                </label>
                <span className="text-[0.8125rem] text-muted-foreground tabular">
                  {Math.round((target / total) * 100)}%
                </span>
              </div>
              <Slider
                min={1}
                max={total}
                step={1}
                value={[target]}
                onValueChange={([v]) => setTarget(v)}
                aria-label="Page"
              />
              <div className="flex gap-2">
                <input
                  id="jump-page"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={total}
                  value={target}
                  onChange={(e) => setTarget(Math.min(total, Math.max(1, Number(e.target.value) || 1)))}
                  className="tabular h-9 w-20 rounded-md border bg-background px-2 text-[1.0625rem] outline-none focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:h-11"
                />
                <Button type="submit" className="flex-1" disabled={target === page}>
                  Go
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
