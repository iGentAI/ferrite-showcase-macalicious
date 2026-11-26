#!/usr/bin/env node
// System Preferences' depth on a served desktop: the View and Help menus, their keys, opening on the
// pane last shown, and Help buttons. Exits 0 only when every step passed with no console error, page
// error, failed request or HTTP error.
//
//   node e2e/system-preferences-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const URL = "/api/system-preferences/settings";

const menu = async (page, title) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).click();
};
const windowOf = (page) => page.locator('[data-window-id="system-preferences"]');

await journey("system-preferences-depth", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await windowOf(page).getByRole("group", { name: "All preferences" }).waitFor();
  step("a first open shows every pane", true);

  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Dock", exact: true }).click();
  await page.locator('[data-window-id="system-preferences"]').first().waitFor();
  await windowOf(page).locator('[role="group"][data-pane="dock"]').waitFor();
  step("View lists the panes and opens one", true);

  await menu(page, "View");
  await page.screenshot({ path: path.join(out, "sp-view-menu.png") });
  const back = page.getByRole("menuitem", { name: /^Back/ });
  step(
    "View > Back is enabled after a pane",
    (await back.getAttribute("aria-disabled")) !== "true",
  );
  await page.keyboard.press("Escape");

  const modifier = "Control";
  await page.keyboard.press(`${modifier}+BracketLeft`);
  await windowOf(page).getByRole("group", { name: "All preferences" }).waitFor();
  step("Command-[ goes back", true);
  await page.keyboard.press(`${modifier}+BracketRight`);
  await windowOf(page).locator('[role="group"][data-pane="dock"]').waitFor();
  step("Command-] goes forward", true);

  await page.keyboard.press(`${modifier}+f`);
  const search = windowOf(page)
    .getByRole("searchbox")
    .or(windowOf(page).locator("input[type=search]"))
    .first();
  step(
    "Command-F takes the search field",
    await search.evaluate((el) => el === document.activeElement),
  );

  await page.keyboard.press(`${modifier}+l`);
  await windowOf(page).getByRole("group", { name: "All preferences" }).waitFor();
  step("Command-L shows every pane", true);

  let saved = nextSave(page, URL, (body) => body?.values?.["window.pane"] === "sound");
  await windowOf(page)
    .getByRole("button", { name: /^Sound$/ })
    .click();
  await saved;
  await reloadDesktop(page);
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await windowOf(page).locator('[role="group"][data-pane="sound"]').waitFor({ timeout: 10_000 });
  step("after a reload the window opens on the pane last shown", true);

  await windowOf(page).getByRole("button", { name: /help/i }).last().click();
  await page.locator('[data-window-id="help-viewer"]').waitFor();
  step("a pane's Help button opens Help Viewer", true);
  await page.screenshot({ path: path.join(out, "sp-help.png") });
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-window-id="system-preferences"] [data-window-state]')
        ?.getAttribute("data-window-state") === "key",
  );
  await menu(page, "Help");
  await page.getByRole("menuitem", { name: "System Preferences Help" }).waitFor({ timeout: 5_000 });
  step("Help names System Preferences Help", true);
  await page.screenshot({ path: path.join(out, "sp-help-menu.png") });
  await page.keyboard.press("Escape");

  // A pane whose demo shows a captured Mac's facts says what is true of this desktop.
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const prefs = windowOf(page);
  const pages = [
    ["Network", /This Browser's Connection/, /192\.168/],
    ["Time Machine", /nothing is backed up/, /787\.8 MB/],
    ["Software Update", /Site build/, /Catalina Beta/],
    ["Users & Groups", /Guest/, /Alex Morgan/],
    ["Date & Time", new RegExp(String(new Date().getFullYear())), /2019/],
    ["Displays", /This Screen/, /Built-in Retina/],
    ["Apple ID", /no Apple ID/, /4\.81/],
  ];
  for (const [name, says, never] of pages) {
    await page.keyboard.press(`${modifier}+l`);
    await prefs.getByRole("group", { name: "All preferences" }).waitFor();
    await prefs.getByRole("button", { name, exact: true }).first().click();
    const body = prefs.locator(".mac-system-preferences-served");
    await body.waitFor({ timeout: 5_000 });
    await body.getByText(says).first().waitFor({ timeout: 5_000 });
    const text = await body.innerText();
    step(`${name} says what is true`, !never.test(text), text.slice(0, 60));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(out, `sp-served-${name.replace(/\W+/g, "-").toLowerCase()}.png`),
    });
  }
  // General and Dock settings the desktop honours, across a reload.
  const html = (name) => page.evaluate((n) => document.documentElement.getAttribute(n), name);
  const openPaneNamed = async (name) => {
    await page.keyboard.press(`${modifier}+l`);
    await prefs.getByRole("group", { name: "All preferences" }).waitFor();
    await prefs.getByRole("button", { name, exact: true }).first().click();
    await prefs.locator(".mac-system-preferences-pane").waitFor();
  };
  await openPaneNamed("General");
  await prefs.getByRole("checkbox", { name: "Automatically hide and show the menu bar" }).click();
  await prefs.getByRole("checkbox", { name: "Use font smoothing when available" }).click();
  await prefs.getByRole("radio", { name: "Always" }).click();
  step("hiding the menu bar takes effect", (await html("data-mac-hide-menu-bar")) === "");
  await page.mouse.move(700, 500);
  await page.waitForTimeout(350);
  const barTop = () =>
    page
      .locator(".mac-desktop-shell-menu-bar")
      .evaluate((bar) => bar.getBoundingClientRect().bottom);
  step("the hidden menu bar leaves the screen", (await barTop()) <= 3, String(await barTop()));
  await page.screenshot({ path: path.join(out, "sp-hidden-menu-bar.png") });
  await page.mouse.move(700, 1);
  await page.waitForTimeout(350);
  step("and comes back under the pointer", (await barTop()) >= 20, String(await barTop()));
  await page.mouse.move(700, 500);
  step("font smoothing off takes effect", (await html("data-mac-font-smoothing")) === "off");
  step(
    "scroll bars Always takes effect",
    (await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--mac-scroll-view-overlay-opacity"),
    )) === "1",
  );

  await openPaneNamed("Dock");
  await prefs.getByRole("checkbox", { name: "Show indicators for open applications" }).click();
  step("Dock indicators off takes effect", (await html("data-mac-dock-indicators")) === "off");
  await page.screenshot({ path: path.join(out, "sp-dock-indicators.png") });
  saved = nextSave(page, URL, (body) => body?.values?.["dock.doubleClickAction"] === "minimize");
  await prefs.getByRole("combobox", { name: "Double-click a window’s title bar to" }).click();
  await page.getByRole("option", { name: "minimize" }).click();
  await saved;
  await prefs.locator(".mac-title-bar").dblclick({ position: { x: 300, y: 12 } });
  await page
    .locator('[data-window-id="system-preferences"][data-minimized]')
    .waitFor({ timeout: 5_000 });
  step("a title bar's double click minimizes when the setting says so", true);

  await reloadDesktop(page);
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-mac-dock-indicators") === "off",
  );
  step(
    "the settings hold after a reload, System Preferences closed",
    (await html("data-mac-hide-menu-bar")) === "" &&
      (await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--mac-scroll-view-overlay-opacity"),
      )) === "1",
  );
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await prefs.locator(".mac-system-preferences-body:not([inert])").waitFor();

  // View > Customize…, search suggestions, a drawn alert sound, 24-hour clock, the DND schedule.
  await page.keyboard.press(`${modifier}+l`);
  await prefs.getByRole("group", { name: "All preferences" }).waitFor();
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Customize…" }).click();
  saved = nextSave(page, URL, (body) => body?.values?.["window.hiddenPanes"]?.includes("siri"));
  await prefs.getByRole("checkbox", { name: "Show Siri" }).click();
  await saved;
  await page.screenshot({ path: path.join(out, "sp-customize.png") });
  await prefs.getByRole("button", { name: "Done" }).click();
  step(
    "Customize takes a pane off the grid",
    (await prefs.locator('[data-pane="siri"]').count()) === 0,
  );
  await reloadDesktop(page);
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  await prefs.locator(".mac-system-preferences-body:not([inert])").waitFor();
  await prefs.getByRole("button", { name: "Dock", exact: true }).waitFor();
  step(
    "and it stays off after a reload",
    (await prefs.locator('[data-pane="siri"]').count()) === 0,
  );

  await page.keyboard.press(`${modifier}+f`);
  await page.keyboard.type("sound");
  const suggestions = prefs.getByRole("list", { name: "Matching panes" });
  await suggestions.waitFor();
  await page.screenshot({ path: path.join(out, "sp-search.png") });
  await suggestions.getByRole("button", { name: "Sound" }).click();
  await prefs.locator('[role="group"][data-pane="sound"]').waitFor();
  step("the search field lists matching panes and opens one", true);

  // Listens at what reaches the speakers: an analyser beside every connection to the destination.
  await page.evaluate(() => {
    window.__listening = null;
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...rest) {
      const made = connect.call(this, target, ...rest);
      if (target instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser();
        connect.call(this, analyser);
        window.__listening = analyser;
      }
      return made;
    };
    window.__loudest = async () => {
      const analyser = window.__listening;
      if (!analyser) return { state: "none", peak: 0 };
      const samples = new Float32Array(analyser.fftSize);
      let peak = 0;
      for (let read = 0; read < 10 && peak === 0; read += 1) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        analyser.getFloatTimeDomainData(samples);
        peak = Math.max(...samples.map(Math.abs));
      }
      return { state: analyser.context.state, peak };
    };
  });
  await prefs.getByText("Glass", { exact: true }).click();
  const heard = await page.evaluate(() => window.__loudest());
  step(
    "choosing an alert sounds through a running audio context",
    heard.state === "running" && heard.peak > 0.01,
    JSON.stringify(heard),
  );
  await page.evaluate(() => {
    window.__listening = null;
  });
  await prefs.getByRole("checkbox", { name: "Mute" }).click();
  await prefs.getByText("Ping", { exact: true }).click();
  const silence = await page.evaluate(() => window.__loudest());
  step("and is silent while muted", silence.peak === 0, JSON.stringify(silence));
  await prefs.getByRole("checkbox", { name: "Mute" }).click();

  await openPaneNamed("Language & Region");
  await prefs.getByRole("checkbox", { name: "24-Hour Time" }).click();
  await page.waitForFunction(() =>
    /Clock, \w+ \d\d:\d\d$/.test(
      document.querySelector('[aria-label^="Clock, "]')?.getAttribute("aria-label") ?? "",
    ),
  );
  step("24-Hour Time changes the menu bar's clock", true);

  await openPaneNamed("Notifications");
  saved = nextSave(page, URL, (body) => body?.values?.["notifications.scheduled"] === true);
  await prefs.getByRole("checkbox", { name: "From:" }).click();
  await saved;

  saved = nextSave(page, URL, (body) => body?.values?.["window.pane"] === null);
  await page.keyboard.press(`${modifier}+l`);
  await saved;
});
