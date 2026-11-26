/** @vitest-environment jsdom */
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addTime,
  countNotifications,
  dayOf,
  lastSevenDays,
  readNotificationCounts,
  readUsage,
  ScreenTimeMeter,
} from "./desktop-screen-time";

const saved = vi.hoisted(() => ({
  value: {} as unknown,
  listeners: new Set<() => void>(),
  // The account's settings as the meter of notifications reads them.
  loaded: true,
  counts: undefined as unknown,
  off: undefined as boolean | undefined,
  writes: [] as unknown[],
  valueListeners: new Set<() => void>(),
  live: { ready: false, items: [] as { seq: number; at_ms: number; app: string }[] },
}));
vi.mock("./desktop-live", () => ({
  liveState: () => saved.live,
  subscribeLive: () => () => {},
}));
vi.mock("./desktop-personal", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    changeDesktopValue: (key: string, value: unknown) => {
      if (key === "screen-time.notifications") {
        saved.counts = value;
        saved.writes.push(value);
        return;
      }
      if (key !== "screen-time.usage") return;
      saved.value = value;
      for (const listener of saved.listeners) listener();
    },
    useDesktopValue: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          saved.listeners.add(listener);
          return () => saved.listeners.delete(listener);
        },
        () => saved.value,
      ),
    desktopValues: () => ({
      "screen-time.notifications": saved.counts,
      "screen-time.enabled": saved.off,
    }),
    desktopValuesLoaded: () => saved.loaded,
    subscribeDesktopValues: (listener: () => void) => {
      saved.valueListeners.add(listener);
      return () => saved.valueListeners.delete(listener);
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  saved.value = {};
  saved.loaded = true;
  saved.counts = undefined;
  saved.off = undefined;
  saved.writes = [];
  saved.live = { ready: false, items: [] };
});

const mailOn = (day: string) => (saved.value as Record<string, Record<string, number>>)[day]?.mail;

describe("Screen Time's count of notifications", () => {
  const at = (day: number) => new Date(2026, 10, day, 12).getTime();
  it("counts each one once, by its day and application", () => {
    const first = countNotifications(
      { last: 0, days: {} },
      [
        { seq: 2, at_ms: at(3), app: "mail" },
        { seq: 1, at_ms: at(2), app: "mail" },
      ],
      "2026-11-03",
    );
    expect(first).toEqual({
      last: 2,
      days: { "2026-11-02": { mail: 1 }, "2026-11-03": { mail: 1 } },
    });
    expect(countNotifications(first, [{ seq: 2, at_ms: at(3), app: "mail" }], "2026-11-03")).toBe(
      first,
    );
  });

  it("keeps what was counted when a notification is dismissed", () => {
    const first = countNotifications(
      { last: 0, days: {} },
      [{ seq: 1, at_ms: at(3), app: "mail" }],
      "2026-11-03",
    );
    expect(countNotifications(first, [], "2026-11-03").days).toEqual({
      "2026-11-03": { mail: 1 },
    });
  });

  it("waits for the account's settings, so a reload overwrites nothing counted before", () => {
    const stored = { last: 2, days: { "2026-11-01": { mail: 2 } } };
    saved.live = {
      ready: true,
      items: [
        { seq: 2, at_ms: at(3), app: "mail" },
        { seq: 1, at_ms: at(3), app: "mail" },
      ],
    };
    saved.loaded = false;
    const { unmount } = render(<ScreenTimeMeter app="mail" />);
    expect(saved.writes).toEqual([]);

    saved.loaded = true;
    saved.counts = stored;
    for (const listener of saved.valueListeners) listener();
    expect(saved.writes).toEqual([]);
    unmount();
  });

  it("passes over what comes while Screen Time is off", () => {
    saved.counts = { last: 1, days: { "2026-11-01": { mail: 1 } } };
    saved.off = false;
    saved.live = { ready: true, items: [{ seq: 2, at_ms: at(3), app: "mail" }] };
    const { unmount } = render(<ScreenTimeMeter app="mail" />);
    expect(saved.writes).toEqual([{ last: 2, days: { "2026-11-01": { mail: 1 } } }]);
    unmount();
  });

  it("reads only what it wrote", () => {
    expect(readNotificationCounts({ last: 3, days: { "2026-11-01": { mail: 2 } } })).toEqual({
      last: 3,
      days: { "2026-11-01": { mail: 2 } },
    });
    expect(readNotificationCounts("no")).toBeUndefined();
    expect(readNotificationCounts({ last: "3", days: {} })).toBeUndefined();
  });
});

describe("Screen Time's figures", () => {
  it("adds to the app's day, and keeps seven calendar days", () => {
    let usage = addTime({}, "2026-11-01", "mail", 30);
    usage = addTime(usage, "2026-11-01", "mail", 15);
    expect(usage["2026-11-01"]).toEqual({ mail: 45 });
    usage = addTime(usage, "2026-11-07", "notes", 1);
    expect(Object.keys(usage)).toEqual(["2026-11-01", "2026-11-07"]);
    usage = addTime(usage, "2026-11-08", "notes", 1);
    expect(Object.keys(usage)).toEqual(["2026-11-07", "2026-11-08"]);
  });

  it("counts a week by the calendar, however little was used", () => {
    const usage = { "2026-11-02": { a: 1 }, "2026-10-03": { a: 9 } };
    expect(Object.keys(lastSevenDays(usage, "2026-11-03"))).toEqual(["2026-11-02"]);
  });

  it("reads only days and counts", () => {
    expect(readUsage({ "2026-11-01": { mail: 5, bad: "x" }, nope: { mail: 1 } })).toEqual({
      "2026-11-01": { mail: 5 },
    });
    expect(readUsage("no")).toBeUndefined();
  });

  it("names a day in the page's own calendar", () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("keeps seconds on the day they were counted, across midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3, 23, 59, 50));
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { unmount } = render(<ScreenTimeMeter app="mail" />);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    unmount();
    // The last second of the day is stamped as the clock reads it, on the tenth tick.
    expect(mailOn("2026-11-03")).toBe(9);
    expect(mailOn("2026-11-04")).toBe(11);
  });

  it.each(["pointerdown", "wheel", "touchstart"])("%s keeps the time counting", (name) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3, 10));
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { unmount } = render(<ScreenTimeMeter app="mail" />);
    act(() => {
      for (let minute = 0; minute < 3; minute += 1) {
        vi.advanceTimersByTime(60_000);
        window.dispatchEvent(new Event(name));
      }
    });
    unmount();
    expect(mailOn("2026-11-03")).toBe(180);
  });

  it("stops counting after two minutes with no input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3, 10));
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { unmount } = render(<ScreenTimeMeter app="mail" />);
    act(() => {
      vi.advanceTimersByTime(300_000);
    });
    unmount();
    expect(mailOn("2026-11-03")).toBe(120);
  });
});
