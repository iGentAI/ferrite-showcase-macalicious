import type { CalendarWeekGridEvent } from "macalicious/calendar-week-grid";
import { type CalendarEntry, dayAt } from "./calendar-data";

/** The popover's Travel Time menu, in minutes; none is `null`. */
export const TRAVEL_CHOICES: readonly { minutes: number | null; name: string }[] = [
  { minutes: null, name: "None" },
  { minutes: 5, name: "5 minutes" },
  { minutes: 15, name: "15 minutes" },
  { minutes: 30, name: "30 minutes" },
  { minutes: 60, name: "1 hour" },
  { minutes: 90, name: "1 hour, 30 minutes" },
  { minutes: 120, name: "2 hours" },
];

/** A travel time in words: its choice's, or so many minutes. */
export const describeTravel = (minutes: number): string =>
  TRAVEL_CHOICES.find((choice) => choice.minutes === minutes)?.name ??
  `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

/** The `id` of the block that draws an event's travel time above it in the week and day grids. */
export const TRAVEL_BLOCK = "travel-time-of-";

/** `events` with a block before each timed one for its travel time. */
export function withTravelBlocks<Entry extends CalendarWeekGridEvent & Partial<CalendarEntry>>(
  events: readonly Entry[],
): (Entry | CalendarWeekGridEvent)[] {
  return events.flatMap((entry): (Entry | CalendarWeekGridEvent)[] =>
    entry.travelTime && !entry.allDay
      ? [
          {
            id: `${TRAVEL_BLOCK}${entry.id}`,
            title: "Travel time",
            start: new Date(entry.start.getTime() - entry.travelTime * 60_000),
            end: entry.start,
            color: entry.color,
          },
          entry,
        ]
      : [entry],
  );
}

const dayKey = (day: Date) => `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;

/**
 * How many of `events` fall on each day, under the key a mini month's day carries in `data-date`.
 * An end is exclusive.
 */
export function eventsPerDay(
  events: readonly Pick<CalendarEntry, "start" | "end">[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { start, end } of events) {
    let day = dayAt(start);
    const last = dayAt(new Date(Math.max(end.getTime() - 1, start.getTime())));
    while (day <= last) {
      const key = dayKey(day);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      day = dayAt(day, 1);
    }
  }
  return counts;
}

/** The shade of a day in the year view: 0 for no event, up to 4 for a day of five or more. */
export const densityLevel = (count: number): number =>
  count <= 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
