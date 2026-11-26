import { describe, expect, it } from "vitest";
import {
  dropPlaceOn,
  dropRefusal,
  dropRow,
  dropRows,
  dropRowsRefusal,
  rowOf,
  withoutRows,
} from "./maps-places-rows";
import { MAX_GUIDE_PLACES, type PlacesDocument, type ServedPlace } from "./maps-server";

const place = (id: string): ServedPlace => ({
  id,
  name: id,
  category: "",
  lat: 1,
  lon: 2,
  address: [],
});
const A = place("a");
const B = place("b");
const C = place("c");
const D = place("d");
const doc: PlacesDocument = {
  favorites: [A, B, C],
  recents: [D],
  guides: [
    { id: "g1", name: "One", places: [A, B] },
    { id: "g2", name: "Two", places: [C] },
    { id: "g3", name: "Three", places: [] },
  ],
};
const ids = (list: readonly { id: string }[]) => list.map(({ id }) => id).join();

describe("dragging a row of the Places sidebar", () => {
  it("reorders Favorites", () => {
    expect(ids(dropRow(doc, "favorite:c", "favorite:a", "before").favorites)).toBe("c,a,b");
    expect(ids(dropRow(doc, "favorite:a", "favorite:b", "after").favorites)).toBe("b,a,c");
  });

  it("reorders guides, whose rows take no guide inside them", () => {
    expect(ids(dropRow(doc, "guide:g3", "guide:g1", "before").guides)).toBe("g3,g1,g2");
    expect(dropPlaceOn(doc, "guide:g3", "guide:g1", true)).toBe("before");
    expect(dropPlaceOn(doc, "guide:g3", "favorite:a", true)).toBeUndefined();
  });

  it("puts a Favorite or Recent in a guide, where it also stays", () => {
    expect(dropPlaceOn(doc, "recent:d", "guide:g3", true)).toBe("into");
    const after = dropRow(doc, "recent:d", "guide:g3", "into");
    expect(ids(after.guides[2]?.places ?? [])).toBe("d");
    expect(ids(after.recents)).toBe("d");
  });

  it("reorders within a guide, and moves between guides", () => {
    const within = dropRow(doc, "guide:g1:b", "guide:g1:a", "before");
    expect(ids(within.guides[0]?.places ?? [])).toBe("b,a");
    const between = dropRow(doc, "guide:g1:b", "guide:g2:c", "before");
    expect(ids(between.guides[0]?.places ?? [])).toBe("a");
    expect(ids(between.guides[1]?.places ?? [])).toBe("b,c");
  });

  it("lands nowhere on Recents or on itself", () => {
    expect(dropPlaceOn(doc, "favorite:a", "recent:d", true)).toBeUndefined();
    expect(dropPlaceOn(doc, "favorite:a", "favorite:a", true)).toBeUndefined();
  });

  it("says why a full guide takes no more, and leaves it as it was", () => {
    const many = Array.from({ length: MAX_GUIDE_PLACES }, (_, at) => place(`p${at}`));
    const full = { ...doc, guides: [{ id: "g1", name: "One", places: many }] };
    expect(dropRefusal(full, "recent:d", "guide:g1")).toBe(
      "“One” holds 200 places, the most a guide keeps.",
    );
    expect(dropRow(full, "recent:d", "guide:g1", "into")).toBe(full);
  });
});

describe("dragging several rows of the Places sidebar", () => {
  it("lands them together in the order chosen, before or after the row", () => {
    expect(ids(dropRows(doc, ["favorite:b", "favorite:c"], "favorite:a", "before").favorites)).toBe(
      "b,c,a",
    );
    expect(ids(dropRows(doc, ["favorite:a", "favorite:b"], "favorite:c", "after").favorites)).toBe(
      "c,a,b",
    );
  });

  it("leaves the row they land on where it is, when it is one of them", () => {
    expect(ids(dropRows(doc, ["favorite:a", "favorite:c"], "favorite:a", "after").favorites)).toBe(
      "a,c,b",
    );
  });

  it("joins a guide's list in the order chosen, wherever on its row they land", () => {
    const empty: PlacesDocument = {
      favorites: [A, B],
      recents: [],
      guides: [{ id: "g", name: "Trip", places: [] }],
    };
    for (const place of ["before", "after"] as const) {
      const [guide] = dropRows(empty, ["favorite:a", "favorite:b"], "guide:g", place).guides;
      expect(guide?.places.map(({ id }) => id).join(",")).toBe("a,b");
    }
  });

  it("keeps the order chosen when they land on one of themselves, before or after it", () => {
    const chosen = ["favorite:a", "favorite:c"];
    for (const place of ["before", "after"] as const) {
      expect(ids(dropRows(doc, chosen, "favorite:a", place).favorites)).toBe("a,c,b");
      expect(ids(dropRows(doc, chosen, "favorite:c", place).favorites)).toBe("b,a,c");
    }
  });

  it("refuses the whole drag when a list has room for only some of them", () => {
    const filler = Array.from({ length: MAX_GUIDE_PLACES - 1 }, (_, n) => place(`p${n}`));
    const nearlyFull: PlacesDocument = {
      favorites: [A, B],
      recents: [],
      guides: [{ id: "g", name: "Trip", places: filler }],
    };
    const together = ["favorite:a", "favorite:b"];
    expect(dropRefusal(nearlyFull, "favorite:a", "guide:g")).toBeUndefined();
    expect(dropRefusal(nearlyFull, "favorite:b", "guide:g")).toBeUndefined();
    expect(dropRowsRefusal(nearlyFull, together, "guide:g", "before")).toMatch(/holds/);
    expect(dropRowsRefusal(nearlyFull, ["favorite:a"], "guide:g", "before")).toBeUndefined();
  });
});

describe("removing several rows", () => {
  it("removes each from its own list only", () => {
    const after = withoutRows(doc, ["favorite:a", "guide:g1:b", "recent:d"]);
    expect(ids(after.favorites)).toBe("b,c");
    expect(ids(after.guides[0]?.places ?? [])).toBe("a");
    expect(after.recents).toEqual([]);
  });

  it("passes over a place gone with its guide", () => {
    const after = withoutRows(doc, ["guide:g1", "guide:g1:b"]);
    expect(ids(after.guides)).toBe("g2,g3");
    expect(rowOf(after, "guide:g1:b")).toBeNull();
  });
});
