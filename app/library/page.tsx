import type { Metadata } from "next";
import { Library } from "@/components/library/library";
import { PRIVATE_PAGE } from "@/lib/metadata";

export const metadata: Metadata = { ...PRIVATE_PAGE, title: "Library" };

export default function LibraryPage() {
  return <Library />;
}
