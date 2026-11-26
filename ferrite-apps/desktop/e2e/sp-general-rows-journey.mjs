#!/usr/bin/env node
// General's rows on the served desktop: Click in the scroll bar pages or jumps to the spot on a real list and keeps its
// choice across a reload, Default web browser offers only Safari and a web search from another part of the desktop
// opens in Safari, Handoff is dimmed with its reason. Exits 0 only when every step passed with no console error, page
// error, failed request or HTTP error. Simulated: only the page Safari fetches for the search, answered by a stand-in.
//
//   node e2e/sp-general-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const TABS = "/api/safari/tabs";

await journey("sp-general-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const openPane = async () => {
    await page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    const shown = prefs.getByRole("radio", { name: "Jump to the next page" });
    if ((await shown.count()) === 0) {
      await prefs.getByRole("button", { name: "General", exact: true }).first().click();
    }
    await shown.waitFor({ timeout: 8_000 });
  };
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json?.values?.[key];
  await openPane();

  // Handoff.
  const handoff = prefs.getByRole("checkbox", {
    name: "Allow Handoff between this Mac and your iCloud devices",
  });
  const handoffDimmed = async () =>
    (await handoff.getAttribute("aria-disabled")) === "true" &&
    (await handoff.getAttribute("aria-checked")) === "false";
  step("Handoff is dimmed and off", await handoffDimmed());
  const reason = "A web page cannot reach your other devices, so this stays off.";
  step("Handoff says why", await prefs.getByText(reason).isVisible());
  await page.screenshot({ path: path.join(out, "sp-general-pane.png") });

  // Default web browser.
  const browser = prefs.getByRole("combobox", { name: "Default web browser:" });
  step("the pop-up names Safari", /Safari/.test(await browser.innerText()));
  await browser.click();
  const offered = await page.getByRole("option").allInnerTexts();
  step(
    "Safari is the only browser offered",
    offered.length === 1 && offered[0].trim() === "Safari",
    offered.join(", "),
  );
  await page.keyboard.press("Escape");
  await page.getByRole("listbox").waitFor({ state: "detached", timeout: 3_000 });
  // Safari's fetch of the page itself stands in here: the search's site is not this journey's to reach.
  await page.route("**/api/safari/page**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Stand-in page</p>" }),
  );
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("default browser check");
  await page.getByRole("option", { name: /^Search the Web for/ }).waitFor({ timeout: 10_000 });
  await field.press("Enter");
  const safari = page.locator('[data-window-id="safari"]');
  await safari.waitFor({ state: "visible", timeout: 10_000 });
  step("a web search from Spotlight opens in Safari", await safari.isVisible());
  let tabs = [];
  for (let tries = 0; tries < 30 && tabs.length === 0; tries += 1) {
    await page.waitForTimeout(300);
    const open = (await api(page, "GET", TABS)).json?.tabs ?? [];
    tabs = open.filter((tab) => tab.includes("default+browser+check"));
  }
  step("Safari holds it as a tab", tabs.length === 1);

  // Scrollers show on a page only while scrolling, so Always makes them there to click.
  await openPane();
  let saved = nextSave(page, SETTINGS);
  await prefs.getByRole("radio", { name: "Always", exact: true }).click();
  await saved;
  step(
    "Click in the scroll bar starts on Jump to the next page",
    await prefs.getByRole("radio", { name: "Jump to the next page" }).isChecked(),
  );

  const trackClick = async () => {
    await openWithSpotlight(page, "Font Book");
    const list = page.locator(".mac-font-book-list").first();
    await list.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
    const scroller = list.locator('> .mac-scroll-view-scroller[data-orientation="vertical"]');
    const viewport = list.locator("> .mac-scroll-view-viewport");
    // The list fills as the fonts load: only then is there more than a page to scroll.
    await page.waitForFunction(() => {
      const shown = document.querySelector(".mac-font-book-list > .mac-scroll-view-viewport");
      return shown.scrollHeight > shown.clientHeight * 2;
    });
    await viewport.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.waitForTimeout(200);
    // The first press on a window behind others only brings it to the front.
    await page.locator('[data-window-id="font-book"]').click({ position: { x: 160, y: 10 } });
    await page.waitForTimeout(200);
    const box = await scroller.boundingBox();
    const y = box.y + box.height * 0.75;
    // A window that has just opened takes no press on its contents until it has settled.
    await page.waitForFunction(
      ([x, y]) => document.elementFromPoint(x, y)?.closest(".mac-scroll-view-scroller"),
      [box.x + box.width / 2, y],
    );
    await page.mouse.move(box.x + box.width / 2, y);
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width / 2, y);
    await page.waitForTimeout(300);
    return viewport.evaluate((element) => ({
      top: Math.round(element.scrollTop),
      page: element.clientHeight,
      max: element.scrollHeight - element.clientHeight,
    }));
  };

  const paged = await trackClick();
  step(
    "a press low on the track jumps one page down",
    paged.top === paged.page && paged.max > paged.page,
    JSON.stringify(paged),
  );

  await openPane();
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("radio", { name: "Jump to the spot that’s clicked" }).click();
  await saved;
  const spot = await trackClick();
  step(
    "with Jump to the spot, the same press goes to that spot",
    spot.top > spot.page * 1.5,
    JSON.stringify(spot),
  );

  await reloadDesktop(page);
  await page.waitForTimeout(1_000);
  step(
    "the choice is on the server after a reload",
    (await stored("general.scrollClick")) === "spot",
  );
  const again = await trackClick();
  step("and still acts after the reload", again.top > again.page * 1.5, JSON.stringify(again));

  await openPane();
  step(
    "the pane shows the choice after a reload",
    await prefs.getByRole("radio", { name: "Jump to the spot that’s clicked" }).isChecked(),
  );
  step("Handoff stays dimmed after a reload", await handoffDimmed());
});
