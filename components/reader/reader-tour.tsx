"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { useReaderStore } from "@/lib/store/reader-store";
import { useTour } from "./reader-tour-store";

/**
 * A short guided tour of the reader, one control at a time (onboarding.md).
 * Each step points at the real control and moves on when the reader uses it;
 * Next moves on without it. The card is nonmodal: the page and every control
 * stay usable, and it steps aside while a panel it pointed to is open.
 */

type StepId = "welcome" | "contents" | "appearance" | "page" | "library";

interface Context {
  desktop: boolean;
  sidebarOpen: boolean;
}

interface Step {
  id: StepId;
  /** The `data-tour` name of the control to ring. */
  target?: string;
  title: string;
  body: (ctx: Context) => string;
}

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Reading in Paperless",
    body: () =>
      "Paperless took the text out of this book’s file and set it in pages that fit your screen. AI can tidy the layout of a page, but it never changes the words.",
  },
  {
    id: "contents",
    target: "contents",
    title: "Contents",
    body: ({ desktop, sidebarOpen }) =>
      desktop
        ? sidebarOpen
          ? "The sidebar lists the chapters and your bookmarks. Select one to jump there."
          : "Open the sidebar to see the chapters and your bookmarks. Select one to jump there."
        : "Open Contents to see the chapters and your bookmarks. Tap one to jump there.",
  },
  {
    id: "appearance",
    target: "appearance",
    title: "Text size",
    body: ({ desktop }) =>
      `${desktop ? "Select" : "Tap"} Aa to make the text bigger or smaller. The font and theme are there too.`,
  },
  {
    id: "page",
    target: "next-page",
    title: "Turning pages",
    body: ({ desktop }) =>
      desktop
        ? "Select Next at the end of a page to turn it, or press the right arrow key. Your place is saved as you go."
        : "Tap Next at the end of a page to turn it. Your place is saved as you go.",
  },
  {
    id: "library",
    target: "library",
    title: "Your own books",
    body: () => "Add a PDF, an EPUB or a link in the Library. To see this tour again, choose Show the tour in the More menu.",
  },
];

const EDGE = 12;
const GAP = 12;
const RING_PAD = 4;
const CARD_WIDTH = 352;
const MIN_CARD_HEIGHT = 96;

interface Ring {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

interface Layout {
  ring: Ring | null;
  card: CSSProperties;
}

function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height) return el;
  }
  return null;
}

/** The space between the toolbars, where the card may go. */
function readingArea() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const topBar = document.querySelector("[data-reader-bar=top]")?.getBoundingClientRect();
  const bottomBar = document.querySelector("[data-reader-bar=bottom]")?.getBoundingClientRect();
  return {
    vw,
    vh,
    topBar,
    bottomBar,
    top: Math.max(0, topBar?.bottom ?? 0) + GAP,
    bottom: Math.min(vh, bottomBar?.top ?? vh) - GAP,
  };
}

/** Where the ring and card go: the card beside the target, never over the toolbars. */
function measure(target: string | undefined): Layout {
  const area = readingArea();
  const { vw, vh, topBar, bottomBar } = area;
  const width = Math.min(CARD_WIDTH, vw - EDGE * 2);
  // With a bottom toolbar (phones) the card is nearly full width: keep it centred
  const leftFor = (center: number) =>
    bottomBar ? Math.round((vw - width) / 2) : Math.round(Math.min(Math.max(center - width / 2, EDGE), vw - width - EDGE));
  const fit = (room: number) => Math.max(MIN_CARD_HEIGHT, Math.round(room));

  const el = target ? findTarget(target) : null;
  if (!el) {
    // Nothing to point at: above the toolbar on a phone; beside the text's first
    // lines on a wide screen, clear of the page turn at the end
    return {
      ring: null,
      card: bottomBar
        ? { width, left: leftFor(vw / 2), bottom: Math.round(vh - area.bottom), maxHeight: fit(area.bottom - area.top) }
        : { width, left: Math.max(EDGE, vw - width - EDGE), top: area.top, maxHeight: fit(area.bottom - area.top) },
    };
  }

  const r = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  // Inside the window, so a control at the very edge keeps its whole ring
  const top = Math.max(2, r.top - RING_PAD);
  const left = Math.max(2, r.left - RING_PAD);
  const bottom = Math.min(vh - 2, r.bottom + RING_PAD);
  const right = Math.min(vw - 2, r.right + RING_PAD);
  const ring: Ring = {
    top: Math.round(top),
    left: Math.round(left),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
    radius: Math.min(radius + RING_PAD, (bottom - top) / 2),
  };

  const inTopBar = !!topBar && r.bottom <= topBar.bottom + 1;
  const inBottomBar = !!bottomBar && r.top >= bottomBar.top - 1;
  const roomAbove = top - GAP - area.top;
  const roomBelow = area.bottom - bottom - GAP;
  const above = !inTopBar && (inBottomBar || roomAbove >= roomBelow);

  let card: CSSProperties;
  if (above) {
    const anchor = Math.min(top - GAP, area.bottom);
    card = { bottom: Math.round(vh - anchor), maxHeight: fit(anchor - area.top) };
  } else {
    const anchor = Math.max(bottom + GAP, area.top);
    card = { top: Math.round(anchor), maxHeight: fit(area.bottom - anchor) };
  }
  // A wide target (the page turn) keeps its start, and the text above it, in view
  const x = !bottomBar && r.width > width ? Math.round(Math.max(EDGE, Math.min(r.right - width, vw - width - EDGE))) : leftFor(r.left + r.width / 2);
  return { ring, card: { ...card, width, left: x } };
}

// ========== TOUR ==========

export function ReaderTour({ desktop }: { desktop: boolean }) {
  const step = useTour((s) => s.step);
  if (step === null) return null;
  return <TourCard step={step} desktop={desktop} />;
}

function TourCard({ step, desktop }: { step: number; desktop: boolean }) {
  const panel = useReaderStore((s) => s.panel);
  const chatOpen = useReaderStore((s) => s.chatOpen);
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const goTo = useTour((s) => s.goTo);
  const end = useTour((s) => s.end);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const body = current.body({ desktop, sidebarOpen });
  // A panel or sheet the tour pointed to is open: step aside until it closes
  const hidden = panel !== null || (!desktop && chatOpen);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const countId = useId();
  const [layout, setLayout] = useState<Layout | null>(null);

  // Later steps are announced; the first is read when the card takes focus
  const [announced, setAnnounced] = useState<number | null>(null);
  const [lastStep, setLastStep] = useState(step);
  if (lastStep !== step) {
    setLastStep(step);
    setAnnounced(step);
  }

  const finish = () => {
    // Focus stays in the reader rather than falling to the page's start
    if (dialogRef.current?.contains(window.document.activeElement)) {
      window.document.getElementById("reader-text")?.focus({ preventScroll: true });
    }
    end();
  };

  // Focus the card when it first shows, so it's read out and in reach of the keyboard
  const shown = !hidden && !!layout;
  const focused = useRef(false);
  useEffect(() => {
    if (!shown || focused.current) return;
    let frame = 0;
    const tryFocus = () => {
      // Started from the More menu: wait until it has closed and handed focus back
      if (window.document.querySelector("[role=menu]")) {
        frame = requestAnimationFrame(tryFocus);
        return;
      }
      focused.current = true;
      dialogRef.current?.focus({ preventScroll: true });
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  // Teach by doing: the step moves on when the reader uses the control
  useEffect(() => {
    const start = useReaderStore.getState();
    const base = { page: start.currentPage, sidebar: start.sidebarOpen };
    let opened = false;
    const advance = () => goTo(step + 1);
    const id = STEPS[step].id;

    return useReaderStore.subscribe((s) => {
      if (id === "contents") {
        if (desktop && s.sidebarOpen !== base.sidebar) advance();
        else if (!desktop && s.panel === "contents") opened = true;
        else if (!desktop && opened && s.panel === null) advance();
      } else if (id === "appearance") {
        // Moves on once the panel closes, so the card never covers it
        if (s.panel === "appearance") opened = true;
        else if (opened && s.panel === null) advance();
      } else if (id === "page") {
        if (s.currentPage !== base.page) advance();
      }
    });
  }, [step, desktop, goTo]);

  // The page turn sits at the end of the page: bring it into view
  useEffect(() => {
    if (hidden || STEPS[step].id !== "page") return;
    const el = findTarget("next-page");
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Low in the reading area, leaving the room above it for the card
    const delta = r.bottom + RING_PAD - readingArea().bottom;
    if (Math.abs(delta) < 8) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
  }, [step, hidden]);

  // Follow the target as the page lays out, scrolls and resizes
  useEffect(() => {
    if (hidden) return;
    let frame = 0;
    let previous = "";
    const tick = () => {
      const next = measure(STEPS[step].target);
      const key = JSON.stringify(next);
      if (key !== previous) {
        previous = key;
        setLayout(next);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step, hidden]);

  // Escape skips, unless it is closing a menu, popover or sheet first
  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (window.document.querySelector("[role=menu], [data-slot=popover-content]")) return;
      finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announced !== null && `Step ${announced + 1} of ${STEPS.length}. ${STEPS[announced].title}. ${body}`}
      </p>

      {!hidden && layout?.ring && (
        <div
          key={step}
          aria-hidden
          className="tour-ring pointer-events-none fixed z-50 animate-in fade-in-0 zoom-in-95 duration-300"
          style={{
            top: layout.ring.top,
            left: layout.ring.left,
            width: layout.ring.width,
            height: layout.ring.height,
            borderRadius: layout.ring.radius,
          }}
        />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${countId} ${titleId}`}
        aria-describedby={bodyId}
        tabIndex={-1}
        hidden={hidden || !layout}
        className="fixed z-50 flex flex-col overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none animate-in fade-in-0 slide-in-from-bottom-1 duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={layout?.card}
      >
        <div className="flex min-h-6 items-center justify-between gap-2">
          <p id={countId} className="tabular text-[0.8125rem] text-muted-foreground">
            <span className="sr-only">Reader tour, step </span>
            {step + 1} of {STEPS.length}
          </p>
          {!last && (
            <Button variant="ghost" className="-my-1.5 -mr-3 text-muted-foreground pointer-coarse:-my-2.5" onClick={finish}>
              Skip
            </Button>
          )}
        </div>
        <h2 id={titleId} className="mt-1 text-[1.0625rem] font-semibold leading-snug">
          {current.title}
        </h2>
        <p id={bodyId} className="mt-1 text-[0.9375rem] leading-normal text-muted-foreground">
          {body}
        </p>
        <div className="mt-4 flex justify-end">
          <Button className="min-w-20" onClick={() => (last ? finish() : goTo(step + 1))}>
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </>
  );
}
