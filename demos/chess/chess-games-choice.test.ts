import { describe, expect, it } from "vitest";
import { chosenAfter, chosenByArrow, NOTHING_CHOSEN } from "./chess-games-choice";

const order = ["a", "b", "c", "d"];

describe("the games chosen in the Games sheet", () => {
  it("a click chooses one game alone", () => {
    const two = { ids: ["a", "b"], anchor: "b" };
    expect(chosenAfter(two, order, "c")).toEqual({ ids: ["c"], anchor: "c" });
  });

  it("Command adds a game, and takes one already chosen away", () => {
    const one = chosenAfter(NOTHING_CHOSEN, order, "a");
    const two = chosenAfter(one, order, "c", { add: true });
    expect(two.ids).toEqual(["a", "c"]);
    expect(chosenAfter(two, order, "a", { add: true }).ids).toEqual(["c"]);
  });

  it("Shift reaches from the anchor, either way, and the anchor stays", () => {
    const start = chosenAfter(NOTHING_CHOSEN, order, "c");
    expect(chosenAfter(start, order, "a", { range: true })).toEqual({
      ids: ["a", "b", "c"],
      anchor: "c",
    });
    expect(chosenAfter(start, order, "d", { range: true }).ids).toEqual(["c", "d"]);
  });

  it("Shift with nothing to reach from chooses the game alone", () => {
    expect(chosenAfter(NOTHING_CHOSEN, order, "b", { range: true }).ids).toEqual(["b"]);
  });

  it("the arrows step from the anchor and stop at the ends", () => {
    expect(chosenByArrow(NOTHING_CHOSEN, order, 1).ids).toEqual(["a"]);
    expect(chosenByArrow({ ids: ["b"], anchor: "b" }, order, 1).ids).toEqual(["c"]);
    expect(chosenByArrow({ ids: ["a"], anchor: "a" }, order, -1).ids).toEqual(["a"]);
    expect(chosenByArrow({ ids: ["d"], anchor: "d" }, order, 1).ids).toEqual(["d"]);
    expect(chosenByArrow(NOTHING_CHOSEN, [], 1)).toBe(NOTHING_CHOSEN);
  });
});
