import {
  addToPlaylist,
  noRoomInPlaylist,
  queue,
  removeFromHistory,
  removeFromPlaylist,
  removeHomeVideo,
  type TvLibraryState,
  type TvVideo,
  toggleWatchLater,
  unqueue,
} from "./tv-youtube-data";

/**
 * Cards chosen in one list of the window, by Command-click and Shift-click. `list` is `"later"`,
 * `"history"`, `"upNext"`, `"home"` or `"playlist:<id>"`.
 */
export interface TvPicked {
  list: string;
  ids: readonly string[];
  /** The card a Shift-click reaches from. */
  anchor: string;
}

/** The cards chosen after a Command-click on `id`, or a Shift-click with `range`; `order` is the
 * list as shown. */
export function pickedAfter(
  picked: TvPicked | null,
  list: string,
  order: readonly string[],
  id: string,
  range: boolean,
): TvPicked {
  const here = picked?.list === list ? picked : null;
  if (range && here) {
    const from = order.indexOf(here.anchor);
    const to = order.indexOf(id);
    if (from >= 0 && to >= 0) {
      const ids = order.slice(Math.min(from, to), Math.max(from, to) + 1);
      return { list, ids, anchor: here.anchor };
    }
  }
  const held = here?.ids ?? [];
  const ids = held.includes(id) ? held.filter((each) => each !== id) : [...held, id];
  return { list, ids, anchor: id };
}

/** Where the list's Remove row and key take its cards, in the window's words. */
export function removeTitle({ list, ids }: TvPicked, playlistName?: string): string {
  const from =
    list === "later"
      ? "Watch Later"
      : list === "history"
        ? "History"
        : list === "upNext"
          ? "Up Next"
          : list === "home"
            ? "Library"
            : (playlistName ?? "Playlist");
  return `Remove ${ids.length} from ${from}`;
}

/** The library without the chosen cards in their list; each stays known and in its other lists. */
export function removePicked(library: TvLibraryState, { list, ids }: TvPicked): TvLibraryState {
  if (list === "later") {
    return { ...library, watchLater: library.watchLater.filter((each) => !ids.includes(each)) };
  }
  return ids.reduce((now, id) => {
    if (list === "history") return removeFromHistory(now, id);
    if (list === "upNext") return unqueue(now, id);
    if (list === "home") return removeHomeVideo(now, id);
    return removeFromPlaylist(now, list.slice("playlist:".length), id);
  }, library);
}

/** Up Next with the videos in their order, right after what plays now (`"next"`) or last. */
export function queueAll(
  library: TvLibraryState,
  videos: readonly TvVideo[],
  where: "next" | "last",
): TvLibraryState {
  const ordered = where === "next" ? [...videos].reverse() : videos;
  return ordered.reduce((now, video) => queue(now, video, where), library);
}

/** Watch Later with the videos not yet in it. */
export const keepAllForLater = (library: TvLibraryState, videos: readonly TvVideo[]) =>
  videos.reduce(
    (now, video) => (now.watchLater.includes(video.id) ? now : toggleWatchLater(now, video)),
    library,
  );

/** The playlist with as many of the videos as fit, and why the rest did not. */
export function addAllToPlaylist(
  library: TvLibraryState,
  playlist: string,
  videos: readonly TvVideo[],
): { library: TvLibraryState; refusal?: string } {
  let kept = library;
  let refusal: string | undefined;
  for (const video of videos) {
    const refused = noRoomInPlaylist(kept, playlist, video.id);
    if (refused) refusal = refused;
    else kept = addToPlaylist(kept, playlist, video);
  }
  return { library: kept, refusal };
}
