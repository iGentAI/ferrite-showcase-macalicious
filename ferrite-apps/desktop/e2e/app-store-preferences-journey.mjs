#!/usr/bin/env node
// App Store's Preferences: opened from the menu and Command-comma, its one live choice kept on the
// server and said on the Updates page, the others dimmed with a reason.
//
//   node e2e/app-store-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, until } from "./media-census-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const { base, out } = options();
const { step, run } = journey("app-store-preferences", { ignoreOtherOrigins: true });

async function openStore(page) {
  await launch(page, "App Store");
  const store = page.getByRole("region", { name: "App Store" }).first();
  await store.waitFor({ state: "visible", timeout: 15_000 });
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 15_000 });
  return store;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  let store = await openStore(page);
  await store
    .getByRole("treeitem", { name: /Updates/ })
    .first()
    .click();
  const onUpdates = (word) => store.getByText(`Automatic Updates is ${word}`);
  await onUpdates("on").waitFor({ timeout: 5_000 });
  step("a new person's Updates page says Automatic Updates is on", true);

  await chooseMenu(page, "App Store", "Preferences…");
  const automatic = page.getByRole("checkbox", { name: "Automatic Updates" });
  await automatic.waitFor({ timeout: 5_000 });
  step("App Store > Preferences… opens the window", await automatic.isChecked());
  for (const [name, reason] of [
    ["Automatically download apps purchased on other computers", /kept with your account/],
    ["Ask for feedback about apps", /do not ask/],
  ]) {
    const box = page.getByRole("checkbox", { name });
    step(
      `"${name}" is dimmed and says why`,
      (await box.isDisabled()) &&
        reason.test(
          (await box.locator("xpath=ancestor-or-self::*[@title][1]").getAttribute("title")) ?? "",
        ),
    );
  }
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "app-store-preferences.png"));

  await automatic.click();
  step(
    "turning it off is kept on the server",
    await until(async () => {
      const { json } = await api(page, "GET", SETTINGS);
      return json.values?.["app-store.automaticUpdates"] === false;
    }, 5_000),
  );
  await onUpdates("off").waitFor({ timeout: 3_000 });
  step("the Updates page follows it at once", true);

  await page.waitForTimeout(800);
  await reloadDesktop(page);
  store = await openStore(page);
  await onUpdates("off").waitFor({ timeout: 10_000 });
  step("it survives a reload", true);
  await page.keyboard.press("ControlOrMeta+,");
  const again = page.getByRole("checkbox", { name: "Automatic Updates" });
  await again.waitFor({ timeout: 5_000 });
  step("Command-comma opens the window, showing it off", !(await again.isChecked()));
  await closeMenus(page);
});

process.exit(0);
