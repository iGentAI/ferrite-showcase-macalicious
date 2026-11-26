/**
 * Calculator's one-number functions, in the Scientific layout. Each takes the number on the display
 * and returns the result; a result that is no number shows "Not a number", as the engine does.
 */

export type ScienceFunction =
  | "square"
  | "cube"
  | "exp"
  | "pow10"
  | "pow2"
  | "inverse"
  | "sqrt"
  | "cbrt"
  | "ln"
  | "log10"
  | "log2"
  | "factorial"
  | "sin"
  | "cos"
  | "tan"
  | "asin"
  | "acos"
  | "atan"
  | "sinh"
  | "cosh"
  | "tanh"
  | "asinh"
  | "acosh"
  | "atanh";

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** The gamma function, by Lanczos's approximation. */
function gamma(x: number): number {
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  const shifted = x - 1;
  const t = shifted + 7.5;
  let sum = LANCZOS[0] as number;
  for (let i = 1; i < LANCZOS.length; i++) sum += (LANCZOS[i] as number) / (shifted + i);
  const direct = Math.sqrt(2 * Math.PI) * t ** (shifted + 0.5) * Math.exp(-t) * sum;
  if (Number.isFinite(direct)) return direct;
  // t ** … alone can pass the largest number when the result does not.
  return Math.exp(0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum));
}

/** `x!`: exact for a whole number, and the gamma function of `x + 1` otherwise. */
export function factorial(x: number): number {
  if (!Number.isInteger(x)) return gamma(x + 1);
  if (x < 0) return Number.NaN;
  let product = 1;
  for (let i = 2; i <= x && Number.isFinite(product); i++) product *= i;
  return product;
}

/**
 * How many quarter turns `radians` is, when it is a nonzero multiple of π/2 as far as a number can
 * say (sin(π) is 0, not 1.2e-16); otherwise `null`, so that sin(1e-20) stays 1e-20.
 */
function quarterTurns(radians: number): number | null {
  const turns = Math.round(radians / (Math.PI / 2));
  const distance = Math.abs(radians - (turns * Math.PI) / 2);
  return turns !== 0 && distance <= Math.abs(radians) * 4 * Number.EPSILON ? turns : null;
}

function trig(name: "sin" | "cos" | "tan", x: number, degrees: boolean): number {
  const radians = degrees ? (x * Math.PI) / 180 : x;
  const turns = quarterTurns(radians);
  const odd = turns !== null && turns % 2 !== 0;
  const even = turns !== null && turns % 2 === 0;
  const cosine = odd || (degrees && (x - 90) % 180 === 0) ? 0 : Math.cos(radians);
  const sine = even || (degrees && x % 180 === 0) ? 0 : Math.sin(radians);
  if (name === "sin") return sine;
  if (name === "cos") return cosine;
  if (cosine === 0) return Number.NaN;
  return sine === 0 ? 0 : Math.tan(radians);
}

/** The function of `x`; `degrees` says how the six trigonometric ones read and write an angle. */
export function compute(name: ScienceFunction, x: number, degrees: boolean): number {
  const angle = (radians: number) => (degrees ? (radians * 180) / Math.PI : radians);
  switch (name) {
    case "square":
      return x * x;
    case "cube":
      return x * x * x;
    case "exp":
      return Math.exp(x);
    case "pow10":
      return 10 ** x;
    case "pow2":
      return 2 ** x;
    case "inverse":
      return x === 0 ? Number.NaN : 1 / x;
    case "sqrt":
      return Math.sqrt(x);
    case "cbrt":
      return Math.cbrt(x);
    case "ln":
      return Math.log(x);
    case "log10":
      return Math.log10(x);
    case "log2":
      return Math.log2(x);
    case "factorial":
      return factorial(x);
    case "sin":
    case "cos":
    case "tan":
      return trig(name, x, degrees);
    case "asin":
      return angle(Math.asin(x));
    case "acos":
      return angle(Math.acos(x));
    case "atan":
      return angle(Math.atan(x));
    case "sinh":
      return Math.sinh(x);
    case "cosh":
      return Math.cosh(x);
    case "tanh":
      return Math.tanh(x);
    case "asinh":
      return Math.asinh(x);
    case "acosh":
      return Math.acosh(x);
    case "atanh":
      return Math.atanh(x);
  }
}
