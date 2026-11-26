import { describe, expect, it } from "vitest";
import { loadedFontNames } from "./system-information-desktop";

const face = (style: string, status: FontFaceLoadStatus) => ({
  family: "Inter",
  weight: "400",
  style,
  status,
});

describe("System Information's Fonts", () => {
  it("lists what is loaded, each face once, and tells styles apart", () => {
    const names = loadedFontNames([
      face("normal", "loaded"),
      face("normal", "loaded"),
      face("italic", "loaded"),
      face("normal", "unloaded"),
      face("oblique", "unloaded"),
      face("oblique", "error"),
    ]);
    expect(names).toEqual(["Inter (normal, 400)", "Inter (italic, 400)"]);
  });
});
