#!/usr/bin/env node
// Hot Corners on a served desktop: each corner of the page does what it is set to, once on arriving, and the
// setting lasts through a reload. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/hot-corners-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("hot-corners");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;

await run({}, {}, async ({ person }) => {
  const a = await person("ana", { name: `hcana-${id}`, fullName: `Ana ${id}`, password });
  await person("other", { name: `hcother-${id}`, fullName: `Other ${id}`, password });
  await a
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const prefs = a.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor();
  const allPreferences = prefs.getByRole("group", { name: "All preferences" });
  if (!(await allPreferences.isVisible())) {
    await prefs.getByRole("button", { name: "Show All", exact: true }).click();
  }
  await allPreferences.waitFor({ state: "visible", timeout: 5_000 });
  await prefs
    .getByRole("group", { name: "All preferences" })
    .getByRole("button", { name: "Mission Control", exact: true })
    .click();
  await prefs.getByRole("button", { name: "Hot Corners…" }).click();
  const choose = async (corner, action) => {
    await a.getByRole("combobox", { name: corner }).click();
    await a.getByRole("option", { name: action, exact: true }).click();
    await a
      .getByRole("listbox")
      .waitFor({ state: "detached" })
      .catch(() => {});
    await a.waitForTimeout(400);
    await a.getByRole("combobox", { name: corner }).getByText(action).waitFor();
  };
  await choose("Top left", "Launchpad");
  await choose("Top right", "Notification Center");
  await choose("Bottom left", "Start Screen Saver");
  await choose("Bottom right", "Lock Screen");
  await shot(a, "hot-corners");
  await a.getByRole("button", { name: "OK", exact: true }).click();
  await a.waitForTimeout(1_500);

  const expectedCorners = {
    topLeft: "Launchpad",
    topRight: "Notification Center",
    bottomLeft: "Start Screen Saver",
    bottomRight: "Lock Screen",
  };
  const loadingSettings = a.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/system-preferences/settings",
    { timeout: 15_000 },
  );
  await a.reload();
  const loadedSettings = await loadingSettings;
  if (!loadedSettings.ok()) throw new Error(`settings reload: HTTP ${loadedSettings.status()}`);
  const loaded = await loadedSettings.json();
  for (const [corner, action] of Object.entries(expectedCorners)) {
    if (loaded.values?.[`mission-control.hotCorner.${corner}`] !== action) {
      throw new Error(`the saved action for ${corner} did not survive the reload`);
    }
  }
  await a.locator(".mac-desktop-shell-menu-bar").waitFor();
  // The shell appears before settings hydrate. Read their controls before moving into a corner.
  await prefs.getByRole("button", { name: "Hot Corners…", exact: true }).click();
  const labels = ["Top left", "Top right", "Bottom left", "Bottom right"];
  for (const [index, action] of Object.values(expectedCorners).entries()) {
    const field = a.getByRole("combobox", { name: labels[index], exact: true });
    await field.getByText(action, { exact: true }).waitFor({ timeout: 5_000 });
  }
  await a.getByRole("button", { name: "OK", exact: true }).click();
  const size = a.viewportSize();
  const middle = () => a.mouse.move(size.width / 2, size.height / 2);
  const seen = (locator) => within(5_000, async () => locator.first().isVisible());

  await middle();
  await a.mouse.move(0, 0);
  const launchpad = a.locator(".mac-launchpad");
  step("the top left corner opens Launchpad, after a reload", (await seen(launchpad)) !== null);
  await a.keyboard.press("Escape");
  await within(3_000, async () => !(await launchpad.first().isVisible()));
  await a.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent("pointerleave")));
  await a.mouse.move(0, 1);
  step(
    "leaving the page and coming back to the corner opens it again",
    (await seen(launchpad)) !== null,
  );
  await a.keyboard.press("Escape");
  await within(3_000, async () => !(await launchpad.first().isVisible()));

  await middle();
  await a.mouse.move(size.width - 1, 0);
  const center = a.locator(".mac-notification-center");
  step("the top right corner opens Notification Center", (await seen(center)) !== null);
  await a.keyboard.press("Escape");
  await a.mouse.click(size.width / 3, size.height / 2);

  await middle();
  await a.mouse.move(0, size.height - 1);
  const saver = a.locator(".mac-system-preferences-screen-saver");
  step("the bottom left corner starts the screen saver", (await seen(saver)) !== null);
  await a.mouse.move(1, size.height - 1);
  step("the hand's rest in the corner does not end it", await saver.isVisible());
  await a.waitForTimeout(700);
  await middle();
  step(
    "moving away after that ends it",
    (await within(3_000, async () => (await saver.count()) === 0)) !== null,
  );

  await a.mouse.move(size.width - 1, size.height - 1);
  const lock = a.getByPlaceholder("Enter Password");
  step("the bottom right corner locks the screen", (await seen(lock)) !== null);
  await lock.fill(password);
  await lock.press("Enter");
  await a.locator(".mac-desktop-shell-menu-bar").waitFor();
  step("the password opens it again", await a.locator(".mac-desktop-shell-menu-bar").isVisible());
});
