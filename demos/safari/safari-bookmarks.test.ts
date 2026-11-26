import { describe, expect, it } from "vitest";
import { freeFolderName } from "./safari-bookmarks";

describe("freeFolderName", () => {
  it("keeps a free name and numbers a taken one", () => {
    expect(freeFolderName("News", [])).toBe("News");
    expect(freeFolderName("News", ["News"])).toBe("News 2");
    expect(freeFolderName("News", ["News", "News 2"])).toBe("News 3");
  });

  it("keeps a numbered name of the longest length within it", () => {
    const longest = "n".repeat(200);
    const free = freeFolderName(longest, [longest]);
    expect(free).toBe(`${"n".repeat(198)} 2`);
    expect(free).toHaveLength(200);
  });
});
