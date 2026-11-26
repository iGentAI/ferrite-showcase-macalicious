"use client";

import { dueAlerts } from "../calendar/calendar-alerts";
import { CALENDAR_EVENTS_URL, documentFromServer } from "../calendar/calendar-server";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import {
  childrenOf,
  currentDrive,
  type Drive,
  type DriveEntry,
  entryOf,
  inTrash,
  loadDrive,
  onDriveChange,
  readFile,
} from "../desktop/desktop-files";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { desktopValues } from "../desktop/desktop-personal";
import {
  currentDesktopSession,
  reloadServerDocuments,
  sessionFetch,
} from "../desktop/desktop-server";
import { listenWhileOpen } from "../desktop/desktop-speech";
import {
  refreshSavedWorkflows,
  savedWorkflows,
  subscribeSavedWorkflows,
} from "./automator-library";
import {
  fileItemOf,
  PAGE_ACTIONS,
  PageFailure,
  type PartsHost,
  readKeptVariables,
  runInParts,
  VARIABLES,
  variableValues,
  withVariables,
} from "./automator-page";
import {
  CLAIM_URL,
  draftFromFile,
  draftFromWorkflow,
  loadActions,
  type RunItem,
  type RunTrigger,
  runWorkflow,
  type ServerAction,
  TRIGGER_TITLES,
  timezoneOffset,
  type Workflow,
  type WorkflowDraft,
  withInput,
  workflowOfDraft,
} from "./automator-server";

/*
 * The document types that run without Run, started by this page: a Quick Action from a menu, an
 * Application's file on opening, a Folder Action when a file arrives in its folder, a Calendar Alarm
 * when its event's alert shows. The last two run only while a desktop of the person is open: the
 * server has no event for them, and a page step needs a page. Every tab and browser of the person
 * sees the same arrival or alert, and the server's claim lets one of them run it.
 */

const NEEDS_WINDOW =
  "It asks you something, which needs Automator's window: run it there with Run.";
/** A Folder Action writing into its own folder would start itself for ever. */
const MOST_RUNS_A_MINUTE = 20;
const ALARM_CHECK_MS = 15_000;

let nextStepKey = 0;
const nextKey = () => {
  nextStepKey += 1;
  return nextStepKey;
};

/** How a run in the background went. */
export interface BackgroundResult {
  ok: boolean;
  /** Why it stopped, when it failed. */
  message?: string;
}

async function actionsByName(): Promise<ReadonlyMap<string, ServerAction>> {
  const actions = await loadActions();
  return new Map([...actions, ...PAGE_ACTIONS].map((action) => [action.name, action]));
}

/** Runs a workflow with no window: what would ask the person fails the run and says so. */
export async function runDraft(
  draft: WorkflowDraft,
  items: readonly RunItem[],
  trigger: RunTrigger,
): Promise<BackgroundResult> {
  try {
    const actions = await actionsByName();
    const running = new Map<string, readonly string[]>();
    const own = readKeptVariables(desktopValues()[VARIABLES])?.[draft.id] ?? [];
    const read = (name: string) => variableValues(name, running, own, new Date());
    const host: PartsHost = {
      session: currentDesktopSession(),
      running,
      read,
      progress: () => undefined,
      stopped: () => false,
      ask: () => Promise.reject(new PageFailure(NEEDS_WINDOW)),
      show: () => Promise.reject(new PageFailure(NEEDS_WINDOW)),
      name: (step) => step.label ?? actions.get(step.action)?.title ?? step.action,
      action: (step) => actions.get(step.action),
      server: async (steps, given) => {
        const part = steps.map((step) => withVariables(step, actions.get(step.action), read));
        const outcome = await runWorkflow(
          withInput(workflowOfDraft({ ...draft, steps: part }, actions), given),
          timezoneOffset(),
          trigger,
        );
        if (outcome.ok) requestDesktopEffects(outcome.run.effects);
        return outcome;
      },
    };
    const done = await runInParts(draft.steps, items, host);
    if (done.ok) return { ok: true };
    return {
      ok: false,
      message: done.rows.find((row) => row.failed)?.text ?? "A step could not finish.",
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Says how a run went: a page shows no menu-bar gear, and a run started by itself has no window. */
async function tell(name: string, trigger: RunTrigger, result: BackgroundResult, on: string) {
  const what = TRIGGER_TITLES[trigger];
  await sessionFetch("/api/notification-center/notify", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      app: "automator",
      title: result.ok ? `${what} “${name}” ran` : `${what} “${name}” did not finish`,
      body: result.ok ? on || undefined : result.message,
    }),
  }).catch((error: unknown) => console.error(error));
}

const namesOf = (items: readonly RunItem[]) => {
  const names = items.map((item) => (typeof item === "string" ? item : item.name));
  if (names.length === 0) return "";
  const first = `“${(names[0] as string).slice(0, 60)}”`;
  return names.length === 1 ? `On ${first}` : `On ${first} and ${names.length - 1} more`;
};

/** Runs a saved workflow on these items and tells the person how it went. */
export async function runAndTell(
  workflow: Workflow,
  items: readonly RunItem[],
  trigger: RunTrigger,
): Promise<BackgroundResult> {
  const result = await runDraft(draftFromWorkflow(workflow, nextKey), items, trigger);
  await tell(workflow.name, trigger, result, namesOf(items));
  return result;
}

/** A Quick Action on what is selected on the drive, by id. */
export async function runOnEntries(workflow: Workflow, ids: readonly string[]) {
  const drive = await loadDrive();
  const items = ids.flatMap((id) => {
    const entry = entryOf(drive, id);
    return entry ? [fileItemOf(drive, entry)] : [];
  });
  return runAndTell(workflow, items, "quick-action");
}

/** A `.app` of the drive, opened. A file this desktop did not write cannot run: it is a Mac's. */
export async function runFile(file: { id: string; name: string }): Promise<BackgroundResult> {
  const name = file.name.replace(/\.app$/i, "");
  let result: BackgroundResult;
  try {
    const draft = draftFromFile(await (await readFile(file.id)).text(), file.name, nextKey);
    result =
      draft?.kind === "application"
        ? await runDraft(draft, [], "application")
        : {
            ok: false,
            message:
              "It is not an application Automator saved on this desktop, and a web page cannot run a Mac's application.",
          };
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  await tell(name, "application", result, "");
  return result;
}

/* ------------------------------------------------------------------- whose run it is */

/** Whether this page is the one to start the run named `key`. */
export async function claimRun(key: string): Promise<boolean> {
  const reply = await sessionFetch(CLAIM_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!reply.ok) return false;
  return ((await reply.json()) as { claimed?: unknown }).claimed === true;
}

/* ----------------------------------------------------------------------- Folder Actions */

/** What is in a watched folder, and what arrived since `seen`; nothing arrives in the Trash. */
export function arrivedIn(
  drive: Drive,
  folder: string,
  seen: ReadonlySet<string> | undefined,
): { arrived: DriveEntry[]; now: Set<string> } {
  const inside = entryOf(drive, folder) && !inTrash(drive, folder) ? childrenOf(drive, folder) : [];
  return {
    arrived: seen ? inside.filter((entry) => !seen.has(entry.id)) : [],
    now: new Set(inside.map((entry) => entry.id)),
  };
}

/* ----------------------------------------------------------------------- Calendar Alarms */

/** The event of a Calendar Alarm: one per workflow, so that saving again adds no other. */
export const alarmEventId = (workflowId: string) => `automator-alarm-${workflowId}`;

/** The next whole hour: an alarm's event starts there until the person moves it in Calendar. */
export function nextHour(now: Date): Date {
  const next = new Date(now);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next;
}

async function readEvents(): Promise<{ events: unknown[]; rev: number; session?: string }> {
  const reply = await sessionFetch(CALENDAR_EVENTS_URL, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!reply.ok) throw new Error(`Calendar answered ${reply.status}`);
  const read = (await reply.json()) as { events?: unknown[] | null; rev: number; session?: string };
  return { events: read.events ?? [], rev: read.rev, session: read.session };
}

/**
 * A Calendar Alarm's event, with an alert at its start, added if it is not there: what the person
 * moves in Calendar to say when it runs. Answers the start of a new event, `null` for one kept.
 */
export async function ensureAlarmEvent(workflow: Workflow, now = new Date()): Promise<Date | null> {
  const id = alarmEventId(workflow.id);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { events, rev, session } = await readEvents();
    if (events.some((event) => (event as { id?: unknown }).id === id)) return null;
    const start = nextHour(now);
    const reply = await sessionFetch(CALENDAR_EVENTS_URL, {
      method: "PUT",
      credentials: "same-origin",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        events: [
          ...events,
          {
            id,
            title: workflow.name,
            start: start.getTime(),
            end: start.getTime() + 30 * 60_000,
            calendar: "home",
            alert: 0,
            notes:
              "Automator's Calendar Alarm: its workflow runs when this alert shows, while this desktop is open.",
          },
        ],
        rev,
        ...(session ? { session } : {}),
      }),
    });
    if (reply.ok) {
      reloadServerDocuments("calendar");
      return start;
    }
    if (reply.status !== 409) throw new Error(`Calendar answered ${reply.status}`);
  }
  throw new Error("Calendar kept changing");
}

/** The Calendar Alarms whose event's alert shows now, each with the occurrence that names the run. */
export function alarmsDue(
  workflows: readonly Workflow[],
  reply: unknown,
  now: number,
): { workflow: Workflow; occurrence: string }[] {
  const alarms = workflows.filter((each) => each.kind === "calendar-alarm" && each.enabled);
  if (alarms.length === 0) return [];
  const due = dueAlerts(documentFromServer(reply)?.events ?? [], now);
  return alarms.flatMap((workflow) =>
    due
      .filter((alert) => alert.id === alarmEventId(workflow.id))
      .map((alert) => ({ workflow, occurrence: alert.key })),
  );
}

/** Whether what was said is a Dictation Command's name: its case and end stop do not count. */
export function isSaidName(said: string, name: string): boolean {
  const plain = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[.!?,]+$/, "");
  return plain(said) === plain(name);
}

/* -------------------------------------------------------------------------- the watching */

/**
 * Starts watching for the arrivals and alerts of the saved workflows, for as long as this page is
 * open. Files that arrived while no page was open do not count: nothing saw them arrive. Returns
 * the cleanup.
 */
export function startBackgroundWorkflows(): () => void {
  const seen = new Map<string, { folder: string; ids: ReadonlySet<string> }>();
  const started = new Map<string, number[]>();
  let queue: Promise<unknown> = Promise.resolve();

  /** One run after another, and a workflow that keeps starting itself is stopped, saying so. */
  const start = (workflow: Workflow, items: readonly RunItem[], trigger: RunTrigger) => {
    const now = Date.now();
    const recent = (started.get(workflow.id) ?? []).filter((at) => now - at < 60_000);
    if (recent.length >= MOST_RUNS_A_MINUTE) {
      if (recent.length === MOST_RUNS_A_MINUTE) {
        void tell(
          workflow.name,
          trigger,
          {
            ok: false,
            message: `It started ${MOST_RUNS_A_MINUTE} times in a minute: is it adding to its own folder?`,
          },
          "",
        );
      }
      started.set(workflow.id, [...recent, now]);
      return;
    }
    started.set(workflow.id, [...recent, now]);
    queue = queue.then(() => runAndTell(workflow, items, trigger)).catch(console.error);
  };

  const folderActions = () =>
    savedWorkflows().filter(
      (each): each is Workflow & { folder: string } =>
        each.kind === "folder-action" && each.enabled && Boolean(each.folder),
    );

  const scan = (drive: Drive | null) => {
    if (!drive) return;
    const actions = folderActions();
    for (const id of seen.keys()) {
      if (!actions.some((each) => each.id === id)) seen.delete(id);
    }
    for (const workflow of actions) {
      const before = seen.get(workflow.id);
      const known = before?.folder === workflow.folder ? before.ids : undefined;
      const { arrived, now } = arrivedIn(drive, workflow.folder, known);
      seen.set(workflow.id, { folder: workflow.folder, ids: now });
      if (arrived.length === 0) continue;
      void Promise.all(
        arrived.map(async (entry) =>
          (await claimRun(`folder:${workflow.id}:${entry.id}:${entry.modified_ms}`)) ? entry : null,
        ),
      )
        .then((claimed) => {
          const mine = claimed.flatMap((entry) => (entry ? [fileItemOf(drive, entry)] : []));
          if (mine.length > 0) start(workflow, mine, "folder-action");
        })
        .catch(console.error);
    }
  };

  const checkAlarms = async () => {
    const list = savedWorkflows();
    if (!list.some((each) => each.kind === "calendar-alarm" && each.enabled)) return;
    const due = alarmsDue(list, await readEvents(), Date.now());
    for (const { workflow, occurrence } of due) {
      if (await claimRun(`alarm:${workflow.id}:${occurrence}`)) {
        start(workflow, [], "calendar-alarm");
      }
    }
  };
  const checkAlarmsQuietly = () => void checkAlarms().catch(console.error);

  const readDrive = () => {
    if (folderActions().length > 0) void loadDrive().catch(console.error);
  };
  const heard = (event: Event) => {
    const app = (event as CustomEvent<{ app?: string }>).detail?.app;
    if (app === "files") readDrive();
    if (app === "calendar") checkAlarmsQuietly();
  };

  // Dictation Commands: heard through one recognizer, only while one is saved and enabled. The
  // ten-second key keeps a second tab that heard the same words from running it again.
  const dictated = () =>
    savedWorkflows().filter((each) => each.kind === "dictation-command" && each.enabled);
  let stopHearing: (() => void) | null = null;
  const hear = (said: string) => {
    for (const workflow of dictated()) {
      if (!isSaidName(said, workflow.name)) continue;
      void claimRun(`dictation:${workflow.id}:${Math.floor(Date.now() / 10_000)}`)
        .then((mine) => {
          if (mine) start(workflow, [], "dictation-command");
        })
        .catch(console.error);
    }
  };
  const followDictated = () => {
    if (dictated().length > 0 && !stopHearing) {
      stopHearing = listenWhileOpen({
        hear,
        refused: () => {
          stopHearing = null;
        },
      });
    } else if (dictated().length === 0 && stopHearing) {
      stopHearing();
      stopHearing = null;
    }
  };

  window.addEventListener(SERVER_CHANGE_EVENT, heard);
  const stopDrive = onDriveChange(scan);
  const stopWorkflows = subscribeSavedWorkflows(() => {
    if (folderActions().length > 0 && !currentDrive()) readDrive();
    scan(currentDrive());
    checkAlarmsQuietly();
    followDictated();
  });
  void refreshSavedWorkflows();
  const timer = window.setInterval(checkAlarmsQuietly, ALARM_CHECK_MS);
  return () => {
    window.removeEventListener(SERVER_CHANGE_EVENT, heard);
    stopDrive();
    stopWorkflows();
    window.clearInterval(timer);
    stopHearing?.();
  };
}
