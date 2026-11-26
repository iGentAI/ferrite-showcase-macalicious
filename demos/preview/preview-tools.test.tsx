import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { type DriveEntry, loadDrive } from "../desktop/desktop-files";
import {
  beginDesktopValues,
  changeDesktopValue,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { previewApp } from "./app";
import { PreviewApp } from "./preview-app";
import { adjustPixels, autoLevels, levelsOf, NO_ADJUST } from "./preview-color";
import type { PreviewDrive } from "./preview-drive";
import { blankPdf, withResolutionBytes } from "./preview-export";
import { afterInsertion, applyView, EMPTY_MARKUP, type Mark, ovalOutline } from "./preview-markup";
import { insertionParts, pagedPdf } from "./preview-pages";
import type { PdfFile, PdfLink } from "./preview-pdf";
import { PreviewPreferences } from "./preview-preferences";
import { screenshotName } from "./preview-screenshot";
import {
  bookmarkedPages,
  MAX_BOOKMARKS,
  readBookmarks,
  readSidebarWidth,
  toggledBookmark,
} from "./preview-settings";
import { cleanedSketch, outlineBetween } from "./preview-shapes";
import { fromPixels, toPixels } from "./preview-units";

/*
 * Preview's window, with what it keeps in the settings, what it draws on a picture, what it writes
 * into a PDF and what it takes from the computer and the screen. Stand-ins: a `PreviewDrive` in
 * memory, a
 * listing for the shared Open dialog, a PDF reader in place of pdf.js, a recording 2D context in place
 * of the browser's canvas, and a stream with one frame in place of the browser's screen capture.
 * pdf.js's writing of a combined file and its links are for the journey.
 */

const STYLE = { color: "#000000", stroke: 0.004 };

describe("Adjust Color's pixels", () => {
  const one = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255]);
  it("leave a picture alone at nothing adjusted", () => {
    const pixels = one(10, 100, 200);
    adjustPixels(pixels, 1, 1, NO_ADJUST);
    expect([...pixels]).toEqual([10, 100, 200, 255]);
  });
  it("double the light at half the exposure slider, and leave the alpha", () => {
    const pixels = one(50, 60, 70);
    adjustPixels(pixels, 1, 1, { ...NO_ADJUST, exposure: 0.5 });
    expect([...pixels]).toEqual([100, 120, 140, 255]);
  });
  it("take the colour out at no saturation", () => {
    const pixels = one(255, 0, 0);
    adjustPixels(pixels, 1, 1, { ...NO_ADJUST, saturation: -1 });
    expect(pixels[0]).toBe(54);
    expect(pixels[1]).toBe(54);
    expect(pixels[2]).toBe(54);
  });
  it("warm a picture at a higher temperature", () => {
    const pixels = one(100, 100, 100);
    adjustPixels(pixels, 1, 1, { ...NO_ADJUST, temperature: 1 });
    expect([...pixels]).toEqual([151, 100, 49, 255]);
  });
  it("sharpen a pixel away from its neighbours", () => {
    const pixels = new Uint8ClampedArray(9 * 4).fill(100);
    pixels[4 * 4] = 120;
    adjustPixels(pixels, 3, 3, { ...NO_ADJUST, sharpness: 1 });
    expect(pixels[4 * 4]).toBe(140);
    expect(pixels[0]).toBe(100);
  });
  it("give the levels of a picture, its fullest level being 1", () => {
    const levels = levelsOf(
      new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]),
    );
    expect(levels[0]).toBe(1);
    expect(levels[31]).toBe(0.5);
    expect(levels).toHaveLength(32);
  });
  it("Auto Levels spreads a picture's light over the whole range", () => {
    const dull = new Uint8ClampedArray([64, 64, 64, 255, 191, 191, 191, 255]);
    const { exposure, contrast } = autoLevels(dull);
    expect(contrast).toBeCloseTo(1, 1);
    expect(exposure).toBeCloseTo(0, 1);
    expect(autoLevels(new Uint8ClampedArray([9, 9, 9, 255]))).toEqual({ exposure: 0, contrast: 0 });
  });
});

describe("shapes kept as a line through points", () => {
  it("a star has five points and closes on its first", () => {
    const star = outlineBetween("star", [0, 0], [1, 1], STYLE);
    expect(star.kind).toBe("sketch");
    expect(star.fill).toBeUndefined();
    expect(star.points).toHaveLength(11);
    expect(star.points?.[0]).toEqual([0.5, 0]);
    expect(star.points?.[10]).toEqual(star.points?.[0]);
  });
  it("a polygon has six sides inside the box it is drawn in", () => {
    const shape = outlineBetween("polygon", [0.2, 0.2], [0.4, 0.4], STYLE);
    expect(shape.points).toHaveLength(7);
    for (const [x, y] of shape.points ?? []) {
      expect(x).toBeGreaterThanOrEqual(0.2);
      expect(x).toBeLessThanOrEqual(0.4);
      expect(y).toBeGreaterThanOrEqual(0.2);
      expect(y).toBeLessThanOrEqual(0.4);
    }
  });
  it("a speech bubble reaches down to its tail", () => {
    const ys = outlineBetween("bubble", [0, 0], [1, 1], STYLE).points?.map(([, y]) => y) ?? [];
    expect(Math.max(...ys)).toBe(1);
    expect(ys.filter((y) => y > 0.8)).toEqual([1]);
  });
});

describe("a hand-drawn line", () => {
  const along = (from: [number, number], to: [number, number], count: number) =>
    Array.from({ length: count }, (_, index): [number, number] => [
      from[0] + ((to[0] - from[0]) * index) / (count - 1),
      from[1] + ((to[1] - from[1]) * index) / (count - 1),
    ]);
  it("that is nearly straight becomes a line", () => {
    const wobbly = along([0.1, 0.1], [0.6, 0.4], 9).map(([x, y], index): [number, number] => [
      x,
      y + (index % 2 ? 0.002 : 0),
    ]);
    expect(cleanedSketch(wobbly, 1, STYLE)).toMatchObject({ kind: "line", x: 0.1, y: 0.1 });
  });
  it("round a box becomes a rectangle", () => {
    const box = [
      ...along([0.2, 0.2], [0.6, 0.2], 6),
      ...along([0.6, 0.2], [0.6, 0.5], 6),
      ...along([0.6, 0.5], [0.2, 0.5], 6),
      ...along([0.2, 0.5], [0.2, 0.21], 6),
    ];
    expect(cleanedSketch(box, 1, STYLE)).toMatchObject({
      kind: "rect",
      x: 0.2,
      y: 0.2,
      w: 0.4,
      h: 0.3,
    });
  });
  it("round a circle becomes an oval, as the person saw it on a tall page", () => {
    const circle = ovalOutline({ x: 0.2, y: 0.2, w: 0.4, h: 0.3 }, 40);
    expect(cleanedSketch(circle, 1.3, STYLE)).toMatchObject({ kind: "oval" });
  });
  it("that is neither stays as it was drawn", () => {
    const zigzag = [
      [0.1, 0.1],
      [0.3, 0.5],
      [0.5, 0.1],
      [0.7, 0.5],
      [0.9, 0.1],
    ] as [number, number][];
    expect(cleanedSketch(zigzag, 1, STYLE)).toBeNull();
    expect(cleanedSketch(zigzag.slice(0, 2), 1, STYLE)).toBeNull();
  });
});

describe("bookmarks", () => {
  it("are added, taken off again, and refused past the limit", () => {
    const one = toggledBookmark([], "f", 3);
    expect(one).toEqual([{ file: "f", page: 3 }]);
    expect(toggledBookmark(one ?? [], "f", 3)).toEqual([]);
    const full = Array.from({ length: MAX_BOOKMARKS }, (_, index) => ({
      file: "f",
      page: index + 1,
    }));
    expect(toggledBookmark(full, "f", 99)).toBeNull();
  });
  it("follow a page moved, and leave out one taken away", () => {
    const list = [
      { file: "f", page: 1 },
      { file: "f", page: 3 },
      { file: "g", page: 2 },
    ];
    expect(bookmarkedPages(list, "f", undefined, 3)).toEqual([1, 3]);
    expect(bookmarkedPages(list, "f", [3, 2], 2)).toEqual([1]);
  });
  it("are read only as they were written", () => {
    expect(readBookmarks([{ file: "f", page: 2 }, { file: "f" }, 4])).toEqual([
      { file: "f", page: 2 },
    ]);
    expect(readBookmarks("f")).toBeUndefined();
    expect(readSidebarWidth(999)).toBeUndefined();
  });
});

describe("units", () => {
  it("turn lengths into pixels and back", () => {
    expect(toPixels(2, "inches", 300, 1000)).toBe(600);
    expect(toPixels(50, "percent", 300, 1000)).toBe(500);
    expect(toPixels(2.54, "cm", 100, 1000)).toBe(100);
    expect(fromPixels(600, "inches", 300, 1000)).toBe("2");
    expect(fromPixels(499.6, "pixels", 300, 1000)).toBe("500");
    expect(fromPixels(250, "percent", 72, 1000)).toBe("25");
  });
});

describe("the resolution a picture says it has", () => {
  it("is a pHYs chunk after a PNG's header", () => {
    const png = new Uint8Array(45);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const written = withResolutionBytes(png, 254);
    expect(written).toHaveLength(66);
    expect(String.fromCharCode(...written.subarray(37, 41))).toBe("pHYs");
    const view = new DataView(written.buffer);
    expect(view.getUint32(33)).toBe(9);
    expect(view.getUint32(41)).toBe(10000);
    expect(written[49]).toBe(1);
    // The chunk's CRC, of its type and data, as Python's zlib.crc32 gives it.
    expect(view.getUint32(50)).toBe(0x94695119);
  });
  it("is the density of a JPEG's JFIF segment", () => {
    const jpeg = new Uint8Array(20);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0]);
    const written = withResolutionBytes(jpeg, 300);
    expect([...written.subarray(13, 18)]).toEqual([1, 1, 44, 1, 44]);
    expect(jpeg[13]).toBe(0);
  });
  it("leaves any other file as it is", () => {
    const other = new Uint8Array([1, 2, 3]);
    expect(withResolutionBytes(other, 300)).toBe(other);
  });
});

describe("inserting pages", () => {
  const bytes = new Uint8Array([9]);
  const blank = new Uint8Array([0]);
  it("lays out the file's runs around what goes in", () => {
    expect(insertionParts([1, 2, 3], 1, { bytes, count: 2 }, blank)).toEqual([
      { document: null, pages: [1], at: [0] },
      { document: bytes, pages: [1, 2], at: [1, 2] },
      { document: null, pages: [2, 3], at: [3, 4] },
    ]);
  });
  it("keeps moved pages where they are shown, and blank ones", () => {
    expect(insertionParts([3, 0, 1], 3, { bytes, count: 1 }, blank)).toEqual([
      { document: null, pages: [3], at: [0] },
      { document: blank, pages: [1], at: [1] },
      { document: null, pages: [1], at: [2] },
      { document: bytes, pages: [1], at: [3] },
    ]);
  });
  it("renumbers the marks past them and the file needs no order", () => {
    const mark = { id: "m" } as Mark;
    expect(
      afterInsertion(
        {
          ...EMPTY_MARKUP,
          order: [2, 1],
          pages: [
            { page: 1, items: [mark] },
            { page: 2, items: [mark] },
          ],
        },
        1,
        3,
      ),
    ).toEqual({
      rotation: 0,
      pages: [
        { page: 1, items: [mark] },
        { page: 5, items: [mark] },
      ],
    });
  });
  it("a blank page's PDF names its size and where its table is", () => {
    const text = new TextDecoder().decode(blankPdf(612, 792));
    expect(text).toContain("/MediaBox [0 0 612 792]");
    const table = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(table, table + 4)).toBe("xref");
  });
});

describe("a view cut to an outline", () => {
  it("clips to each outline after its crop, in the page's pixels", () => {
    const calls: string[] = [];
    const context = {
      translate() {},
      rotate() {},
      scale() {},
      beginPath() {},
      rect() {},
      closePath: () => calls.push("close"),
      lineTo: (x: number, y: number) => calls.push(`${x},${y}`),
      clip: () => calls.push("clip"),
    } as unknown as CanvasRenderingContext2D;
    applyView(
      context,
      100,
      50,
      {
        crop: { x: 0, y: 0, w: 1, h: 1 },
        turns: 0,
        clips: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        ],
      },
      { width: 100, height: 50 },
    );
    expect(calls).toEqual(["clip", "0,0", "100,0", "100,50", "close", "clip"]);
  });
});

describe("a screenshot's name", () => {
  it("is as a Mac writes it", () => {
    expect(screenshotName(new Date(2020, 0, 5, 9, 3, 7))).toBe(
      "Screen Shot 2020-01-05 at 09.03.07.png",
    );
  });
});

describe("a PDF's links with its pages laid out anew", () => {
  it("follow a page moved, and leave out one to a page taken away", async () => {
    const place = { x: 0, y: 0, w: 1, h: 1 };
    const file = {
      pageCount: 3,
      links: async () => [
        { ...place, page: 3 },
        { ...place, page: 2 },
        { ...place, url: "https://example.com/" },
      ],
    } as unknown as PdfFile;
    const size = { width: 10, height: 10 };
    const { pdf } = pagedPdf(file, [size, size, size], [1, 3]);
    expect(await pdf.links(1)).toEqual([
      { ...place, page: 2 },
      { ...place, url: "https://example.com/" },
    ]);
  });
});

/* The window. */

const HOME = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"];
const entry = (over: Partial<DriveEntry>): DriveEntry => ({
  id: "beach1",
  parent: "pictures",
  name: "beach.png",
  kind: "file",
  size: 1_000_000,
  type: "image/png",
  created_ms: 1,
  modified_ms: 1,
  ...over,
});
const BEACH = entry({});
const REPORT = entry({ id: "report1", name: "report.pdf", type: "application/pdf" });
const EXTRA = entry({
  id: "extra1",
  parent: "documents",
  name: "extra.pdf",
  type: "application/pdf",
});

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

function memoryDrive() {
  return {
    read: vi.fn(async () => new Blob(["bytes"])),
    save: vi.fn(async (target: { folder: string; name: string }) =>
      entry({ id: "saved1", name: target.name, parent: target.folder }),
    ),
    replace: vi.fn(async (file: DriveEntry, _data: Blob) => ({ ...file, id: `${file.id}-2` })),
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
}

/** The colours and paths given to every canvas since the test began. */
let putImages = 0;

function fakeContext(): CanvasRenderingContext2D {
  const values: Record<string | symbol, unknown> = {
    getTransform: () => ({ a: 1, b: 0 }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    putImageData: () => {
      putImages += 1;
    },
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4).fill(128),
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

const stubPdf = (links: PdfLink[] = []): PdfFile => ({
  pageCount: 3,
  size: async () => ({ width: 612, height: 792 }),
  render: vi.fn(async () => true),
  text: async () => "ferry",
  layOutText: async () => {},
  textRuns: async () => [],
  outline: async () => [],
  fields: async () => [],
  setField: () => {},
  filled: async () => new Uint8Array([7]),
  security: async () => ({}),
  links: async (page) => (page === 1 ? links : []),
  combined: vi.fn(async () => new Uint8Array([1, 2, 3])),
  destroy: vi.fn(),
});

const stubImage = async () => ({
  image: document.createElement("canvas"),
  width: 400,
  height: 300,
  release: vi.fn(),
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

const MENUS = ["File", "Edit", "View", "Tools"];
type User = ReturnType<typeof userEvent.setup>;

async function start(
  file: DriveEntry,
  options: { drive?: ReturnType<typeof memoryDrive>; pdf?: PdfFile; others?: DriveEntry[] } = {},
) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  serveListing([file, ...(options.others ?? [])]);
  await loadDrive();
  const drive = options.drive ?? memoryDrive();
  const pdf = options.pdf ?? stubPdf();
  const view = render(
    <>
      {MENUS.map((title) => (
        <AppMenu key={title} title={title} />
      ))}
      <PreviewApp drive={drive} served={false} loadImage={stubImage} loadPdf={async () => pdf} />
    </>,
  );
  const dialog = await screen.findByRole("dialog", { name: "Open" });
  await user.dblClick(await within(dialog).findByRole("option", { name: file.name }));
  return { user, drive, pdf, view };
}

const titled = (text: string | RegExp) =>
  screen.findByText(text, { selector: ".mac-title-bar-title-text" });

async function rowOf(user: User, title: string, row: string, path: string[] = []) {
  await user.click(screen.getByRole("button", { name: `Menu ${title}` }));
  for (const step of path) {
    await user.click(await screen.findByRole("menuitem", { name: new RegExp(`^${step}`) }));
  }
  return screen.findByRole("menuitem", { name: new RegExp(`^${row}`) });
}

const choose = async (user: User, title: string, row: string, path: string[] = []) => {
  const found = await rowOf(user, title, row, path);
  if (path.length > 0) fireEvent.click(found);
  else await user.click(found);
};

const focusDocument = (name: string) => screen.getByRole("document", { name }).focus();

function dragOverPage(points: readonly (readonly [number, number])[]) {
  const marks = document.querySelector(".mac-preview-app-page-marks") as HTMLCanvasElement;
  vi.spyOn(marks, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
  } as DOMRect);
  const [first, ...rest] = points;
  const last = points.at(-1) as readonly [number, number];
  fireEvent.pointerDown(marks, {
    button: 0,
    clientX: first?.[0],
    clientY: first?.[1],
    pointerId: 1,
  });
  for (const [x, y] of rest) fireEvent.pointerMove(marks, { clientX: x, clientY: y, pointerId: 1 });
  fireEvent.pointerUp(marks, { clientX: last[0], clientY: last[1], pointerId: 1 });
}

/** The picture written by Duplicate, which draws it as it is now: the size of its canvas. */
async function writtenSize(user: User, drive: ReturnType<typeof memoryDrive>) {
  focusDocument("beach.png");
  await user.keyboard("{Meta>}{Shift>}s{/Shift}{/Meta}");
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Don’t Save" }),
  );
  await waitFor(() => expect(drive.create).toHaveBeenCalled());
  const data = drive.create.mock.calls[0]?.[2];
  return data?.text();
}

beforeEach(() => {
  beginDesktopValues();
  putImages = 0;
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

describe("what is kept across a reload", () => {
  it("the sidebar chosen, which the next PDF opens with", async () => {
    const { user, view } = await start(REPORT);
    await titled(/^report\.pdf/);
    await user.click(screen.getByRole("button", { name: "Menu View" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Bookmarks" }));
    expect(desktopValues()["preview.sidebar"]).toBe("bookmarks");
    expect(await screen.findByText("No Bookmarks")).toBeInTheDocument();
    view.unmount();
    await start(REPORT);
    await titled(/^report\.pdf/);
    expect(await screen.findByText("No Bookmarks")).toBeInTheDocument();
  });

  it("a sidebar hidden, and the settings arriving after the PDF has opened", async () => {
    const { user } = await start(REPORT);
    await titled(/^report\.pdf/);
    expect(screen.getByRole("listbox", { name: "Thumbnails" })).toBeInTheDocument();
    act(() => changeDesktopValue("preview.sidebar", "bookmarks"));
    expect(await screen.findByText("No Bookmarks")).toBeInTheDocument();
    act(() => changeDesktopValue("preview.sidebar", "hidden"));
    await user.click(screen.getByRole("button", { name: "Menu View" }));
    expect(await screen.findByRole("menuitemradio", { name: "Hide Sidebar" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("the line width, the colours and the text size", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "View", "Show Markup Toolbar");
    await user.click(screen.getByRole("button", { name: "Shape Style" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Thick" }));
    await user.click(screen.getByRole("button", { name: "Fill Color" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Green" }));
    await user.click(screen.getByRole("button", { name: "Text Style" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Large" }));
    expect(desktopValues()).toMatchObject({
      "preview.stroke": 0.008,
      "preview.fill": "#28cd41",
      "preview.textSize": 0.045,
    });
  });
});

describe("Preferences", () => {
  it("are the window Preview's application menu opens", () => {
    expect(previewApp.preferences.component).toBe(PreviewPreferences);
  });

  it("give the window its background, and what 100% means", async () => {
    const { user, view } = await start(BEACH);
    await titled("beach.png");
    view.unmount();
    render(<PreviewPreferences />);
    fireEvent.input(screen.getByLabelText("Window background"), { target: { value: "#112233" } });
    expect(desktopValues()["preview.imageBackground"]).toBe("#112233");
    await user.click(screen.getByRole("combobox", { name: "Define 100% scale as" }));
    await user.click(
      await screen.findByRole("option", { name: "Size on screen equals size on printout" }),
    );
    expect(desktopValues()["preview.imageScale"]).toBe("paper");
  });

  it("colour the canvas of a picture and not of a PDF", async () => {
    changeDesktopValue("preview.imageBackground", "#112233");
    const { view } = await start(BEACH);
    await titled("beach.png");
    const canvas = () => document.querySelector(".mac-preview-app-canvas") as HTMLElement;
    expect(canvas().style.getPropertyValue("--mac-preview-canvas")).toBe("#112233");
    view.unmount();
    await start(REPORT);
    await titled(/^report\.pdf/);
    expect(canvas().style.getPropertyValue("--mac-preview-canvas")).toBe("");
  });

  it("make Actual Size the size on paper", async () => {
    changeDesktopValue("preview.imageScale", "paper");
    const { user } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "View", "Actual Size");
    const leaf = document.querySelector('[data-page="1"]') as HTMLElement;
    await waitFor(() => expect(Number.parseFloat(leaf.style.width)).toBeCloseTo((400 * 96) / 72));
  });
});

describe("Bookmarks", () => {
  it("Add Bookmark keeps the page shown, listed in the sidebar, and takes it off again", async () => {
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    focusDocument("report.pdf");
    await user.keyboard("{Meta>}d{/Meta}");
    expect(desktopValues()["preview.bookmarks"]).toEqual([{ file: "report1", page: 1 }]);
    await user.click(screen.getByRole("button", { name: "Menu View" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Bookmarks" }));
    const list = await screen.findByRole("listbox", { name: "Bookmarks" });
    expect(within(list).getByRole("option", { name: "Page 1" })).toBeInTheDocument();
    expect(await rowOf(user, "Tools", "Remove Bookmark")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await choose(user, "Tools", "Remove Bookmark");
    expect(desktopValues()["preview.bookmarks"]).toEqual([]);
    expect(await screen.findByText("No Bookmarks")).toBeInTheDocument();
  });

  it("a row goes to its page", async () => {
    changeDesktopValue("preview.bookmarks", [{ file: "report1", page: 3 }]);
    changeDesktopValue("preview.sidebar", "bookmarks");
    const { user } = await start(REPORT);
    await titled("report.pdf (page 1 of 3)");
    await user.click(await screen.findByRole("option", { name: "Page 3" }));
    await titled("report.pdf (page 3 of 3)");
  });

  it("Add Bookmark is dimmed on a picture, saying why", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    const row = await rowOf(user, "Tools", "Add Bookmark");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("title", "Only a PDF has pages to bookmark.");
  });
});

describe("selections of a picture", () => {
  it("Select All selects what it keeps, and Deselect All lets it go", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    expect(await rowOf(user, "Edit", "Deselect All")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    focusDocument("beach.png");
    await user.keyboard("{Meta>}a{/Meta}");
    expect(await rowOf(user, "View", "Zoom to Selection")).not.toHaveAttribute("aria-disabled");
    await user.keyboard("{Escape}");
    await choose(user, "Edit", "Deselect All");
    expect(await rowOf(user, "View", "Zoom to Selection")).toHaveAttribute("aria-disabled", "true");
  });

  it("Elliptical Selection crops to its box and marks the picture edited", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "Tools", "Elliptical Selection");
    dragOverPage([
      [100, 75],
      [300, 225],
    ]);
    await choose(user, "Tools", "Crop");
    await titled("beach.png — Edited");
    expect(await writtenSize(user, drive)).toBe("canvas 200x150");
  });

  it("Lasso Selection crops to the box of what it went round", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "Tools", "Lasso Selection");
    dragOverPage([
      [100, 75],
      [300, 75],
      [300, 225],
      [100, 225],
      [100, 80],
    ]);
    await choose(user, "Tools", "Crop");
    await titled("beach.png — Edited");
    expect(await writtenSize(user, drive)).toBe("canvas 200x150");
  });

  it("are dimmed on a PDF, saying why", async () => {
    const { user } = await start(REPORT);
    await titled(/^report\.pdf/);
    const row = await rowOf(user, "Tools", "Lasso Selection");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute(
      "title",
      "Only a picture has a selection to crop to here, not a PDF’s page.",
    );
  });

  it("the Inspector's Crop values can be typed", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    focusDocument("beach.png");
    await user.keyboard("{Meta>}i{/Meta}");
    await user.click(await screen.findByRole("button", { name: "Crop" }));
    const width = await screen.findByRole("textbox", { name: "Width" });
    expect(width).toHaveValue("400");
    await user.clear(width);
    await user.type(width, "100{Enter}");
    expect(await screen.findByText("Selection")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveValue("100");
    expect(screen.getByRole("textbox", { name: "Height" })).toHaveValue("300");
  });
});

describe("the markup bar's shapes", () => {
  const barTool = async (user: User, name: string) => {
    await choose(user, "View", "Show Markup Toolbar");
    await user.click(screen.getByRole("button", { name: "Shapes" }));
    await user.click(await screen.findByRole("menuitem", { name }));
  };

  it("a star is a mark that Undo takes away", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await barTool(user, "Star");
    dragOverPage([
      [100, 75],
      [200, 150],
    ]);
    await titled("beach.png — Edited");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await titled("beach.png");
  });

  it("a speech bubble asks at once for what it says", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await barTool(user, "Speech Bubble");
    dragOverPage([
      [100, 75],
      [300, 225],
    ]);
    expect(await screen.findByRole("textbox", { name: "Text" })).toBeInTheDocument();
  });

  it("a hand-drawn box becomes a rectangle, and Undo gives back the line as drawn", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "View", "Show Markup Toolbar");
    await user.click(screen.getByRole("button", { name: "Sketch" }));
    dragOverPage([
      [100, 75],
      [200, 75],
      [300, 75],
      [300, 150],
      [300, 225],
      [200, 225],
      [100, 225],
      [100, 150],
      [100, 80],
    ]);
    expect(await screen.findByText(/Preview made your line a rectangle/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await titled("beach.png — Edited");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await titled("beach.png");
  });
});

describe("Adjust Color", () => {
  it("shows the picture's levels, changes it as a slider moves, as one change to Undo", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "Tools", "Adjust Color…");
    expect(await screen.findByRole("img", { name: "Levels of the picture" })).toBeInTheDocument();
    const exposure = screen.getByRole("slider", { name: "Exposure" });
    fireEvent.change(exposure, { target: { value: "0.5" } });
    fireEvent.change(exposure, { target: { value: "0.6" } });
    await titled("beach.png — Edited");
    await waitFor(() => expect(putImages).toBeGreaterThan(0));
    focusDocument("beach.png");
    await user.keyboard("{Meta>}z{/Meta}");
    await titled("beach.png");
    expect(screen.getByRole("slider", { name: "Exposure" })).toHaveValue("0");
  });

  it("Reset All takes the sliders back", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "Tools", "Adjust Color…");
    fireEvent.change(await screen.findByRole("slider", { name: "Sepia" }), {
      target: { value: "0.5" },
    });
    await titled("beach.png — Edited");
    await user.click(screen.getByRole("button", { name: "Reset All" }));
    await titled("beach.png");
  });

  it("is dimmed on a PDF, saying why", async () => {
    const { user } = await start(REPORT);
    await titled(/^report\.pdf/);
    const row = await rowOf(user, "Tools", "Adjust Color…");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute(
      "title",
      "Only a picture’s colours can be adjusted, not a PDF’s pages.",
    );
  });
});

describe("Adjust Size", () => {
  const open = async (user: User) => {
    await choose(user, "Tools", "Adjust Size…");
    return screen.findByRole("dialog", { name: "Image Dimensions" });
  };

  it("keeps the proportions, and says what the picture will be", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    const sheet = await open(user);
    const width = within(sheet).getByRole("textbox", { name: "Width" });
    await user.clear(width);
    await user.type(width, "200");
    expect(within(sheet).getByRole("textbox", { name: "Height" })).toHaveValue("150");
    expect(within(sheet).getByRole("status")).toHaveTextContent(
      "Resulting Size: 200 × 150 pixels, about 0.3 MB (was 1.0 MB)",
    );
    await user.click(within(sheet).getByRole("button", { name: "OK" }));
    await titled("beach.png — Edited");
    expect(await writtenSize(user, drive)).toBe("canvas 200x150");
  });

  it("goes out of proportion when asked", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    const sheet = await open(user);
    await user.click(within(sheet).getByRole("checkbox", { name: "Scale proportionally" }));
    const height = within(sheet).getByRole("textbox", { name: "Height" });
    await user.clear(height);
    await user.type(height, "600");
    expect(within(sheet).getByRole("textbox", { name: "Width" })).toHaveValue("400");
    await user.click(within(sheet).getByRole("button", { name: "OK" }));
    await titled("beach.png — Edited");
    expect(await writtenSize(user, drive)).toBe("canvas 400x600");
  });

  it("fits into a size from its menu", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    const sheet = await open(user);
    await user.click(within(sheet).getByRole("combobox", { name: "Fit into" }));
    await user.click(await screen.findByRole("option", { name: "320 × 240 pixels" }));
    expect(within(sheet).getByRole("textbox", { name: "Width" })).toHaveValue("320");
    expect(within(sheet).getByRole("textbox", { name: "Height" })).toHaveValue("240");
  });

  it("writes a length in the unit chosen, at the resolution given", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    const sheet = await open(user);
    const resolution = within(sheet).getByRole("textbox", { name: "Resolution" });
    await user.clear(resolution);
    await user.type(resolution, "100");
    await user.click(within(sheet).getByRole("combobox", { name: "Units" }));
    await user.click(await screen.findByRole("option", { name: "inches" }));
    expect(within(sheet).getByRole("textbox", { name: "Width" })).toHaveValue("4");
    expect(within(sheet).getByRole("textbox", { name: "Height" })).toHaveValue("3");
  });

  it("without Resample image keeps the pixels and changes their size on paper", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    const sheet = await open(user);
    await user.click(within(sheet).getByRole("checkbox", { name: "Resample image" }));
    const width = within(sheet).getByRole("textbox", { name: "Width" });
    await user.clear(width);
    await user.type(width, "2");
    expect(within(sheet).getByRole("textbox", { name: "Resolution" })).toHaveValue("200");
    expect(within(sheet).getByRole("status")).toHaveTextContent("400 × 300 pixels");
  });
});

describe("the colour chooser", () => {
  it("changes the colour, kept for the next mark, and the mark chosen", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "View", "Show Markup Toolbar");
    await user.click(screen.getByRole("button", { name: "Border Color" }));
    expect(await screen.findByRole("menuitem", { name: "Show Colors…" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    fireEvent.input(screen.getByLabelText("Border Color Chooser"), {
      target: { value: "#123456" },
    });
    expect(desktopValues()["preview.color"]).toBe("#123456");
    fireEvent.input(screen.getByLabelText("Fill Color Chooser"), { target: { value: "#654321" } });
    expect(desktopValues()["preview.fill"]).toBe("#654321");
  });
});

describe("links in a PDF", () => {
  const LINKS: PdfLink[] = [
    { x: 0.1, y: 0.1, w: 0.2, h: 0.05, page: 3 },
    { x: 0.1, y: 0.2, w: 0.2, h: 0.05, url: "https://example.com/ferry" },
  ];

  it("go to their page, standing where the file has them", async () => {
    const { user } = await start(REPORT, { pdf: stubPdf(LINKS) });
    await titled("report.pdf (page 1 of 3)");
    const link = await screen.findByRole("button", { name: "Link to page 3" });
    expect(link.style.left).toBe("10%");
    expect(link.style.top).toBe("10%");
    await user.click(link);
    await titled("report.pdf (page 3 of 3)");
  });

  it("open a web address on the desktop", async () => {
    const opened: unknown[] = [];
    const hear = (event: Event) => opened.push((event as CustomEvent).detail);
    window.addEventListener("macalicious:open-url", hear);
    const { user } = await start(REPORT, { pdf: stubPdf(LINKS) });
    await titled("report.pdf (page 1 of 3)");
    await user.click(
      await screen.findByRole("button", { name: "Link to https://example.com/ferry" }),
    );
    window.removeEventListener("macalicious:open-url", hear);
    expect(opened).toEqual([expect.objectContaining({ url: "https://example.com/ferry" })]);
  });

  it("give way to the markup tools", async () => {
    const { user } = await start(REPORT, { pdf: stubPdf(LINKS) });
    await titled("report.pdf (page 1 of 3)");
    await screen.findByRole("button", { name: "Link to page 3" });
    await choose(user, "View", "Show Markup Toolbar");
    expect(screen.queryByRole("button", { name: "Link to page 3" })).toBeNull();
  });
});

describe("Insert > Page from File", () => {
  it("writes the pages after the one chosen, keeps the marks in place, and opens the file", async () => {
    const drive = memoryDrive();
    const pdf = stubPdf();
    const { user } = await start(REPORT, { drive, pdf, others: [EXTRA] });
    await titled("report.pdf (page 1 of 3)");
    await choose(user, "Edit", "Page from File…", ["Insert"]);
    const sheet = await screen.findByRole("dialog", { name: "Open" });
    const row = await within(sheet).findByRole("option", { name: "extra.pdf" });
    await user.dblClick(row);
    await waitFor(() => expect(drive.replace).toHaveBeenCalled());
    expect(pdf.combined).toHaveBeenCalledWith([
      { document: null, pages: [1], at: [0] },
      { document: expect.any(Uint8Array), pages: [1, 2, 3], at: [1, 2, 3] },
      { document: null, pages: [2, 3], at: [4, 5] },
    ]);
    const [replaced, data] = drive.replace.mock.calls[0] ?? [];
    expect(replaced).toMatchObject({ id: "report1" });
    expect((data as Blob).type).toBe("application/pdf");
    expect(await screen.findByText(/Inserted 3 pages from “extra\.pdf”/)).toBeInTheDocument();
    await titled("report.pdf (page 2 of 3)");
  });

  it("says why when the file cannot be written", async () => {
    const pdf = stubPdf();
    vi.mocked(pdf.combined).mockRejectedValueOnce(new Error("The file is locked."));
    const { user } = await start(REPORT, { pdf, others: [EXTRA] });
    await titled("report.pdf (page 1 of 3)");
    await choose(user, "Edit", "Page from File…", ["Insert"]);
    const sheet = await screen.findByRole("dialog", { name: "Open" });
    await user.dblClick(await within(sheet).findByRole("option", { name: "extra.pdf" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "“extra.pdf” could not be inserted. The file is locked.",
    );
  });
});

describe("Take Screenshot", () => {
  const stubCapture = (capture: () => Promise<MediaStream>) => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: navigator.clipboard,
      mediaDevices: { getDisplayMedia: vi.fn(capture) },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
  };

  it("writes a frame of the screen to Pictures, stops sharing and opens it", async () => {
    const stop = vi.fn();
    stubCapture(async () => ({ getTracks: () => [{ stop }] }) as unknown as MediaStream);
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "File", "From Entire Screen", ["Take Screenshot"]);
    await waitFor(() => expect(drive.create).toHaveBeenCalled());
    const [folder, name, data] = drive.create.mock.calls[0] ?? [];
    expect(folder).toBe("pictures");
    expect(name).toMatch(/^Screen Shot \d{4}-\d{2}-\d{2} at \d{2}\.\d{2}\.\d{2}\.png$/);
    expect(await (data as Blob).text()).toBe("canvas 640x480");
    expect(stop).toHaveBeenCalled();
    await titled(name as string);
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: { displaySurface: "monitor" },
      audio: false,
    });
  });

  it("From Selection opens it with the selection tool in hand", async () => {
    stubCapture(async () => ({ getTracks: () => [] }) as unknown as MediaStream);
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "File", "From Selection…", ["Take Screenshot"]);
    await waitFor(() => expect(drive.create).toHaveBeenCalled());
    const tool = await screen.findByRole("button", { name: "Rectangular Selection" });
    await waitFor(() => expect(tool).toHaveAttribute("aria-pressed", "true"));
  });

  it("does nothing when the person turns the browser's chooser down", async () => {
    stubCapture(async () => {
      throw new DOMException("Denied", "NotAllowedError");
    });
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await choose(user, "File", "From Window…", ["Take Screenshot"]);
    await waitFor(() => expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled());
    expect(drive.create).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("is dimmed where the browser cannot capture, saying why", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    const row = await rowOf(user, "File", "From Window…", ["Take Screenshot"]);
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("title", "This browser cannot capture the screen for a web page.");
  });
});

describe("the title", () => {
  it("opens a pop-over that renames the file on Return", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await user.click(screen.getByRole("button", { name: "Title Menu" }));
    const name = await screen.findByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("beach.png");
    await user.clear(name);
    await user.type(name, "shore.png{Enter}");
    await titled("shore.png");
    expect(drive.rename).toHaveBeenCalledWith(BEACH, "shore.png");
  });

  it("moves the file to the folder chosen in the pop-over", async () => {
    const { user, drive } = await start(BEACH);
    await titled("beach.png");
    await user.click(screen.getByRole("button", { name: "Title Menu" }));
    await user.click(await screen.findByRole("combobox", { name: "Where" }));
    await user.click(await screen.findByRole("option", { name: "Documents" }));
    await waitFor(() => expect(drive.move).toHaveBeenCalledWith(BEACH, "documents"));
  });

  it("has an icon that drags the file", async () => {
    await start(BEACH);
    await titled("beach.png");
    // jsdom has no layout to say what is under the pointer.
    document.elementFromPoint = () => null;
    const icon = document.querySelector(".mac-preview-app-proxy") as HTMLElement;
    fireEvent.pointerDown(icon, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 });
    expect(document.querySelector(".mac-desktop-drag-name")).toHaveTextContent("beach.png");
    fireEvent.pointerUp(window, { clientX: 60, clientY: 60 });
  });
});

describe("a file dropped from the computer", () => {
  const drop = (target: Element, files: File[]) =>
    fireEvent.drop(target, { dataTransfer: { files, types: ["Files"] } });

  it("goes to the drive and opens, a PDF in Documents and a picture in Pictures", async () => {
    const { drive } = await start(BEACH);
    await titled("beach.png");
    const body = document.querySelector(".mac-preview-body") as Element;
    drop(body, [new File(["x"], "photo.png", { type: "image/png" })]);
    await waitFor(() => expect(drive.create).toHaveBeenCalled());
    expect(drive.create.mock.calls[0]?.slice(0, 2)).toEqual(["pictures", "photo.png"]);
    await titled("photo.png");
  });

  it("is said to be refused when Preview cannot open it", async () => {
    const { drive } = await start(BEACH);
    await titled("beach.png");
    drop(document.querySelector(".mac-preview-body") as Element, [
      new File(["x"], "notes.txt", { type: "text/plain" }),
    ]);
    expect(await screen.findByText("Preview can’t open “notes.txt”.")).toBeInTheDocument();
    expect(drive.create).not.toHaveBeenCalled();
  });

  it("goes into a PDF after the thumbnail it is let go on", async () => {
    const drive = memoryDrive();
    const pdf = stubPdf();
    await start(REPORT, { drive, pdf });
    await titled("report.pdf (page 1 of 3)");
    const row = (await screen.findByRole("listbox", { name: "Thumbnails" })).querySelector(
      '[data-index="1"]',
    ) as Element;
    drop(row, [new File(["x"], "extra.pdf", { type: "application/pdf" })]);
    await waitFor(() => expect(pdf.combined).toHaveBeenCalled());
    expect(vi.mocked(pdf.combined).mock.calls[0]?.[0]).toEqual([
      { document: null, pages: [1, 2], at: [0, 1] },
      { document: expect.any(Uint8Array), pages: [1, 2, 3], at: [2, 3, 4] },
      { document: null, pages: [3], at: [5] },
    ]);
    expect(drive.create.mock.calls[0]?.slice(0, 2)).toEqual(["documents", "extra.pdf"]);
  });
});

describe("the toolbar's pull-down", () => {
  it("has the shared Share rows", async () => {
    const { user } = await start(BEACH);
    await titled("beach.png");
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Share/ }));
    expect(await screen.findByRole("menuitem", { name: "AirDrop" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
