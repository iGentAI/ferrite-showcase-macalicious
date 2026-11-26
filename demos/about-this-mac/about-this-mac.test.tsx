import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AboutThisMac } from "./about-this-mac";
import {
  type AboutThisMacTab,
  darkCaptureInfo,
  formatSize,
  uncategorizedSize,
} from "./about-this-mac-data";

const frame = () => screen.getByRole("region", { name: "About This Mac" });
const tab = (name: string) => screen.getByRole("tab", { name });
const selectedTab = () => screen.getByRole("tab", { selected: true }).textContent;
const pane = () => screen.getByRole("tabpanel");
const button = (name: string) => screen.getByRole("button", { name });
/** The details of the Overview pane, a line each. */
const details = () =>
  within(pane())
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("the window", () => {
  it("opens on the Overview of the light capture, at its size, with zoom disabled", () => {
    render(<AboutThisMac />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("586px");
    expect(frame().style.height).toBe("353px");
    expect(selectedTab()).toBe("Overview");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("macOS Catalina");
    expect(pane()).toHaveTextContent("Version 10.15 Beta (19A582a)");
    expect(details()).toEqual([
      "MacBook Pro (15-inch, 2019)",
      "Processor 2.3 GHz 8-Core Intel Core i9",
      "Memory 16 GB 2400 MHz DDR4",
      "Startup Disk Macintosh SSD",
      "Graphics Intel UHD Graphics 630 1536 MB",
      "Serial Number",
    ]);
    expect(button("Zoom")).toBeDisabled();
    expect(button("Minimize")).toBeEnabled();
  });

  it("hands the window's props to the frame and the controls' callbacks to the controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    render(
      <AboutThisMac state="inactive" data-host="desk" onClose={onClose} onMinimize={onMinimize} />,
    );
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-host", "desk");
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });

  it("reports a press and a double click on its title bar, but not on a tab or a control", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <AboutThisMac
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const bar = frame().querySelector("[data-window-drag-region]") as HTMLElement;

    fireEvent.pointerDown(bar, { button: 2 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(tab("Storage"), { button: 0 });
    fireEvent.pointerDown(button("Close"), { button: 0 });
    fireEvent.pointerDown(button("System Report…"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    await user.dblClick(tab("Overview"));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });
});

describe("the Overview pane", () => {
  it("tells its host which button or link was chosen", async () => {
    const user = userEvent.setup();
    const onSystemReport = vi.fn();
    const onSoftwareUpdate = vi.fn();
    const onLink = vi.fn();
    render(
      <AboutThisMac
        onSystemReport={onSystemReport}
        onSoftwareUpdate={onSoftwareUpdate}
        onLink={onLink}
      />,
    );
    await user.click(button("System Report…"));
    expect(onSystemReport).toHaveBeenCalledTimes(1);
    expect(onSoftwareUpdate).not.toHaveBeenCalled();
    await user.click(button("Software Update…"));
    expect(onSoftwareUpdate).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("link", { name: "License Agreement" }));
    expect(onLink).toHaveBeenLastCalledWith("license-agreement");
  });

  it("shows the facts it is given: a serial number, and no line for an empty fact", () => {
    render(<AboutThisMac info={{ ...darkCaptureInfo, graphics: "", version: "" }} />);
    expect(details()).toEqual([
      "MacBook Pro (15-inch, 2019)",
      "Processor 2.3 GHz 8-Core Intel Core i9",
      "Memory 16 GB 2400 MHz DDR4",
      "Startup Disk Macintosh SSD",
      "Serial Number C02YM33BLVCJ",
    ]);
    expect(pane()).not.toHaveTextContent("Version");
  });
});

describe("the tabs", () => {
  it("show the pane that is chosen, whose button reports to the host", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onDisplaysPreferences = vi.fn();
    const onManageStorage = vi.fn();
    const onLink = vi.fn();
    render(
      <AboutThisMac
        onTabChange={onTabChange}
        onDisplaysPreferences={onDisplaysPreferences}
        onManageStorage={onManageStorage}
        onLink={onLink}
      />,
    );

    await user.click(tab("Displays"));
    expect(onTabChange).toHaveBeenLastCalledWith("displays");
    expect(pane()).toHaveTextContent("Built-in Retina Display");
    expect(pane()).toHaveTextContent("15.4-inch (2880 × 1800)");
    await user.click(button("Displays Preferences…"));
    expect(onDisplaysPreferences).toHaveBeenCalledTimes(1);

    await user.click(tab("Storage"));
    expect(onTabChange).toHaveBeenLastCalledWith("storage");
    expect(screen.getByRole("heading", { name: "Macintosh SSD" })).toBeInTheDocument();
    expect(pane()).toHaveTextContent("195.81 GB available of 249.85 GB");
    // 249.85 GB less the 195.81 GB that are free.
    expect(screen.getByRole("meter", { name: "Macintosh SSD storage" })).toHaveAttribute(
      "aria-valuetext",
      "54.04 GB used of 249.85 GB",
    );
    const legend = within(screen.getByRole("list", { name: "Storage by category" }));
    expect(legend.getAllByRole("listitem")[0]).toHaveTextContent("Documents6.92 GB");
    // The seven categories take 35.92 GB of the 54.04 GB in use: the rest is listed too.
    expect(legend.getAllByRole("listitem")).toHaveLength(8);
    expect(legend.getAllByRole("listitem")[7]).toHaveTextContent("Uncategorized18.12 GB");
    await user.click(button("Manage…"));
    expect(onManageStorage).toHaveBeenCalledTimes(1);

    await user.click(tab("Support"));
    expect(screen.getByRole("heading", { name: "macOS Resources" })).toBeInTheDocument();
    await user.click(button("Specifications"));
    expect(onLink).toHaveBeenLastCalledWith("specifications");

    await user.click(tab("Service"));
    expect(onTabChange).toHaveBeenLastCalledWith("service");
    await user.click(button("Check my repair options…"));
    expect(onLink).toHaveBeenLastCalledWith("repair-options");
    expect(onTabChange).toHaveBeenCalledTimes(4);
  });

  it("shows the tab its host selects, and Overview for an id that names no tab", async () => {
    const user = userEvent.setup();
    function Host() {
      const [shown, setShown] = useState("storage");
      return (
        <>
          <button type="button" onClick={() => setShown("abacus")}>
            Show Abacus
          </button>
          <AboutThisMac tab={shown as AboutThisMacTab} />
        </>
      );
    }
    render(<Host />);
    expect(selectedTab()).toBe("Storage");
    // The host does not follow the choice, so the window stays where the host has it.
    await user.click(tab("Service"));
    expect(selectedTab()).toBe("Storage");

    await user.click(button("Show Abacus"));
    expect(selectedTab()).toBe("Overview");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("macOS Catalina");
  });

  it("opens on the tab asked for, and on Overview when that names none", () => {
    const { unmount } = render(<AboutThisMac defaultTab="support" />);
    expect(selectedTab()).toBe("Support");
    unmount();
    render(<AboutThisMac defaultTab={"sundial" as AboutThisMacTab} />);
    expect(selectedTab()).toBe("Overview");
  });

  it("are one tab stop: the arrow keys move the focus and select, round the ends", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<AboutThisMac onTabChange={onTabChange} />);
    const stops = () =>
      screen
        .getAllByRole("tab")
        .filter((item) => item.tabIndex === 0)
        .map((item) => item.textContent);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();
    expect(stops()).toEqual(["Overview"]);
    // The pane is named by its tab.
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toBeInTheDocument();

    // A click on the selected tab gives it the focus and changes nothing.
    await user.click(tab("Overview"));
    expect(tab("Overview")).toHaveFocus();
    expect(onTabChange).not.toHaveBeenCalled();

    await user.keyboard("{ArrowRight}");
    expect(tab("Displays")).toHaveFocus();
    expect(selectedTab()).toBe("Displays");
    expect(onTabChange).toHaveBeenLastCalledWith("displays");
    expect(stops()).toEqual(["Displays"]);
    expect(screen.getByRole("tabpanel", { name: "Displays" })).toHaveTextContent(
      "Built-in Retina Display",
    );

    // Left from the first tab is the last one, and right from the last is the first.
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(tab("Service")).toHaveFocus();
    expect(selectedTab()).toBe("Service");
    expect(screen.getByRole("tabpanel", { name: "Service" })).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(tab("Overview")).toHaveFocus();
    expect(selectedTab()).toBe("Overview");
    expect(onTabChange.mock.calls.map((call) => call[0])).toEqual([
      "displays",
      "overview",
      "service",
      "overview",
    ]);

    // The next Tab leaves the control: no other tab takes the focus.
    await user.tab();
    expect(screen.getAllByRole("tab")).not.toContain(document.activeElement);
  });
});

describe("odd data", () => {
  it("writes a disk without a capacity, and no displays, in words", async () => {
    const user = userEvent.setup();
    render(
      <AboutThisMac
        defaultTab="storage"
        displays={[]}
        volume={{
          name: "Empty",
          kind: "",
          capacity: Number.NaN,
          available: -5,
          categories: [{ id: "x", name: "Mystery", size: Number.NaN }],
        }}
      />,
    );
    expect(pane()).toHaveTextContent("Zero KB available of Zero KB");
    expect(screen.getByRole("meter", { name: "Empty storage" })).toHaveAttribute(
      "aria-valuetext",
      "Zero KB used of Zero KB",
    );
    expect(pane()).toHaveTextContent("MysteryZero KB");
    // Nothing is in use, so nothing is left over to list.
    expect(pane()).not.toHaveTextContent("Uncategorized");
    expect(pane().textContent).not.toMatch(/NaN|undefined/);

    await user.click(tab("Displays"));
    expect(pane()).toHaveTextContent("No displays are connected.");
  });

  it("lists what is in use beyond the categories, and nothing when they cover or exceed it", () => {
    const volume = { name: "Disk", kind: "", capacity: 100e9, available: 40e9 };
    const sized = (...sizes: number[]) => ({
      ...volume,
      categories: sizes.map((size, at) => ({ id: `c${at}`, name: `C${at}`, size })),
    });
    expect(uncategorizedSize(sized())).toBe(60e9);
    expect(uncategorizedSize(sized(20e9, 15e9))).toBe(25e9);
    expect(uncategorizedSize(sized(20e9, 40e9))).toBe(0);
    expect(uncategorizedSize(sized(90e9))).toBe(0);
    // A size that cannot be counted accounts for nothing.
    expect(uncategorizedSize(sized(Number.NaN, -3, Number.POSITIVE_INFINITY))).toBe(60e9);

    render(<AboutThisMac defaultTab="storage" volume={sized()} />);
    expect(screen.getByRole("list", { name: "Storage by category" })).toHaveTextContent(
      "Uncategorized60 GB",
    );
  });

  it("writes sizes in decimal units, without trailing zeros", () => {
    expect(formatSize(249.85e9)).toBe("249.85 GB");
    expect(formatSize(6e9)).toBe("6 GB");
    expect(formatSize(3.6e6)).toBe("3.6 MB");
    expect(formatSize(212_000)).toBe("212 KB");
    expect(formatSize(640)).toBe("640 bytes");
    // A value that would round to a thousand megabytes is a gigabyte.
    expect(formatSize(999_960_000)).toBe("1 GB");
    expect(formatSize(0)).toBe("Zero KB");
    expect(formatSize(-1)).toBe("Zero KB");
    expect(formatSize(Number.POSITIVE_INFINITY)).toBe("Zero KB");
  });
});
