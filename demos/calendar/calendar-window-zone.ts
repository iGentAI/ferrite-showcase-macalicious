import type { CalendarEntry } from "./calendar-data";
import { sameReading } from "./calendar-recurrence";

/*
 * Time Zone Support's toolbar menu shows the whole window on another zone's clock. The views lay out
 * on the browser's clock, so what they draw is moved: a Date whose local reading is what the zone's
 * clock reads at the event's instant. The events keep their real instants; only what is drawn and
 * what is typed against the drawing cross this file. An all-day or floating event reads the same on
 * every clock and is not moved.
 */

/** The zones the time zone menus offer, beside the browser's own and the event's. */
export const ZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** The value of the popover's Floating item. */
export const FLOATING = "floating";

/** A zone's name in a menu: "New York". */
export const zoneName = (zone: string) => zone.replace(/^.*\//, "").replaceAll("_", " ");

/** `instant` as the window draws it: its local reading is what `zone`'s clock reads then. */
export const toWindowClock = (instant: Date, zone: string | null): Date =>
  zone ? sameReading(instant, zone, undefined) : instant;

/** The instant of a reading on the window's clock. */
export const fromWindowClock = (reading: Date, zone: string | null): Date =>
  zone ? sameReading(reading, undefined, zone) : reading;

/** `entry` as the window draws it. */
export function onWindowClock<T extends CalendarEntry>(entry: T, zone: string | null): T {
  if (!zone || entry.allDay || entry.floating) return entry;
  return { ...entry, start: toWindowClock(entry.start, zone), end: toWindowClock(entry.end, zone) };
}

/** What an event changes to keep its time of day on a new zone's clock, or to float. */
export function changeOfZone(
  entry: Pick<CalendarEntry, "start" | "end" | "timeZone" | "floating">,
  zone: string,
): Partial<CalendarEntry> {
  const from = entry.floating ? undefined : entry.timeZone;
  const start = sameReading(entry.start, from, zone === FLOATING ? undefined : zone);
  const end = new Date(start.getTime() + (entry.end.getTime() - entry.start.getTime()));
  return zone === FLOATING
    ? { floating: true, timeZone: undefined, start, end }
    : { floating: undefined, timeZone: zone, start, end };
}

/**
 * A change made in the popover of `entry` while it is drawn on the window's clock, as the event's
 * own: dates typed there are readings of that clock. A change of zone is worked out again from the
 * event's own dates.
 */
export function fromPopover(
  entry: CalendarEntry,
  fields: Partial<CalendarEntry>,
  zone: string | null,
): Partial<CalendarEntry> {
  if (!zone) return fields;
  if ("floating" in fields) {
    // Floating keeps what the window reads now; any other zone is worked out from the event.
    if (fields.floating) {
      return {
        ...fields,
        start: toWindowClock(entry.start, zone),
        end: toWindowClock(entry.end, zone),
      };
    }
    return { ...fields, ...changeOfZone(entry, fields.timeZone as string) };
  }
  const allDay = fields.allDay ?? entry.allDay;
  if (allDay || entry.floating) return fields;
  return {
    ...fields,
    ...(fields.start ? { start: fromWindowClock(fields.start, zone) } : {}),
    ...(fields.end ? { end: fromWindowClock(fields.end, zone) } : {}),
  };
}
