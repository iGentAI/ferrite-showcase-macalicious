// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that the New Message window sets its text in Mail's message
 * font, Helvetica 12, and that every way it styles text really changes the text. The keys of
 * Format > Font and Format > Text (Command is Control off Apple platforms), the format bar, the
 * Fonts panel and the Colors panel run the browser's editing commands on the selection, the
 * format bar shows the style where the insertion point is, and the message's HTML, which is
 * what Send hands over as `html`, holds the styles. The window is served by the visual
 * harness's page (visual/harness) and run in each engine Playwright has installed; an engine
 * that is not installed is skipped unless REQUIRE_BROWSER_TESTS is set
 * (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/mail/examples/compose.tsx";

requireEveryEngine("the Mail styling tests");

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

describe.each(Object.keys(ENGINES))("Mail styling in %s", (engineName) => {
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

  const message = () => tab.getByRole("textbox", { name: "Message", exact: true });
  const bar = () => tab.getByRole("toolbar", { name: "Format", exact: true });

  it.runIf(available)("Find takes its lines from how the text is rendered", async () => {
    const module = `/@fs${path.join(root, "demos/mail/mail-find.tsx")}`;
    await tab.addScriptTag({
      type: "module",
      content: `import { findRanges } from ${JSON.stringify(module)}; window.findRanges = findRanges;`,
    });
    await tab.waitForFunction(() => "findRanges" in window);
    const found = await tab.evaluate(() => {
      const { findRanges } = window as unknown as {
        findRanges: (root: Node, words: string) => Range[];
      };
      const search = (fill: (holder: HTMLElement) => void, words: string): string[] => {
        const holder = document.createElement("div");
        fill(holder);
        document.body.append(holder);
        const ranges = findRanges(holder, words).map(String);
        holder.remove();
        return ranges;
      };
      const html = (markup: string) => (holder: HTMLElement) => {
        holder.innerHTML = markup;
      };
      const returned = (holder: HTMLElement) => {
        const pre = document.createElement("pre");
        pre.append(document.createTextNode("fer\rry"));
        holder.append(pre);
      };
      return {
        blockSpan: search(html('<span style="display:block">fer</span>ry'), "ferry"),
        inlineDiv: search(html('<div style="display:inline">fer</div>ry'), "ferry"),
        inlineTag: search(html("<b>fer</b>ry"), "ferry"),
        hidden: search(html('fer<span style="display:none">x</span>ry'), "ferry"),
        lineBreak: search(html("fer<br>ry"), "ferry"),
        returnWhole: search(returned, "fer\rry"),
        returnFirst: search(returned, "fer"),
        returnLast: search(returned, "ry"),
        collapsed: search(html("<p>a\n  <b>fast</b></p>"), "a fast"),
        collapsedAcross: search((holder) => {
          holder.append("a ", " ", document.createTextNode("\nfast"));
        }, "a fast"),
        preserved: search(html("<pre>a\n  fast</pre>"), "a fast"),
        twoSpaces: search(html("<pre>a  fast</pre>"), "a fast"),
        twoSpacesWrap: search(html('<p style="white-space:pre-wrap">a  fast</p>'), "a fast"),
        twoSpacesBreak: search(html('<p style="white-space:break-spaces">a  fast</p>'), "a fast"),
        twoSpacesAsked: search(html("<pre>a  fast</pre>"), "a  fast"),
        preLine: search(html('<p style="white-space:pre-line">a   fast</p>'), "a fast"),
      };
    });
    expect(found).toEqual({
      blockSpan: [],
      inlineDiv: ["ferry"],
      inlineTag: ["ferry"],
      hidden: ["ferxry"],
      lineBreak: [],
      returnWhole: [],
      returnFirst: ["fer"],
      returnLast: ["ry"],
      collapsed: ["a\n  fast"],
      collapsedAcross: ["a  \nfast"],
      preserved: [],
      twoSpaces: [],
      twoSpacesWrap: [],
      twoSpacesBreak: [],
      twoSpacesAsked: ["a  fast"],
      preLine: ["a   fast"],
    });
  });

  /** Select `word`, or put the insertion point `at` characters into it, wherever its node is. */
  const select = (word: string, at?: number) =>
    message().evaluate(
      (element, [wanted, offset]) => {
        const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let text = walker.nextNode() as Text | null;
        while (text && !(text.nodeValue ?? "").includes(wanted as string)) {
          text = walker.nextNode() as Text | null;
        }
        if (!text) throw new Error(`no "${wanted}" in the message`);
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
    message().evaluate((element, wanted) => {
      const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!(node.nodeValue ?? "").includes(wanted)) continue;
        const holder = node.parentElement as Element;
        const style = getComputedStyle(holder);
        const lines: string[] = [];
        let align = getComputedStyle(element).textAlign;
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
    bar().getByRole("button", { name, exact: true }).getAttribute("aria-pressed");
  const shown = (name: string) => bar().getByRole("combobox", { name, exact: true }).textContent();

  it.runIf(available)(
    "sets the text in Helvetica 12, styles it from the keys, the format bar and the panels, and shows the style",
    async () => {
      // Mail's message font, Helvetica 12, before anything is styled.
      const start = await styleOf("weather");
      expect(start?.family).toMatch(/^Helvetica/);
      expect(start?.size).toBe("12px");
      expect(start?.weight).toBeLessThan(600);

      // The Aa button shows and hides the format bar, hidden at first.
      const toggle = tab.getByRole("button", { name: "Show Format Bar", exact: true });
      expect(await toggle.getAttribute("aria-pressed")).toBe("false");
      expect(await bar().count()).toBe(0);
      await toggle.click();
      await bar().waitFor({ timeout: 10_000 });
      expect(await toggle.getAttribute("aria-pressed")).toBe("true");

      // The keys of Format > Font: Command on Apple platforms, Control elsewhere, by what the
      // browser reports.
      const apple = await tab.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform));
      const command = apple ? "Meta" : "Control";
      await select("weather");
      await tab.keyboard.press(`${command}+b`);
      await expect.poll(async () => (await styleOf("weather"))?.weight).toBeGreaterThanOrEqual(600);
      await tab.keyboard.press(`${command}+i`);
      await expect.poll(async () => (await styleOf("weather"))?.italic).toBe("italic");
      await tab.keyboard.press(`${command}+u`);
      await expect.poll(async () => (await styleOf("weather"))?.decoration).toContain("underline");
      await expect.poll(() => pressed("Bold")).toBe("true");
      await expect.poll(() => pressed("Italic")).toBe("true");
      await expect.poll(() => pressed("Underline")).toBe("true");
      // Bigger: one point up, which the bar's size shows.
      await tab.keyboard.press(`${command}+=`);
      await expect.poll(async () => (await styleOf("weather"))?.size).toBe("13px");
      await expect.poll(() => shown("Font size")).toContain("13");

      // The format bar: strikethrough, a family, an alignment.
      await bar().getByRole("button", { name: "Strikethrough", exact: true }).click();
      await expect
        .poll(async () => (await styleOf("weather"))?.decoration)
        .toContain("line-through");
      // Underlined as well still.
      expect((await styleOf("weather"))?.decoration).toContain("underline");
      await expect.poll(() => pressed("Strikethrough")).toBe("true");
      await bar().getByRole("combobox", { name: "Font family", exact: true }).click();
      await tab.getByRole("option", { name: "Georgia", exact: true }).click();
      await expect.poll(async () => (await styleOf("weather"))?.family).toMatch(/^Georgia/);
      await expect.poll(() => shown("Font family")).toContain("Georgia");
      await bar().getByRole("button", { name: "Center", exact: true }).click();
      await expect.poll(async () => (await styleOf("weather"))?.align).toMatch(/center/);

      // Smaller, from the keyboard: back to 12 pt.
      await select("weather");
      await tab.keyboard.press(`${command}+-`);
      await expect.poll(async () => (await styleOf("weather"))?.size).toBe("12px");

      // The keys of Format > Text: right, center, left.
      await select("crossing");
      await tab.keyboard.press(`${command}+Shift+BracketRight`);
      await expect.poll(async () => (await styleOf("crossing"))?.align).toMatch(/right/);
      await tab.keyboard.press(`${command}+Shift+Backslash`);
      await expect.poll(async () => (await styleOf("crossing"))?.align).toMatch(/center/);
      await tab.keyboard.press(`${command}+Shift+BracketLeft`);
      await expect
        .poll(async () => (await styleOf("crossing"))?.align)
        .toMatch(/^(left|start|-webkit-left|-moz-left)$/);
      await expect.poll(() => pressed("Align left")).toBe("true");

      // The Fonts panel: Command-T opens it, a family is set, Command-T and the close button
      // close it.
      await select("north");
      await tab.keyboard.press(`${command}+t`);
      const fonts = tab.getByRole("region", { name: "Fonts" });
      await fonts.waitFor({ timeout: 10_000 });
      // A family every engine here renders: the panel dims those the machine has no font for.
      await fonts
        .getByRole("listbox", { name: "Family" })
        .getByRole("option", { name: "Courier", exact: true })
        .click();
      await expect.poll(async () => (await styleOf("north"))?.family).toMatch(/^Courier/);
      await tab.keyboard.press(`${command}+t`);
      await expect.poll(() => fonts.count()).toBe(0);
      await tab.keyboard.press(`${command}+t`);
      await fonts.waitFor({ timeout: 10_000 });
      await fonts.getByRole("button", { name: "Close" }).click();
      await expect.poll(() => fonts.count()).toBe(0);

      // The Colors panel: a colour from the Apple palette; Shift-Command-C closes it again.
      await select("north");
      await tab.keyboard.press(`${command}+Shift+C`);
      const colors = tab.getByRole("region", { name: "Colors" });
      await colors.waitFor({ timeout: 10_000 });
      await colors.getByRole("tab", { name: "Color Palettes" }).click();
      await colors.getByRole("radio", { name: "Red" }).click();
      await expect.poll(async () => (await styleOf("north"))?.color).not.toBe("rgb(0, 0, 0)");
      await tab.keyboard.press(`${command}+Shift+C`);
      await expect.poll(() => colors.count()).toBe(0);

      // The format bar follows the insertion point: plain text, then the styled words.
      await select("If", 1);
      await expect.poll(() => pressed("Bold")).toBe("false");
      await expect.poll(() => pressed("Italic")).toBe("false");
      await expect.poll(() => pressed("Underline")).toBe("false");
      await expect.poll(() => pressed("Strikethrough")).toBe("false");
      await expect.poll(() => shown("Font family")).toContain("Helvetica");
      await expect.poll(() => shown("Font size")).toContain("12");
      await select("weather", 2);
      await expect.poll(() => pressed("Bold")).toBe("true");
      await expect.poll(() => pressed("Italic")).toBe("true");
      await expect.poll(() => pressed("Underline")).toBe("true");
      await expect.poll(() => pressed("Strikethrough")).toBe("true");
      await expect.poll(() => shown("Font family")).toContain("Georgia");
      await select("north", 2);
      await expect.poll(() => shown("Font family")).toContain("Courier");
      await expect.poll(() => pressed("Bold")).toBe("false");
      await expect
        .poll(() =>
          bar()
            .getByLabel("Text color")
            .evaluate((well) => (well as HTMLInputElement).value),
        )
        .not.toBe("#000000");

      // What Send hands over as `html` (the message's HTML) holds every style it shows.
      const html = await message().evaluate((element) => element.innerHTML);
      expect(html).toMatch(/bold|<b>|<strong>/);
      expect(html).toMatch(/italic|<i>|<em>/);
      expect(html).toMatch(/underline|<u>/);
      expect(html).toMatch(/line-through|<s>|<strike>/);
      expect(html).toMatch(/Georgia/);
      expect(html).toMatch(/Courier/);

      // The Aa button hides the bar again.
      await toggle.click();
      await expect.poll(() => bar().count()).toBe(0);
    },
    120_000,
  );
  it.runIf(available)(
    "styles and aligns the message from the desktop's Format menu, with the styles checked",
    async () => {
      await tab.goto(`${origin}/?example=demos/mail/examples/format-menu.tsx&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const menuBar = tab.getByRole("menubar", { name: "Mail menus" });
      const open = async (submenu: string) => {
        await menuBar.getByRole("menuitem", { name: "Format", exact: true }).click();
        await tab.getByRole("menuitem", { name: submenu, exact: true }).hover();
      };
      await select("weather");
      await open("Font");
      await tab.getByRole("menuitemcheckbox", { name: /^Bold/ }).click();
      await expect.poll(async () => (await styleOf("weather"))?.weight).toBeGreaterThanOrEqual(600);
      // Checked now, where the selection is.
      await select("weather", 2);
      await open("Font");
      await expect
        .poll(() =>
          tab.getByRole("menuitemcheckbox", { name: /^Bold/ }).getAttribute("aria-checked"),
        )
        .toBe("true");
      // Escape closes the submenu, then the menu.
      await tab.keyboard.press("Escape");
      await tab.keyboard.press("Escape");
      await expect.poll(() => tab.getByRole("menu").count()).toBe(0);
      await open("Text");
      await tab.getByRole("menuitemradio", { name: /^Align Right/ }).click();
      await expect.poll(async () => (await styleOf("weather"))?.align).toMatch(/right/);
      // The styled text is what Send hands over.
      expect(await message().evaluate((element) => element.innerHTML)).toMatch(/bold|<b>|700/);
    },
    60_000,
  );
});
