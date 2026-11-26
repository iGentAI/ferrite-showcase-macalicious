"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { Desktop } from "macalicious/desktop";
import { DesktopIcon } from "macalicious/desktop-icon";
import { DesktopStack } from "macalicious/desktop-stack";
import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import { DockStack, DockStackItem, DockStackMore } from "macalicious/dock-stack";
import {
  ACCENTS,
  type Accent,
  type Appearance,
  setAccent,
  setAppearance,
} from "macalicious/lib/appearance";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { ManagedWindow } from "macalicious/managed-window";
import { MenuBar } from "macalicious/menu-bar";
import {
  useWindowManager,
  useWindowManagerStore,
  type WindowFrame,
  WindowManager,
  type WindowManagerProps,
} from "macalicious/window-manager";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { followAppLink, onAppLink } from "../app-store/app-store-link";
import { useCalendarAlertWatch } from "../calendar/calendar-alert-watch";
import { FinderDriveAlert, FinderReplace } from "../finder/finder-dialogs";
import { registerFileOpeners, showInFinder } from "../finder/finder-open";
import { FINDER_SHOW_EXTERNAL, FINDER_SHOW_HARD_DISKS } from "../finder/finder-saved";
import { requestPane } from "../system-preferences/pane-request";
import { useMenuClock } from "../system-preferences/panes/date-and-time/menu-clock";
import {
  NO_SHORTCUT,
  NOTIFICATION_CENTER_KEY,
  readShortcutChoice,
} from "../system-preferences/panes/keyboard/notification-center-key";
import darkPicture from "./art/catalina-dark.webp";
import lightPicture from "./art/catalina-light.webp";
import { type DesktopApp, discoveredApps, preferencesWindowId } from "./desktop-apps";
import {
  AppTile,
  DriveIcon,
  FileIcon,
  FinderTile,
  FolderTile,
  MiniWindowTile,
  TrashTile,
} from "./desktop-artwork";
import { DesktopCharacterViewer } from "./desktop-characters";
import { DesktopDictation } from "./desktop-dictation";
import {
  DockAppTile,
  type DockTileRunning,
  dockAppDropProps,
  dockLayout,
  useDockApps,
  useDockAutoHide,
  useDockDrag,
  useDockDrop,
} from "./desktop-dock";
import {
  ACTIVITY_DOCK_ICON,
  ActivityDockIcon,
  readActivityDockMode,
} from "./desktop-dock-activity";
import {
  DOCK_MINIMIZE_INTO_ICON,
  DOCK_RECENTS,
  DockBadge,
  ownDockTile,
  RECENT_TILES,
  useDockBadges,
  useDockBounce,
} from "./desktop-dock-life";
import {
  DockDivider,
  DockDownloads,
  DockFinder,
  DockKept,
  DockTrash,
  useDockKept,
} from "./desktop-dock-places";
import { useDesktopDriveItems } from "./desktop-drive-items";
import { onDesktopEffects } from "./desktop-effects";
import { type DesktopSettings, DesktopSettingsContext, generalApp } from "./desktop-general";
import {
  closeBehind,
  isClosedBehind,
  isFurtherWindow,
  useFollowBehindWindows,
  useFollowHiddenWindows,
  useHiddenIds,
} from "./desktop-hidden";
import { useDesktopLibrary } from "./desktop-library";
import { holdLiveStream, liveState, subscribeLive } from "./desktop-live";
import { takeKeyForModalMenu } from "./desktop-menu-tracking";
import {
  AppleMenu,
  ApplicationMenu,
  appCommands,
  type DesktopAccountMenu,
  FINDER_MENUS,
  menuKeyCommands,
  StatusMenus,
} from "./desktop-menus";
import { useEpisodeWatch } from "./desktop-notifications";
import { onDesktopOverlayRequest, type RequestedOverlay } from "./desktop-overlay-requests";
import { type DesktopOverlay, DesktopOverlays } from "./desktop-overlays";
import {
  appsByRecentUse,
  DesktopAppSwitcher,
  DesktopMissionControl,
  useShowDesktop,
} from "./desktop-overview";
import {
  changeDesktopValue,
  desktopValuesLoaded,
  lastDesktopPicture,
  pictureLayers,
  readBoolean,
  readIds,
  subscribeDesktopPicture,
  subscribeDesktopValues,
  useDesktopSetting,
  useDesktopValue,
  useDockPreferences,
} from "./desktop-personal";
import { HostedPreferences, raiseOwnPreferences } from "./desktop-preferences";
import {
  claimLoginItems,
  DESKTOP_WINDOWS,
  DOCK_OPEN_AT_LOGIN,
  fitFrame,
  holdOwnWindows,
  journaledWindows,
  journalWindows,
  keptWindows,
  readSavedWindows,
  type SavedAppWindow,
  takeQuitWindows,
} from "./desktop-restore";
import { ScreenTimeMeter } from "./desktop-screen-time";
import { servedByDesktopApp } from "./desktop-server";
import { registerTextReceivers, startServices } from "./desktop-services";
import { registerFileReceivers } from "./desktop-share-link";
import {
  asksForSiri,
  COMMAND_TWICE_MS,
  HOLD_COMMAND_SPACE,
  readSiriShortcut,
  SIRI_SHORTCUT_KEY,
} from "./desktop-siri-settings";
import {
  assignmentOf,
  DESKTOP_SPACES,
  MOUSE_BUTTONS,
  matchesShortcut,
  ONE_SPACE,
  readSpaces,
  showsNow,
  spaceKey,
  splitWindowsOf,
  useDesktopSpaces,
  useSpacePictures,
  useWindowShortcuts,
} from "./desktop-spaces";
import {
  DesktopSplitChooser,
  DesktopSplitDivider,
  type SplitView,
  useGreenButton,
  useSplitSwap,
  useSplitView,
} from "./desktop-split-view";
import { noteRecentApp, RECENT_APPS } from "./desktop-system";
import { noteKeyWindowFullScreen } from "./desktop-tabs";
import { DesktopSecondaryWindow, DesktopWindowHostContext } from "./desktop-windows";
import "./desktop.tokens.css";
import "./desktop.css";

/** The height of the menu bar, in points. */
const MENU_BAR = 22;

const NO_SAVED_WINDOWS: readonly SavedAppWindow[] = Object.freeze([]);
const NO_APPS: readonly string[] = Object.freeze([]);

/** Finder as the front application while no window is open. */
const FINDER = { id: "finder", name: "Finder" };

/** Mission Control in Launchpad, as on a Mac: it has no window, and opens the overview instead. */
const MISSION_CONTROL_TILE: DesktopApp = {
  id: "mission-control",
  name: "Mission Control",
  component: () => null,
  defaultSize: { width: 0, height: 0 },
  menus: [],
};
const launchpadWithOverview = (apps: readonly DesktopApp[]) => [...apps, MISSION_CONTROL_TILE];

/** The files of the Downloads stack and of the desktop's stacks: invented names. */
const DOWNLOADS = ["Harbour at Dusk.jpg", "Field Notes.pdf", "Tide Tables.pdf", "Lighthouse.jpg"];
const IMAGES = ["Shoreline.jpg", "Cliffs.jpg"];
const DOCUMENTS = ["Tide Tables.pdf", "Field Notes.pdf"];

export interface CatalinaDesktopProps extends Omit<WindowManagerProps, "insets" | "children"> {
  /**
   * The applications of the desktop: descriptors as every `demos/<app>/app.ts` exports them.
   * @default every demo found in `demos/`
   */
  apps?: readonly DesktopApp[];
  /**
   * The ids of the applications whose windows are open at first.
   * @default []
   */
  defaultOpen?: readonly string[];
  /**
   * The text of the menu bar clock, to pin it. Without it the clock shows the time and keeps it.
   */
  clock?: string;
  /**
   * The name of the logged-in user, in the menu bar and the Apple menu.
   * @default "Stephen"
   */
  userName?: string;
  /**
   * Whether the desktop shows its two stacks under the volumes, as with Use Stacks on.
   * @default true
   */
  stacks?: boolean;
  /**
   * What Lock Screen, Log Out and the fast user switching menu do, when the page signs people
   * in. Without it those menu items do nothing.
   * @default undefined
   */
  account?: DesktopAccountMenu;
}

/**
 * The desktop picture: an original photograph of an island in two lights, the day one under
 * Aqua and the dusk one under Dark Aqua (desktop.css crossfades them with the appearance),
 * until another is named (`desktop-personal.ts`: a Desktop & Screen Saver pane, Photos, or the
 * person's stored choice when the desktop starts). A still look shows one picture in both
 * appearances; a dynamic desktop set to Dynamic follows the browser's clock, checked every minute.
 */
function useDesktopPicture() {
  const detail = useSyncExternalStore(subscribeDesktopPicture, lastDesktopPicture, () => null);
  const [now, setNow] = useState(() => new Date());
  const timed = detail?.look === "time";
  useEffect(() => {
    if (!timed) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [timed]);
  return pictureLayers(detail, { day: lightPicture, night: darkPicture }, now);
}

/**
 * The Catalina desktop as one element: the desktop picture and its icons, the menu bar, the
 * Dock, and the demo applications as windows of the library's window manager. Its root is a
 * `WindowManager` and takes its props; give it a size.
 *
 * The menu bar follows the application of the key window, and Finder while none is open. The
 * appearance and the accent colour chosen in its General preferences are set on the page. The
 * Dock and the desktop picture are the person's (`desktop-personal.ts`): set up in System
 * Preferences or by dragging the Dock's tiles, and kept per account on the desktop served by
 * Ferrite.
 */
export function CatalinaDesktop({
  apps = discoveredApps,
  defaultOpen = [],
  clock,
  userName = "Stephen",
  stacks = true,
  account,
  className,
  onKeyDown,
  onKeyDownCapture,
  ...props
}: CatalinaDesktopProps) {
  // The Preferences command of the front application, which the shell inside the manager
  // knows. Command-comma reaches it here: before the windows for an application whose
  // Preferences the desktop hosts, and after them for one that opens its own.
  const keys = useRef<KeyHandler | null>(null);
  // The desktop brings its own General preferences until a System Preferences demo is hosted:
  // the last application of the Dock, as in the screenshots.
  const all = useMemo(
    () => (apps.some((app) => app.id === generalApp.id) ? apps : [...apps, generalApp]),
    [apps],
  );

  // What an application does for the whole desktop when it starts (see `onDesktopStart`).
  useEffect(() => registerFileOpeners(all), [all]);
  useEffect(() => registerFileReceivers(all), [all]);
  useEffect(() => registerTextReceivers(all), [all]);
  useEffect(startServices, []);
  useEffect(() => {
    const cleanups = all.map((app) => app.onDesktopStart?.());
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  }, [all]);

  const [appearance, setAppearanceState] = useState<Appearance>("auto");
  const [accent, setAccentState] = useState<Accent>("blue");
  // What the page had before the desktop changed it, to put back when the desktop goes.
  const before = useRef<{ appearance: string | null; accent: string | null } | null>(null);

  // The page may already carry an appearance and an accent: read after mount, so that the
  // server's markup and the first client render agree.
  useEffect(() => {
    const page = document.documentElement;
    const pageAppearance = page.getAttribute("data-appearance");
    const pageAccent = page.getAttribute("data-accent") as Accent | null;
    if (pageAppearance === "light" || pageAppearance === "dark") setAppearanceState(pageAppearance);
    if (pageAccent && ACCENTS.includes(pageAccent)) setAccentState(pageAccent);
    return () => {
      const was = before.current;
      if (!was) return;
      for (const [name, value] of [
        ["data-appearance", was.appearance],
        ["data-accent", was.accent],
      ] as const) {
        if (value === null) page.removeAttribute(name);
        else page.setAttribute(name, value);
      }
    };
  }, []);

  const settings = useMemo<DesktopSettings>(() => {
    const remember = () => {
      const page = document.documentElement;
      before.current ??= {
        appearance: page.getAttribute("data-appearance"),
        accent: page.getAttribute("data-accent"),
      };
    };
    return {
      appearance,
      accent,
      setAppearance(next) {
        remember();
        setAppearance(next);
        setAppearanceState(next);
      },
      setAccent(next) {
        remember();
        setAccent(next);
        setAccentState(next);
      },
    };
  }, [appearance, accent]);

  // What a server reply asks the desktop to do (`desktop-effects.ts`): the appearance here,
  // opening an application in the shell.
  useEffect(
    () =>
      onDesktopEffects((effects) => {
        for (const effect of effects) {
          if ("appearance" in effect) settings.setAppearance(effect.appearance);
        }
      }),
    [settings],
  );

  // The space windows keep clear of: the menu bar, and the Dock's edge as the person set it up.
  const dock = useDockPreferences();
  const dockInsets = dockLayout(dock, 1, MENU_BAR).insets;

  return (
    <DesktopSettingsContext value={settings}>
      <WindowManager
        insets={{ top: MENU_BAR, ...dockInsets }}
        className={className ? `mac-desktop-shell ${className}` : "mac-desktop-shell"}
        data-system-arrows=""
        onKeyDownCapture={(event) => {
          onKeyDownCapture?.(event);
          keys.current?.(event, true);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          keys.current?.(event, false);
        }}
        {...props}
      >
        <Shell
          apps={all}
          defaultOpen={defaultOpen}
          clock={clock}
          userName={userName}
          stacks={stacks}
          account={account}
          keys={keys}
        />
      </WindowManager>
    </DesktopSettingsContext>
  );
}

interface OpenApp {
  id: string;
  /**
   * The application of a window the desktop opened beside its main one (File > New Finder Window): its `id` is then
   * `<application>:<n>`. Left out for an application's main window, whose id is the application's.
   */
  app?: string;
  /** Where the window opens; cascaded by the manager when left out. */
  frame?: Partial<WindowFrame>;
  /** What the application asked this window to be (`newWindow` of `desktop-effects.ts`), given to it as `opening`. */
  opening?: unknown;
}

type KeyHandler = (
  event: Pick<
    globalThis.KeyboardEvent,
    | "defaultPrevented"
    | "repeat"
    | "key"
    | "code"
    | "metaKey"
    | "ctrlKey"
    | "altKey"
    | "shiftKey"
    | "preventDefault"
    | "stopPropagation"
  >,
  capture: boolean,
) => void;

interface ShellProps {
  apps: readonly DesktopApp[];
  defaultOpen: readonly string[];
  clock: string | undefined;
  userName: string;
  stacks: boolean;
  account: DesktopAccountMenu | undefined;
  /** Where the shell leaves its handler for the keys that reach the desktop. */
  keys: RefObject<KeyHandler | null>;
}

/** Whether the desktop's element covers the whole page. */
function fillsPage(root: HTMLElement): boolean {
  const page = document.documentElement;
  const { left, top, right, bottom } = root.getBoundingClientRect();
  return left <= 0 && top <= 0 && right >= page.clientWidth && bottom >= page.clientHeight;
}

/** Everything on the desktop. It reads the window manager, so it is rendered inside it. */
function Shell({ apps, defaultOpen, clock, userName, stacks, account, keys }: ShellProps) {
  const manager = useWindowManager();
  const store = useWindowManagerStore();
  const { windows, keyWindowId, fullScreenWindowId, focus } = manager;
  const desktop = useRef<HTMLDivElement>(null);
  const spacesRoot = useCallback(() => desktop.current?.parentElement, []);
  const time = useMenuClock(clock);
  const picture = useDesktopPicture();
  // The person's Dock as set up in System Preferences > Dock.
  const dockPreferences = useDockPreferences();
  // Finder's Preferences: which disks show on the desktop.
  const [showHardDisks] = useDesktopSetting(FINDER_SHOW_HARD_DISKS, readBoolean, true);
  const [showExternal] = useDesktopSetting(FINDER_SHOW_EXTERNAL, readBoolean, true);
  const dockInsets = dockLayout(dockPreferences, 1, MENU_BAR).insets;
  // The apps the Dock and Launchpad show, and Launchpad's order and page: every app, unless the
  // desktop's Ferrite application serves the page (desktop-library.ts).
  const library = useDesktopLibrary(apps);
  // The person's live stream (`desktop-live.ts`: notifications, Do Not Disturb, other browsers' changes) is held for as
  // long as the desktop is, on the desktop served by Ferrite. Its banners live in the menu bar, which is made afresh for
  // each front application (`key={front.id}` below): were they its only holder, every change of application would close
  // the stream (the browser reports the request aborted) and open another with a new ticket.
  const served = servedByDesktopApp();
  useEffect(() => (served ? holdLiveStream() : undefined), [served]);

  // Launchpad, Spotlight or Siri over the windows, one at a time; asking for the one that is
  // showing closes it. Launchpad covers the desktop's element, which is there after mount.
  const [overlay, setOverlay] = useState<DesktopOverlay | null>(null);
  const toggleOverlay = (name: DesktopOverlay) =>
    setOverlay((showing) => (showing === name ? null : name));
  const [screen, setScreen] = useState<HTMLElement | null>(null);
  useEffect(() => onDesktopOverlayRequest((asked) => overlayRequest.current?.(asked)), []);
  useEffect(() => setScreen(desktop.current?.parentElement ?? null), []);
  // Mission Control, or App Exposé with the application it shows; Show Desktop; the switcher.
  const [exposing, setExposing] = useState<string | null>(null);
  const [showingDesktop, setShowingDesktop] = useState(false);
  const [switching, setSwitching] = useState<readonly DesktopApp[] | null>(null);
  const [switchingBack, setSwitchingBack] = useState(false);
  const missionControl = (app: string | null) => {
    setExposing(app);
    setShowingDesktop(false);
    setOverlay((showing) =>
      showing === "mission-control" && exposing === app ? null : "mission-control",
    );
  };
  useShowDesktop(showingDesktop, screen);
  const overlayRequest = useRef<(overlay: RequestedOverlay) => void>(undefined);
  const splitView = useRef<SplitView>(undefined);
  overlayRequest.current = (asked) => {
    if (asked === "mission-control") missionControl(null);
    else if (asked === "tile-left" || asked === "tile-right") {
      if (keyWindowId)
        splitView.current?.start(keyWindowId, asked === "tile-left" ? "left" : "right");
    } else if (asked === "application-windows") missionControl(keyWindow?.app ?? FINDER.id);
    else if (asked === "show-desktop") {
      setShowingDesktop((on) => !on);
      setOverlay(null);
    } else setOverlay(asked);
  };
  // Whether Launchpad was showing when the pointer went down on its Dock tile: a press outside
  // Launchpad closes it, and the click that follows must not show it again. A click that no
  // pointer made (the keyboard, assistive technology) has no press before it, and toggles.
  const pressedOnLaunchpad = useRef(false);
  const toggleLaunchpad = (byPointer: boolean) => {
    if (byPointer) setOverlay(pressedOnLaunchpad.current ? null : "launchpad");
    else toggleOverlay("launchpad");
    pressedOnLaunchpad.current = false;
  };

  const [open, setOpen] = useState<readonly OpenApp[]>(() =>
    defaultOpen.filter((id) => apps.some((app) => app.id === id)).map((id) => ({ id })),
  );
  // The applications whose Preferences are open: a window of the desktop with its frame, or
  // the application's own window, which it renders itself.
  const [preferences, setPreferences] = useState<readonly OpenApp[]>([]);
  // What the two windows of an application that shares its settings were last told.
  const [shared, setShared] = useState<Readonly<Record<string, unknown>>>({});
  // The window that was just asked for: it takes the keyboard focus once it has registered,
  // wherever the command came from (a menu is outside the desktop).
  const [launched, setLaunched] = useState<string>();
  useEffect(() => {
    if (launched && windows.some((window) => window.id === launched)) {
      focus(launched);
      setLaunched(undefined);
    }
  }, [launched, windows, focus]);

  // Where a window opens: at the size asked for, or at what the desktop has room for when it
  // can be resized, centred, a third of the way down the space between the menu bar and the
  // Dock, a step further for each window that is open.
  const place = (
    size: { width: number; height: number },
    flexible: boolean,
    least?: { width: number; height: number },
  ): Partial<WindowFrame> => {
    const room = desktop.current;
    const roomWidth = (room?.clientWidth ?? 0) - dockInsets.left - dockInsets.right;
    const roomHeight = (room?.clientHeight ?? 0) - MENU_BAR - dockInsets.bottom;
    let { width, height } = size;
    if (roomWidth <= 0 || roomHeight <= 0) return { width, height };
    if (flexible) {
      width = Math.min(width, Math.max(least?.width ?? 160, roomWidth - 16));
      height = Math.min(height, Math.max(least?.height ?? 80, roomHeight - 16));
    }
    // The screen wins over a window's own minimum, as AppKit constrains a frame to the visible screen: on a
    // 390-point phone Finder's 720-point minimum otherwise opened it 340 points past the edge.
    width = Math.min(width, Math.max(160, roomWidth - 16));
    height = Math.min(height, Math.max(80, roomHeight - 16));
    const step = (windows.length % 6) * 22;
    const x = dockInsets.left + Math.max(8, Math.round((roomWidth - width) / 2)) + step;
    const y = MENU_BAR + Math.max(8, Math.round((roomHeight - height) / 3)) + step;
    // The cascade stops short of the Dock: a bottom edge under it could not be grabbed to resize.
    return {
      x: Math.max(dockInsets.left + 8, Math.min(x, dockInsets.left + roomWidth - width - 8)),
      y: Math.max(MENU_BAR + 8, Math.min(y, MENU_BAR + roomHeight - height - 8)),
      width,
      height,
    };
  };

  // Ids given out since `open` last changed, by either of the two below: windows asked for at
  // once have ids of their own.
  const givenIds = useRef(new Set<string>());
  // The Dock's hook comes later in this component; a launch only ever runs after it has.
  const bounceOnOpen = useRef<(id: string) => void>(() => {});
  // biome-ignore lint/correctness/useExhaustiveDependencies: `open` says when the ids given out lapse
  useEffect(() => {
    givenIds.current.clear();
  }, [open]);
  const launch = (id: string) => {
    const app = apps.find((candidate) => candidate.id === id);
    if (!app) return;
    if (!open.some((entry) => entry.id === id)) givenIds.current.add(id);
    setShowingDesktop(false);
    // Recent Items of the Apple menu: the apps this account opened, newest first.
    noteRecentApp(id);
    // The application's main window, or another window of it the desktop opened (a second Finder window).
    const existing =
      windows.find((window) => window.id === id) ??
      windows.find((window) => window.app === id && open.some((entry) => entry.id === window.id));
    if (existing) return focus(existing.id);
    bounceOnOpen.current(id);
    // A window the application opens itself comes back through it (Terminal's further windows); a second window the
    // desktop opened comes back here.
    const quitWith = takeQuitWindows(id);
    const room = desktop.current;
    const fitted = <Kept extends SavedAppWindow>(window: Kept): Kept => ({
      ...window,
      ...fitFrame(window, {
        width: room?.clientWidth ?? window.x + window.width,
        height: room?.clientHeight ?? window.y + window.height,
        top: MENU_BAR,
      }),
    });
    holdOwnWindows(
      id,
      quitWith.filter((window) => window.id.startsWith(`${id}:window-`)).map(fitted),
    );
    const kept = quitWith.filter(
      (window) =>
        window.id === id ||
        (app.newWindowTitle !== undefined && !window.id.startsWith(`${id}:window-`)),
    );
    if (kept.length > 0) {
      for (const window of kept) {
        givenIds.current.add(window.id);
        if (window.minimized) minimizing.current.add(window.id);
      }
      setOpen((list) => [
        ...list,
        ...kept
          .filter((window) => !list.some((entry) => entry.id === window.id))
          .map(fitted)
          .map(
            ({ id: windowId, x, y, width, height }): OpenApp => ({
              id: windowId,
              app: windowId === id ? undefined : id,
              frame: { x, y, width, height },
            }),
          ),
      ]);
      setLaunched(kept.at(-1)?.id ?? id);
      return;
    }
    const frame = place(app.defaultSize, app.resizable !== false, app.minSize);
    setOpen((list) => (list.some((entry) => entry.id === id) ? list : [...list, { id, frame }]));
    setLaunched(id);
  };
  // Another window of the application, as Finder's File > New Finder Window opens one: `<app>:<n>`, cascaded from the
  // others, the application's component rendered again, so its state (Finder's folder) is its own.
  const newWindow = (appId: string, opening?: unknown) => {
    const app = apps.find((candidate) => candidate.id === appId);
    if (!app) return;
    const taken = new Set([...open.map((entry) => entry.id), ...givenIds.current]);
    let id = appId;
    for (let n = 2; taken.has(id); n += 1) id = `${appId}:${n}`;
    givenIds.current.add(id);
    setShowingDesktop(false);
    const frame = place(app.defaultSize, app.resizable !== false, app.minSize);
    setOpen((list) => [
      ...list,
      { id, app: appId, frame, ...(opening === undefined ? {} : { opening }) },
    ]);
    setLaunched(id);
  };
  // An application a server reply asks to open (`desktop-effects.ts`): Script Editor's
  // scripts, Automator's workflows and Siri; and another window an application asks for.
  // The latest `launch` and `newWindow` are read when it arrives.
  const launchRef = useRef(launch);
  launchRef.current = launch;
  const newWindowRef = useRef(newWindow);
  newWindowRef.current = newWindow;
  useEffect(
    () =>
      onDesktopEffects((effects) => {
        for (const effect of effects) {
          if ("open" in effect) {
            launchRef.current(effect.open);
            if (effect.place) showInFinder({ place: effect.place });
          }
          if ("newWindow" in effect) newWindowRef.current(effect.newWindow, effect.opening);
        }
      }),
    [],
  );

  // A link to an app's page in the store, on opening the desktop or while it is open: the store
  // shows the page.
  useEffect(() => {
    const follow = () => {
      if (followAppLink()) launchRef.current("app-store");
    };
    follow();
    return onAppLink(follow);
  }, []);

  const closePreferences = (id: string) =>
    setPreferences((list) => list.filter((entry) => entry.id !== id));

  // The Preferences command of an application: its second window on the desktop, opened or
  // brought forward, or the window it renders itself, which needs its main window and which
  // the application brings forward when it is already open.
  const openPreferences = (id: string) => {
    const app = apps.find((candidate) => candidate.id === id);
    const spec = app?.preferences;
    if (!spec) return;
    let frame: Partial<WindowFrame> | undefined;
    if (spec === "own") {
      if (!windows.some((window) => window.id === id)) {
        launch(id);
      } else if (preferences.some((entry) => entry.id === id)) {
        if (!isClosedBehind(id)) focus(id);
        raiseOwnPreferences(id);
        return;
      }
    } else {
      const windowId = preferencesWindowId(id);
      if (windows.some((window) => window.id === windowId)) return focus(windowId);
      frame = place(spec.defaultSize, false);
      setLaunched(windowId);
    }
    setPreferences((list) =>
      list.some((entry) => entry.id === id) ? list : [...list, { id, frame }],
    );
  };

  // An application's main window has closed. Preferences that it renders itself go with it;
  // a Preferences window of the desktop stays, and the application with it.
  const quit = (id: string) => {
    const appId = open.find((entry) => entry.id === id)?.app ?? id;
    const further = windows.some(
      (window) => isFurtherWindow(window.id, appId) && !window.panel && window.id !== id,
    );
    if (further && !isFurtherWindow(id, appId) && !isClosedBehind(id)) {
      closeBehind(id, store.minimize);
      return;
    }
    setOpen((list) => list.filter((entry) => entry.id !== id));
    if (apps.find((candidate) => candidate.id === id)?.preferences === "own") closePreferences(id);
  };

  // Force Quit: every window of the application closes, its Preferences too; the windows it
  // opened through `DesktopWindow` go with its main window.
  const quitApplication = (id: string) => {
    setOpen((list) => list.filter((entry) => (entry.app ?? entry.id) !== id));
    closePreferences(id);
  };
  const quitRef = useRef(quitApplication);
  quitRef.current = quitApplication;
  const closeMain = useRef(quit);
  closeMain.current = quit;
  useFollowBehindWindows(windows, store.minimize, (id) => closeMain.current(id));
  // The banners are remounted with the menu bar when the front application changes; this lasts as the session does.
  const signedIn = useSyncExternalStore(
    subscribeLive,
    () => liveState().ready,
    () => false,
  );
  useEpisodeWatch(served && signedIn && apps.some((app) => app.id === "podcasts"));
  useCalendarAlertWatch(
    served &&
      signedIn &&
      apps.some((app) => app.id === "calendar") &&
      !windows.some((window) => window.app === "calendar"),
  );
  useEffect(
    () =>
      onDesktopEffects((effects) => {
        for (const effect of effects) {
          if ("quit" in effect) quitRef.current(effect.quit);
        }
      }),
    [],
  );

  // The applications running, as Force Quit lists them: those with a window, by name, then
  // Finder, which always runs.
  const runningApplications = (except: string) => {
    const running = new Set(windows.map((window) => window.app));
    const listed = apps
      .filter((app) => running.has(app.id) && app.id !== except && app.id !== FINDER.id)
      .map((app) => ({ id: app.id, name: app.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    return [...listed, { id: FINDER.id, name: FINDER.name, relaunches: true }];
  };

  // A window that sizes itself keeps its place and takes the size it asks for.
  const resize = (id: string, size: { width: number; height: number }) => {
    const frame = store.get(id)?.frame;
    if (!frame || (frame.width === size.width && frame.height === size.height)) return;
    store.patch(id, { frame: { ...frame, width: size.width, height: size.height } });
  };
  // Its callback is the same from one render to the next, so an application that asks for its size in an effect that
  // depends on it (QuickTime Player) asks when what it shows changes, not after every render: a size the person gave
  // the window by dragging an edge is kept.
  const sizers = useRef(new Map<string, (size: { width: number; height: number }) => void>());
  const sizerOf = (id: string) => {
    let sizer = sizers.current.get(id);
    if (!sizer) {
      sizer = (size) => resize(id, size);
      sizers.current.set(id, sizer);
    }
    return sizer;
  };

  // The front application is the key window's; Finder while no window is showing.
  const keyWindow = windows.find((window) => window.id === keyWindowId);
  const keyWindowFullScreen = Boolean(keyWindow?.fullScreen);
  useEffect(() => noteKeyWindowFullScreen(keyWindowFullScreen), [keyWindowFullScreen]);
  const keyApp = apps.find((app) => app.id === keyWindow?.app);
  const frontApp = keyApp?.systemPanel
    ? apps.find((app) => app.id === windows.find((window) => window.state === "main")?.app)
    : keyApp;
  const finderApp = apps.find((app) => app.id === FINDER.id);
  const front = frontApp ?? finderApp ?? FINDER;
  const titles = (frontApp ?? finderApp)?.menus ?? FINDER_MENUS;
  const minimized = windows.filter((window) => window.minimized);

  // The key equivalents of the menu bar's items. Command-comma (Control-comma off Apple platforms) is the front
  // application's Preferences command. An application that opens its own Preferences answers the key itself where it
  // has the focus, so the desktop takes it only when it has not; for one whose Preferences are a window of the desktop,
  // the desktop takes it first. The others the desktop carries out itself (`menuKeyCommands`: Hide, Hide Others, Quit,
  // Close Window, Enter Full Screen, Minimize, Force Quit…, Lock Screen, Log Out) it takes after the windows, so a
  // window that answers one of these keys itself keeps it, as Safari's Command-W closes a tab. A key held down does not
  // repeat a command.
  useEffect(() => {
    keys.current = (event, capture) => {
      if (event.defaultPrevented) return;
      const spec = frontApp?.preferences;
      if (
        frontApp &&
        spec &&
        capture !== (spec === "own") &&
        event.key === "," &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        // Taken before the application's windows: they do not see the key at all.
        if (capture) event.stopPropagation();
        openPreferences(frontApp.id);
        return;
      }
      if (capture || event.repeat) return;
      for (const [equivalent, command] of menuKeyCommands({
        app: front,
        apps,
        manager,
        launch,
        newWindow,
        account,
      })) {
        if (!matchesMenuKeyEquivalent(event, equivalent)) continue;
        // The key is the command's even while its item is dimmed, as in a Mac's menu bar.
        event.preventDefault();
        if (command.enabled) command.run();
        return;
      }
    };
  });

  // With nothing focused (a fresh desktop, after the last window closes, a click on the picture) a key goes to the
  // page's body and never passes the manager's handlers. A desktop that fills the page takes it here, in the handlers'
  // order; a desktop embedded in a page leaves such a key to the page, and any focused element keeps its keys.
  useEffect(() => {
    const unfocused = (event: globalThis.KeyboardEvent) => {
      const page = document.documentElement;
      const root = desktop.current?.parentElement;
      if ((event.target !== document.body && event.target !== page) || !root) return;
      if (root.closest("[inert]") || !fillsPage(root)) return;
      keys.current?.(event, true);
      keys.current?.(event, false);
    };
    document.addEventListener("keydown", unfocused);
    return () => document.removeEventListener("keydown", unfocused);
  }, [keys]);

  // The keys of the windows as a whole: on a Mac the operating system takes the real ones, which are
  // bound for wherever a page does get them, so each has one that works in every browser too.
  // Mission Control: F3 or Control-Up. App Exposé: Control-Down. Show Desktop: Command-F3, F11 on a
  // Mac, or Control-Option-D. The switcher: Option-Tab or Option-`. System Preferences > Mission
  // Control chooses the bound ones.
  const windowShortcuts = useWindowShortcuts();
  const siriShortcut = useDesktopValue(SIRI_SHORTCUT_KEY, readSiriShortcut, HOLD_COMMAND_SPACE);
  const leftCommandAt = useRef(Number.NEGATIVE_INFINITY);
  const notificationCenterKey = useDesktopValue(
    NOTIFICATION_CENTER_KEY,
    readShortcutChoice,
    NO_SHORTCUT,
  );
  const windowKeys = useRef<(event: globalThis.KeyboardEvent) => void>(undefined);
  windowKeys.current = (event) => {
    if (event.defaultPrevented || desktop.current?.closest("[inert]")) return;
    const root = desktop.current?.parentElement;
    // A key pressed outside a desktop embedded in a page is the page's. On a desktop that fills the
    // page, every key is the desktop's: its menus and popups render elsewhere in the document.
    if (!root) return;
    if (!(event.target instanceof Node && root.contains(event.target)) && !fillsPage(root)) return;
    const command = event.metaKey || event.ctrlKey;
    const siriOff = document.documentElement.hasAttribute("data-mac-siri-off");
    const leftCommand = event.code === "MetaLeft" && !event.repeat;
    const secondCommand = leftCommand && event.timeStamp - leftCommandAt.current < COMMAND_TWICE_MS;
    if (leftCommand) leftCommandAt.current = event.timeStamp;
    if (!siriOff && asksForSiri(event, siriShortcut, secondCommand)) {
      event.preventDefault();
      event.stopPropagation();
      setOverlay("siri");
      return;
    }
    let run: (() => void) | undefined;
    const asked = spaceKey(event, /Mac/.test(navigator.platform));
    if (asked) {
      run = () => spaces.press(asked);
    } else if (
      event.code === "Space" &&
      !event.shiftKey &&
      !event.metaKey &&
      event.ctrlKey &&
      (event.altKey || !/Mac/.test(navigator.platform))
    ) {
      // Spotlight's key where a page gets it, and Control-Option-Space where the system takes it.
      // Held down, it stands in for Hold Command Space, which the system keeps on a Mac.
      if (event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        if (!siriOff && siriShortcut === HOLD_COMMAND_SPACE) setOverlay("siri");
        return;
      }
      run = () => setOverlay((showing) => (showing === "spotlight" ? null : "spotlight"));
    } else if (
      event.key === "F3" &&
      event.ctrlKey &&
      (/Mac/.test(navigator.platform) ? !event.shiftKey : event.shiftKey)
    ) {
      // Control-F3 on a Mac; Control is Command elsewhere, so Control-Shift-F3 there.
      run = () =>
        root
          .querySelector<HTMLElement>('[role="toolbar"][aria-label="Dock"] [tabindex="0"]')
          ?.focus();
    } else if (
      (event.key === "F3" && command) ||
      (event.ctrlKey && event.altKey && event.code === "KeyD") ||
      matchesShortcut(windowShortcuts.showDesktop, event)
    ) {
      run = () => {
        setShowingDesktop((on) => !on);
        setOverlay((showing) => (showing === "mission-control" ? null : showing));
      };
    } else if (event.key === "F3" || matchesShortcut(windowShortcuts.missionControl, event)) {
      run = () => missionControl(null);
    } else if (
      event.key === "F4" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      run = () => toggleLaunchpad(false);
    } else if (matchesShortcut(windowShortcuts.applicationWindows, event)) {
      run = () => missionControl(keyWindow?.app ?? FINDER.id);
    } else if (matchesShortcut(notificationCenterKey, event)) {
      run = () => toggleOverlay("notification-center");
    } else if (
      switching === null &&
      event.altKey &&
      !event.metaKey &&
      (event.key === "Tab" || event.code === "Backquote")
    ) {
      run = () => {
        setSwitchingBack(event.shiftKey);
        setSwitching(appsByRecentUse(windows, apps));
      };
    }
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) run();
  };
  useEffect(() => {
    // On a Mac, Photos uses Control-number for its library sections. Off a Mac, Control is
    // also Command: arrows (Music's Next) and Control-Option numbers (Mail's flags) are the
    // application's first. Unclaimed keys still reach Spaces; Control-Option numbers on a
    // Mac remain the desktop's explicit shortcut.
    const onMac = /Mac/.test(navigator.platform);
    const applicationsFirst = (event: globalThis.KeyboardEvent) =>
      event.ctrlKey &&
      !event.shiftKey &&
      !event.metaKey &&
      (onMac
        ? !event.altKey && /^Digit[1-9]$/.test(event.code)
        : event.altKey
          ? /^Digit[1-9]$/.test(event.code)
          : event.key.startsWith("Arrow"));
    // No application is in front of Mission Control, and its dialog keeps arrow keys from the window.
    const inMissionControl = ({ target }: globalThis.KeyboardEvent) =>
      target instanceof Element && target.closest(".mac-desktop-shell-mission-control") !== null;
    const after = (event: globalThis.KeyboardEvent) => {
      window.removeEventListener("keydown", after);
      windowKeys.current?.(event);
    };
    const before = (event: globalThis.KeyboardEvent) => {
      if (takeKeyForModalMenu(event)) return;
      // Added afresh for each key, so that it comes after every other listener on the window,
      // whenever those were added: an application's window opens long after this desktop.
      window.removeEventListener("keydown", after);
      if (applicationsFirst(event) && !inMissionControl(event)) {
        window.addEventListener("keydown", after);
      } else windowKeys.current?.(event);
    };
    window.addEventListener("keydown", before, true);
    return () => {
      window.removeEventListener("keydown", before, true);
      window.removeEventListener("keydown", after);
    };
  }, []);

  // The mouse's other buttons, as System Preferences > Mission Control binds them.
  // The browser's own use of them (back, forward, scrolling, a new tab from a link) gives way only
  // to a button that is bound.
  const windowMouse = useRef<(event: globalThis.MouseEvent) => void>(undefined);
  windowMouse.current = (event) => {
    const button = MOUSE_BUTTONS[event.button];
    const root = desktop.current?.parentElement;
    if (!button || !root || desktop.current?.closest("[inert]")) return;
    // As for a key: outside a desktop embedded in a page, the button is the page's.
    if (!(event.target instanceof Node && root.contains(event.target)) && !fillsPage(root)) return;
    const run =
      button === windowShortcuts.showDesktopMouse
        ? () => {
            setShowingDesktop((on) => !on);
            setOverlay((showing) => (showing === "mission-control" ? null : showing));
          }
        : button === windowShortcuts.missionControlMouse
          ? () => missionControl(null)
          : button === windowShortcuts.applicationWindowsMouse
            ? () => missionControl(keyWindow?.app ?? FINDER.id)
            : undefined;
    if (!run) return;
    event.preventDefault();
    if (event.type === "mousedown") run();
  };
  useEffect(() => {
    const listen = (event: globalThis.MouseEvent) => windowMouse.current?.(event);
    window.addEventListener("mousedown", listen, true);
    window.addEventListener("mouseup", listen, true);
    window.addEventListener("auxclick", listen, true);
    return () => {
      window.removeEventListener("mousedown", listen, true);
      window.removeEventListener("mouseup", listen, true);
      window.removeEventListener("auxclick", listen, true);
    };
  }, []);

  // A full-screen window covers the menu bar and the Dock while it is key; they are then out
  // of reach of the keyboard as well. As on a Mac, the pointer at the top edge of the screen brings the menu bar in over
  // the window (a strip there takes it): the bar stays while the pointer is on it or one of its menus is open, and goes
  // once the pointer moves down past it.
  const spacesNow = useDesktopValue(DESKTOP_SPACES, readSpaces, ONE_SPACE);
  const activityDockMode = useDesktopValue(ACTIVITY_DOCK_ICON, readActivityDockMode, "app");
  const splitShowing = splitWindowsOf(spacesNow.current) !== undefined;
  useEffect(() => {
    screen?.toggleAttribute("data-split-view", splitShowing);
  }, [screen, splitShowing]);
  const covered = fullScreenWindowId !== undefined || splitShowing;
  const [barCalled, setBarCalled] = useState(false);
  const revealed = covered && barCalled;
  const edge = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!covered) setBarCalled(false);
  }, [covered]);
  useEffect(() => {
    if (!revealed) return;
    const top = edge.current?.getBoundingClientRect().top ?? 0;
    const away = (event: globalThis.PointerEvent) => {
      if (
        event.clientY > top + MENU_BAR + 4 &&
        !document.querySelector('[role="menu"][data-open]')
      ) {
        setBarCalled(false);
      }
    };
    document.addEventListener("pointermove", away);
    return () => document.removeEventListener("pointermove", away);
  }, [revealed]);
  // The Dock's apps: those the person keeps there, in their order, then any other app that has a
  // window open, for as long as it runs.
  const installedIds = useMemo(
    () => library.installed.filter((app) => app.id !== FINDER.id).map((app) => app.id),
    [library.installed],
  );
  const dockApps = useDockApps(installedIds);
  const byId = (id: string) => library.installed.find((app) => app.id === id);
  const docked = dockApps.docked.flatMap((id) => byId(id) ?? []);
  const showRecents = useDesktopValue(DOCK_RECENTS, readBoolean, true);
  const recentIds = useDesktopValue(RECENT_APPS, readIds, NO_APPS);
  // Applications opened lately that the Dock does not keep, running or not: a section of their own.
  const recentTiles = showRecents
    ? recentIds
        .flatMap((id) => byId(id) ?? [])
        .filter((app) => app.id !== FINDER.id && !dockApps.docked.includes(app.id))
        .slice(0, RECENT_TILES)
    : [];
  const runningElsewhere = apps.filter(
    (app) =>
      app.id !== FINDER.id &&
      !dockApps.docked.includes(app.id) &&
      !recentTiles.includes(app) &&
      windows.some((window) => window.app === app.id),
  );
  const autoHide = useDockAutoHide(dockPreferences.autohide, dockPreferences.position);
  const intoIcon = useDesktopValue(DOCK_MINIMIZE_INTO_ICON, readBoolean, false);
  const hiddenIds = useHiddenIds();
  const minimizedTiles = intoIcon
    ? []
    : minimized.filter((window) => !hiddenIds.includes(window.id) && !isClosedBehind(window.id));
  const minimizedInto = (id: string) =>
    intoIcon &&
    minimized.some(
      (window) => window.app === id && !hiddenIds.includes(window.id) && !isClosedBehind(window.id),
    );
  const dockBounce = useDockBounce(front.id);
  bounceOnOpen.current = dockBounce.opened;
  const dockBadges = useDockBadges();
  const drag = useDockDrag(dockApps, dockPreferences.position, (on) => autoHide.hold("drag", on));
  const dockDrop = useDockDrop((name) => {
    const app = apps.find((each) => each.name === name);
    if (app) dockApps.keep(app.id);
  });
  const siri = servedByDesktopApp();
  // Tiles shrink from the chosen size so that the Dock fits the desktop: its length less the
  // shelf's ends, over the number of tiles, a separator counting as half of one
  // (`dockLayout`).
  const dockKept = useDockKept(servedByDesktopApp());
  const tiles =
    docked.length +
    runningElsewhere.length +
    recentTiles.length +
    minimizedTiles.length +
    dockKept.length +
    4.5 +
    (siri ? 2 : 0);
  // The Dock stays in front of Launchpad, as on a Mac: one layer above Launchpad's own, which
  // is its `--mac-launchpad-layer` hook (950 unless a page sets it).
  const dockStyle = {
    ...dockLayout(dockPreferences, tiles, MENU_BAR).style,
    zIndex:
      overlay === "launchpad"
        ? "calc(var(--mac-launchpad-layer, 950) + 1)"
        : overlay === "mission-control"
          ? "calc(var(--mac-mission-control-layer, 890) + 1)"
          : undefined,
  } as CSSProperties;
  const dockMenuSide =
    dockPreferences.position === "bottom"
      ? "top"
      : dockPreferences.position === "left"
        ? "right"
        : "left";
  // What the tile of the application `id` offers while it runs.
  const runningOf = (id: string): DockTileRunning => {
    const commands = appCommands({ id }, manager);
    return {
      windows: commands.own,
      focus,
      hide: commands.hide.run,
      hideOthers: commands.hideOthers.run,
      quit: id === FINDER.id ? undefined : commands.quit.run,
      forceQuit: id === FINDER.id ? undefined : () => quitApplication(id),
      showAll: () => missionControl(id),
    };
  };

  // The windows that were open come back once the person's settings have, each where it was, and
  // then what opens at login. From then on the windows are kept as they change.
  const settingsLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  const restoring = useRef<ReadonlySet<string> | null>(served ? new Set() : null);
  const windowsComing = useCallback(() => restoring.current !== null, []);
  const spaces = useDesktopSpaces(
    store,
    windows,
    !served || settingsLoaded,
    spacesRoot,
    windowsComing,
  );
  const split = useSplitView(store, spaces, windows, screen);
  splitView.current = split;
  useGreenButton(screen, split.start, spaces);
  useSplitSwap(screen, spaces, split);
  const spacePicture = useSpacePictures(
    spaces.state.current,
    spaces.state.spaces,
    !served || settingsLoaded,
  );
  const savedWindows = useDesktopValue(DESKTOP_WINDOWS, readSavedWindows, NO_SAVED_WINDOWS);
  const [openAtLogin, setOpenAtLogin] = useDesktopSetting(DOCK_OPEN_AT_LOGIN, readIds, NO_APPS);
  const [restored, setRestored] = useState(false);
  const minimizing = useRef(new Set<string>());
  useEffect(() => {
    if (!served || !settingsLoaded || restored) return;
    setRestored(true);
    const room = desktop.current;
    const wanted = (journaledWindows(userName) ?? savedWindows).filter(
      ({ app }) => app !== "force-quit" && apps.some((candidate) => candidate.id === app),
    );
    for (const { id, minimized } of wanted) if (minimized) minimizing.current.add(id);
    restoring.current = new Set(wanted.map(({ id }) => id));
    setOpen((list) => [
      ...list,
      ...wanted
        .filter(({ id }) => !list.some((entry) => entry.id === id))
        .map(
          ({ id, app, ...frame }): OpenApp => ({
            id,
            app: id === app ? undefined : app,
            frame: fitFrame(frame, {
              width: room?.clientWidth ?? frame.x + frame.width,
              height: room?.clientHeight ?? frame.y + frame.height,
              top: MENU_BAR,
            }),
          }),
        ),
    ]);
    if (claimLoginItems(userName)) for (const id of openAtLogin) launch(id);
    const front = wanted
      .filter(({ id, app, minimized }) => !minimized && showsNow(spaces.state, id, app))
      .at(-1);
    if (front) setLaunched(front.id);
  });
  useFollowHiddenWindows(
    windows,
    manager.focus,
    !served || (restored && restoring.current === null),
    (id) => minimizing.current.has(id),
  );
  useEffect(() => {
    for (const { id } of windows) {
      if (minimizing.current.delete(id)) manager.minimize(id);
    }
  });
  const windowsWritten = useRef("[]");
  const windowsNow = JSON.stringify(
    keptWindows(
      windows.flatMap((window) => {
        const frame = store.get(window.id)?.frame;
        if (!frame || !open.some((entry) => entry.id === window.id) || isClosedBehind(window.id))
          return [];
        return [
          {
            id: window.id,
            app: window.app,
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
            ...(window.minimized ? { minimized: true } : {}),
          },
        ];
      }),
    ),
  );
  useEffect(() => {
    if (!served || !restored) return;
    // Until each window that comes back has registered, what shows is no change of the person's.
    if (restoring.current) {
      const waiting = restoring.current;
      if ([...waiting].some((id) => !windows.some((window) => window.id === id))) return;
      restoring.current = null;
    }
    if (windowsWritten.current === windowsNow) return;
    windowsWritten.current = windowsNow;
    journalWindows(userName, JSON.parse(windowsNow));
    changeDesktopValue(DESKTOP_WINDOWS, JSON.parse(windowsNow));
  }, [served, restored, windowsNow, userName, windows]);

  const appTile = (app: DesktopApp, kept: boolean) => (
    <DockAppTile
      key={app.id}
      id={app.id}
      data-dock-target={app.id}
      label={app.name}
      icon={
        <>
          {app.id === "activity-monitor" &&
          activityDockMode !== "app" &&
          windows.some((window) => window.app === app.id) ? (
            <ActivityDockIcon mode={activityDockMode} />
          ) : (
            (ownDockTile(app.id) ?? <AppTile id={app.id} name={app.name} />)
          )}
          {minimizedInto(app.id) ? (
            <span className="mac-desktop-shell-tile-minimized" data-minimized-into="">
              <MiniWindowTile app={app.id} />
            </span>
          ) : null}
        </>
      }
      running={windows.some((window) => window.app === app.id)}
      bouncing={dockBounce.bouncing.has(app.id)}
      docked={kept}
      position={dockPreferences.position}
      dragging={drag.dragging}
      onOpen={() => launch(app.id)}
      onKeepChange={(keep) => (keep ? dockApps.keep(app.id) : dockApps.remove(app.id))}
      onMenuOpenChange={(menu) => autoHide.hold(`menu:${app.id}`, menu)}
      tileProps={kept ? drag.tileProps(app.id) : undefined}
      runningApp={runningOf(app.id)}
      openAtLogin={served ? openAtLogin.includes(app.id) : undefined}
      onOpenAtLoginChange={
        served
          ? (on) =>
              setOpenAtLogin(
                on
                  ? [...openAtLogin, app.id]
                  : openAtLogin.filter((candidate) => candidate !== app.id),
              )
          : undefined
      }
      onShowInFinder={served ? () => showInFinder({ place: "/Applications" }) : undefined}
      assignTo={{
        value: assignmentOf(spaces.state, app.id),
        onChange: (choice) => spaces.assignApp(app.id, choice),
      }}
    >
      <DockBadge count={dockBadges.get(app.id)} />
    </DockAppTile>
  );

  // The icons on the desktop: the disks, then the person's Desktop folder on a served desktop, or
  // the docs desktop's stand-in stacks.
  const driveItems = useDesktopDriveItems(desktop, () => {
    requestPane("desktop-and-screen-saver");
    launch("system-preferences");
  });
  const desktopSurface = (
    <Desktop
      ref={desktop}
      className="mac-desktop-shell-desktop"
      value={driveItems.shown ? driveItems.value : undefined}
      onValueChange={driveItems.shown ? driveItems.onValueChange : undefined}
      // A press on the desktop makes Finder front: no window is key until the next is chosen.
      onPointerDownCapture={store.rest}
      {...driveItems.surface.attributes}
      picture={
        <span className="mac-desktop-shell-picture">
          <img src={picture.day} alt="" draggable={false} />
          <img
            className="mac-desktop-shell-picture-night"
            src={picture.night}
            alt=""
            draggable={false}
          />
        </span>
      }
      style={
        {
          "--mac-desktop-inset-top": `${MENU_BAR}px`,
          "--mac-desktop-inset-bottom": `${dockInsets.bottom}px`,
          "--mac-desktop-picture": "var(--mac-desktop-shell-picture)",
          ...driveItems.surface.style,
        } as CSSProperties
      }
    >
      {showHardDisks ? (
        <DesktopIcon icon={<DriveIcon />} onOpen={() => showInFinder({ place: "/" })}>
          Macintosh SSD
        </DesktopIcon>
      ) : null}
      {showExternal ? (
        <DesktopIcon
          icon={<DriveIcon external />}
          onOpen={() => {
            requestPane("time-machine");
            launch("system-preferences");
          }}
        >
          Time Machine
        </DesktopIcon>
      ) : null}
      {driveItems.shown ? (
        <>
          {driveItems.icons}
          {driveItems.overlay}
        </>
      ) : stacks ? (
        <>
          <DesktopStack label="Images" thumbnail={<FileIcon hue={28} kind="image" />}>
            {IMAGES.map((name, index) => (
              <DesktopIcon key={name} icon={<FileIcon hue={28 + index * 150} kind="image" />}>
                {name}
              </DesktopIcon>
            ))}
          </DesktopStack>
          <DesktopStack label="PDF Documents" thumbnail={<FileIcon hue={350} kind="pdf" />}>
            {DOCUMENTS.map((name) => (
              <DesktopIcon key={name} icon={<FileIcon hue={350} kind="pdf" />}>
                {name}
              </DesktopIcon>
            ))}
          </DesktopStack>
        </>
      ) : null}
    </Desktop>
  );

  return (
    <>
      <MenuBar
        // A fresh menu bar for each front application: its menus are the application's, and one that was open when the
        // application changed (Minimize, Hide, an application opened from a menu) is gone without telling Base UI's
        // menubar, which would then open menus on hover and turn the next click on a title into a close.
        key={front.id}
        className="mac-desktop-shell-menu-bar"
        modal={false}
        inert={covered && !revealed}
        data-revealed={revealed ? "" : undefined}
        extras={
          <StatusMenus
            clock={time}
            userName={userName}
            launch={launch}
            overlay={overlay}
            onOverlay={toggleOverlay}
            account={account}
          />
        }
      >
        <AppleMenu apps={apps} launch={launch} userName={userName} account={account} />
        {titles.map((title, index) => (
          <ApplicationMenu
            key={`${front.id}/${title}`}
            app={front}
            title={title}
            first={index === 0}
            apps={apps}
            manager={manager}
            launch={launch}
            newWindow={newWindow}
            openPreferences={openPreferences}
          />
        ))}
      </MenuBar>
      {covered ? (
        <div
          ref={edge}
          className="mac-desktop-shell-menu-bar-edge"
          data-revealed={revealed ? "" : undefined}
          aria-hidden="true"
          onPointerEnter={() => setBarCalled(true)}
        />
      ) : null}
      {driveItems.shown ? (
        <ContextualMenu>
          <ContextualMenuTrigger
            onContextMenu={(event) => driveItems.onContextMenu(event.target)}
            render={desktopSurface}
          />
          <ContextualMenuPopup>{driveItems.menu}</ContextualMenuPopup>
        </ContextualMenu>
      ) : (
        desktopSurface
      )}
      <FinderDriveAlert message={driveItems.failure} onClose={driveItems.clearFailure} />
      <FinderReplace
        item={driveItems.replacing?.node ?? null}
        moving={driveItems.replacing?.moving}
        onKeepBoth={() => driveItems.replacing?.answer("keep")}
        onStop={() => driveItems.replacing?.answer("stop")}
        onReplace={() => driveItems.replacing?.answer("replace")}
      />
      {driveItems.viewOptions}
      {open.map(({ id, app: appId = id, frame, opening }) => {
        const app = apps.find((candidate) => candidate.id === appId);
        if (!app) return null;
        const App = app.component;
        const spec = app.preferences;
        // What an application is given besides the props of its window, by what its
        // descriptor says of it. What belongs to the application (its Preferences, its shared settings) is the
        // application's, whichever of its windows this is.
        const extra: Record<string, unknown> = {};
        if (opening !== undefined) extra.opening = opening;
        if (app.sizesItself) extra.onFrameSizeChange = sizerOf(id);
        if (spec === "own") {
          extra.preferencesOpen = preferences.some((entry) => entry.id === appId);
          extra.onPreferencesOpenChange = (isOpen: boolean) =>
            isOpen ? openPreferences(appId) : closePreferences(appId);
        } else if (spec?.sharesSettings) {
          extra.settings = shared[appId];
        }
        if (app.windows) extra.DesktopWindow = DesktopSecondaryWindow;
        if (app.managesApplications) {
          extra.runningApplications = runningApplications(appId);
          extra.onQuitApplication = quitApplication;
        }
        const host = {
          app: appId,
          stage: () => desktop.current?.closest(".mac-window-manager") ?? null,
          place,
          launch,
        };
        return (
          <ManagedWindow
            key={id}
            id={id}
            app={appId}
            title={app.name}
            resizable={app.resizable ?? true}
            panel={app.systemPanel || app.floats}
            zoomButton={app.zoomButton}
            minWidth={app.minSize?.width}
            minHeight={app.minSize?.height}
            defaultFrame={frame ?? app.defaultSize}
            open
            onOpenChange={(isOpen) => {
              if (!isOpen) quit(id);
            }}
            render={(windowProps) => (
              <DesktopWindowHostContext value={host}>
                <App {...windowProps} {...extra} />
              </DesktopWindowHostContext>
            )}
          />
        );
      })}
      {preferences.map(({ id, frame }) => {
        const app = apps.find((candidate) => candidate.id === id);
        const spec = app?.preferences;
        if (!app || !spec || spec === "own") return null;
        const windowId = preferencesWindowId(id);
        return (
          <ManagedWindow
            key={windowId}
            id={windowId}
            app={id}
            title={spec.title ?? `${app.name} Preferences`}
            resizable={false}
            defaultFrame={frame ?? spec.defaultSize}
            onOpenChange={(isOpen) => {
              if (!isOpen) closePreferences(id);
            }}
            render={(windowProps) => (
              <HostedPreferences
                id={windowId}
                component={spec.component}
                windowProps={windowProps}
                shared={
                  spec.sharesSettings
                    ? {
                        settings: shared[id],
                        onSettingsChange: (next) => setShared((all) => ({ ...all, [id]: next })),
                      }
                    : undefined
                }
              />
            )}
          />
        );
      })}
      {served ? <ScreenTimeMeter app={front.id} /> : null}
      <DesktopOverlays
        overlay={overlay}
        onOverlayChange={setOverlay}
        apps={library.installed}
        launchpadApps={served ? launchpadWithOverview(library.launchpad) : library.launchpad}
        page={library.page}
        onPageChange={library.setPage}
        onMove={(id, index) => {
          if (id !== MISSION_CONTROL_TILE.id) library.move(id, index);
        }}
        launch={(id) => {
          if (id === MISSION_CONTROL_TILE.id) requestAnimationFrame(() => missionControl(null));
          else launch(id);
        }}
        container={screen}
      />
      <DesktopMissionControl
        open={overlay === "mission-control"}
        app={exposing}
        windows={windows}
        apps={apps}
        frameOf={(id) => store.get(id)?.frame}
        container={screen}
        onOpenChange={(next) => setOverlay(next ? "mission-control" : null)}
        onChoose={focus}
        spaces={spaces}
        picture={picture.day}
        pictureOf={spacePicture}
      />
      <DesktopAppSwitcher
        apps={switching}
        backwards={switchingBack}
        onClose={() => setSwitching(null)}
        onChoose={launch}
        onHide={(id) => appCommands({ id }, manager).hide.run()}
        onQuit={(id) => appCommands({ id }, manager).quit.run()}
        onExpose={(id) => missionControl(id)}
      />
      {autoHide.edge}
      <DesktopSplitDivider split={split} />
      <DesktopSplitChooser split={split} windows={windows} apps={apps} />
      <DesktopCharacterViewer />
      <DesktopDictation />
      <Dock
        ref={dockDrop}
        {...dockAppDropProps(dockApps.keep)}
        inert={covered}
        style={dockStyle}
        position={dockPreferences.position}
        magnification={dockPreferences.magnification}
        className="mac-desktop-shell-dock"
        {...autoHide.dockProps}
      >
        {/* Finder and Launchpad join the session's apps once the server has said which those are:
            by then the browser holds the session's cookie (desktop-server.ts, sessionFetch). */}
        {library.ready && (
          <>
            {served ? (
              <DockFinder
                menuSide={dockMenuSide}
                running={runningOf(FINDER.id)}
                onOpen={() => launch(FINDER.id)}
                onNewWindow={() => newWindow(FINDER.id)}
                onMenuOpenChange={(menu) => autoHide.hold("menu:finder", menu)}
              />
            ) : (
              <DockItem
                label="Finder"
                icon={<FinderTile />}
                running
                onClick={() => launch(FINDER.id)}
              />
            )}
            <DockItem
              label="Launchpad"
              icon={<AppTile id="launchpad" name="Launchpad" />}
              onPointerDown={() => {
                pressedOnLaunchpad.current = overlay === "launchpad";
              }}
              onClick={(event) => toggleLaunchpad(event.detail > 0)}
            />
            {/* Siri answers on the desktop served by Ferrite (desktop-siri.tsx). */}
            {siri ? (
              <DockItem
                label="Siri"
                icon={<AppTile id="siri" name="Siri" />}
                onClick={() => toggleOverlay("siri")}
              />
            ) : null}
            {served ? (
              <DockItem
                label="Mission Control"
                title="Mission Control: F3 or Control-Up Arrow"
                icon={<AppTile id="mission-control" name="Mission Control" />}
                onClick={() => missionControl(null)}
              />
            ) : null}
          </>
        )}
        {docked.map((app) => appTile(app, true))}
        {runningElsewhere.map((app) => appTile(app, false))}
        {recentTiles.length > 0 ? <DockSeparator /> : null}
        {recentTiles.map((app) => appTile(app, false))}
        {served ? (
          <DockDivider onMenuOpenChange={(menu) => autoHide.hold("menu:divider", menu)} />
        ) : (
          <DockSeparator />
        )}
        {minimizedTiles.map((window) => (
          <DockItem
            key={window.id}
            label={window.title}
            aria-label={`${window.title}, minimized window`}
            icon={<MiniWindowTile app={window.app} />}
            onClick={() => focus(window.id)}
          />
        ))}
        {served ? (
          <>
            <DockKept entries={dockKept} />
            <DockDownloads />
            <DockTrash menuSide={dockMenuSide} />
          </>
        ) : (
          <>
            <DockStack label="Downloads" icon={<FolderTile />}>
              <DockStackMore>7 More in Finder</DockStackMore>
              {DOWNLOADS.map((name, index) => (
                <DockStackItem key={name} icon={<FileIcon hue={200 + index * 70} />}>
                  {name}
                </DockStackItem>
              ))}
            </DockStack>
            <DockItem label="Trash" icon={<TrashTile />} data-dock-target="trash" />
          </>
        )}
      </Dock>
    </>
  );
}
