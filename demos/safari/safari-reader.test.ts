import { describe, expect, it } from "vitest";
import { READER_OPTIONS, readReaderOptions, stepSize } from "./safari-reader";

describe("Reader's choices", () => {
  it("steps through the sizes and stays at the ends", () => {
    expect(stepSize(20, 1)).toBe(24);
    expect(stepSize(20, -1)).toBe(17);
    expect(stepSize(34, 1)).toBe(34);
    expect(stepSize(14, -1)).toBe(14);
  });

  it("reads back only whole choices", () => {
    expect(readReaderOptions(READER_OPTIONS)).toEqual(READER_OPTIONS);
    expect(readReaderOptions({ ...READER_OPTIONS, size: 3 })).toBeUndefined();
    expect(readReaderOptions({ ...READER_OPTIONS, font: "comic" })).toBeUndefined();
    expect(readReaderOptions({ ...READER_OPTIONS, theme: "neon" })).toBeUndefined();
    expect(readReaderOptions(null)).toBeUndefined();
  });
});
