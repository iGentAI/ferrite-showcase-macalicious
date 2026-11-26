import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "../desktop/desktop";
import { readKeptText } from "../desktop/desktop-kept-text";
import {
  beginDesktopValues,
  changeDesktopValue,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import {
  ASK_TO_KEEP_KEY,
  CLOSE_WINDOWS_KEY,
} from "../system-preferences/panes/general/document-settings";
import { terminalApp } from "./app";
import { readSession, SESSION_KEY } from "./terminal-window-state";

const windows = () => document.querySelectorAll(".mac-terminal");
const saved = () => readSession(readKeptText(SESSION_KEY));
beforeEach(() => {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  // The desktop also lists Automator services. This fixture has no saved workflows or drive.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/automator/workflows")) return Response.json({ library: null, rev: 0 });
      if (url.includes("/api/files"))
        return Response.json({
          entries: [],
          rev: 0,
          usage: 0,
          quota: 67108864,
          max_entries: 1000,
          max_file_bytes: 16777216,
          piece_bytes: 196608,
        });
      throw new Error(`Unexpected test request: ${url}`);
    }),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  forgetDesktopValues();
  beginDesktopValues();
  changeDesktopValue(CLOSE_WINDOWS_KEY, false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function openTwo() {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<CatalinaDesktop apps={[terminalApp]} defaultOpen={["terminal"]} />);
  await waitFor(() =>
    expect(screen.getAllByRole("log", { name: "Terminal output" })[0]?.textContent).toContain(
      "shackett@ismhpro ~ %",
    ),
  );
  await user.click(screen.getByRole("menuitem", { name: "Shell" }));
  await user.click(screen.getByRole("menuitem", { name: /^New Window/ }));
  await waitFor(() => expect(windows()).toHaveLength(2));
  fireEvent(window, new Event("pagehide"));
  expect(saved()?.windows).toHaveLength(2);
  return user;
}

async function quit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("menuitem", { name: "Terminal" }));
  await user.click(screen.getByRole("menuitem", { name: "Quit Terminal" }));
}

it.each([false, true])(
  "Quit keeps both Terminal windows through desktop close dispatch (ask=%s)",
  async (ask) => {
    changeDesktopValue(ASK_TO_KEEP_KEY, ask);
    const user = await openTwo();
    await quit(user);
    await waitFor(() => expect(windows()).toHaveLength(0));
    await act(async () => {
      await Promise.resolve();
    });
    expect(saved()?.quit).toBe(true);
    expect(saved()?.windows).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Terminal" }));
    await waitFor(() => expect(windows()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getAllByRole("log", { name: "Terminal output" })[0]?.textContent).toContain(
        "Restored session:",
      ),
    );
    act(() => changeDesktopValue(CLOSE_WINDOWS_KEY, true));
    await quit(user);
    await waitFor(() => expect(windows()).toHaveLength(0));
    expect(saved()).toBeNull();
  },
);

it("normal Close removes only that window before a later Quit snapshot", async () => {
  const user = await openTwo();
  const last = windows()[1] as HTMLElement;
  await user.click(within(last).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(windows()).toHaveLength(1));
  fireEvent(window, new Event("pagehide"));
  expect(saved()?.windows).toHaveLength(1);
  expect(saved()?.quit).toBeUndefined();
  await quit(user);
  await waitFor(() => expect(windows()).toHaveLength(0));
  expect(saved()?.windows).toHaveLength(1);
  expect(saved()?.quit).toBe(true);
});

it("Cancel during Quit keeps every window and its running command", async () => {
  const user = await openTwo();
  const input = screen.getAllByRole("textbox", { name: "Terminal input" })[0] as HTMLElement;
  await user.click(input);
  await user.keyboard("sleep 100{Enter}");
  await waitFor(() =>
    expect(screen.getAllByRole("log", { name: "Terminal output" })[0]?.textContent).toContain(
      "sleep 100",
    ),
  );
  await quit(user);
  await user.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(windows()).toHaveLength(2);
  fireEvent(window, new Event("pagehide"));
  expect(saved()?.windows).toHaveLength(2);
  expect(saved()?.quit).toBeUndefined();
  // Quit still asks: Cancel did not terminate the process or leave a consumed quit handler.
  await quit(user);
  expect(await screen.findByRole("button", { name: "Cancel" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Terminate" }));
  await waitFor(() => expect(windows()).toHaveLength(0));
  expect(saved()?.windows).toHaveLength(2);
  expect(saved()?.quit).toBe(true);
});
