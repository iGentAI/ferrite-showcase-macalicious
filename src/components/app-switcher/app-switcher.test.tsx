import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type KeyboardEvent, type MouseEvent, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedWindow } from "../managed-window";
import { WindowBody } from "../window";
import { useWindowManager, WindowManager } from "../window-manager";
import { AppSwitcher, AppSwitcherItem, type AppSwitcherProps } from "./index";

const items = (
  <>
    <AppSwitcherItem value="terminal" icon={<svg data-testid="terminal-icon" />}>
      Terminal
    </AppSwitcherItem>
    <AppSwitcherItem value="preferences">System Preferences</AppSwitcherItem>
    <AppSwitcherItem value="finder">Finder</AppSwitcherItem>
  </>
);

/** A button that opens the switcher, the switcher, and something else to move the focus to. */
function Example(props: AppSwitcherProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Switch
      </button>
      <button type="button">Elsewhere</button>
      <AppSwitcher
        {...props}
        open={open}
        onOpenChange={(next) => {
          props.onOpenChange?.(next);
          setOpen(next);
        }}
      >
        {props.children ?? items}
      </AppSwitcher>
    </>
  );
}

const switcher = () => screen.getByRole("listbox");
const option = (name: string) => screen.getByRole("option", { name });
const selected = () => screen.getByRole("option", { selected: true });
const button = (name: string) => screen.getByRole("button", { name });

async function opened(props: AppSwitcherProps = {}) {
  const user = userEvent.setup();
  render(<Example {...props} />);
  await user.click(button("Switch"));
  return user;
}

describe("AppSwitcher", () => {
  it("renders nothing until it is open", () => {
    render(<AppSwitcher>{items}</AppSwitcher>);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("opens as a named horizontal listbox with one named option per application", () => {
    render(<AppSwitcher defaultOpen>{items}</AppSwitcher>);
    expect(switcher()).toHaveAccessibleName("Applications");
    expect(switcher()).toHaveAttribute("aria-orientation", "horizontal");
    expect(switcher()).toHaveClass("mac-app-switcher");
    expect(screen.getAllByRole("option").map((item) => item.textContent)).toEqual([
      "Terminal",
      "System Preferences",
      "Finder",
    ]);
    expect(option("Terminal")).toContainElement(screen.getByTestId("terminal-icon"));
    expect(option("Terminal")).toHaveAttribute("data-value", "terminal");
  });

  it("takes the keyboard focus and selects the second application, the one used before", () => {
    const onValueChange = vi.fn();
    render(
      <AppSwitcher defaultOpen onValueChange={onValueChange}>
        {items}
      </AppSwitcher>,
    );
    expect(switcher()).toHaveFocus();
    expect(selected()).toBe(option("System Preferences"));
    expect(selected()).toHaveAttribute("data-selected");
    expect(option("Terminal")).not.toHaveAttribute("data-selected");
    expect(option("Terminal")).toHaveAttribute("aria-selected", "false");
    expect(switcher()).toHaveAttribute("aria-activedescendant", selected().id);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("preferences");
  });

  it("selects the only application when there is one", () => {
    render(
      <AppSwitcher defaultOpen>
        <AppSwitcherItem value="finder">Finder</AppSwitcherItem>
      </AppSwitcher>,
    );
    expect(selected()).toBe(option("Finder"));
  });

  it("opens on defaultValue, each time it opens", async () => {
    const user = await opened({ defaultValue: "finder" });
    expect(selected()).toBe(option("Finder"));
    await user.keyboard("{ArrowLeft}{Escape}");
    await user.click(button("Switch"));
    expect(selected()).toBe(option("Finder"));
  });

  it("moves the selection with Tab and Shift-Tab, round the ends, without leaving", async () => {
    const onValueChange = vi.fn();
    const user = await opened({ onValueChange });
    await user.tab();
    expect(selected()).toBe(option("Finder"));
    await user.tab();
    expect(selected()).toBe(option("Terminal"));
    await user.tab({ shift: true });
    expect(selected()).toBe(option("Finder"));
    await user.tab({ shift: true });
    expect(selected()).toBe(option("System Preferences"));
    expect(switcher()).toHaveFocus();
    expect(switcher()).toHaveAttribute("aria-activedescendant", selected().id);
    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([
      "preferences",
      "finder",
      "terminal",
      "finder",
      "preferences",
    ]);
  });

  it("moves the selection with the arrow keys, Home and End", async () => {
    const user = await opened();
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe(option("Finder"));
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe(option("Terminal"));
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe(option("Finder"));
    await user.keyboard("{Home}");
    expect(selected()).toBe(option("Terminal"));
    await user.keyboard("{End}");
    expect(selected()).toBe(option("Finder"));
  });

  it("turns the arrow keys round in a right-to-left page", async () => {
    const user = await opened({ style: { direction: "rtl" } });
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe(option("Finder"));
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(selected()).toBe(option("Terminal"));
  });

  it.each([
    ["Return", "{Enter}"],
    ["Space", " "],
  ])("chooses the selected application with %s and closes", async (_name, key) => {
    const onChoose = vi.fn();
    const onOpenChange = vi.fn();
    const user = await opened({ onChoose, onOpenChange });
    await user.keyboard(`{ArrowRight}${key}`);
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("finder");
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes with Escape without choosing", async () => {
    const onChoose = vi.fn();
    const onOpenChange = vi.fn();
    const user = await opened({ onChoose, onOpenChange });
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects the application under the pointer and chooses it on a click", async () => {
    const onChoose = vi.fn();
    const onValueChange = vi.fn();
    const user = await opened({ onChoose, onValueChange });
    await user.hover(option("Finder"));
    expect(selected()).toBe(option("Finder"));
    expect(onValueChange).toHaveBeenLastCalledWith("finder");
    expect(onChoose).not.toHaveBeenCalled();
    await user.click(option("Terminal"));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("terminal");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("gives the focus back to where it came from when it closes", async () => {
    const user = await opened();
    expect(switcher()).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(button("Switch")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(switcher()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(button("Switch")).toHaveFocus();
  });

  it("closes without choosing when the focus leaves it, and lets the focus go", async () => {
    const onChoose = vi.fn();
    const onOpenChange = vi.fn();
    const user = await opened({ onChoose, onOpenChange });
    await user.click(button("Elsewhere"));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onChoose).not.toHaveBeenCalled();
    expect(button("Elsewhere")).toHaveFocus();
  });

  it("leaves the focus where onChoose moved it", async () => {
    const onOpenChange = vi.fn();
    const user = await opened({ onOpenChange, onChoose: () => button("Elsewhere").focus() });
    await user.keyboard("{Enter}");
    expect(button("Elsewhere")).toHaveFocus();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("opens and closes on its own when open is not controlled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AppSwitcher defaultOpen onOpenChange={onOpenChange}>
        {items}
      </AppSwitcher>,
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("leaves a controlled open to its owner", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AppSwitcher open onOpenChange={onOpenChange}>
        {items}
      </AppSwitcher>,
    );
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(switcher()).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(switcher()).toBeInTheDocument();
  });

  it("leaves a controlled selection to its owner", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onChoose = vi.fn();
    render(
      <AppSwitcher open value="terminal" onValueChange={onValueChange} onChoose={onChoose}>
        {items}
      </AppSwitcher>,
    );
    expect(selected()).toBe(option("Terminal"));
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("preferences");
    expect(selected()).toBe(option("Terminal"));
    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("terminal");
  });

  it("follows a controlled selection", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("finder");
      return (
        <AppSwitcher open value={value} onValueChange={setValue}>
          {items}
        </AppSwitcher>
      );
    }
    render(<Controlled />);
    expect(selected()).toBe(option("Finder"));
    await user.keyboard("{Tab}");
    expect(selected()).toBe(option("Terminal"));
    await user.hover(option("System Preferences"));
    expect(selected()).toBe(option("System Preferences"));
  });

  it("leaves a key to a handler that prevents its default", async () => {
    const onOpenChange = vi.fn();
    const onKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
    const user = await opened({ onOpenChange, onKeyDown });
    await user.keyboard("{ArrowRight}{Escape}");
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(selected()).toBe(option("System Preferences"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not handle a key it has no use for", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <AppSwitcher defaultOpen onKeyDown={onKeyDown}>
        {items}
      </AppSwitcher>,
    );
    await user.keyboard("q");
    expect(onKeyDown.mock.lastCall?.[0].defaultPrevented).toBe(false);
    expect(selected()).toBe(option("System Preferences"));
  });

  it("renders on the server, open", () => {
    const html = renderToString(<AppSwitcher defaultOpen>{items}</AppSwitcher>);
    expect(html).toContain('role="listbox"');
    expect(html).toContain("System Preferences");
  });

  it("switches applications of a window manager: most recently used first, focus to the chosen window", async () => {
    const user = userEvent.setup();
    function Switcher({ open, onOpenChange }: Pick<AppSwitcherProps, "open" | "onOpenChange">) {
      const { windows, focus } = useWindowManager();
      return (
        <AppSwitcher
          open={open}
          onOpenChange={onOpenChange}
          onChoose={(app) => {
            const front = windows.findLast((w) => w.app === app);
            if (front) focus(front.id);
          }}
        >
          {[...new Set(windows.map((w) => w.app).reverse())].map((app) => (
            <AppSwitcherItem key={app} value={app}>
              {app}
            </AppSwitcherItem>
          ))}
        </AppSwitcher>
      );
    }
    function Desktop() {
      const [open, setOpen] = useState(false);
      return (
        <WindowManager>
          {["Notes", "Mail"].map((name) => (
            <ManagedWindow key={name} id={name} app={name} title={name} aria-label={name}>
              <WindowBody>{name}</WindowBody>
            </ManagedWindow>
          ))}
          <button type="button" onClick={() => setOpen(true)}>
            Switch
          </button>
          <Switcher open={open} onOpenChange={setOpen} />
        </WindowManager>
      );
    }
    render(<Desktop />);
    const notes = screen.getByRole("region", { name: "Notes" });
    const mail = screen.getByRole("region", { name: "Mail" });
    expect(mail).toHaveAttribute("data-window-state", "key");
    await user.click(button("Switch"));
    // Mail was used last, so it is first, and the switcher opens on the one before it.
    expect(screen.getAllByRole("option").map((item) => item.textContent)).toEqual([
      "Mail",
      "Notes",
    ]);
    expect(selected()).toBe(option("Notes"));
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(notes).toHaveAttribute("data-window-state", "key");
    expect(mail).toHaveAttribute("data-window-state", "inactive");
    expect(notes).toContainElement(document.activeElement as HTMLElement);
  });

  it("forwards ref, className, style and other attributes on the switcher", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <AppSwitcher
        defaultOpen
        ref={ref}
        className="hud"
        style={{ top: 10 }}
        id="switcher"
        aria-label="Running applications"
        data-kind="apps"
      >
        {items}
      </AppSwitcher>,
    );
    expect(ref.current).toBe(screen.getByRole("listbox", { name: "Running applications" }));
    expect(ref.current).toHaveClass("mac-app-switcher", "hud");
    expect(ref.current).toHaveStyle({ top: "10px" });
    expect(ref.current).toHaveAttribute("id", "switcher");
    expect(ref.current).toHaveAttribute("data-kind", "apps");
  });

  it("forwards ref, className, style, attributes and handlers on an item", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
    const onChoose = vi.fn();
    render(
      <AppSwitcher defaultOpen onChoose={onChoose}>
        <AppSwitcherItem value="finder">Finder</AppSwitcherItem>
        <AppSwitcherItem
          value="my notes"
          ref={ref}
          className="app"
          style={{ order: 1 }}
          data-badge="3"
          onClick={onClick}
        >
          Notes
        </AppSwitcherItem>
      </AppSwitcher>,
    );
    expect(ref.current).toBe(option("Notes"));
    expect(ref.current).toHaveClass("mac-app-switcher-item", "app");
    expect(ref.current).toHaveStyle({ order: "1" });
    expect(ref.current).toHaveAttribute("data-badge", "3");
    // A value with a space still gives an id that aria-activedescendant can name.
    expect(ref.current?.id).not.toMatch(/\s/);
    expect(switcher()).toHaveAttribute("aria-activedescendant", ref.current?.id);
    await user.click(option("Notes"));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onChoose).not.toHaveBeenCalled();
    expect(switcher()).toBeInTheDocument();
  });
});
