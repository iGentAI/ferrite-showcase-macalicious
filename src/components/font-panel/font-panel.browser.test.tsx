// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";

/*
 * What only a browser can show: that a change chosen in the Fonts panel reaches the selected
 * text through the browser's own editing commands (`applyRichTextFormat` of
 * `macalicious/lib/rich-text`), with the selection given back to the text first, and that the
 * panel then shows the format of that text. The example is served by the visual harness's page
 * (visual/harness) and run in each engine Playwright has installed; an engine that is not
 * installed is skipped unless REQUIRE_BROWSER_TESTS is set (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../../..");
const EXAMPLE = "src/components/font-panel/examples/with-text.tsx";

requireEveryEngine("the Fonts panel tests");

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

describe.each(Object.keys(ENGINES))("Fonts panel in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Select the word `word` of the text, as a double click would, wherever its node is. */
  const selectWord = (word: string) =>
    tab.getByRole("textbox", { name: "Text", exact: true }).evaluate((element, wanted) => {
      const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let text = walker.nextNode() as Text | null;
      while (text && !(text.nodeValue ?? "").includes(wanted)) text = walker.nextNode() as Text;
      if (!text) throw new Error(`no "${wanted}" in the text`);
      const at = (text.nodeValue ?? "").indexOf(wanted);
      element.focus();
      const range = element.ownerDocument.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + wanted.length);
      const selection = element.ownerDocument.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }, word);

  /** The computed style of the element that holds the start of the word `word`. */
  const styleOf = (word: string) =>
    tab.getByRole("textbox", { name: "Text", exact: true }).evaluate((element, wanted) => {
      const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!(node.nodeValue ?? "").includes(wanted)) continue;
        const holder = node.parentElement as Element;
        const style = getComputedStyle(holder);
        const lines: string[] = [];
        for (let at: Element | null = holder; at && at !== element; at = at.parentElement) {
          lines.push(getComputedStyle(at).textDecorationLine);
        }
        return {
          family: style.fontFamily,
          weight: style.fontWeight,
          size: style.fontSize,
          decoration: lines.join(" "),
          text: node.nodeValue,
        };
      }
      return null;
    }, word);

  const row = (list: string, name: string) =>
    tab.getByRole("listbox", { name: list }).getByRole("option", { name, exact: true });

  it.runIf(available)(
    "sets the family, typeface, size and effects of the selection, and shows them",
    async () => {
      await selectWord("font");
      await row("Family", "Georgia").click();
      await expect.poll(async () => (await styleOf("font"))?.family).toMatch(/^Georgia/);
      // The selection came back to the text: the next change applies to the same word.
      await row("Typeface", "Bold").click();
      await expect.poll(async () => Number((await styleOf("font"))?.weight)).toBeGreaterThan(600);
      await row("Size", "24").click();
      await expect.poll(async () => (await styleOf("font"))?.size).toBe("24px");
      await tab.getByRole("combobox", { name: "Text underline" }).click();
      await tab.getByRole("option", { name: "Single" }).click();
      await expect.poll(async () => (await styleOf("font"))?.decoration).toContain("underline");
      // The first menu has gone before the second opens.
      await expect.poll(() => tab.getByRole("option", { name: "Single" }).count()).toBe(0);
      await tab.getByRole("combobox", { name: "Text strikethrough" }).click();
      await tab.getByRole("option", { name: "Single" }).click();
      await expect.poll(async () => (await styleOf("font"))?.decoration).toContain("line-through");
      // Only the word changed.
      expect((await styleOf("Select"))?.size).toBe("12px");
      expect((await styleOf("Select"))?.family).toMatch(/^Helvetica/);

      // The panel follows the insertion point: inside the styled word, then outside it.
      const chosen = (list: string, name: string) =>
        expect.poll(() => row(list, name).getAttribute("aria-selected")).toBe("true");
      const effect = (name: string) => tab.getByRole("combobox", { name }).textContent();
      await selectWord("font");
      await chosen("Family", "Georgia");
      await chosen("Typeface", "Bold");
      await chosen("Size", "24");
      await expect.poll(() => effect("Text underline")).toContain("Single");
      await expect.poll(() => effect("Text strikethrough")).toContain("Single");
      await selectWord("Select");
      await chosen("Family", "Helvetica");
      await chosen("Typeface", "Regular");
      await chosen("Size", "12");
      await expect.poll(() => effect("Text underline")).toContain("None");
    },
    90_000,
  );

  /** Replace the text's content with `html`, as a stored document would fill it. */
  const fill = (html: string) =>
    tab.getByRole("textbox", { name: "Text", exact: true }).evaluate((element, markup) => {
      element.innerHTML = markup;
    }, html);

  /** Select from the start of `from` to the end of `to` (two words, perhaps in two nodes). */
  const selectSpan = (from: string, to: string) =>
    tab.getByRole("textbox", { name: "Text", exact: true }).evaluate(
      (element, [first, last]) => {
        const find = (word: string) => {
          const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const at = (node.nodeValue ?? "").indexOf(word);
            if (at >= 0) return [node, at] as const;
          }
          throw new Error(`no "${word}" in the text`);
        };
        const [startNode, start] = find(first as string);
        const [endNode, end] = find(last as string);
        element.focus();
        const range = element.ownerDocument.createRange();
        range.setStart(startNode, start);
        range.setEnd(endNode, end + (last as string).length);
        const selection = element.ownerDocument.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      },
      [from, to] as const,
    );

  it.runIf(available)(
    "changes nothing at an insertion point, and leaves sizes outside the selection alone",
    async () => {
      await fill('<div>one two <font size="7">kept</font></div>');
      // At an insertion point a size changes nothing, and leaves nothing in the text.
      const before = await tab
        .getByRole("textbox", { name: "Text", exact: true })
        .evaluate((element) => element.innerHTML);
      await selectWord("one");
      await tab.keyboard.press("ArrowRight");
      await row("Size", "36").click();
      expect(
        await tab
          .getByRole("textbox", { name: "Text", exact: true })
          .evaluate((element) => element.innerHTML),
      ).toBe(before);

      // Sizing "two" leaves the browser's size-7 element after it as it looked: 48 px.
      await selectWord("two");
      await row("Size", "18").click();
      await expect.poll(async () => (await styleOf("two"))?.size).toBe("18px");
      expect((await styleOf("kept"))?.size).toBe("48px");
      // And one whose own style draws it at another size, at that size.
      await fill('<div>start <font size="7" style="font-size: 20px">styled</font> end</div>');
      await selectWord("end");
      await row("Size", "24").click();
      await expect.poll(async () => (await styleOf("end"))?.size).toBe("24px");
      expect((await styleOf("styled"))?.size).toBe("20px");
      // Text inside such an element takes the size it is given.
      await fill('<div>start <font size="7">inside large</font></div>');
      await selectWord("inside");
      await row("Size", "24").click();
      await expect.poll(async () => (await styleOf("inside"))?.size).toBe("24px");
      expect((await styleOf("large"))?.size).toBe("48px");
      expect((await styleOf("start"))?.size).toBe("12px");
    },
    90_000,
  );

  it.runIf(available)(
    "puts each size change in the browser's undo history, and sizes across paragraphs",
    async () => {
      await fill("<div>first line</div><div>second line</div>");
      // Selected text: one undo puts it back.
      await selectWord("first");
      await row("Size", "24").click();
      await expect.poll(async () => (await styleOf("first"))?.size).toBe("24px");
      await selectWord("first");
      await tab.keyboard.press("Control+z");
      await expect.poll(async () => (await styleOf("first"))?.size).toBe("12px");
      await tab.keyboard.press("Control+Shift+z");
      await expect.poll(async () => (await styleOf("first"))?.size).toBe("24px");
      // Across two paragraphs: both parts take the size, and the lines stay two.
      await selectSpan("line", "second");
      await row("Size", "18").click();
      await expect.poll(async () => (await styleOf("line"))?.size).toBe("18px");
      await expect.poll(async () => (await styleOf("second"))?.size).toBe("18px");
      const lines = await tab
        .getByRole("textbox", { name: "Text", exact: true })
        .evaluate((element) => (element as HTMLElement).innerText.trim().split(/\n+/));
      expect(lines).toHaveLength(2);
      // The selection is kept: the panel shows its size.
      await expect.poll(() => row("Size", "18").getAttribute("aria-selected")).toBe("true");
    },
    90_000,
  );

  it.runIf(available)(
    "sets a style on the whole of a selection that has it in part",
    async () => {
      await fill("<div><b>bold</b> plain</div>");
      // The first character is bold, so Bold Regular in the typeface list clears it everywhere.
      await selectSpan("bold", "plain");
      await row("Typeface", "Regular").click();
      await expect.poll(async () => Number((await styleOf("bold"))?.weight)).toBeLessThan(600);
      expect(Number((await styleOf("plain"))?.weight)).toBeLessThan(600);
      // And Bold sets it everywhere, the plain word included.
      await fill("<div>plain <b>bold</b></div>");
      await selectSpan("plain", "bold");
      await row("Typeface", "Bold").click();
      await expect.poll(async () => Number((await styleOf("plain"))?.weight)).toBeGreaterThan(600);
      expect(Number((await styleOf("bold"))?.weight)).toBeGreaterThan(600);
      // A selection of a bold space alone loses its bold.
      await fill("<div>a<b> </b>z</div>");
      await tab.getByRole("textbox", { name: "Text", exact: true }).evaluate((element) => {
        const space = element.querySelector("b")?.firstChild as Text;
        element.focus();
        const range = document.createRange();
        range.selectNodeContents(space);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
      });
      await row("Typeface", "Regular").click();
      await expect
        .poll(() =>
          tab.getByRole("textbox", { name: "Text", exact: true }).evaluate((element) => {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (node.nodeValue?.includes(" ") || node.nodeValue?.includes("\u00A0")) {
                return Number(getComputedStyle(node.parentElement as Element).fontWeight);
              }
            }
            return 0;
          }),
        )
        .toBeLessThan(600);
    },
    90_000,
  );

  it.runIf(available)(
    "shows the format of a selection's first character, whatever the rest of it holds",
    async () => {
      await fill("<div><b>bold</b> plain <u>under</u></div>");
      const chosen = (list: string, name: string) =>
        expect.poll(() => row(list, name).getAttribute("aria-selected")).toBe("true");
      const effect = (name: string) => tab.getByRole("combobox", { name }).textContent();
      // From the bold word into plain text: Bold, as the first character is.
      await selectSpan("bold", "plain");
      await chosen("Typeface", "Bold");
      // From plain text into the underlined word: Regular, no underline.
      await selectSpan("plain", "under");
      await chosen("Typeface", "Regular");
      await expect.poll(() => effect("Text underline")).toContain("None");
      // Select All starts before the first paragraph: its first word, in <b>, is read.
      await tab.getByRole("textbox", { name: "Text", exact: true }).evaluate((element) => {
        element.focus();
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(element);
        element.ownerDocument.getSelection()?.removeAllRanges();
        element.ownerDocument.getSelection()?.addRange(range);
      });
      await chosen("Typeface", "Bold");
      // From the underlined word: underlined.
      await selectSpan("under", "under");
      await expect.poll(() => effect("Text underline")).toContain("Single");
      // An insertion point after a paragraph whose last word is bold: the panel shows what the
      // next character typed there takes, whichever way the browser decides it.
      await tab.getByRole("textbox", { name: "Text", exact: true }).evaluate((element) => {
        element.innerHTML = "<div>plain <b>bold</b></div>";
        element.focus();
        const range = element.ownerDocument.createRange();
        range.setStart(element.firstChild as Node, 2);
        range.collapse(true);
        element.ownerDocument.getSelection()?.removeAllRanges();
        element.ownerDocument.getSelection()?.addRange(range);
      });
      await expect
        .poll(() =>
          tab
            .getByRole("listbox", { name: "Typeface" })
            .locator("[aria-selected=true]")
            .textContent(),
        )
        .toMatch(/^(Bold|Regular)$/);
      const shown = await tab
        .getByRole("listbox", { name: "Typeface" })
        .locator("[aria-selected=true]")
        .textContent();
      await tab.keyboard.type("Z");
      const typed = Number((await styleOf("Z"))?.weight);
      expect(shown === "Bold").toBe(typed >= 600);
      // A word of <b> set back to regular weight by its own style is regular.
      await fill('<div><b>bold <span style="font-weight: normal">reset</span></b></div>');
      await selectWord("reset");
      await chosen("Typeface", "Regular");
      // And by a style sheet; a paragraph aligned left inside a centred one is left-aligned.
      await tab.evaluate(() => {
        const sheet = document.createElement("style");
        sheet.textContent = "b.plain { font-weight: normal } i.plain { font-style: normal }";
        document.head.append(sheet);
      });
      await fill(
        '<div style="text-align: center"><div style="text-align: left"><b class="plain"><i class="plain">sheet</i></b></div></div>',
      );
      await selectWord("sheet");
      await chosen("Typeface", "Regular");
      const aligned = await tab
        .getByRole("textbox", { name: "Text", exact: true })
        .evaluate((element) => getComputedStyle(element.querySelector("i") as Element).textAlign);
      expect(aligned).toMatch(/^(left|start)$/);
    },
    90_000,
  );
});
