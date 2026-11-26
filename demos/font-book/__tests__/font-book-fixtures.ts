/*
 * Font files built byte by byte for the tests: an sfnt or a WOFF holding the tables Font Book reads and
 * the ones its validation requires, and a minimal WOFF2 whose header is sound, which is all a page can
 * check of one.
 */

import { deflateSync } from "node:zlib";

const utf16 = (text: string) => {
  const bytes = new Uint8Array(text.length * 2);
  [...text].forEach((character, index) => {
    new DataView(bytes.buffer).setUint16(index * 2, character.charCodeAt(0));
  });
  return bytes;
};

function nameTable(names: readonly [id: number, text: string][]) {
  const strings = names.map(([, text]) => utf16(text));
  const size = strings.reduce((sum, each) => sum + each.length, 0);
  const header = 6 + names.length * 12;
  const table = new Uint8Array(header + size);
  const view = new DataView(table.buffer);
  view.setUint16(2, names.length);
  view.setUint16(4, header);
  let offset = 0;
  names.forEach(([id], index) => {
    const at = 6 + index * 12;
    const text = strings[index] as Uint8Array;
    view.setUint16(at, 3);
    view.setUint16(at + 2, 1);
    view.setUint16(at + 4, 0x409);
    view.setUint16(at + 6, id);
    view.setUint16(at + 8, text.length);
    view.setUint16(at + 10, offset);
    table.set(text, header + offset);
    offset += text.length;
  });
  return table;
}

/** A format 4 `cmap` of one segment and its terminator, each character's glyph by `idDelta`. */
export function cmapFormat4(first: number, last: number) {
  const table = new Uint8Array(12 + 32);
  const view = new DataView(table.buffer);
  view.setUint16(2, 1);
  view.setUint16(4, 3);
  view.setUint16(6, 1);
  view.setUint32(8, 12);
  const at = 12;
  view.setUint16(at, 4);
  view.setUint16(at + 6, 4);
  view.setUint16(at + 14, last);
  view.setUint16(at + 16, 0xffff);
  view.setUint16(at + 20, first);
  view.setUint16(at + 22, 0xffff);
  view.setUint16(at + 24, 1 - first + 0x10000);
  view.setUint16(at + 26, 1);
  return table;
}

function postTable(fixed: boolean) {
  const table = new Uint8Array(32);
  new DataView(table.buffer).setUint32(12, fixed ? 1 : 0);
  return table;
}

function headTable() {
  const table = new Uint8Array(54);
  new DataView(table.buffer).setUint32(12, 0x5f0f3cf5);
  return table;
}

export type FontTableList = readonly (readonly [tag: string, table: Uint8Array])[];

/** The tables of "Quince Bold", which maps `first` to `last`. */
export const quinceTables = (fixed = true, first = 0x20, last = 0x7e): FontTableList => [
  [
    "name",
    nameTable([
      [0, "Copyright 2019 Quince Foundry"],
      [1, "Quince"],
      [2, "Bold"],
      [4, "Quince Bold"],
      [5, "Version 2.5"],
      [6, "Quince-Bold"],
      [9, "Ada Lovelace"],
    ]),
  ],
  ["cmap", cmapFormat4(first, last)],
  ["post", postTable(fixed)],
  ["head", headTable()],
  ["hhea", new Uint8Array(36)],
  ["hmtx", new Uint8Array(4)],
  ["maxp", new Uint8Array(6)],
];

const setTag = (view: DataView, at: number, tag: string) => {
  [...tag].forEach((character, part) => {
    view.setUint8(at + part, character.charCodeAt(0));
  });
};

/** The OpenType checksum: the table's 32-bit big-endian words summed, the last one padded. */
function checksum(table: Uint8Array) {
  let sum = 0;
  for (let at = 0; at < table.length; at += 4) {
    const word =
      (((table[at] ?? 0) << 24) |
        ((table[at + 1] ?? 0) << 16) |
        ((table[at + 2] ?? 0) << 8) |
        (table[at + 3] ?? 0)) >>>
      0;
    sum = (sum + word) >>> 0;
  }
  return sum;
}

export function sfnt(tables: FontTableList): ArrayBuffer {
  let size = 12 + tables.length * 16;
  const offsets = tables.map(([, table]) => {
    const at = size;
    size += table.length;
    return at;
  });
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, tables.length);
  tables.forEach(([tag, table], index) => {
    const at = 12 + index * 16;
    setTag(view, at, tag);
    view.setUint32(at + 4, checksum(table));
    view.setUint32(at + 8, offsets[index] as number);
    view.setUint32(at + 12, table.length);
    bytes.set(table, offsets[index] as number);
  });
  return bytes.buffer;
}

export function woff(tables: FontTableList): ArrayBuffer {
  const packed = tables.map(([tag, table]) => [tag, table, deflateSync(table)] as const);
  let size = 44 + tables.length * 20;
  const offsets = packed.map(([, , deflated]) => {
    const at = size;
    size += deflated.length;
    return at;
  });
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x774f4646);
  view.setUint32(8, size);
  view.setUint16(12, tables.length);
  packed.forEach(([tag, table, deflated], index) => {
    const at = 44 + index * 20;
    setTag(view, at, tag);
    view.setUint32(at + 4, offsets[index] as number);
    view.setUint32(at + 8, deflated.length);
    view.setUint32(at + 12, table.length);
    bytes.set(deflated, offsets[index] as number);
  });
  return bytes.buffer;
}

/** A WOFF2 of one table: its header is all that Font Book can check or read of it. */
export function woff2(): ArrayBuffer {
  const bytes = new Uint8Array(48);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x774f4632);
  view.setUint32(8, 48);
  view.setUint16(12, 1);
  return bytes.buffer;
}
