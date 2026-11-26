import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readString, useKeptText, useKeptValue } from "./desktop-kept-value";
import {
  beginDesktopValues,
  changeDesktopValue,
  desktopValues,
  forgetDesktopValues,
} from "./desktop-personal";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  forgetDesktopValues();
  beginDesktopValues();
});

describe("how a window was left", () => {
  const hook = (key = "fontBook.test") => renderHook(() => useKeptValue(key, readString, "first"));

  it("is kept when the desktop serves the window, and read back by the next one", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const one = hook();
    expect(one.result.current[0]).toBe("first");
    act(() => one.result.current[1]("second"));
    expect(one.result.current[0]).toBe("second");
    // At once: the settings' store takes it from here, and a page that leaves hands it on.
    expect(desktopValues()["fontBook.test"]).toBe("second");
    one.unmount();
    const two = hook();
    await waitFor(() => expect(two.result.current[0]).toBe("second"));
  });

  it("takes what arrives later, unless the person changed it first", () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const one = hook();
    act(() => changeDesktopValue("fontBook.test", "arrived"));
    expect(one.result.current[0]).toBe("arrived");
    act(() => one.result.current[1]("mine"));
    act(() => changeDesktopValue("fontBook.test", "later"));
    expect(one.result.current[0]).toBe("mine");
  });

  it("keeps a long text in pieces no larger than the server takes, and has it all back", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const long = "café 🍎 ".repeat(2000);
    const one = renderHook(() => useKeptText("fontBook.text", "first"));
    act(() => one.result.current[1](long));
    await waitFor(() => expect(desktopValues()["fontBook.text"]).toBeTruthy());
    for (const value of Object.values(desktopValues())) {
      expect(new TextEncoder().encode(JSON.stringify(value)).length).toBeLessThanOrEqual(4096);
    }
    one.unmount();
    const two = renderHook(() => useKeptText("fontBook.text", "first"));
    await waitFor(() => expect(two.result.current[0]).toBe(long));

    // Short again: the pieces go too.
    act(() => two.result.current[1]("short"));
    await waitFor(() => expect(desktopValues()["fontBook.text"]).toBe("short"));
    expect(desktopValues()["fontBook.text.0.0"]).toBeNull();
  });

  it("keeps the last whole text when a save stops part-way", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const whole = "a".repeat(9000);
    const one = renderHook(() => useKeptText("fontBook.whole", "first"));
    act(() => one.result.current[1](whole));
    await waitFor(() => expect(desktopValues()["fontBook.whole"]).toBeTruthy());
    one.unmount();
    // The next save's first piece is written, of the same length, and nothing after it.
    act(() => changeDesktopValue("fontBook.whole.1.0", "b".repeat(3998)));
    const two = renderHook(() => useKeptText("fontBook.whole", "first"));
    await waitFor(() => expect(two.result.current[0]).toBe(whole));
  });

  it("says when a text is too long to keep, and keeps what it had", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const one = renderHook(() => useKeptText("fontBook.huge", "first"));
    act(() => one.result.current[1]("short"));
    await waitFor(() => expect(desktopValues()["fontBook.huge"]).toBe("short"));
    act(() => one.result.current[1]("x".repeat(100_000)));
    await waitFor(() => expect(one.result.current[2]).toBe(true));
    expect(desktopValues()["fontBook.huge"]).toBe("short");
    expect(one.result.current[0]).toHaveLength(100_000);
  });

  it("reads a save that stopped part-way as none", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    act(() => changeDesktopValue("fontBook.torn", { pieces: 2, length: 8, slot: 0 }));
    act(() => changeDesktopValue("fontBook.torn.0.0", "half"));
    const one = renderHook(() => useKeptText("fontBook.torn", "first"));
    expect(one.result.current[0]).toBe("first");
  });

  it("sends nothing larger than a value the server takes", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const one = hook("fontBook.large");
    act(() => one.result.current[1]("x".repeat(5000)));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(one.result.current[0]).toHaveLength(5000);
    expect(desktopValues()["fontBook.large"]).toBeUndefined();
  });

  it("stays in the window outside the desktop", async () => {
    const one = hook("fontBook.outside");
    act(() => one.result.current[1]("second"));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(one.result.current[0]).toBe("second");
    expect(desktopValues()["fontBook.outside"]).toBeUndefined();
  });
});
