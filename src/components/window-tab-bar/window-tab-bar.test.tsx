import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Closable from "./examples/closable";
import { WindowTab, WindowTabBar, type WindowTabBarProps } from "./index";

function Finder(props: WindowTabBarProps) {
  return (
    <WindowTabBar defaultValue="home" aria-label="Finder tabs" {...props}>
      <WindowTab value="recents">Recents</WindowTab>
      <WindowTab value="home">Home</WindowTab>
      <WindowTab value="documents">Documents</WindowTab>
    </WindowTabBar>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("WindowTabBar", () => {
  it("renders a named tab list with the default tab selected", () => {
    render(<Finder data-testid="bar" />);
    expect(screen.getByTestId("bar")).toHaveClass("mac-window-tab-bar");
    expect(screen.getByRole("tablist", { name: "Finder tabs" })).toHaveClass(
      "mac-window-tab-bar-list",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(tab("Home")).toHaveAttribute("aria-selected", "true");
    expect(tab("Home")).toHaveClass("mac-window-tab-bar-tab");
    expect(tab("Recents")).toHaveAttribute("aria-selected", "false");
  });

  it("selects a tab when it is clicked (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Finder onValueChange={onValueChange} />);

    await user.click(tab("Documents"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("documents");
    expect(tab("Documents")).toHaveAttribute("aria-selected", "true");
    expect(tab("Home")).toHaveAttribute("aria-selected", "false");
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Finder defaultValue={undefined} value="home" onValueChange={onValueChange} />);

    await user.click(tab("Recents"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("recents");
    expect(tab("Home")).toHaveAttribute("aria-selected", "true");
  });

  it("is one tab stop; arrow keys move focus only, Return selects", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Finder />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(tab("Home")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(tab("Documents")).toHaveFocus();
    expect(tab("Documents")).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{Enter}");
    expect(tab("Documents")).toHaveAttribute("aria-selected", "true");

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("selects while the arrow keys move with activateOnFocus", async () => {
    const user = userEvent.setup();
    render(<Finder activateOnFocus />);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(tab("Recents")).toHaveFocus();
    expect(tab("Recents")).toHaveAttribute("aria-selected", "true");
  });

  it("shows the new-tab button only with onNewTab, outside the tab list", async () => {
    const user = userEvent.setup();
    const onNewTab = vi.fn();
    const { rerender } = render(<Finder />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<Finder onNewTab={onNewTab} />);
    const add = screen.getByRole("button", { name: "New Tab" });
    expect(screen.getByRole("tablist")).not.toContainElement(add);
    await user.click(add);
    expect(onNewTab).toHaveBeenCalledTimes(1);

    rerender(<Finder onNewTab={onNewTab} newTabLabel="Neuer Tab" />);
    expect(screen.getByRole("button", { name: "Neuer Tab" })).toBeInTheDocument();
  });

  it("forwards ref, className and native attributes to the bar", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Finder ref={ref} className="extra" id="tabs" />);
    expect(ref.current).toHaveClass("mac-window-tab-bar", "extra");
    expect(ref.current).toHaveAttribute("id", "tabs");
  });
});

describe("WindowTab", () => {
  it("cannot be closed without onClose", async () => {
    const user = userEvent.setup();
    const { container } = render(<Finder />);
    expect(container.querySelector(".mac-window-tab-bar-close")).toBeNull();
    expect(tab("Home")).not.toHaveAttribute("aria-keyshortcuts");

    await user.tab();
    await user.keyboard("{Delete}");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("closes from a named close button beside the tab list, without selecting", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onValueChange = vi.fn();
    render(
      <WindowTabBar defaultValue="a" aria-label="Tabs" onValueChange={onValueChange}>
        <WindowTab value="a">One</WindowTab>
        <WindowTab value="b" onClose={onClose}>
          Two
        </WindowTab>
      </WindowTabBar>,
    );
    // One close button, for the tab that can be closed, named after it.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: "Close Two" });
    expect(close.tagName).toBe("BUTTON");
    // A tab list holds only tabs, and a tab, being a button, holds no button.
    const list = screen.getByRole("tablist");
    expect(list).not.toContainElement(close);
    expect(within(list).getAllByRole("tab")).toHaveLength(list.children.length);
    // The bar stays one tab stop; Delete closes from the keyboard.
    expect(close).toHaveAttribute("tabindex", "-1");

    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
  });

  it("names the close button with closeLabel and the tab's title, whatever the title is", () => {
    render(
      <WindowTabBar defaultValue="a" aria-label="Tabs">
        <WindowTab value="a" id="first" onClose={() => {}} closeLabel="Schließen">
          <em>Eins</em>
        </WindowTab>
      </WindowTabBar>,
    );
    expect(tab("Eins")).toHaveAttribute("id", "first");
    expect(screen.getByRole("button", { name: "Schließen Eins" })).toBeInTheDocument();
  });

  it("gives a disabled tab no close button", () => {
    render(
      <WindowTabBar defaultValue="a" aria-label="Tabs">
        <WindowTab value="a">One</WindowTab>
        <WindowTab value="b" disabled onClose={() => {}}>
          Two
        </WindowTab>
      </WindowTabBar>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the tab's hover look while the pointer is over its close button", async () => {
    const user = userEvent.setup();
    render(
      <WindowTabBar defaultValue="a" aria-label="Tabs">
        <WindowTab value="a" onClose={() => {}}>
          One
        </WindowTab>
      </WindowTabBar>,
    );
    const close = screen.getByRole("button", { name: "Close One" });
    expect(tab("One")).not.toHaveAttribute("data-hover");

    await user.hover(close);
    expect(tab("One")).toHaveAttribute("data-hover");
    expect(close.parentElement).toHaveAttribute("data-hover");

    await user.unhover(close);
    expect(tab("One")).not.toHaveAttribute("data-hover");
  });

  it("closes with Delete and Backspace while focused, and says so", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <WindowTabBar defaultValue="a" aria-label="Tabs">
        <WindowTab value="a" onClose={onClose}>
          One
        </WindowTab>
      </WindowTabBar>,
    );
    expect(tab("One")).toHaveAttribute("aria-keyshortcuts", "Delete");

    await user.tab();
    await user.keyboard("{Delete}");
    await user.keyboard("{Backspace}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close when the caller's key handler prevents the default", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <WindowTabBar defaultValue="a" aria-label="Tabs">
        <WindowTab value="a" onClose={onClose} onKeyDown={(event) => event.preventDefault()}>
          One
        </WindowTab>
      </WindowTabBar>,
    );
    await user.tab();
    await user.keyboard("{Delete}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not select a disabled tab", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <WindowTabBar defaultValue="a" aria-label="Tabs" onValueChange={onValueChange}>
        <WindowTab value="a">One</WindowTab>
        <WindowTab value="b" disabled>
          Two
        </WindowTab>
      </WindowTabBar>,
    );
    await user.click(tab("Two"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
  });
});

describe("the closable example", () => {
  it("puts the panel of the selected tab in the tab order, after the bar", async () => {
    const user = userEvent.setup();
    render(<Closable />);
    await user.tab();
    expect(tab("Home")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "New Tab" })).toHaveFocus();
    // The panel holds only text, so it is a tab stop itself; else the keyboard skips it.
    await user.tab();
    expect(screen.getByRole("tabpanel", { name: "Home" })).toHaveFocus();
  });

  it("closes a tab from its close button and selects a neighbour", async () => {
    const user = userEvent.setup();
    render(<Closable />);
    await user.click(screen.getByRole("button", { name: "Close Home" }));
    expect(screen.queryByRole("tab", { name: "Home" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close Home" })).toBeNull();
    expect(tab("Documents")).toHaveAttribute("aria-selected", "true");
  });
});
