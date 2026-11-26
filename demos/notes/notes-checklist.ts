/*
 * The lists of a note that are `ul` elements with a look of their own: a checklist, whose items
 * tick (`data-checked`), and a dashed list. Everything here is the note's own content, saved with
 * its formats (`noteHtml`), so the server's allow-list names the same class and attribute
 * (`ferrite-apps/desktop/src/apps/notes/mod.rs`).
 */

export const CHECKLIST_CLASS = "mac-notes-checklist";
export const DASHED_CLASS = "mac-notes-dashed";
export const CHECKED_ATTRIBUTE = "data-checked";

/** The commands of Format > Mark as Checked and Format > More. */
export type ChecklistCommand =
  | "mark-checked"
  | "check-all"
  | "uncheck-all"
  | "move-checked"
  | "delete-checked";

/** The list item that holds `at`, inside `editor`. */
export function listItemAt(editor: HTMLElement, at: Node | null): HTMLLIElement | null {
  for (let node = at; node && node !== editor; node = node.parentNode) {
    if (node.nodeName === "LI") return node as HTMLLIElement;
  }
  return null;
}

/** The checklist that holds `at`, inside `editor`. */
export function checklistAt(editor: HTMLElement, at: Node | null): HTMLElement | null {
  const item = listItemAt(editor, at);
  const list = item?.parentElement;
  return list?.classList.contains(CHECKLIST_CLASS) ? list : null;
}

const setChecked = (item: Element, checked: boolean) => {
  if (checked) item.setAttribute(CHECKED_ATTRIBUTE, "true");
  else item.removeAttribute(CHECKED_ATTRIBUTE);
};

/**
 * Tick or untick an item: what a press on its circle does. One step of the browser's undo history,
 * as every change here is.
 */
export function toggleChecked(editor: HTMLElement, item: HTMLElement) {
  const list = item.parentElement;
  if (!list) return;
  const index = [...list.children].indexOf(item);
  const copy = list.cloneNode(true) as HTMLElement;
  const twin = copy.children[index];
  if (twin) setChecked(twin, !twin.hasAttribute(CHECKED_ATTRIBUTE));
  caretIn(replaceUndoably(editor, list, copy).children[index]);
}

/** A mark for what a replacement inserted, there only while it is found. */
const INSERTED = "data-mac-inserted";

function caretIn(node: Node | null | undefined) {
  const document = node?.ownerDocument;
  const selection = document?.getSelection();
  if (!node || !document || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Put `next` where `element` is, as one step of the browser's undo history (`insertHTML` over the
 * element, selected), or in place where the browser has no such command or refuses. Returns what
 * now stands there.
 */
export function replaceUndoably(editor: HTMLElement, element: HTMLElement, next: HTMLElement) {
  const document = editor.ownerDocument;
  if (typeof document.execCommand === "function") {
    const range = document.createRange();
    range.selectNode(element);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus({ preventScroll: true });
    if (document.execCommand("insertHTML", false, next.outerHTML)) {
      // The browser may put the content in the element it had, without the element's attributes.
      const anchor = document.getSelection()?.anchorNode ?? null;
      const at = anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
      const placed = at?.closest<HTMLElement>(next.tagName);
      if (placed && placed !== editor && editor.contains(placed)) {
        if (placed.className !== next.className) {
          if (next.className) placed.className = next.className;
          else placed.removeAttribute("class");
        }
        return placed;
      }
      return editor;
    }
  }
  element.replaceWith(next);
  return next;
}

/**
 * Run a command on the checklist that holds `at`. Returns whether anything changed. Delete Checked
 * removes the list as well when no item is left.
 */
export function runChecklist(
  editor: HTMLElement,
  at: Node | null,
  command: ChecklistCommand,
): boolean {
  const list = checklistAt(editor, at);
  if (!list) return false;
  const itemAt = listItemAt(editor, at);
  const index = itemAt ? [...list.children].indexOf(itemAt) : -1;
  const copy = list.cloneNode(true) as HTMLElement;
  const items = [...copy.children].filter((child) => child.tagName === "LI");
  const ticked = items.filter((item) => item.hasAttribute(CHECKED_ATTRIBUTE));
  let caret: Element | undefined = items[index];
  switch (command) {
    case "mark-checked": {
      if (!caret) return false;
      setChecked(caret, !caret.hasAttribute(CHECKED_ATTRIBUTE));
      break;
    }
    case "check-all":
      if (items.length === ticked.length) return false;
      for (const item of items) setChecked(item, true);
      break;
    case "uncheck-all":
      if (ticked.length === 0) return false;
      for (const item of items) setChecked(item, false);
      break;
    case "move-checked":
      if (ticked.length === 0) return false;
      for (const item of ticked) copy.append(item);
      break;
    case "delete-checked": {
      if (ticked.length === 0) return false;
      for (const item of ticked) item.remove();
      if (copy.children.length === 0) {
        const empty = editor.ownerDocument.createElement("div");
        empty.append(editor.ownerDocument.createElement("br"));
        caretIn(replaceUndoably(editor, list, empty));
        return true;
      }
      caret = copy.contains(caret ?? null) ? caret : (copy.lastElementChild ?? undefined);
      break;
    }
  }
  const position = caret ? [...copy.children].indexOf(caret) : -1;
  const placed = replaceUndoably(editor, list, copy);
  caretIn(placed.children[position] ?? placed.lastElementChild);
  return true;
}

/** Format > Move List Item: the item that holds `at` goes up or down its list, keeping the caret. */
export function moveListItem(editor: HTMLElement, at: Node | null, up: boolean): boolean {
  const item = listItemAt(editor, at);
  const list = item?.parentElement;
  if (!item || !list) return false;
  const index = [...list.children].indexOf(item);
  const to = index + (up ? -1 : 1);
  if (!list.children[to]) return false;
  const copy = list.cloneNode(true) as HTMLElement;
  const moved = copy.children[index] as Element;
  const beside = copy.children[to] as Element;
  copy.insertBefore(up ? moved : beside, up ? beside : moved);
  caretIn(replaceUndoably(editor, list, copy).children[to]);
  return true;
}

/**
 * Format > Convert to Text: the table that holds `at` becomes one line of text per row, its cells
 * parted by tabs, the lines of a cell by spaces (`readLines` reads a cell as the note reads its
 * text). Returns the first line, for the caret, or `null` outside a table.
 */
export function tableToText(
  editor: HTMLElement,
  at: Node | null,
  readLines: (root: Node) => string[],
): HTMLElement | null {
  let table: Node | null = at;
  while (table && table !== editor && table.nodeName !== "TABLE") table = table.parentNode;
  if (!table || table === editor) return null;
  const element = table as HTMLTableElement;
  const document = editor.ownerDocument;
  const holder = document.createElement("div");
  for (const row of element.rows) {
    const line = document.createElement("div");
    const text = [...row.cells].map((cell) => readLines(cell).join(" ")).join("\t");
    if (text === "") line.append(document.createElement("br"));
    else line.textContent = text;
    holder.append(line);
  }
  const first = holder.firstElementChild as HTMLElement | null;
  if (!first) return null;
  if (typeof document.execCommand === "function") {
    first.setAttribute(INSERTED, "");
    const range = document.createRange();
    range.selectNode(element);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const done = document.execCommand("insertHTML", false, holder.innerHTML);
    const inserted = editor.querySelector<HTMLElement>(`[${INSERTED}]`);
    inserted?.removeAttribute(INSERTED);
    first.removeAttribute(INSERTED);
    if (done) return inserted;
  }
  const lines = [...holder.children] as HTMLElement[];
  if (element.isConnected) element.replaceWith(...lines);
  return lines[0] ?? null;
}
