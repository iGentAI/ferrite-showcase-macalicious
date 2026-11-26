import { describe, expect, it } from "vitest";
import { initialsOf, personDetail, ruleText, tellText } from "./find-my-people";
import { accountToken, personFromServer, type ServedPerson } from "./find-my-server";

const PERSON: ServedPerson = {
  name: "ann",
  full_name: "Ann Lee",
  sharing: false,
  following: false,
  position: null,
  asked: false,
  asks_me: false,
  rule: null,
  tell: null,
};
const NOW = 1_800_000_000_000;

describe("Find My's people", () => {
  it("finds the account name in what was typed", () => {
    expect(accountToken("  martin ")).toBe("martin");
    expect(accountToken("Martin Klein (martin)")).toBe("martin");
    expect(accountToken("Martin Klein <martin@macalicious>")).toBe("martin");
    expect(accountToken("Martin@macalicious")).toBe("martin");
  });

  it("reads a person in the module's shape and refuses any other", () => {
    const read = personFromServer({
      ...PERSON,
      following: true,
      position: { lat: 1, lon: 2, accuracy_m: 3, at: 4 },
      rule: { kind: "leave", label: "your location", repeat: true },
    });
    expect(read?.position).toEqual({ lat: 1, lon: 2, accuracy_m: 3, at: 4 });
    expect(read?.rule?.kind).toBe("leave");
    expect(personFromServer({ ...PERSON, position: { lat: "1" } })).toBeUndefined();
    expect(personFromServer({ ...PERSON, rule: { kind: "stay" } })).toBeUndefined();
    expect(personFromServer({ name: "ann" })).toBeUndefined();
  });

  it("says how each link stands", () => {
    expect(
      personDetail(
        {
          ...PERSON,
          following: true,
          position: { lat: 0, lon: 0, accuracy_m: 1, at: NOW - 120_000 },
        },
        NOW,
      ),
    ).toBe("2 min ago");
    expect(personDetail({ ...PERSON, following: true }, NOW)).toBe("No location found");
    expect(personDetail({ ...PERSON, asks_me: true }, NOW)).toBe("Asks to follow your location");
    expect(personDetail({ ...PERSON, sharing: true }, NOW)).toBe("Can see your location");
    expect(personDetail({ ...PERSON, asked: true }, NOW)).toBe("Asked to follow their location");
  });

  it("writes initials and rules", () => {
    expect(initialsOf("Ann Marie Lee")).toBe("AM");
    expect(ruleText(PERSON, { kind: "arrive", label: "your location", repeat: true })).toBe(
      "Notify me when Ann Lee arrives at your location, every time",
    );
    expect(ruleText(PERSON, { kind: "leave", label: "your location", repeat: false })).toBe(
      "Notify me when Ann Lee leaves your location",
    );
    expect(tellText(PERSON, { kind: "arrive", label: "Ferry Building", repeat: false })).toBe(
      "Notify Ann Lee when I arrive at Ferry Building",
    );
    expect(tellText(PERSON, { kind: "leave", label: "Ferry Building", repeat: true })).toBe(
      "Notify Ann Lee when I leave Ferry Building, every time",
    );
    expect(
      personFromServer({
        ...PERSON,
        tell: { kind: "arrive", label: "Ferry Building", repeat: false },
      })?.tell?.label,
    ).toBe("Ferry Building");
    expect(personFromServer({ ...PERSON, tell: { kind: "stay" } })).toBeUndefined();
  });
});
