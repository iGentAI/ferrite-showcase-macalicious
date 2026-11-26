import { type FinderEntry, type FinderNode, kindText } from "./finder-data";

/** What a folder's items can be grouped by, in the order Finder's menus list them. */
export const GROUPS: readonly { column: string; label: string }[] = [
  { column: "name", label: "Name" },
  { column: "kind", label: "Kind" },
  { column: "opened", label: "Date Last Opened" },
  { column: "modified", label: "Date Modified" },
  { column: "created", label: "Date Created" },
  { column: "size", label: "Size" },
  { column: "tags", label: "Tags" },
];

export const NO_GROUP = "none";

/** The items of one section of a grouped folder, in the folder's order. */
export interface FinderGroup {
  label: string;
  entries: FinderEntry[];
}

const DAY = 24 * 60 * 60 * 1000;
const KB = 1000;
const MB = KB * 1000;
const GB = MB * 1000;

const SIZES: readonly (readonly [string, number])[] = [
  ["Larger than 1 GB", GB],
  ["100 MB to 1 GB", 100 * MB],
  ["1 MB to 100 MB", MB],
  ["100 KB to 1 MB", 100 * KB],
  ["Less than 100 KB", 0],
];

const NEAR_DATES = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days"];

const MONTHS = new Intl.DateTimeFormat("en-US", { month: "long" });

/** The section of a date, `YYYY-MM-DD HH:MM` local time: near ones by name, then months, then years. */
function dateGroup(stamp: string | undefined, now: Date): { label: string; rank: number } {
  const parts = stamp?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return { label: "Unknown", rank: Number.POSITIVE_INFINITY };
  const year = Number(parts[1]);
  const month = Number(parts[2]) - 1;
  const day = new Date(year, month, Number(parts[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - day.getTime()) / DAY);
  if (days <= 0) return { label: "Today", rank: 0 };
  if (days === 1) return { label: "Yesterday", rank: 1 };
  if (days <= 7) return { label: "Previous 7 Days", rank: 2 };
  if (days <= 30) return { label: "Previous 30 Days", rank: 3 };
  const back = NEAR_DATES.length + (now.getFullYear() - year) * 12 + now.getMonth() - month;
  return year === now.getFullYear()
    ? { label: MONTHS.format(day), rank: back }
    : { label: String(year), rank: 1000 + (now.getFullYear() - year) };
}

function groupOf(node: FinderNode, by: string, now: Date): { label: string; rank: number } {
  switch (by) {
    case "opened":
      return dateGroup(node.opened, now);
    case "modified":
      return dateGroup(node.modified, now);
    case "created":
      return dateGroup(node.created, now);
    case "kind":
      return { label: node.children ? "Folders" : kindText(node), rank: node.children ? 0 : 1 };
    case "size": {
      if (node.children || node.size === undefined) {
        return { label: "Folders", rank: SIZES.length };
      }
      const size = node.size;
      const rank = SIZES.findIndex(([, least]) => size >= least);
      return { label: SIZES[rank]?.[0] ?? "Less than 100 KB", rank };
    }
    case "tags":
      return { label: "No Tags", rank: 1 };
    default: {
      const first = node.name.trim().charAt(0).toLocaleUpperCase("en");
      return /\p{L}/u.test(first) ? { label: first, rank: 1 } : { label: "#", rank: 0 };
    }
  }
}

/** The section of each thing an item can be filed under: an item with two tags is in both. */
function groupsOf(node: FinderNode, by: string, now: Date): { label: string; rank: number }[] {
  if (by === "tags" && node.tags?.length) {
    return node.tags.map((tag) => ({ label: tag, rank: 0 }));
  }
  return [groupOf(node, by, now)];
}

/**
 * `entries` in sections, each keeping the order of `entries`. Sections go by rank, then by name:
 * the nearest dates and the largest sizes first. `by` is a column of `GROUPS`.
 */
export function groupEntries(
  entries: readonly FinderEntry[],
  by: string,
  now: Date = new Date(),
): FinderGroup[] {
  const sections = new Map<string, FinderGroup & { rank: number }>();
  for (const entry of entries) {
    for (const { label, rank } of groupsOf(entry.node, by, now)) {
      const section = sections.get(label);
      if (section) section.entries.push(entry);
      else sections.set(label, { label, rank, entries: [entry] });
    }
  }
  return [...sections.values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, "en"))
    .map(({ label, entries: inside }) => ({ label, entries: inside }));
}
