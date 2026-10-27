import { redirect } from "next/navigation";

// The library is the home screen now; keep old links and installed PWAs working
export default function LibraryRedirect() {
  redirect("/");
}
