"use client";

import { Box } from "macalicious/box";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TableView, type TableViewColumn, type TableViewProps } from "macalicious/table-view";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { type MouseEvent, use, useEffect, useMemo, useRef, useState } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopRunningApplication, DesktopWindowProps } from "../desktop/desktop-apps";
import {
  ACTIVITY_DOCK_ICON,
  type ActivityDockMode,
  readActivityDockMode,
} from "../desktop/desktop-dock-activity";
import { requestHelp } from "../desktop/desktop-help";
import { changeDesktopValue, desktopValues, useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, sessionFetch, withDeadline } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { type DesktopWindowEntry, scanWindows } from "../desktop/desktop-window-scan";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { DriveSavePanel, saveToDrive } from "../finder/finder-file-dialogs";
import { ActivityMonitor, type ActivityMonitorProps, Graph, Statistics } from "./activity-monitor";
import { type ActivityMonitorSample, EMPTY_SAMPLE, HISTORY_LENGTH } from "./activity-monitor-data";
import { FERRITE_URL, type FerriteView, ferriteFromServer } from "./activity-monitor-figures";
import { ProcessIcon } from "./activity-monitor-icons";
import {
  bytesText,
  PAGE_STATEMENTS,
  type PageView,
  useAccountUsage,
  useMainThread,
  usePageReadings,
} from "./activity-monitor-page";
import { CpuHistoryPanel, CpuUsagePanel, InspectorPanel } from "./activity-monitor-windows";

type Sort = NonNullable<TableViewProps["sort"]>;

/** The application's liveness route: the Network view times the round trip to it. */
export const HEALTH_URL = "/health";
/**
 * How long each read of a round may take, its reply's body included: a read that hangs counts as
 * failed, so the next round still runs.
 */
export const READ_DEADLINE_MS = 5_000;

/** The id and name of this app, which the desktop's list of running applications leaves out. */
const SELF = { id: "activity-monitor", name: "Activity Monitor" };

/** A row of the Applications view. */
export interface ApplicationRow {
  id: string;
  name: string;
  windows: number;
  minimized: number;
  /** Whether Quit Process can quit it: an application the desktop lists as running. */
  quittable: boolean;
  /** Finder: quitting closes its windows and it goes on running. */
  relaunches: boolean;
}

/**
 * The applications running on the desktop: those the desktop lists (every application with a
 * window, and Finder), this one, and any other application a window belongs to, by name.
 */
export function applicationRows(
  windows: readonly DesktopWindowEntry[],
  running: readonly DesktopRunningApplication[],
): ApplicationRow[] {
  const rows = new Map<string, ApplicationRow>();
  const add = (id: string, name: string, quittable: boolean, relaunches: boolean) => {
    if (!rows.has(id)) rows.set(id, { id, name, windows: 0, minimized: 0, quittable, relaunches });
  };
  for (const app of running) add(app.id, app.name, true, Boolean(app.relaunches));
  add(SELF.id, SELF.name, false, false);
  for (const window of windows) {
    add(window.app, window.title || window.app, false, false);
    const row = rows.get(window.app);
    if (!row) continue;
    row.windows += 1;
    if (window.minimized) row.minimized += 1;
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** The round trips the Network view measured to one address, newest last. */
export interface RoundTrips {
  samples: readonly number[];
  failures: number;
}

/** How many round trips the Network view keeps per address. */
export const ROUND_TRIPS_KEPT = 60;

/** The last, median, fastest and slowest of `samples`, in milliseconds. */
export function roundTripStats(samples: readonly number[]) {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[middle] as number)
      : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
  return {
    last: samples[samples.length - 1] as number,
    median,
    min: sorted[0] as number,
    max: sorted[sorted.length - 1] as number,
  };
}

type View = "applications" | "ferrite" | PageView | "network";

const VIEWS: readonly { id: View; title: string }[] = [
  { id: "applications", title: "Applications" },
  { id: "ferrite", title: "Ferrite" },
  { id: "cpu", title: "CPU" },
  { id: "memory", title: "Memory" },
  { id: "energy", title: "Energy" },
  { id: "disk", title: "Disk" },
  { id: "network", title: "Network" },
];

const pageView = (view: View): PageView | null =>
  view === "cpu" || view === "memory" || view === "energy" || view === "disk" ? view : null;

const readView = (stored: unknown): View | undefined =>
  VIEWS.find((entry) => entry.id === stored)?.id;

/** View > Update Frequency: seconds between reads, and its title. */
const FREQUENCIES: readonly (readonly [number, string])[] = [
  [1, "Very Often (1 sec)"],
  [2, "Often (2 secs)"],
  [5, "Normally (5 secs)"],
];

/** View's processes kept across a reload: Selected Processes names rows of one visit. */
type ProcessFilter = "all" | "windowed";
const readFilter = (stored: unknown): ProcessFilter | undefined =>
  stored === "all" || stored === "windowed" ? stored : undefined;

/** Whether the keyboard is in a text field, whose own Copy and Select All then stay its own. */
const inTextField = () => {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
};

const readFrequency = (stored: unknown): number | undefined =>
  FREQUENCIES.find(([seconds]) => seconds === stored)?.[0];

interface Column {
  id: string;
  title: string;
  width?: number;
  number?: boolean;
}

const PAGE_COLUMNS: readonly Column[] = [
  { id: "name", title: "Measure" },
  { id: "value", title: "Reading", width: 260, number: true },
];

const COLUMNS: Record<View, readonly Column[]> = {
  cpu: PAGE_COLUMNS,
  memory: PAGE_COLUMNS,
  energy: PAGE_COLUMNS,
  disk: PAGE_COLUMNS,
  applications: [
    { id: "name", title: "Application Name" },
    { id: "windows", title: "Windows", width: 90, number: true },
    { id: "minimized", title: "Minimized", width: 90, number: true },
    { id: "kind", title: "On Quit", width: 110 },
  ],
  ferrite: [
    { id: "name", title: "App" },
    { id: "perSecond", title: "Req/s", width: 64, number: true },
    { id: "requests", title: "Requests", width: 76, number: true },
    { id: "p50Ms", title: "Median", width: 80, number: true },
    { id: "p95Ms", title: "95th %", width: 80, number: true },
    { id: "opsPerRequest", title: "Store Calls", width: 84, number: true },
    { id: "errors", title: "Failed", width: 62, number: true },
  ],
  network: [
    { id: "name", title: "Round Trip To" },
    { id: "last", title: "Last", width: 80, number: true },
    { id: "median", title: "Median", width: 80, number: true },
    { id: "min", title: "Fastest", width: 80, number: true },
    { id: "max", title: "Slowest", width: 80, number: true },
    { id: "samples", title: "Samples", width: 72, number: true },
  ],
};

const number = (value: number) => value.toLocaleString("en-US");
/**
 * What the footer's cell shows of an instance's name, `owner/app@generation@node:process:id`: what
 * follows the last `@`, as all before it is the same for every instance of the application.
 */
export const instanceShown = (name: string) => name.slice(name.lastIndexOf("@") + 1);
/** A time in milliseconds, as Activity Monitor writes it: "0.42 ms", "18 ms", "1.2 s". */
export const msText = (value: number | null) =>
  value === null
    ? "—"
    : value >= 1000
      ? `${(value / 1000).toFixed(1)} s`
      : value >= 10
        ? `${Math.round(value)} ms`
        : `${value.toFixed(2)} ms`;

interface Row {
  id: string;
  name: string;
  cells: Record<string, string>;
  order: Record<string, number | string>;
}

/** The sort of each view as the person last left it. */
const DEFAULT_SORTS: Readonly<Record<View, Sort>> = {
  applications: { column: "name", direction: "ascending" },
  ferrite: { column: "requests", direction: "descending" },
  cpu: { column: "name", direction: "ascending" },
  memory: { column: "name", direction: "ascending" },
  energy: { column: "name", direction: "ascending" },
  disk: { column: "value", direction: "descending" },
  network: { column: "name", direction: "ascending" },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Only a view and a column that exist, and a direction, are taken from what is stored. */
export function readSorts(stored: unknown): Readonly<Record<View, Sort>> | undefined {
  if (!isRecord(stored)) return undefined;
  const sorts = { ...DEFAULT_SORTS };
  for (const { id } of VIEWS) {
    const sort = stored[id];
    if (
      isRecord(sort) &&
      COLUMNS[id].some((column) => column.id === sort.column) &&
      (sort.direction === "ascending" || sort.direction === "descending")
    )
      sorts[id] = { column: sort.column as string, direction: sort.direction };
  }
  return sorts;
}

const NO_HIDDEN: Readonly<Record<string, readonly string[]>> = {};
const NO_WIDTHS: Readonly<Record<string, number>> = {};
const NO_ORDERS: Readonly<Record<string, readonly string[]>> = {};

/** The order the person has put each view's columns in; only columns that exist are taken. */
export function readOrders(
  stored: unknown,
): Readonly<Record<string, readonly string[]>> | undefined {
  if (!isRecord(stored)) return undefined;
  const orders: Record<string, readonly string[]> = {};
  for (const { id } of VIEWS) {
    const list = stored[id];
    if (Array.isArray(list)) {
      const known = COLUMNS[id].map((column) => column.id);
      orders[id] = list.filter((column) => known.includes(column));
    }
  }
  return orders;
}

/** A view's columns in the person's order; one that order does not name stays at the end. */
export function columnsInOrder<T extends { id: string }>(
  columns: readonly T[],
  order: readonly string[] = [],
): readonly T[] {
  const rank = (id: string) => {
    const place = order.indexOf(id);
    return place < 0 ? order.length : place;
  };
  return [...columns].sort((a, b) => rank(a.id) - rank(b.id));
}

/** `ids` with `id` taken out and put back before `before`, or last. */
export function movedColumn(
  ids: readonly string[],
  id: string,
  before: string | null,
): readonly string[] {
  const rest = ids.filter((each) => each !== id);
  const place = before === null ? rest.length : rest.indexOf(before);
  return [...rest.slice(0, place), id, ...rest.slice(place)];
}

/** Column widths the person has set, by `view.column`. */
export function readWidths(stored: unknown): Readonly<Record<string, number>> | undefined {
  if (!isRecord(stored)) return undefined;
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 20,
    ),
  );
}
const NONE_HIDDEN: readonly string[] = [];

/** Columns the person has taken away, by view. The first column of a view always stays. */
export function readHidden(
  stored: unknown,
): Readonly<Record<string, readonly string[]>> | undefined {
  if (!isRecord(stored)) return undefined;
  const hidden: Record<string, readonly string[]> = {};
  for (const { id } of VIEWS) {
    const list = stored[id];
    if (Array.isArray(list))
      hidden[id] = COLUMNS[id]
        .slice(1)
        .map((column) => column.id)
        .filter((column) => list.includes(column));
  }
  return hidden;
}

/** The addresses the Network view times: label, address. */
const TARGETS: readonly { id: string; name: string }[] = [
  { id: "health", name: "Ferrite: the application (/health)" },
  { id: "ferrite", name: "Ferrite: Activity Monitor’s read (/api/…)" },
];

function ServedActivityMonitor({
  running,
  onQuit,
  panelWindow: PanelWindow,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 839,
  height = 634,
  state: windowState = "key",
  ...windowProps
}: Omit<
  DesktopWindowProps,
  | "runningApplications"
  | "onQuitApplication"
  | "DesktopWindow"
  | "onFrameSizeChange"
  | "preferencesOpen"
  | "onPreferencesOpenChange"
  | "settings"
> & {
  running: readonly DesktopRunningApplication[];
  onQuit: ((id: string) => void) | undefined;
  panelWindow: DesktopWindowProps["DesktopWindow"];
}) {
  const [view, setView] = useDesktopSetting<View>(
    "activity-monitor.view",
    readView,
    "applications",
  );
  const [frequency, setFrequency] = useDesktopSetting<number>(
    "activity-monitor.frequency",
    readFrequency,
    2,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useDesktopSetting<ProcessFilter>(
    "activity-monitor.filter",
    readFilter,
    "all",
  );
  // View > Selected Processes: the rows selected when it was chosen, for this visit.
  const [pinned, setPinned] = useState<readonly (string | number)[] | null>(null);
  const [sorts, setSorts] = useDesktopSetting<Readonly<Record<View, Sort>>>(
    "activity-monitor.sorts",
    readSorts,
    DEFAULT_SORTS,
  );
  const [hidden, setHidden] = useDesktopSetting<Readonly<Record<string, readonly string[]>>>(
    "activity-monitor.hidden-columns",
    readHidden,
    NO_HIDDEN,
  );
  const [widths, setWidths] = useDesktopSetting<Readonly<Record<string, number>>>(
    "activity-monitor.column-widths",
    readWidths,
    NO_WIDTHS,
  );
  const [orders, setOrders] = useDesktopSetting<Readonly<Record<string, readonly string[]>>>(
    "activity-monitor.column-order",
    readOrders,
    NO_ORDERS,
  );
  const [selection, setSelection] = useState<readonly (string | number)[]>([]);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const [windows, setWindows] = useState<DesktopWindowEntry[]>([]);
  const [ferrite, setFerrite] = useState<FerriteView>();
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState<readonly ActivityMonitorSample[]>([]);
  const [trips, setTrips] = useState<Record<string, RoundTrips>>({});
  const [busyHistory, setBusyHistory] = useState<readonly ActivityMonitorSample[]>([]);
  const thread = useMainThread((busy) =>
    setBusyHistory((points) =>
      [...points, { ...EMPTY_SAMPLE, cpu: [busy, 0] as const }].slice(-HISTORY_LENGTH),
    ),
  );
  const readings = usePageReadings(pageView(view), thread, frequency);

  // The desktop's windows, read again every second.
  useEffect(() => {
    const read = () =>
      setWindows((current) => {
        const next = scanWindows();
        return JSON.stringify(next) === JSON.stringify(current) ? current : next;
      });
    read();
    const timer = setInterval(read, 1000);
    return () => clearInterval(timer);
  }, []);

  // Every two seconds, one round at a time (a round still waiting when the next is due is not
  // joined by another, so replies cannot arrive out of order): the Ferrite view, and the round
  // trip to the application's liveness route, both timed in the browser. The graph plots the
  // median and 95th-percentile server time of the window.
  useEffect(() => {
    let live = true;
    let busy = false;
    const record = (target: string, ms: number | null) =>
      setTrips((all) => {
        const current = all[target] ?? { samples: [], failures: 0 };
        return {
          ...all,
          [target]:
            ms === null
              ? { ...current, failures: current.failures + 1 }
              : { ...current, samples: [...current.samples, ms].slice(-ROUND_TRIPS_KEPT) },
        };
      });
    const timed = async <T,>(target: string, run: () => Promise<T>) => {
      const started = performance.now();
      try {
        const value = await run();
        if (live) record(target, Math.round((performance.now() - started) * 100) / 100);
        return value;
      } catch (error) {
        if (live) record(target, null);
        throw error;
      }
    };
    const read = async () => {
      // A hidden page reads nothing: every read is a store call the figures would count.
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const view = await timed("ferrite", () =>
          withDeadline(async (signal) => {
            const response = await sessionFetch(FERRITE_URL, {
              credentials: "same-origin",
              headers: { accept: "application/json" },
              signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return ferriteFromServer(await response.json());
          }, READ_DEADLINE_MS),
        ).catch(() => undefined);
        if (!live) return;
        if (view) {
          setFailed(false);
          setFerrite(view);
          const sample: ActivityMonitorSample = {
            ...EMPTY_SAMPLE,
            network: [
              view.total.p50Ms ?? 0,
              Math.max(0, (view.total.p95Ms ?? 0) - (view.total.p50Ms ?? 0)),
            ],
          };
          setHistory((points) => [...points, sample].slice(-HISTORY_LENGTH));
        } else setFailed(true);
        await timed("health", () =>
          withDeadline(async (signal) => {
            const response = await fetch(HEALTH_URL, {
              cache: "no-store",
              credentials: "omit",
              signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await response.text();
          }, READ_DEADLINE_MS),
        ).catch(() => undefined);
      } finally {
        busy = false;
      }
    };
    void read();
    const timer = setInterval(read, frequency * 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [frequency]);

  const applications = useMemo(() => applicationRows(windows, running), [windows, running]);
  const rows = useMemo((): Row[] => {
    const all: Row[] = pageView(view)
      ? readings.map((reading) => ({
          id: reading.id,
          name: reading.name,
          cells: { value: reading.value },
          order: { name: reading.name.toLowerCase(), value: reading.order },
        }))
      : view === "applications"
        ? applications
            .filter((app) =>
              pinned ? pinned.includes(app.id) : filter === "all" || app.windows > 0,
            )
            .map((app) => ({
              id: app.id,
              name: app.name,
              cells: {
                windows: number(app.windows),
                minimized: number(app.minimized),
                kind: app.relaunches ? "Relaunches" : app.quittable ? "Quits" : "",
              },
              order: {
                name: app.name.toLowerCase(),
                windows: app.windows,
                minimized: app.minimized,
              },
            }))
        : view === "ferrite"
          ? (ferrite?.apps ?? []).map((app) => ({
              id: app.name,
              name: app.title,
              cells: {
                perSecond: app.perSecond.toFixed(2),
                requests: number(app.requests),
                p50Ms: msText(app.p50Ms),
                p95Ms: msText(app.p95Ms),
                opsPerRequest: app.opsPerRequest === null ? "—" : app.opsPerRequest.toFixed(1),
                errors: number(app.errors),
              },
              order: {
                name: app.title.toLowerCase(),
                perSecond: app.perSecond,
                requests: app.requests,
                p50Ms: app.p50Ms ?? -1,
                p95Ms: app.p95Ms ?? -1,
                opsPerRequest: app.opsPerRequest ?? -1,
                errors: app.errors,
              },
            }))
          : TARGETS.map((target) => {
              const measured = trips[target.id];
              const stats = roundTripStats(measured?.samples ?? []);
              return {
                id: target.id,
                name: target.name,
                cells: {
                  last: msText(stats?.last ?? null),
                  median: msText(stats?.median ?? null),
                  min: msText(stats?.min ?? null),
                  max: msText(stats?.max ?? null),
                  samples: `${number(measured?.samples.length ?? 0)}${
                    measured?.failures ? ` (${measured.failures} failed)` : ""
                  }`,
                },
                order: {
                  name: target.name.toLowerCase(),
                  last: stats?.last ?? -1,
                  median: stats?.median ?? -1,
                  min: stats?.min ?? -1,
                  max: stats?.max ?? -1,
                  samples: measured?.samples.length ?? 0,
                },
              };
            });
    const needle = query.trim().toLowerCase();
    const shown = needle ? all.filter((row) => row.name.toLowerCase().includes(needle)) : all;
    const sort = sorts[view];
    const sign = sort.direction === "descending" ? -1 : 1;
    return [...shown].sort((a, b) => {
      const x = a.order[sort.column] ?? a.cells[sort.column] ?? "";
      const y = b.order[sort.column] ?? b.cells[sort.column] ?? "";
      return sign * (x < y ? -1 : x > y ? 1 : 0);
    });
  }, [view, applications, ferrite, trips, query, sorts, readings, filter, pinned]);

  const hiddenHere = hidden[view] ?? NONE_HIDDEN;
  const columns = useMemo(
    () =>
      columnsInOrder(COLUMNS[view], orders[view])
        .filter((column) => !hiddenHere.includes(column.id))
        .map(
          (column): TableViewColumn => ({
            id: column.id,
            title: column.title,
            width: widths[`${view}.${column.id}`] ?? column.width,
            minWidth: column.width === undefined ? 150 : undefined,
            align: column.number ? "right" : "left",
            headerAlign: "center",
            sortable: true,
          }),
        ),
    [view, hiddenHere, widths, orders],
  );
  // A menu's items are registered with the desktop: they change only when what they show does.
  const columnItems = useMemo(
    () => (
      <Submenu>
        <SubmenuTrigger>Columns</SubmenuTrigger>
        <SubmenuPopup>
          {COLUMNS[view].slice(1).map((column) => (
            <MenuCheckboxItem
              key={column.id}
              checked={!hiddenHere.includes(column.id)}
              onCheckedChange={() =>
                setHidden({
                  ...hidden,
                  [view]: hiddenHere.includes(column.id)
                    ? hiddenHere.filter((id) => id !== column.id)
                    : [...hiddenHere, column.id],
                })
              }
            >
              {column.title}
            </MenuCheckboxItem>
          ))}
        </SubmenuPopup>
      </Submenu>
    ),
    [view, hidden, hiddenHere, setHidden],
  );

  const selected =
    view === "applications"
      ? applications.filter(
          (app) => selection.includes(app.id) && rows.some((row) => row.id === app.id),
        )
      : [];
  const quittable = selected.filter((app) => app.quittable);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [asked, setAsked] = useState<readonly ApplicationRow[]>([]);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<string>();
  const [inspecting, setInspecting] = useState<readonly string[]>([]);
  const [cpuUsage, setCpuUsage] = useState(false);
  const [cpuHistory, setCpuHistory] = useState(false);
  const [dockIcon, setDockIcon] = useDesktopSetting<ActivityDockMode>(
    ACTIVITY_DOCK_ICON,
    readActivityDockMode,
    "app",
  );
  const [inspectorTick, setInspectorTick] = useState(0);
  const inspectorOpen = inspecting.length > 0;
  useEffect(() => {
    if (!inspectorOpen) return;
    const timer = setInterval(() => setInspectorTick((count) => count + 1), frequency * 1000);
    return () => clearInterval(timer);
  }, [inspectorOpen, frequency]);
  const usage = useAccountUsage(inspectorOpen, inspectorTick);
  const searchRef = useRef<HTMLInputElement>(null);
  const launch = use(DesktopWindowHostContext)?.launch;
  const quitSelected = () => {
    if (quittable.length === 0) return;
    setAsked(quittable);
    setAsking(true);
  };
  const quitAsked = () => {
    for (const app of asked) onQuit?.(app.id);
    setSelection([]);
  };
  const inspect = () => {
    const ids = selected.map((app) => app.id);
    if (ids.length > 0) setInspecting((open) => [...new Set([...open, ...ids])]);
  };
  const clearHistory = () => {
    setHistory([]);
    setTrips({});
  };
  const find = () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  };
  const chosenRows = rows.filter((row) => selection.includes(row.id));
  const tableText = (shown: typeof rows) =>
    [
      columns.map((column) => column.title).join("\t"),
      ...shown.map((row) =>
        columns
          .map((column) => (column.id === "name" ? row.name : (row.cells[column.id] ?? "")))
          .join("\t"),
      ),
    ].join("\n");
  const copy = () => {
    if (chosenRows.length > 0) void copyText(tableText(chosenRows));
  };
  const selectAll = () => setSelection(rows.map((row) => row.id));
  const front = () => launch?.(SELF.id);
  const consoleProcess =
    chosenRows.length === 1 && (view === "applications" || view === "ferrite")
      ? chosenRows[0]?.id
      : undefined;
  const showInConsole = () => {
    if (!consoleProcess || !launch) return;
    const layout = desktopValues()["console.layout"];
    changeDesktopValue("console.layout", {
      ...(isRecord(layout) ? layout : {}),
      source: "device",
      scope: "all",
      query: `process:${consoleProcess}`,
    });
    launch("console");
  };
  // The search field keeps Edit's commands while it is what the person is typing in: a menu takes
  // the keyboard as it opens, and leaves the field its selection.
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const heard = (event: FocusEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[role='menu'], [role='menubar']")) return;
      setEditing(target === searchRef.current);
    };
    document.addEventListener("focusin", heard);
    return () => document.removeEventListener("focusin", heard);
  }, []);
  const editCopy = () => {
    const field = searchRef.current;
    if (!editing || !field) copy();
    else if (field.selectionStart !== field.selectionEnd)
      void copyText(field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0));
  };
  const editSelectAll = () => {
    if (editing) setTimeout(() => commands.current.find(), 300);
    else selectAll();
  };
  const commands = useRef({
    quitSelected,
    inspect,
    clearHistory,
    find,
    copy,
    selectAll,
    editCopy,
    editSelectAll,
    front,
    showInConsole,
    setCpuUsage,
    setCpuHistory,
  });
  commands.current = {
    quitSelected,
    inspect,
    clearHistory,
    find,
    copy,
    selectAll,
    editCopy,
    editSelectAll,
    front,
    showInConsole,
    setCpuUsage,
    setCpuHistory,
  };
  // A sheet in front holds the window's keys: nothing behind it can be chosen.
  const takesKeys = windowState === "key" && !asking && !saving && saveFailure === undefined;
  useEffect(() => {
    if (!takesKeys) return;
    return onMenuKeyEquivalents(window, {
      "option+command+q": () => commands.current.quitSelected(),
      "command+i": () => commands.current.inspect(),
      "command+k": () => commands.current.clearHistory(),
      "option+command+f": () => commands.current.find(),
      // Selected text and a text field keep Copy and Select All: the rows take them otherwise.
      "command+c": () => {
        if (document.getSelection()?.toString() || inTextField()) document.execCommand("copy");
        else commands.current.copy();
      },
      "command+a": () => {
        if (inTextField()) document.execCommand("selectAll");
        else commands.current.selectAll();
      },
      "command+1": () => commands.current.front(),
      "command+2": () => commands.current.setCpuUsage(true),
      "command+3": () => commands.current.setCpuHistory(true),
    });
  }, [takesKeys]);
  // With a CPU window in front the menu's Window keys still work, as they do on a Mac.
  const [usageKey, setUsageKey] = useState(false);
  const [historyKey, setHistoryKey] = useState(false);
  const cpuWindowKey = usageKey || historyKey;
  useEffect(() => {
    if (!cpuWindowKey) return;
    return onMenuKeyEquivalents(window, {
      "command+1": () => commands.current.front(),
      "command+2": () => commands.current.setCpuUsage(true),
      "command+3": () => commands.current.setCpuHistory(true),
    });
  }, [cpuWindowKey]);
  const canQuit = quittable.length > 0;
  const canInspect = selected.length > 0;
  const canShowInConsole = consoleProcess !== undefined;
  const canCopy = chosenRows.length > 0;
  const canEditCopy = canCopy || editing;
  const filterValue = pinned ? "selected" : filter;
  const filterItems = useMemo(
    () =>
      view === "applications" ? (
        <>
          <MenuRadioGroup
            value={filterValue}
            onValueChange={(next) => {
              if (next === "selected") setPinned(selectionRef.current);
              else {
                setPinned(null);
                setFilter(next as ProcessFilter);
              }
            }}
          >
            <MenuRadioItem value="all">All Processes</MenuRadioItem>
            <MenuRadioItem value="windowed">Windowed Processes</MenuRadioItem>
            <MenuRadioItem value="selected" disabled={!canInspect && !pinned}>
              Selected Processes
            </MenuRadioItem>
          </MenuRadioGroup>
          <MenuItem disabled>Other filters need processes a web page is not shown.</MenuItem>
          <MenuSeparator />
        </>
      ) : null,
    [view, filterValue, setFilter, canInspect, pinned],
  );
  const viewMenu = useMemo(
    () => (
      <>
        <MenuRadioGroup
          value={view}
          onValueChange={(next) => {
            setView(next as View);
            setSelection([]);
          }}
        >
          {VIEWS.map((entry) => (
            <MenuRadioItem key={entry.id} value={entry.id}>
              {entry.title}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        {columnItems}
        {filterItems}
        <Submenu>
          <SubmenuTrigger>Update Frequency</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={String(frequency)}
              onValueChange={(next) => setFrequency(Number(next))}
            >
              {FREQUENCIES.map(([seconds, title]) => (
                <MenuRadioItem key={seconds} value={String(seconds)}>
                  {title}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <MenuItem keyEquivalent="command+k" onClick={() => commands.current.clearHistory()}>
          Clear History
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+i"
          disabled={!canInspect}
          onClick={() => commands.current.inspect()}
        >
          Inspect Process
        </MenuItem>
        <MenuItem
          keyEquivalent="option+command+q"
          disabled={!canQuit}
          onClick={() => commands.current.quitSelected()}
        >
          Quit Process
        </MenuItem>
        <MenuItem disabled={!canShowInConsole} onClick={() => commands.current.showInConsole()}>
          Show in Console
        </MenuItem>
        <MenuItem disabled>Sample Process</MenuItem>
        <MenuItem disabled>Run Spindump</MenuItem>
        <MenuItem disabled>Run System Diagnostics</MenuItem>
        <MenuItem disabled>Show Deltas for Process</MenuItem>
        <Submenu>
          <SubmenuTrigger>Dock Icon</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={dockIcon}
              onValueChange={(next) => setDockIcon(next as ActivityDockMode)}
            >
              <MenuRadioItem value="app">Show Application Icon</MenuRadioItem>
              <MenuRadioItem value="cpu">Show CPU Usage</MenuRadioItem>
              <MenuRadioItem value="history">Show CPU History</MenuRadioItem>
            </MenuRadioGroup>
            <MenuItem disabled>Show Network Usage</MenuItem>
            <MenuItem disabled>Show Disk Activity</MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuItem disabled>A web page cannot sample a process or send it a signal.</MenuItem>
        <MenuItem disabled>
          The Dock's graph is this page's main thread; a page reads no network or disk activity.
        </MenuItem>
      </>
    ),
    [
      dockIcon,
      setDockIcon,
      view,
      setView,
      frequency,
      setFrequency,
      canInspect,
      canQuit,
      canShowInConsole,
      columnItems,
      filterItems,
    ],
  );
  useDesktopAppMenu("activity-monitor", "View", viewMenu, titleBar);
  const fileMenu = useMemo(
    () => (
      <>
        <MenuItem onClick={() => setSaving(true)}>Save…</MenuItem>
        <MenuSeparator />
      </>
    ),
    [],
  );
  useDesktopAppMenu("activity-monitor", "File", fileMenu, titleBar);
  const editMenu = useMemo(
    () => (
      <>
        <MenuItem disabled title="Nothing in Activity Monitor can be undone.">
          Undo
        </MenuItem>
        <MenuItem disabled title="Nothing in Activity Monitor can be undone.">
          Redo
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled title="The lists can only be copied from.">
          Cut
        </MenuItem>
        <MenuItem
          keyEquivalent="command+c"
          disabled={!canEditCopy}
          onClick={() => commands.current.editCopy()}
        >
          Copy
        </MenuItem>
        <MenuItem disabled title="The lists can only be copied from.">
          Paste
        </MenuItem>
        <MenuItem keyEquivalent="command+a" onClick={() => commands.current.editSelectAll()}>
          Select All
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="option+command+f"
          // The menu holds the keyboard until it has faded out (`menu.css`: 0.25 s after a choice).
          onClick={() => setTimeout(() => commands.current.find(), 300)}
        >
          Find
        </MenuItem>
      </>
    ),
    [canEditCopy],
  );
  useDesktopAppMenu("activity-monitor", "Edit", editMenu, titleBar);
  const windowMenu = useMemo(
    () => (
      <>
        <MenuItem keyEquivalent="command+1" onClick={() => commands.current.front()}>
          Activity Monitor
        </MenuItem>
        <MenuItem keyEquivalent="command+2" onClick={() => commands.current.setCpuUsage(true)}>
          CPU Usage
        </MenuItem>
        <MenuItem keyEquivalent="command+3" onClick={() => commands.current.setCpuHistory(true)}>
          CPU History
        </MenuItem>
        <MenuItem disabled>A web page is shown nothing of the GPU.</MenuItem>
      </>
    ),
    [],
  );
  useDesktopAppMenu("activity-monitor", "Window", windowMenu, titleBar);
  const helpMenu = useMemo(
    () =>
      launch ? (
        <MenuItem onClick={() => requestHelp("Activity Monitor")}>Activity Monitor Help</MenuItem>
      ) : null,
    [launch],
  );
  useDesktopAppMenu("activity-monitor", "Help", helpMenu, titleBar);

  const total = ferrite?.total;
  const unknown = failed && !ferrite;
  const health = roundTripStats(trips.health?.samples ?? []);
  // The whole name is in the value's title.
  const instance = ferrite?.instance || "—";

  return (
    <Window
      width={width}
      height={height}
      state={asking && windowState === "key" ? "main" : windowState}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        variant="unified"
        title="Activity Monitor (This Desktop)"
        controls={
          <WindowControls
            closeDisabled={asking}
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar
          aria-label="Toolbar"
          inert={asking}
          style={{ height: 34, ["--mac-toolbar-padding-top" as string]: "3.5px" }}
        >
          <div className="mac-activity-monitor-toolbar-group" style={{ minWidth: "max-content" }}>
            <ToolbarButton
              aria-label="Quit Process"
              disabled={!canQuit}
              onClick={quitSelected}
              style={{ width: 31, padding: 0 }}
            >
              <SystemImage name="stop-progress" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Inspect"
              disabled={!canInspect}
              onClick={inspect}
              style={{ width: 31, padding: 0 }}
            >
              <SystemImage name="info" scale={14 / 15} />
            </ToolbarButton>
            <Menu>
              <MenuTrigger
                render={
                  <ToolbarButton
                    aria-label="Action"
                    style={{ width: 37, padding: "1px 0 0 1.5px", gap: 6 }}
                  >
                    <SystemImage name="action" />
                    <SystemImage name="chevron-down" scale={7.5 / 7} />
                  </ToolbarButton>
                }
              />
              <MenuPopup sideOffset={4}>
                <MenuItem disabled={!canQuit} onClick={quitSelected}>
                  Quit Process
                </MenuItem>
                <MenuItem disabled={!canInspect} onClick={inspect}>
                  Inspect Process
                </MenuItem>
                <MenuItem disabled={!canCopy} onClick={copy}>
                  Copy
                </MenuItem>
                <MenuSeparator />
                <MenuRadioGroup
                  value={String(frequency)}
                  onValueChange={(next) => setFrequency(Number(next))}
                >
                  {FREQUENCIES.map(([seconds, title]) => (
                    <MenuRadioItem key={seconds} value={String(seconds)}>
                      {title}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          </div>
          <ToolbarSegmentedControl
            aria-label="View"
            value={[view]}
            onValueChange={(next) => {
              const chosen = VIEWS.find((entry) => entry.id === next[0]);
              if (!chosen) return;
              setView(chosen.id);
              setSelection([]);
            }}
            // Seven views, against the Mac's five: as wide as their titles need.
            style={{ width: "max-content", flexShrink: 0 }}
          >
            {VIEWS.map((entry) => (
              <ToolbarSegment key={entry.id} value={entry.id}>
                {entry.title}
              </ToolbarSegment>
            ))}
          </ToolbarSegmentedControl>
          <div className="mac-activity-monitor-toolbar-group" data-side="trailing">
            <ToolbarSearchField
              inputRef={searchRef}
              value={query}
              onValueChange={setQuery}
              style={{ flex: "0 1 197px", minWidth: 0 }}
            />
          </div>
        </Toolbar>
      </TitleBar>
      <WindowBody background="content" className="mac-activity-monitor-body" inert={asking}>
        <ContextualMenu>
          <ContextualMenuTrigger
            className="mac-activity-monitor-table-frame"
            onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
              const id = (event.target as Element)
                .closest("[role='row']")
                ?.querySelector("[data-app-row]")
                ?.getAttribute("data-app-row");
              if (id && !selection.includes(id)) setSelection([id]);
            }}
          >
            <TableView
              aria-label={VIEWS.find((entry) => entry.id === view)?.title ?? "Applications"}
              className="mac-activity-monitor-table"
              columns={columns}
              onColumnResize={(id, width) =>
                setWidths({ ...widths, [`${view}.${id}`]: Math.round(width) })
              }
              headerProps={{
                onColumnMove: (id, before) =>
                  setOrders({
                    ...orders,
                    [view]: movedColumn(
                      columnsInOrder(COLUMNS[view], orders[view]).map((column) => column.id),
                      id,
                      before,
                    ),
                  }),
              }}
              rowCount={rows.length}
              rowHeight={18}
              size="small"
              alternatingRows
              selectionMode="multiple"
              getRowId={(row) => rows[row]?.id ?? ""}
              getRowLabel={(row) => rows[row]?.name ?? ""}
              value={selection}
              onValueChange={setSelection}
              onRowAction={(row) => {
                const id = rows[row]?.id;
                if (view === "applications" && id)
                  setInspecting((open) => [...new Set([...open, id])]);
              }}
              sort={sorts[view]}
              onSortChange={(next) => setSorts({ ...sorts, [view]: next })}
              renderCell={(row, column) => {
                const entry = rows[row];
                if (!entry) return null;
                if (column.id === "name") {
                  return (
                    <span className="mac-activity-monitor-name" data-app-row={entry.id}>
                      <ProcessIcon kind={view === "applications" ? "application" : "none"} />
                      <span className="mac-activity-monitor-name-text">{entry.name}</span>
                    </span>
                  );
                }
                return entry.cells[column.id] ?? "";
              }}
            />
          </ContextualMenuTrigger>
          <ContextualMenuPopup>
            <MenuItem disabled={!canQuit} onClick={quitSelected}>
              Quit Process
            </MenuItem>
            <MenuItem disabled={!canInspect} onClick={inspect}>
              Inspect Process
            </MenuItem>
            <MenuItem disabled={!canCopy} onClick={copy}>
              Copy
            </MenuItem>
            <MenuItem disabled={!canShowInConsole} onClick={showInConsole}>
              Show in Console
            </MenuItem>
            <MenuSeparator />
            {columnItems}
          </ContextualMenuPopup>
        </ContextualMenu>
        {pageView(view) ? (
          <Label textStyle="small" className="mac-activity-monitor-statement">
            {PAGE_STATEMENTS[view as PageView]}
          </Label>
        ) : null}
        <div className="mac-activity-monitor-footer">
          <Box
            variant="well"
            aria-label="Summary: the desktop's windows, and how fast its Ferrite application answers"
            className="mac-activity-monitor-summary"
          >
            <div className="mac-activity-monitor-cells">
              <Statistics
                lines={
                  view === "applications"
                    ? [
                        { label: "Applications:", value: number(applications.length) },
                        {
                          label: "Windows:",
                          value: number(applications.reduce((sum, app) => sum + app.windows, 0)),
                        },
                        {
                          label: "Minimized:",
                          value: number(applications.reduce((sum, app) => sum + app.minimized, 0)),
                        },
                      ]
                    : [
                        {
                          label: "Generation:",
                          value:
                            ferrite && ferrite.generation !== null
                              ? number(ferrite.generation)
                              : "—",
                        },
                        { label: "Instance:", value: instanceShown(instance), whole: instance },
                        { label: "Round Trip:", value: msText(health?.median ?? null) },
                      ]
                }
              />
              <div className="mac-activity-monitor-graph">
                <div className="mac-activity-monitor-graph-title">
                  {view === "cpu" ? "MAIN THREAD" : "SERVER TIME"}
                </div>
                {view === "cpu" ? (
                  <Graph
                    history={busyHistory}
                    tab="cpu"
                    maximum={100}
                    label="How busy this page's main thread was, every second"
                  />
                ) : (
                  <Graph
                    history={history}
                    tab="network"
                    label="Median and 95th-percentile server time, every 2 seconds"
                  />
                )}
              </div>
              <Statistics
                lines={[
                  {
                    label: "Requests/s:",
                    value: unknown || !total ? "—" : total.perSecond.toFixed(2),
                    tone: "lower",
                  },
                  { label: "Median:", value: unknown || !total ? "—" : msText(total.p50Ms) },
                  {
                    label: "95th %:",
                    value: unknown || !total ? "—" : msText(total.p95Ms),
                    tone: "upper",
                  },
                ]}
              />
            </div>
          </Box>
        </div>
      </WindowBody>
      <Sheet open={saving} onOpenChange={setSaving}>
        <SheetPopup anchor={titleBar} width={640} aria-label="Save the Report">
          {saving ? (
            <DriveSavePanel
              defaultName={`Activity Monitor ${VIEWS.find((entry) => entry.id === view)?.title ?? ""}.txt`}
              defaultFolder="documents"
              defaultExpanded
              onSave={(target) => {
                setSaving(false);
                saveToDrive(target, new Blob([tableText(rows)], { type: "text/plain" })).catch(
                  (error: unknown) =>
                    setSaveFailure(error instanceof Error ? error.message : String(error)),
                );
              }}
              onCancel={() => setSaving(false)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Sheet
        open={saveFailure !== undefined}
        onOpenChange={(open) => {
          if (!open) setSaveFailure(undefined);
        }}
      >
        <SheetPopup anchor={titleBar} width={420}>
          <SheetTitle>The report could not be saved.</SheetTitle>
          <SheetDescription>{saveFailure}</SheetDescription>
          <SheetActions>
            <SheetClose render={<DefaultButton />}>OK</SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      <Sheet open={asking} onOpenChange={setAsking}>
        <SheetPopup anchor={titleBar} width={420}>
          <SheetTitle>
            {asked.length > 1
              ? `Are you sure you want to quit these ${asked.length} processes?`
              : "Are you sure you want to quit this process?"}
          </SheetTitle>
          <SheetDescription>
            Do you really want to quit {asked.map((app) => `“${app.name}”`).join(", ")}?
            {asked.some((app) => app.relaunches)
              ? " Finder's windows close and it starts again."
              : ""}
          </SheetDescription>
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            {/* A page's window has no process to kill: both close its windows at once. */}
            <SheetClose onClick={quitAsked}>Force Quit</SheetClose>
            <SheetClose render={<DefaultButton />} onClick={quitAsked}>
              Quit
            </SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      {PanelWindow
        ? inspecting.map((id) => {
            const app = applications.find((candidate) => candidate.id === id);
            const served = ferrite?.apps.find((candidate) => candidate.name === id);
            const kept = usage?.apps.find((candidate) => candidate.name === id);
            const name = app?.name ?? running.find((each) => each.id === id)?.name ?? id;
            return (
              <PanelWindow
                key={id}
                id={`inspect-${id}`}
                title={name}
                panel
                resizable={false}
                defaultSize={{ width: 320, height: 270 }}
                onClose={() => setInspecting((open) => open.filter((each) => each !== id))}
                render={(panelProps) => (
                  <InspectorPanel
                    facts={{
                      name,
                      lines: [
                        { label: "Windows:", value: number(app?.windows ?? 0) },
                        { label: "Minimized:", value: number(app?.minimized ?? 0) },
                        {
                          label: "Requests, 5 minutes:",
                          value: served ? number(served.requests) : "None",
                        },
                        { label: "Median:", value: msText(served?.p50Ms ?? null) },
                        { label: "Failed:", value: served ? number(served.errors) : "None" },
                        { label: "Kept for you:", value: kept ? bytesText(kept.bytes) : "—" },
                      ],
                    }}
                    canQuit={app?.quittable === true}
                    onQuit={() => {
                      if (!app) return;
                      setAsked([app]);
                      setAsking(true);
                    }}
                    windowProps={panelProps}
                  />
                )}
              />
            );
          })
        : null}
      {PanelWindow && cpuUsage ? (
        <PanelWindow
          id="cpu-usage"
          title="CPU Usage"
          panel
          resizable={false}
          defaultSize={{ width: 260, height: 110 }}
          onClose={() => setCpuUsage(false)}
          render={(panelProps) => (
            <>
              <ReportKey state={panelProps.state} report={setUsageKey} />
              <CpuUsagePanel busy={thread.busy} windowProps={panelProps} />
            </>
          )}
        />
      ) : null}
      {PanelWindow && cpuHistory ? (
        <PanelWindow
          id="cpu-history"
          title="CPU History"
          panel
          resizable={false}
          defaultSize={{ width: 260, height: 160 }}
          onClose={() => setCpuHistory(false)}
          render={(panelProps) => (
            <>
              <ReportKey state={panelProps.state} report={setHistoryKey} />
              <CpuHistoryPanel history={busyHistory} windowProps={panelProps} />
            </>
          )}
        />
      ) : null}
    </Window>
  );
}

/** Tells its owner whether the window it is rendered in is the key window. */
function ReportKey({ state, report }: { state?: string; report: (key: boolean) => void }) {
  useEffect(() => {
    report(state === "key");
    return () => report(false);
  }, [state, report]);
  return null;
}

/**
 * Activity Monitor as the desktop shows it. When the `macalicious-desktop` Ferrite application
 * serves the desktop, the window lists the desktop's own running applications with their windows
 * (Quit Process quits one, as Force Quit does); the Ferrite view shows, per app, the requests per
 * second, median and 95th-percentile server time, store calls per request and failed requests the application measured of
 * itself over the last five minutes, with the deployment generation and instance answering; the
 * Network view shows the round trips the browser itself timed to the application. The CPU, Memory,
 * Energy and Disk views show what the page measures of itself and what the browser and the server
 * report (`activity-monitor-page.ts`), and say that a page is shown nothing of the computer's. Every
 * other build shows the invented processes, as `ActivityMonitor` does.
 */
export function DesktopActivityMonitor({
  runningApplications,
  onQuitApplication,
  DesktopWindow,
  onFrameSizeChange: _frame,
  preferencesOpen: _preferences,
  onPreferencesOpenChange: _preferencesChange,
  settings: _settings,
  defaultUpdateInterval,
  ...props
}: DesktopWindowProps & Pick<ActivityMonitorProps, "defaultUpdateInterval">) {
  if (!servedByDesktopApp()) {
    return <ActivityMonitor {...props} defaultUpdateInterval={defaultUpdateInterval} />;
  }
  return (
    <ServedActivityMonitor
      {...props}
      running={runningApplications ?? []}
      onQuit={onQuitApplication}
      panelWindow={DesktopWindow}
    />
  );
}
