"use client";

import { MenuBarMenu } from "macalicious/menu-bar";
import { MenuBarExtra, MenuBarExtraMenu, MenuBarExtras } from "macalicious/menu-bar-extra";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import type { ManagedWindowInfo, WindowManagerApi } from "macalicious/window-manager";
import { type ReactNode, useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { openFile } from "../finder/finder-open";
import { HelpMenuSearch, useHelpMenuRows } from "../help-viewer/help-menu-search";
import { KEYCHAIN_MENU_BAR_STATUS, useKeychainUnlocked } from "../keychain-access/keychain-status";
import { HOME_PLACE, SPOTLIGHT_PLACE } from "../spotlight/spotlight-place";
import { requestPane } from "../system-preferences/pane-request";
import { AccessibilityExtra } from "../system-preferences/panes/accessibility/accessibility-extra";
import { AnalogMenuClock } from "../system-preferences/panes/date-and-time/analog-menu-clock";
import { useAnalogMenuClock } from "../system-preferences/panes/date-and-time/menu-clock";
import { ASK_TO_KEEP_KEY } from "../system-preferences/panes/general/document-settings";
import { ViewersMenuExtra } from "../system-preferences/panes/keyboard/viewers-extra";
import { VolumeMenuExtra } from "../system-preferences/panes/sound/volume-extra";
import { useDesktopAppMenuItems } from "./desktop-app-menus";
import { requestAppQuit } from "./desktop-app-quit";
import type { DesktopApp } from "./desktop-apps";
import {
  BatteryGlyph,
  LockGlyph,
  MarkGlyph,
  NotificationCenterGlyph,
  SiriGlyph,
  SpotlightGlyph,
  TimeMachineGlyph,
} from "./desktop-artwork";
import { toggleCharacterViewer } from "./desktop-characters";
import { DictationRow } from "./desktop-dictation";
import { useOptionKey } from "./desktop-dock";
import { driveAvailable, useDrive } from "./desktop-files";
import { requestHelp } from "./desktop-help";
import { hiddenWindows, hideWindows, isClosedBehind, quickLookAlone } from "./desktop-hidden";
import { liveState, setDoNotDisturb, subscribeLive } from "./desktop-live";
import {
  AirPlayMenu,
  BluetoothMenu,
  ClockViewRows,
  NetworkMenu,
  ScriptMenu,
  useExtrasOrder,
} from "./desktop-menu-extras";
import { DesktopNotificationBanners } from "./desktop-notifications";
import { requestDesktopOverlay } from "./desktop-overlay-requests";
import type { DesktopOverlay } from "./desktop-overlays";
import {
  changeDesktopValue,
  desktopValues,
  readBoolean,
  readNumber,
  toggleDockHiding,
  useDesktopSetting,
  useDesktopValue,
} from "./desktop-personal";
import { RECENT_DOCUMENTS_CLEARED, recentDocuments } from "./desktop-recent-documents";
import { rememberQuitWindows } from "./desktop-restore";
import { ServicesItems } from "./desktop-services";
import { DESKTOP_SPACES, isDesktopSpace, readSpaces } from "./desktop-spaces";
import {
  BATTERY_PERCENTAGE,
  clearRecentApps,
  DEFAULT_RECENT_ITEMS,
  DesktopSystemLayer,
  RECENT_ITEMS_SETTING,
  readRecentItems,
  requestSystem,
  useBattery,
  useRecentApps,
} from "./desktop-system";
import { showDesktopViewOptions, useDesktopViewOptionsShown } from "./desktop-view-settings";

/** The menu titles of Finder, the front application while no window is open. */
export const FINDER_MENUS = ["Finder", "File", "Edit", "View", "Go", "Window", "Help"] as const;

/** What the menus act on: the desktop's applications, its windows and how to open one. */
export interface DesktopMenuContext {
  /** Every application of the desktop, in Dock order. */
  apps: readonly DesktopApp[];
  /** The window manager. */
  manager: WindowManagerApi;
  /** Open an application, or bring it to the front. */
  launch: (id: string) => void;
  /** Open another window of an application that has several (File > New Window). */
  newWindow?: (id: string) => void;
  /** Open an application's Preferences window, or bring it to the front. */
  openPreferences: (id: string) => void;
}

/**
 * What the menus do to the signed-in person's session, when the page has sign-in (the desktop
 * served by its Ferrite application): Lock Screen and Log Out in the Apple menu, and the fast
 * user switching menu of the menu bar.
 */
export interface DesktopAccountMenu {
  /** Lock the screen; left out when the account cannot be locked (Guest User). */
  lockScreen?: () => void;
  /** Log out of the account. */
  logOut: () => void;
  /** The other accounts used in this browser, which the switching menu offers. */
  others: readonly { name: string; fullName: string }[];
  /** Show the login window, with the account `name` chosen, or with the list of accounts. */
  switchTo: (name: string | null) => void;
}

/** The applications as menu items that open them. */
function AppItems({ apps, launch }: Pick<DesktopMenuContext, "apps" | "launch">) {
  return apps.map((app) => (
    <MenuItem key={app.id} onClick={() => launch(app.id)}>
      {app.name}
    </MenuItem>
  ));
}

/**
 * The Apple menu, row for row as in the Apple-Menu screenshots. About This Mac and Force Quit…
 * open the demos of those windows when the desktop has them, as System Preferences… and
 * App Store… open theirs. Recent Items lists the apps this account opened, newest first, kept
 * with its settings (`desktop-system.tsx`). Sleep darkens the display, Restart… starts the
 * desktop again and Shut Down… logs out, each as `DesktopSystemLayer` shows them.
 */
export function AppleMenu({
  apps,
  launch,
  userName,
  account,
}: Pick<DesktopMenuContext, "apps" | "launch"> & {
  userName: string;
  account?: DesktopAccountMenu;
}) {
  const recent = useRecentApps()
    .map((id) => apps.find((app) => app.id === id))
    .filter((app): app is DesktopApp => app !== undefined);
  const served = driveAvailable();
  const drive = useDrive(served);
  const clearedAt = useDesktopValue(RECENT_DOCUMENTS_CLEARED, readNumber, 0);
  const recentCount = useDesktopValue(RECENT_ITEMS_SETTING, readRecentItems, DEFAULT_RECENT_ITEMS);
  const documents = recentDocuments(served ? drive : null, clearedAt, recentCount);
  // Held down, Option changes these rows, as on a Mac: the ones that ask do not.
  const option = useOptionKey();
  return (
    <MenuBarMenu title={<MarkGlyph />} aria-label="Apple" popup={{ style: { width: 208 } }}>
      {option ? (
        <MenuItem onClick={() => launch("system-information")}>System Information…</MenuItem>
      ) : (
        <MenuItem onClick={() => launch("about-this-mac")}>About This Mac</MenuItem>
      )}
      <MenuSeparator />
      <MenuItem onClick={() => launch("system-preferences")}>System Preferences…</MenuItem>
      <MenuItem onClick={() => launch("app-store")}>App Store…</MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Recent Items</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem disabled>Applications</MenuItem>
          {recent.length === 0 ? (
            <MenuItem disabled>No Recent Applications</MenuItem>
          ) : (
            recent.map((app) => (
              <MenuItem key={app.id} onClick={() => launch(app.id)}>
                {app.name}
              </MenuItem>
            ))
          )}
          {served ? (
            <>
              <MenuSeparator />
              <MenuItem disabled>Documents</MenuItem>
              {documents.length === 0 ? (
                <MenuItem disabled>No Recent Documents</MenuItem>
              ) : (
                documents.map((entry) => (
                  <MenuItem
                    key={entry.id}
                    onClick={() => {
                      if (!openFile(entry)) quickLookAlone(entry.id);
                    }}
                  >
                    {entry.name}
                  </MenuItem>
                ))
              )}
              <MenuSeparator />
              <MenuItem disabled>Servers</MenuItem>
              <MenuItem disabled title="The drive has no servers to connect to.">
                No Recent Servers
              </MenuItem>
            </>
          ) : null}
          <MenuSeparator />
          <MenuItem
            disabled={recent.length === 0 && documents.length === 0}
            onClick={() => {
              clearRecentApps();
              if (served) changeDesktopValue(RECENT_DOCUMENTS_CLEARED, Date.now());
            }}
          >
            Clear Menu
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem keyEquivalent="option+command+escape" onClick={() => launch("force-quit")}>
        Force Quit…
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => requestSystem("sleep")}>Sleep</MenuItem>
      <MenuItem onClick={() => requestSystem(option ? "restart-now" : "restart")}>
        {option ? "Restart" : "Restart…"}
      </MenuItem>
      <MenuItem onClick={() => requestSystem(option ? "shut-down-now" : "shut-down")}>
        {option ? "Shut Down" : "Shut Down…"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="control+command+q"
        disabled={!account?.lockScreen}
        onClick={account?.lockScreen}
      >
        Lock Screen
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+q" disabled={!account} onClick={account?.logOut}>
        Log Out {userName}
        {option ? "" : "…"}
      </MenuItem>
    </MenuBarMenu>
  );
}

interface ApplicationMenuProps extends DesktopMenuContext {
  /** The front application's id and name; Finder while no window is open. */
  app: { id: string; name: string };
  /** The menu's title in the bar. */
  title: string;
  /** Whether this is the application menu, the first after the Apple menu. */
  first: boolean;
}

/** A command the desktop carries out for a menu of the front application: whether it can now, and doing it. */
export interface DesktopMenuCommand {
  enabled: boolean;
  run: () => void;
}

/**
 * What the desktop carries out itself in the front application's menus, from its windows: Hide, Hide Others, Show All
 * and Quit in the application menu, File > Close Window, View > Enter or Exit Full Screen, and Minimize, Zoom and Bring
 * All to Front in the Window menu. The menus and their key equivalents (`menuKeyCommands`) both take them from here, so a
 * key does what its item does, and nothing while the item is dimmed.
 */
export function appCommands(app: { id: string }, manager: WindowManagerApi) {
  const { windows, keyWindowId } = manager;
  const own = windows.filter((window) => window.app === app.id && !isClosedBehind(window.id));
  const key = own.find((window) => window.id === keyWindowId);
  const hidden = windows.filter(
    (window) => window.minimized && hiddenWindows().includes(window.id),
  );
  const others = windows.filter((window) => window.app !== app.id);
  const shown = own.filter((window) => !window.minimized);
  const hideAll = (list: readonly ManagedWindowInfo[]) =>
    hideWindows(
      list.filter((window) => !window.minimized).map((window) => window.id),
      manager.minimize,
    );
  const command = (enabled: boolean, run: () => void): DesktopMenuCommand => ({ enabled, run });
  // General's Ask to keep changes: a close goes through the window's own close button, where a document asks.
  const closeAsking = (id: string) => {
    const button =
      desktopValues()[ASK_TO_KEEP_KEY] === true
        ? document.querySelector<HTMLElement>(
            `[data-window-id="${CSS.escape(id)}"] [aria-label="Close"]`,
          )
        : null;
    if (button) button.click();
    else manager.close(id);
  };
  return {
    own,
    key,
    hide: command(shown.length > 0, () => hideAll(own)),
    hideOthers: command(
      others.some((window) => !window.minimized),
      () => hideAll(others),
    ),
    showAll: command(hidden.length > 0, () => {
      for (const window of hidden) manager.focus(window.id);
      if (key) manager.focus(key.id);
    }),
    quit: command(app.id !== "finder", () => {
      const remember = () =>
        rememberQuitWindows(
          app.id,
          own.filter((window) => window.id === app.id || window.id.startsWith(`${app.id}:`)),
        );
      if (
        requestAppQuit(app.id, () => {
          remember();
          for (const window of own) manager.close(window.id);
        })
      )
        return;
      remember();
      for (const window of own) closeAsking(window.id);
    }),
    // The key window, even when it is a window of the system's and `app` the application behind it.
    closeWindow: command(keyWindowId !== undefined, () => {
      if (keyWindowId !== undefined) closeAsking(keyWindowId);
    }),
    closeAll: command(own.length > 0, () => {
      for (const window of own) closeAsking(window.id);
    }),
    fullScreen: command(Boolean(key?.resizable), () => {
      if (key) manager.toggleFullScreen(key.id);
    }),
    minimize: command(Boolean(key && !key.fullScreen), () => {
      if (key) manager.minimize(key.id);
    }),
    zoom: command(Boolean(key?.resizable), () => {
      if (key) manager.zoom(key.id);
    }),
    // The application's next window: its windows are in the order they were last key, so the first
    // is the one used longest ago.
    cycleWindows: command(shown.length > 1, () => {
      const next = shown[0];
      if (next) manager.focus(next.id);
    }),
    // The application's windows that are shown come in front of every other window, in the order they stood, its key
    // window frontmost. A minimized window stays in the Dock, as on macOS.
    bringAllToFront: command(shown.length > 0, () => {
      for (const window of [...shown].sort((a, b) => a.z - b.z))
        if (window.id !== key?.id) manager.focus(window.id);
      if (key && !key.minimized) manager.focus(key.id);
    }),
  };
}

/**
 * The title an application registers its own Window > Zoom row under with `useDesktopAppMenu`, in
 * place of the desktop's, where zooming means something of its own: a sticky note fits its text.
 */
export const WINDOW_ZOOM_ROW = "Window > Zoom";

/** The key equivalents of main windows in the Window menu's list, which the application answers. */
const WINDOW_LIST_KEYS: Readonly<Record<string, string>> = { music: "option+command+1" };

/** Why Finder's commands are dimmed while it has no window to act on. */
const NO_FINDER_WINDOW = "No Finder window is open";

/** With no Finder window open, View Options is the desktop's. */
function DesktopViewOptionsRow() {
  const shown = useDesktopViewOptionsShown();
  return (
    <>
      <MenuItem keyEquivalent="command+j" onClick={() => showDesktopViewOptions(!shown)}>
        {shown ? "Hide View Options" : "Show View Options"}
      </MenuItem>
      <MenuSeparator />
    </>
  );
}

/**
 * What File calls an application's New Window command, if it has one. Finder always has, whatever
 * descriptor stands in for it.
 */
function newWindowTitleOf(app: { id: string }, apps: readonly DesktopApp[]): string | undefined {
  return (
    apps.find((candidate) => candidate.id === app.id)?.newWindowTitle ??
    (app.id === "finder" ? "New Finder Window" : undefined)
  );
}

/**
 * The key equivalents the menu bar shows that the desktop carries out itself, each with its command: those of the front
 * application's menus (`appCommands`) and the Apple menu's Force Quit…, Lock Screen and Log Out. The desktop listens for
 * them after the windows (`desktop.tsx`), so a window that answers one of these keys itself keeps it (Safari's
 * Command-W closes a tab). Off Apple platforms Command is the Control key, and a key equivalent that names Control as
 * well (Enter Full Screen, Lock Screen) cannot be typed (`macalicious/lib/menu-key-commands`).
 */
export function menuKeyCommands({
  app,
  apps,
  manager,
  launch,
  newWindow,
  account,
}: {
  app: { id: string };
  apps: readonly DesktopApp[];
  manager: WindowManagerApi;
  launch: (id: string) => void;
  newWindow?: (id: string) => void;
  account?: DesktopAccountMenu;
}): readonly (readonly [string, DesktopMenuCommand])[] {
  const commands = appCommands(app, manager);
  // New Window: bound only while an application that has one is in front, so no other application's Command-N is taken.
  const newWindowKeys: (readonly [string, DesktopMenuCommand])[] =
    newWindowTitleOf(app, apps) && newWindow
      ? [["command+n", { enabled: true, run: () => newWindow(app.id) }]]
      : [];
  return [
    ...newWindowKeys,
    ["command+h", commands.hide],
    ["option+command+h", commands.hideOthers],
    ["command+q", commands.quit],
    ["command+w", commands.closeWindow],
    ["option+command+w", commands.closeAll],
    ["control+command+f", commands.fullScreen],
    ["command+m", commands.minimize],
    ["option+command+d", { enabled: true, run: toggleDockHiding }],
    ["command+`", commands.cycleWindows],
    ["option+command+escape", { enabled: true, run: () => launch("force-quit") }],
    ["control+command+space", { enabled: true, run: toggleCharacterViewer }],
    [
      "control+command+q",
      { enabled: Boolean(account?.lockScreen), run: () => account?.lockScreen?.() },
    ],
    ["shift+command+q", { enabled: Boolean(account), run: () => account?.logOut() }],
  ];
}

/** The File menu's first row: Close Window, or Close All while Option is held, as on a Mac. */
function CloseRow({ commands }: { commands: ReturnType<typeof appCommands> }) {
  const option = useOptionKey();
  const command = option ? commands.closeAll : commands.closeWindow;
  return (
    <MenuItem
      keyEquivalent={option ? "option+command+w" : "command+w"}
      disabled={!command.enabled}
      onClick={command.run}
    >
      {option ? "Close All" : "Close Window"}
    </MenuItem>
  );
}

/**
 * A dimmed row that says why the item before it is dimmed. The dimmed item names it as its description
 * (`aria-describedby`), so assistive technology reads the reason with the item, and a person reads it right under it.
 */
function Reason({ id, children }: { id: string; children: ReactNode }) {
  return (
    <MenuItem disabled id={id} className="mac-desktop-shell-menu-reason">
      {children}
    </MenuItem>
  );
}

/**
 * A dimmed item of a group that one reason row explains (the Edit placeholders under "<App> adds no Edit commands",
 * Back and Forward over "<App> has no Back or Forward"): its name stays its own (`aria-label`), and it carries the
 * group's reason as its own description, in a visually hidden part of the item, as the row it belongs to says it.
 */
function DimmedInGroup({
  id,
  name,
  reason,
  keyEquivalent,
}: {
  id: string;
  name: string;
  reason: string;
  keyEquivalent?: string;
}) {
  return (
    <MenuItem
      keyEquivalent={keyEquivalent}
      disabled
      aria-label={name}
      aria-describedby={id}
      title={reason}
    >
      {name}
      <span id={id} className="mac-desktop-shell-menu-why">
        {reason}
      </span>
    </MenuItem>
  );
}

/**
 * The items of one menu of the front application, from its title. `ownItems` says that the
 * application's window put commands of its own in this menu: the desktop then leaves out its
 * dimmed placeholder rows (Edit's Undo to Select All, Go's Back and Forward, Help's row), which
 * would only repeat or contradict the application's, and keeps the rows it carries out itself.
 * Every item it dims says why (`Reason`, `DimmedInGroup`); `reasonId` makes the reasons' element ids.
 */
function items({
  app,
  title,
  first,
  apps,
  manager,
  launch,
  newWindow: _newWindow,
  openPreferences,
  ownItems = false,
  reasonId,
  appMenuRows,
  zoomRow,
}: ApplicationMenuProps & {
  ownItems?: boolean;
  reasonId: string;
  appMenuRows?: ReactNode;
  zoomRow?: ReactNode;
}): ReactNode {
  const { keyWindowId } = manager;
  const commands = appCommands(app, manager);
  const { own, key } = commands;
  const why = (part: string) => `${reasonId}-${part}`;
  const fixedSize = Boolean(key && !key.resizable);
  // A window in full screen or a Split View already has a Space of its own.
  const cannotTile =
    fixedSize ||
    !commands.zoom.enabled ||
    !isDesktopSpace(readSpaces(desktopValues()[DESKTOP_SPACES])?.current ?? "");

  if (first) {
    const finder = app.id === "finder";
    const finderMenu = finder || app.id === "about-this-mac";
    const hasPreferences = Boolean(apps.find((candidate) => candidate.id === app.id)?.preferences);
    return (
      <>
        <MenuItem
          onClick={() =>
            requestSystem(finder ? "about-finder" : { about: { id: app.id, name: app.name } })
          }
        >
          {app.name.startsWith("About ") ? app.name : `About ${app.name}`}
        </MenuItem>
        <MenuSeparator />
        {app.id === "system-preferences" ? null : (
          <>
            <MenuItem
              keyEquivalent="command+,"
              disabled={!hasPreferences}
              aria-describedby={hasPreferences ? undefined : why("preferences")}
              title={hasPreferences ? undefined : `${app.name} has no preferences`}
              onClick={() => openPreferences(app.id)}
            >
              Preferences…
            </MenuItem>
            {hasPreferences ? null : (
              <Reason id={why("preferences")}>{app.name} has no preferences</Reason>
            )}
            <MenuSeparator />
          </>
        )}
        {finder
          ? (appMenuRows ?? (
              <>
                <MenuItem
                  keyEquivalent="shift+command+delete"
                  disabled
                  aria-describedby={why("empty-trash")}
                  title={NO_FINDER_WINDOW}
                >
                  Empty Trash…
                </MenuItem>
                <Reason id={why("empty-trash")}>{NO_FINDER_WINDOW}</Reason>
                <MenuSeparator />
              </>
            ))
          : appMenuRows}
        <Submenu>
          <SubmenuTrigger>Services</SubmenuTrigger>
          <SubmenuPopup>
            <ServicesItems
              apps={apps.map((candidate) => candidate.id)}
              from={app.id}
              none={
                <>
                  <MenuItem
                    disabled
                    aria-describedby={why("services")}
                    title="Select some text to use a service"
                  >
                    No Services Apply
                  </MenuItem>
                  <Reason id={why("services")}>Select some text to use a service</Reason>
                </>
              }
            />
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+h"
          disabled={!commands.hide.enabled}
          onClick={commands.hide.run}
        >
          Hide {finderMenu ? "Finder" : app.name}
        </MenuItem>
        <MenuItem
          keyEquivalent="option+command+h"
          disabled={!commands.hideOthers.enabled}
          aria-describedby={commands.hideOthers.enabled ? undefined : why("hide-others")}
          title={
            commands.hideOthers.enabled ? undefined : "No other application has a window shown"
          }
          onClick={commands.hideOthers.run}
        >
          Hide Others
        </MenuItem>
        {commands.hideOthers.enabled ? null : (
          <Reason id={why("hide-others")}>No other application has a window shown</Reason>
        )}
        <MenuItem
          disabled={!commands.showAll.enabled}
          aria-describedby={commands.showAll.enabled ? undefined : why("show-all")}
          title={commands.showAll.enabled ? undefined : "No window is hidden"}
          onClick={commands.showAll.run}
        >
          Show All
        </MenuItem>
        {commands.showAll.enabled ? null : (
          <Reason id={why("show-all")}>No window is hidden</Reason>
        )}
        {finderMenu ? null : (
          <>
            <MenuSeparator />
            <MenuItem keyEquivalent="command+q" onClick={commands.quit.run}>
              Quit {app.name}
            </MenuItem>
          </>
        )}
      </>
    );
  }

  switch (title) {
    case "File":
      return <CloseRow commands={commands} />;
    case "Edit": {
      if (ownItems) return null;
      const reason = app.id === "finder" ? NO_FINDER_WINDOW : `${app.name} adds no Edit commands`;
      const edit = (name: string, keyEquivalent: string) => (
        <DimmedInGroup
          id={why(`edit-${name.toLowerCase().replace(/ /g, "-")}`)}
          name={name}
          reason={reason}
          keyEquivalent={keyEquivalent}
        />
      );
      return (
        <>
          <MenuItem disabled className="mac-desktop-shell-menu-reason">
            {reason}
          </MenuItem>
          <MenuSeparator />
          {edit("Undo", "command+z")}
          {edit("Redo", "shift+command+z")}
          <MenuSeparator />
          {edit("Cut", "command+x")}
          {edit("Copy", "command+c")}
          {edit("Paste", "command+v")}
          {edit("Select All", "command+a")}
        </>
      );
    }
    case "View":
      return (
        <>
          {app.id === "finder" && !ownItems && driveAvailable() ? <DesktopViewOptionsRow /> : null}
          <MenuItem
            keyEquivalent="control+command+f"
            disabled={!commands.fullScreen.enabled}
            aria-describedby={fixedSize ? why("view-fixed-size") : undefined}
            title={fixedSize ? "This window has a fixed size" : undefined}
            onClick={commands.fullScreen.run}
          >
            {key?.fullScreen ? "Exit Full Screen" : "Enter Full Screen"}
          </MenuItem>
          {fixedSize ? (
            <Reason id={why("view-fixed-size")}>This window has a fixed size</Reason>
          ) : null}
        </>
      );
    case "Go": {
      // Finder's window lists Applications among its own places.
      if (ownItems && app.id === "finder") return null;
      const reason = app.id === "finder" ? NO_FINDER_WINDOW : `${app.name} has no Back or Forward`;
      return (
        <>
          {ownItems ? null : (
            <>
              <DimmedInGroup
                id={why("go-back")}
                name="Back"
                reason={reason}
                keyEquivalent="command+["
              />
              <DimmedInGroup
                id={why("go-forward")}
                name="Forward"
                reason={reason}
                keyEquivalent="command+]"
              />
              <MenuItem disabled className="mac-desktop-shell-menu-reason">
                {reason}
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <Submenu>
            <SubmenuTrigger>Applications</SubmenuTrigger>
            <SubmenuPopup>
              <AppItems apps={apps} launch={launch} />
            </SubmenuPopup>
          </Submenu>
        </>
      );
    }
    case "Window":
      return (
        <>
          <MenuItem
            keyEquivalent="command+m"
            disabled={!commands.minimize.enabled}
            onClick={commands.minimize.run}
          >
            Minimize
          </MenuItem>
          {zoomRow ?? (
            <>
              <MenuItem
                disabled={!commands.zoom.enabled}
                aria-describedby={fixedSize ? why("window-fixed-size") : undefined}
                title={fixedSize ? "This window has a fixed size" : undefined}
                onClick={commands.zoom.run}
              >
                Zoom
              </MenuItem>
              {fixedSize ? (
                <Reason id={why("window-fixed-size")}>This window has a fixed size</Reason>
              ) : null}
            </>
          )}
          <MenuItem disabled={cannotTile} onClick={() => requestDesktopOverlay("tile-left")}>
            Tile Window to Left of Screen
          </MenuItem>
          <MenuItem disabled={cannotTile} onClick={() => requestDesktopOverlay("tile-right")}>
            Tile Window to Right of Screen
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            keyEquivalent="command+`"
            disabled={!commands.cycleWindows.enabled}
            onClick={commands.cycleWindows.run}
          >
            Cycle Through Windows
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={!commands.bringAllToFront.enabled}
            onClick={commands.bringAllToFront.run}
          >
            Bring All to Front
          </MenuItem>
          {own.length > 0 ? <MenuSeparator /> : null}
          {own.map((window) => (
            <MenuCheckboxItem
              key={window.id}
              keyEquivalent={window.id === app.id ? WINDOW_LIST_KEYS[app.id] : undefined}
              checked={window.id === keyWindowId}
              onCheckedChange={() => manager.focus(window.id)}
            >
              {window.title}
            </MenuCheckboxItem>
          ))}
        </>
      );
    case "Help": {
      if (ownItems) return null;
      return apps.some((candidate) => candidate.id === "help-viewer") ? (
        <MenuItem onClick={() => requestHelp(app.name)}>{app.name} Help</MenuItem>
      ) : (
        <MenuItem disabled>{app.name} Help is not part of this demo</MenuItem>
      );
    }
    default:
      return ownItems ? null : <MenuItem disabled>This demo has no {title} commands</MenuItem>;
  }
}

/**
 * The element last focused inside a window of the desktop, kept by one document-level listener
 * while any application menu is mounted. A click on a menu title focuses the title in some
 * engines before the menu reports that it opens, so "what was focused when the menu opened"
 * has to come from before that click.
 */
let lastFocusInWindow: HTMLElement | null = null;
let focusListeners = 0;

function noteFocus(event: FocusEvent) {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest("[data-window-id]")) {
    lastFocusInWindow = target;
  }
}

/**
 * Whether `element` is in the key window: the window of its frame (`[data-window-id]`) is key, and
 * no window around it is in another state. The element focused last may be in a window that is no
 * longer key (an application opened since from Spotlight, which put the focus nowhere): the
 * keyboard never goes back there, which would bring that window, and its application, forward.
 */
function inKeyWindow(element: Element): boolean {
  const frame = element.closest("[data-window-id]");
  const state = frame?.querySelector("[data-window-state]")?.getAttribute("data-window-state");
  return state === "key" && !element.closest('[data-window-state]:not([data-window-state="key"])');
}

/**
 * Whether a menu other than the one closing is open. Base UI asks where the keyboard goes when the closed menu's focus
 * manager lets go of it, which is once the menu has faded out (`menu.css`: 0.25 s after a choice), not when it closed;
 * a menu opened in that time, by a second click straight after a command, is open by then and has the keyboard. The
 * closing menu's own popup has lost Base UI's `data-open` when it is asked.
 */
function anotherMenuOpen(): boolean {
  return document.querySelector('[role="menu"][data-open]') !== null;
}

/**
 * Puts the keyboard back on `target` once the command just chosen has had its turn: in the next frame, after the tasks
 * already queued. A command may bring another window forward a moment after its menu closes (Go > Applications, the
 * Apple menu, Recent Items and the status menus open an application, which takes the key state once its window has
 * registered; a Window-menu entry brings another window forward); the focus goes back only if it is still on the menu,
 * its bar or nothing, and `target`'s window is still key. Given to Base UI, which moves the focus to it after that, the
 * element took the key state back from the window just brought forward, which then stood behind it, inactive.
 */
function returnFocusLater(target: HTMLElement) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (anotherMenuOpen()) return;
      if (document.querySelector('[aria-modal="true"], [role="alertdialog"]')) return;
      const active = document.activeElement;
      const onMenu =
        !(active instanceof HTMLElement) ||
        active === document.body ||
        active.closest('[role="menu"], [role="menubar"]') !== null;
      if (
        onMenu &&
        target.isConnected &&
        inKeyWindow(target) &&
        !target.closest("[inert], [data-minimized]")
      ) {
        target.focus({ preventScroll: true });
      }
    }, 0);
  });
}

/**
 * Where the keyboard goes when a menu of the menu bar closes. On a Mac the menu bar does not
 * keep the keyboard: after a command or Escape, typing goes on where it was. So when an item is chosen or Escape
 * closes the menu, the element focused in the key window before the menu opened gets the focus back, but only while
 * the focus is still on the menu, its bar or nowhere, and only while that window is still key. A
 * command that put the focus somewhere of its own keeps it there: a window or a field it chose, or
 * a dialog, sheet or alert it opened outside any window (Mail's own Preferences), whose focus and
 * the page's hidden state it manages itself. An element focused last in another window (not key
 * when the menu opened) never gets it: that would bring another window, even another
 * application, forward. Nor does the focus go back to an element that is gone or hidden. With no such element, and
 * after a press outside, Base UI's default stands: the menu's title. A menu opened while this one fades out keeps the
 * keyboard in every case: moving it to the
 * window, or to this menu's title, would take it from that menu, which closes when it loses it.
 *
 * A function here is an explicit target to Base UI, which then no longer checks for itself whether
 * the focus moved on since the menu closed (it does for its default, `true`), so this checks; and the element focused
 * before goes back only once the command has had its turn (`returnFocusLater`), so Base UI is told to move nothing.
 */
function useFocusReturn() {
  const before = useRef<HTMLElement | null>(null);
  const backToWindow = useRef(false);
  useEffect(() => {
    if (focusListeners++ === 0) document.addEventListener("focusin", noteFocus, true);
    return () => {
      if (--focusListeners === 0) document.removeEventListener("focusin", noteFocus, true);
    };
  }, []);
  const onOpenChange = useCallback((open: boolean, details?: { reason?: string }) => {
    if (open) {
      const last = lastFocusInWindow;
      before.current = last?.isConnected && inKeyWindow(last) ? last : null;
      backToWindow.current = false;
    } else {
      backToWindow.current = details?.reason === "item-press" || details?.reason === "escape-key";
    }
  }, []);
  const finalFocus = useCallback((): boolean | HTMLElement => {
    // A menu opened since this one closed has the keyboard: leave it there.
    if (anotherMenuOpen()) return false;
    const active = document.activeElement;
    // The focus moved somewhere of its own (a command's window, field or dialog, or a press outside
    // on a field): leave it there. Only a focus still on the menu, on its bar or on nothing goes back.
    const onMenu =
      !(active instanceof HTMLElement) ||
      active === document.body ||
      active.closest('[role="menu"], [role="menubar"]') !== null;
    if (!onMenu) return false;
    if (!backToWindow.current) return true;
    // A modal dialog or alert the command opened takes the keyboard when it is ready.
    if (document.querySelector('[aria-modal="true"], [role="alertdialog"]')) return false;
    const target = before.current;
    if (
      target?.isConnected &&
      inKeyWindow(target) &&
      !target.closest("[inert], [data-minimized]")
    ) {
      returnFocusLater(target);
      return false;
    }
    return true;
  }, []);
  return { onOpenChange, finalFocus };
}

/**
 * One menu of the front application. A demo names its menus and keeps their commands to
 * itself, so the desktop fills each from its title: the commands it can carry out on the
 * application's windows, and dimmed rows for the ones it cannot. Above them come the items the
 * application's open window registered for the menu (`desktop-app-menus.ts`), such as TextEdit's
 * File commands on the person's drive; a menu the window fills has none of the desktop's dimmed
 * rows, so a command never shows twice, once working and once dimmed. After a command the
 * keyboard goes back to where it was in the window (`useFocusReturn`).
 */
export function ApplicationMenu(props: ApplicationMenuProps) {
  const own = useDesktopAppMenuItems(props.app.id, props.title);
  const ownItems = !props.first && own !== undefined;
  const reasonId = useId();
  const zoomRow = useDesktopAppMenuItems(props.app.id, WINDOW_ZOOM_ROW);
  const desktop = items({
    ...props,
    ownItems,
    reasonId,
    zoomRow,
    appMenuRows:
      props.first && own ? (
        <>
          {own}
          <MenuSeparator />
        </>
      ) : undefined,
  });
  const focus = useFocusReturn();
  const newWindowTitle =
    props.title === "File" ? newWindowTitleOf(props.app, props.apps) : undefined;
  const { newWindow } = props;
  // A menu bar's commands are Help Viewer's when the desktop has it.
  const helpViewer = props.apps.some((candidate) => candidate.id === "help-viewer");
  const newWindowRow =
    newWindowTitle && newWindow ? (
      <MenuItem keyEquivalent="command+n" onClick={() => newWindow(props.app.id)}>
        {newWindowTitle}
      </MenuItem>
    ) : null;
  useHelpMenuRows(props.app.id, props.title, helpViewer, [
    newWindowRow,
    ownItems ? own : null,
    desktop,
  ]);
  return (
    <MenuBarMenu
      title={props.title}
      application={props.first}
      onOpenChange={focus.onOpenChange}
      popup={{ finalFocus: focus.finalFocus }}
    >
      {props.title === "Help" && helpViewer ? <HelpMenuSearch app={props.app.id} /> : null}
      {newWindowRow ? (
        <>
          {newWindowRow}
          <MenuSeparator />
        </>
      ) : null}
      {ownItems ? (
        <>
          {own}
          {desktop ? <MenuSeparator /> : null}
        </>
      ) : null}
      {desktop}
      {props.title === "Edit" ? <EditFooter /> : null}
    </MenuBarMenu>
  );
}

/** What every application's Edit menu ends with, as AppKit adds it. */
function EditFooter() {
  return (
    <>
      <MenuSeparator />
      <DictationRow />
      <MenuItem keyEquivalent="control+command+space" onClick={toggleCharacterViewer}>
        Emoji &amp; Symbols
      </MenuItem>
    </>
  );
}

/** How long a press on Spotlight's menu bar item lasts before it puts the window back. */
const SPOTLIGHT_HOLD_MS = 1_000;

const cell = (width: number) => ({ style: { width, justifyContent: "center", padding: 0 } });

/** The account's title takes the room its name needs, up to a limit: the extras beside it move over. */
// No inline `display`: the bar's `data-overflow` rule must be able to hide this cell on a narrow
// screen, and an inline style beats any stylesheet rule but an `!important` one ("Window ·ephen" at
// 390 points). desktop.css gives it `display: block`.
const userCell = {
  className: "mac-desktop-shell-user-cell",
  style: {
    minWidth: 64,
    maxWidth: 200,
    padding: "0 5px",
    overflow: "hidden",
    textAlign: "center",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
} as const;

/** The keychain's menu, while Keychain Access's Preferences show it. */
function KeychainMenu({
  launch,
  lockScreen,
}: {
  launch: (id: string) => void;
  lockScreen?: () => void;
}) {
  const shown = useDesktopValue(KEYCHAIN_MENU_BAR_STATUS, readBoolean, false);
  const unlocked = useKeychainUnlocked();
  if (!shown) return null;
  return (
    <MenuBarExtraMenu
      aria-label={unlocked ? "Keychain, unlocked" : "Keychain, locked"}
      titleProps={cell(28)}
      title={<LockGlyph open={unlocked !== null} />}
    >
      <MenuItem disabled={!lockScreen} onClick={lockScreen}>
        Lock Screen
      </MenuItem>
      <MenuSeparator />
      {unlocked ? (
        <MenuItem onClick={unlocked.lock}>Lock Keychain “login”</MenuItem>
      ) : (
        <MenuItem disabled>Keychain “login” is locked</MenuItem>
      )}
      <MenuSeparator />
      <MenuItem onClick={() => launch("keychain-access")}>Open Keychain Access</MenuItem>
    </MenuBarExtraMenu>
  );
}

/** The Time Machine menu: no backup exists, so it says so and dims what needs one. */
function TimeMachineMenu({ preferences }: { preferences: (pane: string) => void }) {
  return (
    <MenuBarExtraMenu aria-label="Time Machine" titleProps={cell(40)} title={<TimeMachineGlyph />}>
      <MenuItem disabled>Latest Backup: None</MenuItem>
      <MenuItem disabled>This desktop has no Time Machine disk.</MenuItem>
      <MenuSeparator />
      <MenuItem disabled>Back Up Now</MenuItem>
      <MenuItem disabled>Enter Time Machine</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => preferences("time-machine")}>
        Open Time Machine Preferences…
      </MenuItem>
    </MenuBarExtraMenu>
  );
}

/**
 * The Battery menu: what `navigator.getBattery` reports where the engine has it, and "unknown"
 * where it does not. Show Percentage puts the level beside the glyph; it is the person's setting,
 * kept with their desktop values, and dimmed where there is no level to show.
 */
function BatteryMenu({ preferences }: { preferences: (pane: string) => void }) {
  const battery = useBattery();
  const [percentage, setPercentage] = useDesktopSetting(BATTERY_PERCENTAGE, readBoolean, false);
  const level = battery ? `${Math.round(battery.level * 100)}%` : undefined;
  const shown = percentage && level !== undefined;
  return (
    <MenuBarExtraMenu
      aria-label="Battery"
      titleProps={
        shown
          ? { style: { width: "auto", justifyContent: "center", gap: 4, padding: "0 6px" } }
          : cell(36)
      }
      title={
        shown ? (
          <>
            <span className="mac-desktop-shell-battery-level">{level}</span>
            <BatteryGlyph />
          </>
        ) : (
          <BatteryGlyph />
        )
      }
    >
      {battery === undefined ? <MenuItem disabled>Battery: Checking…</MenuItem> : null}
      {battery === null ? (
        <>
          <MenuItem disabled>Battery status unknown</MenuItem>
          <MenuItem disabled>This browser does not report the battery.</MenuItem>
        </>
      ) : null}
      {battery ? (
        <>
          <MenuItem disabled>Battery: {level}</MenuItem>
          <MenuItem disabled>
            Power Source: {battery.charging ? "Power Adapter" : "Battery"}
          </MenuItem>
        </>
      ) : null}
      <MenuSeparator />
      <MenuCheckboxItem
        checked={shown}
        disabled={!battery}
        onCheckedChange={(checked) => setPercentage(checked)}
      >
        Show Percentage
      </MenuCheckboxItem>
      <MenuItem onClick={() => preferences("energy-saver")}>
        Open Energy Saver Preferences…
      </MenuItem>
    </MenuBarExtraMenu>
  );
}

/**
 * The menu bar extras of the Desktop screenshots, in cells of the widths measured there (40,
 * 29, 33, 36, 107, 64, 36, 30 and 46 pt from Time Machine to Notification Center). The
 * images are stand-ins of the same size. Their menus state only what the browser reports
 * (no backup, the network's online state, the battery where the engine reports it) and say why
 * the rest is dimmed. Spotlight's, Siri's and Notification Center's show
 * and hide theirs over the desktop. When the person's live updates are connected
 * (`desktop-live.ts`), an Option-click on Notification Center's turns Do Not Disturb on or off
 * instead, and its glyph is dimmed while it is on; the banners and alerts the person's apps
 * deliver come in from it (`DesktopNotificationBanners`).
 */
export function StatusMenus({
  clock,
  userName,
  launch,
  overlay,
  onOverlay,
  account,
}: {
  clock: string;
  userName: string;
  launch: (id: string) => void;
  /** The overlay that is showing over the desktop. */
  overlay: DesktopOverlay | null;
  /** Show an overlay, or hide it when it is the one showing. */
  onOverlay: (overlay: DesktopOverlay) => void;
  /** The fast user switching menu's accounts and commands, when the page has sign-in. */
  account?: DesktopAccountMenu;
}) {
  // Each "Open … Preferences…" opens System Preferences on the pane it names (`pane-request.ts`).
  const preferences = (pane: string) => {
    requestPane(pane);
    launch("system-preferences");
  };
  // Read only: the banners keep the stream open (desktop-notifications.tsx).
  const live = useSyncExternalStore(subscribeLive, liveState, liveState);
  const analogClock = useAnalogMenuClock();
  const extrasOrder = useExtrasOrder();
  const spotlightPress = useRef<{
    wasOpen: boolean;
    held: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const releaseSpotlight = () => {
    if (spotlightPress.current) clearTimeout(spotlightPress.current.timer);
  };
  useEffect(
    () => () => {
      if (spotlightPress.current) clearTimeout(spotlightPress.current.timer);
    },
    [],
  );
  return (
    <>
      <MenuBarExtras ref={extrasOrder}>
        <KeychainMenu launch={launch} lockScreen={account?.lockScreen} />
        <AccessibilityExtra preferences={preferences} />
        <TimeMachineMenu preferences={preferences} />
        <NetworkMenu titleProps={cell(29)} preferences={preferences} />
        <ScriptMenu titleProps={cell(29)} />
        <BluetoothMenu titleProps={cell(29)} preferences={preferences} />
        <AirPlayMenu titleProps={cell(33)} preferences={preferences} />
        <VolumeMenuExtra onPreferences={() => preferences("sound")} />
        <ViewersMenuExtra onPreferences={() => preferences("keyboard")} />
        <BatteryMenu preferences={preferences} />
        <MenuBarExtraMenu
          title={analogClock ? <AnalogMenuClock /> : clock}
          aria-label={`Clock, ${clock}`}
          titleProps={cell(107)}
        >
          <MenuItem disabled>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </MenuItem>
          <MenuSeparator />
          <ClockViewRows analog={analogClock} />
          <MenuSeparator />
          <MenuItem onClick={() => preferences("date-and-time")}>
            Open Date &amp; Time Preferences…
          </MenuItem>
        </MenuBarExtraMenu>
        <MenuBarExtraMenu title={userName} titleProps={userCell}>
          {account?.others.map((other) => (
            <MenuItem key={other.name} onClick={() => account.switchTo(other.name)}>
              {other.fullName}
            </MenuItem>
          ))}
          {account && account.others.length > 0 ? <MenuSeparator /> : null}
          <MenuItem
            disabled={!account}
            onClick={account ? () => account.switchTo(null) : undefined}
          >
            Login Window…
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => preferences("users-and-groups")}>
            Users &amp; Groups Preferences…
          </MenuItem>
        </MenuBarExtraMenu>
        <MenuBarExtra
          aria-label="Spotlight"
          title="Spotlight: Command-Space, or Control-Option-Space where the system takes that"
          active={overlay === "spotlight"}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const wasOpen = overlay === "spotlight";
            spotlightPress.current = {
              wasOpen,
              held: false,
              timer: setTimeout(() => {
                changeDesktopValue(SPOTLIGHT_PLACE, HOME_PLACE);
                if (spotlightPress.current) spotlightPress.current.held = true;
              }, SPOTLIGHT_HOLD_MS),
            };
          }}
          onPointerUp={releaseSpotlight}
          onPointerLeave={releaseSpotlight}
          onClick={() => {
            const press = spotlightPress.current;
            spotlightPress.current = null;
            // Held to put the window back, the window that was open stays open, with the keyboard.
            if (press?.held && press.wasOpen) {
              document.querySelector<HTMLElement>(".mac-spotlight-input")?.focus();
              return;
            }
            onOverlay("spotlight");
          }}
          {...cell(36)}
        >
          <SpotlightGlyph />
        </MenuBarExtra>
        <MenuBarExtra
          aria-label="Siri"
          active={overlay === "siri"}
          onClick={() => onOverlay("siri")}
          {...cell(30)}
        >
          <SiriGlyph />
        </MenuBarExtra>
        <MenuBarExtra
          aria-label="Notification Center"
          active={overlay === "notification-center"}
          onClick={(event) => {
            if (event.altKey && live.ready) void setDoNotDisturb(!live.dnd);
            else onOverlay("notification-center");
          }}
          data-dnd={live.ready && live.dnd ? "" : undefined}
          style={{ width: 46, padding: "0 23px 0 5px" }}
        >
          <NotificationCenterGlyph />
        </MenuBarExtra>
      </MenuBarExtras>
      <DesktopNotificationBanners launch={launch} covered={overlay === "notification-center"} />
      <DesktopSystemLayer account={account} />
    </>
  );
}
