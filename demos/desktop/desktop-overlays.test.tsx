import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopApp } from "./desktop-apps";
import { DesktopOverlays, launchpadGrid } from "./desktop-overlays";
import {
  changeDesktopValue,
  connectDesktopValues,
  desktopValues,
  forgetDesktopValues,
} from "./desktop-personal";

const APPS = Array.from({ length: 80 }, (_, n) => ({
  id: `app-${n}`,
  name: `App ${n}`,
})) as unknown as DesktopApp[];

const firstOnPage = () => document.querySelector(".mac-launchpad-item")?.getAttribute("data-app");

const rest = () => new Promise((resolve) => setTimeout(resolve, 520));

function renderPad() {
  render(
    <DesktopOverlays
      overlay="launchpad"
      onOverlayChange={() => {}}
      apps={APPS}
      launch={vi.fn()}
      container={document.body}
    />,
  );
  return screen.getByRole("dialog", { name: "Launchpad" });
}

describe("An application dragged out of a Launchpad folder", () => {
  const FOLDER = { id: "f", name: "Tools", apps: ["app-0", "app-1", "app-2"] };
  const stored = () => desktopValues()["launchpad.folders"] as { apps: string[] }[];
  const open = async () => {
    connectDesktopValues(() => undefined);
    changeDesktopValue("launchpad.folders", [FOLDER]);
    renderPad();
    fireEvent.click(document.querySelector(".mac-launchpad-folder") as Element);
    await waitFor(() => expect(document.querySelector(".mac-launchpad-folder-panel")).toBeTruthy());
    return document.querySelector('.mac-launchpad-folder-panel [data-app="app-2"]') as Element;
  };
  const start = (item: Element) =>
    fireEvent.dragStart(item, { dataTransfer: { setData() {}, effectAllowed: "" } });

  afterEach(() => forgetDesktopValues());

  it("stays in it when the drag is cancelled, however far it went", async () => {
    const item = await open();
    start(item);
    const dismiss = document.querySelector(".mac-launchpad-folder-dismiss") as Element;
    expect(fireEvent.dragOver(dismiss)).toBe(false);
    fireEvent.dragEnd(item);
    expect(stored()[0]?.apps).toEqual(FOLDER.apps);
    fireEvent.drop(dismiss);
    expect(stored()[0]?.apps).toEqual(FOLDER.apps);
  });

  it("is dragged as the application, not as the folder it is in", async () => {
    const item = await open();
    const setData = vi.fn();
    fireEvent.dragStart(item, { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith("text/plain", "app-2");
    expect(setData).not.toHaveBeenCalledWith("text/plain", "Tools");
  });

  it("stays in it when let go on the panel, and leaves it when let go outside", async () => {
    const item = await open();
    start(item);
    fireEvent.drop(document.querySelector(".mac-launchpad-folder-panel") as Element);
    expect(stored()[0]?.apps).toEqual(FOLDER.apps);
    fireEvent.drop(document.querySelector(".mac-launchpad-folder-dismiss") as Element);
    expect(stored()[0]?.apps).toEqual(["app-0", "app-1"]);
    // Done with: an unrelated drop later does not take it out of a folder it has joined since.
    changeDesktopValue("launchpad.folders", [FOLDER]);
    fireEvent.drop(document.body);
    expect(stored()[0]?.apps).toEqual(FOLDER.apps);
  });

  it("hears no more when Launchpad goes in the middle of the drag", async () => {
    const item = await open();
    start(item);
    cleanup();
    fireEvent.drop(document.body);
    expect(stored()[0]?.apps).toEqual(FOLDER.apps);
  });
});

describe("Launchpad's grid", () => {
  it("stays 7 by 5 while a cell holds an application, then gives up columns and rows", () => {
    expect(launchpadGrid(1440, 900)).toEqual({ columns: 7, rows: 5 });
    expect(launchpadGrid(770, 676)).toEqual({ columns: 7, rows: 5 });
    expect(launchpadGrid(660, 560)).toEqual({ columns: 6, rows: 3 });
    expect(launchpadGrid(100, 100)).toEqual({ columns: 1, rows: 1 });
  });

  it("is the most before the desktop has been measured", () => {
    expect(launchpadGrid(0, 0)).toEqual({ columns: 7, rows: 5 });
  });
});

describe("Launchpad's pages on the desktop", () => {
  it("keeps its own page where the desktop keeps none: on and back from the keyboard", async () => {
    const pad = renderPad();
    fireEvent.keyDown(pad, { key: "ArrowRight" });
    await waitFor(() => expect(firstOnPage()).toBe("app-35"));
    fireEvent.keyDown(pad, { key: "ArrowRight" });
    await waitFor(() => expect(firstOnPage()).toBe("app-70"));
    fireEvent.keyDown(pad, { key: "ArrowLeft" });
    fireEvent.keyDown(pad, { key: "ArrowLeft" });
    await waitFor(() => expect(firstOnPage()).toBe("app-0"));
  });

  it("turns once for a wheel's notch, whatever unit it reports in", async () => {
    const pad = renderPad();
    fireEvent.wheel(pad, { deltaY: 120, deltaMode: 0 });
    await waitFor(() => expect(firstOnPage()).toBe("app-35"));
    await rest();
    fireEvent.wheel(pad, { deltaY: 3, deltaMode: 1 });
    await waitFor(() => expect(firstOnPage()).toBe("app-70"));
    await rest();
    // One line alone is not enough; together with the next two it is.
    fireEvent.wheel(pad, { deltaY: -1, deltaMode: 1 });
    expect(firstOnPage()).toBe("app-70");
    fireEvent.wheel(pad, { deltaY: -2, deltaMode: 1 });
    await waitFor(() => expect(firstOnPage()).toBe("app-35"));
  });

  it("counts a page-mode wheel by the height of a page", async () => {
    const pad = renderPad();
    vi.spyOn(pad, "clientHeight", "get").mockReturnValue(800);
    fireEvent.wheel(pad, { deltaY: 1, deltaMode: 2 });
    await waitFor(() => expect(firstOnPage()).toBe("app-35"));
  });

  it("turns one page for one long swipe, and again once it has stopped", async () => {
    const pad = renderPad();
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    for (let n = 0; n < 12; n += 1) {
      fireEvent.wheel(pad, { deltaX: 30, deltaMode: 0 });
      await pause(100);
    }
    expect(firstOnPage()).toBe("app-35");
    await rest();
    fireEvent.wheel(pad, { deltaX: 80, deltaMode: 0 });
    await waitFor(() => expect(firstOnPage()).toBe("app-70"));
  });

  it("turns one page for one stream of movements", async () => {
    const pad = renderPad();
    for (let n = 0; n < 10; n += 1) fireEvent.wheel(pad, { deltaX: 30, deltaMode: 0 });
    await waitFor(() => expect(firstOnPage()).toBe("app-35"));
  });
});
