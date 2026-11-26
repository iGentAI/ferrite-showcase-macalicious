#!/usr/bin/env node
// Notifications' Do Not Disturb conditions on a served desktop. When the screen is locked and When mirroring are dimmed with
// a reason. With Do Not Disturb on, a call is silent unless Allow calls from everyone is on, or it is the same person's second
// within three minutes, and nothing else comes through. When the display is sleeping holds banners back while the desktop's
// display sleep is up, and off lets them come. All of them hold across a reload. Exits 0 only when every step passed with no
// console error, page error, failed request or HTTP error.
//
// Simulated: the calls are notifications the page raises through `POST /api/notification-center/notify` as app `facetime`,
// each with one caller's name as its title, as a real ring is (`ring` in `src/apps/facetime/mod.rs`), and not a second person
// placing a call. The banners, Do Not Disturb, the display's sleep and the settings are the real desktop's.
//
//   node e2e/sp-notifications-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { launch } from "./app-journey.mjs";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const run = Date.now().toString(36);

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await journey("sp-notifications-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const box = (name) => prefs.getByRole("checkbox", { name });
  const list = prefs.getByRole("listbox", { name: "Applications" });
  const openPane = async () => {
    await launch(page, "System Preferences");
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    if ((await list.count()) === 0)
      await prefs.getByRole("button", { name: "Notifications", exact: true }).first().click();
    await list.waitFor({ timeout: 8_000 });
  };
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json.values?.[key];
  const dimmed = async (name, wanted, why) => {
    const control = box(name);
    const title = await control.evaluate(
      (element) => element.closest("[title]")?.getAttribute("title") ?? "",
    );
    step(
      `${name}: dimmed, showing what this desktop does, and saying why`,
      (await control.isDisabled()) &&
        (await control.getAttribute("aria-checked")) === String(wanted) &&
        why.test(title),
      title,
    );
  };
  const seeDimmed = async () => {
    await dimmed("When the screen is locked", true, /lock screen closes/);
    await dimmed("When mirroring to TVs and projectors", false, /cannot tell/);
  };
  const flip = async (name) => {
    const saved = nextSave(page, SETTINGS);
    await box(name).click();
    await saved;
    await page.waitForTimeout(200);
  };
  const notify = (app, title) =>
    api(page, "POST", "/api/notification-center/notify", { app, title });
  const banner = (title) =>
    page.locator(".mac-desktop-shell-banners").getByText(title, { exact: true });
  /**
   * Raises a notification and says whether its banner came. A step that expects none waits `SILENT`;
   * each comes straight after a banner that did come, so the live stream is known to be delivering.
   */
  const SILENT = 3_000;
  const bannerCame = async (app, title, ms = 15_000) => {
    await notify(app, title);
    return until(async () => (await banner(title).count()) > 0, ms);
  };
  const setDnd = async (on) => {
    await api(page, "PUT", "/api/notification-center/dnd", { on });
    await until(
      async () =>
        (await page.locator('[role="menuitem"][data-dnd]').count()) > 0 === on ||
        (await page.locator("[data-dnd]").count()) > 0 === on,
    );
    await page.waitForTimeout(300);
  };

  await openPane();
  await seeDimmed();
  for (const name of [
    "When the display is sleeping",
    "Allow calls from everyone",
    "Allow repeated calls",
  ])
    step(`${name} can be changed`, !(await box(name).isDisabled()));
  await page.screenshot({ path: path.join(out, "notifications-dnd.png") });

  // What arrives before the live stream's first state is taken as already seen, so raise until one comes in.
  const delivering = async () => {
    for (let attempt = 0; attempt < 8; attempt += 1)
      if (await bannerCame("mail", `before ${attempt} ${run}`, 6_000)) return true;
    return false;
  };
  step("Before Do Not Disturb, a banner comes: the live stream is delivering", await delivering());
  await setDnd(true);
  step(
    "With Do Not Disturb on and nothing allowed, a call shows no banner",
    !(await bannerCame("facetime", `Ada ${run}`, SILENT)),
  );
  await flip("Allow calls from everyone");
  step("Allow calls from everyone lets a call through", await bannerCame("facetime", `Bob ${run}`));
  step("but no other application", !(await bannerCame("mail", `Mail through ${run}`, SILENT)));
  await page.screenshot({ path: path.join(out, "notifications-call.png") });
  await flip("Allow calls from everyone");
  step("Off again, a call is silent again", !(await bannerCame("facetime", `Cora ${run}`, SILENT)));
  await flip("Allow repeated calls");
  step(
    "With Allow repeated calls, a person's first call is silent",
    !(await bannerCame("facetime", `Dan ${run}`, SILENT)),
  );
  step(
    "and their second, within three minutes, comes through",
    await bannerCame("facetime", `Dan ${run}`),
  );
  await setDnd(false);

  const sleepLayer = page.locator(".mac-system-preferences-screen-saver");
  const corners = async () => {
    await prefs.getByRole("button", { name: "Show All" }).click();
    await prefs.getByRole("button", { name: "Mission Control", exact: true }).first().click();
    await prefs.getByRole("button", { name: "Hot Corners…" }).click();
    const sheet = prefs.getByRole("dialog", { name: "Active Screen Corners" });
    const choice = sheet.getByRole("combobox", { name: "Top left" });
    await choice.click();
    await page.waitForTimeout(300);
    await page
      .getByRole("listbox")
      .filter({ visible: true })
      .last()
      .getByRole("option", { name: "Put Display to Sleep", exact: true })
      .click({ force: true });
    await until(async () => (await choice.innerText()).includes("Put Display to Sleep"));
    const saved = nextSave(page, SETTINGS);
    await sheet.getByRole("button", { name: "OK" }).click();
    await saved;
    await prefs.getByRole("button", { name: "Show All" }).click();
    await prefs.getByRole("button", { name: "Notifications", exact: true }).first().click();
    await list.waitFor({ timeout: 8_000 });
  };
  await corners();
  const whileAsleep = async (title, ms) => {
    step("Awake, a banner comes", await bannerCame("mail", `${title} awake`));
    await page.mouse.move(700, 400);
    await page.mouse.move(0, 0);
    await sleepLayer.waitFor({ state: "attached", timeout: 5_000 });
    const came = await bannerCame("mail", title, ms);
    await page.waitForTimeout(600);
    await page.keyboard.press("Shift");
    await page.mouse.move(700, 400);
    await sleepLayer.waitFor({ state: "detached", timeout: 5_000 });
    await page.waitForTimeout(300);
    return came;
  };
  step(
    "When the display is sleeping, on: a notification brings no banner",
    !(await whileAsleep(`asleep on ${run}`, SILENT)),
  );
  await flip("When the display is sleeping");
  step("Off: the same notification brings its banner", await whileAsleep(`asleep off ${run}`));

  await reloadDesktop(page);
  await openPane();
  step(
    "They hold across a reload, on the server and in the pane",
    (await stored("notifications.whenSleeping")) === false &&
      (await stored("notifications.allowRepeatedCalls")) === true &&
      (await stored("notifications.allowCalls")) === false &&
      (await box("When the display is sleeping").getAttribute("aria-checked")) === "false" &&
      (await box("Allow repeated calls").getAttribute("aria-checked")) === "true",
  );
  await seeDimmed();
});
