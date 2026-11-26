/**
 * What the New Message window does with the content of its rich text view: the message's text
 * as plain text, line by line, which is what a draft's `body` holds, and text put in where the
 * insertion point is, as the Emoji menu does.
 */

/** Elements that start a line of their own: what the browsers make for a new line, and lists. */
const BLOCK = /^(DIV|P|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE)$/;

/** The zero-width space the size command leaves where a size waits for typed text. */
const ZERO_WIDTH = /\u200B/g;

/**
 * The text of the view with its line breaks. The browsers keep a line in a `<div>`, end one
 * with a `<br>`, or leave the first one as bare text; the spaces they keep from collapsing
 * (no-break spaces) are ordinary spaces again.
 */
export function messageText(root: Node): string {
  const lines: string[] = [];
  let line: string | null = null;
  const flush = () => {
    if (line !== null) lines.push(line);
    line = null;
  };
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        line = (line ?? "") + (child.nodeValue ?? "");
      } else if (child.nodeType === 1) {
        const tag = (child as Element).tagName.toUpperCase();
        if (tag === "BR") {
          line ??= "";
          flush();
        } else if (BLOCK.test(tag)) {
          flush();
          walk(child);
          flush();
        } else walk(child);
      }
    }
  };
  walk(root);
  flush();
  return lines
    .join("\n")
    .replace(ZERO_WIDTH, "")
    .replace(/\u00A0/g, " ");
}

/**
 * Put `text` in place of the selection in `root`, which must hold it (see
 * `keepRichTextSelection`). An insertion point after the last line goes to the end of that
 * line, not onto a new one. The browser's own command keeps the insertion in its undo history;
 * where there is none (a test's DOM) the text is inserted as a node and `input` is dispatched,
 * as typing would.
 */
export function insertText(root: HTMLElement, text: string): void {
  const document = root.ownerDocument;
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return;
  const before =
    range.collapsed && range.startContainer === root && range.startOffset > 0
      ? root.childNodes[range.startOffset - 1]
      : undefined;
  if (before && before.nodeType === 1 && BLOCK.test((before as Element).tagName.toUpperCase())) {
    const last = before.lastChild;
    if (last && last.nodeName === "BR") range.setStartBefore(last);
    else range.setStart(before, before.childNodes.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  if (
    typeof document.execCommand === "function" &&
    document.execCommand("insertText", false, text)
  ) {
    return;
  }
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  root.dispatchEvent(new Event("input", { bubbles: true }));
}
