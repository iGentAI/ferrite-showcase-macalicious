"use client";

import { useEffect, useState } from "react";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";

/**
 * Exchange rates as the desktop's server reads them from the European Central Bank
 * (`ferrite-apps/desktop/src/apps/calculator/rates.rs`), for Calculator's Convert menu and for
 * Spotlight. Every rate is units of a currency per euro, on the date the bank gave it.
 */

export const RATES_URL = "/api/calculator/rates";

export interface ExchangeRates {
  /** The bank's date, `2026-11-06`. */
  date: string;
  rates: Readonly<Record<string, number>>;
  source: string;
  /** Why these are not the latest, when the bank could not be read. */
  stale?: string;
}

export type RatesRead =
  | { kind: "read"; rates: ExchangeRates }
  | { kind: "failed"; problem: string };
export type RatesState = { kind: "reading" } | RatesRead;

/** The currencies the bank publishes: code, name, and the name of several. The names are provisional. */
export const CURRENCIES: readonly (readonly [code: string, name: string, plural: string])[] = [
  ["AUD", "Australian Dollar", "Australian Dollars"],
  ["BRL", "Brazilian Real", "Brazilian Reais"],
  ["GBP", "British Pound", "British Pounds"],
  ["BGN", "Bulgarian Lev", "Bulgarian Leva"],
  ["CAD", "Canadian Dollar", "Canadian Dollars"],
  ["CNY", "Chinese Yuan", "Chinese Yuan"],
  ["CZK", "Czech Koruna", "Czech Korunas"],
  ["DKK", "Danish Krone", "Danish Kroner"],
  ["EUR", "Euro", "Euros"],
  ["HKD", "Hong Kong Dollar", "Hong Kong Dollars"],
  ["HUF", "Hungarian Forint", "Hungarian Forints"],
  ["ISK", "Icelandic Króna", "Icelandic Krónur"],
  ["INR", "Indian Rupee", "Indian Rupees"],
  ["IDR", "Indonesian Rupiah", "Indonesian Rupiahs"],
  ["ILS", "Israeli Shekel", "Israeli Shekels"],
  ["JPY", "Japanese Yen", "Japanese Yen"],
  ["MYR", "Malaysian Ringgit", "Malaysian Ringgits"],
  ["MXN", "Mexican Peso", "Mexican Pesos"],
  ["NZD", "New Zealand Dollar", "New Zealand Dollars"],
  ["NOK", "Norwegian Krone", "Norwegian Kroner"],
  ["PHP", "Philippine Peso", "Philippine Pesos"],
  ["PLN", "Polish Zloty", "Polish Zlotys"],
  ["RON", "Romanian Leu", "Romanian Lei"],
  ["SGD", "Singapore Dollar", "Singapore Dollars"],
  ["ZAR", "South African Rand", "South African Rand"],
  ["KRW", "South Korean Won", "South Korean Won"],
  ["SEK", "Swedish Krona", "Swedish Kronor"],
  ["CHF", "Swiss Franc", "Swiss Francs"],
  ["THB", "Thai Baht", "Thai Baht"],
  ["TRY", "Turkish Lira", "Turkish Lira"],
  ["USD", "US Dollar", "US Dollars"],
];

const codeOf = (name: string) => CURRENCIES.find((each) => each[1] === name)?.[0];

/** The server's answer, or `null` when it does not have that shape. */
export function ratesFromServer(body: unknown): ExchangeRates | null {
  const { date, rates, source, stale } = (body ?? {}) as Partial<
    Record<keyof ExchangeRates, unknown>
  >;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof source !== "string" || rates === null || typeof rates !== "object") return null;
  const entries = Object.entries(rates);
  if (entries.length === 0) return null;
  if (!entries.every(([, rate]) => typeof rate === "number" && rate > 0)) return null;
  return {
    date,
    source,
    rates: rates as Record<string, number>,
    ...(typeof stale === "string" ? { stale } : {}),
  };
}

/** `amount` of one currency in another, by code; `undefined` when the rates hold either not. */
export function convertByCode(
  rates: ExchangeRates,
  amount: number,
  from: string,
  to: string,
): number | undefined {
  const fromRate = rates.rates[from];
  const toRate = rates.rates[to];
  return fromRate === undefined || toRate === undefined ? undefined : (amount / fromRate) * toRate;
}

/** `amount` of one currency in another, by the names the Convert sheet lists. */
export function convertByName(
  rates: ExchangeRates,
  amount: number,
  from: string,
  to: string,
): number | undefined {
  return convertByCode(rates, amount, codeOf(from) ?? "", codeOf(to) ?? "");
}

/** The names of the currencies these rates can convert. */
export const currencyNames = (rates: ExchangeRates): readonly string[] =>
  CURRENCIES.filter(([code]) => rates.rates[code] !== undefined).map(([, name]) => name);

/** The bank's date as a person reads it, whatever the browser's zone. */
export const ratesDateText = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/** The line that says where rates come from and how old they are. */
export const ratesSourceText = (rates: ExchangeRates) =>
  `Last updated: ${ratesDateText(rates.date)}. ${rates.source} reference rates.`;

/** The rates from the server, with `update` asking the bank now; never throws. */
export async function readRates(update = false): Promise<RatesRead> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(update ? `${RATES_URL}?update=1` : RATES_URL, {
        credentials: "same-origin",
        signal,
      });
      const body = await response.json().catch(() => null);
      const rates = response.ok ? ratesFromServer(body) : null;
      if (rates) return { kind: "read", rates } as const;
      const said = (body as { error?: unknown } | null)?.error;
      return {
        kind: "failed",
        problem: typeof said === "string" ? said : "The desktop's server gave no rates.",
      } as const;
    });
  } catch {
    return { kind: "failed", problem: "The desktop's server did not answer." };
  }
}

/** The rates, read while `wanted`, and Update Currency Exchange Rates. */
export function useExchangeRates(wanted: boolean) {
  const [state, setState] = useState<RatesState>({ kind: "reading" });
  useEffect(() => {
    if (!wanted) return undefined;
    let current = true;
    setState({ kind: "reading" });
    void readRates().then((read) => {
      if (current) setState(read);
    });
    return () => {
      current = false;
    };
  }, [wanted]);
  const update = async (): Promise<RatesRead> => {
    const read = await readRates(true);
    setState((before) => (read.kind === "failed" && before.kind === "read" ? before : read));
    return read;
  };
  return { state, update };
}

/** What the Update sheet says about what an update came to. */
export function updateWords(state: RatesState): { title: string; detail: string } {
  if (state.kind === "reading") {
    return { title: "Updating currency exchange rates…", detail: "" };
  }
  if (state.kind === "failed") {
    return { title: "The exchange rates could not be updated.", detail: state.problem };
  }
  const { rates } = state;
  return rates.stale
    ? {
        title: "The exchange rates could not be updated.",
        detail: `${rates.stale}. The rates of ${ratesDateText(rates.date)} stay in use.`,
      }
    : { title: "The exchange rates are up to date.", detail: ratesSourceText(rates) };
}
