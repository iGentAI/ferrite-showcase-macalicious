import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { landingAt, registerDropTarget } from "../desktop/desktop-drag";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { appForFile, registerFileOpeners, requestOpenFile } from "../finder/finder-open";
import { quinceTables, sfnt, woff2 } from "./__tests__/font-book-fixtures";
import { fontBookApp } from "./app";
import { FontBook } from "./font-book";
import { FONT_BOOK_VALIDATE, FontBookPreferences } from "./font-book-preferences";
import { readFontTools } from "./font-book-toolbar";

// The test environment has no drive: this stands in for the desktop's files module. Its real round
// trip is in e2e/font-book-census-journey.mjs.
const drive = vi.hoisted(() => ({
  files: [] as { id: string; name: string }[],
  bytes: new Map<string, ArrayBuffer>(),
  uploaded: [] as string[],
  movedAside: 0,
}));
vi.mock("./font-book-drive", () => ({
  driveAvailable: () => true,
  familyNameOf: (name: string) => name.replace(/\.[^.]+$/, ""),
  keptFonts: async () => drive.files,
  readKeptFont: async (id: string) => new Blob([drive.bytes.get(id) ?? new ArrayBuffer(0)]),
  keepFont: async (file: File) => {
    drive.uploaded.push(file.name);
    return `drive-${file.name}`;
  },
  trashKeptFont: async () => undefined,
  moveKeptFontsAside: async () => {
    drive.movedAside += 1;
    return drive.uploaded.length;
  },
}));

const faces: string[] = [];
class FakeFontFace {
  constructor(public family: string) {}
  async load() {
    return this;
  }
}

beforeEach(() => {
  drive.files = [];
  drive.bytes = new Map();
  drive.uploaded = [];
  drive.movedAside = 0;
  faces.length = 0;
  changeDesktopValue(FONT_BOOK_VALIDATE, true);
  vi.stubGlobal("FontFace", FakeFontFace);
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      add: (face: FakeFontFace) => faces.push(face.family),
      delete: (face: FakeFontFace) => faces.splice(faces.indexOf(face.family), 1),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "fonts");
  Reflect.deleteProperty(document, "elementFromPoint");
});

function OneMenu({ title }: { title: string }) {
  return <MenuBarMenu title={title}>{useDesktopAppMenuItems("font-book", title)}</MenuBarMenu>;
}
const setup = () => {
  const person = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <>
      <MenuBar aria-label="Menus">
        {["File", "Edit", "View"].map((title) => (
          <OneMenu key={title} title={title} />
        ))}
      </MenuBar>
      <FontBook />
    </>,
  );
  return person;
};
type Person = ReturnType<typeof setup>;
const choose = async (person: Person, menu: string, row: string | RegExp) => {
  await person.click(screen.getByRole("menuitem", { name: menu }));
  await person.click(await screen.findByRole("menuitem", { name: row }));
};
const collection = (name: string) => screen.getByRole("treeitem", { name });
const collectionNames = () =>
  within(screen.getByRole("tree", { name: "Collections" }))
    .getAllByRole("treeitem")
    .map((item) => item.textContent);
const fontNames = () =>
  within(screen.getByRole("treegrid", { name: "Fonts", hidden: true }))
    .queryAllByRole("row", { hidden: true })
    .map((row) => row.textContent);
const fontRow = (name: string) =>
  within(screen.getByRole("treegrid", { name: "Fonts", hidden: true })).getByRole("row", {
    name,
    hidden: true,
  });
const view = (name: string) => screen.getByRole("button", { name });
const infoOf = (scope: HTMLElement | Document = document) => {
  const terms = [...scope.querySelectorAll("dt")].map((term) => term.textContent);
  const values = [...scope.querySelectorAll("dd")].map((value) => value.textContent);
  return Object.fromEntries(terms.map((term, index) => [term, values[index]]));
};
const quince = (name = "Quince.ttf", fixed = true) =>
  new File([sfnt(quinceTables(fixed, 0x41, 0x44))], name);
const choose_file = (...files: File[]) =>
  fireEvent.change(screen.getByLabelText("Choose font files"), { target: { files } });
const press = (row: HTMLElement, modifiers: { ctrlKey?: boolean } = {}) => {
  fireEvent.pointerDown(row, modifiers);
  fireEvent.mouseDown(row, modifiers);
  fireEvent.pointerUp(window);
  fireEvent.mouseUp(row, modifiers);
};

describe("Font Book's Info view", () => {
  it("says what an added font's own file says, and where the file is", async () => {
    const person = setup();
    choose_file(quince());
    await waitFor(() => expect(drive.uploaded).toEqual(["Quince.ttf"]));
    await person.click(view("Info"));
    await waitFor(() => expect(infoOf().Location).toBe("Documents/Fonts/Quince.ttf"));
    expect(infoOf()).toMatchObject({
      "PostScript name": "Quince-Bold",
      "Full name": "Quince Bold",
      Family: "Quince",
      Style: "Bold",
      Language: "Latin",
      "Fixed width": "Yes",
      Version: "Version 2.5",
      Designer: "Ada Lovelace",
      Copyright: "Copyright 2019 Quince Foundry",
    });
  });

  it("says a WOFF2's tables cannot be read, and that a font only named has no file", async () => {
    const person = setup();
    await person.click(view("Info"));
    expect(infoOf()).toMatchObject({
      Version: "Not known: this desktop has no file for this font",
      Location: "None: this desktop only names this font",
    });
    choose_file(new File([woff2()], "Plum.woff2"));
    await waitFor(() =>
      expect(infoOf().Version).toBe("Not readable: this file's tables are compressed"),
    );
  });

  it("puts a fixed-pitch file in Fixed Width by what its table says", async () => {
    const person = setup();
    choose_file(quince(), quince("Olive.ttf", false));
    await waitFor(() => expect(drive.uploaded).toHaveLength(2));
    await person.click(collection("Fixed Width"));
    expect(fontNames()).toContain("Quince");
    expect(fontNames()).not.toContain("Olive");
  });
});

describe("Font Book's Repertoire view", () => {
  it("shows the characters of an added font's cmap", async () => {
    const person = setup();
    choose_file(quince());
    await waitFor(() => expect(drive.uploaded).toHaveLength(1));
    await person.click(view("Repertoire"));
    expect(screen.getByRole("group", { name: "Repertoire" }).textContent).toBe("ABCD");
  });
});

describe("Font Book with several fonts selected", () => {
  const selectTwo = async (person: Person) => {
    await person.click(collection("Fixed Width"));
    press(fontRow("Courier"));
    press(fontRow("Menlo"), { ctrlKey: true });
  };

  it("shows each font's characters and each font's facts", async () => {
    const person = setup();
    await selectTwo(person);
    await person.click(view("Repertoire"));
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("2 Fonts");
    screen.getByRole("group", { name: "Repertoire of Courier Regular" });
    screen.getByRole("group", { name: "Repertoire of Menlo Regular" });

    await person.click(view("Info"));
    const lists = [...document.querySelectorAll<HTMLElement>(".mac-font-book-info")];
    expect(lists.map((list) => infoOf(list).Family)).toEqual(["Courier", "Menlo"]);
  });

  it("sets the custom text in each font, and it stays editable", async () => {
    const person = setup();
    await selectTwo(person);
    await person.click(view("Custom"));
    const text = screen.getByRole("textbox", { name: "Custom text" });
    fireEvent.change(text, { target: { value: "Hamburgefonts" } });
    const samples = [...document.querySelectorAll<HTMLElement>(".mac-font-book-several-sample")];
    expect(samples.map((sample) => sample.textContent)).toEqual(["Hamburgefonts", "Hamburgefonts"]);
    expect(samples[0]?.style.fontFamily).toMatch(/^Courier/);
    expect(samples[1]?.style.fontFamily).toMatch(/^Menlo/);
  });
});

describe("Font Book's libraries", () => {
  it("shows no library rows until a font is added, then tells Computer from User", async () => {
    const person = setup();
    expect(collectionNames()).not.toContain("User");
    choose_file(quince());
    await waitFor(() => expect(drive.uploaded).toHaveLength(1));
    expect(collectionNames().slice(0, 3)).toEqual(["All Fonts", "Computer", "User"]);
    await person.click(collection("User"));
    expect(fontNames()).toEqual(["Quince"]);
    expect(screen.getByRole("region")).toHaveAccessibleName("User (1 Font)");
    await person.click(collection("Computer"));
    expect(screen.getByRole("region")).toHaveAccessibleName("Computer (281 Fonts)");
  });

  it("makes a library from File, named in place, and fonts added there join it", async () => {
    const person = setup();
    await choose(person, "File", /^New Library/);
    const field = await screen.findByRole("textbox", { name: "Collection name" });
    await person.clear(field);
    await person.type(field, "Display{Enter}");
    expect(collection("Display")).toHaveAttribute("aria-selected", "true");
    expect(collectionNames().slice(0, 4)).toEqual(["All Fonts", "Computer", "User", "Display"]);
    choose_file(quince());
    await waitFor(() => expect(fontNames()).toEqual(["Quince"]));
    expect(collection("Display")).toHaveAttribute("aria-selected", "true");
  });

  it("makes a library from Option-Command-L", async () => {
    setup();
    fireEvent.keyDown(screen.getByRole("region"), {
      key: "l",
      code: "KeyL",
      ctrlKey: true,
      altKey: true,
    });
    await screen.findByRole("textbox", { name: "Collection name" });
  });
});

describe("Font Book's language collections", () => {
  it("has one for each of the person's languages, and only those", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["en-GB", "ja-JP", "zh-TW"] });
    const person = setup();
    await person.click(collection("Japanese"));
    expect(fontNames()).toContain("YuGothic");
    await person.click(collection("Traditional Chinese"));
    expect(fontNames().length).toBeGreaterThan(0);
    expect(collectionNames()).not.toContain("Arabic");
    expect(collectionNames()).not.toContain("Simplified Chinese");
  });
});

describe("File > Restore Standard Fonts", () => {
  it("asks, moves the added fonts' files aside and turns every font on", async () => {
    const person = setup();
    choose_file(quince());
    await waitFor(() => expect(drive.uploaded).toHaveLength(1));
    await person.click(collection("Fixed Width"));
    press(fontRow("PT Mono"));
    await choose(person, "Edit", /Disable “PT Mono” Family/);
    await waitFor(() => expect(view("Enable “PT Mono”")).toBeInTheDocument());

    await choose(person, "File", /^Restore Standard Fonts/);
    const question = await screen.findByRole("alertdialog");
    expect(question).toHaveTextContent(
      "The fonts you added move to “Fonts (Removed)” in Documents, and every font that is off turns on.",
    );
    expect(drive.movedAside).toBe(0);
    await person.click(within(question).getByRole("button", { name: "Proceed" }));

    await waitFor(() => expect(drive.movedAside).toBe(1));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "1 font moved to “Fonts (Removed)” in Documents.",
    );
    await person.click(screen.getByRole("button", { name: "OK" }));
    expect(faces).toEqual([]);
    expect(view("Disable “PT Mono”")).toBeInTheDocument();
    expect(collectionNames()).not.toContain("User");
  });
});

describe("View > Customize Toolbar", () => {
  it("takes items out and puts them back, and the toolbar follows at once", async () => {
    const person = setup();
    await choose(person, "View", /^Customize Toolbar/);
    const sheet = await screen.findByRole("dialog");
    await person.click(within(sheet).getByRole("button", { name: "Remove Add Fonts" }));
    await person.click(within(sheet).getByRole("button", { name: "Print" }));
    const toolbar = screen.getByRole("toolbar", { name: "Font Book toolbar", hidden: true });
    const named = (name: string) => within(toolbar).queryByRole("button", { name, hidden: true });
    expect(named("Add Fonts")).toBeNull();
    expect(named("Print")).not.toBeNull();

    await person.click(within(sheet).getByRole("button", { name: "Use Default Set" }));
    expect(named("Add Fonts")).not.toBeNull();
    expect(named("Print")).toBeNull();
    await person.click(within(sheet).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps one array for one stored value, which a kept value's effect depends on", () => {
    const stored = ["print", "search", "unknown"];
    expect(readFontTools(stored)).toEqual(["print", "search"]);
    expect(readFontTools(stored)).toBe(readFontTools(stored));
  });

  it("moves an item with the arrow keys", async () => {
    const person = setup();
    await choose(person, "View", /^Customize Toolbar/);
    const list = within(await screen.findByRole("list", { name: "In the toolbar" }));
    const order = () =>
      list.getAllByRole("button", { name: /^Move / }).map((each) => each.textContent);
    expect(order().slice(0, 2)).toEqual(["Preview", "Space"]);
    fireEvent.keyDown(list.getByRole("button", { name: "Move Preview" }), { key: "ArrowRight" });
    expect(order().slice(0, 2)).toEqual(["Space", "Preview"]);
  });
});

describe("Font Book's validation before installing", () => {
  it("asks about a file that fails, and installs only what is checked", async () => {
    const person = setup();
    choose_file(new File(["not a font"], "Broken.ttf"));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveTextContent("Broken.ttf: Failed");
    expect(sheet).toHaveTextContent("File type: The file does not start as a font does.");
    const box = within(sheet).getByRole("checkbox", { name: /Broken\.ttf/ });
    expect(box).not.toBeChecked();
    expect(within(sheet).getByRole("button", { name: "Install Checked" })).toBeDisabled();
    await person.click(box);
    await person.click(within(sheet).getByRole("button", { name: "Install Checked" }));
    await waitFor(() => expect(drive.uploaded).toEqual(["Broken.ttf"]));
  });

  it("installs a file that passes without asking", async () => {
    setup();
    choose_file(new File([woff2()], "Plum.woff2"));
    await waitFor(() => expect(drive.uploaded).toEqual(["Plum.woff2"]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("installs a failing file at once with the preference off", async () => {
    changeDesktopValue(FONT_BOOK_VALIDATE, false);
    setup();
    choose_file(new File(["not a font"], "Broken.ttf"));
    await waitFor(() => expect(drive.uploaded).toEqual(["Broken.ttf"]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Font Book's Preferences", () => {
  it("keeps Validate fonts among the person's values, and dims what a page cannot do", async () => {
    const person = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FontBookPreferences />);
    const validate = screen.getByRole("checkbox", { name: "Validate fonts before installing" });
    expect(validate).toBeChecked();
    await person.click(validate);
    expect(desktopValues()[FONT_BOOK_VALIDATE]).toBe(false);

    for (const name of [
      "Automatic font activation",
      "Ask me before activating",
      "Alert me if system font files change",
    ]) {
      const box = screen.getByRole("checkbox", { name });
      expect(box).toHaveAttribute("aria-disabled", "true");
    }
    expect(
      screen.getByText(
        "Activation loads a font when another application's document asks for it; applications here do not ask.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Default Install Location" })).toHaveTextContent(
      "User",
    );
  });
});

describe("Font Book and Finder", () => {
  it("is the application that opens a font file", () => {
    const forget = registerFileOpeners([fontBookApp]);
    try {
      expect(appForFile({ name: "Quince.otf" })).toBe("font-book");
      expect(appForFile({ name: "Quince.pages" })).toBeUndefined();
    } finally {
      forget();
    }
  });

  it("offers a font opened from Finder for installing, set in its own face", async () => {
    const person = setup();
    drive.bytes.set("downloads-1", sfnt(quinceTables()));
    act(() => requestOpenFile({ app: "font-book", id: "downloads-1", name: "Quince.ttf" }));
    const sheet = await screen.findByRole("dialog");
    within(sheet).getByRole("heading", { name: "Quince Bold" });
    expect(sheet).toHaveTextContent("Bold, Version 2.5, Not Installed");
    expect(within(sheet).getByRole("img", { name: "Sample of the font" }).style.fontFamily).toMatch(
      /Font Book opened quince/,
    );
    expect(faces).toEqual(["Font Book opened quince"]);

    await person.click(within(sheet).getByRole("button", { name: "Install Font" }));
    await waitFor(() => expect(drive.uploaded).toEqual(["Quince.ttf"]));
    expect(faces).toEqual(["Quince"]);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Quince Regular");
  });

  it("shows a font it already has instead of installing it again", async () => {
    setup();
    act(() => requestOpenFile({ app: "font-book", id: "downloads-2", name: "Courier.ttf" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Courier Regular"),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("takes a font file dropped from Finder, and refuses anything else with a reason", async () => {
    const person = setup();
    const body = document.querySelector(".mac-font-book-body") as HTMLElement;
    const fileItem = (name: string, data: ArrayBuffer) => ({
      id: name,
      name,
      kind: "file" as const,
      bytes: async () => new Blob([data]),
    });
    const refused = landingAt(body, {
      from: "finder",
      copy: false,
      items: [fileItem("Letter.txt", new ArrayBuffer(1))],
    });
    expect(refused?.refusal).toBe("Font Book takes font files: .ttf, .otf, .woff and .woff2.");
    act(() => refused?.sayRefusal?.(refused.refusal as string));
    await person.click(within(await screen.findByRole("alertdialog")).getByRole("button"));

    const landing = landingAt(body, {
      from: "finder",
      copy: false,
      items: [fileItem("Quince.ttf", sfnt(quinceTables()))],
    });
    expect(landing?.refusal).toBeUndefined();
    act(() => landing?.drop());
    await waitFor(() => expect(drive.uploaded).toEqual(["Quince.ttf"]));
  });

  it("drags an added font's file out to what takes it, and nothing for a font with no file", async () => {
    const person = setup();
    choose_file(quince());
    await waitFor(() => expect(drive.uploaded).toHaveLength(1));

    const elsewhere = document.createElement("div");
    document.body.append(elsewhere);
    const dropped: string[] = [];
    const forget = registerDropTarget({
      element: elsewhere,
      landing: (_hit, drag) => ({
        element: elsewhere,
        drop: () => {
          dropped.push(...drag.items.map((item) => `${drag.from}:${item.name}`));
        },
      }),
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => elsewhere,
    });
    const dragFrom = (row: HTMLElement) => {
      fireEvent.pointerDown(row);
      fireEvent.mouseDown(row);
      fireEvent.pointerMove(window, { clientX: 500, clientY: 50 });
      fireEvent.pointerUp(window);
    };
    await person.click(collection("User"));
    dragFrom(fontRow("Quince"));
    expect(dropped).toEqual(["font-book:Quince.ttf"]);
    expect(elsewhere).not.toHaveAttribute("data-desktop-drop");

    dropped.length = 0;
    await person.click(collection("Fixed Width"));
    dragFrom(fontRow("Courier"));
    expect(dropped).toEqual([]);
    forget();
    elsewhere.remove();
  });
});

describe("A font macOS has not downloaded", () => {
  it("offers Download dimmed, with the reason", async () => {
    const person = setup();
    await person.type(screen.getByRole("searchbox", { name: "Search" }), "YuGothic");
    fireEvent.contextMenu(fontRow("YuGothic"));
    const row = await screen.findByRole("menuitem", {
      name: "Download “YuGothic”",
    });
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute(
      "data-reason",
      "This desktop has no font server to download it from.",
    );
    expect(
      screen.getByRole("menuitem", {
        name: "This desktop has no font server to download it from.",
      }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
