import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, describe, expect, it } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { Notes } from "./notes";

/*
 * The desktop's menu bar fills a menu of the front application with the items the app's window
 * registered for it (`desktop-app-menus.ts`, read by `desktop-menus.tsx`), and says "This demo
 * has no Format commands" when there are none. The menu here is filled the same way, from the
 * same registry, beside the Notes window.
 */
function DesktopMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("notes", title);
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title={title}>
        {items ?? <MenuItem disabled>This demo has no {title} commands</MenuItem>}
      </MenuBarMenu>
    </MenuBar>
  );
}

/** The editor of the note shown (the editors of notes shown before stay, hidden). */
const editor = () => {
  const shown = screen
    .getAllByRole("textbox", { name: "Note" })
    .find((each) => !each.closest("[hidden]"));
  if (!shown) throw new Error("no note shown");
  return shown;
};

/**
 * Add a plain line with `word` at the end of the note shown and select the word, with the note
 * focused: a word no style applies to yet.
 */
function selectNewWord(word: string) {
  const root = editor();
  const line = document.createElement("div");
  line.textContent = word;
  root.append(line);
  const range = document.createRange();
  range.selectNodeContents(line.firstChild as Text);
  root.focus();
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

/** The browser's editing commands, recorded with whether the selection was in the note. */
function recordCommands() {
  const commands: [string, boolean][] = [];
  document.execCommand = (name: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, anchor !== null && editor().contains(anchor)]);
    }
    return true;
  };
  return commands;
}

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
});

describe("the desktop menu bar's Format menu", () => {
  // Base UI blocks the pointer on the way from a submenu's item to its submenu. The submenus are
  // opened by hovering their item; their items are then activated with a click on the element.
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

  it("holds Notes' paragraph styles and its Font and Text submenus while the window is open", async () => {
    const user = setup();
    const { rerender } = render(
      <>
        <Notes />
        <DesktopMenu title="Format" />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    for (const style of ["Title", "Heading", "Body"]) {
      expect(await screen.findByRole("menuitemradio", { name: style })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
    expect(screen.getByRole("menuitem", { name: "Font" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Text" })).toBeInTheDocument();
    expect(screen.queryByText("This demo has no Format commands")).toBeNull();
    await user.keyboard("{Escape}");

    // Closed, the window takes its commands with it.
    rerender(<DesktopMenu title="Format" />);
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    expect(await screen.findByText("This demo has no Format commands")).toBeInTheDocument();
  });

  it("makes the note's selection bold from Font > Bold, with the selection in the note", async () => {
    const user = setup();
    render(
      <>
        <Notes />
        <DesktopMenu title="Format" />
      </>,
    );
    selectNewWord("Quillwort");
    const commands = recordCommands();
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Font" }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /^Bold/ }));
    await waitFor(() => expect(commands).toEqual([["bold", true]]));
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Text" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /^Center/ }));
    await waitFor(() => expect(commands.at(-1)).toEqual(["justifyCenter", true]));
  });
});
