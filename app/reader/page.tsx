import { Suspense } from "react";
import { ReaderInterface } from "@/components/reader/reader-interface";
import { PRIVATE_PAGE } from "@/lib/metadata";

// A book open on this device: nothing here for a search engine
export const metadata = PRIVATE_PAGE;

export default function ReaderPage() {
  return (
    <Suspense>
      <ReaderInterface />
    </Suspense>
  );
}
