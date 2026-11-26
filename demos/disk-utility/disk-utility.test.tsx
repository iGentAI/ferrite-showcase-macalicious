import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, diskUtilityApp } from "./app";
import { DiskUtility } from "./disk-utility";
import {
  abilities,
  addVolume,
  darkCaptureDisks,
  defaultDisks,
  deleteVolume,
  EMPTY_VOLUME_USED,
  eraseVolume,
  findTarget,
  firstAidSteps,
  formatSize,
  occupied,
  restoreSources,
  restoreVolume,
  setMounted,
  summarize,
} from "./disk-utility-data";

const frame = () => screen.getByRole("region", { name: "Disk Utility" });
const tree = () => screen.getByRole("tree", { name: "Devices" });
/** A row by its own label: an outline row's accessible name also holds its children's. */
const row = (name: string) => {
  const found = within(tree())
    .getAllByRole("treeitem")
    .find((item) => item.querySelector(".mac-sidebar-label")?.textContent === name);
  if (!found) throw new Error(`no row named ${name}`);
  return found;
};
const rowNames = () =>
  within(tree())
    .getAllByRole("treeitem")
    .map((item) => item.querySelector(".mac-sidebar-label")?.textContent);
const selected = () =>
  within(tree())
    .getAllByRole("treeitem")
    .filter((item) => item.getAttribute("aria-selected") === "true")
    .map((item) => item.querySelector(".mac-sidebar-label")?.textContent);
/** The detail pane, named by the selected row. */
const detail = (name: string) => within(screen.getByRole("region", { name }));
/** The value beside a label of the information table. */
const fact = (name: string, label: string) =>
  within(detail(name).getByRole("group", { name: "Information" })).getByText(label)
    .nextElementSibling?.textContent;
/** The value under a label of the legend. */
const legend = (name: string, label: string) =>
  detail(name).getByText(label, { selector: "dt" }).nextElementSibling?.textContent;
const tool = (name: string) => within(frame()).getByRole("button", { name });
/** A toolbar button that is disabled stays reachable, so it may be marked `aria-disabled`. */
const unavailable = (name: string) => {
  const button = tool(name);
  return button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled");
};
const sheetGone = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
/** Presses a button of the open sheet. */
const press = async (user: UserEvent, button: string) => {
  const sheet = await screen.findByRole("dialog");
  await user.click(within(sheet).getByRole("button", { name: button }));
};

afterEach(() => {
  vi.useRealTimers();
});

describe("the window", () => {
  it("opens at the captured size with Macintosh SSD selected", () => {
    render(<DiskUtility />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().style.width).toBe("926px");
    expect(frame().style.height).toBe("571px");
    expect(rowNames()).toEqual([
      "APPLE SSD AP0512M Media",
      "Container disk1",
      "Macintosh HD",
      "Macintosh HD - Data",
      "Samsung Portable SSD T3 Media",
      "Container disk3",
      "Macintosh SSD",
      "Macintosh SSD - Data",
      "Time Machine",
    ]);
    expect(selected()).toEqual(["Macintosh SSD"]);
    const pane = detail("Macintosh SSD");
    expect(pane.getByRole("heading", { name: "Macintosh SSD" })).toBeInTheDocument();
    expect(pane.getByText("APFS Volume • APFS")).toBeInTheDocument();
    expect(pane.getByText("macOS 10.15")).toBeInTheDocument();
    expect(pane.getByText("SHARED BY 6 VOLUMES")).toBeInTheDocument();
    expect(legend("Macintosh SSD", "Used")).toBe("16.36 GB");
    expect(legend("Macintosh SSD", "Other Volumes")).toBe("--");
    expect(legend("Macintosh SSD", "Free")).toBe("198.03 GB");
    expect(fact("Macintosh SSD", "Mount Point:")).toBe("/");
    expect(fact("Macintosh SSD", "Capacity:")).toBe("249.85 GB");
    expect(fact("Macintosh SSD", "Available:")).toBe("203.51 GB (5.48 GB purgeable)");
    expect(fact("Macintosh SSD", "Used:")).toBe("16.36 GB");
    expect(fact("Macintosh SSD", "Type:")).toBe("APFS Volume");
    expect(fact("Macintosh SSD", "Owners:")).toBe("Enabled");
    expect(fact("Macintosh SSD", "Connection:")).toBe("USB");
    expect(fact("Macintosh SSD", "Device:")).toBe("disk3s4");
    // 46 of the bar's 600 pt, as captured.
    expect(pane.getByRole("meter", { name: "Used space" })).toHaveAttribute("aria-valuenow", "77");
  });

  it("keeps a startup volume from being erased, restored, unmounted or deleted", () => {
    render(<DiskUtility />);
    for (const name of ["Erase", "Restore", "Unmount", "Delete Volume"]) {
      expect(unavailable(name)).toBe(true);
    }
    for (const name of ["First Aid", "Partition", "Info", "Add Volume"]) {
      expect(unavailable(name)).toBe(false);
    }
  });

  it("hands the window manager's props to the window, its controls and its title bar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onZoom = vi.fn();
    render(<DiskUtility state="inactive" width={800} onClose={onClose} onZoom={onZoom} />);
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame().style.width).toBe("800px");
    await user.click(tool("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(tool("Enter Full Screen"));
    expect(onZoom).toHaveBeenCalledTimes(1);
  });

  it("exports the descriptor a desktop reads and runs in a managed window", async () => {
    const user = userEvent.setup();
    expect(app).toBe(diskUtilityApp);
    expect(app.id).toBe("disk-utility");
    expect(app.name).toBe("Disk Utility");
    expect(app.defaultSize).toEqual({ width: 926, height: 571 });
    expect(app.menus[0]).toBe("Disk Utility");
    render(
      <WindowManager style={{ height: 700 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().parentElement).toHaveAttribute("data-window-id", "disk-utility");
    await user.click(row("Time Machine"));
    expect(selected()).toEqual(["Time Machine"]);
    await user.click(tool("Close"));
    expect(screen.queryByRole("region", { name: "Disk Utility" })).toBeNull();
  });
});

describe("the sidebar", () => {
  it("shows the volume that is clicked, and what the toolbar can do with it", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<DiskUtility onSelectionChange={onSelectionChange} />);
    await user.click(row("Time Machine"));
    expect(onSelectionChange).toHaveBeenLastCalledWith("time-machine");
    expect(selected()).toEqual(["Time Machine"]);
    expect(screen.queryByRole("region", { name: "Macintosh SSD" })).toBeNull();
    expect(detail("Time Machine").getByText("APFS Volume • APFS")).toBeInTheDocument();
    expect(detail("Time Machine").queryByText("macOS 10.15")).toBeNull();
    expect(legend("Time Machine", "Used")).toBe("9.87 GB");
    expect(fact("Time Machine", "Mount Point:")).toBe("/Volumes/Time Machine");
    expect(fact("Time Machine", "Available:")).toBe("198.03 GB");
    expect(fact("Time Machine", "Device:")).toBe("disk3s6");
    for (const name of ["Erase", "Restore", "Unmount", "Delete Volume"]) {
      expect(unavailable(name)).toBe(false);
    }
  });

  it("shows a container and a disk", async () => {
    const user = userEvent.setup();
    render(<DiskUtility />);
    await user.click(row("Container disk1"));
    expect(
      detail("Container disk1").getByText("APFS Container", { selector: "p" }),
    ).toBeInTheDocument();
    expect(detail("Container disk1").getByText("SHARED BY 5 VOLUMES")).toBeInTheDocument();
    expect(legend("Container disk1", "Used")).toBe("177.55 GB");
    expect(legend("Container disk1", "Free")).toBe("322.41 GB");
    expect(fact("Container disk1", "Physical stores:")).toBe("disk0s2");
    expect(unavailable("Delete Volume")).toBe(true);
    expect(unavailable("Add Volume")).toBe(false);
    expect(unavailable("Erase")).toBe(false);

    await user.click(row("APPLE SSD AP0512M Media"));
    const name = "APPLE SSD AP0512M Media";
    expect(
      detail(name).getByText("PCI-Express Internal Physical Disk • GUID Partition Map"),
    ).toBeInTheDocument();
    expect(detail(name).getByText("500.28 GB", { selector: "div" })).toBeInTheDocument();
    expect(fact(name, "S.M.A.R.T. status:")).toBe("Verified");
    expect(fact(name, "Device:")).toBe("disk0");
    expect(unavailable("Add Volume")).toBe(true);

    // The external disk holds the volume the machine started from.
    await user.click(row("Samsung Portable SSD T3 Media"));
    expect(unavailable("Erase")).toBe(true);
  });

  it("moves the selection with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<DiskUtility />);
    await user.click(row("Macintosh SSD"));
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["Macintosh SSD - Data"]);
    expect(fact("Macintosh SSD - Data", "Device:")).toBe("disk3s1");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(selected()).toEqual(["Container disk3"]);
    expect(
      detail("Container disk3").getByText("APFS Container", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("follows a controlled selection", async () => {
    const user = userEvent.setup();
    function Host() {
      const [selection, setSelection] = useState<string | null>("macintosh-hd");
      return (
        <>
          <DiskUtility selection={selection} onSelectionChange={setSelection} />
          <button type="button" onClick={() => setSelection(null)}>
            Deselect
          </button>
        </>
      );
    }
    render(<Host />);
    expect(selected()).toEqual(["Macintosh HD"]);
    await user.click(row("Time Machine"));
    expect(selected()).toEqual(["Time Machine"]);
    await user.click(screen.getByRole("button", { name: "Deselect" }));
    expect(selected()).toEqual([]);
    expect(screen.queryByRole("heading")).toBeNull();
    for (const name of ["First Aid", "Partition", "Info", "Add Volume"]) {
      expect(unavailable(name)).toBe(true);
    }
  });

  it("lists only the volumes when the View menu says so", async () => {
    const user = userEvent.setup();
    render(<DiskUtility />);
    await user.click(tool("View"));
    expect(await screen.findByRole("menuitemradio", { name: "Show All Devices" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("menuitemradio", { name: "Show Only Volumes" }));
    expect(rowNames()).toEqual([
      "Macintosh HD",
      "Macintosh HD - Data",
      "Macintosh SSD",
      "Macintosh SSD - Data",
      "Time Machine",
    ]);
    expect(selected()).toEqual(["Macintosh SSD"]);

    await user.click(tool("View"));
    await user.click(await screen.findByRole("menuitemradio", { name: "Show All Devices" }));
    expect(rowNames()).toHaveLength(9);
  });

  it("opens on the volumes alone when asked to", () => {
    render(<DiskUtility defaultShowAllDevices={false} defaultSelection="time-machine" />);
    expect(rowNames()).toHaveLength(5);
    expect(selected()).toEqual(["Time Machine"]);
  });

  it("hands a container's selection to its first volume when only volumes are listed", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<DiskUtility defaultSelection="disk1" onSelectionChange={onSelectionChange} />);
    await user.click(tool("View"));
    await user.click(await screen.findByRole("menuitemradio", { name: "Show Only Volumes" }));
    expect(selected()).toEqual(["Macintosh HD"]);
    expect(onSelectionChange).toHaveBeenLastCalledWith("macintosh-hd");
    expect(detail("Macintosh HD").getByText("APFS Volume • APFS")).toBeInTheDocument();
  });

  it("does the same for a container selected at first, or by the host, in that view", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    function Host() {
      const [selection, setSelection] = useState<string | null>("disk1");
      return (
        <>
          <DiskUtility
            defaultShowAllDevices={false}
            selection={selection}
            onSelectionChange={(id) => {
              onSelectionChange(id);
              setSelection(id);
            }}
          />
          <button type="button" onClick={() => setSelection("samsung-t3")}>
            Select the external disk
          </button>
        </>
      );
    }
    render(<Host />);
    expect(selected()).toEqual(["Macintosh HD"]);
    expect(onSelectionChange).toHaveBeenLastCalledWith("macintosh-hd");
    expect(screen.queryByRole("region", { name: "Container disk1" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Select the external disk" }));
    expect(selected()).toEqual(["Macintosh SSD"]);
    expect(onSelectionChange).toHaveBeenLastCalledWith("macintosh-ssd");
    expect(fact("Macintosh SSD", "Device:")).toBe("disk3s4");
  });

  it("tells a host that keeps its selection once for each unlisted row it selects", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    function Host() {
      const [selection, setSelection] = useState("apple-ssd");
      const [told, setTold] = useState(0);
      return (
        <>
          <DiskUtility
            defaultShowAllDevices={false}
            selection={selection}
            // A new callback at every render, which rerenders the host and keeps its selection.
            onSelectionChange={(id) => {
              onSelectionChange(id);
              setTold((count) => count + 1);
            }}
          />
          <button type="button" onClick={() => setSelection("disk1")}>
            Select the container
          </button>
          <output data-testid="told">{told}</output>
        </>
      );
    }
    render(<Host />);
    expect(selected()).toEqual(["Macintosh HD"]);
    expect(onSelectionChange.mock.calls).toEqual([["macintosh-hd"]]);

    // The container has the same first volume as its disk: the host is told again, once.
    await user.click(screen.getByRole("button", { name: "Select the container" }));
    expect(selected()).toEqual(["Macintosh HD"]);
    expect(onSelectionChange.mock.calls).toEqual([["macintosh-hd"], ["macintosh-hd"]]);
    expect(screen.getByTestId("told")).toHaveTextContent("2");
  });

  it("tells the host once when React replays its effects in Strict Mode", () => {
    const onSelectionChange = vi.fn();
    render(
      <StrictMode>
        <DiskUtility
          defaultShowAllDevices={false}
          selection="disk1"
          onSelectionChange={onSelectionChange}
        />
      </StrictMode>,
    );
    expect(selected()).toEqual(["Macintosh HD"]);
    expect(onSelectionChange.mock.calls).toEqual([["macintosh-hd"]]);
  });

  it("selects a listed volume after a deletion when only volumes are listed", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DiskUtility
        defaultShowAllDevices={false}
        defaultSelection="time-machine"
        onSelectionChange={onSelectionChange}
      />,
    );
    await user.click(tool("Delete Volume"));
    await press(user, "Delete");
    await sheetGone();
    expect(rowNames()).not.toContain("Time Machine");
    // Time Machine was the container's last volume: the one before it takes the selection.
    expect(selected()).toEqual(["Macintosh SSD - Data"]);
    expect(onSelectionChange).toHaveBeenLastCalledWith("macintosh-ssd-data");
  });
});

describe("the toolbar", () => {
  it("unmounts and mounts a volume", async () => {
    const user = userEvent.setup();
    render(<DiskUtility defaultSelection="time-machine" />);
    await user.click(tool("Unmount"));
    expect(fact("Time Machine", "Mount Point:")).toBe("Not Mounted");
    expect(within(frame()).queryByRole("button", { name: "Unmount" })).toBeNull();
    await user.click(tool("Mount"));
    expect(fact("Time Machine", "Mount Point:")).toBe("/Volumes/Time Machine");
    expect(tool("Unmount")).toBeInTheDocument();
  });

  it("runs First Aid in a sheet and reports line by line", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<DiskUtility firstAidStepDuration={100} />);
    await user.click(tool("First Aid"));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName("Would you like to run First Aid on “Macintosh SSD”?");
    // The window behind its sheet is main and held.
    const held = screen.getByRole("region", { name: "Disk Utility", hidden: true });
    expect(held).toHaveAttribute("data-window-state", "main");

    await user.click(within(sheet).getByRole("button", { name: "Run" }));
    const bar = within(sheet).getByRole("progressbar", { name: "First Aid progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(within(sheet).getByRole("button", { name: "Done" })).toBeDisabled();

    act(() => vi.advanceTimersByTime(100));
    const lines = () =>
      within(sheet)
        .getAllByRole("listitem")
        .map((item) => item.textContent);
    expect(lines()).toEqual(["Running First Aid on “Macintosh SSD”"]);
    for (let step = 1; step < 8; step++) act(() => vi.advanceTimersByTime(100));
    expect(lines()).toEqual(firstAidSteps(findTarget(defaultDisks, "macintosh-ssd") as never));
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(sheet).toHaveAccessibleName("First Aid process is complete.");

    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    await sheetGone();
    expect(frame()).toHaveAttribute("data-window-state", "key");
  });

  it("leaves everything alone when First Aid is cancelled", async () => {
    const user = userEvent.setup();
    render(<DiskUtility />);
    await user.click(tool("First Aid"));
    await press(user, "Cancel");
    await sheetGone();
    expect(selected()).toEqual(["Macintosh SSD"]);
  });

  it("adds a volume to the selected container and deletes it again", async () => {
    const user = userEvent.setup();
    render(<DiskUtility defaultSelection="disk1" />);
    await user.click(tool("Add Volume"));
    const sheet = await screen.findByRole("dialog");
    const name = within(sheet).getByRole("textbox", { name: "Name:" });
    expect(name).toHaveValue("Untitled");
    await user.clear(name);
    expect(within(sheet).getByRole("button", { name: "Add" })).toBeDisabled();
    await user.type(name, "Scratch");
    await user.click(within(sheet).getByRole("button", { name: "Add" }));
    await sheetGone();

    expect(rowNames()).toContain("Scratch");
    expect(selected()).toEqual(["Scratch"]);
    expect(detail("Scratch").getByText("SHARED BY 6 VOLUMES")).toBeInTheDocument();
    expect(legend("Scratch", "Used")).toBe("820 KB");
    expect(fact("Scratch", "Mount Point:")).toBe("/Volumes/Scratch");
    expect(fact("Scratch", "Device:")).toBe("disk1s6");

    await user.click(tool("Delete Volume"));
    await press(user, "Delete");
    await sheetGone();
    expect(rowNames()).not.toContain("Scratch");
    expect(selected()).toEqual(["Container disk1"]);
    expect(detail("Container disk1").getByText("SHARED BY 5 VOLUMES")).toBeInTheDocument();
    expect(legend("Container disk1", "Free")).toBe("322.41 GB");
  });

  it("offers to add a volume where Partition is chosen", async () => {
    const user = userEvent.setup();
    render(<DiskUtility defaultSelection="time-machine" />);
    await user.click(tool("Partition"));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName("Apple File System Space Sharing");
    await user.click(within(sheet).getByRole("button", { name: "Add Volume" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAccessibleName("Add APFS volume to container?"),
    );
    await press(user, "Add");
    await sheetGone();
    expect(selected()).toEqual(["Untitled"]);
    expect(fact("Untitled", "Device:")).toBe("disk3s7");
  });

  it("erases a volume under a new name and format", async () => {
    const user = userEvent.setup();
    render(<DiskUtility defaultSelection="time-machine" />);
    await user.click(tool("Erase"));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName("Erase “Time Machine”?");
    const name = within(sheet).getByRole("textbox", { name: "Name:" });
    expect(name).toHaveValue("Time Machine");
    await user.clear(name);
    await user.type(name, "Backups");
    await user.click(within(sheet).getByRole("combobox", { name: "Format:" }));
    await user.click(await screen.findByRole("option", { name: "APFS (Case-sensitive)" }));
    await user.click(within(sheet).getByRole("button", { name: "Erase" }));
    await sheetGone();

    expect(selected()).toEqual(["Backups"]);
    expect(detail("Backups").getByText("APFS Volume • APFS (Case-sensitive)")).toBeInTheDocument();
    expect(legend("Backups", "Used")).toBe("820 KB");
    expect(legend("Backups", "Free")).toBe("207.9 GB");
    expect(fact("Backups", "Mount Point:")).toBe("/Volumes/Backups");
  });

  it("restores another volume onto the selected one", async () => {
    const user = userEvent.setup();
    render(<DiskUtility defaultSelection="time-machine" />);
    await user.click(tool("Restore"));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName("Restore to “Time Machine”?");
    expect(within(sheet).getByRole("combobox", { name: "Restore from:" })).toHaveTextContent(
      "Macintosh HD",
    );
    await user.click(within(sheet).getByRole("combobox", { name: "Restore from:" }));
    await user.click(await screen.findByRole("option", { name: "Macintosh SSD - Data" }));
    await user.click(within(sheet).getByRole("button", { name: "Restore" }));
    await sheetGone();

    // The row keeps its place and its device and takes the source's name and contents.
    expect(rowNames().filter((name) => name === "Macintosh SSD - Data")).toHaveLength(2);
    expect(fact("Macintosh SSD - Data", "Device:")).toBe("disk3s6");
    expect(fact("Macintosh SSD - Data", "Used:")).toBe("21.52 GB");
  });

  it("lists a row's facts in the Info sheet", async () => {
    const user = userEvent.setup();
    render(<DiskUtility defaultSelection="disk3" />);
    await user.click(tool("Info"));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName("“Container disk3” Info");
    expect(within(sheet).getByText("Physical stores:").nextElementSibling).toHaveTextContent(
      "disk2s2",
    );
    expect(within(sheet).getByText("Volume count:").nextElementSibling).toHaveTextContent("6");
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    await sheetGone();
  });
});

describe("the disks", () => {
  const target = (id: string, disks = defaultDisks) => {
    const found = findTarget(disks, id);
    if (!found) throw new Error(`nothing is called ${id}`);
    return found;
  };

  it("writes sizes as Disk Utility does", () => {
    expect(formatSize(249.85)).toBe("249.85 GB");
    expect(formatSize(10.9)).toBe("10.9 GB");
    expect(formatSize(194.4)).toBe("194.4 GB");
    expect(formatSize(1200)).toBe("1.2 TB");
    expect(formatSize(0.5124)).toBe("512.4 MB");
    expect(formatSize(EMPTY_VOLUME_USED)).toBe("820 KB");
    expect(formatSize(0)).toBe("Zero KB");
  });

  it("summarizes the dark capture's volume", () => {
    const summary = summarize(target("macintosh-ssd", darkCaptureDisks));
    expect(summary.legend.map((entry) => entry.value)).toEqual(["10.9 GB", "--", "191.72 GB"]);
    expect(summary.leading[2]).toEqual({
      label: "Available:",
      value: "194.4 GB (2.68 GB purgeable)",
    });
    // 32 of the bar's 600 pt.
    expect(Math.round(summary.usedShare * 600)).toBe(32);
  });

  it("finds rows of all three kinds, and nothing for an unknown identifier", () => {
    expect(target("samsung-t3").kind).toBe("disk");
    expect(target("disk3").kind).toBe("container");
    expect(target("time-machine").kind).toBe("volume");
    expect(findTarget(defaultDisks, "nowhere")).toBeUndefined();
    expect(findTarget(defaultDisks, null)).toBeUndefined();
    expect(abilities(undefined).firstAid).toBe(false);
  });

  it("takes a new volume's space from its container and gives it back", () => {
    const added = addVolume(defaultDisks, "disk3", "  ");
    const made = target(added.id ?? "", added.disks);
    if (made.kind !== "volume") throw new Error("not a volume");
    expect(made.volume.name).toBe("Untitled");
    expect(made.volume.device).toBe("disk3s7");
    expect(made.container.free).toBeCloseTo(198.03 - EMPTY_VOLUME_USED, 6);
    const again = addVolume(added.disks, "disk3", "Second");
    expect(again.id).toBe("volume-disk3s8");
    const removed = deleteVolume(again.disks, added.id ?? "");
    const container = target("disk3", removed);
    if (container.kind !== "container") throw new Error("not a container");
    expect(container.container.volumes.map((volume) => volume.name)).toEqual([
      "Macintosh SSD",
      "Macintosh SSD - Data",
      "Time Machine",
      "Second",
    ]);
    expect(addVolume(defaultDisks, "nowhere", "Lost").id).toBeUndefined();
  });

  it("adds no volume to a container without room for one", () => {
    const full = defaultDisks.map((disk) => ({
      ...disk,
      containers: disk.containers.map((container) =>
        container.id === "disk3" ? { ...container, free: EMPTY_VOLUME_USED / 2 } : container,
      ),
    }));
    const refused = addVolume(full, "disk3", "No Room");
    expect(refused.id).toBeUndefined();
    expect(refused.disks).toEqual(full);
    expect(abilities(target("disk3", full)).addVolume).toBe(false);
    expect(abilities(target("time-machine", full)).addVolume).toBe(false);
    expect(abilities(target("disk1", full)).addVolume).toBe(true);

    render(<DiskUtility disks={full} defaultSelection="disk3" />);
    expect(unavailable("Add Volume")).toBe(true);
  });

  it("does not change a volume the machine started from", () => {
    const before = target("macintosh-ssd");
    for (const disks of [
      deleteVolume(defaultDisks, "macintosh-ssd"),
      eraseVolume(defaultDisks, "macintosh-ssd", "Gone"),
      restoreVolume(defaultDisks, "macintosh-ssd", "time-machine"),
      setMounted(defaultDisks, "macintosh-ssd", false),
    ]) {
      expect(target("macintosh-ssd", disks)).toEqual(before);
    }
  });

  it("refuses a restore that does not fit", () => {
    // Macintosh HD - Data holds 161.07 GB; the internal container has room for it, a container
    // with less free space than that does not.
    const tight = defaultDisks.map((disk) => ({
      ...disk,
      containers: disk.containers.map((container) =>
        container.id === "disk3" ? { ...container, free: 20 } : container,
      ),
    }));
    const kept = restoreVolume(tight, "time-machine", "macintosh-hd-data");
    expect(target("time-machine", kept)).toEqual(target("time-machine", tight));
    const copied = restoreVolume(defaultDisks, "time-machine", "macintosh-hd-data");
    const volume = target("time-machine", copied);
    if (volume.kind !== "volume") throw new Error("not a volume");
    expect(volume.volume.name).toBe("Macintosh HD - Data");
    expect(volume.container.free).toBeCloseTo(198.03 + 9.87 - 161.07, 6);
  });

  it("counts the space a volume holds beyond its files", () => {
    // Macintosh SSD holds 16.36 GB of files and 2.79 GB more.
    const copied = restoreVolume(defaultDisks, "time-machine", "macintosh-ssd");
    const volume = target("time-machine", copied);
    if (volume.kind !== "volume") throw new Error("not a volume");
    expect(occupied(volume.volume)).toBeCloseTo(19.15, 6);
    expect(volume.container.free).toBeCloseTo(198.03 + 9.87 - 19.15, 6);
    // Deleting the copy, or erasing it, gives all of it back.
    const container = (disks: typeof copied) => {
      const found = target("disk3", disks);
      if (found.kind !== "container") throw new Error("not a container");
      return found.container;
    };
    expect(container(deleteVolume(copied, "time-machine")).free).toBeCloseTo(198.03 + 9.87, 6);
    expect(container(eraseVolume(copied, "time-machine", "Empty")).free).toBeCloseTo(
      198.03 + 9.87 - EMPTY_VOLUME_USED,
      6,
    );
    // What fits is judged by the same measure: 19 GB of room does not take Macintosh SSD,
    // whose files are 16.36 GB but which holds 19.15 GB.
    const tight = defaultDisks.map((disk) => ({
      ...disk,
      containers: disk.containers.map((each) =>
        each.id === "disk1" ? { ...each, free: 19 - 10.86 } : each,
      ),
    }));
    const names = restoreSources(tight, target("macintosh-hd", tight)).map((each) => each.name);
    expect(names).toEqual(["Time Machine"]);
    expect(restoreSources(defaultDisks, target("disk3"))).toEqual([]);
  });
});
