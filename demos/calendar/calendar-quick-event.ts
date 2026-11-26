import { dayAt } from "./calendar-data";

/** What a line typed under the plus makes. */
export interface QuickEvent {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
}

/** The longest title and place an event keeps (`MAX_TITLE_CHARS`, `MAX_LOCATION_CHARS` in the module). */
const MAX_TEXT = 200;
/** The furthest instant a date can be, and the longest an event can last (`calendar/model.rs`). */
const MAX_ABS_MS = 8_640_000_000_000_000;
const MAX_DURATION_MS = 10 * 366 * 864e5;

const upTo = (text: string) => [...text].slice(0, MAX_TEXT).join("");

/** Whether Calendar can keep what a line made: a number in the line can reach past its dates. */
export function quickEventFits({ start, end }: QuickEvent): boolean {
  const from = start.getTime();
  const to = end.getTime();
  return (
    Math.abs(from) <= MAX_ABS_MS &&
    Math.abs(to) <= MAX_ABS_MS &&
    to >= from &&
    to - from <= MAX_DURATION_MS
  );
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTH =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const WEEKDAY =
  "(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)";
const ORDINAL = "(\\d{1,2})(?:st|nd|rd|th)?";
const CLOCK = "(noon|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?)";
const BEFORE = "(?<![\\w:/-])";
const AFTER = "(?![\\w:/-])";

interface Clock {
  /** Minutes from midnight. */
  minutes: number;
  /** Whether the words said which half of the day. */
  sure: boolean;
}

/** A time as written: "noon", "3pm", "3:30 p.m.", "15:00", "3". `null` when it is no time. */
function readClock(written: string): Clock | null {
  const text = written.toLowerCase().replace(/\./g, "").trim();
  if (text === "noon") return { minutes: 720, sure: true };
  if (text === "midnight") return { minutes: 0, sure: true };
  const parts = /^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?$/.exec(text);
  if (!parts) return null;
  const hour = Number(parts[1]);
  const minute = Number(parts[2] ?? 0);
  if (minute > 59) return null;
  if (parts[3]) {
    if (hour < 1 || hour > 12) return null;
    return { minutes: ((hour % 12) + (parts[3] === "pm" ? 12 : 0)) * 60 + minute, sure: true };
  }
  if (hour > 23) return null;
  return { minutes: hour * 60 + minute, sure: hour > 12 || hour === 0 };
}

/**
 * The minutes of a time that named no half of the day: what the words around it say, else as people
 * write times for events, 1 to 7 in the afternoon, 8 to 11 in the morning, 12 at noon.
 */
function settled(clock: Clock, words: string): number {
  if (clock.sure) return clock.minutes;
  const hour = Math.floor(clock.minutes / 60);
  if (/\b(?:tonight|evening|dinner|supper)\b/i.test(words))
    return (hour % 12) * 60 + 720 + (clock.minutes % 60);
  if (/\b(?:morning|breakfast)\b/i.test(words)) return clock.minutes;
  return hour >= 1 && hour <= 7 ? clock.minutes + 720 : clock.minutes;
}

/**
 * The next `month` and `day` from `today`, or in `year` when one is written: 29 February waits for
 * the next leap year. `null` for a date no year or not that year has.
 */
function nextDate(month: number, day: number, today: Date, year?: number): Date | null {
  const inYear = (each: number) => {
    const at = new Date(each, month, day);
    return at.getMonth() === month ? at : null;
  };
  if (year !== undefined) return inYear(year);
  const first = today.getFullYear();
  for (let each = first; each <= first + 8; each += 1) {
    const at = inYear(each);
    if (at && at >= today) return at;
  }
  return null;
}

/**
 * Reads what Quick Event is given: "Lunch at noon tomorrow", "Dentist Friday 3pm for 30 minutes",
 * "Review 2-4pm on Oct 12 at Room 5", "Trip next Monday". The rest of the line is the title, and
 * "at" or "@" before a capitalized word at its end is the location.
 *
 * A date without a time is an all-day event; a time without a date is today, or tomorrow once it has
 * passed; neither is the next full hour. It lasts an hour unless the line says otherwise. `null` for
 * a line with no text.
 */
export function parseQuickEvent(line: string, now: Date): QuickEvent | null {
  const typed = line.trim();
  if (!typed) return null;
  let rest = typed;
  // What reads as a date or a time and is none ("13/40", "Feb 30", "at 25") stays in the title.
  const take = (
    pattern: RegExp,
    accept?: (found: RegExpExecArray) => boolean,
  ): RegExpExecArray | null => {
    const found = pattern.exec(rest);
    if (!found || (accept && !accept(found))) return null;
    rest = `${rest.slice(0, found.index)} ${rest.slice(found.index + found[0].length)}`;
    return found;
  };
  const today = dayAt(now);
  let day = null as Date | null;

  take(
    new RegExp(`${BEFORE}(?:on\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?${AFTER}`, "i"),
    (numeric) => {
      const year = numeric[3] ? Number(numeric[3]) : undefined;
      day = nextDate(
        Number(numeric[1]) - 1,
        Number(numeric[2]),
        today,
        year !== undefined && year < 100 ? 2000 + year : year,
      );
      return day !== null;
    },
  );

  if (!day) {
    const byName = (word: string, number: string, year: string | undefined) => {
      day = nextDate(
        MONTHS.indexOf(word.slice(0, 3).toLowerCase()),
        Number(number),
        today,
        year ? Number(year) : undefined,
      );
      return day !== null;
    };
    take(
      new RegExp(`\\b(?:on\\s+)?${MONTH}\\s+${ORDINAL}(?:,?\\s+(\\d{4}))?${AFTER}`, "i"),
      (found) => byName(found[1] as string, found[2] as string, found[3]),
    ) ??
      take(
        new RegExp(`\\b(?:on\\s+)?${ORDINAL}\\s+(?:of\\s+)?${MONTH}(?:,?\\s+(\\d{4}))?\\b`, "i"),
        (found) => byName(found[2] as string, found[1] as string, found[3]),
      );
  }

  const lasting = take(
    /\bfor\s+(an?|half\s+an?|\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i,
  );
  let lasts = 60;
  if (lasting) {
    const amount = (lasting[1] as string).toLowerCase();
    const size = amount.startsWith("half") ? 0.5 : /^an?$/.test(amount) ? 1 : Number(amount);
    lasts = (lasting[2] as string).toLowerCase().startsWith("h") ? size * 60 : size;
  }

  let from: Clock | null = null;
  let until: Clock | null = null;
  const range = take(
    new RegExp(
      `${BEFORE}(?:from\\s+|at\\s+)?${CLOCK}\\s*(?:-|\u2013|to|until|till)\\s*${CLOCK}${AFTER}`,
      "i",
    ),
    (found) => readClock(found[1] as string) !== null && readClock(found[2] as string) !== null,
  );
  if (range) {
    from = readClock(range[1] as string);
    until = readClock(range[2] as string);
    // "2-4pm", "12-1am", "11-1am": the first is the last time that clock reads before the second.
    if (from && until?.sure && !from.sure) {
      const morning = from.minutes % 720;
      const afternoon = morning + 720;
      from = {
        minutes: morning < until.minutes && afternoon >= until.minutes ? morning : afternoon,
        sure: true,
      };
    }
  }
  if (!from) {
    const prefix = `${BEFORE}(?:at\\s+|@\\s*)`;
    const isClock = (found: RegExpExecArray) => readClock(found[1] as string) !== null;
    const single =
      take(new RegExp(`${prefix}?(noon|midnight)${AFTER}`, "i"), isClock) ??
      take(new RegExp(`${prefix}?(\\d{1,2}(?::\\d{2})?\\s*[ap]\\.?m\\.?)${AFTER}`, "i"), isClock) ??
      take(new RegExp(`${prefix}?(\\d{1,2}:\\d{2})${AFTER}`, "i"), isClock) ??
      take(new RegExp(`${prefix}(\\d{1,2})${AFTER}`, "i"), isClock);
    if (single) from = readClock(single[1] as string);
  }

  const nearby = day
    ? null
    : take(
        new RegExp(
          `\\b(?:(day\\s+after\\s+tomorrow|tomorrow|today|tonight)|in\\s+(\\d+)\\s+days?|next\\s+week|(?:on\\s+|this\\s+)?(next\\s+)?${WEEKDAY})\\b`,
          "i",
        ),
      );
  if (nearby) {
    const word = nearby[1]?.toLowerCase().replace(/\s+/g, " ");
    if (word === "tomorrow") day = dayAt(today, 1);
    else if (word === "day after tomorrow") day = dayAt(today, 2);
    else if (word) day = today;
    else if (nearby[2]) day = dayAt(today, Number(nearby[2]));
    else if (nearby[4]) {
      const wanted = WEEKDAYS.indexOf(nearby[4].slice(0, 3).toLowerCase());
      const ahead = (wanted - today.getDay() + 7) % 7;
      // "Next Friday" is in the week after this one, when this week's Friday is yet to come.
      if (nearby[3])
        day = dayAt(today, ahead === 0 ? 7 : wanted > today.getDay() ? ahead + 7 : ahead);
      else day = dayAt(today, ahead);
    } else day = dayAt(today, 7);
  }

  rest = rest.replace(/\s+/g, " ").trimEnd();
  const place = /\s(?:at|@)\s*([A-Z0-9].*)$/.exec(rest);
  const location = place ? (place[1] as string).trim() : undefined;
  if (place) rest = rest.slice(0, place.index);
  const title =
    upTo(
      rest
        .replace(/\s+(?:on|at|from|for|in)\s*$/i, "")
        .replace(/[\s,.-]+$/, "")
        .replace(/^[\s,.-]+/, ""),
    ) || "New Event";
  const named = location ? { location: upTo(location) } : {};

  if (!from) {
    if (day) return { title, start: day, end: dayAt(day, 1), allDay: true, ...named };
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      now.getHours() + 1,
    );
    const end = new Date(start.getTime() + lasts * 60_000);
    return { title, start, end, allDay: false, ...named };
  }
  const minutes = settled(from, typed);
  const at = (on: Date, count: number) =>
    new Date(on.getFullYear(), on.getMonth(), on.getDate(), 0, count);
  const on = day ?? (at(today, minutes) > now ? today : dayAt(today, 1));
  const start = at(on, minutes);
  let end = new Date(start.getTime() + lasts * 60_000);
  if (until) {
    let ends = until.sure ? until.minutes : settled(until, typed);
    // "10 to 2": the end is the next time that clock reads after the start.
    if (ends <= minutes && !until.sure && ends + 720 > minutes) ends += 720;
    end = at(on, ends <= minutes ? ends + 1440 : ends);
  }
  return { title, start, end, allDay: false, ...named };
}
