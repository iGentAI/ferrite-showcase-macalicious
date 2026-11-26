#!/usr/bin/env node
// System Preferences > Notifications on a served desktop: the list of apps that really send
// notifications, and each app's settings followed. Off shows neither a banner nor a Notification
// Center row; alert style None keeps the row with no banner; Alerts stays on screen; Show in
// Notification Center off hides the row; and another app is untouched. A person's settings come
// back after a reload. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/notifications-pane-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api } from "./app-journey.mjs";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const run = Date.now().toString(36);
const notify = (page, app, title) =>
  api(page, "POST", "/api/notification-center/notify", { app, title });

async function openPane(page) {
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const window = page.locator('[data-window-id="system-preferences"]');
  await window.waitFor({ timeout: 10_000 });
  const list = window.getByRole("listbox", { name: "Applications" });
  const pane = window.getByRole("button", { name: /^Notifications/ }).first();
  await list.or(pane).first().waitFor({ timeout: 10_000 });
  if ((await list.count()) === 0) await pane.click();
  await list.waitFor({ timeout: 5_000 });
  return { window, list };
}

const choose = async (list, name) => {
  await list.getByRole("option", { name: new RegExp(`^${name}`) }).click();
};

await journey("notifications-pane", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const { window, list } = await openPane(page);
  const names = await list.getByRole("option").allInnerTexts();
  step(
    "the list is the apps that send notifications",
    names.some((row) => row.startsWith("Reminders")) &&
      !names.some((row) => row.startsWith("Home")),
    `${names.length} rows`,
  );

  const saved = () => page.waitForTimeout(700);
  const banner = (title) => page.locator(".mac-desktop-shell-banners").getByText(title);
  const center = async (title) => {
    await page.getByRole("menuitem", { name: "Notification Center" }).click();
    const shell = page.locator(".mac-desktop-shell-notification-center");
    await shell.waitFor();
    await shell.getByRole("tab", { name: "Notifications" }).click();
    await page.waitForTimeout(250);
    const found = (await shell.getByText(title).count()) > 0;
    await page.keyboard.press("Escape");
    await shell.waitFor({ state: "detached", timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(300);
    return found;
  };

  await choose(list, "Mail");
  await window.getByRole("checkbox", { name: "Allow Notifications from Mail" }).waitFor();
  await page.screenshot({ path: path.join(out, "notifications-app.png") });

  const before = `before-${run}`;
  await notify(page, "mail", before);
  await banner(before).waitFor({ timeout: 8_000 });
  step("at first Mail's notification comes in as a banner", true);

  await window.getByRole("radio", { name: "None" }).click();
  await saved();
  const silent = `silent-${run}`;
  await notify(page, "mail", silent);
  await page.waitForTimeout(1_500);
  step(
    "alert style None shows no banner, and it waits in Notification Center",
    (await banner(silent).count()) === 0 && (await center(silent)),
  );

  await window.getByRole("radio", { name: "Alerts" }).click();
  await saved();
  const staying = `staying-${run}`;
  await notify(page, "mail", staying);
  await banner(staying).waitFor({ timeout: 8_000 });
  await page.waitForTimeout(6_000);
  step("alert style Alerts stays past a banner's time", (await banner(staying).count()) === 1);
  await page.screenshot({ path: path.join(out, "notifications-alert.png") });
  await page
    .locator(".mac-desktop-shell-banners")
    .getByRole("button", { name: "Close" })
    .first()
    .click();

  await window.getByRole("radio", { name: "Banners" }).click();
  await window.getByRole("checkbox", { name: "Show in Notification Center" }).click();
  await saved();
  const hidden = `hidden-${run}`;
  await notify(page, "mail", hidden);
  await banner(hidden).waitFor({ timeout: 8_000 });
  step(
    "Show in Notification Center off keeps the banner and hides the row",
    !(await center(hidden)),
  );
  await window.getByRole("checkbox", { name: "Show in Notification Center" }).click();

  await window.getByRole("checkbox", { name: "Allow Notifications from Mail" }).click();
  await saved();
  const off = `off-${run}`;
  await notify(page, "mail", off);
  const other = `other-${run}`;
  await notify(page, "messages", other);
  await banner(other).waitFor({ timeout: 8_000 });
  step(
    "with Mail off nothing of Mail's shows, and Messages is untouched",
    (await banner(off).count()) === 0 && !(await center(off)) && (await center(other)),
  );
  const row = list.getByRole("option", { name: /^Mail/ });
  step("Mail's row says Off", (await row.innerText()).includes("Off"));

  await page.waitForTimeout(800);
  await reloadDesktop(page);
  const again = await openPane(page);
  await choose(again.list, "Mail");
  const allow = again.window.getByRole("checkbox", { name: "Allow Notifications from Mail" });
  step("Mail is still off after a reload", !(await allow.isChecked()));
  const still = `still-${run}`;
  await notify(page, "mail", still);
  await page.waitForTimeout(1_500);
  step("and its notifications still do not show", (await banner(still).count()) === 0);
  await allow.click();
  await page.waitForTimeout(700);

  // Turned off, an application takes the alert it has on screen with it.
  await again.window.getByRole("radio", { name: "Alerts" }).click();
  await page.waitForTimeout(700);
  const onScreen = `on-screen-${run}`;
  await notify(page, "mail", onScreen);
  await banner(onScreen).waitFor({ timeout: 8_000 });
  await allow.click();
  await banner(onScreen).waitFor({ state: "detached", timeout: 3_000 });
  step("turning Mail off takes its alert off the screen", true);
  await allow.click();
  await again.window.getByRole("radio", { name: `As Mail sends them` }).click();
  await page.waitForTimeout(700);
});
