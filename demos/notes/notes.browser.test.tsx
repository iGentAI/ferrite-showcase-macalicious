// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Locator, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that the styles of Notes' Format menu reach the text through the
 * browser's own editing commands, from each entry point. A word is selected in a note and made
 * bold, italic and underlined with the key equivalents (Command is the Control key off Apple
 * platforms), struck through from the format button's Font submenu, centred from the menu
 * bar's Text submenu, and given another family and size in the Fonts panel; each time the
 * text's computed style is read back, and the menus' checkmarks and the panel's lists follow
 * the insertion point. The example is served by the visual harness's page (visual/harness)
 * and run in each engine Playwright has installed; an engine that is not installed is skipped
 * unless REQUIRE_BROWSER_TESTS is set (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/notes/examples/basic.tsx";

requireEveryEngine("the Notes tests");

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

/** What the browser computes for the text that holds `word` in the note. */
interface Computed {
  weight: number;
  style: string;
  /** The decoration lines of the text's element and the elements around it, up to the note. */
  lines: string;
  family: string;
  size: string;
  /** The alignment of the line (the note's own child) that holds the word. */
  align: string;
}

/** Select `word` in the note, as a double click would, with the note focused. */
const selectWord = (note: Locator, word: string) =>
  note.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue?.includes(wanted)) node = walker.nextNode();
    if (!node) throw new Error(`no ${wanted} in the note`);
    const at = (node.nodeValue ?? "").indexOf(wanted);
    const range = element.ownerDocument.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + wanted.length);
    (element as HTMLElement).focus();
    const selection = element.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, word);

const computed = (note: Locator, word: string): Promise<Computed> =>
  note.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue?.includes(wanted)) node = walker.nextNode();
    const holder = node?.parentElement;
    if (!holder) throw new Error(`no ${wanted} in the note`);
    const style = getComputedStyle(holder);
    const lines: string[] = [];
    let line: Element = holder;
    for (let at: Element | null = holder; at && at !== element; at = at.parentElement) {
      lines.push(getComputedStyle(at).textDecorationLine);
      line = at;
    }
    return {
      weight: Number(style.fontWeight),
      style: style.fontStyle,
      lines: lines.join(" "),
      family: style.fontFamily,
      size: style.fontSize,
      align: getComputedStyle(line).textAlign,
    };
  }, word);

describe.each(Object.keys(ENGINES))("Notes in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext({ viewport: { width: 1200, height: 1300 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.runIf(available)(
    "styles the selection from the keys, the menus and the Fonts panel",
    async () => {
      // The library's menus and the rich-text keys take Command on Apple platforms, Control
      // elsewhere, by what the browser reports.
      const apple = await tab.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform));
      const command = apple ? "Meta" : "Control";
      const window = tab.getByRole("region", { name: "Notes", exact: true });
      await window
        .getByRole("listbox", { name: "Notes" })
        .getByRole("option", { name: /Yosemite/ })
        .click();
      const note = tab.getByRole("textbox", { name: "Note", exact: true });
      await expect.poll(() => note.textContent()).toContain("kinda nice in here");
      const focused = () =>
        note.evaluate((element) => element.ownerDocument.activeElement === element);

      // The key equivalents, in the browser's own editing.
      await selectWord(note, "kinda");
      await tab.keyboard.press(`${command}+b`);
      expect((await computed(note, "kinda")).weight).toBeGreaterThanOrEqual(600);
      await selectWord(note, "nice");
      await tab.keyboard.press(`${command}+i`);
      expect((await computed(note, "nice")).style).toBe("italic");
      expect((await computed(note, "nice")).weight).toBeLessThan(600);
      await selectWord(note, "here");
      await tab.keyboard.press(`${command}+u`);
      expect((await computed(note, "here")).lines).toContain("underline");

      // The format button's Font submenu checks the styles at the selection and strikes it
      // through; the note has the keyboard again afterwards.
      await selectWord(note, "kinda");
      await window.getByRole("button", { name: "Format", exact: true }).click();
      await tab.getByRole("menuitem", { name: "Font", exact: true }).hover();
      const bold = tab.getByRole("menuitemcheckbox", { name: "Bold", exact: true });
      await expect.poll(() => bold.getAttribute("aria-checked")).toBe("true");
      expect(
        await tab
          .getByRole("menuitemcheckbox", { name: "Italic", exact: true })
          .getAttribute("aria-checked"),
      ).toBe("false");
      await tab.getByRole("menuitemcheckbox", { name: "Strikethrough", exact: true }).click();
      await expect
        .poll(async () => (await computed(note, "kinda")).lines)
        .toContain("line-through");
      expect((await computed(note, "kinda")).weight).toBeGreaterThanOrEqual(600);
      await expect.poll(focused).toBe(true);

      // The menu bar's Text submenu centres the line, and checks Center there afterwards.
      const menuBar = tab.getByRole("menubar", { name: "Notes menus" });
      await menuBar.getByRole("menuitem", { name: "Format", exact: true }).click();
      await tab.getByRole("menuitem", { name: "Text", exact: true }).hover();
      await tab.getByRole("menuitemradio", { name: "Center", exact: true }).click();
      await expect.poll(async () => (await computed(note, "kinda")).align).toBe("center");
      await expect.poll(focused).toBe(true);
      await menuBar.getByRole("menuitem", { name: "Format", exact: true }).click();
      await tab.getByRole("menuitem", { name: "Text", exact: true }).hover();
      const center = tab.getByRole("menuitemradio", { name: "Center", exact: true });
      await expect.poll(() => center.getAttribute("aria-checked")).toBe("true");
      await tab.keyboard.press("Escape");
      await tab.keyboard.press("Escape");
      await expect.poll(() => tab.getByRole("menu").count()).toBe(0);
      await menuBar.getByRole("menuitem", { name: "Format", exact: true }).click();
      await tab.getByRole("menuitem", { name: "Font", exact: true }).hover();
      await tab.getByRole("menuitem", { name: "Show Fonts", exact: true }).click();

      // The Fonts panel: another family and size for a word of the title.
      const panel = tab.getByRole("dialog", { name: "Fonts" });
      await panel.waitFor();
      const list = (name: string) => panel.getByRole("listbox", { name, exact: true });
      const chosen = (name: string) =>
        list(name).locator('[role="option"][aria-selected="true"]').allTextContents();
      await expect.poll(() => chosen("Typeface")).toEqual(["Bold"]);
      expect(await chosen("Family")).toEqual(["System Font"]);

      await selectWord(note, "Yosemite");
      await expect.poll(() => chosen("Typeface")).toEqual(["Bold"]);
      // A family every engine here renders: the panel dims those the machine has no font for.
      await list("Family").getByRole("option", { name: "Courier", exact: true }).click();
      await expect.poll(async () => (await computed(note, "Yosemite")).family).toMatch(/^Courier/);
      await list("Size").getByRole("option", { name: "24", exact: true }).click();
      await expect.poll(async () => (await computed(note, "Yosemite")).size).toBe("24px");
      // The panel follows the text it changed, and then the insertion point elsewhere.
      await expect.poll(() => chosen("Family")).toEqual(["Courier"]);
      expect(await chosen("Size")).toEqual(["24"]);
      await selectWord(note, "nice");
      await expect.poll(() => chosen("Typeface")).toEqual(["Italic"]);
      expect(await chosen("Family")).toEqual(["System Font"]);
      expect(await chosen("Size")).toEqual(["14"]);

      // Every style is in the note's text, where the list does not see it.
      await expect
        .poll(() =>
          window.getByRole("listbox", { name: "Notes" }).getByRole("option").first().textContent(),
        )
        .toMatch(/^This is a note in Yosemite.*It’s kinda nice in here\.$/);
    },
    90_000,
  );

  it.runIf(available)(
    "shows a first line made body text as body text, and the title again once it is one",
    async () => {
      const window = tab.getByRole("region", { name: "Notes", exact: true });
      const menuBar = tab.getByRole("menubar", { name: "Notes menus" });
      await window
        .getByRole("listbox", { name: "Notes" })
        .getByRole("option", { name: /All computers should be orange/ })
        .click();
      const note = tab.getByRole("textbox", { name: "Note", exact: true });
      await expect.poll(() => note.textContent()).toContain("It’s true.");
      /**
       * The rendered height of the first line's text and of the second line's: the title's
       * larger type makes the first taller, also where only `::first-line` styles it.
       */
      const heights = () =>
        note.evaluate((element) => {
          const [first, second] = [...element.children];
          const height = (line: Element | undefined) => {
            const range = element.ownerDocument.createRange();
            if (line) range.selectNodeContents(line);
            return range.getBoundingClientRect().height;
          };
          return { first: height(first), second: height(second) };
        });
      const style = async (name: "Title" | "Heading" | "Body") => {
        await selectWord(note, "orange");
        await menuBar.getByRole("menuitem", { name: "Format", exact: true }).click();
        await tab.getByRole("menuitemradio", { name, exact: true }).click();
        await expect.poll(() => tab.getByRole("menu").count()).toBe(0);
      };

      const before = await heights();
      expect(before.first).toBeGreaterThan(before.second);
      await style("Body");
      await expect.poll(async () => (await heights()).first).toBe(before.second);
      expect((await computed(note, "orange")).weight).toBeLessThan(600);
      await menuBar.getByRole("menuitem", { name: "Format", exact: true }).click();
      const body = tab.getByRole("menuitemradio", { name: "Body", exact: true });
      await expect.poll(() => body.getAttribute("aria-checked")).toBe("true");
      await tab.keyboard.press("Escape");
      await expect.poll(() => tab.getByRole("menu").count()).toBe(0);

      await style("Title");
      await expect.poll(async () => (await heights()).first).toBeGreaterThan(before.second);
      expect((await computed(note, "orange")).weight).toBeGreaterThanOrEqual(600);

      // Heading on the first line: the heading's type, smaller than the title's.
      await style("Heading");
      await expect.poll(async () => (await heights()).first).toBeLessThan(before.first);
      expect((await heights()).first).toBeGreaterThan(before.second);
      await menuBar.getByRole("menuitem", { name: "Format", exact: true }).click();
      const heading = tab.getByRole("menuitemradio", { name: "Heading", exact: true });
      await expect.poll(() => heading.getAttribute("aria-checked")).toBe("true");
      await tab.keyboard.press("Escape");
      await expect.poll(() => tab.getByRole("menu").count()).toBe(0);
    },
    60_000,
  );

  it.runIf(available)(
    "types into the new note after File > New Note",
    async () => {
      const window = tab.getByRole("region", { name: "Notes", exact: true });
      const menuBar = tab.getByRole("menubar", { name: "Notes menus" });
      const note = tab.getByRole("textbox", { name: "Note", exact: true });
      const first = () =>
        window.getByRole("listbox", { name: "Notes" }).getByRole("option").first().textContent();
      // Chosen with the pointer, and from the keyboard.
      for (const [text, keyboard] of [
        ["Typed after New Note", false],
        ["Typed after the New Note key", true],
      ] as const) {
        await menuBar.getByRole("menuitem", { name: "File", exact: true }).click();
        const item = tab.getByRole("menuitem", { name: "New Note", exact: true });
        if (keyboard) {
          await item.focus();
          await tab.keyboard.press("Enter");
        } else await item.click();
        await expect.poll(() => tab.getByRole("menu").count()).toBe(0);
        // The menu's closing transition is over; the keyboard must still be in the new note.
        await tab.waitForTimeout(300);
        await tab.keyboard.type(text);
        await expect.poll(() => note.textContent()).toBe(text);
        await expect.poll(first).toMatch(new RegExp(`^${text}`));
      }
    },
    60_000,
  );

  it.runIf(available)(
    "undoes and redoes a table's row and column changes, the insertion point kept in the table",
    async () => {
      const apple = await tab.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform));
      const command = apple ? "Meta" : "Control";
      const window = tab.getByRole("region", { name: "Notes", exact: true });
      const menuBar = tab.getByRole("menubar", { name: "Notes menus" });
      const note = tab.getByRole("textbox", { name: "Note", exact: true });
      await menuBar.getByRole("menuitem", { name: "File", exact: true }).click();
      await tab.getByRole("menuitem", { name: "New Note", exact: true }).click();
      await expect.poll(() => tab.getByRole("menu").count()).toBe(0);
      await tab.waitForTimeout(300);
      await tab.keyboard.type("Table undo");
      await tab.keyboard.press("Enter");
      await window.getByRole("button", { name: "Add Table" }).click();
      // The table's cells per row, and whether a collapsed insertion point is in one of its cells.
      const shape = () =>
        note.evaluate((element) => {
          const table = element.querySelector("table.mac-notes-table");
          return table
            ? [...table.querySelectorAll("tr")].map((row) => row.querySelectorAll("td, th").length)
            : null;
        });
      const inTable = () =>
        note.evaluate((element) => {
          const selection = element.ownerDocument.getSelection();
          if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
          const at = selection.getRangeAt(0).startContainer;
          const holder = at instanceof Element ? at : at.parentElement;
          return Boolean(holder?.closest("table.mac-notes-table td, table.mac-notes-table th"));
        });
      await expect.poll(shape).toEqual([2, 2]);
      await tab.keyboard.type("A1");
      const add = (arrow: string) => tab.keyboard.press(`Alt+${command}+${arrow}`);
      const undo = () => tab.keyboard.press(`${command}+z`);
      const redo = () => tab.keyboard.press(`${command}+Shift+z`);

      // A row: undone, the table is as it was and the typing before it stays; redone, the row is back.
      await add("ArrowDown");
      await expect.poll(shape).toEqual([2, 2, 2]);
      await undo();
      await expect.poll(shape).toEqual([2, 2]);
      expect(await inTable()).toBe(true);
      expect(await note.textContent()).toContain("A1");
      await redo();
      await expect.poll(shape).toEqual([2, 2, 2]);
      expect(await inTable()).toBe(true);

      // A column, the same way.
      await add("ArrowRight");
      await expect.poll(shape).toEqual([3, 3, 3]);
      await undo();
      await expect.poll(shape).toEqual([2, 2, 2]);
      expect(await inTable()).toBe(true);
      await redo();
      await expect.poll(shape).toEqual([3, 3, 3]);
      expect(await inTable()).toBe(true);

      // Typing elsewhere in the note, undone, keeps the insertion point there, not in the table.
      await note.evaluate((element) => {
        const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && !node.nodeValue?.includes("Table undo")) node = walker.nextNode();
        if (!node) throw new Error("no title line");
        const range = element.ownerDocument.createRange();
        range.setStart(node, (node.nodeValue ?? "").length);
        range.collapse(true);
        (element as HTMLElement).focus();
        element.ownerDocument.getSelection()?.removeAllRanges();
        element.ownerDocument.getSelection()?.addRange(range);
      });
      await tab.keyboard.type(" more");
      await expect.poll(() => note.textContent()).toContain("Table undo more");
      await undo();
      await expect.poll(() => note.textContent()).not.toContain("Table undo more");
      expect(await inTable()).toBe(false);
      await expect.poll(shape).toEqual([3, 3, 3]);
      // Tab in the table's last cell adds a row: undone and redone as Format > Table's rows are.
      await note.evaluate((element) => {
        const cells = element.querySelectorAll("table.mac-notes-table td");
        const last = cells[cells.length - 1];
        if (!last) throw new Error("no cell");
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(last);
        range.collapse(false);
        (element as HTMLElement).focus();
        element.ownerDocument.getSelection()?.removeAllRanges();
        element.ownerDocument.getSelection()?.addRange(range);
      });
      await tab.keyboard.press("Tab");
      await expect.poll(shape).toEqual([3, 3, 3, 3]);
      expect(await inTable()).toBe(true);
      await undo();
      await expect.poll(shape).toEqual([3, 3, 3]);
      expect(await inTable()).toBe(true);
      await redo();
      await expect.poll(shape).toEqual([3, 3, 3, 3]);
      expect(await inTable()).toBe(true);
    },
    60_000,
  );
});
