import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchField } from "./index";

describe("SearchField", () => {
  it("renders a search box with its placeholder and the default attributes", () => {
    render(<SearchField />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("placeholder", "Search");
    expect(input).toHaveAttribute("type", "search");
    const root = input.parentElement as HTMLElement;
    expect(root).toHaveClass("mac-search-field");
    expect(root).toHaveAttribute("data-variant", "standard");
    expect(root).toHaveAttribute("data-size", "regular");
    expect(root).not.toHaveAttribute("data-disabled");
  });

  it("reflects variant and size on the root", () => {
    render(<SearchField variant="sidebar" size="small" placeholder="Name" />);
    const root = screen.getByPlaceholderText("Name").parentElement as HTMLElement;
    expect(root).toHaveAttribute("data-variant", "sidebar");
    expect(root).toHaveAttribute("data-size", "small");
  });

  it("gives the store field a centred copy of its glass and placeholder, hidden from assistive technology", () => {
    const { rerender } = render(<SearchField variant="store" placeholder="Find apps" />);
    const input = screen.getByRole("searchbox");
    const root = input.parentElement as HTMLElement;
    expect(root).toHaveAttribute("data-variant", "store");
    const rest = root.querySelector(".mac-search-field-rest") as HTMLElement;
    expect(rest).toHaveTextContent("Find apps");
    expect(rest).toHaveAttribute("aria-hidden", "true");
    expect(rest.querySelector("svg")).not.toBeNull();
    // The copy follows the input in the tree: the stylesheet shows it from the input's state.
    expect(input.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The field is still one search box, named by its placeholder.
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(input).toHaveAttribute("placeholder", "Find apps");

    rerender(<SearchField variant="sidebar" placeholder="Find apps" />);
    expect(document.querySelector(".mac-search-field-rest")).toBeNull();

    // With a search menu the glass is the menu's button and stays at the leading edge: no copy.
    rerender(<SearchField variant="store" searchMenu placeholder="Find apps" />);
    expect(document.querySelector(".mac-search-field-rest")).toBeNull();
    expect(screen.getByRole("button", { name: "Recent searches" })).toBeInTheDocument();
  });

  it("reports each change while typing", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField onValueChange={onValueChange} />);
    await user.type(screen.getByRole("searchbox"), "ab");
    expect(screen.getByRole("searchbox")).toHaveValue("ab");
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith("ab", expect.anything());
  });

  it("clears with the cancel button, reports it and keeps the keyboard in the field", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField defaultValue="mail" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith("", expect.anything());
  });

  it("clears a controlled field through onValueChange", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("mail");
      return <SearchField value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    await user.type(screen.getByRole("searchbox"), "x");
    expect(screen.getByRole("searchbox")).toHaveValue("x");
  });

  it("clears on Escape, then gives up focus on a second Escape", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(<SearchField onKeyDown={onKeyDown} />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "mail");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(input).not.toHaveFocus();
    expect(onKeyDown).toHaveBeenCalled();
  });

  it("keeps the cancel button out of the tab order", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SearchField defaultValue="mail" />
        <button type="button">Next</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("submits its form on Return", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <SearchField name="q" />
      </form>,
    );
    await user.type(screen.getByRole("searchbox"), "mail{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("is really disabled, cancel button included", async () => {
    const user = userEvent.setup();
    render(<SearchField disabled defaultValue="mail" />);
    const input = screen.getByRole("searchbox");
    expect(input).toBeDisabled();
    expect(input.parentElement).toHaveAttribute("data-disabled");
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    await user.tab();
    expect(input).not.toHaveFocus();
  });

  it("cannot be cleared when read-only, by Escape or by the cancel button", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField readOnly defaultValue="mail" onValueChange={onValueChange} />);
    const input = screen.getByRole("searchbox");
    expect(input.parentElement).toHaveAttribute("data-readonly");
    expect(screen.getByRole("button", { name: "Clear", hidden: true })).toBeDisabled();
    await user.click(input);
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("mail");
    expect(input).not.toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Clear", hidden: true }));
    expect(input).toHaveValue("mail");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("has no menu button and leaves Down Arrow alone without a search menu", async () => {
    const user = userEvent.setup();
    const onSearchMenu = vi.fn();
    render(<SearchField onSearchMenu={onSearchMenu} />);
    expect(screen.getByRole("searchbox").parentElement).not.toHaveAttribute("data-search-menu");
    expect(screen.queryByRole("button", { name: "Recent searches" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "{ArrowDown}");
    expect(onSearchMenu).not.toHaveBeenCalled();
  });

  it("asks for its search menu from the glass and from Down Arrow, anchored to the field", async () => {
    const user = userEvent.setup();
    const onSearchMenu = vi.fn();
    render(<SearchField searchMenu onSearchMenu={onSearchMenu} />);
    const input = screen.getByRole("searchbox");
    const root = input.parentElement as HTMLElement;
    expect(root).toHaveAttribute("data-search-menu");
    const glass = screen.getByRole("button", { name: "Recent searches" });
    expect(glass).toHaveAttribute("aria-haspopup", "menu");
    await user.click(glass);
    expect(onSearchMenu).toHaveBeenLastCalledWith(root);
    await user.type(input, "{ArrowDown}");
    expect(onSearchMenu).toHaveBeenCalledTimes(2);
    expect(onSearchMenu).toHaveBeenLastCalledWith(root);
  });

  it("keeps the search menu button out of the tab order, names it, and disables it with the field", async () => {
    const user = userEvent.setup();
    const onSearchMenu = vi.fn();
    const { rerender } = render(
      <SearchField searchMenu searchMenuLabel="Letzte Suchen" onSearchMenu={onSearchMenu} />,
    );
    await user.tab();
    expect(screen.getByRole("searchbox")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Letzte Suchen" })).toHaveAttribute("tabindex", "-1");
    rerender(<SearchField searchMenu disabled onSearchMenu={onSearchMenu} />);
    const glass = screen.getByRole("button", { name: "Recent searches" });
    expect(glass).toBeDisabled();
    await user.click(glass);
    expect(onSearchMenu).not.toHaveBeenCalled();
  });

  it("leaves Down Arrow to a handler that prevents it", async () => {
    const user = userEvent.setup();
    const onSearchMenu = vi.fn();
    render(
      <SearchField searchMenu onSearchMenu={onSearchMenu} onKeyDown={(e) => e.preventDefault()} />,
    );
    await user.type(screen.getByRole("searchbox"), "{ArrowDown}");
    expect(onSearchMenu).not.toHaveBeenCalled();
  });

  it("leaves Escape and Down Arrow to an input method that is composing", () => {
    const onSearchMenu = vi.fn();
    render(<SearchField searchMenu onSearchMenu={onSearchMenu} defaultValue="ka" />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    input.focus();
    // Escape cancels the candidate: the field keeps its text and the keyboard.
    expect(fireEvent.keyDown(input, { key: "Escape", isComposing: true })).toBe(true);
    expect(input).toHaveValue("ka");
    // Down Arrow moves through the candidates: no search menu.
    expect(fireEvent.keyDown(input, { key: "ArrowDown", isComposing: true })).toBe(true);
    // The same keys as Safari sends them once the composition has ended.
    expect(fireEvent.keyDown(input, { key: "Escape", keyCode: 229 })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "ArrowDown", keyCode: 229 })).toBe(true);
    expect(input).toHaveValue("ka");
    expect(input).toHaveFocus();
    expect(onSearchMenu).not.toHaveBeenCalled();
    // Outside a composition both keys act again.
    expect(fireEvent.keyDown(input, { key: "ArrowDown" })).toBe(false);
    expect(onSearchMenu).toHaveBeenCalledTimes(1);
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
    expect(input).toHaveValue("");
  });

  it("names the cancel button with clearLabel", () => {
    render(<SearchField defaultValue="mail" clearLabel="Löschen" />);
    expect(screen.getByRole("button", { name: "Löschen" })).toBeInTheDocument();
  });

  it("sends ref, className and style to the root and everything else to the input", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <SearchField
        ref={ref}
        inputRef={inputRef}
        className="wide"
        style={{ width: 300 }}
        id="q"
        aria-label="Search mail"
      />,
    );
    const input = screen.getByRole("searchbox", { name: "Search mail" });
    expect(inputRef.current).toBe(input);
    expect(input).toHaveAttribute("id", "q");
    expect(ref.current).toBe(input.parentElement);
    expect(ref.current).toHaveClass("mac-search-field", "wide");
    expect(ref.current).toHaveStyle({ width: "300px" });
  });

  it("accepts a callback inputRef", () => {
    const inputRef = vi.fn();
    render(<SearchField inputRef={inputRef} />);
    expect(inputRef).toHaveBeenCalledWith(screen.getByRole("searchbox"));
  });
});
