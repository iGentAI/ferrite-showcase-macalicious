"use client";

import { Box } from "macalicious/box";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { SystemImage } from "macalicious/system-image";
import { TableView, type TableViewColumn, type TableViewProps } from "macalicious/table-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  type ActivityMonitorProcess,
  type ActivityMonitorSample,
  type ActivityMonitorState,
  type ActivityMonitorStatistic,
  type ActivityMonitorTab,
  type ActivityMonitorTotals,
  advance,
  arrange,
  COLUMNS,
  createState,
  DEFAULT_SORT,
  defaultProcesses,
  defaultTotals,
  quit,
  summarize,
  TABS,
} from "./activity-monitor-data";
import { ProcessIcon } from "./activity-monitor-icons";
import "./activity-monitor.tokens.css";
import "./activity-monitor.css";

type Sort = NonNullable<TableViewProps["sort"]>;
type Selection = NonNullable<TableViewProps["value"]>;

export interface ActivityMonitorProps extends Omit<WindowProps, "children"> {
  /**
   * The processes the window opens with. The simulation moves their numbers from there; a
   * later change of the prop is not followed.
   * @default defaultProcesses
   */
  processes?: readonly ActivityMonitorProcess[];
  /**
   * The footer's figures for the whole machine when the window opens.
   * @default defaultTotals
   */
  totals?: ActivityMonitorTotals;
  /** Points the graphs start with, oldest first. Without it they fill as the numbers move. */
  history?: readonly ActivityMonitorSample[];
  /**
   * Milliseconds between two updates of the numbers when the window opens; the Action menu
   * changes it. `0` opens the window with the updates paused.
   * @default 2000
   */
  defaultUpdateInterval?: number;
  /** The view shown (controlled). */
  tab?: ActivityMonitorTab;
  /**
   * The view shown at first (uncontrolled).
   * @default "cpu"
   */
  defaultTab?: ActivityMonitorTab;
  /** Called with the view chosen in the toolbar. */
  onTabChange?: (tab: ActivityMonitorTab) => void;
  /** Identifier of the process selected at first. */
  defaultSelectedPid?: number;
  /**
   * Called with the selected process when Inspect is chosen, and with a row's process when
   * it is double-clicked or Return is pressed on it. A host shows the process's details.
   */
  onInspect?: (process: ActivityMonitorProcess) => void;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

type Action = { type: "tick"; seconds: number } | { type: "quit"; pid: number };

function reduce(state: ActivityMonitorState, action: Action): ActivityMonitorState {
  return action.type === "tick" ? advance(state, action.seconds) : quit(state, action.pid);
}

/** The update frequencies of the Action menu, in milliseconds; 0 pauses the updates. */
const FREQUENCIES = [
  [1000, "Update Very Often (1 sec)"],
  [2000, "Update Often (2 sec)"],
  [5000, "Update Normally (5 sec)"],
  [0, "Pause Updates"],
] as const;

/* The graph: 5 pt a point, the newest at the trailing edge. */
const GRAPH_WIDTH = 178;
const GRAPH_HEIGHT = 62;
const GRAPH_STEP = 5;

/** The footer's graph of one view's history; exported for the desktop's served window. */
export function Graph({
  history,
  tab,
  maximum,
  label,
}: {
  history: readonly ActivityMonitorSample[];
  tab: ActivityMonitorTab;
  maximum?: number;
  label: string;
}) {
  const points = history
    .slice(-(Math.floor(GRAPH_WIDTH / GRAPH_STEP) + 2))
    .map((sample) => sample[tab]);
  const top = maximum ?? Math.max(1e-9, ...points.map(([lower, upper]) => lower + upper)) * 1.1;
  const x = (index: number) => GRAPH_WIDTH - (points.length - 1 - index) * GRAPH_STEP;
  const y = (value: number) =>
    Math.round((GRAPH_HEIGHT - Math.min(1, Math.max(0, value / top)) * GRAPH_HEIGHT) * 100) / 100;
  const lower = points.map(([value], index) => `${x(index)} ${y(value)}`);
  const upper = points.map(([value, more], index) => `${x(index)} ${y(value + more)}`);
  const first = x(0);
  return (
    <svg
      className="mac-activity-monitor-graph-plot"
      role="img"
      aria-label={label}
      width={GRAPH_WIDTH}
      height={GRAPH_HEIGHT}
      viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
    >
      {points.length > 1 ? (
        <>
          <path
            className="mac-activity-monitor-graph-upper"
            d={`M${upper.join("L")}L${[...lower].reverse().join("L")}Z`}
          />
          <path
            className="mac-activity-monitor-graph-lower"
            d={`M${first} ${GRAPH_HEIGHT}L${lower.join("L")}L${GRAPH_WIDTH} ${GRAPH_HEIGHT}Z`}
          />
          <path className="mac-activity-monitor-graph-line" d={`M${upper.join("L")}`} />
        </>
      ) : null}
    </svg>
  );
}

/** The footer's lines of figures; exported for the desktop's served window. */
export function Statistics({ lines }: { lines: readonly ActivityMonitorStatistic[] }) {
  return (
    <div className="mac-activity-monitor-statistics">
      {/* The 12 pt text style; the lines are a description list. */}
      <Label textStyle="callout" render={<dl />} style={{ display: "block" }}>
        {lines.map((line) => (
          <div key={line.label} className="mac-activity-monitor-statistic">
            <dt className="mac-activity-monitor-statistic-label">{line.label}</dt>
            <dd
              className="mac-activity-monitor-statistic-value"
              data-tone={line.tone}
              title={line.whole ?? line.value}
            >
              {line.value}
            </dd>
          </div>
        ))}
      </Label>
    </div>
  );
}

/**
 * The Activity Monitor window of macOS 10.15: a toolbar with the five views and a search
 * field, the sortable process table, and the footer with the view's statistics and graph.
 * The processes are invented and a timer moves their numbers. Quit Process asks in a sheet
 * before it removes the process.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function ActivityMonitor({
  processes = defaultProcesses,
  totals = defaultTotals,
  history,
  defaultUpdateInterval = 2000,
  tab: tabProp,
  defaultTab = "cpu",
  onTabChange,
  defaultSelectedPid,
  onInspect,
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
}: ActivityMonitorProps) {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    createState(processes, totals, history),
  );
  const [interval, setUpdateInterval] = useState(defaultUpdateInterval);
  const [ownTab, setOwnTab] = useState(defaultTab);
  const tab = tabProp ?? ownTab;
  const [sorts, setSorts] = useState<Record<ActivityMonitorTab, Sort>>(DEFAULT_SORT);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>(
    defaultSelectedPid === undefined ? [] : [defaultSelectedPid],
  );

  useEffect(() => {
    if (!(interval > 0)) return;
    const timer = setInterval(() => dispatch({ type: "tick", seconds: interval / 1000 }), interval);
    return () => clearInterval(timer);
  }, [interval]);

  const definitions = COLUMNS[tab];
  const columns = useMemo(
    () =>
      definitions.map(
        (column): TableViewColumn => ({
          id: column.id,
          title: column.title,
          width: column.width,
          minWidth: column.width === undefined ? 150 : undefined,
          // Activity Monitor centres every heading, over right-aligned numbers and
          // left-aligned names.
          align: column.kind === "number" ? "right" : "left",
          headerAlign: "center",
          sortable: true,
        }),
      ),
    [definitions],
  );
  const sort = sorts[tab];
  const rows = useMemo(
    () =>
      arrange(
        state.processes,
        definitions.find((column) => column.id === sort.column),
        sort.direction,
        query,
      ),
    [state.processes, definitions, sort, query],
  );

  // Among the listed rows: while a search hides the selected process, the commands that need
  // one are unavailable, and the selection is back when the search shows the process again.
  const selected = rows.find((process) => process.pid === selection[0]);
  const summary = summarize(tab, state);
  const viewTitle = TABS.find((view) => view.id === tab)?.title ?? "";
  // The sheet hangs from the title bar. `asked` is the process it asks about, kept while the
  // sheet slides away.
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [asked, setAsked] = useState<ActivityMonitorProcess>();
  const [asking, setAsking] = useState(false);
  const quitSelected = () => {
    if (!selected) return;
    setAsked(selected);
    setAsking(true);
  };
  const quitAsked = () => {
    if (!asked) return;
    dispatch({ type: "quit", pid: asked.pid });
    setSelection((current) => current.filter((pid) => pid !== asked.pid));
  };
  const inspectSelected = () => {
    if (selected) onInspect?.(selected);
  };

  return (
    // While its sheet is open the window is main, not key, and everything in it is held.
    <Window
      width={width}
      height={height}
      state={asking && windowState === "key" ? "main" : windowState}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        variant="unified"
        title="Activity Monitor (My Processes)"
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
        {/* Activity Monitor's chrome is 56 pt, a point more than the library's unified bar: its
            controls start and end half a point lower (measured in both captures). */}
        <Toolbar
          aria-label="Toolbar"
          inert={asking}
          style={{ height: 34, ["--mac-toolbar-padding-top" as string]: "3.5px" }}
        >
          <div className="mac-activity-monitor-toolbar-group">
            <ToolbarButton
              aria-label="Quit Process"
              disabled={!selected}
              onClick={quitSelected}
              style={{ width: 31, padding: 0 }}
            >
              <SystemImage name="stop-progress" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Inspect"
              disabled={!selected}
              onClick={inspectSelected}
              style={{ width: 31, padding: 0 }}
            >
              {/* The capture's disc is 14 pt; the library's is 15. */}
              <SystemImage name="info" scale={14 / 15} />
            </ToolbarButton>
            {/* Measured: the gear starts 6 pt into the bezel and half a point under its centre,
                and the chevron, 7.5 pt wide, 6 pt after the gear. */}
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
                <MenuItem disabled={!selected} onClick={quitSelected}>
                  Quit Process
                </MenuItem>
                <MenuItem disabled={!selected} onClick={inspectSelected}>
                  Inspect Process
                </MenuItem>
                <MenuSeparator />
                <MenuRadioGroup
                  value={String(interval)}
                  onValueChange={(value) => setUpdateInterval(Number(value))}
                >
                  {FREQUENCIES.map(([milliseconds, title]) => (
                    <MenuRadioItem key={milliseconds} value={String(milliseconds)}>
                      {title}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          </div>
          <ToolbarSegmentedControl
            aria-label="View"
            value={[tab]}
            onValueChange={(next) => {
              const chosen = TABS.find((view) => view.id === next[0]);
              if (!chosen) return;
              setOwnTab(chosen.id);
              onTabChange?.(chosen.id);
            }}
            style={{ width: 325 }}
          >
            {TABS.map((view) => (
              <ToolbarSegment key={view.id} value={view.id}>
                {view.title}
              </ToolbarSegment>
            ))}
          </ToolbarSegmentedControl>
          <div className="mac-activity-monitor-toolbar-group" data-side="trailing">
            <ToolbarSearchField
              value={query}
              onValueChange={setQuery}
              style={{ flex: "0 1 197px", minWidth: 0 }}
            />
          </div>
        </Toolbar>
      </TitleBar>
      <WindowBody background="content" className="mac-activity-monitor-body" inert={asking}>
        <TableView
          aria-label="Processes"
          className="mac-activity-monitor-table"
          columns={columns}
          rowCount={rows.length}
          rowHeight={18}
          size="small"
          alternatingRows
          getRowId={(row) => rows[row]?.pid ?? -1}
          getRowLabel={(row) => rows[row]?.name ?? ""}
          value={selection}
          onValueChange={setSelection}
          sort={sort}
          onSortChange={(next) => setSorts((current) => ({ ...current, [tab]: next }))}
          onRowAction={(row) => {
            const process = rows[row];
            if (process) onInspect?.(process);
          }}
          renderCell={(row, column) => {
            const process = rows[row];
            const definition = definitions.find((candidate) => candidate.id === column.id);
            if (!process || !definition) return null;
            if (definition.kind === "name") {
              return (
                <span className="mac-activity-monitor-name">
                  <ProcessIcon kind={process.icon} />
                  <span className="mac-activity-monitor-name-text">{process.name}</span>
                </span>
              );
            }
            return definition.text(process);
          }}
        />
        <div className="mac-activity-monitor-footer">
          <Box
            variant="well"
            aria-label={`${viewTitle} summary`}
            className="mac-activity-monitor-summary"
          >
            <div className="mac-activity-monitor-cells">
              <Statistics lines={summary.leading} />
              <div className="mac-activity-monitor-graph">
                <div className="mac-activity-monitor-graph-title">{summary.graphTitle}</div>
                <Graph
                  history={state.history}
                  tab={tab}
                  maximum={summary.graphMaximum}
                  label={`${viewTitle} history`}
                />
              </div>
              <Statistics lines={summary.trailing} />
            </div>
          </Box>
        </div>
      </WindowBody>
      {/* Rendered in a portal, so the window stays the root element. */}
      <Sheet open={asking} onOpenChange={setAsking}>
        <SheetPopup anchor={titleBar} width={420}>
          <SheetTitle>Are you sure you want to quit this process?</SheetTitle>
          <SheetDescription>Do you really want to quit “{asked?.name}”?</SheetDescription>
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <SheetClose onClick={quitAsked}>Force Quit</SheetClose>
            <SheetClose render={<DefaultButton />} onClick={quitAsked}>
              Quit
            </SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </Window>
  );
}
