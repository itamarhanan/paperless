import type { Metadata } from "next";
import { Library } from "@/components/library/library";

// Title, description and preview come from the root layout
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <Library />;
}
