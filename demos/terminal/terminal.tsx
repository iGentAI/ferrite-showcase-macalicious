"use client";

import { ColorPanel } from "macalicious/color-panel";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";
import {
  type ComponentType,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { registerAppQuit } from "../desktop/desktop-app-quit";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { secondaryWindowId } from "../desktop/desktop-apps";
import type { DesktopDrag } from "../desktop/desktop-drag";
import { beginDesktopDrag, registerDropTarget } from "../desktop/desktop-drag";
import { driveAvailable, readFile } from "../desktop/desktop-files";
import { requestHelp } from "../desktop/desktop-help";
import { readKeptText } from "../desktop/desktop-kept-text";
import { useKeptText } from "../desktop/desktop-kept-value";
import { linkAddress, openUrl } from "../desktop/desktop-open-url";
import { desktopValues } from "../desktop/desktop-personal";
import { takeOwnWindows } from "../desktop/desktop-restore";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { tabsPreferred } from "../desktop/desktop-tabs";
import { lookUp } from "../dictionary/dictionary-desktop";
import {
  type OpenFileRequest,
  onOpenFileRequest,
  takeOpenFileRequests,
} from "../finder/finder-open";
import { webAddressFor } from "../safari/safari-web";
import { CLOSE_WINDOWS_KEY } from "../system-preferences/panes/general/document-settings";
import { printDocument } from "../textedit/textedit-drive";
import { type PendingClose, SearchManSheet, TerminateSheet } from "./terminal-close";
import { baseName } from "./terminal-files";
import { MIN_FRAME } from "./terminal-frame";
import { type InspectorPane, TerminalInspector } from "./terminal-inspector";
import { matchesTerminalCommand } from "./terminal-keys";
import {
  ExportFileSheet,
  ImportProfilePanel,
  NewCommandSheet,
  NO_DRIVE_REASON,
  SaveGroupSheet,
  shownColour,
  TerminalPreferences,
} from "./terminal-preferences";
import {
  addProfile,
  changeProfile,
  DEFAULT_SETTINGS,
  frameOfProfile,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  profileFromFile,
  profileNamed,
  profileNames,
  profileStyle,
  profileToFile,
  readSettings,
  type TerminalProfile,
  type TerminalSettings,
  type WindowGroup,
} from "./terminal-profiles";
import { pastedBytes, TerminalScreen, type TerminalScreenHandle } from "./terminal-screen";
import { escapeForShell, TerminalSession } from "./terminal-shell";
import {
  keepHistory,
  keepSession,
  linesOfSession,
  restoreLines,
  type SavedSession,
  type SavedTab,
  SETTINGS_KEY,
  savedHistory,
  savedSession,
  shellPathOfItem,
} from "./terminal-window-state";
import "./terminal.tokens.css";
import "./terminal.css";

/** How long after a change the session is kept, in milliseconds: a burst of output is one save. */
const SAVE_PAUSE_MS = 1500;

export interface TerminalProps extends Omit<WindowProps, "children"> {
  /** Called when the last window closes: a window manager's close command. */
  onClose?: () => void;
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /** Given by a desktop page: further windows open as windows of the desktop. */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  /** Starts the first tab in this folder rather than the home folder. */
  initialDirectory?: string;
  /** Given by a desktop page: whether the Preferences window is open. */
  preferencesOpen?: boolean;
  /** Given by a desktop page: called when the Preferences window closes. */
  onPreferencesOpenChange?: (open: boolean) => void;
}

interface TerminalTab {
  id: number;
  session: TerminalSession;
  split: boolean;
  /** The profile the tab was given. */
  profile: string;
  /** What the tab changed of it: a font size, a colour. */
  changes: Partial<TerminalProfile>;
  /** The title the person gave it, from the Inspector. */
  title: string;
}

interface TerminalWindowState {
  id: number;
  tabs: TerminalTab[];
  active: number;
  /** Where a window brought back after quitting goes. */
  frame?: { x: number; y: number; width: number; height: number };
}

let nextId = 1;
const freshId = () => {
  nextId += 1;
  return nextId;
};

const shownProfile = (settings: TerminalSettings, tab: TerminalTab): TerminalProfile => ({
  ...profileNamed(settings, tab.profile),
  ...tab.changes,
});

/** The title of a window: the folder or the program's title, what runs, and the size. */
function titleOf(session: TerminalSession, profile: TerminalProfile, given: string): string {
  const { emulator, scope } = session;
  const place =
    given ||
    emulator.title ||
    profile.windowTitle ||
    (profile.showDirectory ? baseName(scope.cwd) || "/" : "");
  const parts = [
    place,
    profile.showProcess ? session.processName : "",
    profile.showSize ? `${emulator.cols}×${emulator.rows}` : "",
  ];
  return parts.filter((part) => part !== "").join(" — ") || "Terminal";
}

function useTitle(session: TerminalSession, profile: TerminalProfile, given: string): string {
  const subscribe = useCallback((listener: () => void) => session.subscribe(listener), [session]);
  const read = () => titleOf(session, profile, given);
  return useSyncExternalStore(subscribe, read, read);
}

function FolderGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M1.5 4A1 1 0 0 1 2.5 3H6l1.5 1.5h6a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The proxy icon: the working folder, in the title. A press that moves drags the folder itself, as
 * from Finder, when it is on the drive; the folders above it are not, and do not drag.
 */
function ProxyIcon({ session }: { session: TerminalSession }) {
  const folder = useRef<string | undefined>(undefined);
  const look = () => {
    void session.files
      .at(session.scope.cwd)
      .then((node) => {
        folder.current = node?.children ? node.id : undefined;
      })
      .catch(() => {
        folder.current = undefined;
      });
  };
  return (
    <span
      className="mac-terminal-proxy"
      data-path={session.scope.cwd}
      onPointerEnter={look}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.ctrlKey) return;
        event.stopPropagation();
        beginDesktopDrag(event.nativeEvent, {
          from: "terminal",
          icon: event.currentTarget.firstElementChild,
          items: () =>
            folder.current
              ? [{ id: folder.current, name: baseName(session.scope.cwd), kind: "folder" as const }]
              : [],
        });
      }}
    >
      <FolderGlyph />
    </span>
  );
}

/** The commands of a window, for its menus and its keys alike. */
interface WindowCommand {
  key?: string;
  enabled?: boolean;
  run: () => void;
}

function Reason({ id, children }: { id: string; children: ReactNode }) {
  return (
    <MenuItem disabled id={id} className="mac-desktop-shell-menu-reason">
      {children}
    </MenuItem>
  );
}

/** How far a press on a tab moves before it is a drag of the tab. */
const TAB_DRAG_POINTS = 6;

const canReadClipboard = () =>
  typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

const NO_TAB_OVERVIEW = "Terminal's tab bar shows its tabs; this desktop has no overview of them.";
const NO_ALTERNATE_PEEK =
  "Only a running program uses the alternate screen here, and it is on show while the program runs.";

/** A command as a menu item; a dimmed one gives `extra.reason` as its tooltip. */
function item(label: string, command: WindowCommand, extra: { reason?: string } = {}): ReactNode {
  return (
    <MenuItem
      keyEquivalent={command.key}
      disabled={command.enabled === false}
      title={command.enabled === false ? extra.reason : undefined}
      onClick={command.run}
    >
      {label}
    </MenuItem>
  );
}

const REMOTE_REASON = "This page cannot reach other computers";
const SECURE_REASON = "A page cannot keep its keys from the browser";
const EDIT_REASON = "Use the shell's Control keys instead";
const NO_MAN_SELECTION_REASON = "Select a word to search the manual for";
const NO_MOUSE_REPORTING = "No program in this shell reads the mouse, so nothing would hear it.";

/** A command to run in a new window: a program, or a line inside a shell that goes on after it. */
interface NewCommand {
  command: string;
  inShell: boolean;
  profile?: string;
  changes?: Partial<TerminalProfile>;
}

/** A window's whole set of actions on its tabs and on the application's other windows. */
interface WindowActions {
  /** Whether further windows can open: a desktop page gave the means. */
  canOpenWindows: boolean;
  windowCount: number;
  settings: TerminalSettings;
  newWindow: () => void;
  newTab: () => void;
  closeTab: (id: number) => void;
  closeOtherTabs: (id: number) => void;
  closeWindow: () => void;
  selectTab: (id: number) => void;
  setSplit: (id: number, split: boolean) => void;
  changeTab: (id: number, change: Partial<TerminalTab>) => void;
  moveTabToNewWindow: (id?: number) => void;
  /** The tab goes to another of this application's windows, and its window closes if it was the last. */
  moveTabToWindow: (id: number, windowId: number) => void;
  mergeAll: () => void;
  returnToDefaultSize: () => void;
  runCommand: (command: NewCommand) => void;
  openInspector: (pane: InspectorPane, focusTitle?: boolean) => void;
  openColorPanel: () => void;
  makeDefault: () => void;
  importProfile: (profile: Partial<TerminalProfile>) => void;
  saveGroup: (name: string) => void;
  openGroup: (group: WindowGroup) => void;
  noteKey: () => void;
}

/** What a window has open over it, one at a time. */
type WindowSheet =
  | "new-command"
  | "import"
  | "export-text"
  | "export-settings"
  | "save-group"
  | "search-man"
  | null;

interface WindowViewProps extends Omit<WindowProps, "children"> {
  model: TerminalWindowState;
  actions: WindowActions;
  onClose?: () => void;
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

function TerminalWindowView({
  model,
  actions,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  className,
  onKeyDown,
  onFocus,
  style,
  ...windowProps
}: WindowViewProps) {
  const tab = model.tabs.find((each) => each.id === model.active) ?? (model.tabs[0] as TerminalTab);
  const { session } = tab;
  const { settings } = actions;
  const profile = shownProfile(settings, tab);
  const { fontSize, optionAsMeta } = profile;
  const title = useTitle(session, profile, tab.title);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState<PendingClose | null>(null);
  /** Runs `close`, or asks first when a profile says so of `tabs`. */
  const closeAsking = useRef<
    (tabs: readonly TerminalTab[], what: PendingClose["what"], close: () => void) => void
  >(() => {});
  closeAsking.current = (tabs, what, close) => {
    const asks = tabs.some((each) => {
      const { askBeforeClosing } = shownProfile(actions.settings, each);
      return askBeforeClosing === "always" || (askBeforeClosing === "running" && each.session.busy);
    });
    if (!asks) close();
    else {
      const running = tabs.flatMap((each) => (each.session.busy ? [each.session.processName] : []));
      setClosing({ what, running, close });
    }
  };
  const searchManual = (word: string) =>
    actions.runCommand({
      command: `man -k ${escapeForShell(word)}`,
      inShell: true,
      profile: "Man Page",
    });
  /** A tab dragged out of the bar: to another Terminal window's bar, or a window of its own. */
  const startTabDrag = (down: PointerEvent<HTMLElement>) => {
    const pressed = (down.target as Element)
      .closest("[data-terminal-tab]")
      ?.getAttribute("data-terminal-tab");
    if (down.button !== 0 || !pressed) return;
    const bar = down.currentTarget;
    const { clientX: startX, clientY: startY } = down;
    let moved = false;
    const move = (event: globalThis.PointerEvent) => {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > TAB_DRAG_POINTS)
        moved = true;
    };
    const up = (event: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) return;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (hit && bar.contains(hit)) return;
      const other = hit?.closest<HTMLElement>("[data-terminal-window]");
      if (!other) {
        actions.moveTabToNewWindow(Number(pressed));
      } else if (!hit?.closest(".mac-terminal-body")) {
        actions.moveTabToWindow(Number(pressed), Number(other.dataset.terminalWindow));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const reasonId = useId();
  const top = useRef<TerminalScreenHandle>(null);
  const bottom = useRef<TerminalScreenHandle>(null);
  const [activePane, setActivePane] = useState<"top" | "bottom">("bottom");
  const [splitAt, setSplitAt] = useState(0.5);
  const [showMarks, setShowMarks] = useState(false);
  const [tabBarWanted, setTabBarWanted] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [findMissing, setFindMissing] = useState(false);
  const [pasteRefused, setPasteRefused] = useState(false);
  const [sheet, setSheet] = useState<WindowSheet>(null);
  const [contextText, setContextText] = useState("");
  const [contextTab, setContextTab] = useState<number | null>(null);
  const findField = useRef<HTMLInputElement>(null);

  const showTabBar = tabBarWanted || model.tabs.length > 1;

  const screen = useCallback(
    () => (tab.split && activePane === "top" ? top.current : bottom.current),
    [activePane, tab.split],
  );
  const focusScreen = useCallback(() => {
    screen()?.focus();
  }, [screen]);

  // The profile's cursor is the terminal's until a program asks for another, as Reset puts it back.
  useEffect(() => {
    session.emulator.cursorShape = profile.cursorShape;
    session.emulator.cursorBlink = profile.cursorBlink;
    session.emulator.onChange();
  }, [session, profile.cursorShape, profile.cursorBlink]);

  const isKey = windowProps.state === undefined || windowProps.state === "key";
  const { noteKey } = actions;
  useEffect(() => {
    if (isKey) noteKey();
  }, [isKey, noteKey]);

  // The window gets the keyboard (the desktop puts it on the root): it goes to the screen.
  useEffect(() => {
    if (windowProps.state === undefined || windowProps.state === "key") {
      if (!findOpen && !sheet && root && !root.contains(document.activeElement)) focusScreen();
    }
  }, [windowProps.state, focusScreen, root, findOpen, sheet]);
  // A new tab, a tab brought forward, or a new pane has the keyboard.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these say when to take the keyboard.
  useEffect(() => {
    if (windowProps.state === undefined || windowProps.state === "key") focusScreen();
  }, [tab.id, tab.split]);

  // A menu that closes gives the keyboard back to where it was, which may be the Terminal window
  // this one has just replaced as key.
  useEffect(() => {
    if (windowProps.state !== "key" || !root) return;
    const reclaim = (event: FocusEvent) => {
      const { target } = event;
      if (target instanceof Element && target.closest(".mac-terminal") && !root.contains(target)) {
        focusScreen();
      }
    };
    document.addEventListener("focusin", reclaim);
    return () => document.removeEventListener("focusin", reclaim);
  }, [focusScreen, root, windowProps.state]);

  const copy = useCallback(() => {
    const text = screen()?.selectedText() ?? "";
    if (text) void copyText(text);
  }, [screen]);

  const paste = useCallback(
    (transform: (text: string) => string = (text) => text) => {
      // A page outside a secure context has no `navigator.clipboard`; reading it there would throw.
      if (!canReadClipboard()) {
        setPasteRefused(true);
        return;
      }
      void navigator.clipboard
        .readText()
        .then((text) => {
          if (text) session.input(pastedBytes(session, transform(text)));
          focusScreen();
        })
        .catch(() => setPasteRefused(true));
    },
    [focusScreen, session],
  );

  const runFind = useCallback(
    (direction: 1 | -1, query = findText) => {
      if (!query) return;
      setFindMissing(!screen()?.find(query, direction));
    },
    [findText, screen],
  );

  // A drive item dropped on the screen: its path, escaped, as if typed, with a space after it.
  const dropOn = useRef<(paths: string) => void>(() => {});
  dropOn.current = (paths) => {
    session.input(pastedBytes(session, `${paths} `));
    focusScreen();
  };
  useEffect(() => {
    if (!root) return undefined;
    return registerDropTarget({
      element: root,
      landing: (hit: Element, drag: DesktopDrag) => {
        const body = hit.closest(".mac-terminal-body");
        if (!body) return undefined;
        const paths = drag.items.map((item) => shellPathOfItem(item.id));
        return {
          element: body,
          copies: true,
          refusal: paths.every((path) => path !== undefined)
            ? undefined
            : "A file that is not on the drive has no path to type.",
          drop: () => dropOn.current(paths.map((path) => escapeForShell(path as string)).join(" ")),
        };
      },
    });
  }, [root]);

  const commands = useMemo(() => {
    const emulator = session.emulator;
    const canSave = driveAvailable();
    const print = (text: string) =>
      printDocument({ name: title, lines: text.split("\n"), plain: true });
    const closeTabOrWindow = () => {
      if (tab.split) {
        actions.setSplit(tab.id, false);
      } else if (model.tabs.length > 1) {
        closeAsking.current([tab], "tab", () => actions.closeTab(tab.id));
      } else {
        closeAsking.current(model.tabs, "window", actions.closeWindow);
      }
    };
    const list = {
      newWindow: { key: "command+n", enabled: actions.canOpenWindows, run: actions.newWindow },
      newTab: { key: "command+t", run: actions.newTab },
      newCommand: { key: "shift+command+n", run: () => setSheet("new-command") },
      importProfile: { key: "command+o", enabled: canSave, run: () => setSheet("import") },
      exportText: { key: "command+s", enabled: canSave, run: () => setSheet("export-text") },
      exportSettings: { enabled: canSave, run: () => setSheet("export-settings") },
      inspector: {
        key: "command+i",
        enabled: actions.canOpenWindows,
        run: () => actions.openInspector("info"),
      },
      editTitle: {
        key: "shift+command+i",
        enabled: actions.canOpenWindows,
        run: () => actions.openInspector("info", true),
      },
      editBackground: { key: "option+command+i", run: actions.openColorPanel },
      printSelection: {
        key: "option+command+p",
        enabled: hasSelection,
        run: () => print(screen()?.selectedText() ?? ""),
      },
      print: { key: "command+p", run: () => print(emulator.allText()) },
      asDefault: { run: actions.makeDefault },
      copyBackground: {
        run: () => void copyText(shownColour(profile.background, "#1e1e1e", "#ffffff")),
      },
      saveGroup: { run: () => setSheet("save-group") },
      close: { key: "command+w", run: closeTabOrWindow },
      closeWindow: {
        key: "shift+command+w",
        run: () => closeAsking.current(model.tabs, "window", actions.closeWindow),
      },
      hardReset: {
        key: "control+option+command+r",
        run: () => {
          emulator.hardReset();
          emulator.cursorShape = profile.cursorShape;
          emulator.cursorBlink = profile.cursorBlink;
          emulator.write("\x1b[?2004h");
          session.editor.redraw();
        },
      },
      softReset: { key: "option+command+r", run: () => emulator.softReset() },
      interrupt: { run: () => session.interrupt() },
      copy: { key: "command+c", enabled: hasSelection, run: copy },
      copyPlain: { key: "option+command+c", enabled: hasSelection, run: copy },
      paste: { key: "command+v", enabled: !pasteRefused && canReadClipboard(), run: () => paste() },
      pasteEscaped: {
        key: "control+command+v",
        enabled: !pasteRefused && canReadClipboard(),
        run: () => paste(escapeForShell),
      },
      pasteSelection: {
        key: "shift+command+v",
        enabled: hasSelection,
        run: () => {
          const text = screen()?.selectedText() ?? "";
          if (text) session.input(pastedBytes(session, text));
        },
      },
      selectAll: { key: "command+a", run: () => screen()?.selectAll() },
      selectBetweenMarks: { key: "shift+command+a", run: () => screen()?.selectBetweenMarks() },
      clearToMark: {
        key: "command+l",
        run: () => {
          emulator.clearToPreviousMark();
          screen()?.clearSelection();
        },
      },
      clearToStart: {
        key: "command+k",
        run: () => {
          emulator.clearToStart();
          screen()?.clearSelection();
        },
      },
      clearScrollback: {
        key: "option+command+k",
        run: () => {
          emulator.clearScrollback();
          screen()?.clearSelection();
        },
      },
      clearScreen: {
        key: "control+command+l",
        run: () => {
          emulator.clearScreen();
          screen()?.clearSelection();
        },
      },
      find: {
        key: "command+f",
        run: () => {
          setFindOpen(true);
          requestAnimationFrame(() => findField.current?.select());
        },
      },
      findNext: { key: "command+g", run: () => runFind(1) },
      findPrevious: { key: "shift+command+g", run: () => runFind(-1) },
      useSelectionForFind: {
        key: "command+e",
        enabled: hasSelection,
        run: () => setFindText(screen()?.selectedText() ?? ""),
      },
      jumpToSelection: {
        key: "command+j",
        enabled: hasSelection,
        run: () => screen()?.jumpToSelection(),
      },
      mark: { key: "command+u", run: () => screen()?.mark(true) },
      unmark: { key: "option+command+u", run: () => screen()?.mark(false) },
      bookmark: { run: () => screen()?.mark(true) },
      previousMark: { key: "command+up", run: () => screen()?.jumpToMark(-1) },
      nextMark: { key: "command+down", run: () => screen()?.jumpToMark(1) },
      optionAsMeta: {
        key: "option+command+o",
        run: () =>
          actions.changeTab(tab.id, { changes: { ...tab.changes, optionAsMeta: !optionAsMeta } }),
      },
      tabBar: {
        key: "shift+command+t",
        enabled: model.tabs.length === 1,
        run: () => setTabBarWanted((on) => !on),
      },
      marks: { key: "shift+command+m", run: () => setShowMarks((on) => !on) },
      split: {
        key: "command+d",
        enabled: !tab.split,
        run: () => {
          actions.setSplit(tab.id, true);
          setActivePane("bottom");
        },
      },
      closeSplit: {
        key: "shift+command+d",
        enabled: tab.split,
        run: () => actions.setSplit(tab.id, false),
      },
      bigger: {
        key: "command+=",
        run: () =>
          actions.changeTab(tab.id, {
            changes: { ...tab.changes, fontSize: Math.min(MAX_FONT_SIZE, fontSize + 1) },
          }),
      },
      smaller: {
        key: "command+-",
        run: () =>
          actions.changeTab(tab.id, {
            changes: { ...tab.changes, fontSize: Math.max(MIN_FONT_SIZE, fontSize - 1) },
          }),
      },
      defaultSize: {
        key: "command+0",
        run: () => {
          const { fontSize: _size, ...changes } = tab.changes;
          actions.changeTab(tab.id, { changes });
        },
      },
      scrollTop: { key: "command+home", run: () => screen()?.scroll("top") },
      scrollBottom: { key: "command+end", run: () => screen()?.scroll("bottom") },
      pageUp: { key: "command+page-up", run: () => screen()?.scroll("pageUp") },
      pageDown: { key: "command+page-down", run: () => screen()?.scroll("pageDown") },
      lineUp: { key: "option+command+page-up", run: () => screen()?.scroll("lineUp") },
      lineDown: { key: "option+command+page-down", run: () => screen()?.scroll("lineDown") },
      previousTab: {
        key: "control+shift+tab",
        enabled: model.tabs.length > 1,
        run: () => {
          const at = model.tabs.indexOf(tab);
          const next = model.tabs[(at + model.tabs.length - 1) % model.tabs.length] as TerminalTab;
          actions.selectTab(next.id);
        },
      },
      nextTab: {
        key: "control+tab",
        enabled: model.tabs.length > 1,
        run: () => {
          const at = model.tabs.indexOf(tab);
          const next = model.tabs[(at + 1) % model.tabs.length] as TerminalTab;
          actions.selectTab(next.id);
        },
      },
      moveTab: {
        enabled: actions.canOpenWindows && model.tabs.length > 1,
        run: () => actions.moveTabToNewWindow(),
      },
      mergeAll: { enabled: actions.windowCount > 1, run: actions.mergeAll },
      returnToDefaultSize: {
        enabled: actions.canOpenWindows,
        run: actions.returnToDefaultSize,
      },
    } satisfies Record<string, WindowCommand>;
    return list;
  }, [
    actions,
    copy,
    fontSize,
    hasSelection,
    optionAsMeta,
    paste,
    pasteRefused,
    profile.background,
    profile.cursorBlink,
    profile.cursorShape,
    runFind,
    screen,
    session,
    model.tabs,
    tab,
    title,
  ]);

  /** Runs the command a key press is the equivalent of. Answers whether it was one. */
  const commandKey = useCallback(
    (event: KeyboardEvent<HTMLElement>, selected: boolean) => {
      const native = event.nativeEvent;
      // Paste comes as the browser's own event, which alone may read the clipboard.
      if (matchesTerminalCommand(native, "command+v", selected)) return false;
      // Control-Tab and Control-Shift-Tab are no menu key off a Mac's reading of Command.
      for (const command of Object.values(commands) as WindowCommand[]) {
        if (!command.key) continue;
        const hit = /control\+(shift\+)?tab/.test(command.key)
          ? matchesMenuKeyEquivalent(native, command.key)
          : matchesTerminalCommand(native, command.key, selected);
        if (hit) {
          if (command.enabled !== false) command.run();
          return true;
        }
      }
      return false;
    },
    [commands],
  );

  const shellMenu = useMemo(
    () => (
      <>
        {item("New Window", commands.newWindow, {
          reason: "Further windows need the desktop",
        })}
        {item("New Tab", commands.newTab)}
        {item("New Command…", commands.newCommand)}
        <MenuItem
          disabled
          keyEquivalent="shift+command+k"
          aria-describedby={`${reasonId}-remote`}
          title={REMOTE_REASON}
        >
          New Remote Connection…
        </MenuItem>
        <Reason id={`${reasonId}-remote`}>{REMOTE_REASON}</Reason>
        <MenuSeparator />
        {item("Import…", commands.importProfile, { reason: NO_DRIVE_REASON })}
        {item("Export Text As…", commands.exportText, { reason: NO_DRIVE_REASON })}
        {item("Export Settings As…", commands.exportSettings, { reason: NO_DRIVE_REASON })}
        <MenuSeparator />
        {item("Show Inspector", commands.inspector, {
          reason: "The Inspector is a desktop window",
        })}
        {item("Edit Title", commands.editTitle, { reason: "The Inspector is a desktop window" })}
        {item("Edit Background Color", commands.editBackground)}
        <MenuSeparator />
        {item("Print Selection", commands.printSelection, { reason: "Nothing is selected" })}
        {item("Print", commands.print)}
        <MenuSeparator />
        {item("Send Hard Reset", commands.hardReset)}
        {item("Send Soft Reset", commands.softReset)}
        <Submenu>
          <SubmenuTrigger>Send Signal</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem onClick={commands.interrupt.run}>INT</MenuItem>
            <MenuItem onClick={commands.interrupt.run}>TERM</MenuItem>
            <MenuItem onClick={commands.interrupt.run}>HUP</MenuItem>
            <MenuItem onClick={commands.interrupt.run}>KILL</MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        {item("Close", commands.close)}
        {item("Close Window", commands.closeWindow)}
        <MenuSeparator />
        {item("Use Settings as Default", commands.asDefault)}
      </>
    ),
    [commands, reasonId],
  );
  useDesktopAppMenu("terminal", "Shell", shellMenu, root);

  const applicationMenu = useMemo(
    () => (
      <>
        <MenuItem disabled aria-describedby={`${reasonId}-secure`} title={SECURE_REASON}>
          Secure Keyboard Entry
        </MenuItem>
        <Reason id={`${reasonId}-secure`}>{SECURE_REASON}</Reason>
      </>
    ),
    [reasonId],
  );
  useDesktopAppMenu("terminal", "Terminal", applicationMenu, root);

  const editMenu = useMemo(
    () => (
      <>
        <MenuItem
          disabled
          keyEquivalent="command+z"
          aria-describedby={`${reasonId}-edit`}
          title={EDIT_REASON}
        >
          Undo
        </MenuItem>
        <MenuItem
          disabled
          keyEquivalent="shift+command+z"
          aria-describedby={`${reasonId}-edit`}
          title={EDIT_REASON}
        >
          Redo
        </MenuItem>
        <MenuItem
          disabled
          keyEquivalent="command+x"
          aria-describedby={`${reasonId}-edit`}
          title={EDIT_REASON}
        >
          Cut
        </MenuItem>
        <Reason id={`${reasonId}-edit`}>{EDIT_REASON}</Reason>
        {item("Copy", commands.copy, { reason: "Nothing is selected" })}
        <Submenu>
          <SubmenuTrigger>Copy Special</SubmenuTrigger>
          <SubmenuPopup>
            {item("Plain Text", commands.copyPlain, { reason: "Nothing is selected" })}
            {item("Background Color", commands.copyBackground)}
          </SubmenuPopup>
        </Submenu>
        {item("Paste", commands.paste, {
          reason:
            "The browser does not let the page read the clipboard from a menu; the keyboard's Paste still works",
        })}
        {item("Paste Escaped Text", commands.pasteEscaped, {
          reason: "The browser does not let the page read the clipboard from a menu",
        })}
        {item("Paste Selection", commands.pasteSelection, { reason: "Nothing is selected" })}
        {item("Select All", commands.selectAll)}
        {item("Select Between Marks", commands.selectBetweenMarks)}
        <MenuSeparator />
        {item("Clear to Previous Mark", commands.clearToMark)}
        {item("Clear to Start", commands.clearToStart)}
        {item("Clear Scrollback", commands.clearScrollback)}
        {item("Clear Screen", commands.clearScreen)}
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Find</SubmenuTrigger>
          <SubmenuPopup>
            {item("Find…", commands.find)}
            {item("Find Next", commands.findNext)}
            {item("Find Previous", commands.findPrevious)}
            {item("Use Selection for Find", commands.useSelectionForFind, {
              reason: "Nothing is selected",
            })}
            {item("Jump to Selection", commands.jumpToSelection, { reason: "Nothing is selected" })}
          </SubmenuPopup>
        </Submenu>
        <Submenu>
          <SubmenuTrigger>Marks</SubmenuTrigger>
          <SubmenuPopup>
            {item("Mark", commands.mark)}
            {item("Unmark", commands.unmark)}
            {item("Mark as Bookmark", commands.bookmark)}
            {item("Jump to Previous", commands.previousMark)}
            {item("Jump to Next", commands.nextMark)}
          </SubmenuPopup>
        </Submenu>
        <Submenu>
          <SubmenuTrigger>Speech</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem
              disabled={typeof speechSynthesis === "undefined"}
              onClick={() => {
                speechSynthesis.cancel();
                speechSynthesis.speak(
                  new SpeechSynthesisUtterance(
                    screen()?.selectedText() || session.emulator.allText(),
                  ),
                );
              }}
            >
              Start Speaking
            </MenuItem>
            <MenuItem
              disabled={typeof speechSynthesis === "undefined"}
              onClick={() => speechSynthesis.cancel()}
            >
              Stop Speaking
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuCheckboxItem
          keyEquivalent={commands.optionAsMeta.key}
          checked={optionAsMeta}
          onCheckedChange={commands.optionAsMeta.run}
        >
          Use Option as Meta Key
        </MenuCheckboxItem>
      </>
    ),
    [commands, optionAsMeta, reasonId, screen, session],
  );
  useDesktopAppMenu("terminal", "Edit", editMenu, root);

  const viewMenu = useMemo(
    () => (
      <>
        {item(showTabBar ? "Hide Tab Bar" : "Show Tab Bar", commands.tabBar, {
          reason: "A window with several tabs always shows them",
        })}
        <MenuItem disabled title={NO_TAB_OVERVIEW}>
          Show All Tabs
        </MenuItem>
        {item(showMarks ? "Hide Marks" : "Show Marks", commands.marks)}
        <MenuItem disabled title={NO_ALTERNATE_PEEK}>
          Show Alternate Screen
        </MenuItem>
        <MenuItem disabled title={NO_MOUSE_REPORTING}>
          Allow Mouse Reporting
        </MenuItem>
        <MenuSeparator />
        {item("Split Pane", commands.split, { reason: "This tab is already split" })}
        {item("Close Split Pane", commands.closeSplit, { reason: "This tab is not split" })}
        <MenuSeparator />
        {item("Bigger", commands.bigger)}
        {item("Smaller", commands.smaller)}
        {item("Default Font Size", commands.defaultSize)}
        <MenuSeparator />
        {item("Scroll to Top", commands.scrollTop)}
        {item("Scroll to Bottom", commands.scrollBottom)}
        {item("Page Up", commands.pageUp)}
        {item("Page Down", commands.pageDown)}
        {item("Line Up", commands.lineUp)}
        {item("Line Down", commands.lineDown)}
      </>
    ),
    [commands, showMarks, showTabBar],
  );
  useDesktopAppMenu("terminal", "View", viewMenu, root);
  const helpMenu = useMemo(
    () => (
      <>
        <MenuItem onClick={() => requestHelp("Terminal")}>Terminal Help</MenuItem>
        <MenuItem onClick={() => setSheet("search-man")}>Search man Page Index…</MenuItem>
      </>
    ),
    [],
  );
  useDesktopAppMenu("terminal", "Help", helpMenu, root);

  const windowMenu = useMemo(
    () => (
      <>
        {item("Return to Default Size", commands.returnToDefaultSize, {
          reason: "This window's size is not the desktop's to change here",
        })}
        <MenuSeparator />
        {item("Show Previous Tab", commands.previousTab, { reason: "This window has one tab" })}
        {item("Show Next Tab", commands.nextTab, { reason: "This window has one tab" })}
        {item("Move Tab to New Window", commands.moveTab, { reason: "This window has one tab" })}
        {item("Merge All Windows", commands.mergeAll, { reason: "Terminal has one window" })}
        <MenuSeparator />
        {item("Save Windows as Group…", commands.saveGroup)}
        {settings.groups.length > 0 ? (
          <Submenu>
            <SubmenuTrigger>Open Window Group</SubmenuTrigger>
            <SubmenuPopup>
              {settings.groups.map((group) => (
                <MenuItem key={group.name} onClick={() => actions.openGroup(group)}>
                  {group.name}
                </MenuItem>
              ))}
            </SubmenuPopup>
          </Submenu>
        ) : null}
      </>
    ),
    [actions, commands, settings.groups],
  );
  useDesktopAppMenu("terminal", "Window", windowMenu, root);

  const dockMenu = useMemo(
    () => (
      <>
        <MenuItem disabled={commands.newWindow.enabled === false} onClick={commands.newWindow.run}>
          New Window
        </MenuItem>
        <MenuItem onClick={commands.newTab.run}>New Tab</MenuItem>
      </>
    ),
    [commands],
  );
  useDesktopAppMenu("terminal", "Dock", dockMenu, root);

  const dragSplit = (event: PointerEvent<HTMLDivElement>) => {
    const area = event.currentTarget.parentElement;
    if (!area) return;
    event.preventDefault();
    const box = area.getBoundingClientRect();
    const move = (moved: globalThis.PointerEvent) => {
      const fraction = (moved.clientY - box.top) / box.height;
      setSplitAt(Math.min(0.85, Math.max(0.15, fraction)));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const selectedWord = /^\S+$/.test(contextText) ? contextText : "";
  const contextAddress = contextText ? linkAddress(contextText.trim()) : null;

  const pane = (name: "top" | "bottom", handle: typeof top) => (
    <ContextualMenu
      onOpenChange={(open) => {
        if (open) {
          setActivePane(name);
          setContextText(handle.current?.selectedText() ?? "");
        } else {
          requestAnimationFrame(() => handle.current?.focus());
        }
      }}
    >
      <ContextualMenuTrigger
        render={
          <div
            className="mac-terminal-pane"
            style={tab.split ? { flexGrow: name === "top" ? splitAt : 1 - splitAt } : undefined}
          />
        }
      >
        <TerminalScreen
          key={`${tab.id}-${name}`}
          ref={handle}
          session={session}
          fontSize={fontSize}
          fontFamily={profile.fontFamily}
          visualBell={profile.visualBell}
          audibleBell={profile.audibleBell}
          active={!tab.split || activePane === name}
          showMarks={showMarks}
          optionAsMeta={optionAsMeta}
          onActivate={() => setActivePane(name)}
          onCommandKey={commandKey}
          onSelectionChange={setHasSelection}
        />
      </ContextualMenuTrigger>
      <ContextualMenuPopup>
        <MenuItem disabled={!contextText} onClick={commands.copy.run}>
          Copy
        </MenuItem>
        <MenuItem
          disabled={commands.paste.enabled === false}
          title={commands.paste.enabled === false ? "The browser refused the clipboard" : undefined}
          onClick={commands.paste.run}
        >
          Paste
        </MenuItem>
        <MenuItem disabled={!contextText} onClick={commands.pasteSelection.run}>
          Paste Selection
        </MenuItem>
        <MenuItem onClick={commands.clearToStart.run}>Clear to Start</MenuItem>
        <MenuSeparator />
        <MenuItem disabled={tab.split} onClick={commands.split.run}>
          Split Pane
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={!selectedWord}
          onClick={() =>
            actions.runCommand({
              command: `man ${escapeForShell(selectedWord)}`,
              inShell: false,
              profile: "Man Page",
              changes: { whenExits: "close-clean" },
            })
          }
        >
          Open man Page
        </MenuItem>
        <MenuItem
          disabled={!selectedWord}
          title={selectedWord ? undefined : NO_MAN_SELECTION_REASON}
          onClick={() => searchManual(selectedWord)}
        >
          Search man Page Index
        </MenuItem>
        <MenuItem disabled={commands.inspector.enabled === false} onClick={commands.inspector.run}>
          Inspect
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={!contextText} onClick={() => lookUp(contextText)}>
          {selectedWord ? `Look Up “${selectedWord}”` : "Look Up"}
        </MenuItem>
        <Submenu>
          <SubmenuTrigger disabled={!contextText}>Services</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem onClick={() => lookUp(contextText)}>Look Up in Dictionary</MenuItem>
            {contextAddress ? (
              <MenuItem onClick={() => openUrl(contextAddress, "terminal")}>Open URL</MenuItem>
            ) : null}
            <MenuItem onClick={() => openUrl(webAddressFor(contextText), "terminal")}>
              Search the Web
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
      </ContextualMenuPopup>
    </ContextualMenu>
  );

  return (
    <Window
      ref={setRoot}
      data-terminal-window={model.id}
      aria-label={title}
      tabIndex={-1}
      {...windowProps}
      className={className ? `mac-terminal ${className}` : "mac-terminal"}
      style={{ ...style, ...profileStyle(profile) }}
      data-profile={tab.profile.toLowerCase().replace(/\s+/g, "-")}
      onFocus={(event) => {
        onFocus?.(event);
        if (event.target === event.currentTarget) focusScreen();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || sheet) return;
        // The Find field's own text: its Select All, Copy and the rest are the browser's.
        if (
          event.target instanceof HTMLInputElement &&
          ["a", "c", "v", "x", "z"].includes(event.key.toLowerCase())
        ) {
          return;
        }
        if (commandKey(event, hasSelection)) event.preventDefault();
      }}
    >
      <TitleBar
        title={title}
        icon={<ProxyIcon session={session} />}
        divider={showTabBar ? "bar" : "content"}
        controls={
          <WindowControls
            onClose={() =>
              closeAsking.current(model.tabs, "window", onClose ?? actions.closeWindow)
            }
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
      {showTabBar ? (
        <ContextualMenu>
          <ContextualMenuTrigger
            render={<div className="mac-terminal-tabs" />}
            onPointerDown={startTabDrag}
            onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
              const pressed = (event.target as Element)
                .closest("[data-terminal-tab]")
                ?.getAttribute("data-terminal-tab");
              setContextTab(pressed ? Number(pressed) : null);
            }}
          >
            <WindowTabBar
              aria-label="Tabs"
              value={tab.id}
              onValueChange={(value) => actions.selectTab(value as number)}
              onNewTab={actions.newTab}
            >
              {model.tabs.map((each) => (
                <TabTitle
                  key={each.id}
                  tab={each}
                  profile={shownProfile(settings, each)}
                  closable={model.tabs.length > 1}
                  onClose={() =>
                    closeAsking.current([each], "tab", () => actions.closeTab(each.id))
                  }
                />
              ))}
            </WindowTabBar>
          </ContextualMenuTrigger>
          <ContextualMenuPopup>
            <MenuItem
              disabled={contextTab === null}
              onClick={() => {
                const closing = model.tabs.find((each) => each.id === contextTab);
                if (closing) {
                  closeAsking.current([closing], "tab", () => actions.closeTab(closing.id));
                }
              }}
            >
              Close Tab
            </MenuItem>
            <MenuItem
              disabled={contextTab === null || model.tabs.length < 2}
              onClick={() => contextTab !== null && actions.closeOtherTabs(contextTab)}
            >
              Close Other Tabs
            </MenuItem>
            <MenuItem
              disabled={contextTab === null || model.tabs.length < 2 || !actions.canOpenWindows}
              onClick={() => contextTab !== null && actions.moveTabToNewWindow(contextTab)}
            >
              Move Tab to New Window
            </MenuItem>
          </ContextualMenuPopup>
        </ContextualMenu>
      ) : null}
      {findOpen ? (
        <div className="mac-terminal-find">
          <SearchField
            inputRef={findField}
            aria-label="Find"
            size="small"
            autoFocus
            value={findText}
            onChange={(event) => {
              const query = event.currentTarget.value;
              setFindText(query);
              if (query) setFindMissing(!screen()?.find(query, 1));
              else setFindMissing(false);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runFind(event.shiftKey ? -1 : 1);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setFindOpen(false);
                focusScreen();
              }
            }}
          />
          {findMissing ? (
            <span className="mac-terminal-find-note" role="status">
              Not found
            </span>
          ) : null}
          <PushButton size="small" onClick={() => runFind(-1)}>
            Previous
          </PushButton>
          <PushButton size="small" onClick={() => runFind(1)}>
            Next
          </PushButton>
          <PushButton
            size="small"
            onClick={() => {
              setFindOpen(false);
              focusScreen();
            }}
          >
            Done
          </PushButton>
        </div>
      ) : null}
      <WindowBody className="mac-terminal-body">
        {tab.split ? (
          <>
            {pane("top", top)}
            {/* biome-ignore lint/a11y/useSemanticElements: an <hr> takes no pointer drag. */}
            <div
              className="mac-terminal-divider"
              role="separator"
              aria-label="Split pane divider"
              aria-orientation="horizontal"
              aria-valuenow={Math.round(splitAt * 100)}
              tabIndex={0}
              onPointerDown={dragSplit}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                event.preventDefault();
                const step = event.key === "ArrowUp" ? -0.05 : 0.05;
                setSplitAt((at) => Math.min(0.85, Math.max(0.15, at + step)));
              }}
            />
          </>
        ) : null}
        {pane("bottom", bottom)}
      </WindowBody>
      <NewCommandSheet
        open={sheet === "new-command"}
        anchor={root}
        profiles={profileNames(settings)}
        profile={tab.profile}
        onRun={actions.runCommand}
        onClose={() => setSheet(null)}
      />
      <SaveGroupSheet
        open={sheet === "save-group"}
        anchor={root}
        onSave={actions.saveGroup}
        onClose={() => setSheet(null)}
      />
      <SearchManSheet
        open={sheet === "search-man"}
        anchor={root}
        onSearch={searchManual}
        onClose={() => setSheet(null)}
      />
      <TerminateSheet pending={closing} anchor={root} onDone={() => setClosing(null)} />
      <ExportFileSheet
        name={sheet === "export-text" ? `${title}.txt` : null}
        anchor={root}
        contents={() => session.emulator.allText()}
        extension=".txt"
        type="text/plain"
        onClose={() => setSheet(null)}
      />
      <ExportFileSheet
        name={sheet === "export-settings" ? `${tab.profile}.terminal` : null}
        anchor={root}
        contents={() => profileToFile({ ...profile, name: tab.profile })}
        extension=".terminal"
        type="application/x-apple-terminal"
        onClose={() => setSheet(null)}
      />
      {sheet === "import" ? (
        <ImportProfilePanel onImported={actions.importProfile} onClose={() => setSheet(null)} />
      ) : null}
    </Window>
  );
}

/** A tab's title follows what its session shows. */
function TabTitle({
  tab,
  profile,
  closable,
  onClose,
}: {
  tab: TerminalTab;
  profile: TerminalProfile;
  closable: boolean;
  onClose: () => void;
}) {
  const subscribe = useCallback(
    (listener: () => void) => tab.session.subscribe(listener),
    [tab.session],
  );
  const name = () => {
    const { emulator, scope, processName } = tab.session;
    const place = tab.title || emulator.title || profile.tabTitle || baseName(scope.cwd) || "/";
    return profile.tabShowProcess ? `${place} — ${processName}` : place;
  };
  const title = useSyncExternalStore(subscribe, name, name);
  return (
    <WindowTab value={tab.id} data-terminal-tab={tab.id} onClose={closable ? onClose : undefined}>
      {title}
    </WindowTab>
  );
}

/** What the application asks of the desktop's window store. */
interface FrameCommands {
  returnToDefaultSize: (windowId: string, size: { width: number; height: number }) => void;
  /** The window takes this much more, or less, than its frame. */
  grow: (windowId: string, width: number, height: number) => void;
  /** The main window takes the frame of the further window that replaces it. */
  takeFrame: (from: number) => void;
}

/** Reads the window store, which only exists on a desktop. */
function FrameCommandsOnDesktop({ ref }: { ref: Ref<FrameCommands> }) {
  const store = useWindowManagerStore();
  useImperativeHandle(
    ref,
    () => ({
      returnToDefaultSize: (windowId, size) => {
        const frame = store.get(windowId)?.frame;
        if (frame) store.patch(windowId, { frame: { ...frame, ...size } });
      },
      grow: (windowId, width, height) => {
        const frame = store.get(windowId)?.frame;
        if (frame) {
          store.patch(windowId, {
            frame: { ...frame, width: frame.width + width, height: frame.height + height },
          });
        }
      },
      takeFrame: (from) => {
        const frame = store.get(`terminal:window-${from}`)?.frame;
        if (frame) store.patch("terminal", { frame });
      },
    }),
    [store],
  );
  return null;
}

function createWindow(
  tabs: TerminalTab[],
  frame?: TerminalWindowState["frame"],
): TerminalWindowState {
  return { id: freshId(), tabs, active: (tabs[0] as TerminalTab).id, frame };
}

/** What a new tab starts as. Every part may be left out. */
interface TabStart {
  cwd?: string;
  oldCwd?: string;
  profile?: string;
  changes?: Partial<TerminalProfile>;
  title?: string;
  programTitle?: string | null;
  split?: boolean;
  lines?: readonly string[];
  /** What the shell runs first, instead of what the profile says. */
  command?: NewCommand;
}

/** What is kept of a session as it runs, which no render depends on. */
interface SessionNote {
  /** How much of the editor's history is already the account's. */
  historyKept: number;
  /** What it showed before a program took the alternate screen. */
  lines: readonly string[];
  /** Whether its first prompt, and the command after it, have started. */
  begun: boolean;
  /** Whether its shell's end was acted on. */
  ended: boolean;
  /** A folder from an earlier session, which may have gone since. */
  restored: boolean;
  command?: NewCommand;
}

const notes = new WeakMap<TerminalSession, SessionNote>();

const lineOf = ({ command, inShell }: NewCommand) =>
  inShell ? `${command}\r` : `${command}; exit $?\r`;

/**
 * Terminal: a window of tabs and split panes, each tab a VT100 and xterm screen (`terminal-emulator`)
 * with a simulated shell behind it (`terminal-shell`) that works on the person's drive. On a desktop
 * page its further windows are windows of the desktop; the application keeps them all, and the first
 * is the one the desktop opened. A served desktop keeps what is open across a reload.
 */
export function Terminal({
  DesktopWindow,
  onClose,
  initialDirectory,
  preferencesOpen,
  onPreferencesOpenChange,
  ...props
}: TerminalProps) {
  const [settingsText, setSettingsText, settingsTooLong] = useKeptText(
    SETTINGS_KEY,
    servedByDesktopApp() ? (readKeptText(SETTINGS_KEY) ?? "") : "",
  );
  const settings = useMemo(
    () => (settingsText ? readSettings(settingsText) : DEFAULT_SETTINGS),
    [settingsText],
  );
  const settingsNow = useRef(settings);
  settingsNow.current = settings;
  const keepSettingsText = useRef(setSettingsText);
  keepSettingsText.current = setSettingsText;
  const changeSettings = useCallback((change: (current: TerminalSettings) => TerminalSettings) => {
    settingsNow.current = change(settingsNow.current);
    keepSettingsText.current(JSON.stringify(settingsNow.current));
  }, []);

  const makeTab = useCallback((start: TabStart = {}): TerminalTab => {
    const session = new TerminalSession({ cwd: start.cwd });
    if (start.oldCwd) session.scope.oldCwd = start.oldCwd;
    if (start.lines) restoreLines(session, start.lines);
    if (start.programTitle) session.emulator.title = start.programTitle;
    const history = savedHistory();
    session.editor.history.push(...history);
    notes.set(session, {
      historyKept: history.length,
      lines: start.lines ?? [],
      begun: false,
      ended: false,
      restored: start.lines !== undefined,
      command: start.command,
    });
    return {
      id: freshId(),
      session,
      split: start.split ?? false,
      profile: start.profile ?? settingsNow.current.defaultProfile,
      changes: start.changes ?? {},
      title: start.title ?? "",
    };
  }, []);

  // What waited for Terminal when it opened: a folder among them is where its first window starts.
  const waitingAtOpen = useRef<OpenFileRequest[]>([]);
  const [windows, setWindows] = useState<TerminalWindowState[]>(() => {
    const own = DesktopWindow ? takeOwnWindows("terminal") : [];
    const waiting = takeOpenFileRequests("terminal");
    waitingAtOpen.current = waiting;
    const saved = initialDirectory === undefined ? savedSession() : null;
    if (saved) {
      const shown = DesktopWindow ? saved.windows : saved.windows.slice(0, 1);
      return shown.map((window) => {
        const tabs = window.tabs.map((tab) => makeTab(tab));
        const at = own.find((each) => each.id === `terminal:window-${window.id}`);
        const frame = at && { x: at.x, y: at.y, width: at.width, height: at.height };
        const made = createWindow(tabs, frame);
        return { ...made, active: (tabs[window.active] ?? (tabs[0] as TerminalTab)).id };
      });
    }
    const { startup, startupProfile, startupGroup, groups } = settingsNow.current;
    const group =
      startup === "group" && initialDirectory === undefined
        ? groups.find((each) => each.name === startupGroup)
        : undefined;
    if (group && group.windows.length > 0) {
      const shown = DesktopWindow ? group.windows : group.windows.slice(0, 1);
      return shown.map((tabs) => createWindow(tabs.map((tab) => makeTab(tab))));
    }
    const folderAt = waiting.findIndex((each) => each.folder && shellPathOfItem(each.id));
    const folder = waiting[folderAt];
    if (folder) {
      waitingAtOpen.current = waiting.filter((_, index) => index !== folderAt);
      return [
        createWindow([
          makeTab({ cwd: shellPathOfItem(folder.id) ?? undefined, profile: startupProfile }),
        ]),
        ...own.map(({ x, y, width, height }) =>
          createWindow([makeTab({ profile: startupProfile })], { x, y, width, height }),
        ),
      ];
    }
    return [
      createWindow([makeTab({ cwd: initialDirectory, profile: startupProfile })]),
      // General's Close windows when quitting: the further windows it quit with, where they were.
      ...own.map(({ x, y, width, height }) =>
        createWindow([makeTab({ cwd: initialDirectory, profile: startupProfile })], {
          x,
          y,
          width,
          height,
        }),
      ),
    ];
  });
  const frames = useRef<FrameCommands>(null);
  const openWindows = useRef(windows);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const acceptedQuit = useRef(false);

  const keepHistoryNow = useCallback(() => {
    const lines: string[] = [];
    for (const window of openWindows.current) {
      for (const { session } of window.tabs) {
        const note = notes.get(session);
        if (!note) continue;
        lines.push(...session.editor.history.slice(note.historyKept));
        note.historyKept = session.editor.history.length;
      }
    }
    keepHistory(lines);
  }, []);

  const saveNow = useCallback(
    (quit = false) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      keepHistoryNow();
      const session: SavedSession = {
        ...(quit ? { quit: true } : {}),
        windows: openWindows.current.map((window) => ({
          id: window.id,
          active: Math.max(
            0,
            window.tabs.findIndex((tab) => tab.id === window.active),
          ),
          tabs: window.tabs.map((tab): SavedTab => {
            const note = notes.get(tab.session);
            const { emulator, scope } = tab.session;
            if (note && !emulator.onAlternate) note.lines = linesOfSession(tab.session);
            return {
              cwd: scope.cwd,
              oldCwd: scope.oldCwd,
              title: tab.title,
              programTitle: emulator.title,
              profile: tab.profile,
              changes: tab.changes,
              split: tab.split,
              lines: note?.lines ?? [],
            };
          }),
        })),
      };
      keepSession(session);
    },
    [keepHistoryNow],
  );

  const [quitting, setQuitting] = useState<PendingClose | null>(null);
  useEffect(() => {
    if (!DesktopWindow) return undefined;
    return registerAppQuit("terminal", (finish) => {
      const tabs = openWindows.current.flatMap((window) => window.tabs);
      const asks = tabs.some((tab) => {
        const { askBeforeClosing } = shownProfile(settingsNow.current, tab);
        return (
          askBeforeClosing === "always" || (askBeforeClosing === "running" && tab.session.busy)
        );
      });
      const close = () => {
        clearTimeout(saveTimer.current);
        saveTimer.current = undefined;
        if (desktopValues()[CLOSE_WINDOWS_KEY] === false) saveNow(true);
        else {
          keepHistoryNow();
          keepSession(null);
        }
        acceptedQuit.current = true;
        finish();
      };
      if (!asks) close();
      else
        setQuitting({
          what: "window",
          running: tabs.flatMap((tab) => (tab.session.busy ? [tab.session.processName] : [])),
          close,
        });
    });
  }, [DesktopWindow, keepHistoryNow, saveNow]);

  const saveSoon = useCallback(() => {
    if (!servedByDesktopApp() || acceptedQuit.current || saveTimer.current !== undefined) return;
    saveTimer.current = setTimeout(saveNow, SAVE_PAUSE_MS);
  }, [saveNow]);

  useEffect(() => {
    if (!servedByDesktopApp()) return undefined;
    const leave = () => {
      if (!acceptedQuit.current) saveNow();
    };
    const hide = () => {
      if (document.visibilityState === "hidden" && !acceptedQuit.current) saveNow();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [saveNow]);

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode cleans up and sets up again in one task: only a cleanup that stays stops anything.
      queueMicrotask(() => {
        if (mounted.current) return;
        clearTimeout(saveTimer.current);
        if (!acceptedQuit.current) {
          if (desktopValues()[CLOSE_WINDOWS_KEY] === false) saveNow(true);
          else {
            keepHistoryNow();
            keepSession(null);
          }
        }
        for (const window of openWindows.current) {
          for (const tab of window.tabs) tab.session.stop();
        }
      });
    };
  }, [keepHistoryNow, saveNow]);

  const changeWindow = useCallback(
    (id: number, change: (window: TerminalWindowState) => TerminalWindowState) => {
      setWindows((list) => list.map((window) => (window.id === id ? change(window) : window)));
    },
    [],
  );

  const closeWindow = useCallback(
    (id: number) => {
      if (windows.length === 1 && !onClose) return;
      for (const tab of windows.find((window) => window.id === id)?.tabs ?? []) {
        tab.session.stop();
      }
      if (windows[0]?.id === id && windows[1] && frames.current) {
        frames.current.takeFrame(windows[1].id);
      }
      if (windows.length === 1) {
        onClose?.();
        return;
      }
      setWindows((list) => list.filter((window) => window.id !== id));
    },
    [onClose, windows],
  );

  const [inspector, setInspector] = useState<{ pane: InspectorPane; focusTitle: number } | null>(
    null,
  );
  const [colorPanelOpen, setColorPanelOpen] = useState(false);
  const keyWindow = useRef(windows[0]?.id ?? 0);
  const [keyId, setKeyId] = useState(keyWindow.current);

  const changeTabIn = useCallback(
    (windowId: number, id: number, change: Partial<TerminalTab>) =>
      changeWindow(windowId, (current) => ({
        ...current,
        tabs: current.tabs.map((each) => (each.id === id ? { ...each, ...change } : each)),
      })),
    [changeWindow],
  );

  /** The tab's settings become its profile's, and that profile the default. */
  const makeDefault = useCallback(
    (tab: TerminalTab) => {
      changeSettings((current) => ({
        ...changeProfile(current, tab.profile, tab.changes),
        defaultProfile: tab.profile,
      }));
    },
    [changeSettings],
  );

  const importProfile = useCallback(
    (profile: Partial<TerminalProfile>) => {
      changeSettings(
        (current) => addProfile(current, profile.name ?? "Imported", profile).settings,
      );
    },
    [changeSettings],
  );

  const runCommand = useCallback(
    ({ command, inShell, profile, changes }: NewCommand, cwd?: string) => {
      const created = makeTab({ cwd, profile, changes, command: { command, inShell } });
      if (DesktopWindow && !tabsPreferred()) {
        setWindows((list) => [...list, createWindow([created])]);
        return;
      }
      setWindows((list) =>
        list.map((window) =>
          window.id === keyWindow.current
            ? { ...window, tabs: [...window.tabs, created], active: created.id }
            : window,
        ),
      );
    },
    [DesktopWindow, makeTab],
  );

  // A file opened from Finder: a `.command` runs and ends, a `.terminal` opens a window of its profile.
  useEffect(() => {
    const open = (request: OpenFileRequest) => {
      if (request.folder) {
        const cwd = shellPathOfItem(request.id);
        if (!cwd) return;
        const created = makeTab({ cwd });
        if (request.folder === "window") {
          setWindows((list) => [...list, createWindow([created])]);
          return;
        }
        setWindows((list) =>
          list.map((window) =>
            window.id === keyWindow.current
              ? { ...window, tabs: [...window.tabs, created], active: created.id }
              : window,
          ),
        );
        return;
      }
      if (/\.terminal$/i.test(request.name)) {
        void readFile(request.id)
          .then((file) => file.text())
          .then((text) => {
            const imported = profileFromFile(text);
            if (!imported) return;
            let profile = "";
            changeSettings((current) => {
              const added = addProfile(current, imported.name ?? "Imported", imported);
              profile = added.name;
              return added.settings;
            });
            setWindows((list) => [...list, createWindow([makeTab({ profile })])]);
          });
        return;
      }
      const path = shellPathOfItem(request.id);
      if (path) runCommand({ command: `sh ${escapeForShell(path)}`, inShell: false });
    };
    for (const request of [...waitingAtOpen.current, ...takeOpenFileRequests("terminal")]) {
      open(request);
    }
    waitingAtOpen.current = [];
    return onOpenFileRequest("terminal", open);
  }, [changeSettings, makeTab, runCommand]);

  const actionsFor = useCallback(
    (window: TerminalWindowState): WindowActions => {
      const tab = window.tabs.find((each) => each.id === window.active);
      const startOfNew = (kind: "window" | "tab"): TabStart => {
        const current = settingsNow.current;
        const sameProfile =
          (kind === "tab" ? current.newTabProfile : current.newWindowProfile) === "same";
        const sameFolder =
          (kind === "tab" ? current.newTabFolder : current.newWindowFolder) === "same";
        return {
          cwd: sameFolder ? tab?.session.scope.cwd : undefined,
          profile: sameProfile ? tab?.profile : current.defaultProfile,
        };
      };
      const addTab = () => {
        const created = makeTab(startOfNew("tab"));
        changeWindow(window.id, (current) => ({
          ...current,
          tabs: [...current.tabs, created],
          active: created.id,
        }));
      };
      return {
        canOpenWindows: Boolean(DesktopWindow),
        windowCount: windows.length,
        settings,
        newWindow: () => {
          if (tabsPreferred()) {
            addTab();
            return;
          }
          const created = createWindow([makeTab(startOfNew("window"))]);
          setWindows((list) => [...list, created]);
        },
        newTab: addTab,
        closeTab: (id) => {
          if (window.tabs.length === 1) {
            closeWindow(window.id);
            return;
          }
          window.tabs.find((each) => each.id === id)?.session.stop();
          changeWindow(window.id, (current) => {
            const at = current.tabs.findIndex((each) => each.id === id);
            const tabs = current.tabs.filter((each) => each.id !== id);
            const next =
              current.active === id
                ? (tabs[Math.max(0, at - 1)] as TerminalTab).id
                : current.active;
            return { ...current, tabs, active: next };
          });
        },
        closeOtherTabs: (id) => {
          for (const each of window.tabs) {
            if (each.id !== id) each.session.stop();
          }
          changeWindow(window.id, (current) => ({
            ...current,
            tabs: current.tabs.filter((each) => each.id === id),
            active: id,
          }));
        },
        closeWindow: () => closeWindow(window.id),
        selectTab: (id) => changeWindow(window.id, (current) => ({ ...current, active: id })),
        setSplit: (id, split) => changeTabIn(window.id, id, { split }),
        changeTab: (id, change) => changeTabIn(window.id, id, change),
        moveTabToNewWindow: (id) => {
          const moved = id === undefined ? tab : window.tabs.find((each) => each.id === id);
          if (!moved || window.tabs.length === 1) return;
          setWindows((list) => [
            ...list.map((current) => {
              if (current.id !== window.id) return current;
              const tabs = current.tabs.filter((each) => each.id !== moved.id);
              const active =
                current.active === moved.id ? (tabs[0] as TerminalTab).id : current.active;
              return { ...current, tabs, active };
            }),
            createWindow([moved]),
          ]);
        },
        moveTabToWindow: (id, windowId) => {
          const moved = window.tabs.find((each) => each.id === id);
          if (!moved || windowId === window.id) return;
          if (window.tabs.length === 1 && windows[0]?.id === window.id) {
            frames.current?.takeFrame(windowId);
          }
          setWindows((list) =>
            list.flatMap((current) => {
              if (current.id === windowId) {
                return [{ ...current, tabs: [...current.tabs, moved], active: moved.id }];
              }
              if (current.id !== window.id) return [current];
              const tabs = current.tabs.filter((each) => each.id !== id);
              if (tabs.length === 0) return [];
              const active = current.active === id ? (tabs[0] as TerminalTab).id : current.active;
              return [{ ...current, tabs, active }];
            }),
          );
        },
        mergeAll: () => {
          setWindows((list) => {
            const all = list.flatMap((current) => current.tabs);
            return [
              {
                ...(list.find((current) => current.id === window.id) as TerminalWindowState),
                tabs: all,
              },
            ];
          });
        },
        returnToDefaultSize: () => {
          const element = document.querySelector<HTMLElement>(
            windows[0]?.id === window.id
              ? '[data-window-id="terminal"]'
              : `[data-window-id="terminal:window-${window.id}"]`,
          );
          const windowId = element?.getAttribute("data-window-id");
          if (windowId && tab) {
            frames.current?.returnToDefaultSize(
              windowId,
              frameOfProfile(shownProfile(settingsNow.current, tab)),
            );
          }
        },
        runCommand: (command) => runCommand(command, tab?.session.scope.cwd),
        openInspector: (pane, focusTitle) =>
          setInspector((current) => ({
            pane,
            focusTitle: (current?.focusTitle ?? 0) + (focusTitle ? 1 : 0),
          })),
        openColorPanel: () => setColorPanelOpen(true),
        makeDefault: () => {
          if (tab) makeDefault(tab);
        },
        importProfile,
        saveGroup: (name) =>
          changeSettings((current) => ({
            ...current,
            groups: [
              ...current.groups.filter((each) => each.name !== name),
              {
                name,
                windows: openWindows.current.map((each) =>
                  each.tabs.map(({ session, profile }) => ({ cwd: session.scope.cwd, profile })),
                ),
              },
            ],
          })),
        openGroup: (group) => {
          const created = group.windows.map((tabs) =>
            createWindow(tabs.map((each) => makeTab(each))),
          );
          if (DesktopWindow) setWindows((list) => [...list, ...created]);
          else {
            changeWindow(window.id, (current) => ({
              ...current,
              tabs: [...current.tabs, ...created.flatMap((each) => each.tabs)],
            }));
          }
        },
        noteKey: () => {
          keyWindow.current = window.id;
          setKeyId(window.id);
        },
      };
    },
    [
      DesktopWindow,
      changeSettings,
      changeTabIn,
      changeWindow,
      closeWindow,
      importProfile,
      makeDefault,
      makeTab,
      runCommand,
      settings,
      windows,
    ],
  );

  // Every session starts, runs what it was given, is kept as it changes, and may close when it ends.
  useEffect(() => {
    openWindows.current = windows;
    const stops: (() => void)[] = [];
    for (const window of windows) {
      for (const tab of window.tabs) {
        const { session } = tab;
        const note = notes.get(session);
        if (note && !note.begun) {
          note.begun = true;
          const profile = shownProfile(settingsNow.current, tab);
          const command =
            note.command ??
            (profile.startupCommand && !note.restored
              ? { command: profile.startupCommand, inShell: profile.startupInShell }
              : undefined);
          void session.start().then(async () => {
            if (note.restored && session.files.available) {
              const folder = await session.files.at(session.scope.cwd).catch(() => undefined);
              if (!folder?.children) session.input("cd ~\r");
            }
            if (command) session.input(lineOf(command));
          });
        }
        const heard = () => {
          saveSoon();
          if (!session.ended || !note || note.ended) return;
          note.ended = true;
          const { whenExits } = shownProfile(settingsNow.current, tab);
          if (
            whenExits === "close" ||
            (whenExits === "close-clean" && session.scope.status === 0)
          ) {
            // Not while the shell is still telling its listeners that it ended.
            queueMicrotask(() => actionsFor(window).closeTab(tab.id));
          }
        };
        stops.push(session.subscribe(heard));
      }
    }
    saveSoon();
    return () => {
      for (const stop of stops) stop();
    };
  }, [actionsFor, saveSoon, windows]);

  const [first, ...others] = windows;
  const firstActions = useMemo(() => actionsFor(first as TerminalWindowState), [actionsFor, first]);
  const inspected = windows.find((window) => window.id === keyId) ?? (first as TerminalWindowState);
  const inspectedTab =
    inspected.tabs.find((each) => each.id === inspected.active) ??
    (inspected.tabs[0] as TerminalTab);
  const inspectedProfile = shownProfile(settings, inspectedTab);

  return (
    <>
      {DesktopWindow ? <FrameCommandsOnDesktop ref={frames} /> : null}
      <TerminateSheet
        pending={quitting}
        anchor={
          typeof document === "undefined"
            ? null
            : document.querySelector('[data-window-id="terminal"]')
        }
        onDone={() => setQuitting(null)}
      />
      <TerminalWindowView
        {...props}
        onClose={onClose ? () => closeWindow((first as TerminalWindowState).id) : undefined}
        model={first as TerminalWindowState}
        actions={firstActions}
      />
      {DesktopWindow
        ? others.map((window) => (
            <FurtherWindow
              key={window.id}
              DesktopWindow={DesktopWindow}
              window={window}
              actions={actionsFor(window)}
            />
          ))
        : null}
      {DesktopWindow && inspector ? (
        <DesktopWindow
          id="inspector"
          title="Inspector"
          panel
          resizable={false}
          defaultSize={{ width: 280, height: 440 }}
          onClose={() => setInspector(null)}
          render={(windowProps) => (
            <TerminalInspector
              windowProps={windowProps}
              session={inspectedTab.session}
              settings={settings}
              profileName={inspectedTab.profile}
              profile={inspectedProfile}
              title={inspectedTab.title}
              pane={inspector.pane}
              onPaneChange={(pane) => setInspector({ ...inspector, pane })}
              focusTitle={inspector.focusTitle}
              onTitleChange={(title) => changeTabIn(inspected.id, inspectedTab.id, { title })}
              onProfileChoose={(profile) =>
                changeTabIn(inspected.id, inspectedTab.id, { profile, changes: {} })
              }
              onTabChange={(change) =>
                changeTabIn(inspected.id, inspectedTab.id, {
                  changes: { ...inspectedTab.changes, ...change },
                })
              }
              onUseAsDefault={() => makeDefault(inspectedTab)}
              onSizeChange={(columns, rows) => {
                const { emulator } = inspectedTab.session;
                const cellWidth = inspectedProfile.fontSize * 0.6;
                const cellHeight = Math.ceil(inspectedProfile.fontSize * 1.18);
                frames.current?.grow(
                  inspected.id === first?.id ? "terminal" : `terminal:window-${inspected.id}`,
                  Math.ceil((columns - emulator.cols) * cellWidth),
                  (rows - emulator.rows) * cellHeight,
                );
              }}
            />
          )}
        />
      ) : null}
      {DesktopWindow && preferencesOpen ? (
        <DesktopWindow
          id="settings"
          title="Preferences"
          isPreferences
          fitsContent
          resizable={false}
          defaultSize={{ width: 680, height: 560 }}
          onClose={() => onPreferencesOpenChange?.(false)}
          render={(windowProps) => (
            <TerminalPreferences
              windowProps={windowProps}
              settings={settings}
              changeSettings={changeSettings}
              tooLong={settingsTooLong}
            />
          )}
        />
      ) : null}
      {colorPanelOpen
        ? createPortal(
            <ColorPanel
              className="mac-terminal-colors"
              value={shownColour(inspectedProfile.background, "#1e1e1e", "#ffffff")}
              onValueChange={(background) =>
                changeTabIn(inspected.id, inspectedTab.id, {
                  changes: { ...inspectedTab.changes, background },
                })
              }
              onClose={() => setColorPanelOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function FurtherWindow({
  DesktopWindow,
  window,
  actions,
}: {
  DesktopWindow: ComponentType<DesktopSecondaryWindowProps>;
  window: TerminalWindowState;
  actions: WindowActions;
}) {
  const tab = (window.tabs.find((each) => each.id === window.active) ??
    window.tabs[0]) as TerminalTab;
  const profile = shownProfile(actions.settings, tab);
  const title = useTitle(tab.session, profile, tab.title);
  const store = useWindowManagerStore();
  // The manager makes a new window key only while the keyboard is in the desktop, and moving a tab
  // out unmounts the text area that had it.
  useEffect(() => {
    const id = secondaryWindowId("terminal", `window-${window.id}`);
    if (window.frame) store.patch(id, { frame: window.frame });
    store.focus(id);
  }, [store, window.id, window.frame]);
  return (
    <DesktopWindow
      id={`window-${window.id}`}
      title={title}
      defaultSize={frameOfProfile(profile)}
      minSize={MIN_FRAME}
      onClose={actions.closeWindow}
      render={(props) => <TerminalWindowView {...props} model={window} actions={actions} />}
    />
  );
}
