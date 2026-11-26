import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { takeOpenUrlRequests } from "../desktop/desktop-open-url";
import { TextEdit, type TextEditActions } from "./textedit";

const view = () => screen.getByRole("textbox", { name: "Document" });

/** Selects `word` in the rich text, then opens the menu with a secondary click on the text. */
function openMenuOn(word: string | null) {
  const node = view();
  act(() => node.focus());
  const selection = document.getSelection();
  selection?.removeAllRanges();
  if (word) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const at = text.nodeValue?.indexOf(word) ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + word.length);
      selection?.addRange(range);
      break;
    }
  }
  fireEvent.contextMenu(node);
}

afterEach(() => {
  vi.unstubAllGlobals();
  takeOpenUrlRequests();
});

const item = (name: string | RegExp) => screen.findByRole("menuitem", { name });

describe("the context menu of the text", () => {
  it("lists its commands, with the selection named", async () => {
    render(<TextEdit />);
    openMenuOn("crazy");
    await item("Look Up “crazy”");
    // Key equivalents are in the DOM and hidden by CSS; jsdom has no clipboard, so Paste's reason
    // shows.
    const names = screen
      .getAllByRole("menuitem")
      .map((each) => each.textContent?.replace(/[⌘⇧⌥].*$/, ""))
      .filter((name) => !name?.startsWith("This browser"));
    expect(names).toEqual([
      "Look Up “crazy”",
      "Search with Google",
      "Undo",
      "Redo",
      "Cut",
      "Copy",
      "Paste",
      "Select All",
      "Services",
      "Font",
      "Spelling and Grammar",
      "Substitutions",
      "Speech",
    ]);
  });

  it("dims Look Up and Search with Google with nothing selected", async () => {
    render(<TextEdit />);
    openMenuOn(null);
    expect(await item("Look Up")).toHaveAttribute("aria-disabled", "true");
    expect(await item("Search with Google")).toHaveAttribute("aria-disabled", "true");
  });

  it("asks Safari for a Google search of the selection", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    openMenuOn("crazy ones");
    await user.click(await item("Search with Google"));
    expect(takeOpenUrlRequests()).toEqual([
      { url: "https://www.google.com/search?q=crazy%20ones", from: "textedit" },
    ]);
  });

  it("speaks the selection, and the whole text without one", async () => {
    const user = userEvent.setup();
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    render(<TextEdit />);
    openMenuOn("crazy");
    await user.hover(await item("Speech"));
    fireEvent.click(await item("Start Speaking"));
    expect(speak.mock.calls[0]?.[0].text).toBe("crazy");
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Speech" })).toBeNull());
    openMenuOn(null);
    await user.hover(await item("Speech"));
    fireEvent.click(await item("Start Speaking"));
    expect(speak.mock.calls[1]?.[0].text).toBe("Here's to the crazy ones...");
  });

  it("dims Font in a plain text document", async () => {
    const actions: { current: TextEditActions | null } = { current: null };
    render(<TextEdit actionsRef={actions} />);
    act(() => actions.current?.setFormat("plain"));
    fireEvent.click(await screen.findByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fireEvent.contextMenu(view());
    expect(await item("Font")).toHaveAttribute("aria-disabled", "true");
    expect(await item("Speech")).not.toHaveAttribute("aria-disabled", "true");
  });
});
