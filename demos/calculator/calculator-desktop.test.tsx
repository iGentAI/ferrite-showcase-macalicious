import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "../desktop/desktop";
import {
  beginDesktopValues,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { calculatorApp } from "./app";

const calculator = () => screen.getByRole("region", { name: "Calculator" });
const windows = () => document.querySelectorAll(".mac-managed-window");

describe("Calculator's two windows on the real desktop", () => {
  beforeEach(async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ entries: [] })),
    );
    render(<CatalinaDesktop apps={[calculatorApp]} defaultOpen={["calculator"]} />);
    expect(windows()).toHaveLength(1);
    fireEvent.keyDown(calculator(), { key: "t", ctrlKey: true });
    await screen.findByRole("region", { name: "Paper Tape" });
    expect(windows()).toHaveLength(2);
  });

  afterEach(() => {
    forgetDesktopValues();
    beginDesktopValues();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("closes the tape with Calculator's window, which quits, and remembers it as open", async () => {
    act(() => within(calculator()).getByRole("button", { name: "Close" }).click());
    await waitFor(() => expect(windows()).toHaveLength(0));
    expect(desktopValues()["calculator.tapeOpen"]).toBe(true);
  });

  it("leaves the tape up when Calculator's window is only minimized", async () => {
    act(() => within(calculator()).getByRole("button", { name: "Minimize" }).click());
    await waitFor(() =>
      expect(
        document.querySelector('.mac-managed-window[data-window-id="calculator"]'),
      ).toHaveAttribute("data-minimized"),
    );
    expect(screen.getByRole("region", { name: "Paper Tape" })).toBeInTheDocument();
  });
});
