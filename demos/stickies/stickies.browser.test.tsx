// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Locator, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: the font a note is set in, and that the styles of Stickies'
 * Font menu reach the text through each engine's own editing commands, from the keyboard
 * (Control off Apple platforms), the menu bar's Font menu, the note's contextual menu and the
 * Fonts panel, with the menu's checkmarks and the panel following the insertion point. The app
 * is served by the visual harness's page (visual/harness) and run in each engine Playwright has
 * installed; an engine that is not installed is skipped unless REQUIRE_BROWSER_TESTS is set
 * (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/stickies/examples/basic.tsx";
const WELCOME = "Make a note of it!";

requireEveryEngine("the Stickies tests");

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

/**
 * Wait for what the page shows to settle: `expect.poll` gives up after a second, which a menu's
 * or a pop-up's animation can take on a busy machine.
 */
function eventually<T>(value: () => Promise<T>) {
  return expect.poll(value, { timeout: 15_000 });
}

/** The computed style of the text that holds `word`, and the decorations drawn on it. */
function styleOf(text: Locator, word: string) {
  return text.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue?.includes(wanted)) continue;
      const holder = node.parentElement as HTMLElement;
      const style = getComputedStyle(holder);
      // A decoration is drawn by the element that sets it, over everything inside it.
      const lines: string[] = [];
      let block: HTMLElement = holder;
      for (let at: HTMLElement | null = holder; at && at !== element; at = at.parentElement) {
        lines.push(getComputedStyle(at).textDecorationLine);
        if (getComputedStyle(at).display === "block") block = at;
      }
      return {
        tag: holder.tagName,
        weight: Number(style.fontWeight),
        italic: style.fontStyle,
        size: style.fontSize,
        family: style.fontFamily,
        decorations: lines.join(" "),
        align: getComputedStyle(block).textAlign,
      };
    }
    return null;
  }, word);
}

/** Select `word` in the text, or put the insertion point in it, as a person would with the mouse. */
function select(text: Locator, word: string, caret = false) {
  return text.evaluate(
    (element, [wanted, collapsed]) => {
      (element as HTMLElement).focus();
      const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.nodeValue?.indexOf(wanted as string) ?? -1;
        if (at < 0) continue;
        const range = element.ownerDocument.createRange();
        range.setStart(node, at + (collapsed ? 1 : 0));
        range.setEnd(node, at + (collapsed ? 1 : (wanted as string).length));
        const selection = element.ownerDocument.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return true;
      }
      return false;
    },
    [word, caret] as const,
  );
}

/** Whether the text has the keyboard focus. */
const focused = (text: Locator) =>
  text.evaluate((element) => element.contains(element.ownerDocument.activeElement));

/** Whether `element` is what a press at its centre lands on: nothing covers it, and it takes it. */
const underPointer = (element: Locator) =>
  element.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hit = node.ownerDocument.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && node.contains(hit);
  });

describe.each(Object.keys(ENGINES))("Stickies in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    tab = await context.newPage();
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** The app as it opens, and the text of its front note. */
  async function open() {
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
    // The harness shrink-wraps its root for screenshots, and the example is as wide as the page
    // it is on: the root takes the page's width, or the desktop, which clips what it holds,
    // would have none to show the notes and the menu bar in.
    await tab.addStyleTag({ content: "#visual-root { display: block; }" });
    return tab.getByRole("group", { name: WELCOME }).getByRole("textbox");
  }

  /** Open the menu bar's Font menu. */
  async function fontMenu() {
    await tab.getByRole("menubar").getByRole("menuitem", { name: "Font", exact: true }).click();
    return tab.getByRole("menu");
  }

  async function closeMenu() {
    // Escape closes one menu at a time: a submenu, then its menu.
    for (let open = await tab.getByRole("menu").count(); open > 0; open -= 1) {
      await tab.keyboard.press("Escape");
    }
    await eventually(() => tab.getByRole("menu").count()).toBe(0);
  }

  /** Whether the Font menu checks Bold, Italic and Underline, in that order. */
  async function checked() {
    const menu = await fontMenu();
    const states = await Promise.all(
      ["Bold", "Italic", "Underline"].map((name) =>
        menu.getByRole("menuitemcheckbox", { name }).getAttribute("aria-checked"),
      ),
    );
    await closeMenu();
    return states;
  }

  it.runIf(available)(
    "sets a note in Helvetica 12 on a 14 pt line, its first line bold",
    async () => {
      const text = await open();
      const font = await text.evaluate((element) => {
        const style = getComputedStyle(element);
        // The line pitch as laid out: the tops of the first lines of text.
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(element);
        const tops = [...new Set([...range.getClientRects()].map((r) => Math.round(r.top)))];
        return {
          family: style.fontFamily,
          size: style.fontSize,
          lineHeight: Number.parseFloat(style.lineHeight),
          pitch: tops.slice(1, 5).map((top, index) => top - (tops[index] as number)),
        };
      });
      expect(font.family.split(",")[0]?.trim()).toBe("Helvetica");
      expect(font.size).toBe("12px");
      expect(font.lineHeight).toBeCloseTo(14, 2);
      expect(font.pitch).toEqual([14, 14, 14, 14]);
      const first = await styleOf(text, WELCOME);
      expect(first).toMatchObject({ tag: "B", weight: 700, size: "12px" });
      expect((await styleOf(text, "Stickies lets you"))?.weight).toBe(400);
    },
    200_000,
  );

  it.runIf(available)(
    "styles the selection with Command-B, -I and -U, and checks the styles at the insertion point",
    async () => {
      const text = await open();
      // The rich-text keys take Command on Apple platforms and Control elsewhere, by what the
      // browser reports.
      const apple = await tab.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform));
      const command = apple ? "Meta" : "Control";
      expect(await select(text, "jot")).toBe(true);
      await tab.keyboard.press(`${command}+b`);
      await tab.keyboard.press(`${command}+i`);
      await tab.keyboard.press(`${command}+u`);
      const styled = await styleOf(text, "jot");
      expect(styled?.weight).toBeGreaterThanOrEqual(600);
      expect(styled?.italic).toBe("italic");
      expect(styled?.decorations).toContain("underline");
      // Only the selection: the words beside it are as they were.
      const beside = await styleOf(text, " down reminders");
      expect(beside).toMatchObject({ weight: 400, italic: "normal" });
      expect(beside?.decorations).not.toContain("underline");
      // The keys keep the keyboard in the note.
      expect(await focused(text)).toBe(true);

      // The Font menu checks the styles where the insertion point is.
      await select(text, "jot", true);
      expect(await checked()).toEqual(["true", "true", "true"]);
      await select(text, "reminders", true);
      expect(await checked()).toEqual(["false", "false", "false"]);
      // Command-B again takes the style off.
      await select(text, "jot");
      await tab.keyboard.press(`${command}+b`);
      expect((await styleOf(text, "jot"))?.weight).toBe(400);
      expect((await styleOf(text, "jot"))?.italic).toBe("italic");
    },
    200_000,
  );

  it.runIf(available)(
    "styles the selection from the Font menu, with its Bigger and its Text submenu",
    async () => {
      const text = await open();
      await select(text, "desktop");
      let menu = await fontMenu();
      await menu.getByRole("menuitemcheckbox", { name: "Italic" }).click();
      await eventually(async () => (await styleOf(text, "desktop"))?.italic).toBe("italic");
      // The note keeps the keyboard and the selection: the next command acts on the same word.
      await eventually(() => focused(text)).toBe(true);
      menu = await fontMenu();
      await menu.getByRole("menuitem", { name: "Bigger" }).click();
      await eventually(() => focused(text)).toBe(true);
      menu = await fontMenu();
      await menu.getByRole("menuitem", { name: "Bigger" }).click();
      await eventually(async () => (await styleOf(text, "desktop"))?.size).toBe("14px");
      // A line of bigger text is taller, as AppKit lays it out: its words do not overlap the
      // lines around it.
      const tall = await text.evaluate((element) => {
        const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.nodeValue === "desktop") return (node.parentElement as HTMLElement).offsetHeight;
        }
        return 0;
      });
      expect(tall).toBeGreaterThan(14);

      await eventually(() => focused(text)).toBe(true);
      menu = await fontMenu();
      await menu.getByRole("menuitem", { name: "Text" }).click();
      await tab.getByRole("menuitemradio", { name: "Center" }).click();
      await eventually(async () => (await styleOf(text, "desktop"))?.align).toBe("center");
      // Its paragraph only: the first line stays at the left.
      expect((await styleOf(text, WELCOME))?.align).not.toBe("center");
      // The Text submenu checks the alignment where the insertion point is.
      await eventually(() => tab.getByRole("menu").count()).toBe(0);
      await select(text, "desktop", true);
      menu = await fontMenu();
      await menu.getByRole("menuitem", { name: "Text" }).click();
      await eventually(() =>
        tab.getByRole("menuitemradio", { name: "Center" }).getAttribute("aria-checked"),
      ).toBe("true");
      await closeMenu();
    },
    200_000,
  );

  it.runIf(available)(
    "styles the selection from the Font submenu of the note's contextual menu",
    async () => {
      const text = await open();
      await select(text, "lists");
      // A secondary click on the selected word, which keeps it selected.
      const box = await text.evaluate((element) => {
        const range = element.ownerDocument.getSelection()?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
      });
      expect(box).not.toBeNull();
      await tab.mouse.click(box?.x ?? 0, box?.y ?? 0, { button: "right" });
      const menu = tab.getByRole("menu", { name: "Note" });
      await menu.getByRole("menuitem", { name: "Font" }).click();
      await tab
        .getByRole("menu", { name: "Font" })
        .getByRole("menuitemcheckbox", { name: "Underline" })
        .click();
      await eventually(async () => (await styleOf(text, "lists"))?.decorations).toContain(
        "underline",
      );
      expect((await styleOf(text, " or other information"))?.decorations).not.toContain(
        "underline",
      );
      await eventually(() => focused(text)).toBe(true);
    },
    200_000,
  );

  it.runIf(available)(
    "styles the selection from the Fonts panel, which follows the insertion point",
    async () => {
      const text = await open();
      await select(text, "graphics");
      const menu = await fontMenu();
      await menu.getByRole("menuitem", { name: "Show Fonts" }).click();
      const panel = tab.getByRole("dialog", { name: "Fonts" });
      await eventually(() => panel.isVisible()).toBe(true);
      // The note keeps the keyboard, as a Catalina document does when its Fonts panel shows.
      await eventually(() => focused(text)).toBe(true);

      const family = panel.getByRole("listbox", { name: "Family" });
      const familyChosen = (name: string) =>
        eventually(() =>
          family.getByRole("option", { name, exact: true }).getAttribute("aria-selected"),
        ).toBe("true");
      // A family every engine here renders: the panel dims those the machine has no font for.
      await family.getByRole("option", { name: "Courier", exact: true }).click();
      await eventually(async () => (await styleOf(text, "graphics"))?.family).toMatch(/^Courier/);
      // The panel shows the font of the selection it just set.
      await familyChosen("Courier");

      // Strikethrough is in the Fonts panel only. The pop-up opens from the keyboard, and its item
      // is clicked once it is what a press there lands on: while the pop-up opens it takes no
      // pointer, which a click at once can meet.
      await panel.getByRole("combobox", { name: "Text strikethrough" }).focus();
      await tab.keyboard.press("ArrowDown");
      const single = tab.getByRole("option", { name: "Single" });
      await eventually(() => underPointer(single)).toBe(true);
      await single.click();
      await eventually(async () => (await styleOf(text, "graphics"))?.decorations).toContain(
        "line-through",
      );
      // The pop-up has closed: while it is open the rest of the page takes no focus. (A closed
      // pop-up stays in the document, hidden.)
      await eventually(() =>
        panel.getByRole("combobox", { name: "Text strikethrough" }).getAttribute("aria-expanded"),
      ).toBe("false");

      // The panel follows the insertion point.
      const strikethrough = () =>
        panel.getByRole("combobox", { name: "Text strikethrough" }).textContent();
      await select(text, "reminders", true);
      await familyChosen("Helvetica");
      await eventually(strikethrough).toBe("None");
      await select(text, "graphics", true);
      await familyChosen("Courier");
      await eventually(strikethrough).toBe("Single");
    },
    200_000,
  );
});
