// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that choosing a handler in the Element pop-up button brings its
 * line into view in the script view, when the handler is in bare text (no element of its own
 * around the line) far below, or far to the right of, what the view shows; and that the Font
 * menu's keys really style the Description and the uncompiled script, through each engine's
 * own editing commands. The window is
 * served by the visual harness's page (visual/harness) and run in each engine Playwright has
 * installed; an engine that is not installed is skipped unless REQUIRE_BROWSER_TESTS is set
 * (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/script-editor/examples/basic.tsx";

requireEveryEngine("the Script Editor tests");

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

describe.each(Object.keys(ENGINES))("Script Editor in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.runIf(available)(
    "brings a handler in bare text into view",
    async () => {
      const view = tab.getByRole("textbox", { name: "Script", exact: true });
      // Bare text: one text node, no element around the handler's line.
      await view.evaluate((element) => {
        const filler = Array.from({ length: 80 }, (_, i) => `set x${i} to ${i}`);
        const wide = `set wide to "${"w".repeat(400)}"`;
        const handler = "on greet()\nreturn 1\nend greet";
        element.textContent = [...filler, wide, handler].join("\n");
        element.scrollTop = 0;
        element.scrollLeft = 0;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(await view.evaluate((element) => element.childNodes.length)).toBe(1);

      // The handler's line, measured by a range around its text.
      const lineInView = () =>
        view.evaluate((element) => {
          const text = element.firstChild as Text;
          const at = (text.nodeValue ?? "").indexOf("on greet()");
          const range = element.ownerDocument.createRange();
          range.setStart(text, at);
          range.setEnd(text, at + "on greet()".length);
          const box = range.getBoundingClientRect();
          const frame = element.getBoundingClientRect();
          return {
            top: element.scrollTop,
            visible:
              box.top >= frame.top - 0.5 &&
              box.bottom <= frame.top + element.clientHeight + 0.5 &&
              box.left >= frame.left - 0.5 &&
              box.right <= frame.left + element.clientWidth + 0.5,
          };
        });
      expect((await lineInView()).visible).toBe(false);

      await tab.getByRole("combobox", { name: "Element" }).click();
      await tab.getByRole("option", { name: "greet()" }).click();

      await expect.poll(async () => (await lineInView()).visible).toBe(true);
      expect((await lineInView()).top).toBeGreaterThan(0);
    },
    60_000,
  );

  it.runIf(available)(
    "styles and aligns the Description and the script from the Font and Format menus' keys, and Compile restyles the script",
    async () => {
      // The keys take Command on Apple platforms and Control elsewhere, as the browser reports.
      const apple = await tab.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform));
      const command = apple ? "Meta" : "Control";
      /** Select `word` in the view named `name`, with the keyboard there. */
      const select = (name: string, word: string) =>
        tab.getByRole("textbox", { name, exact: true }).evaluate((element, wanted) => {
          const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node && !node.nodeValue?.includes(wanted)) node = walker.nextNode();
          if (!node) throw new Error(`no ${wanted}`);
          const at = node.nodeValue?.indexOf(wanted) ?? 0;
          (element as HTMLElement).focus();
          const range = element.ownerDocument.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + wanted.length);
          const selection = element.ownerDocument.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }, word);
      /** The computed style of the text `word` in the view named `name`. */
      const styleOf = (name: string, word: string) =>
        tab.getByRole("textbox", { name, exact: true }).evaluate((element, wanted) => {
          const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node && !node.nodeValue?.includes(wanted)) node = walker.nextNode();
          const style = node?.parentElement ? getComputedStyle(node.parentElement) : null;
          return {
            weight: Number(style?.fontWeight ?? 0),
            italic: style?.fontStyle ?? "",
            size: style?.fontSize ?? "",
          };
        }, word);

      // The Description: Bold, Italic, Bigger.
      const description = tab.getByRole("textbox", { name: "Description", exact: true });
      await description.click();
      await tab.keyboard.type("Files the mail daily.");
      const plain = await styleOf("Description", "daily");
      await select("Description", "daily");
      await tab.keyboard.press(`${command}+b`);
      await expect
        .poll(async () => (await styleOf("Description", "daily")).weight)
        .toBeGreaterThanOrEqual(600);
      await tab.keyboard.press(`${command}+i`);
      await expect.poll(async () => (await styleOf("Description", "daily")).italic).toBe("italic");
      await tab.keyboard.press(`${command}+=`);
      await expect
        .poll(async () => Number.parseFloat((await styleOf("Description", "daily")).size))
        .toBe(Number.parseFloat(plain.size) + 1);
      // Only the selection.
      expect((await styleOf("Description", "mail")).weight).toBeLessThan(600);

      // Format > Text's keys align the paragraph: right, center, left.
      const alignOf = (name: string, word: string) =>
        tab.getByRole("textbox", { name, exact: true }).evaluate((element, wanted) => {
          const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node && !node.nodeValue?.includes(wanted)) node = walker.nextNode();
          let block = node?.parentElement ?? null;
          while (block && getComputedStyle(block).display !== "block") block = block.parentElement;
          return block ? getComputedStyle(block).textAlign : "";
        }, word);
      await select("Description", "daily");
      await tab.keyboard.press(`${command}+Shift+BracketRight`);
      await expect.poll(() => alignOf("Description", "daily")).toMatch(/right/);
      await tab.keyboard.press(`${command}+Shift+Backslash`);
      await expect.poll(() => alignOf("Description", "daily")).toMatch(/center/);
      await tab.keyboard.press(`${command}+Shift+BracketLeft`);
      await expect
        .poll(() => alignOf("Description", "daily"))
        .toMatch(/^(left|start|-webkit-left|-moz-left)$/);

      // Command-T shows the Fonts panel and hides it again.
      await tab.keyboard.press(`${command}+t`);
      const fonts = tab.getByRole("region", { name: "Fonts" });
      await fonts.waitFor({ timeout: 10_000 });
      await select("Description", "daily");
      await tab.keyboard.press(`${command}+t`);
      await expect.poll(() => fonts.count()).toBe(0);

      // The script, before it is compiled: Italic, which Compile replaces with AppleScript's
      // formatting styles.
      const script = tab.getByRole("textbox", { name: "Script", exact: true });
      await script.evaluate((element) => {
        element.textContent = 'set greeting to "hello"';
        element.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await select("Script", "greeting");
      await tab.keyboard.press(`${command}+i`);
      await expect.poll(async () => (await styleOf("Script", "greeting")).italic).toBe("italic");
      await tab.keyboard.press(`${command}+Shift+BracketRight`);
      await expect.poll(() => alignOf("Script", "greeting")).toMatch(/right/);
      await tab.getByRole("button", { name: "Compile", exact: true }).click();
      await expect.poll(async () => (await styleOf("Script", "greeting")).italic).toBe("normal");
      await expect
        .poll(() => alignOf("Script", "greeting"))
        .toMatch(/^(left|start|-webkit-left|-moz-left)$/);
    },
    60_000,
  );
});
