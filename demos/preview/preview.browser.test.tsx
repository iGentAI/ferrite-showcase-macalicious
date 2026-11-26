// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that choosing a page in the sidebar brings that page, and no
 * other, to the top of the document, the last page too; that scrolling the document moves the
 * page shown; and that the page shown keeps its place when the view changes width. The real
 * window is served by the visual harness's page (visual/harness), which renders one example
 * with the library's stylesheets, and is driven with real input in each engine Playwright has
 * installed (`npm run visual:install` installs Chromium); an engine that is not installed is
 * skipped. Every case loads the page anew, so each passes when it is run alone. Set
 * REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and names each
 * one that is missing (test/browser-engines.ts).
 *
 * A page that is brought to the top starts 4 pt under the bar. The demo scrolls to a whole
 * point, so where the page starts is within half a point of that in every engine, and the
 * cases read it rounded. How far one turn of the wheel scrolls is the engine's own business:
 * the scrolling case reads where the pages came to rest and holds the window to its rule for
 * the page shown there, whichever page that is.
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/preview/examples/visual-thumbnails.tsx";
/** How far under the top of the view a page may start and still be the page shown. */
const PAGE_SLOP = 12;
/** Longer than Vitest's 5 s: a slow machine lays the 22 pages out again in that time. */
const WAIT = { timeout: 15_000 };

requireEveryEngine("the Preview tests");

// One server for the engines: each loads the same page from it.
let server: ViteDevServer | undefined;
let origin = "";

beforeAll(async () => {
  if (!any) return;
  server = await createServer({
    configFile: path.join(root, "visual/vite.config.ts"),
    server: { port: 0, host: "127.0.0.1", strictPort: false },
    logLevel: "silent",
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  origin = `http://127.0.0.1:${port}`;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

describe.each(Object.keys(ENGINES))("Preview in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let context: BrowserContext | undefined;
  let tab: Page;

  /**
   * Loads the window anew, as it opens, in a page and a browser context of its own: no case
   * starts from what another left, in the document or in the browser's storage.
   */
  const open = async () => {
    await context?.close();
    context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  };

  /** The window's title, the selected row, and where each page in view starts under the view's top. */
  const read = () =>
    tab.evaluate(() => {
      const view = document.querySelector('[role="document"]') as HTMLElement;
      const top = view.getBoundingClientRect().top;
      const bottom = view.getBoundingClientRect().bottom;
      const tops: Record<string, number> = {};
      for (const leaf of view.querySelectorAll("[data-page]")) {
        const rect = leaf.getBoundingClientRect();
        if (rect.bottom > top && rect.top < bottom)
          tops[leaf.getAttribute("data-page") as string] = Math.round(rect.top - top);
      }
      return {
        title: document.querySelector(".mac-title-bar-title-text")?.textContent,
        selected: [...document.querySelectorAll('[role="option"][aria-selected="true"]')].map(
          (row) => row.querySelector(".mac-preview-row-title")?.textContent,
        ),
        rows: [...document.querySelectorAll('[role="option"]')].map(
          (row) => row.querySelector(".mac-preview-row-title")?.textContent,
        ),
        tops,
      };
    });
  const row = (name: string) =>
    tab.locator('[role="option"]').filter({ has: tab.getByText(name, { exact: true }) });
  const title = async () => (await read()).title;
  /**
   * Where the document is scrolled to, and the page the window's rule makes the page shown
   * there: the last one that starts no further than PAGE_SLOP under the top of the view.
   */
  const rest = (slop: number) =>
    tab.evaluate((slop) => {
      const view = document.querySelector('[role="document"]') as HTMLElement;
      const top = view.getBoundingClientRect().top + slop;
      let shown = 1;
      for (const leaf of view.querySelectorAll("[data-page]")) {
        if (leaf.getBoundingClientRect().top > top) break;
        shown = Number(leaf.getAttribute("data-page"));
      }
      return { scrolled: view.scrollTop, shown };
    }, slop);
  /**
   * Waits until the document, scrolled from `from`, has come to rest somewhere else, and reads
   * it there. A scroll may be animated: at rest is the same place at five readings in a row.
   */
  const settled = async (from: number) => {
    let last = from;
    let same = 0;
    await expect
      .poll(
        async () => {
          const now = (await rest(PAGE_SLOP)).scrolled;
          same = now === last && now !== from ? same + 1 : 0;
          last = now;
          return same >= 5;
        },
        { ...WAIT, interval: 100 },
      )
      .toBe(true);
    return rest(PAGE_SLOP);
  };
  /** The width of a page of the document, which is 98.5% of the view's. */
  const pageWidth = () =>
    tab.evaluate(
      () => document.querySelector('[data-page="1"]')?.getBoundingClientRect().width ?? 0,
    );
  /** Presses the sidebar's divider and moves it, in one movement of the pointer or in several. */
  const drag = async (by: number, steps: number) => {
    const box = await tab.getByRole("separator", { name: "Resize the sidebar" }).boundingBox();
    if (!box) throw new Error("no divider");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await tab.mouse.move(x, y);
    await tab.mouse.down();
    await tab.mouse.move(x + by, y, { steps });
    await tab.mouse.up();
  };

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    // The first load builds the page; the cases then load it again in little time.
    await open();
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "opens at the first page, at the top of the document",
    async () => {
      await open();
      const now = await read();
      expect(now.title).toBe("Island Ferry.pdf (page 1 of 22)");
      expect(now.selected).toEqual(["Page 1"]);
      expect(now.tops["1"]).toBe(4);
    },
    60_000,
  );

  it.skipIf(!available)(
    "brings the page of the thumbnail chosen to the top of the document",
    async () => {
      await open();
      await row("Page 5").click();
      await expect.poll(title, WAIT).toBe("Island Ferry.pdf (page 5 of 22)");
      const now = await read();
      expect(now.selected).toEqual(["Page 5"]);
      // Page 5 starts 4 pt under the bar; page 4 is out of view above it.
      expect(now.tops["5"]).toBe(4);
      expect(now.tops["4"]).toBeUndefined();
    },
    60_000,
  );

  it.skipIf(!available)(
    "brings the last page to the top of the document too, at any zoom",
    async () => {
      await open();
      // The row of the last page is far down the sidebar: its list is scrolled to it.
      await tab.locator('[role="listbox"]').hover();
      await tab.mouse.wheel(0, 4000);
      await row("Page 22").click();
      await expect.poll(title, WAIT).toBe("Island Ferry.pdf (page 22 of 22)");
      let now = await read();
      expect(now.selected).toEqual(["Page 22"]);
      // The canvas runs on under the last page, so it starts where any other page would.
      expect(now.tops["22"]).toBe(4);
      expect(now.tops["21"]).toBeUndefined();
      // Smaller pages leave more of the view under the last one, and it stays at the top.
      const before = await pageWidth();
      await tab.getByRole("button", { name: "Zoom Out" }).click();
      await tab.getByRole("button", { name: "Zoom Out" }).click();
      await expect.poll(pageWidth, WAIT).toBeLessThan(before * 0.7);
      await expect.poll(async () => (await read()).tops["22"], WAIT).toBe(4);
      now = await read();
      expect(now.title).toBe("Island Ferry.pdf (page 22 of 22)");
      expect(now.tops["21"]).toBeUndefined();
      // Scrolled back by a little, the page shown is the one the window's rule gives for
      // where the document comes to rest, whichever that is: an engine scrolls one turn of
      // the wheel by its own measure.
      const from = await rest(PAGE_SLOP);
      await tab.locator('[role="document"]').hover();
      await tab.mouse.wheel(0, -40);
      const back = await settled(from.scrolled);
      expect(back.scrolled).toBeLessThan(from.scrolled);
      await expect.poll(title, WAIT).toBe(`Island Ferry.pdf (page ${back.shown} of 22)`);
      expect((await read()).selected).toEqual([`Page ${back.shown}`]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "moves the page shown and the selection as the document is scrolled",
    async () => {
      await open();
      await row("Page 5").click();
      await expect.poll(title, WAIT).toBe("Island Ferry.pdf (page 5 of 22)");
      const before = await rest(PAGE_SLOP);
      expect(before.shown).toBe(5);
      const height = await tab.evaluate(
        () => document.querySelector('[data-page="5"]')?.getBoundingClientRect().height ?? 0,
      );
      await tab.locator('[role="document"]').hover();
      // About a page further. The engines scroll one turn of the wheel by their own measure,
      // so the case waits until the document is at rest, reads which page the window's rule
      // makes the page shown there, and holds the title and the selection to that page.
      await tab.mouse.wheel(0, Math.round(height) + 20);
      const after = await settled(before.scrolled);
      // The document was scrolled on.
      expect(after.scrolled).toBeGreaterThan(before.scrolled);
      await expect.poll(title, WAIT).toBe(`Island Ferry.pdf (page ${after.shown} of 22)`);
      expect((await read()).selected).toEqual([`Page ${after.shown}`]);
      // And it was not scrolled again by the window while the title followed.
      expect((await rest(PAGE_SLOP)).scrolled).toBe(after.scrolled);
    },
    60_000,
  );

  it.skipIf(!available)(
    "lists the pages found, goes to the first and then to the one chosen",
    async () => {
      await open();
      await tab.locator(".mac-toolbar-search-field input").fill("pilot");
      await expect.poll(title, WAIT).toBe("Island Ferry.pdf (page 9 of 22)");
      let now = await read();
      expect(now.rows).toEqual([
        "Page 9",
        "Page 13",
        "Page 14",
        "Page 17",
        "Page 18",
        "Page 19",
        "Page 21",
      ]);
      expect(now.selected).toEqual(["Page 9"]);
      expect(now.tops["9"]).toBe(4);
      await row("Page 17").click();
      await expect.poll(title, WAIT).toBe("Island Ferry.pdf (page 17 of 22)");
      now = await read();
      expect(now.selected).toEqual(["Page 17"]);
      expect(now.tops["17"]).toBe(4);
      expect(now.tops["16"]).toBeUndefined();
      // The text found is marked on the page in view.
      expect(await tab.locator('[data-page="17"] mark').count()).toBe(4);
    },
    60_000,
  );

  it.skipIf(!available)(
    "keeps the page shown at the top of the document as the sidebar's divider is dragged",
    async () => {
      await open();
      await row("Page 12").click();
      await expect.poll(title, WAIT).toBe("Island Ferry.pdf (page 12 of 22)");
      const before = await pageWidth();
      // A wider sidebar leaves a narrower view, and every page before this one is shorter.
      await drag(80, 8);
      await expect.poll(pageWidth, WAIT).toBeLessThan(before - 70);
      await expect.poll(async () => (await read()).tops["12"], WAIT).toBe(4);
      let now = await read();
      expect(now.title).toBe("Island Ferry.pdf (page 12 of 22)");
      expect(now.selected).toEqual(["Page 12"]);
      expect(now.tops["11"]).toBeUndefined();
      // And back past where it was, to the sidebar's least width, in one movement.
      await drag(-135, 1);
      await expect.poll(pageWidth, WAIT).toBeGreaterThan(before + 50);
      await expect.poll(async () => (await read()).tops["12"], WAIT).toBe(4);
      now = await read();
      expect(now.title).toBe("Island Ferry.pdf (page 12 of 22)");
      expect(now.selected).toEqual(["Page 12"]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "keeps a page near the end of the document when the view gets much narrower at once",
    async () => {
      await open();
      await tab.locator('[role="listbox"]').hover();
      await tab.mouse.wheel(0, 4000);
      await row("Page 21").click();
      await expect.poll(title, WAIT).toBe("Island Ferry.pdf (page 21 of 22)");
      const before = await pageWidth();
      // The document gets so much shorter that the view is past its end, and is scrolled back
      // by the browser: that scrolling is not the reader's, and the page shown stays page 21.
      await drag(115, 1);
      await expect.poll(pageWidth, WAIT).toBeLessThan(before - 100);
      await expect.poll(async () => (await read()).tops["21"], WAIT).toBe(4);
      const now = await read();
      expect(now.title).toBe("Island Ferry.pdf (page 21 of 22)");
      expect(now.selected).toEqual(["Page 21"]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "keeps the page shown at the top of the document when the window is resized",
    async () => {
      await open();
      await row("Page 8").click();
      await expect.poll(title, WAIT).toBe("Island Ferry.pdf (page 8 of 22)");
      const before = await pageWidth();
      // What a window manager does as the window's edge is dragged: it gives a new width.
      await tab.evaluate(() => {
        (document.querySelector(".mac-preview") as HTMLElement).style.width = "900px";
      });
      await expect.poll(pageWidth, WAIT).toBeLessThan(before - 200);
      await expect.poll(async () => (await read()).tops["8"], WAIT).toBe(4);
      const now = await read();
      expect(now.title).toBe("Island Ferry.pdf (page 8 of 22)");
      expect(now.selected).toEqual(["Page 8"]);
      expect(now.tops["7"]).toBeUndefined();
    },
    60_000,
  );
});
