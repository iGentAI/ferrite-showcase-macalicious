import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DriveEntry } from "../desktop/desktop-files";
import { changeDesktopValue } from "../desktop/desktop-personal";
import { requestOpenFile } from "../finder/finder-open";
import { ASK_TO_KEEP_KEY } from "../system-preferences/panes/general/document-settings";
import { TextEdit, type TextEditActions } from "./textedit";
import { printDocument } from "./textedit-drive";
import { paragraphsOfLines, writeRtf } from "./textedit-rtf";

/** A one-line RTF file as TextEdit writes it. */
const rtf = (line: string) => writeRtf(paragraphsOfLines([line]));

/*
 * TextEdit served by the desktop's Ferrite application while its reads and writes are slow or
 * fail: which document a result reaches, and that no change is lost. A stand-in for the drive and
 * TextEdit's routes keeps entries and bytes in memory and keeps the drive's version rule: a save
 * in place made from a version the file no longer has, and a read of one, answer 412. `hold`
 * keeps a request unanswered until released, `refuse` answers matching requests with an error,
 * and `saveElsewhere` saves over a file as another window or browser does.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type Match = (method: string, path: string) => boolean;

function createServer(draft: unknown = { draft: null, rev: 0 }) {
  const session = `s-${Math.random()}`;
  let rev = 1;
  let next = 0;
  const entries: DriveEntry[] = ["Desktop", "Documents"].map((name) => ({
    id: name.toLowerCase(),
    name,
    kind: "folder",
    size: 0,
    created_ms: 1,
    modified_ms: 1,
  }));
  const bytes = new Map<string, string>();
  const uploads = new Map<string, { body: Record<string, unknown>; text: string }>();
  const starts: Record<string, unknown>[] = [];
  const drafts: Record<string, unknown>[] = [];
  const holds: { match: Match; gate: Promise<void> }[] = [];
  const refusals: Match[] = [];
  let refuseOverwrites = false;
  let stored: unknown = draft;
  const completed = new Map<string, { id: string; version: number }>();
  let lostReply: (() => void) | null = null;
  const drive = (created?: string[]) => ({
    rev,
    entries: structuredClone(entries),
    usage: 0,
    quota: 1_000_000,
    piece_bytes: 1 << 20,
    max_file_bytes: 1 << 24,
    max_entries: 100,
    session,
    ...(created ? { created } : {}),
  });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const answer = (method: string, url: URL, init: RequestInit): Response => {
    const path = url.pathname;
    if (refusals.some((match) => match(method, path))) {
      return json({ error: "The drive refused the write." }, 403);
    }
    if (path === "/api/textedit/draft") {
      if (method === "PUT") {
        const body = JSON.parse(String(init.body));
        drafts.push(body.draft);
        stored = { draft: body.draft, rev: body.rev + 1 };
        return json({ rev: body.rev + 1 });
      }
      return json(stored);
    }
    if (path === "/api/files/" && method === "GET") return json(drive());
    if (path === "/api/files/ops" && method === "POST") return json(drive([]));
    if (path === "/api/files/uploads" && method === "POST") {
      const body = JSON.parse(String(init.body));
      starts.push(body);
      next += 1;
      uploads.set(`u${next}`, { body, text: "" });
      return json({ upload: `u${next}`, piece_bytes: 1 << 20, pieces: 1 }, 201);
    }
    const piece = /^\/api\/files\/uploads\/([^/]+)\/(\d+)$/.exec(path);
    if (piece && method === "PUT") {
      const upload = uploads.get(piece[1] ?? "");
      if (upload) upload.text = new TextDecoder().decode(init.body as ArrayBuffer);
      return json({ piece: 0 });
    }
    const complete = /^\/api\/files\/uploads\/([^/]+)\/complete$/.exec(path);
    if (complete) {
      const uploadId = complete[1] ?? "";
      // Completed already: a resend answers the same file, at the version that upload made.
      const done = completed.get(uploadId);
      if (done) return json({ ...drive([done.id]), version: done.version });
      const upload = uploads.get(uploadId);
      if (!upload) return json({ error: "no such upload" }, 404);
      const { body, text } = upload;
      if (refuseOverwrites && body.existing === "overwrite") {
        return json({ error: "You have no room left on your drive." }, 403);
      }
      let id: string;
      if (body.existing === "overwrite") {
        id = String(body.replaces);
        const entry = entries.find((each) => each.id === id);
        if (!entry) return json({ error: "gone" }, 409);
        if (body.base !== undefined && body.base !== (entry.version ?? 0)) {
          return json(
            { error: `“${entry.name}” was changed elsewhere since it was opened or saved` },
            412,
          );
        }
        entry.size = new TextEncoder().encode(text).length;
        entry.modified_ms += 1;
        entry.version = (entry.version ?? 0) + 1;
      } else {
        next += 1;
        id = `f${next}`;
        entries.push({
          id,
          parent: String(body.parent),
          name: String(body.name),
          kind: "file",
          size: new TextEncoder().encode(text).length,
          type: String(body.type),
          created_ms: 2,
          modified_ms: 2,
        });
      }
      bytes.set(id, text);
      rev += 1;
      const version = entries.find((each) => each.id === id)?.version ?? 0;
      completed.set(uploadId, { id, version });
      // The reply is lost on the way (a dropped connection): the browser sends the completion
      // again, after whatever `lost` does meanwhile.
      if (lostReply) {
        const lost = lostReply;
        lostReply = null;
        lost();
        return json({ error: "the connection dropped" }, 503);
      }
      return json({ ...drive([id]), version });
    }
    const content = /^\/api\/files\/content\/([^/]+)$/.exec(path);
    if (content) {
      const id = content[1] ?? "";
      const asked = url.searchParams.get("version");
      const entry = entries.find((each) => each.id === id);
      if (asked !== null && Number(asked) !== (entry?.version ?? 0)) {
        return json({ error: "the file was saved over while it was read" }, 412);
      }
      return new Response(new TextEncoder().encode(bytes.get(id) ?? ""));
    }
    if (path.startsWith("/api/files/uploads/") && method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return json({ error: `no route ${method} ${path}` }, 404);
  };
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://desktop.test");
    const method = init.method ?? "GET";
    const held = holds.find((each) => each.match(method, url.pathname));
    if (held) {
      holds.splice(holds.indexOf(held), 1);
      await held.gate;
    }
    return answer(method, url, init);
  });
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal("fetch", fetch);
  const put = (id: string, name: string, text: string) => {
    entries.push({
      id,
      parent: "documents",
      name,
      kind: "file",
      size: new TextEncoder().encode(text).length,
      type: name.endsWith(".rtf") ? "text/rtf" : "text/plain",
      created_ms: 3,
      modified_ms: 3,
    });
    bytes.set(id, text);
    rev += 1;
  };
  /** Keeps the next request that matches unanswered until the returned release is called. */
  const hold = (match: Match) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    holds.push({ match, gate });
    return () => act(() => release());
  };
  const refuse = (match: Match) => refusals.push(match);
  /** Refuses every write into an existing file from now on (a full drive, say). */
  const refuseWritesInPlace = () => {
    refuseOverwrites = true;
  };
  /** Saves `text` over the file `id` from elsewhere (another window or browser): its next version. */
  const saveElsewhere = (id: string, text: string) => {
    const entry = entries.find((each) => each.id === id);
    if (!entry) throw new Error(`no file ${id}`);
    entry.size = new TextEncoder().encode(text).length;
    entry.modified_ms += 1;
    entry.version = (entry.version ?? 0) + 1;
    bytes.set(id, text);
    rev += 1;
  };
  /** Drops the reply of the next completion that goes in, after running `meanwhile`. */
  const loseNextCompletionReply = (meanwhile: () => void) => {
    lostReply = meanwhile;
  };
  return {
    entries,
    bytes,
    starts,
    drafts,
    put,
    hold,
    refuse,
    refuseWritesInPlace,
    saveElsewhere,
    loseNextCompletionReply,
  };
}

const editor = () => screen.getByRole("textbox", { name: "Document" });
const body = () => document.querySelector(".mac-textedit-body") as HTMLElement;
const key = (letter: string) => fireEvent.keyDown(editor(), { key: letter, ctrlKey: true });
const completing: Match = (method, path) => method === "POST" && /\/complete$/.test(path);

function write(html: string) {
  const node = editor();
  node.innerHTML = html;
  fireEvent.input(node);
}

async function ready() {
  await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
}

async function openFile(_id: string, name: string, text: string) {
  await waitFor(() => expect(editor().textContent).toBe(text));
  expect(screen.getByRole("region", { name: name.replace(/\.rtf$/, "") })).toBeInTheDocument();
}

describe("TextEdit's documents while the drive is slow or fails", () => {
  it("asks about replacing the file of the name it saves under, not the name typed", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-notes", "Notes.txt", "Old notes");
    render(<TextEdit defaultDocument={{ name: "Untitled", format: "rich", lines: [""] }} />);
    await ready();
    write("<div>New notes</div>");
    key("s");
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    await user.click(screen.getByRole("combobox", { name: "File Format:" }));
    await user.click(await screen.findByRole("option", { name: "Plain Text" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Notes.rtf");
    await user.click(save.getByRole("button", { name: "Save" }));
    // Plain text is saved as Notes.txt, which the folder has: the field takes that name, and the
    // dialog asks about replacing that file, not the one typed.
    expect(
      await screen.findByText("“Notes.txt” already exists. Do you want to replace it?"),
    ).toBeInTheDocument();
    expect(server.starts).toHaveLength(0);
  });

  it("never asks about replacing the file of the name typed when it saves under another", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-memo", "Memo.rtf", rtf("Old"));
    render(<TextEdit defaultDocument={{ name: "Untitled", format: "rich", lines: [""] }} />);
    await ready();
    write("<div>New notes</div>");
    key("s");
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    await user.click(screen.getByRole("combobox", { name: "File Format:" }));
    await user.click(await screen.findByRole("option", { name: "Plain Text" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Memo.rtf");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(
      () => expect(server.entries.some((each) => each.name === "Memo.txt")).toBe(true),
      { timeout: 4000 },
    );
    expect(server.starts.map((each) => [each.name, each.existing])).toEqual([["Memo.txt", "fail"]]);
    expect(screen.queryByText(/already exists/)).toBeNull();
    expect(server.bytes.get("f-memo")).toBe(rtf("Old"));
  });

  it("keeps a document Duplicate would replace when its file cannot be written", async () => {
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    const actions = { current: null } as { current: TextEditActions | null };
    render(<TextEdit actionsRef={actions} />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    server.refuse(completing);
    write("<div>Alpha, changed</div>");
    act(() => actions.current?.file?.duplicate());
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("could not be saved");
    // The alert hides the window from the accessibility tree while it is open.
    expect(screen.getByRole("textbox", { name: "Document", hidden: true }).textContent).toBe(
      "Alpha, changed",
    );
    expect(screen.getByRole("region", { name: "A — Edited", hidden: true })).toBeInTheDocument();
  });

  it("locks the document while a Save As is under way, and unlocks it once saved", async () => {
    const user = userEvent.setup();
    const server = createServer();
    render(<TextEdit defaultDocument={{ name: "Untitled", format: "rich", lines: [""] }} />);
    await ready();
    write("<div>Draft one</div>");
    key("s");
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "One");
    const release = server.hold(completing);
    await user.click(save.getByRole("button", { name: "Save" }));
    // Locked: nothing can be typed, and New does nothing.
    await waitFor(() => expect(body()).toHaveAttribute("inert"));
    key("n");
    expect(screen.queryByRole("dialog", { name: /save the changes/ })).toBeNull();
    release();
    // Saved: the window has the file and takes edits again.
    await waitFor(() => expect(screen.getByRole("region", { name: "One" })).toBeInTheDocument());
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    const saved = server.entries.find((each) => each.name === "One.rtf") as DriveEntry;
    expect(server.bytes.get(saved.id)).toContain("Draft one");
  });
  it("stops a Save As whose original file cannot be written, and stays on that file", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    const actions = { current: null } as { current: TextEditActions | null };
    render(<TextEdit actionsRef={actions} />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    write("<div>Alpha, changed</div>");
    act(() => actions.current?.file?.saveAs());
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Beta");
    server.refuse(completing);
    await user.click(save.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("could not be saved");
    expect(server.starts.some((each) => each.name === "Beta.rtf")).toBe(false);
    expect(screen.getByRole("region", { name: "A — Edited", hidden: true })).toBeInTheDocument();
  });

  it("reads a restored draft's file again when autosave had written it, instead of writing over it", async () => {
    const server = createServer({
      draft: {
        name: "A.rtf",
        format: "rich",
        lines: ["Old draft"],
        html: "<div>Old draft</div>",
        edited: true,
        unwritten: false,
        file: { id: "0a1b2c3d4e5f60718293a4b5c6d7e8f9", name: "A.rtf" },
      },
      rev: 1,
    });
    // The file changed elsewhere since the draft was written.
    server.put("0a1b2c3d4e5f60718293a4b5c6d7e8f9", "A.rtf", rtf("Newer file"));
    render(<TextEdit />);
    await ready();
    await waitFor(() => expect(editor().textContent).toBe("Newer file"));
    expect(server.starts).toHaveLength(0);
  });

  it("lets go of a restored draft's file that is now in an encoding it does not open, and never writes it", async () => {
    const id = "1a2b3c4d5e6f70819203a4b5c6d7e8f9";
    const server = createServer({
      draft: {
        name: "B.rtf",
        format: "rich",
        lines: ["My draft"],
        html: "<div>My draft</div>",
        edited: false,
        unwritten: false,
        file: { id, name: "B.rtf" },
      },
      rev: 1,
    });
    // Replaced elsewhere with RTF TextEdit did not write.
    const foreign = "{\\rtf1\\ansi\\ansicpg99999 \\'cf\\par}";
    server.put(id, "B.rtf", foreign);
    render(<TextEdit />);
    await ready();
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("TextEdit on Ferrite can’t open yet");
    // The draft keeps its text, bound to no file now: typing writes nothing into the file.
    expect(screen.getByRole("textbox", { name: "Document", hidden: true }).textContent).toBe(
      "My draft",
    );
    await waitFor(() => expect(server.drafts.at(-1)?.file).toBeUndefined());
    expect(server.starts).toHaveLength(0);
    expect(server.bytes.get(id)).toBe(foreign);
  });

  it("never writes a restored draft's unwritten changes over a file now in another encoding", async () => {
    const id = "2a3b4c5d6e7f80918203a4b5c6d7e8f9";
    const server = createServer({
      draft: {
        name: "C.rtf",
        format: "rich",
        lines: ["Unwritten words"],
        html: "<div>Unwritten words</div>",
        edited: true,
        unwritten: true,
        file: { id, name: "C.rtf", version: 0 },
      },
      rev: 1,
    });
    const foreign = "{\\rtf1\\pca caf\\'82\\par}";
    server.put(id, "C.rtf", foreign);
    render(<TextEdit />);
    await ready();
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("TextEdit on Ferrite can’t open yet");
    await waitFor(() => expect(server.drafts.at(-1)?.file).toBeUndefined());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.starts).toHaveLength(0);
    expect(server.bytes.get(id)).toBe(foreign);
    expect(screen.getByRole("textbox", { name: "Document", hidden: true }).textContent).toBe(
      "Unwritten words",
    );
  });

  it("asks before replacing a restored draft whose changes could not be written", async () => {
    const id = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
    const server = createServer({
      draft: {
        name: "A.rtf",
        format: "rich",
        lines: ["Unwritten words"],
        html: "<div>Unwritten words</div>",
        edited: true,
        unwritten: true,
        file: { id, name: "A.rtf", version: 0 },
      },
      rev: 1,
    });
    server.put(id, "A.rtf", rtf("Older"));
    server.refuseWritesInPlace();
    render(<TextEdit />);
    await ready();
    // The restoring write is refused: the changes are still unwritten, so New asks.
    await waitFor(() => expect(server.starts.length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeNull());
    await userEvent.setup().click(screen.getByRole("button", { name: "OK" }));
    expect(editor().textContent).toBe("Unwritten words");
    key("n");
    expect(await screen.findByRole("dialog", { name: /save the changes/ })).toBeInTheDocument();
    expect(editor().textContent).toBe("Unwritten words");
  });

  it("saves into a new file from the save-changes sheet though the original cannot be written", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    server.refuseWritesInPlace();
    write("<div>Alpha, rescued</div>");
    key("n");
    const ask = within(await screen.findByRole("dialog", { name: /save the changes/ }));
    await user.click(ask.getByRole("button", { name: "Save…" }));
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Rescued");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(
      () => expect(server.entries.some((each) => each.name === "Rescued.rtf")).toBe(true),
      { timeout: 4000 },
    );
    const rescued = server.entries.find((each) => each.name === "Rescued.rtf") as DriveEntry;
    expect(server.bytes.get(rescued.id)).toContain("Alpha, rescued");
    // Then the New that asked goes on.
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Untitled" })).toBeInTheDocument(),
    );
  });

  it("asks before writing over a file saved elsewhere since it was opened, and keeps the window's changes", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    // Saved from this window twice: each save is made from the version the one before made.
    for (const text of ["Alpha, mine", "Alpha, mine twice"]) {
      write(`<div>${text}</div>`);
      key("s");
      await waitFor(() => expect(server.bytes.get("f-a")).toContain(text));
      await waitFor(() => expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument());
    }
    expect(server.starts.map((each) => each.base)).toEqual([0, 1]);
    // Another window saves the file: this one's next save is refused, never written over it.
    server.saveElsewhere("f-a", rtf("Theirs"));
    write("<div>Alpha, mine again</div>");
    key("s");
    const ask = within(
      await screen.findByRole("dialog", { name: /changed by another application/ }),
    );
    expect(
      ask.getByText(/changed by another application since you opened or saved it/),
    ).toBeInTheDocument();
    expect(server.bytes.get("f-a")).toBe(rtf("Theirs"));
    // Cancel keeps the changes in the window, and autosave writes nothing over the file.
    const tried = server.starts.length;
    await user.click(ask.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /changed by another application/ })).toBeNull(),
    );
    write("<div>Alpha, mine again and more</div>");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(server.starts).toHaveLength(tried);
    expect(editor().textContent).toBe("Alpha, mine again and more");
    expect(screen.getByRole("region", { name: "A — Edited" })).toBeInTheDocument();
    // Save asks again; Save Anyway writes the window's document over the other change.
    key("s");
    const again = within(
      await screen.findByRole("dialog", { name: /changed by another application/ }),
    );
    await user.click(again.getByRole("button", { name: "Save Anyway" }));
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Alpha, mine again and more"));
    expect(server.starts.at(-1)).not.toHaveProperty("base");
    await waitFor(() => expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument());
    // Autosave goes on from the version Save Anyway made.
    write("<div>Alpha, after</div>");
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Alpha, after"), {
      timeout: 4000,
    });
    expect(server.starts.at(-1)?.base).toBe(4);
    // The draft has its last text too, so nothing of this window is still to be sent.
    await waitFor(() => expect(server.drafts.at(-1)?.lines).toEqual(["Alpha, after"]));
  });

  it("asks nothing when the file saved over already holds the very text this save writes", async () => {
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    write("<div>Mine</div>");
    key("s");
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Mine"));
    await waitFor(() => expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument());
    // As when this document's own autosave finished after the page that sent it had gone.
    server.saveElsewhere("f-a", server.bytes.get("f-a") as string);
    const version = server.starts.length;
    write("<div>Mine</div>");
    key("s");
    await waitFor(() => expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument());
    expect(server.starts).toHaveLength(version + 1);
    expect(screen.queryByRole("dialog", { name: /changed by another application/ })).toBeNull();
    // The next save is made from the version the file has now, and is not refused.
    write("<div>Mine, more</div>");
    key("s");
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Mine, more"));
    await waitFor(() => expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument());
    await waitFor(() => expect(server.drafts.at(-1)?.lines).toEqual(["Mine, more"]));
    expect(screen.queryByRole("dialog", { name: /changed by another application/ })).toBeNull();
  });

  it("asks before writing a restored draft whose file version it does not know", async () => {
    const user = userEvent.setup();
    const id = "3a4b5c6d7e8f90a1b2c3d4e5f6a7b8c9";
    // A draft kept before versions were: unwritten changes, and a file with no version.
    const server = createServer({
      draft: {
        name: "D.rtf",
        format: "rich",
        lines: ["Unwritten words"],
        html: "<div>Unwritten words</div>",
        edited: true,
        unwritten: true,
        file: { id, name: "D.rtf" },
      },
      rev: 1,
    });
    server.put(id, "D.rtf", rtf("Maybe newer"));
    render(<TextEdit />);
    await ready();
    const ask = within(
      await screen.findByRole("dialog", { name: /changed by another application/ }),
    );
    // Nothing was written: the file keeps its bytes, and the window its changes.
    expect(server.starts).toHaveLength(0);
    expect(server.bytes.get(id)).toBe(rtf("Maybe newer"));
    await user.click(ask.getByRole("button", { name: "Save Anyway" }));
    await waitFor(() => expect(server.bytes.get(id)).toContain("Unwritten words"));
    expect(server.starts).toHaveLength(1);
    expect(server.starts[0]).not.toHaveProperty("base");
    await waitFor(() =>
      expect(server.drafts.at(-1)?.file).toEqual({ id, name: "D.rtf", version: 1 }),
    );
  });

  it("asks whether to save over a file changed elsewhere before New replaces the document", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    server.saveElsewhere("f-a", rtf("Theirs"));
    write("<div>Alpha, mine</div>");
    // New writes the change first; the file has moved on, so the window asks about that.
    key("n");
    const ask = within(
      await screen.findByRole("dialog", { name: /changed by another application/ }),
    );
    expect(screen.queryByRole("dialog", { name: /save the changes/ })).toBeNull();
    expect(server.bytes.get("f-a")).toBe(rtf("Theirs"));
    // Cancel: no new document, the changes stay in the window.
    await user.click(ask.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /changed by another application/ })).toBeNull(),
    );
    expect(editor().textContent).toBe("Alpha, mine");
    expect(screen.getByRole("region", { name: "A — Edited" })).toBeInTheDocument();
    // Save Anyway from the next New's sheet writes the change; New then needs no answer.
    key("n");
    const again = within(
      await screen.findByRole("dialog", { name: /changed by another application/ }),
    );
    await user.click(again.getByRole("button", { name: "Save Anyway" }));
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Alpha, mine"));
    key("n");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Untitled" })).toBeInTheDocument(),
    );
    await waitFor(() => expect(server.drafts.at(-1)?.name).toBe("Untitled"));
  });

  it("keeps the version its own save made when that save's reply was lost and sent again", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    // The save goes in as version 1, its reply is lost, and another window saves version 2
    // before the browser sends the completion again.
    server.loseNextCompletionReply(() => server.saveElsewhere("f-a", rtf("Theirs")));
    write("<div>Alpha, mine</div>");
    key("s");
    await waitFor(() => expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument(), {
      timeout: 4000,
    });
    expect(server.bytes.get("f-a")).toBe(rtf("Theirs"));
    // The window holds version 1, the one its save made, so its next save never writes over
    // version 2 unasked.
    write("<div>Alpha, mine again</div>");
    key("s");
    const ask = within(
      await screen.findByRole("dialog", { name: /changed by another application/ }),
    );
    expect(server.bytes.get("f-a")).toBe(rtf("Theirs"));
    expect(server.starts.at(-1)?.base).toBe(1);
    await user.click(ask.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(server.drafts.at(-1)?.lines).toEqual(["Alpha, mine again"]));
  });

  it("makes the next save from the version an autosave under way made when Revert took the window", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    const actions = { current: null as TextEditActions | null };
    render(
      <TextEdit
        actionsRef={(value) => {
          actions.current = value;
        }}
      />,
    );
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    write("<div>Saved text</div>");
    await act(async () => actions.current?.file?.save());
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Saved text"));
    await ready();
    const release = server.hold(completing);
    write("<div>Autosaved over</div>");
    await waitFor(() => expect(server.starts).toHaveLength(2), { timeout: 4000 });
    act(() => actions.current?.file?.revert());
    const sheet = within(await screen.findByRole("dialog", { name: /go back to the version/ }));
    await user.click(sheet.getByRole("button", { name: "Revert" }));
    await waitFor(() => expect(editor().textContent).toBe("Saved text"));
    release();
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Autosaved over"));
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Saved text"), {
      timeout: 4000,
    });
    expect(server.starts.map((each) => each.base)).toEqual([0, 1, 2]);
    expect(screen.queryByRole("dialog", { name: /changed by another application/ })).toBeNull();
  }, 15_000);

  it("takes the drive's version when a restored draft's text is already there, sending no write", async () => {
    const id = "4a5b6c7d8e9f00a1b2c3d4e5f6a7b8c9";
    // The bytes this document's own save makes of its text.
    const earlier = createServer();
    earlier.put(id, "E.rtf", rtf("Older"));
    const first = render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id, name: "E.rtf" }));
    await openFile(id, "E.rtf", "Older");
    write("<div>Written words</div>");
    key("s");
    await waitFor(() => expect(earlier.bytes.get(id)).toContain("Written words"));
    const written = earlier.bytes.get(id) as string;
    first.unmount();
    const server = createServer({
      draft: {
        name: "E.rtf",
        format: "rich",
        lines: ["Written words"],
        html: "<div>Written words</div>",
        edited: true,
        unwritten: true,
        file: { id, name: "E.rtf", version: 0 },
      },
      rev: 1,
    });
    server.put(id, "E.rtf", rtf("Older"));
    // As when this window's autosave went in and the page reloaded before its reply came.
    server.saveElsewhere(id, written);
    render(<TextEdit />);
    await ready();
    await waitFor(() =>
      expect(server.drafts.at(-1)?.file).toEqual({ id, name: "E.rtf", version: 1 }),
    );
    expect(server.drafts.at(-1)?.unwritten).toBe(false);
    expect(server.starts).toHaveLength(0);
    expect(screen.queryByRole("dialog", { name: /changed by another application/ })).toBeNull();
    write("<div>Written words, and more</div>");
    await waitFor(() => expect(server.bytes.get(id)).toContain("and more"), { timeout: 4000 });
    expect(server.starts.map((each) => each.base)).toEqual([1]);
    await waitFor(() => expect(server.drafts.at(-1)?.lines).toEqual(["Written words, and more"]));
  }, 15_000);

  it("asks, sending no write, when a restored draft's file holds another text at a newer version", async () => {
    const user = userEvent.setup();
    const id = "5a6b7c8d9e0f10a1b2c3d4e5f6a7b8c9";
    const server = createServer({
      draft: {
        name: "F.rtf",
        format: "rich",
        lines: ["Unwritten words"],
        html: "<div>Unwritten words</div>",
        edited: true,
        unwritten: true,
        file: { id, name: "F.rtf", version: 0 },
      },
      rev: 1,
    });
    server.put(id, "F.rtf", rtf("Older"));
    server.saveElsewhere(id, rtf("Theirs"));
    render(<TextEdit />);
    await ready();
    const ask = within(
      await screen.findByRole("dialog", { name: /changed by another application/ }),
    );
    expect(server.starts).toHaveLength(0);
    expect(server.bytes.get(id)).toBe(rtf("Theirs"));
    expect(editor().textContent).toBe("Unwritten words");
    await user.click(ask.getByRole("button", { name: "Save Anyway" }));
    await waitFor(() => expect(server.bytes.get(id)).toContain("Unwritten words"));
    expect(server.starts[0]).not.toHaveProperty("base");
  });

  it("with Ask to keep changes on, lets Don't Save drop the changes after a Save that failed", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    changeDesktopValue(ASK_TO_KEEP_KEY, true);
    try {
      render(<TextEdit />);
      await ready();
      act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
      await openFile("f-a", "A.rtf", "Alpha");
      write("<div>Alpha, changed</div>");
      key("n");
      const asked = await screen.findByRole("dialog", { name: /save the changes/ });
      // Nothing is written until the person says.
      expect(server.bytes.get("f-a")).not.toContain("changed");
      server.refuse(completing);
      await user.click(within(asked).getByRole("button", { name: "Save" }));
      const failed = within(await screen.findByRole("dialog", { name: /save the changes/ }));
      expect(await failed.findByText(/could not be saved to its file/)).toBeInTheDocument();
      await user.click(failed.getByRole("button", { name: "Don’t Save" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(server.bytes.get("f-a")).not.toContain("changed");
      await waitFor(() =>
        expect(JSON.stringify(server.drafts.at(-1))).not.toContain("Alpha, changed"),
      );
    } finally {
      changeDesktopValue(ASK_TO_KEEP_KEY, false);
    }
  });

  it("keeps a document whose file cannot be written, and asks before letting it go", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    server.refuse(completing);
    write("<div>Alpha, changed</div>");
    // New before autosave: the change is written first, and the write is refused.
    key("n");
    const ask = within(await screen.findByRole("dialog", { name: /save the changes/ }));
    expect(ask.getByText(/could not be saved to its file/)).toBeInTheDocument();
    expect(editor().textContent).toBe("Alpha, changed");
    await user.click(ask.getByRole("button", { name: "Cancel" }));
    expect(editor().textContent).toBe("Alpha, changed");
    // Asked again, the person lets it go.
    key("n");
    const again = within(await screen.findByRole("dialog", { name: /save the changes/ }));
    await user.click(again.getByRole("button", { name: "Don’t Save" }));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Untitled" })).toBeInTheDocument(),
    );
  });

  it("asks before an untitled document changed only by spaces is replaced", async () => {
    const server = createServer();
    server.put("f-b", "B.txt", "Bravo");
    render(<TextEdit defaultDocument={{ name: "Untitled", format: "rich", lines: [""] }} />);
    await ready();
    write("<div>   </div>");
    act(() => requestOpenFile({ app: "textedit", id: "f-b", name: "B.txt" }));
    expect(await screen.findByRole("dialog", { name: /save the changes/ })).toBeInTheDocument();
  });

  it("opens the next file asked for only once a Save chosen to keep the document has finished", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-q1", "Q1.rtf", rtf("First"));
    server.put("f-q2", "Q2.rtf", rtf("Second"));
    render(<TextEdit defaultDocument={{ name: "Untitled", format: "rich", lines: [""] }} />);
    await ready();
    write("<div>Kept words</div>");
    act(() => requestOpenFile({ app: "textedit", id: "f-q1", name: "Q1.rtf" }));
    const ask = within(await screen.findByRole("dialog", { name: /save the changes/ }));
    await user.click(ask.getByRole("button", { name: "Save…" }));
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    // Asked for while the Save sheet is open: it waits, and asks nothing over the sheet.
    act(() => requestOpenFile({ app: "textedit", id: "f-q2", name: "Q2.rtf" }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog", { name: /save the changes/ })).toBeNull();
    expect(editor().textContent).toBe("Kept words");
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Kept");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(
      () => expect(server.entries.some((each) => each.name === "Kept.rtf")).toBe(true),
      { timeout: 4000 },
    );
    // Then the first file opens, and the second after it.
    await openFile("f-q2", "Q2.rtf", "Second");
    const kept = server.entries.find((each) => each.name === "Kept.rtf") as DriveEntry;
    expect(server.bytes.get(kept.id)).toContain("Kept words");
  });

  it("locks the document while File > Save writes its file", async () => {
    const server = createServer();
    server.put("f-lock", "Lock.rtf", rtf("Locked"));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-lock", name: "Lock.rtf" }));
    await openFile("f-lock", "Lock.rtf", "Locked");
    write("<div>Locked, saved</div>");
    const release = server.hold(completing);
    key("s");
    // Being written: nothing can be typed, and New does nothing.
    await waitFor(() => expect(body()).toHaveAttribute("inert"));
    key("n");
    expect(screen.queryByRole("dialog", { name: /save the changes/ })).toBeNull();
    release();
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    expect(server.bytes.get("f-lock")).toContain("Locked, saved");
  });

  it("opens the next file asked for only after an open retried for changes typed during its read", async () => {
    const server = createServer();
    server.put("f-r0", "R0.rtf", rtf("Zero"));
    server.put("f-r1", "R1.rtf", rtf("One"));
    server.put("f-r2", "R2.rtf", rtf("Two"));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-r0", name: "R0.rtf" }));
    await openFile("f-r0", "R0.rtf", "Zero");
    const releaseRead = server.hold((_method, path) => path === "/api/files/content/f-r1");
    act(() => requestOpenFile({ app: "textedit", id: "f-r1", name: "R1.rtf" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Typed while R1 is read: the open writes it into R0 first, and that write is slow.
    write("<div>Zero, typed</div>");
    const releaseWrite = server.hold(completing);
    act(() => requestOpenFile({ app: "textedit", id: "f-r2", name: "R2.rtf" }));
    releaseRead();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const fetched = () =>
      vi
        .mocked(globalThis.fetch)
        .mock.calls.some(([input]) => String(input).includes("/api/files/content/f-r2"));
    // R2 waits for R1's retry, still writing R0's change.
    expect(fetched()).toBe(false);
    releaseWrite();
    await openFile("f-r2", "R2.rtf", "Two");
    expect(server.bytes.get("f-r0")).toContain("Zero, typed");
  });

  it("opens every file asked for in turn, the one asked for last shown at the end", async () => {
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    server.put("f-c", "C.rtf", rtf("Charlie"));
    render(<TextEdit />);
    await ready();
    const release = server.hold((_method, path) => path === "/api/files/content/f-a");
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    act(() => requestOpenFile({ app: "textedit", id: "f-c", name: "C.rtf" }));
    // The second waits for the first.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(editor().textContent).not.toBe("Charlie");
    release();
    await openFile("f-c", "C.rtf", "Charlie");
    expect(screen.getByRole("region", { name: "C" })).toBeInTheDocument();
  });

  it("does nothing for Duplicate during a Save, and duplicates the saved document after it as an edited copy", async () => {
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    const actions = { current: null } as { current: TextEditActions | null };
    render(<TextEdit actionsRef={actions} />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await openFile("f-a", "A.rtf", "Alpha");
    write("<div>Alpha two</div>");
    const release = server.hold(completing);
    key("s");
    await waitFor(() => expect(server.starts.length).toBeGreaterThan(0));
    // The Save locks the document: Duplicate does nothing meanwhile.
    act(() => actions.current?.file?.duplicate());
    expect(screen.getByRole("region", { name: "A — Edited" })).toBeInTheDocument();
    release();
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Alpha two"));
    await waitFor(() => expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument());
    await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
    // Saved: the copy takes the window, edited.
    act(() => actions.current?.file?.duplicate());
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "A copy — Edited" })).toBeInTheDocument(),
    );
    expect(editor().textContent).toBe("Alpha two");
  });

  it("removes the print frame once printing has ended, not when print() returns", async () => {
    vi.useFakeTimers();
    try {
      printDocument({ name: "Memo", lines: ["Memo"], plain: true });
      const frame = document.querySelector("iframe[data-textedit-print]") as HTMLIFrameElement;
      const view = frame.contentWindow as Window;
      const print = vi.fn();
      Object.assign(view, { print, focus: () => {} });
      frame.dispatchEvent(new Event("load"));
      // print() waits for the frame's fonts to settle.
      await vi.advanceTimersByTimeAsync(0);
      expect(print).toHaveBeenCalledTimes(1);
      // A browser that returns from print() with its dialog still open keeps the frame.
      vi.advanceTimersByTime(5000);
      expect(frame.isConnected).toBe(true);
      view.dispatchEvent(new Event("afterprint"));
      expect(frame.isConnected).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
