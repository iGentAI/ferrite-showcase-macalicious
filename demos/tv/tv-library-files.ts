"use client";

import {
  ensureDrive,
  SPECIAL_FOLDER_IDS,
  specialFolder,
  uploadFile,
} from "../desktop/desktop-files";
import { type TvVideo, watchUrl, youTubeVideoId } from "./tv-youtube-data";

/*
 * TV's files: a playlist as an M3U list of YouTube links, and the library as the property list
 * File > Library > Export Library writes.
 */

const FILE_NAME_UNSAFE = /[/\\:*?"<>|]/g;

/** Those of `videos` a search for `words` shows; all of them when it is empty. */
export const homeVideosMatching = <T extends { title: string }>(
  videos: readonly T[],
  words: string,
): readonly T[] => {
  const needle = words.toLowerCase();
  return videos.filter(({ title }) => title.toLowerCase().includes(needle));
};

/** The file name for a playlist called `name`. */
export const playlistFileName = (name: string) =>
  `${name.replace(FILE_NAME_UNSAFE, "-").trim() || "Untitled"}.m3u`;

/** The playlist's name a file gives: its name without its extension. */
export const playlistNameOfFile = (fileName: string) =>
  fileName.replace(/\.[^.]*$/, "") || fileName;

export const isPlaylistFile = (fileName: string) => /\.m3u8?$/i.test(fileName);

/** The videos as an extended M3U, each by its title and its YouTube link. */
export function writePlaylist(videos: readonly TvVideo[]): string {
  const lines = ["#EXTM3U"];
  for (const { id, title } of videos) {
    lines.push(`#EXTINF:-1,${title.replace(/\s+/g, " ").trim()}`, watchUrl(id));
  }
  return `${lines.join("\n")}\n`;
}

/** The videos an M3U links, each once, and how many of its entries are not YouTube's. */
export function readPlaylist(text: string): { videos: TvVideo[]; others: number } {
  const videos: TvVideo[] = [];
  let others = 0;
  let title = "";
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("#")) {
      title = /^#EXTINF:[^,]*,(.*)$/.exec(line)?.[1]?.trim() ?? title;
      continue;
    }
    const id = youTubeVideoId(line);
    if (!id) others += 1;
    else if (!videos.some((video) => video.id === id)) {
      videos.push({ id, title: title || "YouTube video", channel: "" });
    }
    title = "";
  }
  return { videos, others };
}

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** What Export Library lists, every video by its title. */
export interface TvLibraryExport {
  homeVideos: readonly string[];
  watchLater: readonly TvVideo[];
  upNext: readonly TvVideo[];
  history: readonly TvVideo[];
  playlists: readonly { name: string; videos: readonly TvVideo[] }[];
}

const videoEntry = ({ title, id }: TvVideo) =>
  `<dict><key>Name</key><string>${escapeXml(title)}</string><key>Location</key><string>${escapeXml(watchUrl(id))}</string></dict>`;
const videoArray = (key: string, videos: readonly TvVideo[]) =>
  `<key>${key}</key><array>${videos.map(videoEntry).join("")}</array>`;

/** The library as a property list. */
export function writeLibrary(library: TvLibraryExport): string {
  const homeVideos = library.homeVideos.map((name) => `<string>${escapeXml(name)}</string>`);
  const playlists = library.playlists.map(
    ({ name, videos }) =>
      `<dict><key>Name</key><string>${escapeXml(name)}</string>${videoArray("Playlist Items", videos)}</dict>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    `<key>Home Videos</key><array>${homeVideos.join("")}</array>`,
    videoArray("Watch Later", library.watchLater),
    videoArray("Up Next", library.upNext),
    videoArray("History", library.history),
    `<key>Playlists</key><array>${playlists.join("")}</array>`,
    "</dict></plist>",
    "",
  ].join("\n");
}

/** Saves `text` in the person's Downloads folder, under a free name; answers that name. */
export async function saveInDownloads(text: string, name: string, type: string): Promise<string> {
  const drive = await ensureDrive();
  const folder = specialFolder(drive, "Downloads")?.id ?? SPECIAL_FOLDER_IDS.Downloads;
  const entry = await uploadFile(new Blob([text], { type }), folder, { name, existing: "rename" });
  return entry.name;
}
