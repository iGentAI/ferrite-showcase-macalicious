/*
 * Preview's markup, as its module of the `macalicious-desktop` Ferrite application keeps it for each
 * file of the person's drive (`ferrite-apps/desktop/src/apps/preview`), and the geometry that puts
 * it, and the page under it, on a canvas.
 *
 * Everything is kept in page space: fractions of the page (or picture) as the file has it, 0 at the
 * left or top edge and 1 at the right or bottom edge, before any crop or rotation. What the window
 * shows is a view of that page: a crop (a rectangle of page space, the whole page for a PDF) turned
 * by quarter turns clockwise. The same transform draws the screen and an exported copy, and its
 * inverse turns a pointer on the screen into page space, so a mark drawn on a turned or cropped
 * picture stays on the spot it was drawn on. Every function here but the drawing is pure.
 */

import type { PdfTextRun } from "./preview-export";

export const PREVIEW_MARKUP_URL = "/api/preview/markup";
export const PREVIEW_SIGNATURES_URL = "/api/preview/signatures";

export type MarkKind =
  | "rect"
  | "oval"
  | "mask"
  | "loupe"
  | "line"
  | "arrow"
  | "sketch"
  | "text"
  | "signature"
  | TextMarkKind
  | "note";
/** A mark laid on a PDF's text: on the lines it covers, not on a box drawn by hand. */
export type TextMarkKind = "highlight" | "underline" | "strikethrough";
export type Point = [number, number];
/** A box `[x, y, w, h]` of page space, as a mark on text keeps each of its lines. */
export type LineBox = [number, number, number, number];
/** How a line is broken up; absent is solid. */
export type MarkDash = "dashed" | "dotted";
/** Which ends of a line have a head. */
export type ArrowEnds = "none" | "start" | "end" | "both";
/** A font a text may be set in, by family name; absent is the system's. */
export type MarkFont = string;
/** How a text's lines stand in its box; absent is left. */
export type MarkAlign = "left" | "center" | "right";

/** One mark on a page; the module's documentation describes each kind. */
export interface Mark {
  id: string;
  kind: MarkKind;
  /** `#rrggbb`. */
  color: string;
  /** `#rrggbb`, for a filled box. */
  fill?: string;
  /** The width of the line, as a fraction of the page's width. */
  stroke: number;
  x: number;
  y: number;
  w: number;
  h: number;
  points?: Point[];
  strokes?: Point[][];
  /** The lines a mark on text covers; `x`, `y`, `w`, `h` are then the box around them all. */
  rects?: LineBox[];
  /** What a text or a note says, or the words a mark on text covers. */
  text?: string;
  /** The text's size, as a fraction of the page's width. */
  size?: number;
  /**
   * The quarter turns the view had when the text was typed; absent is none. The text is drawn
   * turned back by this much, so it reads upright in that view, and `w`, `h` are its box in page
   * space, negative where that view's right or down runs against the page's.
   */
  turns?: Turns;
  /**
   * The view showed the page mirrored when the text was typed: it is drawn mirrored back, so it
   * reads rightly in that view, and `w` runs against the page's width.
   */
  mirrored?: true;
  dash?: MarkDash;
  shadow?: true;
  /** Absent: an arrow's far end, and none on a line. */
  arrow_ends?: ArrowEnds;
  font?: MarkFont;
  align?: MarkAlign;
  bold?: true;
  italic?: true;
  underline?: true;
  /** How many sides a polygon has: its corners can be moved, and this many can be asked for. */
  sides?: number;
  /** A loupe's magnification; absent is `LOUPE_POWER`. */
  power?: number;
  /** A sketch that is a speech bubble: `text` is what it says, drawn inside it and moved with it. */
  bubble?: true;
}

export interface PageMarks {
  /** From 1; a picture is page 1. */
  page: number;
  items: Mark[];
}

export type Turns = 0 | 1 | 2 | 3;

/** One file's markup: its marks, the quarter turns a PDF is viewed at, and its pages' order. */
export interface Markup {
  rotation: Turns;
  pages: PageMarks[];
  /**
   * For each page shown, the file's page it draws (from 1), or 0 for a blank page; absent is the
   * file's own pages in their own order. `pages` go by the page shown.
   */
  order?: number[];
  /** For each page shown, the quarter turns it stands at beyond `rotation`; absent is none. */
  turns?: number[];
  /** The words the Inspector's Keywords tab lists for the file, kept beside it. */
  keywords?: string[];
}

/** A signature: strokes as fractions of a box `aspect` times as wide as it is high. */
export interface Signature {
  id: string;
  aspect: number;
  strokes: Point[][];
}

/** A rectangle of page space. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the window shows of a page: a crop of it, mirrored left to right if asked, turned clockwise. */
export interface View {
  crop: Rect;
  turns: Turns;
  mirrored?: boolean;
  /** Outlines in page space it is also cut to: what an elliptical or lasso selection kept. */
  clips?: readonly (readonly Point[])[];
}

export const WHOLE_PAGE: Rect = { x: 0, y: 0, w: 1, h: 1 };
export const EMPTY_MARKUP: Markup = { rotation: 0, pages: [] };

/** The limits the server holds markup to. */
export const MARKUP_LIMITS = {
  marks: 500,
  points: 4000,
  totalPoints: 20_000,
  strokes: 64,
  rects: 256,
  text: 2000,
  signatures: 10,
  keywords: 100,
  keyword: 100,
} as const;

/** The colours of the markup bar, as Preview's palette names them. */
export const MARKUP_COLORS: readonly { name: string; value: string }[] = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#ff3b30" },
  { name: "Orange", value: "#ff9500" },
  { name: "Yellow", value: "#ffcc00" },
  { name: "Green", value: "#28cd41" },
  { name: "Blue", value: "#007aff" },
  { name: "Purple", value: "#af52de" },
  { name: "White", value: "#ffffff" },
];

/** The colours of Preview's Highlight menu (the `--mac-preview-highlight-*` tokens). */
export const HIGHLIGHT_COLORS: readonly { name: string; value: string }[] = [
  { name: "Yellow", value: "#fbe04d" },
  { name: "Green", value: "#b1d832" },
  { name: "Blue", value: "#8fc7f7" },
  { name: "Pink", value: "#f7a6c8" },
  { name: "Purple", value: "#cdb0f2" },
];

/** The colour of an underline and a strikethrough, and of a note. */
export const TEXT_LINE_COLOR = "#ff3b30";
export const NOTE_COLOR = "#fbe04d";

/** How a mark on text is made next: its kind, and the colour it takes. */
export interface TextMarkStyle {
  kind: TextMarkKind;
  color: string;
}

export const isTextMark = (mark: Pick<Mark, "kind">): boolean =>
  mark.kind === "highlight" || mark.kind === "underline" || mark.kind === "strikethrough";

/** Whether a mark is listed in the Highlights and Notes sidebar. */
export const isAnnotation = (mark: Pick<Mark, "kind">): boolean =>
  isTextMark(mark) || mark.kind === "note";

/** The line widths of the markup bar, as fractions of the page's width. */
export const MARKUP_STROKES: readonly { name: string; value: number }[] = [
  { name: "Thin", value: 0.002 },
  { name: "Medium", value: 0.004 },
  { name: "Thick", value: 0.008 },
];

/** The line styles of the markup bar. */
export const MARKUP_DASHES: readonly { name: string; value: MarkDash | "solid" }[] = [
  { name: "Solid", value: "solid" },
  { name: "Dashed", value: "dashed" },
  { name: "Dotted", value: "dotted" },
];

/** The arrow ends of the markup bar. */
export const MARKUP_ARROW_ENDS: readonly { name: string; value: ArrowEnds }[] = [
  { name: "No Arrows", value: "none" },
  { name: "Arrow at End", value: "end" },
  { name: "Arrow at Start", value: "start" },
  { name: "Arrows at Both Ends", value: "both" },
];

/** The fonts of the markup bar's own rows, with what a browser draws each in. */
export const MARKUP_FONTS: readonly { name: MarkFont; stack: string }[] = [
  { name: "Helvetica", stack: "Helvetica, Arial, sans-serif" },
  { name: "Times", stack: 'Times, "Times New Roman", serif' },
  { name: "Courier", stack: 'Courier, "Courier New", monospace' },
  { name: "Georgia", stack: "Georgia, serif" },
  { name: "Verdana", stack: "Verdana, sans-serif" },
];

/** Whether a value can name a font family: the desktop's server keeps it by the same rule. */
export const isMarkFont = (value: unknown): value is MarkFont =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9 .'-]{0,63}$/.test(value);

/** The alignments of the markup bar. */
export const MARKUP_ALIGNMENTS: readonly { name: string; value: MarkAlign }[] = [
  { name: "Align Left", value: "left" },
  { name: "Align Center", value: "center" },
  { name: "Align Right", value: "right" },
];

/** The text sizes of the markup bar, as fractions of the page's width. */
export const MARKUP_TEXT_SIZES: readonly { name: string; value: number }[] = [
  { name: "Small", value: 0.02 },
  { name: "Medium", value: 0.03 },
  { name: "Large", value: 0.045 },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) && value.length === 2 && isNumber(value[0]) && isNumber(value[1]);
const isLineBox = (value: unknown): value is LineBox =>
  Array.isArray(value) && value.length === 4 && value.every(isNumber);
const KINDS: readonly MarkKind[] = [
  "rect",
  "oval",
  "mask",
  "loupe",
  "line",
  "arrow",
  "sketch",
  "text",
  "signature",
  "highlight",
  "underline",
  "strikethrough",
  "note",
];

function isMark(value: unknown): value is Mark {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    KINDS.includes(value.kind as MarkKind) &&
    typeof value.color === "string" &&
    (value.fill === undefined || typeof value.fill === "string") &&
    isNumber(value.stroke) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.w) &&
    isNumber(value.h) &&
    (value.points === undefined || (Array.isArray(value.points) && value.points.every(isPoint))) &&
    (value.strokes === undefined ||
      (Array.isArray(value.strokes) &&
        value.strokes.every((stroke) => Array.isArray(stroke) && stroke.every(isPoint)))) &&
    (value.rects === undefined || (Array.isArray(value.rects) && value.rects.every(isLineBox))) &&
    (value.text === undefined || typeof value.text === "string") &&
    (value.size === undefined || isNumber(value.size)) &&
    (value.turns === undefined || [1, 2, 3].includes(value.turns as number)) &&
    (value.mirrored === undefined || value.mirrored === true) &&
    (value.dash === undefined || value.dash === "dashed" || value.dash === "dotted") &&
    (value.shadow === undefined || value.shadow === true) &&
    (value.arrow_ends === undefined ||
      MARKUP_ARROW_ENDS.some((each) => each.value === value.arrow_ends)) &&
    (value.font === undefined || isMarkFont(value.font)) &&
    (value.align === undefined || MARKUP_ALIGNMENTS.some((each) => each.value === value.align)) &&
    (value.bold === undefined || value.bold === true) &&
    (value.italic === undefined || value.italic === true) &&
    (value.underline === undefined || value.underline === true) &&
    (value.bubble === undefined || value.bubble === true) &&
    (value.sides === undefined || isNumber(value.sides)) &&
    (value.power === undefined || isNumber(value.power))
  );
}

/** Whether a `GET` reply is markup the window can read: markup, or `null` before the first save. */
export function markupReadable(reply: unknown): boolean {
  if (!isRecord(reply)) return false;
  const markup = reply.markup;
  if (markup === null) return true;
  return (
    isRecord(markup) &&
    [0, 1, 2, 3].includes(markup.rotation as number) &&
    Array.isArray(markup.pages) &&
    (markup.order === undefined ||
      (Array.isArray(markup.order) &&
        markup.order.length > 0 &&
        markup.order.every((source) => Number.isInteger(source) && source >= 0))) &&
    (markup.turns === undefined ||
      (Array.isArray(markup.turns) &&
        markup.turns.every((turn) => [0, 1, 2, 3].includes(turn as number)))) &&
    (markup.keywords === undefined ||
      (Array.isArray(markup.keywords) &&
        markup.keywords.every((word) => typeof word === "string"))) &&
    markup.pages.every(
      (page) =>
        isRecord(page) &&
        Number.isInteger(page.page) &&
        Array.isArray(page.items) &&
        page.items.every(isMark),
    )
  );
}

/** The markup of a `GET` reply; empty when the file has none yet. */
export function markupFromServer(reply: unknown): Markup | undefined {
  if (!markupReadable(reply)) return undefined;
  return (reply as { markup: Markup | null }).markup ?? EMPTY_MARKUP;
}

/** The `PUT` body. */
export const markupToServer = (markup: Markup) => ({ markup });

/** Whether a `GET` reply holds signatures the window can read. */
export function signaturesReadable(reply: unknown): boolean {
  if (!isRecord(reply)) return false;
  const list = reply.signatures;
  return (
    list === null ||
    (Array.isArray(list) &&
      list.every(
        (signature) =>
          isRecord(signature) &&
          typeof signature.id === "string" &&
          isNumber(signature.aspect) &&
          Array.isArray(signature.strokes) &&
          signature.strokes.every((stroke) => Array.isArray(stroke) && stroke.every(isPoint)),
      ))
  );
}

export function signaturesFromServer(reply: unknown): Signature[] | undefined {
  if (!signaturesReadable(reply)) return undefined;
  return (reply as { signatures: Signature[] | null }).signatures ?? [];
}

export const signaturesToServer = (signatures: readonly Signature[]) => ({
  signatures: [...signatures],
});

/** The marks of `page`. */
export const marksOf = (markup: Markup, page: number): Mark[] =>
  markup.pages.find((entry) => entry.page === page)?.items ?? [];

/** `markup` with the marks of `page` replaced; a page left without marks is dropped. */
export function withMarks(markup: Markup, page: number, items: readonly Mark[]): Markup {
  const others = markup.pages.filter((entry) => entry.page !== page);
  const pages = items.length > 0 ? [...others, { page, items: [...items] }] : others;
  pages.sort((a, b) => a.page - b.page);
  return { ...markup, pages };
}

/**
 * The order a PDF of `fileCount` pages is shown in: the `order` of its markup, unless that names a
 * page past the file's last (the file is another's, or was replaced), when the file's own stands.
 */
export const heldOrder = (order: number[] | undefined, fileCount: number): number[] | undefined =>
  order?.every((source) => source <= fileCount) ? order : undefined;

/**
 * `markup` with a PDF of `fileCount` pages laid out anew: `next` names, in their new order, the pages
 * as they are numbered now, and 0 a new blank page. Each page's marks go with it, and a page left out
 * loses them. The file's own order is kept as no `order` at all.
 */
export function rearranged(markup: Markup, fileCount: number, next: readonly number[]): Markup {
  const held = heldOrder(markup.order, fileCount);
  const order = next.map((page) => (page === 0 ? 0 : (held?.[page - 1] ?? page)));
  const pages = next.flatMap((page, index) => {
    const items = page === 0 ? [] : marksOf(markup, page);
    return items.length > 0 ? [{ page: index + 1, items }] : [];
  });
  const own = order.length === fileCount && order.every((source, index) => source === index + 1);
  const { order: _before, turns: before, ...rest } = markup;
  const turns = keptTurns(next.map((page) => (page === 0 ? 0 : (before?.[page - 1] ?? 0))));
  return {
    ...rest,
    pages,
    ...(own ? {} : { order }),
    ...(turns ? { turns } : {}),
  };
}

/** Turns as a file keeps them: none at all when no page stands turned. */
const keptTurns = (turns: readonly number[]): number[] | undefined =>
  turns.some((turn) => turn !== 0) ? [...turns] : undefined;

/** The quarter turns page `number` stands at in a PDF's markup. */
export const pageTurns = (markup: Pick<Markup, "rotation" | "turns">, number: number): Turns =>
  ((markup.rotation + (markup.turns?.[number - 1] ?? 0)) % 4) as Turns;

/** `markup` with `pages` of a PDF of `count` pages shown turned once more, each by `by`. */
export function withPagesTurned(
  markup: Markup,
  count: number,
  pages: readonly number[],
  by: 1 | -1,
): Markup {
  const { turns: before, ...rest } = markup;
  const turns = keptTurns(
    Array.from({ length: count }, (_, index) => {
      const now = before?.[index] ?? 0;
      return pages.includes(index + 1) ? (now + by + 4) % 4 : now;
    }),
  );
  return turns ? { ...rest, turns } : rest;
}

/** How many marks `markup` holds on all its pages. */
export const markCount = (markup: Markup): number =>
  markup.pages.reduce((sum, entry) => sum + entry.items.length, 0);

/**
 * `markup` as it stands on a file written with `count` new pages after page `after`, in the order
 * the window shows: the pages past them are renumbered, and the file needs no `order` of its own.
 */
export function afterInsertion(markup: Markup, after: number, count: number): Markup {
  const { order: _written, turns: before, ...rest } = markup;
  const turns =
    before &&
    keptTurns([
      ...before.slice(0, after),
      ...Array.from({ length: count }, () => 0),
      ...before.slice(after),
    ]);
  return {
    ...rest,
    pages: markup.pages.map((entry) =>
      entry.page > after ? { ...entry, page: entry.page + count } : entry,
    ),
    ...(turns ? { turns } : {}),
  };
}

const pointsIn = (mark: Mark) =>
  (mark.points?.length ?? 0) +
  (mark.strokes?.reduce((sum, s) => sum + s.length, 0) ?? 0) +
  (mark.rects?.length ?? 0);

/** Whether `markup` is within the limits the server keeps. */
export function withinLimits(markup: Markup): boolean {
  let points = 0;
  for (const entry of markup.pages) for (const mark of entry.items) points += pointsIn(mark);
  return markCount(markup) <= MARKUP_LIMITS.marks && points <= MARKUP_LIMITS.totalPoints;
}

let counter = 0;
/** A fresh id for a mark or a signature. */
export function newMarkId(prefix = "m"): string {
  counter += 1;
  const random = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${random}`;
}

/** A number kept to six places, as the page needs no more and the body stays small. */
export const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** Keeps a point within the range the server takes: a page's width outside the page at most. */
export const clampPoint = ([x, y]: Point): Point => [
  round6(Math.min(2, Math.max(-1, x))),
  round6(Math.min(2, Math.max(-1, y))),
];

/**
 * Drops points of a free line that are closer than `tolerance` to the last one kept, so that a
 * long stroke stays within the server's limit; the first and last points are kept.
 */
export function thinPoints(points: readonly Point[], tolerance = 0.002): Point[] {
  if (points.length <= 2) return points.map(clampPoint);
  const kept: Point[] = [points[0] as Point];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index] as Point;
    const last = kept[kept.length - 1] as Point;
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= tolerance) kept.push(point);
  }
  kept.push(points[points.length - 1] as Point);
  // Evenly within the server's limit, first and last points included.
  return sampleStroke(kept, MARKUP_LIMITS.points).map(clampPoint);
}

/* The view transform. */

/** One quarter turn clockwise of a point in a unit square, and back. */
const turnOnce = ([u, v]: Point): Point => [1 - v, u];
const unturnOnce = ([u, v]: Point): Point => [v, 1 - u];

/** Page space to view space: fractions of what the window shows. */
export function toView(point: Point, view: View): Point {
  const { crop } = view;
  let p: Point = [(point[0] - crop.x) / crop.w, (point[1] - crop.y) / crop.h];
  if (view.mirrored) p = [1 - p[0], p[1]];
  for (let turn = 0; turn < view.turns; turn += 1) p = turnOnce(p);
  return p;
}

/** View space back to page space. */
export function fromView(point: Point, view: View): Point {
  let p = point;
  for (let turn = 0; turn < view.turns; turn += 1) p = unturnOnce(p);
  if (view.mirrored) p = [1 - p[0], p[1]];
  const { crop } = view;
  return [crop.x + p[0] * crop.w, crop.y + p[1] * crop.h];
}

/** The size of what the window shows, for a page of `width` × `height`. */
export function viewSize(
  width: number,
  height: number,
  view: View,
): { width: number; height: number } {
  const w = width * view.crop.w;
  const h = height * view.crop.h;
  return view.turns % 2 === 0 ? { width: w, height: h } : { width: h, height: w };
}

/** The rectangle of page space between two points of view space. */
export function rectFromView(a: Point, b: Point, view: View): Rect {
  const p = fromView(a, view);
  const q = fromView(b, view);
  return {
    x: Math.min(p[0], q[0]),
    y: Math.min(p[1], q[1]),
    w: Math.abs(p[0] - q[0]),
    h: Math.abs(p[1] - q[1]),
  };
}

/** `rect` cut to the page and to `within`; `null` when nothing is left. */
export function intersect(rect: Rect, within: Rect = WHOLE_PAGE): Rect | null {
  const x = Math.max(rect.x, within.x, 0);
  const y = Math.max(rect.y, within.y, 0);
  const right = Math.min(rect.x + rect.w, within.x + within.w, 1);
  const bottom = Math.min(rect.y + rect.h, within.y + within.h, 1);
  return right - x > 1e-4 && bottom - y > 1e-4 ? { x, y, w: right - x, h: bottom - y } : null;
}

/** The view after one more quarter turn, clockwise (`by` 1) or anticlockwise (`by` -1). */
export const turned = (turns: Turns, by: 1 | -1): Turns => ((turns + by + 4) % 4) as Turns;

/**
 * The turns and mirror of a view flipped as the window shows it. A view is the page mirrored, then
 * turned: flipping what is shown undoes the turn's direction and toggles the mirror, and a vertical
 * flip is a horizontal one with a half turn more.
 */
export function flipped(
  view: { turns: Turns; mirrored?: boolean },
  axis: "horizontal" | "vertical",
): { turns: Turns; mirrored: boolean } {
  const half = axis === "vertical" ? 2 : 0;
  return { turns: ((half - view.turns + 4) % 4) as Turns, mirrored: !view.mirrored };
}

/**
 * Sets `context` so that drawing in page pixels (a page of `width` × `height`) lands where the
 * view shows it on a canvas of `out.width` × `out.height`, clipped to the crop.
 */
export function applyView(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: View,
  out: { width: number; height: number },
) {
  const shown = viewSize(width, height, view);
  const scale = out.width / shown.width;
  const { crop } = view;
  context.translate(out.width / 2, out.height / 2);
  context.rotate((view.turns * Math.PI) / 2);
  context.scale(scale, scale);
  if (view.mirrored) context.scale(-1, 1);
  context.translate(-(crop.x + crop.w / 2) * width, -(crop.y + crop.h / 2) * height);
  context.beginPath();
  context.rect(crop.x * width, crop.y * height, crop.w * width, crop.h * height);
  context.clip();
  for (const clip of view.clips ?? []) {
    context.beginPath();
    for (const [x, y] of clip) context.lineTo(x * width, y * height);
    context.closePath();
    context.clip();
  }
}

/** The oval inscribed in `rect`, as an outline a view can be cut to. */
export function ovalOutline(rect: Rect, count = 96): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return [
      round6(rect.x + (rect.w / 2) * (1 + Math.cos(angle))),
      round6(rect.y + (rect.h / 2) * (1 + Math.sin(angle))),
    ];
  });
}

/** The box around an outline. */
export function outlineBox(points: readonly Point[]): Rect {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/* Drawing. */

/** The font of text marks: the system's, as Preview's default. */
export const MARK_FONT =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
export const LINE_HEIGHT = 1.2;

/** How much a loupe magnifies the page under it. */
export const LOUPE_POWER = 2;
export const LOUPE_POWER_RANGE = [1, 5] as const;
/** How few and how many sides a polygon's handle asks for. */
export const POLYGON_SIDES = [3, 12] as const;
/** How far outside a mask the page is dimmed. */
const MASK_DIM = "rgba(0, 0, 0, 0.5)";

/** The CSS family list of a font: a family of the Fonts panel falls back on the system's. */
export function markFontStack(font: MarkFont | undefined): string {
  if (!font || !isMarkFont(font)) return MARK_FONT;
  return MARKUP_FONTS.find((each) => each.name === font)?.stack ?? `"${font}", ${MARK_FONT}`;
}

/** What the typing box shows a text in: a font's stack, or what is around it for the system's. */
export const typingFont = (font: MarkFont | "system" | undefined) =>
  font && font !== "system" ? markFontStack(font) : "inherit";

/** The font a text is drawn in, at `px`, bold and italic as its style says. */
export function markFont(
  font: MarkFont | undefined,
  px: number,
  style: Pick<Mark, "bold" | "italic"> = {},
): string {
  const stack = markFontStack(font);
  return `${style.italic ? "italic " : ""}${style.bold ? "bold " : ""}${px}px ${stack}`;
}

/** A line under `line` of a text drawn at `start` by the context's alignment, its top at `top`. */
function underlineText(
  context: CanvasRenderingContext2D,
  line: string,
  start: number,
  top: number,
  size: number,
) {
  const across = context.measureText(line).width;
  const left =
    context.textAlign === "center"
      ? start - across / 2
      : context.textAlign === "right"
        ? start - across
        : start;
  context.fillRect(left, top + size * 1.02, across, Math.max(size * 0.06, 0.5));
}

/** `text` broken at its spaces so that no line is wider than `room`, as the context measures it. */
function wrapped(context: CanvasRenderingContext2D, text: string, room: number): string[] {
  return text.split("\n").flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.split(" ")) {
      const longer = line ? `${line} ${word}` : word;
      if (line && context.measureText(longer).width > room) {
        lines.push(line);
        line = word;
      } else line = longer;
    }
    lines.push(line);
    return lines;
  });
}

/** The share of a speech bubble's height that is its body, above its tail. */
export const BUBBLE_BODY = 0.78;

/** What a speech bubble says, centred in its body, wrapped to it, upright in the view it was typed in. */
function drawBubbleText(
  context: CanvasRenderingContext2D,
  mark: Mark,
  width: number,
  height: number,
) {
  const box = boundsOf(mark);
  const size = (mark.size ?? 0.03) * width;
  const turns = mark.turns ?? 0;
  const wide = box.w * width;
  const high = box.h * height * BUBBLE_BODY;
  const room = (turns % 2 === 0 ? wide : high) * 0.86;
  context.shadowColor = "transparent";
  context.fillStyle = mark.color;
  context.font = markFont(mark.font, size, mark);
  context.textBaseline = "top";
  context.textAlign = mark.align ?? "center";
  context.save();
  context.translate((box.x + box.w / 2) * width, box.y * height + high / 2);
  if (mark.mirrored) context.scale(-1, 1);
  context.rotate((-turns * Math.PI) / 2);
  const lines = wrapped(context, mark.text ?? "", room);
  const top = (-lines.length * size * LINE_HEIGHT) / 2;
  const start = mark.align === "left" ? -room / 2 : mark.align === "right" ? room / 2 : 0;
  lines.forEach((line, index) => {
    const at = top + index * size * LINE_HEIGHT;
    context.fillText(line, start, at);
    if (mark.underline) underlineText(context, line, start, at, size);
  });
  context.restore();
}

/**
 * Takes `cuts`, outlines in page space, out of what is on `context` in page pixels: clear to
 * transparency, or filled with `background` on a format that has none.
 */
export function cutOut(
  context: CanvasRenderingContext2D,
  cuts: readonly (readonly Point[])[],
  width: number,
  height: number,
  background?: string,
) {
  if (cuts.length === 0) return;
  context.save();
  if (background) context.fillStyle = background;
  else context.globalCompositeOperation = "destination-out";
  for (const cut of cuts) {
    context.beginPath();
    for (const [x, y] of cut) context.lineTo(x * width, y * height);
    context.closePath();
    context.fill();
  }
  context.restore();
}

/** What the scale of `context`'s transform is, whatever its quarter turn. */
function scaleOf(context: CanvasRenderingContext2D): number {
  const transform = context.getTransform();
  return Math.max(Math.hypot(transform.a, transform.b), 0.01);
}

/** A head on a line's end at (x, y), the line coming from `angle`. */
function arrowHead(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  head: number,
) {
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(
    x - head * Math.cos(angle - Math.PI / 7),
    y - head * Math.sin(angle - Math.PI / 7),
  );
  context.lineTo(
    x - head * Math.cos(angle + Math.PI / 7),
    y - head * Math.sin(angle + Math.PI / 7),
  );
  context.closePath();
  context.fill();
}

/** Whether a sketch comes back to its first point: a shape that can be filled. */
export function isClosedOutline(mark: Pick<Mark, "kind" | "points">): boolean {
  const first = mark.points?.[0];
  const last = mark.points?.at(-1);
  return (
    mark.kind === "sketch" &&
    first !== undefined &&
    last !== undefined &&
    (mark.points?.length ?? 0) > 2 &&
    first[0] === last[0] &&
    first[1] === last[1]
  );
}

/**
 * Draws `marks` in page pixels of a page `width` wide and `height` high (after `applyView`).
 * `selected` is the mark or marks chosen; one alone shows its handles. `page`, the canvas holding
 * the page as the view shows it, is what a loupe magnifies.
 */
export function drawMarks(
  context: CanvasRenderingContext2D,
  marks: readonly Mark[],
  width: number,
  height: number,
  selected?: string | readonly string[] | null,
  page?: CanvasImageSource | null,
) {
  const chosen = typeof selected === "string" ? [selected] : (selected ?? []);
  for (const mark of marks) {
    context.save();
    context.strokeStyle = mark.color;
    context.fillStyle = mark.color;
    context.lineWidth = Math.max(mark.stroke * width, 0.5);
    context.lineCap = "round";
    context.lineJoin = "round";
    if (mark.dash === "dashed") {
      context.setLineDash([context.lineWidth * 4, context.lineWidth * 3]);
      context.lineCap = "butt";
    } else if (mark.dash === "dotted") {
      context.setLineDash([0, context.lineWidth * 2]);
    }
    if (mark.shadow) {
      // A canvas's shadow takes no transform: it is given in the canvas's own pixels.
      const scale = scaleOf(context);
      context.shadowColor = "rgba(0, 0, 0, 0.5)";
      context.shadowBlur = width * 0.008 * scale;
      context.shadowOffsetY = width * 0.004 * scale;
    }
    const x = mark.x * width;
    const y = mark.y * height;
    const w = mark.w * width;
    const h = mark.h * height;
    switch (mark.kind) {
      case "highlight":
        // Multiplied, so the page's text stays dark under the colour.
        context.globalCompositeOperation = "multiply";
        for (const [bx, by, bw, bh] of mark.rects ?? []) {
          context.fillRect(bx * width, by * height, bw * width, bh * height);
        }
        break;
      case "underline":
      case "strikethrough":
        for (const [bx, by, bw, bh] of mark.rects ?? []) {
          const across = (by + bh * (mark.kind === "underline" ? 0.94 : 0.55)) * height;
          context.beginPath();
          context.moveTo(bx * width, across);
          context.lineTo((bx + bw) * width, across);
          context.stroke();
        }
        break;
      case "note": {
        const fold = Math.min(Math.abs(w), Math.abs(h)) * 0.3;
        context.lineWidth = Math.max(width * 0.001, 0.5);
        context.strokeStyle = NOTE_EDGE;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + w, y);
        context.lineTo(x + w, y + h - fold);
        context.lineTo(x + w - fold, y + h);
        context.lineTo(x, y + h);
        context.closePath();
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(x + w, y + h - fold);
        context.lineTo(x + w - fold, y + h - fold);
        context.lineTo(x + w - fold, y + h);
        context.stroke();
        break;
      }
      case "rect":
        if (mark.fill) {
          context.fillStyle = mark.fill;
          context.fillRect(x, y, w, h);
        }
        context.strokeRect(x, y, w, h);
        break;
      case "mask":
        context.fillStyle = MASK_DIM;
        context.beginPath();
        context.rect(0, 0, width, height);
        context.rect(x, y, w, h);
        context.fill("evenodd");
        break;
      case "loupe": {
        const across = Math.abs(w / 2);
        const down = Math.abs(h / 2);
        context.beginPath();
        context.ellipse(x + w / 2, y + h / 2, across, down, 0, 0, Math.PI * 2);
        if (page) {
          context.save();
          context.clip();
          // The page canvas stands in the view's pixels, so it is magnified in them, about the
          // loupe's centre as the transform puts it there.
          const at = context.getTransform();
          const cx = at.a * (x + w / 2) + at.c * (y + h / 2) + at.e;
          const cy = at.b * (x + w / 2) + at.d * (y + h / 2) + at.f;
          const power = mark.power ?? LOUPE_POWER;
          context.setTransform(power, 0, 0, power, cx * (1 - power), cy * (1 - power));
          context.drawImage(page, 0, 0, context.canvas.width, context.canvas.height);
          context.restore();
        }
        context.beginPath();
        context.ellipse(x + w / 2, y + h / 2, across, down, 0, 0, Math.PI * 2);
        context.stroke();
        break;
      }
      case "oval":
        context.beginPath();
        context.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        if (mark.fill) {
          context.fillStyle = mark.fill;
          context.fill();
        }
        context.stroke();
        break;
      case "line":
      case "arrow": {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + w, y + h);
        context.stroke();
        const ends = mark.arrow_ends ?? (mark.kind === "arrow" ? "end" : "none");
        const angle = Math.atan2(h, w);
        const head = Math.max(context.lineWidth * 4, width * 0.015);
        if (ends === "end" || ends === "both") arrowHead(context, x + w, y + h, angle, head);
        if (ends === "start" || ends === "both") arrowHead(context, x, y, angle + Math.PI, head);
        break;
      }
      case "sketch": {
        const points = mark.points ?? [];
        context.beginPath();
        points.forEach(([px, py], index) => {
          if (index === 0) context.moveTo(px * width, py * height);
          else context.lineTo(px * width, py * height);
        });
        if (mark.fill) {
          context.fillStyle = mark.fill;
          context.fill();
        }
        context.stroke();
        if (mark.bubble && mark.text) {
          context.setLineDash([]);
          drawBubbleText(context, mark, width, height);
        }
        break;
      }
      case "signature":
        for (const stroke of mark.strokes ?? []) {
          context.beginPath();
          stroke.forEach(([u, v], index) => {
            const px = x + u * w;
            const py = y + v * h;
            if (index === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
          });
          if (stroke.length === 1)
            context.lineTo(x + (stroke[0]?.[0] ?? 0) * w + 0.1, y + (stroke[0]?.[1] ?? 0) * h);
          context.stroke();
        }
        break;
      case "text": {
        const size = (mark.size ?? 0.03) * width;
        context.font = markFont(mark.font, size, mark);
        context.textBaseline = "top";
        // Its width as it was typed, which `w` or `h` gives by the quarter turn it was typed at.
        const across = (mark.turns ?? 0) % 2 === 0 ? Math.abs(w) : Math.abs(h);
        const start = mark.align === "center" ? across / 2 : mark.align === "right" ? across : 0;
        context.textAlign = mark.align ?? "left";
        context.save();
        context.translate(x, y);
        if (mark.mirrored) context.scale(-1, 1);
        context.rotate((-(mark.turns ?? 0) * Math.PI) / 2);
        (mark.text ?? "").split("\n").forEach((line, index) => {
          const top = index * size * LINE_HEIGHT;
          context.fillText(line, start, top);
          if (mark.underline) underlineText(context, line, start, top, size);
        });
        context.restore();
        break;
      }
    }
    if (chosen.includes(mark.id)) {
      const box = boundsOf(mark);
      context.globalCompositeOperation = "source-over";
      context.shadowColor = "transparent";
      context.lineCap = "round";
      const scale = scaleOf(context);
      context.setLineDash([4 / scale]);
      context.lineWidth = 1 / scale;
      context.strokeStyle = "#007aff";
      context.strokeRect(box.x * width, box.y * height, box.w * width, box.h * height);
      context.setLineDash([]);
      const handles = chosen.length === 1 ? handlesOf(mark) : [];
      const measure = measureHandle(mark);
      handles.forEach(([hx, hy], index) => {
        context.fillStyle = index === measure ? "#28cd41" : index >= 4 ? "#007aff" : "#ffffff";
        context.beginPath();
        context.arc(hx * width, hy * height, HANDLE_RADIUS / scale, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });
    }
    context.restore();
  }
}

/**
 * The box in page space of a text `across` wide and `down` high (both in fractions of the page's
 * width and height) typed in a view turned `turns` quarter turns clockwise.
 */
export function textBox(
  across: number,
  down: number,
  turns: Turns,
  width: number,
  height: number,
  mirrored = false,
): { w: number; h: number } {
  const box = turnedBox(across, down, turns, width, height);
  return mirrored ? { w: -box.w, h: box.h } : box;
}

function turnedBox(
  across: number,
  down: number,
  turns: Turns,
  width: number,
  height: number,
): { w: number; h: number } {
  const wide = across * width;
  const high = down * height;
  switch (turns) {
    case 1:
      return { w: high / width, h: -wide / height };
    case 2:
      return { w: -across, h: -down };
    case 3:
      return { w: -high / width, h: wide / height };
    default:
      return { w: across, h: down };
  }
}

/** A handle's radius on the screen, in device pixels of the canvas it is drawn on. */
const HANDLE_RADIUS = 4;
/** The smallest a mark's side is dragged to, as a fraction of the page. */
const MIN_MARK_SIDE = 0.005;
/** The largest text size the server keeps, as a fraction of the page's width. */
const MAX_TEXT_SIZE = 0.5;

/** The edge of a note, darker than its paper whatever its colour. */
const NOTE_EDGE = "rgba(0, 0, 0, 0.45)";
/** The width of a note's icon, as a fraction of the page's width. */
const NOTE_WIDTH = 0.035;
/** How far a press on a note can wander, in fractions of the page, and still open it instead of moving it. */
export const NOTE_PRESS_SLOP = 0.004;

/**
 * The lines `rects` (page space) lie on, each piece of a line joined with those beside it and its
 * duplicates dropped: a text layer gives a box for each of its pieces, some of them more than once.
 * `aspect` is the page's height over its width, to compare a gap across with a height down.
 */
export function mergedLines(rects: readonly Rect[], aspect: number): Rect[] {
  const lines: Rect[] = [];
  const sorted = rects
    .filter((rect) => rect.w > 1e-4 && rect.h > 1e-4)
    .sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
  for (const rect of sorted) {
    const line = lines.find((each) => {
      const shared = Math.min(each.y + each.h, rect.y + rect.h) - Math.max(each.y, rect.y);
      const gap = Math.max(each.x, rect.x) - Math.min(each.x + each.w, rect.x + rect.w);
      return shared > Math.min(each.h, rect.h) / 2 && gap < Math.max(each.h, rect.h) * aspect;
    });
    if (!line) {
      lines.push({ ...rect });
      continue;
    }
    const right = Math.max(line.x + line.w, rect.x + rect.w);
    const bottom = Math.max(line.y + line.h, rect.y + rect.h);
    line.x = Math.min(line.x, rect.x);
    line.y = Math.min(line.y, rect.y);
    line.w = right - line.x;
    line.h = bottom - line.y;
  }
  return lines;
}

/** Words as a mark keeps them: one line, without the control characters a PDF's text can hold. */
const wordsOf = (text: string) =>
  text
    .replace(/[\p{Cc}\s]+/gu, " ")
    .trim()
    .slice(0, MARKUP_LIMITS.text);

/**
 * The marks on `lines` of a page's text, as many as the file's limit on a mark's lines takes, so
 * none of a long selection is left out; none when there are no lines.
 */
export function textMarks(style: TextMarkStyle, lines: readonly Rect[], words: string): Mark[] {
  const text = wordsOf(words);
  const marks: Mark[] = [];
  for (let at = 0; at < lines.length; at += MARKUP_LIMITS.rects) {
    const kept = lines.slice(at, at + MARKUP_LIMITS.rects);
    const x = Math.min(...kept.map((line) => line.x));
    const y = Math.min(...kept.map((line) => line.y));
    const right = Math.max(...kept.map((line) => line.x + line.w));
    const bottom = Math.max(...kept.map((line) => line.y + line.h));
    marks.push({
      id: newMarkId(),
      kind: style.kind,
      color: style.color,
      stroke: 0.002,
      x: round6(x),
      y: round6(y),
      w: round6(right - x),
      h: round6(bottom - y),
      rects: kept.map((line) => [round6(line.x), round6(line.y), round6(line.w), round6(line.h)]),
      ...(text ? { text } : {}),
    });
  }
  return marks;
}

/**
 * A note saying `text`, its icon centred on `center`, square on a page `aspect` times as high as it
 * is wide. Control characters but line breaks and tabs are dropped, as the server refuses them.
 */
export function noteMark(center: Point, text: string, aspect: number): Mark {
  const h = NOTE_WIDTH / aspect;
  const [x, y] = clampPoint([center[0] - NOTE_WIDTH / 2, center[1] - h / 2]);
  return {
    id: newMarkId(),
    kind: "note",
    color: NOTE_COLOR,
    stroke: 0.002,
    x,
    y,
    w: NOTE_WIDTH,
    h: round6(h),
    text: text.replace(/[^\P{Cc}\n\t]/gu, "").slice(0, MARKUP_LIMITS.text),
  };
}

/**
 * Where `needle` is found in the `pieces` of a page's text: each match from its first character to
 * just past its last, as a piece and an offset in it. Letter case and runs of white space do not
 * count, and a space stands between pieces, as the sidebar's count of matches reads them.
 */
export function piecesMatching(
  pieces: readonly string[],
  needle: string,
): { from: Point; to: Point }[] {
  const wanted = needle.trim().replace(/\s+/g, " ").toLowerCase();
  if (!wanted) return [];
  let read = "";
  const places: Point[] = [];
  const add = (character: string, place: Point) => {
    read += character;
    places.push(place);
  };
  pieces.forEach((piece, index) => {
    if (index > 0 && read !== "" && !read.endsWith(" ")) add(" ", [index, 0]);
    for (let offset = 0; offset < piece.length; offset += 1) {
      const unit = piece.charAt(offset);
      if (/\s/.test(unit)) {
        if (read !== "" && !read.endsWith(" ")) add(" ", [index, offset]);
      } else {
        const lower = unit.toLowerCase();
        // A letter whose lower case is longer would put the offsets out of step.
        add(lower.length === 1 ? lower : unit, [index, offset]);
      }
    }
  });
  const found: { from: Point; to: Point }[] = [];
  let at = read.indexOf(wanted);
  while (at >= 0) {
    const last = places[at + wanted.length - 1] as Point;
    found.push({ from: places[at] as Point, to: [last[0], last[1] + 1] });
    at = read.indexOf(wanted, at + wanted.length);
  }
  return found;
}

/**
 * What the texts and speech bubbles among `marks` say, line by line, placed on a written page
 * `across` × `down` points showing `view` of a page of size `source`: what a PDF carries so that
 * they stay searchable. A line outside what the view shows is left out.
 */
export function typedRuns(
  marks: readonly Mark[],
  source: { width: number; height: number },
  view: View,
  across: number,
  down: number,
): PdfTextRun[] {
  return marks.flatMap((mark) => {
    if ((mark.kind !== "text" && !mark.bubble) || !mark.text) return [];
    const box = boundsOf(mark);
    const zoom = across / viewSize(source.width, source.height, view).width;
    const size = (mark.size ?? 0.03) * source.width * zoom;
    return mark.text.split("\n").flatMap((line, index): PdfTextRun[] => {
      if (line.trim() === "") return [];
      const [u, v] = toView([box.x, box.y], view);
      if (u < 0 || u > 1 || v < 0 || v > 1) return [];
      return [
        {
          text: line,
          matrix: [
            size,
            0,
            0,
            size,
            u * across,
            down - v * down - (index + 1) * size * LINE_HEIGHT,
          ],
          width: 0,
        },
      ];
    });
  });
}

/** The box a mark covers, in page space. */
export function boundsOf(mark: Mark): Rect {
  if (mark.kind === "sketch" && mark.points && mark.points.length > 0) {
    const xs = mark.points.map((p) => p[0]);
    const ys = mark.points.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return {
    x: Math.min(mark.x, mark.x + mark.w),
    y: Math.min(mark.y, mark.y + mark.h),
    w: Math.abs(mark.w),
    h: Math.abs(mark.h),
  };
}

/** The ids of the marks that touch `box` (page space), a rectangle dragged over a page. */
export function marksIn(marks: readonly Mark[], box: Rect): string[] {
  return marks
    .filter((mark) => {
      const own = boundsOf(mark);
      return (
        own.x <= box.x + box.w &&
        own.x + own.w >= box.x &&
        own.y <= box.y + box.h &&
        own.y + own.h >= box.y
      );
    })
    .map((mark) => mark.id);
}

/** The topmost mark at `point` (page space), within `tolerance`; `null` when none is. */
export function markAt(marks: readonly Mark[], point: Point, tolerance = 0.01): Mark | null {
  for (let index = marks.length - 1; index >= 0; index -= 1) {
    const mark = marks[index] as Mark;
    const box = boundsOf(mark);
    const onIt = mark.rects
      ? mark.rects.some(
          ([x, y, w, h]) =>
            point[0] >= x - tolerance &&
            point[0] <= x + w + tolerance &&
            point[1] >= y - tolerance &&
            point[1] <= y + h + tolerance,
        )
      : point[0] >= box.x - tolerance &&
        point[0] <= box.x + box.w + tolerance &&
        point[1] >= box.y - tolerance &&
        point[1] <= box.y + box.h + tolerance;
    if (onIt) return mark;
  }
  return null;
}

/** `mark` moved by `dx`, `dy` of page space. */
export function moved(mark: Mark, dx: number, dy: number): Mark {
  const next: Mark = { ...mark, x: round6(mark.x + dx), y: round6(mark.y + dy) };
  if (mark.points) next.points = mark.points.map(([x, y]) => clampPoint([x + dx, y + dy]));
  const [x, y] = clampPoint([next.x, next.y]);
  next.x = x;
  next.y = y;
  return next;
}

/** What the markup bar gives a shape it draws. */
export interface MarkStyle {
  color: string;
  stroke: number;
  fill?: string;
  dash?: MarkDash;
  shadow?: true;
  arrow_ends?: ArrowEnds;
}

/**
 * A shape from a press at `from` to a release at `to`, both in page space: a box with both corners
 * (`rect`, `oval`) or a line from one to the other (`line`, `arrow`).
 */
export function shapeBetween(
  kind: "rect" | "oval" | "line" | "arrow" | "mask" | "loupe",
  from: Point,
  to: Point,
  style: MarkStyle,
): Mark {
  const [ax, ay] = clampPoint(from);
  const [bx, by] = clampPoint(to);
  const line = kind === "line" || kind === "arrow";
  const mark: Mark = {
    id: newMarkId(),
    kind,
    color: style.color,
    stroke: style.stroke,
    x: line ? ax : Math.min(ax, bx),
    y: line ? ay : Math.min(ay, by),
    w: round6(line ? bx - ax : Math.abs(bx - ax)),
    h: round6(line ? by - ay : Math.abs(by - ay)),
  };
  if (kind === "mask" || kind === "loupe") return mark;
  if (!line && style.fill) mark.fill = style.fill;
  if (style.dash) mark.dash = style.dash;
  if (style.shadow) mark.shadow = true;
  if (line && style.arrow_ends) mark.arrow_ends = style.arrow_ends;
  return mark;
}

/**
 * The places a chosen mark is taken by to change its size, in page space: the two ends of a line,
 * the four corners of anything else with a box, clockwise from the top left. A polygon adds a handle
 * on each of its corners, then one for how many sides it has; a loupe adds one for how far it
 * magnifies: each of those two slides across the middle of the box. A mark on text keeps to its
 * words and a note's icon has one size, so those have none.
 */
export function handlesOf(mark: Mark): Point[] {
  if (mark.kind === "line" || mark.kind === "arrow") {
    return [
      [mark.x, mark.y],
      [mark.x + mark.w, mark.y + mark.h],
    ];
  }
  if (isAnnotation(mark)) return [];
  const box = boundsOf(mark);
  const corners: Point[] = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x + box.w, box.y + box.h],
    [box.x, box.y + box.h],
  ];
  const slid = (share: number): Point => [box.x + box.w * (0.2 + 0.6 * share), box.y + box.h / 2];
  if (mark.kind === "loupe") {
    const [least, most] = LOUPE_POWER_RANGE;
    return [...corners, slid(((mark.power ?? LOUPE_POWER) - least) / (most - least))];
  }
  if (mark.sides) {
    const [least, most] = POLYGON_SIDES;
    return [
      ...corners,
      ...(mark.points ?? []).slice(0, -1),
      slid((mark.sides - least) / (most - least)),
    ];
  }
  return corners;
}

/** Which of a mark's handles says how much of it there is: a loupe's power, a polygon's sides. */
function measureHandle(mark: Mark): number {
  if (mark.kind === "loupe") return 4;
  return mark.sides ? 4 + (mark.points?.length ?? 1) - 1 : -1;
}

/** A regular polygon of `sides` filling `box`, first corner at the top, closed. */
export function polygonIn(sides: number, box: Rect): Point[] {
  return Array.from({ length: sides + 1 }, (_, index) => {
    const angle = (index / sides) * Math.PI * 2 - Math.PI / 2;
    return clampPoint([
      box.x + box.w * (0.5 + 0.5 * Math.cos(angle)),
      box.y + box.h * (0.5 + 0.5 * Math.sin(angle)),
    ]);
  });
}

/** The index of the handle of `mark` at `point`; `null` when none is within `tolerance`. */
export function handleAt(mark: Mark, point: Point, tolerance = 0.012): number | null {
  const at = handlesOf(mark).findLastIndex(
    ([x, y]) => Math.abs(point[0] - x) <= tolerance && Math.abs(point[1] - y) <= tolerance,
  );
  return at < 0 ? null : at;
}

/**
 * `mark` with its handle `handle` dragged to `to`: the opposite corner stays where it is, and what
 * the mark holds (a sketch's points, a text's size) scales with it. A text keeps its proportions.
 */
export function resized(mark: Mark, handle: number, to: Point): Mark {
  const [tx, ty] = clampPoint(to);
  if (mark.kind === "line" || mark.kind === "arrow") {
    if (handle === 1) return { ...mark, w: round6(tx - mark.x), h: round6(ty - mark.y) };
    return {
      ...mark,
      x: tx,
      y: ty,
      w: round6(mark.x + mark.w - tx),
      h: round6(mark.y + mark.h - ty),
    };
  }
  const corners = handlesOf(mark);
  const before = boundsOf(mark);
  if (handle >= 4) {
    const share = Math.min(1, Math.max(0, ((tx - before.x) / before.w - 0.2) / 0.6));
    if (handle === measureHandle(mark)) {
      if (mark.kind === "loupe") {
        const [least, most] = LOUPE_POWER_RANGE;
        return { ...mark, power: Math.round((least + share * (most - least)) * 10) / 10 };
      }
      const [least, most] = POLYGON_SIDES;
      const sides = Math.round(least + share * (most - least));
      return sides === mark.sides ? mark : { ...mark, sides, points: polygonIn(sides, before) };
    }
    const corner = handle - 4;
    const points = [...(mark.points ?? [])];
    points[corner] = [tx, ty];
    if (corner === 0) points[points.length - 1] = [tx, ty];
    return { ...mark, points };
  }
  const anchor = corners[(handle + 2) % 4];
  if (!anchor) return mark;
  const x = Math.min(anchor[0], tx);
  const y = Math.min(anchor[1], ty);
  const w = Math.max(Math.abs(anchor[0] - tx), MIN_MARK_SIDE);
  const h = Math.max(Math.abs(anchor[1] - ty), MIN_MARK_SIDE);
  if (mark.kind === "text") {
    const factor = before.w > 0 ? w / before.w : 1;
    const size = Math.min(MAX_TEXT_SIZE, (mark.size ?? 0.03) * factor);
    const kept = size / (mark.size ?? 0.03);
    return {
      ...mark,
      size: round6(size),
      x: round6(anchor[0] + (mark.x - anchor[0]) * kept),
      y: round6(anchor[1] + (mark.y - anchor[1]) * kept),
      w: round6(mark.w * kept),
      h: round6(mark.h * kept),
    };
  }
  if (mark.kind === "sketch") {
    const across = before.w > 0 ? w / before.w : 1;
    const down = before.h > 0 ? h / before.h : 1;
    return {
      ...mark,
      points: (mark.points ?? []).map(([px, py]) =>
        clampPoint([x + (px - before.x) * across, y + (py - before.y) * down]),
      ),
    };
  }
  return { ...mark, x: round6(x), y: round6(y), w: round6(w), h: round6(h) };
}

/** A signature placed with its box `width` wide (page space), centred on `center`. */
export function placeSignature(
  signature: Signature,
  center: Point,
  width: number,
  pageAspect: number,
  style: { color: string; stroke: number },
): Mark {
  // The box's height in page space keeps the signature's own proportions on a page whose width
  // is `pageAspect` times its height.
  const height = (width / signature.aspect) * pageAspect;
  const [x, y] = clampPoint([center[0] - width / 2, center[1] - height / 2]);
  return {
    id: newMarkId(),
    kind: "signature",
    color: style.color,
    stroke: style.stroke,
    x,
    y,
    w: round6(width),
    h: round6(height),
    strokes: signature.strokes.map((stroke) => stroke.map(([u, v]) => [round6(u), round6(v)])),
  };
}

/** `stroke` sampled to at most `count` points, evenly, keeping its first and last. */
function sampleStroke(stroke: readonly Point[], count: number): Point[] {
  if (stroke.length <= count) return stroke.slice();
  if (count <= 1) return stroke.slice(0, 1);
  return Array.from(
    { length: count },
    (_, k) => stroke[Math.round((k * (stroke.length - 1)) / (count - 1))] as Point,
  );
}

/**
 * The strokes of a signature pad (`width` × `height` pixels, each stroke a list of pixel points)
 * as a signature: the strokes fitted to the box they cover, with a little margin. The strokes
 * share the server's limit of points between them, in proportion to their lengths, with at least
 * one point each, so the signature never holds more than the server takes.
 */
export function signatureFromStrokes(strokes: readonly (readonly Point[])[]): Signature | null {
  if (!strokes.some((stroke) => stroke.length > 0)) return null;
  // Bounds by a loop: spreading every point into Math.min fails on a long drawing.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const stroke of strokes) {
    for (const [x, y] of stroke) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const aspect = Math.min(20, Math.max(0.1, width / height));
  const kept = strokes.filter((stroke) => stroke.length > 0).slice(0, MARKUP_LIMITS.strokes);
  const total = kept.reduce((sum, stroke) => sum + stroke.length, 0);
  // One point for every stroke, and the rest of the budget shared by length.
  const shared = MARKUP_LIMITS.points - kept.length;
  return {
    id: newMarkId("s"),
    aspect: round6(aspect),
    strokes: kept.map((stroke) =>
      sampleStroke(
        stroke,
        total <= MARKUP_LIMITS.points
          ? stroke.length
          : 1 + Math.floor((stroke.length * shared) / total),
      ).map(([px, py]) => [
        round6(Math.min(1, Math.max(0, (px - minX) / width))),
        round6(Math.min(1, Math.max(0, (py - minY) / height))),
      ]),
    ),
  };
}

/** The most pixels one PDF page's drawing holds, whatever size it is asked for at. */
const MAX_RENDER_PIXELS = 16_000_000;

/**
 * The scale to draw a PDF page `width` × `height` points at when `wanted` is asked for: never a
 * canvas of more than MAX_RENDER_PIXELS (a huge page, or one with a large UserUnit, would
 * otherwise ask for a canvas no browser can hold). The floor keeps a zero-width request
 * drawable; the cap is applied last so it always wins.
 */
export function renderScale(wanted: number, width: number, height: number): number {
  const cap = Math.sqrt(MAX_RENDER_PIXELS / Math.max(width * height, 1));
  return Math.min(cap, Math.max(wanted, 1e-4));
}
