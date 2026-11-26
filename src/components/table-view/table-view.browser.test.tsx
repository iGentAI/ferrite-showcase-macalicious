// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { TableView, TableViewCellText, type TableViewColumn } from "./index";

/*
 * What only a browser can show: where the stylesheet puts the text of a `TableViewCellText`
 * in a column that is aligned to the centre or to the right, and that a text cut in its
 * middle still ends where its column's alignment says. The table is rendered by React and
 * styled by the stylesheets it ships with; each engine Playwright has installed is used
 * (`npm run visual:install` installs Chromium), and an engine that is not installed is
 * skipped. Set REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails
 * and names each one that is missing (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the table's and its parts'. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(
    path.join(here, "../scroll-view/scroll-view.tokens.css"),
    path.join(here, "../scroll-view/scroll-view.css"),
    path.join(here, "../table-header/table-header.tokens.css"),
    path.join(here, "../table-header/table-header.css"),
    path.join(here, "table-view.tokens.css"),
    path.join(here, "table-view.css"),
  );
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const WIDTH = 200;
// Narrower than the 17 characters a text cut in its middle keeps.
const NARROW = 40;
const columns: TableViewColumn[] = [
  { id: "left", title: "Left", width: WIDTH },
  { id: "center", title: "Centre", width: WIDTH, align: "center" },
  { id: "right", title: "Right", width: WIDTH, align: "right" },
  { id: "narrow", title: "N", width: NARROW },
];
const texts = ["Short", "com.apple.account.AppleAccount.cloudkit-token.and.then.some.more"];

function page() {
  const body = renderToStaticMarkup(
    <TableView
      aria-label="Aligned columns"
      columns={columns}
      rowCount={texts.length}
      renderCell={(row) => (
        <TableViewCellText lineBreakMode="truncating-middle">{texts[row] ?? ""}</TableViewCellText>
      )}
      style={{ width: 3 * WIDTH + NARROW, height: 120 }}
    />,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

interface Reading {
  /** Space before the text and after it, in points, inside the cell's padding. */
  before: number;
  after: number;
  /** Whether the part that shrinks is cut: its text is wider than its box. */
  cut: boolean;
}

requireEveryEngine("the TableView tests");

describe.each(Object.keys(ENGINES))("TableViewCellText in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Reads every cell: one array per row, in the order of the columns. */
  async function read() {
    const context = await browser.newContext();
    try {
      const tab = await context.newPage();
      await tab.setContent(page());
      return await tab.evaluate(() =>
        [...document.querySelectorAll(".mac-table-view-row")].map((row) =>
          [...row.querySelectorAll(".mac-table-view-cell")].map((cell): Reading => {
            const style = getComputedStyle(cell);
            const box = cell.getBoundingClientRect();
            const [head, tail] = [...cell.querySelectorAll(".mac-table-view-cell-text > span")];
            const first = (head as HTMLElement).getBoundingClientRect();
            const last = (tail as HTMLElement).getBoundingClientRect();
            return {
              before: first.left - box.left - Number.parseFloat(style.paddingLeft),
              after: box.right - last.right - Number.parseFloat(style.paddingRight),
              cut: (head as HTMLElement).scrollWidth > (head as HTMLElement).clientWidth,
            };
          }),
        ),
      );
    } finally {
      await context.close();
    }
  }

  it.skipIf(!available)(
    "puts a short text where its column's alignment says",
    async () => {
      const [short] = await read();
      const [left, center, right] = short as Reading[];
      // The text is much narrower than its 200 pt column, so the space left over shows
      // where it is.
      expect(left?.before).toBeCloseTo(0, 1);
      expect(left?.after).toBeGreaterThan(100);
      expect(center?.before).toBeGreaterThan(50);
      expect(center?.before).toBeCloseTo(center?.after as number, 0);
      expect(right?.after).toBeCloseTo(0, 1);
      expect(right?.before).toBeGreaterThan(100);
      expect(short?.slice(0, 3).map((cell) => cell.cut)).toEqual([false, false, false]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "fills the column with a text that is cut in its middle, in every alignment",
    async () => {
      const [, long] = await read();
      // The fourth column is narrower than the ending that is kept: the text still ends at
      // the cell's edge and does not run out of it.
      expect(long).toHaveLength(4);
      for (const cell of long as Reading[]) {
        expect(cell.cut).toBe(true);
        expect(cell.before).toBeCloseTo(0, 1);
        expect(cell.after).toBeCloseTo(0, 1);
      }
    },
    60_000,
  );
});
