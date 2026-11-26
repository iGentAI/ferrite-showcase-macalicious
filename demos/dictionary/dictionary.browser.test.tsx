// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * Look Up from a TextEdit selection, on the whole desktop in a real browser: a word selected in
 * TextEdit's document and Control-Command-D open Dictionary on that word, with no Dictionary
 * window open before. The desktop is the Desktop demo, served by Vite through the visual
 * harness as desktop.browser.test.tsx serves it; the shell, TextEdit and Look Up are the code the
 * Ferrite desktop runs.
 */

const root = path.resolve(import.meta.dirname, "../..");
const EXAMPLE = "demos/desktop/examples/basic.tsx";
const WIDTH = 1440;
const WORD = "serendipity";

let server: ViteDevServer | undefined;
let cache: string | undefined;
let base = "";

beforeAll(async () => {
  if (!Object.values(ENGINES).some(installed)) return;
  cache = await mkdtemp(path.join(os.tmpdir(), "macalicious-look-up-"));
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

requireEveryEngine("the Look Up tests");

describe.each(Object.keys(ENGINES))("Look Up from TextEdit in %s", (name) => {
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
    "opens Dictionary on the word selected in TextEdit's document",
    async () => {
      if (!browser) throw new Error("No browser.");
      const context = await browser.newContext({ viewport: { width: WIDTH + 40, height: 800 } });
      try {
        const page = await context.newPage();
        const problems: string[] = [];
        page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
        page.on("console", (message) => {
          if (message.type() === "error") problems.push(`console error: ${message.text()}`);
        });
        await page.goto(`${base}/?example=${EXAMPLE}&appearance=light`);
        await page.waitForSelector("html[data-ready], html[data-error]", { timeout: 90_000 });
        expect(await page.getAttribute("html", "data-error")).toBeNull();
        await page.addStyleTag({ content: `#visual-root { display: block; width: ${WIDTH}px; }` });
        const shell = page.locator(".mac-desktop-shell");
        const frame = (id: string) => shell.locator(`.mac-managed-window[data-window-id="${id}"]`);
        expect(await frame("dictionary").count()).toBe(0);

        await shell
          .getByRole("toolbar", { name: "Dock" })
          .getByRole("button", { name: "TextEdit", exact: true })
          .click();
        const editor = frame("textedit").getByRole("textbox", { name: "Document" });
        await editor.click();
        await page.keyboard.press("End");
        await page.keyboard.type(` ${WORD}`);
        // Select the word the way a double-click does: a range over it in the document's text.
        const selected = await editor.evaluate((element, word) => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node as Text;
            const at = text.data.lastIndexOf(word);
            if (at < 0) continue;
            const range = document.createRange();
            range.setStart(text, at);
            range.setEnd(text, at + word.length);
            const selection = document.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            return selection?.toString() ?? "";
          }
          return "";
        }, WORD);
        expect(selected).toBe(WORD);

        await page.keyboard.press("Control+Meta+KeyD");
        const dictionary = frame("dictionary");
        await dictionary.waitFor({ timeout: 15_000 });
        expect(await dictionary.getByRole("searchbox", { name: "Search" }).inputValue()).toBe(WORD);
        expect(problems).toEqual([]);
      } finally {
        await context.close();
      }
    },
    120_000,
  );
});
