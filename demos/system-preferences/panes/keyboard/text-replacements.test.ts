import { describe, expect, it } from "vitest";
import { DEFAULT_REPLACEMENTS, readReplacements, replacementAt } from "./text-replacements";

const rules = [
  { replace: "omw", with: "On my way!" },
  { replace: "(c)", with: "©" },
];

describe("text replacements", () => {
  it("finds a word standing on its own at the end of the text", () => {
    expect(replacementAt("omw", rules)?.with).toBe("On my way!");
    expect(replacementAt("see you omw", rules)?.with).toBe("On my way!");
    expect(replacementAt("year (c)", rules)?.with).toBe("©");
  });

  it("leaves a word that only ends the same", () => {
    expect(replacementAt("nomw", rules)).toBeUndefined();
    expect(replacementAt("omw now", rules)).toBeUndefined();
    expect(replacementAt("𐐀omw", rules)).toBeUndefined();
    expect(replacementAt("e\u0301omw", rules)).toBeUndefined();
  });

  it("reads what is stored, and offers the default until something is", () => {
    expect(readReplacements(undefined)).toBe(DEFAULT_REPLACEMENTS);
    expect(readReplacements([])).toEqual([]);
    expect(readReplacements([{ replace: "a", with: "b" }, { replace: "" }, 3])).toEqual([
      { replace: "a", with: "b" },
    ]);
  });
});
