import { describe, expect, it } from "vitest";
import type { LibraryPhoto } from "./photos-library";
import { memoriesOf, peopleOf, photosOfSource } from "./photos-served-data";

const DAY = 24 * 60 * 60 * 1000;
const START = new Date(2024, 5, 1, 12).getTime();
const photo = (id: string, day: number, more: Partial<LibraryPhoto> = {}) =>
  ({
    id,
    taken_ms: START + day * DAY,
    deleted_ms: null,
    hidden: false,
    favorite: false,
    location: null,
    people: [],
    ...more,
  }) as LibraryPhoto;

const ids = (list: readonly LibraryPhoto[]) => list.map((each) => each.id);

describe("memoriesOf", () => {
  it("makes a memory of a run of three, split where more than two days pass", () => {
    const list = [photo("a", 0), photo("b", 1), photo("c", 3), photo("d", 6), photo("e", 7)];
    const memories = memoriesOf(list);
    expect(memories.map((each) => ids(each.photos))).toEqual([["a", "b", "c"]]);
    expect(memories[0]?.title).toBe("June 1, 2024");
    expect(memories[0]?.detail).toBe("June 2024, 3 Photos");
  });

  it("names a run for its commonest place", () => {
    const at = (name: string) => ({ location: { lat: 0, lon: 0, name } });
    const memories = memoriesOf([
      photo("a", 0, at("Delft")),
      photo("b", 0, at("Leiden")),
      photo("c", 0, at("Leiden")),
    ]);
    expect(memories[0]?.title).toBe("Leiden");
  });

  it("leaves out hidden and deleted photos", () => {
    const list = [photo("a", 0), photo("b", 0, { hidden: true }), photo("c", 0, { deleted_ms: 1 })];
    expect(memoriesOf(list)).toEqual([]);
  });

  it("adds a Best of per year with six photos, favourites first", () => {
    const list = [0, 10, 20, 30, 40].map((day) => photo(`p${day}`, day));
    list.push(photo("loved", 50, { favorite: true }));
    const best = memoriesOf(list).find((each) => each.title === "Best of 2024");
    expect(best?.id).toBe("year-2024");
    expect(best?.photos[0]?.id).toBe("loved");
    expect(best?.photos).toHaveLength(6);
  });
});

describe("peopleOf", () => {
  it("lists a person per name ignoring case, by most photos, leaving out hidden and deleted", () => {
    const list = [
      photo("a", 0, { people: ["Ann"] }),
      photo("b", 1, { people: ["ann", "Bo"] }),
      photo("c", 2, { people: ["Cy"], hidden: true }),
      photo("d", 3, { people: ["Di"], deleted_ms: 1 }),
    ];
    expect(peopleOf(list).map((each) => [each.name, ids(each.photos)])).toEqual([
      ["Ann", ["a", "b"]],
      ["Bo", ["b"]],
    ]);
  });

  it("gives a person's address the person's photos", () => {
    const list = [photo("a", 0, { people: ["Ann"] }), photo("b", 1, { people: [] })];
    expect(ids(photosOfSource("person:ann", list, [], 0))).toEqual(["a"]);
    expect(photosOfSource("person:gone", list, [], 0)).toEqual([]);
  });
});

describe("photosOfSource", () => {
  it("lists a memory's photos by its address, and nothing for one that is gone", () => {
    const list = [photo("a", 0), photo("b", 0), photo("c", 0)];
    expect(ids(photosOfSource("memory:run-a", list, [], 0))).toEqual(["a", "b", "c"]);
    expect(photosOfSource("memory:run-gone", list, [], 0)).toEqual([]);
    expect(ids(photosOfSource("memories", list, [], 0))).toEqual(["a", "b", "c"]);
  });
});
