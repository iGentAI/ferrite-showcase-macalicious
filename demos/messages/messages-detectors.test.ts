import { describe, expect, it } from "vitest";
import { parseQuickEvent } from "../calendar/calendar-quick-event";
import { detectedPieces, flightPage, trackingPage } from "./messages-detectors";

const found = (text: string) =>
  detectedPieces(text)
    .filter((piece) => piece.kind)
    .map((piece) => [piece.kind, piece.text]);

describe("what the detectors find in a message", () => {
  it.each([
    ["write to dana@example.com please", [["email", "dana@example.com"]]],
    ["call (555) 010-1234 now", [["phone", "(555) 010-1234"]]],
    ["or +1 555-010-1234.", [["phone", "+1 555-010-1234"]]],
    ["lunch tomorrow at 5pm?", [["date", "tomorrow at 5pm"]]],
    ["see you next Friday", [["date", "next Friday"]]],
    ["on Dec 3rd at 10:30 am", [["date", "Dec 3rd at 10:30 am"]]],
    ["on May 1, 2030 at 5pm.", [["date", "May 1, 2030 at 5pm"]]],
    ["meet at 4 pm", [["date", "at 4 pm"]]],
    ["come to 12 Oak Lane please", [["address", "12 Oak Lane"]]],
    ["it is 221 Baker St.", [["address", "221 Baker St."]]],
    ["on flight UA 123 tonight", [["flight", "flight UA 123"]]],
    ["parcel 1Z999AA10123456784 is out", [["tracking", "1Z999AA10123456784"]]],
    ["or 9400111899223197428490 here", [["tracking", "9400111899223197428490"]]],
  ])("in %s", (text, wanted) => {
    expect(found(text)).toEqual(wanted);
  });

  it.each([
    "the marble 3 and 2024",
    "mayhem 12",
    "Sunday's best".replace("Sunday", "sundaes"),
    "room 5551234",
    "nobody@home",
    "3 people in the way",
    "flights UA 123",
  ])("finds nothing in %s", (text) => {
    expect(found(text)).toEqual([]);
  });

  it("finds a date Calendar's Quick Event reads the same", () => {
    const made = parseQuickEvent("May 1, 2030 at 5pm", new Date(2026, 0, 1));
    expect(made?.start).toEqual(new Date(2030, 4, 1, 17, 0));
  });

  it("knows where a flight and a parcel are followed", () => {
    expect(flightPage("flight ua 123")).toBe("https://www.flightaware.com/live/flight/UA123");
    expect(trackingPage("1z999aa10123456784")).toBe(
      "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    );
    expect(trackingPage("9400111899223197428490")).toBe(
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428490",
    );
  });

  it("keeps every character, in order", () => {
    const text = "at 5pm, dana@example.com or 555-010-1234!";
    expect(
      detectedPieces(text)
        .map((piece) => piece.text)
        .join(""),
    ).toBe(text);
  });
});
