/**
 * Key equivalents of menu items (NSMenuItem.keyEquivalent with its modifier mask), as a menu
 * shows them.
 *
 * Written as modifier names in any order and case, then the key, joined with `+`:
 *
 *   "command+q"   "shift+command+q"   "option+command+escape"   "command+up"   "command+,"
 *
 * Modifiers: `control` (`ctrl`), `option` (`alt`, `opt`), `shift`, `command` (`cmd`, `meta`).
 * Named keys: `escape`, `delete` (Backspace), `forward-delete`, `return`, `tab`, `space`,
 * `up`, `down`, `left`, `right`, `home`, `end`, `page-up`, `page-down`, `f1` to `f12`. Any
 * other key is the character it types.
 *
 * `parseMenuKeyEquivalent` gives the glyphs and the value for `aria-keyshortcuts`. To act on
 * a key equivalent, see `menu-key-commands`.
 */
export interface MenuKeyEquivalent {
  /** Modifier glyphs in AppKit's order: Control, Option, Shift, Command. */
  modifiers: string;
  /** The key as a menu shows it: an upper-case letter or a symbol. */
  key: string;
  /**
   * The same shortcut in the notation of `aria-keyshortcuts`: the modifiers that are held and
   * the key's `KeyboardEvent.key` (`Space` for the space bar and `Plus` for the plus key, as
   * ARIA names them), for example `Shift+Meta+Q`.
   */
  aria: string;
}

// Triples of a name, its glyph and its name in aria-keyshortcuts, which for a key is its
// KeyboardEvent.key. Modifiers are in the order AppKit draws them, each with its other names.
const MODIFIERS =
  "control|ctrl ⌃ Control option|alt|opt ⌥ Alt shift ⇧ Shift command|cmd|meta ⌘ Meta".split(" ");
const KEYS =
  "escape ⎋ Escape delete ⌫ Backspace forward-delete ⌦ Delete return ↩ Enter tab ⇥ Tab space Space Space up ↑ ArrowUp down ↓ ArrowDown left ← ArrowLeft right → ArrowRight home ↖ Home end ↘ End page-up ⇞ PageUp page-down ⇟ PageDown".split(
    " ",
  );

/** A key equivalent's glyphs and `aria-keyshortcuts`. */
export function parseMenuKeyEquivalent(equivalent: string): MenuKeyEquivalent {
  const parts = equivalent.trim().toLowerCase().split("+");
  // "command++" is Command and the plus key: the last two parts are empty.
  let name = parts.pop();
  if (!name) {
    parts.pop();
    name = "+";
  }
  const at = KEYS.indexOf(name);
  const named = at % 3 ? -1 : at;
  // A named key has its glyph and event name; a function key and a character are themselves.
  const key = named < 0 ? name.toUpperCase() : (KEYS[named + 1] as string);
  const aria = [named < 0 ? (key === "+" ? "Plus" : key) : (KEYS[named + 2] as string)];
  let modifiers = "";
  for (let index = MODIFIERS.length - 3; index >= 0; index -= 3) {
    if (parts.some((part) => `|${MODIFIERS[index]}|`.includes(`|${part}|`))) {
      modifiers = MODIFIERS[index + 1] + modifiers;
      aria.unshift(MODIFIERS[index + 2] as string);
    }
  }
  return { modifiers, key, aria: aria.join("+") };
}
