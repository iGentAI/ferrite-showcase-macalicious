import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAccessibility,
  FLASH_KEY,
  flashForAlert,
  followAccessibility,
  GRAYSCALE_KEY,
  INVERT_KEY,
  pageFilter,
  REDUCE_MOTION_KEY,
  ZOOM_KEYS_KEY,
  ZOOM_LEVEL_KEY,
  ZOOM_SCROLL_KEY,
} from "./page-accessibility";

afterEach(() => {
  clearAccessibility();
  vi.useRealTimers();
});

describe("Accessibility on the page", () => {
  it("writes the colour settings as one filter", () => {
    expect(pageFilter({})).toBe("");
    expect(pageFilter({ [GRAYSCALE_KEY]: true })).toBe("grayscale(1)");
    expect(pageFilter({ [INVERT_KEY]: true, [GRAYSCALE_KEY]: true })).toBe(
      "invert(1) hue-rotate(180deg) grayscale(1)",
    );
  });

  it("marks the root, and takes it all off when the session ends", () => {
    followAccessibility({ [REDUCE_MOTION_KEY]: true, [GRAYSCALE_KEY]: true });
    expect(document.documentElement.hasAttribute("data-mac-reduce-motion")).toBe(true);
    expect(document.documentElement.style.filter).toBe("grayscale(1)");
    clearAccessibility();
    expect(document.documentElement.hasAttribute("data-mac-reduce-motion")).toBe(false);
    expect(document.documentElement.style.filter).toBe("");
  });

  it("flashes for a moment only when asked", () => {
    vi.useFakeTimers();
    followAccessibility({});
    flashForAlert();
    expect(document.querySelector(".mac-system-preferences-page-flash")).toBeNull();
    followAccessibility({ [FLASH_KEY]: true });
    flashForAlert();
    expect(document.querySelector(".mac-system-preferences-page-flash")).not.toBeNull();
    vi.advanceTimersByTime(200);
    expect(document.querySelector(".mac-system-preferences-page-flash")).toBeNull();
  });

  const press = (code: string) =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code, altKey: true, metaKey: true, cancelable: true }),
    );
  const root = document.documentElement;

  it("scales the page to the saved zoom, around the pointer, and takes it off at the end", () => {
    followAccessibility({ [ZOOM_LEVEL_KEY]: 2 });
    expect(root.style.transform).toBe("scale(2)");
    expect(root.style.overflow).toBe("hidden");
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 100, clientY: 40 }));
    expect(root.style.transformOrigin).toBe("100px 40px");
    followAccessibility({ [ZOOM_LEVEL_KEY]: 99 });
    expect(root.style.transform).toBe("scale(8)");
    clearAccessibility();
    expect(root.style.transform).toBe("");
    expect(root.style.overflow).toBe("");
  });

  it("answers the zoom keys only when asked to, and turns back on at the last level", () => {
    followAccessibility({});
    press("Equal");
    expect(root.style.transform).toBe("");
    followAccessibility({ [ZOOM_KEYS_KEY]: true });
    press("Equal");
    expect(root.style.transform).toBe("scale(1.25)");
    press("Digit8");
    expect(root.style.transform).toBe("");
    press("Digit8");
    expect(root.style.transform).toBe("scale(1.25)");
    press("Minus");
    expect(root.style.transform).toBe("");
  });

  it("zooms on a scroll only with Control held and the setting on", () => {
    const scroll = (ctrlKey: boolean) => {
      const event = new WheelEvent("wheel", { deltaY: -100, ctrlKey, cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    followAccessibility({ [ZOOM_SCROLL_KEY]: true });
    expect(scroll(false)).toBe(false);
    expect(root.style.transform).toBe("");
    expect(scroll(true)).toBe(true);
    expect(root.style.transform).toMatch(/^scale\(2\.71/);
  });
});
