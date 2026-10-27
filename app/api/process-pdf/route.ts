export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { epubToPdf } from "@/lib/epub";

const MAX_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20000;

function isEpub(contentType?: string | null, filename?: string) {
  return Boolean(
    contentType?.includes("application/epub+zip") || filename?.toLowerCase().split("?")[0].endsWith(".epub")
  );
}

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

async function respond(buffer: ArrayBuffer, epub: boolean) {
  const body = epub ? new Uint8Array(await epubToPdf(buffer)) : buffer;
  return new NextResponse(body, { headers: { "Content-Type": "application/pdf" } });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const { url: raw } = await request.json().catch(() => ({ url: null }));
      const url = await validateUrl(raw);
      if (typeof url === "string") return fail(url, 400);

      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: "application/pdf, application/epub+zip;q=0.9, */*;q=0.1" },
      }).catch(() => null);
      if (!response) return fail("Couldn't download that file. Check the link and try again.", 502);
      if (!response.ok) return fail(`The website answered with an error (${response.status}).`, 502);

      const buffer = await readCapped(response);
      if (!buffer) return fail("This file is larger than 50 MB.", 413);

      const type = response.headers.get("content-type");
      const epub = isEpub(type, url.pathname);
      const looksLikePdf = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 5))) === "%PDF-";
      if (!epub && !looksLikePdf) return fail("That link isn't a PDF or EPUB file.", 415);

      return respond(buffer, epub);
    }

    if (contentType?.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) return fail("Choose a file to upload.", 400);
      if (file.size > MAX_BYTES) return fail("This file is larger than 50 MB.", 413);
      return respond(await file.arrayBuffer(), isEpub(file.type, file.name));
    }

    return fail("Unsupported request.", 400);
  } catch (error) {
    console.error("[process-pdf]", error);
    return fail("Couldn't convert this file.", 500);
  }
}
