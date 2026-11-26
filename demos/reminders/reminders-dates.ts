import type { Reminder, ReminderRepeat, ReminderRepeatRule } from "./reminders-data";

/*
 * Reminders' dates, as pure functions: the calendar arithmetic of repeating reminders, what a
 * row says about when a reminder is due, and the dates a new reminder's text names ("Call
 * Martin tomorrow at 3pm"). Days are `YYYY-MM-DD` and minutes `HH:MM`, in local time.
 */

const two = (value: number) => `${value}`.padStart(2, "0");

/** The year, month (1 to 12) and day of a day written `YYYY-MM-DD`. */
export function partsOf(day: string): [number, number, number] {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return [year, month, date];
}

/** A date as `YYYY-MM-DD`, read in UTC: the arithmetic below never meets a time zone. */
function utcDay(date: Date): string {
  return `${`${date.getUTCFullYear()}`.padStart(4, "0")}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())}`;
}

/** Midnight UTC of a day, for arithmetic by whole days. */
function utcDate(year: number, month: number, date: number): Date {
  const result = new Date(Date.UTC(2000, month - 1, date));
  result.setUTCFullYear(year);
  return result;
}

/** The day `days` after `day`. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = partsOf(day);
  const result = utcDate(year, month, date);
  result.setUTCDate(result.getUTCDate() + days);
  return utcDay(result);
}

/** The whole days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const [a, b] = [partsOf(from), partsOf(to)];
  return Math.round((utcDate(...b).getTime() - utcDate(...a).getTime()) / 86_400_000);
}

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}

/** A local date: the day `day` at the minute `time`, or at midnight. */
export function dateOf(day: string, time = "00:00"): Date {
  const [year, month, date] = partsOf(day);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  // Noon of the day itself first (noon is in no daylight-saving gap), then its minute: a minute a
  // change of the clocks skips is moved by that day's rule, never by another year's. The year
  // is set on its own so that years before 100 are not read as 19xx.
  const result = new Date(2000, 0, 1, 12);
  result.setFullYear(year, month - 1, date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

/** The minute of a local date, as `HH:MM`. */
export function timeOf(date: Date): string {
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** The browser's own time zone by its IANA name, or `undefined` when the engine does not say. */
export function localZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Whether `zone` is written as an IANA time zone may be: 1 to 64 letters, digits, `/_+-`. */
export const isZoneName = (zone: unknown): zone is string =>
  typeof zone === "string" && /^[A-Za-z0-9/_+-]{1,64}$/.test(zone);

const DAY_MS = 86_400_000;
/** One formatter per zone (`null` for a zone the engine does not know): they are costly to make. */
const zoneFormats = new Map<string, Intl.DateTimeFormat | null>();

/**
 * The offset of the clocks of `zone` from UTC at `instant`, in ms (New York in October: -4 h), or
 * `undefined` for a zone the engine does not know.
 */
export function zoneOffset(zone: string, instant: number): number | undefined {
  let format = zoneFormats.get(zone);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
    } catch {
      format = null;
    }
    zoneFormats.set(zone, format);
  }
  if (format === null) return undefined;
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const { year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0 } = parts;
  const wall =
    utcDate(year, month, day).getTime() + ((hour % 24) * 3600 + minute * 60 + second) * 1000;
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant at which the clocks of `zone` show the minute `time` (`HH:MM`) of `day`. In the
 * browser's own zone, or without a zone, or in one the engine does not know, as `dateOf` reads
 * it. As there: a minute a change of the clocks skips moves on by the change, and one it repeats
 * is the earlier of the two.
 */
export function instantIn(day: string, time: string, zone?: string): number {
  if (zone === undefined || zone === localZone()) return dateOf(day, time).getTime();
  const [year, month, date] = partsOf(day);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const wall = utcDate(year, month, date).getTime() + (hour * 60 + minute) * 60_000;
  // The offsets a day either side: they differ only across a change of the clocks.
  const early = zoneOffset(zone, wall - DAY_MS);
  const late = zoneOffset(zone, wall + DAY_MS);
  if (early === undefined || late === undefined) return dateOf(day, time).getTime();
  const shown = [wall - early, wall - late].filter((at) => wall - at === zoneOffset(zone, at));
  return shown.length > 0 ? Math.min(...shown) : wall - early;
}

/** The day and minute an instant shows on the clocks of `zone`, or of the browser's own zone. */
export function wallClockIn(instant: number, zone?: string): { day: string; time: string } {
  const offset = zone === undefined || zone === localZone() ? undefined : zoneOffset(zone, instant);
  if (offset === undefined) {
    const date = new Date(instant);
    const day = `${`${date.getFullYear()}`.padStart(4, "0")}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
    return { day, time: timeOf(date) };
  }
  const shifted = new Date(instant + offset);
  return {
    day: utcDay(shifted),
    time: `${two(shifted.getUTCHours())}:${two(shifted.getUTCMinutes())}`,
  };
}

/** A reminder without its time zone, as one with no due day is kept. */
export function withoutZone(reminder: Reminder): Reminder {
  return Object.fromEntries(
    Object.entries(reminder).filter(([key]) => key !== "timeZone"),
  ) as unknown as Reminder;
}

/**
 * A reminder as a person whose clocks show `zone` sees it. One due at a minute in another zone is
 * shown at that moment on their clocks ("Today, 3:00 PM" in New York is "Tomorrow, 4:00 AM" in
 * Tokyo) and named in `zone`, so its alert's instant is unchanged. One due on a day without a
 * minute, one in their own zone and one without a zone are as they are.
 */
export function inViewerZone(reminder: Reminder, zone: string | undefined = localZone()): Reminder {
  const { due, dueTime, timeZone } = reminder;
  if (!due || !dueTime || !timeZone || !zone || timeZone === zone) return reminder;
  const local = wallClockIn(instantIn(due, dueTime, timeZone), zone);
  return { ...reminder, due: local.day, dueTime: local.time, timeZone: zone };
}

/** The fields that say when a reminder is due. */
const DATED: readonly string[] = ["due", "dueTime", "repeat", "repeatRule", "repeatEnd"];

/**
 * A reminder with a change from its info popover, made by a person whose clocks show `zone`. A
 * change of when it is due is made to the reminder as they see it (`inViewerZone`) and puts it in
 * their zone; a reminder left without a due day has no zone. Any other change keeps its zone.
 */
export function changeReminder(
  reminder: Reminder,
  change: Partial<Reminder>,
  zone: string | undefined = localZone(),
): Reminder {
  if (!DATED.some((key) => key in change)) return { ...reminder, ...change };
  const next = withoutZone({ ...inViewerZone(reminder, zone), ...change });
  return next.due !== undefined && zone ? { ...next, timeZone: zone } : next;
}

/**
 * The first day `months` and every further `months` on from `day` that has its day of the month, so
 * the 31st or 29 February never drifts. `undefined` when none does within 48 steps.
 */
function sameDayMonthsOn(day: string, months: number): string | undefined {
  const [year, month, date] = partsOf(day);
  for (let step = 1; step <= 48; step += 1) {
    const ahead = step * months;
    const y = year + Math.floor((month - 1 + ahead) / 12);
    const m = ((month - 1 + ahead) % 12) + 1;
    if (date <= daysInMonth(y, m)) return `${`${y}`.padStart(4, "0")}-${two(m)}-${two(date)}`;
  }
  return undefined;
}

/** The occurrence after `day` of a custom rule. Weeks start on Sunday. */
function nextByRule(day: string, { every, unit, weekdays }: ReminderRepeatRule) {
  if (unit === "day") return addDays(day, every);
  if (unit === "month") return sameDayMonthsOn(day, every);
  if (unit === "year") return sameDayMonthsOn(day, every * 12);
  const [year, month, date] = partsOf(day);
  const today = utcDate(year, month, date).getUTCDay();
  const days = [...(weekdays ?? [today])].sort((a, b) => a - b);
  const later = days.find((weekday) => weekday > today);
  if (later !== undefined) return addDays(day, later - today);
  return addDays(day, 7 * every - today + (days[0] ?? today));
}

/**
 * The next occurrence after `day` of a reminder that repeats `repeat`, by calendar days alone.
 * A monthly or yearly reminder on a day the next month or year lacks (the 31st, 29 February)
 * moves to the next one that has it, so it never drifts. `undefined` past the year 9999, and for a
 * custom repeat without its rule.
 */
export function nextOccurrence(
  day: string,
  repeat: ReminderRepeat,
  rule?: ReminderRepeatRule,
): string | undefined {
  const [year, month, date] = partsOf(day);
  let next: string | undefined;
  switch (repeat) {
    case "daily":
      next = addDays(day, 1);
      break;
    case "weekly":
      next = addDays(day, 7);
      break;
    case "biweekly":
      next = addDays(day, 14);
      break;
    case "weekdays": {
      const weekday = utcDate(year, month, date).getUTCDay();
      let days = 1;
      // 0 is Sunday and 6 Saturday.
      while ([0, 6].includes((weekday + days) % 7)) days += 1;
      next = addDays(day, days);
      break;
    }
    case "monthly":
      next = sameDayMonthsOn(day, 1);
      break;
    case "yearly":
      next = sameDayMonthsOn(day, 12);
      break;
    case "custom":
      next = rule ? nextByRule(day, rule) : undefined;
      break;
  }
  return next !== undefined && next.length === 10 ? next : undefined;
}

/**
 * The reminder once its circle is clicked or its alert's Complete is pressed: one that repeats
 * moves to its next occurrence within its end and stays to do, as Reminders does; any other is
 * completed.
 */
export function completeReminder(reminder: Reminder): Reminder {
  if (reminder.repeat && reminder.due) {
    const next = nextOccurrence(reminder.due, reminder.repeat, reminder.repeatRule);
    if (next && (!reminder.repeatEnd || next <= reminder.repeatEnd)) {
      return { ...reminder, due: next };
    }
  }
  return { ...reminder, completed: true };
}

/** A minute `HH:MM` as a row shows it: "3:00 PM". */
export function formatTime(time: string): string {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${two(minute)} ${hour < 12 ? "AM" : "PM"}`;
}

const NEAR_DAYS: Record<number, string> = { [-1]: "Yesterday", 0: "Today", 1: "Tomorrow" };

/**
 * What a reminder's row says about when it is due, as Reminders does: "Today", "Tomorrow,
 * 9:30 AM", "10/14/26", and whether that is past: a day before `today`, or today at a minute
 * before `now` (`HH:MM`). A reminder due at a minute in another zone than `zone` (the browser's
 * own) is said as that moment on its clocks. `null` for a reminder with no due day.
 */
export function dueLabel(
  reminder: Reminder,
  today: string,
  now: string,
  zone: string | undefined = localZone(),
): { text: string; overdue: boolean } | null {
  const { due, dueTime } = inViewerZone(reminder, zone);
  if (!due) return null;
  const [year, month, date] = partsOf(due);
  const day = NEAR_DAYS[daysBetween(today, due)] ?? `${month}/${date}/${two(year % 100)}`;
  const overdue = due < today || (due === today && dueTime !== undefined && dueTime <= now);
  return { text: dueTime ? `${day}, ${formatTime(dueTime)}` : day, overdue };
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** The words that name a day, optionally after "on", "next" or "this". */
const DAY_WORDS = new RegExp(
  `\\b(?:(?:on|next|this)\\s+)?(today|tonight|tomorrow|${WEEKDAYS.join("|")})\\b|\\bnext\\s+week\\b`,
  "i",
);

/** The ways to name a minute, the most precise first: each answers `[hour, minute]`. */
const TIME_WORDS: readonly [RegExp, (match: RegExpExecArray) => [number, number]][] = [
  // 3pm, 3:30 pm, at 11 a.m.
  [
    /\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])\.?m\b\.?/i,
    (m) => [(Number(m[1]) % 12) + (m[3]?.toLowerCase() === "p" ? 12 : 0), Number(m[2] ?? 0)],
  ],
  // 15:00, at 9:30
  [/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i, (m) => [Number(m[1]), Number(m[2])]],
  // noon, at midnight
  [
    /\b(?:at\s+)?(noon|midday|midnight)\b/i,
    (m) => [m[1]?.toLowerCase() === "midnight" ? 0 : 12, 0],
  ],
  // at 9; an hour from 1 to 6 with no AM or PM is taken for the afternoon ("at 3" is 3 PM)
  [
    /\bat\s+([01]?\d|2[0-3])\b(?!\s*[:.]\d)/i,
    (m) => {
      const hour = Number(m[1]);
      return [hour >= 1 && hour <= 6 ? hour + 12 : hour, 0];
    },
  ],
];

/** A new reminder's text with the date it names taken out, and that date. */
export interface Entry {
  title: string;
  due?: string;
  dueTime?: string;
}

/**
 * Read the date and the time that a new reminder's text names, as Reminders' natural-language
 * entry does: "Call Martin tomorrow 3pm" is "Call Martin", due tomorrow at 15:00. Days: today,
 * tonight (20:00 unless a time is named), tomorrow, a weekday's name (the next one after today,
 * also after "on", "next" or "this") and "next week" (a week from today). Times: "3pm", "3:30
 * PM", "15:00", "at 9", "noon", "midnight". A time with no day is today, or tomorrow once that
 * minute has passed. Text that would be left empty, or names no date, is returned as it is.
 */
export function parseEntry(text: string, now: Date): Entry {
  let rest = text;
  const today = `${`${now.getFullYear()}`.padStart(4, "0")}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  let due: string | undefined;
  let dueTime: string | undefined;
  let tonight = false;
  const day = DAY_WORDS.exec(rest);
  if (day) {
    const word = day[1]?.toLowerCase();
    if (word === undefined) due = addDays(today, 7);
    else if (word === "today") due = today;
    else if (word === "tonight") {
      due = today;
      tonight = true;
    } else if (word === "tomorrow") due = addDays(today, 1);
    else {
      const ahead = (WEEKDAYS.indexOf(word) - now.getDay() + 7) % 7 || 7;
      due = addDays(today, ahead);
    }
    rest = `${rest.slice(0, day.index)} ${rest.slice(day.index + day[0].length)}`;
  }
  for (const [pattern, read] of TIME_WORDS) {
    const match = pattern.exec(rest);
    if (!match) continue;
    const [hour, minute] = read(match);
    dueTime = `${two(hour)}:${two(minute)}`;
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
    break;
  }
  if (tonight && dueTime === undefined) dueTime = "20:00";
  if (dueTime !== undefined && due === undefined) {
    due = dueTime > timeOf(now) ? today : addDays(today, 1);
  }
  const title = rest
    .replace(/\s+/g, " ")
    .replace(/[\s,;]+$/, "")
    .replace(/\s+(?:at|on|by)$/i, "")
    .trim();
  if (due === undefined || title === "") return { title: text.trim() };
  return dueTime === undefined ? { title, due } : { title, due, dueTime };
}
