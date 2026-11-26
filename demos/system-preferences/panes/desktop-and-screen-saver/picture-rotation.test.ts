import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeDesktopValue,
  connectDesktopValues,
  desktopValues,
  receiveDesktopValues,
  takePictureChoice,
} from "../../../desktop/desktop-personal";
import {
  CHANGE_KEY,
  CHANGED_AT_KEY,
  followPictureChanges,
  INTERVAL_KEY,
  nextPicture,
  SOURCE_KEY,
} from "./picture-rotation";
import { PICTURE_KEY } from "./pictures";

const library = vi.hoisted(() => ({
  load: (): Promise<unknown> => Promise.resolve({ photos: [] }),
}));
vi.mock("../../../photos/photos-library", () => ({ loadLibrary: () => library.load() }));

const FIVE_MINUTES = {
  [CHANGE_KEY]: true,
  [INTERVAL_KEY]: "Every 5 minutes",
  [PICTURE_KEY]: "mountains",
};
const MINUTE = 60_000;

describe("nextPicture", () => {
  const list = ["a", "b", "c"];

  it("goes on in order, around the end, and starts at the first for a picture of elsewhere", () => {
    expect(nextPicture(list, "a", false)).toBe("b");
    expect(nextPicture(list, "c", false)).toBe("a");
    expect(nextPicture(list, "elsewhere", false)).toBe("a");
  });

  it("picks at random among the others, never the one shown", () => {
    expect(nextPicture(list, "a", true, () => 0)).toBe("b");
    expect(nextPicture(list, "a", true, () => 0.99)).toBe("c");
  });

  it("has nothing to change to when the list holds no other picture", () => {
    expect(nextPicture([], "a", false)).toBeNull();
    expect(nextPicture(["a"], "a", true)).toBeNull();
  });
});

describe("followPictureChanges", () => {
  afterEach(() => vi.useRealTimers());

  /** The desktop's values connected and stored, as a session of the desktop has them. */
  function session(values: Readonly<Record<string, unknown>>) {
    vi.useFakeTimers();
    const disconnect = connectDesktopValues(() => {});
    const shown: string[] = [];
    receiveDesktopValues(values);
    const follow = () => followPictureChanges((picture) => shown.push(picture));
    follow();
    return { shown, disconnect, reload: follow };
  }

  it("counts on across a reload", async () => {
    const { shown, reload, disconnect } = session(FIVE_MINUTES);
    const started = desktopValues()[CHANGED_AT_KEY];
    expect(started).toBe(Date.now());
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    reload();
    expect(desktopValues()[CHANGED_AT_KEY]).toBe(started);
    await vi.advanceTimersByTimeAsync(3 * MINUTE - 1);
    expect(shown).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual(["sunlit-coast"]);
    disconnect();
  });

  it("starts the count again when Change picture is turned on again, also across a reload", async () => {
    const { shown, reload, disconnect } = session(FIVE_MINUTES);
    await vi.advanceTimersByTimeAsync(4 * MINUTE);
    changeDesktopValue(CHANGE_KEY, false);
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(shown).toEqual([]);
    changeDesktopValue(CHANGE_KEY, true);
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    reload();
    await vi.advanceTimersByTimeAsync(3 * MINUTE - 1);
    expect(shown).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual(["sunlit-coast"]);
    disconnect();
  });

  it("starts the count again when the person chooses a picture", async () => {
    const { shown, reload, disconnect } = session(FIVE_MINUTES);
    await vi.advanceTimersByTimeAsync(4 * MINUTE);
    changeDesktopValue(PICTURE_KEY, "green-bay");
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    reload();
    await vi.advanceTimersByTimeAsync(3 * MINUTE - 1);
    expect(shown).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual(["dark-clouds"]);
    disconnect();
  });

  it("lets a picture the person chooses while the source is read stand", async () => {
    const photos = [
      { mime: "image/png", hidden: false, deleted_ms: null, added_ms: 1, file: "f", name: "F" },
    ];
    let answer: (value: unknown) => void = () => {};
    library.load = () =>
      new Promise((resolve) => {
        answer = resolve;
      });
    const { shown, disconnect } = session({ ...FIVE_MINUTES, [SOURCE_KEY]: "photos" });
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    // A choice of the picture already shown: nothing changes in the settings but the count.
    takePictureChoice();
    await vi.advanceTimersByTimeAsync(MINUTE);
    answer({ photos });
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual([]);
    expect(desktopValues()[CHANGED_AT_KEY]).toBe(Date.now() - 1);
    // It goes on: 5 minutes from the answer, it changes.
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    answer({ photos });
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual(["drive:f"]);
    disconnect();
  });

  it("counts from turning it on again, when it was turned off while the source was read", async () => {
    const photos = [
      { mime: "image/png", hidden: false, deleted_ms: null, added_ms: 1, file: "f", name: "F" },
    ];
    let answer: (value: unknown) => void = () => {};
    library.load = () =>
      new Promise((resolve) => {
        answer = resolve;
      });
    const { shown, disconnect } = session({ ...FIVE_MINUTES, [SOURCE_KEY]: "photos" });
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    changeDesktopValue(CHANGE_KEY, false);
    await vi.advanceTimersByTimeAsync(MINUTE);
    changeDesktopValue(CHANGE_KEY, true);
    answer({ photos });
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual([]);
    await vi.advanceTimersByTimeAsync(5 * MINUTE - 2);
    expect(shown).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    answer({ photos });
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual(["drive:f"]);
    disconnect();
  });

  it("changes a still at its interval, and not a dynamic one", async () => {
    const { shown, disconnect } = session({
      [CHANGE_KEY]: true,
      [INTERVAL_KEY]: "Every 5 seconds",
      [PICTURE_KEY]: "mountains",
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(shown).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(shown).toEqual(["sunlit-coast"]);

    receiveDesktopValues({
      [CHANGE_KEY]: true,
      [INTERVAL_KEY]: "Every 5 seconds",
      [PICTURE_KEY]: "mojave",
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(shown).toEqual(["sunlit-coast"]);
    disconnect();
  });
});
