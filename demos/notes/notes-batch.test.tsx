import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, describe, expect, it } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { takeOpenUrlRequests } from "../desktop/desktop-open-url";
import { registerTextReceivers, shareText } from "../desktop/desktop-services";
import { takeSharedLinks } from "../desktop/desktop-share-link";
import { Notes } from "./notes";
import type { NotesNote } from "./notes-data";
import { directionAt, noteContent, noteHtml, setLineDirection } from "./notes-editor";

/*
 * Links, Writing Direction, the Spelling and Substitutions submenus, the table's and the attachment's
 * context menus, Import to Notes, File > Share and the gallery's Back. jsdom has no editing commands,
 * so they are recorded where one is asserted.
 */

function DesktopMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("notes", title);
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title={title}>{items ?? <MenuItem disabled>none</MenuItem>}</MenuBarMenu>
    </MenuBar>
  );
}
const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
const editor = () => {
  const shown = screen
    .getAllByRole("textbox", { name: "Note" })
    .find((each) => !each.closest("[hidden]"));
  if (!shown) throw new Error("no note shown");
  return shown;
};
const note = (id: string, fields: Partial<NotesNote>): NotesNote => ({
  id,
  folder: "notes",
  lines: [id],
  date: "3:55 PM",
  edited: "October 3, 2019 at 3:55 PM",
  ...fields,
});
const folders = [{ id: "notes", name: "Notes" }];

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
  takeOpenUrlRequests();
  takeSharedLinks("mail");
});

describe("what a note keeps of a link and a writing direction", () => {
  it("keeps a web link and a direction, and drops an address that is not a web address", () => {
    const held = document.createElement("div");
    held.append(
      noteContent(
        {
          lines: ["x"],
          html: '<div dir="rtl"><a href="https://example.com/a?b=1" target="_top">x</a></div><a href="javascript:alert(1)">y</a><div dir="sideways">z</div>',
        },
        document,
      ),
    );
    expect(held.innerHTML).toBe(
      '<div dir="rtl"><a href="https://example.com/a?b=1">x</a></div>y<div>z</div>',
    );
    const root = document.createElement("div");
    root.innerHTML = '<div><a href="https://example.com/">x</a></div>';
    expect(noteHtml(root)).toBe('<div><a href="https://example.com/">x</a></div>');
  });

  it("sets, reads and clears a direction on the lines a selection touches", () => {
    const root = document.createElement("div");
    root.innerHTML = "bare<div>one</div><ul><li>two</li><li>three</li></ul><div>four</div>";
    document.body.append(root);
    const range = document.createRange();
    range.setStart(root, 0);
    range.setEnd(root.querySelector("li") as Element, 1);
    expect(setLineDirection(root, "rtl", range)).toBe(true);
    expect(root.innerHTML).toBe(
      '<div dir="rtl">bare</div><div dir="rtl">one</div><ul><li dir="rtl">two</li><li>three</li></ul><div>four</div>',
    );
    expect(directionAt(root, root.querySelector("li"))).toBe("rtl");
    expect(directionAt(root, root.lastChild)).toBe("natural");
    const all = document.createRange();
    all.selectNodeContents(root);
    expect(setLineDirection(root, "natural", all)).toBe(true);
    expect(root.querySelector("[dir]")).toBeNull();
    root.remove();
  });
});

describe("links in a note", () => {
  it("opens a link in Safari when it is clicked", () => {
    render(
      <Notes
        defaultFolders={folders}
        defaultNotes={[
          note("linked", { html: '<div>See <a href="https://example.com/">this</a></div>' }),
        ]}
      />,
    );
    fireEvent.click(within(editor()).getByText("this"));
    expect(takeOpenUrlRequests()).toEqual([{ url: "https://example.com/", from: "notes" }]);
  });

  it("adds a link on the selected text from Edit > Add Link…", async () => {
    const user = setup();
    const commands: [string, string | undefined][] = [];
    render(
      <>
        <Notes defaultFolders={folders} defaultNotes={[note("word", {})]} />
        <DesktopMenu title="Edit" />
      </>,
    );
    const text = editor();
    const range = document.createRange();
    range.selectNodeContents(text.querySelector("div") as Element);
    text.focus();
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent(document, new Event("selectionchange"));
    document.execCommand = (name: string, _?: boolean, value?: string) => {
      commands.push([name, value]);
      return true;
    };
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Add Link/ }));
    const field = await screen.findByLabelText("Address:");
    await user.clear(field);
    await user.type(field, "https://example.com/x");
    await user.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(commands).toEqual([["createLink", "https://example.com/x"]]));
  });
});

describe("the Edit menu's tools", () => {
  it("turns the note's spell checking off and on, and shows the panels", async () => {
    const user = setup();
    render(
      <>
        <Notes defaultFolders={folders} defaultNotes={[note("word", {})]} />
        <DesktopMenu title="Edit" />
      </>,
    );
    expect(editor()).toHaveAttribute("spellcheck", "true");
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Spelling and Grammar" }));
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Check Spelling While Typing" }),
    );
    await waitFor(() => expect(editor()).toHaveAttribute("spellcheck", "false"));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Substitutions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Show Substitutions" }));
    expect(await screen.findByRole("dialog", { name: "Substitutions" })).toBeInTheDocument();
  });

  it("makes typed straight quotes curly through the browser's text command", () => {
    const commands: [string, string | undefined][] = [];
    render(<Notes defaultFolders={folders} defaultNotes={[note("word", { lines: ['"'] })]} />);
    const text = editor();
    const node = text.querySelector("div")?.firstChild as Text;
    text.focus();
    document.getSelection()?.collapse(node, 1);
    document.execCommand = (name: string, _?: boolean, value?: string) => {
      commands.push([name, value]);
      return true;
    };
    fireEvent.input(text, { inputType: "insertText", data: '"' });
    expect(commands).toEqual([["insertText", "“"]]);
  });
});

describe("the note's context menu", () => {
  const TABLE =
    '<div>Table</div><table class="mac-notes-table"><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';

  it("offers the table's commands on a cell, and adds a row there", async () => {
    const user = setup();
    render(<Notes defaultFolders={folders} defaultNotes={[note("t", { html: TABLE })]} />);
    const cell = within(editor()).getByText("b");
    editor().focus();
    fireEvent.contextMenu(cell);
    const add = await screen.findByRole("menuitem", { name: "Add Row" });
    for (const name of ["Add Column", "Delete Row", "Delete Column", "Convert to Text"]) {
      expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("menuitem", { name: "Speech" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Spelling and Grammar" })).toBeInTheDocument();
    await user.click(add);
    await waitFor(() => expect(editor().querySelectorAll("tr")).toHaveLength(2));
  });

  it("offers a picture's commands on an attachment, and shows it in Quick Look", async () => {
    const user = setup();
    render(
      <Notes
        defaultFolders={folders}
        defaultNotes={[note("p", { attachment: "photo", lines: ["Picture"] })]}
      />,
    );
    const picture = editor().querySelector("[data-attachment] img") as Element;
    fireEvent.contextMenu(picture);
    expect(await screen.findByRole("menuitem", { name: "View as Large" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Save Attachment…" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Share" })).toHaveAttribute(
      "title",
      "This browser can’t hand a picture to another app.",
    );
    expect(screen.queryByRole("menuitem", { name: "Cut" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Quick Look" }));
    const panel = await screen.findByRole("dialog", { name: "Placeholder for a photograph" });
    expect(within(panel).getByRole("img")).toHaveAttribute(
      "src",
      picture.getAttribute("src") as string,
    );
  });

  it("draws attachments small from View as Small", async () => {
    const user = setup();
    render(<Notes defaultFolders={folders} defaultNotes={[note("p", { attachment: "photo" })]} />);
    const picture = editor().querySelector("[data-attachment] img") as Element;
    fireEvent.contextMenu(picture);
    await user.click(await screen.findByRole("menuitem", { name: "View as Small" }));
    await waitFor(() =>
      expect(editor().closest("[data-attachment-view]")).toHaveAttribute(
        "data-attachment-view",
        "small",
      ),
    );
  });
});

describe("files, sharing and the gallery", () => {
  it("imports each text file as a note, and names the file it cannot take", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Notes defaultFolders={folders} defaultNotes={[note("first", {})]} />);
    await user.upload(screen.getByLabelText("Choose files to import"), [
      new File(["Groceries\nMilk"], "list.txt", { type: "text/plain" }),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "movie.mov", { type: "video/quicktime" }),
    ]);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Notes can’t take movie.mov.");
    await user.click(screen.getByRole("button", { name: "OK" }));
    const list = within(screen.getByRole("listbox", { name: "Notes" }));
    await waitFor(() => expect(list.getByRole("option", { name: /Groceries/ })).toBeTruthy());
    expect(list.getAllByRole("option")).toHaveLength(2);
  });

  it("makes a note of text from a service", async () => {
    const stop = registerTextReceivers([{ id: "notes", takesSharedText: true }]);
    render(<Notes defaultFolders={folders} defaultNotes={[note("first", {})]} />);
    await waitFor(() => expect(screen.getByRole("listbox", { name: "Notes" })).toBeTruthy());
    expect(shareText("notes", "Selected words\nmore")).toBe(true);
    const list = within(screen.getByRole("listbox", { name: "Notes" }));
    await waitFor(() => expect(list.getByRole("option", { name: /Selected words/ })).toBeTruthy());
    stop();
  });

  it("dims File > Share's link rows in a note without a web address, saying why", async () => {
    const user = setup();
    render(
      <>
        <Notes
          defaultFolders={folders}
          defaultNotes={[note("plain", { lines: ["No address here"] })]}
        />
        <DesktopMenu title="File" />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Share" }));
    expect(await screen.findByRole("menuitem", { name: "Add to Reading List" })).toHaveAttribute(
      "data-reason",
      "Add to Reading List takes a web address, and this note has none.",
    );
  });

  it("shares a note's first web address from File > Share", async () => {
    const user = setup();
    render(
      <>
        <Notes
          defaultFolders={folders}
          defaultNotes={[note("link", { lines: ["Read https://example.com/page today"] })]}
        />
        <DesktopMenu title="File" />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Share" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Mail" }));
    expect(takeSharedLinks("mail")).toEqual([
      {
        url: "https://example.com/page",
        title: "Read https://example.com/page today",
        from: "notes",
        to: "mail",
      },
    ]);
  });

  it("goes back to the gallery from a note opened there", async () => {
    const user = setup();
    render(<Notes defaultFolders={folders} defaultNotes={[note("one", {}), note("two", {})]} />);
    await user.click(screen.getByRole("button", { name: "Gallery View" }));
    expect(screen.queryByRole("button", { name: "Back to Gallery" })).toBeNull();
    fireEvent.doubleClick(await screen.findByRole("option", { name: "one" }));
    await user.click(await screen.findByRole("button", { name: "Back to Gallery" }));
    expect(await screen.findByRole("option", { name: "one" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to Gallery" })).toBeNull();
  });
});
