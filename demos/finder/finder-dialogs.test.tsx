import { render, screen, act as settle, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Finder } from "./finder";
import { HOME, TRASH } from "./finder-data";

/** The window, found by its title: the title bar names the window's region. */
const titled = (name: string) => screen.getByRole("region", { name });
const place = (name: string) => screen.getByRole("treeitem", { name });
const item = (name: string) => screen.getByRole("option", { name });
const items = () => screen.queryAllByRole("option").map((option) => option.textContent);
const button = (name: string) => screen.getByRole("button", { name });
/** An alert, found by its message. */
const alert = (name: RegExp) => screen.getByRole("alertdialog", { name });
const noAlert = () => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
const dialog = (name: string) => screen.getByRole("dialog", { name });
const noDialog = () => expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

type User = ReturnType<typeof userEvent.setup>;

/** Chooses a command of the Action menu. */
async function act(user: User, command: string | RegExp) {
  await user.click(button("Action"));
  await user.click(await screen.findByRole("menuitem", { name: command }));
}

/** The commands of the Action menu that are dimmed. */
async function dimmed(user: User) {
  await user.click(button("Action"));
  const commands = await screen.findAllByRole("menuitem");
  const names = commands
    .filter((command) => command.getAttribute("aria-disabled") === "true")
    .map((command) => command.textContent);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  return names;
}

const EMPTY = /^Are you sure you want to permanently erase the items in the Trash/;
const REPLACE = /already exists in this location/;

describe("Empty Trash", () => {
  it("asks from the Trash's banner, keeps the items on Cancel and erases them on Empty Trash", async () => {
    const user = userEvent.setup();
    render(<Finder defaultTabs={[TRASH]} />);
    expect(titled("Trash")).toBeInTheDocument();
    expect(items()).toEqual(["Blurred.jpg", "Old packing list.txt"]);

    await user.click(button("Empty"));
    const asked = alert(EMPTY);
    expect(within(asked).getByText("You can’t undo this action.")).toBeInTheDocument();
    // The alert is the key window while it waits; the Finder window is the main window.
    expect(asked).toHaveAttribute("data-window-state", "key");
    expect(titled("Trash")).toHaveAttribute("data-window-state", "main");
    await user.click(within(asked).getByRole("button", { name: "Cancel" }));
    noAlert();
    expect(items()).toHaveLength(2);
    expect(titled("Trash")).toHaveAttribute("data-window-state", "key");
    // The keyboard is the Finder window's again.
    await waitFor(() => expect(titled("Trash")).toHaveFocus());

    await user.click(button("Empty"));
    await user.click(within(alert(EMPTY)).getByRole("button", { name: "Empty Trash" }));
    noAlert();
    expect(items()).toEqual([]);
    expect(button("Empty")).toBeDisabled();
  });

  it("asks from the Action menu anywhere: Return empties the Trash, Escape leaves it", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await act(user, "Empty Trash…");
    await user.keyboard("{Escape}");
    noAlert();
    expect(await dimmed(user)).not.toContain("Empty Trash…");

    await act(user, "Empty Trash…");
    // The alert takes the keyboard when it opens; Return then reaches its default button.
    await waitFor(() => expect(alert(EMPTY)).toHaveFocus());
    await user.keyboard("{Enter}");
    noAlert();
    // Nothing is left to erase, so the command is dimmed.
    expect(await dimmed(user)).toContain("Empty Trash…");
  });

  it("asks with Shift-Command-Delete while the Trash holds something", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await user.click(item("Music"));
    await user.keyboard("{Shift>}{Meta>}{Backspace}{/Meta}{/Shift}");
    await user.click(within(alert(EMPTY)).getByRole("button", { name: "Empty Trash" }));
    await user.click(item("Music"));
    await user.keyboard("{Shift>}{Meta>}{Backspace}{/Meta}{/Shift}");
    noAlert();
  });
});

describe("Go to Folder", () => {
  it("opens on the last path with the keyboard in the field, and Return goes there", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await act(user, "Go to Folder…");
    const asked = dialog("Go to Folder");
    const field = within(asked).getByRole("combobox", { name: "Go to the folder:" });
    expect(field).toHaveValue("~/Documents/");
    await waitFor(() => expect(field).toHaveFocus());
    expect(titled("shackett")).toHaveAttribute("data-window-state", "main");

    await user.keyboard("{Enter}");
    noDialog();
    expect(titled("Documents")).toBeInTheDocument();
    expect(titled("Documents")).toHaveAttribute("data-window-state", "key");
    // The keyboard is the Finder window's again: its keys work at once.
    await waitFor(() => expect(titled("Documents")).toHaveFocus());
    await user.keyboard("{Control>}[[{/Control}");
    expect(titled("shackett")).toBeInTheDocument();
  });

  it("follows a typed path, a path from its list and a relative path, and shows a file in its folder", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    const go = async (path: string) => {
      // A press in the window gives it the keyboard.
      await user.click(screen.getByRole("status"));
      await user.keyboard("{Shift>}{Control>}g{/Control}{/Shift}");
      const field = within(dialog("Go to Folder")).getByRole("combobox");
      await user.clear(field);
      await user.type(field, path);
      await user.click(within(dialog("Go to Folder")).getByRole("button", { name: "Go" }));
    };
    await go("/Applications/Utilities");
    expect(titled("Utilities")).toBeInTheDocument();
    await go("..");
    expect(titled("Applications")).toBeInTheDocument();
    await go("~/Documents/Budget.txt");
    expect(titled("Documents")).toBeInTheDocument();
    expect(item("Budget.txt")).toHaveAttribute("aria-selected", "true");

    // The paths that were typed head the list; one of them is chosen with the pointer.
    await act(user, "Go to Folder…");
    const asked = dialog("Go to Folder");
    expect(within(asked).getByRole("combobox")).toHaveValue("~/Documents/Budget.txt");
    await user.click(within(asked).getByRole("button", { name: "Show choices" }));
    await user.click(await screen.findByRole("option", { name: "/Applications/Utilities" }));
    await user.click(within(asked).getByRole("button", { name: "Go" }));
    expect(titled("Utilities")).toBeInTheDocument();
  });

  it("stays open on a path that leads nowhere, and Cancel and Escape go nowhere", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await act(user, "Go to Folder…");
    const field = within(dialog("Go to Folder")).getByRole("combobox");
    await user.clear(field);
    await user.type(field, "~/Nowhere{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("The folder can’t be found.");
    expect(titled("shackett")).toBeInTheDocument();
    // Typing again takes the message away.
    await user.type(field, "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(within(dialog("Go to Folder")).getByRole("button", { name: "Cancel" }));
    noDialog();

    await act(user, "Go to Folder…");
    // A path that was not found is not kept.
    expect(within(dialog("Go to Folder")).getByRole("combobox")).toHaveValue("~/Documents/");
    await user.keyboard("{Escape}");
    noDialog();
    expect(titled("shackett")).toBeInTheDocument();
  });
});

describe("Connect to Server", () => {
  it("connects the computer its address names and shows its shared folders", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await act(user, "Connect to Server…");
    const asked = dialog("Connect to Server");
    const field = within(asked).getByRole("combobox", { name: "Server Address" });
    expect(field).toHaveValue("smb://castle.local");
    await waitFor(() => expect(field).toHaveFocus());
    // The dialog is a window of its own with the keyboard: the Finder window is main.
    expect(titled("shackett")).toHaveAttribute("data-window-state", "main");

    await user.keyboard("{Enter}");
    noDialog();
    expect(titled("Castle")).toBeInTheDocument();
    expect(items()).toEqual(["Public", "Shared"]);
  });

  it("keeps favorite servers: add, select, remove, and a double click connects", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await user.click(item("Music"));
    await user.keyboard("{Meta>}k{/Meta}");
    const asked = dialog("Connect to Server");
    const within_ = within(asked);
    const favorites = () =>
      within(within_.getByRole("listbox", { name: "Favorite Servers:" }))
        .queryAllByRole("option")
        .map((option) => option.textContent);
    const add = within_.getByRole("button", { name: "Add to Favorites" });
    const remove = within_.getByRole("button", { name: "Remove from Favorites" });
    expect(remove).toBeDisabled();

    await user.click(add);
    expect(favorites()).toEqual(["smb://castle.local"]);
    // An address is a favorite once.
    expect(add).toBeDisabled();
    const field = within_.getByRole("combobox", { name: "Server Address" });
    await user.clear(field);
    await user.type(field, "merribook");
    await user.click(add);
    expect(favorites()).toEqual(["smb://castle.local", "merribook"]);

    // A selected favorite is the address in the field, and the one Remove takes out.
    await user.click(within_.getByRole("option", { name: "smb://castle.local" }));
    expect(field).toHaveValue("smb://castle.local");
    await user.click(remove);
    expect(favorites()).toEqual(["merribook"]);
    expect(remove).toBeDisabled();

    // The Action menu holds the same two commands.
    await user.click(within_.getByRole("button", { name: "Action" }));
    await user.click(await screen.findByRole("menuitem", { name: "Add to Favorites" }));
    expect(favorites()).toEqual(["merribook", "smb://castle.local"]);

    await user.dblClick(within_.getByRole("option", { name: "merribook" }));
    noDialog();
    expect(titled("merribook")).toBeInTheDocument();

    // The favorites are kept for the next time, and so is the address last connected to.
    await act(user, "Connect to Server…");
    const again = within(dialog("Connect to Server"));
    expect(again.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "merribook",
      "smb://castle.local",
    ]);
    expect(again.getByRole("combobox", { name: "Server Address" })).toHaveValue("merribook");
  });

  it("ends in an alert for an address no computer has", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await act(user, "Connect to Server…");
    const field = within(dialog("Connect to Server")).getByRole("combobox");
    await user.clear(field);
    expect(
      within(dialog("Connect to Server")).getByRole("button", { name: "Connect" }),
    ).toBeDisabled();
    await user.type(field, "afp://nobody.local{Enter}");
    noDialog();
    const failed = alert(/^There was a problem connecting to the server “afp:\/\/nobody.local”/);
    expect(titled("shackett")).toHaveAttribute("data-window-state", "main");
    await waitFor(() => expect(failed).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(failed).not.toBeInTheDocument();
    expect(titled("shackett")).toBeInTheDocument();
    await waitFor(() => expect(titled("shackett")).toHaveFocus());
  });

  it("browses the network, closes with its close button and with Escape, and asks for help", async () => {
    const user = userEvent.setup();
    const onHelp = vi.fn();
    const { rerender } = render(<Finder />);
    await act(user, "Connect to Server…");
    const asked = within(dialog("Connect to Server"));
    expect(asked.getByRole("button", { name: "Help" })).toBeDisabled();
    expect(asked.getByRole("button", { name: "Zoom" })).toBeDisabled();
    rerender(<Finder onHelp={onHelp} />);
    await user.click(asked.getByRole("button", { name: "Help" }));
    expect(onHelp).toHaveBeenCalledTimes(1);

    // The dialog is modeless: the Finder window stays in reach and takes the key state back,
    // and the dialog is then drawn as an inactive window.
    expect(dialog("Connect to Server")).toHaveAttribute("data-window-state", "key");
    await user.click(item("Music"));
    expect(titled("shackett")).toHaveAttribute("data-window-state", "key");
    expect(dialog("Connect to Server")).toBeInTheDocument();
    expect(dialog("Connect to Server")).toHaveAttribute("data-window-state", "inactive");
    // A press in the dialog makes it the key window again, and the Finder window main.
    await user.click(asked.getByRole("combobox", { name: "Server Address" }));
    expect(dialog("Connect to Server")).toHaveAttribute("data-window-state", "key");
    expect(titled("shackett")).toHaveAttribute("data-window-state", "main");

    await user.click(asked.getByRole("button", { name: "Close" }));
    noDialog();
    // The keyboard goes back to the Finder window.
    await waitFor(() => expect(titled("shackett")).toHaveFocus());
    await act(user, "Connect to Server…");
    await user.keyboard("{Escape}");
    noDialog();
    expect(titled("shackett")).toBeInTheDocument();

    await act(user, "Connect to Server…");
    await user.click(within(dialog("Connect to Server")).getByRole("button", { name: "Browse" }));
    noDialog();
    expect(titled("Network")).toBeInTheDocument();
  });
});

/** The Copy window, which has no title: the library names it. */
const copying = () => screen.queryByRole("region", { name: "Copy" });
/** A copy takes two seconds of the demo's clock. */
const arrived = { timeout: 8000 };

describe("Copy and Paste", () => {
  it("copies an item into another folder behind a progress window", async () => {
    const user = userEvent.setup();
    render(<Finder defaultTabs={[`${HOME}/Documents`]} />);
    expect(await dimmed(user)).toEqual(expect.arrayContaining(["Copy", "Paste Item"]));
    await user.click(item("Budget.txt"));
    await act(user, "Copy “Budget.txt”");
    await user.click(place("Desktop"));
    await act(user, "Paste Item");

    const progress = copying() as HTMLElement;
    expect(progress).toBeInTheDocument();
    expect(
      within(progress).getByRole("group", { name: "Copying “Budget.txt” to “Desktop”" }),
    ).toBeInTheDocument();
    expect(within(progress).getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/ KB of 12\.8 KB - About \d seconds?$/),
    );
    // The window is not the key window until it is pressed; its close button stays disabled.
    expect(progress).toHaveAttribute("data-window-state", "inactive");
    expect(within(progress).getByRole("button", { name: "Close" })).toBeDisabled();
    // One copy runs at a time.
    expect(await dimmed(user)).toContain("Paste Item");
    expect(items()).not.toContain("Budget.txt");

    await waitFor(() => expect(items()).toContain("Budget.txt"), arrived);
    expect(copying()).not.toBeInTheDocument();
    expect(items()).toEqual(["Budget.txt", "Meeting notes.txt", "Screen sketch.jpg"]);
  }, 20000);

  it("copies nothing when the copy is stopped", async () => {
    const user = userEvent.setup();
    render(<Finder defaultTabs={[`${HOME}/Documents`]} />);
    await user.click(item("Budget.txt"));
    await user.keyboard("{Control>}c{/Control}");
    await user.click(place("Desktop"));
    await user.click(item("Meeting notes.txt"));
    await user.keyboard("{Control>}v{/Control}");
    const progress = copying() as HTMLElement;
    await user.click(within(progress).getByRole("button", { name: "Stop" }));
    expect(copying()).not.toBeInTheDocument();
    // The Copy window had the keyboard: it is the Finder window's again.
    expect(titled("Desktop")).toHaveFocus();
    // The time of a whole copy later, nothing has arrived.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(items()).toEqual(["Meeting notes.txt", "Screen sketch.jpg"]);
  }, 20000);

  it("asks about an item of the same name: Stop and Escape copy nothing, Keep Both keeps both, Replace replaces", async () => {
    const user = userEvent.setup();
    render(<Finder defaultTabs={[`${HOME}/Documents`]} />);
    await user.click(item("Budget.txt"));
    await act(user, /^Copy/);
    await user.click(place("Desktop"));
    await act(user, "Paste Item");
    await waitFor(() => expect(items()).toContain("Budget.txt"), arrived);
    // The item in the folder is marked with a tag, so that it can be told from the copy: a
    // copy that replaces it arrives without the tag, one kept beside it under another name.
    const red = (name: string) => item(name).querySelector('.mac-tag-dot[data-color="red"]');
    await user.click(item("Budget.txt"));
    await user.click(button("Edit Tags"));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Red" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(red("Budget.txt")).not.toBeNull();
    const before = ["Budget.txt", "Meeting notes.txt", "Screen sketch.jpg"];
    expect(items()).toEqual(before);

    // Pasted again, the item is in the way of itself.
    await act(user, "Paste Item");
    const asked = alert(REPLACE);
    expect(asked).toHaveAccessibleName(
      "An item named “Budget.txt” already exists in this location. Do you want to replace it with the one you’re copying?",
    );
    expect(copying()).not.toBeInTheDocument();
    expect(titled("Desktop")).toHaveAttribute("data-window-state", "main");
    // No button is the default: Return answers nothing.
    await user.keyboard("{Enter}");
    expect(alert(REPLACE)).toBeInTheDocument();
    await user.click(within(asked).getByRole("button", { name: "Stop" }));
    noAlert();
    expect(copying()).not.toBeInTheDocument();
    // The library gives the keyboard back to the Finder window, not to the Action button.
    await waitFor(() => expect(titled("Desktop")).toHaveFocus());
    expect(titled("Desktop")).toHaveAttribute("data-window-state", "key");

    await act(user, "Paste Item");
    await user.keyboard("{Escape}");
    noAlert();
    expect(copying()).not.toBeInTheDocument();
    await waitFor(() => expect(titled("Desktop")).toHaveFocus());
    // The time of a whole copy later, nothing has arrived and the tagged item is untouched.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(items()).toEqual(before);
    expect(red("Budget.txt")).not.toBeNull();

    await act(user, "Paste Item");
    await user.click(within(alert(REPLACE)).getByRole("button", { name: "Keep Both" }));
    noAlert();
    expect(copying()).toBeInTheDocument();
    await waitFor(() => expect(items()).toContain("Budget 2.txt"), arrived);
    expect(items()).toEqual(["Budget 2.txt", ...before]);
    // Both are kept: the tagged item, and the copy beside it, which has no tag.
    expect(red("Budget.txt")).not.toBeNull();
    expect(red("Budget 2.txt")).toBeNull();

    await act(user, "Paste Item");
    await user.click(within(alert(REPLACE)).getByRole("button", { name: "Replace" }));
    noAlert();
    expect(copying()).toBeInTheDocument();
    // Until the copy is done the tagged item is still there.
    expect(red("Budget.txt")).not.toBeNull();
    await waitFor(() => expect(copying()).not.toBeInTheDocument(), arrived);
    // One Budget.txt, and it is the copy: the tagged item is gone, and so is the tag's dot.
    expect(items()).toEqual(["Budget 2.txt", ...before]);
    expect(red("Budget.txt")).toBeNull();
    await user.click(place("Red"));
    expect(items()).toEqual([]);
  }, 40000);

  it("names a copy pasted beside its original after it, and counts several items", async () => {
    const user = userEvent.setup();
    render(<Finder defaultTabs={[`${HOME}/Pictures`]} />);
    await user.click(item("Dunes.jpg"));
    await user.keyboard("{Shift>}");
    await user.click(item("Harbour.jpg"));
    await user.keyboard("{/Shift}");
    await act(user, "Copy 2 Items");
    await act(user, "Paste 2 Items");
    noAlert();
    const progress = copying() as HTMLElement;
    expect(
      within(progress).getByRole("group", { name: "Copying 2 items to “Pictures”" }),
    ).toBeInTheDocument();
    // A press in the Copy window makes it the key window, and the Finder window main.
    await user.click(within(progress).getByRole("button", { name: "Minimize" }));
    expect(progress).toHaveAttribute("data-window-state", "key");
    expect(titled("Pictures")).toHaveAttribute("data-window-state", "main");
    await waitFor(() => expect(copying()).not.toBeInTheDocument(), arrived);
    expect(items()).toEqual(["Dunes copy.jpg", "Dunes.jpg", "Harbour copy.jpg", "Harbour.jpg"]);
    expect(titled("Pictures")).toHaveAttribute("data-window-state", "key");
    // The Copy window had the keyboard when it went: the Finder window has it again.
    expect(titled("Pictures")).toHaveFocus();
  }, 20000);

  it("keeps a copy beside an item that took its name while the copy ran", async () => {
    // The copy's clock is the test's, so that the copy waits for the new folder. jsdom runs
    // animation frames on an interval, and a menu opens on one: they keep a clock of their own.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) =>
      setTimeout(() => frame(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    try {
      const user = userEvent.setup();
      render(<Finder defaultTabs={[`${HOME}/Documents`]} />);
      await act(user, "New Folder");
      expect(items()).toContain("untitled folder");
      await act(user, "Copy “untitled folder”");
      await user.click(place("Desktop"));
      await act(user, "Paste Item");
      expect(copying()).toBeInTheDocument();
      // While the copy runs, a new folder takes the name the copy was to arrive under.
      await act(user, "New Folder");
      expect(copying()).toBeInTheDocument();
      expect(items()).toEqual(["Meeting notes.txt", "Screen sketch.jpg", "untitled folder"]);

      settle(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(copying()).not.toBeInTheDocument();
      noAlert();
      expect(items()).toEqual([
        "Meeting notes.txt",
        "Screen sketch.jpg",
        "untitled folder",
        "untitled folder 2",
      ]);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  }, 20000);

  it("keeps a copy that arrives in the render that takes a disk away", async () => {
    // The copy's clock is the test's, so that its last step and the disconnection can be
    // handed to React together.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const user = userEvent.setup();
      const { rerender } = render(<Finder defaultTabs={[`${HOME}/Documents`]} />);
      await user.click(item("Budget.txt"));
      await user.keyboard("{Control>}c{/Control}");
      await user.click(place("Desktop"));
      await user.click(item("Meeting notes.txt"));
      await user.keyboard("{Control>}v{/Control}");
      expect(copying()).toBeInTheDocument();
      // Every step but the last.
      settle(() => {
        vi.advanceTimersByTime(1900);
      });
      expect(copying()).toBeInTheDocument();
      expect(items()).not.toContain("Budget.txt");
      settle(() => {
        vi.advanceTimersByTime(100);
        rerender(
          <Finder defaultTabs={[`${HOME}/Documents`]} disconnected={["/Volumes/Macintosh HD"]} />,
        );
      });
      expect(copying()).not.toBeInTheDocument();
      expect(screen.queryByRole("treeitem", { name: "Macintosh HD" })).not.toBeInTheDocument();
      expect(items()).toEqual(["Budget.txt", "Meeting notes.txt", "Screen sketch.jpg"]);
    } finally {
      vi.useRealTimers();
    }
  }, 20000);
});

describe("Disk Not Ejected Properly", () => {
  it("takes a disconnected disk away and posts the notification until Close", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Finder defaultTabs={[HOME, "/Volumes/Macintosh HD/Scans"]} />);
    expect(place("Macintosh HD")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(
      <Finder
        defaultTabs={[HOME, "/Volumes/Macintosh HD/Scans"]}
        disconnected={["/Volumes/Macintosh HD"]}
      />,
    );
    const notice = await screen.findByRole("alert", { name: "Disk Not Ejected Properly" });
    expect(notice).toHaveAccessibleDescription(
      "Eject “Macintosh HD” before disconnecting or turning it off.",
    );
    expect(screen.queryByRole("treeitem", { name: "Macintosh HD" })).not.toBeInTheDocument();
    // The tab that showed a folder of the disk shows the computer.
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "shackett",
      "ismhpro",
    ]);
    // The notification is not modal: the window stays the key window and in use.
    expect(titled("shackett")).toHaveAttribute("data-window-state", "key");
    await user.click(item("Music"));
    expect(notice).toBeInTheDocument();

    await user.click(within(notice).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(place("Time Machine")).toBeInTheDocument();
  });

  it("leaves no place on the disk in a tab's history", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Finder />);
    await user.click(place("Macintosh HD"));
    expect(titled("Macintosh HD")).toBeInTheDocument();
    await user.click(place("Desktop"));
    await user.click(place("Macintosh HD"));
    await user.click(button("Back"));
    // Home, the disk, Desktop (shown), the disk.
    expect(titled("Desktop")).toBeInTheDocument();
    expect(button("Forward")).not.toHaveAttribute("aria-disabled", "true");

    rerender(<Finder disconnected={["/Volumes/Macintosh HD"]} />);
    await screen.findByRole("alert", { name: "Disk Not Ejected Properly" });
    expect(titled("Desktop")).toBeInTheDocument();
    expect(button("Forward")).toHaveAttribute("aria-disabled", "true");
    await user.click(button("Back"));
    expect(titled("shackett")).toBeInTheDocument();
    expect(button("Back")).toHaveAttribute("aria-disabled", "true");
  });

  it("posts one notification per disk, and none for a path that is not a disk", async () => {
    // The host names the element the Finder's other windows go into.
    const host = document.body.appendChild(document.createElement("div"));
    render(
      <Finder
        panelContainer={host}
        disconnected={["/Volumes/Macintosh HD", "/Volumes/Time Machine", "/Applications", "/x"]}
      />,
    );
    const notices = await screen.findAllByRole("alert");
    expect(notices).toHaveLength(2);
    expect(notices[0]).toHaveAccessibleDescription(/“Macintosh HD”/);
    expect(notices[1]).toHaveAccessibleDescription(/“Time Machine”/);
    expect(host).toContainElement(notices[0] as HTMLElement);
    expect(place("Applications")).toBeInTheDocument();
  });
});
