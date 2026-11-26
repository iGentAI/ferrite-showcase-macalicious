import { describe, expect, it } from "vitest";
import { droppedVideoId, emptyLibrary, LIMITS, queueBefore } from "./tv-youtube-data";

const video = (id: string) => ({ id, title: id, channel: "" });
const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";
const queued = (...ids: string[]) =>
  ids.reduce((library, id) => queueBefore(library, video(id), null), emptyLibrary);

describe("queueBefore", () => {
  it("moves a queued video to just before another", () => {
    expect(queueBefore(queued(A, B, C), video(C), A).upNext).toEqual([C, A, B]);
    expect(queueBefore(queued(A, B, C), video(A), C).upNext).toEqual([B, A, C]);
  });

  it("puts a new video where it is dropped, and remembers it", () => {
    const library = queueBefore(queued(A, B), video(C), B);
    expect(library.upNext).toEqual([A, C, B]);
    expect(library.videos.map((each) => each.id)).toContain(C);
  });

  it("leaves the order alone when a video is dropped on itself", () => {
    expect(queueBefore(queued(A, B), video(A), A).upNext).toEqual([A, B]);
  });

  it("goes last when dropped on the shelf, or before a video no longer queued", () => {
    expect(queueBefore(queued(A, B), video(A), null).upNext).toEqual([B, A]);
    expect(queueBefore(queued(A, B), video(C), "ddddddddddd").upNext).toEqual([A, B, C]);
  });

  it("keeps the dropped video at the limit, whichever end it lands at", () => {
    const full = {
      ...emptyLibrary,
      upNext: Array.from({ length: LIMITS.upNext }, (_, at) => `v${String(at).padStart(10, "0")}`),
    };
    const last = queueBefore(full, video(C), null).upNext;
    expect(last).toHaveLength(LIMITS.upNext);
    expect(last.at(-1)).toBe(C);
    expect(last.at(-2)).toBe(full.upNext.at(-2));
    const first = queueBefore(full, video(C), full.upNext[0] ?? null).upNext;
    expect(first).toHaveLength(LIMITS.upNext);
    expect(first[0]).toBe(C);
    expect(first.at(-1)).toBe(full.upNext.at(-2));
  });
});

describe("droppedVideoId", () => {
  it("reads the first address of a link list, skipping its comments", () => {
    expect(droppedVideoId(`# from a page\r\nhttps://youtu.be/${A}\r\nhttps://x.org/`, "")).toBe(A);
  });

  it("falls back to the plain text", () => {
    expect(droppedVideoId("", `https://www.youtube.com/watch?v=${B}`)).toBe(B);
  });

  it("takes neither eleven letters of text nor another site's address", () => {
    expect(droppedVideoId("", "hello_world")).toBeUndefined();
    expect(droppedVideoId("https://example.com/page", "")).toBeUndefined();
  });
});
