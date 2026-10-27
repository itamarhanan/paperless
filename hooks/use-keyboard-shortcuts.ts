"use client";

import { useEffect, useRef } from "react";

interface Shortcuts {
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onSearch?: () => void;
}

/** Elements that use arrow keys or typing themselves. */
function ownsKeyboard(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest("input, textarea, select, [role=slider], [role=menu], [role=menuitem], [role=listbox], [role=radiogroup], [role=tablist], [role=dialog]")) {
    return true;
  }
  return false;
}

/**
 * Reader shortcuts. ← → turn pages and / opens search. Modified keys are
 * left alone so system and browser shortcuts (⌘F, ⌘T…) keep working.
 */
export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  const ref = useRef(shortcuts);
  ref.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (ownsKeyboard(e.target)) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          ref.current.onNextPage?.();
          break;
        case "ArrowLeft":
          e.preventDefault();
          ref.current.onPrevPage?.();
          break;
        case "/":
          e.preventDefault();
          ref.current.onSearch?.();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
