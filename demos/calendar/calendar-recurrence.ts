import type { CalendarEntry, RepeatRule } from "./calendar-data";

/*
 * Repeating events, expanded on the wall clock of the event's own time zone (`timeZone`, an IANA
 * name) or, without one, of the browser's: each occurrence keeps the start's time of day on that
 * clock, across changes of daylight saving time, so a weekly 8:00 New York meeting is at 8:00 in
 * New York every week, seen from Tokyo or anywhere else. Every date is made as
 * `new Date(year, month, day, hours, minutes)` makes it, on that clock. A monthly event on the
 * 31st skips the months without one, and a yearly one on 29 February the years without it, as
 * iCalendar does (RFC 5545, 3.3.10). Weeks start on Sunday (`WKST=SU`). An all-day event has no
 * zone: its days are the viewer's.
 */

/** The most occurrences one event yields to a view, and the most dates looked at. */
const MAX_OCCURRENCES = 1000;
const MAX_STEPS = 20_000;
const DAY = 86_400_000;

type Parts = readonly [number, number, number, number, number, number, number];

/** The parts of a date in local time. */
const parts = (date: Date): Parts =>
  [
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ] as const;

/** Wall-clock arithmetic on one zone's clock. */
interface Clock {
  /** The year, month (0 to 11), day, hours, minutes, seconds and milliseconds of `date`. */
  parts(date: Date): Parts;
  /** The instant of a reading; fields out of range roll over, as `new Date(...)`'s do. */
  make(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
    seconds: number,
    ms: number,
  ): Date;
  /** The weekday of `date`, 0 for Sunday. */
  weekday(date: Date): number;
}

const localClock: Clock = {
  parts,
  make: (year, month, day, hours, minutes, seconds, ms) =>
    new Date(year, month, day, hours, minutes, seconds, ms),
  weekday: (date) => date.getDay(),
};

/** The browser's own IANA zone. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** `date` moved so that the clock of `to` reads what the clock of `from` reads now. */
export function sameReading(date: Date, from: string | undefined, to: string | undefined): Date {
  const clock = (zone: string | undefined) =>
    !zone || zone === localZone() ? localClock : (zoneClock(zone) ?? localClock);
  const [year, month, day, hours, minutes, seconds, ms] = clock(from).parts(date);
  return clock(to).make(year, month, day, hours, minutes, seconds, ms);
}

/** Whether the browser knows `zone` as an IANA zone. */
export const isKnownZone = (zone: string) => zoneClock(zone) !== null;

const zoneClocks = new Map<string, Clock | null>();

/** The clock of the IANA zone `zone`, or null when the browser does not know it. */
function zoneClock(zone: string): Clock | null {
  const known = zoneClocks.get(zone);
  if (known !== undefined) return known;
  let clock: Clock | null = null;
  try {
    clock = clockOf(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      }),
    );
  } catch {
    clock = null;
  }
  if (zoneClocks.size < 100) zoneClocks.set(zone, clock);
  return clock;
}

/** The clock a formatter of one zone reads. */
function clockOf(format: Intl.DateTimeFormat): Clock {
  const wall = (ms: number): Parts => {
    const read: Record<string, number> = {};
    for (const part of format.formatToParts(new Date(ms)))
      if (part.type !== "literal") read[part.type] = Number(part.value);
    return [
      read.year ?? 1970,
      (read.month ?? 1) - 1,
      read.day ?? 1,
      (read.hour ?? 0) % 24,
      read.minute ?? 0,
      read.second ?? 0,
      ((ms % 1000) + 1000) % 1000,
    ] as const;
  };
  // The zone's offset at an instant: its reading there, as UTC, less the instant.
  const offset = (ms: number) => {
    const [y, mo, d, h, mi, s, milli] = wall(ms);
    return Date.UTC(y, mo, d, h, mi, s, milli) - ms;
  };
  return {
    parts: (date) => wall(date.getTime()),
    make: (year, month, day, hours, minutes, seconds, ms) => {
      const reading = Date.UTC(year, month, day, hours, minutes, seconds, ms);
      // As `new Date(...)` reads local time, and RFC 5545 (3.3.5): a reading the clocks repeat
      // is its first instant; one they skip takes the offset in force before the change, so it
      // comes out an hour on (and `starts` passes it over). So a browser in the zone and one
      // elsewhere make the same instants.
      const before = offset(reading - DAY);
      const after = offset(reading + DAY);
      const readings = [before, after]
        .filter((each) => offset(reading - each) === each)
        .map((each) => reading - each);
      return new Date(readings.length > 0 ? Math.min(...readings) : reading - before);
    },
    weekday: (date) => {
      const [y, mo, d] = wall(date.getTime());
      return new Date(Date.UTC(y, mo, d)).getUTCDay();
    },
  };
}

/**
 * The clock an event repeats on: its own zone's, for a timed event that names one the browser
 * knows other than the browser's; else the browser's.
 */
function clockFor(entry: Pick<CalendarEntry, "allDay" | "timeZone">): Clock {
  if (entry.allDay || !entry.timeZone || entry.timeZone === localZone()) return localClock;
  return zoneClock(entry.timeZone) ?? localClock;
}

/**
 * The start of the occurrence of `entry` nearest the instant `at`, on the clock the event repeats
 * on: an occurrence is at the start's time of day there, whatever the time is in the browser.
 */
export function nearestStart(
  entry: Pick<CalendarEntry, "start" | "allDay" | "timeZone">,
  at: number,
): number {
  const clock = clockFor(entry);
  const [, , , hours, minutes, seconds, ms] = clock.parts(entry.start);
  const [year, month, day] = clock.parts(new Date(at));
  let best = at;
  let distance = Number.POSITIVE_INFINITY;
  for (const offset of [-1, 0, 1]) {
    const candidate = clock.make(year, month, day + offset, hours, minutes, seconds, ms).getTime();
    if (Math.abs(candidate - at) < distance) {
      distance = Math.abs(candidate - at);
      best = candidate;
    }
  }
  return best;
}

/** The start of the occurrence of `entry` on a date (`month` from 1) of the clock it repeats on. */
export function startOnDate(
  entry: Pick<CalendarEntry, "start" | "allDay" | "timeZone">,
  year: number,
  month: number,
  day: number,
): number {
  const clock = clockFor(entry);
  const [, , , hours, minutes, seconds, ms] = clock.parts(entry.start);
  return clock.make(year, month - 1, day, hours, minutes, seconds, ms).getTime();
}

/**
 * The starts of an event's occurrences, in order, from its own start: those the rule makes,
 * removed ones included (a count counts them, as in iCalendar), until its count or end. With
 * `from`, a daily or weekly repeat without a count skips ahead to shortly before that instant,
 * so a series begun long ago is expanded from near the days asked for, not from its first day.
 */
export function* starts(entry: CalendarEntry, from?: Date): Generator<Date> {
  const rule = entry.repeat;
  if (!rule) {
    yield entry.start;
    return;
  }
  const interval = Math.max(1, Math.floor(rule.interval ?? 1));
  const clock = clockFor(entry);
  const [year, month, day, hours, minutes, seconds, ms] = clock.parts(entry.start);
  // Whole periods that can be skipped: two short of the period in which an occurrence that
  // still lasts at `from` could have begun (the event's length, and a day for the clocks,
  // before it), so an event that began before `from` and still lasts is found.
  const span = Math.max(0, entry.end.getTime() - entry.start.getTime()) + DAY;
  const skip = (periodDays: number) =>
    from && rule.count === undefined
      ? Math.max(
          0,
          Math.floor((from.getTime() - span - entry.start.getTime()) / (periodDays * DAY)) - 2,
        )
      : 0;
  let made = 0;
  const over = (date: Date) =>
    (rule.until !== undefined && date.getTime() > rule.until) ||
    (rule.count !== undefined && made >= rule.count);
  // A timed occurrence at a clock time the day does not have (the hour the clocks skip) is no
  // occurrence, and does not count (RFC 5545, 3.3.10); `Date` would move it an hour on.
  const skipped = (date: Date) => {
    if (entry.allDay) return false;
    const [, , , h, mi] = clock.parts(date);
    return h !== hours || mi !== minutes;
  };
  if (rule.freq === "weekly") {
    const startDay = clock.weekday(entry.start);
    const days = rule.days?.length ? [...rule.days].sort((a, b) => a - b) : [startDay];
    // The Sunday of the start's week.
    const sunday = day - startDay;
    const first = skip(7 * interval);
    for (let week = first; (week - first) * days.length < MAX_STEPS; week += 1) {
      for (const weekday of days) {
        const date = clock.make(
          year,
          month,
          sunday + week * 7 * interval + weekday,
          hours,
          minutes,
          seconds,
          ms,
        );
        if (date < entry.start || skipped(date)) continue;
        if (over(date)) return;
        made += 1;
        yield date;
      }
    }
    return;
  }
  const first = rule.freq === "daily" ? skip(interval) : 0;
  for (let step = first; step - first < MAX_STEPS; step += 1) {
    const n = step * interval;
    let date: Date;
    if (rule.freq === "daily") date = clock.make(year, month, day + n, hours, minutes, seconds, ms);
    else if (rule.freq === "monthly") {
      date = clock.make(year, month + n, day, hours, minutes, seconds, ms);
      // The 31st of a month without one is no occurrence.
      if (clock.parts(date)[2] !== day) continue;
    } else {
      date = clock.make(year + n, month, day, hours, minutes, seconds, ms);
      if (clock.parts(date)[1] !== month) continue;
    }
    if (skipped(date)) continue;
    if (over(date)) return;
    made += 1;
    yield date;
  }
}

/** How many whole days an all-day event spans, however long its days are. */
export const daysSpanned = (start: Date, end: Date) =>
  Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));

/**
 * `date` moved by the calendar days and clock time that take `from` to `to`, on the local
 * calendar: moving one occurrence of a series from Saturday 9:30 to Monday 9:30 moves its
 * start two days on at 9:30, whatever the clocks did in between.
 */
export function shiftLocal(date: Date, from: Date, to: Date): Date {
  return shiftOn(localClock, date, from, to);
}

/** `shiftLocal` on the calendar and clock of `clock`. */
function shiftOn(clock: Clock, date: Date, from: Date, to: Date): Date {
  const [fy, fm, fd, fh, fmi, fs, fms] = clock.parts(from);
  const [ty, tm, td, th, tmi, ts, tms] = clock.parts(to);
  const days = Math.round((Date.UTC(ty, tm, td) - Date.UTC(fy, fm, fd)) / DAY);
  const [y, m, d, h, mi, s, ms] = clock.parts(date);
  return clock.make(y, m, d + days, h + th - fh, mi + tmi - fmi, s + ts - fs, ms + tms - fms);
}

/**
 * The start a repeating `entry` needs for its occurrence at `occurrence` to fall at `to`, or
 * null when no start does. A daily or weekly series moves by as many calendar days and as much
 * clock time. A monthly or yearly one counts in its own units: its occurrence that many months
 * or years on from its start falls at `to`, so the start is that many months or years before
 * it. Either way the moved series must really have an occurrence at exactly `to` (its count,
 * its end, a day a month lacks or a clock time a change of the clocks skips can each prevent
 * it); when it does not, no start makes the move.
 */
export function seriesStartFor(entry: CalendarEntry, occurrence: Date, to: Date): Date | null {
  const freq = entry.repeat?.freq;
  const start = entry.start;
  // On the event's own clock, as its occurrences are made.
  const clock = clockFor(entry);
  const [ty, tm, td, th, tmi, ts, tms] = clock.parts(to);
  let moved: Date;
  if (freq !== "monthly" && freq !== "yearly") moved = shiftOn(clock, start, occurrence, to);
  else {
    const [oy, om] = clock.parts(occurrence);
    const [sy, sm] = clock.parts(start);
    const months = freq === "monthly" ? oy * 12 + om - (sy * 12 + sm) : 12 * (oy - sy);
    moved = clock.make(ty, tm - months, td, th, tmi, ts, tms);
  }
  // A start the clocks or the calendar moved is not the start asked for.
  const [, , , mh, mmi] = clock.parts(moved);
  if (mh !== th || mmi !== tmi) return null;
  const series: CalendarEntry = {
    ...entry,
    start: moved,
    end: new Date(moved.getTime() + (entry.end.getTime() - start.getTime())),
  };
  for (const at of starts(series)) {
    if (at.getTime() === to.getTime()) return moved;
    if (at > to) break;
  }
  return null;
}

/** The end of the occurrence starting at `start`: as long as the event, in days for an all-day one. */
function endFor(entry: CalendarEntry, start: Date): Date {
  if (entry.allDay) {
    const days = daysSpanned(entry.start, entry.end);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + days);
  }
  return new Date(start.getTime() + (entry.end.getTime() - entry.start.getTime()));
}

/** The id of one occurrence of a repeating event. */
export const occurrenceId = (series: string, start: Date | number) =>
  `${series}@${typeof start === "number" ? start : start.getTime()}`;

/** The event an id names: the event itself, or the repeating event of an occurrence. */
export const seriesOf = (id: string) => id.split("@")[0] ?? id;

/**
 * The occurrences of `entry` that reach into `from` to `to` (the end exclusive): the entry
 * itself when it does not repeat, otherwise one entry per occurrence, with an id of its own and
 * `series` naming the event.
 */
export function occurrences(entry: CalendarEntry, from: Date, to: Date): CalendarEntry[] {
  if (!entry.repeat) {
    const reaches =
      entry.start < to && Math.max(entry.end.getTime(), entry.start.getTime() + 1) > from.getTime();
    return reaches ? [entry] : [];
  }
  const removed = new Set(entry.exdates ?? []);
  const out: CalendarEntry[] = [];
  for (const start of starts(entry, from)) {
    if (start >= to || out.length >= MAX_OCCURRENCES) break;
    const end = endFor(entry, start);
    if (Math.max(end.getTime(), start.getTime() + 1) <= from.getTime()) continue;
    if (removed.has(start.getTime())) continue;
    out.push({ ...entry, id: occurrenceId(entry.id, start), start, end, series: entry.id });
  }
  return out;
}

/**
 * `next` (an event's fields after an edit of one of its occurrences, which was at `occurrence`
 * and is now from `start` to `end`) as the whole series moved there: its start from
 * `seriesStartFor`, its end as long as the edited occurrence (in days for an all-day event),
 * and its removed occurrences where the series now puts them. Null when no move puts the
 * edited occurrence at `start` and keeps it, removed occurrences included.
 */
export function movedSeries(
  before: CalendarEntry,
  next: CalendarEntry,
  occurrence: Date,
  start: Date,
  end: Date,
): CalendarEntry | null {
  // The series moves from where it is (`before`), with the repeat the edit leaves (`next`).
  const seriesStart = seriesStartFor(
    { ...next, start: before.start, end: before.end },
    occurrence,
    start,
  );
  if (!seriesStart) return null;
  const seriesEnd = next.allDay
    ? new Date(
        seriesStart.getFullYear(),
        seriesStart.getMonth(),
        seriesStart.getDate() + daysSpanned(start, end),
      )
    : new Date(seriesStart.getTime() + (end.getTime() - start.getTime()));
  const moved: CalendarEntry = { ...next, start: seriesStart, end: seriesEnd };
  // The occurrences removed before stay removed where the series now puts them.
  const exdates = movedExdates(before, moved);
  if (exdates === null) return null;
  if (exdates) moved.exdates = exdates;
  else delete moved.exdates;
  return moved.exdates?.includes(start.getTime()) ? null : moved;
}

/**
 * The removed occurrences of `before` as occurrences of `after`, the same series moved: the
 * occurrence that was nth stays removed. Undefined when none is removed. Null when one cannot be
 * placed: it lies past the dates looked at in `before`, or `after` has no occurrence in its
 * place. A removed date before the last one looked at that is no occurrence of `before` removes
 * nothing, and is left out.
 */
export function movedExdates(
  before: CalendarEntry,
  after: CalendarEntry,
): number[] | null | undefined {
  const removed = new Set(before.exdates ?? []);
  if (!removed.size || !before.repeat || !after.repeat) return undefined;
  const positions: number[] = [];
  let position = 0;
  let lastSeen = Number.NEGATIVE_INFINITY;
  for (const start of starts(before)) {
    lastSeen = start.getTime();
    if (removed.has(lastSeen)) positions.push(position);
    if (positions.length === removed.size) break;
    position += 1;
  }
  if (positions.length < removed.size && [...removed].some((at) => at > lastSeen)) return null;
  const last = positions.at(-1);
  if (last === undefined) return undefined;
  const wanted = new Set(positions);
  const out: number[] = [];
  position = 0;
  for (const start of starts(after)) {
    if (wanted.has(position)) out.push(start.getTime());
    if (position >= last) break;
    position += 1;
  }
  return out.length === positions.length ? out : null;
}

/** The next occurrence of `entry` that has not ended at `now`, or its last one. */
export function nextOccurrence(entry: CalendarEntry, now: number): Date {
  if (!entry.repeat) return entry.start;
  const removed = new Set(entry.exdates ?? []);
  for (const start of starts(entry, new Date(now))) {
    if (removed.has(start.getTime())) continue;
    if (endFor(entry, start).getTime() > now) return start;
  }
  // None to come: the series ended. Its last occurrence, looked for from its first, since the
  // skip ahead may have passed its end and yielded none.
  let last = entry.start;
  for (const start of starts(entry)) {
    if (start.getTime() > now) break;
    if (!removed.has(start.getTime())) last = start;
  }
  return last;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const UNIT: Record<RepeatRule["freq"], string> = {
  daily: "Day",
  weekly: "Week",
  monthly: "Month",
  yearly: "Year",
};

/** "Every Week", "Every 2 Weeks on Tue, Thu", "Every Day, 5 times": the popover's repeat row. */
export function describeRepeat(rule: RepeatRule): string {
  const interval = rule.interval ?? 1;
  let text = interval === 1 ? `Every ${UNIT[rule.freq]}` : `Every ${interval} ${UNIT[rule.freq]}s`;
  if (rule.freq === "weekly" && rule.days?.length)
    text += ` on ${[...rule.days]
      .sort((a, b) => a - b)
      .map((day) => WEEKDAY_SHORT[day])
      .join(", ")}`;
  if (rule.count !== undefined) text += `, ${rule.count} ${rule.count === 1 ? "time" : "times"}`;
  if (rule.until !== undefined)
    text += `, until ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(rule.until)}`;
  return text;
}

/** The repeat menu's choices: none, or every day, week, month or year. */
export const REPEAT_CHOICES: readonly { id: "none" | RepeatRule["freq"]; name: string }[] = [
  { id: "none", name: "None" },
  { id: "daily", name: "Every Day" },
  { id: "weekly", name: "Every Week" },
  { id: "monthly", name: "Every Month" },
  { id: "yearly", name: "Every Year" },
];
