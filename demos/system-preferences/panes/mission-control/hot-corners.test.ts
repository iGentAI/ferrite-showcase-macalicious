import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearScreenSaver,
  followScreenSaver,
  SAVER_AFTER_KEY,
} from "../desktop-and-screen-saver/screen-saver";
import { clearHotCorners, cornerAt, followHotCorners, hotCornerKey } from "./hot-corners";

const inTopLeft = () =>
  window.dispatchEvent(new MouseEvent("pointermove", { clientX: 0, clientY: 0 }));
const saver = () => document.querySelector(".mac-system-preferences-screen-saver");

afterEach(() => {
  clearHotCorners();
  clearScreenSaver();
  vi.useRealTimers();
});

describe("Hot Corners", () => {
  it("knows the four corners of the page and nothing else", () => {
    expect(cornerAt(0, 0, 1000, 800)).toBe("topLeft");
    expect(cornerAt(999, 0, 1000, 800)).toBe("topRight");
    expect(cornerAt(0, 799, 1000, 800)).toBe("bottomLeft");
    expect(cornerAt(999, 799, 1000, 800)).toBe("bottomRight");
    expect(cornerAt(500, 0, 1000, 800)).toBeNull();
    expect(cornerAt(0, 400, 1000, 800)).toBeNull();
    expect(cornerAt(5, 5, 1000, 800)).toBeNull();
  });

  it("holds the screen saver off only until the pointer leaves the page", () => {
    vi.useFakeTimers();
    followScreenSaver({ [SAVER_AFTER_KEY]: 1 });
    followHotCorners({ [hotCornerKey("topLeft")]: "Disable Screen Saver" });
    inTopLeft();
    vi.advanceTimersByTime(180_000);
    expect(saver()).toBeNull();

    document.documentElement.dispatchEvent(new MouseEvent("pointerleave"));
    vi.advanceTimersByTime(60_000);
    expect(saver()).not.toBeNull();
  });

  it("lets go when the browser's window loses focus", () => {
    vi.useFakeTimers();
    followScreenSaver({ [SAVER_AFTER_KEY]: 1 });
    followHotCorners({ [hotCornerKey("topLeft")]: "Disable Screen Saver" });
    inTopLeft();
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(120_000);
    expect(saver()).not.toBeNull();
  });
});
