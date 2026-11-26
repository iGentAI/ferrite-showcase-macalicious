/*
 * The text of a real book as the reader holds it, and how it is cut into pages. Nothing here
 * touches the DOM: pagination takes a `fits` test, which the reader answers by measuring a hidden
 * box the size of the page, and the tests answer by counting characters.
 *
 * Every offset counts UTF-16 units of the book's whole text, which is how JavaScript counts a
 * string and how the server counts the parts it serves (`text.rs`). A place, a bookmark and a
 * highlight are offsets, so they name the same words in every browser and at every window size:
 * a page always starts at the place, and only where it ends depends on the window.
 */
import type { BooksHighlight } from "./books-server";

/** How far through its text a place is, as a cover shows it: 1 to 99, and 100 on the last page. */
export function readingPercent(place: number, total: number, atEnd: boolean): number {
  if (atEnd) return 100;
  return Math.min(99, Math.max(1, Math.floor((place / Math.max(1, total)) * 100)));
}

/** A book's text, held part by part as the parts arrive. */
export class BookText {
  private readonly lengths: number[];
  private readonly texts: (string | undefined)[];

  constructor(lengths: readonly number[]) {
    this.lengths = [...lengths];
    this.texts = lengths.map(() => undefined);
  }

  /** The number of parts known. */
  get parts(): number {
    return this.lengths.length;
  }

  /** The length of the text known, in UTF-16 units. */
  get length(): number {
    return this.lengths.reduce((sum, length) => sum + length, 0);
  }

  /** Where part `n` begins. */
  start(n: number): number {
    let at = 0;
    for (let index = 0; index < n && index < this.lengths.length; index += 1) {
      at += this.lengths[index] as number;
    }
    return at;
  }

  /** The part that holds `offset` (the last part for an offset at or past the end). */
  partOf(offset: number): number {
    let at = 0;
    for (let index = 0; index < this.lengths.length; index += 1) {
      at += this.lengths[index] as number;
      if (offset < at) return index;
    }
    return Math.max(0, this.lengths.length - 1);
  }

  /**
   * Keep part `n`'s text if it is as long as announced. One that is not is refused (`false`) and
   * nothing changes: every offset after it would otherwise name other words.
   */
  set(n: number, text: string): boolean {
    if (n < 0 || n >= this.lengths.length || text.length !== this.lengths[n]) return false;
    this.texts[n] = text;
    return true;
  }

  has(n: number): boolean {
    return this.texts[n] !== undefined;
  }

  /** The number of parts held. */
  get heldParts(): number {
    return this.texts.filter((text) => text !== undefined).length;
  }

  /** The parts not yet held that `[from, to)` needs. */
  missing(from: number, to: number): number[] {
    if (this.lengths.length === 0) return [];
    const first = this.partOf(Math.max(0, from));
    const last = this.partOf(Math.max(from, to - 1));
    const out: number[] = [];
    for (let n = first; n <= last; n += 1) if (!this.has(n)) out.push(n);
    return out;
  }

  /**
   * The text held of `[from, to)`, clamped to the text known; it stops at the first part not
   * held, so ask `missing` first when the whole range matters.
   */
  slice(from: number, to: number): string {
    const end = Math.min(to, this.length);
    let out = "";
    let at = 0;
    for (let n = 0; n < this.lengths.length && at < end; n += 1) {
      const length = this.lengths[n] as number;
      const next = at + length;
      if (next > from) {
        const text = this.texts[n];
        if (text === undefined) break;
        out += text.slice(Math.max(0, from - at), Math.min(length, end - at));
      }
      at = next;
    }
    return out;
  }

  /** The end of the text held without a gap from `from` onwards. */
  heldFrom(from: number): number {
    let n = this.partOf(from);
    if (!this.has(n)) return from;
    while (n + 1 < this.lengths.length && this.has(n + 1)) n += 1;
    return this.start(n + 1);
  }

  /** The start of the text held without a gap up to `to`. */
  heldTo(to: number): number {
    let n = this.partOf(Math.max(0, to - 1));
    if (!this.has(n)) return to;
    while (n > 0 && this.has(n - 1)) n -= 1;
    return this.start(n);
  }
}

const SPACE = /\s/;

/** `end` moved back to just after the last white space between `start` and it, when that is in
 * the second half of the page; otherwise `end` as it is (one long word). */
export function snapEnd(text: string, start: number, end: number): number {
  if (end >= text.length) return end;
  for (let at = end; at > start + (end - start) / 2; at -= 1) {
    if (SPACE.test(text[at - 1] as string)) return at;
  }
  return end;
}

/** `start` moved forward to the beginning of the next word, unless it begins one already. */
export function snapStart(text: string, start: number, end: number): number {
  if (start <= 0 || SPACE.test(text[start - 1] as string)) return start;
  for (let at = start; at < end; at += 1) {
    if (SPACE.test(text[at] as string)) return skipSpace(text, at, end);
  }
  return start;
}

/** The first offset from `at` that is not white space (or `end`). */
export function skipSpace(text: string, at: number, end: number = text.length): number {
  let next = at;
  while (next < end && SPACE.test(text[next] as string)) next += 1;
  return next;
}

/** How many characters at the end of `before` belong to the word that runs on past it. */
export function wordStart(before: string): number {
  return /\S*$/.exec(before)?.[0].length ?? 0;
}

/** The first step of the search for a page's length, in characters. */
const STEP = 512;

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;
/** Whether `at` falls between the two halves of a surrogate pair of `text`. */
const splitsPair = (text: string, at: number) =>
  at > 0 && at < text.length && isLow(text.charCodeAt(at)) && isHigh(text.charCodeAt(at - 1));

/**
 * `offset` moved back to the start of the character it falls inside (between the two halves of
 * a surrogate pair), once the text there is held; otherwise `offset` as it is.
 */
export function characterStart(text: BookText, offset: number): number {
  if (offset <= 0) return offset;
  return splitsPair(text.slice(offset - 1, offset + 1), 1) ? offset - 1 : offset;
}

/**
 * Where the page that starts at `start` ends: the most of `text` (a slice of the book) that
 * `fits` takes, ending after a word. `limit` is the end of the text held. A page holds at least
 * one character, so a box too small for any still turns; it never ends inside a surrogate pair.
 */
export function pageEnd(
  text: string,
  start: number,
  limit: number,
  fits: (slice: string) => boolean,
): number {
  const end = Math.min(limit, text.length);
  if (start >= end) return end;
  let good = start;
  let bad = -1;
  for (let step = STEP; ; step *= 2) {
    const at = Math.min(end, start + step);
    if (fits(text.slice(start, at))) {
      good = at;
      if (at === end) break;
    } else {
      bad = at;
      break;
    }
  }
  if (bad >= 0) {
    let low = good;
    let high = bad;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (fits(text.slice(start, middle))) low = middle;
      else high = middle;
    }
    good = low;
  }
  if (splitsPair(text, good)) good -= 1;
  if (good <= start) return Math.min(end, start + (splitsPair(text, start + 1) ? 2 : 1));
  return good === end ? end : snapEnd(text, start, good);
}

/**
 * Where the page that ends at `end` starts, turning back: the least offset not below `floor`
 * whose text up to `end` `fits`, moved to the start of a word, never inside a surrogate pair.
 */
export function pageStart(
  text: string,
  end: number,
  floor: number,
  fits: (slice: string) => boolean,
): number {
  const bottom = Math.max(0, floor);
  if (end <= bottom) return bottom;
  let good = end;
  let bad = -1;
  for (let step = STEP; ; step *= 2) {
    const at = Math.max(bottom, end - step);
    if (fits(text.slice(at, end))) {
      good = at;
      if (at === bottom) break;
    } else {
      bad = at;
      break;
    }
  }
  if (bad >= 0) {
    let low = bad;
    let high = good;
    while (high - low > 1) {
      const middle = Math.ceil((low + high) / 2);
      if (fits(text.slice(middle, end))) high = middle;
      else low = middle;
    }
    good = high;
  }
  if (splitsPair(text, good)) good += 1;
  if (good >= end) return Math.max(bottom, end - (splitsPair(text, end - 1) ? 2 : 1));
  if (good === bottom) return bottom;
  // Moved to the start of a word, but never to the end itself (a page of only white space
  // would snap past it), so turning back always moves back.
  const snapped = snapStart(text, good, end);
  return snapped < end ? snapped : good;
}

/** A run of a page's text, highlighted or not. */
export interface TextRun {
  from: number;
  to: number;
  highlight?: BooksHighlight;
}

/**
 * The page `[start, end)` cut into runs by the highlights that cover it. Where highlights
 * overlap, the one made last (the later in the list) shows.
 */
export function runsOf(
  start: number,
  end: number,
  highlights: readonly BooksHighlight[],
): TextRun[] {
  const covering = highlights.filter((h) => h.end > start && h.start < end);
  const cuts = new Set([start, end]);
  for (const h of covering) {
    cuts.add(Math.max(start, h.start));
    cuts.add(Math.min(end, h.end));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const runs: TextRun[] = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index] as number;
    const to = points[index + 1] as number;
    let highlight: BooksHighlight | undefined;
    for (const h of covering) if (h.start <= from && h.end >= to) highlight = h;
    const last = runs.at(-1);
    if (last && last.highlight === highlight) last.to = to;
    else runs.push({ from, to, ...(highlight ? { highlight } : {}) });
  }
  return runs;
}

/** A picture's place in the text: all a layout needs of it. */
export interface PlacedPicture {
  at: number;
}

/**
 * A stretch of a text: plain words, words set off, or one of the underscores that set them off in
 * a Project Gutenberg text. The underscores are part of the text every offset counts, so a page
 * keeps them, hidden.
 */
export interface EmphasisPiece {
  from: number;
  to: number;
  kind: "plain" | "em" | "mark";
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const SPACE_OR_NOTHING = /^\s?$/;

/** `text` as one plain piece. */
export const plainPiece = (text: string): EmphasisPiece[] =>
  text === "" ? [] : [{ from: 0, to: text.length, kind: "plain" }];

/**
 * `text` cut into its pieces. An underscore opens after a non-word and before a word and closes the
 * other way round, so `snake_case` and a rule of underscores stay as they are. A page can begin or
 * end inside an emphasis: a closing mark with none before it sets off the text from the page's
 * start, and an opening one with no end sets it off to the end of its paragraph or of the page.
 */
export function emphasisPieces(text: string): EmphasisPiece[] {
  if (!text.includes("_")) return plainPiece(text);
  const pieces: EmphasisPiece[] = [];
  const add = (from: number, to: number, kind: EmphasisPiece["kind"]) => {
    if (to > from) pieces.push({ from, to, kind });
  };
  let done = 0;
  let open = -1;
  const endOpen = (before: number) => {
    if (open < 0) return;
    const paragraph = text.indexOf("\n\n", open);
    if (paragraph < 0 || paragraph >= before) return;
    add(open, paragraph, "em");
    done = paragraph;
    open = -1;
  };
  for (let at = text.indexOf("_"); at >= 0; at = text.indexOf("_", at + 1)) {
    const before = text[at - 1] ?? "";
    const after = text[at + 1] ?? "";
    if (before === "_" || after === "_") continue;
    endOpen(at);
    const opens = !SPACE_OR_NOTHING.test(after) && !WORD_CHARACTER.test(before);
    const closes = !SPACE_OR_NOTHING.test(before) && !WORD_CHARACTER.test(after);
    if (open >= 0 && closes) {
      add(open, at, "em");
      add(at, at + 1, "mark");
      done = at + 1;
      open = -1;
    } else if (open < 0 && opens) {
      add(done, at, "plain");
      add(at, at + 1, "mark");
      done = at + 1;
      open = at + 1;
    } else if (open < 0 && closes && done === 0 && !text.slice(0, at).includes("\n\n")) {
      add(0, at, "em");
      add(at, at + 1, "mark");
      done = at + 1;
    }
  }
  endOpen(text.length);
  if (open >= 0) add(open, text.length, "em");
  else add(done, text.length, "plain");
  return pieces;
}

/** The parts of `pieces` within `[from, to)`. */
export function piecesIn(
  pieces: readonly EmphasisPiece[],
  from: number,
  to: number,
): EmphasisPiece[] {
  return pieces.flatMap((piece) =>
    piece.to > from && piece.from < to
      ? [{ ...piece, from: Math.max(from, piece.from), to: Math.min(to, piece.to) }]
      : [],
  );
}

/**
 * `findAll` as a person reads `text`: a phrase is found across the underscores that set a word off.
 * Each place is an offset into `text` itself.
 */
export function findAllRead(text: string, query: string, max: number): number[] {
  const kept = emphasisPieces(text).filter((piece) => piece.kind !== "mark");
  const found = findAll(kept.map((piece) => text.slice(piece.from, piece.to)).join(""), query, max);
  let piece = 0;
  let before = 0;
  return found.map((at) => {
    for (let run = kept[piece]; run && at >= before + (run.to - run.from); run = kept[piece]) {
      before += run.to - run.from;
      piece += 1;
    }
    return at - before + (kept[piece]?.from ?? 0);
  });
}

/** `text` as it reads, with no underscores that set words off. */
export const withoutMarks = (text: string): string =>
  emphasisPieces(text)
    .filter((piece) => piece.kind !== "mark")
    .map((piece) => text.slice(piece.from, piece.to))
    .join("");

/**
 * The pictures a page or view of `[start, end)` shows: those at its offsets, so the page that starts
 * at a picture's offset shows it and the page that ends there does not. `total` is the end of the
 * text, where a picture after all the text is on the last page.
 */
export function picturesIn<T extends PlacedPicture>(
  pictures: readonly T[],
  start: number,
  end: number,
  total: number,
): T[] {
  return pictures.filter(({ at }) => at >= start && (at < end || (at === end && end === total)));
}

/** What a page shows, in order: runs of text and the pictures between them. */
export type PagePart<T> = (TextRun & { picture?: undefined }) | { picture: T; from: number };

/** The runs of a page (`runsOf`) with its `pictures`, cut where a picture stands in one. */
export function pageParts<T extends PlacedPicture>(
  runs: readonly TextRun[],
  pictures: readonly T[],
): PagePart<T>[] {
  const parts: PagePart<T>[] = [];
  let next = 0;
  for (const run of runs) {
    let from = run.from;
    for (; next < pictures.length && (pictures[next] as T).at < run.to; next += 1) {
      const picture = pictures[next] as T;
      if (picture.at > from) {
        parts.push({ ...run, from, to: picture.at });
        from = picture.at;
      }
      parts.push({ picture, from });
    }
    if (from < run.to) parts.push({ ...run, from });
  }
  for (; next < pictures.length; next += 1) {
    const picture = pictures[next] as T;
    parts.push({ picture, from: picture.at });
  }
  return parts;
}

/** The most of the page's height several pictures at one offset take, and one on a very short page. */
const PICTURE_SHARE = 0.7;
/** The tallest picture that sits in its line, as an ornament does: a taller one stands alone. */
const INLINE_PICTURE_HEIGHT = 32;

/**
 * The size a picture of `natural` pixels is drawn at on a page of `room`, one of `sharing` pictures
 * at one offset: never larger than it is, and no larger than the page takes. A picture alone at its
 * offset may fill the page but for `room.reserve`, the room of the words a page has to hold so that
 * its end is past its start. An unmeasured page (`room` of 0) leaves it as it is.
 */
export function pictureSize(
  natural: { width: number; height: number },
  room: { width: number; height: number; reserve: number },
  sharing = 1,
): { width: number; height: number; inline: boolean } {
  const across = room.width > 0 ? room.width / natural.width : 1;
  const share = room.height * PICTURE_SHARE;
  const tallest = sharing === 1 ? Math.max(share, room.height - room.reserve) : share / sharing;
  const down = room.height > 0 ? tallest / natural.height : 1;
  const scale = Math.min(1, across, down);
  const height = Math.floor(natural.height * scale);
  return {
    width: Math.floor(natural.width * scale),
    height,
    inline: height <= INLINE_PICTURE_HEIGHT,
  };
}

const escapedForPrint = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A picture as the printed page takes it: its bytes as a data address, its size in pixels. */
export interface PrintedPicture extends PlacedPicture {
  src: string;
  width: number;
}

/** The HTML that prints `words`, which start at offset `from`, with `pictures` where they stand. */
export function printedPage(
  words: string,
  from: number,
  pictures: readonly PrintedPicture[],
  pieces: readonly EmphasisPiece[] = plainPiece(words),
): string {
  const printed = (start: number, end: number) =>
    piecesIn(pieces, start, end)
      .map((piece) => {
        if (piece.kind === "mark") return "";
        const shown = escapedForPrint(words.slice(piece.from, piece.to));
        return piece.kind === "em" ? `<em>${shown}</em>` : shown;
      })
      .join("");
  let html = "";
  let done = 0;
  for (const { at, src, width } of pictures) {
    const upTo = Math.min(words.length, Math.max(done, at - from));
    html += printed(done, upTo);
    done = upTo;
    html += `<img src="${escapedForPrint(src)}" alt="" style="display:block;width:${width}px;max-width:100%;max-height:9in;object-fit:contain;break-inside:avoid">`;
  }
  return html + printed(done, words.length);
}

/** `text` cut to at most `max` UTF-16 units, never between the two halves of a surrogate pair. */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const last = text.charCodeAt(max - 1);
  return text.slice(0, max > 0 && last >= 0xd800 && last <= 0xdbff ? max - 1 : max);
}

/** `text` on one line, cut to `max` characters with an ellipsis. */
export function excerpt(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  return `${cut(line, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * The page number and the number of pages, from the offset of the page and the length of the
 * page shown: a reflowing text has no fixed pages, so both are counted in pages of this length.
 */
export function pageNumbers(
  offset: number,
  total: number,
  perPage: number,
): { page: number; pages: number } {
  const size = Math.max(1, perPage);
  const pages = Math.max(1, Math.ceil(total / size));
  return { page: Math.min(pages, Math.floor(offset / size) + 1), pages };
}

/** The chapter heading a place is under: the last heading at or before it. */
export function headingAt<T extends { at: number }>(toc: readonly T[], offset: number): T | null {
  let found: T | null = null;
  for (const heading of toc)
    if (heading.at <= offset && (!found || heading.at >= found.at)) found = heading;
  return found;
}

/**
 * `text` in lower case, one UTF-16 unit for one, so an offset into it is the same offset into `text`.
 * The dotted capital I, the only character whose lower case is longer ("i" and a combining dot),
 * folds to "i"; final sigma (ς), which `toLowerCase` gives a capital sigma at the end of a word,
 * folds to σ.
 */
function fold(text: string): string {
  return text
    .replace(/\u0130/g, "i")
    .toLowerCase()
    .replace(/\u03c2/g, "\u03c3");
}

/** Every place `query` occurs in `text`, whatever its case, at most `max`. */
export function findAll(text: string, query: string, max: number): number[] {
  const haystack = fold(text);
  // A query typed as "i" and a combining dot asks for a dotted I, which the text folds to "i".
  const needle = fold(query.trim()).replace(/i\u0307/g, "i");
  if (needle === "") return [];
  const out: number[] = [];
  for (let at = haystack.indexOf(needle); at >= 0 && out.length < max; ) {
    out.push(at);
    at = haystack.indexOf(needle, at + needle.length);
  }
  return out;
}
