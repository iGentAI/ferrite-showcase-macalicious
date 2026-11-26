// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import sharp from "sharp";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";

/*
 * What only a browser can show: where the colour wheel's marker is drawn, which depends on
 * layout, in left-to-right and in right-to-left text. The hues of the disc, the pointer's
 * coordinates and the marker are all physical: a page that reads from right to left does not
 * turn the disc round, so the marker has to stay where the pointer chose the colour and over
 * the colour it reports. The panel is rendered by React from a module bundled here, with the
 * token sheets and the stylesheets its components import; each engine that Playwright has
 * installed is used, and REQUIRE_BROWSER_TESTS=1 makes a missing one fail
 * (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets, in the order index.css imports them. */
function tokens() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  return [...index.matchAll(/@import "(.+?)";/g)]
    .map(([, file]) => readFileSync(path.join(styles, file as string), "utf8"))
    .join("\n");
}

const ENTRY = path.join(here, "rtl.entry.ts");
const SOURCE = `
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { ColorPanel } from "./index";

const panel = (dir) =>
  h("div", { dir, id: dir, style: { padding: 20 } }, h(ColorPanel, { defaultValue: "#ffffff" }));
createRoot(document.getElementById("root")).render(h("div", null, [panel("ltr"), panel("rtl")]));
`;

async function panelPage() {
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
        name: "rtl-entry",
        resolveId: (id) => (id === ENTRY ? id : null),
        load: (id) => (id === ENTRY ? SOURCE : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      cssCodeSplit: false,
      lib: { entry: ENTRY, formats: ["iife"], name: "rtlPage" },
    },
  });
  const files = (Array.isArray(built) ? built : [built]).flatMap((result) =>
    "output" in result ? result.output : [],
  );
  const script = files.find((file) => file.type === "chunk");
  if (script?.type !== "chunk") throw new Error("Vite built no script for the page");
  // The stylesheets the components import, in the order they import them.
  const css = files
    .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
    .map((file) => (file.type === "asset" ? String(file.source) : ""))
    .join("\n");
  if (!css.includes(".mac-color-wheel-area")) throw new Error("Vite built no stylesheet");
  return `<!doctype html><html data-appearance="light"><head><style>${tokens()}\n${css}</style></head><body style="margin: 0"><div id="root"></div><script>${script.code.replaceAll("</script", "<\\/script")}</script></body></html>`;
}

/** The box of the wheel's area in the panel of `dir`, and the centre of its marker. */
const wheel = (tab: Page, dir: string) =>
  tab.evaluate((dir) => {
    const area = document.querySelector(`#${dir} .mac-color-wheel-area`) as HTMLElement;
    const box = area.getBoundingClientRect();
    const marker = getComputedStyle(area, "::after");
    return {
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      // The marker's position is relative to the area's padding box, inside its border.
      marker: {
        x:
          box.x +
          area.clientLeft +
          Number.parseFloat(marker.left) +
          Number.parseFloat(marker.width) / 2,
        y:
          box.y +
          area.clientTop +
          Number.parseFloat(marker.top) +
          Number.parseFloat(marker.height) / 2,
      },
      hue: Number(area.getAttribute("aria-valuenow")),
      text: area.getAttribute("aria-valuetext"),
    };
  }, dir);

/** The colour of one pixel of the page, as [r, g, b]. */
async function pixel(tab: Page, x: number, y: number) {
  const png = await tab.screenshot({
    clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 },
  });
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return [data[0] as number, data[1] as number, data[2] as number];
}

requireEveryEngine("the ColorPanel tests");

describe.each(Object.keys(ENGINES))("ColorPanel in %s", (name) => {
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
    "draws the wheel's marker where the pointer chose the colour, over that colour, in either direction of text",
    async () => {
      const context = await browser.newContext({ viewport: { width: 700, height: 900 } });
      try {
        const tab = await context.newPage();
        const errors: string[] = [];
        tab.on("pageerror", (error) => errors.push(error.message));
        await tab.setContent(await panelPage());
        await tab.waitForSelector("#rtl .mac-color-wheel-area", { timeout: 10_000 }).catch(() => {
          throw new Error(`The page did not render: ${errors.join("; ") || "no error"}`);
        });
        for (const dir of ["ltr", "rtl"]) {
          const { box } = await wheel(tab, dir);
          // A quarter of the way across, half way down: nine o'clock, half way out, which is
          // cyan at half saturation.
          const x = box.x + box.width / 4;
          const y = box.y + box.height / 2;
          await tab.mouse.click(x, y);
          const picked = await wheel(tab, dir);
          expect(picked.hue, dir).toBe(180);
          expect(picked.text, dir).toMatch(/saturation (49|50|51)%/);
          expect(Math.abs(picked.marker.x - x), dir).toBeLessThanOrEqual(1);
          expect(Math.abs(picked.marker.y - y), dir).toBeLessThanOrEqual(1);
          // Inside the marker's ring the disc shows the colour it reports: #80ffff.
          const [r = 0, g = 0, b = 0] = await pixel(tab, picked.marker.x, picked.marker.y);
          expect(Math.abs(r - 128), `${dir}: red of ${r} ${g} ${b}`).toBeLessThanOrEqual(24);
          expect(g, dir).toBeGreaterThanOrEqual(230);
          expect(b, dir).toBeGreaterThanOrEqual(230);

          // The arrow keys move the marker the way they point, whatever the text direction.
          await tab.keyboard.press("ArrowRight");
          const moved = await wheel(tab, dir);
          expect(moved.marker.x - picked.marker.x, dir).toBeGreaterThan(2);
          expect(Math.abs(moved.marker.y - picked.marker.y), dir).toBeLessThanOrEqual(1);
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    120_000,
  );
});
