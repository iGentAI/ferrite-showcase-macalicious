"use client";

import { CalculatorKeypadKey } from "macalicious/calculator-keypad";
import type { CalculatorAction, CalculatorOperator } from "./calculator-engine";
import { compute, type ScienceFunction } from "./calculator-science";

/** The memory keys; mr reads the memory as a `value`. */
export interface MemoryAction {
  type: "memory";
  change: "clear" | "add" | "subtract";
}

export interface ScientificRowProps {
  /** Which of the five rows, the top one being 0. */
  row: number;
  second: boolean;
  degrees: boolean;
  armed: CalculatorOperator | null;
  /** The number on the display and in the memory, as the keys read them when pressed. */
  value: number;
  memory: number;
  /** RPN Mode needs no parentheses. */
  rpn?: boolean;
  onAction: (action: CalculatorAction | MemoryAction) => void;
  onSecond: () => void;
  onDegrees: () => void;
}

type Key =
  | { label: string; fn: ScienceFunction }
  | { label: string; operator: CalculatorOperator }
  | { label: string; action: CalculatorAction | MemoryAction };

const fn = (label: string, name: ScienceFunction): Key => ({ label, fn: name });
const operator = (label: string, name: CalculatorOperator): Key => ({ label, operator: name });
const action = (label: string, what: CalculatorAction | MemoryAction): Key => ({
  label,
  action: what,
});

/** The keys that change with 2nd, in its off and on faces. */
const row1 = (second: boolean): Key[] => [
  fn("x²", "square"),
  fn("x³", "cube"),
  operator("xʸ", "power"),
  second ? operator("yˣ", "powerOf") : fn("eˣ", "exp"),
  second ? fn("2ˣ", "pow2") : fn("10ˣ", "pow10"),
];
const row2 = (second: boolean): Key[] => [
  fn("1/x", "inverse"),
  fn("√x", "sqrt"),
  fn("∛x", "cbrt"),
  operator("ʸ√x", "root"),
  second ? operator("logy", "logBase") : fn("ln", "ln"),
  second ? fn("log2", "log2") : fn("log10", "log10"),
];
const row3 = (second: boolean): Key[] => [
  fn("x!", "factorial"),
  second ? fn("sin⁻¹", "asin") : fn("sin", "sin"),
  second ? fn("cos⁻¹", "acos") : fn("cos", "cos"),
  second ? fn("tan⁻¹", "atan") : fn("tan", "tan"),
  action("e", { type: "value", value: Math.E }),
  action("EE", { type: "exponent" }),
];
const row4 = (second: boolean): Key[] => [
  second ? fn("sinh⁻¹", "asinh") : fn("sinh", "sinh"),
  second ? fn("cosh⁻¹", "acosh") : fn("cosh", "cosh"),
  second ? fn("tanh⁻¹", "atanh") : fn("tanh", "tanh"),
  action("π", { type: "value", value: Math.PI }),
];

/**
 * The Scientific layout's letter keys, from memory of the real app and provisional: `c` stays the
 * clear key of every layout, and these are the rest of its functions a person reaches for most.
 */
export function scientificActionForKey(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
  value: number,
  degrees: boolean,
): CalculatorAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const functions: Record<string, ScienceFunction> = {
    s: "sin",
    o: "cos",
    t: "tan",
    l: "ln",
    g: "log10",
    r: "sqrt",
    "!": "factorial",
  };
  const name = functions[event.key];
  if (name) return { type: "value", value: compute(name, value, degrees), ofDisplay: true };
  switch (event.key) {
    case "(":
      return { type: "open" };
    case ")":
      return { type: "close" };
    case "^":
      return { type: "operator", operator: "power" };
    case "e":
      return { type: "value", value: Math.E };
    case "p":
      return { type: "value", value: Math.PI };
    case "E":
      return { type: "exponent" };
    default:
      return null;
  }
}

/** The six keys the Scientific layout puts before one row of the basic keys. */
export function ScientificRow({
  row,
  second,
  degrees,
  armed,
  value,
  memory,
  rpn,
  onAction,
  onSecond,
  onDegrees,
}: ScientificRowProps) {
  const one = (key: Key) => (
    <CalculatorKeypadKey
      key={key.label}
      variant="function"
      className="mac-calculator-science-key"
      armed={"operator" in key ? armed === key.operator : undefined}
      disabled={rpn && "action" in key && (key.label === "(" || key.label === ")")}
      onClick={() => {
        if ("fn" in key) {
          onAction({ type: "value", value: compute(key.fn, value, degrees), ofDisplay: true });
        } else if ("operator" in key) onAction({ type: "operator", operator: key.operator });
        else onAction(key.action);
      }}
    >
      {key.label}
    </CalculatorKeypadKey>
  );
  const plain = (label: string, press: () => void, on?: boolean) => (
    <CalculatorKeypadKey
      key={label}
      variant="function"
      className="mac-calculator-science-key"
      armed={on}
      onClick={press}
    >
      {label}
    </CalculatorKeypadKey>
  );
  switch (row) {
    case 0:
      return (
        <>
          {one(action("(", { type: "open" }))}
          {one(action(")", { type: "close" }))}
          {one(action("mc", { type: "memory", change: "clear" }))}
          {one(action("m+", { type: "memory", change: "add" }))}
          {one(action("m-", { type: "memory", change: "subtract" }))}
          {one(action("mr", { type: "value", value: memory }))}
        </>
      );
    case 1:
      return (
        <>
          {plain("2nd", onSecond, second)}
          {row1(second).map(one)}
        </>
      );
    case 2:
      return <>{row2(second).map(one)}</>;
    case 3:
      return <>{row3(second).map(one)}</>;
    default:
      return (
        <>
          {plain(degrees ? "Rad" : "Deg", onDegrees)}
          {row4(second).map(one)}
          {plain("Rand", () => onAction({ type: "value", value: Math.random() }))}
        </>
      );
  }
}
