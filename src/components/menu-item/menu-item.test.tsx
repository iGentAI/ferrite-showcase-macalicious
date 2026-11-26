import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Menu, MenuPopup, MenuTrigger } from "../menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuItemLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSection,
  MenuSeparator,
} from "./index";

/** An open menu around the items under test. */
function OpenMenu({ children }: { children: ReactNode }) {
  return (
    <Menu defaultOpen>
      <MenuTrigger>View</MenuTrigger>
      <MenuPopup>{children}</MenuPopup>
    </Menu>
  );
}

describe("MenuItem", () => {
  it("shows its key equivalent in AppKit's glyphs and announces it", async () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    render(
      <OpenMenu>
        <MenuItem keyEquivalent="shift+command+q">Log Out</MenuItem>
        <MenuItem keyEquivalent="control+command+q">Lock Screen</MenuItem>
        <MenuItem>Sleep</MenuItem>
        <MenuItem aria-keyshortcuts="F5">Refresh</MenuItem>
      </OpenMenu>,
    );
    const item = await screen.findByRole("menuitem", { name: "Log Out" });
    expect(item).toHaveClass("mac-menu-item");
    expect(item).toHaveAttribute("aria-keyshortcuts", "Shift+Meta+Q");
    // The glyphs are shown but are not part of the name: the attribute announces the shortcut.
    expect(item).toHaveTextContent("Log Out\u21E7\u2318Q");
    expect(screen.getByRole("menuitem", { name: "Lock Screen" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+Meta+Q",
    );
    expect(screen.getByRole("menuitem", { name: "Sleep" })).not.toHaveAttribute(
      "aria-keyshortcuts",
    );
    // Without a key equivalent the item's own attribute is left alone.
    expect(screen.getByRole("menuitem", { name: "Refresh" })).toHaveAttribute(
      "aria-keyshortcuts",
      "F5",
    );
    vi.restoreAllMocks();
  });

  it("announces Control for Command off Apple platforms, where the Control key is used", async () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
    render(
      <OpenMenu>
        <MenuItem keyEquivalent="shift+command+q">Log Out</MenuItem>
        <MenuItem keyEquivalent="control+command+q">Lock Screen</MenuItem>
        <MenuItem keyEquivalent="control+option+command+8" aria-keyshortcuts="Control+8">
          Invert Colours
        </MenuItem>
        <MenuItem keyEquivalent="option+escape">Speak</MenuItem>
        <MenuItem keyEquivalent="control+m">Minimise</MenuItem>
        <MenuItem aria-keyshortcuts="F5">Refresh</MenuItem>
      </OpenMenu>,
    );
    const item = await screen.findByRole("menuitem", { name: "Log Out" });
    expect(item).toHaveAttribute("aria-keyshortcuts", "Shift+Control+Q");
    // The glyphs stay AppKit's.
    expect(item).toHaveTextContent("Log Out\u21E7\u2318Q");
    // Control and Command are one key there, so this one cannot be typed: it is shown and not
    // announced, rather than announced as Control+Q, which is another command.
    const lock = screen.getByRole("menuitem", { name: "Lock Screen" });
    expect(lock).not.toHaveAttribute("aria-keyshortcuts");
    expect(lock).toHaveTextContent("Lock Screen\u2303\u2318Q");
    // Nor is an attribute of the item's own: the key equivalent decides.
    expect(screen.getByRole("menuitem", { name: "Invert Colours" })).not.toHaveAttribute(
      "aria-keyshortcuts",
    );
    expect(screen.getByRole("menuitem", { name: "Speak" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Alt+Escape",
    );
    // Control alone is announced, also with a key that begins like Meta.
    expect(screen.getByRole("menuitem", { name: "Minimise" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+M",
    );
    expect(screen.getByRole("menuitem", { name: "Refresh" })).toHaveAttribute(
      "aria-keyshortcuts",
      "F5",
    );
    vi.restoreAllMocks();
  });

  it("renders an image before the title", async () => {
    render(
      <OpenMenu>
        <MenuItem image={<svg data-testid="glyph" aria-hidden="true" />}>Downloads</MenuItem>
      </OpenMenu>,
    );
    const item = await screen.findByRole("menuitem", { name: "Downloads" });
    const image = within(item).getByTestId("glyph").parentElement;
    expect(image).toHaveClass("mac-menu-item-image");
    expect(image?.nextElementSibling).toHaveTextContent("Downloads");
  });

  it("reflects the indentation level", async () => {
    render(
      <OpenMenu>
        <MenuItem indentationLevel={2}>Nested</MenuItem>
        <MenuItem>Flat</MenuItem>
      </OpenMenu>,
    );
    expect(await screen.findByRole("menuitem", { name: "Nested" })).toHaveAttribute(
      "data-indentation",
      "2",
    );
    expect(screen.getByRole("menuitem", { name: "Flat" })).not.toHaveAttribute("data-indentation");
  });

  it("forwards ref, className and attributes", async () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <OpenMenu>
        <MenuItem ref={ref} className="extra" data-command="sleep">
          Sleep
        </MenuItem>
      </OpenMenu>,
    );
    const item = await screen.findByRole("menuitem", { name: "Sleep" });
    expect(ref.current).toBe(item);
    expect(item).toHaveClass("mac-menu-item", "extra");
    expect(item).toHaveAttribute("data-command", "sleep");
  });

  it("keeps the menu open when asked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <OpenMenu>
        <MenuItem closeOnClick={false} onClick={onClick}>
          Zoom In
        </MenuItem>
      </OpenMenu>,
    );
    await user.click(await screen.findByRole("menuitem", { name: "Zoom In" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});

describe("MenuCheckboxItem", () => {
  it("toggles, reports the change and closes the menu like any item", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <OpenMenu>
        <MenuCheckboxItem defaultChecked onCheckedChange={onCheckedChange}>
          Show Percentage
        </MenuCheckboxItem>
      </OpenMenu>,
    );
    const item = await screen.findByRole("menuitemcheckbox", { name: "Show Percentage" });
    expect(item).toHaveClass("mac-menu-item");
    expect(item).toBeChecked();
    await user.click(item);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(false);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("stays open with closeOnClick={false} and can be toggled from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <OpenMenu>
        <MenuCheckboxItem closeOnClick={false}>Show Path Bar</MenuCheckboxItem>
      </OpenMenu>,
    );
    const item = await screen.findByRole("menuitemcheckbox", { name: "Show Path Bar" });
    expect(item).not.toBeChecked();
    // A menu open from the start takes focus a frame after it mounts; a key pressed before
    // then reaches the page, not the menu.
    await waitFor(() =>
      expect(screen.getByRole("menu")).toContainElement(document.activeElement as HTMLElement),
    );
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(item).toHaveAttribute("data-highlighted"));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(item).toBeChecked());
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("announces the mixed state", async () => {
    render(
      <OpenMenu>
        <MenuCheckboxItem mixed>Bold</MenuCheckboxItem>
      </OpenMenu>,
    );
    const item = await screen.findByRole("menuitemcheckbox", { name: "Bold" });
    expect(item).toHaveAttribute("aria-checked", "mixed");
    expect(item).toHaveAttribute("data-mixed");
  });
});

describe("MenuRadioGroup", () => {
  it("has one item on at a time and reports the choice", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <OpenMenu>
        <MenuRadioGroup defaultValue="icons" onValueChange={onValueChange}>
          <MenuRadioItem value="icons" closeOnClick={false}>
            as Icons
          </MenuRadioItem>
          <MenuRadioItem value="list" closeOnClick={false} keyEquivalent="command+2">
            as List
          </MenuRadioItem>
        </MenuRadioGroup>
      </OpenMenu>,
    );
    const icons = await screen.findByRole("menuitemradio", { name: "as Icons" });
    const list = screen.getByRole("menuitemradio", { name: "as List" });
    expect(icons).toBeChecked();
    expect(list).not.toBeChecked();
    // The test environment is not an Apple platform, so Command is announced as Control.
    expect(list).toHaveAttribute("aria-keyshortcuts", "Control+2");

    await user.click(list);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("list");
    await waitFor(() => expect(list).toBeChecked());
    expect(icons).not.toBeChecked();
  });
});

describe("disabled checkbox and radio items", () => {
  it("an uncontrolled checkbox keeps its state while it is disabled and enabled again", async () => {
    const user = userEvent.setup();
    function Toggle({ disabled }: { disabled: boolean }) {
      return (
        <OpenMenu>
          <MenuCheckboxItem disabled={disabled} closeOnClick={false}>
            Show Sidebar
          </MenuCheckboxItem>
        </OpenMenu>
      );
    }
    const { rerender } = render(<Toggle disabled={false} />);
    const item = () => screen.getByRole("menuitemcheckbox", { name: "Show Sidebar" });
    await screen.findByRole("menu");
    await user.click(item());
    await waitFor(() => expect(item()).toBeChecked());

    rerender(<Toggle disabled />);
    expect(item()).toHaveAttribute("aria-disabled", "true");
    expect(item()).toBeChecked();

    rerender(<Toggle disabled={false} />);
    expect(item()).not.toHaveAttribute("aria-disabled", "true");
    expect(item()).toBeChecked();
  });

  const spies = () => ({
    onClick: vi.fn(),
    onClickCapture: vi.fn(),
    onPointerDown: vi.fn(),
    onMouseDown: vi.fn(),
    onKeyDown: vi.fn(),
    onKeyUp: vi.fn(),
  });

  /** Everything a person or a script could do to activate the element. */
  async function tryToActivate(item: HTMLElement) {
    const user = userEvent.setup();
    await user.click(item);
    fireEvent.pointerDown(item);
    fireEvent.mouseDown(item);
    fireEvent.click(item);
    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.keyUp(item, { key: " " });
    item.focus();
    expect(item).not.toHaveFocus();
  }

  it("a disabled item rendered as a button is a disabled button without handlers", async () => {
    const fromItem = spies();
    const fromRender = spies();
    render(
      <OpenMenu>
        <MenuItem
          disabled
          {...fromItem}
          render={<button type="button" className="own" tabIndex={0} {...fromRender} />}
        >
          Empty Trash
        </MenuItem>
      </OpenMenu>,
    );
    const item = await screen.findByRole("menuitem", { name: "Empty Trash" });
    expect(item.tagName).toBe("BUTTON");
    expect(item).toBeDisabled();
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveClass("mac-menu-item", "own");
    expect(item).not.toHaveAttribute("tabindex");
    await tryToActivate(item);
    for (const handler of [...Object.values(fromItem), ...Object.values(fromRender)])
      expect(handler).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("a disabled item rendered as a select or a textarea is natively disabled", async () => {
    // React accepts a textarea's children, the row's content, with a warning.
    const warned = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <OpenMenu>
        <MenuItem disabled render={<select aria-label="Kind" />} />
        <MenuItem disabled render={<textarea aria-label="Notes" />} />
        <MenuItem disabled render={<span />}>
          Plain
        </MenuItem>
      </OpenMenu>,
    );
    await screen.findByRole("menu");
    for (const name of ["Kind", "Notes"]) {
      const control = screen.getByLabelText(name);
      expect(control).toBeDisabled();
      control.focus();
      expect(control).not.toHaveFocus();
    }
    expect(screen.getByRole("menuitem", { name: "Plain" })).not.toHaveAttribute("disabled");
    warned.mockRestore();
  });

  it("a disabled item that a render function draws as a native control is natively disabled", async () => {
    render(
      <OpenMenu>
        {/* An input is a void element: the function leaves the row's content out. */}
        <MenuItem
          disabled
          render={({ children: _content, ...props }) => <input {...props} aria-label="Search" />}
        >
          Search
        </MenuItem>
        <MenuItem disabled render={(props) => <button type="button" {...props} />}>
          Empty Trash
        </MenuItem>
        {/* Only the four native controls: not an element whose name contains one of theirs. */}
        <MenuItem disabled render={createElement("my-button")}>
          Custom
        </MenuItem>
      </OpenMenu>,
    );
    await screen.findByRole("menu");
    const search = screen.getByLabelText("Search");
    expect(search.tagName).toBe("INPUT");
    const button = screen.getByRole("menuitem", { name: "Empty Trash" });
    expect(button.tagName).toBe("BUTTON");
    for (const control of [search, button]) {
      expect(control).toBeDisabled();
      expect(control).toHaveAttribute("aria-disabled", "true");
      control.focus();
      expect(control).not.toHaveFocus();
    }
    const custom = screen.getByRole("menuitem", { name: "Custom" });
    expect(custom.tagName).toBe("MY-BUTTON");
    expect(custom).not.toHaveAttribute("disabled");
    expect(custom).toHaveAttribute("aria-disabled", "true");
  });

  it("a disabled item rendered as a link or by a function cannot be activated either", async () => {
    const onLink = spies();
    const onSpan = spies();
    render(
      <OpenMenu>
        <MenuItem disabled render={<a href="/trash" {...onLink} />}>
          Open Trash
        </MenuItem>
        <MenuItem
          disabled
          render={(props, state) => (
            <span
              {...props}
              {...onSpan}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: the tab stop the item must remove
              tabIndex={0}
              contentEditable
              suppressContentEditableWarning
              data-state={String(state.disabled)}
            />
          )}
        >
          Put Back
        </MenuItem>
      </OpenMenu>,
    );
    const link = await screen.findByRole("menuitem", { name: "Open Trash" });
    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("href");
    const span = screen.getByRole("menuitem", { name: "Put Back" });
    expect(span.tagName).toBe("SPAN");
    expect(span).toHaveAttribute("data-state", "true");
    expect(span).not.toHaveAttribute("tabindex");
    expect(span).not.toHaveAttribute("contenteditable");
    await tryToActivate(link);
    await tryToActivate(span);
    for (const handler of [...Object.values(onLink), ...Object.values(onSpan)])
      expect(handler).not.toHaveBeenCalled();
  });

  it("keep their role and state and cannot be changed", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <OpenMenu>
        <MenuCheckboxItem disabled checked onCheckedChange={onCheckedChange}>
          Show Sidebar
        </MenuCheckboxItem>
        <MenuCheckboxItem disabled mixed>
          Bold
        </MenuCheckboxItem>
        <MenuRadioGroup defaultValue="list" onValueChange={onValueChange}>
          <MenuRadioItem value="icons" closeOnClick={false}>
            as Icons
          </MenuRadioItem>
          <MenuRadioItem value="list" disabled>
            as List
          </MenuRadioItem>
        </MenuRadioGroup>
      </OpenMenu>,
    );
    const sidebar = await screen.findByRole("menuitemcheckbox", { name: "Show Sidebar" });
    expect(sidebar).toBeChecked();
    expect(sidebar).toHaveAttribute("aria-disabled", "true");
    expect(sidebar).toHaveAttribute("data-checked");
    expect(screen.getByRole("menuitemcheckbox", { name: "Bold" })).toHaveAttribute(
      "aria-checked",
      "mixed",
    );
    const list = screen.getByRole("menuitemradio", { name: "as List" });
    expect(list).toBeChecked();

    await user.click(sidebar);
    await user.click(list);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();

    // The disabled radio item follows the group when another item is chosen.
    await user.click(screen.getByRole("menuitemradio", { name: "as Icons" }));
    await waitFor(() => expect(list).not.toBeChecked());
  });
});

describe("MenuSeparator and MenuSection", () => {
  it("renders a separator and a group named by its header", async () => {
    render(
      <OpenMenu>
        <MenuItem>Show Percentage</MenuItem>
        <MenuSeparator data-testid="line" />
        <MenuSection title="Using Significant Energy">
          <MenuItem>Spotlight</MenuItem>
        </MenuSection>
      </OpenMenu>,
    );
    const group = await screen.findByRole("group", { name: "Using Significant Energy" });
    expect(within(group).getByRole("menuitem", { name: "Spotlight" })).toBeInTheDocument();
    expect(within(group).getByText("Using Significant Energy")).toHaveClass("mac-menu-item-header");
    const line = screen.getByTestId("line");
    expect(line).toHaveAttribute("role", "separator");
    expect(line).toHaveClass("mac-menu-item-separator");
  });
});

describe("MenuItemLabel", () => {
  it("lays out image, title and key equivalent for a row on any element", () => {
    render(
      <div className="mac-menu-item" data-testid="row">
        <MenuItemLabel image={<svg aria-hidden="true" />} keyEquivalent="command+k">
          Connect to Server
        </MenuItemLabel>
      </div>,
    );
    const row = screen.getByTestId("row");
    expect(Array.from(row.children, (child) => child.className)).toEqual([
      "mac-menu-item-image",
      "mac-menu-item-title",
      "mac-menu-item-key",
    ]);
    expect(row).toHaveTextContent("Connect to Server\u2318K");
  });
});
