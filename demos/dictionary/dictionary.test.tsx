import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { app, dictionaryApp } from "./app";
import { Dictionary } from "./dictionary";
import { defaultEntries, inScope, search } from "./dictionary-data";
import { DesktopDictionary } from "./dictionary-desktop";

/*
 * jsdom has no layout, so the list is never measured and renders its first rows: all 32 of
 * the default search.
 */
const frame = (title = "Dictionary (32 found)") => screen.getByRole("region", { name: title });
const field = () => screen.getByRole("searchbox", { name: "Search" });
const scope = (name: string) =>
  within(screen.getByRole("radiogroup", { name: "Source" })).getByRole("radio", { name });
const words = () => within(screen.getByRole("listbox", { name: "Words" })).queryAllByRole("option");
const word = (name: string) =>
  within(screen.getByRole("listbox", { name: "Words" })).getByRole("option", { name });
const selectedWord = () =>
  words().find((row) => row.getAttribute("aria-selected") === "true")?.textContent;
const entry = (name: string) => screen.getByRole("region", { name: `Entry for ${name}` });
const search_ = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await user.clear(field());
  if (text) await user.type(field(), text);
};

describe("the window", () => {
  it("opens on the search of the captures, at the captured size", () => {
    render(<Dictionary />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("690px");
    expect(frame().style.height).toBe("650px");
    expect(field()).toHaveValue("computer");
    expect(scope("Dictionary")).toBeChecked();
    expect(words()).toHaveLength(32);
    expect(words()[1]).toHaveTextContent("computer-aided");
    expect(words()[16]).toHaveTextContent("computerese");
    expect(selectedWord()).toBe("computer");
    const shown = within(entry("computer"));
    expect(shown.getByRole("heading", { name: /com·put·er/ })).toBeVisible();
    expect(shown.getByText("noun")).toBeVisible();
    expect(shown.getByText(/an electronic device for storing and processing data/)).toBeVisible();
    expect(shown.getByText(/a person who makes calculations/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Back" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Forward" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Dictionary
        ref={ref}
        state="inactive"
        width={520}
        height="50vh"
        className="mine"
        data-kind="app"
        onClose={onClose}
        onZoom={onZoom}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.width).toBe("520px");
    expect(frame().style.height).toBe("50vh");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.dblClick(screen.getByText("Dictionary (32 found)"));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("exports a descriptor a desktop can host", () => {
    expect(app).toBe(dictionaryApp);
    expect(app.id).toBe("dictionary");
    expect(app.name).toBe("Dictionary");
    expect(app.component).toBe(DesktopDictionary);
    expect(app.defaultSize).toEqual({ width: 690, height: 650 });
    expect(app.menus[0]).toBe("Dictionary");
  });
});

describe("searching", () => {
  it("lists the headwords that start with what is typed and shows the first one's entry", async () => {
    const user = userEvent.setup();
    const onLookUp = vi.fn();
    render(<Dictionary onLookUp={onLookUp} />);
    expect(onLookUp).not.toHaveBeenCalled();
    await search_(user, "men");
    expect(frame("Dictionary (1 found)")).toBeVisible();
    expect(words().map((row) => row.textContent)).toEqual(["menu"]);
    expect(selectedWord()).toBe("menu");
    expect(within(entry("menu")).getByText(/a list of commands or choices/)).toBeVisible();
    expect(onLookUp).toHaveBeenLastCalledWith("menu", false);

    await search_(user, "D");
    expect(words().map((row) => row.textContent)).toEqual(["desktop", "dictionary", "dock"]);
    expect(onLookUp).toHaveBeenLastCalledWith("desktop", false);
  });

  it("says so when nothing is found, and shows no list for an empty search", async () => {
    const user = userEvent.setup();
    const onLookUp = vi.fn();
    render(<Dictionary onLookUp={onLookUp} />);
    await search_(user, "zebra");
    expect(frame("Dictionary (0 found)")).toBeVisible();
    expect(words()).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No entries found");
    expect(onLookUp).toHaveBeenLastCalledWith(null, false);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(field()).toHaveValue("");
    expect(frame("Dictionary")).toBeVisible();
    expect(words()).toHaveLength(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("narrows the list to the source of the scope bar, and shows every source under All", async () => {
    const user = userEvent.setup();
    render(<Dictionary />);
    await user.click(scope("Thesaurus"));
    expect(scope("Thesaurus")).toBeChecked();
    expect(frame("Dictionary (1 found)")).toBeVisible();
    expect(
      within(entry("computer")).getByRole("button", { name: "PC" }).parentElement,
    ).toHaveTextContent(/PC, laptop, desktop/);
    expect(within(entry("computer")).queryByText(/an electronic device/)).not.toBeInTheDocument();

    await user.click(scope("Apple"));
    expect(frame("Dictionary (0 found)")).toBeVisible();

    await user.click(scope("All"));
    expect(frame("Dictionary (32 found)")).toBeVisible();
    const shown = within(entry("computer"));
    expect(
      shown.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Dictionary", "Thesaurus", "Wikipedia"]);
    expect(shown.getByText(/an electronic device/)).toBeVisible();
    expect(shown.getByText(/A computer is a machine/)).toBeVisible();
  });

  it("moves the scope with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Dictionary />);
    await user.click(scope("Dictionary"));
    await user.keyboard("{ArrowRight}");
    expect(scope("Thesaurus")).toBeChecked();
    expect(frame("Dictionary (1 found)")).toBeVisible();
  });
});

describe("the word list and the history", () => {
  it("a word with only a status shows it in the entry's region, named for the word", () => {
    // The region is the web view's (its title), so a status-only entry has it too: the
    // desktop's tests find a missing word's status inside "Entry for <word>".
    render(
      <Dictionary entries={[{ word: "sere", status: "No entries found" }]} defaultQuery="sere" />,
    );
    expect(within(entry("sere")).getByRole("status")).toHaveTextContent("No entries found");
  });
  it("shows the entry of the word that is chosen, and goes back and forward", async () => {
    const user = userEvent.setup();
    const onLookUp = vi.fn();
    render(<Dictionary onLookUp={onLookUp} />);
    await user.click(word("computer game"));
    expect(selectedWord()).toBe("computer game");
    expect(within(entry("computer game")).getByText(/a game played on a computer/)).toBeVisible();
    expect(onLookUp).toHaveBeenLastCalledWith("computer game", true);
    expect(field()).toHaveValue("computer");

    await search_(user, "aqua");
    expect(selectedWord()).toBe("aqua");

    const back = screen.getByRole("button", { name: "Back" });
    const forward = screen.getByRole("button", { name: "Forward" });
    expect(forward).toHaveAttribute("aria-disabled", "true");
    await user.click(back);
    expect(field()).toHaveValue("computer");
    expect(selectedWord()).toBe("computer game");
    await user.click(back);
    expect(selectedWord()).toBe("computer");
    expect(back).toHaveAttribute("aria-disabled", "true");
    await user.click(forward);
    await user.click(forward);
    expect(field()).toHaveValue("aqua");
    expect(entry("aqua")).toBeVisible();
    expect(forward).toHaveAttribute("aria-disabled", "true");
  });

  it("choosing the word a typed search shows makes a step that Back returns from", async () => {
    const user = userEvent.setup();
    const onLookUp = vi.fn();
    render(<Dictionary onLookUp={onLookUp} />);
    await user.click(word("computer game"));
    await search_(user, "aqua");
    expect(selectedWord()).toBe("aqua");
    expect(onLookUp).toHaveBeenLastCalledWith("aqua", false);
    const back = screen.getByRole("button", { name: "Back" });
    // The typed search is one step; choosing its shown word commits it as another, and is a
    // look-up the host hears of.
    onLookUp.mockClear();
    await user.click(word("aqua"));
    expect(onLookUp).toHaveBeenCalledWith("aqua", true);
    expect(selectedWord()).toBe("aqua");
    expect(back).toHaveAttribute("aria-disabled", "false");
    await user.click(back);
    expect(field()).toHaveValue("aqua");
    await user.click(back);
    expect(selectedWord()).toBe("computer game");
    // Choosing it again from a chosen step makes no further step.
    await user.click(screen.getByRole("button", { name: "Forward" }));
    await user.click(screen.getByRole("button", { name: "Forward" }));
    await user.click(word("aqua"));
    expect(screen.getByRole("button", { name: "Forward" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(back);
    expect(field()).toHaveValue("aqua");
    await user.click(back);
    expect(selectedWord()).toBe("computer game");
  });

  it("follows the arrow keys and type-select in the list", async () => {
    const user = userEvent.setup();
    render(<Dictionary />);
    await user.click(word("computer"));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(selectedWord()).toBe("computer animation");
    expect(entry("computer animation")).toBeVisible();
    await user.keyboard("{End}");
    expect(selectedWord()).toBe("computerphobia");
  });

  it("drops the steps ahead when a search is typed after going back", async () => {
    const user = userEvent.setup();
    render(<Dictionary />);
    await user.click(word("computer game"));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Forward" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    await search_(user, "aqua");
    expect(selectedWord()).toBe("aqua");
    expect(screen.getByRole("button", { name: "Forward" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Back" })).toHaveAttribute("aria-disabled", "true");
  });

  it("drops the steps ahead when a word is chosen after going back", async () => {
    const user = userEvent.setup();
    render(<Dictionary />);
    await user.click(word("computer game"));
    await user.click(word("computer virus"));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(word("computerese"));
    expect(screen.getByRole("button", { name: "Forward" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(selectedWord()).toBe("computer game");
  });

  it("Back shows the word an empty search showed, though the recent list changed since", async () => {
    const user = userEvent.setup();
    // An empty search shows the first recent look-up: "aqua" here.
    const { rerender } = render(<Dictionary defaultQuery="" recent={["aqua", "desktop"]} />);
    expect(entry("aqua")).toBeVisible();
    await user.click(word("desktop"));
    expect(entry("desktop")).toBeVisible();
    // Choosing "desktop" made it the latest look-up, so it now heads the recent list.
    rerender(<Dictionary defaultQuery="" recent={["desktop", "aqua"]} />);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(selectedWord()).toBe("aqua");
    expect(entry("aqua")).toBeVisible();
  });

  it("Back from a Look Up shows the word the empty search showed before it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Dictionary defaultQuery="" recent={["aqua", "desktop"]} />);
    expect(entry("aqua")).toBeVisible();
    rerender(
      <Dictionary
        defaultQuery=""
        recent={["aqua", "desktop"]}
        lookUpRequest={{ word: "desktop", n: 1 }}
      />,
    );
    expect(entry("desktop")).toBeVisible();
    // The look-up moved "desktop" to the front of the recent look-ups.
    rerender(
      <Dictionary
        defaultQuery=""
        recent={["desktop", "aqua"]}
        lookUpRequest={{ word: "desktop", n: 1 }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(field()).toHaveValue("");
    expect(entry("aqua")).toBeVisible();
  });
});

describe("the text size", () => {
  it("grows and shrinks the entry's text between its limits", async () => {
    const user = userEvent.setup();
    render(<Dictionary />);
    const scale = () => entry("computer").style.getPropertyValue("--mac-dictionary-text-scale");
    const smaller = screen.getByRole("button", { name: "Decrease text size" });
    const larger = screen.getByRole("button", { name: "Increase text size" });
    expect(scale()).toBe("1");
    await user.click(larger);
    expect(scale()).toBe("1.15");
    await user.click(smaller);
    await user.click(smaller);
    await user.click(smaller);
    expect(scale()).toBe("0.8");
    expect(smaller).toHaveAttribute("aria-disabled", "true");
    expect(larger).toHaveAttribute("aria-disabled", "false");
  });
});

describe("the data", () => {
  it("finds the 32 headwords of the captures in the list's order", () => {
    const found = search(defaultEntries, "computer", "dictionary").map((item) => item.word);
    expect(found).toHaveLength(32);
    expect(found.slice(0, 5)).toEqual([
      "computer",
      "computer-aided",
      "computer animation",
      "computer animations",
      "computer conferencing",
    ]);
    expect(found.indexOf("computer viruses")).toBe(found.indexOf("computerese") - 1);
  });

  it("ignores case and surrounding space, and finds nothing for nothing", () => {
    expect(search(defaultEntries, " AQ ", "all").map((item) => item.word)).toEqual(["aqua"]);
    expect(search(defaultEntries, "  ", "all")).toEqual([]);
  });

  it("keeps to the entries a source has", () => {
    expect(search(defaultEntries, "d", "apple").map((item) => item.word)).toEqual([
      "desktop",
      "dictionary",
      "dock",
    ]);
    expect(search(defaultEntries, "d", "thesaurus").map((item) => item.word)).toEqual([
      "dictionary",
    ]);
    const dock = defaultEntries.find((item) => item.word === "dock");
    expect(dock && inScope(dock, "wikipedia")).toBe(false);
    expect(dock && inScope(dock, "all")).toBe(true);
  });
});

function MenuBarOfTheDesktop() {
  const file = useDesktopAppMenuItems("dictionary", "File");
  const edit = useDesktopAppMenuItems("dictionary", "Edit");
  const view = useDesktopAppMenuItems("dictionary", "View");
  const go = useDesktopAppMenuItems("dictionary", "Go");
  const none = <MenuItem disabled>None</MenuItem>;
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title="File">{file ?? none}</MenuBarMenu>
      <MenuBarMenu title="Edit">{edit ?? none}</MenuBarMenu>
      <MenuBarMenu title="View">{view ?? none}</MenuBarMenu>
      <MenuBarMenu title="Go">{go ?? none}</MenuBarMenu>
    </MenuBar>
  );
}

describe("the menus and keys", () => {
  const setup = (state: "key" | "inactive" = "key") => {
    render(
      <>
        <MenuBarOfTheDesktop />
        <Dictionary state={state} />
      </>,
    );
    return userEvent.setup();
  };
  const open = async (user: ReturnType<typeof userEvent.setup>, menu: string) =>
    user.click(screen.getByRole("menuitem", { name: menu }));
  const row = (name: string | RegExp) => screen.findByRole("menuitem", { name });
  const scale = () => entry("computer").style.getPropertyValue("--mac-dictionary-text-scale");
  /** Command is the Control key where this runs, which is not an Apple platform. */
  const press = (key: string) => fireEvent.keyDown(window, { key, ctrlKey: true });

  it("Command-[ and Command-] walk the history, only in the key window", async () => {
    const user = setup();
    await search_(user, "d");
    await user.click(word("dock"));
    press("[");
    expect(selectedWord()).toBe("desktop");
    press("]");
    expect(selectedWord()).toBe("dock");
  });

  it("leaves the keys alone in a window that is not key", async () => {
    const user = setup("inactive");
    await search_(user, "d");
    await user.click(word("dock"));
    expect(press("[")).toBe(true);
    expect(selectedWord()).toBe("dock");
  });

  it("View changes the text size, and dims the row at the end of the sizes", async () => {
    const user = setup();
    expect(scale()).toBe("1");
    await open(user, "View");
    await user.click(await row(/^Make Text Bigger/));
    expect(scale()).toBe("1.15");
    press("-");
    press("-");
    press("-");
    expect(scale()).toBe("0.8");
    await open(user, "View");
    expect(await row(/^Make Text Smaller/)).toHaveAttribute("aria-disabled", "true");
  });

  it("File > Print prints a copy of the entry, without its controls", async () => {
    const user = setup();
    await open(user, "File");
    await user.click(await row(/^Print/));
    const frame = document.querySelector<HTMLIFrameElement>("iframe[data-dictionary-print]");
    expect(frame?.dataset.dictionaryPrint).toBe("computer");
    expect(frame?.getAttribute("sandbox")).toBe("allow-same-origin allow-modals");
    expect(frame?.srcdoc).toContain("<title>computer</title>");
    expect(frame?.srcdoc).toContain("an electronic device for storing and processing data");
    frame?.remove();
  });

  it("Edit > Look Up is dimmed with nothing selected, and names the word selected", async () => {
    const user = setup();
    await open(user, "Edit");
    expect(await row("Look Up")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");

    await search_(user, "desktop publishing");
    field().focus();
    (field() as HTMLInputElement).setSelectionRange(0, 7);
    fireEvent(document, new Event("selectionchange"));
    await open(user, "Edit");
    await user.click(await row("Look Up “desktop”"));
    expect(field()).toHaveValue("desktop");
    expect(selectedWord()).toBe("desktop");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(field()).toHaveValue("desktop publishing");
  });

  it("dims Paste with the reason once the browser refuses a menu the clipboard", async () => {
    const user = setup();
    vi.spyOn(navigator.clipboard, "readText").mockRejectedValue(new Error("refused"));
    await open(user, "Edit");
    await user.click(await row(/^Paste/));
    await waitFor(async () => {
      await open(user, "Edit");
      expect(await row(/^Paste/)).toHaveAttribute("aria-disabled", "true");
    });
    expect(await row(/keeps the clipboard from menus/)).toHaveAttribute("aria-disabled", "true");
  });

  it("text selected in the entry can be copied and looked up, and not cut", async () => {
    const user = setup();
    const heading = within(entry("computer")).getByText(/an electronic device/);
    const text = heading.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 3);
    range.setEnd(text, 13);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent(document, new Event("selectionchange"));
    await open(user, "Edit");
    expect(await row(/^Cut/)).toHaveAttribute("aria-disabled", "true");
    expect(await row(/^Undo/)).toHaveAttribute("aria-disabled", "true");
    expect(await row(/^Copy/)).not.toHaveAttribute("aria-disabled", "true");
    await user.click(await row("Look Up “electronic”"));
    await waitFor(() => expect(field()).toHaveValue("electronic"));
  });

  it("Start Speaking reads the selection the entry had when the menu took the focus", async () => {
    const spoken: string[] = [];
    vi.stubGlobal("speechSynthesis", {
      cancel: () => {},
      speak: (utterance: { text: string }) => spoken.push(utterance.text),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    const user = setup();
    const text = within(entry("computer")).getByText(/an electronic device/).firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 3);
    range.setEnd(text, 13);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent(document, new Event("selectionchange"));
    await open(user, "Edit");
    selection?.removeAllRanges();
    fireEvent(document, new Event("selectionchange"));
    await user.click(await row("Speech"));
    fireEvent.click(await row("Start Speaking"));
    expect(spoken).toEqual(["electronic"]);
    vi.unstubAllGlobals();
  });
});
