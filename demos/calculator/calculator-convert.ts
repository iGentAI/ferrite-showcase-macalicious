/**
 * Calculator's Convert menu: each category's units as their size in one base unit, so a conversion
 * is one multiplication and one division. The factors are the exact definitions where one exists
 * (the international foot, the avoirdupois pound, the US gallon). The unit lists are from memory of
 * the real app and provisional. Temperature alone is not a ratio, and Currency's sizes are the day's
 * rates, which come from the server (`calculator-rates.ts`).
 */

import { CURRENCIES, convertByName, type ExchangeRates } from "./calculator-rates";

export type ConvertCategoryId =
  | "area"
  | "currency"
  | "energy"
  | "temperature"
  | "length"
  | "speed"
  | "pressure"
  | "mass"
  | "power"
  | "volume";

export interface ConvertCategory {
  id: ConvertCategoryId;
  /** The menu's name, which ends in an ellipsis there. */
  title: string;
  units: readonly (readonly [name: string, size: number])[];
}

const BTU = 1055.05585262;
const FOOT_POUND = 1.3558179483314;
const MILE = 1609.344;

export const CONVERT_CATEGORIES: readonly ConvertCategory[] = [
  {
    id: "area",
    title: "Area",
    units: [
      ["Acres", 4046.8564224],
      ["Ares", 100],
      ["Hectares", 10_000],
      ["Square Centimeters", 0.0001],
      ["Square Feet", 0.09290304],
      ["Square Inches", 0.00064516],
      ["Square Kilometers", 1_000_000],
      ["Square Meters", 1],
      ["Square Miles", 2_589_988.110336],
      ["Square Yards", 0.83612736],
    ],
  },
  {
    id: "currency",
    title: "Currency",
    units: CURRENCIES.map(([, name]) => [name, 1] as const),
  },
  {
    id: "energy",
    title: "Energy or Work",
    units: [
      ["BTUs", BTU],
      ["Calories", 4.184],
      ["Ergs", 1e-7],
      ["Foot-Pounds", FOOT_POUND],
      ["Joules", 1],
      ["Kilogram-Calories", 4184],
      ["Kilogram-Meters", 9.80665],
      ["Kilowatt-Hours", 3_600_000],
      ["Newton-Meters", 1],
    ],
  },
  {
    id: "temperature",
    title: "Temperature",
    units: [
      ["Celsius", 1],
      ["Fahrenheit", 1],
      ["Kelvin", 1],
    ],
  },
  {
    id: "length",
    title: "Length",
    units: [
      ["Centimeters", 0.01],
      ["Feet", 0.3048],
      ["Inches", 0.0254],
      ["Kilometers", 1000],
      ["Meters", 1],
      ["Miles", MILE],
      ["Millimeters", 0.001],
      ["Nautical Miles", 1852],
      ["Yards", 0.9144],
    ],
  },
  {
    id: "speed",
    title: "Speed",
    units: [
      ["Feet per Minute", 0.3048 / 60],
      ["Feet per Second", 0.3048],
      ["Kilometers per Hour", 1000 / 3600],
      ["Kilometers per Minute", 1000 / 60],
      ["Knots", 1852 / 3600],
      ["Meters per Second", 1],
      ["Miles per Hour", MILE / 3600],
      ["Miles per Minute", MILE / 60],
    ],
  },
  {
    id: "pressure",
    title: "Pressure",
    units: [
      ["Atmospheres", 101_325],
      ["Bars", 100_000],
      ["Inches of Mercury", 3386.389],
      ["Kilopascals", 1000],
      ["Millibars", 100],
      ["Millimeters of Mercury", 133.322387415],
      ["Pascals", 1],
      ["Pounds per Square Inch", 6894.757293168],
    ],
  },
  {
    id: "mass",
    title: "Weights and Masses",
    units: [
      ["Grams", 1],
      ["Kilograms", 1000],
      ["Long Tons", 1_016_046.9088],
      ["Metric Tons", 1_000_000],
      ["Ounces", 28.349523125],
      ["Pounds", 453.59237],
      ["Short Tons", 907_184.74],
      ["Stones", 6350.29318],
      ["Troy Ounces", 31.1034768],
    ],
  },
  {
    id: "power",
    title: "Power",
    units: [
      ["BTUs per Minute", BTU / 60],
      ["Foot-Pounds per Minute", FOOT_POUND / 60],
      ["Foot-Pounds per Second", FOOT_POUND],
      ["Horsepower", 745.69987158227],
      ["Kilowatts", 1000],
      ["Watts", 1],
    ],
  },
  {
    id: "volume",
    title: "Volume",
    units: [
      ["Cubic Centimeters", 0.001],
      ["Cubic Feet", 28.316846592],
      ["Cubic Inches", 0.016387064],
      ["Cubic Meters", 1000],
      ["Cubic Yards", 764.554857984],
      ["Cups", 0.2365882365],
      ["Fluid Ounces", 0.0295735295625],
      ["Gallons", 3.785411784],
      ["Liters", 1],
      ["Milliliters", 0.001],
      ["Pints", 0.473176473],
      ["Quarts", 0.946352946],
      ["Tablespoons", 0.01478676478125],
      ["Teaspoons", 0.00492892159375],
    ],
  },
];

export const categoryOf = (id: ConvertCategoryId): ConvertCategory =>
  CONVERT_CATEGORIES.find((category) => category.id === id) as ConvertCategory;

const toCelsius = (value: number, unit: string) =>
  unit === "Fahrenheit" ? ((value - 32) * 5) / 9 : unit === "Kelvin" ? value - 273.15 : value;
const fromCelsius = (value: number, unit: string) =>
  unit === "Fahrenheit" ? (value * 9) / 5 + 32 : unit === "Kelvin" ? value + 273.15 : value;

/** `value` in `from`, in `to`. Both are unit names of the category. Currency needs `rates`, and
 * is not a number without them. */
export function convert(
  id: ConvertCategoryId,
  value: number,
  from: string,
  to: string,
  rates?: ExchangeRates,
): number {
  if (id === "currency") {
    return (rates && convertByName(rates, value, from, to)) ?? Number.NaN;
  }
  if (id === "temperature") return fromCelsius(toCelsius(value, from), to);
  const { units } = categoryOf(id);
  const size = (name: string) => units.find(([unit]) => unit === name)?.[1] ?? Number.NaN;
  return (value * size(from)) / size(to);
}

/** One conversion the person made, offered again under Recent Conversions. */
export interface RecentConversion {
  category: ConvertCategoryId;
  from: string;
  to: string;
}

export const RECENT_LIMIT = 5;

export const recentTitle = ({ category, from, to }: RecentConversion) =>
  `${categoryOf(category).title}: ${from} to ${to}`;

/** The newest first, each conversion once. */
export const withRecent = (
  recent: readonly RecentConversion[],
  added: RecentConversion,
): RecentConversion[] =>
  [added, ...recent.filter((each) => recentTitle(each) !== recentTitle(added))].slice(
    0,
    RECENT_LIMIT,
  );

export function readRecent(stored: unknown): readonly RecentConversion[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored
    .filter((each): each is RecentConversion => {
      const units = CONVERT_CATEGORIES.find(({ id }) => id === each?.category)?.units;
      const known = (name: unknown) => !!units?.some(([unit]) => unit === name);
      return known(each?.from) && known(each?.to);
    })
    .map(({ category, from, to }) => ({ category, from, to }))
    .slice(0, RECENT_LIMIT);
}
