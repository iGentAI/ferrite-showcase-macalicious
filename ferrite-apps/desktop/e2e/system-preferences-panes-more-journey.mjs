#!/usr/bin/env node
// More of System Preferences' panes on a served desktop, each with a screenshot: General's Recent items against the Apple
// menu; Notifications' Do Not Disturb schedule at the span's edges, on Playwright's clock, and Notification Center's sort
// order; the category lists of Accessibility and Extensions and Extensions' new item dot; the gesture callouts of Trackpad
// and Mouse; Language & Region's examples following the region and the clock, with today's date and not a captured one;
// and settings of several panes across a reload. Exits 0 only when every step passed with no console error, page error,
// failed request or HTTP error.
//
//   node e2e/system-preferences-panes-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api } from "./app-journey.mjs";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const URL = "/api/system-preferences/settings";
const RUN = Date.now().toString(36);

await journey("system-preferences-panes-more", async ({ page, base, out, step }) => {
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `sp-more-${name}.png`) });
  };
  await page.clock.install({ time: new Date("2026-06-10T21:58:00") });
  await page.clock.resume();
  await openDesktop(page, base);
  const dock = (name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
  for (const name of ["Calculator", "Chess"]) {
    await dock(name).click();
    await page.locator(`[data-window-id="${name.toLowerCase()}"]`).waitFor({ timeout: 10_000 });
  }
  await dock("System Preferences").click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  const openPane = async (name) => {
    await page.keyboard.press("Control+l");
    await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 5_000 });
    await prefs.getByRole("button", { name, exact: true }).first().click();
    await page.waitForTimeout(350);
  };
  const choose = async (label, option) => {
    const box = prefs.getByRole("combobox", { name: label });
    // Under load a press can land before the list takes it, and the list closes with nothing chosen.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await box.click();
      await page.getByRole("option", { name: option, exact: true }).click();
      await page.waitForTimeout(250);
      if ((await box.innerText()).trim() === option) return;
    }
    throw new Error(`${label} did not take ${option}`);
  };
  const bar = page.getByRole("menubar");
  const recentNames = async () => {
    await bar.getByRole("menuitem").first().click();
    await page.getByRole("menuitem", { name: "Recent Items" }).hover();
    await page.waitForTimeout(400);
    const names = [];
    for (const name of ["Calculator", "Chess", "System Preferences"]) {
      if ((await page.getByRole("menu").getByRole("menuitem", { name, exact: true }).count()) > 0)
        names.push(name);
    }
    return names;
  };
  const closeMenus = async () => {
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  };

  const first = await recentNames();
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, "sp-more-recent-all.png") });
  await closeMenus();
  step("Recent Items lists the apps opened", first.length === 3, first.join(", "));
  await openPane("General");
  await choose("Recent items:", "None");
  const none = await recentNames();
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, "sp-more-recent-none.png") });
  await closeMenus();
  step("Recent items None empties it", none.length === 0, none.join(", "));
  await choose("Recent items:", "5");
  step("and 5 brings them back", (await recentNames()).length === 3);
  await closeMenus();

  // The schedule: the default span starts at 22:00, two minutes on. Only the date jumps: the page's own timers keep
  // their time, and the schedule's look comes round within 30 seconds.
  await openPane("Notifications");
  await prefs.getByRole("option", { name: /^Do Not Disturb/ }).click();
  await page.waitForTimeout(300);
  const scheduled = nextSave(
    page,
    URL,
    (body) => body?.values?.["notifications.scheduled"] === true,
  );
  await prefs.getByRole("checkbox", { name: "From:" }).click();
  await scheduled;
  await shot("dnd-schedule");
  const center = async () => {
    await page.getByRole("menuitem", { name: "Notification Center" }).click();
    const shell = page.locator(".mac-desktop-shell-notification-center");
    await shell.waitFor();
    return shell;
  };
  const moon = (shell) => shell.getByRole("switch", { name: "Do Not Disturb" });
  const closeCenter = async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  };
  const shell = await center();
  await page.getByRole("tab", { name: "Today" }).click();
  await page.waitForTimeout(200);
  const before = await moon(shell).getAttribute("aria-checked");
  await closeCenter();
  step("before the span Do Not Disturb is off", before === "false", `${before}`);
  // The schedule looks every 30 seconds, so a look comes within 30 s of the clock moving, and later
  // when the page is busy: its answer is awaited on the switch itself.
  const switchReaches = async (value) => {
    const open = await center();
    await page.getByRole("tab", { name: "Today" }).click();
    const end = Date.now() + 45_000;
    let now = await moon(open).getAttribute("aria-checked");
    while (now !== value && Date.now() < end) {
      await page.waitForTimeout(250);
      now = await moon(open).getAttribute("aria-checked");
    }
    return now;
  };
  await page.clock.setSystemTime(new Date("2026-06-10T22:01:00"));
  const during = await switchReaches("true");
  await page.waitForTimeout(2_500);
  const stays = await moon(page.locator(".mac-desktop-shell-notification-center")).getAttribute(
    "aria-checked",
  );
  await shot("dnd-on");
  await closeCenter();
  step("at the span's start the schedule turns it on", during === "true", `${during}`);
  step("and it stays on once the server has it", stays === "true", `${stays}`);
  await page.clock.setSystemTime(new Date("2026-06-11T07:05:00"));
  const after = await switchReaches("false");
  await closeCenter();
  step("at its end the schedule turns it off", after === "false", `${after}`);

  const notify = (app, title) =>
    api(page, "POST", "/api/notification-center/notify", { app, title });
  const titles = [`mail-${RUN}`, `reminders-${RUN}`, `mail-two-${RUN}`];
  await notify("mail", titles[0]);
  await page.waitForTimeout(1_200);
  await notify("reminders", titles[1]);
  await page.waitForTimeout(1_200);
  await notify("mail", titles[2]);
  await page.waitForTimeout(1_500);
  const order = async () => {
    const open = await center();
    await open.getByRole("tab", { name: "Notifications" }).click();
    // The stream brings them when the server has them, and a title not yet listed must not count.
    const end = Date.now() + 20_000;
    let text = await open.innerText();
    while (titles.some((title) => !text.includes(title)) && Date.now() < end) {
      await page.waitForTimeout(250);
      text = await open.innerText();
    }
    const missing = titles.filter((title) => !text.includes(title));
    if (missing.length > 0) throw new Error(`Notification Center never listed ${missing.join()}`);
    await shot("sort");
    await closeCenter();
    return titles
      .map((title) => [title, text.indexOf(title)])
      .sort((a, b) => a[1] - b[1])
      .map(([title]) => title);
  };
  await choose("Notification Center sort order:", "Recents");
  const recents = await order();
  step(
    "sort order Recents lists the newest first, app by app mixed",
    recents.join() === [titles[2], titles[1], titles[0]].join(),
    recents.join(),
  );
  await choose("Notification Center sort order:", "Recents by App");
  const byApp = await order();
  step(
    "Recents by App keeps an app's together",
    Math.abs(byApp.indexOf(titles[0]) - byApp.indexOf(titles[2])) === 1,
    byApp.join(),
  );

  await openPane("Accessibility");
  const features = prefs.getByRole("listbox", { name: "Accessibility features" });
  await features.getByRole("option", { name: /^Display/ }).click();
  await page.waitForTimeout(300);
  await shot("accessibility");
  step(
    "Accessibility's list chooses the category",
    (await features.getByRole("option", { name: /^Display/ }).getAttribute("aria-selected")) ===
      "true",
  );

  await openPane("Extensions");
  const categories = prefs.getByRole("listbox", { name: "Extension categories" });
  await categories.getByRole("option", { name: /^Today/ }).click();
  await page.waitForTimeout(300);
  step(
    "Extensions' list chooses the category, and says what is true of Today",
    await prefs.getByText("Today shows these widgets").isVisible(),
  );
  await shot("extensions-today");
  await categories.getByRole("option", { name: /^Share Menu/ }).click();
  await page.waitForTimeout(300);
  const newDot = prefs.getByRole("row", { name: /^New Save to Books/ });
  await shot("extensions-new");
  step("a new extension has its dot", await newDot.first().isVisible());
  await newDot.first().getByRole("checkbox").click();
  await page.waitForTimeout(400);
  step(
    "and loses it once chosen",
    (await prefs.getByRole("row", { name: /^New Save to Books/ }).count()) === 0,
  );

  for (const [pane, id] of [
    ["Trackpad", "trackpad"],
    ["Mouse", "mouse"],
  ]) {
    await openPane(pane);
    const rows = prefs.locator("[data-gesture]");
    const highlightOf = (row) => row.evaluate((node) => node.outerHTML);
    const before = await highlightOf(rows.last());
    await rows.last().hover();
    await page.waitForTimeout(300);
    const hovered = await highlightOf(rows.last());
    await shot(`${id}-callout`);
    step(`${pane}'s callout follows the pointer`, hovered !== before);
    await rows.first().hover();
    await page.waitForTimeout(250);
    const away = await highlightOf(rows.last());
    await rows.last().locator("input, [role='checkbox']").first().focus();
    await page.waitForTimeout(300);
    step(
      `${pane}'s callout follows the focus`,
      away === before && (await highlightOf(rows.last())) === hovered,
    );
  }

  await openPane("Language & Region");
  await page.waitForTimeout(300);
  const year = new Date(await page.evaluate(() => Date.now())).getFullYear();
  const examplesOf = () => prefs.getByText(new RegExp(`${year} at `)).first();
  step(
    "the examples show today, not a captured date",
    !(await prefs.innerText()).includes("2019") && (await examplesOf().isVisible()),
    await examplesOf().innerText(),
  );
  const hour = await examplesOf().innerText();
  await prefs.getByRole("checkbox", { name: "24-Hour Time" }).click();
  await page.waitForTimeout(300);
  const clock24 = await examplesOf().innerText();
  step("24-Hour Time changes them", clock24 !== hour && !/ [AP]M /.test(clock24), clock24);
  await choose("Region:", "United Kingdom");
  const british = await prefs.getByText(/£/).first().innerText();
  await shot("language-formats");
  step("the region changes them", british.includes("4,567.89"), british);
  await page.waitForTimeout(800);

  await reloadDesktop(page);
  await page.waitForTimeout(800);
  await dock("System Preferences").click();
  await prefs.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await shot("after-reload");
  step(
    "Language & Region's settings hold after a reload",
    (await prefs.getByRole("checkbox", { name: "24-Hour Time" }).getAttribute("aria-checked")) ===
      "true" && (await prefs.getByText(/£/).first().isVisible()),
  );
  await openPane("Accessibility");
  step(
    "as do Accessibility's and others",
    (await prefs
      .getByRole("listbox", { name: "Accessibility features" })
      .getByRole("option", { name: /^Display/ })
      .getAttribute("aria-selected")) === "true",
  );
});
