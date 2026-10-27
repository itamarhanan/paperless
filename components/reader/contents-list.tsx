"use client";

import { useEffect, useMemo, useRef } from "react";
import { Bookmark as BookmarkIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReaderStore } from "@/lib/store/reader-store";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useUpdateSettings } from "@/hooks/use-update-settings";
import { cn } from "@/lib/utils";
import { displayTitle } from "@/lib/text";

function snippet(text: string, length = 90) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? clean.slice(0, length).trimEnd() + "…" : clean;
}

const rowClass =
  "flex w-full min-h-11 items-baseline gap-3 rounded-md px-3 py-2.5 text-left text-[0.9375rem] transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring aria-[current=true]:bg-accent aria-[current=true]:font-medium pointer-fine:min-h-9 pointer-fine:py-1.5 pointer-fine:text-sm";

export function ContentsList({ onNavigate }: { onNavigate?: () => void }) {
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const setCurrentPage = useReaderStore((s) => s.setCurrentPage);
  const listRef = useRef<HTMLOListElement>(null);

  const settings = useReaderStore((s) => s.settings);
  const updateSettings = useUpdateSettings();
  const toc = useMemo(() => (document?.tableOfContents ?? []).filter((item) => !item.hidden), [document]);
  const hasExtras = !!document?.extras?.length;

  // The current section is the last entry that starts at or before this page
  const currentIndex = useMemo(() => {
    let index = -1;
    toc.forEach((item, i) => {
      if (item.page <= currentPage) index = i;
    });
    return index;
  }, [toc, currentPage]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "center" });
  }, []);

  if (!document) return null;

  const go = (page: number) => {
    setCurrentPage(page);
    onNavigate?.();
  };

  if (!toc.length) {
    return (
      <div>
        <p className="px-3 pb-2 text-[0.8125rem] text-muted-foreground">
          This document has no table of contents. Jump to any page:
        </p>
        <ol ref={listRef} className="space-y-0.5">
          {document.pages.map((page) => (
            <li key={page.pageNumber}>
              <button
                type="button"
                className={rowClass}
                aria-current={page.pageNumber === currentPage}
                onClick={() => go(page.pageNumber)}
              >
                <span className="tabular w-8 shrink-0 text-muted-foreground">{page.pageNumber}</span>
                <span className="min-w-0 flex-1 truncate">{snippet(page.content)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const extrasToggle = hasExtras && (
    <div className="mt-3 flex items-center justify-between gap-3 border-t px-3 pt-3 text-[0.8125rem] text-muted-foreground">
      <span>
        {settings?.showExtras
          ? "Showing front and back matter"
          : "Praise, copyright, bibliography and similar pages are hidden"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => updateSettings({ showExtras: !settings?.showExtras })}
      >
        {settings?.showExtras ? "Hide" : "Show"}
      </Button>
    </div>
  );

  return (
    <div>
      <ol ref={listRef} className="space-y-0.5">
        {toc.map((item, i) => (
          <li key={`${item.title}-${i}`}>
            <button
              type="button"
              className={cn(rowClass, item.level > 1 && "pl-7 text-muted-foreground aria-[current=true]:text-foreground")}
              aria-current={i === currentIndex}
              onClick={() => go(item.page)}
            >
              <span className="min-w-0 flex-1">{displayTitle(item.title)}</span>
              <span className="tabular shrink-0 text-[0.8125rem] text-muted-foreground">{item.page}</span>
            </button>
          </li>
        ))}
      </ol>
      {extrasToggle}
    </div>
  );
}

export function BookmarksList({ onNavigate }: { onNavigate?: () => void }) {
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const setCurrentPage = useReaderStore((s) => s.setCurrentPage);
  const { items, remove } = useBookmarks();

  if (!items.length) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <BookmarkIcon className="mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="text-[0.9375rem] font-medium">No bookmarks yet</p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          Use the bookmark button at the top of a page to keep your place.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-0.5">
      {items.map((bookmark) => {
        const page = document?.pages[bookmark.page - 1];
        return (
          <li key={bookmark.id} className="group flex items-center gap-1">
            <button
              type="button"
              className={cn(rowClass, "flex-col items-start gap-0.5")}
              aria-current={bookmark.page === currentPage}
              onClick={() => {
                setCurrentPage(bookmark.page);
                onNavigate?.();
              }}
            >
              <span className="font-medium">Page {bookmark.page}</span>
              {page && (
                <span className="line-clamp-2 text-[0.8125rem] font-normal text-muted-foreground">
                  {bookmark.note || snippet(page.content, 120)}
                </span>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
              aria-label={`Remove bookmark on page ${bookmark.page}`}
              onClick={() => remove(bookmark)}
            >
              <X />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
