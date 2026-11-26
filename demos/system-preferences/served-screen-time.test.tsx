import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServedScreenTime } from "./panes/screen-time/served-screen-time";

vi.mock("../desktop/desktop-screen-time", async (original) => ({
  ...(await original<typeof import("../desktop/desktop-screen-time")>()),
  useScreenTimeUsage: () => ({
    "2026-11-03": { alpha: 120 },
    "2026-11-04": { beta: 180 },
  }),
}));
vi.mock("../desktop/desktop-apps", () => ({ discoveredApps: [] }));

const factOf = (label: string) => screen.getByText(`${label}:`).nextElementSibling?.textContent;

describe("Screen Time on the served desktop, when the day changes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 10, 3, 23, 59, 30));
  });
  afterEach(() => vi.useRealTimers());

  it("shows the new day as today, and what it has counted", () => {
    render(<ServedScreenTime />);
    expect(factOf("Today")).toBe("2 min");
    expect(factOf("alpha")).toBe("2 min");
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(factOf("Today")).toBe("3 min");
    expect(factOf("beta")).toBe("3 min");
    expect(screen.queryByText("alpha:")).toBeNull();
  });

  it("keeps the day that was chosen, under its own name", () => {
    vi.setSystemTime(new Date(2026, 10, 4, 23, 59, 30));
    render(<ServedScreenTime />);
    fireEvent.click(screen.getByRole("button", { name: "Earlier day" }));
    expect(factOf("Tuesday")).toBe("2 min");
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(factOf("Tuesday")).toBe("2 min");
    expect(screen.getByRole("button", { name: "Tue: 2 min" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
