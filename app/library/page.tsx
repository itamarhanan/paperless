import { redirect } from "next/navigation";
import { PRIVATE_PAGE } from "@/lib/metadata";

export const metadata = PRIVATE_PAGE;

// The library is the home screen now; keep old links and installed PWAs working
export default function LibraryRedirect() {
  redirect("/");
}
