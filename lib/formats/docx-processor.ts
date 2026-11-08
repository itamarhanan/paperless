import { unzipSync } from "fflate";
import { processHtmlBook } from "../html-processor";
import type { ProcessedDocument, ReaderSettings } from "../pdf-processor";
import { byName, escapeHtml, parseXml } from "./xml";
import type { ZipFiles } from "./types";

/**
 * Reads a Word .docx file in the browser. A docx is a zip of XML: the text
 * lives in word/document.xml, its styles in word/styles.xml and its metadata
 * in docProps/core.xml. The document is walked and rebuilt as HTML, which the
 * HTML pipeline already knows how to read — headings, italics, bold, lists and
 * tables survive; pictures, headers, footers, comments and footnote references
 * don't, yet. Nothing leaves the device.
 */

const decoder = new TextDecoder();

const docError = () => new Error("This Word file is damaged or isn’t a .docx document.");

/** Direct children by local name, whatever namespace prefix they carry. */
const kids = (el: Element, name: string): Element[] =>
  [...el.children].filter((child) => child.localName === name);

const first = (el: Element | undefined, name: string) => el && kids(el, name)[0];

/** Why a paragraph style is a heading, 1-6: by the style's name or its id, with Title and Subtitle baked in. */
function headingLevels(styles: Document | null): Map<string, number> {
  const levels = new Map<string, number>();
  for (const style of styles ? byName(styles, "style") : []) {
    const id = style.getAttribute("w:styleId") ?? "";
    const name = (first(style, "name")?.getAttribute("w:val") ?? "").toLowerCase();
    const out = /^heading\s*(\d+)$/.exec(name)?.[1] ?? /^heading(\d+)$/i.exec(id)?.[1];
    if (out) levels.set(id, Math.min(6, Math.max(1, Number(out))));
    else if (name === "title") levels.set(id, 1);
    else if (name === "subtitle") levels.set(id, 2);
  }
  return levels;
}

/** Italic (1) or bold (2) on a run, including the complex-script flags. */
function runStyle(run: Element): number {
  const rPr = first(run, "rPr");
  const on = (name: string) => {
    const flag = rPr && first(rPr, name);
    return !!flag && !/^(false|0)$/i.test(flag.getAttribute("w:val") ?? "");
  };
  return ((on("i") || on("iCs") ? 1 : 0) | (on("b") || on("bCs") ? 2 : 0)) as 0 | 1 | 2 | 3;
}

/**
 * The inline content of a paragraph: runs of text, tabs and line breaks, with
 * italic and bold wrapped as elements. Pictures, comments, footnote references
 * and deleted (tracked-changes) text don't belong in the reading flow.
 */
function inlineHtml(container: Element): string {
  let html = "";
  for (const node of container.children) {
    switch (node.localName) {
      case "r": {
        let inner = "";
        for (const part of node.children) {
          if (part.localName === "t") inner += escapeHtml(part.textContent ?? "");
          else if (part.localName === "tab") inner += " ";
          else if (part.localName === "br" || part.localName === "cr") inner += "<br />";
        }
        if (!inner) break;
        const style = runStyle(node);
        const wrapped = style & 2 ? `<strong>${inner}</strong>` : inner;
        html += style & 1 ? `<em>${wrapped}</em>` : wrapped;
        break;
      }
      // TOC lines and plain links: processHtmlBook filters a contents table whose text is all links
      case "hyperlink": {
        const anchor =
          node.getAttribute("w:anchor") ??
          node.getAttribute("anchor") ??
          node.getAttribute("r:id") ??
          "document";
        html += `<a href="#${escapeHtml(anchor)}">${inlineHtml(node)}</a>`;
        break;
      }
      case "br":
      case "cr":
        html += "<br />";
        break;
      case "tab":
        html += " ";
        break;
      // tracked insertions, fields and inline content controls hold runs of their own
      case "ins":
      case "smartTag":
      case "sdt":
      case "fldSimple":
        html += inlineHtml(node);
        break;
    }
  }
  return html;
}

/** Whether a paragraph is a list item (numId 0 means "no numbering"). */
function isListItem(pPr: Element | undefined): boolean {
  const numPr = first(pPr, "numPr");
  if (!numPr) return false;
  return first(numPr, "numId")?.getAttribute("w:val") !== "0";
}

/** Heading level for a style id alone, when styles.xml is missing or silent. */
function headingForStyleId(styleId: string): number | undefined {
  const out = /^heading(\d+)$/i.exec(styleId)?.[1];
  if (out) return Math.min(6, Math.max(1, Number(out)));
  if (/^title$/i.test(styleId)) return 1;
  if (/^subtitle$/i.test(styleId)) return 2;
  return undefined;
}

/**
 * A paragraph as HTML: a heading when its style says so, a list item when it
 * carries a numbering marker, otherwise prose. `html` may be empty; `item`
 * still tells the caller it sits inside a list.
 */
function paragraphHtml(
  paragraph: Element,
  levels: Map<string, number>
): { html: string; item: boolean } {
  const pPr = first(paragraph, "pPr");
  const styleId = first(pPr, "pStyle")?.getAttribute("w:val") ?? "";
  const content = inlineHtml(paragraph);
  const item = isListItem(pPr);
  if (!content.trim()) return { html: "", item };

  const level = levels.get(styleId) ?? headingForStyleId(styleId);
  if (level) return { html: `<h${level}>${content}</h${level}>`, item: false };
  return { html: item ? `<li>${content}</li>` : `<p>${content}</p>`, item };
}

/** A table's rows and cells; processHtmlBook reads each cell as a paragraph. */
function tableHtml(table: Element, levels: Map<string, number>): string {
  const rows = kids(table, "tr").map((tr) =>
    kids(tr, "tc")
      .map((tc) => `<td>${blocksHtml(tc, levels)}</td>`)
      .join("")
  );
  return `<table>${rows.map((cells) => `<tr>${cells}</tr>`).join("")}</table>`;
}

/**
 * The block-level content of a container: paragraphs (with consecutive list
 * items grouped), tables, and textboxes from content controls and title-page
 * text frames, whose fallback is the plain-text copy.
 */
function blocksHtml(container: Element, levels: Map<string, number>): string {
  let html = "";
  let listOpen = false;
  const closeList = () => {
    if (listOpen) html += "</ul>";
    listOpen = false;
  };

  for (const node of container.children) {
    switch (node.localName) {
      case "p": {
        const { html: paragraph, item } = paragraphHtml(node, levels);
        if (item) {
          if (!listOpen) { html += "<ul>"; listOpen = true; }
          html += paragraph;
        } else {
          closeList();
          html += paragraph;
        }
        break;
      }
      case "tbl":
        closeList();
        html += tableHtml(node, levels);
        break;
      // content controls wrap whole sections of modern Word documents
      case "sdt":
        closeList();
        html += first(node, "sdtContent") ? blocksHtml(first(node, "sdtContent")!, levels) : "";
        break;
      // drawings prefer their drawn form but always keep a plain-text fallback
      case "AlternateContent": {
        closeList();
        const fallback = first(node, "Fallback");
        for (const box of fallback ? byName(fallback, "txbxContent") : [])
          html += blocksHtml(box, levels);
        break;
      }
      default:
        // unknown containers that hold paragraphs of their own recurse; the rest is markup
        if (byName(node, "p").length || byName(node, "tbl").length) {
          closeList();
          html += blocksHtml(node, levels);
        }
    }
  }
  closeList();
  return html;
}

/** Reads a Word document into a ProcessedDocument, via the HTML pipeline. */
export function processDocx(
  data: ArrayBuffer,
  settings: ReaderSettings,
  fallbackTitle: string
): ProcessedDocument {
  let files: ZipFiles;
  try {
    files = unzipSync(new Uint8Array(data));
  } catch {
    throw docError();
  }
  const documentSource = files["word/document.xml"] && decoder.decode(files["word/document.xml"]);
  const doc = documentSource ? parseXml(documentSource) : null;
  const body = doc ? byName(doc, "body")[0] : null;
  if (!body) throw docError();

  // pStyle refs a style id; its name may be localised, so headings resolve through styles.xml,
  // which also covers custom styles derived from Heading N
  const styles = files["word/styles.xml"] ? parseXml(decoder.decode(files["word/styles.xml"])) : null;
  const levels = headingLevels(styles);

  const core = files["docProps/core.xml"] ? parseXml(decoder.decode(files["docProps/core.xml"])) : null;
  const title = (core && byName(core, "title")[0]?.textContent?.replace(/\s+/g, " ").trim()) || fallbackTitle;

  const html = `<section>${blocksHtml(body, levels)}</section>`;
  return processHtmlBook(html, settings, { title, skipTitleHeading: false });
}
