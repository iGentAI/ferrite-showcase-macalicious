import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scanWindows } from "../desktop/desktop-window-scan";
import {
  applicationRows,
  columnsInOrder,
  DesktopActivityMonitor,
  HEALTH_URL,
  instanceShown,
  movedColumn,
  msText,
  readOrders,
  roundTripStats,
} from "./activity-monitor-desktop";
import { FERRITE_URL, ferriteFromServer } from "./activity-monitor-figures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const figures = (name: string, title: string, requests: number, p50: number | null) => ({
  name,
  title,
  requests,
  per_second: requests / 300,
  errors: name === "notes" ? 1 : 0,
  store_ops: requests * 3,
  ops_per_request: requests > 0 ? 3 : null,
  mean_ms: p50,
  p50_ms: p50,
  p95_ms: p50 === null ? null : p50 * 4,
});

const FERRITE = {
  generation: 42,
  instance: "macalicious-desktop-7f3a9c1d2e",
  application: "macalicious-desktop",
  now_ms: 1,
  window_ms: 300_000,
  apps: [figures("calculator", "Calculator", 60, 0.42), figures("notes", "Notes", 30, 1.8)],
  total: figures("total", "All", 90, 0.6),
  minutes: [],
};

/* What a managed window gives the component; the window's own buttons are not under test. */
const windowProps = {
  onClose: () => {},
  onMinimize: () => {},
  onZoom: () => {},
  zoomRole: "full-screen" as const,
  minimizeDisabled: false,
  zoomDisabled: false,
  onDragRegionPointerDown: () => {},
  onDragRegionDoubleClick: () => {},
};

describe("Activity Monitor on the desktop's Ferrite application", () => {
  it("shows what tells one instance from another, as the name's first part never does", () => {
    expect(instanceShown("demo/macalicious-desktop@g13@dw-a-m1:1971:1793352210263426737")).toBe(
      "dw-a-m1:1971:1793352210263426737",
    );
    expect(instanceShown("macalicious-desktop-7f3a9c1d2e")).toBe("macalicious-desktop-7f3a9c1d2e");
    expect(instanceShown("—")).toBe("—");
  });
  it("keeps a stored column order, and only the columns that exist", () => {
    expect(readOrders({ applications: ["kind", "gone", "name"], nowhere: ["name"] })).toEqual({
      applications: ["kind", "name"],
    });
    expect(readOrders("windows")).toBeUndefined();
    const columns = [{ id: "name" }, { id: "windows" }, { id: "kind" }];
    expect(columnsInOrder(columns, ["kind", "name"]).map((column) => column.id)).toEqual([
      "kind",
      "name",
      "windows",
    ]);
  });

  it("puts a moved column before the one it was dropped on, or last", () => {
    expect(movedColumn(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(movedColumn(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"]);
    expect(movedColumn(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
  });
  it("reads the desktop's windows from the managed windows' hooks", () => {
    document.body.innerHTML = `
      <div data-window-id="calculator"><div role="region" aria-label="Calculator"></div></div>
      <div data-window-id="finder:2" data-minimized><div role="region" aria-label="Documents"></div></div>`;
    expect(scanWindows()).toEqual([
      { id: "calculator", app: "calculator", title: "Calculator", minimized: false },
      { id: "finder:2", app: "finder", title: "Documents", minimized: true },
    ]);
  });

  it("lists running applications with their windows, and only quits what the desktop runs", () => {
    const rows = applicationRows(
      [
        { id: "calculator", app: "calculator", title: "Calculator", minimized: false },
        { id: "finder", app: "finder", title: "Recents", minimized: false },
        { id: "finder:2", app: "finder", title: "Documents", minimized: true },
        { id: "activity-monitor", app: "activity-monitor", title: "x", minimized: false },
      ],
      [
        { id: "calculator", name: "Calculator" },
        { id: "finder", name: "Finder", relaunches: true },
      ],
    );
    expect(rows).toEqual([
      {
        id: "activity-monitor",
        name: "Activity Monitor",
        windows: 1,
        minimized: 0,
        quittable: false,
        relaunches: false,
      },
      {
        id: "calculator",
        name: "Calculator",
        windows: 1,
        minimized: 0,
        quittable: true,
        relaunches: false,
      },
      { id: "finder", name: "Finder", windows: 2, minimized: 1, quittable: true, relaunches: true },
    ]);
  });

  it("reads the Ferrite view, and writes times as Activity Monitor does", () => {
    const view = ferriteFromServer(FERRITE);
    expect(view?.generation).toBe(42);
    expect(view?.apps.map((app) => [app.name, app.p50Ms, app.p95Ms])).toEqual([
      ["calculator", 0.42, 1.68],
      ["notes", 1.8, 7.2],
    ]);
    expect(view?.total.requests).toBe(90);
    expect(ferriteFromServer({ apps: [] })).toBeUndefined();
    expect(ferriteFromServer({ ...FERRITE, apps: [{ name: "x" }] })?.apps).toEqual([]);
    expect([msText(0.4213), msText(18.4), msText(1_250), msText(null)]).toEqual([
      "0.42 ms",
      "18 ms",
      "1.3 s",
      "—",
    ]);
    expect(roundTripStats([30, 10, 20, 40])).toEqual({ last: 40, median: 25, min: 10, max: 40 });
    expect(roundTripStats([])).toBeNull();
  });

  it("quits the chosen application, shows Ferrite's figures and times the round trip", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => FERRITE,
      text: async () => (url === HEALTH_URL ? '{"status":"ok"}' : ""),
    }));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    // Stands in for the desktop: a quit application leaves what it lists as running. The real desktop's
    // quit is walked in activity-monitor-journey.mjs.
    function Desktop() {
      const [running, setRunning] = useState([{ id: "calculator", name: "Calculator" }]);
      return (
        <DesktopActivityMonitor
          {...windowProps}
          runningApplications={running}
          onQuitApplication={(id) => setRunning((all) => all.filter((app) => app.id !== id))}
        />
      );
    }
    render(<Desktop />);
    expect(fetch).toHaveBeenCalledWith(FERRITE_URL, expect.anything());
    const applications = screen.getByRole("grid", { name: "Applications" });
    expect(screen.getByRole("button", { name: "Quit Process" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(within(applications).getByText("Calculator"));
    await user.click(screen.getByRole("button", { name: "Quit Process" }));
    await user.click(await screen.findByRole("button", { name: "Quit" }));
    await waitFor(() => expect(within(applications).queryByText("Calculator")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Ferrite" }));
    const ferrite = screen.getByRole("grid", { name: "Ferrite" });
    await waitFor(() => expect(within(ferrite).getByText("Notes")).toBeInTheDocument());
    expect(within(ferrite).getByText("0.42 ms")).toBeInTheDocument();
    expect(within(ferrite).getByText("7.20 ms")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    // The whole instance name, which tells two instances of the application apart.
    expect(screen.getByText("macalicious-desktop-7f3a9c1d2e")).toBeInTheDocument();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(HEALTH_URL, expect.anything()));
    await user.click(screen.getByRole("button", { name: "Network" }));
    const network = screen.getByRole("grid", { name: "Network" });
    expect(within(network).getByText("Ferrite: the application (/health)")).toBeInTheDocument();
    expect(within(network).getAllByText(/^\d+(\.\d+)? ms$/).length).toBeGreaterThan(0);
    // No process figure is invented on the desktop: its CPU and Memory views are the page's own.
    expect(screen.queryByText(/% CPU|Real Mem/)).toBeNull();
  });

  it("opens a row's inspector on Return and a double click, with the figures of a hyphenated app", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    // The server names a module as the desktop names its app: `keychain-access`, both.
    const answer = {
      ...FERRITE,
      apps: [figures("keychain-access", "Keychain Access", 60, 0.42)],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => answer,
        text: async () => "",
      })),
    );
    // Stands in for the desktop's managed window: it draws the panel it is given.
    const Panels = ({ id, render: draw }: { id: string; render: (props: object) => ReactNode }) => (
      <div data-testid={id}>{draw(windowProps)}</div>
    );
    const user = userEvent.setup();
    render(
      <DesktopActivityMonitor
        {...windowProps}
        runningApplications={[
          { id: "keychain-access", name: "Keychain Access" },
          { id: "calculator", name: "Calculator" },
        ]}
        onQuitApplication={() => {}}
        DesktopWindow={Panels as never}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ferrite" }));
    await within(screen.getByRole("grid", { name: "Ferrite" })).findByText("Keychain Access");
    await user.click(screen.getByRole("button", { name: "Applications" }));
    const grid = screen.getByRole("grid", { name: "Applications" });
    await user.click(within(grid).getByText("Keychain Access"));
    await user.keyboard("{Enter}");
    const inspector = await screen.findByTestId("inspect-keychain-access");
    expect(
      within(inspector).getByText("Requests, 5 minutes:").nextElementSibling,
    ).toHaveTextContent("60");
    await user.dblClick(within(grid).getByText("Calculator"));
    expect(await screen.findByTestId("inspect-calculator")).toBeInTheDocument();
  });

  it("reads the figures one round at a time, even when a reply is slow", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    // A test double for a server that never answers: the next read must wait for this one.
    const fetch = vi.fn((_url: string, _init?: RequestInit) => new Promise<never>(() => {}));
    vi.stubGlobal("fetch", fetch);
    render(<DesktopActivityMonitor {...windowProps} />);
    await new Promise((resolve) => setTimeout(resolve, 2_300));
    expect(fetch.mock.calls.filter(([url]) => url === FERRITE_URL)).toHaveLength(1);
  });

  it("reads nothing while the page is hidden", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const fetch = vi.fn((_url: string, _init?: RequestInit) => new Promise<never>(() => {}));
    vi.stubGlobal("fetch", fetch);
    render(<DesktopActivityMonitor {...windowProps} />);
    await new Promise((resolve) => setTimeout(resolve, 2_300));
    expect(fetch).not.toHaveBeenCalled();
    hidden.mockRestore();
  });

  it("shows the invented processes when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopActivityMonitor {...windowProps} defaultUpdateInterval={0} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.getByRole("region", { name: "Activity Monitor (My Processes)" }),
    ).toBeInTheDocument();
  });
});
