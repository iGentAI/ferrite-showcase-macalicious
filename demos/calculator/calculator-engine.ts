/**
 * The arithmetic of the Calculator demo: a pure state machine, with no React in it, so the
 * tests can drive it directly. `reduce` takes the state and one key press and returns the new
 * state; `displayText` is what the display shows.
 *
 * It follows Calculator's basic mode: multiplication and division bind tighter than addition
 * and subtraction, `=` repeats the last operation when pressed again, `%` takes a percentage of
 * the first number in a sum (`200 + 10 %` is 20) and a hundredth otherwise, and the clear key
 * clears the entry first (`C`) and everything on the second press (`AC`).
 *
 * The Scientific layout adds operators that bind tighter still (`power` and the rest),
 * parentheses, and `EE` for a typed exponent; its one-number functions are `calculator-science`'s
 * and come here as a `value`.
 */

export type BasicOperator = "add" | "subtract" | "multiply" | "divide";
/** `x^y`, `y^x` (the second number raised to the first), `y`th root of `x`, log of `x` to base `y`. */
export type ScienceOperator = "power" | "powerOf" | "root" | "logBase";
export type CalculatorOperator = BasicOperator | ScienceOperator;

export type CalculatorAction =
  | { type: "digit"; digit: string }
  | { type: "decimal" }
  | { type: "operator"; operator: CalculatorOperator }
  | { type: "equals" }
  | { type: "percent" }
  | { type: "negate" }
  | { type: "open" }
  | { type: "close" }
  | { type: "exponent" }
  /**
   * A number from elsewhere takes the display's place, as if it had been calculated: a paste.
   * `ofDisplay` says it was made from the number shown, a function's result, which RPN Mode puts in
   * X rather than pushing X up.
   */
  | { type: "value"; value: number; fresh?: boolean; ofDisplay?: boolean }
  | { type: "clear" }
  | { type: "delete" };

export interface CalculatorState {
  /** The number being typed, as typed ("-12.", "0.50"); null when a result is shown. */
  entry: string | null;
  /** The number shown when nothing is being typed. */
  value: number;
  /** Operations waiting for their second number, the innermost last; `open` is a parenthesis. */
  pending: { value: number; operator: CalculatorOperator | "open" }[];
  /** The operator key that was pressed last, until a number follows. */
  armed: CalculatorOperator | null;
  /** What `=` repeats when pressed again. */
  repeat: { operator: CalculatorOperator; operand: number } | null;
  /** Whether the clear key reads `C` (there is an entry to clear) rather than `AC`. */
  clearable: boolean;
}

export const initialCalculatorState: CalculatorState = {
  entry: null,
  value: 0,
  pending: [],
  armed: null,
  repeat: null,
  clearable: false,
};

/** Most digits a typed number can have. */
const MAX_DIGITS = 15;

const precedence = (operator: CalculatorOperator | "open") => {
  if (operator === "open") return 0;
  if (operator === "add" || operator === "subtract") return 1;
  return operator === "multiply" || operator === "divide" ? 2 : 3;
};

function root(radicand: number, degree: number): number {
  if (degree === 0) return Number.NaN;
  // An odd root of a negative number is a real number, which `**` does not find.
  return radicand < 0 && Math.abs(degree % 2) === 1
    ? -((-radicand) ** (1 / degree))
    : radicand ** (1 / degree);
}

export function applyOperator(
  left: number,
  operator: CalculatorOperator | "open",
  right: number,
): number {
  switch (operator) {
    case "open":
      return right;
    case "add":
      return left + right;
    case "subtract":
      return left - right;
    case "multiply":
      return left * right;
    case "divide":
      return right === 0 ? Number.NaN : left / right;
    case "power":
      return left ** right;
    case "powerOf":
      return right ** left;
    case "root":
      return root(left, right);
    case "logBase":
      return left > 0 && right > 0 && right !== 1 ? Math.log(left) / Math.log(right) : Number.NaN;
  }
}

/** The number the display stands for. An exponent still being typed ("2e", "2e-") counts as none. */
export function currentValue(state: CalculatorState): number {
  return state.entry === null ? state.value : Number(state.entry.replace(/e-?$/, ""));
}

/** A result: shown, with nothing being typed. A result that is not a number ends the sum. */
function result(state: CalculatorState, value: number): CalculatorState {
  if (!Number.isFinite(value)) {
    return { ...initialCalculatorState, value: Number.NaN, clearable: true };
  }
  return { ...state, entry: null, value, clearable: true };
}

function pressOperator(state: CalculatorState, operator: CalculatorOperator): CalculatorState {
  const pending = [...state.pending];
  let value = currentValue(state);
  // A second operator in a row replaces the first: take the first back.
  if (state.armed !== null && state.entry === null && pending.length > 0) {
    value = (pending.pop() as (typeof pending)[number]).value;
  }
  for (let top = pending.at(-1); top && precedence(top.operator) >= precedence(operator); ) {
    value = applyOperator(top.value, top.operator, value);
    pending.pop();
    top = pending.at(-1);
  }
  if (!Number.isFinite(value)) return result(state, value);
  pending.push({ value, operator });
  return { ...state, entry: null, value, pending, armed: operator, repeat: null, clearable: true };
}

function pressEquals(state: CalculatorState): CalculatorState {
  const operand = currentValue(state);
  if (state.pending.length > 0) {
    let value = operand;
    let last: CalculatorOperator | null = null;
    for (let i = state.pending.length - 1; i >= 0; i--) {
      const { value: left, operator } = state.pending[i] as (typeof state.pending)[number];
      if (operator === "open") continue;
      value = applyOperator(left, operator, value);
      last ??= operator;
    }
    const repeat = last && { operator: last, operand };
    return result({ ...state, pending: [], armed: null, repeat }, value);
  }
  if (state.repeat) {
    return result(state, applyOperator(operand, state.repeat.operator, state.repeat.operand));
  }
  return result(state, operand);
}

/** The closing parenthesis: the sum inside it becomes one number. One with no opening does nothing. */
function pressClose(state: CalculatorState): CalculatorState {
  if (!state.pending.some(({ operator }) => operator === "open")) return state;
  const pending = [...state.pending];
  let value = currentValue(state);
  for (let top = pending.pop(); top && top.operator !== "open"; top = pending.pop()) {
    value = applyOperator(top.value, top.operator, value);
  }
  return result({ ...state, pending, armed: null }, value);
}

export function reduce(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case "digit": {
      if (!/^[0-9]$/.test(action.digit)) return state;
      const entry = state.entry;
      let next: string;
      if (entry === null || entry === "0") next = action.digit;
      else if (entry === "-0") next = `-${action.digit}`;
      else if (entry.replace(/[^0-9]/g, "").length >= MAX_DIGITS) next = entry;
      else next = entry + action.digit;
      return { ...state, entry: next, armed: null, clearable: true };
    }
    case "decimal": {
      const entry = state.entry ?? "0";
      if (entry.includes("e")) return state;
      return {
        ...state,
        entry: entry.includes(".") ? entry : `${entry}.`,
        armed: null,
        clearable: true,
      };
    }
    case "operator":
      return pressOperator(state, action.operator);
    case "equals":
      return pressEquals(state);
    case "open":
      return {
        ...state,
        entry: null,
        pending: [...state.pending, { value: 0, operator: "open" }],
        armed: null,
        clearable: true,
      };
    case "close":
      return pressClose(state);
    case "exponent": {
      const entry = state.entry ?? formatNumber(state.value);
      if (entry.includes("e") || !Number.isFinite(currentValue(state))) return state;
      return { ...state, entry: `${entry}e`, armed: null, clearable: true };
    }
    case "percent": {
      const value = currentValue(state);
      const sum = state.pending.at(-1);
      const base = sum && precedence(sum.operator) === 1 ? sum.value : 1;
      return result({ ...state, armed: null }, (base * value) / 100);
    }
    case "negate": {
      if (state.entry !== null) {
        // While the exponent is being typed, the sign is the exponent's.
        if (state.entry.includes("e")) {
          const entry = state.entry.includes("e-")
            ? state.entry.replace("e-", "e")
            : state.entry.replace("e", "e-");
          return { ...state, entry };
        }
        const entry = state.entry.startsWith("-") ? state.entry.slice(1) : `-${state.entry}`;
        return { ...state, entry };
      }
      if (Number.isNaN(state.value)) return state;
      // After an operator, and on a cleared display, the sign is that of the number about to
      // be typed: `8 + negate 3 =` is 5.
      if (state.armed !== null || state.value === 0) {
        return { ...state, entry: "-0", armed: null, clearable: true };
      }
      // Otherwise it is the sign of the result shown.
      return { ...state, value: -state.value };
    }
    case "value":
      // A pasted number stands alone: `=` has nothing to repeat on it.
      return result(
        { ...state, armed: null, repeat: action.fresh ? null : state.repeat },
        action.value,
      );
    case "clear": {
      if (!state.clearable) return initialCalculatorState;
      // C: clear what is shown and keep the sum; its operator waits for a number again.
      const top = state.pending.at(-1)?.operator ?? null;
      const armed = top === "open" ? null : top;
      return { ...state, entry: null, value: 0, armed, clearable: false };
    }
    case "delete": {
      if (state.entry === null) return state;
      const entry = state.entry.slice(0, -1);
      return { ...state, entry: entry === "" || entry === "-" ? "0" : entry };
    }
  }
}

/** A number as the display writes it: up to 15 significant digits, no trailing zeros. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "Not a number";
  if (value === 0) return "0";
  const text = String(Number(value.toPrecision(MAX_DIGITS)));
  // 1e+21 and 1e-7 are written 1e21 and 1e-7.
  return text.replace("e+", "e");
}

/** The text in the display. */
export function displayText(state: CalculatorState): string {
  return state.entry ?? formatNumber(state.value);
}
