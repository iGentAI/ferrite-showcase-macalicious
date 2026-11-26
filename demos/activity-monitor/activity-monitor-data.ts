/**
 * The demo's data: an invented set of processes, the five views over it, and a simulation that
 * moves the numbers. Nothing here reads the machine the page runs on.
 */

/** The five views of the toolbar's segmented control. */
export type ActivityMonitorTab = "cpu" | "memory" | "energy" | "disk" | "network";

/** Every view, in toolbar order, with its title. */
export const TABS: readonly { id: ActivityMonitorTab; title: string }[] = [
  { id: "cpu", title: "CPU" },
  { id: "memory", title: "Memory" },
  { id: "energy", title: "Energy" },
  { id: "disk", title: "Disk" },
  { id: "network", title: "Network" },
];

/** Which stand-in drawing a process shows before its name; `"none"` keeps the indent. */
export type ActivityMonitorIcon =
  | "none"
  | "document"
  | "application"
  | "monitor"
  | "console"
  | "files"
  | "search";

/** One process, with the values of every view. */
export interface ActivityMonitorProcess {
  /** Process identifier: what a row is selected by. */
  pid: number;
  name: string;
  user: string;
  icon: ActivityMonitorIcon;
  /** Percent of one core. */
  cpu: number;
  /** Seconds of processor time. */
  cpuTime: number;
  threads: number;
  idleWakeUps: number;
  /** Percent of the graphics processor. */
  gpu: number;
  /** Seconds of graphics processor time. */
  gpuTime: number;
  /** Megabytes. */
  memory: number;
  ports: number;
  energyImpact: number;
  averageEnergyImpact: number;
  appNap: boolean;
  preventingSleep: boolean;
  bytesWritten: number;
  bytesRead: number;
  /** Architecture, as the Disk view's Kind column shows it. */
  kind: string;
  sentBytes: number;
  receivedBytes: number;
  sentPackets: number;
  receivedPackets: number;
}

/**
 * Figures for the whole machine, which also runs processes of other users that the list does
 * not show: the footer's numbers when the window opens.
 */
export interface ActivityMonitorTotals {
  /** Percent of all cores used by the system. */
  system: number;
  /** Percent of all cores used by the user's processes. */
  user: number;
  threads: number;
  processes: number;
}

/** One point of every view's graph: a lower (red) and an upper (blue) series. */
export type ActivityMonitorSample = Readonly<Record<ActivityMonitorTab, readonly [number, number]>>;

/** A point at which nothing happens. */
export const EMPTY_SAMPLE: ActivityMonitorSample = {
  cpu: [0, 0],
  memory: [0, 0],
  energy: [0, 0],
  disk: [0, 0],
  network: [0, 0],
};

/** Megabytes of memory the invented machine has. */
export const PHYSICAL_MEMORY = 16 * 1024;

/** A fraction in [0, 1) that depends only on the two numbers. */
function fraction(pid: number, salt: number): number {
  let x = Math.imul(pid ^ (salt * 0x9e3779b1), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 15), 0xc2b2ae35);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
}

/**
 * A process from the columns of the CPU view, in the order the reference screenshots show
 * them. The values of the other views are invented from the identifier, so they are the same
 * on every run.
 */
export function createProcess(
  name: string,
  cpu: number,
  cpuTime: number,
  threads: number,
  idleWakeUps: number,
  pid: number,
  icon: ActivityMonitorIcon = "none",
  gpuTime = 0,
): ActivityMonitorProcess {
  const application = icon !== "none" && icon !== "document";
  const packets = fraction(pid, 5) < 0.4 ? Math.floor(fraction(pid, 6) * 900) : 0;
  return {
    pid,
    name,
    user: "shackett",
    icon,
    cpu,
    cpuTime,
    threads,
    idleWakeUps,
    gpu: 0,
    gpuTime,
    memory: Math.round((application ? 40 : 3) * (1 + 4 * fraction(pid, 1)) * 10) / 10,
    ports: Math.round(40 + threads * 14 + fraction(pid, 2) * (application ? 260 : 60)),
    energyImpact: Math.round(cpu * 3.5) / 10,
    averageEnergyImpact: Math.round(cpu * 12 + fraction(pid, 3) * 20) / 100,
    appNap: application && fraction(pid, 4) < 0.3,
    preventingSleep: false,
    bytesWritten: Math.floor(fraction(pid, 7) ** 3 * 6_000_000),
    bytesRead: Math.floor(fraction(pid, 8) ** 2 * 24_000_000),
    kind: "64 bit",
    sentBytes: packets * 420,
    receivedBytes: packets * 1130,
    sentPackets: packets,
    receivedPackets: Math.floor(packets * 1.4),
  };
}

const p = createProcess;

/** Rows below the ones a reference screenshot shows, so the list scrolls. */
const MORE: readonly ActivityMonitorProcess[] = [
  p("ContextStoreAgent", 0, 0.19, 3, 0, 601),
  p("pboard", 0, 0.05, 2, 0, 529),
  p("talagent", 0, 0.61, 3, 0, 498),
  p("Dock", 0, 3.12, 5, 0, 1709, "application"),
  p("SystemUIServer", 0, 1.88, 5, 0, 1710, "application"),
  p("Notification Center", 0, 2.4, 5, 1, 548, "application"),
  p("trustd", 0, 1.21, 3, 0, 481),
  p("fontd", 0, 0.77, 3, 0, 493),
];

/** The process list of the light reference screenshot, then eight more rows. */
export const defaultProcesses: readonly ActivityMonitorProcess[] = [
  p("Activity Monitor", 28.3, 1.67, 20, 3, 2026, "monitor"),
  p("iconservicesagent", 0.8, 2.09, 6, 0, 558),
  p("sharingd", 0.2, 1.4, 4, 0, 568),
  p("cfprefsd", 0.1, 1.93, 3, 0, 472),
  p("UserEventAgent", 0.1, 1.26, 3, 0, 476),
  p("sharedfilelistd", 0.1, 0.26, 5, 0, 572),
  p("useractivityd", 0.1, 0.4, 3, 0, 570),
  p("cloudpaird", 0.1, 0.32, 2, 0, 1741),
  p("mdworker_shared", 0.1, 0.08, 3, 0, 1935),
  p("Location Menu", 0.1, 0.39, 4, 0, 586, "application"),
  p("distnoted", 0, 0.84, 2, 0, 484),
  p("lockoutagent", 0, 0.45, 3, 1, 504),
  p("SafariBookmarksSyncAgent", 0, 1.1, 7, 1, 563),
  p("MTLCompilerService", 0, 0.1, 3, 0, 2028),
  p("Finder", 0, 14.9, 9, 1, 1711, "files"),
  p("universalaccessd", 0, 0.21, 5, 0, 487, "console"),
  p("EmojiFunctionRowIM", 0, 0.88, 6, 1, 657, "document"),
  p("appstoreagent", 0, 0.25, 3, 1, 828),
  p("Spotlight", 0, 15.03, 21, 0, 855, "search"),
  p("secd", 0, 1.3, 2, 0, 483),
  p("adprivacyd", 0, 0.16, 3, 1, 625),
  p("nsurlsessiond", 0, 1.04, 5, 0, 490),
  p("ViewBridgeAuxiliary", 0, 0.35, 3, 0, 557, "document"),
  p("QuickLookUIService (Spotlight)", 0, 0.31, 7, 0, 1896, "document"),
  ...MORE,
];

/** The footer of the light reference screenshot. */
export const defaultTotals: ActivityMonitorTotals = {
  system: 1,
  user: 2.33,
  threads: 1384,
  processes: 354,
};

/** The process list of the dark reference screenshot, then eight more rows. */
export const darkCaptureProcesses: readonly ActivityMonitorProcess[] = [
  p("Activity Monitor", 19.3, 1.9, 9, 5, 1341, "monitor"),
  p("Screen Shot", 0.8, 0.17, 11, 2, 1343, "application"),
  p("iconservicesagent", 0.6, 3.14, 5, 0, 483, "none", 0.05),
  p("Control Strip", 0.3, 2.06, 6, 0, 435, "application"),
  p("mdworker_shared", 0.2, 0.09, 3, 0, 1331),
  p("cfprefsd", 0.1, 2.05, 3, 0, 375),
  p("Finder", 0.1, 21.81, 7, 0, 419, "files", 0.01),
  p("loginwindow", 0.1, 1.49, 4, 0, 166, "application"),
  p("mdworker_shared", 0.1, 0.1, 3, 0, 1330),
  p("sharedfilelistd", 0, 0.39, 4, 1, 466),
  p("universalaccessd", 0, 0.32, 5, 0, 414, "console"),
  p("sharingd", 0, 2, 4, 0, 494),
  p("Keychain Access", 0, 1.34, 6, 1, 1338, "application"),
  p("mdworker_shared", 0, 0.09, 3, 0, 973),
  p("Spotlight", 0, 19.57, 8, 0, 511, "search"),
  p("lockoutagent", 0, 0.65, 3, 1, 436),
  p("corespotlightd", 0, 1.54, 4, 0, 583),
  p("Siri", 0, 1.13, 3, 0, 489, "search"),
  p("UserEventAgent", 0, 1.65, 2, 0, 401),
  p("SafariBookmarksSyncAgent", 0, 1.51, 6, 1, 455),
  p("useractivityd", 0, 0.77, 2, 1, 506),
  p("cloudpaird", 0, 0.73, 2, 0, 496),
  p("CommCenter", 0, 0.49, 7, 1, 433),
  p("lsd", 0, 0.46, 4, 0, 405),
  ...MORE,
];

/** The footer of the dark reference screenshot. */
export const darkCaptureTotals: ActivityMonitorTotals = {
  system: 1.14,
  user: 1.89,
  threads: 1414,
  processes: 386,
};

/** What the window shows and the simulation moves. */
export interface ActivityMonitorState {
  processes: readonly ActivityMonitorProcess[];
  totals: ActivityMonitorTotals;
  /** Graph points, oldest first. */
  history: readonly ActivityMonitorSample[];
  /** Each process's resting processor use, which its use wanders around. */
  rest: ReadonlyMap<number, number>;
  /** The totals and the processor use the simulation started from. */
  origin: { totals: ActivityMonitorTotals; cpu: number };
  /** State of the random number generator. */
  seed: number;
}

/** Points a graph keeps: more than its width shows at 5 pt a point. */
export const HISTORY_LENGTH = 40;

const sum = (
  processes: readonly ActivityMonitorProcess[],
  of: (p: ActivityMonitorProcess) => number,
) => processes.reduce((total, process) => total + of(process), 0);

const round = (value: number, digits: number) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

/** Share of the physical memory the listed processes and the rest of the machine use. */
export function memoryPressure(processes: readonly ActivityMonitorProcess[]): number {
  return Math.min(
    100,
    ((5200 + sum(processes, (process) => process.memory)) / PHYSICAL_MEMORY) * 100,
  );
}

/** The state a window opens with. */
export function createState(
  processes: readonly ActivityMonitorProcess[],
  totals: ActivityMonitorTotals,
  history: readonly ActivityMonitorSample[] = [],
  seed = 2019,
): ActivityMonitorState {
  return {
    processes,
    totals,
    history,
    rest: new Map(processes.map((process) => [process.pid, process.cpu])),
    origin: {
      totals,
      cpu: Math.max(
        0.1,
        sum(processes, (process) => process.cpu),
      ),
    },
    seed,
  };
}

/**
 * The state `seconds` later. Pure: the same state gives the same next state, because the
 * random numbers come from the seed the state carries.
 */
export function advance(state: ActivityMonitorState, seconds: number): ActivityMonitorState {
  let seed = state.seed;
  // Mulberry32.
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let threads = 0;
  let written = 0;
  let read = 0;
  let sent = 0;
  let received = 0;
  const processes = state.processes.map((process) => {
    const rest = state.rest.get(process.pid) ?? 0;
    // Wanders around its resting use, and now and then does a little work.
    const burst = random() < 0.08 ? random() * 1.5 : 0;
    const cpu = round(Math.max(0, rest * (0.55 + 0.9 * random()) + burst), 1);
    const step = random() < 0.1 ? (random() < 0.5 ? -1 : 1) : 0;
    const nextThreads = Math.max(1, process.threads + step);
    threads += nextThreads - process.threads;
    const energyImpact = round(cpu * 0.35, 1);
    const wrote = Math.floor(random() * cpu * 25_000 * seconds);
    const readBytes = Math.floor(random() * cpu * 40_000 * seconds);
    const packets =
      process.sentPackets > 0 && random() < 0.35 ? Math.ceil(random() * 6 * seconds) : 0;
    written += wrote;
    read += readBytes;
    sent += packets;
    received += packets * 2;
    return {
      ...process,
      cpu,
      cpuTime: round(process.cpuTime + (cpu / 100) * seconds, 2),
      threads: nextThreads,
      idleWakeUps: Math.floor(random() ** 2 * (rest > 1 ? 7 : 2.4)),
      memory: round(process.memory * (0.995 + 0.01 * random()), 1),
      energyImpact,
      averageEnergyImpact: round(process.averageEnergyImpact * 0.9 + energyImpact * 0.1, 2),
      bytesWritten: process.bytesWritten + wrote,
      bytesRead: process.bytesRead + readBytes,
      sentPackets: process.sentPackets + packets,
      receivedPackets: process.receivedPackets + packets * 2,
      sentBytes: process.sentBytes + packets * 420,
      receivedBytes: process.receivedBytes + packets * 2 * 1130,
    };
  });

  const use = sum(processes, (process) => process.cpu);
  const totals: ActivityMonitorTotals = {
    system: round(state.origin.totals.system * (0.75 + 0.5 * random()), 2),
    user: round(Math.min(95, (state.origin.totals.user * use) / state.origin.cpu), 2),
    threads: state.totals.threads + threads,
    processes: state.totals.processes,
  };
  const sample: ActivityMonitorSample = {
    cpu: [totals.system, totals.user],
    memory: [0, memoryPressure(processes)],
    energy: [0, sum(processes, (process) => process.energyImpact)],
    disk: [written / seconds, read / seconds],
    network: [sent / seconds, received / seconds],
  };
  return {
    ...state,
    processes,
    totals,
    history: [...state.history, sample].slice(-HISTORY_LENGTH),
    seed,
  };
}

/** The state without one process: what Quit Process does. */
export function quit(state: ActivityMonitorState, pid: number): ActivityMonitorState {
  const gone = state.processes.find((process) => process.pid === pid);
  if (!gone) return state;
  return {
    ...state,
    processes: state.processes.filter((process) => process !== gone),
    totals: {
      ...state.totals,
      threads: state.totals.threads - gone.threads,
      processes: state.totals.processes - 1,
    },
  };
}

const count = (value: number) => Math.round(value).toLocaleString("en-US");

/** A number of bytes as Activity Monitor writes it: "0 bytes", "512 KB", "1.2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${Math.round(bytes)} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

/** Megabytes as "45.2 MB" or "1.32 GB". */
export function formatMemory(megabytes: number): string {
  return megabytes < 1000 ? `${megabytes.toFixed(1)} MB` : `${(megabytes / 1024).toFixed(2)} GB`;
}

/** Seconds of processor time: "1.67", and "1:02.50" from a minute on. */
export function formatTime(seconds: number): string {
  // Rounded first, so that 119.999 is "2:00.00" and not "1:60.00".
  const hundredths = Math.round(seconds * 100);
  if (hundredths < 6000) return (hundredths / 100).toFixed(2);
  const minutes = Math.floor(hundredths / 6000);
  return `${minutes}:${((hundredths % 6000) / 100).toFixed(2).padStart(5, "0")}`;
}

/** One column of a view. */
export interface ActivityMonitorColumn {
  id: string;
  title: string;
  /** Width in points; the Process Name column has none and takes what is left. */
  width?: number;
  /** How the cell is set: the name with its icon, a right-aligned number, or plain text. */
  kind: "name" | "number" | "text";
  /** The cell's text. */
  text: (process: ActivityMonitorProcess) => string;
  /** What the column sorts by. */
  order: (process: ActivityMonitorProcess) => number | string;
}

const NAME: ActivityMonitorColumn = {
  id: "name",
  title: "Process Name",
  kind: "name",
  text: (process) => process.name,
  order: (process) => process.name.toLowerCase(),
};

const number = (
  id: string,
  title: string,
  width: number,
  order: (process: ActivityMonitorProcess) => number,
  text: (value: number) => string = count,
): ActivityMonitorColumn => ({
  id,
  title,
  width,
  kind: "number",
  order,
  text: (process) => text(order(process)),
});

const flag = (
  id: string,
  title: string,
  width: number,
  on: (process: ActivityMonitorProcess) => boolean,
): ActivityMonitorColumn => ({
  id,
  title,
  width,
  kind: "text",
  text: (process) => (on(process) ? "Yes" : "No"),
  order: (process) => (on(process) ? 1 : 0),
});

const user = (width: number): ActivityMonitorColumn => ({
  id: "user",
  title: "User",
  width,
  kind: "text",
  text: (process) => process.user,
  order: (process) => process.user,
});

const pid = (width: number) =>
  number(
    "pid",
    "PID",
    width,
    (process) => process.pid,
    (value) => String(value),
  );
const tenths = (value: number) => value.toFixed(1);
const hundredths = (value: number) => value.toFixed(2);

/**
 * The columns of every view. Those of the CPU view have the widths measured in the reference
 * screenshots; the other views have no screenshot, and their columns follow Activity Monitor's
 * defaults at plausible widths.
 */
export const COLUMNS: Readonly<Record<ActivityMonitorTab, readonly ActivityMonitorColumn[]>> = {
  cpu: [
    NAME,
    number("cpu", "% CPU", 78, (process) => process.cpu, tenths),
    number("cpuTime", "CPU Time", 73, (process) => process.cpuTime, formatTime),
    number("threads", "Threads", 63, (process) => process.threads),
    number("idleWakeUps", "Idle Wake Ups", 101, (process) => process.idleWakeUps),
    number("gpu", "% GPU", 78, (process) => process.gpu, tenths),
    number("gpuTime", "GPU Time", 78, (process) => process.gpuTime, formatTime),
    pid(43),
    user(83),
  ],
  memory: [
    NAME,
    number("memory", "Memory", 100, (process) => process.memory, formatMemory),
    number("threads", "Threads", 80, (process) => process.threads),
    number("ports", "Ports", 80, (process) => process.ports),
    pid(60),
    user(110),
  ],
  energy: [
    NAME,
    number("energyImpact", "Energy Impact", 110, (process) => process.energyImpact, tenths),
    number(
      "averageEnergyImpact",
      "Avg Energy Impact",
      130,
      (process) => process.averageEnergyImpact,
      hundredths,
    ),
    flag("appNap", "App Nap", 80, (process) => process.appNap),
    flag("preventingSleep", "Preventing Sleep", 120, (process) => process.preventingSleep),
    user(100),
  ],
  disk: [
    NAME,
    number("bytesWritten", "Bytes Written", 110, (process) => process.bytesWritten, formatBytes),
    number("bytesRead", "Bytes Read", 110, (process) => process.bytesRead, formatBytes),
    {
      id: "kind",
      title: "Kind",
      width: 70,
      kind: "text",
      text: (q) => q.kind,
      order: (q) => q.kind,
    },
    pid(60),
    user(100),
  ],
  network: [
    NAME,
    number("sentBytes", "Sent Bytes", 100, (process) => process.sentBytes, formatBytes),
    number("receivedBytes", "Rcvd Bytes", 100, (process) => process.receivedBytes, formatBytes),
    number("sentPackets", "Sent Packets", 100, (process) => process.sentPackets),
    number("receivedPackets", "Rcvd Packets", 100, (process) => process.receivedPackets),
    pid(60),
    user(90),
  ],
};

/** The column and direction each view is sorted by when the window opens. */
export const DEFAULT_SORT: Readonly<
  Record<ActivityMonitorTab, { column: string; direction: "ascending" | "descending" }>
> = {
  cpu: { column: "cpu", direction: "descending" },
  memory: { column: "memory", direction: "descending" },
  energy: { column: "energyImpact", direction: "descending" },
  disk: { column: "bytesWritten", direction: "descending" },
  network: { column: "sentBytes", direction: "descending" },
};

/**
 * The processes whose name contains the text, sorted by the column. The sort is stable, so
 * rows with equal values keep the order of the list.
 */
export function arrange(
  processes: readonly ActivityMonitorProcess[],
  column: ActivityMonitorColumn | undefined,
  direction: "ascending" | "descending",
  query = "",
): ActivityMonitorProcess[] {
  const text = query.trim().toLowerCase();
  const rows = text
    ? processes.filter((process) => process.name.toLowerCase().includes(text))
    : [...processes];
  if (!column) return rows;
  const sign = direction === "ascending" ? 1 : -1;
  return rows.sort((a, b) => {
    const x = column.order(a);
    const y = column.order(b);
    return x < y ? -sign : x > y ? sign : 0;
  });
}

/** One line of a footer cell. */
export interface ActivityMonitorStatistic {
  label: string;
  value: string;
  /** The whole of what `value` shortens, shown when the pointer rests on it. */
  whole?: string;
  /** Draws the value in the colour of the graph's lower (red) or upper (blue) series. */
  tone?: "lower" | "upper";
}

/** The footer of one view: up to three statistics on each side of a graph. */
export interface ActivityMonitorSummary {
  leading: readonly ActivityMonitorStatistic[];
  graphTitle: string;
  /** The value at the top of the graph; without it the graph fits its highest point. */
  graphMaximum?: number;
  trailing: readonly ActivityMonitorStatistic[];
}

const percent = (value: number) => `${value.toFixed(2)}%`;

/** The footer of a view. Only the CPU view's is taken from the reference screenshots. */
export function summarize(
  tab: ActivityMonitorTab,
  state: ActivityMonitorState,
): ActivityMonitorSummary {
  const { processes, totals } = state;
  const last = state.history[state.history.length - 1] ?? EMPTY_SAMPLE;
  if (tab === "cpu") {
    return {
      leading: [
        { label: "System:", value: percent(totals.system), tone: "lower" },
        { label: "User:", value: percent(totals.user), tone: "upper" },
        { label: "Idle:", value: percent(Math.max(0, 100 - totals.system - totals.user)) },
      ],
      graphTitle: "CPU LOAD",
      graphMaximum: 100,
      trailing: [
        { label: "Threads:", value: count(totals.threads) },
        { label: "Processes:", value: count(totals.processes) },
      ],
    };
  }
  if (tab === "memory") {
    const used = (memoryPressure(processes) / 100) * PHYSICAL_MEMORY;
    return {
      leading: [
        { label: "Physical Memory:", value: formatMemory(PHYSICAL_MEMORY) },
        { label: "Memory Used:", value: formatMemory(used) },
        { label: "Swap Used:", value: "0 bytes" },
      ],
      graphTitle: "MEMORY PRESSURE",
      graphMaximum: 100,
      trailing: [
        { label: "App Memory:", value: formatMemory(used * 0.52) },
        { label: "Wired Memory:", value: formatMemory(used * 0.31) },
        { label: "Compressed:", value: "0 bytes" },
      ],
    };
  }
  if (tab === "energy") {
    return {
      leading: [
        {
          label: "Energy Impact:",
          value: sum(processes, (q) => q.energyImpact).toFixed(1),
          tone: "upper",
        },
        { label: "Graphics Card:", value: "Integrated" },
        { label: "Remaining Charge:", value: "100%" },
      ],
      graphTitle: "ENERGY IMPACT",
      trailing: [
        { label: "Time on AC:", value: "2:14" },
        {
          label: "Apps Using Energy:",
          value: count(processes.filter((q) => q.energyImpact > 0).length),
        },
      ],
    };
  }
  if (tab === "disk") {
    return {
      leading: [
        { label: "Data read/sec:", value: formatBytes(last.disk[1]), tone: "upper" },
        { label: "Data written/sec:", value: formatBytes(last.disk[0]), tone: "lower" },
      ],
      graphTitle: "DATA",
      trailing: [
        { label: "Data read:", value: formatBytes(sum(processes, (q) => q.bytesRead)) },
        { label: "Data written:", value: formatBytes(sum(processes, (q) => q.bytesWritten)) },
      ],
    };
  }
  return {
    leading: [
      { label: "Packets in/sec:", value: count(last.network[1]), tone: "upper" },
      { label: "Packets out/sec:", value: count(last.network[0]), tone: "lower" },
    ],
    graphTitle: "PACKETS",
    trailing: [
      { label: "Packets in:", value: count(sum(processes, (q) => q.receivedPackets)) },
      { label: "Packets out:", value: count(sum(processes, (q) => q.sentPackets)) },
      { label: "Data received:", value: formatBytes(sum(processes, (q) => q.receivedBytes)) },
    ],
  };
}
