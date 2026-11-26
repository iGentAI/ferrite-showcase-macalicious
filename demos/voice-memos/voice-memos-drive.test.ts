import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Drive,
  type DriveEntry,
  DriveError,
  ensureFolder,
  loadDrive,
  SPECIAL_FOLDER_IDS,
  uploadFile,
} from "../desktop/desktop-files";
import { setDesktopSession } from "../desktop/desktop-server";
import { deletedOf, desktopDrive } from "./voice-memos-drive";

vi.mock("../desktop/desktop-files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../desktop/desktop-files")>()),
  ensureFolder: vi.fn(async () => ({ id: "folder" })),
  loadDrive: vi.fn(),
  uploadFile: vi.fn(),
}));

afterEach(() => {
  setDesktopSession(null);
  vi.clearAllMocks();
});

describe("Recently Deleted", () => {
  const entry = (id: string, parent: string, more: Partial<DriveEntry> = {}): DriveEntry => ({
    id,
    parent,
    name: `${id}.wav`,
    kind: "file",
    size: 1,
    created_ms: 1,
    modified_ms: 1,
    ...more,
  });
  const driveOf = (entries: DriveEntry[]) => ({ entries }) as unknown as Drive;
  const folder = entry("memos", SPECIAL_FOLDER_IDS.Music, { name: "Voice Memos", kind: "folder" });

  it("lists the recordings in the Trash from Voice Memos' folder, the last deleted first", () => {
    const list = deletedOf(
      driveOf([
        folder,
        entry("older", "memos", { trashed_ms: 10 }),
        entry("newer", "memos", { trashed_ms: 20 }),
        entry("kept", "memos"),
        entry("elsewhere", SPECIAL_FOLDER_IDS.Music, { trashed_ms: 30 }),
        entry("notes", "memos", { name: "notes.txt", trashed_ms: 40 }),
      ]),
    );
    expect(list.map((memo) => [memo.id, memo.deleted])).toEqual([
      ["newer", 20],
      ["older", 10],
    ]);
  });

  it("lists nothing on a drive with no Voice Memos folder", () => {
    expect(deletedOf(driveOf([entry("loose", "memos", { trashed_ms: 10 })]))).toEqual([]);
  });
});

describe("saving to the drive", () => {
  it("does not compare a refused take with the drive of someone who has signed in since", async () => {
    vi.mocked(uploadFile).mockRejectedValue(new DriveError(409, "Refused."));
    setDesktopSession("session-b");
    await expect(
      desktopDrive.save(new Blob(["take"]), "Take.webm", undefined, "session-a"),
    ).rejects.toThrow("Refused.");
    expect(vi.mocked(uploadFile).mock.calls[0]?.[2]).toMatchObject({ session: "session-a" });
    expect(vi.mocked(ensureFolder).mock.calls[0]?.[2]).toBe("session-a");
    expect(loadDrive).not.toHaveBeenCalled();
  });
});
