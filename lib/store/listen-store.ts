"use client";

import { create } from "zustand";
import { withDefaults } from "@/lib/pdf-processor";
import {
  acquireWakeLock,
  hasVoices,
  matchVoice,
  releaseWakeLock,
  speak,
  speechAvailable,
  voicesReady,
  type SpeakRequest,
} from "@/lib/speech/engine";
import { scriptFromDocument } from "@/lib/speech/data-script";
import type { ListenScript } from "@/lib/speech/script";
import { saveReadingPosition } from "@/lib/storage";
import { useReaderStore } from "./reader-store";

export type ListenStatus = "idle" | "playing" | "paused" | "ended" | "error";

interface ListenState {
  /** The book being read, as the reader store knows it. */
  bookId: string | null;
  status: ListenStatus;
  /** Why listening can't run: no speech in the browser, no voices installed, or the voice gave up. */
  reason: "unsupported" | "novoice" | "stalled" | null;
  /** The page being read, 1-based in the book's own numbering. */
  page: number;
  /** Position in the page's script. -1 means "first paragraph in view", -2 "the last paragraph";
   * a -1 sentence means "the last sentence of the block". The values land on delivery. */
  paragraph: number;
  sentence: number;
  /** The page's text, handed over by the reader or built from the book's data. */
  script: ListenScript | null;
  /** Paragraphs on the current page, for the progress readout. */
  total: number;

  toggle: () => void;
  pause: () => void;
  stop: () => void;
  /** Move one sentence back or forward, turning the page at the edges. */
  skip: (delta: number) => void;
  /** Jump to a paragraph of the current page (1-based): the player's slider. */
  jump: (paragraph: number) => void;
  /**
   * The reader hands each page's text over as it renders. The engine reads page
   * after page that way, so playback never waits on a page that isn't there yet.
   */
  setScript: (script: ListenScript) => void;
}

export const useListenStore = create<ListenState>(() => ({
  bookId: null,
  status: "idle",
  reason: null,
  page: 1,
  paragraph: 0,
  sentence: 0,
  script: null,
  total: 0,

  toggle: () => {
    const st = useListenStore.getState();
    if (st.status === "playing") st.pause();
    else if (st.status === "ended") begin(false, true); // a finished book starts over
    else begin(st.status === "paused");
  },
  pause: () => {
    const st = useListenStore.getState();
    if (st.status !== "playing") return;
    releaseWakeLock();
    cancelRun();
    useListenStore.setState({ status: "paused" });
  },
  stop: () => {
    releaseWakeLock();
    cancelRun();
    resolveWaiters();
    useListenStore.setState({
      bookId: null,
      status: "idle",
      reason: null,
      page: useReaderStore.getState().currentPage,
      paragraph: 0,
      sentence: 0,
      script: null,
      total: 0,
    });
  },
  skip: (delta) => {
    const st = useListenStore.getState();
    if (st.status === "idle" || st.reason) return;
    const script =
      st.script && st.script.page === st.page && st.script.docId === st.bookId ? st.script : null;
    const here = landing(st, script);

    let { page, paragraph, sentence } = st;
    if (delta < 0) {
      if (here.sentence > 0) {
        paragraph = here.paragraph;
        sentence = here.sentence - 1;
      } else if (here.paragraph > 0) {
        paragraph = here.paragraph - 1;
        sentence = -1; // the block's last sentence
      } else if (page > 1) {
        page -= 1;
        paragraph = -2; // the previous page's last paragraph
        sentence = -1;
        useReaderStore.getState().setCurrentPage(page);
      } else return; // already the book's first words
    } else {
      const block = script?.blocks[here.paragraph];
      if (block && here.sentence + 1 < block.segments.length) {
        paragraph = here.paragraph;
        sentence = here.sentence + 1;
      } else {
        paragraph = here.paragraph + 1; // the loop turns the page when it runs out
        sentence = 0;
      }
    }
    refocus({ page, paragraph, sentence });
  },
  jump: (value) => {
    const st = useListenStore.getState();
    if (st.status === "idle" || st.reason) return;
    refocus({ paragraph: Math.max(1, value) - 1, sentence: 0 });
  },
  setScript: (script) => {
    const st = useListenStore.getState();
    const { paragraph, sentence } = concrete(script, st.paragraph, st.sentence);
    useListenStore.setState({ script, total: script.blocks.length, paragraph, sentence });
    resolveWaiters();
  },
}));

//
// Playback loop
//

/**
 * Lands a sentinel or stale position on real block and sentence indices of a
 * script. -1 means "first paragraph in view", -2 "the last paragraph", and a
 * -1 sentence "the last sentence of the block".
 */
function concrete(script: ListenScript, paragraph: number, sentence: number) {
  if (paragraph === -1) {
    if (script.blocks[0]?.el) {
      // A fresh start begins at the first paragraph on screen
      const visible = script.blocks.findIndex((b) => b.el!.getBoundingClientRect().bottom > 130);
      paragraph = visible === -1 ? script.blocks.length - 1 : visible;
    } else {
      paragraph = 0; // no screen to look at: the page's first words
    }
    sentence = Math.max(0, sentence);
  }
  if (paragraph === -2) {
    paragraph = script.blocks.length - 1;
    sentence = Math.max(0, sentence);
  }
  paragraph = Math.max(0, Math.min(paragraph, script.blocks.length - 1));
  // The count of sentences depends on which block landed under the position
  const blocks = Math.max(0, script.blocks[paragraph]?.segments.length ?? 0);
  sentence = sentence === -1 ? Math.max(0, blocks - 1) : blocks ? Math.min(sentence, blocks - 1) : 0;
  return { paragraph, sentence };
}

/** Bumps on every interruption, so an in-flight loop can be left behind. */
let session = 0;
let failures = 0;
const scriptWaiters = new Set<() => void>();

function cancelRun() {
  session++;
  window.speechSynthesis?.cancel();
}

function resolveWaiters() {
  for (const waiter of scriptWaiters) waiter();
  scriptWaiters.clear();
}

async function begin(resume: boolean, fromStart = false) {
  if (!speechAvailable()) {
    useListenStore.setState({ status: "error", reason: "unsupported" });
    return;
  }
  const reader = useReaderStore.getState();
  if (!reader.document || !reader.docId) return;

  if (resume) {
    useListenStore.setState({ status: "playing" });
  } else {
    // A fresh start reads from the first paragraph in view, wherever the reader is;
    // a finished book that plays again starts from its first page
    cancelRun();
    const prior = useListenStore.getState().script;
    const page = fromStart ? 1 : reader.currentPage;
    useListenStore.setState({
      status: "playing",
      reason: null,
      bookId: reader.docId,
      page,
      paragraph: -1,
      sentence: 0,
      total: prior?.page === page ? prior.blocks.length : 0,
    });
    if (fromStart) reader.setCurrentPage(1);
  }
  resolveWaiters();

  if (!hasVoices()) {
    const ready = await voicesReady();
    if (!ready) {
      useListenStore.setState({ status: "error", reason: "novoice" });
      releaseWakeLock();
      return;
    }
  }
  acquireWakeLock();
  void run(session);
}

/**
 * Reads the current position and then everything after it, paragraph after
 * paragraph, page after page. Exits whenever the one session token it was
 * born with no longer matches: pause, stop, skip or a closed book.
 */
async function run(token: number) {
  while (true) {
    let st = useListenStore.getState();
    if (token !== session || st.status !== "playing") return;

    // The page's text: as the reader lays it out when it's open, or built from
    // the book's own data as a fallback — that's how listening continues while
    // the reader is elsewhere (library, another sample, the site).
    const reader = useReaderStore.getState();
    const handed =
      st.script && st.script.page === st.page && st.script.docId === st.bookId ? st.script : null;
    const script =
      handed ??
      (st.bookId && reader.docId === st.bookId && reader.document
        ? scriptFromDocument(st.bookId, reader.document, st.page)
        : null);
    if (!script) {
      await new Promise<void>((resolve) => scriptWaiters.add(resolve));
      continue;
    }
    if (script !== st.script) {
      useListenStore.setState({
        script,
        total: script.blocks.length,
        // A handover in place (DOM script replacing the data one) can change
        // block counts; the position stays inside the page either way
        ...concrete(script, st.paragraph, st.sentence),
      });
      st = useListenStore.getState();
    }

    // A position paused on a sentinel (a skip past a page edge) lands on the script
    if (st.paragraph < 0 || st.sentence < 0) {
      useListenStore.setState(concrete(script, st.paragraph, st.sentence));
      continue;
    }

    // End of the page: flow into the next one, or close the book
    if (st.paragraph >= script.blocks.length) {
      const total = reader.document?.totalPages ?? st.page;
      if (st.page >= total) {
        releaseWakeLock();
        useListenStore.setState({ status: "ended", paragraph: 0, sentence: 0 });
        return;
      }
      useListenStore.setState({ page: st.page + 1, paragraph: 0, sentence: 0 });
      // The engine's own advance: the reader follows, and its next script arrives
      reader.setCurrentPage(st.page + 1);
      // Away from the reader nothing else saves the place, so this does
      if (!reader.mounted && st.bookId) {
        void saveReadingPosition(st.bookId, { page: st.page + 1, scrollPosition: 0 });
      }
      continue;
    }

    const block = script.blocks[st.paragraph];
    const segment = block.segments[st.sentence];
    if (!segment) {
      advance(st);
      continue;
    }

    const settings = withDefaults(reader.settings);
    const voice = matchVoice(settings.speakVoiceURI, reader.document?.language);
    const outcome = await speakWith(
      {
        text: segment.text,
        voice,
        lang: voice ? null : (reader.document?.language ?? null),
        rate: settings.speakRate,
      },
      token
    );
    if (outcome !== "ok") return;

    const after = useListenStore.getState();
    if (token !== session || after.status !== "playing") return;
    advance(after);
  }
}

function advance(st: ListenState) {
  const block = st.script?.blocks[st.paragraph];
  if (block && st.sentence + 1 < block.segments.length) useListenStore.setState({ sentence: st.sentence + 1 });
  else useListenStore.setState({ paragraph: st.paragraph + 1, sentence: 0 });
}

async function speakWith(request: SpeakRequest, token: number): Promise<"ok" | "interrupt"> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const outcome = await speak(request);
    const st = useListenStore.getState();
    if (token !== session || st.status !== "playing") return "interrupt";
    if (outcome === "end") {
      failures = 0;
      return "ok";
    }
    // One retry for a watchdog rescue; a voice that fails twice is skipped
    if (++failures >= 6) {
      releaseWakeLock();
      useListenStore.setState({ status: "error", reason: "stalled" });
      return "interrupt";
    }
  }
  return "ok";
}

/** Turns a possibly-sentinel position into real block and sentence indices. */
function landing(st: ListenState, script: ListenScript | null): { paragraph: number; sentence: number } {
  let paragraph = st.paragraph;
  let sentence = st.sentence;
  if (paragraph === -1) paragraph = 0;
  if (paragraph === -2) {
    paragraph = Math.max(0, (script?.blocks.length ?? 1) - 1);
    sentence = -1;
  }
  if (script) {
    paragraph = Math.max(0, Math.min(paragraph, script.blocks.length - 1));
    const blocks = script.blocks[paragraph]?.segments.length ?? 0;
    if (sentence === -1) sentence = Math.max(0, blocks - 1);
    else sentence = blocks ? Math.max(0, Math.min(sentence, blocks - 1)) : 0;
  } else if (sentence < 0) sentence = 0;
  return { paragraph, sentence };
}

/** Applies a position change; a playing queue continues from the new place. */
function refocus(patch: { page?: number; paragraph?: number; sentence?: number }) {
  useListenStore.setState(patch);
  const st = useListenStore.getState();
  if (st.status !== "playing") return;
  cancelRun();
  resolveWaiters();
  void run(session);
}

//
// Following the reader
//

if (typeof window !== "undefined") {
  useReaderStore.subscribe((state, prev) => {
    // Another book opened while listening: stop cleanly
    if (state.docId !== prev.docId) {
      useListenStore.getState().stop();
      return;
    }
    if (state.currentPage === prev.currentPage) return;
    const st = useListenStore.getState();
    if (st.status === "idle" || state.currentPage === st.page) return;
    // Losing a page to the reader's own navigation (go to page, page turn,
    // different pagination) restarts reading from the top of the new page
    if (st.status === "playing") refocus({ page: state.currentPage, paragraph: 0, sentence: 0 });
    else if (st.status === "paused") useListenStore.setState({ page: state.currentPage, paragraph: 0, sentence: 0, total: 0 });
  });

  // Locking the screen or switching tabs pauses rather than pretending
  document.addEventListener("visibilitychange", () => {
    const st = useListenStore.getState();
    if (document.hidden && st.status === "playing") st.pause();
  });
}
