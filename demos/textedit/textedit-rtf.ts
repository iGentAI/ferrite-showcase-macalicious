/**
 * TextEdit's Rich Text Format: a document's paragraphs and character formats written as an `.rtf`
 * file, and an `.rtf` file read back into them, both in the browser. The writer reads the rich
 * text view's content (or the content `htmlToContent` rebuilt); the reader understands what
 * TextEdit, Word and this writer produce: the font and colour tables, Cocoa's PostScript font
 * names, paragraph alignment, line spacing, indents and tab stops, bold, italic, underline,
 * strikethrough, size, colour, highlight, superscript and subscript, Unicode text, links
 * (`HYPERLINK` fields) and PNG and JPEG pictures (`\pict`). Other pictures, styles and anything
 * else are skipped; their text is kept where the format allows.
 *
 * The writer's files are ASCII: every other character is a `\uN` with a `?` for readers that know
 * no Unicode. Other writers put 8-bit text in the document's code page (`\ansicpgN`) or a font's
 * (`\fcharsetN`, `\cpgN`), as `\'hh` escapes or as literal bytes, so a file is read from its bytes
 * (`rtfTextOfBytes`) and the reader decodes each run of bytes in the code page in effect.
 *
 * A list style has no simple RTF form, so the writer keeps it in an ignorable destination of its
 * own, `{\*\macaliciouslist <style>}`, which other readers skip and this reader understands;
 * `{\*\macaliciouslistat <number>}` is where a list starts counting.
 */

import { cssColorToHex, FONT_FAMILIES, findFontFamily } from "macalicious/lib/rich-text";
import {
  cleanProperties,
  PROPERTY_FIELDS,
  type TextEditProperties,
  type TextEditRuler,
} from "./textedit-data";
import { LINE_HEIGHT, type TextEditAlignment, type WritingDirection } from "./textedit-document";
import { PICTURE_SOURCE } from "./textedit-picture";
import {
  leftStops,
  parseTabStops,
  type TabKind,
  type TabStop,
  tabStopsText,
} from "./textedit-tab-stops";

/** A CSS generic family: what a font the library does not know falls back to. */
export type GenericFamily = "serif" | "sans-serif" | "monospace" | "cursive";

/** The format of a run of characters. */
export interface RtfStyle {
  /** The family by its Fonts panel name (`Helvetica`), or the first family named. */
  family: string;
  /**
   * For a family the library does not know (`Courier New`), the kind of font it is, from the RTF
   * font table's class (`\fmodern`) or the CSS family list: what the view shows where that family
   * is not installed, and the class it is written back with. Absent for a family the library knows.
   */
  generic?: GenericFamily;
  /** Points. */
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  /** `#rrggbb`; absent for the text colour of the appearance (black on white, white on dark). */
  color?: string;
  /** `#rrggbb` behind the text; absent for none. */
  highlight?: string;
  script?: "super" | "sub";
  /** The address the run links to: a web address, or `drive:<id>` for an attachment. */
  link?: string;
}

/** A picture in the text, as a `data:` address of a PNG or a JPEG; its size in points. */
export interface RtfPicture {
  src: string;
  width: number;
  height: number;
}

/** A run of characters of one format, or one picture (its `text` is then empty). */
export interface RtfRun {
  text: string;
  style: RtfStyle;
  picture?: RtfPicture;
}

/** A cell of a table: its paragraphs, how many columns and rows it spans and its background. */
export interface RtfCell {
  paragraphs: RtfParagraph[];
  span?: number;
  /** The rows it spans, its own first; the rows below hold no cell for the columns it covers. */
  rows?: number;
  background?: string;
}

/**
 * A table: its border width in points, its rows of cells, and, when any is set, its columns' widths in
 * points with 0 for a column that shares what the others leave.
 */
export interface RtfTable {
  border: number;
  rows: RtfCell[][];
  widths?: number[];
}

/** What stands in a row of a table at one place: its own cell, or one from above `covered` it. */
export interface TableSlot {
  cell: RtfCell;
  span: number;
  covered: boolean;
}

/** A table's rows, left to right, with the places that cells of the rows above reach down into. */
export function tableGrid(rows: readonly RtfCell[][]): TableSlot[][] {
  const reaching = new Map<number, { cell: RtfCell; span: number; left: number }>();
  return rows.map((row) => {
    const slots: TableSlot[] = [];
    let column = 0;
    let next = 0;
    const lastReach = () =>
      Math.max(-1, ...[...reaching].flatMap(([at, reach]) => (reach.left > 0 ? [at] : [])));
    while (next < row.length || column <= lastReach()) {
      const reach = reaching.get(column);
      if (reach && reach.left > 0) {
        slots.push({ cell: reach.cell, span: reach.span, covered: true });
        reach.left -= 1;
        column += reach.span;
        continue;
      }
      const cell = row[next] ?? { paragraphs: [] };
      next += 1;
      const span = cell.span ?? 1;
      slots.push({ cell, span, covered: false });
      if ((cell.rows ?? 1) > 1) reaching.set(column, { cell, span, left: (cell.rows ?? 1) - 1 });
      column += span;
    }
    return slots;
  });
}

const columnsAcross = (rows: readonly RtfCell[][]) =>
  Math.max(1, ...tableGrid(rows).map((row) => row.reduce((sum, slot) => sum + slot.span, 0)));

/**
 * The width of each of a table's columns out of `total`, in `perPoint` units to a point: those set keep
 * their width, and the rest share what is left.
 */
export function columnSpans(table: RtfTable, total: number, perPoint = 1): number[] {
  const columns = columnsAcross(table.rows);
  const set = Array.from({ length: columns }, (_, at) => (table.widths?.[at] ?? 0) * perPoint);
  const unset = set.filter((width) => width === 0).length;
  const left = Math.max(0, total - set.reduce((sum, width) => sum + width, 0));
  return set.map((width) => width || (left > 0 ? left / unset : total / columns));
}

/** A paragraph: its format and its runs (none for an empty line). */
export interface RtfParagraph {
  align: TextEditAlignment;
  /** With a direction set: left alignment was chosen, rather than the direction's own start. */
  leftSet?: boolean;
  /** Line spacing as the format bar names it ("1.5"); absent for single. */
  spacing?: string;
  /** The space before the paragraph, in points (`\sb`); absent for none. */
  before?: number;
  /** The space after the paragraph, in points (`\sa`); absent for none. */
  after?: number;
  /** The paragraph's own ruler, in points; absent when it follows the document's. */
  indents?: { first: number; head: number; tail: number };
  /** The paragraph's own tab stops; absent when it follows the document's. */
  tabs?: TabStop[];
  /** The list style (`disc`, `decimal`); absent for none. */
  list?: string;
  /** The number a list starts counting from here; absent for its ordinary start. */
  listStart?: number;
  /** The writing direction set on it; absent for the text's own. */
  direction?: WritingDirection;
  /** A table standing where a paragraph would: it has no runs of its own. */
  table?: RtfTable;
  runs: RtfRun[];
}

/** What a new document's text is: Helvetica 12. */
export const DEFAULT_STYLE: RtfStyle = {
  family: "Helvetica",
  size: 12,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

const BLOCK = /^(DIV|P|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE)$/;
/** The point sizes of `<font size="1">` to `7`. */
const FONT_SIZES = [0, 10, 13, 16, 18, 24, 32, 48];
/** The point sizes of CSS's size keywords. */
const SIZE_KEYWORDS: Record<string, number> = {
  "xx-small": 9,
  "x-small": 10,
  small: 13,
  medium: 16,
  large: 18,
  "x-large": 24,
  "xx-large": 32,
  "xxx-large": 48,
};
const SPACINGS = ["1.2", "1.5", "2.0"];

/** A Fonts panel family name for a CSS family list or a font name: the first family named. */
export function familyName(value: string): string {
  const first =
    value
      .split(",")[0]
      ?.trim()
      .replace(/^["']|["']$/g, "") ?? "";
  return findFontFamily(first)?.name ?? (first || DEFAULT_STYLE.family);
}

const GENERICS: readonly GenericFamily[] = ["serif", "sans-serif", "monospace", "cursive"];

/** The generic family a CSS family list ends in, if any. */
function genericOf(value: string): GenericFamily | undefined {
  return value
    .split(",")
    .map((each) =>
      each
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase(),
    )
    .find((each): each is GenericFamily => (GENERICS as readonly string[]).includes(each));
}

/** Sets the run's family from a CSS family list, with its generic family when the library does
 * not know the family. */
function setFamily(style: RtfStyle, value: string) {
  style.family = familyName(value);
  const generic = findFontFamily(style.family) ? undefined : genericOf(value);
  if (generic) style.generic = generic;
  else delete style.generic;
}

/** A size as CSS writes it (`14px`, `10.5pt`, `large`), in points; `undefined` if unknown. */
function sizeOf(value: string): number | undefined {
  const keyword = SIZE_KEYWORDS[value.trim()];
  if (keyword) return keyword;
  const parts = /^([\d.]+)(px|pt)$/.exec(value.trim());
  if (!parts) return undefined;
  const number = Number(parts[1]);
  // One CSS pixel is one point in the library; a CSS point is 4/3 of a pixel.
  const points = parts[2] === "pt" ? (number * 4) / 3 : number;
  return Number.isFinite(points) && points > 0 ? Math.round(points * 2) / 2 : undefined;
}

/** The format of an element's content, from the format around it and what the element sets. */
function styleWithin(element: HTMLElement, around: RtfStyle): RtfStyle {
  const style: RtfStyle = { ...around };
  const tag = element.tagName.toUpperCase();
  if (tag === "B" || tag === "STRONG" || /^H[1-6]$/.test(tag)) style.bold = true;
  if (tag === "I" || tag === "EM") style.italic = true;
  if (tag === "U") style.underline = true;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") style.strikethrough = true;
  if (tag === "SUP") style.script = "super";
  if (tag === "SUB") style.script = "sub";
  if (tag === "A") {
    const href = element.getAttribute("href");
    if (href) style.link = href;
  }
  if (tag === "FONT") {
    const face = element.getAttribute("face");
    if (face) setFamily(style, face);
    const color = element.getAttribute("color");
    const hex = color ? cssColorToHex(color) : undefined;
    if (hex) style.color = hex;
    const size = FONT_SIZES[Number(element.getAttribute("size"))];
    if (size) style.size = size;
  }
  const css = element.style;
  if (css) {
    const weight = css.fontWeight;
    if (weight === "bold" || weight === "bolder" || Number(weight) >= 600) style.bold = true;
    else if (weight === "normal" || weight === "lighter" || (weight && Number(weight) < 600)) {
      style.bold = false;
    }
    if (css.fontStyle === "italic" || css.fontStyle.startsWith("oblique")) style.italic = true;
    else if (css.fontStyle === "normal") style.italic = false;
    const decoration = `${css.textDecorationLine ?? ""} ${css.textDecoration ?? ""}`;
    if (/underline/.test(decoration)) style.underline = true;
    if (/line-through/.test(decoration)) style.strikethrough = true;
    if (css.fontFamily) setFamily(style, css.fontFamily);
    const size = css.fontSize ? sizeOf(css.fontSize) : undefined;
    if (size) style.size = size;
    const color = css.color ? cssColorToHex(css.color) : undefined;
    if (color) style.color = color;
    const highlight = css.backgroundColor ? cssColorToHex(css.backgroundColor) : undefined;
    if (highlight) style.highlight = highlight;
    else if (css.backgroundColor === "transparent") delete style.highlight;
    if (css.verticalAlign === "super") style.script = "super";
    if (css.verticalAlign === "sub") style.script = "sub";
    if (css.verticalAlign === "baseline") delete style.script;
  }
  return style;
}

const sameStyle = (a: RtfStyle, b: RtfStyle) =>
  a.family === b.family &&
  a.generic === b.generic &&
  a.size === b.size &&
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  a.strikethrough === b.strikethrough &&
  a.color === b.color &&
  a.highlight === b.highlight &&
  a.script === b.script &&
  a.link === b.link;

function addRun(paragraph: RtfParagraph, text: string, style: RtfStyle) {
  if (!text) return;
  const last = paragraph.runs.at(-1);
  if (last && !last.picture && sameStyle(last.style, style)) last.text += text;
  else paragraph.runs.push({ text, style: { ...style } });
}

/** The paragraph format a block element carries: what `setParagraphFormat` writes. */
function paragraphFormat(block: HTMLElement | null): Omit<RtfParagraph, "runs"> {
  if (!block) return { align: "left" };
  const align = block.style?.textAlign;
  const spacing = block.dataset?.spacing;
  const list = block.dataset?.list;
  const listStart = /^\d{1,6}$/.test(block.dataset?.listStart ?? "")
    ? Number(block.dataset.listStart)
    : undefined;
  const direction = block.getAttribute?.("dir");
  const before = Number.parseFloat(block.style?.marginTop ?? "");
  const after = Number.parseFloat(block.style?.marginBottom ?? "");
  const start = block.style?.getPropertyValue?.("margin-inline-start");
  const tabs = parseTabStops(block.dataset?.tabs);
  const head = start ? Number.parseFloat(start) - (list ? 28 : 0) : undefined;
  const indents =
    head === undefined
      ? undefined
      : {
          first: head + (Number.parseFloat(block.style.getPropertyValue("text-indent")) || 0),
          head,
          tail: Number.parseFloat(block.style.getPropertyValue("margin-inline-end")) || 0,
        };
  return {
    align: align === "center" || align === "right" || align === "justify" ? align : "left",
    ...(direction === "ltr" || direction === "rtl" || direction === "auto"
      ? { direction, ...(align === "left" ? { leftSet: true } : undefined) }
      : undefined),
    ...(spacing && SPACINGS.includes(spacing) ? { spacing } : undefined),
    ...(before > 0 ? { before } : undefined),
    ...(after > 0 ? { after } : undefined),
    ...(indents ? { indents } : undefined),
    ...(tabs ? { tabs } : undefined),
    ...(list && /^[a-z]{1,20}$/.test(list) ? { list } : undefined),
    ...(list && listStart !== undefined ? { listStart } : undefined),
  };
}

/** Whether an element holds a block element: a container of paragraphs, not a paragraph. */
const holdsBlock = (element: Element) => {
  for (const each of element.querySelectorAll("*")) {
    if (BLOCK.test(each.tagName.toUpperCase())) return true;
  }
  return false;
};

/** A row's columns in points from the right edges of its cells; nothing when they are all one width. */
function widthsOfEdges(edges: readonly number[]): number[] | undefined {
  const widths = edges.map((edge, at) => edge - (edges[at - 1] ?? 0));
  if (widths.length === 0 || widths.some((width) => width <= 0)) return undefined;
  const least = Math.min(...widths);
  return Math.max(...widths) - least <= 2 ? undefined : widths.map((width) => width / 20);
}

/** A `<table>` of the view as a table. */
function tableOf(element: HTMLElement): RtfTable {
  const rows = [...element.querySelectorAll("tr")]
    .filter((row) => row.closest("table") === element)
    .map((row) =>
      [...row.children]
        .filter((cell) => cell.tagName === "TD" || cell.tagName === "TH")
        .map((cell): RtfCell => {
          const { colSpan, rowSpan, style } = cell as HTMLTableCellElement;
          const background = style.backgroundColor
            ? cssColorToHex(style.backgroundColor)
            : undefined;
          return {
            paragraphs: paragraphsOfContent(cell),
            ...(colSpan > 1 ? { span: colSpan } : undefined),
            ...(rowSpan > 1 ? { rows: rowSpan } : undefined),
            ...(background ? { background } : undefined),
          };
        }),
    );
  const border = Number(element.dataset.border ?? 1);
  const columns = [...element.children]
    .filter((part) => part.tagName === "COLGROUP")
    .flatMap((part) => [...part.children]);
  const widths = columns.map((column) => Number(column.getAttribute("width")) || 0);
  return {
    border: border >= 0 && border <= 3 ? border : 1,
    rows,
    ...(widths.some(Boolean) ? { widths } : undefined),
  };
}

/**
 * The paragraphs of a rich text view's content (`root`: the view, or a fragment of its children),
 * line for line as `readLines` reads its text: a block element starts a line, a `<br>` ends one,
 * and text the browser left bare is a line of its own. A block with no text, no `<br>` and no
 * block inside it (`<div></div>`) is an empty line; a block that only holds other blocks (a list,
 * a `<div>` around paragraphs) adds no line of its own.
 */
export function paragraphsOfContent(root: Node): RtfParagraph[] {
  const paragraphs: RtfParagraph[] = [];
  let current: RtfParagraph | null = null;
  const open = (block: HTMLElement | null) => {
    current ??= { ...paragraphFormat(block), runs: [] };
    return current;
  };
  const flush = () => {
    if (current) paragraphs.push(current);
    current = null;
  };
  const walk = (node: Node, style: RtfStyle, block: HTMLElement | null) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        // A no-break space stays one: it is text, and keeps its words on one line.
        const text = child.nodeValue ?? "";
        if (text) addRun(open(block), text, style);
      } else if (child.nodeType === 1) {
        const element = child as HTMLElement;
        const tag = element.tagName.toUpperCase();
        if (tag === "BR") {
          open(block);
          flush();
        } else if (tag === "IMG") {
          const src = element.getAttribute("src") ?? "";
          if (PICTURE_SOURCE.test(src)) {
            open(block).runs.push({
              text: "",
              style: { ...style },
              picture: {
                src,
                width: Number(element.getAttribute("width")) || 0,
                height: Number(element.getAttribute("height")) || 0,
              },
            });
          }
        } else if (tag === "TABLE") {
          flush();
          paragraphs.push({ align: "left", runs: [], table: tableOf(element) });
        } else if (BLOCK.test(tag)) {
          flush();
          const before = paragraphs.length;
          walk(element, styleWithin(element, style), element);
          if (!current && paragraphs.length === before && !holdsBlock(element)) open(element);
          flush();
        } else walk(element, styleWithin(element, style), block);
      }
    }
  };
  walk(root, DEFAULT_STYLE, null);
  flush();
  return paragraphs.length > 0 ? paragraphs : [{ align: "left", runs: [] }];
}

/** Plain lines as paragraphs of the default format. */
export function paragraphsOfLines(lines: readonly string[]): RtfParagraph[] {
  return (lines.length > 0 ? lines : [""]).map((line) => ({
    align: "left" as const,
    runs: line ? [{ text: line, style: { ...DEFAULT_STYLE } }] : [],
  }));
}

/** The text of each paragraph; a table's rows are lines, their cells a tab apart. */
export const linesOfParagraphs = (paragraphs: readonly RtfParagraph[]): string[] =>
  paragraphs.flatMap((paragraph) =>
    paragraph.table
      ? tableGrid(paragraph.table.rows).map((row) =>
          row
            .map((slot) => (slot.covered ? "" : linesOfParagraphs(slot.cell.paragraphs).join(" ")))
            .join("\t"),
        )
      : [paragraph.runs.map((run) => run.text).join("")],
  );

// ---------------------------------------------------------------------------------------------
// Writing

/** Points as twips (twentieths of a point). */
const twips = (points: number) => Math.round(points * 20);

const TAB_WORDS: Record<TabKind, string> = {
  left: "",
  center: "\\tqc",
  right: "\\tqr",
  decimal: "\\tqdec",
};

/** Tab stops as a paragraph's format: in order, each one's kind before its place. */
const writtenStops = (stops: readonly TabStop[]) =>
  [...stops]
    .sort((one, two) => one.at - two.at)
    .map(({ at, kind }) => `${TAB_WORDS[kind]}\\tx${twips(at)}`)
    .join("");

/** How wide a table is written: a Letter page's text, 6.5 inches. */
const TABLE_WIDTH_TWIPS = 9360;

/**
 * How deep tables inside tables are read: a file's `\itap` is not believed past what a browser's
 * parser can hold, 512 nested elements at four to a level.
 */
export const MOST_TABLE_DEPTH = 128;

/** Text as RTF writes it: the three special characters escaped, tabs and non-ASCII as words. */
function escapeText(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\\" || char === "{" || char === "}") out += `\\${char}`;
    else if (char === "\t") out += "\\tab ";
    else if (char === "\n" || char === "\r") out += "\\line ";
    else if (code < 0x20) continue;
    else if (code < 0x80) out += char;
    else {
      // One \u per UTF-16 unit, each with "?" for readers that know no Unicode.
      for (let index = 0; index < char.length; index += 1) {
        const unit = char.charCodeAt(index);
        out += `\\u${unit > 0x7fff ? unit - 0x10000 : unit}?`;
      }
    }
  }
  return out;
}

const FONT_CLASS: Record<string, string> = {
  Courier: "modern",
  Menlo: "modern",
  Monaco: "modern",
  Times: "roman",
  "Times New Roman": "roman",
  Georgia: "roman",
  Baskerville: "roman",
  Palatino: "roman",
};

/** The RTF font class (`\fmodern`) of each generic family, and back. */
const CLASS_OF_GENERIC: Record<GenericFamily, string> = {
  serif: "roman",
  "sans-serif": "swiss",
  monospace: "modern",
  cursive: "script",
};
const GENERIC_OF_CLASS: Record<string, GenericFamily> = {
  froman: "serif",
  fswiss: "sans-serif",
  fmodern: "monospace",
  fscript: "cursive",
};

const rgb = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `\\red${(value >> 16) & 255}\\green${(value >> 8) & 255}\\blue${value & 255};`;
};

/** A picture as RTF's `\pict`: its bytes in hexadecimal, its size in pixels and in twips. */
function writtenPicture({ src, width, height }: RtfPicture): string {
  const [head = "", data = ""] = src.split(",");
  const binary = atob(data);
  let hex = "";
  for (let at = 0; at < binary.length; at += 1) {
    hex += binary.charCodeAt(at).toString(16).padStart(2, "0");
  }
  const blip = head.includes("png") ? "\\pngblip" : "\\jpegblip";
  return (
    `{\\pict${blip}\\picw${Math.round(width)}\\pich${Math.round(height)}` +
    `\\picwgoal${twips(width)}\\pichgoal${twips(height)}\n${hex}}`
  );
}

/** The words of a field of `\info`, as this writer writes them. */
const INFO_WORD: Record<keyof TextEditProperties, string> = {
  author: "\\author",
  organization: "\\*\\company",
  copyright: "\\*\\copyright",
  title: "\\title",
  subject: "\\subject",
  keywords: "\\keywords",
  comment: "\\doccomm",
};

/** The field a word of `\info` starts. */
const PROPERTY_OF_WORD = new Map<string, keyof TextEditProperties>(
  PROPERTY_FIELDS.map(({ key }) => [
    INFO_WORD[key].slice(INFO_WORD[key].lastIndexOf("\\") + 1),
    key,
  ]),
);

/** A document's properties as RTF's `\info`: the group is left out when there are none. */
const writtenInfo = (properties: TextEditProperties | undefined) => {
  const groups = PROPERTY_FIELDS.flatMap(({ key }) => {
    const text = properties?.[key];
    return text ? [`{${INFO_WORD[key]} ${escapeText(text)}}`] : [];
  });
  return groups.length > 0 ? `{\\info${groups.join("")}}\n` : "";
};

/**
 * A document as an RTF file: its paragraphs, and the ruler's indents and tab stops on every
 * paragraph, as TextEdit writes them.
 */
export function writeRtf(
  paragraphs: readonly RtfParagraph[],
  ruler?: TextEditRuler,
  properties?: TextEditProperties,
): string {
  // The font table: one entry per family and class, so two runs of one family the library does
  // not know, with different generic families, each keep theirs.
  const fonts: { family: string; kind: string }[] = [
    { family: DEFAULT_STYLE.family, kind: FONT_CLASS[DEFAULT_STYLE.family] ?? "swiss" },
  ];
  const colors: string[] = [];
  const fontIndex = (style: RtfStyle) => {
    const kind =
      FONT_CLASS[style.family] ?? (style.generic ? CLASS_OF_GENERIC[style.generic] : "swiss");
    let at = fonts.findIndex((each) => each.family === style.family && each.kind === kind);
    if (at < 0) at = fonts.push({ family: style.family, kind }) - 1;
    return at;
  };
  // Colour 0 is the automatic colour, the table's empty first entry.
  const colorIndex = (hex: string) => {
    let at = colors.indexOf(hex);
    if (at < 0) at = colors.push(hex) - 1;
    return at + 1;
  };
  const tabs = writtenStops(leftStops(ruler?.tabStops ?? []));
  const indents = ruler
    ? `\\li${twips(ruler.head)}\\fi${twips(ruler.first - ruler.head)}\\ri${twips(ruler.tail)}`
    : "";
  const align = { left: "\\ql", center: "\\qc", right: "\\qr", justify: "\\qj" } as const;
  /**
   * A paragraph's format and text, up to its end: in a cell it ends with `\cell` or `\par`.
   * `depth` is how many tables it is inside.
   */
  const written = (paragraph: RtfParagraph, depth: number) => {
    const table = depth > 0 ? `\\intbl\\itap${depth}` : "";
    const natural = paragraph.direction && paragraph.align === "left" && !paragraph.leftSet;
    let line = `\\pard${table}${paragraph.tabs ? writtenStops(paragraph.tabs) : tabs}${
      paragraph.indents
        ? `\\li${twips(paragraph.indents.head)}\\fi${twips(paragraph.indents.first - paragraph.indents.head)}\\ri${twips(paragraph.indents.tail)}`
        : indents
    }${natural ? "" : align[paragraph.align]}`;
    if (paragraph.spacing) {
      line += `\\sl${Math.round(240 * Number(paragraph.spacing))}\\slmult1`;
    }
    if (paragraph.before) line += `\\sb${twips(paragraph.before)}`;
    if (paragraph.after) line += `\\sa${twips(paragraph.after)}`;
    line +=
      paragraph.direction === "rtl"
        ? "\\rtlpar"
        : paragraph.direction === "ltr"
          ? "\\ltrpar"
          : "\\pardirnatural";
    if (paragraph.direction === "auto") line += "{\\*\\macaliciousdirauto}";
    line += "\\partightenfactor0";
    if (paragraph.list) line += `{\\*\\macaliciouslist ${paragraph.list}}`;
    if (paragraph.listStart !== undefined)
      line += `{\\*\\macaliciouslistat ${paragraph.listStart}}`;
    line += "\n";
    // An empty paragraph still says its font and size, for the line's height.
    const runs = paragraph.runs.length > 0 ? paragraph.runs : [{ text: "", style: DEFAULT_STYLE }];
    for (const { text, style, picture } of runs) {
      if (picture) {
        line += writtenPicture(picture);
        continue;
      }
      const format =
        `\\f${fontIndex(style)}\\fs${Math.round(style.size * 2)}` +
        `\\b${style.bold ? "" : "0"}\\i${style.italic ? "" : "0"}` +
        `${style.underline ? "\\ul" : "\\ulnone"}\\strike${style.strikethrough ? "" : "0"}` +
        `\\cf${style.color ? colorIndex(style.color) : 0}` +
        `\\cb${style.highlight ? colorIndex(style.highlight) : 0}` +
        `${style.script === "super" ? "\\super" : style.script === "sub" ? "\\sub" : "\\nosupersub"} `;
      line += style.link
        ? `{\\field{\\*\\fldinst{HYPERLINK "${escapeText(style.link)}"}}{\\fldrslt ${format}${escapeText(text)}}}`
        : format + escapeText(text);
    }
    return line;
  };
  /** A table as RTF's rows: each says its cells' edges first, then holds their paragraphs. */
  /** A table, as RTF nests one: below the top, its row properties follow each row's cells. */
  const writtenTable = (table: RtfTable, depth: number): string => {
    const { border, rows } = table;
    const endCell = depth === 1 ? "\\cell" : "\\nestcell";
    const cellText = (cell: RtfCell) => {
      const last = cell.paragraphs.length - 1;
      if (last < 0) return `${endCell}\n`;
      return cell.paragraphs
        .map((each, at) => {
          if (!each.table) return `${written(each, depth)}${at === last ? endCell : "\\par"}\n`;
          const inner = writtenTable(each.table, depth + 1);
          return at === last
            ? `${inner}\\pard\\intbl\\itap${depth}{\\*\\macaliciouscellend}${endCell}\n`
            : inner;
        })
        .join("");
    };
    const edges =
      border > 0
        ? ["t", "l", "b", "r"].map((side) => `\\clbrdr${side}\\brdrs\\brdrw${border * 20}`).join("")
        : "";
    const spans = columnSpans(table, TABLE_WIDTH_TWIPS, 20);
    return tableGrid(rows)
      .map((row) => {
        const columns = row.reduce((sum, slot) => sum + slot.span, 0);
        // A row with fewer columns than the table's other rows shares the width evenly.
        const widthAt = (column: number) =>
          columns === spans.length
            ? spans.slice(0, column).reduce((sum, width) => sum + width, 0)
            : (TABLE_WIDTH_TWIPS * column) / columns;
        let edge = 0;
        let at = 0;
        let head = "\\trowd\\trgaph108\\trleft0";
        let cells = "";
        for (const { cell, span, covered } of row) {
          const shade = cell.background ? `\\clcbpat${colorIndex(cell.background)}` : "";
          const down = covered ? "\\clvmrg" : (cell.rows ?? 1) > 1 ? "\\clvmgf" : "";
          for (let part = 0; part < span; part += 1) {
            at += 1;
            edge = Math.round(widthAt(at));
            const merge = span > 1 ? (part === 0 ? "\\clmgf" : "\\clmrg") : "";
            head += `${merge}${down}${edges}${shade}\\cellx${edge}`;
          }
          cells += covered ? `\\pard\\intbl\\itap${depth}${endCell}\n` : cellText(cell);
          for (let part = 1; part < span; part += 1) {
            cells += `\\pard\\intbl\\itap${depth}${endCell}\n`;
          }
        }
        return depth === 1
          ? `${head}\n${cells}\\row\n`
          : `${cells}{\\*\\nesttableprops${head}\n\\nestrow}\n`;
      })
      .join("")
      .concat("{\\*\\macaliciousnestedend}", depth === 1 ? "\n" : "{\\nonesttables\\par}\n");
  };
  const body: string[] = [];
  for (const paragraph of paragraphs) {
    body.push(
      paragraph.table ? writtenTable(paragraph.table, 1) : `${written(paragraph, 0)}\\par\n`,
    );
  }
  const fontTable = fonts
    .map(({ family, kind }, index) => `\\f${index}\\f${kind}\\fcharset0 ${escapeText(family)};`)
    .join("");
  return (
    OWN_RTF_HEADER +
    `{\\fonttbl${fontTable}}\n` +
    `{\\colortbl;${colors.map(rgb).join("")}}\n` +
    writtenInfo(properties) +
    `\\paperw12240\\paperh15840\\margl1440\\margr1440\\vieww12000\\viewh15840\\viewkind0\n` +
    `${body.join("")}}\n`
  );
}

/**
 * How every RTF file TextEdit writes begins: Windows-1252, with every other character a `\u`
 * escape, so the file is 7-bit text.
 */
export const OWN_RTF_HEADER = "{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1\n";

// ---------------------------------------------------------------------------------------------
// Reading

/** Windows-1252's characters at 0x80 to 0x9F; the rest of the code page is Latin-1. */
const CP1252 =
  "\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f" +
  "\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178";

const byteChar = (code: number) =>
  code >= 0x80 && code <= 0x9f ? CP1252[code - 0x80] : String.fromCharCode(code);

/**
 * The code page of each font character set (`\fcharsetN`). 0 (ANSI) and 1 (the default) have
 * none: such a font's bytes are in the document's code page (`\ansicpgN`).
 */
const CHARSET_CODE_PAGES: Record<number, number> = {
  // Symbol: the glyphs of a symbol font, read as Western text.
  2: 1252,
  77: 10000,
  128: 932,
  129: 949,
  130: 1361,
  134: 936,
  136: 950,
  161: 1253,
  162: 1254,
  163: 1258,
  177: 1255,
  178: 1256,
  186: 1257,
  204: 1251,
  222: 874,
  238: 1250,
  255: 437,
};

/** The encoding label `TextDecoder` knows a Windows code page by, if it knows it. */
function decoderLabel(codePage: number): string | undefined {
  if (codePage >= 1250 && codePage <= 1258) return `windows-${codePage}`;
  if (codePage >= 28591 && codePage <= 28599) return `iso-8859-${codePage - 28590}`;
  const labels: Record<number, string> = {
    866: "ibm866",
    874: "windows-874",
    932: "shift_jis",
    936: "gbk",
    949: "euc-kr",
    950: "big5",
    10000: "macintosh",
    20866: "koi8-r",
    54936: "gb18030",
    65001: "utf-8",
  };
  return labels[codePage];
}

const decoders = new Map<number, TextDecoder | null>();

function decoderFor(codePage: number): TextDecoder | null {
  let decoder = decoders.get(codePage);
  if (decoder === undefined) {
    const label = decoderLabel(codePage);
    decoder = null;
    try {
      if (label) decoder = new TextDecoder(label);
    } catch {
      // A label this browser does not know: the caller falls back to Windows-1252.
    }
    decoders.set(codePage, decoder);
  }
  return decoder;
}

/** Bytes as text in a code page; Windows-1252 for one the browser cannot decode. */
function decodeBytes(bytes: readonly number[], codePage: number): string {
  const decoder = decoderFor(codePage) ?? decoderFor(1252);
  return decoder ? decoder.decode(Uint8Array.from(bytes)) : bytes.map(byteChar).join("");
}

/** Whether `byte` starts a two-byte character in the double-byte code page `codePage`. */
const isLeadByte = (byte: number, codePage: number) =>
  codePage === 932
    ? (byte >= 0x81 && byte <= 0x9f) || (byte >= 0xe0 && byte <= 0xfc)
    : (codePage === 936 || codePage === 949 || codePage === 950) && byte >= 0x81 && byte <= 0xfe;

const isDigit = (byte: number | undefined) => byte !== undefined && byte >= 0x30 && byte <= 0x39;
const isLetter = (byte: number | undefined) =>
  byte !== undefined && ((byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a));
const hexByte = (byte: number) => `\\'${byte.toString(16).padStart(2, "0")}`;

/** What `rtfTextOfBytes` follows of a group: the font its text is in, and the font table. */
interface ByteGroup {
  font: number;
  fonttbl: boolean;
}

/**
 * An RTF file's bytes as the text `readRtf` reads. RTF is a 7-bit format whose 8-bit text is in
 * the code page the file declares, so each byte from 0x80 up becomes the `\'hh` escape it stands
 * for, and the reader decodes it in the code page in effect where it is: the result is ASCII and
 * reads the same wherever it is kept (a version of the file is kept as this text). A `\binN`
 * payload is dropped, as the reader would drop it.
 *
 * A literal lead byte of a double-byte code page (932, 936, 949, 950) takes the next byte as its
 * trail byte whatever it is, so a trail byte that happens to be `\`, `{` or `}` (Shift-JIS `ソ` is
 * 0x83 0x5C) is never read as RTF syntax: both become escapes. To know where that applies the
 * conversion follows what the reader follows for code pages: `\ansicpgN`, the font table's
 * `\fcharsetN` and `\cpgN` for each font, and the font in effect in each group (`\fN`, `\deffN`,
 * `\plain`). Everywhere else a byte below 0x80 keeps its RTF meaning.
 *
 * A file that is not RTF is read as UTF-8. RTF is never guessed to be UTF-8: its bytes are read
 * in the code page it declares, and `readRtf` says when text is in one TextEdit on Ferrite does
 * not open (anything but Windows-1252).
 */
export function rtfTextOfBytes(bytes: Uint8Array): string {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = bom ? bytes.subarray(3) : bytes;
  let out = "";
  let documentCodePage = 1252;
  let defaultFont = 0;
  let fontNumber = 0;
  const fontCodePages = new Map<number, number>();
  let group: ByteGroup = { font: 0, fonttbl: false };
  const stack: ByteGroup[] = [];
  const codePage = () =>
    fontCodePages.get(group.fonttbl ? fontNumber : group.font) ?? documentCodePage;
  /** Whether the byte at `at` is a lead byte, with a trail byte after it, in the page in effect. */
  const pairAt = (at: number) => at + 1 < body.length && isLeadByte(body[at] as number, codePage());
  const control = (name: string, param: number | null) => {
    switch (name) {
      case "ansi":
        documentCodePage = 1252;
        return;
      case "mac":
        documentCodePage = 10000;
        return;
      case "pc":
        documentCodePage = 437;
        return;
      case "pca":
        documentCodePage = 850;
        return;
      case "ansicpg":
        if (param && param > 0) documentCodePage = param;
        return;
      case "fonttbl":
        group.fonttbl = true;
        return;
      case "fcharset": {
        const page = CHARSET_CODE_PAGES[param ?? 0];
        if (group.fonttbl && page) fontCodePages.set(fontNumber, page);
        return;
      }
      case "cpg":
        if (group.fonttbl && param && param > 0) fontCodePages.set(fontNumber, param);
        return;
      case "deff":
        defaultFont = param ?? 0;
        group.font = defaultFont;
        return;
      case "plain":
        group.font = defaultFont;
        return;
      case "f":
        if (group.fonttbl) fontNumber = param ?? 0;
        else group.font = param ?? 0;
        return;
    }
  };
  for (let index = 0; index < body.length; ) {
    const byte = body[index] as number;
    if (byte === 0x7b) {
      stack.push(group);
      group = { ...group };
      out += "{";
      index += 1;
    } else if (byte === 0x7d) {
      group = stack.pop() ?? { font: defaultFont, fonttbl: false };
      out += "}";
      index += 1;
    } else if (byte === 0x5c) {
      const next = body[index + 1];
      // `\binN`: skip the payload after the delimiting space.
      if (
        next === 0x62 &&
        body[index + 2] === 0x69 &&
        body[index + 3] === 0x6e &&
        (isDigit(body[index + 4]) || (body[index + 4] === 0x2d && isDigit(body[index + 5])))
      ) {
        let at = index + 4;
        let digits = body[at] === 0x2d ? "-" : "";
        if (digits) at += 1;
        while (isDigit(body[at]) && digits.length < 11) {
          digits += String.fromCharCode(body[at] as number);
          at += 1;
        }
        if (body[at] === 0x20) at += 1;
        out += "\\bin0 ";
        index = at + Math.max(0, Number(digits));
        continue;
      }
      if (next !== undefined && next >= 0x80) {
        // A backslash before an 8-bit byte is no control symbol: the reader drops both, and a
        // double-byte character's trail byte with them.
        index += pairAt(index + 1) ? 3 : 2;
        continue;
      }
      if (isLetter(next)) {
        // A control word, as the reader parses it: up to 32 letters, an optional number, and an
        // optional delimiting space.
        let at = index + 1;
        let name = "";
        while (isLetter(body[at]) && name.length < 32) {
          name += String.fromCharCode(body[at] as number);
          at += 1;
        }
        let digits = "";
        if (body[at] === 0x2d && isDigit(body[at + 1])) {
          digits = "-";
          at += 1;
        }
        while (isDigit(body[at]) && digits.replace("-", "").length < 10) {
          digits += String.fromCharCode(body[at] as number);
          at += 1;
        }
        if (body[at] === 0x20) at += 1;
        control(name, digits ? Number(digits) : null);
        out += String.fromCharCode(...body.subarray(index, at));
        index = at;
        continue;
      }
      out += next === undefined ? "\\" : `\\${String.fromCharCode(next)}`;
      index += 2;
    } else if (byte >= 0x80) {
      if (pairAt(index)) {
        // A lead byte and its trail byte, whatever the trail byte's value.
        out += hexByte(byte) + hexByte(body[index + 1] as number);
        index += 2;
      } else {
        out += hexByte(byte);
        index += 1;
      }
    } else {
      out += String.fromCharCode(byte);
      index += 1;
    }
  }
  // Not RTF: text, in UTF-8. RTF stays in the code page it declares.
  if (!/^\s*\{\\rtf/.test(out)) return new TextDecoder().decode(body);
  return out;
}

/**
 * Whether a control word is one whose text the reader does not read: the double-byte and Unicode
 * destinations (`\upr`, `\ud`) and the double-byte font association (`\dbch`). A declared code
 * page or character set alone is no such word: text in 7-bit escapes reads the same in any of
 * them, and only bytes that would be decoded in one other than Windows-1252 make a file one
 * TextEdit on Ferrite does not open (`readRtf`).
 */
const unreadable = (name: string) => name === "upr" || name === "ud" || name === "dbch";

/** Destinations whose text is never document text. */
const SKIPPED = new Set([
  "nonesttables",
  "stylesheet",
  "pict",
  "header",
  "headerl",
  "headerr",
  "headerf",
  "footer",
  "footerl",
  "footerr",
  "footerf",
  "footnote",
  "listtable",
  "listoverridetable",
  "listtext",
  "pntext",
  "pntxta",
  "pntxtb",
  "fldinst",
  "object",
  "themedata",
  "colorschememapping",
  "latentstyles",
  "datastore",
  "xmlnstbl",
  "rsidtbl",
  "generator",
  "filetbl",
  "revtbl",
  "bkmkstart",
  "bkmkend",
  "expandedcolortbl",
  "nonshppict",
  "shp",
]);

const SYMBOLS: Record<string, string> = {
  tab: "\t",
  emdash: "\u2014",
  endash: "\u2013",
  bullet: "\u2022",
  lquote: "\u2018",
  rquote: "\u2019",
  ldblquote: "\u201c",
  rdblquote: "\u201d",
  emspace: "\u2003",
  enspace: "\u2002",
};

/** A PostScript name split at the hyphen after which only face words follow. */
const FAMILY_AND_FACE =
  /^(.+?)-((?:(?:ultra|extra|semi|demi|bold|black|heavy|italic|oblique|roman|regular|book|medium|light|thin|condensed|narrow|mt|ps)-?)+)$/i;

/**
 * A PostScript name's family and face: `Helvetica-BoldOblique`, `TimesNewRomanPSMT`,
 * `My-Custom-Font-Bold`. Hyphens before the face belong to the family's name.
 */
function fontOfName(raw: string): { family: string; bold: boolean; italic: boolean } {
  const name = raw.trim();
  const split = FAMILY_AND_FACE.exec(name);
  const base = split?.[1] ?? name;
  const face = split?.[2] ?? "";
  const bold = /bold|black|heavy/i.test(face);
  const italic = /italic|oblique/i.test(face);
  const exact = findFontFamily(name) ?? findFontFamily(base);
  if (exact) return { family: exact.name, bold, italic };
  const squeeze = (value: string) => value.replace(/(PSMT|PS|MT)$/, "").replace(/[\s-]/g, "");
  const wanted = squeeze(base).toLowerCase();
  const known = FONT_FAMILIES.find((family) => squeeze(family.name).toLowerCase() === wanted);
  if (known) return { family: known.name, bold, italic };
  // "Times-Roman" is Times; anything else keeps the name it has.
  if (/^times$/i.test(base)) return { family: "Times", bold, italic };
  return { family: base, bold, italic };
}

interface GroupState {
  style: RtfStyle;
  font: number;
  /** Characters of a `\u` fallback still to skip, and how many each `\u` has. */
  uc: number;
  destination:
    | "text"
    | "skip"
    | "fonttbl"
    | "colortbl"
    | "list"
    | "listat"
    | "info"
    | "property"
    | "fldinst"
    | "pict";
}

interface ParagraphState {
  align: TextEditAlignment;
  leftSet?: boolean;
  spacing?: string;
  list?: string;
  listStart?: number;
  direction?: WritingDirection;
  /** `\intbl`: the paragraph is in a cell of a table. */
  inTable?: boolean;
  left: number;
  first: number;
  right: number;
  tabs: TabStop[];
  /** `\tqc`, `\tqr` or `\tqdec`, for the `\tx` that follows. */
  tabKind?: TabKind;
  /** `\slN`, in twips, and whether `\slmult1` makes it a multiple of single spacing. */
  sl?: number;
  slmult?: boolean;
  /** `\sbN` and `\saN`: the space before and after, in twips. */
  sb?: number;
  sa?: number;
}

const freshParagraph = (): ParagraphState => ({
  align: "left",
  left: 0,
  first: 0,
  right: 0,
  tabs: [],
});

/**
 * Where the `count` bytes of a `\binN` payload that starts at `from` end in `text`. A file read
 * from its bytes has no payload left (`rtfTextOfBytes`); text that was decoded as UTF-8 counts
 * the bytes each character was encoded in, and a replacement character (an undecodable byte) one.
 */
function binaryEnd(text: string, from: number, count: number): number {
  let index = from;
  let bytes = 0;
  while (index < text.length && bytes < count) {
    const code = text.codePointAt(index) ?? 0;
    bytes += code === 0xfffd ? 1 : code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    index += code > 0xffff ? 2 : 1;
  }
  return index;
}

/** The spacing name nearest a multiple of the line height. */
function spacingOf(multiple: number): string | undefined {
  if (!(multiple > 1.05)) return undefined;
  let best = SPACINGS[0];
  for (const each of SPACINGS) {
    if (Math.abs(Number(each) - multiple) < Math.abs(Number(best) - multiple)) best = each;
  }
  return best;
}

/** What `readRtf` reads: the paragraphs, and the ruler of the first paragraph that set one. */
export interface RtfDocument {
  paragraphs: RtfParagraph[];
  ruler?: TextEditRuler;
  /** The file's `\info`, those that have text. */
  properties?: TextEditProperties;
  /**
   * The file has text in a code page the browser does not decode (bytes, `\'hh` or literal, that
   * would be decoded in it), or text the reader does not read (`unreadable`): it is not opened.
   */
  unsupported?: true;
}

/**
 * An RTF file's paragraphs. Text that is not RTF (no `{\rtf` at its start) is read as plain
 * lines, so a mislabelled text file still opens.
 */
function pictureOfRtf(read: {
  hex: string;
  type?: "png" | "jpeg";
  pixels: { width: number; height: number };
  goal: { width: number; height: number };
  scale: { x: number; y: number };
}): RtfPicture | null {
  const hex = read.hex.replace(/[^0-9a-f]/gi, "");
  if (!read.type || hex.length < 2) return null;
  let binary = "";
  for (let at = 0; at + 1 < hex.length; at += 2) {
    binary += String.fromCharCode(Number.parseInt(hex.slice(at, at + 2), 16));
  }
  const width = read.goal.width ? read.goal.width / 20 : read.pixels.width;
  const height = read.goal.height ? read.goal.height / 20 : read.pixels.height;
  return {
    src: `data:image/${read.type};base64,${btoa(binary)}`,
    width: Math.round((width * read.scale.x) / 100),
    height: Math.round((height * read.scale.y) / 100),
  };
}

export function readRtf(source: string): RtfDocument {
  const text = source.replace(/^\uFEFF/, "");
  if (!/^\s*\{\\rtf/.test(text)) {
    return { paragraphs: paragraphsOfLines(text.replace(/\r\n?/g, "\n").split("\n")) };
  }
  const fonts = new Map<number, ReturnType<typeof fontOfName>>();
  // Each font's class in the font table (`\fmodern`), as the generic family it stands for.
  const fontClasses = new Map<number, GenericFamily>();
  const colors: (string | undefined)[] = [];
  let defaultFont = 0;
  const paragraphs: RtfParagraph[] = [];
  let ruler: TextEditRuler | undefined;
  // Each paragraph's indents: the document's ruler is the first that sets any, and one that differs keeps its own.
  const indented: [RtfParagraph, NonNullable<RtfParagraph["indents"]>][] = [];
  // Each paragraph's tab stops: those that differ from the document's stay on it.
  const tabbed: [RtfParagraph, TabStop[]][] = [];
  let paragraph = freshParagraph();
  let runs: RtfRun[] = [];
  let started = false;
  const base = (): GroupState => ({
    style: { ...DEFAULT_STYLE },
    font: defaultFont,
    uc: 1,
    destination: "text",
  });
  let state = base();
  const stack: GroupState[] = [];
  // The paragraph's format as each open group found it: a group's paragraph format ends with it,
  // as its character format does.
  const paragraphStack: ParagraphState[] = [];
  // The font table entry being read, the colour being read and the list style being read.
  let fontNumber = 0;
  let fontName = "";
  let color: { r: number; g: number; b: number } | null = null;
  let listName = "";
  // The field whose instruction is being read, and the address it links its result to.
  let fieldInstruction = "";
  let fieldLink: string | undefined;
  // The picture being read. Only PNG and JPEG are kept: other kinds (`\wmetafile`, `\macpict`) are dropped.
  let picture = null as {
    hex: string;
    type?: "png" | "jpeg";
    pixels: { width: number; height: number };
    goal: { width: number; height: number };
    scale: { x: number; y: number };
  } | null;
  const properties: TextEditProperties = {};
  let property: keyof TextEditProperties | undefined;
  // A `\*` waits for the control word after it: an unknown one skips its group.
  let ignorable = false;
  let unsupported = false;
  // Characters of a `\u` fallback still to skip.
  let skip = 0;
  // The document's code page (`\ansicpgN`) and each font's (`\fcharsetN`, `\cpgN`), which wins:
  // what a run of `\'hh` bytes is.
  let documentCodePage = 1252;
  const fontCodePages = new Map<number, number>();
  const codePage = () =>
    fontCodePages.get(state.destination === "fonttbl" ? fontNumber : state.font) ??
    documentCodePage;

  const styleOf = (group: GroupState): RtfStyle => {
    const font = fonts.get(group.font);
    const style: RtfStyle = {
      ...group.style,
      family: font?.family ?? group.style.family,
      bold: group.style.bold || (font?.bold ?? false),
      italic: group.style.italic || (font?.italic ?? false),
    };
    // A family the library does not know keeps the kind of font the font table says it is.
    const generic = font && !findFontFamily(font.family) ? fontClasses.get(group.font) : undefined;
    if (generic) style.generic = generic;
    else delete style.generic;
    return style;
  };
  const emit = (chars: string) => {
    if (state.destination === "fonttbl") {
      fontName += chars;
      const end = fontName.indexOf(";");
      if (end >= 0) {
        fonts.set(fontNumber, fontOfName(fontName.slice(0, end)));
        fontName = "";
      }
      return;
    }
    if (state.destination === "colortbl") {
      for (const char of chars) {
        if (char !== ";") continue;
        colors.push(
          color
            ? `#${[color.r, color.g, color.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
            : undefined,
        );
        color = null;
      }
      return;
    }
    if (state.destination === "list" || state.destination === "listat") {
      listName += chars;
      return;
    }
    if (state.destination === "property") {
      if (property) properties[property] = (properties[property] ?? "") + chars;
      return;
    }
    if (state.destination === "fldinst") {
      fieldInstruction += chars;
      return;
    }
    if (state.destination === "pict") {
      if (picture) picture.hex += chars;
      return;
    }
    if (state.destination !== "text" || !chars) return;
    started = true;
    const style = styleOf(state);
    const last = runs.at(-1);
    if (last && !last.picture && sameStyle(last.style, style)) last.text += chars;
    else runs.push({ text: chars, style });
  };
  // The table being read: the row's cell definitions, then its cells' paragraphs.
  type CellDefinition = {
    merged: boolean;
    down?: boolean;
    shade?: number;
    border?: number;
    edge?: number;
  };
  let definitions: CellDefinition[] = [];
  let definition: CellDefinition = { merged: false };
  let cellParagraphs: RtfParagraph[] = [];
  let rowCells: RtfCell[] = [];
  let tableRows: RtfCell[][] = [];
  let tableBorder = 0;
  let tableWidths: number[] | undefined;
  // The cell that stands at each column of the row before, which `\clvmrg` joins.
  let rowAbove: (RtfCell | undefined)[] = [];
  const tableParagraph = (): RtfParagraph => ({
    align: "left",
    runs: [],
    table: {
      border: Math.min(3, tableBorder),
      rows: tableRows,
      ...(tableWidths ? { widths: tableWidths } : undefined),
    },
  });
  const endTable = () => {
    if (tableRows.length === 0) return;
    paragraphs.push(tableParagraph());
    tableRows = [];
    tableBorder = 0;
    tableWidths = undefined;
    rowAbove = [];
  };
  const endRow = () => {
    const row: RtfCell[] = [];
    const owners: (RtfCell | undefined)[] = [];
    if (rowCells.length > 0 && tableRows.length === 0) {
      tableWidths = widthsOfEdges(definitions.map((each) => each.edge ?? 0));
    }
    const withText = (cell: RtfCell) =>
      cell.paragraphs.filter(
        (each) => each.table || each.runs.some((run) => run.text !== "" || run.picture),
      );
    for (const [at, cell] of rowCells.entries()) {
      const made = definitions[at];
      const above = made?.down ? rowAbove[at] : undefined;
      if (above) {
        if (owners[at - 1] !== above) above.rows = (above.rows ?? 1) + 1;
        // Text in a cell merged into the one above stays, in that one.
        above.paragraphs.push(...withText(cell));
        owners[at] = above;
        continue;
      }
      const last = row.at(-1);
      if (made?.merged && last && owners[at - 1] === last) {
        last.span = (last.span ?? 1) + 1;
        // Text in a cell merged into the one before stays, in that one.
        last.paragraphs.push(...withText(cell));
        owners[at] = last;
        continue;
      }
      const background = made?.shade === undefined ? undefined : colors[made.shade];
      const own = { ...cell, ...(background ? { background } : undefined) };
      row.push(own);
      owners[at] = own;
      if (made?.border) tableBorder = Math.max(tableBorder, made.border);
    }
    if (row.length > 0 || owners.length > 0) tableRows.push(row);
    rowAbove = owners;
    rowCells = [];
  };
  // The tables around the one being read, with what each had read when the next one began.
  // A cell has to end in a paragraph, so one that ends in a table has an empty one written after
  // it, which this says is not one of the cell's.
  let cellEndOnly = false;
  const outerTables: {
    definitions: CellDefinition[];
    definition: CellDefinition;
    cellParagraphs: RtfParagraph[];
    rowCells: RtfCell[];
    tableRows: RtfCell[][];
    tableBorder: number;
    tableWidths: number[] | undefined;
    rowAbove: (RtfCell | undefined)[];
  }[] = [];
  /** Reads on `depth` tables in: a deeper table begins, or those deeper than it end in their cell. */
  const setTableDepth = (depth: number) => {
    const wanted = Math.min(MOST_TABLE_DEPTH, Math.max(1, depth));
    while (outerTables.length + 1 < wanted) {
      outerTables.push({
        definitions,
        definition,
        cellParagraphs,
        rowCells,
        tableRows,
        tableBorder,
        tableWidths,
        rowAbove,
      });
      definitions = [];
      definition = { merged: false };
      cellParagraphs = [];
      rowCells = [];
      tableRows = [];
      tableBorder = 0;
      tableWidths = undefined;
      rowAbove = [];
    }
    while (outerTables.length + 1 > wanted) {
      // A cell or a row that ended only by the table ending keeps its text.
      if (cellParagraphs.length > 0) {
        rowCells.push({ paragraphs: cellParagraphs });
        cellParagraphs = [];
      }
      endRow();
      const inner = tableRows.length > 0 ? tableParagraph() : null;
      ({
        definitions,
        definition,
        cellParagraphs,
        rowCells,
        tableRows,
        tableBorder,
        tableWidths,
        rowAbove,
      } = outerTables.pop() as (typeof outerTables)[number]);
      if (inner) cellParagraphs.push(inner);
    }
  };
  const endParagraph = () => {
    const ended: RtfParagraph = {
      align: paragraph.align,
      ...(paragraph.spacing ? { spacing: paragraph.spacing } : undefined),
      ...(paragraph.sb ? { before: paragraph.sb / 20 } : undefined),
      ...(paragraph.sa ? { after: paragraph.sa / 20 } : undefined),
      ...(paragraph.list ? { list: paragraph.list } : undefined),
      ...(paragraph.listStart !== undefined ? { listStart: paragraph.listStart } : undefined),
      ...(paragraph.direction
        ? {
            direction: paragraph.direction,
            ...(paragraph.leftSet && paragraph.align === "left" ? { leftSet: true } : undefined),
          }
        : undefined),
      runs,
    };
    if (paragraph.inTable) cellParagraphs.push(ended);
    else {
      setTableDepth(1);
      endTable();
      paragraphs.push(ended);
    }
    if (
      !ruler &&
      (paragraph.tabs.length > 0 || paragraph.left || paragraph.first || paragraph.right)
    ) {
      ruler = {
        first: Math.max(0, paragraph.left + paragraph.first) / 20,
        head: Math.max(0, paragraph.left) / 20,
        tail: Math.max(0, paragraph.right) / 20,
        tabStops: paragraph.tabs.map((stop) => stop.at),
      };
    }
    if (paragraph.tabs.length > 0) tabbed.push([ended, paragraph.tabs]);
    indented.push([
      ended,
      {
        first: Math.max(0, paragraph.left + paragraph.first) / 20,
        head: Math.max(0, paragraph.left) / 20,
        tail: Math.max(0, paragraph.right) / 20,
      },
    ]);
    runs = [];
    started = false;
  };
  const endCell = () => {
    paragraph.inTable = true;
    endParagraph();
    if (cellEndOnly) {
      cellEndOnly = false;
      cellParagraphs.pop();
    }
    rowCells.push({ paragraphs: cellParagraphs });
    cellParagraphs = [];
  };
  const word = (name: string, param: number | null) => {
    if (unreadable(name)) unsupported = true;
    const on = param === null || param !== 0;
    if (ignorable) {
      ignorable = false;
      // A nested row's cell definitions, and its end: the group's words are read as any others.
      if (name === "nesttableprops") return;
      if (name === "shppict") return;
      if (name === "fldinst" && state.destination === "text") {
        state.destination = "fldinst";
        fieldInstruction = "";
        fieldLink = undefined;
        return;
      }
      if (name === "fldrslt") {
        if (fieldLink) state.style.link = fieldLink;
        return;
      }
      if (state.destination === "info" && PROPERTY_OF_WORD.has(name)) {
        property = PROPERTY_OF_WORD.get(name);
        state.destination = "property";
        return;
      }
      // The table ends here, so that another straight after it is a table of its own.
      if (name === "macaliciousnestedend") {
        if (outerTables.length === 0) endTable();
        else setTableDepth(outerTables.length);
      }
      if (name === "macaliciouscellend") cellEndOnly = true;
      if (name === "macaliciousdirauto") paragraph.direction = "auto";
      if (name === "macaliciouslist" || name === "macaliciouslistat") {
        state.destination = name === "macaliciouslist" ? "list" : "listat";
        listName = "";
        return;
      }
      state.destination = "skip";
      return;
    }
    if (name === "pict" && state.destination === "text") {
      state.destination = "pict";
      picture = {
        hex: "",
        pixels: { width: 0, height: 0 },
        goal: { width: 0, height: 0 },
        scale: { x: 100, y: 100 },
      };
      return;
    }
    if (name === "fldinst" && state.destination === "text") {
      state.destination = "fldinst";
      fieldInstruction = "";
      fieldLink = undefined;
      return;
    }
    if (SKIPPED.has(name)) {
      state.destination = "skip";
      return;
    }
    if (state.destination === "skip") return;
    if (state.destination === "pict") {
      if (!picture) return;
      const value = Math.max(param ?? 0, 0);
      if (name === "pngblip") picture.type = "png";
      else if (name === "jpegblip") picture.type = "jpeg";
      else if (name === "picw") picture.pixels.width = value;
      else if (name === "pich") picture.pixels.height = value;
      else if (name === "picwgoal") picture.goal.width = value;
      else if (name === "pichgoal") picture.goal.height = value;
      else if (name === "picscalex") picture.scale.x = value;
      else if (name === "picscaley") picture.scale.y = value;
      return;
    }
    if (name === "info" && state.destination === "text") {
      state.destination = "info";
      return;
    }
    if (state.destination === "info" && PROPERTY_OF_WORD.has(name)) {
      property = PROPERTY_OF_WORD.get(name);
      state.destination = "property";
      return;
    }
    if (state.destination === "property" && name === "u") {
      emit(String.fromCharCode((param ?? 0) < 0 ? (param ?? 0) + 65536 : (param ?? 0)));
      skip = state.uc;
      return;
    }
    switch (name) {
      case "ansi":
        documentCodePage = 1252;
        return;
      case "mac":
        documentCodePage = 10000;
        return;
      case "pc":
        documentCodePage = 437;
        return;
      case "pca":
        documentCodePage = 850;
        return;
      case "ansicpg":
        if (param && param > 0) documentCodePage = param;
        return;
      case "fcharset": {
        const page = CHARSET_CODE_PAGES[param ?? 0];
        if (state.destination === "fonttbl" && page) fontCodePages.set(fontNumber, page);
        return;
      }
      case "cpg":
        if (state.destination === "fonttbl" && param && param > 0) {
          fontCodePages.set(fontNumber, param);
        }
        return;
      case "fonttbl":
        state.destination = "fonttbl";
        return;
      case "froman":
      case "fswiss":
      case "fmodern":
      case "fscript": {
        const generic = GENERIC_OF_CLASS[name];
        if (state.destination === "fonttbl" && generic) fontClasses.set(fontNumber, generic);
        return;
      }
      // A `\u` is a character wherever text is, a font's name in the font table included; its
      // fallback characters are skipped there too.
      case "uc":
        state.uc = Math.max(0, param ?? 1);
        return;
      case "u": {
        const code = (param ?? 0) < 0 ? (param ?? 0) + 65536 : (param ?? 0);
        emit(String.fromCharCode(code));
        skip = state.uc;
        return;
      }
      case "colortbl":
        state.destination = "colortbl";
        return;
      case "deff":
        defaultFont = param ?? 0;
        state.font = defaultFont;
        return;
      case "f":
        if (state.destination === "fonttbl") {
          fontNumber = param ?? 0;
          fontName = "";
        } else state.font = param ?? 0;
        return;
      case "red":
      case "green":
      case "blue":
        if (state.destination === "colortbl") {
          color ??= { r: 0, g: 0, b: 0 };
          color[name === "red" ? "r" : name === "green" ? "g" : "b"] = Math.min(
            255,
            Math.max(0, param ?? 0),
          );
        }
        return;
    }
    if (state.destination !== "text") return;
    const style = state.style;
    switch (name) {
      case "fldrslt":
        if (fieldLink) style.link = fieldLink;
        return;
      case "trowd":
        definitions = [];
        definition = { merged: false };
        return;
      case "clmrg":
        definition.merged = true;
        return;
      case "clvmrg":
        definition.down = true;
        return;
      case "clcbpat":
        if (param !== null) definition.shade = param;
        return;
      case "brdrw":
        if (param !== null) definition.border = Math.round(param / 20);
        return;
      case "cellx":
        definition.edge = param ?? 0;
        definitions.push(definition);
        definition = { merged: false };
        return;
      case "intbl":
        paragraph.inTable = param !== 0;
        return;
      case "itap":
        if (param) paragraph.inTable = true;
        setTableDepth(param ?? 1);
        return;
      case "cell":
        setTableDepth(1);
        endCell();
        return;
      case "nestcell":
        endCell();
        return;
      case "row":
        setTableDepth(1);
        endRow();
        return;
      case "nestrow":
        endRow();
        return;
      case "par":
      case "line":
      case "sect":
      case "page":
        endParagraph();
        return;
      case "pard":
        paragraph = freshParagraph();
        return;
      case "plain":
        state.style = { ...DEFAULT_STYLE, ...(style.link ? { link: style.link } : undefined) };
        state.font = defaultFont;
        return;
      case "ql":
        paragraph.align = "left";
        paragraph.leftSet = true;
        return;
      case "qc":
        paragraph.align = "center";
        return;
      case "qr":
        paragraph.align = "right";
        return;
      case "qj":
        paragraph.align = "justify";
        return;
      case "rtlpar":
        paragraph.direction = "rtl";
        return;
      case "ltrpar":
        paragraph.direction = "ltr";
        return;
      case "sl":
      case "slmult": {
        // With \slmult1, \sl is a multiple of 240 twips: the view's line spacing. Without it,
        // \sl is a height in twips (at least, or exactly when negative), which the view does not
        // have: the paragraph keeps single spacing.
        if (name === "sl") paragraph.sl = Math.abs(param ?? 0);
        else paragraph.slmult = param === 1;
        const multiple = paragraph.slmult && paragraph.sl ? paragraph.sl / 240 : undefined;
        const spacing = multiple ? spacingOf(multiple) : undefined;
        if (spacing) paragraph.spacing = spacing;
        else delete paragraph.spacing;
        return;
      }
      case "sb":
        paragraph.sb = Math.max(param ?? 0, 0);
        return;
      case "sa":
        paragraph.sa = Math.max(param ?? 0, 0);
        return;
      case "li":
        paragraph.left = param ?? 0;
        return;
      case "fi":
        paragraph.first = param ?? 0;
        return;
      case "ri":
        paragraph.right = param ?? 0;
        return;
      case "tqc":
        paragraph.tabKind = "center";
        return;
      case "tqr":
        paragraph.tabKind = "right";
        return;
      case "tqdec":
        paragraph.tabKind = "decimal";
        return;
      case "tx":
        if (param !== null && param >= 0 && paragraph.tabs.length < 100) {
          paragraph.tabs.push({ at: param / 20, kind: paragraph.tabKind ?? "left" });
        }
        delete paragraph.tabKind;
        return;
      case "fs":
        if (param && param > 0) style.size = param / 2;
        return;
      case "b":
        style.bold = on;
        return;
      case "i":
        style.italic = on;
        return;
      case "ul":
      case "uld":
      case "uldash":
      case "uldb":
      case "ulw":
      case "ulth":
      case "ulwave":
        style.underline = on;
        return;
      case "ulnone":
        style.underline = false;
        return;
      case "strike":
      case "striked":
        style.strikethrough = on;
        return;
      case "cf": {
        // An entry of the table left empty (by convention the first) is the automatic colour,
        // which follows the appearance; any other entry is the colour it names, black and white
        // included, the first entry too when the table gives it one.
        const value = colors[param ?? 0];
        if (value) style.color = value;
        else delete style.color;
        return;
      }
      case "cb":
      case "highlight": {
        const value = colors[param ?? 0];
        if (value) style.highlight = value;
        else delete style.highlight;
        return;
      }
      case "super":
      case "up":
        if (on) style.script = "super";
        else delete style.script;
        return;
      case "sub":
      case "dn":
        if (on) style.script = "sub";
        else delete style.script;
        return;
      case "nosupersub":
        delete style.script;
        return;
    }
    const symbol = SYMBOLS[name];
    if (symbol) emit(symbol);
  };

  let index = 0;
  const length = text.length;
  let pending = "";
  // A run of bytes (`\'hh`), decoded together when it ends so a double-byte character's two
  // bytes meet; `trail` while a lead byte waits for its trail byte.
  let bytes: number[] = [];
  let trail = false;
  const flushBytes = () => {
    if (bytes.length > 0) {
      // Bytes of text in another code page are what TextEdit on Ferrite does not open; those of
      // a skipped destination are never read, and a property is decoded and is not the text.
      if (
        !decoderFor(codePage()) &&
        state.destination !== "skip" &&
        state.destination !== "info" &&
        state.destination !== "property"
      ) {
        unsupported = true;
      }
      pending += decodeBytes(bytes, codePage());
    }
    bytes = [];
    trail = false;
  };
  const addByte = (byte: number) => {
    trail = trail ? false : isLeadByte(byte, codePage());
    bytes.push(byte);
  };
  const addText = (chars: string) => {
    flushBytes();
    pending += chars;
  };
  const flushText = () => {
    flushBytes();
    if (pending) emit(pending);
    pending = "";
  };
  while (index < length) {
    const char = text[index];
    if (char === "{") {
      flushText();
      stack.push(state);
      paragraphStack.push({ ...paragraph, tabs: [...paragraph.tabs] });
      state = { ...state, style: { ...state.style } };
      skip = 0;
      index += 1;
    } else if (char === "}") {
      flushText();
      const closing = state.destination;
      if (state.destination === "list") {
        const list = listName.trim();
        if (/^[a-z]{1,20}$/.test(list)) paragraph.list = list;
      }
      if (state.destination === "listat" && /^\d{1,6}$/.test(listName.trim())) {
        paragraph.listStart = Number(listName.trim());
      }
      if (state.destination === "fonttbl" && fontName.trim()) {
        fonts.set(fontNumber, fontOfName(fontName.replace(/;$/, "")));
        fontName = "";
      }
      if (closing === "fldinst") {
        const address = /HYPERLINK\s+"([^"]+)"/i.exec(fieldInstruction)?.[1];
        if (address && /^(https?:\/\/|drive:)/i.test(address)) fieldLink = address;
      }
      state = stack.pop() ?? base();
      if (closing === "pict" && state.destination !== "pict" && picture) {
        const made = pictureOfRtf(picture);
        if (made) {
          started = true;
          runs.push({ text: "", style: styleOf(state), picture: made });
        }
        picture = null;
      }
      const saved = paragraphStack.pop();
      // A group of the text gives back the paragraph format it found; a list style's group
      // (`{\*\macaliciouslist …}`) sets the paragraph's, which stays. The document's own group
      // keeps it, for a last paragraph that ends without `\par`.
      if (closing === "text" && saved && paragraphStack.length > 0) paragraph = saved;
      ignorable = false;
      skip = 0;
      index += 1;
    } else if (char === "\\") {
      const next = text[index + 1] ?? "";
      if (next === "\\" || next === "{" || next === "}") {
        if (skip > 0) skip -= 1;
        // The trail byte of a double-byte character can be one of the three.
        else if (trail) addByte(next.charCodeAt(0));
        else addText(next);
        index += 2;
      } else if (next === "'") {
        const code = Number.parseInt(text.slice(index + 2, index + 4), 16);
        if (skip > 0) skip -= 1;
        else if (Number.isFinite(code)) addByte(code);
        index += 4;
      } else if (next === "*") {
        flushText();
        ignorable = true;
        index += 2;
      } else if (next === "~" || next === "_" || next === "-") {
        // A control symbol counts as one fallback character of a \u, like a control word.
        if (skip > 0) skip -= 1;
        else if (next === "~") addText("\u00a0");
        else if (next === "_") addText("\u2011");
        index += 2;
      } else if (next === "\n" || next === "\r") {
        flushText();
        word("par", null);
        index += 2;
      } else {
        const match = /^([a-zA-Z]{1,32})(-?\d{1,10})? ?/.exec(text.slice(index + 1, index + 48));
        if (!match) {
          index += 2;
          continue;
        }
        flushText();
        const name = match[1] as string;
        const param = match[2] === undefined ? null : Number(match[2]);
        if (name === "bin") {
          // `\binN`: N bytes of binary data after the delimiting space, never RTF syntax. They
          // are always dropped: in a picture's skipped group and anywhere else.
          index = binaryEnd(text, index + 1 + match[0].length, Math.max(0, param ?? 0));
          ignorable = false;
          // A `\bin` and its payload count as one fallback character of a `\u`.
          if (skip > 0) skip -= 1;
          continue;
        }
        // The fallback characters of a \u are skipped; a control word counts as one.
        if (skip > 0 && name !== "u") skip -= 1;
        else word(name, param);
        index += 1 + match[0].length;
      }
    } else if (char === "\n" || char === "\r") {
      index += 1;
    } else {
      const code = text.charCodeAt(index);
      if (skip > 0) skip -= 1;
      // A double-byte character's trail byte written as the ASCII character it is.
      else if (trail && code >= 0x40 && code <= 0x7e) addByte(code);
      else addText(char ?? "");
      index += 1;
    }
  }
  flushText();
  // Text after the last \par is a last paragraph; an empty one after it is not.
  if (started || runs.length > 0) endParagraph();
  setTableDepth(1);
  endTable();
  const kept = cleanProperties(properties);
  for (const [each, own] of indented) {
    const shared = ruler ?? { first: 0, head: 0, tail: 0 };
    if (own.first !== shared.first || own.head !== shared.head || own.tail !== shared.tail) {
      each.indents = own;
    }
  }
  const sharedTabs = ruler?.tabStops ?? [];
  for (const [each, own] of tabbed) {
    if (
      own.length !== sharedTabs.length ||
      own.some(({ at, kind }, index) => kind !== "left" || at !== sharedTabs[index])
    ) {
      each.tabs = own;
    }
  }
  return {
    paragraphs: paragraphs.length > 0 ? paragraphs : [{ align: "left", runs: [] }],
    ruler,
    ...(kept ? { properties: kept } : undefined),
    ...(unsupported ? { unsupported: true as const } : undefined),
  };
}

// ---------------------------------------------------------------------------------------------
// As the view's content

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The CSS family list for a family name: the library's for a family it knows. Otherwise the name
 * as the file has it; for a PostScript name (`CourierNewPSMT`), then the family name it stands
 * for (`Courier New`), which is what browsers know most fonts by; then its generic family when it
 * has one, so that it shows as that kind of font where neither is installed.
 */
function cssFamily(name: string, generic?: GenericFamily): string {
  const known = findFontFamily(name)?.css;
  if (known) return known;
  const clean = name.replace(/['"\\<>;]/g, "");
  const list = [`'${clean}'`];
  const postScript = /^(\S+?)(PSMT|PS|MT)$/.exec(clean);
  if (postScript) list.push(`'${(postScript[1] ?? "").replace(/([a-z])([A-Z])/g, "$1 $2")}'`);
  if (generic) list.push(generic);
  return list.join(", ");
}

/**
 * Paragraphs as the rich text view's HTML: a `<div>` per paragraph with its alignment, spacing
 * and list, a `<span>` per run with what differs from Helvetica 12 in the text colour of the
 * appearance. Pass the result through `htmlToContent` before showing it.
 */
export function paragraphsToHtml(paragraphs: readonly RtfParagraph[]): string {
  return paragraphs
    .map((paragraph) => {
      if (paragraph.table) {
        const rows = paragraph.table.rows.map((row) => {
          const cells = row.map((cell) => {
            const span = cell.span ? ` colspan="${cell.span}"` : "";
            const down = cell.rows ? ` rowspan="${cell.rows}"` : "";
            const shade = cell.background
              ? ` style="background-color: ${escapeHtml(cell.background)}"`
              : "";
            return `<td${span}${down}${shade}>${paragraphsToHtml(cell.paragraphs)}</td>`;
          });
          return `<tr>${cells.join("")}</tr>`;
        });
        const { border, widths } = paragraph.table;
        const columns = widths
          ? `<colgroup>${widths.map((width) => (width ? `<col width="${Math.round(width)}">` : "<col>")).join("")}</colgroup>`
          : "";
        return `<table data-border="${border}">${columns}<tbody>${rows.join("")}</tbody></table>`;
      }
      const css: string[] = [];
      if (paragraph.align !== "left" || paragraph.leftSet)
        css.push(`text-align: ${paragraph.align}`);
      if (paragraph.spacing) {
        css.push(
          `line-height: ${Math.round(LINE_HEIGHT * Number(paragraph.spacing) * 1000) / 1000}`,
        );
      }
      if (paragraph.before) css.push(`margin-top: ${paragraph.before}px`);
      if (paragraph.after) css.push(`margin-bottom: ${paragraph.after}px`);
      if (paragraph.indents) {
        const { first, head, tail } = paragraph.indents;
        css.push(`margin-inline-start: ${head + (paragraph.list ? 28 : 0)}px`);
        css.push(`margin-inline-end: ${tail}px`);
        if (!paragraph.list) css.push(`text-indent: ${first - head}px`);
      }
      if (paragraph.listStart !== undefined)
        css.push(`counter-set: list-item ${paragraph.listStart}`);
      const attributes =
        (css.length > 0 ? ` style="${escapeHtml(css.join("; "))}"` : "") +
        (paragraph.spacing ? ` data-spacing="${paragraph.spacing}"` : "") +
        (paragraph.list ? ` data-list="${escapeHtml(paragraph.list)}"` : "") +
        (paragraph.listStart !== undefined ? ` data-list-start="${paragraph.listStart}"` : "") +
        (paragraph.direction ? ` dir="${paragraph.direction}"` : "") +
        (paragraph.tabs ? ` data-tabs="${tabStopsText(paragraph.tabs)}"` : "");
      const runs = paragraph.runs
        .map(({ text, style, picture }) => {
          if (picture) {
            return `<img src="${escapeHtml(picture.src)}" width="${picture.width}" height="${picture.height}">`;
          }
          const parts: string[] = [];
          if (style.family !== DEFAULT_STYLE.family) {
            parts.push(`font-family: ${cssFamily(style.family, style.generic)}`);
          }
          if (style.size !== DEFAULT_STYLE.size) parts.push(`font-size: ${style.size}px`);
          if (style.bold) parts.push("font-weight: bold");
          if (style.italic) parts.push("font-style: italic");
          const lines = [
            style.underline ? "underline" : "",
            style.strikethrough ? "line-through" : "",
          ].filter(Boolean);
          if (lines.length > 0) parts.push(`text-decoration-line: ${lines.join(" ")}`);
          if (style.color) parts.push(`color: ${style.color}`);
          if (style.highlight) parts.push(`background-color: ${style.highlight}`);
          const content = escapeHtml(text).replace(/\t/g, "&#9;");
          const span =
            parts.length > 0
              ? `<span style="${escapeHtml(parts.join("; "))}">${content}</span>`
              : content;
          const raised =
            style.script === "super"
              ? `<sup>${span}</sup>`
              : style.script === "sub"
                ? `<sub>${span}</sub>`
                : span;
          if (!style.link) return raised;
          const attachment = style.link.startsWith("drive:") ? ' contenteditable="false"' : "";
          return `<a href="${escapeHtml(style.link)}"${attachment}>${raised}</a>`;
        })
        .join("");
      return `<div${attributes}>${runs || "<br>"}</div>`;
    })
    .join("");
}
