import { importBytes } from "./formats/registry";
import { processHtmlBook } from "./html-processor";
import type { ProcessedDocument, ReaderSettings } from "./pdf-processor";

type Progress = (fraction: number) => void;

/**
 * Every way a book gets into the library. Transports here — files, links,
 * Gutenberg — only fetch bytes; which format those bytes are is the registry's
 * decision. Files are read in the browser; links and Gutenberg books are
 * downloaded through the server only because other sites don't allow the
 * browser to fetch them directly.
 */

/** A file chosen or dropped by the reader; the format is sniffed, not assumed. */
export async function readFile(file: File, settings: ReaderSettings, onProgress?: Progress): Promise<ProcessedDocument> {
  return importBytes(await file.arrayBuffer(), { name: file.name, settings, onProgress });
}

/** A direct link to one of the supported formats. */
export async function readUrl(url: string, settings: ReaderSettings, onProgress?: Progress): Promise<ProcessedDocument> {
  onProgress?.(0.05);
  const response = await fetch("/api/fetch-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Couldn’t download that file."));
  const data = await response.arrayBuffer();

  let name: string | undefined;
  try {
    name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "") || undefined;
  } catch {
    // The format is sniffer's business, not the link's
  }
  return importBytes(data, { name, settings, onProgress: (f) => onProgress?.(0.3 + f * 0.7) });
}

/** A free book from Project Gutenberg, read from its HTML edition. */
export async function readGutenberg(id: number, title: string, settings: ReaderSettings): Promise<ProcessedDocument> {
  const response = await fetch(`/api/discover/gutenberg?id=${id}`);
  if (!response.ok) throw new Error(await errorMessage(response, "Couldn’t download this book."));
  return processHtmlBook(await response.text(), settings, { title });
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === "string") return data.error;
  } catch {
    // Not JSON
  }
  return fallback;
}
