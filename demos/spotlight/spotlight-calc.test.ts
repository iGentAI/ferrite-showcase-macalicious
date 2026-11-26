import { describe, expect, it } from "vitest";
import { convert, evaluate, formatNumber } from "./spotlight-calc";

describe("Spotlight's sums", () => {
  it("works out arithmetic with precedence, powers, percentages and functions", () => {
    expect(evaluate("2+2")).toBe(4);
    expect(evaluate("2 + 3 * 4")).toBe(14);
    expect(evaluate("(2 + 3) × 4")).toBe(20);
    expect(evaluate("2^10")).toBe(1024);
    expect(evaluate("2^3^2")).toBe(512);
    expect(evaluate("-2^2")).toBe(-4);
    expect(evaluate("(-2)^2")).toBe(4);
    expect(evaluate("2^-3")).toBe(0.125);
    expect(evaluate("3*-2")).toBe(-6);
    expect(evaluate("-3 + 1")).toBe(-2);
    expect(evaluate("15% of 80")).toBeCloseTo(12);
    expect(evaluate("50%")).toBe(0.5);
    expect(evaluate("1,000 / 8")).toBe(125);
    expect(evaluate("sqrt(16) + 1")).toBe(5);
    expect(evaluate("2 pi")).toBeUndefined();
    expect(evaluate("2*pi")).toBeCloseTo(6.283185307);
  });

  it("leaves alone what is not a sum", () => {
    for (const text of ["", "42", "ada", "notes 2", "2+", "(1+2", "1/0", "alert(1)", "sqrt"]) {
      expect(evaluate(text), text).toBeUndefined();
    }
  });

  it("writes results with at most ten significant digits", () => {
    expect(formatNumber(4)).toBe("4");
    expect(formatNumber(1 / 3)).toBe("0.3333333333");
    expect(formatNumber(1234567.5)).toBe("1,234,567.5");
    expect(formatNumber(2 ** 60)).toBe("1.152922e+18");
    // A small result keeps its significant digits, not a fixed count of decimals.
    expect(formatNumber(1.049e-9)).toBe("0.000000001049");
    expect(formatNumber(0.000123456789123)).toBe("0.0001234567891");
    expect(formatNumber(-2.5e-7)).toBe("-0.00000025");
  });
});

describe("Spotlight's unit conversions", () => {
  it("converts within one dimension, spelled out or abbreviated", () => {
    expect(convert("5 km to miles")?.text).toBe("5 kilometers = 3.106855961 miles");
    expect(convert("1 mile in km")?.answer).toBe("1.609344 kilometers");
    expect(convert("12 inches in feet")?.answer).toBe("1 foot");
    expect(convert("2 lb to kg")?.result).toBeCloseTo(0.90718474);
    expect(convert("1 gib in mb")?.answer).toBe("1,073.741824 megabytes");
    expect(convert("100 km/h to mph")?.result).toBeCloseTo(62.137119);
    expect(convert("10 m2 to ft2")?.result).toBeCloseTo(107.639104);
    expect(convert("2 km2 in m2")?.answer).toBe("2,000,000 square meters");
    expect(convert("1 acre to sq ft")?.result).toBeCloseTo(43_560);
  });

  it("takes every unit in the singular and the plural, short names and compound ones too", () => {
    expect(convert("2 cups to liters")?.answer).toBe("0.473176473 liters");
    expect(convert("1 cup to ml")?.answer).toBe("236.5882365 milliliters");
    expect(convert("2 days to hours")?.answer).toBe("48 hours");
    expect(convert("1 day in hours")?.answer).toBe("24 hours");
    expect(convert("10 square feet to square meters")?.answer).toBe("0.9290304 square meters");
    expect(convert("1 square foot in square metres")?.result).toBeCloseTo(0.09290304);
    expect(convert("3 nautical miles to km")?.answer).toBe("5.556 kilometers");
    expect(convert("2 fluid ounces to ml")?.result).toBeCloseTo(59.147059125);
    expect(convert("5 meters per second to km/h")?.answer).toBe("18 kilometers per hour");
    expect(convert("2 weeks to days")?.answer).toBe("14 days");
    // An abbreviation has no plural of its own: `ms` stays milliseconds, not meters.
    expect(convert("1000 ms to s")?.answer).toBe("1 second");
  });

  it("converts temperatures by their scales, not by a factor", () => {
    expect(convert("212 F to C")?.answer).toBe("100 °C");
    expect(convert("0 c in f")?.answer).toBe("32 °F");
    expect(convert("0 k to celsius")?.answer).toBe("-273.15 °C");
  });

  it("refuses units it does not know and mixed dimensions", () => {
    expect(convert("5 km to kg")).toBeUndefined();
    expect(convert("5 parsecs to km")).toBeUndefined();
    expect(convert("10 usd to eur")).toBeUndefined();
    expect(convert("km to miles")).toBeUndefined();
    expect(convert("5 km to km")).toBeUndefined();
  });
});
