import { afterEach, describe, expect, it, vi } from "vitest";
import type { Drive, DriveEntry } from "../desktop/desktop-files";
import {
  alarmEventId,
  alarmsDue,
  arrivedIn,
  claimRun,
  ensureAlarmEvent,
  nextHour,
  runDraft,
  runFile,
} from "./automator-background";
import { quickActionsFor } from "./automator-library";
import { fileNameOf, newDraft, type Workflow, workflowOfDraft } from "./automator-server";
import { driveFolders } from "./automator-type-fields";

const entry = (id: string, parent: string | undefined, kind: "file" | "folder"): DriveEntry => ({
  id,
  parent,
  name: `${id}${kind === "file" ? ".txt" : ""}`,
  kind,
  size: 0,
  created_ms: 1,
  modified_ms: 1,
});

const driveOf = (entries: DriveEntry[]) =>
  ({ entries, rev: 1, session: "s", used: 0, quota: 0 }) as unknown as Drive;

const workflow = (fields: Partial<Workflow>): Workflow => ({
  id: "w",
  name: "W",
  kind: "workflow",
  steps: [],
  enabled: true,
  ...fields,
});

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown>;
}

function serve(route: (call: Call) => [number, unknown]) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = {
      method: init.method ?? "GET",
      url: String(input),
      body: typeof init.body === "string" ? JSON.parse(init.body) : {},
    };
    calls.push(call);
    const [status, reply] = route(call);
    return new Response(JSON.stringify(reply), { status });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("a Folder Action's arrivals", () => {
  const folder = entry("inbox", undefined, "folder");

  it("counts nothing the first time it looks, and then only what is new", () => {
    const first = arrivedIn(driveOf([folder, entry("old", "inbox", "file")]), "inbox", undefined);
    expect(first.arrived).toEqual([]);
    expect([...first.now]).toEqual(["old"]);
    const later = arrivedIn(
      driveOf([folder, entry("old", "inbox", "file"), entry("new", "inbox", "file")]),
      "inbox",
      first.now,
    );
    expect(later.arrived.map((each) => each.id)).toEqual(["new"]);
  });

  it("counts a file that left and came back, and nothing in a folder that is gone", () => {
    const away = arrivedIn(driveOf([folder]), "inbox", new Set(["a"]));
    expect(away.arrived).toEqual([]);
    const back = arrivedIn(driveOf([folder, entry("a", "inbox", "file")]), "inbox", away.now);
    expect(back.arrived.map((each) => each.id)).toEqual(["a"]);
    expect(arrivedIn(driveOf([]), "inbox", new Set()).arrived).toEqual([]);
  });
});

describe("a Calendar Alarm", () => {
  const alarm = workflow({ id: "wake", kind: "calendar-alarm" });
  const stored = (id: string, start: number, fields: object = {}) => ({
    id,
    title: "Wake",
    start,
    end: start + 1_800_000,
    calendar: "home",
    alert: 0,
    ...fields,
  });

  it("is due from its event's alert until the event ends, and not for another event", () => {
    const start = Date.UTC(2026, 10, 6, 9);
    const events = [stored(alarmEventId("wake"), start), stored("other", start)];
    expect(alarmsDue([alarm], { events }, start - 1)).toEqual([]);
    const due = alarmsDue([alarm], { events }, start + 5);
    expect(due.map((each) => each.workflow.id)).toEqual(["wake"]);
    expect(due[0]?.occurrence).toContain(alarmEventId("wake"));
    expect(alarmsDue([alarm], { events }, start + 1_800_001)).toEqual([]);
  });

  it("is not due once the alert was closed", () => {
    const start = Date.UTC(2026, 10, 6, 9);
    const events = [stored(alarmEventId("wake"), start, { alertDismissed: start })];
    expect(alarmsDue([alarm], { events }, start + 5)).toEqual([]);
  });

  it("starts its event at the next whole hour", () => {
    expect(nextHour(new Date(2026, 10, 6, 9, 41, 12)).getTime()).toBe(
      new Date(2026, 10, 6, 10, 0, 0).getTime(),
    );
  });

  it("adds its event once, keeps what is there, and tries again on a conflict", async () => {
    const others = [{ id: "lunch", title: "Lunch" }];
    let rev = 3;
    let puts = 0;
    const calls = serve(({ method, url }) => {
      expect(url).toBe("/api/calendar/events");
      if (method === "GET") return [200, { events: others, rev }];
      puts += 1;
      if (puts === 1) {
        rev = 4;
        return [409, { error: "changed" }];
      }
      return [200, {}];
    });
    const now = new Date(2026, 10, 6, 9, 41);
    const start = await ensureAlarmEvent(alarm, now);
    expect(start?.getTime()).toBe(new Date(2026, 10, 6, 10).getTime());
    const put = calls.filter((call) => call.method === "PUT").at(-1);
    expect(put?.body.rev).toBe(4);
    expect(put?.body.events).toEqual([
      ...others,
      expect.objectContaining({
        id: "automator-alarm-wake",
        title: "W",
        alert: 0,
        calendar: "home",
        start: new Date(2026, 10, 6, 10).getTime(),
      }),
    ]);
    vi.unstubAllGlobals();

    const kept = serve(() => [200, { events: [{ id: "automator-alarm-wake" }], rev: 1 }]);
    expect(await ensureAlarmEvent(alarm, now)).toBeNull();
    expect(kept.map((call) => call.method)).toEqual(["GET"]);
  });
});

describe("a run with no window", () => {
  const ACTIONS = {
    actions: [
      {
        name: "text.get",
        title: "Get Specified Text",
        app: "text",
        summary: "",
        takes_input: false,
        writes: false,
        params: [{ name: "text", kind: "text", required: true, summary: "" }],
      },
    ],
  };

  it("goes to the server named by what started it, with the items in front", async () => {
    const calls = serve(({ url, body }) => {
      if (url === "/api/automator/actions") return [200, ACTIONS];
      return [
        200,
        {
          id: "r1",
          workflow: "w",
          name: "W",
          trigger: body.trigger,
          started: 1,
          ms: 1,
          ok: true,
          steps: [
            { action: "text.get", title: "T", status: "completed", items: 1, preview: [], ms: 1 },
            { action: "text.get", title: "T", status: "completed", items: 1, preview: [], ms: 1 },
          ],
          output: [],
        },
      ];
    });
    const draft = {
      ...newDraft("quick-action"),
      steps: [{ key: 1, action: "text.get", params: { text: "x" }, enabled: true }],
    };
    expect(await runDraft(draft, ["hello"], "quick-action")).toEqual({ ok: true });
    const run = calls.find((call) => call.url === "/api/automator/run");
    expect(run?.body.trigger).toBe("quick-action");
    const sent = run?.body.workflow as Workflow;
    expect(sent.kind).toBe("quick-action");
    expect(sent.steps[0]?.params).toEqual({ text: "hello" });
  });

  it("fails with the reason when a step would have asked the person", async () => {
    serve(({ url }) => (url === "/api/automator/actions" ? [200, ACTIONS] : [500, {}]));
    const draft = {
      ...newDraft("folder-action"),
      steps: [
        {
          key: 1,
          action: "page.ask-text",
          params: { question: "Name?", required: true },
          enabled: true,
        },
      ],
    };
    const result = await runDraft(draft, [], "folder-action");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("needs Automator's window");
  });

  it("refuses an .app it did not write, saying a Mac's cannot run", async () => {
    const told: Call[] = [];
    serve((call) => {
      if (call.url.includes("notify")) told.push(call);
      return [404, {}];
    });
    const result = await runFile({ id: "nope", name: "Safari.app" });
    expect(result.ok).toBe(false);
    expect(told[0]?.body.title).toBe("Application “Safari” did not finish");
  });
});

describe("the server's claim", () => {
  it("answers whether this page starts the run, and no on a refusal", async () => {
    const calls = serve(() => [200, { claimed: true }]);
    expect(await claimRun("folder:w:a:1")).toBe(true);
    expect(calls[0]).toEqual({
      method: "POST",
      url: "/api/automator/claim",
      body: { key: "folder:w:a:1" },
    });
    vi.unstubAllGlobals();
    serve(() => [200, { claimed: false }]);
    expect(await claimRun("k")).toBe(false);
    vi.unstubAllGlobals();
    serve(() => [503, {}]);
    expect(await claimRun("k")).toBe(false);
  });
});

describe("the types' settings", () => {
  it("lists the Quick Actions that take a selection, by name, without the switched-off ones", () => {
    const list = [
      workflow({ id: "z", name: "Zip", kind: "quick-action" }),
      workflow({ id: "a", name: "Archive", kind: "quick-action", receives: "files" }),
      workflow({ id: "t", name: "Text", kind: "quick-action", receives: "text" }),
      workflow({ id: "o", name: "Off", kind: "quick-action", enabled: false }),
      workflow({ id: "p", name: "Plain" }),
    ];
    expect(quickActionsFor(list, "files").map((each) => each.name)).toEqual(["Archive", "Zip"]);
    expect(quickActionsFor(list, "text").map((each) => each.name)).toEqual(["Text"]);
    expect(quickActionsFor(list, "none")).toEqual([]);
  });

  it("sends a setting only with its own type", () => {
    const none = new Map();
    const draft = { ...newDraft("folder-action"), folder: "f", receives: "text" as const };
    expect(workflowOfDraft(draft, none).folder).toBe("f");
    expect(workflowOfDraft(draft, none).receives).toBeUndefined();
    const plain = workflowOfDraft({ ...draft, kind: "workflow" }, none);
    expect(plain.folder).toBeUndefined();
  });

  it("names an Application's file .app and any other .workflow", () => {
    expect(fileNameOf(" Tidy ", "application")).toBe("Tidy.app");
    expect(fileNameOf("", "quick-action")).toBe("Untitled.workflow");
  });

  it("lists the drive's folders with their paths", () => {
    const home = { ...entry("Documents", undefined, "folder"), id: "documents" };
    const inner = { ...entry("Drop", "documents", "folder"), id: "drop" };
    const file = entry("note", "drop", "file");
    expect(driveFolders(driveOf([home, inner, file])).map((each) => each.path)).toEqual([
      "Documents",
      "Documents/Drop",
    ]);
  });
});
