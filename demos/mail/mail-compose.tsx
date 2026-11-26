"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { ColorPanel } from "macalicious/color-panel";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import {
  applyRichTextFormat,
  FONT_FAMILIES,
  keepRichTextSelection,
  keepTypingRuns,
  RICH_TEXT_KEY_EQUIVALENTS,
  type RichTextAlignment,
  type RichTextCommand,
  type RichTextFormat,
  type RichTextSelectionKeeper,
  readRichTextFormat,
  richTextFromHtml,
  richTextKeyCommand,
  runRichTextCommand,
} from "macalicious/lib/rich-text";
import { Menu, MenuPopup } from "macalicious/menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TextField } from "macalicious/text-field";
import { RichTextView } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { TokenFieldCompletions } from "macalicious/token-field-completions";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarPullDown } from "macalicious/toolbar-pop-up";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { clipboardPictures, copiedDriveItems } from "../desktop/desktop-clipboard";
import {
  beginDesktopDrag,
  type DesktopDragItem,
  registerDropTarget,
  useDesktopDrop,
} from "../desktop/desktop-drag";
import { DesktopFontPanel } from "../desktop/desktop-font-panel";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { substituteTyped, useTextSubstitutions } from "../desktop/text-substitutions";
import {
  checkDocumentAfterMenu,
  SpellingItems,
  SpellingPanel,
  SubstitutionItems,
  SubstitutionsPanel,
  useLearnedWords,
} from "../desktop/text-tools";
import { type EditMenuTarget, EditorEditItems, EditorMoreItems } from "../notes/notes-edit-menu";
import { FindBar, type TextFind, useTextFind } from "../notes/notes-find";
import { whenMenusClosed } from "../notes/notes-menus";
import { MailGlyph } from "./mail-artwork";
import { MAIL_FILE_HTML, MAIL_FILE_MARK } from "./mail-attachments";
import { CONTACTS, EMPTY_DRAFT, type MailDraft, type MailPriority } from "./mail-data";
import {
  holdsStyles,
  type MailTextCommand,
  makePlain,
  placeCaretAt,
  runMailText,
  stepQuoteLevel,
} from "./mail-format";
import { MailFormatBar } from "./mail-format-bar";
import { MailPhotoBrowser } from "./mail-photo-browser";
import {
  holdsLines,
  KEPT_SIGNATURE,
  type MailSignature,
  markSignature,
  NO_SIGNATURE,
  SIGNATURE_HTML,
  settleMarks,
  signatureIn,
  swapSignature,
  toggleOriginal,
} from "./mail-signatures";
import type { MailStationery } from "./mail-stationery";
import { MailTabViewItems } from "./mail-tabs";
import { insertText, messageText } from "./mail-text";
import { accountOf, completeAddress, fillInput, quotationHtml, quotationText } from "./mail-tools";
import "./mail.tokens.css";
import "./mail.css";

const EMOJI: readonly [character: string, name: string][] = [
  ["🙂", "Slightly Smiling Face"],
  ["😀", "Grinning Face"],
  ["👍", "Thumbs Up"],
  ["🎉", "Party Popper"],
  ["⛴️", "Ferry"],
];

/**
 * Why Attach, Markup and Photo Browser are unavailable in a window with nobody to keep its files:
 * the demo's Mail holds a message's text and styles only. Shown as each button's tooltip and
 * description; the buttons stay dimmed.
 */
export const ATTACHMENTS_UNAVAILABLE =
  "Attachments are not available: this Mail sends text and styles only, and keeps no files with messages.";

/** The address fields' drag: a token moved to another field, or a person dragged here from an app. */
export const ADDRESS_DRAG_TYPE = "application/x-macalicious-address";

type AddressField = "to" | "cc" | "bcc";

/** Why Markup is unavailable where files can be attached, until one of them is a picture. */
export const MARKUP_NEEDS_PICTURE =
  "Not available yet: attach a picture with Attach, or drag it here from Finder.";

/** How a New Message window takes files, from an owner that keeps them. */
export interface MailComposeAttaching {
  /** The toolbar's Attach, and File > Attach Files; it does nothing while `available` is false. */
  choose: () => void;
  /** Whether files can be added now: not while the message may not change. */
  available: boolean;
  /** Told whether the window's message may not change, so that nothing is added meanwhile. */
  setFrozen: (frozen: boolean) => void;
  /** Files dropped on the window from the computer. */
  takeFiles: (files: readonly File[]) => void;
  /** Files and folders dragged onto the window from Finder or the desktop. */
  drop: (items: readonly DesktopDragItem[]) => void;
  /** The message's files as the owner shows them, under the text. */
  strip: ReactNode;
  /** What the owner renders with the window: where a file is chosen. */
  panel: ReactNode;
  /** Each file of the message; one a saved draft holds has its place in the text already. */
  placed: readonly { key: string; name: string; held?: boolean }[];
  /** Changes when the message's files change: it is then saved as a draft. */
  revision: string;
  /** Marks up the newest picture the window can read again, or `null` while it has none. */
  markup?: (() => void) | null;
}

/**
 * Why Include Original Message is unavailable: only a reply just started holds an original it can take
 * out and put back. Shown as the button's tooltip; the button stays dimmed.
 */
export const INCLUDE_ORIGINAL_UNAVAILABLE =
  "There is no original message to take out or put back: this is a new message, a forward or a saved draft.";

/** What Edit > Attachments' rows about Windows change: Mail strips resource forks, and these files have none. */
export const WINDOWS_FRIENDLY_NOTE =
  "Files go exactly as they are, on or off: a file from a browser or this desktop's drive has no resource fork to strip.";

/** Why Edit > Attachments > Insert Attachments at End of Message is dimmed in a plain message. */
const PLAIN_FILES_LAST = "Plain text has no place for a file, so its files go under the text.";

/** Edit > Attachments' settings, kept with the person's. */
const MAIL_FILES_AT_END = "mail.attachmentsAtEnd";
const MAIL_WINDOWS_FRIENDLY = "mail.windowsFriendly";
const readBoolean = (stored: unknown) => (typeof stored === "boolean" ? stored : undefined);
const COMPOSE_HTML = {
  attributes: { ...SIGNATURE_HTML.attributes, ...MAIL_FILE_HTML.attributes },
};

const NO_LIST: readonly MailSignature[] = [];

/** A menu's rows of what the window is now: the menu bar renders them as the menu opens. */
function Latest({ rows }: { rows: { current: () => ReactNode } }) {
  return rows.current();
}

/** How long after the last change a New Message window's text is saved as a draft. */
const AUTOSAVE_MS = 3_000;
/** How long after a save that failed it is tried again. */
const AUTOSAVE_RETRY_MS = 15_000;

/** Why a New Message window saves its message: see `onAutosave`. */
export type MailAutosaveMoment = "typing" | "window" | "page";

/**
 * What the format bar and the Fonts panel show until the text is read: Mail's message font,
 * Helvetica 12 (Mail > Preferences > Fonts & Colors), black, left-aligned.
 */
const MESSAGE_FORMAT: RichTextFormat = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  family: "Helvetica",
  size: 12,
  color: "#000000",
  highlight: "none",
  align: "left",
};

const sameFormat = (a: RichTextFormat, b: RichTextFormat) =>
  (Object.keys(a) as (keyof RichTextFormat)[]).every((key) => a[key] === b[key]);

/** The optional header fields a person asked to see, kept with their settings. */
const MAIL_FIELDS = "mail.composeFields";
interface ComposeFields {
  bcc: boolean;
  replyTo: boolean;
  priority: boolean;
}
const NO_FIELDS: ComposeFields = { bcc: false, replyTo: false, priority: false };
const readFields = (stored: unknown): ComposeFields | undefined => {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { bcc, replyTo, priority } = stored as Partial<Record<keyof ComposeFields, unknown>>;
  return { bcc: bcc === true, replyTo: replyTo === true, priority: priority === true };
};

/** A field of the header (To, Cc, Subject): plain text, which takes no character styles. */
const isTextField = (target: EventTarget) =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && target.type !== "color");

export interface MailComposeProps extends Omit<WindowProps, "children" | "autoFocus"> {
  /** The window's tabs on a desktop, under its title bar. */
  tabBar?: ReactNode;
  /** What the window holds at first; empty by default. */
  defaultDraft?: MailDraft;
  /** The names the address fields complete. */
  contacts?: readonly string[];
  /**
   * Called with the message when Send is chosen: its `body` as plain text and its `html` with
   * the styles. Send is disabled without a recipient.
   */
  onSend?: (draft: MailDraft) => void;
  /** Called by the close button. */
  onClose?: WindowControlsProps["onClose"];
  /**
   * Put the keyboard in the To field when the window appears.
   * @default false
   */
  autoFocus?: boolean;
  /** Further props for the `WindowControls`. Their `onClose` closes the window when `onClose` is
   * not given, after the same checks: the draft is kept first, and nothing closes while a
   * message is being sent. */
  controlsProps?: WindowControlsProps;
  /** Called when the title bar itself is pressed: a window manager starts a move here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /** A line over the message's text: a send the owner could not make, and why. */
  notice?: ReactNode;
  /**
   * Whether Send is under way: Send is disabled, and nothing in the window can be changed, so
   * what is sent is what the window shows.
   * @default false
   */
  sending?: boolean;
  /**
   * Whether the message is held as it is, with Send still available: a send whose outcome is
   * unknown, which only the same message may follow, so that it is never delivered twice.
   * @default false
   */
  held?: boolean;
  /**
   * Called with the message as it stands when the close button closes the window, before
   * `onClose`: an owner keeps it as a draft. Answering `false`, or a promise of `false`, keeps
   * the window open with what it holds (the draft could not be kept).
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: an owner that answers nothing lets the window close
  onDraftClose?: (draft: MailDraft) => void | boolean | Promise<boolean>;
  /**
   * Set to the window's own close, with its checks (the draft kept first, nothing closed while
   * a message is sent or held), for a close its owner is asked for from outside the window: a
   * desktop's File > Close Window.
   */
  closeRef?: { current: (() => void) | null };
  /** Set to the window's Send, with its checks, for the menu bar's Message > Send and its key. */
  sendRef?: { current: (() => void) | null };
  /** Set to the window's Attach, or `null` while its message may not change, for File > Attach Files. */
  attachRef?: { current: (() => void) | null };
  /** Told whether this is the key window, for the menu bar's Send and keys. */
  keyRef?: (isKey: boolean) => void;
  /**
   * Called with the message as it stands about three seconds after it last changed (`typing`, and
   * again some time later while saves fail), on File > Save (`typing`), when the window is taken
   * away without its own close (`window`: Mail closed or quit), and when the page goes away
   * (`page`): an owner keeps it as a draft, as Mail saves as you write. It answers whether the
   * message is kept. `typing` does not come while a send or a save is under way or a message is
   * held, nor anything for a window that was sent or closed.
   */
  onAutosave?: (draft: MailDraft, when: MailAutosaveMoment) => Promise<boolean>;
  /** Set to a save of the message now, if it changed, for File > Save. */
  saveRef?: { current: (() => void) | null };
  /** What a reply or a forward quotes: where the quote ends, and what Include Original Message moves. */
  original?: string;
  /** The quote stays, as in a forward: Include Original Message is dimmed. */
  keepsOriginal?: boolean;
  /** The signature `defaultDraft` was just made with, by `withSignature`: only a new message has one. */
  startingSignature?: MailSignature | null;
  /** The person's signatures: a pop-up inserts one and swaps it. */
  signatures?: readonly MailSignature[];
  /**
   * A signature goes above quoted text, else under it.
   * @default true
   */
  signatureAbove?: boolean;
  /** Check spelling as the message is written. */
  spellCheck?: boolean;
  /** Edit > Spelling and Grammar > Check Spelling While Typing. */
  onSpellCheckChange?: (on: boolean) => void;
  /** The files of the message this one replies to, for Edit > Attachments. */
  originalFiles?: readonly DesktopDragItem[];
  /** The messages selected in the viewer as text, for Edit > Append Selected Messages; `null` for none. */
  appendSelected?: (() => Promise<string | null>) | null;
  /** Opens Contacts on a recipient's card, from a token's menu. */
  onAddAddress?: (written: string) => void;
  /** The messages kept with File > Save as Stationery: a pop-up starts this one from one of them. */
  stationery?: readonly MailStationery[];
  /** Set to what the window holds now, for File > Save as Stationery. */
  draftRef?: { current: (() => MailDraft) | null };
  /** Shows the desktop's character viewer, from the Emoji pull-down. */
  onShowCharacters?: () => void;
  /** Makes the window take files; without it Attach is dimmed and says why. */
  attaching?: MailComposeAttaching;
}

/**
 * Mail's New Message window: a toolbar on a title bar without a title, the To, Cc and Subject
 * fields and the text of the message. Its root is the library's `Window`, which takes every
 * other prop. Nothing is sent: Send hands the message to `onSend`.
 *
 * The message is a rich text view in Mail's message font, Helvetica 12. Its text is styled from
 * the format bar (the toolbar's Show Format Bar button), from the keys of Mail's Format menu
 * (Command-B, I and U; Command-T, the Fonts panel; Shift-Command-C, the Colors panel; Command-plus
 * and Command-minus; Command-{, | and } for the alignments; Control off Apple platforms), and
 * from the Fonts and Colors panels, which float at the top right of the page.
 */
export function MailCompose({
  tabBar,
  stationery = [],
  draftRef,
  onShowCharacters,
  defaultDraft = EMPTY_DRAFT,
  contacts = CONTACTS,
  onSend,
  onClose,
  autoFocus = false,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  notice,
  sending = false,
  held = false,
  onDraftClose,
  closeRef,
  sendRef,
  attachRef,
  keyRef,
  onAutosave,
  saveRef,
  attaching,
  original,
  keepsOriginal = false,
  startingSignature,
  signatures = NO_LIST,
  signatureAbove = true,
  spellCheck,
  onSpellCheckChange,
  originalFiles,
  appendSelected,
  onAddAddress,
  state = "key",
  width = 886,
  height = 585,
  className,
  onKeyDown,
  ...props
}: MailComposeProps) {
  const id = useId();
  const [to, setTo] = useState<readonly string[]>(defaultDraft.to);
  const [cc, setCc] = useState<readonly string[]>(defaultDraft.cc);
  const [bcc, setBcc] = useState<readonly string[]>(defaultDraft.bcc ?? []);
  const [replyTo, setReplyTo] = useState(defaultDraft.replyTo ?? "");
  const [priority, setPriority] = useState<MailPriority | undefined>(defaultDraft.priority);
  const [fields, setFields] = useDesktopSetting(MAIL_FIELDS, readFields, NO_FIELDS);
  // A field is shown while it says something, whatever was asked: nobody is written to unseen.
  const showBcc = fields.bcc || bcc.length > 0;
  const showReplyTo = fields.replyTo || replyTo !== "";
  const showPriority = fields.priority || priority !== undefined;
  const recipients = to.length + cc.length + bcc.length;
  const [subject, setSubject] = useState(defaultDraft.subject);
  const [showCc, setShowCc] = useState(true);
  const [formatBar, setFormatBar] = useState(false);
  // The format where the insertion point is, which the format bar and the Fonts panel show.
  const [format, setFormat] = useState(MESSAGE_FORMAT);
  const [fontsShown, setFontsShown] = useState(false);
  const [colorsShown, setColorsShown] = useState(false);
  const [substitutions, setSubstitutions] = useTextSubstitutions("mail");
  const [spellingShown, setSpellingShown] = useState(false);
  const [substitutionsShown, setSubstitutionsShown] = useState(false);
  const ignoredWords = useRef(new Set<string>());
  const { learned: learnedWords } = useLearnedWords();
  const latestLearned = useRef(learnedWords);
  latestLearned.current = learnedWords;
  // What Edit > Attachments brought in already, and the address field last used.
  const [originalsAdded, setOriginalsAdded] = useState(false);
  const [filesAtEnd, setFilesAtEnd] = useDesktopSetting(MAIL_FILES_AT_END, readBoolean, false);
  const [alwaysFriendly, setAlwaysFriendly] = useDesktopSetting(
    MAIL_WINDOWS_FRIENDLY,
    readBoolean,
    false,
  );
  const [friendly, setFriendly] = useState<boolean | null>(null);
  const addressField = useRef<"to" | "cc" | "bcc" | null>(null);
  // Counts the message's changes while the Find bar is open: what it found is found again.
  const [edits, setEdits] = useState(0);
  const findShown = useRef(false);
  // The page's body, where the panels float, once the window is in it.
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  // The token whose menu was asked for, and the element the menu hangs from.
  const [asked, setAsked] = useState<{
    field: "to" | "cc" | "bcc";
    index: number;
    element: HTMLElement;
  } | null>(null);
  const toInput = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  // The selection as it last was in the message: a control or a panel takes the focus before
  // its command runs, and the command acts where the person was typing.
  const keeper = useRef<RichTextSelectionKeeper | null>(null);
  // Typing runs as Undo steps in every engine (Firefox otherwise joins them): src/lib/rich-text.ts.
  useEffect(() => keepTypingRuns(), []);
  // A Fonts or Colors panel that holds the keyboard (a control in it is given it back after each
  // change it makes) leaves the keyboard on the page when it closes, where New Message's key
  // equivalents never arrive. As a document does in macOS, the message takes it back, with its
  // selection: not when a send or a save closed the panels.
  const panelsWere = useRef({ fonts: false, colors: false });
  useLayoutEffect(() => {
    const were = panelsWere.current;
    panelsWere.current = { fonts: fontsShown, colors: colorsShown };
    if (!((were.fonts && !fontsShown) || (were.colors && !colorsShown))) return;
    if (frozenNow.current) return;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    keeper.current?.restore();
  }, [fontsShown, colorsShown]);
  // Whether a send or a draft save is under way (set each render, below).
  const frozenNow = useRef(false);
  const [plainText, setPlainText] = useState(defaultDraft.plain === true);
  const [confirmingPlain, setConfirmingPlain] = useState(false);
  // The draft's lines, rendered once: from then on the browser holds the text.
  const [lines] = useState(() =>
    defaultDraft.html !== undefined || defaultDraft.body === ""
      ? null
      : defaultDraft.body.split("\n").map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity, and the list is rendered once
          <div key={index}>{line === "" ? <br /> : line}</div>
        )),
  );

  useEffect(() => {
    if (autoFocus) toInput.current?.focus();
  }, [autoFocus]);

  // A draft with styles shows them: its HTML, rebuilt from what formatting writes alone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the draft is read once
  useLayoutEffect(() => {
    const node = editor.current;
    if (node && defaultDraft.html !== undefined) {
      node.replaceChildren(richTextFromHtml(defaultDraft.html, node.ownerDocument, COMPOSE_HTML));
    }
  }, []);

  const messageElement = useCallback(() => editor.current as HTMLElement | null, []);
  const checkNowAfterMenu = useCallback(
    () =>
      checkDocumentAfterMenu(messageElement, () => [
        ...latestLearned.current,
        ...ignoredWords.current,
      ]),
    [messageElement],
  );
  const find: TextFind = useTextFind(messageElement, String(edits));
  findShown.current = find.shown;
  const latestFind = useRef(find);
  latestFind.current = find;

  /** Read the format where the insertion point is in the message, when it is there. */
  const sync = useCallback(() => {
    const node = editor.current;
    const selection = node?.ownerDocument.getSelection();
    if (!node || !selection || selection.rangeCount === 0) return;
    if (!node.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    const read = readRichTextFormat(node);
    // Text without a family of its own is in the message font; an environment that computes
    // no font (a test's DOM) reports none.
    const next = { ...read, family: read.family || MESSAGE_FORMAT.family };
    setFormat((before) => (sameFormat(before, next) ? before : next));
  }, []);

  // The bar follows the insertion point, and the selection is kept for the controls.
  useEffect(() => {
    const node = editor.current;
    if (!node) return;
    const document = node.ownerDocument;
    const kept = keepRichTextSelection(node);
    keeper.current = kept;
    setPanelHost(document.body);
    document.addEventListener("selectionchange", sync);
    return () => {
      document.removeEventListener("selectionchange", sync);
      kept.dispose();
      keeper.current = null;
    };
  }, [sync]);

  /**
   * Give the message the keyboard and its selection back, unless it has both: a command from a
   * control, a menu or a panel acts where the person was typing.
   */
  const reselect = (node: HTMLElement) => {
    const document = node.ownerDocument;
    const selection = document.getSelection();
    const inside =
      document.activeElement === node &&
      selection !== null &&
      selection.rangeCount > 0 &&
      node.contains(selection.getRangeAt(0).commonAncestorContainer);
    if (!inside) keeper.current?.restore();
  };

  /** Apply what a control of the format bar or of a panel changed to the selection. */
  const applyFormat = (change: Partial<RichTextFormat>) => {
    const node = editor.current;
    if (!node || frozenNow.current || plainText) return;
    // Read before reselect(), which gives the message the keyboard back.
    const back = node.ownerDocument.activeElement;
    reselect(node);
    applyRichTextFormat(node, change);
    // The browser selects what the change made: keep that selection now, before a Fonts or
    // Colors panel control takes the keyboard back, so that the control's next change (the next
    // digit typed in a value field, the slider moved again) acts on the same text.
    keeper.current?.restore();
    sync();
    if (
      back instanceof HTMLElement &&
      back !== node &&
      back.closest(".mac-font-panel, .mac-color-panel")
    ) {
      back.focus({ preventScroll: true });
    }
  };

  /** A command of Format > Font or Format > Text, from its key equivalent. */
  const formatCommand = (command: RichTextCommand) => {
    if (frozenNow.current || plainText) return;
    if (command === "show-fonts") {
      setFontsShown((shown) => !shown);
      return;
    }
    if (command === "show-colors") {
      setColorsShown((shown) => !shown);
      return;
    }
    const node = editor.current;
    if (!node) return;
    reselect(node);
    runRichTextCommand(node, command);
    sync();
  };

  /** Format > Lists and Indentation. */
  const textCommand = (command: MailTextCommand) => {
    const node = editor.current;
    if (!node || frozenNow.current || plainText) return;
    reselect(node);
    runMailText(node, command);
    sync();
  };

  // Format > Copy Style and Paste Style: what the insertion point's text has, given to the selection.
  const heldStyle = useRef<RichTextFormat | null>(null);
  const [styleHeld, setStyleHeld] = useState(false);
  const copyStyleNow = () => {
    const node = editor.current;
    if (!node || plainText) return;
    reselect(node);
    heldStyle.current = readRichTextFormat(node);
    setStyleHeld(true);
  };
  const pasteStyleNow = () => {
    const node = editor.current;
    const style = heldStyle.current;
    if (!node || !style || frozenNow.current || plainText) return;
    reselect(node);
    applyRichTextFormat(node, style);
    sync();
  };

  // Make Plain Text: asks first where it would take styles away, since it cannot give them back.
  const makeTextPlain = () => {
    const node = editor.current;
    if (!node) return;
    makePlain(node, messageText(node));
    setPlainText(true);
    setFontsShown(false);
    setColorsShown(false);
    sync();
  };
  const askTogglePlain = () => {
    if (frozenNow.current) return;
    if (plainText) setPlainText(false);
    else if (editor.current && holdsStyles(editor.current)) setConfirmingPlain(true);
    else makeTextPlain();
  };

  // A message made plain takes only text, however it arrives: nothing styled gets in to come back later.
  const takePlainText = (event: { preventDefault(): void }, from: DataTransfer) => {
    const node = editor.current;
    if (!node) return;
    event.preventDefault();
    if (frozenNow.current) return;
    const text = from.getData("text/plain");
    if (!text) return;
    reselect(node);
    insertText(node, text);
    sync();
  };

  /** A stationery: its text before what is written, and its subject while there is none. */
  const applyStationery = ({ subject: kept, html, plain }: MailStationery) => {
    const node = editor.current;
    if (!node || frozenNow.current) return;
    if (!subject.trim()) setSubject(kept);
    const made = plain
      ? node.ownerDocument.createTextNode(html)
      : richTextFromHtml(html, node.ownerDocument, COMPOSE_HTML);
    node.prepend(made);
    sync();
  };
  // A file that came, however it came, takes its place at the insertion point unless files go at the
  // end; one given up gives its place up.
  const placedFiles = attaching?.placed;
  const filesKnown = useRef(new Map<string, string>());
  const placeInText = useRef((_name: string) => {});
  placeInText.current = (name) => {
    const node = editor.current;
    if (!node || filesAtEnd || plainText) return;
    reselect(node);
    const selection = node.ownerDocument.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const mark = node.ownerDocument.createElement("span");
    mark.setAttribute(MAIL_FILE_MARK, name);
    mark.setAttribute("contenteditable", "false");
    mark.textContent = name;
    if (range && node.contains(range.commonAncestorContainer)) {
      range.collapse(false);
      range.insertNode(mark);
      range.setStartAfter(mark);
      range.collapse(true);
    } else node.append(mark);
  };
  useEffect(() => {
    if (!placedFiles) return;
    const known = filesKnown.current;
    for (const [key, name] of known) {
      if (placedFiles.some((each) => each.key === key)) continue;
      known.delete(key);
      for (const mark of editor.current?.querySelectorAll(`[${MAIL_FILE_MARK}]`) ?? []) {
        if (mark.getAttribute(MAIL_FILE_MARK) === name) {
          mark.remove();
          break;
        }
      }
    }
    for (const { key, name, held } of placedFiles) {
      if (known.has(key)) continue;
      known.set(key, name);
      if (!held) placeInText.current(name);
    }
  }, [placedFiles]);

  /** The Emoji menu: the character goes where the insertion point is. */
  const insertEmoji = (character: string) => {
    const node = editor.current;
    if (!node || frozenNow.current) return;
    reselect(node);
    insertText(node, character);
    sync();
  };

  const draftNow = (): MailDraft => {
    const node = editor.current;
    return {
      to,
      cc,
      bcc: bcc.length > 0 ? bcc : undefined,
      replyTo: replyTo.trim() || undefined,
      priority,
      subject,
      body: node ? messageText(node) : defaultDraft.body,
      // The server drops a blank html and a draft without html reopens plain, so a rich message
      // with no text yet says so with an empty line.
      html: plainText
        ? undefined
        : node
          ? node.innerHTML.trim() === ""
            ? "<br>"
            : node.innerHTML
          : defaultDraft.html,
      plain: plainText || undefined,
    };
  };

  // What has changed and is not saved yet, as it stood at the last change: when the window is
  // taken away the editor is already gone.
  const unsaved = useRef<MailDraft | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autosave = useRef(onAutosave);
  autosave.current = onAutosave;
  // What has changed stays held until its save is answered: a save that fails is tried again, and
  // the page's or the window's going away saves it whatever happened before.
  const saveNow = (when: MailAutosaveMoment) => {
    clearTimeout(saveTimer.current);
    const draft = unsaved.current;
    if (!draft) return;
    // A send or a close under way decides what becomes of it: looked at again afterwards.
    if (frozenNow.current && when === "typing") {
      saveTimer.current = setTimeout(() => saveNow("typing"), AUTOSAVE_MS);
      return;
    }
    void autosave.current?.(draft, when).then((kept) => {
      if (kept && unsaved.current === draft) unsaved.current = null;
      else if (!kept && unsaved.current === draft && !gone.current) {
        saveTimer.current = setTimeout(() => saveNow("typing"), AUTOSAVE_RETRY_MS);
      }
    });
  };
  const gone = useRef(false);
  const changed = () => {
    if (!autosave.current) return;
    unsaved.current = draftNow();
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow("typing"), AUTOSAVE_MS);
  };
  if (saveRef) saveRef.current = () => saveNow("typing");
  // The fields' changes; the message's text says so itself (`onInput` around it).
  const fieldsSeen = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when a field changes, not when `changed` does
  useEffect(() => {
    if (fieldsSeen.current) changed();
    fieldsSeen.current = true;
  }, [to, cc, bcc, replyTo, priority, subject, attaching?.revision]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, for the window's life
  useEffect(() => {
    gone.current = false;
    const leave = () => saveNow("page");
    window.addEventListener("pagehide", leave);
    return () => {
      gone.current = true;
      window.removeEventListener("pagehide", leave);
      saveNow("window");
    };
  }, []);

  const send = () => {
    onSend?.(draftNow());
  };

  // The signature the message holds, and whether it holds what it replies to. A new message is told
  // which it was made with; a draft opened again says by its marks. Other text is the person's.
  const [signatureId, setSignatureId] = useState(NO_SIGNATURE);
  const [quoted, setQuoted] = useState(false);
  // The words the message was given, whatever Preferences says of that signature since.
  const inserted = useRef<MailSignature | null>(null);
  // The marked lines of a draft whose signature Preferences has changed since: a choice of its own.
  const [written, setWritten] = useState<MailSignature | null>(null);
  const started = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a list that changes finds a signature only in a message that had none
  useLayoutEffect(() => {
    const node = editor.current;
    if (!node) return;
    setQuoted(typeof original === "string" && holdsLines(node, original));
    if (!started.current && startingSignature) {
      started.current = true;
      markSignature(node, startingSignature, signatureAbove, original);
      inserted.current = startingSignature;
      setSignatureId(startingSignature.id);
    } else if (signatureId === NO_SIGNATURE) {
      const held = signatureIn(node, signatures);
      inserted.current = held;
      if (held?.id === KEPT_SIGNATURE) setWritten(held);
      setSignatureId(held?.id ?? NO_SIGNATURE);
    } else if (
      inserted.current &&
      inserted.current.id !== KEPT_SIGNATURE &&
      !signatures.some(
        ({ id, text }) => id === inserted.current?.id && text === inserted.current?.text,
      )
    ) {
      // Preferences has changed the signature or let it go, and the message still holds its words.
      const kept = { ...inserted.current, id: KEPT_SIGNATURE };
      inserted.current = kept;
      setWritten(kept);
      setSignatureId(KEPT_SIGNATURE);
    }
  }, [signatures, original]);
  // The person typed: what the text now holds is read again before it is saved.
  const typed = () => {
    if (findShown.current) setEdits((count) => count + 1);
    const node = editor.current;
    if (node) {
      setQuoted(typeof original === "string" && holdsLines(node, original));
      if (!settleMarks(node, inserted.current) && inserted.current) {
        inserted.current = null;
        setSignatureId(NO_SIGNATURE);
      }
    }
    changed();
  };
  const chooseSignature = (id: string) => {
    const node = editor.current;
    if (!node || frozenNow.current || id === signatureId) return;
    const chosen =
      (id === KEPT_SIGNATURE ? written : signatures.find((each) => each.id === id)) ?? null;
    swapSignature(node, inserted.current, chosen, signatureAbove);
    inserted.current = chosen;
    setSignatureId(id);
    changed();
  };
  const includeOriginal = () => {
    const node = editor.current;
    if (!node || typeof original !== "string" || keepsOriginal || frozenNow.current) return;
    toggleOriginal(node, original, signatureAbove);
    setQuoted(holdsLines(node, original));
    changed();
  };

  // A close waits for the owner to keep the draft. Meanwhile the window cannot change (what is
  // saved is what it showed) nor be closed again; while a send is under way it cannot be closed
  // at all, so a draft is never saved beside a message being sent.
  const closing = useRef(false);
  const [saving, setSaving] = useState(false);
  // The window's close: `onClose`, or the controls' own when it is not given.
  const closeWindow = onClose ?? controlsProps?.onClose;
  const close: WindowControlsProps["onClose"] = onDraftClose
    ? (...args: Parameters<NonNullable<WindowControlsProps["onClose"]>>) => {
        // A held message stays until it is sent or its owner lets it go: kept as a draft and
        // sent again later, it would go under another key.
        if (closing.current || sending || held) return;
        const kept = onDraftClose(draftNow());
        if (kept === false) return;
        if (kept instanceof Promise) {
          closing.current = true;
          setSaving(true);
          void kept.then(
            (ok) => {
              closing.current = false;
              setSaving(false);
              if (ok) closeWindow?.(...args);
            },
            () => {
              closing.current = false;
              setSaving(false);
            },
          );
          return;
        }
        closeWindow?.(...args);
      }
    : (...args: Parameters<NonNullable<WindowControlsProps["onClose"]>>) => {
        // A message being sent, or held, is not closed under its owner.
        if (!sending && !held) closeWindow?.(...args);
      };
  // Called with no event: neither close reads the one the button gives.
  if (closeRef) closeRef.current = () => (close as (() => void) | undefined)?.();
  // Sending or saving: nothing changes and Send waits. Held: nothing changes, Send sends again.
  const busy = sending || saving;
  const frozen = busy || held;
  if (attachRef) attachRef.current = attaching && !frozen ? attaching.choose : null;
  const setAttachingFrozen = attaching?.setFrozen;
  useLayoutEffect(() => {
    setAttachingFrozen?.(frozen);
  }, [setAttachingFrozen, frozen]);
  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) => item.type !== ADDRESS_DRAG_TYPE,
    onDrop: (items) => attaching?.drop(items),
    enabled: attaching !== undefined && !frozen,
  });
  // Dragging a token: the field it is let go over takes it, and the one it left gives it up. A person
  // dragged here from another app has no field to leave.
  const takeAddresses = useRef<
    (field: AddressField, items: readonly DesktopDragItem[], copy: boolean) => void
  >(() => {});
  takeAddresses.current = (field, items, copy) => {
    const lists = { to, cc, bcc };
    const setters = { to: setTo, cc: setCc, bcc: setBcc };
    for (const { id: from, name } of items) {
      const left = /^address:(to|cc|bcc):/.exec(from)?.[1] as AddressField | undefined;
      if (left === field) continue;
      if (left && !copy) setters[left](lists[left].filter((each) => each !== name));
      if (!lists[field].includes(name)) setters[field]([...lists[field], name]);
    }
  };
  const addressTargets = useMemo(() => {
    const target = (field: AddressField) => (element: HTMLDivElement | null) => {
      if (!element) return undefined;
      return registerDropTarget({
        element,
        landing: (_hit, drag) => {
          const taken = drag.items.filter((item) => item.type === ADDRESS_DRAG_TYPE);
          if (taken.length === 0 || frozenNow.current) return undefined;
          return {
            element,
            copies: drag.copy,
            drop: () => takeAddresses.current(field, taken, drag.copy),
          };
        },
      });
    };
    return { to: target("to"), cc: target("cc"), bcc: target("bcc") };
  }, []);
  const dragToken =
    (field: AddressField, list: readonly string[]) => (event: ReactPointerEvent<HTMLElement>) => {
      const token = (event.target as Element).closest<HTMLElement>(".mac-token-field-token");
      if (
        !token ||
        event.button !== 0 ||
        (event.target as Element).closest(".mac-token-field-token-menu")
      ) {
        return;
      }
      const written = list[Number(token.dataset.index)];
      if (written === undefined) return;
      beginDesktopDrag(event.nativeEvent, {
        from: "mail",
        items: () => [
          {
            id: `address:${field}:${written}`,
            name: written,
            kind: "file",
            type: ADDRESS_DRAG_TYPE,
            bytes: async () => new Blob([written], { type: "text/plain" }),
          },
        ],
      });
    };
  if (draftRef) draftRef.current = draftNow;
  useEffect(() => {
    keyRef?.(state === "key");
  }, [keyRef, state]);
  if (sendRef) {
    sendRef.current = () => {
      if (recipients > 0 && !busy) send();
    };
  }
  // For the format commands, which run from the panels and keys outside the frozen body.
  frozenNow.current = frozen;
  // A send or a save closes the panels and the recipient menu: what is sent or saved is what the
  // window showed.
  useEffect(() => {
    if (!frozen) return;
    setFontsShown(false);
    setColorsShown(false);
    setAsked(null);
  }, [frozen]);

  const askedList = asked?.field === "cc" ? cc : asked?.field === "bcc" ? bcc : to;
  const askedName = asked ? askedList[asked.index] : undefined;
  const withoutAsked = () => askedList.filter((_, index) => index !== asked?.index);
  const removeAsked = () => {
    if (frozenNow.current) return;
    (asked?.field === "cc" ? setCc : asked?.field === "bcc" ? setBcc : setTo)(withoutAsked());
  };
  /** The field a token belongs to, by the id the window gave it. */
  const fieldInput = (field: "to" | "cc" | "bcc") =>
    document.getElementById(`${id}${field}`) as HTMLInputElement | null;
  const editAsked = () => {
    if (!asked || askedName === undefined || frozenNow.current) return;
    const input = fieldInput(asked.field);
    removeAsked();
    let done = false;
    whenMenusClosed(document, () => {
      input?.focus();
      if (input && !done) fillInput(input, askedName);
      done = true;
    });
  };
  // Leaving the field for the menu makes what was typed a token: an unfinished one is what is completed.
  const typedAddress = () => {
    const field = addressField.current;
    if (!field) return "";
    const typed = fieldInput(field)?.value ?? "";
    if (typed !== "") return typed;
    const last = (field === "to" ? to : field === "cc" ? cc : bcc).at(-1) ?? "";
    return last.includes("@") ? "" : last;
  };
  const completeTyped = () => {
    const field = addressField.current;
    const input = field ? fieldInput(field) : null;
    const typed = typedAddress();
    const completed = completeAddress(typed, contacts);
    if (!field || !input || !completed || frozenNow.current) return;
    const [held, set] =
      field === "to"
        ? ([to, setTo] as const)
        : field === "cc"
          ? ([cc, setCc] as const)
          : ([bcc, setBcc] as const);
    const list = input.value === "" ? held.slice(0, -1) : held;
    if (!list.includes(completed)) set([...list, completed]);
    fillInput(input, "");
    whenMenusClosed(document, () => input.focus());
  };
  /** Do `work` once a menu has closed and the message has its selection back. */
  const inMessage = (work: (node: HTMLElement) => void) => {
    let done = false;
    whenMenusClosed(document, () => {
      const node = editor.current;
      if (!node || frozenNow.current) return;
      keeper.current?.restore();
      if (done) return;
      done = true;
      work(node);
      typed();
    });
  };
  const pasteQuoted = () => {
    void navigator.clipboard.readText().then(
      (text) => {
        if (text === "") return;
        inMessage((node) => {
          if (plainText) insertText(node, quotationText(text));
          else node.ownerDocument.execCommand("insertHTML", false, quotationHtml(text));
        });
      },
      () => {},
    );
  };
  const appendMessages = () => {
    void appendSelected?.().then((text) => {
      if (text === null) return;
      inMessage((node) => {
        const selection = node.ownerDocument.getSelection();
        selection?.selectAllChildren(node);
        selection?.collapseToEnd();
        insertText(node, `\n\n${text}`);
      });
    });
  };
  const editRows = useRef<() => ReactNode>(() => null);
  editRows.current = () => (
    <>
      <MenuItem
        keyEquivalent="shift+command+v"
        disabled={frozen || typeof navigator.clipboard?.readText !== "function"}
        onClick={pasteQuoted}
      >
        Paste as Quotation
      </MenuItem>
      <MenuItem
        disabled={frozen || !appendSelected}
        title={appendSelected ? undefined : "Select messages in the viewer to add their text here."}
        onClick={appendMessages}
      >
        Append Selected Messages
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Attachments</SubmenuTrigger>
        <SubmenuPopup>
          <MenuCheckboxItem
            checked={originalsAdded}
            disabled={frozen || originalsAdded || !attaching || !originalFiles?.length}
            title={
              originalsAdded
                ? "They are under the text: remove one there."
                : originalFiles?.length
                  ? undefined
                  : "The message you are replying to has no attachments."
            }
            onCheckedChange={() => {
              if (!originalFiles?.length) return;
              attaching?.drop(originalFiles);
              setOriginalsAdded(true);
            }}
          >
            Include Original Attachments in Reply
          </MenuCheckboxItem>
          <MenuSeparator />
          <MenuCheckboxItem
            checked={alwaysFriendly}
            title={WINDOWS_FRIENDLY_NOTE}
            onCheckedChange={setAlwaysFriendly}
          >
            Always Send Windows-Friendly Attachments
          </MenuCheckboxItem>
          <MenuCheckboxItem
            checked={friendly ?? alwaysFriendly}
            title={WINDOWS_FRIENDLY_NOTE}
            onCheckedChange={setFriendly}
          >
            Send Windows-Friendly Attachments
          </MenuCheckboxItem>
          <MenuCheckboxItem
            checked={filesAtEnd || plainText}
            disabled={plainText}
            title={plainText ? PLAIN_FILES_LAST : undefined}
            onCheckedChange={setFilesAtEnd}
          >
            Insert Attachments at End of Message
          </MenuCheckboxItem>
        </SubmenuPopup>
      </Submenu>
      <MenuItem
        disabled={frozen || !completeAddress(typedAddress(), contacts)}
        title={
          completeAddress(typedAddress(), contacts)
            ? undefined
            : "Start typing an address in To, Cc or Bcc."
        }
        onClick={completeTyped}
      >
        Complete Address
      </MenuItem>
      <MenuSeparator />
      <SpellingItems
        disabled={frozen}
        whileTyping={spellCheck !== false}
        onToggleWhileTyping={() => onSpellCheckChange?.(spellCheck === false)}
        onShow={() => setSpellingShown(true)}
        onCheckNow={checkNowAfterMenu}
      />
      <SubstitutionItems
        disabled={frozen}
        settings={substitutions}
        onChange={setSubstitutions}
        onShow={() => setSubstitutionsShown(true)}
      />
      <MenuSeparator />
    </>
  );
  const askedAccount = askedName === undefined ? null : accountOf(askedName);
  const moveAsked = () => {
    if (!asked || askedName === undefined || frozenNow.current) return;
    removeAsked();
    if (asked.field === "to") setCc(cc.includes(askedName) ? cc : [...cc, askedName]);
    else setTo(to.includes(askedName) ? to : [...to, askedName]);
    if (asked.field === "to") setShowCc(true);
  };
  const toggleField = (field: keyof ComposeFields) =>
    setFields({ ...fields, [field]: !fields[field] });
  // A field that says something cannot be hidden, which would hide who is written to.
  const fieldItems = (keys: boolean) => (
    <>
      <MenuCheckboxItem
        checked={showBcc}
        disabled={bcc.length > 0}
        keyEquivalent={keys ? "option+command+b" : undefined}
        onCheckedChange={() => toggleField("bcc")}
      >
        Bcc Address Field
      </MenuCheckboxItem>
      <MenuCheckboxItem
        checked={showReplyTo}
        disabled={replyTo !== ""}
        keyEquivalent={keys ? "option+command+r" : undefined}
        onCheckedChange={() => toggleField("replyTo")}
      >
        Reply-To Address Field
      </MenuCheckboxItem>
      <MenuCheckboxItem
        checked={showPriority}
        disabled={priority !== undefined}
        onCheckedChange={() => toggleField("priority")}
      >
        Priority Field
      </MenuCheckboxItem>
    </>
  );

  // The desktop's menu bar shows AppKit's Format menu while this window is the one last used:
  // its Font and Text commands run on the message where the person was typing, Bold, Italic,
  // Underline and the alignment checked as the insertion point's text has them, and every
  // command dimmed while the window cannot change.
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const runFormat = useRef(formatCommand);
  runFormat.current = formatCommand;
  const runText = useRef(textCommand);
  runText.current = textCommand;
  const togglePlain = useRef(askTogglePlain);
  togglePlain.current = askTogglePlain;
  const copyStyle = useRef(copyStyleNow);
  copyStyle.current = copyStyleNow;
  const pasteStyle = useRef(pasteStyleNow);
  pasteStyle.current = pasteStyleNow;
  const desktopFormatMenu = useMemo(
    () => (
      <MailFormatMenuItems
        format={format}
        disabled={frozen}
        plain={plainText}
        styleHeld={styleHeld}
        onCommand={(command) => runFormat.current(command)}
        onText={(command) => runText.current(command)}
        onTogglePlain={() => togglePlain.current()}
        onCopyStyle={() => copyStyle.current()}
        onPasteStyle={() => pasteStyle.current()}
      />
    ),
    [format, frozen, plainText, styleHeld],
  );
  useDesktopAppMenu("mail", "Format", desktopFormatMenu, titleBar);
  // ... and the editors' Edit menu (`EditorEditItems`, as Notes, TextEdit and Stickies have it):
  // Undo, Redo, Cut, Copy, Paste and Select All on the message, which takes the keyboard and its
  // selection back. Nothing in it changes the message while it is being sent or held.
  const latestEdit = useRef<() => EditMenuTarget | null>(() => null);
  latestEdit.current = () => {
    const node = editor.current;
    return node
      ? {
          element: node,
          restore: () => {
            if (keeper.current) keeper.current.restore();
            else node.focus({ preventScroll: true });
          },
          editable: !frozen,
          rich: true,
          history: (way) => stepQuoteLevel(node, way),
        }
      : null;
  };
  const desktopEditMenu = useMemo(
    () => (
      <>
        <EditorEditItems target={() => latestEdit.current()} />
        <EditorMoreItems
          target={() => latestEdit.current()}
          find={() => latestFind.current}
          beforeFind={<Latest rows={editRows} />}
        />
      </>
    ),
    [],
  );
  const latestFieldItems = useRef(fieldItems);
  latestFieldItems.current = fieldItems;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the items are read through the ref, and these are what they show
  const desktopViewMenu = useMemo(
    () => (
      <>
        {latestFieldItems.current(true)}
        <MailTabViewItems />
      </>
    ),
    [showBcc, showReplyTo, showPriority, bcc.length, replyTo, priority, fields],
  );
  useDesktopAppMenu("mail", "Edit", desktopEditMenu, titleBar);
  // ... and View, with the header fields this window can show.
  useDesktopAppMenu("mail", "View", desktopViewMenu, titleBar);

  useWindowKeys(titleBar, state === "key", [
    { equivalent: "command+f", run: () => find.open() },
    { equivalent: "command+g", run: () => find.move(false) },
    { equivalent: "shift+command+g", run: () => find.move(true) },
    { equivalent: "command+e", run: () => find.fromSelection() },
    { equivalent: "command+j", run: () => find.jump() },
    { equivalent: "shift+command+v", run: pasteQuoted },
    { equivalent: "command+;", run: checkNowAfterMenu },
    { equivalent: "shift+command+;", run: () => setSpellingShown(true) },
  ]);

  const panelState = state === "inactive" ? "inactive" : "main";

  return (
    <Window
      aria-label={subject.trim() || "New Message"}
      state={state}
      width={width}
      height={height}
      className={className ? `mac-mail-compose ${className}` : "mac-mail-compose"}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (matchesMenuKeyEquivalent(event.nativeEvent, "option+command+b")) {
          event.preventDefault();
          if (bcc.length === 0) toggleField("bcc");
          return;
        }
        if (matchesMenuKeyEquivalent(event.nativeEvent, "option+command+r")) {
          event.preventDefault();
          if (replyTo === "") toggleField("replyTo");
          return;
        }
        const way = matchesMenuKeyEquivalent(event.nativeEvent, "command+z")
          ? "undo"
          : matchesMenuKeyEquivalent(event.nativeEvent, "shift+command+z")
            ? "redo"
            : null;
        if (way && editor.current?.contains(event.target as Node)) {
          if (!frozen && stepQuoteLevel(editor.current, way)) {
            event.preventDefault();
            sync();
          }
          return;
        }
        for (const [equivalent, run] of FORMAT_KEYS) {
          if (matchesMenuKeyEquivalent(event.nativeEvent, equivalent)) {
            // In a header field only Make Plain Text means anything: the rest act on the message's lines.
            if (equivalent !== "shift+command+t" && isTextField(event.target)) return;
            event.preventDefault();
            run({ textCommand, askTogglePlain, copyStyleNow, pasteStyleNow });
            return;
          }
        }
        const command = richTextKeyCommand(event.nativeEvent);
        if (!command) return;
        // In a header field only the panels open: its plain text takes no styles.
        const panel = command === "show-fonts" || command === "show-colors";
        if (!panel && isTextField(event.target)) return;
        event.preventDefault();
        formatCommand(command);
      }}
      {...props}
    >
      <TitleBar
        ref={setTitleBar}
        variant="title-hidden"
        controls={<WindowControls {...controlsProps} onClose={close} />}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar aria-label="Message toolbar">
          <ToolbarButton
            aria-label="Send"
            disabled={recipients === 0 || busy}
            style={{ width: 39 }}
            onClick={send}
          >
            <MailGlyph name="send" />
          </ToolbarButton>
          <ToolbarPullDown image={<MailGlyph name="fields" size={14} />} aria-label="Header Fields">
            {/* The field cannot be hidden while it holds a recipient, who would then be
                written to without being seen. */}
            <MenuCheckboxItem
              checked={showCc}
              disabled={showCc && cc.length > 0}
              onCheckedChange={setShowCc}
            >
              Cc Address Field
            </MenuCheckboxItem>
            {fieldItems(false)}
          </ToolbarPullDown>
          <ToolbarSpace />
          <ToolbarButton
            aria-label="Include Original Message"
            disabled={typeof original !== "string" || keepsOriginal || frozen}
            title={
              typeof original === "string" && !keepsOriginal
                ? undefined
                : INCLUDE_ORIGINAL_UNAVAILABLE
            }
            pressed={typeof original === "string" && !keepsOriginal ? quoted : undefined}
            onPressedChange={
              typeof original === "string" && !keepsOriginal ? includeOriginal : undefined
            }
            style={{ width: 39 }}
          >
            <MailGlyph name="reply" />
          </ToolbarButton>
          <ToolbarButton
            aria-label="Attach"
            disabled={!attaching?.available || frozen}
            title={attaching ? undefined : ATTACHMENTS_UNAVAILABLE}
            style={{ width: 39 }}
            onClick={attaching?.choose}
          >
            <MailGlyph name="attach" />
          </ToolbarButton>
          <ToolbarButton
            aria-label="Markup"
            disabled={!attaching?.markup || frozen}
            title={
              attaching?.markup
                ? undefined
                : attaching
                  ? MARKUP_NEEDS_PICTURE
                  : ATTACHMENTS_UNAVAILABLE
            }
            style={{ width: 39 }}
            onClick={() => attaching?.markup?.()}
          >
            <MailGlyph name="markup" />
          </ToolbarButton>
          <ToolbarButton
            aria-label="Show Format Bar"
            pressed={formatBar}
            disabled={frozen}
            onPressedChange={setFormatBar}
            style={{ width: 39 }}
          >
            <MailGlyph name="format" />
          </ToolbarButton>
          <ToolbarPullDown
            image={<MailGlyph name="emoji" size={14} />}
            aria-label="Emoji"
            disabled={frozen}
          >
            {EMOJI.map(([character, name]) => (
              <MenuItem key={name} onClick={() => insertEmoji(character)}>
                {character} {name}
              </MenuItem>
            ))}
            {onShowCharacters ? (
              <>
                <MenuSeparator />
                <MenuItem onClick={onShowCharacters}>Show Emoji &amp; Symbols</MenuItem>
              </>
            ) : null}
          </ToolbarPullDown>
          {attaching ? (
            <MailPhotoBrowser
              disabled={!attaching.available || frozen}
              onChoose={(file) => attaching.drop([file])}
            />
          ) : (
            <>
              {/* A pull-down's `title` is its visible label, so the reason is the wrapper's tooltip
                  and the button's description. */}
              <span title={ATTACHMENTS_UNAVAILABLE} style={{ display: "contents" }}>
                <ToolbarPullDown
                  image={<MailGlyph name="photo" size={14} />}
                  aria-label="Photo Browser"
                  aria-describedby={`${id}attachments-unavailable`}
                  disabled
                />
              </span>
              <span id={`${id}attachments-unavailable`} hidden>
                {ATTACHMENTS_UNAVAILABLE}
              </span>
            </>
          )}
        </Toolbar>
      </TitleBar>
      {tabBar}
      {/* While a send or a save is under way the fields and the text cannot change. */}
      <WindowBody
        ref={dropRef}
        background="content"
        className="mac-mail-compose-body"
        inert={frozen || undefined}
        aria-busy={busy || undefined}
        onFocusCapture={(event) => {
          const named = event.target.id;
          if (named === `${id}to`) addressField.current = "to";
          else if (named === `${id}cc`) addressField.current = "cc";
          else if (named === `${id}bcc`) addressField.current = "bcc";
        }}
        onDragOverCapture={(event) => {
          if (!attaching || frozen || !event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDropCapture={(event) => {
          if (!attaching || frozen || event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          event.stopPropagation();
          attaching.takeFiles([...event.dataTransfer.files]);
        }}
      >
        <div
          ref={addressTargets.to}
          className="mac-mail-compose-field"
          onPointerDownCapture={dragToken("to", to)}
        >
          {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
          <Label render={<label htmlFor={`${id}to`} />} color="secondary">
            To:
          </Label>
          <TokenFieldCompletions
            id={`${id}to`}
            inputRef={toInput}
            bordered={false}
            tokenMenu
            tokensLabel="To recipients"
            completions={contacts}
            value={to}
            onValueChange={setTo}
            onTokenMenu={(_, index, element) => setAsked({ field: "to", index, element })}
            className="mac-mail-compose-input"
          />
        </div>
        {showCc ? (
          <div
            ref={addressTargets.cc}
            className="mac-mail-compose-field"
            onPointerDownCapture={dragToken("cc", cc)}
          >
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
            <Label render={<label htmlFor={`${id}cc`} />} color="secondary">
              Cc:
            </Label>
            <TokenFieldCompletions
              id={`${id}cc`}
              bordered={false}
              tokenMenu
              tokensLabel="Cc recipients"
              completions={contacts}
              value={cc}
              onValueChange={setCc}
              onTokenMenu={(_, index, element) => setAsked({ field: "cc", index, element })}
              className="mac-mail-compose-input"
            />
          </div>
        ) : null}
        {showBcc ? (
          <div
            ref={addressTargets.bcc}
            className="mac-mail-compose-field"
            onPointerDownCapture={dragToken("bcc", bcc)}
          >
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
            <Label render={<label htmlFor={`${id}bcc`} />} color="secondary">
              Bcc:
            </Label>
            <TokenFieldCompletions
              id={`${id}bcc`}
              bordered={false}
              tokenMenu
              tokensLabel="Bcc recipients"
              completions={contacts}
              value={bcc}
              onValueChange={setBcc}
              onTokenMenu={(_, index, element) => setAsked({ field: "bcc", index, element })}
              className="mac-mail-compose-input"
            />
          </div>
        ) : null}
        {showReplyTo ? (
          <div className="mac-mail-compose-field">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
            <Label render={<label htmlFor={`${id}replyto`} />} color="secondary">
              Reply-To:
            </Label>
            <TextField
              id={`${id}replyto`}
              bezel="none"
              value={replyTo}
              onChange={(event) => setReplyTo(event.currentTarget.value)}
              className="mac-mail-compose-input"
            />
          </div>
        ) : null}
        <div className="mac-mail-compose-field">
          {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
          <Label render={<label htmlFor={`${id}subject`} />} color="secondary">
            Subject:
          </Label>
          <TextField
            id={`${id}subject`}
            bezel="none"
            value={subject}
            onChange={(event) => setSubject(event.currentTarget.value)}
            className="mac-mail-compose-input"
          />
        </div>
        {showPriority ? (
          <div className="mac-mail-compose-field">
            <Label color="secondary">Priority:</Label>
            <PopUpButton
              aria-label="Priority"
              bordered={false}
              value={priority ?? "normal"}
              onValueChange={(value) =>
                setPriority(value === "low" || value === "high" ? value : undefined)
              }
            >
              <PopUpButtonItem value="low">Low</PopUpButtonItem>
              <PopUpButtonItem value="normal">Normal</PopUpButtonItem>
              <PopUpButtonItem value="high">High</PopUpButtonItem>
            </PopUpButton>
          </div>
        ) : null}
        {signatures.length > 0 || written ? (
          <div className="mac-mail-compose-field">
            <Label color="secondary">Signature:</Label>
            <PopUpButton
              aria-label="Signature"
              bordered={false}
              disabled={frozen}
              value={signatureId}
              onValueChange={(value) => {
                if (value !== null) chooseSignature(String(value));
              }}
            >
              <PopUpButtonItem value={NO_SIGNATURE}>None</PopUpButtonItem>
              {written ? (
                <PopUpButtonItem value={KEPT_SIGNATURE}>As Written</PopUpButtonItem>
              ) : null}
              {signatures.map((signature) => (
                <PopUpButtonItem key={signature.id} value={signature.id}>
                  {signature.name || "Untitled"}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </div>
        ) : null}
        {stationery.length > 0 ? (
          <div className="mac-mail-compose-field">
            <Label color="secondary">Stationery:</Label>
            <PopUpButton
              aria-label="Stationery"
              bordered={false}
              disabled={frozen}
              value=""
              placeholder="Choose…"
              onValueChange={(value) => {
                const chosen = stationery.find((each) => each.name === value);
                if (chosen) applyStationery(chosen);
              }}
            >
              {stationery.map((each) => (
                <PopUpButtonItem key={each.name} value={each.name}>
                  {each.name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </div>
        ) : null}
        {formatBar && !plainText ? (
          <MailFormatBar format={format} onFormatChange={applyFormat} onText={textCommand} />
        ) : null}
        <FindBar find={find} />
        {notice ? (
          <div role="alert" className="mac-mail-compose-notice">
            {notice}
          </div>
        ) : null}
        <div
          className="mac-mail-compose-text"
          onInput={(event) => {
            const native = event.nativeEvent as InputEvent;
            if (native.inputType === "insertText" && !native.isComposing && editor.current) {
              substituteTyped(editor.current, native.data, substitutions, !plainText);
            }
            typed();
          }}
          onPasteCapture={(event) => {
            const copied = copiedDriveItems();
            if (copied.length > 0 && attaching) {
              event.preventDefault();
              attaching.drop([...copied]);
              return;
            }
            const pictures = clipboardPictures(event.clipboardData);
            if (pictures.length > 0 && attaching && !frozen) {
              event.preventDefault();
              attaching.drop(pictures);
              return;
            }
            if (plainText) takePlainText(event, event.clipboardData);
          }}
          onDropCapture={(event) => {
            if (plainText && !event.dataTransfer.types.includes("Files")) {
              placeCaretAt(event.currentTarget.ownerDocument, event.clientX, event.clientY);
              takePlainText(event, event.dataTransfer);
            }
          }}
        >
          <RichTextView
            ref={editor}
            aria-label="Message"
            spellCheck={spellCheck}
            data-text-replacement={substitutions.replacement ? "on" : "off"}
            className="mac-mail-compose-message"
          >
            {lines}
          </RichTextView>
        </div>
        {attaching?.strip ? (
          <div className="mac-mail-compose-attachments">{attaching.strip}</div>
        ) : null}
      </WindowBody>
      {attaching?.panel}
      <Alert open={confirmingPlain} onOpenChange={(open) => !open && setConfirmingPlain(false)}>
        <AlertPopup>
          <AlertMessage>Convert this message to plain text?</AlertMessage>
          <AlertInformativeText>
            Converting this message removes all text styles, lists and quote levels. You can’t undo
            this action.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose render={<DefaultButton />} onClick={makeTextPlain}>
              OK
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Menu open={asked !== null} onOpenChange={(open) => !open && setAsked(null)}>
        <MenuPopup size="regular" anchor={asked?.element} sideOffset={2}>
          <MenuItem
            onClick={() => {
              if (askedName !== undefined) void navigator.clipboard?.writeText(askedName);
            }}
          >
            Copy Address
          </MenuItem>
          <MenuItem onClick={editAsked}>Edit Address</MenuItem>
          <MenuItem
            disabled={!askedAccount || !onAddAddress}
            title={
              askedAccount
                ? undefined
                : "Only someone with an account on this desktop has a card to add."
            }
            onClick={() => askedName !== undefined && onAddAddress?.(askedName)}
          >
            Add to Contacts
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={moveAsked}>
            {asked?.field === "to" ? "Move to Cc Field" : "Move to To Field"}
          </MenuItem>
          <MenuItem onClick={removeAsked}>Remove {askedName}</MenuItem>
        </MenuPopup>
      </Menu>
      {/* The panels float over the page, outside the window's element; rendered from inside
          the window, their presses and keys still reach it (Command-T closes the Fonts panel
          from the panel too). */}
      {panelHost && (fontsShown || colorsShown || spellingShown || substitutionsShown)
        ? createPortal(
            <div className="mac-mail-compose-panels">
              {spellingShown ? (
                <SpellingPanel
                  className="mac-mail-compose-panel"
                  state={panelState}
                  element={messageElement}
                  editable={!frozen}
                  ignored={ignoredWords.current}
                  onClose={() => setSpellingShown(false)}
                />
              ) : null}
              {substitutionsShown ? (
                <SubstitutionsPanel
                  className="mac-mail-compose-panel"
                  state={panelState}
                  element={messageElement}
                  editable={!frozen}
                  settings={substitutions}
                  onChange={setSubstitutions}
                  onClose={() => setSubstitutionsShown(false)}
                />
              ) : null}
              {fontsShown ? (
                <DesktopFontPanel
                  className="mac-mail-compose-panel"
                  families={FONT_FAMILIES}
                  state={panelState}
                  value={format}
                  onFontChange={applyFormat}
                  onClose={() => setFontsShown(false)}
                />
              ) : null}
              {colorsShown ? (
                <ColorPanel
                  className="mac-mail-compose-panel"
                  state={panelState}
                  value={format.color}
                  onValueChange={(color) => applyFormat({ color })}
                  onClose={() => setColorsShown(false)}
                />
              ) : null}
            </div>,
            panelHost,
          )
        : null}
    </Window>
  );
}

/** Format > Font: AppKit's commands, in its order; `null` is a separator. */
/** The keys of Format's commands that the rich-text module does not know. */
const FORMAT_KEYS: readonly (readonly [
  string,
  (commands: {
    textCommand: (command: MailTextCommand) => void;
    askTogglePlain: () => void;
    copyStyleNow: () => void;
    pasteStyleNow: () => void;
  }) => void,
])[] = [
  ["command+]", (c) => c.textCommand("indent")],
  ["command+[", (c) => c.textCommand("outdent")],
  ["command+'", (c) => c.textCommand("quote-more")],
  ["option+command+'", (c) => c.textCommand("quote-less")],
  ["option+command+c", (c) => c.copyStyleNow()],
  ["option+command+v", (c) => c.pasteStyleNow()],
  ["shift+command+t", (c) => c.askTogglePlain()],
];

const FONT_MENU: readonly (readonly [RichTextCommand, string] | null)[] = [
  ["show-fonts", "Show Fonts"],
  ["bold", "Bold"],
  ["italic", "Italic"],
  ["underline", "Underline"],
  ["strikethrough", "Strikethrough"],
  null,
  ["bigger", "Bigger"],
  ["smaller", "Smaller"],
  null,
  ["show-colors", "Show Colors"],
];

/** Format > Text: AppKit's four alignments, in its order. */
const ALIGNMENTS: readonly (readonly [RichTextAlignment, string])[] = [
  ["left", "Align Left"],
  ["center", "Center"],
  ["justify", "Justify"],
  ["right", "Align Right"],
];

/**
 * The New Message window's Format menu for the desktop's menu bar: the Font submenu, its styles
 * checked as `format` has them, and the Text submenu with the alignment of the paragraph at the
 * insertion point checked. Each item runs its command of `macalicious/lib/rich-text` on the
 * message; all are dimmed while `disabled` (a send or a save under way, or a message held).
 */
export function MailFormatMenuItems({
  format,
  disabled = false,
  onCommand,
  plain = false,
  styleHeld = false,
  onText,
  onTogglePlain,
  onCopyStyle,
  onPasteStyle,
}: {
  format: RichTextFormat;
  disabled?: boolean;
  onCommand: (command: RichTextCommand) => void;
  /** The message is plain text: only Make Rich Text means anything. */
  plain?: boolean;
  /** Copy Style has been used, so Paste Style has a style to give. */
  styleHeld?: boolean;
  onText: (command: MailTextCommand) => void;
  onTogglePlain: () => void;
  onCopyStyle: () => void;
  onPasteStyle: () => void;
}) {
  const off = disabled || plain;
  return (
    <>
      <Submenu>
        <SubmenuTrigger disabled={plain}>Font</SubmenuTrigger>
        <SubmenuPopup>
          {FONT_MENU.map((entry, index) => {
            if (!entry) {
              // biome-ignore lint/suspicious/noArrayIndexKey: the separators of a fixed list
              return <MenuSeparator key={index} />;
            }
            const [command, label] = entry;
            return command === "bold" ||
              command === "italic" ||
              command === "underline" ||
              command === "strikethrough" ? (
              <MenuCheckboxItem
                key={command}
                keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[command]}
                checked={format[command]}
                disabled={disabled}
                onCheckedChange={() => onCommand(command)}
              >
                {label}
              </MenuCheckboxItem>
            ) : (
              <MenuItem
                key={command}
                keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[command]}
                disabled={disabled}
                onClick={() => onCommand(command)}
              >
                {label}
              </MenuItem>
            );
          })}
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={plain}>Text</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={format.align}
            onValueChange={(align) => onCommand(`align-${align as RichTextAlignment}`)}
          >
            {ALIGNMENTS.map(([value, label]) => (
              <MenuRadioItem
                key={value}
                value={value}
                disabled={disabled}
                keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[`align-${value}`]}
              >
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={plain}>Lists</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem disabled={off} onClick={() => onText("bulleted-list")}>
            Insert Bulleted List
          </MenuItem>
          <MenuItem disabled={off} onClick={() => onText("numbered-list")}>
            Insert Numbered List
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={plain}>Indentation</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem disabled={off} keyEquivalent="command+]" onClick={() => onText("indent")}>
            Increase
          </MenuItem>
          <MenuItem disabled={off} keyEquivalent="command+[" onClick={() => onText("outdent")}>
            Decrease
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={plain}>Quote Level</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem disabled={off} keyEquivalent="command+'" onClick={() => onText("quote-more")}>
            Increase
          </MenuItem>
          <MenuItem
            disabled={off}
            keyEquivalent="option+command+'"
            onClick={() => onText("quote-less")}
          >
            Decrease
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem disabled={off} keyEquivalent="option+command+c" onClick={onCopyStyle}>
        Copy Style
      </MenuItem>
      <MenuItem
        disabled={off || !styleHeld}
        keyEquivalent="option+command+v"
        onClick={onPasteStyle}
      >
        Paste Style
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={disabled} keyEquivalent="shift+command+t" onClick={onTogglePlain}>
        {plain ? "Make Rich Text" : "Make Plain Text"}
      </MenuItem>
    </>
  );
}
