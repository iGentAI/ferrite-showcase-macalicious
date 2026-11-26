import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClearDeleted } from "./voice-memos-clear-deleted";
import type { VoiceMemoFile, VoiceMemosDeleted } from "./voice-memos-drive";

const DAY = 86_400_000;
const START = 1_800_000_000_000;

const store = (): VoiceMemosDeleted => ({
  list: async () => [],
  watch: () => () => {},
  recover: async () => {},
  erase: vi.fn(async () => {}),
});
const memo = (id: string, deleted: number) => ({ id, deleted }) as VoiceMemoFile;

describe("Clear Deleted", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears a recording at its time, with the list unchanged and the window left open", async () => {
    const place = store();
    const list = [memo("soon", START - 6 * DAY), memo("later", START)];
    renderHook(() => useClearDeleted(place, list, "week", true));
    expect(place.erase).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DAY);
    });
    expect(vi.mocked(place.erase).mock.calls).toEqual([["soon"]]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6 * DAY);
    });
    expect(vi.mocked(place.erase).mock.calls).toEqual([["soon"], ["later"]]);
  });

  it("waits past a browser timer's longest delay", async () => {
    const place = store();
    const list = [memo("month", START)];
    renderHook(() => useClearDeleted(place, list, "month", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29 * DAY);
    });
    expect(place.erase).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DAY);
    });
    expect(vi.mocked(place.erase).mock.calls).toEqual([["month"]]);
  });

  it("clears nothing with Never, or before the Preferences are read", async () => {
    const place = store();
    const list = [memo("old", START - 90 * DAY)];
    renderHook(() => useClearDeleted(place, list, "never", true));
    renderHook(() => useClearDeleted(place, list, "immediately", false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DAY);
    });
    expect(place.erase).not.toHaveBeenCalled();
  });
});
