import { useEffect, useState } from "react";
import { BIRTHDAYS, type CalendarEntry, INVITATIONS } from "./calendar-data";
import { occurrenceId, occurrences } from "./calendar-recurrence";

/*
 * Event alerts, raised while Calendar is open; with no window open the server raises what it can
 * (`alerts.rs` in the module) and the desktop shell the rest (`calendar-alert-watch.ts`). An event's `alert` is minutes before each
 * occurrence's start (negative: after it). An occurrence starts at the instant its own zone makes
 * (`calendar-recurrence.ts`), so its alert is at the same moment in every browser, wherever it is.
 * An alert shows from that moment until its occurrence ends or it is closed; closing it records the
 * occurrence's start in the event's `alertDismissed`, saved with the event, so it stays closed
 * after a reload and in the person's other windows and browsers. An alert whose moment passed while
 * Calendar was closed shows when it opens, while its occurrence lasts. Snooze puts one occurrence's
 * alert off (`alertSnooze`, saved the same way): it stays away until then and then shows until it
 * is closed, even when its occurrence has ended by then.
 */

const MINUTE = 60_000;
const HOUR = 3_600_000;
/** How far ahead the next alert is looked for; the window looks again after that long. */
const LOOKAHEAD = 86_400_000;

/** One choice of the popover's alert menu: minutes before the start, or `null` for none. */
export interface AlertChoice {
  minutes: number | null;
  name: string;
}

/** A timed event's alert menu, as Calendar offers it. */
export const TIMED_ALERTS: readonly AlertChoice[] = [
  { minutes: null, name: "None" },
  { minutes: 0, name: "At time of event" },
  { minutes: 5, name: "5 minutes before" },
  { minutes: 10, name: "10 minutes before" },
  { minutes: 15, name: "15 minutes before" },
  { minutes: 30, name: "30 minutes before" },
  { minutes: 60, name: "1 hour before" },
  { minutes: 120, name: "2 hours before" },
  { minutes: 1440, name: "1 day before" },
  { minutes: 2880, name: "2 days before" },
];

/** An all-day event's alert menu: at 9 AM, on its day or before (its day starts at midnight). */
export const ALL_DAY_ALERTS: readonly AlertChoice[] = [
  { minutes: null, name: "None" },
  { minutes: -540, name: "On day of event (9 AM)" },
  { minutes: 900, name: "1 day before (9 AM)" },
  { minutes: 2340, name: "2 days before (9 AM)" },
  { minutes: 9540, name: "1 week before (9 AM)" },
];

/** The alert menu of an event. */
export const alertChoices = (entry: Pick<CalendarEntry, "allDay">) =>
  entry.allDay ? ALL_DAY_ALERTS : TIMED_ALERTS;

/** What Snooze on an alert offers: minutes from now. */
export const SNOOZE_CHOICES: readonly { minutes: number; name: string }[] = [
  { minutes: 5, name: "5 minutes" },
  { minutes: 10, name: "10 minutes" },
  { minutes: 15, name: "15 minutes" },
  { minutes: 30, name: "30 minutes" },
  { minutes: 60, name: "1 hour" },
  { minutes: 1440, name: "1 day" },
];

/** An alert's name: its choice's, or how long before or after the start for any other value. */
export function describeAlert(minutes: number, allDay?: boolean): string {
  const choice = (allDay ? ALL_DAY_ALERTS : TIMED_ALERTS).find((each) => each.minutes === minutes);
  if (choice) return choice.name;
  const span = Math.abs(minutes);
  const amount =
    span % 1440 === 0
      ? `${span / 1440} ${span === 1440 ? "day" : "days"}`
      : span % 60 === 0
        ? `${span / 60} ${span === 60 ? "hour" : "hours"}`
        : `${span} ${span === 1 ? "minute" : "minutes"}`;
  return `${amount} ${minutes < 0 ? "after" : "before"}`;
}

/** An alert that shows: one occurrence of an event whose alert's moment has come. */
export interface DueAlert {
  /** The occurrence: the event's id and its start. */
  key: string;
  /** The event's own id (a repeating event's, for any of its occurrences). */
  id: string;
  /** The calendar of the event. */
  calendar: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  /** The moment the alert showed from (epoch ms). */
  at: number;
}

/** An occurrence counts as lasting a minute at least, so an alert of an instant shows. */
const lastsUntil = (start: number, end: number) => Math.max(end, start + MINUTE);

/**
 * The moment the alert of an occurrence starting at `start` comes. A timed event's is so many
 * minutes before the instant; an all-day event's counts on the wall clock from the midnight its
 * day starts at, so "On day of event (9 AM)" and "1 day before (9 AM)" are at 9:00 whatever the
 * clocks do in between.
 */
function alertMoment(entry: CalendarEntry, alert: number, start: Date): number {
  if (!entry.allDay) return start.getTime() - alert * MINUTE;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, -alert).getTime();
}

/** Whether `entry` has an occurrence starting at `start`, by its repeat and what was removed. */
const keepsOccurrence = (entry: CalendarEntry, start: number) =>
  occurrences(entry, new Date(start), new Date(start + 1)).some(
    (each) => each.start.getTime() === start,
  );

/**
 * `entry` without the snooze of an occurrence it no longer has: `dueAlerts` shows an expired snooze
 * whatever the repeat makes of its occurrence.
 */
export function withoutRemovedSnooze(entry: CalendarEntry): CalendarEntry {
  const { alertSnooze, ...rest } = entry;
  return alertSnooze && !keepsOccurrence(entry, alertSnooze.start) ? rest : entry;
}

/**
 * `entry` as Undo or Redo brings it back, `current` being that event as it stands. An event that was
 * deleted returns with the alert state it had. One that exists keeps what was closed and snoozed
 * since, which is no change Undo takes back; only a snooze follows its occurrence in and out.
 */
export function restoredAlerts(
  entry: CalendarEntry,
  current: CalendarEntry | undefined,
): CalendarEntry {
  if (!current) return entry;
  const { alertDismissed: _closed, alertSnooze: historical, ...rest } = entry;
  const returning =
    historical && !keepsOccurrence(current, historical.start) ? historical : undefined;
  const snooze = current.alertSnooze ?? returning;
  return {
    ...rest,
    ...(current.alertDismissed === undefined ? {} : { alertDismissed: current.alertDismissed }),
    ...(snooze && keepsOccurrence(entry, snooze.start) ? { alertSnooze: snooze } : {}),
  };
}

/**
 * The alerts that show at `now`: of each occurrence whose alert's moment has come, that has not
 * ended and whose alert was not closed, in the order their moments came.
 */
export function dueAlerts(events: readonly CalendarEntry[], now: number): DueAlert[] {
  const out: DueAlert[] = [];
  for (const entry of events) {
    const alert = entry.alert;
    if (alert === undefined || entry.series) continue;
    const snoozed = entry.alertSnooze;
    if (snoozed && snoozed.until <= now) {
      out.push({
        key: occurrenceId(entry.id, snoozed.start),
        id: entry.id,
        calendar: entry.calendar,
        title: entry.title,
        start: new Date(snoozed.start),
        end: new Date(snoozed.start + (entry.end.getTime() - entry.start.getTime())),
        allDay: entry.allDay === true,
        location: entry.location,
        at: snoozed.until,
      });
    }
    // The occurrences that may be alerting: an hour more on either side for a change of the
    // clocks between an all-day alert and its day.
    const lead = alert * MINUTE;
    const window = occurrences(
      entry,
      new Date(now - MINUTE),
      new Date(now + Math.max(lead, 0) + HOUR + 1),
    );
    for (const occurrence of window) {
      const start = occurrence.start.getTime();
      const moment = alertMoment(entry, alert, occurrence.start);
      if (start === snoozed?.start) continue;
      if (moment > now || lastsUntil(start, occurrence.end.getTime()) <= now) continue;
      if (entry.alertDismissed !== undefined && start <= entry.alertDismissed) continue;
      out.push({
        key: occurrenceId(entry.id, start),
        id: entry.id,
        calendar: entry.calendar,
        title: entry.title,
        start: occurrence.start,
        end: occurrence.end,
        allDay: entry.allDay === true,
        location: entry.location,
        at: moment,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

/**
 * The next moment after `now` at which the alerts that show change: an alert's moment comes, or
 * an occurrence whose alert shows ends. `null` when nothing changes within a day.
 */
export function nextAlertChange(events: readonly CalendarEntry[], now: number): number | null {
  let next = Number.POSITIVE_INFINITY;
  for (const entry of events) {
    const alert = entry.alert;
    if (alert === undefined || entry.series) continue;
    const snoozed = entry.alertSnooze;
    if (snoozed && snoozed.until > now) next = Math.min(next, snoozed.until);
    const lead = alert * MINUTE;
    // An hour more on either side, for a change of the clocks between an all-day alert and its
    // day (`alertMoment`).
    for (const occurrence of occurrences(
      entry,
      new Date(now + lead - HOUR),
      new Date(now + lead + LOOKAHEAD + HOUR),
    )) {
      const start = occurrence.start.getTime();
      const moment = alertMoment(entry, alert, occurrence.start);
      if (moment <= now || start === snoozed?.start) continue;
      if (entry.alertDismissed !== undefined && start <= entry.alertDismissed) continue;
      next = Math.min(next, moment);
      break;
    }
  }
  for (const alert of dueAlerts(events, now)) {
    const ends = lastsUntil(alert.start.getTime(), alert.end.getTime());
    // A snoozed alert may outlast its occurrence: its end is no change to wait for.
    if (ends > now) next = Math.min(next, ends);
  }
  return next === Number.POSITIVE_INFINITY ? null : next;
}

/** The alert's occurrence as `POST /api/calendar/alerts/shown` and `/raise` name it. */
export interface ShownAlert {
  event: string;
  start: number;
  until?: number;
  /** What the document does not hold: a birthday's or an invitation's. */
  title?: string;
  location?: string;
  allDay?: boolean;
  /** When it is, as only the page can say it. */
  when?: string;
}

/**
 * What was closed or put off of each birthday's or invitation's alert, by its id: neither is an
 * event of the document. The window keeps these with the person's settings, a notification's
 * buttons in the module (`GET /alerts/others`); `mergedAlertStates` makes one of the two.
 */
export const BIRTHDAY_ALERTS = "calendar.birthdayAlerts";
export interface OtherAlertState {
  dismissed?: number;
  snooze?: { start: number; until: number };
}
export type BirthdayAlerts = Readonly<Record<string, OtherAlertState>>;
export const NO_BIRTHDAY_ALERTS: BirthdayAlerts = {};
export const readBirthdayAlerts = (stored: unknown): BirthdayAlerts | undefined =>
  typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? (stored as BirthdayAlerts)
    : undefined;

/** Both records as one: the later close, and the later snooze unless its occurrence was closed. */
export function mergedAlertStates(a: BirthdayAlerts, b: BirthdayAlerts): BirthdayAlerts {
  if (Object.keys(b).length === 0) return a;
  const merged: Record<string, OtherAlertState> = { ...a };
  for (const [id, other] of Object.entries(b)) {
    const one = a[id];
    const closes = [one?.dismissed, other.dismissed].filter((at) => at !== undefined);
    const dismissed = closes.length > 0 ? Math.max(...closes) : undefined;
    const snoozes = [one?.snooze, other.snooze].filter((each) => each !== undefined);
    const snooze = snoozes.sort((x, y) => y.until - x.until)[0];
    merged[id] = {
      ...(dismissed === undefined ? {} : { dismissed }),
      ...(snooze && snooze.start !== dismissed ? { snooze } : {}),
    };
  }
  return merged;
}

/** What alerts of the Preferences: the same for the window and the shell's watch. */
export interface AlertDefaults {
  defaultAlert?: number;
  defaultAllDayAlert?: number;
  defaultBirthdayAlert?: number;
}

/** The person's events and the birthdays and accepted invitations that alert with the defaults. */
export function alertingEntries(
  events: readonly CalendarEntry[],
  birthdays: readonly CalendarEntry[],
  invitations: readonly { status: string; event: CalendarEntry }[],
  { defaultAlert, defaultAllDayAlert, defaultBirthdayAlert }: AlertDefaults,
  states: BirthdayAlerts,
): readonly CalendarEntry[] {
  const kept = (entry: CalendarEntry, alert: number) => ({
    ...entry,
    alert,
    alertDismissed: states[entry.id]?.dismissed,
    alertSnooze: states[entry.id]?.snooze,
  });
  const fromBirthdays =
    defaultBirthdayAlert === undefined
      ? []
      : birthdays.map((entry) => kept(entry, defaultBirthdayAlert));
  const fromInvitations = invitations.flatMap((each) => {
    const alert = each.event.allDay ? defaultAllDayAlert : defaultAlert;
    return each.status === "accepted" && alert !== undefined ? [kept(each.event, alert)] : [];
  });
  return fromBirthdays.length || fromInvitations.length
    ? [...events, ...fromBirthdays, ...fromInvitations]
    : events;
}

const isOtherCalendar = (calendar: string) => calendar === BIRTHDAYS || calendar === INVITATIONS;

const shownOf = (alert: DueAlert, entry: CalendarEntry): ShownAlert => {
  const start = alert.start.getTime();
  return {
    event: alert.id,
    start,
    ...(entry.alertSnooze?.start === start ? { until: entry.alertSnooze.until } : {}),
    ...(isOtherCalendar(alert.calendar)
      ? {
          title: alert.title,
          ...(alert.location ? { location: alert.location } : {}),
          ...(alert.allDay ? { allDay: true } : {}),
        }
      : {}),
  };
};

/**
 * The alerts the window shows, as it tells the server: their notifications are kept from ever
 * being raised, by the server's pass or the shell's watch.
 */
export function alertsToTell(
  alerts: readonly DueAlert[],
  events: readonly CalendarEntry[],
): ShownAlert[] {
  return alerts.flatMap((alert) => {
    const entry = events.find((each) => each.id === alert.id);
    return entry ? [shownOf(alert, entry)] : [];
  });
}

/**
 * Of the alerts due, those the server cannot raise itself, having no time-zone database: a repeating
 * or floating event's occurrence, a birthday's or an accepted invitation's. A snooze of a document's
 * event has a time of its own, which the server's pass raises.
 */
export function alertsOnlyThePageRaises(
  alerts: readonly DueAlert[],
  events: readonly CalendarEntry[],
  now: number,
): ShownAlert[] {
  return alerts.flatMap((alert) => {
    const entry = events.find((each) => each.id === alert.id);
    if (!entry) return [];
    const shown = shownOf(alert, entry);
    const oursAlone =
      isOtherCalendar(alert.calendar) ||
      ((entry.repeat !== undefined || entry.floating === true) && shown.until === undefined);
    return oursAlone ? [{ ...shown, when: alertWhen(alert, now) }] : [];
  });
}

/**
 * The alerts of `events` that show now. With `fixedNow` they are those at that moment and nothing
 * is timed; without it the window follows the clock: it looks again at the next moment the alerts
 * change (`nextAlertChange`), or a day on.
 */
export function useEventAlerts(events: readonly CalendarEntry[], fixedNow?: number): DueAlert[] {
  const [, setTick] = useState(0);
  const now = fixedNow ?? Date.now();
  const wakeAt = fixedNow === undefined ? (nextAlertChange(events, now) ?? now + LOOKAHEAD) : null;
  useEffect(() => {
    if (wakeAt === null) return;
    const wait = Math.min(LOOKAHEAD, Math.max(0, wakeAt - Date.now()));
    const timer = setTimeout(() => setTick((tick) => tick + 1), wait + 20);
    return () => clearTimeout(timer);
  }, [wakeAt]);
  return dueAlerts(events, now);
}

const timeOf = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayOf = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** When an alert's occurrence is, as its notification says it: "11:00 AM to 12:00 PM". */
export function alertWhen(alert: DueAlert, now: number): string {
  const today = new Date(now).toDateString() === alert.start.toDateString();
  if (alert.allDay) return today ? "All day today" : `All day, ${dayOf.format(alert.start)}`;
  const times = `${timeOf.format(alert.start)} to ${timeOf.format(alert.end)}`;
  return today ? times : `${dayOf.format(alert.start)}, ${times}`;
}
