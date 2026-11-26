// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that a real click on a conversation brings that
 * conversation's transcript, and that a message typed with real key presses and sent with
 * Return becomes the last bubble of that conversation and of no other, in view, with
 * Delivered under it; and which of the app's two windows is painted over the other. The real
 * window is served by the visual harness's page (visual/harness), which renders one example
 * with the library's stylesheets, and is driven with real input in each engine Playwright has
 * installed (`npm run visual:install` installs Chromium); an engine that is not installed is
 * skipped. Every case loads its page anew, so none depends on what another did. "Shown" is
 * asserted as visible, not as present in the document. Set REQUIRE_BROWSER_TESTS=1 where the
 * engines must be there: the run then fails and names each one that is missing
 * (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/messages/examples/basic.tsx";
const DESKTOP = "demos/messages/examples/desktop.tsx";
const LEVEL = "demos/messages/examples/level.tsx";
const TEXT = "See you at the pier, 8:15?";
/** Longer than Vitest's 5 s, for a machine that is busy with other work. */
const WAIT = { timeout: 15_000 };

requireEveryEngine("the Messages tests");

// One server for the engines: each loads the same pages from it.
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

describe.each(Object.keys(ENGINES))("Messages in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let context: BrowserContext | undefined;
  let tab: Page;

  /**
   * Loads an example anew, in a page and a browser context of its own: every case starts
   * from the page as it opens, with nothing of another case in the browser's storage.
   */
  const open = async (example = EXAMPLE) => {
    await context?.close();
    context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${example}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  };

  /** What the window shows: the list's rows, the bar's recipient, the transcript, the field. */
  const read = () =>
    tab.evaluate(() => {
      const text = (element: Element | null | undefined) => element?.textContent ?? "";
      const box = (element: Element) => {
        const { top, bottom, left, right } = element.getBoundingClientRect();
        return { top, bottom, left, right };
      };
      const log = document.querySelector('[role="log"]');
      const items = [...(log?.querySelectorAll('[role="listitem"]') ?? [])].map((item) => {
        // A bubble says who wrote it, for a screen reader, before its text.
        const sender = text(item.querySelector(".mac-message-bubble-sender"));
        return {
          kind: item.classList.contains("mac-message-bubble")
            ? (item.getAttribute("data-direction") as string)
            : item.classList.contains("mac-message-bubble-status")
              ? "status"
              : "header",
          sender: sender.trim(),
          text: text(item).slice(sender.length).replace(/\s+/g, " ").trim(),
          box: box(item),
        };
      });
      const view = log?.closest(".mac-messages-transcript");
      const input = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message"]');
      return {
        rows: [...document.querySelectorAll('[role="option"]')].map((row) => ({
          name: text(row.querySelector(".mac-messages-row-name")),
          snippet: text(row.querySelector(".mac-messages-row-snippet")),
          time: text(row.querySelector(".mac-messages-row-time")),
          selected: row.getAttribute("aria-selected") === "true",
        })),
        recipient: text(document.querySelector(".mac-messages-header .mac-messages-recipient")),
        transcript: log?.getAttribute("aria-label"),
        items,
        view: view ? box(view) : null,
        field: input?.value,
        focused: document.activeElement === input,
      };
    });
  const row = (name: string) =>
    tab.locator('[role="option"]').filter({ has: tab.getByText(name, { exact: true }) });
  /**
   * Which window is painted at the middle of the part of the Preferences that is over the
   * Messages window, each window's state, and the level the browser computes for each.
   */
  const painted = () =>
    tab.evaluate(() => {
      const main = document.querySelector(".mac-messages") as HTMLElement;
      const other = document.querySelector(".mac-messages-preferences") as HTMLElement;
      const a = main.getBoundingClientRect();
      const b = other.getBoundingClientRect();
      const left = Math.max(a.left, b.left);
      const right = Math.min(a.right, b.right);
      const top = Math.max(a.top, b.top);
      const bottom = Math.min(a.bottom, b.bottom);
      const at = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      return {
        overlap: right - left > 100 && bottom - top > 100,
        over: at?.closest(".mac-messages-preferences")
          ? "preferences"
          : at?.closest(".mac-messages")
            ? "window"
            : "neither",
        states: [main.getAttribute("data-window-state"), other.getAttribute("data-window-state")],
        levels: [getComputedStyle(main).zIndex, getComputedStyle(other).zIndex],
      };
    });

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    // The first load compiles the page; the cases' own loads are then quick.
    await open();
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "opens on the conversation last heard from",
    async () => {
      await open();
      const now = await read();
      expect(now.rows.map((item) => item.name)).toEqual([
        "Ines Lindqvist",
        "Otis Brandt",
        "Mara Okafor",
        "Tomas Reyes",
        "Harbor Ferry",
      ]);
      expect(now.rows.filter((item) => item.selected).map((item) => item.name)).toEqual([
        "Ines Lindqvist",
      ]);
      expect(now.recipient).toBe("Ines Lindqvist");
      expect(now.items.at(-1)).toMatchObject({ kind: "received", text: "New macOS, who dis?" });
    },
    60_000,
  );

  it.skipIf(!available)(
    "shows the transcript of the conversation that is clicked",
    async () => {
      await open();
      await row("Otis Brandt").click();
      await expect.poll(async () => (await read()).recipient, WAIT).toBe("Otis Brandt");
      const now = await read();
      expect(now.rows.filter((item) => item.selected).map((item) => item.name)).toEqual([
        "Otis Brandt",
      ]);
      expect(now.transcript).toBe("Conversation with Otis Brandt");
      expect(now.items.map((item) => [item.kind, item.text])).toEqual([
        ["header", "iMessage with Otis Brandt Yesterday, 6:02 PM"],
        ["received", "Are we still on for the ferry on Saturday?"],
        ["sent", "Yes! The 8:40 crossing. I booked two seats."],
        ["sent", "Bring a jacket, the deck is windy."],
        ["status", "Delivered"],
        ["received", "Perfect. I'll bring the coffee."],
      ]);
      // What the other party wrote is said to be theirs.
      expect(now.items.at(-1)?.sender).toBe("Otis Brandt");
      // Shown, and not only in the document: the transcript and each of its bubbles, with
      // the status, are visible.
      const log = tab.getByRole("log", { name: "Conversation with Otis Brandt" });
      expect(await log.isVisible()).toBe(true);
      const bubbles = log.locator(".mac-message-bubble");
      expect(await bubbles.count()).toBe(4);
      for (const text of [
        "Are we still on for the ferry on Saturday?",
        "Yes! The 8:40 crossing. I booked two seats.",
        "Bring a jacket, the deck is windy.",
        "Perfect. I'll bring the coffee.",
      ]) {
        expect(await bubbles.filter({ hasText: text }).isVisible(), text).toBe(true);
      }
      expect(await log.getByText("Delivered", { exact: true }).isVisible()).toBe(true);
    },
    60_000,
  );

  it.skipIf(!available)(
    "sends what is typed into the selected conversation on Return, and into no other",
    async () => {
      await open();
      await row("Otis Brandt").click();
      await expect.poll(async () => (await read()).recipient, WAIT).toBe("Otis Brandt");
      const before = await read();
      await tab.locator('textarea[aria-label="Message"]').click();
      await tab.keyboard.type(TEXT);
      expect((await read()).field).toBe(TEXT);
      // Nothing is sent until Return.
      expect((await read()).items).toHaveLength(before.items.length);
      await tab.keyboard.press("Enter");
      await expect.poll(async () => (await read()).items.at(-1)?.text, WAIT).toBe("Delivered");

      const now = await read();
      // Still Otis's transcript, with everything it held before, in order.
      expect(now.recipient).toBe("Otis Brandt");
      expect(now.transcript).toBe("Conversation with Otis Brandt");
      expect(now.items.slice(0, 4).map((item) => item.text)).toEqual(
        before.items.slice(0, 4).map((item) => item.text),
      );
      // The message is its last bubble, a sent one, with exactly the text typed; it was
      // sent a day after the others, so a time stands over it, and the one status of the
      // transcript is under it.
      expect(now.items.slice(4).map((item) => [item.kind, item.text])).toEqual([
        ["received", "Perfect. I'll bring the coffee."],
        ["header", "Today, 3:27 PM"],
        ["sent", TEXT],
        ["status", "Delivered"],
      ]);
      const bubble = now.items.at(-2);
      const status = now.items.at(-1);
      expect(bubble?.sender).toBe("You");
      expect(now.items.filter((item) => item.kind === "status")).toHaveLength(1);
      expect(now.items.filter((item) => item.kind !== "header").at(-2)).toBe(bubble);
      // The new bubble and its status are visible, each once.
      const log = tab.getByRole("log", { name: "Conversation with Otis Brandt" });
      const sent = log.locator(".mac-message-bubble").filter({ hasText: TEXT });
      expect(await sent.count()).toBe(1);
      expect(await sent.isVisible()).toBe(true);
      const delivered = log.getByText("Delivered", { exact: true });
      expect(await delivered.count()).toBe(1);
      expect(await delivered.isVisible()).toBe(true);
      // On the page too: Delivered starts under the bubble, at its trailing side, and both
      // are in view, since the transcript scrolled to its end.
      const view = now.view as NonNullable<typeof now.view>;
      expect(status?.box.top).toBeGreaterThanOrEqual(bubble?.box.bottom as number);
      expect(status?.box.top).toBeLessThan((bubble?.box.bottom as number) + 8);
      expect(bubble?.box.right).toBeGreaterThan((view.left + view.right) / 2);
      expect(bubble?.box.top).toBeGreaterThanOrEqual(view.top);
      expect(status?.box.bottom).toBeLessThanOrEqual(view.bottom);

      // The field is empty and keeps the keyboard.
      expect(now.field).toBe("");
      expect(now.focused).toBe(true);
      // Its row shows the text, with the time, at the top of the list, still selected.
      expect(now.rows[0]).toEqual({
        name: "Otis Brandt",
        snippet: TEXT,
        time: "3:27 PM",
        selected: true,
      });
      // No other row changed.
      expect(now.rows.slice(1)).toEqual(before.rows.filter((item) => item.name !== "Otis Brandt"));

      // The other conversations' transcripts do not have the message.
      for (const name of ["Ines Lindqvist", "Mara Okafor", "Tomas Reyes", "Harbor Ferry"]) {
        await row(name).click();
        await expect.poll(async () => (await read()).recipient, WAIT).toBe(name);
        const other = await read();
        expect(other.transcript).toBe(`Conversation with ${name}`);
        expect(other.items.map((item) => item.text)).not.toContain(TEXT);
        expect(other.items.some((item) => item.text.includes("pier"))).toBe(false);
        expect(other.field).toBe("");
      }
      // And back: the message is where it was sent.
      await row("Otis Brandt").click();
      await expect.poll(async () => (await read()).recipient, WAIT).toBe("Otis Brandt");
      const back = await read();
      expect(back.items.at(-2)).toMatchObject({ kind: "sent", text: TEXT });
      expect(back.items.at(-1)).toMatchObject({ kind: "status", text: "Delivered" });
    },
    120_000,
  );

  it.skipIf(!available)(
    "keeps the selected conversation on the accent's selection without the keyboard and in a window that is not key",
    async () => {
      await open();
      // The colours of the selected row and of the row after it, and what the tokens the
      // list view draws an emphasised selection with compute to on this page.
      const colours = () =>
        tab.evaluate(() => {
          const colour = (element: Element | null, property: "color" | "backgroundColor") =>
            element ? getComputedStyle(element)[property] : "";
          const token = (name: string) => {
            const probe = document.createElement("span");
            probe.style.color = `var(${name})`;
            document.querySelector(".mac-messages-list-pane")?.append(probe);
            const value = getComputedStyle(probe).color;
            probe.remove();
            return value;
          };
          const of = (row: Element | null) => ({
            row: colour(row, "backgroundColor"),
            name: colour(row?.querySelector(".mac-messages-row-name") ?? null, "color"),
            time: colour(row?.querySelector(".mac-messages-row-time") ?? null, "color"),
            snippet: colour(row?.querySelector(".mac-messages-row-snippet") ?? null, "color"),
          });
          const rows = [...document.querySelectorAll('[role="option"]')];
          return {
            focusInList: document.activeElement?.closest(".mac-messages-list") != null,
            state: document.querySelector(".mac-messages")?.getAttribute("data-window-state"),
            selected: of(rows.find((row) => row.getAttribute("aria-selected") === "true") ?? null),
            other: of(rows.find((row) => row.getAttribute("aria-selected") !== "true") ?? null),
            selection: token("--mac-color-selected-content-background"),
            text: token("--mac-color-selected-content-text"),
            detail: token("--mac-list-view-detail-emphasized"),
            secondary: token("--mac-color-label-secondary"),
          };
        });
      const emphasised = (now: Awaited<ReturnType<typeof colours>>) => {
        expect(now.selected).toEqual({
          row: now.selection,
          name: now.text,
          time: now.detail,
          snippet: now.detail,
        });
        // The other rows are not on a selection: their time and last message are secondary.
        expect(now.other.time).toBe(now.secondary);
        expect(now.other.snippet).toBe(now.secondary);
        expect(now.other.row).not.toBe(now.selection);
        expect(now.detail).not.toBe(now.secondary);
      };
      // As the page opens nothing has the keyboard.
      const resting = await colours();
      expect(resting.focusInList).toBe(false);
      emphasised(resting);
      // A page gives the selection another colour through the token, set on the window.
      await tab.evaluate(() => {
        const main = document.querySelector<HTMLElement>(".mac-messages");
        main?.style.setProperty("--mac-color-selected-content-background", "rgb(1, 2, 3)");
      });
      const themed = await colours();
      expect(themed.selected.row).toBe("rgb(1, 2, 3)");
      expect(themed.selection).not.toBe(resting.selection);
      await tab.evaluate(() => {
        const main = document.querySelector<HTMLElement>(".mac-messages");
        main?.style.removeProperty("--mac-color-selected-content-background");
      });
      // Behind its Preferences the window is not key, and the selection is as it was.
      await tab.getByRole("button", { name: "Preferences…" }).click();
      await tab.waitForSelector(".mac-messages-preferences");
      await expect.poll(async () => (await colours()).state, WAIT).toBe("inactive");
      emphasised(await colours());
    },
    60_000,
  );

  it.skipIf(!available)(
    "paints the window that was pressed last over the other",
    async () => {
      await open();
      // The button under the window stands for the menu's Preferences command.
      await tab.getByRole("button", { name: "Preferences…" }).click();
      await tab.waitForSelector(".mac-messages-preferences");
      // They open in front, over the Messages window.
      const opened = await painted();
      expect(opened.overlap).toBe(true);
      expect(opened).toMatchObject({ over: "preferences", states: ["inactive", "key"] });
      // A real press on the Messages window, in the message field under the Preferences'
      // lower edge, brings it over them.
      await tab.locator('textarea[aria-label="Message"]').click();
      await expect.poll(async () => (await painted()).over, WAIT).toBe("window");
      expect((await painted()).states).toEqual(["key", "inactive"]);
      // The Preferences are still open under it, all of them behind the window: the
      // Preferences command brings them back over it.
      await tab.keyboard.press("Control+,");
      await expect.poll(async () => (await painted()).over, WAIT).toBe("preferences");
      expect((await painted()).states).toEqual(["inactive", "key"]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "stacks the Preferences around a level written with a custom property of the window",
    async () => {
      await open(LEVEL);
      await tab.waitForSelector(".mac-messages-preferences");
      // The property is the window's own: the Preferences, beside it, get the number the
      // browser computes for the window and one more, and are painted over it.
      await expect.poll(async () => (await painted()).levels, WAIT).toEqual(["40", "41"]);
      const opened = await painted();
      expect(opened.overlap).toBe(true);
      expect(opened.over).toBe("preferences");
      // Pressed, the window keeps its level and the Preferences go one under it.
      await tab.locator('textarea[aria-label="Message"]').click();
      await expect.poll(async () => (await painted()).levels, WAIT).toEqual(["40", "39"]);
      expect((await painted()).over).toBe("window");
    },
    60_000,
  );

  it.skipIf(!available)(
    "hosts the descriptor's Preferences in a managed window whose frame follows the pane",
    async () => {
      await open(DESKTOP);
      const frame = () =>
        tab.evaluate(() => {
          const wrapper = document.querySelector<HTMLElement>(
            '[data-window-id="messages-preferences"]',
          );
          const window = wrapper?.querySelector<HTMLElement>(".mac-messages-preferences");
          return {
            frame: [wrapper?.style.width, wrapper?.style.height],
            window: [window?.offsetWidth, window?.offsetHeight],
            state: window?.getAttribute("data-window-state"),
          };
        });
      // It opens at the frame the descriptor names, which is the size its first pane has.
      await expect.poll(async () => (await frame()).window, WAIT).toEqual([540, 309]);
      expect(await frame()).toMatchObject({ frame: ["540px", "309px"], state: "key" });
      // The other pane is taller: the window takes its height, and the frame with it.
      await tab.getByRole("tab", { name: "iMessage" }).click();
      await expect.poll(async () => (await frame()).frame[1], WAIT).not.toBe("309px");
      await expect
        .poll(async () => {
          const now = await frame();
          return now.frame[1] === `${now.window[1]}px`;
        }, WAIT)
        .toBe(true);
      expect((await frame()).window[1]).toBeGreaterThan(309);
      await tab.getByRole("tab", { name: "General" }).click();
      await expect.poll(async () => (await frame()).frame, WAIT).toEqual(["540px", "309px"]);
      // The slider of the hosted window sets the text of the Messages window's transcript.
      const size = () =>
        tab.evaluate(() => {
          const bubble = document.querySelector('[role="log"] .mac-message-bubble');
          return bubble ? getComputedStyle(bubble.lastElementChild ?? bubble).fontSize : null;
        });
      const slider = tab.getByRole("slider", { name: "Text size" });
      // It starts at the captured step, the fourth of seven, and the bubbles' own 13 pt.
      expect(await slider.inputValue()).toBe("3");
      expect(await size()).toBe("13px");
      await slider.focus();
      await tab.keyboard.press("End");
      await expect.poll(() => slider.inputValue(), WAIT).toBe("6");
      await expect.poll(size, WAIT).toBe("16px");
    },
    120_000,
  );
});
