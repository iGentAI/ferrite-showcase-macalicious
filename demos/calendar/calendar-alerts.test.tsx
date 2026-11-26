import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";
import {
  describeAlert,
  dueAlerts,
  nextAlertChange,
  restoredAlerts,
  withoutRemovedSnooze,
} from "./calendar-alerts";
import type { CalendarEntry } from "./calendar-data";
import { EventDetails } from "./calendar-editor";
import { documentFromServer, documentToServer } from "./calendar-server";

/* An event's alert (calendar-alerts.ts): when it shows, on whose clock, and what Close keeps. */

const meeting: CalendarEntry = {
  id: "review",
  title: "Design review",
  start: new Date(2019, 9, 3, 16),
  end: new Date(2019, 9, 3, 17),
  calendar: "work",
  alert: 15,
};
const at = (hours: number, minutes: number) => new Date(2019, 9, 3, hours, minutes).getTime();
const instant = (iso: string) => new Date(iso).getTime();

describe("snoozing", () => {
  const start = new Date(2019, 9, 3, 10);
  const entry: CalendarEntry = {
    id: "e",
    title: "Daily",
    start,
    end: new Date(2019, 9, 3, 11),
    calendar: "home",
    alert: 15,
    repeat: { freq: "daily" },
    alertSnooze: { start: start.getTime(), until: new Date(2019, 9, 4, 12).getTime() },
  };
  const next = new Date(2019, 9, 4, 10).getTime();

  it("keeps the alert away until its moment, then shows it though its occurrence has ended", () => {
    const away = dueAlerts([entry], new Date(2019, 9, 3, 10, 30).getTime());
    expect(away).toEqual([]);
    expect(nextAlertChange([entry], new Date(2019, 9, 3, 10, 30).getTime())).toBeLessThanOrEqual(
      entry.alertSnooze?.until as number,
    );
    const back = dueAlerts([entry], new Date(2019, 9, 4, 12).getTime());
    expect(back.map((alert) => alert.start)).toEqual([start]);
  });

  it("shows it even when a later occurrence's alert was closed meanwhile", () => {
    const closedLater = { ...entry, alertDismissed: next };
    const back = dueAlerts([closedLater], new Date(2019, 9, 4, 12).getTime());
    expect(back.map((alert) => alert.start)).toEqual([start]);
  });

  it("has nothing to wait for from a snoozed alert already past its occurrence's end", () => {
    const now = new Date(2019, 9, 4, 12).getTime();
    const change = nextAlertChange([entry], now);
    expect(change === null || change > now).toBe(true);
  });
});

describe("a snooze and the occurrence it belongs to", () => {
  const first = new Date(2019, 9, 3, 10);
  const second = new Date(2019, 9, 4, 10);
  const daily: CalendarEntry = {
    id: "daily",
    title: "Daily",
    start: first,
    end: new Date(2019, 9, 3, 11),
    calendar: "home",
    alert: 15,
    repeat: { freq: "daily" },
  };
  const snooze = { start: first.getTime(), until: new Date(2019, 9, 3, 10, 30).getTime() };
  const snoozed = { ...daily, alertSnooze: snooze };
  const later = new Date(2019, 9, 3, 12).getTime();

  it("goes with an occurrence removed from the series, and stays for another's", () => {
    const removed = withoutRemovedSnooze({ ...snoozed, exdates: [first.getTime()] });
    expect(removed).not.toHaveProperty("alertSnooze");
    expect(dueAlerts([removed], later)).toEqual([]);

    const other = withoutRemovedSnooze({ ...snoozed, exdates: [second.getTime()] });
    expect(other.alertSnooze).toEqual(snooze);
    expect(dueAlerts([other], later).map((alert) => alert.start)).toEqual([first]);
  });

  it("goes with an end of the repeat before its occurrence", () => {
    const ended = { ...snoozed, repeat: { freq: "daily" as const, until: first.getTime() - 1 } };
    expect(withoutRemovedSnooze(ended)).not.toHaveProperty("alertSnooze");
    const kept = { ...snoozed, repeat: { freq: "daily" as const, until: first.getTime() } };
    expect(withoutRemovedSnooze(kept).alertSnooze).toEqual(snooze);
  });

  it("goes when a count or another frequency leaves no such occurrence", () => {
    const onSecond = { ...daily, alertSnooze: { ...snooze, start: second.getTime() } };
    const counted = { ...onSecond, repeat: { freq: "daily" as const, count: 1 } };
    expect(withoutRemovedSnooze(counted)).not.toHaveProperty("alertSnooze");
    expect(dueAlerts([withoutRemovedSnooze(counted)], later)).toEqual([]);
    const weekly = { ...onSecond, repeat: { freq: "weekly" as const } };
    expect(withoutRemovedSnooze(weekly)).not.toHaveProperty("alertSnooze");
    const longer = { ...onSecond, repeat: { freq: "daily" as const, count: 2 } };
    expect(withoutRemovedSnooze(longer).alertSnooze).toEqual(onSecond.alertSnooze);
    const { repeat: _repeat, ...once } = onSecond;
    expect(withoutRemovedSnooze(once)).not.toHaveProperty("alertSnooze");
  });

  it("returns with Undo and goes again with Redo", () => {
    const moved = withoutRemovedSnooze({ ...snoozed, exdates: [first.getTime()] });
    const undone = restoredAlerts(snoozed, moved);
    expect(undone.exdates).toBeUndefined();
    expect(undone.alertSnooze).toEqual(snooze);
    expect(restoredAlerts(moved, undone)).not.toHaveProperty("alertSnooze");
  });
});

describe("an alert's state through Undo", () => {
  const start = meeting.start.getTime();
  const snooze = { start, until: start + 3_600_000 };

  it("comes back with an event that was deleted", () => {
    expect(restoredAlerts({ ...meeting, alertDismissed: start }, undefined).alertDismissed).toBe(
      start,
    );
    expect(restoredAlerts({ ...meeting, alertSnooze: snooze }, undefined).alertSnooze).toEqual(
      snooze,
    );
  });

  it("stays as it was last decided for an event that still exists", () => {
    const older = { ...meeting, title: "Older" };
    const closed = restoredAlerts(older, { ...meeting, alertDismissed: start });
    expect(closed).toMatchObject({ title: "Older", alertDismissed: start });
    const put = restoredAlerts(older, { ...meeting, alertSnooze: snooze });
    expect(put.alertSnooze).toEqual(snooze);
    const reopened = restoredAlerts({ ...meeting, alertDismissed: start }, meeting);
    expect(reopened).not.toHaveProperty("alertDismissed");
    const closedSince = restoredAlerts({ ...meeting, alertSnooze: snooze }, meeting);
    expect(closedSince).not.toHaveProperty("alertSnooze");
  });

  it("keeps an alert closed when its event is deleted and Undo brings it back", async () => {
    const user = userEvent.setup();
    render(<Calendar events={[meeting]} now={new Date(2019, 9, 3, 15, 50)} />);
    const shown = document.querySelector<HTMLElement>(".mac-calendar-alerts");
    await user.click(within(shown as HTMLElement).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: /Design review/ }));
    await user.keyboard("{Delete}");
    expect(screen.queryByRole("button", { name: /Design review/ })).not.toBeInTheDocument();
    screen.getByRole("button", { name: "Calendars" }).focus();
    await user.keyboard("{Control>}z{/Control}");
    expect(await screen.findByRole("button", { name: /Design review/ })).toBeInTheDocument();
    expect(document.querySelector(".mac-calendar-alerts")).toBeNull();
  });
});

describe("an event's alert", () => {
  it("shows from its moment until the event ends, unless it was closed", () => {
    expect(dueAlerts([meeting], at(15, 44))).toEqual([]);
    expect(dueAlerts([meeting], at(15, 45)).map((alert) => alert.title)).toEqual(["Design review"]);
    expect(dueAlerts([meeting], at(16, 59))).toHaveLength(1);
    expect(dueAlerts([meeting], at(17, 0))).toEqual([]);
    const closed = { ...meeting, alertDismissed: meeting.start.getTime() };
    expect(dueAlerts([closed], at(15, 50))).toEqual([]);
    expect(dueAlerts([{ ...meeting, alert: undefined }], at(15, 50))).toEqual([]);
    // The window looks again when the next alert comes, and when a shown one's event ends.
    expect(nextAlertChange([meeting], at(15, 0))).toBe(at(15, 45));
    expect(nextAlertChange([meeting], at(15, 50))).toBe(at(17, 0));
    expect(nextAlertChange([closed], at(15, 50))).toBeNull();
  });

  it("comes at its moment on the event's own clock, after another zone's clocks change", () => {
    // Every Monday at 8:00 in New York from 19 October 2026 (EDT, 12:00 UTC); on 9 November New
    // York keeps standard time, so 8:00 there is 13:00 UTC and its alert ten minutes before.
    const standup: CalendarEntry = {
      id: "standup",
      title: "Standup",
      start: new Date("2026-10-19T12:00:00Z"),
      end: new Date("2026-10-19T12:30:00Z"),
      calendar: "work",
      repeat: { freq: "weekly" },
      timeZone: "America/New_York",
      alert: 10,
    };
    expect(dueAlerts([standup], instant("2026-11-09T12:20:00Z"))).toEqual([]);
    expect(nextAlertChange([standup], instant("2026-11-09T12:20:00Z"))).toBe(
      instant("2026-11-09T12:50:00Z"),
    );
    expect(dueAlerts([standup], instant("2026-11-09T12:49:59Z"))).toEqual([]);
    const [due] = dueAlerts([standup], instant("2026-11-09T12:50:00Z"));
    expect(due?.start.toISOString()).toBe("2026-11-09T13:00:00.000Z");
    expect(due?.id).toBe("standup");
    // Closing that occurrence's alert leaves the next week's.
    const closed = { ...standup, alertDismissed: instant("2026-11-09T13:00:00Z") };
    expect(dueAlerts([closed], instant("2026-11-09T12:55:00Z"))).toEqual([]);
    expect(dueAlerts([closed], instant("2026-11-16T12:50:00Z"))).toHaveLength(1);
  });

  it("of an all-day event comes at 9 AM on its day", () => {
    const trip: CalendarEntry = {
      id: "trip",
      title: "Trip",
      start: new Date(2019, 9, 4),
      end: new Date(2019, 9, 5),
      allDay: true,
      calendar: "home",
      alert: -540,
    };
    expect(dueAlerts([trip], new Date(2019, 9, 4, 8, 59).getTime())).toEqual([]);
    expect(dueAlerts([trip], new Date(2019, 9, 4, 9, 0).getTime())).toHaveLength(1);
    expect(describeAlert(-540, true)).toBe("On day of event (9 AM)");
    expect(describeAlert(45)).toBe("45 minutes before");
  });

  it("of an all-day event stays at 9 AM across a change of the clocks", () => {
    // In New York the clocks go forward at 2:00 on 8 March 2026 and back on 1 November.
    const zone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const day = (month: number, date: number, alert: number): CalendarEntry => ({
        id: `d${month}-${date}`,
        title: "Day",
        start: new Date(2026, month, date),
        end: new Date(2026, month, date + 1),
        allDay: true,
        calendar: "home",
        alert,
      });
      // On the day the clocks go forward, 9 AM EDT (13:00 UTC), not ten (nine hours on).
      const spring = day(2, 8, -540);
      expect(dueAlerts([spring], instant("2026-03-08T12:59:00Z"))).toEqual([]);
      expect(dueAlerts([spring], instant("2026-03-08T13:00:00Z"))).toHaveLength(1);
      // On the day they go back, 9 AM EST (14:00 UTC), not eight.
      const autumn = day(10, 1, -540);
      expect(dueAlerts([autumn], instant("2026-11-01T13:59:00Z"))).toEqual([]);
      expect(dueAlerts([autumn], instant("2026-11-01T14:00:00Z"))).toHaveLength(1);
      // Two days before 9 March, across the change: 9 AM EST on 7 March (14:00 UTC).
      const before = day(2, 9, 2340);
      expect(nextAlertChange([before], instant("2026-03-07T12:00:00Z"))).toBe(
        instant("2026-03-07T14:00:00Z"),
      );
      expect(dueAlerts([before], instant("2026-03-07T13:30:00Z"))).toEqual([]);
      // Two days before 2 November, across the fall-back change: 9 AM EDT on 31 October (13:00
      // UTC), found from 23.5 hours before, though its day starts 40 hours after it.
      const late = day(10, 2, 2340);
      expect(nextAlertChange([late], instant("2026-10-30T13:30:00Z"))).toBe(
        instant("2026-10-31T13:00:00Z"),
      );
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("is saved with the event, with what was closed, and read back", () => {
    const body = documentToServer(
      [
        { ...meeting, alertDismissed: 5 },
        { ...meeting, id: "plain", alert: undefined, alertDismissed: 5 },
      ],
      [{ id: "work", name: "Work", color: "purple" }],
    );
    expect(body.events[0]).toMatchObject({ alert: 15, alertDismissed: 5 });
    expect(body.events[1]).not.toHaveProperty("alert");
    expect(body.events[1]).not.toHaveProperty("alertDismissed");
    const read = documentFromServer({ events: body.events, calendars: body.calendars });
    expect(read?.events?.[0]).toMatchObject({ alert: 15, alertDismissed: 5 });
    expect(documentFromServer({ events: [{ ...body.events[0], alert: "soon" }] })).toBeNull();
  });

  it("is chosen in the event's popover, under its date", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EventDetails
        entry={{ ...meeting, alert: undefined }}
        calendars={[]}
        colorOf={() => undefined}
        onChange={onChange}
        initialField="date"
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Alert" }));
    await user.click(await screen.findByRole("option", { name: "15 minutes before" }));
    expect(onChange).toHaveBeenCalledWith({ alert: 15 });
  });

  it("shows under the menu bar while Calendar is open, and Close puts it away", async () => {
    const user = userEvent.setup();
    render(<Calendar events={[meeting]} now={new Date(2019, 9, 3, 15, 50)} />);
    const shown = document.querySelector<HTMLElement>(".mac-calendar-alerts");
    expect(shown).not.toBeNull();
    expect(shown).toHaveTextContent("Design review");
    expect(shown).toHaveTextContent("4:00 PM to 5:00 PM");
    await user.click(within(shown as HTMLElement).getByRole("button", { name: "Close" }));
    expect(document.querySelector(".mac-calendar-alerts")).toBeNull();
  });

  it("shows nothing before its moment", () => {
    render(<Calendar events={[meeting]} now={new Date(2019, 9, 3, 15, 38)} />);
    expect(document.querySelector(".mac-calendar-alerts")).toBeNull();
  });
});
