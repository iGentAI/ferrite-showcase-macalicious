"use client";

import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { type ReactNode, useState } from "react";

/*
 * Undo to Select All for an application that keeps no text of its own: they act on the text field
 * that had the keyboard before the menu took it, or on the text selected in the window, and are
 * dimmed, saying why, when there is neither. A menu takes the keyboard while it is open, so the field
 * is remembered here rather than read from the focus.
 */

const TEXT_INPUTS = new Set(["text", "search", "url", "email", "tel", "number", ""]);

function isTextField(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLInputElement) return TEXT_INPUTS.has(element.type);
  return element instanceof HTMLTextAreaElement || (element as HTMLElement)?.isContentEditable;
}

let field: HTMLElement | null = null;

/**
 * The menu holds the keyboard until it has faded out (`menu.css`: 0.25 s after a choice), and a field
 * cannot take it before. Then the command runs on it, and the field keeps the keyboard, as after a
 * Mac's menu command.
 */
const MENU_FADE_MS = 300;
const MENUS = '[role="menu"], [role="menubar"], [aria-haspopup="menu"]';

if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target as Element;
      if (isTextField(target)) field = target;
      // Into a menu, the menu bar or what opens a menu, the field is still the one its commands are for.
      else if (!target.closest(MENUS)) field = null;
    },
    true,
  );
  // Pressing what takes no keyboard moves focus to no element, so no focusin says the field was left.
  // The focus moves after the press; a press that leaves it where it was has not left the field.
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as Element;
      if (isTextField(target) || target.closest(MENUS)) return;
      setTimeout(() => {
        if (document.activeElement !== field) field = null;
      });
    },
    true,
  );
}

const fieldNow = () => (field?.isConnected ? field : null);

const writable = (element: HTMLElement | null) =>
  element !== null &&
  !(element as HTMLInputElement).readOnly &&
  !(element as HTMLInputElement).disabled;

/** The field whose keyboard a menu has taken for a moment, when typing can go into it. */
export function writableField(): HTMLElement | null {
  const now = fieldNow();
  return writable(now) ? now : null;
}

/** Whether a field or the page has text selected. */
function hasSelection(element: HTMLElement | null): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // An email or number input tells no one its selection, so what is in it may be selected.
    if (element.selectionStart === null) return element.value !== "";
    return element.selectionStart !== element.selectionEnd;
  }
  return (document.getSelection()?.toString() ?? "") !== "";
}

/** A field's selection, which a field that selects its text as it takes the keyboard would lose. */
function selectionIn(element: HTMLElement): [number, number] | null {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return null;
  const { selectionStart: start, selectionEnd: end } = element;
  return start === null || end === null ? null : [start, end];
}

/**
 * `then`, on the field with the keyboard, once the menu has let go of it, with the selection the field
 * had when the row was chosen. Not if the person has gone on to something else meanwhile, in this page
 * or another application: the keyboard is not taken back from them.
 */
export function onceFree(on: HTMLElement, then: () => void, selection = selectionIn(on)) {
  setTimeout(() => {
    if (fieldNow() !== on || !document.hasFocus()) return;
    on.focus();
    if (document.activeElement !== on) return;
    if (selection) (on as HTMLInputElement).setSelectionRange(...selection);
    then();
  }, MENU_FADE_MS);
}

function run(command: string) {
  const now = fieldNow();
  if (now) onceFree(now, () => document.execCommand(command));
  // Text selected in the window needs no keyboard.
  else document.execCommand(command);
}

/** The text selected on the page. A press on a row takes it away in WebKit, as the row takes the keyboard. */
function pageSelection(): Range | null {
  const held = document.getSelection();
  return held && !held.isCollapsed ? held.getRangeAt(0).cloneRange() : null;
}

function copy(held: Range | null) {
  if (held && !fieldNow()) {
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(held);
  }
  run("copy");
}

/**
 * Paste asks the browser's clipboard, which answers later: by then the menu has let go of the keys,
 * and the field may have gone. The text goes in only if that field then has the keyboard.
 */
function paste(say: (message: string) => void) {
  const into = fieldNow();
  const selection = into && selectionIn(into);
  navigator.clipboard.readText().then(
    (text) => {
      if (!into || fieldNow() !== into || !writable(into)) return;
      onceFree(
        into,
        () => {
          if (!document.execCommand("insertText", false, text)) say(PASTE_REFUSED);
        },
        selection,
      );
    },
    () => say(PASTE_REFUSED),
  );
}

const PASTE_REFUSED =
  "This browser did not let the menu paste here. Press Command-V in the field to paste.";

export interface EditRowsProps {
  /** Why a row that needs a text field or a selection is dimmed. */
  nothing: string;
  /** Select All where no field has the keyboard, when the window has something else to select. */
  selectAll?: { enabled: boolean; title?: string; run: () => void };
  /** Tells the person what a row could not do. */
  say: (message: string) => void;
  /** Rows of the application's own between Paste and Select All: Paste and Match Style, Delete. */
  afterPaste?: ReactNode;
}

/**
 * The rows from Undo to Select All. The popup of a menu mounts each time it opens, so what is dimmed
 * is read as it opens.
 */
export function EditRows({ nothing, selectAll, say, afterPaste }: EditRowsProps) {
  const now = fieldNow();
  const canWrite = writable(now);
  const selected = hasSelection(now);
  const [held] = useState(pageSelection);
  const canPaste = typeof navigator !== "undefined" && Boolean(navigator.clipboard?.readText);
  const row = (
    title: string,
    key: string,
    enabled: boolean,
    onClick: () => void,
    why = nothing,
  ) => (
    <MenuItem
      keyEquivalent={key}
      disabled={!enabled}
      title={enabled ? undefined : why}
      onClick={onClick}
    >
      {title}
    </MenuItem>
  );
  const all = now
    ? { enabled: true, title: undefined, run: () => run("selectAll") }
    : (selectAll ?? { enabled: false, title: nothing, run: () => {} });
  return (
    <>
      {row("Undo", "command+z", canWrite, () => run("undo"))}
      {row("Redo", "shift+command+z", canWrite, () => run("redo"))}
      <MenuSeparator />
      {row("Cut", "command+x", canWrite && selected, () => run("cut"))}
      {row("Copy", "command+c", selected, () => copy(held))}
      {row(
        "Paste",
        "command+v",
        canWrite && canPaste,
        () => paste(say),
        canWrite ? PASTE_REFUSED : nothing,
      )}
      {afterPaste}
      <MenuItem
        keyEquivalent="command+a"
        disabled={!all.enabled}
        title={all.enabled ? undefined : all.title}
        onClick={all.run}
      >
        Select All
      </MenuItem>
    </>
  );
}
