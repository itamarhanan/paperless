"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useListenStore } from "@/lib/store/listen-store";
import { useReaderStore } from "@/lib/store/reader-store";
import { cn } from "@/lib/utils";
import { listenAnnouncement, listenMessage, StopListeningButton, Transport } from "./reader/listen-transport";

/**
 * Listening outside the reader. When a book reads itself while its reader is
 * closed — browsing the library or just reading a web page — this quiet chip
 * carries the transport, opens the book again, and steps aside inside it.
 */
export function ListenMiniPlayer() {
  const pathname = usePathname();
  const status = useListenStore((s) => s.status);
  const reason = useListenStore((s) => s.reason);
  const page = useListenStore((s) => s.page);
  const bookId = useListenStore((s) => s.bookId);
  const title = useReaderStore((s) => s.document?.title ?? null);
  const total = useReaderStore((s) => s.document?.totalPages ?? 0);

  if (!pathname || pathname === "/reader" || status === "idle") return null;

  const message = listenMessage(status, reason);
  const at = total ? `Page ${page} of ${total}` : null;

  return (
    <div
      data-listen-mini
      role="group"
      aria-label="Currently listening"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-3 lg:inset-x-auto lg:right-6 lg:left-auto lg:bottom-6 lg:px-0"
    >
      <div className="bar-glass pointer-events-auto flex h-12 w-full max-w-md items-center gap-1 rounded-full border pl-2 pr-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)] lg:w-auto lg:max-w-sm">
        {message ? (
          <>
            <p className="min-w-0 flex-1 truncate pl-3 pr-1 text-[0.8125rem]">{message}</p>
            <StopListeningButton />
          </>
        ) : (
          <>
            <Transport compact />
            <BackToBook bookId={bookId} title={title} at={at} />
            <StopListeningButton />
          </>
        )}
      </div>
      <span className="sr-only" role="status">
        {listenAnnouncement(status, reason, message)}
      </span>
    </div>
  );
}

/** The book's name and place on the page, and the way back into its reader. */
function BackToBook({ bookId, title, at }: { bookId: string | null; title: string | null; at: string | null }) {
  const className = "group min-w-0 flex-1 px-2 text-left hover:opacity-80";
  const inner = (
    <>
      <span className="block truncate text-[0.8125rem] font-medium leading-4">
        {title ?? "The book"}
      </span>
      {at && (
        <span className="tabular block text-[0.6875rem] leading-4 text-muted-foreground">{at}</span>
      )}
    </>
  );
  if (!bookId) return <span className={cn(className, "px-2")}>{inner}</span>;
  return (
    <Link href={`/reader?id=${encodeURIComponent(bookId)}`} aria-label="Back to the book" className={className}>
      {inner}
    </Link>
  );
}
