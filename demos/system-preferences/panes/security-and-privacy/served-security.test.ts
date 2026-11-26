import { afterEach, describe, expect, it, vi } from "vitest";
import { requestSystem } from "../../../desktop/desktop-system";
import { clearLogOut, followLogOut, LOG_OUT_MINUTES_KEY, LOG_OUT_ON_KEY } from "./served-security";

vi.mock("../../../desktop/desktop-system", () => ({ requestSystem: vi.fn() }));

afterEach(() => {
  clearLogOut();
  vi.useRealTimers();
  vi.mocked(requestSystem).mockClear();
});

const ON = { [LOG_OUT_ON_KEY]: true, [LOG_OUT_MINUTES_KEY]: 2 };

describe("Log out after", () => {
  it("logs out only after the minutes with no input", () => {
    vi.useFakeTimers();
    followLogOut(ON);
    vi.advanceTimersByTime(119_000);
    window.dispatchEvent(new KeyboardEvent("keydown"));
    vi.advanceTimersByTime(119_000);
    expect(requestSystem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(requestSystem).toHaveBeenCalledWith("shut-down-now");
  });

  it("keeps counting when other settings change", () => {
    vi.useFakeTimers();
    followLogOut(ON);
    vi.advanceTimersByTime(60_000);
    followLogOut({ ...ON, other: 1 });
    vi.advanceTimersByTime(60_000);
    expect(requestSystem).toHaveBeenCalledTimes(1);
  });

  it("does nothing when off, or once the session has ended", () => {
    vi.useFakeTimers();
    followLogOut({ [LOG_OUT_MINUTES_KEY]: 1 });
    vi.advanceTimersByTime(120_000);
    followLogOut(ON);
    clearLogOut();
    vi.advanceTimersByTime(240_000);
    expect(requestSystem).not.toHaveBeenCalled();
  });
});
