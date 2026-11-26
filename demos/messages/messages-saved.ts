import type { MessagesSettings, MessagesView } from "./messages-data";

/*
 * What Messages keeps for a person. The settings and the conversation shown go with their desktop
 * settings (`desktop-personal.ts`), so they follow to another browser. What is typed and not sent
 * stays in this browser, under the account's name: a setting holds a few KB, and a browser that
 * cannot store it opens with the fields empty.
 */

export const MESSAGES_SETTINGS = "messages.settings";
export const MESSAGES_SELECTED = "messages.selected";
export const MESSAGES_VIEW = "messages.view";
/** Details > Send Read Receipts, by conversation, where it differs from the Preferences' setting. */
export const MESSAGES_RECEIPTS = "messages.receipts";

/*
 * Each field is a record of its own, so that two tabs of a browser typing in different conversations
 * never overwrite each other's. An account's or conversation's name cannot hold the `/` between them
 * once encoded, so one account's records are never read as another's.
 */
const unsentPrefix = (me: string) => `macalicious.messages.unsent/${encodeURIComponent(me)}/`;

/** The settings as stored, or `undefined` when they are not what the window wrote. */
export function readMessagesSettings(stored: unknown): MessagesSettings | undefined {
  const kept = stored as Partial<MessagesSettings> | null;
  if (typeof kept !== "object" || kept === null) return undefined;
  return typeof kept.textSize === "number" && typeof kept.readReceipts === "boolean"
    ? (kept as MessagesSettings)
    : undefined;
}

/** The View menu's choices as stored, or `undefined` when they are not what the window wrote. */
export function readMessagesView(stored: unknown): MessagesView | undefined {
  const kept = stored as Partial<MessagesView> | null;
  if (typeof kept !== "object" || kept === null) return undefined;
  return typeof kept.listHidden === "boolean" &&
    (kept.senders === "all" || kept.senders === "unknown")
    ? { listHidden: kept.listHidden, senders: kept.senders }
    : undefined;
}

/** Each conversation's own Send Read Receipts, leaving out whatever the window did not write. */
export function readConversationReceipts(
  stored: unknown,
): Readonly<Record<string, boolean>> | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

export const readSelected = (stored: unknown): string | undefined =>
  typeof stored === "string" && stored !== "" ? stored : undefined;

/** What the account left typed in each conversation. */
export function readUnsent(me: string): ReadonlyMap<string, string> {
  const kept = new Map<string, string>();
  try {
    const { localStorage: storage } = window;
    const prefix = unsentPrefix(me);
    for (let at = 0; at < storage.length; at += 1) {
      const name = storage.key(at);
      const text = name?.startsWith(prefix) ? storage.getItem(name) : null;
      if (name && text) kept.set(decodeURIComponent(name.slice(prefix.length)), text);
    }
  } catch {
    // The fields open empty.
  }
  return kept;
}

/**
 * Stores what the person left in one field, and nothing else: a field another tab is typing in stays
 * as that tab left it. An empty field keeps nothing.
 */
export function writeUnsent(me: string, id: string, text: string): void {
  try {
    const name = unsentPrefix(me) + encodeURIComponent(id);
    if (text === "") window.localStorage.removeItem(name);
    else window.localStorage.setItem(name, text);
  } catch {
    // The field opens empty next time.
  }
}
