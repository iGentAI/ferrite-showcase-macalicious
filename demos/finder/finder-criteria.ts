import type { FinderNode } from "./finder-data";

/**
 * The rows under a Finder search's scope bar: each names an attribute and what it must be, and an
 * item is found only if it answers them all.
 */

export type CriterionField =
  | "kind"
  | "name"
  | "contents"
  | "extension"
  | "modified"
  | "created"
  | "opened"
  | "size"
  | "tags";

export type CriterionUnit = "KB" | "MB" | "GB";

export interface FinderCriterion {
  field: CriterionField;
  op: string;
  value: string;
  /** A size's unit. */
  unit?: CriterionUnit;
}

interface Choice {
  id: string;
  label: string;
}

const TEXT_OPS: readonly Choice[] = [
  { id: "contains", label: "contains" },
  { id: "begins", label: "begins with" },
  { id: "ends", label: "ends with" },
  { id: "is", label: "is" },
];

const DATE_OPS: readonly Choice[] = [
  { id: "within", label: "is within last" },
  { id: "today", label: "is today" },
  { id: "yesterday", label: "is yesterday" },
  { id: "week", label: "is this week" },
  { id: "month", label: "is this month" },
  { id: "year", label: "is this year" },
  { id: "before", label: "is before" },
  { id: "after", label: "is after" },
];

export const CRITERION_KINDS: readonly Choice[] = [
  { id: "any", label: "Any" },
  { id: "application", label: "Application" },
  { id: "archive", label: "Archive" },
  { id: "document", label: "Document" },
  { id: "folder", label: "Folder" },
  { id: "image", label: "Image" },
  { id: "movie", label: "Movie" },
  { id: "music", label: "Music" },
  { id: "pdf", label: "PDF" },
  { id: "presentation", label: "Presentation" },
  { id: "text", label: "Text" },
];

export const CRITERION_UNITS: readonly CriterionUnit[] = ["KB", "MB", "GB"];

export const CRITERION_FIELDS: readonly (Choice & {
  id: CriterionField;
  ops: readonly Choice[];
})[] = [
  { id: "kind", label: "Kind", ops: [{ id: "is", label: "is" }] },
  { id: "modified", label: "Last modified date", ops: DATE_OPS },
  { id: "opened", label: "Last opened date", ops: DATE_OPS },
  { id: "created", label: "Created date", ops: DATE_OPS },
  { id: "name", label: "Name", ops: TEXT_OPS },
  { id: "contents", label: "Contents", ops: [{ id: "contains", label: "contains" }] },
  { id: "extension", label: "File extension", ops: [{ id: "is", label: "is" }] },
  { id: "tags", label: "Tags", ops: [{ id: "contains", label: "contains" }] },
  {
    id: "size",
    label: "File size",
    ops: [
      { id: "greater", label: "is greater than" },
      { id: "less", label: "is less than" },
    ],
  },
];

const fieldOf = (field: CriterionField) =>
  CRITERION_FIELDS.find((each) => each.id === field) ?? CRITERION_FIELDS[0];

/** The ways this row's attribute can be compared. */
export const criterionOps = (row: FinderCriterion): readonly Choice[] =>
  fieldOf(row.field)?.ops ?? [];

/** A new row for `field`, with what a person would most likely mean. */
export function newCriterion(field: CriterionField = "kind"): FinderCriterion {
  switch (field) {
    case "kind":
      return { field, op: "is", value: "any" };
    case "modified":
    case "opened":
    case "created":
      return { field, op: "within", value: "7" };
    case "size":
      return { field, op: "greater", value: "1", unit: "MB" };
    case "extension":
      return { field, op: "is", value: "" };
    default:
      return { field, op: "contains", value: "" };
  }
}

/** What the row's value is entered with. */
export function criterionInput(
  row: FinderCriterion,
): "kind" | "text" | "days" | "date" | "size" | null {
  if (row.field === "kind") return "kind";
  if (row.field === "size") return "size";
  if (row.field === "modified" || row.field === "opened" || row.field === "created") {
    if (row.op === "within") return "days";
    return row.op === "before" || row.op === "after" ? "date" : null;
  }
  return "text";
}

const ARCHIVES = /\.(zip|gz|tgz|tar|bz2|7z|rar|dmg)$/i;
const PRESENTATIONS = /\.(key|ppt|pptx|odp)$/i;
const TEXTS = /\.(txt|text|md|markdown|rtf|html?|csv|log|json|xml)$/i;

function isOfKind(node: FinderNode, kind: string): boolean {
  if (node.kind === "folder" || node.children !== undefined) {
    return kind === "any" || kind === "folder";
  }
  const text = TEXTS.test(node.name) || node.type?.startsWith("text/") === true;
  const presentation = PRESENTATIONS.test(node.name);
  switch (kind) {
    case "any":
      return true;
    case "application":
      return node.kind === "application";
    case "archive":
      return ARCHIVES.test(node.name);
    case "document":
      return (
        node.kind === "document" ||
        node.kind === "book" ||
        node.kind === "pdf" ||
        text ||
        presentation
      );
    case "folder":
      return false;
    case "image":
      return node.kind === "image";
    case "movie":
      return node.kind === "movie";
    case "music":
      return node.kind === "audio";
    case "pdf":
      return node.kind === "pdf";
    case "presentation":
      return presentation;
    case "text":
      return text;
    default:
      return false;
  }
}

function matchesText(text: string, op: string, wanted: string): boolean {
  switch (op) {
    case "begins":
      return text.startsWith(wanted);
    case "ends":
      return text.endsWith(wanted);
    case "is":
      return text === wanted;
    default:
      return text.includes(wanted);
  }
}

const dayOf = (date: Date, offset = 0) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset).getTime();

function matchesDate(stamp: string | undefined, op: string, value: string, now: Date): boolean {
  const when = stamp === undefined ? Number.NaN : Date.parse(stamp.replace(" ", "T"));
  if (Number.isNaN(when)) return false;
  const year = now.getFullYear();
  const month = now.getMonth();
  const within = (from: number, to: number) => when >= from && when < to;
  switch (op) {
    case "within": {
      const days = Number(value);
      if (!Number.isFinite(days) || days < 0) return false;
      const from = new Date(now);
      from.setDate(from.getDate() - days);
      return when >= from.getTime() && when <= now.getTime();
    }
    case "today":
      return within(dayOf(now), dayOf(now, 1));
    case "yesterday":
      return within(dayOf(now, -1), dayOf(now));
    case "week":
      return within(dayOf(now, -now.getDay()), dayOf(now, 7 - now.getDay()));
    case "month":
      return within(new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime());
    case "year":
      return within(new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime());
    case "before":
      return when < Date.parse(`${value}T00:00`);
    case "after":
      return when >= dayOf(new Date(`${value}T00:00`), 1);
    default:
      return false;
  }
}

const UNIT_BYTES: Record<CriterionUnit, number> = { KB: 1e3, MB: 1e6, GB: 1e9 };

function matchesSize(size: number | undefined, row: FinderCriterion): boolean {
  const limit = Number(row.value) * UNIT_BYTES[row.unit ?? "KB"];
  if (size === undefined || Number.isNaN(limit)) return false;
  return row.op === "less" ? size < limit : size > limit;
}

/**
 * Whether `node` answers the row. A row still being filled in, with no text yet, holds for
 * everything. `contents` are the drive ids the server found by their words for the Contents rows.
 */
export function matchesCriterion(
  node: FinderNode,
  row: FinderCriterion,
  contents: ReadonlySet<string> | undefined,
  now: Date,
): boolean {
  const wanted = row.value.trim().toLowerCase();
  switch (row.field) {
    case "kind":
      return isOfKind(node, row.value);
    case "name":
      return wanted === "" || matchesText(node.name.toLowerCase(), row.op, wanted);
    case "contents":
      return wanted === "" || (node.id !== undefined && contents?.has(node.id) === true);
    case "extension": {
      if (wanted === "") return true;
      const dot = node.name.lastIndexOf(".");
      return dot > 0 && node.name.slice(dot + 1).toLowerCase() === wanted.replace(/^\./, "");
    }
    case "tags":
      return wanted === "" || (node.tags ?? []).some((tag) => tag.toLowerCase().includes(wanted));
    case "size":
      return matchesSize(node.size, row);
    default:
      return matchesDate(node[row.field], row.op, row.value, now);
  }
}

/**
 * The words only the server can answer: those of the search's Contents row. A search has at most one,
 * since a row's words must all be inside the file already, and the route takes eight at a time.
 */
export const contentsWords = (rows: readonly FinderCriterion[]): string =>
  rows.find((row) => row.field === "contents")?.value.trim() ?? "";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A row kept in a saved search, or `null` when it is not one. */
export function readCriterion(stored: unknown): FinderCriterion | null {
  if (!isRecord(stored) || typeof stored.op !== "string" || typeof stored.value !== "string") {
    return null;
  }
  const field = CRITERION_FIELDS.find((each) => each.id === stored.field);
  if (!field?.ops.some((op) => op.id === stored.op)) return null;
  const unit = CRITERION_UNITS.find((each) => each === stored.unit);
  return { field: field.id, op: stored.op, value: stored.value, ...(unit ? { unit } : null) };
}
