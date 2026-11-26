import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { type DriveEntry, loadDrive } from "../desktop/desktop-files";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import { PreviewApp } from "./preview-app";
import type { PreviewDrive } from "./preview-drive";
import { writeTiff } from "./preview-export";
import { degreesText, exposureText } from "./preview-inspector";
import { handleAt, handlesOf, type Mark, resized } from "./preview-markup";
import { pagedPdf, passwordRefusal } from "./preview-pages";
import type { PdfFile, PdfOutlineEntry } from "./preview-pdf";

/*
 * Preview's menu rows and sheets, chosen as a person chooses them: the rows the window registers
 * for the menu bar are shown in real menus here. Stand-ins: a `PreviewDrive` in memory, a listing
 * for the shared Open dialog, a PDF reader in place of pdf.js and a recording 2D context in place of
 * the browser's canvas. The real drive, pdf.js and drawing are for the journeys.
 */

const shape = (over: Partial<Mark>): Mark => ({
  id: "m",
  kind: "rect",
  color: "#000000",
  stroke: 0.004,
  x: 0.2,
  y: 0.2,
  w: 0.4,
  h: 0.2,
  ...over,
});

describe("the handles of a chosen mark", () => {
  it("are a line's two ends and a box's four corners, and a note and a highlight have none", () => {
    expect(handlesOf(shape({ kind: "line" }))).toEqual([
      [0.2, 0.2],
      [0.6000000000000001, 0.4],
    ]);
    expect(handlesOf(shape({ w: 0.5, h: 0.25 }))).toEqual([
      [0.2, 0.2],
      [0.7, 0.2],
      [0.7, 0.45],
      [0.2, 0.45],
    ]);
    expect(handlesOf(shape({ kind: "note" }))).toEqual([]);
    expect(handlesOf(shape({ kind: "highlight" }))).toEqual([]);
  });

  it("are found near the pointer, and not away from it", () => {
    const mark = shape({ w: 0.5, h: 0.25 });
    expect(handleAt(mark, [0.705, 0.45])).toBe(2);
    expect(handleAt(mark, [0.45, 0.3])).toBeNull();
  });

  it("drag a box's corner against the opposite one", () => {
    expect(resized(shape({ w: 0.5, h: 0.25 }), 2, [0.9, 0.8])).toMatchObject({
      x: 0.2,
      y: 0.2,
      w: 0.7,
      h: 0.6,
    });
    // Past the opposite corner, the box turns over rather than going inside out.
    expect(resized(shape({ w: 0.5, h: 0.25 }), 2, [0.1, 0.1])).toMatchObject({
      x: 0.1,
      y: 0.1,
      w: 0.1,
      h: 0.1,
    });
  });

  it("drag one end of a line and leave the other", () => {
    const line = shape({ kind: "line", w: 0.5, h: 0.5 });
    expect(resized(line, 1, [0.4, 0.3])).toMatchObject({ x: 0.2, y: 0.2, w: 0.2, h: 0.1 });
    expect(resized(line, 0, [0.1, 0.1])).toMatchObject({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 });
  });

  it("scale a sketch's points with its box", () => {
    const sketch = shape({
      kind: "sketch",
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      points: [
        [0.1, 0.1],
        [0.3, 0.2],
      ],
    });
    expect(resized(sketch, 2, [0.5, 0.3]).points).toEqual([
      [0.1, 0.1],
      [0.5, 0.3],
    ]);
  });

  it("scale a text's size, in proportion, up to what the server keeps", () => {
    const text = shape({ kind: "text", x: 0.1, y: 0.1, w: 0.2, h: 0.1, size: 0.03 });
    expect(resized(text, 2, [0.5, 0.9])).toMatchObject({
      x: 0.1,
      y: 0.1,
      w: 0.4,
      h: 0.2,
      size: 0.06,
    });
    expect(resized(text, 2, [2, 2]).size).toBeLessThanOrEqual(0.5);
  });
});

describe("a TIFF", () => {
  it("says what it holds and carries the pixels as they are", () => {
    const pixels = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
    const file = writeTiff(pixels, 2, 1);
    const view = new DataView(file.buffer);
    expect(String.fromCharCode(file[0] ?? 0, file[1] ?? 0)).toBe("II");
    expect(view.getUint16(2, true)).toBe(42);
    expect(view.getUint32(4, true)).toBe(8);
    expect(view.getUint16(8, true)).toBe(11);
    const tag = (at: number) => [
      view.getUint16(10 + at * 12, true),
      view.getUint32(10 + at * 12 + 8, true),
    ];
    expect(tag(0)).toEqual([256, 2]);
    expect(tag(1)).toEqual([257, 1]);
    expect(tag(8)).toEqual([279, 8]);
    const start = tag(5)[1] ?? 0;
    expect([...file.subarray(start)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("a PDF's table of contents with its pages laid out anew", () => {
  it("goes to each page where it stands now, and leaves out a page taken away", async () => {
    const file = {
      pageCount: 3,
      outline: async () => [
        { title: "One", page: 1, level: 0 },
        { title: "Two", page: 2, level: 1 },
        { title: "Three", page: 3, level: 0 },
      ],
    } as unknown as PdfFile;
    const size = { width: 10, height: 10 };
    const { pdf } = pagedPdf(file, [size, size, size], [3, 0, 1]);
    expect(await pdf.outline()).toEqual([
      { title: "One", page: 3, level: 0 },
      { title: "Three", page: 1, level: 0 },
    ]);
  });
});

describe("a refusal to open a PDF", () => {
  const refused = (code: number) =>
    Object.assign(new Error("No password given"), { name: "PasswordException", code });
  it("tells a password needed from a wrong one, and from anything else", () => {
    expect(passwordRefusal(refused(1))).toBe("needed");
    expect(passwordRefusal(refused(2))).toBe("wrong");
    expect(passwordRefusal(new Error("Invalid PDF structure."))).toBeNull();
  });
});

describe("what the Inspector writes", () => {
  it("writes an exposure and a position as a camera would", () => {
    expect(exposureText(0.004)).toBe("1/250 s");
    expect(exposureText(2)).toBe("2 s");
    expect(degreesText(48.5, "N", "S")).toBe("48.5000° N");
    expect(degreesText(-2.25, "E", "W")).toBe("2.2500° W");
  });
});

const HOME = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"];
const entry = (over: Partial<DriveEntry>): DriveEntry => ({
  id: "beach1",
  parent: "pictures",
  name: "beach.png",
  kind: "file",
  size: 5,
  type: "image/png",
  created_ms: 1,
  modified_ms: 1,
  ...over,
});
const BEACH = entry({});
const PHOTO = entry({ id: "photo1", name: "photo.jpg", type: "image/jpeg" });
const REPORT = entry({ id: "report1", name: "report.pdf", type: "application/pdf" });

function serveListing(files: DriveEntry[]) {
  const entries = [
    ...HOME.map((name) => ({
      id: name.toLowerCase(),
      name,
      kind: "folder" as const,
      size: 0,
      created_ms: 1,
      modified_ms: 1,
    })),
    ...files,
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://desktop.test");
      if (url.pathname === "/api/files/") {
        return new Response(
          JSON.stringify({
            rev: 1,
            entries,
            usage: 0,
            quota: 1_000_000,
            piece_bytes: 4,
            max_file_bytes: 1000,
            max_entries: 100,
            session: `s-${Math.random()}`,
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }),
  );
}

function memoryDrive(bytes: BlobPart = "bytes") {
  const drive = {
    read: vi.fn(async () => new Blob([bytes])),
    save: vi.fn(async (target: { folder: string; name: string }) =>
      entry({ id: "saved1", name: target.name, parent: target.folder }),
    ),
    replace: vi.fn(async (file: DriveEntry) => ({ ...file, id: `${file.id}-2` })),
    current: vi.fn(async () => BEACH),
    opened: vi.fn(),
    create: vi.fn(async (folder: string, name: string, _data: Blob) =>
      entry({ id: "made1", name, parent: folder }),
    ),
    duplicate: vi.fn(async (file: DriveEntry, name: string) => ({ ...file, id: "copy1", name })),
    rename: vi.fn(async (file: DriveEntry, name: string) => ({ ...file, name })),
    move: vi.fn(async (file: DriveEntry, folder: string) => ({ ...file, parent: folder })),
    folders: vi.fn(async () => [
      { id: "documents", path: "Documents" },
      { id: "pictures", path: "Pictures" },
    ]),
  } satisfies PreviewDrive;
  return drive;
}

/** The boxes stroked on every canvas, in pixels, since the test began. */
const boxesStroked: number[][] = [];

function fakeContext(): CanvasRenderingContext2D {
  const values: Record<string | symbol, unknown> = {
    getTransform: () => ({ a: 1, b: 0 }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    strokeRect: (...box: number[]) => void boxesStroked.push(box),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
  };
  return new Proxy(values, {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const stubPdf = (outline: PdfOutlineEntry[] = []): PdfFile => ({
  pageCount: 3,
  size: async () => ({ width: 612, height: 792 }),
  render: vi.fn(async () => true),
  text: async (page) => (page === 1 ? "ferry" : page === 2 ? "ferry ferry ferry" : "ferry ferry"),
  layOutText: async () => {},
  textRuns: async () => [],
  outline: async () => outline,
  fields: async () => [],
  setField: () => {},
  filled: async () => new Uint8Array([7]),
  security: async () => ({}),
  links: async () => [],
  combined: async () => new Uint8Array([1, 2, 3]),
  destroy: vi.fn(),
});

const release = vi.fn();
const stubImage = async () => ({
  image: document.createElement("canvas"),
  width: 400,
  height: 300,
  release,
});

function AppMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("preview", title);
  return (
    <Menu>
      <MenuTrigger aria-label={`Menu ${title}`}>{title}</MenuTrigger>
      <MenuPopup>{items}</MenuPopup>
    </Menu>
  );
}

const MENUS = ["File", "Edit", "View", "Tools", "Window"];
type User = ReturnType<typeof userEvent.setup>;

async function start(
  file: DriveEntry,
  options: {
    drive?: ReturnType<typeof memoryDrive>;
    loadPdf?: (blob: Blob, password?: string) => Promise<PdfFile>;
  } = {},
) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  serveListing([file]);
  await loadDrive();
  const drive = options.drive ?? memoryDrive();
  render(
    <>
      {MENUS.map((title) => (
        <AppMenu key={title} title={title} />
      ))}
      <PreviewApp
        drive={drive}
        served={false}
        loadImage={stubImage}
        loadPdf={options.loadPdf ?? (async () => stubPdf())}
      />
    </>,
  );
  const dialog = await screen.findByRole("dialog", { name: "Open" });
  await user.dblClick(await within(dialog).findByRole("option", { name: file.name }));
  return { user, drive };
}

const titled = (text: string | RegExp) =>
  screen.findByText(text, { selector: ".mac-title-bar-title-text" });

/** Opens the menu `title` and finds its row `row`; `path` goes through submenus first. */
async function rowOf(user: User, title: string, row: string, path: string[] = []) {
  await user.click(screen.getByRole("button", { name: `Menu ${title}` }));
  for (const step of path) {
    await user.click(await screen.findByRole("menuitem", { name: new RegExp(`^${step}`) }));
  }
  return screen.findByRole("menuitem", { name: new RegExp(`^${row}`) });
}

const choose = async (user: User, title: string, row: string, path: string[] = []) => {
  const found = await rowOf(user, title, row, path);
  // A real click's pointer would leave the submenu's title on its way, which closes the submenu in
  // jsdom, where there is no layout for its safe triangle.
  if (path.length > 0) fireEvent.click(found);
  else await user.click(found);
};

const pageWidth = () =>
  Number.parseFloat((document.querySelector('[data-page="1"]') as HTMLElement).style.width);

/** Puts the keyboard in the window's document, where its keys are heard. */
const focusDocument = (name: string) => screen.getByRole("document", { name }).focus();

beforeEach(() => {
  beginDesktopValues();
  boxesStroked.length = 0;
  release.mockClear();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => fakeContext() as unknown as ReturnType<HTMLCanvasElement["getContext"]>,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    done: BlobCallback,
    type?: string,
  ) {
    done(new Blob([`canvas ${this.width}x${this.height}`], { type: type ?? "image/png" }));
  });
});

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("File", () => {
  it("Duplicate copies the file beside itself and shows the copy", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    focusDocument("beach.png");
    await user.keyboard("{Meta>}{Shift>}s{/Shift}{/Meta}");
    await titled("beach copy.png");
    expect(drive.duplicate).toHaveBeenCalledWith(BEACH, "beach copy.png");
    expect(drive.create).not.toHaveBeenCalled();
  });

  it("Duplicate writes a picture with changes as it is now", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await user.click(screen.getByRole("button", { name: "Rotate Right" }));
    await choose(user, "File", "Duplicate");
    // The turned picture is not saved in the first file, so that is asked about first.
    const alert = await screen.findByRole("alertdialog");
    await user.click(within(alert).getByRole("button", { name: "Don’t Save" }));
    await titled("beach copy.png");
    expect(drive.duplicate).not.toHaveBeenCalled();
    const [folder, name, data] = drive.create.mock.calls[0] ?? [];
    expect([folder, name]).toEqual(["pictures", "beach copy.png"]);
    expect(await data?.text()).toBe("canvas 300x400");
  });

  it("Rename… renames the file and keeps the picture open", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "File", "Rename…");
    const name = await screen.findByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "shore.png{Enter}");
    await titled("shore.png");
    expect(drive.rename).toHaveBeenCalledWith(BEACH, "shore.png");
    expect(await screen.findByText("Renamed to “shore.png”.")).toBeInTheDocument();
    expect(release).not.toHaveBeenCalled();
  });

  it("Rename… says why the drive refused", async () => {
    const drive = memoryDrive();
    drive.rename.mockRejectedValueOnce(new Error("The folder has one of that name."));
    const { user } = await start(BEACH, { drive });
    await titled("beach.png");
    await choose(user, "File", "Rename…");
    const name = await screen.findByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "taken.png{Enter}");
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "“beach.png” was not changed. The folder has one of that name.",
    );
  });

  it("Move To… moves the file to the folder chosen", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "File", "Move To…");
    const sheet = await screen.findByRole("dialog", { name: "Move “beach.png”" });
    expect(within(sheet).getByRole("button", { name: "Move" })).toBeDisabled();
    await user.click(await within(sheet).findByRole("combobox", { name: "Where" }));
    await user.click(await screen.findByRole("option", { name: "Documents" }));
    await user.click(within(sheet).getByRole("button", { name: "Move" }));
    await waitFor(() => expect(drive.move).toHaveBeenCalledWith(BEACH, "documents"));
    expect(await screen.findByText("Moved “beach.png”.")).toBeInTheDocument();
  });

  it("Revert To > Last Saved takes the changes back, and Undo brings them again", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await user.click(screen.getByRole("button", { name: "Rotate Right" }));
    await titled("beach.png — Edited");
    await choose(user, "File", "Last Saved", ["Revert To"]);
    await titled("beach.png");
    focusDocument("beach.png");
    await user.keyboard("{Meta>}z{/Meta}");
    await titled("beach.png — Edited");
  });

  it("asks for a locked PDF's password, says when it is wrong, and opens with the right one", async () => {
    const passwords: (string | undefined)[] = [];
    const loadPdf = async (_blob: Blob, password?: string) => {
      passwords.push(password);
      if (password === "swordfish") return stubPdf();
      throw Object.assign(new Error("No password given"), {
        name: "PasswordException",
        code: password === undefined ? 1 : 2,
      });
    };
    const { user } = await start(REPORT, { loadPdf });
    const name = { name: "“report.pdf” is locked with a password." };
    let sheet = await screen.findByRole("dialog", name);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.type(within(sheet).getByLabelText("Password"), "guess{Enter}");
    expect(await screen.findByText("That password is not the right one.")).toBeInTheDocument();
    sheet = await screen.findByRole("dialog", name);
    const field = within(sheet).getByLabelText("Password");
    await user.clear(field);
    await user.type(field, "swordfish{Enter}");
    await titled("report.pdf (page 1 of 3)");
    expect(passwords).toEqual([undefined, "guess", "swordfish"]);
  });

  it("Enter Password… is dimmed on a document that is not locked, saying so", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    const row = await rowOf(user, "File", "Enter Password…");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("title", "This document is not locked with a password.");
  });

  it("New from Clipboard writes the copied picture to Pictures and opens it", async () => {
    const png = new Blob(["picture"], { type: "image/png" });
    const read = vi.fn(async () => [{ types: ["image/png"], getType: async () => png }]);
    const { user, drive } = await start(BEACH);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { read } });
    await titled("beach.png");
    await choose(user, "File", "New from Clipboard");
    await titled("Untitled.png");
    expect(drive.create).toHaveBeenCalledWith("pictures", "Untitled.png", png);
  });

  it("New from Clipboard says when the clipboard has no picture", async () => {
    const read = vi.fn(async () => [{ types: ["text/plain"], getType: async () => new Blob() }]);
    const { user, drive } = await start(BEACH);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { read } });
    await titled("beach.png");
    await choose(user, "File", "New from Clipboard");
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "The clipboard holds no picture.",
    );
    expect(drive.create).not.toHaveBeenCalled();
  });

  it("exports a PDF with nothing changed as the file itself", async () => {
    const urls: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        urls.push(blob);
        return "blob:test";
      },
      revokeObjectURL: () => {},
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "Download as PDF" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(await urls.at(-1)?.text()).toBe("bytes");
    expect(urls.at(-1)?.type).toBe("application/pdf");
    click.mockRestore();
  });

  it("exports a picture as a TIFF of its pixels", async () => {
    const urls: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        urls.push(blob);
        return "blob:test";
      },
      revokeObjectURL: () => {},
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { user } = await start(BEACH);
    await titled("beach.png");
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "Download as TIFF" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const tiff = urls.at(-1) as Blob;
    expect(tiff.type).toBe("image/tiff");
    expect(tiff.size).toBe(154 + 400 * 300 * 4);
    click.mockRestore();
  });

  it("Export… asks a JPEG's quality and dims the formats a browser cannot write", async () => {
    const { user } = await start(PHOTO);
    await titled("photo.jpg");
    await choose(user, "File", "Export…");
    const sheet = await screen.findByRole("dialog", { name: "Export the document" });
    expect(await within(sheet).findByRole("slider", { name: "Quality" })).toHaveValue("0.92");
    await user.click(within(sheet).getByRole("combobox", { name: "Format" }));
    expect(await screen.findByRole("option", { name: "HEIC" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("rows a web page cannot carry out", () => {
  it.each([
    ["File", "Import from iPhone", [], /iPhone/],
    ["File", "Import from Scanner", [], /scanner/],
    ["File", "Import from Camera", [], /camera/],
    ["File", "Previous Save", ["Revert To"], /no earlier versions/],
    ["File", "Browse All Versions", ["Revert To"], /no earlier versions/],
    ["View", "Show Tab Bar", [], /tabs/],
    ["View", "Show All Tabs", [], /tabs/],
    ["Tools", "Assign Profile…", [], /colour profile/],
    ["Window", "Merge All Windows", [], /tabs/],
    ["Window", "Move Tab to New Window", [], /tabs/],
  ] as const)("%s > %s is dimmed, saying why", async (menu, name, path, reason) => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    const row = await rowOf(user, menu, name, [...path]);
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row.getAttribute("title")).toMatch(reason);
  });
});

describe("Edit", () => {
  it("Copy puts the picture on the clipboard as PNG", async () => {
    const write = vi.fn(async (_items: unknown[]) => {});
    class Item {
      constructor(readonly parts: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal("ClipboardItem", Item);
    const { user } = await start(BEACH);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } });
    await titled("beach.png");
    await choose(user, "Edit", "Copy");
    expect(await screen.findByText("Copied the picture.")).toBeInTheDocument();
    const item = write.mock.calls[0]?.[0]?.[0] as Item;
    expect(await (await item.parts["image/png"])?.text()).toBe("canvas 400x300");
  });
});

describe("View", () => {
  it("Table of Contents lists the file's and goes to the page chosen", async () => {
    const { user } = await start(REPORT, {
      loadPdf: async () =>
        stubPdf([
          { title: "Opening", page: 1, level: 0 },
          { title: "Crossing", page: 2, level: 1 },
        ]),
    });
    await titled("report.pdf (page 1 of 3)");
    await user.click(screen.getByRole("button", { name: "Menu View" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Table of Contents" }));
    const list = await screen.findByRole("listbox", { name: "Table of Contents" });
    const row = within(list).getByRole("option", { name: "Crossing" });
    await user.click(row);
    await titled("report.pdf (page 2 of 3)");
  });

  it("Table of Contents says when the file has none", async () => {
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    await user.click(screen.getByRole("button", { name: "Menu View" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Table of Contents" }));
    expect(await screen.findByText("No Table of Contents")).toBeInTheDocument();
  });

  it("the toolbar's View pull-down chooses the page layout too", async () => {
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    expect(screen.getAllByRole("img", { name: /^Page / })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Single Page" }));
    await waitFor(() => expect(screen.getAllByRole("img", { name: /^Page / })).toHaveLength(1));
  });

  it("Hide Toolbar takes the toolbar away, and Show Toolbar brings it back", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    expect(screen.getByRole("toolbar", { name: "Preview toolbar" })).toBeInTheDocument();
    await choose(user, "View", "Hide Toolbar");
    expect(screen.queryByRole("toolbar", { name: "Preview toolbar" })).toBeNull();
    await choose(user, "View", "Show Toolbar");
    expect(screen.getByRole("toolbar", { name: "Preview toolbar" })).toBeInTheDocument();
  });

  it("Show Markup Toolbar is in View", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "View", "Show Markup Toolbar");
    expect(screen.getByRole("toolbar", { name: "Markup" })).toBeInTheDocument();
  });

  it("Zoom to Selection is dimmed until something is selected, then fits it", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    const dimmed = await rowOf(user, "View", "Zoom to Selection");
    expect(dimmed).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await choose(user, "Tools", "Rectangular Selection");
    const before = pageWidth();
    dragOverPage([100, 75], [200, 150]);
    await choose(user, "View", "Zoom to Selection");
    // A quarter of the picture's width was selected in a view that fits the whole.
    await waitFor(() => expect(pageWidth() / before).toBeGreaterThan(2));
  });

  it("Slideshow steps through the pages and ends at Escape where it stopped", async () => {
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    focusDocument("report.pdf");
    await user.keyboard("{Meta>}{Shift>}f{/Shift}{/Meta}");
    const show = await screen.findByRole("dialog", { name: "Slideshow" });
    expect(within(show).getByRole("img", { name: "Page 1" })).toBeInTheDocument();
    await user.click(within(show).getByRole("button", { name: "Pause" }));
    await user.click(within(show).getByRole("button", { name: "Next" }));
    expect(within(show).getByRole("img", { name: "Page 2" })).toBeInTheDocument();
    fireEvent.keyDown(show, { key: "ArrowRight" });
    expect(within(show).getByRole("img", { name: "Page 3" })).toBeInTheDocument();
    expect(within(show).getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.keyDown(show, { key: "ArrowLeft" });
    fireEvent.keyDown(show, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Slideshow" })).toBeNull();
    await titled("report.pdf (page 2 of 3)");
  });

  it("Slideshow goes on by itself until paused", async () => {
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    await choose(user, "View", "Slideshow");
    const show = await screen.findByRole("dialog", { name: "Slideshow" });
    await user.click(within(show).getByRole("button", { name: "Pause" }));
    vi.useFakeTimers();
    try {
      fireEvent.click(within(show).getByRole("button", { name: "Play" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100);
      });
      expect(within(show).getByRole("img", { name: "Page 2" })).toBeInTheDocument();
      fireEvent.click(within(show).getByRole("button", { name: "Pause" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100);
      });
      expect(within(show).getByRole("img", { name: "Page 2" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

/** A drag across the page's marks, on a page 400 × 300 points on the screen. */
function dragOverPage(from: [number, number], to: [number, number]) {
  const marks = document.querySelector(".mac-preview-app-page-marks") as HTMLCanvasElement;
  vi.spyOn(marks, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
  } as DOMRect);
  fireEvent.pointerDown(marks, { button: 0, clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(marks, { clientX: to[0], clientY: to[1], pointerId: 1 });
  fireEvent.pointerUp(marks, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

describe("Tools and the markup bar", () => {
  it("a chosen rectangle is resized by dragging its corner", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "Tools", "Rectangle", ["Annotate"]);
    expect(screen.getByRole("toolbar", { name: "Markup" })).toBeInTheDocument();
    dragOverPage([40, 30], [120, 90]);
    await user.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.pointerDown(document.querySelector(".mac-preview-app-page-marks") as Element, {
      button: 0,
      clientX: 80,
      clientY: 60,
      pointerId: 1,
    });
    fireEvent.pointerUp(document.querySelector(".mac-preview-app-page-marks") as Element, {
      clientX: 80,
      clientY: 60,
      pointerId: 1,
    });
    boxesStroked.length = 0;
    dragOverPage([120, 90], [200, 150]);
    await waitFor(() => {
      const drawn = boxesStroked.at(-1) ?? [];
      expect(drawn.map(Math.round)).toEqual([40, 30, 160, 120]);
    });
    // One change: Undo goes back to the size it was drawn at.
    boxesStroked.length = 0;
    focusDocument("beach.png");
    await user.keyboard("{Meta>}z{/Meta}");
    await waitFor(() => {
      expect((boxesStroked.at(-1) ?? []).map(Math.round)).toEqual([40, 30, 80, 60]);
    });
  });

  it("Text Selection puts the markup bar away, for the pointer to select a PDF's text", async () => {
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    await choose(user, "Tools", "Arrow", ["Annotate"]);
    expect(screen.getByRole("toolbar", { name: "Markup" })).toBeInTheDocument();
    await choose(user, "Tools", "Text Selection");
    expect(screen.queryByRole("toolbar", { name: "Markup" })).toBeNull();
  });

  it("the Draw tool is dimmed, saying why", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await user.click(screen.getByRole("button", { name: "Show Markup Toolbar" }));
    const draw = screen.getByRole("button", { name: "Draw" });
    expect(draw).toHaveAttribute("aria-disabled", "true");
    expect(draw).toHaveAttribute("title", expect.stringMatching(/Force Touch/));
  });

  it("the backtick shows and hides the magnifier, which follows the pointer", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    expect(screen.queryByRole("img", { name: "Magnifier" })).toBeNull();
    focusDocument("beach.png");
    await user.keyboard("`");
    const canvas = document.querySelector(".mac-preview-app-magnifier") as HTMLCanvasElement;
    expect(canvas).toHaveAttribute("hidden");
    fireEvent.pointerMove(screen.getByRole("img", { name: "Page 1" }), {
      clientX: 100,
      clientY: 100,
    });
    await waitFor(() => expect(canvas).not.toHaveAttribute("hidden"));
    await user.keyboard("`");
    expect(document.querySelector(".mac-preview-app-magnifier")).toBeNull();
  });
});

/** A JPEG's first bytes: an EXIF segment naming a camera and a position in the Southern hemisphere. */
function jpegWithExif() {
  const tiff = new DataView(new ArrayBuffer(160));
  const text = (at: number, value: string) => {
    [...value].forEach((character, index) => {
      tiff.setUint8(at + index, character.charCodeAt(0));
    });
  };
  const put = (at: number, tag: number, type: number, count: number, value: number) => {
    tiff.setUint16(at, tag);
    tiff.setUint16(at + 2, type);
    tiff.setUint32(at + 4, count);
    tiff.setUint32(at + 8, value);
  };
  text(0, "MM");
  tiff.setUint16(2, 42);
  tiff.setUint32(4, 8);
  // The first directory: the make, and where the GPS directory is.
  tiff.setUint16(8, 2);
  put(10, 0x010f, 2, 4, 0);
  text(18, "Sony");
  put(22, 0x8825, 4, 1, 40);
  // The GPS directory: south, 33.5 degrees; east, 151.25 degrees.
  tiff.setUint16(40, 4);
  put(42, 1, 2, 2, 0);
  text(50, "S");
  put(54, 2, 5, 1, 100);
  put(66, 3, 2, 2, 0);
  text(74, "E");
  put(78, 4, 5, 1, 110);
  tiff.setUint32(100, 67);
  tiff.setUint32(104, 2);
  tiff.setUint32(110, 605);
  tiff.setUint32(114, 4);
  const header = [
    0xff,
    0xd8,
    0xff,
    0xe1,
    (tiff.byteLength + 8) >> 8,
    (tiff.byteLength + 8) & 0xff,
    ...[..."Exif"].map((character) => character.charCodeAt(0)),
    0,
    0,
  ];
  return new Uint8Array([...header, ...new Uint8Array(tiff.buffer)]);
}

describe("the Inspector", () => {
  const openTab = async (user: User, name: string) => {
    focusDocument(
      document.querySelector(".mac-preview-app [role='document']")?.getAttribute("aria-label") ??
        "",
    );
    await user.keyboard("{Meta>}i{/Meta}");
    await user.click(await screen.findByRole("button", { name }));
  };

  it("More Info gives a JPEG's camera and where it was taken", async () => {
    const { user } = await start(PHOTO, { drive: memoryDrive(jpegWithExif()) });
    await titled("photo.jpg");
    await openTab(user, "More Info");
    expect(await screen.findByText("Sony")).toBeInTheDocument();
    expect(screen.getByText("33.5000° S")).toBeInTheDocument();
    expect(screen.getByText("151.2500° E")).toBeInTheDocument();
  });

  it("More Info says when a picture has no camera details", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await openTab(user, "More Info");
    expect(await screen.findByText("No Camera Details")).toBeInTheDocument();
  });

  it("Annotations lists the marks, and a row chooses its mark", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await openTab(user, "Annotations");
    expect(await screen.findByText("No Annotations")).toBeInTheDocument();
    await choose(user, "Tools", "Oval", ["Annotate"]);
    dragOverPage([40, 30], [120, 90]);
    expect(await screen.findByRole("option", { name: "Oval, page 1" })).toBeInTheDocument();
  });

  it("Crop gives the selection's size and place, in the picture's pixels", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await openTab(user, "Crop");
    expect(await screen.findByRole("textbox", { name: "Width" })).toHaveValue("400");
    await choose(user, "Tools", "Rectangular Selection");
    dragOverPage([100, 75], [200, 150]);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Width" })).toHaveValue("100"));
    expect(screen.getByRole("textbox", { name: "Height" })).toHaveValue("75");
    expect(screen.getByRole("textbox", { name: "Left" })).toHaveValue("100");
    expect(screen.getByRole("textbox", { name: "Top" })).toHaveValue("75");
  });
});

describe("the page", () => {
  it("has a contextual menu that zooms and marks", async () => {
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    const before = pageWidth();
    fireEvent.contextMenu(screen.getByRole("document", { name: "report.pdf" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Highlight Text" })).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Zoom In" }));
    await waitFor(() => expect(pageWidth()).toBeCloseTo(before * 1.25));
  });

  it("zooms to a pinch, which comes as a wheel with Control held, and not to a plain wheel", async () => {
    await start(BEACH);
    await titled("beach.png");
    const before = pageWidth();
    const document_ = screen.getByRole("document", { name: "beach.png" });
    fireEvent.wheel(document_, { deltaY: -50 });
    expect(pageWidth()).toBe(before);
    fireEvent.wheel(document_, { deltaY: -50, ctrlKey: true });
    await waitFor(() => expect(pageWidth()).toBeCloseTo(before * Math.exp(0.5)));
  });
});

describe("the find bar", () => {
  it("sorts the pages found by rank or by their order", async () => {
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "ferry");
    const rows = async () =>
      within(await screen.findByRole("listbox", { name: "Pages found" }))
        .getAllByRole("option")
        .map((row) => row.getAttribute("aria-label") ?? row.textContent);
    await waitFor(async () => expect((await rows()).length).toBe(3));
    expect((await rows()).map((row) => row?.slice(0, 6))).toEqual(["Page 1", "Page 2", "Page 3"]);
    await user.click(screen.getByRole("radio", { name: "Search Rank" }));
    await waitFor(async () =>
      expect((await rows()).map((row) => row?.slice(0, 6))).toEqual(["Page 2", "Page 3", "Page 1"]),
    );
  });
});
