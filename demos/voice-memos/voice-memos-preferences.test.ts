import { describe, expect, it } from "vitest";
import {
  clearedAt,
  DEFAULT_PREFERENCES,
  preferencesFromServer,
  preferencesToServer,
} from "./voice-memos-preferences";

const DAY = 86_400_000;

describe("Voice Memos' Preferences", () => {
  it("are the defaults before any are saved", () => {
    expect(preferencesFromServer({ preferences: null })).toEqual(DEFAULT_PREFERENCES);
  });

  it("read what was saved, and nothing else", () => {
    const kept = { audioQuality: "lossless", clearDeleted: "week" } as const;
    expect(preferencesFromServer(preferencesToServer(kept))).toEqual(kept);
    expect(
      preferencesFromServer({ preferences: { audioQuality: "best", clearDeleted: "week" } }),
    ).toBeUndefined();
    expect(
      preferencesFromServer({
        preferences: { audioQuality: "lossless", clearDeleted: "toString" },
      }),
    ).toBeUndefined();
    expect(preferencesFromServer({})).toBeUndefined();
  });

  it("clear a deleted recording once it has been kept that long", () => {
    expect(clearedAt("immediately", 100)).toBe(100);
    expect(clearedAt("day", 0)).toBe(DAY);
    expect(clearedAt("week", 0)).toBe(7 * DAY);
    expect(clearedAt("month", 0)).toBe(30 * DAY);
    expect(clearedAt("never", 0)).toBeNull();
  });
});
