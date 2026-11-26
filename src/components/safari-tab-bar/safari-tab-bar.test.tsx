import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../toolbar";
import { SafariNewTabButton, SafariTab, SafariTabBar, type SafariTabBarProps } from "./index";

function Browser(props: SafariTabBarProps) {
  return (
    <SafariTabBar defaultValue="example" aria-label="Tabs" {...props}>
      <SafariTab value="start">Start Page</SafariTab>
      <SafariTab value="example">Example Domain</SafariTab>
      <SafariTab value="docs">Documentation</SafariTab>
    </SafariTabBar>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("SafariTabBar", () => {
  it("renders a named tab list with the default tab selected", () => {
    render(<Browser data-testid="bar" />);
    expect(screen.getByTestId("bar")).toHaveClass("mac-safari-tab-bar");
    expect(screen.getByRole("tablist", { name: "Tabs" })).toHaveClass("mac-safari-tab-bar-list");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(tab("Example Domain")).toHaveAttribute("aria-selected", "true");
    expect(tab("Example Domain")).toHaveClass("mac-safari-tab-bar-tab");
    expect(tab("Start Page")).toHaveAttribute("aria-selected", "false");
  });

  it("selects a tab when it is clicked (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Browser onValueChange={onValueChange} />);

    await user.click(tab("Documentation"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("docs");
    expect(tab("Documentation")).toHaveAttribute("aria-selected", "true");
    expect(tab("Example Domain")).toHaveAttribute("aria-selected", "false");
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Browser defaultValue={undefined} value="example" onValueChange={onValueChange} />,
    );

    await user.click(tab("Start Page"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("start");
    expect(tab("Example Domain")).toHaveAttribute("aria-selected", "true");

    rerender(<Browser defaultValue={undefined} value="start" onValueChange={onValueChange} />);
    expect(tab("Start Page")).toHaveAttribute("aria-selected", "true");
  });

  it("is one tab stop; arrow keys move focus only, Return and Space select", async () => {
    const user = userEvent.setup();
    render(<Browser />);
    await user.tab();
    expect(tab("Example Domain")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(tab("Documentation")).toHaveFocus();
    expect(tab("Documentation")).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{Enter}");
    expect(tab("Documentation")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(tab("Start Page")).toHaveFocus();
    await user.keyboard(" ");
    expect(tab("Start Page")).toHaveAttribute("aria-selected", "true");
  });

  it("selects while the arrow keys move with activateOnFocus", async () => {
    const user = userEvent.setup();
    render(<Browser activateOnFocus />);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(tab("Start Page")).toHaveFocus();
    expect(tab("Start Page")).toHaveAttribute("aria-selected", "true");
  });

  it("shows the new-tab button only with onNewTab, outside the tab list", async () => {
    const user = userEvent.setup();
    const onNewTab = vi.fn();
    const { rerender } = render(<Browser />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<Browser onNewTab={onNewTab} />);
    const add = screen.getByRole("button", { name: "New Tab" });
    expect(screen.getByRole("tablist")).not.toContainElement(add);
    await user.click(add);
    expect(onNewTab).toHaveBeenCalledTimes(1);

    // It is a tab stop of its own after the tabs, and Return activates it.
    await user.tab({ shift: true });
    expect(tab("Example Domain")).toHaveFocus();
    await user.tab();
    expect(add).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onNewTab).toHaveBeenCalledTimes(2);

    rerender(<Browser onNewTab={onNewTab} newTabLabel="Neuer Tab" />);
    expect(screen.getByRole("button", { name: "Neuer Tab" })).toBeInTheDocument();
  });

  it("forwards ref, className and native attributes to the bar", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Browser ref={ref} className="extra" id="tabs" />);
    expect(ref.current).toHaveClass("mac-safari-tab-bar", "extra");
    expect(ref.current).toHaveAttribute("id", "tabs");
  });
});

describe("SafariTab", () => {
  it("cannot be closed without onClose", async () => {
    const user = userEvent.setup();
    const { container } = render(<Browser />);
    expect(container.querySelector(".mac-safari-tab-bar-close")).toBeNull();
    expect(tab("Example Domain")).not.toHaveAttribute("aria-keyshortcuts");

    await user.tab();
    await user.keyboard("{Delete}");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("closes from its close button without selecting the tab", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onValueChange = vi.fn();
    const { container } = render(
      <SafariTabBar defaultValue="a" aria-label="Tabs" onValueChange={onValueChange}>
        <SafariTab value="a">One</SafariTab>
        <SafariTab value="b" onClose={onClose}>
          Two
        </SafariTab>
      </SafariTabBar>,
    );
    const close = container.querySelector(".mac-safari-tab-bar-close");
    expect(close).toHaveAttribute("aria-hidden", "true");

    await user.click(close as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
  });

  it("closes with Delete and Backspace while focused, and says so", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SafariTabBar defaultValue="a" aria-label="Tabs">
        <SafariTab value="a" onClose={onClose}>
          One
        </SafariTab>
      </SafariTabBar>,
    );
    expect(tab("One")).toHaveAttribute("aria-keyshortcuts", "Delete Backspace");

    await user.tab();
    await user.keyboard("{Delete}");
    await user.keyboard("{Backspace}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("hands the keyboard focus to a neighbour when the focused tab is closed and removed", async () => {
    const user = userEvent.setup();
    const tabRef = vi.fn();
    function Closable() {
      const [names, setNames] = useState(["One", "Two", "Three"]);
      return (
        <SafariTabBar defaultValue="One" aria-label="Tabs">
          {names.map((name) => (
            <SafariTab
              key={name}
              value={name}
              // A new callback on every render: re-attaching it must not move the focus.
              ref={(element) => tabRef(name, element)}
              onClose={() => setNames(names.filter((other) => other !== name))}
            >
              {name}
            </SafariTab>
          ))}
        </SafariTabBar>
      );
    }
    render(<Closable />);
    expect(tabRef).toHaveBeenCalledWith("Two", tab("Two"));

    act(() => tab("Two").focus());
    await user.keyboard("{Delete}");
    // The tab after the closed one takes the focus.
    await waitFor(() => expect(tab("Three")).toHaveFocus());
    expect(screen.queryByRole("tab", { name: "Two" })).toBeNull();
    expect(tabRef).toHaveBeenCalledWith("Two", null);

    await user.keyboard("{Backspace}");
    // The last tab has none after it: the one before takes the focus.
    await waitFor(() => expect(tab("One")).toHaveFocus());
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("passes over disabled tabs when it hands the focus on", async () => {
    const user = userEvent.setup();
    function Closable({ disabled }: { disabled: string[] }) {
      const [names, setNames] = useState(["One", "Two", "Three", "Four"]);
      return (
        <SafariTabBar defaultValue="One" aria-label="Tabs">
          {names.map((name) => (
            <SafariTab
              key={name}
              value={name}
              disabled={disabled.includes(name)}
              onClose={() => setNames(names.filter((other) => other !== name))}
            >
              {name}
            </SafariTab>
          ))}
        </SafariTabBar>
      );
    }
    // The tab after the closed one is disabled: the enabled one beyond it takes the focus.
    const first = render(<Closable disabled={["Three"]} />);
    act(() => tab("Two").focus());
    await user.keyboard("{Delete}");
    await waitFor(() => expect(tab("Four")).toHaveFocus());
    first.unmount();

    // Every tab after it is disabled: the nearest enabled one before it takes the focus.
    render(<Closable disabled={["Two", "Four"]} />);
    act(() => tab("Three").focus());
    await user.keyboard("{Delete}");
    await waitFor(() => expect(tab("One")).toHaveFocus());
  });

  it("leaves the focus alone when a tab that does not have it is removed", async () => {
    const user = userEvent.setup();
    function Closable() {
      const [names, setNames] = useState(["One", "Two"]);
      return (
        <>
          <SafariTabBar defaultValue="One" aria-label="Tabs">
            {names.map((name) => (
              <SafariTab key={name} value={name}>
                {name}
              </SafariTab>
            ))}
          </SafariTabBar>
          <button type="button" onClick={() => setNames(["One"])}>
            Close Two
          </button>
        </>
      );
    }
    render(<Closable />);
    await user.click(screen.getByRole("button", { name: "Close Two" }));
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Close Two" })).toHaveFocus();
  });

  it("does not close when the caller's key handler prevents the default", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SafariTabBar defaultValue="a" aria-label="Tabs">
        <SafariTab value="a" onClose={onClose} onKeyDown={(event) => event.preventDefault()}>
          One
        </SafariTab>
      </SafariTabBar>,
    );
    await user.tab();
    await user.keyboard("{Delete}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not select a disabled tab", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SafariTabBar defaultValue="a" aria-label="Tabs" onValueChange={onValueChange}>
        <SafariTab value="a">One</SafariTab>
        <SafariTab value="b" disabled>
          Two
        </SafariTab>
      </SafariTabBar>,
    );
    await user.click(tab("Two"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
  });

  it("does not close a disabled tab, by key or by pointer", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SafariTabBar defaultValue="a" aria-label="Tabs">
        <SafariTab value="a">One</SafariTab>
        <SafariTab value="b" disabled onClose={onClose}>
          Two
        </SafariTab>
      </SafariTabBar>,
    );
    expect(tab("Two")).not.toHaveAttribute("aria-keyshortcuts");
    expect(tab("Two").querySelector(".mac-safari-tab-bar-close")).toBeNull();
    fireEvent.keyDown(tab("Two"), { key: "Delete" });
    await user.click(tab("Two"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps Backspace from reaching the browser when it closes a tab", () => {
    const onClose = vi.fn();
    render(
      <SafariTabBar defaultValue="a" aria-label="Tabs">
        <SafariTab value="a" onClose={onClose}>
          One
        </SafariTab>
      </SafariTabBar>,
    );
    // dispatchEvent returns false when the default action was prevented.
    expect(fireEvent.keyDown(tab("One"), { key: "Backspace" })).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows an icon before the title without changing the tab's name", () => {
    render(
      <SafariTabBar defaultValue="a" aria-label="Tabs">
        <SafariTab value="a" icon={<svg data-testid="icon" aria-hidden="true" />}>
          One
        </SafariTab>
        <SafariTab value="b">Two</SafariTab>
      </SafariTabBar>,
    );
    expect(tab("One")).toContainElement(screen.getByTestId("icon"));
    expect(tab("Two").querySelector(".mac-safari-tab-bar-icon")).toBeNull();
  });

  it("forwards ref, className and native attributes to the tab", () => {
    const ref = createRef<HTMLElement>();
    render(
      <SafariTabBar defaultValue="a" aria-label="Tabs">
        <SafariTab value="a" ref={ref} className="extra" id="first">
          One
        </SafariTab>
      </SafariTabBar>,
    );
    expect(ref.current).toBe(tab("One"));
    expect(ref.current).toHaveClass("mac-safari-tab-bar-tab", "extra");
    expect(ref.current).toHaveAttribute("id", "first");
  });
});

describe("SafariNewTabButton", () => {
  it("is a button named New Tab that reports a click, and can be renamed", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <SafariNewTabButton ref={ref} className="extra" onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "New Tab" });
    expect(ref.current).toBe(button);
    expect(button).toHaveClass("mac-safari-tab-bar-new", "extra");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<SafariNewTabButton aria-label="Nieuw tabblad" />);
    expect(screen.getByRole("button", { name: "Nieuw tabblad" })).toBeInTheDocument();
  });

  it("is one of the items of the toolbar it is in: the arrow keys reach it", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Browser toolbar">
        <SafariNewTabButton aria-label="First" />
        <SafariNewTabButton />
      </Toolbar>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "New Tab" })).toHaveFocus();
    // One tab stop: Tab leaves the toolbar.
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
