/**
 * Which of an application's document windows are tabs of one another, as its desktop value holds it.
 * A tab is a window of the desktop with a document of its own, as any other is (a reload brings it
 * back, the Window menu lists it). The tabs of a group stand on one frame and only the selected one
 * shows. Every function returns the record as it should be next, or the same one when nothing changes.
 */

export interface TabGroup {
  ids: readonly string[];
  selected: string;
}

export interface TabsRecord {
  groups: readonly TabGroup[];
  /** Windows whose tab bar the person asked for, though they have one tab. */
  bars: readonly string[];
}

export const NO_TABS: TabsRecord = { groups: [], bars: [] };

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((each) => typeof each === "string");

/** The record as stored; groups that are not two tabs or more, or select none of theirs, are dropped. */
export function readTabs(stored: unknown): TabsRecord | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { groups, bars } = stored as { groups?: unknown; bars?: unknown };
  if (!Array.isArray(groups) || !isStrings(bars)) return undefined;
  return {
    groups: groups.filter(
      (group): group is TabGroup =>
        isStrings(group?.ids) && group.ids.length > 1 && group.ids.includes(group.selected),
    ),
    bars,
  };
}

export const groupOf = (record: TabsRecord, id: string) =>
  record.groups.find((group) => group.ids.includes(id));

const withGroup = (record: TabsRecord, was: TabGroup, next: TabGroup | null): TabsRecord => ({
  ...record,
  groups: record.groups.flatMap((group) => (group === was ? (next ? [next] : []) : [group])),
});

/** The group without `id`, whose neighbour is selected if `id` was. A last tab is a window again. */
export function leaveTabs(record: TabsRecord, id: string): TabsRecord {
  const bars = record.bars.includes(id) ? record.bars.filter((each) => each !== id) : record.bars;
  const group = groupOf(record, id);
  if (!group) return bars === record.bars ? record : { ...record, bars };
  const at = group.ids.indexOf(id);
  const ids = group.ids.filter((each) => each !== id);
  const selected =
    group.selected === id ? (ids[Math.min(at, ids.length - 1)] ?? "") : group.selected;
  return withGroup({ ...record, bars }, group, ids.length > 1 ? { ids, selected } : null);
}

/** Merge All Windows: the windows `ids` are one group, with `selected` in front. */
export function mergeTabs(
  record: TabsRecord,
  ids: readonly string[],
  selected: string,
): TabsRecord {
  if (ids.length < 2) return record;
  const others = record.groups.filter((group) => !group.ids.some((id) => ids.includes(id)));
  return { ...record, groups: [...others, { ids: [...ids], selected }] };
}

/** The window `id` is a new tab after `owner`, selected: `owner` becomes a group if it was none. */
export function joinTabs(record: TabsRecord, owner: string, id: string): TabsRecord {
  const group = groupOf(record, owner);
  if (!group) return mergeTabs(record, [owner, id], id);
  const ids = [...group.ids];
  ids.splice(ids.indexOf(owner) + 1, 0, id);
  return withGroup(record, group, { ids, selected: id });
}

export function selectTab(record: TabsRecord, id: string): TabsRecord {
  const group = groupOf(record, id);
  if (!group || group.selected === id) return record;
  return withGroup(record, group, { ...group, selected: id });
}

/** The tab `step` places from the selected one, going round. */
export function neighbourTab(group: TabGroup, step: 1 | -1): string {
  const count = group.ids.length;
  return group.ids[(group.ids.indexOf(group.selected) + step + count) % count] ?? group.selected;
}

/** Only the tabs among `live`, for what was left by windows gone without closing. */
export function pruneTabs(record: TabsRecord, live: ReadonlySet<string>): TabsRecord {
  let next = record;
  for (const id of new Set([...record.bars, ...record.groups.flatMap((group) => group.ids)])) {
    if (!live.has(id)) next = leaveTabs(next, id);
  }
  return next;
}
