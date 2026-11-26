import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import {
  type AutomatorCategory,
  type AutomatorTint,
  actionCategories,
  formatDuration,
} from "./automator-data";

/*
 * Automator's link to its server half, `/api/automator/` of the macalicious-desktop Ferrite
 * application (ferrite-apps/desktop/src/apps/automator), with no interface in it: what the routes
 * answer and how this page reads it, the requests, the save that merges a conflict, and the rows
 * the log shows for a run. Only the desktop build made for that application uses it
 * (`servedByDesktopApp()`); every other build shows the invented library of automator-data.ts.
 */

/** `GET`: `{ actions }`, every action of the desktop and Run JavaScript. */
export const ACTIONS_URL = "/api/automator/actions";
/** `GET`: `{ locations, rev, session }`; `PUT` the same: which drive file each moved workflow is. */
export const LOCATIONS_URL = "/api/automator/locations";
/** `GET`: `{ library, rev, session }`; `PUT` `{ library, rev }`: the person's workflows. */
export const WORKFLOWS_URL = "/api/automator/workflows";
/** `POST` `{ workflow, tz, trigger? }`: runs a workflow now and answers its log. */
export const RUN_URL = "/api/automator/run";
/** `POST` `{ key }`: `{ claimed }`, whether this page is the first to start that background run. */
export const CLAIM_URL = "/api/automator/claim";
/** `GET`: `{ runs }`, the last runs, newest first, from every window of the person. */
export const RUNS_URL = "/api/automator/runs";

/** The workflow's saves: `{ versions }`, newest first, after this id. */
export const VERSIONS_URL = "/api/automator/versions/";

/** The most workflows the server keeps for one person. */
export const MAX_WORKFLOWS = 50;
/** The most steps in one workflow. */
export const MAX_STEPS = 32;
/** The step that runs JavaScript, which is not an action of an app. */
export const RUN_JAVASCRIPT = "javascript.run";
/** The step whose text becomes items, which carries a stepped run's items to its next request. */
export const GET_TEXT = "text.get";
/** The longest text of an item in a step's log (`preview` in `workflow.rs`). */
const PREVIEW_CHARS = 200;
/**
 * The setting that keeps a step's own name (Action > Rename Action…). `workflow.rs` denies unknown
 * fields on a step but keeps its settings whole, and an action reads only the settings it knows.
 */
const STEP_NAME = "step_name";
/**
 * The setting of a step the page carries out itself. The server refuses a workflow that names an
 * action it does not have, so such a step is kept as a Get Specified Text with this setting.
 */
const PAGE_STEP = "page_step";
/** The setting that keeps Options' "Show this action when the workflow runs". */
const SHOW_WHEN_RUN = "show_when_run";
/** How often an open window reads the runs again, so that a run from another window appears. */
export const RUNS_POLL_MS = 10_000;

/** One setting of an action. `kind` is `text`, `day`, `time`, `number`, `boolean`,
 * `choice:a|b|c` or `code`. */
export interface ServerParam {
  name: string;
  kind: string;
  required: boolean;
  summary: string;
  /** A checkbox ticked on a new step. */
  on?: true;
}

/** One action of the library, as the server describes it. */
export interface ServerAction {
  /** What a step names it by: `notes.make`. */
  name: string;
  /** Automator's title for it: "New Note". */
  title: string;
  /** The demo folder of the app it belongs to, which groups it in the outline. */
  app: string;
  summary: string;
  /** Whether the previous step's output can stand in for its main setting. */
  takes_input: boolean;
  /** Whether it changes the person's data. */
  writes: boolean;
  params: ServerParam[];
  /** Set on a library row that cannot be added: why it does not run here. */
  reason?: string;
}

/**
 * A workflow's type. Beside `workflow`, which runs on Run, the page starts the others on their own
 * event (automator-background.ts), so only while the desktop is open.
 */
export type WorkflowKind =
  | "workflow"
  | "quick-action"
  | "application"
  | "folder-action"
  | "calendar-alarm"
  | "dictation-command";
/** What a Quick Action takes from the selection. */
export type QuickInput = "files" | "text" | "none";
export type ParamValue = string | number | boolean;

export interface WorkflowStep {
  action: string;
  params: Record<string, ParamValue>;
  /** Absent means on, as the server writes it. */
  enabled?: boolean;
  /** Present when the step is handed no items, whatever the step before it gave. */
  ignore_input?: true;
}

/** One workflow, as the server keeps and runs it. */
export interface Workflow {
  id: string;
  name: string;
  kind: WorkflowKind;
  steps: WorkflowStep[];
  /** Kept as the server stores it; a plain workflow ignores it. */
  enabled: boolean;
  /** What a Quick Action takes; absent means files. */
  receives?: QuickInput;
  /** The drive folder a Folder Action watches. */
  folder?: string;
}

/** The person's workflows and the zone they were saved in, minutes east of UTC. */
export interface WorkflowLibrary {
  workflows: Workflow[];
  tz: number;
}

/** One step of a run. */
export interface StepLog {
  action: string;
  title: string;
  status: "completed" | "failed" | "skipped";
  message?: string;
  /** How many items it handed on. */
  items: number;
  /** The text of the first few. */
  preview: string[];
  ms: number;
  /** What a Run JavaScript step logged. */
  logs?: string[];
  /** Every item it handed on, in the reply to a run; a kept log has only `preview`. */
  all?: RunItem[];
}

/** How a run started: by Run, or by what a document type runs on. */
export type RunTrigger = "manual" | Exclude<WorkflowKind, "workflow">;

/** One run of a workflow. */
export interface RunLog {
  id: string;
  /** The workflow's id. */
  workflow: string;
  name: string;
  trigger: RunTrigger;
  /** When it started, in epoch milliseconds. */
  started: number;
  ms: number;
  ok: boolean;
  steps: StepLog[];
  /** The text of the last step's items. */
  output: string[];
  /** What the page should do: open an app, switch the appearance. */
  effects?: unknown[];
}

/** The workflows as this page last had them from the server. */
export interface WorkflowsState {
  /** `null` before anything was saved. */
  library: WorkflowLibrary | null;
  rev: number;
  /** The server session the reply named (a hash of the cookie), sent back with a save. */
  session: string | null;
}

/** A change of the person's to the stored workflows. */
export type LibraryChange = { type: "put"; workflow: Workflow } | { type: "delete"; id: string };

/* ------------------------------------------------------------------------------- reading */

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const KINDS: readonly string[] = [
  "workflow",
  "quick-action",
  "application",
  "folder-action",
  "calendar-alarm",
  "dictation-command",
];
const RECEIVES: readonly string[] = ["files", "text", "none"];
const STATUSES: readonly string[] = ["completed", "failed", "skipped"];
const TRIGGERS: readonly string[] = [
  "manual",
  "quick-action",
  "application",
  "folder-action",
  "calendar-alarm",
  "dictation-command",
];

function paramOf(value: unknown): ServerParam | undefined {
  if (!isObject(value) || !isString(value.name) || !isString(value.kind)) return undefined;
  return {
    name: value.name,
    kind: value.kind,
    required: value.required === true,
    summary: isString(value.summary) ? value.summary : "",
  };
}

function actionOf(value: unknown): ServerAction | undefined {
  if (!isObject(value) || !isString(value.name) || !isString(value.title)) return undefined;
  const params = Array.isArray(value.params) ? value.params.map(paramOf) : [];
  if (params.some((param) => param === undefined)) return undefined;
  return {
    name: value.name,
    title: value.title,
    app: isString(value.app) ? value.app : "",
    summary: isString(value.summary) ? value.summary : "",
    takes_input: value.takes_input === true,
    writes: value.writes === true,
    params: params as ServerParam[],
  };
}

/** The actions of a `GET /actions` reply, malformed entries left out; `undefined` when the reply
 * is not the module's. */
export function actionsFromServer(reply: unknown): ServerAction[] | undefined {
  const actions = isObject(reply) ? reply.actions : undefined;
  if (!Array.isArray(actions)) return undefined;
  return actions.flatMap((entry) => actionOf(entry) ?? []);
}

function stepOf(value: unknown): WorkflowStep | undefined {
  if (!isObject(value) || !isString(value.action)) return undefined;
  const params: Record<string, ParamValue> = {};
  if (value.params !== undefined && value.params !== null) {
    if (!isObject(value.params)) return undefined;
    for (const [name, param] of Object.entries(value.params)) {
      if (typeof param === "string" || typeof param === "boolean") params[name] = param;
      else if (typeof param === "number" && Number.isFinite(param)) params[name] = param;
      else return undefined;
    }
  }
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") return undefined;
  if (value.ignore_input !== undefined && typeof value.ignore_input !== "boolean") {
    return undefined;
  }
  return {
    action: value.action,
    params,
    ...(value.enabled === false ? { enabled: false } : {}),
    ...(value.ignore_input === true ? { ignore_input: true as const } : {}),
  };
}

function workflowOf(value: unknown): Workflow | undefined {
  if (!isObject(value) || !isString(value.id) || !isString(value.name)) return undefined;
  if (!isString(value.kind) || !KINDS.includes(value.kind)) return undefined;
  if (!Array.isArray(value.steps)) return undefined;
  const steps = value.steps.map(stepOf);
  if (steps.some((step) => step === undefined)) return undefined;
  return {
    id: value.id,
    name: value.name,
    kind: value.kind as WorkflowKind,
    steps: steps as WorkflowStep[],
    enabled: value.enabled !== false,
    ...typeSettingsOf(value),
  };
}

/** A Quick Action's input and a Folder Action's folder, as far as they are what the type keeps. */
function typeSettingsOf(value: Fields): Pick<Workflow, "receives" | "folder"> {
  return {
    ...(value.kind === "quick-action" &&
    isString(value.receives) &&
    RECEIVES.includes(value.receives)
      ? { receives: value.receives as QuickInput }
      : {}),
    ...(value.kind === "folder-action" && isString(value.folder) && value.folder !== ""
      ? { folder: value.folder }
      : {}),
  };
}

/**
 * The workflows of a reply's `library`: `null` when none were ever saved, `undefined` when the
 * library cannot be read. A library with one workflow this page cannot read is unreadable as a
 * whole, so that a save never drops what the page did not understand.
 */
export function libraryFromServer(value: unknown): WorkflowLibrary | null | undefined {
  if (value === null) return null;
  if (!isObject(value) || !Array.isArray(value.workflows)) return undefined;
  const workflows = value.workflows.map(workflowOf);
  if (workflows.some((workflow) => workflow === undefined)) return undefined;
  const tz = typeof value.tz === "number" && Number.isFinite(value.tz) ? value.tz : 0;
  return { workflows: workflows as Workflow[], tz };
}

function runItemOf(value: unknown): RunItem {
  if (typeof value === "string") return value;
  if (isObject(value)) {
    const { kind, id, name, path, text } = value;
    if (kind === "file" && isString(id) && isString(name) && isString(text)) {
      return { kind: "file", id, name, path: isString(path) ? path : text, text };
    }
    if (isString(text)) return text;
  }
  return JSON.stringify(value);
}

function stepLogOf(value: unknown): StepLog | undefined {
  if (!isObject(value) || !isString(value.action) || !isString(value.title)) return undefined;
  if (!isString(value.status) || !STATUSES.includes(value.status)) return undefined;
  const preview = Array.isArray(value.preview) ? value.preview.filter(isString) : [];
  const logs = Array.isArray(value.logs) ? value.logs.filter(isString) : [];
  return {
    action: value.action,
    title: value.title,
    status: value.status as StepLog["status"],
    ...(isString(value.message) ? { message: value.message } : {}),
    items: isCount(value.items) ? value.items : 0,
    preview,
    ms: isCount(value.ms) ? value.ms : 0,
    ...(logs.length > 0 ? { logs } : {}),
    ...(Array.isArray(value.all) && value.all.length > 0 ? { all: value.all.map(runItemOf) } : {}),
  };
}

/** A run's log, or `undefined` when the value is not one. */
export function runFromServer(value: unknown): RunLog | undefined {
  if (!isObject(value) || !isString(value.id) || !Array.isArray(value.steps)) return undefined;
  const steps = value.steps.map(stepLogOf);
  if (steps.some((step) => step === undefined)) return undefined;
  const trigger = isString(value.trigger) && TRIGGERS.includes(value.trigger) ? value.trigger : "";
  if (!trigger) return undefined;
  return {
    id: value.id,
    workflow: isString(value.workflow) ? value.workflow : "",
    name: isString(value.name) ? value.name : "",
    trigger: trigger as RunTrigger,
    started: isCount(value.started) ? value.started : 0,
    ms: isCount(value.ms) ? value.ms : 0,
    ok: value.ok === true,
    steps: steps as StepLog[],
    output: Array.isArray(value.output) ? value.output.filter(isString) : [],
    ...(Array.isArray(value.effects) ? { effects: value.effects } : {}),
  };
}

/** The runs of a `GET /runs` reply, malformed ones left out; `undefined` when the reply is not
 * the module's. */
export function runsFromServer(reply: unknown): RunLog[] | undefined {
  const runs = isObject(reply) ? reply.runs : undefined;
  if (!Array.isArray(runs)) return undefined;
  return runs.flatMap((run) => runFromServer(run) ?? []);
}

/* ------------------------------------------------------------------------------ requests */

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The `error` a refusal carries, or its status. */
const refusalOf = (reply: unknown, status: number) =>
  isObject(reply) && isString(reply.error) && reply.error.trim() !== ""
    ? reply.error
    : `the server answered ${status}`;

const unreachable = (error: unknown) =>
  `the desktop's server could not be reached (${messageOf(error)})`;

/** `GET url` within the request deadline: the status and the parsed reply. */
async function get(url: string): Promise<{ ok: boolean; status: number; reply: unknown }> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    return { ok: response.ok, status: response.status, reply: await readJson(response) };
  });
}

/** The library of actions. Rejects with a sentence when it cannot be read. */
export async function loadActions(): Promise<ServerAction[]> {
  let answer: Awaited<ReturnType<typeof get>>;
  try {
    answer = await get(ACTIONS_URL);
  } catch (error) {
    throw new Error(unreachable(error));
  }
  if (!answer.ok) throw new Error(refusalOf(answer.reply, answer.status));
  const actions = actionsFromServer(answer.reply);
  if (!actions) throw new Error("the server's list of actions could not be read");
  return actions;
}

/** The stored workflows. Rejects with a sentence when they cannot be read. */
export async function loadWorkflows(): Promise<WorkflowsState> {
  let answer: Awaited<ReturnType<typeof get>>;
  try {
    answer = await get(WORKFLOWS_URL);
  } catch (error) {
    throw new Error(unreachable(error));
  }
  if (!answer.ok) throw new Error(refusalOf(answer.reply, answer.status));
  const reply = answer.reply;
  // The reply names its library, `null` when none was ever saved; a reply without one is not
  // read as an empty library, which the next save would write over the stored workflows.
  const library =
    isObject(reply) && "library" in reply ? libraryFromServer(reply.library) : undefined;
  if (library === undefined || !isObject(reply) || !isCount(reply.rev)) {
    throw new Error("the saved workflows could not be read");
  }
  return { library, rev: reply.rev, session: isString(reply.session) ? reply.session : null };
}

/** The recent runs, newest first. Rejects when they cannot be read. */
export async function loadRuns(): Promise<RunLog[]> {
  let answer: Awaited<ReturnType<typeof get>>;
  try {
    answer = await get(RUNS_URL);
  } catch (error) {
    throw new Error(unreachable(error));
  }
  if (!answer.ok) throw new Error(refusalOf(answer.reply, answer.status));
  const runs = runsFromServer(answer.reply);
  if (!runs) throw new Error("the server's runs could not be read");
  return runs;
}

/** One save of a workflow, as File > Revert To > Browse All Versions lists it. */
export interface WorkflowVersion {
  savedMs: number;
  workflow: Workflow;
}

/** The workflow's saves, newest first. Rejects with a sentence when they cannot be read. */
export async function loadVersions(id: string): Promise<WorkflowVersion[]> {
  let answer: Awaited<ReturnType<typeof get>>;
  try {
    answer = await get(`${VERSIONS_URL}${encodeURIComponent(id)}`);
  } catch (error) {
    throw new Error(unreachable(error));
  }
  if (!answer.ok) throw new Error(refusalOf(answer.reply, answer.status));
  const list = isObject(answer.reply) ? answer.reply.versions : undefined;
  if (!Array.isArray(list)) throw new Error("the saved versions could not be read");
  return list.flatMap((entry) => {
    const workflow = isObject(entry) ? workflowOf(entry.workflow) : undefined;
    return isObject(entry) && workflow && isCount(entry.saved_ms)
      ? [{ savedMs: entry.saved_ms, workflow }]
      : [];
  });
}

/** A run's outcome. A failure is `uncertain` when the workflow may have run all the same (no
 * answer in time, a gateway or server failure, an unreadable log): its steps may have acted,
 * so the window must not offer it as not run. */
export type RunOutcome =
  | { ok: true; run: RunLog }
  | { ok: false; error: string; uncertain: boolean };

/** Run `workflow` now on the server, in the zone `tz` (minutes east of UTC). */
export async function runWorkflow(
  workflow: Workflow,
  tz: number,
  trigger: RunTrigger = "manual",
): Promise<RunOutcome> {
  let answer: { response: Response; reply: unknown };
  try {
    answer = await withDeadline(async (signal) => {
      const response = await sessionFetch(RUN_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(trigger === "manual" ? { workflow, tz } : { workflow, tz, trigger }),
        signal,
      });
      return { response, reply: await readJson(response) };
    });
  } catch (error) {
    return { ok: false, error: unreachable(error), uncertain: true };
  }
  if (!answer.response.ok) {
    return {
      ok: false,
      error: refusalOf(answer.reply, answer.response.status),
      // The server refuses a workflow before running it (4xx); a server or gateway failure
      // can come after it ran.
      uncertain: answer.response.status >= 500,
    };
  }
  const run = runFromServer(answer.reply);
  return run
    ? { ok: true, run }
    : { ok: false, error: "the server's log could not be read", uncertain: true };
}

/** `workflows` with `change` made: a workflow added or replaced by id, or one taken out. */
export function applyChange(workflows: readonly Workflow[], change: LibraryChange): Workflow[] {
  if (change.type === "delete") return workflows.filter((workflow) => workflow.id !== change.id);
  const index = workflows.findIndex((workflow) => workflow.id === change.workflow.id);
  if (index < 0) return [...workflows, change.workflow];
  const next = workflows.slice();
  next[index] = change.workflow;
  return next;
}

export type SaveOutcome =
  | { ok: true; state: WorkflowsState }
  | { ok: false; error: string; state?: WorkflowsState };

/** How many times a save that met a newer revision is made again on it. */
const SAVE_ATTEMPTS = 3;

/**
 * Save `change` (one workflow added, replaced or deleted) over the workflows `state` holds,
 * as the whole library on the revision `state` has. A 409 means the workflows changed elsewhere
 * (another window or browser): the reply's library and revision are taken, the same change is
 * made to them, and that is saved, so neither side's workflows are lost. A refusal (400, an
 * invalid workflow) answers the server's message. `state` in the outcome is the newest the page
 * knows of the stored workflows.
 */
export async function saveChange(
  state: WorkflowsState,
  change: LibraryChange,
  tz: number,
): Promise<SaveOutcome> {
  let current = state;
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const library: WorkflowLibrary = {
      workflows: applyChange(current.library?.workflows ?? [], change),
      // The zone the library was first saved in stays: a save from a browser elsewhere does not
      // move it.
      tz: current.library?.tz ?? tz,
    };
    const body = current.session
      ? { library, rev: current.rev, session: current.session }
      : { library, rev: current.rev };
    let answer: { response: Response; reply: unknown };
    try {
      answer = await withDeadline(async (signal) => {
        const response = await sessionFetch(WORKFLOWS_URL, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          signal,
        });
        return { response, reply: await readJson(response) };
      });
    } catch (error) {
      return { ok: false, error: unreachable(error), state: current };
    }
    const { response, reply } = answer;
    if (response.ok) {
      // Saved only on a reply that says what was stored and at which revision. Anything else
      // (no JSON, no revision, a library the page cannot read) leaves it unknown whether the
      // save went through: the draft stays unsaved, and the next read shows what is stored.
      const stored =
        isObject(reply) && "library" in reply ? libraryFromServer(reply.library) : undefined;
      if (!isObject(reply) || !isCount(reply.rev) || stored === undefined || stored === null) {
        return {
          ok: false,
          error: "the server's answer could not be read, so it is not known whether it saved",
          state: current,
        };
      }
      return { ok: true, state: { library: stored, rev: reply.rev, session: current.session } };
    }
    if (response.status === 409 && isObject(reply)) {
      // A conflict of sessions holds no library: the page's session has ended, and nothing of
      // the new one is taken.
      if (!("library" in reply)) {
        return { ok: false, error: refusalOf(reply, response.status), state: current };
      }
      const stored = libraryFromServer(reply.library);
      if (stored === undefined || !isCount(reply.rev)) {
        return { ok: false, error: "the saved workflows could not be read", state: current };
      }
      current = { library: stored, rev: reply.rev, session: current.session };
      continue;
    }
    return { ok: false, error: refusalOf(reply, response.status), state: current };
  }
  return {
    ok: false,
    error: "the workflows kept changing elsewhere; save again",
    state: current,
  };
}

/* ------------------------------------------------------------------- building a workflow */

/** Which drive file each workflow moved with File > Move To… is, by id. */
export interface WorkflowLocations {
  files: Readonly<Record<string, string>>;
  rev: number;
  session?: string;
}

function locationsFrom(reply: unknown): WorkflowLocations | undefined {
  if (!isObject(reply) || !isCount(reply.rev) || !isObject(reply.locations)) return undefined;
  const files = Object.fromEntries(
    Object.entries(reply.locations).filter((entry): entry is [string, string] =>
      isString(entry[1]),
    ),
  );
  return { files, rev: reply.rev, ...(isString(reply.session) ? { session: reply.session } : {}) };
}

/** Rejects with a sentence when they cannot be read. */
export async function loadLocations(): Promise<WorkflowLocations> {
  let answer: Awaited<ReturnType<typeof get>>;
  try {
    answer = await get(LOCATIONS_URL);
  } catch (error) {
    throw new Error(unreachable(error));
  }
  if (!answer.ok) throw new Error(refusalOf(answer.reply, answer.status));
  const locations = locationsFrom(answer.reply);
  if (!locations) throw new Error("the workflows' locations could not be read");
  return locations;
}

/**
 * Records the workflow's file, or forgets it with `null`. `known` is the workflows there are: the
 * entry of one since deleted goes, so that the list stays within what the server takes.
 */
export async function changeLocation(
  id: string,
  file: string | null,
  known: readonly string[],
): Promise<void> {
  let current = await loadLocations();
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const locations: Record<string, string> = Object.fromEntries(
      Object.entries(current.files).filter(([each]) => known.includes(each) && each !== id),
    );
    if (file !== null) locations[id] = file;
    const body = { locations, rev: current.rev, session: current.session };
    let answer: { status: number; reply: unknown };
    try {
      answer = await withDeadline(async (signal) => {
        const response = await sessionFetch(LOCATIONS_URL, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          signal,
        });
        return { status: response.status, reply: await readJson(response) };
      });
    } catch (error) {
      throw new Error(unreachable(error));
    }
    if (answer.status >= 200 && answer.status < 300) return;
    const latest = answer.status === 409 ? locationsFrom(answer.reply) : undefined;
    if (!latest) throw new Error(refusalOf(answer.reply, answer.status));
    current = { ...latest, session: current.session };
  }
  throw new Error("the workflows' locations kept changing elsewhere");
}

/** What a setting holds while it is edited: text, or a checkbox's state. */
export type ParamDraft = string | boolean;

/** The page's offset from UTC, in minutes east, as the server reads local days and times. */
export function timezoneOffset(at: Date = new Date()): number {
  // `|| 0`: UTC is 0, not the -0 that negating a zero offset gives.
  return -at.getTimezoneOffset() || 0;
}

/** A new workflow id: 32 hex digits. */
export function newWorkflowId(): string {
  const random = globalThis.crypto;
  if (typeof random?.randomUUID === "function") return random.randomUUID().replace(/-/g, "");
  const bytes = new Uint8Array(16);
  if (typeof random?.getRandomValues === "function") random.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.random() * 256;
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The choices of a `choice:a|b|c` kind, or `undefined` for another kind. */
export function choicesOf(kind: string): string[] | undefined {
  if (!kind.startsWith("choice:")) return undefined;
  return kind
    .slice("choice:".length)
    .split("|")
    .filter((choice) => choice !== "");
}

/** The settings of a new step: a required choice starts on its first choice, a checkbox off
 * (as it is shown, and as it is sent). */
export function defaultParams(action: ServerAction | undefined): Record<string, ParamDraft> {
  const params: Record<string, ParamDraft> = {};
  for (const param of action?.params ?? []) {
    const choices = choicesOf(param.kind);
    if (param.kind === "boolean") params[param.name] = param.on === true;
    else if (param.required && choices?.[0]) params[param.name] = choices[0];
  }
  return params;
}

/**
 * A step's settings as they are sent: blank text left out (so that the previous step's output
 * can stand in for it), a checkbox as it is shown, on or off, also one the stored step never
 * set (an action whose setting is on by default must hear the off the window shows), a number
 * as a number, text and code as typed, spaces included. `stored` is the step's settings as they were saved: a number left
 * as it was stays a number even when the action's description does not say it is one (the
 * library could not be read, or no longer lists the action). A setting named `input` is never
 * sent: input comes from the step before.
 */
export function paramsToSend(
  action: ServerAction | undefined,
  drafts: Readonly<Record<string, ParamDraft>>,
  stored: Readonly<Record<string, ParamValue>> = {},
): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = {};
  for (const [name, value] of Object.entries(drafts)) {
    if (name === "input") continue;
    const kind = action?.params.find((param) => param.name === name)?.kind;
    if (typeof value === "boolean") {
      params[name] = value;
      continue;
    }
    if (value.trim() === "") continue;
    const before = stored[name];
    if (kind === "number" && Number.isFinite(Number(value.trim()))) {
      params[name] = Number(value.trim());
    } else if (
      kind === undefined &&
      typeof before === "number" &&
      value.trim() === String(before)
    ) {
      params[name] = before;
    } else {
      // Text as typed: its own spaces and line breaks are part of what a note, a file or a
      // message says. Blank text was left out above.
      params[name] = value;
    }
  }
  for (const param of action?.params ?? []) {
    if (param.kind === "boolean" && param.name !== "input" && !(param.name in params)) {
      params[param.name] = false;
    }
  }
  return params;
}

/** A stored step's settings as they are edited. */
export function draftsOf(params: Readonly<Record<string, ParamValue>>): Record<string, ParamDraft> {
  const drafts: Record<string, ParamDraft> = {};
  for (const [name, value] of Object.entries(params)) {
    drafts[name] = typeof value === "number" ? String(value) : value;
  }
  return drafts;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** A day as the server writes it: `YYYY-MM-DD`, local. */
export function dayOf(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** One step while it is edited: `key` tells two steps of one action apart. */
export interface DraftStep {
  key: number;
  action: string;
  params: Record<string, ParamDraft>;
  /** The settings as the stored workflow had them, for a step opened from one. */
  stored?: Record<string, ParamValue>;
  enabled: boolean;
  /** Options' "Ignore this action's input". */
  ignoreInput?: boolean;
  /** Action > Rename Action…: what the workflow calls this step. */
  label?: string;
  /** Options' "Show this action when the workflow runs". */
  showWhenRun?: boolean;
}

/** The workflow the window edits: what the server keeps, with every setting as typed. */
export interface WorkflowDraft {
  id: string;
  name: string;
  kind: WorkflowKind;
  steps: DraftStep[];
  enabled: boolean;
  receives?: QuickInput;
  folder?: string;
}

/** A new, empty workflow of the type. */
export function newDraft(kind: WorkflowKind = "workflow"): WorkflowDraft {
  return { id: newWorkflowId(), name: "Untitled", kind, steps: [], enabled: true };
}

/** A stored workflow as the window edits it; `nextKey` numbers its steps. */
export function draftFromWorkflow(workflow: Workflow, nextKey: () => number): WorkflowDraft {
  return {
    id: workflow.id,
    name: workflow.name,
    kind: workflow.kind,
    steps: workflow.steps.map((step) => {
      const {
        [STEP_NAME]: label,
        [PAGE_STEP]: page,
        [SHOW_WHEN_RUN]: showWhenRun,
        ...params
      } = step.params;
      return {
        key: nextKey(),
        action: typeof page === "string" ? page : step.action,
        params: draftsOf(params),
        stored: params,
        enabled: step.enabled !== false,
        ...(step.ignore_input ? { ignoreInput: true } : {}),
        ...(typeof label === "string" ? { label } : {}),
        ...(showWhenRun === true ? { showWhenRun: true } : {}),
      };
    }),
    enabled: workflow.enabled,
    ...(workflow.receives ? { receives: workflow.receives } : {}),
    ...(workflow.folder ? { folder: workflow.folder } : {}),
  };
}

/** The workflow as a file on this desktop, `.workflow` or an Application's `.app`: the draft as JSON. */
export const workflowFileText = (draft: WorkflowDraft) => JSON.stringify(draft, null, 2);

/** What a workflow's file is called on the drive: an Application is the one that runs on opening. */
export const fileNameOf = (name: string, kind: WorkflowKind) =>
  `${name.trim() || "Untitled"}${kind === "application" ? ".app" : ".workflow"}`;

/** The name typed in a Save dialog, as a workflow's file. */
export const workflowFileName = (typed: string, kind: WorkflowKind) =>
  /\.(workflow|app)$/i.test(typed)
    ? typed
    : `${typed}${kind === "application" ? ".app" : ".workflow"}`;

/**
 * A `.workflow` or `.app` file opened from the drive, as a new workflow named after the file; `null`
 * for a file in another shape, which a Mac's bundle is.
 */
export function draftFromFile(
  text: string,
  name: string,
  nextKey: () => number,
): WorkflowDraft | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(value) || !Array.isArray(value.steps)) return null;
  if (!isString(value.kind) || !KINDS.includes(value.kind)) return null;
  const steps: DraftStep[] = [];
  for (const step of value.steps as unknown[]) {
    if (!isObject(step) || typeof step.action !== "string" || !isObject(step.params)) return null;
    const params: Record<string, ParamDraft> = {};
    for (const [key, each] of Object.entries(step.params)) {
      if (typeof each === "string" || typeof each === "boolean") params[key] = each;
    }
    steps.push({
      key: nextKey(),
      action: step.action,
      params,
      stored: params,
      enabled: step.enabled !== false,
      ...(step.ignoreInput === true ? { ignoreInput: true } : {}),
      ...(typeof step.label === "string" ? { label: step.label } : {}),
      ...(step.showWhenRun === true ? { showWhenRun: true } : {}),
    });
  }
  return {
    id: newWorkflowId(),
    name: name.replace(/\.(workflow|app)$/i, "") || "Untitled",
    kind: value.kind as WorkflowKind,
    steps,
    enabled: value.enabled !== false,
    ...typeSettingsOf(value),
  };
}

/** The workflow as the server takes it, with a name even when the field was left empty. */
export function workflowOfDraft(
  draft: WorkflowDraft,
  actions: ReadonlyMap<string, ServerAction>,
): Workflow {
  return {
    id: draft.id,
    name: draft.name.trim() || "Untitled",
    kind: draft.kind,
    steps: draft.steps.map((step) => ({
      action: step.action.startsWith("page.") ? GET_TEXT : step.action,
      params: {
        ...paramsToSend(actions.get(step.action), step.params, step.stored),
        ...(step.label ? { [STEP_NAME]: step.label } : {}),
        ...(step.action.startsWith("page.") ? { [PAGE_STEP]: step.action } : {}),
        ...(step.showWhenRun ? { [SHOW_WHEN_RUN]: true } : {}),
      },
      ...(step.enabled ? {} : { enabled: false }),
      ...(step.ignoreInput ? { ignore_input: true as const } : {}),
    })),
    enabled: draft.enabled,
    ...(draft.kind === "quick-action" && draft.receives ? { receives: draft.receives } : {}),
    ...(draft.kind === "folder-action" && draft.folder ? { folder: draft.folder } : {}),
  };
}

/* ------------------------------------------------------------------------- a stepped run */

/** A drive item a page action handed on, in the shape the server's own file items have. */
export interface FileItem {
  kind: "file";
  id: string;
  name: string;
  path: string;
  text: string;
}

/** What goes from one step of a run to the next. */
export type RunItem = string | FileItem;

export const itemText = (item: RunItem) => (typeof item === "string" ? item : item.text);

/**
 * `workflow` with `items` as what its first step is handed. The server starts every request with
 * no items, so they go as a step in front, whose row in the log is that request's first
 * (`withoutInput`): Get Specified Text, which makes an item of each line, or for items it cannot
 * carry (a file, a text of several lines) a Run JavaScript that returns them.
 */
export function withInput(workflow: Workflow, items: readonly RunItem[]): Workflow {
  if (items.length === 0) return workflow;
  const lines = items.every(
    (item) => typeof item === "string" && !item.includes("\n") && item.trim() !== "",
  );
  const carrier: WorkflowStep = lines
    ? { action: GET_TEXT, params: { text: items.map(itemText).join("\n") } }
    : {
        action: RUN_JAVASCRIPT,
        params: {
          code: `return ${JSON.stringify(
            items.map((item) => (typeof item === "string" ? { kind: "text", text: item } : item)),
          )};`,
        },
      };
  return { ...workflow, steps: [carrier, ...workflow.steps] };
}

/** The run of a `withInput` workflow, without the step that carried `items`. */
export function withoutInput(run: RunLog, items: readonly RunItem[]): RunLog {
  return items.length === 0 ? run : { ...run, steps: run.steps.slice(1) };
}

/**
 * What a step can hand to the next request: every item the reply carried, or else the texts its
 * log shows, and whether they are all of it. The log holds the first five items, each cut at 200
 * characters, so a step whose items were too many for the reply cannot be handed on.
 */
export function handedOn(log: StepLog | undefined): { items: RunItem[]; whole: boolean } {
  if (!log) return { items: [], whole: true };
  if (log.all) return { items: log.all, whole: true };
  return {
    items: log.preview,
    whole:
      log.items === log.preview.length &&
      log.preview.every(
        (text) => [...text].length < PREVIEW_CHARS && !text.includes("\n") && text.trim() !== "",
      ),
  };
}

/* -------------------------------------------------------------------------------- library */

/** Where an app's actions go in the outline: Automator's categories, by the demo folder. */
const THIRTEEN = actionCategories[0]?.children ?? [];
const realCategory = (id: string): Omit<AutomatorCategory, "children"> =>
  THIRTEEN.find((category) => category.id === id) ?? { id, name: id, tint: "neutral" };
const VARIABLE_CATEGORIES: readonly Omit<AutomatorCategory, "children">[] = [
  { id: "var-date-time", name: "Date & Time", tint: "red" },
  { id: "var-locations", name: "Locations", tint: "blue" },
  { id: "var-system", name: "System", tint: "neutral" },
  { id: "var-text-data", name: "Text & Data", tint: "green" },
  { id: "var-user", name: "User", tint: "blue" },
];
const CATEGORIES: Readonly<Record<string, Omit<AutomatorCategory, "children">>> = {
  ...Object.fromEntries(THIRTEEN.map((category) => [category.id, category])),
  ...Object.fromEntries(VARIABLE_CATEGORIES.map((category) => [category.id, category])),
  finder: realCategory("files"),
  messages: realCategory("internet"),
  notes: realCategory("text"),
  stickies: realCategory("text"),
  reminders: realCategory("calendar"),
  "system-preferences": realCategory("utilities"),
  textedit: realCategory("text"),
  launchpad: realCategory("utilities"),
  "script-editor": realCategory("utilities"),
};

/** The id of the outline's row that lists every action. */
export const SERVED_ROOT = "library";

/** The category an app's actions are listed under; an app with none of its own gets one named
 * after it. */
export function categoryOfApp(app: string): Omit<AutomatorCategory, "children"> {
  const known = CATEGORIES[app];
  if (known) return known;
  const name = app
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
  return { id: `app-${app}`, name: name || "Other", tint: "neutral" };
}

/** The tint of an action's category. */
export function tintOfAction(action: ServerAction | undefined): AutomatorTint {
  return action ? categoryOfApp(action.app).tint : "neutral";
}

/** The Variables library's outline. */
export const VARIABLE_OUTLINE: readonly AutomatorCategory[] = [
  { id: SERVED_ROOT, name: "Variables", tint: "neutral", children: [...VARIABLE_CATEGORIES] },
];

/** The outline for the actions: Library, with Automator's thirteen categories and one for each app
 * they do not hold, in order of name. */
export function servedCategories(actions: readonly ServerAction[]): AutomatorCategory[] {
  const found = new Map<string, Omit<AutomatorCategory, "children">>(
    THIRTEEN.map((category) => [category.id, category]),
  );
  for (const action of actions) {
    const category = categoryOfApp(action.app);
    found.set(category.id, category);
  }
  const children = [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
  return [{ id: SERVED_ROOT, name: "Library", tint: "neutral", children }];
}

/** The outline's rows beside Library, which list by the person's own use. */
export const MOST_USED = "most-used";
export const RECENTLY_ADDED = "recently-added";
const MOST_USED_COUNT = 10;
const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

/** The outline with Most Used and Recently Added under Library, as Automator has them. */
export function libraryOutline(actions: readonly ServerAction[]): AutomatorCategory[] {
  return [
    ...servedCategories(actions),
    { id: MOST_USED, name: "Most Used", tint: "neutral" },
    { id: RECENTLY_ADDED, name: "Recently Added", tint: "neutral" },
  ];
}

/** The actions the person's saved workflows and recent runs use most, the most used first. */
export function mostUsedActions(
  actions: readonly ServerAction[],
  workflows: readonly Workflow[],
  runs: readonly RunLog[],
): ServerAction[] {
  const uses = new Map<string, number>();
  const count = (name: string) => uses.set(name, (uses.get(name) ?? 0) + 1);
  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      const page = step.params[PAGE_STEP];
      count(typeof page === "string" ? page : step.action);
    }
  }
  for (const run of runs) {
    for (const step of run.steps) if (step.status === "completed") count(step.action);
  }
  return actions
    .filter((action) => uses.has(action.name))
    .sort((a, b) => (uses.get(b.name) ?? 0) - (uses.get(a.name) ?? 0))
    .slice(0, MOST_USED_COUNT);
}

/** When the person's library first had each action; 0 for those it had when this began. */
export type SeenActions = Readonly<Record<string, number>>;

/** `seen` with the actions it does not know yet, or `seen` itself when it knows them all. */
export function withNewActions(
  seen: SeenActions | null,
  actions: readonly ServerAction[],
  now: number,
): SeenActions {
  const unknown = actions.filter((action) => seen?.[action.name] === undefined);
  if (seen && unknown.length === 0) return seen;
  const stamp = seen ? now : 0;
  return { ...seen, ...Object.fromEntries(unknown.map((action) => [action.name, stamp])) };
}

/** The actions that came into the library in the last 30 days. */
export function recentlyAddedActions(
  actions: readonly ServerAction[],
  seen: SeenActions | null,
  now: number,
): ServerAction[] {
  return actions.filter((action) => {
    const since = seen?.[action.name];
    return since !== undefined && since > 0 && now - since < RECENT_MS;
  });
}

/** What a row of the outline lists, of which the actions whose title holds the search text, in any
 * letter case: what the server runs, then what the page runs, then what does not run, each in order
 * of title. */
export function listServedActions(
  actions: readonly ServerAction[],
  category: string,
  query: string,
): ServerAction[] {
  const needle = query.trim().toLowerCase();
  const rank = (action: ServerAction) =>
    action.reason ? 2 : action.name.startsWith("page.") ? 1 : 0;
  return actions
    .filter((action) => category === SERVED_ROOT || categoryOfApp(action.app).id === category)
    .filter((action) => needle === "" || action.title.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const x = a.title.toLowerCase();
      const y = b.title.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
}

/* ------------------------------------------------------------------------------------ log */

/** One row of the log. */
export interface LogRow {
  key: string;
  text: string;
  /** The Duration column: empty for a row that took no time of its own. */
  duration: string;
  /** A step that failed, or a run that did not complete. */
  failed?: boolean;
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** What a trigger says in the list of runs. */
export const TRIGGER_TITLES: Readonly<Record<RunTrigger, string>> = {
  manual: "Run",
  "quick-action": "Quick Action",
  application: "Application",
  "folder-action": "Folder Action",
  "calendar-alarm": "Calendar Alarm",
  "dictation-command": "Dictation Command",
};

/**
 * The log of a run: a row for each step with its status, its message or the items it handed on,
 * and its duration; what a Run JavaScript step logged; the workflow's output; then how the run
 * ended, with its whole duration.
 */
export function logRows(run: RunLog): LogRow[] {
  const rows: LogRow[] = [];
  run.steps.forEach((step, index) => {
    const key = `${run.id}:${index}`;
    if (step.status === "failed") {
      rows.push({
        key,
        text: `${step.title} failed: ${oneLine(step.message ?? "no reason was given")}`,
        duration: formatDuration(step.ms),
        failed: true,
      });
    } else if (step.status === "skipped") {
      rows.push({
        key,
        text: `${step.title} skipped${step.message ? `: ${oneLine(step.message)}` : ""}`,
        duration: "",
      });
    } else {
      const shown = step.preview.map(oneLine).join(", ");
      const more =
        step.items > step.preview.length ? ` and ${step.items - step.preview.length} more` : "";
      rows.push({
        key,
        text: `${step.title} completed, ${plural(step.items, "item")}${shown ? `: ${shown}${more}` : ""}`,
        duration: formatDuration(step.ms),
      });
    }
    (step.logs ?? []).forEach((line, logIndex) => {
      rows.push({
        key: `${key}:log:${logIndex}`,
        text: `${step.title} logged: ${oneLine(line)}`,
        duration: "",
      });
    });
  });
  if (run.output.length > 0) {
    rows.push({
      key: `${run.id}:output`,
      text: `Output: ${run.output.map(oneLine).join(", ")}`,
      duration: "",
    });
  }
  rows.push({
    key: `${run.id}:end`,
    text: `Workflow ${run.ok ? "completed" : "failed"}`,
    duration: formatDuration(run.ms),
    failed: !run.ok,
  });
  return rows;
}

/** When a run started, as the list of runs shows it: the time, and the date unless today. */
export function startedText(started: number, now: Date = new Date()): string {
  const at = new Date(started);
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return dayOf(at) === dayOf(now)
    ? time
    : `${at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

/** A run as a row of the list of runs: when, which workflow, what started it and how it ended. */
export function runText(run: RunLog, now: Date = new Date()): string {
  return `${startedText(run.started, now)}  ${run.name || "Untitled"}: ${TRIGGER_TITLES[run.trigger]}, ${run.ok ? "completed" : "failed"}`;
}
