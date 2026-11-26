import { changeDesktopValue, DOCK_AUTOHIDE, desktopValues, readNumber } from "./desktop-personal";

const MUTE = "sound.mute";
const VOLUME = "sound.outputVolume";
const BRIGHTNESS = "displays.brightness";
const STEP = 10;
/** What each pane shows before the person has moved its slider. */
const LEVELS = {
  volume: { key: VOLUME, unset: 100 },
  brightness: { key: BRIGHTNESS, unset: 80.5 },
} as const;

const UP = /^(?:turn up|increase|raise) (?:the )?(volume|brightness)$/i;
const DOWN = /^(?:turn down|decrease|lower|reduce) (?:the )?(volume|brightness)$/i;

function moved(which: string, by: number): string {
  const { key, unset } = LEVELS[which.toLowerCase() as keyof typeof LEVELS];
  const level = Math.min(100, Math.max(0, (readNumber(desktopValues()[key]) ?? unset) + by));
  changeDesktopValue(key, level);
  return `The ${which.toLowerCase()} is at ${Math.round(level)}%.`;
}

/**
 * The settings Siri changes on the desktop, written where their panes keep them, so the panes show them
 * and they take effect as a change there would. Answers what to say, or `null` when `text` asks none of them.
 */
export function settingAnswer(text: string): string | null {
  if (/^mute(?: (?:the )?(?:sound|volume))?$/i.test(text)) {
    changeDesktopValue(MUTE, true);
    return "The sound is off.";
  }
  if (/^unmute(?: (?:the )?(?:sound|volume))?$/i.test(text)) {
    changeDesktopValue(MUTE, false);
    return "The sound is on.";
  }
  const up = text.match(UP)?.[1];
  if (up) return moved(up, STEP);
  const down = text.match(DOWN)?.[1];
  if (down) return moved(down, -STEP);
  const dock = text.match(/^(hide|show) (?:the )?dock$/i)?.[1];
  if (dock) {
    const hide = dock.toLowerCase() === "hide";
    changeDesktopValue(DOCK_AUTOHIDE, hide);
    return hide ? "The Dock hides until you reach for it." : "The Dock stays on the screen.";
  }
  const radio = text.match(/^turn (?:on|off) (wi-?fi|bluetooth)$/i)?.[1];
  if (radio) {
    const name = /blue/i.test(radio) ? "Bluetooth" : "Wi-Fi";
    return `A web page can’t change your computer’s ${name}. Use the settings of your own computer.`;
  }
  return null;
}

const LANGUAGE_TAGS: Readonly<Record<string, string>> = {
  "English (United Kingdom)": "en-GB",
  "English (United States)": "en-US",
  "French (France)": "fr-FR",
  "German (Germany)": "de-DE",
  Japanese: "ja-JP",
  "Spanish (Spain)": "es-ES",
};
/** How far Siri's window can move from its corner on this screen. */
export interface SiriRoom {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** `place` within `room`; on a screen too small for the window, its top left stays on it. */
export const boundSiriPlace = (place: { x: number; y: number }, room: SiriRoom) => ({
  x: Math.max(room.minX, Math.min(room.maxX, place.x)),
  y: Math.max(room.minY, Math.min(room.maxY, place.y)),
});

const ACCENT_TAGS: Readonly<Record<string, string>> = {
  American: "en-US",
  Australian: "en-AU",
  British: "en-GB",
};

/** System Preferences > Siri's Keyboard Shortcut. */
export const SIRI_SHORTCUT_KEY = "siri.keyboardShortcut";
export const HOLD_COMMAND_SPACE = "Hold Command Space";
export const HOLD_OPTION_SPACE = "Hold Option Space";
export const LEFT_COMMAND_TWICE = "Press Left Command Key Twice";
/** How soon the second press of Left Command must come, in milliseconds. */
export const COMMAND_TWICE_MS = 400;

export const readSiriShortcut = (stored: unknown): string | undefined =>
  typeof stored === "string" ? stored : undefined;

/** The keys of a press, as a key event gives them. */
interface SiriPress {
  code: string;
  repeat: boolean;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

/**
 * Whether a press asks for Siri under the chosen shortcut. Holding shows as the key's repeat.
 * `secondCommand` says this press is Left Command's second within `COMMAND_TWICE_MS`. A page never
 * sees Fn, so that choice can ask for nothing.
 */
export function asksForSiri(press: SiriPress, shortcut: string, secondCommand: boolean): boolean {
  if (shortcut === LEFT_COMMAND_TWICE) return secondCommand;
  if (press.code !== "Space" || !press.repeat || press.shiftKey || press.ctrlKey) return false;
  if (shortcut === HOLD_OPTION_SPACE) return press.altKey && !press.metaKey;
  return shortcut === HOLD_COMMAND_SPACE && press.metaKey && !press.altKey;
}

/** The language Siri listens for, as the Siri pane names it; the browser's own for any other. */
export const siriListensIn = (language: unknown): string | undefined =>
  typeof language === "string" ? LANGUAGE_TAGS[language] : undefined;

/** The language Siri speaks: the listening language, in the voice's accent when that is English. */
export function siriSpeaksIn(language: unknown, voice: unknown): string | undefined {
  const tag = siriListensIn(language);
  if (tag && !tag.startsWith("en")) return tag;
  const accent = typeof voice === "string" ? ACCENT_TAGS[voice.split(" ")[0] ?? ""] : undefined;
  return accent ?? tag;
}
