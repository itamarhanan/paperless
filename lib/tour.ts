/**
 * The guided tour of the reader, shown once with the sample book. Skipping
 * and finishing both count as seen; the reader's More menu replays it.
 */
export const TOUR_KEY = "paperless:tour-seen";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    // Storage unavailable: nothing to remember it by
    return false;
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    // Private mode: it may show again next visit
  }
}

export function resetTour() {
  try {
    localStorage.removeItem(TOUR_KEY);
  } catch {
    // Nothing stored
  }
}
