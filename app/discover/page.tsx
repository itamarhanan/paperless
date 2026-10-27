import { Suspense } from "react";
import { Discover } from "@/components/discover/discover";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Discover free books",
  description:
    "Search Open Library and Project Gutenberg, or describe what you’d like to read and get suggestions checked against Open Library. Free Gutenberg books open straight in the reader.",
  path: "/discover",
});

export default function DiscoverPage() {
  return (
    <Suspense>
      <Discover />
    </Suspense>
  );
}
