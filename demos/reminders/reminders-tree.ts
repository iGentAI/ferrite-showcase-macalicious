import type { Reminder, ReminderGroup, ReminderList } from "./reminders-data";

/*
 * The shapes of Reminders' two outlines, as plain functions over the arrays the document keeps: a
 * reminder's sub-reminders (`parentId`, one level) and the sidebar's groups of lists (`groupId`).
 * The arrays' order is the only order kept: a sub-reminder is drawn under its parent wherever it is
 * in the array, in the array's order among its siblings, and a group is drawn where its first list
 * is.
 */

/** A row of the reminders pane. */
export type ReminderRow =
  | { kind: "reminder"; reminder: Reminder; depth: 0 | 1; children: number; collapsed: boolean }
  | { kind: "day"; id: string; label: string };

/**
 * The rows of `reminders` as an outline: each parent's sub-reminders under it, unless collapsed. A
 * `parentId` that does not hold in these rows (`settleParents`) draws its reminder at the top level,
 * so that no reminder is lost to a cycle or to a sub-reminder under a sub-reminder.
 */
export function outlineRows(
  reminders: readonly Reminder[],
  collapsed: ReadonlySet<string>,
): ReminderRow[] {
  const settled = settleParents(reminders);
  const under = new Map<string, Reminder[]>();
  reminders.forEach((reminder, at) => {
    const parentId = settled[at]?.parentId;
    if (parentId) under.set(parentId, [...(under.get(parentId) ?? []), reminder]);
  });
  return reminders.flatMap((reminder, at): ReminderRow[] => {
    if (settled[at]?.parentId) return [];
    const children = under.get(reminder.id) ?? [];
    const closed = collapsed.has(reminder.id);
    return [
      { kind: "reminder", reminder, depth: 0, children: children.length, collapsed: closed },
      ...(closed
        ? []
        : children.map(
            (child): ReminderRow => ({
              kind: "reminder",
              reminder: child,
              depth: 1,
              children: 0,
              collapsed: false,
            }),
          )),
    ];
  });
}

const DAY = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const utcDay = (day: string) => new Date(`${day}T00:00:00Z`);
const nextDay = (day: string) => {
  const date = utcDay(day);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/** What the Scheduled list says over the reminders of `day`, on the day `today`. */
export function scheduledHeading(day: string, today: string): string {
  if (day < today) return "Past Due";
  if (day === today) return "Today";
  if (day === nextDay(today)) return "Tomorrow";
  return DAY.format(utcDay(day));
}

/**
 * The Scheduled list: past days under one heading, then a heading for each day to come, each
 * holding its reminders in the order given. One kept in view without a date (its date was taken
 * off while it showed) comes last, under No Date.
 */
export function scheduledRows(reminders: readonly Reminder[], today: string): ReminderRow[] {
  const sections = new Map<string, Reminder[]>();
  const keyOf = ({ due }: Reminder) => (due === undefined ? "~" : due < today ? "" : due);
  for (const reminder of reminders) {
    const key = keyOf(reminder);
    sections.set(key, [...(sections.get(key) ?? []), reminder]);
  }
  return [...sections.keys()].sort().flatMap((key): ReminderRow[] => [
    {
      kind: "day",
      id: `day:${key}`,
      label: key === "~" ? "No Date" : key === "" ? "Past Due" : scheduledHeading(key, today),
    },
    ...(sections.get(key) ?? []).map(
      (reminder): ReminderRow => ({
        kind: "reminder",
        reminder,
        depth: 0,
        children: 0,
        collapsed: false,
      }),
    ),
  ]);
}

/**
 * Indent the reminders `ids`: each goes under the row above it (`shown`, the rows' ids as they are
 * drawn), or under that row's parent when it is a sub-reminder. A reminder with sub-reminders takes
 * them along, since an outline has one level. One with no row of its list above it stays.
 */
export function indentReminders(
  reminders: readonly Reminder[],
  ids: readonly string[],
  shown: readonly string[],
): readonly Reminder[] {
  const byId = new Map(reminders.map((reminder) => [reminder.id, reminder]));
  const parents = new Map<string, string>();
  for (const id of shown) {
    if (!ids.includes(id)) continue;
    const reminder = byId.get(id);
    if (!reminder || reminder.parentId) continue;
    const above = shown.slice(0, shown.indexOf(id)).reverse();
    for (const other of above) {
      const row = byId.get(other);
      if (!row || row.listId !== reminder.listId) continue;
      const held = row.parentId ? (parents.get(row.parentId) ?? row.parentId) : undefined;
      const parent = parents.get(other) ?? held ?? (ids.includes(other) ? undefined : other);
      if (parent) parents.set(id, parent);
      break;
    }
  }
  if (parents.size === 0) return reminders;
  return reminders.map((reminder) => {
    const parent =
      parents.get(reminder.id) ?? (reminder.parentId ? parents.get(reminder.parentId) : undefined);
    return parent ? { ...reminder, parentId: parent } : reminder;
  });
}

/** Whether Indent would change anything for `ids`. */
export const canIndent = (
  reminders: readonly Reminder[],
  ids: readonly string[],
  shown: readonly string[],
) => indentReminders(reminders, ids, shown) !== reminders;

/**
 * Outdent the sub-reminders among `ids`: each becomes a reminder of its own, just after its old
 * parent and that parent's other sub-reminders.
 */
export function outdentReminders(
  reminders: readonly Reminder[],
  ids: readonly string[],
): readonly Reminder[] {
  const moving = reminders.filter((reminder) => ids.includes(reminder.id) && reminder.parentId);
  if (moving.length === 0) return reminders;
  let out = reminders.filter((reminder) => !moving.includes(reminder));
  for (const reminder of moving.toReversed()) {
    const at = out.findIndex((each) => each.id === reminder.parentId);
    const { parentId: _left, ...rest } = reminder;
    out = [...out.slice(0, at + 1), rest, ...out.slice(at + 1)];
  }
  return out;
}

/** Where a drop on a row puts what is dropped: over it, under it, or among its sub-reminders. */
export type DropPlace = "before" | "after" | "into";

/** The place of a drop at `offset` points into a row `height` points high. */
export const dropPlaceAt = (offset: number, height: number): DropPlace =>
  offset < height / 4 ? "before" : offset >= height - height / 4 ? "after" : "into";

/**
 * Reminders dropped on a row of a list in Manual order, or on no row (`target` undefined: last).
 * Beside a row, they take its level; into it, they become its sub-reminders (of its parent, when
 * it is one itself). What was under a dropped reminder stays with it, at the level an outline
 * allows. On a reminder being dragged, or on one of its own sub-reminders, nothing changes.
 */
export function dropReminders(
  reminders: readonly Reminder[],
  ids: readonly string[],
  target: string | undefined,
  place: DropPlace,
): readonly Reminder[] {
  const on = reminders.find((reminder) => reminder.id === target);
  if (target && (!on || ids.includes(target))) return reminders;
  // A row of another list, in another window: the drop is that list's to refuse.
  if (on && reminders.some(({ id, listId }) => ids.includes(id) && listId !== on.listId)) {
    return reminders;
  }
  if (on?.parentId && ids.includes(on.parentId)) return reminders;
  const parent = on ? (place === "into" ? (on.parentId ?? on.id) : on.parentId) : undefined;
  const placed = (reminder: Reminder): Reminder => {
    if (!parent) {
      // One under a parent that moves with it stays under it.
      if (ids.includes(reminder.id) && !(reminder.parentId && ids.includes(reminder.parentId))) {
        const { parentId: _left, ...rest } = reminder;
        return rest;
      }
      return reminder;
    }
    return ids.includes(reminder.id) || (reminder.parentId && ids.includes(reminder.parentId))
      ? { ...reminder, parentId: parent }
      : reminder;
  };
  const moving = reminders
    .filter((reminder) => ids.includes(reminder.id))
    .flatMap((top) => [
      top,
      ...reminders.filter((each) => each.parentId === top.id && !ids.includes(each.id)),
    ])
    .map(placed);
  const rest = reminders
    .filter(
      (reminder) =>
        !ids.includes(reminder.id) && !(reminder.parentId && ids.includes(reminder.parentId)),
    )
    .map(placed);
  const firstMoving = moving[0];
  if (!firstMoving) return reminders;
  let at: number;
  if (!on) at = rest.findLastIndex((each) => each.listId === firstMoving.listId) + 1;
  else if (place === "before") at = rest.findIndex((each) => each.id === on.id);
  else if (place === "after") at = rest.findIndex((each) => each.id === on.id) + 1;
  else at = rest.findLastIndex((each) => each.id === parent || each.parentId === parent) + 1;
  return [...rest.slice(0, at), ...moving, ...rest.slice(at)];
}

/**
 * Reminders moved to list `to`. A parent takes its sub-reminders along; a sub-reminder moved
 * without its parent becomes a reminder of its own there.
 */
export function moveToList(
  reminders: readonly Reminder[],
  ids: readonly string[],
  to: string,
): readonly Reminder[] {
  return reminders.map((reminder) => {
    const withParent = reminder.parentId !== undefined && ids.includes(reminder.parentId);
    if (!ids.includes(reminder.id) && !withParent) return reminder;
    if (withParent) return { ...reminder, listId: to };
    const { parentId: _left, ...rest } = reminder;
    return { ...rest, listId: to };
  });
}

/** The ids of `ids` and of every sub-reminder under them. */
export const withSubReminders = (reminders: readonly Reminder[], ids: readonly string[]) => [
  ...new Set([
    ...ids,
    ...reminders
      .filter((reminder) => reminder.parentId && ids.includes(reminder.parentId))
      .map((reminder) => reminder.id),
  ]),
];

/**
 * `reminders` with every `parentId` that no longer holds taken off: the parent gone, in another
 * list, or a sub-reminder itself. Documents can come to that when changes of two windows meet; a
 * reminder is never lost for it, and the same array is answered when all hold.
 */
export function settleParents<T extends Reminder>(reminders: readonly T[]): readonly T[] {
  const byId = new Map(reminders.map((reminder) => [reminder.id, reminder]));
  const holds = ({ id, listId, parentId }: Reminder) => {
    const parent = parentId === undefined ? undefined : byId.get(parentId);
    return parent !== undefined && parent.id !== id && parent.listId === listId && !parent.parentId;
  };
  if (reminders.every((reminder) => !reminder.parentId || holds(reminder))) return reminders;
  return reminders.map((reminder) => {
    if (!reminder.parentId || holds(reminder)) return reminder;
    const { parentId: _left, ...rest } = reminder;
    return rest as T;
  });
}

/** One entry of the sidebar's My Lists. */
export type SidebarEntry =
  | { kind: "list"; list: ReminderList }
  | { kind: "group"; group: ReminderGroup; lists: ReminderList[] };

/**
 * The sidebar's entries: a group where its first list is, and a group with no list before the list
 * it names (`before`), or last.
 */
export function sidebarEntries(
  lists: readonly ReminderList[],
  groups: readonly ReminderGroup[],
): SidebarEntry[] {
  const known = new Set(groups.map((group) => group.id));
  const filled = new Set(lists.flatMap((list) => (list.groupId ? [list.groupId] : [])));
  const empty = groups.filter((group) => !filled.has(group.id));
  const placed = new Set<string>();
  const entries: SidebarEntry[] = [];
  const emptyBefore = (list: ReminderList) => {
    for (const group of empty) {
      if (group.before === list.id && !placed.has(group.id)) {
        placed.add(group.id);
        entries.push({ kind: "group", group, lists: [] });
      }
    }
  };
  for (const list of lists) {
    const group = list.groupId && known.has(list.groupId) ? list.groupId : undefined;
    if (!group) {
      emptyBefore(list);
      entries.push({ kind: "list", list });
    } else if (!placed.has(group)) {
      emptyBefore(list);
      placed.add(group);
      entries.push({
        kind: "group",
        group: groups.find((each) => each.id === group) as ReminderGroup,
        lists: lists.filter((each) => each.groupId === group),
      });
    }
  }
  for (const group of empty) {
    if (!placed.has(group.id)) entries.push({ kind: "group", group, lists: [] });
  }
  return entries;
}

const withGroup = (list: ReminderList, groupId: string | undefined): ReminderList => {
  const { groupId: _left, ...rest } = list;
  return groupId ? { ...rest, groupId } : rest;
};

/**
 * List `id` dropped on another sidebar row, a list or a group by `target` (undefined: the blank
 * under the rows, the end of My Lists outside every group). Beside a row it takes that row's place
 * in or out of a group; into a group it becomes that group's last.
 */
export function dropList(
  lists: readonly ReminderList[],
  id: string,
  target: string | undefined,
  place: DropPlace,
  groups: readonly ReminderGroup[] = [],
): readonly ReminderList[] {
  const moving = lists.find((list) => list.id === id);
  if (!moving || target === id) return lists;
  const rest = lists.filter((list) => list !== moving);
  if (target === undefined) return [...rest, withGroup(moving, undefined)];
  const on = rest.find((list) => list.id === target);
  if (on) {
    const at = rest.indexOf(on) + (place === "before" ? 0 : 1);
    return [...rest.slice(0, at), withGroup(moving, on.groupId), ...rest.slice(at)];
  }
  const members = rest.filter((list) => list.groupId === target);
  // Where a group with no list stands: before the list it names, or last.
  const anchored = () => {
    // Its only list leaving it: the group stays where that list stood.
    if (moving.groupId === target && members.length === 0) return lists.indexOf(moving);
    const before = groups.find((group) => group.id === target)?.before;
    const at = rest.findIndex((list) => list.id === before);
    return at < 0 ? rest.length : at;
  };
  if (place === "into") {
    const last = members.at(-1);
    const at = last ? rest.indexOf(last) + 1 : anchored();
    return [...rest.slice(0, at), withGroup(moving, target), ...rest.slice(at)];
  }
  const edge = place === "before" ? members[0] : members.at(-1);
  const at = edge ? rest.indexOf(edge) + (place === "before" ? 0 : 1) : anchored();
  return [...rest.slice(0, at), withGroup(moving, undefined), ...rest.slice(at)];
}

/**
 * Group `id` dropped beside another sidebar row, or on the blank (`target` undefined: last). Its
 * lists go there together; with no list, it remembers which list it stands before.
 */
export function dropGroup(
  lists: readonly ReminderList[],
  groups: readonly ReminderGroup[],
  id: string,
  target: string | undefined,
  place: "before" | "after",
): { lists: readonly ReminderList[]; groups: readonly ReminderGroup[] } {
  const found = groups.find((each) => each.id === id);
  if (target === id || !found) return { lists, groups };
  const { before: _left, ...group } = found;
  const moving = lists.filter((list) => list.groupId === id);
  const others = groups.filter((each) => each.id !== id);
  const rest = lists.filter((list) => list.groupId !== id);
  const entries = sidebarEntries(rest, others);
  const entryIndex = entries.findIndex((entry) =>
    entry.kind === "list"
      ? entry.list.id === target
      : entry.group.id === target || entry.lists.some((list) => list.id === target),
  );
  const placedAt = entryIndex < 0 ? entries.length : entryIndex + (place === "before" ? 0 : 1);
  const next = entries[placedAt];
  // The list that stands next after the place, and an empty group in between, if there is one.
  const nextEmpty = next?.kind === "group" && next.lists.length === 0 ? next.group : undefined;
  const nextList =
    next?.kind === "list" ? next.list.id : next?.kind === "group" ? next.lists[0]?.id : undefined;
  const anchor = nextEmpty ? nextEmpty.before : nextList;
  const previous = entries[placedAt - 1];
  const groupAt = nextEmpty
    ? others.indexOf(nextEmpty)
    : previous?.kind === "group" && previous.lists.length === 0
      ? others.indexOf(previous.group) + 1
      : others.length;
  const kept = moving.length === 0 && anchor ? { ...group, before: anchor } : group;
  const at = rest.findIndex((list) => list.id === anchor);
  return {
    lists:
      moving.length === 0
        ? lists
        : [
            ...rest.slice(0, at < 0 ? rest.length : at),
            ...moving,
            ...rest.slice(at < 0 ? rest.length : at),
          ],
    groups: standBefore(
      [...others.slice(0, groupAt), kept, ...others.slice(groupAt)],
      lists,
      target,
      place,
      moving[0]?.id,
    ),
  };
}

/**
 * The groups once list `moved` went straight after `target`: a group with no list stands by the list
 * it names, so it now names that one, or the list would stand before it.
 */
export function standBefore(
  groups: readonly ReminderGroup[],
  lists: readonly ReminderList[],
  target: string | undefined,
  place: DropPlace,
  moved: string | undefined,
): readonly ReminderGroup[] {
  if (place !== "after" || !moved || lists.some((list) => list.groupId === target)) return groups;
  const at = groups.findIndex((group) => group.id === target);
  if (at < 0) return groups;
  // The empty groups standing with it, up to it, stay before the row too.
  const anchor = groups[at]?.before;
  return groups.map((group, index) =>
    index <= at && group.before === anchor && !lists.some((list) => list.groupId === group.id)
      ? { ...group, before: moved }
      : group,
  );
}

/** The first name of `base`, `base 2`, `base 3`... that `names` does not hold. */
export function freshName(base: string, names: Iterable<string>): string {
  const taken = new Set(names);
  let name = base;
  for (let number = 2; taken.has(name); number++) name = `${base} ${number}`;
  return name;
}

/** Every `groupId` naming a group that is gone taken off: the same array when all hold. */
export function settleGroups(
  lists: readonly ReminderList[],
  groups: readonly ReminderGroup[],
): readonly ReminderList[] {
  const known = new Set(groups.map((group) => group.id));
  if (lists.every((list) => !list.groupId || known.has(list.groupId))) return lists;
  return lists.map((list) =>
    list.groupId && !known.has(list.groupId) ? withGroup(list, undefined) : list,
  );
}
