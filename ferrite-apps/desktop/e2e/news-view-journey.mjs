#!/usr/bin/env node
// News: the last view and whether the sidebar is hidden, kept on the server and over a reload.
//
//   node e2e/news-view-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("news-view", { ignoreOtherOrigins: true });
const SETTINGS = "/api/system-preferences/settings";

const openNews = async (page) => {
  await launch(page, "News");
  const window = page.getByRole("region", { name: "News", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
};

await run(async (page) => {
  await openDesktop(page, base, step);
  let window = await openNews(page);
  const row = (name) =>
    window.locator(".mac-catalyst-chrome-sidebar-item", { hasText: name }).first();
  await row("History").waitFor({ timeout: 15_000 });
  const selected = () =>
    window.locator('.mac-catalyst-chrome-sidebar-item[aria-current="page"]').first().innerText();
  step("a new person's window opens on Today", /Today/.test(await selected()), await selected());

  await row("History").click();
  step("choosing a row shows it", await until(async () => /History/.test(await selected()), 3_000));
  await chooseMenu(page, "View", "Hide Sidebar");
  step("View > Hide Sidebar hides it", await until(() => row("History").isHidden(), 3_000));
  step(
    "the server keeps the view and the sidebar",
    await until(async () => {
      const { json } = await api(page, "GET", SETTINGS);
      const kept = json.values?.["news.view"];
      return kept?.view?.kind === "history" && kept?.sidebarHidden === true;
    }, 5_000),
  );

  await reloadDesktop(page);
  window = await openNews(page);
  const again = await menuItemState(page, "View", "Show Sidebar");
  step(
    "after a reload the sidebar is still hidden",
    again.disabled !== true,
    JSON.stringify(again),
  );
  await chooseMenu(page, "View", "Show Sidebar");
  await row("History").waitFor({ timeout: 5_000 });
  step(
    "and the window is on the last view",
    await until(async () => /History/.test(await selected()), 5_000),
    await selected(),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "news-view-kept.png"));
});

process.exit(0);
