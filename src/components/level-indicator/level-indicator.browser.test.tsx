// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { LevelIndicator } from "./index";

/*
 * What only a browser can show: the colour of the fill in forced colours, and which segment or
 * star a click fills, which depends on layout. The component is
 * rendered by React and styled by the stylesheets it ships with; each engine that Playwright
 * has installed is used (`npm run visual:install` installs Chromium), and one that is not
 * installed is skipped. The forced-colours test does not run in WebKit, where Playwright
 * cannot emulate forced colours; the pointer test runs in all three. Set
 * REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and names each
 * one that is missing (test/browser-engines.ts).
 */
/** The engines that Playwright can put into forced colours. */
const FORCED_COLORS = ["chromium", "firefox"];

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the component's own two. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "level-indicator.tokens.css"), path.join(here, "level-indicator.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

/** Every way a fill gets a colour of its own: plain, each level, tiers, and the two styles. */
const FILLS = [
  "plain",
  "warning",
  "tiered-rising",
  "tiered-falling",
  "storage",
  "relevancy",
  "segments",
];

function page() {
  const limits = { warningValue: 40, criticalValue: 80 };
  const body = renderToStaticMarkup(
    <div style={{ width: 200 }}>
      <div id="plain">
        <LevelIndicator value={90} aria-label="Plain" />
      </div>
      <div id="warning">
        <LevelIndicator value={90} warningValue={40} aria-label="Warning" />
      </div>
      <div id="tiered-rising">
        <LevelIndicator tiered value={90} {...limits} aria-label="Tiered" />
      </div>
      <div id="tiered-falling">
        <LevelIndicator
          tiered
          value={90}
          warningValue={80}
          criticalValue={40}
          aria-label="Tiered, low values are the problem"
        />
      </div>
      <div id="storage">
        <LevelIndicator variant="storage" value={90} aria-label="Storage" />
      </div>
      <div id="relevancy">
        <LevelIndicator variant="relevancy" value={90} aria-label="Relevancy" />
      </div>
      <div id="segments">
        <LevelIndicator
          variant="discrete"
          tiered
          max={5}
          value={5}
          warningValue={3}
          criticalValue={5}
          aria-label="Segments"
        />
      </div>
      <div
        id="highlight"
        style={{ height: 1, background: "Highlight", forcedColorAdjust: "none" }}
      />
    </div>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

/*
 * A page that runs: React, the component and three editable indicators, bundled by Vite from
 * a module that exists only here. The first is an item of a grid, which would stretch it. The
 * third has more steps than segments (400 in 100), so each of its segments stands for four; it
 * is 600 pt wide, room for a hundred segments of at least 3 pt, 2 pt apart.
 */
const POINTER_ENTRY = path.join(here, "pointer.entry.ts");
const POINTER_SOURCE = `
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { LevelIndicator } from "./index";

const editable = (props) => h(LevelIndicator, { editable: true, ...props });
createRoot(document.getElementById("root")).render(
  h("div", { style: { display: "grid", gap: 12, width: 600, padding: 10 } }, [
    editable({ key: 1, variant: "rating", defaultValue: 2, max: 5, "aria-label": "Rating" }),
    editable({
      key: 2,
      variant: "discrete",
      defaultValue: 3,
      max: 10,
      "aria-label": "Capacity",
      style: { width: 180 },
    }),
    editable({ key: 3, variant: "discrete", max: 400, "aria-label": "Capped" }),
  ]),
);
`;

async function pointerPage() {
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
        name: "pointer-entry",
        resolveId: (id) => (id === POINTER_ENTRY ? id : null),
        load: (id) => (id === POINTER_ENTRY ? POINTER_SOURCE : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      lib: { entry: POINTER_ENTRY, formats: ["iife"], name: "pointerPage" },
    },
  });
  const files = (Array.isArray(built) ? built : [built]).flatMap((result) =>
    "output" in result ? result.output : [],
  );
  const script = files.find((file) => file.type === "chunk");
  if (!script) throw new Error("Vite built no script for the pointer page");
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body><div id="root"></div><script>${script.code.replaceAll("</script", "<\\/script")}</script></body></html>`;
}

/** The value of the indicator named `label`, and how many of its segments or stars are filled. */
const reading = (tab: Page, label: string) =>
  tab.evaluate((label) => {
    const input = document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    const root = input.closest(".mac-level-indicator") as HTMLElement;
    return [Number(input.value), root.querySelectorAll("[data-filled]").length];
  }, label);

/** Clicks the first or the last pixel column of a segment or a star: a pointer has whole pixels. */
async function clickEdge(tab: Page, label: string, part: number, edge: "leading" | "trailing") {
  const root = tab.locator(`.mac-level-indicator:has(input[aria-label="${label}"])`);
  const item = root.locator(".mac-level-indicator-segment, .mac-level-indicator-star");
  const box = await item.nth(part - 1).boundingBox();
  if (!box) throw new Error(`${label}: part ${part} has no box`);
  const x = edge === "leading" ? Math.ceil(box.x) : Math.ceil(box.x + box.width) - 1;
  await tab.mouse.click(x, box.y + box.height / 2);
  return reading(tab, label);
}

requireEveryEngine("the LevelIndicator tests");

describe.each(Object.keys(ENGINES))("LevelIndicator in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** The background of every filled part of each indicator, and of the reference. */
  async function fills(forcedColors: "active" | "none") {
    const context = await browser.newContext({ forcedColors });
    try {
      const tab = await context.newPage();
      await tab.setContent(page());
      return await tab.evaluate((ids) => {
        const background = (element: Element) => {
          const style = getComputedStyle(element);
          return `${style.backgroundColor} ${style.backgroundImage}`;
        };
        const parts = ".mac-level-indicator-fill, .mac-level-indicator-segment[data-filled]";
        return {
          highlight: background(document.getElementById("highlight") as HTMLElement),
          fills: Object.fromEntries(
            ids.map((id) => [
              id,
              Array.from(document.querySelectorAll(`#${id} :is(${parts})`), background),
            ]),
          ) as Record<string, string[]>,
        };
      }, FILLS);
    } finally {
      await context.close();
    }
  }

  it.skipIf(!available || !FORCED_COLORS.includes(name))(
    "fills with the system highlight colour in forced colours, in every style and with tiers",
    async () => {
      const { highlight, fills: forced } = await fills("active");
      const { fills: plain } = await fills("none");

      for (const id of FILLS) {
        const parts = forced[id] as string[];
        expect(parts.length, id).toBeGreaterThan(0);
        // One flat system colour: no gradient of level colours, no colour of a style.
        for (const part of parts) expect(part, id).toBe(highlight);
      }
      expect(forced.segments).toHaveLength(5);

      // Outside forced colours the tiers are a gradient, so the check above can tell.
      expect(plain["tiered-rising"]?.[0]).toContain("linear-gradient");
      expect(plain["tiered-rising"]?.[0]).not.toBe(highlight);
    },
    60_000,
  );

  it.skipIf(!available)(
    "fills the segment or star under the pointer, wherever in it the click lands",
    async () => {
      const context = await browser.newContext();
      try {
        const tab = await context.newPage();
        const errors: string[] = [];
        tab.on("pageerror", (error) => errors.push(error.message));
        await tab.setContent(await pointerPage());
        await tab.waitForSelector(".mac-level-indicator-star", { timeout: 10_000 }).catch(() => {
          throw new Error(`The pointer page did not render: ${errors.join("; ") || "no error"}`);
        });
        expect(await reading(tab, "Rating")).toEqual([2, 2]);

        // A slider rounds to the nearest step, which alone would give 3 for the leading edge
        // of the fourth star and 6 for that of the seventh segment.
        expect(await clickEdge(tab, "Rating", 4, "leading")).toEqual([4, 4]);
        expect(await clickEdge(tab, "Rating", 1, "trailing")).toEqual([1, 1]);
        expect(await clickEdge(tab, "Rating", 5, "trailing")).toEqual([5, 5]);
        expect(await clickEdge(tab, "Rating", 1, "leading")).toEqual([1, 1]);

        expect(await clickEdge(tab, "Capacity", 7, "leading")).toEqual([7, 7]);
        expect(await clickEdge(tab, "Capacity", 7, "trailing")).toEqual([7, 7]);
        expect(await clickEdge(tab, "Capacity", 10, "trailing")).toEqual([10, 10]);
        expect(await clickEdge(tab, "Capacity", 1, "leading")).toEqual([1, 1]);

        // More steps than segments: a segment stands for four, and a click fills it whole.
        expect(await clickEdge(tab, "Capped", 50, "leading")).toEqual([200, 50]);
        expect(await clickEdge(tab, "Capped", 50, "trailing")).toEqual([200, 50]);
        expect(await clickEdge(tab, "Capped", 100, "trailing")).toEqual([400, 100]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    120_000,
  );
});
