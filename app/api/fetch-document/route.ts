export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { USER_AGENT } from "@/lib/site";

const MAX_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a === "::1" || a === "::") return true;
    if (a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80")) return true;
    const mapped = a.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Only public http(s) URLs: this endpoint must not reach the server's own network. */
async function validateUrl(raw: unknown): Promise<URL | string> {
  if (typeof raw !== "string" || !raw.trim()) return "Enter a link to a PDF or EPUB.";
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "That doesn't look like a valid link.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Only http and https links are supported.";
  try {
    const addresses = await lookup(url.hostname, { all: true });
    if (addresses.some((a) => isPrivateAddress(a.address))) return "That address isn't reachable from Paperless.";
  } catch {
    return "Couldn't find that website.";
  }
  return url;
}

async function readCapped(response: Response): Promise<ArrayBuffer | null> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return null;
  if (!response.body) return new ArrayBuffer(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

/**
 * Follows redirects by hand so every hop is checked: file hosts (Internet
 * Archive, Dropbox, Drive) redirect to their storage servers, and a redirect
 * must not lead into a private network.
 */
async function fetchFollowing(start: URL): Promise<Response | string | null> {
  let url = start;
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { Accept: "application/pdf, application/epub+zip;q=0.9, */*;q=0.1", "User-Agent": USER_AGENT },
    }).catch(() => null);
    if (!response) return null;
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return response;
    const next = await validateUrl(new URL(location, url).href);
    if (typeof next === "string") return next;
    url = next;
  }
  return "That link redirects too many times.";
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const { url: raw } = await request.json().catch(() => ({ url: null }));
      const url = await validateUrl(raw);
      if (typeof url === "string") return fail(url, 400);

      const response = await fetchFollowing(url);
      if (typeof response === "string") return fail(response, 400);
      if (!response) return fail("Couldn't download that file. Check the link and try again.", 502);
      if (!response.ok) return fail(`The website answered with an error (${response.status}).`, 502);

      const buffer = await readCapped(response);
      if (!buffer) return fail("This file is larger than 50 MB.", 413);

      // Judge by the bytes: servers often send PDFs and EPUBs as octet-stream
      const head = new Uint8Array(buffer.slice(0, 5));
      const isPdf = new TextDecoder().decode(head) === "%PDF-";
      const isZip = head[0] === 0x50 && head[1] === 0x4b; // "PK": an EPUB is a zip
      if (!isPdf && !isZip) return fail("That link isn't a PDF or EPUB file.", 415);

      return new NextResponse(buffer, {
        headers: { "Content-Type": isPdf ? "application/pdf" : "application/epub+zip" },
      });
    }

    return fail("Unsupported request.", 400);
  } catch (error) {
    console.error("[fetch-document]", error);
    return fail("Couldn't download that file.", 500);
  }
}
