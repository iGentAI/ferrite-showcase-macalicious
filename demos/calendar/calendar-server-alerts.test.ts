import { describe, expect, it } from "vitest";
import { alertsToTell, type DueAlert, dueAlerts } from "./calendar-alerts";
import { BIRTHDAYS, type CalendarEntry } from "./calendar-data";

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
const shown = (events: readonly CalendarEntry[]): DueAlert[] => dueAlerts(events, AT);

describe("the alerts the window keeps out of Notification Center", () => {
  it("names a single event's occurrence", () => {
    const events = [entry({})];
    expect(alertsToTell(shown(events), events)).toEqual([{ event: "e1", start: AT + 600_000 }]);
  });

  it("names a snooze that has come back by its end", () => {
    const start = AT + 600_000;
    const events = [entry({ alertSnooze: { start, until: AT - 1 } })];
    expect(alertsToTell(shown(events), events)).toEqual([{ event: "e1", start, until: AT - 1 }]);
  });

  it("names what only a browser lays out, so that the shell's watch does not raise it either", () => {
    const floating = [entry({ floating: true })];
    expect(alertsToTell(shown(floating), floating)).toEqual([{ event: "e1", start: AT + 600_000 }]);
    const repeating = [entry({ repeat: { freq: "daily" } })];
    expect(alertsToTell(shown(repeating), repeating)).toEqual([
      { event: "e1", start: AT + 600_000 },
    ]);
  });

  it("names a birthday with its title, which the server cannot find, and nothing unknown", () => {
    const birthdays = [entry({ id: "birthday-c1", title: "Ann", calendar: BIRTHDAYS })];
    expect(alertsToTell(shown(birthdays), birthdays)).toEqual([
      { event: "birthday-c1", start: AT + 600_000, title: "Ann" },
    ]);
    expect(alertsToTell(shown(birthdays), [])).toEqual([]);
  });
});
