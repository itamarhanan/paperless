/**
 * Which page "/" shows. A first visit gets the landing page; once the library
 * has a book, proxy.ts serves the library there instead. The library itself
 * lives in the browser, so it leaves this cookie for the server to read.
 */
export const LIBRARY_COOKIE = "paperless-library";

export function rememberLibrary(hasBooks: boolean) {
  const current = document.cookie.split("; ").includes(`${LIBRARY_COOKIE}=1`);
  if (hasBooks === current) return;
  document.cookie = hasBooks
    ? `${LIBRARY_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
    : `${LIBRARY_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
