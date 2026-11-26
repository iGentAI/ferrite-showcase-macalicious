import { useSyncExternalStore } from "react";
import { changeDesktopValue, desktopValues, subscribeDesktopValues } from "./desktop-personal";

/*
 * A text kept among the person's desktop values, which may be larger than one value holds: the
 * server refuses every setting of a save when one value passes 4096 bytes. A long text goes in
 * pieces, up to 16 values' worth, in the slot the last save did not use, and the value under its key
 * names them last: a save that stops part-way leaves the last whole text.
 */

const MAX_VALUE_BYTES = 4000;
const MOST_PIECES = 16;

const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** `text` in pieces that each fit in one value, never parting a character. */
function piecesOf(text: string): string[] {
  const pieces: string[] = [];
  let piece = "";
  let bytes = 2;
  for (const character of text) {
    const more = bytesOf(character) - 2;
    if (bytes + more > MAX_VALUE_BYTES) {
      pieces.push(piece);
      piece = "";
      bytes = 2;
    }
    piece += character;
    bytes += more;
  }
  pieces.push(piece);
  return pieces;
}

/** The text under `key`; a save that stopped part-way reads as none. */
export function readKeptText(key: string): string | undefined {
  const values = desktopValues();
  const stored = values[key] as
    | { pieces?: unknown; length?: unknown; slot?: unknown }
    | string
    | null
    | undefined;
  if (typeof stored === "string") return stored;
  if (typeof stored?.pieces !== "number") return undefined;
  let text = "";
  for (let at = 0; at < stored.pieces; at += 1) {
    const piece = values[`${key}.${stored.slot}.${at}`];
    if (typeof piece !== "string") return undefined;
    text += piece;
  }
  return text.length === stored.length ? text : undefined;
}

function dropPieces(key: string, slot: number, from: number) {
  for (let at = from; at < MOST_PIECES; at += 1) {
    if (desktopValues()[`${key}.${slot}.${at}`] != null) {
      changeDesktopValue(`${key}.${slot}.${at}`, null);
    }
  }
}

/** Keeps `text` under `key`. False when it is too long to keep: what was kept before stays. */
export function keepText(key: string, text: string): boolean {
  const pieces = bytesOf(text) <= MAX_VALUE_BYTES ? null : piecesOf(text);
  if (pieces && pieces.length > MOST_PIECES) return false;
  const before = desktopValues()[key] as { slot?: unknown } | string | null | undefined;
  const slot = typeof before === "object" && before?.slot === 0 ? 1 : 0;
  for (const [at, piece] of (pieces ?? []).entries()) {
    changeDesktopValue(`${key}.${slot}.${at}`, piece);
  }
  changeDesktopValue(key, pieces ? { pieces: pieces.length, length: text.length, slot } : text);
  dropPieces(key, 1 - slot, 0);
  dropPieces(key, slot, pieces?.length ?? 0);
  return true;
}

/** Forgets the pieces under `key`, for a value that now holds itself. */
export function forgetKeptPieces(key: string): void {
  dropPieces(key, 0, 0);
  dropPieces(key, 1, 0);
}

/** Forgets the text under `key` and its pieces. */
export function forgetKeptText(key: string): void {
  changeDesktopValue(key, null);
  forgetKeptPieces(key);
}

/** The text under `key` now, following every change. */
export function useKeptTextValue(key: string): string | undefined {
  return useSyncExternalStore(
    subscribeDesktopValues,
    () => readKeptText(key),
    () => undefined,
  );
}
