import { requestDesktopOverlay } from "../../../desktop/desktop-overlay-requests";
import {
  holdScreenSaver,
  lockScreenNow,
  sleepDisplayNow,
  startScreenSaverNow,
} from "../desktop-and-screen-saver/screen-saver";

/**
 * Hot Corners on the served desktop: the pointer reaching a corner of the browser's page does what
 * that corner is set to, once, until it has left. A page sees only its own pointer, so these are the
 * corners of the page and not of the screen.
 */
export const HOT_CORNERS = [
  ["topLeft", "Top left"],
  ["topRight", "Top right"],
  ["bottomLeft", "Bottom left"],
  ["bottomRight", "Bottom right"],
] as const;

type Corner = (typeof HOT_CORNERS)[number][0];

export const hotCornerKey = (corner: Corner) => `mission-control.hotCorner.${corner}`;

export const NO_ACTION = "–";
const ACTIONS: Readonly<Record<string, () => void>> = {
  "Mission Control": () => requestDesktopOverlay("mission-control"),
  "Application Windows": () => requestDesktopOverlay("application-windows"),
  Desktop: () => requestDesktopOverlay("show-desktop"),
  "Notification Center": () => requestDesktopOverlay("notification-center"),
  Launchpad: () => requestDesktopOverlay("launchpad"),
  "Start Screen Saver": startScreenSaverNow,
  "Disable Screen Saver": () => holdScreenSaver(true),
  "Put Display to Sleep": sleepDisplayNow,
  "Lock Screen": lockScreenNow,
};
export const HOT_CORNER_ACTIONS = [NO_ACTION, ...Object.keys(ACTIONS)];

/** How near an edge of the page counts as being at it, in CSS pixels. */
const EDGE = 1;

/** The corner of a page of this size that a point is in. */
export function cornerAt(x: number, y: number, width: number, height: number): Corner | null {
  const left = x <= EDGE;
  const right = x >= width - 1 - EDGE;
  const top = y <= EDGE;
  const bottom = y >= height - 1 - EDGE;
  if (top && left) return "topLeft";
  if (top && right) return "topRight";
  if (bottom && left) return "bottomLeft";
  if (bottom && right) return "bottomRight";
  return null;
}

let settings: Readonly<Record<string, unknown>> = {};
let current: Corner | null = null;
let listening = false;

function release() {
  current = null;
  holdScreenSaver(false);
}

function onMove(event: PointerEvent) {
  const corner = cornerAt(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
  if (corner === current) return;
  release();
  current = corner;
  if (corner === null) return;
  ACTIONS[String(settings[hotCornerKey(corner)])]?.();
}

/** Follow what the settings say. */
export function followHotCorners(values: Readonly<Record<string, unknown>>): void {
  settings = values;
  if (listening) return;
  listening = true;
  window.addEventListener("pointermove", onMove, true);
  document.documentElement.addEventListener("pointerleave", release);
  window.addEventListener("blur", release);
}

/** Stop, when the person's session ends. */
export function clearHotCorners(): void {
  settings = {};
  listening = false;
  release();
  window.removeEventListener("pointermove", onMove, true);
  document.documentElement.removeEventListener("pointerleave", release);
  window.removeEventListener("blur", release);
}
