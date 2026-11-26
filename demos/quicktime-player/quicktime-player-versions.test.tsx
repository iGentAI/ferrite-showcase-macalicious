import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import {
  type QuickTimeDrive,
  type QuickTimeMovieFile,
  QuickTimePlayerApp,
} from "./quicktime-player-app";
import { replayMovie } from "./quicktime-player-replay";

vi.mock("./quicktime-player-replay", () => ({ replayMovie: vi.fn() }));

/*
 * File > Save over the movie's file, and File > Revert To, on a drive in memory that keeps versions
 * as the real one does; `replayMovie` stands in for the replay, and object URLs are strings, since
 * jsdom has none. e2e/versions-rest-batch10-journey.mjs drives the real drive.
 */

beforeEach(() => {
  let made = 0;
  Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:movie-${++made}`),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(320);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(180);
  vi.mocked(replayMovie).mockImplementation(
    async () => new Blob(["turned"], { type: "video/webm" }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function versionedDrive() {
  const files = new Map<string, QuickTimeMovieFile & { blob: Blob; version: number }>();
  const kept = new Map<number, Blob>();
  const saveOver = vi.fn<NonNullable<QuickTimeDrive["saveOver"]>>(async (id, blob, base) => {
    const file = files.get(id);
    if (!file || file.version !== base) throw new Error("it was changed elsewhere");
    kept.set(file.version, file.blob);
    file.blob = blob;
    file.version += 1;
    const { blob: _blob, ...entry } = file;
    return { ...entry };
  });
  const keep = vi.fn(async () => undefined);
  const restore = vi.fn(async (id: string, version: number) => {
    const file = files.get(id);
    const blob = kept.get(version);
    if (!file || !blob) throw new Error("no such version");
    kept.set(file.version, file.blob);
    file.blob = blob;
    file.version += 1;
  });
  const keepClips = vi.fn(async () => undefined);
  const drive: QuickTimeDrive = {
    movies: async () => [...files.values()],
    upload: async (file) => {
      const id = `f${files.size + 1}`;
      const entry = { id, name: file.name, size: file.size, type: file.type, version: 0 };
      files.set(id, { ...entry, blob: file });
      return entry;
    },
    read: async (id) => files.get(id)?.blob as Blob,
    readKept: async (id) => {
      const file = files.get(id);
      if (!file) throw new Error("no such file");
      return { blob: file.blob, version: file.version };
    },
    saveOver,
    keepClips,
    versions: {
      list: async () =>
        [...kept.keys()]
          .sort((a, b) => b - a)
          .map((version) => ({
            version,
            size: 1,
            type: "video/webm",
            modifiedMs: 1_700_000_000_000 + version,
            saved: true,
          })),
      restore,
      keep,
    },
  };
  return { drive, files, saveOver, keep, restore, keepClips };
}

function FileMenu() {
  const items = useDesktopAppMenuItems("quicktime-player", "File");
  return (
    <Menu>
      <MenuTrigger>Open File</MenuTrigger>
      <MenuPopup aria-label="File">{items}</MenuPopup>
    </Menu>
  );
}

const frame = () => document.querySelector(".mac-quicktime-player") as HTMLElement;
async function open(drive: QuickTimeDrive, name = "Holiday.webm", type = "video/webm") {
  render(
    <>
      <FileMenu />
      <QuickTimePlayerApp drive={drive} served={false} />
    </>,
  );
  await screen.findByText(/Movies is empty/);
  fireEvent.change(screen.getByLabelText("Movie from this computer"), {
    target: { files: [new File(["movie bytes"], name, { type })] },
  });
  const window = await screen.findByRole("region", { name });
  fireEvent.loadedMetadata(window.querySelector("video") as HTMLVideoElement);
}
const rotate = async (name: string) => {
  await act(async () => {
    fireEvent.keyDown(frame(), { key: "r", metaKey: true, shiftKey: true });
  });
  await screen.findByRole("region", { name: `${name} — Edited` });
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
};
const save = async () => {
  await act(async () => {
    fireEvent.keyDown(frame(), { key: "s", metaKey: true });
  });
};

describe("QuickTime Player's File > Save", () => {
  it("writes into the movie's file, from the version it read, and marks that version kept", async () => {
    const { drive, files, saveOver, keep } = versionedDrive();
    await open(drive);
    await rotate("Holiday.webm");
    await save();
    await screen.findByRole("region", { name: "Holiday.webm" });
    expect(saveOver.mock.calls[0]?.slice(0, 1)).toEqual(["f1"]);
    expect(saveOver.mock.calls[0]?.[2]).toBe(0);
    expect([...files.keys()]).toEqual(["f1"]);
    expect(await files.get("f1")?.blob.text()).toBe("turned");
    expect(keep).toHaveBeenCalledWith("f1", 1);
  });

  it("stays edited, saying why, when the file was saved over elsewhere", async () => {
    const { drive, files } = versionedDrive();
    await open(drive);
    await rotate("Holiday.webm");
    const file = files.get("f1");
    if (file) file.version = 7;
    await save();
    expect(await screen.findByText(/could not be saved: it was changed elsewhere/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Holiday.webm — Edited" })).toBeInTheDocument();
  });

  it("leaves a file of another format alone, and says where the edits went", async () => {
    const { drive, files, saveOver } = versionedDrive();
    await open(drive, "Harbour.mp4", "video/mp4");
    await rotate("Harbour.mp4");
    await save();
    await screen.findByRole("region", { name: "Harbour edited.webm" });
    expect(saveOver).not.toHaveBeenCalled();
    expect(await files.get("f1")?.blob.text()).toBe("movie bytes");
    expect(
      await screen.findByText(
        "“Harbour.mp4” stays as it was: edits are recorded in another format than its file, so they are saved as “Harbour edited.webm”.",
      ),
    ).toBeInTheDocument();
  });

  it("writes a new file with Save As…, under the name typed, leaving the original", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { drive, files, saveOver } = versionedDrive();
    await open(drive);
    await rotate("Holiday.webm");
    await user.click(screen.getByRole("button", { name: "Open File" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Save As…" }));
    const name = await screen.findByRole("textbox", { name: "Name of the new movie" });
    expect(name).toHaveValue("Holiday edited");
    fireEvent.change(name, { target: { value: "Harbour" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("region", { name: "Harbour.webm" });
    expect(saveOver).not.toHaveBeenCalled();
    expect(await files.get("f1")?.blob.text()).toBe("movie bytes");
    expect(await files.get("f2")?.blob.text()).toBe("turned");
  });
});

describe("QuickTime Player's File > Revert To", () => {
  const revertRow = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole("button", { name: "Open File" }));
    const trigger = await screen.findByRole("menuitem", { name: "Revert To" });
    return waitFor(() => {
      const found = screen.queryByRole("menuitem", { name });
      if (found) return found;
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "ArrowRight" });
      throw new Error(`no row named ${name}`);
    });
  };

  it("has no Previous Save until a save kept one", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { drive } = versionedDrive();
    await open(drive);
    const previous = await revertRow(user, "Previous Save");
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toHaveAttribute("title", "No earlier save of this movie is kept.");
  });

  it("dims Browse All Versions over unsaved changes, saying so", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { drive } = versionedDrive();
    await open(drive);
    await rotate("Holiday.webm");
    const browse = await revertRow(user, "Browse All Versions…");
    expect(browse).toHaveAttribute("aria-disabled", "true");
    expect(browse).toHaveAttribute(
      "title",
      "Save this movie’s changes, or revert them, to see its versions.",
    );
  });

  it("goes back with Previous Save: the file holds the old bytes, without its splits", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { drive, files, restore, keepClips } = versionedDrive();
    await open(drive);
    await rotate("Holiday.webm");
    await save();
    await screen.findByRole("region", { name: "Holiday.webm" });
    const previous = await revertRow(user, "Previous Save");
    await waitFor(() => expect(previous).not.toHaveAttribute("aria-disabled", "true"));
    fireEvent.click(previous);
    await waitFor(() => expect(restore).toHaveBeenCalledWith("f1", 0, 1));
    await waitFor(async () => expect(await files.get("f1")?.blob.text()).toBe("movie bytes"));
    await waitFor(() => expect(keepClips).toHaveBeenLastCalledWith("f1", []));
    expect(files.get("f1")?.version).toBe(2);
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
  });
});
