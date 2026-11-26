"use client";

import type { MouseEvent, ReactNode } from "react";
import { linkAddress, openUrl } from "../desktop/desktop-open-url";

/**
 * Web addresses in the text of a message (Messages' bubbles, Mail's message pane) as links that
 * open in Safari (`openUrl`, `demos/desktop/desktop-open-url.ts`), never in the desktop page.
 * Only what `linkAddress` accepts becomes a link (absolute http(s) with a host, no user name);
 * anything else, `javascript:` and the like included, stays plain text. The text is never parsed
 * as HTML: a link is built from the text as it is, with `rel="noopener noreferrer"`, and its own
 * navigation is stopped before Safari is asked.
 */

/** What may start a web address in text, up to white space or a character that ends one. */
const CANDIDATE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
/** Punctuation after an address that belongs to the sentence, not to the address. */
const TRAILING = /[.,;:!?)\]}]+$/;

/** A run of text: plain, or a link to `href` (the address `linkAddress` normalised). */
export interface LinkPiece {
  text: string;
  href: string | null;
}

/** `text` cut into plain runs and the web addresses in it; joined, the runs are `text`. */
export function linkPieces(text: string): LinkPiece[] {
  const pieces: LinkPiece[] = [];
  let at = 0;
  for (const match of text.matchAll(CANDIDATE)) {
    const start = match.index ?? 0;
    const raw = match[0].replace(TRAILING, "");
    const href = raw ? linkAddress(raw) : null;
    if (!href) continue;
    if (start > at) pieces.push({ text: text.slice(at, start), href: null });
    pieces.push({ text: raw, href });
    at = start + raw.length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at), href: null });
  return pieces;
}

/** Stop the link's own navigation and ask Safari to open `href` for the application `from`. */
function openInSafari(event: { preventDefault: () => void }, href: string, from: string) {
  event.preventDefault();
  openUrl(href, from);
}

/** `text` with its web addresses as links, for rendering; the text itself when it has none. */
export function linkedText(text: string, from: string): ReactNode {
  const pieces = linkPieces(text);
  if (!pieces.some((piece) => piece.href)) return text;
  return pieces.map((piece, index) => {
    const { href } = piece;
    if (!href) return piece.text;
    return (
      <a
        // biome-ignore lint/suspicious/noArrayIndexKey: the runs of one text never reorder
        key={index}
        href={href}
        rel="noopener noreferrer"
        onClick={(event: MouseEvent<HTMLAnchorElement>) => openInSafari(event, href, from)}
      >
        {piece.text}
      </a>
    );
  });
}

/**
 * The same, for text already in the page as nodes (a message's styled text, rebuilt by
 * `richTextFromHtml`): each web address in a text node becomes a link, built with the DOM's own
 * calls, never from HTML. A link the text held already keeps only an address `linkAddress`
 * accepts, and opens in Safari; one it refuses is unwrapped to its text.
 */
export function linkTextNodes(root: Element, from: string): void {
  const document = root.ownerDocument;
  for (const anchor of [...root.querySelectorAll("a")]) {
    const href = linkAddress(anchor.getAttribute("href"));
    if (!href) {
      anchor.replaceWith(...anchor.childNodes);
      continue;
    }
    anchor.setAttribute("href", href);
    anchor.setAttribute("rel", "noopener noreferrer");
    anchor.removeAttribute("target");
    anchor.addEventListener("click", (event) => openInSafari(event, href, from));
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest("a")) texts.push(node as Text);
  }
  for (const node of texts) {
    const pieces = linkPieces(node.data);
    if (!pieces.some((piece) => piece.href)) continue;
    const fragment = document.createDocumentFragment();
    for (const { text, href } of pieces) {
      if (!href) {
        fragment.append(document.createTextNode(text));
        continue;
      }
      const anchor = document.createElement("a");
      anchor.setAttribute("href", href);
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.textContent = text;
      anchor.addEventListener("click", (event) => openInSafari(event, href, from));
      fragment.append(anchor);
    }
    node.replaceWith(fragment);
  }
}
