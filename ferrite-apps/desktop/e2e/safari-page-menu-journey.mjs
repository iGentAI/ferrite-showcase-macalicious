#!/usr/bin/env node
// Safari's menus inside a page on Ferrite: a right-click in the real page's frame opens the menu of
// what is under it, and its commands act, each read back from the server or the window.
//
//   node e2e/safari-page-menu-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { closeMenus, plainSpot } from "./media-census-kit.mjs";

const PAGE = "news.ycombinator.com";
const { base, out } = options();
const { step, run } = journey("safari-page-menu", { ignoreOtherOrigins: true });
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

const fieldOf = (window) =>
  window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
const item = (page, name) => page.getByRole("menuitem", { name, exact: true });

await run(async (page) => {
  // A request under way when the window closes is the window's to cut short, which counts as a
  // failed request: the journey waits for the tab it opened before it closes the window.
  const loading = new Set();
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/safari/page") loading.add(request);
  });
  for (const end of ["requestfinished", "requestfailed"]) {
    page.on(end, (request) => loading.delete(request));
  }
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await fieldOf(window).fill(PAGE);
  await page.keyboard.press("Enter");
  await window.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  await page.waitForTimeout(600);
  const frame = window.frameLocator("iframe[srcdoc]");

  // ---- A link ---------------------------------------------------------------------------------
  const story = frame.locator("a[data-safari-href]", { hasText: /\w{12}/ }).first();
  const storyUrl = await story.getAttribute("data-safari-href");
  await story.click({ button: "right" });
  await item(page, "Open Link").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-link-page-menu.png"));
  step("a right-click on a link opens the link's menu", true);
  await item(page, "Add Link to Reading List").click();
  await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);
  await page.waitForTimeout(1_500);
  const reading = (await api(page, "GET", "/api/safari/reading-list")).json;
  step(
    "Add Link to Reading List keeps it on the server",
    JSON.stringify(reading).includes(storyUrl),
    JSON.stringify(reading).slice(0, 160),
  );

  await story.click({ button: "right" });
  await item(page, "Open Link in New Tab").click();
  await window.getByRole("tab").nth(1).waitFor({ timeout: 10_000 });
  step("Open Link in New Tab opens a tab", true);
  await window.getByRole("tab").first().click();
  await page.waitForTimeout(600);

  // ---- Selected text --------------------------------------------------------------------------
  await story.evaluate((anchor) => {
    const range = document.createRange();
    range.selectNodeContents(anchor);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await story.click({ button: "right" });
  await item(page, "Copy").waitFor({ timeout: 5_000 });
  step("with text selected the menu has Copy", await item(page, "Copy").isVisible());
  await item(page, "Services").hover();
  await item(page, "Search the Web").waitFor({ timeout: 5_000 });
  step("and Services for what the page has selected", true);
  await closeMenus(page);

  // ---- A download that is refused says so -----------------------------------------------------
  await page.evaluate(() => {
    const real = window.fetch;
    window.fetch = async (...args) => {
      if (String(args[0]).includes("/api/safari/file")) {
        return new Response(JSON.stringify({ ok: false, kind: "too-large" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return real(...args);
    };
  });
  await story.click({ button: "right" });
  await item(page, "Download Linked File").click();
  const refused = page.getByRole("dialog", { name: "Safari could not save the file" });
  await refused.waitFor({ timeout: 5_000 });
  step(
    "a refused download says so, and adds nothing",
    (await window.getByRole("button", { name: "Downloads", exact: true }).count()) === 0,
  );
  await refused.getByRole("button", { name: "OK", exact: true }).click();
  await page.evaluate(() => {
    const real = window.fetch;
    window.fetch = async (...args) => {
      if (String(args[0]).includes("/api/safari/file")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: "***not base64***",
            name: "x.bin",
            url: "https://a.test/",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return real(...args);
    };
  });
  await story.click({ button: "right" });
  await item(page, "Download Linked File").click();
  await refused.waitFor({ timeout: 5_000 });
  step(
    "a reply that cannot be read says so too, and adds nothing",
    (await window.getByRole("button", { name: "Downloads", exact: true }).count()) === 0,
  );
  await refused.getByRole("button", { name: "OK", exact: true }).click();
  await frame.locator("body").evaluate(() => getSelection().removeAllRanges());

  // ---- The page -------------------------------------------------------------------------------
  const box = await window.locator("iframe[srcdoc]").boundingBox();
  const spot = await plainSpot(frame);
  await frame.locator("html").click({ button: "right", position: spot });
  await item(page, "Reload Page").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-page-menu.png"));
  step("a right-click on the page opens the page's menu", true);
  await page.mouse.click(box.x + spot.x, box.y + spot.y);
  await item(page, "Reload Page").waitFor({ state: "detached", timeout: 5_000 });
  step("a press in the page closes it", true);

  // ---- A key from inside the page -------------------------------------------------------------
  for (let waited = 0; loading.size > 0 && waited < 15_000; waited += 100) {
    await page.waitForTimeout(100);
  }
  await frame.locator("html").click({ position: spot });
  await page.keyboard.press(`${COMMAND}+Shift+w`);
  await window.waitFor({ state: "detached", timeout: 5_000 });
  step("Shift-Command-W closes the window from inside the page", true);
});

process.exit(0);
