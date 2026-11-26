"use client";

import { Checkbox } from "macalicious/checkbox";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { OutlineView } from "macalicious/outline-view";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { ScopeBar, ScopeBarButton, ScopeBarGroup } from "macalicious/scope-bar";
import { ScrollView } from "macalicious/scroll-view";
import { SearchField } from "macalicious/search-field";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { StatusBar } from "macalicious/status-bar";
import { SystemImage } from "macalicious/system-image";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { Window, WindowBody } from "macalicious/window";
import { WindowBanner } from "macalicious/window-banner";
import { WindowControls } from "macalicious/window-controls";
import {
  type CSSProperties,
  type DragEvent,
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { type DesktopDragItem, useDesktopDrop } from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { loadDrive, readFile } from "../desktop/desktop-files";
import { forgetKeptText, keepText } from "../desktop/desktop-kept-text";
import {
  desktopValuesLoaded,
  readBoolean,
  subscribeDesktopValues,
  useDesktopSetting,
} from "../desktop/desktop-personal";
import { currentDesktopSession, servedByDesktopApp } from "../desktop/desktop-server";
import { shareFiles } from "../desktop/desktop-share-link";
import { DriveSavePanel, type DriveSaveTarget, saveToDrive } from "../finder/finder-file-dialogs";
import {
  type OpenFileRequest,
  onOpenFileRequest,
  takeOpenFileRequests,
} from "../finder/finder-open";
import { whenMenusClosed } from "../notes/notes-menus";
import { printDocument } from "../textedit/textedit-drive";
import { Automator, type AutomatorProps } from "./automator";
import { ensureAlarmEvent } from "./automator-background";
import type { AutomatorTint } from "./automator-data";
import { formatDuration } from "./automator-data";
import { KEPT_WORKFLOW, type KeptWorkflow, keptChanges, useKeptWorkflow } from "./automator-draft";
import {
  DisclosureGlyph,
  MediaGlyph,
  PlaceholderIcon,
  RecordGlyph,
  RunGlyph,
  RunsGlyph,
  StepGlyph,
  StopGlyph,
  VariablesGlyph,
} from "./automator-icons";
import { moveWorkflowFile, saveWorkflowFile, workflowOfFile } from "./automator-location";
import {
  type AutomatorCommands,
  type AutomatorMenuState,
  automatorMenuRows,
  CustomizeToolbarSheet,
  documentTypes,
  type EditCommand,
  editText,
  isTextField,
  kindOfType,
  NewDocumentSheet,
  NO_RECORD,
  OpenWorkflowSheet,
  RenameStepSheet,
  SERVER_RUNS,
  toolbarInOrder,
} from "./automator-menus";
import {
  DIMMED_ACTIONS,
  endRows,
  isPageAction,
  type KeptVariables,
  loadAccountVariables,
  needsParts,
  PAGE_ACTIONS,
  type PageAnswer,
  type PageQuestion,
  type PartsHost,
  pathsOfDrag,
  readKeptVariables,
  runInParts,
  unansweredRow,
  VARIABLE_ROWS,
  VARIABLES,
  variableToken,
  variableValues,
  type WorkflowVariable,
  withVariables,
} from "./automator-page";
import {
  MediaBrowserSheet,
  PageQuestionSheet,
  VariableSheet,
  VersionsSheet,
} from "./automator-page-sheets";
import {
  categoryOfApp,
  choicesOf,
  type DraftStep,
  defaultParams,
  draftFromFile,
  draftFromWorkflow,
  fileNameOf,
  handedOn,
  itemText,
  type LogRow,
  libraryOutline,
  listServedActions,
  loadActions,
  loadRuns,
  loadVersions,
  loadWorkflows,
  logRows,
  MAX_STEPS,
  MOST_USED,
  mostUsedActions,
  newDraft,
  type ParamDraft,
  RECENTLY_ADDED,
  RUNS_POLL_MS,
  type RunItem,
  type RunLog,
  recentlyAddedActions,
  runText,
  runWorkflow,
  SERVED_ROOT,
  type SeenActions,
  type ServerAction,
  type ServerParam,
  type StepLog,
  saveChange,
  startedText,
  timezoneOffset,
  tintOfAction,
  VARIABLE_OUTLINE,
  type Workflow,
  type WorkflowDraft,
  type WorkflowKind,
  type WorkflowsState,
  type WorkflowVersion,
  withInput,
  withNewActions,
  withoutInput,
  workflowFileName,
  workflowFileText,
  workflowOfDraft,
} from "./automator-server";
import {
  endedTyping,
  insertedSteps,
  movedSteps,
  NO_HISTORY,
  recorded,
  redone,
  type StepsHistory,
  undone,
} from "./automator-steps";
import { FieldLabel, TypeFields, typeNote } from "./automator-type-fields";
import "./automator.tokens.css";
import "./automator.css";

/* The measures of the window are automator.tsx's: the same library width, rows, toolbar items
   and bottom-bar buttons, so that the served window looks like the demo. */
const LIBRARY_WIDTH = 381;
const ROW_HEIGHT = 19;
const BUTTON: CSSProperties = { width: 38, padding: 0 };
const ITEM: CSSProperties = { width: 38 };
const SCOPE: CSSProperties = { width: 71, padding: 0 };
const SEARCH: CSSProperties = { flex: "1 1 0", width: "auto" };
const PLACEHOLDER: CSSProperties = { paddingBlockEnd: 39 };
const DIVIDER = {
  "--mac-split-view-divider-color": "var(--mac-automator-divider)",
} as CSSProperties;
const barButton = (padding: string, on = false) =>
  ({
    "--mac-image-button-padding": padding,
    ...(on && { "--mac-image-brightness-pressed": 1 }),
  }) as CSSProperties;

const NAME_COLUMN: readonly TableViewColumn[] = [{ id: "name" }];
const heading = (title: string) => <span className="mac-automator-heading">{title}</span>;
const LOG_COLUMNS: readonly TableViewColumn[] = [
  { id: "log", title: heading("Log"), minWidth: 120 },
  { id: "duration", title: heading("Duration"), width: 100 },
];
const RUN_COLUMNS: readonly TableViewColumn[] = [
  { id: "run", title: heading("Runs"), minWidth: 120 },
  { id: "duration", title: heading("Duration"), width: 100 },
];
const VARIABLE_COLUMNS: readonly TableViewColumn[] = [
  { id: "name", title: heading("Variable"), minWidth: 120 },
  { id: "value", title: heading("Value"), minWidth: 120 },
];

/** How the window looks, kept for the person. */
const LIBRARY_SHOWN = "automator.libraryShown";
const LOG_SHOWN = "automator.logShown";
const TOOLBAR_SHOWN = "automator.toolbarShown";
const TOOLBAR_HIDDEN = "automator.toolbarHidden";
const TOOLBAR_ORDER = "automator.toolbarOrder";
/** Results as a table rather than a list. */
const RESULTS_TABLE = "automator.resultsTable";
const RESULT_COLUMNS: readonly TableViewColumn[] = [
  { id: "row", title: "#", width: 32, align: "right" },
  { id: "item", title: "Item" },
];
const RESULT_VIEWS = ["List", "Table"] as const;
/** Each workflow's variables, by its id. */
const NO_KEPT_VARIABLES: KeptVariables = {};
const NO_OWN_VARIABLES: readonly WorkflowVariable[] = [];
/** The sizes the person dragged the panes to. */
const PANE_SIZES = "automator.paneSizes";
type PaneSizes = Readonly<
  Partial<Record<"library" | "categories" | "description" | "log", number>>
>;
const NO_PANE_SIZES: PaneSizes = {};
const readPaneSizes = (stored: unknown): PaneSizes | undefined =>
  typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? Object.fromEntries(
        Object.entries(stored).filter(
          ([, size]) => typeof size === "number" && Number.isFinite(size) && size > 0,
        ),
      )
    : undefined;
const NO_ITEMS: readonly string[] = [];
/** When the person's library first had each action, for Recently Added. */
const SEEN_ACTIONS = "automator.seenActions";
const readSeen = (stored: unknown): SeenActions | undefined =>
  typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? (stored as SeenActions)
    : undefined;

/** What a drag carries: the names of library actions, or the keys of this window's steps. */
const ACTIONS_DRAG = "application/x-macalicious-automator-actions";
const STEPS_DRAG = "application/x-macalicious-automator-steps";
const VARIABLE_DRAG = "application/x-macalicious-automator-variable";

/** Where a press in a step belongs to the control under it and leaves the keyboard there. */
const STEP_CONTROLS = "input, textarea, button, [role='combobox'], [role='checkbox'], label";
/** The actions that change the Finder items passed into them, for which Automator offers a copy first. */
const CHANGES_ITS_INPUT = new Set(["page.change-image-type", "page.rename-finder-items"]);

/** The disc of a step after a run, and its name. */
type StepMark = "done" | "running" | "failed";
const MARK_NAMES: Readonly<Record<StepMark, string>> = {
  done: "Completed",
  running: "Running",
  failed: "Failed",
};

/** What the log shows, the disc of each step it is about, and each step's part of the run, by step key. */
interface Shown {
  rows: readonly LogRow[];
  marks: Readonly<Record<number, StepMark>>;
  results?: Readonly<Record<number, StepLog>>;
}
const NOTHING_SHOWN: Shown = { rows: [], marks: {} };

/** A run begun with Step: the steps it has done, what it hands the next one, and its log so far. */
interface Stepping {
  done: readonly number[];
  items: readonly RunItem[];
  rows: readonly LogRow[];
  marks: Readonly<Record<number, StepMark>>;
  results: Readonly<Record<number, StepLog>>;
  ms: number;
}
const NOT_STEPPED: Stepping = { done: [], items: [], rows: [], marks: {}, results: {}, ms: 0 };

/** `run` with each step under the name the workflow gave it, and its discs and parts by step key. */
function ranSteps(run: RunLog, ran: readonly DraftStep[]) {
  const marks: Record<number, StepMark> = {};
  const results: Record<number, StepLog> = {};
  run.steps.forEach((step, index) => {
    const key = ran[index]?.key;
    if (key === undefined) return;
    results[key] = step;
    if (step.status === "completed") marks[key] = "done";
    else if (step.status === "failed") marks[key] = "failed";
  });
  const named = {
    ...run,
    steps: run.steps.map((step, index) => {
      const label = ran[index]?.label;
      return label ? { ...step, title: label } : step;
    }),
  };
  return { named, marks, results };
}

const viewportOf = (table: HTMLElement | null) =>
  table?.querySelector<HTMLElement>('[role="rowgroup"]') ?? null;

/** `held` with `keys` added or taken out. */
const withKeys = (held: readonly number[], keys: readonly number[], add: boolean) =>
  add ? [...new Set([...held, ...keys])] : held.filter((key) => !keys.includes(key));

/** A sentence's end: an error already ending in a full stop gets no second one. */
const ending = (text: string) => text.replace(/[.\s]+$/, "");

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** File > Open Recent's workflows, among the person's desktop values. */
const RECENT_WORKFLOWS = "automator.recent";
const MOST_RECENTS = 10;
const NO_RECENTS: readonly string[] = [];
const readNames = (stored: unknown): readonly string[] | undefined =>
  Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : undefined;
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Of the workflows the window holds and ones just read, the later revision: a read that
 * started before a save may answer after it. */
const newerOf = (held: WorkflowsState | null, read: WorkflowsState): WorkflowsState =>
  held && held.rev >= read.rev ? held : read;

/** A row of the outline or of the list: the placeholder icon, then the name. */
function Row({
  tint,
  inset,
  reason,
  children,
}: {
  tint: AutomatorTint;
  inset: number;
  reason?: string;
  children: string;
}) {
  return (
    <span
      className="mac-automator-row"
      style={{ marginInlineStart: inset }}
      data-dimmed={reason ? "" : undefined}
      title={reason}
    >
      <PlaceholderIcon tint={tint} />
      <span className="mac-automator-row-name">{children}</span>
    </span>
  );
}

/** What a step's Results shows of its part in the last run from this window. */
function StepResults({ name, log }: { name: string; log: StepLog | undefined }) {
  const [asTable, setAsTable] = useDesktopSetting(RESULTS_TABLE, readBoolean, false);
  let summary: string;
  if (!log) summary = "Run the workflow to see what this action gives.";
  else if (log.status === "skipped") summary = log.message ?? "This action did not run.";
  else if (log.status === "failed") summary = log.message ?? "This action failed.";
  else summary = log.items === 1 ? "1 item" : `${log.items} items`;
  const lines = log?.status === "completed" ? (log.all?.map(itemText) ?? log.preview) : [];
  return (
    // biome-ignore lint/a11y/useSemanticElements: a part of a step, named by its action, not a form fieldset
    <div role="group" aria-label={`Results of ${name}`} className="mac-automator-step-results">
      <Label textStyle="small" color="secondary">
        {summary}
      </Label>
      {lines.length > 0 ? (
        <SegmentedControl
          size="mini"
          aria-label="Show results as"
          value={[asTable ? "Table" : "List"]}
          onValueChange={([next]) => {
            if (next) setAsTable(next === "Table");
          }}
        >
          {RESULT_VIEWS.map((view) => (
            <Segment key={view} value={view}>
              {view}
            </Segment>
          ))}
        </SegmentedControl>
      ) : null}
      {asTable && lines.length > 0 ? (
        <TableView
          aria-label={`Items of ${name}`}
          className="mac-automator-step-results-table"
          columns={RESULT_COLUMNS}
          rowCount={lines.length}
          rowHeight={ROW_HEIGHT}
          size="mini"
          renderCell={(row, column) => (column.id === "row" ? row + 1 : lines[row])}
        />
      ) : (
        lines.map((line, at) => (
          // A preview is a list of texts that may repeat, in an order that does not change.
          // biome-ignore lint/suspicious/noArrayIndexKey: as above
          <Label key={at} textStyle="small" selectable truncate>
            {line}
          </Label>
        ))
      )}
    </div>
  );
}

/**
 * One setting of a step, as two cells of the settings grid: its name, then the control for its
 * kind. The control is named by the setting's name.
 */
function Setting({
  id,
  param,
  value,
  onChange,
}: {
  id: string;
  param: ServerParam;
  value: ParamDraft | undefined;
  onChange: (value: ParamDraft) => void;
}) {
  const text = typeof value === "string" ? value : "";
  const takesVariables = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes(VARIABLE_DRAG)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const name = event.dataTransfer.getData(VARIABLE_DRAG);
      if (!name) return;
      event.preventDefault();
      event.stopPropagation();
      onChange(`${text}${variableToken(name)}`);
    },
  };
  if (param.kind === "boolean") {
    return (
      <>
        <span />
        <Checkbox
          size="small"
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
          className="mac-automator-setting-check"
        >
          {param.name}
        </Checkbox>
      </>
    );
  }
  const choices = choicesOf(param.kind);
  if (choices) {
    const labelId = `${id}-label`;
    return (
      <>
        <Label id={labelId} textStyle="small" align="end" className="mac-automator-setting-label">
          {param.name}
        </Label>
        <PopUpButton<string>
          size="small"
          aria-labelledby={labelId}
          value={text === "" ? null : text}
          onValueChange={(next) => onChange(next ?? "")}
          placeholder="Default"
          className="mac-automator-setting-choice"
        >
          {param.required ? null : <PopUpButtonItem value={null}>Default</PopUpButtonItem>}
          {choices.map((choice) => (
            <PopUpButtonItem key={choice} value={choice}>
              {choice}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </>
    );
  }
  // biome-ignore lint/a11y/noLabelWithoutControl: names the control through htmlFor; Label puts the text inside
  const element = <label htmlFor={id} />;
  const label = (
    <Label
      render={element}
      textStyle="small"
      align="end"
      className="mac-automator-setting-label"
      data-top={param.kind === "code" ? "" : undefined}
    >
      {param.name}
    </Label>
  );
  if (param.kind === "code") {
    return (
      <>
        {label}
        <div className="mac-automator-code">
          <TextView
            id={id}
            monospace
            insertsTab
            spellCheck={false}
            value={text}
            onValueChange={onChange}
            placeholder={param.summary}
          />
        </div>
      </>
    );
  }
  return (
    <>
      {label}
      <TextField
        id={id}
        size="small"
        className="mac-automator-setting-field"
        value={text}
        onValueChange={(next) => onChange(next)}
        placeholder={param.summary}
        inputMode={param.kind === "number" ? "decimal" : undefined}
        {...takesVariables}
      />
    </>
  );
}

/** The settings a step shows: its action's, or for an action the library no longer has, the
 * ones it was saved with. */
function paramsOfStep(step: DraftStep, action: ServerAction | undefined): ServerParam[] {
  if (action) return action.params;
  return Object.entries(step.params).map(([name, value]) => ({
    name,
    kind: typeof value === "boolean" ? "boolean" : "text",
    required: false,
    summary: "",
  }));
}

/** Before a step runs, its settings for this run: Options' Show this action when the workflow runs. */
function ShowStepSheet({
  step,
  name,
  action,
  id,
  anchor,
  onDone,
}: {
  step: DraftStep;
  name: string;
  action: ServerAction | undefined;
  id: string;
  anchor: HTMLElement | null;
  onDone: (step: DraftStep | null) => void;
}) {
  const [params, setParams] = useState(step.params);
  return (
    <Sheet open onOpenChange={(open) => open || onDone(null)}>
      <SheetPopup anchor={anchor} width={480}>
        <SheetTitle>{name}</SheetTitle>
        {action?.summary ? <SheetDescription>{action.summary}</SheetDescription> : null}
        <div className="mac-automator-settings">
          {paramsOfStep(step, action).map((param) => (
            <Setting
              key={param.name}
              id={`${id}-shown-${param.name}`}
              param={param}
              value={params[param.name]}
              onChange={(value) => setParams((held) => ({ ...held, [param.name]: value }))}
            />
          ))}
        </div>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton onClick={() => onDone({ ...step, params })}>Continue</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/**
 * Automator on the `macalicious-desktop` Ferrite application: the window of `Automator`, with the
 * server's actions and the page's own in the library, steps with their settings, Run with its
 * log, variables, workflows saved for the person. Calendar alarms and folder actions are listed
 * as not available yet. See the docs page, "On the desktop's Ferrite application".
 */
function ServedAutomator({
  defaultCategory = SERVED_ROOT,
  onCategoryChange,
  defaultSelectedId: _defaultSelectedId,
  defaultWorkflow: _defaultWorkflow,
  onWorkflowChange,
  stepInterval: _stepInterval,
  defaultLibraryShown = true,
  defaultDescriptionShown = true,
  onShowMedia: _onShowMedia,
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
  const ids = useId();
  const keys = useRef(0);
  const nextKey = () => {
    keys.current += 1;
    return keys.current;
  };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [actions, setActions] = useState<readonly ServerAction[] | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [stored, setStored] = useState<WorkflowsState | null>(null);
  const [runs, setRuns] = useState<readonly RunLog[]>([]);
  // Each read of the runs takes the next number, and only the newest one's answer is shown:
  // reads that overlap can answer out of order.
  const runsRead = useRef(0);
  const readRuns = useCallback(async () => {
    runsRead.current += 1;
    const ticket = runsRead.current;
    try {
      const list = await loadRuns();
      if (mounted.current && ticket === runsRead.current) setRuns(list);
    } catch {
      // The list keeps what it showed; the next read tries again.
    }
  }, []);
  const [draft, setDraft] = useState<WorkflowDraft>(() => newDraft());
  // The draft as it was last opened, started or saved, written as the workflow it sends: the
  // draft has unsaved changes while it differs. `switching` is a New or Open that waits for
  // the person to say what becomes of those changes.
  const [clean, setClean] = useState<string | null>(null);
  const [switching, setSwitching] = useState<{
    open: string | null;
    /** The window is closing rather than showing another workflow: the close button's press. */
    close?: MouseEvent<HTMLElement>;
    /** A workflow's file from the drive replaces it, rather than one kept on the server. */
    file?: WorkflowDraft;
    /** The type of the new workflow, for File > New. */
    kind?: WorkflowKind;
    /** The last Save from the sheet failed (the status bar says why). */
    failed?: boolean;
  } | null>(null);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [askingDelete, setAskingDelete] = useState(false);
  const [recentIds, setRecentIds] = useDesktopSetting(RECENT_WORKFLOWS, readNames, NO_RECENTS);
  const noteRecent = (id: string) =>
    setRecentIds([id, ...recentIds.filter((each) => each !== id)].slice(0, MOST_RECENTS));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [stepping, setStepping] = useState<Stepping | null>(null);
  const stopAsked = useRef(false);
  const [inParts, setInParts] = useState(false);
  const runVariables = useRef(new Map<string, readonly string[]>());
  const [asking, setAsking] = useState<{
    question: PageQuestion;
    answer: (answer: PageAnswer | null) => void;
  } | null>(null);
  const [showing, setShowing] = useState<{
    step: DraftStep;
    answer: (step: DraftStep | null) => void;
  } | null>(null);
  const [libraryKind, setLibraryKind] = useState<"actions" | "variables">("actions");
  const [keptVariables, setKeptVariables] = useDesktopSetting<KeptVariables>(
    VARIABLES,
    readKeptVariables,
    NO_KEPT_VARIABLES,
  );
  const [editingVariable, setEditingVariable] = useState<WorkflowVariable | null>(null);
  const [browsing, setBrowsing] = useState<{ versions: WorkflowVersion[] | null } | null>(null);
  const [chosenVariable, setChosenVariable] = useState<string | null>(null);
  const [paneSizes, setPaneSizes] = useDesktopSetting<PaneSizes>(
    PANE_SIZES,
    readPaneSizes,
    NO_PANE_SIZES,
  );
  const paneSized = (pane: keyof PaneSizes) => (size: number) => {
    if (size > 0 && paneSizes[pane] !== size) setPaneSizes({ ...paneSizes, [pane]: size });
  };
  const [choosingType, setChoosingType] = useState<"new" | "convert" | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [moving, setMoving] = useState(false);
  /** The step just added that changes the files it is given, about which the sheet asks. */
  const [askingCopy, setAskingCopy] = useState<{ step: number; title: string } | null>(null);
  const [toolbarHidden, setToolbarHidden] = useDesktopSetting(TOOLBAR_HIDDEN, readNames, NO_ITEMS);
  const inToolbar = (item: string) => !toolbarHidden.includes(item);
  const [toolbarOrderKept, setToolbarOrder] = useDesktopSetting(TOOLBAR_ORDER, readNames, NO_ITEMS);
  const toolbarOrder = toolbarInOrder(toolbarOrderKept);
  const [seenActions, setSeenActions] = useDesktopSetting<SeenActions | null>(
    SEEN_ACTIONS,
    readSeen,
    null,
  );
  const valuesLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  const [shown, setShown] = useState<Shown>(NOTHING_SHOWN);

  const [category, setCategory] = useState(defaultCategory);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [expanded, setExpanded] = useState<readonly string[]>([SERVED_ROOT]);
  const [query, setQuery] = useState("");
  const [libraryWanted, setLibraryWanted] = useDesktopSetting(
    LIBRARY_SHOWN,
    readBoolean,
    defaultLibraryShown,
  );
  const [librarySize, setLibrarySize] = useState(libraryWanted ? LIBRARY_WIDTH : 0);
  const libraryRestore = useRef(LIBRARY_WIDTH);
  // The stored value arrives after the window opened, and the toolbar's button changes it too.
  useEffect(() => {
    setLibrarySize((size) => (libraryWanted ? size || libraryRestore.current : 0));
  }, [libraryWanted]);
  // The size the person dragged it to arrives after the window opened.
  useEffect(() => {
    if (paneSizes.library === undefined) return;
    libraryRestore.current = paneSizes.library;
    setLibrarySize((size) => (size > 0 ? (paneSizes.library ?? size) : size));
  }, [paneSizes.library]);
  const [logShown, setLogShown] = useDesktopSetting(LOG_SHOWN, readBoolean, true);
  const [toolbarShown, setToolbarShown] = useDesktopSetting(TOOLBAR_SHOWN, readBoolean, true);
  const [descriptionShown, setDescriptionShown] = useState(defaultDescriptionShown);
  const [lowerView, setLowerView] = useState<"log" | "runs" | "variables">("log");
  const logTable = useRef<HTMLDivElement>(null);

  // The steps as a person edits them: Undo's history, the selected and collapsed ones by key, and
  // the steps last cut or copied, which stay until the next cut or copy, in any workflow.
  const [history, setHistory] = useState<StepsHistory>(NO_HISTORY);
  const [chosenKeys, setChosenKeys] = useState<readonly number[]>([]);
  const chosenAnchor = useRef<number | null>(null);
  const [collapsed, setCollapsed] = useState<readonly number[]>([]);
  const [resultsOpen, setResultsOpen] = useState<readonly number[]>([]);
  const [optionsOpen, setOptionsOpen] = useState<readonly number[]>([]);
  const [clipboard, setClipboard] = useState<readonly DraftStep[]>([]);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const movingSteps = useRef<readonly number[] | null>(null);
  const [openSheet, setOpenSheet] = useState(false);
  const searchField = useRef<HTMLInputElement>(null);
  // The text field that last had the keyboard, while nothing else in the window has since: a menu
  // takes the keyboard, and its Edit rows still mean that text.
  const textField = useRef<HTMLElement | null>(null);
  const [inText, setInText] = useState(false);

  // The library and the saved workflows, once when the window opens.
  useEffect(() => {
    let live = true;
    loadActions().then(
      (list) => {
        if (live) setActions(list);
      },
      (error: unknown) => {
        if (!live) return;
        setActions([]);
        setActionsError(messageOf(error));
      },
    );
    void loadAccountVariables();
    loadWorkflows().then(
      (state) => {
        if (live) setStored((current) => newerOf(current, state));
      },
      (error: unknown) => {
        if (live) setStatus(`The saved workflows could not be read: ${ending(messageOf(error))}.`);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  // The runs, now and every ten seconds while the window is open, so that a run started in
  // another window or browser appears in the list.
  useEffect(() => {
    void readRuns();
    const timer = setInterval(readRuns, RUNS_POLL_MS);
    return () => {
      runsRead.current += 1;
      clearInterval(timer);
    };
  }, [readRuns]);

  // The steps as the host hears of them, by action name, once for each change.
  const reported = useRef(draft.steps);
  useEffect(() => {
    if (reported.current === draft.steps) return;
    reported.current = draft.steps;
    onWorkflowChange?.(draft.steps.map((step) => step.action));
  }, [draft.steps, onWorkflowChange]);

  // A new log is shown from its last row, where the run says how it ended.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again when another log is shown
  useLayoutEffect(() => {
    const viewport = viewportOf(logTable.current);
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [shown, lowerView]);

  // Recently Added: an action is new against what the person's library had, which is known only
  // once their values are here.
  useEffect(() => {
    if (!valuesLoaded || !actions || actions.length === 0) return;
    const next = withNewActions(seenActions, actions, Date.now());
    if (next !== seenActions) setSeenActions(next);
  }, [valuesLoaded, actions, seenActions, setSeenActions]);

  // Beside the server's actions, the page's own and the rest of the real library, dimmed. With no
  // server library there is nothing to run them with.
  const library = useMemo<readonly ServerAction[]>(
    () => (actions?.length ? [...actions, ...PAGE_ACTIONS, ...DIMMED_ACTIONS] : (actions ?? [])),
    [actions],
  );
  const actionsByName = useMemo(
    () => new Map(library.map((action) => [action.name, action])),
    [library],
  );
  const categories = useMemo(
    () => (libraryKind === "variables" ? [...VARIABLE_OUTLINE] : libraryOutline(library)),
    [library, libraryKind],
  );
  // The outline always shows a category: one the library does not have stands for Library.
  const smartList =
    libraryKind === "actions" && (category === MOST_USED || category === RECENTLY_ADDED);
  const categoryId =
    smartList || categories[0]?.children?.some((child) => child.id === category)
      ? category
      : SERVED_ROOT;
  const saved = stored?.library?.workflows ?? [];
  const rows = useMemo(() => {
    if (libraryKind === "variables") {
      return listServedActions(actions ? VARIABLE_ROWS : [], categoryId, query);
    }
    if (categoryId === MOST_USED) {
      return listServedActions(mostUsedActions(library, saved, runs), SERVED_ROOT, query);
    }
    if (categoryId === RECENTLY_ADDED) {
      return listServedActions(
        recentlyAddedActions(actions ?? [], seenActions, Date.now()),
        SERVED_ROOT,
        query,
      );
    }
    return listServedActions(library, categoryId, query);
  }, [actions, library, libraryKind, categoryId, query, saved, runs, seenActions]);
  const selectedRows = rows.filter((row) => selection.includes(row.name));
  const selected = selectedRows.length === 1 ? selectedRows[0] : undefined;
  const selectedIsVariable = selected?.name.startsWith("variable.") === true;
  const ownVariables = keptVariables[draft.id] ?? NO_OWN_VARIABLES;
  const setOwnVariables = (list: readonly WorkflowVariable[]) =>
    setKeptVariables({ ...keptVariables, [draft.id]: list });
  const canAddRows = selectedRows.some((row) => row.reason === undefined);
  const savedId = saved.some((workflow) => workflow.id === draft.id) ? draft.id : null;
  const libraryShown = librarySize > 0;
  const title = draft.name.trim() || "Untitled";
  const written = useMemo(
    () => JSON.stringify(workflowOfDraft(draft, actionsByName)),
    [draft, actionsByName],
  );
  // A draft never marked clean is clean while it sends what a new one sends: no name of its
  // own ("Untitled"), no step, an ordinary enabled workflow.
  const asNew = useMemo(
    () =>
      JSON.stringify(
        workflowOfDraft({ ...draft, name: "", steps: [], enabled: true }, actionsByName),
      ),
    [draft, actionsByName],
  );
  const unsaved = written !== (clean ?? asNew);

  const chooseCategory = (id: string) => {
    if (id === categoryId) return;
    setCategory(id);
    onCategoryChange?.(id, "actions");
  };
  const showLower = (view: "log" | "runs" | "variables") => {
    setLowerView(view);
    setLogShown(true);
  };
  const edit = (change: Partial<WorkflowDraft>) =>
    setDraft((current) => ({ ...current, ...change }));

  /** Every change of the steps but a whole new workflow: Undo can take it back. */
  const changeSteps = (
    change: (steps: DraftStep[]) => DraftStep[],
    typing: string | null = null,
  ) => {
    const next = change(draft.steps);
    if (next === draft.steps) return;
    setHistory((past) => recorded(past, draft.steps, typing));
    setDraft((current) => ({ ...current, steps: next }));
  };
  const editStep = (
    key: number,
    change: (step: DraftStep) => DraftStep,
    typing: string | null = null,
  ) =>
    changeSteps((steps) => steps.map((step) => (step.key === key ? change(step) : step)), typing);
  const forgetStepEdits = () => {
    setHistory(NO_HISTORY);
    setChosenKeys([]);
    setCollapsed([]);
    setResultsOpen([]);
    setOptionsOpen([]);
    setStepping(null);
  };

  const stepName = (step: DraftStep) =>
    step.label || (actionsByName.get(step.action)?.title ?? step.action);
  const notStepped = draft.steps.filter((step) => !stepping?.done.includes(step.key));
  const canStep = !running && notStepped.some((step) => step.enabled);
  const canStop = stepping !== null || inParts;

  /** Each step's part of the last run of this very workflow, for Results after a reload. */
  const resultsOfRun = (entry: RunLog): Record<number, StepLog> | undefined => {
    const same =
      entry.workflow === draft.id &&
      entry.steps.length === draft.steps.length &&
      entry.steps.every((step, at) => step.action === draft.steps[at]?.action);
    return same ? ranSteps(entry, draft.steps).results : undefined;
  };
  const lastResults = runs.map(resultsOfRun).find(Boolean);

  const chosenSteps = draft.steps.filter((step) => chosenKeys.includes(step.key));
  const takesInput = (step: DraftStep) => actionsByName.get(step.action)?.takes_input === true;
  const chosenIndexes = chosenSteps.map((step) => draft.steps.indexOf(step));
  const firstChosen = chosenIndexes[0] ?? -1;
  const lastChosen = chosenIndexes.at(-1) ?? -1;
  const chooseOnly = (keys: readonly number[]) => {
    setChosenKeys(keys);
    chosenAnchor.current = keys[0] ?? null;
  };

  /** Put new steps before the step at `index`, as many as a workflow has room for, selected. */
  const insertSteps = (made: readonly DraftStep[], index = draft.steps.length) => {
    const room = MAX_STEPS - draft.steps.length;
    if (made.length > room) setStatus(`A workflow has at most ${MAX_STEPS} steps.`);
    const added = made.slice(0, Math.max(room, 0));
    if (added.length === 0) return added;
    changeSteps((steps) => insertedSteps(steps, added, index));
    chooseOnly(added.map((step) => step.key));
    return added;
  };
  const add = (list: readonly ServerAction[], index?: number) => {
    const variables = list.filter((action) => action.name.startsWith("variable."));
    if (variables.length > 0) {
      const known = ownVariables.map((entry) => entry.name);
      setOwnVariables([
        ...ownVariables,
        ...variables
          .filter((entry) => !known.includes(entry.title))
          .map((entry) => ({ name: entry.title, value: "" })),
      ]);
      showLower("variables");
      return;
    }
    const refused = list.find((action) => action.reason);
    if (refused) setStatus(`“${refused.title}” can’t be added: ${refused.reason}`);
    const runnable = list.filter((action) => !action.reason);
    const made = runnable.map((action) => ({
      key: nextKey(),
      action: action.name,
      params: defaultParams(action),
      enabled: true,
    }));
    const changing = insertSteps(made, index).find((step) => CHANGES_ITS_INPUT.has(step.action));
    if (changing) {
      const title = actionsByName.get(changing.action)?.title ?? changing.action;
      setAskingCopy({ step: changing.key, title });
    }
  };
  /** Copy Finder Items before the step, so that it changes copies, as Automator offers. */
  const addCopyBefore = (step: number) => {
    const action = actionsByName.get("page.copy-finder-items");
    if (!action) return;
    insertSteps(
      [
        {
          key: nextKey(),
          action: action.name,
          params: { ...defaultParams(action), to: "Desktop" },
          enabled: true,
        },
      ],
      draft.steps.findIndex((each) => each.key === step),
    );
  };
  /** What a variable holds as a workflow runs, now and in what Set Value of Variable kept. */
  const readVariable = (name: string) =>
    variableValues(name, runVariables.current, ownVariables, new Date());
  /** A workflow as the server takes it, with its variables' values in its settings. */
  const workflowToSend = (steps: readonly DraftStep[], items: readonly RunItem[]) =>
    withInput(
      workflowOfDraft(
        {
          ...draft,
          steps: steps.map((step) =>
            withVariables(step, actionsByName.get(step.action), readVariable),
          ),
        },
        actionsByName,
      ),
      items,
    );
  /** What a run in parts needs of the window. `progress` is the caller's. */
  const partsHost = (progress: PartsHost["progress"], once = false): PartsHost => ({
    session: currentDesktopSession(),
    running: runVariables.current,
    read: readVariable,
    once,
    progress,
    ask: (question) =>
      new Promise((resolve) =>
        setAsking({
          question,
          answer: (answer) => {
            setAsking(null);
            resolve(answer);
          },
        }),
      ),
    show: (step) =>
      new Promise((resolve) =>
        setShowing({
          step,
          answer: (edited) => {
            setShowing(null);
            resolve(edited);
          },
        }),
      ),
    name: stepName,
    action: (step) => actionsByName.get(step.action),
    stopped: () => stopAsked.current,
    server: async (steps, items) => {
      const outcome = await runWorkflow(workflowToSend(steps, items), timezoneOffset());
      if (outcome.ok) requestDesktopEffects(outcome.run.effects);
      return outcome;
    },
  });
  /** A file dropped from Finder: a step that hands it on, as Automator makes one. */
  const addFinderItems = (paths: string) => {
    const action = actionsByName.get("page.specified-finder-items");
    if (!action) return;
    add([action]);
    const key = keys.current;
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.key === key ? { ...step, params: { ...step.params, paths } } : step,
      ),
    }));
  };
  const addDroppedFiles = async (dropped: readonly DesktopDragItem[]) => {
    try {
      const drive = await loadDrive();
      if (!mounted.current) return;
      addFinderItems(pathsOfDrag(drive, dropped));
    } catch (error) {
      if (mounted.current) setStatus(`The drive could not be read: ${ending(messageOf(error))}.`);
    }
  };
  const removeSteps = (keys: readonly number[]) =>
    changeSteps((steps) => steps.filter((step) => !keys.includes(step.key)));

  const stepCommand = (command: EditCommand) => {
    const keys = chosenSteps.map((step) => step.key);
    if (command === "undo" || command === "redo") {
      const back = (command === "undo" ? undone : redone)(history, draft.steps);
      if (!back) return;
      setHistory(back.history);
      setDraft((current) => ({ ...current, steps: back.steps }));
    } else if (command === "paste") {
      insertSteps(
        clipboard.map((step) => ({ ...step, key: nextKey() })),
        lastChosen < 0 ? draft.steps.length : lastChosen + 1,
      );
    } else if (keys.length > 0) {
      if (command !== "delete") setClipboard(chosenSteps);
      if (command === "copy") {
        const count = keys.length === 1 ? "1 step" : `${keys.length} steps`;
        setStatus(`Copied ${count}.`);
      } else removeSteps(keys);
    }
  };

  const stepsPane = useRef<HTMLElement>(null);
  const giveStepsTheKeyboard = () => stepsPane.current?.focus({ preventScroll: true });
  const finderDrop = useDesktopDrop<HTMLElement>({
    accepts: (item) => !item.bytes,
    onDrop: (items) => void addDroppedFiles(items),
    refusal: () => "Only what is on your drive can go in a workflow.",
    sayRefusal: setStatus,
  });
  useEffect(() => {
    const pane = stepsPane.current;
    return pane ? finderDrop(pane) : undefined;
  }, [finderDrop]);

  const clickSteps = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const item = target.closest<HTMLElement>("[data-step-key]");
    if (!target.closest(STEP_CONTROLS)) giveStepsTheKeyboard();
    if (!item) {
      chooseOnly([]);
      return;
    }
    const key = Number(item.dataset.stepKey);
    const anchor = draft.steps.findIndex((step) => step.key === chosenAnchor.current);
    if (event.shiftKey && anchor >= 0) {
      const at = draft.steps.findIndex((step) => step.key === key);
      const range = draft.steps.slice(Math.min(anchor, at), Math.max(anchor, at) + 1);
      setChosenKeys(range.map((step) => step.key));
    } else if (event.metaKey || event.ctrlKey) {
      setChosenKeys((keys) =>
        keys.includes(key) ? keys.filter((each) => each !== key) : [...keys, key],
      );
      chosenAnchor.current = key;
    } else chooseOnly([key]);
  };

  /** Up and Down in the workflow choose the step above or below the selection. */
  const stepKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const at = event.key === "ArrowUp" ? firstChosen - 1 : lastChosen + 1;
    const step = draft.steps[Math.min(Math.max(at, 0), draft.steps.length - 1)];
    if (step) chooseOnly([step.key]);
  };

  const dropIndexOf = (event: DragEvent<HTMLElement>) => {
    const items = [...event.currentTarget.querySelectorAll("[data-step-key]")];
    const at = items.findIndex((item) => {
      const box = item.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });
    return at < 0 ? items.length : at;
  };
  const stepsDrop = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const { types } = event.dataTransfer;
      const fromLibrary = types.includes(ACTIONS_DRAG);
      if (!fromLibrary && !(types.includes(STEPS_DRAG) && movingSteps.current)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = fromLibrary ? "copy" : "move";
      setDropAt(dropIndexOf(event));
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      setDropAt(null);
      const index = dropIndexOf(event);
      const names = event.dataTransfer.getData(ACTIONS_DRAG);
      const keys = movingSteps.current;
      if (!names && !keys) return;
      event.preventDefault();
      if (keys) {
        changeSteps((steps) => movedSteps(steps, keys, index));
        return;
      }
      const list: string[] = JSON.parse(names);
      add(
        list.flatMap((name) => actionsByName.get(name) ?? []),
        index,
      );
    },
  };
  const startStepDrag = (event: DragEvent<HTMLElement>, key: number) => {
    const keys = chosenKeys.includes(key) ? chosenSteps.map((step) => step.key) : [key];
    if (!chosenKeys.includes(key)) chooseOnly([key]);
    movingSteps.current = keys;
    event.dataTransfer.setData(STEPS_DRAG, keys.join(","));
    event.dataTransfer.effectAllowed = "move";
    const item = event.currentTarget.closest("li");
    if (item) event.dataTransfer.setDragImage(item, 24, 12);
  };

  /** Find in Library: the action in its own category, with no search over it. */
  const findInLibrary = (action: ServerAction) => {
    setQuery("");
    setExpanded((held) => (held.includes(SERVED_ROOT) ? held : [...held, SERVED_ROOT]));
    chooseCategory(categoryOfApp(action.app).id);
    setSelection([action.name]);
  };
  const renamingStep = draft.steps.find((step) => step.key === renaming);

  /** The library's rows: a plain press keeps a selection of several, so that it can be dragged. */
  const libraryRowProps = (row: number) => {
    const action = rows[row];
    if (!action) return undefined;
    const held = selection.includes(action.name);
    return {
      draggable: action.reason === undefined,
      "aria-disabled": action.reason ? true : undefined,
      onContextMenu: () => {
        if (!held) setSelection([action.name]);
      },
      // The table cancels a press it handles, and a browser then starts no drag from it.
      onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.stopPropagation();
        event.currentTarget.closest<HTMLElement>('[role="grid"]')?.focus({ preventScroll: true });
        if (!held) setSelection([action.name]);
      },
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey) setSelection([action.name]);
      },
      onDragStart: (event: DragEvent<HTMLDivElement>) => {
        if (action.name.startsWith("variable.")) {
          event.dataTransfer.setData(VARIABLE_DRAG, action.title);
          event.dataTransfer.effectAllowed = "copy";
          return;
        }
        const names = held
          ? selectedRows.filter((each) => !each.reason).map((each) => each.name)
          : [action.name];
        event.dataTransfer.setData(ACTIONS_DRAG, JSON.stringify(names));
        event.dataTransfer.effectAllowed = "copy";
      },
    };
  };

  const run = async () => {
    if (running || draft.steps.length === 0) return;
    // A run begun with Step goes on from where it paused: what it has done is not done twice.
    const resume = stepping && notStepped.length > 0 ? stepping : NOT_STEPPED;
    const ran = resume === NOT_STEPPED ? draft.steps : notStepped;
    if (resume === NOT_STEPPED) runVariables.current = new Map();
    if (needsParts(ran)) {
      stopAsked.current = false;
      setStepping(null);
      setRunning(true);
      setInParts(true);
      showLower("log");
      const done = await runInParts(
        ran,
        resume.items,
        partsHost((progress) => {
          if (!mounted.current) return;
          setShown({
            rows: [
              ...resume.rows,
              ...progress.rows,
              { key: "running", text: "Running the workflow…", duration: "" },
            ],
            marks: { ...resume.marks, ...progress.marks },
            results: { ...resume.results, ...progress.results },
          });
        }),
      );
      if (!mounted.current) return;
      setRunning(false);
      setInParts(false);
      setShown({
        rows: [...resume.rows, ...done.rows, ...(done.ended ? [] : endRows(done))],
        marks: { ...resume.marks, ...done.marks },
        results: { ...resume.results, ...done.results },
      });
      void readRuns();
      return;
    }
    const workflow = workflowToSend(ran, resume.items);
    setStepping(null);
    setRunning(true);
    showLower("log");
    setShown({
      rows: [
        ...resume.rows,
        { key: "running", text: "Running the workflow on the server…", duration: "" },
      ],
      marks: {
        ...resume.marks,
        ...Object.fromEntries(
          ran.filter((step) => step.enabled).map((step) => [step.key, "running" as const]),
        ),
      },
      results: resume.results,
    });
    const outcome = await runWorkflow(workflow, timezoneOffset());
    // The server has already done what the run did: the desktop carries out its part (open an
    // app, switch the appearance) even when the window has closed meanwhile.
    if (outcome.ok) requestDesktopEffects(outcome.run.effects);
    if (!mounted.current) return;
    setRunning(false);
    if (!outcome.ok) {
      // No answer, or no readable one: the steps may have acted. Show the runs, where a run
      // that happened appears, rather than invite a second run that would act twice.
      setShown({ rows: [...resume.rows, unansweredRow(outcome)], marks: {} });
      if (outcome.uncertain) void readRuns();
      return;
    }
    const result = outcome.run;
    const { named, marks, results } = ranSteps(withoutInput(result, resume.items), ran);
    setShown({
      rows: [...resume.rows, ...logRows(named)],
      marks: { ...resume.marks, ...marks },
      results: { ...resume.results, ...results },
    });
    // A read of the runs that started before this run ended would not list it.
    runsRead.current += 1;
    setRuns((list) => [result, ...list.filter((entry) => entry.id !== result.id)]);
  };

  /** Step: run the next enabled step as one request, then pause. */
  const stepOnce = async () => {
    if (running) return;
    const from = stepping ?? NOT_STEPPED;
    const at = notStepped.findIndex((step) => step.enabled);
    const next = notStepped[at];
    if (!next) return;
    const part = notStepped.slice(0, at + 1);
    const after = notStepped.slice(at + 1).find((step) => step.enabled);
    stopAsked.current = false;
    if (!stepping) runVariables.current = new Map();
    setStepping(from);
    setRunning(true);
    showLower("log");
    if (isPageAction(next.action) || next.showWhenRun) {
      const done = await runInParts(
        part,
        from.items,
        partsHost((progress) => {
          if (!mounted.current) return;
          setShown({
            rows: [...from.rows, ...progress.rows],
            marks: { ...from.marks, ...progress.marks },
            results: { ...from.results, ...progress.results },
          });
        }, true),
      );
      if (!mounted.current) return;
      setRunning(false);
      const ms = from.ms + done.ms;
      const reached = {
        marks: { ...from.marks, ...done.marks },
        results: { ...from.results, ...done.results },
      };
      const rows = [...from.rows, ...done.rows];
      void readRuns();
      if (!done.ok || done.ended || !after) {
        setStepping(null);
        setShown({
          rows: done.ended ? rows : [...rows, ...endRows({ ...done, ms }, `step:${next.key}`)],
          ...reached,
        });
        return;
      }
      setStepping({
        done: [...from.done, ...part.map((step) => step.key)],
        items: done.items,
        rows,
        ms,
        ...reached,
      });
      setShown({ rows, ...reached });
      setStatus(`Next: ${stepName(after)}. Press Step, Run for the rest, or Stop.`);
      return;
    }
    setShown({
      rows: [
        ...from.rows,
        { key: "stepping", text: `Running ${stepName(next)} on the server…`, duration: "" },
      ],
      marks: { ...from.marks, [next.key]: "running" },
      results: from.results,
    });
    const outcome = await runWorkflow(workflowToSend(part, from.items), timezoneOffset());
    if (outcome.ok) requestDesktopEffects(outcome.run.effects);
    if (!mounted.current) return;
    setRunning(false);
    if (!outcome.ok) {
      setStepping(null);
      setShown({
        rows: [...from.rows, unansweredRow(outcome)],
        marks: from.marks,
        results: from.results,
      });
      if (outcome.uncertain) void readRuns();
      return;
    }
    runsRead.current += 1;
    setRuns((list) => [outcome.run, ...list.filter((entry) => entry.id !== outcome.run.id)]);
    const { named, marks, results } = ranSteps(withoutInput(outcome.run, from.items), part);
    const ms = from.ms + outcome.run.ms;
    const reached = {
      marks: { ...from.marks, ...marks },
      results: { ...from.results, ...results },
    };
    const logged = logRows(named).filter((row) => !row.key.endsWith(":end"));
    const stepRows = logged.filter((row) => !row.key.endsWith(":output"));
    const finish = (rows: readonly LogRow[]) => {
      setStepping(null);
      setShown({ rows: [...from.rows, ...rows], ...reached });
    };
    const endRow = (ok: boolean): LogRow => ({
      key: `${outcome.run.id}:end`,
      text: `Workflow ${ok ? "completed" : "failed"}`,
      duration: formatDuration(ms),
      failed: !ok,
    });
    if (!outcome.run.ok) {
      finish([...stepRows, endRow(false)]);
      return;
    }
    if (!after) {
      finish([...logged, endRow(true)]);
      return;
    }
    if (stopAsked.current) {
      finish([
        ...stepRows,
        {
          key: `${outcome.run.id}:stopped`,
          text: `Stopped before ${stepName(after)}`,
          duration: "",
        },
      ]);
      return;
    }
    const { items, whole } = handedOn(named.steps.at(-1));
    const takesItems = actionsByName.get(after.action)?.takes_input === true && !after.ignoreInput;
    if (!whole && takesItems) {
      finish([
        ...stepRows,
        {
          key: `${outcome.run.id}:cut`,
          text: `Stopped before ${stepName(after)}: the server's log holds only the first 5 items, of up to 200 characters, and a stepped run could hand on no more. Press Run to run the whole workflow.`,
          duration: "",
          failed: true,
        },
      ]);
      return;
    }
    const rows = [...from.rows, ...stepRows];
    setStepping({
      done: [...from.done, ...part.map((step) => step.key)],
      items,
      rows,
      ms,
      ...reached,
    });
    setShown({ rows, ...reached });
    setStatus(`Next: ${stepName(after)}. Press Step, Run for the rest, or Stop.`);
  };

  /** Stop: end a stepped run, now while it pauses, or after the step under way. */
  const stopStepping = () => {
    if (!stepping && !inParts) return;
    if (running) {
      stopAsked.current = true;
      setStatus("Stopping after this action…");
      asking?.answer(null);
      showing?.answer(null);
      return;
    }
    const next = notStepped.find((step) => step.enabled);
    setStepping(null);
    setShown((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          key: `stopped:${stepping?.done.length ?? 0}`,
          text: next ? `Stopped before ${stepName(next)}` : "Stopped",
          duration: "",
        },
      ],
    }));
    setStatus("");
  };

  /** The stored workflows, read again when the window could not read them when it opened. */
  const storedNow = async (): Promise<WorkflowsState | null> => {
    if (stored) return stored;
    try {
      const state = await loadWorkflows();
      if (mounted.current) setStored((current) => newerOf(current, state));
      return state;
    } catch (error) {
      if (mounted.current) {
        setStatus(`The saved workflows could not be read: ${ending(messageOf(error))}.`);
      }
      return null;
    }
  };

  /** Save the draft; the stored workflows the save left, or `null` when it failed. */
  const save = async (): Promise<WorkflowsState | null> => {
    if (busy) return null;
    setHistory(endedTyping);
    const workflow = workflowOfDraft(draft, actionsByName);
    const sent = JSON.stringify(workflow);
    setBusy(true);
    setStatus("Saving…");
    const state = await storedNow();
    if (!mounted.current) return null;
    if (!state) {
      setBusy(false);
      return null;
    }
    let alarmAt: Date | null = null;
    if (workflow.kind === "calendar-alarm") {
      try {
        alarmAt = await ensureAlarmEvent(workflow);
      } catch (error) {
        if (mounted.current) {
          setBusy(false);
          setStatus(`Could not add its event to Calendar: ${ending(messageOf(error))}.`);
        }
        return null;
      }
      if (!mounted.current) return null;
    }
    const outcome = await saveChange(state, { type: "put", workflow }, timezoneOffset());

    if (!mounted.current) return null;
    setBusy(false);
    if (outcome.state) setStored(outcome.state);
    if (outcome.ok) {
      // The name as sent, written back only if the person has not renamed the workflow while it
      // was saved; a newer name stays, and leaves the draft unsaved.
      setDraft((current) =>
        current.id === workflow.id && current.name === draft.name
          ? { ...current, name: workflow.name }
          : current,
      );
      setClean(sent);
      setStatus(
        alarmAt
          ? `Saved “${workflow.name}”. Its alert in Calendar is at ${alarmAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}: move the event to change when it runs.`
          : `Saved “${workflow.name}”.`,
      );
      if (alarmAt) requestDesktopEffects([{ open: "calendar" }]);
      noteRecent(workflow.id);
      const after = outcome.state ?? state;
      void saveWorkflowFile(
        { ...draft, name: workflow.name },
        (after.library?.workflows ?? []).map((each) => each.id),
        currentDesktopSession(),
      ).catch((error: unknown) => {
        if (mounted.current) {
          setStatus(
            `Saved “${workflow.name}”, but its file on your drive was not updated: ${ending(messageOf(error))}.`,
          );
        }
      });
      return after;
    }
    setStatus(`Could not save “${workflow.name}”: ${ending(outcome.error)}.`);
    return null;
  };

  const remove = async () => {
    if (busy || savedId === null) return;
    const { id } = draft;
    const name = saved.find((workflow) => workflow.id === id)?.name ?? title;
    setBusy(true);
    setStatus("Deleting…");
    const state = await storedNow();
    if (!mounted.current) return;
    if (!state) {
      setBusy(false);
      return;
    }
    const outcome = await saveChange(state, { type: "delete", id }, timezoneOffset());
    if (!mounted.current) return;
    setBusy(false);
    if (outcome.state) setStored(outcome.state);
    if (outcome.ok) {
      if (keptVariables[id]) {
        const { [id]: _gone, ...others } = keptVariables;
        setKeptVariables(others);
      }
      setDraft((current) => (current.id === id ? newDraft() : current));
      forgetStepEdits();
      setClean(null);
      setShown(NOTHING_SHOWN);
      setStatus(`Deleted “${name}”.`);
    } else {
      setStatus(`Could not delete “${name}”: ${ending(outcome.error)}.`);
    }
  };

  /**
   * Open a saved workflow (`id`) or start a new one (`null`), replacing the draft. `from` is the
   * stored list to open it from (after a save, the one that save returned, which may hold
   * another window's newer version of it).
   */
  const replaceDraft = (
    id: string | null,
    from: readonly Workflow[] = saved,
    kind?: WorkflowKind,
  ) => {
    if (id === null) {
      setDraft(newDraft(kind));
      forgetStepEdits();
      setClean(null);
      setShown(NOTHING_SHOWN);
      setStatus("");
      return;
    }
    const workflow = from.find((entry) => entry.id === id);
    if (!workflow) return;
    const opened = draftFromWorkflow(workflow, nextKey);
    setDraft(opened);
    forgetStepEdits();
    setClean(JSON.stringify(workflowOfDraft(opened, actionsByName)));
    setShown(NOTHING_SHOWN);
    setStatus(`Opened “${workflow.name}”.`);
    noteRecent(workflow.id);
  };

  // The workflow in the window across a reload: taken up once the library and the saved workflows
  // are here, unless the person began something first, and kept with each change. The settings'
  // store sends the latest when it can, and a page that leaves first hands it on to the next one.
  const keptNow = useKeptWorkflow();
  const keptTaken = useRef(false);
  const keptHeld = useRef(false);
  const [keptTooLong, setKeptTooLong] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: taken up once, from what is here then
  useEffect(() => {
    if (keptTaken.current || !keptNow || !actions || !stored) return;
    keptTaken.current = true;
    keptHeld.current = true;
    if (unsaved) return;
    if ("open" in keptNow) {
      replaceDraft(keptNow.open);
      return;
    }
    setDraft({
      ...keptNow.draft,
      steps: keptNow.draft.steps.map((step) => ({ ...step, key: nextKey() })),
    });
    forgetStepEdits();
    setClean(keptNow.clean);
  }, [keptNow, actions, stored]);
  const toKeep: KeptWorkflow | null = unsaved
    ? keptChanges(draft, clean)
    : savedId !== null
      ? { open: savedId }
      : null;
  const toKeepText = JSON.stringify(toKeep);
  // biome-ignore lint/correctness/useExhaustiveDependencies: what is kept changes with its text
  useEffect(() => {
    if (!keptHeld.current && toKeep === null) return;
    if (!keptTaken.current && keptNow && !unsaved) return;
    keptHeld.current = toKeep !== null;
    if (toKeep === null) forgetKeptText(KEPT_WORKFLOW);
    else setKeptTooLong(!keepText(KEPT_WORKFLOW, toKeepText));
  }, [toKeepText]);
  /** The window closes: its workflow is no one's to bring back. */
  const letGoOfKept = () => {
    keptHeld.current = false;
    forgetKeptText(KEPT_WORKFLOW);
  };

  /** New or Open: over unsaved changes, ask first what becomes of them. Not while a save or a
   * delete is under way: its answer belongs to the workflow in the window. */
  const switchTo = (id: string | null, kind?: WorkflowKind) => {
    if (busy) return;
    if (id !== null && (id === draft.id || !saved.some((entry) => entry.id === id))) return;
    if (unsaved) setSwitching({ open: id, kind });
    else replaceDraft(id, saved, kind);
  };

  const showFileDraft = (file: WorkflowDraft) => {
    setDraft(file);
    forgetStepEdits();
    setClean(null);
    setShown(NOTHING_SHOWN);
    setStatus(`Opened “${file.name}” from your drive. Save keeps it among your workflows.`);
  };

  /** A workflow's file opened from Finder. */
  const openWorkflowFile = async ({ id, name }: OpenFileRequest) => {
    try {
      const moved = await workflowOfFile(id).catch(() => null);
      if (!mounted.current) return;
      if (moved !== null && saved.some((entry) => entry.id === moved)) {
        if (moved === draft.id) setStatus(`“${name}” is this workflow, open here.`);
        else switchTo(moved);
        return;
      }
      const file = draftFromFile(await (await readFile(id)).text(), name, nextKey);
      if (!mounted.current) return;
      if (!file) {
        setStatus(`“${name}” is not a workflow this desktop wrote, so it cannot be opened.`);
      } else if (unsaved) setSwitching({ open: null, file });
      else showFileDraft(file);
    } catch (error) {
      if (mounted.current) setStatus(`“${name}” could not be read: ${ending(messageOf(error))}.`);
    }
  };
  const openWorkflowFileNow = useRef(openWorkflowFile);
  openWorkflowFileNow.current = openWorkflowFile;
  const libraryReady = actions !== null && stored !== null;
  useEffect(() => {
    if (!libraryReady) return undefined;
    for (const request of takeOpenFileRequests("automator")) {
      void openWorkflowFileNow.current(request);
    }
    return onOpenFileRequest("automator", (request) => void openWorkflowFileNow.current(request));
  }, [libraryReady]);

  /** File > Export…: a copy of the workflow as a file in the folder the Save dialog chose. */
  const exportWorkflow = async (target: DriveSaveTarget) => {
    setExporting(false);
    try {
      const file = new Blob([workflowFileText(draft)], { type: "application/json" });
      await saveToDrive(target, file);
      if (mounted.current) setStatus(`Exported “${target.name}” to your drive.`);
    } catch (error) {
      if (mounted.current) setStatus(`It could not be exported: ${ending(messageOf(error))}.`);
    }
  };

  /** File > Move To…: the saved workflow's file, in the folder the dialog chose. */
  const moveTo = async (target: DriveSaveTarget) => {
    setMoving(false);
    try {
      const where = await moveWorkflowFile(
        draft,
        target,
        saved.map((entry) => entry.id),
      );
      if (mounted.current) {
        setStatus(
          `Moved “${title}” to ${where}. Anything that starts it goes on starting it, and saving updates that file.`,
        );
      }
    } catch (error) {
      if (mounted.current) setStatus(`It could not be moved: ${ending(messageOf(error))}.`);
    }
  };

  const open = (id: string | null) => {
    if (id !== null) switchTo(id);
  };

  const startNew = () => switchTo(null);

  /** Close the window: over unsaved changes, ask first, as New and Open do. */
  const close = (event: MouseEvent<HTMLElement>) => {
    if (unsaved) setSwitching({ open: null, close: event });
    else {
      letGoOfKept();
      onClose?.(event);
    }
  };

  /** Carry out the New, Open or close the sheet asked about, opening from `from`. */
  const finishSwitch = (
    next: {
      open: string | null;
      close?: MouseEvent<HTMLElement>;
      file?: WorkflowDraft;
      kind?: WorkflowKind;
    },
    from: readonly Workflow[] = saved,
  ) => {
    if (next.close) {
      letGoOfKept();
      onClose?.(next.close);
    } else if (next.file) showFileDraft(next.file);
    else replaceDraft(next.open, from, next.kind);
  };

  const showRun = (entry: RunLog | undefined) => {
    if (!entry) return;
    setShown({ rows: logRows(entry), marks: {}, results: resultsOfRun(entry) });
    showLower("log");
  };

  const field = (name: string) => `${ids}-${name}`;

  const canRun = !running && draft.steps.length > 0;
  const typingNow = inText && textField.current?.isConnected === true;
  const toggleLibrary = () => setLibraryWanted(!libraryShown);
  const toggleLog = () => setLogShown(!logShown);
  const searchLibrary = () => {
    setLibraryWanted(true);
    whenMenusClosed(document, () => searchField.current?.focus());
  };
  const openFile = () => {
    if (!busy && saved.length > 0) setOpenSheet(true);
  };
  /** The workflow as the page File > Print hands to the browser. */
  const printWorkflow = () => {
    const steps = draft.steps
      .map((step, at) => {
        const action = actionsByName.get(step.action);
        const settings = paramsOfStep(step, action)
          .map(
            (param) =>
              `<div>${escapeHtml(param.name)}: ${escapeHtml(String(step.params[param.name] ?? ""))}</div>`,
          )
          .join("");
        return `<p><b>${at + 1}. ${escapeHtml(stepName(step))}</b>${step.enabled ? "" : " (disabled)"}</p>${settings}`;
      })
      .join("");
    printDocument({
      name: title,
      html: `<h1>${escapeHtml(title)}</h1>${steps}`,
      lines: [],
      plain: false,
    });
  };
  const duplicate = () => {
    if (busy) return;
    const name = `${title} copy`;
    const copyId = newDraft().id;
    if (ownVariables.length > 0) setKeptVariables({ ...keptVariables, [copyId]: ownVariables });
    setDraft({
      ...draft,
      id: copyId,
      name,
      steps: draft.steps.map((step) => ({ ...step, key: nextKey() })),
    });
    forgetStepEdits();
    setClean(null);
    setShown(NOTHING_SHOWN);
    setStatus(`“${name}” is a copy: save it to keep it.`);
  };

  // The menu bar's rows and the keys. A row changes only with the state it shows; what it does is
  // read when it is chosen.
  const commands = useRef<AutomatorCommands | null>(null);
  commands.current = {
    newWorkflow: startNew,
    chooseType: () => {
      if (!busy) setChoosingType("new");
    },
    convertType: () => {
      if (!busy) setChoosingType("convert");
    },
    open: openFile,
    save: () => void save(),
    duplicate,
    rename: () =>
      whenMenusClosed(document, () => {
        const name = document.getElementById(field("name")) as HTMLInputElement | null;
        name?.focus();
        name?.select();
      }),
    revert: () => {
      if (savedId === null) return;
      replaceDraft(savedId);
      setStatus(`Reverted to the last saved “${title}”.`);
    },
    browseVersions: () => {
      if (savedId === null) return;
      setBrowsing({ versions: null });
      loadVersions(savedId).then(
        (versions) => {
          if (mounted.current) setBrowsing({ versions });
        },
        (error: unknown) => {
          if (!mounted.current) return;
          setBrowsing(null);
          setStatus(`The versions could not be read: ${String(error)}`);
        },
      );
    },
    edit: (command) => {
      const text = typingNow ? textField.current : null;
      if (text) {
        editText(text, command, () =>
          setStatus("This browser keeps the clipboard from menus: the key still pastes."),
        );
      } else stepCommand(command);
    },
    selectAll: () => {
      const text = typingNow ? textField.current : null;
      if (text instanceof HTMLInputElement || text instanceof HTMLTextAreaElement) {
        const selectText = () => {
          text.focus();
          text.select();
        };
        whenMenusClosed(document, selectText);
      } else {
        setChosenKeys(draft.steps.map((step) => step.key));
        whenMenusClosed(document, giveStepsTheKeyboard);
      }
    },
    searchLibrary,
    toggleLibrary,
    toggleLog,
    toggleVariables: () => {
      if (logShown && lowerView === "variables") setLogShown(false);
      else showLower("variables");
    },
    toggleToolbar: () => setToolbarShown(!toolbarShown),
    run: () => void run(),
    step: () => void stepOnce(),
    stop: stopStepping,
    renameStep: () => setRenaming(chosenSteps[0]?.key ?? null),
    customizeToolbar: () => setCustomizing(true),
    showMedia: () => setMediaOpen(true),
    exportFile: () => setExporting(true),
    moveTo: async () => {
      if (busy) return;
      if (savedId === null || unsaved) {
        if (!(await save()) || !mounted.current) return;
      }
      setMoving(true);
    },
    toggleEnabled: () => {
      const enabled = !chosenSteps.some((step) => step.enabled);
      changeSteps((steps) =>
        steps.map((step) => (chosenSteps.includes(step) ? { ...step, enabled } : step)),
      );
    },
    removeChosen: () => removeSteps(chosenSteps.map((step) => step.key)),
    collapse: (collapse) => {
      const keys = chosenSteps.map((step) => step.key);
      setCollapsed((held) =>
        collapse ? [...held, ...keys] : held.filter((key) => !keys.includes(key)),
      );
    },
    ignoreInput: (ignoreInput) =>
      changeSteps((steps) =>
        steps.map((step) =>
          chosenSteps.includes(step) && takesInput(step) ? { ...step, ignoreInput } : step,
        ),
      ),
    showResults: (open) => setResultsOpen((held) => withKeys(held, chosenKeys, open)),
    showOptions: (open) => setOptionsOpen((held) => withKeys(held, chosenKeys, open)),
    move: (by) =>
      changeSteps((steps) =>
        movedSteps(
          steps,
          chosenSteps.map((step) => step.key),
          by < 0 ? firstChosen - 1 : lastChosen + 2,
        ),
      ),
    openRecent: switchTo,
    clearRecents: () => setRecentIds([]),
    print: printWorkflow,
    shareMail: () => {
      const file = new Blob([workflowFileText(draft)], { type: "application/json" });
      shareFiles(
        "mail",
        [
          {
            id: `automator:${draft.name}`,
            name: fileNameOf(draft.name, draft.kind),
            kind: "file",
            type: file.type,
            size: file.size,
            bytes: async () => file,
          },
        ],
        "automator",
      );
    },
    speak: () => {
      const field = typingNow ? textField.current : null;
      const typed =
        field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
          ? field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0) || field.value
          : "";
      const said =
        typed ||
        draft.steps.map((step) => actionsByName.get(step.action)?.title ?? step.action).join(". ");
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(said));
    },
  };
  const state: AutomatorMenuState = {
    busy,
    hasSaved: saved.length > 0,
    canRevert: savedId !== null && unsaved && !busy,
    canBrowseVersions: savedId !== null && !busy,
    inText: typingNow,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    canPaste: clipboard.length > 0,
    steps: draft.steps.length,
    chosen: chosenSteps.length,
    canMoveUp: firstChosen > 0,
    canMoveDown: lastChosen >= 0 && lastChosen < draft.steps.length - 1,
    anyEnabled: chosenSteps.some((step) => step.enabled),
    anyCollapsed: chosenSteps.some((step) => collapsed.includes(step.key)),
    anyExpanded: chosenSteps.some((step) => !collapsed.includes(step.key)),
    ignoringInput:
      chosenSteps.some(takesInput) &&
      chosenSteps.filter(takesInput).every((step) => step.ignoreInput),
    canIgnoreInput: chosenSteps.some(takesInput),
    resultsOpen: chosenKeys.length > 0 && chosenKeys.every((key) => resultsOpen.includes(key)),
    optionsOpen: chosenKeys.length > 0 && chosenKeys.every((key) => optionsOpen.includes(key)),
    libraryShown,
    logShown,
    toolbarShown,
    canRun,
    canStep,
    canStop,
    recents: recentIds.flatMap((id) =>
      saved.filter((entry) => entry.id === id).map(({ name }) => ({ id, name })),
    ),
    hasSteps: draft.steps.length > 0,
  };
  const stateKey = JSON.stringify(state);
  const menuRows = useMemo(
    () => automatorMenuRows(JSON.parse(stateKey), () => commands.current as AutomatorCommands),
    [stateKey],
  );
  useDesktopAppMenu("automator", "File", menuRows.file, titleBar);
  useDesktopAppMenu("automator", "Edit", menuRows.edit, titleBar);
  useDesktopAppMenu("automator", "View", menuRows.view, titleBar);
  useDesktopAppMenu("automator", "Workflow", menuRows.workflow, titleBar);
  useDesktopAppMenu("automator", "Action", menuRows.action, titleBar);

  // The window's key equivalents, wherever in the window the keyboard is. The key window alone
  // answers them, after anything inside it that took the key. In a text field the editing keys are
  // the field's, and in a list Select All and Delete are not about the steps.
  const latestKeys = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  latestKeys.current = (event) => {
    if (event.defaultPrevented || event.repeat || !titleBar?.isConnected) return;
    if (
      switching ||
      openSheet ||
      choosingType ||
      customizing ||
      exporting ||
      moving ||
      askingCopy ||
      renaming !== null ||
      asking ||
      showing ||
      editingVariable
    ) {
      return;
    }
    const windowState = titleBar.closest("[data-window-state]")?.getAttribute("data-window-state");
    if (windowState !== undefined && windowState !== null && windowState !== "key") return;
    const command = commands.current as AutomatorCommands;
    const typing = isTextField(event.target);
    const inList =
      event.target instanceof Element &&
      event.target.closest('[role="grid"], [role="treegrid"]') !== null;
    const bindings: [string, () => void][] = [
      ["command+n", command.chooseType],
      ["command+o", command.open],
      ["command+s", command.save],
      ["shift+command+s", command.duplicate],
      ["command+r", command.run],
      ["option+command+r", command.step],
      ["command+.", command.stop],
      ["option+command+l", command.toggleLibrary],
      ["option+command+g", command.toggleLog],
      ["option+command+v", command.toggleVariables],
      ["option+command+f", command.searchLibrary],
    ];
    if (!typing) {
      bindings.push(
        ["command+z", () => stepCommand("undo")],
        ["shift+command+z", () => stepCommand("redo")],
      );
      if (clipboard.length > 0) bindings.push(["command+v", () => stepCommand("paste")]);
      if (!inList && chosenSteps.length > 0) {
        bindings.push(
          ["command+x", () => stepCommand("cut")],
          ["command+c", () => stepCommand("copy")],
          ["delete", () => stepCommand("delete")],
          ["forward-delete", () => stepCommand("delete")],
        );
      }
      if (!inList && draft.steps.length > 0) {
        bindings.push(["command+a", () => setChosenKeys(draft.steps.map((step) => step.key))]);
      }
    }
    for (const [equivalent, act] of bindings) {
      if (!matchesMenuKeyEquivalent(event, equivalent)) continue;
      event.preventDefault();
      act();
      return;
    }
  };
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => latestKeys.current(event);
    document.addEventListener("keydown", listen);
    return () => document.removeEventListener("keydown", listen);
  }, []);

  const noteKeyboard = ({ target }: { target: EventTarget }) => {
    if (isTextField(target)) textField.current = target;
    setInText(isTextField(target));
  };

  const toolbarNodes: Record<string, ReactNode> = {
    Library: (
      <ToolbarLabelledItem label="Library" style={ITEM}>
        <ToolbarButton
          aria-pressed={libraryShown}
          className="mac-automator-toggle"
          style={BUTTON}
          onClick={toggleLibrary}
        >
          <SystemImage name="sidebar" />
        </ToolbarButton>
      </ToolbarLabelledItem>
    ),
    Media: (
      <ToolbarLabelledItem label="Media" style={ITEM}>
        <ToolbarButton style={BUTTON} onClick={() => setMediaOpen((open) => !open)}>
          <MediaGlyph />
        </ToolbarButton>
      </ToolbarLabelledItem>
    ),
    "Flexible Space": <ToolbarSpace />,
    Record: (
      <ToolbarLabelledItem label="Record" style={ITEM}>
        <ToolbarButton
          pressed={false}
          className="mac-automator-record"
          style={BUTTON}
          disabled
          title={NO_RECORD}
        >
          <RecordGlyph />
        </ToolbarButton>
      </ToolbarLabelledItem>
    ),
    Step: (
      <ToolbarLabelledItem label="Step" style={ITEM}>
        <ToolbarButton style={BUTTON} disabled={!canStep} onClick={() => void stepOnce()}>
          <StepGlyph />
        </ToolbarButton>
      </ToolbarLabelledItem>
    ),
    Stop: (
      <ToolbarLabelledItem label="Stop" style={ITEM}>
        <ToolbarButton
          style={BUTTON}
          disabled={!canStop}
          title={canStop ? undefined : SERVER_RUNS}
          onClick={stopStepping}
        >
          <StopGlyph />
        </ToolbarButton>
      </ToolbarLabelledItem>
    ),
    Run: (
      <ToolbarLabelledItem label="Run" style={ITEM}>
        <ToolbarButton
          style={BUTTON}
          disabled={running || draft.steps.length === 0}
          onClick={() => void run()}
        >
          <RunGlyph />
        </ToolbarButton>
      </ToolbarLabelledItem>
    ),
  };

  return (
    <Window
      width={width}
      height={height}
      className={cn("mac-automator", className)}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        variant={toolbarShown ? "unified" : "standard"}
        title={title}
        controls={
          <WindowControls
            onClose={onClose ? close : undefined}
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
        {toolbarShown ? (
          <ContextualMenu>
            <ContextualMenuTrigger className="mac-automator-toolbar-area">
              <Toolbar displayMode="icon-and-label" aria-label="Toolbar" style={{ height: 46 }}>
                {toolbarOrder.filter(inToolbar).map((item) => (
                  <Fragment key={item}>{toolbarNodes[item]}</Fragment>
                ))}
              </Toolbar>
            </ContextualMenuTrigger>
            <ContextualMenuPopup aria-label="Toolbar commands">
              <MenuItem onClick={() => setToolbarShown(false)}>Hide Toolbar</MenuItem>
              <MenuItem onClick={() => setCustomizing(true)}>Customize Toolbar…</MenuItem>
            </ContextualMenuPopup>
          </ContextualMenu>
        ) : null}
      </TitleBar>
      <WindowBody
        background="content"
        className="mac-automator-body"
        onFocus={noteKeyboard}
        onBlur={(event) => {
          setHistory(endedTyping);
          // A menu in a portal is outside this window, so it keeps Edit on the field.
          const to = event.relatedTarget;
          if (
            to instanceof Element &&
            !isTextField(to) &&
            event.currentTarget.parentElement?.contains(to)
          ) {
            setInText(false);
          }
        }}
        onPointerDownCapture={noteKeyboard}
      >
        {keptTooLong ? (
          <WindowBanner role="status">
            This workflow is too long to keep across a reload, so the last version that fit is what
            comes back. Save it to keep your changes.
          </WindowBanner>
        ) : null}
        <SplitView className="mac-automator-split" style={DIVIDER}>
          <SplitViewPane
            size={librarySize}
            onSizeChange={(size) => {
              setLibrarySize(size);
              if (size > 0) libraryRestore.current = size;
              paneSized("library")(size);
              if (size > 0 !== libraryWanted) setLibraryWanted(size > 0);
            }}
            minSize={300}
            maxSize={520}
            collapsible
            className="mac-automator-column"
          >
            <ScopeBar className="mac-automator-band">
              <ScopeBarGroup
                aria-label="Library"
                value={libraryKind}
                onValueChange={(value) => {
                  setLibraryKind(value === "variables" ? "variables" : "actions");
                  setSelection([]);
                }}
              >
                <ScopeBarButton value="actions" className="mac-automator-scope" style={SCOPE}>
                  Actions
                </ScopeBarButton>
                <ScopeBarButton value="variables" className="mac-automator-scope" style={SCOPE}>
                  Variables
                </ScopeBarButton>
              </ScopeBarGroup>
              <SearchField
                inputRef={searchField}
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
                  <SplitViewPane
                    size={paneSizes.categories ?? 163}
                    onSizeChange={paneSized("categories")}
                    minSize={100}
                    maxSize={260}
                  >
                    <OutlineView
                      aria-label={
                        libraryKind === "variables" ? "Variable categories" : "Action categories"
                      }
                      className="mac-automator-list"
                      items={categories}
                      renderCell={(item) => (
                        <Row tint={item.tint} inset={item.children ? -0.5 : 1}>
                          {item.name}
                        </Row>
                      )}
                      getItemLabel={(item) => item.name}
                      expanded={expanded}
                      onExpandedChange={(next) => {
                        const opened = next.filter((id): id is string => typeof id === "string");
                        setExpanded(opened);
                        if (!opened.includes(SERVED_ROOT) && !smartList) {
                          chooseCategory(SERVED_ROOT);
                        }
                      }}
                      value={[categoryId]}
                      onValueChange={(value) => {
                        const id = value[0];
                        if (typeof id === "string") chooseCategory(id);
                      }}
                      rowHeight={ROW_HEIGHT}
                      size="mini"
                    />
                  </SplitViewPane>
                  <SplitViewDivider aria-label="Resize the categories" />
                  <SplitViewPane minSize={120}>
                    <ContextualMenu>
                      <ContextualMenuTrigger
                        className="mac-automator-steps-area"
                        onContextMenu={(event) => {
                          if (!(event.target as HTMLElement).closest('[role="row"]')) {
                            event.preventBaseUIHandler();
                          }
                        }}
                      >
                        <TableView
                          aria-label={libraryKind === "variables" ? "Variables" : "Actions"}
                          className="mac-automator-list"
                          columns={NAME_COLUMN}
                          header="none"
                          selectionMode="multiple"
                          rowCount={rows.length}
                          rowHeight={ROW_HEIGHT}
                          size="mini"
                          getRowId={(row) => rows[row]?.name ?? row}
                          getRowLabel={(row) => rows[row]?.title ?? ""}
                          getRowProps={libraryRowProps}
                          value={selectedRows.map((row) => row.name)}
                          onValueChange={(value) =>
                            setSelection(value.filter((id) => typeof id === "string"))
                          }
                          onRowAction={(row) => {
                            const action = rows[row];
                            if (!action) return;
                            add(selection.includes(action.name) ? selectedRows : [action]);
                          }}
                          renderCell={(row) => {
                            const action = rows[row];
                            return action ? (
                              <Row tint={tintOfAction(action)} inset={1} reason={action.reason}>
                                {action.title}
                              </Row>
                            ) : null;
                          }}
                        />
                      </ContextualMenuTrigger>
                      <ContextualMenuPopup aria-label="Action commands">
                        <MenuItem disabled={!canAddRows} onClick={() => add(selectedRows)}>
                          {libraryKind === "variables" ? "Add to Variables" : "Add to Workflow"}
                        </MenuItem>
                        <MenuItem
                          disabled={selected === undefined}
                          onClick={() => selected && findInLibrary(selected)}
                        >
                          Find in Library
                        </MenuItem>
                      </ContextualMenuPopup>
                    </ContextualMenu>
                  </SplitViewPane>
                </SplitView>
              </SplitViewPane>
              {descriptionShown ? (
                <>
                  <SplitViewDivider aria-label="Resize the description" />
                  <SplitViewPane
                    size={paneSizes.description ?? 115}
                    onSizeChange={paneSized("description")}
                    minSize={60}
                    maxSize={300}
                  >
                    <section aria-label="Description" className="mac-automator-description">
                      {selected ? (
                        <>
                          <div className="mac-automator-description-head">
                            <PlaceholderIcon tint={tintOfAction(selected)} size={32} />
                            <h2 className="mac-automator-description-title">{selected.title}</h2>
                          </div>
                          <Label
                            render={<p />}
                            textStyle="small"
                            selectable
                            className="mac-automator-description-text"
                          >
                            {selected.summary}
                          </Label>
                          {selected.reason ? (
                            <Label
                              render={<p />}
                              textStyle="small"
                              color="secondary"
                              selectable
                              className="mac-automator-description-text"
                            >
                              {selected.reason}
                            </Label>
                          ) : selectedIsVariable ? (
                            <dl className="mac-automator-facts">
                              <div className="mac-automator-fact">
                                <dt>Value:</dt>
                                <dd>{readVariable(selected.title)?.join(", ") || "Empty"}</dd>
                              </div>
                            </dl>
                          ) : (
                            <dl className="mac-automator-facts">
                              {[
                                [
                                  "Input",
                                  selected.takes_input ? "The previous step's output" : "Not used",
                                ],
                                [
                                  "Settings",
                                  selected.params.map((param) => param.name).join(", ") || "None",
                                ],
                                ["Changes", selected.writes ? "Your data" : "Nothing"],
                              ].map(([name, value]) => (
                                <div key={name} className="mac-automator-fact">
                                  <dt>{name}:</dt>
                                  <dd>{value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </>
                      ) : (
                        <EmptyState>
                          {actions === null
                            ? "Loading Actions…"
                            : actionsError
                              ? "The Library Could Not Be Loaded"
                              : selectedRows.length > 1
                                ? `${selectedRows.length} ${libraryKind === "variables" ? "Variables" : "Actions"} Selected`
                                : libraryKind === "variables"
                                  ? "No Variable Selected"
                                  : "No Action Selected"}
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
                    <MenuItem disabled={!canAddRows} onClick={() => add(selectedRows)}>
                      Add to Workflow
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      disabled={draft.steps.length === 0}
                      onClick={() => changeSteps(() => [])}
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
            {/* biome-ignore lint/a11y/useSemanticElements: a group of the document's controls, not a form fieldset */}
            <div role="group" aria-label="Document" className="mac-automator-document">
              <div className="mac-automator-document-row">
                <PopUpButton<string>
                  size="small"
                  aria-label="Open Workflow"
                  placeholder="Workflows"
                  value={savedId}
                  onValueChange={open}
                  disabled={saved.length === 0 || busy}
                  className="mac-automator-open"
                >
                  {saved.map((workflow) => (
                    <PopUpButtonItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
                <PushButton
                  size="small"
                  aria-label="New Workflow"
                  disabled={busy}
                  onClick={startNew}
                >
                  New
                </PushButton>
                <PushButton
                  size="small"
                  aria-label="Save Workflow"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  Save
                </PushButton>
                <PushButton
                  size="small"
                  aria-label="Delete Workflow"
                  disabled={busy || savedId === null}
                  onClick={() => setAskingDelete(true)}
                >
                  Delete
                </PushButton>
                <Label
                  role="status"
                  textStyle="small"
                  color="secondary"
                  truncate
                  className="mac-automator-status"
                >
                  {status}
                </Label>
              </div>
              <div className="mac-automator-document-row">
                <span className="mac-automator-field">
                  <FieldLabel htmlFor={field("name")}>Name:</FieldLabel>
                  <TextField
                    id={field("name")}
                    aria-label="Workflow name"
                    size="small"
                    className="mac-automator-name-field"
                    placeholder="Untitled"
                    value={draft.name}
                    onValueChange={(name) => edit({ name })}
                  />
                </span>
                <span className="mac-automator-field">
                  <FieldLabel>Type:</FieldLabel>
                  <PopUpButton<string>
                    size="small"
                    aria-label="Workflow type"
                    value={draft.kind}
                    onValueChange={(kind) => edit({ kind: kind as WorkflowKind })}
                  >
                    {documentTypes().map(({ name, reason }) => (
                      <PopUpButtonItem
                        key={name}
                        value={kindOfType(name)}
                        disabled={reason !== undefined}
                        title={reason}
                      >
                        {reason ? `${name} (not available yet)` : name}
                      </PopUpButtonItem>
                    ))}
                  </PopUpButton>
                </span>
                <TypeFields draft={draft} edit={edit} />
              </div>
              <Label
                render={<p />}
                textStyle="small"
                color="secondary"
                className="mac-automator-document-note"
              >
                {typeNote(draft.kind, draft.name)}
              </Label>
            </div>
            <SplitView orientation="vertical" className="mac-automator-stack">
              <SplitViewPane minSize={80}>
                <ContextualMenu>
                  <ContextualMenuTrigger
                    className="mac-automator-steps-area"
                    onContextMenu={(event) => {
                      const target = event.target as HTMLElement;
                      const item = target.closest<HTMLElement>("[data-step-key]");
                      if (target.closest("input, textarea") || !item) {
                        event.preventBaseUIHandler();
                        return;
                      }
                      const key = Number(item.dataset.stepKey);
                      if (!chosenKeys.includes(key)) chooseOnly([key]);
                    }}
                  >
                    <section
                      ref={stepsPane}
                      aria-label="Workflow"
                      className="mac-automator-workflow"
                      // biome-ignore lint/a11y/noNoninteractiveTabindex: the keyboard's place for the selected steps, which take arrows, Delete and the Edit keys
                      tabIndex={0}
                      data-dropping={dropAt !== null && draft.steps.length === 0 ? "" : undefined}
                      onClick={clickSteps}
                      onKeyDown={stepKeys}
                      {...stepsDrop}
                    >
                      {draft.steps.length === 0 ? (
                        <EmptyState variant="capsule" style={PLACEHOLDER}>
                          Drag actions here, or double-click one, to build your workflow.
                        </EmptyState>
                      ) : (
                        <ScrollView className="mac-automator-steps-scroll">
                          <ol className="mac-automator-steps">
                            {draft.steps.map((step, index) => {
                              const action = actionsByName.get(step.action);
                              const name = stepName(step);
                              const mark = shown.marks[step.key];
                              const params = paramsOfStep(step, action);
                              const following = draft.steps[index + 1];
                              const feeds =
                                following !== undefined &&
                                step.enabled &&
                                takesInput(following) &&
                                !following.ignoreInput;
                              return (
                                <Fragment key={step.key}>
                                  <li
                                    className="mac-automator-step"
                                    data-step-key={step.key}
                                    data-state={mark ?? "pending"}
                                    data-enabled={step.enabled ? undefined : "false"}
                                    data-selected={chosenKeys.includes(step.key) ? "" : undefined}
                                    data-drop={
                                      dropAt === index
                                        ? "before"
                                        : dropAt === index + 1 && index === draft.steps.length - 1
                                          ? "after"
                                          : undefined
                                    }
                                  >
                                    {/* biome-ignore lint/a11y/useSemanticElements: a step's controls, named by its action, not a form fieldset */}
                                    <div
                                      role="group"
                                      aria-label={name}
                                      aria-current={
                                        chosenKeys.includes(step.key) ? "true" : undefined
                                      }
                                    >
                                      {/* biome-ignore lint/a11y/noStaticElementInteractions: a mouse drag; Move Up and Move Down are the keyboard's way */}
                                      <div
                                        className="mac-automator-step-head"
                                        draggable
                                        onDragStart={(event) => startStepDrag(event, step.key)}
                                        onDragEnd={() => {
                                          movingSteps.current = null;
                                          setDropAt(null);
                                        }}
                                      >
                                        <span className="mac-automator-step-number">
                                          {index + 1}
                                        </span>
                                        <PlaceholderIcon tint={tintOfAction(action)} />
                                        <Label
                                          textStyle="emphasized"
                                          truncate
                                          className="mac-automator-step-name"
                                        >
                                          {name}
                                        </Label>
                                        {mark ? (
                                          <span
                                            role="img"
                                            aria-label={MARK_NAMES[mark]}
                                            className="mac-automator-step-mark"
                                          />
                                        ) : null}
                                        <Checkbox
                                          size="small"
                                          checked={step.enabled}
                                          onCheckedChange={(enabled) =>
                                            editStep(step.key, (current) => ({
                                              ...current,
                                              enabled,
                                            }))
                                          }
                                        >
                                          Enabled
                                        </Checkbox>
                                        <ImageButton
                                          aria-label={`Remove ${name}`}
                                          className="mac-automator-step-remove"
                                          style={barButton("4px")}
                                          onClick={() => removeSteps([step.key])}
                                        >
                                          <SystemImage name="stop-progress" />
                                        </ImageButton>
                                      </div>
                                      {collapsed.includes(step.key) ? null : (
                                        <div className="mac-automator-step-body">
                                          <Label
                                            render={<p />}
                                            textStyle="small"
                                            color="secondary"
                                            className="mac-automator-step-summary"
                                          >
                                            {action
                                              ? action.summary
                                              : "The desktop's library no longer has this action."}
                                          </Label>
                                          {params.length > 0 ? (
                                            <div className="mac-automator-settings">
                                              {params.map((param) => (
                                                <Setting
                                                  key={param.name}
                                                  id={field(`${step.key}-${param.name}`)}
                                                  param={param}
                                                  value={step.params[param.name]}
                                                  onChange={(value) =>
                                                    editStep(
                                                      step.key,
                                                      (current) => ({
                                                        ...current,
                                                        params: {
                                                          ...current.params,
                                                          [param.name]: value,
                                                        },
                                                      }),
                                                      choicesOf(param.kind) ||
                                                        typeof value !== "string"
                                                        ? null
                                                        : `${step.key}:${param.name}`,
                                                    )
                                                  }
                                                />
                                              ))}
                                            </div>
                                          ) : null}
                                          <div className="mac-automator-step-parts">
                                            <PushButton
                                              size="mini"
                                              aria-expanded={resultsOpen.includes(step.key)}
                                              onClick={() =>
                                                setResultsOpen((held) =>
                                                  withKeys(
                                                    held,
                                                    [step.key],
                                                    !held.includes(step.key),
                                                  ),
                                                )
                                              }
                                            >
                                              Results
                                            </PushButton>
                                            <PushButton
                                              size="mini"
                                              aria-expanded={optionsOpen.includes(step.key)}
                                              onClick={() =>
                                                setOptionsOpen((held) =>
                                                  withKeys(
                                                    held,
                                                    [step.key],
                                                    !held.includes(step.key),
                                                  ),
                                                )
                                              }
                                            >
                                              Options
                                            </PushButton>
                                          </div>
                                          {resultsOpen.includes(step.key) ? (
                                            <StepResults
                                              name={name}
                                              log={
                                                shown.results?.[step.key] ?? lastResults?.[step.key]
                                              }
                                            />
                                          ) : null}
                                          {optionsOpen.includes(step.key) ? (
                                            <div className="mac-automator-step-options">
                                              <Checkbox
                                                size="small"
                                                disabled={!takesInput(step)}
                                                checked={step.ignoreInput === true}
                                                onCheckedChange={(ignoreInput) =>
                                                  editStep(step.key, (current) => ({
                                                    ...current,
                                                    ignoreInput,
                                                  }))
                                                }
                                              >
                                                Ignore this action's input
                                              </Checkbox>
                                              <Checkbox
                                                size="small"
                                                disabled={params.length === 0}
                                                checked={step.showWhenRun === true}
                                                onCheckedChange={(showWhenRun) =>
                                                  editStep(step.key, (current) => ({
                                                    ...current,
                                                    showWhenRun,
                                                  }))
                                                }
                                              >
                                                Show this action when the workflow runs
                                              </Checkbox>
                                            </div>
                                          ) : null}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                  {feeds ? (
                                    <li className="mac-automator-link">
                                      <span
                                        role="img"
                                        aria-label={`${name} hands its output to ${stepName(following)}`}
                                        title={`${name} hands its output to ${stepName(following)}`}
                                        className="mac-automator-link-arrow"
                                      />
                                    </li>
                                  ) : null}
                                </Fragment>
                              );
                            })}
                          </ol>
                        </ScrollView>
                      )}
                    </section>
                  </ContextualMenuTrigger>
                  <ContextualMenuPopup aria-label="Step commands">
                    {menuRows.action}
                  </ContextualMenuPopup>
                </ContextualMenu>
              </SplitViewPane>
              {logShown ? (
                <>
                  <SplitViewDivider aria-label="Resize the log" />
                  <SplitViewPane
                    size={paneSizes.log ?? 147}
                    onSizeChange={paneSized("log")}
                    minSize={44}
                    maxSize={420}
                  >
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for a mouse drag; Add to Variables is the keyboard's way */}
                    <div
                      className="mac-automator-lower"
                      onDragOver={(event) => {
                        if (
                          lowerView === "variables" &&
                          event.dataTransfer.types.includes(VARIABLE_DRAG)
                        ) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={(event) => {
                        const name = event.dataTransfer.getData(VARIABLE_DRAG);
                        const row = VARIABLE_ROWS.find((entry) => entry.title === name);
                        if (lowerView === "variables" && row) {
                          event.preventDefault();
                          add([row]);
                        }
                      }}
                    >
                      {lowerView === "variables" ? (
                        <ContextualMenu>
                          <ContextualMenuTrigger
                            className="mac-automator-steps-area"
                            onContextMenu={(event) => {
                              const row = (event.target as HTMLElement).closest<HTMLElement>(
                                "[data-variable]",
                              );
                              setChosenVariable(row?.dataset.variable ?? null);
                            }}
                          >
                            <TableView
                              key="variables"
                              aria-label="Workflow variables"
                              className="mac-automator-list"
                              columns={VARIABLE_COLUMNS}
                              rowCount={ownVariables.length}
                              rowHeight={ROW_HEIGHT}
                              size="mini"
                              alternatingRows
                              getRowId={(row) => ownVariables[row]?.name ?? row}
                              getRowLabel={(row) => ownVariables[row]?.name ?? ""}
                              getRowProps={(row) => {
                                const entry = ownVariables[row];
                                return entry
                                  ? {
                                      draggable: true,
                                      "data-variable": entry.name,
                                      onDragStart: (event: DragEvent<HTMLDivElement>) => {
                                        event.dataTransfer.setData(VARIABLE_DRAG, entry.name);
                                        event.dataTransfer.effectAllowed = "copy";
                                      },
                                    }
                                  : undefined;
                              }}
                              value={chosenVariable ? [chosenVariable] : []}
                              onValueChange={(value) =>
                                setChosenVariable(typeof value[0] === "string" ? value[0] : null)
                              }
                              onRowAction={(row) => setEditingVariable(ownVariables[row] ?? null)}
                              renderCell={(row, column) => {
                                const entry = ownVariables[row];
                                if (!entry) return null;
                                return column.id === "name"
                                  ? entry.name
                                  : (readVariable(entry.name)?.join(", ") ?? "");
                              }}
                            />
                          </ContextualMenuTrigger>
                          <ContextualMenuPopup aria-label="Variable commands">
                            <MenuItem onClick={() => setEditingVariable({ name: "", value: "" })}>
                              New Variable…
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem
                              disabled={chosenVariable === null}
                              onClick={() =>
                                setEditingVariable(
                                  ownVariables.find((entry) => entry.name === chosenVariable) ??
                                    null,
                                )
                              }
                            >
                              Edit…
                            </MenuItem>
                            <MenuItem
                              disabled={chosenVariable === null}
                              onClick={() => {
                                setOwnVariables(
                                  ownVariables.filter((entry) => entry.name !== chosenVariable),
                                );
                                setChosenVariable(null);
                              }}
                            >
                              Delete
                            </MenuItem>
                          </ContextualMenuPopup>
                        </ContextualMenu>
                      ) : lowerView === "log" ? (
                        <TableView
                          key="log"
                          ref={logTable}
                          aria-label="Log"
                          className="mac-automator-list"
                          columns={LOG_COLUMNS}
                          rowCount={shown.rows.length}
                          rowHeight={ROW_HEIGHT}
                          size="mini"
                          alternatingRows
                          selectionMode="none"
                          getRowId={(row) => shown.rows[row]?.key ?? row}
                          renderCell={(row, column) => {
                            const entry = shown.rows[row];
                            if (!entry) return null;
                            if (column.id === "duration") return entry.duration;
                            return entry.failed ? (
                              <span className="mac-automator-log-failed">{entry.text}</span>
                            ) : (
                              entry.text
                            );
                          }}
                        />
                      ) : (
                        <TableView
                          key="runs"
                          aria-label="Runs"
                          className="mac-automator-list"
                          columns={RUN_COLUMNS}
                          rowCount={runs.length}
                          rowHeight={ROW_HEIGHT}
                          size="mini"
                          alternatingRows
                          getRowId={(row) => runs[row]?.id ?? row}
                          getRowLabel={(row) => {
                            const entry = runs[row];
                            return entry ? runText(entry) : "";
                          }}
                          onRowAction={(row) => showRun(runs[row])}
                          renderCell={(row, column) => {
                            const entry = runs[row];
                            if (!entry) return null;
                            if (column.id === "duration") return formatDuration(entry.ms);
                            const text = runText(entry);
                            return entry.ok ? (
                              text
                            ) : (
                              <span className="mac-automator-log-failed">{text}</span>
                            );
                          }}
                        />
                      )}
                    </div>
                  </SplitViewPane>
                </>
              ) : null}
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
                    aria-label="Runs"
                    aria-pressed={lowerView === "runs"}
                    className="mac-automator-bar-button"
                    style={barButton("0 5px 0 8.5px", lowerView === "runs")}
                    onClick={() => showLower("runs")}
                  >
                    <RunsGlyph />
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
      {asking ? (
        <PageQuestionSheet question={asking.question} anchor={titleBar} onAnswer={asking.answer} />
      ) : null}
      {showing ? (
        <ShowStepSheet
          key={showing.step.key}
          step={showing.step}
          name={stepName(showing.step)}
          action={actionsByName.get(showing.step.action)}
          id={ids}
          anchor={titleBar}
          onDone={showing.answer}
        />
      ) : null}
      {browsing ? (
        <VersionsSheet
          name={title}
          versions={browsing.versions}
          anchor={titleBar}
          onCancel={() => setBrowsing(null)}
          onRestore={(version) => {
            setBrowsing(null);
            setDraft(draftFromWorkflow({ ...version.workflow, id: draft.id }, nextKey));
            forgetStepEdits();
            setShown(NOTHING_SHOWN);
            setStatus(`Restored the version of ${startedText(version.savedMs)}. Save to keep it.`);
          }}
        />
      ) : null}
      {editingVariable ? (
        <VariableSheet
          variable={editingVariable}
          taken={ownVariables
            .map((entry) => entry.name)
            .filter((name) => name !== editingVariable.name)}
          anchor={titleBar}
          onCancel={() => setEditingVariable(null)}
          onDone={(next) => {
            setOwnVariables(
              editingVariable.name === ""
                ? [...ownVariables, next]
                : ownVariables.map((entry) => (entry.name === editingVariable.name ? next : entry)),
            );
            setEditingVariable(null);
          }}
        />
      ) : null}
      <NewDocumentSheet
        open={choosingType !== null}
        anchor={titleBar}
        current={choosingType === "convert" ? draft.kind : "workflow"}
        onCancel={() => setChoosingType(null)}
        onChoose={(kind) => {
          if (choosingType === "convert") edit({ kind });
          else switchTo(null, kind);
          setChoosingType(null);
        }}
      />
      <RenameStepSheet
        step={
          renamingStep ? { name: stepName(renamingStep), label: renamingStep.label ?? "" } : null
        }
        anchor={titleBar}
        onCancel={() => setRenaming(null)}
        onRename={(label) => {
          if (renaming !== null) {
            editStep(renaming, ({ label: _old, ...current }) =>
              label ? { ...current, label } : current,
            );
          }
          setRenaming(null);
        }}
      />
      <CustomizeToolbarSheet
        open={customizing}
        anchor={titleBar}
        hidden={toolbarHidden}
        order={toolbarOrder}
        onChange={setToolbarHidden}
        onOrderChange={setToolbarOrder}
        onDone={() => setCustomizing(false)}
      />
      {mediaOpen ? (
        <MediaBrowserSheet
          anchor={titleBar}
          onClose={() => setMediaOpen(false)}
          onAdd={(paths) => {
            setMediaOpen(false);
            addFinderItems(paths.join("\n"));
          }}
        />
      ) : null}
      <Sheet open={exporting} onOpenChange={setExporting}>
        <SheetPopup anchor={titleBar} width={440} aria-label="Export">
          <DriveSavePanel
            defaultName={fileNameOf(draft.name, draft.kind)}
            nameToSave={(typed) => workflowFileName(typed, draft.kind)}
            onSave={(target) => void exportWorkflow(target)}
            onCancel={() => setExporting(false)}
          />
        </SheetPopup>
      </Sheet>
      <Sheet open={moving} onOpenChange={setMoving}>
        <SheetPopup anchor={titleBar} width={440} aria-label="Move To">
          <DriveSavePanel
            defaultName={fileNameOf(draft.name, draft.kind)}
            nameToSave={(typed) => workflowFileName(typed, draft.kind)}
            onSave={(target) => void moveTo(target)}
            onCancel={() => setMoving(false)}
          />
        </SheetPopup>
      </Sheet>
      <Sheet
        open={askingCopy !== null}
        onOpenChange={(open) => {
          if (!open) setAskingCopy(null);
        }}
      >
        <SheetPopup anchor={titleBar} width={420}>
          <SheetTitle>
            The “{askingCopy?.title}” action will change the Finder items passed into it.
          </SheetTitle>
          <SheetDescription>
            Would you like to add a Copy Finder Items action so that copies are changed and your
            originals are preserved?
          </SheetDescription>
          <SheetActions>
            <SheetClose>Don’t Add</SheetClose>
            <DefaultButton
              onClick={() => {
                if (askingCopy) addCopyBefore(askingCopy.step);
                setAskingCopy(null);
              }}
            >
              Add
            </DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      <OpenWorkflowSheet
        open={openSheet}
        anchor={titleBar}
        workflows={saved}
        onCancel={() => setOpenSheet(false)}
        onOpen={(id) => {
          setOpenSheet(false);
          switchTo(id);
        }}
      />
      <Sheet open={askingDelete} onOpenChange={setAskingDelete}>
        <SheetPopup anchor={titleBar} width={420}>
          <SheetTitle>Delete the workflow “{title}”?</SheetTitle>
          <SheetDescription>This can’t be undone.</SheetDescription>
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <DefaultButton
              onClick={() => {
                setAskingDelete(false);
                void remove();
              }}
            >
              Delete
            </DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      <Sheet
        open={switching !== null}
        onOpenChange={(open) => {
          // The sheet stays while its Save is under way: the window behind it cannot change.
          if (!open && !busy) setSwitching(null);
        }}
      >
        <SheetPopup anchor={titleBar} width={420}>
          <SheetTitle>Do you want to save the changes you made to “{title}”?</SheetTitle>
          <SheetDescription>
            {switching?.failed
              ? "The workflow could not be saved; the status bar says why. "
              : null}
            {switching?.close
              ? "Closing the window discards them."
              : switching?.file
                ? `“${switching.file.name}” replaces it in the window.`
                : switching?.open === null
                  ? "A new workflow replaces it in the window."
                  : `“${saved.find((entry) => entry.id === switching?.open)?.name ?? ""}” replaces it in the window.`}{" "}
            Your changes are lost if you don’t save them.
          </SheetDescription>
          <SheetActions>
            <SheetClose disabled={busy}>Cancel</SheetClose>
            <PushButton
              disabled={busy}
              onClick={() => {
                const next = switching;
                setSwitching(null);
                if (next) finishSwitch(next);
              }}
            >
              Don’t Save
            </PushButton>
            <DefaultButton
              disabled={busy}
              onClick={async () => {
                const next = switching;
                if (!next) return;
                const after = await save();
                if (!after) {
                  if (mounted.current) setSwitching({ ...next, failed: true });
                  return;
                }
                if (!mounted.current) return;
                setSwitching(null);
                finishSwitch(next, after.library?.workflows ?? []);
              }}
            >
              Save
            </DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </Window>
  );
}

/**
 * Automator as the desktop shows it. When the `macalicious-desktop` Ferrite application serves
 * the desktop (`servedByDesktopApp()`), the library lists the desktop's real actions, Run runs
 * the workflow on the server and logs what each step did, and workflows are saved for the
 * person. Every other build shows
 * the invented library and the timed runs of `Automator`.
 */
export function DesktopAutomator(props: AutomatorProps) {
  return servedByDesktopApp() ? <ServedAutomator {...props} /> : <Automator {...props} />;
}
