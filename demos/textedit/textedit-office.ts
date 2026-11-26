import {
  DEFAULT_STYLE,
  type RtfCell,
  type RtfParagraph,
  type RtfPicture,
  type RtfRun,
  type RtfStyle,
  type TableSlot,
  tableGrid,
} from "./textedit-rtf";

/**
 * Word (`.docx`), OpenDocument (`.odt`) and Web Archive (`.webarchive`) files. A document in one of
 * these is held as HTML (`fileText` of `textedit-files.ts`): these functions turn that document's
 * paragraphs into the file's bytes and the file's bytes back into paragraphs. Only what the view
 * shows is read and written; a file's headers, footnotes, tracked changes and the like are not.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------------------------
// Zip

const CRC_TABLE = Array.from({ length: 256 }, (_, at) => {
  let value = at;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip of `files`, in order, each stored as it is: no reader needs them compressed. */
export function zipStored(files: readonly { name: string; bytes: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const title = encoder.encode(name);
    const crc = crc32(bytes);
    const head = new Uint8Array(30 + title.length);
    const view = new DataView(head.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, title.length, true);
    head.set(title, 30);
    const entry = new Uint8Array(46 + title.length);
    const row = new DataView(entry.buffer);
    row.setUint32(0, 0x02014b50, true);
    row.setUint16(4, 20, true);
    row.setUint16(6, 20, true);
    row.setUint16(8, 0x0800, true);
    row.setUint32(16, crc, true);
    row.setUint32(20, bytes.length, true);
    row.setUint32(24, bytes.length, true);
    row.setUint16(28, title.length, true);
    row.setUint32(42, offset, true);
    entry.set(title, 46);
    parts.push(head, bytes);
    central.push(entry);
    offset += head.length + bytes.length;
  }
  const size = central.reduce((sum, each) => sum + each.length, 0);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);
  tail.setUint32(0, 0x06054b50, true);
  tail.setUint16(8, files.length, true);
  tail.setUint16(10, files.length, true);
  tail.setUint32(12, size, true);
  tail.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let at = 0;
  for (const part of [...parts, ...central, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** The most a zip is unpacked to: a small file can claim to hold far more than a page can. */
const MOST_UNPACKED_BYTES = 128 * 1024 * 1024;

async function inflate(bytes: Uint8Array, budget: { left: number }): Promise<Uint8Array> {
  const stream = (new Response(bytes as BodyInit).body as ReadableStream<Uint8Array>).pipeThrough(
    new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<
      Uint8Array,
      Uint8Array
    >,
  );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    budget.left -= value.length;
    if (budget.left < 0) {
      await reader.cancel();
      throw new Error("The file unpacks to more than TextEdit can hold.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** The files of a zip by name, from its central directory. Throws when the bytes are not one. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("The file is not a zip.");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  const budget = { left: MOST_UNPACKED_BYTES };
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) {
      throw new Error("The file is not a zip.");
    }
    const method = view.getUint16(at + 10, true);
    const packed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extra + comment;
    if (local + 30 > bytes.length) throw new Error("The file is not a zip.");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + packed);
    if (method === 0) {
      budget.left -= data.length;
      if (budget.left < 0) throw new Error("The file unpacks to more than TextEdit can hold.");
      files.set(name, data);
    } else if (method === 8) files.set(name, await inflate(data, budget));
  }
  return files;
}

// ---------------------------------------------------------------------------------------------
// Shared

const xml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Characters XML 1.0 cannot hold.
    .replace(/[^\t\n\r\u0020-\ufffd\u{10000}-\u{10ffff}]/gu, "");

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const parseXml = (bytes: Uint8Array | undefined): Document | null => {
  if (!bytes) return null;
  const parsed = new DOMParser().parseFromString(decoder.decode(bytes), "application/xml");
  return parsed.querySelector("parsererror") ? null : parsed;
};

/** The attribute of the local name `name`, whatever prefix the file gave its namespace. */
const attr = (element: Element, name: string) => {
  for (const attribute of element.attributes) {
    if (attribute.localName === name) return attribute.value;
  }
  return null;
};

const kids = (element: Element, name?: string) =>
  [...element.children].filter((child) => name === undefined || child.localName === name);
const kid = (element: Element | undefined, name: string) =>
  element ? kids(element, name)[0] : undefined;
const descendants = (root: Document | Element, name: string) =>
  [...root.getElementsByTagName("*")].filter((each) => each.localName === name);

const base64Bytes = (data: string) => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at);
  return bytes;
};

const base64Of = (bytes: Uint8Array) => {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
};

interface PictureFile {
  name: string;
  bytes: Uint8Array;
  type: "png" | "jpeg";
}

const pictureFile = (picture: RtfPicture, at: number): PictureFile => {
  const [head = "", data = ""] = picture.src.split(",");
  const type = head.includes("png") ? "png" : "jpeg";
  return { name: `image${at}.${type === "png" ? "png" : "jpg"}`, bytes: base64Bytes(data), type };
};

const pictureSource = (bytes: Uint8Array, name: string) =>
  `data:image/${/\.png$/i.test(name) ? "png" : "jpeg"};base64,${base64Of(bytes)}`;

const hexOf = (color: string | null | undefined) =>
  color && /^#?[0-9a-f]{6}$/i.test(color) ? `#${color.replace("#", "").toLowerCase()}` : undefined;

/** The list styles, with the marker or numbering each has in Word and OpenDocument. */
const LISTS: Record<string, { format: string; text: string; number?: string }> = {
  disc: { format: "bullet", text: "•" },
  circle: { format: "bullet", text: "◦" },
  square: { format: "bullet", text: "▪" },
  hyphen: { format: "bullet", text: "–" },
  decimal: { format: "decimal", text: "%1.", number: "1" },
  alpha: { format: "lowerLetter", text: "%1.", number: "a" },
  alphaupper: { format: "upperLetter", text: "%1.", number: "A" },
  roman: { format: "lowerRoman", text: "%1.", number: "i" },
  romanupper: { format: "upperRoman", text: "%1.", number: "I" },
};
const LIST_NAMES = Object.keys(LISTS);

const styledRun = (text: string, style: RtfStyle): RtfRun => ({ text, style: { ...style } });

/** Adds text to the end of `runs`, joining a run of the same format. */
function pushText(runs: RtfRun[], text: string, style: RtfStyle) {
  if (!text) return;
  const last = runs.at(-1);
  if (last && !last.picture && JSON.stringify(last.style) === JSON.stringify(style)) {
    last.text += text;
  } else runs.push(styledRun(text, style));
}

// ---------------------------------------------------------------------------------------------
// Word

const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const EMU_PER_POINT = 12700;

const wordRunFormat = (style: RtfStyle) => {
  const family = xml(style.family);
  return (
    `<w:rPr><w:rFonts w:ascii="${family}" w:hAnsi="${family}" w:cs="${family}"/>` +
    (style.bold ? "<w:b/>" : "") +
    (style.italic ? "<w:i/>" : "") +
    (style.strikethrough ? "<w:strike/>" : "") +
    (style.color ? `<w:color w:val="${style.color.slice(1)}"/>` : "") +
    `<w:sz w:val="${Math.round(style.size * 2)}"/>` +
    (style.underline ? '<w:u w:val="single"/>' : "") +
    (style.highlight
      ? `<w:shd w:val="clear" w:color="auto" w:fill="${style.highlight.slice(1)}"/>`
      : "") +
    (style.script
      ? `<w:vertAlign w:val="${style.script === "super" ? "superscript" : "subscript"}"/>`
      : "") +
    "</w:rPr>"
  );
};

const wordText = (text: string) =>
  text
    .split(/(\t|\n)/)
    .map((part) =>
      part === "\t"
        ? "<w:tab/>"
        : part === "\n"
          ? "<w:br/>"
          : part
            ? `<w:t xml:space="preserve">${xml(part)}</w:t>`
            : "",
    )
    .join("");

/** The bytes of a Word file holding `paragraphs`. */
export function writeDocx(paragraphs: readonly RtfParagraph[]): Uint8Array {
  const links: string[] = [];
  const pictures: PictureFile[] = [];
  const linkId = (address: string) => {
    let at = links.indexOf(address);
    if (at < 0) at = links.push(address) - 1;
    return `rIdL${at}`;
  };
  const drawing = (picture: RtfPicture) => {
    const at = pictures.push(pictureFile(picture, pictures.length + 1));
    const cx = Math.round(picture.width * EMU_PER_POINT);
    const cy = Math.round(picture.height * EMU_PER_POINT);
    return (
      `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${at}" name="Picture ${at}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic><pic:nvPicPr><pic:cNvPr id="${at}" name="Picture ${at}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="rIdP${at}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>"
    );
  };
  const paragraph = (each: RtfParagraph): string => {
    if (each.table) return table(each);
    const list = each.list ? LIST_NAMES.indexOf(each.list) + 1 : 0;
    const spacing =
      each.spacing || each.before || each.after
        ? `<w:spacing${each.before ? ` w:before="${Math.round(each.before * 20)}"` : ""}` +
          `${each.after ? ` w:after="${Math.round(each.after * 20)}"` : ""}` +
          `${each.spacing ? ` w:line="${Math.round(Number(each.spacing) * 240)}" w:lineRule="auto"` : ""}/>`
        : "";
    const jc = { left: "left", center: "center", right: "right", justify: "both" }[each.align];
    const format =
      `<w:pPr>${list > 0 ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${list}"/></w:numPr>` : ""}` +
      `${each.direction === "rtl" ? "<w:bidi/>" : ""}${spacing}<w:jc w:val="${jc}"/></w:pPr>`;
    const runs = each.runs
      .map((run) => {
        if (run.picture) return drawing(run.picture);
        const made = `<w:r>${wordRunFormat(run.style)}${wordText(run.text)}</w:r>`;
        return run.style.link
          ? `<w:hyperlink r:id="${linkId(run.style.link)}">${made}</w:hyperlink>`
          : made;
      })
      .join("");
    return `<w:p>${format}${runs}</w:p>`;
  };
  const table = ({ table: made }: RtfParagraph): string => {
    if (!made) return "";
    const grid = tableGrid(made.rows);
    const columns = Math.max(1, ...grid.map((row) => row.reduce((sum, s) => sum + s.span, 0)));
    const width = Math.round(9360 / columns);
    const edge = `w:val="${made.border > 0 ? "single" : "nil"}" w:sz="${made.border * 8}" w:space="0" w:color="auto"`;
    const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map((side) => `<w:${side} ${edge}/>`)
      .join("");
    const cell = ({ cell: each, covered }: TableSlot) => {
      const inner = covered ? "" : each.paragraphs.map(paragraph).join("");
      // A cell must end in a paragraph.
      const ends = covered || each.paragraphs.at(-1)?.table || each.paragraphs.length === 0;
      const down = covered
        ? "<w:vMerge/>"
        : (each.rows ?? 1) > 1
          ? '<w:vMerge w:val="restart"/>'
          : "";
      return (
        `<w:tc><w:tcPr><w:tcW w:w="${width * (each.span ?? 1)}" w:type="dxa"/>` +
        `${each.span ? `<w:gridSpan w:val="${each.span}"/>` : ""}${down}` +
        `${each.background ? `<w:shd w:val="clear" w:color="auto" w:fill="${each.background.slice(1)}"/>` : ""}</w:tcPr>` +
        `${inner}${ends ? "<w:p/>" : ""}</w:tc>`
      );
    };
    return (
      `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>` +
      `<w:tblGrid>${`<w:gridCol w:w="${width}"/>`.repeat(columns)}</w:tblGrid>` +
      grid.map((row) => `<w:tr>${row.map(cell).join("")}</w:tr>`).join("") +
      "</w:tbl>"
    );
  };
  const body = paragraphs.map(paragraph).join("");
  const document =
    `${XML_HEAD}<w:document ${W}><w:body>${body}` +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
    "</w:body></w:document>";
  const numbering =
    `${XML_HEAD}<w:numbering ${W}>` +
    LIST_NAMES.map((name, at) => {
      const list = LISTS[name] as (typeof LISTS)[string];
      return (
        `<w:abstractNum w:abstractNumId="${at}"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${list.format}"/>` +
        `<w:lvlText w:val="${list.text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="560" w:hanging="280"/></w:pPr></w:lvl></w:abstractNum>`
      );
    }).join("") +
    LIST_NAMES.map(
      (_, at) => `<w:num w:numId="${at + 1}"><w:abstractNumId w:val="${at}"/></w:num>`,
    ).join("") +
    "</w:numbering>";
  const relations =
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rIdN" Type="${REL}/numbering" Target="numbering.xml"/>` +
    links
      .map(
        (address, at) =>
          `<Relationship Id="rIdL${at}" Type="${REL}/hyperlink" Target="${xml(address)}" TargetMode="External"/>`,
      )
      .join("") +
    pictures
      .map(
        ({ name }, at) =>
          `<Relationship Id="rIdP${at + 1}" Type="${REL}/image" Target="media/${name}"/>`,
      )
      .join("") +
    "</Relationships>";
  const types =
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    "</Types>";
  const root =
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`;
  return zipStored([
    { name: "[Content_Types].xml", bytes: encoder.encode(types) },
    { name: "_rels/.rels", bytes: encoder.encode(root) },
    { name: "word/document.xml", bytes: encoder.encode(document) },
    { name: "word/numbering.xml", bytes: encoder.encode(numbering) },
    { name: "word/_rels/document.xml.rels", bytes: encoder.encode(relations) },
    ...pictures.map(({ name, bytes }) => ({ name: `word/media/${name}`, bytes })),
  ]);
}

/** Applies a Word `rPr` to `style`. */
function wordStyle(properties: Element | undefined, style: RtfStyle): RtfStyle {
  if (!properties) return style;
  const made: RtfStyle = { ...style };
  const on = (name: string) => {
    const value = attr(kid(properties, name) as Element, "val");
    return value !== "0" && value !== "false" && value !== "none";
  };
  for (const child of kids(properties)) {
    const value = attr(child, "val");
    switch (child.localName) {
      case "rFonts": {
        const family = attr(child, "ascii") ?? attr(child, "hAnsi");
        if (family) made.family = family;
        break;
      }
      case "b":
        made.bold = on("b");
        break;
      case "i":
        made.italic = on("i");
        break;
      case "strike":
        made.strikethrough = on("strike");
        break;
      case "u":
        made.underline = on("u");
        break;
      case "sz":
        if (Number(value) > 0) made.size = Number(value) / 2;
        break;
      case "color": {
        const hex = hexOf(value);
        if (hex) made.color = hex;
        break;
      }
      case "shd": {
        const hex = hexOf(attr(child, "fill"));
        if (hex) made.highlight = hex;
        break;
      }
      case "highlight": {
        const named: Record<string, string> = {
          yellow: "#ffff00",
          green: "#00ff00",
          cyan: "#00ffff",
          magenta: "#ff00ff",
          blue: "#0000ff",
          red: "#ff0000",
        };
        const hex = named[value ?? ""];
        if (hex) made.highlight = hex;
        break;
      }
      case "vertAlign":
        if (value === "superscript") made.script = "super";
        else if (value === "subscript") made.script = "sub";
        else delete made.script;
        break;
    }
  }
  return made;
}

/** The paragraphs of a Word file's bytes. Throws when the bytes are not a Word file. */
export async function readDocx(bytes: Uint8Array): Promise<RtfParagraph[]> {
  const files = await unzip(bytes);
  const document = parseXml(files.get("word/document.xml"));
  const body = document ? descendants(document, "body")[0] : undefined;
  if (!body) throw new Error("The file is not a Word document.");
  const relations = new Map<string, { target: string }>();
  const relationFile = parseXml(files.get("word/_rels/document.xml.rels"));
  for (const each of relationFile ? descendants(relationFile, "Relationship") : []) {
    relations.set(each.getAttribute("Id") ?? "", { target: each.getAttribute("Target") ?? "" });
  }
  // The file's styles, by id: what its paragraphs and runs start from.
  const stylesFile = parseXml(files.get("word/styles.xml"));
  const named = new Map<string, Element>();
  for (const each of stylesFile ? descendants(stylesFile, "style") : []) {
    named.set(attr(each, "styleId") ?? "", each);
  }
  const base: RtfStyle = wordStyle(
    stylesFile ? kid(descendants(stylesFile, "rPrDefault")[0], "rPr") : undefined,
    { ...DEFAULT_STYLE },
  );
  const withStyle = (id: string | null, around: RtfStyle, depth = 0): RtfStyle => {
    const style = id ? named.get(id) : undefined;
    if (!style || depth > 16) return around;
    const parent = attr(kid(style, "basedOn") ?? style, "val");
    const inherited = kid(style, "basedOn") ? withStyle(parent, around, depth + 1) : around;
    return wordStyle(kid(style, "rPr"), inherited);
  };
  // Each list's marker kind, from the numbering part.
  const numbering = parseXml(files.get("word/numbering.xml"));
  const abstract = new Map<string, { format: string; text: string }>();
  for (const each of numbering ? descendants(numbering, "abstractNum") : []) {
    const level = kid(each, "lvl");
    abstract.set(attr(each, "abstractNumId") ?? "", {
      format: attr(kid(level, "numFmt") ?? each, "val") ?? "",
      text: attr(kid(level, "lvlText") ?? each, "val") ?? "",
    });
  }
  const listOf = (numId: string | null): string => {
    const number = numbering
      ? descendants(numbering, "num").find((each) => attr(each, "numId") === numId)
      : undefined;
    const kind = abstract.get(attr(kid(number, "abstractNumId") ?? number ?? body, "val") ?? "");
    return (
      LIST_NAMES.find(
        (name) => LISTS[name]?.format === kind?.format && LISTS[name]?.text === kind?.text,
      ) ??
      LIST_NAMES.find((name) => LISTS[name]?.format === kind?.format) ??
      (kind?.format && kind.format !== "bullet" ? "decimal" : "disc")
    );
  };
  const runsIn = (parent: Element, style: RtfStyle, runs: RtfRun[], link?: string) => {
    for (const child of kids(parent)) {
      if (child.localName === "hyperlink") {
        const target = relations.get(attr(child, "id") ?? "")?.target;
        runsIn(child, style, runs, target && /^https?:|^drive:/i.test(target) ? target : link);
      } else if (child.localName === "ins" || child.localName === "smartTag") {
        runsIn(child, style, runs, link);
      } else if (child.localName === "r") {
        const properties = kid(child, "rPr");
        const made = wordStyle(
          properties,
          withStyle(attr(kid(properties, "rStyle") ?? child, "val"), style),
        );
        if (link) made.link = link;
        for (const part of kids(child)) {
          if (part.localName === "t") pushText(runs, part.textContent ?? "", made);
          else if (part.localName === "tab") pushText(runs, "\t", made);
          else if (part.localName === "br" || part.localName === "cr") pushText(runs, "\n", made);
          else if (part.localName === "drawing") {
            const blip = descendants(part, "blip")[0];
            const extent = descendants(part, "extent")[0];
            const target = relations.get(attr(blip ?? part, "embed") ?? "")?.target ?? "";
            const file = files.get(`word/${target.replace(/^\/?word\//, "")}`);
            if (file && /\.(png|jpe?g)$/i.test(target)) {
              runs.push({
                text: "",
                style: { ...made },
                picture: {
                  src: pictureSource(file, target),
                  width: Math.round(Number(attr(extent ?? part, "cx")) / EMU_PER_POINT) || 0,
                  height: Math.round(Number(attr(extent ?? part, "cy")) / EMU_PER_POINT) || 0,
                },
              });
            }
          }
        }
      }
    }
  };
  const paragraphsIn = (parent: Element): RtfParagraph[] => {
    const out: RtfParagraph[] = [];
    for (const child of kids(parent)) {
      if (child.localName === "tbl") {
        out.push(tableIn(child));
        continue;
      }
      if (child.localName !== "p") continue;
      const properties = kid(child, "pPr");
      const start = withStyle(attr(kid(properties, "pStyle") ?? child, "val"), base);
      const jc = attr(kid(properties, "jc") ?? child, "val");
      const spacing = kid(properties, "spacing");
      const line = spacing ? Number(attr(spacing, "line")) / 240 : 0;
      const lineRule = spacing ? attr(spacing, "lineRule") : null;
      const before = spacing ? Number(attr(spacing, "before")) / 20 : 0;
      const after = spacing ? Number(attr(spacing, "after")) / 20 : 0;
      const numId = attr(kid(kid(properties, "numPr"), "numId") ?? child, "val");
      const runs: RtfRun[] = [];
      runsIn(child, start, runs);
      out.push({
        align:
          jc === "center"
            ? "center"
            : jc === "right" || jc === "end"
              ? "right"
              : jc === "both"
                ? "justify"
                : "left",
        ...(kid(properties, "bidi") ? { direction: "rtl" as const } : undefined),
        ...(line > 1.05 && (lineRule === "auto" || lineRule === null)
          ? { spacing: nearestSpacing(line) }
          : undefined),
        ...(before > 0 ? { before } : undefined),
        ...(after > 0 ? { after } : undefined),
        ...(numId && numId !== "0" ? { list: listOf(numId) } : undefined),
        runs,
      });
    }
    return out;
  };
  const tableIn = (element: Element): RtfParagraph => {
    const borders = kid(kid(element, "tblPr"), "tblBorders");
    const top = kid(borders, "top");
    const size = top && attr(top, "val") !== "nil" ? Number(attr(top, "sz")) / 8 : 0;
    // The cell at each column of the row before, which a `vMerge` without "restart" continues.
    let above: (RtfCell | undefined)[] = [];
    return {
      align: "left",
      runs: [],
      table: {
        border: Math.min(3, Math.round(size)),
        rows: kids(element, "tr").map((row) => {
          const owners: (RtfCell | undefined)[] = [];
          const cells: RtfCell[] = [];
          for (const cell of kids(row, "tc")) {
            const properties = kid(cell, "tcPr");
            const span = Number(attr(kid(properties, "gridSpan") ?? cell, "val"));
            const across = span > 1 ? span : 1;
            const down = kid(properties, "vMerge");
            const joined =
              down && attr(down, "val") !== "restart" ? above[owners.length] : undefined;
            if (joined) {
              joined.rows = (joined.rows ?? 1) + 1;
              for (let part = 0; part < across; part += 1) owners.push(joined);
              continue;
            }
            const fill = hexOf(attr(kid(properties, "shd") ?? cell, "fill"));
            const made: RtfCell = {
              paragraphs: paragraphsIn(cell),
              ...(span > 1 ? { span } : undefined),
              ...(fill ? { background: fill } : undefined),
            };
            cells.push(made);
            for (let part = 0; part < across; part += 1) owners.push(made);
          }
          above = owners;
          return cells;
        }),
      },
    };
  };
  return paragraphsIn(body);
}

const nearestSpacing = (multiple: number) =>
  multiple >= 1.75 ? "2.0" : multiple >= 1.35 ? "1.5" : "1.2";

// ---------------------------------------------------------------------------------------------
// OpenDocument

const ODT_ROOT =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" ' +
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
  'xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.2"';
const ODT_TYPE = "application/vnd.oasis.opendocument.text";

const odtTextProperties = (style: RtfStyle) =>
  `<style:text-properties fo:font-family="${xml(`'${style.family}'`)}" fo:font-size="${style.size}pt"` +
  (style.bold ? ' fo:font-weight="bold"' : "") +
  (style.italic ? ' fo:font-style="italic"' : "") +
  (style.underline ? ' style:text-underline-style="solid"' : "") +
  (style.strikethrough ? ' style:text-line-through-style="solid"' : "") +
  (style.color ? ` fo:color="${style.color}"` : "") +
  (style.highlight ? ` fo:background-color="${style.highlight}"` : "") +
  (style.script ? ` style:text-position="${style.script} 58%"` : "") +
  "/>";

/** Text as OpenDocument holds it: tabs, line breaks and runs of spaces are elements. */
const odtText = (text: string) =>
  text
    .split(/(\t|\n| {2,})/)
    .map((part) => {
      if (part === "\t") return "<text:tab/>";
      if (part === "\n") return "<text:line-break/>";
      if (/^ {2,}$/.test(part)) return ` <text:s text:c="${part.length - 1}"/>`;
      return xml(part);
    })
    .join("");

/** The bytes of an OpenDocument text file holding `paragraphs`. */
export function writeOdt(paragraphs: readonly RtfParagraph[]): Uint8Array {
  const automatic: string[] = [];
  const known = new Map<string, string>();
  const named = (prefix: string, family: string, body: string) => {
    const key = `${family}\n${body}`;
    let name = known.get(key);
    if (!name) {
      name = `${prefix}${known.size + 1}`;
      known.set(key, name);
      automatic.push(
        `<style:style style:name="${name}" style:family="${family}">${body}</style:style>`,
      );
    }
    return name;
  };
  const pictures: PictureFile[] = [];
  const paragraph = (each: RtfParagraph): string => {
    if (each.table) return table(each);
    const align = { left: "start", center: "center", right: "end", justify: "justify" }[each.align];
    const style = named(
      "P",
      "paragraph",
      `<style:paragraph-properties fo:text-align="${align}"` +
        (each.spacing ? ` fo:line-height="${Math.round(Number(each.spacing) * 100)}%"` : "") +
        (each.before ? ` fo:margin-top="${each.before}pt"` : "") +
        (each.after ? ` fo:margin-bottom="${each.after}pt"` : "") +
        (each.direction === "rtl" ? ' style:writing-mode="rl-tb"' : "") +
        "/>",
    );
    const runs = each.runs
      .map((run) => {
        if (run.picture) {
          const file = pictureFile(run.picture, pictures.length + 1);
          pictures.push(file);
          return (
            `<draw:frame draw:name="${file.name}" text:anchor-type="as-char" svg:width="${run.picture.width}pt" svg:height="${run.picture.height}pt">` +
            `<draw:image xlink:href="Pictures/${file.name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`
          );
        }
        const span = `<text:span text:style-name="${named("T", "text", odtTextProperties(run.style))}">${odtText(run.text)}</text:span>`;
        return run.style.link
          ? `<text:a xlink:type="simple" xlink:href="${xml(run.style.link)}">${span}</text:a>`
          : span;
      })
      .join("");
    const made = `<text:p text:style-name="${style}">${runs}</text:p>`;
    return each.list
      ? `<text:list text:style-name="L${LIST_NAMES.indexOf(each.list) + 1}"><text:list-item>${made}</text:list-item></text:list>`
      : made;
  };
  const table = ({ table: made }: RtfParagraph): string => {
    if (!made) return "";
    const grid = tableGrid(made.rows);
    const columns = Math.max(1, ...grid.map((row) => row.reduce((sum, s) => sum + s.span, 0)));
    const border = made.border > 0 ? `${made.border}pt solid #000000` : "none";
    const cell = ({ cell: each, span, covered }: TableSlot) => {
      if (covered) return "<table:covered-table-cell/>".repeat(span);
      const style = named(
        "C",
        "table-cell",
        `<style:table-cell-properties fo:border="${border}"${each.background ? ` fo:background-color="${each.background}"` : ""}/>`,
      );
      const inner = each.paragraphs.map(paragraph).join("") || "<text:p/>";
      const rows = each.rows ?? 1;
      return (
        `<table:table-cell table:style-name="${style}"${span > 1 ? ` table:number-columns-spanned="${span}"` : ""}${rows > 1 ? ` table:number-rows-spanned="${rows}"` : ""} office:value-type="string">${inner}</table:table-cell>` +
        "<table:covered-table-cell/>".repeat(span - 1)
      );
    };
    return (
      `<table:table><table:table-column table:number-columns-repeated="${columns}"/>` +
      grid.map((row) => `<table:table-row>${row.map(cell).join("")}</table:table-row>`).join("") +
      "</table:table>"
    );
  };
  const body = paragraphs.map(paragraph).join("");
  const lists = LIST_NAMES.map((name, at) => {
    const list = LISTS[name] as (typeof LISTS)[string];
    const position =
      '<style:list-level-properties text:space-before="14pt" text:min-label-width="14pt"/>';
    return (
      `<text:list-style style:name="L${at + 1}">` +
      (list.number
        ? `<text:list-level-style-number text:level="1" style:num-format="${list.number}" style:num-suffix=".">${position}</text:list-level-style-number>`
        : `<text:list-level-style-bullet text:level="1" text:bullet-char="${list.text}">${position}</text:list-level-style-bullet>`) +
      "</text:list-style>"
    );
  }).join("");
  const content =
    `${XML_HEAD}<office:document-content ${ODT_ROOT}><office:automatic-styles>${automatic.join("")}${lists}</office:automatic-styles>` +
    `<office:body><office:text>${body}</office:text></office:body></office:document-content>`;
  const manifest =
    `${XML_HEAD}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">` +
    `<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${ODT_TYPE}"/>` +
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
    pictures
      .map(
        ({ name, type }) =>
          `<manifest:file-entry manifest:full-path="Pictures/${name}" manifest:media-type="image/${type}"/>`,
      )
      .join("") +
    "</manifest:manifest>";
  return zipStored([
    { name: "mimetype", bytes: encoder.encode(ODT_TYPE) },
    { name: "content.xml", bytes: encoder.encode(content) },
    { name: "META-INF/manifest.xml", bytes: encoder.encode(manifest) },
    ...pictures.map(({ name, bytes }) => ({ name: `Pictures/${name}`, bytes })),
  ]);
}

const points = (value: string | null) => {
  const match = /^(-?[\d.]+)(pt|in|cm|mm|px)?$/.exec(value ?? "");
  if (!match) return 0;
  const number = Number(match[1]);
  const unit = { in: 72, cm: 72 / 2.54, mm: 72 / 25.4, px: 0.75, pt: 1 };
  return number * (unit[(match[2] ?? "pt") as keyof typeof unit] ?? 1);
};

/** The paragraphs of an OpenDocument text file's bytes. Throws when the bytes are not one. */
export async function readOdt(bytes: Uint8Array): Promise<RtfParagraph[]> {
  const files = await unzip(bytes);
  const content = parseXml(files.get("content.xml"));
  const text = content
    ? descendants(content, "text").find((each) => each.prefix === "office")
    : null;
  if (!content || !text) throw new Error("The file is not an OpenDocument text file.");
  // The file's styles, named and automatic, by name.
  const styles = new Map<string, Element>();
  for (const part of [parseXml(files.get("styles.xml")), content]) {
    for (const each of part ? descendants(part, "style") : []) {
      const name = attr(each, "name");
      if (name && each.prefix === "style") styles.set(name, each);
    }
  }
  const listKinds = new Map<string, string>();
  for (const part of [parseXml(files.get("styles.xml")), content]) {
    for (const each of part ? descendants(part, "list-style") : []) {
      const level = kids(each)[0];
      if (!level) continue;
      const number = attr(level, "num-format");
      const char = attr(level, "bullet-char");
      listKinds.set(
        attr(each, "name") ?? "",
        level.localName === "list-level-style-number"
          ? (LIST_NAMES.find((name) => LISTS[name]?.number === number) ?? "decimal")
          : (LIST_NAMES.find((name) => LISTS[name]?.text === char) ?? "disc"),
      );
    }
  }
  const propertyChain = (name: string | null, kind: string, depth = 0): Element[] => {
    const style = name ? styles.get(name) : undefined;
    if (!style || depth > 16) return [];
    const own = kid(style, kind);
    return [
      ...propertyChain(attr(style, "parent-style-name"), kind, depth + 1),
      ...(own ? [own] : []),
    ];
  };
  const applyText = (name: string | null, around: RtfStyle): RtfStyle => {
    const made = { ...around };
    for (const properties of propertyChain(name, "text-properties")) {
      const family = attr(properties, "font-family") ?? attr(properties, "font-name");
      if (family) made.family = family.replace(/^['"]|['"]$/g, "");
      const size = points(attr(properties, "font-size"));
      if (size > 0) made.size = size;
      const weight = attr(properties, "font-weight");
      if (weight) made.bold = weight === "bold" || Number(weight) >= 600;
      const style = attr(properties, "font-style");
      if (style) made.italic = style === "italic" || style === "oblique";
      const under = attr(properties, "text-underline-style");
      if (under) made.underline = under !== "none";
      const through = attr(properties, "text-line-through-style");
      if (through) made.strikethrough = through !== "none";
      const color = hexOf(attr(properties, "color"));
      if (color) made.color = color;
      const background = hexOf(attr(properties, "background-color"));
      if (background) made.highlight = background;
      const position = attr(properties, "text-position");
      if (position?.startsWith("super")) made.script = "super";
      else if (position?.startsWith("sub")) made.script = "sub";
    }
    return made;
  };
  const runsIn = (node: Element, style: RtfStyle, runs: RtfRun[]) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        // White space in the XML collapses, as ODF says.
        pushText(runs, (child.nodeValue ?? "").replace(/[\t\r\n ]+/g, " "), style);
        continue;
      }
      if (child.nodeType !== 1) continue;
      const element = child as Element;
      switch (element.localName) {
        case "span":
          runsIn(element, applyText(attr(element, "style-name"), style), runs);
          break;
        case "a": {
          const href = attr(element, "href");
          runsIn(
            element,
            href && /^(https?:|drive:)/i.test(href) ? { ...style, link: href } : style,
            runs,
          );
          break;
        }
        case "tab":
          pushText(runs, "\t", style);
          break;
        case "line-break":
          pushText(runs, "\n", style);
          break;
        case "s":
          pushText(runs, " ".repeat(Math.min(1000, Number(attr(element, "c")) || 1)), style);
          break;
        case "frame": {
          const href = attr(kid(element, "image") ?? element, "href") ?? "";
          const file = files.get(href.replace(/^\.\//, ""));
          if (file && /\.(png|jpe?g)$/i.test(href)) {
            runs.push({
              text: "",
              style: { ...style },
              picture: {
                src: pictureSource(file, href),
                width: Math.round(points(attr(element, "width"))),
                height: Math.round(points(attr(element, "height"))),
              },
            });
          }
          break;
        }
      }
    }
  };
  const paragraphOf = (element: Element, list?: string): RtfParagraph => {
    const name = attr(element, "style-name");
    const format: Record<string, string | null> = {};
    for (const properties of propertyChain(name, "paragraph-properties")) {
      for (const key of [
        "text-align",
        "line-height",
        "margin-top",
        "margin-bottom",
        "writing-mode",
      ]) {
        const value = attr(properties, key);
        if (value) format[key] = value;
      }
    }
    const start = applyText(name, {
      ...DEFAULT_STYLE,
      ...(element.localName === "h" ? { bold: true } : undefined),
    });
    const runs: RtfRun[] = [];
    runsIn(element, start, runs);
    const align = format["text-align"];
    const height = Number.parseFloat(format["line-height"] ?? "");
    const before = points(format["margin-top"] ?? null);
    const after = points(format["margin-bottom"] ?? null);
    return {
      align:
        align === "center"
          ? "center"
          : align === "end" || align === "right"
            ? "right"
            : align === "justify"
              ? "justify"
              : "left",
      ...(format["writing-mode"]?.startsWith("rl") ? { direction: "rtl" as const } : undefined),
      ...(/%$/.test(format["line-height"] ?? "") && height > 105
        ? { spacing: nearestSpacing(height / 100) }
        : undefined),
      ...(before > 0 ? { before } : undefined),
      ...(after > 0 ? { after } : undefined),
      ...(list ? { list } : undefined),
      runs,
    };
  };
  const blocksIn = (parent: Element, list?: string): RtfParagraph[] =>
    kids(parent).flatMap((child) => {
      if (child.localName === "p" || child.localName === "h") return [paragraphOf(child, list)];
      if (child.localName === "list") {
        const kind = listKinds.get(attr(child, "style-name") ?? "") ?? list ?? "disc";
        return kids(child, "list-item").flatMap((item) => blocksIn(item, kind));
      }
      if (child.localName === "table") return [tableOf(child)];
      return [];
    });
  const tableOf = (element: Element): RtfParagraph => {
    let border = 0;
    const rows = kids(element, "table-row").map((row) =>
      kids(row, "table-cell").map((cell): RtfCell => {
        const properties = propertyChain(attr(cell, "style-name"), "table-cell-properties").at(-1);
        const edge = /^([\d.]+)pt/.exec(properties ? (attr(properties, "border") ?? "") : "");
        if (edge) border = Math.max(border, Math.round(Number(edge[1])));
        const fill = properties ? hexOf(attr(properties, "background-color")) : undefined;
        const span = Number(attr(cell, "number-columns-spanned"));
        const down = Number(attr(cell, "number-rows-spanned"));
        return {
          paragraphs: blocksIn(cell),
          ...(span > 1 ? { span } : undefined),
          ...(down > 1 ? { rows: down } : undefined),
          ...(fill ? { background: fill } : undefined),
        };
      }),
    );
    return { align: "left", runs: [], table: { border: Math.min(3, border), rows } };
  };
  return blocksIn(text);
}

// ---------------------------------------------------------------------------------------------
// Web Archive

/** The bytes of a Web Archive holding `html`: an XML property list, which Safari opens. */
export function writeWebArchive(html: string): Uint8Array {
  return encoder.encode(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
      '<plist version="1.0"><dict><key>WebMainResource</key><dict>' +
      `<key>WebResourceData</key><data>${base64Of(encoder.encode(html))}</data>` +
      "<key>WebResourceFrameName</key><string></string>" +
      "<key>WebResourceMIMEType</key><string>text/html</string>" +
      "<key>WebResourceTextEncodingName</key><string>UTF-8</string>" +
      "<key>WebResourceURL</key><string>about:blank</string>" +
      "</dict></dict></plist>\n",
  );
}

type PlistValue =
  | string
  | number
  | boolean
  | Uint8Array
  | PlistValue[]
  | { [key: string]: PlistValue }
  | null;

/** A binary property list, as Safari writes a Web Archive. */
function readBinaryPlist(bytes: Uint8Array): PlistValue {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const trailer = bytes.length - 32;
  if (trailer < 8) throw new Error("The file is not a property list.");
  const offsetSize = view.getUint8(trailer + 6);
  const refSize = view.getUint8(trailer + 7);
  const count = Number(view.getBigUint64(trailer + 8));
  const top = Number(view.getBigUint64(trailer + 16));
  const table = Number(view.getBigUint64(trailer + 24));
  const sized = (at: number, size: number) => {
    let value = 0;
    for (let part = 0; part < size; part += 1) value = value * 256 + view.getUint8(at + part);
    return value;
  };
  const object = (index: number, depth: number): PlistValue => {
    if (index >= count || depth > 64) throw new Error("The property list is damaged.");
    const at = sized(table + index * offsetSize, offsetSize);
    const marker = view.getUint8(at);
    const kind = marker >> 4;
    let length = marker & 15;
    let body = at + 1;
    if (length === 15 && kind >= 4) {
      const size = 1 << (view.getUint8(body) & 15);
      length = sized(body + 1, size);
      body += 1 + size;
    }
    switch (kind) {
      case 0:
        return marker === 8 ? false : marker === 9 ? true : null;
      case 1:
        return sized(body, 1 << (marker & 15));
      case 4:
        return bytes.subarray(body, body + length);
      case 5:
        return new TextDecoder("ascii").decode(bytes.subarray(body, body + length));
      case 6: {
        let text = "";
        for (let unit = 0; unit < length; unit += 1) {
          text += String.fromCharCode(view.getUint16(body + unit * 2));
        }
        return text;
      }
      case 10:
        return Array.from({ length }, (_, unit) =>
          object(sized(body + unit * refSize, refSize), depth + 1),
        );
      case 13: {
        const out: { [key: string]: PlistValue } = {};
        for (let unit = 0; unit < length; unit += 1) {
          const key = object(sized(body + unit * refSize, refSize), depth + 1);
          const value = object(sized(body + (length + unit) * refSize, refSize), depth + 1);
          if (typeof key === "string") out[key] = value;
        }
        return out;
      }
      default:
        return null;
    }
  };
  return object(top, 0);
}

function readXmlPlist(bytes: Uint8Array): PlistValue {
  const document = parseXml(bytes);
  const root = document?.documentElement.firstElementChild;
  if (!root) throw new Error("The file is not a property list.");
  const value = (element: Element): PlistValue => {
    switch (element.localName) {
      case "dict": {
        const out: { [key: string]: PlistValue } = {};
        const entries = [...element.children];
        for (let at = 0; at + 1 < entries.length; at += 2) {
          out[entries[at]?.textContent ?? ""] = value(entries[at + 1] as Element);
        }
        return out;
      }
      case "data":
        return base64Bytes((element.textContent ?? "").replace(/\s+/g, ""));
      case "string":
        return element.textContent ?? "";
      default:
        return null;
    }
  };
  return value(root);
}

/**
 * The HTML of a Web Archive's main page. Its other resources are not read: the view shows no picture
 * held outside the text. Throws when the bytes are not a Web Archive.
 */
export function readWebArchive(bytes: Uint8Array): string {
  const binary = decoder.decode(bytes.subarray(0, 8)) === "bplist00";
  const root = (binary ? readBinaryPlist(bytes) : readXmlPlist(bytes)) as {
    WebMainResource?: { WebResourceData?: unknown; WebResourceTextEncodingName?: unknown };
  } | null;
  const main = root?.WebMainResource;
  if (!(main?.WebResourceData instanceof Uint8Array)) {
    throw new Error("The file is not a Web Archive.");
  }
  const label =
    typeof main.WebResourceTextEncodingName === "string" && main.WebResourceTextEncodingName
      ? main.WebResourceTextEncodingName
      : "utf-8";
  return new TextDecoder(label).decode(main.WebResourceData);
}
