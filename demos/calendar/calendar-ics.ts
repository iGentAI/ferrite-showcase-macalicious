import type { CalendarEntry, RepeatRule } from "./calendar-data";
import { nearestStart, startOnDate } from "./calendar-recurrence";

/*
 * iCalendar files (RFC 5545), read and written in the browser: Calendar's Import and Export.
 * Nothing here touches the page or the network, so every rule is checked by known answers in
 * calendar-ics.test.ts.
 *
 * Reading takes every VEVENT of every VCALENDAR in the file: its SUMMARY, LOCATION,
 * DESCRIPTION and URL, its DTSTART and DTEND (or DURATION) as a date, a UTC time, a time in a
 * named zone (TZID) or a floating time, and its RRULE and EXDATE where Calendar keeps that kind
 * of repeat. A zone is found by its IANA name, by the X-LIC-LOCATION of its VTIMEZONE, or by the
 * VTIMEZONE's own rules; a zone none of those names is read as the browser's local time and
 * reported. A repeat Calendar cannot keep (by position in the month, several months, RDATE)
 * makes the event a single one, also reported, as is a text cut to Calendar's lengths. A changed
 * occurrence (RECURRENCE-ID) becomes an event of its own and is removed from its series; a
 * cancelled one is only removed. Every other component and property is passed over, and a line
 * that cannot be read is skipped: no file makes the reader throw.
 *
 * Writing makes one VCALENDAR: an all-day event with DATE values, a timed event in UTC, and a
 * timed repeating event in its own zone (or, without one, the browser's) with a VTIMEZONE for
 * each zone written, so that its occurrences keep their time of day across daylight saving time
 * as they do in Calendar. Text is escaped, lines end in CRLF and are folded at 75 octets.
 */

/** The media type of an iCalendar file. */
export const ICS_TYPE = "text/calendar";

/** What Calendar's module keeps (`model.rs`): longer texts are cut on import. */
export const ICS_LIMITS = {
  title: 200,
  location: 200,
  notes: 5000,
  url: 2048,
  exdates: 200,
} as const;

/** One event read from a file, before it is given a calendar and an id. */
export interface IcsEvent {
  /** The event's UID, with the RECURRENCE-ID of a changed occurrence: who it is, for a re-import. */
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  location?: string;
  notes?: string;
  url?: string;
  repeat?: RepeatRule;
  exdates?: number[];
  /** The IANA zone a timed repeating event is written in (its TZID), or "UTC". */
  timeZone?: string;
  /** Minutes before the start its first alarm shows (negative: after it). */
  alert?: number;
  /** TRANSP:TRANSPARENT: it leaves the person free. */
  showAs?: "free";
  /** Minutes of travel before it (X-APPLE-TRAVEL-DURATION). */
  travelTime?: number;
}

/** What a file holds for Calendar. */
export interface IcsImport {
  /** The calendar's name, from X-WR-CALNAME, when the file gives one. */
  name?: string;
  events: IcsEvent[];
  /** VEVENTs left out: no start that can be read, an end out of range, or cancelled. */
  skipped: number;
  /** Events whose repeat Calendar does not keep, imported as their first occurrence. */
  simplified: number;
  /** Repeating events with more removed occurrences than Calendar keeps: the later come back. */
  crowded: number;
  /** Events with a text longer than Calendar keeps, cut to its length. */
  shortened: number;
  /** TZIDs nothing in the file or the browser explains, whose times were read as local time. */
  unknownZones: string[];
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface Component {
  name: string;
  props: Property[];
  children: Component[];
}

/** The most components a file may hold before the rest are passed over: a guard against a runaway file. */
const MAX_COMPONENTS = 20_000;
/** The deepest nesting read: a calendar, an event, an alarm, and room to spare. */
const MAX_DEPTH = 8;
/** Instants a JavaScript `Date` holds. */
const MAX_ABS_MS = 8.64e15;
/** No event lasts longer than ten years (`MAX_DURATION_MS` in the module). */
const MAX_DURATION_MS = 10 * 366 * 86_400_000;
const DAY_MS = 86_400_000;
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

// ---------------------------------------------------------------------------------------------
// Content lines

/** The logical lines of `text`: a line that starts with a space or a tab continues the last. */
export function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const physical of text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)) {
    if ((physical.startsWith(" ") || physical.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += physical.slice(1);
    } else if (physical !== "") lines.push(physical);
  }
  return lines;
}

/** One content line as name, parameters and value; `null` for a line that is not one. */
export function parseLine(line: string): Property | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') quoted = !quoted;
    else if (char === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  // The name, then `;NAME=value` parameters, any value of which may be quoted.
  const pieces: string[] = [];
  let current = "";
  quoted = false;
  for (const char of head) {
    if (char === '"') quoted = !quoted;
    if (char === ";" && !quoted) {
      pieces.push(current);
      current = "";
    } else current += char;
  }
  pieces.push(current);
  const name = (pieces.shift() ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(name)) return null;
  const params: Record<string, string> = {};
  for (const piece of pieces) {
    const equals = piece.indexOf("=");
    if (equals <= 0) continue;
    const key = piece.slice(0, equals).trim().toUpperCase();
    params[key] = piece
      .slice(equals + 1)
      .split(",")
      .map((part) => part.replace(/^"(.*)"$/, "$1"))
      .join(",");
  }
  return { name, params, value };
}

/** The components of the file, nested as written; a BEGIN without its END ends with the file. */
function components(text: string): Component[] {
  const top: Component[] = [];
  const stack: Component[] = [];
  let count = 0;
  let ignored = 0;
  for (const line of unfold(text)) {
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === "BEGIN") {
      count += 1;
      if (count > MAX_COMPONENTS) break;
      // Deeper than any calendar nests: passed over, with all it holds.
      if (stack.length >= MAX_DEPTH || ignored > 0) {
        ignored += 1;
        continue;
      }
      const component: Component = {
        name: prop.value.trim().toUpperCase(),
        props: [],
        children: [],
      };
      (stack.at(-1)?.children ?? top).push(component);
      stack.push(component);
    } else if (prop.name === "END") {
      if (ignored > 0) {
        ignored -= 1;
        continue;
      }
      const name = prop.value.trim().toUpperCase();
      // An END closes the innermost component of its name, and any left open inside it.
      for (let at = stack.length - 1; at >= 0; at -= 1) {
        if (stack[at]?.name === name) {
          stack.length = at;
          break;
        }
      }
    } else if (ignored === 0) stack.at(-1)?.props.push(prop);
  }
  return top;
}

const first = (component: Component, name: string) =>
  component.props.find((prop) => prop.name === name);
const all = (component: Component, name: string) =>
  component.props.filter((prop) => prop.name === name);

/** A TEXT value as written: `\\`, `\;`, `\,` and `\n` (or `\N`) undone. */
export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, char: string) =>
    char === "n" || char === "N" ? "\n" : char,
  );
}

/** `text` as a TEXT value: backslashes, semicolons, commas and line breaks escaped. */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

const encoder = new TextEncoder();

/** A content line folded so that no line is longer than 75 octets, a character never split. */
export function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // The first line holds 75 octets; each continuation, after its space, 74.
    const limit = out.length === 0 ? 75 : 74;
    if (octets + size > limit) {
      out.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

// ---------------------------------------------------------------------------------------------
// Dates and zones

/** A date or time as written. */
type Written =
  | { kind: "date"; y: number; m: number; d: number }
  | { kind: "utc"; ms: number }
  | { kind: "local"; y: number; m: number; d: number; h: number; mi: number; s: number };

/** A DATE or DATE-TIME value; `null` when it is neither. */
function readTime(value: string): Written | null {
  const text = value.trim();
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (date) {
    const [y, m, d] = [Number(date[1]), Number(date[2]), Number(date[3])];
    return validDay(y, m, d) ? { kind: "date", y, m, d } : null;
  }
  const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/i.exec(text);
  if (!time) return null;
  const [y, m, d, h, mi, s] = time.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  // A leap second is read as the second before it.
  if (!validDay(y, m, d) || h > 23 || mi > 59 || s > 60) return null;
  const second = Math.min(s, 59);
  if (time[7]) {
    const at = new Date(0);
    at.setUTCFullYear(y, m - 1, d);
    at.setUTCHours(h, mi, second, 0);
    return { kind: "utc", ms: at.getTime() };
  }
  return { kind: "local", y, m, d, h, mi, s: second };
}

const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The days of month `m` (1 to 12) of year `y`. */
const daysIn = (y: number, m: number) =>
  m === 2 ? (leap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;

const validDay = (y: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);

/** A local date and time in this browser's zone. */
function localDate(y: number, m: number, d: number, h = 0, mi = 0, s = 0): Date {
  const date = new Date(2000, 0, 1, h, mi, s);
  date.setFullYear(y, m - 1, d);
  // Setting the day can cross a change of the clocks: set the time once more on that day.
  date.setHours(h, mi, s, 0);
  return date;
}

/** A zone: its offset from UTC, in milliseconds, at an instant. */
type Offsets = (ms: number) => number;
/** Turns a wall-clock time in some zone into an instant. */
type Zone = (y: number, m: number, d: number, h: number, mi: number, s: number) => number;

/** The longest TZID looked up; a longer one is a zone nobody knows. */
const MAX_TZID = 200;
/** The most RDATE onsets read of one VTIMEZONE, and the most observances. */
const MAX_ONSETS = 1000;
const MAX_OBSERVANCES = 50;
/** The most zones of one file that are looked up in the browser's own. */
const MAX_ZONES_ASKED = 50;

/**
 * The instant of a wall-clock reading in a zone, as RFC 5545 (3.3.5) reads it: a reading the
 * clocks skip takes the offset in force before the change, and one they repeat is the first.
 */
function zoneOf(offsets: Offsets): Zone {
  return (y, m, d, h, mi, s) => {
    const wall = utcOf(y, m, d, h, mi, s);
    const before = offsets(wall - DAY_MS);
    const after = offsets(wall + DAY_MS);
    const readings = [before, after]
      .filter((offset) => offsets(wall - offset) === offset)
      .map((offset) => wall - offset);
    return readings.length > 0 ? Math.min(...readings) : wall - before;
  };
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();

/** A formatter for the IANA zone `name`, or `null` when the browser does not know it. */
function formatterFor(name: string): Intl.DateTimeFormat | null {
  if (!formatters.has(name)) {
    try {
      formatters.set(
        name,
        new Intl.DateTimeFormat("en-US", {
          timeZone: name,
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
      // A name the browser does not know is remembered only while few are.
      if (formatters.size < MAX_REMEMBERED) formatters.set(name, null);
      return null;
    }
  }
  return formatters.get(name) ?? null;
}

/** The offset (ms ahead of UTC) of the zone `format` shows, at instant `ms`. */
function offsetAt(format: Intl.DateTimeFormat, ms: number): number {
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(new Date(ms))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const wall = utcOf(
    parts.year ?? 1970,
    parts.month ?? 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  // Whole seconds: the instant may carry milliseconds the parts do not.
  return wall - (ms - (((ms % 1000) + 1000) % 1000));
}

function utcOf(y: number, m: number, d: number, h: number, mi: number, s: number): number {
  const at = new Date(0);
  at.setUTCFullYear(y, m - 1, d);
  at.setUTCHours(h, mi, s, 0);
  return at.getTime();
}

/** The most zones a page remembers the browser does or does not know. */
const MAX_REMEMBERED = 200;

/** An IANA zone the browser knows by `tzid` or the end of it ("/mozilla.org/…/Europe/Paris"). */
function knownZone(tzid: string): Intl.DateTimeFormat | null {
  if (tzid.length > MAX_TZID) return null;
  // The last segments only: a zone's name has at most three.
  const segments = tzid.trim().replace(/^\/+/, "").split("/").filter(Boolean).slice(-4);
  for (let from = 0; from < segments.length; from += 1) {
    const name = segments.slice(from).join("/");
    // A bare word ("Pacific Standard Time") is no IANA name, except UTC and its spellings.
    if (!name.includes("/") && !/^(UTC|GMT|Z)$/i.test(name)) continue;
    const format = formatterFor(/^Z$/i.test(name) ? "UTC" : name);
    if (format) return format;
  }
  return null;
}

/** A yearly change of a VTIMEZONE: a weekday of a month, by its place or after a day. */
interface YearlyRule {
  month: number;
  weekday: number;
  /**
   * Its place in the month (1 the first, -1 the last), or the first on or after `fromDay`, or on
   * or after the day `fromLast` days before the month's end (counting the last as 1).
   */
  nth?: number;
  fromDay?: number;
  fromLast?: number;
  /** The last instant it may begin. */
  until?: number;
}

/** One STANDARD or DAYLIGHT of a VTIMEZONE: when it begins, and the offsets either side. */
interface Observance {
  from: number;
  to: number;
  /** The first onset, as a wall-clock reading in the offset before it (`from`). */
  start: Written & { kind: "local" };
  rule?: YearlyRule;
  /** Further onsets (RDATE), as wall-clock readings. */
  dates: (Written & { kind: "local" })[];
}

/** `+HHMM` or `-HHMMSS` as milliseconds; `null` when it is not an offset. */
function readOffset(value: string | undefined): number | null {
  const match = /^([+-])(\d{2})(\d{2})(\d{2})?$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const ms = (Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] ?? 0)) * 1000;
  return match[1] === "-" ? -ms : ms;
}

/** The yearly rule of a VTIMEZONE observance, when it is one this reader follows. */
function yearlyRule(value: string): YearlyRule | undefined {
  const parts = ruleParts(value);
  const day = /^([+-]?\d)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(parts.BYDAY?.toUpperCase() ?? "");
  const month = Number(parts.BYMONTH);
  if (parts.FREQ?.toUpperCase() !== "YEARLY" || !day || !(month >= 1 && month <= 12)) {
    return undefined;
  }
  // A rule that stops after so many years, or skips years, is not followed.
  if (parts.COUNT !== undefined || (parts.INTERVAL !== undefined && parts.INTERVAL !== "1")) {
    return undefined;
  }
  const weekday = WEEKDAYS.indexOf(day[2] as (typeof WEEKDAYS)[number]);
  const until = readTime(parts.UNTIL ?? "");
  const rule: YearlyRule = {
    month,
    weekday,
    // An UNTIL in local time is read as UTC: an hour or two either way of a change years off.
    until: until?.kind === "utc" ? until.ms : until?.kind === "local" ? wallMs(until) : undefined,
  };
  if (day[1]) {
    const nth = Number(day[1]);
    if (nth === 0 || nth < -5 || nth > 5) return undefined;
    rule.nth = nth;
  } else {
    // An older form: the weekday among seven days of the month ("BYMONTHDAY=8,9,…,14", or
    // "-7,…,-1" for the last seven).
    const days = (parts.BYMONTHDAY ?? "").split(",").map(Number);
    if (days.length > 0 && days.every((each) => each >= -31 && each <= -1)) {
      rule.fromLast = -Math.min(...days);
    } else {
      const fromDay = Math.min(...days);
      if (!(fromDay >= 1 && fromDay <= 31)) return undefined;
      rule.fromDay = fromDay;
    }
  }
  return rule;
}

function observances(timezone: Component): Observance[] {
  const out: Observance[] = [];
  let onsets = 0;
  for (const child of timezone.children) {
    if (out.length >= MAX_OBSERVANCES) break;
    if (child.name !== "STANDARD" && child.name !== "DAYLIGHT") continue;
    const from = readOffset(first(child, "TZOFFSETFROM")?.value);
    const to = readOffset(first(child, "TZOFFSETTO")?.value);
    const start = readTime(first(child, "DTSTART")?.value ?? "");
    if (from === null || to === null || start?.kind !== "local") continue;
    const observance: Observance = { from, to, start, dates: [] };
    const rrule = first(child, "RRULE");
    if (rrule) observance.rule = yearlyRule(rrule.value);
    for (const rdate of all(child, "RDATE")) {
      for (const value of rdate.value.split(",")) {
        if (onsets >= MAX_ONSETS) break;
        const date = readTime(value);
        if (date?.kind === "local") {
          observance.dates.push(date);
          onsets += 1;
        }
      }
    }
    out.push(observance);
  }
  return out;
}

/** The day of `month` in `year` that `rule` names. */
function ruleDay(year: number, rule: YearlyRule): number {
  const days = daysIn(year, rule.month);
  const firstDay = new Date(utcOf(year, rule.month, 1, 0, 0, 0)).getUTCDay();
  const from = rule.fromDay ?? (rule.fromLast !== undefined ? days - rule.fromLast + 1 : undefined);
  if (from !== undefined) {
    const weekdayOf = (firstDay + from - 1) % 7;
    return Math.min(days, Math.max(1, from) + ((rule.weekday - weekdayOf + 7) % 7));
  }
  const nth = rule.nth ?? 1;
  if (nth > 0) {
    const day = 1 + ((rule.weekday - firstDay + 7) % 7) + (nth - 1) * 7;
    // A fifth weekday a month lacks is its last.
    return day > days ? day - 7 : day;
  }
  const lastDay = (firstDay + days - 1) % 7;
  const day = days - ((lastDay - rule.weekday + 7) % 7) + (nth + 1) * 7;
  return day < 1 ? day + 7 : day;
}

const wallMs = (time: Written & { kind: "local" }) =>
  utcOf(time.y, time.m, time.d, time.h, time.mi, time.s);

/** A VTIMEZONE's offsets, from its own observances: those of the latest change at or before. */
function ruleOffsets(list: Observance[]): Offsets | null {
  if (list.length === 0) return null;
  // Every onset that is a date, as an instant, once, in order.
  const fixed: { at: number; to: number }[] = [];
  for (const observance of list) {
    for (const time of [observance.start, ...observance.dates]) {
      fixed.push({ at: wallMs(time) - observance.from, to: observance.to });
    }
  }
  fixed.sort((a, b) => a.at - b.at);
  const earliest = list.reduce((a, b) => (wallMs(b.start) < wallMs(a.start) ? b : a));
  return (ms) => {
    let best: { at: number; to: number } | undefined;
    // The last fixed onset at or before `ms`.
    let low = 0;
    let high = fixed.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const onset = fixed[middle] as { at: number; to: number };
      if (onset.at <= ms) {
        best = onset;
        low = middle + 1;
      } else high = middle - 1;
    }
    const year = new Date(ms).getUTCFullYear();
    for (const observance of list) {
      const rule = observance.rule;
      if (!rule) continue;
      const begins = wallMs(observance.start) - observance.from;
      for (const each of [year - 1, year, year + 1]) {
        const day = ruleDay(each, rule);
        const { h, mi, s } = observance.start;
        const at = utcOf(each, rule.month, day, h, mi, s) - observance.from;
        if (at < begins || at > ms || (rule.until !== undefined && at > rule.until)) continue;
        if (!best || at > best.at) best = { at, to: observance.to };
      }
    }
    return best?.to ?? earliest.from;
  };
}

/** Every zone the file's VTIMEZONEs define, by TZID. */
function zonesOf(calendar: Component, budget: { asked: number }): Map<string, Zone | null> {
  const zones = new Map<string, Zone | null>();
  for (const child of calendar.children) {
    if (child.name !== "VTIMEZONE") continue;
    const tzid = first(child, "TZID")?.value.trim();
    if (!tzid || tzid.length > MAX_TZID || zones.has(tzid)) continue;
    const ask = (name: string) => (budget.asked++ < MAX_ZONES_ASKED ? knownZone(name) : null);
    const location = first(child, "X-LIC-LOCATION")?.value.trim();
    const named = ask(tzid) ?? (location ? ask(location) : null);
    const offsets = named ? (ms: number) => offsetAt(named, ms) : ruleOffsets(observances(child));
    if (offsets) zones.set(tzid, zoneOf(offsets));
  }
  return zones;
}

/** The day a written time falls on where it was written: its own date, or its UTC date. */
function writtenDay(time: Written): number {
  if (time.kind === "utc") {
    const at = new Date(time.ms);
    return Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  }
  return utcOf(time.y, time.m, time.d, 0, 0, 0);
}

/** The day an instant falls on in the browser's zone, as a UTC midnight. */
function localDay(ms: number): number {
  const at = new Date(ms);
  return utcOf(at.getFullYear(), at.getMonth() + 1, at.getDate(), 0, 0, 0);
}

/** Reads the times of one calendar: its zones, and the zones it names but does not define. */
class Clock {
  constructor(
    private readonly zones: Map<string, Zone | null>,
    private readonly unknown: Set<string>,
    /** The zones of the whole file looked up in the browser's: past a few, none is. */
    private readonly budget: { asked: number },
  ) {}

  /** The zone a TZID names: the file's own, else the browser's; `null` for local time. */
  private zone(tzid: string | undefined): Zone | null {
    if (!tzid) return null;
    const own = this.zones.get(tzid);
    if (own !== undefined) return own;
    const known = this.budget.asked++ < MAX_ZONES_ASKED ? knownZone(tzid) : null;
    const zone = known ? zoneOf((ms) => offsetAt(known, ms)) : null;
    // An unknown zone is remembered too, so it is looked up once.
    this.zones.set(tzid, zone);
    if (!zone && this.unknown.size < 20) this.unknown.add([...tzid].slice(0, 60).join(""));
    return zone;
  }

  /** The instant of a written time; a date is its first moment in local time. */
  instant(time: Written, tzid?: string): number {
    if (time.kind === "utc") return time.ms;
    if (time.kind === "date") return localDate(time.y, time.m, time.d).getTime();
    const zone = this.zone(tzid);
    return zone
      ? zone(time.y, time.m, time.d, time.h, time.mi, time.s)
      : localDate(time.y, time.m, time.d, time.h, time.mi, time.s).getTime();
  }
}

// ---------------------------------------------------------------------------------------------
// Reading

/** `NAME=value` parts of a recurrence rule, names in capitals. */
function ruleParts(value: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of value.split(";")) {
    const equals = part.indexOf("=");
    if (equals > 0)
      parts[part.slice(0, equals).trim().toUpperCase()] = part.slice(equals + 1).trim();
  }
  return parts;
}

/** What a rule is read against: the event's start, here and as written. */
interface RuleContext {
  /** The start in the browser's zone. */
  start: Date;
  /** DTSTART as written, and its zone. */
  written: Written;
  tzid?: string;
  /** The IANA zone the event goes on repeating in, when it keeps one. */
  zone?: string;
  allDay: boolean;
  clock: Clock;
}

/**
 * The repeat Calendar keeps for an RRULE, or `null` when it keeps no such repeat: a daily,
 * weekly (on plain weekdays), monthly (on the start's day) or yearly (on the start's date)
 * rule, every 1 to 99, ending after 1 to 999 occurrences, at an instant, or never.
 *
 * A rule's weekdays and days of the month are those of the zone DTSTART is written in. An event
 * that keeps that zone repeats in it, so they stay as written. One in a zone the browser cannot
 * name repeats in the browser's: where the start falls on another day here, a weekly rule's days
 * move with it, and a monthly or yearly one is kept only when every month has both days (the 28th
 * or before, in the same month), since otherwise the two would differ.
 */
function readRule(value: string, at: RuleContext): RepeatRule | null {
  const parts = ruleParts(value);
  const freq = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" }[
    parts.FREQ?.toUpperCase() ?? ""
  ] as RepeatRule["freq"] | undefined;
  if (!freq) return null;
  const known = new Set([
    "FREQ",
    "INTERVAL",
    "COUNT",
    "UNTIL",
    "BYDAY",
    "BYMONTHDAY",
    "BYMONTH",
    "WKST",
  ]);
  if (Object.keys(parts).some((key) => !known.has(key))) return null;
  const source = new Date(writtenDay(at.written));
  const shift =
    at.allDay || at.zone
      ? 0
      : Math.round((localDay(at.start.getTime()) - source.getTime()) / DAY_MS);
  const rule: RepeatRule = { freq };
  if (parts.INTERVAL !== undefined) {
    const interval = Number(parts.INTERVAL);
    if (!Number.isInteger(interval) || interval < 1 || interval > 99) return null;
    if (interval > 1) rule.interval = interval;
  }
  if (parts.COUNT !== undefined && parts.UNTIL !== undefined) return null;
  if (parts.COUNT !== undefined) {
    const count = Number(parts.COUNT);
    if (!Number.isInteger(count) || count < 1 || count > 999) return null;
    rule.count = count;
  }
  if (parts.UNTIL !== undefined) {
    const until = readTime(parts.UNTIL);
    if (!until) return null;
    // A date ends the repeat with its day: an occurrence may start on it, none after.
    rule.until =
      until.kind === "date"
        ? localDate(until.y, until.m, until.d + 1).getTime() - 1
        : at.clock.instant(until, at.tzid);
    if (!(Math.abs(rule.until) <= MAX_ABS_MS)) return null;
    // A repeat that ends before it begins has no second occurrence.
    if (rule.until < at.start.getTime()) return null;
  }
  if (parts.BYDAY !== undefined) {
    // Every day but some, as Google writes "every weekday": the same as a weekly repeat.
    if (freq === "daily" && rule.interval === undefined) rule.freq = "weekly";
    if (rule.freq !== "weekly") return null;
    const days = parts.BYDAY.split(",").map((day) =>
      WEEKDAYS.indexOf(day.trim().toUpperCase() as (typeof WEEKDAYS)[number]),
    );
    if (days.some((day) => day < 0)) return null;
    rule.days = [...new Set(days.map((day) => (((day + shift) % 7) + 7) % 7))].sort(
      (a, b) => a - b,
    );
  }
  const day = source.getUTCDate();
  const month = source.getUTCMonth() + 1;
  if (parts.BYMONTHDAY !== undefined) {
    // A yearly rule with days of the month but no month repeats every month.
    const fits = freq === "monthly" || (freq === "yearly" && parts.BYMONTH !== undefined);
    if (!fits || Number(parts.BYMONTHDAY) !== day) return null;
  }
  if (parts.BYMONTH !== undefined) {
    if (freq !== "yearly" || Number(parts.BYMONTH) !== month) return null;
  }
  if (
    shift !== 0 &&
    (freq === "monthly" || freq === "yearly") &&
    (at.start.getMonth() + 1 !== month || day > 28 || at.start.getDate() > 28)
  ) {
    return null;
  }
  // A rule on set days that skips weeks groups its days into weeks that begin on its WKST (Monday
  // unless it says), Calendar's on Sunday: the two agree only when each day falls in the same week
  // as the start, or the week after, under both.
  if (rule.freq === "weekly" && (rule.interval ?? 1) > 1 && rule.days?.length) {
    const wkst = WEEKDAYS.indexOf((parts.WKST ?? "MO").toUpperCase() as (typeof WEEKDAYS)[number]);
    if (wkst < 0) return null;
    const written = source.getUTCDay();
    const here = (((written + shift) % 7) + 7) % 7;
    const place = (day: number, from: number) => (day - from + 7) % 7;
    const agrees = (rule.days ?? []).every((local) => {
      const day = (((local - shift) % 7) + 7) % 7;
      return place(day, wkst) >= place(written, wkst) === place(local, 0) >= place(here, 0);
    });
    if (!agrees) return null;
  }
  // An all-day repeat ends with a day's last moment.
  if (at.allDay && rule.until !== undefined) {
    const last = new Date(rule.until);
    rule.until =
      localDate(last.getFullYear(), last.getMonth() + 1, last.getDate() + 1).getTime() - 1;
  }
  return rule;
}

/** A DURATION value (`P1DT2H`, `-PT15M`, `P2W`) in milliseconds; `null` when it is not one. */
export function readDuration(value: string): number | null {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(
    value.trim(),
  );
  if (!match || value.trim().replace(/^[+-]/, "").toUpperCase() === "P") return null;
  const [, sign, w, d, h, m, s] = match;
  const ms =
    ((Number(w ?? 0) * 7 + Number(d ?? 0)) * 86_400 +
      Number(h ?? 0) * 3600 +
      Number(m ?? 0) * 60 +
      Number(s ?? 0)) *
    1000;
  return sign === "-" ? -ms : ms;
}

/** A text property, unescaped and trimmed, cut to `max` characters; `undefined` when empty. */
function text(
  component: Component,
  name: string,
  max: number,
  cut: () => void,
): string | undefined {
  const prop = first(component, name);
  if (!prop) return undefined;
  const value = (name === "URL" ? prop.value : unescapeText(prop.value)).trim();
  if (!value) return undefined;
  const chars = [...value];
  if (chars.length <= max) return value;
  cut();
  return chars.slice(0, max).join("").trimEnd();
}

/** The most EXDATE values read of one event. */
const MAX_EXDATES_READ = 1000;

/** What reading a file counts, and the events whose removed occurrences were cut. */
interface Counts {
  simplified: number;
  shortened: number;
  crowded: Set<IcsEvent>;
  /** EXDATE values read so far in the file. */
  exdates: number;
}

/** The most EXDATE values read of one file. */
const MAX_FILE_EXDATES = 20_000;

interface Read {
  uid: string;
  recurrenceId?: number;
  cancelled: boolean;
  event: IcsEvent | null;
}

/** One VEVENT as Calendar keeps it, or `null` (with `event` null) when it cannot be read. */
function readEvent(vevent: Component, clock: Clock, counts: Counts): Read {
  const dtstart = first(vevent, "DTSTART");
  // Without a UID, the event is known by what it is, so the same file imports it once.
  const uid =
    first(vevent, "UID")?.value.trim() ||
    `no-uid:${first(vevent, "SUMMARY")?.value ?? ""}|${dtstart?.params.TZID ?? ""}:${dtstart?.value ?? ""}|${first(vevent, "DTEND")?.value ?? ""}`;
  const cancelled = first(vevent, "STATUS")?.value.trim().toUpperCase() === "CANCELLED";
  const recurrence = first(vevent, "RECURRENCE-ID");
  const recurrenceTime = recurrence ? readTime(recurrence.value) : null;
  const recurrenceId = recurrenceTime
    ? clock.instant(recurrenceTime, recurrence?.params.TZID)
    : undefined;
  const none = { uid, recurrenceId, cancelled, event: null };
  const start = dtstart ? readTime(dtstart.value) : null;
  if (!dtstart || !start) return none;
  const allDay = start.kind === "date";
  const startMs = clock.instant(start, dtstart.params.TZID);
  let endMs: number | undefined;
  const dtend = first(vevent, "DTEND");
  const end = dtend ? readTime(dtend.value) : null;
  if (dtend && end && (end.kind === "date") === allDay)
    endMs = clock.instant(end, dtend.params.TZID);
  else {
    const duration = readDuration(first(vevent, "DURATION")?.value ?? "");
    if (duration !== null && duration >= 0) {
      if (allDay) {
        const begins = new Date(startMs);
        endMs = localDate(
          begins.getFullYear(),
          begins.getMonth() + 1,
          begins.getDate() + Math.max(1, Math.round(duration / DAY_MS)),
        ).getTime();
      } else endMs = startMs + duration;
    }
  }
  if (endMs === undefined) {
    // No end: a date lasts its day, a time is a moment.
    const begins = new Date(startMs);
    endMs = allDay
      ? localDate(begins.getFullYear(), begins.getMonth() + 1, begins.getDate() + 1).getTime()
      : startMs;
  }
  if (allDay && endMs <= startMs) {
    const begins = new Date(startMs);
    endMs = localDate(begins.getFullYear(), begins.getMonth() + 1, begins.getDate() + 1).getTime();
  }
  if (endMs < startMs) endMs = startMs;
  if (
    !(Math.abs(startMs) <= MAX_ABS_MS && Math.abs(endMs) <= MAX_ABS_MS) ||
    endMs - startMs > MAX_DURATION_MS
  ) {
    return none;
  }
  let shortened = false;
  const cut = () => {
    shortened = true;
  };
  const event: IcsEvent = {
    // A changed occurrence is known by its series and the occurrence as the file writes it.
    uid: recurrence ? `${uid}@${recurrence.params.TZID ?? ""}:${recurrence.value.trim()}` : uid,
    title: text(vevent, "SUMMARY", ICS_LIMITS.title, cut) ?? "New Event",
    start: new Date(startMs),
    end: new Date(endMs),
  };
  if (allDay) event.allDay = true;
  const location = text(vevent, "LOCATION", ICS_LIMITS.location, cut);
  const notes = text(vevent, "DESCRIPTION", ICS_LIMITS.notes, cut);
  const url = text(vevent, "URL", ICS_LIMITS.url, cut);
  if (location) event.location = location;
  if (notes) event.notes = notes;
  if (url) event.url = url;
  // What Calendar's module keeps: an alert from four weeks before to a day after, travel up to a day.
  const alarm = vevent.children.find(
    (child) =>
      child.name === "VALARM" &&
      first(child, "TRIGGER")?.params.VALUE?.toUpperCase() !== "DATE-TIME",
  );
  const trigger = alarm ? readDuration(first(alarm, "TRIGGER")?.value ?? "") : null;
  if (trigger !== null) {
    const alert = Math.round(-trigger / 60_000);
    if (alert >= -1_440 && alert <= 40_320) event.alert = alert === 0 ? 0 : alert;
  }
  if (first(vevent, "TRANSP")?.value.trim().toUpperCase() === "TRANSPARENT") event.showAs = "free";
  const travel = readDuration(first(vevent, "X-APPLE-TRAVEL-DURATION")?.value ?? "");
  if (travel !== null && travel > 0 && travel <= DAY_MS)
    event.travelTime = Math.round(travel / 60_000);
  const rrules = all(vevent, "RRULE");
  // A changed occurrence is one occurrence, whatever rule it repeats.
  if (recurrenceId === undefined && rrules.length > 0) {
    // A timed repeat goes on repeating in the zone the file writes it in: its TZID when the
    // browser knows that zone by name, UTC for a UTC start; a floating one has no zone, and
    // takes the browser's when it is saved.
    const tzid = dtstart.params.TZID?.trim();
    const zone = allDay
      ? undefined
      : start.kind === "utc"
        ? "UTC"
        : tzid
          ? formatterFor(tzid)
            ? tzid
            : knownZone(tzid)?.resolvedOptions().timeZone
          : undefined;
    const repeat =
      rrules.length === 1
        ? readRule(rrules[0]?.value ?? "", {
            start: event.start,
            written: start,
            tzid: dtstart.params.TZID,
            zone,
            allDay,
            clock,
          })
        : null;
    if (repeat && all(vevent, "RDATE").length === 0) {
      event.repeat = repeat;
      if (zone) event.timeZone = zone;
      const exdates = new Set<number>();
      let read = 0;
      // Removed occurrences past what is read, for the event or the whole file, come back.
      let cut = false;
      for (const exdate of all(vevent, "EXDATE")) {
        for (const value of exdate.value.split(",")) {
          if (read++ >= MAX_EXDATES_READ || counts.exdates++ >= MAX_FILE_EXDATES) {
            cut = true;
            break;
          }
          const time = readTime(value);
          if (!time) continue;
          // A date removes the occurrence that starts on it, at the start's time of day.
          const at =
            time.kind === "date"
              ? allDay
                ? localDate(time.y, time.m, time.d).getTime()
                : startOnDate(event, time.y, time.m, time.d)
              : clock.instant(time, exdate.params.TZID);
          if (Math.abs(at) <= MAX_ABS_MS) exdates.add(nearestStart(event, at));
        }
      }
      if (cut) counts.crowded.add(event);
      if (exdates.size > 0) {
        const sorted = [...exdates].sort((a, b) => a - b);
        // Removed occurrences past what Calendar keeps come back.
        if (sorted.length > ICS_LIMITS.exdates) counts.crowded.add(event);
        event.exdates = sorted.slice(0, ICS_LIMITS.exdates);
      }
    } else counts.simplified += 1;
  } else if (recurrenceId === undefined && all(vevent, "RDATE").length > 0) {
    counts.simplified += 1;
  }
  if (shortened) counts.shortened += 1;
  return { uid, recurrenceId, cancelled, event };
}

/** The events of an iCalendar file, with what was left out or changed on the way. */
export function parseIcs(source: string): IcsImport {
  const result: IcsImport = {
    events: [],
    skipped: 0,
    simplified: 0,
    crowded: 0,
    shortened: 0,
    unknownZones: [],
  };
  const unknown = new Set<string>();
  const budget = { asked: 0 };
  const counts: Counts = { simplified: 0, shortened: 0, crowded: new Set(), exdates: 0 };
  // The UIDs the file's events are given.
  const taken = new Set<string>();
  for (const calendar of components(source)) {
    if (calendar.name !== "VCALENDAR") continue;
    const name = first(calendar, "X-WR-CALNAME");
    if (name && result.name === undefined) {
      const value = unescapeText(name.value).trim();
      if (value) result.name = [...value].slice(0, 64).join("");
    }
    const clock = new Clock(zonesOf(calendar, budget), unknown, budget);
    const read = calendar.children
      .filter((child) => child.name === "VEVENT")
      .map((vevent) => readEvent(vevent, clock, counts));
    // Changed and cancelled occurrences leave their series.
    const series = new Map<string, IcsEvent>();
    for (const each of read) {
      if (each.recurrenceId === undefined && each.event?.repeat && !each.cancelled) {
        series.set(each.uid, each.event);
      }
    }
    for (const each of read) {
      if (each.recurrenceId === undefined) continue;
      const master = series.get(each.uid);
      if (!master?.repeat) continue;
      const exdates = new Set(master.exdates ?? []);
      exdates.add(nearestStart(master, each.recurrenceId));
      const sorted = [...exdates].sort((a, b) => a - b);
      if (sorted.length > ICS_LIMITS.exdates) counts.crowded.add(master);
      master.exdates = sorted.slice(0, ICS_LIMITS.exdates);
    }
    // Two events of a file under one UID (with no RECURRENCE-ID), in one VCALENDAR or two, are
    // two events: the second gets a number no other event of the file has.
    for (const each of read) {
      if (!each.event || each.recurrenceId !== undefined) continue;
      const { uid } = each.event;
      let unique = uid;
      for (let n = 2; taken.has(unique); n += 1) unique = `${uid}#${n}`;
      taken.add(unique);
      each.event.uid = unique;
    }
    for (const each of read) {
      // A cancelled occurrence is its series' removed occurrence, not an event left out.
      if (each.cancelled && each.recurrenceId !== undefined) continue;
      if (!each.event || each.cancelled) result.skipped += 1;
      else result.events.push(each.event);
    }
  }
  result.simplified = counts.simplified;
  result.crowded = counts.crowded.size;
  result.shortened = counts.shortened;
  result.unknownZones = [...unknown].sort();
  return result;
}

// ---------------------------------------------------------------------------------------------
// Writing

const pad = (value: number, size = 2) => String(Math.abs(value)).padStart(size, "0");
const year = (value: number) => (value < 0 ? `-${pad(value, 4)}` : pad(value, 4));

/** The local date of `date`, `YYYYMMDD`. */
const dateValue = (date: Date) =>
  `${year(date.getFullYear())}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
/** The local wall-clock time of `date`, `YYYYMMDDTHHMMSS`. */
const localValue = (date: Date) =>
  `${dateValue(date)}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
/** `date` in UTC, `YYYYMMDDTHHMMSSZ`. */
const utcValue = (date: Date) =>
  `${year(date.getUTCFullYear())}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

const offsetOf = (ms: number) => -new Date(ms).getTimezoneOffset() * 60_000;

/** `+HHMM`, or `+HHMMSS` for an offset of odd seconds. */
function offsetValue(ms: number): string {
  const seconds = Math.round(Math.abs(ms) / 1000);
  const sign = ms < 0 ? "-" : "+";
  const tail = seconds % 60 ? pad(seconds % 60) : "";
  return `${sign}${pad(Math.floor(seconds / 3600))}${pad(Math.floor((seconds % 3600) / 60))}${tail}`;
}

interface Transition {
  /** The first instant of the new offset. */
  at: number;
  from: number;
  to: number;
}

/** The changes of a zone's offset from UTC (this browser's by default) between the start of `from` and the end of `to`. */
export function transitions(
  from: number,
  to: number,
  offsets: (ms: number) => number = offsetOf,
): Transition[] {
  const out: Transition[] = [];
  let at = new Date(from, 0, 1).getTime();
  const end = new Date(to + 1, 0, 1).getTime();
  // Twelve hours apart, so no change is passed over; then down to the minute.
  const STEP = 12 * 3_600_000;
  let offset = offsets(at);
  while (at < end) {
    const next = at + STEP;
    const after = offsets(next);
    if (after !== offset) {
      let low = at;
      let high = next;
      while (high - low > 60_000) {
        const middle = low + Math.floor((high - low) / 120_000) * 60_000;
        if (offsets(middle) === offset) low = middle;
        else high = middle;
      }
      out.push({ at: high, from: offset, to: after });
      offset = after;
    }
    at = next;
  }
  return out;
}

/** The browser's IANA zone, if it names one other than UTC's. */
function browserZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && !utcLike(zone) ? zone : undefined;
  } catch {
    return undefined;
  }
}

/** Whether a zone's name is UTC's, under any of its names. */
const utcLike = (zone: string) =>
  /^(Etc\/)?(UTC|UCT|GMT|Zulu|Universal|Greenwich)([+-]?0)?$/i.test(zone);

/** The offsets of the IANA zone `zone` (ms ahead of UTC), by the browser's own rules for it. */
function zoneOffsets(zone: string): ((ms: number) => number) | null {
  const format = knownZone(zone);
  return format ? (ms) => offsetAt(format, ms) : null;
}

/** The wall-clock time of `date` where `offsets` say, `YYYYMMDDTHHMMSS`. */
function zonedValue(date: Date, offsets: (ms: number) => number): string {
  const wall = new Date(date.getTime() + offsets(date.getTime()));
  return `${year(wall.getUTCFullYear())}${pad(wall.getUTCMonth() + 1)}${pad(wall.getUTCDate())}T${pad(
    wall.getUTCHours(),
  )}${pad(wall.getUTCMinutes())}${pad(wall.getUTCSeconds())}`;
}

/** How many years past the last one written a yearly rule of a VTIMEZONE is checked for. */
const RULE_CHECK_YEARS = 28;

/** A change's onset as the clock read it before the change, and its place in its month. */
function onsetOf(change: Transition) {
  const wall = new Date(change.at + change.from);
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth() + 1;
  const d = wall.getUTCDate();
  return {
    y,
    m,
    d,
    h: wall.getUTCHours(),
    mi: wall.getUTCMinutes(),
    s: wall.getUTCSeconds(),
    weekday: wall.getUTCDay(),
    nth: Math.ceil(d / 7),
    last: d + 7 > daysIn(y, m),
  };
}

type Onset = ReturnType<typeof onsetOf>;
const wallValue = (o: Onset) =>
  `${year(o.y)}${pad(o.m)}${pad(o.d)}T${pad(o.h)}${pad(o.mi)}${pad(o.s)}`;

/**
 * A VTIMEZONE for `zone` (by its `offsets`, this browser's by default) from the start of the
 * year `from`, with its `changes`
 * to the end of the year `to`. Each kind of change that still follows one yearly rule in the
 * last years (the second Sunday of March at 2 AM) is written as that rule, open-ended, as the
 * zone's own rules go on; changes before the rule, and those of a zone that no longer makes
 * them, are written as dates.
 */
function vtimezone(
  zone: string,
  from: number,
  to: number,
  changes: Transition[],
  later: Transition[],
  offsetsAt: (ms: number) => number = offsetOf,
): string[] {
  const lines = ["BEGIN:VTIMEZONE", `TZID:${zone}`];
  const start = new Date(from, 0, 1).getTime();
  const offsets = [offsetsAt(start), ...changes.map((change) => change.to)];
  const standard = Math.min(...offsets);
  const observance = (
    kind: string,
    begins: string,
    before: number,
    after: number,
    more: string[],
  ) =>
    lines.push(
      `BEGIN:${kind}`,
      `DTSTART:${begins}`,
      ...more,
      `TZOFFSETFROM:${offsetValue(before)}`,
      `TZOFFSETTO:${offsetValue(after)}`,
      `END:${kind}`,
    );
  // The offset in force when the years begin.
  const initial = offsets[0] ?? 0;
  const first = new Date(start + initial);
  observance(
    initial === standard ? "STANDARD" : "DAYLIGHT",
    `${year(first.getUTCFullYear())}0101T000000`,
    initial,
    initial,
    [],
  );
  const groups = new Map<string, Transition[]>();
  for (const change of changes) {
    const key = `${change.from}/${change.to}`;
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }
  for (const group of groups.values()) {
    const [head] = group;
    if (!head) continue;
    const kind = head.to > head.from ? "DAYLIGHT" : "STANDARD";
    const onsets = group.map(onsetOf);
    const latest = onsets.at(-1) as Onset;
    // The same change in the years after: the rule is written only if it makes each of them.
    const after = later
      .filter((change) => change.from === head.from && change.to === head.to)
      .map(onsetOf);
    const same = (o: Onset) =>
      o.m === latest.m &&
      o.weekday === latest.weekday &&
      o.h === latest.h &&
      o.mi === latest.mi &&
      o.s === latest.s &&
      (latest.last ? o.last : o.nth === latest.nth);
    let run = 1;
    while (
      run < onsets.length &&
      same(onsets[onsets.length - 1 - run] as Onset) &&
      (onsets[onsets.length - 1 - run] as Onset).y === (onsets[onsets.length - run] as Onset).y - 1
    ) {
      run += 1;
    }
    const dates = (list: Onset[]) =>
      list.length > 1 ? [`RDATE:${list.slice(1).map(wallValue).join(",")}`] : [];
    // A rule kept to the last year looked at, and by each change of the years after, goes on;
    // any other is a list of dates, the later years' changes among them.
    const holds =
      after.length >= RULE_CHECK_YEARS &&
      after.every((o, n) => same(o) && o.y === latest.y + n + 1);
    if (run >= 2 && latest.y >= to && holds) {
      const earlier = onsets.slice(0, onsets.length - run);
      if (earlier[0]) observance(kind, wallValue(earlier[0]), head.from, head.to, dates(earlier));
      const place = latest.last ? -1 : latest.nth;
      observance(kind, wallValue(onsets[onsets.length - run] as Onset), head.from, head.to, [
        `RRULE:FREQ=YEARLY;BYMONTH=${latest.m};BYDAY=${place}${WEEKDAYS[latest.weekday]}`,
      ]);
    } else if (onsets[0]) {
      const all = [...onsets, ...after];
      observance(kind, wallValue(onsets[0]), head.from, head.to, dates(all));
    }
  }
  lines.push("END:VTIMEZONE");
  return lines;
}

export interface WriteOptions {
  /** The calendar's name, written as X-WR-CALNAME. */
  name?: string;
  /** The moment of the export, for DTSTAMP. @default new Date() */
  now?: Date;
}

/** Whether a date can be written: years 0 to 9999, here and in UTC, as RFC 5545's four digits allow. */
const writable = (date: Date) =>
  date.getFullYear() >= 0 &&
  date.getFullYear() <= 9999 &&
  date.getUTCFullYear() >= 0 &&
  date.getUTCFullYear() <= 9999;

/**
 * An iCalendar file of `events` (each event once: a repeating event as its rule, not its
 * occurrences). Each UID is the event's id at `macalicious`. An event past the year 9999 is left
 * out.
 */
export function eventsToIcs(events: readonly CalendarEntry[], options: WriteOptions = {}): string {
  const now = options.now ?? new Date();
  const list = events.filter(
    (event) => !event.series && writable(event.start) && writable(event.end),
  );
  const repeating = list.filter((event) => event.repeat && !event.allDay);
  const years = repeating.map((event) => event.start.getFullYear());
  const from = Math.max(
    years.length ? Math.min(...years) : now.getFullYear(),
    now.getFullYear() - 100,
  );
  // The years scanned for the zone's changes: from the oldest repeat to the newest, within a
  // hundred years before now and fifty after.
  const to = Math.min(Math.max(now.getFullYear(), ...years), now.getFullYear() + 50) + 1;
  // A timed repeat keeps its time of day in its own zone, so it is written in that zone; one
  // without a zone, in the browser's. Without a zone's name it is written in UTC when the browser
  // keeps UTC, else as floating time.
  const zone = browserZone();
  const changes = repeating.length > 0 ? transitions(from, to) : [];
  const mode: "zone" | "utc" | "floating" = zone
    ? "zone"
    : changes.length === 0 && offsetOf(now.getTime()) === 0
      ? "utc"
      : "floating";
  /** How a timed repeat is written: in a named zone (with its offsets), in UTC, or floating. */
  const writing = (
    event: CalendarEntry,
  ): { tzid?: string; offsets?: (ms: number) => number; utc: boolean } => {
    const own = event.timeZone ? zoneOffsets(event.timeZone) : null;
    if (event.timeZone && own) {
      return utcLike(event.timeZone)
        ? { utc: true }
        : { tzid: event.timeZone, offsets: own, utc: false };
    }
    if (mode === "zone" && zone) return { tzid: zone, offsets: offsetOf, utc: false };
    return { utc: mode === "utc" };
  };
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Macalicious//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (options.name) lines.push(`X-WR-CALNAME:${escapeText(options.name)}`);
  // One VTIMEZONE for each zone a repeat is written in.
  const zones = new Map<string, (ms: number) => number>();
  for (const event of repeating) {
    const how = writing(event);
    if (how.tzid && how.offsets && !zones.has(how.tzid)) zones.set(how.tzid, how.offsets);
  }
  for (const [name, offsets] of zones) {
    const own = offsets === offsetOf ? changes : transitions(from, to, offsets);
    const later = transitions(to + 1, to + RULE_CHECK_YEARS, offsets);
    lines.push(...vtimezone(name, from, to, own, later, offsets));
  }
  for (const event of list) {
    const how = event.repeat && !event.allDay ? writing(event) : { utc: true };
    const floating = !how.tzid && !how.utc;
    const value = (date: Date) =>
      event.allDay
        ? dateValue(date)
        : how.tzid && how.offsets
          ? zonedValue(date, how.offsets)
          : how.utc
            ? utcValue(date)
            : localValue(date);
    const kind = event.allDay ? ";VALUE=DATE" : how.tzid ? `;TZID=${how.tzid}` : "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@macalicious`,
      `DTSTAMP:${utcValue(now)}`,
      `DTSTART${kind}:${value(event.start)}`,
      `DTEND${kind}:${value(event.end)}`,
      `SUMMARY:${escapeText(event.title)}`,
    );
    if (event.location?.trim()) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.notes?.trim()) lines.push(`DESCRIPTION:${escapeText(event.notes)}`);
    // A URI is not escaped: what would break the line, or the file, is left out.
    const url = withoutControls(event.url ?? "").trim();
    if (url) lines.push(`URL:${url}`);
    if (event.showAs === "free") lines.push("TRANSP:TRANSPARENT");
    if (event.travelTime) {
      lines.push(`X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT${event.travelTime}M`);
    }
    // A desktop account is no address: the name says who it is, and an import invites nobody.
    for (const name of event.invitees ?? []) {
      lines.push(
        `ATTENDEE;CN="${paramText(name)}":urn:macalicious:account:${encodeURIComponent(name)}`,
      );
    }
    for (const file of event.attachments ?? []) {
      const address = new URL(
        `/api/calendar/attachments/${file.id}`,
        globalThis.location?.href ?? "https://localhost/",
      );
      lines.push(
        `ATTACH;FMTTYPE=${paramText(file.type) || "application/octet-stream"};FILENAME="${paramText(file.name)}":${address.href}`,
      );
    }
    const rule = event.repeat;
    if (rule) {
      const parts = [`FREQ=${rule.freq.toUpperCase()}`];
      if ((rule.interval ?? 1) > 1) parts.push(`INTERVAL=${rule.interval}`);
      if (rule.freq === "weekly" && rule.days?.length) {
        parts.push(`BYDAY=${rule.days.map((day) => WEEKDAYS[day]).join(",")}`);
      }
      const until = rule.until === undefined ? undefined : new Date(rule.until);
      if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
      else if (until && writable(until)) {
        // An all-day repeat ends on a date, a floating one at a floating time (RFC 5545: UNTIL
        // takes DTSTART's value type); one in a zone or UTC ends at a UTC time.
        parts.push(
          `UNTIL=${event.allDay ? dateValue(until) : floating ? localValue(until) : utcValue(until)}`,
        );
      }
      if (rule.freq === "weekly") parts.push("WKST=SU");
      lines.push(`RRULE:${parts.join(";")}`);
      const removed = (event.exdates ?? []).map((at) => new Date(at)).filter(writable);
      if (removed.length > 0) lines.push(`EXDATE${kind}:${removed.map(value).join(",")}`);
    }
    if (event.alert !== undefined) {
      const minutes = Math.abs(event.alert);
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(event.title)}`,
        `TRIGGER:${event.alert > 0 ? "-" : ""}PT${minutes}M`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** `text` as a parameter's quoted value holds it: without quotes or control characters. */
const paramText = (text: string) => withoutControls(text).replaceAll('"', "");

/** `text` without its control characters (line breaks among them). */
const withoutControls = (text: string) =>
  [...text].filter((char) => (char.codePointAt(0) ?? 0) >= 0x20 && char !== "\u007f").join("");

/** A file name for an export of `name`: the characters a file name may not hold are left out. */
export function icsFileName(name: string): string {
  const base = withoutControls(name)
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .slice(0, 100);
  return `${base || "Calendar"}.ics`;
}
