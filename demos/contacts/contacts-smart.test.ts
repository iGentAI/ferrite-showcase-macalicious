import { describe, expect, it } from "vitest";
import {
  type Contact,
  conditionsOf,
  inSmartGroup,
  meetsCondition,
  type SmartCondition,
  type SmartGroup,
} from "./contacts-data";

const ada: Contact = {
  id: "a",
  account: "icloud",
  first: "Ada",
  last: "Lovelace",
  company: "Analytical",
  emails: [{ label: "work", value: "ada@analytical.example" }],
  phones: [{ label: "home", value: "555 0100" }],
};
const me: Contact = { ...ada, id: "m", user: "ada", me: true };
const martin: Contact = { id: "b", account: "icloud", first: "Martin", last: "Klein", user: "mk" };

describe("a condition of a smart group", () => {
  it.each<[SmartCondition, boolean]>([
    [{ field: "company", test: "contains", value: "LYTIC" }, true],
    [{ field: "company", test: "lacks", value: "lytic" }, false],
    [{ field: "company", test: "is", value: "analytical" }, true],
    [{ field: "company", test: "is", value: "analytic" }, false],
    [{ field: "email", test: "ends", value: ".example" }, true],
    [{ field: "email", test: "begins", value: "bob" }, false],
    [{ field: "phone", test: "begins", value: "555" }, true],
    [{ field: "note", test: "contains", value: "x" }, false],
    [{ field: "note", test: "lacks", value: "x" }, true],
    [{ field: "name", test: "is", value: "Ada Lovelace" }, true],
    [{ field: "any", test: "contains", value: "lovelace" }, true],
  ])("%j on one card is %j", (condition, wanted) => {
    expect(meetsCondition(ada, condition)).toBe(wanted);
  });

  it("counts the person's own card as no desktop user", () => {
    const user: SmartCondition = { field: "user", test: "yes", value: "" };
    expect(meetsCondition(martin, user)).toBe(true);
    expect(meetsCondition(me, user)).toBe(false);
    expect(meetsCondition(ada, { ...user, test: "no" })).toBe(true);
  });
});

describe("a smart group of several rules", () => {
  const rules: SmartCondition[] = [
    { field: "first", test: "is", value: "Ada" },
    { field: "user", test: "yes", value: "" },
  ];
  const group: SmartGroup = { id: "g", name: "G", rule: "rules", conditions: rules };

  it("takes a card that meets all of them, or any one when it says so", () => {
    expect(inSmartGroup(ada, group)).toBe(false);
    expect(inSmartGroup(ada, { ...group, any: true })).toBe(true);
    expect(inSmartGroup(martin, { ...group, any: true })).toBe(true);
    expect(inSmartGroup({ ...ada, user: "ada" }, group)).toBe(true);
  });

  it("holds nothing without a rule", () => {
    expect(inSmartGroup(ada, { ...group, conditions: [] })).toBe(false);
  });

  it("opens a group made the older ways as rules that choose the same cards", () => {
    for (const old of [
      { id: "o", name: "O", rule: "desktop-user" },
      { id: "o", name: "O", rule: "contains", text: "lovelace" },
    ] as const) {
      const remade: SmartGroup = { ...old, rule: "rules", conditions: conditionsOf(old) };
      for (const card of [ada, me, martin]) {
        expect(inSmartGroup(card, remade)).toBe(inSmartGroup(card, old));
      }
    }
  });
});
