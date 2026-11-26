import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, Fragment, useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { PreferencesToolbar, PreferencesToolbarItem } from "../preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowFooter,
  PreferencesWindowForm,
  PreferencesWindowPane,
  PreferencesWindowRow,
} from "./index";

const toolbar = (
  <PreferencesToolbar aria-label="Preferences">
    <PreferencesToolbarItem value="general">General</PreferencesToolbarItem>
    <PreferencesToolbarItem value="accounts">Accounts</PreferencesToolbarItem>
  </PreferencesToolbar>
);

function Prefs(props: Partial<React.ComponentProps<typeof PreferencesWindow>>) {
  return (
    <PreferencesWindow toolbar={toolbar} data-testid="window" {...props}>
      <PreferencesWindowPane value="general">General pane</PreferencesWindowPane>
      <PreferencesWindowPane value="accounts">Accounts pane</PreferencesWindowPane>
    </PreferencesWindow>
  );
}

const item = (name: string) => screen.getByRole("tab", { name });

describe("PreferencesWindow", () => {
  it("is a key window named by its title, showing the first item's pane", () => {
    render(<Prefs />);
    const frame = screen.getByRole("region", { name: "General" });
    expect(frame).toBe(screen.getByTestId("window"));
    expect(frame).toHaveClass("mac-window", "mac-preferences-window");
    expect(frame).toHaveAttribute("data-window-state", "key");
    expect(frame).not.toHaveAttribute("data-modal");
    expect(item("General")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("General pane");
    expect(screen.getByRole("tabpanel")).toHaveClass("mac-preferences-window-pane");
  });

  it("retitles the window to the selected item and swaps the pane", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Prefs onValueChange={onValueChange} />);
    await user.click(item("Accounts"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("accounts");
    expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Accounts pane");
    expect(screen.queryByText("General pane")).not.toBeInTheDocument();
  });

  it("starts on defaultValue", () => {
    render(<Prefs defaultValue="accounts" />);
    expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument();
    expect(item("Accounts")).toHaveAttribute("aria-selected", "true");
  });

  it("starts with no pane when defaultValue is null", () => {
    render(<Prefs defaultValue={null} aria-label="Preferences" />);
    expect(item("General")).toHaveAttribute("aria-selected", "false");
    expect(item("Accounts")).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  });

  it("starts on the first item that is not disabled", () => {
    render(
      <PreferencesWindow
        toolbar={
          <PreferencesToolbar aria-label="Preferences">
            <PreferencesToolbarItem value="general" disabled>
              General
            </PreferencesToolbarItem>
            <PreferencesToolbarItem value="accounts">Accounts</PreferencesToolbarItem>
          </PreferencesToolbar>
        }
      >
        <PreferencesWindowPane value="general">General pane</PreferencesWindowPane>
        <PreferencesWindowPane value="accounts">Accounts pane</PreferencesWindowPane>
      </PreferencesWindow>,
    );
    expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument();
    expect(item("Accounts")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Accounts pane");
  });

  it("stays on a controlled value, title included, until the value changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Prefs value="general" onValueChange={onValueChange} />);
    await user.click(item("Accounts"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("accounts");
    expect(screen.getByRole("region", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("General pane");
    rerender(<Prefs value="accounts" onValueChange={onValueChange} />);
    expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Accounts pane");
  });

  it("keeps the pane when a change is cancelled", async () => {
    const user = userEvent.setup();
    render(<Prefs onValueChange={(_value, details) => details.cancel()} />);
    await user.click(item("Accounts"));
    expect(screen.getByRole("region", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("General pane");
  });

  it("uses a given title instead of the item's label", async () => {
    const user = userEvent.setup();
    render(<Prefs title="Mail Preferences" />);
    await user.click(item("Accounts"));
    expect(screen.getByRole("region", { name: "Mail Preferences" })).toBeInTheDocument();
  });

  it("has window controls with minimize and zoom disabled, and reports Close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Prefs onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports a press on its title bar, and not one on a control or a toolbar item, for a window manager", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Prefs
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    for (const control of [screen.getByRole("button", { name: "Close" }), item("Accounts")]) {
      await user.pointer([{ keys: "[MouseLeft>]", target: control }, { keys: "[/MouseLeft]" }]);
      await user.dblClick(control);
    }
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
    const bar = screen
      .getByTestId("window")
      .querySelector("[data-window-drag-region]") as HTMLElement;
    await user.pointer([{ keys: "[MouseLeft>]", target: bar }, { keys: "[/MouseLeft]" }]);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("does not close a modeless window with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Prefs onClose={onClose} />);
    await user.tab();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is a dialog without window controls that Escape closes, in the modal kind", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Prefs modal onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "General" });
    // It neither contains focus nor makes the page inert, so it must not claim to be modal.
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog).toHaveAttribute("data-modal");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await user.click(item("Accounts"));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape alone when a handler inside prevented it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Prefs modal onClose={onClose} onKeyDown={(event) => event.preventDefault()} />);
    await user.click(item("Accounts"));
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows given controls, or none for null", () => {
    const { rerender } = render(<Prefs controls={<button type="button">Custom</button>} />);
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    rerender(<Prefs controls={null} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows controls given to the modal kind, which has none of its own", () => {
    render(<Prefs modal controls={<button type="button">Custom</button>} />);
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("takes the focus when the modal kind appears, so that Escape closes it at once", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Prefs modal onClose={onClose} />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives the focus back to where it was when the modal kind goes", async () => {
    const user = userEvent.setup();
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Preferences
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Close from outside
          </button>
          {open ? <Prefs modal onClose={() => setOpen(false)} /> : null}
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Preferences" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.click(item("Accounts"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    // Focus that has moved on by itself is left where it is.
    await user.click(opener);
    const outside = screen.getByRole("button", { name: "Close from outside" });
    await user.click(outside);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
  });

  it("gives the focus back to the opener when a control in a pane took it with autoFocus", async () => {
    const user = userEvent.setup();
    // Spread, as the accessibility lint has no exception for the case under test.
    const focused = { autoFocus: true };
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Preferences
          </button>
          {open ? (
            <PreferencesWindow modal toolbar={toolbar} onClose={() => setOpen(false)}>
              <PreferencesWindowPane value="general">
                <input aria-label="Name" {...focused} />
              </PreferencesWindowPane>
            </PreferencesWindow>
          ) : null}
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Preferences" });
    await user.click(opener);
    // The control keeps the focus it asked for; the window does not take it away.
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("leaves the focus with a control in a portal that took it with autoFocus", async () => {
    const user = userEvent.setup();
    const focused = { autoFocus: true };
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Preferences
          </button>
          {open ? (
            <PreferencesWindow modal toolbar={toolbar} onClose={() => setOpen(false)}>
              <PreferencesWindowPane value="general">
                {createPortal(<input aria-label="Search" {...focused} />, document.body)}
              </PreferencesWindowPane>
            </PreferencesWindow>
          ) : null}
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Preferences" });
    await user.click(opener);
    // The control is outside the window's element, and the window still leaves it the focus.
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("does not take the focus when it is not the modal kind", () => {
    render(<Prefs />);
    expect(document.body).toHaveFocus();
    expect(screen.getByTestId("window")).not.toHaveAttribute("tabindex");
  });

  it("leaves Escape to a pop-up that is open in a pane, in the window or in a portal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PreferencesWindow modal toolbar={toolbar} onClose={onClose}>
        <PreferencesWindowPane value="general">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded="true"
            aria-controls="inline-sizes"
          >
            Open pop-up
          </button>
          <div id="inline-sizes">
            <div role="listbox" aria-label="Inline sizes">
              <div role="option" aria-selected="false" tabIndex={0}>
                Small
              </div>
            </div>
          </div>
          <button type="button" aria-haspopup="listbox" aria-expanded="false">
            Closed pop-up
          </button>
          {createPortal(
            <div role="listbox" aria-label="Sizes">
              <div role="option" aria-selected="true" tabIndex={0}>
                Medium
              </div>
            </div>,
            document.body,
          )}
        </PreferencesWindowPane>
      </PreferencesWindow>,
    );
    screen.getByRole("button", { name: "Open pop-up" }).focus();
    await user.keyboard("{Escape}");
    // The focus has moved from the button into its list, which is in the pane: the open
    // button names what holds the list.
    screen.getByRole("option", { name: "Small" }).focus();
    await user.keyboard("{Escape}");
    // React hands a portal's events to the window too: the list is outside it all the same.
    screen.getByRole("option", { name: "Medium" }).focus();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Closed pop-up" }).focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("answers Escape from a control in a portal and from a list that is part of a pane", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PreferencesWindow modal toolbar={toolbar} onClose={onClose}>
        <PreferencesWindowPane value="general">
          <button type="button" aria-expanded="false" aria-controls="accounts-list">
            Show accounts
          </button>
          <div id="accounts-list" role="listbox" aria-label="Accounts">
            <div role="option" aria-selected="false" tabIndex={0}>
              iCloud
            </div>
          </div>
          {createPortal(<button type="button">In a portal</button>, document.body)}
        </PreferencesWindowPane>
      </PreferencesWindow>,
    );
    // A list in the pane is not a pop-up, unless a button that is open names it.
    screen.getByRole("option", { name: "iCloud" }).focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "In a portal" }).focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("reads the toolbar through nested, keyed fragments and past children that are not items", () => {
    // Keyed, as a toolbar built from a grouped list has them: a fragment that holds a group.
    const grouped = (
      <PreferencesToolbar aria-label="Preferences">
        <span aria-hidden="true" />
        <Fragment key="system">
          <PreferencesToolbarItem value="general" disabled>
            General
          </PreferencesToolbarItem>
          <Fragment key="user">
            <PreferencesToolbarItem value="accounts">Accounts</PreferencesToolbarItem>
            <PreferencesToolbarItem value="advanced">Advanced</PreferencesToolbarItem>
          </Fragment>
        </Fragment>
      </PreferencesToolbar>
    );
    render(
      <PreferencesWindow toolbar={grouped}>
        <PreferencesWindowPane value="accounts">Accounts pane</PreferencesWindowPane>
        <PreferencesWindowPane value="advanced">Advanced pane</PreferencesWindowPane>
      </PreferencesWindow>,
    );
    // The first enabled item that has a value is selected, and titles the window.
    expect(screen.getByRole("region", { name: "Accounts" })).toBeInTheDocument();
    expect(item("Accounts")).toHaveAttribute("aria-selected", "true");
    expect(item("Advanced")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Accounts pane");
  });

  it("draws a focus ring on a pane that holds the keyboard focus, in a key window only", () => {
    // jsdom lays nothing out and matches no :focus-visible, so the rule itself is read.
    const css = readFileSync(path.join(import.meta.dirname, "preferences-window.css"), "utf8");
    const rule =
      /\.mac-preferences-window-pane:where\(:focus-visible, \[data-force~="focus"\]\):where\(\s*:not\(:where\(\[data-window-state="main"\], \[data-window-state="inactive"\]\) \*\)\s*\) \{([^}]*)\}/.exec(
        css,
      )?.[1] ?? "";
    expect(rule).toMatch(
      /outline: var\(--mac-focus-ring-width\) solid var\(--mac-focus-ring-color\);/,
    );
  });

  it("does not animate for a visitor who prefers reduced motion", async () => {
    const user = userEvent.setup();
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    const matchMedia = vi.fn((query: string) => ({ matches: query.includes("reduce") }));
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      render(
        <Prefs
          ref={(element: HTMLDivElement | null) => {
            if (!element) return;
            Object.defineProperty(element, "animate", { value: animate, configurable: true });
            Object.defineProperty(element, "offsetHeight", {
              get: () => (element.textContent?.includes("Accounts pane") ? 500 : 300),
              configurable: true,
            });
          }}
        />,
      );
      await user.click(item("Accounts"));
      expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
      expect(animate).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("passes the window state and the frame size to the window", () => {
    render(<Prefs state="inactive" width={500} height={300} />);
    const frame = screen.getByTestId("window");
    expect(frame).toHaveAttribute("data-window-state", "inactive");
    expect(frame).toHaveStyle({ width: "500px", height: "300px" });
  });

  it("animates the frame from the old pane's size to the new one's", async () => {
    const user = userEvent.setup();
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    function Sized() {
      const [value, setValue] = useState<string | null>("general");
      return (
        <Prefs
          value={value}
          onValueChange={setValue}
          ref={(element: HTMLDivElement | null) => {
            if (!element) return;
            Object.defineProperty(element, "animate", { value: animate, configurable: true });
            Object.defineProperty(element, "offsetWidth", { get: () => 400, configurable: true });
            Object.defineProperty(element, "offsetHeight", {
              get: () => (element.textContent?.includes("Accounts pane") ? 500 : 300),
              configurable: true,
            });
          }}
        />
      );
    }
    render(<Sized />);
    expect(animate).not.toHaveBeenCalled();
    await user.click(item("Accounts"));
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]).toEqual([
      [
        { width: "400px", height: "300px" },
        { width: "400px", height: "500px" },
      ],
      { duration: 200, easing: "ease-in-out" },
    ]);
  });

  it("animates from the frame as displayed when the change is asked for", async () => {
    const user = userEvent.setup();
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    // The General pane grows after it was first measured (content loaded, fonts swapped).
    let general = 300;
    render(
      <Prefs
        ref={(element: HTMLDivElement | null) => {
          if (!element) return;
          Object.defineProperty(element, "animate", { value: animate, configurable: true });
          Object.defineProperty(element, "offsetWidth", { get: () => 400, configurable: true });
          Object.defineProperty(element, "offsetHeight", {
            get: () => (element.textContent?.includes("Accounts pane") ? 500 : general),
            configurable: true,
          });
        }}
      />,
    );
    general = 360;
    await user.click(item("Accounts"));
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith(
      [
        { width: "400px", height: "360px" },
        { width: "400px", height: "500px" },
      ],
      { duration: 200, easing: "ease-in-out" },
    );
  });

  it("animates a change made from outside from the frame as it is displayed", () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    const observers: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    let general = 300;
    const size = (element: HTMLDivElement | null) => {
      if (!element) return;
      Object.defineProperty(element, "animate", { value: animate, configurable: true });
      Object.defineProperty(element, "offsetWidth", { get: () => 400, configurable: true });
      Object.defineProperty(element, "offsetHeight", {
        get: () => (element.textContent?.includes("Accounts pane") ? 500 : general),
        configurable: true,
      });
    };
    try {
      const { rerender } = render(<Prefs value="general" ref={size} />);
      // The General pane grows after it was first measured, and the browser reports it.
      general = 360;
      const frame = screen.getByTestId("window");
      for (const report of observers) {
        report([{ target: frame } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      }
      rerender(<Prefs value="accounts" ref={size} />);
      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate).toHaveBeenCalledWith(
        [
          { width: "400px", height: "360px" },
          { width: "400px", height: "500px" },
        ],
        { duration: 200, easing: "ease-in-out" },
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not animate when animated is false", async () => {
    const user = userEvent.setup();
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    render(
      <Prefs
        animated={false}
        ref={(element: HTMLDivElement | null) => {
          if (!element) return;
          Object.defineProperty(element, "animate", { value: animate, configurable: true });
          Object.defineProperty(element, "offsetHeight", {
            get: () => (element.textContent?.includes("Accounts pane") ? 500 : 300),
            configurable: true,
          });
        }}
      />,
    );
    await user.click(item("Accounts"));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Accounts pane");
    expect(animate).not.toHaveBeenCalled();
  });

  it("forwards ref, className and native attributes to the frame", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Prefs ref={ref} className="extra" id="prefs" />);
    expect(ref.current).toBe(screen.getByTestId("window"));
    expect(ref.current).toHaveClass("mac-preferences-window", "extra");
    expect(ref.current).toHaveAttribute("id", "prefs");
  });
});

describe("PreferencesWindowForm", () => {
  it("labels the one control named by labelFor", () => {
    render(
      <PreferencesWindowForm data-testid="form">
        <PreferencesWindowRow label="Name:" labelFor="name">
          <input id="name" />
        </PreferencesWindowRow>
      </PreferencesWindowForm>,
    );
    expect(screen.getByTestId("form")).toHaveClass("mac-preferences-window-form");
    expect(screen.getByLabelText("Name:")).toHaveAttribute("id", "name");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("groups a row's controls under its label when there is no labelFor", () => {
    render(
      <PreferencesWindowRow label="Show:">
        <button type="button">Birthdays</button>
        <button type="button">Holidays</button>
      </PreferencesWindowRow>,
    );
    const group = screen.getByRole("group", { name: "Show:" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });

  it("renders a row without a label as plain content in the control column", () => {
    render(
      <PreferencesWindowRow data-testid="row">
        <button type="button">Holidays</button>
      </PreferencesWindowRow>,
    );
    const row = screen.getByTestId("row");
    expect(row.querySelector(".mac-form-label")).toBeNull();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(row.querySelector(".mac-form-controls")).toContainElement(
      screen.getByRole("button", { name: "Holidays" }),
    );
  });

  it("hands its row and label gap hooks to the form, and keeps a style of its own", () => {
    render(<PreferencesWindowForm data-testid="form" style={{ width: 300 }} />);
    const form = screen.getByTestId("form");
    expect(form).toHaveClass("mac-form", "mac-preferences-window-form");
    expect(form.style.getPropertyValue("--mac-form-row-gap")).toBe(
      "var(--mac-preferences-window-row-gap, 10px)",
    );
    expect(form.style.getPropertyValue("--mac-form-label-gap")).toContain(
      "--mac-preferences-window-label-gap",
    );
    expect(form.style.width).toBe("300px");
  });

  it("reflects the row alignment", () => {
    const { rerender } = render(<PreferencesWindowRow data-testid="row" label="A:" />);
    expect(screen.getByTestId("row")).toHaveAttribute("data-align", "baseline");
    rerender(<PreferencesWindowRow data-testid="row" label="A:" align="center" />);
    expect(screen.getByTestId("row")).toHaveAttribute("data-align", "center");
  });

  it("renders a zero given as the footer's leading content, and no box without any", () => {
    const { rerender } = render(<PreferencesWindowFooter data-testid="footer" leading={0} />);
    const footer = screen.getByTestId("footer");
    expect(footer.querySelector(".mac-preferences-window-footer-leading")).toHaveTextContent("0");
    rerender(<PreferencesWindowFooter data-testid="footer" />);
    expect(footer.querySelector(".mac-preferences-window-footer-leading")).toBeNull();
  });

  it("puts the footer's leading content in its own box, before the buttons", () => {
    render(
      <PreferencesWindowFooter data-testid="footer" leading={<button type="button">Help</button>}>
        <button type="button">Cancel</button>
        <button type="button">OK</button>
      </PreferencesWindowFooter>,
    );
    const footer = screen.getByTestId("footer");
    expect(footer).toHaveClass("mac-preferences-window-footer");
    expect(footer.querySelector(".mac-preferences-window-footer-leading")).toContainElement(
      screen.getByRole("button", { name: "Help" }),
    );
    expect(
      within(footer)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Help", "Cancel", "OK"]);
  });

  it("forwards ref, className and native attributes on the form parts", () => {
    const form = createRef<HTMLDivElement>();
    const row = createRef<HTMLDivElement>();
    const footer = createRef<HTMLDivElement>();
    render(
      <>
        <PreferencesWindowForm ref={form} className="f" id="form">
          <PreferencesWindowRow ref={row} className="r" id="row" label="A:" />
        </PreferencesWindowForm>
        <PreferencesWindowFooter ref={footer} className="x" id="footer" />
      </>,
    );
    expect(form.current).toHaveClass("mac-preferences-window-form", "f");
    expect(form.current).toHaveAttribute("id", "form");
    expect(row.current).toHaveClass("mac-preferences-window-row", "r");
    expect(row.current).toHaveAttribute("id", "row");
    expect(footer.current).toHaveClass("mac-preferences-window-footer", "x");
    expect(footer.current).toHaveAttribute("id", "footer");
  });
});
