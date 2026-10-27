import { NextResponse, type NextRequest } from "next/server";
import { LIBRARY_COOKIE } from "@/lib/library-cookie";

export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.has("landing")) {
    return;
  }
  if (request.cookies.get(LIBRARY_COOKIE)?.value === "1") {
    return NextResponse.rewrite(new URL("/library", request.url));
  }
}

export const config = { matcher: "/" };
