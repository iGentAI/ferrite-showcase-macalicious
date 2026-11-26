import { runApplicationFile } from "../automator/automator-library";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { markOpened } from "../desktop/desktop-files";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { extensionOf, isPdf, isPicture } from "../preview/preview-export";

/**
 * Opening a drive file in the application that works with it, from Finder: Finder asks, the
 * desktop opens the application (`requestDesktopEffects`), and the application takes the file.
 * The request is kept here until the application's window takes it, so it reaches a window that
 * opens only now as well as one that is already open (which hears `OPEN_FILE_EVENT`).
 */

/** The window event an open application hears a request by: `detail` is `{ app, id, name }`. */
export const OPEN_FILE_EVENT = "macalicious:open-file";

/** A request to open a file. */
export interface OpenFileRequest {
  app: string;
  id: string;
  name: string;
  /** For Finder: a folder or place to show instead of an item. */
  place?: string;
  /** For Finder: what to do with the item once it shows, or what to open with no item. */
  show?: "info" | "quick-look" | "find" | "go-to-folder" | "smart-folder";
  /** For Finder's `find`: what to search for. */
  query?: string;
  /** For Terminal: the item is a folder, to open a new window or tab at. */
  folder?: "window" | "tab";
}

const pending = new Map<string, OpenFileRequest[]>();

/** What says which application opens a file: its name and, when known, its media type. */
export interface OpenableFile {
  name: string;
  type?: string;
}

/** The applications that said in their descriptor what they open (`DesktopApp.opens`). */
const openers = new Map<string, (file: OpenableFile) => boolean>();
/** Those that open a file only when asked by name (`DesktopApp.opensOnlyWhenAsked`). */
const askedOnly = new Set<string>();

/** The applications' names, for Open With. */
const openerNames = new Map<string, string>([
  ["textedit", "TextEdit"],
  ["preview", "Preview"],
]);

/** The name of an application `appsForFile` lists. */
export const openerName = (id: string): string => openerNames.get(id) ?? id;

/**
 * Hears which files each of the desktop's applications opens, from its descriptor. An application
 * says so only once its window takes the requests (`takeOpenFileRequests`, `onOpenFileRequest`).
 * Answers the function that forgets them.
 */
export function registerFileOpeners(
  apps: readonly {
    id: string;
    name?: string;
    opens?: (file: OpenableFile) => boolean;
    opensOnlyWhenAsked?: boolean;
  }[],
): () => void {
  const added = apps.flatMap((app) => (app.opens ? [[app.id, app.opens] as const] : []));
  for (const [id, opens] of added) openers.set(id, opens);
  for (const { id, name } of apps) if (name) openerNames.set(id, name);
  const asked = apps.filter((app) => app.opensOnlyWhenAsked).map((app) => app.id);
  for (const id of asked) askedOnly.add(id);
  return () => {
    for (const [id, opens] of added) if (openers.get(id) === opens) openers.delete(id);
    for (const id of asked) askedOnly.delete(id);
  };
}

/** The desktop setting that keeps Change All's choices: an application id per file extension. */
export const OPEN_WITH_DEFAULTS = "finder.openWith";

/** The application Change All chose for files with this name's extension, if any. */
function chosenFor(name: string): string | undefined {
  const chosen = desktopValues()[OPEN_WITH_DEFAULTS];
  if (typeof chosen !== "object" || chosen === null) return undefined;
  const app = (chosen as Record<string, unknown>)[extensionOf(name)];
  return typeof app === "string" ? app : undefined;
}

/** Change All: files with this name's extension open in `app` from now on, for this person. */
export function chooseOpenerFor(name: string, app: string): void {
  const extension = extensionOf(name);
  if (!extension) return;
  const chosen = desktopValues()[OPEN_WITH_DEFAULTS];
  changeDesktopValue(OPEN_WITH_DEFAULTS, {
    ...(typeof chosen === "object" ? chosen : null),
    [extension]: app,
  });
}

/** The applications that open drive files, by what they open. TextEdit opens text documents. */
const TEXT = /\.(rtf|rtfd|txt|text|md|markdown|html?|csv|log|json|xml|docx|odt|webarchive)$/i;
const LOG = /\.log$/i;
const SCRIPT = /\.js$/i;
const WEB_PAGE = /\.html?$/i;
/** The names that say which application a file is for, whatever its type says. */
const NAMED_OPENERS: readonly (readonly [RegExp, string])[] = [
  [/\.ics$/i, "calendar"],
  [/\.(vcf|vcard)$/i, "contacts"],
  [/\.(command|tool|terminal)$/i, "terminal"],
];

/**
 * Every application that opens the drive file, the one that opens it first when nothing else is
 * chosen at the front: TextEdit opens text documents, Preview the pictures and PDFs it shows, by
 * Preview's own rules (a HEIC or TIFF picture, which this browser cannot show, stays in Quick
 * Look), then the applications that said so in their descriptor. Open With lists them.
 */
export function appsForFile(entry: OpenableFile): string[] {
  const apps: string[] = [];
  const type = entry.type ?? "";
  // A log is Console's first, a script Script Editor's and a page Safari's, on a Mac as here; TextEdit
  // still takes them through Open With.
  const first = LOG.test(entry.name)
    ? "console"
    : SCRIPT.test(entry.name)
      ? "script-editor"
      : WEB_PAGE.test(entry.name)
        ? "safari"
        : undefined;
  // Calendars and cards are text, and are Calendar's and Contacts', whatever else the type says;
  // the name decides between the two, and Open With still lists any other that takes the file.
  const owner = NAMED_OPENERS.find(([name]) => name.test(entry.name))?.[1];
  if (owner === undefined && !/^text\/(calendar|(x-)?vcard)$/i.test(type)) {
    if (TEXT.test(entry.name) || type.startsWith("text/") || type === "application/rtf") {
      apps.push("textedit");
    } else if (isPicture(entry) || isPdf(entry)) apps.push("preview");
  }
  for (const [id, opens] of openers) if (opens(entry) && !apps.includes(id)) apps.push(id);
  if (first && apps.includes(first)) return [first, ...apps.filter((id) => id !== first)];
  return owner && apps.includes(owner) ? [owner, ...apps.filter((id) => id !== owner)] : apps;
}

/**
 * The application that opens the drive file, or `undefined` for Quick Look: the one Change All
 * chose for its extension, else the first of `appsForFile`.
 */
export function appForFile(entry: OpenableFile): string | undefined {
  const apps = appsForFile(entry);
  const chosen = chosenFor(entry.name);
  return chosen && apps.includes(chosen) ? chosen : apps.find((id) => !askedOnly.has(id));
}

/**
 * Opens the drive file in `app`, by default the application that opens it: the application opens,
 * or comes to the front, and takes the file. An Automator Application's `.app`, not asked to open in
 * anything, runs instead. Whether there was an application to open it.
 */
export function openFile(entry: OpenableFile & { id: string }, asked?: string): boolean {
  if (asked === undefined && /\.app$/i.test(entry.name)) {
    markOpened(entry.id);
    runApplicationFile(entry);
    return true;
  }
  const app = asked ?? appForFile(entry);
  if (!app) return false;
  markOpened(entry.id);
  requestOpenFile({ app, id: entry.id, name: entry.name });
  requestDesktopEffects([{ open: app }]);
  return true;
}

/**
 * Shows something in Finder, which opens or comes to the front: an item of the drive selected in its
 * folder, with its Info window or Quick Look if asked for, or a folder or place by its path.
 */
export function showInFinder(request: {
  id?: string;
  place?: string;
  show?: OpenFileRequest["show"];
  query?: string;
}): void {
  requestOpenFile({ app: "finder", name: "", ...request, id: request.id ?? "" });
  requestDesktopEffects([{ open: "finder" }]);
}

/**
 * Asks `app` to open the file: queued for the application's next window, and told at once to the
 * one open. The caller opens the application (the desktop's `open` effect).
 */
export function requestOpenFile(request: OpenFileRequest): void {
  pending.set(request.app, [...(pending.get(request.app) ?? []), request]);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_FILE_EVENT, { detail: request }));
  }
}

/**
 * The requests waiting for `app`, oldest first, taken: a window takes each once. Two files opened
 * before the application's window was there are both handed to it.
 */
export function takeOpenFileRequests(app: string): OpenFileRequest[] {
  const requests = pending.get(app) ?? [];
  pending.delete(app);
  return requests;
}

/** The oldest request waiting for `app`, taken (the others stay queued). */
export function takeOpenFileRequest(app: string): OpenFileRequest | undefined {
  const [first, ...rest] = pending.get(app) ?? [];
  if (rest.length > 0) pending.set(app, rest);
  else pending.delete(app);
  return first;
}

/**
 * Hear the requests for `app` while a window of it is open. Returns the cleanup. A request goes
 * to one window: the first to hear it takes it, and the application's other windows leave it.
 */
export function onOpenFileRequest(
  app: string,
  listener: (request: OpenFileRequest) => void,
): () => void {
  const hear = (event: Event) => {
    const detail = (event as CustomEvent<OpenFileRequest>).detail;
    const queued = pending.get(app) ?? [];
    if (detail?.app !== app || !queued.includes(detail)) return;
    const rest = queued.filter((each) => each !== detail);
    if (rest.length > 0) pending.set(app, rest);
    else pending.delete(app);
    listener(detail);
  };
  window.addEventListener(OPEN_FILE_EVENT, hear);
  return () => window.removeEventListener(OPEN_FILE_EVENT, hear);
}
