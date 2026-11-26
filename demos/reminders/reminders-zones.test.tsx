import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Reminder } from "./reminders-data";
import {
  changeReminder,
  dueLabel,
  instantIn,
  inViewerZone,
  wallClockIn,
  zoneOffset,
} from "./reminders-dates";
import { alertOf } from "./reminders-sync";

/*
 * A reminder's due day and minute are read in the zone it was set in (`timeZone`), so every
 * browser of the person names the same alert instant; a browser in another zone shows a timed
 * reminder at that moment on its own clocks. The zones are named here, so these hold whatever
 * zone the tests run in.
 */

const NY = "America/New_York";
const TOKYO = "Asia/Tokyo";
const LONDON = "Europe/London";
/** The row of the reminder titled `title` (a row's name also says when it is due). */
const rowOf = (title: string) =>
  screen
    .queryAllByRole("option")
    .find((row) => row.querySelector(".mac-reminders-text")?.textContent === title);
const utc = (y: number, m: number, d: number, h: number, mi = 0) => Date.UTC(y, m - 1, d, h, mi);
const call: Reminder = {
  id: "call",
  listId: "work",
  title: "Call",
  due: "2026-10-21",
  dueTime: "15:00",
  timeZone: NY,
};

describe("a reminder's time zone", () => {
  it("reads a zone's offset and the instant of its clocks' minute, across changes of the clocks", () => {
    expect(zoneOffset(NY, utc(2026, 10, 21, 19))).toBe(-4 * 3_600_000);
    expect(zoneOffset(NY, utc(2026, 11, 2, 14))).toBe(-5 * 3_600_000);
    expect(zoneOffset("Not/AZone", 0)).toBeUndefined();
    expect(instantIn("2026-10-21", "15:00", NY)).toBe(utc(2026, 10, 21, 19));
    expect(instantIn("2026-10-22", "04:00", TOKYO)).toBe(utc(2026, 10, 21, 19));
    // After New York's clocks go back (1 November 2026) and London's (25 October).
    expect(instantIn("2026-11-02", "09:00", NY)).toBe(utc(2026, 11, 2, 14));
    expect(instantIn("2026-10-28", "09:00", LONDON)).toBe(utc(2026, 10, 28, 9));
    expect(instantIn("2026-10-21", "09:00", LONDON)).toBe(utc(2026, 10, 21, 8));
    // A minute the clocks skip moves on by the change; one they repeat is the earlier.
    expect(instantIn("2026-03-08", "02:30", NY)).toBe(utc(2026, 3, 8, 7, 30));
    expect(instantIn("2026-11-01", "01:30", NY)).toBe(utc(2026, 11, 1, 5, 30));
    expect(instantIn("2026-10-25", "01:30", LONDON)).toBe(utc(2026, 10, 25, 0, 30));
    expect(wallClockIn(utc(2026, 10, 21, 19), TOKYO)).toEqual({ day: "2026-10-22", time: "04:00" });
    expect(wallClockIn(utc(2026, 11, 1, 6, 30), NY)).toEqual({ day: "2026-11-01", time: "01:30" });
  });

  it("alerts at the instant of the zone it was set in, whichever browser works it out", () => {
    expect(alertOf(call)).toBe(utc(2026, 10, 21, 19));
    expect(alertOf({ ...call, dueTime: undefined })).toBe(utc(2026, 10, 21, 13));
    expect(alertOf({ ...call, timeZone: TOKYO })).toBe(utc(2026, 10, 21, 6));
    expect(alertOf({ ...call, completed: true })).toBeUndefined();
  });

  it("shows a timed reminder of another zone at that moment on the person's clocks", () => {
    const seen = inViewerZone(call, TOKYO);
    expect(seen).toMatchObject({ due: "2026-10-22", dueTime: "04:00", timeZone: TOKYO });
    expect(alertOf(seen)).toBe(alertOf(call));
    expect(dueLabel(call, "2026-10-21", "12:00", TOKYO)?.text).toBe("Tomorrow, 4:00 AM");
    expect(dueLabel(call, "2026-10-21", "12:00", NY)?.text).toBe("Today, 3:00 PM");
    // In its own zone, without a minute, or without a zone, a reminder is as it is.
    expect(inViewerZone(call, NY)).toBe(call);
    const undated = { ...call, dueTime: undefined };
    expect(inViewerZone(undated, TOKYO)).toBe(undated);
    const older = { ...call, timeZone: undefined };
    expect(inViewerZone(older, TOKYO)).toBe(older);
  });

  it("puts a reminder whose time is changed in the person's zone, and keeps it for other changes", () => {
    const moved = changeReminder(call, { dueTime: "05:00" }, TOKYO);
    expect(moved).toMatchObject({ due: "2026-10-22", dueTime: "05:00", timeZone: TOKYO });
    expect(alertOf(moved)).toBe(utc(2026, 10, 21, 20));
    expect(changeReminder(call, { notes: "agenda" }, TOKYO)).toEqual({ ...call, notes: "agenda" });
    const cleared = changeReminder(
      call,
      { due: undefined, dueTime: undefined, repeat: undefined, repeatEnd: undefined },
      TOKYO,
    );
    expect(cleared.due).toBeUndefined();
    expect("timeZone" in cleared).toBe(false);
    const dated = changeReminder(
      { id: "a", listId: "work", title: "A" },
      { due: "2026-10-21" },
      NY,
    );
    expect(dated.timeZone).toBe(NY);
  });
});

describe("a reminder of another zone on the Ferrite application", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is listed on this browser's clocks, and a save from here keeps its zone and instant", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const sent: { data: { reminders: Reminder[] }; alerts: Record<string, number> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          sent.push(JSON.parse(String(init.body)));
          return new Response(JSON.stringify({ rev: 2 }), { status: 200 });
        }
        if (url === "/api/reminders/alerts") {
          return new Response(JSON.stringify({ alerts: [] }), { status: 200 });
        }
        const data = { lists: [{ id: "work", name: "Work", color: "green" }], reminders: [call] };
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { Reminders: Fresh } = await import("./reminders");
    const user = userEvent.setup();
    render(<Fresh defaultSource="work" today="2026-10-21" />);
    // The row says the moment on this process's clocks, whatever zone the tests run in.
    const here = new Date(utc(2026, 10, 21, 19));
    const minute = `${here.getHours() % 12 || 12}:${`${here.getMinutes()}`.padStart(2, "0")} ${here.getHours() < 12 ? "AM" : "PM"}`;
    const row = await waitFor(() => {
      const found = rowOf("Call");
      if (!found) throw new Error("no row titled Call yet");
      return found;
    });
    expect(row).toHaveTextContent(minute);

    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Plain{Enter}");
    await vi.waitFor(() => expect(sent).toHaveLength(1), { timeout: 3000 });
    const saved = sent[0];
    const kept = saved?.data.reminders.find((each) => each.id === "call");
    expect(kept).toMatchObject({ due: "2026-10-21", dueTime: "15:00", timeZone: NY });
    expect(saved?.alerts.call).toBe(utc(2026, 10, 21, 19));
    // A reminder with no due day names no zone.
    const plain = saved?.data.reminders.find((each) => each.title === "Plain");
    expect(plain && "timeZone" in plain).toBe(false);
    await waitFor(() => expect(rowOf("Call")).toBeDefined());
  });
});
