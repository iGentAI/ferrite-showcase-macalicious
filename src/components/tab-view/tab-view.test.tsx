import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "./index";

function Sound(
  props: Partial<React.ComponentProps<typeof TabView>> & { activateOnFocus?: boolean },
) {
  const { activateOnFocus, ...root } = props;
  return (
    <TabView defaultValue="effects" {...root}>
      <TabViewList aria-label="Sound" activateOnFocus={activateOnFocus}>
        <TabViewTab value="effects">Sound Effects</TabViewTab>
        <TabViewTab value="output">Output</TabViewTab>
        <TabViewTab value="input">Input</TabViewTab>
      </TabViewList>
      <TabViewPanel value="effects">Effects pane</TabViewPanel>
      <TabViewPanel value="output">Output pane</TabViewPanel>
      <TabViewPanel value="input">Input pane</TabViewPanel>
    </TabView>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("TabView", () => {
  it("renders a tab list, its tabs and the selected pane only", () => {
    render(<Sound />);
    expect(screen.getByRole("tablist", { name: "Sound" })).toHaveClass("mac-tab-view-list");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(tab("Sound Effects")).toHaveAttribute("aria-selected", "true");
    expect(tab("Sound Effects")).toHaveAttribute("data-active");
    expect(tab("Output")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Effects pane");
    expect(screen.queryByText("Output pane")).not.toBeInTheDocument();
  });

  it("defaults to top tabs, a bezel border and the regular size", () => {
    render(<Sound data-testid="root" />);
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("mac-tab-view");
    expect(root).toHaveAttribute("data-tab-position", "top");
    expect(root).toHaveAttribute("data-border", "bezel");
    expect(root).toHaveAttribute("data-size", "regular");
    expect(screen.getByRole("tablist")).not.toHaveAttribute("aria-orientation", "vertical");
  });

  it("reflects tab position, border and size as data attributes", () => {
    render(<Sound data-testid="root" tabPosition="bottom" border="line" size="small" />);
    const root = screen.getByTestId("root");
    expect(root).toHaveAttribute("data-tab-position", "bottom");
    expect(root).toHaveAttribute("data-border", "line");
    expect(root).toHaveAttribute("data-size", "small");
  });

  it("shows a tab's pane when the tab is clicked (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Sound onValueChange={onValueChange} />);
    await user.click(tab("Output"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("output");
    expect(tab("Output")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Output pane");
  });

  it("is one tab stop, and the arrow keys move the selection, as in AppKit", async () => {
    const user = userEvent.setup();
    render(<Sound />);
    await user.tab();
    expect(tab("Sound Effects")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(tab("Output")).toHaveFocus();
    expect(tab("Output")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Output pane");

    await user.keyboard("{ArrowLeft}");
    expect(tab("Sound Effects")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(tab("Input")).toHaveAttribute("aria-selected", "true");

    // Tab leaves the strip for the pane.
    await user.tab();
    expect(screen.getByRole("tabpanel")).toHaveFocus();
  });

  it("only moves focus with the arrow keys when activateOnFocus is off", async () => {
    const user = userEvent.setup();
    render(<Sound activateOnFocus={false} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(tab("Output")).toHaveFocus();
    expect(tab("Output")).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{Enter}");
    expect(tab("Output")).toHaveAttribute("aria-selected", "true");
  });

  it("selects a pressed tab when the press is completed, not when the press focuses it", () => {
    const onFocus = vi.fn();
    render(
      <TabView defaultValue="effects">
        <TabViewList aria-label="Sound">
          <TabViewTab value="effects">Sound Effects</TabViewTab>
          <TabViewTab value="output" onFocus={onFocus}>
            Output
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="effects">Effects pane</TabViewPanel>
        <TabViewPanel value="output">Output pane</TabViewPanel>
      </TabView>,
    );
    const output = tab("Output");
    // jsdom never matches :active; a browser does while the mouse button is held on the tab.
    const matches = output.matches.bind(output);
    const pressed = vi
      .spyOn(output, "matches")
      .mockImplementation((selector) => selector === ":active" || matches(selector));

    // The press gives the tab focus: the caller's handler runs, the tab is not selected yet.
    act(() => output.focus());
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(output).toHaveAttribute("aria-selected", "false");
    expect(tab("Sound Effects")).toHaveAttribute("aria-selected", "true");

    // Released somewhere else: no click, and the selection stays where it was.
    pressed.mockRestore();
    act(() => output.blur());
    expect(output).toHaveAttribute("aria-selected", "false");

    // Released over the tab: the click selects it.
    fireEvent.click(output);
    expect(output).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Output pane");
  });

  it("uses the Up and Down arrow keys for side tabs", async () => {
    const user = userEvent.setup();
    render(<Sound tabPosition="left" />);
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(tab("Output")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(tab("Sound Effects")).toHaveAttribute("aria-selected", "true");
  });

  it("selects the next and the previous tab with Control-Tab, wrapping and skipping disabled tabs", () => {
    const onKeyDown = vi.fn();
    render(
      <TabView defaultValue="a" onKeyDown={onKeyDown}>
        <TabViewList aria-label="Letters">
          <TabViewTab value="a">A</TabViewTab>
          <TabViewTab value="b" disabled>
            B
          </TabViewTab>
          <TabViewTab value="c">C</TabViewTab>
        </TabViewList>
        <TabViewPanel value="a">
          <button type="button">In pane A</button>
        </TabViewPanel>
        <TabViewPanel value="b">Pane B</TabViewPanel>
        <TabViewPanel value="c">
          <button type="button">In pane C</button>
        </TabViewPanel>
      </TabView>,
    );
    const press = (target: HTMLElement, init: KeyboardEventInit = {}) =>
      // Returns false when the key's default action was prevented.
      fireEvent.keyDown(target, { key: "Tab", ctrlKey: true, ...init });

    // From a control in the pane: the tab changes, and focus goes to the new tab instead of
    // being lost with the pane that leaves the page.
    const inPane = screen.getByRole("button", { name: "In pane A" });
    inPane.focus();
    expect(press(inPane)).toBe(false);
    expect(tab("C")).toHaveAttribute("aria-selected", "true");
    expect(inPane).not.toBeInTheDocument();
    expect(tab("C")).toHaveFocus();
    expect(onKeyDown).toHaveBeenCalledTimes(1);

    // The next press, from wherever focus now is, still reaches the tab view. From the strip
    // focus follows the selection, and forwards from the last tab wraps.
    press(document.activeElement as HTMLElement);
    expect(tab("A")).toHaveAttribute("aria-selected", "true");
    expect(tab("A")).toHaveFocus();
    press(tab("A"), { shiftKey: true });
    expect(tab("C")).toHaveAttribute("aria-selected", "true");
    expect(tab("B")).toHaveAttribute("aria-selected", "false");

    // A plain Tab, or one with Command or Option, is left alone.
    expect(fireEvent.keyDown(tab("C"), { key: "Tab" })).toBe(true);
    expect(press(tab("C"), { metaKey: true })).toBe(true);
    expect(tab("C")).toHaveAttribute("aria-selected", "true");
  });

  it("leaves Control-Tab to the inner of two nested tab views", () => {
    render(
      <TabView defaultValue="outer-1">
        <TabViewList aria-label="Outer">
          <TabViewTab value="outer-1">Outer 1</TabViewTab>
          <TabViewTab value="outer-2">Outer 2</TabViewTab>
        </TabViewList>
        <TabViewPanel value="outer-1">
          <TabView defaultValue="inner-1">
            <TabViewList aria-label="Inner">
              <TabViewTab value="inner-1">Inner 1</TabViewTab>
              <TabViewTab value="inner-2">Inner 2</TabViewTab>
            </TabViewList>
            <TabViewPanel value="inner-1">Inner pane 1</TabViewPanel>
            <TabViewPanel value="inner-2">Inner pane 2</TabViewPanel>
          </TabView>
        </TabViewPanel>
        <TabViewPanel value="outer-2">Outer pane 2</TabViewPanel>
      </TabView>,
    );
    fireEvent.keyDown(tab("Inner 1"), { key: "Tab", ctrlKey: true });
    expect(tab("Inner 2")).toHaveAttribute("aria-selected", "true");
    expect(tab("Outer 1")).toHaveAttribute("aria-selected", "true");

    // From the outer strip only the outer tab view's own tabs take part.
    fireEvent.keyDown(tab("Outer 1"), { key: "Tab", ctrlKey: true });
    expect(tab("Outer 2")).toHaveAttribute("aria-selected", "true");
  });

  it("leaves the outer tab view alone when an inner one has no tab to go to", () => {
    const inners = {
      "no tabs": (
        <TabView defaultValue="only" tabPosition="none">
          <TabViewPanel value="only">Inner pane</TabViewPanel>
        </TabView>
      ),
      "every tab disabled": (
        <TabView defaultValue="inner-1">
          <TabViewList aria-label="Inner">
            <TabViewTab value="inner-1" disabled>
              Inner 1
            </TabViewTab>
            <TabViewTab value="inner-2" disabled>
              Inner 2
            </TabViewTab>
          </TabViewList>
          <TabViewPanel value="inner-1">Inner pane 1</TabViewPanel>
          <TabViewPanel value="inner-2">Inner pane 2</TabViewPanel>
        </TabView>
      ),
    };
    for (const [name, inner] of Object.entries(inners)) {
      const onValueChange = vi.fn();
      const { container, unmount } = render(
        <TabView defaultValue="outer-1" onValueChange={onValueChange}>
          <TabViewList aria-label="Outer">
            <TabViewTab value="outer-1">Outer 1</TabViewTab>
            <TabViewTab value="outer-2">Outer 2</TabViewTab>
          </TabViewList>
          <TabViewPanel value="outer-1">{inner}</TabViewPanel>
          <TabViewPanel value="outer-2">Outer pane 2</TabViewPanel>
        </TabView>,
      );
      const innerRoot = container.querySelectorAll(".mac-tab-view")[1] as HTMLElement;
      expect(innerRoot, name).toBeInTheDocument();

      // The keys came from the inner tab view, which has nowhere to go: the outer one must not
      // take them for itself and hide the pane they came from.
      for (const shiftKey of [false, true]) {
        fireEvent.keyDown(innerRoot, { key: "Tab", ctrlKey: true, shiftKey });
      }
      expect(onValueChange, name).not.toHaveBeenCalled();
      expect(tab("Outer 1"), name).toHaveAttribute("aria-selected", "true");
      expect(innerRoot, name).toBeInTheDocument();

      // From its own strip the outer tab view still answers.
      fireEvent.keyDown(tab("Outer 1"), { key: "Tab", ctrlKey: true });
      expect(tab("Outer 2"), name).toHaveAttribute("aria-selected", "true");
      expect(onValueChange, name).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it("reports one change for each Control-Tab, whether or not the strip activates on focus", () => {
    const press = (target: Element) => fireEvent.keyDown(target, { key: "Tab", ctrlKey: true });
    const focus = (target: HTMLElement) => act(() => target.focus());

    for (const activateOnFocus of [true, false]) {
      // Uncontrolled, from the strip: the tab is focused and clicked, and each of the two can
      // ask for the selection.
      const onValueChange = vi.fn();
      const { unmount } = render(
        <Sound onValueChange={onValueChange} activateOnFocus={activateOnFocus} />,
      );
      focus(tab("Sound Effects"));
      press(tab("Sound Effects"));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe("output");
      expect(tab("Output")).toHaveAttribute("aria-selected", "true");
      expect(tab("Output")).toHaveFocus();

      // From the pane, focus moves to the new tab as well.
      focus(screen.getByRole("tabpanel"));
      press(screen.getByRole("tabpanel"));
      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange.mock.calls[1]?.[0]).toBe("input");
      unmount();

      // Controlled, with a value that does not follow: still asked once per press, and the
      // next press asks again.
      const controlled = vi.fn();
      const view = render(
        <Sound value="effects" onValueChange={controlled} activateOnFocus={activateOnFocus} />,
      );
      focus(tab("Sound Effects"));
      press(tab("Sound Effects"));
      expect(controlled).toHaveBeenCalledTimes(1);
      expect(controlled.mock.calls[0]?.[0]).toBe("output");
      expect(tab("Sound Effects")).toHaveAttribute("aria-selected", "true");
      press(view.container.querySelector(".mac-tab-view") as Element);
      expect(controlled).toHaveBeenCalledTimes(2);
      view.unmount();
    }
  });

  it("leaves the tab alone when a Control-Tab change is cancelled", () => {
    for (const activateOnFocus of [true, false]) {
      const onValueChange = vi.fn((_value: unknown, details: { cancel: () => void }) =>
        details.cancel(),
      );
      const { unmount } = render(
        <Sound onValueChange={onValueChange} activateOnFocus={activateOnFocus} />,
      );
      act(() => tab("Sound Effects").focus());
      fireEvent.keyDown(tab("Sound Effects"), { key: "Tab", ctrlKey: true });
      // Asked once, and the second request of the same press does not undo the refusal.
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(tab("Sound Effects")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel")).toHaveTextContent("Effects pane");
      unmount();
    }
  });

  it("moves focus to the new tab when it is rendered into another document", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const other = frame.contentDocument as Document;
    try {
      const view = render(
        createPortal(
          <TabView defaultValue="a">
            <TabViewList aria-label="Letters">
              <TabViewTab value="a">A</TabViewTab>
              <TabViewTab value="b">B</TabViewTab>
            </TabViewList>
            <TabViewPanel value="a">
              <button type="button">In pane A</button>
            </TabViewPanel>
            <TabViewPanel value="b">Pane B</TabViewPanel>
          </TabView>,
          other.body,
        ),
      );
      const inside = within(other.body);
      const inPane = inside.getByRole("button", { name: "In pane A" });
      // The element belongs to the other document's realm, not to this one's.
      expect(inPane instanceof HTMLElement).toBe(false);
      act(() => inPane.focus());
      expect(other.activeElement).toBe(inPane);

      fireEvent.keyDown(inPane, { key: "Tab", ctrlKey: true });
      const next = inside.getByRole("tab", { name: "B" });
      expect(next).toHaveAttribute("aria-selected", "true");
      // Not left on the body of that document with the pane that went away.
      expect(other.activeElement).toBe(next);
      view.unmount();
    } finally {
      frame.remove();
    }
  });

  it("does not select a disabled tab", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TabView defaultValue="a" onValueChange={onValueChange}>
        <TabViewList aria-label="Tabs">
          <TabViewTab value="a">One</TabViewTab>
          <TabViewTab value="b" disabled>
            Two
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="a">First</TabViewPanel>
        <TabViewPanel value="b">Second</TabViewPanel>
      </TabView>,
    );
    expect(tab("Two")).toHaveAttribute("data-disabled");
    await user.click(tab("Two"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
  });

  it("follows the value prop when controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Sound value="output" onValueChange={onValueChange} />);
    expect(tab("Output")).toHaveAttribute("aria-selected", "true");

    await user.click(tab("Input"));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("input");
    expect(tab("Output")).toHaveAttribute("aria-selected", "true");

    rerender(<Sound value="input" onValueChange={onValueChange} />);
    expect(tab("Input")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Input pane");
  });

  it("links each pane to its tab", () => {
    render(<Sound />);
    expect(screen.getByRole("tabpanel", { name: "Sound Effects" })).toHaveClass(
      "mac-tab-view-panel",
    );
  });

  it("forwards ref, className and native attributes on every part", () => {
    const root = createRef<HTMLDivElement>();
    const list = createRef<HTMLDivElement>();
    const first = createRef<HTMLElement>();
    const panel = createRef<HTMLDivElement>();
    render(
      <TabView ref={root} className="root" id="tabs" defaultValue="a">
        <TabViewList ref={list} className="list" aria-label="Tabs">
          <TabViewTab ref={first} className={(state) => (state.active ? "on" : "off")} value="a">
            One
          </TabViewTab>
        </TabViewList>
        <TabViewPanel ref={panel} className="panel" value="a" data-pane="one">
          First
        </TabViewPanel>
      </TabView>,
    );
    expect(root.current).toHaveClass("mac-tab-view", "root");
    expect(root.current).toHaveAttribute("id", "tabs");
    expect(list.current).toBe(screen.getByRole("tablist"));
    expect(list.current).toHaveClass("mac-tab-view-list", "list");
    expect(first.current).toBe(tab("One"));
    expect(first.current).toHaveClass("mac-tab-view-tab", "on");
    expect(panel.current).toHaveClass("mac-tab-view-panel", "panel");
    expect(panel.current).toHaveAttribute("data-pane", "one");
  });
});
