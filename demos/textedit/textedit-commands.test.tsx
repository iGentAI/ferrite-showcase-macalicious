import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { useWindowManager, WindowManager } from "macalicious/window-manager";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { type DesktopDragItem, landingAt, registerDropTarget } from "../desktop/desktop-drag";
import { type DesktopEffect, onDesktopEffects } from "../desktop/desktop-effects";
import { type DriveEntry, type DriveOp, loadDrive } from "../desktop/desktop-files";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { registerFileReceivers, takeSharedFiles } from "../desktop/desktop-share-link";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { requestOpenFile, takeOpenFileRequests } from "../finder/finder-open";
import { TextEdit, type TextEditActions } from "./textedit";
import { stepRuler } from "./textedit-document";
import { paragraphsOfLines, writeRtf } from "./textedit-rtf";
import { keepWindow, readKeptWindow, type TextEditOpening } from "./textedit-windows";

/*
 * TextEdit's File > Move To, Revert To, Share and Page Setup, Format > Text > Spacing, Format > Font >
 * Styles, the title's popover, and Edit > Complete, served by a stand-in for the drive: entries and
 * bytes in memory, the operations applied and recorded.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  delete (document as Partial<Document>).execCommand;
  for (const frame of document.querySelectorAll("iframe")) frame.remove();
});

const rtf = (line: string) => writeRtf(paragraphsOfLines([line]));

function createServer() {
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
  const ops: DriveOp[] = [];
  const starts: Record<string, unknown>[] = [];
  const uploads = new Map<string, { body: Record<string, unknown>; text: string }>();
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
    if (path === "/api/textedit/draft") {
      return json(method === "PUT" ? { rev: 1 } : { draft: null, rev: 0 });
    }
    if (path === "/api/files/" && method === "GET") return json(drive());
    if (path === "/api/files/ops" && method === "POST") {
      for (const op of JSON.parse(String(init.body)).ops as DriveOp[]) {
        ops.push(op);
        const entry = "id" in op ? entries.find((each) => each.id === op.id) : undefined;
        if (entry && op.op === "move") entry.parent = op.parent;
        if (entry && op.op === "tag") entry.tags = op.tags;
        if (entry && op.op === "rename") entry.name = op.name;
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
      let id = String(body.replaces ?? "");
      const entry = entries.find((each) => each.id === id);
      if (entry) entry.version = (entry.version ?? 0) + 1;
      else {
        next += 1;
        id = `f${next}`;
        entries.push({
          id,
          parent: String(body.parent),
          name: String(body.name),
          kind: "file",
          size: text.length,
          type: String(body.type),
          created_ms: 2,
          modified_ms: 2,
        });
      }
      bytes.set(id, text);
      rev += 1;
      return json({
        ...drive([id]),
        version: entries.find((each) => each.id === id)?.version ?? 0,
      });
    }
    const content = /^\/api\/files\/content\/([^/]+)$/.exec(path);
    if (content) return new Response(new TextEncoder().encode(bytes.get(content[1] ?? "") ?? ""));
    return json({ error: `no route ${method} ${path}` }, 404);
  };
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) =>
      answer(init.method ?? "GET", new URL(String(input), "http://desktop.test"), init),
    ),
  );
  const put = (id: string, name: string, text: string) => {
    entries.push({
      id,
      parent: "documents",
      name,
      kind: "file",
      size: text.length,
      type: "text/rtf",
      created_ms: 3,
      modified_ms: 3,
    });
    bytes.set(id, text);
    rev += 1;
  };
  return { entries, bytes, ops, starts, put };
}

const editor = () => screen.getByRole("textbox", { name: "Document" });
const body = () => document.querySelector(".mac-textedit-body") as HTMLElement;
const ready = () => waitFor(() => expect(body()).not.toHaveAttribute("inert"));

function write(html: string) {
  const node = editor();
  node.innerHTML = html;
  fireEvent.input(node);
}

/** Opens the drive file `A.rtf`, holding "Alpha", in a window. */
async function openAlpha() {
  const server = createServer();
  server.put("f-a", "A.rtf", rtf("Alpha"));
  const actions = { current: null as TextEditActions | null };
  render(
    <>
      <TextEdit
        actionsRef={(value) => {
          actions.current = value;
        }}
      />
      <DesktopMenu title="File" />
    </>,
  );
  await ready();
  act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
  await waitFor(() => expect(editor().textContent).toBe("Alpha"));
  await ready();
  return { server, actions };
}

function DesktopMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("textedit", title);
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title={title}>{items}</MenuBarMenu>
    </MenuBar>
  );
}

/** Selects the text of the document's first paragraph. */
function selectFirstParagraph() {
  const first = editor().firstElementChild as HTMLElement;
  const range = document.createRange();
  range.selectNodeContents(first);
  editor().focus();
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  fireEvent(document, new Event("selectionchange"));
}

describe("File > Move To…", () => {
  it("moves the document's file to the folder chosen, and keeps it the document's file", async () => {
    const user = userEvent.setup();
    const { server, actions } = await openAlpha();
    act(() => actions.current?.file?.moveTo());
    const sheet = within(await screen.findByRole("dialog", { name: "Move the document" }));
    expect(sheet.getByRole("button", { name: "Move" })).toBeDisabled();
    await user.click(sheet.getByRole("combobox", { name: "Where:" }));
    await user.click(await screen.findByRole("option", { name: "Desktop" }));
    await user.click(sheet.getByRole("button", { name: "Move" }));
    await waitFor(() =>
      expect(server.ops).toContainEqual({ op: "move", id: "f-a", parent: "desktop" }),
    );
    expect(screen.queryByRole("dialog", { name: "Move the document" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument();
  });
});

describe("File > Revert To", () => {
  it("goes back to the version File > Save kept, past what autosave wrote, and writes it into the file", async () => {
    const user = userEvent.setup();
    const { server, actions } = await openAlpha();
    write("<div>Saved text</div>");
    await act(async () => actions.current?.file?.save());
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Saved text"));
    await ready();
    write("<div>Autosaved over</div>");
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Autosaved over"), {
      timeout: 4000,
    });
    act(() => actions.current?.file?.revert());
    const sheet = within(await screen.findByRole("dialog", { name: /go back to the version/ }));
    await user.click(sheet.getByRole("button", { name: "Revert" }));
    await waitFor(() => expect(editor().textContent).toBe("Saved text"));
    expect(screen.getByRole("region", { name: "A" })).toBeInTheDocument();
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Saved text"), {
      timeout: 4000,
    });
    expect(server.bytes.get("f-a")).not.toContain("Autosaved over");
  });

  it("dims both rows of a document that has no file, each with its reason", async () => {
    createServer();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <TextEdit />
        <DesktopMenu title="File" />
      </>,
    );
    await ready();
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Revert To" }));
    const last = await screen.findByRole("menuitem", { name: "Last Saved" });
    expect(last).toHaveAttribute("aria-disabled", "true");
    expect(last).toHaveAttribute("title", "No saved version of this document is kept.");
    expect(screen.getByRole("menuitem", { name: "Browse All Versions…" })).toHaveAttribute(
      "title",
      "This document has no file yet, so it has no versions.",
    );
  });
});

describe("File > Share", () => {
  it("hands the document's file to Mail, and dims AirDrop with its reason", async () => {
    const stop = registerFileReceivers([{ id: "mail", takesSharedFiles: true }]);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await openAlpha();
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Share" }));
    expect(await screen.findByRole("menuitem", { name: "AirDrop" })).toHaveAttribute(
      "title",
      "AirDrop sends to nearby devices, which a web page can’t reach.",
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Mail" }));
    const [shared] = takeSharedFiles("mail");
    expect(shared?.from).toBe("textedit");
    expect(shared?.items.map((item) => item.id)).toEqual(["f-a"]);
    stop();
  });
});

describe("File > Save As: Web Page", () => {
  it("writes HTML into a file named .html", async () => {
    const user = userEvent.setup();
    const server = createServer();
    const actions = { current: null as TextEditActions | null };
    render(
      <TextEdit
        actionsRef={(value) => {
          actions.current = value;
        }}
      />,
    );
    await ready();
    write("<div>A page</div>");
    act(() => actions.current?.file?.saveAs());
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    await user.click(save.getByRole("combobox", { name: "File Format:" }));
    await user.click(await screen.findByRole("option", { name: "Web Page (.html)" }));
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Page");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(server.entries.some((each) => each.name === "Page.html")).toBe(true),
    );
    const id = server.entries.find((each) => each.name === "Page.html")?.id ?? "";
    expect(server.bytes.get(id)).toBe(
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div>A page</div></body></html>',
    );
    expect(server.starts.at(-1)?.type).toBe("text/html;charset=utf-8");
  });
});

describe("the Open panel's Ignore rich text commands", () => {
  it("opens an RTF file as its code, once", async () => {
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
    // The page keeps the drive it read last: an earlier test's, without this file.
    await act(() => loadDrive());
    act(() => actions.current?.file?.open());
    await user.click(await screen.findByRole("checkbox", { name: "Ignore rich text commands" }));
    const panel = within(await screen.findByRole("dialog", { name: "Open" }));
    await user.dblClick(await panel.findByRole("option", { name: "A.rtf" }));
    await waitFor(() => expect(editor().tagName).toBe("TEXTAREA"));
    expect((editor() as HTMLTextAreaElement).value.startsWith("{\\rtf1")).toBe(true);
  });
});

describe("File > Page Setup…", () => {
  it("keeps the paper, orientation and scale, which reach the printed page", async () => {
    const user = userEvent.setup();
    const { actions } = await openAlpha();
    act(() => actions.current?.file?.pageSetup());
    const sheet = within(await screen.findByRole("dialog", { name: "Page Setup" }));
    expect(sheet.getByRole("combobox", { name: "Format For:" })).toHaveAttribute(
      "title",
      "The browser’s print dialog chooses the printer.",
    );
    await user.click(sheet.getByRole("combobox", { name: "Paper Size:" }));
    await user.click(await screen.findByRole("option", { name: "A4" }));
    await user.click(sheet.getByRole("radio", { name: "Landscape" }));
    const scale = sheet.getByRole("textbox", { name: "Scale:" });
    await user.clear(scale);
    await user.type(scale, "150");
    await user.click(sheet.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Page Setup" })).not.toBeInTheDocument(),
    );
    act(() => actions.current?.show("print"));
    const print = within(await screen.findByRole("dialog", { name: "Print" }));
    await user.click(print.getByRole("button", { name: "Print" }));
    const frame = document.querySelector<HTMLIFrameElement>("iframe[data-textedit-print]");
    expect(frame?.srcdoc).toContain("@page{size:A4 landscape;margin:1in}");
    expect(frame?.srcdoc).toContain("html{zoom:1.5}");
  });
});

/** A managed window of the desktop holding TextEdit; what it asks the desktop for is listed. */
function DesktopTextEdit({
  opening,
  actions,
  id = "textedit",
}: {
  opening?: TextEditOpening;
  actions?: { current: TextEditActions | null };
  id?: string;
}) {
  return (
    <ManagedWindow
      id={id}
      app="textedit"
      title="TextEdit"
      defaultFrame={{ x: 0, y: 30, width: 624, height: 537 }}
      render={(windowProps) => (
        <DesktopWindowHostContext value={{ app: "textedit", stage: () => null, place: () => ({}) }}>
          <TextEdit
            {...windowProps}
            {...(opening ? { opening } : undefined)}
            actionsRef={(value) => {
              if (actions) actions.current = value;
            }}
          />
        </DesktopWindowHostContext>
      )}
    />
  );
}

/** What the windows asked the desktop for since this was called. */
function listenToEffects() {
  const effects: DesktopEffect[] = [];
  const stop = onDesktopEffects((more) => effects.push(...more));
  stopEffects.push(stop);
  return effects;
}
const stopEffects: (() => void)[] = [];
afterEach(() => {
  for (const stop of stopEffects.splice(0)) stop();
  for (const key of Object.keys(desktopValues())) {
    if (key.startsWith("textedit.window")) changeDesktopValue(key, null);
  }
});

const KEYS_TO_DRAFTS = "textedit.windows";

describe("several document windows", () => {
  it("File > New asks the desktop for another window and leaves this document alone", async () => {
    createServer();
    const effects = listenToEffects();
    const actions = { current: null as TextEditActions | null };
    render(
      <WindowManager>
        <DesktopTextEdit actions={actions} />
      </WindowManager>,
    );
    await ready();
    write("<div>Mine</div>");
    act(() => actions.current?.file?.newDocument());
    expect(effects).toEqual([{ newWindow: "textedit", opening: { kind: "new" } }]);
    expect(editor().textContent).toBe("Mine");
    expect(screen.queryByRole("dialog", { name: "Save changes" })).toBeNull();
  });

  it("a file goes in a window that holds nothing, then in a window of its own, and once only", async () => {
    const server = createServer();
    server.put("f-a", "A.rtf", rtf("Alpha"));
    server.put("f-b", "B.rtf", rtf("Beta"));
    const effects = listenToEffects();
    render(
      <WindowManager>
        <DesktopTextEdit />
      </WindowManager>,
    );
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await waitFor(() => expect(editor().textContent).toBe("Alpha"));
    await ready();
    expect(effects).toEqual([]);

    act(() => requestOpenFile({ app: "textedit", id: "f-b", name: "B.rtf" }));
    await waitFor(() =>
      expect(effects).toEqual([
        {
          newWindow: "textedit",
          opening: { kind: "file", file: { id: "f-b", name: "B.rtf" } },
        },
      ]),
    );
    expect(editor().textContent).toBe("Alpha");

    // Its own file again: nothing new.
    act(() => requestOpenFile({ app: "textedit", id: "f-a", name: "A.rtf" }));
    await waitFor(() => expect(effects).toHaveLength(1));
  });

  it("names its window after the document, for the Window menu and the Dock", async () => {
    createServer();
    const titles: string[] = [];
    const Titles = () => {
      const { windows } = useWindowManager();
      titles.splice(0, titles.length, ...windows.map((window) => window.title));
      return null;
    };
    render(
      <WindowManager>
        <DesktopTextEdit />
        <Titles />
      </WindowManager>,
    );
    await ready();
    await waitFor(() => expect(titles).toEqual(["512 Pixels"]));
    write("<div>Changed</div>");
    await waitFor(() => expect(titles).toEqual(["512 Pixels — Edited"]));
  });

  it("a further window opens its file, sends no draft, and keeps its own until it closes", async () => {
    const server = createServer();
    server.put("f-b", "B.rtf", rtf("Beta"));
    const { unmount } = render(
      <WindowManager>
        <DesktopTextEdit
          id="textedit:2"
          opening={{ kind: "file", file: { id: "f-b", name: "B.rtf" } }}
        />
      </WindowManager>,
    );
    await waitFor(() => expect(editor().textContent).toBe("Beta"));
    const draftCalls = () =>
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes("/api/textedit/draft"));
    expect(draftCalls()).toEqual([]);
    await waitFor(() => expect(desktopValues()[KEYS_TO_DRAFTS]).toEqual(["textedit-2"]), {
      timeout: 2500,
    });
    await waitFor(
      () =>
        expect(readKeptWindow("textedit:2")).toEqual({
          draft: {
            name: "B.rtf",
            format: "rich",
            lines: [""],
            edited: false,
            file: { id: "f-b", name: "B.rtf", version: 0 },
          },
        }),
      { timeout: 2500 },
    );
    unmount();
    expect(desktopValues()[KEYS_TO_DRAFTS]).toEqual([]);
    expect(readKeptWindow("textedit:2")).toBeNull();
  });

  it("a further window's record holds the version a write made at once, for a reload right after it", async () => {
    const server = createServer();
    server.put("f-b", "B.rtf", rtf("Beta"));
    render(
      <WindowManager>
        <DesktopTextEdit
          id="textedit:2"
          opening={{ kind: "file", file: { id: "f-b", name: "B.rtf" } }}
        />
      </WindowManager>,
    );
    await waitFor(() => expect(editor().textContent).toBe("Beta"));
    await ready();
    write("<div>Beta, changed</div>");
    fireEvent.keyDown(editor(), { key: "s", ctrlKey: true });
    await waitFor(() => expect(server.bytes.get("f-b")).toContain("changed"), { timeout: 2500 });
    await waitFor(
      () =>
        expect(readKeptWindow("textedit:2")).toMatchObject({
          draft: { file: { id: "f-b", version: 1 } },
        }),
      { timeout: 300 },
    );
  });

  it("a further window the desktop brings back after a reload finds its text by its id", async () => {
    createServer();
    keepWindow("textedit:2", {
      draft: {
        name: "Untitled",
        format: "rich",
        lines: ["Kept text"],
        html: "<div>Kept text</div>",
        edited: true,
      },
    });
    render(
      <WindowManager>
        <DesktopTextEdit id="textedit:2" />
      </WindowManager>,
    );
    await ready();
    expect(editor().textContent).toBe("Kept text");
    const draftCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes("/api/textedit/draft"));
    expect(draftCalls).toEqual([]);
  });

  it("a further window that kept only which file it is reads that file and writes nothing into it", async () => {
    const server = createServer();
    const id = "6a7b8c9d0e1f20a1b2c3d4e5f6a7b8c9";
    server.put(id, "A.rtf", rtf("Alpha"));
    // What the window keeps once autosave has written its change: `edited` still says so, since
    // no File > Save came after it.
    keepWindow("textedit:2", {
      draft: {
        name: "A.rtf",
        format: "rich",
        lines: [""],
        edited: true,
        file: { id, name: "A.rtf", version: 0 },
      },
    });
    render(
      <WindowManager>
        <DesktopTextEdit id="textedit:2" />
      </WindowManager>,
    );
    await waitFor(() => expect(editor().textContent).toBe("Alpha"));
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(server.starts).toEqual([]);
    expect(server.bytes.get(id)).toBe(rtf("Alpha"));
  });

  it("the first window keeps the server's draft unless it was opened anew", async () => {
    createServer();
    render(
      <WindowManager>
        <DesktopTextEdit />
      </WindowManager>,
    );
    await ready();
    const draftCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes("/api/textedit/draft"));
    expect(draftCalls.length).toBeGreaterThan(0);
  });

  it("a further window says when it is too large to keep", async () => {
    createServer();
    render(
      <WindowManager>
        <DesktopTextEdit id="textedit:2" opening={{ kind: "new" }} />
      </WindowManager>,
    );
    await ready();
    write(`<div>${"x".repeat(40_000)}</div>`);
    await waitFor(
      () =>
        expect(screen.getByText(/This window can’t be kept when the page reloads/)).toBeVisible(),
      { timeout: 2500 },
    );
  });

  it("off the desktop, New still replaces the one window", async () => {
    createServer();
    const effects = listenToEffects();
    const actions = { current: null as TextEditActions | null };
    render(
      <TextEdit
        actionsRef={(value) => {
          actions.current = value;
        }}
      />,
    );
    await ready();
    act(() => actions.current?.file?.newDocument());
    await waitFor(() => expect(editor().textContent).toBe(""));
    expect(effects).toEqual([]);
  });
});

describe("attaching files", () => {
  const PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==";
  const pngFile = () =>
    new File([Uint8Array.from(atob(PNG_BASE64), (char) => char.charCodeAt(0))], "p.png", {
      type: "image/png",
    });

  /** The browser's `insertHTML`, which a test's DOM lacks. */
  const stubInsert = () => {
    document.execCommand = ((command: string, _ui: boolean, value: string) => {
      if (command === "insertHTML") editor().insertAdjacentHTML("beforeend", value);
      return true;
    }) as Document["execCommand"];
  };

  const dropOn = (item: DesktopDragItem) => {
    const landing = landingAt(body(), { from: "finder", items: [item], copy: false });
    if (landing && !landing.refusal) act(() => landing.drop());
    return landing;
  };

  it("a dropped PDF is attached as a link to the file, which a double click opens", async () => {
    const { server } = await openAlpha();
    server.entries.push({
      id: "pdf1",
      parent: "documents",
      name: "Report.pdf",
      kind: "file",
      size: 3,
      type: "application/pdf",
      created_ms: 1,
      modified_ms: 1,
    });
    await act(() => loadDrive());
    stubInsert();
    const effects = listenToEffects();
    dropOn({ id: "pdf1", name: "Report.pdf", kind: "file", type: "application/pdf" });
    const chip = await waitFor(() => {
      const found = editor().querySelector<HTMLAnchorElement>('a[href="drive:pdf1"]');
      expect(found).not.toBeNull();
      return found as HTMLAnchorElement;
    });
    expect(chip.textContent).toBe("Report.pdf");
    expect(chip).toHaveAttribute("contenteditable", "false");
    fireEvent.click(chip);
    expect(effects).toEqual([]);
    fireEvent.click(chip, { detail: 2 });
    expect(effects).toEqual([{ open: "preview" }]);
  });

  it("a dropped picture goes into the text at its size", async () => {
    await openAlpha();
    stubInsert();
    dropOn({
      id: "",
      name: "p.png",
      kind: "file",
      type: "image/png",
      bytes: async () => pngFile(),
    });
    await waitFor(() =>
      expect(editor().querySelector("img")?.getAttribute("src")).toBe(
        `data:image/png;base64,${PNG_BASE64}`,
      ),
    );
    expect(editor().querySelector("img")).toHaveAttribute("width", "1");
  });

  it("a text file dropped still opens, and plain text refuses a picture", async () => {
    const server = createServer();
    const entry: DesktopDragItem = { id: "t1", name: "T.txt", kind: "file", type: "text/plain" };
    server.put("t1", "T.txt", "Words");
    render(<TextEdit />);
    await ready();
    dropOn(entry);
    await waitFor(() => expect(editor()).toHaveValue("Words"));
    await ready();
    expect(dropOn({ id: "p", name: "p.png", kind: "file", type: "image/png" })?.refusal).toBe(
      "TextEdit opens text documents.",
    );
  });

  it("Shift-Command-A opens a panel of the drive's files", async () => {
    await openAlpha();
    fireEvent.keyDown(editor(), { key: "a", code: "KeyA", ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument());
    expect(body()).toHaveAttribute("inert");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await ready();
  });
});

describe("the title bar of a document with a file", () => {
  it("Command-clicking the title shows the file and its folders, which show in Finder", async () => {
    const user = userEvent.setup();
    await openAlpha();
    const effects = listenToEffects();
    const title = document.querySelector(".mac-title-bar-title") as HTMLElement;
    fireEvent.pointerDown(title, { button: 0, ctrlKey: true });
    const menu = within(await screen.findByRole("menu", { name: "Path" }));
    expect(menu.getAllByRole("menuitem").map((row) => row.textContent)).toEqual([
      "A.rtf",
      "Documents",
    ]);
    await user.click(menu.getByRole("menuitem", { name: "Documents" }));
    expect(takeOpenFileRequests("finder").map((request) => request.id)).toEqual(["documents"]);
    expect(effects).toEqual([{ open: "finder" }]);
  });

  it("its proxy icon drags out as the file", async () => {
    await openAlpha();
    const proxy = document.querySelector(".mac-title-bar-icon") as HTMLElement;
    const seen: string[] = [];
    const target = document.createElement("div");
    document.body.append(target);
    const stop = registerDropTarget({
      element: target,
      landing: (_hit, drag) => {
        seen.push(...drag.items.map((item) => item.name));
        return { element: target, drop: () => {} };
      },
    });
    const realFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;
    fireEvent.pointerDown(proxy, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(document.documentElement, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(document.documentElement, { clientX: 40, clientY: 40, pointerId: 1 });
    document.elementFromPoint = realFromPoint;
    stop();
    target.remove();
    expect(seen).toContain("A.rtf");
  });
});

describe("the Save sheet's formats", () => {
  it.each([
    ["Word 2007 Format (.docx)", "Page.docx", "PK"],
    ["OpenDocument Text (.odt)", "Page.odt", "PK"],
    ["Web Archive Document (.webarchive)", "Page.webarchive", "<?xml"],
  ])("%s writes %s", async (label, name, starts) => {
    const user = userEvent.setup();
    const server = createServer();
    const actions = { current: null as TextEditActions | null };
    render(
      <TextEdit
        actionsRef={(value) => {
          actions.current = value;
        }}
      />,
    );
    await ready();
    write("<div>A page</div>");
    act(() => actions.current?.file?.saveAs());
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    await user.click(save.getByRole("combobox", { name: "File Format:" }));
    await user.click(await screen.findByRole("option", { name: label }));
    const field = save.getByRole("textbox", { name: "Save As:" });
    await user.clear(field);
    await user.type(field, "Page");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(server.entries.some((each) => each.name === name)).toBe(true));
    const id = server.entries.find((each) => each.name === name)?.id ?? "";
    expect(server.bytes.get(id)?.startsWith(starts)).toBe(true);
    // Properties have no place in these files.
    await waitFor(() => expect(editor().textContent).toBe("A page"));
  });

  it("dims Rich Text With Graphics, saying why", async () => {
    const user = userEvent.setup();
    createServer();
    const actions = { current: null as TextEditActions | null };
    render(
      <TextEdit
        actionsRef={(value) => {
          actions.current = value;
        }}
      />,
    );
    await ready();
    act(() => actions.current?.file?.saveAs());
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    await user.click(save.getByRole("combobox", { name: "File Format:" }));
    const row = await screen.findByRole("option", {
      name: "Rich Text With Graphics Document (.rtfd)",
    });
    expect(row).not.toHaveAttribute("aria-disabled", "true");
  });

  it("saves plain text in the encoding chosen, and keeps writing in it", async () => {
    const user = userEvent.setup();
    const server = createServer();
    const uploaded: ArrayBuffer[] = [];
    const realFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (input, init = {}) => {
      if (/uploads\/[^/]+\/\d+$/.test(String(input))) uploaded.push(init.body as ArrayBuffer);
      return (realFetch as typeof fetch)(input, init);
    });
    const actions = { current: null as TextEditActions | null };
    render(
      <TextEdit
        defaultDocument={{ name: "Note", format: "plain", lines: ["café"] }}
        actionsRef={(value) => {
          actions.current = value;
        }}
      />,
    );
    await ready();
    act(() => actions.current?.file?.saveAs());
    const save = within(await screen.findByRole("dialog", { name: "Save" }));
    await user.click(save.getByRole("combobox", { name: "Plain Text Encoding:" }));
    await user.click(await screen.findByRole("option", { name: "Western (Windows Latin 1)" }));
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(uploaded).toHaveLength(1));
    expect([...new Uint8Array(uploaded[0] as ArrayBuffer)]).toEqual([0x63, 0x61, 0x66, 0xe9]);
    expect(server.starts.at(-1)?.type).toBe("text/plain;charset=windows-1252");
    await ready();
    fireEvent.change(editor(), { target: { value: "cafés" } });
    await waitFor(() => expect(uploaded).toHaveLength(2), { timeout: 3000 });
    expect([...new Uint8Array(uploaded[1] as ArrayBuffer)]).toEqual([0x63, 0x61, 0x66, 0xe9, 0x73]);
  });

  it("File > Export as PDF… asks where, with the document's name", async () => {
    await openAlpha().then(({ actions }) => act(() => actions.current?.file?.exportPdf()));
    const sheet = within(await screen.findByRole("dialog", { name: "Export as PDF" }));
    expect(sheet.getByRole("textbox", { name: "Save As:" })).toHaveValue("A.pdf");
    expect(document.querySelector("iframe[data-textedit-print]")).toBeNull();
  });
});

describe("Format > Text > Spacing…", () => {
  it("sets the selected paragraph's spacing, which Undo takes back", async () => {
    const user = userEvent.setup();
    const { actions } = await openAlpha();
    selectFirstParagraph();
    act(() => actions.current?.extra("show-spacing"));
    const sheet = within(await screen.findByRole("dialog", { name: "Spacing" }));
    await user.click(sheet.getByRole("combobox", { name: "Line height multiple:" }));
    await user.click(await screen.findByRole("option", { name: "1.5" }));
    const before = sheet.getByRole("textbox", { name: "Paragraph spacing before:" });
    await user.clear(before);
    await user.type(before, "6");
    const after = sheet.getByRole("textbox", { name: "Paragraph spacing after:" });
    await user.clear(after);
    await user.type(after, "12");
    await user.click(sheet.getByRole("button", { name: "OK" }));
    const paragraph = editor().firstElementChild as HTMLElement;
    await waitFor(() => expect(paragraph.style.marginTop).toBe("6px"));
    expect(paragraph.style.marginBottom).toBe("12px");
    expect(paragraph.dataset.spacing).toBe("1.5");
    expect(stepRuler(editor(), "undo")).toBe(true);
    expect(paragraph.style.marginTop).toBe("");
    expect(paragraph.dataset.spacing).toBeUndefined();
  });
});

describe("Format > Font > Styles…", () => {
  it("lists the document's styles, keeps a favourite, and applies one to the selection", async () => {
    const user = userEvent.setup();
    const { actions } = await openAlpha();
    write(
      '<div><span style="font-family: Times; font-size: 18px; font-weight: bold">Big</span></div><div>Other</div>',
    );
    const commands: [string, string | undefined][] = [];
    document.execCommand = (name: string, _?: boolean, value?: string) => {
      commands.push([name, value]);
      return true;
    };
    selectFirstParagraph();
    act(() => actions.current?.extra("show-styles"));
    const sheet = within(await screen.findByRole("dialog", { name: "Styles" }));
    const row = sheet.getByRole("radio", { name: "Times 18 Bold" });
    await user.click(row);
    await user.click(sheet.getByRole("button", { name: "Add to Favorites" }));
    expect(sheet.getByRole("button", { name: "Add to Favorites" })).toBeDisabled();
    await user.click(sheet.getByRole("combobox", { name: "Show:" }));
    await user.click(await screen.findByRole("option", { name: "Favorite Styles" }));
    expect(await sheet.findByRole("radio", { name: "Times 18 Bold" })).toBeInTheDocument();
    await user.click(sheet.getByRole("button", { name: "Remove" }));
    expect(sheet.queryByRole("radio", { name: "Times 18 Bold" })).not.toBeInTheDocument();
    await user.click(sheet.getByRole("combobox", { name: "Show:" }));
    await user.click(await screen.findByRole("option", { name: "Document Styles" }));
    await user.click(await sheet.findByRole("radio", { name: "Times 18 Bold" }));
    await user.click(sheet.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(
        commands.some(
          ([name, value]) => name === "insertHTML" && /font-size: 18px/.test(value ?? ""),
        ),
      ).toBe(true),
    );
  });

  it("dims Apply at an insertion point, saying why", async () => {
    const { actions } = await openAlpha();
    act(() => actions.current?.extra("show-styles"));
    const apply = within(await screen.findByRole("dialog", { name: "Styles" })).getByRole(
      "button",
      { name: "Apply" },
    );
    expect(apply).toBeDisabled();
    expect(apply).toHaveAttribute("title", "Select the text to give the style to.");
  });
});

describe("the title of a document with a file", () => {
  it("opens on a click: Name renames, Tags tags, Where moves, Locked locks", async () => {
    const user = userEvent.setup();
    const { server } = await openAlpha();
    const title = document.querySelector(".mac-textedit-title") as HTMLElement;
    expect(title.textContent).toBe("A");
    await user.click(title);
    const popover = within(await screen.findByRole("dialog", { name: "Document" }));
    const name = popover.getByRole("textbox", { name: "Name:" });
    await user.clear(name);
    await user.type(name, "B.rtf{Enter}");
    await waitFor(() =>
      expect(server.ops).toContainEqual({ op: "rename", id: "f-a", name: "B.rtf" }),
    );
    await user.click(popover.getByRole("combobox", { name: "Where:" }));
    await user.click(await screen.findByRole("option", { name: "Desktop" }));
    await waitFor(() =>
      expect(server.ops).toContainEqual({ op: "move", id: "f-a", parent: "desktop" }),
    );
    await user.type(popover.getByRole("textbox", { name: "Tags:" }), "Work{Enter}");
    await waitFor(() =>
      expect(server.ops).toContainEqual({ op: "tag", id: "f-a", tags: ["Work"] }),
    );
    const locked = popover.getByRole("checkbox", { name: "Locked" });
    await user.click(locked);
    await waitFor(() => expect(server.ops).toContainEqual({ op: "info", id: "f-a", locked: true }));
  });

  it("does not open after a press that moved the window", async () => {
    await openAlpha();
    const title = document.querySelector(".mac-textedit-title") as HTMLElement;
    fireEvent.pointerDown(title, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(title, { clientX: 60, clientY: 40 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(screen.queryByRole("dialog", { name: "Document" })).not.toBeInTheDocument();
  });
});

describe("Edit > Complete", () => {
  it("lists the words that finish the one at the insertion point, and inserts the one chosen", async () => {
    createServer();
    const inserted: (string | undefined)[] = [];
    document.execCommand = (name: string, _?: boolean, value?: string) => {
      if (name === "insertText") inserted.push(value);
      return true;
    };
    render(
      <TextEdit
        defaultDocument={{ name: "Note", format: "plain", lines: ["Hello zzq zzqa zzqb zzq"] }}
      />,
    );
    await ready();
    const view = editor() as HTMLTextAreaElement;
    view.focus();
    view.setSelectionRange(view.value.length, view.value.length);
    fireEvent.keyDown(view, { key: "Escape", code: "Escape", altKey: true });
    const list = await screen.findByRole("listbox", { name: "Completions" });
    expect(
      within(list)
        .getAllByRole("option")
        .map((row) => row.textContent),
    ).toEqual(["zzqa", "zzqb"]);
    expect(within(list).getByRole("option", { name: "zzqa" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(view, { key: "ArrowDown" });
    expect(within(list).getByRole("option", { name: "zzqb" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(view, { key: "Enter" });
    expect(inserted).toEqual(["b"]);
    expect(screen.queryByRole("listbox", { name: "Completions" })).not.toBeInTheDocument();
  });

  it("goes away on Escape, inserting nothing", async () => {
    createServer();
    const inserted: string[] = [];
    document.execCommand = (name: string) => {
      inserted.push(name);
      return true;
    };
    render(<TextEdit defaultDocument={{ name: "Note", format: "plain", lines: ["zzqa zzq"] }} />);
    await ready();
    const view = editor() as HTMLTextAreaElement;
    view.focus();
    view.setSelectionRange(view.value.length, view.value.length);
    fireEvent.keyDown(view, { key: "Escape", code: "Escape", altKey: true });
    await screen.findByRole("listbox", { name: "Completions" });
    fireEvent.keyDown(view, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Completions" })).not.toBeInTheDocument();
    expect(inserted).toEqual([]);
  });
});
