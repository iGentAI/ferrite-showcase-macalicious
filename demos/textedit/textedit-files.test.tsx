import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DriveEntry } from "../desktop/desktop-files";
import { reloadServerDocuments } from "../desktop/desktop-server";
import { requestOpenFile } from "../finder/finder-open";
import { TextEdit } from "./textedit";
import { openDriveDocument, UnsupportedEncodingError } from "./textedit-files";
import { paragraphsOfLines, readRtf, writeRtf } from "./textedit-rtf";

/*
 * TextEdit served by the desktop's Ferrite application, against a stand-in for its routes: the
 * drive (`/api/files/`, whose rules are tested in Rust in `src/apps/files`) and TextEdit's draft
 * (`/api/textedit/`). The stand-in keeps entries and bytes in memory and answers the same shapes.
 * What the real server and Ferrite storage keep is proved by the Rust tests and
 * e2e/textedit-files-journey.mjs in Chromium, Firefox and WebKit.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function createServer(draft: unknown = { draft: null, rev: 0 }) {
  const session = `s-${Math.random()}`;
  let rev = 1;
  let next = 0;
  const entries: DriveEntry[] = [
    "Desktop",
    "Documents",
    "Downloads",
    "Movies",
    "Music",
    "Pictures",
  ].map((name) => ({
    id: name.toLowerCase(),
    name,
    kind: "folder",
    size: 0,
    created_ms: 1,
    modified_ms: 1,
  }));
  const bytes = new Map<string, string>();
  /** Files whose bytes are not UTF-8 text, served as they are. */
  const raw = new Map<string, Uint8Array>();
  const uploads = new Map<string, { body: Record<string, unknown>; text: string }>();
  const starts: Record<string, unknown>[] = [];
  const drafts: Record<string, unknown>[] = [];
  let stored = draft;
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
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://desktop.test");
    const method = init.method ?? "GET";
    const path = url.pathname;
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
    if (path === "/api/files/ops" && method === "POST") {
      const { ops } = JSON.parse(String(init.body));
      for (const op of ops) {
        const entry = entries.find((each) => each.id === op.id);
        if (op.op === "rename" && entry) entry.name = op.name;
        if (op.op === "opened" && entry) entry.opened_ms = 9;
      }
      rev += 1;
      return json(drive([]));
    }
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
      const upload = uploads.get(complete[1] ?? "");
      if (!upload) return json({ error: "no such upload" }, 404);
      const { body, text } = upload;
      let id: string;
      if (body.existing === "overwrite") {
        id = String(body.replaces);
        const entry = entries.find((each) => each.id === id);
        if (!entry) return json({ error: "gone" }, 409);
        entry.size = text.length;
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
      return json(drive([id]));
    }
    const content = /^\/api\/files\/content\/([^/]+)$/.exec(path);
    if (content) {
      const id = decodeURIComponent(content[1] ?? "");
      const exact = raw.get(id);
      if (exact) return new Response(exact as Uint8Array<ArrayBuffer>);
      const text = bytes.get(id) ?? "";
      return new Response(new TextEncoder().encode(text));
    }
    if (path.startsWith("/api/files/uploads/") && method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return json({ error: `no route ${method} ${path}` }, 404);
  });
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal("fetch", fetch);
  /** Puts a file on the drive, as Finder's upload would. */
  const put = (id: string, name: string, text: string, parent = "documents") => {
    entries.push({
      id,
      parent,
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
  /** Puts a file of exactly these bytes on the drive. */
  const putBytes = (id: string, name: string, data: Uint8Array, parent = "documents") => {
    entries.push({
      id,
      parent,
      name,
      kind: "file",
      size: data.length,
      type: name.endsWith(".rtf") ? "text/rtf" : "text/plain",
      created_ms: 3,
      modified_ms: 3,
    });
    raw.set(id, data);
    rev += 1;
  };
  return { fetch, entries, bytes, starts, drafts, put, putBytes };
}

const editor = () => screen.getByRole("textbox", { name: "Document" });
const body = () => document.querySelector(".mac-textedit-body") as HTMLElement;
const key = (letter: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(editor(), { key: letter, ctrlKey: true, ...extra });

/** Replace the document's paragraphs with HTML, as typing and the format bar would. */
function write(html: string) {
  const node = editor();
  node.innerHTML = html;
  fireEvent.input(node);
}

async function ready() {
  await waitFor(() => expect(body()).not.toHaveAttribute("inert"));
}

/** Chooses `option` from the Save sheet's File Format button. */
async function chooseFormat(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole("combobox", { name: "File Format:" }));
  await user.click(await screen.findByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

describe("the Save sheet's File Format", () => {
  it("goes on to the file asked for once a Save… in the other format has saved the document", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-next", "Next.txt", "Next file");
    render(<TextEdit />);
    await ready();
    write("<div>Kept as text</div>");
    act(() => requestOpenFile({ app: "textedit", id: "f-next", name: "Next.txt" }));
    const ask = within(await screen.findByRole("dialog", { name: /save the changes/ }));
    await user.click(ask.getByRole("button", { name: "Save…" }));
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    await chooseFormat(user, "Plain Text");
    // A name of its own: the page's copy of the drive outlives the test.
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Kept note.txt");
    await user.click(save.getByRole("button", { name: "Save" }));
    // Saved as text, and then the file asked for opens.
    await waitFor(() => expect(editor()).toHaveValue("Next file"), { timeout: 4000 });
    const saved = server.entries.find((each) => each.name === "Kept note.txt") as DriveEntry;
    expect(server.bytes.get(saved.id)).toBe("Kept as text");
  });

  it("switches .rtf to .txt with Plain Text, and the file opens again as plain text", async () => {
    const user = userEvent.setup();
    const server = createServer();
    const onSave = vi.fn();
    render(<TextEdit onSave={onSave} />);
    await ready();
    write("<div>Plain words</div>");
    key("s");
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    const field = save.getByRole("textbox", { name: "Save As:" });
    expect(field).toHaveValue("512 Pixels.rtf");
    await chooseFormat(user, "Plain Text");
    expect(field).toHaveValue("512 Pixels.txt");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(server.entries.some((each) => each.name === "512 Pixels.txt")).toBe(true),
    );
    expect(server.entries.some((each) => each.name.endsWith(".rtf"))).toBe(false);
    const saved = server.entries.find((each) => each.name === "512 Pixels.txt") as DriveEntry;
    expect(server.bytes.get(saved.id)).toBe("Plain words");
    const { document: opened } = await openDriveDocument(saved, document);
    expect(opened).toMatchObject({ format: "plain", lines: ["Plain words"] });
    // The host hears of the save: the document as saved and the drive folder it went into.
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "512 Pixels.txt", format: "plain", lines: ["Plain words"] }),
      saved.parent,
      [],
    );
    await waitFor(() => expect(server.drafts.at(-1)).toMatchObject({ format: "plain" }));
  });

  it("switches .txt to .rtf with Rich Text Document, and the file opens again as rich text", async () => {
    const user = userEvent.setup();
    const server = createServer();
    render(
      <TextEdit defaultDocument={{ name: "Untitled", format: "plain", lines: ["Line one"] }} />,
    );
    await ready();
    key("s");
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    const field = save.getByRole("textbox", { name: "Save As:" });
    expect(field).toHaveValue("Untitled.txt");
    await chooseFormat(user, "Rich Text Document");
    expect(field).toHaveValue("Untitled.rtf");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(server.entries.some((each) => each.name === "Untitled.rtf")).toBe(true),
    );
    expect(server.entries.some((each) => each.name.endsWith(".txt"))).toBe(false);
    const saved = server.entries.find((each) => each.name === "Untitled.rtf") as DriveEntry;
    expect(server.bytes.get(saved.id)).toMatch(/^\{\\rtf1/);
    const { document: opened } = await openDriveDocument(saved, document);
    expect(opened).toMatchObject({ format: "rich", lines: ["Line one"] });
    await waitFor(() => expect(server.drafts.at(-1)).toMatchObject({ format: "rich" }));
  });

  it("never writes plain text under an .rtf name typed after choosing Plain Text", async () => {
    const user = userEvent.setup();
    const server = createServer();
    render(<TextEdit />);
    await ready();
    write("<div>Typed name</div>");
    key("s");
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    await chooseFormat(user, "Plain Text");
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Notes.rtf");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(server.entries.some((each) => each.name === "Notes.txt")).toBe(true),
    );
    expect(server.entries.some((each) => each.name.endsWith(".rtf"))).toBe(false);
    const saved = server.entries.find((each) => each.name === "Notes.txt") as DriveEntry;
    const { document: opened } = await openDriveDocument(saved, document);
    expect(opened).toMatchObject({ format: "plain", lines: ["Typed name"] });
    await waitFor(() => expect(server.drafts.at(-1)).toMatchObject({ format: "plain" }));
  });
});

describe("TextEdit's documents on the person's drive", () => {
  it("opens RTF in Windows-1252 and UTF-8 text, and refuses text in any other encoding", async () => {
    const server = createServer();
    const own = writeRtf(paragraphsOfLines(["café €"]));
    server.putBytes("f-own", "Cafe.rtf", new TextEncoder().encode(own));
    // A text file with a byte order mark.
    server.putBytes(
      "f-text",
      "Text.txt",
      Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("über\nzwei")]),
    );
    // RTF in plain ANSI with a literal Windows-1252 byte opens; a text file that is not UTF-8
    // does not.
    const latin = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));
    server.putBytes("f-ansi", "Ansi.rtf", latin("{\\rtf1\\ansi\\ansicpg1252 caf\xe9\\par}"));
    server.putBytes("f-latin", "Latin.txt", latin("caf\xe9"));
    const lines = async (id: string, name: string) =>
      (await openDriveDocument({ id, name }, document)).document.lines;
    expect(await lines("f-own", "Cafe.rtf")).toEqual(["café €"]);
    expect(await lines("f-text", "Text.txt")).toEqual(["über", "zwei"]);
    expect(await lines("f-ansi", "Ansi.rtf")).toEqual(["café"]);
    await expect(openDriveDocument({ id: "f-latin", name: "Latin.txt" }, document)).rejects.toThrow(
      UnsupportedEncodingError,
    );
    // The text kept as the file's first version is the file's own text.
    const opened = await openDriveDocument({ id: "f-own", name: "Cafe.rtf" }, document);
    expect(opened.text).toBe(own);
  });

  it("refuses an RTF file in another encoding with an alert, and keeps the document it has", async () => {
    const server = createServer();
    // A code page no browser decodes.
    const bytes = Uint8Array.from([
      ...new TextEncoder().encode("{\\rtf1\\ansi\\ansicpg99999\\deff0 "),
      ...[0x83, 0x5c, 0x83, 0x7b, 0x83, 0x7d],
      ...new TextEncoder().encode(" after\\par\nNext\\par}"),
    ]);
    server.putBytes("f-kana", "Kana.rtf", bytes);
    render(<TextEdit defaultDocument={{ name: "Untitled", format: "rich", lines: ["Mine"] }} />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-kana", name: "Kana.rtf" }));
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("The document “Kana.rtf” could not be opened.");
    expect(alert).toHaveTextContent(
      "This document uses a text encoding TextEdit on Ferrite can’t open yet.",
    );
    // The alert is modal: the window behind it keeps its document.
    expect(screen.getByRole("textbox", { name: "Document", hidden: true }).textContent).toBe(
      "Mine",
    );
    // Nothing was written into the file: it keeps exactly the bytes it had.
    expect(server.bytes.has("f-kana")).toBe(false);
  });

  it("reads its own non-ASCII text back from the file's bytes unchanged", async () => {
    const server = createServer();
    const text = ["café € üß Привет こんにちは 😀", "“quoted” — done"];
    const rtf = writeRtf(paragraphsOfLines(text));
    // The writer's files are ASCII: no byte depends on a code page.
    expect(rtf).not.toMatch(/[^\n\x20-\x7e]/);
    server.putBytes("f-own", "Own.rtf", new TextEncoder().encode(rtf));
    const { document: opened } = await openDriveDocument(
      { id: "f-own", name: "Own.rtf" },
      document,
    );
    expect(opened).toMatchObject({ format: "rich", lines: text });
  });
  it("saves a styled document as an .rtf file in Documents and opens it again with its formats", async () => {
    const user = userEvent.setup();
    const server = createServer();
    render(<TextEdit />);
    await ready();
    write(
      '<div><span style="font-weight: bold;">Dear</span> Ada,</div><div style="text-align: center;">Yours</div>',
    );
    key("s");
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    const field = save.getByRole("textbox", { name: "Save As:" });
    expect(field).toHaveValue("512 Pixels.rtf");
    await user.clear(field);
    await user.type(field, "Letter");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(server.entries.some((each) => each.name === "Letter.rtf")).toBe(true),
    );
    const saved = server.entries.find((each) => each.name === "Letter.rtf") as DriveEntry;
    expect(saved.parent).toBe("documents");
    const rtf = server.bytes.get(saved.id) ?? "";
    const { paragraphs } = readRtf(rtf);
    expect(paragraphs.map((p) => p.runs.map((run) => [run.text, run.style.bold]))).toEqual([
      [
        ["Dear", true],
        [" Ada,", false],
      ],
      [["Yours", false]],
    ]);
    expect(paragraphs[1]?.align).toBe("center");
    // Saved: the title is the file's, not edited.
    await waitFor(() => expect(screen.getByRole("region", { name: "Letter" })).toBeInTheDocument());

    // A new document, then the file opened from the Open dialog: its formats are back.
    key("n");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Untitled" })).toBeInTheDocument(),
    );
    key("o");
    const open = within(await screen.findByRole("dialog", { name: "Open" }));
    await user.dblClick(await open.findByRole("option", { name: "Letter.rtf" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Letter" })).toBeInTheDocument());
    const paragraphsShown = [...editor().children] as HTMLElement[];
    expect(paragraphsShown.map((p) => p.textContent)).toEqual(["Dear Ada,", "Yours"]);
    const firstSpan = paragraphsShown[0]?.querySelector("span");
    expect(firstSpan?.style.fontWeight).toBe("bold");
    expect(paragraphsShown[1]?.style.textAlign).toBe("center");
  });

  it("saves a document that has a file into that same file, after each change and on Save", async () => {
    const server = createServer();
    server.put("f-letter", "Letter.rtf", writeRtf(paragraphsOfLines(["Dear Ada,"])));
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-letter", name: "Letter.rtf" }));
    await waitFor(() => expect(editor().textContent).toBe("Dear Ada,"));

    write("<div>Dear Grace,</div>");
    // Autosave: the same file, overwritten.
    await waitFor(
      () =>
        expect(server.starts.at(-1)).toMatchObject({
          existing: "overwrite",
          replaces: "f-letter",
          name: "Letter.rtf",
          parent: "documents",
        }),
      { timeout: 4000 },
    );
    await waitFor(() =>
      expect(readRtf(server.bytes.get("f-letter") ?? "").paragraphs[0]?.runs[0]?.text).toBe(
        "Dear Grace,",
      ),
    );
    expect(server.entries.filter((each) => each.kind === "file")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Letter — Edited" })).toBeInTheDocument();

    // Save: written again, no longer edited.
    write("<div>Dear Grace, again</div>");
    key("s");
    await waitFor(() =>
      expect(readRtf(server.bytes.get("f-letter") ?? "").paragraphs[0]?.runs[0]?.text).toBe(
        "Dear Grace, again",
      ),
    );
    await waitFor(() => expect(screen.getByRole("region", { name: "Letter" })).toBeInTheDocument());
    // The draft names the file, so a reload opens the document bound to it.
    await waitFor(() =>
      expect(server.drafts.at(-1)).toMatchObject({ file: { id: "f-letter", name: "Letter.rtf" } }),
    );
  });

  it("opens plain text as plain text and saves it back as text", async () => {
    const server = createServer();
    server.put("f-list", "List.txt", "Milk\nBread");
    render(<TextEdit />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-list", name: "List.txt" }));
    await waitFor(() => expect(editor()).toHaveValue("Milk\nBread"));
    expect(screen.getByRole("region", { name: "List.txt" })).toBeInTheDocument();
    fireEvent.change(editor(), { target: { value: "Milk\nBread\nApples" } });
    key("s");
    await waitFor(() => expect(server.bytes.get("f-list")).toBe("Milk\nBread\nApples"));
    // The page's draft channel outlives the window: let its last save land before the next test.
    await waitFor(() =>
      expect(server.drafts.at(-1)).toMatchObject({ lines: ["Milk", "Bread", "Apples"] }),
    );
  });

  it("asks before an untitled document with changes is replaced", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-a", "A.txt", "A");
    render(<TextEdit defaultDocument={{ name: "Untitled", format: "rich", lines: [""] }} />);
    await ready();
    write("<div>Unsaved thoughts</div>");
    await waitFor(() => expect(screen.getByRole("region", { name: /Edited/ })).toBeInTheDocument());
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.txt" }));
    const ask = within(await screen.findByRole("dialog", { name: /save the changes/ }));
    await user.click(ask.getByRole("button", { name: "Cancel" }));
    expect(editor().textContent).toBe("Unsaved thoughts");
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.txt" }));
    const again = within(await screen.findByRole("dialog", { name: /save the changes/ }));
    await user.click(again.getByRole("button", { name: "Don’t Save" }));
    await waitFor(() => expect(editor()).toHaveValue("A"));
  });

  it("renames the file", async () => {
    const user = userEvent.setup();
    const server = createServer();
    server.put("f-memo", "Memo.rtf", writeRtf(paragraphsOfLines(["First"])));
    const actions = { current: null } as { current: import("./textedit").TextEditActions | null };
    render(<TextEdit actionsRef={actions} />);
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-memo", name: "Memo.rtf" }));
    await waitFor(() => expect(editor().textContent).toBe("First"));

    act(() => actions.current?.file?.rename());
    const rename = within(await screen.findByRole("dialog", { name: /Rename/ }));
    const field = rename.getByRole("textbox", { name: "Name:" });
    await user.clear(field);
    await user.type(field, "Minutes");
    await user.click(rename.getByRole("button", { name: "Rename" }));
    await waitFor(() =>
      expect(server.entries.find((each) => each.id === "f-memo")?.name).toBe("Minutes.rtf"),
    );
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Minutes" })).toBeInTheDocument(),
    );
  });
});

describe("a file Finder asks to open while the draft is read again", () => {
  it("opens the file, and saves it as the draft, when a read that finds no draft lands during the open", async () => {
    const server = createServer();
    render(<TextEdit />);
    await ready();
    server.put("f-race", "Race.txt", "Opened from Finder");
    // The file's bytes are held back until the draft has been read again and found missing, as
    // when the person forgot the draft just before opening the file (a live update reads it again).
    const plain = server.fetch.getMockImplementation();
    if (!plain) throw new Error("no server");
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let asked = false;
    server.fetch.mockImplementation(async (input, init) => {
      if (String(input).includes("/api/files/content/f-race")) {
        asked = true;
        await held;
      }
      return plain(input, init);
    });
    const draftReads = () =>
      server.fetch.mock.calls.filter(
        ([input, init]) => String(input).includes("/api/textedit/draft") && !init?.method,
      ).length;

    act(() => requestOpenFile({ app: "textedit", id: "f-race", name: "Race.txt" }));
    await waitFor(() => expect(asked).toBe(true));
    const before = draftReads();
    act(() => reloadServerDocuments("textedit"));
    await waitFor(() => expect(draftReads()).toBe(before + 1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    release();

    // The person's open wins over the read that found no draft: the file is shown, not the
    // starting document, and it is saved as the draft again.
    await waitFor(() => expect(editor()).toHaveTextContent("Opened from Finder"));
    expect(editor()).not.toHaveTextContent("Here's to the crazy ones");
    await waitFor(() =>
      expect(server.drafts.at(-1)).toMatchObject({ file: { id: "f-race", name: "Race.txt" } }),
    );
  });
});
