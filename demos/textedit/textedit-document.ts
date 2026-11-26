/**
 * What TextEdit does to the content of its rich text view. The view is the library's
 * `RichTextView`, an element the browser edits in place; these functions read it and change
 * the paragraphs and the characters of the selection.
 *
 * A paragraph is a child element of the view (a `<div>`, which is what the browsers make for a
 * new line). Its alignment, line spacing and list style are kept on that element, so they are
 * read back from where they were written. Character formats (font, size, colour, bold) are the
 * browser's own editing commands, which keep them in its undo history.
 */

import { setRichTextSize } from "macalicious/lib/rich-text";
import { type TabStop, tabStopsText, withoutTabLayout } from "./textedit-tab-stops";

/** Elements that start a new line in the view's content. */
const BLOCK = /^(DIV|P|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE|TABLE|TBODY|THEAD|TFOOT)$/;

/** Line height of body text as a multiple of the font size: Helvetica 12 on a 14 pt line. */
export const LINE_HEIGHT = 7 / 6;

/** How a paragraph is aligned. */
export type TextEditAlignment = "left" | "center" | "right" | "justify";

/** What the format bar shows of the paragraph that holds the insertion point. */
export interface ParagraphFormat {
  /** Alignment. */
  align: TextEditAlignment;
  /** Line spacing as the format bar names it: "1.0", "1.5". */
  spacing: string;
  /** List style: `none`, or the value of an entry of the list menu. */
  list: string;
}

/** A paragraph with nothing set: left-aligned, single-spaced, no list. */
export const PLAIN_PARAGRAPH: ParagraphFormat = { align: "left", spacing: "1.0", list: "none" };

/**
 * The text of a view, line by line: what the plain-text form, the print preview and a saved
 * document hold. The browser keeps a line in a `<div>`, ends one with a `<br>`, or leaves the
 * first one as bare text.
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
        if (child.tagName === "BR") {
          line ??= "";
          flush();
        } else if (child.tagName === "TR") {
          // A table row is one line, its cells a tab apart.
          flush();
          lines.push(
            [...child.children]
              .map((cell) =>
                readLines(cell)
                  .join(" ")
                  .replace(/\u00A0/g, " "),
              )
              .join("\t"),
          );
        } else if (BLOCK.test(child.tagName)) {
          flush();
          const before = lines.length;
          walk(child);
          flush();
          // A block with nothing in it holds an empty line.
          if (lines.length === before) lines.push("");
        } else walk(child);
      }
    }
  };
  walk(root);
  flush();
  return lines.length ? lines : [""];
}

/**
 * The paragraphs a range touches in a table's cells. A cell's bare text is given a paragraph first,
 * as `paragraphsOf` does, and the range is put back on the nodes it was at: moving a node takes a
 * range's ends out of it, and wrapping changes what an offset into a cell counts.
 */
function selectedCellParagraphs(table: Element, range: Range): HTMLElement[] {
  const { startContainer, startOffset, endContainer, endOffset } = range;
  const isCell = (node: Node) => node instanceof HTMLElement && node.tagName === "TD";
  const startChild = isCell(startContainer) ? startContainer.childNodes[startOffset] : undefined;
  const endChild = isCell(endContainer) ? endContainer.childNodes[endOffset - 1] : undefined;
  const cells = [...table.querySelectorAll<HTMLElement>("td")].filter(
    (cell) => cell.closest("table") === table && range.intersectsNode(cell),
  );
  const inCells = cells.flatMap((cell) => {
    const whole = cell.ownerDocument.createRange();
    whole.selectNodeContents(cell);
    return paragraphsOf(cell, whole);
  });
  if (startChild) range.setStartBefore(startChild);
  else if (isCell(startContainer)) range.setStart(startContainer, startContainer.childNodes.length);
  else range.setStart(startContainer, startOffset);
  if (endChild) range.setEndAfter(endChild);
  else if (isCell(endContainer)) range.setEnd(endContainer, 0);
  else range.setEnd(endContainer, endOffset);
  return inCells.filter((paragraph) => range.intersectsNode(paragraph));
}

/**
 * The paragraphs a range touches: the view's child elements from the one that holds the
 * range's start to the one that holds its end. Text the browser left bare in the view (the
 * first line, after everything was deleted) is put into a paragraph of its own first, so that
 * it has an element to carry a format. Without a range inside the view, there are none.
 */
export function paragraphsOf(editor: HTMLElement, range: Range | null): HTMLElement[] {
  if (!range || !editor.contains(range.commonAncestorContainer)) return [];
  // Inside one cell of a table, that cell is the view: it holds the paragraphs.
  const around = range.commonAncestorContainer;
  const cell = (around instanceof Element ? around : around.parentElement)?.closest("td");
  if (cell && editor.contains(cell) && cell !== editor) {
    return paragraphsOf(cell as HTMLElement, range);
  }
  // A node moved out of its parent takes no range with it: the DOM leaves an endpoint inside it at
  // the old parent. So each endpoint is noted here and put back once the bare text has moved, and
  // the selection keeps the same characters.
  const collapsed = range.collapsed;
  const { startContainer, startOffset, endContainer, endOffset } = range;
  const startChild = startContainer === editor ? editor.childNodes[startOffset] : undefined;
  const endChild = endContainer === editor ? editor.childNodes[endOffset - 1] : undefined;
  let moved = false;
  for (const child of [...editor.childNodes]) {
    if (child.nodeType === 3 || (child instanceof HTMLElement && !BLOCK.test(child.tagName))) {
      const previous = child.previousSibling;
      const paragraph =
        previous instanceof HTMLElement && previous.dataset.wrapped !== undefined
          ? previous
          : editor.ownerDocument.createElement("div");
      if (paragraph !== previous) {
        paragraph.dataset.wrapped = "";
        editor.insertBefore(paragraph, child);
      }
      paragraph.append(child);
      moved = true;
    }
  }
  if (moved) {
    if (startChild) range.setStartBefore(startChild);
    else if (startContainer === editor) range.setStart(editor, editor.childNodes.length);
    else range.setStart(startContainer, startOffset);
    if (collapsed) range.collapse(true);
    else if (endChild) range.setEndAfter(endChild);
    else if (endContainer === editor) range.setEnd(editor, 0);
    else range.setEnd(endContainer, endOffset);
  }
  for (const wrapped of editor.querySelectorAll<HTMLElement>(":scope > [data-wrapped]")) {
    delete wrapped.dataset.wrapped;
  }
  // An endpoint in the view itself is between two of its children: the range starts with
  // the child after that place and ends with the child before it (Select All is from before
  // the first child to after the last).
  const top = (node: Node, offset: number, end: boolean): HTMLElement | null => {
    let at: Node | null = node;
    if (at === editor) {
      const children = editor.children;
      const index = end ? Math.max(offset - 1, 0) : offset;
      return (children[Math.min(index, children.length - 1)] as HTMLElement | undefined) ?? null;
    }
    while (at && at.parentNode !== editor) at = at.parentNode;
    return at instanceof HTMLElement ? at : null;
  };
  const first = top(range.startContainer, range.startOffset, false);
  const last = (range.collapsed ? first : top(range.endContainer, range.endOffset, true)) ?? first;
  if (!first || !last) return [];
  const paragraphs: HTMLElement[] = [];
  for (let at: Element | null = first; at; at = at.nextElementSibling) {
    // A table across the range is the paragraphs of the cells it touches.
    if (at.tagName === "TABLE") paragraphs.push(...selectedCellParagraphs(at, range));
    else if (at instanceof HTMLElement) paragraphs.push(at);
    if (at === last) break;
  }
  return paragraphs;
}

/** The format of one paragraph, as `setParagraphFormat` wrote it. */
export function paragraphFormatOf(paragraph: HTMLElement | undefined): ParagraphFormat {
  if (!paragraph) return PLAIN_PARAGRAPH;
  const align = paragraph.style.textAlign;
  return {
    align: align === "center" || align === "right" || align === "justify" ? align : "left",
    spacing: paragraph.dataset.spacing ?? "1.0",
    list: paragraph.dataset.list ?? "none",
  };
}

/** Takes the number a list starts at off a paragraph. */
function clearListStart(paragraph: HTMLElement): void {
  delete paragraph.dataset.listStart;
  paragraph.style.removeProperty("counter-set");
  if (paragraph.getAttribute("style") === "") paragraph.removeAttribute("style");
}

/**
 * Where a list counts from: the first paragraph of the range starts at `start`. No number, or 1 where
 * no list comes before it to count on from, is the ordinary start.
 */
export function setListStart(editor: HTMLElement, range: Range | null, start: number | null): void {
  const [first] = paragraphsOf(editor, range);
  if (!first) return;
  clearListStart(first);
  const ordinary = start === 1 && !(first.previousElementSibling as HTMLElement)?.dataset?.list;
  if (start !== null && !ordinary) {
    first.dataset.listStart = String(start);
    first.style.setProperty("counter-set", `list-item ${start}`);
  }
}

/**
 * A browser that splits a paragraph at Return copies its attributes to the new one, which would make
 * the list count from the same number again. Call it for that input alone: the caret is in the new
 * paragraph, whose copy goes, and the list goes on counting.
 */
export function dropCopiedListStart(editor: HTMLElement): void {
  const focus = editor.ownerDocument.getSelection()?.focusNode ?? null;
  const cell = (focus instanceof Element ? focus : focus?.parentElement)?.closest("td");
  const holder = cell && editor.contains(cell) ? cell : editor;
  let at = focus;
  while (at && at.parentNode !== holder) at = at.parentNode;
  if (!(at instanceof HTMLElement)) return;
  const before = at.previousElementSibling as HTMLElement | null;
  const start = at.dataset.listStart;
  if (start !== undefined && before?.dataset.listStart === start) clearListStart(at);
}

/**
 * Give the paragraphs of a range an alignment, a line spacing or a list style. Returns how
 * many paragraphs were changed: none when the range is not in the view.
 */
export function setParagraphFormat(
  editor: HTMLElement,
  range: Range | null,
  format: Partial<ParagraphFormat>,
): number {
  const paragraphs = paragraphsOf(editor, range);
  for (const paragraph of paragraphs) {
    if (format.align !== undefined) {
      // With a direction set, no alignment means the direction's own start, which may be the right.
      paragraph.style.textAlign =
        format.align === "left" && !paragraph.hasAttribute("dir") ? "" : format.align;
    }
    if (format.spacing !== undefined) {
      const multiple = Number(format.spacing);
      if (multiple > 0 && multiple !== 1) {
        paragraph.dataset.spacing = format.spacing;
        paragraph.style.lineHeight = String(Math.round(LINE_HEIGHT * multiple * 1000) / 1000);
      } else {
        delete paragraph.dataset.spacing;
        paragraph.style.lineHeight = "";
      }
    }
    if (format.list !== undefined) {
      clearListStart(paragraph);
      if (format.list === "none") delete paragraph.dataset.list;
      else paragraph.dataset.list = format.list;
    }
    if (paragraph.getAttribute("style") === "") paragraph.removeAttribute("style");
  }
  return paragraphs.length;
}

/** A paragraph's writing direction: Natural follows its own text. */
export type WritingDirection = "auto" | "ltr" | "rtl";

/** What Copy Ruler keeps of a paragraph: its direction, alignment, line spacing, indents and tabs. */
export interface CopiedRuler {
  direction: string | null;
  align: string;
  lineHeight: string;
  spacing: string | undefined;
  indents?: ParagraphIndents;
  tabs?: string;
}

/** A paragraph's ruler, in points: first line and head from the origin, tail from the end. */
export interface ParagraphIndents {
  first: number;
  head: number;
  tail: number;
}

/** The indent a list keeps for its marker (`textedit.css`), which the ruler does not count. */
const LIST_INDENT = 28;

/** The indents the ruler set on this paragraph itself; `undefined` when it follows the document's. */
export function paragraphIndents(paragraph: HTMLElement): ParagraphIndents | undefined {
  const start = paragraph.style.getPropertyValue("margin-inline-start");
  if (!start) return undefined;
  const head = Number.parseFloat(start) - (paragraph.dataset.list ? LIST_INDENT : 0);
  const offset = Number.parseFloat(paragraph.style.getPropertyValue("text-indent")) || 0;
  const tail = Number.parseFloat(paragraph.style.getPropertyValue("margin-inline-end")) || 0;
  return { first: head + offset, head, tail };
}

function writeIndents(paragraph: HTMLElement, { first, head, tail }: ParagraphIndents) {
  const { style } = paragraph;
  style.setProperty(
    "margin-inline-start",
    `${head + (paragraph.dataset.list ? LIST_INDENT : 0)}px`,
  );
  style.setProperty("margin-inline-end", `${tail}px`);
  if (paragraph.dataset.list) style.removeProperty("text-indent");
  else style.setProperty("text-indent", `${first - head}px`);
}

const MAX_RULER_STEPS = 50;

/** A paragraph's attributes in their order: a step is valid only while the HTML is what it left. */
type RulerAttributes = readonly (readonly [string, string])[];

interface RulerStep {
  put: (way: "before" | "after") => void;
  htmlBefore: string;
  htmlAfter: string;
}

/**
 * Each document's direction, ruler and table changes. The browsers have no command for `dir` or a table's
 * shape, and `insertHTML`, the one that writes a tree, nests the new paragraph in the old (Chromium 156), so
 * these steps are kept here. They change attributes and child lists on the nodes the browser's own history
 * holds, which keeps what it can take back.
 */
const rulerSteps = new WeakMap<HTMLElement, { undo: RulerStep[]; redo: RulerStep[] }>();

const rulerAttributesOf = (paragraph: HTMLElement): RulerAttributes =>
  [...paragraph.attributes].map(({ name, value }) => [name, value] as const);

function keepStep(editor: HTMLElement, step: RulerStep) {
  const steps = rulerSteps.get(editor) ?? { undo: [], redo: [] };
  rulerSteps.set(editor, steps);
  steps.undo = [...steps.undo.slice(1 - MAX_RULER_STEPS), step];
  steps.redo = [];
}

/** What a table's shape is at one moment: its elements' attributes and children, not what cells hold. */
type HeldShape = readonly {
  element: Element;
  attributes: RulerAttributes | null;
  children: readonly ChildNode[];
}[];

const holdShape = (elements: readonly Element[], attributes: boolean): HeldShape =>
  elements.map((element) => ({
    element,
    attributes: attributes ? rulerAttributesOf(element as HTMLElement) : null,
    children: [...element.childNodes],
  }));

/** The elements a change of a table's shape moves, those of the tables in its cells too. */
const tableElements = (table: Element): Element[] => {
  const parts = [...table.children];
  const inner = parts.flatMap((part) => [...part.children]);
  const cells = inner.flatMap((row) => [...row.children]);
  const nested = cells.flatMap((cell) =>
    [...cell.children].filter((child) => child.tagName === "TABLE").flatMap(tableElements),
  );
  return [table, ...parts, ...inner, ...cells, ...nested];
};

function putShape(shape: HeldShape) {
  for (const { element, attributes, children } of shape) {
    if (attributes) {
      for (const { name } of [...element.attributes]) element.removeAttribute(name);
      for (const [name, value] of attributes) element.setAttribute(name, value);
    }
    const now = element.childNodes;
    if (now.length !== children.length || children.some((child, at) => now[at] !== child)) {
      element.replaceChildren(...children);
    }
  }
}

/**
 * One step of Undo around a change of the shape of `table`, or of the view's children where a new table
 * goes with none. Cells and rows come back as the same nodes, so the browser's history of what was typed
 * in them still applies.
 */
export function changeTableShape(
  editor: HTMLElement,
  table: HTMLTableElement | null,
  change: () => void,
) {
  const hold = () => (table ? holdShape(tableElements(table), true) : holdShape([editor], false));
  const htmlBefore = withoutTabLayout(editor.innerHTML);
  const before = hold();
  change();
  const htmlAfter = withoutTabLayout(editor.innerHTML);
  if (htmlAfter === htmlBefore) return;
  const after = hold();
  keepStep(editor, {
    htmlBefore,
    htmlAfter,
    put: (way) => putShape(way === "before" ? before : after),
  });
}

function changeRulers(
  editor: HTMLElement,
  range: Range | null,
  change: (paragraph: HTMLElement) => void,
) {
  const paragraphs = paragraphsOf(editor, range);
  const htmlBefore = withoutTabLayout(editor.innerHTML);
  const before = paragraphs.map(rulerAttributesOf);
  for (const paragraph of paragraphs) {
    change(paragraph);
    if (paragraph.getAttribute("style") === "") paragraph.removeAttribute("style");
  }
  const htmlAfter = withoutTabLayout(editor.innerHTML);
  if (htmlAfter === htmlBefore) return;
  const after = paragraphs.map(rulerAttributesOf);
  keepStep(editor, {
    htmlBefore,
    htmlAfter,
    put: (way) => {
      const values = way === "before" ? before : after;
      paragraphs.forEach((paragraph, at) => {
        for (const { name } of [...paragraph.attributes]) paragraph.removeAttribute(name);
        for (const [name, value] of values[at] ?? []) paragraph.setAttribute(name, value);
      });
    },
  });
}

/** Format > Text > Writing Direction on the paragraphs of a range. */
export function setWritingDirection(
  editor: HTMLElement,
  range: Range | null,
  direction: WritingDirection,
) {
  changeRulers(editor, range, (paragraph) => paragraph.setAttribute("dir", direction));
}

/** The ruler's markers moved, on the paragraphs of a range. */
export function setParagraphIndents(
  editor: HTMLElement,
  range: Range | null,
  indents: ParagraphIndents,
) {
  changeRulers(editor, range, (paragraph) => writeIndents(paragraph, indents));
}

/** The ruler's tab stops changed, on the paragraphs of a range. */
export function setParagraphTabs(
  editor: HTMLElement,
  range: Range | null,
  stops: readonly TabStop[],
) {
  changeRulers(editor, range, (paragraph) => {
    paragraph.dataset.tabs = tabStopsText(stops);
  });
}

/** Copy Ruler: what the first paragraph of a range has. */
export function copyRuler(editor: HTMLElement, range: Range | null): CopiedRuler | null {
  const paragraph = paragraphsOf(editor, range)[0];
  if (!paragraph) return null;
  return {
    direction: paragraph.getAttribute("dir"),
    align: paragraph.style.textAlign,
    lineHeight: paragraph.style.lineHeight,
    spacing: paragraph.dataset.spacing,
    indents: paragraphIndents(paragraph),
    tabs: paragraph.dataset.tabs,
  };
}

/** Paste Ruler on the paragraphs of a range. */
export function pasteRuler(editor: HTMLElement, range: Range | null, ruler: CopiedRuler) {
  changeRulers(editor, range, (paragraph) => {
    if (ruler.direction === null) paragraph.removeAttribute("dir");
    else paragraph.setAttribute("dir", ruler.direction);
    if (ruler.indents) writeIndents(paragraph, ruler.indents);
    if (ruler.tabs !== undefined) paragraph.dataset.tabs = ruler.tabs;
    paragraph.style.textAlign = ruler.align;
    paragraph.style.lineHeight = ruler.lineHeight;
    if (ruler.spacing === undefined) delete paragraph.dataset.spacing;
    else paragraph.dataset.spacing = ruler.spacing;
  });
}

/** Format > Text > Spacing…: a line height multiple, and the space before and after, in points. */
export interface ParagraphSpacing {
  multiple: string;
  before: number;
  after: number;
}

/** What Format > Text > Spacing… shows for a paragraph. */
export function paragraphSpacingOf(paragraph: HTMLElement | undefined): ParagraphSpacing {
  return {
    multiple: paragraph?.dataset.spacing ?? "1.0",
    before: Number.parseFloat(paragraph?.style.marginTop ?? "") || 0,
    after: Number.parseFloat(paragraph?.style.marginBottom ?? "") || 0,
  };
}

/** Format > Text > Spacing… on the paragraphs of a range, one step of Undo. */
export function setParagraphSpacing(
  editor: HTMLElement,
  range: Range | null,
  { multiple, before, after }: ParagraphSpacing,
) {
  changeRulers(editor, range, (paragraph) => {
    const lines = Number(multiple);
    if (lines > 0 && lines !== 1) {
      paragraph.dataset.spacing = multiple;
      paragraph.style.lineHeight = String(Math.round(LINE_HEIGHT * lines * 1000) / 1000);
    } else {
      delete paragraph.dataset.spacing;
      paragraph.style.lineHeight = "";
    }
    paragraph.style.marginTop = before > 0 ? `${before}px` : "";
    paragraph.style.marginBottom = after > 0 ? `${after}px` : "";
  });
}

/**
 * Undo or Redo of a direction, ruler or table change, when that is the last thing done to the document as
 * it stands: anything typed since is the browser's to take back first. Whether it did.
 */
export function stepRuler(editor: HTMLElement, way: "undo" | "redo"): boolean {
  const steps = rulerSteps.get(editor);
  const step = steps?.[way].at(-1);
  if (
    !steps ||
    !step ||
    withoutTabLayout(editor.innerHTML) !== (way === "undo" ? step.htmlAfter : step.htmlBefore)
  ) {
    return false;
  }
  steps[way].pop();
  steps[way === "undo" ? "redo" : "undo"].push(step);
  step.put(way === "undo" ? "before" : "after");
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/**
 * Run one of the browser's editing commands on the selection (`bold`, `fontName`,
 * `foreColor` and the like). The commands are deprecated without a successor, and they are
 * what keeps a format change in the browser's undo history. Returns whether the browser took
 * the command; an environment without them (a test's DOM) takes none.
 */
export function runCommand(document: Document, command: string, value?: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  // Formats are written as CSS, not as <font> and <b>, where the browser can.
  document.execCommand("styleWithCSS", false, "true");
  return document.execCommand(command, false, value);
}

/**
 * Set the selection's font size in points: `setRichTextSize` of `macalicious/lib/rich-text`,
 * which gives selected text any size beyond the browsers' seven and sets the size of what is
 * typed next at an insertion point.
 */
export function setFontSize(editor: HTMLElement, size: number): boolean {
  return setRichTextSize(editor, size);
}

/** Whether the browser reports a toggling format (`bold`) as on at the selection. */
export function commandState(document: Document, command: string): boolean | undefined {
  if (typeof document.queryCommandState !== "function") return undefined;
  try {
    return document.queryCommandState(command);
  } catch {
    return undefined;
  }
}

/** `rgb(r, g, b)` as `#rrggbb`, which a colour well takes; anything else gives `undefined`. */
export function toHex(color: string): string | undefined {
  const parts = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
  if (!parts) return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : undefined;
  return `#${parts
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** The lines of a document split into printed pages of `perPage` lines; at least one page. */
export function paginate(lines: readonly string[], perPage: number): string[][] {
  const pages: string[][] = [];
  for (let at = 0; at < lines.length; at += perPage) pages.push(lines.slice(at, at + perPage));
  return pages.length ? pages : [[]];
}

/** A file name without the extension TextEdit hides in a title: "Letter.rtf" is "Letter". */
export function titleOf(name: string): string {
  return name.replace(/\.rtf$/i, "") || name;
}
