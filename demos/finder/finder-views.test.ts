import { describe, expect, it } from "vitest";
import { itemOfRow } from "./finder-views";

describe("the item a row of a view stands for", () => {
  it("is the row's id for an ordinary row", () => {
    expect(itemOfRow("/Users/me/Documents/a.txt")).toBe("/Users/me/Documents/a.txt");
  });

  it("is the path in a second row of an item, whatever its section is called", () => {
    const section = encodeURIComponent("Red/Orange");
    expect(itemOfRow(`also:${section}//Users/me/Downloads/a.txt`)).toBe(
      "/Users/me/Downloads/a.txt",
    );
  });

  it("is nothing for a section's heading", () => {
    expect(itemOfRow("group:Red")).toBeUndefined();
  });
});
