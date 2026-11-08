import { segmentParagraph, type Segment } from "./segment";

export interface ScriptBlock {
  /** The block's element, when the page is rendered. Only exists so a fresh
   * read can start where the reader is looking; scripts built from the
   * document's data come without one. */
  el?: HTMLElement;
  /** The block's text as one string; segments index into it. */
  text: string;
  /** A DOM range for [start, end) of the text, wherever it sits in the markup. */
  locate?: (start: number, end: number) => Range | null;
  segments: Segment[];
}

export interface ListenScript {
  docId: string;
  page: number;
  /** The page's render identity: changes when the layout is swapped in place (AI cleanup). */
  key: string;
  blocks: ScriptBlock[];
}

/**
 * Collects the rendered page's paragraphs, headings and list items, ready to
 * be spoken. The text is taken from the DOM, not the document data, so the
 * voice always reads exactly what is on screen.
 */
export function collectScript(docId: string, page: number, layout: string, root: HTMLElement): ListenScript {
  const blocks: ScriptBlock[] = [];
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue;
    // Lists are spoken as their items; a table is spoken row by row
    const pieces = child.matches("ul, ol, table") ? Array.from(child.children) : [child];
    for (const piece of pieces) {
      if (!(piece instanceof HTMLElement)) continue;
      const block = record(piece);
      if (block) blocks.push(block);
    }
  }
  return { docId, page, key: `${docId}:${page}:${layout}`, blocks };
}

function record(el: HTMLElement): ScriptBlock | null {
  const nodes: { node: Text; start: number }[] = [];
  let text = "";
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push({ node: node as Text, start: text.length });
    text += node.textContent ?? "";
  }
  const segments = segmentParagraph(text);
  if (!segments.length) return null; // an <hr>, or an image-only block

  const at = (offset: number) => {
    let k = nodes.length - 1;
    while (k > 0 && nodes[k].start > offset) k--;
    return { node: nodes[k].node, offset: Math.min(offset - nodes[k].start, nodes[k].node.data.length) };
  };
  const locate = (start: number, end: number) => {
    const s = at(start);
    const e = at(end);
    if (s.offset > e.offset && s.node !== e.node) return null; // guard against odd round trips
    const range = new Range();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    return range;
  };
  return { el, text, locate, segments };
}
