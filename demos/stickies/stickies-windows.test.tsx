import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { arrangedNotes, cascadePlace } from "./stickies-data";
import type { SavedStickies, SavedStickiesNote } from "./stickies-sync";

/*
 * Every saved note as a window of the desktop, with the desktop's own host: the window manager, a
 * managed window for the application, and `DesktopSecondaryWindow` for the others. The server is a
 * stand-in for `/api/stickies/data` that keeps what is sent; the menu bar is filled from the app's
 * registered rows, as `desktop-menus.tsx` fills it.
 */

const note = (id: string, text: string, rest?: Partial<SavedStickiesNote>): SavedStickiesNote => ({
  id,
  color: "yellow",
  text,
  ...rest,
});

async function desktop(notes: SavedStickiesNote[]) {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const server: { data: SavedStickies; rev: number } = { data: { notes }, rev: 1 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith("/api/files/")) {
        return new Response(
          JSON.stringify({
            rev: 1,
            entries: [],
            usage: 0,
            quota: 1_000_000,
            piece_bytes: 1 << 20,
            max_file_bytes: 1 << 24,
            max_entries: 100,
          }),
          { status: 200 },
        );
      }
      if (init?.method === "PUT") {
        server.data = JSON.parse(String(init.body)).data;
        server.rev += 1;
        return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
      }
      return new Response(JSON.stringify(server), { status: 200 });
    }),
  );
  const { StickiesDesktopNote } = await import("./stickies");
  // After the reset above, so that these are the modules the note reads its window manager from.
  const { ManagedWindow } = await import("macalicious/managed-window");
  const { MenuBar, MenuBarMenu } = await import("macalicious/menu-bar");
  const { useWindowManager, WindowManager } = await import("macalicious/window-manager");
  const { DesktopSecondaryWindow, DesktopWindowHostContext } = await import(
    "../desktop/desktop-windows"
  );
  const { useDesktopAppMenuItems } = await import("../desktop/desktop-app-menus");
  const { WINDOW_ZOOM_ROW } = await import("../desktop/desktop-menus");

  function Menus() {
    const file = useDesktopAppMenuItems("stickies", "File");
    const window = useDesktopAppMenuItems("stickies", "Window");
    const zoomRow = useDesktopAppMenuItems("stickies", WINDOW_ZOOM_ROW);
    const { windows } = useWindowManager();
    return (
      <>
        <MenuBar modal={false} aria-label="Desktop menus">
          <MenuBarMenu title="File">{file}</MenuBarMenu>
          <MenuBarMenu title="Window">
            {window}
            {zoomRow}
          </MenuBarMenu>
        </MenuBar>
        <ul aria-label="Windows">
          {windows.map((each) => (
            <li key={each.id} data-panel={each.panel} data-state={each.state}>
              {each.title}
            </li>
          ))}
        </ul>
      </>
    );
  }

  function Host() {
    const stage = useRef<HTMLDivElement>(null);
    const host = {
      app: "stickies",
      stage: () => stage.current?.closest(".mac-window-manager") ?? null,
      place: () => ({ x: 300, y: 300, width: 352, height: 260 }),
    };
    return (
      <>
        <div ref={stage} />
        <ManagedWindow
          id="stickies"
          app="stickies"
          title="Stickies"
          defaultFrame={{ x: 300, y: 300, width: 352, height: 260 }}
          render={(props) => (
            <DesktopWindowHostContext value={host}>
              <StickiesDesktopNote {...props} DesktopWindow={DesktopSecondaryWindow} />
            </DesktopWindowHostContext>
          )}
        />
        <Menus />
      </>
    );
  }
  render(
    <WindowManager insets={{ top: 22 }}>
      <Host />
    </WindowManager>,
  );
  return server;
}

const framed = (title: string) => {
  const frame = screen.getByRole("group", { name: title }).closest("[data-window-id]");
  return (frame as HTMLElement).style.transform;
};
const texts = () => screen.getAllByRole("textbox", { name: "Note" }).map((t) => t.textContent);
const listed = () =>
  within(screen.getByRole("list", { name: "Windows" }))
    .getAllByRole("listitem")
    .map((row) => row.textContent);
const chooseFrom = async (
  user: ReturnType<typeof userEvent.setup>,
  menu: string,
  item: string,
  role = "menuitem",
) => {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  await user.click(await screen.findByRole(role, { name: new RegExp(`^${item}`) }));
};

afterEach(async () => {
  // A save still under way finishes against this test's server, not the next one's.
  await new Promise((resolve) => setTimeout(resolve, 400));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// The modules are read again for each test.
vi.setConfig({ testTimeout: 20_000 });

describe("the notes on the desktop", () => {
  it("opens every saved note as a window at its saved frame, named in the Window list", async () => {
    await desktop([
      note("a", "Alpha", { frame: { x: 40, y: 50, width: 300, height: 200 } }),
      note("b", "Beta", { frame: { x: 200, y: 210, width: 310, height: 220 } }),
      note("c", "Gamma", { color: "pink" }),
    ]);
    await screen.findByRole("group", { name: "Gamma" });
    expect(texts().sort()).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(framed("Alpha")).toBe("translate3d(40px,50px,0)");
    expect(framed("Beta")).toBe("translate3d(200px,210px,0)");
    // A note with no saved frame stands where the desktop placed it.
    expect(framed("Gamma")).toBe("translate3d(300px,300px,0)");
    expect(listed().sort()).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("makes a new note a little below the one in front, in the default colour", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const server = await desktop([
      note("a", "Alpha", { frame: { x: 40, y: 50, width: 300, height: 200 } }),
    ]);
    await screen.findByRole("group", { name: "Alpha" });
    await chooseFrom(user, "File", "New Note");
    await screen.findByRole("group", { name: "Empty note" });
    expect(framed("Empty note")).toBe("translate3d(62px,72px,0)");
    await waitFor(() => expect(server.data.notes).toHaveLength(2));
    expect(server.data.notes[1]).toMatchObject({
      color: "yellow",
      text: "",
      frame: { x: 62, y: 72, width: 300, height: 200 },
    });
  });

  it("asks before Close removes a note with text, and the next note takes the app's window", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const server = await desktop([
      note("a", "Alpha", { frame: { x: 40, y: 50, width: 300, height: 200 } }),
      note("b", "Beta", { frame: { x: 200, y: 210, width: 310, height: 220 } }),
    ]);
    const alpha = await screen.findByRole("group", { name: "Alpha" });
    await user.click(within(alpha).getByRole("button", { name: "Close" }));

    expect(await screen.findByText(/remove the note “Alpha”/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText(/remove the note/)).toBeNull());
    expect(screen.getByRole("group", { name: "Alpha" })).toBeInTheDocument();

    await user.click(
      within(screen.getByRole("group", { name: "Alpha" })).getByRole("button", { name: "Close" }),
    );
    await user.click(await screen.findByRole("button", { name: "Remove Note" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Alpha" })).toBeNull());
    expect(texts()).toEqual(["Beta"]);
    expect(screen.getByRole("group", { name: "Beta" }).closest("[data-window-id]")).toHaveAttribute(
      "data-window-id",
      "stickies",
    );
    expect(framed("Beta")).toBe("translate3d(200px,210px,0)");
    await waitFor(() => expect(server.data.notes.map((each) => each.id)).toEqual(["b"]));
  });

  it("closes a further note's window from the desktop without removing the note", async () => {
    const server = await desktop([note("a", "Alpha"), note("b", "Beta")]);
    const beta = await screen.findByRole("group", { name: "Beta" });
    act(() => within(beta).getByRole("textbox").focus());
    fireEvent.keyDown(within(beta).getByRole("textbox"), {
      key: "w",
      code: "KeyW",
      ctrlKey: true,
      altKey: true,
    });
    await waitFor(() => expect(screen.queryByRole("group", { name: "Beta" })).toBeNull());
    expect(server.data.notes.map((each) => each.id)).toEqual(["a", "b"]);
  });

  it("saves a note moved by the keyboard, and not the others", async () => {
    const server = await desktop([
      note("a", "Alpha", { frame: { x: 40, y: 50, width: 300, height: 200 } }),
      note("b", "Beta", { frame: { x: 200, y: 210, width: 310, height: 220 } }),
    ]);
    const beta = await screen.findByRole("group", { name: "Beta" });
    // jsdom lays nothing out: the desktop's size, which a move is bound by.
    const manager = beta.closest(".mac-window-manager") as HTMLElement;
    Object.defineProperty(manager, "clientWidth", { value: 1200 });
    Object.defineProperty(manager, "clientHeight", { value: 800 });
    act(() => within(beta).getByRole("textbox").focus());
    fireEvent.keyDown(within(beta).getByRole("textbox"), {
      key: "ArrowDown",
      code: "ArrowDown",
      ctrlKey: true,
      altKey: true,
    });
    await waitFor(() => expect(server.data.notes[1]?.frame?.y).toBe(226));
    expect(server.data.notes[0]?.frame).toEqual({ x: 40, y: 50, width: 300, height: 200 });
  });
});

describe("the zoom box and the dates of a note", () => {
  const frameOf = (title: string) =>
    screen.getByRole("group", { name: title }).closest("[data-window-id]") as HTMLElement;

  it("fits the note to its text, and goes back with a second click", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(500);
    await desktop([note("a", "Alpha", { frame: { x: 40, y: 50, width: 300, height: 200 } })]);
    await screen.findByRole("group", { name: "Alpha" });
    const zoom = () => within(frameOf("Alpha")).getByRole("button", { name: /zoom/i });
    await user.click(zoom());
    await waitFor(() => expect(frameOf("Alpha").style.height).toBe("700px"));
    await user.click(zoom());
    await waitFor(() => expect(frameOf("Alpha").style.height).toBe("200px"));
    scroll.mockRestore();
  });

  it("fits the note from Window > Zoom as the zoom box does, and goes back", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(500);
    await desktop([note("a", "Alpha", { frame: { x: 40, y: 50, width: 300, height: 200 } })]);
    await screen.findByRole("group", { name: "Alpha" });
    const zoom = async () => {
      await user.click(screen.getByRole("menuitem", { name: "Window" }));
      await user.click(await screen.findByRole("menuitem", { name: "Zoom" }));
    };
    await zoom();
    await waitFor(() => expect(frameOf("Alpha").style.height).toBe("700px"));
    await zoom();
    await waitFor(() => expect(frameOf("Alpha").style.height).toBe("200px"));
    scroll.mockRestore();
  });

  it("shows when a note changed in the tooltip of its text", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await desktop([note("a", "Alpha", { frame: { x: 40, y: 50, width: 300, height: 200 } })]);
    const field = await screen.findByRole("textbox", { name: "Note" });
    expect(field.getAttribute("title")).toBeNull();
    await user.click(field);
    await user.keyboard("x");
    await waitFor(() => expect(field.getAttribute("title")).toMatch(/^Modified: /));
  });
});

describe("Stickies' Window menu", () => {
  it("keeps Collapse and Translucent on the note, and floats the note above the others", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const server = await desktop([note("a", "Alpha"), note("b", "Beta")]);
    const alpha = await screen.findByRole("group", { name: "Alpha" });
    act(() => within(alpha).getByRole("textbox").focus());

    await chooseFrom(user, "Window", "Translucent", "menuitemcheckbox");
    await waitFor(() => expect(alpha).toHaveAttribute("data-translucent"));
    await waitFor(() => expect(server.data.notes[0]?.translucent).toBe(true));

    await chooseFrom(user, "Window", "Collapse");
    await waitFor(() => expect(alpha).toHaveAttribute("data-collapsed"));
    await waitFor(() => expect(server.data.notes[0]?.collapsed).toBe(true));
    await chooseFrom(user, "Window", "Expand");
    await waitFor(() => expect(alpha).not.toHaveAttribute("data-collapsed"));

    await chooseFrom(user, "Window", "Floating Window", "menuitemcheckbox");
    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Windows" })).getByText("Alpha"),
      ).toHaveAttribute("data-panel", "true"),
    );
    expect(within(screen.getByRole("list", { name: "Windows" })).getByText("Beta")).toHaveAttribute(
      "data-panel",
      "false",
    );
  });

  it("collapses from Command-M and sets Translucent from Option-Command-T", async () => {
    await desktop([note("a", "Alpha")]);
    const alpha = await screen.findByRole("group", { name: "Alpha" });
    const field = within(alpha).getByRole("textbox");
    fireEvent.keyDown(field, { key: "m", code: "KeyM", ctrlKey: true });
    expect(alpha).toHaveAttribute("data-collapsed");
    fireEvent.keyDown(field, { key: "t", code: "KeyT", ctrlKey: true, altKey: true });
    expect(alpha).toHaveAttribute("data-translucent");
  });

  it("keeps every title bar on a desktop 800 tall when arranging 100 notes", () => {
    const insets = { left: 0, top: 22 };
    for (let index = 0; index < 100; index += 1) {
      const { y } = cascadePlace(index, 800, insets, 22);
      expect(y).toBeLessThanOrEqual(800 - 40);
    }
    expect(cascadePlace(0, 800, insets, 22)).toEqual({ x: 16, y: 30 });
    expect(cascadePlace(1, 800, insets, 22)).toEqual({ x: 38, y: 52 });
  });

  it("arranges by colour and by content, the last in front", () => {
    const notes = [
      { id: "1", color: "pink", text: "apple" },
      { id: "2", color: "yellow", text: "Cherry" },
      { id: "3", color: "blue", text: "banana" },
    ];
    expect(arrangedNotes(notes, "color").map((each) => each.id)).toEqual(["2", "3", "1"]);
    expect(arrangedNotes(notes, "content").map((each) => each.id)).toEqual(["1", "3", "2"]);
    expect(arrangedNotes(notes, "date").map((each) => each.id)).toEqual(["1", "2", "3"]);
  });
});

describe("the colour keys and the defaults", () => {
  it("sets the colour from Command-1 to Command-6 and saves it", async () => {
    const server = await desktop([note("a", "Alpha")]);
    const alpha = await screen.findByRole("group", { name: "Alpha" });
    const field = within(alpha).getByRole("textbox");
    fireEvent.keyDown(field, { key: "6", code: "Digit6", ctrlKey: true });
    expect(alpha).toHaveAttribute("data-color", "gray");
    fireEvent.keyDown(field, { key: "2", code: "Digit2", ctrlKey: true });
    expect(alpha).toHaveAttribute("data-color", "blue");
    await waitFor(() => expect(server.data.notes[0]?.color).toBe("blue"));
  });

  it("gives a new note the colour Use as Default kept", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await desktop([note("a", "Alpha", { color: "green" })]);
    await screen.findByRole("group", { name: "Alpha" });
    await chooseFrom(user, "Window", "Use as Default");
    await chooseFrom(user, "File", "New Note");
    expect(await screen.findByRole("group", { name: "Empty note" })).toHaveAttribute(
      "data-color",
      "green",
    );
  });
});

describe("Find in the notes", () => {
  it("opens the Import Text sheet with Shift-Command-I while a note can be kept", async () => {
    await desktop([note("a", "Alpha")]);
    const alpha = await screen.findByRole("group", { name: "Alpha" });
    fireEvent.keyDown(alpha, { key: "i", code: "KeyI", ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole("dialog", { name: /Open/ })).toBeInTheDocument();
  });

  it("opens no Import Text sheet when no other note can be kept", async () => {
    const { MAX_NOTES } = await import("./stickies-sync");
    await desktop(Array.from({ length: MAX_NOTES }, (_, at) => note(`n${at}`, `Note ${at}`)));
    const first = await screen.findByRole("group", { name: "Note 0" });
    const field = within(first).getByRole("textbox", { name: "Note" });
    act(() => field.focus());
    fireEvent.keyDown(field, { key: "i", code: "KeyI", ctrlKey: true, shiftKey: true });
    await act(async () => {});
    expect(screen.queryByRole("dialog", { name: /Open/ })).toBeNull();
  });

  it("opens a collapsed note for Command-F, so the bar it asked for shows", async () => {
    const server = await desktop([note("a", "Alpha plum")]);
    const alpha = await screen.findByRole("group", { name: "Alpha plum" });
    const field = within(alpha).getByRole("textbox", { name: "Note" });
    fireEvent.keyDown(field, { key: "m", code: "KeyM", ctrlKey: true });
    expect(alpha).toHaveAttribute("data-collapsed");
    fireEvent.keyDown(alpha, { key: "f", code: "KeyF", ctrlKey: true });
    await waitFor(() => expect(alpha).not.toHaveAttribute("data-collapsed"));
    expect(await within(alpha).findByRole("searchbox", { name: "Find" })).toBeVisible();
    await waitFor(() => expect(server.data.notes[0]?.collapsed).toBe(false));
  });
  it("finds in the note, and Find Next goes on in the next note that holds the text", async () => {
    await desktop([note("a", "Alpha plum"), note("b", "Beta plum"), note("c", "Gamma")]);
    const alpha = await screen.findByRole("group", { name: "Alpha plum" });
    const field = within(alpha).getByRole("textbox", { name: "Note" });
    act(() => field.focus());
    fireEvent.keyDown(field, { key: "f", code: "KeyF", ctrlKey: true });
    const search = await within(alpha).findByRole("searchbox", { name: "Find" });
    fireEvent.change(search, { target: { value: "plum" } });
    expect(within(alpha).getByRole("status")).toHaveTextContent("1 of 1");

    fireEvent.keyDown(search, { key: "g", code: "KeyG", ctrlKey: true });
    const beta = screen.getByRole("group", { name: "Beta plum" });
    expect(await within(beta).findByRole("searchbox", { name: "Find" })).toHaveValue("plum");
    await waitFor(() => expect(within(beta).getByRole("status")).toHaveTextContent("1 of 1"));
    expect(within(alpha).queryByRole("searchbox", { name: "Find" })).toBeNull();
  });
});
