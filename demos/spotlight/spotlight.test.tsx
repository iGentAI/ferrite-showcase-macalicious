import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CatalinaSpotlight } from "./spotlight";
import { developerItems, MAX_PER_CATEGORY, type SpotlightItem, search } from "./spotlight-data";

const XML = "com_apple_MobileAsset_DictionaryServices_dictionaryOSX.xml";

const field = () => screen.getByRole("combobox", { name: "Spotlight Search" });
const results = () => screen.queryByRole("listbox", { name: "Results" });
const preview = () => within(screen.getByRole("group", { name: "Preview" }));
/** The list as it reads: every group's name with the names of its results. */
const listed = () => {
  const list = results();
  if (!list) return [];
  return within(list)
    .getAllByRole("group")
    .map((group) => [
      group.firstElementChild?.textContent,
      within(group)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ]);
};
const selected = () =>
  screen
    .queryAllByRole("option")
    .filter((option) => option.getAttribute("aria-selected") === "true")
    .map((option) => option.textContent);
const search_ = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await user.clear(field());
  await user.type(field(), text);
};

const IMAGES = [
  "19 Apple_iPadOS_Paste-Feature_060319.jpg",
  "Oscar_Circle-thumb600x600.png",
  "OS X Versions.psd",
  "09-OS-X-Mavericks.jpg",
  "10-OS-X-Yosemite.jpg",
];
const DOCUMENTS = [
  "catalina.md",
  "page.txt",
  "page.txt",
  "OS X calendars - SH outline.txt",
  "Guest Recording - OS X.pages",
];

describe("the captured searches", () => {
  it('finds for "OS X" what the Aqua capture lists, the definition selected and shown', () => {
    render(<CatalinaSpotlight defaultQuery="OS X" />);
    expect(field()).toHaveValue("OS X");
    expect(listed()).toEqual([
      ["Definition", ["macOS"]],
      ["Images", IMAGES],
      ["Folders", ["OS X"]],
      ["Documents", DOCUMENTS],
    ]);
    expect(selected()).toEqual(["macOS"]);
    // The top hit completes the field.
    expect(screen.getByText("— macOS")).toBeInTheDocument();
    expect(preview().getByRole("heading", { name: "macOS" })).toBeVisible();
    expect(preview().getByText(/first shipped in 2001 under the name Mac OS X/)).toBeVisible();
    expect(preview().getByRole("link", { name: "Classic Mac OS" })).toBeVisible();
  });

  it("finds in the developer's index what the Dark Aqua capture lists, the XML file selected and its text shown", () => {
    render(<CatalinaSpotlight items={developerItems} defaultQuery="OS X" />);
    expect(listed()).toEqual([
      ["Developer", [XML, XML, "version.xml", "license.html", "license.html"]],
      ["Definition", ["macOS"]],
      ["Images", IMAGES],
      ["Folders", ["OS X"]],
      ["Documents", DOCUMENTS],
    ]);
    expect(selected()).toEqual([XML]);
    expect(screen.getByText(`— ${XML}`)).toBeInTheDocument();
    const text = preview().getByRole("textbox", { name: `Contents of ${XML}` });
    expect(text).toHaveAttribute("readonly");
    expect((text as HTMLTextAreaElement).value).toMatch(
      /^<\?xml version="1\.0" encoding="UTF-8"\?>/,
    );
  });
});

describe("searching", () => {
  it("searches while the text is typed and selects the new top hit", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<CatalinaSpotlight defaultQuery="OS X" onQueryChange={onQueryChange} />);
    await user.click(field());
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual([IMAGES[0]]);

    await search_(user, "cal");
    expect(onQueryChange).toHaveBeenLastCalledWith("cal");
    expect(listed()).toEqual([
      ["Applications", ["Calculator", "Calendar"]],
      ["Documents", ["OS X calendars - SH outline.txt"]],
    ]);
    // Not the result the selection was on before: the first of the new list.
    expect(selected()).toEqual(["Calculator"]);
    expect(screen.getByText("— Calculator")).toBeInTheDocument();
    expect(preview().getByRole("heading", { name: "Calculator" })).toBeVisible();
    expect(preview().getByText("Application")).toBeVisible();
  });

  it("is the field alone while it is empty or finds nothing", async () => {
    const user = userEvent.setup();
    render(<CatalinaSpotlight />);
    expect(field()).toHaveValue("");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(results()).toBeNull();

    await search_(user, "license");
    // The default index has no developer's files.
    expect(results()).toBeNull();
    await search_(user, "aqua");
    expect(listed()).toEqual([["Definition", ["Aqua"]]]);
  });

  it("finds an item by the start of every word of the query, in its name or its contents", () => {
    const item = (id: string, name: string, contents?: string): SpotlightItem => ({
      id,
      name,
      category: "documents",
      kind: "Document",
      contents,
      preview: { type: "summary" },
    });
    const items = [
      item("a", "iPadOS-thumb600x600.png"),
      item("b", "notes.txt", "about OS X"),
      item("c", "Boxes.txt"),
      item("d", "OS only.txt"),
    ];
    const found = (query: string) =>
      search(items, query).flatMap((group) => group.results.map((result) => result.id));
    // "OS" inside "iPadOS" and "x" between the digits begin words; "x" inside "Boxes" does not.
    expect(found("OS X")).toEqual(["a", "b"]);
    expect(found("os x")).toEqual(["a", "b"]);
    expect(found("box")).toEqual(["c"]);
    expect(found("  ")).toEqual([]);
  });

  it("finds a word whole as well as by its parts: macOS and iPadOS", () => {
    const item = (id: string, name: string): SpotlightItem => ({
      id,
      name,
      category: "documents",
      kind: "Document",
      preview: { type: "summary" },
    });
    const items = [item("mac", "About macOS.pdf"), item("pad", "iPadOS-thumb.png")];
    const found = (query: string) =>
      search(items, query).flatMap((group) => group.results.map((result) => result.id));
    expect(found("macos")).toEqual(["mac"]);
    expect(found("macOS")).toEqual(["mac"]);
    expect(found("ipados")).toEqual(["pad"]);
    expect(found("iPadOS")).toEqual(["pad"]);
    // The parts are still words of their own.
    expect(found("os")).toEqual(["mac", "pad"]);
    expect(found("pad")).toEqual(["pad"]);
  });

  it("splits words in any script and ignores accents", () => {
    const item = (id: string, name: string): SpotlightItem => ({
      id,
      name,
      category: "documents",
      kind: "Document",
      preview: { type: "summary" },
    });
    const items = [
      item("cafe", "Café crème.txt"),
      item("moscow", "Москва_план.key"),
      item("tokyo", "東京 旅行.pages"),
      item("greek", "Αθήνα-2019.jpg"),
    ];
    const found = (query: string) =>
      search(items, query).flatMap((group) => group.results.map((result) => result.id));
    expect(found("café")).toEqual(["cafe"]);
    expect(found("cafe creme")).toEqual(["cafe"]);
    expect(found("CRÈ")).toEqual(["cafe"]);
    expect(found("моск")).toEqual(["moscow"]);
    expect(found("план")).toEqual(["moscow"]);
    expect(found("東京")).toEqual(["tokyo"]);
    expect(found("旅行")).toEqual(["tokyo"]);
    expect(found("αθηνα")).toEqual(["greek"]);
    expect(found("2019")).toEqual(["greek"]);
    // Letters of another script are not punctuation: none of these names is split into nothing.
    expect(found("txt")).toEqual(["cafe"]);
  });

  it("keeps the vowel signs of other scripts: words that differ by one are not the same", () => {
    const item = (id: string, name: string): SpotlightItem => ({
      id,
      name,
      category: "documents",
      kind: "Document",
      preview: { type: "summary" },
    });
    const items = [item("kal", "कल सूची.txt"), item("kala", "काला कपड़ा.txt")];
    const found = (query: string) =>
      search(items, query).flatMap((group) => group.results.map((result) => result.id));
    expect(found("कल")).toEqual(["kal"]);
    expect(found("काला")).toEqual(["kala"]);
    // A word with a vowel sign is one word, not split at the sign.
    expect(found("सूची")).toEqual(["kal"]);
    expect(found("कपड़ा")).toEqual(["kala"]);
  });

  it("shows exactly five results of a kind when more are found", () => {
    const items = Array.from(
      { length: 8 },
      (_, index): SpotlightItem => ({
        id: `note-${index}`,
        name: `Note ${index}`,
        category: "documents",
        kind: "Document",
        preview: { type: "summary" },
      }),
    );
    const [group, ...others] = search(items, "note");
    expect(others).toEqual([]);
    expect(group?.results.map((result) => result.id)).toEqual([
      "note-0",
      "note-1",
      "note-2",
      "note-3",
      "note-4",
    ]);
    expect(MAX_PER_CATEGORY).toBe(5);
  });
});

describe("the selection", () => {
  it("moves with the arrow keys, and the preview follows it", async () => {
    const user = userEvent.setup();
    render(<CatalinaSpotlight defaultQuery="OS X" />);
    await user.click(field());

    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual([IMAGES[0]]);
    expect(preview().getByRole("heading", { name: IMAGES[0] })).toBeVisible();
    expect(preview().getByText("1960 × 1470")).toBeVisible();
    expect(preview().queryByRole("heading", { name: "macOS" })).toBeNull();
    // The completion and the icon at the end of the field stay the top hit's.
    expect(screen.getByText("— macOS")).toBeInTheDocument();

    // Down to the first document: the text of the file.
    await user.keyboard("{Meta>}{ArrowDown}{ArrowDown}{/Meta}");
    expect(selected()).toEqual(["catalina.md"]);
    const catalina = preview().getByRole("textbox", { name: "Contents of catalina.md" });
    expect((catalina as HTMLTextAreaElement).value).toContain("# macOS Catalina");

    await user.keyboard("{Meta>}{ArrowUp}{ArrowUp}{ArrowUp}{/Meta}");
    expect(selected()).toEqual(["macOS"]);
    expect(preview().getByRole("heading", { name: "macOS" })).toBeVisible();
  });

  it("follows a click, and tells two results of one name apart", async () => {
    const user = userEvent.setup();
    render(<CatalinaSpotlight defaultQuery="OS X" />);
    const [first, second] = screen.getAllByRole("option", { name: "page.txt" });
    await user.click(second as HTMLElement);
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("aria-selected", "false");
    const page = preview().getByRole("textbox", { name: "Contents of page.txt" });
    expect((page as HTMLTextAreaElement).value).toContain("OS X Yosemite");
  });

  it("looks a definition's cross-reference up and gives the keyboard to the field", async () => {
    const user = userEvent.setup();
    render(<CatalinaSpotlight defaultQuery="OS X" />);
    // The entry is the library's: its headword and text are labels, its cross-reference the
    // library's link (a label rendered as a link, in the link colour).
    const heading = preview().getByRole("heading", { name: "macOS" });
    expect(heading).toHaveClass("mac-label");
    expect(heading).toHaveAttribute("data-text-style", "title-1");
    expect(heading.nextElementSibling).toHaveClass("mac-label");
    expect(heading.nextElementSibling).toHaveAttribute("data-selectable");
    const link = preview().getByRole("link", { name: "Classic Mac OS" });
    expect(link).toHaveClass("mac-label");
    expect(link).toHaveAttribute("data-color", "link");
    expect(link).toHaveAttribute("data-text-style", "emphasized");
    await user.click(link);
    expect(field()).toHaveValue("Classic Mac OS");
    expect(field()).toHaveFocus();
    expect(selected()).toEqual(["Classic Mac OS"]);
    expect(preview().getByRole("heading", { name: "Classic Mac OS" })).toBeVisible();
  });
});

describe("opening and closing", () => {
  it("opens the selection on Return, tells the host and closes", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CatalinaSpotlight defaultQuery="OS X" onOpenItem={onOpenItem} onOpenChange={onOpenChange} />,
    );
    await user.click(field());
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onOpenItem).toHaveBeenCalledTimes(1);
    expect(onOpenItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "image-ipados", name: IMAGES[0] }),
      { reveal: false },
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("reveals on Command-Return and opens on a double click", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    const { unmount } = render(<CatalinaSpotlight defaultQuery="OS X" onOpenItem={onOpenItem} />);
    await user.click(field());
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onOpenItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: "define-macos" }), {
      reveal: true,
    });
    unmount();

    render(<CatalinaSpotlight defaultQuery="OS X" onOpenItem={onOpenItem} />);
    await user.dblClick(screen.getByRole("option", { name: "OS X" }));
    expect(onOpenItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: "folder-os-x" }), {
      reveal: false,
    });
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("clears the field on Escape, and closes on Escape in the empty field", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onOpenItem = vi.fn();
    render(
      <CatalinaSpotlight defaultQuery="OS X" onOpenChange={onOpenChange} onOpenItem={onOpenItem} />,
    );
    await user.click(field());
    await user.keyboard("{Escape}");
    expect(field()).toHaveValue("");
    expect(results()).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();

    // Nothing is selected in the collapsed window, so Return opens nothing.
    await user.keyboard("{Enter}");
    expect(onOpenItem).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("starts empty, with the keyboard in the field, when its host opens it again", async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen((shown) => !shown)}>
            Toggle
          </button>
          <CatalinaSpotlight open={open} onOpenChange={setOpen} defaultQuery="OS X" />
        </>
      );
    }
    render(<Host />);
    // Shown with the page: the focus is left where it is.
    expect(field()).not.toHaveFocus();
    expect(field()).toHaveValue("OS X");

    await user.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Toggle" }));
    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    expect(results()).toBeNull();
  });
});

describe("the preview's facts", () => {
  it("shows every fact, also two of one label, and follows the selected result", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error");
    const items: SpotlightItem[] = [
      {
        id: "tagged",
        name: "Tagged notes",
        category: "documents",
        kind: "Document",
        details: [
          ["Tag", "Red"],
          ["Tag", "Blue"],
          ["Size", "2 KB"],
        ],
        preview: { type: "summary" },
      },
      {
        id: "plain",
        name: "Plain notes",
        category: "documents",
        kind: "Plain Text",
        details: [["Size", "1 KB"]],
        preview: { type: "summary" },
      },
    ];
    render(<CatalinaSpotlight items={items} defaultQuery="notes" />);
    const facts = () =>
      Array.from(
        screen
          .getByRole("group", { name: "Preview" })
          .querySelectorAll(".mac-spotlight-app-details-row"),
        (row) => [row.querySelector("dt")?.textContent, row.querySelector("dd")?.textContent],
      );
    const tagged = [
      ["Kind", "Document"],
      ["Tag", "Red"],
      ["Tag", "Blue"],
      ["Size", "2 KB"],
    ];
    expect(facts()).toEqual(tagged);
    await user.click(screen.getByRole("option", { name: "Plain notes" }));
    expect(facts()).toEqual([
      ["Kind", "Plain Text"],
      ["Size", "1 KB"],
    ]);
    await user.click(screen.getByRole("option", { name: "Tagged notes" }));
    expect(facts()).toEqual(tagged);
    // Two facts of one label are two rows of their own, not one key given twice.
    expect(error.mock.calls.flat().map(String).join("\n")).not.toMatch(/same key/);
  });
});

describe("the stylesheet", () => {
  it("takes the measured sizes from the demo's tokens", () => {
    // jsdom resolves no custom property, so the rules themselves are read; the visual
    // comparisons of spotlight.visual.json show what they draw.
    const read = (name: string) =>
      readFileSync(path.join(import.meta.dirname, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const css = read("spotlight.css");
    const rule = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThanOrEqual(0);
      return css.slice(start, css.indexOf("}", start));
    };
    for (const selector of [
      ".mac-spotlight-app-artwork",
      '.mac-spotlight-app-artwork:where([data-size="top-hit"])',
      '.mac-spotlight-app-artwork:where([data-size="preview"])',
      ".mac-spotlight-app-definition",
      ".mac-spotlight-app .mac-spotlight-app-definition-text",
      ".mac-spotlight-app .mac-spotlight-app-text",
    ]) {
      expect(rule(selector), selector).not.toMatch(/\d(px|pt|em|rem)\b/);
    }
    const tokens = read("spotlight.tokens.css");
    for (const [name, value] of [
      ["artwork-row", "16px"],
      ["artwork-top-hit", "28.5px"],
      ["artwork-preview", "96px"],
      ["definition-padding", "30px 40px 20px 25px"],
      ["definition-text-margin-top", "15px"],
      ["definition-text-indent", "19px"],
      ["definition-text-size", "13px"],
      ["definition-text-line-height", "17px"],
      ["file-padding", "3px 8px"],
      ["file-line-height", "13px"],
    ]) {
      expect(tokens).toContain(`--mac-spotlight-app-${name}: ${value};`);
      expect(css).toContain(`var(--mac-spotlight-app-${name})`);
    }
  });
});

describe("the window", () => {
  it("is the library's Spotlight and hands it the props it does not use itself", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <CatalinaSpotlight
        ref={ref}
        className="mine"
        data-host="desk"
        style={{ top: 210 }}
        placeholder="Search"
      />,
    );
    expect(ref.current).toHaveClass("mac-spotlight", "mac-spotlight-app", "mine");
    expect(ref.current).toHaveAttribute("data-host", "desk");
    expect(ref.current?.style.top).toBe("210px");
    expect(screen.getByRole("combobox", { name: "Search" })).toBe(
      ref.current?.querySelector("input"),
    );
  });
});
