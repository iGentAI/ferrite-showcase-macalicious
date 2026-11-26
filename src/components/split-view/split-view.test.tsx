import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, Profiler, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { observeResize } from "../../lib/observe-resize";
import { SplitView, SplitViewDivider, SplitViewPane, type SplitViewPaneProps } from "./index";

/**
 * jsdom has no layout. Stand-in: a split view is 400 pt long, a divider 1 pt, and a sized
 * pane as long as its `--_size` says (0 when collapsed). Real layout, dragging with pointer
 * capture and right-to-left are exercised in Chromium by visual/output/b7/browser/split-view.mjs
 * and the keyboard by the `expect` comparisons of split-view.visual.json.
 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    let length = 0;
    if (this.classList.contains("mac-split-view")) length = 400;
    else if (this.classList.contains("mac-split-view-divider")) length = 1;
    else if (this.hasAttribute("data-pane") && !this.hasAttribute("data-sized")) {
      // A flexible pane has what its siblings leave.
      length = 400;
      for (const other of this.parentElement?.children ?? [])
        if (other !== this) length -= other.getBoundingClientRect().width;
    } else if (this.style.display !== "none")
      length = Number.parseFloat(this.style.getPropertyValue("--_size")) || 0;
    return {
      width: length,
      height: length,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    } as DOMRect;
  });
});

function Example({
  orientation,
  disabled,
  ...pane
}: SplitViewPaneProps & { orientation?: "horizontal" | "vertical"; disabled?: boolean }) {
  return (
    <SplitView orientation={orientation} data-testid="root">
      <SplitViewPane defaultSize={100} minSize={60} maxSize={200} data-testid="first" {...pane}>
        First
      </SplitViewPane>
      <SplitViewDivider aria-label="Resize first" disabled={disabled} />
      <SplitViewPane data-testid="second">Second</SplitViewPane>
    </SplitView>
  );
}

const size = () => screen.getByTestId("first").style.getPropertyValue("--_size");
const divider = () => screen.getByRole("separator", { name: "Resize first" });

describe("observeResize, which the dividers of one split view share an element through", () => {
  it("keeps every subscription to an element until its own stop", async () => {
    const observed = new Set<Element>();
    let report: (entries: { target: Element }[]) => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: typeof report) {
          report = callback;
        }
        observe(element: Element) {
          observed.add(element);
        }
        unobserve(element: Element) {
          observed.delete(element);
        }
        disconnect() {
          observed.clear();
        }
      },
    );
    try {
      const element = document.createElement("div");
      const first = vi.fn();
      const second = vi.fn();
      const stopFirst = observeResize(element, first);
      report([{ target: element }]);
      expect(first).toHaveBeenCalledTimes(1);
      // A browser does not report an element again when it is observed again: a callback
      // that joins later gets its first call from the helper.
      const stopSecond = observeResize(element, second);
      await Promise.resolve();
      expect(second).toHaveBeenCalledTimes(1);
      report([{ target: element }]);
      expect(first).toHaveBeenCalledTimes(2);
      expect(second).toHaveBeenCalledTimes(2);
      stopSecond();
      expect(observed.has(element)).toBe(true);
      report([{ target: element }]);
      expect(first).toHaveBeenCalledTimes(3);
      expect(second).toHaveBeenCalledTimes(2);
      stopFirst();
      expect(observed.has(element)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("SplitView", () => {
  it("lays panes out side by side with thin dividers by default", () => {
    render(<Example />);
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("mac-split-view");
    expect(root).toHaveAttribute("data-orientation", "horizontal");
    expect(root).toHaveAttribute("data-divider-style", "thin");
    expect(screen.getByTestId("first")).toHaveAttribute("data-sized");
    expect(size()).toBe("100px");
    expect(screen.getByTestId("second")).not.toHaveAttribute("data-sized");
  });

  it("reflects orientation and divider style", () => {
    render(
      <SplitView orientation="vertical" dividerStyle="pane-splitter" data-testid="root">
        <SplitViewPane />
        <SplitViewDivider aria-label="Resize" />
        <SplitViewPane defaultSize={50} />
      </SplitView>,
    );
    expect(screen.getByTestId("root")).toHaveAttribute("data-orientation", "vertical");
    expect(screen.getByTestId("root")).toHaveAttribute("data-divider-style", "pane-splitter");
    // The separator's own orientation is that of its line, across the split axis.
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("exposes the divider as a focusable separator with the pane's size and limits", () => {
    render(<Example />);
    expect(divider()).toHaveAttribute("tabindex", "0");
    expect(divider()).toHaveAttribute("aria-orientation", "vertical");
    expect(divider()).toHaveAttribute("aria-valuenow", "100");
    expect(divider()).toHaveAttribute("aria-valuemin", "60");
    expect(divider()).toHaveAttribute("aria-valuemax", "200");
  });

  it("resizes by 10 pt per arrow key, within the limits", async () => {
    const user = userEvent.setup();
    const onSizeChange = vi.fn();
    render(<Example onSizeChange={onSizeChange} />);
    await user.tab();
    expect(divider()).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(size()).toBe("110px");
    expect(onSizeChange).toHaveBeenLastCalledWith(110);
    expect(divider()).toHaveAttribute("aria-valuenow", "110");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(size()).toBe("90px");
    await user.keyboard("{End}");
    expect(size()).toBe("200px");
    await user.keyboard("{ArrowRight}");
    expect(size()).toBe("200px");
    await user.keyboard("{Home}");
    expect(size()).toBe("60px");
    await user.keyboard("{ArrowLeft}");
    expect(size()).toBe("60px");
    // Arrows across the split axis do nothing.
    await user.keyboard("{ArrowUp}{ArrowDown}");
    expect(size()).toBe("60px");
  });

  it("uses Up and Down in a stacked split view", async () => {
    const user = userEvent.setup();
    render(<Example orientation="vertical" />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(size()).toBe("110px");
    await user.keyboard("{ArrowUp}{ArrowRight}");
    expect(size()).toBe("100px");
  });

  it("resizes the pane after the divider when the pane before it is flexible", async () => {
    const user = userEvent.setup();
    render(
      <SplitView>
        <SplitViewPane>Content</SplitViewPane>
        <SplitViewDivider aria-label="Resize inspector" />
        <SplitViewPane defaultSize={100} data-testid="inspector">
          Inspector
        </SplitViewPane>
      </SplitView>,
    );
    await user.tab();
    // Moving the divider towards the start grows the pane behind it.
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("inspector").style.getPropertyValue("--_size")).toBe("110px");
  });

  it("limits a pane without a maximum to the split view less the divider", async () => {
    const user = userEvent.setup();
    render(<Example maxSize={undefined} />);
    await user.tab();
    await user.keyboard("{End}");
    expect(size()).toBe("399px");
  });

  it("lets a pane grow only by what the flexible pane can give up", async () => {
    const user = userEvent.setup();
    render(
      <SplitView>
        <SplitViewPane defaultSize={100} data-testid="first">
          First
        </SplitViewPane>
        <SplitViewDivider aria-label="Resize first" />
        <SplitViewPane minSize={50}>Middle</SplitViewPane>
        <SplitViewDivider aria-label="Resize last" />
        <SplitViewPane defaultSize={150}>Last</SplitViewPane>
      </SplitView>,
    );
    // 400 less two dividers and the 150 pt pane leaves 248 for the first two panes, of
    // which the flexible one keeps its minimum of 50.
    await user.click(divider());
    await user.keyboard("{End}");
    expect(size()).toBe("198px");
    expect(divider()).toHaveAttribute("aria-valuemax", "198");
  });

  it("gives a flexible pane its limits too, and no pane its parent's", () => {
    render(
      <SplitView>
        <SplitViewPane minSize={50} maxSize={300} data-testid="flexible">
          Content
        </SplitViewPane>
        <SplitViewDivider aria-label="Resize inspector" />
        <SplitViewPane defaultSize={100} data-testid="sized">
          Inspector
        </SplitViewPane>
      </SplitView>,
    );
    const flexible = screen.getByTestId("flexible");
    expect(flexible).not.toHaveAttribute("data-sized");
    expect(flexible.style.getPropertyValue("--_min")).toBe("50px");
    expect(flexible.style.getPropertyValue("--_max")).toBe("300px");
    // Set even without a maximum, so a split view inside a pane does not inherit one.
    expect(screen.getByTestId("sized").style.getPropertyValue("--_max")).toBe("none");
  });

  it("treats a maximum of 0 as a maximum", async () => {
    const user = userEvent.setup();
    render(<Example minSize={0} maxSize={0} />);
    await user.click(divider());
    await user.keyboard("{ArrowRight}");
    expect(divider()).toHaveAttribute("aria-valuemax", "0");
  });

  it("follows the pointer while the divider is dragged", () => {
    const onSizeChange = vi.fn();
    render(<Example onSizeChange={onSizeChange} />);
    fireEvent.pointerDown(divider(), { button: 0, clientX: 100, pointerId: 1 });
    expect(divider()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(divider(), { clientX: 130, pointerId: 1 });
    expect(size()).toBe("130px");
    fireEvent.pointerMove(divider(), { clientX: 500, pointerId: 1 });
    expect(size()).toBe("200px");
    fireEvent.pointerMove(divider(), { clientX: 50, pointerId: 1 });
    expect(size()).toBe("60px");
    fireEvent.lostPointerCapture(divider(), { pointerId: 1 });
    expect(divider()).not.toHaveAttribute("data-dragging");
    fireEvent.pointerMove(divider(), { clientX: 150, pointerId: 1 });
    expect(size()).toBe("60px");
    expect(onSizeChange.mock.calls.map(([value]) => value)).toEqual([130, 200, 60]);
  });

  it("lets only the pointer that started a drag move it or end it", () => {
    render(<Example />);
    fireEvent.pointerDown(divider(), { button: 0, clientX: 100, pointerId: 1 });
    // A second touch on the divider neither moves it, restarts the drag nor ends it.
    fireEvent.pointerMove(divider(), { clientX: 180, pointerId: 2 });
    expect(size()).toBe("100px");
    fireEvent.pointerDown(divider(), { button: 0, clientX: 180, pointerId: 2 });
    fireEvent.lostPointerCapture(divider(), { pointerId: 2 });
    expect(divider()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(divider(), { clientX: 130, pointerId: 1 });
    expect(size()).toBe("130px");
    fireEvent.lostPointerCapture(divider(), { pointerId: 2 });
    expect(divider()).toHaveAttribute("data-dragging");
    fireEvent.lostPointerCapture(divider(), { pointerId: 1 });
    expect(divider()).not.toHaveAttribute("data-dragging");
  });

  it("ignores other mouse buttons", () => {
    render(<Example />);
    fireEvent.pointerDown(divider(), { button: 2, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 150, pointerId: 1 });
    expect(size()).toBe("100px");
  });

  it("collapses a collapsible pane dragged under half its minimum, and opens it again", () => {
    render(<Example collapsible />);
    const first = screen.getByTestId("first");
    expect(divider()).toHaveAttribute("aria-valuemin", "0");
    fireEvent.pointerDown(divider(), { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 40, pointerId: 1 });
    expect(size()).toBe("60px");
    expect(first).not.toHaveAttribute("data-collapsed");
    fireEvent.pointerMove(divider(), { clientX: 20, pointerId: 1 });
    expect(size()).toBe("0px");
    expect(first).toHaveAttribute("data-collapsed");
    expect(first).not.toBeVisible();
    expect(divider()).toHaveAttribute("aria-valuenow", "0");
    fireEvent.pointerMove(divider(), { clientX: 90, pointerId: 1 });
    expect(size()).toBe("90px");
    expect(first).toBeVisible();
  });

  it("does not collapse a pane that is not collapsible", () => {
    render(<Example />);
    fireEvent.pointerDown(divider(), { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 0, pointerId: 1 });
    expect(size()).toBe("60px");
    fireEvent.doubleClick(divider());
    expect(size()).toBe("60px");
  });

  it("toggles a collapsible pane with a double click or Return, restoring its size", async () => {
    const user = userEvent.setup();
    render(<Example collapsible />);
    await user.tab();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(size()).toBe("0px");
    await user.keyboard("{Enter}");
    expect(size()).toBe("110px");
    fireEvent.doubleClick(divider());
    expect(size()).toBe("0px");
    fireEvent.doubleClick(divider());
    expect(size()).toBe("110px");
  });

  it("leaves a controlled pane to its owner", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState(100);
      // The owner snaps to multiples of 20.
      return <Example size={value} onSizeChange={(next) => setValue(Math.round(next / 20) * 20)} />;
    }
    render(<Controlled />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(size()).toBe("120px");
    await user.keyboard("{ArrowRight}");
    expect(size()).toBe("140px");
  });

  it("announces the size the pane's owner gave it, not the size asked for", async () => {
    const user = userEvent.setup();
    // The owner snaps to multiples of 20, and only the pane renders again.
    function Snapping() {
      const [value, setValue] = useState(100);
      return (
        <SplitViewPane
          size={value}
          onSizeChange={(next) => setValue(Math.round(next / 20) * 20)}
          data-testid="first"
        >
          First
        </SplitViewPane>
      );
    }
    render(
      <SplitView>
        <Snapping />
        <SplitViewDivider aria-label="Resize first" />
        <SplitViewPane>Second</SplitViewPane>
      </SplitView>,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(size()).toBe("120px");
    expect(divider()).toHaveAttribute("aria-valuenow", "120");
  });

  it("names the pane it resizes with aria-controls, by the pane's own id or the caller's", () => {
    const { unmount } = render(<Example />);
    expect(screen.getByTestId("first").id).not.toBe("");
    expect(divider()).toHaveAttribute("aria-controls", screen.getByTestId("first").id);
    unmount();
    render(<Example id="sidebar" />);
    expect(divider()).toHaveAttribute("aria-controls", "sidebar");
  });

  it("is disabled and no tab stop between two panes without a size, until one has a size", async () => {
    const user = userEvent.setup();
    function Two({ sized }: { sized?: boolean }) {
      return (
        <SplitView>
          <SplitViewPane data-testid="first" size={sized ? 100 : undefined} />
          <SplitViewDivider aria-label="Resize first" />
          <SplitViewPane />
        </SplitView>
      );
    }
    const { rerender } = render(<Two />);
    expect(divider()).toHaveAttribute("aria-disabled", "true");
    expect(divider()).toHaveAttribute("tabindex", "-1");
    expect(divider()).not.toHaveAttribute("aria-controls");
    await user.tab();
    expect(divider()).not.toHaveFocus();
    rerender(<Two sized />);
    expect(divider()).not.toHaveAttribute("aria-disabled");
    expect(divider()).toHaveAttribute("tabindex", "0");
    expect(divider()).toHaveAttribute("aria-valuenow", "100");
    await user.tab();
    expect(divider()).toHaveFocus();
    rerender(<Two />);
    expect(divider()).toHaveAttribute("aria-disabled", "true");
    expect(divider()).toHaveAttribute("tabindex", "-1");
    expect(divider()).not.toHaveAttribute("aria-controls");
  });

  it("keeps the tab index its caller gave it while it can resize a pane", () => {
    render(
      <SplitView>
        <SplitViewPane defaultSize={100} />
        <SplitViewDivider aria-label="Resize first" tabIndex={-1} />
        <SplitViewPane />
      </SplitView>,
    );
    expect(divider()).toHaveAttribute("aria-valuenow", "100");
    expect(divider()).toHaveAttribute("tabindex", "-1");
    expect(divider()).not.toHaveAttribute("aria-disabled");
  });

  it("keeps a press on the divider from starting a native drag", () => {
    render(<Example />);
    expect(fireEvent.mouseDown(divider(), { button: 0 })).toBe(false);
    expect(fireEvent.mouseDown(divider(), { button: 2 })).toBe(true);
  });

  it("does nothing when disabled and is not a tab stop", async () => {
    const user = userEvent.setup();
    render(<Example disabled collapsible />);
    expect(fireEvent.mouseDown(divider(), { button: 0 })).toBe(true);
    expect(divider()).toHaveAttribute("aria-disabled", "true");
    expect(divider()).not.toHaveAttribute("tabindex");
    await user.tab();
    expect(divider()).not.toHaveFocus();
    fireEvent.pointerDown(divider(), { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 150, pointerId: 1 });
    fireEvent.doubleClick(divider());
    fireEvent.keyDown(divider(), { key: "ArrowRight" });
    expect(size()).toBe("100px");
  });

  it("lets the caller's handlers cancel a drag or a key", () => {
    render(
      <SplitView>
        <SplitViewPane defaultSize={100} data-testid="first" />
        <SplitViewDivider
          aria-label="Resize first"
          onPointerDown={(event) => event.preventDefault()}
          onKeyDown={(event) => event.preventDefault()}
        />
        <SplitViewPane />
      </SplitView>,
    );
    fireEvent.pointerDown(divider(), { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 150, pointerId: 1 });
    fireEvent.keyDown(divider(), { key: "ArrowRight" });
    expect(size()).toBe("100px");
  });

  it("lets go of the pointer when it is disabled during a drag", () => {
    function Split({ disabled }: { disabled?: boolean }) {
      return (
        <SplitView>
          <SplitViewPane defaultSize={100} data-testid="first" />
          <SplitViewDivider aria-label="Resize first" disabled={disabled} />
          <SplitViewPane />
        </SplitView>
      );
    }
    const { rerender } = render(<Split />);
    const release = vi.fn();
    divider().releasePointerCapture = release;
    fireEvent.pointerDown(divider(), { button: 0, clientX: 100, pointerId: 1 });
    expect(divider()).toHaveAttribute("data-dragging");
    rerender(<Split disabled />);
    expect(divider()).not.toHaveAttribute("data-dragging");
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(divider(), { clientX: 150, pointerId: 1 });
    expect(size()).toBe("100px");
  });

  it("does not re-render the other pane while one is resized", async () => {
    const user = userEvent.setup();
    // Every commit of the second pane or of anything inside it is counted.
    const commits = vi.fn();
    render(
      <SplitView>
        <SplitViewPane defaultSize={100} data-testid="first" />
        <SplitViewDivider aria-label="Resize first" />
        <Profiler id="second" onRender={(_id, phase) => commits(phase)}>
          <SplitViewPane>Second</SplitViewPane>
        </Profiler>
      </SplitView>,
    );
    expect(commits.mock.calls).toEqual([["mount"]]);
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(size()).toBe("130px");
    expect(commits.mock.calls).toEqual([["mount"]]);
  });

  it("forwards ref, className, style and native attributes on every part", () => {
    const root = createRef<HTMLDivElement>();
    const pane = createRef<HTMLDivElement>();
    const line = createRef<HTMLDivElement>();
    render(
      <SplitView ref={root} className="a" id="split" style={{ height: 10 }}>
        <SplitViewPane ref={pane} className="b" id="pane" defaultSize={50} style={{ padding: 1 }} />
        <SplitViewDivider ref={line} className="c" id="line" aria-label="Resize" />
        <SplitViewPane />
      </SplitView>,
    );
    expect(root.current).toHaveClass("mac-split-view", "a");
    expect(root.current).toHaveAttribute("id", "split");
    expect(root.current?.style.height).toBe("10px");
    expect(pane.current).toHaveClass("mac-split-view-pane", "b");
    expect(pane.current).toHaveAttribute("id", "pane");
    expect(pane.current?.style.padding).toBe("1px");
    expect(pane.current?.style.getPropertyValue("--_size")).toBe("50px");
    expect(line.current).toHaveClass("mac-split-view-divider", "c");
    expect(line.current).toHaveAttribute("id", "line");
  });
});
