import type { Metadata } from "next";
import { Library } from "@/components/library/library";
import { PRIVATE_PAGE } from "@/lib/metadata";

// One reader's own books: nothing for a search engine. "/" shows this page too once there are books (proxy.ts).
export const metadata: Metadata = { ...PRIVATE_PAGE, title: "Library" };

export default function LibraryPage() {
  return <Library />;
}
