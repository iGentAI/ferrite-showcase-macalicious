import { describe, expect, it } from "vitest";
import { historyColumns, litSegments, readActivityDockMode } from "./desktop-dock-activity";

describe("Activity Monitor's Dock icon", () => {
  it("draws the newest seconds at the right, padded on the left", () => {
    const few = historyColumns([10, 20]);
    expect(few).toHaveLength(16);
    expect(few.slice(-2)).toEqual([10, 20]);
    expect(few[0]).toBe(0);
    const many = historyColumns(Array.from({ length: 30 }, (_, at) => at));
    expect(many[0]).toBe(14);
    expect(many[15]).toBe(29);
  });

  it("lights a meter by load, one segment for any at all", () => {
    expect(litSegments(0)).toBe(0);
    expect(litSegments(0.5)).toBe(1);
    expect(litSegments(50)).toBe(5);
    expect(litSegments(100)).toBe(10);
  });

  it("reads only the modes there are", () => {
    expect(readActivityDockMode("history")).toBe("history");
    expect(readActivityDockMode("network")).toBeUndefined();
  });
});
