/**
 * Launchpad's folders: kept with the person's settings. A folder stands where its first application
 * does in Launchpad's order, so the order the server keeps stays a plain list of applications.
 */

export const LAUNCHPAD_FOLDERS = "launchpad.folders";

/** The drag's data type of an application dragged out of Launchpad: the Dock takes it. */
export const LAUNCHPAD_APP_DRAG = "application/x-macalicious-launchpad-app";

export interface LaunchpadFolderRecord {
  id: string;
  name: string;
  /** Its applications, in order. */
  apps: readonly string[];
}

export const NO_FOLDERS: readonly LaunchpadFolderRecord[] = Object.freeze([]);

const isFolder = (value: unknown): value is LaunchpadFolderRecord => {
  const folder = value as Partial<LaunchpadFolderRecord> | null;
  return (
    typeof folder?.id === "string" &&
    typeof folder.name === "string" &&
    Array.isArray(folder.apps) &&
    folder.apps.every((app) => typeof app === "string")
  );
};

export const readFolders = (stored: unknown): readonly LaunchpadFolderRecord[] | undefined =>
  Array.isArray(stored) ? stored.filter(isFolder) : undefined;

export type LaunchpadEntry<App> =
  | { kind: "app"; app: App }
  | { kind: "folder"; folder: LaunchpadFolderRecord; apps: readonly App[] };

/**
 * What Launchpad's grid shows for its applications in their order. An application the person no longer
 * has goes from its folder, and a folder left with one stands aside for that application.
 */
export function launchpadEntries<App extends { id: string }>(
  apps: readonly App[],
  folders: readonly LaunchpadFolderRecord[],
): LaunchpadEntry<App>[] {
  const byId = new Map(apps.map((app) => [app.id, app]));
  const shown = folders
    .map((folder) => ({
      folder,
      apps: folder.apps.flatMap((id) => byId.get(id) ?? []),
    }))
    .filter((each) => each.apps.length > 1);
  const folderOf = new Map(
    shown.flatMap((each) => each.apps.map((app) => [app.id, each] as const)),
  );
  return apps.flatMap((app): LaunchpadEntry<App>[] => {
    const holder = folderOf.get(app.id);
    if (!holder) return [{ kind: "app", app }];
    return holder.apps[0] === app ? [{ kind: "folder", ...holder }] : [];
  });
}

const withoutApp = (folders: readonly LaunchpadFolderRecord[], app: string) =>
  folders
    .map((folder) => ({ ...folder, apps: folder.apps.filter((each) => each !== app) }))
    .filter((folder) => folder.apps.length > 1);

/** `dropped` let go on `onto`: a folder of the two, named `name`, where `onto` stands. */
export function withNewFolder(
  folders: readonly LaunchpadFolderRecord[],
  dropped: string,
  onto: string,
  name: string,
): readonly LaunchpadFolderRecord[] {
  const rest = withoutApp(withoutApp(folders, dropped), onto);
  let number = rest.length + 1;
  while (rest.some(({ id }) => id === `folder-${number}`)) number += 1;
  return [...rest, { id: `folder-${number}`, name, apps: [onto, dropped] }];
}

/** An application put in a folder, after the others. */
export function withAppInFolder(
  folders: readonly LaunchpadFolderRecord[],
  app: string,
  folder: string,
): readonly LaunchpadFolderRecord[] {
  const holder = folders.find(({ id }) => id === folder);
  if (!holder || holder.apps.includes(app)) return folders;
  const rest = withoutApp(
    folders.filter(({ id }) => id !== folder),
    app,
  );
  return [...rest, { ...holder, apps: [...holder.apps, app] }];
}

/** An application dragged out of its folder; a folder left with one is gone. */
export const withAppOutOfFolder = withoutApp;

export const withFolderNamed = (
  folders: readonly LaunchpadFolderRecord[],
  folder: string,
  name: string,
): readonly LaunchpadFolderRecord[] =>
  folders.map((each) => (each.id === folder ? { ...each, name } : each));

/** The name a new folder takes: what its two applications share, as on a Mac, or Untitled. */
export function folderNameFor(a: string | undefined, b: string | undefined): string {
  if (!a || a !== b) return "Untitled";
  return `${a.slice(0, 1).toUpperCase()}${a.slice(1)}`;
}
