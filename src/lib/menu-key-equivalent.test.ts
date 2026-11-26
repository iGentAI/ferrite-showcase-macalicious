import { describe, expect, it } from "vitest";
import { parseMenuKeyEquivalent } from "./menu-key-equivalent";

describe("parseMenuKeyEquivalent", () => {
  it.each([
    ["command+q", "\u2318", "Q", "Meta+Q"],
    // AppKit's order is Control, Option, Shift, Command, however the string names them.
    ["command+shift+q", "\u21E7\u2318", "Q", "Shift+Meta+Q"],
    ["Cmd+Alt+Ctrl+Shift+k", "\u2303\u2325\u21E7\u2318", "K", "Control+Alt+Shift+Meta+K"],
    ["option+command+escape", "\u2325\u2318", "\u238B", "Alt+Meta+Escape"],
    ["shift+command+delete", "\u21E7\u2318", "\u232B", "Shift+Meta+Backspace"],
    ["command+up", "\u2318", "\u2191", "Meta+ArrowUp"],
    ["command+page-down", "\u2318", "\u21DF", "Meta+PageDown"],
    ["command+,", "\u2318", ",", "Meta+,"],
    ["command++", "\u2318", "+", "Meta+Plus"],
    ["f5", "", "F5", "F5"],
    ["command+space", "\u2318", "Space", "Meta+Space"],
    // Names are read without regard to case.
    ["command+Escape", "\u2318", "\u238B", "Meta+Escape"],
  ])("%s", (equivalent, modifiers, shown, aria) => {
    expect(parseMenuKeyEquivalent(equivalent)).toEqual({ modifiers, key: shown, aria });
  });
});
