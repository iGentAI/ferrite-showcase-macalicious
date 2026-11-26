"use client";

import {
  AboutWindow,
  AboutWindowOverview,
  AboutWindowTitle,
  AboutWindowVersion,
} from "macalicious/about-window";
import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import chessSourceUrl from "../chess/vendor/reckless/reckless-source.tar.gz?url";
import { AppTile } from "./desktop-artwork";
import type { DesktopAccountMenu } from "./desktop-menus";
import { changeDesktopValue, desktopValues, readIds, useDesktopValue } from "./desktop-personal";

/*
 * The shell's own facts and commands, kept honest: what the Apple menu's Recent Items lists,
 * what the Battery and Wi-Fi menus say, and what Sleep, Restart…, Shut Down… and About Finder
 * do. Nothing here states a fact the browser did not give: the battery is what
 * `navigator.getBattery` reports where an engine has it, and unknown elsewhere; the network is
 * `navigator.onLine`. The person's choices (Recent Items, how many it lists, Show Percentage) are
 * desktop values (`desktop-personal.ts`), kept per account with the System Preferences settings on
 * a served desktop.
 */

// ---------------------------------------------------------------------------------------------
// Recent Items: the apps this account opened, newest first.

/** The desktop value that keeps Recent Items. */
export const RECENT_APPS = "desktop.recentApps";
/** How many apps Recent Items keeps: the most General › Recent items can list. */
export const MAX_RECENT_APPS = 50;
/**
 * The General pane's "Recent items" setting: how many apps the Apple menu's Recent Items lists,
 * "None" or a number, ten by default as on macOS.
 */
export const RECENT_ITEMS_SETTING = "general.recentItems";
/** What Recent Items lists until General › Recent items says otherwise. */
export const DEFAULT_RECENT_ITEMS = 10;

/** How many apps General › Recent items asks for, from its stored value. */
export function readRecentItems(stored: unknown): number | undefined {
  if (stored === "None") return 0;
  const count = typeof stored === "string" ? Number(stored) : Number.NaN;
  return Number.isInteger(count) && count > 0 && count <= MAX_RECENT_APPS ? count : undefined;
}

/** Note that the app `id` was opened: it moves to the front of Recent Items. Finder is not kept. */
export function noteRecentApp(id: string): void {
  if (id === "finder") return;
  const current = readIds(desktopValues()[RECENT_APPS]) ?? [];
  if (current[0] === id) return;
  changeDesktopValue(
    RECENT_APPS,
    [id, ...current.filter((other) => other !== id)].slice(0, MAX_RECENT_APPS),
  );
}

/** Clear Menu: Recent Items forgets every app. */
export function clearRecentApps(): void {
  changeDesktopValue(RECENT_APPS, []);
}

/**
 * What a window did to Recent Items since `base`: the apps it opened, at the front of its list
 * (each open moves its app there), and whether it cleared the menu. A list that holds fewer of
 * `base` than moving apps to the front leaves, and was not cut by `MAX_RECENT_APPS`, was cleared:
 * everything in it was opened since.
 */
function changesSince(
  list: readonly string[],
  base: readonly string[],
): { opened: readonly string[]; cleared: boolean } {
  for (let front = 0; front <= list.length; front++) {
    const opened = new Set(list.slice(0, front));
    const rest = base.filter((id) => !opened.has(id));
    const tail = list.slice(front);
    if (tail.every((id, at) => rest[at] === id)) {
      const cleared = tail.length < rest.length && list.length < MAX_RECENT_APPS;
      return { opened: cleared ? list : list.slice(0, front), cleared };
    }
  }
  return { opened: list, cleared: true };
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, at) => b[at] === id);

/**
 * Recent Items as two windows of one account left it, each from the list `base` both had read:
 * `mine`, this page's, and `theirs`, saved first by the other window. A list only one window
 * changed is kept as that window left it. When both changed it, the apps each opened since `base`
 * are all kept, newest first (this page's first, as its save is the later one), then the rest of
 * the newer list, at most `MAX_RECENT_APPS`; when either cleared the menu, only what was opened
 * since is kept, so a cleared history never comes back. `undefined` when either list is not a list
 * of app ids.
 */
export function mergeRecentApps(
  base: unknown,
  mine: unknown,
  theirs: unknown,
): string[] | undefined {
  const before = readIds(base) ?? [];
  const ours = readIds(mine);
  const other = readIds(theirs);
  if (!ours || !other) return undefined;
  if (sameIds(ours, before)) return [...other];
  if (sameIds(other, before)) return [...ours];
  const here = changesSince(ours, before);
  const there = changesSince(other, before);
  const rest = here.cleared || there.cleared ? [] : [...other, ...ours];
  return [...new Set([...here.opened, ...there.opened, ...rest])].slice(0, MAX_RECENT_APPS);
}

const NONE: readonly string[] = [];

/**
 * The apps of Recent Items, newest first: as many as General › Recent items says (ten unless the
 * person chose otherwise; none for "None").
 */
export function useRecentApps(): readonly string[] {
  const ids = useDesktopValue(RECENT_APPS, readIds, NONE);
  const count = useDesktopValue(RECENT_ITEMS_SETTING, readRecentItems, DEFAULT_RECENT_ITEMS);
  return useMemo(() => (ids.length > count ? ids.slice(0, count) : ids), [ids, count]);
}

// ---------------------------------------------------------------------------------------------
// Show Percentage: the battery's level beside its menu-bar glyph.

/** The desktop value that keeps Show Percentage. */
export const BATTERY_PERCENTAGE = "menuBar.batteryPercentage";

// ---------------------------------------------------------------------------------------------
// The battery, as the browser reports it.

/** The battery's state: its level from 0 to 1 and whether it is charging. */
export interface BatteryState {
  level: number;
  charging: boolean;
}

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

/**
 * The battery: `undefined` while the browser is asked, `null` where it does not say (Firefox and
 * WebKit have no `navigator.getBattery`), else its level and charging state, kept current.
 */
export function useBattery(): BatteryState | null | undefined {
  const [state, setState] = useState<BatteryState | null | undefined>(() =>
    typeof navigator !== "undefined" && "getBattery" in navigator ? undefined : null,
  );
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (typeof nav.getBattery !== "function") {
      setState(null);
      return;
    }
    let manager: BatteryManagerLike | undefined;
    let gone = false;
    const read = () => {
      if (manager && !gone) setState({ level: manager.level, charging: manager.charging });
    };
    nav.getBattery().then(
      (found) => {
        // Resolved after the menu went (or after React's first cleanup): subscribe nothing.
        if (gone) return;
        manager = found;
        read();
        found.addEventListener("levelchange", read);
        found.addEventListener("chargingchange", read);
      },
      () => {
        if (!gone) setState(null);
      },
    );
    return () => {
      gone = true;
      manager?.removeEventListener("levelchange", read);
      manager?.removeEventListener("chargingchange", read);
    };
  }, []);
  return state;
}

// ---------------------------------------------------------------------------------------------
// The network, as the browser reports it.

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Whether the browser says it is online (`navigator.onLine`), kept current. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

// ---------------------------------------------------------------------------------------------
// Sleep, Restart…, Shut Down… and About <application>.

/** The application an About window names: its id (for its icon) and its name. */
export interface AboutApp {
  id: string;
  name: string;
}

/**
 * A command of the Apple menu or an application menu that the system layer carries out: Sleep, Restart…, Shut Down…, or
 * the About window of an application (`about-finder` is Finder's).
 */
export type SystemRequest =
  | "sleep"
  | "restart"
  | "restart-now"
  | "shut-down"
  | "shut-down-now"
  | "about-finder"
  | { about: AboutApp };

let request: SystemRequest | null = null;
const requestListeners = new Set<() => void>();

function setRequest(next: SystemRequest | null) {
  request = next;
  for (const listener of requestListeners) listener();
}

/** Ask the system layer for Sleep, Restart…, Shut Down… or an application's About window. */
export function requestSystem(next: SystemRequest): void {
  setRequest(next);
}

function subscribeRequest(listener: () => void) {
  requestListeners.add(listener);
  return () => {
    requestListeners.delete(listener);
  };
}

/**
 * What Restart and a page with no account's Shut Down do: start the desktop again, as the page
 * reloads. Tests replace it; a browser reloads the page.
 */
export const desktopSystem = {
  reload: () => window.location.reload(),
};

/** Seconds before Restart… and Shut Down… go ahead by themselves, as on macOS. */
export const CONFIRM_SECONDS = 60;

const ALERTS = {
  restart: {
    message: "Are you sure you want to restart your computer now?",
    after: "restart",
    button: "Restart",
  },
  "shut-down": {
    message: "Are you sure you want to shut down your computer now?",
    after: "shut down",
    button: "Shut Down",
  },
} as const;

/** What Option does to Restart… and Shut Down…: no question, the command at once. */
function RightAway({ run }: { run: () => void }) {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => latest.current(), []);
  return null;
}

/**
 * The confirmation of Restart… or Shut Down…: Cancel, or the command, which Return chooses and
 * which goes ahead by itself after `CONFIRM_SECONDS`, the seconds counted down in the text.
 */
function ConfirmAlert({
  kind,
  onConfirm,
  onCancel,
}: {
  kind: "restart" | "shut-down";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [left, setLeft] = useState(CONFIRM_SECONDS);
  useEffect(() => {
    if (left <= 0) {
      onConfirm();
      return;
    }
    const tick = setTimeout(() => setLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(tick);
  }, [left, onConfirm]);
  const alert = ALERTS[kind];
  return (
    <Alert open onOpenChange={(open) => !open && onCancel()}>
      <AlertPopup>
        <AlertMessage>{alert.message}</AlertMessage>
        <AlertInformativeText>
          If you do nothing, the computer will {alert.after} automatically in {left} seconds.
        </AlertInformativeText>
        <AlertButtons>
          <AlertClose>Cancel</AlertClose>
          <AlertClose render={<DefaultButton />} onClick={onConfirm}>
            {alert.button}
          </AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

/** The display asleep (or switched off): black, until a key or a press wakes it. */
function Dark({ label, onWake }: { label: string; onWake: () => void }) {
  useEffect(() => {
    // A moment later, so that the press or key that chose the command does not wake it at once.
    let armed = false;
    const arm = setTimeout(() => {
      armed = true;
    }, 50);
    const wake = () => {
      if (armed) onWake();
    };
    window.addEventListener("keydown", wake, true);
    window.addEventListener("pointerdown", wake, true);
    return () => {
      clearTimeout(arm);
      window.removeEventListener("keydown", wake, true);
      window.removeEventListener("pointerdown", wake, true);
    };
  }, [onWake]);
  return createPortal(
    <div
      role="img"
      aria-label={label}
      className="mac-desktop-shell-display-off"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: "#000",
        cursor: "none",
      }}
    />,
    document.body,
  );
}

/**
 * An application's About window, as the application menu's About <name> opens it: its icon, its name and the version of
 * the desktop it is part of (every application of this desktop is the Macalicious Catalina 10.15 one), closed by its close
 * button.
 */
function AboutApplication({ app, onClose }: { app: AboutApp; onClose: () => void }) {
  return createPortal(
    <div
      className={
        app.id === "finder"
          ? "mac-desktop-shell-about mac-desktop-shell-about-finder"
          : "mac-desktop-shell-about"
      }
      data-app={app.id}
      style={{
        position: "fixed",
        left: "50%",
        top: 120,
        transform: "translateX(-50%)",
        zIndex: 1000,
      }}
    >
      <AboutWindow title={`About ${app.name}`} onClose={onClose} style={{ width: 300 }}>
        <AboutWindowOverview
          image={<AppTile id={app.id} name={app.name} />}
          // The library's overview is the wide About This Mac layout, whose second column clips a long name at this width.
          style={{
            gridTemplateColumns: "minmax(0, 1fr)",
            justifyItems: "center",
            textAlign: "center",
          }}
        >
          <AboutWindowTitle>{app.name}</AboutWindowTitle>
          <AboutWindowVersion label="Version">10.15 (Macalicious)</AboutWindowVersion>
          {app.id === "chess" && (
            <a href={chessSourceUrl} download>
              Reckless engine source · AGPLv3
            </a>
          )}
        </AboutWindowOverview>
      </AboutWindow>
    </div>,
    document.body,
  );
}

/**
 * What the shell's system commands show: the display asleep, the confirmations of Restart… and
 * Shut Down…, and an application's About window. Sleep darkens the display until a key or a press, then locks the
 * screen where the account can be locked. Restart… starts the desktop again (the page reloads).
 * Shut Down… logs out to the Login Window where the page has sign-in; without it the display is
 * switched off until a press starts the desktop again.
 */
export function DesktopSystemLayer({ account }: { account?: DesktopAccountMenu }) {
  const current = useSyncExternalStore(
    subscribeRequest,
    () => request,
    () => null,
  );
  const [off, setOff] = useState(false);
  const done = () => setRequest(null);
  if (off) return <Dark label="Shut down" onWake={() => desktopSystem.reload()} />;
  if (current !== null && typeof current === "object") {
    return <AboutApplication app={current.about} onClose={done} />;
  }
  switch (current) {
    case "sleep":
      return (
        <Dark
          label="Display asleep"
          onWake={() => {
            done();
            account?.lockScreen?.();
          }}
        />
      );
    case "restart-now":
      return (
        <RightAway
          run={() => {
            done();
            desktopSystem.reload();
          }}
        />
      );
    case "shut-down-now":
      return (
        <RightAway
          run={() => {
            done();
            if (account) account.logOut();
            else setOff(true);
          }}
        />
      );
    case "restart":
      return (
        <ConfirmAlert
          kind="restart"
          onCancel={done}
          onConfirm={() => {
            done();
            desktopSystem.reload();
          }}
        />
      );
    case "shut-down":
      return (
        <ConfirmAlert
          kind="shut-down"
          onCancel={done}
          onConfirm={() => {
            done();
            if (account) account.logOut();
            else setOff(true);
          }}
        />
      );
    case "about-finder":
      return <AboutApplication app={{ id: "finder", name: "Finder" }} onClose={done} />;
    default:
      return null;
  }
}
