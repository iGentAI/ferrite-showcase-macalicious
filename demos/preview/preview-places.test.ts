import { describe, expect, it } from "vitest";
import {
  forgetPlace,
  MAX_PLACES,
  movedPlace,
  openedPlace,
  type Place,
  pagesShown,
  placesFromServer,
  placesToServer,
} from "./preview-places";

const place = (file: string, page = 1, zoom = 1): Place => ({
  file,
  name: `${file}.pdf`,
  page,
  zoom,
  opened_ms: 1,
});

describe("where Preview left each file", () => {
  it("reads the module's reply, an empty one, and refuses one that is not", () => {
    expect(placesFromServer({ places: [place("a", 3)], rev: 2 })).toEqual([place("a", 3)]);
    expect(placesFromServer({ places: null, rev: 0 })).toEqual([]);
    expect(placesFromServer({ places: [] })).toBeUndefined();
    expect(placesFromServer({ places: "x", rev: 1 })).toBeUndefined();
    expect(placesFromServer(null)).toBeUndefined();
    // A place that is not one is left out, not trusted.
    expect(placesFromServer({ places: [place("a"), { file: "b", page: 0 }], rev: 1 })).toEqual([
      place("a"),
    ]);
    expect(placesToServer([place("a")])).toEqual({ places: [place("a")] });
  });

  it("puts a file just opened first, once, and keeps at most twenty", () => {
    const list = [place("a"), place("b"), place("c")];
    expect(openedPlace(list, place("b", 4)).map((each) => each.file)).toEqual(["b", "a", "c"]);
    expect(openedPlace(list, place("b", 4))[0]?.page).toBe(4);
    const full = Array.from({ length: MAX_PLACES }, (_, n) => place(`f${n}`));
    const next = openedPlace(full, place("new"));
    expect(next).toHaveLength(MAX_PLACES);
    expect(next[0]?.file).toBe("new");
    expect(next.some((each) => each.file === `f${MAX_PLACES - 1}`)).toBe(false);
  });

  it("follows the page and zoom, answering the same list when nothing changed", () => {
    const list = [place("a", 1, 1), place("b")];
    expect(movedPlace(list, "a", 1, 1)).toBe(list);
    expect(movedPlace(list, "zz", 5, 2)).toBe(list);
    const moved = movedPlace(list, "a", 7, 1.25);
    expect(moved).not.toBe(list);
    expect(moved[0]).toMatchObject({ file: "a", page: 7, zoom: 1.25 });
    expect(moved[1]).toBe(list[1]);
    expect(forgetPlace(list, "a").map((each) => each.file)).toEqual(["b"]);
  });

  it("follows the display, keeping none for the continuous default", () => {
    const list = [place("a", 1, 1)];
    expect(movedPlace(list, "a", 1, 1, "continuous")).toBe(list);
    const two = movedPlace(list, "a", 1, 1, "two");
    expect(two[0]?.display).toBe("two");
    expect(movedPlace(two, "a", 1, 1, "continuous")[0]).not.toHaveProperty("display");
  });

  it("shows the pages of each display", () => {
    expect(pagesShown("continuous", 2, 3)).toEqual([1, 2, 3]);
    expect(pagesShown("single", 2, 3)).toEqual([2]);
    expect(pagesShown("two", 2, 3)).toEqual([1, 2]);
    expect(pagesShown("two", 3, 4)).toEqual([3, 4]);
    expect(pagesShown("two", 3, 3)).toEqual([3]);
    expect(pagesShown("contact", 2, 3)).toEqual([]);
  });
});
