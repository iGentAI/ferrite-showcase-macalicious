import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { app, scriptEditorApp } from "./app";
import { readScript, ScriptEditor } from "./script-editor";
import {
  compile,
  defaultSource,
  handlersOf,
  run,
  sampleSource,
  styleLine,
  styleScript,
} from "./script-editor-data";

const TITLE = "Untitled (Untitled Mail Rule Action.scptd 2)";
const frame = (title = TITLE) => screen.getByRole("region", { name: title });
const button = (name: string) => screen.getByRole("button", { name });
const unavailable = (name: string) =>
  button(name).getAttribute("aria-disabled") === "true" || button(name).hasAttribute("disabled");
const script = () => screen.getByRole("textbox", { name: "Script" });
const lines = () => Array.from(script().children).map((line) => line.textContent);
const view = (name: string) => screen.getByRole<HTMLTextAreaElement>("textbox", { name });
/** The header over the accessory view. */
const header = () => document.querySelector(".mac-script-editor-header")?.textContent;
/** The runs of a line with the style each is set in. */
const runsOf = (line: number) =>
  Array.from(script().children[line]?.querySelectorAll("[data-style]") ?? []).map((piece) => [
    piece.textContent,
    piece.getAttribute("data-style"),
  ]);

/** Replace the script the way typing does: the browser leaves lines in blocks. */
const write = (text: string) => {
  script().replaceChildren(
    ...text.split("\n").map((line) => {
      const element = document.createElement("div");
      element.append(line === "" ? document.createElement("br") : line);
      return element;
    }),
  );
  fireEvent.input(script());
};

/**
 * The text of each range that `action` adds to the selection inside the script view. The
 * selection is read as it is given, because the test environment moves it afterwards when the
 * keyboard returns to the pop-up button, which a browser does not do. Scrolling is a matter
 * of layout and is held by script-editor.browser.test.tsx.
 */
const selectedDuring = async (action: () => Promise<void>) => {
  const added = vi.spyOn(document.getSelection() as Selection, "addRange");
  try {
    await action();
    return added.mock.calls
      .map(([range]) => range)
      .filter((range) => script().contains(range.commonAncestorContainer))
      .map(String);
  } finally {
    added.mockRestore();
  }
};

describe("the window", () => {
  it("opens on the script of the captures, at the captured size", () => {
    render(<ScriptEditor />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("700px");
    expect(frame().style.height).toBe("705px");
    expect(unavailable("Record")).toBe(false);
    expect(unavailable("Stop")).toBe(true);
    expect(unavailable("Run")).toBe(false);
    expect(unavailable("Compile")).toBe(false);
    expect(button("Accessory view")).toHaveAttribute("aria-pressed", "true");
    expect(button("Bundle contents")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("AppleScript");
    expect(screen.getByRole("combobox", { name: "Element" })).toHaveTextContent(
      "<No selected element>",
    );
    expect(lines()[0]).toBe('using terms from application "Mail"');
    expect(lines()[1]).toBe(
      "\ton perform mail action with messages these_messages for rule this_rule",
    );
    expect(lines()).toHaveLength(defaultSource.split("\n").length);
    expect(header()).toBe("Description");
    expect(view("Description")).toBeEmptyDOMElement();
    expect(button("Description")).toHaveAttribute("aria-current", "true");
  });

  it("sets the script in AppleScript's formatting styles", () => {
    render(<ScriptEditor />);
    expect(runsOf(0)).toEqual([
      ["using terms from", "keyword"],
      ["application", "class"],
    ]);
    expect(runsOf(1)).toEqual([
      ["on", "keyword"],
      ["perform mail action with messages", "command"],
      ["these_messages", "variable"],
      ["for rule", "parameter"],
      ["this_rule", "variable"],
    ]);
    expect(runsOf(3)).toEqual([
      ["set", "keyword"],
      ["the", "keyword"],
      ["message_count", "variable"],
      ["to", "keyword"],
      ["the", "keyword"],
      ["count", "command"],
      ["of", "keyword"],
      ["these_messages", "variable"],
    ]);
    // A block comment is one run on every line it covers, its indentation included.
    expect(runsOf(9)).toEqual([
      ["\t\t\t\tset this_sender to the sender of this_message", "comment"],
    ]);
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <ScriptEditor
        ref={ref}
        title="Untitled"
        state="inactive"
        width={520}
        height="50vh"
        className="mine"
        data-kind="app"
        onClose={onClose}
        onMinimize={onMinimize}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame("Untitled"));
    expect(frame("Untitled")).toHaveClass("mac-window", "mine");
    expect(frame("Untitled")).toHaveAttribute("data-window-state", "inactive");
    expect(frame("Untitled")).toHaveAttribute("data-kind", "app");
    expect(frame("Untitled").style.width).toBe("520px");
    expect(frame("Untitled").style.height).toBe("50vh");
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    await user.dblClick(screen.getByText("Untitled"));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("exports a descriptor a desktop can host", () => {
    expect(app).toBe(scriptEditorApp);
    expect(app.id).toBe("script-editor");
    expect(app.name).toBe("Script Editor");
    expect(app.component).toBe(ScriptEditor);
    expect(app.defaultSize).toEqual({ width: 700, height: 705 });
    expect(app.menus[0]).toBe("Script Editor");
  });
});

describe("editing and compiling", () => {
  it("indents and colours what was typed when it compiles", async () => {
    const user = userEvent.setup();
    const onCompile = vi.fn();
    render(<ScriptEditor onCompile={onCompile} />);
    write(
      'tell application "Finder"\nset the_name to "Catalina"\nif the_name is "" then\nbeep\nend if\nend tell',
    );
    // What was typed is plain until it compiles.
    expect(runsOf(0)).toEqual([]);
    await user.click(button("Compile"));
    expect(lines()).toEqual([
      'tell application "Finder"',
      '\tset the_name to "Catalina"',
      '\tif the_name is "" then',
      "\t\tbeep",
      "\tend if",
      "end tell",
    ]);
    expect(runsOf(0)).toEqual([
      ["tell", "keyword"],
      ["application", "class"],
    ]);
    expect(runsOf(3)).toEqual([["beep", "command"]]);
    expect(onCompile).toHaveBeenCalledWith(lines().join("\n"));
    // Compiling does not show another view.
    expect(header()).toBe("Description");
  });

  it("marks the window as edited until the script compiles", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);
    const dot = () => button("Close").hasAttribute("data-edited");
    expect(dot()).toBe(false);
    write("beep");
    expect(dot()).toBe(true);
    await user.click(button("Compile"));
    expect(dot()).toBe(false);
  });

  it("shows what is wrong in the Result view and leaves the script as it was typed", async () => {
    const user = userEvent.setup();
    const onCompile = vi.fn();
    render(<ScriptEditor onCompile={onCompile} />);
    write('tell application "Finder"\nbeep');
    await user.click(button("Compile"));
    expect(header()).toBe("Result");
    expect(view("Result")).toHaveValue("Syntax Error: Expected “end” but found end of script.");
    expect(button("Result")).toHaveAttribute("aria-current", "true");
    expect(lines()).toEqual(['tell application "Finder"', "beep"]);
    expect(onCompile).not.toHaveBeenCalled();
  });

  it("lists the script's handlers in the navigation bar", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);
    await user.click(screen.getByRole("combobox", { name: "Element" }));
    const handler = "perform mail action with messages these_messages for rule this_rule";
    await user.click(await screen.findByRole("option", { name: handler }));
    expect(screen.getByRole("combobox", { name: "Element" })).toHaveTextContent(handler);
  });

  it("lists the handlers of what is typed, before it compiles", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);
    write("set x to 1\non greet()\nreturn x\nend greet");
    await user.click(screen.getByRole("combobox", { name: "Element" }));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "greet()",
    ]);
    const selected = await selectedDuring(() =>
      user.click(screen.getByRole("option", { name: "greet()" })),
    );
    expect(screen.getByRole("combobox", { name: "Element" })).toHaveTextContent("greet()");
    expect(selected).toEqual(["on greet()"]);
  });

  it("selects a handler's line however the browser keeps the lines", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);
    // Bare text, two lines of one block that a <br> parts, and a line in runs.
    script().innerHTML =
      "set x to 1<div>-- greets<br>on greet()</div><div>return x</div>" +
      "<div>end greet</div><div><b>on</b> <i>part</i>()</div><div>end part</div>";
    fireEvent.input(script());
    for (const [handler, selected] of [
      ["greet()", "on greet()"],
      ["part()", "on part()"],
    ] as const) {
      await user.click(screen.getByRole("combobox", { name: "Element" }));
      const option = await screen.findByRole("option", { name: handler });
      expect(await selectedDuring(() => user.click(option))).toEqual([selected]);
    }
  });

  it("selects a handler's line in text whose lines are parted by newlines", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);
    // Bare text in the view, as after a paste of plain text: one text node, four lines.
    script().textContent = "set x to 1\non greet()\nreturn x\nend greet";
    fireEvent.input(script());
    await user.click(screen.getByRole("combobox", { name: "Element" }));
    const option = await screen.findByRole("option", { name: "greet()" });
    expect(await selectedDuring(() => user.click(option))).toEqual(["on greet()"]);
  });

  it("leaves a script in another language unstyled, and keeps what was typed", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor defaultSource={"set x to 1"} />);
    expect(runsOf(0)).toHaveLength(3);
    write("set y to 2");
    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "JavaScript" }));
    expect(runsOf(0)).toEqual([["2", "number"]]);
    expect(lines()).toEqual(["set y to 2"]);
    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "AppleScript" }));
    expect(runsOf(0)).toHaveLength(3);
  });
});

describe("running and the accessory views", () => {
  it("shows the result of a run, and what the script logged", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    const onViewChange = vi.fn();
    render(<ScriptEditor defaultSource={sampleSource} onRun={onRun} onViewChange={onViewChange} />);
    await user.click(button("Run"));
    expect(header()).toBe("Result");
    expect(view("Result")).toHaveValue('"Hello, 42"');
    expect(onRun).toHaveBeenCalledWith('"Hello, 42"');
    expect(onViewChange).toHaveBeenLastCalledWith("result");

    await user.click(button("Log"));
    expect(header()).toBe("Log");
    expect(view("Log")).toHaveValue("(*42*)");
    expect(button("Log")).toHaveAttribute("aria-current", "true");
    expect(button("Result")).toHaveAttribute("aria-current", "false");

    await user.click(button("Description"));
    expect(header()).toBe("Description");
    expect(onViewChange).toHaveBeenLastCalledWith("description");
  });

  it("runs what was typed, and shows an error of the run as the result", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<ScriptEditor onRun={onRun} />);
    write("set total to 2 + 3 * 4\ntotal / 0");
    await user.click(button("Run"));
    expect(view("Result")).toHaveValue("Error: Can’t divide by zero.");
    expect(onRun).not.toHaveBeenCalled();
    write("set total to 2 + 3 * 4\ntotal / 2");
    await user.click(button("Run"));
    expect(view("Result")).toHaveValue("7");
    expect(onRun).toHaveBeenLastCalledWith("7");
  });

  it("does not run a script in another language as AppleScript", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<ScriptEditor defaultSource={"return 1 + 1"} onRun={onRun} />);
    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "JavaScript" }));
    await user.click(button("Run"));
    expect(header()).toBe("Result");
    expect(view("Result")).toHaveValue(
      "Error: A script in JavaScript is not run on this page, only AppleScript.",
    );
    expect(onRun).not.toHaveBeenCalled();
  });

  it("keeps the description, and its styles, while another view is shown", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor defaultDescription="Files mail." />);
    expect(view("Description")).toHaveTextContent("Files mail.");
    view("Description").innerHTML = "<div>Files mail. <b>Daily.</b></div>";
    fireEvent.input(view("Description"));
    await user.click(button("Log"));
    expect(screen.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();
    await user.click(button("Description"));
    expect(view("Description")).toHaveTextContent("Files mail. Daily.");
    expect(view("Description").querySelector("b")).toHaveTextContent("Daily.");
  });

  it("hides and shows the two panes with the toolbar's toggles", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);
    await user.click(button("Accessory view"));
    expect(button("Accessory view")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();
    expect(button("Description")).toHaveAttribute("aria-current", "false");
    // Choosing a view shows the accessory view again.
    await user.click(button("Result"));
    expect(button("Accessory view")).toHaveAttribute("aria-pressed", "true");
    expect(view("Result")).toBeVisible();

    expect(screen.queryByRole("textbox", { name: "Identifier:" })).not.toBeInTheDocument();
    await user.click(button("Bundle contents"));
    expect(button("Bundle contents")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Identifier:" })).toHaveValue(
      "com.example.mail-rule-action",
    );
    // What is entered there is kept while the pane is hidden.
    await user.clear(screen.getByRole("textbox", { name: "Version:" }));
    await user.type(screen.getByRole("textbox", { name: "Version:" }), "2.5");
    await user.click(button("Bundle contents"));
    expect(screen.queryByRole("textbox", { name: "Version:" })).not.toBeInTheDocument();
    await user.click(button("Bundle contents"));
    expect(screen.getByRole("textbox", { name: "Version:" })).toHaveValue("2.5");
  });

  it("records until it is stopped, and notes it in the log", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);
    await user.click(button("Record"));
    expect(unavailable("Record")).toBe(true);
    expect(unavailable("Run")).toBe(true);
    expect(unavailable("Compile")).toBe(true);
    expect(unavailable("Stop")).toBe(false);
    await user.click(button("Stop"));
    expect(unavailable("Stop")).toBe(true);
    expect(unavailable("Run")).toBe(false);
    await user.click(button("Log"));
    expect(view("Log").value.split("\n")).toHaveLength(2);
  });
});

describe("the data", () => {
  it("styles a line without losing a character", () => {
    for (const line of defaultSource.split("\n")) {
      const joined = styleLine(line, { comment: false })
        .map((piece) => piece.text)
        .join("");
      expect(joined).toBe(line);
    }
  });

  it("tells terms from the words that begin with them", () => {
    const styles = (line: string) =>
      styleLine(line, { comment: false })
        .filter((piece) => piece.style !== "plain")
        .map((piece) => `${piece.style}:${piece.text}`);
    expect(styles("set these to the_end")).toEqual([
      "keyword:set",
      "variable:these",
      "keyword:to",
      "variable:the_end",
    ]);
    expect(styles('log "a -- b" -- note')).toEqual([
      "command:log",
      'literal:"a -- b"',
      "comment:-- note",
    ]);
    expect(styles("x (* a *) y")).toEqual(["variable:x", "comment:(* a *)", "variable:y"]);
  });

  it("carries a block comment over lines", () => {
    expect(styleScript("(* one\ntwo *) set x to 1").map((line) => line[0]?.style)).toEqual([
      "comment",
      "comment",
    ]);
  });

  it("compiles the default script to itself", () => {
    expect(compile(defaultSource)).toEqual({ ok: true, source: defaultSource });
  });

  it("indents blocks, and keeps one-line statements and comments where they are", () => {
    const compiled = compile(
      [
        "on run",
        'tell application "Finder" to beep',
        "if true then beep",
        "try",
        "beep",
        "on error",
        "(* a",
        "\tb *)",
        "end try",
        "end run",
      ].join("\n"),
    );
    expect(compiled).toEqual({
      ok: true,
      source: [
        "on run",
        '\ttell application "Finder" to beep',
        "\tif true then beep",
        "\ttry",
        "\t\tbeep",
        "\ton error",
        "\t\t(* a",
        "\t\t\tb *)",
        "\tend try",
        "end run",
      ].join("\n"),
    });
  });

  it("says what is not closed", () => {
    expect(compile("end tell")).toEqual({
      ok: false,
      error: "Syntax Error: Expected end of line, etc. but found “end”.",
    });
    expect(compile("(* never closed")).toEqual({
      ok: false,
      error: "Syntax Error: Expected “*)” but found end of script.",
    });
    expect(compile('set x to "open')).toMatchObject({ ok: false });
    expect(compile("const x = 1; return x + 1;", "JavaScript")).toEqual({
      ok: true,
      source: "const x = 1; return x + 1;",
    });
    expect(compile("anything {", "JavaScript")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^Syntax Error: /),
    });
    // It is parsed, never run.
    expect(compile("globalThis.__ran = true;", "JavaScript")).toMatchObject({ ok: true });
    expect((globalThis as { __ran?: boolean }).__ran).toBeUndefined();
  });

  it("styles JavaScript's keywords and comments, and not what is inside a string or a pattern", () => {
    const keywordsIn = (source: string) =>
      styleScript(source, "JavaScript").map((runs) =>
        runs.filter((run) => run.style === "keyword").map((run) => run.text),
      );
    expect(styleScript('const a = "b"; // c', "JavaScript")[0]).toEqual([
      { text: "const", style: "keyword" },
      { text: " a = ", style: "plain" },
      { text: '"b"', style: "string" },
      { text: "; ", style: "plain" },
      { text: "// c", style: "comment" },
    ]);
    expect(styleScript("/* d\ne */ return 1;", "JavaScript").slice(0, 2)).toEqual([
      [{ text: "/* d", style: "comment" }],
      [
        { text: "e */", style: "comment" },
        { text: " ", style: "plain" },
        { text: "return", style: "keyword" },
        { text: " ", style: "plain" },
        { text: "1", style: "number" },
        { text: ";", style: "plain" },
      ],
    ]);
    expect(styleScript("const r = /a+/g, t = `x\ny`, s = 'z', n = 4.5;", "JavaScript")).toEqual([
      [
        { text: "const", style: "keyword" },
        { text: " r = ", style: "plain" },
        { text: "/a+/g", style: "pattern" },
        { text: ", t = ", style: "plain" },
        { text: "`x", style: "template" },
      ],
      [
        { text: "y`", style: "template" },
        { text: ", s = ", style: "plain" },
        { text: "'z'", style: "string" },
        { text: ", n = ", style: "plain" },
        { text: "4.5", style: "number" },
        { text: ";", style: "plain" },
      ],
    ]);
    expect(keywordsIn("const a = `\\` return`; const b = 1;")).toEqual([["const", "const"]]);
    expect(keywordsIn('const s = "x\\\nreturn"; const t = 1;')).toEqual([["const"], ["const"]]);
    expect(keywordsIn('const v = "x\\\r\nreturn"; const w = 1;')).toEqual([["const"], ["const"]]);
    expect(keywordsIn("const r = /[/*]/;\nreturn /return/g;")).toEqual([["const"], ["return"]]);
    expect(keywordsIn("for await (const x of xs) /[/*]/.test(x);\nconst y = 1;")).toEqual([
      ["for", "await", "const", "of"],
      ["const"],
    ]);
    expect(keywordsIn("if (ok) {} /[/*]/.test(s);\nconst x = 1;")).toEqual([["if"], ["const"]]);
    const afterObject = styleScript("const o = {a: 8}.a / 2 / 1;", "JavaScript")[0];
    expect(afterObject?.filter((run) => run.style === "number").map((run) => run.text)).toEqual([
      "8",
      "2",
      "1",
    ]);
    expect(keywordsIn("if (ok) /[/*]/.test(s);\nconst x = 1;")).toEqual([["if"], ["const"]]);
    const division = styleScript("const q = (a) / b / c;", "JavaScript")[0];
    expect(division?.filter((run) => run.style === "pattern")).toEqual([]);
    expect(division?.map((run) => run.text).join("")).toBe("const q = (a) / b / c;");
  });

  it("wants a block ended by an end of its own kind", () => {
    expect(compile('tell application "Mail"\nend repeat')).toEqual({
      ok: false,
      error: "Syntax Error: Expected “end tell” but found “end repeat”.",
    });
    expect(compile("repeat 2 times\ntry\nend repeat\nend try")).toMatchObject({ ok: false });
    expect(compile("on greet(name)\nend run")).toEqual({
      ok: false,
      error: "Syntax Error: Expected “end greet” but found “end run”.",
    });
    // A bare end closes any block; a handler is ended by its name or more of its words.
    for (const source of [
      "repeat 2 times\n\ttry\n\tend\nend",
      "on greet(name)\nend greet",
      "on perform mail action with messages these\nend perform mail action with messages",
      "with timeout of 5 seconds\nend timeout",
      "if x then\nelse\nend if",
    ])
      expect(compile(source)).toEqual({ ok: true, source });
    expect(compile("on greeting()\nend greet")).toMatchObject({ ok: false });
  });

  it("takes the code after a comment that closes on a line as a statement", () => {
    expect(compile('tell application "Mail"\n(* a comment\n*) end tell')).toEqual({
      ok: true,
      source: 'tell application "Mail"\n\t(* a comment\n*) end tell',
    });
    expect(run("(* a\n*) return TRUE")).toEqual({ result: "true", failed: false, log: [] });
    expect(run("set done to False\ndone").result).toBe("false");
    expect(handlersOf("(* a\n*) on run\nend run")).toEqual([{ name: "run", line: 1 }]);
    expect(
      handlersOf("const a = 1;\nfunction one() {}\n  async function* two() {}", "JavaScript"),
    ).toEqual([
      { name: "one", line: 1 },
      { name: "two", line: 2 },
    ]);
  });

  it("takes a comment between two words as what separates them", () => {
    expect(run("return(* note *)42")).toEqual({ result: "42", failed: false, log: [] });
    expect(run("set(* a *)x(* b *)to(* c *)2\nx * 3").result).toBe("6");
    expect(handlersOf("on(* the handler *)run\nend run")).toEqual([{ name: "run", line: 0 }]);
  });

  it("writes a string result as its literal, quotes and backslashes escaped", () => {
    expect(run('return "say \\"hi\\""').result).toBe('"say \\"hi\\""');
    expect(run('"a\\\\b" & "c"').result).toBe('"a\\\\bc"');
    expect(run('display dialog "a \\"b\\""').log).toEqual(['display dialog "a \\"b\\""']);
  });

  it("works out the result of the statements at the top level", () => {
    expect(run(sampleSource)).toEqual({ result: '"Hello, 42"', failed: false, log: ["(*42*)"] });
    expect(run("(1 + 2) * -3").result).toBe("-9");
    expect(run('display dialog "Hi"')).toEqual({
      result: '{button returned:"OK"}',
      failed: false,
      log: ['display dialog "Hi"'],
    });
    expect(run("return").result).toBe("");
    // Blocks are passed over: the default script has no result.
    expect(run(defaultSource)).toEqual({ result: "", failed: false, log: [] });
    expect(run("missing + 1")).toMatchObject({
      result: "Error: The variable missing is not defined.",
      failed: true,
    });
  });

  it("finds the handlers, and not the error clauses or what is in a comment", () => {
    expect(handlersOf(defaultSource)).toEqual([
      { name: "perform mail action with messages these_messages for rule this_rule", line: 1 },
    ]);
    expect(
      handlersOf("on run\ntry\non error\nend try\nend run\nto greet(name)\nend greet"),
    ).toEqual([
      { name: "run", line: 0 },
      { name: "greet(name)", line: 5 },
    ]);
  });

  it("reads a view's lines however the browser kept them", () => {
    const view = document.createElement("div");
    view.innerHTML =
      "bare<div>in a <b>div</b></div><div><br></div><div></div><p>last\u00a0line</p>";
    expect(readScript(view)).toBe("bare\nin a div\n\n\nlast line");
  });
});

/*
 * The Font menu. jsdom has no editing commands (`document.execCommand`), so a stand-in records
 * the command each key or item asks the browser for; what the browser then does to the text is
 * held by script-editor.browser.test.tsx. Command is the Control key off Apple platforms, which
 * is what jsdom reports.
 */
describe("the Font menu", () => {
  afterEach(() => {
    delete (document as Partial<Document>).execCommand;
  });

  /** Record the editing commands asked for, with the view that has the keyboard. */
  function recordCommands() {
    const commands: [string, string | undefined][] = [];
    document.execCommand = (name: string) => {
      if (name === "styleWithCSS") return true;
      commands.push([name, document.activeElement?.getAttribute("aria-label") ?? undefined]);
      return true;
    };
    return commands;
  }

  /** Select `word` in `field`, with the keyboard there. */
  function select(field: HTMLElement, word: string) {
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue?.includes(word)) node = walker.nextNode();
    if (!node) throw new Error(`no ${word}`);
    const at = node.nodeValue?.indexOf(word) ?? 0;
    field.focus();
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + word.length);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent(document, new Event("selectionchange"));
  }

  it("styles the Description's and the script's selection from the keys", async () => {
    render(<ScriptEditor defaultDescription="Files mail daily." />);
    const commands = recordCommands();
    select(view("Description"), "daily");
    fireEvent.keyDown(view("Description"), { key: "b", ctrlKey: true });
    fireEvent.keyDown(view("Description"), { key: "i", ctrlKey: true });
    fireEvent.keyDown(view("Description"), { key: "u", ctrlKey: true });
    select(script(), "these_messages");
    fireEvent.keyDown(script(), { key: "b", ctrlKey: true });
    expect(commands).toEqual([
      ["bold", "Description"],
      ["italic", "Description"],
      ["underline", "Description"],
      ["bold", "Script"],
    ]);

    // Command-T and Shift-Command-C show the panels; Command-T hides the Fonts panel again.
    fireEvent.keyDown(script(), { key: "t", ctrlKey: true });
    expect(await screen.findByRole("region", { name: "Fonts" })).toBeInTheDocument();
    fireEvent.keyDown(script(), { key: "C", ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole("region", { name: "Colors" })).toBeInTheDocument();
    fireEvent.keyDown(script(), { key: "t", ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole("region", { name: "Fonts" })).toBeNull());
    // Without Command a key is typed.
    expect(fireEvent.keyDown(script(), { key: "b" })).toBe(true);
  });

  it("aligns the Description's and the script's paragraphs from Format > Text's keys", () => {
    render(<ScriptEditor defaultDescription="Files mail daily." />);
    const commands = recordCommands();
    select(view("Description"), "daily");
    fireEvent.keyDown(view("Description"), { key: "}", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(view("Description"), { key: "|", ctrlKey: true, shiftKey: true });
    select(script(), "these_messages");
    fireEvent.keyDown(script(), { key: "{", ctrlKey: true, shiftKey: true });
    expect(commands).toEqual([
      ["justifyRight", "Description"],
      ["justifyCenter", "Description"],
      ["justifyLeft", "Script"],
    ]);
  });

  it("loses the script's styles when it is compiled, as AppleScript's formatting takes over", async () => {
    const user = userEvent.setup();
    render(<ScriptEditor />);
    const word = script().querySelector("[data-style]");
    const text = word?.textContent ?? "";
    word?.replaceChildren(Object.assign(document.createElement("u"), { textContent: text }));
    fireEvent.input(script());
    expect(script().querySelector("u")).not.toBeNull();
    await user.click(button("Compile"));
    expect(script().querySelector("u")).toBeNull();
  });

  it("puts its commands in the desktop's Font menu, the styles at the insertion point checked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    function FontMenu() {
      const items = useDesktopAppMenuItems("script-editor", "Font");
      return (
        <MenuBar aria-label="Menus">
          <MenuBarMenu title="Font">{items}</MenuBarMenu>
        </MenuBar>
      );
    }
    render(
      <>
        <FontMenu />
        <ScriptEditor defaultDescription="Files mail daily." />
      </>,
    );
    const commands = recordCommands();
    // jsdom has no user agent stylesheet: the bold is a style of the element's own.
    view("Description").innerHTML =
      '<div>Files mail <span style="font-weight: bold">daily</span>.</div>';
    select(view("Description"), "daily");
    await user.click(screen.getByRole("menuitem", { name: "Font" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: /^Bold/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemcheckbox", { name: /^Italic/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    for (const name of [/^Show Fonts/, /^Bigger/, /^Smaller/, /^Show Colors/]) {
      expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("menuitemcheckbox", { name: /^Italic/ }));
    expect(commands).toContainEqual(["italic", "Description"]);
    await user.click(screen.getByRole("menuitem", { name: "Font" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Show Fonts/ }));
    expect(await screen.findByRole("region", { name: "Fonts" })).toBeInTheDocument();
  });

  it("puts Font and Text in the desktop's Format menu, the alignment at the insertion point checked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    function FormatMenu() {
      const items = useDesktopAppMenuItems("script-editor", "Format");
      return (
        <MenuBar aria-label="Menus">
          <MenuBarMenu title="Format">{items}</MenuBarMenu>
        </MenuBar>
      );
    }
    render(
      <>
        <FormatMenu />
        <ScriptEditor defaultDescription="Files mail daily." />
      </>,
    );
    const commands = recordCommands();
    view("Description").innerHTML = '<div style="text-align: right">Files mail daily.</div>';
    select(view("Description"), "daily");
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Text" }));
    expect(await screen.findByRole("menuitemradio", { name: /^Align Right/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: /^Justify/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Center/ }));
    expect(commands).toContainEqual(["justifyCenter", "Description"]);

    // The Font submenu holds the Font menu's commands.
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    select(view("Description"), "daily");
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Font" }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /^Underline/ }));
    expect(commands).toContainEqual(["underline", "Description"]);
  });
});
