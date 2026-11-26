import { describe, expect, it, vi } from "vitest";
import { paletteColor, TerminalEmulator } from "./terminal-emulator";

const styleAt = (emulator: TerminalEmulator, row: number, column: number) =>
  emulator.lineAt(emulator.screenTop + row)?.cells[column]?.style;

describe("half of a wide character", () => {
  const shown = (t: TerminalEmulator) =>
    (t.lineAt(t.screenTop)?.cells ?? []).map((cell) => (cell.ch === "" ? "_" : cell.ch)).join("");

  it("erasing its right half to the end of the line blanks its left", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("a日b\x1b[1;3H\x1b[K");
    expect(shown(t)).toBe("a ");
  });

  it("erasing its left half blanks its right", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("a日b\x1b[1;2H\x1b[X");
    expect(shown(t)).toBe("a  b");
  });

  it("erasing from the line's start up to its left half blanks its right", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("a日b\x1b[1;2H\x1b[1K");
    expect(shown(t)).toBe("   b");
  });

  it("deleting its right half leaves one blank column of it", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("a日b\x1b[1;3H\x1b[P");
    expect(shown(t)).toBe("a b");
  });

  it("inserting between its halves blanks both", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("a日b\x1b[1;3H\x1b[@");
    expect(shown(t)).toBe("a   b");
  });
});

describe("counts in a sequence", () => {
  it("holds a count of a billion to the screen, and is done at once", () => {
    const t = new TerminalEmulator(3, 10);
    t.write("abc");
    const started = performance.now();
    t.write("\x1b[2G\x1b[1000000000@");
    expect(t.rowText(0)).toBe("a");
    t.write("\x1b[1000000000I");
    expect(t.cursor.column).toBe(9);
    t.write("\x1b[1000000000Z");
    expect(t.cursor.column).toBe(0);
    t.write("\x1b[1000000000P\x1b[1000000000X\x1b[1000000000L\x1b[1000000000M");
    t.write("\x1b[1000000000S\x1b[1000000000T\x1b[1000000000C\x1b[1000000000B");
    expect(t.cursor).toEqual({ row: 2, column: 9 });
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("still inserts what fits", () => {
    const t = new TerminalEmulator(1, 5);
    t.write("abcde\x1b[2G\x1b[2@");
    expect(t.rowText(0)).toBe("a  bc");
  });
});

describe("a resize with the cursor waiting to wrap", () => {
  it("keeps waiting when only the height changes", () => {
    const t = new TerminalEmulator(3, 4);
    t.write("abcd");
    t.resize(2, 4);
    t.write("e");
    expect(t.rowText(0)).toBe("abcd");
    expect(t.rowText(1)).toBe("e");
    expect(t.lineAt(t.screenTop + 1)?.wrapped).toBe(true);
  });

  it("goes on after the text when the line gets wider", () => {
    const t = new TerminalEmulator(3, 4);
    t.write("abcd");
    t.resize(3, 6);
    expect(t.cursor).toEqual({ row: 0, column: 4 });
    t.write("e");
    expect(t.rowText(0)).toBe("abcde");
  });

  it("keeps waiting when the line gets narrower and the text ends at its edge", () => {
    const t = new TerminalEmulator(3, 4);
    t.write("abcd");
    t.resize(3, 2);
    expect([t.rowText(0), t.rowText(1)]).toEqual(["ab", "cd"]);
    t.write("e");
    expect(t.rowText(2)).toBe("e");
    expect(t.allText()).toBe("abcde");
  });

  it("starts waiting when a narrower line ends where the cursor is, so no text is overwritten", () => {
    const t = new TerminalEmulator(3, 10);
    t.write("abcd");
    t.resize(3, 4);
    t.write("e");
    expect(t.allText()).toContain("abcde");
    expect([t.rowText(0), t.rowText(1)]).toEqual(["abcd", "e"]);
  });

  it("does not start waiting when the cursor was not at the end of the text", () => {
    const t = new TerminalEmulator(3, 10);
    t.write("ab\x1b[8G");
    t.resize(3, 4);
    t.write("x");
    expect(t.rowText(0)).toBe("ab x");
  });
});

describe("find", () => {
  const lineNumber = (t: TerminalEmulator) => t.screenTop;

  it("answers cells, past a wide character, and its text is exactly what was asked", () => {
    const t = new TerminalEmulator(3, 20);
    t.write("界abc");
    const from = { line: lineNumber(t), column: 0 };
    expect(t.find("abc", from, 1)).toEqual({ line: lineNumber(t), start: 2, end: 5 });
    expect(t.textBetween({ line: 0, column: 2 }, { line: 0, column: 5 })).toBe("abc");
    expect(t.find("界", from, 1)).toEqual({ line: lineNumber(t), start: 0, end: 2 });
    expect(t.find("界a", from, 1)).toEqual({ line: lineNumber(t), start: 0, end: 3 });
  });

  it("finds from a cell, forward and back, ignoring case", () => {
    const t = new TerminalEmulator(3, 20);
    t.write("界ab 界AB");
    const line = lineNumber(t);
    expect(t.find("ab", { line, column: 4 }, 1)).toEqual({ line, start: 7, end: 9 });
    expect(t.find("ab", { line, column: 7 }, -1)).toEqual({ line, start: 2, end: 4 });
  });

  it("counts a combining mark in its own cell's width", () => {
    const t = new TerminalEmulator(3, 20);
    t.write("e\u0301x");
    const line = lineNumber(t);
    expect(t.find("x", { line, column: 0 }, 1)).toEqual({ line, start: 1, end: 2 });
    expect(t.find("e", { line, column: 0 }, 1)).toEqual({ line, start: 0, end: 1 });
  });

  it("goes round the buffer once, and answers null when nothing matches", () => {
    const t = new TerminalEmulator(3, 20);
    t.write("needle\r\nother");
    expect(t.find("needle", { line: 1, column: 0 }, 1)).toEqual({ line: 0, start: 0, end: 6 });
    expect(t.find("absent", { line: 0, column: 0 }, 1)).toBeNull();
  });
});

describe("the screen", () => {
  it("moves the cursor by CUP, CUU, CUD, CUF, CUB, CHA and VPA", () => {
    const t = new TerminalEmulator(5, 20);
    t.write("\x1b[3;4Hx");
    expect(t.rowText(2)).toBe("   x");
    t.write("\x1b[Aa\x1b[2Bb\x1b[2Cc\x1b[3Dd");
    expect(t.rowText(1)).toBe("    a");
    expect(t.rowText(3)).toBe("     bd c");
    t.write("\x1b[10Gg\x1b[1dh");
    expect(t.rowText(3)).toBe("     bd cg");
    expect(t.rowText(0)).toBe("          h");
  });

  it("erases to the end, to the start and the whole of a line and the screen", () => {
    const t = new TerminalEmulator(3, 10);
    t.write("abcdefgh\r\n12345678\r\nABCDEFGH");
    t.write("\x1b[2;4H\x1b[K");
    expect(t.rowText(1)).toBe("123");
    t.write("\x1b[3;4H\x1b[1K");
    expect(t.rowText(2)).toBe("    EFGH");
    t.write("\x1b[2J");
    expect([t.rowText(0), t.rowText(1), t.rowText(2)]).toEqual(["", "", ""]);
  });

  it("wraps at the last column only when the next character comes", () => {
    const t = new TerminalEmulator(3, 4);
    t.write("abcd");
    expect(t.cursor).toEqual({ row: 0, column: 3 });
    t.write("e");
    expect(t.rowText(0)).toBe("abcd");
    expect(t.rowText(1)).toBe("e");
    expect(t.lineAt(t.screenTop + 1)?.wrapped).toBe(true);
    expect(t.allText()).toBe("abcde");
  });

  it("does not wrap with auto-wrap off", () => {
    const t = new TerminalEmulator(2, 4);
    t.write("\x1b[?7labcdef");
    expect(t.rowText(0)).toBe("abcf");
    expect(t.rowText(1)).toBe("");
  });

  it("keeps the scrollback to 10,000 lines and numbers lines past those it dropped", () => {
    const t = new TerminalEmulator(2, 10);
    t.write(Array.from({ length: 10_100 }, (_, n) => `L${n}`).join("\r\n"));
    expect(t.scrollback).toHaveLength(10_000);
    expect(t.lineText(t.firstLine)).toBe("L98");
    expect(t.rowText(1)).toBe("L10099");
  });

  it("scrolls only inside a scroll region", () => {
    const t = new TerminalEmulator(4, 5);
    t.write("top\r\none\r\ntwo\r\nend");
    t.write("\x1b[2;3r\x1b[3;1H\nnew");
    expect([t.rowText(0), t.rowText(1), t.rowText(2), t.rowText(3)]).toEqual([
      "top",
      "two",
      "new",
      "end",
    ]);
    expect(t.scrollback).toHaveLength(0);
  });

  it("inserts and deletes lines and characters", () => {
    const t = new TerminalEmulator(3, 6);
    t.write("abc\r\ndef\r\nghi");
    t.write("\x1b[2;1H\x1b[L");
    expect([t.rowText(0), t.rowText(1), t.rowText(2)]).toEqual(["abc", "", "def"]);
    t.write("\x1b[M");
    expect(t.rowText(1)).toBe("def");
    t.write("\x1b[1;2H\x1b[P");
    expect(t.rowText(0)).toBe("ac");
    t.write("\x1b[2@");
    expect(t.rowText(0)).toBe("a  c");
  });

  it("shows the alternate screen without touching the normal one, or the scrollback", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("normal\r\nmore\x1b[?1049h");
    expect(t.onAlternate).toBe(true);
    expect(t.rowText(0)).toBe("");
    t.write("in alt\r\n\r\n\r\nline");
    expect(t.scrollback).toHaveLength(0);
    t.write("\x1b[?1049l");
    expect(t.onAlternate).toBe(false);
    expect([t.rowText(0), t.rowText(1)]).toEqual(["normal", "more"]);
    expect(t.cursor).toEqual({ row: 1, column: 4 });
  });

  it("reads SGR styles, the 256 colours and true colour, in both notations", () => {
    const t = new TerminalEmulator(2, 20);
    t.write("\x1b[1;3;4;9;31;42mA\x1b[0mB\x1b[38;5;196mC\x1b[48;2;1;2;255mD\x1b[38:2::9:8:7mE");
    expect(styleAt(t, 0, 0)).toEqual({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      fg: 1,
      bg: 2,
    });
    expect(styleAt(t, 0, 1)).toEqual({});
    expect(styleAt(t, 0, 2)).toEqual({ fg: 196 });
    expect(styleAt(t, 0, 3)).toEqual({ fg: 196, bg: "#0102ff" });
    expect(styleAt(t, 0, 4)).toEqual({ fg: "#090807", bg: "#0102ff" });
    expect(paletteColor(196)).toBe("#ff0000");
    expect(paletteColor(244)).toBe("#808080");
  });

  it("takes a sequence cut across two writes", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("a\x1b[3");
    t.write("1mb");
    expect(t.rowText(0)).toBe("ab");
    expect(styleAt(t, 0, 1)).toEqual({ fg: 1 });
  });

  it("gives a wide character two columns and adds a combining mark to its cell", () => {
    const t = new TerminalEmulator(2, 4);
    t.write("日x");
    expect(t.cursor.column).toBe(3);
    t.write("e\u0301");
    expect(t.lineAt(t.screenTop)?.cells[3]?.ch).toBe("e\u0301");
    expect(t.rowText(0)).toBe("日xe\u0301");
  });

  it("draws DEC line graphics", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("\x1b(0lqk\x1b(Bx");
    expect(t.rowText(0)).toBe("┌─┐x");
  });

  it("sets the title and answers status reports down the line", () => {
    const t = new TerminalEmulator(24, 80);
    const replies: string[] = [];
    t.onReply = (data) => replies.push(data);
    t.write("\x1b]0;My title\x07\x1b[10;5H\x1b[6n\x1b[5n\x1b[c");
    expect(t.title).toBe("My title");
    expect(replies).toEqual(["\x1b[10;5R", "\x1b[0n", "\x1b[?1;2c"]);
  });

  it("changes the cursor's shape and blink by DECSCUSR, and hides it by DECTCEM", () => {
    const t = new TerminalEmulator(2, 8);
    expect([t.cursorShape, t.cursorBlink]).toEqual(["block", false]);
    t.write("\x1b[3 q");
    expect([t.cursorShape, t.cursorBlink]).toEqual(["underline", true]);
    t.write("\x1b[6 q");
    expect([t.cursorShape, t.cursorBlink]).toEqual(["bar", false]);
    t.write("\x1b[?25l");
    expect(t.cursorVisible).toBe(false);
  });

  it("rings the bell", () => {
    const t = new TerminalEmulator(2, 8);
    const bell = vi.fn();
    t.onBell = bell;
    t.write("a\x07b");
    expect(bell).toHaveBeenCalledTimes(1);
    expect(t.rowText(0)).toBe("ab");
  });
});

describe("resizing", () => {
  it("wraps text anew at a new width and keeps the cursor on its character", () => {
    const t = new TerminalEmulator(4, 10);
    t.write("abcdefghijklmno\r\nxy");
    expect([t.rowText(0), t.rowText(1), t.rowText(2)]).toEqual(["abcdefghij", "klmno", "xy"]);
    t.resize(4, 5);
    expect([t.rowText(0), t.rowText(1), t.rowText(2), t.rowText(3)]).toEqual([
      "abcde",
      "fghij",
      "klmno",
      "xy",
    ]);
    expect(t.cursor).toEqual({ row: 3, column: 2 });
    t.resize(4, 20);
    expect([t.rowText(0), t.rowText(1)]).toEqual(["abcdefghijklmno", "xy"]);
    expect(t.cursor).toEqual({ row: 1, column: 2 });
  });

  it("moves lines to the scrollback when the rows shrink and back when they grow", () => {
    const t = new TerminalEmulator(3, 6);
    t.write("one\r\ntwo\r\nthree");
    t.resize(2, 6);
    expect(t.scrollback).toHaveLength(1);
    expect([t.rowText(0), t.rowText(1)]).toEqual(["two", "three"]);
    t.resize(3, 6);
    expect(t.scrollback).toHaveLength(0);
    expect([t.rowText(0), t.rowText(1), t.rowText(2)]).toEqual(["one", "two", "three"]);
    expect(t.cursor).toEqual({ row: 2, column: 5 });
  });
});

describe("the Clear commands and marks", () => {
  const filled = () => {
    const t = new TerminalEmulator(3, 10);
    t.write("one\r\ntwo\r\nthree\r\nfour\r\nfive");
    return t;
  };

  it("Clear Scrollback leaves the screen", () => {
    const t = filled();
    t.clearScrollback();
    expect(t.scrollback).toHaveLength(0);
    expect(t.rowText(2)).toBe("five");
  });

  it("Clear Screen keeps what was on it in the scrollback", () => {
    const t = filled();
    t.clearScreen();
    expect(t.rowText(0)).toBe("five");
    expect(t.scrollback.length).toBe(4);
    expect(t.allText()).toBe("one\ntwo\nthree\nfour\nfive");
  });

  it("Clear to Start drops everything above the cursor's line", () => {
    const t = filled();
    t.clearToStart();
    expect(t.allText()).toBe("five");
    expect(t.cursor.row).toBe(0);
  });

  it("Clear to Previous Mark drops only the lines from that mark down", () => {
    const t = filled();
    t.setMark(t.firstLine + 2, true);
    t.clearToPreviousMark();
    expect(t.allText()).toBe("one\ntwo\nfive");
  });

  it("finds the mark before and after a line", () => {
    const t = filled();
    t.setMark(t.firstLine + 1, true);
    t.setMark(t.firstLine + 3, true);
    expect(t.markBefore(t.firstLine + 3)).toBe(t.firstLine + 1);
    expect(t.markAfter(t.firstLine + 1)).toBe(t.firstLine + 3);
    t.setMark(t.firstLine + 1, false);
    expect(t.markBefore(t.firstLine + 3)).toBeUndefined();
  });
});

describe("a resize that would move the cursor off the screen", () => {
  it("keeps the normal screen's lines when a full-screen program shrinks the window", () => {
    const t = new TerminalEmulator(3, 10);
    t.write("one\r\ntwo\r\nthree");
    t.write("\x1b[?1049h");
    t.resize(2, 10);
    t.write("\x1b[?1049l");
    t.write("!");
    expect(t.allText()).toContain("one");
    expect(t.allText()).toContain("two");
    expect(t.allText()).toContain("three!");
  });
  it("keeps the cursor on its own line", () => {
    const t = new TerminalEmulator(4, 10);
    t.write("aaaaaaaaaa\r\nbbbbbbbbbb\r\ncccccccccc\r\ndddddddddd\x1b[1;3H");
    t.resize(4, 5);
    t.write("X");
    expect(t.rowText(0)).toBe("aaXaa");
  });
});

describe("lines with no room under a cursor high on the screen", () => {
  const screen = (t: TerminalEmulator) =>
    Array.from({ length: t.rows }, (_, row) => t.rowText(row));
  const high = () => {
    const t = new TerminalEmulator(4, 10);
    t.write("aaaaaaaaaa\r\nbbbbbbbbbb\r\ncccccccccc\r\ndddddddddd\x1b[1;3H");
    t.resize(4, 5);
    return t;
  };

  it("come back when the window widens again", () => {
    const t = high();
    expect(screen(t)).toEqual(["aaaaa", "aaaaa", "bbbbb", "bbbbb"]);
    t.resize(4, 10);
    expect(screen(t)).toEqual(["aaaaaaaaaa", "bbbbbbbbbb", "cccccccccc", "dddddddddd"]);
    expect(t.cursor).toEqual({ row: 0, column: 2 });
  });

  it("come back when the window gets taller", () => {
    const t = high();
    t.resize(6, 5);
    expect(screen(t)).toEqual(["aaaaa", "aaaaa", "bbbbb", "bbbbb", "ccccc", "ccccc"]);
  });

  it("come up as the screen scrolls", () => {
    const t = high();
    t.write("\x1b[4;1H\n");
    expect(screen(t)).toEqual(["aaaaa", "bbbbb", "bbbbb", "ccccc"]);
  });

  it("go when the screen is erased", () => {
    const t = high();
    t.write("\x1b[2J");
    t.resize(4, 10);
    expect(t.allText()).toBe("");
  });

  it("stay with a shorter window, and the cursor stays on its line", () => {
    const t = new TerminalEmulator(4, 10);
    t.write("one\r\ntwo\r\nthree\r\nfour\x1b[1;2H");
    t.resize(2, 10);
    expect(screen(t)).toEqual(["one", "two"]);
    expect(t.cursor).toEqual({ row: 0, column: 1 });
    t.resize(4, 10);
    expect(screen(t)).toEqual(["one", "two", "three", "four"]);
  });
});

describe("coming back from the alternate screen at another width", () => {
  it("wraps the shell's text anew, with the cursor on its character", () => {
    const t = new TerminalEmulator(4, 10);
    t.write("abcdefghij\r\nxy");
    t.write("\x1b[?1049h");
    t.resize(4, 5);
    t.write("inside\x1b[?1049l");
    expect([t.rowText(0), t.rowText(1), t.rowText(2)]).toEqual(["abcde", "fghij", "xy"]);
    expect(t.cursor).toEqual({ row: 2, column: 2 });
    t.write("!");
    expect(t.rowText(2)).toBe("xy!");
  });

  it("joins what it wrapped when the width grew there", () => {
    const t = new TerminalEmulator(4, 5);
    t.write("abcdefgh");
    t.write("\x1b[?1049h");
    t.resize(4, 10);
    t.write("\x1b[?1049l");
    expect(t.rowText(0)).toBe("abcdefgh");
    expect(t.cursor).toEqual({ row: 0, column: 8 });
  });

  it("leaves the lines alone when the width came back to what it was", () => {
    const t = new TerminalEmulator(4, 10);
    t.write("abcdefghij");
    t.write("\x1b[?1049h");
    t.resize(4, 5);
    t.resize(4, 10);
    t.write("\x1b[?1049l");
    expect(t.rowText(0)).toBe("abcdefghij");
  });
});

describe("resets", () => {
  it("a soft reset keeps the text and a hard reset takes it", () => {
    const t = new TerminalEmulator(2, 8);
    t.write("\x1b[?25l\x1b[1mabc");
    t.softReset();
    expect(t.cursorVisible).toBe(true);
    expect(t.rowText(0)).toBe("abc");
    t.hardReset();
    expect(t.rowText(0)).toBe("");
    expect(t.cursor).toEqual({ row: 0, column: 0 });
  });
});
