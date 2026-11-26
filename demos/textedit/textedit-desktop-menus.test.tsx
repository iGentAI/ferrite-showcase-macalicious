import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, describe, expect, it } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { TextEdit } from "./textedit";

/*
 * The desktop's menu bar fills a menu of the front application with the items the app's window
 * registered for it (`desktop-app-menus.ts`, read by `desktop-menus.tsx`), and says "This demo
 * has no Format commands" when there are none. The menu here is filled the same way, from the
 * same registry, beside the TextEdit window.
 */
function DesktopMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("textedit", title);
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title={title}>
        {items ?? <MenuItem disabled>This demo has no {title} commands</MenuItem>}
      </MenuBarMenu>
    </MenuBar>
  );
}

const documentView = () => screen.getByRole("textbox", { name: "Document" });

/**
 * Add a plain line with `word` at the end of the document and select the word, with the view
 * focused: a word no style applies to yet.
 */
function selectNewWord(word: string) {
  const root = documentView();
  const line = document.createElement("div");
  line.textContent = word;
  root.append(line);
  const range = document.createRange();
  range.selectNodeContents(line.firstChild as Text);
  root.focus();
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

/** The browser's editing commands, recorded with whether the selection was in the document. */
function recordCommands() {
  const commands: [string, boolean][] = [];
  document.execCommand = (name: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, anchor !== null && documentView().contains(anchor)]);
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

  it("styles the document's selection from Font > Bold and converts it with Make Plain Text", async () => {
    const user = setup();
    const { rerender } = render(
      <>
        <TextEdit />
        <DesktopMenu title="Format" />
      </>,
    );
    selectNewWord("Quillwort");
    const commands = recordCommands();
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    expect(screen.queryByText("This demo has no Format commands")).toBeNull();
    await user.hover(await screen.findByRole("menuitem", { name: "Font" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Bold/ }));
    await waitFor(() => expect(commands).toEqual([["bold", true]]));

    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Make Plain Text/ }));
    await user.click(await screen.findByRole("button", { name: "OK" }));
    // A plain text document is a text area; its Format menu offers Make Rich Text, with the
    // Font and Text submenus dimmed.
    await waitFor(() => expect(documentView().tagName).toBe("TEXTAREA"));
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    expect(await screen.findByRole("menuitem", { name: /^Make Rich Text/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Font" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");

    // Closed, the window takes its commands with it.
    rerender(<DesktopMenu title="Format" />);
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    expect(await screen.findByText("This demo has no Format commands")).toBeInTheDocument();
  });

  it("opens the Fonts panel from Font > Show Fonts", async () => {
    const user = setup();
    render(
      <>
        <TextEdit />
        <DesktopMenu title="Format" />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Font" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Show Fonts/ }));
    expect(await screen.findByRole("region", { name: "Fonts" })).toBeInTheDocument();
  });
});
