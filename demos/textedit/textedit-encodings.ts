/**
 * The encodings of a plain text file. The browser decodes them all (`TextDecoder`) and encodes none
 * but UTF-8, so a file is written from a table built by decoding every byte or byte pair once.
 */

export const PLAIN_ENCODINGS = [
  { value: "utf-8", label: "Unicode (UTF-8)" },
  { value: "utf-16", label: "Unicode (UTF-16)" },
  { value: "windows-1252", label: "Western (Windows Latin 1)" },
  { value: "macintosh", label: "Western (Mac OS Roman)" },
  { value: "iso-8859-2", label: "Central European (ISO Latin 2)" },
  { value: "koi8-r", label: "Cyrillic (KOI8-R)" },
  { value: "shift_jis", label: "Japanese (Shift JIS)" },
  { value: "euc-jp", label: "Japanese (EUC)" },
  { value: "gbk", label: "Chinese (GBK)" },
  { value: "big5", label: "Chinese (Big 5)" },
  { value: "euc-kr", label: "Korean (EUC)" },
] as const;

/** Whether TextEdit reads and writes the encoding. */
export const isPlainEncoding = (value: string) =>
  PLAIN_ENCODINGS.some((entry) => entry.value === value);

/** Text that has a character the encoding it is saved in does not hold. */
export class UnencodableTextError extends Error {
  constructor(label: string) {
    super(`The text has characters that can’t be saved as ${label}. Choose another encoding.`);
    this.name = "UnencodableTextError";
  }
}

const tables = new Map<string, Map<string, number[]>>();

/** Every character of an encoding with its bytes: one byte, then lead and trail byte pairs. */
function tableOf(encoding: string): Map<string, number[]> {
  const known = tables.get(encoding);
  if (known) return known;
  const decoder = new TextDecoder(encoding, { fatal: true });
  const table = new Map<string, number[]>();
  const add = (bytes: number[]) => {
    try {
      const text = decoder.decode(new Uint8Array(bytes));
      if ([...text].length === 1 && !table.has(text)) table.set(text, bytes);
    } catch {
      // Bytes the encoding does not define.
    }
  };
  for (let byte = 0; byte < 256; byte += 1) add([byte]);
  const singleByte = table.size >= 250;
  if (!singleByte) {
    for (let lead = 0x81; lead <= 0xfe; lead += 1) {
      for (let trail = 0x40; trail <= 0xfe; trail += 1) add([lead, trail]);
    }
  }
  tables.set(encoding, table);
  return table;
}

/** `text` in `encoding`; throws `UnencodableTextError` for a character it does not hold. */
export function encodeText(text: string, encoding: string): Uint8Array {
  if (encoding === "utf-8") return new TextEncoder().encode(text);
  if (encoding === "utf-16") {
    // With a byte order mark, little-endian, so that "Automatic" reads it back.
    const bytes = new Uint8Array(2 + text.length * 2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 0xfeff, true);
    for (let at = 0; at < text.length; at += 1) {
      view.setUint16(2 + at * 2, text.charCodeAt(at), true);
    }
    return bytes;
  }
  const table = tableOf(encoding);
  const out: number[] = [];
  for (const character of text) {
    const bytes = table.get(character);
    if (!bytes) {
      const label = PLAIN_ENCODINGS.find((entry) => entry.value === encoding)?.label ?? encoding;
      throw new UnencodableTextError(label);
    }
    out.push(...bytes);
  }
  return new Uint8Array(out);
}

/**
 * The text of a file's bytes and the encoding they are in. `encoding` is the one the person chose in
 * the Open panel; without it a byte order mark says, or else the bytes must be UTF-8. `null` when
 * the bytes are not in that encoding, which is never guessed at.
 */
export function decodeText(
  bytes: Uint8Array,
  encoding?: string,
): { text: string; encoding: string } | null {
  const mark16 = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : undefined;
  const big16 = bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : undefined;
  const label =
    encoding === "utf-16" ? (big16 ?? "utf-16le") : (encoding ?? mark16 ?? big16 ?? "utf-8");
  try {
    const text = new TextDecoder(label, { fatal: true }).decode(bytes);
    return { text, encoding: label.startsWith("utf-16") ? "utf-16" : label };
  } catch {
    return null;
  }
}
