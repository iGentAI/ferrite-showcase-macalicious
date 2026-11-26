import { describe, expect, it } from "vitest";
import {
  convertByCode,
  convertByName,
  currencyNames,
  type ExchangeRates,
  ratesFromServer,
  ratesSourceText,
  updateWords,
} from "./calculator-rates";

const RATES: ExchangeRates = {
  date: "2026-11-06",
  source: "European Central Bank",
  rates: { EUR: 1, USD: 1.25, JPY: 150 },
};

describe("exchange rates", () => {
  it("reads the server's answer, and nothing else", () => {
    expect(
      ratesFromServer({
        base: "EUR",
        date: "2026-11-06",
        rates: { EUR: 1, USD: 1.1165 },
        source: "European Central Bank",
        stale: "European Central Bank: no answer",
      }),
    ).toEqual({
      date: "2026-11-06",
      rates: { EUR: 1, USD: 1.1165 },
      source: "European Central Bank",
      stale: "European Central Bank: no answer",
    });
    expect(ratesFromServer({ date: "today", rates: { EUR: 1 }, source: "x" })).toBeNull();
    expect(ratesFromServer({ date: "2026-11-06", rates: { USD: "1" }, source: "x" })).toBeNull();
    expect(ratesFromServer({ date: "2026-11-06", rates: {}, source: "x" })).toBeNull();
    expect(ratesFromServer(null)).toBeNull();
  });

  it("converts through the euro", () => {
    expect(convertByCode(RATES, 10, "EUR", "USD")).toBe(12.5);
    expect(convertByCode(RATES, 12.5, "USD", "EUR")).toBe(10);
    expect(convertByCode(RATES, 5, "USD", "JPY")).toBe(600);
    expect(convertByCode(RATES, 5, "USD", "GBP")).toBeUndefined();
    expect(convertByName(RATES, 10, "Euro", "US Dollar")).toBe(12.5);
  });

  it("lists what the rates can convert, by name", () => {
    expect(currencyNames(RATES)).toEqual(["Euro", "Japanese Yen", "US Dollar"]);
  });

  it("says where rates come from and what an update came to", () => {
    expect(ratesSourceText(RATES)).toBe(
      "Last updated: November 6, 2026. European Central Bank reference rates.",
    );
    expect(updateWords({ kind: "read", rates: RATES }).title).toBe(
      "The exchange rates are up to date.",
    );
    expect(
      updateWords({ kind: "read", rates: { ...RATES, stale: "European Central Bank: no answer" } }),
    ).toEqual({
      title: "The exchange rates could not be updated.",
      detail: "European Central Bank: no answer. The rates of November 6, 2026 stay in use.",
    });
    expect(updateWords({ kind: "failed", problem: "No rates." }).detail).toBe("No rates.");
  });
});
