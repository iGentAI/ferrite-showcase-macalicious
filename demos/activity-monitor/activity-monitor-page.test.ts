/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  busyPercent,
  bytesText,
  cpuReadings,
  diskReadings,
  energyReadings,
  memoryReadings,
  NOT_REPORTED,
  useMainThread,
} from "./activity-monitor-page";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const value = (lines: readonly { id: string; value: string }[], id: string) =>
  lines.find((line) => line.id === id)?.value;

describe("Activity Monitor's page figures", () => {
  it("measures the page without PerformanceObserver, with long tasks unreported", () => {
    vi.useFakeTimers();
    vi.stubGlobal("PerformanceObserver", undefined);
    const { result } = renderHook(() => useMainThread());
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    expect(result.current.busy).not.toBeNull();
    expect(result.current.longTasks).toBeNull();
    expect(value(cpuReadings(result.current, 8), "long")).toBe(NOT_REPORTED);
  });

  it("writes bytes as Finder does", () => {
    expect(bytesText(512)).toBe("512 bytes");
    expect(bytesText(1_500)).toBe("1.5 KB");
    expect(bytesText(250_000_000)).toBe("250 MB");
  });

  it("turns a timer's lateness into a share of the time, within 0 to 100", () => {
    expect(busyPercent(250, 1000)).toBe(25);
    expect(busyPercent(5000, 1000)).toBe(100);
    expect(busyPercent(10, 0)).toBe(0);
  });

  it("says when a browser reports nothing, and invents no figure", () => {
    const thread = { busy: null, frames: null, longTasks: null };
    expect(value(cpuReadings(thread, undefined), "cores")).toBe(NOT_REPORTED);
    expect(value(cpuReadings(thread, undefined), "long")).toBe(NOT_REPORTED);
    expect(value(memoryReadings(undefined, undefined), "used")).toBe(NOT_REPORTED);
    expect(value(energyReadings(undefined), "battery")).toBe(NOT_REPORTED);
    expect(value(diskReadings(undefined, undefined), "browser")).toBe(NOT_REPORTED);
  });

  it("shows what the battery and the server report", () => {
    const battery = { level: 0.42, charging: false, chargingTime: Infinity, dischargingTime: 3600 };
    expect(value(energyReadings(battery), "level")).toBe("42%");
    expect(value(energyReadings(battery), "source")).toBe("Battery");
    expect(value(energyReadings(battery), "time")).toBe("60 min");
    const lines = diskReadings(
      {
        apps: [
          { name: "notes", title: "Notes", bytes: 2_000, keys: 1, truncated: true, documents: [] },
        ],
        bytes: 2_000,
        keys: 1,
        truncated: true,
      },
      { usage: 1_000, quota: 1_000_000 },
    );
    expect(value(lines, "app-notes")).toBe("at least 2.0 KB");
    expect(value(lines, "browser")).toBe("1.0 KB of 1.0 MB");
  });
});
