import { sessionFetch } from "../desktop/desktop-server";
import type { SentAttachment } from "../mail/mail-attachments";
import type { ShownAlert } from "./calendar-alerts";
import type {
  CalendarColor,
  CalendarEntry,
  CalendarSettings,
  OwnCalendar,
  RepeatRule,
} from "./calendar-data";
import { localZone, sameReading } from "./calendar-recurrence";

/**
 * Calendar's document as its module of the `macalicious-desktop` Ferrite application keeps it
 * (`ferrite-apps/desktop/src/apps/calendar`): `GET` and `PUT` of `{ events, calendars }`, with
 * each event's dates as epoch milliseconds.
 */
export const CALENDAR_EVENTS_URL = "/api/calendar/events";

/** An event as the module stores it. */
export interface StoredEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  allDay?: boolean;
  calendar: string;
  location?: string;
  notes?: string;
  url?: string;
  repeat?: RepeatRule;
  exdates?: number[];
  invitees?: string[];
  /** A timed event's IANA zone (`model::Event::time_zone`). */
  timeZone?: string;
  /** A timed event that reads the same on every clock: `timeZone` is the one its dates were written on. */
  floating?: boolean;
  /** Minutes before each occurrence's start its alert shows (`model::Event::alert`). */
  alert?: number;
  /** The start of the latest occurrence whose alert was closed. */
  alertDismissed?: number;
  /** One occurrence's alert, put off (`model::AlertSnooze`). */
  alertSnooze?: { start: number; until: number };
  showAs?: "busy" | "free";
  /** Minutes of travel before it starts. */
  travelTime?: number;
  attachments?: SentAttachment[];
}

/** The `PUT` body: the person's events and calendars. */
export interface CalendarDocument {
  events: StoredEvent[];
  calendars: OwnCalendar[];
}

/** One event as stored: dates as numbers, empty and absent fields left out. */
function toStored(entry: CalendarEntry): StoredEvent {
  const stored: StoredEvent = {
    id: entry.id,
    title: entry.title,
    start: entry.start.getTime(),
    end: entry.end.getTime(),
    ...(entry.allDay ? { allDay: true } : {}),
    calendar: entry.calendar,
  };
  if (entry.location?.trim()) stored.location = entry.location;
  if (entry.notes?.trim()) stored.notes = entry.notes;
  if (entry.url?.trim()) stored.url = entry.url;
  if (entry.repeat) stored.repeat = entry.repeat;
  if (entry.repeat && entry.exdates?.length) stored.exdates = entry.exdates;
  if (entry.invitees?.length) stored.invitees = entry.invitees;
  // A timed repeating event repeats in its own zone: one that has none yet takes this browser's,
  // where it was made or last changed, so that every browser lays out its occurrences alike.
  if (entry.floating && !entry.allDay) {
    stored.floating = true;
    stored.timeZone = localZone();
  } else if (entry.repeat && !entry.allDay) stored.timeZone = entry.timeZone ?? localZone();
  else if (entry.timeZone && !entry.allDay) stored.timeZone = entry.timeZone;
  // An all-day event is its days, not an instant: the zone it was written in says which days they
  // are, for a browser somewhere else.
  if (entry.allDay) stored.timeZone = localZone();
  // What was closed belongs to an alert, as the module keeps it.
  if (entry.alert !== undefined) {
    stored.alert = entry.alert;
    if (entry.alertDismissed !== undefined) stored.alertDismissed = entry.alertDismissed;
    if (entry.alertSnooze) stored.alertSnooze = entry.alertSnooze;
  }
  if (entry.showAs) stored.showAs = entry.showAs;
  if (entry.travelTime) stored.travelTime = entry.travelTime;
  if (entry.attachments?.length) stored.attachments = entry.attachments;
  return stored;
}

/**
 * Tells the module the window shows these alerts itself, so that Notification Center does not too.
 * What fails to reach it is at most one notification more.
 */
export async function tellAlertsShown(alerts: readonly ShownAlert[]): Promise<void> {
  await sessionFetch("/api/calendar/alerts/shown", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ alerts: alerts.slice(0, 20) }),
  }).catch(() => undefined);
}

/** The `PUT` body for the window's events and calendars. */
export function documentToServer(
  events: readonly CalendarEntry[],
  calendars: readonly OwnCalendar[],
): CalendarDocument {
  return {
    events: events.filter((entry) => !entry.series).map(toStored),
    calendars: calendars.map(({ id, name, color }) => ({ id, name, color })),
  };
}

/** The `PUT` body for events alone, as a page without calendars of its own sends it. */
export function eventsToServer(events: readonly CalendarEntry[]): { events: StoredEvent[] } {
  return { events: events.map(toStored) };
}

/** Epoch milliseconds that make a valid JavaScript `Date`. */
const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 8.64e15;
const optionalString = (value: unknown) => value === undefined || typeof value === "string";
const FREQS: readonly unknown[] = ["daily", "weekly", "monthly", "yearly"];
const COLORS: readonly unknown[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "brown",
  "cyan",
  "gray",
];

const isRepeat = (value: unknown): value is RepeatRule => {
  const rule = value as Partial<RepeatRule> | null;
  return (
    typeof rule === "object" &&
    rule !== null &&
    FREQS.includes(rule.freq) &&
    (rule.interval === undefined || Number.isInteger(rule.interval)) &&
    (rule.count === undefined || Number.isInteger(rule.count)) &&
    (rule.until === undefined || isTime(rule.until)) &&
    (rule.days === undefined || (Array.isArray(rule.days) && rule.days.every(Number.isInteger)))
  );
};

const isStored = (value: unknown): value is StoredEvent => {
  const event = value as Partial<StoredEvent> | null;
  return (
    typeof event === "object" &&
    event !== null &&
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    isTime(event.start) &&
    isTime(event.end) &&
    (event.allDay === undefined || typeof event.allDay === "boolean") &&
    typeof event.calendar === "string" &&
    optionalString(event.location) &&
    optionalString(event.notes) &&
    optionalString(event.url) &&
    (event.repeat === undefined || isRepeat(event.repeat)) &&
    (event.exdates === undefined ||
      (Array.isArray(event.exdates) && event.exdates.every(isTime))) &&
    (event.invitees === undefined ||
      (Array.isArray(event.invitees) &&
        event.invitees.every((name) => typeof name === "string"))) &&
    optionalString(event.timeZone) &&
    (event.floating === undefined || typeof event.floating === "boolean") &&
    (event.alert === undefined || Number.isInteger(event.alert)) &&
    (event.alertDismissed === undefined || isTime(event.alertDismissed)) &&
    (event.alertSnooze === undefined ||
      (isTime(event.alertSnooze?.start) && isTime(event.alertSnooze?.until))) &&
    (event.showAs === undefined || event.showAs === "busy" || event.showAs === "free") &&
    (event.travelTime === undefined || Number.isInteger(event.travelTime)) &&
    (event.attachments === undefined ||
      (Array.isArray(event.attachments) &&
        event.attachments.every(
          (file) =>
            typeof file?.id === "string" &&
            typeof file.name === "string" &&
            typeof file.type === "string" &&
            Number.isInteger(file.size),
        )))
  );
};

/** The local midnight of the day `instant` falls on in `zone`; `instant` if the zone is unknown. */
function sameDayHere(instant: number, zone: string): Date {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find((each) => each.type === type)?.value);
    return new Date(part("year"), part("month") - 1, part("day"));
  } catch {
    return new Date(instant);
  }
}

/** A stored event as the window keeps it. */
function fromStored(event: StoredEvent): CalendarEntry {
  const zone = event.allDay ? event.timeZone : undefined;
  const written = event.floating && !event.allDay ? event.timeZone : undefined;
  const at = (instant: number) =>
    zone
      ? sameDayHere(instant, zone)
      : written
        ? sameReading(new Date(instant), written, undefined)
        : new Date(instant);
  const entry: CalendarEntry = {
    id: event.id,
    title: event.title,
    start: at(event.start),
    end: at(event.end),
    ...(event.allDay ? { allDay: true } : {}),
    calendar: event.calendar,
  };
  if (event.location) entry.location = event.location;
  if (event.notes) entry.notes = event.notes;
  if (event.url) entry.url = event.url;
  if (event.repeat) entry.repeat = event.repeat;
  if (event.exdates?.length) entry.exdates = event.exdates.map((each) => at(each).getTime());
  if (event.invitees?.length) entry.invitees = event.invitees;
  if (event.floating && !event.allDay) entry.floating = true;
  else if (event.timeZone && !event.allDay) entry.timeZone = event.timeZone;
  if (event.alert !== undefined) {
    entry.alert = event.alert;
    if (event.alertDismissed !== undefined) entry.alertDismissed = event.alertDismissed;
    if (event.alertSnooze) entry.alertSnooze = event.alertSnooze;
  }
  if (event.showAs) entry.showAs = event.showAs;
  if (event.travelTime) entry.travelTime = event.travelTime;
  if (event.attachments?.length) entry.attachments = event.attachments;
  return entry;
}

/**
 * What a `GET` reply, or another window's body, holds for the window: the events (absent when
 * the person has saved none: `events` is `null`) and the person's own calendars (absent when the
 * reply names none). `null` when anything in it is not what the module stores, an event, a
 * calendar or an empty list of calendars: the window then takes none of it and saves nothing
 * over it.
 */
export function documentFromServer(
  reply: unknown,
): { events?: CalendarEntry[]; calendars?: OwnCalendar[] } | null {
  if (typeof reply !== "object" || reply === null) return null;
  const { events, calendars } = reply as { events?: unknown; calendars?: unknown };
  if (events !== null && !(Array.isArray(events) && events.every(isStored))) return null;
  if (
    calendars !== undefined &&
    !(Array.isArray(calendars) && calendars.length > 0 && calendars.every(isOwnCalendar))
  ) {
    return null;
  }
  return {
    ...(events ? { events: events.map(fromStored) } : {}),
    ...(calendars
      ? { calendars: calendars.map(({ id, name, color }: OwnCalendar) => ({ id, name, color })) }
      : {}),
  };
}

const isOwnCalendar = (item: unknown): item is OwnCalendar =>
  typeof item === "object" &&
  item !== null &&
  typeof (item as OwnCalendar).id === "string" &&
  typeof (item as OwnCalendar).name === "string" &&
  COLORS.includes((item as OwnCalendar).color as CalendarColor);

/**
 * The person's Calendar preferences (the Preferences window's General pane), one document per
 * person beside the events: `GET` answers `{ settings, rev }`, `settings` being `null` until the
 * person changes one; `PUT` takes `{ settings, rev }` (`model::Settings` in the module).
 */
export const CALENDAR_SETTINGS_URL = "/api/calendar/settings";

const SCROLLS: readonly unknown[] = ["day", "week", "week-stop-on-today"];
const HOURS_SHOWN: readonly unknown[] = [6, 8, 10, 12, 14, 16, 18, 24];
const within = (value: unknown, lo: number, hi: number): value is number =>
  Number.isInteger(value) && (value as number) >= lo && (value as number) <= hi;
const alertMinutes = (value: unknown) => value === undefined || within(value, -1440, 40320);

/**
 * The preferences a `GET` reply, or another window's body, holds: `null` when the person has
 * saved none, `undefined` when the reply is not what the module stores (the window then takes
 * nothing from it and saves nothing over it).
 */
export function settingsFromServer(reply: unknown): CalendarSettings | null | undefined {
  if (typeof reply !== "object" || reply === null) return undefined;
  const { settings } = reply as { settings?: unknown };
  if (settings === null) return null;
  if (typeof settings !== "object" || settings === undefined) return undefined;
  const read = settings as Partial<CalendarSettings>;
  const valid =
    (read.daysPerWeek === 5 || read.daysPerWeek === 7) &&
    within(read.weekStartsOn, 0, 6) &&
    SCROLLS.includes(read.scrollBy) &&
    within(read.dayStartsAt, 0, 22) &&
    within(read.dayEndsAt, 1, 23) &&
    read.dayStartsAt < read.dayEndsAt &&
    HOURS_SHOWN.includes(read.hoursShown) &&
    typeof read.defaultCalendar === "string" &&
    typeof read.showBirthdays === "boolean" &&
    typeof read.showHolidays === "boolean" &&
    typeof read.showAlternateCalendar === "boolean" &&
    (read.timeZoneSupport === undefined || typeof read.timeZoneSupport === "boolean") &&
    alertMinutes(read.defaultAlert) &&
    alertMinutes(read.defaultAllDayAlert) &&
    alertMinutes(read.defaultBirthdayAlert);
  return valid ? settingsToServer(read as CalendarSettings).settings : undefined;
}

/** The `PUT` body for the preferences: exactly the fields the module keeps. */
export function settingsToServer(settings: CalendarSettings): { settings: CalendarSettings } {
  const {
    daysPerWeek,
    weekStartsOn,
    scrollBy,
    dayStartsAt,
    dayEndsAt,
    hoursShown,
    defaultCalendar,
    showBirthdays,
    showHolidays,
    showAlternateCalendar,
    timeZoneSupport,
    defaultAlert,
    defaultAllDayAlert,
    defaultBirthdayAlert,
  } = settings;
  return {
    settings: {
      daysPerWeek,
      weekStartsOn,
      scrollBy,
      dayStartsAt,
      dayEndsAt,
      hoursShown,
      defaultCalendar,
      showBirthdays,
      showHolidays,
      showAlternateCalendar,
      ...(timeZoneSupport ? { timeZoneSupport } : {}),
      ...(defaultAlert === undefined ? {} : { defaultAlert }),
      ...(defaultAllDayAlert === undefined ? {} : { defaultAllDayAlert }),
      ...(defaultBirthdayAlert === undefined ? {} : { defaultBirthdayAlert }),
    },
  };
}
