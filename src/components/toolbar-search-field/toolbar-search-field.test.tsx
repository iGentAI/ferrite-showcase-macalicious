import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../toolbar";
import { ToolbarButton } from "../toolbar-button";
import { ToolbarSearchField, ToolbarSearchFieldMenuButton, ToolbarSearchFieldToken } from "./index";

describe("ToolbarSearchField variant and search menu", () => {
  it("is the standard field by default and reflects the bright variant", () => {
    const { rerender } = render(<ToolbarSearchField />);
    const root = screen.getByRole("searchbox").parentElement;
    expect(root).toHaveAttribute("data-variant", "standard");
    rerender(<ToolbarSearchField variant="bright" />);
    expect(root).toHaveAttribute("data-variant", "bright");
  });

  it("shows the search menu button in place of the magnifier", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container, rerender } = render(<ToolbarSearchField />);
    const root = screen.getByRole("searchbox").parentElement;
    expect(container.querySelector(".mac-toolbar-search-field-glyph")).not.toBeNull();
    expect(root).not.toHaveAttribute("data-menu");

    rerender(
      <ToolbarSearchField
        searchMenu={<ToolbarSearchFieldMenuButton aria-label="Search in" onClick={onClick} />}
      />,
    );
    expect(container.querySelector(".mac-toolbar-search-field-glyph")).toBeNull();
    expect(root).toHaveAttribute("data-menu");
    const menu = screen.getByRole("button", { name: "Search in" });
    expect(menu).toHaveClass("mac-toolbar-search-field-menu");
    expect(root).toContainElement(menu);
    await user.click(menu);
    expect(onClick).toHaveBeenCalledTimes(1);
    // Opening the menu does not put the caret in the field.
    expect(screen.getByRole("searchbox")).not.toHaveFocus();
  });

  it("disables the search menu button with the field, and lets it be disabled alone", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const menu = <ToolbarSearchFieldMenuButton aria-label="Search in" onClick={onClick} />;
    const { rerender } = render(<ToolbarSearchField disabled searchMenu={menu} />);
    const button = screen.getByRole("button", { name: "Search in" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();

    rerender(<ToolbarSearchField searchMenu={menu} />);
    expect(button).toBeEnabled();

    rerender(
      <ToolbarSearchField
        searchMenu={<ToolbarSearchFieldMenuButton aria-label="Search in" disabled />}
      />,
    );
    expect(screen.getByRole("button", { name: "Search in" })).toBeDisabled();
    expect(screen.getByRole("searchbox")).toBeEnabled();
  });

  it("puts the search menu button before the input in a toolbar's arrow-key order", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <ToolbarButton>Back</ToolbarButton>
        <ToolbarSearchField searchMenu={<ToolbarSearchFieldMenuButton aria-label="Search in" />} />
      </Toolbar>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Search in" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });
});

describe("ToolbarSearchField", () => {
  it("renders a native search input named by its placeholder", () => {
    render(<ToolbarSearchField />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute("placeholder", "Search");
    expect(input.parentElement).toHaveClass("mac-toolbar-search-field");
  });

  it("reports typing through onChange and onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    render(<ToolbarSearchField onValueChange={onValueChange} onChange={onChange} />);
    await user.type(screen.getByRole("searchbox"), "aq");
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(["a", "aq"]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("clears with the clear button and keeps focus in the field", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ToolbarSearchField defaultValue="aqua" onValueChange={onValueChange} />);
    const input = screen.getByRole("searchbox");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("keeps the clear button out of the tab order and lets it be renamed", () => {
    render(<ToolbarSearchField clearLabel="Löschen" />);
    expect(screen.getByRole("button", { name: "Löschen" })).toHaveAttribute("tabindex", "-1");
  });

  it("keeps a placeholder for the clear button's rule when the caller wants no text", () => {
    // The stylesheet hides the clear button while `:placeholder-shown` matches, which never
    // does without a placeholder: the button would show in an empty field.
    const { rerender } = render(<ToolbarSearchField placeholder="" aria-label="Find" />);
    const input = screen.getByRole("searchbox", { name: "Find" });
    expect(input).toHaveAttribute("placeholder", " ");

    // Nor is the empty text given as the field's name.
    rerender(<ToolbarSearchField placeholder="" />);
    expect(input).not.toHaveAttribute("aria-label");
  });

  it("clears on Escape, and gives up focus on a second Escape", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ToolbarSearchField onValueChange={onValueChange} />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "aqua");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith("");
    await user.keyboard("{Escape}");
    expect(input).not.toHaveFocus();
  });

  it("works as a controlled input, including clearing", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("bondi");
      return (
        <>
          <ToolbarSearchField value={value} onValueChange={setValue} />
          <output>{value}</output>
        </>
      );
    }
    render(<Controlled />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "!");
    expect(screen.getByRole("status")).toHaveTextContent("bondi!");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(input).toHaveValue("");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("disables the input and the clear button", () => {
    render(<ToolbarSearchField disabled defaultValue="aqua" />);
    const input = screen.getByRole("searchbox");
    expect(input).toBeDisabled();
    expect(input.parentElement).toHaveAttribute("data-disabled");
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("does not clear a read-only field, by Escape or by the clear button", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ToolbarSearchField readOnly defaultValue="aqua" onValueChange={onValueChange} />);
    const input = screen.getByRole("searchbox");
    const clear = screen.getByRole("button", { name: "Clear" });
    expect(clear).toBeDisabled();
    await user.click(clear);
    expect(input).toHaveValue("aqua");

    await user.click(input);
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}");
    // Nothing to clear, so the first Escape already gives up focus.
    expect(input).toHaveValue("aqua");
    expect(input).not.toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("joins the arrow-key navigation of a toolbar", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools">
        <ToolbarButton>Before</ToolbarButton>
        <ToolbarSearchField />
        <ToolbarButton>After</ToolbarButton>
      </Toolbar>,
    );
    const input = screen.getByRole("searchbox");
    const before = screen.getByRole("button", { name: "Before" });
    const after = screen.getByRole("button", { name: "After" });

    // The toolbar is one tab stop; the arrow keys walk its items, the field included.
    await user.tab();
    expect(before).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(input).toHaveFocus();

    // Inside the text the arrow keys edit: they move the insertion point, not the focus.
    await user.keyboard("ab");
    expect(input).toHaveValue("ab");
    await user.keyboard("{ArrowLeft}");
    expect(input).toHaveFocus();
    await user.keyboard("c");
    expect(input).toHaveValue("acb");

    // From either end of the text they leave for the neighbouring item.
    await user.keyboard("{ArrowRight}");
    expect(input).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(after).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(input).toHaveFocus();
    await user.keyboard("{Home}{ArrowLeft}");
    expect(before).toHaveFocus();
    expect(input).toHaveValue("acb");
  });

  it("puts className, style and ref on the root and everything else on the input", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <ToolbarSearchField
        ref={ref}
        inputRef={inputRef}
        className="extra"
        style={{ width: 240 }}
        id="query"
        name="q"
        aria-label="Search files"
      />,
    );
    const input = screen.getByRole("searchbox", { name: "Search files" });
    expect(inputRef.current).toBe(input);
    expect(input).toHaveAttribute("id", "query");
    expect(input).toHaveAttribute("name", "q");
    expect(ref.current).toBe(input.parentElement);
    expect(ref.current).toHaveClass("mac-toolbar-search-field", "extra");
    expect(ref.current).toHaveStyle({ width: "240px" });
  });

  it("puts data-force on the root, which the focus-ring rule selects, and not on the input", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ToolbarSearchField ref={ref} {...{ "data-force": "focus" }} />);
    expect(ref.current).toHaveAttribute("data-force", "focus");
    expect(screen.getByRole("searchbox")).not.toHaveAttribute("data-force");
  });
});

describe("ToolbarSearchField with tokens", () => {
  function Search({ onClear }: { onClear?: () => void }) {
    const [name, setName] = useState<string | null>("report");
    return (
      <ToolbarSearchField
        tokens={
          name != null && <ToolbarSearchFieldToken criterion="Name">{name}</ToolbarSearchFieldToken>
        }
        onClear={() => {
          onClear?.();
          setName(null);
        }}
      />
    );
  }

  it("shows the tokens before the input, which they describe, in place of the placeholder", () => {
    render(<Search />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    const root = input.parentElement as HTMLElement;
    const token = screen.getByText("report").parentElement as HTMLElement;
    expect(root).toHaveAttribute("data-tokens", "");
    expect(token).toHaveClass("mac-toolbar-search-field-token");
    expect(token).toHaveTextContent("Name report");
    expect(token.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input).not.toHaveAttribute("placeholder");
    expect(input).toHaveAccessibleDescription("Name report");
  });

  it("is a field without tokens when there are none", () => {
    const { rerender } = render(<ToolbarSearchField tokens={false} />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("placeholder", "Search");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input.parentElement).not.toHaveAttribute("data-tokens");
    // A list of tokens that has become empty is no tokens either.
    rerender(<ToolbarSearchField tokens={[null, false]} />);
    expect(input).toHaveAttribute("placeholder", "Search");
    expect(input.parentElement).not.toHaveAttribute("data-tokens");
    rerender(<ToolbarSearchField tokens="" />);
    expect(input).toHaveAttribute("placeholder", "Search");
    expect(input.parentElement).not.toHaveAttribute("data-tokens");
  });

  it("keeps a description of the caller's next to the tokens'", () => {
    render(
      <>
        <ToolbarSearchField
          aria-describedby="hint"
          tokens={<ToolbarSearchFieldToken criterion="Name">report</ToolbarSearchFieldToken>}
        />
        <p id="hint">Searches this Mac</p>
      </>,
    );
    expect(screen.getByRole("searchbox")).toHaveAccessibleDescription(
      "Name report Searches this Mac",
    );
  });

  it("reports a clear from the clear button, also when there is no text", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Search onClear={onClear} />);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("report")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveFocus();
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Search");
  });

  it("clears text and tokens on Escape, and gives up focus on the next", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Search onClear={onClear} />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "aq");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("report")).toBeNull();
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).not.toHaveFocus();
  });

  it("does not clear a read-only field that holds a token", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <ToolbarSearchField
        readOnly
        tokens={<ToolbarSearchFieldToken>report</ToolbarSearchFieldToken>}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Escape}");
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.getByText("report")).toBeInTheDocument();
  });

  it("forwards ref, className and attributes of a token to its element", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <ToolbarSearchFieldToken ref={ref} className="extra" data-kind="name">
        report
      </ToolbarSearchFieldToken>,
    );
    expect(ref.current).toHaveClass("mac-toolbar-search-field-token", "extra");
    expect(ref.current).toHaveAttribute("data-kind", "name");
    expect(ref.current?.children).toHaveLength(1);
  });
});
