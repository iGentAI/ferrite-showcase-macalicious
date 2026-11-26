import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { runOps } from "../desktop/desktop-files";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { reloadServerDocuments, servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import { requestOpenFile, showInFinder } from "../finder/finder-open";
import { FINDER_TRASH_AFTER_30 } from "../finder/finder-saved";
import { StorageManagement, type StorageManagementProps } from "./storage-management";
import {
  defaultSort,
  formatSize,
  RECOMMENDATIONS_ID,
  type StorageCategory,
  type StorageFile,
  type StorageRecommendation,
  type StorageRecommendationId,
  type StorageSort,
} from "./storage-management-data";

/**
 * What the signed-in person keeps on the `macalicious-desktop` Ferrite application, as its
 * Storage Management module reports it (`ferrite-apps/desktop/src/apps/storage_management`): the
 * files of their drive against its quota, and what each app keeps for them.
 */
export const STORAGE_USAGE_URL = "/api/storage-management/usage";

/** A whole document a module keeps for the person and can forget. */
export interface SessionDocument {
  key: string;
  name: string;
  bytes: number;
  rev: number;
  /** The path of the module's own route that forgets it, with `DELETE`. */
  forget: string;
}

/** What one module keeps for the person. */
export interface SessionAppUsage {
  name: string;
  title: string;
  bytes: number;
  keys: number;
  /** The server stopped counting at its limit: the figures are a floor. */
  truncated: boolean;
  documents: readonly SessionDocument[];
}

/** One kind of file of the drive and what it takes of the quota. */
export interface DriveCategory {
  id: string;
  name: string;
  bytes: number;
  files: number;
}

/** One file of the drive. */
export interface DriveFile {
  id: string;
  name: string;
  size: number;
  type: string;
  /** The id of its `DriveCategory` (`trash` for one in the Trash). */
  kind: string;
  folder: string;
  modifiedMs: number;
  openedMs?: number;
  trashed: boolean;
}

/** The drive as the module reports it. */
export interface DriveUsage {
  quota: number;
  used: number;
  /** Bytes the drive is still deleting. */
  freeing: number;
  available: number;
  categories: readonly DriveCategory[];
  trash: { bytes: number; items: number };
  /** Every file, largest first; `filesTruncated` says there were more than the server lists. */
  files: readonly DriveFile[];
  filesTruncated: boolean;
}

/** The module's reply. */
export interface SessionUsage {
  apps: readonly SessionAppUsage[];
  bytes: number;
  keys: number;
  truncated: boolean;
  /** Absent from a server that does not report the drive. */
  drive?: DriveUsage;
}

const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A document of a reply, or `undefined` when it is not one. Its route must be one of its own
 * module's (`/api/<module>/<key>`): the window sends `DELETE` to nothing else.
 */
function documentFrom(app: string, value: unknown): SessionDocument | undefined {
  if (
    !isRecord(value) ||
    typeof value.key !== "string" ||
    typeof value.name !== "string" ||
    !count(value.bytes) ||
    !count(value.rev) ||
    value.forget !== `/api/${app}/${value.key}` ||
    !/^[a-z0-9-]+$/.test(value.key)
  )
    return undefined;
  return {
    key: value.key,
    name: value.name,
    bytes: value.bytes,
    rev: value.rev,
    forget: value.forget,
  };
}

/** The drive of a reply, or `undefined` when it holds none in the module's shape. */
export function driveFromServer(value: unknown): DriveUsage | undefined {
  if (
    !isRecord(value) ||
    !count(value.quota) ||
    !count(value.used) ||
    !count(value.available) ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.files) ||
    !isRecord(value.trash)
  )
    return undefined;
  const categories: DriveCategory[] = [];
  for (const category of value.categories) {
    if (
      !isRecord(category) ||
      typeof category.id !== "string" ||
      typeof category.name !== "string" ||
      !count(category.bytes) ||
      !count(category.files)
    )
      return undefined;
    categories.push({
      id: category.id,
      name: category.name,
      bytes: category.bytes,
      files: category.files,
    });
  }
  const files: DriveFile[] = value.files.flatMap((file) =>
    isRecord(file) &&
    typeof file.id === "string" &&
    typeof file.name === "string" &&
    count(file.size) &&
    typeof file.kind === "string"
      ? [
          {
            id: file.id,
            name: file.name,
            size: file.size,
            type: typeof file.type === "string" ? file.type : "",
            kind: file.kind,
            folder: typeof file.folder === "string" ? file.folder : "",
            modifiedMs: count(file.modified_ms) ? file.modified_ms : 0,
            openedMs: count(file.opened_ms) ? file.opened_ms : undefined,
            trashed: file.trashed === true,
          },
        ]
      : [],
  );
  return {
    quota: value.quota,
    used: value.used,
    freeing: count(value.freeing) ? value.freeing : 0,
    available: value.available,
    categories,
    trash: {
      bytes: count(value.trash.bytes) ? value.trash.bytes : 0,
      items: count(value.trash.items) ? value.trash.items : 0,
    },
    files,
    filesTruncated: value.files_truncated === true,
  };
}

/** The usage of a reply, or `undefined` when it is not the module's. */
export function usageFromServer(reply: unknown): SessionUsage | undefined {
  if (!isRecord(reply) || !Array.isArray(reply.apps) || !count(reply.bytes) || !count(reply.keys))
    return undefined;
  const apps: SessionAppUsage[] = [];
  for (const app of reply.apps) {
    if (
      !isRecord(app) ||
      typeof app.name !== "string" ||
      !/^[a-z0-9-]+$/.test(app.name) ||
      typeof app.title !== "string" ||
      !count(app.bytes) ||
      !count(app.keys) ||
      !Array.isArray(app.documents)
    )
      return undefined;
    const documents = app.documents.map((entry) => documentFrom(app.name as string, entry));
    if (documents.some((entry) => entry === undefined)) return undefined;
    apps.push({
      name: app.name,
      title: app.title,
      bytes: app.bytes,
      keys: app.keys,
      truncated: app.truncated === true,
      documents: documents as SessionDocument[],
    });
  }
  return {
    apps,
    bytes: reply.bytes,
    keys: reply.keys,
    truncated: reply.truncated === true || apps.some((app) => app.truncated),
    drive: driveFromServer(reply.drive),
  };
}

/** The id of the App Data category. */
export const APP_DATA_ID = "app-data";
/** The id of the Large Files category. */
export const LARGE_FILES_ID = "large-files";
/** The id of the Downloads category. */
export const DOWNLOADS_ID = "downloads";
/** The id of the Applications category. */
export const APPLICATIONS_ID = "applications";
/** The id of the File Browser category. */
export const FILE_BROWSER_ID = "file-browser";
/** The id of the Unsupported Apps category. */
export const UNSUPPORTED_APPS_ID = "unsupported-apps";
/** The start of the id of one app's row. */
const APP_ROW = "kept-by:";
/** The row and the order the window keeps for the person. */
const ROW_KEY = "storage.row";
const SORT_KEY = "storage.sort";
const readRow = (stored: unknown) => (typeof stored === "string" ? stored : undefined);
const readSort = (stored: unknown): StorageSort | undefined => {
  if (!isRecord(stored) || typeof stored.column !== "string") return undefined;
  return stored.direction === "ascending" || stored.direction === "descending"
    ? { column: stored.column, direction: stored.direction }
    : undefined;
};
const readOn = (stored: unknown) => (typeof stored === "boolean" ? stored : undefined);
/** A file this large or larger is listed in Large Files. */
export const LARGE_FILE_BYTES = 5_000_000;

/** A drive file as a file of the window. */
const driveFileId = (file: DriveFile) => `drive:${file.id}`;
/** A document as a file of the window. Its revision is in its id, so that a document saved again
 * after it was forgotten is a new file to the window. */
const documentId = (app: string, document: SessionDocument) =>
  `${app}/${document.key}@${document.rev}`;

/** A day of the calendar, or "" for none or for a time a `Date` cannot hold (past ±8.64e15 ms). */
const day = (ms: number) => {
  const date = new Date(ms);
  return ms > 0 && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
};

const KIND_NAMES: Readonly<Record<string, string>> = {
  documents: "Document",
  photos: "Picture",
  music: "Audio",
  movies: "Movie",
  other: "File",
  trash: "In the Trash",
};

function asFile(file: DriveFile): StorageFile {
  return {
    id: driveFileId(file),
    name: file.folder ? `${file.name} — ${file.folder}` : file.name,
    kind: KIND_NAMES[file.kind] ?? "File",
    lastAccessed: day(file.openedMs ?? file.modifiedMs),
    size: file.size,
  };
}

const DRIVE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  documents: "Documents in your Ferrite drive. Delete… erases one for good.",
  photos: "Pictures in your Ferrite drive, the originals of your Photos library among them.",
  music: "Songs and recordings in your Ferrite drive.",
  movies: "Movies in your Ferrite drive.",
  other: "Other files in your Ferrite drive.",
  trash: "Items in the Trash still count against your drive’s quota until they are erased.",
};

/** What the window shows of the usage, in its own props. */
export function usageProps(
  usage: SessionUsage | undefined,
  failed: boolean,
  trashAfter30 = false,
): Pick<
  StorageManagementProps,
  "categories" | "title" | "recommendations" | "capacity" | "available" | "diskName"
> {
  const drive = usage?.drive;
  const categories: StorageCategory[] = [];
  for (const category of drive?.categories ?? []) {
    if (category.bytes === 0 && category.files === 0 && category.id !== "trash") continue;
    categories.push({
      id: category.id,
      name: category.name,
      size: category.bytes,
      // The drive counts shared content once: copies list their full size but take none.
      exactSize: true,
      description: `${DRIVE_DESCRIPTIONS[category.id] ?? ""}${
        drive?.filesTruncated
          ? ` Only the ${drive.files.length} largest files of the drive are listed.`
          : ""
      }`.trim(),
      files: (drive?.files ?? []).filter((file) => file.kind === category.id).map(asFile),
    });
  }
  const large = (drive?.files ?? []).filter(
    (file) => file.size >= LARGE_FILE_BYTES && !file.trashed,
  );
  // Their sizes as files: copies that share one content count it once against the quota.
  const largeSize = large.reduce((sum, file) => sum + file.size, 0);
  if (large.length > 0) {
    categories.push({
      id: LARGE_FILES_ID,
      name: "Large Files",
      size: largeSize,
      // The drive's categories already count these files.
      onDisk: false,
      description: `Files of ${formatSize(LARGE_FILE_BYTES)} or more in your Ferrite drive, largest first.`,
      files: large.map(asFile),
    });
  }
  const downloads = (drive?.files ?? []).filter(
    (file) => file.folder === "Downloads" && !file.trashed,
  );
  if (downloads.length > 0) {
    categories.push({
      id: DOWNLOADS_ID,
      name: "Downloads",
      size: downloads.reduce((sum, file) => sum + file.size, 0),
      onDisk: false,
      description: "Files directly in the Downloads folder of your Ferrite drive.",
      files: downloads.map(asFile),
    });
  }
  const present = (drive?.files ?? []).filter((file) => !file.trashed);
  if (present.length > 0) {
    categories.push({
      id: FILE_BROWSER_ID,
      name: "File Browser",
      size: present.reduce((sum, file) => sum + file.size, 0),
      onDisk: false,
      description: `Every file of your Ferrite drive, each with its folder. Show in Finder goes to it.${
        drive?.filesTruncated ? ` Only the ${present.length} largest are listed.` : ""
      }`,
      files: present.map(asFile),
    });
  }
  const apps = [...(usage?.apps ?? [])].filter((app) => app.bytes > 0);
  const appBytes = apps.reduce((sum, app) => sum + app.bytes, 0);
  if (usage && appBytes > 0) {
    categories.push({
      id: APP_DATA_ID,
      name: "App Data",
      size: appBytes,
      // Kept by the apps on the server, outside the drive's quota.
      onDisk: false,
      description: `Documents the desktop’s apps keep for you on the server and can forget${
        usage.truncated ? " (at least)" : ""
      }. App data does not count against the drive’s quota.`,
      files: apps.flatMap((app) =>
        app.documents.map(
          (document): StorageFile => ({
            id: documentId(app.name, document),
            name: document.name,
            kind: app.title,
            // The store keeps no access time.
            lastAccessed: "",
            size: document.bytes,
          }),
        ),
      ),
    });
    categories.push({
      id: APPLICATIONS_ID,
      name: "Applications",
      size: appBytes,
      onDisk: false,
      readOnly: true,
      description:
        "What each app keeps for you on the server. The desktop’s apps come with the site, so none of them can be removed; what an app can forget is in App Data.",
      files: apps
        .sort((a, b) => b.bytes - a.bytes)
        .map(
          (app): StorageFile => ({
            id: `app:${app.name}`,
            name: app.title,
            kind: "Application",
            lastAccessed: "",
            size: app.bytes,
          }),
        ),
    });
    for (const app of apps) {
      const forgettable = app.documents.reduce((sum, entry) => sum + entry.bytes, 0);
      const rest = app.bytes - forgettable;
      categories.push({
        id: `${APP_ROW}${app.name}`,
        name: `Kept by ${app.title}`,
        size: app.bytes,
        onDisk: false,
        readOnly: app.documents.length === 0,
        description:
          app.documents.length === 0
            ? `What ${app.title} keeps for you on the server, counted here. It is changed in ${app.title} itself, which is still showing it.`
            : `Documents ${app.title} can forget. Delete… forgets one.${
                rest > 0
                  ? ` It keeps ${formatSize(rest)} more that is changed in ${app.title} itself.`
                  : ""
              }`,
        files:
          app.documents.length === 0
            ? [
                {
                  id: `${APP_ROW}${app.name}`,
                  name: `Everything ${app.title} keeps`,
                  kind: `${app.keys} ${app.keys === 1 ? "item" : "items"}${app.truncated ? " or more" : ""}`,
                  lastAccessed: "",
                  size: app.bytes,
                },
              ]
            : app.documents.map(
                (document): StorageFile => ({
                  id: documentId(app.name, document),
                  name: document.name,
                  kind: app.title,
                  lastAccessed: "",
                  size: document.bytes,
                }),
              ),
      });
    }
  }
  if (usage) {
    categories.push({
      id: UNSUPPORTED_APPS_ID,
      name: "Unsupported Apps",
      size: 0,
      onDisk: false,
      selectable: false,
      description: "A browser runs no Mac applications, so none can be unsupported here.",
    });
  }

  const title = drive
    ? undefined
    : usage
      ? `Your Server Data - ${usage.truncated ? "at least " : ""}${formatSize(usage.bytes)}`
      : failed
        ? "Ferrite Drive - not available"
        : "Ferrite Drive - reading…";
  const biggest = categories
    .filter(
      (category) =>
        category.id !== "trash" &&
        category.id !== LARGE_FILES_ID &&
        category.id !== DOWNLOADS_ID &&
        category.id !== APPLICATIONS_ID &&
        category.id !== FILE_BROWSER_ID &&
        !category.id.startsWith(APP_ROW) &&
        (category.files?.length ?? 0) > 0,
    )
    .sort((a, b) => b.size - a.size)[0];
  const recommendations: StorageRecommendation[] = [
    {
      id: "icloud",
      title: "Store in iCloud",
      description:
        "This desktop has no iCloud. Your files stay on your Ferrite drive, against its quota.",
    },
    {
      id: "optimize",
      title: "Optimize Storage",
      description:
        "Nothing here downloads movies or TV shows to your drive, so there are none to remove once watched.",
    },
    {
      id: "auto-trash",
      title: "Empty Trash Automatically",
      description: trashAfter30
        ? "On: Finder erases what has been in the Trash for more than 30 days whenever it reads your drive."
        : "Erase items that have been in the Trash for more than 30 days, whenever Finder reads your drive.",
      action: trashAfter30 ? "Turn Off" : "Turn On…",
      stays: true,
    },
  ];
  if (drive && drive.trash.items > 0) {
    recommendations.push({
      id: "trash",
      title: "Empty Trash",
      description: `Erase the ${drive.trash.items} ${
        drive.trash.items === 1 ? "item" : "items"
      } in the Trash now and give ${formatSize(drive.trash.bytes)} back to your drive.`,
      action: "Empty Trash",
    });
  }
  if (large.length > 0) {
    recommendations.push({
      id: "large",
      title: "Review Large Files",
      description: `${large.length} ${large.length === 1 ? "file of" : "files of"} ${formatSize(
        LARGE_FILE_BYTES,
      )} or more ${large.length === 1 ? "is" : "are"} in your drive, ${formatSize(largeSize)} as files (copies of one file take its space once). Delete those you no longer need.`,
      action: "Review Files",
      reviews: LARGE_FILES_ID,
    });
  }
  recommendations.push({
    id: "clutter",
    title: "Reduce Clutter",
    description:
      "Sort through the files of your Ferrite drive and the documents the desktop’s apps keep for you, and delete what you no longer need.",
    action: "Review Files",
    reviews: biggest?.id ?? RECOMMENDATIONS_ID,
  });
  return {
    categories,
    title,
    diskName: "Ferrite Drive",
    capacity: drive?.quota ?? 0,
    available: drive?.available ?? 0,
    recommendations,
  };
}

/** Reads the usage when the window opens and whenever `reload` is called. */
export function useSessionUsage(url: string = STORAGE_USAGE_URL) {
  const [usage, setUsage] = useState<SessionUsage>();
  const [failed, setFailed] = useState(false);
  const [reads, setReads] = useState(0);
  useEffect(() => {
    // `reads` counts the reads asked for: each one runs this again.
    void reads;
    let live = true;
    sessionFetch(url, { credentials: "same-origin", headers: { accept: "application/json" } })
      .then(async (response) => (response.ok ? usageFromServer(await response.json()) : undefined))
      .catch(() => undefined)
      .then((read) => {
        if (!live) return;
        if (read) {
          setUsage(read);
          setFailed(false);
        } else setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [url, reads]);
  const reload = useCallback(() => setReads((n) => n + 1), []);
  return { usage, failed, reload };
}

/** What the person is asked to confirm first: erasing files or documents, or the Trash, or the rule. */
type Erasure = { files: readonly StorageFile[]; categoryId: string } | "trash" | "auto-trash";

function ServedStorageManagement({
  onDelete,
  onDeleteSelection,
  onRecommendation,
  selectedId,
  onSelectedIdChange,
  ...props
}: StorageManagementProps) {
  const { usage, failed, reload } = useSessionUsage();
  // A new key rebuilds the window, which brings back a file whose deletion failed or was not
  // confirmed.
  const [generation, setGeneration] = useState(0);
  const [asked, setAsked] = useState<Erasure | null>(null);
  // The row shown, kept across that rebuild and for the next visit.
  const [row, setRow] = useDesktopSetting<string>(ROW_KEY, readRow, RECOMMENDATIONS_ID);
  const [sort, setSort] = useDesktopSetting<StorageSort>(SORT_KEY, readSort, defaultSort);
  const [trashAfter30, setTrashAfter30] = useDesktopSetting<boolean>(
    FINDER_TRASH_AFTER_30,
    readOn,
    false,
  );
  // Set by the confirming button, which runs before the question closes.
  const confirmed = useRef(false);
  const failedTo = (what: string) => (error: unknown) => {
    console.warn(`Storage Management could not ${what}:`, error);
    setGeneration((n) => n + 1);
  };
  const erase = (erasure: Erasure) => {
    if (erasure === "auto-trash") {
      setTrashAfter30(true);
      onRecommendation?.("auto-trash");
    } else if (erasure === "trash") {
      onRecommendation?.("trash");
      runOps([{ op: "empty-trash" }])
        .catch(failedTo("empty the Trash"))
        .finally(reload);
    } else forget(erasure.files, erasure.categoryId);
  };
  const forget = (files: readonly StorageFile[], categoryId: string) => {
    if (onDeleteSelection) onDeleteSelection(files, categoryId);
    else for (const file of files) onDelete?.(file, categoryId);
    const onDrive = files
      .filter((file) => file.id.startsWith("drive:"))
      .map((file) => file.id.slice("drive:".length));
    if (onDrive.length > 0) {
      runOps(onDrive.map((id) => ({ op: "delete" as const, id })))
        .catch(failedTo(`delete ${onDrive.length} files`))
        .finally(reload);
    }
    const held = usage?.apps.flatMap((app) =>
      app.documents.map((entry) => ({ app: app.name, entry })),
    );
    for (const file of files) {
      const found = held?.find(({ app, entry }) => documentId(app, entry) === file.id);
      if (!found) continue;
      const { app, entry: document } = found;
      sessionFetch(document.forget, { method: "DELETE", credentials: "same-origin" })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          // A window of the app still shows what was forgotten until it reads it again.
          reloadServerDocuments(app);
        })
        .catch(failedTo(`forget ${document.forget}`))
        .finally(reload);
    }
  };
  // What another window changed (a file trashed in Finder, say) shows when this one comes forward.
  const isKey = props.state === "key";
  useEffect(() => {
    if (isKey) reload();
  }, [isKey, reload]);
  // Nothing is erased before the person confirms it, as macOS asks: a drive file or the Trash is
  // erased for good, and an app's document is forgotten.
  const recommend = (id: StorageRecommendationId) => {
    if (id === "trash") setAsked("trash");
    else if (id === "auto-trash") {
      if (trashAfter30) {
        setTrashAfter30(false);
        onRecommendation?.(id);
      } else setAsked("auto-trash");
    } else onRecommendation?.(id);
  };
  // A drive file is asked about by its own name; the window's row adds its folder.
  const asksFiles = asked !== null && asked !== "trash" && asked !== "auto-trash";
  const only = asksFiles ? asked.files[0] : undefined;
  const named =
    only === undefined
      ? ""
      : only.id.startsWith("drive:")
        ? (usage?.drive?.files.find((entry) => `drive:${entry.id}` === only.id)?.name ?? only.name)
        : only.name;
  const count = asksFiles ? asked.files.length : 0;
  return (
    <>
      <StorageManagement
        key={generation}
        {...props}
        {...usageProps(usage, failed, trashAfter30)}
        selectedId={selectedId ?? row}
        onSelectedIdChange={(id) => {
          setRow(id);
          onSelectedIdChange?.(id);
        }}
        sort={sort}
        onSortChange={setSort}
        onQuickLook={(file) => {
          if (file.id.startsWith("drive:"))
            showInFinder({ id: file.id.slice("drive:".length), show: "quick-look" });
        }}
        onDeleteSelection={(files, categoryId) => setAsked({ files, categoryId })}
        onRecommendation={recommend}
        revealable={(file) => file.id.startsWith("drive:")}
        onReveal={(file) => {
          const id = file.id.slice("drive:".length);
          const name = usage?.drive?.files.find((entry) => entry.id === id)?.name ?? file.name;
          requestOpenFile({ app: "finder", id, name });
          requestDesktopEffects([{ open: "finder" }]);
        }}
      />
      <Alert
        open={asked !== null}
        onOpenChange={(next) => {
          if (next) return;
          // Not confirmed: the window comes back as it was, the row it took out or the
          // recommendation it marked done included.
          if (!confirmed.current && asked !== null) setGeneration((n) => n + 1);
          confirmed.current = false;
          setAsked(null);
        }}
      >
        <AlertPopup>
          <AlertMessage>
            {asked === "auto-trash"
              ? "Are you sure you want to erase items in the Trash automatically?"
              : asked === "trash"
                ? "Are you sure you want to permanently erase the items in the Trash?"
                : count > 1
                  ? `Are you sure you want to delete these ${count} items?`
                  : `Are you sure you want to delete “${named}”?`}
          </AlertMessage>
          <AlertInformativeText>
            {asked === "auto-trash"
              ? "Items erased after 30 days in the Trash can’t be recovered."
              : asked === "trash"
                ? "You can’t undo this action."
                : count > 1
                  ? "These items will be deleted immediately. You can’t undo this action."
                  : "This item will be deleted immediately. You can’t undo this action."}
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                // Confirmed: closing must not bring the row back.
                confirmed.current = true;
                if (asked !== null) erase(asked);
              }}
            >
              {asked === "auto-trash" ? "Turn On" : asked === "trash" ? "Empty Trash" : "Delete"}
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </>
  );
}

/**
 * Storage Management as the desktop shows it. When the `macalicious-desktop` Ferrite application
 * serves the desktop, the window reports the signed-in person's Ferrite drive against its quota,
 * by kind of file, with Large Files and the Trash, and the documents the desktop's apps keep for
 * them (App Data). Delete… erases a file through the drive's own route or forgets a document
 * through its app's own route; Empty Trash empties the drive's Trash. Every other build shows the
 * captured Mac, as `StorageManagement` does.
 */
export function DesktopStorageManagement(props: StorageManagementProps) {
  return servedByDesktopApp() ? (
    <ServedStorageManagement {...props} />
  ) : (
    <StorageManagement {...props} />
  );
}
