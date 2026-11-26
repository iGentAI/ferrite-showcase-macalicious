import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { type RefObject, useRef } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useMainWindowItem } from "../desktop/desktop-main-window";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { printDocument } from "../textedit/textedit-drive";
import {
  DEFAULT_TEXT_SIZE,
  type MessagesConversation,
  type MessagesView,
  TEXT_SIZES,
  textSizeStep,
} from "./messages-data";
import type { MessageFieldTools } from "./messages-field-tools";
import { saveTranscript, transcriptLines } from "./messages-transcript";

interface MessagesMenusOptions {
  /** An element of the window, once it is drawn. */
  within: Element | null;
  isKey: boolean;
  conversations: readonly MessagesConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCompose: () => void;
  /** File > Delete Conversation…, or `null` where nothing can be deleted. */
  onDeleteConversation: (() => void) | null;
  /** How many conversations it deletes. */
  deleteCount: number;
  /** Edit > Clear Chat Transcript, or `null` where there is nothing it can clear. */
  onClearTranscript: (() => void) | null;
  view: MessagesView;
  /** The window shows one conversation, and its list cannot be shown. */
  listFixed?: boolean;
  onViewChange: (view: MessagesView) => void;
  /** Buddies > Block Person…: the one other person, or `null` where there is no one person. */
  person: { blocked: boolean; change: () => void } | null;
  /** The conversation's details, or `null` where there are none to show. */
  onShowInfo: (() => void) | null;
  /** The conversation shown, for what is done with its transcript; `null` with none shown. */
  shown: MessagesConversation | null;
  /** Starts a FaceTime call with the person shown, or `null` where there is no one person. */
  onFaceTime: ((kind: "video" | "audio") => void) | null;
  /** Invites the person shown to a game of Chess, or `null` where there is no one person. */
  onInviteToChess: (() => void) | null;
  /** Adds the one other person to Contacts, or `null` where there is no one person. */
  onAddToContacts: (() => void) | null;
  /** Picks a file to send in the conversation shown, or `null` where none can be sent. */
  onSendFile: (() => void) | null;
  /** File > Open…: the drive's Open panel, or `null` without a drive. */
  onOpenFile: (() => void) | null;
  /** Takes files Paste found on the clipboard, or `null` where the conversation takes none. */
  onPasteFiles: ((files: readonly File[]) => void) | null;
  /** What Copy takes when messages are selected, in place of the text selection. */
  copied: string | null;
  /** Spelling, Substitutions and Speech on the message field. */
  tools: MessageFieldTools;
  field: RefObject<HTMLTextAreaElement | null>;
  search: RefObject<HTMLInputElement | null>;
  textSize: number;
  onTextSize: (step: number) => void;
}

/**
 * Runs a browser editing command on the message field, or on the transcript's selected text for
 * Copy. `document.execCommand` is deprecated and still the only way to reach a field's own undo
 * history and to change its text so that the field reports the change.
 */
export const editField = (
  input: HTMLTextAreaElement | null,
  command: "undo" | "redo" | "cut" | "copy",
) => {
  const copying = command === "copy" && Boolean(window.getSelection()?.toString());
  if (!copying) input?.focus();
  document.execCommand(command);
};

/** Why FaceTime is dimmed for a conversation without one person to call. */
export const NO_FACETIME =
  "FaceTime calls one account: this conversation has no one person to call.";

/** Why Invite to Share My Screen is dimmed. */
export const NO_SHARE_MY_SCREEN =
  "Sharing your screen lets someone control this computer, which a web page cannot allow.";

/** Why Ask to Share Screen is dimmed. */
export const NO_ASK_TO_SHARE =
  "Seeing and controlling another person's computer is not something a web page can do.";

/** Why File > Open… is dimmed. */
export const NO_OPEN = "Open reads files from the desktop's drive, and this page has none.";

/** A picture on the browser's clipboard, as a file; `null` when the clipboard holds text or nothing. */
export async function clipboardPicture(clipboard: Clipboard): Promise<File | null> {
  if (typeof clipboard.read !== "function") return null;
  const items = await clipboard.read();
  for (const item of items) {
    if (item.types.includes("text/plain")) return null;
    const type = item.types.find((each) => each.startsWith("image/"));
    if (type) {
      const blob = await item.getType(type);
      return new File([blob], `Pasted Image.${type.slice("image/".length)}`, { type });
    }
  }
  return null;
}

/** The menu bar's File, Edit, View and Buddies items of Messages, and their keys. */
export function useMessagesMenus({
  within,
  isKey,
  conversations,
  selectedId,
  onSelect,
  onCompose,
  onDeleteConversation,
  deleteCount,
  onClearTranscript,
  view,
  listFixed,
  onViewChange,
  person,
  onShowInfo,
  shown,
  onFaceTime,
  onInviteToChess,
  onAddToContacts,
  onSendFile,
  onOpenFile,
  onPasteFiles,
  copied,
  tools,
  field,
  search,
  textSize,
  onTextSize,
}: MessagesMenusOptions): { paste: () => Promise<void> } {
  const step = textSizeStep(textSize);
  const biggest = TEXT_SIZES.length - 1;
  const bigger = () => onTextSize(Math.min(biggest, step + 1));
  const smaller = () => onTextSize(Math.max(0, step - 1));
  const normal = () => onTextSize(DEFAULT_TEXT_SIZE);
  // A list that is hidden comes back first: the search field is in it.
  const find = () => {
    if (view.listHidden) onViewChange({ ...view, listHidden: false });
    requestAnimationFrame(() => search.current?.focus());
  };
  const by = (change: 1 | -1) => {
    if (conversations.length === 0) return;
    const at = conversations.findIndex((each) => each.id === selectedId);
    const next = at < 0 ? 0 : (at + change + conversations.length) % conversations.length;
    const conversation = conversations[next];
    if (conversation) onSelect(conversation.id);
  };
  // Counts every change of conversation: going away and coming back during a Paste counts too.
  const selectedNow = useRef(selectedId);
  const selections = useRef(0);
  if (selectedNow.current !== selectedId) {
    selectedNow.current = selectedId;
    selections.current += 1;
  }
  const paste = async () => {
    const input = field.current;
    if (!input) return;
    const asked = selections.current;
    input.focus();
    try {
      if (onPasteFiles) {
        const picture = await clipboardPicture(navigator.clipboard).catch(() => null);
        if (picture) {
          if (selections.current === asked) onPasteFiles([picture]);
          return;
        }
      }
      const text = await navigator.clipboard.readText();
      // The conversation has moved on while the browser asked: nothing is pasted. Otherwise the
      // text goes to the field it was asked for, wherever the menu closing left the keyboard.
      if (selections.current !== asked || !input.isConnected) return;
      input.focus();
      document.execCommand("insertText", false, text);
    } catch {
      // The browser asks before it lets a page read the clipboard: refused, nothing is pasted.
    }
  };
  const first = conversations.slice(0, 9);
  const print = () => {
    if (shown) {
      printDocument({
        name: shown.name || "Messages",
        plain: false,
        lines: transcriptLines(shown),
      });
    }
  };

  // Command-0 belongs to View > Make Text Normal Size in Messages.
  useMainWindowItem("messages", "Messages", within, undefined, false);
  useDesktopAppMenu(
    "messages",
    "Dock",
    <MenuItem onClick={onCompose}>New Message</MenuItem>,
    within,
  );
  useDesktopAppMenu(
    "messages",
    "File",
    <>
      <MenuItem keyEquivalent="command+n" onClick={onCompose}>
        New Message
      </MenuItem>
      <MenuItem
        disabled={!onOpenFile}
        title={onOpenFile ? undefined : NO_OPEN}
        keyEquivalent="command+o"
        onClick={() => onOpenFile?.()}
      >
        Open…
      </MenuItem>
      <MenuItem disabled={!onDeleteConversation} onClick={() => onDeleteConversation?.()}>
        {deleteCount > 1 ? `Delete ${deleteCount} Conversations…` : "Delete Conversation…"}
      </MenuItem>
      <MenuItem
        disabled={!onSendFile}
        keyEquivalent="option+command+f"
        onClick={() => onSendFile?.()}
      >
        Send File…
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!shown} onClick={() => shown && saveTranscript(shown)}>
        Save Transcript…
      </MenuItem>
      <MenuItem disabled={!shown} onClick={print}>
        Export as PDF…
      </MenuItem>
      <MenuItem disabled={!shown} keyEquivalent="command+p" onClick={print}>
        Print…
      </MenuItem>
    </>,
    within,
  );
  useDesktopAppMenu(
    "messages",
    "Edit",
    <>
      <MenuItem onClick={() => editField(field.current, "undo")} keyEquivalent="command+z">
        Undo
      </MenuItem>
      <MenuItem onClick={() => editField(field.current, "redo")} keyEquivalent="shift+command+z">
        Redo
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => editField(field.current, "cut")} keyEquivalent="command+x">
        Cut
      </MenuItem>
      <MenuItem
        onClick={() =>
          copied === null
            ? editField(field.current, "copy")
            : void navigator.clipboard?.writeText(copied)
        }
        keyEquivalent="command+c"
      >
        Copy
      </MenuItem>
      <MenuItem onClick={() => void paste()} keyEquivalent="command+v">
        Paste
      </MenuItem>
      <MenuItem onClick={() => void paste()} keyEquivalent="option+shift+command+v">
        Paste and Match Style
      </MenuItem>
      <MenuItem
        onClick={() => {
          field.current?.focus();
          document.execCommand("delete");
        }}
      >
        Delete
      </MenuItem>
      <MenuItem
        onClick={() => {
          field.current?.focus();
          field.current?.select();
        }}
        keyEquivalent="command+a"
      >
        Select All
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={find} keyEquivalent="command+f">
        Find
      </MenuItem>
      <MenuItem disabled={conversations.length < 2} keyEquivalent="command+g" onClick={() => by(1)}>
        Find Next
      </MenuItem>
      <MenuItem
        disabled={conversations.length < 2}
        keyEquivalent="shift+command+g"
        onClick={() => by(-1)}
      >
        Find Previous
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!onClearTranscript}
        keyEquivalent="option+command+k"
        onClick={() => onClearTranscript?.()}
      >
        Clear Chat Transcript
      </MenuItem>
      <MenuSeparator />
      {tools.rows}
    </>,
    within,
  );
  useDesktopAppMenu(
    "messages",
    "View",
    <>
      <MenuItem disabled={step >= biggest} keyEquivalent="command+=" onClick={bigger}>
        Make Text Bigger
      </MenuItem>
      <MenuItem disabled={step <= 0} keyEquivalent="command+-" onClick={smaller}>
        Make Text Smaller
      </MenuItem>
      <MenuItem disabled={step === DEFAULT_TEXT_SIZE} keyEquivalent="command+0" onClick={normal}>
        Make Text Normal Size
      </MenuItem>
      <MenuSeparator />
      <MenuCheckboxItem
        checked={view.senders === "all"}
        onCheckedChange={() => onViewChange({ ...view, senders: "all" })}
      >
        All Messages
      </MenuCheckboxItem>
      <MenuCheckboxItem
        checked={view.senders === "unknown"}
        onCheckedChange={() => onViewChange({ ...view, senders: "unknown" })}
      >
        Unknown Senders
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuItem
        disabled={listFixed}
        onClick={() => onViewChange({ ...view, listHidden: !view.listHidden })}
      >
        {view.listHidden ? "Show Conversation List" : "Hide Conversation List"}
      </MenuItem>
      <MenuSeparator />
    </>,
    within,
  );
  useDesktopAppMenu(
    "messages",
    "Buddies",
    <>
      <MenuItem disabled={!onShowInfo} keyEquivalent="command+i" onClick={() => onShowInfo?.()}>
        Show Info
      </MenuItem>
      <MenuItem
        disabled={!onFaceTime}
        title={onFaceTime ? undefined : NO_FACETIME}
        onClick={() => onFaceTime?.("video")}
      >
        Start FaceTime Video
      </MenuItem>
      <MenuItem
        disabled={!onFaceTime}
        title={onFaceTime ? undefined : NO_FACETIME}
        onClick={() => onFaceTime?.("audio")}
      >
        Start FaceTime Audio
      </MenuItem>
      <MenuItem disabled={!onInviteToChess} onClick={() => onInviteToChess?.()}>
        Invite to Chess…
      </MenuItem>
      <MenuItem disabled title={NO_SHARE_MY_SCREEN}>
        Invite to Share My Screen
      </MenuItem>
      <MenuItem disabled title={NO_ASK_TO_SHARE}>
        Ask to Share Screen
      </MenuItem>
      <MenuItem disabled={!onAddToContacts} onClick={() => onAddToContacts?.()}>
        Add to Contacts
      </MenuItem>
      <MenuItem disabled={!person} onClick={() => person?.change()}>
        {person?.blocked ? "Unblock Person" : "Block Person…"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={conversations.length < 2} onClick={() => by(1)}>
        Next Conversation
      </MenuItem>
      <MenuItem disabled={conversations.length < 2} onClick={() => by(-1)}>
        Previous Conversation
      </MenuItem>
      {first.length ? <MenuSeparator /> : null}
      {first.map((conversation, at) => (
        <MenuItem
          key={conversation.id}
          keyEquivalent={`command+${at + 1}`}
          onClick={() => onSelect(conversation.id)}
        >
          {conversation.name || "New Message"}
        </MenuItem>
      ))}
    </>,
    within,
  );
  useWindowKeys(within, isKey, [
    { equivalent: "command+n", run: onCompose },
    { equivalent: "command+o", run: () => onOpenFile?.() },
    ...tools.keys,
    { equivalent: "command+p", run: print },
    { equivalent: "command+f", run: find },
    { equivalent: "command+g", run: () => by(1) },
    { equivalent: "shift+command+g", run: () => by(-1) },
    { equivalent: "command+=", run: bigger },
    { equivalent: "command+-", run: smaller },
    { equivalent: "command+0", run: normal },
    { equivalent: "command+i", run: () => onShowInfo?.() },
    { equivalent: "option+command+f", run: () => onSendFile?.() },
    { equivalent: "option+command+k", run: () => onClearTranscript?.() },
    ...first.map((conversation, at) => ({
      equivalent: `command+${at + 1}`,
      run: () => onSelect(conversation.id),
    })),
  ]);
  return { paste };
}
