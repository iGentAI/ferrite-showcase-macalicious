"use client";

import { AccountHeader } from "macalicious/account-header";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { Menu, MenuPopup } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PreferencePaneIcon, PreferencePaneIconGrid } from "macalicious/preference-pane-icon";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField, type ToolbarSearchFieldProps } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { Fragment, use, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { requestHelp } from "../desktop/desktop-help";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { AccountPicture, PaneArtwork } from "./artwork";
import { ACCOUNT_PANES, CATALOGUE, type CatalogueEntry, GRID_BANDS } from "./catalogue";
import { EFFECTS_NOTE_HEIGHT, effectsNote } from "./effects";
import { createHistory, currentPane, historyReducer } from "./history";
import { GRID_HEIGHT, PreferencesContext, WINDOW_WIDTH } from "./pane";
import { peekPaneRequest, subscribePaneRequest, takePaneRequest } from "./pane-request";
import { PANES } from "./panes";
import { useServedAccount } from "./served-pages";
import { SettingsMap, useServerSettings } from "./storage";
import "./system-preferences.tokens.css";
import "./system-preferences.css";

/** The fields Edit acts on; a password field is not one. */
const TEXT_FIELD = "input[type=text], input[type=search], input:not([type]), textarea";

/** How long a press on Show All is held for it to list the panes. */
const PANE_MENU_HOLD_MS = 400;

/** Height of the unified title bar and toolbar. */
const CHROME_HEIGHT = 38;

/** Height of the window for a pane of the catalogue whose folder does not exist yet. */
const UNBUILT_HEIGHT = 300;

/** The setting that holds the pane the window last showed: it opens there again, as on a Mac. */
export const LAST_PANE = "window.pane";

/** The setting that holds the panes View > Customize… took off the grid. */
export const HIDDEN_PANES = "window.hiddenPanes";

/** Every pane by name, as the View menu lists them. */
const PANES_BY_NAME = [...CATALOGUE.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));

export interface SystemPreferencesProps extends Omit<WindowProps, "children" | "onClose"> {
  /**
   * The pane the window opens on: an id of the catalogue such as `"general"`, or `null` for
   * the grid of every pane.
   * @default null
   */
  defaultPane?: string | null;
  /** Called with the pane's id, or `null` for the grid, whenever the window shows another. */
  onPaneChange?: (pane: string | null) => void;
  /**
   * Called with the frame the window wants: once when it mounts, for the pane it opens on, and
   * whenever that frame changes, since every pane has its own height. A window manager that
   * sizes the window itself resizes it here.
   */
  onFrameSizeChange?: (size: { width: number; height: number }) => void;
  /**
   * Starting values of the panes' settings by key (`"general.appearance"`), for a window that
   * should open in a given state.
   */
  defaultSettings?: Readonly<Record<string, unknown>>;
  /**
   * The element whose appearance, accent colour and highlight colour the General pane sets.
   * Without it the General pane themes the whole page (the `<html>` element).
   */
  themeTarget?: HTMLElement;
  /** The name and the line under it in the account header. */
  account?: { name: string; detail: string };
  /** For the window controls: called when the close button is activated. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: called when the minimize button is activated. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: called when the zoom button is activated. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the zoom button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disable the minimize button, as in full screen. */
  minimizeDisabled?: boolean;
  /**
   * For the window controls: disable the zoom button. The window cannot be resized, so it is
   * disabled unless a host says otherwise.
   * @default true
   */
  zoomDisabled?: boolean;
  /** For the title bar: a pointer went down on its drag region. A window manager moves the window. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: its drag region was double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /** Further props for the window's `TitleBar`. */
  titleBarProps?: Omit<TitleBarProps, "variant" | "title" | "controls" | "children">;
  /** Further props for the `WindowControls`. */
  controlsProps?: WindowControlsProps;
  /** Props for the toolbar's search field. */
  searchFieldProps?: Omit<ToolbarSearchFieldProps, "value" | "onValueChange">;
}

function Chevron({ forward = false }: { forward?: boolean }) {
  return (
    <svg
      width="7"
      height="12"
      viewBox="0 0 7 12"
      aria-hidden="true"
      style={forward ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M6 0.5L0.75 6l5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function matches(item: CatalogueEntry, needle: string): boolean {
  return (
    item.name.toLowerCase().includes(needle) ||
    (PANES.get(item.id)?.keywords ?? []).some((word) => word.toLowerCase().includes(needle))
  );
}

function PaneButton({
  item,
  dimmed,
  onOpen,
  customizing,
  hidden,
  onHiddenChange,
}: {
  item: CatalogueEntry;
  dimmed: boolean;
  onOpen: (id: string) => void;
  customizing: boolean;
  hidden: boolean;
  onHiddenChange: (id: string, hidden: boolean) => void;
}) {
  if (hidden && !customizing) return null;
  const button = (
    <PreferencePaneIcon
      className="mac-system-preferences-pane-button"
      data-pane={item.id}
      data-dimmed={dimmed ? "" : undefined}
      // The caption breaks where Catalina breaks it; read as one line it is the pane's name.
      title={item.caption.join("\n")}
      disabled={customizing}
      onClick={() => onOpen(item.id)}
    >
      <PaneArtwork pane={item.id} />
    </PreferencePaneIcon>
  );
  if (!customizing) return button;
  return (
    <span className="mac-system-preferences-customize">
      {button}
      <Checkbox
        aria-label={`Show ${item.name}`}
        checked={!hidden}
        onCheckedChange={(on) => onHiddenChange(item.id, !on)}
      />
    </span>
  );
}

/**
 * The System Preferences window of macOS 10.15: a title-hidden toolbar window that shows a
 * grid of panes, opens one at a time, keeps a history for Back and Forward, searches the panes
 * and takes the height of the pane it shows.
 *
 * Its root is the library's `Window` and takes every `Window` prop, so a page places it with
 * `style`. A window manager passes `state`, the size, the window controls' callbacks and
 * states (`onClose`, `onMinimize`, `onZoom`, `zoomRole`, `minimizeDisabled`, `zoomDisabled`)
 * and the title bar's drag callbacks (`onDragRegionPointerDown`, `onDragRegionDoubleClick`):
 * these eight are taken out and handed to the `WindowControls` and the `TitleBar`, and the
 * rest goes to the `Window`.
 */
export function SystemPreferences({
  defaultPane = null,
  onPaneChange,
  onFrameSizeChange,
  defaultSettings,
  themeTarget,
  account = { name: "Alex Morgan", detail: "Apple ID, iCloud" },
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled = true,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  titleBarProps,
  controlsProps,
  searchFieldProps,
  className,
  width,
  height,
  ...windowProps
}: SystemPreferencesProps) {
  // A pane asked for from outside the window (a status menu's "Open … Preferences…"): the window opens on it, and an open
  // window goes to it as a click on its icon would. The request is only read here; the effect below takes it.
  const [history, dispatch] = useReducer(historyReducer, defaultPane, (pane) =>
    createHistory(peekPaneRequest() ?? pane),
  );
  const [query, setQuery] = useState("");
  useEffect(() => {
    const take = () => {
      const id = takePaneRequest();
      if (id !== null) {
        setQuery("");
        dispatch({ type: "show", pane: id });
      }
    };
    take();
    return subscribePaneRequest(take);
  }, []);
  const [values] = useState(() => new SettingsMap(Object.entries(defaultSettings ?? {})));
  // On a desktop served by the Ferrite application the settings and the page's theme are kept
  // in the browser's session there.
  const loading = useServerSettings(values);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  // Show All held, or its context menu: the panes by name.
  const [showAllButton, setShowAllButton] = useState<HTMLElement | null>(null);
  const [paneMenuOpen, setPaneMenuOpen] = useState(false);
  const paneMenuHeld = useRef(false);
  const paneMenuTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const launch = use(DesktopWindowHostContext)?.launch;
  const servedAccount = useServedAccount();

  const paneId = currentPane(history);

  // On a served desktop the window opens on the pane it last showed, unless it was asked for
  // another; from then on the pane shown is kept with the person's settings.
  const settled = useRef(false);
  const kept = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !servedByDesktopApp()) return;
    if (!settled.current) {
      settled.current = true;
      const saved = values.get(LAST_PANE);
      const savedPane = typeof saved === "string" && CATALOGUE.has(saved) ? saved : null;
      if (paneId === null && savedPane !== null) {
        kept.current = savedPane;
        dispatch({ type: "restore", pane: savedPane });
        return;
      }
      // A pane asked for from outside the window is shown, so it is the last shown; the pane a
      // host opens the window on is the host's, not the person's.
      kept.current = paneId === defaultPane ? paneId : savedPane;
    }
    if (kept.current === paneId) return;
    kept.current = paneId;
    values.set(LAST_PANE, paneId);
  }, [loading, paneId, values, defaultPane]);
  const given = paneId === null ? undefined : PANES.get(paneId);
  const page = servedByDesktopApp() ? given?.served : undefined;
  const pane = page ? { ...given, ...page } : given;
  const title =
    paneId === null ? "System Preferences" : (pane?.title ?? CATALOGUE.get(paneId)?.name ?? paneId);
  const paneHeight = paneId === null ? GRID_HEIGHT : (pane?.height ?? UNBUILT_HEIGHT);
  // On a served desktop every setting is kept for the account, but the desktop acts on only a
  // few: a note under the pane says which (`effects.ts`), and the window grows to show it. A
  // served page has no settings, so it has no note.
  const note =
    paneId !== null && pane && !page && servedByDesktopApp() ? effectsNote(paneId) : null;
  const frameHeight = paneHeight + (note ? EFFECTS_NOTE_HEIGHT : 0);

  const needle = query.trim().toLowerCase();
  const [suggested, setSuggested] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new search starts at its first match
  useEffect(() => setSuggested(0), [needle]);
  const [customizing, setCustomizing] = useState(false);
  const [hiddenPanes, setHiddenPanes] = useState<readonly string[]>([]);
  // The panes the person hid, kept with their settings.
  useEffect(() => {
    if (loading) return;
    const stored = values.get(HIDDEN_PANES);
    setHiddenPanes(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : []);
  }, [loading, values]);
  const setPaneHidden = (id: string, hidden: boolean) => {
    const next = hidden ? [...hiddenPanes, id] : hiddenPanes.filter((other) => other !== id);
    setHiddenPanes(next);
    values.set(HIDDEN_PANES, next);
  };
  const found = useMemo(
    () => (needle ? [...CATALOGUE.values()].filter((item) => matches(item, needle)) : []),
    [needle],
  );

  const context = useMemo(
    () => ({
      values,
      themeTarget,
      showPane: (id: string | null) => dispatch({ type: "show", pane: id }),
    }),
    [values, themeTarget],
  );

  // What the effect below reads when the pane changes; the callbacks may be new every render.
  const latest = useRef({ onPaneChange, onFrameSizeChange });
  useEffect(() => {
    latest.current = { onPaneChange, onFrameSizeChange };
  });

  // The frame the window wants, told to a host that sizes it: for the pane it opens on, too.
  useEffect(() => {
    latest.current.onFrameSizeChange?.({ width: WINDOW_WIDTH, height: frameHeight });
  }, [frameHeight]);

  const shown = useRef(paneId);
  useEffect(() => {
    if (shown.current === paneId) return;
    shown.current = paneId;
    latest.current.onPaneChange?.(paneId);
    // The control that was activated may be gone: a grid icon, or a button of the pane that
    // was left. Then the keyboard focus goes to what replaced it. (Toolbar items stay
    // focusable while disabled, so Back and Forward keep the focus.)
    const active = document.activeElement;
    if (active === null || active === document.body) {
      contentRef.current?.focus({ preventScroll: true });
    }
  }, [paneId]);

  const open = (id: string) => {
    setQuery("");
    dispatch({ type: "show", pane: id });
  };

  const canGoBack = history.index > 0;
  const canGoForward = history.index < history.entries.length - 1;
  const showAll = () => {
    setQuery("");
    dispatch({ type: "show", pane: null });
  };
  const search = () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  };
  const customize = () => {
    setQuery("");
    dispatch({ type: "show", pane: null });
    setCustomizing(true);
  };
  const commands = useRef({ open, showAll, search, customize });
  commands.current = { open, showAll, search, customize };
  // The menu bar's View menu and its keys: while the window is key, the keys work wherever the
  // focus is, as a Mac's menu bar does.
  const isKey = windowProps.state === "key";
  useEffect(() => {
    if (!isKey || loading) return;
    return onMenuKeyEquivalents(window, {
      "command+[": () => dispatch({ type: "back" }),
      "command+]": () => dispatch({ type: "forward" }),
      "command+l": () => commands.current.showAll(),
      "command+f": () => commands.current.search(),
    });
  }, [isKey, loading]);
  const viewMenu = useMemo(
    () => (
      <>
        <MenuItem
          keyEquivalent="command+["
          disabled={!canGoBack}
          onClick={() => dispatch({ type: "back" })}
        >
          Back
        </MenuItem>
        <MenuItem
          keyEquivalent="command+]"
          disabled={!canGoForward}
          onClick={() => dispatch({ type: "forward" })}
        >
          Forward
        </MenuItem>
        <MenuItem keyEquivalent="command+l" onClick={() => commands.current.showAll()}>
          Show All Preferences
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => commands.current.customize()}>Customize…</MenuItem>
        <MenuItem
          keyEquivalent="command+f"
          // The menu holds the keyboard until it has faded out (`menu.css`: 0.25 s after a choice).
          onClick={() => setTimeout(() => commands.current.search(), 300)}
        >
          Search
        </MenuItem>
        <MenuSeparator />
        {PANES_BY_NAME.map((item) => (
          <MenuItem key={item.id} onClick={() => commands.current.open(item.id)}>
            {item.name}
          </MenuItem>
        ))}
      </>
    ),
    [canGoBack, canGoForward],
  );
  useDesktopAppMenu("system-preferences", "View", viewMenu, titleBar);
  // Edit acts on the text field that had the keyboard last: the search field, or a pane's. A menu takes
  // the keyboard while it is open, so the field is read when a row is chosen, and its passwords never.
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [hasField, setHasField] = useState(false);
  useEffect(() => {
    const inWindow = titleBar?.parentElement;
    if (!inWindow) return;
    const onFocus = (event: FocusEvent) => {
      const target = event.target as Element;
      if (target.matches(TEXT_FIELD)) {
        lastField.current = target as HTMLInputElement | HTMLTextAreaElement;
        setHasField(true);
      }
    };
    inWindow.addEventListener("focusin", onFocus);
    return () => inWindow.removeEventListener("focusin", onFocus);
  }, [titleBar]);
  const editMenu = useMemo(() => {
    type Field = HTMLInputElement | HTMLTextAreaElement;
    // Still the field the row was chosen for, and still one that may be read: its type can change.
    const still = (field: Field | null): field is Field =>
      field !== null &&
      field === lastField.current &&
      field.isConnected &&
      field.matches(TEXT_FIELD);
    const inField = (work: (field: Field) => void, target: Field | null = lastField.current) =>
      // The menu holds the keyboard until it has faded out (`menu.css`: 0.25 s after a choice).
      setTimeout(() => {
        if (!still(target)) return;
        target.focus();
        work(target);
      }, 300);
    const chosen = (field: Field) =>
      field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
    const reason = hasField ? undefined : "Click in a text field first";
    const row = (name: string, keyEquivalent: string | undefined, run: () => void) => (
      <MenuItem
        disabled={!hasField}
        title={reason}
        data-reason={reason}
        keyEquivalent={keyEquivalent}
        onClick={run}
      >
        {name}
      </MenuItem>
    );
    return (
      <>
        {row("Undo", "command+z", () => inField(() => document.execCommand("undo")))}
        {row("Redo", "shift+command+z", () => inField(() => document.execCommand("redo")))}
        <MenuSeparator />
        {row("Cut", "command+x", () =>
          inField((field) => {
            const words = chosen(field);
            if (!words) return;
            const start = field.selectionStart ?? 0;
            const end = field.selectionEnd ?? 0;
            // The words go only once they are on the clipboard, and only if the field still holds them.
            void copyText(words).then((copied) => {
              if (!copied || !still(field) || field.value.slice(start, end) !== words) return;
              field.focus();
              field.setSelectionRange(start, end);
              document.execCommand("delete");
            });
          }),
        )}
        {row("Copy", "command+c", () =>
          inField((field) => {
            const words = chosen(field);
            if (words) void copyText(words);
          }),
        )}
        {row("Paste", "command+v", () => {
          const target = lastField.current;
          void navigator.clipboard
            ?.readText()
            .then((text) => inField(() => document.execCommand("insertText", false, text), target))
            .catch(() => {});
        })}
        {row("Delete", undefined, () => inField(() => document.execCommand("delete")))}
        {row("Select All", "command+a", () => inField((field) => field.select()))}
      </>
    );
  }, [hasField]);
  useDesktopAppMenu("system-preferences", "Edit", editMenu, titleBar);
  const helpMenu = useMemo(
    () =>
      launch ? (
        <MenuItem onClick={() => requestHelp("System Preferences")}>
          System Preferences Help
        </MenuItem>
      ) : null,
    [launch],
  );
  useDesktopAppMenu("system-preferences", "Help", helpMenu, titleBar);

  return (
    <Window
      width={width ?? WINDOW_WIDTH}
      height={height ?? frameHeight}
      className={cn("mac-system-preferences", className)}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        {...titleBarProps}
        variant="title-hidden"
        title={title}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
            {...controlsProps}
          />
        }
      >
        <Toolbar aria-label="System Preferences toolbar" inert={loading || undefined}>
          <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="History">
            <ToolbarSegment
              aria-label="Back"
              disabled={history.index === 0}
              style={{ width: 27, padding: 0 }}
              onClick={() => dispatch({ type: "back" })}
            >
              <Chevron />
            </ToolbarSegment>
            <ToolbarSegment
              aria-label="Forward"
              disabled={history.index === history.entries.length - 1}
              style={{ width: 27, padding: 0 }}
              onClick={() => dispatch({ type: "forward" })}
            >
              <Chevron forward />
            </ToolbarSegment>
          </ToolbarSegmentedControl>
          <ToolbarButton
            ref={setShowAllButton}
            aria-label="Show All"
            style={{ width: 38 }}
            onPointerDown={() => {
              paneMenuHeld.current = false;
              paneMenuTimer.current = setTimeout(() => {
                paneMenuHeld.current = true;
                setPaneMenuOpen(true);
              }, PANE_MENU_HOLD_MS);
            }}
            onPointerUp={() => clearTimeout(paneMenuTimer.current)}
            onPointerLeave={() => clearTimeout(paneMenuTimer.current)}
            onContextMenu={(event) => {
              event.preventDefault();
              setPaneMenuOpen(true);
            }}
            onClick={() => {
              if (!paneMenuHeld.current) showAll();
              paneMenuHeld.current = false;
            }}
          >
            <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
              <path
                d="M0 1h2M4 1h2M8 1h2M12 1h2M0 5h2M4 5h2M8 5h2M12 5h2M0 9h2M4 9h2M8 9h2M12 9h2"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </ToolbarButton>
          <Menu open={paneMenuOpen} onOpenChange={setPaneMenuOpen}>
            <MenuPopup
              anchor={showAllButton}
              sideOffset={4}
              style={{ maxHeight: 420, overflowY: "auto" }}
            >
              {PANES_BY_NAME.map((item) => (
                <MenuItem key={item.id} onClick={() => open(item.id)}>
                  {item.name}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
          <ToolbarSpace />
          <ToolbarSearchField
            {...searchFieldProps}
            inputRef={searchRef}
            value={query}
            onValueChange={(value) => {
              setQuery(value);
              // Searching from inside a pane goes back to the grid, where the matches show.
              if (value.trim()) dispatch({ type: "show", pane: null });
            }}
            onKeyDown={(event) => {
              searchFieldProps?.onKeyDown?.(event);
              if (event.defaultPrevented) return;
              if (found.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : found.length - 1;
                setSuggested((at) => (at + step) % found.length);
              }
              const chosen = found[suggested] ?? found[0];
              if (event.key === "Enter" && chosen) open(chosen.id);
              if (event.key === "Escape") setQuery("");
            }}
          />
          {customizing ? <PushButton onClick={() => setCustomizing(false)}>Done</PushButton> : null}
        </Toolbar>
      </TitleBar>
      <WindowBody
        className="mac-system-preferences-body"
        inert={loading || undefined}
        aria-busy={loading || undefined}
      >
        {/* On a desktop served by the Ferrite application the content is drawn again once the
            saved settings have loaded, so a pane that was already open (defaultPane) starts
            from them; until then it is inert, so nothing is lost. */}
        <PreferencesContext key={loading ? "loading" : "ready"} value={context}>
          {paneId === null ? (
            // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring form semantics; this is a named group of buttons.
            <div
              ref={contentRef}
              role="group"
              aria-label="All preferences"
              tabIndex={-1}
              className="mac-system-preferences-grid"
            >
              <AccountHeader
                name={servedByDesktopApp() ? (servedAccount?.fullName ?? "") : account.name}
                subtitle={servedByDesktopApp() ? "Account of this desktop" : account.detail}
                avatar={<AccountPicture />}
              >
                {ACCOUNT_PANES.map((item) => (
                  <PaneButton
                    key={item.id}
                    item={item}
                    customizing={customizing}
                    hidden={hiddenPanes.includes(item.id)}
                    onHiddenChange={setPaneHidden}
                    dimmed={needle !== "" && !found.includes(item)}
                    onOpen={open}
                  />
                ))}
              </AccountHeader>
              {GRID_BANDS.map((band, index) => (
                <Fragment key={band[0]?.id}>
                  {index > 0 ? <Separator aria-hidden="true" /> : null}
                  <PreferencePaneIconGrid
                    className="mac-system-preferences-band"
                    data-band={index === 0 ? "upper" : "lower"}
                  >
                    {band.map((item) => (
                      <PaneButton
                        key={item.id}
                        item={item}
                        customizing={customizing}
                        hidden={hiddenPanes.includes(item.id)}
                        onHiddenChange={setPaneHidden}
                        dimmed={needle !== "" && !found.includes(item)}
                        onOpen={open}
                      />
                    ))}
                  </PreferencePaneIconGrid>
                </Fragment>
              ))}
            </div>
          ) : (
            <>
              {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring form semantics; this is the named content of the pane. */}
              <div
                ref={contentRef}
                key={paneId}
                role="group"
                aria-label={title}
                tabIndex={-1}
                data-pane={paneId}
                className="mac-system-preferences-pane"
                style={{ height: paneHeight - CHROME_HEIGHT }}
              >
                {pane?.component ? (
                  <pane.component />
                ) : (
                  <EmptyState>The {title} pane is not part of this demo yet.</EmptyState>
                )}
              </div>
              {note ? (
                <Label
                  render={<p />}
                  role="note"
                  textStyle="small"
                  color="secondary"
                  className="mac-system-preferences-effects"
                  style={{ height: EFFECTS_NOTE_HEIGHT }}
                >
                  {note}
                </Label>
              ) : null}
            </>
          )}
          {found.length > 0 ? (
            <ul aria-label="Matching panes" className="mac-system-preferences-suggestions">
              {found.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-selected={index === suggested ? "" : undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => open(item.id)}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <span role="status" className="mac-system-preferences-status">
            {needle === ""
              ? ""
              : found.length === 1
                ? "1 pane matches"
                : `${found.length} panes match`}
          </span>
        </PreferencesContext>
      </WindowBody>
    </Window>
  );
}
