/*
 * What Preview keeps with the person's desktop values (`desktop-personal.ts`): how the sidebar and
 * the markup tools were left, what its Preferences say, and the bookmarks of PDFs.
 */

import {
  type ArrowEnds,
  isMarkFont,
  MARKUP_ALIGNMENTS,
  MARKUP_ARROW_ENDS,
  MARKUP_DASHES,
  MARKUP_STROKES,
  MARKUP_TEXT_SIZES,
  type MarkAlign,
  type MarkDash,
  type MarkFont,
} from "./preview-markup";

export const PREVIEW_SETTINGS = {
  sidebar: "preview.sidebar",
  sidebarWidth: "preview.sidebarWidth",
  color: "preview.color",
  fill: "preview.fill",
  stroke: "preview.stroke",
  textSize: "preview.textSize",
  dash: "preview.dash",
  shadow: "preview.shadow",
  arrowEnds: "preview.arrowEnds",
  font: "preview.font",
  align: "preview.align",
  bold: "preview.bold",
  italic: "preview.italic",
  underline: "preview.underline",
  hiddenTools: "preview.hiddenTools",
  spellingWhileTyping: "preview.spellingWhileTyping",
  imageBackground: "preview.imageBackground",
  pdfBackground: "preview.pdfBackground",
  imageScale: "preview.imageScale",
  pdfScale: "preview.pdfScale",
  bookmarks: "preview.bookmarks",
} as const;

export type SidebarChoice = "hidden" | "thumbnails" | "contents" | "notes" | "bookmarks";
const SIDEBAR_CHOICES: readonly SidebarChoice[] = [
  "hidden",
  "thumbnails",
  "contents",
  "notes",
  "bookmarks",
];

export const readSidebar = (stored: unknown): SidebarChoice | undefined =>
  SIDEBAR_CHOICES.find((choice) => choice === stored);

export const readSidebarWidth = (stored: unknown): number | undefined =>
  typeof stored === "number" && stored >= 150 && stored <= 320 ? stored : undefined;

const HEX = /^#[0-9a-f]{6}$/i;
export const readColor = (stored: unknown): string | undefined =>
  typeof stored === "string" && HEX.test(stored) ? stored : undefined;
/** A colour, or `"none"` for no fill. */
export const readFill = (stored: unknown): string | undefined =>
  stored === "none" ? "none" : readColor(stored);
export const readStroke = (stored: unknown): number | undefined =>
  MARKUP_STROKES.find((entry) => entry.value === stored)?.value;
export const readTextSize = (stored: unknown): number | undefined =>
  MARKUP_TEXT_SIZES.find((entry) => entry.value === stored)?.value;

/** A line's style, or `"solid"`. */
export const readDash = (stored: unknown): MarkDash | "solid" | undefined =>
  MARKUP_DASHES.find((entry) => entry.value === stored)?.value;
export const readShadow = (stored: unknown): boolean | undefined =>
  typeof stored === "boolean" ? stored : undefined;
/** Which ends the next line has, or `"tool"`: what the tool drawing it has of its own. */
export const readArrowEnds = (stored: unknown): ArrowEnds | "tool" | undefined =>
  stored === "tool" ? "tool" : MARKUP_ARROW_ENDS.find((entry) => entry.value === stored)?.value;
/** A font, or `"system"`. */
export const readFont = (stored: unknown): MarkFont | "system" | undefined =>
  stored === "system" ? "system" : isMarkFont(stored) ? stored : undefined;
export const readAlign = (stored: unknown): MarkAlign | undefined =>
  MARKUP_ALIGNMENTS.find((entry) => entry.value === stored)?.value;

/**
 * What a Preferences pane calls 100%: one pixel or point of the document to one on the screen, or
 * the size it would have on paper.
 */
export type ScaleChoice = "pixel" | "paper";
export const readScale = (stored: unknown): ScaleChoice | undefined =>
  stored === "pixel" || stored === "paper" ? stored : undefined;
/** How many of the screen's points one point on paper takes: a screen has 96 to the inch. */
export const PAPER_ZOOM = 96 / 72;

/** A page of a PDF kept to go back to, by the file's own page, so it follows the page when moved. */
export interface Bookmark {
  file: string;
  page: number;
}

/** The most kept: a setting holds 4096 bytes, and a file's id takes at most 64 of them. */
export const MAX_BOOKMARKS = 40;

export function readBookmarks(stored: unknown): readonly Bookmark[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.filter(
    (each): each is Bookmark =>
      typeof each?.file === "string" && Number.isInteger(each?.page) && each.page >= 1,
  );
}

/** `list` with `page` of `file` bookmarked or, when it was, no longer; `null` when it is full. */
export function toggledBookmark(
  list: readonly Bookmark[],
  file: string,
  page: number,
): readonly Bookmark[] | null {
  if (list.some((each) => each.file === file && each.page === page)) {
    return list.filter((each) => each.file !== file || each.page !== page);
  }
  return list.length >= MAX_BOOKMARKS ? null : [...list, { file, page }];
}

/**
 * The pages of `file` that are bookmarked, as they are numbered now in the window, in that order.
 * A page taken out of the order is left out; `order` names the file's page each one shows.
 */
export function bookmarkedPages(
  list: readonly Bookmark[],
  file: string,
  order: readonly number[] | undefined,
  count: number,
): number[] {
  return list
    .filter((each) => each.file === file)
    .map((each) => (order ? order.indexOf(each.page) + 1 : each.page))
    .filter((page) => page >= 1 && page <= count)
    .sort((a, b) => a - b);
}
