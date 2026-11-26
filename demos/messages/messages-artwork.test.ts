import { describe, expect, it } from "vitest";
import { initialsOf } from "./messages-artwork";

describe("a person's initials", () => {
  it.each([
    ["Ann Reed", "AR"],
    ["Ann  Marie Reed", "AR"],
    ["chris", "C"],
    ["", ""],
  ])("of %j are %j", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});
