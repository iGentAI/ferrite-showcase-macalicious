import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityMonitor } from "./activity-monitor";
import {
  advance,
  arrange,
  COLUMNS,
  createProcess,
  createState,
  defaultProcesses,
  defaultTotals,
  formatBytes,
  formatTime,
  quit,
} from "./activity-monitor-data";
import { activityMonitorApp, app } from "./app";

/*
 * jsdom has no layout, so the table is never measured and renders its first 40 rows: all 32
 * of the default list.
 */
const frame = () => screen.getByRole("region", { name: "Activity Monitor (My Processes)" });
const grid = () => screen.getByRole("grid", { name: "Processes" });
const dataRows = () =>
  within(grid())
    .getAllByRole("row")
    .filter((row) => row.hasAttribute("aria-selected"));
const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole("gridcell")
    .map((cell) => cell.textContent);
const names = () => dataRows().map((row) => cells(row)[0]);
const rowOf = (name: string) => {
  const row = dataRows().find((candidate) => cells(candidate)[0] === name);
  if (!row) throw new Error(`no row named ${name}`);
  return row;
};
const headings = () => screen.getAllByRole("columnheader").map((cell) => cell.textContent);
const heading = (name: string) => screen.getByRole("columnheader", { name });
/** A segment of the toolbar's view switcher; a column can have the same name. */
const view = (name: string) =>
  within(screen.getByRole("group", { name: "View" })).getByRole("button", { name });
const summary = (view: string) => within(screen.getByRole("group", { name: `${view} summary` }));
/** The value beside a label of the footer. */
const statistic = (view: string, label: string) =>
  summary(view).getByText(label).nextElementSibling?.textContent;
/** A toolbar button that is disabled stays reachable, so it is marked with `aria-disabled`. */
const unavailable = (name: string) => {
  const button = screen.getByRole("button", { name });
  return button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled");
};
/** The window while its sheet is open: the page behind a sheet is hidden from assistive technology. */
const held = () =>
  screen.getByRole("region", { name: "Activity Monitor (My Processes)", hidden: true });
const sheetGone = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
/** Answers the sheet that Quit Process opens, and waits for it to go. */
const answer = async (user: UserEvent, button: string) => {
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: button }));
  await sheetGone();
};

afterEach(() => {
  vi.useRealTimers();
});

describe("the window", () => {
  it("opens on the CPU view, sorted by processor use, at the captured size", () => {
    render(<ActivityMonitor defaultUpdateInterval={0} />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().style.width).toBe("839px");
    expect(frame().style.height).toBe("634px");
    expect(headings()).toEqual([
      "Process Name",
      "% CPU",
      "CPU Time",
      "Threads",
      "Idle Wake Ups",
      "% GPU",
      "GPU Time",
      "PID",
      "User",
    ]);
    expect(heading("% CPU")).toHaveAttribute("aria-sort", "descending");
    expect(dataRows()).toHaveLength(defaultProcesses.length);
    expect(cells(dataRows()[0] as HTMLElement)).toEqual([
      "Activity Monitor",
      "28.3",
      "1.67",
      "20",
      "3",
      "0.0",
      "0.00",
      "2026",
      "shackett",
    ]);
    expect(grid()).toHaveAttribute("data-alternating");
    expect(statistic("CPU", "System:")).toBe("1.00%");
    expect(statistic("CPU", "User:")).toBe("2.33%");
    expect(statistic("CPU", "Idle:")).toBe("96.67%");
    expect(statistic("CPU", "Threads:")).toBe("1,384");
    expect(statistic("CPU", "Processes:")).toBe("354");
    expect(screen.getByRole("img", { name: "CPU history" })).toBeInTheDocument();
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <ActivityMonitor
        ref={ref}
        state="inactive"
        width={700}
        height="50vh"
        className="mine"
        data-kind="app"
        style={{ left: 12 }}
        defaultUpdateInterval={0}
        zoomRole="zoom"
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.width).toBe("700px");
    expect(frame().style.height).toBe("50vh");
    expect(frame().style.left).toBe("12px");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Zoom" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);

    const title = screen.getByText("Activity Monitor (My Processes)");
    fireEvent.pointerDown(title, { button: 0 });
    fireEvent.doubleClick(title);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a toolbar control is the control's, not a drag.
    fireEvent.pointerDown(view("Memory"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });

  it("disables the controls a host disables", () => {
    render(<ActivityMonitor defaultUpdateInterval={0} minimizeDisabled zoomDisabled />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeDisabled();
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(activityMonitorApp);
    expect(app).toMatchObject({
      id: "activity-monitor",
      name: "Activity Monitor",
      defaultSize: { width: 839, height: 634 },
      resizable: true,
    });
    expect(app.menus[0]).toBe("Activity Monitor");
    render(
      <WindowManager style={{ height: 700 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} defaultUpdateInterval={0} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().parentElement).toHaveAttribute("data-window-id", "activity-monitor");
    expect(names()[0]).toBe("Activity Monitor");
    await user.click(within(frame()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Activity Monitor (My Processes)" })).toBeNull();
  });
});

describe("sorting", () => {
  it("sorts by the heading clicked, ascending first, and reverses on a second click", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} />);
    await user.click(screen.getByRole("button", { name: "Process Name" }));
    expect(heading("Process Name")).toHaveAttribute("aria-sort", "ascending");
    expect(heading("% CPU")).toHaveAttribute("aria-sort", "none");
    expect(names().slice(0, 3)).toEqual(["Activity Monitor", "adprivacyd", "appstoreagent"]);

    await user.click(screen.getByRole("button", { name: "Process Name" }));
    expect(heading("Process Name")).toHaveAttribute("aria-sort", "descending");
    expect(names()[0]).toBe("ViewBridgeAuxiliary");

    await user.click(screen.getByRole("button", { name: "PID" }));
    expect(names()[0]).toBe("cfprefsd");
    expect(cells(dataRows()[0] as HTMLElement)[7]).toBe("472");
  });

  it("keeps a view's sort while another view is shown", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} />);
    await user.click(screen.getByRole("button", { name: "Threads" }));
    await user.click(view("Memory"));
    expect(heading("Memory")).toHaveAttribute("aria-sort", "descending");
    await user.click(view("CPU"));
    expect(heading("Threads")).toHaveAttribute("aria-sort", "ascending");
  });

  it("keeps the order of the list among equal values", () => {
    const cpu = COLUMNS.cpu.find((column) => column.id === "cpu");
    const sorted = arrange(defaultProcesses, cpu, "descending");
    expect(sorted.map((process) => process.pid)).toEqual(
      defaultProcesses.map((process) => process.pid),
    );
  });
});

describe("selection", () => {
  it("selects the row pressed and enables the commands that need a process", async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();
    render(<ActivityMonitor defaultUpdateInterval={0} onInspect={onInspect} />);
    expect(unavailable("Quit Process")).toBe(true);
    expect(unavailable("Inspect")).toBe(true);

    fireEvent.mouseDown(rowOf("Finder"));
    expect(rowOf("Finder")).toHaveAttribute("aria-selected", "true");
    expect(grid()).toHaveFocus();
    expect(unavailable("Quit Process")).toBe(false);

    fireEvent.mouseDown(rowOf("Spotlight"));
    expect(rowOf("Finder")).toHaveAttribute("aria-selected", "false");
    expect(rowOf("Spotlight")).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Inspect" }));
    expect(onInspect).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Spotlight" }));
    fireEvent.doubleClick(rowOf("Finder"));
    expect(onInspect).toHaveBeenLastCalledWith(expect.objectContaining({ pid: 1711 }));
    expect(onInspect).toHaveBeenCalledTimes(2);
  });

  it("moves the selection with the arrow keys and keeps it through a sort", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} defaultSelectedPid={2026} />);
    expect(rowOf("Activity Monitor")).toHaveAttribute("aria-selected", "true");
    act(() => grid().focus());
    await user.keyboard("{ArrowDown}");
    expect(rowOf("iconservicesagent")).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Process Name" }));
    expect(rowOf("iconservicesagent")).toHaveAttribute("aria-selected", "true");
  });

  it("selects by typing the start of a name and inspects with Return", async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();
    render(<ActivityMonitor defaultUpdateInterval={0} onInspect={onInspect} />);
    act(() => grid().focus());
    // Return without a selected row inspects nothing.
    await user.keyboard("{Enter}");
    expect(onInspect).not.toHaveBeenCalled();

    // "f" finds Finder, the first of the two names that start with it; "fo" moves on to fontd.
    await user.keyboard("f");
    expect(rowOf("Finder")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("o");
    expect(rowOf("fontd")).toHaveAttribute("aria-selected", "true");
    expect(rowOf("Finder")).toHaveAttribute("aria-selected", "false");
    expect(unavailable("Inspect")).toBe(false);

    await user.keyboard("{Enter}");
    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect).toHaveBeenLastCalledWith(expect.objectContaining({ pid: 493 }));
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onInspect).toHaveBeenCalledTimes(2);
    expect(onInspect).toHaveBeenLastCalledWith(expect.objectContaining({ name: "trustd" }));
  });

  it("quits the selected process and counts it out of the footer", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} defaultSelectedPid={1711} />);
    await user.click(screen.getByRole("button", { name: "Quit Process" }));
    // Nothing is quit before the sheet is answered.
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName("Are you sure you want to quit this process?");
    expect(sheet).toHaveAccessibleDescription("Do you really want to quit “Finder”?");
    expect(within(held()).getAllByRole("row", { hidden: true })).toHaveLength(
      defaultProcesses.length + 1,
    );
    await answer(user, "Quit");
    expect(names()).not.toContain("Finder");
    expect(dataRows()).toHaveLength(defaultProcesses.length - 1);
    expect(statistic("CPU", "Processes:")).toBe("353");
    expect(statistic("CPU", "Threads:")).toBe("1,375");
    expect(unavailable("Quit Process")).toBe(true);
  });

  it("holds the window while the sheet is open and keeps the process on Cancel and Escape", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} defaultSelectedPid={1711} />);
    expect(frame()).toHaveAttribute("data-window-state", "key");

    await user.click(screen.getByRole("button", { name: "Quit Process" }));
    await screen.findByRole("dialog");
    expect(held()).toHaveAttribute("data-window-state", "main");
    expect(screen.getByRole("button", { name: "Close", hidden: true })).toBeDisabled();
    expect(screen.getByRole("toolbar", { name: "Toolbar", hidden: true })).toHaveAttribute("inert");
    expect(
      screen.getByRole("grid", { name: "Processes", hidden: true }).closest("[inert]"),
    ).not.toBe(null);
    await answer(user, "Cancel");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    expect(rowOf("Finder")).toHaveAttribute("aria-selected", "true");
    expect(dataRows()).toHaveLength(defaultProcesses.length);

    await user.click(screen.getByRole("button", { name: "Quit Process" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await sheetGone();
    expect(dataRows()).toHaveLength(defaultProcesses.length);

    // Force Quit removes the process too.
    await user.click(screen.getByRole("button", { name: "Quit Process" }));
    await answer(user, "Force Quit");
    expect(names()).not.toContain("Finder");
  });

  it("leaves a window that is not key as it is while the sheet is open", async () => {
    const user = userEvent.setup();
    render(
      <ActivityMonitor state="inactive" defaultUpdateInterval={0} defaultSelectedPid={1711} />,
    );
    await user.click(screen.getByRole("button", { name: "Quit Process" }));
    await screen.findByRole("dialog");
    expect(held()).toHaveAttribute("data-window-state", "inactive");
  });
});

describe("views", () => {
  it("shows the columns and the footer of the view chosen in the toolbar", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<ActivityMonitor defaultUpdateInterval={0} onTabChange={onTabChange} />);
    expect(view("CPU")).toHaveAttribute("aria-pressed", "true");

    await user.click(view("Memory"));
    expect(onTabChange).toHaveBeenLastCalledWith("memory");
    expect(view("Memory")).toHaveAttribute("aria-pressed", "true");
    expect(view("CPU")).toHaveAttribute("aria-pressed", "false");
    expect(headings()).toEqual(["Process Name", "Memory", "Threads", "Ports", "PID", "User"]);
    expect(statistic("Memory", "Physical Memory:")).toBe("16.00 GB");
    expect(summary("Memory").getByText("MEMORY PRESSURE")).toBeInTheDocument();

    await user.click(view("Energy"));
    expect(headings()).toContain("Energy Impact");
    await user.click(view("Disk"));
    expect(headings()).toContain("Bytes Written");
    await user.click(view("Network"));
    expect(headings()).toContain("Rcvd Packets");
    expect(summary("Network").getByText("PACKETS")).toBeInTheDocument();
    expect(onTabChange).toHaveBeenCalledTimes(4);

    // The selected view cannot be switched off.
    await user.click(view("Network"));
    expect(view("Network")).toHaveAttribute("aria-pressed", "true");
    expect(onTabChange).toHaveBeenCalledTimes(4);
  });

  it("follows a controlled view", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const { rerender } = render(
      <ActivityMonitor defaultUpdateInterval={0} tab="disk" onTabChange={onTabChange} />,
    );
    expect(headings()).toContain("Bytes Read");
    await user.click(view("CPU"));
    expect(onTabChange).toHaveBeenLastCalledWith("cpu");
    expect(headings()).toContain("Bytes Read");
    rerender(<ActivityMonitor defaultUpdateInterval={0} tab="cpu" onTabChange={onTabChange} />);
    expect(headings()).toContain("% CPU");
  });

  it("totals the listed processes in the Energy view, also while paused and after a quit", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} defaultSelectedPid={2026} />);
    await user.click(view("Energy"));
    expect(statistic("Energy", "Energy Impact:")).toBe("10.3");
    await user.click(screen.getByRole("button", { name: "Quit Process" }));
    await answer(user, "Quit");
    expect(statistic("Energy", "Energy Impact:")).toBe("0.4");
  });

  it("keeps the selection when the view changes", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} defaultSelectedPid={855} />);
    await user.click(view("Network"));
    expect(rowOf("Spotlight")).toHaveAttribute("aria-selected", "true");
  });
});

describe("search", () => {
  it("lists the processes whose name contains the text, whatever its case", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} />);
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "SPOT");
    expect(names()).toEqual(["Spotlight", "QuickLookUIService (Spotlight)"]);
    expect(grid()).toHaveAttribute("aria-rowcount", "3");
    // The footer still counts every process.
    expect(statistic("CPU", "Processes:")).toBe("354");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(field).toHaveValue("");
    expect(dataRows()).toHaveLength(defaultProcesses.length);

    await user.type(field, "no such process");
    expect(dataRows()).toHaveLength(0);
  });

  it("makes Quit Process and Inspect unavailable while it hides the selected process", async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();
    render(
      <ActivityMonitor defaultUpdateInterval={0} defaultSelectedPid={1711} onInspect={onInspect} />,
    );
    expect(unavailable("Quit Process")).toBe(false);
    expect(unavailable("Inspect")).toBe(false);

    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "spot");
    expect(names()).not.toContain("Finder");
    expect(unavailable("Quit Process")).toBe(true);
    expect(unavailable("Inspect")).toBe(true);
    // The commands do nothing to the process that is not listed.
    await user.click(screen.getByRole("button", { name: "Quit Process" }));
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onInspect).not.toHaveBeenCalled();

    // The selection is kept, so the commands return with the process.
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(dataRows()).toHaveLength(defaultProcesses.length);
    expect(rowOf("Finder")).toHaveAttribute("aria-selected", "true");
    expect(unavailable("Quit Process")).toBe(false);
    expect(unavailable("Inspect")).toBe(false);

    // The Action menu's commands follow the toolbar's.
    await user.type(field, "spot");
    await user.click(screen.getByRole("button", { name: "Action" }));
    expect(await screen.findByRole("menuitem", { name: "Quit Process" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Inspect Process" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("live updates", () => {
  it("moves the numbers every two seconds and keeps the rows sorted", () => {
    vi.useFakeTimers();
    render(<ActivityMonitor />);
    expect(cells(rowOf("Activity Monitor"))[2]).toBe("1.67");

    act(() => vi.advanceTimersByTime(1999));
    expect(cells(rowOf("Activity Monitor"))[2]).toBe("1.67");
    act(() => vi.advanceTimersByTime(1));
    const afterOne = cells(rowOf("Activity Monitor"));
    expect(Number(afterOne[2])).toBeGreaterThan(1.67);
    expect(afterOne[7]).toBe("2026");

    act(() => vi.advanceTimersByTime(8000));
    expect(Number(cells(rowOf("Activity Monitor"))[2])).toBeGreaterThan(Number(afterOne[2]));
    const use = dataRows().map((row) => Number(cells(row)[1]));
    expect(use).toEqual([...use].sort((a, b) => b - a));
    expect(dataRows()).toHaveLength(defaultProcesses.length);
    // The footer follows: the three shares still add up.
    const share = (label: string) => Number.parseFloat(statistic("CPU", label) ?? "");
    expect(share("System:") + share("User:") + share("Idle:")).toBeCloseTo(100, 1);
    expect(share("User:")).not.toBe(2.33);
  });

  it("keeps the selection on its process while the rows move", () => {
    vi.useFakeTimers();
    render(<ActivityMonitor defaultSelectedPid={855} />);
    act(() => vi.advanceTimersByTime(6000));
    expect(rowOf("Spotlight")).toHaveAttribute("aria-selected", "true");
    expect(dataRows().filter((row) => row.getAttribute("aria-selected") === "true")).toHaveLength(
      1,
    );
  });

  it("updates at the interval given and not at all when it is 0", () => {
    vi.useFakeTimers();
    const { unmount } = render(<ActivityMonitor defaultUpdateInterval={500} />);
    act(() => vi.advanceTimersByTime(500));
    expect(cells(rowOf("Activity Monitor"))[2]).not.toBe("1.67");
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    render(<ActivityMonitor defaultUpdateInterval={0} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(cells(rowOf("Activity Monitor"))[2]).toBe("1.67");
  });

  it("draws the graph once there are two points", () => {
    vi.useFakeTimers();
    render(<ActivityMonitor />);
    const graph = screen.getByRole("img", { name: "CPU history" });
    expect(graph.querySelector("path")).toBeNull();
    act(() => vi.advanceTimersByTime(4000));
    expect(graph.querySelectorAll("path")).toHaveLength(3);
  });

  it("is the same simulation on every run", () => {
    const start = createState(defaultProcesses, defaultTotals);
    const once = advance(start, 2);
    expect(advance(start, 2)).toEqual(once);
    expect(once.processes).not.toEqual(start.processes);
    expect(once.history).toHaveLength(1);
    let state = start;
    for (let step = 0; step < 100; step++) state = advance(state, 2);
    expect(state.history).toHaveLength(40);
    for (const process of state.processes) {
      expect(process.cpu).toBeGreaterThanOrEqual(0);
      expect(process.threads).toBeGreaterThanOrEqual(1);
    }
    expect(quit(state, -1)).toBe(state);
  });

  it("moves network packets in proportion to the seconds that pass", () => {
    // The random numbers drawn do not depend on a step's length, so from one state a
    // ten-second step moves the processes a one-second step moves, by up to ten times as much.
    let state = createState(defaultProcesses, defaultTotals);
    let active = 0;
    for (let step = 0; step < 20; step++) {
      const short = advance(state, 1);
      const long = advance(state, 10);
      for (const [index, before] of state.processes.entries()) {
        const one = (short.processes[index]?.sentPackets ?? 0) - before.sentPackets;
        const after = long.processes[index] ?? before;
        const ten = after.sentPackets - before.sentPackets;
        if (one === 0) {
          expect(ten).toBe(0);
          continue;
        }
        active++;
        expect(one).toBeLessThanOrEqual(6);
        expect(ten).toBeGreaterThan(10 * (one - 1));
        expect(ten).toBeLessThanOrEqual(10 * one);
        // What is received and the bytes follow the packets sent.
        expect(after.receivedPackets - before.receivedPackets).toBe(ten * 2);
        expect(after.sentBytes - before.sentBytes).toBe(ten * 420);
        expect(after.receivedBytes - before.receivedBytes).toBe(ten * 2 * 1130);
      }
      state = short;
    }
    expect(active).toBeGreaterThan(0);
  });
});

describe("the Action menu", () => {
  it("starts, changes and pauses the updates", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const time = () => cells(rowOf("Activity Monitor"))[2];
    render(<ActivityMonitor defaultUpdateInterval={0} />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(time()).toBe("1.67");

    await user.click(screen.getByRole("button", { name: "Action" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Update Very Often (1 sec)" }),
    );
    act(() => vi.advanceTimersByTime(1000));
    const moved = time();
    expect(Number(moved)).toBeGreaterThan(1.67);

    await user.click(screen.getByRole("button", { name: "Action" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Pause Updates" }));
    const paused = time();
    expect(Number(paused)).toBeGreaterThanOrEqual(Number(moved));
    act(() => vi.advanceTimersByTime(30_000));
    expect(time()).toBe(paused);
  });

  it("changes the update frequency", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor />);
    await user.click(screen.getByRole("button", { name: "Action" }));
    expect(
      await screen.findByRole("menuitemradio", { name: "Update Often (2 sec)" }),
    ).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "Pause Updates" }));

    await user.click(screen.getByRole("button", { name: "Action" }));
    expect(await screen.findByRole("menuitemradio", { name: "Pause Updates" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Update Often (2 sec)" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("quits the selected process", async () => {
    const user = userEvent.setup();
    render(<ActivityMonitor defaultUpdateInterval={0} defaultSelectedPid={855} />);
    await user.click(screen.getByRole("button", { name: "Action" }));
    await user.click(await screen.findByRole("menuitem", { name: "Quit Process" }));
    await answer(user, "Quit");
    expect(names()).not.toContain("Spotlight");
  });
});

describe("formatting", () => {
  it("writes times and sizes as Activity Monitor does", () => {
    expect(formatTime(1.67)).toBe("1.67");
    expect(formatTime(62.5)).toBe("1:02.50");
    expect(formatTime(59.999)).toBe("1:00.00");
    expect(formatTime(119.999)).toBe("2:00.00");
    expect(formatBytes(0)).toBe("0 bytes");
    expect(formatBytes(512_000)).toBe("512 KB");
    expect(formatBytes(1_250_000)).toBe("1.3 MB");
    expect(formatBytes(2_500_000_000)).toBe("2.50 GB");
  });

  it("invents the same values for a process every time", () => {
    expect(createProcess("Finder", 0, 14.9, 9, 1, 1711, "files")).toEqual(
      defaultProcesses.find((process) => process.pid === 1711),
    );
  });
});
