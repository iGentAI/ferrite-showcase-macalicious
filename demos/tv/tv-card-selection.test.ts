import { describe, expect, it } from "vitest";
import {
  addAllToPlaylist,
  keepAllForLater,
  pickedAfter,
  queueAll,
  removePicked,
  removeTitle,
} from "./tv-card-selection";
import { addPlaylist, emptyLibrary, know, LIMITS, type TvVideo } from "./tv-youtube-data";

const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";
const D = "ddddddddddd";
const video = (id: string): TvVideo => ({ id, title: `Title ${id}`, channel: "" });
const order = [A, B, C, D];
const stocked = [A, B, C].reduce((now, id) => know(now, video(id)), emptyLibrary);

describe("choosing cards", () => {
  it("adds and takes a card out with Command-click", () => {
    const one = pickedAfter(null, "later", order, B, false);
    expect(one.ids).toEqual([B]);
    const two = pickedAfter(one, "later", order, D, false);
    expect(two.ids).toEqual([B, D]);
    expect(pickedAfter(two, "later", order, B, false).ids).toEqual([D]);
  });

  it("chooses the cards between the last one and a Shift-click, either way", () => {
    const from = pickedAfter(null, "later", order, C, false);
    expect(pickedAfter(from, "later", order, A, true).ids).toEqual([A, B, C]);
    expect(pickedAfter(from, "later", order, D, true).ids).toEqual([C, D]);
  });

  it("starts again when a card of another list is chosen", () => {
    const later = pickedAfter(null, "later", order, A, false);
    expect(pickedAfter(later, "history", [B, C], C, true).ids).toEqual([C]);
  });
});

describe("acting on chosen cards", () => {
  const picked = (list: string, ids: string[]) => ({ list, ids, anchor: ids[0] as string });

  it("removes them from their own list and leaves them in the others", () => {
    const library = {
      ...stocked,
      watchLater: [A, B, C],
      upNext: [A, B],
      history: [
        { id: A, at: 1 },
        { id: B, at: 2 },
      ],
    };
    const after = removePicked(library, picked("later", [A, C]));
    expect(after.watchLater).toEqual([B]);
    expect(after.upNext).toEqual([A, B]);
    expect(after.history.map(({ id }) => id)).toEqual([A, B]);
    expect(removePicked(library, picked("history", [A])).history.map(({ id }) => id)).toEqual([B]);
    expect(removePicked(library, picked("upNext", [B])).upNext).toEqual([A]);
  });

  it("removes them from a playlist and from Home Videos", () => {
    const listed = addPlaylist(stocked, "pl-a", "Evening", [video(A), video(B)]);
    expect(removePicked(listed, picked("playlist:pl-a", [A])).playlists[0]?.videos).toEqual([B]);
    const home = {
      ...stocked,
      homeVideos: [
        { id: "f1", place: 0 },
        { id: "f2", place: 3 },
      ],
    };
    expect(removePicked(home, picked("home", ["f1"])).homeVideos).toEqual([{ id: "f2", place: 3 }]);
  });

  it("says where Remove takes them", () => {
    expect(removeTitle(picked("later", [A, B]))).toBe("Remove 2 from Watch Later");
    expect(removeTitle(picked("playlist:pl-a", [A, B, C]), "Evening")).toBe(
      "Remove 3 from Evening",
    );
  });

  it("queues them in the order shown, next or last", () => {
    const queued = { ...stocked, upNext: [C] };
    const videos = [video(A), video(B)];
    expect(queueAll(queued, videos, "next").upNext).toEqual([A, B, C]);
    expect(queueAll(queued, videos, "last").upNext).toEqual([C, A, B]);
  });

  it("keeps for later only those not kept yet", () => {
    const kept = keepAllForLater({ ...stocked, watchLater: [A] }, [video(A), video(B)]);
    expect([...kept.watchLater].sort()).toEqual([A, B]);
  });

  it("adds what fits to a playlist and says why the rest did not", () => {
    const nearlyFull = {
      ...addPlaylist(stocked, "pl-a", "Evening"),
    };
    const room = LIMITS.playlistVideos - 1;
    const filled = {
      ...nearlyFull,
      playlists: [
        {
          id: "pl-a",
          name: "Evening",
          videos: Array.from({ length: room }, () => A),
        },
      ],
    };
    const { library, refusal } = addAllToPlaylist(filled, "pl-a", [video(B), video(C)]);
    expect(library.playlists[0]?.videos).toHaveLength(LIMITS.playlistVideos);
    expect(library.playlists[0]?.videos.at(-1)).toBe(B);
    expect(refusal).toBe("“Evening” holds 200 videos, the most a playlist keeps.");
  });
});
