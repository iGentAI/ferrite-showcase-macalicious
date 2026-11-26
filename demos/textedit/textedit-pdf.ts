import { JPEG_QUALITY, writePdf } from "../preview/preview-export";
import { LINE_HEIGHT } from "./textedit-document";
import type { PageSetup } from "./textedit-drive";
import {
  columnSpans,
  DEFAULT_STYLE,
  type RtfParagraph,
  type RtfPicture,
  type RtfStyle,
  tableGrid,
} from "./textedit-rtf";
import { type FollowingText, type TabStop, tabEnd } from "./textedit-tab-stops";

/**
 * File > Export as PDF… on the drive: the document laid out on the pages of Page Setup and written
 * as a PDF file, with no print dialog. Each page is a picture of the page, as Preview's PDFs are
 * (`writePdf`), so its text is not selectable in the PDF.
 */

const PAGE_SIZES = { letter: [612, 792], a4: [595, 842] } as const;
const MARGIN = 72;
const DOTS_PER_POINT = 150 / 72;
const CELL_PADDING = 4;

export interface PdfText {
  kind: "text";
  x: number;
  /** Where the line's baseline is, from the top of the page. */
  y: number;
  width: number;
  text: string;
  style: RtfStyle;
}

export interface PdfPictureMark {
  kind: "picture";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

export interface PdfBox {
  kind: "box";
  x: number;
  y: number;
  width: number;
  height: number;
  border: number;
  fill?: string;
}

export type PdfMark = PdfText | PdfPictureMark | PdfBox;

/** The width of `text` in `style`, in points. */
export type MeasureText = (text: string, style: RtfStyle) => number;

/** A laid-out page: its size in points and what is on it, in points of the page. */
export interface PdfPageLayout {
  width: number;
  height: number;
  marks: PdfMark[];
}

/** A block ready to place: how high it is, and its marks from its top left corner. */
interface Block {
  height: number;
  marks: PdfMark[];
}

const moved = (mark: PdfMark, x: number, y: number): PdfMark => ({
  ...mark,
  x: mark.x + x,
  y: mark.y + y,
});

function listMarker(paragraph: RtfParagraph, index: number): string {
  const at = (paragraph.listStart ?? 1) + index - 1;
  switch (paragraph.list) {
    case "circle":
      return "◦";
    case "square":
      return "▪";
    case "hyphen":
      return "–";
    case "decimal":
      return `${at}.`;
    case "alpha":
      return `${String.fromCharCode(96 + ((at - 1) % 26) + 1)}.`;
    case "alphaupper":
      return `${String.fromCharCode(64 + ((at - 1) % 26) + 1)}.`;
    case "roman":
    case "romanupper": {
      const numerals: [number, string][] = [
        [10, "x"],
        [9, "ix"],
        [5, "v"],
        [4, "iv"],
        [1, "i"],
      ];
      let left = at;
      let out = "";
      for (const [value, numeral] of numerals) {
        while (left >= value) {
          out += numeral;
          left -= value;
        }
      }
      return `${paragraph.list === "roman" ? out : out.toUpperCase()}.`;
    }
    default:
      return "•";
  }
}

/** One paragraph's lines, at `width` points; its list number is `index`. */
function paragraphLines(
  paragraph: RtfParagraph,
  width: number,
  index: number,
  measure: MeasureText,
  tabs: readonly TabStop[],
): Block[] {
  const indent = paragraph.list ? 28 : 0;
  const room = Math.max(1, width - indent);
  interface Piece {
    text: string;
    style: RtfStyle;
    width: number;
    picture?: RtfPicture;
    pictureHeight?: number;
  }
  const lines: Piece[][] = [[]];
  let used = 0;
  const line = () => lines[lines.length - 1] as Piece[];
  const newLine = () => {
    lines.push([]);
    used = 0;
  };
  const add = (piece: Piece) => {
    if (used + piece.width > room && line().length > 0 && piece.text.trim() !== "") newLine();
    line().push(piece);
    used += piece.width;
  };
  /** The text after a tab in `runs[from]`, from `start`, to the next tab or the line's end. */
  const following = (from: number, start: number): FollowingText => {
    let width = 0;
    let beforeDecimal: number | undefined;
    let offset = start;
    for (const run of paragraph.runs.slice(from)) {
      if (run.picture) {
        width += run.picture.width;
        continue;
      }
      const text = run.text.slice(offset);
      offset = 0;
      const end = text.search(/[\t\n]/);
      const part = end < 0 ? text : text.slice(0, end);
      const dot = part.indexOf(".");
      if (dot >= 0 && beforeDecimal === undefined) {
        beforeDecimal = width + measure(part.slice(0, dot), run.style);
      }
      width += measure(part, run.style);
      if (end >= 0) break;
    }
    return { width, beforeDecimal: beforeDecimal ?? width };
  };
  for (const [runIndex, run] of paragraph.runs.entries()) {
    if (run.picture) {
      const scale = Math.min(1, room / Math.max(1, run.picture.width));
      add({
        text: "",
        style: run.style,
        width: run.picture.width * scale,
        picture: run.picture,
        pictureHeight: run.picture.height * scale,
      });
      continue;
    }
    let offset = 0;
    for (const part of run.text.split(/(\n|\t| +)/)) {
      offset += part.length;
      if (!part) continue;
      if (part === "\n") newLine();
      else if (part === "\t") {
        const stop = tabEnd(used, paragraph.tabs ?? tabs, following(runIndex, offset));
        add({ text: "", style: run.style, width: stop - used });
      } else {
        let rest = part;
        // A word wider than the line breaks where it must.
        while (measure(rest, run.style) > room && rest.length > 1) {
          let fits = rest.length - 1;
          while (fits > 1 && measure(rest.slice(0, fits), run.style) > room) fits -= 1;
          if (line().length > 0) newLine();
          add({
            text: rest.slice(0, fits),
            style: run.style,
            width: measure(rest.slice(0, fits), run.style),
          });
          newLine();
          rest = rest.slice(fits);
        }
        add({ text: rest, style: run.style, width: measure(rest, run.style) });
      }
    }
  }
  const multiple = Number(paragraph.spacing ?? 1) || 1;
  return lines.map((pieces, at) => {
    const size = Math.max(
      0,
      ...pieces.filter((piece) => !piece.picture).map((piece) => piece.style.size),
      pieces.length === 0 ? DEFAULT_STYLE.size : 0,
    );
    const textHeight = size * LINE_HEIGHT * multiple;
    const pictureHeight = Math.max(0, ...pieces.map((piece) => piece.pictureHeight ?? 0));
    const height = Math.max(textHeight, pictureHeight);
    const baseline = height - (textHeight - size) / 2 - size * 0.2;
    const total = pieces.reduce((sum, piece) => sum + piece.width, 0);
    const start =
      indent +
      (paragraph.align === "center"
        ? (room - total) / 2
        : paragraph.align === "right"
          ? room - total
          : 0);
    const marks: PdfMark[] = [];
    if (at === 0 && paragraph.list) {
      marks.push({
        kind: "text",
        x: 8,
        y: baseline,
        width: 20,
        text: listMarker(paragraph, index),
        style: paragraph.runs[0]?.style ?? DEFAULT_STYLE,
      });
    }
    let x = start;
    for (const piece of pieces) {
      if (piece.picture) {
        marks.push({
          kind: "picture",
          x,
          y: height - (piece.pictureHeight ?? 0),
          width: piece.width,
          height: piece.pictureHeight ?? 0,
          src: piece.picture.src,
        });
      } else if (piece.text) {
        marks.push({
          kind: "text",
          x,
          y: baseline,
          width: piece.width,
          text: piece.text,
          style: piece.style,
        });
      }
      x += piece.width;
    }
    return { height, marks };
  });
}

/** The blocks of `paragraphs` at `width` points: each line a block, each table row a block. */
function blocksOf(
  paragraphs: readonly RtfParagraph[],
  width: number,
  measure: MeasureText,
  tabs: readonly TabStop[],
): Block[] {
  const blocks: Block[] = [];
  let listIndex = 0;
  let listKind: string | undefined;
  for (const paragraph of paragraphs) {
    if (paragraph.table) {
      listIndex = 0;
      const columnWidths = columnSpans(paragraph.table, width);
      // Columns set wider than the page are drawn in proportion to fit it.
      const fit = Math.min(1, width / columnWidths.reduce((sum, each) => sum + each, 0));
      const columns = columnWidths.length;
      const { border } = paragraph.table;
      const grid = tableGrid(paragraph.table.rows);
      const laid = grid.map((row, rowAt) => {
        const across = row.reduce((sum, slot) => sum + slot.span, 0);
        let column = 0;
        let x = 0;
        return row.flatMap(({ cell, span, covered }) => {
          const cellWidth =
            across === columns
              ? columnWidths.slice(column, column + span).reduce((sum, each) => sum + each, 0) * fit
              : (width / columns) * span;
          const at = x;
          column += span;
          x += cellWidth;
          if (covered) return [];
          const inner = blocksOf(cell.paragraphs, cellWidth - 2 * CELL_PADDING, measure, tabs);
          return [
            {
              cell,
              x: at,
              cellWidth,
              inner,
              down: Math.min(cell.rows ?? 1, grid.length - rowAt),
              height: inner.reduce((sum, block) => sum + block.height, 0) + 2 * CELL_PADDING,
            },
          ];
        });
      });
      const heights = laid.map((row) =>
        Math.max(0, ...row.filter((each) => each.down === 1).map((each) => each.height)),
      );
      const heightOf = (from: number, count: number) =>
        heights.slice(from, from + count).reduce((sum, each) => sum + each, 0);
      laid.forEach((row, at) => {
        for (const { down, height } of row) {
          // A merged cell taller than its rows makes the last of them taller.
          if (down > 1) {
            const last = at + down - 1;
            heights[last] = (heights[last] ?? 0) + Math.max(0, height - heightOf(at, down));
          }
        }
      });
      // Rows joined by a merged cell are one block: a page does not break between them.
      for (let at = 0; at < laid.length; ) {
        let end = at + 1;
        for (let rowAt = at; rowAt < end; rowAt += 1) {
          for (const { down } of laid[rowAt] ?? []) end = Math.max(end, rowAt + down);
        }
        const marks: PdfMark[] = [];
        for (let rowAt = at; rowAt < end; rowAt += 1) {
          const top = heightOf(at, rowAt - at);
          for (const { cell, x, cellWidth, inner, down } of laid[rowAt] ?? []) {
            marks.push({
              kind: "box",
              x,
              y: top,
              width: cellWidth,
              height: heightOf(rowAt, down),
              border,
              ...(cell.background ? { fill: cell.background } : undefined),
            });
            let y = top + CELL_PADDING;
            for (const block of inner) {
              for (const mark of block.marks) marks.push(moved(mark, x + CELL_PADDING, y));
              y += block.height;
            }
          }
        }
        blocks.push({ height: heightOf(at, end - at), marks });
        at = end;
      }
      continue;
    }
    listIndex = paragraph.list && paragraph.list === listKind ? listIndex + 1 : 1;
    listKind = paragraph.list;
    const lines = paragraphLines(paragraph, width, listIndex, measure, tabs);
    lines.forEach((line, at) => {
      const before = at === 0 ? (paragraph.before ?? 0) : 0;
      const after = at === lines.length - 1 ? (paragraph.after ?? 0) : 0;
      blocks.push({
        height: before + line.height + after,
        marks: line.marks.map((mark) => moved(mark, 0, before)),
      });
    });
  }
  return blocks;
}

/** The document's pages, one or more: the text flows from one to the next by whole lines. */
export function layoutPdf(
  paragraphs: readonly RtfParagraph[],
  setup: PageSetup,
  measure: MeasureText,
  tabs: readonly TabStop[] = [],
): PdfPageLayout[] {
  const [shortSide, longSide] = PAGE_SIZES[setup.paper];
  const landscape = setup.orientation === "landscape";
  const width = landscape ? longSide : shortSide;
  const height = landscape ? shortSide : longSide;
  const scale = setup.scale / 100;
  const textWidth = (width - 2 * MARGIN) / scale;
  const textHeight = (height - 2 * MARGIN) / scale;
  const pages: PdfPageLayout[] = [{ width, height, marks: [] }];
  let y = 0;
  for (const block of blocksOf(paragraphs, textWidth, measure, tabs)) {
    if (y + block.height > textHeight && y > 0) {
      pages.push({ width, height, marks: [] });
      y = 0;
    }
    const page = pages[pages.length - 1] as PdfPageLayout;
    for (const mark of block.marks) {
      const placed = moved(mark, 0, y);
      page.marks.push(placed);
    }
    y += block.height;
  }
  return pages;
}

const fontOf = (style: RtfStyle, size: number) =>
  `${style.italic ? "italic " : ""}${style.bold ? "bold " : ""}${size}px "${style.family.replace(/"/g, "")}", Helvetica, Arial, sans-serif`;

const scriptSize = (style: RtfStyle) => (style.script ? style.size * 0.75 : style.size);

const loadPicture = async (src: string) => {
  const picture = new Image();
  picture.src = src;
  await picture.decode();
  return picture;
};

/** The bytes of a PDF of `paragraphs`, drawn by this browser's canvas. */
export async function writeDocumentPdf(
  paragraphs: readonly RtfParagraph[],
  setup: PageSetup,
  title: string,
  tabs?: readonly TabStop[],
): Promise<Uint8Array> {
  const measuring = document.createElement("canvas").getContext("2d");
  if (!measuring) throw new Error("This browser can’t draw the document.");
  const measure: MeasureText = (text, style) => {
    measuring.font = fontOf(style, scriptSize(style));
    return measuring.measureText(text).width;
  };
  const scale = setup.scale / 100;
  const pages = [];
  for (const page of layoutPdf(paragraphs, setup, measure, tabs)) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(page.width * DOTS_PER_POINT);
    canvas.height = Math.round(page.height * DOTS_PER_POINT);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can’t draw the document.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(DOTS_PER_POINT, DOTS_PER_POINT);
    context.translate(MARGIN, MARGIN);
    context.scale(scale, scale);
    for (const mark of page.marks) {
      if (mark.kind === "box") {
        if (mark.fill) {
          context.fillStyle = mark.fill;
          context.fillRect(mark.x, mark.y, mark.width, mark.height);
        }
        if (mark.border > 0) {
          context.lineWidth = mark.border;
          context.strokeStyle = "#000000";
          context.strokeRect(mark.x, mark.y, mark.width, mark.height);
        }
      } else if (mark.kind === "picture") {
        context.drawImage(await loadPicture(mark.src), mark.x, mark.y, mark.width, mark.height);
      } else {
        const { style } = mark;
        const size = scriptSize(style);
        const lift =
          style.script === "super" ? style.size * 0.35 : style.script === "sub" ? -size * 0.2 : 0;
        if (style.highlight) {
          context.fillStyle = style.highlight;
          context.fillRect(mark.x, mark.y - style.size, mark.width, style.size * LINE_HEIGHT);
        }
        context.font = fontOf(style, size);
        context.fillStyle = style.color ?? "#000000";
        context.fillText(mark.text, mark.x, mark.y - lift);
        if (style.underline || style.link) {
          context.fillRect(mark.x, mark.y + 1, mark.width, Math.max(0.5, size / 16));
        }
        if (style.strikethrough) {
          context.fillRect(mark.x, mark.y - size * 0.3, mark.width, Math.max(0.5, size / 16));
        }
      }
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("This browser can’t draw the document.");
    pages.push({
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      width: page.width,
      height: page.height,
    });
  }
  return writePdf(pages, title);
}
