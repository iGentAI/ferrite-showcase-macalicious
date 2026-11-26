import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { landingAt, registerDropTarget } from "../desktop/desktop-drag";
import { DESKTOP_EFFECTS_EVENT } from "../desktop/desktop-effects";
import {
  beginDesktopValues,
  changeDesktopValue,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { registerFileReceivers, takeSharedFiles } from "../desktop/desktop-share-link";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { appsForFile, registerFileOpeners } from "../finder/finder-open";
import { quicktimePlayerApp } from "./app";
import {
  type QuickTimeDrive,
  type QuickTimeMovieFile,
  QuickTimePlayerApp,
} from "./quicktime-player-app";
import { clipClipboard, clipsChosen } from "./quicktime-player-clips";
import { dataRateText, formatOf, modifiedText } from "./quicktime-player-facts";
import {
  QUICKTIME_OPEN_KEY,
  QUICKTIME_VOLUME_KEY,
  readOpenMovies,
  readVolume,
  withOpenMovie,
} from "./quicktime-player-recents";
import { replayMovie } from "./quicktime-player-replay";

vi.mock("./quicktime-player-replay", () => ({ replayMovie: vi.fn() }));
vi.mock("./quicktime-player-clips", async (original) => ({
  ...(await original<typeof import("./quicktime-player-clips")>()),
  movieLengthOf: vi.fn(async () => 5),
}));

/*
 * Test doubles: `shelf` stands in for the person's drive, keeping files in memory; `fetch` for the
 * recents route; object URLs are stand-in strings, since jsdom has none; `replayMovie` for the replay,
 * tested on its own, and `movieLengthOf`, which needs a real decoder. A desktop's window is a
 * `DesktopWindowHostContext` and an element with `data-window-id`. The real thing in a browser is
 * e2e/quicktime-player-census-journey.mjs.
 */
const HOST = { app: "quicktime-player", stage: () => null, place: () => ({}) };

const entry = (id: string, name: string, extra: Partial<QuickTimeMovieFile> = {}) => ({
  id,
  name,
  size: 2_000_000,
  type: "video/webm",
  ...extra,
});

function shelf(folders: Record<string, QuickTimeMovieFile[]> = {}) {
  const list = (id: string) => folders[id] ?? [];
  const made: QuickTimeMovieFile[] = [];
  return {
    read: vi.fn(async () => new Blob([new Uint8Array(1_000_000)], { type: "video/webm" })),
    movies: async () => [...list("movies"), ...made],
    upload: async (file: File) => {
      const kept = entry(`made-${made.length}`, file.name);
      made.push(kept);
      return kept;
    },
    places: async () => [
      { id: "documents", name: "Documents" },
      { id: "movies", name: "Movies" },
    ],
    contents: async (id: string) => list(id),
    rename: vi.fn(async (id: string, name: string) => entry(id, name)),
    move: vi.fn(async (id: string) => entry(id, "x")),
    folders: async () => [],
  } satisfies QuickTimeDrive;
}

function MenuOf({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("quicktime-player", title);
  return (
    <Menu>
      <MenuTrigger>{`Open ${title}`}</MenuTrigger>
      <MenuPopup aria-label={title}>{items}</MenuPopup>
    </Menu>
  );
}
const chooseRow = async (title: string, row: RegExp) => {
  fireEvent.click(screen.getByRole("button", { name: `Open ${title}` }));
  return screen.findByRole("menuitem", { name: row });
};

const inDesktop = (ui: React.ReactNode, id = "quicktime-player") => (
  <DesktopWindowHostContext value={HOST}>
    <div data-window-id={id}>{ui}</div>
  </DesktopWindowHostContext>
);

const movieNamed = (name: string) => screen.findByRole("region", { name });
const video = () => document.querySelector("video") as HTMLVideoElement;
const effects = () => {
  const heard: unknown[] = [];
  const hear = (event: Event) => heard.push(...(event as CustomEvent<unknown[]>).detail);
  window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
  return { heard, stop: () => window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear) };
};

beforeEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
  let made = 0;
  Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:movie-${++made}`),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ recents: null, rev: 0 }), { status: 200 })),
  );
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(320);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(180);
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(10);
  vi.mocked(replayMovie).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The movie `Holiday.webm` from a drive's Movies, showing, its length known. */
async function openHoliday(drive = shelf({ movies: [entry("f1", "Holiday.webm")] })) {
  const option = await screen.findByRole("option", { name: "Holiday.webm" });
  fireEvent.mouseDown(option);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const window = await movieNamed("Holiday.webm");
  fireEvent.loadedMetadata(video());
  fireEvent.timeUpdate(video());
  return { window, drive };
}

describe("The Open window", () => {
  it("lists the drive's folders in its sidebar, goes into a folder, and shows date and size", async () => {
    const drive = shelf({
      movies: [],
      documents: [
        entry("trip", "Trip", { folder: true, size: 0 }),
        entry("note", "Note.txt", { type: "text/plain" }),
      ],
      trip: [entry("t1", "Beach.webm", { size: 2_500_000, modified: Date.UTC(2026, 3, 17, 12) })],
    });
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    await screen.findByText(/Movies is empty/);
    fireEvent.mouseDown(await screen.findByRole("treeitem", { name: "Documents" }));
    const folder = await screen.findByRole("option", { name: "Trip" });
    expect(screen.queryByRole("option", { name: "Note.txt" })).toBeNull();
    fireEvent.doubleClick(folder);
    const beach = await screen.findByRole("option", { name: "Beach.webm" });
    expect(beach).toHaveTextContent("2.5 MB");
    expect(beach.textContent).toContain("Apr 17, 2026");
    expect(screen.getByText("Date Modified")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("option", { name: "Trip" });
  });

  it("shows the same movies as icons from its View pop-up", async () => {
    const drive = shelf({ movies: [entry("f1", "Holiday.webm")] });
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    await screen.findByRole("option", { name: "Holiday.webm" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "View" }));
    await user.click(await screen.findByRole("option", { name: "as Icons" }));
    await waitFor(() => expect(screen.queryByText("Date Modified")).toBeNull());
    expect(screen.getByRole("option", { name: "Holiday.webm" }).textContent).toBe("Holiday.webm");
  });

  it("shows the same movies as columns, opening a movie further along a folder", async () => {
    const drive = shelf({
      movies: [entry("f1", "Holiday.webm"), { ...entry("d1", "Trip"), folder: true }],
      d1: [entry("f2", "Beach.webm", { modified: 1_776_384_000_000 })],
    });
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    await screen.findByRole("option", { name: "Holiday.webm" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "View" }));
    await user.click(await screen.findByRole("option", { name: "as Columns" }));
    await waitFor(() => expect(screen.queryByText("Date Modified")).toBeNull());
    await user.click(await screen.findByRole("option", { name: "Trip" }));
    const open = screen.getByRole("button", { name: "Open" });
    expect(open).toBeDisabled();
    await user.click(await screen.findByRole("option", { name: "Beach.webm" }));
    expect(screen.getByText("2 MB")).toBeInTheDocument();
    expect(open).toBeEnabled();
    await user.click(open);
    await waitFor(() => expect(drive.read).toHaveBeenCalledWith("f2", expect.anything()));
  });

  it("shows the same movies as a gallery: the selected one's facts over the strip", async () => {
    const drive = shelf({
      movies: [entry("f1", "Holiday.webm"), entry("f2", "Beach.webm", { size: 3_000_000 })],
    });
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    await screen.findByRole("option", { name: "Holiday.webm" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "View" }));
    await user.click(await screen.findByRole("option", { name: "as Gallery" }));
    await user.click(await screen.findByRole("option", { name: "Beach.webm" }));
    expect(screen.getByText("3 MB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeEnabled();
    expect(drive.read).not.toHaveBeenCalled();
  });

  it("opens several movies chosen in a window each", async () => {
    const drive = shelf({
      movies: [entry("f1", "One.webm"), entry("f2", "Two.webm"), entry("f3", "Three.webm")],
    });
    const heard = effects();
    render(inDesktop(<QuickTimePlayerApp drive={drive} served={false} />));
    fireEvent.mouseDown(await screen.findByRole("option", { name: "One.webm" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Three.webm" }), { metaKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await movieNamed("One.webm");
    heard.stop();
    expect(heard.heard).toEqual([
      { newWindow: "quicktime-player", opening: { id: "f3", name: "Three.webm" } },
    ]);
  });

  it("opens several movies dropped on it in a window each", async () => {
    const heard = effects();
    const drive = shelf({ movies: [] });
    render(inDesktop(<QuickTimePlayerApp drive={drive} served />));
    await screen.findByText(/Movies is empty/);
    act(() =>
      landingAt(screen.getByRole("listbox", { name: "Movies" }), {
        from: "finder",
        copy: false,
        items: [
          { id: "f1", name: "One.webm", kind: "file" },
          { id: "f2", name: "Two.webm", kind: "file" },
        ],
      })?.drop(),
    );
    await movieNamed("One.webm");
    heard.stop();
    expect(heard.heard).toEqual([
      { newWindow: "quicktime-player", opening: { id: "f2", name: "Two.webm" } },
    ]);
  });

  it("in a window opened for one more movie, opens that movie", async () => {
    const drive = shelf();
    render(
      inDesktop(
        <QuickTimePlayerApp
          drive={drive}
          served={false}
          opening={{ id: "f3", name: "Three.webm" }}
        />,
        "quicktime-player:2",
      ),
    );
    await movieNamed("Three.webm");
    expect(drive.read).toHaveBeenCalledWith("f3", expect.any(Function));
  });
});

describe("What comes back after a reload", () => {
  it("keeps the volume as a setting and opens the next movie at it", async () => {
    changeDesktopValue(QUICKTIME_VOLUME_KEY, 0.4);
    render(
      <QuickTimePlayerApp
        drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
        served={false}
      />,
    );
    await openHoliday();
    expect(video().volume).toBeCloseTo(0.4);
    fireEvent.click(screen.getByRole("button", { name: "Full Volume" }));
    expect(desktopValues()[QUICKTIME_VOLUME_KEY]).toBe(1);
    expect(readVolume(7)).toBeUndefined();
  });

  it("keeps the open movie by window, gives it up on leaving, and reopens what was kept", async () => {
    const drive = shelf({ movies: [entry("f1", "Holiday.webm")] });
    const first = render(inDesktop(<QuickTimePlayerApp drive={drive} served />));
    await openHoliday();
    await waitFor(() =>
      expect(desktopValues()[QUICKTIME_OPEN_KEY]).toEqual({
        "quicktime-player": { id: "f1", name: "Holiday.webm" },
      }),
    );
    first.unmount();
    expect(desktopValues()[QUICKTIME_OPEN_KEY]).toEqual({});

    changeDesktopValue(
      QUICKTIME_OPEN_KEY,
      withOpenMovie({}, "quicktime-player", { id: "f1", name: "Holiday.webm" }),
    );
    render(inDesktop(<QuickTimePlayerApp drive={drive} served />));
    await movieNamed("Holiday.webm");
    expect(drive.read).toHaveBeenCalledTimes(2);
    expect(readOpenMovies({ a: { id: 1 }, b: { id: "f", name: "n" } })).toEqual({
      b: { id: "f", name: "n" },
    });
  });
});

/** A movie with its clips showing: cut at 2 and 5, so 0-2, 2-5 and 5-10. */
async function holidayWithClips() {
  vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockReturnValue(2);
  const { window } = await openHoliday();
  fireEvent.timeUpdate(video());
  fireEvent.keyDown(window, { key: "y", metaKey: true });
  vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockReturnValue(5);
  fireEvent.timeUpdate(video());
  fireEvent.keyDown(window, { key: "y", metaKey: true });
  await screen.findByRole("button", { name: /^Clip 3 of 3/ });
  return window;
}
const clip = (n: number) => screen.getByRole("button", { name: new RegExp(`^Clip ${n} of`) });
const replayedSpans = () =>
  (
    (vi.mocked(replayMovie).mock.calls[0]?.[0] ?? []) as unknown as {
      start: number;
      end: number;
    }[]
  ).map(({ start, end }) => [start, end]);

describe("Several clips in the strip", () => {
  beforeEach(() => {
    vi.mocked(replayMovie).mockResolvedValue(new Blob(["edit"], { type: "video/webm" }));
  });

  it("chooses by plain, Command and Shift clicks", () => {
    expect(clipsChosen([1], 3)).toEqual([3]);
    expect(clipsChosen([1], 3, { toggle: true })).toEqual([1, 3]);
    expect(clipsChosen([1, 3], 3, { toggle: true })).toEqual([1]);
    expect(clipsChosen([1], 3, { extend: true })).toEqual([1, 2, 3]);
    expect(clipsChosen([], 2, { extend: true })).toEqual([2]);
  });

  it("deletes and copies the clips chosen together", async () => {
    render(
      <QuickTimePlayerApp
        drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
        served={false}
      />,
    );
    const window = await holidayWithClips();
    fireEvent.click(clip(1));
    fireEvent.click(clip(3), { metaKey: true });
    expect(clip(1)).toHaveAttribute("aria-pressed", "true");
    expect(clip(2)).toHaveAttribute("aria-pressed", "false");
    expect(clip(3)).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "c", metaKey: true });
    expect(clipClipboard.read()?.map(({ start, end }) => [start, end])).toEqual([
      [0, 2],
      [5, 10],
    ]);
    await act(async () => {
      fireEvent.keyDown(clip(1), { key: "Delete" });
    });
    expect(replayedSpans()).toEqual([[2, 5]]);
  });

  it("inserts a movie after the selection from the Edit menu", async () => {
    render(
      <>
        <QuickTimePlayerApp
          drive={shelf({
            movies: [entry("f1", "Holiday.webm"), entry("f2", "Extra.webm")],
          })}
          served={false}
        />
        <MenuOf title="Edit" />
      </>,
    );
    await holidayWithClips();
    fireEvent.click(clip(1));
    fireEvent.click(await chooseRow("Edit", /^Insert Clip After Selection/));
    const dialog = await screen.findByRole("alertdialog");
    within(dialog).getByText("Insert Clip After Selection");
    fireEvent.mouseDown(await within(dialog).findByRole("option", { name: "Extra.webm" }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Insert" }));
    });
    await waitFor(() => expect(replayMovie).toHaveBeenCalled());
    expect(replayedSpans()).toEqual([
      [0, 2],
      [0, 5],
      [2, 5],
      [5, 10],
    ]);
  });

  it("dims Insert Clip After Selection with its reason when no clip is chosen", async () => {
    render(
      <>
        <QuickTimePlayerApp
          drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
          served={false}
        />
        <MenuOf title="Edit" />
      </>,
    );
    await openHoliday();
    const row = await chooseRow("Edit", /^Insert Clip After Selection/);
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("title", "Choose a clip in the strip first: View > Show Clips.");
  });

  it("takes a movie dropped on the strip at the gap under the pointer, and refuses anything else", async () => {
    render(
      <QuickTimePlayerApp
        drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
        served={false}
      />,
    );
    await holidayWithClips();
    const strip = clip(1).closest(".mac-quicktime-player-clips") as Element;
    expect(
      landingAt(clip(1), {
        from: "finder",
        copy: false,
        items: [{ id: "p", name: "Paper.pdf", kind: "file", type: "application/pdf" }],
      })?.refusal,
    ).toBe("Only movies can be added to a movie.");
    await act(async () => {
      landingAt(strip, {
        from: "finder",
        copy: false,
        // jsdom lays nothing out, so every clip's middle is at 0 and a pointer at 0 is past them all.
        at: { x: 0, y: 0 },
        items: [
          {
            id: "m",
            name: "Dropped.webm",
            kind: "file",
            type: "video/webm",
            bytes: async () => new Blob(["dropped"], { type: "video/webm" }),
          },
        ],
      })?.drop();
    });
    await waitFor(() => expect(replayMovie).toHaveBeenCalled());
    expect(replayedSpans()).toEqual([
      [0, 2],
      [2, 5],
      [5, 10],
      [0, 5],
    ]);
  });

  it("gives a clip dragged out of the strip to what takes it, made by a replay", async () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => true });
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    const drops: { name: string; bytes?: () => Promise<Blob> }[] = [];
    const target = document.createElement("div");
    document.body.append(target);
    const stop = registerDropTarget({
      element: target,
      landing: (_hit, drag) => ({
        element: target,
        drop: () => drops.push(...drag.items),
      }),
    });
    document.elementFromPoint = () => target;
    render(
      <QuickTimePlayerApp
        drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
        served={false}
      />,
    );
    await holidayWithClips();
    const press = { pointerId: 1, button: 0, clientX: 10, clientY: 0 };
    fireEvent.pointerDown(clip(2), press);
    fireEvent.pointerMove(clip(2), { ...press, clientY: 40 });
    fireEvent.pointerMove(window, { ...press, clientY: 60 });
    fireEvent.pointerUp(window, { ...press, clientY: 60 });
    stop();
    target.remove();
    expect(drops.map((item) => item.name)).toEqual(["Holiday clip 2.webm"]);
    vi.mocked(replayMovie).mockResolvedValue(new Blob(["clip"], { type: "video/webm" }));
    await act(async () => {
      await drops[0]?.bytes?.();
    });
    expect(replayedSpans()).toEqual([[2, 5]]);
  });
});

describe("Window > Show Export Progress", () => {
  it("lists the export under way with a Stop that stops it, and the ones that ended", async () => {
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(1080);
    vi.mocked(replayMovie).mockImplementation(
      (_movie, _edit, _progress, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("stopped")));
        }),
    );
    render(
      <>
        <QuickTimePlayerApp
          drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
          served={false}
        />
        <MenuOf title="File" />
        <MenuOf title="Window" />
      </>,
    );
    await openHoliday();
    fireEvent.click(await chooseRow("Window", /^Show Export Progress/));
    const panel = await screen.findByRole("group", { name: "Export Progress" }).catch(() => null);
    const inside = () =>
      within((panel ?? document.querySelector(".mac-quicktime-player-exports")) as HTMLElement);
    expect(inside().getByText("No exports.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open File" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export As" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "720p" }));
    await inside().findByText("Holiday.webm, 720p");
    await act(async () => {
      fireEvent.click(inside().getByRole("button", { name: "Stop" }));
    });
    await inside().findByText("Stopped");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("The Movie Inspector", () => {
  it("says the format, size and data rate from the file, and the frame rate measured", async () => {
    let frame: VideoFrameRequestCallback = () => {};
    Object.assign(HTMLVideoElement.prototype, {
      requestVideoFrameCallback: (next: VideoFrameRequestCallback) => {
        frame = next;
        return 1;
      },
      cancelVideoFrameCallback: () => {},
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const shown = render(
      <QuickTimePlayerApp
        drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
        served={false}
      />,
    );
    const { window } = await openHoliday();
    fireEvent.keyDown(window, { key: "i", metaKey: true });
    const rows = (document.querySelector(".mac-quicktime-player-inspector-rows") as HTMLElement)
      .textContent;
    expect(rows).toContain("FormatWebM");
    expect(rows).toContain("FPSMeasured while it plays");
    expect(rows).toContain("Data Size1 MB");
    expect(rows).toContain("Data Rate800 kbit/s");

    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument());
    act(() => {
      for (let n = 0; n <= 24; n += 1) {
        frame(0, { mediaTime: n / 25 } as VideoFrameCallbackMetadata);
      }
    });
    expect(
      (document.querySelector(".mac-quicktime-player-inspector-rows") as HTMLElement).textContent,
    ).toContain("FPS25");
    shown.unmount();
    Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback");
    Reflect.deleteProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback");
  });

  it("words a file's container, data rate and date", () => {
    expect(formatOf("video/webm;codecs=vp8", "a.bin")).toBe("WebM");
    expect(formatOf("", "a.MOV")).toBe("QuickTime");
    expect(formatOf(undefined, "a")).toBe("Unknown");
    expect(dataRateText(1_000_000, 1)).toBe("8.00 Mbit/s");
    expect(dataRateText(16_000, 1)).toBe("128 kbit/s");
    expect(dataRateText(1, 0)).toBe("Unknown");
    expect(modifiedText(undefined)).toBe("--");
    expect(modifiedText(new Date(2018, 3, 17, 22, 11).getTime())).toBe("Apr 17, 2018 at 10:11 PM");
  });
});

describe("View > Play All Movies", () => {
  it("plays the movie of every window", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    render(
      <>
        <QuickTimePlayerApp
          drive={shelf()}
          served={false}
          opening={{ id: "a", name: "First.webm" }}
        />
        <QuickTimePlayerApp
          drive={shelf()}
          served={false}
          opening={{ id: "b", name: "Second.webm" }}
        />
        <MenuOf title="View" />
      </>,
    );
    await movieNamed("First.webm");
    await movieNamed("Second.webm");
    for (const each of document.querySelectorAll("video")) fireEvent.loadedMetadata(each);
    fireEvent.click(await chooseRow("View", /^Play All Movies/));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  });
});

describe("A movie's file with other applications", () => {
  const receivers = () =>
    registerFileReceivers(
      ["mail", "messages", "notes", "photos"].map((id) => ({ id, takesSharedFiles: true })),
    );
  const openShareMenu = async () =>
    fireEvent.click(await screen.findByRole("button", { name: "Share" }));

  it.each([
    ["Mail", "mail"],
    ["Messages", "messages"],
    ["Notes", "notes"],
  ])("shares the movie with %s from the controller", async (row, app) => {
    const stop = receivers();
    render(
      <QuickTimePlayerApp
        drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
        served={false}
      />,
    );
    await openHoliday();
    await openShareMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: row }));
    expect(takeSharedFiles(app).flatMap((shared) => shared.items.map((item) => item.id))).toEqual([
      "f1",
    ]);
    stop();
  });

  it("hands a trimmed and saved movie to Photos, the saved file and not the original", async () => {
    const stop = receivers();
    vi.mocked(replayMovie).mockResolvedValue(new Blob(["trimmed"], { type: "video/webm" }));
    render(
      <QuickTimePlayerApp
        drive={shelf({ movies: [entry("f1", "Holiday.webm")] })}
        served={false}
      />,
    );
    const { window } = await openHoliday();
    fireEvent.keyDown(window, { key: "t", metaKey: true });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Trim" }));
    });
    await movieNamed("Holiday.webm — Edited");
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    await act(async () => {
      fireEvent.keyDown(document.querySelector(".mac-quicktime-player") as Element, {
        key: "s",
        metaKey: true,
      });
    });
    await movieNamed("Holiday edited.webm");
    await openShareMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to Photos" }));
    expect(takeSharedFiles("photos").flatMap((shared) => shared.items)).toMatchObject([
      { id: "made-0", name: "Holiday edited.webm" },
    ]);
    stop();
  });

  it("is listed for an audio file in Open With, as for a movie", () => {
    const stop = registerFileOpeners([quicktimePlayerApp]);
    expect(appsForFile({ name: "Song.wav", type: "audio/wav" })).toContain("quicktime-player");
    expect(appsForFile({ name: "Song.m4a" })).toContain("quicktime-player");
    expect(appsForFile({ name: "Paper.pdf", type: "application/pdf" })).not.toContain(
      "quicktime-player",
    );
    stop();
  });
});
