import { beforeEach, describe, expect, it } from "vitest";
import { readWindowState, writeWindowState } from "./calendar-window-state";

const state = { view: "month" as const, date: 1_000, hidden: ["home"], listShown: false };

describe("Calendar's saved window state", () => {
  beforeEach(() => window.localStorage.clear());

  it("reads back what was written, per account", () => {
    writeWindowState("chris", state);
    expect(readWindowState("chris")).toEqual(state);
    expect(readWindowState("martin")).toBeNull();
  });

  it.each([
    ["not JSON", "{"],
    ["another view", JSON.stringify({ ...state, view: "decade" })],
    ["no date", JSON.stringify({ ...state, date: "today" })],
    ["a date no calendar has", JSON.stringify({ ...state, date: 1e20 })],
    ["a calendar that is no name", JSON.stringify({ ...state, hidden: [1] })],
    ["no list", JSON.stringify({ view: "day", date: 1, hidden: [] })],
  ])("keeps nothing from %s", (_, stored) => {
    window.localStorage.setItem("macalicious.calendar.window.chris", stored);
    expect(readWindowState("chris")).toBeNull();
  });
});
