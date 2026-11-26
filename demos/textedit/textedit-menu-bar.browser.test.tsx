// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * The Edit menu of TextEdit's own menu bar in a real browser: Copy chosen from it copies the
 * document's selection, which the keyboard's Paste then puts in a field outside the window. A menu
 * takes the keyboard, so the selection is given back before the command runs.
 */

const root = path.resolve(import.meta.dirname, "../..");
const EXAMPLE = "demos/textedit/examples/basic.tsx";
const WORD = "Quillwort";

let server: ViteDevServer | undefined;
let cache: string | undefined;
let base = "";

beforeAll(async () => {
  if (!Object.values(ENGINES).some(installed)) return;
  cache = await mkdtemp(path.join(os.tmpdir(), "macalicious-textedit-menu-"));
  server = await createServer({
    configFile: path.join(root, "visual/vite.config.ts"),
    cacheDir: cache,
    logLevel: "silent",
    server: { port: 0, host: "127.0.0.1", strictPort: false },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address !== "object") throw new Error("The harness has no address.");
  base = `http://127.0.0.1:${address.port}`;
}, 120_000);

afterAll(async () => {
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

requireEveryEngine("TextEdit's menu bar tests");

describe.each(Object.keys(ENGINES))("TextEdit's menu bar in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "copies the document's selection from Edit > Copy",
    async () => {
      if (!browser) throw new Error("No browser.");
      const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
      try {
        const page = await context.newPage();
        await page.goto(`${base}/?example=${EXAMPLE}&appearance=light`);
        await page.waitForSelector("html[data-ready], html[data-error]", { timeout: 90_000 });
        expect(await page.getAttribute("html", "data-error")).toBeNull();
        const editor = page.getByRole("textbox", { name: "Document" });
        await editor.click();
        await page.keyboard.press("ControlOrMeta+A");
        await page.keyboard.type(WORD);
        await page.keyboard.press("ControlOrMeta+A");
        await page.waitForTimeout(100);

        await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
        await page.getByRole("menuitem", { name: /^Copy/ }).click();
        await page.waitForTimeout(300);

        await page.evaluate(() => {
          const field = document.createElement("input");
          field.id = "paste-here";
          document.body.prepend(field);
          field.focus();
        });
        await page.keyboard.press("ControlOrMeta+V");
        await expect.poll(() => page.locator("#paste-here").inputValue()).toBe(WORD);
      } finally {
        await context.close();
      }
    },
    150_000,
  );

  it.skipIf(!available)(
    "leaves the keyboard on the first misspelling from Edit > Check Document Now",
    async () => {
      if (!browser) throw new Error("No browser.");
      const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
      try {
        const page = await context.newPage();
        await page.goto(`${base}/?example=${EXAMPLE}&appearance=light`);
        await page.waitForSelector("html[data-ready], html[data-error]", { timeout: 90_000 });
        expect(await page.getAttribute("html", "data-error")).toBeNull();
        const editor = page.getByRole("textbox", { name: "Document" });
        await editor.click();
        await page.keyboard.press("ControlOrMeta+A");
        await page.keyboard.type("the blorptic gravel wordzz");

        await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
        await page.getByRole("menuitem", { name: "Spelling and Grammar" }).click();
        await page.getByRole("menuitem", { name: /^Check Document Now/ }).click();
        await expect
          .poll(() => page.evaluate(() => document.getSelection()?.toString()))
          .toBe("blorptic");

        await page.keyboard.type("Z");
        expect(await editor.innerText()).toContain("the Z gravel wordzz");
      } finally {
        await context.close();
      }
    },
    150_000,
  );
});
