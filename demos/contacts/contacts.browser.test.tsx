// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: that a real click on a name in the list brings that
 * contact's card, and no other, into the card pane; that a search filters the list that is
 * laid out and painted; and that what is typed into a card between Edit and Done is what the
 * finished card shows. The real window is served by the visual harness's page
 * (visual/harness), which renders one example with the library's stylesheets, and is driven
 * with real input in each engine Playwright has installed (`npm run visual:install` installs
 * Chromium); an engine that is not installed is skipped. Every case loads the page anew and
 * sets up the selection and the search it needs, so each passes when it is run alone. Set
 * REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and names each
 * one that is missing (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/contacts/examples/basic.tsx";
/** Longer than Vitest's 5 s, for a machine that is busy with other work. */
const WAIT = { timeout: 15_000 };

requireEveryEngine("the Contacts tests");

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

describe.each(Object.keys(ENGINES))("Contacts in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let context: BrowserContext | undefined;
  let tab: Page;

  /**
   * Loads the window anew, as it opens, in a page and a browser context of its own: no case
   * starts from what another left, in the document or in the browser's storage.
   */
  const open = async () => {
    await context?.close();
    context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  };

  /**
   * What the window shows: the names listed, the ones selected, the name on the card, the
   * text under it and every field of the finished card as "label: value".
   */
  const read = () =>
    tab.evaluate(() => {
      const text = (element: Element | null) => element?.textContent?.trim() ?? null;
      const options = [...document.querySelectorAll('.mac-contacts-list [role="option"]')];
      const card = document.querySelector(".mac-contacts-card");
      return {
        rows: options.map(text),
        selected: options.filter((row) => row.getAttribute("aria-selected") === "true").map(text),
        name: text(card?.querySelector("h2") ?? null),
        under: text(card?.querySelector(".mac-contacts-company") ?? null),
        fields: [...(card?.querySelectorAll('.mac-contacts-row[data-mode="view"]') ?? [])]
          .map(
            (row) =>
              `${text(row.querySelector(".mac-contacts-label")) ?? ""}: ${text(row.querySelector(".mac-contacts-value")) ?? ""}`,
          )
          .filter((field) => field !== "note: "),
      };
    });
  const row = (name: string) =>
    tab.locator(".mac-contacts-list").getByRole("option", { name, exact: true });
  /** Waits until the card of that name is the one shown, in view, and reads the window. */
  const named = async (name: string) => {
    await expect.poll(async () => (await read()).name, WAIT).toBe(name);
    // Shown, and not only in the document: the name on the card is visible.
    expect(await tab.locator(".mac-contacts-card h2").isVisible()).toBe(true);
    return read();
  };

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    // The first load builds the page; the cases then load it again in little time.
    await open();
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "opens on the captured contact's card, selected in the list",
    async () => {
      await open();
      const now = await named("Stephen Hackett");
      expect(now.rows).toEqual([
        "Apple Inc.",
        "Mara Delgado",
        "Stephen Hackett",
        "Island Post",
        "Tomas Lindqvist",
        "Ines Okafor",
        "Robin Vega",
        "Jun Watanabe",
      ]);
      expect(now.selected).toEqual(["Stephen Hackett"]);
      expect(now.fields).toEqual([": FaceTime", "work: stephen@example.com"]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "shows the card of the contact clicked in the list, and then of another",
    async () => {
      await open();
      await row("Ines Okafor").click();
      let now = await named("Ines Okafor");
      expect(now.selected).toEqual(["Ines Okafor"]);
      // Her card and nothing of the one that was shown: her company, numbers and address.
      expect(now.under).toBe("Harbor Ferry");
      expect(now.fields).toEqual([
        ": FaceTime",
        "mobile: (555) 010-0142",
        "work: (555) 010-0170",
        "work: ines@harborferry.example",
        "birthday: March 14",
        "note: Runs the Saturday crossings.",
      ]);

      await row("Apple Inc.").click();
      now = await named("Apple Inc.");
      expect(now.selected).toEqual(["Apple Inc."]);
      expect(now.under).toBeNull();
      expect(now.fields).toEqual([
        ": FaceTime",
        "main: 1-800-MY-APPLE",
        "home page: http://www.apple.com",
      ]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "lists the contacts a search finds, shows the first and then the one clicked",
    async () => {
      await open();
      // The window opens on Stephen Hackett's card, which the search does not find.
      await named("Stephen Hackett");
      await tab.getByRole("searchbox").fill("islandpost");
      // The card that was shown is not found: the first of the two that are is shown.
      let now = await named("Island Post");
      expect(now.rows).toEqual(["Island Post", "Jun Watanabe"]);
      expect(now.selected).toEqual(["Island Post"]);
      expect(now.fields).toEqual([
        ": FaceTime",
        "main: (555) 010-0100",
        "work: desk@islandpost.example",
      ]);
      // Two rows are laid out, and no third one is left painted under them.
      expect(await tab.locator('.mac-contacts-list [role="option"]').count()).toBe(2);

      await row("Jun Watanabe").click();
      now = await named("Jun Watanabe");
      expect(now.selected).toEqual(["Jun Watanabe"]);
      expect(now.fields).toEqual([
        ": FaceTime",
        "home: jun@watanabe.example",
        "work: jun.watanabe@islandpost.example",
        "note: Prefers email.",
      ]);
    },
    60_000,
  );

  it.skipIf(!available)(
    "shows on the finished card what was typed between Edit and Done",
    async () => {
      await open();
      // The card to edit, found by a search that stays on while it is edited.
      await tab.getByRole("searchbox").fill("islandpost");
      await named("Island Post");
      await row("Jun Watanabe").click();
      await named("Jun Watanabe");
      const size = (element: Element) => getComputedStyle(element).fontSize;
      const finished = await tab.locator(".mac-contacts-name").first().evaluate(size);
      await tab.getByRole("button", { name: "Edit", exact: true }).click();
      const last = tab.getByRole("textbox", { name: "Last", exact: true });
      await expect.poll(() => last.inputValue(), WAIT).toBe("Watanabe");
      // The name is edited in place in its own type, 18 pt, and each field is as wide as the
      // name in that type: nothing of it is cut.
      expect(finished).toBe("18px");
      for (const field of [tab.getByRole("textbox", { name: "First", exact: true }), last]) {
        expect(await field.evaluate(size)).toBe(finished);
        expect(await field.evaluate((input) => input.scrollWidth <= input.clientWidth)).toBe(true);
      }
      expect(await tab.getByRole("textbox", { name: "First", exact: true }).inputValue()).toBe(
        "Jun",
      );
      await last.fill("Tanabe");
      await tab
        .getByRole("textbox", { name: "home email", exact: true })
        .fill("jun@tanabe.example");
      // The empty field after the last number takes a new one.
      await tab.getByRole("textbox", { name: "mobile phone", exact: true }).fill("555 0123");
      await tab.getByRole("textbox", { name: "note", exact: true }).fill("Prefers the phone.");
      // The list follows the name while the card is edited.
      await expect.poll(async () => (await read()).selected, WAIT).toEqual(["Jun Tanabe"]);

      await tab.getByRole("button", { name: "Done", exact: true }).click();
      const now = await named("Jun Tanabe");
      expect(now.fields).toEqual([
        ": FaceTime",
        "mobile: 555 0123",
        "home: jun@tanabe.example",
        "work: jun.watanabe@islandpost.example",
        "note: Prefers the phone.",
      ]);
      // The search still finds the card by its other address, and it is still the one shown.
      expect(now.rows).toEqual(["Island Post", "Jun Tanabe"]);
      expect(now.selected).toEqual(["Jun Tanabe"]);
      expect(await tab.getByRole("textbox", { name: "Last", exact: true }).count()).toBe(0);

      // Another contact's card does not have what was typed, and this one keeps it.
      await row("Island Post").click();
      expect((await named("Island Post")).fields).toEqual([
        ": FaceTime",
        "main: (555) 010-0100",
        "work: desk@islandpost.example",
      ]);
      await row("Jun Tanabe").click();
      expect((await named("Jun Tanabe")).fields).toContain("note: Prefers the phone.");
    },
    60_000,
  );
});
