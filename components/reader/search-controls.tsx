"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useReaderStore } from "@/lib/store/reader-store";

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Hit {
  page: number;
  count: number;
  snippets: { before: string; match: string; after: string }[];
}

const MAX_SNIPPETS = 2;
const CONTEXT = 48;

function findHits(pages: { pageNumber: number; content: string }[], query: string): Hit[] {
  const pattern = new RegExp(escapeRegExp(query), "gi");
  const hits: Hit[] = [];
  for (const page of pages) {
    const text = page.content.replace(/\s+/g, " ");
    const matches = [...text.matchAll(pattern)];
    if (!matches.length) continue;
    hits.push({
      page: page.pageNumber,
      count: matches.length,
      snippets: matches.slice(0, MAX_SNIPPETS).map((m) => {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        return {
          before: (start > CONTEXT ? "…" : "") + text.slice(Math.max(0, start - CONTEXT), start),
          match: m[0],
          after: text.slice(end, end + CONTEXT) + (end + CONTEXT < text.length ? "…" : ""),
        };
      }),
    });
  }
  return hits;
}

/** Find in document. Results are grouped by page; picking one highlights matches on the page. */
export function SearchControls({ onNavigate }: { onNavigate?: () => void }) {
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const setCurrentPage = useReaderStore((s) => s.setCurrentPage);
  const storedQuery = useReaderStore((s) => s.searchQuery);
  const setSearchQuery = useReaderStore((s) => s.setSearchQuery);
  const [query, setQuery] = useState(storedQuery);
  const deferred = useDeferredValue(query.trim());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus after the sheet's open animation so iOS shows the keyboard
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const hits = useMemo(
    () => (document && deferred.length >= 2 ? findHits(document.pages, deferred) : []),
    [document, deferred]
  );
  const total = hits.reduce((n, h) => n + h.count, 0);

  return (
    <div className="flex min-h-0 flex-col">
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          const first = hits.find((h) => h.page >= currentPage) ?? hits[0];
          if (first) {
            setSearchQuery(deferred);
            setCurrentPage(first.page);
            onNavigate?.();
          }
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search in this document"
          aria-label="Search in this document"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 w-full rounded-lg bg-muted pl-9 pr-10 text-[1.0625rem] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-fine:h-9 pointer-fine:text-[0.9375rem] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQuery("");
              setSearchQuery("");
              inputRef.current?.focus();
            }}
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      <p aria-live="polite" className="px-1 pb-1 pt-3 text-[0.8125rem] text-muted-foreground">
        {deferred.length < 2
          ? "Type at least two characters."
          : total
            ? `${total} ${total === 1 ? "match" : "matches"} on ${hits.length} ${hits.length === 1 ? "page" : "pages"}`
            : `No matches for “${deferred}”.`}
      </p>

      <ul className="-mx-1 space-y-0.5">
        {hits.slice(0, 200).map((hit) => (
          <li key={hit.page}>
            <button
              type="button"
              aria-current={hit.page === currentPage}
              className="w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring aria-[current=true]:bg-accent"
              onClick={() => {
                setSearchQuery(deferred);
                setCurrentPage(hit.page);
                onNavigate?.();
              }}
            >
              <span className="flex items-baseline justify-between text-[0.8125rem] font-medium">
                Page {hit.page}
                <span className="tabular font-normal text-muted-foreground">
                  {hit.count} {hit.count === 1 ? "match" : "matches"}
                </span>
              </span>
              {hit.snippets.map((s, i) => (
                <span key={i} className="mt-1 block text-[0.875rem] leading-snug text-muted-foreground">
                  {s.before}
                  <mark className="rounded-sm bg-foreground px-0.5 text-background">{s.match}</mark>
                  {s.after}
                </span>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
