// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import type { CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { ListView, type ListViewProps } from "./index";

/*
 * What only a browser can show: where the empty rows' lines are painted. They are the
 * listbox's own background, which scrolls with the rows and has no height once the rows fill
 * the view, so jsdom, which has no layout, cannot see them. Each list is drawn with an opaque
 * red line on white, so a pixel is either on a line or not. Each engine that Playwright has
 * installed is used; with REQUIRE_BROWSER_TESTS=1 a missing one fails the run.
 */
const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the scroll view's and the list's. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(
    path.join(here, "../scroll-view/scroll-view.tokens.css"),
    path.join(here, "../scroll-view/scroll-view.css"),
    path.join(here, "list-view.tokens.css"),
    path.join(here, "list-view.css"),
  );
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const renderRow = (index: number) => `Row ${index + 1}`;
const STYLE = {
  width: 100,
  height: 200,
  background: "#ffffff",
  "--mac-list-view-separator": "#ff0000",
  "--mac-list-view-separator-inset": "0px",
} as CSSProperties;

/** Three lists of 24 pt rows in a 200 pt view, each with empty-row lines. */
const LISTS: Record<string, Partial<ListViewProps>> = {
  // Three rows, 72 pt, without their own separators: lines only below them.
  short: { count: 3 },
  // The same with the rows' separators: one unbroken grid.
  inset: { count: 3, separator: "inset" },
  // Twenty rows, 480 pt: the rows fill the view, so there is no empty row.
  overflow: { count: 20 },
};

function page() {
  const body = renderToStaticMarkup(
    <div style={{ display: "flex", gap: 20, padding: 10 }}>
      {Object.entries(LISTS).map(([id, props]) => (
        <ListView
          key={id}
          id={id}
          aria-label={id}
          count={0}
          rowHeight={24}
          emptyRows="separator"
          selectionMode="none"
          renderRow={renderRow}
          style={STYLE}
          {...props}
        />
      ))}
    </div>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body style="margin:0">${body}</body></html>`;
}

/** The rows of the list, from top to bottom, at x = 10 pt, that are painted red. */
async function redRows(tab: Page, id: string) {
  const shot = await tab.locator(`#${id}`).screenshot({ animations: "disabled" });
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  const red: number[] = [];
  for (let y = 0; y < info.height; y++) {
    const at = (y * info.width + 10) * info.channels;
    const [r = 0, g = 0, b = 0] = [data[at], data[at + 1], data[at + 2]];
    if (r > 200 && g < 80 && b < 80) red.push(y);
  }
  return red;
}

/** Every row's last point from `from` up to the 200 pt view's height. */
const every24 = (from: number) =>
  Array.from({ length: (200 - from) / 24 }, (_, index) => from + 23 + index * 24).filter(
    (y) => y < 200,
  );

requireEveryEngine("the ListView tests");

describe.each(Object.keys(ENGINES))("ListView in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "draws a line in each empty row below real rows, aligned with them, and none once the rows overflow",
    async () => {
      const context = await browser.newContext({ deviceScaleFactor: 1 });
      try {
        const tab = await context.newPage();
        await tab.setContent(page());

        // Below three rows of 24 pt: the last point of each empty row, from 95, and nothing
        // under the rows themselves, which have no separator.
        expect(await redRows(tab, "short")).toEqual(every24(72));

        // With the rows' own separators the empty rows continue their grid without a break.
        expect(await redRows(tab, "inset")).toEqual(every24(0));

        // Rows taller than the view: no empty row, at the top or scrolled to the end.
        expect(await redRows(tab, "overflow")).toEqual([]);
        await tab.locator("#overflow [role=listbox]").evaluate((list) => {
          list.scrollTop = list.scrollHeight;
        });
        expect(
          await tab.locator("#overflow [role=listbox]").evaluate((list) => list.scrollTop),
        ).toBe(280);
        expect(await redRows(tab, "overflow")).toEqual([]);
      } finally {
        await context.close();
      }
    },
    60_000,
  );
});
