"use client";

import { ImageView } from "macalicious/image-view";
import {
  keepRichTextSelection,
  type RichTextSelectionKeeper,
  richTextFromHtml,
} from "macalicious/lib/rich-text";
import { RichTextView } from "macalicious/text-view";
import { type CSSProperties, memo, useLayoutEffect, useRef, useState } from "react";
import { beginDesktopDrag } from "../desktop/desktop-drag";
import { linkAddress, openUrl } from "../desktop/desktop-open-url";
import {
  pasteEdges,
  spaceAfterPaste,
  substituteTyped,
  type TextSubstitutions,
} from "../desktop/text-substitutions";
import { PHOTO, SCREENSHOT } from "./notes-artwork";
import {
  CHECKED_ATTRIBUTE,
  CHECKLIST_CLASS,
  DASHED_CLASS,
  listItemAt,
  toggleChecked,
} from "./notes-checklist";
import type { NoteFile, NotesNote } from "./notes-data";
import { fileBlock, fileOfBlock, filesIn, readNoteFile, showFiles } from "./notes-files";
import { placeTableCaret, tableCaretAfterHistory } from "./notes-table";

/** Elements that start a new line in the editor's content. */
const BLOCK = /^(DIV|P|H[1-6]|LI|UL|OL|TABLE|TBODY|TR|TD|TH|BLOCKQUOTE|PRE)$/;

/** The paragraph styles of Notes' Format menu. */
export type NotesParagraphStyle = "title" | "heading" | "subheading" | "body" | "monospaced";

/** The element of each paragraph style. */
const STYLE_TAGS: Record<NotesParagraphStyle, string> = {
  title: "H1",
  heading: "H2",
  subheading: "H3",
  body: "DIV",
  monospaced: "PRE",
};
/** How far the insertion point may be from a checklist item's text for a press to tick it. */
const CHECK_GUTTER = 24;

/**
 * The attribute that marks a first line made body text: Notes sets its first line as the title,
 * so a plain first line is the title until Body is chosen for it. Its one value is `body`.
 */
export const BODY_ATTRIBUTE = "data-paragraph";

/**
 * What a note's stored HTML may hold beside what formatting writes (`richTextFromHtml`): the
 * tables Add Table makes, the lists that have a class of their own, a checklist item's tick, and
 * the mark of a first line made body text (`BODY_ATTRIBUTE`), a line's writing direction, and a
 * link to a web address. Headings are made of elements formatting keeps already.
 */
export const NOTES_HTML = {
  elements: ["TABLE", "TBODY", "TR", "TD", "A"],
  attributes: {
    class: new RegExp(`^(mac-notes-table|${CHECKLIST_CLASS}|${DASHED_CLASS})$`),
    [BODY_ATTRIBUTE]: /^body$/,
    [CHECKED_ATTRIBUTE]: /^true$/,
    dir: /^(ltr|rtl)$/,
    href: /^https?:\/\/[^\s"'<>\\]{1,4096}$/i,
  },
};

/** Whether `node` is a line marked as body text (`BODY_ATTRIBUTE`). */
const markedBody = (node: Node) =>
  node instanceof HTMLElement && node.getAttribute(BODY_ATTRIBUTE) === "body";

/**
 * The text of an editor, line by line, as the note list and the search read it. The browser
 * edits the content in place and keeps a line in a `<div>`, ends one with a `<br>`, or leaves
 * the first one as bare text; an attachment holds no text.
 */
export function readLines(root: Node): string[] {
  const lines: string[] = [];
  let line: string | null = null;
  const flush = () => {
    if (line !== null) lines.push(line.replace(/\u00A0/g, " "));
    line = null;
  };
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) line = (line ?? "") + (child.nodeValue ?? "");
      else if (child instanceof HTMLElement) {
        if (child.dataset.attachment !== undefined) flush();
        else if (child.tagName === "BR") {
          line ??= "";
          flush();
        } else if (BLOCK.test(child.tagName)) {
          flush();
          walk(child);
          flush();
        } else walk(child);
      }
    }
  };
  walk(root);
  flush();
  return lines;
}

/** Stored or pasted text rebuilt from what a note may hold; a link with no web address is its text. */
function noteFragment(html: string, document: Document): DocumentFragment {
  const content = richTextFromHtml(html, document, NOTES_HTML);
  for (const link of content.querySelectorAll("a:not([href])"))
    link.replaceWith(...link.childNodes);
  return content;
}

/**
 * The text of an editor with its formats, as it is saved: the editor's HTML without its
 * pictures, rebuilt from the elements, styles and attributes that formatting and tables write
 * (`NOTES_HTML`), so that nothing else is sent or stored. `undefined` when the text is plain
 * lines (nothing but lines and line breaks), which `readLines` keeps as well.
 */
export function noteHtml(root: HTMLElement): string | undefined {
  const document = root.ownerDocument;
  const copy = root.cloneNode(true) as HTMLElement;
  for (const picture of copy.querySelectorAll("[data-attachment]")) picture.remove();
  const holder = document.createElement("div");
  holder.append(noteFragment(copy.innerHTML, document));
  const plain = [...holder.querySelectorAll("*")].every(
    (element) => /^(DIV|BR)$/.test(element.tagName) && element.attributes.length === 0,
  );
  return plain ? undefined : holder.innerHTML;
}

/** A note's lines as the editor's content: one `<div>` each, an empty one held open. */
function linesContent(lines: readonly string[], document: Document): DocumentFragment {
  const content = document.createDocumentFragment();
  for (const line of lines) {
    const block = document.createElement("div");
    block.append(line === "" ? document.createElement("br") : line);
    content.append(block);
  }
  return content;
}

/**
 * The content a note opens with when it was saved with its formats: its stored HTML, rebuilt
 * from what formatting and tables write, and nothing else whatever the stored text holds. Should
 * that leave no text where the note has some, its lines are shown instead.
 */
export function noteContent(note: Pick<NotesNote, "lines" | "html">, document: Document) {
  const content = noteFragment(note.html ?? "", document);
  const empty = (content.textContent ?? "").trim() === "";
  return empty && note.lines.some((line) => line.trim() !== "")
    ? linesContent(note.lines, document)
    : content;
}

/** Whether the editor still holds the note's stand-in picture: deleting it in the text removes it. */
export const hasAttachment = (root: Element) =>
  root.querySelector("[data-attachment]:not([data-file-id])") !== null;

/**
 * The note list's thumbnail of the first picture the user added: the thumbnail made for a large one,
 * or the picture's own `data:` URL. An address that lasts only as long as the page is not one.
 */
export const pictureOf = (root: Element) => {
  const picture = root.querySelector("img.mac-notes-picture");
  const thumbnail = picture?.closest<HTMLElement>("[data-thumbnail]")?.dataset.thumbnail;
  const source = picture?.getAttribute("src");
  return thumbnail ?? (source && !source.startsWith("blob:") ? source : undefined);
};

/** What a note holds as its editor has it: what `onEdit` is called with. */
export function noteEditState(editor: HTMLElement) {
  return {
    lines: readLines(editor),
    attachment: hasAttachment(editor),
    picture: pictureOf(editor),
    html: noteHtml(editor),
    files: filesIn(editor),
  };
}

/** Put the insertion point at the end of `node`, inside the editor that holds it. */
export function placeCaretAtEnd(node: Node) {
  const document = node.ownerDocument;
  const selection = document?.getSelection();
  if (!document || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The node where a range starts: between two children of an element, the one after it. */
export function nodeAt(range: Range): Node {
  const container = range.startContainer;
  if (container.nodeType !== 1 || container.childNodes.length === 0) return container;
  return (
    container.childNodes[Math.min(range.startOffset, container.childNodes.length - 1)] ?? container
  );
}

const breaksLine = (node: Node) =>
  node instanceof HTMLElement && (BLOCK.test(node.tagName) || node.tagName === "BR");

/** The editor's own child that holds `at`, or `null` when `at` is not inside the editor. */
function lineOf(editor: HTMLElement, at: Node | null): Node | null {
  let node = at;
  if (!node || node === editor || !editor.contains(node)) return null;
  while (node.parentNode && node.parentNode !== editor) node = node.parentNode;
  return node;
}

/** Whether the editor's child `node` is on the note's first line. */
function onFirstLine(node: Node): boolean {
  for (let before = node.previousSibling; before; before = before.previousSibling) {
    if (breaksLine(before)) return false;
    // A paragraph after bare text that the browser left as the first line.
    if (breaksLine(node) && (before.textContent ?? "") !== "") return false;
  }
  return true;
}

/**
 * The paragraph style of the line that holds `at`, as the Format menu checks it: a heading, the
 * title (a line made one, or the first line, which Notes sets as the title unless it was made
 * body text), or body text. `null` outside the editor, and in a table or a picture, which have
 * no paragraph style.
 */
export function lineStyleAt(editor: HTMLElement, at: Node | null): NotesParagraphStyle | null {
  const node = lineOf(editor, at);
  if (!node) return null;
  if (node instanceof HTMLElement) {
    if (node.dataset.attachment !== undefined || node.tagName === "TABLE") return null;
    if (node.tagName === "H1") return "title";
    if (node.tagName === "H2") return "heading";
    if (node.tagName === "H3") return "subheading";
    if (node.tagName === "PRE") return "monospaced";
    if (/^(UL|OL)$/.test(node.tagName)) return null;
  }
  if (markedBody(node)) return "body";
  return onFirstLine(node) ? "title" : "body";
}

/** The outermost list that holds `at`, on its own as a line of the editor: `null` when there is none. */
function listAround(editor: HTMLElement, at: Node | null): HTMLElement | null {
  let list: HTMLElement | null = null;
  for (let node = at; node && node !== editor; node = node.parentNode) {
    if (node instanceof HTMLElement && /^(UL|OL)$/.test(node.tagName)) list = node;
  }
  // Chromium's list command leaves the list inside the line it was made from.
  while (list && list.parentElement !== editor) {
    const wrapper: HTMLElement | null = list.parentElement;
    if (wrapper?.tagName !== "DIV" || wrapper.childNodes.length !== 1) return null;
    wrapper.replaceWith(list);
  }
  return list;
}

/**
 * Take the list item that holds `at` out of its list, as a plain line between what was before it
 * and what was after it: a paragraph style leaves the line no longer a list item.
 */
function lineOutOfList(list: HTMLElement, at: Node | null): HTMLElement | null {
  let item = at;
  while (item && item.parentNode !== list) item = item.parentNode;
  if (item?.nodeName !== "LI") return null;
  const document = list.ownerDocument;
  const line = document.createElement("div");
  line.append(...item.childNodes);
  const rest = list.cloneNode(false) as HTMLElement;
  while (item.nextSibling) rest.append(item.nextSibling);
  item.parentNode?.removeChild(item);
  list.after(line);
  if (rest.hasChildNodes()) line.after(rest);
  if (!list.hasChildNodes()) list.remove();
  return line;
}

/** The bare run of text the browser left around `node`, as a line of its own in a new `tag`. */
function wrapBareLine(editor: HTMLElement, node: Node, tag: string): HTMLElement {
  const run: Node[] = [node];
  for (let before = node.previousSibling; before && !breaksLine(before); ) {
    run.unshift(before);
    before = before.previousSibling;
  }
  let after = node.nextSibling;
  while (after && !breaksLine(after)) {
    run.push(after);
    after = after.nextSibling;
  }
  const line = editor.ownerDocument.createElement(tag.toLowerCase());
  editor.insertBefore(line, run[0] ?? null);
  line.append(...run);
  // The line break that ended the bare line: the new block ends it now.
  if (after?.nodeName === "BR") after.remove();
  return line;
}

/** Format > Text > Writing Direction: `natural` follows the text itself. */
export type NotesDirection = "natural" | "ltr" | "rtl";

/** The writing direction set on the line that holds `at`. */
export function directionAt(editor: HTMLElement, at: Node | null): NotesDirection {
  const element = at instanceof Element ? at : (at?.parentElement ?? null);
  const value = element?.closest("[dir]");
  const dir = value && editor.contains(value) ? value.getAttribute("dir") : null;
  return dir === "ltr" || dir === "rtl" ? dir : "natural";
}

/**
 * Give the lines `range` touches a writing direction: each list item on its own, a table whole.
 * Returns whether anything changed. The text stays where it is, so the selection does too.
 */
export function setLineDirection(
  editor: HTMLElement,
  direction: NotesDirection,
  range: Range,
): boolean {
  const lines = new Set<HTMLElement>();
  for (const child of [...editor.childNodes]) {
    if (!range.intersectsNode(child)) continue;
    if (child instanceof HTMLElement && child.dataset.attachment !== undefined) continue;
    if (child instanceof HTMLElement && /^(UL|OL)$/.test(child.tagName)) {
      for (const item of child.querySelectorAll("li")) {
        if (range.intersectsNode(item)) lines.add(item);
      }
    } else if (child instanceof HTMLElement && breaksLine(child)) {
      if (child.tagName !== "BR") lines.add(child);
    } else if (child.isConnected && child.parentNode === editor) {
      lines.add(wrapBareLine(editor, child, "DIV"));
    }
  }
  let changed = false;
  for (const line of lines) {
    const before = line.getAttribute("dir");
    if (direction === "natural") line.removeAttribute("dir");
    else line.setAttribute("dir", direction);
    changed ||= before !== line.getAttribute("dir");
  }
  return changed;
}

/**
 * Give a line a paragraph style: the title, a heading or body text. The line is the one that
 * holds `at`, the insertion point as it was when the editor last had it (a menu takes the
 * focus, and may take the selection, before its command runs). The line keeps its alignment,
 * and a list item leaves its list.
 * The first line, the title until it is given another style, is marked when it is made body
 * text (`BODY_ATTRIBUTE`); the mark goes when it is made the title or a heading.
 * Returns whether a line was changed: it may have the style already, and `at` may be outside
 * the editor, or in a table or a picture, which have no paragraph style.
 */
export function setLineStyle(
  editor: HTMLElement,
  style: NotesParagraphStyle,
  at: Node | null,
): boolean {
  const document = editor.ownerDocument;
  const list = listAround(editor, at);
  const node = list ? lineOutOfList(list, at) : lineOf(editor, at);
  if (!node) return false;
  const tag = STYLE_TAGS[style];
  // Body text on the first line must say so: unmarked, the first line is the title.
  const marked = style === "body" && onFirstLine(node);
  let line: HTMLElement;
  if (node instanceof HTMLElement && breaksLine(node)) {
    if (node.dataset.attachment !== undefined || !/^(DIV|P|H1|H2|H3|PRE)$/.test(node.tagName))
      return false;
    if (node.tagName === tag) {
      if (!list && (!marked || markedBody(node))) return false;
      if (marked) node.setAttribute(BODY_ATTRIBUTE, "body");
      line = node;
    } else {
      line = document.createElement(tag.toLowerCase());
      const own = node.getAttribute("style");
      if (own) line.setAttribute("style", own);
      if (marked) line.setAttribute(BODY_ATTRIBUTE, "body");
      line.append(...node.childNodes);
      node.replaceWith(line);
    }
  } else {
    // A line the browser left as bare text, styled words and all: body text already unless it
    // is the first line, the title.
    if ((style === "body" && !marked) || node.nodeName === "BR") return false;
    line = wrapBareLine(editor, node, tag);
    if (marked) line.setAttribute(BODY_ATTRIBUTE, "body");
  }
  placeCaretAtEnd(line);
  return true;
}

export interface NotesEditorProps {
  /** The note to edit. Its text is read once: afterwards the browser owns the content. */
  note: NotesNote;
  /**
   * Called on every edit with the note's id, its lines, whether its stand-in picture is still
   * there, the first picture the user added, the text with its formats (`noteHtml`) and its files.
   */
  onEdit: (
    id: string,
    lines: string[],
    attachment: boolean,
    picture?: string,
    html?: string,
    files?: NoteFile[],
  ) => void;
  /** A double click on a file in the note. */
  onQuickLook?: (file: NoteFile) => void;
  /** Where the editor's element is kept while it is mounted, by note id. */
  registry: Map<string, HTMLDivElement>;
  /**
   * Where the editor's selection keeper is kept while it is mounted, by note id: it follows the
   * selection in the editor, so that a menu or a panel acts where the person was typing.
   */
  keepers: Map<string, RichTextSelectionKeeper>;
  /** Edit > Spelling > Check Spelling While Typing: the browser's own underlines. */
  spellCheck: boolean;
  /** Edit > Substitutions > Text Replacement, which the desktop's typing reads from the view. */
  textReplacement: boolean;
  /** Edit > Substitutions as they are now, read as each character is typed. */
  substitutions: { readonly current: TextSubstitutions };
}

/**
 * The view's place in the note's page, and the font of the note's text: the page scrolls, so
 * the view is as tall as its text instead of filling a pane and scrolling by itself. The family
 * is the view's own, the system font (San Francisco), which the Notes captures show.
 */
const TEXT_STYLE: CSSProperties = {
  flex: "1 0 auto",
  height: "auto",
  overflow: "visible",
  fontSize: 14,
  lineHeight: "19px",
};

/**
 * The text of one note: a rich text view whose first line is the title.
 *
 * The view is uncontrolled. Its content is rendered once, from the note as it is when the
 * editor is first shown (its lines, or its saved formats, rebuilt from `html`), and from then
 * on the browser edits it in place; the component is rendered again only when the note is
 * locked or unlocked, with the same content, so React never touches what was typed.
 */
export const NotesEditor = memo(
  function NotesEditor({
    note,
    onEdit,
    onQuickLook,
    registry,
    keepers,
    spellCheck,
    textReplacement,
    substitutions,
  }: NotesEditorProps) {
    const [initial] = useState(note);
    const element = useRef<HTMLDivElement>(null);
    const pasted = useRef("");
    const pasteStart = useRef<ReturnType<typeof pasteEdges>>(undefined);
    // A note saved with its formats is filled from its HTML once, before it is first painted.
    const filled = useRef(false);
    const filesPlaced = useRef(false);

    useLayoutEffect(() => {
      const node = element.current;
      if (!node || filled.current || initial.html === undefined) return;
      filled.current = true;
      node.insertBefore(
        noteContent(initial, node.ownerDocument),
        node.querySelector(":scope > [data-attachment]"),
      );
    }, [initial]);

    // The note's files stand at its end, and the first picture keeps the thumbnail the note saved.
    useLayoutEffect(() => {
      const node = element.current;
      if (!node || filesPlaced.current) return;
      filesPlaced.current = true;
      let thumbnail = initial.picture;
      for (const file of initial.files ?? []) {
        node.append(fileBlock(node.ownerDocument, file, { thumbnail }));
        if (file.type.startsWith("image/")) thumbnail = undefined;
      }
      showFiles(node);
    }, [initial]);

    useLayoutEffect(() => {
      const node = element.current;
      if (!node) return;
      const keeper = keepRichTextSelection(node);
      registry.set(initial.id, node);
      keepers.set(initial.id, keeper);
      return () => {
        keeper.dispose();
        registry.delete(initial.id);
        keepers.delete(initial.id);
      };
    }, [registry, keepers, initial.id]);

    return (
      <RichTextView
        ref={element}
        aria-label="Note"
        className="mac-notes-text"
        style={TEXT_STYLE}
        readOnly={note.locked || note.deleted !== undefined}
        spellCheck={spellCheck}
        data-text-replacement={textReplacement ? "on" : "off"}
        onClick={(event) => {
          const link = (event.target as Element).closest?.("a[href]");
          if (!link) return;
          event.preventDefault();
          // A drag across a link selects it; a click opens it, as in Notes.
          if (!event.currentTarget.ownerDocument.getSelection()?.isCollapsed) return;
          const address = linkAddress(link.getAttribute("href"));
          if (address) openUrl(address, "notes");
        }}
        onPaste={(event) => {
          pasteStart.current = pasteEdges(event.currentTarget);
          pasted.current = event.clipboardData?.getData("text/plain") ?? "";
        }}
        onPointerDown={(event) => {
          // A press on a file drags it out, to Finder or another app; its player keeps its own.
          const target = event.target as Element;
          const block = target.closest?.("[data-file-id]");
          const file = block ? fileOfBlock(block) : null;
          if (!file || event.button !== 0 || target.closest("audio,video")) return;
          beginDesktopDrag(event.nativeEvent, {
            from: "notes",
            icon: block?.querySelector("img,.mac-notes-file-icon"),
            items: () => [
              {
                id: `note-file-${file.id}`,
                name: file.name,
                kind: "file",
                type: file.type,
                size: file.size,
                bytes: () => readNoteFile(file),
              },
            ],
          });
        }}
        onDoubleClick={(event) => {
          const block = (event.target as Element).closest?.("[data-file-id]");
          const file = block ? fileOfBlock(block) : null;
          if (file) onQuickLook?.(file);
        }}
        onMouseDown={(event) => {
          // A press on a checklist item's circle ticks it; the insertion point stays where it was.
          const editor = event.currentTarget;
          const target = event.target as Element;
          const item = listItemAt(editor, target);
          if (
            !item?.parentElement?.classList.contains(CHECKLIST_CLASS) ||
            target !== item ||
            editor.getAttribute("contenteditable") !== "true" ||
            event.clientX - item.getBoundingClientRect().left > CHECK_GUTTER
          ) {
            return;
          }
          event.preventDefault();
          toggleChecked(editor, item);
          onEdit(
            initial.id,
            readLines(editor),
            hasAttachment(editor),
            pictureOf(editor),
            noteHtml(editor),
            filesIn(editor),
          );
        }}
        onInput={(event) => {
          // Return copies the item's attributes to the new one, which is not ticked yet.
          if ((event.nativeEvent as InputEvent).inputType === "insertParagraph") {
            const selection = event.currentTarget.ownerDocument.getSelection();
            const item = selection ? listItemAt(event.currentTarget, selection.anchorNode) : null;
            item?.removeAttribute(CHECKED_ATTRIBUTE);
          }
          // Undo and Redo of a Format > Table change put the insertion point back in the table.
          const kind = (event.nativeEvent as InputEvent).inputType;
          if (kind === "historyUndo" || kind === "historyRedo") {
            const caret = tableCaretAfterHistory(event.currentTarget, kind === "historyRedo");
            if (caret) placeTableCaret(caret);
          }
          const native = event.nativeEvent as InputEvent;
          if (kind === "insertText" && !native.isComposing) {
            substituteTyped(event.currentTarget, native.data, substitutions.current, true);
          }
          if (kind === "insertFromPaste" && substitutions.current.copyPaste) {
            spaceAfterPaste(event.currentTarget, pasted.current, pasteStart.current);
          }
          onEdit(
            initial.id,
            readLines(event.currentTarget),
            hasAttachment(event.currentTarget),
            pictureOf(event.currentTarget),
            noteHtml(event.currentTarget),
            filesIn(event.currentTarget),
          );
        }}
      >
        {initial.html === undefined
          ? initial.lines.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity, and the list is rendered once
              <div key={index}>{line === "" ? <br /> : line}</div>
            ))
          : null}
        {initial.attachment ? (
          <div className="mac-notes-attachment" data-attachment="" contentEditable={false}>
            {initial.attachment === "screenshot" ? (
              <ImageView
                src={SCREENSHOT}
                width={462}
                height={307}
                alt="Placeholder for a screenshot"
              />
            ) : (
              <ImageView src={PHOTO} width={320} height={180} alt="Placeholder for a photograph" />
            )}
          </div>
        ) : null}
      </RichTextView>
    );
  },
  (before, after) =>
    before.note.locked === after.note.locked &&
    before.spellCheck === after.spellCheck &&
    before.textReplacement === after.textReplacement &&
    (before.note.deleted === undefined) === (after.note.deleted === undefined),
);
