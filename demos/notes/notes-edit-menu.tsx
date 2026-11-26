"use client";

import { richTextFromHtml } from "macalicious/lib/rich-text";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { type MouseEvent, type ReactNode, useEffect, useSyncExternalStore } from "react";
import { copiedDriveItems, useCopiedDriveItems } from "../desktop/desktop-clipboard";
import { lookUp } from "../dictionary/dictionary-desktop";
import type { TextFind } from "./notes-find";
import { whenMenusClosed } from "./notes-menus";
import { placeTableCaret, tableCaretAfterHistory } from "./notes-table";

/*
 * The Edit menu of the editors (Notes, TextEdit and Stickies) in the desktop's menu bar: Undo,
 * Redo, Cut, Copy, Paste and Select All, on the text the window last had the keyboard in, which
 * takes the keyboard and its selection back. The keys stay the browser's own (Command-Z and the
 * rest, Control off Apple platforms): the menu acts only when it is chosen.
 *
 * Undo, Redo, Cut and Copy are the browser's editing commands on the restored selection, run in
 * the click itself so that the browser counts them as the person's. A browser lets a page write
 * the clipboard from a click but not read it: Paste asks for the clipboard
 * (`navigator.clipboard.read`), and some browsers ask the person or refuse. While it waits the
 * menu stays open; when the browser refuses, Paste is dimmed with the reason there, for the rest of
 * the page's life, since the keyboard's Paste still works.
 */

/** The text an Edit command acts on, as the window that registered the menu gives it. */
export interface EditMenuTarget {
  /** The text's element: an editable element, or a text area for a plain text document. */
  element: HTMLElement;
  /** Give the text the keyboard and the selection it last had. */
  restore: () => void;
  /** Whether the text can be changed: not a locked note, not a document still being read. */
  editable: boolean;
  /** Whether pasted text keeps its formats: not in a plain text document. */
  rich: boolean;
  /** Undo or Redo of a change the text keeps itself, not the browser. Whether there was one. */
  history?: (way: "undo" | "redo") => boolean;
  /**
   * Which document the element shows, where it can show another in its place: Paste waits for the
   * browser, and what it read goes only into the document it was chosen for.
   */
  document?: unknown;
}

/** The window's text, when it is still the text and document of `at` and can be changed. */
function stillEditable(
  target: () => EditMenuTarget | null,
  at: EditMenuTarget,
): EditMenuTarget | null {
  const then = target();
  return then &&
    then.element === at.element &&
    then.document === at.document &&
    then.element.isConnected &&
    then.editable &&
    !then.element.closest("[inert]")
    ? then
    : null;
}

/** The text fields whose last selection the menu remembers, as the editors mark them. */
const TEXT = '[role="textbox"], [contenteditable="true"]';

/** Whether each text field's last selection held text, for Cut and Copy once a menu took it. */
const holding = new WeakMap<Element, boolean>();

if (typeof document !== "undefined") {
  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection();
    const anchor = selection?.anchorNode ?? null;
    const element = anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
    const field = element?.closest(TEXT);
    if (field && selection) holding.set(field, !selection.isCollapsed);
  });
}

/** Whether the text's selection, now or as it last was, holds something to cut or copy. */
function holdsSelection(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement)
    return element.selectionStart !== element.selectionEnd;
  const selection = element.ownerDocument.getSelection();
  if (selection && selection.rangeCount > 0 && element.contains(selection.anchorNode)) {
    return !selection.isCollapsed;
  }
  return holding.get(element) ?? false;
}

/**
 * What the browser lets Paste do: not known until it is asked, allowed, refused (by the person or
 * the browser), or impossible (no clipboard to read).
 */
type PasteAccess = "unknown" | "allowed" | "refused" | "unavailable";

let access: PasteAccess = "unknown";
let asked = false;
const accessListeners = new Set<() => void>();
function noteAccess(next: PasteAccess) {
  if (next === access) return;
  access = next;
  for (const listener of accessListeners) listener();
}

/**
 * Ask once what the browser says of reading the clipboard: whether there is a clipboard to read,
 * and, where the browser names the permission (Chromium), whether it is granted or denied. Other
 * browsers say only when Paste is chosen.
 */
function askAccess() {
  if (asked || typeof navigator === "undefined") return;
  asked = true;
  const clipboard = navigator.clipboard;
  if (
    !clipboard ||
    (typeof clipboard.read !== "function" && typeof clipboard.readText !== "function")
  ) {
    noteAccess("unavailable");
    return;
  }
  navigator.permissions?.query({ name: "clipboard-read" as PermissionName }).then(
    (status) => {
      const apply = () => {
        if (status.state === "denied") noteAccess("refused");
        else if (status.state === "granted") noteAccess("allowed");
      };
      apply();
      status.addEventListener?.("change", apply);
    },
    // Firefox and Safari do not name the permission: the first Paste finds out.
    () => undefined,
  );
}

function usePasteAccess(): PasteAccess {
  useEffect(askAccess, []);
  return useSyncExternalStore(
    (listener) => {
      accessListeners.add(listener);
      return () => accessListeners.delete(listener);
    },
    () => access,
    () => "unknown",
  );
}

/** What the clipboard holds: its text, and its formatted text when there is one. */
interface Clip {
  text: string;
  html?: string;
}

/** Read the clipboard, its formatted text too when `rich`. Called in the click, before any wait. */
async function readClipboard(rich: boolean): Promise<Clip> {
  const clipboard = navigator.clipboard;
  if (!rich || typeof clipboard.read !== "function") return { text: await clipboard.readText() };
  for (const item of await clipboard.read()) {
    const of = async (type: string) =>
      item.types.includes(type) ? (await item.getType(type)).text() : undefined;
    const html = await of("text/html");
    const text = (await of("text/plain")) ?? "";
    if (html !== undefined || text !== "") return html === undefined ? { text } : { text, html };
  }
  return { text: "" };
}

/**
 * Put what was read where the selection is, as the keyboard's Paste would, so that the browser
 * can undo it and the window hears it as an edit: formatted text rebuilt from what formatting
 * writes (`richTextFromHtml`: nothing in it runs or loads), or the text alone.
 */
function insertClip(element: HTMLElement, clip: Clip, rich: boolean) {
  const document = element.ownerDocument;
  if (rich && clip.html !== undefined && !(element instanceof HTMLTextAreaElement)) {
    const holder = document.createElement("div");
    holder.append(richTextFromHtml(clip.html, document));
    if (document.execCommand("insertHTML", false, holder.innerHTML)) return;
  }
  document.execCommand("insertText", false, clip.text);
}

/** Close the menu that holds `item`, as Escape does. */
function closeMenu(item: HTMLElement) {
  item.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
}

const isApple = () => typeof navigator !== "undefined" && /Mac|iP/.test(navigator.platform);

export interface EditorEditItemsProps {
  /**
   * The text the commands act on, as it is when the menu opens and when a command is chosen; `null`
   * when the window shows none (a gallery, no note).
   */
  target: () => EditMenuTarget | null;
}

/**
 * The editors' Edit menu, for the desktop's menu bar (`useDesktopAppMenu(app, "Edit", ...)`).
 * Undo, Redo, Cut and Paste are dimmed for text that cannot be changed; Cut and Copy when nothing
 * is selected; Paste, with the reason, when the browser refuses to let a menu read the clipboard.
 */
export function EditorEditItems({ target }: EditorEditItemsProps) {
  const pasteAccess = usePasteAccess();
  const now = target();
  const usable = now !== null && !now.element.closest("[inert]");
  const editable = usable && now.editable;
  const selected = usable && holdsSelection(now.element);
  const refused = pasteAccess === "refused" || pasteAccess === "unavailable";

  /** Run a command of the browser on the text, and give it the keyboard once the menu closed. */
  const run = (command: "undo" | "redo" | "cut" | "copy") => {
    const at = target();
    if (!at) return;
    at.restore();
    if ((command === "undo" || command === "redo") && at.history?.(command)) {
      whenMenusClosed(at.element.ownerDocument, () => target()?.restore());
      return;
    }
    at.element.ownerDocument.execCommand(command);
    // Undo and Redo of a Notes table change put the insertion point back in the table (WebKit
    // leaves it outside after execCommand); the window's restore then keeps that place.
    if ((command === "undo" || command === "redo") && at.element instanceof HTMLElement) {
      const caret = tableCaretAfterHistory(at.element, command === "redo");
      if (caret) placeTableCaret(caret);
    }
    whenMenusClosed(at.element.ownerDocument, () => target()?.restore());
  };

  const selectAll = () => {
    const at = target();
    if (!at) return;
    at.restore();
    const element = at.element;
    const document = element.ownerDocument;
    const range = document.createRange();
    range.selectNodeContents(element);
    // The whole text, selected now and again once the menu has closed (the window's own
    // restore would give back the selection it last heard of, which may be the one before).
    const select = () => {
      if (element instanceof HTMLTextAreaElement) {
        element.select();
        return;
      }
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };
    select();
    whenMenusClosed(document, () => {
      if (target()?.element !== element || !element.isConnected) return;
      element.focus({ preventScroll: true });
      select();
    });
  };

  const holdsFiles = useCopiedDriveItems().length > 0;

  // The clipboard is asked for in the click, as browsers require. The menu stays open while the
  // browser answers (it may ask the person): read, it closes and the text goes in where the
  // selection was, provided the window still shows that same text and it can still be changed
  // (the person may have shown another note, or locked this one, meanwhile); refused, Paste is
  // dimmed with the reason, in the menu still open.
  const paste = (event: MouseEvent<HTMLElement>) => {
    const at = target();
    if (!at) return;
    const item = event.currentTarget;
    // Files on the desktop's own clipboard need no browser's leave: a window that takes files takes them
    // from a paste event, as from the key.
    if (
      copiedDriveItems().length > 0 &&
      !at.element.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer(),
        }),
      )
    ) {
      closeMenu(item);
      return;
    }
    readClipboard(at.rich).then(
      (clip) => {
        noteAccess("allowed");
        closeMenu(item);
        // `whenMenusClosed` gives the keyboard back a second time a frame later, against a menu
        // that takes it once more: the clipboard goes in once.
        let inserted = false;
        whenMenusClosed(at.element.ownerDocument, () => {
          const then = stillEditable(target, at);
          if (!then) return;
          then.restore();
          if (inserted) return;
          inserted = true;
          insertClip(then.element, clip, then.rich);
        });
      },
      () => noteAccess("refused"),
    );
  };

  return (
    <>
      <MenuItem keyEquivalent="command+z" disabled={!editable} onClick={() => run("undo")}>
        Undo
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+z" disabled={!editable} onClick={() => run("redo")}>
        Redo
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+x"
        disabled={!editable || !selected}
        onClick={() => run("cut")}
      >
        Cut
      </MenuItem>
      <MenuItem keyEquivalent="command+c" disabled={!selected} onClick={() => run("copy")}>
        Copy
      </MenuItem>
      <MenuItem
        keyEquivalent="command+v"
        disabled={!editable || (refused && !holdsFiles)}
        closeOnClick={false}
        onClick={paste}
      >
        Paste
      </MenuItem>
      {editable && refused && !holdsFiles ? (
        <MenuItem disabled className="mac-editor-paste-reason">
          {`This browser keeps the clipboard from menus: ${isApple() ? "⌘V" : "Ctrl+V"} still pastes`}
        </MenuItem>
      ) : null}
      <MenuItem keyEquivalent="command+a" disabled={!usable} onClick={selectAll}>
        Select All
      </MenuItem>
    </>
  );
}

/** The text selected in the target, now or as the window can give it back; only what is inside it. */
export function selectedText(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement) {
    return element.value.slice(element.selectionStart, element.selectionEnd);
  }
  const selection = element.ownerDocument.getSelection();
  if (!selection?.rangeCount || !element.contains(selection.anchorNode)) return "";
  if (element.contains(selection.focusNode)) return selection.toString();
  const range = selection.getRangeAt(0).cloneRange();
  const inside = element.ownerDocument.createRange();
  inside.selectNodeContents(element);
  if (range.compareBoundaryPoints(Range.START_TO_START, inside) < 0) {
    range.setStart(inside.startContainer, inside.startOffset);
  }
  if (range.compareBoundaryPoints(Range.END_TO_END, inside) > 0) {
    range.setEnd(inside.endContainer, inside.endOffset);
  }
  return range.toString();
}

const capitalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/(^|[\s\p{P}])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase());

/** Speech: the browser's own voice (`speechSynthesis`), dimmed where it has none. */
export function SpeechItems({ target }: EditorEditItemsProps) {
  const now = target();
  const usable = now !== null && !now.element.closest("[inert]");
  const speech = typeof speechSynthesis !== "undefined";
  const why = speech ? undefined : SPEECH_REASON;
  return (
    <Submenu>
      <SubmenuTrigger>Speech</SubmenuTrigger>
      <SubmenuPopup>
        <MenuItem
          disabled={!usable || !speech}
          title={why}
          onClick={() => {
            const at = target();
            if (!at) return;
            at.restore();
            const text =
              selectedText(at.element) ||
              (at.element instanceof HTMLTextAreaElement
                ? at.element.value
                : (at.element.textContent ?? ""));
            speechSynthesis.cancel();
            speechSynthesis.speak(new SpeechSynthesisUtterance(text));
          }}
        >
          Start Speaking
        </MenuItem>
        <MenuItem disabled={!speech} title={why} onClick={() => speechSynthesis.cancel()}>
          Stop Speaking
        </MenuItem>
      </SubmenuPopup>
    </Submenu>
  );
}

const SPEECH_REASON = "This browser has no voice to speak with.";

export interface EditorMoreItemsProps extends EditorEditItemsProps {
  /** The window's find bar: the Find submenu acts on it. */
  find: () => TextFind;
  /** Whether the Find submenu offers Find and Replace: Notes has none. */
  replace?: boolean;
  /** Rows of the window's own between Delete and the Find submenu. */
  beforeFind?: ReactNode;
  /** Whether the menu offers Paste and Retain Style. */
  retainStyle?: boolean;
}

/**
 * The rest of the editors' Edit menu below Select All: Paste and Match Style, Delete, Find, Look Up,
 * Transformations and Speech. Speech is the browser's own (`speechSynthesis`), dimmed where it has
 * none.
 */
export function EditorMoreItems({
  target,
  find,
  replace = false,
  beforeFind,
  retainStyle = false,
}: EditorMoreItemsProps) {
  const pasteAccess = usePasteAccess();
  const now = target();
  const usable = now !== null && !now.element.closest("[inert]");
  const editable = usable && now.editable;
  const selected = usable && holdsSelection(now.element);
  const refused = pasteAccess === "refused" || pasteAccess === "unavailable";

  /** Do `work` on the text of `at` once the menu has closed and it has the keyboard back. */
  const afterMenu = (work: (element: HTMLElement) => void, at = target()) => {
    if (!at) return;
    let done = false;
    whenMenusClosed(at.element.ownerDocument, () => {
      const then = stillEditable(target, at);
      if (!then) return;
      then.restore();
      if (done) return;
      done = true;
      work(then.element);
    });
  };
  const transform = (change: (text: string) => string) =>
    afterMenu((element) => {
      const text = selectedText(element);
      if (text !== "") element.ownerDocument.execCommand("insertText", false, change(text));
    });
  const pasteRead = (rich: boolean) => {
    const at = target();
    if (!at) return;
    readClipboard(rich).then(
      (clip) => {
        noteAccess("allowed");
        // The person may have shown another note, or locked this one, while the browser asked.
        if (stillEditable(target, at)) {
          afterMenu((element) => insertClip(element, rich ? clip : { text: clip.text }, rich), at);
        }
      },
      () => noteAccess("refused"),
    );
  };

  return (
    <>
      <MenuItem
        keyEquivalent="option+shift+command+v"
        disabled={!editable || refused}
        onClick={() => pasteRead(false)}
      >
        Paste and Match Style
      </MenuItem>
      {retainStyle ? (
        <MenuItem disabled={!editable || refused} onClick={() => pasteRead(true)}>
          Paste and Retain Style
        </MenuItem>
      ) : null}
      <MenuItem
        disabled={!editable || !selected}
        onClick={() => afterMenu((element) => element.ownerDocument.execCommand("delete"))}
      >
        Delete
      </MenuItem>
      <MenuSeparator />
      {beforeFind}
      <Submenu>
        <SubmenuTrigger>Find</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem keyEquivalent="command+f" onClick={() => find().open()}>
            Find…
          </MenuItem>
          {replace ? (
            <MenuItem keyEquivalent="option+command+f" onClick={() => find().open(true)}>
              Find and Replace…
            </MenuItem>
          ) : null}
          <MenuItem keyEquivalent="command+g" onClick={() => find().move(false)}>
            Find Next
          </MenuItem>
          <MenuItem keyEquivalent="shift+command+g" onClick={() => find().move(true)}>
            Find Previous
          </MenuItem>
          <MenuItem keyEquivalent="command+e" onClick={() => find().fromSelection()}>
            Use Selection for Find
          </MenuItem>
          <MenuItem keyEquivalent="command+j" onClick={() => find().jump()}>
            Jump to Selection
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuItem
        disabled={!selected}
        onClick={() => {
          const at = target();
          if (!at) return;
          at.restore();
          lookUp(selectedText(at.element));
        }}
      >
        Look Up
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Transformations</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem
            disabled={!editable || !selected}
            onClick={() => transform((t) => t.toUpperCase())}
          >
            Make Upper Case
          </MenuItem>
          <MenuItem
            disabled={!editable || !selected}
            onClick={() => transform((t) => t.toLowerCase())}
          >
            Make Lower Case
          </MenuItem>
          <MenuItem disabled={!editable || !selected} onClick={() => transform(capitalize)}>
            Capitalize
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <SpeechItems target={target} />
    </>
  );
}
