import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calculator } from "./calculator";
import { parsePasted } from "./calculator-edit";

const display = () => screen.getByRole("status", { name: "Result" });
const frame = () => document.querySelector(".mac-calculator") as HTMLElement;
const paste = (text: string) => {
  const event = createEvent.paste(frame(), {
    clipboardData: { getData: (type: string) => (type === "text/plain" ? text : "") },
  });
  fireEvent(frame(), event);
};

describe("parsePasted", () => {
  it.each([
    ["42", 42],
    [" -3.5\n", -3.5],
    ["1,234,567.5", 1234567.5],
    ["1 234", 1234],
    ["1,5", 1.5],
    ["2e3", 2000],
    [".5", 0.5],
    ["+7", 7],
  ])("reads %j as %d", (text, value) => {
    expect(parsePasted(text)).toBe(value);
  });

  it.each(["", "abc", "12 apples", "1,23,4", "1e999", "Not a number"])("refuses %j", (text) => {
    expect(parsePasted(text)).toBeNull();
  });
});

describe("Calculator's Edit commands", () => {
  it("copies what the display shows with Command-C", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("6*7=");
    expect(fireEvent.keyDown(frame(), { key: "c", ctrlKey: true })).toBe(false);
    expect(await navigator.clipboard.readText()).toBe("42");
    expect(display()).toHaveTextContent(/^42$/);
  });

  it("goes on calculating with a pasted number, and ignores text that is not one", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("8+");
    paste("1,000");
    expect(display()).toHaveTextContent(/^1000$/);
    await user.keyboard("=");
    expect(display()).toHaveTextContent(/^1008$/);
    paste("twelve");
    expect(display()).toHaveTextContent(/^1008$/);
  });

  it("undoes and redoes key presses, the pending sum with them", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("12+3");
    fireEvent.keyDown(frame(), { key: "z", ctrlKey: true });
    expect(display()).toHaveTextContent(/^12$/);
    fireEvent.keyDown(frame(), { key: "z", ctrlKey: true, shiftKey: true });
    expect(display()).toHaveTextContent(/^3$/);
    await user.keyboard("=");
    expect(display()).toHaveTextContent(/^15$/);
    fireEvent.keyDown(frame(), { key: "z", ctrlKey: true });
    expect(display()).toHaveTextContent(/^3$/);
    await user.keyboard("=");
    expect(display()).toHaveTextContent(/^15$/);
  });

  it("cuts the display to the clipboard, keeping the sum", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("9+5");
    fireEvent.keyDown(frame(), { key: "x", ctrlKey: true });
    expect(await navigator.clipboard.readText()).toBe("5");
    expect(display()).toHaveTextContent(/^0$/);
    await user.keyboard("1=");
    expect(display()).toHaveTextContent(/^10$/);
  });

  it("keeps the number when the clipboard refuses a cut", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("42");
    const refuse = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValueOnce(new Error("no"));
    fireEvent.keyDown(frame(), { key: "x", ctrlKey: true });
    await vi.waitFor(() => expect(refuse).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(display()).toHaveTextContent(/^42$/);
    refuse.mockRestore();
  });

  it("selects the number with Select All, for the browser's own selection", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("314");
    expect(fireEvent.keyDown(frame(), { key: "a", ctrlKey: true })).toBe(false);
    expect(document.getSelection()?.toString()).toBe("314");
  });

  it("does not copy Not a number", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await navigator.clipboard.writeText("before");
    await user.keyboard("1/0=");
    expect(display()).toHaveTextContent("Not a number");
    fireEvent.keyDown(frame(), { key: "c", ctrlKey: true });
    expect(await navigator.clipboard.readText()).toBe("before");
  });
});
