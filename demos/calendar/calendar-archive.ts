import type { CalendarColor, CalendarEntry, OwnCalendar } from "./calendar-data";
import { eventsToIcs, type IcsImport, parseIcs } from "./calendar-ics";

/*
 * File > Calendar Archive…: every calendar of the person's own in one file, which Import reads back.
 * Real Calendar's `.icbu` is a package of its database; a browser's download is one file, so this one
 * holds each calendar's name, colour and iCalendar text.
 */

const FORMAT = "macalicious-calendar-archive";

export const archiveFileName = (now: Date) =>
  `Calendar Archive ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.icbu`;

/** The archive of `own` and their events. */
export function archiveText(events: readonly CalendarEntry[], own: readonly OwnCalendar[]): string {
  return JSON.stringify({
    format: FORMAT,
    calendars: own.map(({ name, color, id }) => ({
      name,
      color,
      ics: eventsToIcs(
        events.filter((entry) => entry.calendar === id),
        { name },
      ),
    })),
  });
}

export interface ArchivedCalendar {
  name: string;
  color: CalendarColor;
  read: IcsImport;
}

/** The calendars of an archive, or `null` when `text` is none. */
export function readArchive(text: string): ArchivedCalendar[] | null {
  let parsed: { format?: unknown; calendars?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (parsed?.format !== FORMAT || !Array.isArray(parsed.calendars)) return null;
  return parsed.calendars.flatMap((each) =>
    typeof each?.name === "string" && typeof each.ics === "string"
      ? [{ name: each.name, color: each.color as CalendarColor, read: parseIcs(each.ics) }]
      : [],
  );
}
