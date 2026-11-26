import { describe, expect, it } from "vitest";
import { droppedFeed, movedInQueue } from "./podcasts-drop";

const a = { id: "a" };
const b = { id: "b" };
const c = { id: "c" };

describe("movedInQueue", () => {
  it("adds a new episode at the end, or before the one it was dropped on", () => {
    expect(movedInQueue([a, b], c, null, 50)).toEqual([a, b, c]);
    expect(movedInQueue([a, b], c, "b", 50)).toEqual([a, c, b]);
  });

  it("moves an episode already queued", () => {
    expect(movedInQueue([a, b, c], c, "a", 50)).toEqual([c, a, b]);
    expect(movedInQueue([a, b, c], a, null, 50)).toEqual([b, c, a]);
    expect(movedInQueue([a, b, c], b, "b", 50)).toEqual([a, b, c]);
  });

  it("leaves a full queue alone, and still moves within it", () => {
    expect(movedInQueue([a, b], c, null, 2)).toEqual([a, b]);
    expect(movedInQueue([a, b], b, "a", 2)).toEqual([b, a]);
  });
});

describe("droppedFeed", () => {
  it("reads the first address of a link list, past its comments", () => {
    expect(droppedFeed("# a title\nhttps://Feeds.NPR.org/500005/podcast.xml\n", "")).toBe(
      "https://feeds.npr.org/500005/podcast.xml",
    );
  });

  it("falls back to the text, reading plain http as https", () => {
    expect(droppedFeed("", "http://feeds.npr.org/1/podcast.xml")).toBe(
      "https://feeds.npr.org/1/podcast.xml",
    );
  });

  it("takes nothing that is not an address", () => {
    expect(droppedFeed("", "some words")).toBeUndefined();
    expect(droppedFeed("", "")).toBeUndefined();
  });
});
