import { describe, expect, it } from "vitest";
import { pressedRows } from "./safari-rows";

const ORDER = ["a", "b", "c", "d"];
const COMMAND = { command: true, shift: false };
const SHIFT = { command: false, shift: true };

describe("pressedRows", () => {
  it("Command adds a row and takes it away again", () => {
    expect(pressedRows(["a"], ORDER, "a", "c", COMMAND)).toEqual(["a", "c"]);
    expect(pressedRows(["a", "c"], ORDER, "c", "c", COMMAND)).toEqual(["a"]);
  });

  it("Shift takes the rows between the anchor and the row, in either direction", () => {
    expect(pressedRows(["b"], ORDER, "b", "d", SHIFT)).toEqual(["b", "c", "d"]);
    expect(pressedRows(["d"], ORDER, "d", "b", SHIFT)).toEqual(["b", "c", "d"]);
  });

  it("a plain press leaves the one row, as does a range from a row that has gone", () => {
    expect(pressedRows(["a", "b"], ORDER, "a", "c", { command: false, shift: false })).toEqual([
      "c",
    ]);
    expect(pressedRows(["a"], ORDER, "gone", "c", SHIFT)).toEqual(["c"]);
  });
});
