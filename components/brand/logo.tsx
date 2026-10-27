import { cn } from "@/lib/utils";

/** The page, with its lines cut out (even-odd fill). */
export const MARK_PAGE =
  "M9 2.5H23A2.5 2.5 0 0 1 25.5 5V18C17.8 18 14 21.8 14 29.5H9A2.5 2.5 0 0 1 6.5 27V5A2.5 2.5 0 0 1 9 2.5ZM12 6.9H22A1.1 1.1 0 0 1 22 9.1H12A1.1 1.1 0 0 1 12 6.9ZM10 11.4H22A1.1 1.1 0 0 1 22 13.6H10A1.1 1.1 0 0 1 10 11.4ZM10 15.9H17A1.1 1.1 0 0 1 17 18.1H10A1.1 1.1 0 0 1 10 15.9Z";
/** The corner, lifting. */
export const MARK_CORNER = "M24.8 20.2C18.6 20.4 16.4 22.6 16.2 28.8Z";

/**
 * The Paperless mark: a page of text with its corner lifting, the reader's
 * page turn. Drawn in currentColor on a 32-unit grid; public/icon.svg and the
 * app icons in docs/brand use the same paths.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden className={cn("size-6 shrink-0", className)}>
      <path fillRule="evenodd" d={MARK_PAGE} />
      <path d={MARK_CORNER} />
    </svg>
  );
}
