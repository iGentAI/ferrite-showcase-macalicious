// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Browser, BrowserContext, BrowserType, Locator, Page } from "playwright";
import { createServer, normalizePath, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show of the desktop: the page of the Desktop demo with every demo
 * application in its Dock, driven with a real pointer and a real keyboard, in both
 * appearances. jsdom lays nothing out, so the unit tests give the desktop a size and windows
 * their frames by hand; here the windows are where the browser puts them.
 *
 * The page is the visual harness's, which renders one example alone, served by Vite from the
 * source tree. Each engine Playwright has installed is used (`npm run visual:install` installs
 * Chromium), and an engine that is not installed is skipped. Set REQUIRE_BROWSER_TESTS=1 where
 * the engines must be there: the run then fails and names each one that is missing
 * (test/browser-engines.ts).
 */

/** Every engine in both appearances. */
const CASES = Object.keys(ENGINES).flatMap((name) =>
  (["light", "dark"] as const).map((appearance) => [name, appearance] as const),
);

const root = path.resolve(import.meta.dirname, "../..");
/**
 * The address the harness's server gives a file of the repository: `/@fs/` and the file's
 * absolute path with forward slashes, which on Windows begins with the drive (`/@fs/C:/…`)
 * and elsewhere with the name under the root (`/@fs/home/…`).
 */
const served = (file: string) => `/@fs/${normalizePath(path.join(root, file)).replace(/^\/+/, "")}`;
const EXAMPLE = "demos/desktop/examples/basic.tsx";
/** The desktop of the example is 720 pt tall; the page gives it this width. */
const WIDTH = 1440;
const MENU_BAR = 22;
const DOCK = 80;

/** What is in the Dock besides the applications. */
const NOT_APPLICATIONS = ["Downloads", "Trash"];

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");
const near = (a: number, b: number, slack = 1.5) => Math.abs(a - b) <= slack;

interface Desk {
  page: Page;
  shell: Locator;
  dock: Locator;
  problems: string[];
  frame: (id: string) => Locator;
  box: (locator: Locator) => Promise<{ x: number; y: number; width: number; height: number }>;
  /** Key, main or inactive: what the window in a frame says of itself. */
  state: (frame: Locator) => Promise<string | null>;
  /** The title of the application menu: the front application's name. */
  front: () => Promise<string | null>;
  launch: (name: string) => Promise<Locator>;
  /** Chooses a command of a menu of the menu bar; false when the command is dimmed. */
  choose: (menu: string, command: RegExp) => Promise<boolean>;
  /** Presses the pointer at a point of a window and moves it by an offset before releasing. */
  drag: (from: { x: number; y: number }, by: { x: number; y: number }) => Promise<void>;
  /** A point of a window's bar that is the bar itself and not a control in it. */
  grip: (frame: Locator, region: string) => Promise<{ x: number; y: number }>;
  /**
   * Starts recording what changes in the desktop's document other than a frame's own `style`,
   * and returns a function that ends the recording and gives the changes: `content` for one
   * inside the frame's window, `outside` for one anywhere else.
   */
  watch: (frame: Locator) => Promise<() => Promise<string[]>>;
}

/** The harness's server and its address: one for the file, whichever engine asks. */
let server: ViteDevServer | undefined;
let cache: string | undefined;
let base = "";

beforeAll(async () => {
  if (!Object.values(ENGINES).some(installed)) return;
  // A cache of its own: the harness's is shared by every run in the checkout, and two
  // servers that prepare dependencies in one folder take each other's files away.
  cache = await mkdtemp(path.join(os.tmpdir(), "macalicious-desktop-"));
  server = await createServer({
    configFile: path.join(root, "visual/vite.config.ts"),
    cacheDir: cache,
    logLevel: "silent",
    server: { port: 0, host: "127.0.0.1", strictPort: false },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address !== "object") throw new Error("The harness has no address.");
  base = `http://127.0.0.1:${address.port}`;
}, 120_000);

afterAll(async () => {
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

requireEveryEngine("the desktop tests");

describe.each(CASES)("the desktop in %s, %s", (name, appearance) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser | undefined;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Opens the Desktop demo on a page of its own and runs a test on it. */
  async function onDesktop(run: (desk: Desk) => Promise<void>) {
    if (!browser) throw new Error("No browser.");
    const context: BrowserContext = await browser.newContext({
      viewport: { width: WIDTH + 40, height: 800 },
      colorScheme: appearance,
    });
    try {
      const page = await context.newPage();
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`console error: ${message.text()}`);
      });
      await page.goto(`${base}/?example=${EXAMPLE}&appearance=${appearance}`);
      await page.waitForSelector("html[data-ready], html[data-error]", { timeout: 90_000 });
      expect(await page.getAttribute("html", "data-error")).toBeNull();
      // The harness shrinks its root to the example; the desktop takes the width it is given.
      await page.addStyleTag({ content: `#visual-root { display: block; width: ${WIDTH}px; }` });
      const shell = page.locator(".mac-desktop-shell");
      const dock = shell.getByRole("toolbar", { name: "Dock" });
      const frame = (id: string) => shell.locator(`.mac-managed-window[data-window-id="${id}"]`);
      const box = async (locator: Locator) => {
        const rect = await locator.boundingBox();
        if (!rect) throw new Error("The element has no box.");
        return rect;
      };
      const menus = shell.getByRole("menubar").first();
      const desk: Desk = {
        page,
        shell,
        dock,
        problems,
        frame,
        box,
        state: (locator) =>
          locator.locator(":scope > [data-window-state]").first().getAttribute("data-window-state"),
        front: () => menus.getByRole("menuitem").nth(1).textContent(),
        launch: async (name) => {
          await dock.getByRole("button", { name, exact: true }).click();
          const window = frame(slug(name));
          await window.waitFor();
          return window;
        },
        choose: async (menu, command) => {
          await menus.getByRole("menuitem", { name: menu, exact: true }).click();
          const item = page.getByRole("menuitem", { name: command });
          await item.waitFor();
          if ((await item.getAttribute("aria-disabled")) === "true") {
            await page.keyboard.press("Escape");
            return false;
          }
          await item.click();
          return true;
        },
        drag: async (from, by) => {
          await page.mouse.move(from.x, from.y);
          await page.mouse.down();
          await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 5 });
          await page.mouse.up();
        },
        grip: async (locator, region) => {
          const point = await locator
            .locator(region)
            .first()
            .evaluate((element) => {
              const rect = element.getBoundingClientRect();
              for (let x = rect.right - 6; x > rect.left; x -= 6) {
                const hit = document.elementFromPoint(x, rect.top + 5);
                if (
                  hit &&
                  element.contains(hit) &&
                  !hit.closest("button, input, a, select, [role='tab'], [role='button']")
                ) {
                  return { x, y: rect.top + 5 };
                }
              }
              return null;
            });
          if (!point) throw new Error(`No part of ${region} is free of controls.`);
          return point;
        },
        watch: async (locator) => {
          await locator.evaluate((element) => {
            const seen: string[] = [];
            const note = (records: MutationRecord[]) => {
              for (const record of records) {
                if (
                  record.target === element &&
                  record.type === "attributes" &&
                  record.attributeName === "style"
                ) {
                  continue;
                }
                const where =
                  record.target !== element && element.contains(record.target)
                    ? "content"
                    : "outside";
                seen.push(`${where}: ${record.type} ${record.attributeName ?? ""}`.trim());
              }
            };
            const observer = new MutationObserver(note);
            observer.observe(element.closest(".mac-desktop-shell") ?? document.body, {
              subtree: true,
              attributes: true,
              childList: true,
              characterData: true,
            });
            (window as unknown as { watched?: () => string[] }).watched = () => {
              note(observer.takeRecords());
              observer.disconnect();
              return seen;
            };
          });
          return () =>
            page.evaluate(
              () => (window as unknown as { watched?: () => string[] }).watched?.() ?? [],
            );
        },
      };
      await run(desk);
      expect(problems).toEqual([]);
    } finally {
      await context.close();
    }
  }

  it.skipIf(!available)(
    "launches every demo application from the Dock as a key window, and closes it",
    () =>
      onDesktop(async ({ page, shell, dock, frame, box, state, front }) => {
        // The descriptors the page itself found in demos/: a window's id is the descriptor's,
        // which is not always its name in lower case, and the menu bar shows its first menu,
        // which is not always its name (Force Quit Applications keeps the Finder's menus).
        const apps = (await page.evaluate(
          `import(${JSON.stringify(served("demos/desktop/desktop-apps.ts"))}).then((module) =>
            module.discoveredApps.map((app) => ({ id: app.id, name: app.name, menu: app.menus[0] })))`,
        )) as { id: string; name: string; menu: string }[];
        const tiles = await dock
          .getByRole("button")
          .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
        const names = tiles.filter(
          (name): name is string => name !== null && !NOT_APPLICATIONS.includes(name),
        );
        // Finder, System Preferences and the demos: more than the twelve the project asks for,
        // and every demo that has a descriptor is in the Dock.
        expect(apps.length).toBeGreaterThanOrEqual(14);
        expect(apps.map((app) => app.name).filter((name) => !names.includes(name))).toEqual([]);
        // The Dock holds them all inside the desktop: here, and on a desktop two thirds as
        // wide, which is the room half as many applications again would leave.
        const fits = async () => {
          const [shelf, desk] = [await box(dock), await box(shell)];
          return shelf.x >= desk.x && shelf.x + shelf.width <= desk.x + desk.width;
        };
        expect(await fits()).toBe(true);
        const narrow = await page.addStyleTag({
          content: `#visual-root { width: ${Math.round((WIDTH * 2) / 3)}px !important; }`,
        });
        expect((await box(shell)).width).toBe(Math.round((WIDTH * 2) / 3));
        expect(await fits()).toBe(true);
        await narrow.evaluate((element) => (element as Element).remove());
        expect((await box(shell)).width).toBe(WIDTH);
        const failed: string[] = [];
        for (const { id, name, menu } of apps) {
          const tile = dock.getByRole("button", { name, exact: true });
          const window = frame(id);
          try {
            await tile.click();
            await window.waitFor({ timeout: 15_000 });
            const rect = await box(window);
            const desk = await box(shell);
            const inside = rect.y >= desk.y + MENU_BAR - 1 && rect.width > 50 && rect.height > 30;
            const running = (await tile.getAttribute("data-running")) !== null;
            const key = (await state(window)) === "key";
            const shown = await front();
            if (!inside || !running || !key || shown !== menu) {
              failed.push(
                `${name}: inside ${inside}, running ${running}, key ${key}, menu bar ${shown}`,
              );
            }
            await window.getByRole("button", { name: "Close" }).first().click();
            await window.waitFor({ state: "detached", timeout: 5_000 });
          } catch (error) {
            failed.push(`${name}: ${String(error).split("\n")[0]}`);
          }
        }
        expect(failed).toEqual([]);
        expect(await shell.locator(".mac-managed-window").count()).toBe(0);
        // No click on a tile has scrolled the desktop.
        expect(await shell.evaluate((element) => [element.scrollLeft, element.scrollTop])).toEqual([
          0, 0,
        ]);
      }),
    300_000,
  );

  it.skipIf(!available)(
    "moves, resizes, orders, minimizes, zooms and closes windows with the pointer and the keyboard",
    () =>
      onDesktop(async (desk) => {
        const { page, shell, dock, box, state, front, drag, grip, watch } = desk;
        const window = await desk.launch("TextEdit");
        let before = await box(window);

        // The title bar moves the window. While the pointer moves, nothing in the desktop's
        // document changes but the frame's own style: no element is rendered anew for a frame
        // of the move.
        const bar = await grip(window, "[data-window-drag-region]");
        await page.mouse.move(bar.x, bar.y);
        await page.mouse.down();
        await page.mouse.move(bar.x - 10, bar.y + 10, { steps: 2 });
        expect(await window.getAttribute("data-dragging")).not.toBeNull();
        let changes = await watch(window);
        await page.mouse.move(bar.x - 60, bar.y + 40, { steps: 8 });
        expect((await box(window)).x - before.x).toBe(-60);
        expect(await changes()).toEqual([]);
        await page.mouse.up();
        expect(await window.getAttribute("data-dragging")).toBeNull();
        let after = await box(window);
        expect([after.x - before.x, after.y - before.y]).toEqual([-60, 40]);

        // The bottom right corner grows it with the origin fixed; the left edge moves the origin.
        // While the pointer moves, only the frame's style and what the window itself lays out
        // again change: nothing outside the window.
        before = after;
        const corner = await box(window.locator(".mac-managed-window-resize[data-edge='se']"));
        const from = { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + 10, from.y + 10, { steps: 2 });
        changes = await watch(window);
        await page.mouse.move(from.x + 50, from.y + 30, { steps: 8 });
        expect((await box(window)).width - before.width).toBe(50);
        expect((await changes()).filter((change) => !change.startsWith("content"))).toEqual([]);
        await page.mouse.up();
        after = await box(window);
        expect([after.width - before.width, after.height - before.height]).toEqual([50, 30]);
        expect([after.x, after.y]).toEqual([before.x, before.y]);
        before = after;
        const edge = await box(window.locator(".mac-managed-window-resize[data-edge='w']"));
        await drag({ x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 }, { x: -40, y: 0 });
        after = await box(window);
        expect([after.width - before.width, after.x - before.x]).toEqual([40, -40]);

        // Control-Option with the arrow keys moves it by 16 pt, and with Shift resizes it.
        before = after;
        await page.keyboard.press("Control+Alt+ArrowRight");
        await page.keyboard.press("Control+Alt+ArrowDown");
        after = await box(window);
        expect([after.x - before.x, after.y - before.y]).toEqual([16, 16]);
        before = after;
        await page.keyboard.press("Control+Alt+Shift+ArrowRight");
        await page.keyboard.press("Control+Alt+Shift+ArrowDown");
        after = await box(window);
        expect([after.width - before.width, after.height - before.height]).toEqual([16, 16]);

        // A second application's window opens in front and key; a press brings the first back.
        const second = await desk.launch("Calculator");
        const level = (locator: Locator) =>
          locator.evaluate((element) => Number(getComputedStyle(element).zIndex));
        expect(await level(second)).toBeGreaterThan(await level(window));
        expect([await state(second), await state(window)]).toEqual(["key", "inactive"]);
        expect(await front()).toBe("Calculator");
        const free = await window.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          for (let y = rect.top + 60; y < rect.bottom - 10; y += 20) {
            for (const x of [rect.left + 20, rect.right - 20]) {
              const hit = document.elementFromPoint(x, y);
              if (hit && element.contains(hit) && !hit.closest("button, input, a")) return { x, y };
            }
          }
          return null;
        });
        if (!free) throw new Error("No part of the first window is uncovered.");
        await page.mouse.click(free.x, free.y);
        expect(await level(window)).toBeGreaterThan(await level(second));
        expect([await state(window), await state(second)]).toEqual(["key", "inactive"]);
        expect(await front()).toBe("TextEdit");
        await page.keyboard.press("Control+Alt+Backquote");
        expect(await state(second)).toBe("key");
        await page.keyboard.press("Control+Alt+Backquote");
        expect(await state(window)).toBe("key");

        // Minimized into the Dock from the keyboard, restored from its tile, and again from
        // the yellow button.
        const tile = dock.getByRole("button", { name: /minimized window/ });
        await page.keyboard.press("Control+Alt+KeyM");
        await tile.waitFor();
        expect(await window.getAttribute("data-minimized")).not.toBeNull();
        expect(await state(second)).toBe("key");
        await tile.click();
        await tile.waitFor({ state: "detached" });
        expect(await window.getAttribute("data-minimized")).toBeNull();
        expect(await state(window)).toBe("key");
        await page.waitForTimeout(350);
        await window.getByRole("button", { name: "Minimize" }).first().click();
        await tile.waitFor();
        await tile.click();
        await tile.waitFor({ state: "detached" });
        await page.waitForTimeout(350);

        // Zoomed to the space between the menu bar and the Dock, and back to its frame.
        const screen = await box(shell);
        before = await box(window);
        await page.keyboard.press("Control+Alt+KeyZ");
        await page.waitForTimeout(350);
        after = await box(window);
        expect(await window.getAttribute("data-zoomed")).not.toBeNull();
        expect(near(after.width, screen.width)).toBe(true);
        expect(near(after.y - screen.y, MENU_BAR)).toBe(true);
        expect(near(after.height, screen.height - MENU_BAR - DOCK)).toBe(true);
        await page.keyboard.press("Control+Alt+KeyZ");
        await page.waitForTimeout(350);
        after = await box(window);
        expect(await window.getAttribute("data-zoomed")).toBeNull();
        expect([after.x, after.width, after.height]).toEqual([
          before.x,
          before.width,
          before.height,
        ]);

        // The same with the pointer: the green button zooms with Option held, and back.
        const green = window.locator(".mac-window-controls-button[data-kind='zoom']").first();
        expect(await green.getAttribute("aria-label")).toBe("Enter Full Screen");
        await green.click({ modifiers: ["Alt"] });
        await page.waitForTimeout(350);
        after = await box(window);
        expect(await window.getAttribute("data-zoomed")).not.toBeNull();
        expect(near(after.width, screen.width)).toBe(true);
        expect(near(after.height, screen.height - MENU_BAR - DOCK)).toBe(true);
        await green.click({ modifiers: ["Alt"] });
        await page.waitForTimeout(350);
        after = await box(window);
        expect(await window.getAttribute("data-zoomed")).toBeNull();
        expect([after.x, after.width, after.height]).toEqual([
          before.x,
          before.width,
          before.height,
        ]);

        // Full screen covers the whole desktop, and the Dock is then out of reach. Off Apple platforms TextEdit answers
        // this chord where it has the focus, as its Find and Replace (Option-Command-F), so it goes to the desktop itself.
        const fullScreenKey = () =>
          shell.dispatchEvent("keydown", {
            code: "KeyF",
            key: "f",
            ctrlKey: true,
            altKey: true,
            bubbles: true,
          });
        await fullScreenKey();
        await page.waitForTimeout(400);
        after = await box(window);
        expect(await window.getAttribute("data-full-screen")).not.toBeNull();
        expect(near(after.width, screen.width) && near(after.height, screen.height)).toBe(true);
        expect(await dock.evaluate((element) => (element as HTMLElement).inert)).toBe(true);
        await fullScreenKey();
        await page.waitForTimeout(400);
        expect(await window.getAttribute("data-full-screen")).toBeNull();
        expect(await dock.evaluate((element) => (element as HTMLElement).inert)).toBe(false);

        // And with the pointer: the green button enters full screen, and leaves it again.
        await green.click();
        await page.waitForTimeout(400);
        after = await box(window);
        expect(await window.getAttribute("data-full-screen")).not.toBeNull();
        expect(near(after.width, screen.width) && near(after.height, screen.height)).toBe(true);
        expect(await green.getAttribute("aria-label")).toBe("Exit Full Screen");
        await green.click();
        await page.waitForTimeout(400);
        after = await box(window);
        expect(await window.getAttribute("data-full-screen")).toBeNull();
        expect([after.x, after.width, after.height]).toEqual([
          before.x,
          before.width,
          before.height,
        ]);

        await page.keyboard.press("Control+Alt+KeyW");
        await window.waitFor({ state: "detached" });
        expect(await front()).toBe("Calculator");
      }),
    180_000,
  );

  it.skipIf(!available)(
    "opens an application's Preferences from its menu and with the key, hosted or its own",
    () =>
      onDesktop(async (desk) => {
        const { page, dock, frame, box, state, front, grip, drag } = desk;
        const windows = () => page.locator("[data-window-state]").count();

        // Calendar's are a second window of the desktop.
        const calendar = await desk.launch("Calendar");
        expect(await desk.choose("Calendar", /^Preferences…/)).toBe(true);
        const preferences = frame("calendar:preferences");
        await preferences.waitFor();
        expect(await state(preferences)).toBe("key");
        expect(
          await preferences.evaluate((element) => element.contains(document.activeElement)),
        ).toBe(true);
        expect(await front()).toBe("Calendar");
        const window = preferences.locator(":scope > [data-window-state]");
        let outer = await box(preferences);
        expect(outer.width).toBe(537);
        expect(near(outer.height, (await box(window)).height)).toBe(true);
        // Moved by its title bar, and the frame follows the height of another pane.
        const start = outer;
        await drag(await grip(preferences, "[data-window-drag-region]"), { x: 70, y: 40 });
        outer = await box(preferences);
        expect([outer.x - start.x, outer.y - start.y]).toEqual([70, 40]);
        await preferences.getByRole("tab").nth(1).click();
        await page.waitForTimeout(600);
        const pane = await box(window);
        expect(near(pane.height, start.height, 5)).toBe(false);
        expect(near((await box(preferences)).height, pane.height)).toBe(true);
        // The key brings them forward from the main window; no second window opens.
        await calendar
          .locator(":scope > [data-window-state]")
          .click({ position: { x: 400, y: 10 } });
        expect(await state(calendar)).toBe("key");
        await page.keyboard.press("Control+Comma");
        expect(await state(preferences)).toBe("key");
        expect(await frame("calendar:preferences").count()).toBe(1);
        await preferences.getByRole("button", { name: "Close" }).click();
        await preferences.waitFor({ state: "detached" });
        expect(await calendar.count()).toBe(1);

        // Mail renders its own.
        await desk.launch("Mail");
        const before = await windows();
        expect(await desk.choose("Mail", /^Preferences…/)).toBe(true);
        await expect.poll(windows).toBe(before + 1);
        await page.getByRole("button", { name: "Close" }).last().click();
        await expect.poll(windows).toBe(before);

        // An application without them: the command is dimmed.
        await dock.getByRole("button", { name: "Calculator", exact: true }).click();
        await frame("calculator").waitFor();
        expect(await desk.choose("Calculator", /^Preferences…/)).toBe(false);
      }),
    180_000,
  );

  it.skipIf(!available)(
    "returns the keyboard to the window after a command, and leaves it with a menu opened straight after",
    () =>
      onDesktop(async (desk) => {
        const { page, shell } = desk;
        // Safari's Sidebar command leaves the keyboard alone (TextEdit, by contrast, puts it in its
        // text as soon as its window changes), so the desktop decides where it goes after it.
        const window = await desk.launch("Safari");
        const close = window.getByRole("button", { name: "Close" }).first();
        const onClose = () => close.evaluate((element) => element === document.activeElement);
        const inOpenMenu = () =>
          page.evaluate(() => document.activeElement?.closest('[role="menu"][data-open]') != null);
        // A menu fades out after a choice (0.25 s), and the desktop asks where the keyboard goes once
        // it has. Here the fade is longer, so that in every engine the second menu opens while the
        // first still fades, as a quick second click does at the usual length.
        await page.addStyleTag({ content: ".mac-menu { --mac-menu-fade: opacity 1.2s; }" });

        // After a command, the keyboard goes back to where it was in the key window.
        await close.focus();
        expect(await desk.choose("View", /^(Show|Hide) Sidebar/)).toBe(true);
        await expect
          .poll(onClose, {
            timeout: 5_000,
            message: "after a command the keyboard goes back to the window",
          })
          .toBe(true);

        // A menu opened while the last one fades keeps it, once that one has faded.
        expect(await desk.choose("View", /^(Show|Hide) Sidebar/)).toBe(true);
        await shell
          .getByRole("menubar")
          .first()
          .getByRole("menuitem", { name: "Bookmarks", exact: true })
          .click();
        const bookmarks = page.getByRole("menuitem", { name: /^Show Bookmarks/ });
        await bookmarks.waitFor();
        await page.waitForTimeout(1_800);
        const straight = "the menu opened straight after the command";
        expect(await bookmarks.isVisible(), `${straight} is still open`).toBe(true);
        expect(await onClose(), `${straight} keeps the keyboard from the window`).toBe(false);
        expect(await inOpenMenu(), `${straight} has the keyboard`).toBe(true);
        await page.keyboard.press("Escape");
        await bookmarks.waitFor({ state: "hidden" });
      }),
    120_000,
  );

  it.skipIf(!available)(
    "opens Mail's New Message window and the Finder's Info window and Quick Look as windows of the desktop",
    () =>
      onDesktop(async (desk) => {
        const { page, shell, frame, box, state, front, grip, drag } = desk;

        const mail = await desk.launch("Mail");
        await mail.getByRole("button", { name: "New Message" }).click();
        const compose = frame("mail:compose-1");
        await compose.waitFor();
        expect([await state(compose), await state(mail)]).toEqual(["key", "inactive"]);
        expect(await front()).toBe("Mail");
        let before = await box(compose);
        expect([before.width, before.height]).toEqual([886, 585]);
        await drag(await grip(compose, "[data-window-drag-region]"), { x: -50, y: 30 });
        let after = await box(compose);
        expect([after.x - before.x, after.y - before.y]).toEqual([-50, 30]);
        // It is resized at its edge (its lower corners may be behind the Dock), and the viewer
        // is key again once it has closed.
        const edge = await box(compose.locator(".mac-managed-window-resize[data-edge='e']"));
        await drag({ x: edge.x + edge.width / 2, y: edge.y + 40 }, { x: -100, y: 0 });
        before = after;
        after = await box(compose);
        expect([after.width - before.width, after.height - before.height]).toEqual([-100, 0]);
        await compose.getByRole("button", { name: "Close" }).first().click();
        await compose.waitFor({ state: "detached" });
        expect(await state(mail)).toBe("key");
        await page.keyboard.press("Control+Alt+KeyW");
        await mail.waitFor({ state: "detached" });

        const finder = await desk.launch("Finder");
        await finder.getByRole("option", { name: "Pictures" }).click();
        await page.keyboard.press("Control+KeyI");
        const info = frame("finder:info");
        await info.waitFor();
        expect(await state(info)).toBe("key");
        expect(await front()).toBe("Finder");
        // As wide as an Info window and as tall as its sections; a section that closes takes
        // the frame with it.
        const panel = info.locator(":scope > [data-window-state]");
        before = await box(info);
        expect(before.width).toBe(265);
        expect(near(before.height, (await box(panel)).height)).toBe(true);
        await drag(await grip(info, "[data-window-drag-region]"), { x: 60, y: -20 });
        after = await box(info);
        expect([after.x - before.x, after.y - before.y]).toEqual([60, -20]);
        await info
          .getByRole("button", { name: /General/ })
          .first()
          .click();
        await expect
          .poll(async () => near((await box(info)).height, (await box(panel)).height))
          .toBe(true);
        expect((await box(info)).height).toBeLessThan(before.height - 20);

        // Quick Look of the selected item: a panel of the desktop, moved by its bar.
        await finder.getByRole("option", { name: "Pictures" }).click();
        await page.keyboard.press("Space");
        const look = frame("finder:quick-look");
        await look.waitFor();
        expect(await state(look)).toBe("key");
        expect(await shell.locator(".mac-managed-window").count()).toBe(3);
        before = await box(look);
        await drag(await grip(look, ".mac-quick-look-panel-bar"), { x: 40, y: 30 });
        after = await box(look);
        expect([after.x - before.x, after.y - before.y]).toEqual([40, 30]);
        await page.keyboard.press("Escape");
        await look.waitFor({ state: "detached" });
        // The viewer is key again and lies over the Info window; focus brings the Info window
        // forward, as a click on a visible part of it would.
        expect(await state(finder)).toBe("key");
        const close = info.getByRole("button", { name: "Close" });
        await close.focus();
        expect(await state(info)).toBe("key");
        await close.click();
        await info.waitFor({ state: "detached" });
        expect(await finder.count()).toBe(1);
      }),
    180_000,
  );

  it.skipIf(!available)(
    "shows Launchpad, Spotlight and Siri over the windows, and opens what is chosen in them",
    () =>
      onDesktop(async ({ page, shell, dock, frame, box, state, front }) => {
        const desk = await box(shell);
        const within = (rect: { x: number; y: number; width: number; height: number }) =>
          rect.x >= desk.x &&
          rect.y >= desk.y &&
          rect.x + rect.width <= desk.x + desk.width &&
          rect.y + rect.height <= desk.y + desk.height;

        // Launchpad from its Dock tile: it covers the desktop, and the Dock stays in front.
        const tile = dock.getByRole("button", { name: "Launchpad", exact: true });
        await tile.click();
        const launchpad = shell.getByRole("dialog");
        await launchpad.waitFor();
        const cover = await box(launchpad);
        expect([cover.x, cover.y, cover.width, cover.height]).toEqual([
          desk.x,
          desk.y,
          desk.width,
          desk.height,
        ]);
        // Its search keeps the applications whose names match; choosing one opens it.
        await page.keyboard.type("Calculator");
        await launchpad.getByRole("button", { name: "Calculator", exact: true }).click();
        const calculator = frame("calculator");
        await calculator.waitFor();
        await launchpad.waitFor({ state: "detached" });
        expect(await state(calculator)).toBe("key");
        expect(await front()).toBe("Calculator");
        // The tile hides it as well as shows it, with an ordinary click: the Dock is in front
        // of Launchpad, so the pointer reaches the tile. Launchpad is modal, so the Dock is
        // hidden from assistive technology while it shows: the tile is found by its label, not
        // its role.
        await tile.click();
        await launchpad.waitFor();
        const shown = shell.locator('.mac-dock [aria-label="Launchpad"]');
        const centre = await box(shown);
        expect(
          await page.evaluate(
            ([x, y]) =>
              document
                .elementFromPoint(x as number, y as number)
                ?.closest("[aria-label]")
                ?.getAttribute("aria-label"),
            [centre.x + centre.width / 2, centre.y + centre.height / 2],
          ),
        ).toBe("Launchpad");
        await shown.click();
        await launchpad.waitFor({ state: "detached" });
        // It stays hidden: the click that follows the press does not show it again.
        await page.waitForTimeout(400);
        expect(await launchpad.count()).toBe(0);

        // Spotlight from its extra: the field has the keyboard, and Return opens the first
        // application found.
        const extra = (name: string) => shell.getByRole("menuitem", { name, exact: true });
        await extra("Spotlight").click();
        const field = shell.getByRole("combobox", { name: "Spotlight Search" });
        await field.waitFor();
        expect(await field.evaluate((element) => element === document.activeElement)).toBe(true);
        expect(within(await box(shell.locator(".mac-spotlight")))).toBe(true);
        await page.keyboard.type("textedit");
        const result = shell.getByRole("option", { name: "TextEdit", exact: true });
        await result.waitFor();
        expect(await result.getAttribute("aria-selected")).toBe("true");
        await page.keyboard.press("Enter");
        const textedit = frame("textedit");
        await textedit.waitFor();
        await field.waitFor({ state: "detached" });
        expect(await state(textedit)).toBe("key");
        // A double click opens a result that is not the first one found.
        await extra("Spotlight").click();
        await field.waitFor();
        await page.keyboard.type("ca");
        const found = shell.getByRole("option");
        await shell.getByRole("option", { name: "Calendar", exact: true }).waitFor();
        expect(await found.count()).toBeGreaterThan(1);
        const second = found.nth(1);
        const secondId = (await second.getAttribute("data-value")) ?? "";
        expect(await second.getAttribute("aria-selected")).toBe("false");
        await second.dblclick();
        await field.waitFor({ state: "detached" });
        const opened = frame(secondId);
        await opened.waitFor();
        expect(await state(opened)).toBe("key");
        // A press beside the window closes it.
        await extra("Spotlight").click();
        await field.waitFor();
        await page.mouse.click(desk.x + 20, desk.y + desk.height / 2);
        await field.waitFor({ state: "detached" });

        // Siri from its extra, under the menu bar at the right; one overlay at a time.
        await extra("Spotlight").click();
        await field.waitFor();
        await extra("Siri").click();
        await field.waitFor({ state: "detached" });
        const siri = shell.locator(".mac-desktop-shell-siri");
        await siri.waitFor();
        const place = await box(siri);
        expect(within(place)).toBe(true);
        expect(place.y).toBeGreaterThanOrEqual(desk.y + MENU_BAR);
        await siri.getByRole("button", { name: "Close" }).click();
        await siri.waitFor({ state: "detached" });
        expect(await shell.evaluate((element) => [element.scrollLeft, element.scrollTop])).toEqual([
          0, 0,
        ]);
      }),
    180_000,
  );
});
