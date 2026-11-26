import { describe, expect, it } from "vitest";
import { refusalFor } from "./finder-drag";

const PLANS = { path: "/Users/me/Documents/Plans", name: "Plans", folder: true };

describe("refusalFor", () => {
  it("lets items go into another folder", () => {
    expect(refusalFor([{ path: "/Users/me/Desktop/a.txt", name: "a.txt" }], PLANS)).toBeUndefined();
  });

  it("refuses a file as the target", () => {
    const file = { path: "/Users/me/Documents/b.txt", name: "b.txt", folder: false };
    expect(refusalFor([{ path: "/Users/me/Desktop/a.txt", name: "a.txt" }], file)).toBe(
      "“b.txt” isn’t a folder.",
    );
  });

  it("refuses a folder into itself or into a folder inside it", () => {
    expect(refusalFor([{ path: PLANS.path, name: "Plans" }], PLANS)).toBe(
      "“Plans” can’t be moved into itself or a folder inside it.",
    );
    expect(refusalFor([{ path: "/Users/me/Documents", name: "Documents" }], PLANS)).toBe(
      "“Documents” can’t be moved into itself or a folder inside it.",
    );
  });

  it("does not take a sibling whose name begins the same for a folder inside it", () => {
    expect(refusalFor([{ path: "/Users/me/Documents/Plan", name: "Plan" }], PLANS)).toBeUndefined();
  });
});
