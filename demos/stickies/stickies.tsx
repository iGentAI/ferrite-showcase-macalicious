"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { Desktop } from "macalicious/desktop";
import { DesktopIcon } from "macalicious/desktop-icon";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import {
  applyRichTextFormat,
  keepRichTextSelection,
  keepTypingRuns,
  type RichTextCommand,
  type RichTextFormat,
  type RichTextSelectionKeeper,
  readRichTextFormat,
  richTextKeyCommand,
  runRichTextCommand,
} from "macalicious/lib/rich-text";
import { useControlled } from "macalicious/lib/use-controlled";
import { ManagedWindow } from "macalicious/managed-window";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { StickyNote, StickyNoteText, StickyNoteTitleBar } from "macalicious/sticky-note";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { readTextSelection, restoreTextSelection, type TextSelection } from "macalicious/text-view";
import type { WindowProps } from "macalicious/window";
import type { WindowControlsProps } from "macalicious/window-controls";
import {
  useWindowManager,
  useWindowManagerStore,
  WindowManager,
  type WindowManagerProps,
} from "macalicious/window-manager";
import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { type DesktopDragItem, filesOfDrag, useDesktopDrop } from "../desktop/desktop-drag";
import { WINDOW_ZOOM_ROW } from "../desktop/desktop-menus";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { onSharedText, takeSharedText } from "../desktop/desktop-services";
import { recordTag } from "../desktop/synced-document";
import {
  spaceAfterPaste,
  substituteTyped,
  useTextSubstitutions,
} from "../desktop/text-substitutions";
import {
  checkDocumentAfterMenu,
  SpellingItems,
  SubstitutionItems,
  useLearnedWords,
} from "../desktop/text-tools";
import { EditorEditItems, EditorMoreItems } from "../notes/notes-edit-menu";
import { FindBar, findRanges, type TextFind, useTextFind } from "../notes/notes-find";
import { whenMenusClosed } from "../notes/notes-menus";
import { DEFAULT_PAGE_SETUP, type PageSetup, printDocument } from "../textedit/textedit-drive";
import { isTextDocument } from "../textedit/textedit-files";
import {
  type CopiedStyle,
  copyStyle,
  documentStyles,
  styleSelection,
  stylesOf,
  type TextEditExtraCommand,
} from "../textedit/textedit-format";
import { readPageSetup, TextEditPageSetup, TextEditStyles } from "../textedit/textedit-sheets";
import { AppleMenuMark, VolumeIcon } from "./stickies-artwork";
import {
  arrangedNotes,
  cascadePlace,
  defaultStickies,
  NEW_NOTE_SIZE,
  STICKIES_COLORS,
  type StickiesArrangement,
  type StickiesColor,
  type StickiesNoteData,
  titleOf,
} from "./stickies-data";
import {
  printableNotes,
  readNoteFile,
  type StickiesFileDialog,
  StickiesFileDialogs,
} from "./stickies-files";
import {
  currentCopiedStyle,
  noteRichText,
  placeAtTopRight,
  StickiesFontMenuItems,
  type StickiesPanel,
  StickiesPanels,
  type StickiesShownPanel,
  type StickiesToolPanel,
  setCopiedStyle,
  storedHtml,
} from "./stickies-format";
import {
  isNotePicture,
  notePictureAddress,
  pictureMarkup,
  roomForPicture,
} from "./stickies-pictures";
import {
  NO_DEFAULTS,
  NO_TIMES,
  NOT_FLOATING,
  readFloatingNotes,
  readSpellingWhileTyping,
  readStickiesDefaults,
  readStickiesTimes,
  STICKIES_SETTINGS,
  type StickiesDefaults,
  timesTooltip,
} from "./stickies-settings";
import {
  characters,
  currentStickies,
  dismissStickiesConflict,
  keepStickiesConflict,
  MAX_NOTES,
  MAX_TEXT,
  removeStickiesNote,
  type SavedStickiesNote,
  saveStickiesNote,
  syncEnabled,
  useShownStickies,
  useStickiesAdoptionKey,
  useStickiesConflict,
  useUnsaved,
} from "./stickies-sync";
import { StickiesFileItems, StickiesWindowItems } from "./stickies-window-menu";
import "./stickies.tokens.css";
import "./stickies.css";

/** The height of a note's title bar, which is all that is left of a collapsed note. */
const TITLE_BAR_HEIGHT = 12;

/**
 * The event a note that shows its own panels sends its window manager's element when it opens
 * one, so that the other notes there close theirs.
 */
const PANEL_OPENED = "mac-stickies-panel-opened";
interface StickiesPanelOpened {
  panel: StickiesShownPanel;
  /** The `useId` of the note that opened it. */
  owner: string;
}

/** The words the spelling panel's Ignore passed over, in every note, until the page closes. */
const IGNORED_WORDS = new Set<string>();

/** Edit > Spelling and Grammar and Edit > Substitutions, reading the settings where they are kept. */
function StickiesToolItems({
  disabled,
  onShowSpelling,
  onCheckNow,
  onShowSubstitutions,
}: {
  disabled: boolean;
  onShowSpelling: () => void;
  onCheckNow: () => void;
  onShowSubstitutions: () => void;
}) {
  const [whileTyping, setWhileTyping] = useDesktopSetting(
    STICKIES_SETTINGS.spelling,
    readSpellingWhileTyping,
    true,
  );
  const [settings, setSettings] = useTextSubstitutions("stickies");
  return (
    <>
      <SpellingItems
        disabled={disabled}
        whileTyping={whileTyping}
        onToggleWhileTyping={() => setWhileTyping(!whileTyping)}
        onShow={onShowSpelling}
        onCheckNow={onCheckNow}
      />
      <SubstitutionItems
        disabled={disabled}
        settings={settings}
        onChange={setSettings}
        onShow={onShowSubstitutions}
      />
    </>
  );
}

/** The menu bar's height: the space the notes keep clear of at the top of the desktop. */
const MENU_BAR_HEIGHT = 22;

/**
 * The elements a browser lays out as lines of their own in editable text: its own line blocks
 * (`<div>`, `<p>`) and those that pasted rich text brings (lists, headings, quotations).
 */
const BLOCKS = new Set([
  "DIV",
  "P",
  "LI",
  "UL",
  "OL",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
  "TR",
]);
const isBlock = (node: Node) => BLOCKS.has(node.nodeName);

/**
 * The text of an edited note with its line breaks: the browser breaks lines in editable text
 * with `<br>` or with a block per line, which `textContent` leaves out.
 */
function plainText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? "";
  if (node.nodeName === "BR") return "\n";
  let text = "";
  for (const child of node.childNodes) text += plainText(child);
  return isBlock(node) ? `\n${text}\n` : text;
}

/**
 * The text of an edited note as it is kept, one `\n` per line break, as the note shows its lines.
 * The browser keeps a line in a block of its own (`<div>`, `<p>`, and the list items, headings
 * and quotations of pasted rich text): text after a block starts a
 * new line, and a block starts on a line of its own. The last `<br>` of a block only holds its
 * line open (an empty line is `<div><br></div>`), so it is no break of its own. Reading the note
 * back from the kept text gives the same lines.
 */
function noteText(root: Node): string {
  let out = "";
  // A block ended: whatever follows it is on the next line.
  let pending = false;
  const next = () => {
    if (pending) out += "\n";
    pending = false;
  };
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = child.nodeValue ?? "";
        if (text === "") continue;
        next();
        out += text;
      } else if (child.nodeName === "BR") {
        if (isBlock(node) && child === node.lastChild) continue;
        next();
        out += "\n";
      } else if (isBlock(child)) {
        next();
        if (out !== "" && !out.endsWith("\n")) out += "\n";
        walk(child);
        pending = true;
      } else walk(child);
    }
  };
  walk(root);
  return out;
}

/** Where the caret is in `root`, in characters of its text nodes; 0 when it is elsewhere. */
function caretOffset(root: Node): number {
  const selection = typeof window === "undefined" ? null : window.getSelection();
  if (!selection?.rangeCount) return 0;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

/** Put the caret `offset` characters into the text nodes of `root`, or at its end. */
function placeCaret(root: Node, offset: number) {
  const selection = window.getSelection();
  if (!selection || !root.contains(document.activeElement ?? null)) return;
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (left <= length) {
      range.setStart(node, left);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    left -= length;
  }
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Give all of `field`'s text `format`, and leave the insertion point at its end. */
function formatWholeText(field: HTMLElement, format: Partial<RichTextFormat>) {
  const selection = field.ownerDocument.getSelection();
  selection?.selectAllChildren(field);
  applyRichTextFormat(field, format);
  selection?.selectAllChildren(field);
  selection?.collapseToEnd();
}

const sameFormat = (a: RichTextFormat | undefined, b: RichTextFormat) =>
  a !== undefined && (Object.keys(b) as (keyof RichTextFormat)[]).every((key) => a[key] === b[key]);

/** What `selectionMemory` holds: the note's last selection, and whether it has the keyboard. */
export interface StickiesSelectionMemory {
  /** The selection last read in the note's text while it had the keyboard, or `null`. */
  selection: TextSelection | null;
  /**
   * Whether the note's text has the keyboard, from its focus events: a selection can stay in
   * the text while a button, a menu or a panel has the keyboard.
   */
  focused: boolean;
}

/** A note's text commands, for a menu bar or a panel outside the note (`actionsRef`). */
export interface StickiesNoteActions {
  /**
   * Run a command of the Font menu on the note's selection, which the note is given back
   * first. Show Fonts and Show Colors open the panels.
   */
  runCommand: (command: RichTextCommand) => void;
  /** Apply what the Fonts or the Colors panel changed to the note's selection. */
  applyFormat: (change: Partial<RichTextFormat>) => void;
  /** Give the note's text the keyboard focus and the selection it last had. */
  restoreSelection: () => void;
  /** Whether the note's text holds `query`, whatever the case. */
  hasMatch: (query: string) => boolean;
  /** Show the find bar with `query`, on its last match when `fromEnd`, otherwise its first. */
  openFind: (query: string, fromEnd: boolean) => void;
  /** Opens one of the Edit menu's panels. */
  showTool: (panel: StickiesToolPanel) => void;
  /** Runs a row of the Font menu beyond the library's commands: see `textedit-format.tsx`. */
  runExtra: (command: TextEditExtraCommand) => void;
  /** Gives `style` to the text the Styles sheet was opened on. */
  applyStyle: (style: CopiedStyle, range: Range | null) => void;
  /**
   * Adds `text` on a line of its own at the end of the note, as one Undo step. `false` when the note
   * could not hold it, and then nothing changed.
   */
  appendText: (text: string) => boolean;
  /**
   * Adds a picture on a line of its own at the end of the note, as one Undo step. `false` when the
   * note has no room for it, and then nothing changed.
   */
  appendPicture: (address: string, name: string) => boolean;
}

export interface StickiesNoteProps extends Omit<WindowProps, "children"> {
  /** The tooltip of the note's text: its dates, on a desktop that keeps them. */
  textTooltip?: string;
  /**
   * A notice at the foot of the note, under its text: a desktop shows there that another window
   * changed the note's text at the same time, with the person's choices.
   */
  notice?: ReactNode;
  /**
   * Where the note keeps its selection for the next note built in its place (a desktop builds
   * the note again from each document it adopts, such as another window's change): the note
   * writes its selection there as it changes and, built while that selection had the keyboard,
   * takes the keyboard and the selection back, moved by what changed in the text before it.
   */
  selectionMemory?: StickiesSelectionMemory;
  /**
   * The note colour, one of the six of the Color menu: `"yellow"`, `"blue"`, `"green"`,
   * `"pink"`, `"purple"` or `"gray"`. A string, as the attribute of the window's element is,
   * so that a window's props can be spread as they come; any other value is yellow.
   * @default "yellow"
   */
  color?: string;
  /** Whether the note is collapsed to its title bar, when you control it. */
  collapsed?: boolean;
  /**
   * Whether the note starts collapsed, when you do not control it.
   * @default false
   */
  defaultCollapsed?: boolean;
  /** Called when the collapse box or a double click on the title bar collapses or expands the note. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * Makes the note see-through.
   * @default false
   */
  translucent?: boolean;
  /**
   * The text the note opens with. Its first line is set in bold. Read once: the browser owns
   * the text from then on.
   * @default ""
   */
  defaultText?: string;
  /**
   * The text with its formats the note opens with, as `onTextChange` reported it. Only the
   * elements, styles and attributes that formatting writes are kept (`richTextFromHtml` of
   * `macalicious/lib/rich-text`): nothing in it runs or loads. It is shown in place of
   * `defaultText` when it reads as that same text; otherwise it is out of date and
   * `defaultText` is shown. Read once.
   */
  defaultHtml?: string;
  /** Called with the note's title, the first line of its text that is not blank, when typing changes it. */
  onTitleChange?: (title: string) => void;
  /**
   * Called with the note's whole text, one `\n` per line break, and with the text and its
   * formats as HTML (what `defaultHtml` takes), whenever typing or a format changes them.
   */
  onTextChange?: (text: string, html: string) => void;
  /** Called with the format where the insertion point is in the note, when it changes. */
  onFormatChange?: (format: RichTextFormat) => void;
  /**
   * Called when Show Fonts or Show Colors is chosen in the note (Command-T, Shift-Command-C or
   * its contextual menu), by an app that shows one Fonts panel and one Colors panel for all
   * its notes. Without it the note shows them itself: as windows of the desktop page that gives
   * it `DesktopWindow`, as utility panels of the window manager it is in, or over the page.
   */
  onShowPanel?: (panel: StickiesPanel) => void;
  /** Where the note puts its text commands, for a menu bar or a panel outside it. */
  actionsRef?: Ref<StickiesNoteActions>;
  /**
   * Given by a desktop page whose descriptor says `windows`: the note's Fonts and Colors
   * panels open as its windows.
   */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  /**
   * The most characters the text holds, line breaks counted. Typing or pasting past it is
   * refused, as in a text field with a maximum length. No limit by default.
   */
  maxLength?: number;
  /**
   * Marks the note's changes as not saved: the close box is filled, and the note is described
   * as "Not saved" to assistive technology.
   * @default false
   */
  unsaved?: boolean;
  /**
   * Called with a colour chosen from the note's contextual menu, which then lists the six
   * colours of the Color menu before its other rows. Command-1 to Command-6 choose them too.
   */
  onColorChange?: (color: StickiesColor) => void;
  /** Rows of the desktop's File and Window menus, shown while this note is the one used last. */
  desktopMenus?: { file?: ReactNode; window?: ReactNode };
  /** Called with the text files dropped on the note from Finder; without it the note takes none. */
  onDropFiles?: (files: readonly DesktopDragItem[]) => void;
  /** Called with a picture pasted in the note. Without it, the browser's own paste runs. */
  onPastePicture?: (file: File) => void;
  /** Key equivalents the note answers while it has the keyboard: each key and what it does. */
  keyCommands?: readonly (readonly [string, () => void])[];
  /** The font the first text typed in an empty note takes. */
  startFormat?: Partial<RichTextFormat>;
  /**
   * Asked when Find Next or Find Previous passes the last match in the note: what opens the find
   * in another note that holds `query`, or `undefined` when none does and the find wraps.
   */
  onFindElsewhere?: (query: string, backwards: boolean) => (() => void) | undefined;
  /** For the close box: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** Taken so that a managed window's props can be spread; a note has no minimize button. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the zoom box: a window manager's zoom command. */
  onZoom?: (event: MouseEvent<HTMLElement>) => void;
  /** Taken so that a managed window's props can be spread; the zoom box has one drawing. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** Taken so that a managed window's props can be spread; a note has no minimize button. */
  minimizeDisabled?: boolean;
  /** Taken so that a managed window's props can be spread; the zoom box has no disabled look. */
  zoomDisabled?: boolean;
  /**
   * Called when the primary pointer button goes down on the title bar, outside its three
   * boxes: a window manager starts moving the note here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  /**
   * Taken so that a managed window's props can be spread, and not called: a double click on a
   * note's title bar collapses the note, where a window's zooms it.
   */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * One note of Stickies, as a window.
 *
 * The root is the library's `StickyNote`, a borderless window of its own, and takes the props
 * of a `Window` (`state`, `width`, `height`, `style`, `ref`, pointer and focus handlers), so a
 * window manager can host it; `variant` and `fullScreen` are taken and have no effect. The
 * eight props a managed window's `render` supplies are taken as well: `onClose` and `onZoom`
 * go to the close and zoom boxes and `onDragRegionPointerDown` to the title bar; a note has no
 * part for the other five.
 *
 * The text is edited in place by the browser. The note's title, shown in the title bar while
 * the note is collapsed and used as its accessible name, follows the first line as it is typed.
 * The commands of Stickies' Font menu style the selection: their key equivalents while the
 * text has the keyboard (Command-B, -I, -U, -T, -+, --, Shift-Command-C and the alignments;
 * Control off Apple platforms), the Font submenu of the note's contextual menu, the Fonts and
 * Colors panels they open, and `actionsRef` for a menu bar outside the note.
 */
export function StickiesNote({
  notice,
  selectionMemory,
  color,
  collapsed,
  defaultCollapsed,
  onCollapsedChange,
  translucent,
  defaultText = "",
  defaultHtml,
  onTitleChange,
  onTextChange,
  onFormatChange,
  onShowPanel,
  actionsRef,
  DesktopWindow,
  maxLength,
  unsaved = false,
  onColorChange,
  desktopMenus,
  onDropFiles,
  onPastePicture,
  keyCommands,
  startFormat,
  onFindElsewhere,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  variant,
  fullScreen,
  width = 352,
  height = 260,
  className,
  style,
  onFocus,
  textTooltip,
  ...noteProps
}: StickiesNoteProps) {
  const [title, setTitle] = useState(() => titleOf(defaultText));
  const [stylesSheet, setStylesSheet] = useState<{
    styles: readonly CopiedStyle[];
    range: Range | null;
  } | null>(null);
  const text = useRef<HTMLDivElement>(null);
  const dropRef = useDesktopDrop<HTMLDivElement>({
    enabled: onDropFiles !== undefined,
    accepts: (item) => isNotePicture(item) || (isTextDocument(item) && item.bytes === undefined),
    onDrop: (items) => onDropFiles?.(items),
    refusal: () => "Stickies takes text files and pictures.",
  });
  const setText = useCallback(
    (node: HTMLDivElement) => {
      text.current = node;
      const stop = dropRef(node);
      return () => {
        text.current = null;
        stop?.();
      };
    },
    [dropRef],
  );
  // Read once: the browser owns the text after the first render, so a later `defaultText` must
  // not make React write the editable element again.
  const [initialText] = useState(defaultText);
  const [initialHtml] = useState(defaultHtml);
  const lineEnd = initialText.indexOf("\n");
  const firstLine = lineEnd < 0 ? initialText : initialText.slice(0, lineEnd);
  const known = STICKIES_COLORS.find(({ value }) => value === color);
  const [content, setContent] = useState(initialText);

  // A saved note's formats: the stored markup, rebuilt from what formatting writes, takes the
  // place of the plain text when it reads as that text. Before the page is painted, and before
  // the length guard below takes its first copy of the text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once, as the text is
  useLayoutEffect(() => {
    const field = text.current;
    if (!field || !initialHtml) return;
    const holder = field.ownerDocument.createElement("div");
    holder.append(noteRichText(initialHtml, field.ownerDocument));
    if (noteText(holder) === initialText) field.replaceChildren(...holder.childNodes);
  }, []);

  // Built in the place of a note the person was typing in (a desktop adopting another window's
  // change), the note takes the keyboard back with its selection where it was. Once, after its
  // saved formats are in place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the text is
  useLayoutEffect(() => {
    const field = text.current;
    const kept = selectionMemory?.selection;
    if (field && kept && selectionMemory?.focused) restoreTextSelection(field, kept);
  }, []);

  // The browser edits the text, and `maxLength` holds against the text as it is kept. An
  // insertion that would pass it is refused before it happens where the browser lets it be;
  // React's onBeforeInput does not carry the kind of input, so the native event is heard. That
  // estimate cannot see every edit (a line break may become a block and a break, an input
  // method composes text without asking), so after each edit, and when a composition ends, the
  // kept text is measured, and an edit that took it past the limit is undone: the text and the
  // caret go back to where they were before it.
  useEffect(() => {
    const field = text.current;
    if (!field || maxLength === undefined) return;
    let accepted = field.innerHTML;
    // Characters as the application counts them (Unicode scalar values), not UTF-16 units.
    let acceptedLength = characters(noteText(field));
    let caret = caretOffset(field);
    let composing = false;
    const guard = (event: InputEvent) => {
      if (!composing) caret = caretOffset(field);
      if (!event.inputType.startsWith("insert") || !event.cancelable) return;
      const added = characters(event.data ?? event.dataTransfer?.getData("text/plain") ?? "\n");
      const replaced = characters(window.getSelection()?.toString() ?? "");
      if (added > replaced && characters(noteText(field)) - replaced + added > maxLength) {
        event.preventDefault();
      }
    };
    // Whether the text is within the limit, or no longer than it was (a text given past the
    // limit can still be shortened); when it is not, it is put back as it was.
    const enforce = () => {
      const length = characters(noteText(field));
      if (length <= maxLength || length <= acceptedLength) {
        accepted = field.innerHTML;
        acceptedLength = length;
        return true;
      }
      field.innerHTML = accepted;
      placeCaret(field, caret);
      return false;
    };
    const input = (event: Event) => {
      if (!composing && !(event as InputEvent).isComposing) enforce();
    };
    const compositionStart = () => {
      composing = true;
      caret = caretOffset(field);
    };
    const compositionEnd = () => {
      composing = false;
      // The owner heard the composed text as it was typed: it hears the text put back.
      if (!enforce()) field.dispatchEvent(new Event("input", { bubbles: true }));
    };
    field.addEventListener("beforeinput", guard);
    field.addEventListener("input", input);
    field.addEventListener("compositionstart", compositionStart);
    field.addEventListener("compositionend", compositionEnd);
    return () => {
      field.removeEventListener("beforeinput", guard);
      field.removeEventListener("input", input);
      field.removeEventListener("compositionstart", compositionStart);
      field.removeEventListener("compositionend", compositionEnd);
    };
  }, [maxLength]);

  // The format where the insertion point is, for the Font menu's checkmarks and the Fonts panel.
  const [format, setFormat] = useState<RichTextFormat>();
  const shownFormat = useRef<RichTextFormat | undefined>(undefined);
  // The note's own panels, when no app shows them: those open, and the manager they are in.
  const [panels, setPanels] = useState<{
    open: readonly StickiesShownPanel[];
    manager: Element | null;
  }>({ open: [], manager: null });
  const panelIds = useId();
  const [substitutions, setSubstitutions] = useTextSubstitutions("stickies");
  const [spellingWhileTyping] = useDesktopSetting(
    STICKIES_SETTINGS.spelling,
    readSpellingWhileTyping,
    true,
  );
  const { learned } = useLearnedWords();
  const latestLearned = useRef(learned);
  latestLearned.current = learned;
  const pastedText = useRef("");
  const textElement = useCallback(() => text.current, []);
  const checkNow = useCallback(
    () => checkDocumentAfterMenu(textElement, () => [...latestLearned.current, ...IGNORED_WORDS]),
    [textElement],
  );
  const started = useRef(false);
  const keeper = useRef<RichTextSelectionKeeper | null>(null);
  // Typing runs as Undo steps in every engine (Firefox otherwise joins them): src/lib/rich-text.ts.
  useEffect(() => keepTypingRuns(), []);
  // The latest callbacks, for the commands, which are made once.
  const latest = useRef({ onFormatChange, onShowPanel, maxLength });
  useLayoutEffect(() => {
    latest.current = { onFormatChange, onShowPanel, maxLength };
  });

  // Find over the note's text. A request for the bar shows a collapsed note first. Past the note's
  // last match the find goes on in another note, when the app has others.
  const [isCollapsed, setIsCollapsed] = useControlled(
    collapsed,
    defaultCollapsed ?? false,
    onCollapsedChange,
  );
  const ownFind = useTextFind(() => text.current, content);
  const find: TextFind = {
    ...ownFind,
    open: (replace) => {
      ownFind.open(replace);
      if (!isCollapsed) return;
      setIsCollapsed(false);
      // The bar's field can take the keyboard once the note has been drawn open.
      whenMenusClosed(document, () =>
        requestAnimationFrame(() => latestFind.current.fieldRef.current?.focus()),
      );
    },
    move: (backwards) => {
      const past = backwards ? ownFind.index <= 0 : ownFind.index >= ownFind.count - 1;
      const elsewhere =
        past && ownFind.query !== "" ? onFindElsewhere?.(ownFind.query, backwards) : undefined;
      if (!elsewhere) {
        ownFind.move(backwards);
        return;
      }
      ownFind.close();
      elsewhere();
    },
  };
  const latestFind = useRef(find);
  latestFind.current = find;
  // Given the find from another note, going backwards: its last match, once the query is in place.
  const [askedFromEnd, setAskedFromEnd] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: moves once for each request
  useEffect(() => {
    if (askedFromEnd > 0) ownFind.move(true);
  }, [askedFromEnd]);

  /** Read the format where the insertion point is, and tell it when it changed. */
  const follow = useCallback(() => {
    const field = text.current;
    if (!field) return;
    const next = readRichTextFormat(field);
    if (sameFormat(shownFormat.current, next)) return;
    shownFormat.current = next;
    setFormat(next);
    latest.current.onFormatChange?.(next);
  }, []);

  // The selection is kept while it is in the text, for a command chosen from a menu or a panel,
  // which take the focus; and the format follows the insertion point.
  useEffect(() => {
    const field = text.current;
    if (!field) return;
    keeper.current = keepRichTextSelection(field);
    const document = field.ownerDocument;
    const selectionChange = () => {
      const selection = document.getSelection();
      const inside = Boolean(
        selection?.rangeCount && field.contains(selection.getRangeAt(0).startContainer),
      );
      // The note's selection while its text has the keyboard, for a note built in its place.
      if (selectionMemory && inside && document.activeElement === field) {
        selectionMemory.selection = readTextSelection(field);
      }
      if (inside) follow();
    };
    // Whether the text has the keyboard, from its focus events. Read once the focus has moved:
    // a note removed (a build that adopts a document) leaves what was kept as it was.
    const focusIn = () => {
      if (selectionMemory) selectionMemory.focused = true;
    };
    const focusOut = () =>
      queueMicrotask(() => {
        if (selectionMemory && field.isConnected) {
          selectionMemory.focused = document.activeElement === field;
        }
      });
    field.addEventListener("focusin", focusIn);
    field.addEventListener("focusout", focusOut);
    document.addEventListener("selectionchange", selectionChange);
    return () => {
      field.removeEventListener("focusin", focusIn);
      field.removeEventListener("focusout", focusOut);
      document.removeEventListener("selectionchange", selectionChange);
      keeper.current?.dispose();
      keeper.current = null;
    };
  }, [follow, selectionMemory]);

  // One Fonts panel and one Colors panel for the app, as in Catalina, when each note shows its
  // own (a desktop page or a window manager that hosts every note in a window of its own): a
  // note that opens one tells the other notes of the same manager, which close theirs.
  useEffect(() => {
    const manager = text.current?.closest(".mac-window-manager");
    if (!manager) return;
    const opened = (event: Event) => {
      const { panel, owner } = (event as CustomEvent<StickiesPanelOpened>).detail;
      if (owner === panelIds) return;
      setPanels((current) =>
        current.open.includes(panel)
          ? { ...current, open: current.open.filter((each) => each !== panel) }
          : current,
      );
    };
    manager.addEventListener(PANEL_OPENED, opened);
    return () => manager.removeEventListener(PANEL_OPENED, opened);
  }, [panelIds]);

  const commands = useMemo<StickiesNoteActions>(() => {
    // The browser changed the text's formats: the length guard takes the new text as accepted,
    // and the owner hears it, as after typing. The selection is kept again from where the command
    // left it: Firefox moves the styled text into new elements without reporting a change of the
    // selection, and the copy kept before would have collapsed with the text it held.
    const changed = () => {
      const field = text.current;
      if (!field) return;
      const selection = field.ownerDocument.getSelection();
      if (
        keeper.current &&
        selection?.rangeCount &&
        field.contains(selection.getRangeAt(0).commonAncestorContainer)
      ) {
        keeper.current.dispose();
        keeper.current = keepRichTextSelection(field);
      }
      field.dispatchEvent(new Event("input", { bubbles: true }));
      follow();
    };
    // The text that a command acts on, with the keyboard and its selection. While it has them
    // (a key equivalent), the selection is the browser's, which a command has just set and the
    // kept copy may not have caught up with yet; a menu or a panel took them, and gives them back.
    const target = () => {
      const field = text.current;
      if (!field || !keeper.current) return null;
      const document = field.ownerDocument;
      const selection = document.getSelection();
      const inside =
        document.activeElement === field &&
        !!selection?.rangeCount &&
        field.contains(selection.getRangeAt(0).commonAncestorContainer);
      if (!inside) keeper.current.restore();
      return field;
    };
    const showPanel = (panel: StickiesShownPanel) => {
      const show = latest.current.onShowPanel;
      if (show && (panel === "fonts" || panel === "colors")) {
        show(panel);
        return;
      }
      const manager = text.current?.closest(".mac-window-manager") ?? null;
      setPanels((current) =>
        current.open.includes(panel) ? current : { open: [...current.open, panel], manager },
      );
      manager?.dispatchEvent(
        new CustomEvent<StickiesPanelOpened>(PANEL_OPENED, {
          detail: { panel, owner: panelIds },
        }),
      );
    };
    return {
      showTool: showPanel,
      runExtra(command) {
        const field = target();
        if (!field) return;
        if (command === "copy-style") {
          setCopiedStyle(copyStyle(field));
          return;
        }
        if (command === "show-styles") {
          const selection = field.ownerDocument.getSelection();
          const range =
            selection?.rangeCount && !selection.isCollapsed
              ? selection.getRangeAt(0).cloneRange()
              : null;
          setStylesSheet({ styles: documentStyles(field), range });
          return;
        }
        const styles = command === "paste-style" ? currentCopiedStyle() : stylesOf(command, field);
        if (styles) styleSelection(field, styles);
        changed();
      },
      applyStyle(style, range) {
        const field = target();
        if (!field || !range) return;
        const selection = field.ownerDocument.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        styleSelection(field, style);
        changed();
      },
      appendText(value) {
        const field = text.current;
        if (!field) return false;
        const held = noteText(field);
        const added = held === "" ? value : `\n${value}`;
        const limit = latest.current.maxLength;
        if (limit !== undefined && characters(held) + characters(added) > limit) return false;
        field.focus({ preventScroll: true });
        const document = field.ownerDocument;
        const selection = document.getSelection();
        selection?.selectAllChildren(field);
        selection?.collapseToEnd();
        return document.execCommand("insertText", false, added);
      },
      appendPicture(address, name) {
        const field = text.current;
        if (!field || !roomForPicture(storedHtml(field), address)) return false;
        field.focus({ preventScroll: true });
        const document = field.ownerDocument;
        const selection = document.getSelection();
        selection?.selectAllChildren(field);
        selection?.collapseToEnd();
        const afterText = field.textContent !== "" || field.querySelector("img") !== null;
        return document.execCommand("insertHTML", false, pictureMarkup(address, name, afterText));
      },
      runCommand(command) {
        if (command === "show-fonts" || command === "show-colors") {
          showPanel(command === "show-fonts" ? "fonts" : "colors");
          return;
        }
        const field = target();
        if (!field) return;
        runRichTextCommand(field, command);
        changed();
      },
      applyFormat(change) {
        // Read before target(): target() restores the note's selection, which gives the note the keyboard.
        const back = document.activeElement;
        const field = target();
        if (!field) return;
        // A Fonts or Colors panel control has the keyboard (a value field, a slider), and with it
        // the document's selection: the note's selection is put back first, kept again right after
        // the change (the browser selects what the change made, and the keeper's own
        // "selectionchange" would only come once the control has the focus back), and the control
        // takes the keyboard back, so that the next change from the panel (the next digit typed,
        // the slider moved again) acts on the same text.
        keeper.current?.restore();
        applyRichTextFormat(field, change);
        keeper.current?.restore();
        changed();
        if (
          back instanceof HTMLElement &&
          back !== field &&
          back.closest(".mac-font-panel, .mac-color-panel")
        ) {
          back.focus({ preventScroll: true });
        }
      },
      restoreSelection() {
        keeper.current?.restore();
      },
      hasMatch: (query) => (text.current ? findRanges(text.current, query).length > 0 : false),
      openFind(query, fromEnd) {
        const find = latestFind.current;
        find.open();
        find.setQuery(query);
        if (fromEnd) setAskedFromEnd((count) => count + 1);
        // After the window manager has given the note the keyboard.
        requestAnimationFrame(() => latestFind.current.fieldRef.current?.focus());
      },
    };
  }, [follow, panelIds]);
  useImperativeHandle(actionsRef, () => commands, [commands]);

  // On the desktop, the menu bar's Font menu holds the note's Font commands, checked where its
  // insertion point is, and its Color menu the six note colours, as the contextual menu has
  // them: for the note used last (a press or the focus in its text makes it so). The note takes
  // the keyboard and its selection back once the menu has closed (the desktop's menu gives it to
  // its title).
  const [within, setWithin] = useState<Element | null>(null);
  useEffect(() => setWithin(text.current), []);
  const colorChange = useRef(onColorChange);
  useLayoutEffect(() => {
    colorChange.current = onColorChange;
  });
  const desktopFontMenu = useMemo(
    () => (
      <StickiesFontMenuItems
        format={format}
        onCommand={(command) => {
          commands.runCommand(command);
          whenMenusClosed(document, commands.restoreSelection);
        }}
        onExtra={(command) => {
          commands.runExtra(command);
          whenMenusClosed(document, commands.restoreSelection);
        }}
      />
    ),
    [format, commands],
  );
  useDesktopAppMenu("stickies", "Font", desktopFontMenu, within);
  const colorable = onColorChange !== undefined;
  const shownColor = known?.value ?? "yellow";
  const desktopColorMenu = useMemo(
    () =>
      colorable ? (
        <MenuRadioGroup
          value={shownColor}
          onValueChange={(value) => {
            colorChange.current?.(value as StickiesColor);
            whenMenusClosed(document, commands.restoreSelection);
          }}
        >
          {STICKIES_COLORS.map(({ value, label }, index) => (
            <MenuRadioItem key={value} value={value} keyEquivalent={`command+${index + 1}`}>
              {label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      ) : null,
    [colorable, shownColor, commands],
  );
  useDesktopAppMenu("stickies", "Color", desktopColorMenu, within);
  // Its Edit menu acts on the note's text, which takes the keyboard and its selection back.
  const editItems = useMemo(() => {
    const target = () => {
      const field = text.current;
      return field
        ? { element: field, restore: commands.restoreSelection, editable: true, rich: true }
        : null;
    };
    return (
      <>
        <EditorEditItems target={target} />
        <EditorMoreItems
          target={target}
          find={() => latestFind.current}
          beforeFind={
            <StickiesToolItems
              disabled={isCollapsed}
              onShowSpelling={() => commands.showTool("spelling")}
              onCheckNow={checkNow}
              onShowSubstitutions={() => commands.showTool("substitutions")}
            />
          }
        />
      </>
    );
  }, [commands, checkNow, isCollapsed]);
  useDesktopAppMenu("stickies", "Edit", editItems, within);
  useDesktopAppMenu("stickies", "File", desktopMenus?.file ?? null, within);
  useDesktopAppMenu("stickies", "Window", desktopMenus?.window ?? null, within);

  // The note's key equivalents. On a desktop the key note answers them wherever the keyboard is (a
  // menu that closed leaves it on the menu bar's title), before the desktop's own for the same keys:
  // so in the capture phase, as nothing inside the note takes these keys. Elsewhere, while the
  // keyboard is in the note.
  const noteKeys = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  noteKeys.current = (event) => {
    if (event.defaultPrevented || event.repeat || event.isComposing) return;
    const root = text.current?.closest(".mac-sticky-note");
    if (!root) return;
    const answers = desktopMenus
      ? root.getAttribute("data-window-state") === "key" &&
        !document.querySelector(
          '[role="menu"], [role="alertdialog"], [role="dialog"], .mac-stickies-panel-layer',
        )
      : root.contains(event.target as Node);
    if (!answers) return;
    const keys: readonly (readonly [string, () => void])[] = [
      ...(keyCommands ?? []),
      ...(onColorChange
        ? STICKIES_COLORS.map(
            ({ value }, index) => [`command+${index + 1}`, () => onColorChange(value)] as const,
          )
        : []),
      ["command+f", () => find.open()],
      ["command+g", () => find.move(false)],
      ["shift+command+g", () => find.move(true)],
      ["command+e", () => find.fromSelection()],
      ["command+j", () => find.jump()],
    ];
    for (const [equivalent, run] of keys) {
      if (!matchesMenuKeyEquivalent(event, equivalent)) continue;
      event.preventDefault();
      run();
      return;
    }
  };
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => noteKeys.current(event);
    document.addEventListener("keydown", listen, true);
    return () => document.removeEventListener("keydown", listen, true);
  }, []);

  const note = (
    <StickyNote
      aria-label={title || "Empty note"}
      aria-description={unsaved ? "Not saved" : undefined}
      data-unsaved={unsaved ? "" : undefined}
      // Not a tab stop, but a window manager gives the note the keyboard focus.
      tabIndex={-1}
      {...noteProps}
      color={known?.value ?? "yellow"}
      collapsed={isCollapsed}
      onCollapsedChange={setIsCollapsed}
      translucent={translucent}
      className={className ? `mac-stickies-note ${className}` : "mac-stickies-note"}
      style={{ width, height, ...style }}
      onFocus={(event) => {
        onFocus?.(event);
        // Focus given to the note itself, by a window manager or by a click beside the text,
        // goes to the text, so that typing lands in it. A collapsed note has no text to take it.
        if (event.target === event.currentTarget) text.current?.focus({ preventScroll: true });
      }}
    >
      <StickyNoteTitleBar
        data-window-drag-region=""
        onPointerDown={(event) => {
          // A press a window's own handler cancelled (in the capture phase, as on the library's
          // drag regions) does not start a move.
          if (
            !event.defaultPrevented &&
            event.button === 0 &&
            !(event.target as Element).closest("button")
          ) {
            onDragRegionPointerDown?.(event);
          }
        }}
        // A window manager's close and zoom commands read the click (Option changes what zoom
        // does), which the title bar's own onClose and onZoom do not pass on: the clicks on
        // the two boxes are heard here.
        onClick={(event) => {
          const widget = (event.target as Element).closest("[data-widget]");
          const name = widget?.getAttribute("data-widget");
          if (name === "close") onClose?.(event);
          else if (name === "zoom") onZoom?.(event);
        }}
      >
        {title}
      </StickyNoteTitleBar>
      <FindBar find={find} />
      <StickyNoteText
        ref={setText}
        className="mac-stickies-note-text"
        title={textTooltip}
        spellCheck={spellingWhileTyping}
        data-text-replacement={substitutions.replacement ? "on" : "off"}
        onPaste={(event) => {
          pastedText.current = event.clipboardData.getData("text/plain");
          const picture = [...event.clipboardData.files].find((file) =>
            file.type.startsWith("image/"),
          );
          if (picture && onPastePicture) {
            event.preventDefault();
            onPastePicture(picture);
          }
        }}
        onInput={(event) => {
          const native = event.nativeEvent as InputEvent;
          if (native.inputType === "insertFromPaste" && substitutions.copyPaste) {
            spaceAfterPaste(event.currentTarget, pastedText.current, undefined);
          }
          if (native.inputType === "insertText" && !native.isComposing) {
            substituteTyped(event.currentTarget, native.data, substitutions, true);
          }
          if (
            startFormat &&
            !started.current &&
            !event.nativeEvent.isComposing &&
            event.currentTarget.textContent
          ) {
            started.current = true;
            formatWholeText(event.currentTarget, startFormat);
          }
          setContent(noteText(event.currentTarget));
          onTextChange?.(noteText(event.currentTarget), storedHtml(event.currentTarget));
          const next = titleOf(plainText(event.currentTarget));
          if (next === title) return;
          setTitle(next);
          onTitleChange?.(next);
        }}
        onKeyDown={(event) => {
          if (event.defaultPrevented || event.repeat || event.nativeEvent.isComposing) return;
          if (matchesMenuKeyEquivalent(event.nativeEvent, "option+command+c")) {
            event.preventDefault();
            commands.runExtra("copy-style");
            return;
          }
          if (matchesMenuKeyEquivalent(event.nativeEvent, "option+command+v")) {
            event.preventDefault();
            commands.runExtra("paste-style");
            return;
          }
          if (matchesMenuKeyEquivalent(event.nativeEvent, "shift+command+;")) {
            event.preventDefault();
            commands.showTool("spelling");
            return;
          }
          if (matchesMenuKeyEquivalent(event.nativeEvent, "command+;")) {
            event.preventDefault();
            checkNow();
            return;
          }
          const command = richTextKeyCommand(event.nativeEvent);
          if (!command) return;
          event.preventDefault();
          commands.runCommand(command);
        }}
      >
        {firstLine ? <b>{firstLine}</b> : null}
        {lineEnd < 0 ? "" : initialText.slice(lineEnd)}
      </StickyNoteText>
      {notice}
      <Sheet open={stylesSheet !== null} onOpenChange={(open) => open || setStylesSheet(null)}>
        <SheetPopup
          anchor={text.current?.closest<HTMLElement>(".mac-stickies-note") ?? undefined}
          width={420}
          aria-label="Styles"
        >
          {stylesSheet ? (
            <TextEditStyles
              styles={stylesSheet.styles}
              canApply={stylesSheet.range !== null}
              onApply={(style) => {
                commands.applyStyle(style, stylesSheet.range);
                setStylesSheet(null);
              }}
              onCancel={() => setStylesSheet(null)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
    </StickyNote>
  );
  // The note's contextual menu: the Color menu of Stickies when the note's owner takes a colour
  // (a desktop that hosts the note has no menu bar of the app's own), the editing commands, and
  // the Font menu as a submenu, as in the contextual menu of a Catalina text view. The tree is the
  // same whatever the props, so the editable text the browser owns is never built again.
  return (
    <>
      <ContextualMenu>
        <ContextualMenuTrigger render={note} />
        <ContextualMenuPopup aria-label="Note">
          {onColorChange ? (
            <>
              <MenuRadioGroup
                value={known?.value ?? "yellow"}
                onValueChange={(value) => onColorChange(value as StickiesColor)}
              >
                {STICKIES_COLORS.map(({ value, label }) => (
                  <MenuRadioItem key={value} value={value}>
                    {label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
              <MenuSeparator />
            </>
          ) : null}
          {editItems}
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Font</SubmenuTrigger>
            <SubmenuPopup aria-label="Font">
              <StickiesFontMenuItems
                format={format}
                onCommand={commands.runCommand}
                onExtra={commands.runExtra}
              />
            </SubmenuPopup>
          </Submenu>
        </ContextualMenuPopup>
      </ContextualMenu>
      <StickiesPanels
        open={panels.open}
        onClose={(panel) =>
          setPanels((current) => ({
            ...current,
            open: current.open.filter((each) => each !== panel),
          }))
        }
        format={format}
        onFormatChange={commands.applyFormat}
        tools={{
          element: textElement,
          ignored: IGNORED_WORDS,
          substitutions,
          onSubstitutionsChange: setSubstitutions,
        }}
        onShown={commands.restoreSelection}
        DesktopWindow={DesktopWindow}
        manager={panels.manager ? "enclosing" : null}
        place={placeAtTopRight(() => panels.manager, 32)}
        idPrefix={`${panelIds}-`}
      />
    </>
  );
}

/** The id of the note a desktop opens, when the session has none saved. */
const DESKTOP_NOTE = "note-1";

/** The smallest note and where a note without a saved frame is sized, as `app.ts` has them. */
const NOTE_MIN_SIZE = { width: 120, height: 48 };
const MINUTE_MS = 60_000;
const NOTE_DEFAULT_SIZE = { width: 352, height: 260 };
/** How far a new or an arranged note stands from the one before. */
const CASCADE = 22;

/** The window the desktop opens for the app, and each further window as it names them. */
const APP_WINDOW = "stickies";
const NOTE_WINDOW_PREFIX = `${APP_WINDOW}:note-`;

/** What a note's window on the desktop does beside its own text. */
interface NoteWindow {
  store: ReturnType<typeof useWindowManagerStore>;
  /** The note's window among the manager's. */
  windowId: string;
  floating: boolean;
  setFloating: (floating: boolean) => void;
  defaults: StickiesDefaults;
  setDefaults: (defaults: StickiesDefaults) => void;
  canAdd: boolean;
  newNote: () => void;
  /** File > Import Text…: asks for a drive file and makes a note of it. */
  importText: () => void;
  /** Puts the text and the pictures of files dropped on the note in it. */
  dropFiles: (files: readonly DesktopDragItem[]) => void;
  /** Puts a pasted picture in the note. */
  pastePicture: (file: File) => void;
  /** File > Export Text…: asks where to write `text` on the drive. */
  exportText: (text: string) => void;
  /** The note's dates, as the tooltip of its text says them. */
  tooltip: string | undefined;
  /** The note's text changed: its Modified date is now. */
  noteChanged: () => void;
  /** File > Print All Notes. */
  printAll: () => void;
  /** Whether New Note just made this note, which then takes the keyboard. Answers once. */
  claimNew: () => boolean;
  remove: () => void;
  arrange: (by: StickiesArrangement) => void;
  findElsewhere: (query: string, backwards: boolean) => (() => void) | undefined;
  register: (actions: StickiesNoteActions | null) => void;
}

export interface StickiesDesktopNoteProps extends StickiesNoteProps {
  /**
   * The saved note this window shows and saves. Give each note window its own; without one, a
   * window shows the session's first saved note.
   */
  noteId?: string;
}

/**
 * The note a desktop page opens for Stickies: a `StickiesNote` that takes the same props.
 *
 * Served by the macalicious-desktop Ferrite application, it opens with the text, formats, colour
 * and states the browser session saved there for its note and saves its text and formats as
 * they are typed and its colour as it is chosen from the note's contextual menu, so the note
 * survives a reload. On a desktop that gives it `DesktopWindow`, and without a `noteId`, it opens
 * the session's other notes as windows of their own, and each note saves its frame and states
 * as well. `color`, `defaultText`, `defaultHtml`, `collapsed`, `defaultCollapsed` and `translucent` are
 * only what a note not saved yet opens with: a saved note shows its own. Until the session's
 * notes are read the note cannot be edited. Anywhere else it is a `StickiesNote` and nothing is
 * stored.
 */
export function StickiesDesktopNote({ noteId, ...props }: StickiesDesktopNoteProps) {
  const shown = useShownStickies();
  // This page's notes, as the origin of the changes they save: they already show them, so a change
  // to one note does not build the others again.
  const [origin] = useState(() => ({}));
  if (!syncEnabled()) return <StickiesNote {...props} />;
  // While the notes are read, nothing typed could be kept: the note is drawn again with its
  // saved text once they are.
  if (shown === undefined) return <StickiesNote key="reading" {...props} inert aria-busy />;
  const stored = shown.data?.notes ?? [];
  if (noteId === undefined && props.DesktopWindow) {
    return (
      <DesktopNotes
        {...props}
        DesktopWindow={props.DesktopWindow}
        origin={origin}
        stored={stored}
      />
    );
  }
  const id = noteId ?? stored[0]?.id ?? DESKTOP_NOTE;
  return <StoredNote key={id} {...props} id={id} origin={origin} />;
}

// One note's text, whichever window shows it: one component per note id, so a note never inherits
// another's text, title or colour, and never saves them under its own id; and built again from
// each document the window adopts (the stored notes read again, or another browser's change), so
// nothing of the window's own (an edit not stored) outlives it.
function StoredNote({
  id,
  origin,
  ...props
}: StickiesNoteProps & { id: string; origin: object; window?: NoteWindow }) {
  const shown = useShownStickies();
  const unsaved = useUnsaved();
  // The note's selection, kept for the note built in its place from each adopted document.
  const [selectionMemory] = useState<StickiesSelectionMemory>(() => ({
    selection: null,
    focused: false,
  }));
  const adoption = useStickiesAdoptionKey(shown, origin);
  return (
    <SavedNote
      key={adoption}
      {...props}
      selectionMemory={selectionMemory}
      id={id}
      origin={origin}
      unsaved={unsaved || props.unsaved}
    />
  );
}

// Every saved note as a window of the desktop. The window the desktop opened holds the first note,
// and the others are further windows of it, for as long as it stays open: when its note is removed
// the next note takes the window.
function DesktopNotes({
  DesktopWindow,
  origin,
  stored,
  ...props
}: StickiesNoteProps & {
  DesktopWindow: ComponentType<DesktopSecondaryWindowProps>;
  origin: object;
  stored: readonly SavedStickiesNote[];
}) {
  const store = useWindowManagerStore();
  const [pageSetup] = useDesktopSetting<PageSetup>(
    STICKIES_SETTINGS.pageSetup,
    readPageSetup,
    DEFAULT_PAGE_SETUP,
  );
  const [defaults, setDefaults] = useDesktopSetting(
    STICKIES_SETTINGS.defaults,
    readStickiesDefaults,
    NO_DEFAULTS,
  );
  const [floating, setFloating] = useDesktopSetting(
    STICKIES_SETTINGS.floating,
    readFloatingNotes,
    NOT_FLOATING,
  );
  const [times, setTimes] = useDesktopSetting(STICKIES_SETTINGS.times, readStickiesTimes, NO_TIMES);
  // The notes whose window the desktop closed (File > Close Window, Quit): they stay saved, and
  // open again with the app.
  const [closed, setClosed] = useState<readonly string[]>([]);
  const open = stored.filter((note) => !closed.includes(note.id));
  const mainId = open[0]?.id ?? DESKTOP_NOTE;
  const windowOf = useCallback(
    (id: string) => (id === mainId ? APP_WINDOW : `${NOTE_WINDOW_PREFIX}${id}`),
    [mainId],
  );
  const actions = useRef(new Map<string, StickiesNoteActions>());
  const made = useRef<string | null>(null);

  // The desktop names the window it opened after the app; here it is named after its note.
  const mainTitle = titleOf(open[0]?.text ?? props.defaultText ?? "") || "Empty note";
  useEffect(() => store.patch(APP_WINDOW, { title: mainTitle }), [store, mainTitle]);

  // A note Spotlight found comes to the front; one whose window the desktop closed opens first. A
  // window the request opened may not have its notes yet, so the request waits for them.
  const [askedNote, setAskedNote] = useState<string | null>(null);
  useOpenItemRequests("stickies", ({ id }) => setAskedNote(id));
  const askedIsKept = stored.some((note) => note.id === askedNote);
  const askedIsOpen = open.some((note) => note.id === askedNote);
  useEffect(() => {
    if (askedNote === null || !askedIsKept) return;
    if (!askedIsOpen) {
      setClosed((list) => list.filter((other) => other !== askedNote));
      return;
    }
    setAskedNote(null);
    store.focus(windowOf(askedNote));
  }, [askedNote, askedIsKept, askedIsOpen, store, windowOf]);

  // A floating note is a panel to the window manager: above the ordinary windows.
  const openIds = open.map((note) => note.id).join("\n");
  const floatingIds = floating.join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined ids stand for the lists
  useEffect(() => {
    for (const note of open) {
      store.patch(windowOf(note.id), { panel: floating.includes(note.id) });
    }
  }, [store, windowOf, openIds, floatingIds]);

  const newNote = () => addNote("");
  const addNote = (text: string) => {
    if (stored.length >= MAX_NOTES) return;
    const notes = store
      .list()
      .filter(
        (each) =>
          !each.minimized && (each.id === APP_WINDOW || each.id.startsWith(NOTE_WINDOW_PREFIX)),
      );
    const from = notes.at(-1)?.frame ?? { x: store.insets.left + 40, y: store.insets.top + 40 };
    const id = `note-${recordTag()}${Date.now().toString(36)}`;
    const color = defaults.color;
    // The empty note the window shows until one is saved stays where it is.
    if (stored.length === 0) saveStickiesNote(mainId, { color, text: "" }, origin);
    made.current = id;
    saveStickiesNote(
      id,
      {
        color,
        text,
        frame: { x: from.x + CASCADE, y: from.y + CASCADE, ...NEW_NOTE_SIZE },
      },
      origin,
    );
  };

  const [fileDialog, setFileDialog] = useState<StickiesFileDialog | null>(null);
  const [fileFailure, setFileFailure] = useState<string | null>(null);

  /** Puts one picture in the note, or says why it cannot go there. */
  const addPicture = async (id: string, name: string, read: () => Promise<Blob>) => {
    let address: string;
    try {
      address = await notePictureAddress(await read());
    } catch {
      setFileFailure(`“${name}” could not be read as a picture.`);
      return false;
    }
    if (actions.current.get(id)?.appendPicture(address, name)) return true;
    setFileFailure(`“${name}” is too large to fit in this note.`);
    return false;
  };

  const dropFiles = async (id: string, dropped: readonly DesktopDragItem[]) => {
    for (const picture of dropped.filter(isNotePicture)) {
      const read = async () => (await filesOfDrag([picture]))[0] as File;
      if (!(await addPicture(id, picture.name, read))) return;
    }
    const files = dropped.filter((file) => !isNotePicture(file));
    if (files.length === 0) return;
    const texts: string[] = [];
    for (const file of files) {
      try {
        texts.push(await readNoteFile(file));
      } catch {
        setFileFailure(`“${file.name}” could not be read as text.`);
        return;
      }
    }
    if (!actions.current.get(id)?.appendText(texts.join("\n"))) {
      setFileFailure(`“${files[0]?.name}” is longer than this note can hold.`);
    }
  };

  // Services > Make New Sticky Note: text kept until this window opened, and any handed over since.
  const takeShared = useRef((_text: string) => {});
  takeShared.current = (shared) => {
    if (stored.length >= MAX_NOTES) {
      setFileFailure("The selection wasn’t made a note: Stickies can’t keep another note.");
    } else if (characters(shared) > MAX_TEXT) {
      setFileFailure("The selection is longer than a note can hold.");
    } else addNote(shared);
  };
  useEffect(() => {
    for (const { text } of takeSharedText("stickies")) takeShared.current(text);
    return onSharedText("stickies", ({ text }) => takeShared.current(text));
  }, []);

  const printAll = () => {
    const notes = currentStickies()?.notes;
    if (notes?.length) printDocument(printableNotes(notes, pageSetup));
  };

  const remove = (id: string) => {
    const rest = open.filter((note) => note.id !== id);
    removeStickiesNote(id, origin);
    if (floating.includes(id)) setFloating(floating.filter((each) => each !== id));
    if (times[id]) {
      setTimes(Object.fromEntries(Object.entries(times).filter(([each]) => each !== id)));
    }
    if (rest.length === 0) store.close(APP_WINDOW);
    else if (id === mainId) whenMenusClosed(document, () => store.focus(APP_WINDOW));
  };

  const arrange = (by: StickiesArrangement) => {
    const { left, top } = store.insets;
    const notes = arrangedNotes(open, by);
    const first = notes[0];
    const room = first
      ? document
          .querySelector(`[data-window-id="${windowOf(first.id)}"]`)
          ?.closest(".mac-window-manager")
      : null;
    notes.forEach((note, index) => {
      const windowId = windowOf(note.id);
      const frame = store.get(windowId)?.frame;
      if (!frame) return;
      const place = cascadePlace(index, room?.clientHeight ?? 0, { left, top }, CASCADE);
      const placed = { ...frame, ...place };
      store.patch(
        windowId,
        {
          frame: room?.clientWidth
            ? store.bound(placed, room.clientWidth, room.clientHeight)
            : placed,
          zoomed: false,
          minimized: false,
        },
        true,
      );
    });
    const last = notes.at(-1);
    if (last) whenMenusClosed(document, () => store.focus(windowOf(last.id)));
  };

  const findElsewhere = (from: string, query: string, backwards: boolean) => {
    const at = open.findIndex((note) => note.id === from);
    const after = [...open.slice(at + 1), ...open.slice(0, Math.max(at, 0))];
    const next = (backwards ? after.reverse() : after).find((note) =>
      actions.current.get(note.id)?.hasMatch(query),
    );
    if (!next) return undefined;
    return () => {
      store.focus(windowOf(next.id));
      actions.current.get(next.id)?.openFind(query, backwards);
    };
  };

  const noteWindow = (id: string): NoteWindow => ({
    store,
    windowId: windowOf(id),
    floating: floating.includes(id),
    setFloating: (on) =>
      setFloating(
        on
          ? [...floating.filter((each) => each !== id), id]
          : floating.filter((each) => each !== id),
      ),
    defaults,
    setDefaults,
    canAdd: stored.length < MAX_NOTES,
    newNote,
    importText: () => {
      if (stored.length < MAX_NOTES) setFileDialog({ kind: "import" });
    },
    dropFiles: (files) => void dropFiles(id, files),
    pastePicture: (file) => void addPicture(id, file.name || "Picture", async () => file),
    exportText: (text) =>
      setFileDialog({
        kind: "export",
        text,
        html: currentStickies()?.notes.find((note) => note.id === id)?.html,
        anchor: document.querySelector<HTMLElement>(
          `[data-window-id="${windowOf(id)}"] > :first-child`,
        ),
      }),
    tooltip: timesTooltip(times[id]),
    noteChanged: () => {
      const now = Date.now();
      const known = times[id];
      // To the minute, as the tooltip says it: not a save of the dates with every key.
      if (known?.modified !== undefined && now - known.modified < MINUTE_MS) return;
      setTimes({ ...times, [id]: { ...known, modified: now } });
    },
    printAll,
    claimNew: () => {
      if (made.current !== id) return false;
      made.current = null;
      const now = Date.now();
      setTimes({ ...times, [id]: { created: now, modified: now } });
      return true;
    },
    remove: () => remove(id),
    arrange,
    findElsewhere: (query, backwards) => findElsewhere(id, query, backwards),
    register: (value) => {
      if (value) actions.current.set(id, value);
      else actions.current.delete(id);
    },
  });

  return (
    <>
      <StickiesFileDialogs
        dialog={fileDialog}
        maxText={MAX_TEXT}
        canAdd={stored.length < MAX_NOTES}
        onImport={addNote}
        onDone={() => setFileDialog(null)}
        failure={fileFailure}
        onFailure={setFileFailure}
      />
      <StoredNote
        key={mainId}
        {...props}
        DesktopWindow={DesktopWindow}
        id={mainId}
        origin={origin}
        window={noteWindow(mainId)}
      />
      {open
        .filter((note) => note.id !== mainId)
        .map((note) => (
          <DesktopWindow
            key={note.id}
            id={`note-${note.id}`}
            title={titleOf(note.text) || "Empty note"}
            defaultSize={note.frame ?? NOTE_DEFAULT_SIZE}
            minSize={NOTE_MIN_SIZE}
            zoomButton="zoom"
            onClose={() => setClosed((all) => [...all, note.id])}
            render={(windowProps) => (
              <StoredNote
                {...windowProps}
                DesktopWindow={DesktopWindow}
                id={note.id}
                origin={origin}
                window={noteWindow(note.id)}
              />
            )}
          />
        ))}
    </>
  );
}

const knownColor = (value: unknown) => STICKIES_COLORS.find((each) => each.value === value)?.value;

/** The notice of a note whose text another window changed at the same time. */
const NOTICE_STYLE: CSSProperties = {
  display: "flex",
  flex: "none",
  alignItems: "center",
  gap: 4,
  padding: "2px 6px",
  font: "var(--mac-font-control-mini)",
  borderTop: "var(--mac-hairline) solid currentColor",
};

// One saved note: it shows the note as the page's copy of the session's notes holds it when it is
// built, and saves its text, its formats and its colour as they change. When another window
// changed its text at the same time as this one, the version saved first is shown and the note
// says so at its foot, offering this window's text back.
function SavedNote({
  id,
  origin,
  window: noteWindow,
  ...props
}: StickiesNoteProps & { id: string; origin: object; window?: NoteWindow }) {
  const [note] = useState(() => currentStickies()?.notes.find((each) => each.id === id));
  const conflict = useStickiesConflict(id);
  // The colour is the saved note's: `color` is only what a new note starts with.
  const [color, setColor] = useState<StickiesColor>(
    () =>
      knownColor(note?.color) ?? knownColor(props.color) ?? noteWindow?.defaults.color ?? "yellow",
  );
  const text = useRef(note?.text ?? props.defaultText ?? "");
  const [collapsed, setCollapsed] = useState(note?.collapsed ?? false);
  const [translucent, setTranslucent] = useState(note?.translucent ?? false);
  // The frame to go back to from a note the zoom box fitted to its text.
  const beforeFit = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  /** The zoom box and Window > Zoom: as tall as the text needs, and back again. */
  const fitToText = (inNote: Element | null, otherwise?: () => void) => {
    const windowId = noteWindow?.windowId;
    const frame = windowId ? noteWindow?.store.get(windowId)?.frame : undefined;
    const field = inNote?.closest(".mac-stickies-note")?.querySelector(".mac-stickies-note-text");
    if (!noteWindow || !windowId || !frame || !field) {
      otherwise?.();
      return;
    }
    const room = inNote?.closest(".mac-window-manager");
    const fitted = beforeFit.current ?? {
      ...frame,
      height: Math.max(
        NOTE_MIN_SIZE.height,
        field.scrollHeight + frame.height - field.clientHeight,
      ),
    };
    beforeFit.current = beforeFit.current ? null : frame;
    noteWindow.store.patch(
      windowId,
      {
        zoomed: false,
        frame: room?.clientWidth
          ? noteWindow.store.bound(fitted, room.clientWidth, room.clientHeight)
          : fitted,
      },
      true,
    );
  };
  const [asking, setAsking] = useState(false);
  const [settingUpPage, setSettingUpPage] = useState(false);
  const [pageSetup, setPageSetup] = useDesktopSetting<PageSetup>(
    STICKIES_SETTINGS.pageSetup,
    readPageSetup,
    DEFAULT_PAGE_SETUP,
  );
  const format = useRef<RichTextFormat | undefined>(undefined);
  const actions = useRef<StickiesNoteActions | null>(null);
  const keepStates = (states: Pick<SavedStickiesNote, "frame" | "collapsed" | "translucent">) =>
    saveStickiesNote(id, { color, text: text.current, ...states }, origin);
  const latestKeep = useRef(keepStates);
  latestKeep.current = keepStates;

  // The note's window stands where the note was saved, within reach of this desktop, and from then
  // on the note keeps where the person moves and sizes it.
  const store = noteWindow?.store;
  const windowId = noteWindow?.windowId;
  const [ownWindow, setOwnWindow] = useState<Element | null>(null);
  useEffect(() => {
    if (windowId) setOwnWindow(document.querySelector(`[data-window-id="${windowId}"]`));
  }, [windowId]);
  const latestFit = useRef(fitToText);
  latestFit.current = fitToText;
  const zoomRow = useMemo(
    () =>
      ownWindow ? (
        <MenuItem
          disabled={collapsed}
          onClick={() => latestFit.current(ownWindow.querySelector(".mac-stickies-note"))}
        >
          Zoom
        </MenuItem>
      ) : null,
    [ownWindow, collapsed],
  );
  useDesktopAppMenu("stickies", WINDOW_ZOOM_ROW, zoomRow, ownWindow);
  // The height of the note's window while it is collapsed to its title bar, so that what is under
  // the rest of it can be clicked: the saved frame keeps this one.
  const expandedHeight = useRef<number | null>(null);
  const resizeForCollapse = (next: boolean) => {
    const frame = store && windowId ? store.get(windowId)?.frame : undefined;
    if (!store || !windowId || !frame) return;
    if (next) expandedHeight.current ??= frame.height;
    const height = next ? TITLE_BAR_HEIGHT : (expandedHeight.current ?? frame.height);
    if (!next) expandedHeight.current = null;
    store.patch(windowId, { zoomed: false, frame: { ...frame, height } });
  };
  const claimNew = useRef(noteWindow?.claimNew);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the saved frame is read once, as the note is
  useEffect(() => {
    if (!store || !windowId) return;
    const room = document
      .querySelector(`[data-window-id="${windowId}"]`)
      ?.closest(".mac-window-manager");
    if (note?.frame) {
      store.patch(windowId, {
        frame: room?.clientWidth
          ? store.bound(note.frame, room.clientWidth, room.clientHeight)
          : note.frame,
      });
    }
    if (claimNew.current?.()) whenMenusClosed(document, () => store.focus(windowId));
    if (note?.collapsed) {
      const height = note.frame?.height ?? store.get(windowId)?.frame.height;
      expandedHeight.current =
        height && height > TITLE_BAR_HEIGHT ? height : NOTE_DEFAULT_SIZE.height;
      resizeForCollapse(true);
    }
    let last = store.get(windowId)?.frame;
    return store.subscribe(() => {
      const now = store.get(windowId)?.frame;
      if (!now || now === last) return;
      last = now;
      const height = expandedHeight.current;
      latestKeep.current({ frame: height === null ? now : { ...now, height } });
    });
  }, [store, windowId]);

  // A collapsed note has no text to give the keyboard to: the window takes it, on the note itself.
  const backToNote = useCallback(
    () =>
      whenMenusClosed(document, () => {
        actions.current?.restoreSelection();
        if (store && windowId) store.focus(windowId);
      }),
    [store, windowId],
  );
  const collapse = (next: boolean) => {
    backToNote();
    resizeForCollapse(next);
    setCollapsed(next);
    keepStates({ collapsed: next });
    props.onCollapsedChange?.(next);
  };
  const makeTranslucent = (next: boolean) => {
    setTranslucent(next);
    keepStates({ translucent: next });
  };
  const askToClose = () => {
    if (text.current.trim() === "") noteWindow?.remove();
    else setAsking(true);
  };
  const makeDefault = () => {
    const { family, size } = format.current ?? {};
    noteWindow?.setDefaults({
      color,
      ...(family === undefined ? null : { family }),
      ...(size === undefined ? null : { size }),
    });
  };
  // Saved with every change, so Save All has nothing left to do but keep the keyboard here.
  const saveAll = () => backToNote();
  const printNote = () => {
    const saved = currentStickies()?.notes.find((each) => each.id === id);
    printDocument(printableNotes([saved ?? { text: text.current }], pageSetup));
  };
  // What the menu's rows and the keys do, for the rows, which are made once per state.
  const commands = useRef({
    noteWindow,
    collapse,
    makeTranslucent,
    askToClose,
    makeDefault,
    saveAll,
    printNote,
    pageSetup: () => setSettingUpPage(true),
    text,
  });
  commands.current = {
    noteWindow,
    collapse,
    makeTranslucent,
    askToClose,
    makeDefault,
    saveAll,
    printNote,
    pageSetup: () => setSettingUpPage(true),
    text,
  };

  const hasWindow = noteWindow !== undefined;
  const canAdd = noteWindow?.canAdd ?? false;
  const floating = noteWindow?.floating ?? false;
  const desktopMenus = useMemo(() => {
    if (!hasWindow) return undefined;
    return {
      file: (
        <StickiesFileItems
          canAdd={canAdd}
          onNewNote={() => commands.current.noteWindow?.newNote()}
          onClose={() => commands.current.askToClose()}
          onSaveAll={() => commands.current.saveAll()}
          onImport={() => commands.current.noteWindow?.importText()}
          onExport={() => commands.current.noteWindow?.exportText(commands.current.text.current)}
          onPageSetup={() => commands.current.pageSetup()}
          onPrint={() => commands.current.printNote()}
          onPrintAll={() => commands.current.noteWindow?.printAll()}
        />
      ),
      window: (
        <StickiesWindowItems
          collapsed={collapsed}
          floating={floating}
          translucent={translucent}
          onCollapsedChange={(next) => commands.current.collapse(next)}
          onFloatingChange={(next) => {
            commands.current.noteWindow?.setFloating(next);
            backToNote();
          }}
          onTranslucentChange={(next) => {
            commands.current.makeTranslucent(next);
            backToNote();
          }}
          onUseAsDefault={() => {
            commands.current.makeDefault();
            backToNote();
          }}
          onArrange={(by) => commands.current.noteWindow?.arrange(by)}
        />
      ),
    };
  }, [hasWindow, canAdd, collapsed, floating, translucent, backToNote]);
  const keyCommands: readonly (readonly [string, () => void])[] | undefined = noteWindow && [
    ["command+n", noteWindow.newNote],
    ["command+w", askToClose],
    ["command+s", saveAll],
    ["shift+command+i", noteWindow.importText],
    ["command+p", printNote],
    ["shift+command+p", () => setSettingUpPage(true)],
    ["command+m", () => collapse(!collapsed)],
    ["option+command+f", () => noteWindow.setFloating(!noteWindow.floating)],
    ["option+command+t", () => makeTranslucent(!translucent)],
  ];
  const { family: startFamily, size: startSize } = noteWindow?.defaults ?? {};

  return (
    <>
      <StickiesNote
        {...props}
        desktopMenus={desktopMenus}
        onDropFiles={noteWindow?.dropFiles}
        onPastePicture={noteWindow?.pastePicture}
        keyCommands={keyCommands}
        startFormat={
          text.current === "" && (startFamily || startSize)
            ? {
                ...(startFamily ? { family: startFamily } : null),
                ...(startSize ? { size: startSize } : null),
              }
            : undefined
        }
        onFindElsewhere={noteWindow?.findElsewhere}
        onClose={noteWindow ? askToClose : props.onClose}
        onFormatChange={(next) => {
          format.current = next;
          props.onFormatChange?.(next);
        }}
        actionsRef={(value: StickiesNoteActions | null) => {
          actions.current = value;
          noteWindow?.register(value);
          const outer = props.actionsRef;
          if (typeof outer === "function") outer(value);
          else if (outer) outer.current = value;
        }}
        notice={
          conflict ? (
            <div className="mac-stickies-notice" role="note" style={NOTICE_STYLE}>
              <span style={{ flex: 1 }}>Changed in another window.</span>
              <PushButton size="mini" onClick={() => keepStickiesConflict(id)}>
                Keep Mine
              </PushButton>
              <PushButton size="mini" onClick={() => dismissStickiesConflict(id)}>
                OK
              </PushButton>
            </div>
          ) : (
            props.notice
          )
        }
        color={color}
        onZoom={(event) => fitToText(event.currentTarget, () => props.onZoom?.(event))}
        textTooltip={noteWindow?.tooltip}
        defaultText={note?.text ?? props.defaultText}
        defaultHtml={note ? note.html : props.defaultHtml}
        // A saved note's states are its own, false when it has none: the host's only start a note
        // not saved yet. On the desktop's windows the note keeps them.
        collapsed={noteWindow ? collapsed : note ? undefined : props.collapsed}
        defaultCollapsed={note ? (note.collapsed ?? false) : props.defaultCollapsed}
        onCollapsedChange={noteWindow ? collapse : props.onCollapsedChange}
        translucent={noteWindow || note ? translucent : props.translucent}
        // The server keeps no longer a note; a text it would refuse is never written.
        maxLength={Math.min(props.maxLength ?? MAX_TEXT, MAX_TEXT)}
        onTextChange={(next, html) => {
          text.current = next;
          props.onTextChange?.(next, html);
          saveStickiesNote(id, { color, text: next, html }, origin);
          noteWindow?.noteChanged();
        }}
        onColorChange={(next) => {
          setColor(next);
          props.onColorChange?.(next);
          // The text and its formats are saved as they are.
          saveStickiesNote(id, { color: next, text: text.current }, origin);
        }}
      />
      <Sheet open={settingUpPage} onOpenChange={setSettingUpPage}>
        <SheetPopup
          anchor={
            document.activeElement?.closest<HTMLElement>(".mac-stickies-note") ??
            document.querySelector<HTMLElement>(".mac-stickies-note") ??
            undefined
          }
          width={420}
          aria-label="Page Setup"
        >
          {settingUpPage ? (
            <TextEditPageSetup
              value={pageSetup}
              onChoose={(chosen) => {
                setSettingUpPage(false);
                setPageSetup(chosen);
              }}
              onCancel={() => setSettingUpPage(false)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Alert open={asking} onOpenChange={setAsking}>
        <AlertPopup>
          <AlertMessage>
            Do you want to remove the note {"\u201c"}
            {titleOf(text.current)}
            {"\u201d"}?
          </AlertMessage>
          <AlertInformativeText>Its text cannot be brought back.</AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose render={<DefaultButton />} onClick={() => noteWindow?.remove()}>
              Remove Note
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </>
  );
}

export interface StickiesProps extends Omit<WindowManagerProps, "children" | "insets"> {
  /**
   * The notes the app opens with, the last one in front. Read once.
   * @default defaultStickies
   */
  defaultNotes?: readonly StickiesNoteData[];
}

/**
 * Catalina's Stickies as it looks on the screen: a desktop with the menu bar of the app and
 * its notes on it.
 *
 * The root is the library's `WindowManager` and takes its props: give it a size with `style`
 * or a class (480 pt tall by default). Each note is a `StickiesNote` in a managed window: it
 * is moved by its title bar, resized by its edges, and the one in front is the key note, the
 * only one with a coloured title bar. The menus act on the key note, or on the note in front
 * while the Fonts or the Colors panel is key: those are utility panels of the same manager.
 */
export function Stickies({ defaultNotes = defaultStickies, className, ...props }: StickiesProps) {
  return (
    <WindowManager
      {...props}
      insets={{ top: MENU_BAR_HEIGHT }}
      className={className ? `mac-stickies ${className}` : "mac-stickies"}
    >
      <StickiesDesktop defaultNotes={defaultNotes} />
    </WindowManager>
  );
}

/** A note on the desktop: what the app knows of it beside its text, which the browser holds. */
interface OpenNote extends StickiesNoteData {
  title: string;
}

// The desktop's own content: it reads the window manager around it for the key note.
function StickiesDesktop({ defaultNotes }: { defaultNotes: readonly StickiesNoteData[] }) {
  const store = useWindowManagerStore();
  const { windows, focus, close, zoom } = useWindowManager();
  const [notes, setNotes] = useState<readonly OpenNote[]>(() =>
    defaultNotes.map((note) => ({ ...note, title: titleOf(note.text) })),
  );
  // How many notes File > New Note has made, for their ids.
  const made = useRef(0);
  // The height each collapsed note goes back to.
  const heights = useRef(new Map<string, number>());
  // The note the menus act on: the key note, or the one in front, which is main, while a panel
  // is key.
  const frontId = windows.find(
    (window) => !window.panel && (window.state === "key" || window.state === "main"),
  )?.id;
  const key = notes.find((note) => note.id === frontId);
  // Each note's text commands, and the format where its insertion point is: the Font menu and
  // the panels act on the note in front.
  const actions = useRef(new Map<string, StickiesNoteActions>());
  const [formats, setFormats] = useState<Readonly<Record<string, RichTextFormat>>>({});
  const [panels, setPanels] = useState<readonly StickiesPanel[]>([]);
  const desktop = useRef<HTMLDivElement>(null);
  const front = () => (key ? actions.current.get(key.id) : undefined);
  const showPanel = (panel: StickiesPanel) =>
    setPanels((open) => (open.includes(panel) ? open : [...open, panel]));
  // Whether a command of the Font menu was chosen since the menu opened: the note it acted on then
  // keeps the keyboard when the menu closes, rather than the menu's title in the bar, as in a
  // Catalina window. The menu's popup asks `keepFocus` when it closes, and may ask again later
  // (its focus manager runs it from an effect), so it only answers and changes nothing; the
  // note takes its selection back once, when the menu has closed.
  const commanded = useRef(false);
  const keepFocus = useCallback(() => !commanded.current, []);
  const fontMenuOpenChange = (open: boolean) => {
    if (open) commanded.current = false;
    else if (commanded.current) setTimeout(() => front()?.restoreSelection(), 0);
  };
  const fontCommand = (command: RichTextCommand) => {
    commanded.current = true;
    if (command === "show-fonts") showPanel("fonts");
    else if (command === "show-colors") showPanel("colors");
    else front()?.runCommand(command);
  };

  const change = (id: string, patch: Partial<OpenNote>) =>
    setNotes((all) => all.map((note) => (note.id === id ? { ...note, ...patch } : note)));

  // A collapsed note's window is as tall as its title bar, so that what is under the rest of
  // it can be clicked; the manager's frame is where a window's height lives.
  const setCollapsed = (note: OpenNote, collapsed: boolean) => {
    const frame = store.get(note.id)?.frame;
    if (frame) {
      if (collapsed) heights.current.set(note.id, frame.height);
      const height = collapsed
        ? TITLE_BAR_HEIGHT
        : (heights.current.get(note.id) ?? note.frame.height);
      store.patch(note.id, { zoomed: false, frame: { ...frame, height } });
    }
    change(note.id, { collapsed });
  };

  // A new note is yellow and empty, and opens a little right of and below the key note.
  const newNote = () => {
    made.current += 1;
    const from = (key && store.get(key.id)?.frame) || { x: 20, y: 34 };
    setNotes((all) => [
      ...all,
      {
        id: `new-${made.current}`,
        color: "yellow",
        text: "",
        title: "",
        frame: { x: from.x + 20, y: from.y + 20, ...NEW_NOTE_SIZE },
      },
    ]);
  };

  return (
    <>
      <div className="mac-stickies-desktop" ref={desktop}>
        <Desktop
          picture={<div className="mac-stickies-picture" />}
          style={
            {
              height: "100%",
              "--mac-desktop-inset-top": `${MENU_BAR_HEIGHT}px`,
            } as CSSProperties
          }
        >
          <DesktopIcon icon={<VolumeIcon />}>Macintosh SSD</DesktopIcon>
          <DesktopIcon icon={<VolumeIcon />}>Time Machine</DesktopIcon>
        </Desktop>
      </div>

      {notes.map((note) => (
        <ManagedWindow
          key={note.id}
          id={note.id}
          app="stickies"
          title={note.title || "Empty note"}
          defaultFrame={note.collapsed ? { ...note.frame, height: TITLE_BAR_HEIGHT } : note.frame}
          minWidth={120}
          minHeight={48}
          // A collapsed note is its title bar: there is nothing to resize or to zoom.
          resizable={!note.collapsed}
          zoomButton="zoom"
          onOpenChange={(open) => {
            if (!open) setNotes((all) => all.filter((other) => other.id !== note.id));
          }}
          render={(props) => (
            <StickiesNote
              {...props}
              color={note.color}
              collapsed={note.collapsed ?? false}
              onCollapsedChange={(collapsed) => setCollapsed(note, collapsed)}
              translucent={note.translucent}
              defaultText={note.text}
              onTitleChange={(title) => change(note.id, { title })}
              onFormatChange={(format) => setFormats((all) => ({ ...all, [note.id]: format }))}
              onShowPanel={showPanel}
              actionsRef={(value: StickiesNoteActions | null) => {
                if (value) actions.current.set(note.id, value);
                else actions.current.delete(note.id);
              }}
            />
          )}
        />
      ))}

      <StickiesPanels
        open={panels}
        onClose={(panel) => setPanels((open) => open.filter((each) => each !== panel))}
        format={key ? formats[key.id] : undefined}
        onFormatChange={(change) => front()?.applyFormat(change)}
        onShown={() => front()?.restoreSelection()}
        manager="here"
        place={placeAtTopRight(() => desktop.current, MENU_BAR_HEIGHT + 10)}
      />

      <div className="mac-stickies-menu-bar">
        <MenuBar modal={false}>
          <MenuBarMenu title={<AppleMenuMark />} aria-label="Apple">
            <MenuItem disabled>About This Mac</MenuItem>
          </MenuBarMenu>
          <MenuBarMenu title="Stickies" application>
            <MenuItem disabled>About Stickies</MenuItem>
            <MenuSeparator />
            <MenuItem disabled>Quit Stickies</MenuItem>
          </MenuBarMenu>
          <MenuBarMenu title="File">
            <MenuItem onClick={newNote}>New Note</MenuItem>
            <MenuItem disabled={!key} onClick={() => key && close(key.id)}>
              Close
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
          <MenuBarMenu
            title="Font"
            onOpenChange={fontMenuOpenChange}
            popup={{ finalFocus: keepFocus }}
          >
            <StickiesFontMenuItems
              format={key ? formats[key.id] : undefined}
              disabled={!key || !!key.collapsed}
              onCommand={fontCommand}
            />
          </MenuBarMenu>
          <MenuBarMenu title="Color">
            <MenuRadioGroup
              value={key?.color ?? ""}
              onValueChange={(color) => key && change(key.id, { color: color as StickiesColor })}
            >
              {STICKIES_COLORS.map(({ value, label }) => (
                <MenuRadioItem key={value} value={value} disabled={!key}>
                  {label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuBarMenu>
          <MenuBarMenu title="Window">
            <MenuItem disabled={!key} onClick={() => key && setCollapsed(key, !key.collapsed)}>
              {key?.collapsed ? "Expand" : "Collapse"}
            </MenuItem>
            <MenuItem disabled={!key || key.collapsed} onClick={() => key && zoom(key.id)}>
              Zoom
            </MenuItem>
            <MenuCheckboxItem
              disabled={!key}
              checked={key?.translucent ?? false}
              onCheckedChange={(translucent) => key && change(key.id, { translucent })}
            >
              Translucent Window
            </MenuCheckboxItem>
            {notes.length > 0 && <MenuSeparator />}
            <MenuRadioGroup value={key?.id ?? ""} onValueChange={(id) => focus(id as string)}>
              {notes.map((note) => (
                <MenuRadioItem key={note.id} value={note.id}>
                  {note.title || "Empty note"}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuBarMenu>
          <MenuBarMenu title="Help">
            <MenuItem disabled>Stickies Help</MenuItem>
          </MenuBarMenu>
        </MenuBar>
      </div>
    </>
  );
}
