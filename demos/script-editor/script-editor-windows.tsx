"use client";

import { ColumnView } from "macalicious/column-view";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { GradientButton } from "macalicious/gradient-button";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { MenuItem } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { TableView } from "macalicious/table-view";
import { TextView } from "macalicious/text-view";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { type DesktopSecondaryWindowProps, secondaryWindowId } from "../desktop/desktop-apps";
import { useDesktopDrop } from "../desktop/desktop-drag";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { copyText } from "../desktop/desktop-share-link";
import {
  clearHistory,
  type HistoryEntry,
  removeHistoryEntries,
  useLogHistory,
} from "./script-editor-history";
import type { ScriptAction, ScriptDictionary, ScriptEditorServer } from "./script-editor-server";
import { callOf } from "./script-editor-snippets";

/*
 * The windows Script Editor has one of however many scripts are open: the Library, each app's
 * Dictionary and the Log History. Which are open is kept here; the first script window open renders
 * them.
 */

const LIBRARY_REMOVED = "scriptEditor.libraryRemoved";
const APP = "script-editor";

interface OpenWindows {
  library: boolean;
  history: boolean;
  dictionaries: readonly string[];
  /** The window asked for last, and a count of asks: one already open comes to the front. */
  raise: string | null;
  asks: number;
}

const NONE_OPEN: OpenWindows = {
  library: false,
  history: false,
  dictionaries: [],
  raise: null,
  asks: 0,
};
let open = NONE_OPEN;
let hosts: readonly object[] = [];
const listeners = new Set<() => void>();

const changed = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const change = (next: Partial<OpenWindows>) => {
  open = { ...open, ...next };
  changed();
};
const ask = (raise: string) => ({ raise, asks: open.asks + 1 });

export const showLibraryWindow = (): void => change({ library: true, ...ask("library") });
export const showHistoryWindow = (): void => change({ history: true, ...ask("history") });
export const showDictionaryWindow = (app: string): void =>
  change({
    dictionaries: open.dictionaries.includes(app) ? open.dictionaries : [...open.dictionaries, app],
    ...ask(`dictionary-${app}`),
  });

const NAMES: Readonly<Record<string, string>> = {
  finder: "Finder",
  launchpad: "Launchpad",
  "system-preferences": "System Preferences",
  textedit: "TextEdit",
};

/** The name an app of the dictionary goes by. */
export const appName = (app: string): string =>
  NAMES[app] ?? app.replace(/^./, (first) => first.toUpperCase());

/** The apps the dictionary has actions for, by name. */
export const dictionaryApps = (dictionary: ScriptDictionary | null): readonly string[] =>
  [...new Set((dictionary?.actions ?? []).map((action) => action.app))].sort((a, b) =>
    appName(a).localeCompare(appName(b), "en"),
  );

/** The app a dragged item stands for: an item named as it is, with or without `.app`. */
export const appOfItem = (name: string, apps: readonly string[]): string | undefined =>
  apps.find((app) => appName(app).toLowerCase() === name.replace(/\.app$/i, "").toLowerCase());

const readRemoved = (stored: unknown): readonly string[] | undefined =>
  Array.isArray(stored) ? stored.filter((each) => typeof each === "string") : undefined;
const NOTHING_REMOVED: readonly string[] = [];

/** The frame's parts of a window of this file. */
function AuxWindow({
  title,
  className,
  children,
  footer,
  managed,
}: {
  title: string;
  className: string;
  children: ReactNode;
  footer?: ReactNode;
  managed: ManagedWindowRenderProps;
}) {
  const {
    onClose,
    onMinimize,
    onZoom,
    zoomRole,
    minimizeDisabled,
    zoomDisabled,
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
    ...windowProps
  } = managed;
  return (
    <Window aria-label={title} {...windowProps}>
      <TitleBar
        title={title}
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
      />
      <WindowBody className={`mac-script-editor-aux ${className}`}>{children}</WindowBody>
      {footer ? <div className="mac-script-editor-aux-footer">{footer}</div> : null}
    </Window>
  );
}

const NAME_COLUMN = [{ id: "name", title: "Name" }] as const;

/** Window > Library: the apps a script can tell; each opens its dictionary. */
function LibraryWindow({
  dictionary,
  error,
  managed,
}: {
  dictionary: ScriptDictionary | null;
  error: string | null;
  managed: ManagedWindowRenderProps;
}) {
  const removed = useDesktopValue(LIBRARY_REMOVED, readRemoved, NOTHING_REMOVED);
  const all = useMemo(() => dictionaryApps(dictionary), [dictionary]);
  const apps = all.filter((app) => !removed.includes(app));
  const hidden = all.filter((app) => removed.includes(app));
  const [selected, setSelected] = useState<readonly (string | number)[]>([]);
  const chosen = apps.filter((app) => selected.includes(app));
  const remove = () => {
    changeDesktopValue(LIBRARY_REMOVED, [...removed, ...chosen]);
    setSelected([]);
  };
  const restore = (app: string) =>
    changeDesktopValue(
      LIBRARY_REMOVED,
      removed.filter((each) => each !== app),
    );
  const opens = () => {
    for (const app of chosen) showDictionaryWindow(app);
  };
  const drop = useDesktopDrop<HTMLDivElement>({
    enabled: true,
    accepts: (item) => appOfItem(item.name, all) !== undefined,
    onDrop: (items) => {
      const added = items.flatMap((item) => appOfItem(item.name, all) ?? []);
      changeDesktopValue(
        LIBRARY_REMOVED,
        removed.filter((each) => !added.includes(each)),
      );
    },
    refusal: () => "The Library lists only the apps a script can tell on this desktop.",
  });
  return (
    <AuxWindow
      title="Library"
      className="mac-script-editor-library"
      managed={managed}
      footer={
        <>
          <GradientButton
            glyph="remove"
            aria-label="Remove from Library"
            disabled={chosen.length === 0}
            onClick={remove}
          />
          <PushButton size="small" disabled={chosen.length === 0} onClick={opens}>
            Open Dictionary
          </PushButton>
          {hidden.map((app) => (
            <PushButton key={app} size="small" onClick={() => restore(app)}>
              Add {appName(app)}
            </PushButton>
          ))}
        </>
      }
    >
      <div ref={drop} className="mac-script-editor-aux-list">
        {error ? (
          <p role="alert">The dictionary could not be read. {error}</p>
        ) : (
          <ContextualMenu>
            <ContextualMenuTrigger className="mac-script-editor-menu-area">
              <TableView
                aria-label="Applications"
                columns={NAME_COLUMN}
                rowCount={apps.length}
                selectionMode="multiple"
                value={selected}
                onValueChange={setSelected}
                getRowId={(row) => apps[row] as string}
                getRowLabel={(row) => appName(apps[row] as string)}
                renderCell={(row) => appName(apps[row] as string)}
                onRowAction={(row) => showDictionaryWindow(apps[row] as string)}
              />
            </ContextualMenuTrigger>
            <ContextualMenuPopup aria-label="Library commands">
              <MenuItem disabled={chosen.length === 0} onClick={opens}>
                Open
              </MenuItem>
              <MenuItem disabled={chosen.length === 0} onClick={remove}>
                Remove
              </MenuItem>
            </ContextualMenuPopup>
          </ContextualMenu>
        )}
      </div>
    </AuxWindow>
  );
}

/** One command as the dictionary's lower pane shows it. */
function ActionDetail({ action, globals }: { action: ScriptAction; globals: readonly string[] }) {
  const params = action.params.map((param) => param.name).join(", ");
  return (
    <div className="mac-script-editor-dictionary-detail">
      <h3 className="mac-script-editor-dictionary-call">
        {callOf(action, globals)}({params ? `{ ${params} }` : ""})
      </h3>
      <p>
        {action.title}
        {action.writes ? " (changes data)" : ""}: {action.summary}
      </p>
      {action.params.length > 0 ? (
        <dl>
          {action.params.map((param) => (
            <div key={param.name}>
              <dt>
                {param.name} ({param.kind}
                {param.required ? ", required" : ""})
              </dt>
              <dd>{param.summary}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** An app's dictionary: its commands in a browser, the one chosen below, and a search field. */
function DictionaryWindow({
  app,
  dictionary,
  managed,
}: {
  app: string;
  dictionary: ScriptDictionary | null;
  managed: ManagedWindowRenderProps;
}) {
  const [search, setSearch] = useState("");
  const [path, setPath] = useState<(string | number)[]>([app]);
  const asked = search.trim().toLowerCase();
  const actions = useMemo(
    () =>
      (dictionary?.actions ?? []).filter(
        (action) =>
          action.app === app &&
          (asked === "" ||
            `${action.name} ${action.title} ${action.summary}`.toLowerCase().includes(asked)),
      ),
    [dictionary, app, asked],
  );
  const children = useCallback(
    (parent: string | number | null) =>
      parent === null
        ? [{ id: app, label: `${appName(app)} Suite`, hasChildren: true }]
        : parent === app
          ? actions.map((action) => ({ id: action.name, label: action.title }))
          : null,
    [app, actions],
  );
  const action = actions.find((each) => each.name === path[1]);
  return (
    <AuxWindow
      title={`${appName(app)} Dictionary`}
      className="mac-script-editor-dictionary"
      managed={managed}
    >
      <div className="mac-script-editor-dictionary-bar">
        <SearchField
          aria-label="Search the dictionary"
          size="small"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </div>
      <ColumnView
        className="mac-script-editor-dictionary-browser"
        getChildren={children}
        path={path}
        onPathChange={setPath}
      />
      <div className="mac-script-editor-dictionary-pane">
        {action ? (
          <ActionDetail action={action} globals={dictionary?.globals ?? []} />
        ) : (
          <p className="mac-script-editor-dictionary-empty">
            {actions.length === 0 ? "No commands match." : "Choose a command to read about it."}
          </p>
        )}
      </div>
    </AuxWindow>
  );
}

const HISTORY_COLUMNS = [
  { id: "time", title: "Date", width: 150 },
  { id: "script", title: "Script", width: 150 },
  { id: "result", title: "Result" },
] as const;

const whenOf = (entry: HistoryEntry) =>
  new Date(entry.at).toLocaleString("en", { dateStyle: "short", timeStyle: "medium" });

/** An entry's text in the lower pane and on the clipboard. */
export const historyText = (entry: HistoryEntry): string =>
  [`${entry.script} (${entry.language})`, entry.result, ...entry.log].join("\n");

/** Window > Log History: each run's result and log, with several to copy or delete at once. */
function HistoryWindow({ managed }: { managed: ManagedWindowRenderProps }) {
  const entries = useLogHistory();
  const [selected, setSelected] = useState<readonly (string | number)[]>([]);
  const chosen = entries.filter((entry) => selected.includes(entry.id));
  return (
    <AuxWindow
      title="Log History"
      className="mac-script-editor-history"
      managed={managed}
      footer={
        <>
          <PushButton size="small" disabled={entries.length === 0} onClick={clearHistory}>
            Clear History
          </PushButton>
          <PushButton
            size="small"
            disabled={chosen.length === 0}
            onClick={() => {
              removeHistoryEntries(chosen.map((entry) => entry.id));
              setSelected([]);
            }}
          >
            Delete
          </PushButton>
          <PushButton
            size="small"
            disabled={chosen.length === 0}
            onClick={() => void copyText(chosen.map(historyText).join("\n\n"))}
          >
            Copy
          </PushButton>
        </>
      }
    >
      <div className="mac-script-editor-aux-list">
        <TableView
          aria-label="Runs"
          columns={HISTORY_COLUMNS}
          rowCount={entries.length}
          selectionMode="multiple"
          value={selected}
          onValueChange={setSelected}
          getRowId={(row) => (entries[row] as HistoryEntry).id}
          renderCell={(row, column) => {
            const entry = entries[row] as HistoryEntry;
            if (column.id === "time") return whenOf(entry);
            return column.id === "script" ? entry.script : entry.result;
          }}
        />
      </div>
      <div className="mac-script-editor-history-detail" data-appearance="light">
        <TextView
          aria-label="Selected runs"
          readOnly
          value={chosen.map(historyText).join("\n\n")}
        />
      </div>
    </AuxWindow>
  );
}

/**
 * The dictionary for `Open Dictionary…`, the Library and Edit > Complete, read once and again after
 * a read that failed.
 */
export function useScriptDictionary(server: ScriptEditorServer | undefined, wanted: boolean) {
  const [dictionary, setDictionary] = useState<ScriptDictionary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!server || !wanted || dictionary) return;
    let live = true;
    server.dictionary().then(
      (read) => {
        if (live) setDictionary(read);
      },
      (failure: unknown) => {
        if (live) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      live = false;
    };
  }, [server, wanted, dictionary]);
  return { dictionary, error };
}

/** The Library, the Dictionaries and the Log History, while this script window hosts them. */
export function ScriptEditorAuxWindows({
  server,
  DesktopWindow,
}: {
  server: ScriptEditorServer;
  DesktopWindow: ComponentType<DesktopSecondaryWindowProps>;
}) {
  const now = useSyncExternalStore(
    subscribe,
    () => open,
    () => NONE_OPEN,
  );
  const [owner] = useState(() => ({}));
  const host = useSyncExternalStore(
    subscribe,
    () => hosts[0],
    () => undefined,
  );
  useEffect(() => {
    hosts = [...hosts, owner];
    changed();
    return () => {
      hosts = hosts.filter((each) => each !== owner);
      // Quitting closes these windows with the last script window.
      if (hosts.length === 0) open = NONE_OPEN;
      changed();
    };
  }, [owner]);
  const store = useWindowManagerStore();
  const { raise, asks } = now;
  // biome-ignore lint/correctness/useExhaustiveDependencies: each ask raises, even of the same window
  useEffect(() => {
    if (raise && host === owner) store.focus(secondaryWindowId(APP, raise));
  }, [asks, store, host, owner]);
  const wanted = now.library || now.dictionaries.length > 0;
  const { dictionary, error } = useScriptDictionary(server, wanted);
  if (host !== owner) return null;
  return (
    <>
      {now.library ? (
        <DesktopWindow
          id="library"
          title="Library"
          defaultSize={{ width: 300, height: 380 }}
          minSize={{ width: 240, height: 200 }}
          onClose={() => change({ library: false })}
          render={(managed) => (
            <LibraryWindow dictionary={dictionary} error={error} managed={managed} />
          )}
        />
      ) : null}
      {now.dictionaries.map((app) => (
        <DesktopWindow
          key={app}
          id={`dictionary-${app}`}
          title={`${appName(app)} Dictionary`}
          defaultSize={{ width: 560, height: 460 }}
          minSize={{ width: 400, height: 300 }}
          onClose={() => change({ dictionaries: open.dictionaries.filter((each) => each !== app) })}
          render={(managed) => (
            <DictionaryWindow app={app} dictionary={dictionary} managed={managed} />
          )}
        />
      ))}
      {now.history ? (
        <DesktopWindow
          id="history"
          title="Log History"
          defaultSize={{ width: 560, height: 420 }}
          minSize={{ width: 380, height: 260 }}
          onClose={() => change({ history: false })}
          render={(managed) => <HistoryWindow managed={managed} />}
        />
      ) : null}
    </>
  );
}
