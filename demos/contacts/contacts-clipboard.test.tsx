import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { Contacts } from "./contacts";
import type { Contact } from "./contacts-data";
import { cardsToVCard } from "./contacts-vcard";

const ADA: Contact = { id: "ada", account: "icloud", first: "Ada", last: "Marsh" };
const BEN: Contact = { id: "ben", account: "icloud", first: "Ben", last: "Abbot" };
const MINE: Contact = { id: "mine", account: "icloud", first: "Chris", last: "Vale", me: true };

function EditMenu() {
  const items = useDesktopAppMenuItems("contacts", "Edit");
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="Edit">{items}</MenuBarMenu>
    </MenuBar>
  );
}

function open(contacts: readonly Contact[], chosen: string) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <>
      <EditMenu />
      <Contacts defaultContacts={contacts} defaultContact={chosen} />
    </>,
  );
  return user;
}

function clipboard(value: Partial<Clipboard>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

const names = () =>
  within(screen.getByRole("listbox", { hidden: true }))
    .getAllByRole("option", { hidden: true })
    .map((row) => row.textContent);
const item = (name: RegExp) => screen.findByRole("menuitem", { name });
async function choose(user: ReturnType<typeof open>, name: RegExp) {
  await user.click(screen.getByRole("menuitem", { name: "Edit" }));
  await user.click(await item(name));
}

afterEach(() => {
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("Contacts' Cut", () => {
  it("puts the card on the clipboard as a vCard and takes it from the list, and Undo Cut brings it back", async () => {
    const user = open([ADA, BEN], "ada");
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard({ writeText });
    await choose(user, /^Cut/);
    await waitFor(() => expect(names()).toEqual(["Ben Abbot"]));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(cardsToVCard([{ contact: ADA }]));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await choose(user, /^Undo Cut/);
    await waitFor(() => expect(names()).toEqual(["Ben Abbot", "Ada Marsh"]));
  });

  it("runs on Command-X", async () => {
    open([ADA, BEN], "ada");
    clipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "x", ctrlKey: true });
    await waitFor(() => expect(names()).toEqual(["Ben Abbot"]));
  });

  it("keeps the card when it could not reach the clipboard, and says so", async () => {
    const user = open([ADA, BEN], "ada");
    clipboard({ writeText: vi.fn().mockRejectedValue(new Error("refused")) });
    await choose(user, /^Cut/);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "The cards could not be put on the clipboard, so they stay.",
    );
    expect(names()).toEqual(["Ben Abbot", "Ada Marsh"]);
  });

  it("asks first about a card with a picture, which neither the clipboard nor Undo brings back", async () => {
    const user = open([{ ...ADA, image: "data:image/png;base64,iVBORw0KGgo=" }, BEN], "ada");
    clipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    await choose(user, /^Cut/);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Ada Marsh");
    expect(names()).toEqual(["Ben Abbot", "Ada Marsh"]);
  });

  it("is dimmed for the person's own card and while a card is edited", async () => {
    const user = open([MINE, ADA], "mine");
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await item(/^Cut/)).toHaveAttribute("aria-disabled", "true");
    expect(await item(/^Paste/)).not.toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.click(
      within(screen.getByRole("listbox")).getByRole("option", { name: "Ada Marsh" }),
    );
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await item(/^Cut/)).toHaveAttribute("aria-disabled", "true");
    expect(await item(/^Paste/)).toHaveAttribute("aria-disabled", "true");
    expect(await item(/^Paste/)).toHaveAttribute(
      "title",
      "While a card is edited, Paste is the key's, in the field.",
    );
  });
});

describe("Contacts' Paste", () => {
  it("adds the cards on the clipboard and shows the first, and Undo Paste takes them back", async () => {
    const user = open([BEN], "ben");
    clipboard({ readText: vi.fn().mockResolvedValue(cardsToVCard([{ contact: ADA }])) });
    await choose(user, /^Paste/);
    await waitFor(() => expect(names()).toEqual(["Ben Abbot", "Ada Marsh"]));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Ada Marsh");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await choose(user, /^Undo Paste/);
    await waitFor(() => expect(names()).toEqual(["Ben Abbot"]));
  });

  it("runs on Command-V, and leaves the key to a text field", async () => {
    open([BEN], "ben");
    const readText = vi.fn().mockResolvedValue(cardsToVCard([{ contact: ADA }]));
    clipboard({ readText });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "v", ctrlKey: true });
    expect(readText).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "v", ctrlKey: true });
    await waitFor(() => expect(names()).toEqual(["Ben Abbot", "Ada Marsh"]));
  });

  it("says so when the clipboard holds no card", async () => {
    const user = open([BEN], "ben");
    clipboard({ readText: vi.fn().mockResolvedValue("just some words") });
    await choose(user, /^Paste/);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "The clipboard holds no cards.",
    );
    expect(names()).toEqual(["Ben Abbot"]);
  });

  it("says so when the browser refuses to read the clipboard", async () => {
    const user = open([BEN], "ben");
    clipboard({ readText: vi.fn().mockRejectedValue(new Error("denied")) });
    await choose(user, /^Paste/);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "The clipboard could not be read.",
    );
  });
});
