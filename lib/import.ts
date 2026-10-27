import { processEpub } from "./epub-processor";
import { processHtmlBook } from "./html-processor";
import { MAX_FILE_BYTES, processPdf, titleFromFilename, type ProcessedDocument, type ReaderSettings } from "./pdf-processor";

type Progress = (fraction: number) => void;

/**
 * Every way a book gets into the library. Files are read in the browser;
 * links and Gutenberg books are downloaded through the server only because
 * other sites don't allow the browser to fetch them directly.
 */

const isZip = (data: ArrayBuffer) => {
  const head = new Uint8Array(data, 0, 2);
  return head[0] === 0x50 && head[1] === 0x4b;
};

async function read(data: ArrayBuffer, settings: ReaderSettings, fallbackTitle: string, onProgress?: Progress) {
  if (isZip(data)) {
    onProgress?.(0.5);
    return processEpub(data, settings, fallbackTitle);
  }
  return processPdf(data, settings, { fallbackTitle, onProgress });
}

/** A PDF or EPUB chosen or dropped by the reader. */
export async function readFile(file: File, settings: ReaderSettings, onProgress?: Progress): Promise<ProcessedDocument> {
  if (file.size > MAX_FILE_BYTES) throw new Error("This file is larger than 50 MB. Try a smaller file.");
  return read(await file.arrayBuffer(), settings, titleFromFilename(file.name), onProgress);
}

/** A direct link to a PDF or EPUB. */
export async function readUrl(url: string, settings: ReaderSettings, onProgress?: Progress): Promise<ProcessedDocument> {
  onProgress?.(0.05);
  const response = await fetch("/api/fetch-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Couldn’t download that file."));
  const data = await response.arrayBuffer();

  let fallbackTitle = "Untitled";
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    if (name) fallbackTitle = titleFromFilename(name);
  } catch {
    // Keep the default title
  }
  return read(data, settings, fallbackTitle, (f) => onProgress?.(0.3 + f * 0.7));
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
