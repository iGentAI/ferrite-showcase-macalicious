import { describe, expect, it, vi } from "vitest";
import {
  clipsOf,
  cutsAfter,
  insertedAfter,
  MAX_CUTS,
  movedTo,
  movieLengthOf,
  storedCuts,
  withCut,
} from "./quicktime-player-clips";

describe("movieLengthOf", () => {
  it("rejects and lets go of the movie when it fails while its length is being found", async () => {
    const video = Object.assign(new EventTarget(), {
      duration: Number.POSITIVE_INFINITY,
      muted: false,
      preload: "",
      currentTime: 0,
      src: "",
      removeAttribute: () => {},
      load: () => {},
    });
    const create = vi.spyOn(document, "createElement").mockReturnValue(video as never);
    const made = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:movie");
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const length = movieLengthOf(new Blob(["movie"]));
    video.dispatchEvent(new Event("loadedmetadata"));
    await Promise.resolve();
    await Promise.resolve();
    video.dispatchEvent(new Event("error"));
    await expect(length).rejects.toThrow("this browser cannot play it");
    expect(revoked).toHaveBeenCalledWith("blob:movie");
    create.mockRestore();
    made.mockRestore();
    revoked.mockRestore();
  });
});

describe("a movie's clips", () => {
  it("is one clip with no cuts", () => {
    expect(clipsOf(10, [])).toEqual([{ start: 0, end: 10 }]);
  });

  it("are the pieces between its cuts, in order", () => {
    expect(clipsOf(10, [2, 7])).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 7 },
      { start: 7, end: 10 },
    ]);
  });

  it("keeps cuts in order whichever came first", () => {
    expect(withCut([7], 2, 10)).toEqual([2, 7]);
  });

  it("has no clip past the end, where a replay came out a little shorter", () => {
    expect(clipsOf(5.9, [2, 6])).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 5.9 },
    ]);
  });

  it("keep their cuts through an edit of the whole movie", () => {
    expect(cutsAfter([2, 7], {})).toEqual([2, 7]);
  });

  it("lose the cuts a trim leaves out, and the rest move with its start", () => {
    expect(cutsAfter([1, 3, 7, 9], { start: 2, end: 8 })).toEqual([1, 5]);
    expect(cutsAfter([2, 8], { start: 2, end: 8 })).toEqual([]);
    const [near] = cutsAfter([2], { start: 1.95, end: 4 });
    expect(near).toBeCloseTo(0.05);
  });

  it("stop at as many splits as are kept", () => {
    const full = Array.from({ length: MAX_CUTS }, (_, n) => n + 1);
    expect(withCut(full, MAX_CUTS + 1, MAX_CUTS + 2)).toBeNull();
  });

  it("are stored to the millisecond, above 0, once each", () => {
    expect(storedCuts([0.0001, 1.23456, 1.2345, 2])).toEqual([1.235, 2]);
  });

  it("refuses a cut at either end or on another cut", () => {
    expect(withCut([], 0, 10)).toBeNull();
    expect(withCut([], 9.95, 10)).toBeNull();
    expect(withCut([4], 4.05, 10)).toBeNull();
  });

  it("go to the gap they are dragged to, counted before the move", () => {
    expect(movedTo(["a", "b", "c"], 0, 3)).toEqual(["b", "c", "a"]);
    expect(movedTo(["a", "b", "c"], 0, 2)).toEqual(["b", "a", "c"]);
    expect(movedTo(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(movedTo(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
  });

  it("take a pasted clip after the one named", () => {
    expect(insertedAfter(["a", "b"], 0, "c")).toEqual(["a", "c", "b"]);
    expect(insertedAfter(["a", "b"], 1, "c")).toEqual(["a", "b", "c"]);
  });
});
