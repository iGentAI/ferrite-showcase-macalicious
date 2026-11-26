import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import type { MailSettings } from "./mail-data";
import { MAIL_FILTERS, MAIL_SORTS, type MailFilter, type MailSort } from "./mail-menus";

/*
 * What Mail keeps for a person with their other settings (`desktop-personal.ts`), so that it follows
 * them from browser to browser: the Preferences window's settings, and what the viewer shows.
 */

export const MAIL_VIEW = "mail.view";
export const MAIL_SETTINGS = "mail.settings";

/** Preferences > General > Downloads folder: where Mail saves a file on the person's drive. */
export const mailDownloadsFolder = (): "Downloads" | "Desktop" =>
  readMailSettings(desktopValues()[MAIL_SETTINGS])?.downloads === "Desktop"
    ? "Desktop"
    : "Downloads";

export const MAIL_SMART = "mail.smart";
export const MAIL_VIPS = "mail.vips";
export const MAIL_RULES = "mail.rules";
export const MAIL_SIGNATURES = "mail.signatures";
export const MAIL_BLOCKED = "mail.blocked";
export const MAIL_RECIPIENTS_REMOVED = "mail.recipientsRemoved";
export const MAIL_STATIONERY = "mail.stationery";
export const MAIL_ROLES = "mail.roles";

/** Which of the person's mailboxes stand in for Sent, Trash, Archive and Junk. */
export interface MailRoles {
  sent?: `box-${string}`;
  trash?: `box-${string}`;
  archive?: `box-${string}`;
  junk?: `box-${string}`;
}

/** The roles as stored: a role naming no mailbox a person can have is left out. */
export function readMailRoles(stored: unknown): MailRoles {
  const roles = (typeof stored === "object" && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  const box = (value: unknown) =>
    typeof value === "string" && value.startsWith("box-") ? (value as `box-${string}`) : undefined;
  const kept: MailRoles = {};
  for (const role of ["sent", "trash", "archive", "junk"] as const) {
    const mailbox = box(roles[role]);
    if (mailbox) kept[role] = mailbox;
  }
  return kept;
}

/** `own` in the order the person dragged them into; one not in `order` goes last. */
export function inMailboxOrder<T extends { id: string }>(
  own: readonly T[],
  order: readonly string[],
): readonly T[] {
  const at = (id: string) => {
    const found = order.indexOf(id);
    return found < 0 ? order.length : found;
  };
  return [...own].sort((a, b) => at(a.id) - at(b.id));
}

/** The order with `moved` put just before `before`, of the mailboxes `own` lists now. */
export function movedBefore(
  own: readonly { id: string }[],
  moved: string,
  before: string,
): readonly string[] {
  const ids = own.map(({ id }) => id).filter((id) => id !== moved);
  const at = ids.indexOf(before);
  ids.splice(at < 0 ? ids.length : at, 0, moved);
  return ids;
}

/** How often Preferences > General's Check for new messages looks, in milliseconds, if it does. */
export function checkEvery(settings: MailSettings | undefined): number | null {
  switch (settings?.check) {
    case "Every minute":
      return 60_000;
    case "Every 5 minutes":
      return 300_000;
    case "Every hour":
      return 3_600_000;
    default:
      return null;
  }
}

/** Whether mail is looked for only as that choice says, not as the server announces each delivery. */
export const checksByChoice = (settings: MailSettings | undefined) =>
  settings?.check !== undefined && settings.check !== "Automatically";

export interface MailView {
  mailbox: string;
  sort: MailSort;
  /** The order chosen in View > Sort By, or `null` for the sort's own. */
  ascending: boolean | null;
  filterOn: boolean;
  filters: readonly MailFilter[];
  favorites: boolean;
  /** What the Favorites bar holds, in its order. Absent: Inbox, Sent and Drafts. */
  favoriteBoxes?: readonly string[];
  /** The mailbox list's width: 0 when it is hidden. */
  sidebar: number;
  /** The message list's width. */
  list: number;
  /** The message list's height in the classic layout. */
  classicList?: number;
  /** View > Organize by Conversation. */
  conversations: boolean;
  /** View > Hide Toolbar. Absent: shown. */
  toolbar?: boolean;
  /** What View > Customize Toolbar took out. Absent: nothing. */
  toolbarHidden?: readonly string[];
  /** The mailboxes the person made, in the order dragged into. Absent: as the server lists them. */
  boxOrder?: readonly string[];
}

export const DEFAULT_FAVORITES: readonly string[] = ["inbox", "sent", "drafts"];

const widthIn = (stored: unknown, least: number, most: number): stored is number =>
  typeof stored === "number" && Number.isFinite(stored) && stored >= least && stored <= most;

/** The view as stored, or `undefined` when any of it is not something Mail wrote. */
export function readMailView(stored: unknown): MailView | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const view = stored as Partial<Record<keyof MailView, unknown>>;
  const known = view.filters;
  if (
    typeof view.mailbox !== "string" ||
    !MAIL_SORTS.some(([sort]) => sort === view.sort) ||
    !(view.ascending === null || typeof view.ascending === "boolean") ||
    typeof view.filterOn !== "boolean" ||
    !Array.isArray(known) ||
    !known.every((each) => MAIL_FILTERS.some(([filter]) => filter === each)) ||
    typeof view.favorites !== "boolean" ||
    !(view.sidebar === 0 || widthIn(view.sidebar, 150, 320)) ||
    !widthIn(view.list, 220, 520)
  ) {
    return undefined;
  }
  const boxes = view.favoriteBoxes;
  const strings = (list: unknown) =>
    Array.isArray(list) && list.every((each) => typeof each === "string")
      ? (list as string[])
      : undefined;
  return {
    ...(view as MailView),
    conversations: view.conversations === true,
    toolbar: view.toolbar === false ? false : undefined,
    toolbarHidden: strings(view.toolbarHidden),
    boxOrder: strings(view.boxOrder),
    favoriteBoxes:
      Array.isArray(boxes) && boxes.every((each) => typeof each === "string")
        ? (boxes as string[])
        : undefined,
    classicList: widthIn(view.classicList, 120, 600) ? view.classicList : undefined,
  };
}

/** The settings as stored, or `undefined` when they are not a record of switches and choices. */
export function readMailSettings(stored: unknown): MailSettings | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  const fine = Object.values(stored).every(
    (value) => typeof value === "boolean" || typeof value === "string",
  );
  return fine ? (stored as MailSettings) : undefined;
}

/** Saves `value` under `key`, unless that is what is stored already. */
export function keepMailValue(key: string, value: unknown): void {
  if (JSON.stringify(desktopValues()[key]) !== JSON.stringify(value)) {
    changeDesktopValue(key, value);
  }
}
