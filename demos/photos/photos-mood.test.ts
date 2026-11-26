import { describe, expect, it } from "vitest";
import { memoryMovieOf, readMemoryMoods, songOfMood, withMemoryMood } from "./photos-mood";

describe("a memory's Mood", () => {
  it("sets each picture's time and how one leads to the next", () => {
    expect(memoryMovieOf("Gentle")).toEqual({ seconds: 3, theme: "ken-burns" });
    expect(memoryMovieOf("Dreamy")).toEqual({ seconds: 5, theme: "dissolve" });
    expect(memoryMovieOf("Extreme")).toEqual({ seconds: 1, theme: "cut" });
  });

  it("names the first song for Gentle and another one along for each other mood", () => {
    const songs = ["a", "b", "c"];
    expect(songOfMood("Gentle", songs)).toBe("a");
    expect(songOfMood("Chill", songs)).toBe("b");
    expect(songOfMood("Uplifting", songs)).toBe("c");
    expect(songOfMood("Happy", songs)).toBe("a");
    expect(songOfMood("Sentimental", songs)).toBe("c");
    expect(songOfMood("Dreamy", songs)).toBe("b");
    expect(songOfMood("Epic", ["only"])).toBe("only");
    expect(songOfMood("Epic", [])).toBeUndefined();
  });

  it("keeps a choice by memory, forgets Gentle, and lets the oldest go past 40", () => {
    expect(withMemoryMood({}, "m1", "Club")).toEqual({ m1: "Club" });
    expect(withMemoryMood({ m1: "Club", m2: "Epic" }, "m1", "Gentle")).toEqual({ m2: "Epic" });
    let kept = {};
    for (let at = 0; at < 41; at += 1) kept = withMemoryMood(kept, `m${at}`, "Happy");
    expect(Object.keys(kept)).toHaveLength(40);
    expect(kept).not.toHaveProperty("m0");
    expect(kept).toHaveProperty("m40", "Happy");
  });

  it("reads only moods from what is stored", () => {
    expect(readMemoryMoods({ m1: "Epic", m2: "Loud", m3: 4 })).toEqual({ m1: "Epic" });
    expect(readMemoryMoods("Epic")).toBeUndefined();
    expect(readMemoryMoods(null)).toBeUndefined();
    expect(readMemoryMoods(["Epic"])).toBeUndefined();
  });
});
