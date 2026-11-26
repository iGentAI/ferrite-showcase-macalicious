import { useEffect, useState } from "react";
import {
  type Drive,
  type DriveEntry,
  homeFolders,
  inTrash,
  readFile,
  recentFiles,
  trashOf,
} from "../desktop/desktop-files";
import {
  createFileSystem,
  type FinderKind,
  type FinderNode,
  HOME,
  joinPath,
  resolve,
  TRASH,
} from "./finder-data";

/**
 * Finder on the person's drive (`demos/desktop/desktop-files.ts`): the drive as the tree the
 * Finder window shows. The home folder holds the drive's six folders and its Trash; the startup
 * disk keeps the Applications folder of the demo's own tree, the apps of the desktop. Nothing
 * the drive does not hold is shown: no other disks, no network, no iCloud Drive.
 */

/** The extensions that say what a file is when its media type does not. */
const EXTENSIONS: readonly [FinderKind, readonly string[]][] = [
  ["image", ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "svg", "tif", "tiff"]],
  ["pdf", ["pdf"]],
  ["book", ["epub", "ibooks"]],
  ["audio", ["mp3", "m4a", "aac", "wav", "aif", "aiff", "flac", "ogg", "opus"]],
  ["movie", ["mov", "mp4", "m4v", "webm", "mkv"]],
  ["document", ["txt", "md", "rtf", "html", "htm", "csv", "json", "xml", "js", "ts", "css"]],
];

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/** What a drive entry is, from its media type, else its extension. */
export function kindOf(entry: Pick<DriveEntry, "kind" | "name" | "type">): FinderKind {
  if (entry.kind === "folder") return "folder";
  const type = entry.type ?? "";
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  if (type === "application/epub+zip") return "book";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "movie";
  if (type.startsWith("text/") || type === "application/json") return "document";
  const extension = extensionOf(entry.name);
  return EXTENSIONS.find(([, list]) => list.includes(extension))?.[0] ?? "file";
}

/** The Kind text of a drive file: `PNG image`, `MP3 audio`, `Plain Text Document`. */
function kindLabelOf(entry: DriveEntry, kind: FinderKind): string | undefined {
  const extension = extensionOf(entry.name).toUpperCase();
  if (extension === "APP") return "Application";
  switch (kind) {
    case "image":
      return `${extension === "JPG" ? "JPEG" : extension || "Picture"} image`;
    case "audio":
      return extension ? `${extension} audio` : undefined;
    case "movie":
      return extension ? `${extension} movie` : undefined;
    case "document":
      return extension === "TXT" || extension === "" ? undefined : `${extension} document`;
    case "file":
      return extension ? `${extension} document` : undefined;
    default:
      return undefined;
  }
}

const pad = (value: number) => String(value).padStart(2, "0");

/** A time as the tree writes it: `YYYY-MM-DD HH:MM`, in the browser's own time zone. */
export function stampOf(ms: number | undefined): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined;
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * `nodes` with a name of their own in their folder, ignoring case. Finder addresses an item by
 * its path and acts on the drive entry whose id that path's node carries, so two items of one
 * name (two files called `Note.txt` trashed from two folders) must not share a path. While a
 * name is shared, every item that has it shows it with a suffix taken from its own entry id
 * (`Note 3f9a1c.txt`), so an item's path never moves to another item: when the others leave,
 * the paths of the ones that left resolve to nothing rather than to the one that stayed. Only
 * the window's name changes; the entry keeps its own, and every action goes to the entry by id.
 */
function distinctNames(nodes: FinderNode[]): FinderNode[] {
  const count = new Map<string, number>();
  for (const node of nodes) {
    const lower = node.name.toLowerCase();
    count.set(lower, (count.get(lower) ?? 0) + 1);
  }
  const taken = new Set(
    nodes.filter((node) => count.get(node.name.toLowerCase()) === 1).map((node) => node.name),
  );
  const lowerTaken = new Set([...taken].map((name) => name.toLowerCase()));
  return nodes.map((node) => {
    if (count.get(node.name.toLowerCase()) === 1 || !node.id) return node;
    const dot = node.kind === "folder" ? -1 : node.name.lastIndexOf(".");
    const [stem, extension] =
      dot > 0 ? [node.name.slice(0, dot), node.name.slice(dot)] : [node.name, ""];
    const short = `${stem} ${node.id.slice(0, 6)}${extension}`;
    const name = lowerTaken.has(short.toLowerCase()) ? `${stem} ${node.id}${extension}` : short;
    lowerTaken.add(name.toLowerCase());
    return { ...node, name };
  });
}

/** The tree node of a drive entry, with everything inside it. */
function nodeOf(
  entry: DriveEntry,
  children: ReadonlyMap<string, readonly DriveEntry[]>,
  rotations: Readonly<Record<string, number>>,
  depth = 0,
): FinderNode {
  const kind = kindOf(entry);
  const node: FinderNode = {
    id: entry.id,
    name: entry.name,
    kind,
    modified: stampOf(entry.modified_ms),
    created: stampOf(entry.created_ms),
    revision: entry.modified_ms,
  };
  if (entry.name.startsWith(".")) node.hidden = true;
  if (entry.kind === "folder") {
    // A folder chain deeper than any the drive allows is cut, never followed forever.
    node.children =
      depth > 64
        ? []
        : distinctNames(
            (children.get(entry.id) ?? []).map((child) =>
              nodeOf(child, children, rotations, depth + 1),
            ),
          );
  } else {
    node.size = entry.size;
    node.type = entry.type;
    const label = kindLabelOf(entry, kind);
    if (label) node.kindLabel = label;
  }
  if (entry.opened_ms !== undefined) node.opened = stampOf(entry.opened_ms);
  if (entry.tags?.length) node.tags = entry.tags;
  if (entry.comment) node.comment = entry.comment;
  if (entry.locked) node.locked = true;
  if (entry.hide_extension) node.hideExtension = true;
  if (entry.stationery) node.stationery = true;
  if (rotations[entry.id]) node.rotation = rotations[entry.id];
  return node;
}

/** The path of the entry in the tree `driveTree` makes, if it shows it. */
export function pathOfEntry(root: FinderNode, id: string): string | undefined {
  const walk = (node: FinderNode, path: string): string | undefined => {
    for (const child of node.children ?? []) {
      const at = joinPath(path, child.name);
      if (child.id === id) return at;
      const found = walk(child, at);
      if (found) return found;
    }
    return undefined;
  };
  return walk(root, "/");
}

/**
 * The apps the Ferrite desktop does not deploy (`ferrite-apps/desktop/not-deployed.json`), by
 * name. Finder shows the drive only on that desktop, so its Applications folder leaves them out.
 */
const NOT_DEPLOYED = new Set(["AirPort Utility", "Boot Camp Assistant", "Disk Utility"]);

const withoutNotDeployed = (node: FinderNode | undefined): FinderNode | undefined =>
  node?.children
    ? {
        ...node,
        children: node.children
          .filter((child) => !(child.kind === "application" && NOT_DEPLOYED.has(child.name)))
          .map((child) => (child.kind === "folder" ? (withoutNotDeployed(child) ?? child) : child)),
      }
    : node;

/**
 * The tree a Finder window shows for `drive`: the startup disk with the demo's Applications and
 * the home folder, which holds the drive's six folders and, hidden as on a Mac, its Trash.
 * Before the drive has loaded (`null`) the six folders are there, empty. `rotations` turns
 * pictures in the window only, by entry id.
 */
export function driveTree(
  drive: Drive | null,
  rotations: Readonly<Record<string, number>> = {},
  base: FinderNode = createFileSystem(),
): FinderNode {
  const children = new Map<string, DriveEntry[]>();
  for (const entry of drive?.entries ?? []) {
    if (!entry.parent || entry.trashed_ms !== undefined) continue;
    const list = children.get(entry.parent) ?? [];
    list.push(entry);
    children.set(entry.parent, list);
  }
  const folders: FinderNode[] = drive
    ? homeFolders(drive).map((entry) => nodeOf(entry, children, rotations))
    : ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"].map((name) => ({
        name,
        kind: "folder" as const,
        children: [],
      }));
  const trash: FinderNode = {
    name: ".Trash",
    kind: "folder",
    hidden: true,
    children: drive
      ? distinctNames(trashOf(drive).map((entry) => nodeOf(entry, children, rotations)))
      : [],
  };
  const applications = withoutNotDeployed(resolve(base, "/Applications"));
  const homeName = HOME.split("/").at(-1) ?? "Home";
  const root: FinderNode = {
    name: base.name,
    kind: "volume",
    children: [
      ...(applications ? [applications] : []),
      {
        name: "Users",
        kind: "folder",
        children: [{ name: homeName, kind: "folder", children: [...folders, trash] }],
      },
    ],
  };
  if (drive) {
    root.available = Math.max(drive.quota - drive.usage, 0);
    root.recents = recentFiles(drive).flatMap((entry) =>
      inTrash(drive, entry.id) ? [] : (pathOfEntry(root, entry.id) ?? []),
    );
  }
  return root;
}

/** Whether the tree's Trash is where the item at `path` is. */
export const isInTrash = (path: string) => path === TRASH || path.startsWith(`${TRASH}/`);

/** A drive file as Quick Look shows it: its address in the page, and its text for a text file. */
export interface DriveFileView {
  url: string;
  type: string;
  /** The start of a text file, at most `TEXT_PREVIEW_BYTES`. */
  text?: string;
}

/** The most of a text file Quick Look shows. */
const TEXT_PREVIEW_BYTES = 64 * 1024;

/**
 * Reads the drive file `id` while `enabled`, for Quick Look: `null` while it loads, an `Error`
 * when it could not be read. `version` is the file's modification time: a file replaced under
 * the same id is read again. Each load starts from `null`, and the address it made is let go
 * when the file changes or the panel closes, so a revoked address is never handed out.
 */
export function useDriveFile(
  id: string | undefined,
  kind: FinderKind | undefined,
  enabled: boolean,
  version?: string,
): DriveFileView | Error | null {
  const [view, setView] = useState<{ key: string; value: DriveFileView | Error } | null>(null);
  const key = `${id}\n${version ?? ""}`;
  useEffect(() => {
    setView(null);
    if (!enabled || !id) return;
    const controller = new AbortController();
    let url: string | null = null;
    void (async () => {
      try {
        const blob = await readFile(id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        const value: DriveFileView = { url, type: blob.type };
        if (kind === "document") {
          value.text = await blob.slice(0, TEXT_PREVIEW_BYTES).text();
        }
        if (!controller.signal.aborted) setView({ key, value });
      } catch (error) {
        if (!controller.signal.aborted) {
          setView({ key, value: error instanceof Error ? error : new Error(String(error)) });
        }
      }
    })();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
      setView(null);
    };
  }, [id, kind, enabled, key]);
  return enabled && id && view?.key === key ? view.value : null;
}
