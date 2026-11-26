import { afterEach, describe, expect, it, vi } from "vitest";
import { matchesMenuKeyEquivalent, onMenuKeyEquivalents } from "./menu-key-commands";

const key = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });

function platform(name: string) {
  vi.spyOn(navigator, "platform", "get").mockReturnValue(name);
}

describe("matchesMenuKeyEquivalent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("takes Command as the Meta key on Apple platforms", () => {
    platform("MacIntel");
    expect(matchesMenuKeyEquivalent(key({ key: "q", metaKey: true }), "command+q")).toBe(true);
    expect(matchesMenuKeyEquivalent(key({ key: "q", ctrlKey: true }), "command+q")).toBe(false);
    expect(
      matchesMenuKeyEquivalent(
        key({ key: "q", metaKey: true, ctrlKey: true }),
        "control+command+q",
      ),
    ).toBe(true);
  });

  it("takes Command as the Control key elsewhere", () => {
    platform("Linux x86_64");
    expect(matchesMenuKeyEquivalent(key({ key: "q", ctrlKey: true }), "command+q")).toBe(true);
    expect(matchesMenuKeyEquivalent(key({ key: "q", metaKey: true }), "command+q")).toBe(false);
    // Control and Command are one key there, so this shortcut cannot be typed.
    expect(matchesMenuKeyEquivalent(key({ key: "q", ctrlKey: true }), "control+command+q")).toBe(
      false,
    );
  });

  it("requires exactly the named modifiers", () => {
    platform("MacIntel");
    const shifted = key({ key: "Q", metaKey: true, shiftKey: true });
    expect(matchesMenuKeyEquivalent(shifted, "shift+command+q")).toBe(true);
    expect(matchesMenuKeyEquivalent(shifted, "command+q")).toBe(false);
    expect(matchesMenuKeyEquivalent(key({ key: "q", metaKey: true }), "shift+command+q")).toBe(
      false,
    );
    // The key named "shift" is not the Shift modifier of another key equivalent.
    expect(matchesMenuKeyEquivalent(key({ key: "q", shiftKey: true }), "shift+q")).toBe(true);
    expect(matchesMenuKeyEquivalent(key({ key: "Shift", shiftKey: true }), "shift+q")).toBe(false);
  });

  it("finds the key of an Option key equivalent on a Mac from its place on the keyboard", () => {
    platform("MacIntel");
    // What a Mac with a US layout sends: Option-P types π, Option-H ˙, Option-2 ™, Option-/ ÷.
    const optionP = key({ key: "\u03C0", code: "KeyP", altKey: true, metaKey: true });
    expect(matchesMenuKeyEquivalent(optionP, "option+command+p")).toBe(true);
    expect(matchesMenuKeyEquivalent(optionP, "option+command+h")).toBe(false);
    expect(
      matchesMenuKeyEquivalent(
        key({ key: "\u02D9", code: "KeyH", altKey: true, metaKey: true }),
        "option+command+h",
      ),
    ).toBe(true);
    expect(
      matchesMenuKeyEquivalent(key({ key: "\u2122", code: "Digit2", altKey: true }), "option+2"),
    ).toBe(true);
    const optionSlash = key({ key: "\u00F7", code: "Slash", altKey: true });
    expect(matchesMenuKeyEquivalent(optionSlash, "option+/")).toBe(true);
    expect(matchesMenuKeyEquivalent(optionSlash, "option+.")).toBe(false);
    expect(
      matchesMenuKeyEquivalent(key({ key: "\u00A0", code: "Space", altKey: true }), "option+space"),
    ).toBe(true);
    // Named keys are not typed characters and keep their name.
    expect(
      matchesMenuKeyEquivalent(
        key({ key: "Escape", code: "Escape", altKey: true }),
        "option+escape",
      ),
    ).toBe(true);
    // Without Option the character typed decides, whatever the layout.
    expect(
      matchesMenuKeyEquivalent(key({ key: "p", code: "KeyR", metaKey: true }), "command+p"),
    ).toBe(true);
  });

  it("finds the key of an Option dead key and of Option with Shift", () => {
    platform("MacIntel");
    // Option-E, -I, -N and -U start an accent on a Mac: the event's key is "Dead".
    const optionE = key({ key: "Dead", code: "KeyE", altKey: true });
    expect(matchesMenuKeyEquivalent(optionE, "option+e")).toBe(true);
    expect(matchesMenuKeyEquivalent(optionE, "option+n")).toBe(false);
    expect(
      matchesMenuKeyEquivalent(
        key({ key: "Dead", code: "KeyN", altKey: true, metaKey: true }),
        "option+command+n",
      ),
    ).toBe(true);
    // Shift-Option-= types ±: the key equivalent may name the key or the plus above it.
    const shiftOptionEqual = key({ key: "\u00B1", code: "Equal", altKey: true, shiftKey: true });
    expect(matchesMenuKeyEquivalent(shiftOptionEqual, "shift+option++")).toBe(true);
    expect(matchesMenuKeyEquivalent(shiftOptionEqual, "shift+option+=")).toBe(true);
    expect(matchesMenuKeyEquivalent(shiftOptionEqual, "option+=")).toBe(false);
    expect(matchesMenuKeyEquivalent(shiftOptionEqual, "shift+option+-")).toBe(false);
    // Shift-Option-/ types ¿, Shift-Option-2 types €, Shift-Option-K types an Apple logo.
    expect(
      matchesMenuKeyEquivalent(
        key({ key: "\u00BF", code: "Slash", altKey: true, shiftKey: true }),
        "shift+option+?",
      ),
    ).toBe(true);
    const shiftOption2 = key({ key: "\u20AC", code: "Digit2", altKey: true, shiftKey: true });
    expect(matchesMenuKeyEquivalent(shiftOption2, "shift+option+2")).toBe(true);
    expect(matchesMenuKeyEquivalent(shiftOption2, "shift+option+@")).toBe(true);
    expect(
      matchesMenuKeyEquivalent(
        key({ key: "\uF8FF", code: "KeyK", altKey: true, shiftKey: true, metaKey: true }),
        "shift+option+command+k",
      ),
    ).toBe(true);
  });

  it("follows the keyboard layout it is given", () => {
    platform("MacIntel");
    // AZERTY: the key in the place of the US Q types A, and the one in the place of A types Q.
    const azerty = new Map([
      ["KeyQ", "a"],
      ["KeyA", "q"],
    ]);
    const optionA = key({ key: "\u00E6", code: "KeyQ", altKey: true });
    expect(matchesMenuKeyEquivalent(optionA, "option+a", azerty)).toBe(true);
    expect(matchesMenuKeyEquivalent(optionA, "option+q", azerty)).toBe(false);
    // Without the layout the same event can only be read as on a US keyboard.
    expect(matchesMenuKeyEquivalent(optionA, "option+q")).toBe(true);
  });

  it("compares the character typed with Alt on other platforms", () => {
    platform("Win32");
    // Alt leaves the character alone there, so a layout's own letter matches, wherever it is.
    const altA = key({ key: "a", code: "KeyQ", altKey: true });
    expect(matchesMenuKeyEquivalent(altA, "option+a")).toBe(true);
    expect(matchesMenuKeyEquivalent(altA, "option+q")).toBe(false);
  });

  it("asks the browser for the keyboard layout where it can", async () => {
    platform("MacIntel");
    const getLayoutMap = vi.fn().mockResolvedValue(new Map([["KeyQ", "a"]]));
    Object.defineProperty(navigator, "keyboard", { value: { getLayoutMap }, configurable: true });
    const command = vi.fn();
    const stop = onMenuKeyEquivalents(document, { "option+a": command });
    await Promise.resolve();
    await Promise.resolve();
    document.body.dispatchEvent(key({ key: "\u00E6", code: "KeyQ", altKey: true }));
    expect(command).toHaveBeenCalledTimes(1);
    stop();
    Reflect.deleteProperty(navigator, "keyboard");
  });

  it("learns the layout from the keys typed where the browser does not tell it", () => {
    platform("MacIntel");
    const a = vi.fn();
    const q = vi.fn();
    const stop = onMenuKeyEquivalents(document, { "option+q": q, "option+a": a });
    // AZERTY again. Before the key has typed anything it is read as on a US keyboard.
    document.body.dispatchEvent(key({ key: "\u00E6", code: "KeyQ", altKey: true }));
    expect(q).toHaveBeenCalledTimes(1);
    document.body.dispatchEvent(key({ key: "a", code: "KeyQ" }));
    document.body.dispatchEvent(key({ key: "\u00E6", code: "KeyQ", altKey: true }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(q).toHaveBeenCalledTimes(1);
    stop();
  });

  it("learns what the keys type with Shift as well", () => {
    platform("MacIntel");
    const slash = vi.fn();
    const stop = onMenuKeyEquivalents(document, { "shift+option+/": slash });
    // A German keyboard: Shift-7 types a slash, and Shift-Option-7 a backslash.
    const shiftOption7 = { key: "\\", code: "Digit7", altKey: true, shiftKey: true };
    document.body.dispatchEvent(key(shiftOption7));
    expect(slash).not.toHaveBeenCalled();
    document.body.dispatchEvent(key({ key: "/", code: "Digit7", shiftKey: true }));
    document.body.dispatchEvent(key(shiftOption7));
    expect(slash).toHaveBeenCalledTimes(1);
    stop();
  });

  it("matches named keys, the space bar and the plus key by the key they are", () => {
    platform("MacIntel");
    expect(
      matchesMenuKeyEquivalent(key({ key: "Backspace", metaKey: true }), "command+delete"),
    ).toBe(true);
    expect(matchesMenuKeyEquivalent(key({ key: "ArrowUp", metaKey: true }), "command+up")).toBe(
      true,
    );
    expect(matchesMenuKeyEquivalent(key({ key: "Escape" }), "escape")).toBe(true);
    expect(matchesMenuKeyEquivalent(key({ key: " ", metaKey: true }), "command+space")).toBe(true);
    expect(matchesMenuKeyEquivalent(key({ key: "+", metaKey: true }), "command++")).toBe(true);
    expect(matchesMenuKeyEquivalent(key({ key: "+" }), "command++")).toBe(false);
  });

  it("matches a Shift key equivalent on a punctuation or digit key by the key, whatever it types", () => {
    // Shift-\ types "|" and Shift-1 types "!": Safari's Show Tab Overview is shift+command+\.
    for (const name of ["Linux x86_64", "MacIntel"]) {
      platform(name);
      const command = name === "MacIntel" ? { metaKey: true } : { ctrlKey: true };
      const pipe = key({ key: "|", code: "Backslash", shiftKey: true, ...command });
      expect(matchesMenuKeyEquivalent(pipe, "shift+command+\\"), name).toBe(true);
      expect(matchesMenuKeyEquivalent(pipe, "command+\\"), name).toBe(false);
      expect(matchesMenuKeyEquivalent(pipe, "shift+command+/"), name).toBe(false);
      const bang = key({ key: "!", code: "Digit1", shiftKey: true, ...command });
      expect(matchesMenuKeyEquivalent(bang, "shift+command+1"), name).toBe(true);
      // Without Shift the character typed still decides.
      expect(
        matchesMenuKeyEquivalent(key({ key: "\\", code: "Backslash", ...command }), "command+\\"),
        name,
      ).toBe(true);
      vi.restoreAllMocks();
    }
  });
});

describe("onMenuKeyEquivalents", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs the matching command, prevents the default and stops when told", () => {
    platform("MacIntel");
    const newNote = vi.fn();
    const find = vi.fn();
    const stop = onMenuKeyEquivalents(document, { "command+n": newNote, "command+f": find });

    const pressed = key({ key: "n", metaKey: true });
    document.body.dispatchEvent(pressed);
    expect(newNote).toHaveBeenCalledTimes(1);
    expect(find).not.toHaveBeenCalled();
    expect(pressed.defaultPrevented).toBe(true);

    const other = key({ key: "x", metaKey: true });
    document.body.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);

    stop();
    document.body.dispatchEvent(key({ key: "n", metaKey: true }));
    expect(newNote).toHaveBeenCalledTimes(1);
  });

  it("leaves a key that was already handled, and a repeating key, alone", () => {
    platform("MacIntel");
    const command = vi.fn();
    const stop = onMenuKeyEquivalents(document, { "command+n": command });
    const handled = key({ key: "n", metaKey: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    document.body.dispatchEvent(key({ key: "n", metaKey: true, repeat: true }));
    expect(command).not.toHaveBeenCalled();
    stop();
  });
});
