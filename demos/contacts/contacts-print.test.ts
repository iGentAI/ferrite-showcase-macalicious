import { describe, expect, it } from "vitest";
import { cardPrintLines, readContactSort } from "./contacts-print";

describe("a card printed", () => {
  it("has its name, company and labelled fields", () => {
    expect(
      cardPrintLines({
        id: "a",
        account: "icloud",
        first: "Anna",
        last: "Zed",
        company: "Tide Works",
        phones: [{ label: "mobile", value: "555" }],
        emails: [{ label: "", value: "a@b" }],
      }),
    ).toEqual(["Anna Zed", "Tide Works", "", "mobile: 555", "other: a@b"]);
  });

  it("does not repeat the name of a company's own card", () => {
    expect(
      cardPrintLines({
        id: "a",
        account: "icloud",
        first: "",
        last: "",
        company: "Tide Works",
        isCompany: true,
      }),
    ).toEqual(["Tide Works"]);
  });
});

describe("the kept sort order", () => {
  it("takes only what the menu writes", () => {
    expect(readContactSort("first")).toBe("first");
    expect(readContactSort("middle")).toBeUndefined();
  });
});
