/** The public address, for links, previews and identifying ourselves to other services. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

/** Open Library and Project Gutenberg ask apps to say who they are and where to find them. */
export const USER_AGENT = `Paperless/1.0 (+${SITE_URL})`;
