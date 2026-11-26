import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import type { DriveEntry, KeptVersion } from "../desktop/desktop-files";
import { previousSaveOf, readVersion } from "../desktop/desktop-files";
import { requestOpenFile } from "../finder/finder-open";
import { TextEdit, type TextEditActions } from "./textedit";
import { TextEditVersionPageView } from "./textedit-drive";
import { paragraphsOfLines, writeRtf } from "./textedit-rtf";

/*
 * File > Revert To > Previous Save and Browse All Versions…, on a stand-in for the drive: entries,
 * bytes and kept versions in memory, keeping every version (the thinning and the bounds are the
 * server's, in `src/apps/files/drive.rs`, and the journey `versions-batch9-journey.mjs` drives the
 * real one).
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  delete (document as Partial<Document>).execCommand;
});

const rtf = (line: string) => writeRtf(paragraphsOfLines([line]));

interface Kept {
  version: number;
  text: string;
  modified_ms: number;
  saved: boolean;
}

function createServer() {
  const session = `s-${Math.random()}`;
  let rev = 1;
  let next = 0;
  let now = 1_700_000_000_000;
  const entries: DriveEntry[] = ["Desktop", "Documents"].map((name) => ({
    id: name.toLowerCase(),
    name,
    kind: "folder",
    size: 0,
    created_ms: 1,
    modified_ms: 1,
  }));
  const bytes = new Map<string, string>();
  const kept = new Map<string, Kept[]>();
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
  const keepCurrent = (id: string, saved: boolean) => {
    const entry = entries.find((each) => each.id === id);
    const text = bytes.get(id);
    if (!entry || text === undefined) return;
    const list = kept.get(id) ?? [];
    const same = list.find((each) => each.text === text);
    if (same) same.saved ||= saved;
    else {
      list.push({
        version: entry.version ?? 0,
        text,
        modified_ms: entry.modified_ms,
        saved,
      });
    }
    kept.set(id, list);
  };
  const answer = (method: string, url: URL, init: RequestInit): Response => {
    const path = url.pathname;
    if (path === "/api/textedit/draft") {
      return json(method === "PUT" ? { rev: 1 } : { draft: null, rev: 0 });
    }
    if (path === "/api/files/" && method === "GET") return json(drive());
    if (path === "/api/files/ops" && method === "POST") return json(drive([]));
    if (path === "/api/files/uploads" && method === "POST") {
      next += 1;
      uploads.set(`u${next}`, { body: JSON.parse(String(init.body)), text: "" });
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
      const id = String(upload.body.replaces);
      const entry = entries.find((each) => each.id === id);
      if (!entry) return json({ error: "no such file" }, 404);
      keepCurrent(id, false);
      now += 60_000;
      entry.version = (entry.version ?? 0) + 1;
      entry.modified_ms = now;
      bytes.set(id, upload.text);
      rev += 1;
      return json({ ...drive([id]), version: entry.version });
    }
    const content = /^\/api\/files\/content\/([^/]+)$/.exec(path);
    if (content) return new Response(new TextEncoder().encode(bytes.get(content[1] ?? "") ?? ""));
    const keep = /^\/api\/files\/versions\/([^/]+)\/keep$/.exec(path);
    if (keep && method === "POST") {
      keepCurrent(keep[1] ?? "", true);
      return new Response(null, { status: 204 });
    }
    const restore = /^\/api\/files\/versions\/([^/]+)\/(\d+)\/restore$/.exec(path);
    if (restore && method === "POST") {
      const id = restore[1] ?? "";
      const entry = entries.find((each) => each.id === id);
      const chosen = kept.get(id)?.find((each) => each.version === Number(restore[2]));
      if (!entry || !chosen) return json({ error: "no such version" }, 404);
      if (bytes.get(id) !== chosen.text) {
        keepCurrent(id, true);
        bytes.set(id, chosen.text);
        entry.version = (entry.version ?? 0) + 1;
        rev += 1;
      }
      return json({ ...drive(), version: entry.version });
    }
    const read = /^\/api\/files\/versions\/([^/]+)\/(\d+)$/.exec(path);
    if (read && method === "GET") {
      const chosen = kept.get(read[1] ?? "")?.find((each) => each.version === Number(read[2]));
      if (!chosen) return json({ error: "no such version" }, 404);
      return new Response(new TextEncoder().encode(chosen.text), {
        headers: { "x-file-pieces": "1" },
      });
    }
    const list = /^\/api\/files\/versions\/([^/]+)$/.exec(path);
    if (list && method === "GET") {
      const id = list[1] ?? "";
      const entry = entries.find((each) => each.id === id);
      return json({
        version: entry?.version ?? 0,
        modified_ms: entry?.modified_ms ?? 0,
        versions: (kept.get(id) ?? [])
          .filter((each) => each.text !== bytes.get(id))
          .reverse()
          .map(({ text, ...each }) => ({ ...each, size: text.length, type: "text/rtf" })),
      });
    }
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
      modified_ms: now,
    });
    bytes.set(id, text);
    rev += 1;
  };
  return { entries, bytes, kept, put };
}

const editor = () => screen.getByRole("textbox", { name: "Document" });
const body = () => document.querySelector(".mac-textedit-body") as HTMLElement;
const ready = () => waitFor(() => expect(body()).not.toHaveAttribute("inert"));

function write(html: string) {
  const node = editor();
  node.innerHTML = html;
  fireEvent.input(node);
}

function DesktopMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("textedit", title);
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title={title}>{items}</MenuBarMenu>
    </MenuBar>
  );
}

/** Opens the drive file `A.rtf`, holding "Alpha", and saves "Beta" over it with File > Save. */
async function savedOnce() {
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
  write("<div>Beta</div>");
  await act(async () => actions.current?.file?.save());
  await waitFor(() => expect(server.bytes.get("f-a")).toContain("Beta"));
  await waitFor(() =>
    expect(server.kept.get("f-a")?.map((each) => each.saved)).toEqual([false, true]),
  );
  await ready();
  return { server, actions };
}

const version = (number: number, saved: boolean): KeptVersion => ({
  version: number,
  saved,
  size: 1,
  type: "",
  modifiedMs: number * 1000,
});

describe("previousSaveOf", () => {
  it("takes the newest save older than the last one, past autosave's versions", () => {
    const list = [version(9, false), version(7, true), version(5, false), version(2, true)];
    expect(previousSaveOf(list, 9)?.version).toBe(7);
    expect(previousSaveOf(list, 7)?.version).toBe(2);
  });

  it("falls back on the newest older version, and answers nothing without one", () => {
    expect(previousSaveOf([version(4, false), version(3, false)], 5)?.version).toBe(4);
    expect(previousSaveOf([version(4, false)], 4)).toBeUndefined();
    expect(previousSaveOf([], 4)).toBeUndefined();
  });
});

describe("readVersion", () => {
  it("reads a version in as many requests as it has pieces, and joins them", async () => {
    const asked: string[] = [];
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        asked.push(String(input));
        return new Response(asked.length === 1 ? "first" : "-second", {
          headers: { "x-file-pieces": "10" },
        });
      }),
    );
    const bytes = await readVersion("f1", 3);
    expect(new TextDecoder().decode(bytes)).toBe("first-second");
    expect(asked.map((url) => url.replace(/.*\/api/, "/api").split("&_")[0])).toEqual([
      "/api/files/versions/f1/3?piece=0&count=8",
      "/api/files/versions/f1/3?piece=8&count=8",
    ]);
  });
});

describe("File > Revert To > Browse All Versions", () => {
  it("shows the chosen version beside the document, and Restore makes it the file's bytes", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { server, actions } = await savedOnce();
    act(() => actions.current?.file?.browseVersions());
    const sheet = within(await screen.findByRole("dialog", { name: "Versions of “A.rtf”" }));
    expect(sheet.getByRole("document", { name: "Current Document" }).textContent).toBe("Beta");
    const row = await sheet.findByRole("row");
    expect(row.textContent).toContain("2023");
    const pages = await waitFor(() => {
      const found = sheet.getAllByRole("document");
      expect(found).toHaveLength(2);
      return found;
    });
    expect(pages[1]?.textContent).toBe("Alpha");

    await user.click(sheet.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(editor().textContent).toBe("Alpha"));
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Alpha"));
    expect(screen.queryByRole("dialog", { name: /^Versions of/ })).toBeNull();
    expect(server.kept.get("f-a")?.map((each) => each.version)).toEqual([0, 1]);
    expect(server.kept.get("f-a")?.[1]?.text).toContain("Beta");
    // The window's file is at the restored version, so the next write goes in.
    await ready();
    write("<div>Gamma</div>");
    await act(async () => actions.current?.file?.save());
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Gamma"));
  });

  it("says so when a file has no earlier versions, with Restore dimmed", async () => {
    const server = createServer();
    server.put("f-b", "B.rtf", rtf("Only"));
    const actions = { current: null as TextEditActions | null };
    render(
      <TextEdit
        actionsRef={(value) => {
          actions.current = value;
        }}
      />,
    );
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-b", name: "B.rtf" }));
    await waitFor(() => expect(editor().textContent).toBe("Only"));
    await ready();
    act(() => actions.current?.file?.browseVersions());
    const sheet = within(await screen.findByRole("dialog", { name: "Versions of “B.rtf”" }));
    expect(
      await sheet.findByText("This document has no earlier versions yet. Its next save keeps one."),
    ).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Restore" })).toBeDisabled();
  });
});

describe("File > Revert To > Previous Save", () => {
  it("goes back past File > Save at once, keeping what it replaced", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { server } = await savedOnce();
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Revert To" }));
    const previous = await screen.findByRole("menuitem", { name: "Previous Save" });
    await waitFor(() => expect(previous).not.toHaveAttribute("aria-disabled", "true"));
    fireEvent.click(previous);
    await waitFor(() => expect(editor().textContent).toBe("Alpha"));
    await waitFor(() => expect(server.bytes.get("f-a")).toContain("Alpha"));
    expect(server.kept.get("f-a")?.[1]?.text).toContain("Beta");
  });

  it("is dimmed with its reason while no earlier save is kept", async () => {
    const server = createServer();
    server.put("f-c", "C.rtf", rtf("Only"));
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <TextEdit />
        <DesktopMenu title="File" />
      </>,
    );
    await ready();
    act(() => requestOpenFile({ app: "textedit", id: "f-c", name: "C.rtf" }));
    await waitFor(() => expect(editor().textContent).toBe("Only"));
    await ready();
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Revert To" }));
    const previous = await screen.findByRole("menuitem", { name: "Previous Save" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toHaveAttribute("title", "No earlier save of this document is kept.");
    expect(screen.getByRole("menuitem", { name: "Browse All Versions…" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows a plain text version's lines, and the next version's when it changes", () => {
    const { rerender } = render(
      <TextEditVersionPageView page={{ lines: ["one", "two"] }} label="Kept" />,
    );
    expect(screen.getByRole("document", { name: "Kept" }).textContent).toBe("one\ntwo");
    rerender(<TextEditVersionPageView page={{ lines: ["three"] }} label="Kept" />);
    expect(screen.getByRole("document", { name: "Kept" }).textContent).toBe("three");
  });
});
