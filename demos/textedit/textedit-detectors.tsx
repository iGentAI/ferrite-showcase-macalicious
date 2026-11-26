"use client";

import { MenuSeparator } from "macalicious/menu-item";
import { type DetectedPiece, DetectedRows, detectedPieces } from "../messages/messages-detectors";

/*
 * Edit > Substitutions > Data Detectors: the actions on an address, a date or a phone number in the
 * document, offered in the menu of a secondary click on it. What counts as one is Messages' detectors.
 */

type Detected = DetectedPiece & { kind: NonNullable<DetectedPiece["kind"]> };

/** The first run the detectors find in `text` that the characters from `start` to `end` touch. */
export function detectedAt(text: string, start: number, end: number): Detected | null {
  let at = 0;
  for (const piece of detectedPieces(text)) {
    const after = at + piece.text.length;
    if (piece.kind && start <= after && end >= at) return piece as Detected;
    at = after;
  }
  return null;
}

const BLOCKS = "div, p, li, td, h1, h2, h3, h4, h5, h6, blockquote, pre";

function rangeAtPoint(target: Document, point: { x: number; y: number }): Range | null {
  const place = target.caretPositionFromPoint?.(point.x, point.y);
  if (!place) return target.caretRangeFromPoint?.(point.x, point.y) ?? null;
  const range = target.createRange();
  range.setStart(place.offsetNode, place.offset);
  return range;
}

/**
 * What the detectors find where a secondary click landed in `element`: on the selection when there is
 * one, else at the click's `point`, else at the insertion point. In a plain text view, whose characters
 * a point cannot name, at its selection.
 */
export function detectedInView(
  element: HTMLElement,
  point: { x: number; y: number } | null,
): Detected | null {
  if (element instanceof HTMLTextAreaElement) {
    const { value, selectionStart: start, selectionEnd: end } = element;
    const from = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.indexOf("\n", end);
    return detectedAt(value.slice(from, next < 0 ? value.length : next), start - from, end - from);
  }
  const target = element.ownerDocument;
  const selection = target.getSelection();
  const held =
    selection?.rangeCount && element.contains(selection.anchorNode)
      ? selection.getRangeAt(0)
      : null;
  const clicked = point && (!held || held.collapsed) ? rangeAtPoint(target, point) : null;
  const range = clicked && element.contains(clicked.startContainer) ? clicked : held;
  if (!range) return null;
  const holder = range.startContainer;
  const block = (holder instanceof Element ? holder : holder.parentElement)?.closest(BLOCKS);
  if (!block || !element.contains(block)) return null;
  const before = target.createRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return detectedAt(block.textContent ?? "", start, start + range.toString().length);
}

/** The rows for what was found, ahead of the menu's others. */
export function DetectedItems({ found }: { found: Detected | null }) {
  if (!found) return null;
  const { text, kind } = found;
  return (
    <>
      <DetectedRows text={text} kind={kind} from="textedit" copyLabel={`Copy “${text}”`} />
      <MenuSeparator />
    </>
  );
}
