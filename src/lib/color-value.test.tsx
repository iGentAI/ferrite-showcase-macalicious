import { act, renderHook } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ColorContext,
  type ColorState,
  hexToHsva,
  hsvaToHex,
  hsvToRgb,
  rgbToHsv,
  useColorState,
  useColorValue,
} from "./color-value";

describe("colour conversion", () => {
  it("converts the six hues, white, black and a grey both ways", () => {
    const cases: [string, [number, number, number]][] = [
      ["#ff0000", [0, 1, 1]],
      ["#ffff00", [60, 1, 1]],
      ["#00ff00", [120, 1, 1]],
      ["#00ffff", [180, 1, 1]],
      ["#0000ff", [240, 1, 1]],
      ["#ff00ff", [300, 1, 1]],
      ["#ffffff", [0, 0, 1]],
      ["#000000", [0, 0, 0]],
    ];
    for (const [hex, [h, s, v]] of cases) {
      expect(hexToHsva(hex)).toEqual([h, s, v, 1]);
      expect(hsvaToHex([h, s, v, 1])).toBe(hex);
    }
    expect(hsvaToHex(hexToHsva("#808080"))).toBe("#808080");
    expect(hsvaToHex(hexToHsva("#ff9300"))).toBe("#ff9300");
  });

  it("round-trips a sample of sRGB hex values, and every value of each channel", () => {
    // A prime step, so that the three channels do not move together.
    for (let n = 0; n <= 0xffffff; n += 104729) {
      const hex = `#${n.toString(16).padStart(6, "0")}`;
      expect(hsvaToHex(hexToHsva(hex))).toBe(hex);
    }
    for (let n = 0; n <= 255; n++) {
      const byte = n.toString(16).padStart(2, "0");
      for (const hex of [`#${byte}3c9a`, `#3c${byte}9a`, `#3c9a${byte}`]) {
        expect(hsvaToHex(hexToHsva(hex))).toBe(hex);
      }
    }
  });

  it("reads the opacity of #rrggbbaa and writes it only when the colour is not opaque", () => {
    expect(hexToHsva("#ff000080")[3]).toBeCloseTo(128 / 255);
    expect(hsvaToHex([0, 1, 1, 0.5])).toBe("#ff000080");
    expect(hsvaToHex([0, 1, 1, 1])).toBe("#ff0000");
    expect(hsvaToHex([0, 1, 1, 0])).toBe("#ff000000");
  });

  it("accepts upper case and a missing #, and reads anything else as opaque black", () => {
    expect(hsvaToHex(hexToHsva("FF9300"))).toBe("#ff9300");
    expect(hsvaToHex(hexToHsva(" #FF9300 "))).toBe("#ff9300");
    for (const bad of ["", "#fff", "red", "#12345", "#gggggg", "rgb(1 2 3)"]) {
      expect(hexToHsva(bad)).toEqual([0, 0, 0, 1]);
    }
  });

  it("clamps components that are out of range", () => {
    expect(hsvaToHex([0, 1, 2, 1])).toBe("#ff0000");
    expect(hsvaToHex([0, 0, -1, 1])).toBe("#000000");
    expect(hsvToRgb(360, 1, 1)).toEqual([1, 0, 0]);
    expect(rgbToHsv(0.5, 0.5, 0.5)).toEqual([0, 0, 0.5]);
  });
});

describe("useColorValue", () => {
  it("starts from the default value and reports a change as hex", () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() => useColorValue(undefined, "#ff0000", onValueChange));
    expect(result.current[0]).toEqual([0, 1, 1, 1]);
    act(() => result.current[1]([120, 1, 1, 1]));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("#00ff00");
    expect(result.current[0]).toEqual([120, 1, 1, 1]);
  });

  it("keeps the hue and saturation through black, without reporting an unchanged value", () => {
    const onValueChange = vi.fn();
    const { result } = renderHook(() => useColorValue(undefined, "#0000ff", onValueChange));
    act(() => result.current[1]([240, 1, 0, 1]));
    expect(onValueChange).toHaveBeenLastCalledWith("#000000");
    expect(result.current[0]).toEqual([240, 1, 0, 1]);
    // A new hue at brightness 0 is still black: nothing to report, but it is remembered.
    act(() => result.current[1]([120, 1, 0, 1]));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    act(() => result.current[1]([120, 1, 1, 1]));
    expect(onValueChange).toHaveBeenLastCalledWith("#00ff00");
  });

  it("is controlled by value: the held colour gives way to a value set from outside", () => {
    const onValueChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useColorValue(value, "#000000", onValueChange),
      { initialProps: { value: "#ff0000" } },
    );
    act(() => result.current[1]([240, 1, 1, 1]));
    expect(onValueChange).toHaveBeenLastCalledWith("#0000ff");
    // The owner did not take the change.
    expect(result.current[0]).toEqual([0, 1, 1, 1]);
    rerender({ value: "#00ff00" });
    expect(result.current[0]).toEqual([120, 1, 1, 1]);
  });

  it("forgets the hue it held once a value from outside has replaced the colour", () => {
    const { result } = renderHook(() => {
      const [value, setValue] = useState("#0000ff");
      return [useColorValue(value, "#000000", setValue), setValue] as const;
    });
    // Blue taken down to black, and the owner takes the change: the hue is remembered.
    act(() => result.current[0][1]([240, 1, 0, 1]));
    expect(result.current[0][0]).toEqual([240, 1, 0, 1]);
    // Red from outside, then black from outside: that black has no hue.
    act(() => result.current[1]("#ff0000"));
    expect(result.current[0][0]).toEqual([0, 1, 1, 1]);
    act(() => result.current[1]("#000000"));
    expect(result.current[0][0]).toEqual([0, 0, 0, 1]);
  });

  it("gives a picker without a value the colour a panel shares with it, and no other", () => {
    const set = vi.fn();
    const shared: ColorState = [[240, 1, 0, 1], set];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ColorContext value={shared}>{children}</ColorContext>
    );
    // Black with the hue of blue: the hue comes through, which hex could not carry.
    const inside = renderHook(() => useColorValue(undefined, "#ffffff"), { wrapper });
    expect(inside.result.current[0]).toEqual([240, 1, 0, 1]);
    act(() => inside.result.current[1]([240, 1, 1, 1]));
    expect(set).toHaveBeenLastCalledWith([240, 1, 1, 1]);

    const withValue = renderHook(() => useColorValue("#ff0000", "#ffffff"), { wrapper });
    expect(withValue.result.current[0]).toEqual([0, 1, 1, 1]);
    const own = renderHook(() => useColorState(undefined, "#ffffff"), { wrapper });
    expect(own.result.current[0]).toEqual([0, 0, 1, 1]);
  });
});
