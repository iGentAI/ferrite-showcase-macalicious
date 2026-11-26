import type { ContactGroup } from "./contacts-data";

/** The most groups the desktop keeps for a person (the module's `MAX_GROUPS`). */
export const MAX_GROUPS = 100;

/** The most characters of a group's name (the module's `MAX_GROUP_NAME_CHARS`). */
export const MAX_GROUP_NAME = 100;

/** What a card's row carries while it is dragged: the ids of the cards, as JSON. */
export const CARDS_DRAG = "application/x-macalicious-contact-cards";

/** The name of a new group: `untitled group`, numbered when that is taken. */
export function nextGroupName(groups: readonly ContactGroup[]): string {
  const taken = new Set(groups.map((group) => group.name));
  if (!taken.has("untitled group")) return "untitled group";
  let number = 2;
  while (taken.has(`untitled group ${number}`)) number += 1;
  return `untitled group ${number}`;
}

/** The groups in the order of the sidebar: by name, whatever the case. */
export const sortGroups = (groups: readonly ContactGroup[]): ContactGroup[] =>
  [...groups].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

/** The groups with the cards `ids` added to the group `id`, each card once. */
export const addToGroup = (
  groups: readonly ContactGroup[],
  id: string,
  ids: readonly string[],
): readonly ContactGroup[] =>
  groups.map((group) =>
    group.id === id ? { ...group, members: [...new Set([...group.members, ...ids])] } : group,
  );

/** The groups with the cards `ids` taken out of the group `id`, or of every group without one. */
export const removeFromGroups = (
  groups: readonly ContactGroup[],
  ids: readonly string[],
  id?: string,
): readonly ContactGroup[] =>
  groups.map((group) =>
    id === undefined || group.id === id
      ? { ...group, members: group.members.filter((member) => !ids.includes(member)) }
      : group,
  );

/** The ids of cards a dragged row carries; anything else in the data is left out. */
export function draggedCards(data: string): readonly string[] {
  try {
    const ids: unknown = JSON.parse(data);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** The name of the file a group is exported as. */
export const groupFileName = (name: string) => `${name.replace(/[/\\:*?"<>|]/g, "-")}.vcf`;

/** What the window shows, View > Card Only or List and Card, as stored. */
export type ContactsLayout = "card" | "list";
export const CONTACTS_LAYOUT = "contacts.layout";
export const readContactsLayout = (stored: unknown): ContactsLayout | undefined =>
  stored === "card" || stored === "list" ? stored : undefined;

/** Whether View > Hide Groups was chosen, as stored. */
export const CONTACTS_GROUPS_HIDDEN = "contacts.groupsHidden";
