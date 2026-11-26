// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What jsdom cannot show: that Return on a focused event opens its popover and leaves it open.
 * A real browser turns Return on a button into a click after the key; that click lands outside
 * the popover the key opened and must not dismiss it. The
 * window is served by the visual harness's page (visual/harness) and run in each engine
 * Playwright has installed; an engine that is not installed is skipped unless
 * REQUIRE_BROWSER_TESTS is set (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/calendar/examples/basic.tsx";

requireEveryEngine("the Calendar tests");

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

/** Long enough for a popover that was dismissed at once to have left the page. */
const SETTLE = 400;

describe.each(Object.keys(ENGINES))("Calendar in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  const load = async () => {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  };

  const event = (title: string) =>
    tab.getByRole("button", { name: new RegExp(`^${title},`) }).first();
  const dialog = (title: string) => tab.getByRole("dialog", { name: title, exact: true });

  for (const title of ["Rosh Hashanah", "Make Catalina Screenshots"]) {
    it.runIf(available)(
      `opens the popover of "${title}" with Return and keeps it open; Escape closes it and returns the focus`,
      async () => {
        await load();
        const button = event(title);
        await button.focus();
        await tab.keyboard.press("Enter");
        await tab.waitForTimeout(SETTLE);

        await expect.poll(() => dialog(title).isVisible()).toBe(true);
        expect(await button.getAttribute("aria-pressed")).toBe("true");
        // The popover itself takes the focus.
        expect(await dialog(title).evaluate((element) => element === document.activeElement)).toBe(
          true,
        );

        await tab.keyboard.press("Escape");
        await expect.poll(() => tab.getByRole("dialog").count()).toBe(0);
        expect(await button.evaluate((element) => element === document.activeElement)).toBe(true);
        expect(await button.getAttribute("aria-pressed")).toBe("true");
        await tab.context().close();
      },
      200_000,
    );
  }

  it.runIf(available)(
    "selects an event with Space, as the week grid documents, without opening its popover",
    async () => {
      await load();
      const button = event("Rosh Hashanah");
      await button.focus();
      await tab.keyboard.press("Space");
      await tab.waitForTimeout(SETTLE);
      expect(await button.getAttribute("aria-pressed")).toBe("true");
      expect(await tab.getByRole("dialog").count()).toBe(0);
      await tab.context().close();
    },
    200_000,
  );

  it.runIf(available)(
    "selects an event on a click and opens its popover on a double click",
    async () => {
      await load();
      const button = event("Rosh Hashanah");
      await button.click();
      await tab.waitForTimeout(SETTLE);
      expect(await button.getAttribute("aria-pressed")).toBe("true");
      expect(await tab.getByRole("dialog").count()).toBe(0);

      await button.dblclick();
      await tab.waitForTimeout(SETTLE);
      await expect.poll(() => dialog("Rosh Hashanah").isVisible()).toBe(true);

      // A press outside the popover closes it.
      await tab.getByRole("button", { name: "Calendar Preferences…" }).click();
      await expect.poll(() => tab.getByRole("dialog").count()).toBe(0);
      await tab.context().close();
    },
    200_000,
  );
});
