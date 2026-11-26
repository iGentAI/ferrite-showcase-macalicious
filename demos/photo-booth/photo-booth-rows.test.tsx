import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { type DesktopDrag, filesOfDrag, registerDropTarget } from "../desktop/desktop-drag";
import { receiveDesktopValues } from "../desktop/desktop-personal";
import type { LibraryPhoto } from "../photos/photos-library";
import * as library from "../photos/photos-library";
import { bakeEffect } from "./photo-booth-bake";
import { findEffect } from "./photo-booth-data";
import { DesktopPhotoBooth } from "./photo-booth-desktop";

/*
 * The window's camera and picture rows against a stand-in for the Photos library client (tested in
 * photos-library.test.ts). The camera is a fake stream, the canvas and Web Audio stubs, since jsdom has
 * none of them. A real browser runs them in photo-booth-census-journey.mjs.
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
    setDesktopPicture: vi.fn(),
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
  mocked.loadLibrary.mockImplementation(async () => ({
    photos: [...photos],
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
  mocked.readOriginal.mockImplementation(
    async () => new Blob(["the picture"], { type: "image/jpeg" }),
  );
  mocked.importPicture.mockImplementation(async (_blob, options) =>
    photo(options.id ?? "x", { effect: options.effect ?? null }),
  );
  mocked.setDesktopPicture.mockResolvedValue(true);
}

/** A camera of one white pixel's frame, drawn into a stub canvas. */
function camera(devices: MediaDeviceInfo[] = []) {
  const stream = {
    getTracks: () => [{ stop: vi.fn() }],
    getVideoTracks: () => [],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn(async (_asked: MediaStreamConstraints) => stream);
  vi.stubGlobal("navigator", {
    ...navigator,
    mediaDevices: { getUserMedia, enumerateDevices: async () => devices },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event("loadeddata"));
  });
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(1);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(1);
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray([255, 255, 255, 255]),
      width: 1,
      height: 1,
    })),
    putImageData: vi.fn(),
    fillStyle: "",
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
    done(new Blob(["jpeg"], { type: "image/jpeg" })),
  );
  return { context, getUserMedia };
}

/** Web Audio's parts as far as a shutter needs them, counting the sounds begun. */
function audio() {
  const started = vi.fn();
  const node = () => ({ connect: <T,>(next: T) => next });
  class Context {
    state = "running";
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    createBuffer = () => ({ getChannelData: () => new Float32Array(400) });
    createBufferSource = () => ({ ...node(), buffer: null, start: started });
    createBiquadFilter = () => ({ ...node(), type: "", frequency: { value: 0 } });
    createGain = () => ({
      ...node(),
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    });
  }
  vi.stubGlobal("AudioContext", Context);
  return started;
}

function CameraMenu() {
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="Camera">{useDesktopAppMenuItems("photo-booth", "Camera")}</MenuBarMenu>
    </MenuBar>
  );
}

const take = () => screen.getByRole("button", { name: "Take Photo" });
const thumb = (name: string) => screen.findByRole("button", { name });
const menuItem = (name: string) => screen.findByRole("menuitem", { name });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  act(() => receiveDesktopValues(null));
});

describe("computed effects in the camera view", () => {
  it("paints the frame under the effect over the video it reads", async () => {
    serve([]);
    const { context } = camera();
    render(<DesktopPhotoBooth defaultView="camera" defaultEffect="sepia" />);
    await waitFor(() => expect(take()).toBeEnabled());
    const canvas = document.querySelector(".mac-photo-booth-frame canvas");
    expect(canvas).toHaveAttribute("data-effect", "sepia");
    await waitFor(() => expect(context.putImageData).toHaveBeenCalled());
    const [image] = context.putImageData.mock.lastCall as unknown as [{ data: Uint8ClampedArray }];
    expect([...image.data]).toEqual([255, 240, 178, 255]);
    // The video stays under it: the picture is taken from a video that is on the page.
    expect(document.querySelector(".mac-photo-booth-frame video")).not.toBeNull();
  });

  it("shows an effect from an older page as the plain camera", async () => {
    serve([]);
    camera();
    render(<DesktopPhotoBooth defaultView="camera" defaultEffect="an-old-effect" />);
    await waitFor(() => expect(take()).toBeEnabled());
    expect(document.querySelector(".mac-photo-booth-frame canvas")).toBeNull();
    expect(document.querySelector<HTMLElement>(".mac-photo-booth-frame video")?.style.filter).toBe(
      "",
    );
  });

  it("bakes the computed effect, not its CSS, into a saved frame", () => {
    const { context } = camera();
    vi.stubGlobal(
      "DOMMatrix",
      class {
        a = 1;
        b = 0;
        c = 0;
        d = 1;
        e = 0;
        f = 0;
      },
    );
    const source = document.createElement("canvas");
    bakeEffect(source, 1, 1, findEffect("bulge"));
    expect(context.transform).not.toHaveBeenCalled();
    expect(context.putImageData).toHaveBeenCalledTimes(1);
    bakeEffect(source, 1, 1, findEffect("sepia"));
    const [image] = context.putImageData.mock.lastCall as unknown as [{ data: Uint8ClampedArray }];
    expect([...image.data]).toEqual([255, 240, 178, 255]);
    bakeEffect(source, 1, 1, { id: "turned", name: "Turned", transform: "rotate(-12deg)" });
    expect(context.transform).toHaveBeenCalledTimes(1);
  });
});

describe("the shutter", () => {
  it("sounds its two clicks once for each picture taken", async () => {
    serve([]);
    camera();
    const started = audio();
    render(<DesktopPhotoBooth defaultView="camera" />);
    await waitFor(() => expect(take()).toBeEnabled());
    fireEvent.click(take(), { altKey: true });
    await waitFor(() => expect(mocked.importPicture).toHaveBeenCalledTimes(1));
    expect(started).toHaveBeenCalledTimes(2);
  });

  it("is silent under Mute", async () => {
    serve([]);
    camera();
    const started = audio();
    act(() => receiveDesktopValues({ "sound.mute": true }));
    render(<DesktopPhotoBooth defaultView="camera" />);
    await waitFor(() => expect(take()).toBeEnabled());
    fireEvent.click(take(), { altKey: true });
    await waitFor(() => expect(mocked.importPicture).toHaveBeenCalledTimes(1));
    expect(started).not.toHaveBeenCalled();
  });
});

describe("sharing a picture", () => {
  it("offers no Share button until a picture is chosen, then its rows", async () => {
    const user = userEvent.setup();
    serve([photo("one", { effect: "sepia" })]);
    camera();
    render(<DesktopPhotoBooth defaultView="camera" />);
    const picture = await thumb("Photo 1, Sepia");
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    await user.click(picture);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    expect(await menuItem("Mail")).toBeTruthy();
    expect(await menuItem("Messages")).toBeTruthy();
    expect(await menuItem("Notes")).toBeTruthy();
    expect(await menuItem("AirDrop")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Mail" })).toBeNull());
    // Escape closed the menu only: the picture is still shown.
    expect(screen.getByRole("button", { name: "Back to Camera" })).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Share" }));
    await user.click(await menuItem("Set Desktop Picture"));
    await waitFor(() => expect(mocked.setDesktopPicture).toHaveBeenCalledTimes(1));
    expect(mocked.setDesktopPicture.mock.calls[0]?.[0]).toMatchObject({ id: "one" });
  });

  it("gives the reason a movie clip cannot be the desktop picture", async () => {
    const user = userEvent.setup();
    serve([photo("one", { mime: "video/webm", duration_ms: 1000 })]);
    camera();
    render(<DesktopPhotoBooth defaultView="camera" />);
    await user.click(await thumb("Clip 1, Normal"));
    await user.click(await screen.findByRole("button", { name: "Share" }));
    const row = await menuItem("Set Desktop Picture");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("data-reason", "A movie clip can’t be the desktop picture.");
    const contact = await menuItem("Set Contact Picture…");
    expect(contact).toHaveAttribute("aria-disabled", "true");
    expect(contact).toHaveAttribute("data-reason", "A movie clip can’t be a contact’s picture.");
  });

  it("says a new picture is still being kept, and offers it as soon as it is", async () => {
    const user = userEvent.setup();
    const library: LibraryPhoto[] = [];
    serve(library);
    camera();
    let finish: () => void = () => {};
    mocked.importPicture.mockImplementation(
      (_blob, options) =>
        new Promise((resolve) => {
          finish = () => {
            const made = photo(options.id ?? "x", { effect: options.effect ?? null });
            library.push(made);
            resolve(made);
          };
        }),
    );
    render(<DesktopPhotoBooth defaultView="camera" countdownStepDuration={1} />);
    await waitFor(() => expect(take()).toBeEnabled());
    await act(async () => take().click());
    await waitFor(() => expect(mocked.importPicture).toHaveBeenCalledTimes(1));
    await user.click(await thumb("Photo 1, Normal"));
    await user.click(await screen.findByRole("button", { name: "Share" }));
    const row = await menuItem("Set Contact Picture…");
    expect(row).toHaveAttribute("data-reason", "This picture is still being kept.");
    await act(async () => finish());
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Set Contact Picture…" })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
  });

  it("has Export…, Print…, Flip Photo, Reveal in Finder, Share and Delete on a picture's menu", async () => {
    serve([photo("one")]);
    camera();
    render(<DesktopPhotoBooth defaultView="camera" />);
    fireEvent.contextMenu(await thumb("Photo 1, Normal"));
    await screen.findByRole("menuitem", { name: "Export…" });
    expect(screen.getAllByRole("menuitem").map((row) => row.textContent)).toEqual([
      "Export…",
      "Print…",
      "Flip Photo",
      "Reveal in Finder",
      "Share",
      "Delete",
    ]);
  });
});

describe("dragging a picture out of the strip", () => {
  it("hands what it lands on a copy of the picture, named with its extension", async () => {
    serve([photo("one", { name: "Photo Booth 2019" })]);
    camera();
    render(<DesktopPhotoBooth defaultView="camera" />);
    const picture = await thumb("Photo 1, Normal");
    const target = document.createElement("div");
    document.body.append(target);
    document.elementFromPoint = vi.fn(() => target);
    let landed: DesktopDrag | undefined;
    const remove = registerDropTarget({
      element: target,
      landing: (_hit, drag) => ({
        element: target,
        drop: () => {
          landed = drag;
        },
      }),
    });
    const pointer = { pointerId: 1, bubbles: true, button: 0 };
    fireEvent.pointerDown(picture, { ...pointer, clientX: 0, clientY: 0 });
    fireEvent(window, new PointerEvent("pointermove", { ...pointer, clientX: 40, clientY: 40 }));
    fireEvent(window, new PointerEvent("pointerup", { ...pointer, clientX: 40, clientY: 40 }));
    remove();
    target.remove();
    expect(landed?.from).toBe("photo-booth");
    const [file] = await filesOfDrag(landed?.items ?? []);
    expect(file?.name).toBe("Photo Booth 2019.jpg");
    expect(await file?.text()).toBe("the picture");
  });
});

describe("the Camera menu's microphones", () => {
  it("records a clip from the microphone chosen", async () => {
    const user = userEvent.setup();
    serve([]);
    const device = (kind: MediaDeviceKind, label: string, deviceId: string) =>
      ({ kind, label, deviceId, groupId: "", toJSON: () => ({}) }) as MediaDeviceInfo;
    const { getUserMedia } = camera([
      device("audioinput", "First Mic", "mic-1"),
      device("audioinput", "Second Mic", "mic-2"),
    ]);
    vi.stubGlobal(
      "MediaRecorder",
      Object.assign(
        class {
          state = "inactive";
          mimeType = "video/webm";
          addEventListener = vi.fn();
          start = vi.fn();
          stop = vi.fn();
        },
        { isTypeSupported: () => true },
      ),
    );
    vi.stubGlobal(
      "MediaStream",
      class {
        constructor(public tracks: unknown[]) {}
      },
    );
    HTMLCanvasElement.prototype.captureStream = () =>
      ({ getVideoTracks: () => [], getTracks: () => [] }) as unknown as MediaStream;
    render(
      <>
        <CameraMenu />
        <DesktopPhotoBooth defaultView="camera" />
      </>,
    );
    await waitFor(() => expect(take()).toBeEnabled());
    await user.click(screen.getByRole("menuitem", { name: "Camera" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Second Mic" }));
    fireEvent.click(screen.getByRole("button", { name: "Record a movie clip" }));
    fireEvent.click(screen.getByRole("button", { name: "Record Clip" }), { altKey: true });
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: "mic-2" } } }),
    );
  });
});
