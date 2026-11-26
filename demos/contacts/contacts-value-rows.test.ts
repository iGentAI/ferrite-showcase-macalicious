import { describe, expect, it } from "vitest";
import { type Contact, fieldsOfValue, isEmailValue, withoutPrivateFields } from "./contacts-data";
import { cardsToVCard } from "./contacts-vcard";

describe("Add to > New Card", () => {
  it("puts each kind of value in its field, and the rest in the note", () => {
    expect(fieldsOfValue(" ann@example.com ")).toEqual({
      emails: [{ label: "work", value: "ann@example.com" }],
    });
    expect(fieldsOfValue("https://example.com/a")).toEqual({
      urls: [{ label: "home page", value: "https://example.com/a" }],
    });
    expect(fieldsOfValue("(555) 010-0142")).toEqual({
      phones: [{ label: "mobile", value: "(555) 010-0142" }],
    });
    expect(fieldsOfValue("Harbor Ferry")).toEqual({ note: "Harbor Ferry" });
    expect(fieldsOfValue("1999")).toEqual({ note: "1999" });
  });

  it("knows an email address", () => {
    expect(isEmailValue("a@b")).toBe(true);
    expect(isEmailValue("not one")).toBe(false);
  });
});

describe("the private me card", () => {
  const mine: Contact = {
    id: "me",
    account: "icloud",
    first: "Chris",
    last: "Vale",
    me: true,
    phones: [
      { label: "home", value: "(555) 010-0001", private: true },
      { label: "work", value: "(555) 010-0002" },
    ],
    emails: [{ label: "home", value: "secret@example.com", private: true }],
  };

  it("leaves My Card's private fields out of its vCard", () => {
    const text = cardsToVCard([{ contact: withoutPrivateFields(mine) }]);
    expect(text).toContain("(555) 010-0002");
    expect(text).not.toContain("(555) 010-0001");
    expect(text).not.toContain("secret@example.com");
  });

  it("leaves any other card whole", () => {
    const other = { ...mine, me: undefined };
    expect(withoutPrivateFields(other)).toBe(other);
  });
});
