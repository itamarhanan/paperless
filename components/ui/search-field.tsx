"use client";

import type { DetailedHTMLProps, InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A search input with a leading icon; the rest of the input's props pass through. */
export function SearchField({
  icon: Icon,
  className,
  ...input
}: {
  icon: LucideIcon;
} & DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) {
  return (
    <div className="relative flex-1">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        className={cn(
          "h-11 w-full rounded-lg bg-muted pl-9 pr-3 text-[1.0625rem] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-fine:h-10 pointer-fine:text-[0.9375rem]",
          className,
        )}
        {...input}
      />
    </div>
  );
}
