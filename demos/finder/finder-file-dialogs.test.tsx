import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_EFFECTS_EVENT } from "../desktop/desktop-effects";
import {
  type DriveEntry,
  type DriveOp,
  loadDrive,
  readFile,
  runOps,
  uploadFile,
} from "../desktop/desktop-files";
import { Finder } from "./finder";
import { TRASH } from "./finder-data";
import { DriveOpenPanel, DriveSavePanel, saveToDrive } from "./finder-file-dialogs";
import { requestOpenFile, takeOpenFileRequest } from "./finder-open";

/*
 * Finder, the shared Open and Save dialogs and the drive's browser helper against a stand-in
 * for the desktop app's `/api/files/` (`ferrite-apps/desktop/src/apps/files/`, whose own rules
 * are tested in Rust): the stand-in keeps entries and bytes in memory and answers the same
 * routes and shapes, with pieces of 4 bytes so that a small file goes up in several. What the
 * real server and Ferrite storage do is proved by the Rust tests and e2e/finder-journey.mjs.
 */

const PIECE = 4;

function createServer() {
  let rev = 0;
  let next = 0;
  // A session of its own: the page then takes this server's drive, whatever revision the
  // previous test's had.
  const session = `s-${Math.random()}`;
  const id = () => {
    next += 1;
    return `e${next}`;
  };
  const home = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"];
  const entries: DriveEntry[] = home.map((name) => ({
    id: name.toLowerCase(),
    name,
    kind: "folder",
    size: 0,
    created_ms: 1,
    modified_ms: 1,
  }));
  const bytes = new Map<string, Uint8Array>();
  const uploads = new Map<
    string,
    { parent: string; name: string; type: string; size: number; parts: Uint8Array[] }
  >();
  // The upload each start's idempotency key opened: a resent start answers the same one, as
  // the real server does (`start:<key>` in the drive).
  const started = new Map<string, string>();
  // Every upload start's body, in order.
  const starts: Record<string, unknown>[] = [];
  const requests: string[] = [];
  const drive = (created?: string[]) => ({
    rev,
    entries: structuredClone(entries),
    usage: [...bytes.values()].reduce((sum, part) => sum + part.length, 0),
    quota: 1_000_000,
    piece_bytes: PIECE,
    max_file_bytes: 1_000,
    max_entries: 100,
    session,
    ...(created ? { created } : {}),
  });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const find = (entryId: string) => entries.find((entry) => entry.id === entryId);
  const apply = (op: DriveOp, created: string[]) => {
    switch (op.op) {
      case "mkdir": {
        const taken = entries.find((e) => e.parent === op.parent && e.name === op.name);
        if (taken && op.existing === "reuse") {
          created.push(taken.id);
          return;
        }
        const made = id();
        entries.push({
          id: made,
          parent: op.parent,
          name: taken ? `${op.name} 2` : op.name,
          kind: "folder",
          size: 0,
          created_ms: 2,
          modified_ms: 2,
        });
        created.push(made);
        return;
      }
      case "rename":
        (find(op.id) as DriveEntry).name = op.name;
        return;
      case "move":
        (find(op.id) as DriveEntry).parent = op.parent;
        return;
      case "trash":
        (find(op.id) as DriveEntry).trashed_ms = 5;
        return;
      case "restore":
        delete (find(op.id) as DriveEntry).trashed_ms;
        return;
      case "opened":
        (find(op.id) as DriveEntry).opened_ms = 6;
        return;
      default:
        return;
    }
  };
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://desktop.test");
    const method = init.method ?? "GET";
    const path = url.pathname.replace(/^\/api\/files/, "");
    requests.push(`${method} ${path}`);
    if (method === "GET" && path === "/") return json(drive());
    if (method === "POST" && path === "/ops") {
      const { ops } = JSON.parse(String(init.body)) as { ops: DriveOp[] };
      const created: string[] = [];
      for (const op of ops) apply(op, created);
      rev += 1;
      return json(drive(created));
    }
    if (method === "POST" && path === "/uploads") {
      const body = JSON.parse(String(init.body));
      starts.push(body);
      const key = new Headers(init.headers).get("idempotency-key");
      const again = key ? started.get(key) : undefined;
      const upload = again ?? id().replace(/^e/, "u");
      if (!again) uploads.set(upload, { ...body, parts: [] });
      if (key) started.set(key, upload);
      return json({ upload, piece_bytes: PIECE, pieces: Math.ceil(body.size / PIECE) }, 201);
    }
    const piece = path.match(/^\/uploads\/(\w+)\/(\d+)$/);
    if (method === "PUT" && piece) {
      const upload = uploads.get(piece[1] as string);
      if (!upload) return json({ error: "no such upload" }, 404);
      upload.parts[Number(piece[2])] = new Uint8Array(init.body as ArrayBuffer);
      return json({ received: 1 });
    }
    const complete = path.match(/^\/uploads\/(\w+)\/complete$/);
    if (method === "POST" && complete) {
      const upload = uploads.get(complete[1] as string);
      if (!upload) return json({ error: "no such upload" }, 404);
      const made = id();
      const whole = new Uint8Array(upload.parts.reduce((sum, part) => sum + part.length, 0));
      let at = 0;
      for (const part of upload.parts) {
        whole.set(part, at);
        at += part.length;
      }
      bytes.set(made, whole);
      entries.push({
        id: made,
        parent: upload.parent,
        name: upload.name,
        kind: "file",
        size: upload.size,
        type: upload.type,
        created_ms: 3,
        modified_ms: 3,
      });
      rev += 1;
      return json(drive([made]));
    }
    const content = path.match(/^\/content\/(\w+)$/);
    if (method === "GET" && content) {
      const whole = bytes.get(content[1] as string);
      if (!whole) return json({ error: "no such file" }, 404);
      const first = Number(url.searchParams.get("piece") ?? 0);
      const count = Number(url.searchParams.get("count") ?? 1);
      return new Response(whole.slice(first * PIECE, (first + count) * PIECE));
    }
    return json({ error: "not found" }, 404);
  });
  return { fetch, entries, requests, uploads, starts };
}

let server: ReturnType<typeof createServer>;

beforeEach(async () => {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  server = createServer();
  vi.stubGlobal("fetch", server.fetch);
  // The page keeps one copy of the drive: start each test from this server's.
  await loadDrive();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const text = (value: string) => new Blob([value], { type: "text/plain" });

describe("the drive's browser helper", () => {
  it("answers each change with its own reply when a later revision's reply arrives first", async () => {
    // The first change's reply is held back until the second one has answered.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const inner = server.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const reply = await inner(input, init);
      if (String(input).endsWith("/ops")) {
        calls += 1;
        if (calls === 1) await held;
      }
      return reply;
    });
    const first = runOps([{ op: "mkdir", parent: "documents", name: "First" }]);
    // Let the first send go out before the second.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = await runOps([{ op: "mkdir", parent: "documents", name: "Second" }]);
    release();
    const answered = await first;
    const made = (drive: { created?: string[]; entries: DriveEntry[] }) =>
      drive.entries.find((entry) => entry.id === drive.created?.[0])?.name;
    expect(made(second)).toBe("Second");
    expect(made(answered)).toBe("First");
    expect(answered.rev).toBeLessThan(second.rev);
  });

  it("opens one upload when the reply to its start is lost and the start is sent again", async () => {
    const inner = server.fetch;
    const keys: (string | null)[] = [];
    let lost = false;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const reply = await inner(input, init);
      if (String(input).endsWith("/uploads") && (init.method ?? "GET") === "POST") {
        keys.push(new Headers(init.headers).get("idempotency-key"));
        // The server opened the upload, and its reply never arrives.
        if (!lost) {
          lost = true;
          throw new TypeError("Failed to fetch");
        }
      }
      return reply;
    });
    const entry = await uploadFile(text("once"), "documents", { name: "Once.txt" });
    expect(entry.name).toBe("Once.txt");
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(server.uploads.size).toBe(1);
  });

  it("never hands back a short file", async () => {
    const entry = await uploadFile(text("twelve bytes"), "documents", { name: "Twelve.txt" });
    const inner = server.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const reply = await inner(input, init);
      if (!String(input).includes("/content/")) return reply;
      // The reply carries fewer bytes than the file has.
      return new Response((await reply.arrayBuffer()).slice(0, 5));
    });
    await expect(readFile(entry.id)).rejects.toMatchObject({ status: 503 });
  });

  it("uploads a file in pieces and reads it back whole, typed", async () => {
    const entry = await uploadFile(new File(["hello, drive!"], "Hello.txt"), "documents");
    expect(entry).toMatchObject({ name: "Hello.txt", parent: "documents", size: 13 });
    // 13 bytes in pieces of 4.
    expect(server.requests.filter((r) => r.startsWith("PUT /uploads/"))).toHaveLength(4);
    const blob = await readFile(entry.id);
    expect(await blob.text()).toBe("hello, drive!");
  });
});

describe("the shared Open dialog", () => {
  it("lists a folder of the drive, opens folders and hands over the file chosen", async () => {
    const user = userEvent.setup();
    const folder = (await uploadFile(text("x"), "documents", { name: "x" })).id;
    server.entries.push({
      id: "letters",
      parent: "documents",
      name: "Letters",
      kind: "folder",
      size: 0,
      created_ms: 1,
      modified_ms: 1,
    });
    await uploadFile(text("Dear council"), "letters", { name: "To the council.txt" });
    const onOpen = vi.fn();
    render(<DriveOpenPanel onOpen={onOpen} onCancel={() => {}} />);
    expect(await screen.findByRole("option", { name: "Letters" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "x" })).toBeInTheDocument();
    await user.dblClick(screen.getByRole("option", { name: "Letters" }));
    await user.dblClick(await screen.findByRole("option", { name: "To the council.txt" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: "To the council.txt" }));
    expect(folder).toBeTruthy();
  });

  it("does not open a file the app does not take", async () => {
    const user = userEvent.setup();
    await uploadFile(text("x"), "documents", { name: "Notes.txt" });
    const onOpen = vi.fn();
    render(
      <DriveOpenPanel
        accept={(entry) => entry.type?.startsWith("image/") ?? false}
        onOpen={onOpen}
        onCancel={() => {}}
      />,
    );
    await user.click(await screen.findByRole("option", { name: "Notes.txt" }));
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();
    await user.dblClick(screen.getByRole("option", { name: "Notes.txt" }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("the shared Save dialog", () => {
  it("leaves a folder that goes to the Trash while it is shown", async () => {
    const user = userEvent.setup();
    server.entries.push({
      id: "drafts",
      parent: "documents",
      name: "Drafts",
      kind: "folder",
      size: 0,
      created_ms: 1,
      modified_ms: 1,
    });
    await uploadFile(text("x"), "drafts", { name: "Old.txt" });
    const onSave = vi.fn();
    render(
      <DriveSavePanel
        defaultName="New.txt"
        defaultFolder="drafts"
        defaultExpanded
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    expect(await screen.findByRole("option", { name: "Old.txt" })).toBeInTheDocument();
    // Another window moves the folder to the Trash.
    await runOps([{ op: "trash", id: "drafts" }]);
    await waitFor(() => expect(screen.queryByRole("option", { name: "Old.txt" })).toBeNull());
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith({ folder: "documents", name: "New.txt" });
  });

  it("never saves into a folder that is already in the Trash when the dialog opens", async () => {
    const user = userEvent.setup();
    server.entries.push({
      id: "drafts",
      parent: "documents",
      name: "Drafts",
      kind: "folder",
      size: 0,
      created_ms: 1,
      modified_ms: 1,
      trashed_ms: 5,
    });
    await loadDrive();
    const onSave = vi.fn();
    render(
      <DriveSavePanel
        defaultName="New.txt"
        defaultFolder="drafts"
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ folder: "documents", name: "New.txt" });
  });

  it("does not replace into a folder that went to the Trash while it asked", async () => {
    const user = userEvent.setup();
    server.entries.push({
      id: "drafts",
      parent: "documents",
      name: "Drafts",
      kind: "folder",
      size: 0,
      created_ms: 1,
      modified_ms: 1,
    });
    await uploadFile(text("x"), "drafts", { name: "Old.txt" });
    const onSave = vi.fn();
    render(
      <DriveSavePanel
        defaultName="Old.txt"
        defaultFolder="drafts"
        defaultExpanded
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    expect(await screen.findByRole("option", { name: "Old.txt" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alertdialog");
    // Another window moves the folder to the Trash before the answer.
    await runOps([{ op: "trash", id: "drafts" }]);
    await user.click(within(alert).getByRole("button", { name: "Replace" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("refuses a name a folder has, and never offers to replace a folder", async () => {
    const user = userEvent.setup();
    server.entries.push({
      id: "box",
      parent: "documents",
      name: "Box",
      kind: "folder",
      size: 0,
      created_ms: 1,
      modified_ms: 1,
    });
    await loadDrive();
    const onSave = vi.fn();
    render(<DriveSavePanel defaultName="box" onSave={onSave} onCancel={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("A folder named “Box” already exists.");
    expect(within(alert).queryByRole("button", { name: "Replace" })).toBeNull();
    await user.click(within(alert).getByRole("button", { name: "OK" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("replaces only the file the person chose", async () => {
    const old = await uploadFile(text("old"), "documents", { name: "Report.txt" });
    await saveToDrive({ folder: "documents", name: "Report.txt", replaces: old }, text("new"));
    expect(server.starts.at(-1)).toMatchObject({
      name: "Report.txt",
      existing: "replace",
      replaces: old.id,
    });
    await saveToDrive({ folder: "documents", name: "Fresh.txt" }, text("x"));
    expect(server.starts.at(-1)).toMatchObject({ existing: "fail" });
    expect(server.starts.at(-1)).not.toHaveProperty("replaces");
  });

  it("saves into Documents, and asks before replacing a file of the same name", async () => {
    const user = userEvent.setup();
    await uploadFile(text("old"), "documents", { name: "Report.txt" });
    const onSave = vi.fn();
    render(<DriveSavePanel defaultName="Untitled.txt" onSave={onSave} onCancel={() => {}} />);
    const field = screen.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Fresh.txt");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith({ folder: "documents", name: "Fresh.txt" });

    await user.clear(field);
    await user.type(field, "report.txt");
    await user.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("“report.txt” already exists.");
    await user.click(within(alert).getByRole("button", { name: "Replace" }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        folder: "documents",
        name: "report.txt",
        replaces: expect.objectContaining({ name: "Report.txt" }),
      }),
    );
  });
});

describe("Finder on the drive", () => {
  it("shows the drive, uploads into the folder shown, and moves a file to the Trash", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await user.click(await screen.findByRole("treeitem", { name: "Documents" }));
    expect(screen.queryAllByRole("option")).toHaveLength(0);

    const input = screen.getByLabelText("Upload Files") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["twelve bytes"], "Plan.txt", { type: "text/plain" })] },
    });
    const uploaded = await screen.findByRole("option", { name: "Plan.txt" });
    expect(server.entries.find((e) => e.name === "Plan.txt")?.parent).toBe("documents");
    await waitFor(() => expect(uploaded).toHaveAttribute("aria-selected", "true"));

    await user.click(screen.getByRole("button", { name: "Action" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move to Trash" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: "Plan.txt" })).toBeNull());
    expect(server.entries.find((e) => e.name === "Plan.txt")?.trashed_ms).toBe(5);
    expect(server.requests).toContain("POST /ops");
  });

  it("puts back the trashed item chosen when another in the Trash has its name", async () => {
    const user = userEvent.setup();
    const trashed = (id: string, parent: string): DriveEntry => ({
      id,
      parent,
      name: "Note.txt",
      kind: "file",
      size: 4,
      type: "text/plain",
      created_ms: 1,
      modified_ms: 1,
      trashed_ms: 5,
    });
    server.entries.push(trashed("doc1a2b3c", "documents"), trashed("desk9f8e7", "desktop"));
    await loadDrive();
    render(<Finder defaultTabs={[TRASH]} />);
    // Each shows its name with a suffix of its own id while they share it.
    expect(await screen.findByRole("option", { name: "Note doc1a2.txt" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Note desk9f.txt" }));
    await user.click(screen.getByRole("button", { name: "Action" }));
    await user.click(await screen.findByRole("menuitem", { name: "Put Back" }));
    await waitFor(() =>
      expect(server.entries.find((e) => e.id === "desk9f8e7")?.trashed_ms).toBeUndefined(),
    );
    expect(server.entries.find((e) => e.id === "doc1a2b3c")?.trashed_ms).toBe(5);
  });

  it("renames a file on the drive in place, from Return", async () => {
    const user = userEvent.setup();
    await uploadFile(text("x"), "documents", { name: "Draft.txt" });
    render(<Finder />);
    await user.click(await screen.findByRole("treeitem", { name: "Documents" }));
    await user.click(await screen.findByRole("option", { name: "Draft.txt" }));
    await user.keyboard("{Enter}");
    const field = await screen.findByRole("textbox", { name: "Name" });
    await user.clear(field);
    await user.type(field, "Final.txt{Enter}");
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull());
    expect(await screen.findByRole("option", { name: "Final.txt" })).toBeInTheDocument();
    expect(server.entries.find((e) => e.name === "Final.txt")?.parent).toBe("documents");
  });

  it("shows the file another app asks it to show, in its folder and selected", async () => {
    const entry = await uploadFile(text("x"), "documents", { name: "Asked.txt" });
    await uploadFile(text("y"), "documents", { name: "Other.txt" });
    // Asked before the window opens (Show in Finder opens Finder), and while it is open.
    requestOpenFile({ app: "finder", id: entry.id, name: "Asked.txt" });
    render(<Finder />);
    const asked = await screen.findByRole("option", { name: "Asked.txt" });
    await waitFor(() => expect(asked).toHaveAttribute("aria-selected", "true"));
    expect(screen.getByRole("option", { name: "Other.txt" })).not.toHaveAttribute(
      "aria-selected",
      "true",
    );
    const other = server.entries.find((e) => e.name === "Other.txt");
    if (!other) throw new Error("Other.txt was not uploaded");
    requestOpenFile({ app: "finder", id: other.id, name: "Other.txt" });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Other.txt" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("keeps the six home folders from being renamed or trashed", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await user.click(await screen.findByRole("option", { name: "Music" }));
    await user.click(screen.getByRole("button", { name: "Action" }));
    expect(await screen.findByRole("menuitem", { name: "Rename" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Move to Trash" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("opens a text document in TextEdit, and anything else in Quick Look", async () => {
    const user = userEvent.setup();
    const letter = await uploadFile(text("{\\rtf1 Hi}"), "documents", { name: "Letter.rtf" });
    await uploadFile(new Blob(["x"], { type: "application/zip" }), "documents", {
      name: "Archive.zip",
    });
    const effects: unknown[] = [];
    const hear = (event: Event) => effects.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    try {
      render(<Finder />);
      await user.click(await screen.findByRole("treeitem", { name: "Documents" }));
      await user.dblClick(await screen.findByRole("option", { name: "Letter.rtf" }));
      // The desktop opens TextEdit, which takes the file.
      expect(effects).toEqual([[{ open: "textedit" }]]);
      expect(takeOpenFileRequest("textedit")).toEqual({
        app: "textedit",
        id: letter.id,
        name: "Letter.rtf",
      });
      expect(screen.queryByRole("dialog", { name: /Letter/ })).toBeNull();
      await user.dblClick(screen.getByRole("option", { name: "Archive.zip" }));
      expect(effects).toHaveLength(1);
      expect(await screen.findByRole("dialog", { name: /Archive\.zip/ })).toBeInTheDocument();
    } finally {
      window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
    }
  });
});
