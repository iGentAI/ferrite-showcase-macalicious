import { describe, expect, it } from "vitest";
import { isCalendarFile } from "./mail-attachments";

describe("a calendar file in a message", () => {
  it("is known by its type or its name", () => {
    expect(isCalendarFile({ type: "text/calendar", name: "a" })).toBe(true);
    expect(isCalendarFile({ type: "application/octet-stream", name: "Trip.ICS" })).toBe(true);
    expect(isCalendarFile({ type: "text/plain", name: "notes.txt" })).toBe(false);
  });
});
