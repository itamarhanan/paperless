import { Suspense } from "react";
import type { Metadata } from "next";
import { BookDetails } from "@/components/book/book-details";

export const metadata: Metadata = { title: "Book details", robots: { index: false, follow: false } };

export default function BookPage() {
  return (
    <Suspense>
      <BookDetails />
    </Suspense>
  );
}
