"use client";

import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { OutlineView } from "macalicious/outline-view";
import { PullDownButton } from "macalicious/pull-down-button";
import { ScopeBar, ScopeBarButton, ScopeBarGroup } from "macalicious/scope-bar";
import { ScrollView } from "macalicious/scroll-view";
import { SearchField } from "macalicious/search-field";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { StatusBar } from "macalicious/status-bar";
import { SystemImage } from "macalicious/system-image";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  type AutomatorCategory,
  type AutomatorItem,
  type AutomatorLibraryKind,
  actionLibrary,
  canRun,
  canStop,
  createWorkflow,
  findAction,
  findCategory,
  findVariable,
  formatDuration,
  libraryOf,
  listItems,
  reduceWorkflow,
  stepState,
  tintOf,
} from "./automator-data";
import {
  DisclosureGlyph,
  MediaGlyph,
  PlaceholderIcon,
  RecordGlyph,
  RunGlyph,
  StepGlyph,
  StopGlyph,
  VariablesGlyph,
} from "./automator-icons";
import "./automator.tokens.css";
import "./automator.css";

export interface AutomatorProps extends Omit<WindowProps, "children"> {
  /**
   * Id of the category selected in the Library outline when the window opens: `"library"`,
   * which lists every action, one of its thirteen categories (`"calendar"`, `"files"`,
   * `"fonts"` and so on), `"most-used"` or `"recently-added"`. An id that names no category
   * stands for `"library"`. A later change of the prop is not followed.
   * @default "library"
   */
  defaultCategory?: string;
  /**
   * Called with the id of the category chosen in the outline, and with the library it belongs
   * to: the outline lists the categories of actions or of variables.
   */
  onCategoryChange?: (id: string, library: AutomatorLibraryKind) => void;
  /**
   * Id of the action selected in the list when the window opens: its name in lower case with
   * hyphens for spaces. An id that names no action the list shows selects nothing, and the
   * description pane is then empty. A later change of the prop is not followed.
   * @default "activate-fonts"
   */
  defaultSelectedId?: string;
  /**
   * Ids of the actions the workflow holds when the window opens, in order; ids that name no
   * action are left out. Without it the workflow is empty, as in the capture. A later change
   * of the prop is not followed.
   */
  defaultWorkflow?: readonly string[];
  /** Called with the ids of the workflow's actions, in order, when a step is added or removed. */
  onWorkflowChange?: (actionIds: readonly string[]) => void;
  /**
   * Milliseconds Run takes for each step. `0`, or anything that is not a positive number,
   * runs the whole workflow at once.
   * @default 600
   */
  stepInterval?: number;
  /**
   * Whether the library, the part of the window before the workflow, is shown at first.
   * @default true
   */
  defaultLibraryShown?: boolean;
  /**
   * Whether the description pane under the library's lists is shown at first.
   * @default true
   */
  defaultDescriptionShown?: boolean;
  /** Called when Media is clicked. A host opens its media browser. */
  onShowMedia?: () => void;
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

/* The library opens 381 pt wide: the 163 pt outline, its line and the 217 pt list. */
const LIBRARY_WIDTH = 381;
/* Every list has 19 pt rows: an 18 pt highlight and a point under it. */
const ROW_HEIGHT = 19;

/* A toolbar button's fill is 38 pt wide, which with the toolbar's 8 pt gaps gives the 46 pt
   pitch of the capture; its item is as wide, so that a label does not move its neighbours. */
const BUTTON: CSSProperties = { width: 38, padding: 0 };
const ITEM: CSSProperties = { width: 38 };
/* The two scopes of the band: the pill is 71 pt wide, and "Variables" is centred where the
   capture has it. */
const ACTIONS_SCOPE: CSSProperties = { width: 71, padding: 0 };
const VARIABLES_SCOPE: CSSProperties = { width: 71, padding: 0 };
/* The search field takes what the band has left. */
const SEARCH: CSSProperties = { flex: "1 1 0", width: "auto" };
/* The capsule's centre is 9.5 pt above the middle of the workflow area (measured). */
const PLACEHOLDER: CSSProperties = { paddingBlockEnd: 39 };
/* The split view's hook for the colour of its lines: every divider of the window. */
const DIVIDER = {
  "--mac-split-view-divider-color": "var(--mac-automator-divider)",
} as CSSProperties;
/* The image button's documented hook: the clear space around a bottom bar's glyph. A toggle
   that is on is tinted, not darkened: the pressed brightness is the token's neutral value. */
const barButton = (padding: string, on = false) =>
  ({
    "--mac-image-button-padding": padding,
    ...(on && { "--mac-image-brightness-pressed": 1 }),
  }) as CSSProperties;

const NAME_COLUMN: readonly TableViewColumn[] = [{ id: "name" }];
/* Neither heading sorts: the log is chronological. */
const heading = (title: string) => <span className="mac-automator-heading">{title}</span>;
const LOG_COLUMNS: readonly TableViewColumn[] = [
  { id: "log", title: heading("Log"), minWidth: 120 },
  { id: "duration", title: heading("Duration"), width: 100 },
];
const VARIABLE_COLUMNS: readonly TableViewColumn[] = [
  { id: "name", title: heading("Variables"), minWidth: 120 },
  { id: "value", title: heading("Value"), width: 100 },
];

/* The element of a table that scrolls: its row group. */
const viewportOf = (table: HTMLElement | null) =>
  table?.querySelector<HTMLElement>('[role="rowgroup"]') ?? null;

/** A row of the outline or of the list: the placeholder icon, then the name. */
function Row({
  tint,
  inset,
  children,
}: {
  tint: AutomatorCategory["tint"];
  inset: number;
  children: string;
}) {
  return (
    <span className="mac-automator-row" style={{ marginInlineStart: inset }}>
      <PlaceholderIcon tint={tint} />
      <span className="mac-automator-row-name">{children}</span>
    </span>
  );
}

/**
 * The Automator window of macOS 10.15: an icon-and-label toolbar, the library (a switch
 * between actions and variables, a search field, the outline of categories beside the list,
 * and the description of the selected item), the workflow area, and the log under it. A double
 * click on an action adds it to the workflow as a step; Run goes through the steps and writes
 * the log. Nothing is automated: a step takes a time that depends only on its action's name.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function Automator({
  defaultCategory = "library",
  onCategoryChange,
  defaultSelectedId = "activate-fonts",
  defaultWorkflow,
  onWorkflowChange,
  stepInterval = 600,
  defaultLibraryShown = true,
  defaultDescriptionShown = true,
  onShowMedia,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1000,
  height = 868,
  className,
  ...windowProps
}: AutomatorProps) {
  const [workflow, dispatch] = useReducer(reduceWorkflow, defaultWorkflow, createWorkflow);
  const [kind, setKind] = useState<AutomatorLibraryKind>("actions");
  // Each library keeps its own category, its own selected item and its own open rows.
  const [categories, setCategories] = useState<Record<AutomatorLibraryKind, string>>(() => ({
    actions: findCategory(libraryOf("actions"), defaultCategory).category.id,
    variables: libraryOf("variables").root,
  }));
  const [selection, setSelection] = useState<Record<AutomatorLibraryKind, string | undefined>>({
    actions: defaultSelectedId,
    variables: undefined,
  });
  const [expanded, setExpanded] = useState<Record<AutomatorLibraryKind, readonly string[]>>(() => ({
    actions: [libraryOf("actions").root],
    variables: [libraryOf("variables").root],
  }));
  const [query, setQuery] = useState("");
  const [librarySize, setLibrarySize] = useState(defaultLibraryShown ? LIBRARY_WIDTH : 0);
  const libraryRestore = useRef(LIBRARY_WIDTH);
  const [descriptionShown, setDescriptionShown] = useState(defaultDescriptionShown);
  const [lowerView, setLowerView] = useState<"log" | "variables">("log");
  const logTable = useRef<HTMLDivElement>(null);
  // Whether the log is scrolled to its last row, which it then follows.
  const pinned = useRef(true);

  const library = libraryOf(kind);
  // The outline always shows a category: an id that names none stands for the root.
  const { category, parent } = findCategory(library, categories[kind]);
  const rows = useMemo(
    () => listItems(libraryOf(kind), category.id, query),
    [kind, category.id, query],
  );
  // Among the listed rows: while the category or a search hides the selected item the
  // description pane is empty, and the selection is back when the item is listed again.
  const selectedId = selection[kind];
  const selected = useMemo(() => rows.find((row) => row.id === selectedId), [rows, selectedId]);

  // Run: a timer for each step. Without an interval the steps that are left run at once,
  // also when the interval is taken away during a run.
  const running = workflow.status === "running";
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new timer for every step the run reaches
  useEffect(() => {
    if (!running) return;
    if (!(stepInterval > 0)) {
      dispatch({ type: "finish" });
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "advance" }), stepInterval);
    return () => clearTimeout(timer);
  }, [running, workflow.cursor, stepInterval]);

  // The steps as the host hears of them, once for each change after the first render.
  const reported = useRef(workflow.steps);
  useEffect(() => {
    if (reported.current === workflow.steps) return;
    reported.current = workflow.steps;
    onWorkflowChange?.(workflow.steps.map((step) => step.actionId));
  }, [workflow.steps, onWorkflowChange]);

  // The log follows its last row while it is scrolled to it: when a row is added, and when
  // the pane, the window or a divider changes the height of the table. A new run starts a new
  // log, which is followed again even when it is as long as the one before it.
  const logLength = workflow.log.length;
  const followedRun = useRef(workflow.run);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again when rows are added, when a run starts and when the log is shown again
  useLayoutEffect(() => {
    const viewport = viewportOf(logTable.current);
    if (logLength === 0 || followedRun.current !== workflow.run) pinned.current = true;
    followedRun.current = workflow.run;
    if (viewport && pinned.current) viewport.scrollTop = viewport.scrollHeight;
  }, [logLength, workflow.run, lowerView]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the table is another element after the lower pane changed its list
  useEffect(() => {
    const viewport = viewportOf(logTable.current);
    if (!viewport) return;
    const follow = () => {
      if (pinned.current) viewport.scrollTop = viewport.scrollHeight;
    };
    const onScroll = () => {
      pinned.current = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1;
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(follow);
    observer?.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [lowerView]);

  const chooseCategory = (id: string) => {
    if (id === category.id) return;
    setCategories((current) => ({ ...current, [kind]: id }));
    onCategoryChange?.(id, kind);
  };
  // An action becomes a step; a variable joins the workflow's variables, which are then shown.
  // The log is at its last row, and follows it, whenever it is shown again.
  const showLower = (view: "log" | "variables") => {
    if (view === "log" && lowerView !== "log") pinned.current = true;
    setLowerView(view);
  };
  const add = (item: AutomatorItem) => {
    if (kind === "actions") dispatch({ type: "add", actionId: item.id });
    else {
      dispatch({ type: "add-variable", id: item.id });
      showLower("variables");
    }
  };
  const libraryShown = librarySize > 0;
  const selectedAction = kind === "actions" ? findAction(selected?.id) : undefined;
  const selectedVariable = kind === "variables" ? findVariable(selected?.id) : undefined;
  const variables = workflow.variables.flatMap((id) => findVariable(id) ?? []);

  return (
    <Window
      width={width}
      height={height}
      className={cn("mac-automator", className)}
      {...windowProps}
    >
      <TitleBar
        variant="unified"
        title="Untitled"
        controls={
          <WindowControls
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
        {/* 22 pt of title strip and 46 pt of toolbar: Automator's 68 pt chrome. */}
        <Toolbar displayMode="icon-and-label" aria-label="Toolbar" style={{ height: 46 }}>
          {/* Library keeps the plain bezel and tints its glyph while the library is shown. */}
          <ToolbarLabelledItem label="Library" style={ITEM}>
            <ToolbarButton
              aria-pressed={libraryShown}
              className="mac-automator-toggle"
              style={BUTTON}
              onClick={() => {
                if (libraryShown) libraryRestore.current = librarySize;
                setLibrarySize(libraryShown ? 0 : libraryRestore.current);
              }}
            >
              <SystemImage name="sidebar" />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarLabelledItem label="Media" style={ITEM}>
            <ToolbarButton style={BUTTON} onClick={() => onShowMedia?.()}>
              <MediaGlyph />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarSpace />
          {/* Record is a toggle with the library's dark bezel while a recording is going. */}
          <ToolbarLabelledItem label="Record" style={ITEM}>
            <ToolbarButton
              pressed={workflow.recording}
              onPressedChange={() => dispatch({ type: "record" })}
              className="mac-automator-record"
              style={BUTTON}
              disabled={workflow.status !== "idle"}
            >
              <RecordGlyph />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarLabelledItem label="Step" style={ITEM}>
            <ToolbarButton
              style={BUTTON}
              disabled={!canRun(workflow)}
              onClick={() => dispatch({ type: "step" })}
            >
              <StepGlyph />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarLabelledItem label="Stop" style={ITEM}>
            <ToolbarButton
              style={BUTTON}
              disabled={!canStop(workflow)}
              onClick={() => dispatch({ type: "stop" })}
            >
              <StopGlyph />
            </ToolbarButton>
          </ToolbarLabelledItem>
          <ToolbarLabelledItem label="Run" style={ITEM}>
            <ToolbarButton
              style={BUTTON}
              disabled={!canRun(workflow)}
              onClick={() => dispatch({ type: "run", instant: !(stepInterval > 0) })}
            >
              <RunGlyph />
            </ToolbarButton>
          </ToolbarLabelledItem>
        </Toolbar>
      </TitleBar>
      <WindowBody background="content" className="mac-automator-body">
        <SplitView className="mac-automator-split" style={DIVIDER}>
          <SplitViewPane
            size={librarySize}
            onSizeChange={setLibrarySize}
            minSize={300}
            maxSize={520}
            collapsible
            className="mac-automator-column"
          >
            <ScopeBar className="mac-automator-band">
              <ScopeBarGroup
                aria-label="Library"
                value={kind}
                onValueChange={(value) => setKind(value === "variables" ? "variables" : "actions")}
              >
                <ScopeBarButton
                  value="actions"
                  className="mac-automator-scope"
                  style={ACTIONS_SCOPE}
                >
                  Actions
                </ScopeBarButton>
                <ScopeBarButton
                  value="variables"
                  className="mac-automator-scope"
                  style={VARIABLES_SCOPE}
                >
                  Variables
                </ScopeBarButton>
              </ScopeBarGroup>
              <SearchField
                variant="sidebar"
                size="small"
                placeholder="Name"
                aria-label="Search"
                clearLabel="Clear Search"
                className="mac-automator-search"
                style={SEARCH}
                value={query}
                onValueChange={setQuery}
              />
            </ScopeBar>
            <SplitView orientation="vertical" className="mac-automator-stack">
              <SplitViewPane minSize={76}>
                <SplitView className="mac-automator-lists">
                  <SplitViewPane defaultSize={163} minSize={100} maxSize={260}>
                    <OutlineView
                      // Each library has its own outline, with its own current row.
                      key={kind}
                      aria-label={kind === "actions" ? "Action categories" : "Variable categories"}
                      className="mac-automator-list"
                      items={library.categories}
                      renderCell={(item) => (
                        // The icon starts 20 pt from the pane's edge at the first level: a
                        // point after the outline's own inset for a row without a triangle,
                        // and half a point before it for a row with one.
                        <Row tint={item.tint} inset={item.children ? -0.5 : 1}>
                          {item.name}
                        </Row>
                      )}
                      getItemLabel={(item) => item.name}
                      expanded={expanded[kind]}
                      onExpandedChange={(next) => {
                        const open = next.filter((id): id is string => typeof id === "string");
                        setExpanded((current) => ({ ...current, [kind]: open }));
                        // A category collapsed out of sight hands the selection to its parent.
                        if (parent && !open.includes(parent.id)) chooseCategory(parent.id);
                      }}
                      value={[category.id]}
                      onValueChange={(value) => {
                        // The outline always has a selection: a click that would clear it is
                        // ignored.
                        const id = value[0];
                        if (typeof id === "string") chooseCategory(id);
                      }}
                      rowHeight={ROW_HEIGHT}
                      size="mini"
                    />
                  </SplitViewPane>
                  <SplitViewDivider aria-label="Resize the categories" />
                  <SplitViewPane minSize={120}>
                    <TableView
                      key={kind}
                      aria-label={kind === "actions" ? "Actions" : "Variables"}
                      className="mac-automator-list"
                      columns={NAME_COLUMN}
                      header="none"
                      rowCount={rows.length}
                      rowHeight={ROW_HEIGHT}
                      size="mini"
                      getRowId={(row) => rows[row]?.id ?? row}
                      getRowLabel={(row) => rows[row]?.name ?? ""}
                      value={selected ? [selected.id] : []}
                      onValueChange={(value) => {
                        const id = value[0];
                        setSelection((current) => ({
                          ...current,
                          [kind]: typeof id === "string" ? id : undefined,
                        }));
                      }}
                      onRowAction={(row) => {
                        const item = rows[row];
                        if (item) add(item);
                      }}
                      renderCell={(row) => {
                        const item = rows[row];
                        return item ? (
                          <Row tint={tintOf(library, item)} inset={1}>
                            {item.name}
                          </Row>
                        ) : null;
                      }}
                    />
                  </SplitViewPane>
                </SplitView>
              </SplitViewPane>
              {descriptionShown ? (
                <>
                  <SplitViewDivider aria-label="Resize the description" />
                  <SplitViewPane defaultSize={115} minSize={60} maxSize={300}>
                    <section aria-label="Description" className="mac-automator-description">
                      {selected ? (
                        <>
                          <div className="mac-automator-description-head">
                            <PlaceholderIcon tint={tintOf(library, selected)} size={32} />
                            <h2 className="mac-automator-description-title">{selected.name}</h2>
                          </div>
                          <Label
                            render={<p />}
                            textStyle="small"
                            selectable
                            className="mac-automator-description-text"
                          >
                            {selected.description}
                          </Label>
                          <dl className="mac-automator-facts">
                            {(selectedAction
                              ? [
                                  ["Input", selectedAction.input],
                                  ["Result", selectedAction.result],
                                  ["Version", selectedAction.version],
                                ]
                              : [["Value", selectedVariable?.value ?? ""]]
                            ).map(([name, value]) => (
                              <div key={name} className="mac-automator-fact">
                                <dt>{name}:</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </>
                      ) : (
                        <EmptyState>
                          {kind === "actions" ? "No Action Selected" : "No Variable Selected"}
                        </EmptyState>
                      )}
                    </section>
                  </SplitViewPane>
                </>
              ) : null}
            </SplitView>
            <StatusBar
              variant="gradient"
              className="mac-automator-library-bar"
              leading={
                <>
                  <PullDownButton
                    aria-label="Action"
                    size="small"
                    bordered={false}
                    className="mac-automator-gear"
                    image={<SystemImage name="action" scale={10 / 13} />}
                  >
                    <MenuItem disabled={!selected} onClick={() => selected && add(selected)}>
                      Add to Workflow
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      disabled={workflow.steps.length === 0}
                      onClick={() => dispatch({ type: "clear" })}
                    >
                      Clear Workflow
                    </MenuItem>
                  </PullDownButton>
                  <ImageButton
                    aria-label={descriptionShown ? "Hide Description" : "Show Description"}
                    aria-expanded={descriptionShown}
                    className="mac-automator-bar-button"
                    style={barButton("0 5px")}
                    onClick={() => setDescriptionShown(!descriptionShown)}
                  >
                    <DisclosureGlyph open={descriptionShown} />
                  </ImageButton>
                </>
              }
            />
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize the library" />
          <SplitViewPane minSize={300} className="mac-automator-column">
            <SplitView orientation="vertical" className="mac-automator-stack">
              <SplitViewPane minSize={80}>
                <section aria-label="Workflow" className="mac-automator-workflow">
                  {workflow.steps.length === 0 ? (
                    <EmptyState variant="capsule" style={PLACEHOLDER}>
                      Drag actions or files here to build your workflow.
                    </EmptyState>
                  ) : (
                    <ScrollView className="mac-automator-steps-scroll">
                      <ol className="mac-automator-steps">
                        {workflow.steps.map((step, index) => {
                          const entry = findAction(step.actionId);
                          if (!entry) return null;
                          const state = stepState(workflow, index);
                          return (
                            <li key={step.key} className="mac-automator-step" data-state={state}>
                              <div className="mac-automator-step-head">
                                <span className="mac-automator-step-number">{index + 1}</span>
                                <PlaceholderIcon tint={tintOf(actionLibrary, entry)} />
                                <Label
                                  textStyle="emphasized"
                                  truncate
                                  className="mac-automator-step-name"
                                >
                                  {entry.name}
                                </Label>
                                {state === "pending" ? null : (
                                  <span
                                    role="img"
                                    aria-label={state === "done" ? "Completed" : "Running"}
                                    className="mac-automator-step-mark"
                                  />
                                )}
                                <ImageButton
                                  aria-label={`Remove ${entry.name}`}
                                  className="mac-automator-step-remove"
                                  style={barButton("4px")}
                                  onClick={() => dispatch({ type: "remove", key: step.key })}
                                >
                                  <SystemImage name="stop-progress" />
                                </ImageButton>
                              </div>
                              <Label
                                render={<p />}
                                textStyle="small"
                                color="secondary"
                                className="mac-automator-step-body"
                              >
                                {entry.input} → {entry.result}
                              </Label>
                            </li>
                          );
                        })}
                      </ol>
                    </ScrollView>
                  )}
                </section>
              </SplitViewPane>
              <SplitViewDivider aria-label="Resize the log" />
              <SplitViewPane defaultSize={147} minSize={44} maxSize={420}>
                <div className="mac-automator-lower">
                  {lowerView === "log" ? (
                    <TableView
                      key="log"
                      ref={logTable}
                      aria-label="Log"
                      className="mac-automator-list"
                      columns={LOG_COLUMNS}
                      rowCount={workflow.log.length}
                      rowHeight={ROW_HEIGHT}
                      size="mini"
                      alternatingRows
                      selectionMode="none"
                      getRowId={(row) => workflow.log[row]?.key ?? -1}
                      renderCell={(row, column) => {
                        const entry = workflow.log[row];
                        if (!entry) return null;
                        return column.id === "log" ? entry.text : formatDuration(entry.duration);
                      }}
                    />
                  ) : (
                    <TableView
                      key="variables"
                      aria-label="Workflow variables"
                      className="mac-automator-list"
                      columns={VARIABLE_COLUMNS}
                      rowCount={variables.length}
                      rowHeight={ROW_HEIGHT}
                      size="mini"
                      alternatingRows
                      selectionMode="none"
                      getRowId={(row) => variables[row]?.id ?? row}
                      renderCell={(row, column) => {
                        const entry = variables[row];
                        if (!entry) return null;
                        return column.id === "name" ? entry.name : entry.value;
                      }}
                    />
                  )}
                </div>
              </SplitViewPane>
            </SplitView>
            <StatusBar
              variant="gradient"
              leading={
                // biome-ignore lint/a11y/useSemanticElements: a group of two toggles, not a form fieldset
                <div role="group" aria-label="Lower pane" className="mac-automator-views">
                  <ImageButton
                    aria-label="Log"
                    aria-pressed={lowerView === "log"}
                    className="mac-automator-bar-button"
                    style={barButton("0 8.5px 0 1.5px", lowerView === "log")}
                    onClick={() => showLower("log")}
                  >
                    <SystemImage name="list-view" />
                  </ImageButton>
                  <ImageButton
                    aria-label="Variables"
                    aria-pressed={lowerView === "variables"}
                    className="mac-automator-bar-button"
                    style={barButton("0 5px 0 8.5px", lowerView === "variables")}
                    onClick={() => showLower("variables")}
                  >
                    <VariablesGlyph />
                  </ImageButton>
                </div>
              }
            />
          </SplitViewPane>
        </SplitView>
      </WindowBody>
    </Window>
  );
}
