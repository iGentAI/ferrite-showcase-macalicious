import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import { sameDocument } from "../desktop/document-merge";
import { createSyncedDocument, recordTag } from "../desktop/synced-document";
import {
  isSmartList,
  LIST_COLORS,
  REPEATS,
  type Reminder,
  type ReminderColor,
  type ReminderGroup,
  type ReminderList,
} from "./reminders-data";
import { instantIn, isZoneName, localZone, withoutZone } from "./reminders-dates";
import { settleGroups, settleParents } from "./reminders-tree";

/*
 * Reminders' link to its server half, `/api/reminders/` of the macalicious-desktop Ferrite
 * application (ferrite-apps/desktop/src/apps/reminders). Only the desktop build made for that
 * application sets `VITE_MACALICIOUS_API` to "1". Anywhere else (the documentation, the tests,
 * a copy of the demo) nothing is fetched, the reminders last as long as the window, as before,
 * and no alert is shown. The document is kept through the shared synced document of
 * demos/desktop/synced-document.ts: the server owns the revision, a save names the revision it
 * is based on, and a conflict is merged rather than overwritten.
 */

/** What the server keeps for a browser session. */
export interface SavedReminders {
  lists: ReminderList[];
  /** The sidebar's groups of lists. Left out when there are none, as the server leaves it out. */
  groups?: ReminderGroup[];
  reminders: Reminder[];
}

/** An alert that has fired: a reminder that fell due and was not dismissed. */
export interface ReminderAlert {
  id: string;
  title: string;
  /** The instant it fell due, in epoch milliseconds. */
  at: number;
}

const ALERTS = "/api/reminders/alerts";
/** How long a failed dismissal waits before it is tried again, and how many times. */
const RETRY_DELAY = 2000;
const RETRIES = 5;
/** The longest `Retry-After` a dismissal waits out; one asking for longer is not retried. */
const MAX_RETRY_DELAY = 30_000;
/** How often an open window asks which reminders have fallen due. */
const ALERT_POLL = 5000;
/** The hour of the due day at which a reminder with no due minute alerts, local time. */
export const ALERT_HOUR = 9;

/**
 * The instant a reminder due on `day` (`YYYY-MM-DD`) alerts: the minute `time` (`HH:MM`) that
 * day, or 9:00 without one, on the clocks of `zone` (the browser's own when absent).
 */
export function alertTime(day: string, time = `0${ALERT_HOUR}:00`, zone?: string): number {
  return instantIn(day, time, zone);
}

/**
 * The instant a reminder's alert fires, or `undefined` for one that is not due or is completed:
 * in the zone it was set in, so every browser of the person names the same instant.
 */
export function alertOf(reminder: Reminder): number | undefined {
  if (!reminder.due || reminder.completed) return undefined;
  const at = alertTime(reminder.due, reminder.dueTime, reminder.timeZone);
  return reminder.dueTime ? at - (reminder.earlyMinutes ?? 0) * 60_000 : at;
}

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown) => typeof value === "boolean";
/** An optional field: absent, or of its type. */
const optional = (value: unknown, test: (value: unknown) => boolean) =>
  value === undefined || test(value);
/** Whether `record` holds no field but `known`, as the server's documents do. */
const only = (record: Fields, known: readonly string[]) =>
  Object.keys(record).every((key) => known.includes(key));

const LIST_FIELDS = ["id", "name", "color", "groupId"];
const GROUP_FIELDS = ["id", "name", "before"];
const REMINDER_FIELDS = [
  "id",
  "listId",
  "title",
  "parentId",
  "completed",
  "flagged",
  "due",
  "dueTime",
  "timeZone",
  "repeat",
  "repeatRule",
  "repeatEnd",
  "earlyMinutes",
  "notes",
  "priority",
  "url",
  "atLocation",
  "whenMessaging",
  "images",
  "createdAt",
];
const PRIORITIES: readonly unknown[] = ["none", "low", "medium", "high"];
const REPEAT_IDS: readonly unknown[] = REPEATS.map((repeat) => repeat.id).filter(
  (id) => id !== "never",
);

/** Whether `day` is a calendar day written `YYYY-MM-DD`. */
function isDay(day: unknown): boolean {
  if (!isString(day) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [year = 0, month = 0, date = 0] = day.split("-").map(Number);
  const check = new Date(Date.UTC(2000, month - 1, date));
  check.setUTCFullYear(year);
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === date;
}

/** Whether `time` is a minute written `HH:MM`, 00:00 to 23:59. */
const isTime = (time: unknown) => isString(time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

/** Whether `rule` is a custom repeat as the server keeps it. */
function isRepeatRule(rule: unknown): boolean {
  if (!isObject(rule) || !only(rule, ["every", "unit", "weekdays"])) return false;
  const { every, unit, weekdays } = rule;
  if (!Number.isInteger(every) || (every as number) < 1 || (every as number) > 999) return false;
  if (!["day", "week", "month", "year"].includes(unit as string)) return false;
  if (weekdays === undefined) return true;
  return (
    unit === "week" &&
    Array.isArray(weekdays) &&
    weekdays.length > 0 &&
    new Set(weekdays).size === weekdays.length &&
    weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
}

/**
 * Whether `reminder` has the shape the server keeps: its fields, their types and how they hang
 * together. Which list it is in, and whether its id is used twice, are its document's to check.
 */
export function isReminderShape(reminder: unknown): reminder is Reminder {
  if (!isObject(reminder) || !only(reminder, REMINDER_FIELDS)) return false;
  const { id, listId, title, images, createdAt } = reminder;
  if (!isString(id) || !isString(title) || !isString(listId)) return false;
  if (createdAt !== undefined && !(Number.isSafeInteger(createdAt) && (createdAt as number) >= 0)) {
    return false;
  }
  if (
    !["completed", "flagged", "atLocation", "whenMessaging"].every((key) =>
      optional(reminder[key], isBoolean),
    )
  ) {
    return false;
  }
  if (!optional(reminder.notes, isString) || !optional(reminder.url, isString)) return false;
  if (!optional(reminder.parentId, isString)) return false;
  if (!optional(reminder.due, isDay)) return false;
  // A zone only with a due day, written as the server keeps it.
  if (!optional(reminder.timeZone, isZoneName)) return false;
  if (reminder.due === undefined && reminder.timeZone !== undefined) return false;
  // A due minute and a repeat only with a due day, and an end only with a repeat.
  if (!optional(reminder.dueTime, isTime) || !optional(reminder.repeatEnd, isDay)) return false;
  if (!optional(reminder.repeat, (value) => REPEAT_IDS.includes(value))) return false;
  if (!optional(reminder.repeatRule, isRepeatRule)) return false;
  if ((reminder.repeat === "custom") !== (reminder.repeatRule !== undefined)) return false;
  if (reminder.due === undefined && (reminder.dueTime ?? reminder.repeat) !== undefined) {
    return false;
  }
  if (reminder.repeat === undefined && reminder.repeatEnd !== undefined) return false;
  if (!optional(reminder.priority, (value) => PRIORITIES.includes(value))) return false;
  if (
    !optional(
      reminder.earlyMinutes,
      (value) => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 10_080,
    )
  ) {
    return false;
  }
  if (!optional(images, (value) => Number.isSafeInteger(value) && (value as number) >= 0)) {
    return false;
  }
  return true;
}

/**
 * Whether `data` is a document the server keeps: every list and reminder of the right shape,
 * ids used once, no list named as a smart list and every reminder in a list that exists.
 */
function isSavedReminders(data: unknown): data is SavedReminders {
  if (!isObject(data) || !only(data, ["lists", "groups", "reminders"])) return false;
  const { lists, groups = [], reminders } = data;
  if (!Array.isArray(lists) || !Array.isArray(groups) || !Array.isArray(reminders)) return false;
  const groupIds = new Set<string>();
  for (const group of groups) {
    if (!isObject(group) || !only(group, GROUP_FIELDS)) return false;
    const { id, name, before } = group;
    if (!isString(id) || groupIds.has(id) || isSmartList(id) || !isString(name)) return false;
    if (!optional(before, isString)) return false;
    groupIds.add(id);
  }
  const listIds = new Set<string>();
  for (const list of lists) {
    if (!isObject(list) || !only(list, LIST_FIELDS)) return false;
    const { id, name, color, groupId } = list;
    if (!isString(id) || listIds.has(id) || isSmartList(id) || !isString(name)) return false;
    if (!LIST_COLORS.includes(color as ReminderColor)) return false;
    if (groupId !== undefined && !groupIds.has(groupId as string)) return false;
    listIds.add(id);
  }
  const reminderIds = new Set<string>();
  for (const reminder of reminders) {
    if (!isReminderShape(reminder) || reminderIds.has(reminder.id)) return false;
    if (!listIds.has(reminder.listId)) return false;
    reminderIds.add(reminder.id);
  }
  return true;
}

/** Each reminder that is due and still to do, with the instant its alert fires. */
function alertsOf(data: SavedReminders): Record<string, number> {
  const alerts: Record<string, number> = {};
  for (const reminder of data.reminders) {
    const at = alertOf(reminder);
    if (at !== undefined) alerts[reminder.id] = at;
  }
  return alerts;
}

const remindersDocument = createSyncedDocument<SavedReminders>({
  url: "/api/reminders/data",
  isDocument: isSavedReminders,
  // The server arms one timer per alert, and checks that every due reminder has one.
  extra: (data) => ({ alerts: alertsOf(data) }),
});

/** Whether this build talks to the Ferrite application's API. */
export const syncEnabled = remindersDocument.enabled;

/** Read the session's reminders once per page: `null` when none are saved or unreadable. */
export const loadReminders = remindersDocument.load;

/**
 * The saved reminders, for a component: `undefined` while they are read, `null` when nothing
 * is saved or they could not be read, and always `null` in a build that does not talk to the
 * API.
 */
export const useSavedReminders = remindersDocument.useDocument;

/**
 * Whether the newest change is not saved: the server refused the reminders as they are, or could
 * not be reached to read them again after a save went unanswered.
 */
export const useUnsaved = remindersDocument.useUnsaved;

/** Whether the session's reminders were read: alerts are acted on only then. */
export const remindersReadable = remindersDocument.readable;

/**
 * The page's copy of the session's reminders, for a component, and the window whose change it
 * is (`origin`; `null` when it was read from the server): `undefined` while they are read.
 * Every Reminders window shows it.
 */
export const useShownReminders = remindersDocument.useShown;

/** For a Reminders window: a key that changes with each document the window adopts. */
export const useRemindersAdoptionKey = remindersDocument.useAdoptionKey;

/** Read the stored reminders again, when no change of this page waits: for an unknown alert. */
export const refreshReminders = remindersDocument.refresh;

/** Whether the page's copy is not the stored document: read now, outside React. */
export const remindersUnsaved = remindersDocument.unsaved;

/**
 * Whether `data`, as a window last sent it, is what the page holds and has stored: read now,
 * outside React. After a save refused for a newer revision, the page holds the stored document
 * instead, so this is false even in the moment the page counts nothing unsaved.
 */
export function storedAs(data: SavedReminders): boolean {
  const held = remindersDocument.current();
  return held !== null && !remindersDocument.unsaved() && sameDocument(held, sendable(data));
}

/** How long sharing a list waits for the page's own changes to be stored, and how often it looks. */
const SETTLE_MS = 5000;
const SETTLE_CHECK = 100;

/**
 * Resolves `true` once the page's changes to the session's reminders are stored, and `false`
 * when they are not within a few seconds (a save refused, or the server out of reach). Sharing a
 * list moves the list the server holds, so it waits for this first.
 */
export async function settleReminders(): Promise<boolean> {
  const until = Date.now() + SETTLE_MS;
  while (remindersDocument.unsaved()) {
    if (Date.now() >= until) return false;
    await new Promise((resolve) => setTimeout(resolve, SETTLE_CHECK));
  }
  return true;
}

/** What goes in a new reminder's or list's id so that two windows never make the same one. */
export const recordIdTag = recordTag;

/**
 * A reminder as it is sent: one with a due day names the zone it was set in, or else the
 * browser's (an older document, or a writer that names none, is put in this browser's zone once);
 * one without a due day names none.
 */
function zoned(reminder: Reminder, zone: string | undefined): Reminder {
  if (reminder.due === undefined) {
    return reminder.timeZone === undefined ? reminder : withoutZone(reminder);
  }
  return reminder.timeZone !== undefined || !isZoneName(zone)
    ? reminder
    : { ...reminder, timeZone: zone };
}

/**
 * The document as it is sent: a reminder still being typed, with no title yet, is left out, a
 * sub-reminder whose parent did not hold is a reminder of its own, every reminder with a due day
 * names its zone, and an empty set of groups is not named, as the server does not name it.
 */
const sendable = (data: SavedReminders): SavedReminders => {
  const zone = localZone();
  const groups = data.groups ?? [];
  return {
    lists: [...settleGroups(data.lists, groups)],
    ...(groups.length > 0 ? { groups } : {}),
    reminders: settleParents(data.reminders.filter((reminder) => reminder.title.trim() !== "")).map(
      (reminder) => zoned(reminder, zone),
    ),
  };
};

/**
 * Save the session's lists and reminders as the window `origin` shows them. A reminder still
 * being typed, which has no title yet, is left out. Nothing is written before the session's
 * reminders were read, or at all when they could not be.
 */
export function saveReminders(data: SavedReminders, origin: object) {
  remindersDocument.save(sendable(data), origin);
}

/** One alert as `PUT /api/reminders/alerts` asks to arm it: its instant and what it came from. */
export interface AlertToArm {
  at: number;
  due: string;
  dueTime?: string;
  timeZone?: string;
}

/**
 * The alert of each reminder of `data` that is due and still to do, with the day, minute and
 * zone it was worked out from: the server arms one only while its reminder still says them.
 */
export function alertsToArm(data: SavedReminders): Record<string, AlertToArm> {
  const out: Record<string, AlertToArm> = {};
  for (const reminder of data.reminders) {
    const at = alertOf(reminder);
    if (at === undefined || reminder.due === undefined) continue;
    out[reminder.id] = {
      at,
      due: reminder.due,
      ...(reminder.dueTime !== undefined ? { dueTime: reminder.dueTime } : {}),
      ...(reminder.timeZone !== undefined ? { timeZone: reminder.timeZone } : {}),
    };
  }
  return out;
}

/**
 * Arm the alerts the stored reminders lack: after a list comes back from being shared (Stop
 * Sharing, or its owner leaving it with nobody else on it), which the server takes back without
 * alerts, since only a browser knows the instants. The server never moves an alert it has. Nothing
 * is asked when the page holds no due reminder; a failure leaves them to the next save.
 */
export async function armMissingAlerts(): Promise<void> {
  const data = remindersDocument.current();
  if (!data) return;
  const alerts = alertsToArm(data);
  if (Object.keys(alerts).length === 0) return;
  await withDeadline((signal) =>
    sessionFetch(ALERTS, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alerts }),
      signal,
    }),
  ).catch(() => undefined);
}

/** The alerts this page dismissed, as `id@at`. */
const dismissed = new Set<string>();
const keyOf = (alert: ReminderAlert) => `${alert.id}@${alert.at}`;

/** The alerts this page told the module it shows itself. */
const toldShown = new Set<string>();
/**
 * Tells the module a window shows these alerts itself, so that Notification Center does not too,
 * once per alert. What fails to reach it is at most one notification more.
 */
export function tellAlertsShown(alerts: readonly ReminderAlert[]): void {
  const fresh = alerts.filter((alert) => !toldShown.has(keyOf(alert))).slice(0, 20);
  if (fresh.length === 0) return;
  for (const alert of fresh) toldShown.add(keyOf(alert));
  void sessionFetch(`${ALERTS}/shown`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ alerts: fresh.map(({ id, at }) => ({ id, at })) }),
  }).catch(() => undefined);
}

/**
 * After a dismissal's reply (`status` undefined when none came in time): `"heard"` when asking
 * again would change nothing (answered, or refused for good with a 4xx), `"give-up"` when the
 * server asks to wait longer than the page will, otherwise how long to wait before asking again.
 * A server failure (5xx), a timeout (408) and a rate limit (429) are temporary; the last two are
 * never asked again before their `Retry-After` has passed.
 */
export function dismissalRetryDelay(
  status: number | undefined,
  retryAfter: string | null = null,
  now: number = Date.now(),
): "heard" | "give-up" | number {
  if (status !== undefined && status < 500 && status !== 408 && status !== 429) return "heard";
  if (status !== 408 && status !== 429) return RETRY_DELAY;
  const value = retryAfter?.trim() ?? "";
  const asked = /^\d+$/.test(value)
    ? Number(value) * 1000
    : Number.isNaN(Date.parse(value))
      ? RETRY_DELAY
      : Date.parse(value) - now;
  if (asked > MAX_RETRY_DELAY) return "give-up";
  return Math.max(RETRY_DELAY, asked);
}

/** Tell the server an alert was dismissed, trying again while it cannot be reached: whether it heard. */
async function sendDismissal(alert: ReminderAlert): Promise<boolean> {
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const response = await withDeadline((signal) =>
      sessionFetch(`${ALERTS}/${encodeURIComponent(alert.id)}/dismiss`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: alert.at }),
        keepalive: true,
        signal,
      }),
    ).catch(() => undefined);
    const delay = dismissalRetryDelay(response?.status, response?.headers.get("retry-after"));
    if (delay === "heard") return true;
    // Not heard, and not to be asked again in time: the alert shows again, to be closed again.
    if (delay === "give-up") return false;
    if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
}

/**
 * The page's alerts: one list for every Reminders window, asked for every few seconds while at
 * least one window wants them, so that an alert dismissed in one window leaves them all.
 */
let pageAlerts: readonly ReminderAlert[] = [];
const alertListeners = new Set<() => void>();
const setPageAlerts = (next: readonly ReminderAlert[]) => {
  pageAlerts = next;
  for (const listener of alertListeners) listener();
};
/** How many windows want the alerts, and the poll now running (a new number when one starts). */
let pollers = 0;
let pollRun = 0;
let pollTimer: ReturnType<typeof setTimeout> | undefined;

async function poll(run: number) {
  try {
    // A poll that hangs fails at its deadline, so the next one is still scheduled.
    const body = await withDeadline(async (signal) => {
      const response = await sessionFetch(ALERTS, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
      });
      return response.ok ? ((await response.json()) as { alerts?: ReminderAlert[] }) : null;
    });
    if (body) {
      // An answer sent before a dismissal reached the server still lists it.
      const shown = (body.alerts ?? []).filter((alert) => !dismissed.has(keyOf(alert)));
      if (run === pollRun) setPageAlerts(shown);
    }
  } catch {
    // Asked again at the next turn.
  }
  if (run === pollRun) pollTimer = setTimeout(() => void poll(run), ALERT_POLL);
}

function startPolling() {
  pollers += 1;
  if (pollers > 1) return;
  pollRun += 1;
  void poll(pollRun);
}

function stopPolling() {
  pollers -= 1;
  if (pollers > 0) return;
  pollRun += 1;
  clearTimeout(pollTimer);
  setPageAlerts([]);
}

const NO_ALERTS: readonly ReminderAlert[] = [];

/**
 * The alerts that have fired, asked for every few seconds while `enabled`, and a way to
 * dismiss one. The server decides that a reminder has fallen due, by the platform's clock.
 * Every window gets the page's one list.
 */
export function useReminderAlerts(enabled: boolean) {
  const alerts = useSyncExternalStore(
    (listener) => {
      alertListeners.add(listener);
      return () => alertListeners.delete(listener);
    },
    () => pageAlerts,
    () => NO_ALERTS,
  );
  useEffect(() => {
    if (!enabled) return;
    startPolling();
    return stopPolling;
  }, [enabled]);
  const dismiss = useCallback((alert: ReminderAlert) => {
    dismissed.add(keyOf(alert));
    setPageAlerts(pageAlerts.filter((other) => other.id !== alert.id));
    // A dismissal the server never heard is not hidden for good: the next poll shows the alert
    // again, so that it can be closed once more.
    void sendDismissal(alert).then((heard) => {
      if (!heard) dismissed.delete(keyOf(alert));
    });
  }, []);
  return { alerts: enabled ? alerts : NO_ALERTS, dismiss };
}

/** The Reminders windows open on the page, oldest first: the first shows the alerts. */
const hosts: object[] = [];
const hostListeners = new Set<() => void>();
const hostsChanged = () => {
  for (const listener of hostListeners) listener();
};

/**
 * Whether this window is the one that shows the page's alerts: alerts sit under the menu bar,
 * outside every window, so only one window draws them.
 */
export function useAlertHost(): boolean {
  const [token] = useState(() => ({}));
  useEffect(() => {
    hosts.push(token);
    hostsChanged();
    return () => {
      hosts.splice(hosts.indexOf(token), 1);
      hostsChanged();
    };
  }, [token]);
  return useSyncExternalStore(
    (listener) => {
      hostListeners.add(listener);
      return () => hostListeners.delete(listener);
    },
    () => hosts[0] === token,
    () => false,
  );
}
