import { pageIndices, type ProcessedDocument } from "@/lib/pdf-processor";
import { segmentParagraph } from "./segment";
import type { ListenScript, ScriptBlock } from "./script";

/**
 * Builds a page's script from the document's own data instead of a rendered
 * page. This is how the voice keeps reading when the reader isn't open —
 * browsing the library or elsewhere while a book reads itself. When the
 * reader comes back, its DOM handover takes over again.
 */
export function scriptFromDocument(
  docId: string,
  document: ProcessedDocument,
  page: number
): ListenScript | null {
  const processed = document.pages[page - 1];
  if (!processed) return null;
  const blocks: ScriptBlock[] = [];
  for (const index of pageIndices(document, processed)) {
    const text = document.rawParagraphs[index]?.trim();
    if (!text) continue;
    blocks.push({ text, segments: segmentParagraph(text) });
  }
  if (!blocks.length) return null;
  return { docId, page, key: `${docId}:${page}:data`, blocks };
}
