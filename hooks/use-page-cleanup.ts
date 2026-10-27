"use client";

import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { useReaderStore } from "@/lib/store/reader-store";
import { AI_KEY_CHANGED, aiHeaders } from "@/lib/ai-key";
import { pageIndices, type AiLabel, type ProcessedDocument } from "@/lib/pdf-processor";

export type CleanupStatus = "cleaning" | "failed";

interface CleanupState {
  status: Record<number, CleanupStatus>;
  /** Why page checks stopped (an AI limit was reached), until a key is added. */
  paused: string | null;
  set: (page: number, status: CleanupStatus | null) => void;
  setPaused: (reason: string | null) => void;
  reset: () => void;
}

export const useCleanupStore = create<CleanupState>((set) => ({
  status: {},
  paused: null,
  setPaused: (paused) => set({ paused }),
  set: (page, status) =>
    set((state) => {
      const next = { ...state.status };
      if (status) next[page] = status;
      else delete next[page];
      return { status: next };
    }),
  reset: () => set({ status: {} }),
}));

const DWELL_MS = 800;
/** Pages further than this from the reader are dropped from the queue. */
const MAX_DISTANCE = 2;

/** Never let the AI hide more than this share of a page's text. */
const MAX_DROPPED_SHARE = 0.35;

type AiResponse = {
  labels: ({ id: number } & AiLabel)[];
  passages: { id: number; text: string }[];
};

function currentLabel(doc: ProcessedDocument, i: number): string {
  const heading = doc.headings?.find((h) => h.paragraph === i);
  if (heading) return `heading ${heading.level}`;
  return doc.kinds?.[i] ?? "text";
}

/** Checks the AI's answer against the page again: only known ids, exact passages. */
function acceptResponse(doc: ProcessedDocument, indices: number[], data: AiResponse) {
  const onPage = new Set(indices);
  const text = (i: number) => doc.rawParagraphs[i] ?? "";
  // Headings from the book's own contents list are the author's; the AI can't move them
  const fromContents = new Set((doc.tableOfContents ?? []).map((t) => t.paragraph));
  const labels: Record<number, AiLabel> = {};
  for (const { id, kind, level, joinNext } of data.labels ?? []) {
    if (!onPage.has(id)) continue;
    const current = currentLabel(doc, id);
    const isHeading = current.startsWith("heading");
    const join = joinNext && indices[indices.length - 1] !== id;
    // Skip labels that only repeat the current layout
    if (isHeading && (kind === "heading" || fromContents.has(id))) continue;
    if (!join && (kind === current || (kind === "text" && current === "attribution"))) continue;
    labels[id] = { kind, ...(level ? { level } : {}), ...(join ? { joinNext: true } : {}) };
  }

  const total = indices.reduce((n, i) => n + text(i).length, 0);
  const dropped = indices.filter((i) => labels[i]?.kind === "drop").reduce((n, i) => n + text(i).length, 0);
  if (dropped > total * MAX_DROPPED_SHARE) {
    for (const i of indices) if (labels[i]?.kind === "drop") delete labels[i];
  }

  const passages: Record<number, string[]> = {};
  for (const { id, text: quote } of data.passages ?? []) {
    if (onPage.has(id) && text(id).includes(quote) && labels[id]?.kind !== "drop") {
      (passages[id] ??= []).push(quote);
    }
  }
  return { labels, passages };
}

/**
 * Has the AI check each page's layout in the background: the current page after
 * a short dwell, then the next one, so turning the page usually lands on a
 * checked page. The AI only labels paragraphs and picks key passages; the text
 * itself always comes from the book. One request at a time; results are saved
 * with the document by paragraph.
 */
export function usePageCleanup() {
  const docId = useReaderStore((s) => s.docId);
  const currentPage = useReaderStore((s) => s.currentPage);
  const enabled = useReaderStore((s) => s.settings?.autoCleanup ?? false);
  const totalPages = useReaderStore((s) => s.document?.totalPages ?? 0);

  const queue = useRef<number[]>([]);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;

    while (queue.current.length) {
      const pageNumber = queue.current.shift()!;
      const { document, currentPage } = useReaderStore.getState();
      const page = document?.pages[pageNumber - 1];
      if (!page || page.isEnhanced) continue;
      if (Math.abs(pageNumber - currentPage) > MAX_DISTANCE) continue;
      if (useCleanupStore.getState().status[pageNumber]) continue;

      const docAtStart = useReaderStore.getState().docId;
      useCleanupStore.getState().set(pageNumber, "cleaning");
      controller.current = new AbortController();

      try {
        const indices = pageIndices(document, page);
        const response = await fetch("/api/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...aiHeaders() },
          body: JSON.stringify({
            title: document.title,
            paragraphs: indices.map((i) => ({ id: i, text: document.rawParagraphs[i], kind: currentLabel(document, i) })),
          }),
          signal: controller.current.signal,
        });
        if (response.status === 429 || response.status === 503) {
          // A limit or a missing key: retrying page after page won't help
          const data = await response.json().catch(() => null);
          useCleanupStore.getState().setPaused(data?.error ?? "AI page checks are paused for now.");
          useCleanupStore.getState().set(pageNumber, null);
          queue.current = [];
          break;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as AiResponse;

        // The document may have changed while we waited
        if (useReaderStore.getState().docId !== docAtStart) break;

        const { labels, passages } = acceptResponse(document, indices, data);
        useReaderStore.getState().applyAi(indices, labels, passages);
        useCleanupStore.getState().set(pageNumber, null);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          useCleanupStore.getState().set(pageNumber, null);
          break;
        }
        useCleanupStore.getState().set(pageNumber, "failed");
      }
    }

    controller.current = null;
    running.current = false;
  }, []);

  const enqueue = useCallback(
    (pages: number[], front = false) => {
      const fresh = pages.filter((p) => !queue.current.includes(p));
      queue.current = front ? [...fresh, ...queue.current] : [...queue.current, ...fresh];
      void run();
    },
    [run]
  );

  // A different document: stop everything
  useEffect(() => {
    useCleanupStore.getState().reset();
    return () => {
      queue.current = [];
      controller.current?.abort();
    };
  }, [docId]);

  // A key was added or removed: try again
  useEffect(() => {
    const resume = () => useCleanupStore.getState().setPaused(null);
    window.addEventListener(AI_KEY_CHANGED, resume);
    return () => window.removeEventListener(AI_KEY_CHANGED, resume);
  }, []);

  const paused = useCleanupStore((s) => s.paused);
  useEffect(() => {
    if (!enabled || !totalPages || paused) return;
    const timer = setTimeout(() => {
      const next = currentPage < totalPages ? [currentPage, currentPage + 1] : [currentPage];
      // Current page first; drop anything queued for pages we've moved away from
      queue.current = queue.current.filter((p) => Math.abs(p - currentPage) <= MAX_DISTANCE);
      enqueue(next, true);
    }, DWELL_MS);
    return () => clearTimeout(timer);
  }, [enabled, paused, currentPage, totalPages, docId, enqueue]);

  /** Clean one page now, regardless of the auto setting. */
  const cleanNow = useCallback(
    (page: number) => {
      useCleanupStore.getState().setPaused(null);
      useCleanupStore.getState().set(page, null);
      enqueue([page], true);
    },
    [enqueue]
  );

  return { cleanNow };
}
