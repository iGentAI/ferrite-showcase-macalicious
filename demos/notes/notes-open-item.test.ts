import { describe, expect, it } from "vitest";
import { noteOfOpenItem } from "./notes-shared";

const NOTE = "sh-0123456789abcdef01234567";

describe("the note a request to open an item of Notes names", () => {
  it("is the note a shared note's notification tells of", () => {
    expect(noteOfOpenItem(`share-${NOTE}`)).toBe(NOTE);
    expect(noteOfOpenItem(`share-${NOTE}-12`)).toBe(NOTE);
    expect(noteOfOpenItem(`left-${NOTE}-12`)).toBe(NOTE);
  });

  it("is none for a note the person was taken off", () => {
    expect(noteOfOpenItem(`unshare-${NOTE}-12`)).toBeNull();
  });

  it("is the id itself for Spotlight, even an own note's id with such a start", () => {
    expect(noteOfOpenItem(NOTE)).toBe(NOTE);
    expect(noteOfOpenItem("catalina")).toBe("catalina");
    expect(noteOfOpenItem("left-overs")).toBe("left-overs");
  });
});
