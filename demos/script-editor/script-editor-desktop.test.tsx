import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DesktopEffect, onDesktopEffects } from "../desktop/desktop-effects";
import { readScript, ScriptEditor } from "./script-editor";
import {
  callLine,
  libraryText,
  retryDelay,
  runResultOf,
  SCRIPT_EDITOR_API,
  servedSource,
} from "./script-editor-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/*
 * A test double stands in for the `macalicious-desktop` application's Script Editor module:
 * `answer` gives the reply to each request, by method and path under the module.
 */
interface Reply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}
type Answer = (method: string, path: string, body: unknown) => Reply | Promise<Reply>;

function serve(answer: Answer) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    // The drive's own routes (the version of the file a script was read from) are not the module's.
    if (!url.startsWith(SCRIPT_EDITOR_API)) {
      return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
    }
    const method = init?.method ?? "GET";
    const path = url.slice(SCRIPT_EDITOR_API.length);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const reply = await answer(method, path, body);
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(reply.headers ?? {}),
      json: async () => reply.body,
    };
  });
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal("fetch", fetch);
  return { fetch, calls };
}

const completed = {
  outcome: "completed",
  result: "2 events and 1 reminders today",
  logs: ["Event: Standup", "Reminder: Buy milk"],
  calls: [
    { action: "calendar.events", ok: true },
    { action: "files.read", ok: false, code: "not_found", message: "No such file" },
  ],
  effects: [{ open: "notes" }, { appearance: "dark" }],
  rounds: 3,
  ms: 12,
};

const DICTIONARY = {
  actions: [
    {
      name: "notes.make",
      title: "New Note",
      app: "notes",
      summary: "Makes a note.",
      takes_input: true,
      writes: true,
      params: [{ name: "title", kind: "text", required: true, summary: "The note's title" }],
    },
    {
      name: "calendar.events",
      title: "Find Calendar Events",
      app: "calendar",
      summary: "The events of a day.",
      takes_input: false,
      writes: false,
      params: [],
    },
  ],
  globals: ["Desktop", "Notes", "Calendar", "console", "input"],
};

const button = (name: string) => screen.getByRole("button", { name });
const view = (name: string) => screen.getByRole<HTMLTextAreaElement>("textbox", { name });
const script = () => screen.getByRole("textbox", { name: "Script" });
const runUnavailable = () =>
  button("Run").getAttribute("aria-disabled") === "true" || button("Run").hasAttribute("disabled");

describe("Script Editor on the desktop's Ferrite application", () => {
  it("asks no server and adds nothing when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<ScriptEditor />);
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("AppleScript");
    expect(screen.queryByRole("button", { name: "Open Script" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save Script" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Library" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opens on a JavaScript example, runs it on the server and shows its result, log and effects", async () => {
    const user = userEvent.setup();
    let finish: (reply: Reply) => void = () => {};
    const { calls } = serve(
      (_method, path) =>
        new Promise<Reply>((resolve) => {
          if (path === "/run") finish = resolve;
          else resolve({ status: 404, body: { error: "no" } });
        }),
    );
    const effects: DesktopEffect[][] = [];
    const stop = onDesktopEffects((list) => effects.push(list));
    try {
      render(<ScriptEditor />);
      expect(screen.getByRole("region", { name: "Untitled" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("JavaScript");
      expect(readScript(script())).toBe(servedSource);

      await user.click(button("Run"));
      await waitFor(() => expect(calls).toHaveLength(1));
      expect(calls[0]).toMatchObject({
        method: "POST",
        path: "/run",
        body: { code: servedSource, tz: 0 - new Date().getTimezoneOffset() },
      });
      // While the run is in flight, Run waits.
      expect(runUnavailable()).toBe(true);
      finish({ body: completed });

      await waitFor(() => expect(view("Result").value).toBe("2 events and 1 reminders today"));
      expect(runUnavailable()).toBe(false);
      await user.click(button("Log"));
      expect(view("Log").value.split("\n")).toEqual([
        "Event: Standup",
        "Reminder: Buy milk",
        "→ calendar.events ✓",
        "→ files.read ✗ not_found: No such file",
        "— completed in 12 ms",
      ]);
      expect(effects).toEqual([[{ open: "notes" }, { appearance: "dark" }]]);
    } finally {
      stop();
    }
  });

  it("shows a value that is not a string as JSON, and an error the script threw", async () => {
    const user = userEvent.setup();
    const replies = [
      { ...completed, result: { count: 2 }, effects: [] },
      { ...completed, outcome: "threw", result: null, error: "TypeError: boom", effects: [] },
    ];
    serve(() => ({ body: replies.shift() }));
    render(<ScriptEditor />);
    await user.click(button("Run"));
    await waitFor(() => expect(view("Result").value).toBe('{\n  "count": 2\n}'));
    await user.click(button("Run"));
    await waitFor(() => expect(view("Result").value).toBe("Error: TypeError: boom"));
  });

  it("sends a run again once when another script is running, then shows the server's error", async () => {
    const user = userEvent.setup();
    const busy = {
      status: 429,
      body: { error: "Another script is running." },
      headers: { "retry-after": "0" },
    };
    const replies: Reply[] = [busy, { body: completed }, busy, busy];
    const { calls } = serve(() => replies.shift() ?? busy);
    render(<ScriptEditor />);
    await user.click(button("Run"));
    await waitFor(() => expect(view("Result").value).toBe("2 events and 1 reminders today"));
    expect(calls.filter((call) => call.path === "/run")).toHaveLength(2);

    await user.click(button("Run"));
    await waitFor(() => expect(view("Result").value).toBe("Error: Another script is running."));
    expect(calls.filter((call) => call.path === "/run")).toHaveLength(4);
  });

  it("shows a failed request as an error line, never as an exception", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<ScriptEditor />);
    await user.click(button("Run"));
    await waitFor(() =>
      expect(view("Result").value).toBe("Error: The server could not be reached: Failed to fetch"),
    );
    expect(runUnavailable()).toBe(false);
  });

  it("works AppleScript without a tell block out on the page, and says so", async () => {
    const user = userEvent.setup();
    const { calls } = serve(() => ({ body: completed }));
    render(<ScriptEditor defaultSource="return 6 * 7" defaultLanguage="AppleScript" />);
    await user.click(button("Run"));
    expect(view("Result").value).toMatch(
      /^42\n\(\*This AppleScript was worked out on this page\. Only what is inside a tell application block reaches your apps/,
    );
    expect(calls).toHaveLength(0);
  });

  it("lists the scripts in the drive and opens one, named in the title", async () => {
    const user = userEvent.setup();
    const { calls } = serve((_method, path) => {
      if (path === "/scripts")
        return {
          body: {
            scripts: [
              {
                id: "f1",
                name: "Morning.js",
                path: "Documents/Scripts/Morning.js",
                size: 20,
                modified: 1,
              },
              {
                id: "f2",
                name: "Tidy.js",
                path: "Documents/Scripts/Tidy.js",
                size: 30,
                modified: 2,
              },
            ],
          },
        };
      if (path === "/scripts/f2") return { body: { id: "f2", code: "return 'tidy';" } };
      return { status: 404, body: { error: "not found" } };
    });
    render(<ScriptEditor />);
    await user.click(button("Open Script"));
    const item = await screen.findByRole("menuitem", { name: "Tidy" });
    expect(screen.getByRole("menuitem", { name: "Morning" })).toBeInTheDocument();
    await user.click(item);
    await waitFor(() => expect(readScript(script())).toBe("return 'tidy';"));
    expect(screen.getByRole("region", { name: "Tidy" })).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toEqual(["/scripts", "/scripts/f2"]);
  });

  it("asks before opening a script over unsaved changes, and opens it on Don’t Save", async () => {
    const user = userEvent.setup();
    const { calls } = serve((_method, path) => {
      if (path === "/scripts")
        return {
          body: {
            scripts: [
              {
                id: "f2",
                name: "Tidy.js",
                path: "Documents/Scripts/Tidy.js",
                size: 1,
                modified: 2,
              },
            ],
          },
        };
      if (path === "/scripts/f2") return { body: { id: "f2", code: "return 'tidy';" } };
      return { status: 404, body: { error: "not found" } };
    });
    render(<ScriptEditor />);
    await user.click(script());
    await user.keyboard("// mine");
    await user.click(button("Open Script"));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    const sheet = await screen.findByRole("dialog", { name: /keep the changes/ });
    expect(calls.map((call) => call.path)).toEqual(["/scripts"]);
    expect(
      readScript(screen.getByRole("textbox", { name: "Script", hidden: true })),
      "the sheet covers the window; the script is still the person's",
    ).toContain("// mine");
    await user.click(within(sheet).getByRole("button", { name: "Don’t Save" }));
    await waitFor(() => expect(readScript(script())).toBe("return 'tidy';"));
    expect(calls.map((call) => call.path)).toEqual(["/scripts", "/scripts/f2"]);
  });

  it("opens the script asked for once the changes are saved from the prompt", async () => {
    const user = userEvent.setup();
    const { calls } = serve((method, path, body) => {
      if (method === "GET" && path === "/scripts")
        return {
          body: {
            scripts: [
              {
                id: "f2",
                name: "Tidy.js",
                path: "Documents/Scripts/Tidy.js",
                size: 1,
                modified: 2,
              },
            ],
          },
        };
      if (method === "POST" && path === "/scripts") {
        const { name } = body as { name: string };
        return { status: 201, body: { id: `id-${name}`, path: `Documents/Scripts/${name}.js` } };
      }
      if (path === "/scripts/f2") return { body: { id: "f2", code: "return 'tidy';" } };
      return { status: 404, body: {} };
    });
    render(<ScriptEditor />);
    await user.click(script());
    await user.keyboard("// mine");
    await user.click(button("Open Script"));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    const ask = await screen.findByRole("dialog", { name: /keep the changes/ });
    await user.click(within(ask).getByRole("button", { name: "Save…" }));
    const sheet = await screen.findByRole("dialog", { name: "Save Script" });
    const name = within(sheet).getByRole("textbox", { name: "Save As:" });
    await user.clear(name);
    await user.type(name, "Mine{Enter}");
    await waitFor(() => expect(readScript(script())).toBe("return 'tidy';"));
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /scripts",
      "GET /scripts",
      "POST /scripts",
      "GET /scripts/f2",
    ]);
  });

  it("asks before the close button drops unsaved changes", async () => {
    const user = userEvent.setup();
    serve(() => ({ status: 404, body: {} }));
    const onClose = vi.fn();
    render(<ScriptEditor onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(script());
    await user.keyboard("// mine");
    await user.click(screen.getByRole("button", { name: "Close" }));
    const ask = await screen.findByRole("dialog", { name: /keep the changes/ });
    expect(ask).toHaveTextContent("Closing the window discards them.");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(within(ask).getByRole("button", { name: "Don’t Save" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("puts only the newest Open in the view when two overlap", async () => {
    const user = userEvent.setup();
    const pending: Record<string, (reply: Reply) => void> = {};
    serve((_method, path) => {
      if (path === "/scripts")
        return {
          body: {
            scripts: [
              { id: "a", name: "A.js", path: "Documents/Scripts/A.js", size: 1, modified: 1 },
              { id: "b", name: "B.js", path: "Documents/Scripts/B.js", size: 1, modified: 2 },
            ],
          },
        };
      return new Promise<Reply>((resolve) => {
        pending[path] = resolve;
      });
    });
    render(<ScriptEditor />);
    await user.click(button("Open Script"));
    await user.click(await screen.findByRole("menuitem", { name: "A" }));
    await user.click(button("Open Script"));
    await user.click(await screen.findByRole("menuitem", { name: "B" }));
    await waitFor(() => expect(Object.keys(pending)).toEqual(["/scripts/a", "/scripts/b"]));
    pending["/scripts/b"]?.({ body: { id: "b", code: "return 'b';" } });
    await waitFor(() => expect(readScript(script())).toBe("return 'b';"));
    pending["/scripts/a"]?.({ body: { id: "a", code: "return 'a';" } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(readScript(script())).toBe("return 'b';");
    expect(screen.getByRole("region", { name: "B" })).toBeInTheDocument();
  });

  it("saves the script under a name, and asks before replacing one of that name", async () => {
    const user = userEvent.setup();
    const saved: unknown[] = [];
    serve((method, path, body) => {
      if (method === "GET" && path === "/scripts")
        return {
          body: {
            scripts: [
              {
                id: "f1",
                name: "Taken.js",
                path: "Documents/Scripts/Taken.js",
                size: 1,
                modified: 1,
              },
            ],
          },
        };
      if (method === "POST" && path === "/scripts") {
        saved.push(body);
        const { name } = body as { name: string };
        return { status: 201, body: { id: `id-${name}`, path: `Documents/Scripts/${name}.js` } };
      }
      return { status: 404, body: {} };
    });
    render(<ScriptEditor />);

    await user.click(button("Save Script"));
    const sheet = await screen.findByRole("dialog", { name: "Save Script" });
    const name = within(sheet).getByRole("textbox", { name: "Save As:" });
    expect(name).toHaveValue("Untitled");
    await user.clear(name);
    await user.type(name, "Morning");
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toEqual([{ name: "Morning", code: servedSource }]));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Morning" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(button("Save Script"));
    const again = await screen.findByRole("dialog", { name: "Save Script" });
    const field = within(again).getByRole("textbox", { name: "Save As:" });
    expect(field).toHaveValue("Morning");
    await user.clear(field);
    await user.type(field, "Taken");
    await user.click(within(again).getByRole("button", { name: "Save" }));
    const ask = await screen.findByRole("dialog", { name: /“Taken” already exists/ });
    expect(saved).toHaveLength(1);
    await user.click(within(ask).getByRole("button", { name: "Replace" }));
    await waitFor(() =>
      expect(saved[1]).toEqual({ name: "Taken", code: servedSource, replace: true }),
    );
    await waitFor(() => expect(screen.getByRole("region", { name: "Taken" })).toBeInTheDocument());
  });

  it("saves once however often the name is submitted, and only on a reply that names the file", async () => {
    const user = userEvent.setup();
    let answer: ((reply: Reply) => void) | undefined;
    const posts: unknown[] = [];
    serve((method, path, body) => {
      if (method === "GET" && path === "/scripts") return { body: { scripts: [] } };
      if (method === "POST" && path === "/scripts") {
        posts.push(body);
        return new Promise<Reply>((resolve) => {
          answer = resolve;
        });
      }
      return { status: 404, body: {} };
    });
    render(<ScriptEditor />);
    await user.click(button("Save Script"));
    const sheet = await screen.findByRole("dialog", { name: "Save Script" });
    const name = within(sheet).getByRole("textbox", { name: "Save As:" });
    await user.clear(name);
    await user.type(name, "Morning{Enter}");
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(name).toBeDisabled();
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    expect(posts).toHaveLength(1);
    // The server answers 201 with nothing readable: the script is not taken as saved.
    answer?.({ status: 201, body: null });
    expect(await within(sheet).findByText(/may not be saved/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Morning" })).toBeNull();
  });

  it("leaves a newer sheet alone when an earlier save comes back", async () => {
    const user = userEvent.setup();
    let answer: ((reply: Reply) => void) | undefined;
    serve((method, path) => {
      if (method === "GET" && path === "/scripts") return { body: { scripts: [] } };
      if (method === "POST" && path === "/scripts")
        return new Promise<Reply>((resolve) => {
          answer = resolve;
        });
      return { status: 404, body: {} };
    });
    render(<ScriptEditor />);
    await user.click(button("Save Script"));
    const first = await screen.findByRole("dialog", { name: "Save Script" });
    await user.click(within(first).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(answer).toBeDefined());
    await user.click(within(first).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(button("Save Script"));
    const second = await screen.findByRole("dialog", { name: "Save Script" });
    answer?.({ status: 500, body: { error: "disk full" } });
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Save Script" })).toBe(second));
    expect(within(second).queryByText(/disk full/)).toBeNull();
  });

  it("lists what a script can call in the Library view", async () => {
    const user = userEvent.setup();
    serve((_method, path) =>
      path === "/dictionary" ? { body: DICTIONARY } : { status: 404, body: {} },
    );
    render(<ScriptEditor />);
    await user.click(button("Library"));
    expect(button("Library")).toHaveAttribute("aria-current", "true");
    await waitFor(() => expect(view("Library").value).toContain("Notes.make({ title })"));
    expect(view("Library").value).toContain("title (text, required): The note's title");
    expect(view("Library").value).toContain("Calendar.events() — Find Calendar Events");
  });
});

describe("the server's replies", () => {
  it("writes calls and outcomes as log lines, and an outcome without an error by its meaning", () => {
    expect(callLine({ action: "notes.make", ok: true })).toBe("→ notes.make ✓");
    expect(callLine({ action: "files.read", ok: false, code: "not_found" })).toBe(
      "→ files.read ✗ not_found",
    );
    const timed = runResultOf({
      outcome: "time_exhausted",
      logs: [],
      calls: [],
      effects: [],
      ms: 5,
    });
    expect(timed.failed).toBe(true);
    expect(timed.result).toBe("Error: The script ran too long and was stopped.");
    expect(runResultOf({ outcome: "completed", logs: [], calls: [], effects: [] }).result).toBe("");
  });

  it("waits as long as a 429 asks, within bounds", () => {
    expect(retryDelay(null)).toBe(1000);
    expect(retryDelay("2")).toBe(2000);
    expect(retryDelay("60")).toBe(5000);
    expect(retryDelay("soon")).toBe(1000);
  });

  it("groups the dictionary by app, under the name a script calls it by", () => {
    const text = libraryText(DICTIONARY);
    expect(text.indexOf("\nNotes\n")).toBeLessThan(text.indexOf("\nCalendar\n"));
    expect(text).toContain("(changes data, takes input)");
  });
});
