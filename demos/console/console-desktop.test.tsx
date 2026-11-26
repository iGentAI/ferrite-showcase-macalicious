import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOpenFile } from "../finder/finder-open";
import { Console, type ConsoleFeed, type ConsoleLayout } from "./console";
import type { ConsoleMessage } from "./console-data";
import {
  CONSOLE_LOG_URL,
  consoleFeed,
  DesktopConsole,
  type LogEntry,
  messagesFromServer,
  toMessage,
} from "./console-desktop";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const entry = (id: number, more: Partial<LogEntry> = {}): LogEntry => ({
  id,
  at_ms: Date.UTC(2026, 9, 12, 13, 7, 45, 459),
  level: "info",
  process: "calculator",
  category: "request",
  message: `entry ${id}`,
  ...more,
});

const grid = () => screen.getByRole("grid", { name: "Messages" });

describe("Console on the desktop's Ferrite application", () => {
  it("writes a log entry as a Console row, with no process id the log does not record", () => {
    const row = toMessage(entry(8, { level: "fault" }));
    expect(row).toMatchObject({
      id: 8,
      type: "fault",
      process: "calculator",
      pid: 0,
      thread: 0,
      subsystem: "macalicious-desktop",
      category: "request",
      message: "entry 8",
    });
    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.time).toMatch(/^\d{2}:\d{2}:\d{2}\.459000[+-]\d{4}$/);
    // A level the window has no type for is shown as a default message, not dropped.
    expect(toMessage(entry(9, { level: "notice" })).type).toBe("default");
  });

  it("reads only replies in the module's shape and drops malformed entries", () => {
    expect(messagesFromServer({ rev: 1 })).toBeUndefined();
    expect(messagesFromServer(null)).toBeUndefined();
    const rows = messagesFromServer({ entries: [entry(1), { id: "x" }, entry(2)] });
    expect(rows?.map((row) => row.id)).toEqual([1, 2]);
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopConsole streamInterval={0} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("ismh15")).toBeInTheDocument();
  });

  it("shows the application's own log as the device's messages", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        entries: [
          entry(1, { process: "macalicious-desktop", message: "started" }),
          entry(2, { message: "POST /api/calculator/tape answered 201" }),
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetch);
    render(<DesktopConsole />);
    expect(fetch).toHaveBeenCalledWith(CONSOLE_LOG_URL, expect.anything());
    await waitFor(() =>
      expect(within(grid()).getByText("POST /api/calculator/tape answered 201")).toBeVisible(),
    );
    expect(within(grid()).getByText("started")).toBeInTheDocument();
    // The invented messages of the capture are not mixed in, and the device is the application.
    expect(within(grid()).queryByText(/airportd/)).toBeNull();
    expect(screen.queryByText("ismh15")).toBeNull();
    expect(screen.getAllByText("macalicious-desktop").length).toBeGreaterThan(0);
  });

  /*
   * A test double stands in for the server's log here: `answer` is what the next read returns.
   * The window reads it every 20 ms.
   */
  const fakeFeed = (first: readonly ConsoleMessage[]) => {
    let answer = first;
    const feed: ConsoleFeed = { interval: 20, read: async () => answer };
    return { feed, set: (next: readonly ConsoleMessage[]) => (answer = next) };
  };
  const shown = () =>
    within(grid())
      .queryAllByRole("row")
      .filter((row) => row.hasAttribute("aria-selected"))
      .map((row) => /entry \d+/.exec(row.textContent ?? "")?.[0]);

  it("adds an entry the log published late, under a lower id than one already shown", async () => {
    const { feed, set } = fakeFeed([toMessage(entry(8)), toMessage(entry(24))]);
    render(<Console feed={feed} />);
    await waitFor(() => expect(shown()).toEqual(["entry 8", "entry 24"]));
    set([toMessage(entry(8)), toMessage(entry(16)), toMessage(entry(24))]);
    await waitFor(() => expect(shown()).toEqual(["entry 8", "entry 16", "entry 24"]));
  });

  it("keeps the first of two files opened before the next render", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const changes: Partial<ConsoleLayout>[] = [];
    const layout = {
      values: {},
      change: (patch: Partial<ConsoleLayout>) => {
        changes.push(patch);
      },
    };
    render(<Console feed={fakeFeed([]).feed} layout={layout} />);
    act(() => {
      requestOpenFile({ app: "console", id: "a", name: "a.log" });
      requestOpenFile({ app: "console", id: "b", name: "b.log" });
    });
    expect(changes.at(-1)?.logFiles?.map((file) => file.id)).toEqual(["a", "b"]);
  });

  it("reports a log file chosen in the sidebar, and calls a failed read a failed read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("no server"))),
    );
    const onSourceChange = vi.fn();
    function Kept() {
      const [values, setValues] = useState<Partial<ConsoleLayout>>({
        logFiles: [{ id: "a", name: "a.log" }],
      });
      return (
        <Console
          feed={fakeFeed([]).feed}
          onSourceChange={onSourceChange}
          layout={{ values, change: (patch) => setValues((old) => ({ ...old, ...patch })) }}
        />
      );
    }
    const user = userEvent.setup();
    render(<Kept />);
    await user.click(screen.getByRole("treeitem", { name: "a.log" }));
    expect(onSourceChange).toHaveBeenCalledTimes(1);
    expect(onSourceChange.mock.calls[0]?.[0]).toContain("a");
    expect(await screen.findByText("The log file could not be read.")).toBeInTheDocument();
    expect(screen.queryByText("The log could not be saved.")).toBeNull();
  });

  it("keeps a cleared list cleared while the log answers the same entries, until Reload", async () => {
    const user = userEvent.setup();
    const { feed, set } = fakeFeed([toMessage(entry(8)), toMessage(entry(16))]);
    render(<Console feed={feed} />);
    await waitFor(() => expect(shown()).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(shown()).toEqual([]);
    // Several reads answer the same entries: none comes back.
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(shown()).toEqual([]);
    // A new entry does.
    set([toMessage(entry(8)), toMessage(entry(16)), toMessage(entry(32))]);
    await waitFor(() => expect(shown()).toEqual(["entry 32"]));
    await user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(shown()).toEqual(["entry 8", "entry 16", "entry 32"]));
  });

  it("lists this page's newest 200 errors, also while a read of the log has no answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    render(<Console feed={consoleFeed} defaultFollowing={false} />);
    const raise = (from: number, to: number) => {
      act(() => {
        for (let n = from; n < to; n += 1)
          window.dispatchEvent(new ErrorEvent("error", { message: `page error ${n}` }));
      });
    };
    raise(0, 105);
    raise(105, 205);
    expect(screen.getByText("Console (200 messages)")).toBeInTheDocument();
    const search = screen.getByRole("searchbox");
    await userEvent.type(search, "page error 0");
    await waitFor(() => expect(screen.getByText("Console (0 messages)")).toBeInTheDocument());
    await userEvent.clear(search);
    await userEvent.type(search, "page error 204");
    await waitFor(() => expect(screen.getByText("Console (1 message)")).toBeInTheDocument());
  });
});
