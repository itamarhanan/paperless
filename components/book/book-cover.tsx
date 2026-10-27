"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A book's cover tile: the real cover image when there is one, otherwise the
 * title set small like a spine. Size, radius and padding come from the caller.
 */
export function BookCover({
  title,
  image,
  progress,
  lines = 3,
  className,
}: {
  title: string;
  image?: string;
  /** How far into the book, 0–1, shown as a thin line at the bottom. */
  progress?: number;
  lines?: 3 | 4;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className={cn("relative flex shrink-0 items-end overflow-hidden border bg-surface-raised shadow-xs", className)}
    >
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className={cn("font-serif text-muted-foreground", lines === 4 ? "line-clamp-4" : "line-clamp-3")}>
          {title}
        </span>
      )}
      {progress !== undefined && progress > 0 && (
        <span
          className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground"
          style={{ width: `${progress * 100}%` }}
        />
      )}
    </span>
  );
}
