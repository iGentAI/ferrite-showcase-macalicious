// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "./browser-engines";

/*
 * At a phone's width (420 px) a documentation page fits the window: nothing on it reaches past
 * the right edge, so the page never scrolls sideways. The demo pages of Calendar, Reminders,
 * Contacts, Messages and Notes did, by 9 px: the Markdown table of their visual comparisons has
 * five columns of headings that do not wrap, wider than the column of text, and it widened the
 * page. A Markdown table now scrolls inside its own box, as the generated props tables do
 * (docs/src/mdx.tsx).
 *
 * The site is served by the docs' own Vite configuration and each page is read in every engine
 * Playwright has installed (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);
const root = path.join(import.meta.dirname, "..");
const PAGES = [
  "/demos/calendar",
  "/demos/reminders",
  "/demos/contacts",
  "/demos/messages",
  "/demos/notes",
];
const WIDTH = 420;

requireEveryEngine("the narrow documentation page tests");

let server: ViteDevServer | undefined;
let origin = "";

beforeAll(async () => {
  if (!any) return;
  server = await createServer({
    configFile: path.join(root, "docs/vite.config.ts"),
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

describe.each(Object.keys(ENGINES))(`Documentation pages ${WIDTH} px wide in %s`, (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  for (const page of PAGES) {
    it.runIf(available)(
      `${page} fits the window and scrolls no table sideways but its own`,
      async () => {
        const context = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
        try {
          const tab = await context.newPage();
          await tab.goto(`${origin}${page}`);
          // Measured once the page is whole: its table is in the article and no example or code
          // block is still loading (as the docs build's browser pass waits, docs/browser-pass.mjs).
          await tab.waitForSelector(".docs-article table", { timeout: 150_000 });
          await tab.waitForFunction(
            () => !document.querySelector(".docs-preview[aria-busy], .docs-code[aria-busy]"),
            undefined,
            { timeout: 150_000 },
          );
          const measured = await tab.evaluate(() => {
            const html = document.documentElement;
            const tables = [...document.querySelectorAll(".docs-article table")];
            return {
              innerWidth: window.innerWidth,
              scrollWidth: html.scrollWidth,
              clientWidth: html.clientWidth,
              // Every table of the page is in a box of its own that scrolls.
              unboxed: tables.filter(
                (table) =>
                  !table.parentElement?.classList.contains("docs-table-wrap") ||
                  getComputedStyle(table.parentElement).overflowX !== "auto",
              ).length,
              tables: tables.length,
            };
          });
          expect(measured.tables).toBeGreaterThan(0);
          expect(measured.unboxed).toBe(0);
          expect(measured.innerWidth).toBe(WIDTH);
          expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth);
        } finally {
          await context.close();
        }
      },
      200_000,
    );
  }
});
