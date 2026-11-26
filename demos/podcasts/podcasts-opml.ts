"use client";

import {
  ensureDrive,
  SPECIAL_FOLDER_IDS,
  specialFolder,
  uploadFile,
} from "../desktop/desktop-files";
import { feedAddress } from "./podcasts-add-show";

const escaped = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The shows as an OPML subscription list, which other podcast apps read. */
export function opmlOf(shows: readonly { title: string; feed: string }[]): string {
  const rows = shows.map(
    ({ title, feed }) =>
      `    <outline type="rss" text="${escaped(title)}" title="${escaped(title)}" xmlUrl="${escaped(feed)}"/>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head><title>Podcasts</title></head>",
    "  <body>",
    ...rows,
    "  </body>",
    "</opml>",
    "",
  ].join("\n");
}

/** The feeds an OPML file lists, each once and in the form the module reads, folders included. */
export function feedsOfOpml(text: string): string[] {
  const parsed = new DOMParser().parseFromString(text, "text/xml");
  if (parsed.querySelector("parsererror") || parsed.documentElement.localName !== "opml") return [];
  const feeds = [...parsed.querySelectorAll("outline")].flatMap((outline) => {
    const address = outline.getAttribute("xmlUrl") ?? outline.getAttribute("xmlurl");
    return address?.trim() ? [feedAddress(address)] : [];
  });
  return [...new Set(feeds)];
}

/**
 * `shows` with the `added` it does not already follow, in order, as far as `limit` allows. Reads the
 * list as it stands, so a show followed meanwhile counts against the limit and is not added twice.
 */
export function showsWith<T extends { id: string; feed: string }>(
  shows: readonly T[],
  added: readonly T[],
  limit: number,
): readonly T[] {
  const result = [...shows];
  for (const show of added) {
    if (result.length >= limit) break;
    const followed = result.some(
      (each) => each.id === show.id || feedAddress(each.feed) === feedAddress(show.feed),
    );
    if (!followed) result.push(show);
  }
  return result;
}

/** Saves the list in the person's Downloads folder, under a free name; throws what went wrong. */
export async function saveOpml(text: string): Promise<string> {
  const drive = await ensureDrive();
  const folder = specialFolder(drive, "Downloads")?.id ?? SPECIAL_FOLDER_IDS.Downloads;
  const entry = await uploadFile(new Blob([text], { type: "text/x-opml" }), folder, {
    name: "Podcasts Subscriptions.opml",
    existing: "rename",
  });
  return entry.name;
}
