import { describe, expect, it } from "vitest";
import {
  ALL_DESKTOPS,
  addSpace,
  assignApp,
  assignmentOf,
  type DesktopSpaces,
  MOST_SPACES,
  moveSpace,
  ONE_SPACE,
  readSpaces,
  removeSpace,
  settled,
  showsNow,
  spaceBeside,
  spaceKey,
  splitFrames,
  splitWindowsOf,
  swapTiles,
  tileWindows,
} from "./desktop-spaces";

const THREE: DesktopSpaces = {
  spaces: ["1", "2", "3"],
  current: "2",
  windows: { chess: "1", notes: "2", mail: "3" },
  next: 4,
};

const key = (init: KeyboardEventInit, target?: Element) => {
  const event = new KeyboardEvent("keydown", { ...init, bubbles: true });
  if (target) {
    Object.defineProperty(event, "target", { value: target });
  }
  return event;
};

describe("the desktop's Spaces", () => {
  it("reads a well-formed value as the same object and refuses any other", () => {
    expect(readSpaces(THREE)).toBe(THREE);
    expect(readSpaces({ ...THREE, current: "9" })).toBeUndefined();
    expect(readSpaces({ ...THREE, spaces: [] })).toBeUndefined();
    expect(readSpaces({ ...THREE, spaces: ["1", "2", "2", "3"] })).toBeUndefined();
    expect(readSpaces({ ...THREE, windows: { chess: "9" } })).toBeUndefined();
    expect(readSpaces("1")).toBeUndefined();
  });

  it("adds a Space with an id never used before, up to the most a Mac takes", () => {
    const added = addSpace(removeSpace(THREE, "3"));
    expect(added.spaces).toEqual(["1", "2", "4"]);
    const full = { ...THREE, spaces: Array.from({ length: MOST_SPACES }, (_, at) => String(at)) };
    expect(addSpace(full)).toBe(full);
  });

  it("gives a removed Space's windows to the one before, and shows that one if it was showing", () => {
    expect(removeSpace(THREE, "2")).toEqual({
      spaces: ["1", "3"],
      current: "1",
      windows: { chess: "1", notes: "1", mail: "3" },
      next: 4,
      assigned: {},
    });
    expect(removeSpace(THREE, "1")).toMatchObject({
      spaces: ["2", "3"],
      current: "2",
      windows: { chess: "2", notes: "2", mail: "3" },
    });
  });

  it("keeps the last Space", () => {
    expect(removeSpace(ONE_SPACE, "1")).toBe(ONE_SPACE);
  });

  it("moves a Space along the bar", () => {
    expect(moveSpace(THREE, "3", 0).spaces).toEqual(["3", "1", "2"]);
    expect(moveSpace(THREE, "1", 2).spaces).toEqual(["2", "3", "1"]);
    expect(moveSpace(THREE, "2", 1)).toBe(THREE);
  });

  it("steps to the Space beside and stops at the ends", () => {
    expect(spaceBeside(THREE, -1)).toBe("1");
    expect(spaceBeside({ ...THREE, current: "1" }, -1)).toBe("1");
    expect(spaceBeside({ ...THREE, current: "3" }, 1)).toBe("3");
  });

  it("puts a window first seen on the Space showing, unless it has one", () => {
    const windows = [
      { id: "chess", state: "inactive", away: false },
      { id: "new", state: "key", away: false },
    ] as const;
    const next = settled(THREE, windows, new Set());
    expect(next.windows).toEqual({ chess: "1", notes: "2", mail: "3", new: "2" });
    expect(next.current).toBe("2");
  });

  it("follows a window a command brought back from another Space", () => {
    const next = settled(THREE, [{ id: "chess", state: "key", away: false }], new Set(["chess"]));
    expect(next.current).toBe("1");
  });

  it("does not follow a window coming back with the page", () => {
    const windows = [{ id: "chess", state: "key", away: false }] as const;
    expect(settled(THREE, windows, new Set()).current).toBe("2");
  });

  it("forgets a window that closed, and answers the same record when nothing changed", () => {
    const windows = [
      { id: "notes", state: "key", away: false },
      { id: "chess", state: "inactive", away: true },
    ] as const;
    const seen = new Set(["notes", "chess"]);
    expect(settled(THREE, windows, seen)).toBe(THREE);
    seen.add("mail");
    expect(settled(THREE, windows, seen).windows).toEqual({ chess: "1", notes: "2" });
  });

  it("assigns an application to this Desktop, bringing its windows, to all, and to none", () => {
    const mine = assignApp(THREE, "chess", ["chess"], "this");
    expect(mine.windows.chess).toBe("2");
    expect(assignmentOf(mine, "chess")).toBe("this");
    expect(assignmentOf({ ...mine, current: "1" }, "chess")).toBe("other");
    const every = assignApp(mine, "chess", ["chess"], "all");
    expect(every.assigned).toEqual({ chess: ALL_DESKTOPS });
    expect(assignmentOf(every, "chess")).toBe("all");
    expect(assignApp(every, "chess", [], "none").assigned).toEqual({});
  });

  it("opens an assigned application's window on its Desktop, taking the person there", () => {
    const state = { ...THREE, assigned: { pages: "3" } };
    const next = settled(
      state,
      [
        { id: "notes", state: "inactive", away: false },
        { id: "pages", app: "pages", state: "key", away: false },
      ],
      new Set(["notes"]),
    );
    expect(next.windows.pages).toBe("3");
    expect(next.current).toBe("3");
  });

  it("follows an assigned application's window when no other window is open", () => {
    const state = { ...THREE, windows: {}, assigned: { pages: "3" } };
    const windows = [{ id: "pages", app: "pages", state: "key", away: false }] as const;
    expect(settled(state, windows, new Set()).current).toBe("3");
  });

  it("does not follow a window that is on every Desktop", () => {
    const state = { ...THREE, assigned: { chess: ALL_DESKTOPS } };
    const windows = [{ id: "chess", app: "chess", state: "key", away: false }] as const;
    expect(settled(state, windows, new Set(["chess"])).current).toBe("2");
  });

  it("forgets assignments to a Desktop removed", () => {
    expect(removeSpace({ ...THREE, assigned: { a: "3", b: "1" } }, "3").assigned).toEqual({
      b: "1",
    });
  });

  it("makes a Space beside its own for a window in full screen, and shows it", () => {
    const windows = [
      { id: "notes", state: "key", away: false, fullScreen: true },
      { id: "chess", state: "inactive", away: true },
    ] as const;
    const next = settled(THREE, windows, new Set(["notes", "chess"]));
    expect(next.spaces).toEqual(["1", "2", "fs:notes", "3"]);
    expect(next.current).toBe("fs:notes");
    expect(next.windows.notes).toBe("fs:notes");
    expect(settled(next, windows, new Set(["notes", "chess"]))).toBe(next);
  });

  it("takes the Space away when its window leaves full screen or closes", () => {
    const full = {
      ...THREE,
      spaces: ["1", "2", "fs:notes", "3"],
      current: "fs:notes",
      windows: { ...THREE.windows, notes: "fs:notes" },
    };
    const left = settled(full, [{ id: "notes", state: "key", away: false }], new Set(["notes"]));
    expect(left.spaces).toEqual(["1", "2", "3"]);
    expect(left.current).toBe("2");
    expect(left.windows.notes).toBe("2");
    expect(settled(full, [], new Set(["notes"])).spaces).toEqual(["1", "2", "3"]);
  });

  it("makes a Space of two windows beside the left one's, and shows it", () => {
    const state = {
      ...THREE,
      spaces: ["1", "2"],
      current: "1",
      windows: { a: "1", b: "1", c: "2" },
    };
    const frames = {
      a: { x: 1, y: 2, width: 3, height: 4 },
      b: { x: 5, y: 6, width: 7, height: 8 },
    };
    const next = tileWindows(state, "a", "b", frames);
    expect(next.spaces).toEqual(["1", "split:a|b", "2"]);
    expect(next.current).toBe("split:a|b");
    expect(next.windows).toEqual({ a: "split:a|b", b: "split:a|b", c: "2" });
    expect(next.tiles?.["split:a|b"]).toEqual({ share: 0.5, frames });
    expect(splitWindowsOf("split:a|b")).toEqual(["a", "b"]);
    expect(splitWindowsOf("1")).toBeUndefined();
    expect(showsNow(next, "a", "x")).toBe(true);
    expect(showsNow(next, "c", "x")).toBe(false);
  });

  it("divides a screen by a share, within limits, with the divider between", () => {
    expect(splitFrames(0.5, 1006, 700)).toEqual([
      { x: 0, y: 0, width: 500, height: 700 },
      { x: 506, y: 0, width: 500, height: 700 },
    ]);
    expect(splitFrames(0.9, 1006, 700)[0].width).toBe(750);
    expect(splitFrames(0, 1006, 700)[0].width).toBe(250);
    expect(splitFrames(Number.NaN, 1006, 700)[0].width).toBe(500);
  });

  it.each([
    ["one closes", [{ id: "a", state: "key", away: false }]],
    [
      "one is minimized",
      [
        { id: "a", state: "key", away: false },
        { id: "b", state: "inactive", away: false, minimized: true },
      ],
    ],
    [
      "one goes to full screen",
      [
        { id: "a", state: "inactive", away: false },
        { id: "b", state: "key", away: false, fullScreen: true },
      ],
    ],
  ] as const)("ends a Split View when %s, and its frames wait to go back", (_name, windows) => {
    const frames = { a: { x: 1, y: 2, width: 3, height: 4 } };
    const state = tileWindows(
      { ...THREE, spaces: ["1"], current: "1", windows: { a: "1", b: "1" } },
      "a",
      "b",
      frames,
    );
    const next = settled(state, windows, new Set(["a", "b"]));
    expect(next.spaces).not.toContain("split:a|b");
    expect(next.windows.a).toBe("1");
    expect(next.tiles?.["split:a|b"]?.frames).toEqual(frames);
  });

  it("keeps a Split View for a window still coming back with the page, and ends it after", () => {
    const state = tileWindows(
      { ...THREE, spaces: ["1"], current: "1", windows: { a: "1", b: "1" } },
      "a",
      "b",
      {},
    );
    const a = { id: "a", state: "key", away: false } as const;
    expect(settled(state, [], new Set(), true)).toBe(state);
    expect(settled(state, [a], new Set(), true)).toBe(state);
    expect(settled(state, [a], new Set()).spaces).toEqual(["1"]);
    const minimized = { ...a, minimized: true };
    expect(settled(state, [minimized], new Set(), true).spaces).toEqual(["1"]);
  });

  it("keeps a full-screen Space for its window coming back with the page, and ends it after", () => {
    const state: DesktopSpaces = {
      ...THREE,
      spaces: ["1", "fs:a"],
      current: "fs:a",
      windows: { a: "fs:a" },
    };
    const a = { id: "a", state: "key", away: false } as const;
    expect(settled(state, [], new Set(), true)).toBe(state);
    expect(settled(state, [a], new Set(), true)).toBe(state);
    expect(settled(state, [{ ...a, fullScreen: true }], new Set(), true)).toBe(state);
    const after = settled(state, [a], new Set());
    expect(after.spaces).toEqual(["1"]);
    expect(after.windows.a).toBe("1");
  });

  it("changes a Split View's sides, each window keeping its width", () => {
    const state = tileWindows(
      { ...THREE, spaces: ["1", "2"], current: "1", windows: { a: "1", b: "1" } },
      "a",
      "b",
      { a: { x: 1, y: 2, width: 3, height: 4 } },
    );
    const moved = {
      ...state,
      tiles: { "split:a|b": { ...state.tiles?.["split:a|b"], share: 0.7, frames: {} } },
    };
    const next = swapTiles(moved, "split:a|b");
    expect(next.spaces).toEqual(["1", "split:b|a", "2"]);
    expect(next.current).toBe("split:b|a");
    expect(next.windows.a).toBe("split:b|a");
    expect(next.windows.b).toBe("split:b|a");
    expect(next.tiles?.["split:b|a"]?.share).toBeCloseTo(0.3);
    expect(next.tiles?.["split:a|b"]).toBeUndefined();
    expect(swapTiles(state, "1")).toBe(state);
  });

  it("opens an unrelated window from a Split View on the Desktop beside it", () => {
    const state = tileWindows(
      { ...THREE, spaces: ["1"], current: "1", windows: { a: "1", b: "1" } },
      "a",
      "b",
      {},
    );
    const next = settled(
      state,
      [
        { id: "a", state: "inactive", away: true },
        { id: "b", state: "inactive", away: true },
        { id: "c", state: "key", away: false },
      ],
      new Set(["a", "b"]),
    );
    expect(next.windows.c).toBe("1");
    expect(next.current).toBe("1");
  });

  it("refuses a stored next id that would break the next Space", () => {
    expect(readSpaces({ ...THREE, next: 3 })).toBeUndefined();
    expect(readSpaces({ ...THREE, next: 2.5 })).toBeUndefined();
    expect(readSpaces({ ...THREE, next: Number.NaN })).toBeUndefined();
    expect(readSpaces({ ...THREE, next: 0 })).toBeUndefined();
    expect(readSpaces({ ...THREE, windows: [] })).toBeUndefined();
  });

  it("keeps a full-screen Space to its own window, whatever is on All Desktops", () => {
    const state = {
      ...THREE,
      spaces: ["1", "fs:chess"],
      current: "fs:chess",
      windows: { chess: "fs:chess", notes: "1" },
      assigned: { notes: ALL_DESKTOPS, chess: ALL_DESKTOPS },
    };
    expect(showsNow(state, "chess", "chess")).toBe(true);
    expect(showsNow(state, "notes", "notes")).toBe(false);
    const onDesktop = { ...state, current: "1" };
    expect(showsNow(onDesktop, "chess", "chess")).toBe(false);
    expect(showsNow(onDesktop, "notes", "notes")).toBe(true);
  });

  it("returns a window leaving full screen to a Desktop, not another full-screen Space", () => {
    const state = {
      ...THREE,
      spaces: ["1", "fs:b", "fs:a"],
      current: "fs:a",
      windows: { a: "fs:a", b: "fs:b" },
    };
    const left = removeSpace(state, "fs:a");
    expect(left.windows).toEqual({ a: "1", b: "fs:b" });
    expect(left.current).toBe("1");
  });

  it("opens a window from a full-screen Space on the Desktop beside it, and goes there", () => {
    const state = {
      ...THREE,
      spaces: ["1", "fs:chess"],
      current: "fs:chess",
      windows: { chess: "fs:chess" },
    };
    const next = settled(
      state,
      [
        { id: "chess", state: "inactive", away: false, fullScreen: true },
        { id: "notes", state: "key", away: false },
      ],
      new Set(["chess"]),
    );
    expect(next.windows).toEqual({ chess: "fs:chess", notes: "1" });
    expect(next.current).toBe("1");
  });

  it("keeps a further window of the application in full screen with it, and goes on showing it", () => {
    const state = {
      ...THREE,
      spaces: ["1", "fs:calc"],
      current: "fs:calc",
      windows: { calc: "fs:calc" },
      assigned: { calculator: "1" },
    };
    const next = settled(
      state,
      [
        { id: "calc", app: "calculator", state: "inactive", away: false, fullScreen: true },
        { id: "calc:tape", app: "calculator", state: "key", away: false },
      ],
      new Set(["calc"]),
    );
    expect(next.windows).toEqual({ calc: "fs:calc", "calc:tape": "fs:calc" });
    expect(next.current).toBe("fs:calc");
    expect(showsNow(next, "calc:tape", "calculator")).toBe(true);
  });

  it("takes an application's panel into full screen with it, and brings it back after", () => {
    const state = { ...THREE, spaces: ["1"], current: "1", windows: { calc: "1", tape: "1" } };
    const seen = new Set(["calc", "tape"]);
    const inFull = settled(
      state,
      [
        { id: "tape", app: "calculator", panel: true, state: "main", away: false },
        { id: "calc", app: "calculator", state: "key", away: false, fullScreen: true },
      ],
      seen,
    );
    expect(inFull.windows).toEqual({ calc: "fs:calc", tape: "fs:calc" });
    const out = settled(
      inFull,
      [
        { id: "tape", app: "calculator", panel: true, state: "inactive", away: false },
        { id: "calc", app: "calculator", state: "key", away: false, fullScreen: false },
      ],
      seen,
    );
    expect(out.windows).toEqual({ calc: "1", tape: "1" });
    expect(out.spaces).toEqual(["1"]);
  });

  it("leaves a full-screen window on its own Space when its application is assigned", () => {
    const state = {
      ...THREE,
      spaces: ["1", "fs:chess"],
      current: "1",
      windows: { chess: "fs:chess" },
    };
    const next = assignApp(state, "chess", ["chess"], "this");
    expect(next.windows.chess).toBe("fs:chess");
    expect(next.assigned).toEqual({ chess: "1" });
    const strayed = { ...state, windows: { chess: "1" } };
    const mended = settled(
      strayed,
      [{ id: "chess", state: "inactive", away: true, fullScreen: true }],
      new Set(["chess"]),
    );
    expect(mended.spaces).toEqual(["1", "fs:chess"]);
    expect(mended.windows.chess).toBe("fs:chess");
  });

  it("assigns This Desktop from a full-screen Space to the Desktop beside it", () => {
    const state = {
      ...THREE,
      spaces: ["1", "fs:chess"],
      current: "fs:chess",
      windows: { chess: "fs:chess", notes: "1" },
    };
    const next = assignApp(state, "notes", ["notes"], "this");
    expect(next.assigned).toEqual({ notes: "1" });
    expect(next.windows.notes).toBe("1");
    expect(showsNow(next, "notes", "notes")).toBe(false);
    expect(showsNow(next, "chess", "chess")).toBe(true);
    const opened = settled(
      next,
      [{ id: "notes:2", app: "notes", state: "inactive", away: true }],
      new Set(),
    );
    expect(opened.windows["notes:2"]).toBe("1");
  });

  it("keeps the last Desktop beside a full-screen Space", () => {
    const state = { ...ONE_SPACE, spaces: ["1", "fs:a"], windows: { a: "fs:a" } };
    expect(removeSpace(state, "1")).toBe(state);
  });

  it("takes Control-Left and Control-Right, and leaves them to a field being typed in", () => {
    expect(spaceKey(key({ key: "ArrowLeft", ctrlKey: true }), false)).toEqual({ step: -1 });
    expect(spaceKey(key({ key: "ArrowRight", ctrlKey: true, shiftKey: true }), true)).toEqual({
      step: 1,
    });
    const field = document.createElement("textarea");
    expect(spaceKey(key({ key: "ArrowLeft", ctrlKey: true }, field), false)).toBeNull();
    for (const editable of ["", "true", "plaintext-only"]) {
      const editor = document.createElement("div");
      editor.setAttribute("contenteditable", editable);
      const inside = editor.appendChild(document.createElement("span"));
      expect(spaceKey(key({ key: "ArrowLeft", ctrlKey: true }, inside), false)).toBeNull();
    }
    const notEditable = document.createElement("div");
    notEditable.setAttribute("contenteditable", "false");
    expect(spaceKey(key({ key: "ArrowLeft", ctrlKey: true }, notEditable), false)).toEqual({
      step: -1,
    });
    expect(spaceKey(key({ key: "ArrowLeft", ctrlKey: true, altKey: true }), false)).toBeNull();
    expect(spaceKey(key({ key: "ArrowLeft" }), false)).toBeNull();
  });

  it("takes Control-digit on a Mac only, where it is not Command, and Control-Option-digit anywhere", () => {
    expect(spaceKey(key({ code: "Digit2", ctrlKey: true }), true)).toEqual({ position: 1 });
    expect(spaceKey(key({ code: "Digit2", ctrlKey: true }), false)).toBeNull();
    expect(spaceKey(key({ code: "Digit3", ctrlKey: true, altKey: true }), false)).toEqual({
      position: 2,
    });
    expect(spaceKey(key({ code: "Digit0", ctrlKey: true, altKey: true }), false)).toBeNull();
  });
});
