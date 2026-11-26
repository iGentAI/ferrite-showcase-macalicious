import type { FinishedCalculation } from "./calculator-tape";

/**
 * The Programmer layout's arithmetic: 64 unsigned bits in a BigInt, so no bit is lost as it would be
 * in a floating-point number. A pure state machine, as `calculator-engine` is. Operations run left
 * to right, without the basic layout's precedence, and a result wraps at 64 bits.
 */

export type ProgrammerBase = 8 | 10 | 16;
export type ProgrammerOperator =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "and"
  | "or"
  | "nor"
  | "xor"
  | "shiftLeftBy"
  | "shiftRightBy";
export type ProgrammerUnary =
  | "shiftLeft"
  | "shiftRight"
  | "rotateLeft"
  | "rotateRight"
  | "byteFlip"
  | "wordFlip"
  | "twos"
  | "ones";

export type ProgrammerAction =
  | { type: "digits"; digits: string }
  | { type: "operator"; operator: ProgrammerOperator }
  | { type: "unary"; unary: ProgrammerUnary }
  | { type: "equals" }
  | { type: "clear" }
  | { type: "allClear" }
  | { type: "delete" }
  | { type: "base"; base: ProgrammerBase }
  | { type: "toggleBit"; bit: number }
  | { type: "value"; value: bigint };

export interface ProgrammerState {
  base: ProgrammerBase;
  value: bigint;
  /** The display is a number being typed, which the next digit goes on. */
  typing: boolean;
  pending: { value: bigint; operator: ProgrammerOperator } | null;
  /** The operator pressed last, until a number follows. */
  armed: ProgrammerOperator | null;
  repeat: { operator: ProgrammerOperator; operand: bigint } | null;
  /** The last result was no number: a division by zero. */
  failed: boolean;
}

export const initialProgrammerState: ProgrammerState = {
  base: 10,
  value: 0n,
  typing: false,
  pending: null,
  armed: null,
  repeat: null,
  failed: false,
};

const BITS = 64n;
const MAX = (1n << BITS) - 1n;
const wrap = (value: bigint) => BigInt.asUintN(64, value);

/** A number of the other layouts: its whole part, wrapped to 64 bits; 0 when it is no number. */
export const fromNumber = (value: number): bigint =>
  Number.isFinite(value) ? wrap(BigInt(Math.trunc(value))) : 0n;

export function applyBits(
  left: bigint,
  operator: ProgrammerOperator,
  right: bigint,
): bigint | null {
  switch (operator) {
    case "add":
      return wrap(left + right);
    case "subtract":
      return wrap(left - right);
    case "multiply":
      return wrap(left * right);
    case "divide":
      return right === 0n ? null : left / right;
    case "and":
      return left & right;
    case "or":
      return left | right;
    case "nor":
      return wrap(~(left | right));
    case "xor":
      return left ^ right;
    case "shiftLeftBy":
      return right >= BITS ? 0n : wrap(left << right);
    case "shiftRightBy":
      return right >= BITS ? 0n : left >> right;
  }
}

/** The `size`-bit groups of a value, in the reverse order. */
function flip(value: bigint, size: bigint): bigint {
  let out = 0n;
  const mask = (1n << size) - 1n;
  for (let at = 0n; at < BITS; at += size) {
    out = (out << size) | ((value >> at) & mask);
  }
  return out;
}

function applyUnary(value: bigint, unary: ProgrammerUnary): bigint {
  switch (unary) {
    case "shiftLeft":
      return wrap(value << 1n);
    case "shiftRight":
      return value >> 1n;
    case "rotateLeft":
      return wrap(value << 1n) | (value >> 63n);
    case "rotateRight":
      return (value >> 1n) | wrap(value << 63n);
    case "byteFlip":
      return flip(value, 8n);
    case "wordFlip":
      return flip(value, 16n);
    case "twos":
      return wrap(-value);
    case "ones":
      return wrap(~value);
  }
}

/** The result of a finished operation, or the failed state of one that has none. */
function settled(
  state: ProgrammerState,
  value: bigint | null,
  repeat: ProgrammerState["repeat"],
): ProgrammerState {
  if (value === null) return { ...initialProgrammerState, base: state.base, failed: true };
  return { ...state, value, typing: false, pending: null, armed: null, repeat };
}

export function reduceProgrammer(
  state: ProgrammerState,
  action: ProgrammerAction,
): ProgrammerState {
  switch (action.type) {
    case "digits": {
      let value = state.typing ? state.value : 0n;
      const radix = BigInt(state.base);
      for (const digit of action.digits) {
        const number = Number.parseInt(digit, 16);
        if (!(number < state.base)) return state;
        const next = value * radix + BigInt(number);
        // A number that does not fit in 64 bits stays as it was.
        if (next > MAX) return state;
        value = next;
      }
      return {
        ...state,
        value,
        typing: true,
        armed: null,
        failed: false,
        // A new number after a finished sum: equals has nothing to repeat on it.
        repeat: state.typing ? state.repeat : null,
      };
    }
    case "operator": {
      if (state.failed) return state;
      if (state.pending && state.armed) {
        return {
          ...state,
          pending: { value: state.pending.value, operator: action.operator },
          armed: action.operator,
        };
      }
      const left = state.pending
        ? applyBits(state.pending.value, state.pending.operator, state.value)
        : state.value;
      if (left === null) return settled(state, null, null);
      return {
        ...state,
        value: left,
        typing: false,
        pending: { value: left, operator: action.operator },
        armed: action.operator,
        repeat: null,
      };
    }
    case "unary":
      if (state.failed) return state;
      return { ...state, value: applyUnary(state.value, action.unary), typing: false, armed: null };
    case "equals": {
      if (state.failed) return state;
      if (state.pending) {
        const { value: left, operator } = state.pending;
        return settled(state, applyBits(left, operator, state.value), {
          operator,
          operand: state.value,
        });
      }
      if (state.repeat) {
        const { operator, operand } = state.repeat;
        return settled(state, applyBits(state.value, operator, operand), state.repeat);
      }
      return state.typing ? { ...state, typing: false } : state;
    }
    case "clear":
      return {
        ...state,
        value: 0n,
        typing: false,
        failed: false,
        armed: state.pending?.operator ?? null,
      };
    case "allClear":
      return { ...initialProgrammerState, base: state.base };
    case "delete":
      return state.typing ? { ...state, value: state.value / BigInt(state.base) } : state;
    case "base":
      return { ...state, base: action.base, typing: false };
    case "toggleBit":
      if (state.failed) return state;
      return {
        ...state,
        value: state.value ^ (1n << BigInt(action.bit)),
        typing: false,
        armed: null,
      };
    case "value":
      return {
        ...state,
        value: wrap(action.value),
        typing: false,
        armed: null,
        failed: false,
        repeat: null,
      };
  }
}

export function formatProgrammer({ value, base, failed }: ProgrammerState): string {
  if (failed) return "Not a number";
  return base === 16 ? `0x${value.toString(16).toUpperCase()}` : value.toString(base);
}

/** The number in pasted text, written in `base` or with a 0x; `null` when there is none in 64 bits. */
export function parseProgrammer(text: string, base: ProgrammerBase): bigint | null {
  const trimmed = text.trim().replace(/[\s,]/g, "");
  const digits: Record<ProgrammerBase, RegExp> = {
    8: /^[0-7]+$/,
    10: /^-?\d+$/,
    16: /^[0-9a-f]+$/i,
  };
  let value: bigint;
  if (/^0x[0-9a-f]+$/i.test(trimmed)) value = BigInt(trimmed);
  else if (!digits[base].test(trimmed)) return null;
  else if (base === 8) value = BigInt(`0o${trimmed}`);
  else if (base === 16) value = BigInt(`0x${trimmed}`);
  else value = BigInt(trimmed);
  return value > MAX || value < -(MAX + 1n) / 2n ? null : wrap(value);
}

export type CharacterMode = "ascii" | "unicode";

/** The character the value stands for, or "" for a control character or none in that set. */
export function characterOf(value: bigint, mode: CharacterMode): string {
  if (value < 32n || value === 127n) return "";
  const limit = mode === "ascii" ? 127n : 0x10ffffn;
  if (value > limit || (value >= 0xd800n && value <= 0xdfffn)) return "";
  return String.fromCodePoint(Number(value));
}

const SYMBOLS: Record<ProgrammerOperator, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  and: "AND",
  or: "OR",
  nor: "NOR",
  xor: "XOR",
  shiftLeftBy: "<<",
  shiftRightBy: ">>",
};

/** One line of the tape: the numbers in the base `before` shows, and the result `after` shows. */
export function programmerLine(
  before: ProgrammerState,
  left: bigint,
  operator: ProgrammerOperator,
  right: bigint,
  after: ProgrammerState,
): FinishedCalculation {
  const number = (value: bigint) => formatProgrammer({ ...before, value, failed: false });
  return {
    expression: `${number(left)} ${SYMBOLS[operator]} ${number(right)}`,
    result: formatProgrammer(after),
  };
}

/** What the tape records of an `=`, which took `before` to `after`; nothing when it calculated none. */
export function programmerFinished(
  before: ProgrammerState,
  after: ProgrammerState,
): FinishedCalculation | undefined {
  if (before.failed) return undefined;
  if (before.pending) {
    const { value, operator } = before.pending;
    return programmerLine(before, value, operator, before.value, after);
  }
  return before.repeat
    ? programmerLine(before, before.value, before.repeat.operator, before.repeat.operand, after)
    : undefined;
}

/** The key equivalents of the Programmer layout: the digits of the base, A to F in base 16. */
export function programmerActionForKey(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
  base: ProgrammerBase,
): ProgrammerAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const { key } = event;
  if (/^[0-9a-fA-F]$/.test(key) && Number.parseInt(key, 16) < base) {
    return { type: "digits", digits: key };
  }
  switch (key) {
    case "+":
      return { type: "operator", operator: "add" };
    case "-":
      return { type: "operator", operator: "subtract" };
    case "*":
      return { type: "operator", operator: "multiply" };
    case "/":
      return { type: "operator", operator: "divide" };
    case "&":
      return { type: "operator", operator: "and" };
    case "|":
      return { type: "operator", operator: "or" };
    case "^":
      return { type: "operator", operator: "xor" };
    case "=":
    case "Enter":
      return { type: "equals" };
    case "Escape":
    case "c":
    case "C":
      return { type: "clear" };
    case "Backspace":
    case "Delete":
      return { type: "delete" };
    default:
      return null;
  }
}
