import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { createFileSystem, type FinderNode, HOME, resolve } from "./finder-data";
import { FINDER_INFO_HOST, FinderInfo, ITEM_FLAGS_NOT_KEPT } from "./finder-info";
import { FinderQuickLook } from "./finder-quick-look";

const PDF = `${HOME}/Documents/Aqua and Bondi.pdf`;
const PICTURE = `${HOME}/Downloads/10-9.jpg`;
const root = createFileSystem();

const button = (name: string | RegExp) => screen.getByRole("button", { name });
/** A tool of a toolbar that is disabled stays reachable, so it may carry `aria-disabled`. */
const unavailable = (name: string) =>
  button(name).hasAttribute("disabled") || button(name).getAttribute("aria-disabled") === "true";

/** The value the Info window shows beside a label. */
function fact(label: string) {
  const term = screen.getAllByRole("term").find((entry) => entry.textContent === label);
  return term?.nextElementSibling?.textContent;
}

/** The rows of the permissions list, each as its cells' texts. */
function permissions() {
  const list = screen.getByRole("grid", { name: "Sharing & Permissions" });
  return within(list)
    .getAllByRole("row")
    .map((row) =>
      within(row)
        .queryAllByRole("gridcell")
        .map((cell) => cell.textContent),
    )
    .filter((cells) => cells.length > 0);
}

describe("Get Info", () => {
  it("shows the facts of a document in the sections of Finder's Info window", () => {
    render(<FinderInfo root={root} path={PDF} />);
    const panel = screen.getByRole("region", { name: "Aqua and Bondi.pdf Info" });
    expect(within(panel).getByText("31.7 MB")).toBeInTheDocument();
    expect(within(panel).getByText("Modified: June 3, 2019 at 8:31 AM")).toBeInTheDocument();

    expect(fact("Kind:")).toBe("PDF Document");
    expect(fact("Size:")).toBe("31,700,000 bytes (31.7 MB on disk)");
    expect(fact("Where:")).toBe("Macintosh SSD ▸ Users ▸ shackett ▸ Documents");
    expect(fact("Created:")).toBe("December 31, 2016 at 1:17 PM");
    expect(fact("Modified:")).toBe("June 3, 2019 at 8:31 AM");
    expect(fact("Last opened:")).toBe("Jun 3, 2019 at 8:31 AM");
    expect(fact("Pages:")).toBe("81");
    expect(fact("Encoding software:")).toBe("Mac OS X 10.10.5 Quartz PDFContext");
    expect(fact("Dimensions:")).toBeUndefined();

    const name = screen.getByRole("textbox", { name: "Name & Extension" });
    expect(name).toHaveValue("Aqua and Bondi.pdf");
    expect(name).toHaveAttribute("readonly");

    for (const title of ["General:", "More Info:", "Open with:", "Sharing & Permissions:"]) {
      expect(button(title)).toHaveAttribute("aria-expanded", "true");
    }
    expect(button("Comments:")).toHaveAttribute("aria-expanded", "false");
    expect(button("Preview:")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("You can read and write")).toBeInTheDocument();
    expect(permissions()).toEqual([
      ["shackett (Me)", "Read & Write"],
      ["staff", "Read only"],
      ["everyone", "Read only"],
    ]);
  });

  it("counts the items of a folder, shows a picture's dimensions and leaves out what does not apply", () => {
    const { unmount } = render(<FinderInfo root={root} path={`${HOME}/Documents`} />);
    expect(fact("Kind:")).toBe("Folder");
    expect(fact("Size:")).toBe("5 items");
    expect(fact("Where:")).toBe("Macintosh SSD ▸ Users ▸ shackett");
    expect(screen.queryByRole("button", { name: "Open with:" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("listbox", { name: "Tokens" })).getByText("Green"),
    ).toBeVisible();
    unmount();

    render(<FinderInfo root={root} path={PICTURE} />);
    expect(fact("Kind:")).toBe("JPEG image");
    expect(fact("Dimensions:")).toBe("5120×2880");
    expect(fact("Last opened:")).toBe("May 29, 2018 at 10:33 AM");
    expect(fact("Pages:")).toBeUndefined();
  });

  it("renders nothing for a path that leads to no item", () => {
    const { container } = render(<FinderInfo root={root} path={`${HOME}/Nowhere.txt`} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reports the tags typed into the tags field with the item's path", async () => {
    const user = userEvent.setup();
    const onTagsChange = vi.fn();
    render(<FinderInfo root={root} path={PDF} onTagsChange={onTagsChange} />);
    const tags = screen.getByRole("textbox", { name: "Tags" });
    expect(tags).toHaveAttribute("placeholder", "Add Tags...");
    await user.type(tags, "Work{Enter}");
    expect(onTagsChange).toHaveBeenCalledExactlyOnceWith(PDF, ["Work"]);
  });

  it("names the application that opens the item, the host's first", () => {
    render(<FinderInfo root={root} path={PDF} openers={["TextEdit", "Preview"]} />);
    expect(screen.getByRole("combobox", { name: "Open with" })).toHaveTextContent(
      "TextEdit (default)",
    );
    expect(button("Change All...")).toBeDisabled();
  });

  it("names the application of the item the window is given", () => {
    const { rerender } = render(<FinderInfo root={root} path={PDF} />);
    rerender(<FinderInfo root={root} path={`${HOME}/Documents/Budget.txt`} />);
    expect(screen.getByRole("combobox", { name: "Open with" })).toHaveTextContent(
      "TextEdit (default)",
    );
  });

  it("keeps Sharing & Permissions locked, each control dimmed with its reason", async () => {
    const user = userEvent.setup();
    render(<FinderInfo root={root} path={PDF} host={FINDER_INFO_HOST} />);
    const add = button("Add a group");
    const remove = button("Remove the selected user or group");
    const list = screen.getByRole("grid", { name: "Sharing & Permissions" });
    const lock = button(/lock/);
    for (const control of [add, remove, lock]) {
      expect(control).toBeDisabled();
      expect(control).toHaveAttribute(
        "title",
        "Only you can read and write the files on your drive; they cannot be shared with other users or groups.",
      );
    }
    // Selecting a row opens nothing: the rows stay as they are.
    await user.click(within(list).getByText("staff"));
    expect(remove).toBeDisabled();
    expect(permissions().map((row) => row[0])).toEqual(["shackett (Me)", "staff", "everyone"]);
  });
  it("is the library's panel: it closes through onClose and takes the panel's props", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <FinderInfo
        root={root}
        path={PDF}
        onClose={onClose}
        ref={ref}
        state="inactive"
        className="mine"
        data-testid="info"
      />,
    );
    const panel = screen.getByTestId("info");
    expect(panel).toBe(ref.current);
    expect(panel).toHaveClass("mine");
    expect(panel).toHaveAttribute("data-window-state", "inactive");
    // The window can only be closed.
    expect(button("Minimize")).toBeDisabled();
    expect(button("Zoom")).toBeDisabled();
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

/** The picture with what was drawn on it: its accessible name counts the annotations. */
const picture = () => screen.getByRole("img");

/** Press on the picture, move and release: one stroke of the selected drawing tool. */
async function stroke(user: ReturnType<typeof userEvent.setup>) {
  await user.pointer([
    { keys: "[MouseLeft>]", target: picture() },
    { target: picture(), coords: { x: 20, y: 10 } },
    { keys: "[/MouseLeft]" },
  ]);
}

describe("Quick Look", () => {
  it("shows the item's name and the actions of a picture in Finder's order", () => {
    render(
      <FinderQuickLook
        root={root}
        path={PICTURE}
        onRotate={() => {}}
        onOpen={() => {}}
        onShare={() => {}}
      />,
    );
    const panel = screen.getByRole("dialog", { name: "10-9.jpg" });
    expect(
      within(panel)
        .getAllByRole("button")
        .map((entry) => entry.getAttribute("aria-label") ?? entry.textContent),
    ).toEqual([
      "Close",
      "Enter Full Screen",
      "Rotate Left",
      "Markup",
      "Open with Preview",
      "Share",
    ]);
    expect(picture()).toHaveAccessibleName("10-9.jpg");
    for (const name of ["Rotate Left", "Open with Preview", "Share"]) {
      expect(button(name)).toBeEnabled();
    }
  });

  it("offers what applies to an item that is not a picture, and nothing it cannot do", () => {
    const { rerender } = render(<FinderQuickLook root={root} path={PDF} markup />);
    expect(screen.getByRole("dialog", { name: "Aqua and Bondi.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rotate Left" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Markup" })).not.toBeInTheDocument();
    // Markup is a picture's: the mode does not apply, whatever the owner says.
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // Without the callbacks there is nothing for the buttons to do.
    expect(button("Open with Preview")).toBeDisabled();
    expect(button("Share")).toBeDisabled();

    rerender(<FinderQuickLook root={root} path={`${HOME}/Documents/Budget.txt`} />);
    expect(button("Open with TextEdit")).toBeInTheDocument();
    rerender(<FinderQuickLook root={root} path={`${HOME}/Documents`} />);
    expect(button("Open")).toBeInTheDocument();
    rerender(<FinderQuickLook root={root} path={`${HOME}/Nowhere.txt`} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls back for Rotate Left, Open and Share with the item", async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn();
    const onOpen = vi.fn();
    const onShare = vi.fn();
    render(
      <FinderQuickLook
        root={root}
        path={PICTURE}
        onRotate={onRotate}
        onOpen={onOpen}
        onShare={onShare}
      />,
    );
    await user.click(button("Rotate Left"));
    expect(onRotate).toHaveBeenCalledExactlyOnceWith(PICTURE);

    await user.click(button("Open with Preview"));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(PICTURE, resolve(root, PICTURE));

    await user.click(button("Share"));
    expect(
      (await screen.findAllByRole("menuitem")).map((destination) => destination.textContent),
    ).toEqual(["Mail", "Messages", "AirDrop", "Notes"]);
    await user.click(screen.getByRole("menuitem", { name: "Messages" }));
    expect(onShare).toHaveBeenCalledExactlyOnceWith("Messages", [PICTURE]);
  });

  it("keeps the keyboard focus in the panel when Markup and Done take each other's place", async () => {
    const user = userEvent.setup();
    render(<FinderQuickLook root={root} path={PICTURE} />);
    // Nothing in the panel takes the focus by itself.
    expect(document.body).toHaveFocus();
    await user.click(button("Markup"));
    expect(button("Done")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(button("Markup")).toHaveFocus();
  });

  it("swaps the title for the Markup tools and Done swaps them back", async () => {
    const user = userEvent.setup();
    const onMarkupChange = vi.fn();
    const onRotate = vi.fn();
    render(
      <FinderQuickLook
        root={root}
        path={PICTURE}
        onMarkupChange={onMarkupChange}
        onRotate={onRotate}
      />,
    );
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

    await user.click(button("Markup"));
    expect(onMarkupChange).toHaveBeenLastCalledWith(true);
    const tools = screen.getByRole("toolbar", { name: "Markup" });
    expect(
      within(tools)
        .getAllByRole("button")
        .map((tool) => tool.getAttribute("aria-label")),
    ).toEqual([
      "Sketch",
      "Draw",
      "Shapes",
      "Text",
      "Highlight",
      "Sign",
      "Shape Style",
      "Border Colour",
      "Fill Colour",
      "Text Style",
      "Rotate Left",
      "Crop",
    ]);
    expect(within(tools).getAllByRole("separator")).toHaveLength(2);
    // The panel keeps its name; the full-screen button and the other actions give way to Done.
    expect(screen.getByRole("dialog", { name: "10-9.jpg" })).toBeInTheDocument();
    for (const name of ["Enter Full Screen", "Markup", "Open with Preview"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(button("Share")).toBeInTheDocument();
    // What Markup does not do in the demo is there and cannot be used.
    for (const name of ["Sign", "Text Style", "Crop"]) expect(unavailable(name)).toBe(true);

    await user.click(button("Rotate Left"));
    expect(onRotate).toHaveBeenCalledExactlyOnceWith(PICTURE);

    await user.click(button("Done"));
    expect(onMarkupChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(button("Markup")).toBeInTheDocument();
  });

  it("follows the owner when Markup mode is controlled, and can start in it", async () => {
    const user = userEvent.setup();
    const onMarkupChange = vi.fn();
    const { rerender, unmount } = render(
      <FinderQuickLook root={root} path={PICTURE} markup={false} onMarkupChange={onMarkupChange} />,
    );
    await user.click(button("Markup"));
    expect(onMarkupChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

    rerender(<FinderQuickLook root={root} path={PICTURE} markup onMarkupChange={onMarkupChange} />);
    expect(screen.getByRole("toolbar", { name: "Markup" })).toBeInTheDocument();
    await user.click(button("Done"));
    expect(onMarkupChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("toolbar", { name: "Markup" })).toBeInTheDocument();
    unmount();

    render(<FinderQuickLook root={root} path={PICTURE} defaultMarkup />);
    expect(screen.getByRole("toolbar", { name: "Markup" })).toBeInTheDocument();
  });

  it("has one drawing tool selected at a time, Sketch at first", async () => {
    const user = userEvent.setup();
    render(<FinderQuickLook root={root} path={PICTURE} defaultMarkup />);
    const pressed = () =>
      ["Sketch", "Draw", "Highlight"].filter(
        (name) => button(name).getAttribute("aria-pressed") === "true",
      );
    expect(pressed()).toEqual(["Sketch"]);
    await user.click(button("Draw"));
    expect(pressed()).toEqual(["Draw"]);
    await user.click(button("Highlight"));
    expect(pressed()).toEqual(["Highlight"]);
    // Text and Shapes add something; they are not a mode.
    expect(button("Text")).not.toHaveAttribute("aria-pressed");
    expect(button("Shapes")).not.toHaveAttribute("aria-pressed");
  });

  it("draws one stroke at a time: a second finger does not start, move or end it", async () => {
    const user = userEvent.setup();
    render(<FinderQuickLook root={root} path={PICTURE} defaultMarkup />);
    await user.pointer([
      { keys: "[TouchA>]", target: picture() },
      { keys: "[TouchB>]", target: picture() },
      { keys: "[/TouchB]" },
    ]);
    expect(picture()).toHaveAccessibleName("10-9.jpg, 1 annotation");
    // The first finger is still drawing after the second has gone: no other stroke starts.
    await user.pointer([{ keys: "[TouchB>]", target: picture() }, { keys: "[/TouchB]" }]);
    expect(picture()).toHaveAccessibleName("10-9.jpg, 1 annotation");
    // Once it is lifted, the next press draws the next stroke.
    await user.pointer([{ keys: "[/TouchA]" }, { keys: "[TouchB>]", target: picture() }]);
    expect(picture()).toHaveAccessibleName("10-9.jpg, 2 annotations");
  });

  it("gives the preview the picture's own shape, and 16 to 9 without dimensions", () => {
    const shaped = (dimensions?: string): FinderNode => ({
      name: "",
      kind: "volume",
      children: [{ name: "Tower.jpg", kind: "image", dimensions }],
    });
    const ratio = () =>
      (
        document.querySelector(".mac-finder-quick-look-stage") as HTMLElement
      ).style.getPropertyValue("--_ratio");
    const { rerender } = render(<FinderQuickLook root={shaped("1000×2000")} path="/Tower.jpg" />);
    expect(ratio()).toBe("1000 / 2000");
    rerender(<FinderQuickLook root={shaped(" 640 x 480.5 ")} path="/Tower.jpg" />);
    expect(ratio()).toBe("640 / 480.5");
    // Anything that is not a pair of positive numbers is no shape to follow.
    for (const dimensions of [undefined, "-100×200", "1000×0", "wide", "100×200×300"]) {
      rerender(<FinderQuickLook root={shaped(dimensions)} path="/Tower.jpg" />);
      expect(ratio()).toBe("16 / 9");
    }
  });

  it("ends a stroke with the picture it is drawn on, so that the next picture can be drawn on", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FinderQuickLook root={root} path={PICTURE} defaultMarkup />);
    await user.pointer([{ keys: "[TouchA>]", target: picture() }]);
    expect(picture()).toHaveAccessibleName("10-9.jpg, 1 annotation");
    // The panel shows a document while the finger is down, then the picture again.
    rerender(<FinderQuickLook root={root} path={PDF} defaultMarkup />);
    rerender(<FinderQuickLook root={root} path={PICTURE} defaultMarkup />);
    await user.pointer([{ keys: "[TouchB>]", target: picture() }]);
    expect(picture()).toHaveAccessibleName("10-9.jpg, 2 annotations");
  });

  it("adds an annotation for a stroke, a shape and a text, and keeps them after Done", async () => {
    const user = userEvent.setup();
    render(<FinderQuickLook root={root} path={PICTURE} />);
    // Outside Markup mode the pointer draws nothing.
    await stroke(user);
    expect(picture()).toHaveAccessibleName("10-9.jpg");

    await user.click(button("Markup"));
    expect(picture()).toHaveAccessibleName("10-9.jpg, 0 annotations");

    await stroke(user);
    expect(picture()).toHaveAccessibleName("10-9.jpg, 1 annotation");
    await user.click(button("Highlight"));
    await stroke(user);
    expect(picture()).toHaveAccessibleName("10-9.jpg, 2 annotations");

    await user.click(button("Shapes"));
    expect((await screen.findAllByRole("menuitem")).map((shape) => shape.textContent)).toEqual([
      "Rectangle",
      "Oval",
      "Line",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "Oval" }));
    expect(picture()).toHaveAccessibleName("10-9.jpg, 3 annotations");

    await user.click(button("Text"));
    expect(picture()).toHaveAccessibleName("10-9.jpg, 4 annotations");
    const text = screen.getByRole("textbox", { name: "Text annotation 4" });
    expect(text).toHaveValue("Text");
    await user.clear(text);
    await user.type(text, "Surf");
    expect(text).toHaveValue("Surf");

    await user.click(button("Done"));
    expect(picture()).toHaveAccessibleName("10-9.jpg, 4 annotations");
    expect(screen.getByRole("textbox", { name: "Text annotation 4" })).toHaveAttribute("readonly");
  });

  it("sets the colours and the line width of what is drawn next from the tools' menus", async () => {
    const user = userEvent.setup();
    render(<FinderQuickLook root={root} path={PICTURE} defaultMarkup />);
    const checked = async (tool: string) => {
      await user.click(button(tool));
      const choices = await screen.findAllByRole("menuitemradio");
      return {
        names: choices.map((choice) => choice.textContent),
        chosen: choices
          .filter((choice) => choice.getAttribute("aria-checked") === "true")
          .map((choice) => choice.textContent),
      };
    };
    const choose = (name: string) => user.click(screen.getByRole("menuitemradio", { name }));

    const border = await checked("Border Colour");
    expect(border.names).toEqual(["Black", "White", "Red", "Yellow", "Green", "Blue"]);
    expect(border.chosen).toEqual(["Black"]);
    await choose("Red");
    expect((await checked("Border Colour")).chosen).toEqual(["Red"]);
    await choose("Red");

    const fill = await checked("Fill Colour");
    expect(fill.names[0]).toBe("None");
    expect(fill.chosen).toEqual(["None"]);
    await choose("Yellow");
    expect((await checked("Fill Colour")).chosen).toEqual(["Yellow"]);
    await choose("Yellow");

    const width = await checked("Shape Style");
    expect(width.names).toEqual(["Thin", "Medium", "Thick"]);
    expect(width.chosen).toEqual(["Medium"]);
    await choose("Thick");
    expect((await checked("Shape Style")).chosen).toEqual(["Thick"]);
  });

  it("closes through onClose from the close button and on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FinderQuickLook root={root} path={PICTURE} onShare={() => {}} onClose={onClose} />);
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape in an open menu closes the menu and leaves the panel open.
    await user.click(button("Share"));
    await screen.findByRole("menuitem", { name: "Mail" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);

    button("Markup").focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("takes the panel's props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FinderQuickLook
        root={root}
        path={PICTURE}
        ref={ref}
        state="main"
        className="mine"
        width={600}
      />,
    );
    const panel = screen.getByRole("dialog", { name: "10-9.jpg" });
    expect(panel).toBe(ref.current);
    expect(panel).toHaveClass("mine");
    expect(panel).toHaveAttribute("data-window-state", "main");
    expect(panel).toHaveStyle({ width: "600px" });
  });
});

describe("Get Info's Stationery pad, Locked and Hide extension", () => {
  it("are dimmed with the reason, since no file system here keeps them, and a click ticks none", async () => {
    const user = userEvent.setup();
    render(<FinderInfo root={root} path={PDF} />);
    for (const name of ["Stationery pad", "Locked", "Hide extension"]) {
      const box = screen.getByRole("checkbox", { name });
      expect(
        box.hasAttribute("disabled") ||
          box.getAttribute("aria-disabled") === "true" ||
          box.hasAttribute("data-disabled"),
      ).toBe(true);
      await user.click(box);
      expect(box).toHaveAttribute("aria-checked", "false");
    }
    expect(screen.getAllByTitle(ITEM_FLAGS_NOT_KEPT)).toHaveLength(3);
  });

  it("are the host's to keep where it says so: enabled, and each change reported with the path", async () => {
    const user = userEvent.setup();
    const onFlagChange = vi.fn();
    render(<FinderInfo root={root} path={PDF} onFlagChange={onFlagChange} />);
    expect(screen.queryAllByTitle(ITEM_FLAGS_NOT_KEPT)).toHaveLength(0);
    await user.click(screen.getByRole("checkbox", { name: "Locked" }));
    await user.click(screen.getByRole("checkbox", { name: "Hide extension" }));
    expect(onFlagChange.mock.calls).toEqual([
      [PDF, "locked", true],
      [PDF, "hideExtension", true],
    ]);
  });
});
