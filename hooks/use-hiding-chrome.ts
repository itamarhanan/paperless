"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long after touch, wheel or key input a scroll still counts as the reader's. */
const INPUT_WINDOW_MS = 1000;

/** On desktop, moving the pointer this close to the top brings the toolbar back. */
const REVEAL_EDGE_PX = 72;

/**
 * Toolbars step aside while reading and come back when people scroll up,
 * reach either end of the page, tap, or (with a mouse) point at the top edge
 * (toolbars.md › Best practices). Programmatic scrolling (restoring a
 * position, jumping to a match) is ignored.
 */
export function useHidingChrome(enabled: boolean) {
  const [hidden, setHidden] = useState(false);
  // Turned off (a panel opened): show the toolbar again, adjusting during render
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) setHidden(false);
  }
  const lastY = useRef(0);
  const lastInput = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    if (!enabled) return;
    lastY.current = window.scrollY;
    let frame = 0;

    const markInput = () => {
      lastInput.current = performance.now();
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        const byReader = performance.now() - lastInput.current < INPUT_WINDOW_MS;
        const nearTop = y < 64;
        const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 96;

        if (nearTop || nearBottom) setHidden(false);
        else if (byReader && delta > 8) setHidden(true);
        else if (byReader && delta < -8) setHidden(false);
        if (!byReader || Math.abs(delta) > 8) lastY.current = y;
      });
    };

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.clientY < REVEAL_EDGE_PX) setHidden(false);
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchmove", markInput, { passive: true });
    window.addEventListener("wheel", markInput, { passive: true });
    window.addEventListener("keydown", markInput);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchmove", markInput);
      window.removeEventListener("wheel", markInput);
      window.removeEventListener("keydown", markInput);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled]);

  const toggle = useCallback(() => setHidden((h) => !h), []);
  const show = useCallback(() => setHidden(false), []);

  return { hidden: enabled && hidden, toggle, show };
}
