import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TokenField } from "./index";

const input = () => screen.getByRole("textbox", { name: "Tags" }) as HTMLInputElement;
const names = () =>
  screen.queryAllByRole("option", { hidden: false }).map((option) => option.textContent);

describe("TokenField", () => {
  it("renders an input in a bezel, with no list while there are no tokens", () => {
    render(<TokenField aria-label="Tags" />);
    const root = input().parentElement as HTMLElement;
    expect(root).toHaveClass("mac-token-field");
    expect(root).toHaveAttribute("data-token-style", "rounded");
    expect(root).toHaveAttribute("data-bordered");
    expect(root).not.toHaveAttribute("data-disabled");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows its tokens as options of a named list box", () => {
    render(
      <TokenField aria-label="Tags" tokensLabel="Chosen tags" defaultValue={["Work", "Travel"]} />,
    );
    const list = screen.getByRole("listbox", { name: "Chosen tags" });
    expect(within(list).getAllByRole("option")).toHaveLength(2);
    expect(names()).toEqual(["Work", "Travel"]);
  });

  it("reflects tokenStyle and bordered on the root", () => {
    render(<TokenField aria-label="Tags" tokenStyle="squared" bordered={false} />);
    const root = input().parentElement as HTMLElement;
    expect(root).toHaveAttribute("data-token-style", "squared");
    expect(root).not.toHaveAttribute("data-bordered");
  });

  it("turns typed text into a token at a comma and keeps the rest", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TokenField aria-label="Tags" onValueChange={onValueChange} />);
    await user.type(input(), "Work,Tra");
    expect(names()).toEqual(["Work"]);
    expect(input()).toHaveValue("Tra");
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(["Work"]);
  });

  it("turns typed text into a token on Return without submitting the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TokenField aria-label="Tags" />
        <button type="submit">Save</button>
      </form>,
    );
    await user.type(input(), "Work{Enter}");
    expect(names()).toEqual(["Work"]);
    expect(input()).toHaveValue("");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("turns typed text into a token when the field loses the keyboard", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" />);
    await user.type(input(), "Work");
    await user.tab();
    expect(names()).toEqual(["Work"]);
  });

  it("splits pasted text at every tokenizing character and drops empty pieces", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" tokenizingCharacters=",;" />);
    await user.click(input());
    await user.paste("Work; Travel,, Fam");
    expect(names()).toEqual(["Work", "Travel"]);
    expect(input()).toHaveValue("Fam");
  });

  it("selects the last token with Backspace in an empty field and deletes it with the next", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TokenField
        aria-label="Tags"
        defaultValue={["Work", "Travel"]}
        onValueChange={onValueChange}
      />,
    );
    await user.click(input());
    await user.keyboard("{Backspace}");
    expect(screen.getByRole("option", { name: "Travel" })).toHaveFocus();
    expect(names()).toEqual(["Work", "Travel"]);
    await user.keyboard("{Backspace}");
    expect(names()).toEqual(["Work"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["Work"]);
    expect(screen.getByRole("option", { name: "Work" })).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(names()).toEqual([]);
    expect(input()).toHaveFocus();
  });

  it("does not leave the text for a token while the caret is inside the text", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" defaultValue={["Work"]} />);
    await user.type(input(), "ab");
    await user.keyboard("{Backspace}");
    expect(input()).toHaveFocus();
    expect(input()).toHaveValue("a");
  });

  it("moves between tokens and the text with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" defaultValue={["Work", "Travel", "Family"]} />);
    await user.click(input());
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("option", { name: "Family" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("option", { name: "Work" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("option", { name: "Travel" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("option", { name: "Work" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(input()).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowRight}");
    expect(input()).toHaveFocus();
  });

  it("deletes the selected token with Delete and selects the one after", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" defaultValue={["Work", "Travel", "Family"]} />);
    await user.click(screen.getByRole("option", { name: "Travel" }));
    expect(screen.getByRole("option", { name: "Travel" })).toHaveFocus();
    await user.keyboard("{Delete}");
    expect(names()).toEqual(["Work", "Family"]);
    expect(screen.getByRole("option", { name: "Family" })).toHaveFocus();
  });

  it("sends typing on a selected token to the text, character included", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TokenField aria-label="Tags" defaultValue={["Work"]} onChange={onChange} />);
    await user.click(screen.getByRole("option", { name: "Work" }));
    await user.keyboard("x");
    expect(input()).toHaveFocus();
    expect(input()).toHaveValue("x");
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.keyboard("y");
    expect(input()).toHaveValue("xy");
    expect(names()).toEqual(["Work"]);
  });

  it("does not type into a read-only field from a selected token", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" readOnly defaultValue={["Work"]} />);
    await user.click(screen.getByRole("option", { name: "Work" }));
    await user.keyboard("x");
    expect(input()).toHaveValue("");
  });

  it("keeps a selected token and the focus when a controlled owner refuses the removal", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TokenField aria-label="Tags" value={["Work", "Travel"]} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("option", { name: "Travel" }));
    await user.keyboard("{Backspace}");
    expect(onValueChange).toHaveBeenLastCalledWith(["Work"]);
    expect(names()).toEqual(["Work", "Travel"]);
    expect(screen.getByRole("option", { name: "Travel" })).toHaveFocus();
    expect(screen.getByRole("option", { name: "Travel" })).toHaveAttribute("aria-selected", "true");
  });

  it("does not type past the text's maxLength from a selected token", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" maxLength={1} defaultValue={["Work"]} />);
    await user.click(screen.getByRole("option", { name: "Work" }));
    await user.keyboard("xy");
    expect(input()).toHaveValue("x");
  });

  it("swallows Space on a selected token that has no menu", () => {
    render(<TokenField aria-label="Tags" defaultValue={["Work"]} />);
    const work = screen.getByRole("option", { name: "Work" });
    work.focus();
    expect(fireEvent.keyDown(work, { key: " " })).toBe(false);
    expect(work).toHaveFocus();
    expect(input()).toHaveValue("");
  });

  it("leaves the Return that Safari sends after a composition to the input method", () => {
    render(<TokenField aria-label="Tags" />);
    fireEvent.change(input(), { target: { value: "ni" } });
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 });
    expect(names()).toEqual([]);
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 13 });
    expect(names()).toEqual(["ni"]);
  });

  it("marks the focused token as selected for assistive technology, and no other", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" defaultValue={["Work", "Travel"]} />);
    const selected = () =>
      screen.getAllByRole("option").map((option) => option.getAttribute("aria-selected"));
    expect(selected()).toEqual(["false", "false"]);
    await user.click(input());
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toEqual(["false", "true"]);
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toEqual(["true", "false"]);
    await user.keyboard("{End}");
    expect(input()).toHaveFocus();
    expect(selected()).toEqual(["false", "false"]);
  });

  it("keeps the selection state right while tokens are deleted", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" defaultValue={["Work", "Travel", "Family"]} />);
    const selected = () =>
      screen.queryAllByRole("option").map((option) => option.getAttribute("aria-selected"));
    await user.click(screen.getByRole("option", { name: "Travel" }));
    await user.keyboard("{Delete}");
    expect(selected()).toEqual(["false", "true"]);
    await user.keyboard("{Delete}");
    expect(input()).toHaveFocus();
    expect(selected()).toEqual(["false"]);
    await user.type(input(), "Photos,");
    expect(selected()).toEqual(["false", "false"]);
  });

  it("does not tokenise text an input method is still composing", () => {
    const onValueChange = vi.fn();
    render(<TokenField aria-label="Tags" onValueChange={onValueChange} />);
    fireEvent.compositionStart(input());
    fireEvent.change(input(), { target: { value: "ni," } });
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(names()).toEqual([]);
    expect(input()).toHaveValue("ni,");
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.change(input(), { target: { value: "你," } });
    fireEvent.compositionEnd(input());
    expect(names()).toEqual(["你"]);
    expect(input()).toHaveValue("");
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(["你"]);
  });

  it("leaves Return to the input method while it composes", () => {
    render(<TokenField aria-label="Tags" />);
    fireEvent.compositionStart(input());
    fireEvent.change(input(), { target: { value: "ni" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(names()).toEqual([]);
    fireEvent.compositionEnd(input());
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(names()).toEqual(["ni"]);
  });

  it("is satisfied as a required field by a token, and asks for one without", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <TokenField aria-label="Tags" name="tags" required />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(input()).toBeRequired();
    expect(form.checkValidity()).toBe(false);
    await user.type(input(), "Work,");
    expect(input()).toHaveValue("");
    expect(input()).toHaveAttribute("aria-required", "true");
    expect(input()).not.toHaveAttribute("required");
    expect(form.checkValidity()).toBe(true);
    await user.keyboard("{Backspace}{Backspace}");
    expect(names()).toEqual([]);
    expect(form.checkValidity()).toBe(false);
  });

  it("restores its default tokens when the form is reset", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <TokenField aria-label="Tags" name="tags" defaultValue={["Work"]} />
        <button type="reset">Reset</button>
      </form>,
    );
    await user.type(input(), "Travel,dra");
    await user.click(input());
    expect(names()).toEqual(["Work", "Travel"]);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(names()).toEqual(["Work"]));
    expect(input()).toHaveValue("");
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.getAll("tags")).toEqual(["Work"]);
  });

  it("shows what it is given when controlled and changes only through onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <TokenField aria-label="Tags" value={["Work"]} onValueChange={onValueChange} />,
    );
    await user.type(input(), "Travel,");
    expect(onValueChange).toHaveBeenLastCalledWith(["Work", "Travel"]);
    expect(names()).toEqual(["Work"]);
    rerender(
      <TokenField aria-label="Tags" value={["Work", "Travel"]} onValueChange={onValueChange} />,
    );
    expect(names()).toEqual(["Work", "Travel"]);
  });

  it("follows a controlled list through deletions", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [tokens, setTokens] = useState(["Work", "Travel"]);
      return <TokenField aria-label="Tags" value={tokens} onValueChange={setTokens} />;
    }
    render(<Controlled />);
    await user.click(input());
    await user.keyboard("{Backspace}{Backspace}");
    expect(names()).toEqual(["Work"]);
  });

  it("asks for a token's menu from its chevron, Space and Down Arrow", async () => {
    const user = userEvent.setup();
    const onTokenMenu = vi.fn();
    render(
      <TokenField
        aria-label="Tags"
        tokenMenu
        defaultValue={["Work", "Travel"]}
        onTokenMenu={onTokenMenu}
      />,
    );
    const travel = screen.getByRole("option", { name: "Travel" });
    await user.click(travel.querySelector(".mac-token-field-token-menu") as Element);
    expect(onTokenMenu).toHaveBeenLastCalledWith("Travel", 1, travel);
    await user.keyboard("{ArrowLeft} ");
    expect(onTokenMenu).toHaveBeenLastCalledWith(
      "Work",
      0,
      screen.getByRole("option", { name: "Work" }),
    );
    await user.keyboard("{ArrowDown}");
    expect(onTokenMenu).toHaveBeenCalledTimes(3);
  });

  it("draws no chevron and asks for no menu without tokenMenu", async () => {
    const user = userEvent.setup();
    const onTokenMenu = vi.fn();
    render(<TokenField aria-label="Tags" defaultValue={["Work"]} onTokenMenu={onTokenMenu} />);
    const work = screen.getByRole("option", { name: "Work" });
    expect(work.querySelector(".mac-token-field-token-menu")).toBeNull();
    await user.click(work);
    await user.keyboard(" ");
    expect(onTokenMenu).not.toHaveBeenCalled();
  });

  it("is really disabled: nothing takes the keyboard and nothing is removed", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TokenField
        aria-label="Tags"
        disabled
        defaultValue={["Work"]}
        onValueChange={onValueChange}
      />,
    );
    expect(input()).toBeDisabled();
    expect(input().parentElement).toHaveAttribute("data-disabled");
    await user.tab();
    expect(input()).not.toHaveFocus();
    await user.click(screen.getByRole("option", { name: "Work" }));
    expect(screen.getByRole("option", { name: "Work" })).not.toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("lets a read-only field's tokens be selected but not removed or added", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TokenField
        aria-label="Tags"
        readOnly
        defaultValue={["Work"]}
        onValueChange={onValueChange}
      />,
    );
    await user.click(screen.getByRole("option", { name: "Work" }));
    await user.keyboard("{Backspace}{Delete}");
    expect(names()).toEqual(["Work"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("submits the tokens under its name, joined by the first tokenizing character", () => {
    render(
      <form data-testid="form">
        <TokenField aria-label="Tags" name="tags" defaultValue={["Work", "Travel"]} />
      </form>,
    );
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.getAll("tags")).toEqual(["Work,Travel"]);
  });

  it("submits its tokens with the form that the form attribute names, and with no other", () => {
    render(
      <>
        <form id="token-field-outer" data-testid="named" />
        <form data-testid="around">
          <TokenField
            aria-label="Tags"
            name="tags"
            form="token-field-outer"
            defaultValue={["Work", "Travel"]}
          />
        </form>
      </>,
    );
    expect(input()).toHaveAttribute("form", "token-field-outer");
    const named = new FormData(screen.getByTestId("named") as HTMLFormElement);
    expect(named.getAll("tags")).toEqual(["Work,Travel"]);
    const around = new FormData(screen.getByTestId("around") as HTMLFormElement);
    expect(around.has("tags")).toBe(false);
  });

  it("follows a change of the form attribute: the new form's reset restores it, the old one's does not", async () => {
    const user = userEvent.setup();
    const view = (form: string) => (
      <>
        <form id="token-field-first" data-testid="first" />
        <form id="token-field-second" data-testid="second" />
        <TokenField aria-label="Tags" name="tags" form={form} defaultValue={["Work"]} />
      </>
    );
    const { rerender } = render(view("token-field-first"));
    await user.type(input(), "Travel,");
    expect(names()).toEqual(["Work", "Travel"]);
    rerender(view("token-field-second"));
    (screen.getByTestId("first") as HTMLFormElement).reset();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(names()).toEqual(["Work", "Travel"]);
    (screen.getByTestId("second") as HTMLFormElement).reset();
    await waitFor(() => expect(names()).toEqual(["Work"]));
  });

  it("hands the keyboard to the text when a reset leaves a token that had it", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <TokenField aria-label="Tags" defaultValue={["Work", "Travel"]} />
      </form>,
    );
    await user.click(input());
    await user.keyboard("{ArrowLeft}");
    const last = screen.getAllByRole("option")[1] as HTMLElement;
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute("aria-selected", "true");
    (screen.getByTestId("form") as HTMLFormElement).reset();
    await waitFor(() => expect(input()).toHaveFocus());
    expect(names()).toEqual(["Work", "Travel"]);
    for (const option of screen.getAllByRole("option")) {
      expect(option).toHaveAttribute("aria-selected", "false");
    }
  });

  it("answers no token key once the field is disabled while a token has the keyboard", async () => {
    const user = userEvent.setup();
    const onTokenMenu = vi.fn();
    const onValueChange = vi.fn();
    const view = (disabled: boolean) => (
      <TokenField
        aria-label="Tags"
        tokenMenu
        onTokenMenu={onTokenMenu}
        onValueChange={onValueChange}
        disabled={disabled}
        defaultValue={["Work", "Travel"]}
      />
    );
    const { rerender } = render(view(false));
    await user.click(input());
    await user.keyboard("{ArrowLeft}");
    const last = screen.getAllByRole("option")[1] as HTMLElement;
    expect(last).toHaveFocus();
    await user.keyboard(" ");
    expect(onTokenMenu).toHaveBeenCalledTimes(1);
    rerender(view(true));
    fireEvent.keyDown(last, { key: " " });
    fireEvent.keyDown(last, { key: "ArrowDown" });
    fireEvent.keyDown(last, { key: "Backspace" });
    expect(onTokenMenu).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(names()).toEqual(["Work", "Travel"]);
  });

  it("keeps its tokens when another handler cancels the form's reset", async () => {
    const user = userEvent.setup();
    render(
      <form onReset={(event) => event.preventDefault()}>
        <TokenField aria-label="Tags" defaultValue={["Work"]} />
        <button type="reset">Reset</button>
      </form>,
    );
    await user.type(input(), "Travel,");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(names()).toEqual(["Work", "Travel"]);
  });

  it("leaves Return to a handler that prevents it, as a completion list does", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
      if (event.key === "Enter") event.preventDefault();
    });
    render(<TokenField aria-label="Tags" onKeyDown={onKeyDown} />);
    await user.type(input(), "St{Enter}");
    expect(names()).toEqual([]);
    expect(input()).toHaveValue("St");
  });

  it("focuses the input when the bezel itself is pressed", async () => {
    const user = userEvent.setup();
    render(<TokenField aria-label="Tags" defaultValue={["Work"]} />);
    await user.click(input().parentElement as HTMLElement);
    expect(input()).toHaveFocus();
  });

  it("sends ref, className and style to the root and everything else to the input", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <TokenField
        ref={ref}
        inputRef={inputRef}
        className="wide"
        style={{ width: 300 }}
        id="tags"
        placeholder="Add tags"
        aria-label="Tags"
      />,
    );
    expect(inputRef.current).toBe(input());
    expect(input()).toHaveAttribute("id", "tags");
    expect(input()).toHaveAttribute("placeholder", "Add tags");
    expect(ref.current).toBe(input().parentElement);
    expect(ref.current).toHaveClass("mac-token-field", "wide");
    expect(ref.current).toHaveStyle({ width: "300px" });
  });
});
