import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { receiveDesktopValues } from "../desktop/desktop-personal";
import type { LibraryPhoto } from "../photos/photos-library";
import * as library from "../photos/photos-library";
import {
  boothPhotos,
  CAMERA_CHOICE,
  DesktopPhotoBooth,
  PHOTO_BOOTH_FOLDER,
  PHOTO_EFFECTS,
  pictureName,
} from "./photo-booth-desktop";

/*
 * Photo Booth's served window against a stand-in for the Photos library client
 * (`demos/photos/photos-library.ts`, tested in photos-library.test.ts): the requests to the
 * module and the drive are these doubles. The camera is a fake stream and the canvas a stub,
 * since jsdom has neither.
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

const take = () => screen.getByRole("button", { name: "Take Photo" });
const frame = () => screen.getByRole("region", { name: "Photo Booth" });
const strip = () =>
  [...(screen.queryByRole("list", { name: "Photos" })?.querySelectorAll("button") ?? [])].map(
    (thumb) => thumb.getAttribute("aria-label"),
  );
const notice = () => frame().querySelector(".mac-photo-booth-notice")?.textContent ?? null;

/** The fake library holds `photos`, and the doubles change it as the module would. */
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
  mocked.changePhoto.mockImplementation(async (id, change) => {
    const at = kept.findIndex((each) => each.id === id);
    const changed = photo(id, {
      ...kept[at],
      deleted_ms: "deleted" in change && change.deleted ? 2 : null,
    });
    if (at >= 0) kept[at] = changed;
    return changed;
  });
  mocked.importPicture.mockImplementation(async (_blob, options) => {
    const added = photo(options.id ?? "x", {
      effect: options.effect ?? null,
      taken_ms: options.takenMs ?? 1,
    });
    kept.push(added);
    return added;
  });
  return kept;
}

/** A camera for the page: a fake stream and a 640 by 480 video, drawn into a stub canvas. */
function camera() {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
    getVideoTracks: () => [],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
  vi.stubGlobal("navigator", {
    ...navigator,
    mediaDevices: { getUserMedia: vi.fn(async () => stream), enumerateDevices: async () => [] },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event("loadeddata"));
  });
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
  const pixels = { data: new Uint8ClampedArray(640 * 480 * 4), width: 640, height: 480 };
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    getImageData: vi.fn(() => pixels),
    putImageData: vi.fn(),
    fillStyle: "",
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
    done(new Blob(["jpeg"], { type: "image/jpeg" })),
  );
  return { stop, context };
}

beforeEach(() => {
  // Each double starts empty: what one test makes it answer never reaches another.
  for (const double of [
    mocked.loadLibrary,
    mocked.readThumbs,
    mocked.importPicture,
    mocked.changePhoto,
    mocked.readOriginal,
  ]) {
    double.mockReset();
  }
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:photo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("Photo Booth on the desktop's Ferrite application", () => {
  it("names its effects with ids the Photos module keeps", () => {
    // The module keeps an effect that is a short plain id (src/apps/photos, check_new).
    for (const effect of PHOTO_EFFECTS) expect(effect).toMatch(/^[a-z0-9._-]{1,32}$/);
    expect(PHOTO_EFFECTS).toHaveLength(33);
    expect(pictureName(new Date(2019, 9, 7, 14, 3, 22).getTime())).toBe(
      "Photo Booth 2019-10-07 at 14.03.22",
    );
  });

  it("shows only its own pictures of the library, leaving out Recently Deleted", () => {
    const listed = boothPhotos([
      photo("b", { taken_ms: 2 }),
      photo("import", { source: "import" }),
      photo("a", { taken_ms: 1 }),
      photo("gone", { deleted_ms: 5 }),
    ]);
    expect(listed.map((each) => each.id)).toEqual(["a", "b"]);
  });

  it("is the demo, with no camera and no library, when the page is not served by the application", () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
    render(<DesktopPhotoBooth defaultView="camera" />);
    expect(take()).toBeEnabled();
    expect(mocked.loadLibrary).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("lists its pictures from Photos, and Delete moves one to Recently Deleted", async () => {
    const user = userEvent.setup();
    serve([photo("one", { effect: "sepia" }), photo("two", { effect: "x-ray", taken_ms: 2 })]);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
    render(<DesktopPhotoBooth defaultView="camera" />);
    expect(frame()).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    expect(strip()).toEqual(["Photo 1, Sepia", "Photo 2, X-Ray"]);
    expect(take()).toBeDisabled();
    expect(notice()).toMatch(/^This page cannot use a camera/);
    await waitFor(() =>
      expect(frame().querySelectorAll("img.mac-photo-booth-taken")).toHaveLength(2),
    );
    // The effect is in the picture: the strip draws it as it is.
    const shown = frame().querySelector("img.mac-photo-booth-taken") as HTMLImageElement;
    expect(shown.style.filter).toBe("");
    expect(mocked.readThumbs).toHaveBeenCalledWith(["one", "two"]);

    screen.getByRole("button", { name: "Photo 1, Sepia" }).focus();
    await user.keyboard("{Delete}");
    await waitFor(() => expect(strip()).toEqual(["Photo 1, X-Ray"]));
    expect(mocked.changePhoto).toHaveBeenCalledWith("one", { deleted: true });
  });

  it("follows changes made in Photos: a picture deleted or recovered there", async () => {
    const kept = serve([photo("one", { effect: "sepia" }), photo("two", { taken_ms: 2 })]);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
    render(<DesktopPhotoBooth defaultView="camera" />);
    await waitFor(() => expect(strip()).toEqual(["Photo 1, Sepia", "Photo 2, Normal"]));
    // Photos moves the first to Recently Deleted and announces it.
    kept[0] = { ...kept[0], deleted_ms: 5 } as LibraryPhoto;
    act(() => library.announceChange());
    await waitFor(() => expect(strip()).toEqual(["Photo 1, Normal"]));
    // And recovers it.
    kept[0] = { ...kept[0], deleted_ms: null } as LibraryPhoto;
    act(() => library.announceChange());
    await waitFor(() => expect(strip()).toEqual(["Photo 1, Sepia", "Photo 2, Normal"]));
  });

  it("takes a picture with its effect drawn in and saves it into Photos", async () => {
    serve([]);
    const { stop, context } = camera();
    const announced = vi.fn();
    window.addEventListener(library.LIBRARY_CHANGED_EVENT, announced);
    // The live canvas draws too: without its frames, what is counted below is the saved picture alone.
    vi.stubGlobal("requestAnimationFrame", () => 1);
    const { unmount } = render(
      <DesktopPhotoBooth defaultView="camera" defaultEffect="sepia" countdownStepDuration={1} />,
    );
    await waitFor(() => expect(take()).toBeEnabled());
    await act(async () => take().click());
    await waitFor(() => expect(strip()).toEqual(["Photo 1, Sepia"]));
    await waitFor(() => expect(mocked.importPicture).toHaveBeenCalledTimes(1));
    const [blob, options] = mocked.importPicture.mock.calls[0] as [Blob, library.ImportOptions];
    expect(blob.type).toBe("image/jpeg");
    expect(options).toMatchObject({
      source: "photo-booth",
      effect: "sepia",
      folder: PHOTO_BOOTH_FOLDER,
    });
    expect(options.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(options.name).toMatch(/^Photo Booth \d{4}-\d{2}-\d{2} at \d{2}\.\d{2}\.\d{2}$/);
    // Sepia is a filter: its pixels were computed into the frame.
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(context.putImageData).toHaveBeenCalledTimes(1);
    expect(announced).toHaveBeenCalled();
    window.removeEventListener(library.LIBRARY_CHANGED_EVENT, announced);
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("stops the microphone and says so when a clip's canvas cannot be recorded", async () => {
    serve([]);
    camera();
    const stopVoice = vi.fn();
    const voice = { getTracks: () => [{ stop: stopVoice }], getAudioTracks: () => [] };
    const videoStream = { getTracks: () => [{ stop: vi.fn() }], getVideoTracks: () => [] };
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockImplementation(
      async (asked: MediaStreamConstraints) => (asked.audio ? voice : videoStream),
    );
    vi.stubGlobal("MediaRecorder", Object.assign(vi.fn(), { isTypeSupported: () => true }));
    HTMLCanvasElement.prototype.captureStream = () => {
      throw new Error("no capture here");
    };
    render(<DesktopPhotoBooth defaultView="camera" />);
    await waitFor(() => expect(take()).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record a movie clip" }));
    fireEvent.click(screen.getByRole("button", { name: "Record Clip" }), { altKey: true });
    expect(await screen.findByText(/The clip could not be started: no capture here/)).toBeTruthy();
    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Record Clip" })).toBeEnabled();
  });

  it("goes back to the shutter and says why when the recorder stops by itself", async () => {
    serve([]);
    camera();
    let recorder: EventTarget | undefined;
    vi.stubGlobal(
      "MediaRecorder",
      class extends EventTarget {
        static isTypeSupported = () => true;
        mimeType = "video/webm";
        state = "recording";
        constructor() {
          super();
          recorder = this;
        }
        start() {}
      },
    );
    vi.stubGlobal(
      "MediaStream",
      class {
        getTracks = () => [];
        getVideoTracks = () => [];
        getAudioTracks = () => [];
      },
    );
    HTMLCanvasElement.prototype.captureStream = () =>
      ({ getTracks: () => [], getVideoTracks: () => [] }) as unknown as MediaStream;
    render(<DesktopPhotoBooth defaultView="camera" />);
    await waitFor(() => expect(take()).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Record a movie clip" }));
    fireEvent.click(screen.getByRole("button", { name: "Record Clip" }), { altKey: true });
    await screen.findByRole("button", { name: "Stop" });
    await act(async () => {
      recorder?.dispatchEvent(
        Object.assign(new Event("error"), { error: { message: "the encoder quit" } }),
      );
      recorder?.dispatchEvent(new Event("stop"));
    });
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    expect(screen.getByRole("button", { name: "Effects" })).toBeEnabled();
    expect(screen.getByText(/The clip stopped: the encoder quit/)).toBeTruthy();
  });

  it("keeps the shutter off from a camera change until the next camera has a frame", async () => {
    serve([]);
    camera();
    const stopFirst = vi.fn();
    const first = {
      getTracks: () => [{ stop: stopFirst }],
      getVideoTracks: () => [{ label: "First", getSettings: () => ({ deviceId: "a" }) }],
      getAudioTracks: () => [],
    };
    const second = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ label: "Second", getSettings: () => ({ deviceId: "b" }) }],
      getAudioTracks: () => [],
    };
    const asks: { resolve: (stream: unknown) => void; reject: (error: unknown) => void }[] = [];
    const ask = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    ask.mockResolvedValueOnce(first).mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          asks.push({ resolve, reject });
        }),
    );
    vi.spyOn(navigator.mediaDevices, "enumerateDevices").mockResolvedValue([
      { kind: "videoinput", label: "First", deviceId: "a" },
      { kind: "videoinput", label: "Second", deviceId: "b" },
    ] as MediaDeviceInfo[]);
    render(<DesktopPhotoBooth defaultView="camera" />);
    await waitFor(() => expect(take()).toBeEnabled());

    act(() => receiveDesktopValues({ [CAMERA_CHOICE]: "Second" }));
    await waitFor(() => expect(asks).toHaveLength(1));
    expect(stopFirst).toHaveBeenCalled();
    expect(take()).toBeDisabled();

    await act(async () => asks[0]?.reject(new DOMException("no", "NotAllowedError")));
    expect(take()).toBeDisabled();
    expect(screen.getByText(/not allowed to use the camera/)).toBeTruthy();

    act(() => receiveDesktopValues({ [CAMERA_CHOICE]: "First" }));
    await waitFor(() => expect(asks).toHaveLength(2));
    expect(take()).toBeDisabled();
    await act(async () => asks[1]?.resolve(second));
    await waitFor(() => expect(take()).toBeEnabled());
    act(() => receiveDesktopValues(null));
  });

  it("shows a clicked picture large from its original, and goes back to the camera", async () => {
    const user = userEvent.setup();
    serve([photo("one", { effect: "sepia" }), photo("two", { effect: "x-ray" })]);
    camera();
    mocked.readOriginal.mockResolvedValue(new Blob(["full"], { type: "image/jpeg" }));
    render(<DesktopPhotoBooth defaultView="camera" />);
    await waitFor(() => expect(strip()).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: "Photo 1, Sepia" }));
    await waitFor(() => expect(mocked.readOriginal).toHaveBeenCalledTimes(1));
    expect(mocked.readOriginal.mock.calls[0]?.[0]).toMatchObject({ id: "one" });
    expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
    await waitFor(() => expect(frame().querySelector(".mac-photo-booth-viewed")).not.toBeNull());
    await user.click(screen.getByRole("button", { name: "Back to Camera" }));
    expect(frame().querySelector(".mac-photo-booth-viewed")).toBeNull();
    expect(screen.getByRole("button", { name: "Take Photo" })).toBeInTheDocument();
  });

  it("goes back to the camera when the picture shown is deleted", async () => {
    const user = userEvent.setup();
    serve([photo("one", { effect: "sepia" })]);
    camera();
    mocked.readOriginal.mockResolvedValue(new Blob(["full"], { type: "image/jpeg" }));
    render(<DesktopPhotoBooth defaultView="camera" />);
    await waitFor(() => expect(strip()).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Photo 1, Sepia" }));
    await user.keyboard("{Delete}");
    await waitFor(() => expect(strip()).toEqual([]));
    expect(screen.getByRole("button", { name: "Take Photo" })).toBeInTheDocument();
  });

  it("reads a picture's thumbnail again after Photos edits it", async () => {
    const kept = serve([photo("one", { effect: "sepia" })]);
    let made = 0;
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:${++made}`);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
    render(<DesktopPhotoBooth defaultView="camera" />);
    const shown = () =>
      frame().querySelector("img.mac-photo-booth-taken")?.getAttribute("src") ?? null;
    await waitFor(() => expect(shown()).toBe("blob:1"));
    // Photos rotates it: a new edit revision, and a new thumbnail.
    kept[0] = { ...kept[0], edited_ms: 7 } as LibraryPhoto;
    act(() => library.announceChange("photos:another-window"));
    await waitFor(() => expect(shown()).toBe("blob:2"));
    expect(mocked.readThumbs).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
  });

  it("keeps a saved shot when a read begun before the save answers after it", async () => {
    const kept = serve([]);
    camera();
    render(
      <DesktopPhotoBooth defaultView="camera" defaultEffect="sepia" countdownStepDuration={1} />,
    );
    await waitFor(() => expect(take()).toBeEnabled());
    // Another window's change starts a read that answers late, with the library before the shot.
    let answerLate: () => void = () => {};
    mocked.loadLibrary.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerLate = () =>
            resolve({
              photos: [],
              albums: [],
              purge: [],
              folders: [],
              smart_albums: [],
              keywords: [],
              projects: [],
              memories: { favorites: [], deleted: [], albums: [] },
              settings: {},
              limits: { photos: 1000, recently_deleted_days: 30 },
            });
        }),
    );
    act(() => library.announceChange("photos:another-window"));
    await act(async () => take().click());
    await waitFor(() => expect(kept).toHaveLength(1));
    await waitFor(() => expect(mocked.loadLibrary).toHaveBeenCalledTimes(3));
    await act(async () => answerLate());
    expect(strip()).toEqual(["Photo 1, Sepia"]);
  });

  it("tells Photos about a picture whose save ends after the window closed", async () => {
    serve([]);
    camera();
    let finish: () => void = () => {};
    const saving = mocked.importPicture.getMockImplementation();
    mocked.importPicture.mockImplementation(
      (blob, options) =>
        new Promise((resolve) => {
          finish = () => resolve(saving?.(blob, options) as Promise<LibraryPhoto>);
        }),
    );
    const announced = vi.fn();
    window.addEventListener(library.LIBRARY_CHANGED_EVENT, announced);
    const { unmount } = render(
      <DesktopPhotoBooth defaultView="camera" countdownStepDuration={1} />,
    );
    await waitFor(() => expect(take()).toBeEnabled());
    await act(async () => take().click());
    await waitFor(() => expect(mocked.importPicture).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => finish());
    await waitFor(() => expect(announced).toHaveBeenCalled());
    window.removeEventListener(library.LIBRARY_CHANGED_EVENT, announced);
  });

  it("drops a picture Photos could not keep, and says so", async () => {
    serve([]);
    camera();
    mocked.importPicture.mockRejectedValue(new Error("the drive is full"));
    render(<DesktopPhotoBooth defaultView="camera" countdownStepDuration={1} />);
    await waitFor(() => expect(take()).toBeEnabled());
    await act(async () => take().click());
    await waitFor(() =>
      expect(notice()).toMatch(/could not be saved to Photos.*the drive is full/),
    );
    expect(strip()).toEqual([]);
  });

  it("is inert while the library loads, and takes no picture when it cannot be read", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail: (error: Error) => void = () => {};
    mocked.loadLibrary.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    camera();
    render(<DesktopPhotoBooth defaultView="camera" />);
    expect(frame()).toHaveAttribute("aria-busy", "true");
    expect(frame()).toHaveAttribute("inert");
    await act(async () => fail(new Error("HTTP 503")));
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    expect(notice()).toMatch(/could not be read, so Photo Booth takes no picture/);
    expect(take()).toBeDisabled();
    expect(mocked.importPicture).not.toHaveBeenCalled();
  });
});
