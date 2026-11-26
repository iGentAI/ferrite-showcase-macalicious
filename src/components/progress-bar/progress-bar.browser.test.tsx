// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { ProgressBar } from "./index";

/*
 * What only a browser can show: where the indeterminate band is while it sweeps, what the bar
 * looks like with prefers-reduced-motion and in forced colours, and the radii the stylesheet
 * resolves to. The component is rendered by React and styled by
 * the stylesheets it ships with; each engine Playwright has installed is used (`npm run
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
  files.push(path.join(here, "progress-bar.tokens.css"), path.join(here, "progress-bar.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const TRACK = 200;

function page() {
  const body = renderToStaticMarkup(
    <div style={{ width: TRACK }}>
      <div id="ltr" dir="ltr">
        <ProgressBar aria-label="Left to right" />
      </div>
      <div id="rtl" dir="rtl">
        <ProgressBar aria-label="Right to left" />
      </div>
      <div id="inactive" data-window-state="inactive">
        <ProgressBar aria-label="Window that is not key" />
      </div>
      <div id="half">
        <ProgressBar value={50} aria-label="Half done" />
      </div>
      <div id="small">
        <ProgressBar value={50} size="small" aria-label="Half done, small" />
      </div>
      <div id="fill" style={{ height: 1, background: "var(--mac-progress-bar-fill)" }} />
      <div
        id="fill-inactive"
        style={{ height: 1, background: "var(--mac-progress-bar-fill-inactive)" }}
      />
      <div
        id="highlight"
        style={{ height: 1, background: "Highlight", forcedColorAdjust: "none" }}
      />
    </div>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

interface Reading {
  /** Left and right edge of the band, in points from the left edge of its track. */
  band: [number, number];
  animation: string;
  background: string;
  opacity: number;
}

type Motion = "reduce" | "no-preference";
type Colors = "active" | "none";

requireEveryEngine("the ProgressBar tests");

describe.each(Object.keys(ENGINES))("ProgressBar in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Reads the band of the bar inside `#id`, with its animation held at `time` milliseconds. */
  async function read(
    reducedMotion: Motion,
    id: string,
    time: number,
    forcedColors: Colors = "none",
  ) {
    const context = await browser.newContext({ reducedMotion, forcedColors });
    try {
      const tab = await context.newPage();
      await tab.setContent(page());
      return await tab.evaluate(
        ({ id, time }): Reading => {
          const band = document.querySelector(`#${id} .mac-progress-bar-indicator`) as HTMLElement;
          const track = (band.parentElement as HTMLElement).getBoundingClientRect();
          for (const animation of band.getAnimations()) {
            animation.pause();
            animation.currentTime = time;
          }
          const box = band.getBoundingClientRect();
          const style = getComputedStyle(band);
          return {
            band: [box.left - track.left, box.right - track.left],
            animation: style.animationName,
            background: `${style.backgroundColor} ${style.backgroundImage}`,
            opacity: Number(style.opacity),
          };
        },
        { id, time },
      );
    } finally {
      await context.close();
    }
  }

  async function colorOf(reducedMotion: Motion, id: string, forcedColors: Colors = "none") {
    const context = await browser.newContext({ reducedMotion, forcedColors });
    try {
      const tab = await context.newPage();
      await tab.setContent(page());
      return await tab.evaluate(
        (id) => getComputedStyle(document.getElementById(id) as HTMLElement).backgroundColor,
        id,
      );
    } finally {
      await context.close();
    }
  }

  /** The corner radii the stylesheet resolves to, as computed values. */
  async function radii() {
    const context = await browser.newContext();
    try {
      const tab = await context.newPage();
      await tab.setContent(page());
      return await tab.evaluate(() => {
        const corners = (id: string, part: string) => {
          const style = getComputedStyle(
            document.querySelector(`#${id} .mac-progress-bar-${part}`) as HTMLElement,
          );
          return [
            style.borderTopLeftRadius,
            style.borderBottomLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
          ];
        };
        return {
          track: corners("half", "track"),
          fill: corners("half", "indicator"),
          smallTrack: corners("small", "track"),
          smallFill: corners("small", "indicator"),
        };
      });
    } finally {
      await context.close();
    }
  }

  // One sweep takes 1.5 s.
  const START = 0;
  const MIDDLE = 750;
  const END = 1499;
  // One fade of the still band takes 1.2 s.
  const FADE_END = 1199;

  it.skipIf(!available)(
    "sweeps the band from off the left end to off the right end",
    async () => {
      const start = await read("no-preference", "ltr", START);
      const middle = await read("no-preference", "ltr", MIDDLE);
      const end = await read("no-preference", "ltr", END);

      expect(start.animation).toBe("mac-progress-bar-sweep");
      expect(start.band[1]).toBeLessThanOrEqual(0.5);
      expect(middle.band[0]).toBeGreaterThan(0);
      expect(middle.band[1]).toBeLessThan(TRACK);
      expect(end.band[0]).toBeGreaterThanOrEqual(TRACK - 0.5);
    },
    60_000,
  );

  it.skipIf(!available)(
    "sweeps the other way in right-to-left text, over the whole track",
    async () => {
      const start = await read("no-preference", "rtl", START);
      const middle = await read("no-preference", "rtl", MIDDLE);
      const end = await read("no-preference", "rtl", END);

      expect(start.band[0]).toBeGreaterThanOrEqual(TRACK - 0.5);
      expect(middle.band[0]).toBeGreaterThan(0);
      expect(middle.band[1]).toBeLessThan(TRACK);
      expect(end.band[1]).toBeLessThanOrEqual(0.5);
    },
    60_000,
  );

  it.skipIf(!available)(
    "with reduced motion fills the track and fades instead of moving, in both directions",
    async () => {
      for (const id of ["ltr", "rtl"]) {
        for (const time of [START, MIDDLE]) {
          const reading = await read("reduce", id, time);
          expect(reading.animation).toBe("mac-progress-bar-pulse");
          expect(reading.band[0]).toBeCloseTo(0, 0);
          expect(reading.band[1]).toBeCloseTo(TRACK, 0);
        }
        // The fade itself: faint at the start of a pulse and opaque at its end, in place.
        const faint = await read("reduce", id, START);
        const opaque = await read("reduce", id, FADE_END);
        expect(faint.opacity).toBeCloseTo(0.35, 2);
        expect(opaque.opacity).toBeGreaterThan(0.95);
        expect(opaque.band).toEqual(faint.band);
      }
    },
    60_000,
  );

  // Playwright cannot emulate forced colours in WebKit.
  it.skipIf(!available || name === "webkit")(
    "fills with the system highlight colour in forced colours, moving or with reduced motion",
    async () => {
      const accent = await colorOf("reduce", "fill", "active");
      const highlight = await colorOf("reduce", "highlight", "active");
      expect(highlight).not.toBe(accent);

      // Reduced motion gives the band its own colour with a rule as heavy as the first one
      // written for forced colours: the system colour has to win all the same.
      for (const motion of ["reduce", "no-preference"] as const) {
        for (const id of ["ltr", "inactive"]) {
          const band = await read(motion, id, START, "active");
          expect(band.background).toBe(`${highlight} none`);
        }
      }
    },
    60_000,
  );

  it.skipIf(!available)(
    "ends the track and the fill in half circles: 3 pt, and 2 pt for the small bar",
    async () => {
      // The screenshot comparisons notice a smaller track radius only by one pixel at 1x, and
      // the fill's radius not at all, so the values the stylesheet resolves to are read here.
      const { track, fill, smallTrack, smallFill } = await radii();
      expect(track).toEqual(["3px", "3px", "3px", "3px"]);
      // The fill is rounded at its leading end and square where it stops.
      expect(fill).toEqual(["3px", "3px", "0px", "0px"]);
      expect(smallTrack).toEqual(["2px", "2px", "2px", "2px"]);
      expect(smallFill).toEqual(["2px", "2px", "0px", "0px"]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "keeps the grey fill of a window that is not key, moving or with reduced motion",
    async () => {
      const accent = await colorOf("reduce", "fill");
      const grey = await colorOf("reduce", "fill-inactive");
      expect(grey).not.toBe(accent);

      const still = await read("reduce", "inactive", START);
      expect(still.background).toContain(grey);
      expect(still.background).not.toContain(accent);
      expect((await read("reduce", "ltr", START)).background).toContain(accent);

      const moving = await read("no-preference", "inactive", MIDDLE);
      expect(moving.background).toContain(grey);
      expect(moving.background).not.toContain(accent);
    },
    60_000,
  );
});
