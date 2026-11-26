import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/a11y";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { type DesktopDrag, landingAt } from "../desktop/desktop-drag";
import { onDesktopEffects } from "../desktop/desktop-effects";
import type { Drive, DriveEntry } from "../desktop/desktop-files";
import { readKeptText } from "../desktop/desktop-kept-text";
import {
  beginDesktopValues,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { DesktopAutomator } from "./automator-desktop";
import { KEPT_WORKFLOW } from "./automator-draft";
import {
  csvToSql,
  DIMMED_ACTIONS,
  entryAtPath,
  fileIsKind,
  PAGE_ACTIONS,
  type PageQuestion,
  renamed,
  runPageAction,
} from "./automator-page";
import {
  ACTIONS_URL,
  applyChange,
  defaultParams,
  libraryFromServer,
  paramsToSend,
  RUN_URL,
  RUNS_URL,
  type RunLog,
  recentlyAddedActions,
  type ServerAction,
  WORKFLOWS_URL,
  type Workflow,
  withInput,
  withNewActions,
} from "./automator-server";

/*
 * A test double stands in for the server half (`ferrite-apps/desktop/src/apps/automator`): `serve`
 * stubs `fetch` with the routes' documented answers, keeps the workflows under a revision as
 * `document.rs` does (a PUT on another revision answers 409 with the stored ones), and records
 * every request. The window is the real one, with the real library components.
 */

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  forgetDesktopValues();
  beginDesktopValues();
});

const text = (name: string, summary = ""): ServerAction["params"][number] => ({
  name,
  kind: "text",
  required: false,
  summary,
});

const ACTIONS: ServerAction[] = [
  {
    name: "notes.make",
    title: "New Note",
    app: "notes",
    summary: "Makes a note in Notes. Without text, the input becomes the note.",
    takes_input: true,
    writes: true,
    params: [text("title", "The first line"), text("text", "The body"), text("folder")],
  },
  {
    name: "reminders.add",
    title: "New Reminders Item",
    app: "reminders",
    summary: "Adds a reminder. Without a title, each input item becomes one.",
    takes_input: true,
    writes: true,
    params: [
      text("title"),
      { name: "due", kind: "day", required: false, summary: "today, tomorrow, a weekday" },
      { name: "time", kind: "time", required: false, summary: "5pm, 17:00" },
    ],
  },
  {
    name: "calendar.events",
    title: "Find Calendar Events",
    app: "calendar",
    summary: "The events of a day, or of several days from it.",
    takes_input: false,
    writes: false,
    params: [
      { name: "day", kind: "day", required: false, summary: "" },
      { name: "days", kind: "number", required: false, summary: "How many days" },
    ],
  },
  {
    name: "finder.write",
    title: "New Text File",
    app: "finder",
    summary: "Writes a text file in your drive.",
    takes_input: true,
    writes: true,
    params: [
      text("path"),
      { name: "replace", kind: "boolean", required: false, summary: "Replace a file" },
    ],
  },
  {
    name: "system.appearance",
    title: "Change System Appearance",
    app: "system-preferences",
    summary: "Switches the desktop to Light or Dark, or back to Auto.",
    takes_input: false,
    writes: true,
    params: [{ name: "mode", kind: "choice:light|dark|auto|toggle", required: true, summary: "" }],
  },
  {
    name: "launchpad.open",
    title: "Launch Application",
    app: "launchpad",
    summary: "Opens an application on the desktop when the run ends.",
    takes_input: false,
    writes: false,
    params: [{ name: "app", kind: "text", required: true, summary: "Its name" }],
  },
  {
    name: "javascript.run",
    title: "Run JavaScript",
    app: "script-editor",
    summary: "Runs JavaScript with the input as `input`.",
    takes_input: true,
    writes: true,
    params: [{ name: "code", kind: "code", required: true, summary: "The script" }],
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The page's zone as the server reads it: minutes east of UTC (0, not -0, at UTC). */
const tz = () => -new Date().getTimezoneOffset() || 0;

const runLog = (more: Partial<RunLog> = {}): RunLog => ({
  id: "run-1",
  workflow: "w",
  name: "Untitled",
  trigger: "manual",
  started: Date.now(),
  ms: 20,
  ok: false,
  steps: [
    {
      action: "notes.make",
      title: "New Note",
      status: "completed",
      items: 1,
      preview: ["Groceries"],
      ms: 12,
    },
    {
      action: "reminders.add",
      title: "New Reminders Item",
      status: "failed",
      message: "a reminder needs a title",
      items: 0,
      preview: [],
      ms: 3,
    },
    {
      action: "launchpad.open",
      title: "Launch Application",
      status: "skipped",
      items: 0,
      preview: [],
      ms: 0,
    },
  ],
  output: [],
  ...more,
});

const workflow = (id: string, name: string, more: Partial<Workflow> = {}): Workflow => ({
  id,
  name,
  kind: "workflow",
  steps: [{ action: "notes.make", params: { title: name } }],
  enabled: true,
  ...more,
});

interface Sent {
  method: string;
  path: string;
  // biome-ignore lint/suspicious/noExplicitAny: the recorded JSON bodies are read field by field
  body: any;
}

interface FakeServer {
  requests: Sent[];
  library: unknown;
  rev: number;
  runs: RunLog[];
  onPut?: (body: Sent["body"]) => Response | Promise<Response>;
  onRun?: (body: Sent["body"]) => Response | Promise<Response>;
  onGetWorkflows?: () => Response | Promise<Response>;
  onRuns?: () => Response | Promise<Response>;
  onFiles?: (method: string, path: string, body: Sent["body"]) => Response;
}

/** Serve the desktop's Automator routes from memory, and say the page is served. */
function serve(setup: Partial<FakeServer> = {}): FakeServer {
  const server: FakeServer = { requests: [], library: null, rev: 0, runs: [], ...setup };
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://desktop.test");
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    server.requests.push({ method, path: pathname, body });
    if (pathname === ACTIONS_URL) return json({ actions: ACTIONS });
    if (pathname === WORKFLOWS_URL && method === "GET") {
      if (server.onGetWorkflows) return server.onGetWorkflows();
      return json({ library: server.library, rev: server.rev, session: "session-1" });
    }
    if (pathname === WORKFLOWS_URL && method === "PUT") {
      if (server.onPut) return server.onPut(body);
      if (body.rev !== server.rev) {
        return json(
          { library: server.library, rev: server.rev, error: "the document has changed" },
          409,
        );
      }
      server.library = body.library;
      server.rev += 1;
      return json({ library: server.library, rev: server.rev });
    }
    if (pathname === RUN_URL && method === "POST") {
      return server.onRun ? server.onRun(body) : json(runLog());
    }
    if (pathname === RUNS_URL) {
      if (server.onRuns) return server.onRuns();
      return json({ runs: server.runs });
    }
    if (pathname === "/api/automator/locations") return json({ locations: {}, rev: 0 });
    if (pathname.startsWith("/api/files") && server.onFiles) {
      return server.onFiles(method, pathname, body);
    }
    return json({ error: "not found" }, 404);
  });
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  return server;
}

const puts = (server: FakeServer) => server.requests.filter((sent) => sent.method === "PUT");
const posts = (server: FakeServer) => server.requests.filter((sent) => sent.method === "POST");

const list = (name = "Actions") => screen.getByRole("grid", { name });
const listed = () =>
  within(list())
    .queryAllByRole("row")
    .map((row) => row.textContent);
const outline = () => screen.getByRole("treegrid", { name: "Action categories" });
const button = (name: string) => screen.getByRole("button", { name });
const unavailable = (element: HTMLElement) =>
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("disabled") ||
  element.hasAttribute("data-disabled");
const step = (title: string) => screen.getByRole("group", { name: title });
const workflowArea = () => screen.getByRole("region", { name: "Workflow" });
const status = () => within(screen.getByRole("group", { name: "Document" })).getByRole("status");
const popUp = (name: string) => screen.getByRole("combobox", { name });
const cells = (name = "Log") =>
  within(list(name))
    .queryAllByRole("row")
    .map((row) =>
      within(row)
        .queryAllByRole("gridcell")
        .map((cell) => cell.textContent),
    )
    .filter((row) => row.length > 0);

type User = ReturnType<typeof userEvent.setup>;

async function choose(user: User, name: string, option: string) {
  await user.click(popUp(name));
  await user.click(await screen.findByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("option", { name: option })).toBeNull());
}

/** Open the window and wait for the server's library. */
async function openWindow() {
  const user = userEvent.setup();
  render(<DesktopAutomator />);
  await waitFor(() => expect(listed()).toContain("New Note"));
  return user;
}

async function addStep(user: User, title: string) {
  const search = screen.getByRole("searchbox", { name: "Search" });
  fireEvent.change(search, { target: { value: title } });
  await user.dblClick(within(list()).getByText(title));
  fireEvent.change(search, { target: { value: "" } });
  return step(title);
}

describe("Automator's steps by drag and by key", () => {
  const titles = () =>
    within(workflowArea())
      .queryAllByRole("group")
      .map((group) => group.getAttribute("aria-label"));
  const chosen = () =>
    within(workflowArea())
      .queryAllByRole("group")
      .filter((group) => group.getAttribute("aria-current") === "true")
      .map((group) => group.getAttribute("aria-label"));
  const press = (key: string, options: KeyboardEventInit = {}) =>
    fireEvent.keyDown(document.activeElement ?? document.body, { key, ...options });

  /** A drag's data as a browser carries it from dragstart to drop. */
  function dataTransfer() {
    const held = new Map<string, string>();
    return {
      get types() {
        return [...held.keys()];
      },
      setData: (type: string, value: string) => held.set(type, value),
      getData: (type: string) => held.get(type) ?? "",
      setDragImage: () => undefined,
      effectAllowed: "",
      dropEffect: "",
    };
  }

  /** Lay the steps out 100 points apart and drop what is dragged at height `y`. */
  function dropAt(transfer: ReturnType<typeof dataTransfer>, y: number) {
    const area = workflowArea();
    area.querySelectorAll("[data-step-key]").forEach((item, index) => {
      item.getBoundingClientRect = () =>
        ({ top: index * 100, height: 100, bottom: index * 100 + 100 }) as DOMRect;
    });
    for (const make of [createEvent.dragOver, createEvent.drop]) {
      const event = make(area, { dataTransfer: transfer });
      Object.defineProperty(event, "clientY", { value: y });
      fireEvent(area, event);
    }
  }

  const libraryRow = (title: string) => within(list()).getByText(title);
  const dragFromLibrary = (title: string, y: number) => {
    const transfer = dataTransfer();
    fireEvent.dragStart(libraryRow(title), { dataTransfer: transfer });
    dropAt(transfer, y);
  };

  it("drops an action from the library at the place it is let go, with several together", async () => {
    serve();
    const user = await openWindow();
    dragFromLibrary("New Note", 0);
    expect(titles()).toEqual(["New Note"]);
    dragFromLibrary("Run JavaScript", 500);
    expect(titles()).toEqual(["New Note", "Run JavaScript"]);
    // Above the middle of the second step: between the two.
    dragFromLibrary("Launch Application", 120);
    expect(titles()).toEqual(["New Note", "Launch Application", "Run JavaScript"]);

    await user.click(libraryRow("Find Calendar Events"));
    await user.keyboard("{Control>}");
    await user.click(libraryRow("New Reminders Item"));
    await user.keyboard("{/Control}");
    expect(
      within(screen.getByRole("region", { name: "Description" })).getByText("2 Actions Selected"),
    ).toBeInTheDocument();
    dragFromLibrary("New Reminders Item", 0);
    expect(titles()).toEqual([
      "Find Calendar Events",
      "New Reminders Item",
      "New Note",
      "Launch Application",
      "Run JavaScript",
    ]);
    expect(chosen()).toEqual(["Find Calendar Events", "New Reminders Item"]);
  });

  it("reorders steps by their heads, several together, and Undo puts them back", async () => {
    serve();
    const user = await openWindow();
    for (const title of ["New Note", "Run JavaScript", "Launch Application"]) {
      await addStep(user, title);
    }
    const head = (title: string) =>
      step(title).querySelector(".mac-automator-step-head") as HTMLElement;
    let transfer = dataTransfer();
    fireEvent.dragStart(head("Launch Application"), { dataTransfer: transfer });
    dropAt(transfer, 0);
    fireEvent.dragEnd(head("Launch Application"), { dataTransfer: transfer });
    expect(titles()).toEqual(["Launch Application", "New Note", "Run JavaScript"]);

    await user.click(head("Launch Application"));
    await user.keyboard("{Control>}");
    await user.click(head("New Note"));
    await user.keyboard("{/Control}");
    transfer = dataTransfer();
    fireEvent.dragStart(head("New Note"), { dataTransfer: transfer });
    dropAt(transfer, 500);
    fireEvent.dragEnd(head("New Note"), { dataTransfer: transfer });
    expect(titles()).toEqual(["Run JavaScript", "Launch Application", "New Note"]);

    press("z", { ctrlKey: true });
    expect(titles()).toEqual(["Launch Application", "New Note", "Run JavaScript"]);
    press("z", { ctrlKey: true, shiftKey: true });
    expect(titles()).toEqual(["Run JavaScript", "Launch Application", "New Note"]);
  });

  it("gives the library's search the keyboard on Option-Command-F", async () => {
    serve();
    await openWindow();
    press("f", { ctrlKey: true, altKey: true });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search" })),
    );
  });

  it("takes the selected steps out with Delete, cuts, copies and pastes them, by key", async () => {
    serve();
    const user = await openWindow();
    for (const title of ["New Note", "Run JavaScript"]) await addStep(user, title);
    await user.click(step("New Note").querySelector(".mac-automator-step-name") as HTMLElement);
    expect(document.activeElement).toBe(workflowArea());
    expect(chosen()).toEqual(["New Note"]);

    press("c", { ctrlKey: true });
    expect(status()).toHaveTextContent("Copied 1 step.");
    press("v", { ctrlKey: true });
    expect(titles()).toEqual(["New Note", "New Note", "Run JavaScript"]);
    press("Backspace");
    expect(titles()).toEqual(["New Note", "Run JavaScript"]);
    press("ArrowDown");
    expect(chosen()).toEqual(["New Note"]);
    press("ArrowDown");
    expect(chosen()).toEqual(["Run JavaScript"]);
    press("x", { ctrlKey: true });
    expect(titles()).toEqual(["New Note"]);
    press("v", { ctrlKey: true });
    expect(titles()).toEqual(["New Note", "Run JavaScript"]);
    press("a", { ctrlKey: true });
    expect(chosen()).toEqual(["New Note", "Run JavaScript"]);
    press("Delete");
    expect(titles()).toEqual([]);
    press("z", { ctrlKey: true });
    expect(titles()).toEqual(["New Note", "Run JavaScript"]);
  });

  it("leaves the editing keys to a text field and takes a typed value back as one Undo", async () => {
    serve();
    const user = await openWindow();
    const note = await addStep(user, "New Note");
    const title = within(note).getByRole("textbox", { name: "title" });
    await user.type(title, "Milk");
    expect(title).toHaveFocus();
    press("Backspace");
    expect(titles()).toEqual(["New Note"]);
    await user.click(note.querySelector(".mac-automator-step-name") as HTMLElement);
    press("z", { ctrlKey: true });
    expect(within(step("New Note")).getByRole("textbox", { name: "title" })).toHaveValue("");
    press("z", { ctrlKey: true, shiftKey: true });
    expect(within(step("New Note")).getByRole("textbox", { name: "title" })).toHaveValue("Milk");
  });

  it("takes back only the latest typing once the keyboard has left the setting", async () => {
    serve();
    const user = await openWindow();
    const note = await addStep(user, "New Note");
    const stepName = note.querySelector(".mac-automator-step-name") as HTMLElement;
    const title = within(note).getByRole("textbox", { name: "title" });
    await user.type(title, "Milk");
    await user.click(stepName);
    await user.type(title, " tea");
    await user.click(stepName);
    press("z", { ctrlKey: true });
    expect(title).toHaveValue("Milk");
    press("z", { ctrlKey: true });
    expect(title).toHaveValue("");
  });

  it("starts a new Undo for typing after a save with the keyboard still in the setting", async () => {
    serve();
    const user = await openWindow();
    const note = await addStep(user, "New Note");
    const title = within(note).getByRole("textbox", { name: "title" });
    await user.type(title, "Milk");
    press("s", { ctrlKey: true });
    await waitFor(() => expect(status()).toHaveTextContent("Saved"));
    await user.type(title, " tea");
    await user.click(note.querySelector(".mac-automator-step-name") as HTMLElement);
    press("z", { ctrlKey: true });
    expect(title).toHaveValue("Milk");
  });

  it("has no more than the server's steps, however many are pasted", async () => {
    serve();
    const user = await openWindow();
    await addStep(user, "New Note");
    await user.click(step("New Note").querySelector(".mac-automator-step-name") as HTMLElement);
    press("c", { ctrlKey: true });
    for (let count = 0; count < 32; count++) press("v", { ctrlKey: true });
    expect(titles()).toHaveLength(32);
    expect(status()).toHaveTextContent("A workflow has at most 32 steps.");
  });

  it("runs on Command-R and saves on Command-S from anywhere in the window", async () => {
    const server = serve();
    const user = await openWindow();
    await addStep(user, "New Note");
    press("r", { ctrlKey: true });
    await waitFor(() => expect(posts(server)).toHaveLength(1));
    expect(posts(server)[0]?.path).toBe(RUN_URL);
    press("s", { ctrlKey: true });
    await waitFor(() => expect(puts(server)).toHaveLength(1));
    expect(puts(server)[0]?.body.library.workflows[0].steps[0].action).toBe("notes.make");
  });
});

describe("Automator's rows in the menu bar", () => {
  it("has the workflow and its unsaved changes back after a reload", async () => {
    serve();
    const user = await openWindow();
    await addStep(user, "New Note");
    // At once: a reload right after a change has it.
    await waitFor(() => expect(readKeptText(KEPT_WORKFLOW)).toContain("notes.make"));
    cleanup();
    await openWindow();
    expect(await within(workflowArea()).findByRole("group", { name: "New Note" })).toBeVisible();
  });

  it("has a workflow larger than one value back whole after a reload", async () => {
    serve();
    const user = await openWindow();
    await addStep(user, "New Note");
    const words = "café words ".repeat(1000);
    const field = within(step("New Note")).getAllByRole("textbox")[0] as HTMLElement;
    fireEvent.change(field, { target: { value: words } });
    await waitFor(() => expect(readKeptText(KEPT_WORKFLOW)).toContain(words));
    for (const value of Object.values(desktopValues())) {
      expect(new TextEncoder().encode(JSON.stringify(value)).length).toBeLessThanOrEqual(4096);
    }
    cleanup();
    await openWindow();
    const back = within(await within(workflowArea()).findByRole("group", { name: "New Note" }));
    expect(back.getAllByRole("textbox")[0]).toHaveValue(words);
  });

  it("says when a workflow is too long to keep, and keeps the version before it", async () => {
    serve();
    const user = await openWindow();
    await addStep(user, "New Note");
    const field = within(step("New Note")).getAllByRole("textbox")[0] as HTMLElement;
    fireEvent.change(field, { target: { value: "short" } });
    await waitFor(() => expect(readKeptText(KEPT_WORKFLOW)).toContain("short"));
    fireEvent.change(field, { target: { value: "x".repeat(100_000) } });
    expect(await screen.findByText(/too long to keep across a reload/)).toBeVisible();
    expect(readKeptText(KEPT_WORKFLOW)).toContain("short");
  });

  /** The rows the window registered, in a menu bar as the desktop's shows them. */
  function Bar() {
    return (
      <MenuBar>
        {["File", "Edit", "View", "Workflow", "Action"].map((title) => (
          <OneMenu key={title} title={title} />
        ))}
      </MenuBar>
    );
  }
  function OneMenu({ title }: { title: string }) {
    return <MenuBarMenu title={title}>{useDesktopAppMenuItems("automator", title)}</MenuBarMenu>;
  }

  const titles = () =>
    within(workflowArea())
      .queryAllByRole("group")
      .map((group) => group.getAttribute("aria-label"));

  async function openMenu(user: User, menu: string) {
    await user.click(within(screen.getByRole("menubar")).getByRole("menuitem", { name: menu }));
  }
  async function chooseRow(user: User, menu: string, row: string) {
    await openMenu(user, menu);
    await user.click(await screen.findByRole("menuitem", { name: new RegExp(`^${row}`) }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  }
  async function withBar() {
    await openWindow();
    render(<Bar />);
    return userEvent.setup({ pointerEventsCheck: 0 });
  }

  it("gives Edit back to the steps when the keyboard moves from a setting to the title bar", async () => {
    serve();
    const user = await withBar();
    const note = await addStep(user, "New Note");
    const title = within(note).getByRole("textbox", { name: "title" });
    await user.type(title, "Milk");
    act(() => screen.getByRole("button", { name: "Run" }).focus());
    await chooseRow(user, "Edit", "Copy");
    expect(status()).toHaveTextContent("Copied 1 step.");
    await chooseRow(user, "Edit", "Paste");
    expect(titles()).toEqual(["New Note", "New Note"]);
    expect(title).toHaveValue("Milk");
  });

  it("moves, disables, collapses and deletes the selected step from the Action menu", async () => {
    serve();
    const user = await withBar();
    for (const title of ["New Note", "Run JavaScript"]) await addStep(user, title);
    await chooseRow(user, "Action", "Move Up");
    expect(titles()).toEqual(["Run JavaScript", "New Note"]);
    await chooseRow(user, "Action", "Move Down");
    expect(titles()).toEqual(["New Note", "Run JavaScript"]);
    await chooseRow(user, "Action", "Disable");
    expect(
      within(step("Run JavaScript")).getByRole("checkbox", { name: "Enabled" }),
    ).not.toBeChecked();
    await chooseRow(user, "Action", "Enable");
    expect(within(step("Run JavaScript")).getByRole("checkbox", { name: "Enabled" })).toBeChecked();
    await chooseRow(user, "Action", "Collapse");
    expect(within(step("Run JavaScript")).queryByRole("textbox", { name: "code" })).toBeNull();
    await chooseRow(user, "Action", "Expand");
    expect(within(step("Run JavaScript")).getByRole("textbox", { name: "code" })).toBeVisible();
    await chooseRow(user, "Action", "Delete");
    expect(titles()).toEqual(["New Note"]);
  });

  it("opens a step's Results and Options, and sends Ignore Input with the run", async () => {
    const server = serve();
    const user = await withBar();
    await addStep(user, "Run JavaScript");
    await openMenu(user, "Action");
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Results" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    const results = () =>
      within(step("Run JavaScript")).getByRole("group", {
        name: "Results of Run JavaScript",
      });
    expect(results()).toHaveTextContent("Run the workflow to see what this action gives.");
    await user.click(within(step("Run JavaScript")).getByRole("button", { name: "Options" }));
    await user.click(
      within(step("Run JavaScript")).getByRole("checkbox", { name: "Ignore this action's input" }),
    );
    await user.type(within(step("Run JavaScript")).getByRole("textbox", { name: "code" }), "1");
    server.onRun = () =>
      json(
        runLog({
          steps: [
            {
              action: "javascript.run",
              title: "Run JavaScript",
              status: "completed",
              items: 2,
              preview: ["one", "two"],
              ms: 1,
            },
          ],
          ok: true,
        }),
      );
    await user.click(button("Run"));
    await waitFor(() => expect(results()).toHaveTextContent("2 items"));
    expect(results()).toHaveTextContent("one");
    expect(posts(server).at(-1)?.body.workflow.steps[0].ignore_input).toBe(true);
  });

  it("opens a saved workflow from File, duplicates it and reverts to what was saved", async () => {
    const server = serve({
      library: { workflows: [workflow("w1", "Groceries")] },
      rev: 3,
    });
    const user = await withBar();
    await waitFor(() => expect(popUp("Open Workflow")).not.toHaveAttribute("data-disabled"));
    await chooseRow(user, "File", "Open…");
    await user.click(
      within(await screen.findByRole("grid", { name: "Saved workflows" })).getByText("Groceries"),
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(status()).toHaveTextContent("Opened “Groceries”."));
    expect(titles()).toEqual(["New Note"]);

    await addStep(user, "Run JavaScript");
    await openMenu(user, "File");
    await user.click(await screen.findByRole("menuitem", { name: "Revert To" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Last Saved" }));
    await waitFor(() => expect(titles()).toEqual(["New Note"]));

    await chooseRow(user, "File", "Duplicate");
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("Groceries copy");
    await chooseRow(user, "File", "Save");
    await waitFor(() => expect(puts(server)).toHaveLength(1));
    expect(puts(server)[0]?.body.library.workflows.map((each: Workflow) => each.name)).toEqual([
      "Groceries",
      "Groceries copy",
    ]);
  });

  it("shows and hides the library, the log and the toolbar from View", async () => {
    serve();
    const user = await withBar();
    await chooseRow(user, "View", "Hide Log");
    expect(screen.queryByRole("grid", { name: "Log" })).toBeNull();
    await chooseRow(user, "View", "Show Log");
    expect(screen.getByRole("grid", { name: "Log" })).toBeInTheDocument();
    await chooseRow(user, "View", "Hide Toolbar");
    expect(screen.queryByRole("toolbar", { name: "Toolbar" })).toBeNull();
    await chooseRow(user, "View", "Show Toolbar");
    expect(screen.getByRole("toolbar", { name: "Toolbar" })).toBeInTheDocument();
  });

  /** The server's answer to a run: each step completed, handing on its `gives` items. */
  const stepsRun =
    (gives: Record<string, string[]>) =>
    (body: { workflow: Workflow }, id = `run-${body.workflow.steps.length}-${Math.random()}`) =>
      json(
        runLog({
          id,
          ok: true,
          workflow: body.workflow.id,
          steps: body.workflow.steps.map((sent) => ({
            action: sent.action,
            title: ACTIONS.find((each) => each.name === sent.action)?.title ?? sent.action,
            status: "completed" as const,
            items: gives[sent.action]?.length ?? 0,
            preview: gives[sent.action] ?? [],
            ms: 5,
          })),
        }),
      );
  const logTexts = () => cells().map(([text]) => text);
  const sentSteps = (server: FakeServer) =>
    posts(server).map((sent) =>
      sent.body.workflow.steps.map((each: Workflow["steps"][number]) => each.action),
    );

  it("steps through a workflow, a request for each action, handing each one the last one's items", async () => {
    const server = serve({
      onRun: stepsRun({ "notes.make": ["one", "two"], "javascript.run": ["three"] }),
    });
    const user = await withBar();
    await addStep(user, "New Note");
    await addStep(user, "New Reminders Item");
    await addStep(user, "Run JavaScript");
    expect(unavailable(button("Stop"))).toBe(true);

    await chooseRow(user, "Workflow", "Step");
    await waitFor(() => expect(logTexts()).toEqual(["New Note completed, 2 items: one, two"]));
    expect(unavailable(button("Stop"))).toBe(false);
    expect(status()).toHaveTextContent("Next: New Reminders Item.");

    await user.click(button("Step"));
    await waitFor(() => expect(logTexts()).toHaveLength(2));
    expect(sentSteps(server)).toEqual([["notes.make"], ["text.get", "reminders.add"]]);
    expect(posts(server)[1]?.body.workflow.steps[0].params).toEqual({ text: "one\ntwo" });
    expect(logTexts()[1]).toBe("New Reminders Item completed, 0 items");
    expect(within(workflowArea()).getAllByRole("img", { name: "Completed" })).toHaveLength(2);

    // The last step's own output goes on the log's end, and nothing is left to stop.
    await user.click(button("Step"));
    await waitFor(() =>
      expect(logTexts().slice(2)).toEqual([
        "Run JavaScript completed, 1 item: three",
        "Workflow completed",
      ]),
    );
    expect(unavailable(button("Stop"))).toBe(true);
    expect(unavailable(button("Step"))).toBe(false);
  });

  it("goes on with Run from where Step paused, and does not do the done steps twice", async () => {
    const server = serve({ onRun: stepsRun({ "notes.make": ["one"] }) });
    const user = await withBar();
    await addStep(user, "New Note");
    await addStep(user, "New Reminders Item");
    await addStep(user, "Run JavaScript");
    await user.click(button("Step"));
    await waitFor(() => expect(unavailable(button("Stop"))).toBe(false));
    await user.click(button("Run"));
    await waitFor(() => expect(unavailable(button("Run"))).toBe(false));
    await waitFor(() => expect(logTexts().at(-1)).toBe("Workflow completed"));
    expect(sentSteps(server)).toEqual([
      ["notes.make"],
      ["text.get", "reminders.add", "javascript.run"],
    ]);
    expect(logTexts()[0]).toBe("New Note completed, 1 item: one");
    expect(unavailable(button("Stop"))).toBe(true);
  });

  it("ends a stepped run with Stop, and Step then begins again from the first action", async () => {
    const server = serve({ onRun: stepsRun({ "notes.make": ["one"] }) });
    const user = await withBar();
    await addStep(user, "New Note");
    await addStep(user, "New Reminders Item");
    await user.click(button("Step"));
    await waitFor(() => expect(unavailable(button("Stop"))).toBe(false));
    await chooseRow(user, "Workflow", "Stop");
    expect(logTexts()).toEqual([
      "New Note completed, 1 item: one",
      "Stopped before New Reminders Item",
    ]);
    expect(unavailable(button("Stop"))).toBe(true);
    expect(posts(server)).toHaveLength(1);
    await user.click(button("Step"));
    await waitFor(() => expect(posts(server)).toHaveLength(2));
    expect(sentSteps(server)[1]).toEqual(["notes.make"]);
  });

  it("stops stepping rather than hand on less than a step gave", async () => {
    const server = serve({
      onRun: async (body) => {
        const answer = await stepsRun({ "notes.make": ["1", "2", "3", "4", "5"] })(body).json();
        answer.steps[0].items = 7;
        return json(answer);
      },
    });
    const user = await withBar();
    await addStep(user, "New Note");
    await addStep(user, "New Reminders Item");
    await user.click(button("Step"));
    await waitFor(() => expect(logTexts()[1]).toMatch(/^Stopped before New Reminders Item: /));
    expect(unavailable(button("Stop"))).toBe(true);
    expect(posts(server)).toHaveLength(1);
  });

  it("dims Record and the commands a web page cannot carry out, each with its reason under it", async () => {
    serve();
    const user = await withBar();
    await openMenu(user, "Workflow");
    for (const [row, reason] of [
      ["Record", /what you do in other applications/],
      ["Import Actions…", /cannot load an action bundle/],
    ] as const) {
      const item = await screen.findByRole("menuitem", { name: new RegExp(`^${row}`) });
      expect(unavailable(item)).toBe(true);
      expect(item).toHaveAccessibleDescription(reason);
    }
    expect(screen.getByRole("menuitem", { name: /^Stop/ })).toHaveAttribute(
      "title",
      expect.stringContaining("The server runs a workflow as a whole"),
    );
    await user.keyboard("{Escape}");
    await openMenu(user, "File");
    const item = await screen.findByRole("menuitem", { name: "Move To…" });
    expect(unavailable(item)).toBe(false);
    await user.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(await screen.findByRole("menuitem", { name: "AirDrop" })).toHaveAccessibleDescription(
      /nearby devices/,
    );
  });

  it("asks for the document's type on File > New, the plug-ins dimmed with why", async () => {
    serve();
    const user = await withBar();
    await addStep(user, "New Note");
    await chooseRow(user, "File", "New");
    const sheet = await screen.findByRole("dialog", { name: /Choose a type/ });
    expect(within(sheet).getByRole("radio", { name: "Workflow" })).toBeChecked();
    for (const [type, reason] of [
      ["Print Plugin", "print dialog"],
      ["Image Capture Plugin", "camera or a scanner"],
      ["Dictation Command", "speech service"],
    ] as const) {
      const radio = within(sheet).getByRole("radio", { name: type });
      expect(unavailable(radio)).toBe(true);
      expect(radio.closest(".mac-automator-type")).toHaveTextContent(reason);
    }
    for (const type of ["Application", "Quick Action", "Folder Action", "Calendar Alarm"]) {
      expect(unavailable(within(sheet).getByRole("radio", { name: type }))).toBe(false);
    }
    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(titles()).toEqual(["New Note"]);
    await chooseRow(user, "File", "New");
    const again = await screen.findByRole("dialog", { name: /Choose a type/ });
    await user.click(within(again).getByRole("radio", { name: "Quick Action" }));
    await user.click(await screen.findByRole("button", { name: "Choose" }));
    // Over unsaved steps the window still asks what becomes of them.
    await user.click(await screen.findByRole("button", { name: /Don.t Save/ }));
    await waitFor(() => expect(titles()).toEqual([]));
    expect(popUp("Workflow type")).toHaveTextContent("Quick Action");
    expect(popUp("Quick Action receives")).toHaveTextContent("files or folders");
  });

  it("converts the workflow in the window with File > Convert To…", async () => {
    serve();
    const user = await withBar();
    await addStep(user, "New Note");
    await chooseRow(user, "File", "Convert To");
    const sheet = await screen.findByRole("dialog", { name: /Choose a type/ });
    await user.click(within(sheet).getByRole("radio", { name: "Application" }));
    await user.click(within(sheet).getByRole("button", { name: "Choose" }));
    await waitFor(() => expect(popUp("Workflow type")).toHaveTextContent("Application"));
    expect(titles()).toEqual(["New Note"]);
    expect(screen.getByText(/A web page cannot make a real application/)).toBeInTheDocument();
  });

  it("renames a step: its head, its log and what the server keeps", async () => {
    const server = serve({ onRun: stepsRun({}) });
    const user = await withBar();
    await addStep(user, "New Note");
    await chooseRow(user, "Action", "Rename Action");
    const sheet = await screen.findByRole("dialog", { name: /Rename the action/ });
    await user.type(within(sheet).getByRole("textbox", { name: "Action name" }), "Jot it down");
    await user.click(within(sheet).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(titles()).toEqual(["Jot it down"]));

    await user.click(button("Run"));
    await waitFor(() => expect(logTexts()[0]).toBe("Jot it down completed, 0 items"));
    await user.click(button("Save Workflow"));
    await waitFor(() => expect(puts(server)).toHaveLength(1));
    const sentStep = puts(server)[0]?.body.library.workflows[0].steps[0];
    expect(sentStep?.params).toEqual({ step_name: "Jot it down" });

    // Opened again, the name is the step's and is not one of its settings.
    await user.click(button("New Workflow"));
    await choose(user, "Open Workflow", "Untitled");
    await waitFor(() => expect(titles()).toEqual(["Jot it down"]));
    expect(screen.queryByRole("textbox", { name: "step_name" })).toBeNull();

    // Empty goes back to the action's own name.
    await user.click(within(step("Jot it down")).getByText("Jot it down"));
    await chooseRow(user, "Action", "Rename Action");
    const again = await screen.findByRole("dialog", { name: /Rename the action/ });
    await user.clear(within(again).getByRole("textbox", { name: "Action name" }));
    await user.click(within(again).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(titles()).toEqual(["New Note"]));
  });

  it("shows which step hands its output to which, not to a step that ignores it", async () => {
    serve();
    const user = await openWindow();
    await addStep(user, "New Note");
    await addStep(user, "Find Calendar Events");
    await addStep(user, "New Reminders Item");
    await addStep(user, "Run JavaScript");
    const arrows = () =>
      within(workflowArea())
        .queryAllByRole("img", { name: /hands its output/ })
        .map((arrow) => arrow.getAttribute("aria-label"));
    expect(arrows()).toEqual([
      "Find Calendar Events hands its output to New Reminders Item",
      "New Reminders Item hands its output to Run JavaScript",
    ]);
    await user.click(within(step("Run JavaScript")).getByRole("button", { name: "Options" }));
    await user.click(screen.getByRole("checkbox", { name: "Ignore this action's input" }));
    expect(arrows()).toEqual(["Find Calendar Events hands its output to New Reminders Item"]);
    const showWhenRun = screen.getByRole("checkbox", { name: /Show this action when/ });
    expect(unavailable(showWhenRun)).toBe(false);
  });

  it("gives Results from the workflow's last run when none has run in this window", async () => {
    const stored = workflow("errands", "Errands");
    serve({
      library: { workflows: [stored], tz: 0 },
      runs: [
        runLog({
          workflow: "errands",
          steps: [
            {
              action: "notes.make",
              title: "New Note",
              status: "completed",
              items: 1,
              preview: ["From the last run"],
              ms: 1,
            },
          ],
        }),
      ],
    });
    const user = await withBar();
    await waitFor(() => expect(unavailable(popUp("Open Workflow"))).toBe(false));
    await choose(user, "Open Workflow", "Errands");
    await user.click(within(step("New Note")).getByRole("button", { name: "Results" }));
    expect(within(step("New Note")).getByText("From the last run")).toBeVisible();
  });

  it("lists the actions a person uses most in Most Used", async () => {
    serve({
      library: {
        workflows: [
          workflow("a", "A", {
            steps: [
              { action: "reminders.add", params: {} },
              { action: "reminders.add", params: {} },
              { action: "notes.make", params: {} },
            ],
          }),
        ],
        tz: 0,
      },
    });
    const user = await openWindow();
    await waitFor(() => expect(unavailable(popUp("Open Workflow"))).toBe(false));
    await user.click(within(outline()).getByText("Most Used"));
    expect(listed()).toEqual(["New Note", "New Reminders Item"]);
    await user.click(within(outline()).getByText("Recently Added"));
    expect(listed()).toEqual([]);
  });

  it("keeps when the library first had an action, and lists new ones in Recently Added", () => {
    const [one, two] = ACTIONS as [ServerAction, ServerAction];
    const first = withNewActions(null, [one], 1000);
    expect(first).toEqual({ [one.name]: 0 });
    expect(withNewActions(first, [one], 2000)).toBe(first);
    const next = withNewActions(first, [one, two], 2000);
    expect(next).toEqual({ [one.name]: 0, [two.name]: 2000 });
    expect(recentlyAddedActions([one, two], next, 3000)).toEqual([two]);
    const fortyDays = 40 * 24 * 60 * 60 * 1000;
    expect(recentlyAddedActions([one, two], next, 2000 + fortyDays)).toEqual([]);
  });

  it("adds and finds an action from its row's menu", async () => {
    serve();
    const user = await openWindow();
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "Note");
    fireEvent.contextMenu(within(list()).getByText("New Note"));
    await user.click(await screen.findByRole("menuitem", { name: "Add to Workflow" }));
    expect(step("New Note")).toBeVisible();
    fireEvent.contextMenu(within(list()).getByText("New Note"));
    await user.click(await screen.findByRole("menuitem", { name: "Find in Library" }));
    await waitFor(() => expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue(""));
    expect(listed()[0]).toEqual("New Note");
    expect(
      within(screen.getByRole("region", { name: "Description" })).getByRole("heading", {
        name: "New Note",
      }),
    ).toBeVisible();
  });

  it("shows only the toolbar items the person keeps, across windows", async () => {
    serve();
    const user = await withBar();
    await chooseRow(user, "View", "Customize Toolbar");
    const sheet = await screen.findByRole("dialog", { name: /items the toolbar shows/ });
    await user.click(within(sheet).getByRole("checkbox", { name: "Media" }));
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const toolbar = screen.getByRole("toolbar", { name: "Toolbar" });
    expect(within(toolbar).queryByRole("button", { name: "Media" })).toBeNull();
    expect(within(toolbar).getByRole("button", { name: "Run" })).toBeVisible();
    expect(desktopValues()["automator.toolbarHidden"]).toEqual(["Media"]);
  });
  it("keeps the toolbar's order, and the default set puts it back", async () => {
    serve();
    const user = await withBar();
    const labels = () =>
      [
        ...screen
          .getByRole("toolbar", { name: "Toolbar" })
          .querySelectorAll(".mac-toolbar-labelled-item"),
      ].map((each) => each.textContent?.trim());
    expect(labels()[0]).toBe("Library");
    await chooseRow(user, "View", "Customize Toolbar");
    const sheet = await screen.findByRole("dialog", { name: /items the toolbar shows/ });
    await user.click(within(sheet).getByRole("button", { name: "Move Library Later" }));
    expect(labels().slice(0, 2)).toEqual(["Media", "Library"]);
    expect(desktopValues()["automator.toolbarOrder"]).toEqual([
      "Media",
      "Library",
      "Flexible Space",
      "Record",
      "Step",
      "Stop",
      "Run",
    ]);
    await user.click(within(sheet).getByRole("button", { name: "Use Default Set" }));
    expect(labels().slice(0, 2)).toEqual(["Library", "Media"]);
  });

  it("shows a step's Results as a table, and keeps that", async () => {
    const server = serve();
    const user = await withBar();
    await addStep(user, "Run JavaScript");
    await openMenu(user, "Action");
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Results" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await user.type(within(step("Run JavaScript")).getByRole("textbox", { name: "code" }), "1");
    server.onRun = () =>
      json(
        runLog({
          steps: [
            {
              action: "javascript.run",
              title: "Run JavaScript",
              status: "completed",
              items: 2,
              preview: ["one", "two"],
              ms: 1,
            },
          ],
          ok: true,
        }),
      );
    await user.click(button("Run"));
    const results = () =>
      within(step("Run JavaScript")).getByRole("group", { name: "Results of Run JavaScript" });
    await waitFor(() => expect(results()).toHaveTextContent("2 items"));
    await user.click(within(results()).getByText("Table"));
    const table = within(results()).getByRole("grid", { name: "Items of Run JavaScript" });
    const rows = within(table)
      .getAllByRole("row")
      .map((row) => row.textContent);
    expect(rows).toEqual(["#Item", "1one", "2two"]);
    expect(desktopValues()["automator.resultsTable"]).toBe(true);
  });
});

describe("Automator on the desktop's Ferrite application", () => {
  it("asks no server and shows the invented library when the page is not served", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopAutomator stepInterval={0} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(listed()[0]).toBe("Activate Fonts");
    expect(screen.queryByRole("button", { name: "Save Workflow" })).toBeNull();
  });

  it("lists the server's actions, grouped in the outline by the app they belong to", async () => {
    const server = serve();
    const user = await openWindow();
    expect(server.requests[0]).toMatchObject({ method: "GET", path: ACTIONS_URL });
    // What the server runs comes first, in order of title; none of the invented ones.
    expect(listed().slice(0, 7)).toEqual([
      "Change System Appearance",
      "Find Calendar Events",
      "Launch Application",
      "New Note",
      "New Reminders Item",
      "New Text File",
      "Run JavaScript",
    ]);
    expect(
      within(outline())
        .getAllByRole("row")
        .map((row) => row.textContent),
    ).toEqual([
      "Library",
      "Calendar",
      "Contacts",
      "Developer",
      "Files & Folders",
      "Fonts",
      "Internet",
      "Mail",
      "Movies",
      "Music",
      "PDFs",
      "Photos",
      "Text",
      "Utilities",
      "Most Used",
      "Recently Added",
    ]);
    await user.click(within(outline()).getByText("Utilities"));
    expect(listed().slice(0, 3)).toEqual([
      "Change System Appearance",
      "Launch Application",
      "Run JavaScript",
    ]);
    await user.click(within(list()).getByText("Run JavaScript"));
    const pane = within(screen.getByRole("region", { name: "Description" }));
    expect(pane.getByRole("heading", { name: "Run JavaScript" })).toBeInTheDocument();
    expect(pane.getByText("Settings:").nextElementSibling).toHaveTextContent("code");
    // The search field narrows the category by title.
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "launch");
    expect(listed()).toEqual(["Launch Application"]);
  });

  it("adds steps by double click and by the gear, each with its settings as controls", async () => {
    serve();
    const user = await openWindow();
    const note = await addStep(user, "New Note");
    await user.type(within(note).getByRole("textbox", { name: "title" }), "Groceries");
    expect(within(note).getByRole("textbox", { name: "title" })).toHaveValue("Groceries");
    expect(within(note).getByRole("textbox", { name: "text" })).toHaveValue("");
    expect(within(note).getByRole("checkbox", { name: "Enabled" })).toBeChecked();

    // From the keyboard: the selected action, through the gear's command.
    await user.click(within(list()).getByText("Run JavaScript"));
    await user.click(button("Action"));
    await user.click(await screen.findByRole("menuitem", { name: "Add to Workflow" }));
    const script = step("Run JavaScript");
    expect(within(script).getByRole("textbox", { name: "code" }).tagName).toBe("TEXTAREA");

    // A choice is a pop-up button that starts on its first choice when one is required; a
    // boolean is a checkbox titled with its name.
    const appearance = await addStep(user, "Change System Appearance");
    expect(within(appearance).getByRole("combobox", { name: "mode" })).toHaveTextContent("light");
    const file = await addStep(user, "New Text File");
    expect(within(file).getByRole("checkbox", { name: "replace" })).not.toBeChecked();

    expect(
      within(workflowArea())
        .getAllByRole("listitem")
        .filter((item) => item.hasAttribute("data-step-key"))
        .map((item) => item.textContent?.match(/^\d+/)?.[0]),
    ).toEqual(["1", "2", "3", "4"]);
    await user.click(button("Remove Run JavaScript"));
    expect(screen.queryByRole("group", { name: "Run JavaScript" })).toBeNull();
  });

  it("runs the workflow on the server and logs each step, its output and how it ended", async () => {
    let answer!: (response: Response) => void;
    const server = serve({
      onRun: () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    const user = await openWindow();
    expect(unavailable(button("Run"))).toBe(true);
    const note = await addStep(user, "New Note");
    await user.type(within(note).getByRole("textbox", { name: "title" }), "Groceries");
    await addStep(user, "New Reminders Item");
    const launch = await addStep(user, "Launch Application");
    await user.type(within(launch).getByRole("textbox", { name: "app" }), "Notes");
    await user.click(within(launch).getByRole("checkbox", { name: "Enabled" }));

    await user.click(button("Run"));
    expect(posts(server)).toHaveLength(1);
    expect(posts(server)[0]).toMatchObject({ path: RUN_URL });
    expect(posts(server)[0]?.body).toEqual({
      workflow: {
        id: expect.stringMatching(/^[0-9a-f]{32}$/),
        name: "Untitled",
        kind: "workflow",
        steps: [
          { action: "notes.make", params: { title: "Groceries" } },
          { action: "reminders.add", params: {} },
          { action: "launchpad.open", params: { app: "Notes" }, enabled: false },
        ],
        enabled: true,
      },
      tz: tz(),
    });
    // While the server runs it, Run is unavailable, Stop has nothing to stop, and the steps
    // that run carry the running disc.
    expect(unavailable(button("Run"))).toBe(true);
    expect(unavailable(button("Stop"))).toBe(true);
    expect(within(workflowArea()).getAllByRole("img", { name: "Running" })).toHaveLength(2);
    expect(cells()).toEqual([["Running the workflow on the server…", ""]]);

    await act(async () => answer(json(runLog({ output: ["Groceries"] }))));
    await waitFor(() => expect(unavailable(button("Run"))).toBe(false));
    expect(cells()).toEqual([
      ["New Note completed, 1 item: Groceries", "0.012 seconds"],
      ["New Reminders Item failed: a reminder needs a title", "0.003 seconds"],
      ["Launch Application skipped", ""],
      ["Output: Groceries", ""],
      ["Workflow failed", "0.020 seconds"],
    ]);
    expect(within(workflowArea()).getByRole("img", { name: "Completed" })).toBeInTheDocument();
    expect(within(workflowArea()).getByRole("img", { name: "Failed" })).toBeInTheDocument();
  });

  it("passes a run's effects to the desktop", async () => {
    serve({
      onRun: () => json(runLog({ ok: true, effects: [{ open: "notes" }, { appearance: "dark" }] })),
    });
    const heard = vi.fn();
    const stop = onDesktopEffects(heard);
    try {
      const user = await openWindow();
      await addStep(user, "Change System Appearance");
      await user.click(button("Run"));
      await waitFor(() => expect(heard).toHaveBeenCalledTimes(1));
      expect(heard).toHaveBeenCalledWith([{ open: "notes" }, { appearance: "dark" }]);
    } finally {
      stop();
    }
  });

  it("says why the server would not run the workflow", async () => {
    serve({ onRun: () => json({ error: "step 1: SyntaxError: unexpected end" }, 400) });
    const user = await openWindow();
    await addStep(user, "Run JavaScript");
    await user.click(button("Run"));
    await waitFor(() =>
      expect(cells()).toEqual([
        ["The workflow did not run: step 1: SyntaxError: unexpected end.", ""],
      ]),
    );
  });

  it("saves the workflow into the stored library, on the revision it read", async () => {
    const server = serve({
      library: { workflows: [workflow("errands", "Errands")], tz: 60 },
      rev: 3,
    });
    const user = await openWindow();
    await waitFor(() => expect(unavailable(popUp("Open Workflow"))).toBe(false));
    const name = screen.getByRole("textbox", { name: "Workflow name" });
    await user.clear(name);
    await user.type(name, "Groceries");
    expect(screen.getByRole("region", { name: "Groceries" })).toHaveClass("mac-automator");
    const note = await addStep(user, "New Note");
    await user.type(within(note).getByRole("textbox", { name: "text" }), "Milk");

    await user.click(button("Save Workflow"));
    await waitFor(() => expect(status()).toHaveTextContent("Saved “Groceries”."));
    expect(puts(server)).toHaveLength(1);
    const sent = puts(server)[0]?.body;
    expect(sent.rev).toBe(3);
    expect(sent.session).toBe("session-1");
    // The zone the library was first saved in stays, whatever this page's zone is.
    expect(sent.library.tz).toBe(60);
    expect(sent.library.workflows).toEqual([
      workflow("errands", "Errands"),
      {
        id: expect.stringMatching(/^[0-9a-f]{32}$/),
        name: "Groceries",
        kind: "workflow",
        steps: [{ action: "notes.make", params: { text: "Milk" } }],
        enabled: true,
      },
    ]);
    expect(popUp("Open Workflow")).toHaveTextContent("Groceries");

    // Saved again, it replaces itself on the revision the save answered.
    await user.type(within(note).getByRole("textbox", { name: "title" }), "Shopping");
    await user.click(button("Save Workflow"));
    await waitFor(() => expect(puts(server)).toHaveLength(2));
    const again = puts(server)[1]?.body;
    expect(again.rev).toBe(4);
    expect(again.library.workflows).toHaveLength(2);
    expect(again.library.workflows[1].steps[0].params).toEqual({ title: "Shopping", text: "Milk" });
  });

  it("merges a save that met another window's newer workflows (409) and saves both", async () => {
    const server = serve({
      library: { workflows: [workflow("errands", "Errands")], tz: 0 },
      rev: 3,
    });
    const user = await openWindow();
    await waitFor(() => expect(unavailable(popUp("Open Workflow"))).toBe(false));
    // Another browser saves a workflow after this window read the library.
    server.library = {
      workflows: [workflow("errands", "Errands"), workflow("mornings", "Mornings")],
      tz: 0,
    };
    server.rev = 7;
    await addStep(user, "New Note");
    await user.click(button("Save Workflow"));
    await waitFor(() => expect(status()).toHaveTextContent("Saved “Untitled”."));
    expect(puts(server).map((sent) => sent.body.rev)).toEqual([3, 7]);
    expect(puts(server)[1]?.body.library.workflows.map((entry: Workflow) => entry.name)).toEqual([
      "Errands",
      "Mornings",
      "Untitled",
    ]);
    expect(server.rev).toBe(8);
    // The other browser's workflow can be opened here now.
    await user.click(popUp("Open Workflow"));
    expect(await screen.findByRole("option", { name: "Mornings" })).toBeInTheDocument();
  });

  it("shows the server's reason for refusing a workflow (400)", async () => {
    serve({ onPut: () => json({ error: 'step 1 names no action: "x.y"' }, 400) });
    const user = await openWindow();
    await addStep(user, "New Note");
    await user.click(button("Save Workflow"));
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        'Could not save “Untitled”: step 1 names no action: "x.y".',
      ),
    );
    expect(unavailable(button("Save Workflow"))).toBe(false);
  });

  it("opens a saved workflow, deletes it, and starts a new one", async () => {
    const morning = workflow("morning", "Morning", {
      steps: [
        { action: "calendar.events", params: { days: 2 } },
        { action: "notes.make", params: { title: "Agenda" }, enabled: false },
      ],
    });
    const server = serve({
      library: { workflows: [workflow("errands", "Errands"), morning], tz: 0 },
      rev: 2,
    });
    const user = await openWindow();
    await waitFor(() => expect(unavailable(popUp("Open Workflow"))).toBe(false));
    expect(unavailable(button("Delete Workflow"))).toBe(true);
    await choose(user, "Open Workflow", "Morning");
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("Morning");
    expect(popUp("Workflow type")).toHaveTextContent("Workflow");
    expect(within(step("Find Calendar Events")).getByRole("textbox", { name: "days" })).toHaveValue(
      "2",
    );
    expect(within(step("New Note")).getByRole("checkbox", { name: "Enabled" })).not.toBeChecked();

    await user.click(button("Delete Workflow"));
    const question = await screen.findByRole("dialog", { name: /Delete the workflow/ });
    expect(puts(server)).toHaveLength(0);
    await user.click(within(question).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(status()).toHaveTextContent("Deleted “Morning”."));
    expect(puts(server)[0]?.body.library.workflows).toEqual([workflow("errands", "Errands")]);
    // A new, empty workflow takes the deleted one's place.
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("Untitled");
    expect(within(workflowArea()).queryAllByRole("listitem")).toHaveLength(0);

    await choose(user, "Open Workflow", "Errands");
    expect(step("New Note")).toBeInTheDocument();
    await user.click(button("New Workflow"));
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("Untitled");
    expect(popUp("Open Workflow")).toHaveTextContent("Workflows");
  });

  it("asks what becomes of unsaved changes before New or Open replaces the draft", async () => {
    const server = serve({
      library: { workflows: [workflow("errands", "Errands")], tz: 0 },
      rev: 2,
    });
    const user = await openWindow();
    await waitFor(() => expect(unavailable(popUp("Open Workflow"))).toBe(false));
    await choose(user, "Open Workflow", "Errands");
    // Opened and unchanged: New replaces it at once.
    await user.click(button("New Workflow"));
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("Untitled");

    await choose(user, "Open Workflow", "Errands");
    await addStep(user, "Find Calendar Events");
    await user.click(button("New Workflow"));
    const sheet = await screen.findByRole("dialog", { name: /save the changes/ });
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("Errands");
    expect(step("Find Calendar Events")).toBeInTheDocument();

    await user.click(button("New Workflow"));
    const again = await screen.findByRole("dialog", { name: /save the changes/ });
    await user.click(within(again).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue("Untitled"),
    );
    const stored = puts(server).at(-1)?.body.library.workflows ?? [];
    expect(stored.find((entry: Workflow) => entry.id === "errands")?.steps).toHaveLength(2);
  });

  it("asks before the close button discards unsaved changes, and closes once they are saved", async () => {
    const server = serve({ library: { workflows: [], tz: 0 }, rev: 1 });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DesktopAutomator onClose={onClose} />);
    await waitFor(() => expect(listed()).toContain("New Note"));
    // Nothing changed: the window closes at once.
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await addStep(user, "Find Calendar Events");
    await user.click(screen.getByRole("button", { name: "Close" }));
    const sheet = await screen.findByRole("dialog", { name: /save the changes/ });
    expect(sheet).toHaveTextContent("Closing the window discards them.");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
    expect(puts(server)).toHaveLength(1);
  });

  it("keeps a name typed while the workflow was being saved", async () => {
    let answer: ((reply: Response) => void) | undefined;
    const server = serve({ library: { workflows: [], tz: 0 }, rev: 1 });
    server.onPut = (body) =>
      new Promise<Response>((resolve) => {
        answer = () => resolve(json({ library: body.library, rev: 2 }));
      });
    const user = await openWindow();
    const name = screen.getByRole("textbox", { name: "Workflow name" });
    await user.clear(name);
    await user.type(name, "Morning");
    await user.click(button("Save Workflow"));
    await waitFor(() => expect(answer).toBeDefined());
    await user.type(name, " run");
    answer?.(json({}));
    await waitFor(() => expect(status()).toHaveTextContent("Saved “Morning”."));
    expect(name).toHaveValue("Morning run");
  });

  it("opens, after Save, the version the save found when another window changed it", async () => {
    const server = serve({
      library: { workflows: [workflow("errands", "Errands")], tz: 0 },
      rev: 2,
    });
    const user = await openWindow();
    await waitFor(() => expect(unavailable(popUp("Open Workflow"))).toBe(false));
    await addStep(user, "Find Calendar Events");
    await choose(user, "Open Workflow", "Errands");
    const sheet = await screen.findByRole("dialog", { name: /save the changes/ });
    // Meanwhile another window renamed Errands: this save meets a 409 and merges.
    server.library = { workflows: [workflow("errands", "Errands, renamed")], tz: 0 };
    server.rev = 3;
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Workflow name" })).toHaveValue(
        "Errands, renamed",
      ),
    );
  });

  it("says it is not known whether a run without an answer ran, and shows the runs", async () => {
    const server = serve({ onRun: () => json({ error: "the gateway timed out" }, 504) });
    const user = await openWindow();
    await addStep(user, "New Note");
    await user.click(button("Run"));
    await waitFor(() =>
      expect(cells()[0]?.[0]).toBe(
        "It is not known whether the workflow ran: the gateway timed out. Look in Runs before running it again.",
      ),
    );
    // The runs were read again, to show a run that did happen.
    await waitFor(() =>
      expect(server.requests.filter((r) => r.path === RUNS_URL).length).toBeGreaterThan(1),
    );
  });

  it("refuses a workflows reply that names no library rather than read it as empty", async () => {
    serve({ library: undefined as unknown as null, rev: 5 });
    await openWindow();
    await waitFor(() =>
      expect(status()).toHaveTextContent("The saved workflows could not be read"),
    );
  });

  it("has no accessibility violations with every kind of setting and a log", async () => {
    serve({ onRun: () => json(runLog()) });
    const user = userEvent.setup();
    const { container } = render(<DesktopAutomator />);
    await waitFor(() => expect(listed()).toContain("New Note"));
    for (const title of [
      "New Note",
      "Change System Appearance",
      "New Text File",
      "Run JavaScript",
    ]) {
      await addStep(user, title);
    }
    await user.click(button("Run"));
    await waitFor(() => expect(cells().at(-1)?.[0]).toBe("Workflow failed"));
    await expectNoA11yViolations(container);
  });

  it("lists recent runs with what started them, and reads them again every ten seconds", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const started = Date.now();
    const server = serve({
      runs: [runLog({ id: "by-hand", name: "Errands", started, ok: false })],
    });
    const user = await openWindow();
    await user.click(button("Runs"));
    await waitFor(() => expect(cells("Runs")).toHaveLength(1));
    expect(cells("Runs")[0]?.[0]).toMatch(/Errands: Run, failed$/);

    // Another window of the person runs a workflow; the next read shows it.
    server.runs = [
      runLog({
        id: "other-window",
        name: "Morning",
        started: started + 1000,
        ok: true,
        steps: [
          {
            action: "calendar.events",
            title: "Find Calendar Events",
            status: "completed",
            items: 2,
            preview: ["Standup", "Lunch"],
            ms: 5,
          },
        ],
        output: ["Standup", "Lunch"],
      }),
      ...server.runs,
    ];
    act(() => vi.advanceTimersByTime(10_000));
    await waitFor(() => expect(cells("Runs")).toHaveLength(2));
    expect(cells("Runs")[0]?.[0]).toMatch(/Morning: Run, completed$/);

    // Its log.
    await user.dblClick(within(list("Runs")).getByText(/Morning: Run/));
    expect(cells()).toEqual([
      ["Find Calendar Events completed, 2 items: Standup, Lunch", "0.005 seconds"],
      ["Output: Standup, Lunch", ""],
      ["Workflow completed", "0.020 seconds"],
    ]);
  });

  it("keeps a newer saved revision when the window's first read of the workflows answers late", async () => {
    const server = serve({ library: { workflows: [], tz: 0 }, rev: 1 });
    let first: ((reply: Response) => void) | undefined;
    server.onGetWorkflows = () => {
      server.onGetWorkflows = undefined;
      return new Promise((resolve) => {
        first = resolve;
      });
    };
    const user = await openWindow();
    await addStep(user, "New Note");
    await user.click(button("Save Workflow"));
    await waitFor(() => expect(status()).toHaveTextContent(/^Saved/));
    expect(puts(server)[0]?.body.rev).toBe(1);

    // The first read answers only now, with the revision from before the save.
    await act(async () =>
      first?.(json({ library: { workflows: [], tz: 0 }, rev: 1, session: "session-1" })),
    );
    await user.type(within(step("New Note")).getByRole("textbox", { name: "text" }), "Milk");
    await user.click(button("Save Workflow"));
    await waitFor(() => expect(puts(server)).toHaveLength(2));
    expect(puts(server)[1]?.body.rev).toBe(2);
  });

  it("keeps a run it just made when an older read of the runs answers after it", async () => {
    const server = serve();
    let first: ((reply: Response) => void) | undefined;
    server.onRuns = () => {
      server.onRuns = undefined;
      return new Promise((resolve) => {
        first = resolve;
      });
    };
    server.onRun = () => json(runLog({ id: "mine", name: "Groceries" }));
    const user = await openWindow();
    await addStep(user, "New Note");
    await user.click(button("Run"));
    await waitFor(() => expect(cells().at(-1)?.[0]).toBe("Workflow failed"));

    // The read that started when the window opened answers now, without the run.
    await act(async () => first?.(json({ runs: [] })));
    await user.click(button("Runs"));
    expect(cells("Runs")).toHaveLength(1);
    expect(cells("Runs")[0]?.[0]).toMatch(/Groceries: Run, failed$/);
  });

  it("keeps the draft unsaved when the server's answer to a save cannot be read", async () => {
    const server = serve({ library: { workflows: [], tz: 0 }, rev: 1 });
    server.onPut = () =>
      new Response("<html>gateway</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DesktopAutomator onClose={onClose} />);
    await waitFor(() => expect(listed()).toContain("New Note"));
    await addStep(user, "New Note");
    await user.click(button("Save Workflow"));
    await waitFor(() => expect(status()).toHaveTextContent("it is not known whether it saved"));
    // Still unsaved: closing asks first.
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("dialog", { name: /save the changes/ })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lists the types a web page cannot make as not available, and says when the others run", async () => {
    serve();
    const user = await openWindow();
    await user.click(popUp("Workflow type"));
    for (const name of ["Print Plugin", "Image Capture Plugin", "Dictation Command"]) {
      const option = await screen.findByRole("option", {
        name: `${name} (not available yet)`,
      });
      expect(option).toHaveAttribute("aria-disabled", "true");
    }
    await user.click(await screen.findByRole("option", { name: "Folder Action" }));
    expect(popUp("Workflow type")).toHaveTextContent("Folder Action");
    expect(screen.getByText(/only while this desktop is open and signed in/)).toBeInTheDocument();
    await user.click(popUp("Workflow type"));
    await user.click(await screen.findByRole("option", { name: "Calendar Alarm" }));
    expect(screen.getByText(/runs when the alert shows, and only while/)).toBeInTheDocument();
  });
});

describe("the served workflow's data", () => {
  it("sends settings without blanks, with numbers as numbers, checkboxes on or off, and never an input", () => {
    const events = ACTIONS.find((action) => action.name === "calendar.events");
    expect(
      paramsToSend(events, { day: "  ", days: " 3 ", input: "x", extra: false, flag: true }),
    ).toEqual({ days: 3, extra: false, flag: true });
    // Text keeps its own spaces and line breaks; only blank text is left out.
    const note = ACTIONS.find((action) => action.name === "notes.make");
    expect(paramsToSend(note, { text: "  indented\nline ", title: "   " })).toEqual({
      text: "  indented\nline ",
    });
    // Unknown to the library (it could not be read): a stored number left as it was stays one.
    expect(paramsToSend(undefined, { limit: "5", note: "hi" }, { limit: 5, note: "hi" })).toEqual({
      limit: 5,
      note: "hi",
    });
    // A checkbox the step never set is sent as the window shows it: off.
    const withSwitch: ServerAction = {
      ...(ACTIONS[0] as ServerAction),
      params: [{ name: "all", kind: "boolean", required: false, summary: "" }],
    };
    expect(paramsToSend(withSwitch, {})).toEqual({ all: false });
    expect(defaultParams(withSwitch)).toEqual({ all: false });
    const script = ACTIONS.find((action) => action.name === "javascript.run");
    expect(paramsToSend(script, { code: "  return input;\n" })).toEqual({
      code: "  return input;\n",
    });
  });

  it("adds, replaces and deletes a workflow by id", () => {
    const a = workflow("a", "A");
    const b = workflow("b", "B");
    expect(applyChange([a], { type: "put", workflow: b })).toEqual([a, b]);
    expect(applyChange([a, b], { type: "put", workflow: { ...a, name: "A2" } })[0]?.name).toBe(
      "A2",
    );
    expect(applyChange([a, b], { type: "delete", id: "a" })).toEqual([b]);
  });

  it("carries items to a request as lines, and as a script when lines cannot hold them", () => {
    const base = workflow("a", "A");
    expect(withInput(base, ["Milk", "Eggs"]).steps[0]).toEqual({
      action: "text.get",
      params: { text: "Milk\nEggs" },
    });
    expect(withInput(base, ["Two\nlines"]).steps[0]).toEqual({
      action: "javascript.run",
      params: { code: 'return [{"kind":"text","text":"Two\\nlines"}];' },
    });
    const file = {
      kind: "file" as const,
      id: "f1",
      name: "a.txt",
      path: "Documents/a.txt",
      text: "Documents/a.txt",
    };
    expect(withInput(base, [file]).steps[0]?.action).toBe("javascript.run");
    expect(withInput(base, []).steps).toEqual(base.steps);
  });

  it("reads a stored library only when every workflow in it can be read", () => {
    expect(libraryFromServer(null)).toBeNull();
    expect(libraryFromServer({ workflows: [workflow("a", "A")], tz: 60 })).toEqual({
      workflows: [workflow("a", "A")],
      tz: 60,
    });
    // One the page cannot read makes the library unreadable, so a save never drops it.
    expect(
      libraryFromServer({ workflows: [workflow("a", "A"), { id: "b", kind: "x" }], tz: 0 }),
    ).toBeUndefined();
  });
});

describe("Automator's whole library, its page actions and its variables", () => {
  let runCount = 0;
  /** The server's answer to a run: each step completes, handing on what its settings name. */
  const ranAll = (body: Sent["body"]) => {
    runCount += 1;
    return json(
      runLog({
        id: `run-${runCount}`,
        ok: true,
        output: [],
        steps: body.workflow.steps.map(
          (each: { action: string; params: Record<string, unknown> }) => ({
            action: each.action,
            title: ACTIONS.find((known) => known.name === each.action)?.title ?? each.action,
            status: "completed",
            items: 1,
            preview: [String(each.params.title ?? each.params.text ?? "Milk")],
            ms: 1,
          }),
        ),
      }),
    );
  };
  const logged = () => cells().map((row) => row[0]);
  const transfer = (type: string, value: string) => ({
    types: [type],
    getData: (asked: string) => (asked === type ? value : ""),
    setData: () => undefined,
    dropEffect: "",
  });

  it("lists the real library, and a row that cannot run says why and is not added", async () => {
    serve();
    const user = await openWindow();
    await user.click(within(outline()).getByText("PDFs"));
    expect(listed()).toEqual([
      "Add Grid to PDF Documents",
      "Apply Quartz Filter to PDF Documents",
      "Combine PDF Pages",
      "Compress Images in PDF Documents",
      "Encrypt PDF Documents",
      "Extract PDF Text",
      "Split PDF",
      "Watermark PDF Documents",
    ]);
    await user.click(within(outline()).getByText("Photos"));
    const row = within(list()).getByText("Apply ColorSync Profile to Images");
    await user.click(row);
    expect(
      within(screen.getByRole("region", { name: "Description" })).getByText(
        /colour profiles macOS keeps/,
      ),
    ).toBeVisible();
    await user.dblClick(row);
    expect(status()).toHaveTextContent(
      "“Apply ColorSync Profile to Images” can’t be added: It needs the colour profiles macOS keeps",
    );
    expect(within(workflowArea()).queryByRole("group")).toBeNull();
  });

  it("has every action of the capture's list, runnable or with its reason", () => {
    const titles = [...PAGE_ACTIONS, ...DIMMED_ACTIONS].map((action) => action.title);
    for (const title of [
      "Activate Fonts",
      "Ask For Servers",
      "Ask for Text",
      "Burn a Disc",
      "Choose from List",
      "Create Archive",
      "Create Package",
      "Download URLs",
      "Loop",
      "Watch Me Do",
    ]) {
      expect(titles).toContain(title);
    }
    expect(DIMMED_ACTIONS.every((action) => (action.reason?.length ?? 0) > 20)).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("offers Copy Finder Items before an action that changes its input files", async () => {
    serve();
    const user = await openWindow();
    const titles = () =>
      within(workflowArea())
        .queryAllByRole("group")
        .map((group) => group.getAttribute("aria-label"))
        .filter((title) => title?.includes(" "));
    const question = () => screen.queryByRole("dialog", { name: /will change the Finder items/ });
    const addAsked = async (title: string) => {
      fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
        target: { value: title },
      });
      await user.dblClick(within(list()).getByText(title));
      return screen.findByRole("dialog", {
        name: `The “${title}” action will change the Finder items passed into it.`,
      });
    };

    await addStep(user, "Move Finder Items");
    expect(question()).toBeNull();

    const asked = await addAsked("Rename Finder Items");
    await user.click(within(asked).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(question()).toBeNull());
    expect(titles()).toEqual(["Move Finder Items", "Copy Finder Items", "Rename Finder Items"]);
    expect(within(step("Copy Finder Items")).getByLabelText("to")).toHaveValue("Desktop");

    const again = await addAsked("Change Type of Images");
    await user.click(within(again).getByRole("button", { name: "Don’t Add" }));
    await waitFor(() => expect(question()).toBeNull());
    expect(titles()).toEqual([
      "Move Finder Items",
      "Copy Finder Items",
      "Rename Finder Items",
      "Change Type of Images",
    ]);
  });

  it("saves a page step as a step the server takes, and reads it back", async () => {
    const server = serve();
    const user = await openWindow();
    await addStep(user, "Ask for Text");
    await user.type(
      within(step("Ask for Text")).getByRole("textbox", { name: "question" }),
      "Who?",
    );
    await user.click(button("Save Workflow"));
    await waitFor(() => expect(status()).toHaveTextContent("Saved"));
    expect(puts(server)[0]?.body.library.workflows[0].steps).toEqual([
      {
        action: "text.get",
        params: { question: "Who?", "require an answer": false, page_step: "page.ask-text" },
      },
    ]);
    cleanup();
    const again = await openWindow();
    await waitFor(() => expect(unavailable(popUp("Open Workflow"))).toBe(false));
    await choose(again, "Open Workflow", "Untitled");
    expect(within(step("Ask for Text")).getByRole("textbox", { name: "question" })).toHaveValue(
      "Who?",
    );
  });

  it("runs server steps and a question in parts, handing the items across", async () => {
    const server = serve({ onRun: ranAll });
    const user = await openWindow();
    const note = await addStep(user, "New Note");
    await user.type(within(note).getByRole("textbox", { name: "title" }), "Milk");
    await addStep(user, "Ask for Confirmation");
    await addStep(user, "New Reminders Item");
    await user.click(button("Run"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Do you want to continue?")).toBeVisible();
    expect(posts(server)).toHaveLength(1);
    await user.click(within(sheet).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(logged().at(-1)).toBe("Workflow completed"));
    expect(posts(server)).toHaveLength(2);
    expect(
      posts(server)[1]?.body.workflow.steps.map((sent: { action: string }) => sent.action),
    ).toEqual(["text.get", "reminders.add"]);
    expect(posts(server)[1]?.body.workflow.steps[0].params).toEqual({ text: "Milk" });
    expect(logged()).toEqual([
      "New Note completed, 1 item: Milk",
      "Ask for Confirmation completed, 1 item: Milk",
      "New Reminders Item completed, 1 item: Milk",
      "Output: Milk",
      "Workflow completed",
    ]);
  });

  it("stops the workflow when the person cancels a question", async () => {
    const server = serve({ onRun: ranAll });
    const user = await openWindow();
    await addStep(user, "Ask for Text");
    await addStep(user, "New Note");
    await user.click(button("Run"));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(logged().at(-1)).toBe("Workflow failed"));
    expect(logged()[0]).toBe("Ask for Text failed: You canceled it.");
    expect(posts(server)).toHaveLength(0);
  });

  it("keeps an answer in a variable and puts it in a later step's settings", async () => {
    const server = serve({ onRun: ranAll });
    const user = await openWindow();
    await addStep(user, "Ask for Text");
    const set = await addStep(user, "Set Value of Variable");
    await user.type(within(set).getByRole("textbox", { name: "variable" }), "who");
    const note = await addStep(user, "New Note");
    fireEvent.change(within(note).getByRole("textbox", { name: "title" }), {
      target: { value: "For {{who}}, {{nobody}}" },
    });
    await user.click(button("Run"));
    const sheet = await screen.findByRole("dialog");
    await user.type(within(sheet).getByRole("textbox", { name: "Your answer" }), "Ada");
    await user.click(within(sheet).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(logged().at(-1)).toBe("Workflow completed"));
    const sent = posts(server)[0]?.body.workflow.steps;
    expect(sent[0]).toEqual({ action: "text.get", params: { text: "Ada" } });
    expect(sent[1].params.title).toBe("For Ada, {{nobody}}");
  });

  it("lists variables, keeps a workflow's, and edits and deletes them from their menu", async () => {
    const server = serve({ onRun: ranAll });
    const user = await openWindow();
    await user.click(screen.getByRole("radio", { name: "Variables" }));
    expect(
      within(screen.getByRole("treegrid", { name: "Variable categories" })).getByText("Locations"),
    ).toBeVisible();
    await user.dblClick(within(list("Variables")).getByText("Documents"));
    expect(cells("Workflow variables")).toEqual([["Documents", "Documents"]]);
    const kept = () => Object.values(desktopValues()["automator.variables"] as object);
    expect(kept()).toEqual([[{ name: "Documents", value: "" }]]);

    fireEvent.contextMenu(
      within(list("Workflow variables")).getAllByText("Documents")[0] as HTMLElement,
    );
    await user.click(await screen.findByRole("menuitem", { name: "New Variable…" }));
    let sheet = await screen.findByRole("dialog");
    await user.type(within(sheet).getByRole("textbox", { name: "Variable name" }), "city");
    await user.type(within(sheet).getByRole("textbox", { name: "Variable value" }), "Oslo");
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(cells("Workflow variables")[1]).toEqual(["city", "Oslo"]);

    fireEvent.contextMenu(within(list("Workflow variables")).getByText("city"));
    await user.click(await screen.findByRole("menuitem", { name: "Edit…" }));
    sheet = await screen.findByRole("dialog");
    const value = within(sheet).getByRole("textbox", { name: "Variable value" });
    await user.clear(value);
    await user.type(value, "Rome");
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(cells("Workflow variables")[1]).toEqual(["city", "Rome"]));

    // Dragged into a text setting, its name stands for its value when the workflow runs.
    await user.click(screen.getByRole("radio", { name: "Actions" }));
    const note = await addStep(user, "New Note");
    const title = within(note).getByRole("textbox", { name: "title" });
    const drag = transfer("application/x-macalicious-automator-variable", "city");
    fireEvent.dragOver(title, { dataTransfer: drag });
    fireEvent.drop(title, { dataTransfer: drag });
    expect(title).toHaveValue("{{city}}");
    await user.click(button("Run"));
    await waitFor(() => expect(posts(server)).toHaveLength(1));
    expect(posts(server)[0]?.body.workflow.steps[0].params.title).toBe("Rome");

    await user.click(button("Variables"));
    fireEvent.contextMenu(within(list("Workflow variables")).getByText("city"));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await waitFor(() => expect(cells("Workflow variables")).toHaveLength(1));
  });

  it("shows a step's settings before it runs, for that run only", async () => {
    const server = serve({ onRun: ranAll });
    const user = await openWindow();
    const note = await addStep(user, "New Note");
    await user.click(within(note).getByRole("button", { name: "Options" }));
    await user.click(within(note).getByRole("checkbox", { name: /Show this action when/ }));
    await user.click(button("Run"));
    const sheet = await screen.findByRole("dialog");
    await user.type(within(sheet).getByRole("textbox", { name: "title" }), "Just now");
    await user.click(within(sheet).getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(logged().at(-1)).toBe("Workflow completed"));
    expect(posts(server)[0]?.body.workflow.steps[0].params.title).toBe("Just now");
    expect(within(note).getByRole("textbox", { name: "title" })).toHaveValue("");
  });

  it("stops a run in parts between its actions", async () => {
    let finish: (response: Response) => void = () => undefined;
    const server = serve({
      onRun: (body) => {
        const answer = ranAll(body);
        return new Promise<Response>((resolve) => {
          finish = () => resolve(answer);
        });
      },
    });
    const user = await openWindow();
    await addStep(user, "New Note");
    await addStep(user, "Ask for Text");
    await user.click(button("Run"));
    await waitFor(() => expect(posts(server)).toHaveLength(1));
    await user.click(button("Stop"));
    act(() => finish(new Response()));
    await waitFor(() => expect(logged().at(-1)).toBe("Stopped before Ask for Text"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("goes back to the first action as many times as a Loop says", async () => {
    const server = serve({ onRun: ranAll });
    const user = await openWindow();
    await addStep(user, "New Note");
    const loop = await addStep(user, "Loop");
    await choose(user, "mode", "Loop Automatically");
    await user.type(within(loop).getByRole("textbox", { name: "times" }), "3");
    await user.click(button("Run"));
    await waitFor(() => expect(logged().at(-1)).toBe("Workflow completed"));
    expect(posts(server)).toHaveLength(3);
  });

  it("turns a file dropped from Finder into a step that hands it on", async () => {
    serve({ onFiles: () => json(DRIVE) });
    await openWindow();
    const drag: DesktopDrag = {
      from: "finder",
      items: [{ id: "f1", name: "a.txt", kind: "file" }],
      copy: false,
    };
    act(() => landingAt(workflowArea(), drag)?.drop());
    await waitFor(() =>
      expect(
        within(step("Get Specified Finder Items")).getByRole("textbox", { name: "paths" }),
      ).toHaveValue("Documents/a.txt"),
    );
  });

  it("opens the Variables pane by key", async () => {
    serve();
    await openWindow();
    fireEvent.keyDown(document.body, { key: "v", ctrlKey: true, altKey: true });
    expect(await screen.findByRole("grid", { name: "Workflow variables" })).toBeInTheDocument();
  });

  const entry = (id: string, name: string, parent?: string, kind: "file" | "folder" = "file") =>
    ({
      id,
      name,
      kind,
      size: 0,
      created_ms: 0,
      modified_ms: 0,
      ...(parent ? { parent } : {}),
    }) as DriveEntry;
  const DRIVE: Drive = {
    rev: 1,
    usage: 0,
    quota: 1,
    piece_bytes: 1,
    max_file_bytes: 1,
    max_entries: 10,
    entries: [
      entry("documents", "Documents", undefined, "folder"),
      entry("desktop", "Desktop", undefined, "folder"),
      entry("f1", "a.txt", "documents"),
      entry("d1", "Done", "documents", "folder"),
    ],
  };
  const host = () => ({
    ask: vi.fn<(question: PageQuestion) => Promise<null>>(async () => null),
    running: new Map<string, readonly string[]>(),
    read: () => undefined,
  });
  const fileAt = (id: string, name: string, path: string) => ({
    kind: "file",
    id,
    name,
    path,
    text: path,
  });
  /** A drive whose `POST /ops` answers `after`, and the bodies it was sent. */
  const driveGives = (after: Partial<Drive>) => {
    const sent: unknown[] = [];
    serve({
      onFiles: (method, _path, body) => {
        if (method !== "POST") return json(DRIVE);
        sent.push(body.ops);
        return json({ ...DRIVE, rev: 2, ...after });
      },
    });
    return sent;
  };

  it("reads a variable, adds an answer from the Open dialog, and refuses a variable no one has", async () => {
    serve({ onFiles: () => json(DRIVE) });
    const read = (name: string) => (name === "city" ? ["Oslo"] : undefined);
    await expect(
      runPageAction("page.get-variable", { variable: "city" }, ["Milk"], { ...host(), read }),
    ).resolves.toEqual(["Milk", "Oslo"]);
    await expect(
      runPageAction("page.get-variable", { variable: "none" }, [], { ...host(), read }),
    ).rejects.toThrow("There is no variable “none”.");
    const asked = host();
    const ask = vi.fn(async () => ({
      files: [DRIVE.entries[2] as DriveEntry, DRIVE.entries[2] as DriveEntry],
    }));
    await expect(
      runPageAction("page.ask-movies", {}, ["Milk"], { ...asked, ask }),
    ).resolves.toEqual([
      "Milk",
      fileAt("f1", "a.txt", "Documents/a.txt"),
      fileAt("f1", "a.txt", "Documents/a.txt"),
    ]);
    expect(ask).toHaveBeenCalledWith({ kind: "file", folder: "movies", accept: "movie" });
  });

  it("hands on what the person chose from the list", async () => {
    const server = serve({ onRun: ranAll });
    const user = await openWindow();
    const text = await addStep(user, "New Note");
    await user.type(within(text).getByRole("textbox", { name: "title" }), "Milk");
    await addStep(user, "Choose from List");
    await addStep(user, "New Reminders Item");
    await user.click(button("Run"));
    const sheet = await screen.findByRole("dialog");
    const ok = within(sheet).getByRole("button", { name: "OK" });
    expect(unavailable(ok)).toBe(true);
    await user.click(within(sheet).getByText("Milk"));
    await user.click(ok);
    await waitFor(() => expect(logged().at(-1)).toBe("Workflow completed"));
    expect(posts(server)[1]?.body.workflow.steps[0].params).toEqual({ text: "Milk" });
  });

  it("copies Finder items to a folder and hands on the copies", async () => {
    const sent = driveGives({
      entries: [...DRIVE.entries, entry("c1", "a.txt", "d1")],
      created: ["c1"],
    });
    await expect(
      runPageAction(
        "page.copy-finder-items",
        { to: "Documents/Done" },
        ["Documents/a.txt"],
        host(),
      ),
    ).resolves.toEqual([fileAt("c1", "a.txt", "Documents/Done/a.txt")]);
    expect(sent).toEqual([[{ op: "copy", id: "f1", parent: "d1", existing: "rename" }]]);
  });

  it("moves and renames Finder items, and says when one is not on the drive", async () => {
    const moved = driveGives({
      entries: [
        DRIVE.entries[0],
        DRIVE.entries[1],
        entry("f1", "a.txt", "d1"),
        DRIVE.entries[3],
      ] as DriveEntry[],
    });
    await expect(
      runPageAction(
        "page.move-finder-items",
        { to: "Documents/Done", replace: true },
        ["~/Documents/a.txt"],
        host(),
      ),
    ).resolves.toEqual([fileAt("f1", "a.txt", "Documents/Done/a.txt")]);
    expect(moved).toEqual([[{ op: "move", id: "f1", parent: "d1", existing: "replace" }]]);

    const named = driveGives({
      entries: [
        DRIVE.entries[0],
        DRIVE.entries[1],
        entry("f1", "a-1.txt", "documents"),
      ] as DriveEntry[],
    });
    await expect(
      runPageAction(
        "page.rename-finder-items",
        { change: "Add Text", text: "-1" },
        ["Documents/a.txt"],
        host(),
      ),
    ).resolves.toEqual([fileAt("f1", "a-1.txt", "Documents/a-1.txt")]);
    expect(named).toEqual([[{ op: "rename", id: "f1", name: "a-1.txt" }]]);

    await expect(
      runPageAction("page.combine-text-files", {}, ["Documents/none.txt"], host()),
    ).rejects.toThrow("“Documents/none.txt” is not on your drive.");
  });

  it("makes a folder and moves its input into it", async () => {
    const sent: unknown[] = [];
    serve({
      onFiles: (method, _path, body) => {
        if (method !== "POST") return json(DRIVE);
        sent.push(body.ops);
        return body.ops[0].op === "mkdir"
          ? json({
              ...DRIVE,
              entries: [...DRIVE.entries, entry("n1", "Done 2", "desktop", "folder")],
              created: ["n1"],
            })
          : json({
              ...DRIVE,
              entries: [
                DRIVE.entries[0],
                DRIVE.entries[1],
                entry("n1", "Done 2", "desktop", "folder"),
                entry("f1", "a.txt", "n1"),
              ],
            });
      },
    });
    await expect(
      runPageAction("page.new-folder", { name: "Done 2" }, ["Documents/a.txt"], host()),
    ).resolves.toEqual([fileAt("f1", "a.txt", "Desktop/Done 2/a.txt")]);
    expect(sent).toEqual([
      [{ op: "mkdir", parent: "desktop", name: "Done 2", existing: "rename" }],
      [{ op: "move", id: "f1", parent: "n1" }],
    ]);
  });

  it("copies its input to the clipboard, or says the browser refused", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await expect(
      runPageAction("page.copy-clipboard", {}, ["Milk", "Eggs"], host()),
    ).resolves.toEqual(["Milk", "Eggs"]);
    expect(writeText).toHaveBeenCalledWith("Milk\nEggs");
    writeText.mockRejectedValueOnce(new Error("denied"));
    await expect(runPageAction("page.copy-clipboard", {}, ["Milk"], host())).rejects.toThrow(
      "The browser kept this page from writing to the Clipboard.",
    );
  });

  it("opens web addresses as tabs of a new Safari window, and refuses anything else", async () => {
    const heard: unknown[] = [];
    const stop = onDesktopEffects((effects) => heard.push(...effects));
    await expect(
      runPageAction("page.display-webpages", { address: "https://example.com/" }, [], host()),
    ).resolves.toEqual(["https://example.com/"]);
    stop();
    expect(heard).toEqual([
      {
        newWindow: "safari",
        opening: { isPrivate: false, seeds: [{ history: ["https://example.com/"], index: 0 }] },
      },
    ]);
    await expect(runPageAction("page.display-webpages", {}, ["ftp://x"], host())).rejects.toThrow(
      "“ftp://x” is not a web address.",
    );
  });

  it("writes SQL from comma-separated lines, names files, and tells kinds of file apart", () => {
    expect(csvToSql(['name,age\n"O\'Neil, Ann",30', "Bo,4"], "people", true)).toEqual([
      "INSERT INTO people (name, age) VALUES ('O''Neil, Ann', '30');",
      "INSERT INTO people (name, age) VALUES ('Bo', '4');",
    ]);
    expect(renamed("a.txt", 0, "Make Upper Case", "", "")).toBe("A.txt");
    expect(renamed("old name.txt", 0, "Replace Text", "old", "new")).toBe("new name.txt");
    expect(renamed("a.txt", 2, "Make Sequential", "Photo ", "")).toBe("Photo 3.txt");
    expect(fileIsKind({ name: "a.bin", type: "video/mp4", kind: "file" }, "movie")).toBe(true);
    expect(fileIsKind({ name: "a.png", kind: "file" }, "photo")).toBe(true);
    expect(fileIsKind({ name: "a.png", kind: "file" }, "song")).toBe(false);
    expect(fileIsKind({ name: "Songs", kind: "folder" }, "any")).toBe(false);
    expect(entryAtPath(DRIVE, "Documents/Done")?.id).toBe("d1");
    expect(entryAtPath(DRIVE, "Documents/Nope")).toBeUndefined();
  });
});
