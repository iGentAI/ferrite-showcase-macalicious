import {
  applyBits,
  initialProgrammerState,
  type ProgrammerAction,
  type ProgrammerState,
  programmerLine,
  reduceProgrammer,
} from "./calculator-bits";
import {
  applyOperator,
  type CalculatorAction,
  type CalculatorState,
  currentValue,
  formatNumber,
  initialCalculatorState,
  reduce,
} from "./calculator-engine";
import { type FinishedCalculation, OPERATOR_SYMBOLS } from "./calculator-tape";

/**
 * RPN Mode: a stack of four registers, of which X is the number on the display and the other three
 * are kept here. Enter pushes X; an operator takes Y and X and leaves its result in X, the top
 * register copying down as the stack falls. The four levels are the classic design and provisional:
 * no capture shows the real window in this mode.
 */

export type StackAction =
  | { type: "swap" }
  | { type: "rollDown" }
  | { type: "rollUp" }
  | { type: "drop" };

/** The registers above X: Y, Z and T. */
export type Stack<T> = readonly [T, T, T];

export const EMPTY_STACK: Stack<number> = [0, 0, 0];
export const EMPTY_BITS: Stack<bigint> = [0n, 0n, 0n];

const lifted = <T>([y, z]: Stack<T>, x: T): Stack<T> => [x, y, z];
const dropped = <T>([, z, t]: Stack<T>): Stack<T> => [z, t, t];

function moved<T>(x: T, stack: Stack<T>, type: StackAction["type"]): { x: T; stack: Stack<T> } {
  const [y, z, t] = stack;
  switch (type) {
    case "swap":
      return { x: y, stack: [x, z, t] };
    case "rollDown":
      return { x: y, stack: [z, t, x] };
    case "rollUp":
      return { x: t, stack: [x, y, z] };
    case "drop":
      return { x: y, stack: dropped(stack) };
  }
}

const isStackAction = (action: { type: string }): action is StackAction =>
  action.type === "swap" ||
  action.type === "rollDown" ||
  action.type === "rollUp" ||
  action.type === "drop";

export interface RpnState {
  /** X: what the display shows and what is being typed. It never holds a sum in progress. */
  calculator: CalculatorState;
  stack: Stack<number>;
  /** The next number pushes X up. After Enter or C it takes X's place instead. */
  lift: boolean;
}

const finishedX = (value: number): CalculatorState => ({
  ...initialCalculatorState,
  value,
  clearable: true,
});

/** One key in RPN Mode: `equals` is Enter, and parentheses have no use and do nothing. */
export function reduceRpn(
  state: RpnState,
  action: CalculatorAction | StackAction,
): RpnState & { finished?: FinishedCalculation } {
  const { calculator, stack, lift } = state;
  const x = currentValue(calculator);
  const pushed = lift && !Number.isNaN(x) ? lifted(stack, x) : stack;
  if (isStackAction(action)) {
    const next = moved(x, stack, action.type);
    return { calculator: finishedX(next.x), stack: next.stack, lift: true };
  }
  switch (action.type) {
    case "digit":
    case "decimal":
      return calculator.entry === null
        ? { calculator: reduce(calculator, action), stack: pushed, lift: true }
        : { ...state, calculator: reduce(calculator, action) };
    case "equals":
      if (Number.isNaN(x)) return state;
      return { calculator: finishedX(x), stack: lifted(stack, x), lift: false };
    case "operator": {
      if (Number.isNaN(x)) return state;
      const value = applyOperator(stack[0], action.operator, x);
      const shown = Number.isFinite(value) ? value : Number.NaN;
      return {
        calculator: finishedX(shown),
        stack: dropped(stack),
        lift: true,
        finished: {
          expression: `${formatNumber(stack[0])} ${OPERATOR_SYMBOLS[action.operator]} ${formatNumber(x)}`,
          result: formatNumber(shown),
        },
      };
    }
    case "percent":
      if (Number.isNaN(x)) return state;
      return { calculator: finishedX((stack[0] * x) / 100), stack, lift: true };
    case "value":
      return {
        calculator: reduce(calculator, action),
        stack: action.ofDisplay ? stack : pushed,
        lift: true,
      };
    case "clear":
      return calculator.clearable
        ? { calculator: reduce(calculator, action), stack, lift: false }
        : { calculator: initialCalculatorState, stack: EMPTY_STACK, lift: true };
    case "negate":
    case "exponent":
    case "delete":
      return { ...state, calculator: reduce(calculator, action) };
    case "open":
    case "close":
      return state;
  }
}

export interface BitsRpnState {
  programmer: ProgrammerState;
  stack: Stack<bigint>;
  lift: boolean;
}

/** The same stack for the Programmer layout's 64 bits. */
export function reduceBitsRpn(
  state: BitsRpnState,
  action: ProgrammerAction | StackAction,
): BitsRpnState & { finished?: FinishedCalculation } {
  const { programmer, stack, lift } = state;
  const x = programmer.value;
  const pushed = lift && !programmer.failed ? lifted(stack, x) : stack;
  if (isStackAction(action)) {
    const next = moved(x, stack, action.type);
    return {
      programmer: { ...programmer, value: next.x, typing: false, failed: false },
      stack: next.stack,
      lift: true,
    };
  }
  switch (action.type) {
    case "digits": {
      const next = reduceProgrammer(programmer, action);
      if (next === programmer) return state;
      return programmer.typing
        ? { ...state, programmer: next }
        : { programmer: next, stack: pushed, lift: true };
    }
    case "equals":
      if (programmer.failed) return state;
      return {
        programmer: { ...programmer, typing: false },
        stack: lifted(stack, x),
        lift: false,
      };
    case "operator": {
      if (programmer.failed) return state;
      const value = applyBits(stack[0], action.operator, x);
      const after: ProgrammerState =
        value === null
          ? { ...initialProgrammerState, base: programmer.base, failed: true }
          : { ...programmer, value, typing: false };
      return {
        programmer: after,
        stack: dropped(stack),
        lift: true,
        finished: programmerLine(programmer, stack[0], action.operator, x, after),
      };
    }
    case "value":
      return { programmer: reduceProgrammer(programmer, action), stack: pushed, lift: true };
    case "clear":
      return { programmer: reduceProgrammer(programmer, action), stack, lift: false };
    case "allClear":
      return { programmer: reduceProgrammer(programmer, action), stack: EMPTY_BITS, lift: true };
    case "unary":
    case "toggleBit":
      return { programmer: reduceProgrammer(programmer, action), stack, lift: true };
    case "delete":
    case "base":
      return { ...state, programmer: reduceProgrammer(programmer, action) };
  }
}
