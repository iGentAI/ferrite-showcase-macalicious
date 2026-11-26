/*
 * Font Book's File > Validate Font and Validate File: the checks a page can make of a font file's own
 * bytes, without the system's font services. And Edit > Look for Enabled Duplicates: which files on the
 * drive hold the same font.
 */

export type FontCheckState = "passed" | "warning" | "failed";

export interface FontCheck {
  name: string;
  state: FontCheckState;
  /** What was found, when it is not as it should be. */
  detail?: string;
}

const REQUIRED_TABLES = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "post"];
/** head's `magicNumber`, at this offset in its table (OpenType, `head`). */
const HEAD_MAGIC = 0x5f0f3cf5;
const HEAD_MAGIC_AT = 12;

const tagAt = (view: DataView, at: number) =>
  String.fromCharCode(
    view.getUint8(at),
    view.getUint8(at + 1),
    view.getUint8(at + 2),
    view.getUint8(at + 3),
  );

/** The OpenType checksum of a table: its 32-bit big-endian words summed, the last one padded. */
function tableChecksum(view: DataView, offset: number, length: number): number {
  let sum = 0;
  const whole = length - (length % 4);
  for (let at = 0; at < whole; at += 4) sum = (sum + view.getUint32(offset + at)) >>> 0;
  let last = 0;
  for (let at = whole; at < length; at += 1) {
    last |= view.getUint8(offset + at) << (24 - (at - whole) * 8);
  }
  return (sum + (last >>> 0)) >>> 0;
}

const failed = (name: string, detail: string): FontCheck => ({ name, state: "failed", detail });
const passed = (name: string): FontCheck => ({ name, state: "passed" });

function requiredTables(tags: readonly string[]): FontCheck {
  const absent = REQUIRED_TABLES.filter((tag) => !tags.includes(tag));
  return absent.length === 0
    ? passed("Required tables")
    : failed("Required tables", `Missing: ${absent.join(", ")}`);
}

function checkSfnt(view: DataView): FontCheck[] {
  const count = view.byteLength >= 12 ? view.getUint16(4) : 0;
  if (count === 0 || 12 + count * 16 > view.byteLength) {
    return [failed("Table directory", "The list of tables does not fit in the file.")];
  }
  const tables = Array.from({ length: count }, (_, index) => {
    const at = 12 + index * 16;
    return {
      tag: tagAt(view, at),
      checksum: view.getUint32(at + 4),
      offset: view.getUint32(at + 8),
      length: view.getUint32(at + 12),
    };
  });
  const outside = tables.filter(({ offset, length }) => offset + length > view.byteLength);
  if (outside.length > 0) {
    return [
      failed(
        "Table directory",
        `Past the end of the file: ${outside.map(({ tag }) => tag).join(", ")}`,
      ),
    ];
  }
  const checks = [passed("Table directory"), requiredTables(tables.map(({ tag }) => tag))];
  const head = tables.find(({ tag }) => tag === "head");
  if (head) {
    const magic =
      head.length >= HEAD_MAGIC_AT + 4 ? view.getUint32(head.offset + HEAD_MAGIC_AT) : 0;
    checks.push(
      magic === HEAD_MAGIC
        ? passed("Font header")
        : failed("Font header", "The header's magic number is wrong."),
    );
  }
  // head holds the file's own adjustment, so its stored sum is not of the bytes as they stand.
  const wrong = tables.filter(
    ({ tag, offset, length, checksum }) =>
      tag !== "head" && tableChecksum(view, offset, length) !== checksum,
  );
  checks.push(
    wrong.length === 0
      ? passed("Table checksums")
      : {
          name: "Table checksums",
          state: "warning",
          detail: `Do not match: ${wrong.map(({ tag }) => tag).join(", ")}`,
        },
  );
  return checks;
}

function checkWoff(view: DataView, version: 1 | 2): FontCheck[] {
  if (view.byteLength < 44) return [failed("Web font header", "The file ends inside its header.")];
  if (view.getUint32(8) !== view.byteLength) {
    return [failed("Web font header", "The length it gives is not the file's.")];
  }
  const count = view.getUint16(12);
  if (count === 0) return [failed("Table directory", "The file lists no tables.")];
  const checks = [passed("Web font header")];
  // WOFF2 compresses its table directory with its tables: a page has no decoder for them.
  if (version === 1) {
    if (44 + count * 20 > view.byteLength) {
      checks.push(failed("Table directory", "The list of tables does not fit in the file."));
    } else {
      const tags = Array.from({ length: count }, (_, index) => tagAt(view, 44 + index * 20));
      checks.push(passed("Table directory"), requiredTables(tags));
    }
  }
  return checks;
}

/** What the bytes of a font file say of it. */
export function validateFontBytes(data: ArrayBuffer): readonly FontCheck[] {
  const view = new DataView(data);
  if (view.byteLength < 4) return [failed("File type", "The file is too short to be a font.")];
  const signature = tagAt(view, 0);
  const type = passed("File type");
  if (signature === "wOFF") return [type, ...checkWoff(view, 1)];
  if (signature === "wOF2") return [type, ...checkWoff(view, 2)];
  if (signature === "OTTO" || signature === "true" || view.getUint32(0) === 0x00010000) {
    return [type, ...checkSfnt(view)];
  }
  return [failed("File type", "The file does not start as a font does.")];
}

/** The worst of `checks`. */
export function validationVerdict(checks: readonly FontCheck[]): FontCheckState {
  if (checks.some(({ state }) => state === "failed")) return "failed";
  return checks.some(({ state }) => state === "warning") ? "warning" : "passed";
}

/** A file's checks, with whether the browser itself can load it. */
export async function validateFontFile(file: Blob): Promise<readonly FontCheck[]> {
  const data = await file.arrayBuffer();
  const checks = validateFontBytes(data);
  if (typeof FontFace === "undefined") return checks;
  try {
    await new FontFace("Font Book validation", data).load();
    return [...checks, passed("The browser can draw it")];
  } catch {
    return [...checks, failed("The browser can draw it", "The browser refused the file.")];
  }
}

export interface KeptFontFile {
  id: string;
  name: string;
  size?: number;
}

export interface DuplicateFonts {
  /** The file that stays: the first of its group on the drive. */
  keep: KeptFontFile;
  /** The files that hold the same font. */
  extra: readonly KeptFontFile[];
}

const plainName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase();

/**
 * The files that hold the same font: of one name whatever its extension, or of one size under a name
 * that differs only by the number the drive adds to a copy ("Quince 2.ttf").
 */
export function duplicateFontFiles(files: readonly KeptFontFile[]): readonly DuplicateFonts[] {
  const groups = new Map<string, KeptFontFile[]>();
  for (const file of files) {
    const name = plainName(file.name);
    const original = name.replace(/\s+\d+$/, "");
    const twin = files.find(
      (other) =>
        other !== file &&
        plainName(other.name) === original &&
        other.size !== undefined &&
        other.size === file.size,
    );
    const key = twin ? original : name;
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }
  return [...groups.values()].flatMap(([keep, ...extra]) =>
    keep && extra.length > 0 ? [{ keep, extra }] : [],
  );
}
