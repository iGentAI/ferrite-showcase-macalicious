import { afterEach, describe, expect, it, vi } from "vitest";
import type { Drive } from "../desktop/desktop-files";
import { clearFinderSelection, publishFinderSelection } from "../finder/finder-selection";
import { clearMailSelection, publishMailSelection } from "../mail/mail-selection";
import { clearPhotosSelection, publishPhotosSelection } from "../photos/photos-selection";
import { mediaOnDrive, type PageHost, runPageAction, variableValues } from "./automator-page";
import {
  addressesOf,
  convertedName,
  encodeBmp,
  encodeTiff,
  mailItemText,
  pageText,
  selectedFinderItems,
  selectedMail,
  selectedPhotos,
} from "./automator-page-apps";
import { draftFromFile, handedOn, runFromServer, workflowFileText } from "./automator-server";

const host = (): PageHost => ({
  ask: async () => null,
  running: new Map(),
  read: () => undefined,
});

interface Call {
  url: string;
  method: string;
  body: unknown;
  key: string | null;
}

/** Answers each request from `routes` by "METHOD path", and keeps what was asked. */
function serve(routes: Record<string, (body: unknown) => [number, unknown]>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const key = new Headers(init.headers).get("idempotency-key");
    calls.push({ url, method, body, key });
    const route = routes[`${method} ${url}`];
    if (!route) return new Response("{}", { status: 404 });
    const [status, reply] = route(body);
    return new Response(JSON.stringify(reply), { status });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("a workflow as a .workflow file", () => {
  let keys = 10;
  const nextKey = () => {
    keys += 1;
    return keys;
  };

  it("opens as a new workflow named after the file, with its steps", () => {
    const text = workflowFileText({
      id: "old",
      name: "Old",
      kind: "workflow",
      enabled: true,
      steps: [
        {
          key: 1,
          action: "page.specified-finder-items",
          params: { paths: "Pictures/red.png" },
          stored: {},
          enabled: false,
          label: "Mine",
        },
      ],
    });
    const draft = draftFromFile(text, "Sorted.workflow", nextKey);
    expect(draft?.name).toBe("Sorted");
    expect(draft?.id).not.toBe("old");
    expect(draft?.steps).toEqual([
      {
        key: 11,
        action: "page.specified-finder-items",
        params: { paths: "Pictures/red.png" },
        stored: { paths: "Pictures/red.png" },
        enabled: false,
        label: "Mine",
      },
    ]);
  });

  it("refuses a file in any other shape", () => {
    expect(draftFromFile("not json", "a.workflow", nextKey)).toBeNull();
    expect(draftFromFile('{"kind":"workflow"}', "a.workflow", nextKey)).toBeNull();
    expect(
      draftFromFile('{"kind":"workflow","steps":[{"action":1}]}', "a.workflow", nextKey),
    ).toBeNull();
    expect(draftFromFile('{"kind":"print-plugin","steps":[]}', "a.workflow", nextKey)).toBeNull();
  });

  it("takes a saved type and its setting from a file, named without its extension", () => {
    const file = draftFromFile(
      '{"kind":"folder-action","folder":"f1","steps":[]}',
      "Tidy.app",
      nextKey,
    );
    expect(file?.kind).toBe("folder-action");
    expect(file?.folder).toBe("f1");
    expect(file?.name).toBe("Tidy");
  });
});

describe("what the Media Browser lists", () => {
  const file = (id: string, parent: string, name: string, more = {}) => ({
    id,
    parent,
    name,
    kind: "file",
    size: 1,
    modified_ms: 0,
    ...more,
  });
  const drive = {
    rev: 1,
    usage: 0,
    quota: 0,
    piece_bytes: 1,
    entries: [
      { id: "documents", parent: null, name: "Documents", kind: "folder", size: 0, modified_ms: 0 },
      { id: "inner", parent: "documents", name: "Trip", kind: "folder", size: 0, modified_ms: 0 },
      file("b", "inner", "b.png"),
      file("a", "documents", "a.jpg"),
      file("song", "documents", "c.mp3"),
      file("gone", "documents", "gone.png", { trashed_ms: 1 }),
    ],
  } as unknown as Drive;

  it("finds a kind in every folder, by path, and not in the Trash", () => {
    expect(mediaOnDrive(drive, "photo").map((item) => item.path)).toEqual([
      "Documents/a.jpg",
      "Documents/Trip/b.png",
    ]);
    expect(mediaOnDrive(drive, "song").map((item) => item.path)).toEqual(["Documents/c.mp3"]);
    expect(mediaOnDrive(drive, "movie")).toEqual([]);
  });
});

describe("Mail's steps", () => {
  it("makes a draft from the input, then sends that draft once", async () => {
    const calls = serve({
      "POST /api/mail/drafts": () => [200, { message: { id: "d1" } }],
      "POST /api/mail/send": () => [201, { message: { id: "s1" }, delivered: ["ada"] }],
    });
    const run = host();
    const made = await runPageAction(
      "page.new-mail",
      { to: "ada, grace", subject: "Hello" },
      ["line one", "line two"],
      run,
    );
    expect(made).toEqual(["Hello"]);
    expect(calls[0]?.body).toEqual({
      to: ["ada", "grace"],
      cc: [],
      subject: "Hello",
      text: "line one\nline two",
      attachments: [],
    });
    const sent = await runPageAction("page.send-outgoing", {}, [], run);
    expect(sent).toEqual(["Hello"]);
    expect(calls[1]?.body).toEqual({
      to: ["ada", "grace"],
      cc: [],
      subject: "Hello",
      text: "line one\nline two",
      attachments: [],
      draft: "d1",
    });
    expect(calls[1]?.key).toEqual(expect.any(String));
    await expect(runPageAction("page.send-outgoing", {}, [], run)).rejects.toThrow(
      "No New Mail Message before it made a message in this run.",
    );
  });

  it("says which recipient Mail does not know, and keeps the message outgoing", async () => {
    serve({
      "POST /api/mail/drafts": () => [200, { message: { id: "d1" } }],
      "POST /api/mail/send": () => [422, { unknown: ["nobody"] }],
    });
    const run = host();
    await runPageAction("page.new-mail", { to: "nobody" }, [], run);
    await expect(runPageAction("page.send-outgoing", {}, [], run)).rejects.toThrow(
      "Mail has no account for nobody.",
    );
    await expect(runPageAction("page.send-outgoing", {}, [], run)).rejects.toThrow(
      "Mail has no account for nobody.",
    );
  });

  it("finds messages through every page of the list, in the mailbox asked for", async () => {
    const message = (subject: string, mailbox: string) => ({
      subject,
      mailbox,
      from: { name: "ada", full_name: "Ada Lovelace" },
    });
    serve({
      "GET /api/mail/messages": () => [
        200,
        { messages: [message("Rent", "inbox"), message("Lunch", "inbox")], next: "m2" },
      ],
      "GET /api/mail/messages?after=m2": () => [
        200,
        { messages: [message("Rent again", "inbox"), message("Rent sent", "sent")], next: null },
      ],
    });
    await expect(
      runPageAction("page.find-mail", { contains: "rent", mailbox: "Inbox" }, [], host()),
    ).resolves.toEqual(["Rent, from Ada Lovelace", "Rent again, from Ada Lovelace"]);
    await expect(
      runPageAction("page.find-mail", { contains: "rent", mailbox: "Any Mailbox" }, [], host()),
    ).resolves.toHaveLength(3);
  });

  it("writes addresses and subjects as a person reads them", () => {
    expect(addressesOf("ada, grace;\nalan")).toEqual(["ada", "grace", "alan"]);
    expect(mailItemText({ subject: "", from: { name: "ada" } })).toBe("(No Subject), from ada");
  });
});

describe("Safari's steps", () => {
  it("hands on the tab Safari keeps as active", async () => {
    serve({
      "GET /api/safari/tabs": () => [
        200,
        { tabs: ["https://a.example/", "https://b.example/"], active: 1 },
      ],
    });
    await expect(runPageAction("page.current-webpage", {}, [], host())).resolves.toEqual([
      "https://b.example/",
    ]);
  });

  it("says so when Safari has nothing open", async () => {
    serve({ "GET /api/safari/tabs": () => [200, { tabs: [""], active: 0 }] });
    await expect(runPageAction("page.current-webpage", {}, [], host())).rejects.toThrow(
      "Safari has no page open.",
    );
  });

  it("fails a page Safari cannot open with Safari's own reason", async () => {
    const address = "https://example.com/";
    serve({
      [`GET /api/safari/page?url=${encodeURIComponent(address)}&private=1`]: () => [
        200,
        { ok: false, kind: "not-listed", message: "example.com is not a listed site" },
      ],
    });
    await expect(runPageAction("page.webpage-text", {}, [address], host())).rejects.toThrow(
      "example.com is not a listed site",
    );
  });

  it("reads a page's Reader text, or else the words of its HTML", () => {
    expect(pageText({ reader: [{ text: "First" }, { text: "Second" }] })).toBe("First\nSecond");
    expect(
      pageText({
        html: "<html><style>x{}</style><body><p>Some  <b>words</b></p><script>no()</script>",
      }),
    ).toBe("Some words");
  });
});

describe("the rest of the page's steps", () => {
  it("names an image's copy after its new type", () => {
    expect(convertedName("Holiday.final.png", "JPEG")).toBe("Holiday.final.jpg");
    expect(convertedName("scan", "PNG")).toBe("scan.png");
    expect(convertedName("scan.png", "BMP")).toBe("scan.bmp");
    expect(convertedName("scan.png", "TIFF")).toBe("scan.tiff");
  });

  const twoPixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
  const bytesOf = async (blob: Blob) =>
    new Promise<number[]>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve([...new Uint8Array(reader.result as ArrayBuffer)]);
      reader.readAsArrayBuffer(blob);
    });

  it("writes a BMP a reader can take: its header, then rows of blue, green and red", async () => {
    const blob = encodeBmp(twoPixels, 2, 1);
    const bytes = await bytesOf(blob);
    expect(blob.type).toBe("image/bmp");
    expect(bytes.slice(0, 2)).toEqual([0x42, 0x4d]);
    expect(bytes).toHaveLength(54 + 8);
    expect(bytes.slice(54)).toEqual([0, 0, 255, 255, 0, 0, 0, 0]);
  });

  it("writes a TIFF a reader can take: little-endian, ten tags, then red, green and blue", async () => {
    const blob = encodeTiff(twoPixels, 2, 1);
    const bytes = await bytesOf(blob);
    expect(blob.type).toBe("image/tiff");
    expect(bytes.slice(0, 4)).toEqual([0x49, 0x49, 42, 0]);
    expect(bytes[8]).toBe(10);
    expect(bytes.slice(-6)).toEqual([255, 0, 0, 0, 0, 255]);
  });

  it("hands on what is selected in Mail, and says when nothing is", () => {
    const owner = {};
    publishMailSelection(owner, [
      { subject: "Lunch", from: "Anna" },
      { subject: "", from: "" },
    ]);
    expect(selectedMail()).toEqual(["Lunch, from Anna", "(No Subject)"]);
    clearMailSelection(owner);
    expect(() => selectedMail()).toThrow("Nothing is selected in Mail.");
  });

  it("says when nothing is selected in Finder, and only the window that spoke last clears it", async () => {
    const [first, second] = [{}, {}];
    publishFinderSelection(first, ["file-1"]);
    publishFinderSelection(second, []);
    clearFinderSelection(first);
    await expect(selectedFinderItems()).rejects.toThrow("Nothing is selected in Finder.");
    clearFinderSelection(second);
    await expect(runPageAction("page.selected-finder", {}, [], host())).rejects.toThrow(
      "Nothing is selected in Finder.",
    );
  });

  it("says when nothing is selected in Photos, and only the window that spoke last clears it", async () => {
    const [first, second] = [{}, {}];
    publishPhotosSelection(first, ["file-1"]);
    publishPhotosSelection(second, []);
    clearPhotosSelection(first);
    await expect(selectedPhotos()).rejects.toThrow("Nothing is selected in Photos.");
    clearPhotosSelection(second);
    await expect(runPageAction("page.selected-photos", {}, [], host())).rejects.toThrow(
      "Nothing is selected in Photos.",
    );
  });

  it("refuses an action it does not have", async () => {
    await expect(runPageAction("page.gone", {}, [], host())).rejects.toThrow(
      "This desktop's Automator does not have this action any more.",
    );
  });
});

describe("the items a server step hands on", () => {
  const reply = {
    id: "r",
    trigger: "manual",
    steps: [
      {
        action: "files.list",
        title: "Get Folder Contents",
        status: "completed",
        items: 7,
        preview: ["a", "b", "c", "d", "e"],
        all: [
          "a",
          { text: "b" },
          {
            kind: "file",
            id: "f1",
            name: "c.txt",
            path: "Documents/c.txt",
            text: "Documents/c.txt",
          },
          "d",
          "e",
          "f",
          "line one\nline two",
        ],
      },
    ],
  };

  it("goes on whole past the five items of the log", () => {
    const log = runFromServer(reply)?.steps[0];
    const { items, whole } = handedOn(log);
    expect(whole).toBe(true);
    expect(items).toEqual([
      "a",
      "b",
      { kind: "file", id: "f1", name: "c.txt", path: "Documents/c.txt", text: "Documents/c.txt" },
      "d",
      "e",
      "f",
      "line one\nline two",
    ]);
  });

  it("falls back to the log, and says it is cut, when the reply carried none", () => {
    const { all: _all, ...kept } = reply.steps[0] as (typeof reply.steps)[number];
    const log = runFromServer({ ...reply, steps: [kept] })?.steps[0];
    expect(handedOn(log)).toEqual({ items: ["a", "b", "c", "d", "e"], whole: false });
  });
});

describe("the User variables", () => {
  it("hold the account Mail's route names", async () => {
    const { loadAccountVariables } = await import("./automator-page");
    serve({
      "GET /api/mail/me": () => [
        200,
        { name: "ada", full_name: "Ada Lovelace", address: "ada@macalicious" },
      ],
    });
    await loadAccountVariables();
    const read = (name: string) => variableValues(name, new Map(), [], new Date(0));
    expect(read("Full name")).toEqual(["Ada Lovelace"]);
    expect(read("Short name")).toEqual(["ada"]);
    expect(read("Email address")).toEqual(["ada@macalicious"]);
  });
});
