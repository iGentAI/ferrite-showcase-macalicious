import { beforeEach, describe, expect, it, vi } from "vitest";
import { runOps, uploadFile } from "../desktop/desktop-files";
import { desktopPreviewDrive } from "./preview-drive";

vi.mock("../desktop/desktop-files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../desktop/desktop-files")>()),
  uploadFile: vi.fn(async () => ({ id: "new", name: "a.png" })),
  runOps: vi.fn(async () => ({ entries: [{ id: "f1", name: "b.png" }], created: ["f1"] })),
}));

const entry = { id: "f1", name: "a.png", parent: "pictures" } as never;
const blob = new Blob(["png"]);

beforeEach(() => {
  vi.mocked(uploadFile).mockClear();
  vi.mocked(runOps).mockClear();
});

describe("A Preview window's saves", () => {
  it("name the session the window opened in, in every kind of write", async () => {
    const drive = desktopPreviewDrive("session-a");
    await drive.replace(entry, blob);
    await drive.save({ folder: "pictures", name: "b.png" }, blob);
    await drive.create("pictures", "c.png", blob);
    for (const [, , options] of vi.mocked(uploadFile).mock.calls) {
      expect(options?.session).toBe("session-a");
    }
    expect(vi.mocked(uploadFile)).toHaveBeenCalledTimes(3);
    await drive.rename(entry, "b.png");
    await drive.move(entry, "elsewhere");
    await drive.duplicate(entry, "b.png");
    expect(vi.mocked(runOps).mock.calls.map((call) => call[2])).toEqual([
      "session-a",
      "session-a",
      "session-a",
    ]);
  });

  it("leave it to the request where the page had no session yet", async () => {
    await desktopPreviewDrive().rename(entry, "b.png");
    expect(vi.mocked(runOps).mock.calls[0]?.[2]).toBeUndefined();
  });
});
