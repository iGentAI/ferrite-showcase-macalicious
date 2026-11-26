import { beforeEach, describe, expect, it, vi } from "vitest";
import { picturesFolder, uploadToDrive } from "./photos-drive";

const ensureFolder = vi.hoisted(() => vi.fn(async () => ({ id: "made" })));
const uploadFile = vi.hoisted(() => vi.fn(async () => ({ id: "file-1" })));
vi.mock("../desktop/desktop-files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../desktop/desktop-files")>()),
  ensureFolder,
  uploadFile,
}));

beforeEach(() => vi.clearAllMocks());

describe("Photos' steps on the drive name one session", () => {
  it("makes the folder and uploads for the session the task began with", async () => {
    expect(await picturesFolder("Trip", "ann")).toBe("made");
    expect(ensureFolder).toHaveBeenCalledWith("pictures", "Trip", "ann");
    const blob = new Blob(["x"]);
    expect(await uploadToDrive("made", "a.jpg", blob, "ann")).toBe("file-1");
    expect(uploadFile).toHaveBeenCalledWith(blob, "made", {
      name: "a.jpg",
      existing: "rename",
      session: "ann",
    });
  });

  it("needs no folder for Pictures itself", async () => {
    expect(await picturesFolder()).toBe("pictures");
    expect(ensureFolder).not.toHaveBeenCalled();
  });
});
