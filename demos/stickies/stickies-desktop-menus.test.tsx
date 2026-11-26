import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { StickiesNote } from "./stickies";

/*
 * The desktop's menu bar fills a menu of the front application with the items the app's window
 * registered for it (`desktop-app-menus.ts`, read by `desktop-menus.tsx`), and says "This demo
 * has no Font commands" when there are none. The menus here are filled the same way, from the
 * same registry, beside a note.
 */
function DesktopMenus() {
  const font = useDesktopAppMenuItems("stickies", "Font");
  const color = useDesktopAppMenuItems("stickies", "Color");
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title="Font">
        {font ?? <MenuItem disabled>This demo has no Font commands</MenuItem>}
      </MenuBarMenu>
      <MenuBarMenu title="Color">
        {color ?? <MenuItem disabled>This demo has no Color commands</MenuItem>}
      </MenuBarMenu>
    </MenuBar>
  );
}

const text = () => screen.getByRole("textbox");

/** Select `word` in the note's text, with the text focused. */
function select(word: string) {
  const root = text();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = (node.nodeValue ?? "").indexOf(word);
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + word.length);
    root.focus();
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    return;
  }
  throw new Error(`no ${word} in the note`);
}

/** The browser's editing commands, recorded with whether the selection was in the note. */
function recordCommands() {
  const commands: [string, boolean][] = [];
  document.execCommand = (name: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, anchor !== null && text().contains(anchor)]);
    }
    return true;
  };
  return commands;
}

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
});

describe("Font > Styles…", () => {
  it("opens the Styles sheet on the note's styles, and Cancel leaves the note alone", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const commands = recordCommands();
    render(
      <>
        <DesktopMenus />
        <StickiesNote defaultText="First\nsecond words" />
      </>,
    );
    select("second");
    await user.click(screen.getByRole("menuitem", { name: "Font" }));
    await user.click(await screen.findByRole("menuitem", { name: "Styles…" }));
    const sheet = await screen.findByRole("dialog", { name: "Styles" });
    expect(sheet.textContent).toContain("Document Styles");
    expect(commands).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Styles" })).toBeNull());
  });
});

describe("the desktop menu bar's Font and Color menus", () => {
  // Base UI blocks the pointer on the way from a submenu's item to its submenu.
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

  it("style the note's selection and set the note's colour", async () => {
    const user = setup();
    const colour = vi.fn();
    const { rerender } = render(
      <>
        <StickiesNote defaultText={"Groceries\nmilk and bread"} onColorChange={colour} />
        <DesktopMenus />
      </>,
    );
    select("bread");
    const commands = recordCommands();
    await user.click(screen.getByRole("menuitem", { name: "Font" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /^Italic/ }));
    expect(commands).toEqual([["italic", true]]);

    await user.click(screen.getByRole("menuitem", { name: "Color" }));
    const yellow = await screen.findByRole("menuitemradio", { name: "Yellow" });
    expect(yellow).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "Blue" }));
    expect(colour).toHaveBeenCalledWith("blue");

    // The note shown blue: the Color menu checks it.
    rerender(
      <>
        <StickiesNote
          color="blue"
          defaultText={"Groceries\nmilk and bread"}
          onColorChange={colour}
        />
        <DesktopMenus />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "Color" }));
    await waitFor(() =>
      expect(screen.getByRole("menuitemradio", { name: "Blue" })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    await user.keyboard("{Escape}");

    // Closed, the note takes its commands with it.
    rerender(<DesktopMenus />);
    await user.click(screen.getByRole("menuitem", { name: "Font" }));
    expect(await screen.findByText("This demo has no Font commands")).toBeInTheDocument();
  });

  it("leaves the Color menu without commands for a note whose colour cannot change", async () => {
    const user = setup();
    render(
      <>
        <StickiesNote defaultText="A note" />
        <DesktopMenus />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "Color" }));
    expect(await screen.findByText("This demo has no Color commands")).toBeInTheDocument();
  });
});
