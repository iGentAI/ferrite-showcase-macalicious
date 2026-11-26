import { describe, expect, it } from "vitest";
import { fontFamily } from "./font-book-data";
import {
  matchesSmart,
  newSmartCollection,
  readSmartCollections,
  type SmartCollection,
} from "./font-book-smart";

const plum = fontFamily("Plum Sans", "Regular, Bold", "sans");
const pear = fontFamily("Pear Mono", "Regular", "mono");
const smart = (rules: SmartCollection["rules"], match: SmartCollection["match"] = "all") => ({
  id: "s",
  name: "S",
  match,
  rules,
});

describe("a smart collection's rules", () => {
  it("test a family's name, its styles and its kind", () => {
    const byName = smart([{ field: "family", test: "contains", value: "PLUM" }]);
    expect(matchesSmart(plum, byName)).toBe(true);
    expect(matchesSmart(pear, byName)).toBe(false);
    expect(matchesSmart(plum, smart([{ field: "style", test: "is", value: "bold" }]))).toBe(true);
    expect(matchesSmart(pear, smart([{ field: "style", test: "is", value: "bold" }]))).toBe(false);
    expect(matchesSmart(pear, smart([{ field: "kind", test: "is", value: "mono" }]))).toBe(true);
    expect(
      matchesSmart(
        plum,
        smart([{ field: "postscript", test: "contains", value: "PlumSans-Bold" }]),
      ),
    ).toBe(true);
  });

  it("exclude what does not contain the text", () => {
    const rule = smart([{ field: "family", test: "excludes", value: "plum" }]);
    expect(matchesSmart(plum, rule)).toBe(false);
    expect(matchesSmart(pear, rule)).toBe(true);
  });

  it("take all or any of them", () => {
    const rules = [
      { field: "family", test: "contains", value: "plum" },
      { field: "kind", test: "is", value: "mono" },
    ] as const;
    expect(matchesSmart(plum, smart(rules, "all"))).toBe(false);
    expect(matchesSmart(plum, smart(rules, "any"))).toBe(true);
    expect(matchesSmart(pear, smart(rules, "any"))).toBe(true);
  });

  it("hold nothing while nothing is asked", () => {
    expect(matchesSmart(plum, smart([{ field: "family", test: "contains", value: " " }]))).toBe(
      false,
    );
  });
});

describe("kept smart collections", () => {
  it("read what was kept and leave out what cannot be read", () => {
    const good = smart([{ field: "family", test: "is", value: "x" }]);
    expect(readSmartCollections([good, { id: "bad" }, 3])).toEqual([good]);
    expect(readSmartCollections("no")).toBeUndefined();
  });

  it("read one stored list as one list, or a kept value would change on every render", () => {
    const stored = [smart([{ field: "family", test: "is", value: "x" }])];
    expect(readSmartCollections(stored)).toBe(readSmartCollections(stored));
  });

  it("take a name no other has", () => {
    const first = newSmartCollection([]);
    expect(first.name).toBe("Smart Collection");
    expect(newSmartCollection([first]).name).toBe("Smart Collection 2");
  });
});
