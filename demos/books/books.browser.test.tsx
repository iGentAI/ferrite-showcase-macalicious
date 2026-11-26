// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show. That the search field is really empty after Escape: the unit
 * tests type through a library that keeps its own record of a field's text, and the toolbar
 * search field clears itself with the input's native setter, which that record does not see;
 * a real keyboard has no such record. And, with real keys and real layout, that the keyboard
 * goes to the book window that Return opens and back to the cover when it closes, and that the
 * strip of thumbnails, which is wider than the example's book window, scrolls the current
 * page's thumbnail into view. Here the window is served by the visual harness's page
 * (visual/harness) and driven with real keys in each engine Playwright has installed
 * (`npm run visual:install` installs Chromium); an engine that is not installed is skipped.
 * Set REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and names
 * each one that is missing (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/books/examples/basic.tsx";
const CONTAINER = "demos/books/examples/container.tsx";
const BODY = "demos/books/examples/body.tsx";
const STACKED = "demos/books/examples/stacked.tsx";

requireEveryEngine("the Books tests");

// One server for the engines: each loads the same page from it.
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

describe.each(Object.keys(ENGINES))("Books in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.runIf(available)(
    "empties the search field with Escape, so that what is typed next stands alone",
    async () => {
      const search = tab.getByRole("searchbox", { name: "Search" });
      const covers = tab.locator(".mac-books-cover");
      const all = await covers.count();
      expect(all).toBeGreaterThan(1);

      await search.click();
      await tab.keyboard.type("no such thing");
      await expect.poll(() => covers.count()).toBe(0);

      await tab.keyboard.press("Escape");
      await expect.poll(() => search.inputValue()).toBe("");
      await expect.poll(() => covers.count()).toBe(all);

      // In a store, with the keyboard still in the field: only the new text is there.
      await tab.getByRole("button", { name: "Book Store", exact: true }).click();
      await search.click();
      await tab.keyboard.type("release 2");
      await expect.poll(() => search.inputValue()).toBe("release 2");
      const cards = tab.getByRole("listitem");
      await expect.poll(() => cards.count()).toBe(1);
      expect(await cards.first().textContent()).toContain("New Release 2");
    },
    60_000,
  );

  it.runIf(available)(
    "gives the keyboard to the book that Return opens, keeps the current thumbnail in view, and gives the keyboard back",
    async () => {
      // The page anew: the case before left the window in a store.
      await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const cover = tab.getByRole("button", { name: /^The Handbook, / });
      await cover.focus();
      await tab.keyboard.press("Enter");

      const reader = tab.getByRole("region", { name: "The Handbook" });
      const thumbnail = (number: number) =>
        reader.getByRole("button", { name: `Page ${number}`, exact: true });
      const focused = (number: number) =>
        thumbnail(number).evaluate((element) => element === element.ownerDocument.activeElement);
      await expect.poll(() => focused(1)).toBe(true);

      // Four thumbnails are 676 pt, the example's book window 640: the last is out of view.
      const inView = (number: number) =>
        thumbnail(number).evaluate((element) => {
          const scroller = element.closest(".mac-books-strip-scroller") as HTMLElement;
          const frame = scroller.getBoundingClientRect();
          const box = element.getBoundingClientRect();
          return box.left >= frame.left - 0.5 && box.right <= frame.right + 0.5;
        });
      expect(await inView(1)).toBe(true);
      expect(await inView(4)).toBe(false);

      // The arrow keys reach the book window without a click in it.
      await tab.keyboard.press("ArrowRight");
      await tab.keyboard.press("ArrowRight");
      await tab.keyboard.press("ArrowRight");
      await expect
        .poll(() => reader.getByRole("img").getAttribute("aria-label"))
        .toBe("Page 4 of 4");
      await expect.poll(() => focused(4)).toBe(true);
      await expect.poll(() => inView(4)).toBe(true);
      // A narrower window keeps it in view: the strip follows its own resizing.
      const width = await reader.evaluate((element) => (element as HTMLElement).style.width);
      await reader.evaluate((element) => {
        (element as HTMLElement).style.width = "420px";
      });
      await expect.poll(() => inView(4)).toBe(true);
      await reader.evaluate((element, given) => {
        (element as HTMLElement).style.width = given;
      }, width);
      // Back at the first page the strip is back at its start.
      await tab.keyboard.press("ArrowLeft");
      await tab.keyboard.press("ArrowLeft");
      await tab.keyboard.press("ArrowLeft");
      await expect.poll(() => inView(1)).toBe(true);

      // Library, from the keyboard: the cover that opened the book has the keyboard again.
      await reader.getByRole("button", { name: "Library", exact: true }).focus();
      await tab.keyboard.press("Enter");
      await expect.poll(() => reader.count()).toBe(0);
      await expect
        .poll(() => cover.evaluate((element) => element === element.ownerDocument.activeElement))
        .toBe(true);
    },
    60_000,
  );

  it.runIf(available)(
    "brings forward the window that Tab and Shift-Tab move the keyboard into",
    async () => {
      await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const cover = tab.getByRole("button", { name: /^The Handbook, / });
      await cover.focus();
      await tab.keyboard.press("Enter");
      const library = tab.getByRole("region", { name: "Books", exact: true });
      const reader = tab.getByRole("region", { name: "The Handbook" });
      const state = (window: typeof reader) => window.getAttribute("data-window-state");
      const holds = (window: typeof reader) =>
        window.evaluate((element) => element.contains(element.ownerDocument.activeElement));
      await expect.poll(() => holds(reader)).toBe(true);
      expect(await state(reader)).toBe("key");

      // Back out of the book window with Shift-Tab: the library comes to the front.
      for (let step = 0; step < 30 && (await holds(reader)); step++) {
        await tab.keyboard.press("Shift+Tab");
      }
      expect(await holds(library)).toBe(true);
      await expect.poll(() => state(library)).toBe("key");
      expect(await state(reader)).toBe("inactive");

      // And into it again with Tab: the book window comes back to the front.
      for (let step = 0; step < 60 && !(await holds(reader)); step++) {
        await tab.keyboard.press("Tab");
      }
      expect(await holds(reader)).toBe(true);
      await expect.poll(() => state(reader)).toBe("key");
      expect(await state(library)).toBe("inactive");
    },
    60_000,
  );

  it.runIf(available)(
    "draws the book window at its offset from the library in a container that is not positioned, and the front window over the other",
    async () => {
      await tab.goto(`${origin}/?example=${CONTAINER}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const library = tab.getByRole("region", { name: "Books", exact: true });
      const reader = tab.getByRole("region", { name: "Aqua and Bondi" });
      // In the example's own element, which is set in from the positioned one around it.
      expect(
        await reader.evaluate((element) =>
          element.parentElement?.classList.contains("books-example-container"),
        ),
      ).toBe(true);

      // Where the windows are drawn, not their inline coordinates: 72 by 56 apart.
      const offset = async () => {
        const from = await library.boundingBox();
        const to = await reader.boundingBox();
        if (!from || !to) throw new Error("a window is not drawn");
        return { x: to.x - from.x, y: to.y - from.y };
      };
      await expect.poll(async () => Math.abs((await offset()).x - 72)).toBeLessThan(0.5);
      expect(Math.abs((await offset()).y - 56)).toBeLessThan(0.5);

      // The library has a zIndex of its own; the window in front is drawn over the other.
      const book = await reader.boundingBox();
      const shelf = await library.boundingBox();
      if (!book || !shelf) throw new Error("a window is not drawn");
      const both = { x: book.x + 40, y: book.y + 40 };
      const drawn = () =>
        tab.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          if (element?.closest(".mac-books-reader")) return "book";
          return element?.closest(".mac-books") ? "library" : "none";
        }, both);
      expect(await drawn()).toBe("book");
      // A press on the library where the book window is not brings the library forward.
      await tab.mouse.click(shelf.x + 20, shelf.y + 120);
      await expect.poll(drawn).toBe("library");
      // And the keyboard moving into the book window brings it back.
      await reader.getByRole("button", { name: "Page 2", exact: true }).focus();
      await expect.poll(drawn).toBe("book");
      // It stays where it was put while the windows change places.
      expect(Math.abs((await offset()).x - 72)).toBeLessThan(0.5);
      expect(Math.abs((await offset()).y - 56)).toBeLessThan(0.5);
      // Both stand on the caller's level, var(--books-layer) set on the library alone (10).
      const level = (window: typeof reader) =>
        window.evaluate((element) => Number(getComputedStyle(element).zIndex));
      expect(await level(library)).toBeGreaterThanOrEqual(11);
      expect(await level(reader)).toBeGreaterThan(await level(library));
    },
    60_000,
  );

  it.runIf(available)(
    "keeps the book window at its offset when the library's container scrolls or changes size, with no render",
    async () => {
      await tab.goto(`${origin}/?example=${CONTAINER}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const library = tab.getByRole("region", { name: "Books", exact: true });
      const reader = tab.getByRole("region", { name: "Aqua and Bondi" });
      const offset = async () => {
        const from = await library.boundingBox();
        const to = await reader.boundingBox();
        if (!from || !to) throw new Error("a window is not drawn");
        return { x: to.x - from.x, y: to.y - from.y };
      };
      await expect.poll(async () => Math.abs((await offset()).x - 72)).toBeLessThan(0.5);
      // The container becomes a box of its own, which scrolls; the book window, placed against
      // the positioned element around it, does not move with it unless it is measured again.
      await tab.evaluate(() => {
        const container = document.querySelector(".books-example-container") as HTMLElement;
        Object.assign(container.style, { height: "320px", overflow: "auto" });
      });
      await expect.poll(async () => Math.abs((await offset()).y - 56)).toBeLessThan(0.5);
      await tab.evaluate(() => {
        const container = document.querySelector(".books-example-container") as HTMLElement;
        container.scrollTop = 120;
      });
      await expect.poll(async () => Math.abs((await offset()).y - 56)).toBeLessThan(0.5);
      expect(Math.abs((await offset()).x - 72)).toBeLessThan(0.5);
    },
    60_000,
  );

  it.runIf(available)(
    "draws the book window at its offset, at the body's scale, in a scaled body",
    async () => {
      await tab.goto(`${origin}/?example=${BODY}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      await tab.evaluate(() => {
        document.body.style.transformOrigin = "30px 40px";
        document.body.style.transform = "scale(0.5)";
      });
      const cover = tab.getByRole("button", { name: /^The Handbook, / });
      await cover.focus();
      await tab.keyboard.press("Enter");
      const library = tab.getByRole("region", { name: "Books", exact: true });
      const reader = tab.getByRole("region", { name: "The Handbook" });
      expect(
        await reader.evaluate((element) => element.parentElement === element.ownerDocument.body),
      ).toBe(true);
      // On screen: 72 by 56 points at half size.
      const offset = async () => {
        const from = await library.boundingBox();
        const to = await reader.boundingBox();
        if (!from || !to) throw new Error("a window is not drawn");
        return { x: to.x - from.x, y: to.y - from.y };
      };
      await expect.poll(async () => Math.abs((await offset()).x - 36)).toBeLessThan(0.5);
      expect(Math.abs((await offset()).y - 28)).toBeLessThan(0.5);
      await tab.evaluate(() => {
        document.body.style.transform = "";
        document.body.style.transformOrigin = "";
      });
    },
    60_000,
  );

  it.runIf(available)(
    "places the book window, settled, in a body that is turned and scaled small",
    async () => {
      await tab.goto(`${origin}/?example=${BODY}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const cover = tab.getByRole("button", { name: /^The Handbook, / });
      await cover.focus();
      try {
        // Its axes move less across than half a pixel, but more across than along.
        await tab.evaluate(() => {
          document.body.style.transform = "matrix(0.02, 0.04, 0.04, 0.02, 0, 0)";
        });
        await tab.keyboard.press("Enter");
        const reader = tab.getByRole("region", { name: "The Handbook" });
        await expect.poll(() => reader.count()).toBe(1);
        const place = () =>
          reader.evaluate(
            (element) =>
              new Promise<number[]>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() =>
                    resolve([
                      Number.parseFloat((element as HTMLElement).style.left),
                      Number.parseFloat((element as HTMLElement).style.top),
                    ]),
                  ),
                ),
              ),
          );
        const first = await place();
        expect(await place()).toEqual(first);
        expect(await place()).toEqual(first);
        // Placed where the library window is, not run off towards the layout's limits.
        for (const value of first) expect(Math.abs(value)).toBeLessThan(100_000);
      } finally {
        await tab.evaluate(() => {
          document.body.style.transform = "";
        });
      }
    },
    60_000,
  );

  it.runIf(available)(
    "places the book window, settled, in a mirrored body",
    async () => {
      await tab.goto(`${origin}/?example=${BODY}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const errors: string[] = [];
      const listen = (error: Error) => errors.push(error.message);
      tab.on("pageerror", listen);
      const said = (message: { type(): string; text(): string }) => {
        if (message.type() === "error") errors.push(message.text());
      };
      tab.on("console", said);
      try {
        await tab.evaluate(() => {
          document.body.style.transform = "scaleX(-1)";
        });
        const cover = tab.getByRole("button", { name: /^The Handbook, / });
        await cover.focus();
        await tab.keyboard.press("Enter");
        const reader = tab.getByRole("region", { name: "The Handbook" });
        const library = tab.getByRole("region", { name: "Books", exact: true });
        await expect.poll(() => reader.count()).toBe(1);
        // Mirrored with the body: 72 points in from the library window's right edge, 56 down.
        const offset = async () => {
          const from = await library.boundingBox();
          const to = await reader.boundingBox();
          if (!from || !to) throw new Error("a window is not drawn");
          return { x: from.x + from.width - (to.x + to.width), y: to.y - from.y };
        };
        await expect.poll(async () => Math.abs((await offset()).x - 72)).toBeLessThan(0.5);
        expect(Math.abs((await offset()).y - 56)).toBeLessThan(0.5);
        // Its place settles: the same over several frames, and nothing reported.
        const place = () =>
          reader.evaluate(
            (element) =>
              new Promise<string>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() =>
                    resolve(
                      `${(element as HTMLElement).style.left} ${(element as HTMLElement).style.top}`,
                    ),
                  ),
                ),
              ),
          );
        const first = await place();
        expect(await place()).toBe(first);
        expect(await place()).toBe(first);
        expect(errors.filter((text) => /Maximum update depth/.test(text))).toEqual([]);
      } finally {
        tab.off("pageerror", listen);
        tab.off("console", said);
        await tab.evaluate(() => {
          document.body.style.transform = "";
        });
      }
    },
    60_000,
  );

  it.runIf(available)(
    "draws the book window's box at its offset in a mirrored body, whatever its margin and transform",
    async () => {
      // Mirrored across, and across and down: the offset runs from the library window's corner
      // on the body's origin side, along the body's own axes.
      for (const mirror of ["scaleX(-1)", "scale(-1, -1)"]) {
        await tab.goto(`${origin}/?example=${BODY}&appearance=light`);
        await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
        try {
          await tab.evaluate((transform) => {
            document.body.style.transform = transform;
            // A margin and a transform of the book window's own, from a style sheet.
            const sheet = document.createElement("style");
            sheet.id = "books-test-reader-shift";
            sheet.textContent =
              ".mac-books-reader { margin: 12px 0 0 20px; transform: translate(30px, 20px); }";
            document.head.append(sheet);
          }, mirror);
          const cover = tab.getByRole("button", { name: /^The Handbook, / });
          await cover.focus();
          await tab.keyboard.press("Enter");
          const reader = tab.getByRole("region", { name: "The Handbook" });
          const library = tab.getByRole("region", { name: "Books", exact: true });
          await expect.poll(() => reader.count()).toBe(1);
          // The margin and the transform are still the window's: allowed for, not removed.
          expect(
            await reader.evaluate((element) => {
              const style = getComputedStyle(element);
              return [style.marginTop, style.marginLeft, style.transform];
            }),
          ).toEqual(["12px", "20px", "matrix(1, 0, 0, 1, 30, 20)"]);
          const down = mirror !== "scaleX(-1)";
          const offset = async () => {
            const from = await library.boundingBox();
            const to = await reader.boundingBox();
            if (!from || !to) throw new Error("a window is not drawn");
            return {
              x: from.x + from.width - (to.x + to.width),
              y: down ? from.y + from.height - (to.y + to.height) : to.y - from.y,
            };
          };
          await expect.poll(async () => Math.abs((await offset()).x - 72)).toBeLessThan(0.5);
          await expect.poll(async () => Math.abs((await offset()).y - 56)).toBeLessThan(0.5);
          // Its place settles: the same over several frames.
          const place = () =>
            reader.evaluate(
              (element) =>
                new Promise<string>((resolve) =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() =>
                      resolve(
                        `${(element as HTMLElement).style.left} ${(element as HTMLElement).style.top}`,
                      ),
                    ),
                  ),
                ),
            );
          const first = await place();
          expect(await place()).toBe(first);
          expect(await place()).toBe(first);
        } finally {
          await tab.evaluate(() => {
            document.body.style.transform = "";
            document.getElementById("books-test-reader-shift")?.remove();
          });
        }
      }
    },
    60_000,
  );

  it.runIf(available)(
    "draws the book window's box at its offset whatever its margin and transform, and the front window over the other from a container that is a stacking context",
    async () => {
      await tab.goto(`${origin}/?example=${STACKED}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const library = tab.getByRole("region", { name: "Books", exact: true });
      const reader = tab.getByRole("region", { name: "Aqua and Bondi" });
      // In the layer after the library, which is a stacking context at level 0.
      expect(
        await reader.evaluate((element) => {
          const layer = element.parentElement as HTMLElement;
          const style = getComputedStyle(layer);
          return layer.classList.contains("books-example-layer") && style.zIndex === "0";
        }),
      ).toBe(true);
      // The margin and the transform are still the window's: they are allowed for, not removed.
      expect(
        await reader.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.marginTop, style.marginLeft, style.transform];
        }),
      ).toEqual(["12px", "20px", "matrix(1, 0, 0, 1, 30, 20)"]);

      // The box on the screen, not the inline coordinates: 72 by 56 from the library's.
      const offset = async () => {
        const from = await library.boundingBox();
        const to = await reader.boundingBox();
        if (!from || !to) throw new Error("a window is not drawn");
        return { x: to.x - from.x, y: to.y - from.y };
      };
      await expect.poll(async () => Math.abs((await offset()).x - 72)).toBeLessThan(0.5);
      expect(Math.abs((await offset()).y - 56)).toBeLessThan(0.5);

      const book = await reader.boundingBox();
      const shelf = await library.boundingBox();
      if (!book || !shelf) throw new Error("a window is not drawn");
      const both = { x: book.x + 40, y: book.y + 40 };
      const drawn = () =>
        tab.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          if (element?.closest(".mac-books-reader")) return "book";
          return element?.closest(".mac-books") ? "library" : "none";
        }, both);
      // The book is in front, although the library's own level (11) is above the layer's.
      await expect.poll(drawn).toBe("book");
      await tab.mouse.click(shelf.x + 20, shelf.y + 120);
      await expect.poll(drawn).toBe("library");
      await reader.getByRole("button", { name: "Page 2", exact: true }).focus();
      await expect.poll(drawn).toBe("book");
      // Still where it was put, after the windows changed places.
      expect(Math.abs((await offset()).x - 72)).toBeLessThan(0.5);
      expect(Math.abs((await offset()).y - 56)).toBeLessThan(0.5);
    },
    60_000,
  );

  it.runIf(available)(
    "keeps the front window over the other whatever makes the container a stacking context, at any level",
    async () => {
      // The layer the book window is in, restyled: most make it a stacking context.
      const cases: {
        name: string;
        style: Record<string, string>;
        first?: boolean;
        css?: string;
        opaque?: boolean;
      }[] = [
        // A z-index that does not apply (static, not a flex or grid item): level 0, not 11.
        {
          name: "transform",
          style: { position: "static", transform: "translateX(0px)", zIndex: "11" },
        },
        { name: "will-change", style: { position: "static", willChange: "clip-path" } },
        // Not stacking contexts: a will-change name that only contains a stacking property's,
        // and a size container (containment no longer makes one).
        {
          name: "will-change, other name",
          style: { position: "static", willChange: "foo-transform" },
        },
        { name: "container-type", style: { position: "static", containerType: "size" } },
        // No level is above the highest, nor below the lowest.
        { name: "highest, later", style: { zIndex: "2147483647" } },
        { name: "lowest, earlier", style: { zIndex: "-2147483648" }, first: true },
        // Stacking contexts the computed style does not tell: the drawn order is measured.
        { name: "preserve-3d", style: { position: "static", transformStyle: "preserve-3d" } },
        {
          // Its paint containment clips the book window to the layer, so the layer is laid
          // where the book window is drawn: 72 by 56 from the library, 600 by 480.
          name: "content-visibility",
          style: {
            position: "static",
            contentVisibility: "auto",
            marginTop: "-504px",
            marginLeft: "72px",
            width: "600px",
            height: "480px",
          },
        },
        {
          // An opacity animation that has ended at 1 and is kept by its forwards fill.
          name: "animation",
          style: { position: "static", animation: "books-test-fade 1ms forwards" },
          css: "@keyframes books-test-fade { from { opacity: 0.5 } to { opacity: 1 } }",
        },
        // An earlier container at level 0 in a parent with a background of its own: the
        // library cannot go below 0 without going under that background, so the book
        // window is rendered beside it, and both stay in view.
        {
          name: "earlier, level 0, opaque parent",
          style: { zIndex: "0" },
          first: true,
          opaque: true,
        },
      ];
      for (const { name, style, first, css, opaque } of cases) {
        await tab.goto(`${origin}/?example=${STACKED}&appearance=light`);
        await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
        await tab.evaluate(
          async ({ style, first, css, opaque }) => {
            const layer = document.querySelector(".books-example-layer") as HTMLElement;
            if (css) {
              const sheet = document.createElement("style");
              sheet.textContent = css;
              document.head.append(sheet);
            }
            Object.assign(layer.style, style);
            if (opaque && layer.parentElement) layer.parentElement.style.background = "white";
            if (first)
              layer.parentElement?.insertBefore(layer, document.querySelector(".mac-books"));
            await Promise.all(layer.getAnimations().map((animation) => animation.finished));
          },
          { style, first, css, opaque },
        );
        const library = tab.getByRole("region", { name: "Books", exact: true });
        const reader = tab.getByRole("region", { name: "Aqua and Bondi" });
        const shelf = await library.boundingBox();
        if (!shelf) throw new Error("the library window is not drawn");
        // A press on the library brings it forward (and renders Books with the new style).
        await tab.mouse.click(shelf.x + 20, shelf.y + 120);
        const offset = async () => {
          const from = await library.boundingBox();
          const to = await reader.boundingBox();
          if (!from || !to) throw new Error("a window is not drawn");
          return { x: to.x - from.x, y: to.y - from.y };
        };
        await expect
          .poll(async () => Math.abs((await offset()).x - 72), { message: name })
          .toBeLessThan(0.5);
        expect(Math.abs((await offset()).y - 56), name).toBeLessThan(0.5);
        const book = await reader.boundingBox();
        if (!book) throw new Error("the book window is not drawn");
        const drawn = () =>
          tab.evaluate(
            ({ x, y }) => {
              const element = document.elementFromPoint(x, y);
              if (element?.closest(".mac-books-reader")) return "book";
              return element?.closest(".mac-books") ? "library" : "none";
            },
            { x: book.x + 40, y: book.y + 40 },
          );
        await expect.poll(drawn, { message: name }).toBe("library");
        await reader.getByRole("button", { name: "Page 2", exact: true }).focus();
        await expect.poll(drawn, { message: name }).toBe("book");
        // The library is still seen where the book window is not.
        expect(
          await tab.evaluate(
            ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".mac-books")),
            { x: shelf.x + 20, y: shelf.y + 120 },
          ),
          name,
        ).toBe(true);
        await tab.mouse.click(shelf.x + 20, shelf.y + 120);
        await expect.poll(drawn, { message: name }).toBe("library");
      }
    },
    120_000,
  );

  it.runIf(available)(
    "measures the order again when windows rendered out of view are scrolled into it",
    async () => {
      await tab.goto(`${origin}/?example=${STACKED}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      // A layer whose stacking context computed style does not tell, and the example pushed
      // below the view; the book is brought to the front there, without scrolling.
      await tab.evaluate(() => {
        const layer = document.querySelector(".books-example-layer") as HTMLElement;
        Object.assign(layer.style, { position: "static", transformStyle: "preserve-3d" });
        const outer = layer.parentElement as HTMLElement;
        outer.style.marginTop = "2000px";
        outer.style.marginBottom = "2000px";
        window.scrollTo(0, 0);
        document.querySelector<HTMLElement>(".mac-books input")?.focus({ preventScroll: true });
      });
      await tab.evaluate(() => {
        document
          .querySelector<HTMLElement>('.mac-books-reader [data-page="2"]')
          ?.focus({ preventScroll: true });
      });
      const reader = tab.getByRole("region", { name: "Aqua and Bondi" });
      await expect.poll(() => reader.getAttribute("data-window-state")).toBe("key");
      // Into view, with no render of Books.
      await tab.evaluate(() => {
        document.querySelector(".mac-books")?.scrollIntoView({ block: "start" });
      });
      const drawn = () =>
        tab.evaluate(() => {
          const book = document.querySelector(".mac-books-reader") as HTMLElement;
          const box = book.getBoundingClientRect();
          const element = document.elementFromPoint(box.left + 40, box.top + 40);
          if (element?.closest(".mac-books-reader")) return "book";
          return element?.closest(".mac-books") ? "library" : "none";
        });
      await expect.poll(drawn).toBe("book");
    },
    60_000,
  );

  it.runIf(available)(
    "measures the order where the windows' shared part is in view, when only a strip of it is",
    async () => {
      await tab.goto(`${origin}/?example=${STACKED}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      await tab.evaluate(() => {
        const layer = document.querySelector(".books-example-layer") as HTMLElement;
        Object.assign(layer.style, { position: "static", transformStyle: "preserve-3d" });
        const outer = layer.parentElement as HTMLElement;
        outer.style.marginTop = "2000px";
        outer.style.marginBottom = "2000px";
        window.scrollTo(0, 0);
        document.querySelector<HTMLElement>(".mac-books input")?.focus({ preventScroll: true });
      });
      await tab.evaluate(() => {
        document
          .querySelector<HTMLElement>('.mac-books-reader [data-page="2"]')
          ?.focus({ preventScroll: true });
      });
      const reader = tab.getByRole("region", { name: "Aqua and Bondi" });
      await expect.poll(() => reader.getAttribute("data-window-state")).toBe("key");
      // Only the top 24 pixels of the book window come into view.
      await tab.evaluate(() => {
        const book = document.querySelector(".mac-books-reader") as HTMLElement;
        window.scrollBy(0, book.getBoundingClientRect().top - (window.innerHeight - 24));
      });
      const drawn = () =>
        tab.evaluate(() => {
          const book = document.querySelector(".mac-books-reader") as HTMLElement;
          const box = book.getBoundingClientRect();
          const element = document.elementFromPoint(box.left + 40, box.top + 12);
          if (element?.closest(".mac-books-reader")) return "book";
          return element?.closest(".mac-books") ? "library" : "none";
        });
      await expect.poll(drawn).toBe("book");
    },
    60_000,
  );

  it.runIf(available)(
    "sets the library's level against a container that a mask border makes a stacking context, where the engine has one",
    async () => {
      await tab.goto(`${origin}/?example=${STACKED}&appearance=light`);
      await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
      const supported = await tab.evaluate(() => {
        const layer = document.querySelector(".books-example-layer") as HTMLElement;
        layer.style.position = "static";
        layer.style.zIndex = "";
        const source = "linear-gradient(black, black)";
        const names = ["mask-border-source", "-webkit-mask-box-image-source"];
        const name = names.find((each) => CSS.supports(each, source));
        if (name) layer.style.setProperty(name, source);
        return Boolean(name);
      });
      const library = tab.getByRole("region", { name: "Books", exact: true });
      const reader = tab.getByRole("region", { name: "Aqua and Bondi" });
      // Render with the new style: the library brought forward, then the book.
      const shelf = await library.boundingBox();
      if (!shelf) throw new Error("the library window is not drawn");
      await tab.mouse.click(shelf.x + 20, shelf.y + 120);
      await reader.getByRole("button", { name: "Page 2", exact: true }).focus();
      const level = () => library.evaluate((element) => getComputedStyle(element).zIndex);
      // Against the layer's level 0, which comes after it: the same level, so the layer is
      // drawn over it. Without a mask border the layer is no stacking context, and the
      // library stands on the caller's level, 11, and one more.
      await expect.poll(level).toBe(supported ? "0" : "12");
    },
    60_000,
  );
});
