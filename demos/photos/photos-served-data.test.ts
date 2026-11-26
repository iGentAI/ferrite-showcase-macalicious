import { describe, expect, it } from "vitest";
import { NO_EDIT } from "./photos-edit";
import type { LibraryAlbum, LibraryPhoto } from "./photos-library";
import {
  daysLeft,
  fittedBox,
  groupPhotos,
  importBatches,
  photosOfSource,
  RECENT_MS,
  ruleMatches,
  searchMatches,
  searchSuggestions,
  spanText,
  thumbKey,
} from "./photos-served-data";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 14, 12).getTime();

const photo = (id: string, more: Partial<LibraryPhoto> = {}): LibraryPhoto => ({
  id,
  file: `f-${id}`,
  name: id,
  mime: "image/jpeg",
  bytes: 1000,
  width: 4000,
  height: 3000,
  taken_ms: NOW,
  added_ms: NOW,
  source: "import",
  effect: null,
  camera: null,
  favorite: false,
  deleted_ms: null,
  edit: null,
  edited_ms: null,
  title: null,
  caption: null,
  keywords: [],
  people: [],
  location: null,
  hidden: false,
  exif: null,
  duration_ms: null,
  ...more,
});

const ids = (photos: readonly LibraryPhoto[]) => photos.map((each) => each.id);

describe("the served library's sources", () => {
  const photos = [
    photo("old", { taken_ms: new Date(2019, 9, 7).getTime(), added_ms: NOW - 40 * DAY }),
    photo("fav", { taken_ms: new Date(2020, 0, 1).getTime(), favorite: true }),
    photo("booth", { source: "photo-booth", added_ms: NOW - DAY }),
    photo("gone", { deleted_ms: NOW - 2 * DAY }),
  ];
  const albums: LibraryAlbum[] = [
    {
      id: "a",
      name: "Trip",
      photos: ["booth", "gone", "old"],
      created_ms: 0,
      sort: "custom" as const,
      key_photo: null,
      folder: null,
    },
  ];

  it("lists what each row holds, leaving Recently Deleted to its own row", () => {
    expect(ids(photosOfSource("library", photos, albums, NOW))).toEqual(["old", "fav", "booth"]);
    expect(ids(photosOfSource("favorites", photos, albums, NOW))).toEqual(["fav"]);
    expect(ids(photosOfSource("recents", photos, albums, NOW))).toEqual(["fav", "booth"]);
    expect(ids(photosOfSource("imports", photos, albums, NOW))).toEqual(["fav", "old"]);
    expect(ids(photosOfSource("photo-booth", photos, albums, NOW))).toEqual(["booth"]);
    expect(ids(photosOfSource("deleted", photos, albums, NOW))).toEqual(["gone"]);
    // An album keeps its own order and hides a deleted photo.
    expect(ids(photosOfSource("album:a", photos, albums, NOW))).toEqual(["booth", "old"]);
    expect(photosOfSource("album:none", photos, albums, NOW)).toEqual([]);
  });

  it("looks back 30 days for Recents", () => {
    const edge = [
      photo("in", { added_ms: NOW - RECENT_MS }),
      photo("out", { added_ms: NOW - RECENT_MS - 1 }),
    ];
    expect(ids(photosOfSource("recents", edge, [], NOW))).toEqual(["in"]);
  });

  it("finds a photo by its name, month, camera, album or what it is", () => {
    const trip = photo("Beach_Day.jpg", {
      name: "Beach Day",
      camera: "Canon EOS R",
      favorite: true,
      taken_ms: new Date(2019, 9, 7).getTime(),
    });
    const albums = [
      {
        id: "a",
        name: "Summer Trip",
        photos: [trip.id],
        created_ms: 0,
        sort: "custom" as const,
        key_photo: null,
        folder: null,
      },
    ];
    for (const query of [
      "beach",
      "Day bea",
      "october",
      "2019",
      "canon",
      "summer",
      "favorite",
      "",
    ]) {
      expect(searchMatches(trip, query, albums), query).toBe(true);
    }
    for (const query of ["winter", "edited", "each"]) {
      expect(searchMatches(trip, query, albums), query).toBe(false);
    }
  });

  it("groups by day, month and year, in the order taken", () => {
    const list = [
      photo("c", { taken_ms: new Date(2019, 9, 8, 9).getTime() }),
      photo("a", { taken_ms: new Date(2019, 9, 7, 9).getTime() }),
      photo("b", { taken_ms: new Date(2019, 9, 7, 18).getTime() }),
      photo("d", { taken_ms: new Date(2020, 0, 1).getTime() }),
    ];
    const days = groupPhotos(list, "day");
    expect(days.map((group) => group.title)).toEqual([
      "Monday, October 7, 2019",
      "Tuesday, October 8, 2019",
      "Wednesday, January 1, 2020",
    ]);
    expect(ids(days[0]?.photos ?? [])).toEqual(["a", "b"]);
    expect(days[0]?.detail).toBe("2 Photos");
    expect(groupPhotos(list, "month").map((group) => group.key)).toEqual(["2019-10", "2020-01"]);
    expect(groupPhotos(list, "year").map((group) => group.title)).toEqual(["2019", "2020"]);
    expect(spanText(list)).toBe("October 2019 – January 2020");
  });

  it("names a group's places in its second line, commonest first", () => {
    const at = new Date(2019, 9, 7).getTime();
    const placed = (id: string, name: string) =>
      photo(id, { taken_ms: at, location: { lat: 52, lon: 4, name } });
    const one = (list: Parameters<typeof groupPhotos>[0]) => groupPhotos(list, "month")[0]?.detail;
    expect(one([placed("a", "Delft")])).toBe("Delft, 1 Photo");
    expect(one([placed("a", "Leiden"), placed("b", "Delft"), placed("c", "Delft")])).toBe(
      "Delft & Leiden, 3 Photos",
    );
    expect(
      one([
        placed("a", "Delft"),
        placed("b", "Delft"),
        placed("c", "Leiden"),
        placed("d", "Gouda"),
        placed("e", "Breda"),
      ]),
    ).toBe("Delft, Leiden & 2 more, 5 Photos");
    expect(one([photo("a", { taken_ms: at })])).toBe("1 Photo");
  });

  it("splits Imports into batches where the adding paused for two minutes or more", () => {
    const minute = 60_000;
    const split = (gap: number) =>
      importBatches([photo("a", { added_ms: NOW }), photo("b", { added_ms: NOW - gap })]).length;
    expect(split(2 * minute - 1)).toBe(1);
    expect(split(2 * minute)).toBe(2);
    expect(split(2 * minute + 1)).toBe(2);
    const batches = importBatches([
      photo("old", { added_ms: NOW - 10 * minute }),
      photo("new", { added_ms: NOW }),
      photo("next", { added_ms: NOW - minute }),
      photo("chain", { added_ms: NOW - 2.5 * minute }),
    ]);
    expect(batches.map((batch) => ids(batch.photos))).toEqual([["new", "next", "chain"], ["old"]]);
    expect(batches[0]?.detail).toBe("3 Photos");
    expect(batches[0]?.title).toMatch(/^October 14, 2026 at /);
  });

  for (const zone of ["America/Los_Angeles", "Asia/Tokyo"]) {
    it(`compares a smart album's date rule with the start of that day in ${zone}`, () => {
      const before = process.env.TZ;
      process.env.TZ = zone;
      try {
        const midnight = new Date(2020, 0, 15).getTime();
        const rule = (op: "before" | "after", value = "2020-01-15") =>
          ({ field: "date", op, value }) as Parameters<typeof ruleMatches>[1];
        const justBefore = photo("a", { taken_ms: midnight - 1 });
        const atMidnight = photo("b", { taken_ms: midnight });
        expect(ruleMatches(justBefore, rule("before"), [], NOW)).toBe(true);
        expect(ruleMatches(atMidnight, rule("before"), [], NOW)).toBe(false);
        expect(ruleMatches(justBefore, rule("after"), [], NOW)).toBe(false);
        expect(ruleMatches(atMidnight, rule("after"), [], NOW)).toBe(true);
        expect(ruleMatches(atMidnight, rule("after", "2020-02-31"), [], NOW)).toBe(false);
      } finally {
        process.env.TZ = before;
      }
    });
  }

  it("keeps a smart album's Title rule to titles, and leaves file names to Filename", () => {
    const named = photo("a", { name: "beach", title: null });
    const rule = (field: "title" | "filename") =>
      ({ field, op: "includes", value: "beach" }) as Parameters<typeof ruleMatches>[1];
    expect(ruleMatches(named, rule("title"), [], NOW)).toBe(false);
    expect(ruleMatches(named, rule("filename"), [], NOW)).toBe(true);
    expect(ruleMatches({ ...named, title: "The beach" }, rule("title"), [], NOW)).toBe(true);
  });

  it("lists what the library holds by kind, with what a search for each finds", () => {
    const photos = [
      photo("a", { people: ["Marie"], keywords: ["mountain"], camera: "Mamiya", title: "Mist" }),
      photo("b", { keywords: ["mountain"], location: { name: "Marseille", lat: 43, lon: 5 } }),
    ] as LibraryPhoto[];
    const albums = [{ id: "al", name: "Maps", photos: ["b"] }] as unknown as LibraryAlbum[];
    expect(
      searchSuggestions(photos, "m", albums).map(({ kind, text, count }) => [kind, text, count]),
    ).toEqual([
      ["People", "Marie", 1],
      ["Places", "Marseille", 1],
      ["Keywords", "mountain", 2],
      ["Albums", "Maps", 1],
      ["Cameras", "Mamiya", 1],
      ["Photos", "Mist", 1],
    ]);
    expect(searchSuggestions(photos, "  ", albums)).toEqual([]);
    expect(searchSuggestions(photos, "zebra", albums)).toEqual([]);
  });

  it("counts the days left in Recently Deleted", () => {
    expect(daysLeft(photo("x", { deleted_ms: NOW }), NOW)).toBe(30);
    // Deleted after the page last read the clock: still the whole 30 days.
    expect(daysLeft(photo("x", { deleted_ms: NOW + DAY }), NOW)).toBe(30);
    expect(daysLeft(photo("x", { deleted_ms: NOW - 29.5 * DAY }), NOW)).toBe(1);
    expect(daysLeft(photo("x", { deleted_ms: NOW - 31 * DAY }), NOW)).toBe(0);
  });

  it("draws an edited photo at its edited shape and rereads its thumbnail after an edit", () => {
    const turned = photo("t", { edit: { ...NO_EDIT, rotate: 1 }, edited_ms: 5 });
    expect(fittedBox(turned, 128)).toEqual({ width: 96, height: 128 });
    expect(fittedBox(photo("p"), 128)).toEqual({ width: 128, height: 96 });
    expect(thumbKey(turned)).not.toBe(thumbKey({ ...turned, edited_ms: 6 }));
  });
});
