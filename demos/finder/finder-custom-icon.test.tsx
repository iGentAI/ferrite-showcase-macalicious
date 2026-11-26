import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDrive } from "../desktop/desktop-files";
import { ItemIcon } from "./finder-artwork";

const made = 1_700_000_000_000;
const folder = { kind: "folder", size: 0, version: 0, created_ms: made, modified_ms: made };

function serve(rev: number, entries: object[]) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const drive = {
    rev,
    usage: 5,
    quota: 1_000_000,
    piece_bytes: 1000,
    max_file_bytes: 1000,
    max_entries: 100,
    entries: [{ ...folder, id: "documents", name: "Documents" }, ...entries],
  };
  vi.stubGlobal("fetch", async (url: string) =>
    String(url).includes("/content/")
      ? new Response("12345", { status: 200 })
      : new Response(JSON.stringify(drive), { status: 200 }),
  );
}

const iconFile = {
  ...folder,
  id: "pasted",
  parent: "documents",
  kind: "file",
  name: ".icon-note",
  type: "image/png",
  size: 5,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a picture kept over an item's icon", () => {
  it("is drawn for that item alone, and gone once the drive no longer holds it", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:icon");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const { container } = render(
      <>
        <ItemIcon node={{ id: "note", name: "Note.txt", kind: "document" }} size={32} />
        <ItemIcon node={{ id: "other", name: "Other.txt", kind: "document" }} size={32} />
      </>,
    );
    expect(container.querySelector("image")).toBeNull();
    serve(2, [iconFile]);
    await loadDrive();
    await vi.waitFor(() => expect(container.querySelectorAll("image")).toHaveLength(1));
    expect(container.querySelector("image")).toHaveAttribute("href", "blob:icon");
    serve(3, []);
    await loadDrive();
    await vi.waitFor(() => expect(container.querySelector("image")).toBeNull());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:icon");
  });
});
