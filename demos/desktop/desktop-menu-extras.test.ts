import { describe, expect, it } from "vitest";
import { orderedExtras, withExtraMoved } from "./desktop-menu-extras";

const BAR = ["Time Machine", "Wi-Fi", "Battery", "Clock", "Spotlight", "Siri"];

describe("the menu bar's order", () => {
  it("puts the saved ones in the places of those that can move", () => {
    expect(orderedExtras(BAR, ["Clock", "Wi-Fi", "Battery", "Time Machine"])).toEqual([
      "Clock",
      "Wi-Fi",
      "Battery",
      "Time Machine",
      "Spotlight",
      "Siri",
    ]);
  });

  it("leaves an extra new since it was saved where it stands, and forgets one gone", () => {
    expect(orderedExtras(BAR, ["Battery", "Gone", "Time Machine"])).toEqual([
      "Battery",
      "Wi-Fi",
      "Time Machine",
      "Clock",
      "Spotlight",
      "Siri",
    ]);
  });

  it("moves one to where the pointer is, either way", () => {
    expect(withExtraMoved(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(withExtraMoved(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });
});
