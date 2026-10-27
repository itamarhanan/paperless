"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SIDEBAR_KEY, useReaderStore } from "@/lib/store/reader-store";
import {
  getDocument,
  getLastDocumentId,
  loadReadingPosition,
  loadSettings,
  saveReadingPosition,
  touchDocument,
  updateDocument,
} from "@/lib/storage";
import { paginationKey, repaginateDocument } from "@/lib/pdf-processor";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useHidingChrome } from "@/hooks/use-hiding-chrome";
import { usePageCleanup } from "@/hooks/use-page-cleanup";
import { useLoadBookmarks } from "@/hooks/use-bookmarks";
import { ReaderPage } from "./reader-page";
import { BottomBar, ChatAside, PhoneSheets, Sidebar, TopBar } from "./reader-chrome";
import { ReaderTour, useTour } from "./reader-tour";

type LoadState = "loading" | "ready" | "missing";

const SAVE_DELAY_MS = 1500;

export function ReaderInterface() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const [state, setState] = useState<LoadState>("loading");

  const docId = useReaderStore((s) => s.docId);
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);
  const settings = useReaderStore((s) => s.settings);
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const chatOpen = useReaderStore((s) => s.chatOpen);
  const panel = useReaderStore((s) => s.panel);
  const touring = useTour((s) => s.step !== null);
  const startTour = useTour((s) => s.start);
  const tourAsked = params.get("tour") === "1";

  const desktop = useIsDesktop();
  // Zen reading: toolbars step aside on every screen while the text is all there is.
  // With the sidebar or chat open on desktop, they stay so their tops line up.
  // The tour points at the toolbars, so they stay while it runs.
  const chrome = useHidingChrome(!panel && !chatOpen && !(desktop && sidebarOpen) && !touring);

  // The sidebar opens only if the reader opened it last time
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "1") useReaderStore.setState({ sidebarOpen: true });
    } catch {
      // Storage unavailable: keep it closed
    }
  }, []);
  const { cleanNow } = usePageCleanup();
  useLoadBookmarks();

  /** Scroll fraction to restore once the saved page has rendered. */
  const restoreScroll = useRef<number | null>(null);
  /** The pagination the open document was built with, so settings changes repaginate once. */
  const lastPagination = useRef<string | null>(null);

  // ----- Load -----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) {
        const last = getLastDocumentId();
        router.replace(last ? `/reader?id=${encodeURIComponent(last)}` : "/");
        return;
      }

      // A link to a page (from the book's details) opens there instead of where reading left off
      const asked = Number(new URLSearchParams(window.location.search).get("page"));
      const requested = Number.isInteger(asked) && asked >= 1 ? asked : null;

      setState("loading");
      // A tour left running on another book doesn't follow the reader here
      useTour.setState({ step: null });
      const [saved, savedSettings, position] = await Promise.all([
        getDocument(id),
        loadSettings(),
        loadReadingPosition(id),
      ]);
      if (cancelled) return;
      if (!saved) {
        setState("missing");
        return;
      }

      let doc = saved.document;
      // Paginated with other settings (or by an older version): bring it in line
      if (doc.rawParagraphs?.length && doc.paginatedWith !== paginationKey(savedSettings)) {
        doc = { ...repaginateDocument(doc, savedSettings), paginatedWith: paginationKey(savedSettings) };
      }

      useReaderStore.getState().setSettings(savedSettings);
      useReaderStore.getState().load(id, doc, requested ?? position?.page ?? 1);
      restoreScroll.current = requested ? 0 : (position?.scrollPosition ?? 0);
      // Drop the page from the address, so a reload returns to the saved position
      if (requested) window.history.replaceState(null, "", `/reader?id=${encodeURIComponent(id)}`);
      lastPagination.current = paginationKey(savedSettings);
      setState("ready");
      void touchDocument(id);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  // ----- Guided tour: once, from the library's sample (?tour=1) -----
  useEffect(() => {
    if (state !== "ready" || !tourAsked || !id) return;
    startTour();
    // Drop it from the address, so a reload doesn't start it again
    router.replace(`/reader?id=${encodeURIComponent(id)}`, { scroll: false });
  }, [state, tourAsked, id, router, startTour]);

  useEffect(() => {
    if (document?.title) window.document.title = `${document.title} · Paperless`;
  }, [document?.title]);

  // ----- Repaginate when page length or smart breaks change -----
  useEffect(() => {
    if (!settings || !document || state !== "ready") return;
    const key = paginationKey(settings);
    if (lastPagination.current === key) return;
    lastPagination.current = key;

    const { currentPage, setDocument, setCurrentPage } = useReaderStore.getState();
    const anchor = document.pages[currentPage - 1]?.startParagraph ?? 0;
    const next = { ...repaginateDocument(document, settings), paginatedWith: key };
    setDocument(next);
    // Stay on the page that holds the paragraph we were reading
    let page = 1;
    for (const p of next.pages) if ((p.startParagraph ?? 0) <= anchor) page = p.pageNumber;
    setCurrentPage(page);
  }, [settings, document, state]);

  // ----- Persist document changes (cleaned pages, pagination) -----
  useEffect(() => {
    if (!docId || !document || state !== "ready") return;
    const timer = setTimeout(() => void updateDocument(docId, document), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [docId, document, state]);

  // ----- Scroll: restore on open, top of page on page change -----
  useLayoutEffect(() => {
    if (state !== "ready") return;
    if (restoreScroll.current !== null) {
      const fraction = restoreScroll.current;
      restoreScroll.current = null;
      requestAnimationFrame(() => {
        const max = window.document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: Math.max(0, fraction * max) });
      });
      return;
    }
    window.scrollTo({ top: 0 });
    chrome.show();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, state]);

  // ----- Save reading position -----
  useEffect(() => {
    if (!docId || state !== "ready") return;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      const max = window.document.documentElement.scrollHeight - window.innerHeight;
      const fraction = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      void saveReadingPosition(docId, { page: useReaderStore.getState().currentPage, scrollPosition: fraction });
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(save, 500);
    };
    save();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
    };
  }, [docId, currentPage, state]);

  // ----- Keyboard -----
  const goTo = useCallback((delta: number) => {
    const { currentPage, setCurrentPage, document } = useReaderStore.getState();
    const next = currentPage + delta;
    if (document && next >= 1 && next <= document.totalPages) setCurrentPage(next);
  }, []);
  useKeyboardShortcuts({
    onNextPage: () => goTo(1),
    onPrevPage: () => goTo(-1),
    onSearch: () => useReaderStore.getState().setPanel("search"),
  });

  // Tapping the text toggles the toolbars on phones, like Books
  const onTextTap = (e: React.MouseEvent) => {
    if (desktop) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, label, [role=button]")) return;
    if (window.getSelection()?.toString()) return;
    chrome.toggle();
  };

  if (state === "missing") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">This document isn’t in your library</h1>
        <p className="max-w-sm text-muted-foreground">
          It may have been removed, or it was added on another device. Documents are stored only in this browser.
        </p>
        <Button asChild>
          <Link href="/library">Go to library</Link>
        </Button>
      </main>
    );
  }

  if (state === "loading" || !document) return <ReaderSkeleton />;

  return (
    <div className="min-h-dvh">
      <a
        href="#reader-text"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to text
      </a>

      <TopBar desktop={desktop} hidden={chrome.hidden} onCleanNow={cleanNow} />

      <div className="flex">
        {desktop && sidebarOpen && <Sidebar />}
        <main id="reader-text" tabIndex={-1} className="min-w-0 flex-1 outline-none" onClick={onTextTap}>
          <ReaderPage onCleanNow={cleanNow} />
          {!desktop && <div className="pb-safe h-16" aria-hidden />}
        </main>
        {desktop && chatOpen && <ChatAside />}
      </div>

      {!desktop && (
        <>
          <BottomBar hidden={chrome.hidden} />
          <PhoneSheets />
        </>
      )}

      <ReaderTour desktop={desktop} />
    </div>
  );
}


function ReaderSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Opening document">
      <div className="pt-safe border-b">
        <div className="flex h-12 items-center gap-3 px-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="mx-auto h-4 w-40" />
          <Skeleton className="size-6" />
        </div>
      </div>
      <div className="mx-auto max-w-[42.5rem] space-y-4 px-5 pt-10">
        <Skeleton className="h-4 w-1/3" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${88 + ((i * 7) % 12)}%` }} />
        ))}
        <div className="h-4" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${84 + ((i * 5) % 16)}%` }} />
        ))}
      </div>
    </div>
  );
}
