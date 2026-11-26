import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Console } from "./console";
import {
  type ConsoleMessage,
  type ConsoleMessageType,
  copyableMessages,
  createState,
  defaultReports,
  receive,
} from "./console-data";

/*
 * jsdom has no layout, so the table is never measured and renders its first 40 rows: all of
 * the short lists used here. The stream is stopped unless a test is about it.
 */
const message = (
  id: number,
  type: ConsoleMessageType,
  time: string,
  process: string,
  text: string,
  more: Partial<ConsoleMessage> = {},
): ConsoleMessage => ({
  id,
  type,
  date: "2019-10-03",
  time: `${time}-0500`,
  process,
  pid: 100 + id,
  thread: 0x700 + id,
  activity: 0,
  subsystem: "",
  category: "",
  message: text,
  ...more,
});

const MESSAGES = [
  message(1, "default", "09:00:01.000000", "mds", "Indexing started", {
    subsystem: "com.example.index",
    category: "Scan",
    activity: 77,
  }),
  message(2, "error", "09:00:02.000000", "airportd", "Scan failed"),
  message(3, "default", "09:00:03.000000", "hidd", "Pointer moved"),
  message(4, "fault", "09:00:04.000000", "Finder", "Unexpected exit"),
  message(5, "info", "09:00:05.000000", "bluetoothd", "Indexing peers"),
];

const REPORTS = {
  ...defaultReports,
  "crash-reports": [
    message(11, "fault", "08:00:00.000000", "Notes", "Notes.crash"),
    message(12, "fault", "08:30:00.000000", "Preview", "Preview.crash"),
  ],
};

const open = (props: Partial<Parameters<typeof Console>[0]> = {}) =>
  render(<Console messages={MESSAGES} reports={REPORTS} streamInterval={0} {...props} />);

const frame = () => screen.getByRole("region", { name: /^Console \(/ });
const title = () => frame().getAttribute("aria-labelledby") && screen.getByText(/^Console \(/);
const grid = () => screen.getByRole("grid", { name: "Messages" });
const dataRows = () =>
  within(grid())
    .queryAllByRole("row")
    .filter((row) => row.hasAttribute("aria-selected"));
/** The Process column of the rows, in order: the rows are told apart by it. */
const processes = () =>
  dataRows().map((row) => within(row).getAllByRole("gridcell")[2]?.textContent);
const rowOf = (process: string) => {
  const row = dataRows().find(
    (candidate) => within(candidate).getAllByRole("gridcell")[2]?.textContent === process,
  );
  if (!row) throw new Error(`no row of ${process}`);
  return row;
};
const heading = (name: string) => screen.getByRole("columnheader", { name });
const button = (name: string) => screen.getByRole("button", { name });
const source = (name: string) => screen.getByRole("treeitem", { name });
const detail = () => screen.getByRole("region", { name: "Message details" });
/** A toolbar button that is disabled stays reachable, so it is marked with `aria-disabled`. */
const unavailable = (name: string) =>
  button(name).getAttribute("aria-disabled") === "true" || button(name).hasAttribute("disabled");

afterEach(() => {
  vi.useRealTimers();
});

describe("several messages", () => {
  it("counts them in the detail pane and writes each as a line for Copy", () => {
    open();
    fireEvent.mouseDown(rowOf("hidd"));
    fireEvent.mouseDown(rowOf("Finder"), { ctrlKey: true });
    expect(within(detail()).getByText("2 Messages Selected")).toBeInTheDocument();
    expect(copyableMessages([MESSAGES[1] as ConsoleMessage, MESSAGES[3] as ConsoleMessage])).toBe(
      "Error\t2019-10-03 09:00:02.000000-0500\tairportd\tScan failed\n" +
        "Fault\t2019-10-03 09:00:04.000000-0500\tFinder\tUnexpected exit",
    );
  });
});

describe("a report source with nothing to list", () => {
  it("says why when the host gives a reason, and only there", async () => {
    const user = userEvent.setup();
    open({
      noReportsNote: "No reports here.",
      reports: { ...REPORTS, "crash-reports": [], "spin-reports": REPORTS["crash-reports"] },
    });
    expect(screen.queryByText("No reports here.")).toBeNull();
    await user.click(source("Crash Reports"));
    expect(screen.getByText("No reports here.")).toBeInTheDocument();
    await user.click(source("Spin Reports"));
    expect(screen.queryByText("No reports here.")).toBeNull();
  });
});

describe("the window", () => {
  it("opens on the device's messages at the captured size, titled with their number", () => {
    open();
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("1000px");
    expect(frame().style.height).toBe("500px");
    expect(title()).toHaveTextContent("Console (5 messages)");
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Type",
      "Time",
      "Process",
      "Message",
    ]);
    expect(processes()).toEqual(["mds", "airportd", "hidd", "Finder", "bluetoothd"]);
    expect(source("ismh15")).toHaveAttribute("aria-selected", "true");
    expect(within(detail()).getByText("No Message Selected")).toBeInTheDocument();
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const handlers = {
      onClose: vi.fn(),
      onMinimize: vi.fn(),
      onZoom: vi.fn(),
      onDragRegionPointerDown: vi.fn(),
      onDragRegionDoubleClick: vi.fn(),
    };
    open({
      ref,
      state: "inactive",
      width: 800,
      height: 420,
      className: "hosted",
      style: { position: "absolute", left: 12 },
      zoomRole: "zoom",
      ...handlers,
    });
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveClass("mac-window", "hosted");
    expect(frame().style.width).toBe("800px");
    expect(frame().style.height).toBe("420px");
    expect(frame().style.left).toBe("12px");

    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    expect(handlers.onMinimize).toHaveBeenCalledTimes(1);
    expect(handlers.onZoom).toHaveBeenCalledTimes(1);

    const bar = screen.getByText(/^Console \(/);
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(handlers.onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(handlers.onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a toolbar control is the control's, not a drag.
    fireEvent.pointerDown(button("Clear"), { button: 0 });
    expect(handlers.onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });
});

describe("the sidebar", () => {
  it("lists the entries of the source chosen, and the device's messages again", async () => {
    const user = userEvent.setup();
    const onSourceChange = vi.fn();
    open({ onSourceChange });
    await user.click(source("Crash Reports"));
    expect(source("Crash Reports")).toHaveAttribute("aria-selected", "true");
    expect(onSourceChange).toHaveBeenLastCalledWith("crash-reports");
    expect(processes()).toEqual(["Notes", "Preview"]);
    expect(title()).toHaveTextContent("Console (2 messages)");

    await user.click(source("ismh15"));
    expect(processes()).toHaveLength(5);
  });

  it("keeps each source's selected message", async () => {
    const user = userEvent.setup();
    open({ defaultSelectedId: 3 });
    expect(within(detail()).getByRole("textbox", { name: "Message" })).toHaveValue("Pointer moved");
    await user.click(source("Crash Reports"));
    expect(within(detail()).getByText("No Message Selected")).toBeInTheDocument();
    fireEvent.mouseDown(rowOf("Preview"));
    await user.click(source("ismh15"));
    expect(within(detail()).getByRole("textbox", { name: "Message" })).toHaveValue("Pointer moved");
    await user.click(source("Crash Reports"));
    expect(within(detail()).getByRole("textbox", { name: "Message" })).toHaveValue("Preview.crash");
  });

  it("is hidden and shown by the scope bar's button", async () => {
    const user = userEvent.setup();
    open();
    await user.click(button("Hide Sidebar"));
    expect(screen.queryByRole("tree", { name: "Sources" })).toBeNull();
    await user.click(button("Show Sidebar"));
    expect(screen.getByRole("tree", { name: "Sources" })).toBeVisible();
  });
});

describe("the table", () => {
  it("sorts by the heading clicked, ascending first, and reverses on a second click", async () => {
    const user = userEvent.setup();
    open();
    expect(heading("Time")).toHaveAttribute("aria-sort", "none");
    await user.click(button("Process"));
    expect(heading("Process")).toHaveAttribute("aria-sort", "ascending");
    expect(processes()).toEqual(["airportd", "bluetoothd", "Finder", "hidd", "mds"]);

    await user.click(button("Process"));
    expect(heading("Process")).toHaveAttribute("aria-sort", "descending");
    expect(processes()).toEqual(["mds", "hidd", "Finder", "bluetoothd", "airportd"]);

    // Type orders by severity, and messages of one level stay in order of arrival.
    await user.click(button("Type"));
    expect(processes()).toEqual(["mds", "hidd", "bluetoothd", "airportd", "Finder"]);
    await user.click(button("Time"));
    await user.click(button("Time"));
    expect(processes()).toEqual(["bluetoothd", "Finder", "hidd", "airportd", "mds"]);
    await user.click(button("Message"));
    expect(processes()).toEqual(["bluetoothd", "mds", "hidd", "airportd", "Finder"]);
  });

  it("shows the message of the row selected in the detail pane, with more on request", async () => {
    const user = userEvent.setup();
    open();
    fireEvent.mouseDown(rowOf("hidd"));
    expect(rowOf("hidd")).toHaveAttribute("aria-selected", "true");
    const pane = within(detail());
    expect(pane.getByText("hidd")).toBeInTheDocument();
    expect(pane.getByText("Subsystem: --")).toBeInTheDocument();
    expect(pane.getByText("2019-10-03 09:00:03.000000-0500")).toBeInTheDocument();
    expect(pane.getByRole("textbox", { name: "Message" })).toHaveValue("Pointer moved");

    expect(pane.queryByText("Thread ID: 0x703")).toBeNull();
    await user.click(pane.getByRole("button", { name: "Details" }));
    expect(pane.getByText("Thread ID: 0x703")).toBeInTheDocument();
    expect(pane.getByText("PID: 103")).toBeInTheDocument();
    await user.click(pane.getByRole("button", { name: "Hide" }));
    expect(pane.queryByText("Thread ID: 0x703")).toBeNull();

    fireEvent.mouseDown(rowOf("mds"));
    expect(pane.getByText("Subsystem: com.example.index")).toBeInTheDocument();
    expect(pane.getByText("Category: Scan")).toBeInTheDocument();
    expect(pane.getByRole("textbox", { name: "Message" })).toHaveValue("Indexing started");
  });

  it("marks the level of a message in the Type column", () => {
    open();
    expect(within(rowOf("airportd")).getByRole("img", { name: "Error" })).toBeInTheDocument();
    expect(within(rowOf("Finder")).getByRole("img", { name: "Fault" })).toBeInTheDocument();
    expect(within(rowOf("hidd")).queryByRole("img")).toBeNull();
  });
});

describe("filters", () => {
  it("searches the process names and the message text, in any letter case", async () => {
    const user = userEvent.setup();
    open({ defaultSelectedId: 3 });
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "index");
    expect(processes()).toEqual(["mds", "bluetoothd"]);
    expect(title()).toHaveTextContent("Console (2 messages)");
    // The selected message is not listed: the detail pane waits for it.
    expect(within(detail()).getByText("No Message Selected")).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "FIND");
    expect(processes()).toEqual(["Finder"]);
    expect(title()).toHaveTextContent("Console (1 message)");

    await user.clear(field);
    expect(processes()).toHaveLength(5);
    expect(within(detail()).getByRole("textbox", { name: "Message" })).toHaveValue("Pointer moved");
  });

  it("narrows the list to errors and faults with the scope bar", async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByRole("radio", { name: "All Messages" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Errors and Faults" }));
    expect(processes()).toEqual(["airportd", "Finder"]);
    expect(title()).toHaveTextContent("Console (2 messages)");
    await user.click(screen.getByRole("radio", { name: "All Messages" }));
    expect(processes()).toHaveLength(5);
  });

  it("narrows the list to messages of an activity while Activities is on", async () => {
    const user = userEvent.setup();
    open();
    await user.click(button("Activities"));
    expect(button("Activities")).toHaveAttribute("aria-pressed", "true");
    expect(processes()).toEqual(["mds"]);
    await user.click(button("Activities"));
    expect(processes()).toHaveLength(5);
  });
});

describe("the toolbar", () => {
  it("empties the source's list with Clear and brings it back with Reload", async () => {
    const user = userEvent.setup();
    open({ defaultSelectedId: 3 });
    await user.click(button("Clear"));
    expect(dataRows()).toHaveLength(0);
    expect(title()).toHaveTextContent("Console (0 messages)");
    expect(within(detail()).getByText("No Message Selected")).toBeInTheDocument();
    // Another source is not cleared with it.
    await user.click(source("Crash Reports"));
    expect(processes()).toEqual(["Notes", "Preview"]);

    await user.click(source("ismh15"));
    expect(dataRows()).toHaveLength(0);
    await user.click(button("Reload"));
    expect(processes()).toHaveLength(5);
    expect(within(detail()).getByRole("textbox", { name: "Message" })).toHaveValue("Pointer moved");
  });

  it("selects the newest message with Now, and lets go when a row is chosen by hand", async () => {
    const user = userEvent.setup();
    open({ defaultFollowing: false });
    expect(button("Now")).toHaveAttribute("aria-pressed", "false");
    await user.click(button("Now"));
    expect(button("Now")).toHaveAttribute("aria-pressed", "true");
    expect(rowOf("bluetoothd")).toHaveAttribute("aria-selected", "true");
    expect(within(detail()).getByRole("textbox", { name: "Message" })).toHaveValue(
      "Indexing peers",
    );

    fireEvent.mouseDown(rowOf("mds"));
    expect(button("Now")).toHaveAttribute("aria-pressed", "false");
    // Sorted the other way round the newest message is the first row, and still the one chosen.
    await user.click(button("Time"));
    await user.click(button("Time"));
    await user.click(button("Now"));
    expect(rowOf("bluetoothd")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the newest message in view when the table is resized while Now is on", () => {
    // jsdom has no layout and no ResizeObserver: both are stood in for here.
    const observed: [Element, (entries: { target: Element }[]) => void][] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private notify: (entries: { target: Element }[]) => void) {}
        observe(element: Element) {
          observed.push([element, this.notify]);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      open();
      const viewport = grid().querySelector('[role="rowgroup"]') as HTMLElement;
      const resize = (height: number) => {
        Object.defineProperty(viewport, "clientHeight", { configurable: true, value: height });
        act(() => {
          for (const [element, notify] of observed)
            if (element === viewport) notify([{ target: viewport }]);
        });
      };
      // The newest of the five messages is the fifth 21 pt row: its bottom edge is 105 pt
      // down, under a 24 pt header. A table 60 pt high shows it when scrolled by 69 pt.
      viewport.scrollTop = 0;
      resize(60);
      expect(viewport.scrollTop).toBe(69);
      // Made smaller still, it follows again; made larger, it has no need to move.
      resize(45);
      expect(viewport.scrollTop).toBe(84);
      resize(300);
      expect(viewport.scrollTop).toBe(84);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("lets go of the newest message when it is scrolled out of view without a wheel", () => {
    open();
    const viewport = grid().querySelector('[role="rowgroup"]') as HTMLElement;
    // jsdom has no layout: the table is stood in for as 60 pt high. The newest of the five
    // messages is in view whole when the table is scrolled by 69 to 84 pt.
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 60 });
    expect(button("Now")).toHaveAttribute("aria-pressed", "true");
    // A scroll, by the scroll bar or a touch, that keeps it in view keeps Now on.
    viewport.scrollTop = 75;
    fireEvent.scroll(viewport);
    expect(button("Now")).toHaveAttribute("aria-pressed", "true");
    // One that takes it out of view lets go, and the table stays where it was put.
    viewport.scrollTop = 20;
    fireEvent.scroll(viewport);
    expect(button("Now")).toHaveAttribute("aria-pressed", "false");
    expect(viewport.scrollTop).toBe(20);
  });

  it("hides and shows the detail pane with Info", async () => {
    const user = userEvent.setup();
    open();
    expect(button("Info")).toHaveAttribute("aria-pressed", "true");
    await user.click(button("Info"));
    expect(button("Info")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("region", { name: "Message details" })).toBeNull();
    await user.click(button("Info"));
    expect(detail()).toBeInTheDocument();
  });

  it("hands the selected message to the service chosen from Share", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    open({ onShare });
    expect(unavailable("Share")).toBe(true);
    fireEvent.mouseDown(rowOf("Finder"));
    expect(unavailable("Share")).toBe(false);
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Messages" }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(MESSAGES[3], "Messages");
  });
});

describe("the stream", () => {
  it("adds a message to the device every two seconds, and none to a cleared report", () => {
    vi.useFakeTimers();
    const { unmount } = open({ streamInterval: undefined });
    act(() => vi.advanceTimersByTime(1999));
    expect(dataRows()).toHaveLength(5);
    act(() => vi.advanceTimersByTime(1));
    expect(dataRows()).toHaveLength(6);
    expect(title()).toHaveTextContent("Console (6 messages)");
    // It is the newest: after the last message, on the same day.
    const time = within(dataRows()[5] as HTMLElement).getAllByRole("gridcell")[1]?.textContent;
    expect(time && time > "09:00:05.000000-0500").toBe(true);

    // After Clear the list holds only what arrives from then on.
    fireEvent.click(button("Clear"));
    expect(dataRows()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(4000));
    expect(dataRows()).toHaveLength(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not run when its interval is 0", () => {
    vi.useFakeTimers();
    open();
    act(() => vi.advanceTimersByTime(60_000));
    expect(dataRows()).toHaveLength(5);
  });

  it("is the same sequence on every run", () => {
    const start = createState(MESSAGES, REPORTS);
    const once = receive(receive(start));
    expect(receive(receive(start))).toEqual(once);
    expect(once.messages.device.map((entry) => entry.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
