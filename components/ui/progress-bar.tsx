import { cn } from "@/lib/utils";

/** A thin bar that fills as reading advances or a book is being added. */
export function ProgressBar({
  value,
  label,
  className,
  fillClassName,
}: {
  /** How full the bar is, 0–100. */
  value: number;
  /** Accessible name; with one the bar is announced as a progressbar. */
  label?: string;
  className?: string;
  fillClassName?: string;
}) {
  return (
    <div
      className={cn("h-1 flex-1 overflow-hidden rounded-full", className)}
      {...(label
        ? { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(value) }
        : {})}
    >
      <div
        className={cn("h-full transition-[width] duration-200", fillClassName)}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
