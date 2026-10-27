import { generateText, Output } from "ai";
import { z } from "zod";
import { aiAccess } from "@/lib/ai-access";
import { resolveSuggestion, type DiscoverBook } from "@/lib/discover";

export const runtime = "nodejs";
export const maxDuration = 60;

// gemini-flash-latest stalled for minutes when tested; 2.5 Flash answers in seconds.
// Override with DISCOVER_MODEL.
const MODEL = process.env.DISCOVER_MODEL || "gemini-2.5-flash";
const MAX_SUGGESTIONS = 8;
const LOOKUP_BUDGET_MS = 12_000;

const suggestionsSchema = z.object({
  books: z
    .array(
      z.object({
        title: z.string(),
        author: z.string(),
        reason: z.string(),
      })
    )
    .max(MAX_SUGGESTIONS + 2),
});

/**
 * Book recommendations for a request in plain words. The AI only proposes
 * titles; each one is looked up in Open Library and dropped if it isn't
 * there, so a book the model made up never reaches the reader.
 */
export async function POST(req: Request) {
  let prompt: unknown;
  try {
    ({ prompt } = await req.json());
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 600) {
    return Response.json({ error: "Describe what you'd like to read in a sentence or two." }, { status: 400 });
  }

  const access = aiAccess(req, "ask");
  if (!access.ok) return access.response;

  let suggestions: z.infer<typeof suggestionsSchema>["books"];
  try {
    const { output } = await generateText({
      model: access.google(MODEL),
      output: Output.object({ schema: suggestionsSchema }),
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(30000),
      prompt: `Someone is looking for books. Their request:
"""
${prompt.trim()}
"""

Suggest up to ${MAX_SUGGESTIONS} real, published books that fit the request well, best fit first. Prefer well-regarded books over obscure ones, and include classics that are in the public domain when they fit, since those can be read for free. Never invent a book; if unsure a book exists, leave it out.

For each: the exact title as published (without subtitle), the author's name, and one short sentence on why it fits this request, in the language of the request.`,
    });
    suggestions = output.books;
  } catch (err) {
    console.error("[discover/ask]", (err as Error).message);
    return Response.json({ error: "The AI couldn't suggest books right now. Try again." }, { status: 502 });
  }

  // Lookups share a few connections to Open Library; on a slow day, a book
  // still unconfirmed after this long is left out rather than holding the rest
  const lookupDeadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOOKUP_BUDGET_MS));
  const resolved = await Promise.all(
    suggestions
      .slice(0, MAX_SUGGESTIONS)
      .map((s) => Promise.race([resolveSuggestion(s).catch(() => null), lookupDeadline]))
  );

  const seen = new Set<string>();
  const books = resolved.filter((b): b is DiscoverBook => !!b && !seen.has(b.id) && !!seen.add(b.id));
  return Response.json({ books, dropped: suggestions.length - books.length });
}
