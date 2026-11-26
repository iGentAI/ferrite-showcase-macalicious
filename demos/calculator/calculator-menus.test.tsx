import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import {
  beginDesktopValues,
  connectDesktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { Calculator } from "./calculator";
import { type CalculatorAction, initialCalculatorState, reduce } from "./calculator-engine";
import { compute } from "./calculator-science";
import { tapeStep, useCalculatorTape } from "./calculator-tape";
import { copiedTapeText, PaperTape } from "./paper-tape";

const display = () => screen.getByRole("status", { name: "Result" });
const LINES = [
  { id: "a", expression: "1 + 1", result: "2" },
  { id: "b", expression: "2 + 2", result: "4" },
  { id: "c", expression: "3 + 3", result: "6" },
];
const dataTransfer = (text = "") => {
  const store: Record<string, string> = { "text/plain": text };
  return {
    types: ["text/plain"],
    effectAllowed: "",
    dropEffect: "",
    getData: (type: string) => store[type] ?? "",
    setData: (type: string, value: string) => {
      store[type] = value;
    },
  };
};
const withClipboard = (writeText: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function written(actions: readonly CalculatorAction[]) {
  let state = initialCalculatorState;
  let expression = "";
  let finished: { expression: string; result: string } | undefined;
  for (const action of actions) {
    const after = reduce(state, action);
    const step = tapeStep(expression, state, action, after);
    expression = step.expression;
    finished = step.finished ?? finished;
    state = after;
  }
  return finished;
}

describe("the tape writes down a sum in parentheses", () => {
  const digit = (d: string): CalculatorAction => ({ type: "digit", digit: d });
  const add: CalculatorAction = { type: "operator", operator: "add" };
  const times: CalculatorAction = { type: "operator", operator: "multiply" };

  it("writes (1+2)= as one line", () => {
    expect(
      written([
        { type: "open" },
        digit("1"),
        add,
        digit("2"),
        { type: "close" },
        { type: "equals" },
      ]),
    ).toEqual({ expression: "( 1 + 2 )", result: "3" });
  });

  it("writes a function of a closed parenthesis as the number it made", () => {
    expect(
      written([
        digit("2"),
        times,
        { type: "open" },
        digit("3"),
        add,
        digit("4"),
        { type: "close" },
        { type: "value", value: 49, ofDisplay: true },
        { type: "equals" },
      ]),
    ).toEqual({ expression: "2 × 49", result: "98" });
  });
});

describe("small sines and cosines", () => {
  it("keeps a small result that is no rounding", () => {
    expect(compute("sin", 1e-20, false)).toBe(1e-20);
    expect(compute("tan", 1e-20, false)).toBe(1e-20);
  });

  it("still makes the multiples of a quarter turn exact", () => {
    expect(compute("sin", Math.PI, false)).toBe(0);
    expect(compute("cos", Math.PI / 2, false)).toBe(0);
    expect(compute("tan", Math.PI, false)).toBe(0);
    expect(compute("tan", Math.PI / 2, false)).toBeNaN();
    expect(compute("cos", Math.PI, false)).toBe(-1);
  });
});

describe("the display", () => {
  it("has a context menu that copies the number", async () => {
    const writeText = vi.fn(async () => {});
    const user = userEvent.setup();
    withClipboard(writeText);
    render(<Calculator />);
    await user.click(screen.getByRole("button", { name: "7" }));
    fireEvent.contextMenu(display());
    const menu = await screen.findByRole("menu", { name: "Result" });
    await user.click(within(menu).getByRole("menuitem", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("7");
  });

  it("offers Speech in the context menu, speaking the number", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(readonly text: string) {}
      },
    );
    const user = userEvent.setup();
    render(<Calculator />);
    await user.click(screen.getByRole("button", { name: "8" }));
    fireEvent.contextMenu(display());
    const menu = await screen.findByRole("menu", { name: "Result" });
    await user.click(within(menu).getByRole("menuitem", { name: "Speech" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Start Speaking" }));
    expect(speak.mock.calls[0]?.[0].text).toBe("8");
  });

  it("takes a number dropped on it, and ignores text that is none", () => {
    render(<Calculator />);
    fireEvent.drop(display(), { dataTransfer: dataTransfer("1,234.5") });
    expect(display()).toHaveTextContent(/^1234\.5$/);
    fireEvent.drop(display(), { dataTransfer: dataTransfer("not a number") });
    expect(display()).toHaveTextContent(/^1234\.5$/);
    expect(fireEvent.dragOver(display(), { dataTransfer: dataTransfer() })).toBe(false);
  });

  it("drags its number out when the number is selected, and moves the window otherwise", async () => {
    const moved = vi.fn();
    const user = userEvent.setup();
    render(<Calculator onDragRegionPointerDown={moved} />);
    await user.click(screen.getByRole("button", { name: "5" }));

    fireEvent.pointerDown(display(), { button: 0 });
    expect(moved).toHaveBeenCalledTimes(1);
    expect(display().getAttribute("draggable")).toBe("false");

    document.getSelection()?.selectAllChildren(display().firstElementChild as Element);
    fireEvent.pointerDown(display(), { button: 0 });
    expect(moved).toHaveBeenCalledTimes(1);
    expect(display().getAttribute("draggable")).toBe("true");
    const out = dataTransfer();
    fireEvent.dragStart(display(), { dataTransfer: out });
    expect(out.getData("text/plain")).toBe("5");
  });
});

describe("the Paper Tape's lines", () => {
  const lines = () => screen.getAllByRole("listitem");
  const picked = () =>
    lines()
      .filter((line) => line.getAttribute("aria-current") === "true")
      .map((line) => line.textContent);

  it("selects one by a click, a range by Shift, one more by Command", () => {
    render(<PaperTape lines={LINES} />);
    fireEvent.click(lines()[0] as HTMLElement);
    expect(picked()).toEqual(["1 + 1= 2"]);
    fireEvent.click(lines()[2] as HTMLElement, { shiftKey: true });
    expect(picked()).toEqual(["1 + 1= 2", "2 + 2= 4", "3 + 3= 6"]);
    fireEvent.click(lines()[1] as HTMLElement);
    fireEvent.click(lines()[2] as HTMLElement, { metaKey: true });
    expect(picked()).toEqual(["2 + 2= 4", "3 + 3= 6"]);
    fireEvent.click(lines()[2] as HTMLElement, { metaKey: true });
    expect(picked()).toEqual(["2 + 2= 4"]);
  });

  it("has a context menu: Copy takes the lines selected, or the whole tape; Clear clears", async () => {
    const writeText = vi.fn(async () => {});
    const clear = vi.fn();
    const user = userEvent.setup();
    withClipboard(writeText);
    render(<PaperTape lines={LINES} onClear={clear} />);

    fireEvent.contextMenu(lines()[1] as HTMLElement);
    let menu = await screen.findByRole("menu", { name: "Paper Tape" });
    await user.click(within(menu).getByRole("menuitem", { name: "Copy" }));
    expect(writeText).toHaveBeenLastCalledWith("2 + 2\n= 4");

    fireEvent.click(screen.getByRole("list", { name: "Calculations" }));
    expect(picked()).toEqual([]);
    fireEvent.contextMenu(screen.getByRole("list", { name: "Calculations" }));
    menu = await screen.findByRole("menu", { name: "Paper Tape" });
    await user.click(within(menu).getByRole("menuitem", { name: "Clear" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("writes lines for the clipboard as the window shows them", () => {
    expect(copiedTapeText(LINES.slice(0, 2))).toBe("1 + 1\n= 2\n2 + 2\n= 4");
  });
});

describe("the tape in another tab", () => {
  it("shows what another tab of the same desktop wrote, without a reload", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const entries = [{ expression: "1 + 1", result: "2" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ entries })),
    );
    function Lines() {
      const { lines } = useCalculatorTape(true);
      return <output>{lines.map((line) => line.expression).join("|")}</output>;
    }
    render(<Lines />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 + 1"));
    entries.push({ expression: "2 + 2", result: "4" });
    window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "notes" } }));
    window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "calculator" } }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^1 \+ 1\|2 \+ 2$/));
  });
});

describe("saving what the display holds", () => {
  let written: Record<string, unknown>;
  let disconnect: () => void;
  beforeEach(() => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ entries: [] })),
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
  });

  it("writes at once when the page goes, not 300 ms after the key", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    await user.click(screen.getByRole("button", { name: "9" }));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(written["calculator.saved"]).toMatchObject({ value: 9 });
  });

  it("keeps the memory when it arrives after a key was pressed", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    await user.click(screen.getByRole("button", { name: "3" }));
    act(() => receiveDesktopValues({ "calculator.saved": { value: 5, memory: 12 } }));
    expect(display()).toHaveTextContent(/^3$/);
    await waitFor(() =>
      expect(written["calculator.saved"]).toMatchObject({ value: 3, memory: 12 }),
    );
  });
});
