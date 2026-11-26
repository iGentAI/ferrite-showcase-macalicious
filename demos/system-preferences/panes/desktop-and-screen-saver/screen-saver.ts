import "../../system-preferences.tokens.css";
import "../../page-layers.css";

/**
 * The screen saver of Desktop & Screen Saver: after the chosen minutes with no pointer or key on this
 * page, or from Preview, a black layer over the whole page with the time drifting on it if asked
 * for. Any input takes it away, and that input goes no further. A playing video keeps it from
 * starting, as it keeps a Mac's display awake. A page sees only its own input, so the time counts
 * from the last input here, not on the computer.
 */
export const SAVER_AFTER_KEY = "desktop-and-screen-saver.saverAfter";
export const SAVER_CLOCK_KEY = "desktop-and-screen-saver.saverClock";
/** Energy Saver's Turn display off after, in minutes; 0 is Never. */
export const DISPLAY_SLEEP_KEY = "energy-saver.displaySleep";

/** Security & Privacy's Require password, and how long after the screen saver or sleep begins. */
export const REQUIRE_PASSWORD_KEY = "security-and-privacy.requirePassword";
export const PASSWORD_DELAY_KEY = "security-and-privacy.passwordDelay";
const PASSWORD_DELAYS: Readonly<Record<string, number>> = {
  immediately: 0,
  "5 seconds": 5_000,
  "1 minute": 60_000,
  "5 minutes": 300_000,
  "15 minutes": 900_000,
  "1 hour": 3_600_000,
  "4 hours": 14_400_000,
  "8 hours": 28_800_000,
};

let lockAfterMs: number | null = null;
let lockTimer: ReturnType<typeof setTimeout> | undefined;
/** When the layer on the page asks for the password; a timer can run late in a throttled tab. */
let lockDeadline: number | null = null;
let lockScreen: (() => void) | undefined;

/** What locks the screen for the person signed in, while there is such a person. */
export function registerLockScreen(lock: () => void): () => void {
  lockScreen = lock;
  return () => {
    if (lockScreen === lock) lockScreen = undefined;
  };
}

/** The choices of Start after, in minutes; 0 is Never, the default on this desktop. */
export const SAVER_DELAYS: readonly (readonly [number, string])[] = [
  [0, "Never"],
  [1, "1 Minute"],
  [2, "2 Minutes"],
  [5, "5 Minutes"],
  [10, "10 Minutes"],
  [20, "20 Minutes"],
  [30, "30 Minutes"],
  [60, "1 Hour"],
];

/** The hand's rest after the click that began a Preview is not input that ends it. */
const GRACE_MS = 500;
/** A click comes straight after its release; one that has not by then is not coming. */
const CLICK_MS = 300;
const ACTIVATION = ["click", "auxclick", "contextmenu"] as const;
const DRIFT_MS = 5_000;
const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel"] as const;

let delayMs = 0;
let sleepMs = 0;
let showClock = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let sleepTimer: ReturnType<typeof setTimeout> | undefined;
let layer: HTMLElement | null = null;
let tick: ReturnType<typeof setInterval> | undefined;
let startedAt = 0;
let previewing = false;
/** A saver a corner began, which the hand's rest does not end but which still asks for the password. */
let settling = false;
let listening = false;
/** Ends what the press that last took the layer away still holds. */
let retireHeld: (() => void) | undefined;
let asleep = false;
const wakeListeners = new Set<() => void>();

/** Hot Corners' Disable Screen Saver, while the pointer is in that corner. */
let held = false;

export function holdScreenSaver(on: boolean): void {
  held = on;
}

const playing = () =>
  held || [...document.querySelectorAll("video")].some((video) => !video.paused && !video.ended);

function arm() {
  clearTimeout(idleTimer);
  clearTimeout(sleepTimer);
  idleTimer = undefined;
  sleepTimer = undefined;
  if (sleepMs > 0)
    sleepTimer = setTimeout(() => {
      if (playing()) arm();
      else sleepDisplay();
    }, sleepMs);
  if (delayMs === 0 || layer) return;
  idleTimer = setTimeout(() => {
    if (playing()) arm();
    else startScreenSaver();
  }, delayMs);
}

/** Hot Corners' Lock Screen. */
export function lockScreenNow(): void {
  lockNow();
}

/** Hot Corners' Put Display to Sleep: the hand's rest in the corner does not wake it. */
export function sleepDisplayNow(): void {
  sleepDisplay();
  settling = true;
}

/** Hot Corners' Start Screen Saver: the hand's rest in the corner does not end it. */
export function startScreenSaverNow(): void {
  previewing = false;
  showLayer();
  settling = true;
}

function lockNow() {
  clearTimeout(lockTimer);
  lockDeadline = null;
  lockScreen?.();
}

/** Whether the display sleep's layer is up. */
export const displayAsleep = () => asleep;

/** Hears the display wake from sleep. Returns the unsubscribe. */
export function onDisplayWake(listener: () => void): () => void {
  wakeListeners.add(listener);
  return () => {
    wakeListeners.delete(listener);
  };
}

function stop() {
  settling = false;
  clearInterval(tick);
  clearTimeout(lockTimer);
  lockDeadline = null;
  layer?.remove();
  layer = null;
  if (asleep) {
    asleep = false;
    for (const listener of wakeListeners) listener();
  }
}

/** The display asleep: the layer with nothing on it, over a screen saver if one is up. */
function sleepDisplay() {
  previewing = false;
  asleep = true;
  showLayer(false);
  clearInterval(tick);
  layer?.replaceChildren();
}

function onActivity(event: Event) {
  if (layer) {
    swallow(event);
    if (
      event.type === "pointermove" &&
      (previewing || settling) &&
      Date.now() - startedAt < GRACE_MS
    )
      return;
    if (lockDeadline !== null && Date.now() >= lockDeadline) lockNow();
    stop();
    // The rest of the gesture that took it away reaches nothing either.
    if (event.type === "pointerdown") holdPress(event as PointerEvent);
    if (event.type === "keydown") holdKey(event as KeyboardEvent);
  }
  arm();
}

function swallow(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

/** Swallows this key's repeats and release, and leaves every other key alone. A fresh press of it means the release was lost (the window lost focus): the gate goes. */
function holdKey({ code }: KeyboardEvent) {
  const end = () => {
    window.removeEventListener("keydown", gate, true);
    window.removeEventListener("keyup", gate, true);
  };
  const gate = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.code !== code) return;
    if (key.type === "keydown" && !key.repeat) return end();
    swallow(event);
    if (key.type === "keyup") end();
  };
  window.addEventListener("keydown", gate, true);
  window.addEventListener("keyup", gate, true);
}

/** Swallows this pointer's release and the click it makes, whenever the release comes. A fresh press means the release was lost: the gate goes. */
function holdPress({ pointerId }: PointerEvent) {
  retireHeld?.();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const end = () => {
    window.removeEventListener("pointerup", gate, true);
    window.removeEventListener("pointercancel", gate, true);
  };
  const retire = () => {
    clearTimeout(timer);
    end();
    window.removeEventListener("pointerdown", retire, true);
    for (const name of ACTIVATION) window.removeEventListener(name, swallow, true);
    retireHeld = undefined;
  };
  retireHeld = retire;
  const gate = (event: Event) => {
    if ((event as PointerEvent).pointerId !== pointerId) return;
    end();
    swallow(event);
    timer = setTimeout(retire, CLICK_MS);
  };
  window.addEventListener("pointerup", gate, true);
  window.addEventListener("pointercancel", gate, true);
  // What this press activates, whichever its button; the next press is the person's own.
  window.addEventListener("pointerdown", retire, true);
  for (const name of ACTIVATION) window.addEventListener(name, swallow, true);
}

/** Preview: the layer now, waiting for the hand to rest. */
export function previewScreenSaver(): void {
  previewing = true;
  showLayer();
}

function startScreenSaver(): void {
  previewing = false;
  showLayer();
}

function showLayer(clockShown = showClock): void {
  if (layer) return;
  startedAt = Date.now();
  layer = document.createElement("div");
  layer.className = "mac-system-preferences-screen-saver";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  if (!listening) listen();
  // A Preview only shows the saver; one that started by itself, or the display asleep, asks for
  // the password once its time has passed. Waking before that asks nothing, as on a Mac.
  if (!previewing && lockAfterMs !== null) {
    lockDeadline = startedAt + lockAfterMs;
    lockTimer = setTimeout(lockNow, lockAfterMs);
  }
  if (!clockShown) return;
  const clock = document.createElement("span");
  clock.className = "mac-system-preferences-screen-saver-clock";
  layer.append(clock);
  const draw = () => {
    clock.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (Date.now() - startedAt < DRIFT_MS / 2) return;
    clock.style.insetInlineStart = `${10 + Math.random() * 70}%`;
    clock.style.insetBlockStart = `${10 + Math.random() * 70}%`;
  };
  draw();
  tick = setInterval(draw, DRIFT_MS);
}

function listen() {
  listening = true;
  for (const name of ACTIVITY)
    window.addEventListener(name, onActivity, { capture: true, passive: false });
}

/** Follow what the settings say. */
export function followScreenSaver(values: Readonly<Record<string, unknown>>): void {
  const minutes = values[SAVER_AFTER_KEY];
  const before = [delayMs, sleepMs];
  delayMs = typeof minutes === "number" && minutes > 0 ? minutes * 60_000 : 0;
  const sleep = values[DISPLAY_SLEEP_KEY];
  sleepMs = typeof sleep === "number" && sleep > 0 ? sleep * 60_000 : 0;
  showClock = values[SAVER_CLOCK_KEY] === true;
  lockAfterMs =
    values[REQUIRE_PASSWORD_KEY] === false
      ? null
      : (PASSWORD_DELAYS[String(values[PASSWORD_DELAY_KEY])] ??
        PASSWORD_DELAYS["5 minutes"] ??
        null);
  if ((delayMs > 0 || sleepMs > 0) && !listening) listen();
  // Other settings change while nobody touches the page (Screen Time saves each minute), and the
  // person being idle must still count.
  if (before[0] !== delayMs || before[1] !== sleepMs) arm();
}

/** Take it off the page, when the person's session ends. */
export function clearScreenSaver(): void {
  stop();
  clearTimeout(idleTimer);
  clearTimeout(sleepTimer);
  delayMs = 0;
  sleepMs = 0;
  showClock = false;
  if (!listening) return;
  listening = false;
  for (const name of ACTIVITY) window.removeEventListener(name, onActivity, { capture: true });
}
