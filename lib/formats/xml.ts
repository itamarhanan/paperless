/**
 * XML plumbing shared by the zip-of-XML formats (EPUB, DOCX), which all feed
 * an HTML book into processHtmlBook afterwards.
 */

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function parseXml(source: string): Document {
  const doc = new DOMParser().parseFromString(source, "application/xml");
  // Some books ship invalid XHTML; the HTML parser forgives what XML doesn't
  return doc.querySelector("parsererror") ? new DOMParser().parseFromString(source, "text/html") : doc;
}

/** Elements by local name, whatever namespace prefix the file uses (dc:title, w:p…). */
export const byName = (root: ParentNode, name: string) =>
  [...root.querySelectorAll("*")].filter((el) => el.localName === name);
