import { describe, expect, it } from "vitest";
import { nextTitle } from "./voice-memos-data";
import { titleOfPlace } from "./voice-memos-location";
import { preferencesFromServer, preferencesToServer } from "./voice-memos-preferences";

describe("Location-based Naming", () => {
  it("makes a place's name fit a file's", () => {
    expect(titleOfPlace("  Rue de/la: Paix \\ 2 ")).toBe("Rue de la Paix 2");
    expect(titleOfPlace("x".repeat(100))).toHaveLength(80);
  });

  it("numbers a second recording at the same place", () => {
    expect(nextTitle([], "High Street")).toBe("High Street");
    expect(nextTitle([{ title: "High Street" }], "High Street")).toBe("High Street 2");
    expect(nextTitle([{ title: "New Recording" }])).toBe("New Recording 2");
  });

  it("is a Preference the server keeps", () => {
    const kept = {
      audioQuality: "compressed",
      clearDeleted: "month",
      locationNaming: true,
    } as const;
    expect(preferencesFromServer(preferencesToServer(kept))).toEqual(kept);
    expect(
      preferencesFromServer({ preferences: { audioQuality: "compressed", clearDeleted: "month" } }),
    ).toEqual({ audioQuality: "compressed", clearDeleted: "month" });
  });
});
