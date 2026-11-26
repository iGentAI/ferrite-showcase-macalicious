import { useEffect, useRef, useSyncExternalStore } from "react";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import {
  CHANGED_ELSEWHERE,
  reportFailure,
  sessionFetch,
  withDeadline,
} from "../desktop/desktop-server";
import {
  LIST_COLORS,
  type Reminder,
  type ReminderColor,
  type ReminderList,
} from "./reminders-data";
import { armMissingAlerts, isReminderShape, refreshReminders } from "./reminders-sync";
import { settleParents } from "./reminders-tree";

/*
 * The lists the signed-in person shares with other accounts, kept on the macalicious-desktop
 * Ferrite application (`/api/reminders/shared`, ferrite-apps/desktop/src/apps/reminders/
 * shared.rs). Each shared list is a document of its own, with its own revision, on the rule of
 * the person's own document (reminders-sync.ts): a save names the revision it is based on, one
 * save is under way per list, and a save the server refuses or does not answer gives way to the
 * lists read again. Nothing here runs unless the page is served by the application.
 */

const SHARED = "/api/reminders/shared";

/** Someone on a shared list. */
export interface SharedPerson {
  /** The account name. */
  name: string;
  fullName: string;
}

/** A shared list as the server sends it. */
export interface SharedList {
  id: string;
  rev: number;
  name: string;
  color: ReminderColor;
  owner: SharedPerson;
  /** Everyone on it but its owner. */
  members: SharedPerson[];
  /** Whether the person reading it owns it. */
  owned: boolean;
  reminders: Reminder[];
}

/** The page's shared lists, and whether the person may share. */
export interface SharedState {
  lists: readonly SharedList[];
  canShare: boolean;
  /** The person's own account name. */
  me?: string;
  /**
   * A new number each time the page's copy changes: read with something new in it, read again
   * after a save that did not go through, or changed by a window.
   */
  seq: number;
  /** The window whose change the lists are, or `null` when they were read from the server. */
  origin: object | null;
  /** Whether a change of this page to a shared list is not stored yet. */
  unsaved: boolean;
}

/*
 * A window knows a shared list's reminders by keys of their own, `<list>/<id>`: the ids of two
 * lists' reminders may be the same (a list shared with someone holds the ids its owner gave its
 * reminders), and no id the server keeps has a "/" in it (`is_id` in reminders/mod.rs).
 */

/**
 * What a request to open an item of Reminders names: a reminder or a shared list, `null` for a list
 * the person no longer has. Spotlight asks with the reminder's id; a reminder's alert says
 * `alert:<id>@<at>` (reminders/mod.rs), and a shared list's notification `share-<list>`,
 * `share-<list>-<rev>`, `left-<list>-<rev>` or `unshare-<list>-<rev>` (reminders/shared.rs).
 */
export function reminderOfOpenItem(item: string): string | null {
  const told = /^(share|left|unshare)-(sh-[0-9a-f]{24})(?:-\d+)?$/.exec(item);
  if (told) return told[1] === "unshare" ? null : (told[2] ?? null);
  return /^alert:(.+)@\d+$/.exec(item)?.[1] ?? item;
}

/** The window's key for reminder `id` of shared list `list`. */
export const sharedReminderKey = (list: string, id: string) => `${list}/${id}`;
/** Whether a window's reminder key is a shared list's. */
export const isSharedKey = (key: string) => key.includes("/");
/** The id the server knows a shared list's reminder by, from its key. */
export const sharedReminderId = (key: string) => key.slice(key.indexOf("/") + 1);

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

function personOf(value: unknown): SharedPerson | null {
  return isObject(value) && isString(value.name) && isString(value.full_name)
    ? { name: value.name, fullName: value.full_name }
    : null;
}

/** A list of the `GET` reply, or `null` when it is not one, its reminders all in it. */
export function sharedListOf(value: unknown): SharedList | null {
  if (!isObject(value) || !isString(value.id) || !/^sh-[0-9a-f]{24}$/.test(value.id)) return null;
  const { rev, name, color, owned, reminders } = value;
  if (!Number.isSafeInteger(rev) || (rev as number) < 0 || !isString(name)) return null;
  if (!LIST_COLORS.includes(color as ReminderColor) || typeof owned !== "boolean") return null;
  const owner = personOf(value.owner);
  const members = Array.isArray(value.members) ? value.members.map(personOf) : null;
  if (!owner || !members || members.some((each) => each === null)) return null;
  if (!Array.isArray(reminders)) return null;
  const ids = new Set<string>();
  for (const reminder of reminders) {
    if (!isReminderShape(reminder) || reminder.listId !== value.id || ids.has(reminder.id)) {
      return null;
    }
    ids.add(reminder.id);
  }
  return {
    id: value.id,
    rev: rev as number,
    name,
    color: color as ReminderColor,
    owner,
    members: members as SharedPerson[],
    owned,
    reminders: reminders as Reminder[],
  };
}

const EMPTY: SharedState = { lists: [], canShare: false, seq: 0, origin: null, unsaved: false };
let state: SharedState = EMPTY;
const listeners = new Set<() => void>();
const publish = (next: SharedState) => {
  state = next;
  for (const listener of listeners) listener();
};

/** JSON with every object's fields in order: two copies of a list compare equal however built. */
const canon = (value: unknown) =>
  JSON.stringify(value, (_key, item: unknown) =>
    isObject(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item,
  );

/** A list's reminders as they are kept: one still being typed, with no title yet, is left out. */
const keptOf = (reminders: readonly Reminder[]): Reminder[] => [
  ...settleParents(reminders.filter((reminder) => reminder.title.trim() !== "")),
];

/** The document a save sends: the list, and its reminders. */
const bodyOf = (
  list: Pick<ReminderList, "id" | "name" | "color">,
  reminders: readonly Reminder[],
) =>
  canon({
    lists: [{ id: list.id, name: list.name, color: list.color }],
    reminders: keptOf(reminders),
  });

/** What each list was last read or saved as: what a save is based on, and compared with. */
const stored = new Map<string, { rev: number; body: string }>();
const inflight = new Set<string>();
/** A list's change waiting for the save under way. */
const waiting = new Map<string, { list: ReminderList; reminders: Reminder[] }>();
/** The lists whose change, as the windows show it, is not stored yet. */
const unsaved = new Set<string>();
let reads = 0;
/** Whether a read came back while a save was under way, and is to be made again after it. */
let reread = false;
/** Whether that read is to show the lists as read even when nothing in them is new. */
let rereadForce = false;
/** Counts the saves started: a read answered after a save began may not hold it. */
let writes = 0;
/** How many reads are under way, and a read asked for meanwhile (made once they are done). */
let loading = 0;
let queued: "none" | "plain" | "force" = "none";

const markUnsaved = (id: string, on: boolean) => {
  if (unsaved.has(id) === on) return;
  if (on) unsaved.add(id);
  else unsaved.delete(id);
  publish({ ...state, unsaved: unsaved.size > 0 });
};

/** A reply: its status, and its body read as JSON (`null` when it is not), both by the deadline. */
interface Reply {
  ok: boolean;
  status: number;
  body: unknown;
}

async function request(url: string, init?: RequestInit): Promise<Reply> {
  // The body is read inside the deadline too: a body that never finishes fails with it.
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      ...init,
      headers: { accept: "application/json", ...(init?.headers ?? {}) },
      signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;
    return { ok: response.ok, status: response.status, body };
  });
}

/** The lists, whether the person may share and their name, as compared with a read. */
const contentOf = (of: Pick<SharedState, "lists" | "canShare" | "me">) =>
  canon({ lists: of.lists, canShare: of.canShare, me: of.me ?? null });

/**
 * Read the shared lists again; the page's copy changes only when something did, or always with
 * `force` (after a save that did not go through, so that every window shows what is stored). A
 * read that comes back while a save is under way, or after one began, is made again once the
 * saves are done: it may not hold the change being saved.
 */
export async function loadShared(force = false): Promise<void> {
  const read = ++reads;
  // A save under way as the read goes out, or one begun before it is answered, may be missing
  // from what it reads.
  const since = writes;
  const busy = inflight.size > 0;
  loading += 1;
  try {
    const response = await request(SHARED);
    if (!response.ok) return;
    const reply = response.body;
    if (read !== reads || !isObject(reply) || !Array.isArray(reply.lists)) return;
    if (busy || writes !== since || inflight.size > 0 || waiting.size > 0) {
      reread = true;
      rereadForce ||= force;
      await afterSaves();
      return;
    }
    const lists = reply.lists.map(sharedListOf).filter((each): each is SharedList => each !== null);
    stored.clear();
    for (const list of lists) {
      stored.set(list.id, { rev: list.rev, body: bodyOf(list, list.reminders) });
    }
    const next = {
      lists,
      canShare: reply.can_share === true,
      ...(isString(reply.me) ? { me: reply.me } : {}),
    };
    unsaved.clear();
    if (force || contentOf(next) !== contentOf(state)) {
      publish({ ...next, seq: state.seq + 1, origin: null, unsaved: false });
    } else if (state.unsaved) {
      publish({ ...state, unsaved: false });
    }
  } catch {
    // Read again at the next change or window.
  } finally {
    loading -= 1;
    if (loading === 0 && queued !== "none") {
      const again = queued === "force";
      queued = "none";
      void loadShared(again);
    }
  }
}

/** A read asked for by a change elsewhere: one at a time, those asked for meanwhile made as one. */
function requestShared(force = false) {
  if (loading > 0) {
    queued = force || queued === "force" ? "force" : "plain";
    return;
  }
  void loadShared(force);
}

/** Make the read put off while saves were under way, once none is. */
async function afterSaves() {
  if (!reread || inflight.size > 0 || waiting.size > 0) return;
  const force = rereadForce;
  reread = false;
  rereadForce = false;
  await loadShared(force);
}

/**
 * Reminders of a refused save made again on the list as it is now: the person's own changes
 * since `base` (each reminder added, changed or removed) over `theirs`.
 */
export function replayed(
  base: readonly Reminder[],
  mine: readonly Reminder[],
  theirs: readonly Reminder[],
): Reminder[] {
  const was = new Map(base.map((reminder) => [reminder.id, canon(reminder)]));
  const kept = new Set(mine.map((reminder) => reminder.id));
  // Removed here: removed there too.
  const out = theirs.filter((reminder) => !was.has(reminder.id) || kept.has(reminder.id));
  for (const reminder of mine) {
    if (was.get(reminder.id) === canon(reminder)) continue;
    const at = out.findIndex((each) => each.id === reminder.id);
    if (at >= 0) out[at] = reminder;
    else out.push(reminder);
  }
  return out;
}

/** Shared list `id` as stored now, or `null` when it could not be read or is gone. */
async function freshList(id: string): Promise<SharedList | null> {
  try {
    const response = await request(SHARED);
    if (!response.ok) return null;
    const reply = response.body;
    if (!isObject(reply) || !Array.isArray(reply.lists)) return null;
    return (
      reply.lists
        .map(sharedListOf)
        .find((each): each is SharedList => each !== null && each.id === id) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Send shared list `id` with `reminders`. A save refused because someone else saved first is
 * made again once on the list as it now is, the person's own changes replayed over theirs; one
 * refused for what it holds stays unsaved, shown as such; one whose outcome is not known gives
 * way to the lists as stored.
 */
async function send(
  id: string,
  list: ReminderList,
  reminders: Reminder[],
  again = false,
): Promise<void> {
  const base = stored.get(id);
  if (!base) return;
  const body = bodyOf(list, reminders);
  if (body === base.body) {
    // A change that waited behind this one is sent now, not left waiting.
    const pending = waiting.get(id);
    if (pending) {
      waiting.delete(id);
      await send(id, pending.list, pending.reminders, again);
      return;
    }
    markUnsaved(id, false);
    await afterSaves();
    return;
  }
  writes += 1;
  inflight.add(id);
  let outcome: "saved" | "conflict" | "refused" | "unknown" = "unknown";
  let status = 0;
  let said: string | undefined;
  try {
    const response = await request(`${SHARED}/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: `{"base":${base.rev},"data":${body}}`,
    });
    if (response.ok) {
      const reply = (response.body ?? {}) as { rev?: unknown };
      if (Number.isSafeInteger(reply.rev)) {
        const rev = reply.rev as number;
        stored.set(id, { rev, body });
        // The page's copy carries the revision, as a read of the lists would.
        publish({
          ...state,
          lists: state.lists.map((each) => (each.id === id ? { ...each, rev } : each)),
        });
        outcome = "saved";
      }
    } else if (response.status === 409) {
      outcome = "conflict";
    } else if (response.status < 500 && response.status !== 408 && response.status !== 429) {
      outcome = "refused";
      status = response.status;
      if (isObject(response.body) && isString(response.body.error)) said = response.body.error;
    }
  } catch {
    // Not known: read again below.
  }
  const next = waiting.get(id);
  waiting.delete(id);
  if (outcome === "conflict" && !again) {
    const fresh = await freshList(id);
    // A change made while the list was read again is the newest of this page's: it is the one
    // replayed (made on the same base, it holds the earlier change too).
    const during = waiting.get(id);
    waiting.delete(id);
    const latest = during ?? next;
    if (fresh) {
      const mine = latest?.reminders ?? reminders;
      const before = (JSON.parse(base.body) as { reminders: Reminder[] }).reminders;
      const merged = replayed(before, mine, fresh.reminders);
      stored.set(id, { rev: fresh.rev, body: bodyOf(fresh, fresh.reminders) });
      // Every window shows the list as it now is, with this page's changes on it.
      publish({
        ...state,
        lists: state.lists.map((each) => (each.id === id ? { ...fresh, reminders: merged } : each)),
        seq: state.seq + 1,
        origin: null,
      });
      inflight.delete(id);
      await send(id, latest?.list ?? list, merged, true);
      return;
    }
  }
  inflight.delete(id);
  if (outcome === "saved") {
    if (next) {
      await send(id, next.list, next.reminders);
      return;
    }
    markUnsaved(id, false);
  } else if (outcome === "refused") {
    // Kept as the window shows it, and unsaved: a newer change is sent, or the next one.
    reportFailure({
      url: `${SHARED}/${id}`,
      reason: `HTTP ${status}`,
      ...(said ? { detail: said } : {}),
    });
    if (next) {
      await send(id, next.list, next.reminders);
      return;
    }
  } else {
    // A save refused twice for a newer copy is not kept, and is said so; one whose outcome is
    // not known may have been. Either gives way to the lists as stored, a waiting change with it.
    if (outcome === "conflict")
      reportFailure({ url: `${SHARED}/${id}`, reason: CHANGED_ELSEWHERE });
    await loadShared(true);
    return;
  }
  await afterSaves();
}

/**
 * Save shared list `list` with `reminders`, as the window `origin` shows them. The page's other
 * windows are given the change to show; the window that made it already shows it.
 */
export function saveShared(list: ReminderList, reminders: Reminder[], origin: object): void {
  const base = stored.get(list.id);
  if (!base) return;
  const kept = keptOf(reminders);
  if (bodyOf(list, kept) !== base.body) unsaved.add(list.id);
  publish({
    ...state,
    lists: state.lists.map((each) => (each.id === list.id ? { ...each, reminders: kept } : each)),
    seq: state.seq + 1,
    origin,
    unsaved: unsaved.size > 0,
  });
  if (inflight.has(list.id)) {
    waiting.set(list.id, { list, reminders: kept });
    return;
  }
  void send(list.id, list, kept);
}

/**
 * What an action on a list resolves with: why it failed, or `null`. `own`: the person's own
 * document changed with it. `done` is given the reply of an action that succeeded, before the
 * lists are read again. `rearm`: the action may have taken a list back into the person's own
 * document, which the server does without alerts; those its due reminders lack are armed then.
 */
async function act(
  url: string,
  init: RequestInit,
  own = false,
  done?: (reply: Fields) => void,
  rearm = false,
): Promise<string | null> {
  try {
    const response = await request(url, {
      ...init,
      headers: { "content-type": "application/json" },
    });
    const reply = response.body;
    if (response.ok && isObject(reply)) done?.(reply);
    // The shared lists first, then the person's own document when it changed with them (a list
    // shared, or taken back): a window built again from it then finds the list it opens on.
    await loadShared();
    if (own) await refreshReminders();
    if (rearm && response.ok) await armMissingAlerts();
    if (response.ok) return null;
    return isObject(reply) && isString(reply.error) ? reply.error : "The desktop refused it.";
  } catch {
    return "The desktop could not be reached. Try again.";
  }
}

/**
 * Share the person's own list `list` with the account named `name`; `shared` is given the id
 * the shared list has.
 */
export const shareList = (list: string, name: string, shared?: (id: string) => void) =>
  act(SHARED, { method: "POST", body: JSON.stringify({ list, people: [name] }) }, true, (reply) => {
    if (isString(reply.id)) shared?.(reply.id);
  });
/** How long an action on a shared list waits for the page's change to it to be stored. */
const SETTLE_MS = 5000;
const SETTLE_CHECK = 100;

/**
 * Act on shared list `id` once the page's change to it is stored: every action gives the list a
 * new revision, which a save under way would then be refused on, and taking a list back must
 * take the change with it.
 */
async function settled(id: string, run: () => Promise<string | null>): Promise<string | null> {
  const until = Date.now() + SETTLE_MS;
  while (inflight.has(id) || waiting.has(id) || unsaved.has(id)) {
    if (Date.now() >= until) return "Your changes to this list could not be saved. Try again.";
    await new Promise((resolve) => setTimeout(resolve, SETTLE_CHECK));
  }
  return run();
}

/** The owner adds the account named `name` to shared list `id`. */
export const addPerson = (id: string, name: string) =>
  settled(id, () =>
    act(`${SHARED}/${id}/people`, { method: "POST", body: JSON.stringify({ name }) }),
  );
/** The owner takes the account named `name` off shared list `id`. */
export const removePerson = (id: string, name: string) =>
  settled(id, () =>
    act(`${SHARED}/${id}/people/${encodeURIComponent(name)}`, { method: "DELETE" }),
  );
/** The person leaves shared list `id` (its owner, with nobody else on it, takes it back). */
export const leaveList = (id: string) =>
  settled(id, () =>
    act(`${SHARED}/${id}/leave`, { method: "POST", body: "{}" }, true, undefined, true),
  );
/** The owner stops sharing list `id`: it goes back to the owner's own lists, alerting again. */
export const stopSharing = (id: string) =>
  settled(id, () =>
    act(`${SHARED}/${id}/stop`, { method: "POST", body: "{}" }, true, undefined, true),
  );

/** How many windows follow the shared lists. */
let windows = 0;
const onServerChange = (event: Event) => {
  if ((event as CustomEvent<{ app?: string }>).detail?.app === "reminders") requestShared();
};

/**
 * The page's shared lists, while `enabled`: read when a window opens and when the person's
 * Reminders changed (`SERVER_CHANGE_EVENT`), one read at a time for the whole page.
 */
export function useSharedLists(enabled: boolean): SharedState {
  const shown = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => EMPTY,
  );
  useEffect(() => {
    if (!enabled) return;
    // One listener for the page, however many windows are open.
    windows += 1;
    if (windows === 1) window.addEventListener(SERVER_CHANGE_EVENT, onServerChange);
    requestShared();
    return () => {
      windows -= 1;
      if (windows === 0) window.removeEventListener(SERVER_CHANGE_EVENT, onServerChange);
    };
  }, [enabled]);
  return enabled ? shown : EMPTY;
}

/**
 * For the window `origin`: a number that changes each time the page's copy of the shared lists
 * changes but not by the window itself (a read, or another window's change). The window then
 * takes the lists' reminders in.
 */
export function useSharedAdoptionKey(shared: SharedState, origin: object): number {
  // The number of the last copy this window did not make; its own changes keep the key.
  const last = useRef(shared.seq);
  if (shared.origin !== origin) last.current = shared.seq;
  return last.current;
}

/** For tests: forget the page's shared lists. */
export function resetShared(): void {
  stored.clear();
  inflight.clear();
  waiting.clear();
  unsaved.clear();
  reread = false;
  rereadForce = false;
  writes = 0;
  queued = "none";
  reads += 1;
  publish(EMPTY);
}
