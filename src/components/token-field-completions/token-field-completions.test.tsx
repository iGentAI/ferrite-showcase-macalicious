import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenFieldCompletions } from "./index";

const PEOPLE = ["Stephen Hackett", "Stephanie Lee", "Myke Hurley", "Federico Viticci"];

const input = () => screen.getByRole("combobox", { name: "To" }) as HTMLInputElement;
const suggestions = () => screen.queryByRole("listbox", { name: "Completions" });
const suggested = () =>
  [...(suggestions()?.querySelectorAll('[role="option"]') ?? [])].map((o) => o.textContent);
const activeOption = () => suggestions()?.querySelector('[aria-selected="true"]')?.textContent;
const tokens = () =>
  [...(screen.queryByRole("listbox", { name: "Tokens" })?.children ?? [])].map(
    (token) => token.textContent,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe("TokenFieldCompletions", () => {
  it("renders a token field whose text box is a closed combo box", () => {
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
    expect(input()).toHaveAttribute("aria-autocomplete", "list");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(input()).not.toHaveAttribute("aria-controls");
    expect(input()).not.toHaveAttribute("aria-activedescendant");
    expect(suggestions()).not.toBeInTheDocument();
    expect(input().closest(".mac-token-field")?.parentElement).toHaveClass(
      "mac-token-field-completions",
    );
  });

  it("lists the completions that contain the typed text, ignoring case, first one active", async () => {
    const user = userEvent.setup();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
    await user.type(input(), "STE");
    expect(suggested()).toEqual(["Stephen Hackett", "Stephanie Lee"]);
    expect(activeOption()).toBe("Stephen Hackett");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(input()).toHaveAttribute("aria-controls", suggestions()?.id);
    expect(input()).toHaveAttribute(
      "aria-activedescendant",
      suggestions()?.querySelector('[aria-selected="true"]')?.id,
    );
    await user.type(input(), "x");
    expect(suggestions()).not.toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves out completions that are tokens already", async () => {
    const user = userEvent.setup();
    render(
      <TokenFieldCompletions
        aria-label="To"
        completions={PEOPLE}
        defaultValue={["Stephen Hackett"]}
      />,
    );
    await user.type(input(), "ste");
    expect(suggested()).toEqual(["Stephanie Lee"]);
  });

  it("moves through the list with the arrow keys, round the ends", async () => {
    const user = userEvent.setup();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
    await user.type(input(), "ste");
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe("Stephanie Lee");
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe("Stephen Hackett");
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toBe("Stephanie Lee");
    expect(input()).toHaveFocus();
    expect(input()).toHaveValue("ste");
  });

  it("takes the active completion on Return: one token, no text, no list, no submission", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TokenFieldCompletions aria-label="To" completions={PEOPLE} onValueChange={onValueChange} />
        <button type="submit">Send</button>
      </form>,
    );
    await user.type(input(), "ste{ArrowDown}{Enter}");
    expect(tokens()).toEqual(["Stephanie Lee"]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(["Stephanie Lee"]);
    expect(input()).toHaveValue("");
    expect(input()).toHaveFocus();
    expect(suggestions()).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("takes a completion on a click and keeps the keyboard in the text box", async () => {
    const user = userEvent.setup();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
    await user.type(input(), "ste");
    await user.click(screen.getByRole("option", { name: "Stephanie Lee" }));
    expect(tokens()).toEqual(["Stephanie Lee"]);
    expect(input()).toHaveValue("");
    expect(input()).toHaveFocus();
    expect(suggestions()).not.toBeInTheDocument();
  });

  it("makes the completion under a moving pointer the active one", async () => {
    const user = userEvent.setup();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
    await user.type(input(), "ste");
    fireEvent.mouseMove(screen.getByRole("option", { name: "Stephanie Lee" }));
    expect(activeOption()).toBe("Stephanie Lee");
    await user.keyboard("{Enter}");
    expect(tokens()).toEqual(["Stephanie Lee"]);
  });

  it("dismisses the list on Escape; Return then makes a token of the typed text", async () => {
    const user = userEvent.setup();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
    await user.type(input(), "ste{Escape}");
    expect(suggestions()).not.toBeInTheDocument();
    expect(input()).toHaveValue("ste");
    await user.keyboard("{Enter}");
    expect(tokens()).toEqual(["ste"]);
    await user.type(input(), "my");
    expect(suggested()).toEqual(["Myke Hurley"]);
  });

  it("leaves Escape alone while there is no list", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: stands for a dialog that closes on Escape
      <div onKeyDown={(event) => onKeyDown(event.key, event.defaultPrevented)}>
        <TokenFieldCompletions aria-label="To" completions={PEOPLE} />
      </div>,
    );
    await user.type(input(), "zz{Escape}");
    expect(onKeyDown).toHaveBeenLastCalledWith("Escape", false);
    await user.clear(input());
    await user.type(input(), "ste{Escape}");
    expect(onKeyDown).toHaveBeenLastCalledWith("Escape", true);
  });

  it("still ends a token at a tokenizing character, and closes the list", async () => {
    const user = userEvent.setup();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
    await user.type(input(), "ste,");
    expect(tokens()).toEqual(["ste"]);
    expect(suggestions()).not.toBeInTheDocument();
  });

  it("adds a completion whole, tokenizing characters included", async () => {
    const user = userEvent.setup();
    render(<TokenFieldCompletions aria-label="To" completions={["Hackett, Stephen"]} />);
    await user.type(input(), "hack{Enter}");
    expect(tokens()).toEqual(["Hackett, Stephen"]);
  });

  it("closes the list when the field loses the keyboard; the typed text becomes a token", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TokenFieldCompletions aria-label="To" completions={PEOPLE} />
        <button type="button">Next</button>
      </>,
    );
    await user.type(input(), "ste");
    await user.tab();
    expect(suggestions()).not.toBeInTheDocument();
    expect(tokens()).toEqual(["ste"]);
  });

  it("waits for completionDelay after the last keystroke before it shows the list", () => {
    vi.useFakeTimers();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} completionDelay={300} />);
    fireEvent.change(input(), { target: { value: "s" } });
    act(() => void vi.advanceTimersByTime(200));
    expect(suggestions()).not.toBeInTheDocument();
    // Another keystroke starts the wait again.
    fireEvent.change(input(), { target: { value: "st" } });
    act(() => void vi.advanceTimersByTime(299));
    expect(suggestions()).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(suggested()).toEqual(["Stephen Hackett", "Stephanie Lee"]);
    // The list goes while the next wait runs: it would show completions of the old text.
    fireEvent.change(input(), { target: { value: "ste" } });
    expect(suggestions()).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(300));
    expect(suggested()).toEqual(["Stephen Hackett", "Stephanie Lee"]);
  });

  it("shows no list after the delay when the field has lost the keyboard meanwhile", () => {
    vi.useFakeTimers();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} completionDelay={300} />);
    fireEvent.change(input(), { target: { value: "ste" } });
    fireEvent.blur(input());
    act(() => void vi.advanceTimersByTime(300));
    expect(suggestions()).not.toBeInTheDocument();
  });

  it("asks a completions function with the text and the tokens, and shows what it returns", async () => {
    const user = userEvent.setup();
    const complete = vi.fn((text: string, _tokens: readonly string[]) => [`${text}@example.com`]);
    render(<TokenFieldCompletions aria-label="To" completions={complete} defaultValue={["a"]} />);
    await user.type(input(), " bo ");
    expect(complete).toHaveBeenLastCalledWith("bo", ["a"]);
    expect(suggested()).toEqual(["bo@example.com"]);
    await user.keyboard("{Enter}");
    expect(tokens()).toEqual(["a", "bo@example.com"]);
  });

  it("shows what it is given when controlled and changes only through onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TokenFieldCompletions
        aria-label="To"
        completions={PEOPLE}
        value={["Myke Hurley"]}
        onValueChange={onValueChange}
      />,
    );
    await user.type(input(), "ste{Enter}");
    expect(onValueChange).toHaveBeenCalledWith(["Myke Hurley", "Stephen Hackett"]);
    expect(tokens()).toEqual(["Myke Hurley"]);
  });

  it("follows a controlled owner", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <TokenFieldCompletions
          aria-label="To"
          completions={PEOPLE}
          value={value}
          onValueChange={setValue}
        />
      );
    }
    render(<Owner />);
    await user.type(input(), "ste{Enter}fed{Enter}");
    expect(tokens()).toEqual(["Stephen Hackett", "Federico Viticci"]);
    await user.keyboard("{Backspace}{Backspace}");
    expect(tokens()).toEqual(["Stephen Hackett"]);
  });

  it("restores its default tokens when the form is reset, unless the reset is cancelled", async () => {
    const user = userEvent.setup();
    let cancel = true;
    render(
      <form onReset={(event) => cancel && event.preventDefault()}>
        <TokenFieldCompletions
          aria-label="To"
          name="to"
          completions={PEOPLE}
          defaultValue={["Myke Hurley"]}
        />
        <button type="reset">Reset</button>
      </form>,
    );
    await user.type(input(), "ste{Enter}");
    expect(tokens()).toEqual(["Myke Hurley", "Stephen Hackett"]);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(tokens()).toEqual(["Myke Hurley", "Stephen Hackett"]);
    cancel = false;
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(tokens()).toEqual(["Myke Hurley"]);
  });

  it("moves the keyboard from a token to the text box when the form is reset", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <TokenFieldCompletions
          aria-label="To"
          completions={PEOPLE}
          defaultValue={["Myke Hurley"]}
        />
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    const option = (name: string) =>
      within(screen.getByRole("listbox", { name: "Tokens" })).getByRole("option", { name });
    // A token that the reset removes.
    await user.type(input(), "ste{Enter}");
    act(() => option("Stephen Hackett").focus());
    expect(option("Stephen Hackett")).toHaveAttribute("aria-selected", "true");
    act(() => form.reset());
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(tokens()).toEqual(["Myke Hurley"]);
    expect(input()).toHaveFocus();
    // A token that survives it is no longer selected.
    act(() => option("Myke Hurley").focus());
    expect(option("Myke Hurley")).toHaveAttribute("aria-selected", "true");
    act(() => form.reset());
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(input()).toHaveFocus();
    expect(option("Myke Hurley")).toHaveAttribute("aria-selected", "false");
  });

  it("follows a change of the form attribute: the new form's reset drops the list and restores the tokens", async () => {
    const user = userEvent.setup();
    const view = (form: string) => (
      <>
        <form id="completions-first" data-testid="first" />
        <form id="completions-second" data-testid="second" />
        <TokenFieldCompletions
          aria-label="To"
          form={form}
          completions={PEOPLE}
          defaultValue={["Myke Hurley"]}
        />
      </>
    );
    const { rerender } = render(view("completions-first"));
    await user.type(input(), "ste{Enter}ste");
    expect(tokens()).toEqual(["Myke Hurley", "Stephen Hackett"]);
    expect(suggestions()).toBeInTheDocument();
    rerender(view("completions-second"));
    act(() => (screen.getByTestId("first") as HTMLFormElement).reset());
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(tokens()).toEqual(["Myke Hurley", "Stephen Hackett"]);
    expect(suggestions()).toBeInTheDocument();
    act(() => (screen.getByTestId("second") as HTMLFormElement).reset());
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(tokens()).toEqual(["Myke Hurley"]);
    expect(suggestions()).not.toBeInTheDocument();
  });

  it("drops the list when the form is reset while the field keeps the keyboard", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <TokenFieldCompletions aria-label="To" completions={PEOPLE} />
      </form>,
    );
    await user.type(input(), "ste");
    expect(suggested()).toHaveLength(2);
    act(() => (container.querySelector("form") as HTMLFormElement).reset());
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(input()).toHaveFocus();
    expect(input()).toHaveValue("");
    expect(suggestions()).not.toBeInTheDocument();
    // Return has no stale completion to take.
    await user.keyboard("{Enter}");
    expect(tokens()).toEqual([]);
  });

  it("drops a list that was still waiting for its delay when the form is reset", () => {
    vi.useFakeTimers();
    const { container } = render(
      <form>
        <TokenFieldCompletions aria-label="To" completions={PEOPLE} completionDelay={300} />
      </form>,
    );
    fireEvent.change(input(), { target: { value: "ste" } });
    act(() => (container.querySelector("form") as HTMLFormElement).reset());
    act(() => void vi.advanceTimersByTime(300));
    expect(suggestions()).not.toBeInTheDocument();
  });

  it("drops the list of a controlled field when the form is reset, and leaves its tokens", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <TokenFieldCompletions
          aria-label="To"
          completions={PEOPLE}
          value={["Myke Hurley"]}
          onValueChange={() => {}}
        />
      </form>,
    );
    await user.type(input(), "ste");
    act(() => (container.querySelector("form") as HTMLFormElement).reset());
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(suggestions()).not.toBeInTheDocument();
    expect(tokens()).toEqual(["Myke Hurley"]);
  });

  it("moves the list with the text box when the field is resized without a render", async () => {
    const user = userEvent.setup();
    const observed: Element[] = [];
    let resized: (() => void) | undefined;
    let disconnected = false;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {
          disconnected = true;
        }
      },
    );
    try {
      render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
      await user.type(input(), "ste");
      const list = suggestions() as HTMLElement;
      expect(observed).toEqual([input(), input().parentElement]);
      // The tokens wrap: the text box is now on a second line.
      Object.defineProperties(input(), {
        offsetLeft: { configurable: true, value: 12 },
        offsetTop: { configurable: true, value: 23 },
        offsetHeight: { configurable: true, value: 19 },
      });
      resized?.();
      expect(list.style.left).toBe("12px");
      expect(list.style.top).toBe("42px");
      await user.keyboard("{Escape}");
      expect(disconnected).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("submits tokens and taken completions under its name", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <TokenFieldCompletions
          aria-label="To"
          name="to"
          completions={PEOPLE}
          defaultValue={["Myke Hurley"]}
        />
      </form>,
    );
    await user.type(input(), "ste{Enter}");
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).get("to")).toBe("Myke Hurley,Stephen Hackett");
  });

  it("suggests nothing in a read-only field", () => {
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} readOnly />);
    fireEvent.change(input(), { target: { value: "ste" } });
    expect(suggestions()).not.toBeInTheDocument();
    expect(input()).toHaveAttribute("readonly");
  });

  it("is really disabled", () => {
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} disabled />);
    expect(input()).toBeDisabled();
    expect(suggestions()).not.toBeInTheDocument();
  });

  it("does not complete text an input method is still composing, and leaves it Return", () => {
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} />);
    fireEvent.compositionStart(input());
    fireEvent.input(input(), { target: { value: "ste" }, isComposing: true });
    expect(suggestions()).not.toBeInTheDocument();
    fireEvent.compositionEnd(input());
    expect(suggested()).toEqual(["Stephen Hackett", "Stephanie Lee"]);
    // The Return that confirms a candidate arrives as key code 229 in Safari.
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 });
    expect(tokens()).toEqual([]);
    expect(suggested()).toHaveLength(2);
  });

  it("drops an open list, and one still waiting for its delay, when a composition starts", async () => {
    const user = userEvent.setup();
    const onCompositionStart = vi.fn();
    const { unmount } = render(
      <TokenFieldCompletions
        aria-label="To"
        completions={PEOPLE}
        onCompositionStart={onCompositionStart}
      />,
    );
    await user.type(input(), "ste");
    expect(suggested()).toHaveLength(2);
    fireEvent.compositionStart(input());
    expect(onCompositionStart).toHaveBeenCalledTimes(1);
    expect(suggestions()).not.toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-expanded", "false");
    // Return is the input method's and has no completion to take.
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(tokens()).toEqual([]);
    fireEvent.compositionEnd(input());
    expect(suggested()).toHaveLength(2);
    unmount();

    vi.useFakeTimers();
    render(<TokenFieldCompletions aria-label="To" completions={PEOPLE} completionDelay={300} />);
    fireEvent.change(input(), { target: { value: "ste" } });
    fireEvent.compositionStart(input());
    act(() => void vi.advanceTimersByTime(300));
    expect(suggestions()).not.toBeInTheDocument();
  });

  it("leaves a key to a handler that prevents it", async () => {
    const user = userEvent.setup();
    render(
      <TokenFieldCompletions
        aria-label="To"
        completions={PEOPLE}
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
      />,
    );
    await user.type(input(), "ste{Enter}");
    expect(tokens()).toEqual([]);
    expect(suggested()).toHaveLength(2);
  });

  it("names the list with completionsLabel", async () => {
    const user = userEvent.setup();
    render(
      <TokenFieldCompletions aria-label="To" completions={PEOPLE} completionsLabel="People" />,
    );
    await user.type(input(), "ste");
    expect(screen.getByRole("listbox", { name: "People" })).toBeInTheDocument();
  });

  it("calls the caller's own handlers as the token field does", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <TokenFieldCompletions
        aria-label="To"
        completions={PEOPLE}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );
    await user.type(input(), "st");
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("sends ref, className and style to the root and everything else to the token field", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <TokenFieldCompletions
        aria-label="To"
        completions={PEOPLE}
        ref={ref}
        inputRef={inputRef}
        className="extra"
        style={{ width: 300 }}
        id="to"
        placeholder="Name"
        tokenStyle="squared"
        bordered={false}
      />,
    );
    expect(ref.current).toHaveClass("mac-token-field-completions", "extra");
    expect(ref.current).toHaveStyle({ width: "300px" });
    expect(inputRef.current).toBe(input());
    expect(input()).toHaveAttribute("id", "to");
    expect(input()).toHaveAttribute("placeholder", "Name");
    const field = ref.current?.querySelector(".mac-token-field");
    expect(field).toHaveAttribute("data-token-style", "squared");
    expect(field).not.toHaveAttribute("data-bordered");
  });
});
