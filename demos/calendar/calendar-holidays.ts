import { type CalendarEntry, dayAt, HOLIDAYS, sameDay } from "./calendar-data";

/*
 * The US Holidays calendar, worked out for any year from each holiday's rule. Real Calendar
 * subscribes to Apple's feed, which the desktop's application has no egress for.
 */

/** Whether an event is one of those worked out here, which nobody can change. */
export const isWorkedOutHoliday = (entry: { id: string; series?: string }) =>
  (entry.series ?? entry.id).startsWith("holiday-");

/** The `nth` weekday of a month (1 for the first), or with `nth` 0 the last. */
function weekdayOf(year: number, month: number, weekday: number, nth: number): Date {
  if (nth === 0) {
    const last = new Date(year, month + 1, 0);
    return dayAt(last, -((last.getDay() - weekday + 7) % 7));
  }
  const first = new Date(year, month, 1);
  return dayAt(first, ((weekday - first.getDay() + 7) % 7) + (nth - 1) * 7);
}

const hebrew = new Intl.DateTimeFormat("en-US-u-ca-hebrew", { month: "long", day: "numeric" });

/** The first of Tishri of a Gregorian year, which falls in September or early October. */
function firstOfTishri(year: number): Date {
  for (let day = new Date(year, 8, 1); day.getMonth() < 10; day = dayAt(day, 1)) {
    if (hebrew.format(day) === "1 Tishri") return day;
  }
  throw new RangeError(`No first of Tishri in ${year}`);
}

/** The holidays of `year`, in its order. */
export function holidaysOf(year: number): CalendarEntry[] {
  const tishri = firstOfTishri(year);
  const days: readonly (readonly [string, string, Date])[] = [
    ["new-year", "New Year\u2019s Day", new Date(year, 0, 1)],
    ["mlk-day", "Martin Luther King Jr. Day", weekdayOf(year, 0, 1, 3)],
    ["presidents-day", "Presidents\u2019 Day", weekdayOf(year, 1, 1, 3)],
    ["memorial-day", "Memorial Day", weekdayOf(year, 4, 1, 0)],
    ["independence-day", "Independence Day", new Date(year, 6, 4)],
    ["labor-day", "Labor Day", weekdayOf(year, 8, 1, 1)],
    ["rosh-hashanah", "Rosh Hashanah", tishri],
    ["yom-kippur", "Yom Kippur", dayAt(tishri, 9)],
    ["columbus-day", "Columbus Day", weekdayOf(year, 9, 1, 2)],
    ["halloween", "Halloween", new Date(year, 9, 31)],
    ["veterans-day", "Veterans Day", new Date(year, 10, 11)],
    ["thanksgiving", "Thanksgiving", weekdayOf(year, 10, 4, 4)],
    ["christmas", "Christmas", new Date(year, 11, 25)],
  ];
  return days
    .map(([id, title, start]) => ({
      id: `holiday-${id}-${year}`,
      title,
      start,
      end: dayAt(start, 1),
      allDay: true,
      calendar: HOLIDAYS,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The holidays of `years` that `events` does not already hold under the same title on that day. */
export function holidaysBeside(
  events: readonly CalendarEntry[],
  years: readonly number[],
): CalendarEntry[] {
  const stored = events.filter((entry) => entry.calendar === HOLIDAYS);
  return years
    .flatMap(holidaysOf)
    .filter(
      (holiday) =>
        !stored.some(
          (entry) => entry.title === holiday.title && sameDay(entry.start, holiday.start),
        ),
    );
}
