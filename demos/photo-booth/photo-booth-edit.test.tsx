import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import {
  clearCopiedDriveItems,
  copiedDriveItems,
  copyDriveItems,
} from "../desktop/desktop-clipboard";
import { flipEdit, NO_EDIT } from "../photos/photos-edit";
import type { LibraryPhoto } from "../photos/photos-library";
import * as library from "../photos/photos-library";
import { DesktopPhotoBooth } from "./photo-booth-desktop";

/*
 * The Edit rows against a stand-in for the Photos library client (tested in
 * photos-library.test.ts) and, for the browser's clipboard, a fake `navigator.clipboard`, since
 * jsdom has none. The journey photo-booth-rows-journey.mjs runs them against the real ones.
 */
vi.mock("../photos/photos-library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../photos/photos-library")>();
  return {
    ...actual,
    loadLibrary: vi.fn(),
    readThumbs: vi.fn(),
    importPicture: vi.fn(),
    changePhoto: vi.fn(),
    readOriginal: vi.fn(),
    decodePicture: vi.fn(),
  };
});

const mocked = vi.mocked(library);

const photo = (id: string, more: Partial<LibraryPhoto> = {}): LibraryPhoto => ({
  id,
  file: `f-${id}`,
  name: id,
  mime: "image/jpeg",
  bytes: 4,
  width: 640,
  height: 480,
  taken_ms: 1,
  added_ms: 1,
  source: "photo-booth",
  effect: "normal",
  camera: null,
  favorite: false,
  deleted_ms: null,
  edit: null,
  edited_ms: null,
  title: null,
  caption: null,
  keywords: [],
  people: [],
  location: null,
  hidden: false,
  exif: null,
  duration_ms: null,
  ...more,
});

function serve(photos: LibraryPhoto[]) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const kept = photos;
  mocked.loadLibrary.mockImplementation(async () => ({
    photos: [...kept],
    albums: [],
    purge: [],
    folders: [],
    smart_albums: [],
    keywords: [],
    projects: [],
    memories: { favorites: [], deleted: [], albums: [] },
    settings: {},
    limits: { photos: 1000, recently_deleted_days: 30 },
  }));
  mocked.readThumbs.mockImplementation(
    async (ids) => new Map(ids.map((id) => [id, new Blob(["jpeg"], { type: "image/jpeg" })])),
  );
  mocked.readOriginal.mockImplementation(async () => new Blob(["jpeg"], { type: "image/jpeg" }));
  mocked.changePhoto.mockImplementation(async (id, change) => {
    const at = kept.findIndex((each) => each.id === id);
    const changed = photo(id, {
      ...kept[at],
      deleted_ms: change.deleted ? 2 : null,
      ...("edit" in change ? { edit: change.edit ?? null } : {}),
    });
    if (at >= 0) kept[at] = changed;
    return changed;
  });
  mocked.importPicture.mockImplementation(async (_blob, options) => {
    const added = photo(options.id ?? "x", { effect: options.effect ?? null, taken_ms: 9 });
    kept.push(added);
    return added;
  });
  return kept;
}

function Edit() {
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title="Edit">{useDesktopAppMenuItems("photo-booth", "Edit")}</MenuBarMenu>
    </MenuBar>
  );
}

const strip = () =>
  [...(screen.queryByRole("list", { name: "Photos" })?.querySelectorAll("button") ?? [])].map(
    (thumb) => thumb.getAttribute("data-picture-id"),
  );

async function open(photos: LibraryPhoto[], clipboard?: unknown) {
  const kept = serve(photos);
  const user = userEvent.setup();
  // A working camera: the window's words about a missing one would stand in for every other notice.
  const stream = { getTracks: () => [], getVideoTracks: () => [] } as unknown as MediaStream;
  vi.stubGlobal("navigator", {
    ...navigator,
    clipboard,
    mediaDevices: { getUserMedia: async () => stream, enumerateDevices: async () => [] },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  render(
    <>
      <Edit />
      <DesktopPhotoBooth defaultView="camera" />
    </>,
  );
  await waitFor(() => expect(strip()).toEqual(photos.map((each) => each.id)));
  await waitFor(() => expect(document.querySelector(".mac-photo-booth-notice")).toBeNull());
  return { kept, user };
}

const row = (name: string) => screen.findByRole("menuitem", { name });

async function choose(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("menuitem", { name: "Edit" }));
  await user.click(await row(name));
}

beforeEach(() => {
  for (const double of [
    mocked.loadLibrary,
    mocked.readThumbs,
    mocked.importPicture,
    mocked.changePhoto,
    mocked.readOriginal,
    mocked.decodePicture,
  ]) {
    double.mockReset();
  }
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:photo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  clearCopiedDriveItems();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Undo and Redo", () => {
  it("take back and bring back a delete of several pictures as one step", async () => {
    const { kept, user } = await open([
      photo("a"),
      photo("b", { taken_ms: 2 }),
      photo("c", { taken_ms: 3 }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Photo 1, Normal" }), { metaKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Photo 2, Normal" }), { metaKey: true });
    await choose(user, "Delete");
    await waitFor(() => expect(strip()).toEqual(["c"]));
    expect(kept.filter((each) => each.deleted_ms !== null).map((each) => each.id)).toEqual([
      "a",
      "b",
    ]);

    await choose(user, "Undo Delete");
    await waitFor(() => expect(strip()).toEqual(["a", "b", "c"]));
    expect(mocked.changePhoto).toHaveBeenCalledWith("a", { deleted: false });
    expect(mocked.changePhoto).toHaveBeenCalledWith("b", { deleted: false });

    await choose(user, "Redo Delete");
    await waitFor(() => expect(strip()).toEqual(["c"]));
  });

  it("keeps a step that failed for another try, and drops one whose picture has gone", async () => {
    const { user } = await open([photo("a")]);
    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    await choose(user, "Delete");
    await waitFor(() => expect(strip()).toEqual([]));

    mocked.changePhoto.mockRejectedValueOnce(new library.LibraryError("no answer", 503));
    await choose(user, "Undo Delete");
    expect(await screen.findByText("Delete could not be undone: no answer.")).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Delete")).not.toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");

    mocked.changePhoto.mockRejectedValueOnce(new library.LibraryError("gone", 404));
    await choose(user, "Undo Delete");
    expect(await screen.findByText("Delete could not be undone: gone.")).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo")).toHaveAttribute("aria-disabled", "true");
  });

  it("brings back the rest of a batch when one of its pictures has gone, and says so", async () => {
    const { user } = await open([photo("a"), photo("b")]);
    fireEvent.click(screen.getByRole("button", { name: "Photo 1, Normal" }), { metaKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Photo 2, Normal" }), { metaKey: true });
    await choose(user, "Delete");
    await waitFor(() => expect(strip()).toEqual([]));

    mocked.changePhoto.mockClear();
    mocked.changePhoto.mockRejectedValueOnce(new library.LibraryError("gone", 404));
    await choose(user, "Undo Delete");
    expect(await screen.findByText("One of those pictures is gone.")).toBeTruthy();
    expect(mocked.changePhoto.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Redo Delete")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("dims Undo while a Delete or a Paste is being stored, until it can take that one back", async () => {
    const { user } = await open([photo("a"), photo("b", { taken_ms: 2 })]);
    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    await choose(user, "Delete");
    await waitFor(() => expect(strip()).toEqual(["b"]));

    let answer = () => {};
    const changing = mocked.changePhoto.getMockImplementation();
    mocked.changePhoto.mockImplementationOnce(
      (id, change) =>
        new Promise((resolve, reject) => {
          answer = () => changing?.(id, change).then(resolve, reject);
        }),
    );
    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    await choose(user, "Delete");
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Delete")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await act(async () => answer());
    await waitFor(() => expect(strip()).toEqual([]));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Delete")).not.toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");

    let stored = () => {};
    const importing = mocked.importPicture.getMockImplementation();
    mocked.importPicture.mockImplementationOnce(
      (blob, options) =>
        new Promise((resolve, reject) => {
          stored = () => importing?.(blob, options).then(resolve, reject);
        }),
    );
    const event = new Event("paste", { bubbles: true }) as Event & {
      clipboardData: { files: File[]; getData: () => string };
    };
    event.clipboardData = {
      files: [new File(["png"], "image.png", { type: "image/png" })],
      getData: () => "",
    };
    await act(async () => {
      document.body.dispatchEvent(event);
    });
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Delete")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await act(async () => stored());
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Paste")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("holds Undo from the moment Paste begins reading, and lets nothing store meanwhile", async () => {
    let read: (items: unknown[]) => void = () => {};
    const { user } = await open([photo("a")], {
      read: () => new Promise((resolve) => (read = resolve)),
    });
    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    await choose(user, "Delete");
    await waitFor(() => expect(strip()).toEqual([]));

    await choose(user, "Paste");
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Delete")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await act(async () => read([]));
    expect(await screen.findByText("The clipboard holds no picture to paste.")).toBeTruthy();

    let bytes: (blob: Blob) => void = () => {};
    copyDriveItems([
      {
        id: "f-x",
        name: "x.jpg",
        kind: "file",
        type: "image/jpeg",
        bytes: () => new Promise((resolve) => (bytes = resolve)),
      },
    ]);
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    await choose(user, "Paste");
    await waitFor(() => expect(bytes).not.toBe(undefined));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Delete")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await act(async () => bytes(new Blob(["jpeg"], { type: "image/jpeg" })));
    await waitFor(() => expect(mocked.importPicture).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Paste")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("refuses a Delete while a Flip is being stored, so Undo finds the picture as it was", async () => {
    const flipped = flipEdit(NO_EDIT);
    const { kept, user } = await open([photo("a", { edit: flipped })]);
    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));

    let answer = () => {};
    const changing = mocked.changePhoto.getMockImplementation();
    mocked.changePhoto.mockImplementationOnce(
      (id, change) =>
        new Promise((resolve, reject) => {
          answer = () => changing?.(id, change).then(resolve, reject);
        }),
    );
    await choose(user, "Flip Photo");
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledTimes(1));
    await choose(user, "Delete");
    expect(await screen.findByText("Wait for the last change to finish first.")).toBeTruthy();
    await act(async () => answer());
    await waitFor(() => expect(kept[0]?.edit).toBeNull());
    expect(kept[0]?.deleted_ms).toBeNull();

    await choose(user, "Delete");
    await waitFor(() => expect(kept[0]?.deleted_ms).not.toBeNull());
    await choose(user, "Undo Delete");
    await waitFor(() => expect(kept[0]?.deleted_ms).toBeNull());
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Flip Photo")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("keeps Undo in the order things were asked for when an effect is chosen during a Delete", async () => {
    const { user } = await open([photo("a"), photo("b", { taken_ms: 2 })]);
    let answer = () => {};
    const changing = mocked.changePhoto.getMockImplementation();
    mocked.changePhoto.mockImplementationOnce(
      (id, change) =>
        new Promise((resolve, reject) => {
          answer = () => changing?.(id, change).then(resolve, reject);
        }),
    );
    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    await choose(user, "Delete");
    await user.click(screen.getByRole("button", { name: "Effects" }));
    await user.click((await screen.findAllByRole("button", { name: "Sepia" }))[0] as HTMLElement);
    await act(async () => answer());
    await waitFor(() => expect(strip()).toEqual(["b"]));

    await choose(user, "Undo Effect");
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(await row("Undo Delete")).not.toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await choose(user, "Undo Delete");
    await waitFor(() => expect(strip()).toEqual(["a", "b"]));
  });

  it("takes back the last picture taken first, whichever save finished first", async () => {
    const { kept, user } = await open([photo("a")]);
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
    const pixels = { data: new Uint8ClampedArray(640 * 480 * 4), width: 640, height: 480 };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          translate: vi.fn(),
          transform: vi.fn(),
          scale: vi.fn(),
          setTransform: vi.fn(),
          getImageData: vi.fn(() => pixels),
          putImageData: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
      done(new Blob(["jpeg"], { type: "image/jpeg" })),
    );
    const importing = mocked.importPicture.getMockImplementation();
    const saves: (() => void)[] = [];
    const taken: string[] = [];
    mocked.importPicture.mockImplementation(
      (blob, options) =>
        new Promise((resolve, reject) => {
          taken.push(options.id ?? "");
          saves.push(() => importing?.(blob, options).then(resolve, reject));
        }),
    );
    const video = document.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedData(video);
    const shutter = await screen.findByRole("button", { name: "Take Photo" });
    await waitFor(() => expect(shutter).not.toBeDisabled());

    fireEvent.click(shutter, { altKey: true });
    fireEvent.click(shutter, { altKey: true });
    await waitFor(() => expect(saves).toHaveLength(2));
    await act(async () => saves[1]?.());
    await act(async () => saves[0]?.());
    await waitFor(() => expect(kept).toHaveLength(3));

    await choose(user, "Undo Take Photo");
    await waitFor(() =>
      expect(kept.find((each) => each.id === taken[1])?.deleted_ms).not.toBeNull(),
    );
    expect(kept.find((each) => each.id === taken[0])?.deleted_ms).toBeNull();
  });

  it("takes back the last picture asked for first, whichever finished encoding first", async () => {
    const { kept, user } = await open([photo("a")]);
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
    const pixels = { data: new Uint8ClampedArray(640 * 480 * 4), width: 640, height: 480 };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          translate: vi.fn(),
          transform: vi.fn(),
          scale: vi.fn(),
          setTransform: vi.fn(),
          getImageData: vi.fn(() => pixels),
          putImageData: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    );
    const encodings: (() => void)[] = [];
    const first = new Blob(["first"], { type: "image/jpeg" });
    const second = new Blob(["second"], { type: "image/jpeg" });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => {
      const blob = encodings.length === 0 ? first : second;
      encodings.push(() => done(blob));
    });
    const importing = mocked.importPicture.getMockImplementation();
    const ids = new Map<Blob, string>();
    mocked.importPicture.mockImplementation((blob, options) => {
      ids.set(blob, options.id ?? "");
      return importing?.(blob, options) as ReturnType<typeof mocked.importPicture>;
    });
    const video = document.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedData(video);
    const shutter = await screen.findByRole("button", { name: "Take Photo" });
    await waitFor(() => expect(shutter).not.toBeDisabled());

    fireEvent.click(shutter, { altKey: true });
    fireEvent.click(shutter, { altKey: true });
    await waitFor(() => expect(encodings).toHaveLength(2));
    await act(async () => encodings[1]?.());
    await waitFor(() => expect(ids.has(second)).toBe(true));
    await act(async () => encodings[0]?.());
    await waitFor(() => expect(kept).toHaveLength(3));

    await choose(user, "Undo Take Photo");
    await waitFor(() =>
      expect(kept.find((each) => each.id === ids.get(second))?.deleted_ms).not.toBeNull(),
    );
    expect(kept.find((each) => each.id === ids.get(first))?.deleted_ms).toBeNull();
  });

  it("drops a Flip whose picture has left the window, exposing the step before it", async () => {
    const flipped = flipEdit(NO_EDIT);
    const { kept, user } = await open([photo("a"), photo("b", { taken_ms: 2, edit: flipped })]);
    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    await choose(user, "Delete");
    await waitFor(() => expect(strip()).toEqual(["b"]));

    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    await choose(user, "Flip Photo");
    await waitFor(() => expect(kept.find((each) => each.id === "b")?.edit).toBeNull());

    kept.splice(1, 1);
    act(() => library.announceChange());
    await waitFor(() => expect(strip()).toEqual([]));
    await choose(user, "Undo Flip Photo");
    expect(await screen.findByText(/Flip Photo could not be undone/)).toBeTruthy();
    await choose(user, "Undo Delete");
    await waitFor(() => expect(strip()).toEqual(["a"]));
  });
});

describe("Copy, Cut and Paste", () => {
  it("dims Cut and Copy with nothing chosen", async () => {
    const { user } = await open([photo("a")]);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await row("Cut")).toHaveAttribute("aria-disabled", "true");
    expect(await row("Copy")).toHaveAttribute("aria-disabled", "true");
  });

  it("dims Paste with its reason where a menu cannot read the browser's clipboard", async () => {
    const { user } = await open([photo("a")]);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    const paste = await row("Paste");
    expect(paste).toHaveAttribute("aria-disabled", "true");
    expect(paste.getAttribute("data-reason")).toMatch(/does not let a menu read/);
    expect(paste.getAttribute("title")).toBe(paste.getAttribute("data-reason"));
  });

  it("puts the picture on the desktop's clipboard and pastes it as a new one with its effect", async () => {
    const { user } = await open([photo("a", { effect: "sepia" })]);
    await user.click(screen.getByRole("button", { name: "Photo 1, Sepia" }));
    await choose(user, "Copy");
    expect(copiedDriveItems().map((each) => [each.id, each.name, each.type])).toEqual([
      ["f-a", "a.jpg", "image/jpeg"],
    ]);
    const [item] = copiedDriveItems();
    // Stands in for the drive client's read of the file.
    copyDriveItems([
      {
        ...(item as NonNullable<typeof item>),
        bytes: async () => new Blob(["jpeg"], { type: "image/jpeg" }),
      },
    ]);
    await choose(user, "Paste");
    await waitFor(() => expect(strip()).toHaveLength(2));
    const [, options] = mocked.importPicture.mock.calls[0] as [Blob, library.ImportOptions];
    expect(options).toMatchObject({ source: "photo-booth", effect: "sepia" });
    expect(options.id).not.toBe("a");

    await choose(user, "Undo Paste");
    await waitFor(() => expect(strip()).toEqual(["a"]));
  });

  it("Cut deletes what it copied, and Undo brings it back", async () => {
    const { kept, user } = await open([photo("a")]);
    await user.click(screen.getByRole("button", { name: "Photo 1, Normal" }));
    await choose(user, "Cut");
    await waitFor(() => expect(strip()).toEqual([]));
    expect(kept[0]?.deleted_ms).not.toBeNull();
    expect(copiedDriveItems().map((each) => each.id)).toEqual(["f-a"]);
    await choose(user, "Undo Cut");
    await waitFor(() => expect(strip()).toEqual(["a"]));
  });

  it("takes a picture the browser's paste event brings when nothing is on the desktop's clipboard", async () => {
    await open([photo("a")]);
    const file = new File(["png"], "image.png", { type: "image/png" });
    const event = new Event("paste", { bubbles: true }) as Event & {
      clipboardData: { files: File[]; getData: () => string };
    };
    event.clipboardData = { files: [file], getData: () => "" };
    await act(async () => {
      document.body.dispatchEvent(event);
    });
    await waitFor(() => expect(strip()).toHaveLength(2));
    expect(mocked.importPicture.mock.calls[0]?.[0]).toBe(file);
  });

  it("takes a picture the paste event brings over what Finder copied, with no copy of its own to compare", async () => {
    await open([photo("a")]);
    const finderFile = new Blob(["mov"], { type: "video/mp4" });
    copyDriveItems([
      { id: "f-x", name: "x.mp4", kind: "file", type: "video/mp4", bytes: async () => finderFile },
    ]);
    const file = new File(["png"], "image.png", { type: "image/png" });
    const event = new Event("paste", { bubbles: true }) as Event & {
      clipboardData: { files: File[]; getData: () => string };
    };
    event.clipboardData = { files: [file], getData: () => "" };
    await act(async () => {
      document.body.dispatchEvent(event);
    });
    await waitFor(() => expect(strip()).toHaveLength(2));
    expect(mocked.importPicture.mock.calls[0]?.[0]).toBe(file);
  });

  it("lets a picture on the browser's clipboard win over a copy that could not put one there", async () => {
    const { user } = await open([photo("a", { mime: "video/mp4", duration_ms: 1000 })]);
    await user.click(await screen.findByRole("button", { name: "Clip 1, Normal" }));
    await choose(user, "Copy");
    expect(copiedDriveItems().map((each) => each.id)).toEqual(["f-a"]);
    const file = new File(["png"], "image.png", { type: "image/png" });
    const event = new Event("paste", { bubbles: true }) as Event & {
      clipboardData: { files: File[]; getData: () => string };
    };
    event.clipboardData = { files: [file], getData: () => "" };
    await act(async () => {
      document.body.dispatchEvent(event);
    });
    await waitFor(() => expect(strip()).toHaveLength(2));
    expect(mocked.importPicture.mock.calls[0]?.[0]).toBe(file);
  });
});
