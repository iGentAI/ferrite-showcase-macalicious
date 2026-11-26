import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Calculator } from "./calculator";
import {
  characterOf,
  formatProgrammer,
  fromNumber,
  initialProgrammerState,
  type ProgrammerAction,
  type ProgrammerBase,
  type ProgrammerOperator,
  type ProgrammerUnary,
  parseProgrammer,
  programmerFinished,
  reduceProgrammer,
} from "./calculator-bits";

const digits = (text: string): ProgrammerAction => ({ type: "digits", digits: text });
const at = (base: ProgrammerBase, value = 0n) => ({ ...initialProgrammerState, base, value });
const hex = (...actions: ProgrammerAction[]) =>
  formatProgrammer(actions.reduce(reduceProgrammer, at(16)));
const binary = (left: string, operator: ProgrammerOperator, right: string) =>
  hex(digits(left), { type: "operator", operator }, digits(right), { type: "equals" });
const unary = (start: string, name: ProgrammerUnary) =>
  hex(digits(start), { type: "unary", unary: name });

describe("the 64-bit engine", () => {
  it.each<[string, ProgrammerOperator, string, string]>([
    ["FF", "and", "F", "0xF"],
    ["F0", "or", "F", "0xFF"],
    ["F0", "nor", "F", "0xFFFFFFFFFFFFFF00"],
    ["FF", "xor", "F", "0xF0"],
    ["1", "shiftLeftBy", "8", "0x100"],
    ["100", "shiftRightBy", "8", "0x1"],
    ["1", "shiftLeftBy", "40", "0x0"],
    ["FFFFFFFFFFFFFFFF", "add", "1", "0x0"],
    ["0", "subtract", "1", "0xFFFFFFFFFFFFFFFF"],
    ["100000000", "multiply", "100000000", "0x0"],
    ["FF", "divide", "10", "0xF"],
    ["FF", "divide", "0", "Not a number"],
  ])("0x%s %s 0x%s is %s", (left, operator, right, text) => {
    expect(binary(left, operator, right)).toBe(text);
  });

  it.each<[string, ProgrammerUnary, string]>([
    ["1", "shiftLeft", "0x2"],
    ["8000000000000000", "shiftLeft", "0x0"],
    ["3", "shiftRight", "0x1"],
    ["8000000000000000", "rotateLeft", "0x1"],
    ["1", "rotateRight", "0x8000000000000000"],
    ["1234", "byteFlip", "0x3412000000000000"],
    ["123456789ABCDEF0", "byteFlip", "0xF0DEBC9A78563412"],
    ["1234", "wordFlip", "0x1234000000000000"],
    ["123456789ABCDEF0", "wordFlip", "0xDEF09ABC56781234"],
    ["1", "twos", "0xFFFFFFFFFFFFFFFF"],
    ["0", "ones", "0xFFFFFFFFFFFFFFFF"],
    ["F0", "ones", "0xFFFFFFFFFFFFFF0F"],
  ])("0x%s %s is %s", (start, name, text) => {
    expect(unary(start, name)).toBe(text);
  });

  it("keeps every bit of a number a float would round", () => {
    const state = [digits("18446744073709551615")].reduce(reduceProgrammer, at(10));
    expect(formatProgrammer(state)).toBe("18446744073709551615");
    expect(formatProgrammer(reduceProgrammer(state, { type: "base", base: 16 }))).toBe(
      "0xFFFFFFFFFFFFFFFF",
    );
    expect(formatProgrammer(reduceProgrammer(state, { type: "base", base: 8 }))).toBe(
      "1777777777777777777777",
    );
  });

  it("refuses a digit the base lacks and a number past 64 bits", () => {
    expect(formatProgrammer(reduceProgrammer(at(8), digits("9")))).toBe("0");
    expect(formatProgrammer(reduceProgrammer(at(10), digits("A")))).toBe("0");
    expect(hex(digits("FFFFFFFFFFFFFFFF"), digits("1"))).toBe("0xFFFFFFFFFFFFFFFF");
  });

  it("repeats with equals, replaces a second operator and runs left to right", () => {
    const add: ProgrammerAction = { type: "operator", operator: "add" };
    const times: ProgrammerAction = { type: "operator", operator: "multiply" };
    const equals: ProgrammerAction = { type: "equals" };
    expect(hex(digits("2"), add, digits("3"), equals, equals)).toBe("0x8");
    expect(hex(digits("2"), add, times, digits("3"), equals)).toBe("0x6");
    expect(hex(digits("2"), add, digits("3"), times, digits("4"), equals)).toBe("0x14");
    expect(hex(digits("2"), add, digits("3"), equals, digits("4"), equals, equals)).toBe("0x4");
  });

  it("clears the entry with C and everything but the base with AC", () => {
    const sum = [digits("7"), { type: "operator", operator: "add" } as const, digits("1")].reduce(
      reduceProgrammer,
      at(16),
    );
    const cleared = reduceProgrammer(sum, { type: "clear" });
    expect(cleared.value).toBe(0n);
    expect(
      formatProgrammer(
        reduceProgrammer(reduceProgrammer(cleared, digits("2")), { type: "equals" }),
      ),
    ).toBe("0x9");
    expect(reduceProgrammer(sum, { type: "allClear" })).toEqual(at(16));
  });

  it("toggles single bits, the top one too", () => {
    const top = reduceProgrammer(at(16), { type: "toggleBit", bit: 63 });
    expect(formatProgrammer(top)).toBe("0x8000000000000000");
    expect(formatProgrammer(reduceProgrammer(top, { type: "toggleBit", bit: 63 }))).toBe("0x0");
  });

  it("takes a number of the other layouts by its whole part, wrapped", () => {
    expect(fromNumber(42.9)).toBe(42n);
    expect(fromNumber(-1)).toBe(0xffffffffffffffffn);
    expect(fromNumber(Number.NaN)).toBe(0n);
  });

  it.each<[string, ProgrammerBase, bigint | null]>([
    ["0xFF", 10, 255n],
    ["ff", 16, 255n],
    ["377", 8, 255n],
    ["1,000", 10, 1000n],
    ["-1", 10, 0xffffffffffffffffn],
    ["18446744073709551616", 10, null],
    ["9", 8, null],
    ["ff", 10, null],
    ["", 10, null],
    ["1.5", 10, null],
  ])("reads pasted %j in base %d as %s", (text, base, value) => {
    expect(parseProgrammer(text, base)).toBe(value);
  });

  it.each<[bigint, "ascii" | "unicode", string]>([
    [65n, "ascii", "A"],
    [31n, "ascii", ""],
    [127n, "ascii", ""],
    [0x263an, "ascii", ""],
    [0x263an, "unicode", "☺"],
    [0x1f600n, "unicode", "😀"],
    [0xd800n, "unicode", ""],
    [0x110000n, "unicode", ""],
  ])("writes %d in %s as %j", (value, mode, text) => {
    expect(characterOf(value, mode)).toBe(text);
  });

  it("writes a finished calculation down in the base shown", () => {
    const before = [
      digits("FF"),
      { type: "operator", operator: "and" } as const,
      digits("F"),
    ].reduce(reduceProgrammer, at(16));
    const after = reduceProgrammer(before, { type: "equals" });
    expect(programmerFinished(before, after)).toEqual({
      expression: "0xFF AND 0xF",
      result: "0xF",
    });
  });
});

const display = () => screen.getByRole("status", { name: "Result" });
const frame = () => document.querySelector(".mac-calculator") as HTMLElement;
const key = (name: string) => screen.getByRole("button", { name });

function programmer() {
  const user = userEvent.setup();
  render(<Calculator />);
  fireEvent.keyDown(frame(), { key: "3", ctrlKey: true });
  return user;
}

describe("the Programmer keypad", () => {
  it("is a window of its own size, with the number carried in and back out", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("65.5");
    fireEvent.keyDown(frame(), { key: "3", ctrlKey: true });
    expect(frame().style.width).toBe("412px");
    expect(frame().style.height).toBe("402px");
    expect(display()).toHaveTextContent(/^65$/);
    await user.click(key("Base 16"));
    expect(display()).toHaveTextContent(/^0x41$/);
    await user.click(key("ASCII"));
    expect(screen.getByRole("status", { name: "Character" })).toHaveTextContent(/^A$/);
    fireEvent.keyDown(frame(), { key: "1", ctrlKey: true });
    expect(display()).toHaveTextContent(/^65$/);
  });

  it("dims the digits the base lacks", async () => {
    const user = programmer();
    expect(key("F")).toBeDisabled();
    expect(key("FF")).toBeDisabled();
    await user.click(key("Base 8"));
    expect(key("8")).toBeDisabled();
    expect(key("7")).not.toBeDisabled();
    await user.click(key("Base 16"));
    expect(key("F")).not.toBeDisabled();
  });

  it("sets the bit field from the number and the number from the bit field", async () => {
    const user = programmer();
    await user.click(key("5"));
    expect(key("Bit 0")).toHaveAttribute("aria-pressed", "true");
    expect(key("Bit 1")).toHaveAttribute("aria-pressed", "false");
    expect(key("Bit 2")).toHaveAttribute("aria-pressed", "true");
    await user.click(key("Bit 1"));
    expect(display()).toHaveTextContent(/^7$/);
    await user.click(key("Bit 63"));
    expect(display()).toHaveTextContent(/^9223372036854775815$/);
  });

  it("takes letters as digits in base 16 and C as a clear elsewhere", async () => {
    const user = programmer();
    frame().focus();
    await user.keyboard("12c");
    expect(display()).toHaveTextContent(/^0$/);
    await user.click(key("Base 16"));
    frame().focus();
    await user.keyboard("ab&f=");
    expect(display()).toHaveTextContent(/^0xB$/);
    await user.keyboard("c9{Backspace}");
    expect(display()).toHaveTextContent(/^0xC$/);
  });

  it("undoes a key, and pastes in the base shown", async () => {
    const user = programmer();
    await user.click(key("Base 16"));
    await user.click(key("F"));
    await user.click(key("RoL"));
    expect(display()).toHaveTextContent(/^0x1E$/);
    fireEvent.keyDown(frame(), { key: "z", ctrlKey: true });
    expect(display()).toHaveTextContent(/^0xF$/);
    fireEvent.keyDown(frame(), { key: "c", ctrlKey: true });
    expect(await navigator.clipboard.readText()).toBe("0xF");
  });
});
