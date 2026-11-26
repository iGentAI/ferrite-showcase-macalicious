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
import { Checkbox } from "macalicious/checkbox";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { windowDragRegion } from "macalicious/lib/window-drag-region";
import { ListView, ListViewRowDetail, ListViewRowLeading } from "macalicious/list-view";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import {
  MessageBubble,
  MessageStatus,
  MessageTranscript,
  MessageTranscriptHeader,
} from "macalicious/message-bubble";
import { NewItemDot } from "macalicious/new-item-dot";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { SearchField } from "macalicious/search-field";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { TextField, TextFieldBezel } from "macalicious/text-field";
import { Window, type WindowProps, type WindowState } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { copiedDriveItems } from "../desktop/desktop-clipboard";
import { type DesktopDragItem, useDesktopDrop } from "../desktop/desktop-drag";
import { askToReach } from "../desktop/desktop-reach";
import { AudioGlyph, Avatar, EmojiGlyph, MessagesGlyph, PeoplePicture } from "./messages-artwork";
import {
  abandon,
  byRecency,
  DEFAULT_NOW,
  DEFAULT_SETTINGS,
  DEFAULT_TEXT_SIZE,
  DEFAULT_VIEW,
  defaultConversations as initialConversations,
  lastMessage,
  listTime,
  type MessagesConversation,
  type MessagesMessage,
  type MessagesSettings,
  type MessagesView,
  matches,
  minutesBetween,
  presentOf,
  splitRecipients,
  TEXT_SIZES,
  textSizeStep,
  transcriptTime,
} from "./messages-data";
import { detectedText } from "./messages-detectors";
import { MessageEffectLayer } from "./messages-effects";
import { useMessageFieldTools } from "./messages-field-tools";
import { SendLocationButton } from "./messages-location";
import { editField, NO_FACETIME, useMessagesMenus } from "./messages-menus";
import { MessagesPreferences } from "./messages-preferences";
import { playSentSound, useReceivedSound } from "./messages-sounds";
import "./messages.tokens.css";
import "./messages.css";

type Front = "window" | "preferences";

/*
 * What this window sets on a library control: a width, a margin or a place, in messages.css,
 * and the custom properties below, each of which the control's own page documents as a hook.
 * Nothing else of a control is changed; where Messages draws a control differently, the
 * library's look stands and the page's Fidelity section says so.
 *
 * SPLIT   --mac-split-view-divider-color: split-view.mdx, "CSS variable" table, and its Usage
 *         ("Set it on the split view").
 * LIST    `background`: the list stands on the column's material, and a list view's surface is
 *         set through its `style`, as the list view's own Notes and Reminders examples and the
 *         Preview demo set it. The selection is the list view's own: `emphasis="always"`
 *         (list-view.mdx, "Always emphasised") keeps the accent's selection and its white text
 *         whether or not the list has the keyboard, and a row's time, mark and last message
 *         are in the list view's `ListViewRowDetail`, which draws them in the detail colour of
 *         either state.
 * SEARCH  --mac-search-field-height: search-field.mdx, "CSS variable" table (21 pt, as in
 *         Reminders' sidebar field).
 * EMOJI   --mac-image-button-padding: image-button.mdx, "Attribute or variable" table. 2 pt
 *         around the 18 pt face fills the 22 pt inside the capsule's edge; the 3 pt after it
 *         are the place text-field.mdx gives a button in the capsule's trailing end.
 * COMPOSE height: push-button.mdx, "Compact": Messages makes its compose button 22 pt high.
 *
 * The Details link is the library's Borderless Button in its link colour, as it comes.
 */
const SPLIT = {
  "--mac-split-view-divider-color":
    "var(--mac-messages-divider-color, var(--mac-messages-divider))",
} as CSSProperties;
const LIST = {
  background: "transparent",
  // List View: the rows' and the empty rows' line starts 20 pt in, under the picture's edge,
  // and not where the text does (77 pt).
  "--mac-list-view-separator": "var(--mac-messages-list-separator)",
  "--mac-list-view-separator-inset": "20px",
} as CSSProperties;
const SEARCH = { "--mac-search-field-height": "21px" } as CSSProperties;
const EMOJI = { "--mac-image-button-padding": "2px", marginInlineEnd: 3 } as CSSProperties;
const COMPOSE = { height: 22 } as CSSProperties;

/** A longer silence than this, in minutes, puts a new time over the messages that follow. */
const RUN_GAP = 60;

const NO_MARKS: readonly string[] = [];

/** Why Record audio is unavailable, shown as its tooltip and description. */
export const AUDIO_UNAVAILABLE =
  "Audio messages are not available here: only a conversation between accounts on the served desktop keeps a recording.";

const serviceName = (conversation: MessagesConversation) =>
  conversation.service === "sms" ? "Text Message" : "iMessage";

/** A conversation's recipient, or nothing while it has none. */
const nameOf = (conversation: MessagesConversation) => conversation.name.trim();

/** The part of the page's selection inside a bubble's text, whichever way it was dragged. */
const selectedIn = (bubble: Element): string => {
  const picked = window.getSelection();
  if (!picked || picked.isCollapsed || picked.rangeCount === 0) return "";
  const selection = picked.getRangeAt(0);
  const part = document.createRange();
  part.selectNodeContents(bubble);
  const sender = bubble.querySelector(".mac-message-bubble-sender");
  if (sender) part.setStartAfter(sender);
  if (selection.compareBoundaryPoints(Range.START_TO_START, part) > 0) {
    part.setStart(selection.startContainer, selection.startOffset);
  }
  if (selection.compareBoundaryPoints(Range.END_TO_END, part) < 0) {
    part.setEnd(selection.endContainer, selection.endOffset);
  }
  return part.toString();
};

/** Where the Preferences window opens, in points from the window's top-left corner. */
const PREFERENCES_OFFSET = { x: 95, y: 70 };

export interface MessagesProps extends Omit<WindowProps, "children"> {
  /**
   * Called when a Help button of the Preferences window is pressed; passed to `MessagesPreferences`
   * as its `onHelp`.
   * @default none: the buttons are drawn as captured, and do nothing
   */
  onHelp?: () => void;
  /**
   * The conversations the window starts with, each with its messages oldest first. They are
   * listed with the one last heard from first; one without messages follows the others, and
   * of two with the same `id` the first is kept. Nothing is stored or sent anywhere: they last
   * as long as the component is mounted. An empty list is a window with no conversations, in
   * which the compose button starts the first.
   * @default the five conversations of `defaultConversations`
   */
  defaultConversations?: readonly MessagesConversation[];
  /**
   * The `id` of the conversation shown at first, or `null` for none. An `id` that none of
   * the conversations has counts as not given.
   * @default the conversation last heard from
   */
  defaultConversation?: string | null;
  /** Called with the `id` of the conversation the user selects or starts. */
  onConversationChange?: (id: string | null) => void;
  /**
   * Messages the owner holds, by conversation `id`: a conversation named here shows these
   * messages, oldest first, instead of its own, and a message sent to it is only reported
   * through `onSend`, for the owner to add. A desktop served with a server keeps a shared
   * conversation this way (`messages-live.tsx`).
   */
  heldMessages?: ReadonlyMap<string, readonly MessagesMessage[]>;
  /**
   * Called with the conversation's `id` and the new message when one is sent. Without it, a
   * conversation the owner holds sends nothing, and what was typed stays in its field.
   */
  onSend?: (id: string, message: MessagesMessage) => void;
  /**
   * Called with the conversation's `id` and the message when Try Again is pressed under a
   * message marked `undelivered`. Without it, such a message only says Not Delivered.
   */
  onRetry?: (id: string, message: MessagesMessage) => void;
  /**
   * A line the transcript of a conversation ends with, by conversation `id`: a problem the
   * owner of a held conversation reports, such as a server that cannot read it, with what to
   * do about it.
   */
  notices?: ReadonlyMap<string, ReactNode>;
  /**
   * The moment the window takes as the present, in local time as `YYYY-MM-DDTHH:mm`: a time
   * on that day is written as an hour, the day before as Yesterday, and a message that is sent
   * carries it. `stampOf(new Date())` gives the real one. Text that is not such a stamp counts
   * as the default.
   * @default "2019-10-07T15:27", the minute of the default conversations' last message
   */
  now?: string;
  /**
   * The surface of the conversation list: the vibrant material, for a window over a desktop,
   * or a flat one on a plain page.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /**
   * The settings, when the owner holds them: a desktop that hosts the Preferences window as
   * a window of its own gives both windows the same ones. Use with `onSettingsChange`.
   */
  settings?: MessagesSettings;
  /**
   * The settings the Preferences window starts with, when the window holds them itself.
   * @default the settings of the reference screenshots
   */
  defaultSettings?: MessagesSettings;
  /** Called with all settings when the window's own Preferences change one. */
  onSettingsChange?: (settings: MessagesSettings) => void;
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
   * Where the Preferences window opens, in points from the window's top-left corner.
   * @default { x: 95, y: 70 }
   */
  preferencesOffset?: { x: number; y: number };
  /**
   * The element the Preferences window is rendered into, positioned over the window. It must
   * be the containing block of absolutely positioned children.
   * @default the window's offset parent
   */
  windowsContainer?: HTMLElement | null;
  /** Called when the close button is activated. */
  onClose?: WindowControlsProps["onClose"];
  /** Called when the minimize button is activated. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** Called when the zoom button is activated. */
  onZoom?: WindowControlsProps["onZoom"];
  /** What the zoom button does, as on `WindowControls`. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** Disable the minimize button. */
  minimizeDisabled?: boolean;
  /** Disable the zoom button. */
  zoomDisabled?: boolean;
  /** Further props for the `WindowControls`. */
  controlsProps?: WindowControlsProps;
  /**
   * Called when the primary pointer button goes down on the strip over the conversation list
   * or on the bar over the transcript, not on a control in them. Messages has no title bar:
   * these are its drag region, and a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /** Called when the drag region is double-clicked: macOS zooms or minimizes the window. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  /**
   * Conversations the owner holds besides the window's own (a desktop served by its Ferrite
   * application: the person's conversations with other accounts). They are listed with the
   * others by recency; their messages are theirs, or `heldMessages`', and a message sent to one
   * is only reported through `onSend`.
   */
  extraConversations?: readonly MessagesConversation[];
  /**
   * Called when the first message is sent in a conversation started with the compose button,
   * with the recipients as typed and the message, instead of keeping that conversation in the
   * window. The owner starts it and answers the `id` of the conversation that now holds the
   * message (one of `extraConversations`), which the window then shows in its place; `null`
   * keeps the new conversation and its text, for the owner to say why in `notices` under the
   * new conversation's `id` (the third argument).
   */
  onStartConversation?: (
    recipients: string,
    message: MessagesMessage,
    draftId: string,
    /** Files the message carries (`composeFiles`). */
    files?: readonly DesktopDragItem[],
  ) => Promise<string | null>;
  /** Names the To field of a new conversation offers as it is typed: the user's contacts. */
  recipientSuggestions?: readonly string[];
  /**
   * Rendered after each message's bubble: what the owner shows with it, such as a reply's
   * quote, its tapbacks and their commands.
   */
  renderMessageExtras?: (conversationId: string, message: MessagesMessage) => ReactNode;
  /** Menu items a right click on a bubble offers after Copy, such as its tapbacks. */
  renderMessageMenu?: (conversationId: string, message: MessagesMessage) => ReactNode;
  /** What the owner adds to a conversation's Details, such as its members. */
  renderDetails?: (conversationId: string) => ReactNode;
  /** File > Send File…: picks a file to send in that conversation; absent where none can go. */
  onSendFile?: (conversationId: string) => void;
  /** File > Open…: the host shows its drive's Open panel; dimmed with its reason without one. */
  onOpenFile?: () => void;
  /** Rendered before the message field: a button of the owner's, such as one that attaches. */
  renderInputAccessory?: (conversationId: string | null) => ReactNode;
  /** Whether the server took the message since this window read its conversations. */
  isNewMessage?: (conversationId: string, message: MessagesMessage) => boolean;
  /** Record audio for a conversation that can take a recording; dimmed with its reason elsewhere. */
  renderAudioButton?: (conversationId: string) => ReactNode;
  /**
   * Called with what is dragged onto the window from Finder or the desktop, for the conversation
   * it shows. Whether a conversation takes files says `canTakeFiles`.
   */
  onDropFiles?: (conversationId: string, items: readonly DesktopDragItem[]) => void;
  /** Whether the conversation takes files dragged onto the window. */
  canTakeFiles?: (conversationId: string) => boolean;
  /** A line the transcript of a conversation starts with, by conversation `id`. */
  transcriptStart?: ReadonlyMap<string, ReactNode>;
  /** Called with the conversation's `id` as the user types a message into it. */
  onTyping?: (conversationId: string) => void;
  /**
   * A message to start from outside, such as a link shared from another app (Share > Messages):
   * each new `key` starts a new conversation, as the compose button does, or shows the one still
   * being composed, with `text` in its message field, and the To field takes the keyboard. The
   * person names the recipient and sends it; nothing is sent by itself.
   */
  composeText?: { key: number; text: string };
  /**
   * Files shared with Messages: each share, once for its key, starts a new message that carries
   * them. They show over the message field, each can be taken off, and they go to whoever it is
   * sent to through `onStartConversation`.
   */
  composeFiles?: readonly { key: number; items: readonly DesktopDragItem[] }[];
  /** Hears the files new messages carry now, whenever they change: the desktop keeps them. */
  onDraftFilesChange?: (files: readonly DesktopDragItem[]) => void;
  /** The account a FaceTime call from this conversation goes to, where it has one other person. */
  faceTimeWith?: (id: string) => string | null;
  /**
   * The conversation of two already open with an account, which a message to that person
   * (`composeTo`) shows in place of a new message.
   */
  conversationWith?: (account: string) => string | null;
  /** A message to start, once for each key, with `to` in its To field. */
  composeTo?: { key: number; to: string; text?: string };
  /** A conversation another application asks to see, shown as soon as the list has it. */
  openConversation?: { key: number; id: string };
  /**
   * The conversation to go back to, shown as soon as the list has it, unless the person has chosen
   * or started another by then.
   */
  returnTo?: string;
  /** What was left typed in each conversation, put into those fields as it becomes known. */
  keptTexts?: ReadonlyMap<string, string>;
  /**
   * Called when the person changes what is typed in a conversation that has begun, with the text
   * it now holds: never for what `keptTexts` put there.
   */
  onTextChange?: (id: string, text: string) => void;
  /**
   * Whether the conversation can be left (a group the owner holds). Its Details then offer
   * Leave this Conversation, which calls `onLeaveConversation`.
   */
  canLeaveConversation?: (conversationId: string) => boolean;
  /**
   * Called when Leave this Conversation is chosen. The owner leaves it and answers whether it
   * did: the window then shows no conversation; otherwise the conversation stays, and the owner
   * says why in `notices`.
   */
  onLeaveConversation?: (conversationId: string) => Promise<boolean>;
  /** Whether File > Delete Conversation… is offered; every conversation when not given. */
  canDeleteConversation?: (conversationId: string) => boolean;
  /**
   * Called when Delete Conversation… is confirmed. The owner deletes it and answers whether it
   * did; without one, the window takes it out of its own list.
   */
  onDeleteConversation?: (conversationId: string) => Promise<boolean>;
  /**
   * The conversations with Do Not Disturb on, when the owner keeps the setting (a desktop served
   * by its Ferrite application keeps it on the server, per account). Given with
   * `onMutedChange`, it decides the Details checkbox and the list's moon for every conversation;
   * without them each conversation's own `muted` does, kept as long as the window is mounted.
   */
  mutedConversations?: ReadonlySet<string>;
  /** Called when Do Not Disturb is turned on or off in a conversation's Details. */
  onMutedChange?: (conversationId: string, muted: boolean) => void;
  /**
   * Called when Edit > Clear Chat Transcript is confirmed. The owner clears it and answers whether
   * it did; without one, the window empties its own copy. Offered where `canDeleteConversation` is.
   */
  onClearTranscript?: (conversationId: string) => Promise<boolean>;
  /** Whether a bubble's menu offers Delete…; every message when not given. */
  canDeleteMessage?: (conversationId: string, message: MessagesMessage) => boolean;
  /**
   * Called when Delete… on a bubble is confirmed. The owner deletes it and answers whether it did;
   * without one, the window takes it out of its own copy.
   */
  onDeleteMessage?: (conversationId: string, message: MessagesMessage) => Promise<boolean>;
  /** What the View menu has set, when the owner keeps it. Use with `onViewChange`. */
  view?: MessagesView;
  /** Called with all of it when the View menu changes something. */
  onViewChange?: (view: MessagesView) => void;
  /** What the desktop was asked to open this window for: read by `MessagesLive`. */
  opening?: unknown;
  /**
   * This window shows one conversation, opened by Open in Separate Window: no list, and it stays on
   * that conversation.
   */
  onlyConversation?: string;
  /** The row's Open in Separate Window; without it the item is absent. */
  onOpenSeparately?: (conversationId: string) => void;
  /** Told of the window's root element, once. */
  onWindowElement?: (element: HTMLDivElement | null) => void;
  /**
   * Opens the character palette from the emoji button, where the host has one (the desktop's
   * Emoji & Symbols). Without it the button adds one emoji.
   */
  onEmojiPalette?: () => void;
  /** The one other person of a conversation and whether they are blocked; `null` without one. */
  blockedPerson?: (conversationId: string) => { name: string; blocked: boolean } | null;
  /** Called when Block Person… is confirmed, or Unblock Person chosen. */
  onBlockChange?: (conversationId: string, blocked: boolean) => void;
}

/**
 * Messages, as in macOS 10.15 Catalina: a list of conversations with the window controls, a
 * search field and the compose button over it, and beside it the selected conversation with
 * its recipient, its transcript of bubbles and the field a message is typed in. Return sends
 * the message into the conversation.
 *
 * The root is the library's `Window` and takes every one of its props, so a page or a window
 * manager places it (`style`, `width`, `height`, `ref`), tells it whether it is key (`state`)
 * and hears its window controls and its drag region through the callbacks. The Preferences
 * window is a window of its own, rendered beside this one. Messages is simulated: nothing is
 * sent anywhere and nothing is stored beyond the component's life.
 */
export function Messages({
  defaultConversations = initialConversations,
  onHelp,
  defaultConversation,
  onConversationChange,
  heldMessages,
  onSend,
  onRetry,
  notices,
  now = DEFAULT_NOW,
  material = "translucent",
  settings: givenSettings,
  defaultSettings = DEFAULT_SETTINGS,
  onSettingsChange,
  preferencesOpen,
  defaultPreferencesOpen = false,
  onPreferencesOpenChange,
  preferencesOffset = PREFERENCES_OFFSET,
  windowsContainer,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  extraConversations,
  onStartConversation,
  recipientSuggestions,
  renderMessageExtras,
  renderMessageMenu,
  renderDetails,
  onSendFile,
  onOpenFile,
  renderInputAccessory,
  renderAudioButton,
  isNewMessage,
  onDropFiles,
  canTakeFiles,
  transcriptStart,
  onTyping,
  composeText,
  composeFiles,
  onDraftFilesChange,
  faceTimeWith,
  conversationWith,
  composeTo,
  openConversation,
  returnTo,
  keptTexts,
  onTextChange,
  canLeaveConversation,
  onLeaveConversation,
  canDeleteConversation,
  onDeleteConversation,
  mutedConversations,
  onMutedChange,
  onClearTranscript,
  canDeleteMessage,
  onDeleteMessage,
  view: givenView,
  onViewChange,
  opening: _opening,
  onlyConversation,
  onOpenSeparately,
  onWindowElement,
  onEmojiPalette,
  blockedPerson,
  onBlockChange,
  state = "key",

  width = 730,
  height = 520,
  className,
  style,
  ref,
  onKeyDown,
  onPointerDownCapture,
  ...props
}: MessagesProps) {
  // In the order of the list: the conversation last heard from, or just sent to, first.
  const [ownConversations, setConversations] = useState(() => byRecency(defaultConversations));
  // Every id `send` has given a message, so none is given twice.
  const issued = useRef(new Set<string>());
  // The conversation the compose button started, until a message is sent to it: it is given
  // up when another conversation is chosen.
  const [draftId, setDraftId] = useState<string | null>(null);
  // A conversation whose messages the owner holds shows those. They change from outside (a
  // message from another browser), so the list is put back in order by recency, except the
  // conversation still being composed, which keeps its place.
  const listed = useMemo(() => {
    if (!heldMessages && !extraConversations) return ownConversations;
    const extraIds = new Set(extraConversations?.map((conversation) => conversation.id));
    const listed = extraConversations
      ? [
          ...ownConversations.filter((conversation) => !extraIds.has(conversation.id)),
          ...extraConversations,
        ]
      : ownConversations;
    const shown = listed.map((conversation) => {
      const held = heldMessages?.get(conversation.id);
      return held ? { ...conversation, messages: held } : conversation;
    });
    const place = shown.findIndex((conversation) => conversation.id === draftId);
    const ordered = [...byRecency(shown.filter((conversation) => conversation.id !== draftId))];
    const draft = shown[place];
    if (draft) ordered.splice(place, 0, draft);
    return ordered;
  }, [ownConversations, heldMessages, extraConversations, draftId]);
  // Do Not Disturb as the owner keeps it, when it does.
  const conversations = useMemo(
    () =>
      mutedConversations === undefined
        ? listed
        : listed.map((conversation) =>
            mutedConversations.has(conversation.id) === (conversation.muted === true)
              ? conversation
              : { ...conversation, muted: mutedConversations.has(conversation.id) },
          ),
    [listed, mutedConversations],
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (onlyConversation) return onlyConversation;
    const first = conversations[0]?.id ?? null;
    if (defaultConversation === null) return null;
    // An id that no conversation has is as good as none given.
    return conversations.some((conversation) => conversation.id === defaultConversation)
      ? (defaultConversation ?? first)
      : first;
  });
  // The conversation shown now, for an answer that arrives later.
  const selectedNow = useRef(selectedId);
  selectedNow.current = selectedId;
  // The conversations that had no recipient when they were given or started: the recipient
  // can be typed until a message is sent, also once the first letters make a name of it.
  const [unnamed, setUnnamed] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        conversations
          .filter((conversation) => conversation.name.trim() === "")
          .map((conversation) => conversation.id),
      ),
  );
  // Drafts whose conversation the owner is starting (`onStartConversation` not yet answered).
  const [starting, setStarting] = useState<ReadonlySet<string>>(() => new Set());
  const [query, setQuery] = useState("");
  // What is typed and not sent, by conversation, so each keeps its own. A map, not an object:
  // a conversation may have any id, also "constructor" or "__proto__".
  const [texts, setTexts] = useState<ReadonlyMap<string, string>>(() => new Map());
  const textsNow = useRef(texts);
  textsNow.current = texts;
  const textChange = useRef(onTextChange);
  textChange.current = onTextChange;
  const setText = (id: string, text: (before: string) => string) => {
    const next = text(textsNow.current.get(id) ?? "");
    textsNow.current = new Map(textsNow.current).set(id, next);
    setTexts(textsNow.current);
    // Typing in the conversation shown chooses it: nothing goes back over it, and it is the one kept.
    if (!chosenHere.current) {
      chosenHere.current = true;
      onConversationChange?.(id);
    }
    // A conversation not started yet has no id to come back to.
    if (!unnamed.has(id)) textChange.current?.(id, next);
  };
  useEffect(() => {
    if (!keptTexts?.size) return;
    setTexts((all) => new Map([...keptTexts, ...all]));
  }, [keptTexts]);
  // Whether the person has chosen a conversation: nothing goes back over that.
  // A separate window learns its conversation after it opens (it reads its own id): it goes there, once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only its one conversation moves this
  useEffect(() => {
    if (!onlyConversation) return;
    setSelectedId(onlyConversation);
    onConversationChange?.(onlyConversation);
  }, [onlyConversation]);
  const chosenHere = useRef(false);
  const [ownSettings, setOwnSettings] = useState(defaultSettings);
  const settings = givenSettings ?? ownSettings;
  const setSettings = (next: MessagesSettings) => {
    setOwnSettings(next);
    onSettingsChange?.(next);
  };
  const [details, setDetails] = useState(false);
  const [ownView, setOwnView] = useState(DEFAULT_VIEW);
  const view = onlyConversation
    ? { ...(givenView ?? ownView), listHidden: true }
    : (givenView ?? ownView);
  const setView = (next: MessagesView) => {
    setOwnView(next);
    onViewChange?.(next);
  };
  // The conversations selected besides the one shown, with Command or Shift: at least two, or none.
  const [marked, setMarked] = useState<readonly string[]>([]);
  // The conversations Delete Conversation… asks about, while its alert is open.
  const [deleting, setDeleting] = useState<readonly MessagesConversation[]>([]);
  // The conversation being left (`onLeaveConversation` not yet answered).
  const [leaving, setLeaving] = useState<string | null>(null);
  // The present every time is written against; text that is not a stamp is the default's.
  const present = presentOf(now);

  const [ownPreferences, setOwnPreferences] = useState(defaultPreferencesOpen);
  const preferences = preferencesOpen ?? ownPreferences;
  const setPreferences = (open: boolean) => {
    setOwnPreferences(open);
    onPreferencesOpenChange?.(open);
  };
  // Which of the app's two windows is in front. Preferences that have closed give way.
  const [wanted, setWanted] = useState<Front>(preferences ? "preferences" : "window");
  // Preferences opened from outside (a menu bar's command) come to the front as well.
  const [wasOpen, setWasOpen] = useState(preferences);
  if (wasOpen !== preferences) {
    setWasOpen(preferences);
    if (preferences) setWanted("preferences");
  }
  const front: Front = wanted === "preferences" && !preferences ? "window" : wanted;
  // The app's front window has the state the manager gives the app; the other is behind it.
  const stateOf = (window: Front): WindowState =>
    front === window || state === "inactive" ? state : "inactive";

  const serial = useRef(0);
  // An id that no conversation has: the ones given at first may use any.
  const fresh = () => {
    let id: string;
    do {
      serial.current += 1;
      id = `new-${serial.current}`;
    } while (conversations.some((conversation) => conversation.id === id));
    return id;
  };

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const takesFiles = selected !== null && (canTakeFiles?.(selected.id) ?? false);
  const dropRef = useDesktopDrop<Element>({
    accepts: () => true,
    onDrop: (items) => {
      if (selectedNow.current) onDropFiles?.(selectedNow.current, items);
    },
    enabled: takesFiles,
  });
  // The pane is the library's, which takes no ref.
  useEffect(() => dropRef(root.current?.querySelector(".mac-messages-pane") ?? null), [dropRef]);
  const searching = query.trim() !== "";
  const visible = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          matches(conversation, query) &&
          (view.senders === "all" || conversation.unknown === true || conversation.id === draftId),
      ),
    [conversations, query, view.senders, draftId],
  );

  const field = useRef<HTMLTextAreaElement>(null);
  const tools = useMessageFieldTools(field);
  useReceivedSound(conversations, settings, isNewMessage, onlyConversation !== undefined);
  // The field is as tall as its lines, up to the height the stylesheet allows.
  const typed = selected ? (texts.get(selected.id) ?? "") : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the text changes
  useLayoutEffect(() => {
    const input = field.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [typed]);
  // The recipient's field takes the keyboard when the compose button starts a conversation,
  // and again when the button is pressed while that conversation is still the new one. A
  // conversation that was given without a recipient does not take it from the page.
  const recipient = useRef<HTMLInputElement>(null);
  const [composed, setComposed] = useState(0);
  useLayoutEffect(() => {
    if (composed > 0) recipient.current?.focus();
  }, [composed]);

  // The transcript shows its end when a conversation is chosen and when a message is added.
  const transcript = useRef<HTMLDivElement>(null);
  const count = selected?.messages.length ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for a new conversation, a new message and a new text size
  useLayoutEffect(() => {
    const view = transcript.current;
    if (view) view.scrollTop = view.scrollHeight;
  }, [selectedId, count, settings.textSize]);

  const select = (id: string | null) => {
    setMarked([]);
    if (onlyConversation || id === selectedId) return;
    // A conversation that was started and never sent to is given up, with what was typed
    // into it.
    if (draftId !== null && id !== draftId) {
      const left = abandon({ conversations, unnamed, texts }, draftId);
      setConversations(left.conversations);
      setUnnamed(left.unnamed);
      setTexts(left.texts);
      setFilesOf(draftId, () => []);
      setDraftId(null);
    }
    setDetails(false);
    setSelectedId(id);
    chosenHere.current = true;
    onConversationChange?.(id);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: only the list or the conversation asked for asks this again
  useEffect(() => {
    if (!chosenHere.current && returnTo && conversations.some((each) => each.id === returnTo)) {
      select(returnTo);
    }
  }, [returnTo, conversations]);

  const [askedConversation, setAskedConversation] = useState<string | null>(null);
  useEffect(() => {
    if (openConversation) setAskedConversation(openConversation.id);
  }, [openConversation]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the request or the list arriving asks this again
  useEffect(() => {
    if (!conversations.some((each) => each.id === askedConversation)) return;
    setAskedConversation(null);
    setQuery("");
    select(askedConversation);
  }, [askedConversation, conversations]);

  // Starts a new conversation, or shows the one still being composed; `text`, when given, goes
  // into its message field (after what was typed there already). Answers the draft shown. A draft
  // being started is out of reach: what comes now gets a draft of its own.
  const compose = (text?: string, to?: string): string => {
    chosenHere.current = true;
    setQuery("");
    setDetails(false);
    setComposed((count) => count + 1);
    // The conversation that was just started is the new one: its recipient's field is
    // there, and takes the keyboard again. A message to someone else leaves what it holds alone,
    // in the list, and starts one of its own.
    const draft = conversations.find((conversation) => conversation.id === draftId);
    const named = draft?.name.trim() ?? "";
    const elsewhere =
      to !== undefined &&
      draftId !== null &&
      named !== to &&
      (named !== "" || (texts.get(draftId)?.trim() ?? "") !== "");
    if (draftId !== null && !elsewhere && !starting.has(draftId)) {
      if (to !== undefined) change(draftId, { name: to });
      if (text) setText(draftId, (before) => (before.trim() ? `${before} ${text}` : text));
      if (selectedId !== draftId) {
        setSelectedId(draftId);
        onConversationChange?.(draftId);
      }
      return draftId;
    }
    const id = fresh();
    setConversations((all) => [{ id, name: to ?? "", messages: [] }, ...all]);
    setUnnamed((all) => new Set(all).add(id));
    if (text) setText(id, () => text);
    setDraftId(id);
    setSelectedId(id);
    onConversationChange?.(id);
    return id;
  };

  // Files a draft carries, by draft: they go with it and with nothing else.
  const [draftFiles, setDraftFiles] = useState<ReadonlyMap<string, readonly DesktopDragItem[]>>(
    () => new Map(),
  );
  const setFilesOf = (
    id: string,
    change: (files: readonly DesktopDragItem[]) => readonly DesktopDragItem[],
  ) =>
    setDraftFiles((all) => {
      const next = new Map(all);
      const files = change(all.get(id) ?? []);
      if (files.length > 0) next.set(id, files);
      else next.delete(id);
      return next;
    });
  const composedFiles = useRef(0);
  const hearDraftFiles = useRef(onDraftFilesChange);
  hearDraftFiles.current = onDraftFilesChange;
  useEffect(() => {
    hearDraftFiles.current?.([...draftFiles.values()].flat());
  }, [draftFiles]);
  useLayoutEffect(() => {
    const fresh = (composeFiles ?? []).filter(({ key }) => key > composedFiles.current);
    const last = fresh.at(-1);
    if (!last) return;
    composedFiles.current = last.key;
    const id = compose();
    setFilesOf(id, (files) => [...files, ...fresh.flatMap(({ items }) => items)]);
  });

  // A message started from outside (`composeText`), once for each key.
  const composedKey = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!composeText || composedKey.current === composeText.key) return;
    composedKey.current = composeText.key;
    compose(composeText.text);
  });
  // A message to someone started from outside (`composeTo`), once for each key.
  const addressedKey = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!composeTo || addressedKey.current === composeTo.key) return;
    addressedKey.current = composeTo.key;
    const open = composeTo.to ? conversationWith?.(composeTo.to) : null;
    if (!open) {
      compose(composeTo.text, composeTo.to || undefined);
      return;
    }
    setQuery("");
    select(open);
    const { text } = composeTo;
    if (text) setText(open, (before) => (before.trim() ? `${before} ${text}` : text));
  });

  const change = (id: string, patch: Partial<MessagesConversation>) =>
    setConversations((all) =>
      all.map((conversation) =>
        conversation.id === id ? { ...conversation, ...patch } : conversation,
      ),
    );

  // Sends what is typed into the selected conversation, which is the one the transcript
  // the message is its last, under which the status moves; the conversation goes to the top of the
  // list; the field is emptied, unless `given` text was sent in place of what it holds. Nothing is
  // sent to a conversation that has no recipient.
  const send = (given?: string) => {
    if (!selected) return false;
    // A draft whose conversation is being started sends nothing more until the owner answers.
    if (starting.has(selected.id)) return false;
    const text = (given ?? texts.get(selected.id) ?? "").trim();
    const carried = given === undefined ? (draftFiles.get(selected.id) ?? []) : [];
    if ((text === "" && carried.length === 0) || selected.name.trim() === "") return false;
    const taken = new Set(selected.messages.map((message) => message.id));
    let number = selected.messages.length + 1;
    // Ids already given out count as taken too: a conversation the owner holds shows a sent
    // message only once the owner adds it, so two quick sends would otherwise share an id.
    while (taken.has(`${selected.id}-${number}`) || issued.current.has(`${selected.id}-${number}`))
      number += 1;
    issued.current.add(`${selected.id}-${number}`);
    const message: MessagesMessage = {
      id: `${selected.id}-${number}`,
      from: "me",
      text,
      at: present,
    };
    const id = selected.id;
    if (settings.playSounds) playSentSound();
    // A new conversation the owner starts: the owner answers the conversation that holds the
    // message, which takes the new one's place. Until it answers, the draft keeps its text and
    // can be neither edited nor sent again, so nothing typed meanwhile is lost and only one start
    // runs; on a refusal the draft is as it was.
    if (onStartConversation && unnamed.has(id)) {
      const recipients = selected.name.trim();
      const settled = () => setStarting((all) => new Set([...all].filter((other) => other !== id)));
      setStarting((all) => new Set(all).add(id));
      void onStartConversation(recipients, message, id, carried).then((started) => {
        settled();
        if (started === null) return;
        setFilesOf(id, () => []);
        setConversations((all) => all.filter((conversation) => conversation.id !== id));
        setUnnamed((all) => new Set([...all].filter((other) => other !== id)));
        setTexts((all) => {
          const next = new Map(all);
          next.delete(id);
          return next;
        });
        setDraftId((draft) => (draft === id ? null : draft));
        // The new conversation takes the draft's place where the draft is still shown; when
        // another conversation was chosen meanwhile, that one stays shown, and the owner hears
        // of no change.
        if (selectedNow.current === id) {
          selectedNow.current = started;
          setSelectedId(started);
          onConversationChange?.(started);
        }
      }, settled);
      return true;
    }
    // The owner adds a message to a conversation it holds; without `onSend` nothing is sent and
    // what was typed stays.
    const held =
      heldMessages?.has(id) === true ||
      extraConversations?.some((conversation) => conversation.id === id) === true;
    if (held && !onSend) return false;
    setConversations((all) => {
      const target = all.find((conversation) => conversation.id === id);
      if (!target) return all;
      return [
        {
          ...target,
          name: target.name.trim(),
          messages: held ? target.messages : [...target.messages, message],
        },
        ...all.filter((conversation) => conversation.id !== id),
      ];
    });
    if (given === undefined) setText(id, () => "");
    if (draftId === id) setDraftId(null);
    // Its recipient is settled.
    if (unnamed.has(id)) setUnnamed((all) => new Set([...all].filter((other) => other !== id)));
    onSend?.(id, message);
    return true;
  };

  const renderRow = useCallback(
    (index: number) => {
      const conversation = visible[index];
      if (!conversation) return null;
      const last = lastMessage(conversation);
      return (
        <>
          <ListViewRowLeading className="mac-messages-row-avatar">
            {conversation.people && conversation.people.length > 0 ? (
              <PeoplePicture people={conversation.people} />
            ) : (
              <Avatar id={conversation.id} />
            )}
          </ListViewRowLeading>
          <div className="mac-messages-row-head" data-conversation={conversation.id}>
            {conversation.unread ? (
              <NewItemDot aria-label="Unread" className="mac-messages-row-unread" />
            ) : null}
            <span className="mac-messages-row-name">
              {conversation.name.trim() || "New Message"}
            </span>
            {conversation.muted ? (
              <ListViewRowDetail
                role="img"
                aria-label="Do Not Disturb"
                className="mac-messages-row-mark"
              >
                <MessagesGlyph name="moon" size={12} />
              </ListViewRowDetail>
            ) : null}
            {last ? (
              <ListViewRowDetail className="mac-messages-row-time">
                <span className="mac-messages-row-time-text">{listTime(last.at, present)}</span>
              </ListViewRowDetail>
            ) : null}
            {!unnamed.has(conversation.id) && (canDeleteConversation?.(conversation.id) ?? true) ? (
              <span
                aria-hidden
                className="mac-messages-row-delete"
                onMouseDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleting([conversation]);
                }}
              >
                <MessagesGlyph name="remove" size={12} />
              </span>
            ) : null}
          </div>
          <ListViewRowDetail className="mac-messages-row-last">
            <div className="mac-messages-row-snippet">{last?.text}</div>
          </ListViewRowDetail>
        </>
      );
    },
    [visible, present, unnamed, canDeleteConversation],
  );
  const getRowId = useCallback((index: number) => visible[index]?.id ?? index, [visible]);
  const getRowLabel = useCallback(
    (index: number) => visible[index]?.name.trim() || "New Message",
    [visible],
  );

  // The Text size setting: the bubbles' own 13 pt at the captured step. At another step the
  // text of a bubble is set in an element of the demo's own, in that size on lines 3 pt
  // higher; the bubble itself is left as the library draws it and grows around its text.
  const step = textSizeStep(settings.textSize);
  const size = TEXT_SIZES[step] ?? 13;
  const sized = useMemo<CSSProperties | undefined>(
    () =>
      step === DEFAULT_TEXT_SIZE ? undefined : { fontSize: size, lineHeight: `${size + 3}px` },
    [step, size],
  );

  // The messages selected with Command, by conversation: another conversation has none selected.
  const [markedBubbles, setMarkedBubbles] = useState<{
    conversation: string;
    ids: readonly string[];
  } | null>(null);
  const marks =
    selected && markedBubbles?.conversation === selected.id ? markedBubbles.ids : NO_MARKS;
  const markedMessages = selected
    ? selected.messages.filter((message) => marks.includes(message.id))
    : [];
  const markedText = markedMessages.map((message) => message.text).join("\n");

  // The transcript's items: a time over each run of messages that follows a silence, the
  // tail on the last bubble of each writer's turn, and the status under the last one sent.
  const items: ReactNode[] = [];
  if (selected) {
    const all = selected.messages;
    const name = nameOf(selected);
    const title = name ? `${serviceName(selected)} with ${name}` : serviceName(selected);
    // The one message the status stands under: the last that was sent, by its place, since
    // two messages may have been given one id. For the same reason a key says which of them:
    // the id with its count, as a pair, which no other id's key can be.
    const delivered = all.findLastIndex(
      (message) =>
        message.from === "me" && message.undelivered !== true && message.pending !== true,
    );
    const conversationId = selected.id;
    const start = transcriptStart?.get(conversationId);
    if (start) items.push(<MessageStatus key="start">{start}</MessageStatus>);
    const met = new Map<string, number>();
    all.forEach((message, index) => {
      const before = all[index - 1];
      const after = all[index + 1];
      const starts = !before || minutesBetween(before.at, message.at) > RUN_GAP;
      const ends = !after || minutesBetween(message.at, after.at) > RUN_GAP;
      const nth = (met.get(message.id) ?? 0) + 1;
      met.set(message.id, nth);
      // In a group, a received run is headed by its writer's name.
      const named =
        message.from === "them" &&
        message.sender !== undefined &&
        (starts || before?.from !== "them" || before?.sender !== message.sender);
      items.push(
        <Fragment key={JSON.stringify([message.id, nth])}>
          {starts ? (
            <MessageTranscriptHeader title={index === 0 ? title : undefined}>
              {transcriptTime(message.at, present)}
            </MessageTranscriptHeader>
          ) : null}
          {named ? (
            <Label textStyle="small" color="secondary" className="mac-messages-sender">
              {message.sender}
            </Label>
          ) : null}
          <MessageBubble
            data-message-index={index}
            data-marked={marks.includes(message.id) ? "" : undefined}
            className="mac-messages-bubble"
            direction={message.from === "me" ? "sent" : "received"}
            service={selected.service}
            sender={message.from === "me" ? "You" : message.sender || name || "Unknown"}
            tail={ends || after?.from !== message.from || index === delivered}
          >
            {sized ? (
              <span className="mac-messages-text" style={sized}>
                {detectedText(message.text)}
              </span>
            ) : (
              detectedText(message.text)
            )}
          </MessageBubble>
          {renderMessageExtras?.(conversationId, message)}
          {message.undelivered ? (
            <MessageStatus>
              Not Delivered{" "}
              {onRetry ? (
                <PushButton size="mini" onClick={() => onRetry(conversationId, message)}>
                  Try Again
                </PushButton>
              ) : null}
            </MessageStatus>
          ) : index === delivered ? (
            <MessageStatus>{message.status ?? "Delivered"}</MessageStatus>
          ) : null}
        </Fragment>,
      );
    });
    const notice = notices?.get(conversationId);
    if (notice) items.push(<MessageStatus key="notice">{notice}</MessageStatus>);
  }

  // The Preferences window opens over this one, in the element that positions it.
  const root = useRef<HTMLDivElement | null>(null);
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: told once, of the one root
  useLayoutEffect(() => {
    setRootElement(root.current);
    onWindowElement?.(root.current);
  }, []);
  const search = useRef<HTMLInputElement>(null);
  // The bubble a right click landed on, and what Copy takes from it: the selected messages when it
  // is one of them, else the words selected in it, or all of it.
  const [pressedBubble, setPressedBubble] = useState<{
    message: MessagesMessage;
    text: string;
  } | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const pressBubble = (target: EventTarget) => {
    const node = (target as Element).closest<HTMLElement>("[data-message-index]");
    const message = node && selected?.messages[Number(node.dataset.messageIndex)];
    if (!node || !message) return setPressedBubble(null);
    setPressedBubble({
      message,
      text: marks.includes(message.id) ? markedText : selectedIn(node) || message.text,
    });
  };
  // Command-click selects or lets go of a message; a click without it lets go of them all.
  const markBubble = (event: MouseEvent<HTMLElement>) => {
    if (!selected) return;
    if (!event.metaKey && !event.ctrlKey) {
      if (marks.length > 0) setMarkedBubbles(null);
      return;
    }
    const target = event.target as Element;
    const node = target.closest<HTMLElement>("[data-message-index]");
    const message = node && selected.messages[Number(node.dataset.messageIndex)];
    if (!message || target.closest("a, button")) return;
    window.getSelection()?.removeAllRanges();
    setMarkedBubbles({
      conversation: selected.id,
      ids: marks.includes(message.id)
        ? marks.filter((id) => id !== message.id)
        : [...marks, message.id],
    });
  };
  // A double click on a bubble opens what a right click does, with its tapbacks.
  const doubleClickBubble = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as Element;
    if (!target.closest("[data-message-index]") || target.closest("a, button")) return;
    window.getSelection()?.removeAllRanges();
    target.dispatchEvent(
      new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: event.clientX,
        clientY: event.clientY,
      }),
    );
  };
  const copyBubble = () => {
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (!clipboard || !pressedBubble) return setCopyFailed(true);
    clipboard.writeText(pressedBubble.text).catch(() => setCopyFailed(true));
  };
  // What File > Delete Conversation… and the row's menu act on: the rows highlighted in the list,
  // never one a search or the senders' filter hides. With the list hidden, the one shown.
  const deletable = (conversation: MessagesConversation) =>
    !unnamed.has(conversation.id) && (canDeleteConversation?.(conversation.id) ?? true);
  const markedRows = visible.filter((conversation) => marked.includes(conversation.id));
  const highlighted =
    marked.length > 1 ? markedRows : selected && visible.includes(selected) ? [selected] : [];
  const toDelete = (view.listHidden ? (selected ? [selected] : []) : highlighted).filter(deletable);
  // Gone once the owner says so, one at a time; one it refuses stays, with its reason under its
  // transcript. The one after the shown one in the list that is left is shown next.
  const deleteConversations = async (targets: readonly MessagesConversation[]) => {
    const at = visible.findIndex((conversation) => conversation.id === selectedNow.current);
    const gone = new Set<string>();
    for (const target of targets) {
      if (onDeleteConversation && !(await onDeleteConversation(target.id))) continue;
      gone.add(target.id);
    }
    if (!onDeleteConversation) {
      setConversations((all) => all.filter((conversation) => !gone.has(conversation.id)));
    }
    setMarked([]);
    if (!selectedNow.current || !gone.has(selectedNow.current)) return;
    const next =
      [...visible.slice(at + 1), ...visible.slice(0, Math.max(at, 0)).reverse()].find(
        (conversation) => !gone.has(conversation.id),
      ) ?? null;
    selectedNow.current = next?.id ?? null;
    setDetails(false);
    setSelectedId(next?.id ?? null);
    onConversationChange?.(next?.id ?? null);
  };
  // The conversation Clear Chat Transcript asks about, while its alert is open.
  const [clearing, setClearing] = useState<MessagesConversation | null>(null);
  const clearTranscript = async (target: MessagesConversation) => {
    if (onClearTranscript) await onClearTranscript(target.id);
    else change(target.id, { messages: [] });
  };
  // The messages Delete… on a bubble asks about, while its alert is open.
  const [removing, setRemoving] = useState<{
    id: string;
    messages: readonly MessagesMessage[];
  } | null>(null);
  const removeMessages = async ({
    id,
    messages,
  }: {
    id: string;
    messages: readonly MessagesMessage[];
  }) => {
    setMarkedBubbles(null);
    if (onDeleteMessage) {
      for (const message of messages) await onDeleteMessage(id, message);
      return;
    }
    setConversations((all) =>
      all.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              messages: conversation.messages.filter((each) => !messages.includes(each)),
            }
          : conversation,
      ),
    );
  };
  const canRemove = (message: MessagesMessage) =>
    selected !== null && (canDeleteMessage?.(selected.id, message) ?? true);
  const removableMarks = markedMessages.filter(canRemove);
  const person =
    selected && !unnamed.has(selected.id) ? (blockedPerson?.(selected.id) ?? null) : null;
  // The conversation Block Person… asks about, while its alert is open.
  const [blocking, setBlocking] = useState<{ id: string; name: string } | null>(null);
  const faceTimeTarget = selected ? (faceTimeWith?.(selected.id) ?? null) : null;
  const faceTime = faceTimeTarget
    ? (kind: "video" | "audio") =>
        askToReach({
          app: "facetime",
          to: faceTimeTarget,
          name: selected?.name ?? faceTimeTarget,
          kind,
        })
    : null;
  const inviteToChess = faceTimeTarget
    ? () => askToReach({ app: "chess", to: faceTimeTarget, name: selected?.name ?? faceTimeTarget })
    : null;
  // A picture or file put on the clipboard, for a conversation that takes files.
  const takePastedFiles = (pasted: readonly File[]) => {
    if (!selected) return;
    onDropFiles?.(
      selected.id,
      pasted.map((file) => ({
        id: `pasted-${file.name}-${file.size}`,
        name: file.name || "Pasted Image",
        kind: "file",
        type: file.type,
        size: file.size,
        bytes: async () => file,
      })),
    );
  };
  const { paste } = useMessagesMenus({
    within: rootElement,
    isKey: stateOf("window") === "key",
    conversations: visible,
    selectedId,
    onSelect: select,
    onCompose: onlyConversation
      ? () => askToReach({ app: "messages", to: "", name: "" })
      : () => compose(),
    onDeleteConversation: toDelete.length > 0 ? () => setDeleting(toDelete) : null,
    deleteCount: toDelete.length,
    onClearTranscript: selected && deletable(selected) ? () => setClearing(selected) : null,
    view,
    listFixed: onlyConversation !== undefined,
    onViewChange: setView,
    person:
      person && selected
        ? {
            blocked: person.blocked,
            change: () =>
              person.blocked
                ? onBlockChange?.(selected.id, false)
                : setBlocking({ id: selected.id, name: person.name }),
          }
        : null,
    onShowInfo: selected && !unnamed.has(selected.id) ? () => setDetails(true) : null,
    shown: selected && !unnamed.has(selected.id) ? selected : null,
    onFaceTime: faceTime,
    onInviteToChess: inviteToChess,
    onAddToContacts: faceTimeTarget
      ? () =>
          askToReach({
            app: "contacts",
            to: faceTimeTarget,
            name: selected?.name ?? faceTimeTarget,
          })
      : null,
    onSendFile:
      selected && onSendFile && !unnamed.has(selected.id) ? () => onSendFile(selected.id) : null,
    onOpenFile: onOpenFile ?? null,
    onPasteFiles: takesFiles ? takePastedFiles : null,
    copied: marks.length > 0 ? markedText : null,
    tools,
    field,
    search,
    textSize: settings.textSize,
    onTextSize: (textSize) => setSettings({ ...settings, textSize }),
  });
  const [host, setHost] = useState<{ element: HTMLElement; left: number; top: number } | null>(
    null,
  );
  // The level the window is painted at, as the browser computes it: what a custom property or
  // a `calc()` in the owner's `z-index` comes to. Null where it is not a number.
  const [resolved, setResolved] = useState<number | null>(null);
  // After every render while it is open, so that it follows a window that its owner moves
  // (`style`, a window manager's frame); nothing is set while nothing changed.
  useLayoutEffect(() => {
    const element = root.current;
    if (!preferences || !element) return;
    const view = element.ownerDocument.defaultView;
    const computed = Number.parseInt(view?.getComputedStyle(element).zIndex ?? "", 10);
    setResolved(Number.isNaN(computed) ? null : computed);
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

  // Command-comma, or Control-comma off Apple platforms: the Preferences command, from
  // either of the app's windows.
  const preferencesShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "," && (event.metaKey || event.ctrlKey) && !event.defaultPrevented) {
      event.preventDefault();
      setPreferences(true);
      setWanted("preferences");
    }
  };

  // The window has no title bar: the strip over the list and the bar over the transcript are
  // its drag regions, through the library's helper (window.mdx, "Without a title bar").
  const dragRegion = windowDragRegion<HTMLDivElement>(
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
  );

  // The recipient can be typed in a conversation that has none settled yet.
  const drafting = selected !== null && unnamed.has(selected.id);
  // The contacts the To field offers for the name being typed (after the last comma).
  const typedNames = drafting ? splitRecipients(selected.name) : [];
  const typedName =
    drafting && !/,\s*$/.test(selected.name) ? (typedNames.at(-1) ?? "").toLowerCase() : "";
  const suggestions =
    drafting && typedName !== "" && recipientSuggestions
      ? recipientSuggestions
          .filter((name) => name.toLowerCase().includes(typedName))
          .filter((name) => !selected.name.includes(name))
          .slice(0, 6)
      : [];
  const suggest = (name: string) => {
    if (!selected) return;
    // Every name typed but the one being completed.
    const before = /,\s*$/.test(selected.name)
      ? splitRecipients(selected.name)
      : splitRecipients(selected.name).slice(0, -1);
    change(selected.id, { name: [...before, name].join(", ") });
    recipient.current?.focus();
  };

  // While the window shows its own Preferences the two are ordered by which is in front:
  // the window keeps the level its owner gave it (`style.zIndex`), or takes 1, and the
  // Preferences are one above it or one below. The owner's level may be a number, a number
  // as text, or an expression such as a custom property: the Preferences count from what
  // the browser computes it to for the window (`resolved`), since they are an element of
  // their own beside the window, where a property set on the window means nothing. Where
  // nothing is computed, a number is counted from and anything else is added to with
  // `calc()`. A keyword (`auto`, `inherit`, `initial`, `unset`, `revert`) names no level to
  // count from, and is as good as none given.
  const stacked = host !== null && preferences;
  const given = style?.zIndex;
  const none =
    given === undefined ||
    (typeof given === "string" &&
      /^\s*(|auto|inherit|initial|unset|revert|revert-layer)\s*$/i.test(given));
  const level = none
    ? 1
    : typeof given === "string" && /^\s*-?\d+\s*$/.test(given)
      ? Number(given)
      : given;
  const beside = (by: 1 | -1) => {
    if (typeof level === "number") return level + by;
    return resolved === null ? `calc(${level} ${by > 0 ? "+" : "-"} 1)` : resolved + by;
  };

  // Over the list, or over the transcript when the list is hidden.
  const controls = (
    <WindowControls
      className="mac-messages-controls"
      onClose={onClose}
      onMinimize={onMinimize}
      onZoom={onZoom}
      zoomRole={zoomRole}
      minimizeDisabled={minimizeDisabled}
      zoomDisabled={zoomDisabled}
      {...controlsProps}
    />
  );

  return (
    <>
      <Alert open={copyFailed} onOpenChange={setCopyFailed}>
        <AlertPopup>
          <AlertMessage>The message could not be copied.</AlertMessage>
          <AlertInformativeText>The browser refused the clipboard.</AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={clearing !== null} onOpenChange={(open) => !open && setClearing(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to clear the transcript of your conversation with {clearing?.name}
            ?
          </AlertMessage>
          <AlertInformativeText>
            The messages go from this account only, and cannot be brought back. The others keep
            theirs.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                if (clearing) void clearTranscript(clearing);
              }}
            >
              Clear
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertPopup>
          <AlertMessage>
            {removing && removing.messages.length > 1
              ? `Are you sure you want to delete these ${removing.messages.length} messages?`
              : "Are you sure you want to delete this message?"}
          </AlertMessage>
          <AlertInformativeText>
            {removing && removing.messages.length > 1
              ? "They go from this account only, and cannot be brought back. The others keep theirs."
              : "It goes from this account only, and cannot be brought back. The others keep theirs."}
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                if (removing) void removeMessages(removing);
              }}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={blocking !== null} onOpenChange={(open) => !open && setBlocking(null)}>
        <AlertPopup>
          <AlertMessage>Are you sure you want to block {blocking?.name}?</AlertMessage>
          <AlertInformativeText>
            You will not get their messages or notifications while they are blocked, and they are
            not told.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                if (blocking) onBlockChange?.(blocking.id, true);
              }}
            >
              Block
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={deleting.length > 0} onOpenChange={(open) => !open && setDeleting([])}>
        <AlertPopup>
          <AlertMessage>
            {deleting.length > 1
              ? `Are you sure you want to delete these ${deleting.length} conversations?`
              : `Are you sure you want to delete this conversation with ${deleting[0]?.name}?`}
          </AlertMessage>
          <AlertInformativeText>
            It goes from this account only, and comes back when someone sends something new.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                void deleteConversations(deleting);
              }}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Window
        aria-label="Messages"
        ref={(node) => {
          root.current = node;
          if (typeof ref === "function") return ref(node);
          if (ref) ref.current = node;
        }}
        state={stateOf("window")}
        width={width}
        height={height}
        className={className ? `mac-messages ${className}` : "mac-messages"}
        style={stacked ? { ...style, zIndex: none ? 1 : given } : style}
        data-front={stacked && front === "window" ? "" : undefined}
        onPointerDownCapture={(event) => {
          onPointerDownCapture?.(event);
          setWanted("window");
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          preferencesShortcut(event);
        }}
        {...props}
      >
        <SplitView className="mac-messages-split" style={SPLIT}>
          {view.listHidden ? null : (
            <>
              <SplitViewPane
                defaultSize={270}
                minSize={200}
                maxSize={400}
                className="mac-messages-list-pane"
                data-material={material}
              >
                <div className="mac-messages-top" {...dragRegion}>
                  {controls}
                  <SearchField
                    variant="sidebar"
                    className="mac-messages-search"
                    style={SEARCH}
                    aria-label="Search"
                    inputRef={search}
                    value={query}
                    onValueChange={setQuery}
                  />
                  <PushButton
                    compact
                    className="mac-messages-compose"
                    style={COMPOSE}
                    aria-label="Compose new message"
                    onClick={() => compose()}
                  >
                    <MessagesGlyph name="compose" />
                  </PushButton>
                </div>
                {visible.length === 0 ? (
                  <EmptyState
                    role={searching ? "status" : undefined}
                    className="mac-messages-empty"
                  >
                    {searching ? "No Results" : "No Conversations"}
                  </EmptyState>
                ) : (
                  <ContextualMenu>
                    <ContextualMenuTrigger
                      className="mac-messages-list-menu"
                      onContextMenu={(event) => {
                        // The row under the pointer is the one its commands act on, with the others
                        // selected when it is one of them.
                        const id = (event.target as Element)
                          .closest('[role="option"]')
                          ?.querySelector<HTMLElement>("[data-conversation]")?.dataset.conversation;
                        if (id && !marked.includes(id)) select(id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Backspace" && event.key !== "Delete") return;
                        event.preventDefault();
                        if (toDelete.length > 0) setDeleting(toDelete);
                      }}
                    >
                      <ListView
                        className="mac-messages-list"
                        style={LIST}
                        aria-label="Conversations"
                        emphasis="always"
                        count={visible.length}
                        rowHeight={64}
                        separator="inset"
                        emptyRows="separator"
                        separatorInset={77}
                        renderRow={renderRow}
                        getRowId={getRowId}
                        getRowLabel={getRowLabel}
                        selectionMode="multiple"
                        value={
                          marked.length > 1 ? [...marked] : selectedId === null ? [] : [selectedId]
                        }
                        onValueChange={(next) => {
                          const ids = next.filter((id): id is string => typeof id === "string");
                          if (ids.length < 2) {
                            select(ids[0] ?? null);
                            return;
                          }
                          if (selectedId === null || !ids.includes(selectedId)) {
                            select(ids.at(-1) ?? null);
                          }
                          setMarked(ids);
                        }}
                        onRowAction={() => field.current?.focus()}
                      />
                    </ContextualMenuTrigger>
                    <ContextualMenuPopup aria-label="Conversation commands">
                      <MenuItem
                        disabled={!selected || unnamed.has(selected.id)}
                        onClick={() => setDetails(true)}
                      >
                        Details
                      </MenuItem>
                      {onOpenSeparately ? (
                        <MenuItem
                          disabled={!selected || unnamed.has(selected.id)}
                          onClick={() => selected && onOpenSeparately(selected.id)}
                        >
                          Open in Separate Window
                        </MenuItem>
                      ) : null}
                      <MenuCheckboxItem
                        disabled={!selected}
                        checked={selected?.muted === true}
                        onCheckedChange={(muted) => {
                          if (!selected) return;
                          if (mutedConversations !== undefined && onMutedChange) {
                            onMutedChange(selected.id, muted);
                          } else change(selected.id, { muted });
                        }}
                      >
                        Do Not Disturb
                      </MenuCheckboxItem>
                      <MenuSeparator />
                      <MenuItem
                        disabled={toDelete.length === 0}
                        onClick={() => setDeleting(toDelete)}
                      >
                        {toDelete.length > 1
                          ? `Delete ${toDelete.length} Conversations…`
                          : "Delete Conversation…"}
                      </MenuItem>
                    </ContextualMenuPopup>
                  </ContextualMenu>
                )}
              </SplitViewPane>
              <SplitViewDivider aria-label="Resize the conversation list" />
            </>
          )}
          <SplitViewPane minSize={300} className="mac-messages-pane">
            <MessageEffectLayer
              conversationId={selected?.id ?? null}
              message={selected ? (lastMessage(selected) ?? null) : null}
              isNew={(message) =>
                selected !== null && (isNewMessage?.(selected.id, message) ?? false)
              }
            />
            <div className="mac-messages-header" {...dragRegion}>
              {view.listHidden ? controls : null}
              <Label color="secondary" textStyle="callout" className="mac-messages-to">
                To:
              </Label>
              {drafting ? (
                <TextField
                  bezel="none"
                  className="mac-messages-recipient"
                  aria-label="To"
                  value={selected.name}
                  readOnly={starting.has(selected.id)}
                  inputRef={recipient}
                  onDrop={(event) => {
                    // A contact dragged from Contacts carries its name: its account comes from the
                    // contacts offered, as when it is chosen from them.
                    const names = event.dataTransfer
                      .getData("text/plain")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean);
                    if (names.length === 0) return;
                    event.preventDefault();
                    change(selected.id, {
                      name: [
                        ...splitRecipients(selected.name),
                        ...names.map(
                          (name) =>
                            recipientSuggestions?.find((each) => each.startsWith(name)) ?? name,
                        ),
                      ].join(", "),
                    });
                  }}
                  onValueChange={(name) => change(selected.id, { name })}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    field.current?.focus();
                  }}
                />
              ) : (
                <Label truncate className="mac-messages-recipient">
                  {selected?.name}
                </Label>
              )}
              {selected && !drafting ? (
                <Popover open={details} onOpenChange={setDetails}>
                  {/* The link is the library's borderless button, in its link colour. */}
                  <PopoverTrigger
                    render={<BorderlessButton color="link" className="mac-messages-details" />}
                  >
                    Details
                  </PopoverTrigger>
                  <PopoverPopup side="bottom" align="end">
                    <div className="mac-messages-details-content">
                      <PopoverTitle>{selected.name}</PopoverTitle>
                      <Checkbox
                        checked={selected.muted === true}
                        onCheckedChange={(muted) =>
                          mutedConversations !== undefined && onMutedChange
                            ? onMutedChange(selected.id, muted)
                            : change(selected.id, { muted })
                        }
                      >
                        Do Not Disturb
                      </Checkbox>
                      {faceTime ? (
                        <div className="mac-messages-details-actions">
                          <PushButton size="small" onClick={() => faceTime("video")}>
                            FaceTime Video
                          </PushButton>
                          <PushButton size="small" onClick={() => faceTime("audio")}>
                            FaceTime Audio
                          </PushButton>
                        </div>
                      ) : faceTimeWith ? (
                        <div className="mac-messages-details-actions">
                          <PushButton
                            size="small"
                            disabled
                            focusableWhenDisabled
                            title={NO_FACETIME}
                          >
                            FaceTime Video
                          </PushButton>
                          <PushButton
                            size="small"
                            disabled
                            focusableWhenDisabled
                            title={NO_FACETIME}
                          >
                            FaceTime Audio
                          </PushButton>
                        </div>
                      ) : null}
                      <SendLocationButton
                        onSend={(text) => {
                          send(text);
                        }}
                      />
                      {renderDetails?.(selected.id)}
                      {onLeaveConversation && canLeaveConversation?.(selected.id) ? (
                        <PushButton
                          size="small"
                          className="mac-messages-leave"
                          disabled={leaving === selected.id}
                          onClick={() => {
                            const id = selected.id;
                            setLeaving(id);
                            void onLeaveConversation(id).then(
                              (left) => {
                                setLeaving((now) => (now === id ? null : now));
                                if (!left) return;
                                setDetails(false);
                                if (selectedNow.current === id) {
                                  selectedNow.current = null;
                                  setSelectedId(null);
                                  onConversationChange?.(null);
                                }
                              },
                              () => setLeaving((now) => (now === id ? null : now)),
                            );
                          }}
                        >
                          Leave this Conversation
                        </PushButton>
                      ) : null}
                    </div>
                  </PopoverPopup>
                </Popover>
              ) : null}
            </div>
            {suggestions.length > 0 ? (
              <fieldset aria-label="Contacts" className="mac-messages-suggestions">
                {suggestions.map((name) => (
                  <BorderlessButton key={name} onClick={() => suggest(name)}>
                    {name}
                  </BorderlessButton>
                ))}
              </fieldset>
            ) : null}
            {selected ? (
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-messages-list-menu"
                  onContextMenu={(event) => pressBubble(event.target)}
                  onClick={markBubble}
                  onDoubleClick={doubleClickBubble}
                  onCopy={(event) => {
                    if (marks.length === 0) return;
                    event.preventDefault();
                    event.clipboardData.setData("text/plain", markedText);
                  }}
                  onKeyDown={(event) => {
                    if (marks.length === 0) return;
                    if (event.key === "Escape") setMarkedBubbles(null);
                    if (event.key !== "Backspace" && event.key !== "Delete") return;
                    event.preventDefault();
                    if (removableMarks.length > 0) {
                      setRemoving({ id: selected.id, messages: removableMarks });
                    }
                  }}
                >
                  <ScrollView
                    className="mac-messages-transcript"
                    viewportProps={{ ref: transcript, tabIndex: 0 }}
                  >
                    <MessageTranscript
                      aria-label={
                        nameOf(selected)
                          ? `Conversation with ${nameOf(selected)}`
                          : "New conversation"
                      }
                    >
                      {items}
                    </MessageTranscript>
                  </ScrollView>
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Message commands">
                  <MenuItem disabled={!pressedBubble} onClick={copyBubble}>
                    Copy
                  </MenuItem>
                  {pressedBubble ? renderMessageMenu?.(selected.id, pressedBubble.message) : null}
                  {pressedBubble && canRemove(pressedBubble.message) ? (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        onClick={() =>
                          setRemoving({
                            id: selected.id,
                            messages: marks.includes(pressedBubble.message.id)
                              ? removableMarks
                              : [pressedBubble.message],
                          })
                        }
                      >
                        {marks.includes(pressedBubble.message.id) && removableMarks.length > 1
                          ? `Delete ${removableMarks.length} Messages…`
                          : "Delete…"}
                      </MenuItem>
                    </>
                  ) : null}
                </ContextualMenuPopup>
              </ContextualMenu>
            ) : (
              <EmptyState className="mac-messages-empty-transcript">
                No Conversation Selected
              </EmptyState>
            )}
            {selected && draftFiles.has(selected.id) ? (
              <ul aria-label="Files to send" className="mac-messages-draft-files">
                {(draftFiles.get(selected.id) ?? []).map((file) => (
                  <li key={file.id} className="mac-messages-draft-file">
                    <Label textStyle="small">{file.name}</Label>
                    <PushButton
                      size="mini"
                      aria-label={`Remove ${file.name}`}
                      disabled={starting.has(selected.id)}
                      onClick={() =>
                        setFilesOf(selected.id, (files) =>
                          files.filter((each) => each.id !== file.id),
                        )
                      }
                    >
                      Remove
                    </PushButton>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mac-messages-input">
              {renderInputAccessory?.(selected?.id ?? null)}
              <ContextualMenu>
                <ContextualMenuTrigger className="mac-messages-field-menu">
                  <TextFieldBezel
                    bezel="capsule"
                    className="mac-messages-field"
                    disabled={!selected}
                  >
                    <textarea
                      {...tools.fieldProps}
                      ref={field}
                      rows={1}
                      className="mac-text-field-input mac-messages-field-input"
                      aria-label="Message"
                      placeholder={selected ? serviceName(selected) : "iMessage"}
                      onDrop={(event) => {
                        // Text is the browser's to place under the pointer. A link dragged as an
                        // address alone (a Safari bookmark) it does not take everywhere.
                        const link = event.dataTransfer.getData("text/uri-list");
                        if (!link || !selected || event.dataTransfer.getData("text/plain")) return;
                        event.preventDefault();
                        setText(selected.id, (before) => (before ? `${before} ${link}` : link));
                      }}
                      onPasteCapture={(event) => {
                        if (!takesFiles || !selected) return;
                        const copied = copiedDriveItems();
                        if (copied.length > 0) {
                          event.preventDefault();
                          onDropFiles?.(selected.id, [...copied]);
                          return;
                        }
                        // A picture on the clipboard goes as an attachment; text with it stays text.
                        const pasted = [...event.clipboardData.files];
                        if (
                          pasted.length === 0 ||
                          event.clipboardData.getData("text/plain") !== ""
                        ) {
                          return;
                        }
                        event.preventDefault();
                        takePastedFiles(pasted);
                      }}
                      disabled={!selected}
                      readOnly={selected ? starting.has(selected.id) : false}
                      aria-busy={selected && starting.has(selected.id) ? true : undefined}
                      value={typed}
                      onChange={(event) => {
                        if (!selected) return;
                        const text = event.target.value;
                        setText(selected.id, () => text);
                        if (text !== "" && !unnamed.has(selected.id)) onTyping?.(selected.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                        event.preventDefault();
                        if (event.altKey) {
                          document.execCommand("insertText", false, "\n");
                          return;
                        }
                        // A conversation without a recipient needs one first.
                        if (!send() && drafting && selected?.name.trim() === "") {
                          recipient.current?.focus();
                        }
                      }}
                    />
                    <ImageButton
                      aria-label="Emoji"
                      style={EMOJI}
                      disabled={!selected}
                      onClick={() => {
                        if (!selected) return;
                        field.current?.focus();
                        if (onEmojiPalette) onEmojiPalette();
                        else setText(selected.id, (before) => `${before}\u{1F600}`);
                      }}
                    >
                      <EmojiGlyph />
                    </ImageButton>
                  </TextFieldBezel>
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Message field commands">
                  <MenuItem disabled={!selected} onClick={() => editField(field.current, "cut")}>
                    Cut
                  </MenuItem>
                  <MenuItem disabled={!selected} onClick={() => editField(field.current, "copy")}>
                    Copy
                  </MenuItem>
                  <MenuItem disabled={!selected} onClick={() => void paste()}>
                    Paste
                  </MenuItem>
                  <MenuItem
                    disabled={!selected}
                    onClick={() => {
                      field.current?.focus();
                      field.current?.select();
                    }}
                  >
                    Select All
                  </MenuItem>
                  <MenuSeparator />
                  {tools.rows}
                </ContextualMenuPopup>
              </ContextualMenu>
              {(selected ? renderAudioButton?.(selected.id) : null) ?? (
                /* Focusable while dimmed, so its reason shows on hover and is read out. */
                <ImageButton
                  aria-label="Record audio"
                  disabled
                  focusableWhenDisabled
                  title={AUDIO_UNAVAILABLE}
                >
                  <AudioGlyph />
                </ImageButton>
              )}
            </div>
          </SplitViewPane>
        </SplitView>
        {tools.panels}
      </Window>
      {host && preferences
        ? createPortal(
            <MessagesPreferences
              state={stateOf("preferences")}
              onHelp={onHelp}
              settings={settings}
              onSettingsChange={setSettings}
              onClose={() => setPreferences(false)}
              data-front={front === "preferences" ? "" : undefined}
              style={{
                position: "absolute",
                zIndex: beside(front === "preferences" ? 1 : -1),
                left: host.left + preferencesOffset.x,
                top: host.top + preferencesOffset.y,
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
