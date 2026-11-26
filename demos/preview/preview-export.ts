/*
 * How Preview writes what it exports: a picture as JPEG or PNG from a canvas, as an uncompressed
 * TIFF from the canvas's pixels (no browser encodes TIFF), and a PDF whose every
 * page is one JPEG picture (the page as the window shows it, markup drawn in), with the page's text
 * laid invisibly over it so it can still be selected and searched. The PDF writer is pure and small:
 * a catalogue, a page tree, and per page a page, its content stream and its picture, then the
 * cross-reference table that names where each object starts.
 */

export type ExportFormat = "jpeg" | "png" | "tiff" | "pdf";

export const EXPORT_FORMATS: readonly {
  value: ExportFormat;
  label: string;
  type: string;
  extension: string;
}[] = [
  { value: "jpeg", label: "JPEG", type: "image/jpeg", extension: "jpg" },
  { value: "png", label: "PNG", type: "image/png", extension: "png" },
  { value: "tiff", label: "TIFF", type: "image/tiff", extension: "tiff" },
  { value: "pdf", label: "PDF", type: "application/pdf", extension: "pdf" },
];

export const formatOf = (format: ExportFormat) =>
  EXPORT_FORMATS.find((entry) => entry.value === format) ??
  ({ value: "png", label: "PNG", type: "image/png", extension: "png" } as const);

/** Formats a Mac's Export writes that a browser has no encoder for: shown dimmed, saying so. */
export const UNWRITABLE_FORMATS: readonly string[] = ["HEIC", "JPEG-2000", "OpenEXR"];
export const UNWRITABLE_REASON = "This browser has no way to write this format.";

/** The quality of the JPEG pictures Preview writes. */
export const JPEG_QUALITY = 0.92;
/** The resolution a PDF's page is drawn at when it is exported: 150 dots per inch. */
export const PDF_EXPORT_SCALE = 150 / 72;

/** A file's name without its extension: `Holiday.final.png` gives `Holiday.final`. */
export function stemOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** A file's extension in lower case, without the dot; empty when it has none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** `name` with the extension of `format`. */
export const nameFor = (name: string, format: ExportFormat) =>
  `${stemOf(name) || "Untitled"}.${formatOf(format).extension}`;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];

/** Whether a drive file is a picture Preview opens, by its type or its name. */
export function isPicture(file: { name: string; type?: string }): boolean {
  const type = file.type ?? "";
  if (type.startsWith("image/")) return type !== "image/heic" && type !== "image/tiff";
  return IMAGE_EXTENSIONS.includes(extensionOf(file.name));
}

/** Whether a drive file is a PDF, by its type or its name. */
export const isPdf = (file: { name: string; type?: string }): boolean =>
  file.type === "application/pdf" || extensionOf(file.name) === "pdf";

/** Whether Preview opens the file. */
export const opensInPreview = (file: { name: string; type?: string; kind?: string }) =>
  file.kind !== "folder" && (isPicture(file) || isPdf(file));

/**
 * The format a picture is saved back in, keeping its own: PNG, JPEG or WebP (where the browser
 * writes WebP). Any other picture (GIF, SVG, BMP) cannot be written back as itself, and is
 * exported instead; `null` then.
 */
export function saveFormatOf(file: { name: string; type?: string }): string | null {
  const type = file.type || "";
  const extension = extensionOf(file.name);
  if (type === "image/png" || extension === "png") return "image/png";
  if (type === "image/jpeg" || extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (type === "image/webp" || extension === "webp") return "image/webp";
  return null;
}

/** The picture on `canvas`, encoded as `type`. Rejects when the browser cannot encode it. */
export function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("The picture could not be encoded."));
        // A browser that cannot write the type writes PNG instead: never save that under the
        // picture's own type.
        else if (blob.type !== type) reject(new Error(`This browser cannot write ${type}.`));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
};

/**
 * `bytes` of a PNG or a JFIF JPEG, saying they hold `dpi` pixels to the inch; any other file as it
 * is, since a canvas writes no more than these two with a place to say so.
 */
export function withResolutionBytes(bytes: Uint8Array, dpi: number): Uint8Array {
  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(21);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4);
    view.setUint32(8, ppm);
    view.setUint32(12, ppm);
    chunk[16] = 1;
    view.setUint32(17, crc32(chunk.subarray(4, 17)));
    // A PNG's first chunk is its header, 25 bytes long, after the 8 of the signature.
    const written = new Uint8Array(bytes.length + chunk.length);
    written.set(bytes.subarray(0, 33));
    written.set(chunk, 33);
    written.set(bytes.subarray(33), 33 + chunk.length);
    return written;
  }
  const jfif =
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[3] === 0xe0 &&
    String.fromCharCode(...bytes.subarray(6, 10)) === "JFIF";
  if (!jfif) return bytes;
  const written = bytes.slice();
  const dots = Math.min(65535, Math.round(dpi));
  written[13] = 1;
  written[14] = dots >> 8;
  written[15] = dots & 255;
  written[16] = dots >> 8;
  written[17] = dots & 255;
  return written;
}

/** `blob` saying it holds `dpi` pixels to the inch, where its format can say so. */
export async function withResolution(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([withResolutionBytes(bytes, dpi) as BlobPart], { type: blob.type });
}

/** A PDF of one empty page `width` × `height` points. */
export function blankPdf(width: number, height: number): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] >>`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const at = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return at;
  });
  const table = body.length;
  body += `xref\n0 4\n0000000000 65535 f \n${offsets
    .map((at) => `${String(at).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

/**
 * A TIFF of `pixels` (RGBA, a row at a time from the top, as a canvas holds them): one uncompressed
 * strip, little-endian, with the alpha as unassociated, as a canvas's is.
 */
export function writeTiff(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const entries: [tag: number, type: 3 | 4, count: number, value: number][] = [];
  const count = 11;
  const bitsAt = 8 + 2 + count * 12 + 4;
  const dataAt = bitsAt + 8;
  entries.push(
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, 4, bitsAt],
    [259, 3, 1, 1],
    [262, 3, 1, 2],
    [273, 4, 1, dataAt],
    [277, 3, 1, 4],
    [278, 4, 1, height],
    [279, 4, 1, pixels.length],
    [284, 3, 1, 1],
    [338, 3, 1, 2],
  );
  const out = new Uint8Array(dataAt + pixels.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0x4949, false);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, count, true);
  entries.forEach(([tag, type, values, value], index) => {
    const at = 10 + index * 12;
    view.setUint16(at, tag, true);
    view.setUint16(at + 2, type, true);
    view.setUint32(at + 4, values, true);
    if (type === 3) view.setUint16(at + 8, value, true);
    else view.setUint32(at + 8, value, true);
  });
  for (let sample = 0; sample < 4; sample += 1) view.setUint16(bitsAt + sample * 2, 8, true);
  out.set(pixels, dataAt);
  return out;
}

/** The picture on `canvas` as a TIFF. */
export function canvasTiff(canvas: HTMLCanvasElement): Blob {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The picture could not be read.");
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return new Blob([writeTiff(data, canvas.width, canvas.height) as BlobPart], {
    type: "image/tiff",
  });
}

/** One page of a PDF to write: a JPEG picture and the page's size in points. */
export interface PdfPage {
  jpeg: Uint8Array;
  /** The picture's size in pixels. */
  pixelWidth: number;
  pixelHeight: number;
  /** The page's size in points (1/72 inch). */
  width: number;
  height: number;
  /** The page's text, invisible over the picture. */
  text?: readonly PdfTextRun[];
}

/** A piece of a page's text. */
export interface PdfTextRun {
  text: string;
  /** Text space to the page's points, y up; its scale is the size of the font. */
  matrix: readonly [number, number, number, number, number, number];
  /** How wide it stands, in points. */
  width: number;
}

/** The width the invisible font gives every character, in thousandths of its size. */
const RUN_GLYPH_WIDTH = 500;

/** The drawing of `run` in render mode 3: nothing shows, and readers find the characters. */
function runOperators(run: PdfTextRun): string {
  const [a, b, c, d, e, f] = run.matrix;
  const hex = Array.from({ length: run.text.length }, (_, index) =>
    run.text.charCodeAt(index).toString(16).padStart(4, "0"),
  ).join("");
  const size = Math.max(Math.hypot(a, b), 1e-3);
  const natural = (run.text.length * RUN_GLYPH_WIDTH * size) / 1000;
  const stretch = natural > 0 && run.width > 0 ? (run.width / natural) * 100 : 100;
  const exact = (value: number) => (Math.round(value * 1000) / 1000).toString();
  return `${exact(stretch)} Tz ${[a, b, c, d, e, f].map(exact).join(" ")} Tm <${hex}> Tj`;
}

const encoder = new TextEncoder();
const fixed = (value: number) => {
  const text = (Math.round(value * 100) / 100).toString();
  return text.includes("e") ? value.toFixed(2) : text;
};

/**
 * A PDF of `pages`, each page showing its picture over the whole page. The pictures are JPEG
 * (`DCTDecode`) in RGB, as a canvas writes them.
 */
export function writePdf(pages: readonly PdfPage[], title = ""): Uint8Array {
  if (pages.length === 0) throw new Error("A PDF needs at least one page.");
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (number: number, body: string | (string | Uint8Array)[]) => {
    offsets[number] = length;
    push(`${number} 0 obj\n`);
    for (const part of Array.isArray(body) ? body : [body]) push(part);
    push("\nendobj\n");
  };
  // The header, and a comment of bytes over 127 that marks the file as binary.
  push("%PDF-1.4\n%");
  push(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  // Objects: 1 catalogue, 2 page tree, 3 information; then three per page; then the invisible font,
  // when any page has text.
  const pageNumber = (index: number) => 4 + index * 3;
  const fontAt = pageNumber(pages.length);
  const hasText = pages.some((page) => (page.text?.length ?? 0) > 0);
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageNumber(index)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  const safeTitle = title.replace(/[^\x20-\x7e]/g, "").replace(/([\\()])/g, "\\$1");
  object(3, `<< /Producer (Macalicious Preview) /Title (${safeTitle}) >>`);
  pages.forEach((page, index) => {
    const at = pageNumber(index);
    const runs = page.text ?? [];
    const words =
      runs.length > 0 ? `\nBT 3 Tr /F0 1 Tf ${runs.map(runOperators).join("\n")} ET` : "";
    const content = `q ${fixed(page.width)} 0 0 ${fixed(page.height)} 0 0 cm /Im0 Do Q${words}`;
    const font = runs.length > 0 ? ` /Font << /F0 ${fontAt} 0 R >>` : "";
    object(
      at,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fixed(page.width)} ${fixed(page.height)}] ` +
        `/Resources << /XObject << /Im0 ${at + 2} 0 R >>${font} >> /Contents ${at + 1} 0 R >>`,
    );
    object(at + 1, [`<< /Length ${content.length} >>\nstream\n`, content, "\nendstream"]);
    object(at + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      "\nendstream",
    ]);
  });
  if (hasText) {
    const map =
      "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Identity def " +
      "/CMapType 2 def 1 begincodespacerange <0000> <ffff> endcodespacerange " +
      "1 beginbfrange <0000> <ffff> <0000> endbfrange endcmap end end";
    object(
      fontAt,
      `<< /Type /Font /Subtype /Type0 /BaseFont /Helvetica /Encoding /Identity-H ` +
        `/DescendantFonts [${fontAt + 1} 0 R] /ToUnicode ${fontAt + 2} 0 R >>`,
    );
    object(
      fontAt + 1,
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Helvetica /DW ${RUN_GLYPH_WIDTH} ` +
        `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> >>`,
    );
    object(fontAt + 2, [`<< /Length ${map.length} >>\nstream\n`, map, "\nendstream"]);
  }
  const count = fontAt + (hasText ? 3 : 0);
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let number = 1; number < count; number += 1) {
    push(`${String(offsets[number]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Hands `blob` to the browser as a download named `name`: the file goes to the person's own
 * computer, outside the drive.
 */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // The browser has taken the address well before then.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
