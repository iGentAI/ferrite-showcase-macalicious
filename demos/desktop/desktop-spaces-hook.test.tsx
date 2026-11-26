import { act, renderHook } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createWindowManagerStore } from "../../src/components/window-manager/store";
import { changeDesktopValue, connectDesktopValues, forgetDesktopValues } from "./desktop-personal";
import { DESKTOP_SPACES, type DesktopSpaces, ONE_SPACE, useDesktopSpaces } from "./desktop-spaces";

const FRAME = { x: 0, y: 0, width: 400, height: 300 };

const storeWith = (...ids: readonly string[]) => {
  const store = createWindowManagerStore();
  for (const id of ids) {
    store.add(
      {
        id,
        app: id,
        title: id,
        panel: false,
        resizable: true,
        minWidth: 0,
        minHeight: 0,
        frame: FRAME,
      },
      () => undefined,
    );
  }
  return store;
};

const mount = (
  state: DesktopSpaces,
  store: ReturnType<typeof storeWith>,
  coming: () => boolean = () => false,
) => {
  connectDesktopValues(() => undefined);
  changeDesktopValue(DESKTOP_SPACES, state);
  return renderHook(() =>
    useDesktopSpaces(
      store,
      useSyncExternalStore(store.subscribe, store.list),
      true,
      () => null,
      coming,
    ),
  );
};

describe("useDesktopSpaces", () => {
  afterEach(() => forgetDesktopValues());

  it("puts a window coming back with the page into the full screen it left in", () => {
    const store = storeWith("a");
    const { result } = mount(
      { ...ONE_SPACE, spaces: ["1", "fs:a"], current: "fs:a", windows: { a: "fs:a" } },
      store,
      () => true,
    );
    expect(store.get("a")?.fullScreen).toBe(true);
    expect(result.current.state.spaces).toEqual(["1", "fs:a"]);
    expect(result.current.state.current).toBe("fs:a");
  });

  it("does not put a window back in full screen once the page has come back", () => {
    const store = storeWith("a");
    const { result } = mount(
      { ...ONE_SPACE, spaces: ["1", "fs:a"], current: "fs:a", windows: { a: "fs:a" } },
      store,
    );
    expect(store.get("a")?.fullScreen).toBe(false);
    expect(result.current.state.spaces).toEqual(["1"]);
  });

  it("keeps both when two ended Split Views are forgotten in one go", () => {
    const store = storeWith();
    const tiles = {
      "split:a|b": { share: 0.5, frames: { a: FRAME, b: FRAME } },
      "split:c|d": { share: 0.5, frames: { c: FRAME, d: FRAME } },
    };
    const { result } = mount({ ...ONE_SPACE, tiles }, store);
    act(() => {
      result.current.forgetTiles("split:a|b", ["a", "b"]);
      result.current.forgetTiles("split:c|d", ["c"]);
    });
    expect(result.current.state.tiles).toEqual({
      "split:c|d": { share: 0.5, frames: { d: FRAME } },
    });
  });
});
