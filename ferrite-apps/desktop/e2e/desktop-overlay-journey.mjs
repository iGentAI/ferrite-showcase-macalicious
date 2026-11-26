#!/usr/bin/env node
// A modal menu keeps the keyboard, so no key takes away the window of an open pop-up button and leaves its menu and
// full-page backdrop over the desktop; and the last open rows of the desktop: a further window staying when its main
// window closes, Quick Look alone, a window's picture on its application's tile, the View Options window kept, an
// application refused by the desktop, a folder on Terminal's tile, Help Viewer's level, and the watch for new episodes.
//
//   node e2e/desktop-overlay-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { api, journey, launch, openDesktop, options, reloadDesktop } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base } = options();
const { step, run } = journey("desktop-overlay");
const tag = Date.now().toString(36);
const NOTE = `Overlay ${tag}.txt`;
const FOLDER = `Overlay folder ${tag}`;
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

const settings = async (page) => (await api(page, "GET", SETTINGS)).json.values ?? {};

await run(async (page) => {
  let watched = 0;
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/podcasts/watch" && response.status() === 200)
      watched += 1;
  });
  await openDesktop(page, base, step);
  step(
    "the desktop asks the server to look for new episodes after sign-in",
    await until(() => watched === 1),
  );

  const bar = page.locator(".mac-menu-bar");
  const frame = (id) => page.locator(`.mac-managed-window[data-window-id="${id}"]`);
  const shownWindow = (id) => frame(id).locator(".mac-window").first();
  const backdrop = page.locator("[role=presentation][data-base-ui-inert]:not([inert])");
  const icon = (name) => page.locator(".mac-desktop-icon", { hasText: name }).first();
  const dockTile = (id) => page.locator(`.mac-dock [data-dock-target="${id}"]`);
  const dragTo = async (from, to) => {
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
  };

  await launch(page, "Stickies");
  await page.locator(".mac-sticky-note-text").first().click();
  await bar.getByRole("menuitem", { name: "Font", exact: true }).click();
  await page.getByRole("menuitem", { name: /Show Fonts/ }).click();
  const popUp = page.getByRole("combobox", { name: "Text underline" });
  for (const [key, what] of [
    ["ControlOrMeta+h", "Hide"],
    ["ControlOrMeta+m", "Minimize"],
    ["ControlOrMeta+w", "Close"],
  ]) {
    await popUp.click();
    await until(() => backdrop.count());
    await page.keyboard.press(key);
    await page.waitForTimeout(400);
    step(
      `${what}'s key leaves the pop-up button's window while its menu is open`,
      await popUp.isVisible(),
    );
    await page.keyboard.press("Escape");
    step(
      `Escape closes that menu and its backdrop (${what})`,
      await until(async () => (await backdrop.count()) === 0),
    );
  }
  await popUp.click();
  await until(() => backdrop.count());
  await page.mouse.click(1300, 620);
  step("a click elsewhere closes it too", await until(async () => (await backdrop.count()) === 0));
  await dockTile("terminal").click({ timeout: 5_000 });
  step(
    "the Dock takes a click once the menu has closed",
    await until(() => frame("terminal").isVisible()),
  );
  await bar.getByRole("menuitem", { name: "Terminal", exact: true }).first().click();
  await page.getByRole("menuitem", { name: /^Quit Terminal/ }).click();
  await until(async () => (await frame("terminal").count()) === 0);
  await bar.getByRole("menuitem", { name: "Stickies", exact: true }).first().click();
  await page.keyboard.press("Escape");

  await uploadFile(page, { parent: "desktop", name: NOTE, type: "text/plain", text: NOTE });
  await reloadDesktop(page);
  await until(() => icon(NOTE).isVisible());

  // Quick Look of an icon: the panel alone, with no Finder window on the screen.
  await icon(NOTE).click();
  await page.keyboard.press("Space");
  const look = frame("finder:quick-look");
  step("Quick Look of a desktop icon opens", await until(() => look.isVisible()));
  await page.waitForTimeout(500);
  step("its Finder window is not on the screen", !(await shownWindow("finder").isVisible()));
  step(
    "no Dock tile stands for that window",
    (await page.locator('.mac-dock [aria-label$=", minimized window"]').count()) === 0,
  );
  await look.getByRole("button", { name: "Close" }).first().click();
  step(
    "closing the panel ends its Finder window as well",
    await until(async () => (await frame("finder").count()) === 0),
  );

  // A further window stays when its main window closes.
  await icon(NOTE).click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Get Info/ }).click();
  const info = frame("finder:info");
  step("Get Info opens its window and Finder's", await until(() => info.isVisible()));
  await frame("finder").getByRole("button", { name: "Close" }).first().click();
  await page.waitForTimeout(500);
  step("the Info window stays when the main window closes", await info.isVisible());
  step("the main window is gone from the screen", !(await shownWindow("finder").isVisible()));
  await info.getByRole("button", { name: "Close" }).first().click();
  step(
    "closing the last further window ends the main one",
    await until(async () => (await frame("finder").count()) === 0),
  );

  // The application refused on the desktop, in a sentence.
  await launch(page, "Finder");
  await until(() => shownWindow("finder").isVisible());
  await bar.getByRole("menuitem", { name: "Go", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Applications/ }).click();
  const application = frame("finder")
    .getByRole("option", { name: /^Calculator/ })
    .first();
  await until(() => application.isVisible());
  const before = ((await api(page, "GET", "/api/files/")).json.entries ?? []).length;
  await frame("finder").evaluate((element) => {
    element.style.transform = "translate(380px, 30px)";
  });
  await page.waitForTimeout(100);
  const box = await application.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 18, { steps: 3 });
  await page.mouse.move(60, 500, { steps: 8 });
  await page.mouse.up();
  const sentence = page.getByText("An application from Launchpad only goes in the Dock.");
  step(
    "an application dropped on the desktop is refused with a sentence",
    await until(() => sentence.isVisible()),
  );
  step(
    "and nothing is copied to the drive",
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).length === before,
  );
  await page.getByRole("alertdialog").getByRole("button", { name: "OK" }).click();

  // A folder on Terminal's tile: a shell there.
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "desktop", name: FOLDER }],
  });
  await reloadDesktop(page);
  await until(() => icon(FOLDER).isVisible());
  await launch(page, "Terminal");
  await until(() => frame("terminal").isVisible());
  await dragTo(icon(FOLDER), dockTile("terminal"));
  const inFolder = page
    .locator(".mac-window", { hasText: FOLDER })
    .filter({ has: page.locator(".mac-terminal-row") });
  step(
    "a folder dropped on Terminal's tile opens a shell there",
    await until(() => inFolder.first().isVisible(), 12_000),
  );
  await inFolder.first().click();
  await page.keyboard.type("pwd\n");
  step(
    "the shell's working folder is that folder",
    await until(async () => (await inFolder.first().innerText()).includes(`/Desktop/${FOLDER}`)),
  );

  // Help Viewer floats over a window brought forward after it.
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Help Viewer");
  await page.getByRole("option", { name: "Help Viewer", exact: true }).first().waitFor();
  await field.press("Enter");
  const help = frame("help-viewer");
  await until(() => help.isVisible());
  await launch(page, "Calculator");
  await until(() => frame("calculator").isVisible());
  const levels = await page.evaluate(() =>
    ["help-viewer", "calculator"].map((id) =>
      Number(
        getComputedStyle(document.querySelector(`.mac-managed-window[data-window-id="${id}"]`))
          .zIndex,
      ),
    ),
  );
  step(
    "Help Viewer stands above a window brought forward after it",
    levels[0] > levels[1],
    levels.join(" over "),
  );
  step(
    "and the menu bar is that window's application",
    await bar.getByRole("menuitem", { name: "Calculator", exact: true }).first().isVisible(),
  );
  await help.getByRole("button", { name: "Close" }).first().click();

  // A window minimized into its application's tile shows its picture there.
  const { json } = await api(page, "GET", SETTINGS);
  await page.waitForTimeout(2_500);
  await api(page, "PUT", SETTINGS, {
    values: { ...(await settings(page)), "dock.minimizeIntoIcon": true },
    rev: (await api(page, "GET", SETTINGS)).json.rev ?? json.rev,
  });
  await reloadDesktop(page);
  await launch(page, "Calculator");
  await until(() => frame("calculator").isVisible());
  await page.keyboard.press("ControlOrMeta+m");
  const picture = dockTile("calculator").locator("[data-minimized-into]");
  step(
    "a window minimized into its tile shows its picture there",
    await until(() => picture.isVisible()),
  );
  await dockTile("calculator").click();
  step(
    "the picture goes when the window comes back",
    await until(async () => (await picture.count()) === 0),
  );

  // The View Options window: open and where it stands kept with the account.
  await frame("calculator").getByRole("button", { name: "Close" }).first().click();
  await page.mouse.click(60, 500, { button: "right" });
  await page.getByRole("menuitem", { name: "Show View Options" }).click();
  const options_ = page.locator(".mac-desktop-shell-view-options");
  await options_.waitFor({ timeout: 5_000 });
  const title = await options_.boundingBox();
  await page.mouse.move(title.x + 40, title.y + 8);
  await page.mouse.down();
  await page.mouse.move(title.x + 110, title.y + 48, { steps: 5 });
  await page.mouse.up();
  const kept = await until(async () => {
    const value = (await settings(page))["desktop.viewOptionsWindow"];
    return value?.shown === true && value.x === 70 && value.y === 40 ? value : null;
  });
  step("where the window stands is read back from the server", Boolean(kept), JSON.stringify(kept));
  await reloadDesktop(page);
  step("the window is open again after a reload", await until(() => options_.isVisible()));
  step(
    "and stands where it was left",
    (await options_.getAttribute("style")).includes("translate(70px, 40px)"),
  );
  await options_.getByRole("button", { name: "Close" }).first().click();
  step(
    "closing it is kept too",
    await until(async () => (await settings(page))["desktop.viewOptionsWindow"]?.shown === false),
  );

  // A stack's tile follows the icon size.
  await page.waitForTimeout(2_500);
  const now = (await api(page, "GET", SETTINGS)).json;
  await api(page, "PUT", SETTINGS, {
    values: {
      ...now.values,
      "desktop.viewOptions": {
        ...now.values["desktop.viewOptions"],
        icon: 96,
        grid: 0,
        text: 12,
        label: "bottom",
        info: false,
        preview: true,
      },
    },
    rev: now.rev,
  });
  await reloadDesktop(page);
  await page.mouse.click(60, 500, { button: "right" });
  await page.getByRole("menuitem", { name: "Show View Options" }).click();
  await options_.waitFor({ timeout: 5_000 });
  await options_.getByRole("combobox", { name: "Stack By" }).click();
  await page.getByRole("option", { name: "Kind", exact: true }).filter({ visible: true }).click();
  const pile = page.locator(".mac-desktop-stack-pile").first();
  await pile.waitFor({ timeout: 5_000 });
  const width = (await pile.boundingBox()).width;
  step("a stack's tile is the size of the icons", Math.abs(width - 96) < 1, `${width} pt`);
  await options_.getByRole("combobox", { name: "Stack By" }).click();
  await page.getByRole("option", { name: "None", exact: true }).filter({ visible: true }).click();
  await options_.getByRole("button", { name: "Close" }).first().click();
});
