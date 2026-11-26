import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { announcementAt, menuClockText, useHasVoice } from "./menu-clock";

const AT = new Date(2026, 10, 3, 14, 5, 7);
const FORMAT = {
  seconds: false,
  flash: false,
  hour24: false,
  amPm: true,
  weekday: true,
  date: false,
};
const text = (changes = {}, at = AT) =>
  menuClockText(at, { ...FORMAT, ...changes }).replace(/\s/g, " ");

describe("a voice to announce the time with", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is there only once the browser lists one, which it may do late", () => {
    const voices = new EventTarget();
    let listed: unknown[] = [];
    vi.stubGlobal("speechSynthesis", Object.assign(voices, { getVoices: () => listed }));
    const { result } = renderHook(() => useHasVoice());
    expect(result.current).toBe(false);
    listed = [{ name: "Samantha" }];
    act(() => {
      voices.dispatchEvent(new Event("voiceschanged"));
    });
    expect(result.current).toBe(true);
  });

  it("is not there in a browser without speech", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(renderHook(() => useHasVoice()).result.current).toBe(false);
  });
});

describe("announcing the time", () => {
  it("says the time only at the minutes chosen", () => {
    expect(announcementAt(new Date(2026, 2, 14, 16, 0), 60)).toMatch(/^It's 4:00\sPM$/);
    expect(announcementAt(new Date(2026, 2, 14, 16, 30), 60)).toBeNull();
    expect(announcementAt(new Date(2026, 2, 14, 16, 30), 30)).toMatch(/^It's 4:30\sPM$/);
    expect(announcementAt(new Date(2026, 2, 14, 16, 15), 15)).toMatch(/^It's 4:15\sPM$/);
    expect(announcementAt(new Date(2026, 2, 14, 16, 16), 15)).toBeNull();
  });
});

describe("the menu bar clock's text", () => {
  it("is the day and the short time by default, as the Desktop screenshot shows it", () => {
    expect(text()).toBe("Tue 2:05 PM");
  });

  it("follows each setting of the Clock tab", () => {
    expect(text({ seconds: true })).toBe("Tue 2:05:07 PM");
    expect(text({ hour24: true })).toBe("Tue 14:05");
    expect(text({ amPm: false })).toBe("Tue 2:05");
    expect(text({ weekday: false })).toBe("2:05 PM");
    expect(text({ date: true })).toBe("Tue Nov 3 2:05 PM");
  });

  it("puts the separators out in every other second when they flash", () => {
    expect(text({ flash: true })).toBe("Tue 2 05 PM");
    expect(text({ flash: true }, new Date(2026, 10, 3, 14, 5, 8))).toBe("Tue 2:05 PM");
  });
});
