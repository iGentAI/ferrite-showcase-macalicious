/*
 * The Console demo's data and state: the sources of the sidebar, the messages each lists,
 * and the pure functions the window is built on (filter, sort, clear, reload, receive). Nothing
 * is read from the machine the page runs on: every message is invented, except the rows and
 * the detail text that the two reference captures show, which are reproduced as captured.
 */

/** A message's level, in the order the Type column sorts them. */
export type ConsoleMessageType = "default" | "info" | "debug" | "error" | "fault";

export interface ConsoleMessage {
  /** Identifies the message in its source: the selection is kept by it. */
  id: number;
  type: ConsoleMessageType;
  /** The day, as the detail pane shows it: "2019-10-03". */
  date: string;
  /** The time of day with microseconds and the zone: "15:07:45.459156-0500". */
  time: string;
  /** Name of the process that logged the message. */
  process: string;
  /** Its process identifier. */
  pid: number;
  /** Identifier of the logging thread. */
  thread: number;
  /** Identifier of the activity the message belongs to; 0 for none. */
  activity: number;
  /** The logging subsystem; empty when the message names none. */
  subsystem: string;
  /** The category in the subsystem; empty when the message names none. */
  category: string;
  /** The text. */
  message: string;
}

/** A row of the sidebar: the device, one of the report sources, or a log file of the person's drive. */
export type ConsoleSourceId =
  | "device"
  | "crash-reports"
  | "spin-reports"
  | "log-reports"
  | "diagnostic-reports"
  | "mac-analytics-data"
  | "system-log"
  | `log-file:${string}`;

export type ConsoleReportId = Exclude<ConsoleSourceId, "device" | `log-file:${string}`>;

/** A log file opened from the drive, by its drive id and name. */
export interface ConsoleLogFile {
  id: string;
  name: string;
}

export const logFileSource = (id: string): ConsoleSourceId => `log-file:${id}`;

/** The drive id of the log file a source lists, if it is one. */
export const logFileOf = (source: ConsoleSourceId): string | undefined =>
  source.startsWith("log-file:") ? source.slice("log-file:".length) : undefined;

/** The stand-in glyph of a sidebar row. */
export type ConsoleSourceIcon = "laptop" | "warning" | "spin" | "log" | "tools" | "chart" | "file";

export interface ConsoleSource {
  id: ConsoleReportId | "device";
  /** The row's label. */
  title: string;
  /** The section of the sidebar the row is in. */
  section: "Devices" | "Reports";
  icon: ConsoleSourceIcon;
}

/** The sidebar of both captures, in order. */
export const SOURCES: readonly ConsoleSource[] = [
  { id: "device", title: "ismh15", section: "Devices", icon: "laptop" },
  { id: "crash-reports", title: "Crash Reports", section: "Reports", icon: "warning" },
  { id: "spin-reports", title: "Spin Reports", section: "Reports", icon: "spin" },
  { id: "log-reports", title: "Log Reports", section: "Reports", icon: "log" },
  { id: "diagnostic-reports", title: "Diagnostic Reports", section: "Reports", icon: "tools" },
  { id: "mac-analytics-data", title: "Mac Analytics Data", section: "Reports", icon: "chart" },
  { id: "system-log", title: "system.log", section: "Reports", icon: "file" },
];

/** The columns of the message table. The widths include the 1 pt separator after a heading. */
export const COLUMNS = [
  { id: "type", title: "Type", width: 53 },
  { id: "time", title: "Time", width: 173 },
  { id: "process", title: "Process", width: 63 },
  { id: "subsystem", title: "Subsystem", width: 140 },
  { id: "category", title: "Category", width: 100 },
  { id: "message", title: "Message", width: undefined },
] as const;

export type ConsoleColumnId = (typeof COLUMNS)[number]["id"];

/** The columns of both captures: the others are a person's to add. */
export const DEFAULT_COLUMNS: readonly ConsoleColumnId[] = ["type", "time", "process", "message"];

export interface ConsoleSort {
  column: string;
  direction: "ascending" | "descending";
}

/** What the scope bar narrows the list to. */
export type ConsoleScope = "all" | "errors";

/** What the Type column shows and announces for a level; a default message shows nothing. */
export const TYPE_NAMES: Record<ConsoleMessageType, string> = {
  default: "Default",
  info: "Info",
  debug: "Debug",
  error: "Error",
  fault: "Fault",
};

const TYPE_ORDER: Record<ConsoleMessageType, number> = {
  default: 0,
  info: 1,
  debug: 2,
  error: 3,
  fault: 4,
};

/* Times. Every message of the demo is in one zone, so a date and a time order as text. */

const ZONE = "-0500";
const DAY = 86_400_000_000;
const pad = (value: number, width: number) => String(value).padStart(width, "0");

/** "15:07:45.459156-0500" for a count of microseconds since midnight. */
export function formatTime(microseconds: number): string {
  const inDay = ((Math.floor(microseconds) % DAY) + DAY) % DAY;
  const seconds = Math.floor(inDay / 1_000_000);
  const clock = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => pad(part, 2))
    .join(":");
  return `${clock}.${pad(inDay % 1_000_000, 6)}${ZONE}`;
}

/** Microseconds since midnight of a time written by `formatTime`. */
export function parseTime(time: string): number {
  const [hours, minutes, seconds, fraction] = [0, 3, 6, 9].map((at, index) =>
    Number(time.slice(at, at + (index === 3 ? 6 : 2))),
  );
  return (((hours ?? 0) * 60 + (minutes ?? 0)) * 60 + (seconds ?? 0)) * 1_000_000 + (fraction ?? 0);
}

/** The date and time of a message as the detail pane shows them; it also orders messages. */
export const timestamp = (message: ConsoleMessage) => `${message.date} ${message.time}`;

/** "Console (9,318 messages)": the window's title for the number of messages listed. */
export function windowTitle(count: number): string {
  return `Console (${count.toLocaleString("en-US")} ${count === 1 ? "message" : "messages"})`;
}

/* Invented messages. One generator step per number, so every run shows the same list. */

const step = (seed: number) => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
const hex = (value: number) => `0x${value.toString(16)}`;

interface Template {
  /** How often the template is drawn, out of the sum of all weights. */
  weight: number;
  type: ConsoleMessageType;
  process: string;
  pid: number;
  subsystem: string;
  category: string;
  /** Whether the message belongs to an activity. */
  traced?: boolean;
  text: (a: number, b: number) => string;
}

const TEMPLATES: readonly Template[] = [
  {
    weight: 22,
    type: "default",
    process: "hidd",
    pid: 99,
    subsystem: "com.apple.iohid",
    category: "default",
    text: (a, b) =>
      `[HID] [MT] dispatchEvent Dispatching event with ${1 + (a % 4)} children, _eventMask=${hex(2 + 2 * (b % 3))}`,
  },
  {
    weight: 12,
    type: "default",
    process: "tccd",
    pid: 259,
    subsystem: "com.apple.TCC",
    category: "access",
    traced: true,
    text: (a, b) => `PID[259] is checking access for target PID[${300 + (a % 1700)}] (${b % 9})`,
  },
  {
    weight: 12,
    type: "default",
    process: "kernel",
    pid: 0,
    subsystem: "",
    category: "",
    text: (a, b) =>
      `Sandbox: example_helper(${400 + (a % 900)}) allow file-read-data ${hex(b % 4096)}`,
  },
  {
    weight: 10,
    type: "default",
    process: "mds",
    pid: 73,
    subsystem: "com.apple.spotlightserver",
    category: "QueryTask",
    traced: true,
    text: (a, b) =>
      `directQueryFetchResultsReply ${200000 + (a % 9000)} ${b} ${a % 40} at qos 0x15`,
  },
  {
    weight: 9,
    type: "default",
    process: "WindowServer",
    pid: 205,
    subsystem: "com.apple.SkyLight",
    category: "default",
    text: (a, b) => `Example surface ${hex(a % 65536)} updated ${1 + (b % 12)} windows`,
  },
  {
    weight: 8,
    type: "default",
    process: "deleted",
    pid: 311,
    subsystem: "com.apple.cache_delete",
    category: "daemon",
    traced: true,
    text: (a, b) => `com.example.cache-service-${a % 7} : ${b % 4096}`,
  },
  {
    weight: 7,
    type: "info",
    process: "locationd",
    pid: 84,
    subsystem: "com.apple.locationd.Core",
    category: "Client",
    text: (a, b) =>
      `Client com.example.weather keeps interval ${5 + (a % 55)} s, sequence ${b % 1000}`,
  },
  {
    weight: 6,
    type: "debug",
    process: "bluetoothd",
    pid: 121,
    subsystem: "com.apple.bluetooth",
    category: "Server.Core",
    text: (a, b) => `Scan cycle ${a % 5000} finished with ${b % 24} advertisements`,
  },
  {
    weight: 5,
    type: "info",
    process: "powerd",
    pid: 56,
    subsystem: "com.apple.powerd",
    category: "sleepWake",
    text: (a, b) => `Idle timer reset by pid ${100 + (a % 1900)} after ${b % 600} s`,
  },
  {
    weight: 4,
    type: "error",
    process: "nsurlsessiond",
    pid: 342,
    subsystem: "com.apple.CFNetwork",
    category: "Summary",
    traced: true,
    text: (a, b) =>
      `Task <${hex(a)}>.<${1 + (b % 40)}> finished with error [-1001] The request timed out.`,
  },
  {
    weight: 3,
    type: "error",
    process: "coreaudiod",
    pid: 139,
    subsystem: "com.apple.coreaudio",
    category: "AMCP",
    text: (a, b) => `Example IO context ${a % 64} skipped a cycle of ${256 << (b % 3)} frames`,
  },
  {
    weight: 2,
    type: "fault",
    process: "launchd",
    pid: 1,
    subsystem: "com.apple.xpc.launchd",
    category: "default",
    text: (a, b) =>
      `Service com.example.helper-${a % 9} exited with abnormal code: ${1 + (b % 78)}`,
  },
];

const WEIGHT = TEMPLATES.reduce((sum, template) => sum + template.weight, 0);

/** One invented message: a function of the seed alone. */
function invent(seed: number, id: number, date: string, microseconds: number): ConsoleMessage {
  const pick = step(seed);
  const a = step(pick);
  const b = step(a);
  let at = (pick >>> 8) % WEIGHT;
  // The weights sum to WEIGHT, so a template is always found; the last one is the fallback.
  const template =
    TEMPLATES.find((candidate) => {
      at -= candidate.weight;
      return at < 0;
    }) ?? (TEMPLATES[TEMPLATES.length - 1] as Template);
  return {
    id,
    type: template.type,
    date,
    time: formatTime(microseconds),
    process: template.process,
    pid: template.pid,
    thread: 0x300 + ((a >>> 4) % 0x9000),
    activity: template.traced ? 0x8000 + ((b >>> 6) % 0x4000) : 0,
    subsystem: template.subsystem,
    category: template.category,
    message: template.text(a >>> 3, b >>> 3),
  };
}

/** A captured row or detail: a message before it has its place and identifier in a list. */
type Captured = Omit<ConsoleMessage, "id" | "date">;

/**
 * A device list that ends as a capture does: `count` messages in order of time, of which the
 * last are `tail` and one, earlier, is `pinned` (the message the capture's detail pane
 * shows). The rest are invented backwards from the tail, at most `pace` microseconds apart.
 */
function captureList(options: {
  count: number;
  date: string;
  tail: readonly Captured[];
  pinned: Captured;
  pace: number;
  seed: number;
}): ConsoleMessage[] {
  const { count, date, tail, pinned, pace } = options;
  const invented: ConsoleMessage[] = [];
  let seed = options.seed;
  let time = parseTime(tail[0]?.time ?? "12:00:00.000000");
  for (let index = count - tail.length - 1; index > 0; index--) {
    seed = step(seed);
    time -= 200 + ((seed >>> 7) % pace);
    invented.push(invent(seed, 0, date, time));
  }
  invented.reverse();
  const place = invented.findIndex((message) => message.time > pinned.time);
  const before = place < 0 ? invented : invented.slice(0, place);
  const after = place < 0 ? [] : invented.slice(place);
  return [
    ...before,
    { ...pinned, id: 0, date },
    ...after,
    ...tail.map((row) => ({ ...row, id: 0, date })),
  ].map((message, index) => ({ ...message, id: index + 1 }));
}

const HIDD = { process: "hidd", pid: 99, subsystem: "com.apple.iohid", category: "default" };
const TCCD = { process: "tccd", pid: 259, subsystem: "com.apple.TCC", category: "access" };
const plain = { type: "default", activity: 0 } as const;

/*
 * The rows of the light capture, as captured up to where the window cuts them off; what follows
 * the cut is invented. The first is the row that shows through the header.
 */
const LIGHT_TAIL: readonly Captured[] = [
  {
    ...plain,
    ...HIDD,
    time: "15:07:45.395745-0500",
    thread: 0x6b1,
    message:
      "[HID] [MT] dispatchEvent Dispatching event with 3 children, _eventMask=0x6 _childEventMask=0x6 Cancel=0 Touching=3 inRange=3",
  },
  {
    ...plain,
    ...HIDD,
    time: "15:07:45.459156-0500",
    thread: 0x6b1,
    message:
      "[HID] [MT] dispatchEvent Dispatching event with 4 children, _eventMask=0x6 _childEventMask=0x6 Cancel=0 Touching=4 inRange=4",
  },
  {
    ...plain,
    ...TCCD,
    time: "15:07:45.585396-0500",
    thread: 0x1c44,
    activity: 0x8f21,
    message: "PID[259] is checking access for target PID[1835]",
  },
  {
    ...plain,
    ...TCCD,
    time: "15:07:45.585726-0500",
    thread: 0x1c44,
    activity: 0x8f21,
    message:
      "Granting PID[1835] access to kTCCServiceScreenCapture via entitlement 'com.example.private.screen-capture'",
  },
  {
    ...plain,
    process: "kernel",
    pid: 0,
    subsystem: "",
    category: "",
    time: "15:07:45.609615-0500",
    thread: 0x2f0,
    message:
      "[IGFB][INFO   ] [Flip_Transaction] CCS Param update: AuxOffset:0x0 AuxStride:0x0 AuxSize:0x0",
  },
  {
    ...plain,
    ...HIDD,
    time: "15:07:45.684375-0500",
    thread: 0x6b1,
    message:
      "[HID] [MT] dispatchEvent Dispatching event with 3 children, _eventMask=0x6 _childEventMask=0x6 Cancel=0 Touching=3 inRange=3",
  },
];

/** The message the light capture's detail pane shows. */
const LIGHT_PINNED: Captured = {
  type: "default",
  time: "15:07:40.886354-0500",
  process: "deleted",
  pid: 311,
  thread: 0x1a07,
  activity: 0x8c40,
  subsystem: "com.apple.cache_delete",
  category: "daemon",
  message: "com.apple.coresymbolicationd.cache-delete : 0",
};

const REPORT_CRASH = { process: "ReportCrash", pid: 1213, subsystem: "", category: "" };
const DISTNOTED = {
  process: "distnoted",
  pid: 421,
  subsystem: "com.apple.distnoted",
  category: "diagnostic",
};

/** The rows of the dark capture, the first being the one that shows through the header. */
const DARK_TAIL: readonly Captured[] = [
  {
    ...plain,
    ...DISTNOTED,
    time: "10:38:48.845458-0500",
    thread: 0x9d2,
    message:
      "register name: DictationIMNotificationStartedListening object: kCFNotificationAnyObject token: 2c0000001e pid: 1198",
  },
  {
    ...plain,
    ...REPORT_CRASH,
    time: "10:38:48.942671-0500",
    thread: 0x2b3c,
    message:
      "Memory Resource Exception log for MTLCompilerService [1214] saved at /var/example/MTLCompilerService_1214.memgraph",
  },
  {
    ...plain,
    ...REPORT_CRASH,
    time: "10:38:48.942815-0500",
    thread: 0x2b3c,
    message: "SDRDiagnosticReporter is disabled.",
  },
  {
    ...plain,
    ...REPORT_CRASH,
    time: "10:38:48.942946-0500",
    thread: 0x2b3c,
    message:
      "Symptoms Diagnostic Reporter rejected the memory resource exception with reason: reporting is disabled",
  },
  {
    ...plain,
    ...DISTNOTED,
    time: "10:38:48.967999-0500",
    thread: 0x9d2,
    message:
      "register name: com.apple.Carbon.TISNotifySelectedKeyboardInputSourceChanged object: kCFNotificationAnyObject token: 2d0000001f pid: 1198",
  },
  {
    ...plain,
    ...HIDD,
    time: "10:38:49.069323-0500",
    thread: 0x6b1,
    message:
      "[HID] [MT] dispatchEvent Dispatching event with 3 children, _eventMask=0x2 _childEventMask=0x2 Cancel=0 Touching=3 inRange=3",
  },
];

/** The message the dark capture's detail pane shows. */
const DARK_PINNED: Captured = {
  type: "default",
  time: "10:38:45.878798-0500",
  process: "mds",
  pid: 73,
  thread: 0x15e0,
  activity: 0x9a12,
  subsystem: "com.apple.spotlightserver",
  category: "QueryTask",
  message: "directQueryFetchResultsReply 208975 1795162112 35 at qos 0x15",
};

/**
 * The device's messages of the light capture, 9,318 as its title counts them: the window's
 * default list. It ends with the capture's rows.
 */
export const defaultMessages: readonly ConsoleMessage[] = captureList({
  count: 9318,
  date: "2019-10-03",
  tail: LIGHT_TAIL,
  pinned: LIGHT_PINNED,
  pace: 9000,
  seed: 2019,
});

/** The message the light capture has selected, which its detail pane shows. */
export const defaultSelectedId =
  defaultMessages.find((message) => message.time === LIGHT_PINNED.time)?.id ?? 0;

/** The device's messages of the dark capture, 86 as its title counts them. */
export const darkCaptureMessages: readonly ConsoleMessage[] = captureList({
  count: 86,
  date: "2019-10-04",
  tail: DARK_TAIL,
  pinned: DARK_PINNED,
  pace: 150_000,
  seed: 1004,
});

/** The message the dark capture has selected. */
export const darkCaptureSelectedId =
  darkCaptureMessages.find((message) => message.time === DARK_PINNED.time)?.id ?? 0;

/* Reports. A report source lists its entries in the same four columns; all are invented. */

const FIRST_REPORT_ID = 1_000_000;

function reportList(
  source: number,
  type: ConsoleMessageType,
  entries: readonly (readonly [date: string, time: string, process: string, message: string])[],
): ConsoleMessage[] {
  return entries.map(([date, time, process, message], index) => ({
    id: FIRST_REPORT_ID + source * 1000 + index,
    type,
    date,
    time: `${time}${ZONE}`,
    process,
    pid: 200 + source * 37 + index * 11,
    thread: 0x400 + source * 0x111 + index * 7,
    activity: 0,
    subsystem: "",
    category: "",
    message,
  }));
}

/** What each report source lists. */
export const defaultReports: Readonly<Record<ConsoleReportId, readonly ConsoleMessage[]>> = {
  "crash-reports": reportList(1, "fault", [
    ["2019-09-27", "09:14:22.104118", "Notes", "Notes_2019-09-27-091422_ismh15.crash"],
    ["2019-09-30", "18:12:04.550731", "Preview", "Preview_2019-09-30-181204_ismh15.crash"],
    ["2019-10-01", "11:03:51.008264", "mdworker", "mdworker_2019-10-01-110351_ismh15.crash"],
    ["2019-10-02", "16:40:09.771902", "Finder", "Finder_2019-10-02-164009_ismh15.crash"],
    ["2019-10-03", "08:55:37.316440", "Calendar", "Calendar_2019-10-03-085537_ismh15.crash"],
  ]),
  "spin-reports": reportList(2, "error", [
    ["2019-09-29", "14:21:16.402210", "Safari", "Safari_2019-09-29-142116_ismh15.spin"],
    ["2019-10-01", "10:07:43.918033", "Mail", "Mail_2019-10-01-100743_ismh15.spin"],
    ["2019-10-02", "21:30:58.120677", "Photos", "Photos_2019-10-02-213058_ismh15.spin"],
  ]),
  "log-reports": reportList(3, "default", [
    ["2019-09-26", "07:02:11.000412", "installd", "install.log"],
    ["2019-09-28", "12:45:30.219870", "airportd", "wifi.log"],
    ["2019-09-30", "03:15:02.660154", "fsck_apfs", "fsck_apfs.log"],
    ["2019-10-02", "19:08:47.345009", "socketfilterfw", "appfirewall.log"],
    ["2019-10-03", "06:00:00.871236", "newsyslog", "daily.out"],
    ["2019-10-03", "06:00:04.127751", "newsyslog", "weekly.out"],
  ]),
  "diagnostic-reports": reportList(4, "default", [
    ["2019-09-29", "03:15:02.480019", "powerstats", "powerstats_2019-09-29-031502_ismh15.diag"],
    ["2019-10-01", "03:15:01.932845", "powerstats", "powerstats_2019-10-01-031501_ismh15.diag"],
    [
      "2019-10-02",
      "13:26:44.571306",
      "backupd",
      "backupd_2019-10-02-132644_ismh15.cpu_resource.diag",
    ],
    ["2019-10-03", "03:15:03.204468", "powerstats", "powerstats_2019-10-03-031503_ismh15.diag"],
  ]),
  "mac-analytics-data": reportList(5, "info", [
    [
      "2019-09-30",
      "08:00:00.115203",
      "analyticsd",
      "Analytics_2019-09-30-080000_ismh15.core_analytics",
    ],
    [
      "2019-10-01",
      "08:00:00.098771",
      "analyticsd",
      "Analytics_2019-10-01-080000_ismh15.core_analytics",
    ],
    [
      "2019-10-02",
      "08:00:00.130465",
      "analyticsd",
      "Analytics_2019-10-02-080000_ismh15.core_analytics",
    ],
    [
      "2019-10-03",
      "08:00:00.102938",
      "analyticsd",
      "Analytics_2019-10-03-080000_ismh15.core_analytics",
    ],
  ]),
  "system-log": reportList(6, "default", [
    ["2019-10-03", "14:58:10.000000", "syslogd", "ASL Sender Statistics"],
    ["2019-10-03", "14:59:02.000000", "example-agent", "Service started; waiting for requests"],
    [
      "2019-10-03",
      "15:01:37.000000",
      "timed",
      "Clock adjusted by 0.012 s from the example time source",
    ],
    ["2019-10-03", "15:03:20.000000", "example-agent", "Request 42 took longer than 2 s"],
    ["2019-10-03", "15:05:44.000000", "loginwindow", "Session idle check passed"],
    [
      "2019-10-03",
      "15:06:59.000000",
      "example-agent",
      "Request 57 failed: the host did not answer",
    ],
    ["2019-10-03", "15:07:31.000000", "syslogd", "ASL Sender Statistics"],
  ]),
};

/**
 * Messages as Copy puts them on the clipboard: one line each, tab separated, in the order given.
 */
export function copyableMessages(messages: readonly ConsoleMessage[]): string {
  return messages
    .map((message) =>
      [TYPE_NAMES[message.type], timestamp(message), message.process, message.message].join("\t"),
    )
    .join("\n");
}

/* State. */

export interface ConsoleState {
  /** Every message of every source, in order of arrival. */
  messages: Readonly<Record<ConsoleSourceId, readonly ConsoleMessage[]>>;
  /** For a source that was cleared: the identifier of its last message at that time. */
  cleared: Readonly<Partial<Record<ConsoleSourceId, number>>>;
  /** Seed of the next message the device receives. */
  seed: number;
}

/** The state a window opens with. */
export function createState(
  device: readonly ConsoleMessage[] = defaultMessages,
  reports: Readonly<Record<ConsoleReportId, readonly ConsoleMessage[]>> = defaultReports,
  seed = 15,
): ConsoleState {
  return { messages: { ...reports, device }, cleared: {}, seed };
}

/** The messages a source shows: all of it, less what Clear has put away. */
export function listed(state: ConsoleState, source: ConsoleSourceId): readonly ConsoleMessage[] {
  const all = state.messages[source] ?? [];
  const through = state.cleared[source];
  return through === undefined ? all : all.filter((message) => message.id > through);
}

/** Clear: the source's messages so far are put away. Messages that arrive later are shown. */
export function clear(state: ConsoleState, source: ConsoleSourceId): ConsoleState {
  const last = (state.messages[source] ?? []).reduce((id, message) => Math.max(id, message.id), 0);
  return { ...state, cleared: { ...state.cleared, [source]: last } };
}

/** Reload: the source shows all its messages again. */
export function reload(state: ConsoleState, source: ConsoleSourceId): ConsoleState {
  const { [source]: _shown, ...cleared } = state.cleared;
  return { ...state, cleared };
}

/**
 * The device logs one more message, invented from the state's seed: after its last one in
 * time, and on the same day (the demo's clock does not pass midnight).
 */
export function receive(state: ConsoleState): ConsoleState {
  const device = state.messages.device;
  const last = device[device.length - 1];
  const seed = step(state.seed);
  const id = device.reduce((highest, message) => Math.max(highest, message.id), 0) + 1;
  const time = (last ? parseTime(last.time) : 43_200_000_000) + 400 + ((seed >>> 7) % 180_000);
  const message = invent(seed, id, last?.date ?? "2019-10-03", Math.min(time, DAY - 1));
  return { ...state, seed, messages: { ...state.messages, device: [...device, message] } };
}

const ERRORS: readonly ConsoleMessageType[] = ["error", "fault"];

const COMPARE: Record<ConsoleColumnId, (a: ConsoleMessage, b: ConsoleMessage) => number> = {
  type: (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  time: (a, b) => (timestamp(a) < timestamp(b) ? -1 : timestamp(a) > timestamp(b) ? 1 : 0),
  process: (a, b) => a.process.localeCompare(b.process, "en", { sensitivity: "base" }),
  message: (a, b) => a.message.localeCompare(b.message, "en", { sensitivity: "base" }),
  subsystem: (a, b) => a.subsystem.localeCompare(b.subsystem, "en", { sensitivity: "base" }),
  category: (a, b) => a.category.localeCompare(b.category, "en", { sensitivity: "base" }),
};

/**
 * The rows of the table: the messages the scope bar, the Activities button and the search
 * field let through, in the order of the sorted column. Without a sort they stay in order of
 * arrival; messages that compare equal keep it too.
 */
/** Without Include Info and Include Debug, as Console opens: those two levels are left out. */
export function withLevels(
  messages: readonly ConsoleMessage[],
  includeInfo: boolean,
  includeDebug: boolean,
): readonly ConsoleMessage[] {
  return messages.filter(
    (message) =>
      (message.type !== "info" || includeInfo) && (message.type !== "debug" || includeDebug),
  );
}

/** A word of a search that names a field: `process:Safari`, `-category:"network"`. In quotes, a backslash makes the next character plain. */
const QUERY_TOKEN = /(?:^|\s)(-?)(process|category|message):(?:"((?:[^"\\]|\\.)*)"|(\S+))/gi;

/** What a search asks for: its tokens, and the words left over, which are found as one phrase. */
export function parseQuery(query: string): {
  tokens: readonly {
    negated: boolean;
    field: "process" | "category" | "message";
    value: string;
  }[];
  text: string;
} {
  const tokens = [...query.matchAll(QUERY_TOKEN)].map((match) => ({
    negated: match[1] === "-",
    field: (match[2] ?? "").toLowerCase() as "process" | "category" | "message",
    value: (match[3]?.replace(/\\(.)/g, "$1") ?? match[4] ?? "").toLowerCase(),
  }));
  return { tokens, text: query.replace(QUERY_TOKEN, "").trim().toLowerCase() };
}

/** The search token for one process, quoted when its name needs it. */
export function processToken(process: string, hide = false): string {
  return `${hide ? "-" : ""}process:${quotedToken(process)}`;
}

/** The search token for one category, quoted when its name needs it. */
export function categoryToken(category: string): string {
  return `category:${quotedToken(category)}`;
}

const quotedToken = (value: string) =>
  /[\s"\\]/.test(value) ? `"${value.replace(/["\\]/g, "\\$&")}"` : value;

/** Where a search's plain words are looked for: its pop-up's rows, as Console's search token offers them. */
export const SEARCH_FIELDS = [
  ["any", "Any"],
  ["process", "Process"],
  ["message", "Message"],
  ["subsystem", "Subsystem"],
  ["category", "Category"],
] as const;
export type ConsoleSearchField = (typeof SEARCH_FIELDS)[number][0];

/** How a search's plain words compare with a field. */
export const SEARCH_COMPARISONS = [
  ["contains", "Contains"],
  ["is", "Is"],
  ["begins", "Begins With"],
  ["ends", "Ends With"],
  ["excludes", "Doesn’t Contain"],
] as const;
export type ConsoleSearchComparison = (typeof SEARCH_COMPARISONS)[number][0];

function wordsMatch(
  message: ConsoleMessage,
  words: string,
  field: ConsoleSearchField,
  comparison: ConsoleSearchComparison,
): boolean {
  const fields =
    field === "any"
      ? [message.process, message.message, message.subsystem, message.category]
      : [message[field]];
  const values = fields.map((value) => value.toLowerCase());
  if (comparison === "excludes") return !values.some((value) => value.includes(words));
  return values.some((value) =>
    comparison === "is"
      ? value === words
      : comparison === "begins"
        ? value.startsWith(words)
        : comparison === "ends"
          ? value.endsWith(words)
          : value.includes(words),
  );
}

export function arrange(
  messages: readonly ConsoleMessage[],
  options: {
    scope?: ConsoleScope;
    /** Only messages that belong to an activity. */
    activities?: boolean;
    /** Text to find, in any letter case; `process:`, `category:` and `message:` narrow to a field, and a leading `-` excludes. */
    query?: string;
    /** Where the plain words of `query` are looked for, and how they compare: Any and Contains by default. */
    searchField?: ConsoleSearchField;
    searchComparison?: ConsoleSearchComparison;
    sort?: ConsoleSort;
  } = {},
): readonly ConsoleMessage[] {
  const {
    scope = "all",
    activities = false,
    searchField = "any",
    searchComparison = "contains",
    sort,
  } = options;
  const { tokens, text } = parseQuery(options.query ?? "");
  let rows = messages;
  if (scope === "errors" || activities || text !== "" || tokens.length > 0)
    rows = messages.filter(
      (message) =>
        (scope === "all" || ERRORS.includes(message.type)) &&
        (!activities || message.activity !== 0) &&
        tokens.every(
          ({ negated, field, value }) => message[field].toLowerCase().includes(value) !== negated,
        ) &&
        (text === "" || wordsMatch(message, text, searchField, searchComparison)),
    );
  const compare = sort ? COMPARE[sort.column as ConsoleColumnId] : undefined;
  if (!sort || !compare) return rows;
  const sign = sort.direction === "descending" ? -1 : 1;
  return [...rows].sort((a, b) => sign * compare(a, b));
}

/** Whether Console opens this file of the drive as a log: its name, or a text type. */
export function isLogFile(file: { name: string; type?: string }): boolean {
  return (
    /\.(log|txt|text|out|err|crash|ips|diag|spin)$/i.test(file.name) ||
    (file.type ?? "").startsWith("text/")
  );
}

const SYSLOG_LINE =
  /^([A-Z][a-z]{2})\s+(\d{1,2}) (\d\d:\d\d:\d\d)\s+\S+\s+([^\s:[]+)(?:\[(\d+)\])?:\s?(.*)$/;
const SAVED_LINE = /^(Default|Info|Debug|Error|Fault)\t(\d{4}-\d\d-\d\d) (\S+)\t([^\t]*)\t(.*)$/;
const TYPE_BY_NAME = Object.fromEntries(
  Object.entries(TYPE_NAMES).map(([type, name]) => [name, type]),
) as Record<string, ConsoleMessageType>;

/**
 * The rows of a log file: a line Console saved (Save a Copy As), a line in
 * the system log's form, or any other line as its text alone. A file says no more than it holds:
 * a system log line has no year and no other line a time, and nothing is added to them.
 */
export function messagesOfLogFile(text: string): readonly ConsoleMessage[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line, at) => {
    const message: ConsoleMessage = {
      id: at + 1,
      type: "default",
      date: "",
      time: "",
      process: "",
      pid: 0,
      thread: 0,
      activity: 0,
      subsystem: "",
      category: "",
      message: line,
    };
    const saved = SAVED_LINE.exec(line);
    if (saved) {
      const [, type = "", date = "", time = "", process = "", words = ""] = saved;
      return {
        ...message,
        type: TYPE_BY_NAME[type] ?? "default",
        date,
        time,
        process,
        message: words,
      };
    }
    const syslog = SYSLOG_LINE.exec(line);
    if (syslog) {
      const [, month, day, time, process = "", pid = "0", words = ""] = syslog;
      return {
        ...message,
        time: `${month} ${day} ${time}`,
        process,
        pid: Number(pid),
        message: words,
      };
    }
    return message;
  });
}

/** The latest of the messages by date and time; of two at the same time, the later listed. */
export function newest(messages: readonly ConsoleMessage[]): ConsoleMessage | undefined {
  let latest: ConsoleMessage | undefined;
  for (const message of messages)
    if (!latest || timestamp(message) >= timestamp(latest)) latest = message;
  return latest;
}
