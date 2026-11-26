// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";

/*
 * What only a browser can show: where a tab's close button is. The button is not inside its
 * tab (a tab is a button, and a tab list holds only tabs) but in a layer beside the list, in a
 * slot that script keeps over the tab. The pages below run React and the component, bundled by
 * Vite from modules that exist only here, and move tabs that React does not render again:
 * the same elements in another order, or a neighbour that a style makes wider. Each engine
 * that Playwright has installed is used (`npm run visual:install` installs Chromium), and one
 * that is not installed is skipped. Set REQUIRE_BROWSER_TESTS=1 where the engines must be
 * there: the run then fails and names each one that is missing (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the component's own two. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "window-tab-bar.tokens.css"), path.join(here, "window-tab-bar.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

/*
 * Three closable tabs of equal width. The tab elements are made once, so that React, given
 * them again in another order, moves their DOM nodes without rendering the tabs: nothing in a
 * tab runs, and no tab changes size. `reorder()` puts the last tab first; `closedTabs` lists the
 * tabs whose `onClose` ran.
 */
const REORDER = `
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { WindowTab, WindowTabBar } from "./index";

window.closedTabs = [];
const tabs = Object.fromEntries(
  ["one", "two", "three"].map((value) => [
    value,
    h(WindowTab, { key: value, value, onClose: () => window.closedTabs.push(value) }, value),
  ]),
);

function App() {
  const [order, setOrder] = useState(["one", "two", "three"]);
  window.reorder = () => setOrder(["three", "one", "two"]);
  return h(
    "div",
    { style: { width: 600 } },
    h(WindowTabBar, { defaultValue: "one", "aria-label": "Tabs" }, order.map((value) => tabs[value])),
  );
}

createRoot(document.getElementById("root")).render(h(App));
`;

/*
 * Three tabs of widths their caller sets, so that none of them gives way to another. The first
 * cannot be closed and has no close button; the other two can. Nothing here renders again.
 */
const WIDTHS = `
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { WindowTab, WindowTabBar } from "./index";

window.closedTabs = [];
const tab = (value, closable) =>
  h(
    WindowTab,
    {
      key: value,
      value,
      style: { flex: "0 0 120px" },
      onClose: closable ? () => window.closedTabs.push(value) : undefined,
    },
    value,
  );

createRoot(document.getElementById("root")).render(
  h(
    "div",
    { style: { width: 600 } },
    h(WindowTabBar, { defaultValue: "one", "aria-label": "Tabs" }, [
      tab("one", false),
      tab("two", true),
      tab("three", true),
    ]),
  ),
);
`;

const ENTRY = path.join(here, "page.entry.ts");

async function page(source: string) {
  const built = await build({
    configFile: false,
    logLevel: "silent",
    root: here,
    // Under Vitest the component's JSX would be compiled for a development React, which the
    // page does not have.
    mode: "production",
    oxc: { jsx: { runtime: "automatic", development: false } },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "page-entry",
        resolveId: (id) => (id === ENTRY ? id : null),
        load: (id) => (id === ENTRY ? source : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      lib: { entry: ENTRY, formats: ["iife"], name: "tabsPage" },
    },
  });
  const files = (Array.isArray(built) ? built : [built]).flatMap((result) =>
    "output" in result ? result.output : [],
  );
  const script = files.find((file) => file.type === "chunk");
  if (!script) throw new Error("Vite built no script for the page");
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body><div id="root"></div><script>${script.code.replaceAll("</script", "<\\/script")}</script></body></html>`;
}

/**
 * Each tab that has a close button, in the order shown, with its left edge and width and those
 * of the slot of its close button.
 */
const layout = (tab: Page) =>
  tab.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".mac-window-tab-bar-tab")].flatMap((element) => {
      const slot = document.getElementById(`${element.id}-close`)?.parentElement;
      if (!slot) return [];
      return {
        title: element.textContent,
        tab: Math.round(element.getBoundingClientRect().left),
        slot: Math.round(slot.getBoundingClientRect().left),
        width: Math.round(element.getBoundingClientRect().width),
        slotWidth: Math.round(slot.getBoundingClientRect().width),
      };
    }),
  );

/** Opens a page of tabs and waits for its close buttons. */
async function open(tab: Page, source: string, errors: string[]) {
  tab.on("pageerror", (error) => errors.push(error.message));
  await tab.setContent(await page(source));
  await tab.waitForSelector(".mac-window-tab-bar-close", { timeout: 10_000 }).catch(() => {
    throw new Error(`The page did not render: ${errors.join("; ") || "no error"}`);
  });
}

/** Clicks 9 pt into the tab titled `title`, where its close button is, and says what closed. */
async function clickCloseOf(tab: Page, title: string) {
  const box = await tab.locator(".mac-window-tab-bar-tab", { hasText: title }).boundingBox();
  if (!box) throw new Error(`The tab ${title} has no box`);
  // The pointer goes straight to the button, without crossing another tab.
  await tab.mouse.click(box.x + 9, box.y + box.height / 2);
  return tab.evaluate(() => (window as unknown as { closedTabs: string[] }).closedTabs);
}

requireEveryEngine("the WindowTabBar tests");

describe.each(Object.keys(ENGINES))("WindowTabBar in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "keeps each close button over its own tab when tabs change places without rendering",
    async () => {
      const context = await browser.newContext();
      try {
        const tab = await context.newPage();
        const errors: string[] = [];
        await open(tab, REORDER, errors);

        const before = await layout(tab);
        expect(before.map((item) => item.title)).toEqual(["one", "two", "three"]);
        // Equal widths, so that no tab's size changes when they change places.
        expect(new Set(before.map((item) => item.width)).size).toBe(1);
        for (const item of before) {
          expect(item.slot, item.title ?? "").toBe(item.tab);
          expect(item.slotWidth, item.title ?? "").toBe(item.width);
        }

        await tab.evaluate(() => (window as unknown as { reorder: () => void }).reorder());
        await tab.waitForFunction(
          () => document.querySelector(".mac-window-tab-bar-tab")?.textContent === "three",
        );
        const after = await layout(tab);
        expect(after.map((item) => item.title)).toEqual(["three", "one", "two"]);
        expect(after.map((item) => item.tab)).toEqual(before.map((item) => item.tab));
        for (const item of after) expect(item.slot, item.title ?? "").toBe(item.tab);

        // The button at the leading edge of the first tab closes the tab that is first now.
        expect(await clickCloseOf(tab, "three")).toEqual(["three"]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    120_000,
  );

  it.skipIf(!available)(
    "keeps each close button over its own tab when a style makes a neighbour wider",
    async () => {
      const context = await browser.newContext();
      try {
        const tab = await context.newPage();
        const errors: string[] = [];
        await open(tab, WIDTHS, errors);

        const before = await layout(tab);
        expect(before.map((item) => item.title)).toEqual(["two", "three"]);
        for (const item of before) {
          expect(item.width, item.title ?? "").toBe(120);
          expect(item.slot, item.title ?? "").toBe(item.tab);
          expect(item.slotWidth, item.title ?? "").toBe(item.width);
        }

        // The first tab, which has no close button, grows by 100 pt: a style alone, as a
        // class or a media query would change it. React renders nothing, the tab list keeps
        // its children, and the two tabs with close buttons move without changing size.
        await tab.evaluate(async () => {
          const first = document.querySelector(".mac-window-tab-bar-tab") as HTMLElement;
          first.style.flexBasis = "220px";
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
          await frame();
          await frame();
        });
        const after = await layout(tab);
        expect(after.map((item) => item.tab)).toEqual(before.map((item) => item.tab + 100));
        for (const item of after) {
          expect(item.width, item.title ?? "").toBe(120);
          expect(item.slot, item.title ?? "").toBe(item.tab);
        }

        // The button at the leading edge of the second tab closes that tab.
        expect(await clickCloseOf(tab, "two")).toEqual(["two"]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    120_000,
  );

  it.skipIf(!available)(
    "never closes another tab from a close button that a style left behind",
    async () => {
      const context = await browser.newContext();
      try {
        const tab = await context.newPage();
        const errors: string[] = [];
        await open(tab, WIDTHS, errors);
        const before = await layout(tab);

        // The gap between the tabs grows from 1 pt to 122 pt: no tab and no list changes
        // size, the list keeps its children and React renders nothing, so nothing reports
        // that the tabs moved. The second tab is now where the third was, and the third
        // tab's close button was there.
        await tab.evaluate(async () => {
          const list = document.querySelector(".mac-window-tab-bar-list") as HTMLElement;
          list.style.gap = "122px";
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
          await frame();
          await frame();
        });
        const moved = await layout(tab);
        expect(moved.map((item) => item.width)).toEqual([120, 120]);
        expect(moved[0]?.tab).toBe(before[1]?.tab);

        // The pointer goes to the second tab's close button, and so over the one left behind.
        expect(await clickCloseOf(tab, "two")).toEqual(["two"]);
        // By then every close button is over its own tab again.
        for (const item of await layout(tab)) {
          expect(item.slot, item.title ?? "").toBe(item.tab);
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    120_000,
  );

  it.skipIf(!available)(
    "keeps the close button under a resting pointer over the tab that is there",
    async () => {
      const context = await browser.newContext();
      try {
        const tab = await context.newPage();
        const errors: string[] = [];
        await open(tab, WIDTHS, errors);

        // The pointer rests on the third tab's close button, which shows there.
        const third = await tab
          .locator(".mac-window-tab-bar-tab", { hasText: "three" })
          .boundingBox();
        if (!third) throw new Error("The third tab has no box");
        await tab.mouse.move(third.x + 9, third.y + third.height / 2);
        const before = await layout(tab);

        // The gap grows as in the test above, and in the same task, before the browser has
        // drawn a frame, a click arrives on the third tab's close button where it still is:
        // over the second tab now. It closes nothing.
        const closed = await tab.evaluate(() => {
          const list = document.querySelector(".mac-window-tab-bar-list") as HTMLElement;
          const third = document.querySelectorAll(".mac-window-tab-bar-tab")[2] as HTMLElement;
          const stale = document.getElementById(`${third.id}-close`) as HTMLElement;
          const box = stale.getBoundingClientRect();
          list.style.gap = "122px";
          stale.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              detail: 1,
              clientX: box.left + box.width / 2,
              clientY: box.top + box.height / 2,
            }),
          );
          return [...(window as unknown as { closedTabs: string[] }).closedTabs];
        });
        expect(closed).toEqual([]);

        // The pointer has not moved. A frame later every close button is over its own tab,
        // so the one under the pointer is the second tab's.
        await tab.evaluate(async () => {
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
          await frame();
          await frame();
        });
        const after = await layout(tab);
        expect(after[0]?.tab).toBe(before[1]?.tab);
        for (const item of after) expect(item.slot, item.title ?? "").toBe(item.tab);

        // A press where the pointer rests closes the second tab, and only that one.
        await tab.mouse.down();
        await tab.mouse.up();
        expect(
          await tab.evaluate(() => (window as unknown as { closedTabs: string[] }).closedTabs),
        ).toEqual(["two"]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    120_000,
  );
});
