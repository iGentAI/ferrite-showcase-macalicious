#!/usr/bin/env node
// The menu bar's key equivalents with nothing focused: on a fresh desktop and after the last window
// closes, Force Quit's key opens it from the page's body. With a window focused a command runs once
// per press, and a focused text field keeps the keys it types.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/desktop-keys-journey.mjs [--url http://127.0.0.1:3020] [--out dir]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-keys");

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Off Apple platforms Command is the Control key.
const FORCE_QUIT = process.platform === "darwin" ? "Meta+Alt+Escape" : "Control+Alt+Escape";
const MINIMIZE = process.platform === "darwin" ? "Meta+M" : "Control+M";

await run(async (page) => {
  await openDesktop(page, base, step);
  const windows = page.locator(".mac-window");
  const forceQuit = page.getByRole("region", { name: "Force Quit Applications" });
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const onBody = () => page.evaluate(() => document.activeElement === document.body);
  const closeAllWindows = async () => {
    for (let left = await windows.count(); left > 0; left = await windows.count()) {
      await windows.first().getByRole("button", { name: "Close" }).first().click();
      await until(async () => (await windows.count()) < left, 4_000);
    }
  };

  // A person whose windows came back has them closed first: the page is reloaded with none open.
  await closeAllWindows();
  await page.reload();
  await dock.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  step("A fresh desktop has no window", (await windows.count()) === 0);
  step("and the focus is on the page's body", await onBody());
  await page.keyboard.press(FORCE_QUIT);
  step(
    "Force Quit's key opens it there",
    await forceQuit.waitFor({ timeout: 4_000 }).then(
      () => true,
      () => false,
    ),
  );
  await shot(page, path.join(out, `desktop-keys-fresh-${browserName}.png`));

  await closeAllWindows();
  await launch(page, "Chess");
  await windows.first().waitFor({ timeout: 8_000 });
  await closeAllWindows();
  step("With the last window closed the focus is on the body", await onBody());
  await page.keyboard.press(FORCE_QUIT);
  step(
    "Force Quit's key still opens it",
    await forceQuit.waitFor({ timeout: 4_000 }).then(
      () => true,
      () => false,
    ),
  );
  await shot(page, path.join(out, `desktop-keys-last-closed-${browserName}.png`));
  await closeAllWindows();

  await launch(page, "Chess");
  await windows.first().waitFor({ timeout: 8_000 });
  await launch(page, "TextEdit");
  await until(async () => (await windows.count()) === 2);
  const editor = page.locator(".mac-window [contenteditable='true'], .mac-window textarea").first();
  await editor.click();
  await page.keyboard.type("typed here");
  step(
    "A focused text field keeps the keys it types",
    await until(async () =>
      (await editor.innerText().catch(() => editor.inputValue())).includes("typed here"),
    ),
  );
  await page.keyboard.press(MINIMIZE);
  await until(
    async () => (await dock.getByRole("button", { name: /minimized window/ }).count()) > 0,
  );
  await page.waitForTimeout(500);
  step(
    "With a window focused a command runs once per press",
    (await dock.getByRole("button", { name: /minimized window/ }).count()) === 1,
    `${await dock.getByRole("button", { name: /minimized window/ }).count()} minimized of 2`,
  );
  await shot(page, path.join(out, `desktop-keys-once-${browserName}.png`));

  // Escape from a menu: the keyboard is back in the window, and its keys are the window's again.
  await dock
    .getByRole("button", { name: /minimized window/ })
    .first()
    .click();
  await until(
    async () => (await dock.getByRole("button", { name: /minimized window/ }).count()) === 0,
  );
  await editor.click();
  await page.getByRole("menuitem", { name: "Format", exact: true }).first().click();
  await page.getByRole("menu").first().waitFor({ timeout: 4_000 });
  await page.keyboard.press("Escape");
  await page.keyboard.type("after escape");
  step(
    "After Escape closes a menu the window has the keyboard",
    await until(async () =>
      (await editor.innerText().catch(() => editor.inputValue())).includes("after escape"),
    ),
  );

  // A key wider than the column of keys shows whole.
  await launch(page, "Music");
  await page.getByRole("menuitem", { name: "Controls", exact: true }).first().click();
  const spaceKey = page.locator(".mac-menu-item-key-character", { hasText: /^Space$/ }).first();
  await spaceKey.waitFor({ timeout: 4_000 });
  const whole = await spaceKey.evaluate((element) => {
    const key = element.getBoundingClientRect();
    const menu = element.closest("[role='menu']")?.getBoundingClientRect();
    return Boolean(menu) && key.right <= menu.right && element.scrollWidth <= element.clientWidth;
  });
  step("The Space key shows whole in its menu", whole);
  await shot(page, path.join(out, `desktop-keys-space-${browserName}.png`));
  await page.keyboard.press("Escape");

  // A long account name keeps clear of the clock beside it. In a browser of its own: a page whose person changes
  // has its reads refused and loads again, as it should, which the journey's watch on this page would report.
  const browser = await page.context().browser().newContext();
  const other = await browser.newPage();
  await openDesktop(other, base, step);
  const long = `Bartholomew Maximilian Featherstonehaugh ${Date.now().toString(36)}`;
  await api(other, "POST", "/api/session/sign-up", {
    name: `keys-${Date.now().toString(36)}`,
    full_name: long,
    password: `tide-${Date.now().toString(36)}-pool`,
  });
  await other.goto(`${base}/`);
  const title = other.getByRole("menuitem", { name: long, exact: true });
  await title.waitFor({ timeout: 30_000 });
  await other
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Finder", exact: true })
    .waitFor({ timeout: 8_000 });
  const clock = other.getByRole("menuitem", { name: /^Clock, / });
  const [own, its] = [await title.boundingBox(), await clock.boundingBox()];
  step(
    "A long account name stays clear of the clock",
    Boolean(own && its) && its.x + its.width <= own.x,
    JSON.stringify([own, its]),
  );
  step(
    "and is cut with an ellipsis at its limit",
    await title.evaluate((element) => element.scrollWidth > element.clientWidth),
  );
  await shot(other, path.join(out, `desktop-keys-long-name-${browserName}.png`));
  await browser.close();
});
