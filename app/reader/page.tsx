import { Suspense } from "react";
import { ReaderInterface } from "@/components/reader/reader-interface";

export default function ReaderPage() {
  return (
    <Suspense>
      <ReaderInterface />
    </Suspense>
  );
}
