import type { NotesNote } from "./notes-data";

/*
 * How two people's edits of one shared note meet when one saved first: a three-way merge by lines
 * and by the note's top-level blocks, so that two people changing different lines keep both. Only
 * changes to the same line are a conflict, which the caller keeps as a copy (`notes-shared.ts`).
 */

const equal = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, at) => item === b[at]);

/** For each index of `a` on a longest common subsequence with `b`, its index in `b`. */
function commonLines(a: readonly string[], b: readonly string[]): Map<number, number> {
  const lengths = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    const row = lengths[i] as Int32Array;
    const next = lengths[i + 1] as Int32Array;
    for (let j = b.length - 1; j >= 0; j -= 1) {
      row[j] =
        a[i] === b[j]
          ? (next[j + 1] as number) + 1
          : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  const pairs = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.set(i, j);
      i += 1;
      j += 1;
    } else if ((lengths[i + 1]?.[j] as number) >= (lengths[i]?.[j + 1] as number)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/**
 * `mine` and `theirs`, both made from `base`, as one list: what only one side changed takes that
 * side's, and what both added at one place keeps both, theirs first. `null` when both changed the
 * same lines differently.
 */
export function mergeLines(
  base: readonly string[],
  mine: readonly string[],
  theirs: readonly string[],
): string[] | null {
  const toMine = commonLines(base, mine);
  const toTheirs = commonLines(base, theirs);
  const out: string[] = [];
  let fromBase = 0;
  let fromMine = 0;
  let fromTheirs = 0;
  for (let at = 0; at <= base.length; at += 1) {
    const inMine = at === base.length ? mine.length : toMine.get(at);
    const inTheirs = at === base.length ? theirs.length : toTheirs.get(at);
    if (inMine === undefined || inTheirs === undefined) continue;
    const was = base.slice(fromBase, at);
    const ours = mine.slice(fromMine, inMine);
    const others = theirs.slice(fromTheirs, inTheirs);
    if (equal(ours, others) || equal(was, ours)) out.push(...others);
    else if (equal(was, others)) out.push(...ours);
    else if (was.length === 0) out.push(...others, ...ours);
    else {
      // Neighbouring lines each side changed on its own are not a conflict.
      if (was.length !== ours.length || was.length !== others.length) return null;
      for (const [index, line] of was.entries()) {
        const a = ours[index] as string;
        const b = others[index] as string;
        if (a !== line && b !== line && a !== b) return null;
        out.push(a === line ? b : a);
      }
    }
    if (at < base.length) out.push(base[at] as string);
    fromBase = at + 1;
    fromMine = inMine + 1;
    fromTheirs = inTheirs + 1;
  }
  return out;
}

const escaped = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A note's text with formats as a list of lines of markup: each top-level block as it is, and
 * each run of text and inline elements between them in a `div`, which is how the editor would
 * write it after a return. A plain note is its lines. Parsed in an inert template.
 */
export function blocksOf(note: Pick<NotesNote, "lines" | "html">): string[] {
  if (note.html === undefined) {
    return note.lines.map((line) => `<div>${line === "" ? "<br>" : escaped(line)}</div>`);
  }
  const template = document.createElement("template");
  template.innerHTML = note.html;
  const blocks: string[] = [];
  let run = "";
  const endRun = () => {
    if (run !== "") blocks.push(`<div>${run}</div>`);
    run = "";
  };
  for (const node of template.content.childNodes) {
    if (node.nodeType === 3) {
      run += escaped(node.nodeValue ?? "");
    } else if (node.nodeType === 1) {
      const element = node as Element;
      if (element.tagName === "BR") {
        blocks.push(run === "" ? "<div><br></div>" : `<div>${run}</div>`);
        run = "";
      } else if (/^(DIV|P|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE)$/.test(element.tagName)) {
        endRun();
        blocks.push(element.outerHTML);
      } else {
        run += element.outerHTML;
      }
    }
  }
  endRun();
  return blocks;
}

/** A note's fields that go together: its text, formats, dates and files. */
export const CONTENT_FIELDS = [
  "lines",
  "html",
  "date",
  "edited",
  "attachment",
  "picture",
  "files",
] as const;

const contentKey = (note: NotesNote) =>
  JSON.stringify(CONTENT_FIELDS.map((field) => note[field] ?? null));
const textKey = (note: NotesNote) => JSON.stringify([note.lines, note.html ?? null]);

/** What a side made of a field `base` held: its value, when only it changed the field. */
const changedField = <T>(base: T, mine: T, theirs: T): T => (mine !== base ? mine : theirs);

/** The files of both sides: those either added, without those either removed. */
function mergeFiles(base: NotesNote, mine: NotesNote, theirs: NotesNote) {
  const was = new Set((base.files ?? []).map((file) => file.id));
  const kept = new Set((mine.files ?? []).map((file) => file.id));
  const out = (theirs.files ?? []).filter((file) => !was.has(file.id) || kept.has(file.id));
  for (const file of mine.files ?? []) {
    if (!out.some((each) => each.id === file.id) && !was.has(file.id)) out.push(file);
  }
  return out;
}

export interface SharedNoteMerge {
  /** The note as it is kept. */
  note: NotesNote;
  /** Whether both changed the same lines: `note` then holds theirs, saved first. */
  conflict: boolean;
}

/**
 * A shared note this page changed from `base` as it meets the stored note someone else saved
 * first. Text only one side changed takes that side's; text both changed merges by line and by
 * block, and where both changed one line it keeps theirs and says so.
 */
export function mergeSharedNote(
  base: NotesNote,
  mine: NotesNote,
  theirs: NotesNote,
): SharedNoteMerge {
  const pinned = mine.pinned !== base.pinned ? mine.pinned : theirs.pinned;
  const pin = pinned === undefined ? {} : { pinned };
  const without = (note: NotesNote) => {
    const { pinned: _pinned, ...rest } = note;
    return rest;
  };
  if (contentKey(mine) === contentKey(base)) {
    return { note: { ...without(theirs), ...pin }, conflict: false };
  }
  if (contentKey(theirs) === contentKey(base)) {
    return { note: { ...without(mine), ...pin }, conflict: false };
  }
  const dates = { date: mine.date, edited: mine.edited };
  const rest: Partial<NotesNote> = {};
  const files = mergeFiles(base, mine, theirs);
  if (files.length > 0) rest.files = files;
  const picture = changedField(base.picture, mine.picture, theirs.picture);
  if (picture !== undefined) rest.picture = picture;
  const attachment = changedField(base.attachment, mine.attachment, theirs.attachment);
  if (attachment !== undefined) rest.attachment = attachment;
  const { files: _files, picture: _picture, attachment: _attachment, ...plain } = without(theirs);
  const merged = { ...plain, ...dates, ...rest, ...pin };
  if (textKey(mine) === textKey(base) || textKey(mine) === textKey(theirs)) {
    return { note: { ...merged, lines: theirs.lines }, conflict: false };
  }
  if (textKey(theirs) === textKey(base)) {
    const { html: _html, ...noHtml } = merged;
    return {
      note: {
        ...noHtml,
        lines: mine.lines,
        ...(mine.html === undefined ? {} : { html: mine.html }),
      },
      conflict: false,
    };
  }
  const lines = mergeLines(base.lines, mine.lines, theirs.lines);
  const plainText = base.html === undefined && mine.html === undefined && theirs.html === undefined;
  const blocks = plainText ? [] : mergeLines(blocksOf(base), blocksOf(mine), blocksOf(theirs));
  if (!lines || !blocks) return { note: theirs, conflict: true };
  const { html: _html, ...noHtml } = merged;
  return {
    note: { ...noHtml, lines, ...(plainText ? {} : { html: blocks.join("") }) },
    conflict: false,
  };
}
