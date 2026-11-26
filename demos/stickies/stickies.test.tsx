import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopSecondaryWindow, DesktopWindowHostContext } from "../desktop/desktop-windows";
import { app, stickiesApp } from "./app";
import { Stickies, StickiesDesktopNote, StickiesNote } from "./stickies";
import { titleOf } from "./stickies-data";
import { StickiesPanels } from "./stickies-format";

const WELCOME = "Make a note of it!";
const CUSTOMIZE = "It’s easy to customize your notes!";

const note = (name: string) => screen.getByRole("group", { name });
const shellOf = (name: string) => note(name).parentElement as HTMLElement;
const stateOf = (name: string) => note(name).getAttribute("data-window-state");
const textOf = (name: string) => within(note(name)).getByRole("textbox");
const box = (name: string, widget: string) =>
  within(note(name)).getByRole("button", { name: widget });
const barOf = (name: string) =>
  note(name).querySelector("[data-window-drag-region]") as HTMLElement;

/** Replace a note's text as typing would: the browser changes the element, then reports it. */
function retype(name: string, html: string) {
  const text = textOf(name);
  text.innerHTML = html;
  fireEvent.input(text);
}

/** Open a menu of the menu bar and return one of its items, once the menu is there. */
async function item(user: UserEvent, menu: string, name: string, role = "menuitem") {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  return within(await screen.findByRole("menu")).findByRole(role, { name });
}

async function choose(user: UserEvent, menu: string, name: string, role = "menuitem") {
  await user.click(await item(user, menu, name, role));
}

/**
 * The browser's editing commands, recorded: jsdom has none. Each entry is the command, its
 * value and whether the selection was in the note's text (`field`) when it ran. `run` stands in
 * for what a browser does to the text.
 */
function recordCommands(field: () => HTMLElement, run?: (command: string) => void) {
  const commands: [string, string | undefined, boolean][] = [];
  document.execCommand = (name: string, _ui?: boolean, value?: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, value, anchor !== null && field().contains(anchor)]);
      run?.(name);
    }
    return true;
  };
  return commands;
}

/** What a browser's command does to the selection: wraps it in an element. */
const wrapIn = (tag: string) => () => {
  const range = document.getSelection()?.getRangeAt(0);
  range?.surroundContents(document.createElement(tag));
};

/** Give a note's text the keyboard, and select `word` in it, or put the insertion point in it. */
function select(field: HTMLElement, word: string, caret = false) {
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.nodeValue?.indexOf(word) ?? -1;
    if (at < 0) continue;
    act(() => field.focus());
    const range = document.createRange();
    range.setStart(node, at + (caret ? 1 : 0));
    range.setEnd(node, at + (caret ? 1 : word.length));
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
    return;
  }
  throw new Error(`"${word}" is not in the note`);
}

/** A key equivalent typed in a note's text: Command is Control off Apple platforms. */
const press = (field: HTMLElement, key: string, shiftKey = false) =>
  fireEvent.keyDown(field, { key, ctrlKey: true, shiftKey });

beforeEach(() => {
  // jsdom lays nothing out; the desktop is 1000 by 700 points.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(700);
});

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
});

describe("titleOf", () => {
  it("is the first line that is not blank", () => {
    expect(titleOf("Call Ada\nat noon")).toBe("Call Ada");
    expect(titleOf("\n  \n  Second thoughts  \nmore")).toBe("Second thoughts");
    expect(titleOf("")).toBe("");
  });
});

describe("Stickies", () => {
  it("opens its two notes with the later one in front as the key note", () => {
    render(<Stickies />);
    expect(stateOf(WELCOME)).toBe("key");
    expect(stateOf(CUSTOMIZE)).toBe("inactive");
    expect(note(WELCOME)).toHaveAttribute("data-color", "yellow");
    expect(note(CUSTOMIZE)).toHaveAttribute("data-color", "blue");
    expect(textOf(WELCOME)).toHaveTextContent("Stickies lets you keep notes (like these)");
    expect(within(textOf(WELCOME)).getByText(WELCOME).tagName).toBe("B");
    expect(shellOf(WELCOME)).toHaveStyle({ width: "352px", height: "260px" });
    expect(Number(shellOf(WELCOME).style.zIndex)).toBeGreaterThan(
      Number(shellOf(CUSTOMIZE).style.zIndex),
    );
  });

  it("makes the note that is pressed the key note", () => {
    render(<Stickies />);
    fireEvent.pointerDown(textOf(CUSTOMIZE));
    expect(stateOf(CUSTOMIZE)).toBe("key");
    expect(stateOf(WELCOME)).toBe("inactive");
  });

  it("names a note after the first line of its text as it is edited", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    retype(WELCOME, "Buy milk\nand eggs");
    expect(stateOf("Buy milk")).toBe("key");
    expect(barOf("Buy milk")).toHaveTextContent("Buy milk");
    // The browser breaks lines with elements, not with characters.
    retype("Buy milk", "<div><br></div><div>Second thoughts</div><div>more</div>");
    expect(textOf("Second thoughts")).toHaveTextContent("Second thoughtsmore");
    retype("Second thoughts", "Third<br>time");
    expect(note("Third")).toBeInTheDocument();
    // The other note keeps its text and its name, and the Window menu lists both.
    expect(textOf(CUSTOMIZE)).toHaveTextContent("Make your notes stand out");
    expect(await item(user, "Window", "Third", "menuitemradio")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: CUSTOMIZE })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("gives the key note the colour chosen in the Color menu", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    expect(await item(user, "Color", "Yellow", "menuitemradio")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("menuitemradio", { name: "Green" }));
    expect(note(WELCOME)).toHaveAttribute("data-color", "green");
    expect(note(CUSTOMIZE)).toHaveAttribute("data-color", "blue");

    fireEvent.pointerDown(textOf(CUSTOMIZE));
    await choose(user, "Color", "Purple", "menuitemradio");
    expect(note(CUSTOMIZE)).toHaveAttribute("data-color", "purple");
    expect(note(WELCOME)).toHaveAttribute("data-color", "green");
  });

  it("collapses a note to its title bar and expands it again", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    await user.click(box(WELCOME, "Collapse"));
    expect(note(WELCOME)).toHaveAttribute("data-collapsed");
    expect(box(WELCOME, "Collapse")).toHaveAttribute("aria-pressed", "true");
    // The note's window shrinks with it, so that what was under the note can be reached.
    expect(shellOf(WELCOME)).toHaveStyle({ width: "352px", height: "12px" });
    expect(shellOf(WELCOME).querySelector("[data-edge]")).toBeNull();

    await user.dblClick(barOf(WELCOME));
    expect(note(WELCOME)).not.toHaveAttribute("data-collapsed");
    expect(shellOf(WELCOME)).toHaveStyle({ height: "260px" });
    expect(textOf(WELCOME)).toHaveTextContent("Stickies lets you keep notes");

    await choose(user, "Window", "Collapse");
    expect(note(WELCOME)).toHaveAttribute("data-collapsed");
    expect(note(CUSTOMIZE)).not.toHaveAttribute("data-collapsed");
    await choose(user, "Window", "Expand");
    expect(note(WELCOME)).not.toHaveAttribute("data-collapsed");
    expect(shellOf(WELCOME)).toHaveStyle({ height: "260px" });
  });

  it("makes the key note see-through from the Window menu", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    await choose(user, "Window", "Translucent Window", "menuitemcheckbox");
    expect(note(WELCOME)).toHaveAttribute("data-translucent");
    expect(note(CUSTOMIZE)).not.toHaveAttribute("data-translucent");
  });

  it("makes new notes and closes notes", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    await choose(user, "File", "New Note");
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(stateOf("Empty note")).toBe("key");
    expect(note("Empty note")).toHaveAttribute("data-color", "yellow");
    expect(stateOf(WELCOME)).toBe("inactive");
    // It opens a little right of and below the note that was in front.
    expect(shellOf("Empty note").style.transform).toBe("translate3d(69px,86px,0)");
    retype("Empty note", "Groceries");
    expect(stateOf("Groceries")).toBe("key");

    // The close box closes its note, and the note behind it is key again.
    await user.click(box("Groceries", "Close"));
    expect(screen.queryByRole("group", { name: "Groceries" })).toBeNull();
    expect(stateOf(WELCOME)).toBe("key");

    // File > Close closes the key note; with no note left there is nothing to close.
    await choose(user, "File", "Close");
    expect(screen.queryByRole("group", { name: WELCOME })).toBeNull();
    expect(stateOf(CUSTOMIZE)).toBe("key");
    await choose(user, "File", "Close");
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(await item(user, "File", "Close")).toHaveAttribute("aria-disabled", "true");
  });

  it("moves a note by its title bar", () => {
    render(<Stickies />);
    const bar = barOf(WELCOME);
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 100, clientY: 70 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 130, clientY: 110 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 130, clientY: 110 });
    expect(shellOf(WELCOME).style.transform).toBe("translate3d(79px,106px,0)");
  });
});

describe("StickiesNote", () => {
  it("is a note that takes a window's props", () => {
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(
      <StickiesNote
        ref={ref}
        className="mine"
        state="inactive"
        variant="panel"
        fullScreen
        width={300}
        height={180}
        color="pink"
        defaultText={"Call Ada\nat noon"}
        zoomRole="zoom"
        minimizeDisabled
        zoomDisabled
      />,
    );
    const root = note("Call Ada");
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-sticky-note", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveAttribute("data-color", "pink");
    expect(root).toHaveStyle({ width: "300px", height: "180px" });
    expect(within(textOf("Call Ada")).getByText("Call Ada").tagName).toBe("B");
    expect(textOf("Call Ada")).toHaveTextContent("Call Ada at noon");
    // What a note has no part for is not left on the element.
    for (const name of ["variant", "fullscreen", "zoomrole", "minimizedisabled", "zoomdisabled"]) {
      expect(root).not.toHaveAttribute(name);
    }

    // A window's colour attribute is any string; one that is not a note colour is yellow.
    rerender(<StickiesNote color="teal" defaultText="Call Ada" />);
    expect(note("Call Ada")).toHaveAttribute("data-color", "yellow");
    expect(note("Call Ada")).toHaveStyle({ width: "352px", height: "260px" });
  });

  it("hands the close and zoom boxes and the title bar to a window manager", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <StickiesNote
        defaultText="Call Ada"
        onClose={onClose}
        onZoom={onZoom}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    await user.click(box("Call Ada", "Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onZoom).not.toHaveBeenCalled();
    // The zoom command is given the click: a window manager reads its Option key.
    await user.click(box("Call Ada", "Zoom"));
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledWith(expect.objectContaining({ type: "click", altKey: false }));

    const bar = barOf("Call Ada");
    fireEvent.pointerDown(bar, { button: 2 });
    fireEvent.pointerDown(box("Call Ada", "Collapse"), { button: 0 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // A press the window's own handler cancels in the capture phase starts no move.
    const veto = (event: Event) => event.preventDefault();
    note("Call Ada").addEventListener("pointerdown", veto, { capture: true });
    fireEvent.pointerDown(bar, { button: 0 });
    note("Call Ada").removeEventListener("pointerdown", veto, { capture: true });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // A double click on a note's title bar collapses the note; it is not a window's zoom.
    await user.dblClick(bar);
    expect(note("Call Ada")).toHaveAttribute("data-collapsed");
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
    expect(onZoom).toHaveBeenCalledTimes(1);
  });

  it("passes the keyboard focus it is given on to its text", () => {
    const onFocus = vi.fn();
    render(<StickiesNote defaultText="Call Ada" onFocus={onFocus} />);
    act(() => note("Call Ada").focus());
    expect(textOf("Call Ada")).toHaveFocus();
    expect(onFocus).toHaveBeenCalled();
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(stickiesApp);
    expect(app).toMatchObject({
      id: "stickies",
      name: "Stickies",
      component: StickiesDesktopNote,
      defaultSize: { width: 352, height: 260 },
      minSize: { width: 120, height: 48 },
      resizable: true,
      windows: true,
    });
    expect(app.menus).toEqual(["Stickies", "File", "Edit", "Font", "Color", "Window", "Help"]);
    expect(app.notes.map((each) => titleOf(each.text))).toEqual([CUSTOMIZE, WELCOME]);

    const onOpenChange = vi.fn();
    render(
      <WindowManager style={{ height: 500 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          zoomButton="zoom"
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          onOpenChange={onOpenChange}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const host = shellOf("Empty note");
    expect(host).toHaveAttribute("data-window-id", "stickies");
    expect(host).toHaveStyle({ width: "352px", height: "260px" });
    // The manager sizes the wrapper; the note fills it.
    expect(note("Empty note")).toHaveStyle({ width: "100%", height: "100%" });
    expect(stateOf("Empty note")).toBe("key");

    // The manager moves the note by its title bar, zooms it and closes it.
    const bar = barOf("Empty note");
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 100, clientY: 35 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 140, clientY: 65 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 140, clientY: 65 });
    expect(host.style.transform).toBe("translate3d(60px,60px,0)");
    await user.click(box("Empty note", "Zoom"));
    expect(host).toHaveAttribute("data-zoomed");
    await user.click(box("Empty note", "Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("group", { name: "Empty note" })).toBeNull();
  });
});

describe("StickiesDesktopNote", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is a plain note that fetches nothing outside the Ferrite application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<StickiesDesktopNote defaultText="Call Ada" />);
    expect(textOf("Call Ada")).toHaveTextContent("Call Ada");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opens with the session's saved note on the Ferrite application and saves what is typed", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const puts: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe("/api/stickies/data");
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return new Response('{"rev":2}', { status: 200 });
        }
        const data = { notes: [{ id: "note-1", color: "blue", text: "Buy milk\n" }] };
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    render(<StickiesDesktopNote />);
    await screen.findByRole("group", { name: "Buy milk" });
    const field = textOf("Buy milk");
    expect(note("Buy milk")).toHaveAttribute("data-color", "blue");

    // The browser puts a typed line in a block of its own.
    field.insertAdjacentHTML("beforeend", "<div>and eggs</div>");
    fireEvent.input(field);
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    // The save names the revision the notes were read at, and holds the text with its formats.
    expect(puts[0]).toEqual({
      base: 1,
      data: {
        notes: [
          {
            id: "note-1",
            color: "blue",
            text: "Buy milk\nand eggs",
            html: "<b>Buy milk</b>\n<div>and eggs</div>",
          },
        ],
      },
    });
  });

  it("saves only its own note and keeps the note's frame and the other notes", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const frame = { x: 40, y: 60, width: 300, height: 200 };
    const data = {
      notes: [
        { id: "milk", color: "blue", text: "Buy milk\n", frame },
        { id: "call", color: "pink", text: "Call Ada\n", translucent: true },
      ],
    };
    const puts: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return new Response('{"rev":2}', { status: 200 });
        }
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    render(<Fresh noteId="call" />);
    await screen.findByRole("group", { name: "Call Ada" });
    expect(note("Call Ada")).toHaveAttribute("data-color", "pink");

    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]).toEqual({
      base: 1,
      data: {
        notes: [
          { id: "milk", color: "blue", text: "Buy milk\n", frame },
          {
            id: "call",
            color: "pink",
            text: "Call Ada\nat noon",
            html: "<b>Call Ada</b><div>at noon</div>",
            translucent: true,
          },
        ],
      },
    });
  });

  it("merges an edit that meets another window's newer notes, and shows the merge in every note", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    type Saved = { notes: { id: string; color: string; text: string }[] };
    const milk = { id: "milk", color: "blue", text: "Buy milk\n" };
    const call = { id: "call", color: "pink", text: "Call Ada\n" };
    let server: { data: Saved; rev: number } = { data: { notes: [milk, call] }, rev: 1 };
    const puts: { base: number; data: Saved }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          puts.push(body);
          // Another window rewrites the milk note just before this page's first save arrives.
          if (puts.length === 1) {
            const oat = { id: "milk", color: "yellow", text: "Buy oat milk\n" };
            server = { data: { notes: [oat, call] }, rev: 2 };
          }
          if (body.base !== server.rev) {
            return new Response(JSON.stringify({ error: "changed", rev: server.rev }), {
              status: 409,
            });
          }
          server = { data: body.data, rev: server.rev + 1 };
          return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    render(
      <>
        <Fresh noteId="milk" />
        <Fresh noteId="call" />
      </>,
    );
    await screen.findByRole("group", { name: "Call Ada" });
    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    // The open milk note shows the other window's text and colour.
    const oat = await screen.findByRole("group", { name: "Buy oat milk" }, { timeout: 3000 });
    expect(oat).toHaveAttribute("data-color", "yellow");
    // The edit that met the newer notes is merged onto them, not dropped, and saved on their
    // revision.
    await vi.waitFor(() => expect(server.rev).toBe(3), { timeout: 3000 });
    expect(puts).toHaveLength(2);
    expect(puts[1]?.base).toBe(2);
    expect(textOf("Call Ada")).toHaveTextContent("at noon");

    // An edit of the milk note builds on what it shows, not on the copy it first read.
    retype("Buy oat milk", "<b>Buy oat milk</b><div>today</div>");
    await vi.waitFor(() => expect(server.rev).toBe(4), { timeout: 3000 });
    expect(puts.at(-1)?.base).toBe(3);
    expect(server.data.notes).toEqual([
      {
        id: "milk",
        color: "yellow",
        text: "Buy oat milk\ntoday",
        html: "<b>Buy oat milk</b><div>today</div>",
      },
      {
        id: "call",
        color: "pink",
        text: "Call Ada\nat noon",
        html: "<b>Call Ada</b><div>at noon</div>",
      },
    ]);
  });

  it("takes the stored note's translucency and collapse when only they changed", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const milk = { id: "milk", color: "blue", text: "Buy milk\n" };
    const call = { id: "call", color: "pink", text: "Call Ada\n" };
    let server: { data: { notes: object[] }; rev: number } = {
      data: { notes: [milk, call] },
      rev: 1,
    };
    let puts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts += 1;
          const body = JSON.parse(String(init.body));
          // Another window makes the milk note translucent and collapses it, text unchanged,
          // just before this page's first save arrives.
          if (puts === 1) {
            const shaded = { ...milk, translucent: true, collapsed: true };
            server = { data: { notes: [shaded, call] }, rev: 2 };
          }
          if (body.base !== server.rev) {
            return new Response(JSON.stringify({ error: "changed", rev: server.rev }), {
              status: 409,
            });
          }
          server = { data: body.data, rev: server.rev + 1 };
          return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    render(
      <>
        <Fresh noteId="milk" />
        <Fresh noteId="call" />
      </>,
    );
    const before = await screen.findByRole("group", { name: "Buy milk" });
    expect(before).not.toHaveAttribute("data-translucent");
    expect(before).not.toHaveAttribute("data-collapsed");
    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    await waitFor(
      () => {
        const after = screen.getByRole("group", { name: "Buy milk" });
        expect(after).toHaveAttribute("data-translucent");
        expect(after).toHaveAttribute("data-collapsed");
      },
      { timeout: 3000 },
    );
    // The edit made here is merged onto that change and saved on its revision.
    await vi.waitFor(() => expect(puts).toBe(2), { timeout: 3000 });
    expect(textOf("Call Ada")).toHaveTextContent("at noon");
    expect(server.rev).toBe(3);
  });

  it("shows a saved note's own states, not the host's, and discards a collapse on a reload", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const milk = { id: "milk", color: "blue", text: "Buy milk\n" };
    const call = { id: "call", color: "pink", text: "Call Ada\n" };
    const server = { data: { notes: [milk, call] }, rev: 1 };
    let puts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method !== "PUT") return new Response(JSON.stringify(server), { status: 200 });
        puts += 1;
        return new Response(JSON.stringify({ error: "changed", rev: 2 }), { status: 409 });
      }),
    );
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    const user = userEvent.setup();
    render(
      <>
        <Fresh noteId="milk" translucent defaultCollapsed />
        <Fresh noteId="call" />
      </>,
    );
    // The saved milk note is neither translucent nor collapsed, whatever the host asks.
    const milkNote = await screen.findByRole("group", { name: "Buy milk" });
    expect(milkNote).not.toHaveAttribute("data-translucent");
    expect(milkNote).not.toHaveAttribute("data-collapsed");
    // Collapsed here, then a save of the other note meets a conflict: the stored notes are
    // read again and the milk note shows them, not expanded or collapsed by this window.
    await user.click(within(milkNote).getByRole("button", { name: "Collapse" }));
    expect(screen.getByRole("group", { name: "Buy milk" })).toHaveAttribute("data-collapsed");
    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    // The save meets a conflict: the stored notes are read again and shown in both notes, the
    // edit merged onto them. This server refuses every save, so after four refusals the merge is
    // kept unsaved, not sent again until the next change.
    await vi.waitFor(() => expect(puts).toBe(4), { timeout: 8000 });
    const after = screen.getByRole("group", { name: "Buy milk" });
    expect(after).not.toHaveAttribute("data-collapsed");
    expect(after).not.toHaveAttribute("data-translucent");
    expect(textOf("Call Ada")).toHaveTextContent("at noon");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(puts).toBe(4);
    expect(screen.getByRole("group", { name: "Call Ada" })).toHaveAttribute(
      "aria-description",
      "Not saved",
    );
  }, 15_000);

  it("writes nothing when the session's notes could not be read", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    render(<Fresh defaultText="Call Ada" />);
    // Not editable while the read is under way (tried three times), then a note of the defaults.
    await vi.waitFor(() => expect(note("Call Ada")).not.toHaveAttribute("inert"), {
      timeout: 5000,
    });

    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    await new Promise((resolve) => setTimeout(resolve, 600));
    const methods = fetch.mock.calls.map(
      (call) => (call as unknown[])[1] as RequestInit | undefined,
    );
    expect(methods.some((init) => init?.method === "PUT")).toBe(false);
  });

  it("takes a malformed document for no read and writes nothing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    // A note that is not one, one of no known colour, and a revision that is not a number.
    const bodies = [
      { data: { notes: [null] }, rev: 1 },
      { data: { notes: [{ id: "a", color: "teal", text: "" }] }, rev: 1 },
      { data: { notes: [] }, rev: "1" },
    ];
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Response('{"rev":2}', { status: 200 })
        : new Response(JSON.stringify(bodies.shift()), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    render(<Fresh defaultText="Call Ada" />);
    await vi.waitFor(() => expect(note("Call Ada")).not.toHaveAttribute("inert"), {
      timeout: 5000,
    });

    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    await new Promise((resolve) => setTimeout(resolve, 600));
    const inits = fetch.mock.calls.map((call) => (call as unknown[])[1] as RequestInit | undefined);
    expect(inits.filter((init) => init?.method === undefined)).toHaveLength(3);
    expect(inits.some((init) => init?.method === "PUT")).toBe(false);
  });

  it("marks the note unsaved when a save is refused, and saves a colour change alone", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const data = { notes: [{ id: "note-1", color: "blue", text: "Buy milk\n" }] };
    const puts: { data: typeof data }[] = [];
    let refuse = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return refuse
            ? new Response('{"error":"too long"}', { status: 400 })
            : new Response('{"rev":2}', { status: 200 });
        }
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    const { rerender } = render(<Fresh color="yellow" />);
    await screen.findByRole("group", { name: "Buy milk" });
    // The saved colour opens the note, whatever colour the host first gives.
    expect(note("Buy milk")).toHaveAttribute("data-color", "blue");

    retype("Buy milk", "<b>Buy milk</b><div>and eggs</div>");
    await vi.waitFor(() => expect(note("Buy milk")).toHaveAttribute("data-unsaved"), {
      timeout: 2000,
    });
    expect(note("Buy milk")).toHaveAttribute("aria-description", "Not saved");

    // A colour the host gives later is not the note's: the saved colour stays.
    rerender(<Fresh color="green" />);
    expect(note("Buy milk")).toHaveAttribute("data-color", "blue");

    // Choosing a colour from the note's contextual menu, with no change to the text, is saved.
    refuse = false;
    const count = puts.length;
    fireEvent.contextMenu(textOf("Buy milk"), { clientX: 60, clientY: 60 });
    const pink = await screen.findByRole("menuitemradio", { name: "Pink" });
    expect(screen.getByRole("menuitemradio", { name: "Blue" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(pink);
    expect(note("Buy milk")).toHaveAttribute("data-color", "pink");
    await vi.waitFor(() => expect(note("Buy milk")).not.toHaveAttribute("data-unsaved"), {
      timeout: 2000,
    });
    expect(puts.length).toBe(count + 1);
    // The edit's formats stay with the colour.
    expect(puts.at(-1)?.data.notes).toEqual([
      {
        id: "note-1",
        color: "pink",
        text: "Buy milk\nand eggs",
        html: "<b>Buy milk</b><div>and eggs</div>",
      },
    ]);
  });

  it("saves a colour-only change from the contextual menu", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const data = { notes: [{ id: "note-1", color: "blue", text: "Buy milk\n" }] };
    const puts: { base: number; data: typeof data }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return new Response('{"rev":2}', { status: 200 });
        }
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    render(<Fresh />);
    await screen.findByRole("group", { name: "Buy milk" });
    fireEvent.contextMenu(textOf("Buy milk"), { clientX: 60, clientY: 60 });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Green" }));
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]).toEqual({
      base: 1,
      data: { notes: [{ id: "note-1", color: "green", text: "Buy milk\n" }] },
    });
  });

  it("opens the other note's own text when its noteId changes", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const data = {
      notes: [
        { id: "milk", color: "blue", text: "Buy milk\n" },
        { id: "call", color: "pink", text: "Call Ada\n" },
      ],
    };
    const puts: { data: typeof data }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return new Response('{"rev":2}', { status: 200 });
        }
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    const { StickiesDesktopNote: Fresh } = await import("./stickies");
    const { rerender } = render(<Fresh noteId="milk" />);
    await screen.findByRole("group", { name: "Buy milk" });
    rerender(<Fresh noteId="call" />);
    expect(note("Call Ada")).toHaveAttribute("data-color", "pink");

    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]?.data.notes).toEqual([
      { id: "milk", color: "blue", text: "Buy milk\n" },
      {
        id: "call",
        color: "pink",
        text: "Call Ada\nat noon",
        html: "<b>Call Ada</b><div>at noon</div>",
      },
    ]);
  });

  it("refuses typing past its maximum length", () => {
    render(<StickiesNote defaultText="Call Ada" maxLength={10} />);
    const field = textOf("Call Ada");
    const insert = (data: string) => {
      const event = new InputEvent("beforeinput", {
        inputType: "insertText",
        data,
        cancelable: true,
      });
      field.dispatchEvent(event);
      return event.defaultPrevented;
    };
    // "Call Ada" is eight characters.
    expect(insert("!")).toBe(false);
    expect(insert("!!!")).toBe(true);
  });

  it("counts characters as the application does, not UTF-16 units", () => {
    // Three emoji are three characters, and six UTF-16 units.
    render(<StickiesNote defaultText="😀😀😀" maxLength={4} />);
    const field = screen.getByRole("textbox");
    const insert = (data: string) => {
      const event = new InputEvent("beforeinput", {
        inputType: "insertText",
        data,
        cancelable: true,
      });
      field.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(insert("😀")).toBe(false);
    expect(insert("😀😀")).toBe(true);
  });

  it("lets a text given past its maximum length be shortened", () => {
    const texts: string[] = [];
    render(
      <StickiesNote defaultText="Call Ada" maxLength={5} onTextChange={(t) => texts.push(t)} />,
    );
    const field = textOf("Call Ada");
    field.innerHTML = "Call Ad";
    fireEvent.input(field);
    expect(texts.at(-1)).toBe("Call Ad");
    // Longer again, and still past the limit: undone.
    field.innerHTML = "Call Ada";
    fireEvent.input(field);
    expect(field.innerHTML).toBe("Call Ad");
  });

  it("undoes an edit that took the kept text past its maximum length", () => {
    const texts: string[] = [];
    render(
      <StickiesNote defaultText="Call Ada" maxLength={9} onTextChange={(t) => texts.push(t)} />,
    );
    const field = textOf("Call Ada");
    // Enter after the text: the browser adds a block holding a break, one line break.
    field.insertAdjacentHTML("beforeend", "<div><br></div>");
    fireEvent.input(field);
    expect(texts.at(-1)).toBe("Call Ada\n");
    const before = field.innerHTML;

    // Enter again is a second line break, past the limit: the edit is undone.
    field.insertAdjacentHTML("beforeend", "<div><br></div>");
    fireEvent.input(field);
    expect(field.innerHTML).toBe(before);
    expect(texts.at(-1)).toBe("Call Ada\n");
  });

  it("keeps the line breaks the note shows, in the markup browsers make for Enter", () => {
    const texts: string[] = [];
    render(<StickiesNote defaultText="Call Ada" onTextChange={(t) => texts.push(t)} />);
    const cases: [string, string][] = [
      ["a<div>b</div>", "a\nb"],
      ["<div>a</div><div>b</div>", "a\nb"],
      ["a<div><br></div>", "a\n"],
      ["a<div><br></div><div>b</div>", "a\n\nb"],
      ["<div>a<br><br></div><div>b</div>", "a\n\nb"],
      ["<p>a</p><p>b</p>", "a\nb"],
      ["a<br>b", "a\nb"],
      ["<ul><li>one</li><li>two</li></ul>", "one\ntwo"],
      ["a<ol><li>one</li><li>two</li></ol>b", "a\none\ntwo\nb"],
      ["<h1>Title</h1>body", "Title\nbody"],
      ["<blockquote>quoted</blockquote><pre>code</pre>", "quoted\ncode"],
    ];
    for (const [html, kept] of cases) {
      const field = screen.getByRole("textbox");
      field.innerHTML = html;
      fireEvent.input(field);
      expect(texts.at(-1), html).toBe(kept);
    }
  });

  it("reads back the text it opens with, line for line", () => {
    for (const text of ["Call Ada\nat noon", "Call Ada\n\nat noon", "Call Ada\n", "\nsecond"]) {
      const texts: string[] = [];
      const { unmount } = render(
        <StickiesNote defaultText={text} onTextChange={(t) => texts.push(t)} />,
      );
      fireEvent.input(screen.getByRole("textbox"));
      expect(texts.at(-1)).toBe(text);
      unmount();
    }
  });

  it("reads its default text once, and keeps what was typed when it changes", () => {
    const { rerender } = render(<StickiesNote defaultText="Call Ada" />);
    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    rerender(<StickiesNote defaultText="Something else" />);
    expect(textOf("Call Ada")).toHaveTextContent("Call Adaat noon");
  });

  it("undoes a composition that ends past its maximum length", () => {
    const texts: string[] = [];
    render(
      <StickiesNote defaultText="Call Ada" maxLength={10} onTextChange={(t) => texts.push(t)} />,
    );
    const field = textOf("Call Ada");
    const before = field.innerHTML;
    fireEvent.compositionStart(field);
    // An input method composes without a beforeinput it lets be refused.
    field.insertAdjacentHTML("beforeend", "にほんご");
    field.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    expect(field.innerHTML).not.toBe(before);
    fireEvent.compositionEnd(field);
    expect(field.innerHTML).toBe(before);
    // The owner hears the text as it is put back.
    expect(texts.at(-1)).toBe("Call Ada");
  });

  it("keeps the formats a command made when it undoes an edit past its maximum length", () => {
    render(<StickiesNote defaultText="Call Ada" maxLength={9} />);
    const field = textOf("Call Ada");
    recordCommands(() => field, wrapIn("i"));
    select(field, "Ada");
    press(field, "i");
    expect(field.innerHTML).toBe("<b>Call <i>Ada</i></b>");
    // Two line breaks take the text past nine characters: the edit is undone, and the text
    // goes back to what it was after the command, not before it.
    field.insertAdjacentHTML("beforeend", "<div><br></div><div><br></div>");
    fireEvent.input(field);
    expect(field.innerHTML).toBe("<b>Call <i>Ada</i></b>");
  });
});

describe("text styles", () => {
  it("lists the Font menu of Stickies with its key equivalents", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    await user.click(screen.getByRole("menuitem", { name: "Font" }));
    const menu = await screen.findByRole("menu");
    const rows = (container: HTMLElement) =>
      [...container.querySelectorAll('[role^="menuitem"]')].map((row) => [
        row.querySelector(".mac-menu-item-title")?.textContent,
        row.getAttribute("aria-keyshortcuts"),
      ]);
    // Command is the Control key off Apple platforms.
    expect(rows(menu)).toEqual([
      ["Show Fonts", "Control+T"],
      ["Bold", "Control+B"],
      ["Italic", "Control+I"],
      ["Underline", "Control+U"],
      ["Bigger", "Control+Plus"],
      ["Smaller", "Control+-"],
      ["Show Colors", "Shift+Control+C"],
      ["Text", null],
    ]);
    await user.click(within(menu).getByRole("menuitem", { name: "Text" }));
    expect(rows(await screen.findByRole("menu", { name: "Text" }))).toEqual([
      ["Align Left", "Control+{"],
      ["Center", "Control+|"],
      ["Justify", null],
      ["Align Right", "Control+}"],
    ]);
  });

  it("runs the Font menu's commands on the key note's selection, which it gives back", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    const commands = recordCommands(() => textOf(WELCOME));
    select(textOf(WELCOME), "jot");
    await choose(user, "Font", "Bold", "menuitemcheckbox");
    await choose(user, "Font", "Italic", "menuitemcheckbox");
    await choose(user, "Font", "Underline", "menuitemcheckbox");
    await choose(user, "Font", "Bigger");
    await choose(user, "Font", "Smaller");
    await user.click(await item(user, "Font", "Text"));
    // A submenu's items take no pointer while it opens: the item is chosen as a click would.
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Center" }));
    // Each ran with the selection back in the note, though the menu had taken the focus.
    expect(commands).toEqual([
      ["bold", undefined, true],
      ["italic", undefined, true],
      ["underline", undefined, true],
      ["fontSize", "7", true],
      ["fontSize", "7", true],
      ["justifyCenter", undefined, true],
    ]);
    // And the note has the keyboard again, not the menu's title.
    await waitFor(() => expect(textOf(WELCOME)).toHaveFocus());
    // The other note is not touched, and with no note in front there is nothing to style.
    expect(commands.every(([, , inside]) => inside)).toBe(true);
    await choose(user, "File", "Close");
    await choose(user, "File", "Close");
    expect(await item(user, "Font", "Bold", "menuitemcheckbox")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("acts on the whole selection a command restyled, though the browser moved it unannounced", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    // As Firefox does: the command moves the selected text into a new element, which collapses
    // any other range that held it, and reports no change of the selection.
    const selected: string[] = [];
    recordCommands(
      () => textOf(WELCOME),
      (name) => {
        selected.push(document.getSelection()?.toString() ?? "");
        wrapIn(name === "italic" ? "i" : name === "bold" ? "b" : "u")();
      },
    );
    select(textOf(WELCOME), "jot");
    press(textOf(WELCOME), "i");
    await choose(user, "Font", "Bold", "menuitemcheckbox");
    await waitFor(() => expect(textOf(WELCOME)).toHaveFocus());
    await choose(user, "Font", "Underline", "menuitemcheckbox");
    await waitFor(() => expect(textOf(WELCOME)).toHaveFocus());
    expect(selected).toEqual(["jot", "jot", "jot"]);
    expect(document.getSelection()?.toString()).toBe("jot");
  });

  it("checks the styles and the alignment of the text at the insertion point", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    retype(
      WELCOME,
      `<b>${WELCOME}</b><div><span style="font-style: italic">slanted</span> <u>under</u> plain</div><div style="text-align: center">middle</div>`,
    );
    const field = textOf(WELCOME);
    const states = async () => {
      await user.click(screen.getByRole("menuitem", { name: "Font" }));
      const menu = await screen.findByRole("menu");
      const checked = ["Bold", "Italic", "Underline"].map((name) =>
        within(menu).getByRole("menuitemcheckbox", { name }).getAttribute("aria-checked"),
      );
      await user.click(within(menu).getByRole("menuitem", { name: "Text" }));
      const text = await screen.findByRole("menu", { name: "Text" });
      const align = within(text)
        .getAllByRole("menuitemradio")
        .find((row) => row.getAttribute("aria-checked") === "true")
        ?.querySelector(".mac-menu-item-title")?.textContent;
      // A press outside closes the menu and its submenu.
      await user.click(document.body);
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
      return [...checked, align];
    };
    select(field, "note", true);
    expect(await states()).toEqual(["true", "false", "false", "Align Left"]);
    select(field, "slanted", true);
    expect(await states()).toEqual(["false", "true", "false", "Align Left"]);
    select(field, "under", true);
    expect(await states()).toEqual(["false", "false", "true", "Align Left"]);
    select(field, "plain", true);
    expect(await states()).toEqual(["false", "false", "false", "Align Left"]);
    select(field, "middle", true);
    expect(await states()).toEqual(["false", "false", "false", "Center"]);
  });

  it("runs the key equivalents of the Font menu while a note has the keyboard", async () => {
    render(<Stickies />);
    const field = textOf(WELCOME);
    const commands = recordCommands(() => textOf(WELCOME));
    select(field, "jot");
    // Taken from the browser, whose own keys would do something else.
    expect(press(field, "b")).toBe(false);
    press(field, "i");
    press(field, "u");
    press(field, "+", true);
    press(field, "=");
    press(field, "-");
    press(field, "{", true);
    press(field, "|", true);
    press(field, "}", true);
    // Without Command (Control here) a key is typed.
    expect(fireEvent.keyDown(field, { key: "b" })).toBe(true);
    expect(commands).toEqual([
      ["bold", undefined, true],
      ["italic", undefined, true],
      ["underline", undefined, true],
      ["fontSize", "7", true],
      ["fontSize", "7", true],
      ["fontSize", "7", true],
      ["justifyLeft", undefined, true],
      ["justifyCenter", undefined, true],
      ["justifyRight", undefined, true],
    ]);

    // Command-T shows the Fonts panel and Shift-Command-C the Colors panel; the note keeps
    // the keyboard, as a Catalina document does.
    press(field, "t");
    expect(await screen.findByRole("dialog", { name: "Fonts" })).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveFocus());
    press(field, "C", true);
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    // They are utility panels of the desktop: one of each for every note.
    for (const name of ["Fonts", "Colors"]) {
      const panel = screen.getByRole("dialog", { name });
      expect(panel).toHaveAttribute("data-variant", "panel");
      expect(panel.closest("[data-window-id]")).toHaveAttribute(
        "data-window-id",
        `stickies-${name.toLowerCase()}`,
      );
    }
    act(() => textOf(CUSTOMIZE).focus());
    press(textOf(CUSTOMIZE), "t");
    expect(screen.getAllByRole("dialog", { name: "Fonts" })).toHaveLength(1);
  });

  it("applies what the Fonts panel changes to the note's selection, and follows the insertion point", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    retype(
      WELCOME,
      `<b>${WELCOME}</b><div><span style="font-family: Helvetica">plain</span> <span style="font-family: Georgia, serif">serif</span> <span style="font-family: Courier">fixed</span></div>`,
    );
    const field = textOf(WELCOME);
    const commands = recordCommands(() => textOf(WELCOME));
    select(field, "serif", true);
    await choose(user, "Font", "Show Fonts");
    const panel = await screen.findByRole("dialog", { name: "Fonts" });
    const list = (name: string) => within(panel).getByRole("listbox", { name });
    const selected = (name: string) =>
      [...list(name).querySelectorAll("[aria-selected=true]")].map((row) => row.textContent);
    const option = (name: string, row: string) =>
      [...list(name).querySelectorAll<HTMLElement>("[role=option]")].find(
        (each) => each.textContent === row,
      ) as HTMLElement;
    // The panel shows the font where the insertion point is.
    expect(selected("Family")).toEqual(["Georgia"]);
    select(field, "fixed", true);
    expect(selected("Family")).toEqual(["Courier"]);
    select(field, "plain", true);
    expect(selected("Family")).toEqual(["Helvetica"]);
    expect(selected("Typeface")).toEqual(["Regular"]);

    // A family and a typeface, chosen in the panel, which has taken the keyboard and the
    // selection, act on the word that was selected in the note.
    select(field, "plain");
    act(() => list("Family").focus());
    document.getSelection()?.removeAllRanges();
    fireEvent.mouseDown(option("Family", "Times"));
    act(() => list("Typeface").focus());
    document.getSelection()?.removeAllRanges();
    fireEvent.mouseDown(option("Typeface", "Bold"));
    await user.click(within(panel).getByRole("combobox", { name: "Text strikethrough" }));
    await user.click(await screen.findByRole("option", { name: "Single" }));
    expect(commands).toEqual([
      ["fontName", "Times, 'Times New Roman', serif", true],
      ["bold", undefined, true],
      ["strikeThrough", undefined, true],
    ]);
    // Its close button closes it.
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Fonts" })).toBeNull();
  });

  it("applies a colour from the Colors panel to the note's selection", async () => {
    const user = userEvent.setup();
    render(<Stickies />);
    const commands = recordCommands(() => textOf(WELCOME));
    select(textOf(WELCOME), "jot");
    await choose(user, "Font", "Show Colors");
    const panel = await screen.findByRole("dialog", { name: "Colors" });
    await user.click(within(panel).getByRole("tab", { name: "Color Palettes" }));
    await user.click(within(panel).getByRole("radio", { name: "Blue" }));
    expect(commands).toEqual([["foreColor", "#0000ff", true]]);
    // The Color menu is still the note's colour, not the text's.
    expect(note(WELCOME)).toHaveAttribute("data-color", "yellow");
  });

  it("has the Font menu in a note's contextual menu, after the colours when it takes one", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StickiesNote defaultText={"Call Ada\nat noon"} />);
    // Held here: while the contextual menu is open the rest of the page is hidden from queries.
    const field = textOf("Call Ada");
    const commands = recordCommands(() => field);
    select(field, "noon");
    fireEvent.contextMenu(field, { clientX: 60, clientY: 60 });
    let menu = await screen.findByRole("menu", { name: "Note" });
    expect(within(menu).queryAllByRole("menuitemradio")).toHaveLength(0);
    await user.click(within(menu).getByRole("menuitem", { name: "Font" }));
    // A submenu's items take no pointer while it opens: the item is chosen as a click would.
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "Font" })).getByRole("menuitemcheckbox", {
        name: "Italic",
      }),
    );
    expect(commands).toEqual([["italic", undefined, true]]);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    rerender(<StickiesNote defaultText={"Call Ada\nat noon"} onColorChange={() => {}} />);
    fireEvent.contextMenu(textOf("Call Ada"), { clientX: 60, clientY: 60 });
    menu = await screen.findByRole("menu", { name: "Note" });
    expect(
      [...menu.querySelectorAll('[role^="menuitem"] .mac-menu-item-title')].map(
        (row) => row.textContent,
      ),
    ).toEqual([
      "Yellow",
      "Blue",
      "Green",
      "Pink",
      "Purple",
      "Gray",
      "Undo",
      "Redo",
      "Cut",
      "Copy",
      "Paste",
      "Select All",
      "Paste and Match Style",
      "Delete",
      "Spelling and Grammar",
      "Substitutions",
      "Find",
      "Look Up",
      "Transformations",
      "Speech",
      "Font",
    ]);
  });

  it("shows its own panels: over the page, in its window manager, or as windows of a desktop", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<StickiesNote defaultText="Call Ada" />);
    act(() => textOf("Call Ada").focus());
    press(textOf("Call Ada"), "t");
    let panel = await screen.findByRole("dialog", { name: "Fonts" });
    expect(panel.parentElement).toHaveClass("mac-stickies-panels");
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();

    // In a window manager (a page that hosts the note through `app.component`).
    const hosted = render(
      <WindowManager style={{ height: 500 }}>
        <ManagedWindow
          id="note"
          zoomButton="zoom"
          render={(props) => <app.component {...props} defaultText="Call Ada" />}
        />
      </WindowManager>,
    );
    act(() => textOf("Call Ada").focus());
    press(textOf("Call Ada"), "C", true);
    panel = await screen.findByRole("dialog", { name: "Colors" });
    const frame = panel.closest("[data-window-id]") as HTMLElement;
    expect(frame.parentElement).toHaveClass("mac-window-manager");
    expect(panel).toHaveAttribute("data-variant", "panel");
    hosted.unmount();

    // On the desktop, which gives the note `DesktopWindow` as `app.windows` asks.
    const desktop = render(
      <WindowManager style={{ height: 500 }}>
        <DesktopWindowHostContext
          value={{
            app: "stickies",
            stage: () => document.querySelector(".mac-window-manager"),
            place: () => ({ x: 400, y: 40 }),
          }}
        >
          <ManagedWindow
            id="stickies"
            zoomButton="zoom"
            render={(props) => (
              <app.component
                {...props}
                defaultText="Call Ada"
                DesktopWindow={DesktopSecondaryWindow}
              />
            )}
          />
        </DesktopWindowHostContext>
      </WindowManager>,
    );
    act(() => textOf("Call Ada").focus());
    press(textOf("Call Ada"), "t");
    panel = await screen.findByRole("dialog", { name: "Fonts" });
    expect(panel.closest("[data-window-id]")?.getAttribute("data-window-id")).toMatch(
      /^stickies:.+-fonts$/,
    );
    // The note keeps the keyboard, and the panel's close button closes it.
    await waitFor(() => expect(textOf("Call Ada")).toHaveFocus());
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Fonts" })).toBeNull());
    desktop.unmount();
  });

  it("keeps one Fonts panel among the notes of a desktop, each panel a window of its own id", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error");
    render(
      <WindowManager style={{ height: 500 }}>
        <DesktopWindowHostContext
          value={{
            app: "stickies",
            stage: () => document.querySelector(".mac-window-manager"),
            place: () => ({ x: 400, y: 40 }),
          }}
        >
          {["Call Ada", "Buy milk"].map((text, index) => (
            <ManagedWindow
              key={text}
              id={`stickies-${index}`}
              zoomButton="zoom"
              render={(props) => (
                <app.component
                  {...props}
                  defaultText={text}
                  DesktopWindow={DesktopSecondaryWindow}
                />
              )}
            />
          ))}
        </DesktopWindowHostContext>
      </WindowManager>,
    );
    const windowId = (element: Element) =>
      element.closest("[data-window-id]")?.getAttribute("data-window-id");
    act(() => textOf("Call Ada").focus());
    press(textOf("Call Ada"), "t");
    const first = windowId(await screen.findByRole("dialog", { name: "Fonts" }));
    press(textOf("Call Ada"), "C", true);
    await screen.findByRole("dialog", { name: "Colors" });

    // The other note's Show Fonts moves the Fonts panel to that note: the first note's closes,
    // and its Colors panel, another panel, stays.
    act(() => textOf("Buy milk").focus());
    press(textOf("Buy milk"), "t");
    await waitFor(() =>
      expect(windowId(screen.getByRole("dialog", { name: "Fonts" }))).not.toBe(first),
    );
    expect(screen.getAllByRole("dialog", { name: "Fonts" })).toHaveLength(1);
    expect(screen.getAllByRole("dialog", { name: "Colors" })).toHaveLength(1);
    const ids = [...document.querySelectorAll("[data-window-id]")].map((each) =>
      each.getAttribute("data-window-id"),
    );
    expect(new Set(ids).size).toBe(ids.length);

    // Each closes by itself.
    const fonts = screen.getByRole("dialog", { name: "Fonts" });
    await user.click(within(fonts).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Fonts" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("puts enclosing panels into the element of the window manager they are rendered in", () => {
    const panels = (
      <StickiesPanels
        open={["colors"]}
        onClose={() => {}}
        onFormatChange={() => {}}
        manager="enclosing"
      />
    );
    // Rendered in a window of the first of two managers: a window of that manager, out of the
    // window it is rendered in and in that manager's element.
    const { unmount } = render(
      <>
        <WindowManager className="first" style={{ height: 400 }}>
          <ManagedWindow id="host" title="Host">
            {panels}
          </ManagedWindow>
        </WindowManager>
        <WindowManager className="second" style={{ height: 400 }}>
          <ManagedWindow id="stickies-colors" title="Other" />
        </WindowManager>
      </>,
    );
    let panel = screen.getByRole("dialog", { name: "Colors" });
    const frame = panel.closest("[data-window-id]") as HTMLElement;
    expect(frame).toHaveAttribute("data-window-id", "stickies-colors");
    expect(frame.parentElement).toHaveClass("first");
    expect(document.querySelectorAll(".second > [data-window-id]")).toHaveLength(1);
    unmount();

    // Around no manager's element, it floats over the page.
    render(panels);
    panel = screen.getByRole("dialog", { name: "Colors" });
    expect(panel.parentElement).toHaveClass("mac-stickies-panels");
  });
});

describe("formatted notes on the Ferrite application", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** The application's notes, and the bodies of the saves the page sends it. */
  function serve(data: object) {
    const puts: { base: number; data: { notes: Record<string, unknown>[] } }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return new Response(`{"rev":${puts.length + 1}}`, { status: 200 });
        }
        return new Response(JSON.stringify({ data, rev: 1 }), { status: 200 });
      }),
    );
    return puts;
  }

  async function fresh() {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    return (await import("./stickies")).StickiesDesktopNote;
  }

  it("opens a note with its saved formats, rebuilt from what formatting writes", async () => {
    const Fresh = await fresh();
    serve({
      notes: [
        {
          id: "note-1",
          color: "blue",
          text: "Buy milk\nand eggsnow",
          html:
            '<b>Buy milk</b><div>and <span style="font-style: italic;" onmouseover="steal()">eggs</span>' +
            '<script>steal()</script><img src="x" onerror="steal()"><a href="javascript:steal()">now</a></div>',
        },
      ],
    });
    render(<Fresh />);
    await screen.findByRole("group", { name: "Buy milk" });
    const field = textOf("Buy milk");
    expect(field.innerHTML).toBe(
      '<b>Buy milk</b><div>and <span style="font-style: italic;">eggs</span>now</div>',
    );
    expect(field.querySelector("script, img, a, [onerror], [onmouseover]")).toBeNull();
  });

  it("opens a note saved before formats were kept, or whose formats are out of date, as its text", async () => {
    const Fresh = await fresh();
    serve({
      notes: [
        { id: "old", color: "blue", text: "Buy milk\nand eggs" },
        { id: "stale", color: "pink", text: "Call Ada\n", html: "<b>Call Grace</b>" },
      ],
    });
    render(
      <>
        <Fresh noteId="old" />
        <Fresh noteId="stale" />
      </>,
    );
    await screen.findByRole("group", { name: "Buy milk" });
    expect(textOf("Buy milk").innerHTML).toBe("<b>Buy milk</b>\nand eggs");
    expect(textOf("Call Ada").innerHTML).toBe("<b>Call Ada</b>\n");
  });

  it("saves an edit's formats, without anything that would run", async () => {
    const Fresh = await fresh();
    const puts = serve({ notes: [{ id: "note-1", color: "blue", text: "Buy milk\n" }] });
    render(<Fresh />);
    await screen.findByRole("group", { name: "Buy milk" });
    // Pasted rich text brings attributes and elements that formatting never writes.
    retype(
      "Buy milk",
      '<b>Buy milk</b><div>and <span style="font-weight: bold" onclick="steal()">eggs</span><img src="x" onerror="steal()"></div>',
    );
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]?.data.notes).toEqual([
      {
        id: "note-1",
        color: "blue",
        text: "Buy milk\nand eggs",
        html: '<b>Buy milk</b><div>and <span style="font-weight: bold;">eggs</span></div>',
      },
    ]);
  });

  it("saves what a format command did, and keeps the formats when only the colour changes", async () => {
    const Fresh = await fresh();
    const puts = serve({
      notes: [
        {
          id: "note-1",
          color: "blue",
          text: "Buy milk\neggs",
          html: "<b>Buy milk</b><div>eggs</div>",
        },
      ],
    });
    render(<Fresh />);
    await screen.findByRole("group", { name: "Buy milk" });
    expect(textOf("Buy milk").innerHTML).toBe("<b>Buy milk</b><div>eggs</div>");

    // A colour alone: the saved formats stay as they are.
    fireEvent.contextMenu(textOf("Buy milk"), { clientX: 60, clientY: 60 });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Green" }));
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]?.data.notes).toEqual([
      {
        id: "note-1",
        color: "green",
        text: "Buy milk\neggs",
        html: "<b>Buy milk</b><div>eggs</div>",
      },
    ]);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    // Command-I on a word: the browser's command, and then the save of what it did.
    const field = textOf("Buy milk");
    recordCommands(() => field, wrapIn("i"));
    select(field, "eggs");
    press(field, "i");
    await vi.waitFor(() => expect(puts).toHaveLength(2), { timeout: 2000 });
    expect(puts[1]?.data.notes).toEqual([
      {
        id: "note-1",
        color: "green",
        text: "Buy milk\neggs",
        html: "<b>Buy milk</b><div><i>eggs</i></div>",
      },
    ]);
  });

  it("saves the text alone when its formats are longer than the application keeps", async () => {
    const Fresh = await fresh();
    const puts = serve({
      notes: [{ id: "note-1", color: "blue", text: "Buy milk", html: "<b>Buy milk</b>" }],
    });
    render(<Fresh />);
    await screen.findByRole("group", { name: "Buy milk" });
    // 3,000 characters, each in a span of its own: over 100,000 bytes of markup.
    const spans = '<span style="font-weight: bold;">x</span>'.repeat(3000);
    retype("Buy milk", `<b>Buy milk</b><div>${spans}</div>`);
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]?.data.notes).toEqual([
      { id: "note-1", color: "blue", text: `Buy milk\n${"x".repeat(3000)}` },
    ]);
  });

  it("takes a note whose formatted text is not text for no read, and writes nothing", async () => {
    const Fresh = await fresh();
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Response('{"rev":2}', { status: 200 })
        : new Response(
            JSON.stringify({
              data: { notes: [{ id: "a", color: "blue", text: "", html: 5 }] },
              rev: 1,
            }),
            { status: 200 },
          ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<Fresh defaultText="Call Ada" />);
    await vi.waitFor(() => expect(note("Call Ada")).not.toHaveAttribute("inert"), {
      timeout: 5000,
    });
    retype("Call Ada", "<b>Call Ada</b><div>at noon</div>");
    await new Promise((resolve) => setTimeout(resolve, 600));
    const inits = fetch.mock.calls.map((call) => (call as unknown[])[1] as RequestInit | undefined);
    expect(inits.some((init) => init?.method === "PUT")).toBe(false);
  });
});
