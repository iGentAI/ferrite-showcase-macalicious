import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import {
  type QuickTimeDrive,
  type QuickTimeMovieFile,
  QuickTimePlayerApp,
} from "./quicktime-player-app";
import { clipClipboard } from "./quicktime-player-clips";
import {
  isMovie,
  placedIn,
  QUICKTIME_RECENTS_URL,
  recentsFromServer,
  recentsReadable,
  remember,
} from "./quicktime-player-recents";

import { replayMovie } from "./quicktime-player-replay";

vi.mock("./quicktime-player-replay", () => ({ replayMovie: vi.fn() }));

/*
 * Test doubles: `memoryDrive` stands in for the person's drive on the desktop's Ferrite
 * application (its upload and read in pieces), keeping files in memory; `fetch` stands in for
 * the recents route; object URLs are stand-in strings, since jsdom has none; `replayMovie` stands in for
 * the replay, tested on its own in quicktime-player-replay.test.ts. The real drive and
 * real playback are covered by e2e/tv-journey.mjs.
 */
function memoryDrive(): QuickTimeDrive & { files: Map<string, Blob> } {
  const files = new Map<string, Blob>();
  const listed: QuickTimeMovieFile[] = [];
  return {
    files,
    movies: async () => [...listed],
    upload: async (file, onProgress) => {
      onProgress(0.5);
      const entry = {
        id: `f${listed.length + 1}`,
        name: file.name,
        size: file.size,
        type: file.type,
      };
      files.set(entry.id, file);
      listed.push(entry);
      onProgress(1);
      return entry;
    },
    read: async (id, onProgress) => {
      onProgress(1);
      const blob = files.get(id);
      if (!blob) throw new Error("no such file");
      return blob;
    },
  };
}

beforeEach(() => {
  let made = 0;
  Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:movie-${++made}`),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const holiday = () => new File(["movie bytes"], "Holiday.webm", { type: "video/webm" });
const choose = (file: File) =>
  fireEvent.change(screen.getByLabelText("Movie from this computer"), {
    target: { files: [file] },
  });

describe("QuickTime Player's recent movies", () => {
  it("keeps the newest first, once, with the place to ten seconds while playing", () => {
    let recents = remember([], "f1", "Holiday.webm", 1);
    recents = remember(recents, "f2", "Birthday.mp4", 2);
    recents = [...placedIn(recents, "f1", 47.5, 120, true)];
    expect(recents.find((recent) => recent.file === "f1")?.position).toBe(40);
    recents = remember(recents, "f1", "Holiday.webm", 3);
    expect(recents.map((recent) => recent.file)).toEqual(["f1", "f2"]);
    expect(recents[0]?.position).toBe(40);
    expect(placedIn(recents, "f1", 47.5, 120, false)[0]?.position).toBe(47);
    expect(placedIn(recents, "f1", 118, 120, false)[0]?.position).toBe(0);
    expect(recentsReadable({ recents: null })).toBe(true);
    expect(recentsFromServer({ recents: null })).toEqual([]);
    expect(recentsReadable({ recents: [{ file: "f1" }] })).toBe(false);
    expect(isMovie({ name: "a.MOV" })).toBe(true);
    expect(isMovie({ name: "notes.txt", type: "text/plain" })).toBe(false);
  });
});

describe("QuickTimePlayerApp with a drive", () => {
  it("starts another document with no history, also without a drive", async () => {
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(320);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(180);
    render(<QuickTimePlayerApp drive={null} served={false} />);
    choose(holiday());
    const first = await screen.findByRole("region", { name: "Holiday.webm" });
    fireEvent.loadedMetadata(first.querySelector("video") as HTMLVideoElement);
    const frame = () => document.querySelector(".mac-quicktime-player") as HTMLElement;
    vi.mocked(replayMovie).mockImplementation(async () => new Blob(["edit"]));
    await act(async () => {
      fireEvent.keyDown(frame(), { key: "r", metaKey: true, shiftKey: true });
    });
    await screen.findByRole("region", { name: "Holiday.webm — Edited" });
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    fireEvent.keyDown(frame(), { key: "z", metaKey: true });
    fireEvent.keyDown(frame(), { key: "o", metaKey: true });
    choose(new File(["other"], "Other.webm", { type: "video/webm" }));
    await screen.findByRole("region", { name: "Other.webm" });
    fireEvent.keyDown(frame(), { key: "z", metaKey: true, shiftKey: true });
    expect(screen.queryByRole("region", { name: "Other.webm — Edited" })).toBeNull();
    expect(screen.getByRole("region", { name: "Other.webm" })).toBeInTheDocument();
  });
  /** A movie open in the window, with a picture, ready for the Edit menu's keys. */
  const openMovie = async () => {
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(320);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(180);
    const drive = memoryDrive();
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    await screen.findByText(/Movies is empty/);
    choose(holiday());
    const window = await screen.findByRole("region", { name: "Holiday.webm" });
    fireEvent.loadedMetadata(window.querySelector("video") as HTMLVideoElement);
    return drive;
  };
  const movieWindow = () => document.querySelector(".mac-quicktime-player") as HTMLElement;
  const pressRotate = () =>
    fireEvent.keyDown(movieWindow(), { key: "r", metaKey: true, shiftKey: true });
  const edited = () => screen.queryByRole("region", { name: "Holiday.webm — Edited" });

  it("sets the trim's handles at the playhead with I and O", async () => {
    const at = vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockReturnValue(2);
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(10);
    await openMovie();
    const video = movieWindow().querySelector("video") as HTMLVideoElement;
    fireEvent.loadedMetadata(video);
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(movieWindow(), { key: "t", metaKey: true });
    const start = await screen.findByRole("slider", { name: "Trim start" });
    const end = screen.getByRole("slider", { name: "Trim end" });

    fireEvent.keyDown(start, { key: "i" });
    expect(start).toHaveAttribute("aria-valuenow", "2");
    at.mockReturnValue(8);
    fireEvent.timeUpdate(video);
    fireEvent.keyDown(start, { key: "o" });
    expect(end).toHaveAttribute("aria-valuenow", "8");
    // Past the other handle, it stops the shortest stretch short of it.
    fireEvent.keyDown(start, { key: "i" });
    expect(start.style.insetInlineStart).toBe("75%");
  });

  it("keeps the clips with the saved movie, and stays edited until they are stored", async () => {
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(320);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(180);
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(10);
    vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockReturnValue(2);
    let refuse = true;
    const keepClips = vi.fn(async () => {
      if (refuse) throw new Error("no answer");
    });
    const drive = { ...memoryDrive(), keepClips };
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    await screen.findByText(/Movies is empty/);
    choose(holiday());
    const opened = await screen.findByRole("region", { name: "Holiday.webm" });
    const video = opened.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedMetadata(video);
    fireEvent.timeUpdate(video);

    fireEvent.keyDown(movieWindow(), { key: "y", metaKey: true });
    expect(await screen.findByRole("region", { name: "Holiday.webm — Edited" })).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(movieWindow(), { key: "s", metaKey: true });
    });
    await waitFor(() => expect(keepClips).toHaveBeenCalledTimes(1));
    expect(keepClips.mock.calls[0]).toEqual(["f2", [2]]);
    expect(await screen.findByText(/could not be kept: no answer/)).toBeTruthy();
    expect(edited()).toBeInTheDocument();

    refuse = false;
    await act(async () => {
      fireEvent.keyDown(movieWindow(), { key: "s", metaKey: true });
    });
    await waitFor(() => expect(keepClips).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("region", { name: /Holiday edited.*\.webm$/ })).toBeTruthy();
  });

  it("stays edited, saying so, when the drive has nowhere to keep a split movie's clips", async () => {
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(320);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(180);
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(10);
    vi.spyOn(HTMLMediaElement.prototype, "currentTime", "get").mockReturnValue(2);
    render(<QuickTimePlayerApp drive={memoryDrive()} served={false} />);
    await screen.findByText(/Movies is empty/);
    choose(holiday());
    const opened = await screen.findByRole("region", { name: "Holiday.webm" });
    const video = opened.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedMetadata(video);
    fireEvent.timeUpdate(video);

    fireEvent.keyDown(movieWindow(), { key: "y", metaKey: true });
    expect(await screen.findByRole("region", { name: "Holiday.webm — Edited" })).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(movieWindow(), { key: "s", metaKey: true });
    });
    expect(
      await screen.findByText(/could not be kept: this place does not keep clips/),
    ).toBeTruthy();
    expect(edited()).toBeInTheDocument();
  });

  it("counts a movie as edited until Undo reaches the state it was saved in", async () => {
    await openMovie();
    let made = 0;
    vi.mocked(replayMovie).mockImplementation(async () => new Blob([`edit ${++made}`]));
    for (let at = 1; at <= 6; at += 1) {
      await act(async () => {
        pressRotate();
      });
      await waitFor(() => expect(made).toBe(at));
      await waitFor(() => expect(edited()).toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    }
    // Five steps back is the first edit, not the movie as saved: the oldest step was let go.
    for (let at = 0; at < 5; at += 1) {
      fireEvent.keyDown(movieWindow(), { key: "z", metaKey: true });
    }
    expect(edited()).toBeInTheDocument();
  });

  it("goes back to unedited when Undo reaches the saved movie, and to edited on Redo", async () => {
    await openMovie();
    vi.mocked(replayMovie).mockImplementation(async () => new Blob(["edit"]));
    await act(async () => {
      pressRotate();
    });
    await waitFor(() => expect(edited()).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    fireEvent.keyDown(movieWindow(), { key: "z", metaKey: true });
    expect(edited()).toBeNull();
    expect(screen.getByRole("region", { name: "Holiday.webm" })).toBeInTheDocument();
    fireEvent.keyDown(movieWindow(), { key: "z", metaKey: true, shiftKey: true });
    expect(edited()).toBeInTheDocument();
  });

  it("stays on the movie while an edit runs: neither Command-O nor Command-L leaves it", async () => {
    await openMovie();
    let finish: (blob: Blob) => void = () => {};
    vi.mocked(replayMovie).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => {
      pressRotate();
    });
    fireEvent.keyDown(movieWindow(), { key: "o", metaKey: true });
    fireEvent.keyDown(movieWindow(), { key: "l", metaKey: true });
    expect(screen.queryByRole("region", { name: "Open" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Address of the movie" })).toBeNull();
    await act(async () => finish(new Blob(["edit"])));
    expect(edited()).toBeInTheDocument();
    fireEvent.keyDown(movieWindow(), { key: "o", metaKey: true });
    expect(screen.queryByRole("region", { name: "Open" })).toBeNull();
  });

  it("leaves the movie as it was and says why when an edit fails", async () => {
    await openMovie();
    vi.mocked(replayMovie).mockRejectedValue(new Error("the encoder quit"));
    await act(async () => {
      pressRotate();
    });
    expect(await screen.findByText("The edit failed: the encoder quit")).toBeInTheDocument();
    expect(edited()).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
  it("uploads a movie from the computer into Movies, plays it as read back, and lists it", async () => {
    const user = userEvent.setup();
    const drive = memoryDrive();
    const onClose = vi.fn();
    render(<QuickTimePlayerApp drive={drive} served={false} onClose={onClose} />);
    expect(await screen.findByText(/Movies is empty/)).toBeInTheDocument();
    choose(holiday());
    const window = await screen.findByRole("region", { name: "Holiday.webm" });
    // The movie played is the one read back from the drive, not the file chosen.
    expect(drive.files.get("f1")).toBeDefined();
    expect(URL.createObjectURL).toHaveBeenCalledWith(drive.files.get("f1"));
    expect(window.querySelector("video")).toHaveAttribute("src", "blob:movie-1");

    fireEvent.keyDown(window, { key: "o", ctrlKey: true });
    const panel = screen.getByRole("region", { name: "Open" });
    const movies = within(panel).getByRole("listbox", { name: "Movies" });
    await waitFor(() => expect(within(movies).getByText("Holiday.webm")).toBeInTheDocument());
    await user.click(within(movies).getByText("Holiday.webm"));
    await user.click(within(panel).getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("region", { name: "Holiday.webm" })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("region", { name: "Holiday.webm" }), {
      key: "o",
      metaKey: true,
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps an upload when a listing under way fails", async () => {
    const drive = memoryDrive();
    let fail: (error: unknown) => void = () => {};
    drive.movies = () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      });
    drive.read = async () => {
      throw new Error("the drive did not answer");
    };
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    choose(holiday());
    expect(
      await screen.findByText("“Holiday.webm” could not be opened: the drive did not answer"),
    ).toBeInTheDocument();
    await act(async () => fail(new Error("Movies could not be read")));
    const panel = screen.getByRole("region", { name: "Open" });
    const movies = within(panel).getByRole("listbox", { name: "Movies" });
    expect(within(movies).getByText("Holiday.webm")).toBeInTheDocument();
  });

  it("keeps an upload that a listing taken before it would leave out", async () => {
    const drive = memoryDrive();
    let answer: (list: QuickTimeMovieFile[]) => void = () => {};
    // The first listing of Movies is still under way when the upload finishes.
    drive.movies = () =>
      new Promise((resolve) => {
        answer = resolve;
      });
    drive.read = async () => {
      throw new Error("the drive did not answer");
    };
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    choose(holiday());
    expect(
      await screen.findByText("“Holiday.webm” could not be opened: the drive did not answer"),
    ).toBeInTheDocument();
    // The listing answers with what Movies held before the upload.
    await act(async () => answer([]));
    const panel = screen.getByRole("region", { name: "Open" });
    const movies = within(panel).getByRole("listbox", { name: "Movies" });
    expect(within(movies).getByText("Holiday.webm")).toBeInTheDocument();
  });

  it("lists an uploaded movie at once, even when opening it fails", async () => {
    const drive = memoryDrive();
    drive.read = async () => {
      throw new Error("the drive did not answer");
    };
    render(<QuickTimePlayerApp drive={drive} served={false} />);
    expect(await screen.findByText(/Movies is empty/)).toBeInTheDocument();
    choose(holiday());
    expect(
      await screen.findByText("“Holiday.webm” could not be opened: the drive did not answer"),
    ).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "Open" });
    const movies = within(panel).getByRole("listbox", { name: "Movies" });
    expect(within(movies).getByText("Holiday.webm")).toBeInTheDocument();
  });

  it("refuses a file that is not a movie", async () => {
    render(<QuickTimePlayerApp drive={memoryDrive()} served={false} />);
    choose(new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(await screen.findByText("“notes.txt” is not a movie.")).toBeInTheDocument();
  });

  it("still returns to the Open window on Command-O when the host listens to the keys too", async () => {
    const onKeyDown = vi.fn();
    render(<QuickTimePlayerApp drive={memoryDrive()} served={false} onKeyDown={onKeyDown} />);
    await screen.findByText(/Movies is empty/);
    choose(holiday());
    const window = await screen.findByRole("region", { name: "Holiday.webm" });
    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(onKeyDown).toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Open" })).toBeInTheDocument();
  });

  it("keeps the person's recent movies on the desktop app, with the place in each", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () =>
        init?.method === "PUT"
          ? { ...JSON.parse(String(init.body)), rev: 5 }
          : {
              recents: [{ file: "f1", name: "Holiday.webm", at: 1, position: 30 }],
              rev: 4,
            },
    }));
    vi.stubGlobal("fetch", fetch);
    const drive = memoryDrive();
    await drive.upload(holiday(), () => {});
    const user = userEvent.setup();
    render(<QuickTimePlayerApp drive={drive} />);
    const panel = await screen.findByRole("region", { name: "Open" });
    await waitFor(() => expect(panel).not.toHaveAttribute("aria-busy"));
    expect(fetch.mock.calls[0]?.[0]).toBe(QUICKTIME_RECENTS_URL);
    await user.click(within(panel).getByRole("treeitem", { name: "Recents" }));
    const recents = within(panel).getByRole("listbox", { name: "Recents" });
    await user.dblClick(within(recents).getByText("Holiday.webm"));
    const window = await screen.findByRole("region", { name: "Holiday.webm" });
    // It opens where the person stopped, once the movie's length is known (a stand-in length:
    // jsdom reads no media).
    const duration = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "duration");
    Object.defineProperty(HTMLMediaElement.prototype, "duration", {
      configurable: true,
      get: () => 120,
    });
    const video = window.querySelector("video") as HTMLVideoElement;
    act(() => void video.dispatchEvent(new Event("loadedmetadata")));
    if (duration) Object.defineProperty(HTMLMediaElement.prototype, "duration", duration);
    expect(video.currentTime).toBe(30);
    await waitFor(() => {
      const saves = fetch.mock.calls.filter(([, init]) => init?.method === "PUT");
      const body = JSON.parse(String(saves.at(-1)?.[1]?.body));
      expect(body.recents[0]).toMatchObject({ file: "f1", name: "Holiday.webm", position: 30 });
      expect(body.recents[0].at).toBeGreaterThan(1);
    });
  });
});

/** The Edit menu as the menu bar shows it: its popup mounts, and reads the keyboard, as it opens. */
function EditMenu() {
  const items = useDesktopAppMenuItems("quicktime-player", "Edit");
  return (
    <Menu>
      <MenuTrigger>Open Edit</MenuTrigger>
      <MenuPopup aria-label="Edit">{items}</MenuPopup>
    </Menu>
  );
}
const editRow = async (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Open Edit" }));
  return screen.findByRole("menuitem", { name: new RegExp(`^${name}`) });
};
const closeEdit = async () => {
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
};
const STANDARD_ROWS = ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"];

describe("QuickTime Player's Edit menu", () => {
  it("in the Open panel acts on the search field that has the keyboard", async () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    render(
      <>
        <QuickTimePlayerApp drive={memoryDrive()} served={false} />
        <EditMenu />
      </>,
    );
    await screen.findByText(/Movies is empty/);
    await editRow("Undo");
    for (const name of STANDARD_ROWS) {
      const row = screen.getByRole("menuitem", { name: new RegExp(`^${name}`) });
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveAttribute("title", "Click in the Open panel's search field first.");
    }
    await closeEdit();
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "holiday" } });
    act(() => field.focus());
    fireEvent.click(await editRow("Select All"));
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("selectAll"));
    act(() => field.blur());
  });

  const openedMovie = async () => {
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(320);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(180);
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(10);
    render(
      <>
        <QuickTimePlayerApp drive={memoryDrive()} served={false} />
        <EditMenu />
      </>,
    );
    await screen.findByText(/Movies is empty/);
    choose(holiday());
    const window = await screen.findByRole("region", { name: "Holiday.webm" });
    const video = window.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedMetadata(video);
    fireEvent.timeUpdate(video);
    return window;
  };

  it("selects every clip with Select All, opening the strip, and Copy takes the whole movie", async () => {
    await openedMovie();
    fireEvent.click(await editRow("Select All"));
    const clip = await screen.findByRole("button", { name: /^Clip 1 of 1/ });
    expect(clip).toHaveAttribute("aria-pressed", "true");
    const copy = await editRow("Copy");
    expect(copy).not.toHaveAttribute("aria-disabled", "true");
    const cut = screen.getByRole("menuitem", { name: /^Cut/ });
    expect(cut).toHaveAttribute("aria-disabled", "true");
    expect(cut).toHaveAttribute("title", "A movie keeps at least one clip.");
    fireEvent.click(copy);
    expect(clipClipboard.read()).toMatchObject([{ start: 0, end: 10 }]);
  });

  it("selects every clip with Command-A too, and the strip's Done lets go of them", async () => {
    const window = await openedMovie();
    fireEvent.keyDown(window, { key: "a", metaKey: true });
    await screen.findByRole("button", { name: /^Clip 1 of 1/ });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const copy = await editRow("Copy");
    expect(copy).toHaveAttribute("aria-disabled", "true");
    expect(copy).toHaveAttribute("title", "Choose a clip in the strip first: View > Show Clips.");
    await closeEdit();
  });
});
