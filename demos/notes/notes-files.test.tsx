import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { WindowManager } from "macalicious/window-manager";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { registerTextReceivers, startServices } from "../desktop/desktop-services";
import {
  registerFileReceivers,
  shareFiles,
  takeSharedFiles,
  takeSharedLinks,
} from "../desktop/desktop-share-link";
import { takeSharedTexts } from "../reminders/reminders-shared-text";
import { Notes } from "./notes";
import { attachmentsOf, NO_SCANS } from "./notes-attachments-browser";
import type { NotesNote } from "./notes-data";
import { summarize } from "./notes-data";

/*
 * Files in a note, the Attachments Browser, Share with the note's own text, the rows a web page
 * dims, Services in the text's menu, a note's own window and the gallery's Pinned group.
 */

function DesktopMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("notes", title);
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title={title}>{items ?? <MenuItem disabled>none</MenuItem>}</MenuBarMenu>
    </MenuBar>
  );
}
const setup = () => userEvent.setup({ pointerEventsCheck: 0, applyAccept: false });
const note = (id: string, fields: Partial<NotesNote>): NotesNote => ({
  id,
  folder: "notes",
  lines: [id],
  date: "3:55 PM",
  edited: "October 3, 2019 at 3:55 PM",
  ...fields,
});
const folders = [{ id: "notes", name: "Notes" }];
const editor = () => {
  const shown = screen
    .getAllByRole("textbox", { name: "Note" })
    .find((each) => !each.closest("[hidden]"));
  if (!shown) throw new Error("no note shown");
  return shown;
};
const noteRows = () =>
  within(screen.getByRole("listbox", { name: "Notes" })).getAllByRole("option");
const REPORT = { id: "f1", name: "report.pdf", type: "application/pdf", size: 2_500 };
const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  takeSharedFiles("mail");
  takeSharedFiles("notes");
  takeSharedLinks("reminders");
});

describe("a file in a note", () => {
  it("stands in the note with its name and size, and names the note in the list", async () => {
    const user = setup();
    render(<Notes defaultFolders={folders} defaultNotes={[note("a", { lines: [""] })]} />);
    await user.upload(
      screen.getByLabelText("Choose a file"),
      new File([new Uint8Array(2_500)], "report.pdf", { type: "application/pdf" }),
    );
    await waitFor(() => expect(editor()).toHaveTextContent("report.pdf"));
    expect(editor()).toHaveTextContent("PDF");
    expect(editor()).toHaveTextContent("3 KB");
    expect(noteRows()[0]).toHaveTextContent("report.pdf");
  });

  it("takes a recording shared from Voice Memos, with a player", async () => {
    stops.push(registerFileReceivers([{ id: "notes", takesSharedFiles: true }]));
    render(<Notes defaultFolders={folders} defaultNotes={[note("a", {})]} />);
    act(() => {
      shareFiles(
        "notes",
        [
          {
            id: "memo",
            name: "Walk.m4a",
            kind: "file",
            type: "audio/mp4",
            size: 4,
            bytes: async () => new Blob([new Uint8Array(4)], { type: "audio/mp4" }),
          },
        ],
        "voice-memos",
      );
    });
    await waitFor(() => expect(editor().querySelector("audio")).not.toBeNull());
    expect(editor().querySelector("audio")).toHaveAttribute("title", "Walk.m4a");
    expect(noteRows()).toHaveLength(2);
  });

  it("refuses a file over 10 MB, by name", async () => {
    const user = setup();
    render(<Notes defaultFolders={folders} defaultNotes={[note("a", {})]} />);
    await user.upload(
      screen.getByLabelText("Choose a file"),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "huge.mov", { type: "video/quicktime" }),
    );
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("Notes can’t take huge.mov.");
    expect(alert).toHaveTextContent("A file in a note can be up to 10 MB.");
  });

  it("comes back from the saved note, in place of the stand-in picture", () => {
    render(<Notes defaultFolders={folders} defaultNotes={[note("a", { files: [REPORT] })]} />);
    const block = editor().querySelector("[data-file-id='f1']");
    expect(block).toHaveTextContent("report.pdf");
    expect(block).toHaveTextContent("3 KB");
    expect(editor().querySelector("[data-attachment]:not([data-file-id])")).toBeNull();
  });

  it("leaves the note when it is deleted from the text", () => {
    render(<Notes defaultFolders={folders} defaultNotes={[note("a", { files: [REPORT] })]} />);
    editor().querySelector("[data-file-id]")?.remove();
    fireEvent.input(editor());
    expect(noteRows()[0]).toHaveTextContent("No additional text");
  });

  it("offers Mail and Messages from its context menu", async () => {
    stops.push(registerFileReceivers([{ id: "mail", takesSharedFiles: true }]));
    const user = setup();
    render(<Notes defaultFolders={folders} defaultNotes={[note("a", { files: [REPORT] })]} />);
    fireEvent.contextMenu(editor().querySelector("[data-file-id]") as Element);
    await user.hover(await screen.findByRole("menuitem", { name: "Share" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Mail" }));
    expect(takeSharedFiles("mail")[0]?.items).toMatchObject([
      { name: "report.pdf", type: "application/pdf", size: 2_500 },
    ]);
  });
});

describe("the Attachments Browser", () => {
  const notes = [
    note("shots", { lines: ["Trip"], attachment: "photo" }),
    note("docs", { lines: ["Forms"], files: [REPORT] }),
    note("sound", {
      lines: ["Memo"],
      files: [{ id: "f2", name: "Walk.m4a", type: "audio/mp4", size: 4 }],
    }),
    note("web", {
      lines: ["See https://example.com/page and https://maps.apple.com/?q=Cupertino"],
    }),
    note("held", { lines: ["Secret https://secret.example/"], locked: true }),
    note("gone", { lines: ["Old https://old.example/"], deleted: "2026-01-01T00:00:00Z" }),
  ];

  it("sorts what the notes hold into its sections, leaving out locked and deleted notes", () => {
    const names = Object.fromEntries(
      Object.entries(attachmentsOf(notes)).map(([section, items]) => [
        section,
        items.map((item) => item.name),
      ]),
    );
    expect(names).toEqual({
      photos: ["Photograph"],
      scans: [],
      maps: ["maps.apple.com"],
      websites: ["example.com"],
      audio: ["Walk.m4a"],
      documents: ["report.pdf"],
    });
  });

  it("shows each section from its button, and a double click shows the note", async () => {
    const user = setup();
    render(<Notes defaultFolders={folders} defaultNotes={notes} />);
    await user.click(screen.getByRole("button", { name: "Attachments Browser" }));
    expect(screen.getByRole("button", { name: "Attachments Browser" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const kinds = within(screen.getByRole("group", { name: "Kind of attachment" }));
    await user.click(kinds.getByRole("button", { name: "Scans" }));
    expect(screen.getByRole("status")).toHaveTextContent(`No Scans${NO_SCANS}`);
    await user.click(kinds.getByRole("button", { name: "Documents" }));
    const grid = screen.getByRole("listbox", { name: "Documents" });
    const tile = within(grid).getByRole("option", { name: /report\.pdf/ });
    await user.dblClick(tile);
    await waitFor(() => expect(screen.getByRole("listbox", { name: "Notes" })).toBeInTheDocument());
    expect(screen.queryByRole("group", { name: "Kind of attachment" })).toBeNull();
    expect(editor()).toHaveTextContent("Forms");
  });
});

describe("Share", () => {
  it("hands Mail the note's own text as a file, with its attachments", async () => {
    stops.push(registerFileReceivers([{ id: "mail", takesSharedFiles: true }]));
    const user = setup();
    render(
      <>
        <Notes
          defaultFolders={folders}
          defaultNotes={[note("plain", { lines: ["Shopping: list", "Milk"], files: [REPORT] })]}
        />
        <DesktopMenu title="File" />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Share" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Mail" }));
    const [text, file] = takeSharedFiles("mail")[0]?.items ?? [];
    expect(text?.name).toBe("Shopping- list.txt");
    expect(await (await text?.bytes?.())?.text()).toBe("Shopping: list\nMilk");
    expect(file?.name).toBe("report.pdf");
  });

  it("File > Share > Reminders takes the note selected now", async () => {
    const user = setup();
    takeSharedTexts();
    render(
      <>
        <Notes
          defaultFolders={folders}
          defaultNotes={[
            note("first", { lines: ["First note"] }),
            note("second", { lines: ["Second note", "its second line"] }),
          ]}
        />
        <DesktopMenu title="File" />
      </>,
    );
    await user.click(screen.getByRole("option", { name: /Second note/ }));
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Share" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reminders" }));
    expect(takeSharedTexts()).toEqual([{ title: "Second note", notes: "its second line" }]);
  });

  it("makes a reminder of a note's text, and dims Reminders in a note with none, saying why", async () => {
    const user = setup();
    takeSharedTexts();
    const { unmount } = render(
      <Notes
        defaultFolders={folders}
        defaultNotes={[note("plain", { lines: ["Buy pears", "from the market"] })]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Share" }));
    const reminders = await screen.findByRole("menuitem", { name: "Reminders" });
    expect(reminders).not.toHaveAttribute("data-reason");
    expect(screen.getByRole("menuitem", { name: "AirDrop" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Mail" })).not.toHaveAttribute("data-reason");
    fireEvent.click(reminders);
    expect(takeSharedTexts()).toEqual([{ title: "Buy pears", notes: "from the market" }]);
    unmount();

    render(<Notes defaultFolders={folders} defaultNotes={[note("empty", { lines: [""] })]} />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("menuitem", { name: "Reminders" })).toHaveAttribute(
      "data-reason",
      "Reminders takes the note’s text, and this note has none.",
    );
  });
});

describe("rows that need what a web page has not got", () => {
  it("dims Accounts and Close All Locked Notes, saying why", async () => {
    const user = setup();
    render(
      <>
        <Notes defaultFolders={folders} defaultNotes={[note("a", {})]} />
        <DesktopMenu title="Notes" />
      </>,
    );
    await user.click(screen.getAllByRole("menuitem", { name: "Notes" })[0] as Element);
    expect(await screen.findByRole("menuitem", { name: "Accounts…" })).toHaveAttribute(
      "data-reason",
      "Notes keeps its notes with your desktop account; there is no other account to add here.",
    );
    expect(screen.getByRole("menuitem", { name: "Close All Locked Notes" })).toHaveAttribute(
      "data-reason",
      "No locked note is open.",
    );
  });

  it("dims Scan Documents and Add Sketch in the Media menu, saying why", async () => {
    const user = setup();
    render(<Notes defaultFolders={folders} defaultNotes={[note("a", {})]} />);
    await user.click(screen.getByRole("button", { name: "Media" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Insert from iPhone or iPad" }));
    for (const name of ["Take Photo", "Scan Documents", "Add Sketch"]) {
      expect(await screen.findByRole("menuitem", { name })).toHaveAttribute(
        "data-reason",
        "That needs an iPhone or iPad nearby, which a web page can’t reach.",
      );
    }
  });
});

describe("Services in the text's context menu", () => {
  it("lists New Note With Selection for the text selected as the menu opened", async () => {
    stops.push(startServices());
    stops.push(registerTextReceivers([{ id: "notes", takesSharedText: true }, { id: "stickies" }]));
    const user = setup();
    render(
      <Notes defaultFolders={folders} defaultNotes={[note("a", { lines: ["Kept words"] })]} />,
    );
    const line = editor().querySelector("div") as Element;
    const range = document.createRange();
    range.selectNodeContents(line);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.contextMenu(line);
    await user.hover(await screen.findByRole("menuitem", { name: "Services" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "New Note With Selection" }));
    await waitFor(() => expect(noteRows()).toHaveLength(2));
    expect(noteRows()[0]).toHaveTextContent("Kept words");
  });
});

/** The desktop's further window, in the page itself. */
function FakeWindow({ id, render: draw, onClose }: DesktopSecondaryWindowProps) {
  const props = { onClose } as unknown as Parameters<DesktopSecondaryWindowProps["render"]>[0];
  return <div data-testid={id}>{draw(props)}</div>;
}
const inManager = (props: ComponentProps<typeof Notes>) => (
  <WindowManager>
    <Notes {...props} DesktopWindow={FakeWindow} />
  </WindowManager>
);

describe("a note in its own window", () => {
  it("opens from the row's menu, and what is typed there reaches the list and the main window", async () => {
    const user = setup();
    render(inManager({ defaultFolders: folders, defaultNotes: [note("a", { lines: ["First"] })] }));
    fireEvent.contextMenu(noteRows()[0] as Element);
    await user.click(await screen.findByRole("menuitem", { name: "Open in New Window" }));
    const own = await screen.findByTestId("note-a");
    const text = within(own).getByRole("textbox", { name: "Note" });
    expect(text).toHaveTextContent("First");
    (text.querySelector("div") as Element).textContent = "Changed";
    fireEvent.input(text);
    await waitFor(() => expect(noteRows()[0]).toHaveTextContent("Changed"));
    const main = screen
      .getAllByRole("textbox", { name: "Note" })
      .find((each) => !own.contains(each));
    expect(main).toHaveTextContent("Changed");
  });

  it("is dimmed, saying why, where no desktop hosts windows", async () => {
    render(<Notes defaultFolders={folders} defaultNotes={[note("a", {})]} />);
    fireEvent.contextMenu(noteRows()[0] as Element);
    expect(await screen.findByRole("menuitem", { name: "Open in New Window" })).toHaveAttribute(
      "title",
      "A note opens in its own window on the desktop.",
    );
  });
});

describe("the gallery with a pinned note", () => {
  it("shows the pinned note under Pinned, and the rest under Notes", async () => {
    const user = setup();
    render(
      <Notes
        defaultFolders={folders}
        defaultNotes={[note("one", { pinned: true }), note("two", {}), note("three", {})]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Gallery View" }));
    const pinned = screen.getByRole("listbox", { name: "Pinned" });
    expect(pinned.closest(".mac-notes-gallery")?.firstElementChild).toHaveTextContent("Pinned");
    expect(within(pinned).getAllByRole("option")).toHaveLength(1);
    expect(within(pinned).getByRole("option", { name: /one/ })).toBeInTheDocument();
    const rest = within(screen.getByRole("listbox", { name: "Notes" })).getAllByRole("option");
    expect(rest).toHaveLength(2);
  });
});

describe("what the note list says of files", () => {
  it("counts pictures as photos and other files as attachments", () => {
    const picture = { id: "p", name: "a.png", type: "image/png", size: 1 };
    const title = { lines: ["Title"] };
    expect(summarize(note("a", { ...title, files: [picture] })).snippet).toBe("1 photo");
    expect(summarize(note("a", { ...title, files: [picture, picture] })).snippet).toBe("2 photos");
    expect(summarize(note("a", { ...title, files: [REPORT] })).snippet).toBe("report.pdf");
    expect(summarize(note("a", { ...title, files: [REPORT, picture] })).snippet).toBe(
      "2 attachments",
    );
  });
});
