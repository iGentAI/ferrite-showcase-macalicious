import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useWindowManager,
  useWindowManagerStore,
  type WindowFrame,
  WindowManager,
  type WindowManagerApi,
  type WindowManagerProps,
  type WindowManagerStore,
} from "./index";

let manager: WindowManagerApi;
let store: WindowManagerStore;
let listRenders = 0;
let closed: string[] = [];

function Probe() {
  manager = useWindowManager();
  store = useWindowManagerStore();
  listRenders += 1;
  return null;
}

const noWindow = () => undefined;

/** The least a managed window can be: it registers with the store and shows its record. */
function Pane({
  id,
  panel = false,
  resizable = true,
  frame = { x: 100, y: 30, width: 300, height: 200 },
}: {
  id: string;
  panel?: boolean;
  resizable?: boolean;
  frame?: Partial<WindowFrame>;
}) {
  const store = useWindowManagerStore();
  const info = useSyncExternalStore(store.subscribe, () => store.get(id), noWindow);
  const asked = useSyncExternalStore(store.subscribe, () => store.focusRequest(id));
  // biome-ignore lint/correctness/useExhaustiveDependencies: the frame is where the window opens; it is read once.
  useLayoutEffect(() => {
    store.add(
      { id, app: `${id}-app`, title: id, panel, resizable, minWidth: 290, minHeight: 50, frame },
      () => closed.push(id),
    );
    return () => store.remove(id);
  }, [store, id, panel, resizable]);
  return (
    <button
      type="button"
      data-state={info?.state}
      data-z={info?.z}
      data-asked={asked}
      onFocus={() => store.raise(id)}
    >
      {id}
    </button>
  );
}

function Desktop({ children, ...props }: WindowManagerProps & { children: ReactNode }) {
  return (
    <WindowManager data-testid="desktop" {...props}>
      <Probe />
      {children}
    </WindowManager>
  );
}

const pane = (id: string) => screen.getByRole("button", { name: id });
const info = (id: string) => {
  const found = manager.windows.find((w) => w.id === id);
  if (!found) throw new Error(`no window ${id}`);
  return found;
};
const states = () => Object.fromEntries(manager.windows.map((w) => [w.id, w.state]));
const chord = { ctrlKey: true, altKey: true };

beforeEach(() => {
  listRenders = 0;
  closed = [];
  // jsdom lays nothing out; the desktop is 1000 by 700 points.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(700);
});

describe("WindowManager", () => {
  it("makes the window registered last the one key window, in front", () => {
    render(
      <Desktop>
        <Pane id="First" />
        <Pane id="Second" />
        <Pane id="Third" />
      </Desktop>,
    );
    expect(states()).toEqual({ First: "inactive", Second: "inactive", Third: "key" });
    expect(manager.windows.map((w) => w.z)).toEqual([1, 2, 3]);
    expect(manager.keyWindowId).toBe("Third");
    expect(pane("Third")).toHaveAttribute("data-state", "key");
    expect(info("First")).toMatchObject({ app: "First-app", title: "First", minimized: false });
  });

  it("raises a window that takes the pointer or the focus, and forgets one that goes", () => {
    const { rerender } = render(
      <Desktop>
        <Pane id="First" />
        <Pane id="Second" />
      </Desktop>,
    );
    act(() => pane("First").focus());
    expect(states()).toEqual({ Second: "inactive", First: "key" });
    expect(pane("First")).toHaveAttribute("data-z", "2");
    rerender(
      <Desktop>
        <Pane id="Second" />
      </Desktop>,
    );
    expect(states()).toEqual({ Second: "key" });
  });

  it("keeps a record's identity, and its readers asleep, when nothing about it changes", () => {
    render(
      <Desktop>
        <Pane id="First" />
        <Pane id="Second" />
        <Pane id="Third" />
      </Desktop>,
    );
    const first = info("First");
    const rendersBefore = listRenders;
    // Already in front: no record changes, so nothing that reads the list renders.
    act(() => manager.focus("Third"));
    expect(listRenders).toBe(rendersBefore);
    // Second comes forward; First is still at the back and is the same object.
    act(() => manager.focus("Second"));
    expect(listRenders).toBe(rendersBefore + 1);
    expect(info("First")).toBe(first);
  });

  it("floats a panel above the windows and leaves the front window main while it is key", () => {
    render(
      <Desktop>
        <Pane id="Document" />
        <Pane id="Inspector" panel />
        <Pane id="Other" />
      </Desktop>,
    );
    // Other was registered last and is key, yet the panel is stacked above it.
    expect(states()).toMatchObject({ Other: "key", Inspector: "inactive" });
    expect(info("Inspector").z).toBeGreaterThan(info("Other").z);
    act(() => manager.focus("Inspector"));
    expect(states()).toEqual({ Document: "inactive", Other: "main", Inspector: "key" });
  });

  it("keeps windows and panels below the menu bar and the Dock, however many there are", () => {
    const ids = Array.from({ length: 450 }, (_, i) => `w${i}`);
    render(
      <Desktop>
        {ids.map((id, i) => (
          <Pane key={id} id={id} panel={i % 2 === 1} />
        ))}
      </Desktop>,
    );
    const z = (id: string) => info(id).z;
    const windows = manager.windows.filter((w) => !w.panel).map((w) => w.z);
    const panels = manager.windows.filter((w) => w.panel).map((w) => w.z);
    expect(Math.min(...windows)).toBe(1);
    expect(Math.max(...windows)).toBeLessThan(400);
    expect(Math.min(...panels)).toBeGreaterThan(400);
    expect(Math.max(...panels)).toBeLessThan(900);
    // The order of the windows in front is kept.
    expect(z("w448")).toBeGreaterThan(z("w446"));
    expect(z("w449")).toBeGreaterThan(z("w447"));
    // And a key full-screen window is above every panel.
    act(() => manager.toggleFullScreen("w0"));
    expect(z("w0")).toBeGreaterThan(Math.max(1000, ...panels));
  });

  it("hands the key state on when a window is minimized, and back when it is focused", () => {
    render(
      <Desktop>
        <Pane id="First" />
        <Pane id="Second" />
      </Desktop>,
    );
    act(() => manager.minimize("Second"));
    expect(info("Second")).toMatchObject({ minimized: true, state: "inactive" });
    expect(manager.keyWindowId).toBe("First");
    act(() => manager.focus("Second"));
    expect(info("Second")).toMatchObject({ minimized: false, state: "key" });
    act(() => manager.minimize("First"));
    act(() => manager.minimize("Second"));
    expect(manager.keyWindowId).toBeUndefined();
  });

  it("zooms and enters full screen, in front, and refuses what Catalina refuses", () => {
    render(
      <Desktop>
        <Pane id="Notes" />
        <Pane id="Calculator" resizable={false} />
      </Desktop>,
    );
    act(() => manager.zoom("Calculator"));
    act(() => manager.toggleFullScreen("Calculator"));
    expect(info("Calculator")).toMatchObject({ zoomed: false, fullScreen: false, state: "key" });

    act(() => manager.zoom("Notes"));
    expect(info("Notes")).toMatchObject({ zoomed: true, state: "key" });
    act(() => manager.zoom("Notes"));
    act(() => manager.toggleFullScreen("Notes"));
    expect(info("Notes")).toMatchObject({ zoomed: false, fullScreen: true });
    expect(info("Notes").z).toBeGreaterThan(1000);
    expect(manager.fullScreenWindowId).toBe("Notes");

    // A full-screen window neither zooms nor minimizes.
    act(() => manager.zoom("Notes"));
    act(() => manager.minimize("Notes"));
    expect(info("Notes")).toMatchObject({ zoomed: false, minimized: false, fullScreen: true });

    // Another window brought in front is in front: full screen gives up its place above the
    // menu bar and the Dock, and takes it back when its window is key again.
    act(() => manager.focus("Calculator"));
    expect(manager.fullScreenWindowId).toBeUndefined();
    expect(info("Calculator").z).toBeGreaterThan(info("Notes").z);
    expect(info("Notes").z).toBeLessThan(900);
    act(() => manager.cycle());
    expect(manager.fullScreenWindowId).toBe("Notes");
    expect(info("Notes").z).toBeGreaterThan(1000);
  });

  it("lets a window leave full screen and a zoom after it stopped being resizable", () => {
    const { rerender } = render(
      <Desktop>
        <Pane id="Notes" />
      </Desktop>,
    );
    act(() => manager.toggleFullScreen("Notes"));
    rerender(
      <Desktop>
        <Pane id="Notes" resizable={false} />
      </Desktop>,
    );
    // The pane registers again with its new flag; put it back in full screen, not resizable.
    act(() => store.patch("Notes", { fullScreen: true, zoomed: true }));
    expect(info("Notes")).toMatchObject({ resizable: false, fullScreen: true, zoomed: true });
    act(() => manager.toggleFullScreen("Notes"));
    act(() => manager.zoom("Notes"));
    expect(info("Notes")).toMatchObject({ fullScreen: false, zoomed: false });
    // And it cannot go back in.
    act(() => manager.toggleFullScreen("Notes"));
    act(() => manager.zoom("Notes"));
    expect(info("Notes")).toMatchObject({ fullScreen: false, zoomed: false });
  });

  describe("keyboard focus", () => {
    const asked = (id: string) => Number(pane(id).getAttribute("data-asked"));

    it("asks the window a command made key to take the focus, each time, and only that one", () => {
      render(
        <Desktop>
          <Pane id="First" />
          <Pane id="Second" />
        </Desktop>,
      );
      expect(asked("First")).toBe(0);
      expect(asked("Second")).toBe(0);
      act(() => manager.focus("First"));
      const first = asked("First");
      expect(first).toBeGreaterThan(0);
      expect(asked("Second")).toBe(0);
      // Already key: no record changes, and it is asked again all the same.
      const rendersBefore = listRenders;
      act(() => manager.focus("First"));
      expect(asked("First")).toBeGreaterThan(first);
      expect(listRenders).toBe(rendersBefore);
    });

    it("asks no one for a window it does not know", () => {
      render(
        <Desktop>
          <Pane id="First" />
          <Pane id="Second" />
        </Desktop>,
      );
      act(() => manager.focus("Nobody"));
      act(() => manager.minimize("Nobody"));
      act(() => manager.zoom("Nobody"));
      expect(asked("First") + asked("Second")).toBe(0);
      expect(manager.keyWindowId).toBe("Second");
    });

    it("asks the next window when one goes with the focus inside, and forgets what it asked of it", () => {
      function Sometimes({ refocus }: { refocus: boolean }) {
        const [open, setOpen] = useState(true);
        const manager = useWindowManagerStore();
        closeSecond = () => {
          manager.remove("Second", refocus);
          setOpen(false);
        };
        return open ? <Pane id="Second" /> : null;
      }
      let closeSecond = () => {};
      const { rerender } = render(
        <Desktop>
          <Pane id="First" />
          <Sometimes refocus />
        </Desktop>,
      );
      act(() => manager.focus("Second"));
      expect(store.focusRequest("Second")).toBeGreaterThan(0);
      act(() => closeSecond());
      expect(store.focusRequest("Second")).toBe(0);
      expect(asked("First")).toBeGreaterThan(0);

      // Without the focus inside, nobody is asked.
      rerender(<div />);
      render(
        <Desktop>
          <Pane id="First" />
          <Sometimes refocus={false} />
        </Desktop>,
      );
      act(() => closeSecond());
      expect(manager.keyWindowId).toBe("First");
      expect(asked("First")).toBe(0);
    });

    it("forgets a close that the window's owner did not carry out", () => {
      function Stubborn() {
        const [open, setOpen] = useState(true);
        closeSecond = () => setOpen(false);
        return open ? <Pane id="Second" /> : null;
      }
      let closeSecond = () => {};
      render(
        <Desktop>
          <Pane id="First" />
          <Stubborn />
        </Desktop>,
      );
      act(() => manager.close("Second"));
      act(() => pane("Second").focus());
      act(() => manager.focus("Second"));
      const before = asked("First");
      // Much later the owner takes the window away for a reason of its own.
      act(() => closeSecond());
      expect(asked("First")).toBe(before);
    });

    it("does not ask a window that the pointer or the focus made key", () => {
      render(
        <Desktop>
          <Pane id="First" />
          <Pane id="Second" />
        </Desktop>,
      );
      act(() => pane("First").focus());
      expect(manager.keyWindowId).toBe("First");
      expect(asked("First")).toBe(0);
    });

    it.each([
      ["zoom", () => manager.zoom("First"), "First"],
      ["full screen", () => manager.toggleFullScreen("First"), "First"],
      ["minimize", () => manager.minimize("Second"), "First"],
      ["cycle", () => manager.cycle(), "First"],
    ] as const)("asks the window that is key after %s", (_, command, target) => {
      render(
        <Desktop>
          <Pane id="First" />
          <Pane id="Second" />
        </Desktop>,
      );
      act(command);
      expect(manager.keyWindowId).toBe(target);
      expect(asked(target)).toBeGreaterThan(0);
      expect(asked("Second")).toBe(0);
    });

    it("asks the next window when one closed by command is gone, and not before", () => {
      function Closable() {
        const [open, setOpen] = useState(true);
        closeSecond = () => setOpen(false);
        return open ? <Pane id="Second" /> : null;
      }
      let closeSecond = () => {};
      render(
        <Desktop>
          <Pane id="First" />
          <Closable />
        </Desktop>,
      );
      act(() => manager.close("Second"));
      // The pane's own close handler only records the call: the window is still there.
      expect(asked("First")).toBe(0);
      act(() => closeSecond());
      expect(manager.keyWindowId).toBe("First");
      expect(asked("First")).toBeGreaterThan(0);
    });
  });

  it("brings a minimized window back when it is zoomed or put in full screen", () => {
    render(
      <Desktop>
        <Pane id="First" />
        <Pane id="Second" />
      </Desktop>,
    );
    act(() => manager.minimize("First"));
    act(() => manager.zoom("First"));
    expect(info("First")).toMatchObject({ minimized: false, zoomed: true, state: "key" });
    act(() => manager.minimize("First"));
    act(() => manager.toggleFullScreen("First"));
    expect(info("First")).toMatchObject({ minimized: false, fullScreen: true, state: "key" });
    expect(Number(pane("First").getAttribute("data-asked"))).toBeGreaterThan(0);
  });

  it("goes round the windows in both directions, skipping minimized ones", () => {
    render(
      <Desktop>
        <Pane id="First" />
        <Pane id="Second" />
        <Pane id="Third" />
        <Pane id="Hidden" />
      </Desktop>,
    );
    act(() => manager.minimize("Hidden"));
    act(() => manager.cycle());
    expect(manager.keyWindowId).toBe("First");
    act(() => manager.cycle());
    expect(manager.keyWindowId).toBe("Second");
    act(() => manager.cycle(true));
    expect(manager.keyWindowId).toBe("First");
    expect(info("Hidden").minimized).toBe(true);
  });

  it("asks a window to close itself and leaves the rest to it", () => {
    render(
      <Desktop>
        <Pane id="Notes" />
      </Desktop>,
    );
    act(() => manager.close("Notes"));
    act(() => manager.close("Nobody"));
    expect(closed).toEqual(["Notes"]);
    expect(manager.windows).toHaveLength(1);
  });

  describe("keyboard", () => {
    it("moves and resizes the key window with the arrow keys", () => {
      render(
        <Desktop insets={{ top: 22 }}>
          <Pane id="Back" />
          <Pane id="Notes" />
        </Desktop>,
      );
      fireEvent.keyDown(pane("Notes"), { code: "ArrowRight", ...chord });
      fireEvent.keyDown(pane("Notes"), { code: "ArrowDown", ...chord });
      expect(info("Notes").frame).toEqual({ x: 116, y: 46, width: 300, height: 200 });
      fireEvent.keyDown(pane("Notes"), { code: "ArrowUp", ...chord });
      fireEvent.keyDown(pane("Notes"), { code: "ArrowUp", ...chord });
      fireEvent.keyDown(pane("Notes"), { code: "ArrowLeft", ctrlKey: true, metaKey: true });
      expect(info("Notes").frame).toEqual({ x: 100, y: 22, width: 300, height: 200 });
      fireEvent.keyDown(pane("Notes"), { code: "ArrowDown", shiftKey: true, ...chord });
      fireEvent.keyDown(pane("Notes"), { code: "ArrowLeft", shiftKey: true, ...chord });
      expect(info("Notes").frame).toEqual({ x: 100, y: 22, width: 290, height: 216 });
      expect(info("Back").frame).toEqual({ x: 100, y: 30, width: 300, height: 200 });
    });

    it("keeps the window within reach, as a drag does", () => {
      render(
        <Desktop insets={{ top: 22, bottom: 60 }}>
          <Pane id="Notes" frame={{ x: 100, y: 30, width: 300, height: 200 }} />
        </Desktop>,
      );
      const press = (code: string, times: number) => {
        for (let i = 0; i < times; i++) fireEvent.keyDown(pane("Notes"), { code, ...chord });
      };
      press("ArrowLeft", 100);
      expect(info("Notes").frame.x).toBe(40 - 300);
      press("ArrowRight", 200);
      expect(info("Notes").frame.x).toBe(1000 - 40);
      press("ArrowDown", 100);
      expect(info("Notes").frame.y).toBe(700 - 60 - 22);
      press("ArrowUp", 100);
      expect(info("Notes").frame.y).toBe(22);
    });

    it("keeps 40 points of the window between a Dock at the side and the other edge", () => {
      render(
        <Desktop insets={{ top: 22, left: 80, right: 60 }}>
          <Pane id="Notes" frame={{ x: 100, y: 30, width: 300, height: 200 }} />
        </Desktop>,
      );
      const press = (code: string, times: number) => {
        for (let i = 0; i < times; i++) fireEvent.keyDown(pane("Notes"), { code, ...chord });
      };
      press("ArrowLeft", 100);
      expect(info("Notes").frame.x).toBe(80 + 40 - 300);
      press("ArrowRight", 200);
      expect(info("Notes").frame.x).toBe(1000 - 60 - 40);
      // The store's rule is the one a drag uses too.
      const frame = { x: 990, y: 30, width: 300, height: 200 };
      expect(store.bound(frame, 1000, 700)).toEqual({ ...frame, x: 900 });
    });

    it("does not shrink a window until its title bar is out of reach", () => {
      render(
        <Desktop>
          <Pane id="Notes" frame={{ x: 0, y: 30, width: 310, height: 200 }} />
        </Desktop>,
      );
      const press = (code: string, shiftKey: boolean, times: number) => {
        for (let i = 0; i < times; i++) {
          fireEvent.keyDown(pane("Notes"), { code, shiftKey, ...chord });
        }
      };
      // To the far left: 40 points of the window are left on the desktop.
      press("ArrowLeft", false, 100);
      expect(info("Notes").frame).toMatchObject({ x: -270, width: 310 });
      // 310 wide leaves 40 points; 294 would leave 24, so the window keeps its width.
      press("ArrowLeft", true, 3);
      expect(info("Notes").frame).toMatchObject({ x: -270, width: 310 });
      press("ArrowRight", true, 1);
      expect(info("Notes").frame.width).toBe(326);
    });

    it("still resizes a window that was opened out of bounds", () => {
      render(
        <Desktop insets={{ top: 22 }}>
          <Pane id="Notes" frame={{ x: 2000, y: 0, width: 310, height: 200 }} />
        </Desktop>,
      );
      fireEvent.keyDown(pane("Notes"), { code: "ArrowDown", shiftKey: true, ...chord });
      fireEvent.keyDown(pane("Notes"), { code: "ArrowLeft", shiftKey: true, ...chord });
      expect(info("Notes").frame).toEqual({ x: 2000, y: 0, width: 294, height: 216 });
    });

    it("leaves AltGr, which types characters, to the application", () => {
      render(
        <Desktop>
          <Pane id="Notes" />
        </Desktop>,
      );
      // AltGr+M is a micro sign on a German keyboard; Windows reports Control and Alt with it.
      for (const code of ["KeyM", "KeyZ", "KeyW", "KeyF", "ArrowRight", "Backquote"]) {
        const event = { code, ctrlKey: true, altKey: true, modifierAltGraph: true };
        expect(fireEvent.keyDown(pane("Notes"), event)).toBe(true);
      }
      expect(info("Notes")).toMatchObject({ minimized: false, zoomed: false, fullScreen: false });
      expect(info("Notes").frame.x).toBe(100);
      expect(closed).toEqual([]);
    });

    it("leaves the keys alone without the modifiers, and when the application took the key", () => {
      const { rerender } = render(
        <Desktop>
          <Pane id="Notes" />
        </Desktop>,
      );
      expect(fireEvent.keyDown(pane("Notes"), { code: "ArrowRight" })).toBe(true);
      expect(fireEvent.keyDown(pane("Notes"), { code: "KeyW", ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(pane("Notes"), { code: "KeyQ", ...chord })).toBe(true);
      expect(fireEvent.keyDown(pane("Notes"), { code: "ArrowRight", ...chord })).toBe(false);
      expect(info("Notes").frame.x).toBe(116);

      rerender(
        <Desktop onKeyDown={(event) => event.preventDefault()}>
          <Pane id="Notes" />
        </Desktop>,
      );
      fireEvent.keyDown(pane("Notes"), { code: "ArrowRight", ...chord });
      expect(info("Notes").frame.x).toBe(116);
    });

    it("asks the key window to take the focus after a move or a resize that was made", () => {
      render(
        <Desktop>
          <button type="button">Dock tile</button>
          <Pane id="Notes" />
          <Pane id="Calculator" resizable={false} />
        </Desktop>,
      );
      const tile = screen.getByRole("button", { name: "Dock tile" });
      const asked = (id: string) => Number(pane(id).getAttribute("data-asked"));
      // Refused: a window that is not resizable is not asked.
      fireEvent.keyDown(tile, { code: "ArrowRight", shiftKey: true, ...chord });
      expect(asked("Calculator")).toBe(0);
      fireEvent.keyDown(tile, { code: "ArrowRight", ...chord });
      expect(info("Calculator").frame.x).toBe(116);
      const first = asked("Calculator");
      expect(first).toBeGreaterThan(0);
      act(() => manager.focus("Notes"));
      fireEvent.keyDown(tile, { code: "ArrowDown", shiftKey: true, ...chord });
      expect(info("Notes").frame.height).toBe(216);
      expect(asked("Notes")).toBeGreaterThan(first + 1);
      expect(asked("Calculator")).toBe(0);
    });

    it("does not resize a window that is not resizable, nor a zoomed one", () => {
      render(
        <Desktop>
          <Pane id="Notes" />
          <Pane id="Calculator" resizable={false} />
        </Desktop>,
      );
      fireEvent.keyDown(pane("Calculator"), { code: "ArrowRight", shiftKey: true, ...chord });
      expect(info("Calculator").frame.width).toBe(300);
      act(() => manager.zoom("Notes"));
      fireEvent.keyDown(pane("Notes"), { code: "ArrowRight", shiftKey: true, ...chord });
      expect(info("Notes")).toMatchObject({ zoomed: true, frame: { x: 100, width: 300 } });
    });

    it("moves a zoomed window out of its zoom, from where it was drawn, as a drag does", () => {
      render(
        <Desktop insets={{ top: 22, bottom: 60, left: 80 }}>
          <Pane id="Notes" />
        </Desktop>,
      );
      act(() => manager.zoom("Notes"));
      fireEvent.keyDown(pane("Notes"), { code: "ArrowRight", ...chord });
      expect(info("Notes")).toMatchObject({
        zoomed: false,
        frame: { x: 96, y: 22, width: 920, height: 618 },
      });
    });

    it("zooms, enters full screen, minimizes, closes and goes to the next window", () => {
      render(
        <Desktop>
          <Pane id="First" />
          <Pane id="Second" />
        </Desktop>,
      );
      const desktop = screen.getByTestId("desktop");
      fireEvent.keyDown(desktop, { code: "KeyZ", ...chord });
      expect(info("Second").zoomed).toBe(true);
      fireEvent.keyDown(desktop, { code: "KeyF", ...chord });
      expect(info("Second").fullScreen).toBe(true);
      fireEvent.keyDown(desktop, { code: "KeyF", ...chord });
      fireEvent.keyDown(desktop, { code: "Backquote", ...chord });
      expect(manager.keyWindowId).toBe("First");
      fireEvent.keyDown(desktop, { code: "Backquote", shiftKey: true, ...chord });
      expect(manager.keyWindowId).toBe("Second");
      fireEvent.keyDown(desktop, { code: "KeyM", ...chord });
      expect(info("Second").minimized).toBe(true);
      fireEvent.keyDown(desktop, { code: "KeyW", ...chord });
      expect(closed).toEqual(["First"]);
    });
  });

  it("publishes its insets and cascades windows that have no position below the menu bar", () => {
    render(
      <Desktop insets={{ top: 22, bottom: 64 }}>
        <Pane id="First" frame={{}} />
        <Pane id="Second" frame={{ width: 200 }} />
      </Desktop>,
    );
    const style = screen.getByTestId("desktop").style;
    expect(style.getPropertyValue("--mac-window-manager-inset-top")).toBe("22px");
    expect(style.getPropertyValue("--mac-window-manager-inset-bottom")).toBe("64px");
    expect(style.getPropertyValue("--mac-window-manager-inset-left")).toBe("0px");
    expect(info("First").frame).toEqual({ x: 40, y: 62, width: 480, height: 320 });
    expect(info("Second").frame).toEqual({ x: 64, y: 86, width: 200, height: 320 });
  });

  it("passes its props, class and style to the desktop element", () => {
    render(<WindowManager data-testid="desk" className="mine" style={{ height: 400 }} />);
    const desk = screen.getByTestId("desk");
    expect(desk).toHaveClass("mac-window-manager", "mine");
    expect(desk.style.height).toBe("400px");
  });

  it("says what is missing when a hook is used outside a manager", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("<WindowManager>");
    expect(() => render(<Pane id="x" />)).toThrow("<WindowManager>");
  });
});
