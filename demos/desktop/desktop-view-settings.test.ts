import { describe, expect, it } from "vitest";
import {
  cellOfView,
  DESKTOP_VIEW_DEFAULTS,
  keepsDefaultLook,
  readDesktopView,
} from "./desktop-view-settings";

describe("the desktop's view settings", () => {
  it("answers a well-formed value as the same object and refuses any other", () => {
    const stored = { ...DESKTOP_VIEW_DEFAULTS, icon: 128 };
    expect(readDesktopView(stored)).toBe(stored);
    expect(readDesktopView({ ...stored, icon: 8 })).toBeUndefined();
    expect(readDesktopView({ ...stored, icon: "64" })).toBeUndefined();
    expect(readDesktopView({ ...stored, text: 13.5 })).toBeUndefined();
    expect(readDesktopView({ ...stored, label: "left" })).toBeUndefined();
    expect(readDesktopView({ ...stored, grid: undefined })).toBeUndefined();
    expect(readDesktopView(null)).toBeUndefined();
  });

  it("has the measured grid at the defaults", () => {
    expect(cellOfView(DESKTOP_VIEW_DEFAULTS)).toEqual({ width: 116, height: 112 });
  });

  it("widens a cell only when the tile outgrows the name's room, and adds the spacing", () => {
    const at = (change: object) => cellOfView({ ...DESKTOP_VIEW_DEFAULTS, ...change });
    expect(at({ icon: 16 })).toEqual({ width: 116, height: 64 });
    expect(at({ icon: 128 })).toEqual({ width: 180, height: 176 });
    expect(at({ grid: 24 })).toEqual({ width: 140, height: 136 });
    expect(at({ text: 16 })).toEqual({ width: 116, height: 124 });
    expect(at({ info: true })).toEqual({ width: 116, height: 128 });
    expect(at({ text: 16, info: true })).toEqual({ width: 116, height: 146 });
  });

  it("lays a name to the right out wider than tall", () => {
    expect(cellOfView({ ...DESKTOP_VIEW_DEFAULTS, label: "right" })).toEqual({
      width: 184,
      height: 80,
    });
    expect(cellOfView({ ...DESKTOP_VIEW_DEFAULTS, label: "right", icon: 16, info: true })).toEqual({
      width: 136,
      height: 64,
    });
  });

  it("counts only what changes every icon as a change of look", () => {
    expect(keepsDefaultLook(DESKTOP_VIEW_DEFAULTS)).toBe(true);
    expect(keepsDefaultLook({ ...DESKTOP_VIEW_DEFAULTS, preview: false })).toBe(true);
    expect(keepsDefaultLook({ ...DESKTOP_VIEW_DEFAULTS, info: true })).toBe(false);
    expect(keepsDefaultLook({ ...DESKTOP_VIEW_DEFAULTS, icon: 68 })).toBe(false);
  });
});
