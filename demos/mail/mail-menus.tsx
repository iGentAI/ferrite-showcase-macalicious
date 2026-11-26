"use client";

import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TagDot } from "macalicious/tag-dot";
import type { ReactNode } from "react";
import { AIRDROP_REASON, shareTargets } from "../desktop/desktop-share-link";
import {
  FLAGS,
  isOwnMailbox,
  isSmartMailbox,
  MAILBOXES,
  type MailboxId,
  type MailFlag,
  type MailMessage,
  type MailPriority,
  type OwnMailbox,
  type OwnMailboxId,
  type SmartMailboxId,
} from "./mail-data";
import type { MailFindCommands } from "./mail-find";
import type { MailRoles } from "./mail-saved";

/** What the message list is sorted by. */
export type MailSort = "date" | "flags" | "from" | "mailbox" | "subject" | "to" | "unread";

export const MAIL_SORTS: readonly (readonly [value: MailSort, label: string])[] = [
  ["date", "Date"],
  ["flags", "Flags"],
  ["from", "From"],
  ["mailbox", "Mailbox"],
  ["subject", "Subject"],
  ["to", "To"],
  ["unread", "Unread"],
];

/** What the message filter can ask of a message; a message must meet each one chosen. */
export type MailFilter = "unread" | "flagged" | "to-me" | "cc-me" | "attachments" | "vips";

export const MAIL_FILTERS: readonly (readonly [value: MailFilter, label: string])[] = [
  ["unread", "Unread"],
  ["flagged", "Flagged"],
  ["to-me", "To: Me"],
  ["cc-me", "Cc: Me"],
  ["attachments", "With Attachments"],
  ["vips", "From VIPs"],
];

/** Why Reply, Reply All and Forward are dimmed: each answers one message. */
export const REPLY_ONE = "Select one message to reply to or forward.";
/** Why the account commands are dimmed. */
/** Why what reads the server is dimmed while Mail is offline. */
export const MAIL_IS_OFFLINE = "Mail is offline: choose Mailbox > Take All Accounts Online.";
export const NO_OUTSIDE_MAIL =
  "This desktop has only its own accounts: outside mail needs a mail provider account, which is not set up.";

/** Why Add Sender to Contacts is dimmed. */
export const NO_SENDER_TO_ADD = "Select one message from someone with an account on this desktop.";

/** Why Add Sender to VIPs is dimmed. */
export const NO_VIP_TO_ADD = "Select one message from someone other than you.";

/** Why Block Contact is dimmed. */
export const NO_ONE_TO_BLOCK = "Select one message from someone other than you.";

/** Why Mailbox > Use This Mailbox For > Drafts is dimmed. */
export const NO_DRAFTS_ROLE =
  "This desktop's server keeps drafts itself and only there: another mailbox cannot stand in for Drafts.";

/** Why Use This Mailbox For is dimmed on one of the mailboxes every person has. */
const NOT_YOUR_MAILBOX = "Select a mailbox you made.";

/** Why File > Import Mailboxes is dimmed. */
const NO_IMPORT = "Imported messages are kept by a served desktop.";

/** Why Message > Remove Attachments is dimmed. */
const NO_FILES_TO_REMOVE = "Select a message with attachments, other than a draft.";

/** Why Window's own windows are dimmed on a page that hosts none. */
export const NO_TOOL_WINDOWS = "This window opens on the served desktop.";

/** Why Add to Calendar is dimmed. */
const NO_CALENDAR_FILE = "Select a message with a calendar file (.ics) attached.";
/** Why Save and Quick Look Attachments are dimmed. */
const NO_FILES_CHOSEN = "Select a message with attachments.";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Everything the menu bar and the contextual menus ask of the viewer: `chosen` are the selected
 * messages the list shows, and every command acts on all of them.
 */
export interface MailCommands {
  /** View's rows for tabs. */
  tabViewItems: ReactNode;
  /** Window's rows for tabs. */
  tabWindowItems: ReactNode;
  chosen: readonly MailMessage[];
  /** The one message selected, or `null` for none or several. */
  one: MailMessage | null;
  /** The user's own address is known: Reply and Reply All need it. */
  canReply: boolean;
  /** A New Message window is open and is the key window: Send goes to it. */
  composing: boolean;
  newMessage: () => void;
  /** File > New Viewer Window, where a desktop hosts one. */
  newViewer: (() => void) | null;
  /** Files can be attached to the New Message window that is key: Attach Files goes to it. */
  attachFiles: (() => void) | null;
  send: () => void;
  /** Saves a New Message window's text as a draft now. */
  save: () => void;
  sendAgain: () => void;
  /** Adds the sender of the one message selected to Contacts; `null` when that cannot be done. */
  addSender: (() => void) | null;
  /** Whether the sender of the one message selected is a VIP; `null` when that means nothing. */
  senderIsVip: boolean | null;
  toggleVip: () => void;
  /** The Smart Mailboxes the person made: only these can be edited, renamed or deleted. */
  ownSmart: readonly SmartMailboxId[];
  reply: (kind: "reply" | "all" | "forward") => void;
  /** Opens each message chosen in a window of its own, where a desktop hosts them. */
  openMessages: (() => void) | null;
  /** Prints the messages chosen; the browser's dialog also saves a PDF. */
  print: () => void;
  share: MailShare;
  /** File > Add to Calendar: the chosen messages' .ics files, into Calendar's import; `null` while they have none. */
  addToCalendar: (() => void) | null;
  /** File > Save Attachments: the chosen messages' files to Downloads; `null` while they have none. */
  saveAttachments: (() => void) | null;
  /** File > Quick Look Attachments: as Save Attachments, then shown; `null` while they have none. */
  quickLookAttachments: (() => void) | null;
  /** Mailbox > Rebuild: everything read again from where it is kept. */
  rebuild: () => void;
  /** Whether the sender of the one message selected is blocked; `null` when that means nothing. */
  senderIsBlocked: boolean | null;
  toggleBlocked: () => void;
  toolbarShown: boolean;
  toggleToolbar: () => void;
  /** Each opens a window of Mail's own, or is `null` where none can open. */
  showActivity: (() => void) | null;
  showRecipients: (() => void) | null;
  showDoctor: (() => void) | null;
  /** File > Save as Stationery: the New Message window that is key; `null` while there is none. */
  saveStationery: (() => void) | null;
  /** File > Import Mailboxes; `null` where nothing keeps what is imported. */
  importMailboxes: (() => void) | null;
  /** View > Customize Toolbar. */
  customizeToolbar: () => void;
  /** The mailboxes standing in for Archive and Junk. */
  roles: MailRoles;
  /** Mailbox > Use This Mailbox For: on again, or for another mailbox, it gives the role back. */
  assignMailbox: (role: keyof MailRoles, mailbox: OwnMailboxId) => void;
  /** Message > Remove Attachments; `null` while none of those chosen has one to take off. */
  removeAttachments: (() => void) | null;
  /** File > Save As: the messages chosen as a file. */
  saveAs: () => void;
  /** Mailbox > Export Mailbox: everything in the mailbox as an mbox file. */
  exportMailbox: (mailbox: MailboxId) => void;
  /** Why the messages chosen cannot be copied to a mailbox, if they cannot. */
  copyRefusal: (to: MailboxId) => string | undefined;
  copyTo: (to: MailboxId) => void;
  /** Forwards the messages chosen as files of a New Message; `null` where files cannot be attached. */
  forwardAttached: (() => void) | null;
  /** A New Message with the one message's subject and text, unchanged, to address onward. */
  redirect: () => void;
  getMail: () => void;
  /** Whether Mail is offline: reads are held and sends wait in the Outbox. */
  offline: boolean;
  /** Takes all accounts offline or online; absent where there is no server to go offline from. */
  toggleOffline?: () => void;
  markRead: (read: boolean) => void;
  markJunk: () => void;
  archive: () => void;
  moveRefusal: (to: MailboxId) => string | undefined;
  move: (to: MailboxId) => void;
  lastMove: MailboxId | null;
  setFlag: (flag: MailFlag | undefined) => void;
  setPriority: (priority: MailPriority | undefined) => void;
  setMuted: (muted: boolean) => void;
  remove: () => void;
  goTo: (mailbox: MailboxId) => void;
  counts: Record<MailboxId, { all: number; unread: number }>;
  /** The mailbox the window shows. */
  current: MailboxId;
  /** The mailboxes the person made. */
  ownMailboxes: readonly OwnMailbox[];
  /** Each of New, Rename and Delete Mailbox, offered only where it can be done. */
  canCreateMailbox: boolean;
  canRenameMailbox: boolean;
  canDeleteMailbox: boolean;
  newMailbox: () => void;
  renameMailbox: (id: OwnMailboxId | SmartMailboxId) => void;
  deleteMailbox: (id: OwnMailboxId | SmartMailboxId) => void;
  newSmartMailbox: () => void;
  editSmartMailbox: (id: SmartMailboxId) => void;
  duplicateSmartMailbox: (id: SmartMailboxId) => void;
  /** Messages can be erased for good; an owner of held messages may offer no way. */
  canErase: boolean;
  eraseDeleted: () => void;
  eraseJunk: () => void;
  markAllRead: (mailbox: MailboxId) => void;
  sort: MailSort;
  setSort: (sort: MailSort) => void;
  ascending: boolean;
  setAscending: (ascending: boolean) => void;
  filterOn: boolean;
  setFilterOn: (on: boolean) => void;
  filters: readonly MailFilter[];
  toggleFilter: (filter: MailFilter) => void;
  listShown: boolean;
  toggleList: () => void;
  favoritesShown: boolean;
  /** View > Message: how the pane shows the message selected. */
  messageView: "default" | "headers" | "source";
  toggleMessageView: (view: "headers" | "source") => void;
  toggleFavorites: () => void;
  /** What the Favorites bar holds, in its order. */
  favorites: readonly { id: MailboxId; name: string }[];
  /** Puts a mailbox on the Favorites bar, or takes it off. */
  toggleFavorite: (mailbox: MailboxId) => void;
  undoLabel: string | null;
  redoLabel: string | null;
  undo: () => void;
  redo: () => void;
  copy: () => void;
  cut: () => void;
  selectAll: () => void;
  canSelectAll: boolean;
  findInMailbox: () => void;
  /** Find in the message the pane shows, or `null` while it shows none. */
  findInMessage: MailFindCommands | null;
  /** Rules can run: there is one, and Message > Apply Rules acts on what is selected. */
  hasRules: boolean;
  applyRules: () => void;
  /** View > Organize by Conversation. */
  conversations: boolean;
  toggleConversations: () => void;
  expandAll: () => void;
  collapseAll: () => void;
}

/** Mailbox > Go To's keys: a favorite each, in the bar's order. */
const goToKey = (at: number) => `command+${at + 1}`;

/** File > Share: where the message selected can go. */
export interface MailShare {
  /** Why nothing can be shared now, or `null`. */
  reason: string | null;
  /** The first web address in the message: what Reminders and the Reading List take. */
  address: string | null;
  copy: () => void;
  /** Notes takes the message as a new note; Messages as a text file. */
  toApp: (app: "notes" | "messages") => void;
  link: (app: string) => void;
}

/** Share, as a submenu. Mail itself is not offered: Forward is how a message goes on by mail. */
export function MailShareSubmenu({ share }: { share: MailShare }) {
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
  const linked = shareTargets().filter(
    ({ app }) => app !== "mail" && app !== "notes" && app !== "messages",
  );
  return (
    <Submenu>
      <SubmenuTrigger>Share</SubmenuTrigger>
      <SubmenuPopup>
        {row("copy", "Copy", share.reason, share.copy)}
        {row("notes", "Notes", share.reason, () => share.toApp("notes"))}
        {row("messages", "Messages", share.reason, () => share.toApp("messages"))}
        {row("airdrop", "AirDrop", AIRDROP_REASON)}
        {linked.map(({ app, title, reason }) =>
          row(
            app,
            title,
            share.reason ??
              (share.address ? reason : `${title} takes a web address, and this message has none.`),
            () => share.link(app),
          ),
        )}
      </SubmenuPopup>
    </Submenu>
  );
}

/** File's New Message and Save, above the desktop's Close Window. */
export function MailFileItems({ c }: { c: MailCommands }) {
  return (
    <>
      <MenuItem keyEquivalent="command+n" onClick={c.newMessage}>
        New Message
      </MenuItem>
      <MenuItem
        keyEquivalent="option+command+n"
        disabled={!c.newViewer}
        title={c.newViewer ? undefined : NO_TOOL_WINDOWS}
        onClick={() => c.newViewer?.()}
      >
        New Viewer Window
      </MenuItem>
      <MenuItem
        keyEquivalent="command+o"
        disabled={!c.openMessages || c.chosen.length === 0}
        onClick={() => c.openMessages?.()}
      >
        Open Message
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+a"
        disabled={!c.attachFiles}
        title={c.attachFiles ? undefined : "Files go with a message you are writing."}
        onClick={() => c.attachFiles?.()}
      >
        Attach Files…
      </MenuItem>
      <MenuItem
        keyEquivalent="command+s"
        disabled={!c.composing}
        title={c.composing ? undefined : "Mail saves a message you are writing, as a draft."}
        onClick={c.save}
      >
        Save
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+s"
        disabled={c.chosen.length === 0}
        title={c.chosen.length === 0 ? "Select a message to save it." : undefined}
        onClick={c.saveAs}
      >
        Save As…
      </MenuItem>
      <MenuSeparator />
      <MailShareSubmenu share={c.share} />
      <MenuSeparator />
      <MenuItem
        disabled={!c.saveAttachments}
        title={c.saveAttachments ? undefined : NO_FILES_CHOSEN}
        onClick={() => c.saveAttachments?.()}
      >
        Save Attachments…
      </MenuItem>
      <MenuItem
        keyEquivalent="command+y"
        disabled={!c.quickLookAttachments}
        title={c.quickLookAttachments ? undefined : NO_FILES_CHOSEN}
        onClick={() => c.quickLookAttachments?.()}
      >
        Quick Look Attachments
      </MenuItem>
      <MenuItem
        disabled={!c.addToCalendar}
        title={c.addToCalendar ? undefined : NO_CALENDAR_FILE}
        onClick={() => c.addToCalendar?.()}
      >
        Add to Calendar
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!c.saveStationery}
        title={c.saveStationery ? undefined : "Mail keeps a message you are writing as stationery."}
        onClick={() => c.saveStationery?.()}
      >
        Save as Stationery…
      </MenuItem>
      <MenuItem
        disabled={!c.importMailboxes}
        title={c.importMailboxes ? undefined : NO_IMPORT}
        onClick={() => c.importMailboxes?.()}
      >
        Import Mailboxes…
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={c.chosen.length === 0} onClick={c.print}>
        Export as PDF…
      </MenuItem>
      <MenuItem keyEquivalent="command+p" disabled={c.chosen.length === 0} onClick={c.print}>
        Print…
      </MenuItem>
    </>
  );
}

/** The viewer's Edit menu: what Undo can take back, and the selection's commands. */
export function MailEditItems({ c }: { c: MailCommands }) {
  return (
    <>
      <MenuItem keyEquivalent="command+z" disabled={!c.undoLabel} onClick={c.undo}>
        {c.undoLabel ? `Undo ${c.undoLabel}` : "Undo"}
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+z" disabled={!c.redoLabel} onClick={c.redo}>
        {c.redoLabel ? `Redo ${c.redoLabel}` : "Redo"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+x" disabled={c.chosen.length === 0} onClick={c.cut}>
        Cut
      </MenuItem>
      <MenuItem keyEquivalent="command+c" disabled={c.chosen.length === 0} onClick={c.copy}>
        Copy
      </MenuItem>
      <MenuItem
        keyEquivalent="command+v"
        disabled
        title="Mail pastes into a message you are writing."
      >
        Paste
      </MenuItem>
      <MenuItem disabled={c.chosen.length === 0} onClick={c.remove}>
        Delete
      </MenuItem>
      <MenuItem keyEquivalent="command+a" disabled={!c.canSelectAll} onClick={c.selectAll}>
        Select All
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Find</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem keyEquivalent="option+command+f" onClick={c.findInMailbox}>
            Mailbox Search
          </MenuItem>
          <MenuSeparator />
          <MailFindItems find={c.findInMessage} />
        </SubmenuPopup>
      </Submenu>
    </>
  );
}

/** Why Find is dimmed. */
const NO_MESSAGE_SHOWN = "Select a message to find its text.";

/** Edit > Find's commands on a message's text, each dimmed while no message is shown. */
export function MailFindItems({ find }: { find: MailFindCommands | null }) {
  const why = find ? undefined : NO_MESSAGE_SHOWN;
  return (
    <>
      <MenuItem keyEquivalent="command+f" disabled={!find} title={why} onClick={() => find?.find()}>
        Find…
      </MenuItem>
      <MenuItem keyEquivalent="command+g" disabled={!find} title={why} onClick={() => find?.next()}>
        Find Next
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+g"
        disabled={!find}
        title={why}
        onClick={() => find?.previous()}
      >
        Find Previous
      </MenuItem>
      <MenuItem
        keyEquivalent="command+e"
        disabled={!find}
        title={why}
        onClick={() => find?.findSelection()}
      >
        Use Selection for Find
      </MenuItem>
      <MenuItem keyEquivalent="command+j" disabled={!find} title={why} onClick={() => find?.jump()}>
        Jump to Selection
      </MenuItem>
    </>
  );
}

/** View: the list's order and filter, and what the window shows. */
export function MailViewItems({ c }: { c: MailCommands }) {
  return (
    <>
      <Submenu>
        <SubmenuTrigger>Sort By</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={c.sort} onValueChange={(value) => c.setSort(value as MailSort)}>
            {MAIL_SORTS.map(([value, label]) => (
              <MenuRadioItem key={value} value={value}>
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuRadioGroup
            value={c.ascending ? "ascending" : "descending"}
            onValueChange={(value) => c.setAscending(value === "ascending")}
          >
            <MenuRadioItem value="ascending">Ascending</MenuRadioItem>
            <MenuRadioItem value="descending">Descending</MenuRadioItem>
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger>Filter</SubmenuTrigger>
        <SubmenuPopup>
          <MenuCheckboxItem
            keyEquivalent="command+l"
            checked={c.filterOn}
            onCheckedChange={c.setFilterOn}
          >
            Enable Message Filter
          </MenuCheckboxItem>
          <MenuSeparator />
          {MAIL_FILTERS.map(([value, label]) => (
            <MenuCheckboxItem
              key={value}
              checked={c.filters.includes(value)}
              onCheckedChange={() => c.toggleFilter(value)}
            >
              {label}
            </MenuCheckboxItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuCheckboxItem checked={c.conversations} onCheckedChange={c.toggleConversations}>
        Organize by Conversation
      </MenuCheckboxItem>
      <MenuItem disabled={!c.conversations} onClick={c.expandAll}>
        Expand All Conversations
      </MenuItem>
      <MenuItem disabled={!c.conversations} onClick={c.collapseAll}>
        Collapse All Conversations
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Message</SubmenuTrigger>
        <SubmenuPopup>
          <MenuCheckboxItem
            keyEquivalent="shift+command+h"
            checked={c.messageView === "headers"}
            onCheckedChange={() => c.toggleMessageView("headers")}
          >
            All Headers
          </MenuCheckboxItem>
          <MenuCheckboxItem
            keyEquivalent="option+command+u"
            checked={c.messageView === "source"}
            onCheckedChange={() => c.toggleMessageView("source")}
          >
            Raw Source
          </MenuCheckboxItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem keyEquivalent="shift+command+m" onClick={c.toggleList}>
        {c.listShown ? "Hide Mailbox List" : "Show Mailbox List"}
      </MenuItem>
      <MenuItem keyEquivalent="option+shift+command+h" onClick={c.toggleFavorites}>
        {c.favoritesShown ? "Hide Favorites Bar" : "Show Favorites Bar"}
      </MenuItem>
      <MenuItem onClick={c.toggleToolbar}>
        {c.toolbarShown ? "Hide Toolbar" : "Show Toolbar"}
      </MenuItem>
      <MenuItem disabled={!c.toolbarShown} onClick={c.customizeToolbar}>
        Customize Toolbar…
      </MenuItem>
      {c.tabViewItems}
    </>
  );
}

/** Rename and Delete, dimmed for a mailbox the person did not make. */
function OwnMailboxItems({ c, mailbox }: { c: MailCommands; mailbox: MailboxId | null }) {
  const smart =
    mailbox !== null && isSmartMailbox(mailbox) && c.ownSmart.includes(mailbox) ? mailbox : null;
  const own = smart ?? (mailbox !== null && isOwnMailbox(mailbox) ? mailbox : null);
  const why = own ? undefined : "Select a mailbox you made.";
  return (
    <>
      <MenuItem
        disabled={!own || (!smart && !c.canRenameMailbox)}
        title={why}
        onClick={() => own && c.renameMailbox(own)}
      >
        Rename Mailbox…
      </MenuItem>
      <MenuItem
        disabled={!own || (!smart && !c.canDeleteMailbox)}
        title={why}
        onClick={() => own && c.deleteMailbox(own)}
      >
        Delete Mailbox…
      </MenuItem>
    </>
  );
}

/** New, Edit and Duplicate Smart Mailbox, the last two for the Smart Mailbox named. */
function SmartMailboxItems({ c, mailbox }: { c: MailCommands; mailbox: MailboxId | null }) {
  const smart =
    mailbox !== null && isSmartMailbox(mailbox) && c.ownSmart.includes(mailbox) ? mailbox : null;
  const why = smart ? undefined : "Select a Smart Mailbox.";
  return (
    <>
      <MenuItem onClick={c.newSmartMailbox}>New Smart Mailbox…</MenuItem>
      <MenuItem disabled={!smart} title={why} onClick={() => smart && c.editSmartMailbox(smart)}>
        Edit Smart Mailbox…
      </MenuItem>
      <MenuItem
        disabled={!smart}
        title={why}
        onClick={() => smart && c.duplicateSmartMailbox(smart)}
      >
        Duplicate Smart Mailbox
      </MenuItem>
    </>
  );
}

/** The roles a mailbox can take: mail bound for the role goes there. Drafts stays the server's. */
function UseMailboxForItems({ c }: { c: MailCommands }) {
  const mailbox = isOwnMailbox(c.current) ? c.current : null;
  const item = ([title, role]: readonly [string, keyof MailRoles]) => (
    <MenuCheckboxItem
      key={role}
      disabled={!mailbox}
      title={mailbox ? undefined : NOT_YOUR_MAILBOX}
      checked={mailbox !== null && c.roles[role] === mailbox}
      onCheckedChange={() => mailbox && c.assignMailbox(role, mailbox)}
    >
      {title}
    </MenuCheckboxItem>
  );
  return (
    <>
      <MenuItem disabled title={NO_DRAFTS_ROLE}>
        Drafts
      </MenuItem>
      {(
        [
          ["Sent", "sent"],
          ["Trash", "trash"],
        ] as const
      ).map(item)}
      <MenuSeparator />
      {(
        [
          ["Archive", "archive"],
          ["Junk", "junk"],
        ] as const
      ).map(item)}
    </>
  );
}

/** Mailbox: fetching, going to a mailbox, and erasing. */
export function MailMailboxItems({ c }: { c: MailCommands }) {
  return (
    <>
      <MenuItem
        keyEquivalent="shift+command+n"
        disabled={c.offline}
        title={c.offline ? MAIL_IS_OFFLINE : undefined}
        onClick={c.getMail}
      >
        Get All New Mail
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Go To</SubmenuTrigger>
        <SubmenuPopup>
          {c.favorites.map(({ id, name }, at) => (
            <MenuItem
              key={id}
              keyEquivalent={at < 9 ? goToKey(at) : undefined}
              onClick={() => c.goTo(id)}
            >
              {name}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem
        disabled={!c.toggleOffline}
        title={c.toggleOffline ? undefined : NO_OUTSIDE_MAIL}
        onClick={c.toggleOffline}
      >
        {c.offline ? "Take All Accounts Online" : "Take All Accounts Offline"}
      </MenuItem>
      <MenuItem
        disabled={c.offline}
        title={c.offline ? MAIL_IS_OFFLINE : undefined}
        onClick={c.getMail}
      >
        Synchronize All Accounts
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!c.canCreateMailbox} onClick={c.newMailbox}>
        New Mailbox…
      </MenuItem>
      <SmartMailboxItems c={c} mailbox={c.current} />
      <OwnMailboxItems c={c} mailbox={c.current} />
      <MenuSeparator />
      <MenuItem
        disabled={c.counts[c.current]?.all === 0}
        onClick={() => c.exportMailbox(c.current)}
      >
        Export Mailbox…
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Use This Mailbox For</SubmenuTrigger>
        <SubmenuPopup>
          <UseMailboxForItems c={c} />
        </SubmenuPopup>
      </Submenu>
      <MenuItem
        disabled={c.offline}
        title={c.offline ? MAIL_IS_OFFLINE : undefined}
        onClick={c.rebuild}
      >
        Rebuild
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="shift+command+delete"
        disabled={!c.canErase || c.counts.trash.all === 0}
        title={c.counts.trash.all === 0 ? "The Trash is empty." : undefined}
        onClick={c.eraseDeleted}
      >
        Erase Deleted Items…
      </MenuItem>
      <MenuItem
        keyEquivalent="option+command+j"
        disabled={!c.canErase || c.counts.junk.all === 0}
        title={c.counts.junk.all === 0 ? "The Junk mailbox is empty." : undefined}
        onClick={c.eraseJunk}
      >
        Erase Junk Mail…
      </MenuItem>
    </>
  );
}

/** The commands of a mailbox's row in the sidebar. */
export function MailMailboxRowItems({
  c,
  mailbox,
}: {
  c: MailCommands;
  mailbox: MailboxId | null;
}) {
  return (
    <>
      <MenuItem disabled={!mailbox} onClick={() => mailbox && c.goTo(mailbox)}>
        Open
      </MenuItem>
      <MenuItem onClick={c.getMail}>Get New Mail</MenuItem>
      <MenuItem
        disabled={!mailbox || (c.counts[mailbox]?.unread ?? 0) === 0}
        onClick={() => mailbox && c.markAllRead(mailbox)}
      >
        Mark All Messages as Read
      </MenuItem>
      <MenuItem disabled={!mailbox} onClick={() => mailbox && c.toggleFavorite(mailbox)}>
        {c.favorites.some(({ id }) => id === mailbox)
          ? "Remove from Favorites Bar"
          : "Add to Favorites Bar"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!c.canCreateMailbox} onClick={c.newMailbox}>
        New Mailbox…
      </MenuItem>
      <SmartMailboxItems c={c} mailbox={mailbox} />
      <OwnMailboxItems c={c} mailbox={mailbox} />
      <MenuItem
        disabled={!mailbox || c.counts[mailbox]?.all === 0}
        onClick={() => mailbox && c.exportMailbox(mailbox)}
      >
        Export Mailbox…
      </MenuItem>
      {mailbox === "trash" ? (
        <>
          <MenuSeparator />
          <MenuItem disabled={!c.canErase || c.counts.trash.all === 0} onClick={c.eraseDeleted}>
            Erase Deleted Items…
          </MenuItem>
        </>
      ) : null}
      {mailbox === "junk" ? (
        <>
          <MenuSeparator />
          <MenuItem disabled={!c.canErase || c.counts.junk.all === 0} onClick={c.eraseJunk}>
            Erase Junk Mail…
          </MenuItem>
        </>
      ) : null}
    </>
  );
}

/** The mailboxes as items of a Move to menu, each dimmed with why a message cannot go there. */
function MoveItems({ c }: { c: MailCommands }) {
  return [...MAILBOXES, ...c.ownMailboxes].map(({ id, name }) => {
    const refusal = c.moveRefusal(id);
    return (
      <MenuItem
        key={id}
        disabled={refusal !== undefined}
        title={refusal}
        onClick={() => c.move(id)}
      >
        {name}
      </MenuItem>
    );
  });
}

/** The mailboxes as items of a Copy to menu, each dimmed with why a message cannot be copied there. */
function CopyItems({ c }: { c: MailCommands }) {
  return [...MAILBOXES, ...c.ownMailboxes].map(({ id, name }) => {
    const refusal = c.copyRefusal(id);
    return (
      <MenuItem
        key={id}
        disabled={refusal !== undefined}
        title={refusal}
        onClick={() => c.copyTo(id)}
      >
        {name}
      </MenuItem>
    );
  });
}

/** The seven colours and Clear Flag, on every message chosen. */
function FlagItems({ c, keys }: { c: MailCommands; keys: boolean }) {
  const none = c.chosen.length === 0;
  return (
    <>
      {FLAGS.map((flag, index) => (
        <MenuItem
          key={flag}
          disabled={none}
          image={<TagDot color={flag} />}
          keyEquivalent={keys ? `option+command+${index + 1}` : undefined}
          onClick={() => c.setFlag(flag)}
        >
          {capitalize(flag)}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem
        disabled={!c.chosen.some((message) => message.flag)}
        keyEquivalent={keys ? "option+command+0" : undefined}
        onClick={() => c.setFlag(undefined)}
      >
        Clear Flag
      </MenuItem>
    </>
  );
}

/** The commands shared by the Message menu and a message's contextual menu. */
function SelectionItems({ c, keys }: { c: MailCommands; keys: boolean }) {
  const none = c.chosen.length === 0;
  const anyUnread = c.chosen.some((message) => message.unread);
  const anyRead = c.chosen.some((message) => !message.unread);
  const muted = !none && c.chosen.every((message) => message.muted);
  const key = (equivalent: string) => (keys ? equivalent : undefined);
  return (
    <>
      <MenuItem
        disabled={!c.one || !c.canReply}
        title={c.one ? undefined : REPLY_ONE}
        keyEquivalent={key("command+r")}
        onClick={() => c.reply("reply")}
      >
        Reply
      </MenuItem>
      <MenuItem
        disabled={!c.one || !c.canReply}
        title={c.one ? undefined : REPLY_ONE}
        keyEquivalent={key("shift+command+r")}
        onClick={() => c.reply("all")}
      >
        Reply All
      </MenuItem>
      <MenuItem
        disabled={!c.one}
        title={c.one ? undefined : REPLY_ONE}
        keyEquivalent={key("shift+command+f")}
        onClick={() => c.reply("forward")}
      >
        Forward
      </MenuItem>
      <MenuItem
        disabled={!c.one}
        title={c.one ? undefined : REPLY_ONE}
        keyEquivalent={key("shift+command+e")}
        onClick={c.redirect}
      >
        Redirect
      </MenuItem>
      <MenuItem
        disabled={none || !c.forwardAttached}
        title={c.forwardAttached ? undefined : "Files go with a message on a served desktop."}
        onClick={() => c.forwardAttached?.()}
      >
        Forward as Attachment
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger disabled={none}>Mark</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem
            disabled={!anyUnread}
            keyEquivalent={anyUnread ? key("shift+command+u") : undefined}
            onClick={() => c.markRead(true)}
          >
            As Read
          </MenuItem>
          <MenuItem
            disabled={!anyRead}
            keyEquivalent={anyUnread ? undefined : key("shift+command+u")}
            onClick={() => c.markRead(false)}
          >
            As Unread
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={c.moveRefusal("junk") !== undefined}
            title={c.moveRefusal("junk")}
            keyEquivalent={key("shift+command+j")}
            onClick={c.markJunk}
          >
            As Junk Mail
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => c.setPriority("low")}>As Low Priority</MenuItem>
          <MenuItem onClick={() => c.setPriority(undefined)}>As Normal Priority</MenuItem>
          <MenuItem onClick={() => c.setPriority("high")}>As High Priority</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuItem
        disabled={c.moveRefusal("archive") !== undefined}
        title={c.moveRefusal("archive")}
        keyEquivalent={key("control+command+a")}
        onClick={c.archive}
      >
        Archive
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={none}>Move to</SubmenuTrigger>
        <SubmenuPopup>
          <MoveItems c={c} />
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={none}>Copy to</SubmenuTrigger>
        <SubmenuPopup>
          <CopyItems c={c} />
        </SubmenuPopup>
      </Submenu>
      {keys ? (
        <MenuItem
          disabled={!c.lastMove || c.moveRefusal(c.lastMove) !== undefined}
          keyEquivalent="option+command+t"
          onClick={() => c.lastMove && c.move(c.lastMove)}
        >
          Move Again
        </MenuItem>
      ) : null}
      <Submenu>
        <SubmenuTrigger disabled={none}>Flag</SubmenuTrigger>
        <SubmenuPopup>
          <FlagItems c={c} keys={keys} />
        </SubmenuPopup>
      </Submenu>
      <MenuCheckboxItem disabled={none} checked={muted} onCheckedChange={c.setMuted}>
        Mute
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuItem disabled={none} keyEquivalent={key("command+delete")} onClick={c.remove}>
        Delete
      </MenuItem>
    </>
  );
}

/** The Message menu of the menu bar. */
export function MailMessageItems({ c }: { c: MailCommands }) {
  const canSendAgain = c.one?.mailbox === "sent";
  return (
    <>
      {c.composing ? (
        <MenuItem keyEquivalent="shift+command+d" onClick={c.send}>
          Send
        </MenuItem>
      ) : (
        <MenuItem
          disabled={!canSendAgain}
          title={canSendAgain ? undefined : "Select a message you sent to send it again."}
          keyEquivalent="shift+command+d"
          onClick={c.sendAgain}
        >
          Send Again
        </MenuItem>
      )}
      <MenuSeparator />
      <SelectionItems c={c} keys />
      <MenuSeparator />
      <MenuItem
        disabled={!c.hasRules || c.chosen.length === 0}
        title={c.hasRules ? undefined : "Add a rule in Mail > Preferences > Rules."}
        keyEquivalent="option+command+l"
        onClick={c.applyRules}
      >
        Apply Rules
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!c.addSender}
        title={c.addSender ? undefined : NO_SENDER_TO_ADD}
        keyEquivalent="shift+command+y"
        onClick={() => c.addSender?.()}
      >
        Add Sender to Contacts
      </MenuItem>
      <MenuItem
        disabled={c.senderIsVip === null}
        title={c.senderIsVip === null ? NO_VIP_TO_ADD : undefined}
        onClick={c.toggleVip}
      >
        {c.senderIsVip ? "Remove Sender from VIPs" : "Add Sender to VIPs"}
      </MenuItem>
      <MenuItem
        disabled={c.senderIsBlocked === null}
        title={c.senderIsBlocked === null ? NO_ONE_TO_BLOCK : undefined}
        onClick={c.toggleBlocked}
      >
        {c.senderIsBlocked ? "Unblock Contact" : "Block Contact"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!c.removeAttachments}
        title={c.removeAttachments ? undefined : NO_FILES_TO_REMOVE}
        onClick={() => c.removeAttachments?.()}
      >
        Remove Attachments
      </MenuItem>
    </>
  );
}

/** Mail's own rows of its application menu, under Preferences. */
export function MailAppItems({ openAccounts }: { openAccounts: () => void }) {
  return (
    <>
      <MenuItem onClick={openAccounts}>Accounts…</MenuItem>
      <MenuItem disabled title={NO_OUTSIDE_MAIL}>
        Add Account…
      </MenuItem>
    </>
  );
}

/** Mail's own windows, at the top of the Window menu. */
export function MailWindowItems({ c }: { c: MailCommands }) {
  const row = (title: string, open: (() => void) | null, key?: string) => (
    <MenuItem
      keyEquivalent={key}
      disabled={!open}
      title={open ? undefined : NO_TOOL_WINDOWS}
      onClick={() => open?.()}
    >
      {title}
    </MenuItem>
  );
  return (
    <>
      {row("Activity", c.showActivity, "option+command+0")}
      {row("Previous Recipients", c.showRecipients)}
      {row("Connection Doctor", c.showDoctor)}
      {c.tabWindowItems}
    </>
  );
}

/** A message row's contextual menu. */
export function MailMessageRowItems({ c }: { c: MailCommands }) {
  return (
    <>
      <SelectionItems c={c} keys={false} />
      <MenuSeparator />
      <MailShareSubmenu share={c.share} />
    </>
  );
}

/** The menu of Mail's tile in the Dock. */
export function MailDockItems({ c }: { c: MailCommands }) {
  return (
    <>
      <MenuItem onClick={c.getMail}>Get New Mail</MenuItem>
      <MenuItem onClick={c.newMessage}>New Message</MenuItem>
    </>
  );
}

/** One key of Mail's, the command it runs, and where it takes effect. */
export interface MailKey {
  equivalent: string;
  run: () => void;
  /** Left to a text field or the message text when the keyboard is in one. */
  notInText?: boolean;
  /** Also while a New Message window of Mail is the key window. */
  whileComposing?: boolean;
  /** The key is the command's only while this holds; otherwise it is left to the browser. */
  applies?: () => boolean;
}

/** Every key the menus above show. A key of a dimmed item is taken and does nothing. */
export function mailKeys(c: MailCommands): readonly MailKey[] {
  const ifAny = (run: () => void) => () => {
    if (c.chosen.length > 0) run();
  };
  const moving = (to: MailboxId, run: () => void) => () => {
    if (c.moveRefusal(to) === undefined) run();
  };
  const anyUnread = c.chosen.some((message) => message.unread);
  return [
    { equivalent: "shift+command+y", run: () => c.addSender?.() },
    { equivalent: "command+n", run: c.newMessage, whileComposing: true },
    { equivalent: "option+command+n", run: () => c.newViewer?.(), whileComposing: true },
    { equivalent: "command+o", run: ifAny(() => c.openMessages?.()) },
    { equivalent: "command+p", run: ifAny(c.print) },
    { equivalent: "command+y", run: () => c.quickLookAttachments?.() },
    { equivalent: "option+command+0", run: () => c.showActivity?.(), whileComposing: true },
    { equivalent: "shift+command+s", run: ifAny(c.saveAs) },
    { equivalent: "shift+command+e", run: () => c.one && c.redirect() },
    { equivalent: "shift+command+a", run: () => c.attachFiles?.(), whileComposing: true },
    {
      equivalent: "command+s",
      run: () => {
        if (c.composing) c.save();
      },
      whileComposing: true,
    },
    { equivalent: "shift+command+n", run: c.getMail, whileComposing: true },
    {
      equivalent: "shift+command+d",
      run: () => (c.composing ? c.send() : c.sendAgain()),
      whileComposing: true,
    },
    { equivalent: "command+r", run: () => c.reply("reply") },
    { equivalent: "shift+command+r", run: () => c.reply("all") },
    { equivalent: "shift+command+f", run: () => c.reply("forward") },
    { equivalent: "shift+command+u", run: ifAny(() => c.markRead(anyUnread)) },
    { equivalent: "shift+command+j", run: moving("junk", c.markJunk) },
    { equivalent: "control+command+a", run: moving("archive", c.archive) },
    {
      equivalent: "option+command+t",
      run: () => {
        if (c.lastMove && c.moveRefusal(c.lastMove) === undefined) c.move(c.lastMove);
      },
    },
    ...FLAGS.map((flag, index) => ({
      equivalent: `option+command+${index + 1}`,
      run: ifAny(() => c.setFlag(flag)),
    })),
    { equivalent: "option+command+0", run: ifAny(() => c.setFlag(undefined)) },
    { equivalent: "command+delete", run: ifAny(c.remove), notInText: true },
    {
      equivalent: "shift+command+delete",
      run: () => {
        if (c.canErase && c.counts.trash.all > 0) c.eraseDeleted();
      },
    },
    {
      equivalent: "option+command+j",
      run: () => {
        if (c.canErase && c.counts.junk.all > 0) c.eraseJunk();
      },
    },
    ...c.favorites.slice(0, 9).map(({ id }, at) => ({
      equivalent: goToKey(at),
      run: () => c.goTo(id),
    })),
    { equivalent: "command+l", run: () => c.setFilterOn(!c.filterOn) },
    { equivalent: "shift+command+m", run: c.toggleList },
    { equivalent: "option+shift+command+h", run: c.toggleFavorites },
    { equivalent: "shift+command+h", run: () => c.toggleMessageView("headers") },
    { equivalent: "option+command+u", run: () => c.toggleMessageView("source") },
    { equivalent: "option+command+f", run: c.findInMailbox },
    { equivalent: "command+f", run: () => c.findInMessage?.find() },
    { equivalent: "command+g", run: () => c.findInMessage?.next() },
    { equivalent: "shift+command+g", run: () => c.findInMessage?.previous() },
    { equivalent: "command+e", run: () => c.findInMessage?.findSelection() },
    { equivalent: "command+j", run: () => c.findInMessage?.jump() },
    {
      equivalent: "option+command+l",
      run: () => {
        if (c.hasRules && c.chosen.length > 0) c.applyRules();
      },
    },
    {
      equivalent: "command+z",
      run: () => {
        if (c.undoLabel) c.undo();
      },
      notInText: true,
    },
    {
      equivalent: "shift+command+z",
      run: () => {
        if (c.redoLabel) c.redo();
      },
      notInText: true,
    },
    {
      equivalent: "command+c",
      run: c.copy,
      notInText: true,
      // Text selected in a message is the browser's to copy.
      applies: () => c.chosen.length > 0 && document.getSelection()?.isCollapsed !== false,
    },
    {
      equivalent: "command+x",
      run: c.cut,
      notInText: true,
      applies: () => c.chosen.length > 0 && document.getSelection()?.isCollapsed !== false,
    },
    {
      equivalent: "command+a",
      run: () => {
        if (c.canSelectAll) c.selectAll();
      },
      notInText: true,
    },
  ];
}
