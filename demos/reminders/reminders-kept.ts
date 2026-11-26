import { fitsDesktopValue } from "../desktop/desktop-kept-value";
import type { Reminder, ReminderSort } from "./reminders-data";
import { alertOf, type ReminderAlert } from "./reminders-sync";

/** What Reminders keeps for a person with their desktop settings. */
export const REMINDERS_VIEW = "reminders.view";

export interface RemindersKeptView {
  /** The list or smart list shown. */
  source: string;
  sort: ReminderSort;
  showCompleted: boolean;
  /** View > Hide Sidebar. */
  sidebarHidden?: boolean;
  /** The reminders and groups whose rows under them are hidden. */
  collapsed?: readonly string[];
}

const SORTS: readonly unknown[] = ["manual", "due", "created", "priority", "title"];

/** The view as stored, or `undefined` for anything the window did not write. */
export function readRemindersView(stored: unknown): RemindersKeptView | undefined {
  const view = stored as Partial<RemindersKeptView> | null;
  if (typeof view !== "object" || view === null) return undefined;
  return typeof view.source === "string" &&
    SORTS.includes(view.sort) &&
    typeof view.showCompleted === "boolean"
    ? {
        source: view.source,
        sort: view.sort as ReminderSort,
        showCompleted: view.showCompleted,
        ...(view.sidebarHidden === true ? { sidebarHidden: true } : {}),
        ...(Array.isArray(view.collapsed)
          ? { collapsed: view.collapsed.filter((id) => typeof id === "string") }
          : {}),
      }
    : undefined;
}

/** Reminders > Preferences > Today Notification, kept with the person's settings. */
export const REMINDERS_TODAY_NOTIFICATION = "reminders.todayNotification";

export interface TodayNotification {
  on: boolean;
  /** The minute it comes, as `HH:MM`. */
  time: string;
  /** The day it was last closed, as `YYYY-MM-DD`: it comes once a day. */
  closedOn?: string;
}

export const TODAY_NOTIFICATION_OFF: TodayNotification = { on: false, time: "09:00" };

export function readTodayNotification(stored: unknown): TodayNotification | undefined {
  const value = stored as Partial<TodayNotification> | null;
  if (typeof value !== "object" || value === null) return undefined;
  if (typeof value.on !== "boolean" || !/^\d\d:\d\d$/.test(String(value.time))) return undefined;
  return {
    on: value.on,
    time: value.time as string,
    ...(typeof value.closedOn === "string" ? { closedOn: value.closedOn } : {}),
  };
}

/** The id of the Today notification among the window's alerts. */
export const TODAY_ALERT = "today-notification";

/** The Today notification due at the minute `now` (`HH:MM`) on `today`, for the reminders due that day. */
export function todayAlert(
  setting: TodayNotification,
  dueToday: readonly Reminder[],
  today: string,
  now: string,
  at: number,
): ReminderAlert | undefined {
  if (!setting.on || setting.closedOn === today || now < setting.time) return undefined;
  const [first] = dueToday;
  if (!first) return undefined;
  const title = dueToday.length === 1 ? first.title : `${dueToday.length} reminders are due today`;
  return { id: TODAY_ALERT, title, at };
}

/** How long after it fell due a reminder of a shared list still comes up as an alert. */
const SHARED_ALERT_MS = 86_400_000;

/** What the person closed of the shared lists' alerts: the instant of each, by the reminder's key. */
export const REMINDERS_SHARED_ALERTS = "reminders.sharedAlerts";

export function readClosedAlerts(stored: unknown): Readonly<Record<string, number>> | undefined {
  return typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? (stored as Record<string, number>)
    : undefined;
}

/** What is closed with this alert too: the latest that fit in one desktop value. */
export function closedAlert(
  closed: Readonly<Record<string, number>>,
  id: string,
  at: number,
): Readonly<Record<string, number>> {
  let entries = [...Object.entries(closed).filter(([key]) => key !== id), [id, at] as const];
  while (entries.length > 1 && !fitsDesktopValue(Object.fromEntries(entries))) {
    entries = entries.slice(1);
  }
  return Object.fromEntries(entries);
}

/**
 * The alerts of a window's shared-list reminders at the instant `now`: the server arms alerts for
 * the person's own reminders only, so the window watches these itself while it is open. One closed
 * stays closed, for that instant.
 */
export function sharedAlerts(
  reminders: readonly Reminder[],
  closed: Readonly<Record<string, number>>,
  now: number,
): ReminderAlert[] {
  return reminders.flatMap((reminder) => {
    const at = alertOf(reminder);
    if (at === undefined || at > now || now - at > SHARED_ALERT_MS || closed[reminder.id] === at) {
      return [];
    }
    return [{ id: reminder.id, title: reminder.title, at }];
  });
}

/** A view's reminders as File > Print hands them to the browser. */
export function remindersPrintLines(name: string, rows: readonly Reminder[]): readonly string[] {
  if (rows.length === 0) return [name, "", "No Reminders"];
  return [
    name,
    "",
    ...rows.flatMap((reminder) => [
      `${reminder.parentId ? "  " : ""}${reminder.completed ? "[x]" : "[ ]"} ${reminder.title}`,
      ...(reminder.due
        ? [`    ${reminder.due}${reminder.dueTime ? ` ${reminder.dueTime}` : ""}`]
        : []),
      ...(reminder.notes ? reminder.notes.split("\n").map((line) => `    ${line}`) : []),
    ]),
  ];
}
