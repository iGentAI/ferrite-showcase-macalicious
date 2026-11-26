import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calculator } from "./calculator";
import {
  type CalculatorAction,
  type CalculatorOperator,
  displayText,
  formatNumber,
  initialCalculatorState,
  reduce,
} from "./calculator-engine";
import { compute, factorial, type ScienceFunction } from "./calculator-science";
import { tapeStep } from "./calculator-tape";

const shownFn = (name: ScienceFunction, x: number, degrees = true) =>
  formatNumber(compute(name, x, degrees));

describe("the scientific functions against known values", () => {
  it.each<[ScienceFunction, number, string]>([
    ["square", 12, "144"],
    ["cube", -3, "-27"],
    ["exp", 1, "2.71828182845905"],
    ["pow10", 3, "1000"],
    ["pow2", 10, "1024"],
    ["inverse", 4, "0.25"],
    ["inverse", 0, "Not a number"],
    ["sqrt", 2, "1.4142135623731"],
    ["sqrt", -1, "Not a number"],
    ["cbrt", 27, "3"],
    ["cbrt", -8, "-2"],
    ["ln", Math.E, "1"],
    ["ln", 0, "Not a number"],
    ["log10", 1000, "3"],
    ["log2", 8, "3"],
    ["sinh", 1, "1.1752011936438"],
    ["cosh", 1, "1.54308063481524"],
    ["tanh", 1, "0.761594155955765"],
    ["asinh", 1, "0.881373587019543"],
    ["acosh", 1, "0"],
    ["atanh", 0.5, "0.549306144334055"],
  ])("%s of %d is %s", (name, x, text) => {
    expect(shownFn(name, x)).toBe(text);
  });

  it.each<[ScienceFunction, number, string]>([
    ["sin", 30, "0.5"],
    ["sin", 180, "0"],
    ["sin", 90, "1"],
    ["cos", 60, "0.5"],
    ["cos", 90, "0"],
    ["cos", 180, "-1"],
    ["tan", 45, "1"],
    ["tan", 180, "0"],
    ["tan", 90, "Not a number"],
    ["asin", 1, "90"],
    ["acos", 0.5, "60"],
    ["atan", 1, "45"],
  ])("in degrees, %s of %d is %s", (name, x, text) => {
    expect(shownFn(name, x, true)).toBe(text);
  });

  it.each<[ScienceFunction, number, string]>([
    ["sin", Math.PI, "0"],
    ["sin", Math.PI / 2, "1"],
    ["cos", Math.PI / 2, "0"],
    ["tan", Math.PI / 4, "1"],
    ["tan", Math.PI / 2, "Not a number"],
    ["asin", 1, "1.5707963267949"],
    ["acos", -1, "3.14159265358979"],
    ["atan", 1, "0.785398163397448"],
  ])("in radians, %s of %d is %s", (name, x, text) => {
    expect(shownFn(name, x, false)).toBe(text);
  });

  it("takes factorials of whole numbers exactly and of others by gamma", () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(5)).toBe(120);
    expect(factorial(20)).toBe(2432902008176640000);
    expect(factorial(171)).toBe(Number.POSITIVE_INFINITY);
    expect(formatNumber(factorial(-1))).toBe("Not a number");
    expect(factorial(0.5)).toBeCloseTo(0.886226925452758, 13);
    expect(factorial(-0.5)).toBeCloseTo(1.772453850905516, 13);
    expect(factorial(150.5)).toBeGreaterThan(1e262);
    expect(Number.isFinite(factorial(150.5))).toBe(true);
  });
});

const ACTIONS: Record<string, CalculatorAction> = {
  ".": { type: "decimal" },
  "+": { type: "operator", operator: "add" },
  "*": { type: "operator", operator: "multiply" },
  "=": { type: "equals" },
  "(": { type: "open" },
  ")": { type: "close" },
  E: { type: "exponent" },
  n: { type: "negate" },
  "<": { type: "delete" },
  c: { type: "clear" },
};
const op = (operator: CalculatorOperator): CalculatorAction => ({ type: "operator", operator });
const run = (keys: string, extra: Record<string, CalculatorAction> = {}) =>
  displayText(
    [...keys].reduce(
      (state, key) => reduce(state, extra[key] ?? ACTIONS[key] ?? { type: "digit", digit: key }),
      initialCalculatorState,
    ),
  );

describe("the engine's scientific operators, parentheses and EE", () => {
  it.each([
    ["2^10=", "1024"],
    ["2y3=", "9"],
    ["27r3=", "3"],
    ["8nr3=", "-2"],
    ["8l2=", "3"],
    ["2+3^2=", "11"],
    ["2*3^2=", "18"],
    ["2^3==", "512"],
    ["8r0=", "Not a number"],
  ])("computes %s as %s", (keys, text) => {
    expect(run(keys, { "^": op("power"), y: op("powerOf"), r: op("root"), l: op("logBase") })).toBe(
      text,
    );
  });

  it.each([
    ["2*(3+4)=", "14"],
    ["((1+2)*3)=", "9"],
    ["(1+2)*(3+4)=", "21"],
    ["2*(3+4", "4"],
    ["2*(3+4=", "14"],
    ["(5=", "5"],
    ["3)", "3"],
    ["(1+2)", "3"],
    ["2+(3c", "0"],
  ])("reads %s as %s", (keys, text) => {
    expect(run(keys)).toBe(text);
  });

  it.each([
    ["2E", "2e"],
    ["2E3", "2e3"],
    ["2E3=", "2000"],
    ["1.5En2=", "0.015"],
    ["2E3<", "2e"],
    ["2E+1=", "3"],
    ["2E.3", "2e3"],
    ["2E3E", "2e3"],
  ])("types %s as %s", (keys, text) => {
    expect(run(keys)).toBe(text);
  });

  it("writes a sum with parentheses and a new operator on the tape", () => {
    const keys: CalculatorAction[] = [
      { type: "digit", digit: "2" },
      op("multiply"),
      { type: "open" },
      { type: "digit", digit: "3" },
      op("add"),
      { type: "digit", digit: "4" },
      { type: "close" },
      op("power"),
      { type: "digit", digit: "2" },
      { type: "equals" },
    ];
    let state = initialCalculatorState;
    let expression = "";
    let finished: { expression: string; result: string } | undefined;
    for (const key of keys) {
      const after = reduce(state, key);
      ({ expression, finished } = tapeStep(expression, state, key, after));
      state = after;
    }
    expect(finished).toEqual({ expression: "2 × ( 3 + 4 ) ^ 2", result: "98" });
  });
});

const display = () => screen.getByRole("status", { name: "Result" });
const frame = () => document.querySelector(".mac-calculator") as HTMLElement;
const key = (name: string) => screen.getByRole("button", { name });

async function scientific() {
  const user = userEvent.setup();
  render(<Calculator />);
  fireEvent.keyDown(frame(), { key: "2", ctrlKey: true });
  return user;
}

describe("the Scientific keypad", () => {
  it("grows the window to six more columns, and back with Basic", async () => {
    await scientific();
    expect(screen.getAllByRole("button", { name: /./ }).length).toBeGreaterThan(40);
    expect(frame().style.width).toBe("580px");
    fireEvent.keyDown(frame(), { key: "1", ctrlKey: true });
    expect(frame().style.width).toBe("232px");
    expect(screen.queryByRole("button", { name: "sin" })).toBeNull();
  });

  it("works sin in degrees and in radians with its key", async () => {
    const user = await scientific();
    await user.click(key("3"));
    await user.click(key("0"));
    await user.click(key("sin"));
    expect(display()).toHaveTextContent(/^0\.5$/);
    await user.click(key("Rad"));
    expect(screen.getByText("Rad", { selector: ".mac-calculator-angle" })).toBeInTheDocument();
    await user.click(key("π"));
    await user.click(key("cos"));
    expect(display()).toHaveTextContent(/^-1$/);
  });

  it("turns the keys over with 2nd", async () => {
    const user = await scientific();
    await user.click(key("2nd"));
    expect(key("2nd")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "sin" })).toBeNull();
    await user.click(key("1"));
    await user.click(key("sin⁻¹"));
    expect(display()).toHaveTextContent(/^90$/);
    await user.click(key("8"));
    await user.click(key("log2"));
    expect(display()).toHaveTextContent(/^3$/);
    await user.click(key("2"));
    await user.click(key("yˣ"));
    await user.click(key("5"));
    await user.click(key("Equals"));
    expect(display()).toHaveTextContent(/^25$/);
  });

  it("keeps a memory across clears", async () => {
    const user = await scientific();
    await user.click(key("5"));
    await user.click(key("m+"));
    await user.click(key("3"));
    await user.click(key("m+"));
    await user.click(key("1"));
    await user.click(key("m-"));
    await user.click(key("Clear"));
    await user.click(key("All clear"));
    expect(display()).toHaveTextContent(/^0$/);
    await user.click(key("mr"));
    expect(display()).toHaveTextContent(/^7$/);
    await user.click(key("mc"));
    await user.click(key("mr"));
    expect(display()).toHaveTextContent(/^0$/);
  });

  it("gives Rand a number below 1", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.25);
    const user = await scientific();
    await user.click(key("Rand"));
    expect(display()).toHaveTextContent(/^0\.25$/);
    random.mockRestore();
  });

  it("marks a waiting operator, and takes parentheses from the keyboard", async () => {
    const user = await scientific();
    frame().focus();
    await user.keyboard("2*(3+4)=");
    expect(display()).toHaveTextContent(/^14$/);
    await user.click(key("xʸ"));
    expect(key("xʸ")).toHaveAttribute("aria-pressed", "true");
    await user.click(key("2"));
    await user.click(key("Equals"));
    expect(display()).toHaveTextContent(/^196$/);
  });
});
