import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import { copyText, FileShareItems } from "../desktop/desktop-share-link";
import { Console, type ConsoleFeed, type ConsoleLayout, type ConsoleProps } from "./console";
import {
  COLUMNS,
  type ConsoleLogFile,
  type ConsoleMessage,
  type ConsoleMessageType,
  type ConsoleReportId,
  type ConsoleSourceId,
  copyableMessages,
  logFileSource,
  SEARCH_COMPARISONS,
  SEARCH_FIELDS,
  SOURCES,
} from "./console-data";

/**
 * Console's log as its module of the `macalicious-desktop` Ferrite application serves it
 * (`ferrite-apps/desktop/src/apps/console`): `GET` answers `{ entries }`, the newest entries of
 * the application's own log, oldest first.
 */
export const CONSOLE_LOG_URL = "/api/console/log";

/** The device's name in the sidebar when the desktop application serves the window. */
export const DESKTOP_DEVICE_NAME = "macalicious-desktop";

/** One entry of the application's log, as the module answers it. */
export interface LogEntry {
  id: number;
  at_ms: number;
  level: string;
  process: string;
  category: string;
  message: string;
}

const LEVELS: readonly ConsoleMessageType[] = ["default", "info", "debug", "error", "fault"];

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

const isEntry = (value: unknown): value is LogEntry => {
  const entry = value as Record<string, unknown> | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    Number.isSafeInteger(entry.id) &&
    Number.isSafeInteger(entry.at_ms) &&
    typeof entry.level === "string" &&
    typeof entry.process === "string" &&
    typeof entry.category === "string" &&
    typeof entry.message === "string"
  );
};

/**
 * An entry as a row of the window: its time in the page's zone, written as Console writes it
 * ("2026-10-12", "15:07:45.459000+0200"). The log records no process id, thread or activity,
 * so those are 0, which the detail pane says, and the subsystem is the application's name.
 */
export function toMessage(entry: LogEntry): ConsoleMessage {
  const at = new Date(entry.at_ms);
  const offset = -at.getTimezoneOffset();
  const zone = `${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}${pad(Math.abs(offset) % 60)}`;
  return {
    id: entry.id,
    type: LEVELS.find((level) => level === entry.level) ?? "default",
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}.${pad(at.getMilliseconds(), 3)}000${zone}`,
    process: entry.process,
    pid: 0,
    thread: 0,
    activity: 0,
    subsystem: DESKTOP_DEVICE_NAME,
    category: entry.category,
    message: entry.message,
  };
}

/** The rows of a `GET` reply, or `undefined` when it is not the module's. */
export function messagesFromServer(reply: unknown): readonly ConsoleMessage[] | undefined {
  const entries = (reply as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) return undefined;
  return entries.filter(isEntry).map(toMessage);
}

/** Errors this page has met since Console's code loaded, the newest 200, newest last. */
let pageErrors: readonly ConsoleMessage[] = [];
const pageErrorListeners = new Set<() => void>();
const MAX_PAGE_ERRORS = 200;
/** Above any id of the server's log, which counts up from 1. */
const PAGE_ERROR_IDS = 2 ** 52;
let pageErrorsHeard = 0;

function hearPageError(category: string, message: string): void {
  const heard = toMessage({
    id: PAGE_ERROR_IDS + pageErrorsHeard,
    at_ms: Date.now(),
    level: "error",
    process: "This Page",
    category,
    message,
  });
  pageErrorsHeard += 1;
  pageErrors = [...pageErrors, heard].slice(-MAX_PAGE_ERRORS);
  for (const listener of pageErrorListeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => hearPageError("error", event.message));
  window.addEventListener("unhandledrejection", (event) =>
    hearPageError("unhandledrejection", String(event.reason)),
  );
}

/** The feed of the served window: the module's log, read every two seconds (rows already read stay when it cannot be read), and this page's own errors. */
export const consoleFeed: ConsoleFeed = {
  interval: 2000,
  read: serverLog,
  local: {
    firstId: PAGE_ERROR_IDS,
    get: () => pageErrors,
    subscribe: (listener) => {
      pageErrorListeners.add(listener);
      return () => pageErrorListeners.delete(listener);
    },
  },
};

/** The server's log, or nothing when it cannot be read. */
async function serverLog(): Promise<readonly ConsoleMessage[] | undefined> {
  try {
    const response = await sessionFetch(CONSOLE_LOG_URL, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    return response.ok ? messagesFromServer(await response.json()) : undefined;
  } catch {
    return undefined;
  }
}

/* The report sources hold nothing on Ferrite: the application has no crash, spin or system log. */
const NO_REPORTS: Readonly<Record<ConsoleReportId, readonly ConsoleMessage[]>> = {
  "crash-reports": [],
  "spin-reports": [],
  "log-reports": [],
  "diagnostic-reports": [],
  "mac-analytics-data": [],
  "system-log": [],
};

const NO_REPORTS_NOTE =
  "This desktop runs in a browser: it keeps no crash, spin or system logs. Its own log is under the device.";

const NO_LAYOUT: Partial<ConsoleLayout> = {};

/** The longest search kept: what is typed beyond it still searches, for this visit. */
const MAX_KEPT_QUERY = 200;

/** Only what the window can show is taken from what is stored. */
export function readLayout(stored: unknown): Partial<ConsoleLayout> | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const {
    source,
    scope,
    infoShown,
    sidebarSize,
    includeInfo,
    includeDebug,
    query,
    following,
    toolbarHidden,
    logFiles,
    columns,
    savedSearches,
    searchField,
    searchComparison,
  } = stored as Partial<Record<keyof ConsoleLayout, unknown>>;
  const layout: Partial<ConsoleLayout> = {};
  if (Array.isArray(columns)) {
    const shown = COLUMNS.filter((column) => columns.includes(column.id)).map(({ id }) => id);
    // The message column always stays.
    layout.columns = shown.includes("message") ? shown : [...shown, "message"];
  }
  if (Array.isArray(savedSearches)) {
    layout.savedSearches = savedSearches.filter((saved) => typeof saved === "string");
  }
  const files = Array.isArray(logFiles)
    ? logFiles.filter(
        (file): file is ConsoleLogFile =>
          typeof file?.id === "string" && typeof file?.name === "string",
      )
    : [];
  if (files.length > 0) layout.logFiles = files;
  if (files.some((file) => logFileSource(file.id) === source)) {
    layout.source = source as ConsoleSourceId;
  }
  const known = SOURCES.find((entry) => entry.id === source);
  if (known) layout.source = known.id;
  if (scope === "all" || scope === "errors") layout.scope = scope;
  if (typeof infoShown === "boolean") layout.infoShown = infoShown;
  if (typeof sidebarSize === "number" && sidebarSize >= 0 && sidebarSize <= 600)
    layout.sidebarSize = sidebarSize;
  if (typeof includeInfo === "boolean") layout.includeInfo = includeInfo;
  if (typeof includeDebug === "boolean") layout.includeDebug = includeDebug;
  if (typeof query === "string" && query.length <= MAX_KEPT_QUERY) layout.query = query;
  if (typeof following === "boolean") layout.following = following;
  if (typeof toolbarHidden === "boolean") layout.toolbarHidden = toolbarHidden;
  const field = SEARCH_FIELDS.find(([id]) => id === searchField);
  if (field) layout.searchField = field[0];
  const comparison = SEARCH_COMPARISONS.find(([id]) => id === searchComparison);
  if (comparison) layout.searchComparison = comparison[0];
  return layout;
}

/** A message goes to Mail, Messages or Notes as a text file, or is copied. */
function shareItems(messages: readonly ConsoleMessage[]) {
  const text = copyableMessages(messages);
  const file = new Blob([text], { type: "text/plain" });
  return (
    <>
      <FileShareItems
        from="console"
        items={[
          {
            id: "console-messages",
            name: "Console Messages.txt",
            kind: "file",
            type: file.type,
            size: file.size,
            bytes: async () => file,
          },
        ]}
      />
      <MenuSeparator />
      <MenuItem onClick={() => void copyText(text)}>Copy Message</MenuItem>
    </>
  );
}

function ServedConsole(props: ConsoleProps) {
  const [values, setValues] = useDesktopSetting("console.layout", readLayout, NO_LAYOUT);
  return (
    <Console
      {...props}
      feed={consoleFeed}
      deviceName={DESKTOP_DEVICE_NAME}
      reports={NO_REPORTS}
      noReportsNote={NO_REPORTS_NOTE}
      defaultSelectedId={undefined}
      shareItems={shareItems}
      layout={{
        values,
        // A wheel or a scroll says the same again and again: only a change is saved.
        change: (patch) => {
          const kept =
            patch.query === undefined
              ? patch
              : { ...patch, query: patch.query.slice(0, MAX_KEPT_QUERY) };
          const changed = (Object.keys(kept) as (keyof ConsoleLayout)[]).some(
            (key) => kept[key] !== values[key],
          );
          if (changed) setValues({ ...values, ...kept });
        },
      }}
    />
  );
}

/**
 * Console as the desktop shows it. When the `macalicious-desktop` Ferrite application serves
 * the desktop (`servedByDesktopApp()`), the device is the application and its messages are the
 * application's own log, read from the server when the window opens, every two seconds and on
 * Reload; the report sources are empty; the source, scope, layout and levels are kept for the
 * account. Every other build shows the invented messages, as `Console` does.
 */
export function DesktopConsole(props: ConsoleProps) {
  if (!servedByDesktopApp()) return <Console {...props} />;
  return <ServedConsole {...props} />;
}
