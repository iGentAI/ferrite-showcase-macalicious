/**
 * Keeping the selection of an editable text view across a rebuild of its content, such as a
 * document read again after another window changed it: the selection as character offsets into
 * the text of the view's text nodes, and the selection put back at those offsets, moved by what
 * changed in the text before them.
 */

/** A selection in a view's text: character offsets into the text of its text nodes. */
export interface TextSelection {
  /** Where the selection starts, in characters from the start of the text. */
  start: number;
  /** Where it ends: `start` for an insertion point. */
  end: number;
  /** The text the offsets count in, as it was when the selection was read. */
  text: string;
}

/** The text of `root`'s text nodes, in order: what a range's `toString()` counts. */
function textOf(root: Node): string {
  const document = root.ownerDocument ?? (root as Document);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) text += node.nodeValue ?? "";
  return text;
}

/**
 * The document's selection as offsets into the text of `root`, or `null` when the selection is not
 * wholly inside `root`.
 */
export function readTextSelection(root: Node): TextSelection | null {
  const document = root.ownerDocument;
  const selection = document?.getSelection();
  if (!document || !selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length, text: textOf(root) };
}

/**
 * Where `needle` occurs in `text` nearest the index `near`, or -1 when it does not occur.
 */
function nearest(text: string, needle: string, near: number): number {
  let best = -1;
  for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
    if (best < 0 || Math.abs(at - near) < Math.abs(best - near)) best = at;
  }
  return best;
}

/**
 * Where the character offset `offset` of the text `before` is in the text `after`. Where the two
 * texts begin alike it stays, and where they end alike it moves by the change in length. Between
 * those, where the text may have changed in several separate places, the text around the offset is
 * looked for in `after`, the most of it first, nearest where the offset would be; when none of it
 * is found, the offset goes to where the change begins.
 */
export function mapTextOffset(before: string, after: string, offset: number): number {
  const at = Math.max(0, Math.min(offset, before.length));
  if (before === after) return at;
  const shortest = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shortest && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  if (at <= prefix) return at;
  if (at >= before.length - suffix) return at + after.length - before.length;
  // Where the offset would be if the part that changed had changed evenly.
  const changedBefore = Math.max(1, before.length - prefix - suffix);
  const changedAfter = after.length - prefix - suffix;
  const guess = prefix + Math.round(((at - prefix) * changedAfter) / changedBefore);
  for (const size of [32, 16, 8, 4, 2]) {
    const left = before.slice(Math.max(0, at - size), at);
    const right = before.slice(at, at + size);
    const tries: [string, number][] = [
      [left + right, left.length],
      [left, left.length],
      [right, 0],
    ];
    for (const [needle, shift] of tries) {
      if (needle.length < 2) continue;
      const found = nearest(after, needle, guess - shift);
      if (found >= 0) return found + shift;
    }
  }
  return prefix;
}

/**
 * The text node and the offset in it at the character `offset` of `root`'s text. At the boundary
 * of two text nodes it is the end of the first, as an insertion point typing there would continue.
 */
function pointAt(root: Node, offset: number): [Node, number] {
  const document = root.ownerDocument ?? (root as Document);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = offset;
  let last: Node | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (left <= length) return [node, left];
    left -= length;
    last = node;
  }
  return last ? [last, last.nodeValue?.length ?? 0] : [root, root.childNodes.length];
}

/**
 * Give `root` the keyboard and select `saved` in it again, its offsets moved through what changed
 * in the text since it was read (`mapTextOffset`). Returns the range selected.
 */
export function restoreTextSelection(root: HTMLElement, saved: TextSelection): Range {
  const document = root.ownerDocument;
  const text = textOf(root);
  const start = mapTextOffset(saved.text, text, saved.start);
  const end = Math.max(start, mapTextOffset(saved.text, text, saved.end));
  if (document.activeElement !== root) root.focus({ preventScroll: true });
  const range = document.createRange();
  range.setStart(...pointAt(root, start));
  range.setEnd(...pointAt(root, end));
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range;
}
