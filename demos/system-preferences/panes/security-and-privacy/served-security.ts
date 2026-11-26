import { useEffect } from "react";
import {
  desktopValuesLoaded,
  readBoolean,
  useDesktopValue,
} from "../../../desktop/desktop-personal";
import { requestSystem } from "../../../desktop/desktop-system";

/**
 * What Security & Privacy can do on the served desktop beyond Require password: the message on the
 * lock screen, and logging out after a time with no input on this page. A page sees only its own
 * input, so the time counts from the last input here, not on the computer.
 */
export const SHOW_MESSAGE_KEY = "security-and-privacy.showMessage";
export const LOCK_MESSAGE_KEY = "security-and-privacy.lockMessage";
export const LOG_OUT_ON_KEY = "security-and-privacy.logOutOn";
export const LOG_OUT_MINUTES_KEY = "security-and-privacy.logOutMinutes";

export const LOG_OUT_MINUTES = 60;
const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel"] as const;

const readText = (stored: unknown) => (typeof stored === "string" ? stored : undefined);

/**
 * The lock screen's message for this account. A page reloaded while locked cannot read the settings
 * (the server refuses them until the unlock), so the page keeps a copy per account in this browser
 * from when it could.
 */
export function useLockMessage(account: string): string {
  const on = useDesktopValue(SHOW_MESSAGE_KEY, readBoolean, false);
  const words = useDesktopValue(LOCK_MESSAGE_KEY, readText, "").trim();
  const copy = `macalicious-lock-message-${account}`;
  const loaded = desktopValuesLoaded();
  const message = on ? words : "";
  useEffect(() => {
    if (!loaded) return;
    try {
      if (message) window.localStorage.setItem(copy, message);
      else window.localStorage.removeItem(copy);
    } catch {
      // A browser that keeps nothing for this site loses only the message after a reload.
    }
  }, [loaded, copy, message]);
  if (loaded) return message;
  try {
    return window.localStorage.getItem(copy) ?? "";
  } catch {
    return "";
  }
}

let afterMs = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function arm() {
  clearTimeout(timer);
  timer = afterMs > 0 ? setTimeout(() => requestSystem("shut-down-now"), afterMs) : undefined;
}

/** Follow what the settings say. */
export function followLogOut(values: Readonly<Record<string, unknown>>): void {
  const minutes = values[LOG_OUT_MINUTES_KEY];
  const before = afterMs;
  afterMs =
    values[LOG_OUT_ON_KEY] === true
      ? (typeof minutes === "number" && minutes > 0 ? minutes : LOG_OUT_MINUTES) * 60_000
      : 0;
  // Other settings change while nobody touches the page, and the person being idle must still count.
  if (before !== afterMs) arm();
  if (listening || afterMs === 0) return;
  listening = true;
  for (const name of ACTIVITY) window.addEventListener(name, arm, { capture: true, passive: true });
}

/** Stop, when the person's session ends. */
export function clearLogOut(): void {
  afterMs = 0;
  clearTimeout(timer);
  if (!listening) return;
  listening = false;
  for (const name of ACTIVITY) window.removeEventListener(name, arm, { capture: true });
}
