/**
 * What the editors' Edit > Substitutions do to text as it is typed and pasted, and Replace All. Each
 * change goes through the browser's text command, so one Undo takes it back.
 */
import { useDesktopSetting } from "./desktop-personal";
import { flatOffset, flatOffsetBefore, flatText, rangeOfFlat } from "./text-spelling";

/** Which substitutions an app makes; Text Replacement's rules are Keyboard's, for every app. */
export interface TextSubstitutions {
  copyPaste: boolean;
  quotes: boolean;
  dashes: boolean;
  links: boolean;
  replacement: boolean;
}

/** As Catalina's TextEdit starts. */
export const DEFAULT_SUBSTITUTIONS: TextSubstitutions = {
  copyPaste: true,
  quotes: true,
  dashes: true,
  links: false,
  replacement: true,
};

const readSubstitutions = (stored: unknown): TextSubstitutions | undefined =>
  typeof stored === "object" && stored !== null
    ? { ...DEFAULT_SUBSTITUTIONS, ...(stored as Partial<TextSubstitutions>) }
    : undefined;

/** The desktop value an app's substitutions are kept in. */
export const substitutionsKey = (app: string) => `${app}.substitutions`;

/** An app's substitutions, kept with its other settings, and their setter. */
export const useTextSubstitutions = (app: string) =>
  useDesktopSetting(substitutionsKey(app), readSubstitutions, DEFAULT_SUBSTITUTIONS);

const WORD_CHARACTER = /[\p{L}\p{M}\p{N}]/u;

/** The curly quote that takes the place of a straight one after the text `before`. */
export function smartQuote(before: string, typed: '"' | "'"): string {
  const last = Array.from(before).at(-1);
  const opens = last === undefined || /[\s([{—–“‘-]/u.test(last);
  if (typed === '"') return opens ? "“" : "”";
  return opens ? "‘" : "’";
}

const LINK = /(?:^|\s)((?:https?:\/\/|www\.)[^\s<>"]+[^\s<>".,;:!?)])$/i;

/** The web address that ends `text`, when one does, as written and as a link goes to it. */
export function linkAtEnd(text: string): { written: string; href: string } | undefined {
  const written = LINK.exec(text)?.[1];
  if (!written) return undefined;
  return { written, href: /^www\./i.test(written) ? `https://${written}` : written };
}

/**
 * Text with straight quotes and double hyphens made smart, as Replace All does. `before` is the text
 * in front of it, which says whether a quote at its start opens or closes.
 */
export function substitutedText(
  text: string,
  { quotes, dashes }: TextSubstitutions,
  before = "",
): string {
  let out = "";
  for (let at = 0; at < text.length; at += 1) {
    const char = text.charAt(at);
    if (quotes && (char === '"' || char === "'")) out += smartQuote(before + out, char);
    else if (dashes && char === "-" && text.charAt(at + 1) === "-") {
      out += "—";
      at += 1;
    } else out += char;
  }
  return out;
}

/** The text node and offset of a collapsed selection in `element`, when it is in text. */
function caretIn(element: HTMLElement): { node: Text; offset: number } | undefined {
  const selection = element.ownerDocument.getSelection();
  const node = selection?.focusNode;
  if (!selection?.isCollapsed || !(node instanceof Text) || !element.contains(node)) {
    return undefined;
  }
  return { node, offset: selection.focusOffset };
}

/** A rich view's text before a place in a text node: across styles, with a line end at each paragraph. */
function viewTextUpTo(element: HTMLElement, node: Text, offset: number): string {
  const flat = flatText(element);
  return flat.text.slice(0, flatOffset(flat, node, offset));
}

/** The text before the caret on its line, in a text area or its text node. */
function textBeforeCaret(element: HTMLElement): string | undefined {
  if (element instanceof HTMLTextAreaElement) {
    return element.selectionStart === element.selectionEnd
      ? element.value.slice(0, element.selectionStart)
      : undefined;
  }
  const caret = caretIn(element);
  return caret?.node.data.slice(0, caret.offset);
}

/** Replaces the `length` characters before the caret in its text node: one step on the Undo stack. */
function replaceBeforeCaret(element: HTMLElement, length: number, text: string): void {
  if (element instanceof HTMLTextAreaElement) {
    const end = element.selectionStart;
    element.setSelectionRange(end - length, end);
    if (!element.ownerDocument.execCommand("insertText", false, text)) {
      element.setSelectionRange(end, end);
    }
    return;
  }
  const caret = caretIn(element);
  if (!caret || caret.offset < length) return;
  const selection = element.ownerDocument.getSelection();
  selection?.setBaseAndExtent(caret.node, caret.offset - length, caret.node, caret.offset);
  // A browser that refuses the command leaves the text as typed, and the caret where it was.
  if (!element.ownerDocument.execCommand("insertText", false, text)) {
    selection?.collapse(caret.node, caret.offset);
  }
}

/**
 * What a typed character does in `element`, an editable text view: a straight quote turns curly, two
 * hyphens a dash, and a space or line after a web address in rich text makes it a link.
 */
export function substituteTyped(
  element: HTMLElement,
  typed: string | null,
  settings: TextSubstitutions,
  rich: boolean,
): void {
  const upTo = textBeforeCaret(element);
  if (upTo === undefined || !typed) return;
  const before = upTo.slice(0, upTo.length - typed.length);
  if (settings.quotes && (typed === '"' || typed === "'")) {
    const caret = caretIn(element);
    const context = caret ? viewTextUpTo(element, caret.node, caret.offset - typed.length) : before;
    replaceBeforeCaret(element, 1, smartQuote(context, typed));
    return;
  }
  if (settings.dashes && typed === "-" && before.endsWith("-")) {
    replaceBeforeCaret(element, 2, "—");
    return;
  }
  if (settings.links && rich && typed === " ") {
    const link = linkAtEnd(before);
    const caret = caretIn(element);
    if (!link || !caret) return;
    const end = caret.offset - typed.length;
    const selection = element.ownerDocument.getSelection();
    selection?.setBaseAndExtent(caret.node, end - link.written.length, caret.node, end);
    element.ownerDocument.execCommand("createLink", false, link.href);
    selection?.collapseToEnd();
    selection?.modify("move", "forward", "character");
  }
}

/** What a text area holds before the selection when a paste begins: Smart Copy/Paste looks at it next. */
export function pasteEdges(element: HTMLElement): { before: string } | undefined {
  return element instanceof HTMLTextAreaElement
    ? { before: element.value.slice(0, element.selectionStart) }
    : undefined;
}

/** The Undo steps of one paste's spaces, for each editor that had some last. */
const pasteSpaces = new WeakMap<HTMLElement, AbortController>();

/**
 * Makes a paste and the `spaces` inserted after it one step of Undo and Redo, as on a Mac. A browser
 * keeps each `insertText` as a step of its own and has no way to join two, so an Undo or Redo of the
 * last of them asks for the others too. The further steps wait for a timer: Chromium ignores
 * `execCommand` while the one that sent the event still runs, as Edit > Undo's does.
 */
function joinSpacesToUndo(element: HTMLElement, spaces: number): void {
  pasteSpaces.get(element)?.abort();
  if (spaces === 0) return;
  const listening = new AbortController();
  pasteSpaces.set(element, listening);
  const target = element.ownerDocument;
  let undone = false;
  let following = false;
  element.addEventListener(
    "input",
    (event) => {
      if (following) return;
      const kind = (event as InputEvent).inputType;
      if (kind !== (undone ? "historyRedo" : "historyUndo")) {
        listening.abort();
        return;
      }
      undone = !undone;
      following = true;
      setTimeout(() => {
        for (let at = 0; at < spaces; at += 1) {
          target.execCommand(kind === "historyUndo" ? "undo" : "redo");
        }
        following = false;
      });
    },
    { signal: listening.signal },
  );
}

/** Spaces a word pasted against another word, reading across styles and across the paste's own nodes. */
function spaceAfterRichPaste(element: HTMLElement, pasted: string): number {
  const target = element.ownerDocument;
  const selection = target.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!selection || !range || !element.contains(range.endContainer)) return 0;
  const place = (where: Range | undefined) => {
    if (!where) return false;
    selection.removeAllRanges();
    selection.addRange(where);
    return true;
  };
  const flat = flatText(element);
  const written = pasted.replace(/\r\n?/g, "\n");
  const end = flatOffsetBefore(element, range.endContainer, range.endOffset);
  // A live range: the spaces move it with the text, and it stays in the block the paste ended in.
  const after = range.cloneRange();
  after.collapse(false);
  const start = end - written.length;
  const leading =
    start > 0 &&
    flat.text.slice(start, end) === written &&
    WORD_CHARACTER.test(flat.text.charAt(start - 1)) &&
    WORD_CHARACTER.test(written.charAt(0));
  const trailing =
    WORD_CHARACTER.test(written.at(-1) ?? "") && WORD_CHARACTER.test(flat.text.charAt(end));
  if (!leading && !trailing) return 0;
  const spaceAt = (at: number) =>
    place(rangeOfFlat(flatText(element), at, at)) && target.execCommand("insertText", false, " ");
  let spaces = 0;
  if (trailing && spaceAt(end)) spaces += 1;
  if (leading && spaceAt(start)) spaces += 1;
  place(after);
  return spaces;
}

/**
 * Smart Copy/Paste, after a paste of `pasted`: a word pasted against another word gets a space between
 * them, on the side it is needed. `edges` is what `pasteEdges` read of a text area before the paste.
 */
export function spaceAfterPaste(
  element: HTMLElement,
  pasted: string,
  edges: { before: string } | undefined,
): void {
  if (element instanceof HTMLTextAreaElement) {
    if (!edges || pasted === "") return;
    const target = element.ownerDocument;
    const start = edges.before.length;
    let end = element.selectionStart;
    let spaces = 0;
    if (
      WORD_CHARACTER.test(pasted.at(-1) ?? "") &&
      WORD_CHARACTER.test(element.value.charAt(end))
    ) {
      if (target.execCommand("insertText", false, " ")) spaces += 1;
      element.setSelectionRange(end, end);
    }
    if (WORD_CHARACTER.test(edges.before.at(-1) ?? "") && WORD_CHARACTER.test(pasted.charAt(0))) {
      element.setSelectionRange(start, start);
      if (target.execCommand("insertText", false, " ")) {
        end += 1;
        spaces += 1;
      }
      element.setSelectionRange(end, end);
    }
    joinSpacesToUndo(element, spaces);
    return;
  }
  joinSpacesToUndo(element, pasted === "" ? 0 : spaceAfterRichPaste(element, pasted));
}

/**
 * The Substitutions panel's Replace All: the selected text, or the whole view's, with quotes and
 * dashes made smart. Text outside a selection stays as it is, in a node the selection only partly
 * covers too. Formats stay, as each text node is changed on its own; a change that spans two nodes,
 * as a double hyphen across two styles, stays as it is.
 */
export function replaceAllSubstitutions(element: HTMLElement, settings: TextSubstitutions): number {
  if (element instanceof HTMLTextAreaElement) {
    const { selectionStart: start, selectionEnd: end, value } = element;
    const [from, to] = start === end ? [0, value.length] : [start, end];
    const next = substitutedText(value.slice(from, to), settings, value.slice(0, from));
    if (next === value.slice(from, to)) return 0;
    element.focus();
    element.setSelectionRange(from, to);
    return element.ownerDocument.execCommand("insertText", false, next) ? 1 : 0;
  }
  const target = element.ownerDocument;
  const selection = target.getSelection();
  const range =
    selection && selection.rangeCount > 0 && !selection.isCollapsed
      ? selection.getRangeAt(0).cloneRange()
      : null;
  const inView = range && element.contains(range.commonAncestorContainer);
  const walker = target.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!inView || range.intersectsNode(node)) nodes.push(node as Text);
  }
  let changed = 0;
  element.focus();
  for (const node of nodes) {
    const from = inView && node === range.startContainer ? range.startOffset : 0;
    const to = inView && node === range.endContainer ? range.endOffset : node.length;
    const part = node.data.slice(from, to);
    if (!/["']|--/.test(part)) continue;
    const next = substitutedText(part, settings, viewTextUpTo(element, node, from));
    if (next === part) continue;
    selection?.setBaseAndExtent(node, from, node, to);
    if (target.execCommand("insertText", false, next)) changed += 1;
  }
  return changed;
}
