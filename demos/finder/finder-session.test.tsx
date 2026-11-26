import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDrive } from "../desktop/desktop-files";
import { setDesktopSession } from "../desktop/desktop-server";
import { Finder } from "./finder";
import { DriveSavePanel, saveToDrive } from "./finder-file-dialogs";
import { runNewFolderWithItems, runUndoable } from "./finder-undo";

const folders = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"].map(
  (name) => ({
    id: name.toLowerCase(),
    name,
    kind: "folder",
    size: 0,
    created_ms: 1,
    modified_ms: 1,
  }),
);
const drive = {
  rev: 1,
  entries: folders,
  usage: 0,
  quota: 1_000,
  piece_bytes: 100,
  max_file_bytes: 1_000,
  max_entries: 100,
  session: "first-person",
};

let writes: string[];

beforeEach(async () => {
  writes = [];
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (init.method && init.method !== "GET") {
      writes.push(`${init.method} ${String(input)}`);
      return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
    }
    return new Response(JSON.stringify(drive), { status: 200 });
  });
  setDesktopSession("first-person");
  await loadDrive();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a change begun before someone else signs in", () => {
  it("goes out from a Finder window for the person it opened for", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await user.click(await screen.findByRole("treeitem", { name: "Documents" }));
    setDesktopSession("next-person");
    await user.click(screen.getByRole("button", { name: "Action" }));
    await user.click(await screen.findByRole("menuitem", { name: "New Folder" }));
    await waitFor(() =>
      expect(writes).toEqual(["POST /api/files/ops?desktop_session=first-person"]),
    );
  });

  it("is written from the Save dialog for the person it opened for", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<DriveSavePanel defaultName="Report.txt" onSave={onSave} onCancel={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    setDesktopSession("next-person");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({
      folder: "documents",
      name: "Report.txt",
      session: "first-person",
    });
    await expect(saveToDrive(onSave.mock.calls[0]?.[0], new Blob(["a"]))).rejects.toMatchObject({
      status: 409,
    });
    expect(writes).toEqual(["POST /api/files/uploads?desktop_session=first-person"]);
  });

  it("keeps Undo's step, and each step of New Folder with Selection, to the person who asked", async () => {
    const change = runUndoable("New Folder", [{ op: "mkdir", parent: "documents", name: "A" }]);
    const together = runNewFolderWithItems("documents", "B", []);
    setDesktopSession("next-person");
    await expect(change).rejects.toMatchObject({ status: 409 });
    await expect(together).rejects.toMatchObject({ status: 409 });
    expect(writes).toEqual([
      "POST /api/files/ops?desktop_session=first-person",
      "POST /api/files/ops?desktop_session=first-person",
    ]);
  });
});
