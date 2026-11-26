import { MenuItem } from "macalicious/menu-item";
import { ShareMenuItem } from "macalicious/share-menu";
import type { ReactNode } from "react";
import { shareExtensionOn } from "../system-preferences/setting-effects";
import { type DesktopDragItem, fileItemsOfDrag } from "./desktop-drag";
import { requestDesktopEffects } from "./desktop-effects";
import { linkAddress } from "./desktop-open-url";

/*
 * Sharing a link from any app: the rows of a Share menu for a link, the same in every app
 * (Safari, News and Stocks; Help Viewer, Maps and Contacts are wired by their session).
 *
 * - Copy Link puts the address on the clipboard: the Async Clipboard API first, then a selected
 *   text's copy command for an engine or page that refuses it. It says whether it did
 *   (`onCopied`), so an app never claims a copy that did not happen.
 * - Mail, Messages, Notes and Reminders: a link is handed to the app as `openUrl` hands one to
 *   Safari: `shareLink(app, ...)` keeps it until that app takes it (`takeSharedLinks`), announces
 *   it (`SHARE_LINK_EVENT`, heard through `onSharedLink`) and opens the app. An app that takes
 *   links is listed in `SHARE_RECEIVERS`; until it is, its row is dimmed with the reason.
 * - AirDrop sends to nearby devices, which a web page cannot reach: always dimmed, saying so.
 */

/** The event a shared link is announced with; the app it is for hears it (`onSharedLink`). */
export const SHARE_LINK_EVENT = "macalicious:share-link";

/** The most shared links kept for apps that have not taken them yet; the oldest go first. */
export const MAX_PENDING_SHARES = 20;

/** A link shared with an app. */
export interface SharedLink {
  url: string;
  title: string;
  /** The app it was shared from. */
  from: string;
  /** The app it was shared with. */
  to: string;
}

/** An app a link can be shared with, and why it cannot take one (`null`: it can). */
export interface ShareTarget {
  app: string;
  title: string;
  reason: string | null;
}

/**
 * The apps that take a shared link. An app is listed here once its window takes the links kept
 * for it (`takeSharedLinks`) and hears new ones (`onSharedLink`), as Safari does for `openUrl`:
 * Messages starts a new message with the link (`messages-live.tsx`), Notes makes a new note of it
 * (`notes.tsx`), Reminders makes a reminder of it (`reminders.tsx`), Mail opens a New Message
 * with it (`takesSharedLinks` in `mail.tsx`), and Safari adds it to the Reading List (`safari.tsx`).
 */
export const SHARE_RECEIVERS: ReadonlySet<string> = new Set<string>([
  "mail",
  "messages",
  "notes",
  "reminders",
  "safari",
]);

const TARGETS: readonly { app: string; title: string }[] = [
  { app: "mail", title: "Mail" },
  { app: "messages", title: "Messages" },
  { app: "notes", title: "Notes" },
  { app: "reminders", title: "Reminders" },
  { app: "safari", title: "Add to Reading List" },
];

/** Why AirDrop is dimmed. */
export const AIRDROP_REASON = "AirDrop sends to nearby devices, which a web page can’t reach.";

/** Why every row is dimmed for something with no web address. */
export const NO_ADDRESS_REASON = "There is no web address to share.";

/** The apps a link can be shared with, in a Share menu's order, each with why it cannot take one. */
export function shareTargets(receivers: ReadonlySet<string> = SHARE_RECEIVERS): ShareTarget[] {
  return TARGETS.filter(({ app }) => shareExtensionOn(app)).map(({ app, title }) => ({
    app,
    title,
    reason: receivers.has(app) ? null : `${title} can’t take a shared link yet.`,
  }));
}

const pending: SharedLink[] = [];

/**
 * Share `url` with `app`: kept for it until it takes it, announced with `SHARE_LINK_EVENT`, and
 * the app opened. `null` when the address is not a web link (`linkAddress`) or the app does not
 * take links.
 */
export function shareLink(
  app: string,
  url: string,
  title: string,
  from: string,
  receivers: ReadonlySet<string> = SHARE_RECEIVERS,
): SharedLink | null {
  const address = linkAddress(url);
  if (address === null || !receivers.has(app) || typeof window === "undefined") return null;
  const link: SharedLink = { url: address, title: title.trim().slice(0, 300), from, to: app };
  pending.push(link);
  if (pending.length > MAX_PENDING_SHARES) pending.splice(0, pending.length - MAX_PENDING_SHARES);
  window.dispatchEvent(new CustomEvent(SHARE_LINK_EVENT, { cancelable: true, detail: link }));
  requestDesktopEffects([{ open: app }]);
  return link;
}

/** The links kept for `app`, oldest first, and forgets them: an app's window takes them when it
 * opens. */
export function takeSharedLinks(app: string): SharedLink[] {
  const taken = pending.filter((link) => link.to === app);
  for (const link of taken) pending.splice(pending.indexOf(link), 1);
  return taken;
}

/** Hears every link shared with `app` from now on; the link is then not kept for it as well.
 * Answers the function that stops hearing. */
export function onSharedLink(app: string, listener: (link: SharedLink) => void): () => void {
  const hear = (event: Event) => {
    if (event.defaultPrevented) return;
    const detail = (event as CustomEvent<unknown>).detail as Partial<SharedLink> | null;
    if (!detail || typeof detail !== "object" || detail.to !== app) return;
    const at = pending.indexOf(detail as SharedLink);
    if (at >= 0) pending.splice(at, 1);
    const address = linkAddress(detail.url);
    if (address === null) return;
    event.preventDefault();
    listener({
      url: address,
      title: typeof detail.title === "string" ? detail.title : "",
      from: typeof detail.from === "string" ? detail.from : "unknown",
      to: app,
    });
  };
  window.addEventListener(SHARE_LINK_EVENT, hear);
  return () => window.removeEventListener(SHARE_LINK_EVENT, hear);
}

const copyHearers = new Set<() => void>();

/**
 * Hears every copy made through `copyText`, which fires no copy event while the Async Clipboard API
 * takes it. Answers the function that stops hearing.
 */
export function onTextCopied(listener: () => void): () => void {
  copyHearers.add(listener);
  return () => {
    copyHearers.delete(listener);
  };
}

/**
 * Put `text` on the clipboard: the Async Clipboard API, or, where it is missing or refuses (no
 * permission, an engine that wants a gesture it does not count), a selected text's copy command.
 * Whether the text is there.
 */
export async function copyText(text: string): Promise<boolean> {
  for (const listener of copyHearers) listener();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused: the selected text's copy below.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  try {
    document.body.append(area);
    area.focus({ preventScroll: true });
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    // Gone, and the keyboard back where it was, whatever the copy command did.
    area.remove();
    before?.focus({ preventScroll: true });
  }
}

/*
 * Sharing files from Finder and Quick Look: the same shape as a link. `shareFiles` keeps them for
 * the app until it takes them (`takeSharedFiles`), announces them (`SHARE_FILES_EVENT`, heard
 * through `onSharedFiles`) and opens the app. An app takes files once its descriptor says
 * `takesSharedFiles`; until then its row is dimmed with the reason.
 */

/** The event shared files are announced with; the app they are for hears it (`onSharedFiles`). */
export const SHARE_FILES_EVENT = "macalicious:share-files";

/** Drive files shared with an app. */
export interface SharedFiles {
  items: DesktopDragItem[];
  /** The app they were shared from. */
  from: string;
  /** The app they were shared with. */
  to: string;
}

const FILE_TARGETS: readonly { app: string; title: string; name: string }[] = [
  { app: "mail", title: "Mail", name: "Mail" },
  { app: "messages", title: "Messages", name: "Messages" },
  { app: "notes", title: "Notes", name: "Notes" },
  { app: "photos", title: "Add to Photos", name: "Photos" },
];

/** Why every file row is dimmed for a selection with no file in it. */
export const NO_FILE_REASON = "There is no file to share.";

const fileReceivers = new Set<string>();

/**
 * Hears which of the desktop's applications take shared files, from their descriptors. Answers the
 * function that forgets them.
 */
export function registerFileReceivers(
  apps: readonly { id: string; takesSharedFiles?: boolean }[],
): () => void {
  const added = apps.filter((app) => app.takesSharedFiles).map((app) => app.id);
  for (const id of added) fileReceivers.add(id);
  return () => {
    for (const id of added) fileReceivers.delete(id);
  };
}

const pendingFiles: SharedFiles[] = [];

/**
 * Share the files among `items`, and those in its folders, with `app`: kept until it takes them,
 * announced, and the app opened. `null` when there is no file, the app does not take files, or
 * `MAX_PENDING_SHARES` shares already wait for apps that have not taken them: what was accepted is
 * never dropped.
 */
export function shareFiles(
  app: string,
  items: readonly DesktopDragItem[],
  from: string,
): SharedFiles | null {
  const files = fileItemsOfDrag(items);
  if (
    files.length === 0 ||
    !fileReceivers.has(app) ||
    pendingFiles.length >= MAX_PENDING_SHARES ||
    typeof window === "undefined"
  )
    return null;
  const shared: SharedFiles = { items: files, from, to: app };
  pendingFiles.push(shared);
  window.dispatchEvent(new CustomEvent(SHARE_FILES_EVENT, { cancelable: true, detail: shared }));
  requestDesktopEffects([{ open: app }]);
  return shared;
}

/** The files kept for `app`, oldest first, and forgets them: its window takes them when it opens. */
export function takeSharedFiles(app: string): SharedFiles[] {
  const taken = pendingFiles.filter((shared) => shared.to === app);
  for (const shared of taken) pendingFiles.splice(pendingFiles.indexOf(shared), 1);
  return taken;
}

/** Hears every share of files with `app` from now on; they are then not kept for it as well.
 * Answers the function that stops hearing. */
export function onSharedFiles(app: string, listener: (shared: SharedFiles) => void): () => void {
  const hear = (event: Event) => {
    if (event.defaultPrevented) return;
    const shared = (event as CustomEvent<SharedFiles>).detail;
    if (shared?.to !== app) return;
    const at = pendingFiles.indexOf(shared);
    if (at >= 0) pendingFiles.splice(at, 1);
    event.preventDefault();
    listener(shared);
  };
  window.addEventListener(SHARE_FILES_EVENT, hear);
  return () => window.removeEventListener(SHARE_FILES_EVENT, hear);
}

export interface FileShareItemsProps {
  /** The drive items to share. */
  items: readonly DesktopDragItem[];
  /** The app sharing them. */
  from: string;
  /**
   * What is handed over when a row is chosen, when it is not `items` themselves: Photos renders an
   * edited photo first. Answers nothing to share when it fails, having said why.
   */
  prepare?: () => Promise<readonly DesktopDragItem[]>;
}

/**
 * The rows of a Share menu for drive files: Mail, Messages, AirDrop, Notes and Add to Photos, each
 * sharing the files or dimmed with its reason (the row's help tag, `title`, and `data-reason`).
 */
export function FileShareItems({ items, from, prepare }: FileShareItemsProps) {
  const hasFile = fileItemsOfDrag(items).length > 0;
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
  const rows = FILE_TARGETS.filter(({ app }) => shareExtensionOn(app)).map(({ app, title, name }) =>
    row(
      app,
      title,
      !hasFile ? NO_FILE_REASON : fileReceivers.has(app) ? null : `${name} can’t take a file yet.`,
      () => {
        if (prepare) void prepare().then((made) => shareFiles(app, made, from));
        else shareFiles(app, items, from);
      },
    ),
  );
  return (
    <>
      {rows.slice(0, 2)}
      {row("airdrop", "AirDrop", AIRDROP_REASON)}
      {rows.slice(2)}
    </>
  );
}

export interface LinkShareItemsProps {
  /** The link: a web address, or anything else (every row is then dimmed, saying why). */
  url: string;
  /** What the link is called, handed with it. */
  title: string;
  /** The app sharing it. */
  from: string;
  /** Rows of a plain menu (`MenuItem`), without a Share menu's icon column. */
  plain?: boolean;
  /** Each row's icon in a Share menu, by key: `copy`, `mail`, `messages`, `airdrop`, `notes`,
   * `reminders`. */
  images?: Readonly<Partial<Record<string, ReactNode>>>;
  /** A row's own title, by key: Safari's "Email This Page" for `mail`. */
  titles?: Readonly<Partial<Record<string, string>>>;
  /** Hears whether Copy Link put the link on the clipboard. */
  onCopied?: (copied: boolean) => void;
}

/**
 * The rows of a Share menu for a link: Copy Link, then Mail, Messages, AirDrop, Notes, Reminders
 * and Add to Reading List, each sharing the link or dimmed with its reason (the row's help tag, `title`, and
 * `data-reason`). Put them in a `ShareMenu`, or with `plain` in any menu.
 */
export function LinkShareItems({
  url,
  title,
  from,
  plain = false,
  images,
  titles,
  onCopied,
}: LinkShareItemsProps) {
  const address = linkAddress(url);
  const row = (key: string, label: string, reason: string | null, onClick?: () => void) => {
    const props = {
      disabled: reason !== null,
      title: reason ?? undefined,
      "data-reason": reason ?? undefined,
      onClick: reason === null ? onClick : undefined,
    };
    return plain ? (
      <MenuItem key={key} {...props}>
        {label}
      </MenuItem>
    ) : (
      <ShareMenuItem key={key} image={images?.[key]} {...props}>
        {label}
      </ShareMenuItem>
    );
  };
  const targets = shareTargets()
    // Safari's Share menu has its own row for its own page.
    .filter((target) => !(target.app === "safari" && from === "safari"))
    .map((target) =>
      row(
        target.app,
        titles?.[target.app] ?? target.title,
        address === null ? NO_ADDRESS_REASON : target.reason,
        () => {
          if (address) shareLink(target.app, address, title, from);
        },
      ),
    );
  return (
    <>
      {row("copy", titles?.copy ?? "Copy Link", address === null ? NO_ADDRESS_REASON : null, () => {
        if (address) void copyText(address).then((copied) => onCopied?.(copied));
      })}
      {targets.slice(0, 2)}
      {row("airdrop", titles?.airdrop ?? "AirDrop", AIRDROP_REASON)}
      {targets.slice(2)}
    </>
  );
}
