import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openItem } from "../desktop/desktop-open-item";
import * as maps from "../maps/maps-server";
import { DesktopPhotos } from "./photos-desktop";
import * as edit from "./photos-edit";
import { NO_EDIT } from "./photos-edit";

const { encodeJpeg: realEncodeJpeg } =
  await vi.importActual<typeof import("./photos-edit")>("./photos-edit");

import type { LibraryAlbum, LibraryPhoto } from "./photos-library";
import * as library from "./photos-library";

/*
 * The served window against a stand-in for the library client (`photos-library.ts`): the
 * module's requests and the drive are replaced by these doubles, whose own tests are in
 * photos-library.test.ts and the Ferrite module's tests. What is checked here is what the window
 * asks the library to do and what it then shows. Every double is reset and given its default
 * before each test (`useLibraryDoubles`), so what one test makes it answer never reaches another.
 */
vi.mock("./photos-library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./photos-library")>();
  return {
    ...actual,
    loadLibrary: vi.fn(),
    readThumbs: vi.fn(),
    readOriginal: vi.fn(),
    changePhoto: vi.fn(),
    deletePhoto: vi.fn(),
    importPicture: vi.fn(),
    createAlbum: vi.fn(),
    changeAlbum: vi.fn(),
    deleteAlbum: vi.fn(),
    decodePicture: vi.fn(),
    thumbnailOf: vi.fn(),
  };
});

const mocked = vi.mocked(library);

vi.mock("../maps/maps-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../maps/maps-server")>()),
  searchPlaces: vi.fn(),
}));
const searchPlaces = vi.mocked(maps.searchPlaces);

// The JPEG encoder, as it is, unless a test makes it fail as a browser's can.
vi.mock("./photos-edit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./photos-edit")>();
  return { ...actual, encodeJpeg: vi.fn(actual.encodeJpeg) };
});
const encoder = vi.mocked(edit.encodeJpeg);

/** Reset every library double and give it its default: nothing kept, every read answered. */
function useLibraryDoubles() {
  for (const double of [
    mocked.loadLibrary,
    mocked.readThumbs,
    mocked.readOriginal,
    mocked.changePhoto,
    mocked.deletePhoto,
    mocked.importPicture,
    mocked.createAlbum,
    mocked.changeAlbum,
    mocked.deleteAlbum,
    mocked.decodePicture,
    mocked.thumbnailOf,
  ]) {
    double.mockReset();
  }
  mocked.readThumbs.mockImplementation(async () => new Map());
  mocked.readOriginal.mockImplementation(async () => new Blob(["jpeg"], { type: "image/jpeg" }));
  mocked.deletePhoto.mockImplementation(async () => {});
  mocked.decodePicture.mockImplementation(async () => ({
    image: document.createElement("canvas"),
    width: 40,
    height: 30,
    close: () => {},
  }));
  mocked.thumbnailOf.mockImplementation(async () => new Blob(["thumb"], { type: "image/jpeg" }));
  encoder.mockReset();
  encoder.mockImplementation(realEncodeJpeg);
}

const photo = (id: string, name: string, taken: Date, more: Partial<LibraryPhoto> = {}) =>
  ({
    id,
    file: `f-${id}`,
    name,
    mime: "image/jpeg",
    bytes: 300_000,
    width: 4000,
    height: 3000,
    taken_ms: taken.getTime(),
    added_ms: Date.now(),
    source: "import",
    effect: null,
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
  }) satisfies LibraryPhoto;

const beach = photo("p1", "Beach", new Date(2019, 9, 7, 9));
const sunset = photo("p2", "Sunset", new Date(2019, 9, 7, 19));
const snow = photo("p3", "Snow", new Date(2020, 0, 1, 12));

function serve(photos: LibraryPhoto[], albums: LibraryAlbum[] = []) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  mocked.loadLibrary.mockResolvedValue({
    photos,
    albums,

    purge: [],

    folders: [],

    smart_albums: [],

    keywords: [],

    projects: [],
    memories: { favorites: [], deleted: [], albums: [] },

    settings: {},
    limits: { photos: 1000, recently_deleted_days: 30 },
  });
  // Every change answers the photo as changed.
  mocked.changePhoto.mockImplementation(async (id, change) => {
    const before = photos.find((each) => each.id === id) as LibraryPhoto;
    return {
      ...before,
      favorite: change.favorite ?? before.favorite,
      deleted_ms:
        change.deleted === undefined ? before.deleted_ms : change.deleted ? Date.now() : null,
    };
  });
}

const frame = () => screen.getByRole("region", { name: "Photos" });
const ready = () => waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
const tile = (name: string) => screen.getByRole("button", { name, pressed: false });
const tree = () => screen.getByRole("tree", { name: "Library" });
const NOW_MS = Date.now();
/** The ids of the photos the pane shows, in their order. */
const shownPhotos = () =>
  [...document.querySelectorAll<HTMLElement>("[data-photo-id]")].map(
    (each) => each.dataset.photoId,
  );

beforeEach(() => {
  useLibraryDoubles();
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:photo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("Photos on the desktop's Ferrite application", () => {
  it("is the demo, reading no library, when the page is not served by the application", () => {
    render(<DesktopPhotos />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Wallpapers");
    expect(mocked.loadLibrary).not.toHaveBeenCalled();
  });

  it("shows the library by day, then every photo in one grid", async () => {
    const user = userEvent.setup();
    serve([snow, sunset, beach]);
    render(<DesktopPhotos />);
    expect(frame()).toHaveAttribute("aria-busy", "true");
    await ready();
    expect(screen.getAllByRole("heading", { level: 2 }).map((each) => each.textContent)).toEqual([
      "Monday, October 7, 2019",
      "Wednesday, January 1, 2020",
    ]);
    expect(
      within(screen.getByRole("region", { name: "Monday, October 7, 2019" }))
        .getAllByRole("button", { pressed: false })
        .map((each) => each.getAttribute("aria-label")),
    ).toEqual(["Beach", "Sunset"]);
    expect(mocked.readThumbs).toHaveBeenCalledWith(["p3", "p2", "p1"]);

    await user.click(screen.getByRole("button", { name: "All Photos" }));
    const grid = screen.getByRole("listbox", { name: "Photos" });
    expect(
      within(grid)
        .getAllByRole("option")
        .map((each) => each.textContent),
    ).toEqual(["Beach", "Sunset", "Snow"]);
  });

  it("favorites the selected photo and lists it under Favorites", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.click(screen.getByRole("button", { name: "Favorite" }));
    expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { favorite: true });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    await user.click(within(tree()).getByRole("treeitem", { name: "Favorites" }));
    const grid = screen.getByRole("listbox", { name: "Favorites" });
    expect(
      within(grid)
        .getAllByRole("option")
        .map((each) => each.textContent),
    ).toEqual(["Beach"]);
  });

  it("shows an edited photo's thumbnail with a note when its edit cannot be drawn full size", async () => {
    const user = userEvent.setup();
    // The browser cannot encode the edited picture.
    encoder.mockResolvedValue(null);
    serve([{ ...beach, edit: { ...NO_EDIT, filter: "mono" }, edited_ms: 2 }]);
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Beach"));
    expect(
      await screen.findByText(
        "The edited photo could not be drawn full size; this is its thumbnail.",
      ),
    ).toBeInTheDocument();
    // Never the unedited original in its place.
    expect(screen.getByRole("img", { name: "Beach" })).not.toHaveAttribute("data-full");
  });

  it("ends the editor, saying why, when another window deletes the photo being edited", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Beach"));
    await user.click(await screen.findByRole("button", { name: /^Edit$/ }));
    await screen.findByRole("slider", { name: "Exposure" });
    // Another window deletes Beach for good.
    mocked.loadLibrary.mockResolvedValue({
      photos: [sunset],
      albums: [],

      purge: [],

      folders: [],

      smart_albums: [],

      keywords: [],

      projects: [],
      memories: { favorites: [], deleted: [], albums: [] },

      settings: {},
      limits: { photos: 250, recently_deleted_days: 30 },
    });
    await act(async () => library.announceChange("photos:another-window"));
    expect(
      await screen.findByText(/The photo you were editing was deleted in another window/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Exposure" })).toBeNull();
  });

  it("keeps the editor and its draft open, saying why, when a save fails", async () => {
    const user = userEvent.setup();
    serve([beach]);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Beach"));
    await user.click(await screen.findByRole("button", { name: /^Edit$/ }));
    const exposure = await screen.findByRole("slider", { name: "Exposure" });
    exposure.focus();
    await user.keyboard("{ArrowRight}");
    const moved = exposure.getAttribute("aria-valuenow");
    mocked.changePhoto.mockRejectedValue(new library.LibraryError("the library is full", 413));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Saving the edit did not work: the library is full.",
    );
    // Still editing, with the change made kept.
    expect(screen.getByRole("slider", { name: "Exposure" })).toHaveAttribute(
      "aria-valuenow",
      moved,
    );
  });

  it("shows the library when the album it shows is deleted in another window", async () => {
    const user = userEvent.setup();
    const trip = {
      id: "a1",
      name: "Trip",
      photos: ["p2"],
      created_ms: 1,
      sort: "custom" as const,
      key_photo: null,
      folder: null,
    };
    serve([beach, sunset], [trip]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(within(tree()).getByRole("treeitem", { name: /^Trip/ }));
    expect(screen.getByRole("heading", { name: "Trip" })).toBeInTheDocument();
    mocked.loadLibrary.mockResolvedValue({
      photos: [beach, sunset],
      albums: [],

      purge: [],

      folders: [],

      smart_albums: [],

      keywords: [],

      projects: [],
      memories: { favorites: [], deleted: [], albums: [] },

      settings: {},
      limits: { photos: 250, recently_deleted_days: 30 },
    });
    await act(async () => library.announceChange("photos:another-window"));
    expect(await screen.findByRole("heading", { name: "Photos" })).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: /^Trip/ })).toBeNull();
  });

  it("opens a photo full size and steps through the list with Next and Previous", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Beach"));
    expect(await screen.findByRole("img", { name: "Beach" })).toHaveAttribute("src", "blob:photo");
    expect(screen.getByRole("region", { name: "Beach, 1 of 2" })).toHaveFocus();
    expect(mocked.readOriginal).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
    expect(screen.getByRole("button", { name: "Previous" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("img", { name: "Sunset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("img", { name: "Sunset" }));
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByRole("img", { name: "Beach" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(tile("Sunset")).toBeInTheDocument();
  });

  it("moves a photo to Recently Deleted with Delete, and recovers it", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard("{Delete}");
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { deleted: true });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Beach" })).toBeNull());

    await user.click(within(tree()).getByRole("treeitem", { name: "Recently Deleted" }));
    const grid = screen.getByRole("listbox", { name: "Recently Deleted" });
    const option = within(grid).getByRole("option", { name: "Beach" });
    expect(option).toHaveTextContent("30 days");
    fireEvent.mouseDown(option.querySelector(".mac-photos-thumbnail") as HTMLElement);
    fireEvent.click(option.querySelector(".mac-photos-thumbnail") as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Recover" }));
    expect(mocked.changePhoto).toHaveBeenLastCalledWith("p1", { deleted: false });
  });

  it("takes its keys from anywhere in the window, but not from a field being typed in", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    // Typed in the search field, "." is text, not Favorite.
    await user.click(tile("Beach"));
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard(".");
    expect(mocked.changePhoto).not.toHaveBeenCalled();
    await user.clear(screen.getByRole("searchbox"));
    // After a toolbar button (the focus is on it, outside the grid), Delete still deletes.
    await user.click(await screen.findByRole("button", { name: "Beach" }));
    await user.click(screen.getByRole("button", { name: "Favorite" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { favorite: true }));
    await user.keyboard("{Delete}");
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mocked.changePhoto).toHaveBeenLastCalledWith("p1", { deleted: true }),
    );
  });

  it("imports the pictures chosen in the file dialog", async () => {
    serve([]);
    // A JPEG's first bytes: Photos judges a file by its bytes, not its name or type.
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "Lake.jpg", {
      type: "image/jpeg",
    });
    mocked.importPicture.mockResolvedValue(photo("p9", "Lake", new Date(2021, 5, 1)));
    render(<DesktopPhotos />);
    await ready();
    expect(screen.getByRole("status")).toHaveTextContent("No Photos");
    const input = frame().querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [file, new File(["x"], "notes.txt", { type: "text/plain" })] },
      });
    });
    expect(mocked.importPicture).toHaveBeenCalledTimes(1);
    expect(mocked.importPicture).toHaveBeenCalledWith(file, { name: "Lake.jpg" });
    expect(await screen.findByRole("button", { name: "Lake" })).toBeInTheDocument();
    // The text file is not imported, and the window says so by name.
    expect(screen.getByRole("alert")).toHaveTextContent(
      "1 of 2 files were not imported: “notes.txt” is not a picture or movie Photos can import",
    );
  });

  it("makes an album of the selected photo", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    mocked.createAlbum.mockImplementation(async (name, id) => [
      {
        id: id as string,
        name,
        photos: [],
        created_ms: 1,
        sort: "custom" as const,
        key_photo: null,
        folder: null,
      },
    ]);
    mocked.changeAlbum.mockImplementation(async (id, change) => [
      {
        id,
        name: "Trip",
        photos: change.add ?? [],
        created_ms: 1,
        sort: "custom" as const,
        key_photo: null,
        folder: null,
      },
    ]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Sunset"));
    await user.click(screen.getByRole("button", { name: "New Album" }));
    const name = await screen.findByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Trip");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(mocked.changeAlbum).toHaveBeenCalled());
    const id = mocked.createAlbum.mock.calls[0]?.[1];
    expect(mocked.createAlbum).toHaveBeenCalledWith("Trip", id);
    expect(mocked.changeAlbum).toHaveBeenCalledWith(id, { add: ["p2"] });
    expect(await within(tree()).findByRole("treeitem", { name: /Trip/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const grid = screen.getByRole("listbox", { name: "Trip" });
    expect(
      within(grid)
        .getAllByRole("option")
        .map((each) => each.textContent),
    ).toEqual(["Sunset"]);
  });

  it("says when the library cannot be read, and offers nothing to act on", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocked.loadLibrary.mockRejectedValue(new Error("HTTP 503"));
    render(<DesktopPhotos />);
    await ready();
    expect(screen.getByRole("status")).toHaveTextContent(/could not be read/);
    expect(screen.getByRole("button", { name: "Import" })).toHaveAttribute("aria-disabled", "true");
  });

  it("turns a photo twice for two quick Rotates, each from the last turn", async () => {
    const user = userEvent.setup();
    serve([beach]);
    mocked.readThumbs.mockImplementation(
      async (ids) => new Map(ids.map((id) => [id, new Blob(["jpeg"], { type: "image/jpeg" })])),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
      done(new Blob(["turned"], { type: "image/jpeg" })),
    );
    let edited_ms = 1;
    mocked.changePhoto.mockImplementation(async (id, change) => {
      edited_ms += 1;
      return { ...beach, id, edit: change.edit ?? null, edited_ms };
    });
    render(<DesktopPhotos />);
    await ready();
    await waitFor(() => expect(mocked.readThumbs).toHaveBeenCalled());
    await user.click(tile("Beach"));
    const rotateButton = screen.getByRole("button", { name: "Rotate" });
    await user.click(rotateButton);
    await user.click(rotateButton);
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledTimes(2));
    const turns = mocked.changePhoto.mock.calls.map(([, change]) => change.edit?.rotate);
    expect(turns).toEqual([1, 2]);
  });

  it("opens the editor on the photo as a Rotate still saving leaves it", async () => {
    const user = userEvent.setup();
    serve([beach]);
    mocked.readThumbs.mockImplementation(
      async (ids) => new Map(ids.map((id) => [id, new Blob(["jpeg"], { type: "image/jpeg" })])),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
      done(new Blob(["turned"], { type: "image/jpeg" })),
    );
    let finishRotate: () => void = () => {};
    mocked.changePhoto.mockImplementation((id, change) => {
      const changed = { ...beach, id, edit: change.edit ?? null, edited_ms: 2 };
      // The first change, the Rotate, is still on its way when Edit is clicked.
      if (mocked.changePhoto.mock.calls.length > 1) return Promise.resolve(changed);
      return new Promise((resolve) => {
        finishRotate = () => resolve(changed);
      });
    });
    render(<DesktopPhotos />);
    await ready();
    await waitFor(() => expect(mocked.readThumbs).toHaveBeenCalled());
    await user.dblClick(tile("Beach"));
    await user.click(await screen.findByRole("button", { name: "Rotate" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /^Edit$/ }));
    await act(async () => finishRotate());
    const exposure = await screen.findByRole("slider", { name: "Exposure" });
    exposure.focus();
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledTimes(2));
    // The saved recipe keeps the turn the Rotate made.
    expect(mocked.changePhoto.mock.calls[1]?.[1].edit?.rotate).toBe(1);
  });

  it("exports the photo as the changes queued before the export left it", async () => {
    const user = userEvent.setup();
    serve([beach]);
    mocked.readThumbs.mockImplementation(
      async (ids) => new Map(ids.map((id) => [id, new Blob(["jpeg"], { type: "image/jpeg" })])),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
      done(new Blob(["turned"], { type: "image/jpeg" })),
    );
    // The Rotate is still on its way when Export is chosen.
    let finishRotate: () => void = () => {};
    mocked.changePhoto.mockImplementation(
      (id, change) =>
        new Promise((resolve) => {
          finishRotate = () => resolve({ ...beach, id, edit: change.edit ?? null, edited_ms: 2 });
        }),
    );
    const saved = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(saved);
    render(<DesktopPhotos />);
    await ready();
    await waitFor(() => expect(mocked.readThumbs).toHaveBeenCalled());
    await user.click(tile("Beach"));
    await user.click(screen.getByRole("button", { name: "Rotate" }));
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Export…" }));
    await user.click(await screen.findByRole("button", { name: "Export" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalled());
    await act(async () => finishRotate());
    // The turned photo is drawn and encoded for the export, not the unturned original sent as is.
    await waitFor(() =>
      expect(encoder).toHaveBeenCalledWith(expect.anything(), Number.MAX_SAFE_INTEGER, [0.92]),
    );
    await waitFor(() => expect(saved).toHaveBeenCalled());
  });

  it("edits the photo it opened for, whatever a cancelled editor read later", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    let finishBeach: (blob: Blob) => void = () => {};
    mocked.readOriginal.mockImplementation((photo) =>
      photo.file === beach.file
        ? new Promise<Blob>((resolve) => {
            finishBeach = resolve;
          })
        : Promise.resolve(new Blob(["sunset"], { type: "image/jpeg" })),
    );
    // Each original decodes at a size of its own, so the editor's source tells which it is.
    mocked.decodePicture.mockImplementation(async (blob) => ({
      image: document.createElement("canvas"),
      width: (await blob.text()) === "sunset" ? 30 : 40,
      height: 20,
      close: () => {},
    }));
    mocked.changePhoto.mockImplementation(async (id, change) => ({
      ...(id === beach.id ? beach : sunset),
      edit: change.edit ?? null,
      edited_ms: 9,
    }));
    render(<DesktopPhotos />);
    await ready();

    await user.dblClick(tile("Beach"));
    await user.click(screen.getByRole("button", { name: /^Edit$/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("img", { name: "Sunset" });
    await user.click(screen.getByRole("button", { name: /^Edit$/ }));
    await screen.findByRole("slider", { name: "Exposure" });
    // The cancelled editor's read of Beach ends now.
    await act(async () => finishBeach(new Blob(["beach"], { type: "image/jpeg" })));
    screen.getByRole("slider", { name: "Exposure" }).focus();
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalled());
    const [id] = mocked.changePhoto.mock.calls[0] ?? [];
    expect(id).toBe(sunset.id);
    const [source] = mocked.thumbnailOf.mock.calls[0] ?? [];
    expect(source?.width).toBe(30);
  });

  it("favorites and then unfavorites for two quick clicks, each from the last state", async () => {
    const user = userEvent.setup();
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    const favorite = screen.getByRole("button", { name: "Favorite" });
    await user.click(favorite);
    await user.click(favorite);
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledTimes(2));
    expect(mocked.changePhoto.mock.calls.map(([, change]) => change.favorite)).toEqual([
      true,
      false,
    ]);
  });

  it("reads the library again when Photo Booth saves a shot", async () => {
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    mocked.loadLibrary.mockResolvedValue({
      photos: [beach, { ...sunset, source: "photo-booth" }],
      albums: [],

      purge: [],

      folders: [],

      smart_albums: [],

      keywords: [],

      projects: [],
      memories: { favorites: [], deleted: [], albums: [] },

      settings: {},
      limits: { photos: 500, recently_deleted_days: 30 },
    });
    await act(async () => library.announceChange());
    expect(await screen.findByRole("button", { name: "Sunset" })).toBeInTheDocument();
  });

  it("reads the library again for a change announced while it was loading", async () => {
    serve([beach]);
    let answer: () => void = () => {};
    mocked.loadLibrary.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = () =>
            resolve({
              photos: [beach],
              albums: [],

              purge: [],

              folders: [],

              smart_albums: [],

              keywords: [],

              projects: [],
              memories: { favorites: [], deleted: [], albums: [] },

              settings: {},
              limits: { photos: 500, recently_deleted_days: 30 },
            });
        }),
    );
    render(<DesktopPhotos />);
    // Photo Booth saves a shot before the first read answers (with the library before it).
    mocked.loadLibrary.mockResolvedValue({
      photos: [beach, { ...sunset, source: "photo-booth" }],
      albums: [],

      purge: [],

      folders: [],

      smart_albums: [],

      keywords: [],

      projects: [],
      memories: { favorites: [], deleted: [], albums: [] },

      settings: {},
      limits: { photos: 500, recently_deleted_days: 30 },
    });
    act(() => library.announceChange("photo-booth:a-window"));
    await act(async () => answer());
    expect(await screen.findByRole("button", { name: "Sunset" })).toBeInTheDocument();
    expect(mocked.loadLibrary).toHaveBeenCalledTimes(2);
  });

  it("closes a photo that leaves the list it was opened from", async () => {
    const user = userEvent.setup();
    serve([{ ...beach, favorite: true }]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(within(tree()).getByRole("treeitem", { name: "Favorites" }));
    const grid = screen.getByRole("listbox", { name: "Favorites" });
    await user.dblClick(within(grid).getByRole("option", { name: "Beach" }));
    await screen.findByRole("img", { name: "Beach" });
    await user.click(screen.getByRole("button", { name: "Favorite" }));
    await waitFor(() => expect(screen.queryByRole("img", { name: "Beach" })).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("No Favorites");
  });

  it("tells the other open windows about a change it makes, and does not read its own again", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    const one = render(<DesktopPhotos />);
    const two = render(<DesktopPhotos />);
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("region", { name: "Photos" })
          .every((each) => !each.hasAttribute("aria-busy")),
      ).toBe(true),
    );
    expect(mocked.loadLibrary).toHaveBeenCalledTimes(2);
    const heard: (string | undefined)[] = [];
    const listen = (event: Event) => heard.push(library.announcedBy(event));
    window.addEventListener(library.LIBRARY_CHANGED_EVENT, listen);
    // What the library holds once the first window moved Beach to Recently Deleted.
    mocked.loadLibrary.mockResolvedValue({
      photos: [{ ...beach, deleted_ms: Date.now() }, sunset],
      albums: [],

      purge: [],

      folders: [],

      smart_albums: [],

      keywords: [],

      projects: [],
      memories: { favorites: [], deleted: [], albums: [] },

      settings: {},
      limits: { photos: 500, recently_deleted_days: 30 },
    });
    await user.click(within(one.container).getByRole("button", { name: "Beach", pressed: false }));
    await user.keyboard("{Delete}");
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(within(two.container).queryByRole("button", { name: "Beach" })).toBeNull(),
    );
    expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { deleted: true });
    expect(heard).toEqual([expect.stringMatching(/^photos:/)]);
    // Only the other window read the library again.
    expect(mocked.loadLibrary).toHaveBeenCalledTimes(3);
    window.removeEventListener(library.LIBRARY_CHANGED_EVENT, listen);
  });

  it("deletes an album and keeps its photos in the library", async () => {
    const user = userEvent.setup();
    const trip = {
      id: "a1",
      name: "Trip",
      photos: ["p1", "p2"],
      created_ms: 1,
      sort: "custom" as const,
      key_photo: null,
      folder: null,
    };
    serve([beach, sunset], [trip]);
    mocked.deleteAlbum.mockResolvedValue([]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(within(tree()).getByRole("treeitem", { name: /^Trip/ }));
    await user.click(screen.getByRole("button", { name: "Delete Album" }));
    expect(mocked.deleteAlbum).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocked.deleteAlbum).toHaveBeenCalled());
    expect(mocked.deleteAlbum).toHaveBeenCalledWith("a1");
    expect(await screen.findByRole("heading", { name: "Photos" })).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: /^Trip/ })).toBeNull();
    // Its photos stay: nothing was deleted or moved to Recently Deleted.
    expect(tile("Beach")).toBeInTheDocument();
    expect(tile("Sunset")).toBeInTheDocument();
    expect(mocked.changePhoto).not.toHaveBeenCalled();
    expect(mocked.deletePhoto).not.toHaveBeenCalled();
  });

  it("favourites the selected photo with the . key, and takes it away again", async () => {
    const user = userEvent.setup();
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard(".");
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledTimes(1));
    await user.keyboard(".");
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledTimes(2));
    expect(mocked.changePhoto.mock.calls).toEqual([
      ["p1", { favorite: true }],
      ["p1", { favorite: false }],
    ]);
  });

  it("asks before Command-Delete moves a photo to Recently Deleted, and Cancel keeps it", async () => {
    const user = userEvent.setup();
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard("{Meta>}{Backspace}{/Meta}");
    expect(await screen.findByText("Are you sure you want to delete this photo?")).toBeVisible();
    expect(screen.getByText("It stays in Recently Deleted for 30 days.")).toBeVisible();
    expect(mocked.changePhoto).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocked.changePhoto).not.toHaveBeenCalled();
    await user.keyboard("{Meta>}{Backspace}{/Meta}");
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { deleted: true }));
  });

  it("keeps the selection when Command-4 changes the library's view", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Sunset"));
    await user.keyboard("{Meta>}4{/Meta}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Photos");
    expect(screen.getByText("1 Photo Selected")).toBeVisible();
  });

  it("goes from a day's title to All Photos with that day's first photo selected", async () => {
    const user = userEvent.setup();
    serve([beach, snow]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(screen.getByRole("button", { name: "Wednesday, January 1, 2020" }));
    const grid = await screen.findByRole("listbox");
    expect(within(grid).getByRole("option", { name: "Snow" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(grid).toHaveFocus();
  });

  it("comes back from an open photo at the place the pane was scrolled to", async () => {
    const user = userEvent.setup();
    serve([beach, sunset, snow]);
    render(<DesktopPhotos />);
    await ready();
    const scroller = () =>
      document.querySelector(".mac-photos-groups .mac-scroll-view-viewport") as HTMLElement;
    scroller().scrollTop = 240;
    await user.dblClick(tile("Snow"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector(".mac-photos-viewer")).toBeNull());
    expect(scroller().scrollTop).toBe(240);
  });

  it("zooms an open photo with a pinch, which a browser reports as a wheel with Control", async () => {
    const user = userEvent.setup();
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Beach"));
    const viewer = document.querySelector(".mac-photos-viewer") as HTMLElement;
    expect(viewer).not.toHaveAttribute("data-zoomed");
    fireEvent.wheel(viewer, { deltaY: -100, ctrlKey: false });
    expect(viewer).not.toHaveAttribute("data-zoomed");
    fireEvent.wheel(viewer, { deltaY: -100, ctrlKey: true });
    expect(viewer).toHaveAttribute("data-zoomed");
    fireEvent.wheel(viewer, { deltaY: 1000, ctrlKey: true });
    expect(viewer).not.toHaveAttribute("data-zoomed");
  });

  it("dims the Shared rows a browser cannot fill, saying why", async () => {
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    for (const [name, reason] of [
      ["Shared Albums", "Shared albums live in iCloud, which this desktop can't reach."],
      ["Activity", "Shared activity comes from iCloud, which this desktop can't reach."],
    ] as const) {
      const row = within(tree()).getByRole("treeitem", { name });
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveAttribute("title", reason);
    }
  });

  it("shows Media Types only for the kinds the library holds, as Catalina does", async () => {
    serve([beach]);
    const { unmount } = render(<DesktopPhotos />);
    await ready();
    expect(within(tree()).queryByText("Media Types")).toBeNull();
    for (const name of [
      "Videos",
      "Live Photos",
      "Portrait",
      "Time-lapse",
      "Slo-mo",
      "Bursts",
      "Selfies",
      "Panoramas",
      "Screenshots",
      "Animated",
    ]) {
      expect(within(tree()).queryByRole("treeitem", { name })).toBeNull();
    }
    unmount();

    serve([beach, photo("m1", "Movie", new Date(2019, 9, 8, 9), { mime: "video/mp4" })]);
    render(<DesktopPhotos />);
    await ready();
    expect(within(tree()).getByText("Media Types")).toBeInTheDocument();
    expect(within(tree()).getByRole("treeitem", { name: "Videos" })).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(within(tree()).queryByRole("treeitem", { name: "Live Photos" })).toBeNull();
  });

  it("offers a face found in a photo to name in People, and makes a person of the name", async () => {
    const user = userEvent.setup();
    const face = { id: 0, x: 0.2, y: 0.2, width: 0.2, height: 0.2, score: 0.9 };
    const faced = photo("p1", "Beach", new Date(2019, 9, 7, 9), { faces: [face] });
    serve([faced, sunset]);
    mocked.changePhoto.mockImplementation(async (_, change) => ({
      ...faced,
      people: change.face?.name ? [change.face.name] : [],
      faces: [{ ...face, name: change.face?.name ?? null }],
    }));
    render(<DesktopPhotos />);
    await ready();
    await user.click(within(tree()).getByRole("treeitem", { name: "People" }));
    expect(screen.getByRole("heading", { name: "Unnamed Faces" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Name this face, in Sunset" })).toBeNull();
    await user.type(
      screen.getByRole("combobox", { name: "Name this face, in Beach" }),
      "Ann{Enter}",
    );
    await waitFor(() =>
      expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { face: { id: 0, name: "Ann" } }),
    );
    expect(await screen.findByRole("button", { name: "Ann, 1 Photo" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Unnamed Faces" })).toBeNull();
  });

  it("finds a place typed in Info's Location with the geocoder and keeps the one chosen", async () => {
    const user = userEvent.setup();
    serve([beach]);
    searchPlaces.mockResolvedValue({
      ok: true,
      value: [
        {
          id: "n1",
          name: "Scheveningen",
          category: "place",
          lat: 52.1,
          lon: 4.27,
          address: ["The Hague"],
        },
      ],
    });
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard("{Meta>}i{/Meta}");
    await user.type(
      await screen.findByRole("textbox", { name: "Location" }),
      "Scheveningen{Enter}",
    );
    expect(searchPlaces).toHaveBeenCalledWith("Scheveningen");
    await user.click(await screen.findByRole("button", { name: "Scheveningen, The Hague" }));
    await waitFor(() =>
      expect(mocked.changePhoto).toHaveBeenCalledWith("p1", {
        location: { lat: 52.1, lon: 4.27, name: "Scheveningen" },
      }),
    );
    expect(screen.queryByRole("button", { name: "Scheveningen, The Hague" })).toBeNull();
  });

  it("says when a typed place is not found, and changes nothing", async () => {
    const user = userEvent.setup();
    serve([beach]);
    searchPlaces.mockResolvedValue({ ok: true, value: [] });
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard("{Meta>}i{/Meta}");
    await user.type(await screen.findByRole("textbox", { name: "Location" }), "Nowhere{Enter}");
    expect(await screen.findByText("No place called “Nowhere” was found.")).toBeVisible();
    expect(mocked.changePhoto).not.toHaveBeenCalled();
  });

  /** Opens Beach in the editor, on a stand-in original with no canvas to draw on. */
  const openEditor = async (user: ReturnType<typeof userEvent.setup>) => {
    serve([beach]);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Beach"));
    await user.click(await screen.findByRole("button", { name: /^Edit$/ }));
    await screen.findByRole("slider", { name: "Exposure" });
  };

  it("sets White Balance by hand under the pop-up's Temperature/Tint, and its tick takes it off", async () => {
    const user = userEvent.setup();
    await openEditor(user);
    const section = screen.getByRole("region", { name: "White Balance" });
    expect(within(section).getByRole("button", { name: "Auto" })).toBeVisible();
    await user.click(within(section).getByRole("combobox", { name: "White Balance mode" }));
    await user.click(await screen.findByRole("option", { name: "Temperature/Tint" }));
    expect(within(section).queryByRole("button", { name: "Auto" })).toBeNull();
    const temperature = within(section).getByRole("slider", { name: "Temperature" });
    temperature.focus();
    await user.keyboard("{ArrowRight}");
    expect(temperature).toHaveAttribute("aria-valuenow", "0.01");
    expect(screen.getByRole("slider", { name: "Warmth" })).toHaveAttribute("aria-valuenow", "0.01");
    await user.click(within(section).getByRole("checkbox", { name: "White Balance" }));
    expect(temperature).toHaveAttribute("aria-valuenow", "0");
    await user.click(within(section).getByRole("checkbox", { name: "White Balance" }));
    expect(temperature).toHaveAttribute("aria-valuenow", "0.01");
  });

  it("keeps a line drawn with Markup in the saved edit, placed on the original", async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.click(screen.getByRole("button", { name: "Draw" }));
    const layer = screen.getByRole("button", { name: "Draw on the photo" });
    vi.spyOn(layer, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));
    const press = (type: string, clientX: number, clientY: number) =>
      fireEvent(layer, new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY }));
    press("pointerdown", 50, 50);
    press("pointermove", 75, 50);
    press("pointerup", 75, 50);
    await user.click(screen.getByRole("button", { name: "Stop Drawing" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalled());
    expect(mocked.changePhoto.mock.calls[0]?.[1].edit?.marks).toEqual([
      {
        color: "#ff3b30",
        width: 0.006,
        points: [
          [0.5, 0.5],
          [0.75, 0.5],
        ],
      },
    ]);
  });

  it("zooms the picture being edited with the toolbar's slider", async () => {
    const user = userEvent.setup();
    await openEditor(user);
    const stage = () => document.querySelector(".mac-photos-edit-stage") as HTMLElement;
    expect(stage()).not.toHaveAttribute("data-zoomed");
    screen.getByRole("slider", { name: "Zoom" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(stage()).toHaveAttribute("data-zoomed");
    expect((stage().firstElementChild as HTMLElement).style.transform).toBe(
      "translate(0px, 0px) scale(1.1)",
    );
  });

  it("deletes everything in Recently Deleted for good with Delete All, and nothing else", async () => {
    const user = userEvent.setup();
    const gone = Date.now();
    serve([{ ...beach, deleted_ms: gone }, { ...sunset, deleted_ms: gone - 1 }, snow]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(within(tree()).getByRole("treeitem", { name: "Recently Deleted" }));
    await user.click(screen.getByRole("button", { name: "Delete All" }));
    expect(mocked.deletePhoto).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocked.deletePhoto).toHaveBeenCalledTimes(2));
    expect(mocked.deletePhoto.mock.calls.map(([id]) => id).sort()).toEqual(["p1", "p2"]);
    expect(await screen.findByRole("status")).toHaveTextContent("No Recently Deleted Items");
    await user.click(within(tree()).getByRole("treeitem", { name: "Photos" }));
    expect(tile("Snow")).toBeInTheDocument();
  });

  it("reverts an edited photo to its original from the editor", async () => {
    const user = userEvent.setup();
    const edited: LibraryPhoto = { ...beach, edit: { ...NO_EDIT, filter: "mono" }, edited_ms: 2 };
    serve([edited]);
    mocked.changePhoto.mockImplementation(async (id, change) => ({
      ...edited,
      id,
      edit: change.edit === undefined ? edited.edit : change.edit,
      edited_ms: 3,
    }));
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Beach"));
    await user.click(await screen.findByRole("button", { name: /^Edit$/ }));
    await user.click(screen.getByRole("button", { name: "Revert to Original" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { edit: null }));
    // The editor closes on the original, and Revert has nothing left to undo.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Done" })).toBeNull());
    expect(mocked.importPicture).not.toHaveBeenCalled();
  });

  it("says No Results for a search that finds nothing", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.type(screen.getByRole("searchbox"), "zebra");
    expect(await screen.findByRole("status")).toHaveTextContent("No Results");
    await user.clear(screen.getByRole("searchbox"));
    expect(tile("Beach")).toBeInTheDocument();
  });

  it("hides a photo from the library with Command-L and lists it under Hidden", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    mocked.changePhoto.mockImplementation(async (id, change) => ({
      ...(id === "p1" ? beach : sunset),
      hidden: change.hidden === true,
    }));
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard("{Meta>}l{/Meta}");
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { hidden: true }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Beach" })).toBeNull());
    // Undo puts it back.
    await user.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { hidden: false }));
    expect(await screen.findByRole("button", { name: "Beach" })).toBeInTheDocument();
  });

  it("removes a photo from the album shown with Delete, and leaves it in the library", async () => {
    const user = userEvent.setup();
    const trip = {
      id: "a1",
      name: "Trip",
      photos: ["p1"],
      created_ms: 1,
      sort: "custom" as const,
      key_photo: null,
      folder: null,
    };
    serve([beach], [trip]);
    mocked.changeAlbum.mockResolvedValue([{ ...trip, photos: [] }]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(within(tree()).getByRole("treeitem", { name: /^Trip/ }));
    await user.click(await screen.findByRole("option", { name: "Beach" }));
    await user.keyboard("{Delete}");
    await waitFor(() => expect(mocked.changeAlbum).toHaveBeenCalledWith("a1", { remove: ["p1"] }));
    await waitFor(() => expect(shownPhotos()).toEqual([]));
    expect(mocked.changePhoto).not.toHaveBeenCalled();
    await user.click(within(tree()).getByRole("treeitem", { name: /^Photos/ }));
    expect(await screen.findByRole("button", { name: "Beach" })).toBeInTheDocument();
  });

  const album = (id: string, name: string, photos: string[]) => ({
    id,
    name,
    photos,
    created_ms: 1,
    sort: "custom" as const,
    key_photo: null,
    folder: null,
  });

  /** Albums kept as the module keeps them. Answers what they hold now. */
  function keepAlbums(start: LibraryAlbum[]) {
    let albums = start;
    mocked.changeAlbum.mockImplementation(async (id, change) => {
      albums = albums.map((each) => {
        if (each.id === change.from) {
          return { ...each, photos: each.photos.filter((p) => !change.add?.includes(p)) };
        }
        if (each.id !== id) return each;
        const photos = each.photos.filter((p) => !change.remove?.includes(p));
        for (const p of change.add ?? []) if (!photos.includes(p)) photos.push(p);
        const order = change.order ?? [];
        return {
          ...each,
          photos: [...order, ...photos.filter((p) => !order.includes(p))],
        };
      });
      return albums;
    });
    return () => albums;
  }

  const openAlbum = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
    user.click(within(tree()).getByRole("treeitem", { name }));

  it("undoes a move to what both albums held, in their order, also after a reload", async () => {
    const user = userEvent.setup();
    const shelf = [beach, sunset, snow];
    const start = [album("a1", "From", ["p1", "p2", "p3"]), album("a2", "To", ["p1"])];
    serve(shelf, start);
    const held = keepAlbums(start);
    render(<DesktopPhotos />);
    await ready();
    await openAlbum(user, /^From/);
    await user.click(await screen.findByRole("option", { name: "Beach" }));
    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("option", { name: "Sunset" }));
    await user.keyboard("{/Meta}");
    fireEvent.contextMenu(screen.getByRole("option", { name: "Beach" }));
    await user.click(await screen.findByRole("menuitem", { name: "Move to" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "To" }));
    await waitFor(() => expect(shownPhotos()).toEqual(["p3"]));
    await openAlbum(user, /^To/);
    await waitFor(() => expect(shownPhotos()).toEqual(["p1", "p2"]));

    await user.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => expect(shownPhotos()).toEqual(["p1"]));
    await openAlbum(user, /^From/);
    await waitFor(() => expect(shownPhotos()).toEqual(["p1", "p2", "p3"]));

    serve(shelf, held());
    await act(async () => library.announceChange("photos:another-window"));
    await waitFor(() => expect(shownPhotos()).toEqual(["p1", "p2", "p3"]));
    await openAlbum(user, /^To/);
    await waitFor(() => expect(shownPhotos()).toEqual(["p1"]));
  });

  it("puts a photo back in its place when a removal from an album is undone", async () => {
    const user = userEvent.setup();
    const start = [album("a1", "Trip", ["p1", "p2", "p3"])];
    serve([beach, sunset, snow], start);
    keepAlbums(start);
    render(<DesktopPhotos />);
    await ready();
    await openAlbum(user, /^Trip/);
    await user.click(await screen.findByRole("option", { name: "Sunset" }));
    await user.keyboard("{Delete}");
    await waitFor(() => expect(shownPhotos()).toEqual(["p1", "p3"]));
    await user.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => expect(shownPhotos()).toEqual(["p1", "p2", "p3"]));
  });

  it("keeps a failed Undo to try again", async () => {
    const user = userEvent.setup();
    const start = [album("a1", "Trip", ["p1", "p2"])];
    serve([beach, sunset], start);
    keepAlbums(start);
    render(<DesktopPhotos />);
    await ready();
    await openAlbum(user, /^Trip/);
    await user.click(await screen.findByRole("option", { name: "Sunset" }));
    await user.keyboard("{Delete}");
    await waitFor(() => expect(shownPhotos()).toEqual(["p1"]));
    mocked.changeAlbum.mockRejectedValueOnce(new Error("offline"));
    await user.keyboard("{Meta>}z{/Meta}");
    expect(await screen.findByText(/Undo did not work/)).toBeInTheDocument();
    expect(shownPhotos()).toEqual(["p1"]);
    await user.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => expect(shownPhotos()).toEqual(["p1", "p2"]));
  });

  it("keeps Undo for the photos that changed when a later one fails", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    const hidden: Record<string, boolean> = { p1: false, p2: false };
    mocked.changePhoto.mockImplementation(async (id, change) => {
      if (id === "p2" && change.hidden === true) throw new Error("no");
      hidden[id] = change.hidden === true;
      return { ...(id === "p1" ? beach : sunset), hidden: hidden[id] === true };
    });
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard("{Meta>}a{/Meta}{Meta>}l{/Meta}");
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledWith("p2", { hidden: true }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Beach" })).toBeNull());
    mocked.changePhoto.mockClear();
    await user.keyboard("{Meta>}z{/Meta}");
    expect(await screen.findByRole("button", { name: "Beach" })).toBeInTheDocument();
    expect(mocked.changePhoto).not.toHaveBeenCalledWith("p2", expect.anything());

    serve([
      { ...beach, hidden: hidden.p1 === true },
      { ...sunset, hidden: hidden.p2 === true },
    ]);
    await act(async () => library.announceChange("photos:another-window"));
    await waitFor(() => expect(shownPhotos()).toEqual(["p1", "p2"]));
  });

  it("shows keywords on the grid's thumbnails without titles", async () => {
    const tagged = { ...beach, keywords: ["seaside"] };
    serve([tagged]);
    const served = await mocked.loadLibrary();
    mocked.loadLibrary.mockResolvedValue({
      ...served,
      settings: { view: "all", showKeywords: true },
    });
    render(<DesktopPhotos />);
    await ready();
    expect(await screen.findByText("seaside")).toBeInTheDocument();
  });

  it("leaves Space and the arrows to a movie's own controls", async () => {
    const user = userEvent.setup();
    const movie = photo("m1", "Movie", new Date(2019, 9, 7, 9));
    serve([{ ...movie, mime: "video/mp4", duration_ms: 1000 }, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Movie"));
    const video = await waitFor(() => {
      const found = document.querySelector("video");
      expect(found).not.toBeNull();
      return found as HTMLVideoElement;
    });
    for (const key of [" ", "ArrowRight", "ArrowLeft"]) {
      // fireEvent answers false when a handler took the key from the movie's controls.
      expect(fireEvent.keyDown(video, { key })).toBe(true);
    }
    expect(document.querySelector("video")).toBe(video);
    expect(screen.getByRole("region", { name: /Movie, 1 of 2/ })).toBeInTheDocument();
    fireEvent.doubleClick(video);
    expect(document.querySelector("video")).toBe(video);
  });

  it("Control-Delete in an album leaves the library, as Command-Delete does", async () => {
    const user = userEvent.setup();
    const trip = album("a1", "Trip", ["p1"]);
    serve([beach], [trip]);
    let kept = beach;
    mocked.changePhoto.mockImplementation(async (_id, change) => {
      kept = { ...beach, deleted_ms: change.deleted === true ? NOW_MS : null };
      return kept;
    });
    render(<DesktopPhotos />);
    await ready();
    await openAlbum(user, /^Trip/);
    await user.click(await screen.findByRole("option", { name: "Beach" }));
    await user.keyboard("{Control>}{Delete}{/Control}");
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { deleted: true }));
    expect(mocked.changeAlbum).not.toHaveBeenCalled();
    await waitFor(() => expect(shownPhotos()).toEqual([]));
    await user.click(within(tree()).getByRole("treeitem", { name: /^Photos/ }));
    await waitFor(() => expect(shownPhotos()).toEqual([]));

    serve([kept], [trip]);
    await act(async () => library.announceChange("photos:another-window"));
    await act(async () => {});
    expect(shownPhotos()).toEqual([]);
    await openAlbum(user, /^Trip/);
    await waitFor(() => expect(shownPhotos()).toEqual([]));
  });

  it("does not show a hidden photo as an album's icon", async () => {
    const hidden = { ...beach, hidden: true };
    serve([hidden, sunset], [{ ...album("a1", "Trip", ["p1", "p2"]), key_photo: "p1" }]);
    mocked.readThumbs.mockImplementation(
      async (ids) =>
        new Map(ids.map((id) => [id, new Blob([id === "p1" ? "hidden photo" : "p2"])])),
    );
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => `blob:${(blob as Blob).size}`);
    render(<DesktopPhotos />);
    await ready();
    const row = within(tree()).getByRole("treeitem", { name: /^Trip/ });
    await waitFor(() => expect(row.querySelector("img")).not.toBeNull());
    expect(row.querySelector("img")?.getAttribute("src")).toBe("blob:2");
  });

  it("two quick presses of Hide hide the photo and show it again", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    let release = () => {};
    const first = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sent: unknown[] = [];
    mocked.changePhoto.mockImplementation(async (_id, change) => {
      sent.push(change.hidden);
      if (sent.length === 1) await first;
      return { ...beach, hidden: change.hidden === true };
    });
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard("{Meta>}l{/Meta}{Meta>}l{/Meta}");
    release();
    await waitFor(() => expect(sent).toEqual([true, false]));
    expect(await screen.findByRole("button", { name: "Beach" })).toBeInTheDocument();
  });

  it("does not carry a title being typed over to the next photo chosen", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Beach"));
    await user.keyboard("{Meta>}i{/Meta}");
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "Pier");
    await user.click(tile("Sunset"));
    await waitFor(() => expect(mocked.changePhoto).toHaveBeenCalledWith("p1", { title: "Pier" }));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("");
    expect(mocked.changePhoto).not.toHaveBeenCalledWith("p2", expect.anything());
  });

  it("Cut leaves an album alone until the photo is pasted into another", async () => {
    const user = userEvent.setup();
    const start = [album("a1", "From", ["p1"]), album("a2", "To", [])];
    serve([beach], start);
    keepAlbums(start);
    render(<DesktopPhotos />);
    await ready();
    await openAlbum(user, /^From/);
    await user.click(await screen.findByRole("option", { name: "Beach" }));
    await user.keyboard("{Meta>}x{/Meta}");
    expect(mocked.changeAlbum).not.toHaveBeenCalled();
    expect(shownPhotos()).toEqual(["p1"]);
    await openAlbum(user, /^To/);
    await user.keyboard("{Meta>}v{/Meta}");
    await waitFor(() => expect(shownPhotos()).toEqual(["p1"]));
    expect(mocked.changeAlbum).toHaveBeenCalledWith("a2", { add: ["p1"], from: "a1" });
    await openAlbum(user, /^From/);
    await waitFor(() => expect(shownPhotos()).toEqual([]));
  });

  it("keeps a Cut to paste again when the move fails", async () => {
    const user = userEvent.setup();
    const start = [album("a1", "From", ["p1"]), album("a2", "To", [])];
    serve([beach], start);
    keepAlbums(start);
    render(<DesktopPhotos />);
    await ready();
    await openAlbum(user, /^From/);
    await user.click(await screen.findByRole("option", { name: "Beach" }));
    await user.keyboard("{Meta>}x{/Meta}");
    await openAlbum(user, /^To/);
    mocked.changeAlbum.mockRejectedValueOnce(new Error("offline"));
    await user.keyboard("{Meta>}v{/Meta}");
    expect(await screen.findByText(/did not work/)).toBeInTheDocument();
    expect(shownPhotos()).toEqual([]);
    await user.keyboard("{Meta>}v{/Meta}");
    await waitFor(() => expect(shownPhotos()).toEqual(["p1"]));
  });

  it("knows Option-Command-N by its key, as Option changes the letter on a Mac", async () => {
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    fireEvent.keyDown(tile("Beach"), { key: "˜", code: "KeyN", metaKey: true, altKey: true });
    expect(await screen.findByRole("textbox", { name: "Smart Album name" })).toBeInTheDocument();
  });

  it("does not rotate a movie from the key", async () => {
    const user = userEvent.setup();
    const movie = photo("m1", "Movie", new Date(2019, 9, 7, 9));
    serve([{ ...movie, mime: "video/mp4", duration_ms: 1000 }]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Movie"));
    await user.keyboard("{Meta>}r{/Meta}");
    await act(async () => {});
    expect(mocked.changePhoto).not.toHaveBeenCalled();
  });

  it("leaves Return on the editor's Cancel to Cancel, and saves nothing", async () => {
    const user = userEvent.setup();
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    await user.dblClick(tile("Beach"));
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    cancel.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Done" })).toBeNull());
    expect(mocked.changePhoto).not.toHaveBeenCalled();
  });

  it("Shift-Command-A clears the selection with the grid focused, and does not select all", async () => {
    const user = userEvent.setup();
    serve([beach, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(screen.getByRole("button", { name: "All Photos" }));
    const grid = await screen.findByRole("listbox", { name: "Photos" });
    await user.click(within(grid).getByRole("option", { name: "Beach" }));
    await user.keyboard("{Meta>}a{/Meta}");
    const chosen = () => document.querySelectorAll("[data-photo-id][data-selected]").length;
    await waitFor(() => expect(chosen()).toBe(2));
    grid.focus();
    await user.keyboard("{Shift>}{Meta>}a{/Meta}{/Shift}");
    await waitFor(() => expect(chosen()).toBe(0));
  });

  it("does not open the editor with Return on a photo in Recently Deleted", async () => {
    const user = userEvent.setup();
    serve([{ ...beach, deleted_ms: Date.now() }]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(within(tree()).getByRole("treeitem", { name: "Recently Deleted" }));
    const grid = await screen.findByRole("listbox", { name: "Recently Deleted" });
    await user.click(within(grid).getByRole("option", { name: "Beach" }));
    await user.keyboard("{Enter}");
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    await user.keyboard(" ");
    await waitFor(() => expect(document.querySelector(".mac-photos-viewer")).not.toBeNull());
    (document.querySelector(".mac-photos-viewer") as HTMLElement).focus();
    await user.keyboard("{Enter}");
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    expect(mocked.changePhoto).not.toHaveBeenCalled();
  });

  it("opens the photo Spotlight asks for", async () => {
    serve([photo("p7", "Found", new Date(2019, 9, 7, 9)), sunset]);
    openItem({ app: "photos", id: "p7", title: "Found" });
    render(<DesktopPhotos />);
    await ready();
    expect(await screen.findByRole("button", { name: /^Edit$/ })).toBeInTheDocument();
  });

  it("keeps movies in a slideshow, and plays one alone", async () => {
    const user = userEvent.setup();
    const movie = { ...photo("m1", "Movie", new Date(2019, 9, 7, 9)), mime: "video/webm" };
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    serve([movie, sunset]);
    const { unmount } = render(<DesktopPhotos />);
    await ready();
    await user.click(screen.getByRole("button", { name: "Slideshow" }));
    await waitFor(() =>
      expect(document.querySelector(".mac-photos-stage-place")?.textContent).toBe("1 of 2"),
    );
    unmount();

    serve([movie]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(screen.getByRole("button", { name: "Slideshow" }));
    await waitFor(() => expect(document.querySelector(".mac-photos-stage video")).not.toBeNull());
    expect(document.querySelector(".mac-photos-stage-place")?.textContent).toBe("1 of 1");
    expect(screen.queryByRole("alert")).toBeNull();
    await waitFor(() => expect(play).toHaveBeenCalled());
    play.mockRestore();
  });

  it("shows only the selection when it holds a movie and a picture", async () => {
    const user = userEvent.setup();
    const movie = { ...photo("m1", "Movie", new Date(2019, 9, 7, 9)), mime: "video/webm" };
    const other = photo("p9", "Other", new Date(2019, 9, 7, 10));
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    serve([movie, sunset, other]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Movie"));
    await user.keyboard("{Meta>}");
    await user.click(tile("Other"));
    await user.keyboard("{/Meta}");
    await user.click(screen.getByRole("button", { name: "Slideshow" }));
    await waitFor(() =>
      expect(document.querySelector(".mac-photos-stage-place")?.textContent).toBe("1 of 2"),
    );
    play.mockRestore();
  });

  it("goes on with the movie selected among pictures", async () => {
    const user = userEvent.setup();
    const movie = { ...photo("m1", "Movie", new Date(2019, 9, 7, 9)), mime: "video/webm" };
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    serve([movie, sunset]);
    render(<DesktopPhotos />);
    await ready();
    await user.click(tile("Movie"));
    await user.click(screen.getByRole("button", { name: "Slideshow" }));
    await waitFor(() => expect(document.querySelector(".mac-photos-stage video")).not.toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    play.mockRestore();
  });

  it("leaves Command-V to the browser while none of its own photos is copied", async () => {
    serve([beach]);
    render(<DesktopPhotos />);
    await ready();
    const event = createEvent.keyDown(tile("Beach"), { key: "v", metaKey: true });
    fireEvent(tile("Beach"), event);
    expect(event.defaultPrevented).toBe(false);
    expect(mocked.importPicture).not.toHaveBeenCalled();
  });
});
