import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { app, networkUtilityApp } from "./app";
import { NetworkUtility } from "./network-utility";
import { addressOf, defaultInterfaces, formatCount, runTool, TABS } from "./network-utility-data";
import { DesktopNetworkUtility } from "./network-utility-desktop";

const frame = () => screen.getByRole("region", { name: "Network Utility" });
const tab = (name: string) => screen.getByRole("tab", { name });
const selectedTab = () =>
  screen.getAllByRole("tab").find((item) => item.getAttribute("aria-selected") === "true")
    ?.textContent;
/** The value beside a key of the Info pane. */
const valueBeside = (key: string) => {
  const term = screen.getByText(key);
  expect(term).toHaveAttribute("role", "term");
  return term.nextElementSibling?.textContent;
};
const output = (tool: string) =>
  screen.getByRole<HTMLTextAreaElement>("textbox", { name: `${tool} output` });

describe("the window", () => {
  it("opens on the Info pane with the captured interface, at the captured size", () => {
    render(<NetworkUtility />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().style.width).toBe("644px");
    expect(frame().style.height).toBe("385px");
    expect(screen.getAllByRole("tab").map((item) => item.textContent)).toEqual([
      "Info",
      "Netstat",
      "Ping",
      "Lookup",
      "Traceroute",
      "Whois",
      "Finger",
      "Port Scan",
    ]);
    expect(selectedTab()).toBe("Info");
    expect(screen.getByText("Select a network interface for information.")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Network interface" })).toHaveTextContent(
      "Wi-Fi (en0)",
    );
    expect(screen.getByRole("group", { name: "Interface Information" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Transfer Statistics" })).toBeVisible();
    expect(valueBeside("Hardware Address:")).toBe("38:f9:d3:a6:8a:06");
    expect(valueBeside("IP Address:")).toBe("192.168.7.167");
    expect(valueBeside("Link Speed:")).toBe("304.2 Mbit/s");
    expect(valueBeside("Link Status:")).toBe("Active");
    expect(valueBeside("Vendor:")).toBe("Apple");
    expect(valueBeside("Model:")).toBe("Wireless Network Adapter (802.11 a/b/g/n/ac)");
    expect(valueBeside("Sent Packets:")).toBe("376,836");
    expect(valueBeside("Send Errors:")).toBe("0");
    expect(valueBeside("Recv Packets:")).toBe("45,010");
    expect(valueBeside("Recv Errors:")).toBe("0");
    expect(valueBeside("Collisions:")).toBe("0");
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <NetworkUtility
        ref={ref}
        state="inactive"
        className="mine"
        data-kind="app"
        style={{ left: 12 }}
        zoomDisabled
        onClose={onClose}
        onMinimize={onMinimize}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.left).toBe("12px");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    await user.dblClick(screen.getByText("Network Utility"));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("exports a descriptor a desktop can host, with a window that keeps its size", () => {
    expect(app).toBe(networkUtilityApp);
    expect(app.id).toBe("network-utility");
    expect(app.name).toBe("Network Utility");
    expect(app.component).toBe(DesktopNetworkUtility);
    expect(app.defaultSize).toEqual({ width: 644, height: 385 });
    expect(app.resizable).toBe(false);
    expect(app.menus[0]).toBe("Network Utility");
  });
});

describe("the Info pane", () => {
  it("shows the interface chosen in the pop-up button", async () => {
    const user = userEvent.setup();
    render(<NetworkUtility />);
    await user.click(screen.getByRole("combobox", { name: "Network interface" }));
    await user.click(await screen.findByRole("option", { name: "Thunderbolt Ethernet (en1)" }));
    expect(valueBeside("IP Address:")).toBe("192.0.2.24");
    expect(valueBeside("Link Speed:")).toBe("1 Gbit/s");
    expect(valueBeside("Model:")).toBe("Thunderbolt Ethernet Adapter");
    expect(valueBeside("Recv Packets:")).toBe("96,377");
    expect(valueBeside("Recv Errors:")).toBe("2");
  });

  it("opens on the interface it is given", () => {
    render(<NetworkUtility defaultInterface="bridge0" />);
    expect(screen.getByRole("combobox", { name: "Network interface" })).toHaveTextContent(
      "Thunderbolt Bridge (bridge0)",
    );
    expect(valueBeside("Link Status:")).toBe("Inactive");
  });

  it("lists the interfaces it is given", () => {
    const only = { ...defaultInterfaces[0], id: "en7", title: "USB LAN (en7)", vendor: "Acme" };
    render(<NetworkUtility interfaces={[only as (typeof defaultInterfaces)[number]]} />);
    expect(screen.getByRole("combobox", { name: "Network interface" })).toHaveTextContent(
      "USB LAN (en7)",
    );
    expect(valueBeside("Vendor:")).toBe("Acme");
  });
});

describe("the tabs", () => {
  it("switch the pane with a click and report the pane", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<NetworkUtility onTabChange={onTabChange} />);
    await user.click(tab("Ping"));
    expect(selectedTab()).toBe("Ping");
    expect(onTabChange).toHaveBeenLastCalledWith("ping");
    expect(screen.getByText("Enter the network address to ping.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Network address" })).toBeVisible();
    // The Info pane is hidden, not gone.
    expect(screen.queryByRole("combobox", { name: "Network interface" })).not.toBeInTheDocument();
    await user.click(tab("Port Scan"));
    expect(selectedTab()).toBe("Port Scan");
    expect(onTabChange).toHaveBeenLastCalledWith("port-scan");
    expect(screen.getByRole("button", { name: "Scan" })).toBeVisible();
    await user.click(tab("Info"));
    expect(screen.getByRole("combobox", { name: "Network interface" })).toBeVisible();
  });

  it("follow the arrow keys, as an AppKit tab view does", async () => {
    const user = userEvent.setup();
    render(<NetworkUtility />);
    await user.click(tab("Info"));
    await user.keyboard("{ArrowRight}");
    expect(selectedTab()).toBe("Netstat");
    expect(tab("Netstat")).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(selectedTab()).toBe("Port Scan");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "Enter an internet or IP address to scan for open ports.",
    );
  });

  it("show the pane a host chooses", () => {
    const { rerender } = render(<NetworkUtility tab="whois" />);
    expect(selectedTab()).toBe("Whois");
    rerender(<NetworkUtility tab="finger" />);
    expect(selectedTab()).toBe("Finger");
    expect(screen.getByRole("textbox", { name: "User name and domain address" })).toBeVisible();
  });
});

describe("the tools", () => {
  it("run for the address entered, by the button and by Return, and print the same again", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<NetworkUtility defaultTab="ping" onRun={onRun} />);
    const run = screen.getByRole("button", { name: "Ping" });
    expect(run).toBeDisabled();
    expect(output("Ping").value).toBe("");
    await user.type(screen.getByRole("textbox", { name: "Network address" }), "www.example.com");
    expect(run).toBeEnabled();
    await user.click(run);
    const printed = output("Ping").value;
    expect(printed).toContain(`PING www.example.com (${addressOf("www.example.com")})`);
    expect(printed).toContain("10 packets transmitted, 10 packets received");
    expect(onRun).toHaveBeenLastCalledWith("ping", "www.example.com", printed);

    await user.type(screen.getByRole("textbox", { name: "Network address" }), "{Enter}");
    expect(onRun).toHaveBeenCalledTimes(2);
    expect(output("Ping").value).toBe(printed);
  });

  it("keep what was entered and printed while another tab is shown", async () => {
    const user = userEvent.setup();
    render(<NetworkUtility defaultTab="lookup" />);
    await user.type(
      screen.getByRole("textbox", { name: "Internet address" }),
      "example.org{Enter}",
    );
    const printed = output("Lookup").value;
    expect(printed).toContain(";; ANSWER SECTION:");
    await user.click(tab("Info"));
    await user.click(tab("Lookup"));
    expect(screen.getByRole("textbox", { name: "Internet address" })).toHaveValue("example.org");
    expect(output("Lookup").value).toBe(printed);
  });

  it("Netstat prints what its radio buttons choose", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<NetworkUtility defaultTab="netstat" onRun={onRun} />);
    const choices = within(screen.getByRole("radiogroup")).getAllByRole("radio");
    expect(choices).toHaveLength(4);
    expect(choices[0]).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Netstat" }));
    expect(output("Netstat").value).toContain("Routing tables");
    await user.click(screen.getByRole("radio", { name: "Display multicast information" }));
    await user.click(screen.getByRole("button", { name: "Netstat" }));
    expect(output("Netstat").value).toContain("IPv4 Multicast Group Memberships");
    expect(onRun).toHaveBeenLastCalledWith("netstat", "multicast", output("Netstat").value);
  });

  it("every tool pane has a prompt, a button and an output view that cannot be edited", async () => {
    const user = userEvent.setup();
    render(<NetworkUtility />);
    for (const item of TABS.filter((candidate) => candidate.id !== "info")) {
      await user.click(tab(item.title));
      const pane = within(screen.getByRole("tabpanel"));
      expect(pane.getAllByRole("button")).toHaveLength(1);
      expect(output(item.title)).toHaveAttribute("readonly");
    }
  });
});

describe("the data", () => {
  it("gives a name an address of the documentation range and leaves an address as it is", () => {
    expect(addressOf("10.0.2.1")).toBe("10.0.2.1");
    expect(addressOf("www.example.com")).toMatch(/^203\.0\.113\.\d{1,3}$/);
    expect(addressOf("WWW.example.com")).toBe(addressOf("www.example.com"));
  });

  it("prints the same text for the same input and another for another", () => {
    for (const tool of ["ping", "lookup", "traceroute", "whois", "finger", "port-scan"] as const) {
      expect(runTool(tool, "example.com")).toBe(runTool(tool, " example.com "));
      expect(runTool(tool, "example.com")).not.toBe(runTool(tool, "example.net"));
    }
    expect(runTool("traceroute", "example.com")).toContain("traceroute to example.com");
    expect(runTool("finger", "ada@example.com")).toContain("[example.com]");
    expect(runTool("port-scan", "example.com")).toContain("Open TCP Port: \t80");
    expect(runTool("netstat", "", "sockets")).toContain("Active Internet connections");
  });

  it("writes counts with thousands separators", () => {
    expect(formatCount(376836)).toBe("376,836");
    expect(formatCount(0)).toBe("0");
    expect(formatCount(null)).toBe("Unknown");
  });
});

describe("a host's own runner", () => {
  it("shows what a pane prints before its tool runs, and what the runner returns", async () => {
    const user = userEvent.setup();
    const run = vi.fn(() => "from the host");
    render(<NetworkUtility defaultTab="whois" run={run} idleOutputs={{ whois: "waiting" }} />);
    expect(output("Whois").value).toBe("waiting");
    await user.type(screen.getByRole("textbox", { name: "Domain address" }), "example.com{Enter}");
    expect(run).toHaveBeenCalledWith("whois", "example.com", "", {
      signal: expect.any(AbortSignal),
      progress: expect.any(Function),
    });
    expect(output("Whois").value).toBe("from the host");
  });

  it("shows that a slow tool has started, offers Stop, and reports a failure", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    let fail: (error: Error) => void = () => {};
    const run = vi.fn(
      () =>
        new Promise<string>((_, reject) => {
          fail = reject;
        }),
    );
    render(<NetworkUtility defaultTab="ping" run={run} onRun={onRun} />);
    await user.type(screen.getByRole("textbox", { name: "Network address" }), "example.com{Enter}");
    expect(output("Ping").value).toBe("Ping has started…");
    expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Ping" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Network address" }), "{Enter}");
    expect(run).toHaveBeenCalledTimes(1);
    fail(new Error("no route"));
    await waitFor(() => expect(output("Ping").value).toBe("Ping failed: no route"));
    expect(screen.getByRole("button", { name: "Ping" })).toBeEnabled();
    expect(onRun).toHaveBeenCalledWith("ping", "example.com", "Ping failed: no route");
  });
});
