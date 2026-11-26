import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginDesktopValues,
  changeDesktopValue,
  connectDesktopValues,
  DOCK_AUTOHIDE,
  DOCK_MAGNIFICATION,
  DOCK_MAGNIFY,
  DOCK_ORDER,
  DOCK_POSITION,
  DOCK_SIZE,
  desktopPictureGeneration,
  desktopValues,
  dockedIds,
  dockPreferences,
  forgetDesktopValues,
  lastDesktopPicture,
  moveId,
  pictureLayers,
  readIds,
  receiveDesktopValues,
  showDesktopPicture,
  sliderToTile,
  takePictureChoice,
  takePictureTicket,
  useDesktopSetting,
  useDockPreferences,
} from "./desktop-personal";

// Each test starts from an empty page copy, with no change waiting to be saved, no session
// connected and none ended.
afterEach(() => {
  connectDesktopValues(() => {})();
  beginDesktopValues();
});

describe("the person's Dock preferences", () => {
  it("turns the pane's sliders into tile sizes, 16 to 128 points", () => {
    expect(sliderToTile(0)).toBe(16);
    expect(sliderToTile(42.5)).toBe(64);
    expect(sliderToTile(100)).toBe(128);
    expect(sliderToTile(250)).toBe(128);
    expect(sliderToTile(-5)).toBe(16);
  });

  it("takes the pane's defaults: the 64 pt Dock of the screenshots, at the bottom, shown", () => {
    expect(dockPreferences({})).toEqual({
      tile: 64,
      magnification: undefined,
      position: "bottom",
      autohide: false,
    });
  });

  it("magnifies only when it is on and larger than the tiles", () => {
    expect(dockPreferences({ [DOCK_MAGNIFY]: true }).magnification).toBe(128);
    expect(
      dockPreferences({ [DOCK_MAGNIFY]: true, [DOCK_MAGNIFICATION]: 30, [DOCK_SIZE]: 60 })
        .magnification,
    ).toBeUndefined();
    expect(dockPreferences({ [DOCK_MAGNIFICATION]: 100 }).magnification).toBeUndefined();
  });

  it("ignores stored values of the wrong kind", () => {
    expect(
      dockPreferences({
        [DOCK_SIZE]: "big",
        [DOCK_POSITION]: "top",
        [DOCK_AUTOHIDE]: "yes",
      }),
    ).toEqual(dockPreferences({}));
  });

  it("follows a change made in System Preferences while the Dock is shown", () => {
    const { result } = renderHook(() => useDockPreferences());
    const first = result.current;
    expect(first.position).toBe("bottom");
    act(() => receiveDesktopValues({ [DOCK_POSITION]: "left", [DOCK_AUTOHIDE]: true }));
    expect(result.current).toMatchObject({ position: "left", autohide: true });
    // Another setting changes nothing of the Dock: the record stays the same.
    const second = result.current;
    act(() => receiveDesktopValues({ ...desktopValues(), "general.scrollBars": "always" }));
    expect(result.current).toBe(second);
  });
});

describe("the Dock's apps", () => {
  const installed = ["notes", "safari", "music", "system-preferences"];

  it("keeps every app the person has, in the desktop's order, until they arrange it", () => {
    expect(dockedIds(installed, [], [])).toEqual(installed);
  });

  it("puts the person's order first, leaves removed apps out, and adds apps got since", () => {
    expect(dockedIds([...installed, "chess"], ["music", "notes"], ["safari"])).toEqual([
      "music",
      "notes",
      "system-preferences",
      "chess",
    ]);
    // An app in the order that the person no longer has is not shown.
    expect(dockedIds(["notes"], ["tv", "notes"], [])).toEqual(["notes"]);
  });

  it("moves an app to a place, clamped to the Dock", () => {
    expect(moveId(installed, "music", 0)).toEqual([
      "music",
      "notes",
      "safari",
      "system-preferences",
    ]);
    expect(moveId(installed, "notes", 99)).toEqual([
      "safari",
      "music",
      "system-preferences",
      "notes",
    ]);
    expect(moveId(installed, "notes", 0)).toBe(installed);
    expect(moveId(installed, "tv", 1)).toBe(installed);
  });

  it("reads a list of app ids without repeats, and refuses anything else", () => {
    expect(readIds(["notes", "notes", "tv"])).toEqual(["notes", "tv"]);
    expect(readIds(["Notes"])).toBeUndefined();
    expect(readIds("notes")).toBeUndefined();
  });
});

describe("the page's copy of the settings", () => {
  it("shows a change at once and keeps it in the page while no session saves it", () => {
    const { result } = renderHook(() =>
      useDesktopSetting<readonly string[]>(DOCK_ORDER, readIds, []),
    );
    expect(result.current[0]).toEqual([]);
    act(() => result.current[1](["music", "notes"]));
    expect(result.current[0]).toEqual(["music", "notes"]);
  });

  it("hands every change to the connected session, and forgets the values when it goes", () => {
    const write = vi.fn();
    receiveDesktopValues({ [DOCK_SIZE]: 10 });
    const disconnect = connectDesktopValues(write);
    changeDesktopValue(DOCK_POSITION, "right");
    expect(write).toHaveBeenCalledWith(DOCK_POSITION, "right");
    // The same value again is no change.
    changeDesktopValue(DOCK_POSITION, "right");
    expect(write).toHaveBeenCalledTimes(1);
    expect(desktopValues()).toEqual({ [DOCK_SIZE]: 10, [DOCK_POSITION]: "right" });
    disconnect();
    expect(desktopValues()).toEqual({});
  });

  it("keeps a change made while the settings load, over the load, and saves it once connected", () => {
    changeDesktopValue(DOCK_ORDER, ["notes", "safari"]);
    changeDesktopValue(DOCK_POSITION, "left");
    receiveDesktopValues({ [DOCK_ORDER]: ["safari"], [DOCK_SIZE]: 30 });
    expect(desktopValues()).toEqual({
      [DOCK_ORDER]: ["notes", "safari"],
      [DOCK_POSITION]: "left",
      [DOCK_SIZE]: 30,
    });
    // The session hands its own record back on every write, as System Preferences' does.
    const stored: Record<string, unknown> = { [DOCK_ORDER]: ["safari"], [DOCK_SIZE]: 30 };
    const write = vi.fn((key: string, value: unknown) => {
      stored[key] = value;
      receiveDesktopValues({ ...stored });
    });
    const disconnect = connectDesktopValues(write);
    expect(write).toHaveBeenCalledWith(DOCK_ORDER, ["notes", "safari"]);
    expect(write).toHaveBeenCalledWith(DOCK_POSITION, "left");
    expect(write).toHaveBeenCalledTimes(2);
    disconnect();
  });

  it("forgets the desktop picture when the session ends", () => {
    const disconnect = connectDesktopValues(vi.fn());
    showDesktopPicture({ day: "blob:mine", look: "auto" });
    expect(lastDesktopPicture()).not.toBeNull();
    disconnect();
    expect(lastDesktopPicture()).toBeNull();
  });

  it("forgets everything of a session that ends before its settings loaded", () => {
    changeDesktopValue(DOCK_POSITION, "left");
    showDesktopPicture({ day: "blob:mine", look: "auto" });
    const before = desktopPictureGeneration();
    forgetDesktopValues();
    expect(desktopValues()).toEqual({});
    expect(lastDesktopPicture()).toBeNull();
    expect(desktopPictureGeneration()).toBe(before + 1);
    // A drag let go after the session ended changes nothing and is kept for nobody.
    changeDesktopValue(DOCK_ORDER, ["music", "notes"]);
    expect(desktopValues()).toEqual({});
    // Nothing waits to be saved into the next session.
    const write = vi.fn();
    connectDesktopValues(write)();
    expect(write).not.toHaveBeenCalled();
  });
});

describe("the desktop picture", () => {
  const fallback = { day: "day.webp", night: "night.webp" };

  it("remembers the latest picture named, for a desktop that mounts later", () => {
    showDesktopPicture({
      day: "a.jpg",
      night: "a.jpg",
      look: "auto",
      source: "photos",
      ...takePictureTicket(),
    });
    expect(lastDesktopPicture()).toMatchObject({ day: "a.jpg", source: "photos" });
  });

  it("shows a picture only for the newest choice, of the session it was made in", () => {
    showDesktopPicture({ day: "now.jpg", look: "auto" });
    // Photos' choice without its ticket is not shown.
    showDesktopPicture({ day: "untold.jpg", look: "auto", source: "photos" });
    expect(lastDesktopPicture()?.day).toBe("now.jpg");
    // A slow photo whose choice the person has made another since.
    const slow = takePictureTicket();
    takePictureChoice();
    showDesktopPicture({ day: "slow.jpg", look: "auto", source: "photos", ...slow });
    expect(lastDesktopPicture()?.day).toBe("now.jpg");
    // A photo chosen before the session ended, arriving after: the page stays nobody's.
    const before = takePictureTicket();
    forgetDesktopValues();
    showDesktopPicture({ day: "theirs.jpg", look: "auto", source: "photos", ...before });
    expect(lastDesktopPicture()).toBeNull();
    // Nor anything else that finishes before the next session begins, ticket or none.
    showDesktopPicture({ day: "late.jpg", look: "auto" });
    showDesktopPicture({
      day: "later.jpg",
      look: "auto",
      source: "photos",
      ...takePictureTicket(),
    });
    expect(lastDesktopPicture()).toBeNull();
    beginDesktopValues();
    showDesktopPicture({ day: "next.jpg", look: "auto" });
    expect(lastDesktopPicture()?.day).toBe("next.jpg");
  });

  it("layers the two pictures by the look asked for", () => {
    const noon = new Date(2026, 9, 14, 12, 0);
    const night = new Date(2026, 9, 14, 23, 30);
    expect(pictureLayers(null, fallback, noon)).toEqual(fallback);
    expect(pictureLayers({ day: "d", night: "n", look: "auto" }, fallback, noon)).toEqual({
      day: "d",
      night: "n",
    });
    expect(pictureLayers({ day: "d", night: "n", look: "night" }, fallback, noon)).toEqual({
      day: "n",
      night: "n",
    });
    // A dynamic desktop set to Dynamic follows the browser's clock, whatever the appearance.
    expect(pictureLayers({ day: "d", night: "n", look: "time" }, fallback, noon)).toEqual({
      day: "d",
      night: "d",
    });
    expect(pictureLayers({ day: "d", night: "n", look: "time" }, fallback, night)).toEqual({
      day: "n",
      night: "n",
    });
    // Catalina's own pictures are the desktop's: a detail with a look alone keeps them.
    expect(pictureLayers({ look: "day" }, fallback, noon)).toEqual({
      day: "day.webp",
      night: "day.webp",
    });
  });
});
