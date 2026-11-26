/*
 * The formatting examples at the foot of the Language & Region pane: one instant, a number and
 * an amount of money written the way the chosen region and time format write them. The texts
 * are assembled here rather than by Intl, so that they are the captured ones in every browser
 * and time zone; a calendar other than the Gregorian one is Intl's, which knows them all.
 */

export interface Region {
  id: string;
  name: string;
  /** The language tag whose dates are written this way. */
  locale: string;
  /** Whether the day comes before the month in a written date. */
  dayFirst: boolean;
  /** The short date of a year, month and day. */
  shortDate: (year: number, month: number, day: number) => string;
  /** The currency sign before an amount. */
  currency: string;
}

const two = (value: number) => String(value).padStart(2, "0");

const UNITED_STATES: Region = {
  id: "united-states",
  name: "United States",
  locale: "en-US",
  dayFirst: false,
  shortDate: (year, month, day) => `${month}/${day}/${two(year % 100)}`,
  currency: "$",
};

export const REGIONS: readonly Region[] = [
  UNITED_STATES,
  {
    id: "australia",
    name: "Australia",
    locale: "en-AU",
    dayFirst: true,
    shortDate: (year, month, day) => `${day}/${month}/${two(year % 100)}`,
    currency: "$",
  },
  {
    id: "canada",
    name: "Canada",
    locale: "en-CA",
    dayFirst: false,
    shortDate: (year, month, day) => `${year}-${two(month)}-${two(day)}`,
    currency: "$",
  },
  {
    id: "united-kingdom",
    name: "United Kingdom",
    locale: "en-GB",
    dayFirst: true,
    shortDate: (year, month, day) => `${two(day)}/${two(month)}/${year}`,
    currency: "£",
  },
];

/** The pane's calendars by the names Intl knows them by. */
export const CALENDARS: Readonly<Record<string, string>> = {
  Gregorian: "gregory",
  Buddhist: "buddhist",
  Chinese: "chinese",
  Hebrew: "hebrew",
  Islamic: "islamic",
  Japanese: "japanese",
};

/**
 * The region a served desktop's setting means: the one chosen, or what never was chosen, the region
 * of the browser's first language when the list has it. Nothing here claims the United States of
 * someone whose browser says otherwise.
 */
export function servedRegion(stored: unknown, language: string = navigator.language): Region {
  const code = new Intl.Locale(language).region;
  return (
    REGIONS.find((region) => region.id === stored) ??
    REGIONS.find((region) => region.locale.endsWith(`-${code}`)) ??
    UNITED_STATES
  );
}

/** The day and month as the region and calendar set in the pane write them: "3 October". */
export function dayAndMonth(date: Date, region: unknown, calendar: unknown): string {
  return date.toLocaleDateString(servedRegion(region).locale, {
    month: "long",
    day: "numeric",
    calendar: CALENDARS[String(calendar)] ?? "gregory",
  });
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface FormatExamples {
  /** The full date and time: "Thursday, October 3, 2019 at 10:43:31 AM CDT". */
  full: string;
  /** The short date and time: "10/3/19, 10:43 AM". */
  short: string;
  /** A number with a thousands separator and decimals. */
  number: string;
  /** An amount of money. */
  currency: string;
}

/**
 * The examples for a local time written as `2019-10-03T10:43:31`. The time zone is written as
 * given, the captures' by default, and is not converted. A calendar other than the Gregorian one
 * writes both dates, as a Mac's examples do.
 */
export function formatExamples(
  instant: string,
  region: Region,
  twentyFourHour: boolean,
  zone = "CDT",
  calendar = "Gregorian",
): FormatExamples {
  const [year = 2019, month = 1, day = 1, hour = 0, minute = 0, second = 0] = instant
    .split(/\D/)
    .map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const monthName = MONTHS[month - 1];
  const date = region.dayFirst ? `${day} ${monthName} ${year}` : `${monthName} ${day}, ${year}`;
  const clock = twentyFourHour ? two(hour) : String(hour % 12 || 12);
  const suffix = twentyFourHour ? "" : hour < 12 ? " AM" : " PM";
  const other = calendar === "Gregorian" ? undefined : CALENDARS[calendar];
  const written = (options: Intl.DateTimeFormatOptions) =>
    new Date(year, month - 1, day).toLocaleDateString(region.locale, {
      ...options,
      calendar: other,
    });
  const fullDate = other
    ? written({ weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : `${weekday}, ${date}`;
  const shortDate = other
    ? written({ year: "numeric", month: "numeric", day: "numeric" })
    : region.shortDate(year, month, day);
  return {
    full: `${fullDate} at ${clock}:${two(minute)}:${two(second)}${suffix} ${zone}`,
    short: `${shortDate}, ${clock}:${two(minute)}${suffix}`,
    number: "1,234.56",
    currency: `${region.currency}4,567.89`,
  };
}
