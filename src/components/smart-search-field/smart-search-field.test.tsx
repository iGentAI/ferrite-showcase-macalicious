import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../toolbar";
import { ToolbarButton } from "../toolbar-button";
import { SmartSearchField, SmartSearchFieldButton } from "./index";

const ADDRESS = "https://www.example.com/page?q=1";
const field = () => screen.getByRole<HTMLInputElement>("textbox");
/** The stand-in the field shows while it is not edited; hidden from assistive technology. */
const display = () => field().parentElement?.querySelector(".mac-smart-search-field-display");

describe("SmartSearchField", () => {
  it("renders an empty text field named by its placeholder", () => {
    render(<SmartSearchField />);
    const input = screen.getByRole("textbox", { name: "Search or enter website name" });
    expect(input).toHaveValue("");
    expect(input.parentElement).toHaveClass("mac-smart-search-field");
    expect(input.parentElement).toHaveAttribute("data-empty");
    expect(display()).toHaveTextContent("Search or enter website name");
    expect(display()).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the host of an address while the whole address stays the field's value", () => {
    render(<SmartSearchField defaultValue={ADDRESS} />);
    expect(field()).toHaveValue(ADDRESS);
    expect(display()).toHaveTextContent(/^example\.com$/);
    expect(field().parentElement).not.toHaveAttribute("data-empty");
  });

  it("never shows a user name or password that the address carries", () => {
    const { rerender } = render(
      <SmartSearchField defaultValue="https://user:secret@www.example.com/page" />,
    );
    expect(display()).toHaveTextContent(/^example\.com$/);
    rerender(<SmartSearchField value="ftp://anonymous@files.example.org:2121/pub?x=a@b#c@d" />);
    expect(display()).toHaveTextContent(/^files\.example\.org:2121$/);
    // An at sign after the host is not a separator of credentials.
    rerender(<SmartSearchField value="https://example.com/@user" />);
    expect(display()).toHaveTextContent(/^example\.com$/);
    // A backslash ends the host as a slash does, so what follows it is not the host.
    rerender(<SmartSearchField value={"https://example.com\\@other.example/path"} />);
    expect(display()).toHaveTextContent(/^example\.com$/);
  });

  it("keeps Return from submitting a form around it, and Escape from going further", async () => {
    const user = userEvent.setup();
    const onFormSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onFormSubmit}>
        <SmartSearchField defaultValue="first" onSubmit={onSubmit} />
      </form>,
    );
    await user.click(field());
    await user.keyboard("second{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("second");
    expect(onFormSubmit).not.toHaveBeenCalled();

    // dispatchEvent returns false when the default action was prevented.
    expect(fireEvent.keyDown(field(), { key: "Enter" })).toBe(false);
    expect(fireEvent.keyDown(field(), { key: "Escape" })).toBe(false);
    expect(fireEvent.keyDown(field(), { key: "a" })).toBe(true);
  });

  it("shows text that is not an address as it is, and displayValue instead of either", () => {
    const { rerender } = render(<SmartSearchField defaultValue="catalina wallpaper" />);
    expect(display()).toHaveTextContent("catalina wallpaper");
    rerender(<SmartSearchField defaultValue="catalina wallpaper" displayValue="Example, Inc." />);
    expect(display()).toHaveTextContent("Example, Inc.");
  });

  it("reflects secure, and draws the padlock only beside text", () => {
    const { rerender } = render(<SmartSearchField secure defaultValue={ADDRESS} />);
    expect(field().parentElement).toHaveAttribute("data-secure");
    expect(display()?.querySelector("[data-glyph='lock']")).not.toBeNull();

    rerender(<SmartSearchField defaultValue={ADDRESS} />);
    expect(field().parentElement).not.toHaveAttribute("data-secure");
    expect(display()?.querySelector("[data-glyph='lock']")).toBeNull();
  });

  it("selects the whole text when a click begins editing", async () => {
    const user = userEvent.setup();
    render(<SmartSearchField defaultValue={ADDRESS} />);
    await user.click(field());
    expect(field()).toHaveFocus();
    expect(field().selectionStart).toBe(0);
    expect(field().selectionEnd).toBe(ADDRESS.length);

    // So typing replaces the address.
    await user.keyboard("new");
    expect(field()).toHaveValue("new");
  });

  it("selects the whole text when Tab reaches it", async () => {
    const user = userEvent.setup();
    render(<SmartSearchField defaultValue={ADDRESS} />);
    await user.tab();
    expect(field()).toHaveFocus();
    expect(field().selectionEnd).toBe(ADDRESS.length);
  });

  it("reports typing through onChange and onValueChange (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    render(<SmartSearchField onValueChange={onValueChange} onChange={onChange} />);
    await user.type(field(), "aq");
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(["a", "aq"]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(field()).toHaveValue("aq");
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<SmartSearchField value="aqua" onValueChange={onValueChange} />);
    await user.click(field());
    await user.keyboard("{End}!");
    expect(onValueChange).toHaveBeenLastCalledWith("aqua!");
    expect(field()).toHaveValue("aqua");

    rerender(<SmartSearchField value="graphite" onValueChange={onValueChange} />);
    expect(field()).toHaveValue("graphite");
  });

  it("submits the text on Return and gives up the focus", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SmartSearchField defaultValue={ADDRESS} onSubmit={onSubmit} />);
    await user.click(field());
    await user.keyboard("example.org{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("example.org");
    expect(field()).not.toHaveFocus();
    expect(field()).toHaveValue("example.org");
  });

  it("puts the text back on Escape and gives up the focus", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <SmartSearchField defaultValue={ADDRESS} onValueChange={onValueChange} onSubmit={onSubmit} />,
    );
    await user.click(field());
    await user.keyboard("typo{Escape}");
    expect(field()).toHaveValue(ADDRESS);
    expect(onValueChange).toHaveBeenLastCalledWith(ADDRESS);
    expect(field()).not.toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("goes back to the submitted text, not the first one, on a later Escape", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("first");
      return <SmartSearchField value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    await user.click(field());
    await user.keyboard("second{Enter}");
    await user.click(field());
    await user.keyboard("third{Escape}");
    expect(field()).toHaveValue("second");
  });

  it("leaves a key to the caller's handler when it prevents the default", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <SmartSearchField
        defaultValue="aqua"
        onSubmit={onSubmit}
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
      />,
    );
    await user.click(field());
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field()).toHaveFocus();
  });

  it("cannot be edited when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SmartSearchField disabled defaultValue="aqua" onValueChange={onValueChange} />);
    expect(field()).toBeDisabled();
    expect(field().parentElement).toHaveAttribute("data-disabled");
    await user.click(field());
    await user.keyboard("x");
    expect(field()).not.toHaveFocus();
    expect(field()).toHaveValue("aqua");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("holds accessories on both sides, in the tab order around the input", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(
      <SmartSearchField
        defaultValue={ADDRESS}
        leading={<SmartSearchFieldButton glyph="reader" aria-label="Reader View" />}
        trailing={<SmartSearchFieldButton glyph="reload" aria-label="Reload" onClick={onReload} />}
      />,
    );
    const reader = screen.getByRole("button", { name: "Reader View" });
    const reload = screen.getByRole("button", { name: "Reload" });
    expect(field().parentElement).toContainElement(reader);

    await user.tab();
    expect(reader).toHaveFocus();
    await user.tab();
    expect(field()).toHaveFocus();
    await user.tab();
    expect(reload).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onReload).toHaveBeenCalledTimes(2);
  });

  it("works inside a toolbar", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onReload = vi.fn();
    render(
      <Toolbar aria-label="Tools">
        <SmartSearchField
          onSubmit={onSubmit}
          trailing={
            <SmartSearchFieldButton glyph="reload" aria-label="Reload" onClick={onReload} />
          }
        />
      </Toolbar>,
    );
    await user.click(field());
    await user.keyboard("example.com{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("example.com");
    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("joins the arrow-key navigation of a toolbar, with its accessories", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <ToolbarButton>Before</ToolbarButton>
        <SmartSearchField
          trailing={<SmartSearchFieldButton glyph="reload" aria-label="Reload" />}
        />
        <ToolbarButton>After</ToolbarButton>
      </Toolbar>,
    );
    // The toolbar is one tab stop; the arrow keys walk its items, the field's parts included.
    await user.tab();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(field()).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Reload" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("puts className, style and ref on the root and everything else on the input", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <SmartSearchField
        ref={ref}
        inputRef={inputRef}
        className="extra"
        style={{ width: 240 }}
        id="address"
        name="q"
        aria-label="Address"
      />,
    );
    const input = screen.getByRole("textbox", { name: "Address" });
    expect(inputRef.current).toBe(input);
    expect(input).toHaveAttribute("id", "address");
    expect(input).toHaveAttribute("name", "q");
    expect(ref.current).toBe(input.parentElement);
    expect(ref.current).toHaveClass("mac-smart-search-field", "extra");
    expect(ref.current).toHaveStyle({ width: "240px" });
  });

  it("puts data-force on the root, which the editing rules select, and not on the input", () => {
    const ref = createRef<HTMLDivElement>();
    render(<SmartSearchField ref={ref} {...{ "data-force": "focus" }} />);
    expect(ref.current).toHaveAttribute("data-force", "focus");
    expect(field()).not.toHaveAttribute("data-force");
  });
});

describe("SmartSearchFieldButton", () => {
  it("is a momentary button unless pressed is given", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <SmartSearchFieldButton glyph="reader" aria-label="Reader View" onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "Reader View" });
    expect(button).toHaveClass("mac-smart-search-field-button");
    expect(button).not.toHaveAttribute("aria-pressed");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<SmartSearchFieldButton glyph="reader" aria-label="Reader View" pressed={false} />);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveAttribute("data-pressed");

    rerender(<SmartSearchFieldButton glyph="reader" aria-label="Reader View" pressed />);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-pressed");
  });

  it("draws the named glyph, or its children instead", () => {
    const { rerender } = render(<SmartSearchFieldButton glyph="stop" aria-label="Stop" />);
    const button = screen.getByRole("button", { name: "Stop" });
    expect(button.querySelector("[data-glyph='stop']")).not.toBeNull();

    rerender(
      <SmartSearchFieldButton glyph="stop" aria-label="Stop">
        <span data-testid="own" />
      </SmartSearchFieldButton>,
    );
    expect(button).toContainElement(screen.getByTestId("own"));
    expect(button.querySelector("[data-glyph]")).toBeNull();
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SmartSearchFieldButton glyph="reload" aria-label="Reload" disabled onClick={onClick} />,
    );
    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reload" })).toBeDisabled();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <SmartSearchFieldButton
        ref={ref}
        glyph="audio"
        aria-label="Mute this tab"
        className="extra"
        id="mute"
      />,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Mute this tab" }));
    expect(ref.current).toHaveClass("mac-smart-search-field-button", "extra");
    expect(ref.current).toHaveAttribute("id", "mute");
  });
});
