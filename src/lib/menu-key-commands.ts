import { parseMenuKeyEquivalent } from "./menu-key-equivalent";

/**
 * Acting on the key equivalents of menu items (see `menu-key-equivalent` for how they are
 * written). A menu's items do not exist while it is closed, so the menu cannot listen for
 * them: the code that owns the commands does, with these.
 */

/** The character each key types unmodified: `KeyboardLayoutMap`, where the browser has one. */
export interface MenuKeyLayout {
  get(code: string): string | undefined;
  /** The character the key types with Shift, where that is known. */
  shifted?(code: string): string | undefined;
}

// The characters of the keys of a US keyboard that are not letters or digits, by event.code
// (Option-Space types a no-break space).
const US: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Space: " ",
};
// Those keys and the digits, each followed by the character it types with Shift.
const SHIFTED = "`~1!2@3#4$5%6^7&8*9(0)-_=+[{]}\\|;:'\",<.>/?";

const isApple = () =>
  typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);

/**
 * Whether a `keydown` event is the key equivalent. Command is the Meta key on Apple platforms
 * and the Control key elsewhere, where Meta belongs to the operating system; a key equivalent
 * that names Control as well therefore only matches on Apple platforms.
 *
 * With Option held a Mac types another character (Option-P is π, Option-/ is ÷) or starts an
 * accent (Option-E is a dead key), so `event.key` no longer names the key. On Apple platforms
 * the key is then found from its position, `event.code`: in `layout`, the user's keyboard
 * layout, when one is given, and otherwise as on a US keyboard. With Shift as well, a key
 * equivalent may name either the key or the character it types with Shift: the one the layout
 * tells, and otherwise the one above it on a US keyboard (`shift+option+=` and
 * `shift+option++` are the same keys). Elsewhere Alt leaves the character alone, and
 * `event.key` is compared.
 */
export function matchesMenuKeyEquivalent(
  event: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  equivalent: string,
  layout?: MenuKeyLayout,
): boolean {
  // "Shift+Meta+Q": the modifiers that are held, then the key.
  const held = parseMenuKeyEquivalent(equivalent).aria.split("+");
  const name = held.pop() as string;
  const key = name === "Plus" ? "+" : name === "Space" ? " " : name.toLowerCase();
  const apple = isApple();
  const command = held.includes("Meta");
  const control = held.includes("Control");
  const option = held.includes("Alt");
  if (!apple && command && control) return false;
  let typed = event.key;
  let above: string | undefined;
  let below: string | undefined;
  if (apple && option && (typed.length === 1 || typed === "Dead")) {
    const { code } = event;
    typed = layout?.get(code) ?? US[code] ?? (/^(Key|Digit)(.)$/.exec(code)?.[2] || typed);
    if (event.shiftKey) {
      above = layout?.shifted?.(code);
      for (let at = 0; !above && at < SHIFTED.length; at += 2) {
        if (SHIFTED[at] === typed) above = SHIFTED[at + 1];
      }
    }
  } else if (event.shiftKey && held.includes("Shift") && typed.length === 1) {
    // With Shift a punctuation or digit key types its shifted character (Shift-\ is "|"), while a key
    // equivalent names the key (`shift+command+\`): read the character back to the key, as on a US keyboard
    // (or the key the layout puts it on).
    below = layout?.get(event.code);
    for (let at = 1; !below && at < SHIFTED.length; at += 2) {
      if (SHIFTED[at] === typed) below = SHIFTED[at - 1];
    }
  }
  return (
    (typed.toLowerCase() === key || above?.toLowerCase() === key || below === key) &&
    event.metaKey === (apple && command) &&
    event.ctrlKey === (apple ? control : command || control) &&
    event.altKey === option &&
    event.shiftKey === held.includes("Shift")
  );
}

/**
 * Runs a command when its key equivalent is pressed anywhere in `target` (a window, document
 * or element), as AppKit does without opening the menu:
 *
 *   useEffect(() => onMenuKeyEquivalents(window, { "command+n": newNote }), [newNote]);
 *
 * The first binding that matches runs and the key's default action is prevented. A key that a
 * handler nearer the focus has already prevented, and a key that repeats while held, are left
 * alone. Option key equivalents follow the keyboard layout: the one the browser tells
 * (`navigator.keyboard`, in Chromium), and elsewhere the characters that the keys have typed
 * without a modifier, and with Shift alone, while this was listening; a key not typed yet is
 * read as on a US keyboard. Returns the function that stops listening.
 */
export function onMenuKeyEquivalents(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  bindings: Record<string, (event: KeyboardEvent) => void>,
): () => void {
  let told: MenuKeyLayout | undefined;
  // The layout as far as it has been seen, for a browser that does not tell it.
  const seen = new Map<string, string>();
  const seenShifted = new Map<string, string>();
  const layout: MenuKeyLayout = {
    get: (code) => told?.get(code) ?? seen.get(code),
    shifted: (code) => seenShifted.get(code),
  };
  const keyboard =
    typeof navigator !== "undefined" &&
    (navigator as { keyboard?: { getLayoutMap?: () => Promise<MenuKeyLayout> } }).keyboard;
  if (keyboard && isApple()) {
    keyboard.getLayoutMap?.().then(
      (map) => {
        told = map;
      },
      () => {},
    );
  }
  const onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.code && key.key.length === 1 && !(key.altKey || key.ctrlKey || key.metaKey))
      (key.shiftKey ? seenShifted : seen).set(key.code, key.key);
    if (key.defaultPrevented || key.repeat || key.isComposing) return;
    for (const equivalent in bindings) {
      if (matchesMenuKeyEquivalent(key, equivalent, layout)) {
        key.preventDefault();
        bindings[equivalent]?.(key);
        return;
      }
    }
  };
  target.addEventListener("keydown", onKeyDown);
  return () => target.removeEventListener("keydown", onKeyDown);
}
