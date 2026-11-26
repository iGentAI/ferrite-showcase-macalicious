import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CatalinaLaunchpad } from "./launchpad";
import {
  applicationsOf,
  defaultEntries,
  dockApps,
  isGroup,
  type LaunchpadEntry,
  otherFolder,
  pageCountOf,
  pageOne,
  pageTwo,
} from "./launchpad-data";

/*
 * jsdom has no layout: what is tested is what the demo renders and does, through roles. While
 * Launchpad shows, the library hides the rest of the page from assistive technology (the Dock
 * stays usable with the pointer), and a hidden element has no accessible name: the Dock is
 * then found as the one toolbar, and its tiles by the label they carry.
 */
const dock = () => screen.getByRole("toolbar", { hidden: true });
const tile = (name: string) => {
  const found = within(dock())
    .getAllByRole("button", { hidden: true })
    .find((element) => element.getAttribute("aria-label") === name);
  if (!found) throw new Error(`The Dock has no tile "${name}"`);
  return found;
};
const overlay = () => screen.findByRole("dialog", { name: "Launchpad" });
const noOverlay = () =>
  waitFor(() => expect(screen.queryByRole("dialog", { name: "Launchpad" })).toBeNull());
const status = () => screen.getByText(/^(Opened |Click Launchpad)/);
/** The names under the icons of the grid, in order. */
const names = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll(".mac-launchpad-grid > .mac-launchpad-item")).map(
    (element) => element.querySelector(".mac-launchpad-item-label")?.textContent,
  );
const app = (dialog: HTMLElement, name: string) => within(dialog).getByRole("button", { name });
const field = (dialog: HTMLElement) => within(dialog).getByRole("searchbox", { name: "Search" });
const dots = (dialog: HTMLElement) =>
  within(within(dialog).getByRole("group", { name: "Pages" })).getAllByRole("button");
const nameOf = (entry: LaunchpadEntry) => entry.name;

describe("the data", () => {
  it("holds page 1 as captured: 35 entries with the folder Other in the 28th place", () => {
    expect(pageOne).toHaveLength(35);
    expect(pageOne.map(nameOf).slice(0, 7)).toEqual([
      "App Store",
      "Safari",
      "Mail",
      "Contacts",
      "Calendar",
      "Reminders",
      "Notes",
    ]);
    expect(pageOne.map(nameOf).slice(28)).toEqual([
      "QuickTime Player",
      "TextEdit",
      "Time Machine",
      "Font Book",
      "Chess",
      "Stickies",
      "Image Capture",
    ]);
    expect(pageOne.filter(isGroup)).toEqual([otherFolder]);
    expect(pageOne[27]).toBe(otherFolder);
    expect(otherFolder.apps).toHaveLength(17);
    expect(otherFolder.apps[0]?.name).toBe("Grapher");
    expect(otherFolder.apps[16]?.name).toBe("Audio MIDI Setup");
  });

  it("fills two pages, with ids that are unique", () => {
    expect(pageCountOf(defaultEntries)).toBe(2);
    expect(pageCountOf([])).toBe(1);
    const ids = [...defaultEntries.map((entry) => entry.id), ...otherFolder.apps.map((a) => a.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(applicationsOf(defaultEntries)).toHaveLength(34 + 17 + pageTwo.length);
    expect(dockApps.map(nameOf)).toContain("System Preferences");
  });
});

describe("the stage", () => {
  it("shows the desktop and the Dock of the capture, with Launchpad hidden", () => {
    render(<CatalinaLaunchpad />);
    expect(screen.getByRole("group", { name: "Desktop" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Dock" })).toBe(dock());
    const tiles = within(dock()).getAllByRole("button");
    expect(tiles.map((element) => element.getAttribute("aria-label"))).toEqual([
      "Finder",
      "Launchpad",
      ...dockApps.map(nameOf),
      "Downloads",
      "Trash",
    ]);
    expect(tiles).toHaveLength(20);
    expect(tile("Finder")).toHaveAttribute("data-running");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(status()).toHaveTextContent("Click Launchpad in the Dock");
  });

  it("is a div that takes a ref, a class and other props", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CatalinaLaunchpad ref={ref} className="mine" data-testid="stage" id="screen" />);
    const stage = screen.getByTestId("stage");
    expect(ref.current).toBe(stage);
    expect(stage).toHaveClass("mac-launchpad-demo", "mine");
    expect(stage).toHaveAttribute("id", "screen");
    expect(stage).toContainElement(dock());
  });

  it("shows the picture it is given in place of its own", () => {
    const { container } = render(<CatalinaLaunchpad picture={<div data-testid="picture" />} />);
    expect(screen.getByTestId("picture")).toBeInTheDocument();
    expect(container.querySelector(".mac-launchpad-demo-picture")).toBeNull();
  });
});

describe("Launchpad", () => {
  it("opens from its Dock tile inside the stage, on page 1 as captured", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CatalinaLaunchpad data-testid="stage" onOpenChange={onOpenChange} />);
    await user.click(tile("Launchpad"));
    const dialog = await overlay();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId("stage")).toContainElement(dialog);
    expect(names(dialog)).toEqual(pageOne.map(nameOf));
    expect(field(dialog)).toHaveValue("");
    expect(dots(dialog)).toHaveLength(2);
    expect(dots(dialog)[0]).toHaveAttribute("aria-current", "page");
    // The folder is the library's: a button that says it opens a dialog.
    expect(app(dialog, "Other")).toHaveClass("mac-launchpad-folder");
    expect(app(dialog, "Other")).toHaveAttribute("aria-haspopup", "dialog");
    // Every application has its placeholder, and the folder's tile nine small ones.
    expect(app(dialog, "Safari").querySelector(".mac-launchpad-demo-icon")).toHaveAttribute(
      "data-category",
      "internet",
    );
    expect(app(dialog, "Other").querySelectorAll(".mac-launchpad-demo-icon")).toHaveLength(9);
  });

  it("closes on Escape, on a click on the background and from its Dock tile", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CatalinaLaunchpad defaultOpen onOpenChange={onOpenChange} />);
    await overlay();
    await user.keyboard("{Escape}");
    await noOverlay();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await user.click(tile("Launchpad"));
    await user.click(within(await overlay()).getByRole("button", { name: "Close Launchpad" }));
    await noOverlay();

    await user.click(tile("Launchpad"));
    await overlay();
    await user.click(tile("Launchpad"));
    await noOverlay();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(status()).toHaveTextContent("Click Launchpad in the Dock");
  });

  it("follows a controlling host", async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Show
          </button>
          <CatalinaLaunchpad open={open} onOpenChange={setOpen} />
        </>
      );
    }
    render(<Host />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show" }));
    await overlay();
    await user.keyboard("{Escape}");
    await noOverlay();
  });

  it("turns the page with the dots and with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<CatalinaLaunchpad defaultOpen />);
    const dialog = await overlay();
    await waitFor(() => expect(dialog).toHaveFocus());

    await user.click(dots(dialog)[1] as HTMLElement);
    expect(names(dialog)).toEqual(pageTwo.map(nameOf));
    expect(dots(dialog)[1]).toHaveAttribute("aria-current", "page");
    await user.click(dots(dialog)[0] as HTMLElement);
    expect(names(dialog)).toEqual(pageOne.map(nameOf));

    // On the overlay itself, where no application has the keyboard.
    dialog.focus();
    await user.keyboard("{ArrowRight}");
    expect(names(dialog)).toEqual(pageTwo.map(nameOf));
    expect(dialog).toHaveFocus();
    // There is no third page.
    await user.keyboard("{ArrowRight}");
    expect(names(dialog)).toEqual(pageTwo.map(nameOf));
    await user.keyboard("{ArrowLeft}");
    expect(names(dialog)).toEqual(pageOne.map(nameOf));
    await user.keyboard("{ArrowLeft}");
    expect(names(dialog)).toEqual(pageOne.map(nameOf));
  });

  it("moves among the applications first and turns the page after the last one", async () => {
    const user = userEvent.setup();
    render(<CatalinaLaunchpad defaultOpen />);
    const dialog = await overlay();
    app(dialog, "Stickies").focus();
    await user.keyboard("{ArrowRight}");
    expect(app(dialog, "Image Capture")).toHaveFocus();
    expect(names(dialog)).toEqual(pageOne.map(nameOf));
    await user.keyboard("{ArrowRight}");
    expect(names(dialog)).toEqual(pageTwo.map(nameOf));
    expect(dialog).toHaveFocus();
    // Back from the first application of the second page.
    await user.keyboard("{ArrowDown}");
    expect(app(dialog, "Automator")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(names(dialog)).toEqual(pageOne.map(nameOf));
  });

  it("turns no page with an arrow held with a modifier", async () => {
    const user = userEvent.setup();
    render(<CatalinaLaunchpad defaultOpen />);
    const dialog = await overlay();
    dialog.focus();
    for (const modifier of ["Meta", "Alt", "Control", "Shift"]) {
      await user.keyboard(`{${modifier}>}{ArrowRight}{/${modifier}}`);
      expect(names(dialog), modifier).toEqual(pageOne.map(nameOf));
    }
    await user.keyboard("{ArrowRight}");
    expect(names(dialog)).toEqual(pageTwo.map(nameOf));
    for (const modifier of ["Meta", "Alt", "Control", "Shift"]) {
      await user.keyboard(`{${modifier}>}{ArrowLeft}{/${modifier}}`);
      expect(names(dialog), modifier).toEqual(pageTwo.map(nameOf));
    }
  });

  it("shows from its Dock tile by the keyboard after a press that ended away from the tile", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CatalinaLaunchpad defaultOpen onOpenChange={onOpenChange} />);
    await overlay();
    // The pointer goes down on the tile while Launchpad shows and comes up elsewhere: no click.
    fireEvent.pointerDown(tile("Launchpad"));
    if (screen.queryByRole("dialog", { name: "Launchpad" })) await user.keyboard("{Escape}");
    await noOverlay();
    // Return on the tile shows Launchpad: that old press does not decide this click.
    tile("Launchpad").focus();
    await user.keyboard("{Enter}");
    await overlay();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });

  it("remembers the page it was left on", async () => {
    const user = userEvent.setup();
    render(<CatalinaLaunchpad defaultOpen defaultPage={1} />);
    expect(names(await overlay())).toEqual(pageTwo.map(nameOf));
    await user.keyboard("{Escape}");
    await noOverlay();
    await user.click(tile("Launchpad"));
    expect(names(await overlay())).toEqual(pageTwo.map(nameOf));
  });
});

describe("the search field", () => {
  it("filters by name on one page, across both pages and into the folder", async () => {
    const user = userEvent.setup();
    render(<CatalinaLaunchpad defaultOpen />);
    const dialog = await overlay();
    await waitFor(() => expect(dialog).toHaveFocus());
    // Typing anywhere goes to the field. Case does not matter: Notes is on page 1 and Keynote
    // on page 2.
    await user.keyboard("NO");
    expect(field(dialog)).toHaveValue("NO");
    expect(names(dialog)).toEqual(["Notes", "Keynote"]);
    expect(within(dialog).queryByRole("group", { name: "Pages" })).toBeNull();

    // These four are in the folder Other.
    await user.clear(field(dialog));
    await user.type(field(dialog), "utility");
    expect(names(dialog)).toEqual([
      "VoiceOver Utility",
      "AirPort Utility",
      "Disk Utility",
      "ColorSync Utility",
    ]);
    // The arrow keys stay in the field while it is searched.
    await user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(field(dialog)).toHaveFocus();

    await user.clear(field(dialog));
    expect(names(dialog)).toEqual(pageOne.map(nameOf));
    expect(dots(dialog)).toHaveLength(2);
  });

  it("launches the first match on Return and is empty the next time", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<CatalinaLaunchpad defaultOpen onLaunch={onLaunch} />);
    const dialog = await overlay();
    await user.type(field(dialog), "term{Enter}");
    await noOverlay();
    expect(onLaunch).toHaveBeenCalledWith(expect.objectContaining({ id: "terminal" }));
    expect(status()).toHaveTextContent("Opened Terminal");

    await user.click(tile("Launchpad"));
    const again = await overlay();
    expect(field(again)).toHaveValue("");
    expect(names(again)).toEqual(pageOne.map(nameOf));
  });

  it("starts with the text it is given", async () => {
    render(<CatalinaLaunchpad defaultOpen defaultSearch="chess" />);
    const dialog = await overlay();
    expect(field(dialog)).toHaveValue("chess");
    expect(names(dialog)).toEqual(["Chess"]);
  });
});

describe("launching", () => {
  it("closes Launchpad and reports the chosen application", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    const onOpenChange = vi.fn();
    render(<CatalinaLaunchpad defaultOpen onLaunch={onLaunch} onOpenChange={onOpenChange} />);
    await user.click(app(await overlay(), "Maps"));
    await noOverlay();
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenCalledWith({ id: "maps", name: "Maps", category: "internet" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(status()).toHaveTextContent("Opened Maps");
  });

  it("launches from the keyboard", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<CatalinaLaunchpad defaultOpen onLaunch={onLaunch} />);
    const dialog = await overlay();
    await waitFor(() => expect(dialog).toHaveFocus());
    // Down into the grid, along the first row, down a row: Messages is under Safari.
    await user.keyboard("{ArrowDown}{ArrowRight}{ArrowDown}{Enter}");
    await noOverlay();
    expect(onLaunch).toHaveBeenCalledWith(expect.objectContaining({ name: "Messages" }));
  });

  it("reports an application chosen in the Dock, and closes Launchpad for it", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<CatalinaLaunchpad onLaunch={onLaunch} />);
    await user.click(tile("Notes"));
    expect(onLaunch).toHaveBeenLastCalledWith(expect.objectContaining({ id: "notes" }));
    expect(status()).toHaveTextContent("Opened Notes");

    await user.click(tile("Launchpad"));
    await overlay();
    await user.click(tile("Safari"));
    await noOverlay();
    expect(onLaunch).toHaveBeenLastCalledWith(expect.objectContaining({ id: "safari" }));
    expect(status()).toHaveTextContent("Opened Safari");

    // The Trash is not an application: nothing is launched.
    await user.click(tile("Trash"));
    expect(onLaunch).toHaveBeenCalledTimes(2);
  });

  it("shows other entries when it is given them", async () => {
    const entries: LaunchpadEntry[] = [
      { id: "one", name: "One", category: "media" },
      { id: "two", name: "Two", category: "files" },
    ];
    render(<CatalinaLaunchpad defaultOpen entries={entries} />);
    const dialog = await overlay();
    expect(names(dialog)).toEqual(["One", "Two"]);
    expect(within(dialog).queryByRole("group", { name: "Pages" })).toBeNull();
  });
});

describe("the folder Other", () => {
  it("opens the library's folder with its 17 applications and hides the Dock", async () => {
    const user = userEvent.setup();
    render(<CatalinaLaunchpad defaultOpen data-testid="stage" />);
    const dialog = await overlay();
    await user.click(app(dialog, "Other"));
    const panel = await screen.findByRole("dialog", { name: "Other" });
    expect(panel).toHaveClass("mac-launchpad-folder-popup");
    expect(within(panel).getByRole("heading", { name: "Other" })).toBeInTheDocument();
    const inside = Array.from(panel.querySelectorAll(".mac-launchpad-item-label")).map(
      (element) => element.textContent,
    );
    expect(inside).toEqual(otherFolder.apps.map(nameOf));
    expect(screen.getByTestId("stage")).toHaveAttribute("data-folder-open");
    expect(dock()).toHaveAttribute("inert");

    // Escape closes the folder and leaves Launchpad; the Dock is back.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Other" })).toBeNull());
    expect(await overlay()).toBeInTheDocument();
    expect(screen.getByTestId("stage")).not.toHaveAttribute("data-folder-open");
    expect(dock()).not.toHaveAttribute("inert");

    // A click beside the panel does the same.
    await user.click(app(await overlay(), "Other"));
    const again = await screen.findByRole("dialog", { name: "Other" });
    await user.click(within(again).getByRole("button", { name: "Close folder" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Other" })).toBeNull());
    expect(await overlay()).toBeInTheDocument();
  });

  it("opens no folder for an id that is not a folder on the page shown", async () => {
    const user = userEvent.setup();
    // Nothing has this id; "safari" is an application's; Other is on page 1, not page 2.
    for (const [defaultFolder, defaultPage] of [
      ["nothing", 0],
      ["safari", 0],
      ["other", 1],
    ] as const) {
      const { unmount } = render(
        <CatalinaLaunchpad
          defaultOpen
          defaultFolder={defaultFolder}
          defaultPage={defaultPage}
          data-testid="stage"
        />,
      );
      const dialog = await overlay();
      expect(screen.getByTestId("stage"), defaultFolder).not.toHaveAttribute("data-folder-open");
      expect(dock(), defaultFolder).not.toHaveAttribute("inert");
      expect(screen.queryByRole("dialog", { name: "Other" })).toBeNull();
      if (defaultPage === 1) {
        // The folder's page comes: the folder does not spring open on it.
        await user.click(dots(dialog)[0] as HTMLElement);
        expect(names(dialog)).toEqual(pageOne.map(nameOf));
        expect(screen.queryByRole("dialog", { name: "Other" })).toBeNull();
        expect(screen.getByTestId("stage")).not.toHaveAttribute("data-folder-open");
      }
      unmount();
    }
  });

  it("launches an application in it and closes with Launchpad", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    render(<CatalinaLaunchpad defaultOpen defaultFolder="other" onLaunch={onLaunch} />);
    const panel = await screen.findByRole("dialog", { name: "Other" });
    await user.click(within(panel).getByRole("button", { name: "Disk Utility" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onLaunch).toHaveBeenCalledWith(expect.objectContaining({ id: "disk-utility" }));
    expect(status()).toHaveTextContent("Opened Disk Utility");

    // The folder is closed the next time Launchpad shows.
    await user.click(tile("Launchpad"));
    await overlay();
    expect(screen.queryByRole("dialog", { name: "Other" })).toBeNull();
    expect(dock()).not.toHaveAttribute("inert");
  });
});
