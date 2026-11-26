import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";

/**
 * What a key sends down the line to the program in the terminal, as xterm and Terminal send it, and
 * which keys are the shell's rather than a menu's.
 */

type KeyFields = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

const isApple = () =>
  typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);

const CSI_KEYS: Readonly<Record<string, string>> = {
  ArrowUp: "A",
  ArrowDown: "B",
  ArrowRight: "C",
  ArrowLeft: "D",
  Home: "H",
  End: "F",
};

const TILDE_KEYS: Readonly<Record<string, number>> = {
  Insert: 2,
  Delete: 3,
  PageUp: 5,
  PageDown: 6,
  F5: 15,
  F6: 17,
  F7: 18,
  F8: 19,
  F9: 20,
  F10: 21,
  F11: 23,
  F12: 24,
};

const SS3_KEYS: Readonly<Record<string, string>> = { F1: "P", F2: "Q", F3: "R", F4: "S" };

export interface KeyOptions {
  applicationCursor: boolean;
  /** Edit > Use Option as Meta Key: Option and a key send Escape and the key. */
  optionAsMeta: boolean;
}

/** The bytes a key press sends, or `null` when it sends none and is left to the page. */
export function encodeKey(event: KeyFields, options: KeyOptions): string | null {
  if (event.metaKey) return null;
  const { key } = event;
  const modifier = 1 + (event.shiftKey ? 1 : 0) + (event.altKey ? 2 : 0) + (event.ctrlKey ? 4 : 0);
  const final = CSI_KEYS[key];
  if (final) {
    if (modifier > 1) return `\x1b[1;${modifier}${final}`;
    return `\x1b${options.applicationCursor ? "O" : "["}${final}`;
  }
  const tilde = TILDE_KEYS[key];
  if (tilde) return modifier > 1 ? `\x1b[${tilde};${modifier}~` : `\x1b[${tilde}~`;
  const ss3 = SS3_KEYS[key];
  if (ss3) return modifier > 1 ? `\x1b[1;${modifier}${ss3}` : `\x1bO${ss3}`;
  const meta = event.altKey && options.optionAsMeta ? "\x1b" : "";
  if (event.altKey && !options.optionAsMeta) return null;
  switch (key) {
    case "Enter":
      return `${meta}\r`;
    case "Backspace":
      return event.ctrlKey ? `${meta}\x08` : `${meta}\x7f`;
    case "Tab":
      return event.shiftKey ? "\x1b[Z" : `${meta}\t`;
    case "Escape":
      return `${meta}\x1b`;
  }
  if (key.length !== 1 && !event.ctrlKey) return null;
  if (event.ctrlKey) {
    const control = controlCode(event);
    return control === null ? null : `${meta}${control}`;
  }
  if (event.altKey) {
    // With Option a Mac types another character, and the key's own letter is in `code`.
    const letter = /^Key([A-Z])$/.exec(event.code)?.[1]?.toLowerCase();
    const digit = /^Digit(\d)$/.exec(event.code)?.[1];
    const base = letter ? (event.shiftKey ? letter.toUpperCase() : letter) : (digit ?? key);
    return `${meta}${base}`;
  }
  return null;
}

/** The control character of Control and a key: `null` for a key that has none. */
function controlCode(event: KeyFields): string | null {
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1] ?? event.key.toUpperCase();
  if (letter.length === 1 && letter >= "A" && letter <= "Z") {
    return String.fromCharCode(letter.charCodeAt(0) - 64);
  }
  switch (event.key) {
    case " ":
    case "@":
    case "2":
      return "\x00";
    case "[":
    case "3":
      return "\x1b";
    case "\\":
    case "4":
      return "\x1c";
    case "]":
    case "5":
      return "\x1d";
    case "^":
    case "6":
      return "\x1e";
    case "_":
    case "-":
    case "7":
      return "\x1f";
    case "?":
    case "8":
      return "\x7f";
    default:
      return null;
  }
}

/**
 * Whether a key press is a menu's key equivalent, given that a terminal's Control keys are the
 * shell's. On a Mac Command is its own key and nothing clashes. Elsewhere the library reads Command
 * as Control, which would take Control-C, Control-D and the rest from the shell, so there Control
 * and a letter stay the shell's and Control-Shift and the letter is the menu's (as other terminals
 * on those systems have it); `shift+command+<letter>` items are then chosen from the menu only.
 * `hasSelection` gives Control-C to Copy while text is selected, and Control-V is always Paste.
 */
export function matchesTerminalCommand(
  event: KeyFields,
  equivalent: string,
  hasSelection: boolean,
): boolean {
  if (isApple()) return matchesMenuKeyEquivalent(event, equivalent);
  const letter = event.key.length === 1 && /^[a-z]$/i.test(event.key);
  if (letter && event.ctrlKey && !event.altKey && !event.metaKey) {
    const lower = event.key.toLowerCase();
    if (!event.shiftKey) {
      if (lower === "v" || (lower === "c" && hasSelection)) {
        return matchesMenuKeyEquivalent(event, equivalent);
      }
      return false;
    }
    return matchesMenuKeyEquivalent({ ...event, key: lower, shiftKey: false }, equivalent);
  }
  return matchesMenuKeyEquivalent(event, equivalent);
}
