import { type DriveEntry, readFileEntry } from "../desktop/desktop-files";
import { writePictureBack } from "./finder-rotate";

/*
 * What Markup draws on a picture. Places are in thousandths of the picture's width and height,
 * so an annotation keeps its place whatever size the panel is. A stroke is the points the
 * pointer passed; a shape and a text stand near the middle, each a little further along than
 * the last so that they do not hide each other. A crop is the part of the picture to keep.
 */
export interface Stroke {
  id: number;
  type: "stroke";
  points: string[];
  color: string;
  width: number;
  opacity: number;
}
export type Shape = "rectangle" | "oval" | "line";
export interface Figure {
  id: number;
  type: Shape;
  offset: number;
  color: string;
  fill: string;
  width: number;
}
export interface Caption {
  id: number;
  type: "text";
  offset: number;
  text: string;
  color: string;
  /** The size of the text in points; without it, the panel's own. */
  size?: number;
}
export interface CropBox {
  id: number;
  type: "crop";
  from: readonly [x: number, y: number];
  to: readonly [x: number, y: number];
}
export type Annotation = Stroke | Figure | Caption | CropBox;

export const NO_FILL = "none";

/** The size of a text annotation the Text Style menu has not changed: the panel's title font. */
export const CAPTION_POINTS = 17;

/** A shape stands at this place, plus its offset, and is this wide and tall. */
export const FIGURE_AT = 350;
export const FIGURE_SIDE = 300;
/** A text stands, centred, at this place plus its offset. */
const CAPTION_AT = 500;

const pointOf = (point: string) => point.split(" ").map(Number) as [number, number];

type Painter = Pick<
  CanvasRenderingContext2D,
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "rect"
  | "ellipse"
  | "stroke"
  | "fill"
  | "fillText"
  | "strokeStyle"
  | "fillStyle"
  | "lineWidth"
  | "lineCap"
  | "lineJoin"
  | "globalAlpha"
  | "font"
  | "textAlign"
  | "textBaseline"
>;

/**
 * Draws `marks` on a picture of `width` by `height` pixels. `scale` is how many of its pixels one
 * point of the panel covered, so that a line keeps the weight it was drawn with.
 */
export function paintMarks(
  context: Painter,
  marks: readonly Annotation[],
  width: number,
  height: number,
  scale: number,
): void {
  const x = (at: number) => (at / 1000) * width;
  const y = (at: number) => (at / 1000) * height;
  for (const mark of marks) {
    context.globalAlpha = 1;
    context.lineCap = "round";
    context.lineJoin = "round";
    if (mark.type === "crop") continue;
    if (mark.type === "text") {
      context.fillStyle = mark.color;
      context.font = `${(mark.size ?? CAPTION_POINTS) * scale}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(mark.text, x(CAPTION_AT + mark.offset), y(CAPTION_AT + mark.offset));
      continue;
    }
    context.strokeStyle = mark.color;
    context.lineWidth = mark.width * scale;
    context.beginPath();
    if (mark.type === "stroke") {
      context.globalAlpha = mark.opacity;
      const [first = "0 0", ...rest] = mark.points;
      const [startX, startY] = pointOf(first);
      context.moveTo(x(startX), y(startY));
      // A press without a move is one point: a line to itself, which round ends draw as a dot.
      for (const point of rest.length > 0 ? rest : [first]) {
        const [nextX, nextY] = pointOf(point);
        context.lineTo(x(nextX), y(nextY));
      }
      context.stroke();
      continue;
    }
    const at = FIGURE_AT + mark.offset;
    if (mark.type === "line") {
      context.moveTo(x(at), y(at + FIGURE_SIDE));
      context.lineTo(x(at + FIGURE_SIDE), y(at));
      context.stroke();
      continue;
    }
    if (mark.type === "rectangle") {
      context.rect(x(at), y(at), x(FIGURE_SIDE), y(FIGURE_SIDE));
    } else {
      const half = FIGURE_SIDE / 2;
      context.ellipse(x(at + half), y(at + half), x(half), y(half), 0, 0, 2 * Math.PI);
    }
    if (mark.fill !== NO_FILL) {
      context.fillStyle = mark.fill;
      context.fill();
    }
    context.stroke();
  }
}

/** The pixels the last crop among `marks` keeps of a `width` by `height` picture, at least one each way. */
export function cropArea(marks: readonly Annotation[], width: number, height: number) {
  const crop = marks.findLast((mark): mark is CropBox => mark.type === "crop");
  if (!crop) return null;
  const left = Math.round((Math.min(crop.from[0], crop.to[0]) / 1000) * width);
  const top = Math.round((Math.min(crop.from[1], crop.to[1]) / 1000) * height);
  const right = Math.round((Math.max(crop.from[0], crop.to[0]) / 1000) * width);
  const bottom = Math.round((Math.max(crop.from[1], crop.to[1]) / 1000) * height);
  return { left, top, width: Math.max(right - left, 1), height: Math.max(bottom - top, 1) };
}

/**
 * The picture on the drive with `marks` drawn into its pixels and saved over the file, as Done does
 * on a Mac. `shownWidth` is the width in points the panel showed it at. Answers whether the file
 * now holds them: a kind the browser cannot write back stays as it is.
 */
export async function saveMarkedPicture(
  entry: DriveEntry,
  marks: readonly Annotation[],
  shownWidth: number,
  session?: string | null,
): Promise<boolean> {
  const { blob } = await readFileEntry(entry.id);
  const picture = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = picture.width;
  canvas.height = picture.height;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.drawImage(picture, 0, 0);
  picture.close();
  const scale = shownWidth > 0 ? canvas.width / shownWidth : 1;
  paintMarks(context, marks, canvas.width, canvas.height, scale);
  const area = cropArea(marks, canvas.width, canvas.height);
  if (!area) return writePictureBack(canvas, entry, session);
  const cropped = document.createElement("canvas");
  cropped.width = area.width;
  cropped.height = area.height;
  cropped
    .getContext("2d")
    ?.drawImage(
      canvas,
      area.left,
      area.top,
      area.width,
      area.height,
      0,
      0,
      area.width,
      area.height,
    );
  return writePictureBack(cropped, entry, session);
}
