import { describe, expect, it } from "vitest";
import { offeredPeople } from "./contacts-people";

const ADA = { name: "Ada Byron", to: "ada" };
const BOB = { name: "Bob Adams", to: "rob" };

describe("offeredPeople", () => {
  it("matches the name or the account name, in any case", () => {
    expect(offeredPeople([ADA, BOB], "ADA", [])).toEqual([ADA, BOB]);
    expect(offeredPeople([ADA, BOB], " rob", [])).toEqual([BOB]);
  });

  it("offers nobody for nothing typed, and leaves out who is taken", () => {
    expect(offeredPeople([ADA], "  ", [])).toEqual([]);
    expect(offeredPeople([ADA, BOB], "ad", ["ada"])).toEqual([BOB]);
  });

  it("offers five at most", () => {
    const many = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `Ann ${n}`, to: `ann${n}` }));
    expect(offeredPeople(many, "ann", [])).toHaveLength(5);
  });
});
