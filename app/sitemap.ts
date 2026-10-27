import type { MetadataRoute } from "next";
import { PUBLIC_PAGES } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    ...PUBLIC_PAGES.map(({ path }) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "/about" ? 0.8 : path === "/privacy" ? 0.4 : 0.7,
    })),
  ];
}
