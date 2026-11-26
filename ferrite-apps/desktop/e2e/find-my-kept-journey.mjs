#!/usr/bin/env node
// Find My: the last list, chosen device and map survive a reload, and what a web page cannot do
// stays in the menus, dimmed, saying why. The browser's location is fixed by the context.
//
//   node e2e/find-my-kept-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { closeMenus, menuItemState, until } from "./media-census-kit.mjs";

const LIBRARY = "/api/app-store/library";
const { base, out } = options();
const located = {
  permissions: ["geolocation"],
  geolocation: { latitude: 37.8199, longitude: -122.4783, accuracy: 25 },
};
const { step, run } = journey("find-my-kept", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: located },
});

async function openFindMy(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Find My");
  await page.waitForTimeout(300);
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Find My", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
}

const zoomOf = async (window) =>
  Number(
    /zoom (\d+)/.exec(
      await window.getByRole("application", { name: /^Map, zoom/ }).getAttribute("aria-label"),
    )?.[1],
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = await api(page, "GET", LIBRARY);
  await api(page, "PUT", LIBRARY, {
    installed: [...new Set([...(library.json.installed ?? []), "find-my"])],
    rev: library.json.rev,
  });
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  const window = await openFindMy(page);

  const share = await menuItemState(page, "File", "Share My Location");
  step(
    "File > Share My Location is dimmed and says why",
    share.disabled && /share/.test(share.title ?? ""),
    share.title,
  );
  await closeMenus(page);

  // ---- Choose a list, a device and a map ------------------------------------------------------
  await page.keyboard.press("ControlOrMeta+2");
  const row = window.locator("[data-index]").first();
  await row.waitFor({ timeout: 15_000 });
  await row.click();
  step(
    "the device is chosen",
    await until(async () => (await row.getAttribute("aria-selected")) === "true", 3_000),
  );
  await row.click({ button: "right" });
  const menu = page.getByRole("menu").last();
  await menu.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "find-my-device-menu.png"));
  for (const name of ["Notify When Found", "Mark As Lost", "Erase This Device"]) {
    const item = menu.getByRole("menuitem", { name, exact: true });
    step(
      `the device's ${name} is dimmed and says why`,
      (await item.getAttribute("aria-disabled")) === "true" &&
        /web page/.test((await item.getAttribute("title")) ?? ""),
    );
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+-");
  await page.keyboard.press("ControlOrMeta+-");
  await page.waitForTimeout(800);
  const zoom = await zoomOf(window);

  // ---- All of it survives a reload ------------------------------------------------------------
  await reloadDesktop(page);
  const again = await openFindMy(page);
  const rowAgain = again.locator("[data-index]").first();
  step("the Devices list is shown after a reload", await until(() => rowAgain.isVisible(), 15_000));
  step(
    "the device is still chosen",
    await until(async () => (await rowAgain.getAttribute("aria-selected")) === "true", 10_000),
  );
  step(
    "the map is where it was left, the browser's position moving it no more",
    await until(async () => (await zoomOf(again)) === zoom, 5_000),
    `zoom ${zoom}`,
  );
  await page.waitForTimeout(1_500);
  step("and it stays there", (await zoomOf(again)) === zoom);
  await shot(page, path.join(out, "find-my-kept.png"));
});

process.exit(0);
