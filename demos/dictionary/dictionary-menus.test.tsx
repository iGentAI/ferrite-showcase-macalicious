import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { Dictionary } from "./dictionary";
import { LOOK_UP_EVENT, startLookUp, wordOfDictLink } from "./dictionary-desktop";
import { wordAtPoint } from "./dictionary-menus";

const caretAt = (node: Node, offset: number) => {
  const range = document.createRange();
  range.setStart(node, offset);
  (document as unknown as { caretRangeFromPoint: () => Range }).caretRangeFromPoint = () => range;
};

afterEach(() => {
  delete (document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint;
});

describe("a click on a word in the entry", () => {
  it("reads the whole word under the point, not its punctuation", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "a well-known (fruit), red";
    document.body.append(paragraph);
    const text = paragraph.firstChild as Text;
    caretAt(text, 16);
    expect(wordAtPoint(paragraph, 0, 0)).toBe("fruit");
    caretAt(text, 5);
    expect(wordAtPoint(paragraph, 0, 0)).toBe("well-known");
    caretAt(text, 13);
    expect(wordAtPoint(paragraph, 0, 0)).toBeUndefined();
    paragraph.remove();
  });

  const findSense = async () => {
    const article = document.querySelector(".mac-dictionary-article") as HTMLElement;
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !/\b[a-z]{5,}\b/.test(node.textContent ?? "")) node = walker.nextNode();
    const at = (node?.textContent ?? "").search(/\b[a-z]{5,}\b/);
    return { node: node as Text, at, word: /\b[a-z]{5,}\b/.exec(node?.textContent ?? "")?.[0] };
  };

  it("looks the word up after the wait for a second click", async () => {
    render(<Dictionary />);
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    const opened = field.value;
    const { node, at, word } = await findSense();
    caretAt(node, at + 1);
    fireEvent.click(node.parentElement as Element, { detail: 1 });
    expect(field.value).toBe(opened);
    await waitFor(() => expect(field.value).toBe(word));
  });

  it("leaves a double click to select the word", async () => {
    render(<Dictionary />);
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    const opened = field.value;
    const { node, at } = await findSense();
    caretAt(node, at + 1);
    fireEvent.click(node.parentElement as Element, { detail: 1 });
    fireEvent.click(node.parentElement as Element, { detail: 2 });
    await new Promise((resolve) => setTimeout(resolve, 320));
    expect(field.value).toBe(opened);
  });
});

describe("dict:// links", () => {
  it("reads the word a link names", () => {
    expect(wordOfDictLink("dict://serendipity")).toBe("serendipity");
    expect(wordOfDictLink("dict://ice%20cream")).toBe("ice cream");
    expect(wordOfDictLink("https://example.com")).toBeUndefined();
  });

  it("opens the word when a link anywhere on the desktop is clicked", () => {
    const stop = startLookUp();
    const asked = vi.fn();
    const hear = (event: Event) => asked((event as CustomEvent).detail.word);
    window.addEventListener(LOOK_UP_EVENT, hear);
    const link = document.createElement("a");
    link.href = "dict://serendipity";
    document.body.append(link);
    expect(fireEvent.click(link)).toBe(false);
    expect(asked).toHaveBeenCalledWith("serendipity");
    stop();
    fireEvent.click(link);
    expect(asked).toHaveBeenCalledTimes(1);
    window.removeEventListener(LOOK_UP_EVENT, hear);
    link.remove();
  });
});

function Menus() {
  const file = useDesktopAppMenuItems("dictionary", "File");
  const edit = useDesktopAppMenuItems("dictionary", "Edit");
  const view = useDesktopAppMenuItems("dictionary", "View");
  return (
    <MenuBar modal={false} aria-label="Menus">
      <MenuBarMenu title="File">{file}</MenuBarMenu>
      <MenuBarMenu title="Edit">{edit}</MenuBarMenu>
      <MenuBarMenu title="View">{view}</MenuBarMenu>
    </MenuBar>
  );
}

const show = () =>
  render(
    <>
      <Menus />
      <Dictionary />
    </>,
  );

const dimmedWith = (name: string, reason: RegExp) => {
  const row = screen.getByRole("menuitem", { name: new RegExp(`^${name}`) });
  expect(row).toHaveAttribute("aria-disabled", "true");
  expect(row.getAttribute("title")).toMatch(reason);
};

describe("Dictionary's rows a web page cannot carry out", () => {
  it("dims File's and View's, saying why", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await screen.findByRole("menuitem", { name: /^Print/ });
    dimmedWith("New Tab", /tabs for Finder and Safari alone/);
    dimmedWith("Open Dictionaries Folder", /no folder of dictionaries/);
    dimmedWith("Page Setup", /print dialog sets the page/);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    await screen.findByRole("menuitem", { name: /^Make Text Bigger/ });
    dimmedWith("Show Tab Bar", /tabs for Finder and Safari alone/);
    dimmedWith("Show All Tabs", /tabs for Finder and Safari alone/);
  });

  it("dims Edit's checking rows, as there is no text here to check", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Spelling and Grammar/ }));
    const spelling = await screen.findByRole("menu", { name: "Spelling and Grammar" });
    expect(within(spelling).getAllByRole("menuitem")).toHaveLength(2);
    dimmedWith("Show Spelling and Grammar", /no text here to check/);
    dimmedWith("Check Document Now", /no text here to check/);
  });
});
