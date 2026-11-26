import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { registerDropTarget } from "../desktop/desktop-drag";
import { type DriveEntry, loadDrive } from "../desktop/desktop-files";
import {
  beginDesktopValues,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { PreviewApp } from "./preview-app";
import type { PreviewDrive } from "./preview-drive";
import { smartOutline } from "./preview-lasso";
import {
  afterInsertion,
  drawMarks,
  EMPTY_MARKUP,
  isClosedOutline,
  LOUPE_POWER,
  type Mark,
  type Markup,
  markFont,
  marksIn,
  markupReadable,
  type Point,
  pageTurns,
  rearranged,
  shapeBetween,
  withPagesTurned,
} from "./preview-markup";
import { extractionParts, insertionParts } from "./preview-pages";
import type { PdfField, PdfFile } from "./preview-pdf";
import { outlineBetween } from "./preview-shapes";

/*
 * Preview's marks in depth, its pages turned one by one, the pictures that share a window, a PDF's
 * form fields and what a drag carries out. Stand-ins: a `PreviewDrive` in memory, a listing for the
 * shared Open dialog, a PDF reader in place of pdf.js and a recording 2D context in place of the
 * browser's canvas. pdf.js's filling of a real form was run apart from these.
 */

const shape = (over: Partial<Mark>): Mark => ({
  id: "m",
  kind: "rect",
  color: "#000000",
  stroke: 0.01,
  x: 0.1,
  y: 0.1,
  w: 0.5,
  h: 0.5,
  ...over,
});

/** A context that writes down what is asked of it, each call as `[name, ...arguments]`. */
function recordingContext(canvas: { width: number; height: number } = { width: 100, height: 100 }) {
  const calls: unknown[][] = [];
  const values: Record<string | symbol, unknown> = {
    canvas,
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
  };
  const context = new Proxy(values, {
    get: (target, key) =>
      key in target
        ? target[key]
        : (...args: unknown[]) => {
            calls.push([key, ...args]);
          },
    set: (target, key, value) => {
      target[key] = value;
      calls.push([`set ${String(key)}`, value]);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { context, calls, values };
}

describe("drawing", () => {
  it("a mask dims the page outside its box", () => {
    const { context, calls } = recordingContext();
    drawMarks(context, [shape({ kind: "mask" })], 100, 100);
    expect(calls).toContainEqual(["rect", 0, 0, 100, 100]);
    expect(calls).toContainEqual(["rect", 10, 10, 50, 50]);
    expect(calls).toContainEqual(["fill", "evenodd"]);
  });

  it("a loupe draws the page magnified about its centre as the canvas has it", () => {
    const { context, calls } = recordingContext();
    const page = document.createElement("canvas");
    drawMarks(context, [shape({ kind: "loupe" })], 100, 100, null, page);
    // The centre (35, 35) of page pixels stands at (80, 90) under the transform.
    expect(calls).toContainEqual([
      "setTransform",
      LOUPE_POWER,
      0,
      0,
      LOUPE_POWER,
      80 * (1 - LOUPE_POWER),
      90 * (1 - LOUPE_POWER),
    ]);
    expect(calls).toContainEqual(["drawImage", page, 0, 0, 100, 100]);
    expect(calls).toContainEqual(["clip"]);
  });

  it("a dashed and a dotted line and a shadow set the canvas's own", () => {
    const { context, calls } = recordingContext();
    drawMarks(context, [shape({ dash: "dashed", shadow: true })], 100, 100);
    expect(calls).toContainEqual(["setLineDash", [4, 3]]);
    expect(calls).toContainEqual(["set shadowColor", "rgba(0, 0, 0, 0.5)"]);
    const dotted = recordingContext();
    drawMarks(dotted.context, [shape({ dash: "dotted" })], 100, 100);
    expect(dotted.calls).toContainEqual(["setLineDash", [0, 2]]);
  });

  it("a line has the heads its ends ask for", () => {
    const heads = (over: Partial<Mark>) => {
      const { context, calls } = recordingContext();
      drawMarks(context, [shape(over)], 100, 100);
      return calls.filter(([name]) => name === "closePath").length;
    };
    expect(heads({ kind: "line" })).toBe(0);
    expect(heads({ kind: "arrow" })).toBe(1);
    expect(heads({ kind: "arrow", arrow_ends: "none" })).toBe(0);
    expect(heads({ kind: "line", arrow_ends: "both" })).toBe(2);
  });

  it("a star is filled when it has a fill", () => {
    const star = outlineBetween("star", [0, 0], [1, 1], {
      color: "#000000",
      stroke: 0.01,
      fill: "#ffcc00",
    });
    expect(star.fill).toBe("#ffcc00");
    expect(isClosedOutline(star)).toBe(true);
    const { context, calls } = recordingContext();
    drawMarks(context, [star], 100, 100);
    expect(calls).toContainEqual(["set fillStyle", "#ffcc00"]);
    expect(calls).toContainEqual(["fill"]);
  });

  it("an open line through points is no outline to fill", () => {
    const open: Point[] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    expect(isClosedOutline({ kind: "sketch", points: open })).toBe(false);
  });

  it("a text stands in its font and alignment", () => {
    const { context, calls } = recordingContext();
    const text = shape({
      kind: "text",
      text: "Ada",
      size: 0.1,
      w: 0.4,
      font: "Georgia",
      align: "center",
    });
    drawMarks(context, [text], 100, 100);
    expect(calls).toContainEqual(["set font", "10px Georgia, serif"]);
    expect(calls).toContainEqual(["set textAlign", "center"]);
    expect(calls).toContainEqual(["fillText", "Ada", 20, 0]);
    expect(markFont(undefined, 10)).toContain("-apple-system");
  });

  it("shapes keep the style they were drawn with, and only a line has arrow ends", () => {
    const style = { color: "#000000", stroke: 0.01, dash: "dotted", arrow_ends: "both" } as const;
    expect(shapeBetween("line", [0, 0], [1, 1], style)).toMatchObject({
      dash: "dotted",
      arrow_ends: "both",
    });
    expect(shapeBetween("rect", [0, 0], [1, 1], style).arrow_ends).toBeUndefined();
    const mask = shapeBetween("mask", [0, 0], [1, 1], { ...style, fill: "#ffffff" });
    expect(mask.dash).toBeUndefined();
    expect(mask.fill).toBeUndefined();
  });
});

describe("a page's turns", () => {
  const three: Markup = { ...EMPTY_MARKUP };
  it("turn only the pages named, and go when none stands turned", () => {
    const turned = withPagesTurned(three, 3, [2], 1);
    expect(turned.turns).toEqual([0, 1, 0]);
    expect(pageTurns(turned, 1)).toBe(0);
    expect(pageTurns(turned, 2)).toBe(1);
    expect(pageTurns({ rotation: 3, turns: [0, 3] }, 2)).toBe(2);
    expect(withPagesTurned(turned, 3, [2], -1).turns).toBeUndefined();
  });
  it("follow their pages when the pages move, and a new page has none", () => {
    const turned: Markup = { ...EMPTY_MARKUP, turns: [1, 2, 3] };
    expect(rearranged(turned, 3, [3, 0, 1]).turns).toEqual([3, 0, 1]);
    expect(afterInsertion(turned, 1, 2).turns).toEqual([1, 0, 0, 2, 3]);
  });
  it("are read only when each is 0 to 3", () => {
    const stored = (turns: unknown) => ({ markup: { rotation: 0, pages: [], turns } });
    expect(markupReadable(stored([0, 3]))).toBe(true);
    expect(markupReadable(stored([4]))).toBe(false);
  });
});

describe("marks in a rectangle", () => {
  it("are those it touches", () => {
    const a = shape({ id: "a", x: 0.1, y: 0.1, w: 0.1, h: 0.1 });
    const b = shape({ id: "b", x: 0.5, y: 0.5, w: 0.1, h: 0.1 });
    expect(marksIn([a, b], { x: 0, y: 0, w: 0.15, h: 0.15 })).toEqual(["a"]);
    expect(marksIn([a, b], { x: 0, y: 0, w: 1, h: 1 })).toEqual(["a", "b"]);
    expect(marksIn([a, b], { x: 0.3, y: 0.3, w: 0.1, h: 0.1 })).toEqual([]);
  });
});

describe("Smart Lasso", () => {
  /** A 100 × 100 picture, white with a black square from 30 to 70. */
  const square = () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4);
    for (let y = 0; y < 100; y += 1) {
      for (let x = 0; x < 100; x += 1) {
        const inside = x >= 30 && x < 70 && y >= 30 && y < 70;
        const at = (y * 100 + x) * 4;
        const light = inside ? 0 : 255;
        pixels.set([light, light, light, 255], at);
      }
    }
    return pixels;
  };
  const loop = (from: number, to: number): Point[] => [
    [from, from],
    [to, from],
    [to, to],
    [from, to],
  ];

  it("draws a loop near a thing's edge in to the edge", () => {
    const outline = smartOutline(loop(0.27, 0.73), square(), 100, 100);
    const off = outline.map(([x, y]) => {
      const dx = Math.abs(x - 0.5);
      const dy = Math.abs(y - 0.5);
      return Math.abs(Math.max(dx, dy) - 0.2);
    });
    // The smoothing rounds a corner off a little; all the rest lies on the edge.
    expect(off.filter((each) => each < 0.015).length / off.length).toBeGreaterThan(0.9);
  });

  it("leaves a loop with no edge near it where it was drawn", () => {
    const blank = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    const outline = smartOutline(loop(0.2, 0.8), blank, 100, 100);
    const off = outline.map(([x, y]) =>
      Math.abs(Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)) - 0.3),
    );
    expect(Math.max(...off)).toBeLessThan(0.02);
  });
});

describe("the parts of a PDF", () => {
  const bytes = new Uint8Array([1]);
  const blank = new Uint8Array([2]);
  it("put the pages asked for where they were asked for", () => {
    expect(insertionParts([1, 2], 1, { bytes, count: 2, pages: [5, 2] }, blank)).toEqual([
      { document: null, pages: [1], at: [0] },
      { document: bytes, pages: [2, 5], at: [2, 1] },
      { document: null, pages: [2], at: [3] },
    ]);
  });
  it("take pages out in the order dragged, leaving out a blank page", () => {
    expect(extractionParts([3, 0, 1])).toEqual([{ document: null, pages: [1, 3], at: [1, 0] }]);
  });
});

/* The window. */

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

function memoryDrive() {
  return {
    read: vi.fn(async (_id: string) => new Blob(["bytes"])),
    save: vi.fn(async (target: { folder: string; name: string }) =>
      entry({ id: "saved1", name: target.name, parent: target.folder }),
    ),
    replace: vi.fn(async (file: DriveEntry, _data: Blob) => ({ ...file, id: `${file.id}-2` })),
    current: vi.fn(async () => BEACH),
    opened: vi.fn(),
    create: vi.fn(async (folder: string, name: string, _data: Blob) =>
      entry({ id: `made-${name}`, name, parent: folder }),
    ),
    duplicate: vi.fn(async (file: DriveEntry, name: string) => ({ ...file, id: "copy1", name })),
    rename: vi.fn(async (file: DriveEntry, name: string) => ({ ...file, name })),
    move: vi.fn(async (file: DriveEntry, folder: string) => ({ ...file, parent: folder })),
    folders: vi.fn(async () => [{ id: "pictures", path: "Pictures" }]),
  } satisfies PreviewDrive;
}

const fontsSet: string[] = [];
const drawnImages: unknown[][] = [];
const boxesDrawn: number[][] = [];
function fakeContext(): CanvasRenderingContext2D {
  const values: Record<string | symbol, unknown> = {
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    drawImage: (...args: unknown[]) => void drawnImages.push(args),
    strokeRect: (...box: number[]) => void boxesDrawn.push(box),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
  };
  return new Proxy(values, {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: (target, key, value) => {
      if (key === "font") fontsSet.push(String(value));
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const stubPdf = (over: Partial<PdfFile> = {}): PdfFile => ({
  pageCount: 3,
  size: async () => ({ width: 600, height: 800 }),
  render: vi.fn(async () => true),
  text: async () => "",
  layOutText: async () => {},
  textRuns: async () => [],
  outline: async () => [],
  links: async () => [],
  fields: async () => [],
  setField: vi.fn(),
  filled: vi.fn(async () => new Uint8Array([7])),
  security: async () => ({}),
  combined: vi.fn(async () => new Uint8Array([1, 2, 3])),
  destroy: vi.fn(),
  ...over,
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

const MENUS = ["File", "Edit", "View", "Go", "Tools"];
type User = ReturnType<typeof userEvent.setup>;

async function start(
  file: DriveEntry,
  options: { drive?: ReturnType<typeof memoryDrive>; pdf?: PdfFile } = {},
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
        loadPdf={async () => options.pdf ?? stubPdf()}
      />
    </>,
  );
  const dialog = await screen.findByRole("dialog", { name: "Open" });
  await user.dblClick(await within(dialog).findByRole("option", { name: file.name }));
  await screen.findByText(new RegExp(`^${file.name}`), { selector: ".mac-title-bar-title-text" });
  return { user, drive };
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

function marksCanvas(page = 1) {
  const marks = document.querySelector(
    `[data-page="${page}"] .mac-preview-app-page-marks`,
  ) as HTMLCanvasElement;
  vi.spyOn(marks, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
  } as DOMRect);
  return marks;
}

function press(at: readonly [number, number], options: { shiftKey?: boolean } = {}) {
  fireEvent.pointerDown(marksCanvas(), {
    button: 0,
    clientX: at[0],
    clientY: at[1],
    pointerId: 1,
    ...options,
  });
  fireEvent.pointerUp(marksCanvas(), { clientX: at[0], clientY: at[1], pointerId: 1 });
}

function dragOverPage(from: readonly [number, number], to: readonly [number, number]) {
  const marks = marksCanvas();
  fireEvent.pointerDown(marks, { button: 0, clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(marks, { clientX: to[0], clientY: to[1], pointerId: 1 });
  fireEvent.pointerUp(marks, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

/** Two rectangles on the page, drawn from the Tools menu; the Select tool is then in hand. */
async function twoRectangles(user: User) {
  await choose(user, "Tools", "Rectangle", ["Annotate"]);
  dragOverPage([40, 30], [120, 90]);
  dragOverPage([240, 150], [320, 210]);
  await user.click(await screen.findByRole("button", { name: "Select" }));
}

const annotationRows = () =>
  within(screen.getByRole("listbox", { name: "Annotations" })).getAllByRole("option");

async function openAnnotations(user: User) {
  fireEvent.keyDown(screen.getByRole("document"), { key: "i", metaKey: true });
  await user.click(await screen.findByRole("button", { name: "Annotations" }));
}

beforeEach(() => {
  beginDesktopValues();
  fontsSet.length = 0;
  drawnImages.length = 0;
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

describe("several marks", () => {
  it("Shift-click chooses both, and Delete takes both as one change", async () => {
    const { user } = await start(BEACH);
    await twoRectangles(user);
    await openAnnotations(user);
    expect(annotationRows()).toHaveLength(2);
    press([40, 30]);
    press([240, 150], { shiftKey: true });
    fireEvent.keyDown(screen.getByRole("document"), { key: "Delete" });
    expect(await screen.findByText("No Annotations")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("document"), { key: "z", metaKey: true });
    await waitFor(() => expect(annotationRows()).toHaveLength(2));
  });

  it("a rectangle dragged over them chooses them, and they copy and paste together", async () => {
    const { user } = await start(BEACH);
    await twoRectangles(user);
    await openAnnotations(user);
    dragOverPage([5, 5], [395, 295]);
    fireEvent.keyDown(screen.getByRole("document"), { key: "c", metaKey: true });
    fireEvent.keyDown(screen.getByRole("document"), { key: "v", metaKey: true });
    await waitFor(() => expect(annotationRows()).toHaveLength(4));
  });

  it("a press on one of those chosen moves them all", async () => {
    const { user } = await start(BEACH);
    await twoRectangles(user);
    dragOverPage([5, 5], [395, 295]);
    boxesDrawn.length = 0;
    // 40 and 30 points across and down are a tenth of the page each way, 40 and 30 of its pixels.
    dragOverPage([40, 30], [80, 60]);
    await waitFor(() => {
      expect(boxesDrawn).toContainEqual([80, 60, 80, 60]);
      expect(boxesDrawn).toContainEqual([280, 180, 80, 60]);
    });
  });

  it("Select All with the markup bar on a PDF chooses the page's marks", async () => {
    const { user } = await start(REPORT);
    await twoRectangles(user);
    await openAnnotations(user);
    await choose(user, "Edit", "Select All");
    await choose(user, "Edit", "Delete");
    expect(await screen.findByText("No Annotations")).toBeInTheDocument();
  });
});

describe("Mask and Loupe", () => {
  it("are in Tools > Annotate and Shapes, and a mask chosen on a picture is what Crop keeps", async () => {
    const { user } = await start(BEACH);
    await choose(user, "Tools", "Mask", ["Annotate"]);
    dragOverPage([100, 75], [300, 225]);
    const before = (document.querySelector('[data-page="1"]') as HTMLElement).style.width;
    await choose(user, "Tools", "Crop");
    await titled("beach.png — Edited");
    await waitFor(() =>
      expect((document.querySelector('[data-page="1"]') as HTMLElement).style.width).toBeTruthy(),
    );
    await openAnnotations(user);
    expect(await screen.findByText("No Annotations")).toBeInTheDocument();
    expect(before).toBeTruthy();
    await user.click(
      (await screen.findAllByRole("button", { name: "Crop" })).at(-1) as HTMLElement,
    );
    expect(await screen.findByRole("textbox", { name: "Width" })).toHaveValue("200");
  });

  it("a loupe is listed by its name and the page is magnified in it", async () => {
    const { user } = await start(BEACH);
    await choose(user, "Tools", "Loupe", ["Annotate"]);
    drawnImages.length = 0;
    dragOverPage([100, 75], [200, 150]);
    await openAnnotations(user);
    expect(await screen.findByRole("option", { name: "Loupe, page 1" })).toBeInTheDocument();
    expect(drawnImages.some((args) => args[0] instanceof HTMLCanvasElement)).toBe(true);
  });
});

describe("turning a PDF's pages", () => {
  const lastTurns = (pdf: PdfFile, page: number) =>
    (pdf.render as ReturnType<typeof vi.fn>).mock.calls
      .filter((call) => call[0] === page)
      .at(-1)?.[3];

  it("Rotate Right turns the page shown and leaves the others", async () => {
    const pdf = stubPdf();
    const { user } = await start(REPORT, { pdf });
    await user.click(await screen.findByRole("button", { name: "Rotate Right" }));
    await waitFor(() => expect(lastTurns(pdf, 1)).toBe(1));
    expect(lastTurns(pdf, 2)).toBe(0);
    const first = document.querySelector('[data-page="1"]') as HTMLElement;
    const second = document.querySelector('[data-page="2"]') as HTMLElement;
    expect(Number.parseFloat(first.style.width)).toBeGreaterThan(
      Number.parseFloat(first.style.height),
    );
    expect(Number.parseFloat(second.style.width)).toBeLessThan(
      Number.parseFloat(second.style.height),
    );
  });

  it("the thumbnails' menu has Rotate Left and Rotate Right, for the pages chosen", async () => {
    const pdf = stubPdf();
    const { user } = await start(REPORT, { pdf });
    const list = await screen.findByRole("listbox", { name: "Thumbnails" });
    const row = within(list).getAllByRole("option")[1] as HTMLElement;
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole("menuitem", { name: "Rotate Left" }));
    await waitFor(() => expect(lastTurns(pdf, 2)).toBe(3));
    expect(lastTurns(pdf, 1)).toBe(0);
  });

  it("Export writes pictures of the pages once one is turned, turned as shown", async () => {
    const pdf = stubPdf();
    const { user, drive } = await start(REPORT, { pdf });
    await user.click(await screen.findByRole("button", { name: "Rotate Right" }));
    await choose(user, "File", "Export as PDF");
    const sheet = await screen.findByRole("dialog", { name: "Export the document" });
    expect(within(sheet).getByRole("checkbox", { name: "Encrypt" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const named = within(sheet).getAllByRole("textbox")[0] as HTMLElement;
    await user.clear(named);
    await user.type(named, "turned.pdf");
    await user.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(drive.save).toHaveBeenCalled());
    expect(drive.read).toHaveBeenCalledTimes(1);
    expect(lastTurns(pdf, 1)).toBe(1);
    expect(lastTurns(pdf, 2)).toBe(0);
  });
});

describe("Customize Toolbar", () => {
  it("takes an item out at once, keeps it out, and Use Default Set brings it back", async () => {
    const { user } = await start(BEACH);
    await choose(user, "View", "Customize Toolbar");
    const sheet = await screen.findByRole("dialog", {
      name: "Choose the items the toolbar shows",
    });
    await user.click(within(sheet).getByRole("checkbox", { name: "Rotate" }));
    expect(screen.queryByRole("button", { name: "Rotate Right" })).toBeNull();
    expect(desktopValues()["preview.hiddenTools"]).toEqual(["rotate"]);
    await user.click(within(sheet).getByRole("button", { name: "Use Default Set" }));
    expect(await screen.findByRole("button", { name: "Rotate Right" })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Choose the items the toolbar shows" }),
      ).toBeNull(),
    );
  });
});

describe("the Inspector", () => {
  it("Keywords adds a word, says none twice, and Remove and Undo take it and bring it back", async () => {
    const { user } = await start(BEACH);
    fireEvent.keyDown(screen.getByRole("document"), { key: "i", metaKey: true });
    await user.click(await screen.findByRole("button", { name: "Keywords" }));
    expect(screen.getByText("No Keywords")).toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "New Keyword" });
    await user.type(field, " sea {Enter}");
    const list = await screen.findByRole("listbox", { name: "Keywords" });
    expect(within(list).getByRole("option", { name: "sea" })).toBeInTheDocument();
    await user.type(field, "sea");
    expect(screen.getByRole("button", { name: "Add Keyword" })).toBeDisabled();
    await user.clear(field);
    await user.click(within(list).getByRole("option", { name: "sea" }));
    await user.click(screen.getByRole("button", { name: "Remove Keyword" }));
    expect(await screen.findByText("No Keywords")).toBeInTheDocument();
    await choose(user, "Edit", "Undo");
    expect(await screen.findByRole("option", { name: "sea" })).toBeInTheDocument();
  });

  it("Encryption says what a PDF's lock lets a reader do, and dims setting a password", async () => {
    const pdf = stubPdf({
      security: async () => ({
        method: "Standard",
        allowed: { print: true, copy: false, change: false, annotate: true },
      }),
    });
    const { user } = await start(REPORT, { pdf });
    fireEvent.keyDown(screen.getByRole("document"), { key: "i", metaKey: true });
    await user.click(await screen.findByRole("button", { name: "Encryption" }));
    expect(await screen.findByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Copying:").parentElement).toHaveTextContent("No");
    const set = screen.getByRole("button", { name: "Set Password…" });
    expect(set).toBeDisabled();
    expect(set.getAttribute("title")).toContain("cannot write one");
  });
});

describe("pictures sharing a window", () => {
  const png = (name: string) => new File(["x"], name, { type: "image/png" });

  async function dropTwo() {
    const started = await start(BEACH);
    const body = document.querySelector(".mac-preview-body") as HTMLElement;
    fireEvent.drop(body, {
      dataTransfer: { files: [png("one.png"), png("two.png")], types: ["Files"] },
    });
    await titled("one.png");
    return started;
  }

  it("have a thumbnail each, and choosing one shows it", async () => {
    const { user, drive } = await dropTwo();
    expect(drive.create).toHaveBeenCalledTimes(2);
    const list = await screen.findByRole("listbox", { name: "Pictures" });
    await user.click(within(list).getByRole("option", { name: "two.png" }));
    await titled("two.png");
    expect(screen.getByRole("listbox", { name: "Pictures" })).toBeInTheDocument();
  });

  it("Go > Next and Previous step through them", async () => {
    const { user } = await dropTwo();
    await choose(user, "Go", "Next");
    await titled("two.png");
    await choose(user, "Go", "Previous");
    await titled("one.png");
  });

  it("go their ways when another file is opened", async () => {
    const { user } = await dropTwo();
    await choose(user, "File", "Open…");
    const dialog = await screen.findByRole("dialog", { name: "Open" });
    await user.dblClick(await within(dialog).findByRole("option", { name: "beach.png" }));
    await titled("beach.png");
    expect(screen.queryByRole("listbox", { name: "Pictures" })).toBeNull();
  });
});

describe("a drag out of the window", () => {
  /** A target at `element` that writes down what is dropped on it. */
  function target(element: Element) {
    const dropped: { name: string; bytes?: () => Promise<Blob> }[] = [];
    const stop = registerDropTarget({
      element,
      landing: (_hit, drag) => ({
        element,
        drop: () => {
          dropped.push(...drag.items);
        },
      }),
    });
    return { dropped, stop };
  }

  it("carries a picture's selection as a PNG of what it holds", async () => {
    const { user } = await start(BEACH);
    await choose(user, "Tools", "Rectangular Selection");
    dragOverPage([100, 75], [300, 225]);
    const elsewhere = document.createElement("div");
    document.body.append(elsewhere);
    const { dropped, stop } = target(elsewhere);
    document.elementFromPoint = () => elsewhere;
    fireEvent.pointerDown(marksCanvas(), { button: 0, clientX: 200, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 190, pointerId: 1 });
    expect(document.querySelector(".mac-desktop-drag-name")).toHaveTextContent(
      "beach selection.png",
    );
    fireEvent.pointerUp(window, { clientX: 260, clientY: 190, pointerId: 1 });
    expect(dropped.map((item) => item.name)).toEqual(["beach selection.png"]);
    const blob = await dropped[0]?.bytes?.();
    expect(blob?.type).toBe("image/png");
    expect(await blob?.text()).toBe("canvas 200x150");
    stop();
    elsewhere.remove();
  });

  it("carries a PDF's pages as a PDF of those pages", async () => {
    const pdf = stubPdf();
    await start(REPORT, { pdf });
    const list = await screen.findByRole("listbox", { name: "Thumbnails" });
    const elsewhere = document.createElement("div");
    document.body.append(elsewhere);
    const { dropped, stop } = target(elsewhere);
    document.elementFromPoint = () => elsewhere;
    const row = within(list).getAllByRole("option")[1] as HTMLElement;
    const dataTransfer = { setData: () => {}, effectAllowed: "" };
    fireEvent.click(row);
    fireEvent.dragStart(row, { dataTransfer });
    fireEvent.dragEnd(row, { clientX: 700, clientY: 100, dataTransfer });
    expect(dropped.map((item) => item.name)).toEqual(["report (page 2).pdf"]);
    const blob = await dropped[0]?.bytes?.();
    expect(blob?.type).toBe("application/pdf");
    expect(pdf.combined).toHaveBeenCalledWith([{ document: null, pages: [2], at: [0] }]);
    stop();
    elsewhere.remove();
  });
});

describe("a PDF's form", () => {
  const NAME: PdfField = {
    id: "f1",
    name: "Name",
    kind: "text",
    x: 0.1,
    y: 0.1,
    w: 0.5,
    h: 0.05,
    value: "Ada",
    multiline: false,
    readOnly: false,
    options: [],
    group: [],
  };
  const fields = async (page: number) =>
    page === 1
      ? [
          NAME,
          { ...NAME, id: "f2", name: "Agree", kind: "checkbox" as const, value: false },
          {
            ...NAME,
            id: "f3",
            name: "Size",
            kind: "choice" as const,
            value: "s",
            options: [
              { value: "s", label: "Small" },
              { value: "l", label: "Large" },
            ],
          },
          { ...NAME, id: "f4", name: "Locked", readOnly: true },
        ]
      : [];

  it("shows its fields, and what is filled goes to the file's reader", async () => {
    const pdf = stubPdf({ fields });
    const { user } = await start(REPORT, { pdf });
    const name = await screen.findByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Ada");
    expect(screen.getByRole("textbox", { name: "Locked" })).toBeDisabled();
    await user.type(name, "!");
    expect(pdf.setField).toHaveBeenLastCalledWith("f1", "Ada!", []);
    await user.click(screen.getByRole("checkbox", { name: "Agree" }));
    expect(pdf.setField).toHaveBeenLastCalledWith("f2", true, []);
    await user.selectOptions(screen.getByRole("combobox", { name: "Size" }), "l");
    expect(pdf.setField).toHaveBeenLastCalledWith("f3", ["l"], []);
  });

  it("Save writes the filled file and shows it again", async () => {
    const pdf = stubPdf({ fields });
    const { user, drive } = await start(REPORT, { pdf });
    expect(await rowOf(user, "File", "Save")).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.type(await screen.findByRole("textbox", { name: "Name" }), "!");
    await choose(user, "File", "Save");
    await waitFor(() => expect(drive.replace).toHaveBeenCalled());
    expect(pdf.filled).toHaveBeenCalled();
    const written = drive.replace.mock.calls[0]?.[1] as Blob;
    expect([...new Uint8Array(await written.arrayBuffer())]).toEqual([7]);
    expect(await screen.findByText(/^Saved “report\.pdf”/)).toBeInTheDocument();
    expect(await rowOf(user, "File", "Save")).toHaveAttribute("aria-disabled", "true");
  });

  it("Close asks first with a filled field", async () => {
    const pdf = stubPdf({ fields });
    const { user } = await start(REPORT, { pdf });
    await user.type(await screen.findByRole("textbox", { name: "Name" }), "!");
    await choose(user, "File", "Open…");
    const dialog = await screen.findByRole("dialog", { name: "Open" });
    await user.dblClick(await within(dialog).findByRole("option", { name: "report.pdf" }));
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});

describe("text on a page", () => {
  async function typed(user: User, text: string) {
    await choose(user, "View", "Show Markup Toolbar");
    await user.click(await screen.findByRole("button", { name: "Text" }));
    fireEvent.pointerDown(marksCanvas(), { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    const field = await screen.findByRole("textbox", { name: "Text" });
    await user.type(field, text);
    return field;
  }

  it("Shift-Return starts a line and Return ends the text", async () => {
    const { user } = await start(BEACH);
    await typed(user, "one{Shift>}{Enter}{/Shift}two");
    expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("one\ntwo");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Text" }), { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull());
  });

  it("Text Style's font goes to the text chosen and to the next", async () => {
    const { user } = await start(BEACH);
    const field = await typed(user, "Ada");
    fireEvent.keyDown(field, { key: "Enter" });
    await user.click(await screen.findByRole("button", { name: "Text Style" }));
    fontsSet.length = 0;
    await user.click(await screen.findByRole("menuitemradio", { name: "Georgia" }));
    await waitFor(() => expect(fontsSet.some((font) => font.includes("Georgia"))).toBe(true));
    expect(desktopValues()["preview.font"]).toBe("Georgia");
  });

  it("Edit's Spelling and Substitutions wait for a text or note chosen", async () => {
    const { user } = await start(BEACH);
    await user.click(screen.getByRole("button", { name: "Menu Edit" }));
    expect(await screen.findByRole("menuitem", { name: /^Spelling and Grammar/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    const field = await typed(user, "Ada");
    expect(field).toHaveAttribute("spellcheck", "true");
    fireEvent.keyDown(field, { key: "Enter" });
    await user.click(screen.getByRole("button", { name: "Menu Edit" }));
    expect(
      await screen.findByRole("menuitem", { name: /^Spelling and Grammar/ }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: /^Substitutions/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
