import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Calculator } from "./calculator";
import { initialProgrammerState } from "./calculator-bits";
import { type CalculatorAction, displayText, initialCalculatorState } from "./calculator-engine";
import {
  EMPTY_BITS,
  EMPTY_STACK,
  type RpnState,
  reduceBitsRpn,
  reduceRpn,
  type StackAction,
} from "./calculator-rpn";

const start: RpnState = { calculator: initialCalculatorState, stack: EMPTY_STACK, lift: true };
const KEYS: Record<string, CalculatorAction | StackAction> = {
  ".": { type: "decimal" },
  "+": { type: "operator", operator: "add" },
  "-": { type: "operator", operator: "subtract" },
  "*": { type: "operator", operator: "multiply" },
  "/": { type: "operator", operator: "divide" },
  "=": { type: "equals" },
  s: { type: "swap" },
  d: { type: "rollDown" },
  u: { type: "rollUp" },
  x: { type: "drop" },
  c: { type: "clear" },
  "%": { type: "percent" },
};
const keys = (typed: string, from: RpnState = start) =>
  [...typed].reduce<RpnState>(
    (state, key) => reduceRpn(state, KEYS[key] ?? { type: "digit", digit: key }),
    from,
  );
const registers = (state: RpnState) => [displayText(state.calculator), ...state.stack];

describe("reduceRpn", () => {
  it.each([
    ["12=3+", "15"],
    ["12=3-", "9"],
    ["6=7*", "42"],
    ["9=4/", "2.25"],
    ["3=4=5*+", "23"],
    ["1=0/", "Not a number"],
  ])("computes %s as %s", (typed, shown) => {
    expect(displayText(keys(typed).calculator)).toBe(shown);
  });

  it("pushes on Enter, and the next number takes X's place", () => {
    expect(registers(keys("1="))).toEqual(["1", 1, 0, 0]);
    expect(registers(keys("1=2"))).toEqual(["2", 1, 0, 0]);
    expect(registers(keys("1=2=3"))).toEqual(["3", 2, 1, 0]);
  });

  it("pushes the result of an operation up when a number follows it", () => {
    expect(registers(keys("1=2+5"))).toEqual(["5", 3, 0, 0]);
  });

  it("copies T down as the stack falls, and loses what goes off the top", () => {
    expect(registers(keys("1=2=3=4+"))).toEqual(["7", 2, 1, 1]);
    expect(registers(keys("1=2=3=4=5"))).toEqual(["5", 4, 3, 2]);
  });

  it("swaps, rolls and drops", () => {
    const four = keys("1=2=3=4");
    expect(registers(four)).toEqual(["4", 3, 2, 1]);
    expect(registers(keys("s", four))).toEqual(["3", 4, 2, 1]);
    expect(registers(keys("d", four))).toEqual(["3", 2, 1, 4]);
    expect(registers(keys("u", four))).toEqual(["1", 4, 3, 2]);
    expect(registers(keys("x", four))).toEqual(["3", 2, 1, 1]);
  });

  it("clears X, then everything", () => {
    const typed = keys("7=5");
    expect(registers(keys("c", typed))).toEqual(["0", 7, 0, 0]);
    expect(registers(keys("c9", typed))).toEqual(["9", 7, 0, 0]);
    expect(registers(keys("cc", typed))).toEqual(["0", 0, 0, 0]);
  });

  it("takes a percentage of Y and leaves Y", () => {
    expect(registers(keys("200=10%"))).toEqual(["20", 200, 0, 0]);
  });

  it("pushes a constant, and replaces X with a function of it", () => {
    const nine = keys("9");
    const pi = reduceRpn(nine, { type: "value", value: 3 });
    expect(registers(pi)).toEqual(["3", 9, 0, 0]);
    const root = reduceRpn(nine, { type: "value", value: 3, ofDisplay: true });
    expect(registers(root)).toEqual(["3", 0, 0, 0]);
  });

  it("does not push a failed result", () => {
    expect(registers(keys("1=0/5"))).toEqual(["5", 0, 0, 0]);
  });

  it("writes an operation for the tape", () => {
    expect(reduceRpn(keys("12=3"), { type: "operator", operator: "add" }).finished).toEqual({
      expression: "12 + 3",
      result: "15",
    });
  });

  it("has no use for parentheses", () => {
    const nine = keys("9");
    expect(reduceRpn(nine, { type: "open" })).toBe(nine);
  });
});

describe("reduceBitsRpn", () => {
  const bits = { programmer: initialProgrammerState, stack: EMPTY_BITS, lift: true };

  it("keeps 64 bits through the stack", () => {
    const big = reduceBitsRpn(bits, { type: "value", value: (1n << 64n) - 1n });
    const entered = reduceBitsRpn(big, { type: "equals" });
    const one = reduceBitsRpn(entered, { type: "digits", digits: "1" });
    expect(one.stack).toEqual([(1n << 64n) - 1n, 0n, 0n]);
    const sum = reduceBitsRpn(one, { type: "operator", operator: "add" });
    expect(sum.programmer.value).toBe(0n);
    expect(sum.finished).toEqual({ expression: "18446744073709551615 + 1", result: "0" });
  });

  it("swaps, and shows a division by zero as no number", () => {
    const one = reduceBitsRpn(bits, { type: "digits", digits: "6" });
    const entered = reduceBitsRpn(one, { type: "equals" });
    const zero = reduceBitsRpn(entered, { type: "digits", digits: "0" });
    expect(reduceBitsRpn(zero, { type: "swap" }).programmer.value).toBe(6n);
    expect(reduceBitsRpn(zero, { type: "operator", operator: "divide" }).programmer.failed).toBe(
      true,
    );
  });
});

const display = () => screen.getByRole("status", { name: "Result" });
const frame = () => document.querySelector(".mac-calculator") as HTMLElement;
const rpnOn = () => fireEvent.keyDown(frame(), { key: "r", ctrlKey: true });
const stackLine = () =>
  within(screen.getByRole("group", { name: "Stack" }))
    .getAllByText(/./)
    .map((each) => each.textContent);

describe("RPN Mode in the window", () => {
  it("turns on with Command-R, and the keyboard adds up in postfix", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    expect(screen.queryByRole("group", { name: "Stack" })).toBeNull();
    await user.keyboard("8");
    expect(rpnOn()).toBe(false);
    expect(screen.getByText("RPN")).toBeInTheDocument();
    expect(display()).toHaveTextContent(/^8$/);
    await user.keyboard("{Enter}2");
    expect(stackLine()).toEqual(["T 0", "Z 0", "Y 8"]);
    await user.keyboard("*");
    expect(display()).toHaveTextContent(/^16$/);
    expect(stackLine()).toEqual(["T 0", "Z 0", "Y 0"]);
  });

  it("has an Enter key, and stack keys that act", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    rpnOn();
    expect(screen.queryByRole("button", { name: "Equals" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "Enter" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "Swap X and Y" }));
    expect(display()).toHaveTextContent(/^1$/);
    expect(stackLine()).toEqual(["T 0", "Z 0", "Y 2"]);
    await user.click(screen.getByRole("button", { name: "Roll down" }));
    expect(display()).toHaveTextContent(/^2$/);
    expect(stackLine()).toEqual(["T 1", "Z 0", "Y 0"]);
    await user.click(screen.getByRole("button", { name: "Roll up" }));
    expect(display()).toHaveTextContent(/^1$/);
    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(display()).toHaveTextContent(/^2$/);
  });

  it("undoes a stack operation, and going back keeps the number and drops the stack", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    rpnOn();
    await user.keyboard("3{Enter}4+");
    expect(display()).toHaveTextContent(/^7$/);
    fireEvent.keyDown(frame(), { key: "z", ctrlKey: true });
    expect(display()).toHaveTextContent(/^4$/);
    expect(stackLine()).toEqual(["T 0", "Z 0", "Y 3"]);
    rpnOn();
    expect(screen.queryByText("RPN")).toBeNull();
    expect(display()).toHaveTextContent(/^4$/);
    await user.keyboard("+1=");
    expect(display()).toHaveTextContent(/^5$/);
  });

  it("works in Programmer on 64 bits, and in Scientific a function replaces X", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    rpnOn();
    fireEvent.keyDown(frame(), { key: "3", ctrlKey: true });
    await user.keyboard("6{Enter}3");
    await user.click(screen.getByRole("button", { name: "XOR" }));
    expect(display()).toHaveTextContent(/^5$/);
    await user.click(screen.getByRole("button", { name: "Enter" }));
    expect(stackLine()).toEqual(["T 0", "Z 0", "Y 5"]);

    fireEvent.keyDown(frame(), { key: "2", ctrlKey: true });
    await user.keyboard("9");
    await user.click(screen.getByRole("button", { name: "√x" }));
    expect(display()).toHaveTextContent(/^3$/);
    expect(screen.getByRole("button", { name: "(" })).toBeDisabled();
    act(() => frame().focus());
  });

  it("makes the window taller by its row of keys outside a desktop", () => {
    render(<Calculator />);
    expect(frame().style.height).toBe("321px");
    rpnOn();
    expect(frame().style.height).toBe("352px");
  });
});

describe("letter keys in Scientific", () => {
  it.each([
    ["9r", "3"],
    ["30s", "0.5"],
    ["60o", "0.5"],
    ["45t", "1"],
    ["100g", "2"],
    ["5!", "120"],
    ["e", "2.71828182845905"],
    ["p", "3.14159265358979"],
  ])("%s shows %s", async (typed, shown) => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    fireEvent.keyDown(frame(), { key: "2", ctrlKey: true });
    await user.keyboard(typed);
    expect(display()).toHaveTextContent(shown);
  });

  it("raises to a power with a caret, and writes an exponent with a capital E", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    fireEvent.keyDown(frame(), { key: "2", ctrlKey: true });
    await user.keyboard("2^10=");
    expect(display()).toHaveTextContent(/^1024$/);
    await user.keyboard("{Escape}{Escape}3E2+1=");
    expect(display()).toHaveTextContent(/^301$/);
  });

  it("leaves those letters alone in Basic", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("9r");
    expect(display()).toHaveTextContent(/^9$/);
  });
});
