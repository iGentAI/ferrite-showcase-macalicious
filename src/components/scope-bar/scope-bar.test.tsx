import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import FindBar from "./examples/find-bar";
import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActionGroup,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
  type ScopeBarGroupProps,
  ScopeBarLabel,
} from "./index";

function Search(props: ScopeBarGroupProps) {
  return (
    <ScopeBar data-testid="bar">
      <ScopeBarLabel id="search-label">Search:</ScopeBarLabel>
      <ScopeBarGroup aria-labelledby="search-label" {...props}>
        <ScopeBarButton value="mac">This Mac</ScopeBarButton>
        <ScopeBarButton value="disk">Macintosh SSD</ScopeBarButton>
        <ScopeBarButton value="shared">Shared</ScopeBarButton>
      </ScopeBarGroup>
    </ScopeBar>
  );
}

const scope = (name: string) => screen.getByRole("radio", { name });

describe("ScopeBar", () => {
  it("draws the plain surface by default and reflects the toolbar surface", () => {
    const { rerender } = render(<ScopeBar data-testid="bar" />);
    const bar = screen.getByTestId("bar");
    expect(bar).toHaveClass("mac-scope-bar");
    expect(bar).toHaveAttribute("data-surface", "plain");

    rerender(<ScopeBar data-testid="bar" surface="toolbar" />);
    expect(bar).toHaveAttribute("data-surface", "toolbar");
  });

  it("is regular by default and reflects the small size", () => {
    const { rerender } = render(<ScopeBar data-testid="bar" />);
    const bar = screen.getByTestId("bar");
    expect(bar).toHaveAttribute("data-size", "regular");

    rerender(<ScopeBar data-testid="bar" surface="toolbar" size="small" />);
    expect(bar).toHaveAttribute("data-size", "small");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ScopeBar ref={ref} className="extra" id="scope" />);
    expect(ref.current).toHaveClass("mac-scope-bar", "extra");
    expect(ref.current).toHaveAttribute("id", "scope");
  });
});

describe("ScopeBarGroup and ScopeBarButton", () => {
  it("is a radio group named by its label, with one scope per button", () => {
    render(<Search />);
    const group = screen.getByRole("radiogroup", { name: "Search:" });
    expect(group).toHaveClass("mac-scope-bar-group");
    const scopes = screen.getAllByRole("radio");
    expect(scopes).toHaveLength(3);
    for (const item of scopes) {
      expect(item).toHaveClass("mac-scope-bar-button");
      expect(item).not.toBeChecked();
    }
  });

  it("turns a scope on with the pointer and the others off (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Search defaultValue="mac" onValueChange={onValueChange} />);
    expect(scope("This Mac")).toBeChecked();

    await user.click(scope("Macintosh SSD"));
    expect(scope("Macintosh SSD")).toBeChecked();
    expect(scope("Macintosh SSD")).toHaveAttribute("data-checked");
    expect(scope("This Mac")).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("disk");
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Search value="mac" onValueChange={onValueChange} />);

    await user.click(scope("Shared"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("shared");
    expect(scope("This Mac")).toBeChecked();
    expect(scope("Shared")).not.toBeChecked();
  });

  it("is one tab stop, and the arrow keys move the selection", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Search defaultValue="mac" />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(scope("This Mac")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(scope("Macintosh SSD")).toHaveFocus();
    expect(scope("Macintosh SSD")).toBeChecked();

    await user.keyboard("{ArrowLeft}");
    expect(scope("This Mac")).toBeChecked();

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("does not turn on a disabled scope", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ScopeBarGroup aria-label="Search" defaultValue="a" onValueChange={onValueChange}>
        <ScopeBarButton value="a">One</ScopeBarButton>
        <ScopeBarButton value="b" disabled>
          Two
        </ScopeBarButton>
      </ScopeBarGroup>,
    );
    await user.click(scope("Two"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(scope("One")).toBeChecked();
    expect(scope("Two")).toHaveAttribute("data-disabled");
  });

  it("keeps its own class when className is a string or a state function", () => {
    render(
      <ScopeBarGroup aria-label="Search" defaultValue="a" className="extra">
        <ScopeBarButton value="a" className={(state) => (state.checked ? "is-on" : "is-off")}>
          One
        </ScopeBarButton>
      </ScopeBarGroup>,
    );
    expect(screen.getByRole("radiogroup")).toHaveClass("mac-scope-bar-group", "extra");
    expect(scope("One")).toHaveClass("mac-scope-bar-button", "is-on");
  });
});

describe("ScopeBarAction", () => {
  it("is a button that acts on click, Return and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ScopeBarActions data-testid="actions">
        <ScopeBarAction onClick={onClick}>Save</ScopeBarAction>
      </ScopeBarActions>,
    );
    expect(screen.getByTestId("actions")).toHaveClass("mac-scope-bar-actions");
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveClass("mac-scope-bar-action");
    expect(save).toHaveAttribute("type", "button");

    await user.click(save);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("draws a glyph that assistive technology does not read", () => {
    const { container } = render(<ScopeBarAction glyph="plus" aria-label="Add criterion" />);
    const add = screen.getByRole("button", { name: "Add criterion" });
    expect(add).toHaveAttribute("data-glyph", "plus");
    const glyph = container.querySelector(".mac-scope-bar-glyph");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(glyph).toHaveAttribute("data-glyph", "plus");
  });

  it("ignores activation when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ScopeBarAction disabled onClick={onClick}>
        Save
      </ScopeBarAction>,
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("joins actions into a named group", () => {
    render(
      <ScopeBarActionGroup aria-label="Find">
        <ScopeBarAction glyph="previous" aria-label="Previous" />
        <ScopeBarAction glyph="next" aria-label="Next" />
      </ScopeBarActionGroup>,
    );
    const group = screen.getByRole("group", { name: "Find" });
    expect(group).toHaveClass("mac-scope-bar-action-group");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("find bar example", () => {
  it("keeps keyboard focus when the bar closes and opens again", async () => {
    const user = userEvent.setup();
    render(<FindBar />);
    expect(document.body).toHaveFocus();

    const done = screen.getByRole("button", { name: "Done" });
    done.focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find…" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("radio", { name: "Page Order" })).toHaveFocus();
  });
});
