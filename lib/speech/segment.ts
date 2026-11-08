/**
 * Splits a paragraph into sentence-sized pieces to feed speech synthesis.
 * Long utterances are unreliable on phones, so anything wider than a short
 * limit splits at a space. The pieces are also the granularity of skipping
 * and of the spoken-word highlight.
 */

export interface Segment {
  text: string;
  /** Character offset of the piece within the paragraph's text. */
  start: number;
  end: number;
}

/** Voices start to misbehave on very long utterances; 200 chars is a safe chunk. */
const MAX_CHARS = 200;

const TERMINATORS = new Set([".", "!", "?", "…", "。", "！", "？"]);
/** CJK terminators close a sentence even without a following space. */
const SELF_SUFFICIENT = new Set(["。", "！", "？"]);
const CLOSERS = new Set(['"', "'", "”", "’", ")", "]", "»", "」", "』"]);

/**
 * Carves a paragraph's text into pieces: full sentences where it can, a
 * fragment at a nearby space (never a straight cut mid-word unless the text
 * is one enormous run, like a URL).
 */
export function segmentParagraph(text: string): Segment[] {
  const sentences: [number, number][] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!TERMINATORS.has(ch)) continue;
    // A dot between digits ("3.14", "fig. 2") is not the end of a sentence
    if (ch === "." && /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) continue;
    if (!SELF_SUFFICIENT.has(ch)) {
      const next = text[i + 1];
      if (next !== undefined && !/\s/.test(next)) continue; // "e.g" without a space
    }
    let end = i + 1;
    // Keep closing quotes and brackets with their sentence
    while (end < text.length && CLOSERS.has(text[end])) end++;
    sentences.push([start, end]);
    start = end;
  }
  if (start < text.length) sentences.push([start, text.length]);

  const segments: Segment[] = [];
  for (const [s, e] of sentences) {
    let a = s;
    let b = e;
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    if (a >= b) continue;
    splitWide(text, a, b, segments);
  }
  return segments;
}

/** A sentence wider than the limit is cut at a nearby space and re-split. */
function splitWide(text: string, a: number, b: number, out: Segment[]) {
  if (b - a <= MAX_CHARS) {
    out.push({ text: text.slice(a, b), start: a, end: b });
    return;
  }
  const limit = Math.min(a + MAX_CHARS, b - 1);
  // Cut strictly inside (a, b): a space may not open the range (trimmed) nor close it,
  // or the recursion would never shrink
  const space = text.lastIndexOf(" ", limit);
  const at = space > a && space + 1 < b ? space + 1 : limit;
  splitWide(text, a, at, out);
  splitWide(text, at, b, out);
}
