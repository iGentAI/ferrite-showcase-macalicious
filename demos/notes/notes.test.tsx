import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, notesApp } from "./app";
import { Notes } from "./notes";
import { DEFAULT_FOLDER, defaultNotes, matches, stamp, summarize } from "./notes-data";
import { noteContent, noteHtml, readLines } from "./notes-editor";
import { LOCK_UNAVAILABLE, type NotesActions, NotesMenuBar, type NotesStatus } from "./notes-menus";
import { MAX_HTML } from "./notes-sync";

/*
 * jsdom has no layout, so the note list is never measured and renders its first 40 rows, and
 * it does not edit `contenteditable` content: an edit is made here as the browser makes it, by
 * changing the editor's content and dispatching the `input` event the browser would.
 */
const frame = () => screen.getByRole("region", { name: "Notes" });
const button = (name: string) => screen.getByRole("button", { name });
/** A toolbar button that is disabled stays reachable, so it is marked with `aria-disabled`. */
const unavailable = (name: string) =>
  button(name).getAttribute("aria-disabled") === "true" || button(name).hasAttribute("disabled");
const folders = () =>
  within(screen.getByRole("tree", { name: "Folders" }))
    .getAllByRole("treeitem")
    .map((row) => row.textContent);
const folder = (name: string) => {
  const row = within(screen.getByRole("tree", { name: "Folders" }))
    .getAllByRole("treeitem")
    .find((candidate) => candidate.textContent?.startsWith(name));
  if (!row) throw new Error(`no folder named ${name}`);
  return row;
};
const rows = () => within(screen.getByRole("listbox", { name: "Notes" })).queryAllByRole("option");
const titles = () =>
  rows().map((row) => row.querySelector(".mac-list-view-row-title")?.textContent);
const row = (title: string) => {
  const found = rows().find((candidate) => candidate.textContent?.startsWith(title));
  if (!found) throw new Error(`no note titled ${title}`);
  return found;
};
const selected = () =>
  rows()
    .filter((candidate) => candidate.getAttribute("aria-selected") === "true")
    .map((candidate) => candidate.querySelector(".mac-list-view-row-title")?.textContent);
/** The editor of the note that is shown; the editors of other notes are hidden. */
const editor = () => screen.getByRole("textbox", { name: "Note" });
const search = () => screen.getByRole("searchbox");
/** Replace the shown note's lines of text, keeping its picture, as typing would. */
const write = (...lines: string[]) => {
  const node = editor();
  for (const child of [...node.children]) {
    if (!(child instanceof HTMLElement) || child.dataset.attachment === undefined) child.remove();
  }
  node.prepend(
    ...lines.map((line) => {
      const element = document.createElement("div");
      element.textContent = line;
      return element;
    }),
  );
  fireEvent.input(node);
};
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  menu: string,
  item: string,
  role = "menuitem",
) => {
  await user.click(button(menu));
  await user.click(await screen.findByRole(role, { name: item }));
};
/**
 * In an open menu, choose `item` of its submenu `submenu` (Font or Text). The keyboard opens the
 * submenu by default, as for a person who has moved to its item with the arrow keys: its item has
 * the focus and the right arrow opens it at once. `via: "pointer"` opens it as the pointer does,
 * by resting on its item, which waits out the submenu's hover delay (200 ms of real time, the
 * library's `Submenu` default): kept for one opening, since a dozen of them made a test wait
 * seconds of real time and time out under load. Either way the item is then clicked where it is,
 * since the way into a submenu needs the layout that jsdom has not (Base UI closes a submenu the
 * pointer leaves toward nothing).
 */
const chooseIn = async (
  user: ReturnType<typeof userEvent.setup>,
  submenu: string,
  item: string,
  role = "menuitem",
  via: "keyboard" | "pointer" = "keyboard",
) => {
  const trigger = await screen.findByRole("menuitem", { name: submenu });
  if (via === "pointer") {
    await user.hover(trigger);
  } else {
    trigger.focus();
    await user.keyboard("{ArrowRight}");
  }
  fireEvent.click(await screen.findByRole(role, { name: item }));
};
/** The browser reports a moved selection in a task of its own. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
/** Select `text` in the note shown (or put the insertion point at `offset` in it), as a drag would. */
const select = async (text: string, offset?: number) => {
  const walker = document.createTreeWalker(editor(), NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && !node.nodeValue?.includes(text)) node = walker.nextNode();
  if (!node) throw new Error(`no text ${text} in the note`);
  const at = (node.nodeValue ?? "").indexOf(text);
  const range = document.createRange();
  range.setStart(node, at + (offset ?? 0));
  range.setEnd(node, offset === undefined ? at + text.length : at + offset);
  editor().focus();
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  await settle();
};

/**
 * The browser's editing commands, recorded: jsdom has none. Each entry is the command, its
 * value and whether the selection was in the note shown when it ran. `run` stands in for what
 * the browser would do to the text.
 */
function recordCommands(run?: (command: string, value: string) => void) {
  const commands: [string, string | undefined, boolean][] = [];
  document.execCommand = (name: string, _ui?: boolean, value?: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, value, anchor !== null && editor().contains(anchor)]);
      run?.(name, value ?? "");
    }
    return true;
  };
  return commands;
}

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
});

/** Notes under its menu bar, as a desktop page shows it. */
function WithMenuBar({ notes }: { notes?: typeof defaultNotes }) {
  const actions = useRef<NotesActions>(null);
  const [status, setStatus] = useState<NotesStatus>();
  return (
    <>
      <NotesMenuBar actions={actions} status={status} />
      <Notes actionsRef={actions} onStatusChange={setStatus} defaultNotes={notes} />
    </>
  );
}
const lockedNotes = defaultNotes.map(({ lines: _lines, attachment: _attachment, ...note }) => ({
  ...note,
  lines: [],
  locked: true,
  sealed: {
    rev: 1,
    kdf: { name: "PBKDF2-SHA-256", iterations: 100_000, salt: "c2FsdHNhbHRzYWx0c2FsdA==" },
    iv: "aXZpdml2aXZpdml2",
    ciphertext: "Y2lwaGVy",
  },
}));
const menuBarMenu = (title: string) =>
  within(screen.getByRole("menubar", { name: "Notes menus" })).getByRole("menuitem", {
    name: title,
  });

describe("the window", () => {
  it("opens on the notes of the reference capture, at its size", () => {
    render(<Notes />);
    expect(frame()).toHaveClass("mac-window", "mac-notes");
    expect(frame().style.width).toBe("1000px");
    expect(frame().style.height).toBe("666px");
    expect(folders()).toEqual(["Notes5"]);
    expect(folder("Notes")).toHaveAttribute("aria-selected", "true");
    expect(rows().map((candidate) => candidate.textContent)).toEqual([
      "Catalina Notes is just about the same as before, but adds a Gallery3:55 PMView.",
      "All computers should be orange9/20/18It’s true.",
      "Are these what the kids call selfies?7/15/181 photo",
      "This is a note in Yosemite7/14/18It’s kinda nice in here.",
      "This is a note in Mavericks.6/13/18Here is an image:",
    ]);
    expect(selected()).toEqual([
      "Catalina Notes is just about the same as before, but adds a Gallery",
    ]);
    expect(screen.getByText("October 3, 2019 at 3:55 PM")).toBeVisible();
    expect(editor()).toHaveTextContent(
      "Catalina Notes is just about the same as before, but adds a Gallery View.",
    );
    expect(within(editor()).getByRole("img")).toHaveAccessibleName("Placeholder for a screenshot");
  });

  it("hands a host's callbacks to the window controls and the title bar", async () => {
    const user = userEvent.setup();
    const on = {
      close: vi.fn(),
      minimize: vi.fn(),
      zoom: vi.fn(),
      press: vi.fn(),
      double: vi.fn(),
    };
    render(
      <Notes
        state="main"
        width={1100}
        onClose={on.close}
        onMinimize={on.minimize}
        onZoom={on.zoom}
        zoomRole="zoom"
        onDragRegionPointerDown={on.press}
        onDragRegionDoubleClick={on.double}
      />,
    );
    expect(frame()).toHaveAttribute("data-window-state", "main");
    expect(frame().style.width).toBe("1100px");
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(on.close).toHaveBeenCalledTimes(1);
    expect(on.minimize).toHaveBeenCalledTimes(1);
    expect(on.zoom).toHaveBeenCalledTimes(1);
    const bar = screen.getByRole("toolbar", { name: "Notes toolbar" });
    fireEvent.pointerDown(bar);
    fireEvent.doubleClick(bar);
    expect(on.press).toHaveBeenCalledTimes(1);
    expect(on.double).toHaveBeenCalledTimes(1);
    // A press on a control is the control's, not the window's.
    fireEvent.pointerDown(button("New Note"));
    expect(on.press).toHaveBeenCalledTimes(1);
  });

  it("disables the controls a host disables", () => {
    render(<Notes minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(notesApp);
    expect(app).toMatchObject({
      id: "notes",
      name: "Notes",
      defaultSize: { width: 1000, height: 666 },
      resizable: true,
    });
    expect(app.menus[0]).toBe("Notes");
    render(
      <WindowManager style={{ height: 700 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().parentElement).toHaveAttribute("data-window-id", "notes");
    expect(rows()).toHaveLength(5);
    await user.click(within(frame()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Notes" })).toBeNull();
  });

  it("shows an account that is syncing", () => {
    render(<Notes syncing />);
    expect(screen.getByRole("group", { name: /^iCloud\s*, syncing$/ })).toBeInTheDocument();
    for (const name of ["Lock", "Add Table", "Make a Checklist", "Format"]) {
      expect(unavailable(name)).toBe(true);
    }
    expect(unavailable("New Note")).toBe(false);
  });
});

describe("notes", () => {
  it("shows the note selected in the list", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("All computers should be orange"));
    expect(selected()).toEqual(["All computers should be orange"]);
    expect(editor()).toHaveTextContent("All computers should be orangeIt’s true.");
    expect(screen.getByText("September 20, 2018 at 10:12 AM")).toBeVisible();
    expect(screen.getByText("October 3, 2019 at 3:55 PM")).not.toBeVisible();
  });

  it("follows an edit in the list: title, snippet, time and place", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("This is a note in Yosemite"));
    write("Groceries", "Oranges, six of them");
    expect(titles()[0]).toBe("Groceries");
    expect(selected()).toEqual(["Groceries"]);
    expect(row("Groceries").textContent).toMatch(
      /^Groceries\d{1,2}:\d{2} [AP]MOranges, six of them$/,
    );
    expect(titles()).toHaveLength(5);
    // What was typed is still in the editor after another note was shown.
    await user.click(row("All computers should be orange"));
    await user.click(row("Groceries"));
    expect(editor()).toHaveTextContent("GroceriesOranges, six of them");
  });

  it("adds a note to the folder shown and puts the insertion point in it", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(button("New Note"));
    expect(titles()).toHaveLength(6);
    expect(row("New Note").textContent).toMatch(/^New Note\d{1,2}:\d{2} [AP]MNo additional text$/);
    expect(selected()).toEqual(["New Note"]);
    expect(folders()).toEqual(["Notes6"]);
    expect(editor()).toHaveTextContent("");
    expect(editor()).toHaveFocus();
    write("Call the plumber");
    expect(titles()[0]).toBe("Call the plumber");
  });

  it("deletes the selected note and selects the one that takes its place", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("All computers should be orange"));
    await user.click(button("Delete"));
    expect(titles()).not.toContain("All computers should be orange");
    expect(selected()).toEqual(["Are these what the kids call selfies?"]);
    expect(folders()).toEqual(["Notes4", "Recently Deleted1"]);
    await user.keyboard("{Backspace}");
    expect(titles()).toHaveLength(4);
    await user.click(row("This is a note in Mavericks."));
    await user.keyboard("{Backspace}");
    expect(selected()).toEqual(["This is a note in Yosemite"]);
    expect(titles()).toHaveLength(3);
  });

  it("dims Lock Note where no server keeps it, and shows a locked note as nothing but its lock", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Notes />);
    await user.click(button("Lock"));
    const lock = await screen.findByRole("menuitem", { name: "Lock Note" });
    expect(lock).toHaveAttribute("aria-disabled", "true");
    expect(lock).toHaveAttribute("title", LOCK_UNAVAILABLE);
    unmount();

    render(<Notes defaultNotes={lockedNotes} />);
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
    const pane = screen.getByRole("form", { name: "Locked note" });
    expect(pane).toHaveTextContent("This note is locked.");
    expect(pane).toHaveTextContent(
      "If you forget this password, the text of the notes locked with it is lost",
    );
    for (const name of ["Add Table", "Make a Checklist", "Format", "Media"]) {
      expect(unavailable(name)).toBe(true);
    }
    await user.click(button("Lock"));
    expect(await screen.findByRole("menuitem", { name: "Remove Lock" })).toBeInTheDocument();
  });

  it("adds a table before the note's picture", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(button("Add Table"));
    const blocks = [...editor().children];
    expect(blocks.at(-2)?.tagName).toBe("TABLE");
    expect(within(editor()).getAllByRole("cell")).toHaveLength(4);
    expect(blocks.at(-1)).toContainElement(within(editor()).getByRole("img"));
    expect(editor()).toHaveFocus();
  });

  it("leaves a line after a table that ends the note", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("All computers should be orange"));
    await user.click(button("Add Table"));
    const blocks = [...editor().children];
    expect(blocks.at(-2)?.tagName).toBe("TABLE");
    expect(blocks.at(-1)?.outerHTML).toBe("<div><br></div>");
    const firstCell = within(editor()).getAllByRole("cell")[0];
    expect(firstCell?.contains(window.getSelection()?.anchorNode ?? null)).toBe(true);
  });

  it("makes the line with the insertion point a heading, the title, and body text again", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("All computers should be orange"));
    const line = within(editor()).getByText("It’s true.");
    document.getSelection()?.collapse(line.firstChild, 2);
    // The browser reports a moved insertion point in a task of its own.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await choose(user, "Format", "Heading", "menuitemradio");
    expect(within(editor()).getByRole("heading", { name: "It’s true." })).toBeInTheDocument();
    expect(within(editor()).getByRole("heading").tagName).toBe("H2");
    await waitFor(() => expect(editor()).toHaveFocus());
    await choose(user, "Format", "Title", "menuitemradio");
    expect(within(editor()).getByRole("heading", { name: "It’s true." }).tagName).toBe("H1");
    await choose(user, "Format", "Body", "menuitemradio");
    expect(within(editor()).queryByRole("heading")).toBeNull();
    expect(editor()).toHaveTextContent("All computers should be orangeIt’s true.");
  });

  it("puts a chosen picture in the note and a thumbnail in the list", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("This is a note in Mavericks."));
    expect(row("This is a note in Mavericks.").querySelector("img")).toBeNull();
    await user.click(button("Media"));
    await screen.findByRole("menuitem", { name: "Photos…" });
    await user.keyboard("{Escape}");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "harbour.png", {
      type: "image/png",
    });
    await user.upload(screen.getByLabelText("Choose a photo"), file);
    const picture = await within(editor()).findByRole("img", { name: "harbour.png" });
    expect(picture.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(row("This is a note in Mavericks.").querySelector("img")).toHaveAttribute(
      "src",
      picture.getAttribute("src"),
    );

    // Text added afterwards goes before the picture, and a second picture after it.
    await user.click(button("Add Table"));
    await user.upload(
      screen.getByLabelText("Choose a photo"),
      new File([new Uint8Array([137, 80, 78, 71])], "quay.png", { type: "image/png" }),
    );
    await within(editor()).findByRole("img", { name: "quay.png" });
    expect(
      [...editor().children].map((block) => block.querySelector("img")?.alt ?? block.tagName),
    ).toEqual(["DIV", "DIV", "TABLE", "harbour.png", "DIV", "quay.png", "DIV"]);
  });

  it("keeps what a note holds while the gallery is shown", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("This is a note in Mavericks."));
    await user.click(button("Add Table"));
    await user.upload(
      screen.getByLabelText("Choose a photo"),
      new File([new Uint8Array([137, 80, 78, 71])], "harbour.png", { type: "image/png" }),
    );
    await within(editor()).findByRole("img", { name: "harbour.png" });
    await user.click(button("Gallery View"));
    await user.click(button("List View"));
    expect(within(editor()).getByRole("img", { name: "harbour.png" })).toBeInTheDocument();
    expect(within(editor()).getAllByRole("cell")).toHaveLength(4);
  });

  it("gives a new note an id that no note given at first has", async () => {
    const user = userEvent.setup();
    const taken = { ...(defaultNotes[1] as (typeof defaultNotes)[number]), id: "new-note-1" };
    render(<Notes defaultNotes={[taken]} />);
    await user.click(button("New Note"));
    write("Second");
    expect(titles()).toEqual(["Second", "All computers should be orange"]);
    expect(selected()).toEqual(["Second"]);
    await user.click(row("All computers should be orange"));
    expect(editor()).toHaveTextContent("All computers should be orangeIt’s true.");
  });

  it("says in a popover why a note cannot be shared without an account", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(button("Add People"));
    expect(await screen.findByRole("dialog", { name: "Add People" })).toHaveTextContent(
      "Sharing a note needs a signed-in account on this desktop.",
    );
  });
});

describe("folders", () => {
  it("adds a folder, shows its notes and counts them", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(button("New Folder"));
    // A new folder's name is being edited; Return ends that.
    expect(screen.getByRole("textbox", { name: "Folder name" })).toHaveValue("New Folder");
    await user.keyboard("{Enter}");
    expect(folders()).toEqual(["Notes5", "New Folder0"]);
    expect(folder("New Folder")).toHaveAttribute("aria-selected", "true");
    expect(rows()).toHaveLength(0);
    await user.click(button("New Note"));
    write("Packing list");
    expect(folders()).toEqual(["Notes5", "New Folder1"]);
    await user.click(folder("Notes"));
    expect(titles()).toHaveLength(5);
    expect(titles()).not.toContain("Packing list");
    await user.click(folder("New Folder"));
    expect(titles()).toEqual(["Packing list"]);
    await user.click(button("New Folder"));
    await user.keyboard("{Enter}");
    expect(folders()).toEqual(["Notes5", "New Folder1", "New Folder 20"]);
  });

  it("deletes the folder last used, its notes kept in Recently Deleted, but never the first folder", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(folder("Notes"));
    expect(unavailable("Delete")).toBe(true);
    await user.click(button("New Folder"));
    await user.click(button("New Note"));
    await user.click(folder("New Folder"));
    expect(unavailable("Delete")).toBe(false);
    await user.click(button("Delete"));
    expect(folders()).toEqual(["Notes5", "Recently Deleted1"]);
    expect(folder("Notes")).toHaveAttribute("aria-selected", "true");
    expect(titles()).toHaveLength(5);
  });

  it("deletes the note, not its folder, once the note is being edited", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(button("New Folder"));
    await user.click(button("New Note"));
    write("Packing list");
    await user.click(folder("New Folder"));
    await user.click(editor());
    await user.click(button("Delete"));
    expect(folders()).toEqual(["Notes5", "New Folder0", "Recently Deleted1"]);
    expect(rows()).toHaveLength(0);
  });

  it("recovers a deleted note to its folder, and deletes one for good only once confirmed", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("All computers should be orange"));
    await user.click(button("Delete"));
    await user.click(folder("Recently Deleted"));
    expect(titles()).toEqual(["All computers should be orange"]);
    expect(editor()).toHaveAttribute("contenteditable", "false");
    await user.click(screen.getByRole("button", { name: "Recover" }));
    expect(folders()).toEqual(["Notes5"]);
    expect(titles()).toContain("All computers should be orange");

    await user.click(row("All computers should be orange"));
    await user.click(button("Delete"));
    await user.click(folder("Recently Deleted"));
    await user.click(row("All computers should be orange"));
    await user.keyboard("{Backspace}");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Delete this note immediately?");
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    expect(folders()).toEqual(["Notes4"]);
  });

  it("deletes a live note found by a search over Recently Deleted to Recently Deleted", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("All computers should be orange"));
    await user.click(button("Delete"));
    await user.click(folder("Recently Deleted"));
    await user.type(screen.getByRole("searchbox"), "Yosemite");
    expect(titles()).toEqual(["This is a note in Yosemite"]);
    await user.click(row("This is a note in Yosemite"));
    await user.keyboard("{Backspace}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(folders()).toEqual(["Notes3", "Recently Deleted2"]);
  });

  it("pins several notes selected with Command, above the rest, under their headings", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(row("This is a note in Yosemite"));
    await user.keyboard("{Meta>}");
    await user.click(row("This is a note in Mavericks."));
    await user.keyboard("{/Meta}");
    expect(selected()).toEqual(["This is a note in Yosemite", "This is a note in Mavericks."]);
    expect(screen.getByText("2 Notes Selected")).toBeInTheDocument();
    fireEvent.contextMenu(row("This is a note in Mavericks."));
    await user.click(await screen.findByRole("menuitem", { name: "Pin Note" }));
    expect(titles().slice(0, 2)).toEqual([
      "This is a note in Yosemite",
      "This is a note in Mavericks.",
    ]);
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  it("hides and shows the folder list", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(button("Hide Folders"));
    expect(screen.queryByRole("tree", { name: "Folders" })).toBeNull();
    expect(rows()).toHaveLength(5);
    await user.click(button("Show Folders"));
    expect(folders()).toEqual(["Notes5"]);
  });
});

describe("search and views", () => {
  it("lists the notes whose text has the search text, in any folder", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(button("New Folder"));
    await user.click(button("New Note"));
    write("An orange crate");
    await user.type(search(), "ORANGE");
    expect(titles()).toEqual(["An orange crate", "All computers should be orange"]);
    await user.clear(search());
    await user.type(search(), "kinda nice");
    expect(titles()).toEqual(["This is a note in Yosemite"]);
    expect(editor()).toHaveTextContent("It’s kinda nice in here.");
    await user.clear(search());
    await user.type(search(), "zeppelin");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
    await user.clear(search());
    expect(titles()).toEqual(["An orange crate"]);
  });

  it("ends a search when a note is added", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.type(search(), "orange");
    await user.click(button("New Note"));
    expect(search()).toHaveValue("");
    expect(titles()).toHaveLength(6);
  });

  it("replaces the note list with the Attachments Browser while that button is pressed", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    await user.click(button("Attachments Browser"));
    expect(button("Attachments Browser")).toHaveAttribute("aria-pressed", "true");
    const grid = screen.getByRole("listbox", { name: "Photos & Videos" });
    expect(within(grid).getAllByRole("option")).toHaveLength(2);
    await user.click(button("Attachments Browser"));
    expect(titles()).toHaveLength(5);
  });

  it("shows the notes as cards in gallery view and opens one in list view", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    const views = within(screen.getByRole("group", { name: "View" }));
    expect(views.getByRole("button", { name: "List View" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(views.getByRole("button", { name: "Gallery View" }));
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
    const cards = within(screen.getByRole("listbox", { name: "Notes" })).getAllByRole("option");
    expect(cards).toHaveLength(5);
    await user.dblClick(cards[3] as HTMLElement);
    expect(views.getByRole("button", { name: "List View" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(selected()).toEqual(["This is a note in Yosemite"]);
    expect(editor()).toHaveTextContent("This is a note in YosemiteIt’s kinda nice in here.");
  });
});

describe("the notes' text", () => {
  const note = (lines: string[], attachment?: "photo") => ({
    id: "n",
    folder: DEFAULT_FOLDER,
    lines,
    date: "",
    edited: "",
    attachment,
  });

  it("takes the title from the first line with text and the snippet from the next", () => {
    expect(summarize(note(["", " Title ", "", "Second", "Third"]))).toEqual({
      title: "Title",
      snippet: "Second",
    });
    expect(summarize(note([]))).toEqual({ title: "New Note", snippet: "No additional text" });
    expect(summarize(note(["Harbour"], "photo"))).toEqual({ title: "Harbour", snippet: "1 photo" });
  });

  it("cuts a long first line at a word and opens the snippet with the rest", () => {
    expect(summarize(defaultNotes[0] as (typeof defaultNotes)[number])).toEqual({
      title: "Catalina Notes is just about the same as before, but adds a Gallery",
      snippet: "View.",
    });
  });

  it("matches the search text in any line, whatever the case", () => {
    expect(matches(note(["One", "Two words"]), " two W ")).toBe(true);
    expect(matches(note(["One", "Two words"]), "three")).toBe(false);
  });

  it("writes a note's dates as Notes does", () => {
    expect(stamp(new Date(2019, 9, 3, 15, 55))).toEqual({
      date: "3:55 PM",
      edited: "October 3, 2019 at 3:55 PM",
    });
  });

  it("reads the lines of content in the shapes a browser leaves it in", () => {
    const root = document.createElement("div");
    root.innerHTML =
      "Bare first line<div>In a div</div><div><br></div><h2>Heading</h2>" +
      "<div>Soft<br>break&nbsp;here</div>" +
      '<div data-attachment=""><img alt="not text"></div>' +
      "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>";
    expect(readLines(root)).toEqual([
      "Bare first line",
      "In a div",
      "",
      "Heading",
      "Soft",
      "break here",
      "a",
      "b",
    ]);
  });
});

describe("styling the text", () => {
  // Base UI blocks the pointer on the way from a submenu's item to its submenu (its safe
  // triangle); user-event would refuse the click that follows a hover.
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
  /** Show the note "All computers should be orange", whose second line is "It’s true." */
  const showOrange = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(row("All computers should be orange"));
    // The note's stylesheet sets the system font; jsdom loads no stylesheet.
    editor().style.fontFamily = "-apple-system, sans-serif";
  };
  /**
   * Choose `item` of the format button's submenu `submenu` (`chooseIn`), and wait for the menu to
   * close. Every round trip renders the window again a few times: a test makes a handful, so that
   * a busy machine keeps it well inside its time.
   */
  const fromFormatButton = async (
    user: ReturnType<typeof userEvent.setup>,
    submenu: string,
    item: string,
    role = "menuitem",
    via: "keyboard" | "pointer" = "keyboard",
  ) => {
    await user.click(button("Format"));
    await chooseIn(user, submenu, item, role, via);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  };

  it("runs the Font and Text commands on the selection from their key equivalents", async () => {
    const user = setup();
    render(<Notes />);
    await showOrange(user);
    const commands = recordCommands();
    await select("true");
    // Command is the Control key off Apple platforms, which is what jsdom reports.
    const keys = ["b", "i", "u", "=", "-", "{", "|", "}"];
    for (const key of keys) {
      // Replaced: the browser's own Command-B must not toggle the style a second time.
      expect(fireEvent.keyDown(editor(), { key, ctrlKey: true })).toBe(false);
    }
    expect(commands).toEqual([
      ["bold", undefined, true],
      ["italic", undefined, true],
      ["underline", undefined, true],
      ["fontSize", "7", true],
      ["fontSize", "7", true],
      ["justifyLeft", undefined, true],
      ["justifyCenter", undefined, true],
      ["justifyRight", undefined, true],
    ]);
    expect(editor()).toHaveFocus();
    // Other keys are the editor's own.
    expect(fireEvent.keyDown(editor(), { key: "b" })).toBe(true);
    expect(fireEvent.keyDown(editor(), { key: "b", altKey: true, ctrlKey: true })).toBe(true);
    expect(commands).toHaveLength(keys.length);

    // Command-T and Shift-Command-C open the panels; the note keeps the keyboard.
    fireEvent.keyDown(editor(), { key: "t", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Fonts" })).toBeInTheDocument();
    fireEvent.keyDown(editor(), { key: "C", ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    expect(editor()).toHaveFocus();
  });

  it("has no text to style in a locked note", () => {
    render(<Notes defaultNotes={lockedNotes} />);
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
    expect(unavailable("Format")).toBe(true);
  });

  it("runs the Font submenu's styles from the format button, the selection back in the note", async () => {
    const user = setup();
    render(<Notes />);
    await showOrange(user);
    const commands = recordCommands();
    await select("true");
    // The pointer opens the first submenu, the keyboard the others (`chooseIn`).
    await fromFormatButton(user, "Font", "Bold", "menuitemcheckbox", "pointer");
    expect(commands).toEqual([["bold", undefined, true]]);
    // The menu gives the keyboard back to the note, not to its button.
    expect(editor()).toHaveFocus();

    for (const [item, command] of [
      ["Italic", "italic"],
      ["Underline", "underline"],
      ["Strikethrough", "strikeThrough"],
    ] as const) {
      await fromFormatButton(user, "Font", item, "menuitemcheckbox");
      expect(commands.at(-1)).toEqual([command, undefined, true]);
    }
    expect(commands).toHaveLength(4);
    await waitFor(() => expect(editor()).toHaveFocus());
  });

  it("runs the Font submenu's sizes and the Text submenu's alignments from the format button", async () => {
    const user = setup();
    render(<Notes />);
    await showOrange(user);
    const commands = recordCommands();
    await select("true");
    for (const [submenu, item, role, command] of [
      ["Font", "Bigger", "menuitem", "fontSize"],
      ["Font", "Smaller", "menuitem", "fontSize"],
      ["Text", "Align Left", "menuitemradio", "justifyLeft"],
      ["Text", "Center", "menuitemradio", "justifyCenter"],
      ["Text", "Justify", "menuitemradio", "justifyFull"],
      ["Text", "Align Right", "menuitemradio", "justifyRight"],
    ] as const) {
      await fromFormatButton(user, submenu, item, role);
      expect(commands.at(-1)?.[0]).toBe(command);
      expect(commands.at(-1)?.[2]).toBe(true);
    }
    expect(commands).toHaveLength(6);
    await waitFor(() => expect(editor()).toHaveFocus());
  });

  it("shows the Fonts and Colors panels from the format button's Font submenu, the note keeping the keyboard", async () => {
    const user = setup();
    render(<Notes />);
    await showOrange(user);
    await select("true");
    await fromFormatButton(user, "Font", "Show Fonts");
    expect(await screen.findByRole("dialog", { name: "Fonts" })).toBeInTheDocument();
    await fromFormatButton(user, "Font", "Show Colors");
    expect(await screen.findByRole("dialog", { name: "Colors" })).toBeInTheDocument();
    await waitFor(() => expect(editor()).toHaveFocus());
  });

  it("runs them from the menu bar's Format menu", async () => {
    const user = setup();
    render(<WithMenuBar />);
    await showOrange(user);
    const commands = recordCommands();
    await select("true");
    await user.click(menuBarMenu("Format"));
    await chooseIn(user, "Font", "Italic", "menuitemcheckbox");
    expect(commands).toEqual([["italic", undefined, true]]);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(editor()).toHaveFocus();

    await user.click(menuBarMenu("Format"));
    await chooseIn(user, "Text", "Justify", "menuitemradio");
    expect(commands.at(-1)).toEqual(["justifyFull", undefined, true]);

    await user.click(menuBarMenu("Format"));
    await user.click(await screen.findByRole("menuitemradio", { name: "Heading" }));
    expect(within(editor()).getByRole("heading", { name: "It’s true." }).tagName).toBe("H2");

    await user.click(menuBarMenu("Format"));
    await chooseIn(user, "Font", "Show Fonts");
    expect(await screen.findByRole("dialog", { name: "Fonts" })).toBeInTheDocument();

    // File > New Note.
    await user.click(menuBarMenu("File"));
    await user.click(await screen.findByRole("menuitem", { name: "New Note" }));
    expect(titles()).toHaveLength(6);
    expect(selected()).toEqual(["New Note"]);
  });

  it("gives File > New Note's new note the keyboard once the menu has closed", async () => {
    const user = setup();
    render(<WithMenuBar />);
    await showOrange(user);
    await select("true");
    await user.click(menuBarMenu("File"));
    await user.click(await screen.findByRole("menuitem", { name: "New Note" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(selected()).toEqual(["New Note"]);
    // The new note's editor, not the menu's title or the note shown before, takes what is typed.
    await waitFor(() => expect(editor()).toHaveFocus());
    expect(editor().textContent).toBe("");
    await settle();
    expect(editor()).toHaveFocus();
    expect(menuBarMenu("File")).not.toHaveFocus();
  });

  it("dims the Format commands for a locked note", async () => {
    const user = setup();
    render(<WithMenuBar notes={lockedNotes} />);
    await user.click(menuBarMenu("Format"));
    expect(await screen.findByRole("menuitemradio", { name: "Title" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.hover(screen.getByRole("menuitem", { name: "Font" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "Bold" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // The panels can still be shown.
    expect(screen.getByRole("menuitem", { name: "Show Fonts" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("applies what the Fonts panel changes to the selection, and closes it", async () => {
    const user = setup();
    render(<Notes />);
    await showOrange(user);
    const commands = recordCommands();
    await select("true");
    fireEvent.keyDown(editor(), { key: "t", ctrlKey: true });
    const panel = await screen.findByRole("dialog", { name: "Fonts" });
    const option = (list: string, name: string) =>
      within(within(panel).getByRole("listbox", { name: list })).getByRole("option", { name });
    fireEvent.mouseDown(option("Family", "Georgia"));
    expect(commands).toEqual([["fontName", "Georgia, serif", true]]);
    fireEvent.mouseDown(option("Size", "24"));
    expect(commands.at(-1)).toEqual(["fontSize", "7", true]);
    fireEvent.mouseDown(option("Typeface", "Bold"));
    expect(commands.at(-1)).toEqual(["bold", undefined, true]);
    // The note's own family is the system font, which is applied as the note sets it.
    fireEvent.mouseDown(option("Family", "System Font"));
    expect(commands.at(-1)).toEqual(["fontName", "-apple-system, sans-serif", true]);

    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Fonts" })).toBeNull();
    expect(editor()).toHaveFocus();
  });

  it("applies the colour chosen in the Colors panel to the selection", async () => {
    const user = setup();
    render(<Notes />);
    await showOrange(user);
    const commands = recordCommands();
    await select("true");
    fireEvent.keyDown(editor(), { key: "C", ctrlKey: true, shiftKey: true });
    const panel = await screen.findByRole("dialog", { name: "Colors" });
    await user.click(within(panel).getByRole("tab", { name: "Color Palettes" }));
    const red = within(panel).getByRole("radio", { name: "Red" });
    await user.click(red);
    const [command, value, inNote] = commands.at(-1) ?? [];
    expect(command).toBe("foreColor");
    expect(value).toMatch(/^#[0-9a-f]{6}$/);
    expect(inNote).toBe(true);
    // The panel keeps the keyboard, for the next colour.
    expect(red).toHaveFocus();
  });

  it("checks the styles where the insertion point is, and the Fonts panel follows it", async () => {
    const user = setup();
    render(<Notes />);
    await showOrange(user);
    // Text as the browser leaves it once a word is bold and a line is centred.
    const line = within(editor()).getByText("It’s true.");
    line.innerHTML = "It’s <b>true</b>.";
    line.style.textAlign = "center";
    await select("true", 1);

    await user.click(button("Format"));
    expect(await screen.findByRole("menuitemradio", { name: "Body" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Title" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await user.hover(screen.getByRole("menuitem", { name: "Font" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "Bold" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemcheckbox", { name: "Italic" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await user.hover(screen.getByRole("menuitem", { name: "Text" }));
    expect(await screen.findByRole("menuitemradio", { name: "Center" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.keyboard("{Escape}{Escape}{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    fireEvent.keyDown(editor(), { key: "t", ctrlKey: true });
    const panel = await screen.findByRole("dialog", { name: "Fonts" });
    const chosen = (list: string) =>
      within(within(panel).getByRole("listbox", { name: list }))
        .getAllByRole("option")
        .filter((option) => option.getAttribute("aria-selected") === "true")
        .map((option) => option.textContent);
    expect(chosen("Family")).toEqual(["System Font"]);
    expect(chosen("Typeface")).toEqual(["Bold"]);

    // The insertion point moved into the title: the first line, in plain text.
    await select("orange", 2);
    expect(chosen("Typeface")).toEqual(["Regular"]);
    await user.click(button("Format"));
    expect(await screen.findByRole("menuitemradio", { name: "Title" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("makes the first line body text, which it is not by itself, and checks Body there", async () => {
    const user = setup();
    render(<Notes />);
    await showOrange(user);
    const checked = async () => {
      await user.click(button("Format"));
      await screen.findByRole("menuitemradio", { name: "Body" });
      const names = screen
        .getAllByRole("menuitemradio")
        .filter((item) => item.getAttribute("aria-checked") === "true")
        .map((item) => item.textContent?.replace(/[⇧⌘⌥⌃].*$/, ""));
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
      return names;
    };
    const first = () => editor().firstElementChild as HTMLElement;

    // The first line is the title until Body is chosen for it.
    await select("orange", 2);
    expect(await checked()).toEqual(["Title"]);
    await choose(user, "Format", "Body", "menuitemradio");
    expect(first().tagName).toBe("DIV");
    expect(first().getAttribute("data-paragraph")).toBe("body");
    expect(first().textContent).toBe("All computers should be orange");
    expect(await checked()).toEqual(["Body"]);
    // The second line stays body text, unmarked.
    expect(editor().children[1]?.hasAttribute("data-paragraph")).toBe(false);

    // Title again: the mark goes with the body text.
    await select("orange", 2);
    await choose(user, "Format", "Title", "menuitemradio");
    expect(first().tagName).toBe("H1");
    expect(first().hasAttribute("data-paragraph")).toBe(false);
    expect(await checked()).toEqual(["Title"]);
    await select("orange", 2);
    await choose(user, "Format", "Body", "menuitemradio");
    expect(first().tagName).toBe("DIV");
    expect(first().getAttribute("data-paragraph")).toBe("body");
    expect(await checked()).toEqual(["Body"]);

    // A first line the browser left as bare text is wrapped and marked too.
    editor().replaceChildren("Bare title", document.createElement("div"));
    editor().lastElementChild?.append("Second");
    await select("Bare", 1);
    expect(await checked()).toEqual(["Title"]);
    await select("Bare", 1);
    await choose(user, "Format", "Body", "menuitemradio");
    expect(editor().innerHTML).toBe('<div data-paragraph="body">Bare title</div><div>Second</div>');
    expect(await checked()).toEqual(["Body"]);
  });
});

describe("the notes' saved formats", () => {
  const markup =
    '<div><span style="font-weight: bold;">Bold</span> text</div><h2>Heading</h2>' +
    "<div>\u25CB Milk</div>" +
    '<table class="mac-notes-table"><tbody><tr><td>a</td></tr></tbody></table>';

  it("are the text's formats without its pictures, rebuilt from what formatting writes", () => {
    const root = document.createElement("div");
    root.innerHTML =
      markup +
      '<div class="mac-notes-attachment" data-attachment="" contenteditable="false">' +
      '<img alt="harbour" src="data:image/png;base64,AAAA"></div>' +
      '<div onclick="alert(1)" style="color: red; background-image: url(x)">Hi' +
      '<script>alert(1)</script><img src="x" onerror="alert(1)">' +
      '<a href="javascript:alert(1)">there</a><table class="other"><tbody><tr><td>b</td></tr></tbody></table></div>';
    const html = noteHtml(root) ?? "";
    expect(html.startsWith(markup)).toBe(true);
    const kept = document.createElement("div");
    kept.innerHTML = html;
    expect(kept.querySelector("img, script, a, [onclick], [data-attachment]")).toBeNull();
    expect(kept.querySelector("[style*=url]")).toBeNull();
    expect(kept.lastElementChild?.getAttribute("style")).toBe("color: red;");
    expect(kept.lastElementChild?.textContent).toBe("Hithereb");
    // Only the tables Add Table makes keep their class.
    expect(kept.querySelectorAll(".mac-notes-table")).toHaveLength(1);
    expect(kept.querySelectorAll("table")).toHaveLength(2);
  });

  it("are left out for plain lines, which the lines keep", () => {
    const root = document.createElement("div");
    root.innerHTML =
      'Bare first line<div>Second</div><div><br></div><div data-attachment=""><img alt="x"></div>';
    expect(noteHtml(root)).toBeUndefined();
  });

  it("open a note as saved, or its lines when they hold no text", () => {
    const holder = document.createElement("div");
    holder.append(noteContent({ lines: ["Bold text"], html: markup }, document));
    expect(holder.innerHTML).toBe(markup);
    holder.replaceChildren(
      noteContent({ lines: ["Kept", ""], html: "<script>alert(1)</script>" }, document),
    );
    expect(holder.innerHTML).toBe("<div>Kept</div><div><br></div>");
  });

  it("keep the mark of a first line made body text, with its one value only", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-paragraph="body">Groceries</div><div>Milk</div>';
    expect(noteHtml(root)).toBe('<div data-paragraph="body">Groceries</div><div>Milk</div>');
    const holder = document.createElement("div");
    for (const value of ["title", "Body", "body ", "", "body;x"]) {
      holder.replaceChildren(
        noteContent(
          { lines: ["Groceries"], html: `<div data-paragraph="${value}">Groceries</div>` },
          document,
        ),
      );
      expect(holder.innerHTML).toBe("<div>Groceries</div>");
    }
  });
});

describe("on the Ferrite application", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("starts from the session's saved notes and saves every change", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const puts: { data: { notes: { id: string; lines: string[] }[] } }[] = [];
    const saved = {
      folders: [{ id: DEFAULT_FOLDER, name: "Notes" }],
      notes: [
        {
          id: "pancakes",
          folder: DEFAULT_FOLDER,
          lines: ["Pancakes", "Two eggs"],
          date: "8:00 AM",
          edited: "October 12, 2026 at 8:00 AM",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toBe("/api/notes/data");
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return new Response('{"rev":2}', { status: 200 });
        }
        return new Response(JSON.stringify({ data: saved, rev: 1 }), { status: 200 });
      }),
    );
    const user = userEvent.setup();
    render(<Notes />);
    await waitFor(() => expect(titles()).toEqual(["Pancakes"]));
    expect(puts).toHaveLength(0);

    await user.click(button("New Note"));
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]?.data.notes.map((note) => note.id)).toEqual([
      expect.stringMatching(/^new-note-[0-9a-z]+-\d+-1$/),
      "pancakes",
    ]);
  });

  it("writes nothing when the session's notes could not be read", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const { Notes: Fresh } = await import("./notes");
    const user = userEvent.setup();
    render(<Fresh />);
    // The read is tried three times before the sample notes are shown.
    await user.click(await screen.findByRole("button", { name: "New Note" }, { timeout: 5000 }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    const inits = fetch.mock.calls.map((call) => (call as unknown[])[1] as RequestInit | undefined);
    expect(inits.some((init) => init?.method === "PUT")).toBe(false);
  });

  it("takes a malformed document for no read, asks again, and writes nothing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    // Arrays of the right names, but a note that is not one and a revision that is not whole.
    const bodies = [
      { data: { folders: [{ id: DEFAULT_FOLDER, name: "Notes" }], notes: [null] }, rev: 1 },
      { data: { folders: [{ id: DEFAULT_FOLDER, name: "Notes" }], notes: [] }, rev: 1.5 },
      {
        data: {
          folders: [{ id: DEFAULT_FOLDER, name: "Notes" }],
          notes: [{ id: "a", folder: "gone", lines: [], date: "", edited: "" }],
        },
        rev: 1,
      },
    ];
    const fetch = vi.fn(async (url: string, init?: RequestInit) =>
      url.endsWith("/shared")
        ? new Response('{"notes":[],"can_share":false,"me":null}', { status: 200 })
        : init?.method === "PUT"
          ? new Response('{"rev":2}', { status: 200 })
          : new Response(JSON.stringify(bodies.shift()), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);
    const { Notes: Fresh } = await import("./notes");
    const user = userEvent.setup();
    render(<Fresh />);
    await user.click(await screen.findByRole("button", { name: "New Note" }, { timeout: 5000 }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    const calls = fetch.mock.calls.filter(([url]) => !url.endsWith("/shared"));
    const inits = calls.map((call) => call[1]);
    expect(inits.filter((init) => init?.method === undefined)).toHaveLength(3);
    expect(inits.some((init) => init?.method === "PUT")).toBe(false);
  });

  it("shows unsaved changes when the application refuses the notes", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let refuse = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          return refuse
            ? new Response('{"error":"too long"}', { status: 400 })
            : new Response('{"rev":2}', { status: 200 });
        }
        return new Response(JSON.stringify({ data: null, rev: 0 }), { status: 200 });
      }),
    );
    const { Notes: Fresh } = await import("./notes");
    const user = userEvent.setup();
    render(<Fresh />);
    const close = () =>
      within(screen.getByRole("region", { name: "Notes" })).getByRole("button", { name: "Close" });
    await user.click(await screen.findByRole("button", { name: "New Note" }));
    await vi.waitFor(() => expect(close()).toHaveAttribute("data-edited"), { timeout: 2000 });

    refuse = false;
    await user.click(button("New Note"));
    await vi.waitFor(() => expect(close()).not.toHaveAttribute("data-edited"), { timeout: 2000 });
  });

  it("sends a write that met a network error once more, as the same body on the same revision", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const bodies: string[] = [];
    let fail = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          bodies.push(String(init.body));
          if (fail) {
            fail = false;
            throw new TypeError("network");
          }
          return new Response('{"rev":1}', { status: 200 });
        }
        return new Response(JSON.stringify({ data: null, rev: 0 }), { status: 200 });
      }),
    );
    const { Notes: Fresh } = await import("./notes");
    const user = userEvent.setup();
    render(<Fresh />);
    const close = () =>
      within(screen.getByRole("region", { name: "Notes" })).getByRole("button", { name: "Close" });
    await user.click(await screen.findByRole("button", { name: "New Note" }));
    await vi.waitFor(() => expect(bodies).toHaveLength(2), { timeout: 4000 });
    // The retry is the first body unchanged: no revision is made up for it.
    expect(bodies[1]).toBe(bodies[0]);
    expect(JSON.parse(bodies[0] ?? "{}").base).toBe(0);
    await vi.waitFor(() => expect(close()).not.toHaveAttribute("data-edited"));
  });

  it("returns to the starting notes when a first save fails and nothing is stored", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "PUT"
          ? new Response("unavailable", { status: 503 })
          : new Response(JSON.stringify({ data: null, rev: 0 }), { status: 200 }),
      ),
    );
    const { Notes: Fresh } = await import("./notes");
    const user = userEvent.setup();
    render(<Fresh />);
    await user.click(await screen.findByRole("button", { name: "New Note" }));
    const before = defaultNotes.length;
    expect(rows()).toHaveLength(before + 1);
    // The save's outcome is not known: the stored notes (none) are read, and the edit goes.
    await waitFor(() => expect(rows()).toHaveLength(before), { timeout: 3000 });
    // Showing the starting notes again is no edit: nothing more is sent.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const sent = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(sent).toHaveLength(1);
  });

  it("merges a change that meets another window's newer notes onto them, and saves the merge", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    type Saved = { folders: unknown[]; notes: { id: string }[] };
    // A server that keeps a revision and stores a write only on the revision it has.
    let server: { data: Saved | null; rev: number } = { data: null, rev: 0 };
    const theirs: Saved = {
      folders: [{ id: DEFAULT_FOLDER, name: "Notes" }],
      notes: [
        {
          id: "theirs",
          folder: DEFAULT_FOLDER,
          lines: ["From the other window"],
          date: "8:00 AM",
          edited: "October 12, 2026 at 8:00 AM",
        } as { id: string },
      ],
    };
    const puts: { base: number; data: Saved }[] = [];
    const stored: Saved[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          puts.push(body);
          // Another window saves just before this page's first write arrives.
          if (puts.length === 1) server = { data: theirs, rev: 1 };
          if (body.base !== server.rev) {
            return new Response(JSON.stringify({ error: "changed", rev: server.rev }), {
              status: 409,
            });
          }
          server = { data: body.data, rev: server.rev + 1 };
          stored.push(body.data);
          return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
    const { Notes: Fresh } = await import("./notes");
    const user = userEvent.setup();
    const view = render(<Fresh />);
    const close = () =>
      within(screen.getByRole("region", { name: "Notes" })).getByRole("button", { name: "Close" });
    await user.click(await screen.findByRole("button", { name: "New Note" }));
    // The page's change meets the other window's newer notes: it is merged onto them (the other
    // window's note and this page's notes are all kept) and saved on their revision.
    await vi.waitFor(() => expect(stored).toHaveLength(1), { timeout: 4000 });
    expect(puts).toHaveLength(2);
    expect(puts[0]?.base).toBe(0);
    expect(puts[1]?.base).toBe(1);
    const merged = stored[0]?.notes.map((note) => note.id) ?? [];
    expect(merged).toContain("theirs");
    expect(merged.some((id) => /^new-note-[0-9a-z]+-\d+-\d+$/.test(id))).toBe(true);
    expect(server.rev).toBe(2);
    await waitFor(() => expect(titles()).toContain("From the other window"));
    await waitFor(() => expect(close()).not.toHaveAttribute("data-edited"));

    // A folder made in the window is saved on the merged revision.
    await user.click(button("New Folder"));
    await vi.waitFor(() => expect(stored).toHaveLength(2), { timeout: 2000 });
    expect(puts.at(-1)?.base).toBe(2);
    expect(stored[1]?.folders).toHaveLength(2);
    expect(stored[1]?.notes.map((note) => note.id)).toEqual(merged);

    // A window opened again later starts from the stored notes too.
    view.unmount();
    render(<Fresh />);
    // It shows the folder last shown, which is kept; the stored notes are in the first.
    await user.click(folder("Notes"));
    expect(titles()).toContain("From the other window");

    // The next change is saved on the stored revision, on top of the stored notes.
    await user.click(button("New Note"));
    await vi.waitFor(() => expect(stored).toHaveLength(3), { timeout: 2000 });
    expect(puts.at(-1)?.base).toBe(3);
    const ids = stored[2]?.notes.map((note) => note.id) ?? [];
    expect(ids).toHaveLength(merged.length + 1);
    expect(ids).toContain("theirs");
  });

  it("saves nothing on opening, even when React runs its effects twice", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Response('{"rev":1}', { status: 200 })
        : new Response(JSON.stringify({ data: null, rev: 0 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);
    const { Notes: Fresh } = await import("./notes");
    render(
      <StrictMode>
        <Fresh />
      </StrictMode>,
    );
    await screen.findByRole("button", { name: "New Note" });
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  it("saves a note's formats and opens it with them, rebuilt; a note saved before formats opens from its lines", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    type Note = { id: string; lines: string[]; html?: string };
    const saved = {
      folders: [{ id: DEFAULT_FOLDER, name: "Notes" }],
      notes: [
        {
          id: "styled",
          folder: DEFAULT_FOLDER,
          lines: ["Pancakes", "Two eggs", "a"],
          html:
            '<div><b>Pancakes</b></div><div><span style="font-weight: bold;">Two</span> eggs' +
            '<img src="x" onerror="alert(1)"><script>alert(2)</script></div>' +
            '<table class="mac-notes-table" onclick="alert(3)"><tbody><tr><td>a</td></tr></tbody></table>',
          date: "8:00 AM",
          edited: "October 12, 2026 at 8:00 AM",
        },
        {
          id: "old",
          folder: DEFAULT_FOLDER,
          lines: ["Saved before formats", "Plain"],
          date: "7:00 AM",
          edited: "October 12, 2026 at 7:00 AM",
        },
      ],
    };
    const puts: { data: { notes: Note[] } }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts.push(JSON.parse(String(init.body)));
          return new Response(JSON.stringify({ rev: puts.length + 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: saved, rev: 1 }), { status: 200 });
      }),
    );
    const { Notes: Fresh } = await import("./notes");
    const user = userEvent.setup();
    render(<Fresh />);
    await waitFor(() => expect(titles()).toEqual(["Pancakes", "Saved before formats"]));

    // The stored formats are shown, and nothing that runs or loads.
    expect(editor().querySelector("b")?.textContent).toBe("Pancakes");
    expect(editor().querySelector('span[style*="bold"]')?.textContent).toBe("Two");
    expect(editor().querySelector("table.mac-notes-table td")?.textContent).toBe("a");
    expect(editor().querySelector("img, script, [onclick], [onerror]")).toBeNull();
    expect(readLines(editor())).toEqual(["Pancakes", "Two eggs", "a"]);

    await user.click(row("Saved before formats"));
    expect(readLines(editor())).toEqual(["Saved before formats", "Plain"]);
    expect(editor().querySelector("b, span")).toBeNull();

    // An edit of the formatted note sends its formats; the plain note sends none.
    await user.click(row("Pancakes"));
    const eggs = editor().querySelector("span")?.nextSibling;
    if (!eggs) throw new Error("no text after the bold word");
    eggs.nodeValue = " eggs and milk";
    fireEvent.input(editor());
    await vi.waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    const sent = puts[0]?.data.notes ?? [];
    const styled = sent.find((note) => note.id === "styled");
    expect(styled?.lines).toEqual(["Pancakes", "Two eggs and milk", "a"]);
    expect(styled?.html).toBe(
      '<div><b>Pancakes</b></div><div><span style="font-weight: bold;">Two</span> eggs and milk</div>' +
        '<table class="mac-notes-table"><tbody><tr><td>a</td></tr></tbody></table>',
    );
    expect(sent.find((note) => note.id === "old")).not.toHaveProperty("html");

    // Formats past the application's limit are left in the page: the note is saved as its lines.
    const long = "x".repeat(MAX_HTML);
    editor().innerHTML = `<div><b>${long}</b></div>`;
    fireEvent.input(editor());
    await vi.waitFor(() => expect(puts).toHaveLength(2), { timeout: 2000 });
    const big = puts[1]?.data.notes.find((note) => note.id === "styled");
    expect(big?.lines).toEqual([long]);
    expect(big).not.toHaveProperty("html");
  });

  it("saves a first line made body text, and opens it as body text again", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    type Note = { id: string; lines: string[]; html?: string };
    type Saved = { folders: unknown[]; notes: Note[] };
    let server: { data: Saved; rev: number } = {
      data: {
        folders: [{ id: DEFAULT_FOLDER, name: "Notes" }],
        notes: [
          {
            id: "pancakes",
            folder: DEFAULT_FOLDER,
            lines: ["Pancakes", "Two eggs"],
            date: "8:00 AM",
            edited: "October 12, 2026 at 8:00 AM",
          } as Note,
        ],
      },
      rev: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body));
          server = { data: body.data, rev: server.rev + 1 };
          return new Response(JSON.stringify({ rev: server.rev }), { status: 200 });
        }
        return new Response(JSON.stringify(server), { status: 200 });
      }),
    );
    const { Notes: Fresh } = await import("./notes");
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const view = render(<Fresh />);
    await waitFor(() => expect(titles()).toEqual(["Pancakes"]));

    await select("Pancakes", 3);
    await choose(user, "Format", "Body", "menuitemradio");
    await vi.waitFor(() => expect(server.rev).toBe(2), { timeout: 2000 });
    const saved = server.data.notes[0];
    expect(saved?.lines).toEqual(["Pancakes", "Two eggs"]);
    expect(saved?.html).toBe('<div data-paragraph="body">Pancakes</div><div>Two eggs</div>');

    // Opened again, the first line is body text, and the menu checks Body there.
    view.unmount();
    render(<Fresh />);
    await waitFor(() => expect(titles()).toEqual(["Pancakes"]));
    expect(editor().firstElementChild?.getAttribute("data-paragraph")).toBe("body");
    await select("Pancakes", 3);
    await user.click(button("Format"));
    expect(await screen.findByRole("menuitemradio", { name: "Body" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Title" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
