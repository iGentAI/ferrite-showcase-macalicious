import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { NOT_INSTALLED } from "../desktop/desktop-font-panel";
import { Mail } from "./mail";
import { MailCompose } from "./mail-compose";
import { EMPTY_DRAFT, type MailDraft } from "./mail-data";
import { MailEditItems } from "./mail-menus";

/*
 * Mail's New Message window on the editors' shared path: the desktop's Edit menu
 * (`EditorEditItems`, as Notes, TextEdit and Stickies have it) and the Fonts panel that dims the
 * families this browser cannot draw (`DesktopFontPanel`). jsdom has no editing commands and
 * measures no text: the browser's commands are recorded, and the font check is stood in for, with
 * Georgia missing. e2e/mail-compose-editor-journey.mjs measures both in the three engines.
 */

vi.mock("../desktop/font-family-check", async (original) => ({
  ...(await original<typeof import("../desktop/font-family-check")>()),
  familyRenders: (name: string) => name !== "Georgia",
}));

const DRAFT: MailDraft = { ...EMPTY_DRAFT, subject: "Pier", body: "Low at six.\nHigh at noon." };
const messageView = () => screen.getByRole("textbox", { name: "Message" });
const item = (name: string) =>
  screen.findByRole("menuitem", { name: new RegExp(`^${name}(?! and| as)`) });
const dimmed = async (name: string) => (await item(name)).getAttribute("aria-disabled") === "true";

/** The browser's editing commands, recorded with their value and whether they acted in the message. */
function recordCommands() {
  const commands: [string, string | undefined, boolean][] = [];
  document.execCommand = (name: string, _ui?: boolean, value?: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, value, anchor !== null && messageView().contains(anchor)]);
    }
    return true;
  };
  return commands;
}

/** Select `word` in the message, the message focused, as a drag would. */
function select(word: string) {
  const root = messageView();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.nodeValue?.indexOf(word) ?? -1;
    if (at < 0) continue;
    root.focus();
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + word.length);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    // jsdom does not report it: the browser would.
    document.dispatchEvent(new Event("selectionchange"));
    return;
  }
  throw new Error(`no "${word}" in the message`);
}

/** The desktop's Edit menu, filled from what the window last used registers. */
function EditMenu() {
  const items = useDesktopAppMenuItems("mail", "Edit");
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="Edit">{items}</MenuBarMenu>
    </MenuBar>
  );
}

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("the New Message window's Edit menu in the desktop menu bar", () => {
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
  const openEdit = (user: ReturnType<typeof setup>) =>
    user.click(screen.getByRole("menuitem", { name: "Edit" }));

  it("runs Copy, Cut, Undo and Redo on the message's selection, and Select All selects the whole message", async () => {
    const user = setup();
    render(
      <>
        <EditMenu />
        <MailCompose defaultDraft={DRAFT} />
      </>,
    );
    select("Low");
    const commands = recordCommands();
    for (const [name, command] of [
      ["Copy", "copy"],
      ["Cut", "cut"],
      ["Undo", "undo"],
      ["Redo", "redo"],
    ] as const) {
      await openEdit(user);
      expect(await dimmed(name)).toBe(false);
      await user.click(await item(name));
      expect(commands.at(-1)).toEqual([command, undefined, true]);
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    }
    await openEdit(user);
    await user.click(await item("Select All"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(messageView()).toHaveFocus());
    expect(document.getSelection()?.toString()).toBe(messageView().textContent);
  });

  it("pastes the clipboard's formatted text into the message, rebuilt, where the selection was", async () => {
    const user = setup();
    render(
      <>
        <EditMenu />
        <MailCompose defaultDraft={DRAFT} />
      </>,
    );
    const html = '<b>Pasted</b><img src="x" onerror="alert(1)">';
    Object.defineProperty(navigator, "clipboard", {
      value: {
        read: vi.fn(async () => [
          {
            types: ["text/html", "text/plain"],
            getType: async (type: string) => ({
              text: async () => (type === "text/html" ? html : "Pasted"),
            }),
          },
        ]),
        readText: vi.fn(async () => "Pasted"),
      },
      configurable: true,
    });
    select("noon");
    const commands = recordCommands();
    await openEdit(user);
    await user.click(await item("Paste"));
    await waitFor(() => expect(commands.some(([name]) => name === "insertHTML")).toBe(true));
    const [, inserted, inMessage] = commands.find(([name]) => name === "insertHTML") ?? [];
    expect(inserted).toContain("<b>Pasted</b>");
    expect(inserted).not.toMatch(/img|onerror/);
    expect(inMessage).toBe(true);
  });

  it("dims every item while the message is being sent or held, the window being inert", async () => {
    const user = setup();
    for (const frozen of [{ sending: true }, { held: true }]) {
      const view = render(
        <>
          <EditMenu />
          <MailCompose defaultDraft={DRAFT} {...frozen} />
        </>,
      );
      select("Low");
      expect(messageView().closest("[inert]")).not.toBeNull();
      await openEdit(user);
      for (const name of ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"]) {
        expect(await dimmed(name)).toBe(true);
      }
      await user.keyboard("{Escape}");
      view.unmount();
    }
  });

  it("gives the desktop's Edit menu the viewer's commands while the viewer is the window last used", async () => {
    function Items() {
      const items = useDesktopAppMenuItems("mail", "Edit") as ReactElement | undefined;
      return (
        <output aria-label="Edit items">
          {items?.type === MailEditItems ? "viewer" : "message"}
        </output>
      );
    }
    render(
      <>
        <Items />
        <Mail />
      </>,
    );
    const items = () => screen.getByRole("status", { name: "Edit items" });
    await waitFor(() => expect(items()).toHaveTextContent("viewer"));
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    await waitFor(() => expect(items()).toHaveTextContent("message"));
    const viewer = screen.getByRole("region", { name: /messages?\)|Searching/ });
    fireEvent.pointerDown(within(viewer).getByRole("button", { name: "Get Mail" }));
    await waitFor(() => expect(items()).toHaveTextContent("viewer"));
  });
});

describe("the New Message window's Fonts panel", () => {
  it("dims the families this browser cannot draw, with the reason, and they cannot be chosen", async () => {
    const commands = recordCommands();
    render(<MailCompose defaultDraft={DRAFT} />);
    select("Low");
    fireEvent.keyDown(messageView(), { key: "t", ctrlKey: true });
    const fonts = await screen.findByRole("region", { name: "Fonts" });
    const family = (name: string) =>
      within(within(fonts).getByRole("listbox", { name: "Family" })).getByRole("option", { name });
    await waitFor(() => expect(family("Georgia")).toHaveAttribute("aria-disabled", "true"));
    expect(family("Helvetica")).not.toHaveAttribute("aria-disabled");
    expect(within(fonts).getByRole("note")).toHaveTextContent(NOT_INSTALLED);
    fireEvent.mouseDown(family("Georgia"));
    fireEvent.click(family("Georgia"));
    expect(commands.filter(([, value]) => value?.includes("Georgia"))).toEqual([]);
  });
});
