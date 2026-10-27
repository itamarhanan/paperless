import { NextResponse, type NextRequest } from "next/server";
import { LIBRARY_COOKIE } from "@/lib/library-cookie";

/** Readers with books get their library at "/"; everyone else gets the landing page. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.has("landing")) {
    return;
  }
  if (request.cookies.get(LIBRARY_COOKIE)?.value === "1") {
    return NextResponse.rewrite(new URL("/library", request.url));
  }
}

export const config = { matcher: "/" };
