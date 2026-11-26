import { useEffect, useRef } from "react";
import { liveState, subscribeLive } from "./desktop-live";
import {
  changeDesktopValue,
  desktopValues,
  desktopValuesLoaded,
  subscribeDesktopValues,
  useDesktopValue,
} from "./desktop-personal";

/**
 * Screen Time's figures on the served desktop: the seconds each application has been in front, by
 * day, kept for the account. Only time this page sees counts: the page showing, the browser's window
 * in front, and some input in the last two minutes.
 */
export const SCREEN_TIME_KEY = "screen-time.usage";

export type ScreenTimeUsage = Readonly<Record<string, Readonly<Record<string, number>>>>;

const DAYS_KEPT = 7;
const IDLE_MS = 120_000;
const SAVE_EVERY_MS = 60_000;
const NO_USAGE: ScreenTimeUsage = {};
const INPUT_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

export const dayOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function readUsage(stored: unknown): ScreenTimeUsage | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const usage: Record<string, Record<string, number>> = {};
  for (const [day, apps] of Object.entries(stored)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || typeof apps !== "object" || apps === null) continue;
    const counted = Object.entries(apps).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 0,
    );
    usage[day] = Object.fromEntries(counted);
  }
  return usage;
}

/** The first of the seven calendar days ending on `day`, as a key of the same form. */
const firstDayOfWeek = (day: string) => {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return dayOf(new Date(year, month - 1, date - (DAYS_KEPT - 1)));
};

/** The usage of the seven calendar days ending on `day`. */
export function lastSevenDays(usage: ScreenTimeUsage, day: string): ScreenTimeUsage {
  const first = firstDayOfWeek(day);
  return Object.fromEntries(Object.entries(usage).filter(([each]) => each >= first));
}

/** `usage` with `seconds` more for `app` on `day`, and the days before that week gone. */
export function addTime(
  usage: ScreenTimeUsage,
  day: string,
  app: string,
  seconds: number,
): ScreenTimeUsage {
  return lastSevenDays(
    { ...usage, [day]: { ...usage[day], [app]: (usage[day]?.[app] ?? 0) + seconds } },
    day,
  );
}

export const useScreenTimeUsage = () => useDesktopValue(SCREEN_TIME_KEY, readUsage, NO_USAGE);

/**
 * The notifications this desktop delivered, by day and application: `last` is the newest one counted,
 * so that a reload, a second tab or a notification dismissed since counts nothing twice or takes
 * nothing away.
 */
export const NOTIFICATION_COUNT_KEY = "screen-time.notifications";

export interface NotificationCounts {
  last: number;
  days: ScreenTimeUsage;
}

const NO_COUNTS: NotificationCounts = { last: 0, days: NO_USAGE };

export function readNotificationCounts(stored: unknown): NotificationCounts | undefined {
  const { last, days } = (stored ?? {}) as { last?: unknown; days?: unknown };
  const read = readUsage(days);
  return typeof last === "number" && read ? { last, days: read } : undefined;
}

/** `counts` with the notifications newer than its `last`; the same object when there are none. */
export function countNotifications(
  counts: NotificationCounts,
  items: readonly { seq: number; at_ms: number; app: string }[],
  today: string,
): NotificationCounts {
  const fresh = items.filter((item) => item.seq > counts.last);
  if (fresh.length === 0) return counts;
  let days = counts.days;
  for (const { at_ms, app } of fresh) days = addTime(days, dayOf(new Date(at_ms)), app, 1);
  return {
    last: Math.max(counts.last, ...fresh.map((item) => item.seq)),
    days: lastSevenDays(days, today),
  };
}

export const useNotificationCounts = () =>
  useDesktopValue(NOTIFICATION_COUNT_KEY, readNotificationCounts, NO_COUNTS);

/** Screen Time's Options: off, nothing is counted, and what was counted stays. */
export const SCREEN_TIME_ON_KEY = "screen-time.enabled";
const screenTimeOn = () => desktopValues()[SCREEN_TIME_ON_KEY] !== false;

/** Counts the front application's seconds. It draws nothing. */
export function ScreenTimeMeter({ app }: { app: string }) {
  const usage = useScreenTimeUsage();
  const latest = useRef({ usage, app });
  latest.current = { usage, app };
  // The seconds not saved yet, by the day they were counted on and the application.
  const counted = useRef(new Map<string, Map<string, number>>());
  const flush = useRef(() => {
    if (counted.current.size === 0) return;
    let next = latest.current.usage;
    for (const [day, apps] of counted.current)
      for (const [id, seconds] of apps) next = addTime(next, day, id, seconds);
    counted.current.clear();
    // Read again before the next render, or a second save soon after would lose this one.
    latest.current = { ...latest.current, usage: next };
    changeDesktopValue(SCREEN_TIME_KEY, next);
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new front application saves what the last one had.
  useEffect(() => flush.current(), [app]);
  useEffect(() => {
    let lastInput = Date.now();
    const heard = () => {
      lastInput = Date.now();
    };
    const save = () => flush.current();
    for (const name of INPUT_EVENTS) {
      window.addEventListener(name, heard, { passive: true, capture: true });
    }
    window.addEventListener("pagehide", save);
    const second = setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (Date.now() - lastInput > IDLE_MS || !screenTimeOn()) return;
      const { app: front } = latest.current;
      const day = dayOf(new Date());
      const apps = counted.current.get(day) ?? new Map<string, number>();
      apps.set(front, (apps.get(front) ?? 0) + 1);
      counted.current.set(day, apps);
    }, 1_000);
    const saver = setInterval(save, SAVE_EVERY_MS);
    return () => {
      save();
      clearInterval(second);
      clearInterval(saver);
      for (const name of INPUT_EVENTS) window.removeEventListener(name, heard, { capture: true });
      window.removeEventListener("pagehide", save);
    };
  }, []);
  useEffect(() => {
    const heard = () => {
      const { ready, items } = liveState();
      // Until the account's settings are read, what was counted before is not known.
      if (!ready || !desktopValuesLoaded()) return;
      const counts = readNotificationCounts(desktopValues()[NOTIFICATION_COUNT_KEY]) ?? NO_COUNTS;
      const counted = countNotifications(counts, items, dayOf(new Date()));
      // Off, what comes is passed over, so it is not counted when Screen Time is on again.
      const next = screenTimeOn() ? counted : { ...counted, days: counts.days };
      if (counted !== counts) changeDesktopValue(NOTIFICATION_COUNT_KEY, next);
    };
    heard();
    const stopLive = subscribeLive(heard);
    const stopValues = subscribeDesktopValues(heard);
    return () => {
      stopLive();
      stopValues();
    };
  }, []);
  return null;
}
