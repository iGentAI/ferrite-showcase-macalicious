// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserType } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";
import { PathBar, PathBarItem } from "../path-bar";
import { ScopeBar, ScopeBarButton, ScopeBarGroup, ScopeBarLabel } from "../scope-bar";
import { StatusBar } from "../status-bar";
import { WindowBanner } from "../window-banner";
import { WindowTab, WindowTabBar } from "../window-tab-bar";
import { Window, WindowBody } from "./index";

/*
 * What only a browser can show: the heights of a window's bars once its body holds more than
 * the window has room for. The window is a column whose body gives way and scrolls; a bar that
 * could shrink would be squeezed with it. The components are rendered by React and styled by
 * the stylesheets they ship with; each engine that Playwright has installed is used (`npm run
 * visual:install` installs Chromium), and one that is not installed is skipped. Set
 * REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and names each
 * one that is missing (test/browser-engines.ts).
 */

/** The bars a window stacks around its body, besides the title bar and the toolbar. */
const BARS = ["window-tab-bar", "scope-bar", "window-banner", "path-bar", "status-bar"];

const here = import.meta.dirname;
const styles = path.join(here, "../../styles");

/** The token sheets in the order index.css imports them, then each component's own. */
function stylesheet() {
  const index = readFileSync(path.join(styles, "index.css"), "utf8");
  const files = [...index.matchAll(/@import "(.+?)";/g)].map(([, file]) =>
    path.join(styles, file as string),
  );
  for (const name of ["window-shadow", "window", ...BARS]) {
    for (const file of [`${name}.tokens.css`, `${name}.css`]) {
      const sheet = path.join(here, "..", name, file);
      if (existsSync(sheet)) files.push(sheet);
    }
  }
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const WINDOW_HEIGHT = 200;
const CONTENT_HEIGHT = 600;

const above = (
  <>
    <WindowTabBar aria-label="Folders" defaultValue="home">
      <WindowTab value="home">Home</WindowTab>
      <WindowTab value="documents">Documents</WindowTab>
    </WindowTabBar>
    <ScopeBar>
      <ScopeBarLabel>Search:</ScopeBarLabel>
      <ScopeBarGroup aria-label="Search" defaultValue="mac">
        <ScopeBarButton value="mac">This Mac</ScopeBarButton>
      </ScopeBarGroup>
    </ScopeBar>
    <WindowBanner>Shared Folder</WindowBanner>
  </>
);

const below = (
  <>
    <PathBar>
      <PathBarItem>Macintosh HD</PathBarItem>
      <PathBarItem>Users</PathBarItem>
    </PathBar>
    <StatusBar>14 items, 212.4 GB available</StatusBar>
  </>
);

/** The bars on their own, where nothing presses on them, and in a window that is too short. */
function page() {
  const body = renderToStaticMarkup(
    <>
      <div id="free" style={{ width: 400 }}>
        {above}
        {below}
      </div>
      <Window id="short" aria-label="Short" width={400} height={WINDOW_HEIGHT}>
        {above}
        <WindowBody>
          <div style={{ height: CONTENT_HEIGHT }}>Content</div>
        </WindowBody>
        {below}
      </Window>
    </>,
  );
  return `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`;
}

requireEveryEngine("the Window tests");

describe.each(Object.keys(ENGINES))("Window in %s", (name) => {
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
    "keeps every bar at its height when the body holds more than the window has room for",
    async () => {
      const context = await browser.newContext();
      try {
        const tab = await context.newPage();
        await tab.setContent(page());
        const { free, short, body } = await tab.evaluate((bars) => {
          const heights = (id: string) =>
            bars.map((bar) => {
              const element = document.querySelector(`#${id} > .mac-${bar}`);
              return element ? element.getBoundingClientRect().height : -1;
            });
          const body = document.querySelector("#short > .mac-window-body") as HTMLElement;
          return {
            free: heights("free"),
            short: heights("short"),
            body: { height: body.clientHeight, content: body.scrollHeight },
          };
        }, BARS);

        // Each bar has the height it has where nothing presses on it: 21 pt or more.
        for (const height of free) expect(height).toBeGreaterThan(20);
        expect(Object.fromEntries(BARS.map((bar, index) => [bar, short[index]]))).toEqual(
          Object.fromEntries(BARS.map((bar, index) => [bar, free[index]])),
        );

        // The body is what gave way: it has no more than the bars leave, and it scrolls.
        const bars = free.reduce((sum, height) => sum + height, 0);
        expect(body.height).toBeGreaterThan(0);
        expect(body.height).toBeLessThanOrEqual(WINDOW_HEIGHT - bars);
        expect(body.content).toBe(CONTENT_HEIGHT);
      } finally {
        await context.close();
      }
    },
    60_000,
  );

  it.skipIf(!available)(
    "draws the top highlight rows over the content, and none in full screen, where the rim goes too",
    async () => {
      const context = await browser.newContext();
      try {
        const tab = await context.newPage();
        const body = renderToStaticMarkup(
          <>
            <Window id="plain" aria-label="Plain" width={200} height={100} />
            <Window id="lit" aria-label="Lit" topHighlight width={200} height={100} />
            <Window id="full" aria-label="Full" topHighlight fullScreen width={200} height={100} />
          </>,
        );
        await tab.setContent(
          `<!doctype html><html data-appearance="light"><head><style>${stylesheet()}</style></head><body>${body}</body></html>`,
        );
        const after = await tab.evaluate(() =>
          Object.fromEntries(
            ["plain", "lit", "full"].map((id) => {
              const style = getComputedStyle(document.getElementById(id) as HTMLElement, "::after");
              return [id, { content: style.content, shadow: style.boxShadow }];
            }),
          ),
        );
        // A window draws its rim; one that asks for the rows draws more than the rim.
        expect(after.plain?.content).not.toBe("none");
        expect(after.lit?.content).not.toBe("none");
        expect(after.lit?.shadow).not.toBe(after.plain?.shadow);
        // In full screen the layer that holds the rim and the rows is not drawn at all.
        expect(after.full?.content).toBe("none");
      } finally {
        await context.close();
      }
    },
    60_000,
  );
});
