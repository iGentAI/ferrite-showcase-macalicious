import { describe, expect, it } from "vitest";
import {
  choiceOf,
  EMPTY_PAGE,
  isSafeFile,
  keptDownloadRows,
  newPageAddress,
  optionOf,
  readSafariSettings,
  SAFE_FILES,
  staleVisits,
  TAB_KEYS,
} from "./safari-settings";

const DAY = 86_400_000;
const NOW = 400 * DAY;

describe("Safari's kept settings", () => {
  it("keeps text and choices only", () => {
    expect(readSafariSettings({ homepage: "a", [TAB_KEYS]: true, junk: 1, other: {} })).toEqual({
      homepage: "a",
      [TAB_KEYS]: true,
    });
    expect(readSafariSettings([])).toBeUndefined();
    expect(readSafariSettings("x")).toBeUndefined();
  });

  it("starts each pop-up button as the captures do, and a served Safari opens nothing unasked", () => {
    expect(choiceOf({}, "topSites")).toBe("12 sites");
    expect(choiceOf({ topSites: "6 sites" }, "topSites")).toBe("6 sites");
    expect(optionOf({}, SAFE_FILES)).toBe(true);
    expect(optionOf({}, SAFE_FILES, true)).toBe(false);
    expect(optionOf({ [SAFE_FILES]: true }, SAFE_FILES, true)).toBe(true);
    expect(optionOf({}, TAB_KEYS)).toBe(false);
  });

  it("opens a new tab or window on the page its choice names", () => {
    const page = (choice: string) => newPageAddress(choice, "https://home/", "https://now/", "");
    expect(page("Favorites")).toBe("");
    expect(page("Homepage")).toBe("https://home/");
    expect(page("Empty Page")).toBe(EMPTY_PAGE);
    expect(page("Same Page")).toBe("https://now/");
  });

  it("takes history items off by their age, and none when set to Manually", () => {
    const visits = [
      { url: "new", at: NOW - DAY / 2 },
      { url: "week", at: NOW - 3 * DAY },
      { url: "old", at: NOW - 366 * DAY },
    ];
    expect(staleVisits(visits, "After one day", NOW)).toEqual(["week", "old"]);
    expect(staleVisits(visits, "After one week", NOW)).toEqual(["old"]);
    expect(staleVisits(visits, "After one year", NOW)).toEqual(["old"]);
    expect(staleVisits(visits, "Manually", NOW)).toEqual([]);
  });

  it("takes download rows off as chosen, and hands back the same list when nothing goes", () => {
    const fresh = { at: NOW - 1000 };
    const stale = { at: NOW - 2 * DAY };
    const rows = [fresh, stale];
    expect(keptDownloadRows(rows, "After one day", NOW)).toEqual([fresh]);
    const kept = [fresh];
    expect(keptDownloadRows(kept, "After one day", NOW)).toBe(kept);
    expect(keptDownloadRows(rows, "Upon successful download", NOW)).toEqual([]);
    expect(keptDownloadRows(rows, "Manually", NOW)).toBe(rows);
    expect(keptDownloadRows(rows, "When Safari quits", NOW)).toBe(rows);
  });

  it("counts movies, pictures, sounds, PDF, text and archives as safe, and a page or a program not", () => {
    for (const name of ["a.mp4", "b.JPG", "c.mp3", "d.pdf", "e.txt", "f.zip"]) {
      expect(isSafeFile(name), name).toBe(true);
    }
    for (const name of ["a.html", "b.exe", "c.dmg", "noname"]) {
      expect(isSafeFile(name), name).toBe(false);
    }
  });
});
