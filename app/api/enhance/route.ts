import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_INPUT = 14000;
const MAX_PARAGRAPHS = 120;
const MAX_PASSAGES = 2;

// A "-latest" alias follows Google's current lite model, so a retired version
// (as happened with gemma-3-27b-it) doesn't break cleanup. Override with CLEANUP_MODEL.
const MODEL = process.env.CLEANUP_MODEL || "gemini-flash-lite-latest";

const KINDS = ["heading", "text", "quote", "list", "caption", "drop"] as const;

const requestSchema = z.object({
  title: z.string().max(300).optional(),
  paragraphs: z
    .array(z.object({ id: z.number().int().nonnegative(), text: z.string(), kind: z.string().max(20).optional() }))
    .min(1)
    .max(MAX_PARAGRAPHS),
});

// The model answers with ids and labels only. It never writes the book's text,
// so it can't paraphrase or translate it; passages must be copied exactly.
const resultSchema = z.object({
  labels: z
    .array(
      z.object({
        id: z.number().int(),
        kind: z.enum(KINDS),
        level: z.number().int().min(1).max(3).optional(),
        joinNext: z.boolean().optional(),
      })
    )
    .max(MAX_PARAGRAPHS),
  passages: z.array(z.object({ id: z.number().int(), text: z.string() })).max(4),
});

export async function POST(req: Request) {
  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Expected { paragraphs: [{ id, text, kind? }] }" }, { status: 400 });
  }
  const size = input.paragraphs.reduce((n, p) => n + p.text.length, 0);
  if (size > MAX_INPUT) {
    return Response.json({ error: "Page is too long to check" }, { status: 413 });
  }

  const byId = new Map(input.paragraphs.map((p) => [p.id, p]));
  const listing = input.paragraphs.map((p) => `[${p.id}] (${p.kind ?? "text"}) ${p.text}`).join("\n\n");

  try {
    const { output: object } = await generateText({
      model: google(MODEL),
      output: Output.object({ schema: resultSchema }),
      temperature: 0.1,
      prompt: `You check the layout of one page of a book${input.title ? ` ("${input.title}")` : ""} whose text was extracted from a PDF. Each paragraph has an id and the label the extraction gave it: heading N (1 chapter, 2 section, 3 subsection), text, quote, attribution (the credit under a quote).

PAGE:
${listing}

1. LABELS. List only paragraphs whose label is wrong, with the right one:
- heading (with level): a title that was taken for text.
- text: a paragraph wrongly labelled heading or quote.
- quote: an epigraph, block quote or verse that was taken for text.
- list: an item of a bulleted or numbered list.
- caption: a figure or table caption.
- drop: not part of the book's text: page numbers, running headers, stray symbols or glyph codes, figure and chart labels, image placeholders, watermarks, file or version names, contents-page leaders.
- joinNext: true on a text paragraph that stops mid-sentence and continues in the next paragraph.
When unsure, leave the paragraph out. Most pages need no changes; return an empty list then.

2. PASSAGES. Up to ${MAX_PASSAGES} sentences a careful reader would underline: the page's central idea or most memorable line. Copy each one exactly, character for character, from a single paragraph, with that paragraph's id. Never shorten, fix, translate or rephrase it. Return none for front matter, lists, or pages without a clear key idea.`,
    });

    const labels = object.labels.filter(
      (l) => byId.has(l.id) && !(l.kind === "heading" && byId.get(l.id)!.text.length > 160)
    );
    const passages = object.passages
      .filter((p) => {
        const source = byId.get(p.id)?.text;
        return !!source && p.text.length >= 20 && p.text.length <= 400 && source.includes(p.text);
      })
      .slice(0, MAX_PASSAGES);

    return Response.json({ labels, passages });
  } catch (err) {
    console.error("[enhance]", (err as Error).message);
    return Response.json({ error: "The AI couldn't check this page" }, { status: 502 });
  }
}
