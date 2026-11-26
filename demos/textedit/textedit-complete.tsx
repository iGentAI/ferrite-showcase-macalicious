"use client";

import { createPortal } from "react-dom";

/*
 * Edit > Complete: the words that finish the one before the insertion point, from the document and
 * the word list of the spelling tools, in a list at the insertion point.
 */

/** The most completions the list shows. */
const MOST_COMPLETIONS = 12;
const WORD_END = /[\p{L}\p{M}][\p{L}\p{M}'’]*$/u;
const WORD = /[\p{L}\p{M}][\p{L}\p{M}'’]*/gu;

/** The word that ends at the insertion point of a text view: empty with a selection or no word. */
export function wordBeforeCaret(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement) {
    if (element.selectionStart !== element.selectionEnd) return "";
    return WORD_END.exec(element.value.slice(0, element.selectionStart))?.[0] ?? "";
  }
  const selection = element.ownerDocument.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range?.collapsed || !element.contains(range.startContainer)) return "";
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType !== 3) return "";
  return WORD_END.exec((startContainer.nodeValue ?? "").slice(0, startOffset))?.[0] ?? "";
}

/** The words of `text`, then those of `list`, that finish `prefix`, in its capitalization. */
export function completionsOf(
  prefix: string,
  text: string,
  list: Iterable<string>,
  most = MOST_COMPLETIONS,
): string[] {
  const start = prefix.toLowerCase();
  const capital = prefix[0] !== prefix[0]?.toLowerCase();
  const inCase = (word: string) =>
    capital ? `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}` : word;
  const found = new Map<string, string>();
  const add = (word: string) => {
    const lower = word.toLowerCase();
    if (lower.length > start.length && lower.startsWith(start) && !found.has(lower)) {
      found.set(lower, `${prefix}${inCase(word).slice(prefix.length)}`);
    }
  };
  for (const [word] of text.matchAll(WORD)) add(word);
  const known: string[] = [];
  for (const word of list) if (word.startsWith(start)) known.push(word);
  known.sort((a, b) => a.length - b.length || a.localeCompare(b));
  for (const word of known) add(word);
  return [...found.values()].slice(0, most);
}

/** Where the list stands: under the insertion point, in the page's coordinates. */
export function caretPlace(element: HTMLElement): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  if (element instanceof HTMLTextAreaElement) {
    const before = element.value.slice(0, element.selectionStart).split("\n");
    const style = getComputedStyle(element);
    const line = Number.parseFloat(style.lineHeight) || 14;
    const size = Number.parseFloat(style.fontSize) || 11;
    return {
      x: box.left + 5 + (before.at(-1)?.length ?? 0) * size * 0.6,
      y: box.top + before.length * line - element.scrollTop,
    };
  }
  const range = element.ownerDocument.getSelection()?.getRangeAt(0);
  const rect = range?.getClientRects?.()[0];
  return rect ? { x: rect.left, y: rect.bottom } : { x: box.left, y: box.top };
}

/** The words offered, the one marked, and the place of the list. */
export interface TextEditCompleting {
  prefix: string;
  items: readonly string[];
  at: number;
  place: { x: number; y: number };
}

/** What a key does to the list: another completion, the marked one, or the list goes. */
export function completionKey(
  key: string,
  completing: TextEditCompleting,
): { at: number } | "choose" | "close" {
  const { at, items } = completing;
  if (key === "ArrowDown") return { at: (at + 1) % items.length };
  if (key === "ArrowUp") return { at: (at - 1 + items.length) % items.length };
  return key === "Enter" || key === "Tab" ? "choose" : "close";
}

/** The list of completions: the keyboard stays in the text, so a press does not take it away. */
export function TextEditCompletions({
  completing,
  host,
  onChoose,
}: {
  completing: TextEditCompleting;
  host: HTMLElement;
  onChoose: (word: string) => void;
}) {
  return createPortal(
    <div
      role="listbox"
      aria-label="Completions"
      className="mac-textedit-completions"
      style={{ left: completing.place.x, top: completing.place.y }}
    >
      {completing.items.map((word, at) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the arrow keys and Return in the text choose; the keyboard stays there
        <div
          key={word}
          role="option"
          tabIndex={-1}
          aria-selected={at === completing.at}
          data-selected={at === completing.at ? "" : undefined}
          className="mac-textedit-completion"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onChoose(word)}
        >
          {word}
        </div>
      ))}
    </div>,
    host,
  );
}
