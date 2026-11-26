import { describe, expect, it } from "vitest";
import { afterRemoving, allOf, clicked, only, stepped } from "./stocks-selection";

const ORDER = ["A", "B", "C", "D"];
const PLAIN = { shift: false, command: false };
const COMMAND = { shift: false, command: true };
const SHIFT = { shift: true, command: false };

describe("selecting rows of the watchlist", () => {
  it("selects one row with a click, replacing the selection", () => {
    const many = { symbols: ["A", "C"], anchor: "C", shown: "C" };
    expect(clicked(many, "B", ORDER, PLAIN)).toEqual({
      symbols: ["B"],
      anchor: "B",
      shown: "B",
    });
  });

  it("adds and takes away rows with Command-click, and shows the row added", () => {
    const two = clicked(only("A"), "C", ORDER, COMMAND);
    expect(two).toEqual({ symbols: ["A", "C"], anchor: "C", shown: "C" });
    expect(clicked(two, "C", ORDER, COMMAND)).toEqual({
      symbols: ["A"],
      anchor: "A",
      shown: "A",
    });
    expect(clicked(only("A"), "A", ORDER, COMMAND)).toEqual({ symbols: [] });
  });

  it("selects from the anchor with Shift-click, in either direction", () => {
    expect(clicked(only("B"), "D", ORDER, SHIFT).symbols).toEqual(["B", "C", "D"]);
    const back = clicked(clicked(only("B"), "D", ORDER, SHIFT), "A", ORDER, SHIFT);
    expect(back).toEqual({ symbols: ["A", "B"], anchor: "B", shown: "A" });
  });

  it("selects one row with Shift-click when there is no anchor", () => {
    expect(clicked({ symbols: [] }, "C", ORDER, SHIFT).symbols).toEqual(["C"]);
  });

  it("moves with the arrows, held within the list", () => {
    expect(stepped(only("B"), ORDER, 1, "B", false)).toEqual(only("C"));
    expect(stepped(only("B"), ORDER, -1, "B", false)).toEqual(only("A"));
    expect(stepped(only("A"), ORDER, -1, "A", false)).toEqual(only("A"));
    expect(stepped(only("D"), ORDER, 1, "D", false)).toEqual(only("D"));
  });

  it("starts from an end of the list when no row is shown", () => {
    expect(stepped({ symbols: [] }, ORDER, 1, undefined, false)).toEqual(only("A"));
    expect(stepped({ symbols: [] }, ORDER, -1, undefined, false)).toEqual(only("D"));
  });

  it("extends from the anchor with Shift and the arrows", () => {
    const down = stepped(only("B"), ORDER, 1, "B", true);
    expect(down).toEqual({ symbols: ["B", "C"], anchor: "B", shown: "C" });
    expect(stepped(down, ORDER, -1, "C", true).symbols).toEqual(["B"]);
  });

  it("selects every row listed, keeping the symbol shown", () => {
    expect(allOf(only("C"), ORDER)).toEqual({ symbols: ORDER, anchor: "A", shown: "C" });
    expect(allOf({ symbols: [] }, ORDER).shown).toBe("A");
  });

  it("shows the next row when the row shown is removed, else the last left", () => {
    expect(afterRemoving(only("B"), ["B"], ORDER)).toEqual(only("C"));
    expect(afterRemoving(only("D"), ["D"], ORDER)).toEqual(only("C"));
    const many = { symbols: ["B", "C"], anchor: "B", shown: "C" };
    expect(afterRemoving(many, ["B", "C"], ORDER)).toEqual(only("D"));
    expect(afterRemoving(only("A"), ORDER, ORDER)).toEqual({ symbols: [] });
  });

  it("leaves the row shown when another row is removed", () => {
    const many = { symbols: ["A", "B"], anchor: "A", shown: "B" };
    expect(afterRemoving(many, ["A"], ORDER)).toEqual({ symbols: ["B"], anchor: "A", shown: "B" });
    expect(afterRemoving(only("B"), ["D"], ORDER)).toEqual(only("B"));
  });
});
