// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { WebView, WebViewProgress } from "./index";

/*
 * What only a browser can show: a document in the view's frame. The baseline tests of the
 * examples cannot hold a frame (axe-core cannot reach one in jsdom), so the framed form is
 * tested here: the frame fills the view, the loading line is drawn over it, and the document
 * runs in an origin of its own. The component is rendered by React and styled by the
 * stylesheets it ships with; each engine Playwright has installed is used (`npm run
 * visual:install` installs Chromium), and an engine that is not installed is skipped. Set
 * REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and names each
 * one that is missing (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the component's own two. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "web-view.tokens.css"), path.join(here, "web-view.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

/*
 * Served from one made-up origin, the page and the framed document alike: a same-origin frame
 * shares its parent's origin unless the sandbox takes it away, so the origin the framed script
 * reports shows that the sandbox is there. (A data: document would have an origin of its own
 * with or without it.)
 */
const ORIGIN = "http://web-view.test";
const framedDocument = `${ORIGIN}/framed.html`;

function page() {
  const body = renderToStaticMarkup(
    <WebView id="view" src={framedDocument} title="Framed" style={{ width: 300, height: 200 }}>
      <WebViewProgress value={50} aria-label="Loading" />
    </WebView>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>body{margin:0}${stylesheet()}</style></head><body>${body}</body></html>`;
}

interface Reading {
  view: { width: number; height: number };
  frame: { x: number; y: number; width: number; height: number };
  line: { x: number; y: number; width: number; height: number };
  /** The colour of a pixel on the loading line, and of one past its end, as `r g b`. */
  onLine: string;
  pastLine: string;
  /** `self.origin` as the framed document's own script sees it. */
  origin: string;
}

requireEveryEngine("the WebView tests");

describe.each(Object.keys(ENGINES))("WebView in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let reading: Reading;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext();
    const tab = await context.newPage();
    await context.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: route.request().url() === framedDocument ? "<p>Framed</p>" : page(),
      }),
    );
    await tab.goto(`${ORIGIN}/`, { waitUntil: "load" });
    const outer = await tab.evaluate(() => {
      const rect = (selector: string) => {
        const { x, y, width, height } = (
          document.querySelector(selector) as Element
        ).getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        view: rect("#view"),
        frame: rect("#view iframe"),
        line: rect("#view .mac-web-view-progress-indicator"),
      };
    });
    // What is painted on top where the line and the frame share the view's first rows.
    const row = await sharp(await tab.screenshot({ clip: { x: 0, y: 0, width: 300, height: 1 } }))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number) =>
      [0, 1, 2].map((channel) => row.data[x * row.info.channels + channel]).join(" ");
    const framed = tab.frames().find((frame) => frame !== tab.mainFrame());
    const origin = framed ? await framed.evaluate(() => self.origin) : "no frame";
    reading = { ...outer, onLine: pixel(75), pastLine: pixel(225), origin };
    await context.close();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)("fills the view with the frame", () => {
    expect(reading.view).toMatchObject({ width: 300, height: 200 });
    expect(reading.frame).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it.skipIf(!available)(
    "draws the loading line over the frame, as far as the page has loaded",
    () => {
      expect(reading.line).toEqual({ x: 0, y: 0, width: 150, height: 2 });
      // The accent colour (blue) on the line; the framed document's white page past its end.
      expect(reading.onLine).toBe("2 122 255");
      expect(reading.pastLine).toBe("255 255 255");
    },
  );

  it.skipIf(!available)("runs the framed document in an origin of its own", () => {
    // Without the sandbox the same-origin frame would report the page's origin.
    expect(reading.origin).toBe("null");
  });
});
