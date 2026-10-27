import type { MetadataRoute } from "next";
import { PUBLIC_PAGES } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

/** The pages anyone can read. The reader and each book exist only on a reader’s own device. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 0.8 },
    ...PUBLIC_PAGES.map(({ path }) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "/about" ? 1 : path === "/privacy" ? 0.4 : 0.7,
    })),
  ];
}
