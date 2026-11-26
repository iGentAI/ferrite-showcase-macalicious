import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { useWindowManagerStore, WindowManager } from "macalicious/window-manager";
import { createRef, type KeyboardEvent, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import {
  beginDesktopValues,
  connectDesktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { REQUEST_DEADLINE_MS } from "../desktop/desktop-server";
import { app, calculatorApp } from "./app";
import { Calculator } from "./calculator";
import {
  type CalculatorAction,
  type CalculatorState,
  displayText,
  formatNumber,
  initialCalculatorState,
  reduce,
} from "./calculator-engine";
import {
  bounded,
  type FinishedCalculation,
  MAX_EXPRESSION,
  TAPE_URL,
  tapeStep,
  useCalculatorTape,
} from "./calculator-tape";

/** One character per key: digits, `.`, `+ - * /`, `=`, `%`, `n` (negate), `c` (clear), `<` (delete). */
const ACTIONS: Record<string, CalculatorAction> = {
  ".": { type: "decimal" },
  "+": { type: "operator", operator: "add" },
  "-": { type: "operator", operator: "subtract" },
  "*": { type: "operator", operator: "multiply" },
  "/": { type: "operator", operator: "divide" },
  "=": { type: "equals" },
  "%": { type: "percent" },
  n: { type: "negate" },
  c: { type: "clear" },
  "<": { type: "delete" },
};
const run = (keys: string, from: CalculatorState = initialCalculatorState) =>
  [...keys].reduce(
    (state, key) => reduce(state, ACTIONS[key] ?? { type: "digit", digit: key }),
    from,
  );
const shown = (keys: string) => displayText(run(keys));

describe("calculator engine", () => {
  it("starts at 0 with nothing to clear", () => {
    expect(displayText(initialCalculatorState)).toBe("0");
    expect(initialCalculatorState.clearable).toBe(false);
  });

  it.each([
    ["12+3=", "15"],
    ["3-5=", "-2"],
    ["6*7=", "42"],
    ["9/4=", "2.25"],
    [".1+.2=", "0.3"],
    ["2+3*4=", "14"],
    ["2*3+4=", "10"],
    ["8-6/2*3=", "-1"],
    ["1+2+3+4=", "10"],
  ])("computes %s as %s", (keys, result) => {
    expect(shown(keys)).toBe(result);
  });

  it("shows the running result when an operator closes a sum", () => {
    expect(shown("2+3+")).toBe("5");
    expect(shown("2+3*")).toBe("3");
    expect(shown("2*3+")).toBe("6");
  });

  it("types numbers digit by digit", () => {
    expect(shown("007")).toBe("7");
    expect(shown("1.50")).toBe("1.50");
    expect(shown(".5")).toBe("0.5");
    expect(shown("1..2.3")).toBe("1.23");
    expect(shown("1234567890123456789")).toBe("123456789012345");
    expect(shown("x")).toBe("0");
  });

  it("starts a new number after a result", () => {
    expect(shown("2+3=4")).toBe("4");
    expect(shown("2+3=4*2=")).toBe("8");
    expect(shown("2+3=*2=")).toBe("10");
  });

  it("repeats the last operation when equals is pressed again", () => {
    expect(shown("2+3==")).toBe("8");
    expect(shown("2+3===")).toBe("11");
    expect(shown("2*3==")).toBe("18");
    expect(shown("7=")).toBe("7");
  });

  it("lets a second operator replace the first", () => {
    expect(shown("2+*3=")).toBe("6");
    expect(shown("8*-3=")).toBe("5");
    expect(run("2+*").armed).toBe("multiply");
  });

  it("arms an operator until a number follows", () => {
    expect(run("2").armed).toBeNull();
    expect(run("2+").armed).toBe("add");
    expect(run("2+3").armed).toBeNull();
    expect(run("2+3=").armed).toBeNull();
  });

  it("takes a percentage of the first number in a sum and a hundredth otherwise", () => {
    expect(shown("50%")).toBe("0.5");
    expect(shown("200+10%")).toBe("20");
    expect(shown("200+10%=")).toBe("220");
    expect(shown("200-10%=")).toBe("180");
    expect(shown("200*10%")).toBe("0.1");
    expect(shown("200*10%=")).toBe("20");
  });

  it("changes the sign of an entry, of a result and of the number about to be typed", () => {
    expect(shown("5n")).toBe("-5");
    expect(shown("5nn")).toBe("5");
    expect(shown("n")).toBe("-0");
    expect(shown("n5")).toBe("-5");
    expect(shown("2+3=n")).toBe("-5");
    expect(shown("8+3n=")).toBe("5");
    // After an operator the sign belongs to the second number, not to the first.
    expect(shown("8+n")).toBe("-0");
    expect(shown("8+n3")).toBe("-3");
    expect(shown("8+n3=")).toBe("5");
    expect(shown("6*n2=")).toBe("-12");
    expect(shown("8+nn3=")).toBe("11");
    expect(run("8+n").armed).toBeNull();
    // A percentage is a result: its sign changes in place and the sum goes on.
    expect(shown("200+10%n=")).toBe("180");
  });

  it("clears the entry first and everything on the second press", () => {
    const entry = run("2+3");
    expect(entry.clearable).toBe(true);

    const cleared = reduce(entry, { type: "clear" });
    expect(displayText(cleared)).toBe("0");
    expect(cleared.clearable).toBe(false);
    expect(cleared.armed).toBe("add");
    expect(displayText(run("4=", cleared))).toBe("6");

    expect(reduce(cleared, { type: "clear" })).toEqual(initialCalculatorState);
    expect(shown("2+3cc4=")).toBe("4");
  });

  it("deletes the last digit of an entry and leaves a result alone", () => {
    expect(shown("123<")).toBe("12");
    expect(shown("1.5<")).toBe("1.");
    expect(shown("7<")).toBe("0");
    expect(shown("7n<")).toBe("0");
    expect(shown("2+3=<")).toBe("5");
  });

  it("ends the sum when a result is not a number", () => {
    const failed = run("5/0=");
    expect(displayText(failed)).toBe("Not a number");
    expect(failed.pending).toEqual([]);
    expect(displayText(run("n", failed))).toBe("Not a number");
    expect(displayText(run("7+1=", failed))).toBe("8");
    expect(shown("5/0+")).toBe("Not a number");
  });

  it("writes results with at most 15 significant digits", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(1 / 3)).toBe("0.333333333333333");
    expect(formatNumber(1e21)).toBe("1e21");
    expect(formatNumber(1e-7)).toBe("1e-7");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("Not a number");
  });
});

const frame = () => screen.getByRole("region", { name: "Calculator" });
const display = () => screen.getByRole("status", { name: "Result" });
const key = (name: string) => screen.getByRole("button", { name });

describe("Calculator", () => {
  it("opens cleared, in a window with the three controls and nineteen keys", () => {
    render(<Calculator />);
    expect(frame()).toHaveClass("mac-window", "mac-calculator");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "232px", height: "321px" });
    expect(display()).toHaveTextContent(/^0$/);
    expect(key("All clear")).toHaveTextContent("AC");

    const controls = within(screen.getByRole("group", { name: "Window controls" }));
    expect(
      controls.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Close", "Minimize", "Zoom"]);
    expect(within(screen.getByRole("group", { name: "Keys" })).getAllByRole("button")).toHaveLength(
      19,
    );
  });

  it("does arithmetic with the pointer", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    for (const name of ["6", "Multiply", "7", "Equals"]) await user.click(key(name));
    expect(display()).toHaveTextContent(/^42$/);

    for (const name of ["Subtract", "1", "0", "Decimal point", "5", "Equals"]) {
      await user.click(key(name));
    }
    expect(display()).toHaveTextContent(/^31\.5$/);

    for (const name of ["Divide", "3", "Add", "2", "Negate", "Equals"]) await user.click(key(name));
    expect(display()).toHaveTextContent(/^8\.5$/);

    // The sign pressed before the second number is typed.
    for (const name of ["8", "Add", "Negate"]) await user.click(key(name));
    expect(display()).toHaveTextContent(/^-0$/);
    for (const name of ["3", "Equals"]) await user.click(key(name));
    expect(display()).toHaveTextContent(/^5$/);

    for (const name of ["2", "0", "0", "Add", "1", "0", "Percent", "Equals"]) {
      await user.click(key(name));
    }
    expect(display()).toHaveTextContent(/^220$/);
  });

  it("turns the clear key from AC to C and back", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    await user.click(key("4"));
    await user.click(key("2"));
    expect(display()).toHaveTextContent(/^42$/);
    expect(key("Clear")).toHaveTextContent(/^C$/);

    await user.click(key("Clear"));
    expect(display()).toHaveTextContent(/^0$/);
    expect(key("All clear")).toHaveTextContent("AC");
  });

  it("marks the operator that waits for its second number", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    expect(key("Add")).toHaveAttribute("aria-pressed", "false");
    await user.click(key("5"));
    await user.click(key("Add"));
    expect(key("Add")).toHaveAttribute("aria-pressed", "true");
    expect(key("Subtract")).toHaveAttribute("aria-pressed", "false");
    expect(key("Equals")).not.toHaveAttribute("aria-pressed");

    await user.click(key("Subtract"));
    expect(key("Add")).toHaveAttribute("aria-pressed", "false");
    expect(key("Subtract")).toHaveAttribute("aria-pressed", "true");

    await user.click(key("2"));
    expect(key("Subtract")).toHaveAttribute("aria-pressed", "false");
  });

  it("does arithmetic from the keyboard while the window has the focus", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    expect(frame()).toHaveAttribute("tabindex", "-1");
    frame().focus();

    await user.keyboard("12+3{Enter}");
    expect(display()).toHaveTextContent(/^15$/);
    await user.keyboard("*4=");
    expect(display()).toHaveTextContent(/^60$/);
    await user.keyboard("/8-1.5=");
    expect(display()).toHaveTextContent(/^6$/);
    await user.keyboard("50%");
    expect(display()).toHaveTextContent(/^0\.5$/);
    await user.keyboard("1,25");
    expect(display()).toHaveTextContent(/^1\.25$/);
  });

  it("clears with Escape or C, deletes with Backspace and negates with Option-minus", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();

    await user.keyboard("123{Backspace}");
    expect(display()).toHaveTextContent(/^12$/);
    await user.keyboard("{Delete}");
    expect(display()).toHaveTextContent(/^1$/);

    fireEvent.keyDown(frame(), { key: "–", code: "Minus", altKey: true });
    expect(display()).toHaveTextContent(/^-1$/);
    // With Option held, no other key is a calculator key.
    fireEvent.keyDown(frame(), { key: "5", code: "Digit5", altKey: true });
    expect(display()).toHaveTextContent(/^-1$/);

    await user.keyboard("{Escape}");
    expect(display()).toHaveTextContent(/^0$/);
    await user.keyboard("7c");
    expect(display()).toHaveTextContent(/^0$/);
    await user.keyboard("8C");
    expect(display()).toHaveTextContent(/^0$/);
  });

  it("leaves browser shortcuts and unrelated keys alone", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("5");

    for (const modifier of ["ctrlKey", "metaKey"]) {
      expect(fireEvent.keyDown(frame(), { key: "y", [modifier]: true })).toBe(true);
      expect(fireEvent.keyDown(frame(), { key: "l", [modifier]: true })).toBe(true);
    }
    expect(fireEvent.keyDown(frame(), { key: "a" })).toBe(true);
    expect(fireEvent.keyDown(frame(), { key: "Tab" })).toBe(true);
    expect(display()).toHaveTextContent(/^5$/);

    // A calculator key is consumed.
    expect(fireEvent.keyDown(frame(), { key: "6" })).toBe(false);
    expect(display()).toHaveTextContent(/^56$/);
  });

  it("lets Return and Space press the key that has the focus", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    await user.click(key("2"));
    await user.click(key("Add"));
    key("3").focus();

    await user.keyboard("{Enter}");
    expect(display()).toHaveTextContent(/^3$/);
    await user.keyboard(" ");
    expect(display()).toHaveTextContent(/^33$/);

    // Any other key still works the calculator from a focused key.
    await user.keyboard("=");
    expect(display()).toHaveTextContent(/^35$/);
  });

  it("shrinks a long number to the width of the display", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    frame().focus();
    await user.keyboard("1234567");
    expect(display().style.getPropertyValue("--_scale")).toBe("");
    await user.keyboard("8901234");
    expect(display()).toHaveTextContent(/^12345678901234$/);
    expect(display().style.getPropertyValue("--_scale")).toBe("0.5");
  });

  it("passes window props to its root", () => {
    const ref = createRef<HTMLDivElement>();
    const onPointerDown = vi.fn();
    render(
      <Calculator
        ref={ref}
        state="inactive"
        width="100%"
        height={400}
        className="mine"
        style={{ left: 10 }}
        id="calc"
        aria-label="Calculator 2"
        onPointerDown={onPointerDown}
      />,
    );
    const root = screen.getByRole("region", { name: "Calculator 2" });
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-window", "mac-calculator", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveAttribute("id", "calc");
    expect(root).toHaveStyle({ width: "100%", height: "400px", left: "10px" });
    fireEvent.pointerDown(root);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("lets the host's key handler take a key first", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: KeyboardEvent) => {
      if (event.key === "9") event.preventDefault();
    });
    render(<Calculator onKeyDown={onKeyDown} />);
    frame().focus();
    await user.keyboard("198");
    expect(onKeyDown).toHaveBeenCalledTimes(3);
    expect(display()).toHaveTextContent(/^18$/);
  });

  it("hands the window controls their props", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <Calculator onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} />,
    );
    await user.click(key("Close"));
    await user.click(key("Minimize"));
    await user.click(key("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    // The window controls' callbacks are not attributes of the window.
    expect(frame()).not.toHaveAttribute("zoomrole");

    rerender(<Calculator onMinimize={onMinimize} onZoom={onZoom} minimizeDisabled zoomDisabled />);
    expect(key("Minimize")).toBeDisabled();
    expect(key("Zoom")).toBeDisabled();
    expect(key("Close")).toBeEnabled();

    rerender(<Calculator zoomRole="full-screen" />);
    expect(key("Enter Full Screen")).toBeInTheDocument();
  });

  it("reports a press and a double click on the display, its drag region", async () => {
    const user = userEvent.setup();
    const pressedOn: EventTarget[] = [];
    const handledBy: (EventTarget | null)[] = [];
    const onDragRegionPointerDown = vi.fn(
      (event: { target: EventTarget; currentTarget: EventTarget | null }) => {
        pressedOn.push(event.target);
        handledBy.push(event.currentTarget);
      },
    );
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Calculator
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(display()).toHaveAttribute("data-window-drag-region");

    fireEvent.pointerDown(display(), { button: 2 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(display(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(pressedOn).toEqual([display()]);
    // Reported by the window once its own handler has run: the window's root is the currentTarget.
    expect(handledBy).toEqual([display().closest(".mac-calculator")]);

    // The keys are not part of the drag region.
    fireEvent.pointerDown(key("7"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(display());
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("lets a handler on the window cancel a press or a double click on the display", () => {
    const order: string[] = [];
    let cancel = true;
    render(
      <Calculator
        onPointerDown={(event) => {
          order.push("window");
          if (cancel) event.preventDefault();
        }}
        onDoubleClick={(event) => {
          order.push("window");
          if (cancel) event.preventDefault();
        }}
        onDragRegionPointerDown={() => order.push("display")}
        onDragRegionDoubleClick={() => order.push("display")}
      />,
    );
    // Cancelled by the window: neither is reported.
    fireEvent.pointerDown(display(), { button: 0 });
    fireEvent.doubleClick(display());
    expect(order).toEqual(["window", "window"]);

    // Not cancelled: the window hears each first, then it is reported.
    cancel = false;
    order.length = 0;
    fireEvent.pointerDown(display(), { button: 0 });
    fireEvent.doubleClick(display());
    expect(order).toEqual(["window", "display", "window", "display"]);
    // A press on a key, after one on the display, is the window's alone.
    fireEvent.pointerDown(key("7"), { button: 0 });
    expect(order).toEqual(["window", "display", "window", "display", "window"]);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(calculatorApp);
    expect(app).toMatchObject({
      id: "calculator",
      name: "Calculator",
      component: Calculator,
      defaultSize: { width: 232, height: 321 },
      minSize: { width: 232, height: 321 },
      resizable: false,
    });
    expect(app.menus).toEqual([
      "Calculator",
      "File",
      "Edit",
      "View",
      "Convert",
      "Speech",
      "Window",
      "Help",
    ]);

    render(
      <WindowManager style={{ height: 500 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const host = frame().parentElement as HTMLElement;
    expect(host).toHaveAttribute("data-window-id", "calculator");
    expect(host).toHaveStyle({ width: "232px", height: "321px" });
    // The manager sizes the wrapper; the window fills it.
    expect(frame()).toHaveStyle({ width: "100%", height: "100%" });
    expect(frame()).toHaveAttribute("data-window-state", "key");
    // A window that cannot be resized has no zoom.
    expect(key("Zoom")).toBeDisabled();

    // The manager moves the window by its display.
    const before = host.style.transform;
    fireEvent.pointerDown(display(), { button: 0, pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(display(), { pointerId: 1, clientX: 140, clientY: 80 });
    fireEvent.pointerUp(display(), { pointerId: 1, clientX: 140, clientY: 80 });
    expect(host.style.transform).not.toBe(before);

    // The calculator still works in there.
    for (const name of ["9", "Subtract", "4", "Equals"]) await user.click(key(name));
    expect(display()).toHaveTextContent(/^5$/);

    await user.click(key("Close"));
    expect(screen.queryByRole("region", { name: "Calculator" })).toBeNull();
  });
});

/** The calculations `keys` finish (same key characters as `run`), as the tape records them. */
function finishedBy(keys: string): FinishedCalculation[] {
  let state = initialCalculatorState;
  let expression = "";
  const finished: FinishedCalculation[] = [];
  for (const character of keys) {
    const action = ACTIONS[character] ?? { type: "digit", digit: character };
    const next = reduce(state, action);
    const step = tapeStep(expression, state, action, next);
    expression = step.expression;
    if (step.finished) finished.push(step.finished);
    state = next;
  }
  return finished;
}

describe("paper tape", () => {
  it.each([
    ["12+3=", [["12 + 3", "15"]]],
    ["2+3*4=", [["2 + 3 × 4", "14"]]],
    ["8-6/2=", [["8 − 6 ÷ 2", "5"]]],
    // A second operator replaces the first, on the tape as in the sum.
    ["2+*3=", [["2 × 3", "6"]]],
    // = again repeats the last operation, and is a calculation of its own.
    [
      "2+3==",
      [
        ["2 + 3", "5"],
        ["5 + 3", "8"],
      ],
    ],
    // A result goes on into the next calculation; a new number starts a fresh one.
    [
      "2+3=*2=4-1=",
      [
        ["2 + 3", "5"],
        ["5 × 2", "10"],
        ["4 − 1", "3"],
      ],
    ],
    // C clears the entry and keeps the sum; AC drops it.
    ["2+5c3=", [["2 + 3", "5"]]],
    ["2+5cc3=", []],
    ["200+10%=", [["200 + 20", "220"]]],
    ["1/0=", [["1 ÷ 0", "Not a number"]]],
    // = on a lone number calculates nothing.
    ["7=", []],
  ])("records %s", (keys, calculations) => {
    expect(finishedBy(keys)).toEqual(
      calculations.map(([expression, result]) => ({ expression, result })),
    );
  });

  it("records a calculation too long for the server with its start cut, never drops it", () => {
    const [long] = finishedBy(`${"1+".repeat(150)}1=`);
    expect(long?.result).toBe("151");
    const kept = bounded(long as FinishedCalculation);
    expect(kept.expression.length).toBeLessThanOrEqual(MAX_EXPRESSION);
    expect(kept.expression.startsWith("…")).toBe(true);
    expect(kept.expression.endsWith("1 + 1")).toBe(true);
    expect(kept.result).toBe("151");
    expect(bounded({ expression: "12 + 3", result: "15" })).toEqual({
      expression: "12 + 3",
      result: "15",
    });
  });
});

/** A desktop's `DesktopWindow`, as the desktop page gives it: a managed window `<app>:<id>`. */
function TestDesktopWindow({
  id,
  title,
  defaultSize,
  onClose,
  render,
}: DesktopSecondaryWindowProps) {
  return (
    <ManagedWindow
      id={`calculator:${id}`}
      app="calculator"
      title={title}
      defaultFrame={{ x: 0, y: 0, ...defaultSize }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      render={render}
    />
  );
}

let frames: (id: string) => { x: number; y: number } | undefined = () => undefined;
function Frames() {
  const store = useWindowManagerStore();
  frames = (id) => store.get(id)?.frame;
  return null;
}

function OnDesktop() {
  return (
    <WindowManager style={{ width: 1200, height: 700 }}>
      <Frames />
      <ManagedWindow
        id="calculator"
        app="calculator"
        title="Calculator"
        resizable={false}
        defaultFrame={{ x: 100, y: 80, ...app.defaultSize }}
        render={(props) => <Calculator {...props} DesktopWindow={TestDesktopWindow} />}
      />
    </WindowManager>
  );
}

interface Sent {
  method: string;
  body: unknown;
  key: string | null;
}

/** A stand-in for the Ferrite application's tape API, keeping one session's entries. */
function tapeServer(entries: FinishedCalculation[] = []) {
  const sent: Sent[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    expect(url).toBe(TAPE_URL);
    const method = init.method ?? "GET";
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = init.body ? JSON.parse(String(init.body)) : null;
    sent.push({ method, body, key: headers["idempotency-key"] ?? null });
    if (method === "POST") {
      entries.push(body);
      return Response.json({ ...body, at_ms: 1 }, { status: 201 });
    }
    if (method === "DELETE") entries.length = 0;
    return Response.json({ entries: entries.map((entry) => ({ ...entry, at_ms: 1 })) });
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, sent, entries };
}

const tapeRegion = () => screen.queryByRole("region", { name: "Paper Tape" });

/** Command-T in Calculator's window. */
const showTape = () => {
  fireEvent.keyDown(frame(), { key: "t", ctrlKey: true });
  return screen.findByRole("region", { name: "Paper Tape" });
};

describe("Calculator's paper tape on the desktop", () => {
  afterEach(() => {
    forgetDesktopValues();
    beginDesktopValues();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("starts closed, stays closed through a calculation, and comes back open once opened", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const server = tapeServer();
    const written: Record<string, unknown> = {};
    const disconnect = connectDesktopValues((key, value) => {
      written[key] = value;
    });
    const first = render(<OnDesktop />);
    const calculator = within(frame());
    for (const name of ["2", "Add", "2", "Equals"]) {
      await user.click(calculator.getByRole("button", { name }));
    }
    await waitFor(() => expect(server.entries).toEqual([{ expression: "2 + 2", result: "4" }]));
    expect(tapeRegion()).toBeNull();
    expect(written).not.toHaveProperty("calculator.tapeOpen");

    const tape = await showTape();
    expect(within(tape).getByRole("listitem")).toHaveTextContent("2 + 2= 4");
    expect(written["calculator.tapeOpen"]).toBe(true);
    await waitFor(() => expect(frame()).toHaveAttribute("data-window-state", "key"));

    first.unmount();
    render(<OnDesktop />);
    const again = await screen.findByRole("region", { name: "Paper Tape" });
    await user.click(within(again).getByRole("button", { name: "Close" }));
    expect(tapeRegion()).toBeNull();
    expect(written["calculator.tapeOpen"]).toBe(false);
    disconnect();
  });

  it("fetches nothing and opens no tape outside the Ferrite application", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<OnDesktop />);
    const calculator = within(frame());
    for (const name of ["1", "2", "Add", "3", "Equals"]) {
      await user.click(calculator.getByRole("button", { name }));
    }
    expect(display()).toHaveTextContent(/^15$/);
    expect(screen.queryByRole("region", { name: "Paper Tape" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the session's tape, records each calculation once with its own key, and clears", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const server = tapeServer([{ expression: "6 × 7", result: "42" }]);
    // Strict Mode sets the window up twice: the tape still loads once.
    render(
      <StrictMode>
        <OnDesktop />
      </StrictMode>,
    );
    const tape = await showTape();
    const lines = () =>
      within(tape)
        .queryAllByRole("listitem")
        .map((line) => line.textContent);
    await waitFor(() => expect(lines()).toEqual(["6 × 7= 42"]));
    expect(server.sent.filter((request) => request.method === "GET").length).toBeLessThanOrEqual(2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lines()).toEqual(["6 × 7= 42"]);
    // The tape opens beside Calculator, and Calculator keeps the key state.
    expect(frames("calculator:tape")).toEqual(expect.objectContaining({ x: 344, y: 80 }));
    expect(frame()).toHaveAttribute("data-window-state", "key");

    const calculator = within(frame());
    for (const name of ["1", "2", "Add", "3", "Equals", "Equals"]) {
      await user.click(calculator.getByRole("button", { name }));
    }
    await waitFor(() => expect(lines()).toEqual(["6 × 7= 42", "12 + 3= 15", "15 + 3= 18"]));
    const posts = server.sent.filter((request) => request.method === "POST");
    expect(posts.map((request) => request.body)).toEqual([
      { expression: "12 + 3", result: "15" },
      { expression: "15 + 3", result: "18" },
    ]);
    // Each calculation carries a key of its own.
    expect(posts.every((request) => request.key && request.key.length <= 128)).toBe(true);
    expect(new Set(posts.map((request) => request.key)).size).toBe(2);

    // Closed, the tape still takes the next calculation and shows it when opened, leaving Calculator key.
    await user.click(within(tape).getByRole("button", { name: "Close" }));
    expect(tapeRegion()).toBeNull();
    for (const name of ["2", "Multiply", "2", "Equals"]) {
      await user.click(calculator.getByRole("button", { name }));
    }
    await waitFor(() => expect(server.entries).toHaveLength(4));
    expect(tapeRegion()).toBeNull();
    const again = await showTape();
    await waitFor(() => expect(within(again).getAllByRole("listitem")).toHaveLength(4));
    await waitFor(() => expect(frame()).toHaveAttribute("data-window-state", "key"));

    await user.click(within(again).getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(within(again).queryAllByRole("listitem")).toHaveLength(0));
    expect(server.entries).toEqual([]);
    expect(within(again).getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("records every calculation in order, one POST at a time, with no cap", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const server = tapeServer();
    // Count the POSTs in flight at once: the tape sends the next only after a reply.
    const serve = server.fetch.getMockImplementation() as (
      url: string,
      init?: RequestInit,
    ) => Promise<Response>;
    let inFlight = 0;
    let most = 0;
    server.fetch.mockImplementation(async (url: string, init: RequestInit = {}) => {
      if (init.method !== "POST") return serve(url, init);
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      try {
        return await serve(url, init);
      } finally {
        inFlight -= 1;
      }
    });
    render(<OnDesktop />);
    const tape = await showTape();
    // One batch of keys, so one render, that finishes forty calculations.
    act(() => {
      for (let n = 1; n <= 40; n++) {
        for (const key of `${n}+1=`) fireEvent.keyDown(frame(), { key });
      }
    });
    const expected = Array.from({ length: 40 }, (_, i) => ({
      expression: `${i + 1} + 1`,
      result: String(i + 2),
    }));
    await waitFor(() => expect(server.entries).toEqual(expected), { timeout: 5000 });
    expect(most).toBe(1);
    await waitFor(() => expect(within(tape).getAllByRole("listitem")).toHaveLength(40));
    expect(within(tape).getAllByRole("listitem")[0]).toHaveTextContent("1 + 1= 2");
  });

  it("resends a POST whose reply was lost once, with the same key, then marks it unsaved", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const posts: { expression: string; key: string | null }[] = [];
    /** A reply whose body fails to arrive: a failure before it is parsed. */
    const lostBody = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new TypeError("network error"));
          },
        }),
        { status: 201 },
      );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit = {}) => {
        if ((init.method ?? "GET") === "GET") return Response.json({ entries: [] });
        const body = JSON.parse(String(init.body));
        const key = ((init.headers ?? {}) as Record<string, string>)["idempotency-key"] ?? null;
        posts.push({ expression: body.expression, key });
        // 7 + 1 loses its first reply only; 9 + 9 loses its reply, then fails to send at all.
        const tries = posts.filter((post) => post.expression === body.expression).length;
        if (body.expression === "7 + 1" && tries === 1) return lostBody();
        if (body.expression === "9 + 9") {
          if (tries === 1) return lostBody();
          throw new TypeError("Failed to fetch");
        }
        return Response.json({ ...body, at_ms: 1 }, { status: 200 });
      }),
    );
    render(<OnDesktop />);
    const tape = await showTape();
    const calculator = within(frame());
    for (const name of ["7", "Add", "1", "Equals", "9", "Add", "9", "Equals"]) {
      await user.click(calculator.getByRole("button", { name }));
    }
    const items = () => within(tape).getAllByRole("listitem");
    await waitFor(() => expect(items()[1]).toHaveAttribute("data-unsaved"), { timeout: 4000 });
    // Recovered on its one resend, and kept in its place before the next calculation.
    expect(items()[0]).toHaveTextContent("7 + 1= 8");
    expect(items()[0]).not.toHaveAttribute("data-unsaved");
    expect(items()[1]).toHaveTextContent("9 + 9= 18");
    // Each calculation was sent at most twice, both times with its own one key.
    for (const expression of ["7 + 1", "9 + 9"]) {
      const tries = posts.filter((post) => post.expression === expression);
      expect(tries).toHaveLength(2);
      expect(tries[0]?.key).toBeTruthy();
      expect(tries[1]?.key).toBe(tries[0]?.key);
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(posts).toHaveLength(4);
    error.mockRestore();
  });

  it("sends a clear once, and on failure shows the error and reloads the tape", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // The server keeps a calculation another tab saved meanwhile.
    const server = tapeServer([{ expression: "6 × 7", result: "42" }]);
    const serve = server.fetch.getMockImplementation() as (
      url: string,
      init?: RequestInit,
    ) => Promise<Response>;
    let deletes = 0;
    const keys = new Set<string>();
    server.fetch.mockImplementation(async (url: string, init: RequestInit = {}) => {
      if (init.method === "DELETE") {
        deletes += 1;
        throw new TypeError("Failed to fetch");
      }
      if (init.method === "POST") {
        // 5 + 5 is stored once by its key, but both of its replies are lost.
        const key = (init.headers as Record<string, string>)["idempotency-key"] ?? "";
        if (!keys.has(key)) {
          keys.add(key);
          await serve(url, init);
        }
        throw new TypeError("Failed to fetch");
      }
      return serve(url, init);
    });
    render(<OnDesktop />);
    const tape = await showTape();
    await waitFor(() => expect(within(tape).getAllByRole("listitem")).toHaveLength(1));
    const calculator = within(frame());
    for (const name of ["5", "Add", "5", "Equals"]) {
      await user.click(calculator.getByRole("button", { name }));
    }
    await waitFor(
      () => expect(within(tape).getAllByRole("listitem")[1]).toHaveAttribute("data-unsaved"),
      { timeout: 3000 },
    );
    server.entries.push({ expression: "1 + 1", result: "2" });
    const gets = () => server.sent.filter((request) => request.method === "GET").length;
    const before = gets();

    await user.click(within(tape).getByRole("button", { name: "Clear" }));
    expect(await within(tape).findByRole("alert")).toHaveTextContent(
      "The paper tape could not be cleared.",
    );
    // The tape shows what the server holds now, the other tab's calculation included, and the
    // calculation it stored despite the lost replies once, no longer marked unsaved.
    await waitFor(() =>
      expect(
        within(tape)
          .getAllByRole("listitem")
          .map((line) => line.textContent),
      ).toEqual(["6 × 7= 42", "5 + 5= 10", "1 + 1= 2"]),
    );
    expect(within(tape).getAllByRole("listitem")[1]).not.toHaveAttribute("data-unsaved");
    expect(gets()).toBe(before + 1);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(deletes).toBe(1);
    error.mockRestore();
  });

  it("resends a calculation with the same key once, and keeps one the server never took in its place", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const keys: (string | null)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit = {}) => {
        if ((init.method ?? "GET") === "GET") return Response.json({ entries: [] });
        const body = JSON.parse(String(init.body));
        // The server takes 2 + 2 and is down for 9 − 4.
        if (body.expression === "2 + 2") {
          return Response.json({ ...body, at_ms: 1 }, { status: 201 });
        }
        keys.push((init.headers as Record<string, string>)["idempotency-key"] ?? null);
        return new Response("down", { status: 503 });
      }),
    );
    render(<OnDesktop />);
    const tape = await showTape();
    const calculator = within(frame());
    for (const name of ["9", "Subtract", "4", "Equals", "2", "Add", "2", "Equals"]) {
      await user.click(calculator.getByRole("button", { name }));
    }
    await waitFor(
      () => expect(within(tape).getAllByRole("listitem")[0]).toHaveAttribute("data-unsaved"),
      { timeout: 3000 },
    );
    await waitFor(() =>
      expect(within(tape).getAllByRole("listitem")[1]).not.toHaveAttribute("data-unsaved"),
    );
    // Oldest first: the calculation the server never took keeps its place before the next.
    expect(
      within(tape)
        .getAllByRole("listitem")
        .map((line) => line.textContent),
    ).toEqual(["9 − 4= 5", "2 + 2= 4"]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("could not save 9 − 4 = 5"));
    error.mockRestore();
  });
});

describe("Calculator's paper tape, when a request hangs", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("gives it up at its deadline and sends it again with the same key, so the queue moves on", async () => {
    vi.useFakeTimers();
    const keys: (string | null)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit = {}) => {
        if ((init.method ?? "GET") === "GET")
          return Promise.resolve(Response.json({ entries: [] }));
        keys.push((init.headers as Record<string, string>)["idempotency-key"] ?? null);
        // The first POST is never answered: only its signal ends it.
        if (keys.length === 1) {
          return new Promise<Response>((_resolve, reject) =>
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
          );
        }
        return Promise.resolve(
          Response.json({ expression: "1 + 1", result: "2" }, { status: 201 }),
        );
      }),
    );
    const { result } = renderHook(() => useCalculatorTape(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => result.current.append({ expression: "1 + 1", result: "2" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS - 1);
    });
    expect(keys).toHaveLength(1);
    expect(result.current.lines).toEqual([expect.objectContaining({ pending: true })]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(result.current.lines).toEqual([
      { id: expect.any(String), expression: "1 + 1", result: "2" },
    ]);
  });
});
