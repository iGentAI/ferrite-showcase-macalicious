"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { BorderlessButton } from "macalicious/borderless-button";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { DisclosureTriangle } from "macalicious/disclosure-triangle";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import {
  ListView,
  ListViewRowDetail,
  ListViewRowLeading,
  ListViewRowTitle,
} from "macalicious/list-view";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { NewItemDot } from "macalicious/new-item-dot";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
  ScopeBarLabel,
} from "macalicious/scope-bar";
import { ScrollView } from "macalicious/scroll-view";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SidebarBadge } from "macalicious/sidebar-badge";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { TagDot } from "macalicious/tag-dot";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarPullDown, ToolbarSplitPullDown } from "macalicious/toolbar-pop-up";
import { ToolbarSearchField, ToolbarSearchFieldToken } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps, type WindowState } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type ComponentType,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { lookupDesktopUser } from "../contacts/contacts-server";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { toggleCharacterViewer } from "../desktop/desktop-characters";
import { type DesktopDragItem, landingAt } from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { useMainWindowItem } from "../desktop/desktop-main-window";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import {
  changeDesktopValue,
  desktopValues,
  desktopValuesLoaded,
  subscribeDesktopValues,
  useDesktopValue,
} from "../desktop/desktop-personal";
import { useOwnPreferencesRaised } from "../desktop/desktop-preferences";
import { askToReach, onAddressRequest, takeAddressRequests } from "../desktop/desktop-reach";
import { shareText } from "../desktop/desktop-services";
import {
  shareFiles as handOverFiles,
  onSharedFiles,
  onSharedLink,
  type SharedLink,
  shareLink,
  takeSharedFiles,
  takeSharedLinks,
} from "../desktop/desktop-share-link";
import { openFile, showInFinder } from "../finder/finder-open";
import { whenMenusClosed } from "../notes/notes-menus";
import { requestPane } from "../system-preferences/pane-request";
import { printDocument } from "../textedit/textedit-drive";
import { MailGlyph, type MailGlyphName } from "./mail-artwork";
import { downloadBlob, isCalendarFile, saveToDownloads } from "./mail-attachments";
import { type MailAutosaveMoment, MailCompose, type MailComposeProps } from "./mail-compose";
import {
  addressKey,
  CONTACTS,
  DEFAULT_SETTINGS,
  EMPTY_DRAFT,
  FLAGS,
  isOwnMailbox,
  isSmartMailbox,
  MAILBOXES,
  type MailboxId,
  type MailDraft,
  type MailMessage,
  type MailSettings,
  ME,
  MESSAGES,
  mailboxName,
  type OwnMailbox,
  type OwnMailboxId,
  SIDEBAR_MAILBOXES,
  type StandardMailboxId,
  showingAddresses,
} from "./mail-data";
import { noteMailDownload } from "./mail-downloads";
import { fileNameOf, mboxOf, rawMessage, wholeBodies } from "./mail-export";
import { useMailFind } from "./mail-find";
import { type ImportedMessage, importedBoxName, parseMbox } from "./mail-import";
import { isJunk, learnJunk } from "./mail-junk";
import { firstWebAddress } from "./mail-links";
import { MailboxNameAlert } from "./mail-mailbox-alert";
import {
  MAIL_FILTERS,
  MAIL_IS_OFFLINE,
  MAIL_SORTS,
  MailAppItems,
  type MailCommands,
  MailDockItems,
  MailEditItems,
  MailFileItems,
  type MailFilter,
  MailMailboxItems,
  MailMailboxRowItems,
  MailMessageItems,
  MailMessageRowItems,
  type MailSort,
  MailViewItems,
  MailWindowItems,
  mailKeys,
} from "./mail-menus";
import { MailMessageContent, MailMessageWindow } from "./mail-message-window";
import { MailAccountPane, MailBlockedPane } from "./mail-preference-panes";
import {
  listFontStyle,
  MailPreferences,
  messageFontStyle,
  SERVED_SETTING_REASONS,
} from "./mail-preferences";
import { type MailRule, messagesOfMailbox, readMailRules, ruleChange } from "./mail-rules";
import { MailRulesPane } from "./mail-rules-pane";
import {
  DEFAULT_FAVORITES,
  inMailboxOrder,
  keepMailValue,
  MAIL_BLOCKED,
  MAIL_RECIPIENTS_REMOVED,
  MAIL_ROLES,
  MAIL_RULES,
  MAIL_SETTINGS,
  MAIL_SIGNATURES,
  MAIL_SMART,
  MAIL_STATIONERY,
  MAIL_VIEW,
  MAIL_VIPS,
  type MailRoles,
  type MailView,
  mailDownloadsFolder,
  movedBefore,
  readMailRoles,
  readMailSettings,
  readMailView,
} from "./mail-saved";
import {
  finishedToken,
  type SearchToken,
  searchRules,
  smartFromSearch,
  TOKEN_LABEL,
  wholeToken,
} from "./mail-search";
import { clearMailSelection, publishMailSelection } from "./mail-selection";
import {
  type MailSignature,
  type MailSignatures,
  NO_SIGNATURES,
  readMailSignatures,
  SEQUENTIAL_SIGNATURE,
  signatureFor,
  withSignature,
} from "./mail-signatures";
import { MailSignaturesPane } from "./mail-signatures-pane";
import {
  inSmartMailbox,
  meetsConditions,
  readSmartMailboxes,
  type SmartMailbox,
} from "./mail-smart";
import { MailSmartSheet, NEW_SMART, type SmartDraft } from "./mail-smart-sheet";
import { playMailAction, soundNewMail } from "./mail-sounds";
import {
  type MailStationery,
  readMailStationery,
  STATIONERY_TOO_LARGE,
  withStationery,
} from "./mail-stationery";
import { MailTabbedWindow, MailTabViewItems, MailTabWindowItems } from "./mail-tabs";
import { MailTextMenu } from "./mail-text-menu";
import { conversationRows, type MailRow, rowId, threadsOf } from "./mail-threads";
import {
  MailActivityWindow,
  type MailConnectionReport,
  MailDoctorWindow,
  MailRecipientsWindow,
  MailSourceWindow,
  type MailToolWindowProps,
} from "./mail-tool-windows";
import { MailCustomizeToolbar, type MailToolbarItem, readHiddenTools } from "./mail-toolbar-sheet";
import { accountOf, appendedText, previousRecipients, readRemovedRecipients } from "./mail-tools";
import {
  FLAG_BOXES,
  FLAGGED_BOX,
  flagColorBox,
  type MailVip,
  readMailVips,
  vipBox,
} from "./mail-vips";
import "./mail.tokens.css";
import "./mail.css";

const storedAsIs = (stored: unknown) => stored;

/** What a message's file carries as Mail saves it: the message it came with. */
type MailFile = DesktopDragItem & { message: string };

type Front = "viewer" | "compose" | "preferences";

/** How far apart a window taken away tries again to save its message. */
const WINDOW_SAVE_RETRY_MS = 10_000;

/** A message just started, which has no HTML yet. */
type StartedDraft = MailDraft & { html?: undefined };

/** What a message being dragged carries: the ids of the messages, as JSON. */
const DRAG_TYPE = "application/x-macalicious-mail";
const BOX_DRAG_TYPE = "application/x-macalicious-mailbox";

/** Whether `message` meets one criterion of the filter; `me` is the user's own address. */
const meets = (message: MailMessage, filter: MailFilter, me: string, vips: readonly MailVip[]) => {
  if (filter === "vips") {
    const sender = addressKey(message.fromAddress ?? message.from);
    return vips.some((vip) => vip.address === sender);
  }
  const mine = (list: readonly string[] | undefined) =>
    (list ?? []).some((address) => addressKey(address) === addressKey(me));
  if (filter === "unread") return message.unread === true;
  if (filter === "flagged") return message.flag !== undefined;
  if (filter === "to-me") return mine(message.toAddresses ?? message.to);
  if (filter === "attachments") return (message.attachmentCount ?? 0) > 0;
  return mine(message.cc);
};

/** The text a sort compares of a message, by what the list is sorted by. */
const sortText = (
  message: MailMessage,
  sort: Exclude<MailSort, "date">,
  own: readonly OwnMailbox[],
): string => {
  if (sort === "from") return message.from;
  if (sort === "subject") return message.subject;
  if (sort === "to") return message.to.join(", ");
  if (sort === "mailbox") return mailboxName(message.mailbox, own);
  if (sort === "flags") return message.flag ? String(FLAGS.indexOf(message.flag)) : "~";
  return message.unread ? "0" : "1";
};

/** The classic layout's columns: what each sorts by. */
const CLASSIC_COLUMNS: readonly (readonly [sort: MailSort, label: string])[] = [
  ["from", "From"],
  ["subject", "Subject"],
  ["date", "Date Received"],
];

const SELECT_ONE_TO_SHARE = "Select one message to share it.";

/** How long a search waits for the typing to stop before it asks the server. */
const SEARCH_WHOLE_TEXT_MS = 300;

const isText = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.matches("input, textarea, select"));

/** One step of Undo: the messages it changed, what it made of each and what each was before. */
interface MailEdit {
  label: string;
  entries: readonly (readonly [id: string, change: MailMessageChange, back: MailMessageChange])[];
}

const SIDEBAR_GLYPHS: Record<StandardMailboxId, MailGlyphName> = {
  inbox: "inbox",
  drafts: "drafts",
  sent: "sent",
  outbox: "sent",
  junk: "junk",
  trash: "trash",
  archive: "archive",
};

// Mail draws the content of its sidebar rows 1 pt higher than the standard source list, which
// the library's own comparison with Mail reproduces the same way (sidebar, visual-inactive).
const RAISED = { paddingBlockEnd: 2 };

// The split view's hook for the colour of its line, set to the colours measured in Mail.
const DIVIDER = { "--mac-split-view-divider-color": "var(--mac-mail-divider)" } as CSSProperties;
const LIST = { background: "var(--mac-mail-list-background)" };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const firstLine = (body: string) => body.split("\n").filter(Boolean).slice(0, 3).join(" ");
/** The newest of some messages. */
const newestOf = (some: readonly MailMessage[]) =>
  some.reduce((newest, each) => (each.time > newest.time ? each : newest));
/** The messages a row of the list stands for. */
const messagesOf = (row: MailRow): readonly MailMessage[] =>
  row.kind === "thread" ? row.members : [row.message];
/** A row under a conversation's: its sender and subject only. */
const CHILD_ROW_HEIGHT = 46;
/** A row of the classic layout's list: one line, as in its columns. */
const CLASSIC_ROW_HEIGHT = 20;

/** Where the Preferences window opens, in points from the viewer's top-left corner. */
const PREFERENCES_OFFSET = { x: 255, y: 60 };

/** Why nothing goes into the Outbox: it holds only what was sent while Mail is offline. */
export const MOVE_TO_OUTBOX_UNAVAILABLE =
  "Only a message sent while Mail is offline waits in the Outbox: a message cannot be moved there.";
/** Why a waiting message can only be deleted. */
export const OUTBOX_MOVE_UNAVAILABLE =
  "This message is waiting to be sent: it can only be deleted from the Outbox.";
/** Why Drafts is never a destination of Move to…: only a draft the person saves is kept there. */
export const MOVE_TO_DRAFTS_UNAVAILABLE =
  "Only a draft you save is kept in Drafts: a message cannot be moved there.";
/** Why a draft cannot be archived, filed as junk or moved anywhere but the Trash. */
export const DRAFT_MOVE_UNAVAILABLE =
  "A draft can only be deleted: send it, or move it to the Trash.";

/**
 * Why `message` cannot be moved to mailbox `to`, or `undefined` when it can. The rules are the
 * server's (`ferrite-apps/desktop/src/apps/mail/model.rs`): nothing is moved into Drafts, and a
 * draft can only go to the Trash. Offering a move the server refuses would show the message
 * leaving and then coming back, unexplained.
 */
export function moveRefusal(message: MailMessage | null, to: MailboxId): string | undefined {
  if (!message) return undefined;
  if (message.mailbox === to) return `The message is already in ${mailboxName(to)}.`;
  if (to === "drafts") return MOVE_TO_DRAFTS_UNAVAILABLE;
  if (to === "outbox") return MOVE_TO_OUTBOX_UNAVAILABLE;
  if (message.mailbox === "outbox" && to !== "trash") return OUTBOX_MOVE_UNAVAILABLE;
  if (message.mailbox === "drafts" && to !== "trash") return DRAFT_MOVE_UNAVAILABLE;
  return undefined;
}

/** What the viewer changes on a message: read or unread, its flag, mute, its mailbox. */
export type MailMessageChange = Partial<
  Pick<MailMessage, "unread" | "flag" | "muted" | "mailbox" | "priority" | "rulesPending">
>;

export interface MailProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * Why the Preferences window's Help buttons are dimmed, given by a host that has no help book
   * for Mail; passed to `MailPreferences` as its `helpUnavailable`.
   * @default none: the buttons are drawn enabled, as captured
   */
  helpUnavailable?: string;
  /** The messages the mailboxes start with; seven invented ones by default. */
  messages?: readonly MailMessage[];
  /** The names the address fields of a new message complete. */
  contacts?: readonly string[];
  /**
   * The mailbox selected at first.
   * @default "inbox"
   */
  defaultMailbox?: MailboxId;
  /** Called with the mailbox the user selects. */
  onMailboxChange?: (mailbox: MailboxId) => void;
  /**
   * The `id` of the message selected at first, or `null` for none.
   * @default the most recent message of the first mailbox
   */
  defaultMessage?: string | null;
  /**
   * A New Message window that is open at first, holding this draft; `null` for none. It opens
   * as the key window, with the viewer inactive behind it, as in the reference screenshots.
   * @default null
   */
  defaultDraft?: MailDraft | null;
  /**
   * Where a New Message window opens, in points from the viewer's top-left corner.
   * @default { x: 225, y: 145 }
   */
  composeOffset?: { x: number; y: number };
  /**
   * The surface of the mailbox list: vibrant over a desktop, or opaque on a plain page.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /** The settings the Preferences window starts with. */
  defaultSettings?: MailSettings;
  /** Whether the Preferences window is open, when the owner controls it. */
  preferencesOpen?: boolean;
  /**
   * Whether the Preferences window is open at first.
   * @default false
   */
  defaultPreferencesOpen?: boolean;
  /** Called when the Preferences window opens or closes. */
  onPreferencesOpenChange?: (open: boolean) => void;
  /**
   * The element the New Message and Preferences windows are rendered into, positioned over
   * the viewer. It must be the containing block of absolutely positioned children.
   * @default the viewer's offset parent
   */
  windowsContainer?: HTMLElement | null;
  /**
   * From a desktop that hosts an application's further windows (its descriptor says
   * `windows`): the New Message window is then a window of that desktop, which places and
   * moves it, instead of one this viewer places beside itself.
   */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  /** For the `WindowControls`. */
  onClose?: WindowControlsProps["onClose"];
  /** For the `WindowControls`. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the `WindowControls`. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the `WindowControls`: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the `WindowControls`. */
  minimizeDisabled?: boolean;
  /** For the `WindowControls`. */
  zoomDisabled?: boolean;
  /** Further props for the `WindowControls`. */
  controlsProps?: WindowControlsProps;
  /** Called when the title bar itself is pressed: a window manager starts a move here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /**
   * The messages, when the owner holds them (a desktop served by its Ferrite application): the
   * mailboxes show these, and every change the viewer makes is only reported through
   * `onMessageChange`, `onSend`, `onSaveDraft` and `onErase`, for the owner to make. Pass
   * `messages={[]}` and `defaultMessage={null}` with it.
   */
  heldMessages?: readonly MailMessage[];
  /** With `heldMessages`: called with a message's id and what the viewer changed on it. */
  onMessageChange?: (id: string, change: MailMessageChange) => void;
  /**
   * With `heldMessages`: called when a New Message window sends, with the draft it was opened
   * from (`draftId`) if any. The window closes when it answers true, or `"kept"` for a message
   * that waits to go later, which plays no sent sound. Without it, a window over held messages
   * keeps its message when Send is pressed: nothing is sent.
   */
  onSend?: (
    draft: MailDraft,
    from: { draftId?: string; sentBox?: MailboxId },
  ) => boolean | "kept" | Promise<boolean | "kept">;
  /**
   * With `heldMessages`: called when a New Message window is closed, with what it holds, and the
   * saved draft it was opened from. The owner keeps what is worth keeping. The window closes
   * unless it answers `false`, or a promise of `false`: then it stays open with what was typed.
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: an owner that answers nothing lets the window close
  onSaveDraft?: (draft: MailDraft, draftId?: string) => void | boolean | Promise<boolean>;
  /**
   * With `heldMessages`: reads a saved draft completely (its whole text and styles) before it
   * opens for editing; `null` leaves it closed. Without it a draft opens with what the list
   * holds.
   */
  resolveDraft?: (message: MailMessage) => Promise<MailDraft | null>;
  /**
   * With `heldMessages`: keeps what an open New Message window holds, saved as it is written, and
   * answers the id of the draft that now holds it, `undefined` when an emptied draft was removed;
   * it rejects when nothing was kept. `leaving` says the page is going away.
   */
  onAutosaveDraft?: (
    draft: MailDraft,
    draftId: string | undefined,
    leaving: boolean,
  ) => Promise<string | undefined>;
  /** With `heldMessages`: called when a message in the Trash is deleted again, to erase it. */
  onErase?: (id: string) => void;
  /** With `heldMessages`: called by Copy to, with the messages and the mailbox to copy them to. */
  onCopyMessages?: (messages: readonly MailMessage[], to: MailboxId) => void;
  /** With `heldMessages`: called by Remove Attachments, which is dimmed without it. */
  onRemoveAttachments?: (messages: readonly MailMessage[]) => void;
  /**
   * With `heldMessages`: called by Import Mailboxes, which is dimmed without it, with the mailbox
   * to make and the messages of the file. Answers how many were kept and refused, or why none were.
   */
  /** File > New Viewer Window: its owner opens another viewer of the same mail. */
  onNewViewer?: () => void;
  /**
   * This is a further viewer: what it shows is its own, and the person's kept view and settings stay
   * the first viewer's to write.
   */
  secondViewer?: boolean;
  /**
   * Called with the words a search has: the ids of the messages whose whole text holds them, for a
   * message the list holds only the start of.
   */
  onSearchWholeText?: (words: string) => Promise<readonly string[]>;
  onImportMailbox?: (
    name: string,
    messages: readonly ImportedMessage[],
  ) => Promise<{ made: number; refused: number } | string>;
  /** With `heldMessages`: older messages are not loaded, so a mailbox cannot be exported whole yet. */
  moreToLoad?: boolean;
  /** With `heldMessages`: the mailboxes the person made. */
  heldMailboxes?: readonly OwnMailbox[];
  /**
   * With `heldMessages`: called by New Mailbox. Answers `null` when the mailbox was made, or why
   * it was not, which the alert shows. Without it the command is dimmed.
   */
  onCreateMailbox?: (name: string) => Promise<string | null>;
  /**
   * With `heldMessages`: called by Rename Mailbox; it answers as `onCreateMailbox` does. Without
   * it the command is dimmed.
   */
  onRenameMailbox?: (id: OwnMailboxId, name: string) => Promise<string | null>;
  /**
   * With `heldMessages`: called by Delete Mailbox, whose messages the owner moves to the Trash.
   * Without it the command is dimmed.
   */
  onDeleteMailbox?: (id: OwnMailboxId) => void;
  /** Called by the toolbar's Get Mail button; what it answers says when the mail has been read. */
  onGetMail?: () => unknown;
  /** Whether Mail is offline: Get Mail, Synchronize and Rebuild are dimmed with the reason. */
  offline?: boolean;
  /** Called by Mailbox > Take All Accounts Offline or Online, which is dimmed without it. */
  onToggleOffline?: () => void;
  /** With `heldMessages`: what a message came with, as files that can be read. */
  attachmentFiles?: (message: MailMessage) => readonly DesktopDragItem[];
  /** Called by Mailbox > Rebuild: what is held is read again. Without it, as Get Mail. */
  onRebuild?: () => unknown;
  /** Asks the server whether it answers, for Window > Connection Doctor, which is dimmed without it. */
  onCheckConnection?: () => Promise<MailConnectionReport>;
  /** Renders a message's text in the message pane in place of its `body`'s paragraphs. */
  renderMessageBody?: (message: MailMessage) => ReactNode;
  /** Further props for the New Message window: a notice, a send under way, a message held. */
  composeProps?: Pick<MailComposeProps, "notice" | "sending" | "held" | "attaching">;
  /**
   * Take the links shared with Mail from other apps (Share > Mail in Safari, News and Stocks:
   * `demos/desktop/desktop-share-link.tsx`). Each opens a New Message with the page's title as its
   * subject and its address as its text, those shared while Mail was closed as soon as it opens.
   * A link shared while a New Message window is open waits until that window closes, so that
   * nothing in it is replaced.
   * @default false
   */
  takesSharedLinks?: boolean;
  /**
   * Keep the Preferences window's settings and what the viewer shows (mailbox, sort, filter, panes)
   * with the person's desktop settings, and open as they were left. The served desktop asks for it.
   * @default false
   */
  keepsView?: boolean;
  /**
   * Called when a New Message window opens (true, with the saved draft it was opened from) or
   * closes (false). With `heldMessages` only one is open at a time: New Message, Reply and
   * opening a draft bring it to the front rather than replace what it holds.
   */
  onComposeChange?: (open: boolean, draftId?: string) => void;
  /**
   * With `heldMessages`: reads a message's whole text before Reply, Reply All or Forward quote
   * it (a message the owner lists may hold only its start); `null` leaves the command undone.
   * Without it the text the message holds is quoted.
   */
  resolveBody?: (message: MailMessage) => Promise<string | null>;
  /**
   * The address of the window's user, as `fromAddress` writes it: a reply to one's own message
   * goes to its first recipient, and a reply to all leaves it out. An empty string means it is
   * not known yet: Reply and Reply All wait for it.
   * @default the demo's invented account
   */
  me?: string;
  /**
   * A line shown over the message list, as an alert: a mailbox that could not be loaded, or a
   * message that could not be read.
   * @default none
   */
  notice?: ReactNode;
}

/**
 * The Mail viewer of macOS 10.15: mailbox list, message list and message, under a unified
 * toolbar and a Favorites bar. Its root is the library's `Window`, which takes every prop not
 * listed here, so a window manager places it (`style`, `width`, `height`, `ref`) and tells it
 * whether it is key (`state`). The New Message and Preferences windows are windows of their
 * own, rendered beside the viewer. Mail is simulated: nothing is fetched or sent.
 */
export function Mail({
  messages: initialMessages = MESSAGES,
  helpUnavailable,
  contacts = CONTACTS,
  defaultMailbox = "inbox",
  onMailboxChange,
  defaultMessage,
  defaultDraft = null,
  composeOffset = { x: 225, y: 145 },
  material = "translucent",
  defaultSettings = DEFAULT_SETTINGS,
  preferencesOpen,
  defaultPreferencesOpen = false,
  onPreferencesOpenChange,
  windowsContainer,
  DesktopWindow,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  heldMessages,
  onMessageChange,
  onSend,
  onSaveDraft,
  resolveDraft,
  onAutosaveDraft,
  resolveBody,
  onErase,
  onCopyMessages,
  onRemoveAttachments,
  onNewViewer,
  secondViewer = false,
  onSearchWholeText,
  onImportMailbox,
  moreToLoad = false,
  heldMailboxes,
  onCreateMailbox,
  onRenameMailbox,
  onDeleteMailbox,
  onGetMail,
  offline = false,
  onToggleOffline,
  attachmentFiles,
  onRebuild,
  onCheckConnection,
  renderMessageBody,
  composeProps,
  onComposeChange,
  takesSharedLinks = false,
  keepsView = false,
  me = ME,
  notice,
  state = "key",
  width = 1061,
  height = 711,
  className,
  ref,
  onKeyDown,
  onPointerDownCapture,
  ...props
}: MailProps) {
  // The message shown at first is read by being shown, like one the user selects.
  const [firstId] = useState<string | null>(() =>
    defaultMessage !== undefined
      ? defaultMessage
      : (initialMessages
          .filter((message) => message.mailbox === defaultMailbox)
          .sort((a, b) => b.time - a.time)[0]?.id ?? null),
  );
  const [ownMessages, setMessages] = useState<readonly MailMessage[]>(() =>
    initialMessages.map((message) =>
      message.id === firstId && message.mailbox === defaultMailbox && message.unread
        ? { ...message, unread: false }
        : message,
    ),
  );
  const messages = heldMessages ?? ownMessages;
  // The viewer has no Format commands of its own: while it is the window last used, the
  // desktop's Format menu shows none, not those of a New Message window behind it.
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  useDesktopAppMenu("mail", "Format", null, titleBar);
  // A send handed to `onSend` and not answered yet.
  const [sendingHere, setSendingHere] = useState(false);
  const [mailbox, setMailbox] = useState<MailboxId>(defaultMailbox);
  // The mailbox the person left the window on, until it is shown or they choose another.
  const [savedMailbox, setSavedMailbox] = useState<MailboxId | null>(null);
  const mailboxChosen = useRef(false);
  const [query, setQuery] = useState("");
  // The search's From: and Subject: tokens, what it looks through, and its open suggestions.
  const [tokens, setTokens] = useState<readonly SearchToken[]>([]);
  const [searchScope, setSearchScope] = useState<"all" | "mailbox">("all");
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestion, setSuggestion] = useState(-1);
  const [conversations, setConversations] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [sort, setSort] = useState<MailSort>("date");
  // The order chosen in View > Sort By. Until then: by date as the preferences say, newest first
  // unless they say otherwise, and A to Z by anything else.
  const [direction, setDirection] = useState<boolean | null>(null);
  const [filterOn, setFilterOn] = useState(false);
  const [filters, setFilters] = useState<readonly MailFilter[]>(["unread"]);
  const [favoritesShown, setFavoritesShown] = useState(true);
  const [toolbarShown, setToolbarShown] = useState(true);
  // What View > Customize Toolbar took out, and the mailboxes' order as dragged.
  const [hiddenTools, setHiddenTools] = useState<readonly MailToolbarItem[]>([]);
  const shows = (tool: MailToolbarItem) => (hiddenTools.includes(tool) ? "hidden" : undefined);
  const [customizing, setCustomizing] = useState(false);
  const [boxOrder, setBoxOrder] = useState<readonly string[]>([]);
  const [removingFiles, setRemovingFiles] = useState(false);
  const [namingStationery, setNamingStationery] = useState(false);
  const composeDraft = useRef<(() => MailDraft) | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const draggedBox = useRef<string | null>(null);
  // Window's own windows that are open, and what Window > Activity reports.
  const [tools, setTools] = useState<readonly MailTool[]>([]);
  const [checks, setChecks] = useState(0);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const showTool = (tool: MailTool) =>
    setTools((open) => (open.includes(tool) ? open : [...open, tool]));
  const closeTool = (tool: MailTool) => setTools((open) => open.filter((each) => each !== tool));
  const reading = (run: () => unknown) => {
    setChecks((count) => count + 1);
    void Promise.resolve()
      .then(run)
      .finally(() => {
        setChecks((count) => count - 1);
        setLastChecked(Date.now());
      });
  };
  // How many messages have come in, and how many had when Get Mail was last asked, until it answers.
  const arrivals = useRef(0);
  const arrivalsAtGetMail = useRef<number | null>(null);
  const getMail = () => {
    if (offline) return;
    arrivalsAtGetMail.current = arrivals.current;
    reading(() => onGetMail?.());
  };
  const [favoriteBoxes, setFavoriteBoxes] = useState<readonly string[]>(DEFAULT_FAVORITES);
  const [flaggedOpen, setFlaggedOpen] = useState(false);
  const [sidebarSize, setSidebarSize] = useState(200);
  const [listSize, setListSize] = useState(343);
  // How tall the message list is in the classic layout, where the message lies under it.
  const [classicList, setClassicList] = useState(240);
  const [settings, setSettings] = useState(defaultSettings);
  const [undoStack, setUndoStack] = useState<readonly MailEdit[]>([]);
  const [redoStack, setRedoStack] = useState<readonly MailEdit[]>([]);
  const [lastMove, setLastMove] = useState<MailboxId | null>(null);
  // The mailbox whose row was control-clicked, the one being dragged over, and what Erase asks.
  const [menuMailbox, setMenuMailbox] = useState<MailboxId | null>(null);
  const [menuFavorite, setMenuFavorite] = useState<MailboxId | null>(null);
  const [dropMailbox, setDropMailbox] = useState<MailboxId | null>(null);
  const [erasing, setErasing] = useState<"trash" | "junk" | null>(null);
  const [ownHere, setOwnHere] = useState<readonly OwnMailbox[]>([]);
  const own = heldMailboxes ?? ownHere;
  // What New Mailbox or Rename Mailbox is naming, and the mailbox Delete Mailbox asks about.
  const [naming, setNaming] = useState<OwnMailbox | "new" | null>(null);
  const [deletingBox, setDeletingBox] = useState<OwnMailbox | null>(null);
  // The Smart Mailboxes: with the person's settings on a desktop that keeps them, or else here.
  const [smartHere, setSmartHere] = useState<readonly SmartMailbox[]>([]);
  const smartStored = useDesktopValue(MAIL_SMART, storedAsIs, undefined);
  const smartKept = useMemo(() => readSmartMailboxes(smartStored) ?? [], [smartStored]);
  const smart = keepsView ? smartKept : smartHere;
  // The people the person marked as VIPs, kept the same way.
  const [vipsHere, setVipsHere] = useState<readonly MailVip[]>([]);
  const vipsStored = useDesktopValue(MAIL_VIPS, storedAsIs, undefined);
  const vipsKept = useMemo(() => readMailVips(vipsStored) ?? [], [vipsStored]);
  const vips = keepsView ? vipsKept : vipsHere;
  const keepVips = (next: readonly MailVip[]) => {
    if (keepsView) changeDesktopValue(MAIL_VIPS, next);
    else setVipsHere(next);
  };
  // The people the person blocked, kept the same way, and those taken off Previous Recipients.
  const [blockedHere, setBlockedHere] = useState<readonly MailVip[]>([]);
  const blockedStored = useDesktopValue(MAIL_BLOCKED, storedAsIs, undefined);
  const blockedKept = useMemo(() => readMailVips(blockedStored) ?? [], [blockedStored]);
  const blocked = keepsView ? blockedKept : blockedHere;
  const keepBlocked = (next: readonly MailVip[]) => {
    if (keepsView) changeDesktopValue(MAIL_BLOCKED, next);
    else setBlockedHere(next);
  };
  const [removedHere, setRemovedHere] = useState<readonly string[]>([]);
  const removedStored = useDesktopValue(MAIL_RECIPIENTS_REMOVED, storedAsIs, undefined);
  const removedKept = useMemo(() => readRemovedRecipients(removedStored) ?? [], [removedStored]);
  const removedRecipients = keepsView ? removedKept : removedHere;
  const keepRemoved = (next: readonly string[]) => {
    if (keepsView) changeDesktopValue(MAIL_RECIPIENTS_REMOVED, next);
    else setRemovedHere(next);
  };
  // The stationery File > Save as Stationery keeps, and the mailboxes standing in for Archive and
  // Junk, kept the same way.
  const [stationeryHere, setStationeryHere] = useState<readonly MailStationery[]>([]);
  const stationeryStored = useDesktopValue(MAIL_STATIONERY, storedAsIs, undefined);
  const stationeryKept = useMemo(
    () => readMailStationery(stationeryStored) ?? [],
    [stationeryStored],
  );
  const stationery = keepsView ? stationeryKept : stationeryHere;
  const keepStationery = (next: readonly MailStationery[]) => {
    if (keepsView) changeDesktopValue(MAIL_STATIONERY, next);
    else setStationeryHere(next);
  };
  const [rolesHere, setRolesHere] = useState<MailRoles>({});
  const rolesStored = useDesktopValue(MAIL_ROLES, storedAsIs, undefined);
  const rolesKept = useMemo(() => readMailRoles(rolesStored), [rolesStored]);
  const roles = keepsView ? rolesKept : rolesHere;
  const keepRoles = (next: MailRoles) => {
    if (keepsView) changeDesktopValue(MAIL_ROLES, next);
    else setRolesHere(next);
  };
  // A mailbox standing in that has since been deleted gives the role back.
  const roleBox = (role: keyof MailRoles, fallback: MailboxId): MailboxId => {
    const box = roles[role];
    return box && own.some((each) => each.id === box) ? box : fallback;
  };
  const archiveBox = roleBox("archive", "archive");
  const junkBox = roleBox("junk", "junk");
  const sentBox = roleBox("sent", "sent");
  const trashBox = roleBox("trash", "trash");
  const inTrash = (message: MailMessage) =>
    message.mailbox === "trash" || message.mailbox === trashBox;
  // A draft leaves by the server's own Trash, the only place that takes one.
  const trashOf = (message: MailMessage): MailboxId =>
    message.mailbox === "drafts" || message.mailbox === "outbox" ? "trash" : trashBox;
  const ownInOrder = inMailboxOrder(own, boxOrder);
  // The rules of Preferences, kept the same way.
  const [rulesHere, setRulesHere] = useState<readonly MailRule[]>([]);
  const rulesStored = useDesktopValue(MAIL_RULES, storedAsIs, undefined);
  const rulesKept = useMemo(() => readMailRules(rulesStored) ?? [], [rulesStored]);
  const rules = keepsView ? rulesKept : rulesHere;
  const keepRules = (next: readonly MailRule[]) => {
    if (keepsView) changeDesktopValue(MAIL_RULES, next);
    else setRulesHere(next);
  };
  const [askingToApply, setAskingToApply] = useState(false);
  // The signatures of Preferences, kept the same way.
  const [signaturesHere, setSignaturesHere] = useState<MailSignatures>(NO_SIGNATURES);
  const signaturesStored = useDesktopValue(MAIL_SIGNATURES, storedAsIs, undefined);
  const signaturesKept = useMemo(
    () => readMailSignatures(signaturesStored) ?? NO_SIGNATURES,
    [signaturesStored],
  );
  const signatures = keepsView ? signaturesKept : signaturesHere;
  const keepSignatures = (next: MailSignatures) => {
    if (keepsView) changeDesktopValue(MAIL_SIGNATURES, next);
    else setSignaturesHere(next);
  };
  // What the sidebar lists besides the person's own Smart Mailboxes. The demo's reference screenshots
  // have flagged mail and no Flagged row, so the row belongs to a desktop that keeps the person's view.
  const listed = useMemo(
    () => [...smart, ...(keepsView ? [FLAGGED_BOX, ...FLAG_BOXES] : []), ...vips.map(vipBox)],
    [smart, keepsView, vips],
  );
  const keepSmart = (next: readonly SmartMailbox[]) => {
    if (keepsView) changeDesktopValue(MAIL_SMART, next);
    else setSmartHere(next);
  };
  const [editingSmart, setEditingSmart] = useState<SmartDraft | null>(null);
  const [renamingSmart, setRenamingSmart] = useState<SmartMailbox | null>(null);
  const [deletingSmart, setDeletingSmart] = useState<SmartMailbox | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [printFailed, setPrintFailed] = useState(false);
  const [fileProblem, setFileProblem] = useState<{ title: string; text: string } | null>(null);
  // View > Message: how the pane shows the message selected, kept as the selection changes.
  const [messageView, setMessageView] = useState<"default" | "headers" | "source">("default");
  // The messages whose raw source is open in a window of its own, on a desktop.
  const [sourceIds, setSourceIds] = useState<readonly string[]>([]);
  const readWholeBody = useMemo(
    () => (resolveBody ? async (message: MailMessage) => await resolveBody(message) : undefined),
    [resolveBody],
  );
  // The messages open in windows of their own, oldest first.
  const [readingIds, setReadingIds] = useState<readonly string[]>([]);
  const openMessages = (opening: readonly MailMessage[]) => {
    for (const message of opening) update(message.id, { unread: false });
    setReadingIds((all) => [
      ...all,
      ...opening.map((message) => message.id).filter((id) => !all.includes(id)),
    ]);
  };
  const searchInput = useRef<HTMLInputElement>(null);
  // The New Message window: its draft, a number that makes each one a new window (never used
  // twice), the number the desktop names it by (1 again once no window is open, as before), and
  // the saved draft it was opened from.
  const [compose, setCompose] = useState<{
    draft: MailDraft;
    key: number;
    slot: number;
    focus: boolean;
    draftId?: string;
    /** Opened for a link shared with Mail (Share > Mail in another app). */
    shared?: boolean;
    /** What a reply or a forward quotes. */
    original?: string;
    /** A forward: its quote stays. */
    keepsOriginal?: boolean;
    /** A new message was made with. */
    signature?: MailSignature | null;
    /** What it replies to, whose files Include Original Attachments brings. */
    repliesTo?: MailMessage;
  } | null>(defaultDraft ? { draft: defaultDraft, key: 0, slot: 0, focus: false } : null);
  // The window as it is now, for handlers that run before a render, and the number the next
  // one gets: never one used before, so an answer meant for a closed window finds none.
  const composeNow = useRef(compose);
  const nextComposeKey = useRef(compose?.key ?? 0);
  // The New Message window's own close with its checks, and whether it is what closes the
  // window now (the desktop's close then asks the application again).
  const composeClose = useRef<(() => void) | null>(null);
  const composeClosing = useRef(false);
  // The New Message window's Send, with its checks, and whether it is the key window now.
  const composeSend = useRef<(() => void) | null>(null);
  const composeAttach = useRef<(() => void) | null>(null);
  const [composeIsKey, setComposeIsKey] = useState(false);
  const composeRoot = useRef<HTMLDivElement | null>(null);
  const composeSave = useRef<(() => void) | null>(null);
  // Draft saves, one after another; a send or a close waits for them, and goes on from the draft
  // the last one made.
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const autosave = (draft: MailDraft, when: MailAutosaveMoment): Promise<boolean> => {
    if (!onAutosaveDraft) return Promise.resolve(false);
    const key = composeNow.current?.key;
    const save = async () => {
      const now = composeNow.current;
      // A window sent or closed since has nothing left to keep.
      if (!now || now.key !== key) return true;
      const id = await onAutosaveDraft(draft, now.draftId, when === "page");
      const after = composeNow.current;
      if (after && after.key === key && after.draftId !== id) {
        composeNow.current = { ...after, draftId: id };
        setCompose(composeNow.current);
      }
      return true;
    };
    // A page going away cannot wait for a save under way, which may never be answered: a request
    // that outlives the page goes now. At worst it leaves a second copy of the draft. A window taken
    // away has nothing left to try again from, so its save goes on trying while the page lives.
    const trying = async (): Promise<boolean> => {
      try {
        return await save();
      } catch (error) {
        if (when !== "window") throw error;
        await new Promise((resolve) => setTimeout(resolve, WINDOW_SAVE_RETRY_MS));
        return trying();
      }
    };
    const saved = when === "page" ? save() : saves.current.then(trying);
    const kept = saved.catch(() => false);
    saves.current = kept;
    return kept;
  };
  const [ownPreferences, setOwnPreferences] = useState(defaultPreferencesOpen);
  const preferences = preferencesOpen ?? ownPreferences;
  const setPreferences = (open: boolean) => {
    setOwnPreferences(open);
    onPreferencesOpenChange?.(open);
  };
  // Which of the app's windows is in front. A window that has closed gives way to the others.
  const [wanted, setWanted] = useState<Front>(
    defaultDraft ? "compose" : preferences ? "preferences" : "viewer",
  );
  // Preferences opened from outside (a menu bar's command) come to the front as well.
  const [wasOpen, setWasOpen] = useState(preferences);
  if (wasOpen !== preferences) {
    setWasOpen(preferences);
    if (preferences) setWanted("preferences");
  }
  useOwnPreferencesRaised("mail", () => setWanted("preferences"));
  // A New Message window that a desktop hosts is the desktop's to order: only one this viewer
  // places itself takes part in which of the app's windows is in front.
  const ownCompose = compose !== null && !DesktopWindow;
  const front: Front =
    wanted === "compose" && !ownCompose
      ? preferences
        ? "preferences"
        : "viewer"
      : wanted === "preferences" && !preferences
        ? ownCompose
          ? "compose"
          : "viewer"
        : wanted;
  // The app's front window has the state the manager gives the app; its others are behind it.
  const stateOf = (window: Front): WindowState =>
    front === window || state === "inactive" ? state : "inactive";

  const searchAsks = useMemo(() => searchRules(tokens, query), [tokens, query]);
  const searching = searchAsks.length > 0;
  // The messages only the server can say hold the words: the list holds only the start of them.
  const searchWords = searchAsks.find((ask) => ask.field === "message")?.value;
  const [wholeTextHits, setWholeTextHits] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    setWholeTextHits(new Set());
    if (!onSearchWholeText || !searchWords) return;
    let current = true;
    const asking = setTimeout(() => {
      onSearchWholeText(searchWords).then(
        (ids) => {
          if (current) setWholeTextHits(new Set(ids));
        },
        () => {},
      );
    }, SEARCH_WHOLE_TEXT_MS);
    return () => {
      current = false;
      clearTimeout(asking);
    };
  }, [searchWords, onSearchWholeText]);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(firstId ? [firstId] : []);
  const ascending = direction ?? (sort === "date" ? settings.recentFirst === false : true);
  const visible = useMemo(() => {
    const openSmart = listed.find((box) => box.id === mailbox);
    const now = Date.now();
    // What is selected stays in a Smart Mailbox as it stays under the filter: reading a message that
    // was listed for being unread does not take it out from under the person reading it.
    const inMailbox = (message: MailMessage) =>
      isSmartMailbox(mailbox)
        ? (openSmart !== undefined && inSmartMailbox(message, openSmart, now)) ||
          selectedIds.includes(message.id)
        : message.mailbox === mailbox;
    const found = messages.filter(
      (message) =>
        (searchAsks.length > 0
          ? (searchScope === "mailbox"
              ? inMailbox(message)
              : ((message.mailbox !== "trash" && message.mailbox !== trashBox) ||
                  settings.searchTrash === true) &&
                (message.mailbox !== "junk" || settings.searchJunk === true)) &&
            (meetsConditions(message, searchAsks, true, now) ||
              (wholeTextHits.has(message.id) &&
                meetsConditions(
                  message,
                  searchAsks.filter((ask) => ask.field !== "message"),
                  true,
                  now,
                )))
          : inMailbox(message)) &&
        // The filter narrows a mailbox and a search alike. Under it what is selected stays until
        // another is selected: selecting a message is what read it.
        (!filterOn ||
          selectedIds.includes(message.id) ||
          filters.every((filter) => meets(message, filter, me, vips))),
    );
    return found.sort((a, b) => {
      const order =
        sort === "date"
          ? a.time - b.time
          : sortText(a, sort, own).localeCompare(sortText(b, sort, own));
      return (ascending ? 1 : -1) * order || b.time - a.time;
    });
  }, [
    messages,
    mailbox,
    searchAsks,
    wholeTextHits,
    searchScope,
    sort,
    ascending,
    filterOn,
    filters,
    me,
    settings,
    selectedIds,
    own,
    listed,
    vips,
    trashBox,
  ]);

  // Conversations, always known: Mute acts on one whether the list shows them or not.
  const threads = useMemo(() => threadsOf(messages, me), [messages, me]);
  const rows = useMemo<readonly MailRow[]>(
    () =>
      conversations && !searching && mailbox !== "drafts"
        ? conversationRows(visible, threads, expanded)
        : visible.map((message) => ({ kind: "message", message, child: false })),
    [conversations, searching, mailbox, visible, threads, expanded],
  );
  // A closed conversation is selected whole or not at all: one that is closed with a message of it
  // selected, or that new mail joins, stays selected whole.
  useEffect(() => {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      for (const row of rows) {
        if (row.kind !== "thread" || row.expanded) continue;
        if (row.members.some((member) => next.has(member.id))) {
          for (const member of row.members) next.add(member.id);
        }
      }
      return next.size === ids.length ? ids : [...next];
    });
  }, [rows]);
  const chosen = useMemo(
    () => visible.filter((message) => selectedIds.includes(message.id)),
    [visible, selectedIds],
  );
  // What another app may ask of this viewer (Automator's Get Selected Mail Items).
  const [selectionOwner] = useState(() => ({}));
  useEffect(() => {
    publishMailSelection(
      selectionOwner,
      chosen.map(({ subject, from }) => ({ subject, from })),
    );
  }, [chosen, selectionOwner]);
  useEffect(() => () => clearMailSelection(selectionOwner), [selectionOwner]);
  // The row of the conversation chosen whole: the pane then shows all of it.
  const threadRow = useMemo(() => {
    if (chosen.length === 0) return undefined;
    const found = rows.find(
      (row) =>
        row.kind === "thread" &&
        row.members.length === chosen.length &&
        row.members.every((member) => chosen.includes(member)),
    );
    return found?.kind === "thread" ? found : undefined;
  }, [rows, chosen]);
  // The message the pane shows and Reply answers: one selected, not several, or a conversation's newest.
  const selected = threadRow
    ? newestOf(threadRow.members)
    : chosen.length === 1
      ? (chosen[0] ?? null)
      : null;
  const stack = useMemo(() => {
    if (!threadRow) return null;
    const all = [...threadRow.members, ...threadRow.related];
    return all.sort((a, b) => (settings.recentFirst === false ? a.time - b.time : b.time - a.time));
  }, [threadRow, settings.recentFirst]);
  // The rows selected: a conversation chosen whole is its own row, not its messages under it.
  const selectedRows = useMemo(() => {
    let whole = false;
    return rows.flatMap((row) => {
      if (row.kind === "thread") {
        whole = row.members.every((member) => selectedIds.includes(member.id));
        return whole ? [rowId(row)] : [];
      }
      if (row.child && whole) return [];
      return selectedIds.includes(row.message.id) ? [rowId(row)] : [];
    });
  }, [rows, selectedIds]);
  const findPane = useRef<HTMLDivElement>(null);
  const find = useMailFind(findPane);
  const fontStyle = messageFontStyle(settings);
  const listFont = listFontStyle(settings);

  const update = (id: string, change: MailMessageChange) => {
    if (heldMessages) {
      const message = heldMessages.find((each) => each.id === id);
      const changed = Object.entries(change).some(
        ([key, value]) => message?.[key as keyof MailMessage] !== value,
      );
      if (message && changed) onMessageChange?.(id, change);
      return;
    }
    setMessages((all) =>
      all.map((message) => (message.id === id ? { ...message, ...change } : message)),
    );
  };
  // A change of messages the person can take back with Undo.
  const applyEdit = (edit: MailEdit) => {
    if (edit.entries.length === 0) return;
    setUndoStack((all) => [...all.slice(-19), edit]);
    setRedoStack([]);
    for (const [id, change] of edit.entries) update(id, change);
  };
  const undo = () => {
    const edit = undoStack.at(-1);
    if (!edit) return;
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack((all) => [...all, edit]);
    for (const [id, , back] of edit.entries) update(id, back);
  };
  const redo = () => {
    const edit = redoStack.at(-1);
    if (!edit) return;
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack((all) => [...all, edit]);
    for (const [id, change] of edit.entries) update(id, change);
  };
  // Selecting one message reads it; selecting several reads none.
  const selectIds = (ids: readonly string[]) => {
    setSelectedIds(ids);
    const [only] = ids;
    if (only !== undefined && ids.length === 1) update(only, { unread: false });
  };
  // The rows the person chose. A conversation shown in one row is its messages, and is read by that.
  const chooseRows = (ids: readonly string[]) => {
    const chosenRows = rows.filter((row) => ids.includes(rowId(row)));
    setSelectedIds([
      ...new Set(chosenRows.flatMap((row) => messagesOf(row).map((message) => message.id))),
    ]);
    const [only] = chosenRows;
    if (ids.length !== 1 || !only) return;
    if (only.kind === "message") update(only.message.id, { unread: false });
    else for (const each of [...only.members, ...only.related]) update(each.id, { unread: false });
  };
  const select = (id: string | null) => {
    const closed = rows.find(
      (row) =>
        row.kind === "thread" && !row.expanded && row.members.some((member) => member.id === id),
    );
    if (closed) chooseRows([rowId(closed)]);
    else selectIds(id === null ? [] : [id]);
  };
  const toggleThread = useCallback(
    (id: string, open: boolean) =>
      setExpanded((now) => {
        const next = new Set(now);
        if (open) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  const chooseMailbox = (next: MailboxId) => {
    mailboxChosen.current = true;
    setSavedMailbox(null);
    setMailbox(next);
    setQuery("");
    setTokens([]);
    select(null);
    onMailboxChange?.(next);
  };
  // Spotlight asks with the message's id, a notification with `message-` before it (mail/mod.rs):
  // its mailbox, with it selected, once it is listed.
  const [askedMessage, setAskedMessage] = useState<string | null>(null);
  useOpenItemRequests("mail", ({ id }) => setAskedMessage(id.replace(/^message-/, "")));
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the request or the messages arriving ask this again
  useEffect(() => {
    if (!askedMessage) return;
    const found = messages.find((message) => message.id === askedMessage);
    if (!found) return;
    setAskedMessage(null);
    chooseMailbox(found.mailbox);
    select(found.id);
  }, [askedMessage, messages]);
  // A mailbox deleted, here or in another browser of the person, is not one to keep showing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the list or the mailbox asks this again
  useEffect(() => {
    if (
      (isOwnMailbox(mailbox) && !own.some((box) => box.id === mailbox)) ||
      (isSmartMailbox(mailbox) && !listed.some((box) => box.id === mailbox))
    ) {
      chooseMailbox("inbox");
    }
  }, [own, listed, mailbox]);
  // The window opens as the person left it, once their values are known.
  const valuesLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!keepsView || !valuesLoaded || restored) return;
    const values = desktopValues();
    const view = readMailView(values[MAIL_VIEW]);
    const kept = readMailSettings(values[MAIL_SETTINGS]);
    if (kept) setSettings((now) => ({ ...now, ...kept }));
    if (view) {
      setSort(view.sort);
      setConversations(view.conversations);
      setDirection(view.ascending);
      setFilterOn(view.filterOn);
      setFilters(view.filters);
      setFavoritesShown(view.favorites);
      setToolbarShown(view.toolbar !== false);
      setHiddenTools(readHiddenTools(view.toolbarHidden));
      if (view.boxOrder) setBoxOrder(view.boxOrder);
      if (view.favoriteBoxes) setFavoriteBoxes(view.favoriteBoxes);
      setSidebarSize(view.sidebar);
      setListSize(view.list);
      if (view.classicList !== undefined) setClassicList(view.classicList);
      if (!mailboxChosen.current) setSavedMailbox(view.mailbox as MailboxId);
    }
    setRestored(true);
  }, [keepsView, valuesLoaded, restored]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the list of mailboxes arriving asks this again
  useEffect(() => {
    if (!savedMailbox || askedMessage) return;
    if (isOwnMailbox(savedMailbox) && !own.some((box) => box.id === savedMailbox)) return;
    if (isSmartMailbox(savedMailbox) && !listed.some((box) => box.id === savedMailbox)) return;
    chooseMailbox(savedMailbox);
  }, [savedMailbox, askedMessage, own, listed]);
  // A divider dragged saves where it ends; anything else saves at once. What is still waiting goes
  // when the window closes or the page goes away.
  const keepNow = useRef<(() => void) | null>(null);
  const keptSizes = useRef("");
  useEffect(() => {
    if (!restored) return;
    const view: MailView = {
      mailbox: savedMailbox ?? mailbox,
      sort,
      ascending: direction,
      filterOn,
      filters,
      favorites: favoritesShown,
      toolbar: toolbarShown,
      toolbarHidden: hiddenTools,
      boxOrder,
      favoriteBoxes,
      sidebar: sidebarSize,
      list: listSize,
      classicList,
      conversations,
    };
    keepNow.current = () => {
      if (secondViewer) return;
      keepMailValue(MAIL_VIEW, view);
      keepMailValue(MAIL_SETTINGS, settings);
    };
    const sizes = `${sidebarSize} ${listSize}`;
    const dragging = keptSizes.current !== "" && keptSizes.current !== sizes;
    keptSizes.current = sizes;
    if (!dragging) {
      keepNow.current();
      return;
    }
    const timer = setTimeout(() => keepNow.current?.(), 500);
    return () => clearTimeout(timer);
  }, [
    restored,
    savedMailbox,
    mailbox,
    sort,
    direction,
    filterOn,
    filters,
    favoritesShown,
    toolbarShown,
    hiddenTools,
    boxOrder,
    favoriteBoxes,
    sidebarSize,
    listSize,
    classicList,
    conversations,
    settings,
    secondViewer,
  ]);
  useEffect(() => {
    const flush = () => keepNow.current?.();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  // Undo, Redo and Move Again never send a message to a mailbox that has gone: what names one is
  // dropped with it.
  useEffect(() => {
    const listed = (box: MailboxId | null | undefined) =>
      !box || !isOwnMailbox(box) || own.some((each) => each.id === box);
    const keeps = (edit: MailEdit) =>
      edit.entries.every(([, change, back]) => listed(change.mailbox) && listed(back.mailbox));
    setUndoStack((stack) => (stack.every(keeps) ? stack : stack.filter(keeps)));
    setRedoStack((stack) => (stack.every(keeps) ? stack : stack.filter(keeps)));
    setLastMove((box) => (listed(box) ? box : null));
  }, [own]);
  // Why a mailbox other than `except` cannot be called `name`, or `null` when it can.
  const nameRefusal = (name: string, except?: MailboxId) =>
    [...MAILBOXES, ...own, ...smart].some(
      (box) => box.id !== except && box.name.toLowerCase() === name.toLowerCase(),
    )
      ? `Mail already has a mailbox named “${name}”.`
      : null;
  const saveSmart = (draft: SmartDraft) => {
    const { id } = draft;
    if (id) {
      keepSmart(smart.map((box) => (box.id === id ? { ...draft, id } : box)));
      return;
    }
    const made: SmartMailbox = { ...draft, id: `smart-${crypto.randomUUID()}` };
    keepSmart([...smart, made]);
    chooseMailbox(made.id);
  };
  const duplicateSmart = (box: SmartMailbox) => {
    let name = `${box.name} Copy`;
    for (let more = 2; nameRefusal(name) !== null; more += 1) name = `${box.name} Copy ${more}`;
    const made: SmartMailbox = { ...box, id: `smart-${crypto.randomUUID()}`, name };
    keepSmart([...smart, made]);
    chooseMailbox(made.id);
  };
  // The answer to New Mailbox or Rename Mailbox: `null` once it is done, or why not.
  const nameMailbox = async (name: string): Promise<string | null> => {
    const renaming = naming !== "new" ? naming : null;
    const taken = nameRefusal(name, renaming?.id);
    if (taken) return taken;
    if (heldMessages) {
      const asked = renaming ? onRenameMailbox?.(renaming.id, name) : onCreateMailbox?.(name);
      return (await asked) ?? null;
    }
    setOwnHere((all) =>
      renaming
        ? all.map((box) => (box.id === renaming.id ? { ...box, name } : box))
        : [...all, { id: `box-${crypto.randomUUID()}`, name }],
    );
    return null;
  };
  const deleteMailbox = (box: OwnMailbox) => {
    if (heldMessages) {
      onDeleteMailbox?.(box.id);
      return;
    }
    for (const message of messages) {
      if (message.mailbox === box.id) update(message.id, { mailbox: "trash" });
    }
    setOwnHere((all) => all.filter((each) => each.id !== box.id));
  };
  // The row that takes the place of `leaving`: the next one under the last of them, or else the
  // nearest above.
  const afterLeaving = (leaving: readonly MailMessage[]) => {
    const last = Math.max(...leaving.map((message) => visible.indexOf(message)));
    const stays = (message: MailMessage) => !leaving.includes(message);
    return (visible.slice(last + 1).find(stays) ?? visible.slice(0, last).findLast(stays))?.id;
  };
  // Moving messages selects the one that takes the selection's place in the list. All of them go
  // or none: a move the server refuses for one (`moveRefusal`) is not made.
  const moveMessages = (from: readonly MailMessage[], to: MailboxId, label: string) => {
    if (from.length === 0 || from.some((message) => moveRefusal(message, to) !== undefined)) return;
    const moving = from;
    const next = afterLeaving(moving);
    applyEdit({
      label,
      entries: moving.map((message) => [message.id, { mailbox: to }, { mailbox: message.mailbox }]),
    });
    if (moving.some((message) => selectedIds.includes(message.id))) select(next ?? null);
  };
  const moveSelected = (to: MailboxId) => {
    moveMessages(chosen, to, "Move");
    if (to !== "trash" && to !== "junk") setLastMove(to);
  };
  const erase = (doomed: readonly MailMessage[]) => {
    // The server erases only from its own Trash, so a mailbox standing in for it hands them there first.
    for (const message of doomed) {
      if (message.mailbox === trashBox && trashBox !== "trash") {
        update(message.id, { mailbox: "trash" });
      }
    }
    if (heldMessages) {
      for (const message of doomed) onErase?.(message.id);
      return;
    }
    const gone = new Set(doomed.map((message) => message.id));
    setMessages((all) => all.filter((message) => !gone.has(message.id)));
  };
  // To the Trash, or the mailbox standing in for it.
  const moveToTrash = (from: readonly MailMessage[], label: string) => {
    moveMessages(
      from.filter((message) => trashOf(message) === trashBox),
      trashBox,
      label,
    );
    if (trashBox !== "trash") {
      moveMessages(
        from.filter((message) => trashOf(message) === "trash"),
        "trash",
        label,
      );
    }
  };
  // Delete: to the Trash, or, for what the Trash holds already, erased for good.
  const deleteSelected = () => {
    const trashed = chosen.filter(inTrash);
    if (trashed.length === 0) {
      moveToTrash(chosen, "Delete");
      return;
    }
    if (heldMessages && !onErase) return;
    const next = afterLeaving(chosen);
    erase(trashed);
    moveToTrash(
      chosen.filter((message) => !inTrash(message)),
      "Delete",
    );
    select(next ?? null);
  };
  // `text`, or the messages selected. A message the list holds may be only its start: the whole text
  // is read first, and a text that cannot be read copies nothing rather than part of it.
  const copyToClipboard = async (text?: string) => {
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (!clipboard) throw new Error("no clipboard");
    if (text) {
      await clipboard.writeText(text);
      return;
    }
    const bodies = await Promise.all(
      chosen.map((message) => (resolveBody ? resolveBody(message) : message.body)),
    );
    if (bodies.some((body) => body === null)) throw new Error("a text was not read");
    await clipboard.writeText(
      chosen
        .map((message, index) => `${message.from}\n${message.subject}\n\n${bodies[index]}`)
        .join("\n\n"),
    );
  };
  // Erase Deleted Items and Erase Junk Mail, once the alert is answered. Junk goes to the Trash
  // first, which is what the server erases from.
  const eraseMailbox = (box: "trash" | "junk") => {
    const doomed = messages.filter((message) =>
      box === "trash" ? inTrash(message) : message.mailbox === box,
    );
    if (box === "junk") for (const message of doomed) update(message.id, { mailbox: "trash" });
    erase(doomed);
    if (doomed.some((message) => selectedIds.includes(message.id))) select(null);
  };
  // A second New Message while one is open: that window comes forward, even from behind the viewer
  // or out of the Dock.
  const [composeAsked, setComposeAsked] = useState(0);
  const bringComposeForward = () => {
    setWanted("compose");
    setComposeAsked((asked) => asked + 1);
  };
  const newMessageTab = () => openNew(EMPTY_DRAFT);
  const openCompose = (
    draft: MailDraft,
    draftId?: string,
    shared = false,
    started: {
      original?: string;
      keepsOriginal?: boolean;
      signature?: MailSignature | null;
    } = {},
  ) => {
    // A window the owner holds is never replaced: what it holds would be lost.
    if (heldMessages && composeNow.current) {
      bringComposeForward();
      return;
    }
    nextComposeKey.current += 1;
    const slot = (composeNow.current?.slot ?? 0) + 1;
    const next = {
      draft,
      key: nextComposeKey.current,
      slot,
      focus: true,
      draftId,
      shared,
      ...started,
    };
    composeNow.current = next;
    setCompose(next);
    setWanted("compose");
    onComposeChange?.(true, draftId);
  };
  // A message the person starts: with their signature. It has no HTML yet, by its type: a draft with
  // HTML is one reopened, which holds its signature already, and goes to `openCompose`.
  const openNew = (
    draft: StartedDraft,
    original?: string,
    shared = false,
    keepsOriginal = false,
  ) => {
    if (heldMessages && composeNow.current) {
      bringComposeForward();
      return;
    }
    if (signatures.chosen === SEQUENTIAL_SIGNATURE && signatures.list.length > 0) {
      keepSignatures({ ...signatures, turn: signatures.turn + 1 });
    }
    const chosen = signatureFor(signatures, Math.random());
    const signature = chosen?.text.trim() ? chosen : null;
    const copied =
      settings.ccMyself === true &&
      me !== "" &&
      ![...draft.to, ...draft.cc].some((each) => addressKey(each) === addressKey(me));
    openCompose(
      {
        ...draft,
        ...(settings.messageFormat === "Plain Text" ? { plain: true } : {}),
        cc: copied ? [...draft.cc, me] : draft.cc,
        body: withSignature(draft.body, signature, settings.signatureAbove !== false),
      },
      undefined,
      shared,
      { original, keepsOriginal, signature },
    );
  };
  // Closes the window numbered `key` (the one open, without it): a late answer for a window
  // closed since never closes, or reports closing, a newer one.
  const closeCompose = (key?: number) => {
    const current = composeNow.current;
    if (!current || (key !== undefined && current.key !== key)) return;
    composeNow.current = null;
    setComposeIsKey(false);
    // The next window's first close from the desktop goes through its checks again.
    composeClosing.current = false;
    setCompose(null);
    onComposeChange?.(false);
  };
  // Links shared with Mail: each opens a New Message window of its own, with the page's title as
  // its subject and its address as its text. One that comes while a window is open waits here
  // until that window closes, so that what the window holds is never replaced.
  const sharedWaiting = useRef<StartedDraft[]>([]);
  const openShared = useRef<(draft: StartedDraft) => void>(() => {});
  openShared.current = (draft) => {
    if (composeNow.current) {
      sharedWaiting.current.push(draft);
      return;
    }
    openNew(draft, undefined, true);
  };
  // Files shared with Mail go into the New Message window, a new one if none is open.
  const shareFiles = useRef<(items: readonly DesktopDragItem[]) => void>(() => {});
  shareFiles.current = (items) => {
    const attaching = composeProps?.attaching;
    if (!attaching) return;
    if (!composeNow.current) openNew(EMPTY_DRAFT, undefined, true);
    attaching.drop(items);
  };
  // They wait in the desktop's queue until this Mail can attach files.
  const canAttachShared = composeProps?.attaching !== undefined;
  useEffect(() => {
    if (!takesSharedLinks || !canAttachShared) return;
    for (const shared of takeSharedFiles("mail")) shareFiles.current(shared.items);
    return onSharedFiles("mail", (shared) => shareFiles.current(shared.items));
  }, [takesSharedLinks, canAttachShared]);
  useEffect(() => {
    if (!takesSharedLinks) return;
    const linked = (link: SharedLink): StartedDraft => ({
      ...EMPTY_DRAFT,
      subject: link.title,
      body: link.url,
    });
    const addressed = ({ to, subject }: { to: string; subject?: string }): StartedDraft => ({
      ...EMPTY_DRAFT,
      to: [to],
      subject: subject ?? EMPTY_DRAFT.subject,
    });
    // Those asked for while Mail was closed, then each new one.
    for (const link of takeSharedLinks("mail")) openShared.current(linked(link));
    for (const request of takeAddressRequests("mail")) {
      openShared.current(addressed(request));
    }
    const stopLinks = onSharedLink("mail", (link) => openShared.current(linked(link)));
    const stopAddresses = onAddressRequest("mail", (request) =>
      openShared.current(addressed(request)),
    );
    return () => {
      stopLinks();
      stopAddresses();
    };
  }, [takesSharedLinks]);
  useEffect(() => {
    if (compose !== null) return;
    const next = sharedWaiting.current.shift();
    if (next) openShared.current(next);
  }, [compose]);
  // A saved draft, opened again, is a New Message window holding it: read completely first
  // when the owner can, so that closing it again never saves a shortened copy.
  const openDraft = (message: MailMessage) => {
    if (heldMessages && composeNow.current) {
      bringComposeForward();
      return;
    }
    if (resolveDraft) {
      void resolveDraft(message).then(
        (draft) => {
          // The server keeps no styled text for a plain message: a rich one always has some.
          if (draft) {
            openCompose({ ...draft, plain: draft.plain ?? draft.html === undefined }, message.id);
          }
        },
        () => {},
      );
      return;
    }
    openCompose(
      {
        to: message.toAddresses ?? message.to,
        cc: message.cc ?? [],
        bcc: message.bcc,
        replyTo: message.replyTo,
        priority: message.priority,
        subject: message.subject === "(No Subject)" ? "" : message.subject,
        body: message.body,
        html: message.html,
      },
      message.id,
    );
  };
  // The whole text of a message the list may hold only the start of, or `null` if it cannot be read.
  const wholeBody = async (message: MailMessage) =>
    resolveBody ? resolveBody(message) : message.body;
  const printMessages = (printing: readonly MailMessage[]) => {
    void Promise.all(printing.map(wholeBody)).then(
      (bodies) => {
        if (bodies.some((body) => body === null)) {
          setPrintFailed(true);
          return;
        }
        printDocument({
          name: printing[0]?.subject ?? "Mail",
          plain: false,
          lines: printing.flatMap((message, index) => [
            ...(index > 0 ? ["", ""] : []),
            `From: ${message.from}`,
            `Subject: ${message.subject}`,
            `Date: ${message.received}`,
            `To: ${message.to.join(", ")}`,
            ...(message.cc?.length ? [`Cc: ${message.cc.join(", ")}`] : []),
            "",
            ...(bodies[index] ?? "").split("\n"),
          ]),
        });
      },
      () => setPrintFailed(true),
    );
  };
  const saveToFile = (
    saving: readonly MailMessage[],
    write: (bodies: readonly string[]) => [text: string, type: string, name: string],
  ) => {
    const failed = () =>
      setFileProblem({
        title: "The file could not be made.",
        text: "The whole text of a message could not be read. Nothing was saved.",
      });
    void wholeBodies(saving, wholeBody).then((bodies) => {
      if (!bodies) {
        failed();
        return;
      }
      const [text, type, name] = write(bodies);
      downloadBlob(new Blob([text], { type }), name);
    }, failed);
  };
  // File > Import Mailboxes: an mbox file into a mailbox of its name.
  const importFile = async (file: File) => {
    const found = parseMbox(await file.text(), Date.now());
    if (found.length === 0) {
      setFileProblem({
        title: `Mail found no messages in “${file.name}”.`,
        text: "Choose a file in the mbox format, as Export Mailbox writes.",
      });
      return;
    }
    const name = importedBoxName(file.name);
    const answer = await onImportMailbox?.(name, found);
    if (typeof answer === "string") {
      setFileProblem({ title: "The mailbox could not be imported.", text: answer });
    } else if (answer) {
      setFileProblem({
        title: `Imported ${answer.made} ${answer.made === 1 ? "message" : "messages"} into “${name}”.`,
        text:
          answer.refused === 0
            ? "Files attached to them are not read: their source stays in the message's text."
            : `${answer.refused} could not be kept: a message's text holds at most 100,000 characters.`,
      });
    }
  };
  const saveMessages = (saving: readonly MailMessage[]) => {
    const [only] = saving;
    saveToFile(saving, (bodies) =>
      only && saving.length === 1
        ? [rawMessage(only, bodies[0] ?? ""), "message/rfc822", `${fileNameOf(only.subject)}.eml`]
        : [mboxOf(saving, bodies), "application/mbox", "Messages.mbox"],
    );
  };
  const forwardAttached = (forwarding: readonly MailMessage[]) => {
    if (heldMessages && composeNow.current) {
      bringComposeForward();
      return;
    }
    const [first] = forwarding;
    const attaching = composeProps?.attaching;
    if (!first || !attaching) return;
    void wholeBodies(forwarding, wholeBody).then((bodies) => {
      if (!bodies) return;
      // A window opened while the text was read keeps what it holds: the forward gives way to it.
      if (composeNow.current) {
        bringComposeForward();
        return;
      }
      openNew({ ...EMPTY_DRAFT, subject: `Fwd: ${first.subject}` });
      attaching.takeFiles(
        forwarding.map(
          (message, index) =>
            new File(
              [rawMessage(message, bodies[index] ?? "")],
              `${fileNameOf(message.subject)}.eml`,
              { type: "message/rfc822" },
            ),
        ),
      );
    });
  };
  const redirectMessage = (message: MailMessage) => {
    if (heldMessages && composeNow.current) {
      bringComposeForward();
      return;
    }
    void wholeBody(message).then(
      (body) => {
        if (body !== null) openCompose({ ...EMPTY_DRAFT, subject: message.subject, body });
      },
      () => {},
    );
  };
  const reply = (kind: "reply" | "all" | "forward", to: MailMessage | null = selected) => {
    if (!to) return;
    // A reply is addressed by the user's own address: until it is known, only Forward works.
    if (kind !== "forward" && !me) return;
    if (heldMessages && composeNow.current) {
      bringComposeForward();
      return;
    }
    const message = to;
    if (resolveBody) {
      void resolveBody(message).then(
        (body) => {
          if (body !== null) replyWith(kind, message, body);
        },
        () => {},
      );
      return;
    }
    replyWith(kind, message, message.body);
  };
  // The reply, quoting `body`: the message's whole text.
  const replyWith = (kind: "reply" | "all" | "forward", selected: MailMessage, body: string) => {
    const original = `On ${selected.received}, ${selected.from} wrote:\n\n${body}`;
    // A window open already keeps what it holds, and is not this reply.
    const opened = composeNow.current !== null;
    const quotes = kind === "forward" || settings.quoteOriginal !== false;
    // People are the same by their mailbox (`name@host` inside `<…>`), whatever full name
    // goes with it.
    // The last `<…>`, as the server reads an address: a full name may hold angle brackets.
    const mailbox = addressKey;
    const mine = (address: string) => mailbox(address) === mailbox(me);
    const author = selected.fromAddress ?? selected.from;
    // A reply goes where the message asked; a message of one's own goes to its first recipient.
    const sender = mine(author) ? author : (selected.replyTo ?? author);
    const recipients = selected.toAddresses ?? selected.to;
    // A reply to all copies everyone else once, and nobody who is addressed already.
    const ownFirst = recipients[0] ?? selected.cc?.[0] ?? selected.bcc?.[0] ?? me;
    const to = kind === "forward" ? [] : [mine(author) ? ownFirst : sender];
    const others = [sender, ...recipients, ...(selected.cc ?? [])].filter(
      (name, index, all) =>
        !mine(name) &&
        !to.some((each) => mailbox(each) === mailbox(name)) &&
        all.findIndex((each) => mailbox(each) === mailbox(name)) === index,
    );
    openNew(
      {
        to,
        cc: kind === "all" ? others : [],
        subject: `${kind === "forward" ? "Fwd" : "Re"}: ${selected.subject.replace(/^(Re|Fwd): /, "")}`,
        body: quotes ? `\n\n${original}` : "",
      },
      original,
      false,
      kind === "forward",
    );
    if (!opened && composeNow.current) {
      composeNow.current = { ...composeNow.current, repliesTo: selected };
      setCompose(composeNow.current);
    }
  };
  const send = (draft: MailDraft) => {
    if (heldMessages) {
      if (!onSend || sendingHere) return;
      const current = compose;
      // The window stays frozen until the owner answers: nothing typed meanwhile is lost.
      setSendingHere(true);
      // Called inside the promise, so a handler that throws unfreezes the window too.
      void saves.current
        .then(() =>
          onSend(draft, {
            draftId: composeNow.current?.draftId ?? current?.draftId,
            ...(sentBox === "sent" ? {} : { sentBox }),
          }),
        )
        .then(
          (sent) => {
            if (sent) {
              closeCompose(current?.key);
              if (sent !== "kept" && !offline) playMailAction("sent", settings.playSounds);
            }
          },
          () => {},
        )
        .finally(() => setSendingHere(false));
      return;
    }
    const now = new Date();
    setMessages((all) => [
      ...all,
      {
        id: `sent-${all.length}-${now.getTime()}`,
        mailbox: sentBox,
        from: ME,
        to: [...draft.to, ...draft.cc],
        subject: draft.subject.trim() || "(No Subject)",
        date: now.toLocaleDateString("en-US", { dateStyle: "short" }),
        received: `${now.toLocaleDateString("en-US", { dateStyle: "long" })} at ${now.toLocaleTimeString("en-US", { timeStyle: "short" })}`,
        time: all.reduce((latest, message) => Math.max(latest, message.time), 0) + 1,
        body: draft.body,
      },
    ]);
    closeCompose();
  };
  // Closing a New Message window keeps it as a draft, with an owner, who decides what is worth
  // keeping and whether the window may close.
  const draftClose =
    heldMessages && onSaveDraft && compose
      ? (draft: MailDraft) =>
          onAutosaveDraft
            ? saves.current.then(() =>
                Promise.resolve(onSaveDraft(draft, composeNow.current?.draftId)).then(
                  (kept) => kept !== false,
                ),
              )
            : onSaveDraft(draft, compose.draftId)
      : undefined;

  // What the rules make of a message: each move is checked as it comes, so that a later rule sees
  // the message where it really is. A mailbox gone, or one the server refuses (`moveRefusal`), is no move.
  const rulesChange = (message: MailMessage): MailMessageChange | null =>
    ruleChange(
      message,
      rules,
      Date.now(),
      (now, box) =>
        (!isOwnMailbox(box) || own.some((each) => each.id === box)) &&
        moveRefusal(now, box) === undefined,
    );
  // Message > Apply Rules, and the answer to the question Add Rule asks: Undo takes it back.
  const applyRulesTo = (some: readonly MailMessage[]) => {
    const entries = some.flatMap((message): MailEdit["entries"] => {
      const change = rulesChange(message);
      if (!change) return [];
      const back: MailMessageChange = {};
      if ("unread" in change) back.unread = message.unread === true;
      if ("flag" in change) back.flag = message.flag;
      if ("mailbox" in change) back.mailbox = message.mailbox;
      return [[message.id, change, back]];
    });
    const leaving = some.filter((message) =>
      entries.some(([id, change]) => id === message.id && change.mailbox !== undefined),
    );
    const next = leaving.length > 0 ? afterLeaving(leaving) : undefined;
    applyEdit({ label: "Apply Rules", entries });
    if (leaving.some((message) => selectedIds.includes(message.id))) select(next ?? null);
  };
  // New Inbox mail runs the rules once. The server marks each message it delivers and ends the mark
  // with the change the rules made, so the rules take as many messages as arrive, however long the
  // browser was away, and another browser of the person's finds them done. A new message of a muted
  // conversation is muted too. A change the server refuses leaves the mark: this window asks once,
  // and the next one to open runs it.
  const rulesAsked = useRef(new Set<string>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: only mail arriving, or the rules being known, asks this again
  useEffect(() => {
    if (keepsView && !valuesLoaded) return;
    const taught = settings.junkFilter === true ? learnJunk(messages, junkBox) : null;
    const exempt = new Set([
      ...(settings.junkContacts === true ? contacts.map(addressKey) : []),
      ...(settings.junkPrevious === true ? recipients.map((person) => person.address) : []),
      addressKey(me),
    ]);
    const arrived: string[] = [];
    for (const message of messages) {
      if (!message.rulesPending || rulesAsked.current.has(message.id)) continue;
      rulesAsked.current.add(message.id);
      arrivals.current += 1;
      const mutedThread = threads
        .get(message.id)
        ?.messages.some((each) => each.id !== message.id && each.muted);
      const change = {
        ...(taught && isJunk(taught, message, exempt) ? { mailbox: junkBox } : {}),
        ...rulesChange(message),
        ...(mutedThread ? { muted: true } : {}),
        ...(mutedThread && settings.archiveMuted === true ? { mailbox: archiveBox } : {}),
        ...(settings.blockedToTrash === true &&
        blocked.some(({ address }) => address === addressKey(message.fromAddress ?? message.from))
          ? { mailbox: "trash" as const }
          : {}),
        rulesPending: false,
      };
      update(message.id, change);
      if ((change.mailbox ?? message.mailbox) === "inbox" && !(change.muted ?? message.muted)) {
        arrived.push(message.id);
      }
    }
    soundNewMail(arrived, settings.sound);
    // Preferences > General > Add invitations to Calendar automatically. One viewer does it, with no
    // other viewer's copy to bring the same file twice.
    if (settings.invitations === true && takesSharedLinks && attachmentFiles) {
      const files = filesOf(messages.filter((message) => arrived.includes(message.id)));
      if (files.some(isCalendarFile)) void addToCalendar(files);
    }
  }, [messages, keepsView, valuesLoaded]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only Get Mail ending asks this again
  useEffect(() => {
    if (checks > 0 || arrivalsAtGetMail.current === null) return;
    if (arrivals.current === arrivalsAtGetMail.current) {
      playMailAction("noMail", settings.playSounds);
    }
    arrivalsAtGetMail.current = null;
  }, [checks]);
  // Search: a token the person finished, taken out of the words typed.
  const addToken = (token: SearchToken, rest = "") => {
    if (!searching) select(null);
    setTokens((all) => [...all, token]);
    setQuery(rest);
    setSuggestion(-1);
  };
  const suggestions: readonly SearchToken[] =
    searchFocused && query.trim() !== "" && !wholeToken(query)
      ? [
          { field: "from", value: query.trim() },
          { field: "subject", value: query.trim() },
        ]
      : [];

  const counts = useMemo(() => {
    const result = {} as Record<MailboxId, { all: number; unread: number }>;
    for (const { id } of [...SIDEBAR_MAILBOXES, ...own, ...listed]) {
      result[id] = { all: 0, unread: 0 };
    }
    const now = Date.now();
    for (const message of messages) {
      const count = result[message.mailbox];
      if (count) {
        count.all += 1;
        if (message.unread) count.unread += 1;
      }
      for (const box of listed) {
        const tally = result[box.id];
        if (!tally || !inSmartMailbox(message, box, now)) continue;
        tally.all += 1;
        if (message.unread) tally.unread += 1;
      }
    }
    return result;
  }, [messages, own, listed]);
  const shown = SIDEBAR_MAILBOXES.filter(
    ({ id, always }) => always || counts[id].all > 0 || id === mailbox,
  );
  const badge = (id: MailboxId) =>
    (id === "drafts" || id === "outbox" ? counts[id].all : counts[id]?.unread) ?? 0;

  const renderRow = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return null;
      const thread = row.kind === "thread" ? row : null;
      const held = thread ? newestOf(thread.members) : (row as { message: MailMessage }).message;
      const message = settings.smartAddresses === false ? showingAddresses(held) : held;
      const all = thread ? thread.members : [held];
      const child = row.kind === "message" && row.child;
      const flag = all.find((each) => each.flag)?.flag;
      const addressed = meets(held, "to-me", me, vips)
        ? "To"
        : meets(held, "cc-me", me, vips)
          ? "Cc"
          : null;
      if (settings.classicLayout === true) {
        return (
          <>
            {all.some((each) => each.unread) ? (
              <ListViewRowLeading>
                <NewItemDot aria-label="Unread" />
              </ListViewRowLeading>
            ) : null}
            <ListViewRowTitle className="mac-mail-classic-row">
              <span className="mac-mail-classic-from">
                {thread && thread.members.length > 1 ? (
                  <DisclosureTriangle
                    aria-label={`${thread.expanded ? "Collapse" : "Expand"} Conversation`}
                    expanded={thread.expanded}
                    className="mac-mail-row-disclosure"
                    onMouseDown={(event) => event.preventDefault()}
                    onDoubleClick={(event) => event.preventDefault()}
                    onExpandedChange={(open) => toggleThread(thread.thread.id, open)}
                  />
                ) : null}
                <span className="mac-mail-row-name">{message.from}</span>
                {flag ? (
                  <TagDot color={flag} size="small" aria-label={`${capitalize(flag)} flag`} />
                ) : null}
              </span>
              <span className="mac-mail-classic-subject">{message.subject}</span>
              <span className="mac-mail-classic-date">{message.date}</span>
            </ListViewRowTitle>
          </>
        );
      }
      return (
        <>
          {all.some((each) => each.unread) ? (
            <ListViewRowLeading>
              <NewItemDot aria-label="Unread" />
            </ListViewRowLeading>
          ) : null}
          <ListViewRowTitle
            className={child ? "mac-mail-row-sender mac-mail-row-child" : "mac-mail-row-sender"}
          >
            {thread && thread.members.length > 1 ? (
              <DisclosureTriangle
                aria-label={`${thread.expanded ? "Collapse" : "Expand"} Conversation`}
                expanded={thread.expanded}
                className="mac-mail-row-disclosure"
                onMouseDown={(event) => event.preventDefault()}
                onDoubleClick={(event) => event.preventDefault()}
                onExpandedChange={(open) => toggleThread(thread.thread.id, open)}
              />
            ) : null}
            {settings.contactPhotos === true ? (
              <span className="mac-mail-row-photo" aria-hidden="true">
                {message.from.charAt(0)}
              </span>
            ) : null}
            <span className="mac-mail-row-name">{message.from}</span>
            {settings.showToCc === true && addressed ? (
              <span className="mac-mail-row-tocc">{addressed}</span>
            ) : null}
            {vips.some((vip) => vip.address === addressKey(message.fromAddress ?? message.from)) ? (
              <span role="img" aria-label="VIP" className="mac-mail-row-mark">
                <MailGlyph name="vip" size={12} />
              </span>
            ) : null}
            {all.some((each) => each.muted) ? (
              <span role="img" aria-label="Muted" className="mac-mail-row-mark">
                <MailGlyph name="mute" size={12} />
              </span>
            ) : null}
            {message.attachmentCount ? (
              <span
                role="img"
                aria-label={
                  message.attachmentCount === 1
                    ? "1 attachment"
                    : `${message.attachmentCount} attachments`
                }
                className="mac-mail-row-mark"
              >
                <MailGlyph name="attach" size={12} />
              </span>
            ) : null}
            {message.priority ? (
              <span
                role="img"
                aria-label={message.priority === "high" ? "High priority" : "Low priority"}
                className="mac-mail-row-mark"
              >
                {message.priority === "high" ? "!!" : "↓"}
              </span>
            ) : null}
            {flag ? (
              <TagDot color={flag} size="small" aria-label={`${capitalize(flag)} flag`} />
            ) : null}
            {thread ? (
              <span
                role="img"
                aria-label={`${thread.members.length + thread.related.length} messages`}
                className="mac-mail-row-count"
              >
                {thread.members.length + thread.related.length}
              </span>
            ) : null}
            <span className="mac-mail-row-date">{message.date}</span>
          </ListViewRowTitle>
          <div
            className={child ? "mac-mail-row-subject mac-mail-row-child" : "mac-mail-row-subject"}
          >
            {message.subject}
          </div>
          {child ? null : (
            <ListViewRowDetail>
              <span className="mac-mail-row-preview">{firstLine(message.body)}</span>
            </ListViewRowDetail>
          )}
        </>
      );
    },
    [
      rows,
      vips,
      me,
      settings.contactPhotos,
      settings.classicLayout,
      settings.showToCc,
      settings.smartAddresses,
      toggleThread,
    ],
  );
  const rowHeight = useMemo(
    () =>
      settings.classicLayout === true
        ? CLASSIC_ROW_HEIGHT
        : rows.some((row) => row.kind === "message" && row.child)
          ? (index: number) => {
              const row = rows[index];
              return row?.kind === "message" && row.child ? CHILD_ROW_HEIGHT : 70;
            }
          : 70,
    [rows, settings.classicLayout],
  );

  // The other windows open over the viewer, in the element that positions it.
  const root = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<{ element: HTMLElement; left: number; top: number } | null>(
    null,
  );
  const others = ownCompose || preferences;
  // After every render while one of them is open, so that they follow a viewer that its
  // owner moves (`style`, a window manager's frame); nothing is set while nothing changed.
  useLayoutEffect(() => {
    const element = root.current;
    if (!others || !element) return;
    const view = element.ownerDocument.defaultView;
    const frame = element.getBoundingClientRect();
    const offsetParent = element.offsetParent instanceof HTMLElement ? element.offsetParent : null;
    const parent = windowsContainer ?? offsetParent;
    const inside = parent !== null && parent !== element.ownerDocument.body;
    const box = inside ? parent.getBoundingClientRect() : null;
    const next = {
      element: inside ? parent : element.ownerDocument.body,
      left: box
        ? frame.left - box.left - (parent?.clientLeft ?? 0) + (parent?.scrollLeft ?? 0)
        : frame.left + (view?.scrollX ?? 0),
      top: box
        ? frame.top - box.top - (parent?.clientTop ?? 0) + (parent?.scrollTop ?? 0)
        : frame.top + (view?.scrollY ?? 0),
    };
    setHost((current) =>
      current &&
      current.element === next.element &&
      current.left === next.left &&
      current.top === next.top
        ? current
        : next,
    );
  });

  const openCount = counts[mailbox]?.all ?? 0;
  // What the person's preferences say of every New Message window.
  const composeHabits = {
    signatures: signatures.list,
    signatureAbove: settings.signatureAbove !== false,
    original: compose?.original,
    keepsOriginal: compose?.keepsOriginal,
    startingSignature: compose?.signature,
    spellCheck: settings.spelling !== false,
    stationery,
    draftRef: composeDraft,
    onShowCharacters: DesktopWindow ? toggleCharacterViewer : undefined,
    onSpellCheckChange: (spelling: boolean) => setSettings((now) => ({ ...now, spelling })),
    originalFiles: compose?.repliesTo ? attachmentFiles?.(compose.repliesTo) : undefined,
    appendSelected:
      chosen.length > 0
        ? async () => {
            const bodies = await wholeBodies(chosen, wholeBody);
            return bodies ? appendedText(chosen, bodies) : null;
          }
        : null,
    onAddAddress: (written: string) => {
      const account = accountOf(written);
      if (account) askToReach({ app: "contacts", to: account.name, name: account.fullName });
    },
  };
  const title = searching
    ? `Searching “${searchScope === "all" ? "All Mailboxes" : mailboxName(mailbox, [...own, ...listed])}” (Found ${visible.length} ${visible.length === 1 ? "match" : "matches"})`
    : `${mailboxName(mailbox, [...own, ...listed])} (${openCount} ${openCount === 1 ? "message" : "messages"})`;
  const none = chosen.length === 0;
  const flagged = chosen.some((message) => message.flag);
  // Command-comma, or Control-comma off Apple platforms: the Preferences command, from any
  // of the app's windows.
  const preferencesShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "," && (event.metaKey || event.ctrlKey) && !event.defaultPrevented) {
      event.preventDefault();
      setPreferences(true);
      setWanted("preferences");
    }
  };

  // Why the messages chosen cannot go to `to`: all go or none, so the first one that cannot says.
  const groupRefusal = (to: MailboxId) => {
    if (none) return "No message is selected.";
    return chosen.map((message) => moveRefusal(message, to)).find(Boolean);
  };
  const setMuted = (muted: boolean) => {
    const thread = [
      ...new Set(chosen.flatMap((message) => threads.get(message.id)?.messages ?? [message])),
    ];
    applyEdit({
      label: muted ? "Mute" : "Unmute",
      entries: thread.map((message) => [message.id, { muted }, { muted: message.muted === true }]),
    });
  };
  const setFlag = (flag: MailMessage["flag"]) =>
    applyEdit({
      label: flag ? "Flag" : "Clear Flag",
      entries: chosen.map((message) => [message.id, { flag }, { flag: message.flag }]),
    });
  const senderAddress = selected ? addressKey(selected.fromAddress ?? selected.from) : "";
  const senderName = /^([^@\s]+)@macalicious$/.exec(senderAddress)?.[1];
  // The sender's account as the desktop answers for it now: mail outlives a deleted account.
  const [senderAccount, setSenderAccount] = useState<{
    asked: string;
    name: string;
    fullName: string;
  } | null>(null);
  const asksSender = Boolean(DesktopWindow) && senderAddress !== addressKey(me);
  const selectedId = selected?.id;
  useEffect(() => {
    setSenderAccount(null);
    if (!asksSender || !senderName || !selectedId) return;
    let current = true;
    lookupDesktopUser(senderName).then(
      (found) => {
        if (current) setSenderAccount({ asked: selectedId, ...found });
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [asksSender, senderName, selectedId]);
  const addSender =
    senderAccount && asksSender && senderAccount.asked === selectedId
      ? () => askToReach({ app: "contacts", to: senderAccount.name, name: senderAccount.fullName })
      : null;
  // The Favorites bar: what it was given, of the mailboxes there are now.
  const favorites = favoriteBoxes.flatMap((id) =>
    MAILBOXES.some((box) => box.id === id) ||
    own.some((box) => box.id === id) ||
    listed.some((box) => box.id === id)
      ? [{ id: id as MailboxId, name: mailboxName(id as MailboxId, [...own, ...listed]) }]
      : [],
  );
  // The files of `list`, each knowing its message: what Remove unedited downloads goes by.
  const filesOf = (list: readonly MailMessage[]): readonly MailFile[] =>
    list.flatMap((message) =>
      (attachmentFiles?.(message) ?? []).map((file) => ({ ...file, message: message.id })),
    );
  // The chosen messages' files: each kept in Downloads, and told of, then `after` with the first.
  const chosenFiles = filesOf(chosen);
  // Calendar imports what is on the drive, so each .ics goes to the downloads folder first.
  const addToCalendar = async (files: readonly MailFile[]) => {
    try {
      for (const file of files.filter(isCalendarFile)) {
        if (file.bytes) {
          const saved = await saveToDownloads(await file.bytes(), file.name, mailDownloadsFolder());
          noteMailDownload(saved, file.message);
          openFile(saved, "calendar");
        }
      }
    } catch (error) {
      setFileProblem({
        title: "The calendar file could not be read.",
        text: error instanceof Error ? error.message : "Try again.",
      });
    }
  };
  const keepChosenFiles = async (after?: (first: { id: string }) => void) => {
    const folder = mailDownloadsFolder();
    try {
      const saved = [];
      for (const file of chosenFiles) {
        if (file.bytes) {
          const entry = await saveToDownloads(await file.bytes(), file.name, folder);
          noteMailDownload(entry, file.message);
          saved.push(entry);
        }
      }
      const [first] = saved;
      if (after && first) after(first);
      else
        setFileProblem({
          title: `The attachments are in ${folder}.`,
          text: saved.map((each) => each.name).join(", "),
        });
    } catch (error) {
      setFileProblem({
        title: "The attachments could not be saved.",
        text: error instanceof Error ? error.message : "Try again.",
      });
    }
  };
  const senderIsBlocked = blocked.some((each) => each.address === senderAddress);
  const blockedBanner = (message: MailMessage) => {
    const address = addressKey(message.fromAddress ?? message.from);
    return blocked.some((each) => each.address === address) ? (
      <div className="mac-mail-blocked">
        <Label color="secondary">This message is from a sender you blocked.</Label>
        <PushButton
          size="small"
          onClick={() => keepBlocked(blocked.filter((each) => each.address !== address))}
        >
          Unblock
        </PushButton>
      </div>
    ) : undefined;
  };
  const recipients = previousRecipients(messages, removedRecipients);
  const commands: MailCommands = {
    chosen,
    one: selected,
    addSender,
    saveAttachments: chosenFiles.length > 0 ? () => void keepChosenFiles() : null,
    addToCalendar: chosenFiles.some(isCalendarFile) ? () => void addToCalendar(chosenFiles) : null,
    saveStationery: compose !== null && composeIsKey ? () => setNamingStationery(true) : null,
    importMailboxes: onImportMailbox ? () => importInput.current?.click() : null,
    customizeToolbar: () => setCustomizing(true),
    roles,
    assignMailbox: (role, box) =>
      keepRoles({ ...roles, [role]: roles[role] === box ? undefined : box }),
    removeAttachments:
      onRemoveAttachments &&
      chosen.some((message) => (message.attachmentCount ?? 0) > 0) &&
      chosen.every((message) => message.mailbox !== "drafts")
        ? () => setRemovingFiles(true)
        : null,
    quickLookAttachments:
      chosenFiles.length > 0
        ? () => void keepChosenFiles(({ id }) => showInFinder({ id, show: "quick-look" }))
        : null,
    rebuild: () => reading(() => (onRebuild ?? onGetMail)?.()),
    senderIsBlocked: selected && senderAddress !== addressKey(me) ? senderIsBlocked : null,
    toggleBlocked: () => {
      if (!selected || senderAddress === addressKey(me)) return;
      keepBlocked(
        senderIsBlocked
          ? blocked.filter((each) => each.address !== senderAddress)
          : [...blocked, { address: senderAddress, name: selected.from }],
      );
    },
    toolbarShown,
    toggleToolbar: () => setToolbarShown((shown) => !shown),
    showActivity: DesktopWindow ? () => showTool("activity") : null,
    showRecipients: DesktopWindow ? () => showTool("recipients") : null,
    showDoctor: DesktopWindow && onCheckConnection ? () => showTool("doctor") : null,
    senderIsVip:
      selected && senderAddress !== addressKey(me)
        ? vips.some((vip) => vip.address === senderAddress)
        : null,
    toggleVip: () => {
      if (!selected || senderAddress === addressKey(me)) return;
      keepVips(
        vips.some((vip) => vip.address === senderAddress)
          ? vips.filter((vip) => vip.address !== senderAddress)
          : [...vips, { address: senderAddress, name: selected.from }],
      );
    },
    ownSmart: smart.map((box) => box.id),
    canReply: Boolean(me),
    composing: compose !== null && composeIsKey,
    tabViewItems: <MailTabViewItems />,
    tabWindowItems: <MailTabWindowItems />,
    newMessage: () => openNew(EMPTY_DRAFT),
    attachFiles:
      compose !== null && composeIsKey && composeProps?.attaching?.available && !sendingHere
        ? () => composeAttach.current?.()
        : null,
    send: () => composeSend.current?.(),
    save: () => composeSave.current?.(),
    sendAgain: () => {
      if (selected?.mailbox !== "sent" && selected?.mailbox !== sentBox) return;
      const message = selected;
      const open = (body: string) =>
        openCompose({
          to: message.toAddresses ?? message.to,
          cc: message.cc ?? [],
          bcc: message.bcc,
          replyTo: message.replyTo,
          priority: message.priority,
          subject: message.subject,
          body,
        });
      if (!resolveBody) {
        open(message.body);
        return;
      }
      void resolveBody(message).then(
        (body) => {
          if (body !== null) open(body);
        },
        () => {},
      );
    },
    reply: (kind) => reply(kind),
    openMessages: DesktopWindow ? () => openMessages(chosen) : null,
    print: () => printMessages(chosen),
    newViewer: onNewViewer ?? null,
    share: {
      reason: chosen.length === 1 ? null : SELECT_ONE_TO_SHARE,
      address: chosen.length === 1 ? firstWebAddress(chosen[0]?.body ?? "") : null,
      copy: () => {
        const [message] = chosen;
        if (!message) return;
        void wholeBody(message).then((body) =>
          copyToClipboard(`${message.subject}\n\n${body ?? message.body}`),
        );
      },
      toApp: (app) => {
        const [message] = chosen;
        if (!message) return;
        void wholeBody(message).then(
          (body) => {
            const text = `${message.subject}\n\n${body ?? message.body}`;
            if (app === "notes") {
              shareText("notes", text);
              return;
            }
            handOverFiles(
              app,
              [
                {
                  id: `mail-text-${message.id}`,
                  name: `${fileNameOf(message.subject) || "Message"}.txt`,
                  kind: "file",
                  type: "text/plain",
                  size: new Blob([text]).size,
                  bytes: async () => new Blob([text], { type: "text/plain" }),
                },
              ],
              "mail",
            );
          },
          () =>
            setFileProblem({
              title: "The message could not be shared.",
              text: "Its text could not be read. Try again.",
            }),
        );
      },
      link: (app) => {
        const [message] = chosen;
        const address = firstWebAddress(message?.body ?? "");
        if (message && address) shareLink(app, address, message.subject, "mail");
      },
    },
    saveAs: () => saveMessages(chosen),
    exportMailbox: (id) => {
      if (moreToLoad) {
        setFileProblem({
          title: "Older messages are not loaded.",
          text: "Click Load More until every message is listed, then export the mailbox.",
        });
        return;
      }
      const box = listed.find((each) => each.id === id);
      const now = Date.now();
      const held = messages.filter((message) =>
        box ? inSmartMailbox(message, box, now) : message.mailbox === id,
      );
      const name = box?.name ?? mailboxName(id, own);
      saveToFile(held, (bodies) => [
        mboxOf(held, bodies),
        "application/mbox",
        `${fileNameOf(name)}.mbox`,
      ]);
    },
    copyRefusal: (to) => {
      if (none) return "No message is selected.";
      if (to === "drafts") return MOVE_TO_DRAFTS_UNAVAILABLE;
      if (chosen.some((message) => message.mailbox === "outbox")) return OUTBOX_MOVE_UNAVAILABLE;
      return chosen.some((message) => message.mailbox === "drafts")
        ? DRAFT_MOVE_UNAVAILABLE
        : undefined;
    },
    copyTo: (to) => {
      if (heldMessages) {
        onCopyMessages?.(chosen, to);
        return;
      }
      setMessages((all) => [
        ...all,
        ...chosen.map((message) => ({
          ...message,
          id: `${message.id}-copy-${crypto.randomUUID()}`,
          mailbox: to,
        })),
      ]);
    },
    forwardAttached: composeProps?.attaching ? () => forwardAttached(chosen) : null,
    redirect: () => {
      if (selected) redirectMessage(selected);
    },
    getMail,
    offline,
    toggleOffline: onToggleOffline,
    markRead: (read) =>
      applyEdit({
        label: read ? "Mark as Read" : "Mark as Unread",
        entries: chosen.map((message) => [
          message.id,
          { unread: !read },
          { unread: message.unread === true },
        ]),
      }),
    markJunk: () => moveMessages(chosen, junkBox, "Mark as Junk"),
    archive: () => moveMessages(chosen, archiveBox, "Archive"),
    moveRefusal: groupRefusal,
    move: moveSelected,
    lastMove,
    setFlag,
    setPriority: (priority) =>
      applyEdit({
        label: "Mark Priority",
        entries: chosen.map((message) => [
          message.id,
          { priority },
          { priority: message.priority },
        ]),
      }),
    setMuted,
    remove: deleteSelected,
    goTo: chooseMailbox,
    counts:
      trashBox === "trash"
        ? counts
        : {
            ...counts,
            trash: {
              ...counts.trash,
              all: counts.trash.all + (counts[trashBox]?.all ?? 0),
            },
          },
    current: mailbox,
    ownMailboxes: own,
    canCreateMailbox: !heldMessages || onCreateMailbox !== undefined,
    canRenameMailbox: !heldMessages || onRenameMailbox !== undefined,
    canDeleteMailbox: !heldMessages || onDeleteMailbox !== undefined,
    newMailbox: () => setNaming("new"),
    renameMailbox: (id) => {
      setRenamingSmart(smart.find((box) => box.id === id) ?? null);
      setNaming(own.find((box) => box.id === id) ?? null);
    },
    deleteMailbox: (id) => {
      setDeletingSmart(smart.find((box) => box.id === id) ?? null);
      setDeletingBox(own.find((box) => box.id === id) ?? null);
    },
    newSmartMailbox: () => setEditingSmart(NEW_SMART),
    editSmartMailbox: (id) => setEditingSmart(smart.find((box) => box.id === id) ?? null),
    duplicateSmartMailbox: (id) => {
      const box = smart.find((each) => each.id === id);
      if (box) duplicateSmart(box);
    },
    canErase: !heldMessages || onErase !== undefined,
    eraseDeleted: () => setErasing("trash"),
    eraseJunk: () => setErasing("junk"),
    markAllRead: (id) => {
      const box = listed.find((each) => each.id === id);
      const now = Date.now();
      applyEdit({
        label: "Mark All as Read",
        entries: messages
          .filter(
            (message) =>
              message.unread && (box ? inSmartMailbox(message, box, now) : message.mailbox === id),
          )
          .map((message) => [message.id, { unread: false }, { unread: true }]),
      });
    },
    sort,
    setSort: (next) => {
      setSort(next);
      setDirection(null);
    },
    ascending,
    setAscending: setDirection,
    filterOn,
    setFilterOn: (on) => {
      // The filtered list starts without a selection: what is selected is read.
      if (on) select(null);
      setFilterOn(on);
    },
    filters,
    toggleFilter: (filter) =>
      setFilters((all) =>
        all.includes(filter) ? all.filter((each) => each !== filter) : [...all, filter],
      ),
    listShown: sidebarSize > 0,
    toggleList: () => setSidebarSize(sidebarSize > 0 ? 0 : 200),
    favoritesShown,
    favorites,
    toggleFavorite: (id) => {
      if (!favoriteBoxes.includes(id)) setFavoritesShown(true);
      setFavoriteBoxes((all) =>
        all.includes(id) ? all.filter((each) => each !== id) : [...all, id],
      );
    },
    messageView:
      DesktopWindow && selected && sourceIds.includes(selected.id) ? "source" : messageView,
    toggleMessageView: (next) => {
      if (next !== "source" || !DesktopWindow) {
        setMessageView((now) => (now === next ? "default" : next));
      } else if (selected) {
        setSourceIds((all) =>
          all.includes(selected.id)
            ? all.filter((id) => id !== selected.id)
            : [...all, selected.id],
        );
      }
    },
    toggleFavorites: () => setFavoritesShown((shown) => !shown),
    undoLabel: undoStack.at(-1)?.label ?? null,
    redoLabel: redoStack.at(-1)?.label ?? null,
    undo,
    redo,
    copy: () => {
      void copyToClipboard(document.getSelection()?.toString()).catch(() => setCopyFailed(true));
    },
    // Only a message that reached the clipboard is deleted.
    cut: () => {
      void copyToClipboard().then(deleteSelected, () => setCopyFailed(true));
    },
    selectAll: () => setSelectedIds(visible.map((message) => message.id)),
    canSelectAll: visible.length > 0,
    findInMailbox: () => whenMenusClosed(document, () => searchInput.current?.focus()),
    findInMessage: selected ? find.commands : null,
    hasRules: rules.length > 0,
    applyRules: () => applyRulesTo(chosen),
    conversations,
    toggleConversations: () => setConversations((on) => !on),
    expandAll: () =>
      setExpanded(new Set(rows.flatMap((row) => (row.kind === "thread" ? [row.thread.id] : [])))),
    collapseAll: () => setExpanded(new Set()),
  };
  useDesktopAppMenu("mail", "File", <MailFileItems c={commands} />, titleBar);
  useDesktopAppMenu("mail", "Edit", <MailEditItems c={commands} />, titleBar);
  useDesktopAppMenu("mail", "View", <MailViewItems c={commands} />, titleBar);
  useDesktopAppMenu("mail", "Mailbox", <MailMailboxItems c={commands} />, titleBar);
  useDesktopAppMenu("mail", "Message", <MailMessageItems c={commands} />, titleBar);
  useDesktopAppMenu("mail", "Dock", <MailDockItems c={commands} />, titleBar);
  useMainWindowItem("mail", "Message Viewer", titleBar, <MailWindowItems c={commands} />);
  useDesktopAppMenu(
    "mail",
    "Mail",
    DesktopWindow ? <MailAppItems openAccounts={openAccounts} /> : null,
    titleBar,
  );

  // The menus' keys. On a desktop they work wherever the keyboard is while one of Mail's windows
  // is key, as a menu bar's do; a Mail on a page answers only inside its own windows, so the page
  // keeps its own keys. A modal alert or sheet has the keyboard to itself.
  // The Space bar pages through the message shown, and at its end goes on to the next one.
  const pageMessage = (back: boolean) => {
    const pane = findPane.current?.querySelector<HTMLElement>(".mac-scroll-view-viewport");
    if (!pane || !selected) return;
    const atEnd = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1;
    if (back || !atEnd) {
      pane.scrollBy({ top: (back ? -0.9 : 0.9) * pane.clientHeight });
      return;
    }
    const next = visible[visible.indexOf(selected) + 1];
    if (next) select(next.id);
  };
  const keys = useRef({ commands, viewerIsKey: false, composeKey: false, pageMessage });
  keys.current = {
    commands,
    viewerIsKey: stateOf("viewer") === "key",
    composeKey: compose !== null && composeIsKey,
    pageMessage,
  };
  const onDesktop = DesktopWindow !== undefined;
  useEffect(() => {
    const onKey = (key: globalThis.KeyboardEvent) => {
      if (key.defaultPrevented || key.repeat || key.isComposing) return;
      const { commands: now, viewerIsKey, composeKey } = keys.current;
      if (!viewerIsKey && !composeKey) return;
      const target = key.target instanceof Node ? key.target : null;
      if (!onDesktop && !root.current?.contains(target) && !composeRoot.current?.contains(target))
        return;
      if (document.querySelector('[aria-modal="true"], [role="alertdialog"]')) return;
      if (
        key.key === " " &&
        viewerIsKey &&
        !key.metaKey &&
        !key.ctrlKey &&
        !key.altKey &&
        !isText(key.target) &&
        !(key.target instanceof Element && key.target.closest("button, a, [role='menuitem']"))
      ) {
        key.preventDefault();
        keys.current.pageMessage(key.shiftKey);
        return;
      }
      for (const each of mailKeys(now)) {
        if (!matchesMenuKeyEquivalent(key, each.equivalent)) continue;
        if (composeKey && !each.whileComposing) return;
        if (each.notInText && isText(key.target)) return;
        if (each.applies && !each.applies()) return;
        key.preventDefault();
        each.run();
        return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDesktop]);

  // The buttons over a message the pointer is on; each acts on that message. The toolbar has every one
  // of them for the keyboard and for assistive technology.
  const hoverBarOf = (message: MailMessage) => {
    const leave = (to: MailboxId, label: string) => () => moveMessages([message], to, label);
    const buttons: readonly (readonly [string, MailGlyphName, boolean, () => void])[] = [
      [
        "Delete",
        "trash",
        moveRefusal(message, trashOf(message)) !== undefined,
        () => moveToTrash([message], "Delete"),
      ],
      [
        "Archive",
        "archive",
        moveRefusal(message, "archive") !== undefined,
        leave("archive", "Archive"),
      ],
      ["Reply", "reply", !me, () => reply("reply", message)],
      ["Reply All", "replyAll", !me, () => reply("all", message)],
      ["Forward", "forward", false, () => reply("forward", message)],
    ];
    return (
      <div aria-hidden="true" className="mac-mail-hover-bar">
        {buttons.map(([name, glyph, disabled, run]) => (
          <BorderlessButton key={name} title={name} tabIndex={-1} disabled={disabled} onClick={run}>
            <MailGlyph name={glyph} size={14} />
          </BorderlessButton>
        ))}
      </div>
    );
  };

  // Messages dragged out of the list; a mailbox takes those it can hold.
  const dragMessages = (event: DragEvent<HTMLElement>) => {
    const row = (event.target as Element).closest<HTMLElement>("[data-index]");
    const held = row ? rows[Number(row.dataset.index)] : undefined;
    if (!held) return;
    const here = messagesOf(held);
    const dragged = here.every((message) => selectedIds.includes(message.id)) ? chosen : here;
    followMessageDrag(dragged);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(dragged.map((each) => each.id)));
    event.dataTransfer.setData(
      "text/plain",
      dragged.map((each) => `${each.from}: ${each.subject}`).join("\n"),
    );
  };
  // Messages let go over something that takes files, as Finder's windows and the desktop do: a
  // browser's drag there ends without a drop, as they follow the pointer themselves. Each goes as an
  // `.eml`, read when it lands, and stays in its mailbox.
  const dropMessagesAsFiles = (dragged: readonly MailMessage[], at: { x: number; y: number }) => {
    const items: DesktopDragItem[] = dragged.map((message) => ({
      id: `message:${message.id}`,
      name: `${fileNameOf(message.subject)}.eml`,
      kind: "file",
      type: "message/rfc822",
      bytes: async () =>
        new Blob([rawMessage(message, (await wholeBody(message)) ?? message.body)], {
          type: "message/rfc822",
        }),
    }));
    const landing = landingAt(document.elementFromPoint(at.x, at.y), {
      from: "mail",
      items,
      copy: true,
    });
    if (landing && !landing.refusal) landing.drop();
  };
  // Hears a drag of messages from the document until it ends, since dragend does not say how it went:
  // Firefox reports it at 0, 0, and WebKit's dropEffect there stays what was allowed even with no drop.
  // A row taken away during the drag has no dragend, so the next drag ends this.
  const followMessageDrag = (dragged: readonly MailMessage[]) => {
    let at: { x: number; y: number } | null = null;
    const followed = new AbortController();
    const options = { capture: true, signal: followed.signal };
    const end = () => followed.abort();
    document.addEventListener(
      "dragover",
      (event) => {
        at = { x: event.clientX, y: event.clientY };
      },
      options,
    );
    // Out of the browser's window. WebKit gives no relatedTarget between elements either.
    document.addEventListener(
      "dragleave",
      ({ relatedTarget, clientX: x, clientY: y }) => {
        if (!relatedTarget && (x <= 0 || y <= 0 || x >= innerWidth || y >= innerHeight)) at = null;
      },
      options,
    );
    document.addEventListener("drop", end, options);
    document.addEventListener("dragstart", end, options);
    document.addEventListener(
      "dragend",
      () => {
        end();
        if (at) dropMessagesAsFiles(dragged, at);
      },
      options,
    );
  };
  const dropProps = (to: MailboxId) => ({
    "data-mailbox": to,
    "data-drop-target": dropMailbox === to ? "" : undefined,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (![...event.dataTransfer.types].includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropMailbox(to);
    },
    onDragLeave: () => setDropMailbox((now) => (now === to ? null : now)),
    onDrop: (event: DragEvent<HTMLElement>) => {
      setDropMailbox(null);
      const raw = event.dataTransfer.getData(DRAG_TYPE);
      if (!raw) return;
      event.preventDefault();
      const ids = JSON.parse(raw) as string[];
      moveMessages(
        messages.filter((message) => ids.includes(message.id)),
        to,
        "Move",
      );
      if (to !== "trash" && to !== "junk") setLastMove(to);
    },
  });
  const dragBox = (id: MailboxId) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(BOX_DRAG_TYPE, id);
      draggedBox.current = id;
    },
    onDragEnd: () => {
      draggedBox.current = null;
    },
  });
  // A row of On My Mac also takes another of them, which lands before it.
  const ownBoxProps = (id: OwnMailboxId) => {
    const messagesHere = dropProps(id);
    const reordering = (event: DragEvent<HTMLElement>) =>
      draggedBox.current !== null &&
      isOwnMailbox(draggedBox.current) &&
      draggedBox.current !== id &&
      [...event.dataTransfer.types].includes(BOX_DRAG_TYPE);
    return {
      ...messagesHere,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!reordering(event)) {
          messagesHere.onDragOver(event);
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropMailbox(id);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!reordering(event)) {
          messagesHere.onDrop(event);
          return;
        }
        event.preventDefault();
        setDropMailbox(null);
        setBoxOrder(movedBefore(ownInOrder, event.dataTransfer.getData(BOX_DRAG_TYPE), id));
      },
    };
  };
  const smartRow = (
    id: MailboxId,
    name: string,
    glyph: MailGlyphName = "smart",
    colours?: ReactNode,
    open?: boolean,
  ) => (
    <SidebarItem
      key={id}
      value={id}
      label={name}
      style={RAISED}
      icon={<MailGlyph name={glyph} />}
      accessory={
        badge(id) > 0 ? (
          <SidebarBadge selected={!searching && id === mailbox}>{badge(id)}</SidebarBadge>
        ) : undefined
      }
      data-mailbox={id}
      expanded={colours ? open : undefined}
      onExpandedChange={colours ? setFlaggedOpen : undefined}
      {...dragBox(id)}
    >
      {colours}
    </SidebarItem>
  );
  // The colours in use get rows of their own under Flagged, once there is more than one.
  const flagsInUse = FLAGS.filter((flag) => (counts[flagColorBox(flag).id]?.all ?? 0) > 0);
  const flagShown = FLAGS.find((flag) => flagColorBox(flag).id === mailbox);
  const flagRows =
    flagsInUse.length > 1 || flagShown
      ? FLAGS.filter((flag) => flagsInUse.includes(flag) || flag === flagShown).map((flag) => {
          const { id, name } = flagColorBox(flag);
          return (
            <SidebarItem
              key={id}
              value={id}
              label={name}
              style={RAISED}
              icon={<TagDot color={flag} size="small" />}
              accessory={
                badge(id) > 0 ? (
                  <SidebarBadge selected={!searching && id === mailbox}>{badge(id)}</SidebarBadge>
                ) : undefined
              }
              data-mailbox={id}
              {...dragBox(id)}
            />
          );
        })
      : undefined;
  const mailboxRow = (id: MailboxId, name: string, glyph: MailGlyphName) => (
    <SidebarItem
      key={id}
      value={id}
      label={name}
      style={RAISED}
      icon={<MailGlyph name={glyph} />}
      accessory={
        badge(id) > 0 ? (
          <SidebarBadge selected={!searching && id === mailbox}>{badge(id)}</SidebarBadge>
        ) : undefined
      }
      {...dropProps(id)}
      {...dragBox(id)}
    />
  );
  // The list and the message: side by side, or in the classic layout one above the other.
  const mailPanes = (list: ReactNode, message: ReactNode) =>
    settings.classicLayout === true ? (
      <SplitViewPane minSize={240} className="mac-mail-classic">
        <SplitView orientation="vertical" className="mac-mail-classic-split">
          <SplitViewPane
            size={classicList}
            onSizeChange={setClassicList}
            minSize={120}
            maxSize={600}
            className="mac-mail-list"
          >
            {list}
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize message list" style={DIVIDER} />
          <SplitViewPane minSize={160} className="mac-mail-viewer">
            {message}
          </SplitViewPane>
        </SplitView>
      </SplitViewPane>
    ) : (
      <>
        <SplitViewPane
          size={listSize}
          onSizeChange={setListSize}
          minSize={220}
          maxSize={520}
          className="mac-mail-list"
        >
          {list}
        </SplitViewPane>
        <SplitViewDivider aria-label="Resize message list" style={DIVIDER} />
        <SplitViewPane minSize={240} className="mac-mail-viewer">
          {message}
        </SplitViewPane>
      </>
    );

  return (
    <>
      <Window
        ref={(node) => {
          root.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) ref.current = node;
        }}
        state={stateOf("viewer")}
        width={width}
        height={height}
        className={className ? `mac-mail ${className}` : "mac-mail"}
        data-mail-fixed-width={settings.fixedWidth === true ? "" : undefined}
        data-mail-plain-quotes={settings.colorQuotes === false ? "" : undefined}
        data-mail-list-font={listFont ? "" : undefined}
        onPointerDownCapture={(event) => {
          onPointerDownCapture?.(event);
          setWanted("viewer");
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          preferencesShortcut(event);
        }}
        {...props}
        style={{
          ...props.style,
          ...fontStyle,
          ...listFont,
          // A level for the Preferences to stand over or under; alone, the viewer needs none.
          ...(host && preferences ? { zIndex: 1 } : null),
        }}
      >
        <TitleBar
          ref={setTitleBar}
          variant="unified"
          divider="bar"
          title={title}
          controls={
            <WindowControls
              onClose={onClose}
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
              {...controlsProps}
            />
          }
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        >
          {toolbarShown ? (
            <Toolbar aria-label="Mail toolbar">
              <ToolbarButton
                aria-label="Get Mail"
                disabled={offline}
                title={offline ? MAIL_IS_OFFLINE : undefined}
                data-mail-tool={shows("getMail")}
                style={{ width: 39 }}
                onClick={() => {
                  getMail();
                  chooseMailbox("inbox");
                }}
              >
                <MailGlyph name="envelope" />
              </ToolbarButton>
              <ToolbarButton
                aria-label="New Message"
                data-mail-tool={shows("newMessage")}
                style={{ width: 39 }}
                onClick={() => openNew(EMPTY_DRAFT)}
              >
                <MailGlyph name="compose" />
              </ToolbarButton>
              <ToolbarSpace />
              <ToolbarButton
                aria-label="Archive"
                disabled={none || groupRefusal(archiveBox) !== undefined}
                title={none ? undefined : groupRefusal(archiveBox)}
                data-mail-tool={shows("archive")}
                style={{ width: 39 }}
                onClick={() => moveSelected(archiveBox)}
              >
                <MailGlyph name="archive" />
              </ToolbarButton>
              <ToolbarSegmentedControl
                tracking="momentary"
                disabled={none}
                aria-label="Remove"
                data-mail-tool={shows("remove")}
              >
                <ToolbarSegment
                  aria-label="Delete"
                  style={{ width: 37.5 }}
                  onClick={deleteSelected}
                >
                  <MailGlyph name="trash" />
                </ToolbarSegment>
                <ToolbarSegment
                  aria-label="Junk"
                  disabled={groupRefusal(junkBox) !== undefined}
                  title={none ? undefined : groupRefusal(junkBox)}
                  style={{ width: 37.5 }}
                  onClick={() => moveSelected(junkBox)}
                >
                  <MailGlyph name="junk" />
                </ToolbarSegment>
              </ToolbarSegmentedControl>
              <ToolbarSegmentedControl
                tracking="momentary"
                disabled={none}
                aria-label="Respond"
                data-mail-tool={shows("respond")}
              >
                <ToolbarSegment
                  aria-label="Reply"
                  disabled={!selected || !me}
                  style={{ width: 37.5 }}
                  onClick={() => reply("reply")}
                >
                  <MailGlyph name="reply" />
                </ToolbarSegment>
                <ToolbarSegment
                  aria-label="Reply All"
                  disabled={!selected || !me}
                  style={{ width: 36 }}
                  onClick={() => reply("all")}
                >
                  <MailGlyph name="replyAll" />
                </ToolbarSegment>
                <ToolbarSegment
                  aria-label="Forward"
                  disabled={!selected}
                  style={{ width: 37.5 }}
                  onClick={() => reply("forward")}
                >
                  <MailGlyph name="forward" />
                </ToolbarSegment>
              </ToolbarSegmentedControl>
              {shows("flag") ? null : (
                <ToolbarSplitPullDown
                  image={<MailGlyph name="flag" size={14} />}
                  aria-label={flagged ? "Clear Flag" : "Flag"}
                  menuLabel="Flag Color"
                  disabled={none}
                  style={{ width: 26, minWidth: 0 }}
                  onClick={() => setFlag(flagged ? undefined : "red")}
                >
                  {FLAGS.map((flag) => (
                    <MenuItem
                      key={flag}
                      image={<TagDot color={flag} />}
                      onClick={() => setFlag(flag)}
                    >
                      {capitalize(flag)}
                    </MenuItem>
                  ))}
                  <MenuSeparator />
                  <MenuItem disabled={!flagged} onClick={() => setFlag(undefined)}>
                    Clear Flag
                  </MenuItem>
                </ToolbarSplitPullDown>
              )}
              <ToolbarButton
                aria-label="Mute"
                data-mail-tool={shows("mute")}
                disabled={none}
                pressed={!none && chosen.every((message) => message.muted)}
                onPressedChange={setMuted}
                style={{ width: 39 }}
              >
                <MailGlyph name="mute" />
              </ToolbarButton>
              <ToolbarPullDown
                image={<MailGlyph name="move" size={16} />}
                title="Move to…"
                data-mail-tool={shows("move")}
                disabled={none}
                style={{ width: 164 }}
              >
                {[...MAILBOXES, ...own].map(({ id, name }) => (
                  <MenuItem
                    key={id}
                    disabled={groupRefusal(id) !== undefined}
                    title={groupRefusal(id)}
                    onClick={() => moveSelected(id)}
                  >
                    {name}
                  </MenuItem>
                ))}
              </ToolbarPullDown>
              <ToolbarSpace width={1.5} />
              <ToolbarSearchField
                inputRef={searchInput}
                value={query}
                tokens={tokens.map((token, index) => (
                  <ToolbarSearchFieldToken
                    // biome-ignore lint/suspicious/noArrayIndexKey: tokens are only added and taken off the end
                    key={index}
                    criterion={TOKEN_LABEL[token.field]}
                  >
                    {token.value}
                  </ToolbarSearchFieldToken>
                ))}
                onValueChange={(text) => {
                  const finished = finishedToken(text);
                  if (finished) {
                    addToken(finished.token, finished.rest);
                    return;
                  }
                  setQuery(text);
                  setSuggestion(-1);
                  if (text.trim() !== "" && !searching) select(null);
                }}
                onClear={() => setTokens([])}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" && suggestions.length > 0) {
                    event.preventDefault();
                    setSuggestion((at) => (at + 1) % suggestions.length);
                  } else if (event.key === "ArrowUp" && suggestions.length > 0) {
                    event.preventDefault();
                    setSuggestion((at) => (at <= 0 ? suggestions.length : at) - 1);
                  } else if (event.key === "Enter") {
                    const token = suggestions[suggestion] ?? wholeToken(query);
                    if (token) addToken(token);
                  } else if (event.key === "Backspace" && query === "" && tokens.length > 0) {
                    setTokens(tokens.slice(0, -1));
                  }
                }}
                style={{ width: 317.5 }}
              />
            </Toolbar>
          ) : null}
        </TitleBar>
        {favoritesShown ? (
          <ContextualMenu>
            <ContextualMenuTrigger
              className="mac-mail-menu-area"
              onContextMenu={(event) => {
                const button = (event.target as Element).closest<HTMLElement>("[data-favorite]");
                setMenuFavorite((button?.dataset.favorite as MailboxId | undefined) ?? null);
              }}
            >
              <ScopeBar
                surface="toolbar"
                className="mac-mail-favorites"
                style={{ height: 24 }}
                onDragOver={(event) => {
                  if (![...event.dataTransfer.types].includes(BOX_DRAG_TYPE)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  const dropped = event.dataTransfer.getData(BOX_DRAG_TYPE);
                  if (!dropped) return;
                  event.preventDefault();
                  const before = (event.target as Element).closest<HTMLElement>("[data-favorite]")
                    ?.dataset.favorite;
                  setFavoriteBoxes((all) => {
                    const others = all.filter((each) => each !== dropped);
                    const at = before ? others.indexOf(before) : -1;
                    return at < 0
                      ? [...others, dropped]
                      : [...others.slice(0, at), dropped, ...others.slice(at)];
                  });
                }}
              >
                <ScopeBarAction
                  aria-pressed={sidebarSize > 0}
                  onClick={() => setSidebarSize(sidebarSize > 0 ? 0 : 200)}
                >
                  <MailGlyph name="sidebar" size={14} />
                  Mailboxes
                </ScopeBarAction>
                <ScopeBarGroup
                  aria-label="Favorites"
                  value={searching ? "" : mailbox}
                  onValueChange={(value) => chooseMailbox(value as MailboxId)}
                >
                  {favorites.map(({ id, name }) => (
                    <ScopeBarButton
                      key={id}
                      value={id}
                      data-favorite={id}
                      {...(isSmartMailbox(id) ? {} : dropProps(id))}
                      {...dragBox(id)}
                    >
                      {name}
                      {id === "drafts" && counts.drafts.all > 0 ? ` (${counts.drafts.all})` : ""}
                    </ScopeBarButton>
                  ))}
                </ScopeBarGroup>
              </ScopeBar>
            </ContextualMenuTrigger>
            <ContextualMenuPopup aria-label="Favorites commands">
              <MenuItem
                disabled={!menuFavorite}
                onClick={() => menuFavorite && chooseMailbox(menuFavorite)}
              >
                Open
              </MenuItem>
              <MenuItem
                disabled={!menuFavorite}
                onClick={() => menuFavorite && commands.toggleFavorite(menuFavorite)}
              >
                Remove from Favorites Bar
              </MenuItem>
              <MenuSeparator />
              <MenuItem onClick={commands.toggleFavorites}>Hide Favorites Bar</MenuItem>
            </ContextualMenuPopup>
          </ContextualMenu>
        ) : null}
        {suggestions.length > 0 ? (
          <div className="mac-mail-suggest-area">
            <div role="listbox" aria-label="Search Suggestions" className="mac-mail-suggest">
              {suggestions.map((token, index) => (
                <button
                  key={token.field}
                  type="button"
                  role="option"
                  aria-selected={index === suggestion}
                  className="mac-mail-suggest-item"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addToken(token)}
                >
                  {TOKEN_LABEL[token.field]}: {token.value}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {searching ? (
          <ScopeBar surface="toolbar" className="mac-mail-favorites" style={{ height: 24 }}>
            <ScopeBarLabel>Search:</ScopeBarLabel>
            <ScopeBarGroup
              aria-label="Search In"
              value={searchScope}
              onValueChange={(value) => setSearchScope(value === "mailbox" ? "mailbox" : "all")}
            >
              <ScopeBarButton value="all">All</ScopeBarButton>
              <ScopeBarButton value="mailbox">
                {mailboxName(mailbox, [...own, ...listed])}
              </ScopeBarButton>
            </ScopeBarGroup>
            <ScopeBarActions>
              <ScopeBarAction
                disabled={searchScope === "mailbox" && isSmartMailbox(mailbox)}
                title={
                  searchScope === "mailbox" && isSmartMailbox(mailbox)
                    ? "A search of a Smart Mailbox can\u2019t be saved. Search All to save it."
                    : undefined
                }
                onClick={() =>
                  setEditingSmart(
                    smartFromSearch(
                      tokens,
                      query,
                      searchScope === "mailbox" ? mailbox : null,
                      settings,
                    ),
                  )
                }
              >
                Save
              </ScopeBarAction>
            </ScopeBarActions>
          </ScopeBar>
        ) : null}
        <WindowBody background="content" className="mac-mail-body">
          <SplitView className="mac-mail-split">
            <SplitViewPane
              size={sidebarSize}
              onSizeChange={setSidebarSize}
              minSize={150}
              maxSize={320}
              collapsible
            >
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-mail-menu-area"
                  onContextMenu={(event) => {
                    const row = (event.target as Element).closest<HTMLElement>("[data-mailbox]");
                    setMenuMailbox((row?.dataset.mailbox as MailboxId | undefined) ?? null);
                  }}
                >
                  <Sidebar
                    aria-label="Mailboxes"
                    material={material}
                    value={searching && searchScope === "all" ? null : mailbox}
                    onValueChange={(value) => chooseMailbox(value as MailboxId)}
                    // A press on the mailbox already shown is a choice too, though it changes nothing shown.
                    onMouseDownCapture={(event) => {
                      if (event.button !== 0) return;
                      if (!(event.target as Element).closest("[data-mailbox]")) return;
                      mailboxChosen.current = true;
                      setSavedMailbox(null);
                    }}
                    className="mac-mail-sidebar"
                  >
                    <SidebarSection title="Mailboxes">
                      {shown.map(({ id, name }) => mailboxRow(id, name, SIDEBAR_GLYPHS[id]))}
                      {keepsView &&
                      ((counts[FLAGGED_BOX.id]?.all ?? 0) > 0 || mailbox === FLAGGED_BOX.id)
                        ? smartRow(
                            FLAGGED_BOX.id,
                            FLAGGED_BOX.name,
                            "flag",
                            flagRows,
                            flaggedOpen || flagShown !== undefined,
                          )
                        : null}
                    </SidebarSection>
                    {vips.length > 0 ? (
                      <SidebarSection title="VIPs">
                        {vips.map((vip) => {
                          const box = vipBox(vip);
                          return smartRow(box.id, box.name, "vip");
                        })}
                      </SidebarSection>
                    ) : null}
                    <SidebarSection title="Smart Mailboxes">
                      {smart.map(({ id, name }) => smartRow(id, name))}
                    </SidebarSection>
                    {own.length > 0 ? (
                      <SidebarSection title="On My Mac">
                        {ownInOrder.map(({ id, name }) => (
                          <SidebarItem
                            key={id}
                            value={id}
                            label={name}
                            style={RAISED}
                            icon={<MailGlyph name="folder" />}
                            accessory={
                              badge(id) > 0 ? (
                                <SidebarBadge selected={!searching && id === mailbox}>
                                  {badge(id)}
                                </SidebarBadge>
                              ) : undefined
                            }
                            {...dragBox(id)}
                            {...ownBoxProps(id)}
                          />
                        ))}
                      </SidebarSection>
                    ) : null}
                  </Sidebar>
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Mailbox commands">
                  <MailMailboxRowItems c={commands} mailbox={menuMailbox} />
                </ContextualMenuPopup>
              </ContextualMenu>
            </SplitViewPane>
            <SplitViewDivider aria-label="Resize mailbox list" style={DIVIDER} />
            {mailPanes(
              <>
                {settings.classicLayout === true ? (
                  // biome-ignore lint/a11y/useSemanticElements: the heads of the list's columns, not a form's fieldset
                  <div className="mac-mail-classic-head" role="group" aria-label="Columns">
                    {CLASSIC_COLUMNS.map(([column, label]) => (
                      <button
                        key={column}
                        type="button"
                        aria-pressed={sort === column}
                        onClick={() => {
                          if (sort === column) commands.setAscending(!commands.ascending);
                          else commands.setSort(column);
                        }}
                      >
                        {label}
                        {sort === column ? (commands.ascending ? " ▲" : " ▼") : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mac-mail-sort">
                  <PullDownButton
                    bordered={false}
                    title={`Sort by ${MAIL_SORTS.find(([value]) => value === sort)?.[1]}`}
                  >
                    <MenuRadioGroup
                      value={sort}
                      onValueChange={(value) => commands.setSort(value as MailSort)}
                    >
                      {MAIL_SORTS.map(([value, label]) => (
                        <MenuRadioItem key={value} value={value}>
                          {label}
                        </MenuRadioItem>
                      ))}
                    </MenuRadioGroup>
                  </PullDownButton>
                  <ImageButton
                    aria-label={`Filter: ${
                      MAIL_FILTERS.filter(([value]) => filters.includes(value))
                        .map(([, label]) => label)
                        .join(", ") || "Nothing"
                    }`}
                    aria-pressed={filterOn}
                    onClick={() => commands.setFilterOn(!filterOn)}
                  >
                    <MailGlyph name="filter" size={17} />
                  </ImageButton>
                </div>
                {notice ? (
                  <div role="alert" className="mac-mail-notice">
                    {notice}
                  </div>
                ) : null}
                {visible.length > 0 ? (
                  <ContextualMenu>
                    <ContextualMenuTrigger
                      className="mac-mail-menu-area"
                      onContextMenu={(event) => {
                        const row = (event.target as Element).closest<HTMLElement>("[data-index]");
                        const held = row ? rows[Number(row.dataset.index)] : undefined;
                        if (
                          held &&
                          !messagesOf(held).every((message) => selectedIds.includes(message.id))
                        ) {
                          chooseRows([rowId(held)]);
                        }
                      }}
                      onDragStart={dragMessages}
                    >
                      <ListView
                        aria-label="Messages"
                        count={rows.length}
                        rowHeight={rowHeight}
                        separator="inset"
                        separatorInset={24}
                        renderRow={renderRow}
                        getRowId={(index) => {
                          const row = rows[index];
                          return row ? rowId(row) : index;
                        }}
                        getRowLabel={(index) => {
                          const row = rows[index];
                          return row ? (messagesOf(row)[0]?.from ?? "") : "";
                        }}
                        selectionMode="multiple"
                        rowDraggable
                        value={selectedRows}
                        onValueChange={(value) => chooseRows(value.map(String))}
                        onRowAction={() => {
                          if (heldMessages && selected?.mailbox === "drafts") openDraft(selected);
                          else if (DesktopWindow && selected) openMessages([selected]);
                          else reply("reply");
                        }}
                        onKeyDown={(event) => {
                          const plain =
                            !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
                          if (plain && (event.key === "Backspace" || event.key === "Delete")) {
                            event.preventDefault();
                            deleteSelected();
                          }
                          if (plain && threadRow && threadRow.members.length > 1) {
                            if (event.key === "ArrowRight") toggleThread(threadRow.thread.id, true);
                            if (event.key === "ArrowLeft") toggleThread(threadRow.thread.id, false);
                          }
                        }}
                        className="mac-mail-messages"
                        style={LIST}
                      />
                    </ContextualMenuTrigger>
                    <ContextualMenuPopup aria-label="Message commands">
                      <MailMessageRowItems c={commands} />
                    </ContextualMenuPopup>
                  </ContextualMenu>
                ) : (
                  <EmptyState role="status" className="mac-mail-messages">
                    {searching
                      ? "No Results"
                      : filterOn
                        ? filters.length === 1 && filters[0] === "unread"
                          ? "No Unread Messages"
                          : "No Messages Match the Filter"
                        : "No Messages"}
                  </EmptyState>
                )}
              </>,
              <div className="mac-mail-find-area">
                {selected ? find.bar : null}
                <MailTextMenu paneRef={findPane} className="mac-mail-find-text">
                  {stack ? (
                    <ScrollView aria-label="Conversation" className="mac-mail-stack">
                      {stack.map((message) => (
                        <MailMessageContent
                          key={message.id}
                          message={message}
                          renderBody={renderMessageBody}
                          allHeaders={messageView === "headers"}
                          rawSource={messageView === "source"}
                          readBody={readWholeBody}
                          showAddresses={settings.smartAddresses === false}
                          hoverBar={hoverBarOf(message)}
                          notice={blockedBanner(message)}
                          stacked
                          elsewhere={
                            threadRow?.related.includes(message)
                              ? mailboxName(message.mailbox, own)
                              : undefined
                          }
                        />
                      ))}
                    </ScrollView>
                  ) : selected ? (
                    <MailMessageContent
                      key={selected.id}
                      message={selected}
                      renderBody={renderMessageBody}
                      allHeaders={messageView === "headers"}
                      rawSource={messageView === "source"}
                      readBody={readWholeBody}
                      showAddresses={settings.smartAddresses === false}
                      hoverBar={hoverBarOf(selected)}
                      notice={blockedBanner(selected)}
                    />
                  ) : (
                    <EmptyState>
                      {chosen.length > 1
                        ? `${chosen.length} Messages Selected`
                        : "No Message Selected"}
                    </EmptyState>
                  )}
                </MailTextMenu>
              </div>,
            )}
          </SplitView>
        </WindowBody>
      </Window>
      <Alert open={erasing !== null} onOpenChange={(open) => !open && setErasing(null)}>
        <AlertPopup>
          <AlertMessage>
            {erasing === "junk"
              ? "Are you sure you want to permanently erase all messages in Junk?"
              : "Are you sure you want to permanently erase all messages in the Trash?"}
          </AlertMessage>
          <AlertInformativeText>You can’t undo this action.</AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose render={<DefaultButton />} onClick={() => erasing && eraseMailbox(erasing)}>
              Erase
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <MailboxNameAlert
        asking={
          naming === null
            ? null
            : naming === "new"
              ? { title: "New Mailbox", name: "", confirm: "OK" }
              : { title: "Rename Mailbox", name: naming.name, confirm: "Rename" }
        }
        onName={nameMailbox}
        onClose={() => setNaming(null)}
      />
      <MailboxNameAlert
        asking={
          renamingSmart
            ? { title: "Rename Mailbox", name: renamingSmart.name, confirm: "Rename" }
            : null
        }
        onName={async (name) => {
          const taken = nameRefusal(name, renamingSmart?.id);
          if (taken) return taken;
          keepSmart(smart.map((box) => (box.id === renamingSmart?.id ? { ...box, name } : box)));
          return null;
        }}
        onClose={() => setRenamingSmart(null)}
      />
      <MailCustomizeToolbar
        open={customizing}
        anchor={titleBar}
        hidden={hiddenTools}
        onChange={setHiddenTools}
        onDone={() => setCustomizing(false)}
      />
      <input
        ref={importInput}
        type="file"
        hidden
        aria-label="Mailbox file to import"
        accept=".mbox,.mbx,application/mbox"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) reading(() => importFile(file));
        }}
      />
      <MailboxNameAlert
        asking={
          namingStationery ? { title: "Save as Stationery", name: "", confirm: "Save" } : null
        }
        onName={async (name) => {
          const draft = composeDraft.current?.();
          if (!draft) return "There is no message to keep.";
          const next = withStationery(stationery, name, draft);
          if (!next) return STATIONERY_TOO_LARGE;
          keepStationery(next);
          return null;
        }}
        onClose={() => setNamingStationery(false)}
      />
      <Alert open={removingFiles} onOpenChange={(open) => !open && setRemovingFiles(false)}>
        <AlertPopup>
          <AlertMessage>Remove the attachments of the selected messages?</AlertMessage>
          <AlertInformativeText>
            The messages stay. You cannot undo this; a copy of a message elsewhere keeps its files.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <DefaultButton
              onClick={() => {
                setRemovingFiles(false);
                onRemoveAttachments?.(chosen);
              }}
            >
              Remove
            </DefaultButton>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <MailSmartSheet
        asking={editingSmart}
        own={own}
        anchor={titleBar}
        refusal={(name) => nameRefusal(name, editingSmart?.id)}
        onSave={saveSmart}
        onClose={() => setEditingSmart(null)}
      />
      <Alert open={deletingSmart !== null} onOpenChange={(open) => !open && setDeletingSmart(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to delete the Smart Mailbox “{deletingSmart?.name}”?
          </AlertMessage>
          <AlertInformativeText>Its messages stay in their mailboxes.</AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => keepSmart(smart.filter((box) => box.id !== deletingSmart?.id))}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={deletingBox !== null} onOpenChange={(open) => !open && setDeletingBox(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to delete the mailbox “{deletingBox?.name}”?
          </AlertMessage>
          <AlertInformativeText>Its messages will move to the Trash.</AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => deletingBox && deleteMailbox(deletingBox)}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={askingToApply} onOpenChange={(open) => !open && setAskingToApply(false)}>
        <AlertPopup>
          <AlertMessage>Do you want to apply your rules to messages in this mailbox?</AlertMessage>
          <AlertInformativeText>
            New mail runs the rules by itself. What is here already stays as it is unless you apply
            them.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Don’t Apply</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => applyRulesTo(messagesOfMailbox(messages, mailbox, listed, Date.now()))}
            >
              Apply
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={fileProblem !== null} onOpenChange={(open) => !open && setFileProblem(null)}>
        <AlertPopup>
          <AlertMessage>{fileProblem?.title}</AlertMessage>
          <AlertInformativeText>{fileProblem?.text}</AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={printFailed} onOpenChange={(open) => !open && setPrintFailed(false)}>
        <AlertPopup>
          <AlertMessage>The messages could not be printed.</AlertMessage>
          <AlertInformativeText>
            The whole text of a message could not be read. Nothing was printed.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={copyFailed} onOpenChange={(open) => !open && setCopyFailed(false)}>
        <AlertPopup>
          <AlertMessage>The messages could not be copied.</AlertMessage>
          <AlertInformativeText>
            The whole text of a message could not be read, or the browser refused the clipboard.
            Nothing was copied.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      {DesktopWindow
        ? tools.map((tool) => (
            <DesktopWindow
              key={tool}
              id={tool}
              title={TOOL_TITLES[tool]}
              defaultSize={
                tool === "recipients" ? { width: 480, height: 360 } : { width: 420, height: 180 }
              }
              minSize={{ width: 320, height: 160 }}
              onClose={() => closeTool(tool)}
              render={({
                onClose: close,
                onMinimize: minimize,
                onZoom: zoom,
                zoomRole: role,
                minimizeDisabled: noMinimize,
                zoomDisabled: noZoom,
                onDragRegionPointerDown: move,
                onDragRegionDoubleClick: zoomFromBar,
                ...windowProps
              }) => {
                const chrome: MailToolWindowProps = {
                  ...windowProps,
                  controlsProps: {
                    onClose: close,
                    onMinimize: minimize,
                    onZoom: zoom,
                    zoomRole: role,
                    minimizeDisabled: noMinimize,
                    zoomDisabled: noZoom,
                  },
                  onDragRegionPointerDown: move,
                  onDragRegionDoubleClick: zoomFromBar,
                };
                if (tool === "activity") {
                  return (
                    <MailActivityWindow
                      {...chrome}
                      checking={checks > 0}
                      sending={composeProps?.sending === true || sendingHere}
                      lastChecked={lastChecked}
                    />
                  );
                }
                if (tool === "recipients") {
                  return (
                    <MailRecipientsWindow
                      {...chrome}
                      recipients={recipients}
                      onNewMessage={({ written }) => openNew({ ...EMPTY_DRAFT, to: [written] })}
                      canAddContact={({ written }) => accountOf(written) !== null}
                      onAddContact={({ written }) => composeHabits.onAddAddress(written)}
                      onRemove={({ address }) => keepRemoved([...removedRecipients, address])}
                    />
                  );
                }
                return onCheckConnection ? (
                  <MailDoctorWindow {...chrome} check={onCheckConnection} />
                ) : null;
              }}
            />
          ))
        : null}
      {DesktopWindow
        ? sourceIds.flatMap((id) => {
            const message = messages.find((each) => each.id === id);
            if (!message) return [];
            return [
              <DesktopWindow
                key={id}
                id={`source-${id}`}
                title={`Raw Source of ${message.subject}`}
                defaultSize={{ width: 620, height: 480 }}
                minSize={{ width: 320, height: 200 }}
                onClose={() => setSourceIds((all) => all.filter((each) => each !== id))}
                render={({
                  onClose: close,
                  onMinimize: minimize,
                  onZoom: zoom,
                  zoomRole: role,
                  minimizeDisabled: noMinimize,
                  zoomDisabled: noZoom,
                  onDragRegionPointerDown: move,
                  onDragRegionDoubleClick: zoomFromBar,
                  ...windowProps
                }) => (
                  <MailSourceWindow
                    {...windowProps}
                    message={message}
                    readBody={readWholeBody}
                    controlsProps={{
                      onClose: close,
                      onMinimize: minimize,
                      onZoom: zoom,
                      zoomRole: role,
                      minimizeDisabled: noMinimize,
                      zoomDisabled: noZoom,
                    }}
                    onDragRegionPointerDown={move}
                    onDragRegionDoubleClick={zoomFromBar}
                  />
                )}
              />,
            ];
          })
        : null}
      {DesktopWindow
        ? readingIds.flatMap((id) => {
            const message = messages.find((each) => each.id === id);
            if (!message) return [];
            const closeReading = () => setReadingIds((all) => all.filter((each) => each !== id));
            return [
              <DesktopWindow
                key={id}
                id={`message-${id}`}
                title={message.subject}
                defaultSize={{ width: 720, height: 560 }}
                minSize={{ width: 420, height: 280 }}
                onClose={closeReading}
                render={({
                  onClose: close,
                  onMinimize: minimize,
                  onZoom: zoom,
                  zoomRole: role,
                  minimizeDisabled: noMinimize,
                  zoomDisabled: noZoom,
                  onDragRegionPointerDown: move,
                  onDragRegionDoubleClick: zoomFromBar,
                  ...windowProps
                }) => (
                  <MailTabbedWindow
                    state={windowProps.state}
                    composeSlot={compose?.slot ?? null}
                    onNewMessage={newMessageTab}
                  >
                    {({ bar, rootProps }) => (
                      <MailMessageWindow
                        {...windowProps}
                        {...rootProps}
                        tabBar={bar}
                        data-mail-fixed-width={settings.fixedWidth === true ? "" : undefined}
                        data-mail-plain-quotes={settings.colorQuotes === false ? "" : undefined}
                        style={{ ...windowProps.style, ...fontStyle }}
                        showAddresses={settings.smartAddresses === false}
                        message={message}
                        renderBody={renderMessageBody}
                        canReply={Boolean(me)}
                        onReply={(kind) => reply(kind, message)}
                        deleteRefusal={
                          inTrash(message) ? undefined : moveRefusal(message, trashOf(message))
                        }
                        onDelete={() => {
                          if (inTrash(message)) erase([message]);
                          else moveToTrash([message], "Delete");
                          close();
                        }}
                        onNewMessage={() => openNew(EMPTY_DRAFT)}
                        onPrint={() => printMessages([message])}
                        onRedirect={() => redirectMessage(message)}
                        controlsProps={{
                          onClose: close,
                          onMinimize: minimize,
                          onZoom: zoom,
                          zoomRole: role,
                          minimizeDisabled: noMinimize,
                          zoomDisabled: noZoom,
                        }}
                        onDragRegionPointerDown={move}
                        onDragRegionDoubleClick={zoomFromBar}
                      />
                    )}
                  </MailTabbedWindow>
                )}
              />,
            ];
          })
        : null}
      {DesktopWindow && compose?.shared ? (
        <KeepInFront key={`front-${compose.key}`} windowId={`mail:compose-${compose.slot}`} />
      ) : null}
      {DesktopWindow && compose && composeAsked > 0 ? (
        <BringForward key={`asked-${composeAsked}`} windowId={`mail:compose-${compose.slot}`} />
      ) : null}
      {DesktopWindow && compose ? (
        <DesktopWindow
          key={compose.key}
          id={`compose-${compose.slot}`}
          title="New Message"
          defaultSize={{ width: 886, height: 585 }}
          minSize={{ width: 480, height: 320 }}
          onClose={() => {
            // The window's own close, once its checks have passed, closes it; a close the
            // desktop asks for goes through those checks first.
            if (composeClosing.current || !composeClose.current) {
              composeClosing.current = false;
              closeCompose(compose.key);
            } else {
              composeClose.current();
            }
          }}
          render={({
            onClose: close,
            onMinimize: minimize,
            onZoom: zoom,
            zoomRole: role,
            minimizeDisabled: noMinimize,
            zoomDisabled: noZoom,
            onDragRegionPointerDown: move,
            onDragRegionDoubleClick: zoomFromBar,
            ...windowProps
          }) => (
            <MailTabbedWindow
              state={windowProps.state}
              composeSlot={compose.slot}
              onNewMessage={newMessageTab}
            >
              {({ bar, rootProps }) => (
                <MailCompose
                  tabBar={bar}
                  keyRef={setComposeIsKey}
                  sendRef={composeSend}
                  attachRef={composeAttach}
                  saveRef={composeSave}
                  onAutosave={onAutosaveDraft ? autosave : undefined}
                  {...windowProps}
                  {...rootProps}
                  {...composeProps}
                  {...composeHabits}
                  style={{ ...windowProps.style, ...fontStyle }}
                  sending={composeProps?.sending || sendingHere}
                  defaultDraft={compose.draft}
                  contacts={contacts}
                  autoFocus={compose.focus}
                  onSend={send}
                  onDraftClose={draftClose}
                  closeRef={composeClose}
                  onClose={() => {
                    composeClosing.current = true;
                    close();
                  }}
                  controlsProps={{
                    onMinimize: minimize,
                    onZoom: zoom,
                    zoomRole: role,
                    minimizeDisabled: noMinimize,
                    zoomDisabled: noZoom,
                  }}
                  onDragRegionPointerDown={move}
                  onDragRegionDoubleClick={zoomFromBar}
                />
              )}
            </MailTabbedWindow>
          )}
        />
      ) : null}
      {host && compose && !DesktopWindow
        ? createPortal(
            <MailCompose
              {...composeProps}
              {...composeHabits}
              sending={composeProps?.sending || sendingHere}
              key={compose.key}
              state={stateOf("compose")}
              defaultDraft={compose.draft}
              contacts={contacts}
              autoFocus={compose.focus}
              onSend={send}
              onDraftClose={draftClose}
              sendRef={composeSend}
              attachRef={composeAttach}
              saveRef={composeSave}
              onAutosave={onAutosaveDraft ? autosave : undefined}
              keyRef={setComposeIsKey}
              ref={composeRoot}
              onClose={() => closeCompose(compose.key)}
              data-front={front === "compose" ? "" : undefined}
              style={{
                ...fontStyle,
                position: "absolute",
                zIndex: front === "compose" ? 2 : 1,
                left: host.left + composeOffset.x,
                top: host.top + composeOffset.y,
              }}
              onPointerDownCapture={() => setWanted("compose")}
              onKeyDown={preferencesShortcut}
            />,
            host.element,
          )
        : null}
      {host && preferences
        ? createPortal(
            <MailPreferences
              state={stateOf("preferences")}
              helpUnavailable={helpUnavailable}
              settings={settings}
              onSettingsChange={setSettings}
              settingReasons={keepsView ? SERVED_SETTING_REASONS : undefined}
              accountPane={keepsView ? <MailAccountPane me={me} /> : undefined}
              blockedPane={
                <MailBlockedPane
                  blocked={blocked}
                  toTrash={settings.blockedToTrash === true}
                  onChange={keepBlocked}
                  onToTrashChange={(toTrash) =>
                    setSettings((now) => ({ ...now, blockedToTrash: toTrash }))
                  }
                />
              }
              rulesPane={(anchor) => (
                <MailRulesPane
                  rules={rules}
                  own={own}
                  anchor={anchor}
                  onChange={keepRules}
                  onAdded={() => setAskingToApply(true)}
                />
              )}
              signaturesPane={
                <MailSignaturesPane
                  kept={signatures}
                  above={settings.signatureAbove !== false}
                  font={`${settings.messageFont ?? "Helvetica"} ${settings.messageSize ?? 12}`}
                  onChange={keepSignatures}
                  onAboveChange={(above) =>
                    setSettings((now) => ({ ...now, signatureAbove: above }))
                  }
                />
              }
              onClose={() => setPreferences(false)}
              data-front={front === "preferences" ? "" : undefined}
              style={{
                position: "absolute",
                // A managed window's frame makes its children fill it.
                height: "auto",
                zIndex: front === "preferences" ? 2 : 0,
                left: host.left + PREFERENCES_OFFSET.x,
                top: host.top + PREFERENCES_OFFSET.y,
              }}
              onPointerDownCapture={() => setWanted("preferences")}
              onKeyDown={preferencesShortcut}
            />,
            host.element,
          )
        : null}
    </>
  );
}

/** Mail's small windows, as Window lists them. */
type MailTool = "activity" | "recipients" | "doctor";
const TOOL_TITLES: Record<MailTool, string> = {
  activity: "Activity",
  recipients: "Previous Recipients",
  doctor: "Connection Doctor",
};

/** Mail > Accounts: System Preferences on the pane that keeps them. */
const openAccounts = () => {
  requestPane("internet-accounts");
  requestDesktopEffects([{ open: "system-preferences" }]);
};

/** Brings a window the desktop hosts forward once, when it is rendered. */
function BringForward({ windowId }: { windowId: string }) {
  const store = useWindowManagerStore();
  useEffect(() => store.commands.focus(windowId), [store, windowId]);
  return null;
}

/**
 * On a desktop, the New Message window a shared link opened stays the key window until the person
 * presses or types anywhere. The desktop brings Mail's viewer forward when it opens Mail for the
 * link, which can come after the New Message window has opened: without this the viewer would
 * cover the message it was opened for. Only rendered where the desktop hosts the window, so inside
 * its window manager.
 */
function KeepInFront({ windowId }: { windowId: string }) {
  const store = useWindowManagerStore();
  useEffect(() => {
    let settled = false;
    const front = () => {
      if (settled) return;
      const own = store.get(windowId);
      if (own && own.state !== "key" && !own.minimized) store.commands.focus(windowId);
    };
    const settle = () => {
      settled = true;
    };
    const stop = store.subscribe(front);
    front();
    document.addEventListener("pointerdown", settle, true);
    document.addEventListener("keydown", settle, true);
    return () => {
      settled = true;
      stop();
      document.removeEventListener("pointerdown", settle, true);
      document.removeEventListener("keydown", settle, true);
    };
  }, [store, windowId]);
  return null;
}
