import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { changeDesktopValue } from "../desktop/desktop-personal";
import { FontBook } from "./font-book";
import { FONT_BOOK_VALIDATE } from "./font-book-preferences";

// The test environment has no drive: this stands in for the desktop's files module. The real
// round trip is in e2e/font-book-depth-journey.mjs.
const drive = vi.hoisted(() => ({
  files: [] as { id: string; name: string }[],
  uploaded: [] as string[],
  trashed: [] as string[],
  failUpload: false,
}));
vi.mock("./font-book-drive", () => ({
  driveAvailable: () => true,
  familyNameOf: (name: string) => name.replace(/\.[^.]+$/, ""),
  keptFonts: async () => drive.files,
  readKeptFont: async () => new Blob(["font"]),
  keepFont: async (file: File) => {
    if (drive.failUpload) throw new Error("no room");
    drive.uploaded.push(file.name);
    return `drive-${file.name}`;
  },
  trashKeptFont: async (id: string) => {
    drive.trashed.push(id);
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
  // These files hold no font, and nothing here is about validating them.
  changeDesktopValue(FONT_BOOK_VALIDATE, false);
  drive.files = [];
  drive.uploaded = [];
  drive.trashed = [];
  drive.failUpload = false;
  faces.length = 0;
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
  // The window takes its fonts off the page as it closes, while `document.fonts` is still here.
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "fonts");
});

function EditMenu() {
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="Edit">{useDesktopAppMenuItems("font-book", "Edit")}</MenuBarMenu>
    </MenuBar>
  );
}
const setup = () => {
  const person = userEvent.setup({ pointerEventsCheck: 0 });
  const view = render(
    <>
      <EditMenu />
      <FontBook />
    </>,
  );
  return { person, ...view };
};
const search = () => screen.getByRole("searchbox", { name: "Search" });
const fontRows = () =>
  within(screen.getByRole("treegrid", { name: "Fonts" }))
    .queryAllByRole("row")
    .map((row) => row.textContent);
const previewed = () => screen.getByRole("heading", { level: 2 }).textContent;
const chooseFile = (name: string) =>
  fireEvent.change(screen.getByLabelText("Choose font files"), {
    target: { files: [new File(["1"], name)] },
  });

describe("Font Book's added fonts on the drive", () => {
  it("brings the fonts on the drive back on open, and loads each on the page", async () => {
    drive.files = [
      { id: "f1", name: "Aardvark Sans.otf" },
      { id: "f2", name: "Verdana.ttf" },
    ];
    const { person } = setup();
    await person.type(search(), "Aardvark");
    await waitFor(() => expect(fontRows()).toEqual(["Aardvark Sans"]));
    expect(faces).toEqual(["Aardvark Sans"]);
  });

  it("keeps a chosen file on the drive, once", async () => {
    setup();
    chooseFile("Bandicoot.ttf");
    await waitFor(() => expect(drive.uploaded).toEqual(["Bandicoot.ttf"]));
    expect(previewed()).toBe("Bandicoot Regular");
    chooseFile("Bandicoot.ttf");
    await new Promise((resolve) => setTimeout(resolve));
    expect(drive.uploaded).toEqual(["Bandicoot.ttf"]);
  });

  it("says so when the drive refuses, and the font stays for this window", async () => {
    drive.failUpload = true;
    setup();
    chooseFile("Bandicoot.ttf");
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "“Bandicoot” could not be kept on your drive. It stays until this window closes.",
    );
  });

  it("removes an added font after asking: off the page, off the list, to the Trash", async () => {
    const { person } = setup();
    chooseFile("Bandicoot.ttf");
    await waitFor(() => expect(drive.uploaded).toHaveLength(1));
    expect(faces).toEqual(["Bandicoot"]);

    await person.click(screen.getByRole("menuitem", { name: "Edit" }));
    await person.click(await screen.findByRole("menuitem", { name: /Remove “Bandicoot” Family/ }));
    const question = await screen.findByRole("alertdialog");
    expect(question).toHaveTextContent("Are you sure you want to remove “Bandicoot”?");
    await person.click(within(question).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(drive.trashed).toEqual(["drive-Bandicoot.ttf"]));
    expect(faces).toEqual([]);
    expect(screen.getByRole("region")).toHaveAccessibleName("All Fonts (281 Fonts)");
  });

  it("will not remove a font of the library", async () => {
    const { person } = setup();
    await person.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(
      await screen.findByRole("menuitem", { name: /Remove “Zapf Dingbats” Family/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
