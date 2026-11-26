import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentPosition, watchLocation } from "./maps-location";

const NOW = 1_800_000_000_000;

const position = (latitude: number, timestamp: number): GeolocationPosition =>
  ({
    coords: { latitude, longitude: -122, accuracy: 10 },
    timestamp,
  }) as GeolocationPosition;

describe("currentPosition while a watch is listening", () => {
  const getCurrentPosition = vi.fn();
  const watchPosition = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    getCurrentPosition.mockReset();
    watchPosition.mockReset();
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition, watchPosition, clearWatch: vi.fn() },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const hearWatch = (heard: GeolocationPosition) => {
    watchPosition.mockImplementationOnce((answer) => {
      answer(heard);
      return 1;
    });
    watchLocation(
      () => {},
      () => {},
    );
  };

  it("answers from a position the watch heard less than a minute ago", async () => {
    hearWatch(position(37, NOW - 59_000));
    await expect(currentPosition()).resolves.toEqual({
      at: { lat: 37, lon: -122, accuracy_m: 10 },
    });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("asks the browser again once the position itself is a minute old, however recently it arrived", async () => {
    hearWatch(position(37, NOW - 59_000));
    vi.advanceTimersByTime(2_000);
    getCurrentPosition.mockImplementation((answer) => answer(position(38, NOW + 2_000)));
    await expect(currentPosition()).resolves.toEqual({
      at: { lat: 38, lon: -122, accuracy_m: 10 },
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("says the location is not available when the browser answers with no coordinates", async () => {
    const nowhere = position(Number.NaN, NOW);
    const heard: string[] = [];
    const located = vi.fn();
    watchPosition.mockImplementationOnce((answer) => {
      answer(nowhere);
      return 1;
    });
    watchLocation(located, (problem) => heard.push(problem));
    expect(located).not.toHaveBeenCalled();
    expect(heard).toEqual(["Your location is not available right now."]);

    getCurrentPosition.mockImplementation((answer) => answer(nowhere));
    await expect(currentPosition()).resolves.toEqual({
      problem: "Your location is not available right now.",
    });
  });
});
