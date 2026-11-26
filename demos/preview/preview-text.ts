"use client";

import { piecesMatching } from "./preview-markup";

/**
 * Reading a PDF's text layer (`mac-preview-app-page-text`, laid out by pdf.js) in the browser: the
 * boxes of what is selected, and of what is found, as fractions of the page shown.
 */

/** A box on a page shown, as fractions of it. */
export interface ShownBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const LAYER = ".mac-preview-app-page-text";

function boxesOf(range: Range, page: DOMRect): ShownBox[] {
  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .map((rect) => ({
      left: (rect.left - page.left) / Math.max(page.width, 1),
      top: (rect.top - page.top) / Math.max(page.height, 1),
      right: (rect.right - page.left) / Math.max(page.width, 1),
      bottom: (rect.bottom - page.top) / Math.max(page.height, 1),
    }));
}

/** What is selected of the text under `root`, page by page, its words and the boxes they cover. */
export function selectedOnPages(
  root: HTMLElement | null,
): { page: number; words: string; boxes: ShownBox[] }[] {
  const selection = root?.ownerDocument.getSelection();
  if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return [];
  const range = selection.getRangeAt(0);
  const found: { page: number; words: string; boxes: ShownBox[] }[] = [];
  for (const layer of root.querySelectorAll<HTMLElement>(LAYER)) {
    if (!range.intersectsNode(layer)) continue;
    const leaf = layer.closest<HTMLElement>("[data-page]");
    if (!leaf) continue;
    const part = root.ownerDocument.createRange();
    part.selectNodeContents(layer);
    if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) {
      part.setStart(range.startContainer, range.startOffset);
    }
    if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) {
      part.setEnd(range.endContainer, range.endOffset);
    }
    const boxes = boxesOf(part, leaf.getBoundingClientRect());
    if (boxes.length > 0) {
      found.push({ page: Number(leaf.dataset.page), words: part.toString(), boxes });
    }
  }
  return found;
}

/** The boxes `needle` stands in on the text layer `layer` of the page `leaf`. */
export function foundBoxes(layer: HTMLElement, leaf: HTMLElement, needle: string): ShownBox[] {
  const nodes: Text[] = [];
  const walker = layer.ownerDocument.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const page = leaf.getBoundingClientRect();
  return piecesMatching(
    nodes.map((node) => node.data),
    needle,
  ).flatMap(({ from, to }) => {
    const start = nodes[from[0]];
    const end = nodes[to[0]];
    if (!start || !end) return [];
    const range = layer.ownerDocument.createRange();
    range.setStart(start, from[1]);
    range.setEnd(end, to[1]);
    return boxesOf(range, page);
  });
}
