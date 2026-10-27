import { unzipSync } from "fflate";
import { processHtmlBook } from "./html-processor";
import type { ProcessedDocument, ReaderSettings } from "./pdf-processor";

/**
 * Reads an EPUB in the browser. An EPUB is a zip of XHTML chapters plus a
 * package file listing them in reading order, so the chapters are joined into
 * one HTML document and read like any other HTML book: real headings, the
 * book's italics, quotes and verse. Nothing leaves the device.
 */

type Files = Record<string, Uint8Array>;

const decoder = new TextDecoder();
const text = (files: Files, path: string) => (files[path] ? decoder.decode(files[path]) : null);

function parseXml(source: string): Document {
  const doc = new DOMParser().parseFromString(source, "application/xml");
  // Some books ship invalid XHTML; the HTML parser forgives what XML doesn't
  return doc.querySelector("parsererror") ? new DOMParser().parseFromString(source, "text/html") : doc;
}

/** Resolves an href relative to the file that contains it, inside the zip. */
function resolve(base: string, href: string): string {
  const parts = base.split("/").slice(0, -1);
  for (const part of decodeURIComponent(href.split("#")[0]).split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

/** Elements by local name, whatever namespace prefix the book uses (dc:title, opf:item…). */
const byName = (root: ParentNode, name: string) =>
  [...root.querySelectorAll("*")].filter((el) => el.localName === name);

/** Chapter titles from the book's own contents (EPUB 3 nav or EPUB 2 NCX), first one per file. */
function contentsTitles(files: Files, opfPath: string, opf: Document): Map<string, string> {
  const titles = new Map<string, string>();
  const items = byName(opf, "item");
  const nav = items.find((i) => /\bnav\b/.test(i.getAttribute("properties") ?? ""));
  const ncx = items.find((i) => i.getAttribute("media-type") === "application/x-dtbncx+xml");

  if (nav) {
    const path = resolve(opfPath, nav.getAttribute("href") ?? "");
    const source = text(files, path);
    if (source) {
      const doc = parseXml(source);
      const toc = byName(doc, "nav").find((n) => /toc/.test(n.getAttribute("epub:type") ?? n.getAttribute("type") ?? "")) ?? byName(doc, "nav")[0];
      for (const a of toc ? byName(toc, "a") : []) {
        const target = resolve(path, a.getAttribute("href") ?? "");
        const label = a.textContent?.replace(/\s+/g, " ").trim();
        if (label && !titles.has(target)) titles.set(target, label);
      }
    }
  }
  if (!titles.size && ncx) {
    const path = resolve(opfPath, ncx.getAttribute("href") ?? "");
    const source = text(files, path);
    if (source) {
      for (const point of byName(parseXml(source), "navPoint")) {
        const label = byName(point, "text")[0]?.textContent?.replace(/\s+/g, " ").trim();
        const src = byName(point, "content")[0]?.getAttribute("src");
        if (!label || !src) continue;
        const target = resolve(path, src);
        if (!titles.has(target)) titles.set(target, label);
      }
    }
  }
  return titles;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function processEpub(
  data: ArrayBuffer,
  settings: ReaderSettings,
  fallbackTitle: string
): ProcessedDocument {
  let files: Files;
  try {
    files = unzipSync(new Uint8Array(data));
  } catch {
    throw new Error("This EPUB file is damaged or isn’t an EPUB.");
  }

  const container = text(files, "META-INF/container.xml");
  const opfPath = container && byName(parseXml(container), "rootfile")[0]?.getAttribute("full-path");
  const opfSource = opfPath && text(files, opfPath);
  if (!opfPath || !opfSource) throw new Error("This EPUB file is damaged or isn’t an EPUB.");
  // Obfuscated fonts are harmless; DRM-encrypted chapters can't be read
  const encryption = text(files, "META-INF/encryption.xml") ?? "";
  if (/\.x?html?"/i.test(encryption)) {
    throw new Error("This EPUB is protected with DRM, so it can’t be opened here.");
  }

  const opf = parseXml(opfSource);
  const title = byName(opf, "title")[0]?.textContent?.trim() || fallbackTitle;
  const language = byName(opf, "language")[0]?.textContent?.trim() || undefined;

  const manifest = new Map(byName(opf, "item").map((i) => [i.getAttribute("id") ?? "", i]));
  const titles = contentsTitles(files, opfPath, opf);

  const sections: string[] = [];
  for (const ref of byName(opf, "itemref")) {
    if (ref.getAttribute("linear") === "no") continue; // notes and asides outside the reading order
    const item = manifest.get(ref.getAttribute("idref") ?? "");
    if (!item || /\bnav\b/.test(item.getAttribute("properties") ?? "")) continue;
    const path = resolve(opfPath, item.getAttribute("href") ?? "");
    const source = text(files, path);
    if (!source) continue;
    const body = parseXml(source).querySelector("body");
    if (!body) continue;
    // Chapters marked only by styling get their title from the book's contents
    const hasHeading = !!body.querySelector("h1, h2, h3, h4");
    const label = titles.get(path);
    const heading = !hasHeading && label ? `<h2>${escapeHtml(label)}</h2>` : "";
    sections.push(`<section>${heading}${body.innerHTML}</section>`);
  }
  if (!sections.length) throw new Error("This EPUB has no readable chapters.");

  const html = `<!doctype html><html${language ? ` lang="${escapeHtml(language)}"` : ""}><body>${sections.join("\n")}</body></html>`;
  return processHtmlBook(html, settings, { title, language, skipTitleHeading: false });
}
