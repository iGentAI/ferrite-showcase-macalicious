import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCalendarAlertWatch } from "./calendar-alert-watch";
import {
  alertingEntries,
  alertsOnlyThePageRaises,
  dueAlerts,
  mergedAlertStates,
} from "./calendar-alerts";
import { BIRTHDAYS, type CalendarEntry, INVITATIONS } from "./calendar-data";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

const AT = new Date(2026, 10, 2, 9, 0).getTime();
const entry = (fields: Partial<CalendarEntry>): CalendarEntry => ({
  id: "e1",
  title: "Standup",
  start: new Date(AT + 600_000),
  end: new Date(AT + 1_800_000),
  calendar: "home",
  alert: 15,
  ...fields,
});

const raised = (events: readonly CalendarEntry[], now = AT) =>
  alertsOnlyThePageRaises(dueAlerts(events, now), events, now);

describe("the alerts only the page can raise", () => {
  it("leaves a single event and a document's snooze to the server", () => {
    expect(raised([entry({})])).toEqual([]);
    const start = AT + 600_000;
    const snoozed = [entry({ repeat: { freq: "daily" }, alertSnooze: { start, until: AT - 1 } })];
    expect(raised(snoozed)).toEqual([]);
  });

  it("names a repeating and a floating occurrence, with its time", () => {
    const [repeating] = raised([entry({ repeat: { freq: "daily" } })]);
    expect(repeating?.event).toBe("e1");
    expect(repeating?.start).toBe(AT + 600_000);
    expect(repeating?.title).toBeUndefined();
    expect(repeating?.when).toBe("9:10 AM to 9:30 AM");
    expect(raised([entry({ floating: true })]).map((alert) => alert.start)).toEqual([AT + 600_000]);
  });

  it("names a birthday and an accepted invitation with what the document cannot give", () => {
    const birthday = entry({
      id: "birthday-c1",
      title: "Ann’s Birthday",
      calendar: BIRTHDAYS,
      alert: undefined,
      allDay: true,
      start: new Date(2026, 10, 2),
      end: new Date(2026, 10, 3),
    });
    const invited = entry({
      id: "invitation-t1",
      title: "Offsite",
      calendar: INVITATIONS,
      alert: undefined,
      location: "Pier",
    });
    const events = alertingEntries(
      [],
      [birthday],
      [
        { status: "accepted", event: invited },
        { status: "pending", event: { ...invited, id: "invitation-t2" } },
      ],
      { defaultAlert: 15, defaultBirthdayAlert: -540 },
      {},
    );
    expect(
      raised(events).map(({ event, title, location, allDay }) => [event, title, location, allDay]),
    ).toEqual([
      ["invitation-t1", "Offsite", "Pier", undefined],
      ["birthday-c1", "Ann’s Birthday", undefined, true],
    ]);
  });

  it("keeps a closed birthday closed, and brings a snoozed one back at its end", () => {
    const birthday = entry({ id: "birthday-c1", calendar: BIRTHDAYS, alert: undefined });
    const start = AT + 600_000;
    const closed = alertingEntries(
      [],
      [birthday],
      [],
      { defaultBirthdayAlert: 15 },
      {
        "birthday-c1": { dismissed: start },
      },
    );
    expect(raised(closed)).toEqual([]);
    const snoozed = alertingEntries(
      [],
      [birthday],
      [],
      { defaultBirthdayAlert: 15 },
      {
        "birthday-c1": { snooze: { start, until: AT + 60_000 } },
      },
    );
    expect(raised(snoozed)).toEqual([]);
    expect(raised(snoozed, AT + 60_000).map((alert) => alert.until)).toEqual([AT + 60_000]);
  });
});

describe("the two records of a birthday's alert", () => {
  it("takes the later close and the later snooze", () => {
    expect(
      mergedAlertStates(
        { a: { dismissed: 5, snooze: { start: 1, until: 2 } }, b: { dismissed: 1 } },
        { a: { dismissed: 3, snooze: { start: 1, until: 9 } } },
      ),
    ).toEqual({ a: { dismissed: 5, snooze: { start: 1, until: 9 } }, b: { dismissed: 1 } });
  });

  it("drops the snooze of an occurrence the other record closed", () => {
    expect(
      mergedAlertStates({ a: { dismissed: 7 } }, { a: { snooze: { start: 7, until: 9 } } }),
    ).toEqual({ a: { dismissed: 7 } });
  });
});

describe("the shell's watch", () => {
  it("raises a repeating event's alert once, with Calendar closed", async () => {
    const now = Date.now();
    const sent: unknown[] = [];
    const stored = {
      id: "daily",
      title: "Standup",
      start: now + 60_000,
      end: now + 600_000,
      calendar: "home",
      alert: 15,
      repeat: { freq: "daily" },
    };
    const single = { ...stored, id: "once", repeat: undefined };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/alerts/raise")) {
          sent.push(JSON.parse(String(init?.body)));
          return json({ raised: 1 });
        }
        if (url.includes("/alerts/others")) return json({ alerts: {} });
        if (url.includes("/inbox")) return json({ invitations: [] });
        return json({ events: [stored, single], settings: null, rev: 1 });
      }),
    );
    const { unmount } = renderHook(() => useCalendarAlertWatch(true));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      alerts: [
        {
          event: "daily",
          start: now + 60_000,
          when: expect.stringMatching(/ to /),
        },
      ],
    });
    window.dispatchEvent(
      new CustomEvent("macalicious:server-change", { detail: { app: "calendar" } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toHaveLength(1);
    unmount();
  });

  it("asks nothing while Calendar is open or nobody is signed in", async () => {
    const asked = vi.fn(async () => json({}));
    vi.stubGlobal("fetch", asked);
    const { unmount } = renderHook(() => useCalendarAlertWatch(false));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked).not.toHaveBeenCalled();
    unmount();
  });
});
