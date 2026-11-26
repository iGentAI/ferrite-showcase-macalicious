#!/usr/bin/env node
// Activity Monitor's CPU, Memory, Energy and Disk views on a served desktop, their statements, the column chooser
// and the sort, kept across a reload. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/activity-monitor-views-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("activity-monitor-views", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  await dock(page, "Activity Monitor").click();
  const monitor = page.locator('[data-window-id="activity-monitor"]');
  await monitor.waitFor();
  const show = (name) =>
    monitor
      .getByRole("radio", { name, exact: true })
      .or(monitor.getByRole("button", { name, exact: true }))
      .first()
      .click();
  const grid = (name) => monitor.getByRole("grid", { name });

  await show("CPU");
  const cpu = grid("CPU");
  await monitor
    .getByText(/^\d+\.\d%$/)
    .first()
    .waitFor({ timeout: 5_000 });
  const cpuText = await cpu.innerText();
  step(
    "CPU shows how busy this page is and the cores, and says what a page cannot see",
    /main thread, busy/.test(cpuText) &&
      /cores/.test(cpuText) &&
      (await monitor.getByText(/shown no processes and no processor figures/).isVisible()),
    cpuText.replace(/\s+/g, " "),
  );
  step(
    "its graph is the page's main thread",
    await monitor.getByText("MAIN THREAD", { exact: true }).isVisible(),
  );
  await page.screenshot({ path: path.join(out, "am-cpu.png") });

  await show("Memory");
  const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize);
  const memory = await grid("Memory").innerText();
  step(
    "Memory shows the browser's figure, or says it reports none",
    heap === undefined ? /Not reported by this browser/.test(memory) : /\d (KB|MB|GB)/.test(memory),
    memory.replace(/\s+/g, " "),
  );

  await show("Energy");
  const reportsBattery = await page.evaluate(() => "getBattery" in navigator);
  const energy = grid("Energy");
  await page.waitForTimeout(400);
  const energyText = await energy.innerText();
  step(
    "Energy shows the battery, or says it is not reported",
    reportsBattery ? /Battery level/.test(energyText) : /Not reported/.test(energyText),
    energyText.replace(/\s+/g, " "),
  );

  await show("Disk");
  const disk = grid("Disk");
  await disk.getByText("Your drive, in use").waitFor({ timeout: 8_000 });
  const diskText = await disk.innerText();
  step(
    "Disk shows the drive and what an app keeps, with no app at nothing",
    /of /.test(diskText) &&
      /kept for you/.test(diskText) &&
      !/\b0 bytes\s*(\n|$)[\s\S]*kept/.test(diskText.replace(/Your drive[^\n]*\n[^\n]*/, "")),
    diskText.replace(/\s+/g, " "),
  );
  await page.screenshot({ path: path.join(out, "am-disk.png") });

  await show("Applications");
  const apps = grid("Applications");
  await apps.getByText("Activity Monitor").first().waitFor();
  let saved = nextSave(page, SETTINGS, (body) => {
    const hidden = body?.values?.["activity-monitor.hidden-columns"];
    return hidden?.applications?.includes("minimized");
  });
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Columns" }).hover();
  await page.getByRole("menuitemcheckbox", { name: "Minimized" }).click();
  await saved;
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  step(
    "View > Columns takes a column away",
    (await apps.getByRole("columnheader", { name: "Minimized" }).count()) === 0,
  );

  const firstApplication = () =>
    apps.locator("[data-app-row]").first().getAttribute("data-app-row");
  const lastApplication = () => apps.locator("[data-app-row]").last().getAttribute("data-app-row");
  await apps.locator('[data-app-row="finder"]').waitFor();
  const ascending = [await firstApplication(), await lastApplication()].join(" > ");
  saved = nextSave(page, SETTINGS, (body) => {
    const sort = body?.values?.["activity-monitor.sorts"]?.applications;
    return sort?.column === "name" && sort?.direction === "descending";
  });
  await apps.getByRole("columnheader", { name: "Application Name" }).click();
  await saved;
  const descending = [await firstApplication(), await lastApplication()].join(" > ");
  step(
    "a click on a heading turns the sort round",
    ascending === "activity-monitor > finder" && descending === "finder > activity-monitor",
    `${ascending}, then ${descending}`,
  );

  await reloadDesktop(page);
  await dock(page, "Activity Monitor").click();
  await apps.waitFor({ timeout: 10_000 });
  await apps.locator('[data-app-row="finder"]').waitFor();
  const restored = [await firstApplication(), await lastApplication()].join(" > ");
  step(
    "after a reload the sort and the columns are as they were",
    (await apps.getByRole("columnheader", { name: "Minimized" }).count()) === 0 &&
      restored === "finder > activity-monitor",
    restored,
  );

  await apps.getByRole("columnheader", { name: "Windows" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Columns" }).hover();
  const inHeadingMenu = await page
    .getByRole("menuitemcheckbox", { name: "Minimized" })
    .waitFor({ timeout: 3_000 })
    .then(
      () => true,
      () => false,
    );
  step("the heading's menu has Columns", inHeadingMenu);
  await page.keyboard.press("Escape");
});
