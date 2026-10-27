import { gutenbergHtml } from "@/lib/discover";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Downloads a Project Gutenberg book as HTML for the browser to import.
 * Only Gutenberg ids are accepted, so this can't fetch anything else.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^\d{1,6}$/.test(id)) return Response.json({ error: "Invalid book id" }, { status: 400 });

  try {
    const response = await fetch(gutenbergHtml(Number(id)), {
      headers: { "User-Agent": "Paperless reader (personal use)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      return Response.json(
        { error: response.status === 404 ? "This book isn't available as a web page." : "Project Gutenberg didn't respond." },
        { status: 502 }
      );
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return Response.json({ error: "This book is too large." }, { status: 413 });
    const html = await response.text();
    if (html.length > MAX_BYTES) return Response.json({ error: "This book is too large." }, { status: 413 });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return Response.json({ error: "Project Gutenberg didn't respond. Try again." }, { status: 502 });
  }
}
