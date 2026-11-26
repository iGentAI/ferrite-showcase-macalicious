import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TitleBar } from "../title-bar";
import { Window, WindowBody } from "../window";
import { WindowControls } from "../window-controls";
import {
  useWindowManager,
  WindowManager,
  type WindowManagerApi,
  type WindowManagerInsets,
} from "../window-manager";
import {
  ManagedWindow,
  type ManagedWindowProps,
  type ManagedWindowRenderProps,
  useManagedWindow,
} from "./index";

let manager: WindowManagerApi;
let listRenders = 0;

function Probe() {
  manager = useWindowManager();
  listRenders += 1;
  return null;
}

function Chrome({ title }: { title: string }) {
  const managed = useManagedWindow();
  return (
    <TitleBar
      title={title}
      data-testid={`bar-${title}`}
      controls={<WindowControls {...managed.controlsProps} />}
      {...managed.titleBarProps}
    />
  );
}

function Desktop({ insets, children }: { insets?: WindowManagerInsets; children: ReactNode }) {
  return (
    <WindowManager insets={insets} data-testid="desktop">
      <Probe />
      {children}
    </WindowManager>
  );
}

function Win({ id, ...props }: ManagedWindowProps & { id: string }) {
  return (
    <ManagedWindow id={id} title={id} {...props}>
      <Chrome title={id} />
      <WindowBody>
        <button type="button">{`${id} button`}</button>
      </WindowBody>
    </ManagedWindow>
  );
}

const frameOf = (name: string) => screen.getByRole("region", { name, hidden: true });
const shellOf = (name: string) => frameOf(name).parentElement as HTMLElement;
const stateOf = (name: string) => frameOf(name).getAttribute("data-window-state");
const info = (id: string) => {
  const found = manager.windows.find((w) => w.id === id);
  if (!found) throw new Error(`no window ${id}`);
  return found;
};

/** The x and y a window is placed at, read from its transform. */
function placeOf(name: string): [number, number] {
  const match = /translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(shellOf(name).style.transform);
  if (!match) throw new Error(`no translation in "${shellOf(name).style.transform}"`);
  return [Number(match[1]), Number(match[2])];
}

function drag(target: Element, from: [number, number], to: [number, number], release = true) {
  fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: to[0], clientY: to[1] });
  if (release) fireEvent.pointerUp(target, { pointerId: 1, clientX: to[0], clientY: to[1] });
}

const handle = (name: string, edge: string) =>
  shellOf(name).querySelector(`[data-edge="${edge}"]`) as HTMLElement;

beforeEach(() => {
  listRenders = 0;
  // jsdom lays nothing out; the desktop is 1000 by 700 points.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(700);
});

describe("ManagedWindow", () => {
  it("makes the window opened last the one key window, in front", () => {
    render(
      <Desktop>
        <Win id="First" />
        <Win id="Second" />
        <Win id="Third" />
      </Desktop>,
    );
    expect(stateOf("First")).toBe("inactive");
    expect(stateOf("Second")).toBe("inactive");
    expect(stateOf("Third")).toBe("key");
    expect(shellOf("First").style.zIndex).toBe("1");
    expect(shellOf("Third").style.zIndex).toBe("3");
    expect(manager.keyWindowId).toBe("Third");
    expect(manager.windows.map((w) => w.id)).toEqual(["First", "Second", "Third"]);
  });

  it("brings a window to the front and makes it key when it is pressed", () => {
    render(
      <Desktop>
        <Win id="First" />
        <Win id="Second" />
      </Desktop>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "First button" }));
    expect(stateOf("First")).toBe("key");
    expect(stateOf("Second")).toBe("inactive");
    expect(shellOf("First").style.zIndex).toBe("2");
    expect(shellOf("Second").style.zIndex).toBe("1");
  });

  it("makes a window key when the keyboard focus moves into it", async () => {
    render(
      <Desktop>
        <Win id="First" />
        <Win id="Second" />
      </Desktop>,
    );
    act(() => screen.getByRole("button", { name: "First button" }).focus());
    expect(manager.keyWindowId).toBe("First");
    expect(stateOf("Second")).toBe("inactive");
  });

  it("re-renders only the windows whose state changed", () => {
    const renders: Record<string, number> = {};
    function Counted({ name }: { name: string }) {
      useManagedWindow();
      renders[name] = (renders[name] ?? 0) + 1;
      return null;
    }
    render(
      <Desktop>
        {["First", "Second", "Third"].map((id) => (
          <ManagedWindow key={id} id={id} aria-label={id}>
            <Counted name={id} />
          </ManagedWindow>
        ))}
      </Desktop>,
    );
    const before = { ...renders };
    // Third is key and stays in front of First; pressing Second changes Second and Third only.
    fireEvent.pointerDown(frameOf("Second"));
    expect(renders.First).toBe(before.First);
    expect(renders.Second).toBeGreaterThan(before.Second ?? 0);
    expect(renders.Third).toBeGreaterThan(before.Third ?? 0);
  });

  it("opens windows where they are told to, and cascades the ones that are not", () => {
    render(
      <Desktop insets={{ top: 22 }}>
        <Win id="Placed" defaultFrame={{ x: 300, y: 200, width: 400, height: 250 }} />
        <Win id="Second" />
        <Win id="Third" />
      </Desktop>,
    );
    expect(placeOf("Placed")).toEqual([300, 200]);
    expect(shellOf("Placed").style.width).toBe("400px");
    expect(shellOf("Placed").style.height).toBe("250px");
    expect(placeOf("Second")).toEqual([64, 86]);
    expect(placeOf("Third")).toEqual([88, 110]);
    expect(shellOf("Second").style.width).toBe("480px");
    expect(
      screen.getByTestId("desktop").style.getPropertyValue("--mac-window-manager-inset-top"),
    ).toBe("22px");
  });

  describe("moving", () => {
    it("follows the pointer from the title bar without rendering, and settles on release", () => {
      render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      const bar = screen.getByTestId("bar-Notes");
      const rendersBefore = listRenders;
      drag(bar, [150, 110], [200, 140], false);
      expect(placeOf("Notes")).toEqual([150, 130]);
      expect(shellOf("Notes")).toHaveAttribute("data-dragging");
      fireEvent.pointerMove(bar, { pointerId: 1, clientX: 260, clientY: 180 });
      expect(placeOf("Notes")).toEqual([210, 170]);
      expect(listRenders).toBe(rendersBefore);
      expect(info("Notes").frame).toMatchObject({ x: 100, y: 100 });

      fireEvent.pointerUp(bar, { pointerId: 1 });
      expect(shellOf("Notes")).not.toHaveAttribute("data-dragging");
      expect(info("Notes").frame).toEqual({ x: 210, y: 170, width: 480, height: 320 });
      expect(placeOf("Notes")).toEqual([210, 170]);

      // Released: the pointer no longer moves the window.
      fireEvent.pointerMove(bar, { pointerId: 1, clientX: 500, clientY: 500 });
      expect(placeOf("Notes")).toEqual([210, 170]);
    });

    it("keeps the title bar below the menu bar and a strip of the window on the desktop", () => {
      render(
        <Desktop insets={{ top: 22, bottom: 60 }}>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100, width: 300, height: 200 }} />
        </Desktop>,
      );
      const bar = screen.getByTestId("bar-Notes");
      drag(bar, [150, 110], [-2000, -2000]);
      expect(placeOf("Notes")).toEqual([40 - 300, 22]);
      drag(bar, [0, 0], [5000, 5000]);
      expect(placeOf("Notes")).toEqual([1000 - 40, 700 - 60 - 22]);
    });

    it("does not move for a press on a window control or with another mouse button", () => {
      render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      drag(screen.getByRole("button", { name: "Close" }), [110, 110], [300, 300], false);
      expect(placeOf("Notes")).toEqual([100, 100]);
      const bar = screen.getByTestId("bar-Notes");
      fireEvent.pointerDown(bar, { button: 2, pointerId: 1, clientX: 150, clientY: 110 });
      fireEvent.pointerMove(bar, { pointerId: 1, clientX: 300, clientY: 300 });
      expect(placeOf("Notes")).toEqual([100, 100]);
    });

    it("follows only the pointer that started the move", () => {
      render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      const bar = screen.getByTestId("bar-Notes");
      drag(bar, [150, 110], [160, 120], false);
      // A second finger: it starts nothing, moves nothing and ends nothing.
      fireEvent.pointerDown(bar, { button: 0, pointerId: 2, clientX: 300, clientY: 110 });
      fireEvent.pointerMove(bar, { pointerId: 2, clientX: 500, clientY: 400 });
      expect(placeOf("Notes")).toEqual([110, 110]);
      fireEvent.pointerUp(bar, { pointerId: 2 });
      expect(shellOf("Notes")).toHaveAttribute("data-dragging");
      fireEvent.pointerMove(bar, { pointerId: 1, clientX: 170, clientY: 130 });
      expect(placeOf("Notes")).toEqual([120, 120]);
      fireEvent.pointerUp(bar, { pointerId: 1 });
      expect(shellOf("Notes")).not.toHaveAttribute("data-dragging");
      expect(info("Notes").frame).toMatchObject({ x: 120, y: 120 });
    });

    it("leaves a press and a double click in a popup of the title bar to the popup", () => {
      // A menu of a toolbar item is rendered in a portal: its events reach the title bar
      // through React, and a press that started a move would capture the pointer and take
      // the click away from the menu item.
      function Bar() {
        const managed = useManagedWindow();
        return (
          <TitleBar variant="unified" title="Notes" data-testid="bar" {...managed.titleBarProps}>
            {createPortal(
              <div role="menuitem" tabIndex={-1}>
                New Folder
              </div>,
              document.body,
            )}
          </TitleBar>
        );
      }
      const setPointerCapture = vi.fn();
      // jsdom has no pointer capture; a stand-in for the length of this test.
      Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
        configurable: true,
        value: setPointerCapture,
      });
      render(
        <Desktop>
          <ManagedWindow id="Notes" title="Notes" defaultFrame={{ x: 100, y: 100 }}>
            <Bar />
          </ManagedWindow>
        </Desktop>,
      );
      const item = screen.getByRole("menuitem", { name: "New Folder" });
      const bar = screen.getByTestId("bar");
      const shell = bar.closest(".mac-managed-window") as HTMLElement;
      drag(item, [150, 110], [300, 300], false);
      fireEvent.pointerMove(bar, { pointerId: 1, clientX: 300, clientY: 300 });
      expect(setPointerCapture).not.toHaveBeenCalled();
      expect(shell).not.toHaveAttribute("data-dragging");
      expect(info("Notes").frame).toMatchObject({ x: 100, y: 100 });
      fireEvent.doubleClick(item);
      expect(info("Notes").zoomed).toBe(false);
      // The bar itself still moves and zooms the window.
      drag(bar, [150, 110], [160, 120]);
      expect(setPointerCapture).toHaveBeenCalledTimes(1);
      expect(info("Notes").frame).toMatchObject({ x: 110, y: 110 });
      fireEvent.doubleClick(bar);
      expect(info("Notes").zoomed).toBe(true);
      Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
    });

    it("ends the move when the browser cancels the pointer", () => {
      render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      const bar = screen.getByTestId("bar-Notes");
      drag(bar, [150, 110], [160, 120], false);
      fireEvent.pointerCancel(bar, { pointerId: 1 });
      fireEvent.pointerMove(bar, { pointerId: 1, clientX: 400, clientY: 400 });
      expect(placeOf("Notes")).toEqual([110, 110]);
      expect(info("Notes").frame).toMatchObject({ x: 110, y: 110 });
    });
  });

  describe("resizing", () => {
    it("grows from the bottom-right corner and keeps the top-left one in place", () => {
      render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100, width: 300, height: 200 }} />
        </Desktop>,
      );
      drag(handle("Notes", "se"), [400, 300], [450, 360]);
      expect(info("Notes").frame).toEqual({ x: 100, y: 100, width: 350, height: 260 });
      expect(shellOf("Notes").style.width).toBe("350px");
      expect(shellOf("Notes").style.height).toBe("260px");
    });

    it("ends a resize whose handle goes away, keeps its frame and lets the window be moved", () => {
      const at = { x: 100, y: 100, width: 300, height: 200 };
      const { rerender } = render(
        <Desktop>
          <Win id="Notes" defaultFrame={at} />
        </Desktop>,
      );
      const grip = handle("Notes", "e");
      const removed = vi.spyOn(grip, "removeEventListener");
      drag(grip, [400, 200], [450, 200], false);
      expect(shellOf("Notes")).toHaveAttribute("data-dragging");
      rerender(
        <Desktop>
          <Win id="Notes" defaultFrame={at} resizable={false} />
        </Desktop>,
      );
      expect(grip).not.toBeInTheDocument();
      expect(removed.mock.calls.map(([type]) => type)).toContain("pointermove");
      expect(shellOf("Notes")).not.toHaveAttribute("data-dragging");
      expect(info("Notes").frame).toEqual({ ...at, width: 350 });
      // Not refused as a second gesture.
      drag(screen.getByTestId("bar-Notes"), [150, 110], [160, 120]);
      expect(info("Notes").frame).toEqual({ x: 110, y: 110, width: 350, height: 200 });
    });

    it("takes its listeners off the title bar when the window closes during a move", () => {
      const { rerender } = render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      const bar = screen.getByTestId("bar-Notes");
      const removed = vi.spyOn(bar, "removeEventListener");
      drag(bar, [150, 110], [160, 120], false);
      rerender(
        <Desktop>
          <Win id="Notes" open={false} />
        </Desktop>,
      );
      expect(removed.mock.calls.map(([type]) => type)).toEqual(
        expect.arrayContaining(["pointermove", "pointerup", "pointercancel", "lostpointercapture"]),
      );
      expect(manager.windows).toEqual([]);
    });

    it("moves the origin when resized from the top-left corner", () => {
      render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100, width: 300, height: 200 }} />
        </Desktop>,
      );
      drag(handle("Notes", "nw"), [100, 100], [80, 70]);
      expect(info("Notes").frame).toEqual({ x: 80, y: 70, width: 320, height: 230 });
    });

    it("changes one dimension from an edge", () => {
      render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100, width: 300, height: 200 }} />
        </Desktop>,
      );
      drag(handle("Notes", "e"), [400, 200], [430, 290]);
      expect(info("Notes").frame).toEqual({ x: 100, y: 100, width: 330, height: 200 });
      drag(handle("Notes", "s"), [200, 300], [290, 310]);
      expect(info("Notes").frame).toEqual({ x: 100, y: 100, width: 330, height: 210 });
    });

    it("stops at the minimum size with the opposite edge fixed, and at the menu bar", () => {
      render(
        <Desktop insets={{ top: 22 }}>
          <Win
            id="Notes"
            defaultFrame={{ x: 100, y: 100, width: 300, height: 200 }}
            minWidth={200}
            minHeight={120}
          />
        </Desktop>,
      );
      drag(handle("Notes", "nw"), [100, 100], [900, 900]);
      expect(info("Notes").frame).toEqual({ x: 200, y: 180, width: 200, height: 120 });
      drag(handle("Notes", "n"), [300, 180], [300, -500]);
      expect(info("Notes").frame).toEqual({ x: 200, y: 22, width: 200, height: 278 });
    });

    it("does not shrink a window until its title bar is out of reach", () => {
      render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: -200, y: 100, width: 300, height: 200 }} />
        </Desktop>,
      );
      // 100 points show. Down to 240 wide, 40 still do; narrower is not made.
      drag(handle("Notes", "e"), [100, 200], [40, 200], false);
      expect(shellOf("Notes").style.width).toBe("240px");
      fireEvent.pointerMove(handle("Notes", "e"), { pointerId: 1, clientX: 0, clientY: 200 });
      expect(shellOf("Notes").style.width).toBe("240px");
      fireEvent.pointerUp(handle("Notes", "e"), { pointerId: 1 });
      expect(info("Notes").frame).toEqual({ x: -200, y: 100, width: 240, height: 200 });
    });

    it("still resizes a window that was opened out of bounds", () => {
      render(
        <Desktop insets={{ top: 22 }}>
          <Win id="Notes" defaultFrame={{ x: 100, y: 0, width: 300, height: 200 }} />
        </Desktop>,
      );
      drag(handle("Notes", "e"), [400, 100], [450, 100]);
      expect(info("Notes").frame).toEqual({ x: 100, y: 0, width: 350, height: 200 });
    });

    it("moves the keyboard focus into the window whose edge is pressed", async () => {
      const user = userEvent.setup();
      render(
        <Desktop>
          <Win id="First" defaultFrame={{ x: 100, y: 100, width: 300, height: 200 }} />
          <Win id="Second" defaultFrame={{ x: 500, y: 100, width: 300, height: 200 }} />
        </Desktop>,
      );
      await user.click(screen.getByRole("button", { name: "Second button" }));
      expect(screen.getByRole("button", { name: "Second button" })).toHaveFocus();
      drag(handle("First", "e"), [400, 200], [420, 200]);
      expect(stateOf("First")).toBe("key");
      expect(frameOf("First")).toHaveFocus();
    });

    it("gives a window that is not resizable no handles and a disabled zoom button", () => {
      render(
        <Desktop>
          <Win id="Calculator" resizable={false} defaultFrame={{ width: 232, height: 320 }} />
        </Desktop>,
      );
      expect(shellOf("Calculator").querySelector("[data-edge]")).toBeNull();
      // No full screen for it either: the green button is a zoom button, and disabled.
      expect(screen.getByRole("button", { name: "Zoom" })).toBeDisabled();
      fireEvent.doubleClick(screen.getByTestId("bar-Calculator"));
      expect(info("Calculator").zoomed).toBe(false);
    });
  });

  describe("minimizing", () => {
    it("hides the window, hands the key state and the focus to the next one", async () => {
      const user = userEvent.setup();
      render(
        <Desktop>
          <Win id="First" />
          <Win id="Second" />
        </Desktop>,
      );
      await user.click(screen.getAllByRole("button", { name: "Minimize" })[1] as HTMLElement);
      expect(shellOf("Second")).toHaveAttribute("data-minimized");
      expect(shellOf("Second")).toHaveAttribute("inert");
      expect(info("Second")).toMatchObject({ minimized: true, state: "inactive" });
      expect(stateOf("First")).toBe("key");
      expect(frameOf("First")).toHaveFocus();
    });

    it("comes back, key and focused, when the manager is asked to focus it", async () => {
      const user = userEvent.setup();
      render(
        <Desktop>
          <Win id="First" />
          <Win id="Second" />
        </Desktop>,
      );
      await user.click(screen.getAllByRole("button", { name: "Minimize" })[1] as HTMLElement);
      act(() => manager.focus("Second"));
      expect(shellOf("Second")).not.toHaveAttribute("data-minimized");
      expect(shellOf("Second")).not.toHaveAttribute("inert");
      expect(stateOf("Second")).toBe("key");
      expect(frameOf("Second")).toHaveFocus();
    });

    it("measures the minimize target only when a window is minimized", () => {
      const measure = vi.spyOn(Element.prototype, "getBoundingClientRect");
      render(
        <Desktop>
          <Win id="Notes" />
          <div data-window-minimize-target="" />
        </Desktop>,
      );
      fireEvent.pointerDown(frameOf("Notes"));
      expect(measure).not.toHaveBeenCalled();
      act(() => manager.minimize("Notes"));
      expect(measure).toHaveBeenCalledTimes(2);
      act(() => manager.focus("Notes"));
      expect(measure).toHaveBeenCalledTimes(2);
    });

    it("aims the window at the element marked as the minimize target", () => {
      const rect = (left: number, top: number, width: number, height: number) =>
        ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
        this: Element,
      ) {
        if (this.hasAttribute("data-window-minimize-target")) return rect(800, 650, 40, 40);
        if (this.hasAttribute("data-window-id")) return rect(100, 100, 400, 200);
        return rect(0, 0, 1000, 700);
      });
      render(
        <Desktop>
          <Win id="Notes" />
          <div data-window-minimize-target="" />
        </Desktop>,
      );
      act(() => manager.minimize("Notes"));
      expect(shellOf("Notes").style.getPropertyValue("--_minimize-x")).toBe("520px");
      expect(shellOf("Notes").style.getPropertyValue("--_minimize-y")).toBe("470px");
    });
  });

  describe("zoom and full screen", () => {
    it("zooms on a double click of the title bar and back on the next", () => {
      render(
        <Desktop insets={{ top: 22, bottom: 60 }}>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      fireEvent.doubleClick(screen.getByTestId("bar-Notes"));
      expect(info("Notes").zoomed).toBe(true);
      expect(shellOf("Notes")).toHaveAttribute("data-zoomed");
      // Placed by the stylesheet now, from the manager's insets.
      expect(shellOf("Notes").style.width).toBe("");
      expect(shellOf("Notes").style.transform).toBe("");
      expect(shellOf("Notes").querySelector("[data-edge]")).toBeNull();
      fireEvent.doubleClick(screen.getByTestId("bar-Notes"));
      expect(info("Notes").zoomed).toBe(false);
      expect(placeOf("Notes")).toEqual([100, 100]);
      expect(shellOf("Notes").style.width).toBe("480px");
    });

    it("keeps the zoomed size as its own frame once it is dragged", () => {
      render(
        <Desktop insets={{ top: 22, bottom: 60 }}>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      act(() => manager.zoom("Notes"));
      drag(screen.getByTestId("bar-Notes"), [500, 30], [530, 60]);
      expect(info("Notes")).toMatchObject({
        zoomed: false,
        frame: { x: 30, y: 52, width: 1000, height: 700 - 22 - 60 },
      });
    });

    it("enters full screen from the zoom button and leaves it the same way", async () => {
      const user = userEvent.setup();
      render(
        <Desktop>
          <Win id="Notes" />
        </Desktop>,
      );
      await user.click(screen.getByRole("button", { name: "Enter Full Screen" }));
      expect(frameOf("Notes")).toHaveAttribute("data-full-screen");
      expect(shellOf("Notes")).toHaveAttribute("data-full-screen");
      expect(shellOf("Notes").style.width).toBe("");
      expect(Number(shellOf("Notes").style.zIndex)).toBeGreaterThan(1000);
      expect(manager.fullScreenWindowId).toBe("Notes");
      expect(screen.getByRole("button", { name: "Minimize" })).toBeDisabled();

      // Nothing moves or minimizes a full-screen window.
      drag(screen.getByTestId("bar-Notes"), [100, 10], [200, 200]);
      act(() => manager.minimize("Notes"));
      expect(info("Notes")).toMatchObject({ fullScreen: true, minimized: false });

      await user.click(screen.getByRole("button", { name: "Exit Full Screen" }));
      expect(frameOf("Notes")).not.toHaveAttribute("data-full-screen");
      expect(manager.fullScreenWindowId).toBeUndefined();
      expect(placeOf("Notes")).toEqual([40, 40]);
    });

    it("lets a zoomed window that stopped being resizable leave the zoom by its green button", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      act(() => manager.zoom("Notes"));
      rerender(
        <Desktop>
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} resizable={false} />
        </Desktop>,
      );
      expect(info("Notes")).toMatchObject({ zoomed: true, resizable: false });
      const zoom = screen.getByRole("button", { name: "Zoom" });
      expect(zoom).toBeEnabled();
      await user.click(zoom);
      expect(info("Notes").zoomed).toBe(false);
      expect(placeOf("Notes")).toEqual([100, 100]);
      expect(screen.getByRole("button", { name: "Zoom" })).toBeDisabled();
    });

    it("keeps its frame and its state when it becomes a panel", () => {
      const { rerender } = render(
        <Desktop>
          <Win id="Other" />
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} />
        </Desktop>,
      );
      drag(screen.getByTestId("bar-Notes"), [150, 110], [200, 140]);
      act(() => manager.zoom("Notes"));
      fireEvent.pointerDown(frameOf("Other"));
      rerender(
        <Desktop>
          <Win id="Other" />
          <Win id="Notes" defaultFrame={{ x: 100, y: 100 }} panel />
        </Desktop>,
      );
      expect(info("Notes")).toMatchObject({ panel: true, zoomed: true, frame: { x: 150, y: 130 } });
      expect(frameOf("Notes")).toHaveAttribute("data-variant", "panel");
      // Still behind in the order of use, and above the ordinary window as a panel.
      expect(stateOf("Other")).toBe("key");
      expect(info("Notes").z).toBeGreaterThan(info("Other").z);
    });

    it("zooms instead when Option is held, or when the window asks for a zoom button", () => {
      render(
        <Desktop>
          <Win id="First" />
          <Win id="Second" zoomButton="zoom" />
        </Desktop>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Enter Full Screen" }), { altKey: true });
      expect(info("First")).toMatchObject({ zoomed: true, fullScreen: false });
      fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
      expect(info("Second")).toMatchObject({ zoomed: true, fullScreen: false });
    });
  });

  describe("keyboard focus", () => {
    function DockButton({ command }: { command: (manager: WindowManagerApi) => void }) {
      const api = useWindowManager();
      return (
        <button type="button" onClick={() => command(api)}>
          Dock
        </button>
      );
    }

    it("moves into the key window when a Dock asks for the window that is key already", async () => {
      const user = userEvent.setup();
      render(
        <Desktop>
          <Win id="First" />
          <Win id="Second" />
          <DockButton command={(api) => api.focus("Second")} />
        </Desktop>,
      );
      expect(stateOf("Second")).toBe("key");
      await user.click(screen.getByRole("button", { name: "Dock" }));
      expect(frameOf("Second")).toHaveFocus();
      // And again, after the focus went back to the Dock.
      await user.click(screen.getByRole("button", { name: "Dock" }));
      expect(frameOf("Second")).toHaveFocus();
    });

    it.each([
      ["zoomed", (api: WindowManagerApi) => api.zoom("First")],
      ["put in full screen", (api: WindowManagerApi) => api.toggleFullScreen("First")],
    ])("leaves the other window for the one a command %s", async (_, command) => {
      const user = userEvent.setup();
      render(
        <Desktop>
          <Win id="First" />
          <Win id="Second" />
          <DockButton command={command} />
        </Desktop>,
      );
      await user.click(screen.getByRole("button", { name: "Second button" }));
      expect(screen.getByRole("button", { name: "Second button" })).toHaveFocus();
      act(() => command(manager));
      expect(stateOf("First")).toBe("key");
      expect(frameOf("First")).toHaveFocus();
    });

    it("goes to a window opened from inside the desktop", async () => {
      const user = userEvent.setup();
      function Launcher() {
        const [open, setOpen] = useState(false);
        return (
          <Desktop>
            <Win id="First" />
            <button type="button" onClick={() => setOpen(true)}>
              Launch
            </button>
            <Win id="Launched" open={open} onOpenChange={setOpen} />
          </Desktop>
        );
      }
      render(<Launcher />);
      // Nothing took the focus while the page was loading.
      expect(document.body).toHaveFocus();
      await user.click(screen.getByRole("button", { name: "Launch" }));
      expect(stateOf("Launched")).toBe("key");
      expect(frameOf("Launched")).toHaveFocus();
    });

    it("stays out of a window that opens while the focus is elsewhere on the page", () => {
      function Page() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Outside
            </button>
            <Desktop>
              <Win id="Late" open={open} onOpenChange={setOpen} />
            </Desktop>
          </>
        );
      }
      render(<Page />);
      const outside = screen.getByRole("button", { name: "Outside" });
      outside.focus();
      fireEvent.click(outside);
      expect(stateOf("Late")).toBe("key");
      expect(outside).toHaveFocus();
    });

    it("goes to the next window when its owner takes the focused one away", async () => {
      const user = userEvent.setup();
      function Owner() {
        const [open, setOpen] = useState(true);
        return (
          <Desktop>
            <Win id="First" />
            <ManagedWindow id="Second" open={open} aria-label="Second">
              <button type="button" onClick={() => setOpen(false)}>
                Done
              </button>
            </ManagedWindow>
          </Desktop>
        );
      }
      render(<Owner />);
      await user.click(screen.getByRole("button", { name: "Done" }));
      expect(screen.queryByRole("region", { name: "Second" })).toBeNull();
      expect(stateOf("First")).toBe("key");
      expect(frameOf("First")).toHaveFocus();
    });

    it("stays where it is inside a window whose own control ran the command", async () => {
      const user = userEvent.setup();
      render(
        <Desktop>
          <Win id="Notes" />
        </Desktop>,
      );
      const zoom = screen.getByRole("button", { name: "Enter Full Screen" });
      zoom.focus();
      await user.keyboard("{Enter}");
      expect(info("Notes").fullScreen).toBe(true);
      expect(screen.getByRole("button", { name: "Exit Full Screen" })).toHaveFocus();
    });
  });

  describe("closing", () => {
    it("removes an uncontrolled window and reports it", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Desktop>
          <Win id="First" />
          <Win id="Second" onOpenChange={onOpenChange} />
        </Desktop>,
      );
      await user.click(screen.getAllByRole("button", { name: "Close" })[1] as HTMLElement);
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
      expect(screen.queryByRole("region", { name: "Second" })).toBeNull();
      expect(manager.windows.map((w) => w.id)).toEqual(["First"]);
      expect(stateOf("First")).toBe("key");
      expect(frameOf("First")).toHaveFocus();
    });

    it("leaves a controlled window to its owner", () => {
      function Controlled() {
        const [open, setOpen] = useState(false);
        return (
          <Desktop>
            <button type="button" onClick={() => setOpen(true)}>
              Open
            </button>
            <Win id="Notes" open={open} onOpenChange={setOpen} />
          </Desktop>
        );
      }
      render(<Controlled />);
      expect(manager.windows).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      expect(stateOf("Notes")).toBe("key");
      act(() => manager.close("Notes"));
      expect(screen.queryByRole("region", { name: "Notes" })).toBeNull();
      expect(manager.windows).toHaveLength(0);
    });

    it("stays open when its owner does not close it", () => {
      render(
        <Desktop>
          <Win id="Notes" open />
        </Desktop>,
      );
      act(() => manager.close("Notes"));
      expect(stateOf("Notes")).toBe("key");
    });
  });

  it("floats a panel above the windows and leaves the front window main while it is key", () => {
    render(
      <Desktop>
        <Win id="Document" />
        <Win id="Inspector" panel />
        <Win id="Other" />
      </Desktop>,
    );
    expect(frameOf("Inspector")).toHaveAttribute("data-variant", "panel");
    // Other was opened last and is key, yet the panel is stacked above it.
    expect(stateOf("Other")).toBe("key");
    expect(Number(shellOf("Inspector").style.zIndex)).toBeGreaterThan(
      Number(shellOf("Other").style.zIndex),
    );
    fireEvent.pointerDown(frameOf("Inspector"));
    expect(stateOf("Inspector")).toBe("key");
    expect(stateOf("Other")).toBe("main");
    expect(stateOf("Document")).toBe("inactive");
  });

  it("lists each window's application and title, and follows them", () => {
    const { rerender } = render(
      <Desktop>
        <ManagedWindow id="doc-1" app="textedit" title="Untitled" aria-label="Document" />
      </Desktop>,
    );
    expect(info("doc-1")).toMatchObject({ app: "textedit", title: "Untitled", panel: false });
    const rendersBefore = listRenders;
    rerender(
      <Desktop>
        <ManagedWindow id="doc-1" app="textedit" title="Letter" aria-label="Document" />
      </Desktop>,
    );
    expect(info("doc-1").title).toBe("Letter");
    // One render for the rerender above and one for the new title; none after that.
    expect(listRenders).toBeLessThanOrEqual(rendersBefore + 2);
  });

  it("passes the window's props, class and ref to the frame", () => {
    let element: HTMLDivElement | null = null;
    render(
      <Desktop>
        <ManagedWindow
          aria-label="Notes"
          className="mine"
          data-kind="document"
          ref={(node) => {
            element = node;
          }}
        />
      </Desktop>,
    );
    const frame = frameOf("Notes");
    expect(frame).toHaveClass("mac-window", "mine");
    expect(frame).toHaveAttribute("data-kind", "document");
    expect(element).toBe(frame);
    expect(shellOf("Notes")).toHaveClass("mac-managed-window");
    expect(shellOf("Notes").getAttribute("data-window-id")).toBeTruthy();
  });

  it("hands a component with a window of its own everything that window needs", async () => {
    const user = userEvent.setup();
    // An application written as one component, its root a Window: the shape of the demos.
    function App({
      onClose,
      onMinimize,
      onZoom,
      zoomRole,
      minimizeDisabled,
      zoomDisabled,
      onDragRegionPointerDown,
      onDragRegionDoubleClick,
      ...windowProps
    }: ManagedWindowRenderProps) {
      return (
        <Window {...windowProps}>
          <TitleBar
            title="Calculator"
            data-testid="bar-Calculator"
            controls={
              <WindowControls
                onClose={onClose}
                onMinimize={onMinimize}
                onZoom={onZoom}
                zoomRole={zoomRole}
                minimizeDisabled={minimizeDisabled}
                zoomDisabled={zoomDisabled}
              />
            }
            onDragRegionPointerDown={onDragRegionPointerDown}
            onDragRegionDoubleClick={onDragRegionDoubleClick}
          />
        </Window>
      );
    }
    render(
      <Desktop>
        <Win id="Other" />
        <ManagedWindow
          id="calc"
          data-kind="app"
          defaultFrame={{ x: 100, y: 100 }}
          render={(props) => <App {...props} />}
        />
      </Desktop>,
    );
    const frame = frameOf("Calculator");
    expect(frame.parentElement).toHaveAttribute("data-window-id", "calc");
    expect(frame).toHaveAttribute("data-window-state", "key");
    expect(frame).toHaveAttribute("data-kind", "app");
    expect(frame.style.width).toBe("100%");

    drag(screen.getByTestId("bar-Calculator"), [150, 110], [170, 120]);
    expect(info("calc").frame).toMatchObject({ x: 120, y: 110 });
    fireEvent.doubleClick(screen.getByTestId("bar-Calculator"));
    expect(info("calc").zoomed).toBe(true);
    fireEvent.pointerDown(frameOf("Other"));
    expect(frame).toHaveAttribute("data-window-state", "inactive");
    await user.click(screen.getAllByRole("button", { name: "Minimize" })[1] as HTMLElement);
    expect(info("calc").minimized).toBe(true);
    act(() => manager.focus("calc"));
    // The controls follow the window: full screen turns the green button into the way out
    // and disables minimize.
    const calc = within(frame);
    await user.click(calc.getByRole("button", { name: "Enter Full Screen" }));
    expect(info("calc").fullScreen).toBe(true);
    expect(calc.getByRole("button", { name: "Minimize" })).toBeDisabled();
    await user.click(calc.getByRole("button", { name: "Exit Full Screen" }));
    expect(info("calc").fullScreen).toBe(false);
    await user.click(calc.getByRole("button", { name: "Close" }));
    expect(manager.windows.map((w) => w.id)).toEqual(["Other"]);
  });

  it("tells a rendered component when its zoom button is disabled", () => {
    const seen: Partial<ManagedWindowRenderProps>[] = [];
    render(
      <Desktop>
        <ManagedWindow
          id="calc"
          resizable={false}
          zoomButton="zoom"
          render={({ zoomRole, zoomDisabled, minimizeDisabled }) => {
            seen.push({ zoomRole, zoomDisabled, minimizeDisabled });
            return <div>Calculator</div>;
          }}
        />
      </Desktop>,
    );
    expect(seen.at(-1)).toEqual({ zoomRole: "zoom", zoomDisabled: true, minimizeDisabled: false });
  });

  it("renders its windows on the server, none of them key yet", () => {
    const html = renderToString(
      <WindowManager>
        <Win id="Notes" defaultFrame={{ x: 10, y: 20 }} />
      </WindowManager>,
    );
    expect(html).toContain("Notes button");
    expect(html).toContain('data-window-state="inactive"');
    expect(html).toContain("translate3d(10px,20px,0)");
  });

  it("says what is missing when a hook is used outside its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("<WindowManager>");
    expect(() => render(<Chrome title="x" />)).toThrow("<ManagedWindow>");
    expect(() => render(<ManagedWindow />)).toThrow("<WindowManager>");
  });
});
