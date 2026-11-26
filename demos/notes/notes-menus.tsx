"use client";

import {
  RICH_TEXT_KEY_EQUIVALENTS,
  type RichTextAlignment,
  type RichTextCommand,
  type RichTextFormat,
} from "macalicious/lib/rich-text";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { Fragment, useCallback, useLayoutEffect, useRef } from "react";
import { AIRDROP_REASON, shareTargets } from "../desktop/desktop-share-link";
import type { ChecklistCommand } from "./notes-checklist";
import type { NotesSort } from "./notes-data";
import type { NotesDirection, NotesParagraphStyle } from "./notes-editor";
import type { NotesAttachmentView, NotesView } from "./notes-settings";
import type { NotesTableCommand } from "./notes-table";

/** What a menu needs to know of the note to enable and check its Format commands. */
export interface NotesStatus {
  /**
   * Whether the note shown can be formatted: there is one, it is shown in the list view, and
   * it is not locked.
   */
  editable: boolean;
  /**
   * The format where the insertion point is in the note (or where it last was): what the
   * Font and Text commands check and the Fonts panel shows. `null` while no note is shown.
   */
  format: RichTextFormat | null;
  /**
   * The paragraph style of the line with the insertion point, or `null` when the insertion
   * point is elsewhere or the line has none (a table, a picture).
   */
  paragraph: NotesParagraphStyle | null;
  /**
   * The kind of list the insertion point is in, or `null` outside a list: what Bulleted List
   * and Numbered List check.
   */
  list?: NotesListKind | null;
  /**
   * Whether the insertion point is in a cell of a table (or last was): what enables Format >
   * Table's row and column commands.
   */
  table?: boolean;
  /** The writing direction of the line with the insertion point. */
  direction?: NotesDirection;
}

/** A list of Notes' Format menu. */
export type NotesListKind = "bulleted" | "dashed" | "numbered" | "checklist";

/** The Format commands that act on the text and need nothing but the note. */
export type NotesTextCommand =
  | ChecklistCommand
  | "item-up"
  | "item-down"
  | "add-table"
  | "table-to-text"
  | "indent"
  | "outdent"
  | "copy-style"
  | "paste-style"
  | "direction-natural"
  | "direction-ltr"
  | "direction-rtl";

/** The app's commands, for a menu bar or a desktop page that hosts the window. */
export interface NotesActions {
  /** File > New Note: a note in the folder shown, with the insertion point in it. */
  newNote: () => void;
  /** Format > Title, Heading and Body: the style of the line with the insertion point. */
  setParagraphStyle: (style: NotesParagraphStyle) => void;
  /**
   * Format > Font and Format > Text: a command on the selection in the note, or Show Fonts and
   * Show Colors, which open the Fonts and Colors panels.
   */
  runTextCommand: (command: RichTextCommand) => void;
  /**
   * Format > Bulleted List and Numbered List: the lines with the selection become a list of that
   * kind, or plain lines again when they already are one.
   */
  setList: (kind: NotesListKind) => void;
  /**
   * Format > Table: add a row above or below, or a column before or after, the cell with the
   * insertion point, or delete its row or column.
   */
  runTableCommand: (command: NotesTableCommand) => void;
  /**
   * Give the keyboard back to the note being edited, with its selection: what a menu does once
   * it has closed after one of the Format commands, or after New Note (to the new note).
   */
  focusNote: () => void;
}

const STYLES: [NotesParagraphStyle, string, string][] = [
  ["title", "Title", "shift+command+t"],
  ["heading", "Heading", "shift+command+h"],
  ["subheading", "Subheading", "shift+command+j"],
  ["body", "Body", "shift+command+b"],
  ["monospaced", "Monospaced", "shift+command+m"],
];
const TOGGLES: ["bold" | "italic" | "underline" | "strikethrough", string][] = [
  ["bold", "Bold"],
  ["italic", "Italic"],
  ["underline", "Underline"],
  ["strikethrough", "Strikethrough"],
];
const ALIGNMENTS: [RichTextAlignment, string][] = [
  ["left", "Align Left"],
  ["center", "Center"],
  ["justify", "Justify"],
  ["right", "Align Right"],
];
const DIRECTIONS: [NotesDirection, string][] = [
  ["natural", "Natural"],
  ["ltr", "Left to Right"],
  ["rtl", "Right to Left"],
];
const key = (command: RichTextCommand) => RICH_TEXT_KEY_EQUIVALENTS[command];
/** Notes' lists, with their key equivalents. */
const LISTS: [NotesListKind, string, string][] = [
  ["bulleted", "Bulleted List", "shift+command+7"],
  ["dashed", "Dashed List", "shift+command+8"],
  ["numbered", "Numbered List", "shift+command+9"],
];
/**
 * The commands of Catalina's Format > Table submenu, on the table the insertion point is in, with
 * Notes' key equivalents for the four that add (Option-Command and an arrow).
 */
const TABLE_COMMANDS: [NotesTableCommand, string, string | undefined][] = [
  ["row-above", "Add Row Above", "option+command+up"],
  ["row-below", "Add Row Below", "option+command+down"],
  ["column-before", "Add Column Before", "option+command+left"],
  ["column-after", "Add Column After", "option+command+right"],
  ["delete-row", "Delete Row", undefined],
  ["delete-column", "Delete Column", undefined],
];

/**
 * Run `then` once no menu is open any more, for a command chosen from a menu that is not the
 * app's own (the desktop's menu bar): as it closes, that menu gives the keyboard back to its
 * title, so the app takes it back afterwards. The menu's focus manager does that in a frame of
 * its own after the menu has gone, so `then` runs again after the next frame; it must be safe to
 * run twice (giving an editor its kept selection back is). Neither run happens while a menu is
 * open, and neither once the person has moved on (a press, or a key with Command or Control): the
 * next menu they opened, or the window they chose or went to, stands. After about two seconds of
 * open menus it gives up.
 */
export function whenMenusClosed(document: Document, then: () => void) {
  const view = document.defaultView;
  const menuOpen = () => document.querySelector('[role="menu"]') !== null;
  if (!view) {
    if (!menuOpen()) then();
    return;
  }
  const listening = new AbortController();
  let movedOn = false;
  const moveOn = (event: Event) => {
    const key = event as KeyboardEvent;
    if (event.type === "keydown" && !key.metaKey && !key.ctrlKey) return;
    movedOn = true;
    listening.abort();
  };
  const options = { capture: true, signal: listening.signal };
  document.addEventListener("pointerdown", moveOn, options);
  document.addEventListener("keydown", moveOn, options);
  let frames = 0;
  const check = () => {
    if (movedOn) return;
    if (menuOpen()) {
      if (++frames < 120) view.requestAnimationFrame(check);
      else listening.abort();
      return;
    }
    then();
    view.requestAnimationFrame(() =>
      view.setTimeout(() => {
        listening.abort();
        if (!movedOn && !menuOpen()) then();
      }, 0),
    );
  };
  view.requestAnimationFrame(check);
}

/**
 * For a menu whose commands give the keyboard back to the note: once one was chosen, the menu
 * does not return the focus to its title or button but, once it has closed, calls `focusNote`.
 * (While it closes, the menu keeps the focus itself, so the note cannot take it earlier.)
 * `finalFocus` goes to the menu's popup, and `chosen` is called by each command.
 */
export function useNoteFocus(focusNote: () => void) {
  const chosen = useRef(false);
  const latest = useRef(focusNote);
  useLayoutEffect(() => {
    latest.current = focusNote;
  });
  const finalFocus = useCallback(() => {
    if (!chosen.current) return true;
    chosen.current = false;
    queueMicrotask(() => latest.current());
    return false;
  }, []);
  const choose = useCallback(() => {
    chosen.current = true;
  }, []);
  return { finalFocus, chosen: choose };
}

export interface NotesFormatItemsProps {
  /** The note's state: enables the items and checks the style where the insertion point is. */
  status: NotesStatus | undefined;
  /** Called with the paragraph style chosen. */
  onParagraphStyle: (style: NotesParagraphStyle) => void;
  /** Called with the Font or Text command chosen. */
  onTextCommand: (command: RichTextCommand) => void;
  /** Called with the list chosen: Bulleted List or Numbered List. Without it they are dimmed. */
  onList?: (kind: NotesListKind) => void;
  /**
   * Called with the Format > Table command chosen. Without it, or with the insertion point outside
   * a table, they are dimmed.
   */
  onTable?: (command: NotesTableCommand) => void;
  /** Called with the Format command chosen that acts on the text (`NotesTextCommand`). */
  onCommand?: (command: NotesTextCommand) => void;
  /** Called before either, when an item is chosen. */
  onChoose?: () => void;
  /**
   * Disables every item, the panels' too.
   * @default false
   */
  disabled?: boolean;
  /**
   * A window without the Fonts and Colors panels: their rows are dimmed, saying why.
   * @default false
   */
  noPanels?: boolean;
}

/** Why the panels' rows are dimmed in a note's own window. */
const PANELS_IN_MAIN = "The Fonts and Colors panels work in the main Notes window.";

/**
 * The items of Notes' Format menu that the demo has: the paragraph styles, then the Font and
 * Text submenus with the character styles, the size, the alignments and the two panels. The
 * styles at the insertion point are checked. The menu bar's Format menu and the toolbar's
 * format button both show them.
 */
export function NotesFormatItems({
  status,
  onParagraphStyle,
  onTextCommand,
  onList,
  onTable,
  onCommand,
  onChoose,
  disabled = false,
  noPanels = false,
}: NotesFormatItemsProps) {
  const off = disabled || !status?.editable;
  const format = status?.format;
  const style = (next: NotesParagraphStyle) => {
    onChoose?.();
    onParagraphStyle(next);
  };
  const run = (command: RichTextCommand) => {
    onChoose?.();
    onTextCommand(command);
  };
  const textItem = (
    command: NotesTextCommand,
    title: string,
    enabled: boolean,
    keyEquivalent?: string,
  ) => (
    <MenuItem
      disabled={off || !enabled || !onCommand}
      keyEquivalent={keyEquivalent}
      onClick={() => {
        onChoose?.();
        onCommand?.(command);
      }}
    >
      {title}
    </MenuItem>
  );
  const inChecklist = status?.list === "checklist";
  const inList = status?.list != null;
  return (
    <>
      <MenuRadioGroup value={status?.paragraph ?? null}>
        {STYLES.map(([value, title, keyEquivalent]) => (
          <MenuRadioItem
            key={value}
            value={value}
            disabled={off}
            keyEquivalent={keyEquivalent}
            onClick={() => style(value)}
          >
            {title}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <MenuSeparator />
      {LISTS.map(([kind, title, keyEquivalent]) => (
        <MenuCheckboxItem
          key={kind}
          checked={status?.list === kind}
          disabled={off || !onList}
          keyEquivalent={keyEquivalent}
          onClick={() => {
            onChoose?.();
            onList?.(kind);
          }}
        >
          {title}
        </MenuCheckboxItem>
      ))}
      <MenuSeparator />
      <MenuCheckboxItem
        checked={inChecklist}
        disabled={off || !onList}
        keyEquivalent="shift+command+l"
        onClick={() => {
          onChoose?.();
          onList?.("checklist");
        }}
      >
        Checklist
      </MenuCheckboxItem>
      {textItem("mark-checked", "Mark as Checked", inChecklist, "shift+command+u")}
      <Submenu>
        <SubmenuTrigger>More</SubmenuTrigger>
        <SubmenuPopup>
          {textItem("check-all", "Check All", inChecklist)}
          {textItem("uncheck-all", "Uncheck All", inChecklist)}
          {textItem("move-checked", "Move Checked to Bottom", inChecklist)}
          {textItem("delete-checked", "Delete Checked", inChecklist)}
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger>Move List Item</SubmenuTrigger>
        <SubmenuPopup>
          {textItem("item-up", "Up", inList, "control+command+up")}
          {textItem("item-down", "Down", inList, "control+command+down")}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Font</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem
            disabled={disabled || noPanels}
            title={noPanels ? PANELS_IN_MAIN : undefined}
            keyEquivalent={key("show-fonts")}
            onClick={() => run("show-fonts")}
          >
            Show Fonts
          </MenuItem>
          {TOGGLES.map(([command, title]) => (
            <MenuCheckboxItem
              key={command}
              checked={format?.[command] ?? false}
              disabled={off}
              keyEquivalent={key(command)}
              onClick={() => run(command)}
            >
              {title}
            </MenuCheckboxItem>
          ))}
          <MenuSeparator />
          <MenuItem disabled={off} keyEquivalent={key("bigger")} onClick={() => run("bigger")}>
            Bigger
          </MenuItem>
          <MenuItem disabled={off} keyEquivalent={key("smaller")} onClick={() => run("smaller")}>
            Smaller
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={disabled || noPanels}
            title={noPanels ? PANELS_IN_MAIN : undefined}
            keyEquivalent={key("show-colors")}
            onClick={() => run("show-colors")}
          >
            Show Colors
          </MenuItem>
          <MenuSeparator />
          {textItem("copy-style", "Copy Style", true, "option+command+c")}
          {textItem("paste-style", "Paste Style", true, "option+command+v")}
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger>Text</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={format?.align ?? null}>
            {ALIGNMENTS.map(([align, title]) => (
              <MenuRadioItem
                key={align}
                value={align}
                disabled={off}
                keyEquivalent={key(`align-${align}`)}
                onClick={() => run(`align-${align}`)}
              >
                {title}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Writing Direction</SubmenuTrigger>
            <SubmenuPopup>
              <MenuRadioGroup value={status?.direction ?? null}>
                {DIRECTIONS.map(([direction, title]) => (
                  <MenuRadioItem
                    key={direction}
                    value={direction}
                    disabled={off || !onCommand}
                    onClick={() => {
                      onChoose?.();
                      onCommand?.(`direction-${direction}`);
                    }}
                  >
                    {title}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </SubmenuPopup>
          </Submenu>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger>Indentation</SubmenuTrigger>
        <SubmenuPopup>
          {textItem("indent", "Increase", true, "command+]")}
          {textItem("outdent", "Decrease", true, "command+[")}
        </SubmenuPopup>
      </Submenu>
      {/* On the table the insertion point is in; dimmed elsewhere, as in Notes. */}
      <Submenu>
        <SubmenuTrigger>Table</SubmenuTrigger>
        <SubmenuPopup>
          {textItem("add-table", "Add Table", true, "option+command+t")}
          <MenuSeparator />
          {TABLE_COMMANDS.map(([command, title, keyEquivalent], index) => (
            <Fragment key={command}>
              {index === 4 ? <MenuSeparator /> : null}
              <MenuItem
                disabled={off || !status?.table || !onTable}
                keyEquivalent={keyEquivalent}
                onClick={() => {
                  onChoose?.();
                  onTable?.(command);
                }}
              >
                {title}
              </MenuItem>
            </Fragment>
          ))}
        </SubmenuPopup>
      </Submenu>
      {textItem("table-to-text", "Convert to Text", Boolean(status?.table))}
    </>
  );
}

/**
 * Why Lock Note is dimmed outside the desktop: a locked note is kept encrypted on the desktop's
 * server, and this page has none.
 */
export const LOCK_UNAVAILABLE =
  "Locking a note needs the desktop’s server, which keeps only the note’s encrypted text.";
/** Why Lock Note is dimmed without one note. */
export const SELECT_ONE_TO_LOCK = "Select one note to lock it.";
/** Why a note in Recently Deleted can't be locked. */
export const DELETED_NOT_LOCKED = "Recover the note before you lock it.";
/** Why a shared note can't be locked: everyone on it reads it. */
export const SHARED_NOT_LOCKED = "A shared note can’t be locked.";
/** Why a note with files can't be locked: their bytes aren't encrypted. */
export const FILES_NOT_LOCKED =
  "A note with attachments can’t be locked: only a note’s text and picture are encrypted.";

/** Why Accounts… is dimmed: Notes keeps its notes in the desktop's own account. */
export const NO_OTHER_ACCOUNTS =
  "Notes keeps its notes with your desktop account; there is no other account to add here.";
/** Why Close All Locked Notes is dimmed. */
export const NO_LOCKED_TO_CLOSE = "No locked note is open.";
/** Why Change Password is dimmed. */
export const NO_PASSWORD_YET = "No note is locked yet, so there is no password to change.";
/** Why Insert from iPhone's rows are dimmed. */
export const NO_IPHONE = "That needs an iPhone or iPad nearby, which a web page can’t reach.";

/** The application menu's rows of Notes itself, each dimmed with what it needs. */
export function NotesApplicationItems({
  anyOpen,
  onCloseAll,
}: {
  /** Whether a locked note is open now. */
  anyOpen: boolean;
  onCloseAll: () => void;
}) {
  return (
    <>
      <MenuItem disabled title={NO_OTHER_ACCOUNTS} data-reason={NO_OTHER_ACCOUNTS}>
        Accounts…
      </MenuItem>
      <MenuItem
        disabled={!anyOpen}
        title={anyOpen ? undefined : NO_LOCKED_TO_CLOSE}
        data-reason={anyOpen ? undefined : NO_LOCKED_TO_CLOSE}
        onClick={onCloseAll}
      >
        Close All Locked Notes
      </MenuItem>
    </>
  );
}

/** What the rows of a note's lock need to know, and do. */
export interface NoteLockMenu {
  /** The note shown: a plain note, locked with its text not here, or locked and open. */
  state: "plain" | "closed" | "open";
  /** Why the note shown can't be locked; `null` when it can. */
  lockReason: string | null;
  anyOpen: boolean;
  /** Whether some note is locked, so that a password exists to change. */
  hasPassword: boolean;
  lock: () => void;
  removeLock: () => void;
  closeAll: () => void;
  changePassword: () => void;
}

/** Lock Note, or Remove Lock on a locked note: File's row and the note row's. */
export function NoteLockItem({
  lock,
  disabled = false,
}: {
  lock: NoteLockMenu;
  disabled?: boolean;
}) {
  if (lock.state !== "plain") {
    return (
      <MenuItem disabled={disabled} onClick={lock.removeLock}>
        Remove Lock
      </MenuItem>
    );
  }
  return (
    <MenuItem
      disabled={disabled || lock.lockReason !== null}
      title={lock.lockReason ?? undefined}
      data-reason={lock.lockReason ?? undefined}
      onClick={lock.lock}
    >
      Lock Note
    </MenuItem>
  );
}

/** The toolbar's Lock menu. */
export function NoteLockItems({ lock }: { lock: NoteLockMenu }) {
  return (
    <>
      <NoteLockItem lock={lock} />
      <MenuItem
        disabled={!lock.anyOpen}
        title={lock.anyOpen ? undefined : NO_LOCKED_TO_CLOSE}
        data-reason={lock.anyOpen ? undefined : NO_LOCKED_TO_CLOSE}
        onClick={lock.closeAll}
      >
        Close All Locked Notes
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!lock.hasPassword}
        title={lock.hasPassword ? undefined : NO_PASSWORD_YET}
        data-reason={lock.hasPassword ? undefined : NO_PASSWORD_YET}
        onClick={lock.changePassword}
      >
        Change Password…
      </MenuItem>
    </>
  );
}

/** Edit > Insert from iPhone, and the Media button's rows of the same. */
export function InsertFromIPhoneSubmenu() {
  return (
    <Submenu>
      <SubmenuTrigger>Insert from iPhone or iPad</SubmenuTrigger>
      <SubmenuPopup>
        {["Take Photo", "Scan Documents", "Add Sketch"].map((title) => (
          <MenuItem key={title} disabled title={NO_IPHONE} data-reason={NO_IPHONE}>
            {title}
          </MenuItem>
        ))}
      </SubmenuPopup>
    </Submenu>
  );
}

/** What the File and View menus need to know of the window, and do in it. */
export interface NotesWindowMenu {
  /** How many notes are selected: Pin, Lock, Delete and the rest act on them. */
  selected: number;
  /** Whether every note selected is pinned, so Pin Note says Unpin Note. */
  pinned: boolean;
  /** The rows of the note's lock. */
  lock: NoteLockMenu;
  /** Whether Recently Deleted is shown: its notes can only be recovered or erased. */
  inDeleted: boolean;
  view: NotesView;
  sort: NotesSort;
  foldersShown: boolean;
  noteCount: boolean;
  attachmentsBrowser: boolean;
  attachmentView: NotesAttachmentView;
  /** File > Share, on the note shown. */
  share: NoteShare;
  newNote: () => void;
  newFolder: () => void;
  importFiles: () => void;
  togglePin: () => void;
  recover: () => void;
  print: () => void;
  setView: (view: NotesView) => void;
  setSort: (sort: NotesSort) => void;
  toggleFolders: () => void;
  toggleNoteCount: () => void;
  toggleAttachments: () => void;
  setAttachmentView: (view: NotesAttachmentView) => void;
  zoom: (change: "in" | "out" | "actual") => void;
}

/** The Share rows of a note, in File, the note row's menu and the toolbar. */
export interface NoteShare {
  /** The first web address in the note, which the apps that take only a link are handed. */
  address: string | null;
  /** Why nothing can be shared; `null` while one note that can be read is selected. */
  reason: string | null;
  /** Hand the note's text and files to Mail or Messages. */
  toApp: (app: string) => void;
  /** Hand the note's first web address to an app. */
  link: (app: string) => void;
  /** Whether the note has text for Reminders to make a reminder of. */
  hasText: boolean;
  /** Hand the note's text to Reminders: a reminder titled with its first line. */
  reminder: () => void;
  /** Put the note's text on the clipboard. */
  copy: () => void;
}

/** Why every Share row is dimmed with nothing to share. */
export const SELECT_ONE_TO_SHARE = "Select one note to share it.";
/** Why a note cannot be shared while it is locked. */
export const LOCKED_NOT_SHARED = "A locked note can’t be shared.";
/** Why Reading List is dimmed in a note without a web address. */
const NEEDS_ADDRESS = (name: string) => `${name} takes a web address, and this note has none.`;
/** Why Reminders is dimmed in an empty note. */
const NEEDS_TEXT = "Reminders takes the note’s text, and this note has none.";
/** The apps that take a note's text and files as files. */
const TAKES_NOTE = new Set(["mail", "messages"]);

/**
 * What a note's Share offers: Mail and Messages take its text, as a text file, with the files in it
 * (`shareFiles`); Reminders makes a reminder of its text; the Reading List takes only a web address,
 * so it is handed the first one in the note, and is dimmed, saying why, in a note without one.
 */
export function NoteShareItems({ share }: { share: NoteShare }) {
  const row = (key: string, label: string, reason: string | null, onClick?: () => void) => (
    <MenuItem
      key={key}
      disabled={reason !== null}
      title={reason ?? undefined}
      data-reason={reason ?? undefined}
      onClick={reason === null ? onClick : undefined}
    >
      {label}
    </MenuItem>
  );
  const targets = shareTargets().filter((target) => target.app !== "notes");
  const takers = targets.filter((target) => TAKES_NOTE.has(target.app));
  const linked = targets.filter((target) => !TAKES_NOTE.has(target.app));
  return (
    <>
      {row("copy", "Copy", share.reason, share.copy)}
      {takers.map((target) =>
        row(target.app, target.title, share.reason, () => share.toApp(target.app)),
      )}
      {row("airdrop", "AirDrop", AIRDROP_REASON)}
      {linked.map((target) =>
        target.app === "reminders"
          ? row(
              target.app,
              target.title,
              share.reason ?? (share.hasText ? null : NEEDS_TEXT),
              share.reminder,
            )
          : row(
              target.app,
              target.title,
              share.reason ?? (share.address ? target.reason : NEEDS_ADDRESS(target.title)),
              () => share.link(target.app),
            ),
      )}
    </>
  );
}

/** Share, as a submenu of a note's. */
export function NoteShareSubmenu({ share }: { share: NoteShare }) {
  return (
    <Submenu>
      <SubmenuTrigger>Share</SubmenuTrigger>
      <SubmenuPopup>
        <NoteShareItems share={share} />
      </SubmenuPopup>
    </Submenu>
  );
}

/** The desktop menu bar's File menu: the rows the window carries out. */
export function NotesFileItems({ menu }: { menu: NotesWindowMenu }) {
  const none = menu.selected === 0;
  return (
    <>
      <MenuItem keyEquivalent="command+n" onClick={menu.newNote}>
        New Note
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+n" onClick={menu.newFolder}>
        New Folder
      </MenuItem>
      <MenuSeparator />
      <NoteShareSubmenu share={menu.share} />
      <MenuSeparator />
      <MenuItem onClick={menu.importFiles}>Import to Notes…</MenuItem>
      <MenuSeparator />
      <MenuItem disabled={none || menu.inDeleted} onClick={menu.togglePin}>
        {menu.pinned ? "Unpin Note" : "Pin Note"}
      </MenuItem>
      <NoteLockItem lock={menu.lock} disabled={menu.selected !== 1 || menu.inDeleted} />
      {menu.inDeleted ? (
        <MenuItem disabled={none} onClick={menu.recover}>
          Recover
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem disabled={menu.selected !== 1} onClick={menu.print}>
        Export as PDF…
      </MenuItem>
      <MenuItem disabled={menu.selected !== 1} keyEquivalent="command+p" onClick={menu.print}>
        Print…
      </MenuItem>
    </>
  );
}

const SORTS: [NotesSort, string][] = [
  ["edited", "Date Edited"],
  ["created", "Date Created"],
  ["title", "Title"],
];

/** The desktop menu bar's View menu: the rows the window carries out. */
export function NotesViewItems({ menu }: { menu: NotesWindowMenu }) {
  return (
    <>
      <MenuRadioGroup value={menu.view}>
        <MenuRadioItem value="list" keyEquivalent="command+1" onClick={() => menu.setView("list")}>
          as List
        </MenuRadioItem>
        <MenuRadioItem
          value="gallery"
          keyEquivalent="command+2"
          onClick={() => menu.setView("gallery")}
        >
          as Gallery
        </MenuRadioItem>
      </MenuRadioGroup>
      <Submenu>
        <SubmenuTrigger>Sort By</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={menu.sort}>
            {SORTS.map(([value, title]) => (
              <MenuRadioItem key={value} value={value} onClick={() => menu.setSort(value)}>
                {title}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem keyEquivalent="option+command+s" onClick={menu.toggleFolders}>
        {menu.foldersShown ? "Hide Folders" : "Show Folders"}
      </MenuItem>
      <MenuItem onClick={menu.toggleNoteCount}>
        {menu.noteCount ? "Hide Note Count" : "Show Note Count"}
      </MenuItem>
      <MenuCheckboxItem
        checked={menu.attachmentsBrowser}
        keyEquivalent="command+3"
        onClick={menu.toggleAttachments}
      >
        Attachments Browser
      </MenuCheckboxItem>
      <Submenu>
        <SubmenuTrigger>Attachment View</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={menu.attachmentView}>
            <MenuRadioItem value="small" onClick={() => menu.setAttachmentView("small")}>
              Small
            </MenuRadioItem>
            <MenuRadioItem value="large" onClick={() => menu.setAttachmentView("large")}>
              Large
            </MenuRadioItem>
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem keyEquivalent="shift+command+>" onClick={() => menu.zoom("in")}>
        Zoom In
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+<" onClick={() => menu.zoom("out")}>
        Zoom Out
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+0" onClick={() => menu.zoom("actual")}>
        Actual Size
      </MenuItem>
    </>
  );
}

export interface NotesMenuBarProps {
  /** The app's commands: what `Notes` puts in its `actionsRef`. */
  actions: { readonly current: NotesActions | null };
  /** The note's state, from `Notes`' `onStatusChange`: enables and checks the Format commands. */
  status?: NotesStatus;
  /**
   * Disables the commands.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Notes' menu bar, for a page that shows the window on a desktop: the library's `MenuBar` with
 * File > New Note and the Format commands the demo has, the styles at the insertion point
 * checked. The other menus list their commands dimmed. New Note and a Format command give the
 * keyboard to the note: the new one, or the one being formatted.
 */
export function NotesMenuBar({ actions, status, disabled = false }: NotesMenuBarProps) {
  const { finalFocus, chosen } = useNoteFocus(() => actions.current?.focusNote());
  // New Note's editor takes the keyboard as it appears; the closing menu must not take it back.
  const file = useNoteFocus(() => actions.current?.focusNote());
  return (
    <MenuBar modal={false} aria-label="Notes menus">
      <MenuBarMenu title="Notes" application>
        <MenuItem disabled>About Notes</MenuItem>
        <MenuSeparator />
        <MenuItem disabled>Quit Notes</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="File" popup={{ finalFocus: file.finalFocus }}>
        <MenuItem
          disabled={disabled}
          onClick={() => {
            file.chosen();
            actions.current?.newNote();
          }}
        >
          New Note
        </MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Edit">
        <MenuItem disabled>Undo</MenuItem>
        <MenuItem disabled>Redo</MenuItem>
        <MenuSeparator />
        <MenuItem disabled>Cut</MenuItem>
        <MenuItem disabled>Copy</MenuItem>
        <MenuItem disabled>Paste</MenuItem>
        <MenuItem disabled>Select All</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Format" popup={{ finalFocus }}>
        <NotesFormatItems
          status={status}
          disabled={disabled}
          onChoose={chosen}
          onParagraphStyle={(style) => actions.current?.setParagraphStyle(style)}
          onTextCommand={(command) => actions.current?.runTextCommand(command)}
          onList={(kind) => actions.current?.setList(kind)}
          onTable={(command) => actions.current?.runTableCommand(command)}
        />
      </MenuBarMenu>
      <MenuBarMenu title="View">
        <MenuItem disabled>as List</MenuItem>
        <MenuItem disabled>as Gallery</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Window">
        <MenuItem disabled>Minimize</MenuItem>
        <MenuItem disabled>Zoom</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Help">
        <MenuItem disabled>Notes Help</MenuItem>
      </MenuBarMenu>
    </MenuBar>
  );
}
