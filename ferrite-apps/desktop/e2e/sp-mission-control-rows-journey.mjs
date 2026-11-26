#!/usr/bin/env node
// Mission Control's four settings on a served desktop. Rearrange, Switch to Space and Separate Spaces are dimmed with a
// reason, and the journey checks that the first two reasons are true: Spaces stay in their order after use, and the Dock
// takes the person to the Space of the application. Group windows by application works: the overview groups only once it
// is on, and it holds across a reload. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/sp-mission-control-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { launch } from "./app-journey.mjs";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await journey("sp-mission-control-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json.values?.[key];
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const box = (name) => prefs.getByRole("checkbox", { name });
  const group = () => box("Group windows by application");
  const openPane = async () => {
    await launch(page, "System Preferences");
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    if ((await group().count()) === 0)
      await prefs.getByRole("button", { name: "Mission Control", exact: true }).first().click();
    await group().waitFor({ timeout: 8_000 });
  };
  const leave = async () => {
    await prefs.getByRole("button", { name: "Close" }).first().click();
    await prefs.waitFor({ state: "detached", timeout: 5_000 });
    await page.waitForTimeout(300);
  };
  const titleOf = (locator) =>
    locator.evaluate((element) => element.closest("[title]")?.getAttribute("title") ?? "");
  const dimmed = async (name, wanted, why) => {
    const control = box(name);
    const checked = (await control.getAttribute("aria-checked")) === String(wanted);
    const title = await titleOf(control);
    step(
      `${name}: dimmed, showing what this desktop does, and saying why`,
      (await control.isDisabled()) && checked && why.test(title),
      title,
    );
  };
  const seeDimmed = async () => {
    await dimmed(/^Automatically rearrange Spaces/, false, /order you put them/);
    await dimmed(/^When switching to an application/, true, /Space of the application/);
    await dimmed("Displays have separate Spaces", true, /one display/);
  };

  await openPane();
  await seeDimmed();
  step("Group windows by application can be changed", !(await group().isDisabled()));
  await page.screenshot({ path: path.join(out, "mission-control-pane.png") });
  await leave();

  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const front = async () =>
    (await page.getByRole("menubar").first().getByRole("menuitem").nth(1).innerText()).trim();
  const groupNames = () =>
    overview
      .locator("[data-group-name]")
      .evaluateAll((all) =>
        all.map((each) => getComputedStyle(each, "::after").content.replaceAll('"', "")),
      );
  const openOverview = async () => {
    await page.keyboard.press("F3");
    await overview.waitFor({ timeout: 4_000 });
    await page.waitForTimeout(500);
  };
  const closeOverview = async () => {
    await page.keyboard.press("Escape");
    await overview.waitFor({ state: "detached", timeout: 4_000 });
    await page.waitForTimeout(300);
  };

  await launch(page, "Finder");
  await page.locator(".mac-window.mac-finder").first().waitFor({ timeout: 8_000 });
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "New Finder Window" }).click();
  await until(async () => (await page.locator(".mac-window.mac-finder").count()) === 2);
  await launch(page, "Chess");
  await until(async () => (await front()) === "Chess");

  await openOverview();
  step("With the setting off, Mission Control does not group", (await groupNames()).length === 0);
  await closeOverview();

  await openPane();
  const saved = nextSave(page, SETTINGS);
  await group().click();
  await saved;
  await leave();
  await openOverview();
  let names = await groupNames();
  step(
    "With it on, Mission Control names each application's group",
    names.includes("Finder") && names.includes("Chess"),
    names.join(", "),
  );
  await page.screenshot({ path: path.join(out, "mission-control-grouped.png") });
  await closeOverview();

  await reloadDesktop(page);
  await page.waitForTimeout(800);
  await openOverview();
  names = await groupNames();
  step(
    "After a reload it still groups",
    names.includes("Finder") && names.includes("Chess"),
    names.join(", "),
  );
  await closeOverview();
  await openPane();
  step(
    "and the setting is on, on the server and in the pane",
    (await stored("mission-control.groupByApplication")) === true &&
      (await group().getAttribute("aria-checked")) === "true",
  );
  await seeDimmed();
  await leave();

  const bar = overview.getByRole("group", { name: "Spaces" });
  const spaces = () => stored("desktop.spaces");
  await openOverview();
  await bar.getByRole("button", { name: "Add Desktop" }).click();
  await bar.getByRole("button", { name: "Desktop 2", exact: true }).waitFor({ timeout: 4_000 });
  await bar.getByRole("button", { name: "Add Desktop" }).click();
  await bar.getByRole("button", { name: "Desktop 3", exact: true }).waitFor({ timeout: 4_000 });
  await bar.getByRole("button", { name: "Desktop 3", exact: true }).click();
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  const reaches = (space) => until(async () => (await spaces())?.current === space);
  const moves = [await reaches("3")];
  await page.keyboard.press("Control+ArrowLeft");
  moves.push(await reaches("2"));
  await page.keyboard.press("Control+ArrowLeft");
  moves.push(await reaches("1"));
  await page.keyboard.press("Control+ArrowRight");
  moves.push(await reaches("2"));
  await page.keyboard.press("Control+ArrowRight");
  moves.push(await reaches("3"));
  const afterUse = await spaces();
  step(
    "Spaces stay in the order the person put them after each is used",
    moves.every(Boolean) && afterUse?.current === "3" && afterUse?.spaces?.join() === "1,2,3",
    `${moves.join()}: ${JSON.stringify(afterUse?.spaces)}`,
  );

  await launch(page, "Chess");
  const went = await until(async () => (await spaces())?.current === "1");
  step(
    "Switching to an application goes to the Space with its window",
    went && (await page.locator('[data-window-id="chess"]').isVisible()),
    (await spaces())?.current,
  );
});
