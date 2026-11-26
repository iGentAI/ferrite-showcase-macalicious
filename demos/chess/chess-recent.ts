/** A saved game Game > Open Recent can open again. */
export interface RecentFile {
  id: string;
  name: string;
}

export const MOST_RECENT = 10;

/** The list as the setting holds it; anything else in it is dropped. */
export function readRecentFiles(stored: unknown): readonly RecentFile[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.flatMap((each) =>
    typeof each?.id === "string" && typeof each?.name === "string"
      ? [{ id: each.id, name: each.name }]
      : [],
  );
}

/** The list with `file` first, once, holding at most `MOST_RECENT`. */
export function withRecentFile(list: readonly RecentFile[], file: RecentFile): RecentFile[] {
  const others = list.filter((each) => each.id !== file.id);
  return [{ id: file.id, name: file.name }, ...others].slice(0, MOST_RECENT);
}
