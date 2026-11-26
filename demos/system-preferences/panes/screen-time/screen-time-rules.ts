/**
 * Screen Time's settings on the served desktop, as the account's settings hold them, and what they
 * say about a moment or a day. Nothing here stops an application: the page says so.
 */

export const DOWNTIME_KEY = "screen-time.downtime";
export const APP_LIMITS_KEY = "screen-time.appLimits";
export const ALWAYS_ALLOWED_KEY = "screen-time.alwaysAllowed";
export const CONTENT_PRIVACY_KEY = "screen-time.contentPrivacy";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface DayWindow {
  on: boolean;
  from: string;
  to: string;
}

export interface Downtime {
  on: boolean;
  custom: boolean;
  from: string;
  to: string;
  /** The custom schedule, Sunday first. */
  days: readonly DayWindow[];
}

const FROM = "22:00";
const TO = "07:00";
const isObject = (stored: unknown): stored is Record<string, unknown> =>
  typeof stored === "object" && stored !== null;
const timeOr = (stored: unknown, fallback: string) =>
  typeof stored === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(stored) ? stored : fallback;

export function readDowntime(stored: unknown): Downtime {
  const value = isObject(stored) ? stored : {};
  const days: readonly unknown[] = Array.isArray(value.days) ? value.days : [];
  return {
    on: value.on === true,
    custom: value.custom === true,
    from: timeOr(value.from, FROM),
    to: timeOr(value.to, TO),
    days: DAY_NAMES.map((_, index) => {
      const day = days[index];
      const each = isObject(day) ? day : {};
      return {
        on: each.on !== false,
        from: timeOr(each.from, FROM),
        to: timeOr(each.to, TO),
      };
    }),
  };
}

/** On `date`'s calendar day, at a time written `HH:MM`. */
const at = (date: Date, time: string) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
};

export type DowntimeMoment = { active: true; until: Date } | { active: false; next: Date | null };

/**
 * Whether the schedule covers `now`, and when that next changes. A window whose end is not after
 * its start runs into the next day, so yesterday's may still be open.
 */
export function downtimeAt(downtime: Downtime, now: Date): DowntimeMoment {
  let next: Date | null = null;
  for (let offset = -1; offset <= 7; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const window = downtime.custom
      ? downtime.days[day.getDay()]
      : { on: true, from: downtime.from, to: downtime.to };
    if (!window?.on) continue;
    const start = at(day, window.from);
    let end = at(day, window.to);
    if (end <= start)
      end = at(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1), window.to);
    if (start <= now && now < end) return { active: true, until: end };
    if (start > now && next === null) next = start;
  }
  return { active: false, next };
}

export interface AppLimit {
  id: string;
  apps: readonly string[];
  minutes: number;
  on: boolean;
}

export interface AppLimits {
  on: boolean;
  block: boolean;
  limits: readonly AppLimit[];
}

export function readAppLimits(stored: unknown): AppLimits {
  const value = isObject(stored) ? stored : {};
  const limits: AppLimit[] = [];
  for (const each of Array.isArray(value.limits) ? value.limits : []) {
    if (!isObject(each) || typeof each.id !== "string" || !Array.isArray(each.apps)) continue;
    if (typeof each.minutes !== "number" || each.minutes <= 0) continue;
    limits.push({
      id: each.id,
      apps: each.apps.filter((app): app is string => typeof app === "string"),
      minutes: each.minutes,
      on: each.on !== false,
    });
  }
  return { on: value.on === true, block: value.block !== false, limits };
}

/** The seconds a limit's applications have been in front, of what one day counted. */
export const secondsUsed = (limit: AppLimit, day: Readonly<Record<string, number>> = {}) =>
  limit.apps.reduce((sum, app) => sum + (day[app] ?? 0), 0);

/** Applications a schedule leaves alone until someone changes that: as Catalina first allows. */
export const FIRST_ALLOWED: readonly string[] = ["messages", "facetime", "maps"];

export function readAlwaysAllowed(stored: unknown): readonly string[] {
  return Array.isArray(stored)
    ? stored.filter((app): app is string => typeof app === "string")
    : FIRST_ALLOWED;
}

export type WebContent = "unrestricted" | "limit-adult" | "allowed-only";

export interface ContentPrivacy {
  on: boolean;
  web: WebContent;
  /** The names of what has been unchecked: everything is allowed at first. */
  denied: readonly string[];
}

export function readContentPrivacy(stored: unknown): ContentPrivacy {
  const value = isObject(stored) ? stored : {};
  return {
    on: value.on === true,
    web: value.web === "limit-adult" || value.web === "allowed-only" ? value.web : "unrestricted",
    denied: Array.isArray(value.denied)
      ? value.denied.filter((name): name is string => typeof name === "string")
      : [],
  };
}
