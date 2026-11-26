// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that every way TextEdit styles text really changes the text.
 * The keys of Format > Font and Format > Text (Command is Control off Apple platforms), the
 * menu bar's Format menu, the Fonts panel and the Colors panel run the browser's editing
 * commands on the selection, the format bar shows the style where the insertion point is, and
 * the document's HTML, which is what TextEdit saves, holds the styles. The window is served by
 * the visual harness's page (visual/harness) and run in each engine Playwright has installed;
 * an engine that is not installed is skipped unless REQUIRE_BROWSER_TESTS is set
 * (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/textedit/examples/basic.tsx";

requireEveryEngine("the TextEdit styling tests");

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

describe.each(Object.keys(ENGINES))("TextEdit styling in %s", (engineName) => {
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

  const document = () => tab.getByRole("textbox", { name: "Document", exact: true });

  /** Select `word`, or put the insertion point `at` characters into it, wherever its node is. */
  const select = (word: string, at?: number) =>
    document().evaluate(
      (element, [wanted, offset]) => {
        const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let text = walker.nextNode() as Text | null;
        while (text && !(text.nodeValue ?? "").includes(wanted as string)) {
          text = walker.nextNode() as Text | null;
        }
        if (!text) throw new Error(`no "${wanted}" in the document`);
        const start = (text.nodeValue ?? "").indexOf(wanted as string);
        element.focus();
        const range = element.ownerDocument.createRange();
        if (offset === null) {
          range.setStart(text, start);
          range.setEnd(text, start + (wanted as string).length);
        } else {
          range.setStart(text, start + (offset as number));
          range.collapse(true);
        }
        const selection = element.ownerDocument.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      },
      [word, at ?? null] as const,
    );

  /** The computed style of the text `word` is in, with the decorations of its ancestors. */
  const styleOf = (word: string) =>
    document().evaluate((element, wanted) => {
      const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!(node.nodeValue ?? "").includes(wanted)) continue;
        const holder = node.parentElement as Element;
        const style = getComputedStyle(holder);
        const lines: string[] = [];
        let align = "";
        for (let at: Element | null = holder; at && at !== element; at = at.parentElement) {
          lines.push(getComputedStyle(at).textDecorationLine);
          if (at.parentElement === element) align = getComputedStyle(at).textAlign;
        }
        return {
          family: style.fontFamily,
          weight: Number(style.fontWeight),
          italic: style.fontStyle,
          size: style.fontSize,
          color: style.color,
          decoration: lines.join(" "),
          align,
        };
      }
      return null;
    }, word);

  const pressed = (name: string) =>
    tab.getByRole("button", { name, exact: true }).getAttribute("aria-pressed");

  it.runIf(available)(
    "styles the selection from the keys, the menu and the panels, and shows the style",
    async () => {
      // Helvetica 12, black, as the reference document is.
      const start = await styleOf("crazy");
      expect(start?.family).toMatch(/^Helvetica/);
      expect(start?.size).toBe("12px");
      // The keys take Command on Apple platforms and Control elsewhere, by what the browser
      // reports.
      const apple = await tab.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform));
      const command = apple ? "Meta" : "Control";

      await select("crazy");
      await tab.keyboard.press(`${command}+b`);
      await expect.poll(async () => (await styleOf("crazy"))?.weight).toBeGreaterThanOrEqual(600);
      await tab.keyboard.press(`${command}+i`);
      await expect.poll(async () => (await styleOf("crazy"))?.italic).toBe("italic");
      await tab.keyboard.press(`${command}+u`);
      await expect.poll(async () => (await styleOf("crazy"))?.decoration).toContain("underline");
      await expect.poll(() => pressed("Bold")).toBe("true");
      await expect.poll(() => pressed("Underline")).toBe("true");
      // Bigger: one point up.
      await tab.keyboard.press(`${command}+=`);
      await expect.poll(async () => (await styleOf("crazy"))?.size).toBe("13px");
      await expect
        .poll(() => tab.getByRole("combobox", { name: "Font size" }).inputValue())
        .toBe("13");

      // A size typed and confirmed with Return leaves the selected text in place.
      await tab.getByRole("combobox", { name: "Font size" }).click({ clickCount: 3 });
      await tab.keyboard.type("14");
      await tab.keyboard.press("Enter");
      await expect.poll(async () => (await styleOf("crazy"))?.size).toBe("14px");
      await tab.keyboard.press(`${command}+-`);
      await expect.poll(async () => (await styleOf("crazy"))?.size).toBe("13px");

      // The Fonts panel: a family and the strikethrough.
      await tab.keyboard.press(`${command}+t`);
      const fonts = tab.getByRole("region", { name: "Fonts" });
      await fonts.waitFor({ timeout: 10_000 });
      // A family every engine here renders: the panel dims those the machine has no font for.
      await fonts
        .getByRole("listbox", { name: "Family" })
        .getByRole("option", { name: "Courier", exact: true })
        .click();
      await expect.poll(async () => (await styleOf("crazy"))?.family).toMatch(/^Courier/);
      await fonts.getByRole("combobox", { name: "Text strikethrough" }).click();
      await tab.getByRole("option", { name: "Single" }).click();
      await expect.poll(async () => (await styleOf("crazy"))?.decoration).toContain("line-through");
      // Underlined as well still.
      expect((await styleOf("crazy"))?.decoration).toContain("underline");
      await fonts.getByRole("button", { name: "Close" }).click();
      await expect.poll(() => fonts.count()).toBe(0);

      // The Colors panel: a colour from the Apple palette.
      await select("crazy");
      await tab.keyboard.press(`${command}+Shift+C`);
      const colors = tab.getByRole("region", { name: "Colors" });
      await colors.waitFor({ timeout: 10_000 });
      await colors.getByRole("tab", { name: "Color Palettes" }).click();
      await colors.getByRole("radio", { name: "Red" }).click();
      await expect.poll(async () => (await styleOf("crazy"))?.color).not.toBe("rgb(0, 0, 0)");
      await colors.getByRole("button", { name: "Close" }).click();

      // Format > Text > Center, from the menu bar.
      await select("crazy");
      await tab.getByRole("menuitem", { name: "Format", exact: true }).click();
      await tab.getByRole("menuitem", { name: "Text", exact: true }).click();
      await tab.getByRole("menuitem", { name: /^Center/ }).click();
      await expect.poll(async () => (await styleOf("crazy"))?.align).toBe("center");
      // Format > Font > Bold, from the menu bar: the word is no longer bold.
      await select("crazy");
      await tab.getByRole("menuitem", { name: "Format", exact: true }).click();
      await tab.getByRole("menuitem", { name: "Font", exact: true }).click();
      await tab.getByRole("menuitem", { name: /^Bold/ }).click();
      await expect.poll(async () => (await styleOf("crazy"))?.weight).toBeLessThan(600);

      // The format bar follows the insertion point: plain text, then the styled word.
      await select("Here", 2);
      await expect.poll(() => pressed("Italic")).toBe("false");
      await expect.poll(() => pressed("Underline")).toBe("false");
      await expect
        .poll(() => tab.getByRole("combobox", { name: "Font family" }).textContent())
        .toContain("Helvetica");
      await select("crazy", 2);
      await expect.poll(() => pressed("Italic")).toBe("true");
      await expect.poll(() => pressed("Underline")).toBe("true");
      await expect
        .poll(() => tab.getByRole("combobox", { name: "Font family" }).textContent())
        .toContain("Courier");
      await expect
        .poll(() => tab.getByRole("combobox", { name: "Font size" }).inputValue())
        .toBe("13");

      // What TextEdit saves (the view's HTML) holds every style it shows.
      const html = await document().evaluate((element) => element.innerHTML);
      expect(html).toMatch(/italic|<i>|<em>/);
      expect(html).toMatch(/underline|<u>/);
      expect(html).toMatch(/line-through|<s>|<strike>/);
      expect(html).toMatch(/Courier/);
      expect(html).toMatch(/13px/);
      expect(html).toMatch(/text-align: center/);
    },
    120_000,
  );

  it.runIf(available)(
    "stops a tab under its ruler marker, with a head indent and after a marker moves",
    async () => {
      // The test above left the document centred: this one starts from the reference document.
      await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 60_000 });
      const markers = tab.getByRole("slider", { name: /tab/i });
      const nudge = async (slider: ReturnType<Page["getByRole"]>, presses: number) => {
        await slider.focus();
        for (let at = 0; at < presses; at += 1) await tab.keyboard.press("ArrowRight");
      };
      await nudge(tab.getByRole("slider", { name: "head indent" }).first(), 4);
      await nudge(tab.getByRole("slider", { name: "first line indent" }).first(), 4);
      await document().click();
      const apple = await tab.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform));
      await tab.keyboard.press(`${apple ? "Meta" : "Control"}+End`);
      await tab.evaluate(() => globalThis.document.execCommand("insertText", false, "\n\tx\ty"));

      /** How far the letters after the first two tabs stand from the middle of the first two markers. */
      const offsets = async () => {
        const middles = await markers.evaluateAll((all) =>
          all.slice(0, 2).map((each) => {
            const box = each.getBoundingClientRect();
            return box.left + box.width / 2;
          }),
        );
        const letters = await document().evaluate((element) => {
          const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const places: [Text, number][] = [];
          for (
            let text = walker.nextNode() as Text | null;
            text;
            text = walker.nextNode() as Text | null
          ) {
            for (let offset = 0; offset < text.data.length; offset += 1)
              places.push([text, offset]);
          }
          const tabAt = places.findIndex(([text, offset]) => text.data[offset] === "\t");
          if (tabAt < 0) throw new Error("no tab in the document");
          const at = (index: number) => {
            const [text, offset] = places[index] as [Text, number];
            const range = element.ownerDocument.createRange();
            range.setStart(text, offset);
            range.setEnd(text, offset + 1);
            return range.getBoundingClientRect().left;
          };
          return [at(tabAt + 1), at(tabAt + 3)];
        });
        return letters.map((left, at) => Math.abs(left - (middles[at] ?? 0)));
      };
      for (const off of await offsets()) expect(off).toBeLessThanOrEqual(3);

      const before = await markers.first().boundingBox();
      const second = await markers.nth(1).boundingBox();
      await nudge(markers.nth(1), 1);
      await expect.poll(async () => (await markers.nth(1).boundingBox())?.x).not.toBe(second?.x);
      expect((await markers.first().boundingBox())?.x).toBe(before?.x);
      for (const off of await offsets()) expect(off).toBeLessThanOrEqual(3);
    },
    60_000,
  );
});
