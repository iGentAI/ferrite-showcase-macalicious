import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import { storageManagementApp } from "./app";
import { categorySize, usedSize } from "./storage-management-data";
import {
  APP_DATA_ID,
  APPLICATIONS_ID,
  DesktopStorageManagement,
  FILE_BROWSER_ID,
  LARGE_FILES_ID,
  UNSUPPORTED_APPS_ID,
  usageFromServer,
  usageProps,
} from "./storage-management-desktop";

beforeEach(beginDesktopValues);

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const vault = {
  key: "vault",
  name: "Encrypted Keychain",
  bytes: 1_500,
  rev: 2,
  forget: "/api/keychain-access/vault",
};

const MB = 1_000_000;
const drive = (trashed = true) => ({
  quota: 134_217_728,
  used: 9 * MB + 2_000 + (trashed ? 500 : 0),
  freeing: 0,
  available: 134_217_728 - (9 * MB + 2_000 + (trashed ? 500 : 0)),
  categories: [
    { id: "documents", name: "Documents", bytes: 2_000, files: 1 },
    { id: "photos", name: "Photos", bytes: 9 * MB, files: 1 },
    { id: "music", name: "Music", bytes: 0, files: 0 },
    { id: "movies", name: "Movies", bytes: 0, files: 0 },
    { id: "other", name: "Other Files", bytes: 0, files: 0 },
    { id: "trash", name: "Trash", bytes: trashed ? 500 : 0, files: trashed ? 1 : 0 },
  ],
  trash: { bytes: trashed ? 500 : 0, items: trashed ? 1 : 0 },
  files: [
    {
      id: "p1",
      name: "Beach.jpg",
      size: 9 * MB,
      type: "image/jpeg",
      kind: "photos",
      folder: "Pictures",
      modified_ms: Date.UTC(2026, 9, 1),
      trashed: false,
    },
    {
      id: "d1",
      name: "Plan.txt",
      size: 2_000,
      type: "text/plain",
      kind: "documents",
      folder: "Documents",
      modified_ms: Date.UTC(2026, 9, 2),
      opened_ms: Date.UTC(2026, 9, 3),
      trashed: false,
    },
    ...(trashed
      ? [
          {
            id: "t1",
            name: "Old.txt",
            size: 500,
            type: "text/plain",
            kind: "trash",
            folder: "Documents",
            modified_ms: 1,
            trashed: true,
          },
        ]
      : []),
  ],
});

const reply = (documents: unknown[] = [vault], withDrive: unknown = drive()) => ({
  apps: [
    {
      name: "calculator",
      title: "Calculator",
      bytes: 300,
      keys: 4,
      truncated: false,
      documents: [],
    },
    {
      name: "keychain-access",
      title: "Keychain Access",
      bytes: 1_500,
      keys: 1,
      truncated: false,
      documents,
    },
    { name: "notes", title: "Notes", bytes: 0, keys: 0, truncated: false, documents: [] },
  ],
  bytes: 1_800,
  keys: 5,
  truncated: false,
  drive: withDrive,
  now_ms: 1,
});

/** A server that answers the usage with each of `replies` in turn, and any change with `status`. */
function serve(replies: unknown[], status = 200) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  let reads = 0;
  const fetch = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === "DELETE" || init?.method === "POST"
      ? {
          ok: status < 400,
          status,
          json: async () =>
            url.startsWith("/api/files/") ? { entries: [], usage: 0, quota: 134_217_728 } : {},
        }
      : { ok: true, status: 200, json: async () => replies[Math.min(reads++, replies.length - 1)] },
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const sidebar = () => screen.getByRole("tree", { name: "Categories" });
const usageReads = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls.filter(
    ([url, init]) => String(url).startsWith("/api/storage-management/") && !init?.method,
  );

/**
 * A server that keeps the drive and the keychain: a change through the drive's or Keychain
 * Access's own route changes what the next usage read reports, as the modules do.
 */
function stateful() {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const state = { drive: drive(true), documents: [vault] as unknown[] };
  const answer = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" && url.startsWith("/api/files/ops")) {
      const { ops } = JSON.parse(String(init.body)) as { ops: { op: string; id?: string }[] };
      for (const op of ops) {
        const gone = state.drive.files.filter((file) =>
          op.op === "empty-trash" ? file.trashed : file.id === op.id,
        );
        state.drive.files = state.drive.files.filter((file) => !gone.includes(file));
        for (const file of gone) {
          const category = state.drive.categories.find((c) => c.id === file.kind);
          if (category) {
            category.bytes -= file.size;
            category.files -= 1;
          }
          state.drive.used -= file.size;
          state.drive.available += file.size;
          if (file.trashed) {
            state.drive.trash.bytes -= file.size;
            state.drive.trash.items -= 1;
          }
        }
      }
      return answer({ entries: [], usage: state.drive.used, quota: state.drive.quota });
    }
    if (init?.method === "DELETE" && url.startsWith("/api/keychain-access/vault")) {
      state.documents = [];
      return answer({ vault: null, rev: 3 });
    }
    return answer(reply(state.documents, state.drive));
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, state };
}

describe("Storage Management on the desktop's Ferrite application", () => {
  it("reads only a usage report in the module's shape", () => {
    const usage = usageFromServer(reply());
    expect(usage?.apps.map((app) => app.name)).toEqual(["calculator", "keychain-access", "notes"]);
    expect(usage?.drive?.files.map((file) => file.id)).toEqual(["p1", "d1", "t1"]);
    expect(usage?.drive?.trash).toEqual({ bytes: 500, items: 1 });
    expect(usageFromServer({ apps: "none", bytes: 0, keys: 0 })).toBeUndefined();
    // A route that is not the document's own module's is never taken.
    expect(usageFromServer(reply([{ ...vault, forget: "/api/notes/library" }]))).toBeUndefined();
    expect(usageFromServer(reply([{ ...vault, forget: "https://elsewhere/" }]))).toBeUndefined();
    // A server without the drive report still shows its app data.
    expect(usageFromServer(reply([vault], null))?.drive).toBeUndefined();
  });

  it("shows the drive against its quota by kind, Large Files, the Trash and App Data", () => {
    const props = usageProps(usageFromServer(reply()), false);
    expect(props.title).toBeUndefined();
    expect([props.diskName, props.capacity, props.available]).toEqual([
      "Ferrite Drive",
      134_217_728,
      134_217_728 - (9 * MB + 2_500),
    ]);
    expect(props.categories?.map((category) => [category.id, category.size])).toEqual([
      ["documents", 2_000],
      ["photos", 9 * MB],
      ["trash", 500],
      [LARGE_FILES_ID, 9 * MB],
      [FILE_BROWSER_ID, 9 * MB + 2_000],
      [APP_DATA_ID, 1_800],
      [APPLICATIONS_ID, 1_800],
      ["kept-by:keychain-access", 1_500],
      ["kept-by:calculator", 300],
      [UNSUPPORTED_APPS_ID, 0],
    ]);
    // An app whose document can be forgotten offers it, and one that keeps no such document only counts.
    expect(props.categories?.find((c) => c.id === "kept-by:keychain-access")).toMatchObject({
      name: "Kept by Keychain Access",
      readOnly: false,
      files: [{ id: "keychain-access/vault@2", name: "Encrypted Keychain", size: 1_500 }],
    });
    expect(props.categories?.find((c) => c.id === "kept-by:calculator")).toMatchObject({
      name: "Kept by Calculator",
      readOnly: true,
      files: [{ name: "Everything Calculator keeps", kind: "4 items", size: 300 }],
    });
    expect(props.categories?.find((c) => c.id === UNSUPPORTED_APPS_ID)).toMatchObject({
      selectable: false,
      description: "A browser runs no Mac applications, so none can be unsupported here.",
    });
    expect(
      props.categories?.find((c) => c.id === FILE_BROWSER_ID)?.files?.map((file) => file.name),
    ).toEqual(["Beach.jpg — Pictures", "Plan.txt — Documents"]);
    expect(props.categories?.[0]?.files).toEqual([
      {
        id: "drive:d1",
        name: "Plan.txt — Documents",
        kind: "Document",
        lastAccessed: "2026-10-03",
        size: 2_000,
      },
    ]);
    expect(props.categories?.find((c) => c.id === APP_DATA_ID)?.files).toEqual([
      {
        id: "keychain-access/vault@2",
        name: "Encrypted Keychain",
        kind: "Keychain Access",
        lastAccessed: "",
        size: 1_500,
      },
    ]);
    expect(props.recommendations?.map((r) => [r.id, r.title, r.reviews])).toEqual([
      ["icloud", "Store in iCloud", undefined],
      ["optimize", "Optimize Storage", undefined],
      ["auto-trash", "Empty Trash Automatically", undefined],
      ["trash", "Empty Trash", undefined],
      ["large", "Review Large Files", LARGE_FILES_ID],
      ["clutter", "Reduce Clutter", "photos"],
    ]);
    expect(props.recommendations?.slice(0, 2).map((r) => r.action)).toEqual([undefined, undefined]);
    expect(props.recommendations?.[2]?.action).toBe("Turn On…");
    expect(
      usageProps(usageFromServer(reply([vault], drive())), false, true).recommendations?.[2]
        ?.action,
    ).toBe("Turn Off");
    const empty = usageProps(usageFromServer(reply([], drive(false))), false);
    expect(empty.recommendations?.map((r) => r.id)).toEqual([
      "icloud",
      "optimize",
      "auto-trash",
      "large",
      "clutter",
    ]);
    expect(usageProps(undefined, true).title).toMatch(/not available$/);
    // Large Files gathers files the drive's categories count, and App Data is outside the
    // quota: neither adds to the space used.
    expect(props.categories?.filter((c) => c.onDisk === false).map((c) => c.id)).toEqual([
      LARGE_FILES_ID,
      FILE_BROWSER_ID,
      APP_DATA_ID,
      APPLICATIONS_ID,
      "kept-by:keychain-access",
      "kept-by:calculator",
      UNSUPPORTED_APPS_ID,
    ]);
    expect(usedSize(props.categories ?? [])).toBe(9 * MB + 2_500);
  });

  it("counts a content shared by two copies once, as the drive's quota does", () => {
    const copies = drive(false);
    copies.files.push({ ...copies.files[0], id: "p2", name: "Beach copy.jpg" } as never);
    const photos = usageProps(usageFromServer(reply([], copies)), false).categories?.find(
      (c) => c.id === "photos",
    );
    expect(photos?.files).toHaveLength(2);
    expect(photos && categorySize(photos)).toBe(9 * MB);
  });

  it("shows no day for a time a date cannot hold, rather than failing", () => {
    const far = drive(false);
    far.files[0] = { ...far.files[0], modified_ms: 9e15, opened_ms: 9e15 } as never;
    const photos = usageProps(usageFromServer(reply([], far)), false).categories?.find(
      (c) => c.id === "photos",
    );
    expect(photos?.files?.[0]?.lastAccessed).toBe("");
  });

  it("shows the captured Mac and asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopStorageManagement />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/Macintosh SSD/)).toBeInTheDocument();
    expect(storageManagementApp.component).toBe(DesktopStorageManagement);
  });

  it("titles the window with the drive's free space and empties the Trash through the drive", async () => {
    const user = userEvent.setup();
    const { fetch, state } = stateful();
    render(<DesktopStorageManagement />);
    await screen.findByText(/^Ferrite Drive - 125\.2 MB available of 134\.2 MB$/);
    expect(within(sidebar()).getByRole("treeitem", { name: /^Trash/ })).toHaveTextContent(
      "500 bytes",
    );
    await user.click(screen.getByRole("button", { name: "Empty Trash" }));
    const question = await screen.findByRole("alertdialog");
    expect(question).toHaveTextContent("permanently erase the items in the Trash");
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/files\/ops/),
      expect.anything(),
    );
    await user.click(within(question).getByRole("button", { name: "Empty Trash" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/files\/ops/),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ ops: [{ op: "empty-trash" }] }),
        }),
      ),
    );
    // The report read again shows the Trash empty, and lists nothing in it.
    await waitFor(() =>
      expect(within(sidebar()).getByRole("treeitem", { name: /^Trash/ })).toHaveTextContent(
        "Zero KB",
      ),
    );
    expect(state.drive.trash.items).toBe(0);
    await user.click(within(sidebar()).getByRole("treeitem", { name: /^Trash/ }));
    expect(await screen.findByText("No Files")).toBeInTheDocument();
  });

  it("erases a drive file through the drive's own route, then shows the space it gave back", async () => {
    const user = userEvent.setup();
    const { fetch } = stateful();
    render(<DesktopStorageManagement />);
    await screen.findByText(/^Ferrite Drive - 125\.2 MB available of 134\.2 MB$/);
    await user.click(within(sidebar()).getByRole("treeitem", { name: /^Large Files/ }));
    await user.click(screen.getByText("Beach.jpg — Pictures"));
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/files\/ops/),
        expect.objectContaining({ body: JSON.stringify({ ops: [{ op: "delete", id: "p1" }] }) }),
      ),
    );
    // The report read again: the free space grows by the file, which is listed nowhere now.
    await screen.findByText(/^Ferrite Drive - 134\.2 MB available of 134\.2 MB$/);
    expect(screen.queryByText("Beach.jpg — Pictures")).toBeNull();
    expect(within(sidebar()).queryByRole("treeitem", { name: /^Large Files/ })).toBeNull();
    expect(within(sidebar()).queryByRole("treeitem", { name: /^Photos/ })).toBeNull();
  });

  it("forgets an app's document through its own route, and lists it no more", async () => {
    const user = userEvent.setup();
    const { fetch } = stateful();
    render(<DesktopStorageManagement />);
    await screen.findByText(/^Ferrite Drive - /);
    await user.click(within(sidebar()).getByRole("treeitem", { name: /^App Data/ }));
    const table = screen.getByRole("grid", { name: "App Data files" });
    await user.click(within(table).getByText("Encrypted Keychain"));
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/keychain-access\/vault/),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() => expect(usageReads(fetch)).toHaveLength(2));
    // The report read again lists no document of App Data.
    expect(await screen.findByText("No Files")).toBeInTheDocument();
    expect(screen.queryByText("Encrypted Keychain")).toBeNull();
  });

  it("brings a document back when forgetting it fails", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    serve([reply()], 503);
    render(<DesktopStorageManagement />);
    await screen.findByText(/^Ferrite Drive - /);
    await user.click(within(sidebar()).getByRole("treeitem", { name: /^App Data/ }));
    await user.click(screen.getByText("Encrypted Keychain"));
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(warn).toHaveBeenCalled());
    await user.click(within(sidebar()).getByRole("treeitem", { name: /^App Data/ }));
    expect(await screen.findByText("Encrypted Keychain")).toBeInTheDocument();
  });

  it("erases nothing until the person confirms, and keeps the file when they cancel", async () => {
    const user = userEvent.setup();
    const { fetch } = stateful();
    render(<DesktopStorageManagement />);
    await screen.findByText(/^Ferrite Drive - 125\.2 MB available of 134\.2 MB$/);
    await user.click(within(sidebar()).getByRole("treeitem", { name: /^Large Files/ }));
    await user.click(screen.getByText("Beach.jpg — Pictures"));
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    const question = await screen.findByRole("alertdialog");
    expect(question).toHaveTextContent("Are you sure you want to delete “Beach.jpg”?");
    await user.click(within(question).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(within(sidebar()).getByRole("treeitem", { name: /^Large Files/ }));
    expect(await screen.findByText("Beach.jpg — Pictures")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/files\/ops/),
      expect.anything(),
    );
  });

  it("turns on Finder's 30-day rule only after the person confirms, and off again at once", async () => {
    const user = userEvent.setup();
    stateful();
    render(<DesktopStorageManagement />);
    await screen.findByText(/^Ferrite Drive - 125\.2 MB available of 134\.2 MB$/);
    await user.click(screen.getByRole("button", { name: "Turn On…" }));
    const question = await screen.findByRole("alertdialog");
    expect(question).toHaveTextContent("erase items in the Trash automatically");
    await user.click(within(question).getByRole("button", { name: "Turn On" }));
    expect(await screen.findByRole("button", { name: "Turn Off" })).toBeInTheDocument();
    expect(screen.getByText(/^On: Finder erases/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Turn Off" }));
    expect(await screen.findByRole("button", { name: "Turn On…" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps the row and the order chosen for the next time the window opens", async () => {
    const user = userEvent.setup();
    stateful();
    const first = render(<DesktopStorageManagement />);
    await user.click(await within(sidebar()).findByRole("treeitem", { name: /^Photos/ }));
    await user.click(screen.getByRole("button", { name: "Name" }));
    first.unmount();
    render(<DesktopStorageManagement />);
    expect(await within(sidebar()).findByRole("treeitem", { name: /^Photos/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("lists Applications to read only: nothing there can be deleted or shown", async () => {
    const user = userEvent.setup();
    stateful();
    render(<DesktopStorageManagement />);
    await user.click(await within(sidebar()).findByRole("treeitem", { name: /^Applications/ }));
    expect(screen.getByRole("gridcell", { name: "Keychain Access" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show in Finder" })).toBeNull();
  });

  it("keeps Empty Trash on offer when the person cancels it", async () => {
    const user = userEvent.setup();
    const { fetch } = stateful();
    render(<DesktopStorageManagement />);
    await screen.findByText(/^Ferrite Drive - 125\.2 MB available of 134\.2 MB$/);
    await user.click(screen.getByRole("button", { name: "Empty Trash" }));
    const question = await screen.findByRole("alertdialog");
    await user.click(within(question).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(await screen.findByRole("button", { name: "Empty Trash" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/files\/ops/),
      expect.anything(),
    );
  });
});
