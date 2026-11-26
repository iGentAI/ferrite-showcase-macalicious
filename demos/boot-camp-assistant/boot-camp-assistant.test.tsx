import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, bootCampAssistantApp } from "./app";
import { BootCampAssistant } from "./boot-camp-assistant";

const frame = () => screen.getByRole("region", { name: "Boot Camp Assistant" });
const button = (name: string) => screen.getByRole("button", { name });
/** The step's name, in bold above its content. */
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;
const task = (name: RegExp) => screen.getByRole("checkbox", { name });
/** The title bar: the window's drag region. */
const bar = () => frame().querySelector("[data-window-drag-region]") as HTMLElement;

afterEach(() => {
  vi.useRealTimers();
});

describe("Boot Camp Assistant", () => {
  it("opens on the Introduction step of the reference capture, at its size", () => {
    render(<BootCampAssistant />);
    expect(frame()).toHaveClass("mac-window", "mac-assistant-window", "mac-boot-camp-assistant");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "783px", height: "548px" });
    expect(heading()).toBe("Introduction");

    const text = screen.getByRole("group", { name: "Introduction" });
    expect(text).toHaveTextContent(/^Boot Camp Assistant helps install Microsoft Windows/);
    expect(text).toHaveTextContent("IMPORTANT: Back up your disk before partitioning it");
    expect(text.querySelectorAll("p")).toHaveLength(2);

    // Two buttons, and no way back from the first step.
    expect(button("Open Boot Camp Help")).toBeEnabled();
    expect(button("Continue")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Go Back" })).toBeNull();
    // An assistant has one size: close and minimize, and a green button that is unavailable.
    const controls = within(screen.getByRole("group", { name: "Window controls" }));
    expect(controls.getByRole("button", { name: "Close" })).toBeEnabled();
    expect(controls.getByRole("button", { name: "Minimize" })).toBeEnabled();
    expect(controls.getByRole("button", { name: "Zoom" })).toBeDisabled();
  });

  it("goes through the steps and back, keeping what was chosen", async () => {
    const user = userEvent.setup();
    render(<BootCampAssistant />);

    await user.click(button("Continue"));
    expect(heading()).toBe("Select Tasks");
    expect(screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-checked"))).toEqual([
      "true",
      "true",
      "true",
    ]);

    // With no task there is nothing to continue with.
    for (const box of screen.getAllByRole("checkbox")) await user.click(box);
    expect(button("Continue")).toBeDisabled();
    await user.click(task(/^Install Windows$/));
    expect(button("Continue")).toBeEnabled();

    await user.click(button("Continue"));
    expect(heading()).toBe("Create a Partition for Windows");
    expect(screen.getByText("Windows: 42 GB")).toBeInTheDocument();
    expect(screen.getByText("macOS: 209 GB")).toBeInTheDocument();

    // The slider divides the disk: what Windows gains, macOS gives.
    const slider = screen.getByRole("slider");
    slider.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(screen.getByText("Windows: 45 GB")).toBeInTheDocument();
    expect(screen.getByText("macOS: 206 GB")).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuetext", "Windows 45 GB, macOS 206 GB");
    // It stops where macOS keeps its least.
    await user.keyboard("{End}");
    expect(screen.getByText("Windows: 171 GB")).toBeInTheDocument();
    expect(screen.getByText("macOS: 80 GB")).toBeInTheDocument();

    // Back, by the button and by Escape, and forward again: the choices are as they were left.
    await user.click(button("Go Back"));
    expect(heading()).toBe("Select Tasks");
    expect(task(/^Install Windows$/)).toBeChecked();
    expect(task(/^Create a Windows install disk$/)).not.toBeChecked();
    await user.keyboard("{Escape}");
    expect(heading()).toBe("Introduction");
    await user.click(button("Continue"));
    await user.click(button("Continue"));
    expect(screen.getByText("Windows: 171 GB")).toBeInTheDocument();
  });

  it("installs on a clock, and Quit on the last step closes the window", () => {
    // The installation is a timer; fake timers stand in for the five seconds it takes.
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<BootCampAssistant defaultStep="partition" onClose={onClose} />);

    fireEvent.click(button("Install"));
    expect(heading()).toBe("Installing");
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAccessibleName("Downloading Windows support software…");
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    // There is no going back while it runs, by the button or by Escape.
    expect(button("Go Back")).toBeDisabled();
    fireEvent.keyDown(frame(), { key: "Escape" });
    expect(heading()).toBe("Installing");

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(progress).toHaveAttribute("aria-valuenow", "50");
    expect(progress).toHaveAccessibleName("Partitioning disk…");

    // Stop returns to the partition; installing again starts from nothing.
    fireEvent.click(button("Stop"));
    expect(heading()).toBe("Create a Partition for Windows");
    fireEvent.click(button("Install"));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(heading()).toBe("Finished");
    expect(screen.getByRole("group", { name: "Finished" })).toHaveTextContent(
      "a Windows partition of 42 GB and 3 tasks",
    );
    // Nothing keeps ticking once it is done.
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(button("Go Back"));
    expect(heading()).toBe("Create a Partition for Windows");
    fireEvent.click(button("Install"));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(button("Quit"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops its clock when it is closed while installing", () => {
    vi.useFakeTimers();
    const { unmount } = render(<BootCampAssistant defaultStep="partition" />);
    fireEvent.click(button("Install"));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("opens its help as a sheet, and is main, not key, while the sheet is open", async () => {
    const user = userEvent.setup();
    render(<BootCampAssistant />);

    await user.click(button("Open Boot Camp Help"));
    const sheet = await screen.findByRole("dialog", { name: "Boot Camp Help" });
    expect(frame()).toHaveAttribute("data-window-state", "main");
    // The step under the sheet takes no input.
    expect(frame().querySelector(".mac-boot-camp-assistant-step")).toHaveAttribute("inert");

    await user.click(within(sheet).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(heading()).toBe("Introduction");
  });

  it("passes window props to its root", () => {
    const ref = createRef<HTMLDivElement>();
    const onPointerDown = vi.fn();
    render(
      <BootCampAssistant
        ref={ref}
        state="inactive"
        className="mine"
        style={{ left: 10 }}
        id="assistant"
        defaultStep="tasks"
        onPointerDown={onPointerDown}
      />,
    );
    const root = frame();
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-window", "mac-boot-camp-assistant", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveAttribute("id", "assistant");
    expect(root).toHaveStyle({ left: "10px" });
    expect(heading()).toBe("Select Tasks");
    fireEvent.pointerDown(root);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("hands the window controls their props and keeps zoom unavailable", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <BootCampAssistant
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        zoomRole="full-screen"
        zoomDisabled={false}
      />,
    );
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    // Whatever a manager says about zoom, an assistant has one size.
    expect(button("Zoom")).toBeDisabled();
    expect(onZoom).not.toHaveBeenCalled();
    expect(frame()).not.toHaveAttribute("zoomrole");

    rerender(<BootCampAssistant minimizeDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Close")).toBeEnabled();
  });

  it("reports a press and a double click on the title bar, its drag region", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <BootCampAssistant
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );

    fireEvent.pointerDown(bar(), { button: 2 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // The window controls and the step are not part of the drag region.
    fireEvent.pointerDown(button("Close"), { button: 0 });
    fireEvent.pointerDown(button("Continue"), { button: 0 });
    fireEvent.pointerDown(screen.getByRole("heading", { level: 1 }), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(bar());
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    await user.dblClick(screen.getByRole("heading", { level: 1 }));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("lets a handler on the window cancel a press or a double click on the title bar", () => {
    const order: string[] = [];
    let cancel = true;
    render(
      <BootCampAssistant
        onPointerDown={(event) => {
          order.push("window");
          if (cancel) event.preventDefault();
        }}
        onDoubleClick={(event) => {
          order.push("window");
          if (cancel) event.preventDefault();
        }}
        onDragRegionPointerDown={() => order.push("bar")}
        onDragRegionDoubleClick={() => order.push("bar")}
      />,
    );

    // Cancelled by the window: the title bar's press and double click are not reported.
    fireEvent.pointerDown(bar(), { button: 0 });
    fireEvent.doubleClick(bar());
    expect(order).toEqual(["window", "window"]);

    // Not cancelled: the window hears each first, then it is reported.
    cancel = false;
    order.length = 0;
    fireEvent.pointerDown(bar(), { button: 0 });
    expect(order).toEqual(["window", "bar"]);
    fireEvent.doubleClick(bar());
    expect(order).toEqual(["window", "bar", "window", "bar"]);
    // A press in the step, after one on the bar, is the window's alone.
    fireEvent.pointerDown(screen.getByRole("heading", { level: 1 }), { button: 0 });
    expect(order).toEqual(["window", "bar", "window", "bar", "window"]);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(bootCampAssistantApp);
    expect(app).toMatchObject({
      id: "boot-camp-assistant",
      name: "Boot Camp Assistant",
      component: BootCampAssistant,
      defaultSize: { width: 783, height: 548 },
      resizable: false,
    });
    expect(app.menus).toEqual(["Boot Camp Assistant", "File", "Edit", "Window", "Help"]);

    render(
      <WindowManager style={{ height: 700 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const host = frame().parentElement as HTMLElement;
    expect(host).toHaveAttribute("data-window-id", "boot-camp-assistant");
    expect(host).toHaveStyle({ width: "783px", height: "548px" });
    expect(frame()).toHaveAttribute("data-window-state", "key");

    // The manager moves the window by its title bar.
    const before = host.style.transform;
    fireEvent.pointerDown(bar(), { button: 0, pointerId: 1, clientX: 300, clientY: 40 });
    fireEvent.pointerMove(bar(), { pointerId: 1, clientX: 340, clientY: 80 });
    fireEvent.pointerUp(bar(), { pointerId: 1, clientX: 340, clientY: 80 });
    expect(host.style.transform).not.toBe(before);

    // The assistant still works in there.
    await user.click(button("Continue"));
    expect(heading()).toBe("Select Tasks");

    await user.click(button("Close"));
    expect(screen.queryByRole("region", { name: "Boot Camp Assistant" })).toBeNull();
  });
});
