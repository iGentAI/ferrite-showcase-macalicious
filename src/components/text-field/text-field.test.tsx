import { Field } from "@base-ui/react/field";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TextField, TextFieldBezel } from "./index";

describe("TextFieldBezel", () => {
  it("draws the text field's bezel around its children, with no input of its own", () => {
    render(
      <TextFieldBezel data-testid="bezel">
        <span role="spinbutton" aria-label="Day" aria-valuenow={2} tabIndex={0}>
          2
        </span>
      </TextFieldBezel>,
    );
    const bezel = screen.getByTestId("bezel");
    expect(bezel).toHaveClass("mac-text-field");
    expect(bezel).toHaveAttribute("data-bezel", "square");
    expect(bezel).toHaveAttribute("data-size", "regular");
    expect(bezel).not.toHaveAttribute("data-disabled");
    expect(bezel).not.toHaveAttribute("data-focus-ring");
    expect(bezel).toContainElement(screen.getByRole("spinbutton", { name: "Day" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("reflects bezel, size, disabled and focusRing on the element", () => {
    render(
      <TextFieldBezel
        data-testid="bezel"
        bezel="rounded"
        size="small"
        disabled
        focusRing={false}
      />,
    );
    const bezel = screen.getByTestId("bezel");
    expect(bezel).toHaveAttribute("data-bezel", "rounded");
    expect(bezel).toHaveAttribute("data-size", "small");
    expect(bezel).toHaveAttribute("data-disabled");
    expect(bezel).toHaveAttribute("data-focus-ring", "none");
  });

  it("forwards ref, className, style and every other prop to the element", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClick = vi.fn();
    render(
      <TextFieldBezel
        ref={ref}
        className="extra"
        style={{ width: 90 }}
        role="group"
        aria-label="Date"
        onClick={onClick}
      />,
    );
    const bezel = screen.getByRole("group", { name: "Date" });
    expect(ref.current).toBe(bezel);
    expect(bezel).toHaveClass("mac-text-field", "extra");
    expect(bezel).toHaveStyle({ width: "90px" });
    await user.click(bezel);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("TextField", () => {
  it("renders a text input inside the bezel with the default attributes", () => {
    render(<TextField aria-label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    const root = input.parentElement as HTMLElement;
    expect(input.tagName).toBe("INPUT");
    expect(root).toHaveClass("mac-text-field");
    expect(root).toHaveAttribute("data-bezel", "square");
    expect(root).toHaveAttribute("data-size", "regular");
    expect(root).not.toHaveAttribute("data-disabled");
  });

  it("reflects bezel and size on the root", () => {
    render(<TextField aria-label="Name" bezel="rounded" size="small" />);
    const root = screen.getByRole("textbox").parentElement as HTMLElement;
    expect(root).toHaveAttribute("data-bezel", "rounded");
    expect(root).toHaveAttribute("data-size", "small");
  });

  it("draws the capsule bezel around the input and a button given as its child", async () => {
    const onClick = vi.fn();
    render(
      <TextField bezel="capsule" aria-label="Message" placeholder="iMessage">
        <button type="button" aria-label="Emoji" onClick={onClick} />
      </TextField>,
    );
    const input = screen.getByRole("textbox", { name: "Message" });
    const root = input.parentElement as HTMLElement;
    expect(root).toHaveAttribute("data-bezel", "capsule");
    const emoji = screen.getByRole("button", { name: "Emoji" });
    expect(root).toContainElement(emoji);
    expect(input.compareDocumentPosition(emoji) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.type(input, "Hello");
    expect(input).toHaveValue("Hello");
    await userEvent.click(emoji);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // What a disabled capsule looks like (its fill kept, its edge dimmed) is checked in a browser:
  // the capsule-disabled comparisons of text-field.visual.json.
  it("marks a disabled capsule on its root and disables its input", () => {
    render(<TextField bezel="capsule" aria-label="Message" disabled defaultValue="Hello" />);
    const input = screen.getByRole("textbox", { name: "Message" });
    const root = input.parentElement as HTMLElement;
    expect(root).toHaveAttribute("data-bezel", "capsule");
    expect(root).toHaveAttribute("data-disabled");
    expect(input).toBeDisabled();
  });

  it("takes typed text when uncontrolled and reports each change", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TextField aria-label="Name" defaultValue="ab" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "c");
    expect(input).toHaveValue("abc");
    expect(onValueChange).toHaveBeenLastCalledWith("abc", expect.anything());
  });

  it("shows the value it is given when controlled", async () => {
    const user = userEvent.setup();
    function Upper() {
      const [value, setValue] = useState("");
      return (
        <TextField
          aria-label="Name"
          value={value}
          onValueChange={(v) => setValue(v.toUpperCase())}
        />
      );
    }
    render(<Upper />);
    await user.type(screen.getByRole("textbox"), "mac");
    expect(screen.getByRole("textbox")).toHaveValue("MAC");
  });

  it("is in the tab order and takes the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <>
        <TextField aria-label="First" />
        <TextField aria-label="Second" />
      </>,
    );
    await user.tab();
    expect(screen.getByRole("textbox", { name: "First" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Second" })).toHaveFocus();
  });

  it("submits its form on Return", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TextField aria-label="Name" name="name" />
        <button type="submit">Go</button>
      </form>,
    );
    await user.type(screen.getByRole("textbox"), "x{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("is really disabled: skipped by Tab, not editable, marked on the root", async () => {
    const user = userEvent.setup();
    render(<TextField aria-label="Name" disabled defaultValue="a" />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    expect(input.parentElement).toHaveAttribute("data-disabled");
    await user.tab();
    expect(input).not.toHaveFocus();
    await user.type(input, "b");
    expect(input).toHaveValue("a");
  });

  it("keeps its text but stays focusable when read-only", async () => {
    const user = userEvent.setup();
    render(<TextField aria-label="Name" readOnly defaultValue="a" />);
    const input = screen.getByRole("textbox");
    await user.type(input, "b");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("a");
  });

  it("shows a placeholder while empty", () => {
    render(<TextField placeholder="Optional" />);
    expect(screen.getByPlaceholderText("Optional")).toHaveValue("");
  });

  it("is named by a Base UI Field label", () => {
    render(
      <Field.Root>
        <Field.Label>Computer Name:</Field.Label>
        <TextField />
      </Field.Root>,
    );
    expect(screen.getByRole("textbox", { name: "Computer Name:" })).toBeInTheDocument();
  });

  it("sends ref, className and style to the root and everything else to the input", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <TextField
        ref={ref}
        inputRef={inputRef}
        className="wide"
        style={{ width: 300 }}
        id="name"
        name="name"
        data-testid="field"
        aria-label="Name"
      />,
    );
    const input = screen.getByTestId("field");
    expect(inputRef.current).toBe(input);
    expect(input).toHaveAttribute("id", "name");
    expect(input).toHaveAttribute("name", "name");
    expect(ref.current).toBe(input.parentElement);
    expect(ref.current).toHaveClass("mac-text-field", "wide");
    expect(ref.current).toHaveStyle({ width: "300px" });
  });

  it("draws children inside the bezel after the input", () => {
    render(
      <TextField aria-label="Amount">
        <span>kg</span>
      </TextField>,
    );
    const root = screen.getByRole("textbox").parentElement as HTMLElement;
    expect(root.lastElementChild).toHaveTextContent("kg");
  });
});
