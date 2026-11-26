import { setDoNotDisturb } from "../desktop/desktop-live";
import { readBoolean } from "../desktop/desktop-personal";
import { clearPageLayers, followPageLayers } from "./page-layers";
import { clearAccessibility, followAccessibility } from "./panes/accessibility/page-accessibility";
import {
  clearScreenSaver,
  displayAsleep,
  followScreenSaver,
} from "./panes/desktop-and-screen-saver/screen-saver";
import { clearScrollClick, followScrollClick } from "./panes/general/scroll-click";
import { clearReplacements, followReplacements } from "./panes/keyboard/text-replacements";
import { clearHotCorners, followHotCorners } from "./panes/mission-control/hot-corners";
import { clearScrollDirection, followScrollDirection } from "./panes/mouse/scroll-direction";
import {
  clearRepeatedCalls,
  type NotificationRule,
  callRingsThrough as ringsThrough,
  ruleOf,
} from "./panes/notifications/notification-rules";
import { clearLogOut, followLogOut } from "./panes/security-and-privacy/served-security";
import { clearOutputVolume, followOutputVolume } from "./panes/sound/output-volume";

/**
 * The settings of General and Dock that the desktop page itself can honour. Each becomes an
 * attribute on `<html>`, which `system-preferences.css` styles, so no component reads them and a
 * window opened later follows too. `storage.ts` applies them whenever the page's settings change.
 */
const ATTRIBUTES = {
  hideMenuBar: "data-mac-hide-menu-bar",
  fontSmoothing: "data-mac-font-smoothing",
  dockIndicators: "data-mac-dock-indicators",
  siriOff: "data-mac-siri-off",
  siriNoExtra: "data-mac-siri-no-extra",
  noBatteryExtra: "data-mac-no-battery-extra",
  noTimeMachineExtra: "data-mac-no-time-machine-extra",
  noWifiExtra: "data-mac-no-wifi-extra",
} as const;

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/** The settings the page holds, which the schedule's timer reads. */
let latest: Readonly<Record<string, unknown>> = {};
const settingListeners = new Set<() => void>();

/** Hear each time the settings on the page change. */
export function onSettingEffects(listener: () => void): () => void {
  settingListeners.add(listener);
  return () => {
    settingListeners.delete(listener);
  };
}

/** Notifications' settings for an application, as the desktop's banners follow them. */
export const notificationRule = (app: string): NotificationRule => ruleOf(latest, app);

/** Whether a notification rings through Do Not Disturb, by Notifications' two call settings. */
export const callRingsThrough = (item: { app: string; title: string; at_ms: number }): boolean =>
  ringsThrough(item, latest);

/** Whether When the display is sleeping holds notifications back now. */
export const displaySleepQuiets = (): boolean =>
  latest["notifications.whenSleeping"] !== false && displayAsleep();

/** Notifications' sort order, as Notification Center follows it. */
export const notificationSortOrder = (): unknown => latest["notifications.sortOrder"];

/** The Sound pane's alert, its volume and whether output is muted. */
export const alertSoundSettings = () => ({
  name: typeof latest["sound.alert"] === "string" ? latest["sound.alert"] : "Funk",
  volume: typeof latest["sound.alertVolume"] === "number" ? latest["sound.alertVolume"] : 100,
  muted: latest["sound.mute"] === true,
});

/** Siri's Voice Feedback: whether a spoken request is answered aloud. */
export const siriSpeaks = (): boolean => latest["siri.voiceFeedback"] !== "off";

/** The categories Spotlight's Search Results has switched off. */
export const spotlightExcluded = (): readonly unknown[] => {
  const excluded = latest["spotlight.excluded"];
  return Array.isArray(excluded) ? excluded : [];
};

/** The drive folders Spotlight's Privacy keeps out of its results, by id. */
export const spotlightPrivacy = (): readonly unknown[] => {
  const kept = latest["spotlight.privacy"];
  return Array.isArray(kept) ? kept : [];
};

/** Mail and Messages are always in a Share menu; Extensions' Share Menu says for the others. */
export const shareExtensionOn = (app: string): boolean => {
  if (app === "mail" || app === "messages") return true;
  const on = latest["extensions.shareMenu"];
  return !Array.isArray(on) || on.includes(app);
};

/** What a double click on a window's title bar does: `zoom`, `minimize` or nothing. */
let doubleClick: "zoom" | "minimize" | "none" = "zoom";

/** Whether a time, in minutes since midnight, is in the span from `from` to `to`, which may cross midnight. */
export function inQuietHours(now: number, from: number, to: number): boolean {
  return from <= to ? now >= from && now < to : now >= from || now < to;
}

const minutesOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Notifications' Do Not Disturb schedule: at each edge of the span, Do Not Disturb turns on or off,
 * for every browser of the person. Between the edges a person's own switch stands, so the page's
 * first look at the settings only notes where it is: loading them changes nothing. Turning the
 * schedule on inside its span turns Do Not Disturb on.
 */
let scheduleState: boolean | null = null;
let scheduleSeen = false;
function followSchedule(values: Readonly<Record<string, unknown>>) {
  const first = !scheduleSeen;
  scheduleSeen = true;
  if (values["notifications.scheduled"] !== true) {
    scheduleState = null;
    return;
  }
  const date = new Date();
  const inside = inQuietHours(
    date.getHours() * 60 + date.getMinutes(),
    minutesOr(values["notifications.from"], 22 * 60),
    minutesOr(values["notifications.to"], 7 * 60),
  );
  if (inside === scheduleState) return;
  const edge = scheduleState !== null;
  scheduleState = inside;
  if (first) return;
  if (edge || inside) setDoNotDisturb(inside);
}

/**
 * What the settings say of the sidebars and of minimizing, as custom properties on `<html>` that
 * the library's Sidebar and managed window read; `null` leaves the component's own value.
 */
export function settingProperties(
  values: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string | null>> {
  const sidebar = text(values["general.sidebarIconSize"]);
  const scale = text(values["dock.minimizeEffect"]) === "Scale effect";
  const alwaysScrollBars = text(values["general.scrollBars"]) === "always";
  return {
    "--mac-scroll-view-overlay-opacity": alwaysScrollBars ? "1" : null,
    "--mac-scroll-view-overlay-pointer-events": alwaysScrollBars ? "auto" : null,
    "--mac-sidebar-icon-size": sidebar === "Small" ? "14px" : sidebar === "Large" ? "22px" : null,
    "--mac-sidebar-row-height": sidebar === "Small" ? "20px" : sidebar === "Large" ? "32px" : null,
    "--mac-managed-window-minimize-scale": scale ? null : "0.03, 0.08",
    "--mac-managed-window-minimize-skew": scale ? null : "8deg",
  };
}

/** What the settings say, attribute by attribute; `null` leaves the desktop's default. */
export function settingAttributes(
  values: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string | null>> {
  return {
    [ATTRIBUTES.hideMenuBar]: readBoolean(values["general.hideMenuBar"]) ? "" : null,
    [ATTRIBUTES.fontSmoothing]:
      readBoolean(values["general.fontSmoothing"]) === false ? "off" : null,
    [ATTRIBUTES.dockIndicators]: readBoolean(values["dock.indicators"]) === false ? "off" : null,
    [ATTRIBUTES.siriOff]: readBoolean(values["siri.askSiri"]) === false ? "" : null,
    [ATTRIBUTES.siriNoExtra]: readBoolean(values["siri.showInMenuBar"]) === false ? "" : null,
    [ATTRIBUTES.noBatteryExtra]:
      readBoolean(values["energy-saver.showBatteryStatus"]) === false ? "" : null,
    [ATTRIBUTES.noTimeMachineExtra]:
      readBoolean(values["time-machine.showInMenuBar"]) === false ? "" : null,
    [ATTRIBUTES.noWifiExtra]:
      readBoolean(values["network.showStatusInMenuBar"]) === false ? "" : null,
  };
}

/** Put the settings on the page. */
export function applySettingEffects(values: Readonly<Record<string, unknown>> | null): void {
  const page = document.documentElement;
  latest = values ?? {};
  for (const listener of settingListeners) listener();
  // `null`: the settings have not loaded, so there is nothing yet to note the schedule from.
  if (values) followSchedule(values);
  if (values) followScreenSaver(values);
  if (values) followPageLayers(values);
  if (values) followReplacements(values);
  if (values) followAccessibility(values);
  if (values) followHotCorners(values);
  if (values) followScrollClick(values);
  if (values) followLogOut(values);
  followOutputVolume(values ?? {});
  if (values) followScrollDirection(values);
  for (const [name, value] of Object.entries(settingAttributes(values ?? {}))) {
    if (value === null) page.removeAttribute(name);
    else page.setAttribute(name, value);
  }
  for (const [name, value] of Object.entries(settingProperties(values ?? {}))) {
    if (value === null) page.style.removeProperty(name);
    else page.style.setProperty(name, value);
  }
  const stored = values ?? {};
  doubleClick =
    readBoolean(stored["dock.doubleClickTitleBar"]) === false
      ? "none"
      : text(stored["dock.doubleClickAction"]) === "minimize"
        ? "minimize"
        : "zoom";
}

/** Take the settings off the page, when the person's session ends. */
export function clearSettingEffects(): void {
  for (const name of Object.values(ATTRIBUTES)) document.documentElement.removeAttribute(name);
  for (const name of Object.keys(settingProperties({}))) {
    document.documentElement.style.removeProperty(name);
  }
  doubleClick = "zoom";
  latest = {};
  scheduleState = null;
  scheduleSeen = false;
  clearScreenSaver();
  clearPageLayers();
  clearReplacements();
  clearAccessibility();
  clearHotCorners();
  clearScrollClick();
  clearLogOut();
  clearOutputVolume();
  clearScrollDirection();
  clearRepeatedCalls();
}

/**
 * Dock's "Double-click a window's title bar to": the library's managed window always zooms, so a
 * double click the setting answers otherwise is taken before it reaches the window. Listens from
 * when the desktop starts; a press on a control in the bar stays the control's.
 */
export function listenForTitleBarDoubleClicks(): () => void {
  const listener = (event: MouseEvent) => {
    if (doubleClick === "zoom" || !(event.target instanceof Element)) return;
    const bar = event.target.closest(".mac-title-bar");
    if (!bar || event.target.closest("button, a, input, select, textarea, [role='button']")) return;
    event.stopPropagation();
    if (doubleClick !== "minimize") return;
    bar.querySelector<HTMLElement>('[aria-label="Minimize"]')?.click();
  };
  document.addEventListener("dblclick", listener, true);
  const schedule = setInterval(() => {
    if (scheduleSeen) followSchedule(latest);
  }, 30_000);
  return () => {
    document.removeEventListener("dblclick", listener, true);
    clearInterval(schedule);
  };
}
