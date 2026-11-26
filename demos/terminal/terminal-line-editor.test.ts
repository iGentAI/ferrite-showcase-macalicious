import { describe, expect, it } from "vitest";
import { TerminalEmulator } from "./terminal-emulator";
import { type Completion, LineEditor } from "./terminal-line-editor";

describe("a paste at the prompt", () => {
  it("keeps control characters in the line and draws them as carets, a tab to its stop", () => {
    const terminal = new TerminalEmulator(4, 40);
    const entered: string[] = [];
    const editor = new LineEditor({
      write: (data) => terminal.write(data),
      columns: () => terminal.cols,
      rows: () => terminal.rows,
      complete: async () => ({ start: 0, candidates: [] }),
      onLine: (line) => entered.push(line),
      onInterrupt: () => {},
      onEndOfFile: () => {},
      clearScreen: () => {},
    });
    editor.start("% ");
    editor.feed("\x1b[200~a\x1b[2Jb\tc\x07\x9b\x1b[201~");
    expect(terminal.rowText(0)).toBe("% a^[[2Jb       c^G<009b>");
    expect(terminal.cursor.column).toBe(25);
    expect(editor.line).toBe("a\x1b[2Jb\tc\x07\x9b");
    editor.feed("\x7f\x7f");
    expect(terminal.rowText(0)).toBe("% a^[[2Jb       c");
    editor.feed("\r");
    expect(entered).toEqual(["a\x1b[2Jb\tc"]);
  });
});

/** An editor whose Tab answers only when the test says, as a slow drive does. */
function editorWithSlowCompletion() {
  const answers: ((completion: Completion) => void)[] = [];
  const editor = new LineEditor({
    write: () => {},
    columns: () => 80,
    rows: () => 24,
    complete: () =>
      new Promise<Completion>((resolve) => {
        answers.push(resolve);
      }),
    onLine: () => {},
    onInterrupt: () => editor.start("% "),
    onEndOfFile: () => {},
    clearScreen: () => {},
  });
  editor.start("% ");
  const answerEcho = async () => {
    answers.shift()?.({ start: 0, candidates: ["echo"] });
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { editor, answerEcho };
}

/** An editor drawing on a real terminal of 4 rows of 10 columns, and the lines it was given. */
function editorOnTerminal() {
  const terminal = new TerminalEmulator(4, 10);
  const entered: string[] = [];
  const editor = new LineEditor({
    write: (data) => terminal.write(data),
    columns: () => terminal.cols,
    rows: () => terminal.rows,
    complete: async () => ({ start: 0, candidates: [] }),
    onLine: (line) => entered.push(line),
    onInterrupt: () => {},
    onEndOfFile: () => {},
    clearScreen: () => {},
  });
  terminal.write("before\r\n");
  editor.start("% ");
  const rows = () => [0, 1, 2, 3].map((row) => terminal.rowText(row));
  return { terminal, editor, entered, rows };
}

const TALL = "abcdefgh".concat(
  "ijklmnopqr",
  "stuvwxyzAB",
  "CDEFGHIJKL",
  "MNOPQRSTUV",
  "WXYZ012345",
);

describe("a line taller than the screen", () => {
  it("shows the rows around the cursor and leaves the scrollback alone as it is typed", () => {
    const { terminal, editor, rows } = editorOnTerminal();
    for (const ch of TALL) editor.feed(ch);
    expect(rows()).toEqual(["CDEFGHIJKL", "MNOPQRSTUV", "WXYZ012345", ""]);
    expect(terminal.cursor).toEqual({ row: 3, column: 0 });
    expect(terminal.scrollback.map((line) => line.cells.map((cell) => cell.ch).join(""))).toEqual([
      "before",
    ]);
  });

  it("draws its start when the cursor goes there, and an edit there goes to the right place", () => {
    const { terminal, editor, rows } = editorOnTerminal();
    editor.feed(TALL);
    editor.feed("\x01");
    expect(rows()).toEqual(["% abcdefgh", "ijklmnopqr", "stuvwxyzAB", "CDEFGHIJKL"]);
    expect(terminal.cursor).toEqual({ row: 0, column: 2 });
    editor.feed("XY");
    expect(rows()).toEqual(["% XYabcdef", "ghijklmnop", "qrstuvwxyz", "ABCDEFGHIJ"]);
    expect(terminal.cursor).toEqual({ row: 0, column: 4 });
    expect(editor.line).toBe(`XY${TALL}`);
  });

  it("follows the cursor back and forward without moving the rows it can stay on", () => {
    const { terminal, editor, rows } = editorOnTerminal();
    editor.feed(TALL);
    editor.feed("\x02".repeat(15));
    expect(rows()).toEqual(["CDEFGHIJKL", "MNOPQRSTUV", "WXYZ012345", ""]);
    expect(terminal.cursor).toEqual({ row: 1, column: 5 });
    editor.feed("\x02".repeat(16));
    expect(rows()).toEqual(["stuvwxyzAB", "CDEFGHIJKL", "MNOPQRSTUV", "WXYZ012345"]);
    expect(terminal.cursor).toEqual({ row: 0, column: 9 });
  });

  it("goes back to a plain drawing when it fits again", () => {
    const { terminal, editor, rows } = editorOnTerminal();
    editor.feed(TALL);
    editor.feed("\x15short");
    expect(rows()).toEqual(["% short", "", "", ""]);
    expect(terminal.cursor).toEqual({ row: 0, column: 7 });
  });

  it("leaves the whole line once behind it when it is entered", () => {
    const { terminal, editor, entered } = editorOnTerminal();
    for (const ch of TALL) editor.feed(ch);
    editor.feed("\x01\x05\r");
    expect(entered).toEqual([TALL]);
    expect(terminal.allText()).toBe(`before\n% ${TALL}`);
  });

  it("draws over itself after the window narrows", () => {
    const { terminal, editor, rows } = editorOnTerminal();
    editor.feed(TALL);
    terminal.resize(4, 6);
    editor.resized();
    expect(rows()).toEqual(["OPQRST", "UVWXYZ", "012345", ""]);
    expect(terminal.cursor).toEqual({ row: 3, column: 0 });
  });
});

describe("an answer to Tab that comes late", () => {
  it("completes the line it was asked about", async () => {
    const { editor, answerEcho } = editorWithSlowCompletion();
    editor.feed("ec\t");
    await answerEcho();
    expect(editor.line).toBe("echo ");
  });

  it("leaves a line that was replaced by one with the cursor at the same place", async () => {
    const { editor, answerEcho } = editorWithSlowCompletion();
    editor.feed("ec\t");
    editor.feed("\x15ls");
    await answerEcho();
    expect(editor.line).toBe("ls");
  });

  it("leaves the new prompt's line after Control-C", async () => {
    const { editor, answerEcho } = editorWithSlowCompletion();
    editor.feed("ec\t");
    editor.feed("\x03");
    expect(editor.line).toBe("");
    editor.feed("ls");
    await answerEcho();
    expect(editor.line).toBe("ls");
  });

  it("leaves the new prompt empty after Control-C with nothing typed", async () => {
    const { editor, answerEcho } = editorWithSlowCompletion();
    editor.feed("ec\t");
    editor.feed("\x03");
    await answerEcho();
    expect(editor.line).toBe("");
  });
});
