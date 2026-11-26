import type { MusicLibraryState } from "./music-server";

/**
 * Undo and Redo of Music's library: a step is the library before and after one change of the
 * person's, and taking it back applies only what that change did to the library as it is now, so
 * a song imported, or a change saved in another window, since then stays.
 */
export interface LibraryStep {
  before: MusicLibraryState;
  after: MusicLibraryState;
}

/** `now` with those of `ids` it holds as songs in Loved Songs. An id it does not hold (a song deleted
 * since it was copied or dragged) is left out: the server refuses a list naming one. */
export function withLoved(now: MusicLibraryState, ids: readonly string[]): MusicLibraryState {
  const held = new Set(now.songs.map((song) => song.id));
  return {
    ...now,
    loved: [...now.loved, ...ids.filter((id) => held.has(id) && !now.loved.includes(id))],
  };
}

/** `now` with those of `ids` it holds as songs in the playlist `target`, as `withLoved` does. */
export function withInPlaylist(
  now: MusicLibraryState,
  ids: readonly string[],
  target: string,
): MusicLibraryState {
  const held = new Set(now.songs.map((song) => song.id));
  return {
    ...now,
    playlists: now.playlists.map((list) =>
      list.id === target
        ? {
            ...list,
            songs: [...list.songs, ...ids.filter((id) => held.has(id) && !list.songs.includes(id))],
          }
        : list,
    ),
  };
}

/** `to`'s records that `from` and `now` do not have, after `now`. */
const withNew = <T extends { id: string }>(
  kept: readonly T[],
  from: readonly T[],
  to: readonly T[],
) => {
  const have = new Set(kept.map((item) => item.id));
  const before = new Set(from.map((item) => item.id));
  return [...kept, ...to.filter((item) => !before.has(item.id) && !have.has(item.id))];
};

type Playlist = MusicLibraryState["playlists"][number];
type Folder = NonNullable<MusicLibraryState["folders"]>[number];

/** `songs` with `id` beside its neighbour in `order`: after the song before it, else before the
 * song after it, else at the end. */
function placed(songs: readonly string[], id: string, order: readonly string[]): string[] {
  const at = order.indexOf(id);
  for (let back = at - 1; back >= 0; back -= 1) {
    const found = songs.indexOf(order[back] as string);
    if (found >= 0) return [...songs.slice(0, found + 1), id, ...songs.slice(found + 1)];
  }
  for (let on = at + 1; on < order.length; on += 1) {
    const found = songs.indexOf(order[on] as string);
    if (found >= 0) return [...songs.slice(0, found), id, ...songs.slice(found)];
  }
  return [...songs, id];
}

/**
 * A playlist as it stands, with what going from `was` to `becomes` changed: its name if that
 * changed, and the songs that left or joined, so a song another window added meanwhile stays and
 * the songs that stay keep the order they have now. A change that itself put songs in another
 * order puts them in that order, when the playlist still holds just its songs.
 */
function changedPlaylist(now: Playlist, was: Playlist, becomes: Playlist): Playlist {
  const left = was.songs.filter((id) => !becomes.songs.includes(id));
  const joined = becomes.songs.filter((id) => !was.songs.includes(id));
  const name = was.name === becomes.name ? now.name : becomes.name;
  const folder = (was.folder ?? null) === (becomes.folder ?? null) ? now.folder : becomes.folder;
  const smart =
    JSON.stringify(was.smart ?? null) === JSON.stringify(becomes.smart ?? null)
      ? now.smart
      : becomes.smart;
  const merged = joined
    .filter((id) => !now.songs.includes(id))
    .reduce(
      (songs, id) => placed(songs, id, becomes.songs),
      now.songs.filter((id) => !left.includes(id)),
    );
  const reordered =
    was.songs.filter((id) => becomes.songs.includes(id)).join() !==
    becomes.songs.filter((id) => was.songs.includes(id)).join();
  const same =
    reordered &&
    merged.length === becomes.songs.length &&
    merged.every((id) => becomes.songs.includes(id));
  const songs = same ? becomes.songs : merged;
  return name === now.name &&
    songs.join() === now.songs.join() &&
    (folder ?? null) === (now.folder ?? null) &&
    smart === now.smart
    ? now
    : { ...now, name, songs, folder, smart };
}

/**
 * The playlists as they stand, with the change from `from` to `to`. A playlist the change made goes
 * when the change is taken back, unless another window has changed it since: it then stays with what
 * that window gave it, and making it again puts this change's songs back.
 */
function changedPlaylists(
  now: readonly Playlist[],
  from: readonly Playlist[],
  to: readonly Playlist[],
) {
  const before = new Map(from.map((list) => [list.id, list]));
  const after = new Map(to.map((list) => [list.id, list]));
  const kept = now.flatMap((list) => {
    const was = before.get(list.id);
    const becomes = after.get(list.id);
    if (was && becomes) return [changedPlaylist(list, was, becomes)];
    if (was) {
      if (was.name === list.name && was.songs.join() === list.songs.join()) return [];
      return [changedPlaylist(list, was, { ...was, songs: [] })];
    }
    return [becomes ? changedPlaylist(list, { ...becomes, songs: [] }, becomes) : list];
  });
  return withNew(kept, from, to);
}

/**
 * The folders as they stand, with the change from `from` to `to`; one left in no known folder, or
 * inside itself because two windows moved folders into each other, goes to the top of the list.
 */
function changedFolders(now: readonly Folder[], from: readonly Folder[], to: readonly Folder[]) {
  const before = new Map(from.map((folder) => [folder.id, folder]));
  const after = new Map(to.map((folder) => [folder.id, folder]));
  const kept = now.flatMap((folder) => {
    const was = before.get(folder.id);
    const becomes = after.get(folder.id);
    if (!was) return [folder];
    if (!becomes) return [];
    return [
      {
        ...folder,
        name: was.name === becomes.name ? folder.name : becomes.name,
        parent: (was.parent ?? null) === (becomes.parent ?? null) ? folder.parent : becomes.parent,
      },
    ];
  });
  const folders = withNew(kept, from, to);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const loops = (folder: Folder) => {
    const seen = new Set([folder.id]);
    for (let up = folder.parent; up; up = byId.get(up)?.parent) {
      if (seen.has(up)) return true;
      seen.add(up);
    }
    return false;
  };
  return folders.map((folder) =>
    folder.parent && (!byId.has(folder.parent) || loops(folder))
      ? { ...folder, parent: null }
      : folder,
  );
}

/**
 * `now` with what going from `from` to `to` changed. A song the change added goes when it is taken
 * back, unless a playlist or Loved still names it; a song the result does not have leaves its
 * playlists and Loved, which the server would refuse.
 */
export function applyLibraryChange(
  now: MusicLibraryState,
  from: MusicLibraryState,
  to: MusicLibraryState,
): MusicLibraryState {
  const playlists = changedPlaylists(now.playlists, from.playlists, to.playlists);
  const leaving = new Set(from.loved.filter((id) => !to.loved.includes(id)));
  const loved = [
    ...now.loved.filter((id) => !leaving.has(id)),
    ...to.loved.filter((id) => !from.loved.includes(id) && !now.loved.includes(id)),
  ];
  const named = new Set([...loved, ...playlists.flatMap((list) => list.songs)]);
  const before = new Map(from.songs.map((song) => [song.id, song]));
  const after = new Map(to.songs.map((song) => [song.id, song]));
  const songs = withNew(
    now.songs.flatMap((song) => {
      const was = before.get(song.id);
      const becomes = after.get(song.id);
      if (was && !becomes) return named.has(song.id) ? [song] : [];
      return [was && becomes && JSON.stringify(was) !== JSON.stringify(becomes) ? becomes : song];
    }),
    from.songs,
    to.songs,
  );
  const known = new Set(songs.map((song) => song.id));
  const folders = changedFolders(now.folders ?? [], from.folders ?? [], to.folders ?? []);
  const folderIds = new Set(folders.map((folder) => folder.id));
  return {
    songs,
    playlists: playlists.map((list) => {
      const held = list.folder && !folderIds.has(list.folder) ? { ...list, folder: null } : list;
      return held.songs.every((id) => known.has(id))
        ? held
        : { ...held, songs: held.songs.filter((id) => known.has(id)) };
    }),
    loved: loved.filter((id) => known.has(id)),
    ...(folders.length > 0 ? { folders } : {}),
  };
}
