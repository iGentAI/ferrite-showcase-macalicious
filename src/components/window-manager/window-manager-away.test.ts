import { describe, expect, it } from "vitest";
import { createWindowManagerStore } from "./store";

const opened = (...ids: string[]) => {
  const store = createWindowManagerStore();
  for (const id of ids) {
    store.add(
      {
        id,
        app: id,
        title: id,
        panel: false,
        resizable: true,
        minWidth: 100,
        minHeight: 100,
        frame: {},
      },
      () => undefined,
    );
  }
  return store;
};
const keyOf = (store: ReturnType<typeof opened>) =>
  store.list().find(({ state }) => state === "key")?.id;

describe("a window manager at rest", () => {
  it("ends for a lone window when it is cycled to, which is asked to take the focus", () => {
    const store = opened("a");
    store.rest();
    expect(store.focusRequest("a")).toBe(0);
    store.cycle();
    expect(keyOf(store)).toBe("a");
    expect(store.focusRequest("a")).toBe(1);
    store.cycle(true);
    expect(store.focusRequest("a")).toBe(2);
  });

  it("has no key window, and keeps the windows where they are", () => {
    const store = opened("a", "b");
    const order = store.list().map(({ id, z }) => [id, z]);
    store.rest();
    expect(keyOf(store)).toBeUndefined();
    expect(store.list().map(({ id, z }) => [id, z])).toEqual(order);
    expect(store.list().map(({ state }) => state)).toEqual(["inactive", "inactive"]);
  });

  it("ends when a window is raised, opened or cycled to", () => {
    const store = opened("a", "b");
    store.rest();
    store.raise("a");
    expect(keyOf(store)).toBe("a");

    store.rest();
    store.cycle(true);
    expect(keyOf(store)).toBe("b");

    store.rest();
    store.add(
      {
        id: "c",
        app: "c",
        title: "c",
        panel: false,
        resizable: true,
        minWidth: 100,
        minHeight: 100,
        frame: {},
      },
      () => undefined,
    );
    expect(keyOf(store)).toBe("c");
  });

  it("goes on when a window is minimized or changes by itself", () => {
    const store = opened("a", "b");
    store.rest();
    store.patch("a", { title: "new" });
    store.minimize("b");
    expect(keyOf(store)).toBeUndefined();
  });
});

describe("a window that is away", () => {
  it("cannot be key, and the next window takes over", () => {
    const store = opened("a", "b");
    expect(keyOf(store)).toBe("b");
    store.patch("b", { away: true });
    expect(keyOf(store)).toBe("a");
  });

  it("leaves no window key when all are away", () => {
    const store = opened("a");
    store.patch("a", { away: true });
    expect(keyOf(store)).toBeUndefined();
  });

  it("comes back and is key when focused", () => {
    const store = opened("a", "b");
    store.patch("a", { away: true });
    store.focus("a");
    expect(store.get("a")?.away).toBe(false);
    expect(keyOf(store)).toBe("a");
  });

  it.each([
    ["zoom", "zoomed"],
    ["toggleFullScreen", "fullScreen"],
  ] as const)("comes back and is key after %s", (command, flag) => {
    const store = opened("a", "b");
    store.patch("a", { away: true });
    store[command]("a");
    expect(store.get("a")).toMatchObject({ away: false, [flag]: true });
    expect(keyOf(store)).toBe("a");
    expect(store.focusRequest("a")).toBe(1);
  });

  it("is passed over by the next-window command", () => {
    const store = opened("a", "b", "c");
    store.patch("a", { away: true });
    store.cycle();
    expect(keyOf(store)).toBe("b");
    store.cycle();
    expect(keyOf(store)).toBe("c");
  });
});
