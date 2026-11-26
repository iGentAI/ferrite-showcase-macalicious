import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ManagedWindowInfo } from "macalicious/window-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopApp } from "./desktop-apps";
import { DesktopAppSwitcher, DesktopMissionControl } from "./desktop-overview";
import { changeDesktopValue, connectDesktopValues, forgetDesktopValues } from "./desktop-personal";
import type { SpacesApi } from "./desktop-spaces";
import { followDrag } from "./desktop-spaces-bar";

const pointer = (type: string, pointerId: number, clientX: number, clientY: number) =>
  Object.assign(new MouseEvent(type, { bubbles: true, clientX, clientY }), { pointerId });

describe("following a press", () => {
  it("ends with the pointer that pressed, and hears no other", () => {
    const moved = vi.fn();
    const ended = vi.fn();
    followDrag({ clientX: 0, clientY: 0, pointerId: 1 }, moved, ended);
    document.dispatchEvent(pointer("pointermove", 2, 50, 50));
    document.dispatchEvent(pointer("pointerup", 2, 50, 50));
    expect(moved).not.toHaveBeenCalled();
    expect(ended).not.toHaveBeenCalled();
    document.dispatchEvent(pointer("pointermove", 1, 50, 50));
    expect(moved).toHaveBeenCalledTimes(1);
    document.dispatchEvent(pointer("pointerup", 1, 60, 60));
    expect(ended.mock.calls[0]?.[0]).toMatchObject({ clientX: 60 });
    expect(ended.mock.calls[0]?.[1]).toBe(true);
    document.dispatchEvent(pointer("pointerup", 1, 60, 60));
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("answers null when the browser takes the pointer away", () => {
    const ended = vi.fn();
    followDrag({ clientX: 0, clientY: 0, pointerId: 1 }, vi.fn(), ended);
    document.dispatchEvent(pointer("pointermove", 1, 50, 50));
    document.dispatchEvent(pointer("pointercancel", 1, 50, 50));
    expect(ended).toHaveBeenCalledWith(null, true);
  });
});

const windowOf = (id: string, app: string) =>
  ({ id, app, title: id, minimized: false, away: false, fullScreen: false }) as ManagedWindowInfo;
const apps = ["finder", "notes", "mail"].map((id) => ({ id, name: id })) as DesktopApp[];
const spacesApi = (): SpacesApi =>
  ({
    state: { spaces: ["1", "2"], current: "1", windows: {}, next: 3 },
    show: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    assign: vi.fn(),
    assignToNew: vi.fn(),
    leaveFullScreen: vi.fn(),
    assignApp: vi.fn(),
    press: vi.fn(),
  }) as unknown as SpacesApi;

describe("Mission Control over the live windows", () => {
  let disconnect: () => void;
  let container: HTMLElement;

  beforeEach(() => {
    disconnect = connectDesktopValues(() => undefined);
    container = document.body.appendChild(document.createElement("div"));
    container.innerHTML = '<div data-window-id="a"></div><div data-window-id="b"></div>';
    for (const each of container.children) {
      Object.defineProperty(each, "offsetWidth", { value: 100 });
      Object.defineProperty(each, "offsetHeight", { value: 100 });
    }
    vi.stubGlobal(
      "DOMMatrixReadOnly",
      class {
        e = 0;
        f = 0;
      },
    );
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    document.elementFromPoint = vi.fn(() => {
      const space = document.createElement("div");
      space.dataset.desktopSpace = "2";
      return space;
    });
  });

  afterEach(() => {
    disconnect();
    forgetDesktopValues();
    container.remove();
    vi.unstubAllGlobals();
  });

  const open = (spaces: SpacesApi) =>
    render(
      <DesktopMissionControl
        open
        app={null}
        windows={[windowOf("a", "notes"), windowOf("b", "mail")]}
        apps={apps}
        frameOf={() => ({ x: 0, y: 0, width: 100, height: 100 })}
        container={container}
        onOpenChange={() => undefined}
        onChoose={() => undefined}
        spaces={spaces}
        picture=""
        pictureOf={() => undefined}
      />,
    );
  const button = (id: string) =>
    container.querySelector<HTMLElement>(`[data-mission-window="${id}"]`) as HTMLElement;
  const shell = (id: string) =>
    container.querySelector<HTMLElement>(`[data-window-id="${id}"]`) as HTMLElement;

  it("commits a window let go on a Space, and nothing when the browser cancels the drag", async () => {
    const spaces = spacesApi();
    open(spaces);
    await waitFor(() => expect(button("a")).toBeTruthy());
    await waitFor(() => expect(shell("a").dataset.missionControl).toBe("shown"));
    const before = shell("a").style.translate;

    fireEvent.pointerDown(button("a"), { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    act(() => void document.dispatchEvent(pointer("pointermove", 1, 40, 40)));
    expect(shell("a").style.translate).not.toBe(before);
    act(() => void document.dispatchEvent(pointer("pointercancel", 1, 40, 40)));
    expect(spaces.assign).not.toHaveBeenCalled();
    expect(shell("a").style.translate).toBe(before || "0px 0px");

    fireEvent.pointerDown(button("a"), { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    act(() => void document.dispatchEvent(pointer("pointermove", 1, 40, 40)));
    act(() => void document.dispatchEvent(pointer("pointerup", 1, 40, 40)));
    expect(spaces.assign).toHaveBeenCalledWith("a", "2");
  });

  it("lays the live windows on their buttons again when grouping changes while it is open", async () => {
    open(spacesApi());
    await waitFor(() => expect(shell("a").dataset.missionControl).toBe("shown"));
    const groupedSlot = { left: 300, top: 200, width: 50, height: 50 } as DOMRect;
    await waitFor(() => expect(button("a")).toBeTruthy());
    button("a").getBoundingClientRect = () => groupedSlot;
    act(() => changeDesktopValue("mission-control.groupByApplication", true));
    await waitFor(() => expect(shell("a").style.translate).toBe("300px 200px"));
  });

  it("finds the library's bar and area where its stylesheet selects them", async () => {
    render(
      <DesktopMissionControl
        open
        app="notes"
        windows={[windowOf("a", "notes")]}
        apps={apps}
        frameOf={() => ({ x: 0, y: 0, width: 100, height: 100 })}
        container={container}
        onOpenChange={() => undefined}
        onChoose={() => undefined}
        spaces={spacesApi()}
        picture=""
        pictureOf={() => undefined}
      />,
    );
    await waitFor(() => expect(button("a")).toBeTruthy());
    const popup = ".mac-desktop-shell-mission-control[data-app-expose]";
    const bars = container.querySelectorAll(`${popup} > [role="group"]`);
    const areas = container.querySelectorAll(`${popup} > div:not([role="group"])`);
    expect([...bars].map((each) => each.className)).toEqual(["mac-mission-control-bar"]);
    expect([...areas].map((each) => each.className)).toEqual(["mac-mission-control-area"]);
  });

  it("lays them again when App Exposé takes over with the same windows", async () => {
    const props = {
      apps,
      frameOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      container,
      onOpenChange: () => undefined,
      onChoose: () => undefined,
      spaces: spacesApi(),
      picture: "",
      pictureOf: () => undefined,
      windows: [windowOf("a", "notes"), windowOf("b", "notes")],
    };
    const { rerender } = render(<DesktopMissionControl open app={null} {...props} />);
    await waitFor(() => expect(shell("a").dataset.missionControl).toBe("shown"));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    button("a").getBoundingClientRect = () =>
      ({ left: 120, top: 40, width: 50, height: 50 }) as DOMRect;
    rerender(<DesktopMissionControl open app="notes" {...props} />);
    await waitFor(() => expect(shell("a").style.translate).toBe("120px 40px"));
  });

  it("lays them again when the shelf fills in, without another render of the windows", async () => {
    open(spacesApi());
    await waitFor(() => expect(shell("a").dataset.missionControl).toBe("shown"));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    button("a").getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 50, height: 50 }) as DOMRect;
    const bar = container.querySelector(".mac-mission-control-bar") as HTMLElement;
    bar.append(document.createElement("span"));
    await waitFor(() => expect(shell("a").style.translate).toBe("10px 20px"));
  });
});

describe("the application switcher", () => {
  const renderSwitcher = (backwards = false) => {
    const props = {
      onClose: vi.fn(),
      onChoose: vi.fn(),
      onHide: vi.fn(),
      onQuit: vi.fn(),
      onExpose: vi.fn(),
    };
    render(<DesktopAppSwitcher apps={apps} backwards={backwards} {...props} />);
    return props;
  };
  const press = (key: string, code: string) =>
    fireEvent.keyDown(screen.getByRole("listbox"), { key, code });

  it("starts at the next application, or at the last when opened with Shift", () => {
    const forward = renderSwitcher();
    fireEvent.keyUp(window, { key: "Alt" });
    expect(forward.onChoose).toHaveBeenCalledWith("notes");
    cleanup();
    const back = renderSwitcher(true);
    fireEvent.keyUp(window, { key: "Alt" });
    expect(back.onChoose).toHaveBeenCalledWith("mail");
  });

  it("leaves an application hidden with H hidden when Option is let go", () => {
    const { onHide, onChoose, onClose } = renderSwitcher();
    press("h", "KeyH");
    expect(onHide).toHaveBeenCalledWith("notes");
    fireEvent.keyUp(window, { key: "Alt" });
    expect(onClose).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("chooses the application stepped to after hiding another", () => {
    const { onHide, onChoose } = renderSwitcher();
    press("h", "KeyH");
    expect(onHide).toHaveBeenCalledWith("notes");
    press("`", "Backquote");
    fireEvent.keyUp(window, { key: "Alt" });
    expect(onChoose).toHaveBeenCalledWith("mail");
  });
});
