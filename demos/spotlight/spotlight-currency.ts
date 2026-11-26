"use client";

import { useEffect, useState } from "react";
import {
  CURRENCIES,
  convertByCode,
  type ExchangeRates,
  readRates,
} from "../calculator/calculator-rates";
import type { Conversion } from "./spotlight-calc";
import { formatNumber } from "./spotlight-calc";

/** What people type for a currency, besides its code. */
const SAID: Readonly<Record<string, string>> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  dollar: "USD",
  dollars: "USD",
  bucks: "USD",
  euro: "EUR",
  euros: "EUR",
  pound: "GBP",
  pounds: "GBP",
  sterling: "GBP",
  yen: "JPY",
  yuan: "CNY",
  franc: "CHF",
  francs: "CHF",
  rupee: "INR",
  rupees: "INR",
  peso: "MXN",
  pesos: "MXN",
  won: "KRW",
  real: "BRL",
  reais: "BRL",
  rand: "ZAR",
  baht: "THB",
  zloty: "PLN",
  lira: "TRY",
};

const codeSaid = (said: string): string | undefined => {
  const word = said.trim().toLowerCase();
  if (!word) return undefined;
  const known = CURRENCIES.find(
    ([code, name, plural]) =>
      code.toLowerCase() === word || name.toLowerCase() === word || plural.toLowerCase() === word,
  );
  return known?.[0] ?? SAID[word];
};

export interface AskedCurrency {
  amount: number;
  from: string;
  to: string;
}

const ASKED =
  /^\s*([$€£¥])?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*([^\d]*?)\s+(?:to|in|as|into|=)\s+([^\d]+?)\s*$/i;

/** The conversion `text` asks for: `100 usd to eur`, `$5 in yen`, `20 pounds to euros`. */
export function askedCurrency(text: string): AskedCurrency | undefined {
  const match = ASKED.exec(text);
  if (!match) return undefined;
  const from = codeSaid(match[3] ?? "") ?? codeSaid(match[1] ?? "");
  const to = codeSaid(match[4] ?? "");
  if (!from || !to || from === to) return undefined;
  return { amount: Number((match[2] ?? "").replaceAll(",", "")), from, to };
}

const nameOf = (code: string, amount: number) => {
  const currency = CURRENCIES.find((each) => each[0] === code);
  return (amount === 1 ? currency?.[1] : currency?.[2]) ?? code;
};

const MONEY = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** What was asked, at these rates, to the hundredth; `undefined` when they do not hold a currency. */
export function currencyConversion(
  asked: AskedCurrency,
  rates: ExchangeRates,
): Conversion | undefined {
  const exact = convertByCode(rates, asked.amount, asked.from, asked.to);
  if (exact === undefined) return undefined;
  const result = Math.round(exact * 100) / 100;
  const answer = `${MONEY.format(result)} ${nameOf(asked.to, result)}`;
  return {
    value: asked.amount,
    result,
    text: `${formatNumber(asked.amount)} ${nameOf(asked.from, asked.amount)} = ${answer}`,
    answer,
  };
}

export type CurrencyAnswer =
  | { kind: "converted"; conversion: Conversion; rates: ExchangeRates }
  | { kind: "failed"; problem: string };

const PAUSE_MS = 300;

/** What the rates make of the query, once they are read; `null` when it asks for no currency. */
export function useCurrencyAnswer(query: string, enabled: boolean): CurrencyAnswer | null {
  const asked = enabled ? askedCurrency(query) : undefined;
  const wanted = asked ? `${asked.amount} ${asked.from} ${asked.to}` : "";
  const [found, setFound] = useState<CurrencyAnswer | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `wanted` is `asked` by value
  useEffect(() => {
    setFound(null);
    if (!asked) return undefined;
    let current = true;
    const pause = setTimeout(() => {
      void readRates().then((read) => {
        if (!current) return;
        if (read.kind === "failed") {
          setFound(read);
          return;
        }
        const conversion = currencyConversion(asked, read.rates);
        setFound(
          conversion
            ? { kind: "converted", conversion, rates: read.rates }
            : {
                kind: "failed",
                problem: `${read.rates.source} publishes no rate for that currency.`,
              },
        );
      });
    }, PAUSE_MS);
    return () => {
      current = false;
      clearTimeout(pause);
    };
  }, [wanted]);
  return found;
}
