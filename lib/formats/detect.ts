import { unzipSync } from "fflate";
import type { ZipFiles } from "./types";

/**
 * Recognising formats by their contents, not their names. PDF starts "%PDF-";
 * EPUB, DOCX and the other zip families all start "PK", so they are told apart
 * by the entries inside the zip. Pure JS, so the browser, a worker and the
 * server route all reach the same verdict.
 */

const decoder = new TextDecoder();

export const headStartsWith = (head: Uint8Array, text: string) =>
  decoder.decode(head.subarray(0, text.length)) === text;

export const entryText = (files: ZipFiles, path: string) =>
  files[path] ? decoder.decode(files[path]).trim() : null;

/** Unzip once; null when the bytes aren't the zip the sniffer hoped for. */
export function tryUnzip(data: ArrayBuffer): ZipFiles | null {
  try {
    return unzipSync(new Uint8Array(data));
  } catch {
    return null;
  }
}

/** Which zip family these entries belong to: epub by its mimetype entry, docx by its content types. */
export function sniffZipFormat(files: ZipFiles): "epub" | "docx" | null {
  if (entryText(files, "mimetype") === "application/epub+zip") return "epub";
  const contentTypes = entryText(files, "[Content_Types].xml");
  if (contentTypes) {
    if (/wordprocessingml/.test(contentTypes)) return "docx";
    // EPUBs from odd tools may lack the mimetype entry
    if (files["META-INF/container.xml"]) return "epub";
  }
  return null;
}

/** The format of these bytes, without any parser involved. */
export function detectFormat(data: ArrayBuffer): "pdf" | "epub" | "docx" | null {
  const head = new Uint8Array(data, 0, Math.min(8, data.byteLength));
  if (headStartsWith(head, "%PDF-")) return "pdf";
  if (!(head[0] === 0x50 && head[1] === 0x4b)) return null; // "PK"
  const files = tryUnzip(data);
  return files ? sniffZipFormat(files) : null;
}
