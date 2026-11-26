// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { TableHeader, TableHeaderCell } from "./index";

/*
 * What only a browser can show: where the title of a heading that sorts, which is a button,
 * is drawn against the title of a plain heading, which is a span. A button centres its line in
 * its box and a span does not, so the two must still draw the same text on the same rows of
 * pixels, at 1x and at 2x, with and without the title offset hook. The rows are read from the
 * pixels, since a text box's layout position is no measure of where an engine draws the text.
 * The header is rendered by React and styled by the stylesheets it ships with; each engine
 * Playwright has installed is used (`npm run visual:install` installs Chromium), and an engine
 * that is not installed is skipped. Set REQUIRE_BROWSER_TESTS=1 where the engines must be
 * there: the run then fails and names each one that is missing (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the header's. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "table-header.tokens.css"), path.join(here, "table-header.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const noop = () => {};

/** One header per offset: a plain heading, then two that sort, all with the same title. */
const OFFSETS = ["0px", "-0.5px", "0.5px", "1px", "-2px", "3px"];

function page() {
  const body = renderToStaticMarkup(
    // biome-ignore lint/a11y/useSemanticElements: the header is tested as ARIA rows on divs, as it ships
    <div role="table" aria-label="Headings" style={{ width: 360 }}>
      {OFFSETS.map((offset) => (
        <TableHeader
          key={offset}
          style={{ ["--mac-table-header-title-offset" as string]: offset }}
          data-offset={offset}
        >
          <TableHeaderCell width={120}>HIH</TableHeaderCell>
          <TableHeaderCell width={120} onSort={noop}>
            HIH
          </TableHeaderCell>
          <TableHeaderCell onSort={noop} sortDirection="ascending">
            HIH
          </TableHeaderCell>
        </TableHeader>
      ))}
    </div>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body style="margin:0">${body}</body></html>`;
}

interface Reading {
  offset: string;
  /** Whether each title is a button. */
  buttons: boolean[];
  /** First and last device-pixel row of each title's ink, from the top of its box. */
  ink: [number, number][];
  /** Height of each title's box: all fill the 23 pt of the header. */
  heights: number[];
}

/** The rows of a screenshot that hold ink: they differ from its top-left pixel. */
async function inkRows(tab: Page, png: Buffer): Promise<[number, number]> {
  return tab.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const at = (i: number) => data[i] as number;
    let first = -1;
    let last = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const distance =
          Math.abs(at(i) - at(0)) + Math.abs(at(i + 1) - at(1)) + Math.abs(at(i + 2) - at(2));
        if (distance > 120) {
          if (first < 0) first = y;
          last = y;
        }
      }
    }
    return [first, last] as [number, number];
  }, png.toString("base64"));
}

requireEveryEngine("the TableHeader tests");

describe.each(Object.keys(ENGINES))("TableHeader titles in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Reads every header at a pixel density: where each of its three titles draws its text. */
  async function read(scale: number) {
    const context = await browser.newContext({ deviceScaleFactor: scale });
    try {
      const tab = await context.newPage();
      await tab.setContent(page());
      const readings: Reading[] = [];
      for (const header of await tab.locator(".mac-table-header").all()) {
        const titles = await header.locator(".mac-table-header-title").all();
        const ink: [number, number][] = [];
        const heights: number[] = [];
        for (const title of titles) {
          const box = (await title.boundingBox()) as { x: number; y: number; height: number };
          heights.push(box.height);
          // The first 40 pt of the title: its text, not the indicator of a sorted column.
          const clip = { x: box.x, y: box.y, width: 40, height: box.height };
          ink.push(await inkRows(tab, await tab.screenshot({ clip })));
        }
        readings.push({
          offset: (await header.getAttribute("data-offset")) ?? "",
          buttons: await Promise.all(
            titles.map((title) => title.evaluate((node) => node.tagName === "BUTTON")),
          ),
          ink,
          heights,
        });
      }
      return readings;
    } finally {
      await context.close();
    }
  }

  it.skipIf(!available).each([1, 2])(
    "draws a title that sorts on the rows of a plain title at every offset, at %ix",
    async (scale) => {
      const readings = await read(scale);
      expect(readings.map((reading) => reading.offset)).toEqual(OFFSETS);
      for (const reading of readings) {
        expect(reading.buttons).toEqual([false, true, true]);
        const [plain, sortable, sorted] = reading.ink;
        expect(plain?.[0]).toBeGreaterThan(0);
        expect(sortable).toEqual(plain);
        expect(sorted).toEqual(plain);
        expect(reading.heights).toEqual([23, 23, 23]);
      }
    },
    60_000,
  );

  it.skipIf(!available).each([1, 2])(
    "moves the titles by a whole-point offset, down and up, at %ix",
    async (scale) => {
      const readings = await read(scale);
      const rest = readings[0]?.ink[0] as [number, number];
      for (const reading of readings) {
        const offset = Number.parseFloat(reading.offset);
        if (!Number.isInteger(offset)) continue;
        for (const ink of reading.ink) {
          expect(ink).toEqual([rest[0] + offset * scale, rest[1] + offset * scale]);
        }
      }
    },
    60_000,
  );
});
