// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { FavoritesBar, FavoritesBarItem, FavoritesBarOverflow } from "./index";

/*
 * What only a browser can show: which items a bar that is too narrow cuts off, and whether
 * its overflow button appears by itself. The visual comparison cannot: it captures with
 * animations switched off, and the button is shown by a scroll-driven animation. The component
 * is rendered by React and styled by the stylesheets it ships with; each engine Playwright has
 * installed is used (`npm run visual:install` installs Chromium), and an engine that is not
 * installed is skipped. Set REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run
 * then fails and names each one that is missing (test/browser-engines.ts).
 */

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then the component's own two. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  files.push(path.join(here, "favorites-bar.tokens.css"), path.join(here, "favorites-bar.css"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

/** Three 80 pt items and the overflow button, in a bar of the given width. */
function bar(id: string, width: number) {
  return (
    <FavoritesBar
      id={id}
      aria-label={id}
      overflow={<FavoritesBarOverflow aria-label={`More of ${id}`} />}
      style={{ width }}
    >
      {["One", "Two", "Three"].map((title) => (
        <FavoritesBarItem key={title} href="https://example.com/" style={{ width: 80 }}>
          {title}
        </FavoritesBarItem>
      ))}
    </FavoritesBar>
  );
}

function page() {
  const body = renderToStaticMarkup(
    <>
      {bar("wide", 300)}
      {bar("narrow", 220)}
    </>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

interface Reading {
  /** Whether the engine has scroll-driven animations, which show and hide the button. */
  timelines: boolean;
  /** Per bar: the titles of the items that are inside the row's box. */
  shown: Record<string, string[]>;
  /** Per bar: the computed visibility of the overflow button. */
  overflow: Record<string, string>;
  /** Whether focusing the narrow bar's cut-off item made it the active element. */
  focused: boolean;
  /** The titles shown in the narrow bar once its cut-off item has been focused. */
  shownAfterFocus: string[];
}

requireEveryEngine("the FavoritesBar tests");

describe.each(Object.keys(ENGINES))("FavoritesBar in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let reading: Reading;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext();
    const tab = await context.newPage();
    await tab.setContent(page());
    reading = await tab.evaluate(async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      await frame();
      await frame();
      const shown = (id: string) => {
        const row = document.querySelector(`#${id} .mac-favorites-bar-items`) as HTMLElement;
        const box = row.getBoundingClientRect();
        return [...row.children]
          .filter((item) => {
            const rect = item.getBoundingClientRect();
            return rect.top >= box.top && rect.bottom <= box.bottom;
          })
          .map((item) => item.textContent ?? "");
      };
      const overflow = (id: string) =>
        getComputedStyle(document.querySelector(`#${id} .mac-favorites-bar-overflow`) as Element)
          .visibility;
      const reading = {
        timelines: CSS.supports("animation-timeline: scroll()"),
        shown: { wide: shown("wide"), narrow: shown("narrow") },
        overflow: { wide: overflow("wide"), narrow: overflow("narrow") },
        focused: false,
        shownAfterFocus: [] as string[],
      };
      const cutOff = document.querySelector(
        "#narrow .mac-favorites-bar-item:nth-child(3)",
      ) as HTMLElement;
      cutOff.focus();
      reading.focused = document.activeElement === cutOff;
      // Chromium and Firefox scroll the row inside focus(). WebKit (26.6, Playwright 1.63)
      // reveals the focused element at a later rendering update: the row's scrollTop is still 0
      // after focus() and a forced layout, and moves by the next frame, or later under load.
      // Wait for the row to move, for at most 60 frames, so a row that never scrolls still fails.
      const row = document.querySelector("#narrow .mac-favorites-bar-items") as HTMLElement;
      for (let i = 0; i < 60 && row.scrollTop === 0; i++) await frame();
      reading.shownAfterFocus = shown("narrow");
      return reading;
    });
    await context.close();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)("cuts off whole the items that do not fit", () => {
    expect(reading.shown.wide).toEqual(["One", "Two", "Three"]);
    expect(reading.shown.narrow).toEqual(["One", "Two"]);
  });

  it.skipIf(!available)("shows the overflow button only while an item is cut off", () => {
    expect(reading.overflow.narrow).toBe("visible");
    // Without scroll-driven animations the button cannot tell and is always shown.
    expect(reading.overflow.wide).toBe(reading.timelines ? "hidden" : "visible");
  });

  it.skipIf(!available)("brings a cut-off item into view when the keyboard focuses it", () => {
    expect(reading.focused).toBe(true);
    expect(reading.shownAfterFocus).toEqual(["Three"]);
  });
});
