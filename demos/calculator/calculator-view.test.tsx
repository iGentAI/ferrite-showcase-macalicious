import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginDesktopValues,
  connectDesktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { Calculator } from "./calculator";
import { initialCalculatorState } from "./calculator-engine";
import { readDecimals, readSaved, shownText } from "./calculator-settings";

const display = () => screen.getByRole("status", { name: "Result" });
const frame = () => document.querySelector(".mac-calculator") as HTMLElement;
const result = (value: number) => ({ ...initialCalculatorState, value });
const entry = (typed: string) => ({ ...initialCalculatorState, entry: typed });

describe("shownText", () => {
  it.each([
    [1234567.5, true, 15, "1,234,567.5"],
    [-1234, true, 15, "-1,234"],
    [999, true, 15, "999"],
    [1 / 3, false, 2, "0.33"],
    [2.5, false, 0, "3"],
    [2, false, 4, "2"],
    [1234.5678, true, 1, "1,234.6"],
    [1e21, true, 15, "1e21"],
    [Number.NaN, true, 2, "Not a number"],
  ])("writes %d with separators %s and %d places as %s", (value, separators, decimals, text) => {
    expect(shownText(result(value), { separators, decimals })).toBe(text);
  });

  it("rounds no number being typed, and still separates its thousands", () => {
    expect(shownText(entry("1234.5678"), { separators: true, decimals: 1 })).toBe("1,234.5678");
    expect(shownText(entry("1.50"), { separators: false, decimals: 0 })).toBe("1.50");
  });
});

describe("saved values are read with care", () => {
  it("takes only the places the menu offers", () => {
    expect(readDecimals(0)).toBe(0);
    expect(readDecimals(15)).toBe(15);
    expect(readDecimals(16)).toBeUndefined();
    expect(readDecimals(1.5)).toBeUndefined();
    expect(readDecimals("2")).toBeUndefined();
  });

  it("takes only two numbers for the display and the memory", () => {
    expect(readSaved({ value: 5, memory: 2 })).toEqual({ value: 5, memory: 2 });
    expect(readSaved({ value: "5", memory: 2 })).toBeUndefined();
    expect(readSaved({ value: 5 })).toBeUndefined();
    expect(readSaved(null)).toBeUndefined();
  });
});

describe("on the served desktop", () => {
  let written: Record<string, unknown>;
  let disconnect: () => void;

  beforeEach(() => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ entries: [] }), { status: 200 })),
    );
    written = {};
    beginDesktopValues();
    disconnect = connectDesktopValues((key, value) => {
      written[key] = value;
    });
  });

  afterEach(() => {
    disconnect();
    forgetDesktopValues();
    beginDesktopValues();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("brings back the display when the settings load after the window opened", async () => {
    render(<Calculator />);
    expect(display()).toHaveTextContent(/^0$/);
    act(() => receiveDesktopValues({ "calculator.saved": { value: 1234.5, memory: 7 } }));
    await waitFor(() => expect(display()).toHaveTextContent(/^1234\.5$/));
    expect(written).toEqual({});
  });

  it("saves the display and keeps the memory it found", async () => {
    const user = userEvent.setup();
    receiveDesktopValues({ "calculator.saved": { value: 5, memory: 7 } });
    render(<Calculator />);
    expect(display()).toHaveTextContent(/^5$/);
    frame().focus();
    await user.keyboard("12");
    await waitFor(() =>
      expect(written["calculator.saved"]).toEqual({
        value: 12,
        memory: 7,
        programmer: "5",
        base: 10,
      }),
    );
  });

  it("does not take back what was typed before the settings arrived", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("9");
    act(() => receiveDesktopValues({ "calculator.saved": { value: 5, memory: 0 } }));
    expect(display()).toHaveTextContent(/^9$/);
  });

  it("follows the separators and places the person saved, and saves the key's change", async () => {
    const user = userEvent.setup();
    receiveDesktopValues({
      "calculator.saved": { value: 1234.5678, memory: 0 },
      "calculator.decimals": 2,
    });
    render(<Calculator />);
    expect(display()).toHaveTextContent(/^1234\.57$/);
    frame().focus();
    await user.keyboard("{Control>}{Shift>}t{/Shift}{/Control}");
    expect(display()).toHaveTextContent(/^1,234\.57$/);
    expect(written["calculator.separators"]).toBe(true);
    expect(fireEvent.keyDown(frame(), { key: "1", ctrlKey: true })).toBe(false);
    expect(written["calculator.layout"]).toBe("basic");
  });
});
