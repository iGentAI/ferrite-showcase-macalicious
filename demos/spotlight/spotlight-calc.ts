/**
 * What Spotlight works out in the browser, as Catalina's does: sums typed into the field (`2+2`,
 * `sqrt(2)*10`, `15% of 80`) and unit conversions (`5 km to miles`, `72 f in c`). Nothing here asks
 * a server; currency is converted in `spotlight-currency.ts`, from the rates the server reads.
 */

/** The functions a sum may use. */
const FUNCTIONS: Readonly<Record<string, (value: number) => number>> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, π: Math.PI, e: Math.E };

type Token =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "op"; value: string };

function tokenize(text: string): Token[] | undefined {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const space = /^\s+/.exec(rest);
    if (space) {
      i += space[0].length;
      continue;
    }
    // A number, with thousands separators (`1,000.5`) or none.
    const number = /^(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?([eE][+-]?\d+)?/.exec(rest);
    if (number && number[0] !== "" && /\d/.test(number[0])) {
      tokens.push({ kind: "number", value: Number(number[0].replaceAll(",", "")) });
      i += number[0].length;
      continue;
    }
    const name = /^(π|[a-z]+)/i.exec(rest);
    if (name) {
      tokens.push({ kind: "name", value: name[0].toLowerCase() });
      i += name[0].length;
      continue;
    }
    const op = /^(\*\*|[-+*/^%()×÷−])/.exec(rest);
    if (!op) return undefined;
    const value = op[0] === "×" ? "*" : op[0] === "÷" ? "/" : op[0] === "−" ? "-" : op[0];
    tokens.push({ kind: "op", value: value === "**" ? "^" : value });
    i += op[0].length;
  }
  return tokens;
}

/**
 * The value of a sum, or `undefined` when the text is not one. A bare number is not a sum: at
 * least one operator or function must appear. `x% of y` and a trailing `%` (a hundredth) work.
 */
export function evaluate(text: string): number | undefined {
  const normalized = text.trim().replace(/(\d)\s*%\s*of\s+/gi, "$1%*");
  if (normalized === "" || normalized.length > 200) return undefined;
  const tokens = tokenize(normalized);
  if (!tokens || tokens.length < 2) return undefined;
  if (!tokens.some((token) => token.kind === "op" || token.value in FUNCTIONS)) return undefined;
  let at = 0;
  const peek = () => tokens[at];
  const take = () => tokens[at++];
  const isOp = (value: string) => {
    const token = peek();
    return token?.kind === "op" && token.value === value;
  };

  // expression := term (('+' | '-') term)*
  const expression = (): number | undefined => {
    let value = term();
    while (value !== undefined && (isOp("+") || isOp("-"))) {
      const op = take()?.value;
      const right = term();
      if (right === undefined) return undefined;
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  // term := unary (('*' | '/') unary)*
  const term = (): number | undefined => {
    let value = unary();
    while (value !== undefined && (isOp("*") || isOp("/"))) {
      const op = take()?.value;
      const right = unary();
      if (right === undefined) return undefined;
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };
  // unary := ('-' | '+') unary | power. A leading sign binds more loosely than a power, as in
  // ordinary notation: -2^2 is -(2^2).
  const unary = (): number | undefined => {
    if (isOp("-")) {
      take();
      const value = unary();
      return value === undefined ? undefined : -value;
    }
    if (isOp("+")) {
      take();
      return unary();
    }
    return power();
  };
  // power := postfix ('^' unary)?, right-associative; the exponent may carry a sign (2^-3).
  const power = (): number | undefined => {
    const base = postfix();
    if (base === undefined) return undefined;
    if (isOp("^")) {
      take();
      const exponent = unary();
      return exponent === undefined ? undefined : base ** exponent;
    }
    return base;
  };
  // postfix := primary '%'*
  const postfix = (): number | undefined => {
    let value = primary();
    while (value !== undefined && isOp("%")) {
      take();
      value /= 100;
    }
    return value;
  };
  const primary = (): number | undefined => {
    const token = take();
    if (!token) return undefined;
    if (token.kind === "number") return token.value;
    if (token.kind === "name") {
      if (token.value in CONSTANTS) return CONSTANTS[token.value];
      const fn = FUNCTIONS[token.value];
      if (!fn) return undefined;
      const argument = isOp("(") ? primary() : unary();
      return argument === undefined ? undefined : fn(argument);
    }
    if (token.value === "(") {
      const value = expression();
      if (!isOp(")")) return undefined;
      take();
      return value;
    }
    return undefined;
  };

  const value = expression();
  if (value === undefined || at !== tokens.length || !Number.isFinite(value)) return undefined;
  return value;
}

/** A number as Spotlight shows a result: up to ten significant digits, grouped. */
export function formatNumber(value: number): string {
  if (value !== 0 && (Math.abs(value) >= 1e15 || Math.abs(value) < 1e-9)) {
    return value.toExponential(6).replace(/\.?0+e/, "e");
  }
  // Significant digits, not a fixed count of decimals, so a small result keeps its precision.
  return value.toLocaleString("en-US", { maximumSignificantDigits: 10 });
}

interface Unit {
  /** The dimension it measures. */
  dimension: "length" | "mass" | "volume" | "time" | "data" | "speed" | "area" | "temperature";
  /** Its size in the dimension's base unit (metres, grams, litres, seconds, bytes, m/s, m²). */
  factor: number;
  /** Its name in a result. */
  name: string;
  plural: string;
}

const unit = (
  dimension: Unit["dimension"],
  factor: number,
  name: string,
  plural = `${name}s`,
): Unit => ({ dimension, factor, name, plural });

const UNITS: ReadonlyMap<string, Unit> = new Map(
  (
    [
      [["mm", "millimeter", "millimetre"], unit("length", 0.001, "millimeter")],
      [["cm", "centimeter", "centimetre"], unit("length", 0.01, "centimeter")],
      [["m", "meter", "metre"], unit("length", 1, "meter")],
      [["km", "kilometer", "kilometre"], unit("length", 1000, "kilometer")],
      [["in", "inch", '"'], unit("length", 0.0254, "inch", "inches")],
      [["ft", "foot", "feet", "'"], unit("length", 0.3048, "foot", "feet")],
      [["yd", "yard"], unit("length", 0.9144, "yard")],
      [["mi", "mile"], unit("length", 1609.344, "mile")],
      [["nmi", "nautical mile"], unit("length", 1852, "nautical mile")],
      [["mg", "milligram"], unit("mass", 0.001, "milligram")],
      [["g", "gram"], unit("mass", 1, "gram")],
      [["kg", "kilogram", "kilo"], unit("mass", 1000, "kilogram")],
      [["t", "tonne", "metric ton"], unit("mass", 1_000_000, "tonne")],
      [["oz", "ounce"], unit("mass", 28.349523125, "ounce")],
      [["lb", "lbs", "pound"], unit("mass", 453.59237, "pound")],
      [["st", "stone"], unit("mass", 6350.29318, "stone", "stone")],
      [["ml", "milliliter", "millilitre"], unit("volume", 0.001, "milliliter")],
      [["cl", "centiliter", "centilitre"], unit("volume", 0.01, "centiliter")],
      [["l", "liter", "litre"], unit("volume", 1, "liter")],
      [["tsp", "teaspoon"], unit("volume", 0.00492892159375, "teaspoon")],
      [["tbsp", "tablespoon"], unit("volume", 0.0147867647812, "tablespoon")],
      [["floz", "fl oz", "fluid ounce"], unit("volume", 0.0295735295625, "fluid ounce")],
      [["cup"], unit("volume", 0.2365882365, "cup")],
      [["pt", "pint"], unit("volume", 0.473176473, "pint")],
      [["qt", "quart"], unit("volume", 0.946352946, "quart")],
      [["gal", "gallon"], unit("volume", 3.785411784, "gallon")],
      [["ms", "millisecond"], unit("time", 0.001, "millisecond")],
      [["s", "sec", "second"], unit("time", 1, "second")],
      [["min", "minute"], unit("time", 60, "minute")],
      [["h", "hr", "hour"], unit("time", 3600, "hour")],
      [["day"], unit("time", 86_400, "day")],
      [["week", "wk"], unit("time", 604_800, "week")],
      [["year", "yr"], unit("time", 31_557_600, "year")],
      [["b", "byte"], unit("data", 1, "byte")],
      [["kb", "kilobyte"], unit("data", 1e3, "kilobyte")],
      [["mb", "megabyte"], unit("data", 1e6, "megabyte")],
      [["gb", "gigabyte"], unit("data", 1e9, "gigabyte")],
      [["tb", "terabyte"], unit("data", 1e12, "terabyte")],
      [["kib", "kibibyte"], unit("data", 1024, "kibibyte")],
      [["mib", "mebibyte"], unit("data", 1024 ** 2, "mebibyte")],
      [["gib", "gibibyte"], unit("data", 1024 ** 3, "gibibyte")],
      [["m/s", "mps"], unit("speed", 1, "meter per second", "meters per second")],
      [["km/h", "kph", "kmh"], unit("speed", 1 / 3.6, "kilometer per hour", "kilometers per hour")],
      [["mph"], unit("speed", 0.44704, "mile per hour", "miles per hour")],
      [["kn", "knot"], unit("speed", 0.514444, "knot")],
      [["m2", "m²", "sq m", "square meter", "square metre"], unit("area", 1, "square meter")],
      [
        ["km2", "km²", "square kilometer", "square kilometre"],
        unit("area", 1e6, "square kilometer"),
      ],
      [
        ["ft2", "ft²", "sq ft", "square foot"],
        unit("area", 0.09290304, "square foot", "square feet"),
      ],
      [["acre"], unit("area", 4046.8564224, "acre")],
      [["ha", "hectare"], unit("area", 10_000, "hectare")],
      [["c", "°c", "celsius", "centigrade"], unit("temperature", 0, "°C", "°C")],
      [["f", "°f", "fahrenheit"], unit("temperature", 0, "°F", "°F")],
      [["k", "kelvin"], unit("temperature", 0, "K", "K")],
    ] as const
  ).flatMap(([names, value]) => [
    // The unit's own name and plural, as a result writes them: every unit answers to both
    // (`cup` and `cups`, `day` and `days`, `square foot` and `square feet`).
    [value.name.toLowerCase(), value] as [string, Unit],
    [value.plural.toLowerCase(), value] as [string, Unit],
    ...names.flatMap((name) => {
      const pairs: [string, Unit][] = [[name, value]];
      // Another spelled-out name also answers in the plural (`metres`, `kilos`). Abbreviations
      // do not: `m` and `s` would make `ms`.
      if (name.length > 3 && /^[a-z ]+$/.test(name)) {
        pairs.push([name.endsWith("ch") ? `${name}es` : `${name}s`, value]);
      }
      return pairs;
    }),
  ]),
);

const toKelvin = (value: number, name: string) =>
  name === "°C" ? value + 273.15 : name === "°F" ? ((value - 32) * 5) / 9 + 273.15 : value;
const fromKelvin = (value: number, name: string) =>
  name === "°C" ? value - 273.15 : name === "°F" ? ((value - 273.15) * 9) / 5 + 32 : value;

/** A conversion Spotlight shows. */
export interface Conversion {
  value: number;
  result: number;
  /** `5 kilometers = 3.106855961 miles`. */
  text: string;
  /** Just the converted amount: `3.106855961 miles`. */
  answer: string;
}

const amount = (value: number, unit: Unit) => {
  const shown = formatNumber(value);
  return `${shown} ${shown === "1" || shown === "-1" ? unit.name : unit.plural}`;
};

/** The conversion `text` asks for (`<number> <unit> to|in|as <unit>`), or `undefined`. */
export function convert(text: string): Conversion | undefined {
  // The amount, then the two units: a unit starts with a non-digit and may hold digits (m2, ft2).
  const match =
    /^\s*(-?[\d,]*\.?\d+)\s*([^\d\s].*?)\s+(?:to|in|as|into|=)\s+([^\d\s].*?)\s*$/i.exec(text);
  if (!match) return undefined;
  const value = Number((match[1] ?? "").replaceAll(",", ""));
  const from = UNITS.get((match[2] ?? "").trim().toLowerCase());
  const to = UNITS.get((match[3] ?? "").trim().toLowerCase());
  if (!Number.isFinite(value) || !from || !to || from.dimension !== to.dimension || from === to) {
    return undefined;
  }
  const result =
    from.dimension === "temperature"
      ? fromKelvin(toKelvin(value, from.name), to.name)
      : (value * from.factor) / to.factor;
  return {
    value,
    result,
    text: `${amount(value, from)} = ${amount(result, to)}`,
    answer: amount(result, to),
  };
}
