import { act, render, renderHook, screen } from "@testing-library/react";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { afterEach, describe, expect, it, vi } from "vitest";
import { takeOpenFileRequests } from "../finder/finder-open";
import { useDockDrop } from "./desktop-dock";
import { type DesktopDrag, type DesktopDragItem, landingAt, useDesktopDrop } from "./desktop-drag";
import { LAUNCHPAD_APP_DRAG } from "./desktop-launchpad-folders";
import { modalMenuOpen, takeKeyForModalMenu } from "./desktop-menu-tracking";
import { EPISODE_WATCH_MS, useEpisodeWatch } from "./desktop-notifications";

function press(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  const heard = vi.fn();
  window.addEventListener("keydown", heard);
  const taken = takeKeyForModalMenu(event);
  window.dispatchEvent(event);
  window.removeEventListener("keydown", heard);
  return { taken, heard: heard.mock.calls.length, prevented: event.defaultPrevented };
}

describe("a modal menu has the keyboard", () => {
  it("takes a command while a pop-up button's list is open, and lets it through once it has closed", async () => {
    const { rerender } = render(
      <PopUpButton aria-label="Choice" value="a" open>
        <PopUpButtonItem value="a">A</PopUpButtonItem>
      </PopUpButton>,
    );
    await screen.findByRole("listbox");
    expect(modalMenuOpen()).toBe(true);
    expect(press({ key: "h", metaKey: true })).toEqual({ taken: true, heard: 0, prevented: true });
    expect(press({ key: "F3" }).taken).toBe(true);
    expect(press({ key: "Escape" })).toEqual({ taken: false, heard: 1, prevented: false });
    expect(press({ key: "s" }).taken).toBe(false);

    rerender(
      <PopUpButton aria-label="Choice" value="a" open={false}>
        <PopUpButtonItem value="a">A</PopUpButtonItem>
      </PopUpButton>,
    );
    await vi.waitFor(() => expect(modalMenuOpen()).toBe(false));
    expect(press({ key: "h", metaKey: true })).toEqual({
      taken: false,
      heard: 1,
      prevented: false,
    });
  });

  it("takes nothing with no menu open", () => {
    expect(modalMenuOpen()).toBe(false);
    expect(press({ key: "q", ctrlKey: true }).taken).toBe(false);
  });
});

describe("what a drop of an application or a folder does", () => {
  const APP = {
    id: "Calculator",
    name: "Calculator",
    kind: "file" as const,
    type: LAUNCHPAD_APP_DRAG,
  };
  const dragOf = (items: DesktopDragItem[]): DesktopDrag => ({
    from: "finder",
    items,
    copy: false,
  });

  it("refuses an application in an application's window with a sentence, whatever it accepts", () => {
    const onDrop = vi.fn();
    const element = document.createElement("div");
    const { result } = renderHook(() => useDesktopDrop({ accepts: () => true, onDrop }));
    const stop = result.current(element);
    const landing = landingAt(element, dragOf([APP]));
    stop?.();
    expect(landing?.refusal).toBe("An application from Launchpad only goes in the Dock.");
    landing?.drop();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("opens a shell at a folder let go on Terminal's tile, and no other tile takes one", () => {
    const dock = document.createElement("div");
    dock.innerHTML =
      '<button data-dock-target="terminal" aria-label="Terminal"></button><button data-dock-target="notes" aria-label="Notes"></button>';
    const { result } = renderHook(() => useDockDrop(() => {}));
    const stop = result.current(dock);
    const folder = { id: "f-1", name: "Work", kind: "folder" as const };
    const on = (target: string) =>
      landingAt(dock.querySelector(`[data-dock-target="${target}"]`), dragOf([folder]));
    expect(on("notes")?.refusal).toBe("Notes can’t open this.");
    const landing = on("terminal");
    stop?.();
    expect(landing?.refusal).toBeUndefined();
    landing?.drop();
    expect(takeOpenFileRequests("terminal")).toEqual([
      { app: "terminal", id: "f-1", name: "Work", folder: "window" },
    ]);
  });
});

describe("useEpisodeWatch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks the server once when wanted and then hourly, and stops when no longer wanted", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async (_url: string) => new Response('{"delivered":0}', { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const asked = () =>
      fetcher.mock.calls.filter(([url]) => String(url) === "/api/podcasts/watch").length;

    const { rerender, unmount } = renderHook(({ wanted }) => useEpisodeWatch(wanted), {
      initialProps: { wanted: false },
    });
    expect(asked()).toBe(0);
    rerender({ wanted: true });
    expect(asked()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(EPISODE_WATCH_MS - 1));
    expect(asked()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(asked()).toBe(2);
    rerender({ wanted: false });
    await act(() => vi.advanceTimersByTimeAsync(EPISODE_WATCH_MS * 3));
    expect(asked()).toBe(2);
    unmount();
  });
});
