import { requestDesktopEffects } from "../desktop/desktop-effects";
import {
  childrenOf,
  currentDrive,
  type Drive,
  type DriveEntry,
  DriveError,
  ensureFolder,
  entryOf,
  inTrash,
  type KeptVersion,
  keepVersion,
  listVersions,
  loadDrive,
  pathOf,
  readFileEntry,
  restoreVersion,
  runOps,
  specialFolder,
  uploadFile,
} from "../desktop/desktop-files";
import { currentDesktopSession, sessionFetch, withDeadline } from "../desktop/desktop-server";
import { translateAppleScript } from "./script-editor-applescript";
import type { RunResult } from "./script-editor-data";
import { type BundleInfo, readFileText } from "./script-editor-draft";
import { callOf, globalOf } from "./script-editor-snippets";

/*
 * Script Editor's half of its module of the `macalicious-desktop` Ferrite application
 * (`ferrite-apps/desktop/src/apps/script_editor`): run JavaScript on the server against the
 * person's own desktop apps, read the dictionary of what a script can call, and open and save
 * scripts in `Documents/Scripts` of the person's drive. Every request goes through
 * `sessionFetch` with a deadline, and every failure becomes a rejected promise with a message
 * the window shows; nothing here throws past the window.
 */

/** Where the module answers. */
export const SCRIPT_EDITOR_API = "/api/script-editor";

/** How long a run may take, with the reading of its reply, before the window gives up. */
export const RUN_DEADLINE_MS = 30_000;

/** One parameter of an action, as the dictionary lists it. */
export interface ScriptActionParam {
  name: string;
  kind: string;
  required: boolean;
  summary: string;
}

/** One action a script can call, as the dictionary lists it: `notes.make` and so on. */
export interface ScriptAction {
  name: string;
  title: string;
  app: string;
  summary: string;
  takes_input: boolean;
  writes: boolean;
  params: ScriptActionParam[];
}

/** What a script can call: the actions, and the names it finds defined. */
export interface ScriptDictionary {
  actions: ScriptAction[];
  globals: string[];
}

/** A script saved in the person's drive. */
export interface SavedScript {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: unknown;
}

/**
 * The drive file a window's script is: its id, its name, the folder it is in, and the file's
 * version the script was read from or last saved as, which its next save in place is made from.
 */
export interface ScriptFile {
  id: string;
  name: string;
  parent?: string;
  version?: number;
}

/** A folder a script can move to, with its path for the Move To sheet. */
export interface ScriptFolder {
  id: string;
  path: string;
}

/** One call a script made to an app, as a run's reply lists it. */
export interface ScriptCall {
  action: string;
  ok: boolean;
  code?: string;
  message?: string;
}

/** How a run ended. */
export type ScriptOutcome =
  | "completed"
  | "threw"
  | "fuel_exhausted"
  | "time_exhausted"
  | "too_many_host_calls"
  | "fault";

/** A run's reply. */
export interface ScriptRunReply {
  outcome: ScriptOutcome | string;
  result?: unknown;
  logs: string[];
  error?: string;
  calls: ScriptCall[];
  effects: unknown;
  rounds?: number;
  ms?: number;
}

/**
 * What the window asks of a server. Every method rejects with an `Error` whose message the
 * window shows when the request fails.
 */
export interface ScriptEditorServer {
  /** Write the script as a new file in `Documents/Scripts`, leaving the window's file alone. */
  exportCopy: (name: string, code: string) => Promise<ScriptFile>;
  /** Run a JavaScript script: its result and log lines, as the window shows them. */
  run: (code: string) => Promise<RunResult>;
  /** The dictionary of what a script can call. */
  dictionary: () => Promise<ScriptDictionary>;
  /**
   * Writes the script as a new `<name>.scptd` folder in `Documents/Scripts`, as a bundle is laid out:
   * `Contents/Info.plist` and `Contents/Resources` with `description.html`, `Scripts/main.js` and
   * copies of the bundle's files. A name in use gets the next free name.
   */
  exportBundle: (name: string, bundle: ScriptBundle) => Promise<ScriptFile>;
  /** The scripts saved in the drive. */
  scripts: () => Promise<SavedScript[]>;
  /** The code of a saved script. */
  open: (id: string) => Promise<string>;
  /** Save a script under `name` (without `.js`); `replace` overwrites one of that name. */
  save: (name: string, code: string, replace: boolean) => Promise<{ id: string; path: string }>;
  /**
   * The drive file `id` while it holds exactly `code`, read as one snapshot with its version, which
   * a save in place may then be made from. Rejects when it holds anything else.
   */
  fileHolding: (id: string, code: string) => Promise<ScriptFile>;
  /** Writes `code` into `file` in place; rejects without a version, or when the file was saved over elsewhere since. */
  write: (file: ScriptFile, code: string) => Promise<ScriptFile>;
  /** The versions the drive keeps of a file saved in place; none where nothing keeps them. */
  versions?: ScriptVersions;
  /** Renames `file`; a name without an extension gets `.js`. */
  rename: (file: ScriptFile, name: string) => Promise<ScriptFile>;
  /** Moves `file` to the folder `parent`. */
  move: (file: ScriptFile, parent: string) => Promise<ScriptFile>;
  /** The folders of the drive outside the Trash, by path. */
  folders: () => Promise<ScriptFolder[]>;
  /** The folder the Open panel shows first: `Documents/Scripts`, or Documents without one. */
  scriptsFolder: () => Promise<string>;
}

/** What File > Revert To asks of the drive. */
export interface ScriptVersions {
  list: (id: string) => Promise<KeptVersion[]>;
  /** Makes the version the file's bytes, keeping what they replace; `base` is the file's version now. */
  restore: (id: string, version: number, base: number | undefined) => Promise<void>;
  /** Marks the bytes of a File > Save as asked for, so a quick next save does not thin them away. */
  keep: (id: string, version: number) => Promise<void>;
}

/** What File > Export writes as a script bundle. */
export interface ScriptBundle {
  code: string;
  description: string;
  info: BundleInfo;
}

const xmlText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The bundle's fields as its `Info.plist`. */
export function bundlePlist(info: BundleInfo): string {
  const entry = (key: string, value: string) =>
    `\t<key>${key}</key>\n\t<string>${xmlText(value)}</string>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    entry("CFBundleName", info.name),
    entry("CFBundleIdentifier", info.identifier),
    entry("CFBundleShortVersionString", info.version),
    entry("NSHumanReadableCopyright", info.copyright),
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const errorOf = (reply: unknown): string | null => {
  const error = (reply as { error?: unknown } | null)?.error;
  return typeof error === "string" && error !== "" ? error : null;
};

const messageOf = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "TimeoutError")
    return "The server did not answer in time.";
  if (error instanceof Error) return error.message;
  return String(error);
};

/** One request to the module: its status, its parsed reply and its `retry-after`. */
async function request(
  path: string,
  init: { method?: string; body?: unknown } = {},
  deadline?: number,
): Promise<{ status: number; ok: boolean; reply: unknown; retryAfter: string | null }> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(`${SCRIPT_EDITOR_API}${path}`, {
        method: init.method ?? "GET",
        credentials: "same-origin",
        headers:
          init.body === undefined
            ? { accept: "application/json" }
            : { accept: "application/json", "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal,
      });
      return {
        status: response.status,
        ok: response.ok,
        reply: await readJson(response),
        retryAfter: response.headers?.get?.("retry-after") ?? null,
      };
    }, deadline);
  } catch (error) {
    throw new Error(`The server could not be reached: ${messageOf(error)}`);
  }
}

/** The reply of a request that must succeed, or an error naming what went wrong. */
async function expectOk(
  path: string,
  init?: { method?: string; body?: unknown },
  deadline?: number,
): Promise<unknown> {
  const answer = await request(path, init, deadline);
  if (!answer.ok) throw new Error(errorOf(answer.reply) ?? `The server answered ${answer.status}.`);
  return answer.reply;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** How long a 429 asks to wait, in ms: its `retry-after` seconds, 1 s without one, 5 s at most. */
export function retryDelay(retryAfter: string | null): number {
  const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds < 0) return 1000;
  return Math.min(5, seconds) * 1000;
}

const OUTCOMES: Readonly<Record<string, string>> = {
  threw: "The script stopped with an error.",
  fuel_exhausted: "The script did too much work and was stopped.",
  time_exhausted: "The script ran too long and was stopped.",
  too_many_host_calls: "The script called its apps too many times and was stopped.",
  fault: "The server could not run the script.",
};

/** A run's value as the Result view shows it: a string as it is, anything else as JSON. */
export function writeValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/** A call as a line of the log: `→ notes.make ✓`, `→ files.read ✗ not_found: …`. */
export function callLine(call: ScriptCall): string {
  if (call.ok) return `→ ${call.action} ✓`;
  const why = [call.code, call.message].filter((part) => part).join(": ");
  return why ? `→ ${call.action} ✗ ${why}` : `→ ${call.action} ✗`;
}

/** A run's reply as the window shows it: the Result, whether it failed, and the log lines. */
export type LogTab = "messages" | "events" | "replies";

/**
 * What each tab of the Log shows: Replies every line; Events the calls without their answers;
 * Messages only what the script and the window wrote.
 */
export function logLinesOf(log: readonly string[], tab: LogTab): readonly string[] {
  if (tab === "replies") return log;
  const isCall = (line: string) => line.startsWith("→ ");
  if (tab === "messages") return log.filter((line) => !isCall(line));
  return log.map((line) => (isCall(line) ? line.split(" ").slice(0, 2).join(" ") : line));
}

/** A run's reply as the window shows it: the Result, whether it failed, and the log lines. */
export function runResultOf(reply: ScriptRunReply): RunResult {
  const completed = reply.outcome === "completed";
  const log = [...reply.logs, ...reply.calls.map(callLine)];
  log.push(
    typeof reply.ms === "number" ? `— ${reply.outcome} in ${reply.ms} ms` : `— ${reply.outcome}`,
  );
  const error = reply.error || OUTCOMES[reply.outcome] || `The run ended: ${reply.outcome}.`;
  return {
    result: completed ? writeValue(reply.result) : `Error: ${error}`,
    failed: !completed,
    log,
  };
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item : String(item))) : [];

/** A run's reply, or `undefined` when it is not the module's. */
export function runReplyFromServer(reply: unknown): ScriptRunReply | undefined {
  const value = reply as Record<string, unknown> | null;
  if (typeof value !== "object" || value === null || typeof value.outcome !== "string")
    return undefined;
  const calls = Array.isArray(value.calls)
    ? value.calls.flatMap((call): ScriptCall[] => {
        const entry = call as Record<string, unknown> | null;
        if (typeof entry !== "object" || entry === null || typeof entry.action !== "string")
          return [];
        return [
          {
            action: entry.action,
            ok: entry.ok === true,
            code: typeof entry.code === "string" ? entry.code : undefined,
            message: typeof entry.message === "string" ? entry.message : undefined,
          },
        ];
      })
    : [];
  return {
    outcome: value.outcome,
    result: value.result,
    logs: strings(value.logs),
    error: typeof value.error === "string" ? value.error : undefined,
    calls,
    effects: value.effects,
    rounds: typeof value.rounds === "number" ? value.rounds : undefined,
    ms: typeof value.ms === "number" ? value.ms : undefined,
  };
}

/**
 * Runs `code` on the server and carries out the effects its reply asks for (opening an app,
 * switching the appearance). Another script running answers 429: the run is sent once more
 * after the wait the reply asks for, then the 429's error is the result.
 */
export async function runOnServer(code: string): Promise<RunResult> {
  const body = { code, tz: -new Date().getTimezoneOffset() };
  let answer = await request("/run", { method: "POST", body }, RUN_DEADLINE_MS);
  if (answer.status === 429) {
    await wait(retryDelay(answer.retryAfter));
    answer = await request("/run", { method: "POST", body }, RUN_DEADLINE_MS);
  }
  if (!answer.ok) throw new Error(errorOf(answer.reply) ?? `The server answered ${answer.status}.`);
  const reply = runReplyFromServer(answer.reply);
  if (!reply) throw new Error("The server's answer could not be read.");
  requestDesktopEffects(reply.effects);
  return runResultOf(reply);
}

const isAction = (
  value: unknown,
): value is Record<string, unknown> & { name: string; app: string } => {
  const action = value as Record<string, unknown> | null;
  return (
    typeof action === "object" &&
    action !== null &&
    typeof action.name === "string" &&
    typeof action.app === "string"
  );
};

/** The dictionary of a reply, or `undefined` when it is not the module's. */
export function dictionaryFromServer(reply: unknown): ScriptDictionary | undefined {
  const value = reply as { actions?: unknown; globals?: unknown } | null;
  if (!Array.isArray(value?.actions)) return undefined;
  return {
    actions: value.actions.filter(isAction).map((action) => ({
      name: action.name,
      title: typeof action.title === "string" ? action.title : action.name,
      app: action.app,
      summary: typeof action.summary === "string" ? action.summary : "",
      takes_input: action.takes_input === true,
      writes: action.writes === true,
      params: Array.isArray(action.params)
        ? action.params.flatMap((param: unknown): ScriptActionParam[] => {
            const entry = param as Record<string, unknown> | null;
            if (typeof entry !== "object" || entry === null || typeof entry.name !== "string")
              return [];
            return [
              {
                name: entry.name,
                kind: typeof entry.kind === "string" ? entry.kind : "",
                required: entry.required === true,
                summary: typeof entry.summary === "string" ? entry.summary : "",
              },
            ];
          })
        : [],
    })),
    globals: strings(value.globals),
  };
}

/**
 * The dictionary as the Library view lists it: how to call an action, then the actions grouped
 * by app, each with its summary and its parameters.
 */
export function libraryText(dictionary: ScriptDictionary): string {
  const lines = [
    'Call an action as Notes.make({ title: "Hello" }), Desktop.notes.make({ … }) or',
    'Desktop.action("notes.make", { … }). Each returns a list of items with kind and text.',
    'Desktop.request(app, method, path, body) calls an app\'s own route; Desktop.open("Notes")',
    "opens an app when the run ends. console.log writes to the Log; return gives the Result.",
  ];
  if (dictionary.globals.length > 0) lines.push(`Globals: ${dictionary.globals.join(", ")}`);
  const apps = new Map<string, ScriptAction[]>();
  for (const action of dictionary.actions) {
    apps.set(action.app, [...(apps.get(action.app) ?? []), action]);
  }
  for (const [app, actions] of apps) {
    lines.push("", globalOf(app, dictionary.globals));
    for (const action of actions) {
      const params = action.params.map((param) => param.name).join(", ");
      const call = `${callOf(action, dictionary.globals)}(${params ? `{ ${params} }` : ""})`;
      const notes = [action.writes ? "changes data" : "", action.takes_input ? "takes input" : ""]
        .filter((note) => note)
        .join(", ");
      lines.push(`\t${call} — ${action.title}${notes ? ` (${notes})` : ""}`);
      if (action.summary) lines.push(`\t\t${action.summary}`);
      for (const param of action.params) {
        const kind = [param.kind, param.required ? "required" : ""].filter((x) => x).join(", ");
        lines.push(
          `\t\t${param.name}${kind ? ` (${kind})` : ""}${param.summary ? `: ${param.summary}` : ""}`,
        );
      }
    }
  }
  if (dictionary.actions.length === 0) lines.push("", "No actions are available.");
  return lines.join("\n");
}

/** A saved script's list of a reply; malformed entries are left out. */
export function scriptsFromServer(reply: unknown): SavedScript[] | undefined {
  const list = (reply as { scripts?: unknown } | null)?.scripts;
  if (!Array.isArray(list)) return undefined;
  return list.flatMap((entry): SavedScript[] => {
    const value = entry as Record<string, unknown> | null;
    if (typeof value !== "object" || value === null) return [];
    if (typeof value.id !== "string" || typeof value.name !== "string") return [];
    return [
      {
        id: value.id,
        name: value.name,
        path: typeof value.path === "string" ? value.path : "",
        size: typeof value.size === "number" ? value.size : 0,
        modified: value.modified,
      },
    ];
  });
}

/** A script's name without its `.js`, and without the folders of a path. */
export function scriptName(name: string): string {
  return (name.split("/").pop() ?? name).replace(/\.js$/i, "");
}

const fileFrom = (entry: DriveEntry): ScriptFile => ({
  id: entry.id,
  name: entry.name,
  parent: entry.parent,
  version: entry.version ?? 0,
});

/** The file `id` of `drive`; a drive that no longer has it is a 404, as the server would say. */
function fileIn(drive: Drive, id: string): ScriptFile {
  const entry = entryOf(drive, id);
  if (entry?.kind !== "file" || inTrash(drive, id)) {
    throw new DriveError(404, "The script is no longer on the drive.");
  }
  return fileFrom(entry);
}

/** Whether the window opens the file: a JavaScript script. */
export const isScriptFile = (file: { name: string }): boolean => /\.js$/i.test(file.name);

/**
 * Where each item is on the drive, a line for each, as the window names a saved script. The page's
 * copy of the drive lacks what was saved through the server, so it is read anew when it does not
 * know an item; an item the drive does not list is its name.
 */
export async function drivePaths(items: readonly { id: string; name: string }[]): Promise<string> {
  const known = currentDrive();
  const hasAll = known && items.every(({ id }) => known.entries.some((entry) => entry.id === id));
  const drive = hasAll ? known : await loadDrive().catch(() => known);
  return items
    .map(({ id, name }) => {
      const place = drive ? pathOf(drive, id) : [];
      return place.length > 0 ? place.map((each) => each.name).join("/") : name;
    })
    .join("\n");
}

/** The folder a person's scripts are kept in, when they have one: `Documents/Scripts`. */
export function scriptsFolderIn(drive: Drive): DriveEntry | undefined {
  const documents = specialFolder(drive, "Documents");
  return documents
    ? childrenOf(drive, documents.id).find(
        (entry) => entry.kind === "folder" && entry.name === "Scripts",
      )
    : undefined;
}

/** Script Editor's Preferences > General, Show Script menu in menu bar. */
export const SCRIPT_MENU_SETTING = "scriptEditor.scriptMenu";

/** A row of the Script menu: a script to run, by the file that holds it, or a folder of them. */
export type ScriptMenuEntry =
  | { name: string; file: string; applescript: boolean }
  | { name: string; entries: ScriptMenuEntry[] };

const bundledScript = (drive: Drive, bundle: DriveEntry) => {
  let at: DriveEntry | undefined = bundle;
  for (const name of ["Contents", "Resources", "Scripts", "main.js"]) {
    const parent: string | undefined = at?.id;
    at = parent ? childrenOf(drive, parent).find((entry) => entry.name === name) : undefined;
  }
  return at;
};

/** What the Script menu lists for `folder`: scripts, and the folders that hold some, by name. */
export function scriptMenuEntries(drive: Drive, folder: DriveEntry): ScriptMenuEntry[] {
  const shownName = (name: string) => name.replace(/\.[^.]+$/, "");
  return childrenOf(drive, folder.id)
    .flatMap((entry): ScriptMenuEntry[] => {
      if (entry.kind !== "folder") {
        if (!/\.(js|applescript|scpt)$/i.test(entry.name)) return [];
        return [
          {
            name: shownName(entry.name),
            file: entry.id,
            applescript: !/\.js$/i.test(entry.name),
          },
        ];
      }
      if (/\.scptd$/i.test(entry.name)) {
        const main = bundledScript(drive, entry);
        return main ? [{ name: shownName(entry.name), file: main.id, applescript: false }] : [];
      }
      const entries = scriptMenuEntries(drive, entry);
      return entries.length > 0 ? [{ name: entry.name, entries }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/** Reads a file of the Script menu and runs it as its language runs, on the server. */
export async function runScriptFile(file: string, applescript: boolean): Promise<RunResult> {
  try {
    const { code: source } = readFileText(await (await readFileEntry(file)).blob.text());
    const translated = applescript ? translateAppleScript(source) : null;
    if (translated && !translated.ok) {
      return { result: translated.error, failed: true, log: [] };
    }
    return await desktopScriptEditorServer.run(translated ? translated.code : source);
  } catch (error) {
    return { result: messageOf(error), failed: true, log: [] };
  }
}

/** The server of the `macalicious-desktop` Ferrite application. */
export const desktopScriptEditorServer: ScriptEditorServer = {
  run: async (code) => {
    const result = await runOnServer(code);
    // A script can write to the drive, which the page's copy hears only from its own changes.
    await loadDrive().catch((error) => console.error(error));
    return result;
  },
  exportCopy: async (name, code) => {
    const session = currentDesktopSession();
    const type = name.endsWith(".txt") ? "text/plain" : "text/javascript";
    const folder = await desktopScriptEditorServer.scriptsFolder();
    return fileFrom(await uploadFile(new Blob([code], { type }), folder, { name, session }));
  },
  exportBundle: async (name, { code, description, info }) => {
    const session = currentDesktopSession();
    const folder = await desktopScriptEditorServer.scriptsFolder();
    const made = await runOps(
      [{ op: "mkdir", parent: folder, name: `${name}.scptd`, existing: "rename" }],
      undefined,
      session,
    );
    const id = made.created?.[0];
    const bundle = id ? entryOf(made, id) : undefined;
    if (!bundle) throw new DriveError(500, "The drive did not answer the bundle's folder.");
    const contents = await ensureFolder(bundle.id, "Contents", session);
    const resources = await ensureFolder(contents.id, "Resources", session);
    const scripts = await ensureFolder(resources.id, "Scripts", session);
    const write = (text: string, type: string, parent: string, file: string) =>
      uploadFile(new Blob([text], { type }), parent, { name: file, session });
    await write(bundlePlist(info), "application/xml", contents.id, "Info.plist");
    await write(code, "text/javascript", scripts.id, "main.js");
    if (description !== "") await write(description, "text/html", resources.id, "description.html");
    const copies = [
      ...(info.resources ?? []).map((each) => ({ id: each.id, parent: resources.id })),
      ...(info.scripts ?? []).map((each) => ({ id: each.id, parent: scripts.id })),
    ].map((each) => ({ op: "copy" as const, existing: "rename" as const, ...each }));
    if (copies.length > 0) await runOps(copies, undefined, session);
    return fileFrom(bundle);
  },
  fileHolding: async (id, code) => {
    const { blob, entry } = await readFileEntry(id);
    if ((await blob.text()) !== code) throw new Error("The file changed on the drive.");
    return fileFrom(entry);
  },
  write: async (file, code) => {
    if (file.version === undefined) {
      throw new Error("The version of the script on the drive could not be read.");
    }
    const session = currentDesktopSession();
    const { parent, name } = fileIn(await loadDrive(), file.id);
    return fileFrom(
      await uploadFile(new Blob([code], { type: "text/javascript" }), parent ?? "", {
        name,
        existing: "overwrite",
        replaces: file.id,
        base: file.version,
        session,
      }),
    );
  },
  versions: {
    list: async (id) => (await listVersions(id)).versions,
    restore: (id, version, base) => restoreVersion(id, version, base),
    keep: (id, version) => keepVersion(id, version),
  },
  rename: async (file, name) => {
    const next = /\.[^.\s]+$/.test(name) ? name : `${name}.js`;
    return fileIn(await runOps([{ op: "rename", id: file.id, name: next }]), file.id);
  },
  move: async (file, parent) =>
    fileIn(await runOps([{ op: "move", id: file.id, parent, existing: "fail" }]), file.id),
  folders: async () => {
    const drive = await loadDrive();
    return drive.entries
      .filter((entry) => entry.kind === "folder" && !inTrash(drive, entry.id))
      .map((entry) => ({
        id: entry.id,
        path: pathOf(drive, entry.id)
          .map((each) => each.name)
          .join("/"),
      }))
      .sort((a, b) => a.path.localeCompare(b.path, "en", { sensitivity: "base" }));
  },
  scriptsFolder: async () => {
    // Read anew: the module saves scripts through the server, so the page's copy lacks them.
    const drive = await loadDrive();
    return scriptsFolderIn(drive)?.id ?? specialFolder(drive, "Documents")?.id ?? "documents";
  },
  dictionary: async () => {
    const dictionary = dictionaryFromServer(await expectOk("/dictionary"));
    if (!dictionary) throw new Error("The server's dictionary could not be read.");
    return dictionary;
  },
  scripts: async () => {
    const scripts = scriptsFromServer(await expectOk("/scripts"));
    if (!scripts) throw new Error("The server's list of scripts could not be read.");
    return scripts;
  },
  open: async (id) => {
    const reply = (await expectOk(`/scripts/${encodeURIComponent(id)}`)) as {
      code?: unknown;
    } | null;
    if (typeof reply?.code !== "string") throw new Error("The script could not be read.");
    return reply.code;
  },
  save: async (name, code, replace) => {
    const reply = (await expectOk("/scripts", {
      method: "POST",
      body: replace ? { name, code, replace: true } : { name, code },
    })) as { id?: unknown; path?: unknown } | null;
    // Only a reply that names the file saved counts as saved: anything else leaves the window
    // unsaved, with a message, rather than claim a save nobody acknowledged.
    if (
      typeof reply?.id !== "string" ||
      reply.id === "" ||
      typeof reply.path !== "string" ||
      reply.path === ""
    ) {
      throw new Error("The server’s answer could not be read, so the script may not be saved.");
    }
    return { id: reply.id, path: reply.path };
  },
};

/** File > New from Template's scripts. */
export const SCRIPT_TEMPLATES: readonly { name: string; code: string }[] = [
  { name: "Empty Script", code: "" },
  {
    name: "Reminders Still to Do",
    code: [
      "// The reminders still to do, one to a line.",
      "const reminders = await Reminders.list();",
      'return reminders.map((reminder) => reminder.text).join("\\n");',
    ].join("\n"),
  },
  {
    name: "Today's Events",
    code: [
      "// Today's calendar events, one to a line.",
      "const events = await Calendar.events();",
      'return events.map((event) => event.text).join("\\n");',
    ].join("\n"),
  },
  {
    name: "Log Messages",
    code: [
      "// What console.log writes appears in the Log, under Messages.",
      'console.log("Started");',
      'return "Done";',
    ].join("\n"),
  },
];

/** The script the served window opens with: today's events and reminders. */
export const servedSource = [
  "// Today's calendar events and the reminders still to do.",
  "const events = await Calendar.events();",
  "const reminders = await Reminders.list();",
  'for (const event of events) console.log("Event: " + event.text);',
  'for (const reminder of reminders) console.log("Reminder: " + reminder.text);',
  'return events.length + " events and " + reminders.length + " reminders today";',
].join("\n");
