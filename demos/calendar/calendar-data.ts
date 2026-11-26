import type { CalendarWeekGridEvent } from "macalicious/calendar-week-grid";
import type { SentAttachment } from "../mail/mail-attachments";

/** The four views of the toolbar's switcher. */
export type CalendarView = "day" | "week" | "month" | "year";

export const VIEWS: readonly { id: CalendarView; title: string; width: number }[] = [
  // The widths of the switcher's segments in the capture, in points.
  { id: "day", title: "Day", width: 62.5 },
  { id: "week", title: "Week", width: 61 },
  { id: "month", title: "Month", width: 60.5 },
  { id: "year", title: "Year", width: 62 },
];

/** One calendar of the sidebar's list. */
export interface CalendarInfo {
  id: string;
  name: string;
  /** The account it is listed under: the person's own calendars are iCloud's. */
  group: "iCloud" | "Other";
  /** Its colour: a custom property of calendar.tokens.css. */
  color: string;
  /** A subscribed calendar shows the subscription glyph. */
  subscribed?: boolean;
  /** The colour's name, for one of the person's own calendars. */
  colorName?: CalendarColor;
}

/** The colours of Calendar's colour menu, for the person's own calendars. */
export type CalendarColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "brown"
  | "cyan"
  | "gray";

/** Each colour's name in the menu and its custom property, in the menu's order. */
export const CALENDAR_COLORS: readonly { id: CalendarColor; name: string; value: string }[] = [
  { id: "red", name: "Red", value: "var(--mac-calendar-red)" },
  { id: "orange", name: "Orange", value: "var(--mac-calendar-orange)" },
  { id: "yellow", name: "Yellow", value: "var(--mac-calendar-yellow)" },
  { id: "green", name: "Green", value: "var(--mac-calendar-green)" },
  { id: "blue", name: "Blue", value: "var(--mac-calendar-blue)" },
  { id: "purple", name: "Purple", value: "var(--mac-calendar-purple)" },
  { id: "brown", name: "Brown", value: "var(--mac-calendar-brown)" },
  { id: "cyan", name: "Cyan", value: "var(--mac-calendar-cyan)" },
  { id: "gray", name: "Gray", value: "var(--mac-calendar-gray)" },
];

/** One of the person's own calendars, as the server keeps it. */
export interface OwnCalendar {
  id: string;
  name: string;
  color: CalendarColor;
}

/** The person's own calendars at first: Home and Work, as in the capture. */
export const defaultOwnCalendars: readonly OwnCalendar[] = [
  { id: "home", name: "Home", color: "cyan" },
  { id: "work", name: "Work", color: "purple" },
];

/** The custom property of a colour. */
export const colorValue = (color: CalendarColor) =>
  CALENDAR_COLORS.find((item) => item.id === color)?.value ?? "var(--mac-calendar-gray)";

/** How an event repeats, in its own zone or local time (`calendar-recurrence.ts` expands it). */
export interface RepeatRule {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  /** Every so many days, weeks, months or years. @default 1 */
  interval?: number;
  /** Ends after this many occurrences. */
  count?: number;
  /** Ends at this instant (epoch ms): no occurrence starts after it. */
  until?: number;
  /** A weekly repeat's days, 0 for Sunday to 6 for Saturday: the start's day when absent. */
  days?: number[];
}

export const HOLIDAYS = "holidays";
export const BIRTHDAYS = "birthdays";
/** The calendar of the events other accounts invited the person to (`calendar-invitations.ts`). */
export const INVITATIONS = "invitations";

/** The calendars of the capture, in the sidebar's order, and Birthdays, which a preference adds. */
export const calendars: readonly CalendarInfo[] = [
  { id: "home", name: "Home", group: "iCloud", color: "var(--mac-calendar-cyan)" },
  { id: "work", name: "Work", group: "iCloud", color: "var(--mac-calendar-purple)" },
  { id: BIRTHDAYS, name: "Birthdays", group: "Other", color: "var(--mac-calendar-gray)" },
  {
    id: HOLIDAYS,
    name: "US Holidays",
    group: "Other",
    color: "var(--mac-calendar-blue)",
    subscribed: true,
  },
  { id: "siri", name: "Siri Suggestions", group: "Other", color: "var(--mac-calendar-gray)" },
];

/** An event of the demo: a week-grid event that belongs to a calendar. */
export interface CalendarEntry extends Omit<CalendarWeekGridEvent, "color"> {
  /** The `id` of its calendar, which gives it its colour. */
  calendar: string;
  /** Where it is. */
  location?: string;
  /** Free text. */
  notes?: string;
  /** An address. */
  url?: string;
  /** How it repeats. */
  repeat?: RepeatRule;
  /** Starts (epoch ms) of occurrences removed from a repeating event. */
  exdates?: number[];
  /** Set on one occurrence of a repeating event: the event's own `id`. */
  series?: string;
  /** The account names of the people it invites, on the desktop served by Ferrite. */
  invitees?: string[];
  /**
   * The IANA zone a timed event keeps its time in ("America/New_York"): a repeating event's
   * occurrences keep their time of day there, wherever they are seen (`calendar-recurrence.ts`).
   * Without one, the browser's own; a save gives a repeating event without one the saving
   * browser's.
   */
  timeZone?: string;
  /** Floating: it reads the same time of day on every clock, wherever it is seen. */
  floating?: boolean;
  /**
   * When its alert shows: minutes before each occurrence's start (negative: after it, as an
   * all-day event's "On day of event (9 AM)"). Without it, no alert (`calendar-alerts.ts`).
   */
  alert?: number;
  /** The start (epoch ms) of the latest occurrence whose alert was closed. */
  alertDismissed?: number;
  /** One occurrence's alert, put off until a moment (epoch ms): `start` is that occurrence's. */
  alertSnooze?: { start: number; until: number };
  /** How it counts for the person's availability. Without it, busy. */
  showAs?: "busy" | "free";
  /** Minutes of travel before it starts, drawn above it in the week and day views. */
  travelTime?: number;
  /** Its files, on the desktop served by Ferrite. */
  attachments?: SentAttachment[];
}

const allDay = (id: string, title: string, month: number, day: number): CalendarEntry => ({
  id,
  title,
  start: new Date(2019, month, day),
  end: new Date(2019, month, day + 1),
  allDay: true,
  calendar: HOLIDAYS,
});

/** The moment of the light capture: Thursday 3 October 2019, 3:38 PM. */
export const CAPTURE_NOW = new Date(2019, 9, 3, 15, 38);

/** The moment of the dark capture, a day later: 10:57 AM. */
export const DARK_CAPTURE_NOW = new Date(2019, 9, 4, 10, 57, 30);

const holidays: readonly CalendarEntry[] = [
  allDay("labor-day", "Labor Day", 8, 2),
  allDay("rosh-hashanah", "Rosh Hashanah", 8, 30),
  allDay("yom-kippur", "Yom Kippur", 9, 9),
  allDay("columbus-day", "Columbus Day", 9, 14),
  allDay("halloween", "Halloween", 9, 31),
  allDay("veterans-day", "Veterans Day", 10, 11),
  allDay("thanksgiving", "Thanksgiving", 10, 28),
  allDay("christmas", "Christmas", 11, 25),
];

const screenshots: CalendarEntry = {
  id: "screenshots",
  title: "Make Catalina Screenshots",
  start: new Date(2019, 9, 3, 14),
  end: new Date(2019, 9, 3, 16, 45),
  calendar: "work",
};

/** The events of the light capture, with the year's other holidays for the weeks around it. */
export const defaultEvents: readonly CalendarEntry[] = [...holidays, screenshots];

/** The events of the dark capture, which has one more. */
export const darkCaptureEvents: readonly CalendarEntry[] = [
  ...defaultEvents,
  {
    id: "more-screenshots",
    title: "Make even more Screenshots",
    start: new Date(2019, 9, 4, 10),
    end: new Date(2019, 9, 4, 13),
    calendar: "work",
  },
];

/** What the General pane of Calendar's preferences sets. */
export interface CalendarSettings {
  /** 7, or 5 for Monday to Friday. */
  daysPerWeek: 5 | 7;
  /** The day a week starts on: 0 for Sunday to 6 for Saturday. */
  weekStartsOn: number;
  /** What the week view's arrows scroll by. */
  scrollBy: "day" | "week" | "week-stop-on-today";
  /** The hour the day starts at: the top of the hours when a view opens. */
  dayStartsAt: number;
  /** The hour the day ends at. */
  dayEndsAt: number;
  /** How many hours the grid shows at a time. */
  hoursShown: number;
  /** The calendar new events go to: "selected" for the one selected in the sidebar. */
  defaultCalendar: string;
  showBirthdays: boolean;
  showHolidays: boolean;
  showAlternateCalendar: boolean;
  /** Advanced: an event's popover shows and changes its time zone. */
  timeZoneSupport?: boolean;
  /** The alert a new timed event starts with, as an event's `alert` counts it. */
  defaultAlert?: number;
  /** The alert a new all-day event starts with. */
  defaultAllDayAlert?: number;
  /** The alert of every birthday in the Birthdays calendar. */
  defaultBirthdayAlert?: number;
}

/** The settings of the capture of Calendar's preferences. */
export const defaultSettings: CalendarSettings = {
  daysPerWeek: 7,
  weekStartsOn: 0,
  scrollBy: "week",
  dayStartsAt: 8,
  dayEndsAt: 18,
  hoursShown: 12,
  defaultCalendar: "selected",
  showBirthdays: false,
  showHolidays: true,
  showAlternateCalendar: false,
};

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Midnight of a date, `add` days later. */
export const dayAt = (date: Date, add = 0) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + add);

export const sameDay = (a: Date, b: Date) => dayAt(a).getTime() === dayAt(b).getTime();

/** The first day the week view shows for a date. */
export function weekStart(date: Date, settings: CalendarSettings) {
  // Scrolling a seven-day week by the day, the date shown is the first.
  if (settings.scrollBy === "day" && settings.daysPerWeek === 7) return dayAt(date);
  // Five days are Monday to Friday, whatever day the week starts on.
  const first = settings.daysPerWeek === 5 ? 1 : settings.weekStartsOn;
  return dayAt(date, -((date.getDay() - first + 7) % 7));
}

/**
 * The date a step of the view away: a day, a week, a month or a year; with `settings`, a step of the
 * week view is what Scroll in week view by says.
 */
export function step(date: Date, view: CalendarView, by: number, settings?: CalendarSettings) {
  if (view === "day") return dayAt(date, by);
  if (view === "week") {
    return dayAt(date, settings?.scrollBy === "day" && settings.daysPerWeek === 7 ? by : 7 * by);
  }
  const months = view === "month" ? by : 12 * by;
  // The same day of the month, or its last day when the month is shorter.
  const last = new Date(date.getFullYear(), date.getMonth() + months + 1, 0);
  return new Date(last.getFullYear(), last.getMonth(), Math.min(date.getDate(), last.getDate()));
}

const hour = (date: Date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours % 12 || 12}${minutes ? `:${minutes < 10 ? "0" : ""}${minutes}` : ""} ${
    hours < 12 ? "AM" : "PM"
  }`;
};

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * "Oct 3, 2019  2 PM to 4:45 PM", as the event popover writes it. An all-day event has no
 * times, and an event that reaches another day names that day too: "Oct 3, 2019  11 PM to
 * Oct 4, 2019  1 AM", "Oct 3, 2019 to Oct 5, 2019  all-day".
 */
export function describe(entry: CalendarEntry) {
  const date = shortDate.format(entry.start);
  // The end is exclusive: an event that ends at midnight does not reach the next day.
  const last = new Date(Math.max(entry.end.getTime() - 1, entry.start.getTime()));
  const oneDay = sameDay(entry.start, last);
  if (entry.allDay) return `${oneDay ? date : `${date} to ${shortDate.format(last)}`}  all-day`;
  const end = oneDay ? hour(entry.end) : `${shortDate.format(entry.end)}  ${hour(entry.end)}`;
  return `${date}  ${hour(entry.start)} to ${end}`;
}

/** A label for an hour of the day: "8:00 AM", as the preferences list them. */
export const hourLabel = (value: number) => `${value % 12 || 12}:00 ${value < 12 ? "AM" : "PM"}`;
