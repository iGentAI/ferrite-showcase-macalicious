/**
 * Calendar groups, as File > New Calendar Group makes them: a name in the sidebar holding some of the
 * person's own calendars, which its checkbox shows or hides together. Kept with the person's settings
 * (`desktop-personal.ts`), since a group changes nothing about the calendars or their events.
 */
export interface CalendarGroup {
  id: string;
  name: string;
  /** The ids of its calendars; a calendar is in one group at most. */
  calendars: readonly string[];
  /** The sidebar shows its name alone. */
  closed?: boolean;
}

export const CALENDAR_GROUPS = "calendar.groups";
export const NO_CALENDAR_GROUPS: readonly CalendarGroup[] = [];

const isGroup = (value: unknown): value is CalendarGroup => {
  const group = value as Partial<CalendarGroup> | null;
  return (
    typeof group === "object" &&
    group !== null &&
    typeof group.id === "string" &&
    typeof group.name === "string" &&
    Array.isArray(group.calendars) &&
    group.calendars.every((id) => typeof id === "string") &&
    (group.closed === undefined || typeof group.closed === "boolean")
  );
};

/** The groups as kept, or none when what is kept is not a list of groups. */
export const readCalendarGroups = (stored: unknown): readonly CalendarGroup[] =>
  Array.isArray(stored) && stored.every(isGroup) ? stored : NO_CALENDAR_GROUPS;

/** `groups` with `calendar` in the group `into`, or in none when that is null. */
export function moveCalendarToGroup(
  groups: readonly CalendarGroup[],
  calendar: string,
  into: string | null,
): readonly CalendarGroup[] {
  return groups.map((group) => {
    const others = group.calendars.filter((id) => id !== calendar);
    return group.id === into
      ? { ...group, calendars: [...others, calendar], closed: undefined }
      : { ...group, calendars: others };
  });
}

/** `own` with the calendar `dragged` before the calendar `before`, or as it was. */
export function moveCalendarBefore<Calendar extends { id: string }>(
  own: readonly Calendar[],
  dragged: string,
  before: string,
): readonly Calendar[] {
  const moving = own.find((item) => item.id === dragged);
  if (!moving || dragged === before || !own.some((item) => item.id === before)) return own;
  return own.flatMap((item) => {
    if (item.id === dragged) return [];
    return item.id === before ? [moving, item] : [item];
  });
}

/** A group whose calendars are shown: all, none, or some of them. */
export function groupShown(
  group: CalendarGroup,
  hidden: readonly string[],
): "all" | "none" | "some" {
  const shown = group.calendars.filter((id) => !hidden.includes(id)).length;
  if (shown === 0) return "none";
  return shown === group.calendars.length ? "all" : "some";
}
