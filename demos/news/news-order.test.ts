import { describe, expect, it } from "vitest";
import { choiceAfter, movedBefore } from "./news-live";
import { storyToward } from "./news-stories";

describe("moving a channel", () => {
  it("puts it before the one named, or last, once", () => {
    expect(movedBefore(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(movedBefore(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
    expect(movedBefore(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"]);
    expect(movedBefore(["a", "b", "c"], "a", "gone")).toEqual(["b", "c", "a"]);
  });
});

describe("choosing stories", () => {
  const order = ["a", "b", "c", "d"];

  it("adds and takes out with Command-click", () => {
    const one = choiceAfter(null, order, "b", false);
    expect(one.ids).toEqual(["b"]);
    const two = choiceAfter(one, order, "d", false);
    expect(two.ids).toEqual(["b", "d"]);
    expect(choiceAfter(two, order, "b", false).ids).toEqual(["d"]);
  });

  it("takes the run from the last chosen with Shift-click, either way", () => {
    const from = choiceAfter(null, order, "c", false);
    expect(choiceAfter(from, order, "a", true).ids).toEqual(["a", "b", "c"]);
    expect(choiceAfter(from, order, "d", true).ids).toEqual(["c", "d"]);
  });
});

describe("the arrow keys among stories", () => {
  // Two to a row, as a list shows them.
  const places = [
    { x: 100, y: 100 },
    { x: 500, y: 100 },
    { x: 100, y: 300 },
    { x: 500, y: 300 },
    { x: 100, y: 500 },
  ];

  it("goes to the neighbour in each direction", () => {
    expect(storyToward(places, 0, "ArrowRight")).toBe(1);
    expect(storyToward(places, 0, "ArrowDown")).toBe(2);
    expect(storyToward(places, 3, "ArrowLeft")).toBe(2);
    expect(storyToward(places, 3, "ArrowUp")).toBe(1);
  });

  it("stays where nothing lies that way", () => {
    expect(storyToward(places, 0, "ArrowUp")).toBeUndefined();
    expect(storyToward(places, 1, "ArrowRight")).toBeUndefined();
    expect(storyToward(places, 4, "ArrowDown")).toBeUndefined();
  });
});
