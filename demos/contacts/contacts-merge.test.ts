import { describe, expect, it } from "vitest";
import type { Contact } from "./contacts-data";
import {
  findDuplicates,
  keeperOf,
  mergeCards,
  withKeeperInGroups,
  withMergedCard,
  withoutRepeats,
} from "./contacts-merge";

const card = (id: string, first: string, last: string, more: Partial<Contact> = {}): Contact => ({
  id,
  account: "icloud",
  first,
  last,
  ...more,
});

describe("mergeCards", () => {
  it("loses no second value: it goes in the note, and one picture stays", () => {
    const { card: merged, left } = mergeCards([
      card("a", "Ada", "", { birthday: "March 1", company: "One" }),
      card("b", "Ada", "", { birthday: "March 2", company: "One", nickname: "Di" }),
    ]);
    expect(left).toEqual([]);
    expect(merged.birthday).toBe("March 1");
    expect(merged.nickname).toBe("Di");
    expect(merged.note).toBe("Birthday: March 2");
    const two = [card("a", "Ada", "", { image: "v1" }), card("b", "Ada", "", { image: "v2" })];
    const both = mergeCards(two);
    expect(both.left).toEqual([]);
    expect(both.card.image).toBe("v1");
    expect(both.picture).toBeUndefined();
    expect(both.spare.map(({ id }) => id)).toEqual(["b"]);
    const mine = mergeCards([
      card("a", "Ada", "", { me: true }),
      card("b", "Ada", "", { image: "v2" }),
    ]);
    expect(mine.left).toEqual([]);
    expect(mine.card.id).toBe("a");
    expect(mine.card.image).toBeUndefined();
    expect(mine.picture?.id).toBe("b");
    expect(mine.spare).toEqual([]);
  });

  it("keeps a number with words apart from one of the same digits", () => {
    const phones = [
      { label: "work", value: "555 ext 12" },
      { label: "home", value: "55512" },
    ];
    expect(withoutRepeats(card("a", "Ada", "", { phones })).phones).toEqual(phones);
  });

  it("keeps every different entry and fills what the first card lacks", () => {
    const { card: merged, left } = mergeCards([
      card("a", "Ada", "Byron", {
        phones: [{ label: "mobile", value: "+1 (555) 010-2000" }],
        note: "first note",
      }),
      card("b", "Ada", "Byron", {
        company: "Analytical",
        phones: [
          { label: "work", value: "+1 555 010 2000" },
          { label: "home", value: "+1 555 010 3000" },
        ],
        emails: [{ label: "home", value: "ada@example.com" }],
        note: "second note",
      }),
    ]);
    expect(left).toEqual([]);
    expect(merged.id).toBe("a");
    expect(merged.company).toBe("Analytical");
    expect(merged.phones).toEqual([
      { label: "mobile", value: "+1 (555) 010-2000" },
      { label: "home", value: "+1 555 010 3000" },
    ]);
    expect(merged.emails).toEqual([{ label: "home", value: "ada@example.com" }]);
    expect(merged.note).toBe("first note\n\nsecond note");
  });

  it("keeps the person's own card, or the card with a picture, as the one that stays", () => {
    const plain = card("a", "Ada", "");
    const pictured = card("b", "Ada", "", { image: "v1" });
    const mine = card("c", "Ada", "", { me: true });
    expect(keeperOf([plain, pictured])).toBe(pictured);
    expect(keeperOf([plain, pictured, mine])).toBe(mine);
    expect(mergeCards([plain, pictured]).card.id).toBe("b");
    expect(mergeCards([plain, pictured]).left).toEqual([]);
  });

  it("keeps web addresses that differ in case, and email addresses that differ in accents", () => {
    const urls = [
      { label: "home", value: "https://example.com/Page" },
      { label: "work", value: "https://example.com/page" },
    ];
    const emails = [
      { label: "home", value: "rene@example.com" },
      { label: "work", value: "rené@example.com" },
    ];
    const both = card("a", "Ada", "", { urls, emails });
    expect(withoutRepeats(both).urls).toEqual(urls);
    expect(withoutRepeats(both).emails).toEqual(emails);
    const { card: merged } = mergeCards([
      card("a", "Ada", "", { urls: urls.slice(0, 1), emails: emails.slice(0, 1) }),
      card("b", "Ada", "", { urls: urls.slice(1), emails: emails.slice(1) }),
    ]);
    expect(merged.urls).toEqual(urls);
    expect(merged.emails).toEqual(emails);
  });

  it("keeps a second desktop account as an address", () => {
    const { card: merged } = mergeCards([
      card("a", "Ada", "", { user: "ada" }),
      card("b", "Ada", "", { user: "ada2" }),
    ]);
    expect(merged.user).toBe("ada");
    expect(merged.emails).toEqual([{ label: "desktop", value: "ada2@macalicious" }]);
  });

  it("stops at what the server takes on one card, and names what it left out", () => {
    const many = (from: number, count: number) =>
      Array.from({ length: count }, (_, at) => ({ label: "home", value: `+1 ${from + at}` }));
    const { card: merged, left } = mergeCards([
      card("a", "Ada", "", { phones: many(100, 30), note: "x".repeat(4_000) }),
      card("b", "Ada", "", { phones: many(200, 30), note: "y".repeat(2_000) }),
    ]);
    expect(merged.phones).toHaveLength(50);
    expect(left).toContain("+1 220");
    expect(left).toContain("y".repeat(2_000));
    expect(merged.note).toBe("x".repeat(4_000));
  });
});

describe("what a merge writes", () => {
  it("changes the kept card and removes the others in one list", () => {
    const merged = card("a", "Ada", "", { note: "merged" });
    const next = withMergedCard(
      [card("a", "Ada", ""), card("b", "Ada", ""), card("c", "Bo", "")],
      merged,
      new Set(["b"]),
    );
    expect(next.map(({ id, note }) => [id, note])).toEqual([
      ["a", "merged"],
      ["c", undefined],
    ]);
  });

  it("adds the kept card to each group that held another, and takes no card out", () => {
    const next = withKeeperInGroups(
      [
        { id: "one", name: "One", members: ["a", "b"] },
        { id: "two", name: "Two", members: ["b", "c"] },
        { id: "three", name: "Three", members: ["c"] },
      ],
      "a",
      new Set(["b"]),
    );
    expect(next.map(({ members }) => members)).toEqual([["a", "b"], ["b", "c", "a"], ["c"]]);
  });
});

describe("findDuplicates", () => {
  it("keeps the parts of a name apart, and goes on finding one name written differently", () => {
    const found = findDuplicates([
      card("a", "Ann", "Able"),
      card("b", "Anna", "Ble"),
      card("c", "ANN", "Áble"),
    ]);
    expect(found.sets.map((set) => set.map(({ id }) => id))).toEqual([["a", "c"]]);
  });

  it("takes a number in other digits as its own number", () => {
    const phones = [
      { label: "work", value: "1٢" },
      { label: "home", value: "1" },
    ];
    expect(withoutRepeats(card("a", "Ada", "", { phones })).phones).toEqual(phones);
  });

  it("takes a phone number with words of any script as written", () => {
    const phones = [
      { label: "work", value: "555 内線 12" },
      { label: "home", value: "55512" },
      { label: "other", value: "555 ext A" },
      { label: "other", value: "555 ext a" },
    ];
    expect(withoutRepeats(card("a", "Ada", "", { phones })).phones).toEqual(phones);
    expect(findDuplicates([card("a", "Ada", "", { phones })]).entryCount).toBe(0);
    expect(
      mergeCards([
        card("a", "Ada", "", { phones: phones.slice(0, 2) }),
        card("b", "Ada", "", { phones: phones.slice(2) }),
      ]).card.phones,
    ).toEqual(phones);
  });

  it("groups people named No Name and not cards with no name, and takes a leading + as the same", () => {
    const phones = [
      { label: "home", value: "+1 555 010 2000" },
      { label: "work", value: "1 555 010 2000" },
      { label: "other", value: "ask at the desk" },
    ];
    const found = findDuplicates([
      card("a", "No", "Name", { phones }),
      card("b", "No", "Name"),
      card("c", "", ""),
      card("d", "", ""),
    ]);
    expect(found.sets.map((set) => set.map(({ id }) => id))).toEqual([["a", "b"]]);
    expect(found.entryCount).toBe(1);
    expect(withoutRepeats(card("a", "No", "Name", { phones })).phones).toEqual([
      phones[0],
      phones[2],
    ]);
    const { card: merged } = mergeCards([
      card("a", "No", "", { phones: phones.slice(0, 1) }),
      card("b", "No", "", { phones: phones.slice(1, 2) }),
    ]);
    expect(merged.phones).toEqual(phones.slice(0, 1));
  });

  it("counts an entry repeated on a card of a set of one name", () => {
    const twice = [
      { label: "home", value: "+1 555 010 2000" },
      { label: "work", value: "+1 (555) 010-2000" },
    ];
    const found = findDuplicates([card("a", "Ada", "", { phones: twice }), card("b", "Ada", "")]);
    expect(found.sets).toHaveLength(1);
    expect(found.entries).toEqual([]);
    expect(found.entryCount).toBe(1);
  });

  it("finds cards of one name, whatever the case and accents, and not nameless ones", () => {
    const found = findDuplicates([
      card("a", "Renée", "Roy"),
      card("b", "renee", "ROY"),
      card("c", "Other", "Person"),
      card("d", "", ""),
      card("e", "", ""),
    ]);
    expect(found.sets.map((set) => set.map(({ id }) => id))).toEqual([["a", "b"]]);
    expect(found.entries).toEqual([]);
  });

  it("finds an entry a card holds twice, and removes only the repeat", () => {
    const twice = card("a", "Ada", "", {
      emails: [
        { label: "home", value: "ada@example.com" },
        { label: "work", value: "ADA@example.com" },
        { label: "work", value: "other@example.com" },
      ],
    });
    const found = findDuplicates([twice, card("b", "Bo", "")]);
    expect(found.entries).toEqual([twice]);
    expect(found.entryCount).toBe(1);
    expect(withoutRepeats(twice).emails).toEqual([
      { label: "home", value: "ada@example.com" },
      { label: "work", value: "other@example.com" },
    ]);
  });
});
