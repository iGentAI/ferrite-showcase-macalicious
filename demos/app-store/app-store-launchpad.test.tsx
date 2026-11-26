import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLaunchpadRemoval } from "./app-store-launchpad";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** A test double for the desktop's Ferrite application: an empty catalogue and library. */
function serve() {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url === "/api/apps" ? { apps: [], catalogue: [] } : { installed: null, rev: 0 },
    })),
  );
}

describe("deleting apps from Launchpad", () => {
  it("edits when Option was held before Launchpad opened, and stops when it is let go", () => {
    serve();
    const { result, rerender } = renderHook(({ open }) => useLaunchpadRemoval(open), {
      initialProps: { open: false },
    });
    act(() => {
      fireEvent.keyDown(window, { key: "Alt", altKey: true });
    });
    // Closed, Launchpad shows nothing to edit.
    expect(result.current.editing).toBe(false);

    // It opens with Option still held: the removable apps show their badge at once.
    rerender({ open: true });
    expect(result.current.editing).toBe(true);

    act(() => {
      fireEvent.keyUp(window, { key: "Alt", altKey: false });
    });
    expect(result.current.editing).toBe(false);
  });

  it("takes Option from a pointer event, and forgets it when the browser window loses focus", () => {
    serve();
    const { result } = renderHook(() => useLaunchpadRemoval(true));
    act(() => {
      fireEvent.pointerMove(window, { altKey: true });
    });
    expect(result.current.editing).toBe(true);
    act(() => {
      fireEvent.blur(window);
    });
    expect(result.current.editing).toBe(false);
  });

  it("never edits when the page is not served by the application", () => {
    const { result } = renderHook(() => useLaunchpadRemoval(true));
    act(() => {
      fireEvent.keyDown(window, { key: "Alt", altKey: true });
    });
    expect(result.current.editing).toBe(false);
  });
});
