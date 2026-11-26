// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType, Locator, Page } from "playwright";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that a real press and a real double-click on a library control
 * inside a title bar or a `windowDragRegion()` strip neither moves nor zooms the window, while
 * the bare surface beside it does both; that a window's handler can still cancel a press on its
 * title bar; and that an element of an iframe, which is not an instance of the page's Element,
 * is judged like any other. The page is bundled by Vite from a module that exists only here and
 * styled by the library's stylesheets, so every control has its real box. Each engine that
 * Playwright has installed is used; REQUIRE_BROWSER_TESTS=1 makes a missing one fail the run
 * (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../styles");

/** The token sheets in the order index.css imports them. */
function tokens() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  return [...index.matchAll(/@import "(.+?)";/g)]
    .map(([, file]) => readFileSync(path.join(styles, file as string), "utf8"))
    .join("\n");
}

const ENTRY = path.join(here, "window-drag-region.entry.ts");
const SOURCE = `
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { Checkbox } from "../components/checkbox";
import { ComboBox, ComboBoxItem } from "../components/combo-box";
import { Switch } from "../components/switch";
import { TitleBar } from "../components/title-bar";
import { isWindowDragRegion, windowDragRegion } from "./window-drag-region";

const counts = { down: 0, zoom: 0 };
window.counts = counts;
window.isWindowDragRegion = isWindowDragRegion;
const down = () => { counts.down += 1; };
const zoom = () => { counts.zoom += 1; };

const controls = (id) => [
  h(Checkbox, { key: "c", "data-test": id + "-checkbox" }, "Show all"),
  h(Switch, { key: "s", "aria-label": "Wi-Fi", "data-test": id + "-switch" }),
  h("a", { key: "a", href: "#help", "data-test": id + "-link" }, "Help"),
  h("label", { key: "l", htmlFor: id + "-field", "data-test": id + "-label" }, "Name"),
  h("input", { key: "i", id: id + "-field", size: 4 }),
  h("div", { key: "b", role: "listbox", "aria-label": "Sizes", style: { display: "inline-block" } },
    h("div", { role: "option", "aria-selected": false, "data-test": id + "-option" }, "Large")),
  h("span", { key: "m", role: "combobox", "aria-expanded": false, tabIndex: 0,
    "data-test": id + "-aria-combobox" }, "Font"),
  h(ComboBox, { key: "x", "aria-label": "Size", "data-test": id + "-combobox", style: { width: 70 } },
    h(ComboBoxItem, null, "42")),
];

const row = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
createRoot(document.getElementById("root")).render(
  h("div", { style: { width: 900, display: "grid", gap: 24, padding: 10 } }, [
    h(TitleBar, { key: 1, variant: "unified", title: "Bar", "data-test": "bar",
      onDragRegionPointerDown: down, onDragRegionDoubleClick: zoom },
      h("div", { style: row }, controls("bar"))),
    h("div", { key: 2, "data-test": "strip", style: { ...row, padding: "24px 8px" },
      ...windowDragRegion(down, zoom) }, controls("strip")),
    // A window that vetoes every press on its title bar, in the capture phase.
    h("div", { key: 3, onPointerDownCapture: (e) => e.preventDefault(),
      onDoubleClickCapture: (e) => e.preventDefault() },
      h(TitleBar, { title: "Vetoed", "data-test": "vetoed",
        onDragRegionPointerDown: down, onDragRegionDoubleClick: zoom })),
    // A title bar whose own handler vetoes a press.
    h(TitleBar, { key: 4, title: "Own veto", "data-test": "own-veto",
      onPointerDown: (e) => e.preventDefault(), onDoubleClick: (e) => e.preventDefault(),
      onDragRegionPointerDown: down, onDragRegionDoubleClick: zoom }),
  ]),
);
`;

async function page() {
  const built = await build({
    configFile: false,
    logLevel: "silent",
    root: here,
    // Under Vitest the components' JSX would be compiled for a development React, which the
    // page does not have.
    mode: "production",
    oxc: { jsx: { runtime: "automatic", development: false } },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "drag-region-entry",
        resolveId: (id) => (id === ENTRY ? id : null),
        load: (id) => (id === ENTRY ? SOURCE : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      cssCodeSplit: false,
      lib: { entry: ENTRY, formats: ["iife"], name: "dragRegionPage" },
    },
  });
  const files = (Array.isArray(built) ? built : [built]).flatMap((result) =>
    "output" in result ? result.output : [],
  );
  const script = files.find((file) => file.type === "chunk");
  if (script?.type !== "chunk") throw new Error("Vite built no script for the page");
  const css = files
    .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
    .map((file) => (file.type === "asset" ? String(file.source) : ""))
    .join("\n");
  return `<!doctype html><html data-appearance="light"><head><style>${tokens()}\n${css}</style></head><body><div id="root"></div><script>${script.code.replaceAll("</script", "<\\/script")}</script></body></html>`;
}

const counts = (tab: Page) =>
  tab.evaluate(() => ({
    ...(window as unknown as { counts: { down: number; zoom: number } }).counts,
  }));

/** The centre of a locator's box, after checking that a press there lands on it. */
async function centre(target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error("The control has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const lands = await target.evaluate(
    (element, [x, y]) => {
      const hit = document.elementFromPoint(x as number, y as number);
      return hit !== null && (element === hit || element.contains(hit));
    },
    [x, y],
  );
  expect(lands, "a press at the centre lands on the control").toBe(true);
  return { x, y };
}

const KINDS = ["checkbox", "switch", "link", "label", "option", "aria-combobox", "combobox"];

requireEveryEngine("the window drag region tests");

describe.each(Object.keys(ENGINES))("window drag region in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let html: string;

  beforeAll(async () => {
    html = await page();
    if (available) browser = await engine.launch();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
  });

  async function open() {
    const context = await browser.newContext({ viewport: { width: 1000, height: 600 } });
    const tab = await context.newPage();
    const errors: string[] = [];
    tab.on("pageerror", (error) => errors.push(error.message));
    await tab.setContent(html);
    await tab.waitForSelector("[data-test='bar']", { timeout: 10_000 }).catch(() => {
      throw new Error(`The page did not render: ${errors.join("; ") || "no error"}`);
    });
    return { context, tab, errors };
  }

  it.skipIf(!available)(
    "a press or a double-click on a control neither moves nor zooms the window; the bare surface does both",
    async () => {
      const { context, tab, errors } = await open();
      try {
        for (const surface of ["bar", "strip"]) {
          for (const kind of KINDS) {
            const at = await centre(tab.locator(`[data-test='${surface}-${kind}']`));
            await tab.mouse.click(at.x, at.y);
            await tab.mouse.dblclick(at.x, at.y);
            await tab.keyboard.press("Escape");
            expect(await counts(tab), `${surface}: ${kind}`).toEqual({ down: 0, zoom: 0 });
          }
          // The surface itself, at its top-right corner, clear of the title and the controls.
          const box = await tab.locator(`[data-test='${surface}']`).boundingBox();
          if (!box) throw new Error(`${surface} has no box`);
          const before = await counts(tab);
          await tab.mouse.click(box.x + box.width - 6, box.y + 6);
          await tab.mouse.dblclick(box.x + box.width - 6, box.y + 6);
          const after = await counts(tab);
          // A click is one press; a double-click is two presses and one double-click.
          expect(after.down - before.down, `${surface}: presses`).toBe(3);
          expect(after.zoom - before.zoom, `${surface}: double-clicks`).toBe(1);
          await tab.evaluate(() => {
            const c = (window as unknown as { counts: { down: number; zoom: number } }).counts;
            c.down = 0;
            c.zoom = 0;
          });
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    120_000,
  );

  it.skipIf(!available)(
    "a window's handler, or the bar's own, can still cancel a press on the title bar",
    async () => {
      const { context, tab, errors } = await open();
      try {
        for (const bar of ["vetoed", "own-veto"]) {
          const box = await tab.locator(`[data-test='${bar}']`).boundingBox();
          if (!box) throw new Error(`${bar} has no box`);
          await tab.mouse.click(box.x + box.width - 6, box.y + box.height / 2);
          await tab.mouse.dblclick(box.x + box.width - 6, box.y + box.height / 2);
        }
        expect(await counts(tab)).toEqual({ down: 0, zoom: 0 });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    60_000,
  );

  it.skipIf(!available)(
    "judges an element of an iframe, which is no instance of the page's Element",
    async () => {
      const { context, tab } = await open();
      try {
        const result = await tab.evaluate(() => {
          const test = (window as unknown as { isWindowDragRegion: (t: unknown) => boolean })
            .isWindowDragRegion;
          const frame = document.createElement("iframe");
          document.body.append(frame);
          const other = frame.contentDocument as Document;
          other.body.innerHTML =
            '<div id="bar"><span id="title">Title</span><span role="switch"><i id="thumb"></i></span><label id="label">Name</label></div>';
          const title = other.getElementById("title");
          return {
            instance: title instanceof Element,
            title: test(title),
            thumb: test(other.getElementById("thumb")),
            label: test(other.getElementById("label")),
            nothing: test(null),
            window: test(window),
          };
        });
        expect(result).toEqual({
          instance: false,
          title: true,
          thumb: false,
          label: false,
          nothing: false,
          window: false,
        });
      } finally {
        await context.close();
      }
    },
    60_000,
  );
});
