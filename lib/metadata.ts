import type { Metadata } from "next";

/** The public pages, in the order a reader would go through them. Used by the sitemap and the site's navigation. */
export const PUBLIC_PAGES = [
  { path: "/about", label: "About" },
  { path: "/how-it-works", label: "How it works" },
  { path: "/discover", label: "Discover" },
  { path: "/privacy", label: "Privacy" },
] as const;

/**
 * Title, description, canonical address and link preview for one public page.
 * Next.js replaces nested fields like openGraph rather than merging them, so
 * each page sets the whole preview here, including the image that
 * app/opengraph-image draws.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** Use the title as given, without the “· Paperless” suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  const shareTitle = absoluteTitle ? title : `${title} · Paperless`;
  const images = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Paperless: a reader for the books you already have" }];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Paperless",
      title: shareTitle,
      description,
      url: path,
      images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
}

/** For pages that only make sense on one device: a book open in the reader, a redirect. */
export const PRIVATE_PAGE: Metadata = {
  robots: { index: false, follow: false },
};
