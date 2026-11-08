"use client";

import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useListenStore, type ListenStatus } from "@/lib/store/listen-store";
import { cn } from "@/lib/utils";

export const LISTEN_END_MESSAGE = "The end of the book.";

export const LISTEN_REASONS: Record<string, string> = {
  unsupported: "This browser can’t speak text.",
  novoice: "No speaking voices are installed on this device.",
  stalled: "Reading stopped unexpectedly. Try listening again.",
};

/** The one-line notice a player shows in place of its controls. */
export function listenMessage(status: ListenStatus, reason: string | null): string | null {
  return reason ? LISTEN_REASONS[reason] : status === "ended" ? LISTEN_END_MESSAGE : null;
}

/** What screen readers say when the status changes. */
export function listenAnnouncement(status: ListenStatus, reason: string | null, message: string | null): string {
  if (message) return message;
  if (reason) return LISTEN_REASONS[reason] ?? "Reading is unavailable";
  switch (status) {
    case "playing":
      return "Reading aloud.";
    case "paused":
      return "Paused.";
    case "ended":
      return "Finished the book.";
    default:
      return "";
  }
}

/**
 * Play, previous sentence, next sentence. Shared by the reader's players and
 * the mini player that keeps listening alive outside the reader.
 */
export function Transport({ compact }: { compact?: boolean }) {
  const status = useListenStore((s) => s.status);
  const reason = useListenStore((s) => s.reason);
  const toggle = useListenStore((s) => s.toggle);
  const skip = useListenStore((s) => s.skip);
  const atEnd = status === "ended";
  const stuck = !!reason;

  const round = cn(
    "flex items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent active:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
  );

  return (
    <>
      <button
        type="button"
        disabled={stuck || atEnd}
        aria-label="Back one sentence"
        onClick={() => skip(-1)}
        className={cn(round, "size-9")}
      >
        <SkipBack className="size-5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        disabled={stuck}
        aria-label={status === "playing" ? "Pause" : "Listen"}
        onClick={toggle}
        className={cn(
          round,
          compact ? "size-10" : "size-10",
          "bg-secondary text-secondary-foreground hover:bg-accent"
        )}
      >
        {status === "playing" ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <button
        type="button"
        disabled={stuck || atEnd}
        aria-label="Forward one sentence"
        onClick={() => skip(1)}
        className={cn(round, "size-9")}
      >
        <SkipForward className="size-5" strokeWidth={1.75} />
      </button>
    </>
  );
}

/** The round, quiet way to dismiss reading, shared by every player. */
export function StopListeningButton({ className }: { className?: string }) {
  const stop = useListenStore((s) => s.stop);
  return (
    <button
      type="button"
      aria-label="Stop listening"
      onClick={stop}
      className={cn(
        "flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className ?? "size-9"
      )}
    >
      <X className="size-5" strokeWidth={1.75} />
    </button>
  );
}
