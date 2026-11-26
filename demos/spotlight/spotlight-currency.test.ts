import { describe, expect, it } from "vitest";
import { askedCurrency, currencyConversion } from "./spotlight-currency";

const RATES = {
  date: "2026-11-06",
  source: "European Central Bank",
  rates: { EUR: 1, USD: 1.25, GBP: 0.8 },
};

describe("Spotlight's currency", () => {
  it("reads what people type for one", () => {
    expect(askedCurrency("100 usd to eur")).toEqual({ amount: 100, from: "USD", to: "EUR" });
    expect(askedCurrency("$5 in yen")).toEqual({ amount: 5, from: "USD", to: "JPY" });
    expect(askedCurrency("1,200.50 euros into pounds")).toEqual({
      amount: 1200.5,
      from: "EUR",
      to: "GBP",
    });
    expect(askedCurrency("20 swiss francs = us dollars")).toEqual({
      amount: 20,
      from: "CHF",
      to: "USD",
    });
  });

  it("leaves everything else alone", () => {
    expect(askedCurrency("5 km to miles")).toBeUndefined();
    expect(askedCurrency("20 pounds to kg")).toBeUndefined();
    expect(askedCurrency("usd to eur")).toBeUndefined();
    expect(askedCurrency("5 usd to usd")).toBeUndefined();
  });

  it("answers to the hundredth, in words", () => {
    expect(currencyConversion({ amount: 100, from: "USD", to: "EUR" }, RATES)).toEqual({
      value: 100,
      result: 80,
      text: "100 US Dollars = 80.00 Euros",
      answer: "80.00 Euros",
    });
    expect(currencyConversion({ amount: 1, from: "EUR", to: "GBP" }, RATES)?.text).toBe(
      "1 Euro = 0.80 British Pounds",
    );
    expect(currencyConversion({ amount: 1, from: "EUR", to: "JPY" }, RATES)).toBeUndefined();
  });
});
