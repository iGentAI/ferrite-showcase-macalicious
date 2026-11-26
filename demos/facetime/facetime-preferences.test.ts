import { describe, expect, it } from "vitest";
import { readOff, readRingtone } from "./facetime-preferences";
import { RINGTONES, ringNotes } from "./facetime-ring";

describe("the settings as stored", () => {
  it("reads only what FaceTime wrote", () => {
    expect(readOff(true)).toBe(true);
    expect(readOff("yes")).toBeUndefined();
    expect(readRingtone("Silk")).toBe("Silk");
    expect(readRingtone("Nope")).toBeUndefined();
    expect(readRingtone(3)).toBeUndefined();
  });
});

describe("ringNotes", () => {
  it("gives each ringtone a phrase of its own", () => {
    const phrases = new Set(RINGTONES.map((name) => ringNotes(name).join()));
    expect(phrases.size).toBe(RINGTONES.length);
  });
  it("plays the first for a name it does not know", () => {
    expect(ringNotes("Nope")).toEqual(ringNotes("Opening"));
  });
});
