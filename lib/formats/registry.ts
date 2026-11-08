import { processPdf } from "../pdf-processor";
import { processEpub } from "../epub-processor";
import { processDocx } from "./docx-processor";
import { entryText, headStartsWith, tryUnzip } from "./detect";
import { MAX_FILE_BYTES, SUPPORTED, titleFromFilename, type FormatId } from "./supported";
import type { FormatAdapter, ParseContext, SniffContext, ZipFiles } from "./types";

/**
 * Every format Paperless reads. A format describes itself — how to recognise
 * it by content, which names it comes as, how bytes become a document — so
 * supporting one more is one new adapter here, not edits across the app.
 */

/** Adapters in this repo, in their own files that only import parser code. */
type AdapterStore = Record<FormatId, FormatAdapter>;

export const pdfAdapter: FormatAdapter = {
  ...SUPPORTED[0],
  sniff: ({ head }) => (headStartsWith(head, "%PDF-") ? 1 : 0),
  parse: (data, { settings, fallbackTitle, onProgress }) =>
    processPdf(data, settings, { fallbackTitle, onProgress }),
};

export const epubAdapter: FormatAdapter = {
  ...SUPPORTED[1],
  sniff: ({ head, unzip }) => {
    if (!(head[0] === 0x50 && head[1] === 0x4b)) return 0;
    const files = unzip();
    const mark = files ? entryText(files, "mimetype") : null;
    if (mark === "application/epub+zip") return 1;
    if (files && files["META-INF/container.xml"]) return 0.6; // EPUBs from odd tools lack the mimetype entry
    return 0;
  },
  parse: async (data, { settings, fallbackTitle }) => processEpub(data, settings, fallbackTitle),
};

export const docxAdapter: FormatAdapter = {
  ...SUPPORTED[2],
  sniff: ({ head, unzip }) => {
    if (!(head[0] === 0x50 && head[1] === 0x4b)) return 0;
    const files = unzip();
    if (!files) return 0;
    return /wordprocessingml/.test(entryText(files, "[Content_Types].xml") ?? "") ? 1 : 0;
  },
  parse: async (data, { settings, fallbackTitle }) => processDocx(data, settings, fallbackTitle),
};

const adapters: AdapterStore = {
  pdf: pdfAdapter,
  epub: epubAdapter,
  docx: docxAdapter,
};

export const adapterById = (id: FormatId) => adapters[id];

const badFileError = () => new Error("Paperless opens PDF, EPUB and Word documents.");

/**
 * Which format these bytes are, without parsing: adapters sniff in undefined
 * order and the most confident wins, so extensions and names are never
 * trusted.
 */
export function resolveFormat(
  data: ArrayBuffer,
  name?: string
): { adapter: FormatAdapter; files: ZipFiles | null } | null {
  const candidates = Object.values(adapters);
  let files: ZipFiles | null = null;
  let unzipped = false;
  const unzip = () => {
    if (!unzipped) {
      files = tryUnzip(data);
      unzipped = true;
    }
    return files;
  };
  const head = new Uint8Array(data, 0, Math.min(8, data.byteLength));
  const ctx: SniffContext = { head, unzip, name };

  let best: FormatAdapter | null = null;
  let confidence = 0;
  for (const adapter of candidates) {
    const score = adapter.sniff(ctx);
    if (score > confidence) {
      best = adapter;
      confidence = score;
    }
  }
  return best ? { adapter: best, files } : null;
}

/**
 * Bytes to a document, whatever format they claim to be: the sniffer decides,
 * the adapter parses. The 50 MB cap guards both the download path and files.
 */
export async function importBytes(
  data: ArrayBuffer,
  { name, settings, onProgress }: { name?: string; settings: ParseContext["settings"]; onProgress?: ParseContext["onProgress"] }
) {
  // the cap comes first: no sniffer pays to open an oversized file
  if (data.byteLength > MAX_FILE_BYTES) {
    throw new Error("This file is larger than 50 MB. Try a smaller file.");
  }
  const found = resolveFormat(data);
  if (!found) throw badFileError();
  return found.adapter.parse(data, { settings, fallbackTitle: titleFromFilename(name ?? ""), onProgress });
}
