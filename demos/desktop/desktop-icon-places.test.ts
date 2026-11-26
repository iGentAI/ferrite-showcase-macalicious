import { describe, expect, it } from "vitest";
import {
  cleanedUp,
  firstFreeCell,
  type IconGrid,
  inOrder,
  movedPlaces,
  nearestFreeCell,
  placedAt,
  placesForItems,
  placesToShow,
  readIconPlaces,
  rescaledPlaces,
} from "./desktop-icon-places";

const GRID: IconGrid = {
  cellWidth: 100,
  cellHeight: 100,
  startRight: 10,
  startTop: 30,
  width: 410,
  height: 330,
};
const cell = (column: number, row: number) => ({
  right: 10 + column * 100,
  top: 30 + row * 100,
});

describe("where the desktop's icons stand", () => {
  it("carries places to a larger grid, cell for cell", () => {
    const larger = { ...GRID, cellWidth: 200, cellHeight: 150 };
    expect(rescaledPlaces({ a: cell(1, 2), b: { right: 60, top: 80 } }, GRID, larger)).toEqual({
      a: { right: 210, top: 330 },
      b: { right: 110, top: 105 },
    });
  });

  it("reads only well-formed places", () => {
    expect(readIconPlaces([])).toBeUndefined();
    expect(readIconPlaces({ a: { right: 1, top: 2 }, b: { right: "x", top: 2 }, c: null })).toEqual(
      { a: { right: 1, top: 2 } },
    );
  });

  it("answers a stored value that is all well formed as it is", () => {
    const stored = { a: { right: 1, top: 2 } };
    expect(readIconPlaces(stored)).toBe(stored);
  });

  it("fills down from the top right, then the next column to the left", () => {
    expect(firstFreeCell([], GRID)).toEqual(cell(0, 0));
    expect(firstFreeCell([cell(0, 0), cell(0, 1)], GRID)).toEqual(cell(0, 2));
    expect(firstFreeCell([cell(0, 0), cell(0, 1), cell(0, 2)], GRID)).toEqual(cell(1, 0));
  });

  it("finds the nearest cell nothing holds", () => {
    expect(nearestFreeCell({ right: 120, top: 140 }, [], GRID)).toEqual(cell(1, 1));
    expect(nearestFreeCell({ right: 120, top: 140 }, [cell(1, 1)], GRID)).not.toEqual(cell(1, 1));
  });

  it("moves what was dragged by the drag and leaves the others", () => {
    const places = { a: cell(0, 0), b: cell(0, 1), c: cell(0, 2) };
    expect(movedPlaces(places, ["a", "b"], -50, 20, GRID, false, [])).toEqual({
      a: { right: 60, top: 50 },
      b: { right: 60, top: 150 },
      c: cell(0, 2),
    });
  });

  it("keeps a moved icon on the desktop", () => {
    expect(movedPlaces({ a: cell(0, 0) }, ["a"], 500, -500, GRID, false, []).a).toEqual({
      right: 0,
      top: 30,
    });
    expect(movedPlaces({ a: cell(0, 0) }, ["a"], -900, 900, GRID, false, []).a).toEqual({
      right: 310,
      top: 230,
    });
  });

  it("moves a selection against an edge as one, so that no icon comes to lie on another", () => {
    const places = { a: cell(0, 0), b: cell(0, 1) };
    expect(movedPlaces(places, ["a", "b"], -900, 900, GRID, false, [])).toEqual({
      a: { right: 310, top: 130 },
      b: { right: 310, top: 230 },
    });
    expect(movedPlaces(places, ["a", "b"], 900, -900, GRID, false, [])).toEqual({
      a: { right: 0, top: 30 },
      b: { right: 0, top: 130 },
    });
  });

  it("keeps every icon of a selection on a desktop that has shrunk to less than its spread", () => {
    const narrow = { ...GRID, width: 120 };
    const moved = movedPlaces(
      { a: cell(0, 0), b: cell(3, 0) },
      ["a", "b"],
      0,
      0,
      narrow,
      false,
      [],
    );
    expect(moved).toEqual({ a: { right: 0, top: 30 }, b: { right: 20, top: 30 } });
  });

  it("snaps a moved icon to a free cell, and two never share one", () => {
    const places = { a: cell(0, 0), b: cell(0, 1) };
    const moved = movedPlaces(places, ["a", "b"], -100, 0, GRID, true, [cell(1, 0)]);
    expect(moved.a).not.toEqual(cell(1, 0));
    expect(moved.a).not.toEqual(moved.b);
    expect(moved.b).toEqual(cell(1, 1));
  });

  it("puts dropped items at the drop, one under another", () => {
    expect(placedAt({}, ["a", "b"], { right: 60, top: 40 }, GRID, false, [])).toEqual({
      a: { right: 60, top: 40 },
      b: { right: 60, top: 140 },
    });
    expect(placedAt({}, ["a"], { right: 120, top: 140 }, GRID, true, [])).toEqual({
      a: cell(1, 1),
    });
  });

  it("puts dropped items that do not fit down the desktop in the next column, none on another", () => {
    const dropped = placedAt({}, ["a", "b", "c"], { right: 60, top: 230 }, GRID, false, []);
    expect(dropped).toEqual({
      a: { right: 60, top: 230 },
      b: { right: 160, top: 230 },
      c: { right: 260, top: 230 },
    });
  });

  it("shows a place that fits as it is, and one past the window in a free cell, keeping the store", () => {
    const places = { a: { right: 55, top: 44 }, b: { right: 1000, top: 30 } };
    const shown = placesToShow(places, ["a", "b"], GRID, [cell(0, 0)]);
    expect(shown.a).toEqual({ right: 55, top: 44 });
    expect(shown.b).toEqual(cell(3, 0));
    expect(places.b).toEqual({ right: 1000, top: 30 });
  });

  it("shows two places a point apart past the window at places of their own", () => {
    const shown = placesToShow(
      { a: { right: 1000, top: 40 }, b: { right: 1001, top: 40 } },
      ["a", "b"],
      GRID,
      [],
    );
    expect(shown.a).not.toEqual(shown.b);
  });

  it("packs one column over the disks when they take the whole width", () => {
    const narrow = { ...GRID, width: 120 };
    const disks = [cell(0, 0), cell(0, 1), cell(0, 2)];
    expect(placesToShow({ a: { right: 1000, top: 500 } }, ["a"], narrow, disks)).toEqual({
      a: { right: 10, top: 30 },
    });
  });

  it("packs a desktop with no room past its disks over them, every icon at a place of its own", () => {
    const order = Array.from({ length: 9 }, (_, index) => `i${index}`);
    const places = Object.fromEntries(
      order.map((id, index) => [id, { right: 1000 + index, top: 500 }]),
    );
    const narrow = { ...GRID, width: 120 };
    const shown = placesToShow(places, order, narrow, [cell(0, 0)]);
    expect(shown.i0).toEqual({ right: 10, top: 30 });
    expect(shown.i3).toEqual({ right: 18, top: 30 });
    expect(shown.i6).toEqual({ right: 26, top: 30 });
    expect(new Set(Object.values(shown).map(({ right, top }) => `${right},${top}`)).size).toBe(9);
  });

  it("packs a full desktop so that each icon keeps a strip no later icon covers", () => {
    const order = Array.from({ length: 30 }, (_, index) => `i${index}`);
    const places = Object.fromEntries(
      order.map((id, index) => [id, { right: 1000 + index, top: 500 }]),
    );
    const shown = placesToShow(places, order, GRID, [cell(0, 0)]);
    expect(Object.keys(shown)).toHaveLength(30);
    // i0 is in the first of 10 columns, so nine later icons stand in its row.
    expect(order.filter((id) => shown[id]?.top === shown.i0?.top)).toHaveLength(10);
    // Past the disk's column: 200 points of room for 10 columns.
    const pitch = 200 / 9;
    expect(shown.i0).toEqual({ right: 110, top: 30 });
    expect(shown.i1).toEqual({ right: 110, top: 130 });
    expect(shown.i3).toEqual({ right: 110 + pitch, top: 30 });
    for (const [at, id] of order.entries()) {
      const place = shown[id];
      expect(place?.right).toBeLessThanOrEqual(310);
      const covering = order
        .slice(at + 1)
        .map((later) => shown[later])
        .filter((later) => later?.top === place?.top);
      for (const later of covering) {
        expect(later?.right).toBeGreaterThanOrEqual((place?.right ?? 0) + pitch - 0.001);
      }
    }
  });

  it("packs nothing over disks in two columns", () => {
    const order = Array.from({ length: 19 }, (_, index) => `i${index}`);
    const places = Object.fromEntries(
      order.map((id, index) => [id, { right: 1000 + index, top: 500 }]),
    );
    const shown = Object.values(placesToShow(places, order, GRID, [cell(0, 0), cell(1, 0)]));
    for (const { right } of shown) expect(right).toBeGreaterThanOrEqual(210);
  });

  it("cleans up to the grid, around what is reserved", () => {
    const cleaned = cleanedUp({ a: { right: 15, top: 35 }, b: { right: 20, top: 40 } }, GRID, [
      cell(0, 1),
    ]);
    expect(cleaned.a).toEqual(cell(0, 0));
    expect(cleaned.b).not.toEqual(cell(0, 0));
    expect(cleaned.b).not.toEqual(cell(0, 1));
  });

  it("puts ids in order for Clean Up By", () => {
    expect(inOrder(["b", "a"], GRID, [cell(0, 0)])).toEqual({ b: cell(0, 1), a: cell(0, 2) });
  });

  it("gives a new item a free cell and forgets one that left", () => {
    const places = { a: cell(0, 0), gone: cell(0, 1) };
    expect(placesForItems(places, ["a", "new"], GRID, [])).toEqual({
      a: cell(0, 0),
      new: cell(0, 1),
    });
  });

  it("answers the same record when nothing changed", () => {
    const places = { a: cell(0, 0) };
    expect(placesForItems(places, ["a"], GRID, [])).toBe(places);
  });

  it("gives every item a cell of its own when there are more than fit, around a reserved one", () => {
    // This grid holds three rows by four columns: twelve cells, one of them a disk's.
    const ids = Array.from({ length: 20 }, (_, index) => `item${index}`);
    const reserved = [cell(0, 0)];
    const cells = (places: Readonly<Record<string, { right: number; top: number }>>) =>
      new Set([...Object.values(places), ...reserved].map(({ right, top }) => `${right},${top}`));
    expect(cells(placesForItems({}, ids, GRID, reserved)).size).toBe(21);
    expect(cells(inOrder(ids, GRID, reserved)).size).toBe(21);
    const piled = Object.fromEntries(ids.map((id) => [id, { right: 15, top: 35 }]));
    expect(cells(cleanedUp(piled, GRID, reserved)).size).toBe(21);
  });

  it("goes past the left edge only when the desktop is full", () => {
    const full = Array.from({ length: 12 }, (_, index) => cell(Math.floor(index / 3), index % 3));
    expect(firstFreeCell(full.slice(1), GRID)).toEqual(cell(0, 0));
    expect(firstFreeCell(full, GRID)).toEqual(cell(4, 0));
    expect(nearestFreeCell({ right: 120, top: 140 }, full, GRID)).toEqual(cell(4, 0));
  });
});
