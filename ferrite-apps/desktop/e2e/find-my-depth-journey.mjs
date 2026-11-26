#!/usr/bin/env node
// Find My's depth on Ferrite: its menus, keys and context menus, each checked on the server or in
// the window, with real input only. Three browsers sign in to one new account, so that the first
// has other devices to act on; each is a real browser context reporting to the real module.
//
//   node e2e/find-my-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, options, shot } from "./app-journey.mjs";
import { reloadDesktop } from "./journey-kit.mjs";
import { chooseMenu, closeMenus, createAccount, person, signIn } from "./media-census-kit.mjs";

const DEVICES = "/api/find-my/devices";
const LIBRARY = "/api/app-store/library";
const HERE = { latitude: 37.8199, longitude: -122.4783, accuracy: 25 };
const located = { permissions: ["geolocation"], geolocation: HERE };
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

const { base, out } = options();
const { step, run } = journey("find-my-depth", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: located, firefox: located, webkit: located },
});

const settledShot = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const listed = async (page) => (await api(page, "GET", DEVICES)).json.devices ?? [];
/** Wait until the server's devices satisfy `accept`; the devices, as they then are. */
async function devicesWhen(page, accept) {
  for (let waited = 0; waited < 15_000; waited += 250) {
    const devices = await listed(page);
    if (accept(devices)) return devices;
    await page.waitForTimeout(250);
  }
  return listed(page);
}

/** Another browser signed in to the account, reported as a device called `label` at `at`. */
async function otherDevice(page, who, label, at) {
  const context = await page.context().browser().newContext();
  const other = await context.newPage();
  await signIn(other, base, who);
  const reported = await api(other, "PUT", "/api/find-my/me", {
    ...at,
    accuracy_m: 20,
    label,
    reported_at: Date.now(),
  });
  await context.close();
  return reported.json.device;
}

const zoomOf = async (window) =>
  Number(
    /zoom (\d+)/.exec(
      await window.getByRole("application", { name: /^Map, zoom/ }).getAttribute("aria-label"),
    )?.[1],
  );

/** Whether the dot of the browser's location stands in the middle of the map. */
async function dotCentred(window) {
  const map = await window.getByRole("application", { name: /^Map, zoom/ }).boundingBox();
  const dot = await window.locator(".mac-maps-tiles-location").boundingBox();
  return (
    Math.abs(dot.x - (map.x + map.width / 2)) < 4 && Math.abs(dot.y - (map.y + map.height / 2)) < 4
  );
}

await run(async (page) => {
  const who = person("fm", Date.now().toString(36).slice(-6));
  await createAccount(page, base, who);
  const library = await api(page, "GET", LIBRARY);
  await api(page, "PUT", LIBRARY, {
    installed: [...new Set([...(library.json.installed ?? []), "find-my"])],
    rev: library.json.rev,
  });
  await reloadDesktop(page);
  const nearby = { lat: 37.8199, lon: -122.47 };
  const away = { lat: 37.81, lon: -122.4783 };
  const second = await otherDevice(page, who, "Firefox on Linux", nearby);
  const third = await otherDevice(page, who, "Safari on iPhone", away);
  step("two other browsers of the account report as devices", Boolean(second?.id && third?.id));
  const edge = await otherDevice(page, who, "Edge on Windows", { lat: 37.8199, lon: -122.4735 });
  const android = await otherDevice(page, who, "Chrome on Android", {
    lat: 37.8175,
    lon: -122.4735,
  });
  const opera = await otherDevice(page, who, "Opera on Mac", { lat: 37.8175, lon: -122.48 });

  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Find My");
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Find My", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await window.locator(".mac-maps-tiles-location .mac-maps-tiles-dot").waitFor({ timeout: 15_000 });
  const mine = (await devicesWhen(page, (all) => all.some((each) => each.this))).find(
    (each) => each.this,
  );
  step("this browser reports too", Boolean(mine));

  const segment = (name) => window.getByRole("radio", { name, exact: true });
  const devicesList = window.getByRole("listbox", { name: "Devices" });
  const row = (name) => devicesList.getByRole("option").filter({ hasText: name });

  // ---- Lists ----------------------------------------------------------------------------------
  await chooseMenu(page, "View", "Devices");
  await devicesList.waitFor({ timeout: 5_000 });
  step("View > Devices shows the Devices list", await segment("Devices").isChecked());
  await chooseMenu(page, "View", "People");
  await window.getByRole("listbox", { name: "People" }).waitFor({ timeout: 5_000 });
  step("View > People shows the People list", await segment("People").isChecked());
  await window.getByRole("listbox", { name: "People" }).click();
  await page.keyboard.press(`${COMMAND}+2`);
  await devicesList.waitFor({ timeout: 5_000 });
  step("Command-2 shows Devices", await segment("Devices").isChecked());
  await page.keyboard.press(`${COMMAND}+1`);
  await window.getByRole("listbox", { name: "People" }).waitFor({ timeout: 5_000 });
  step("Command-1 shows People", await segment("People").isChecked());

  // ---- Zoom -----------------------------------------------------------------------------------
  const start = await zoomOf(window);
  await chooseMenu(page, "View", "Zoom Out");
  step("View > Zoom Out zooms the map out", (await zoomOf(window)) === start - 1);
  await chooseMenu(page, "View", "Zoom In");
  step("View > Zoom In zooms the map in", (await zoomOf(window)) === start);
  await window.getByRole("listbox", { name: "People" }).click();
  await page.keyboard.press(`${COMMAND}+-`);
  step("Command-Minus zooms out", (await zoomOf(window)) === start - 1);
  await page.keyboard.press(`${COMMAND}+=`);
  step("Command-Plus zooms in", (await zoomOf(window)) === start);

  // ---- Current Location -----------------------------------------------------------------------
  await page.keyboard.press(`${COMMAND}+2`);
  await row("Safari on iPhone").click();
  const note = window.getByRole("status");
  await note.getByText("Safari on iPhone").waitFor({ timeout: 5_000 });
  step("choosing a device moves the map from the browser's place", !(await dotCentred(window)));
  await chooseMenu(page, "View", "Go to Current Location");
  await note.getByText("Current Location").waitFor({ timeout: 5_000 });
  step("View > Go to Current Location centres the map on it", await dotCentred(window));
  await row("Safari on iPhone").click();
  await note.getByText("Safari on iPhone").waitFor({ timeout: 5_000 });
  await page.keyboard.press(`${COMMAND}+l`);
  await note.getByText("Current Location").waitFor({ timeout: 5_000 });
  step("Command-L does the same", await dotCentred(window));

  await page.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Devices" }).waitFor({ timeout: 5_000 });
  await settledShot(page, "find-my-view-menu.png");
  step(
    "Hybrid and Satellite are dimmed with their reason",
    (await page.getByRole("menuitemradio", { name: "Hybrid" }).getAttribute("title"))?.includes(
      "no satellite imagery",
    ) &&
      (await page
        .getByRole("menuitemradio", { name: "Satellite" })
        .getAttribute("aria-disabled")) === "true",
  );
  await closeMenus(page);

  // ---- Edit's rows ----------------------------------------------------------------------------
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page.getByRole("menuitem", { name: "Undo" }).waitFor({ timeout: 5_000 });
  const reasons = {};
  for (const name of ["Undo", "Redo", "Cut", "Copy", "Paste"]) {
    reasons[name] = await page.getByRole("menuitem", { name, exact: true }).getAttribute("title");
  }
  step(
    "Edit's rows are dimmed, each with a reason",
    Object.values(reasons).every(Boolean),
    JSON.stringify(reasons),
  );
  await settledShot(page, "find-my-edit-menu.png");
  await closeMenus(page);

  // ---- Contextual menus -----------------------------------------------------------------------
  const selectedRow = page.locator('.mac-find-my [role="option"][aria-selected="true"]');
  await row("This browser").click();
  const first = await selectedRow.innerText();
  await page.keyboard.press("ArrowDown");
  const below = await selectedRow.innerText();
  const cardTitle = window.locator(".mac-find-my-device-name");
  step(
    "the Down Arrow selects the next row, and the card follows",
    below !== first && below.includes(await cardTitle.innerText()),
    below.replace(/\s+/g, " "),
  );
  await page.keyboard.press("ArrowUp");
  step("the Up Arrow goes back", (await selectedRow.innerText()) === first);

  const hybrid = window.getByRole("radio", { name: "Hybrid" });
  step(
    "the window's map types show Map, with the others dimmed and saying why",
    (await window.getByRole("radio", { name: "Map", exact: true }).isChecked()) &&
      (await hybrid.getAttribute("aria-disabled")) === "true" &&
      (await window.getByRole("radio", { name: "Satellite" }).getAttribute("aria-disabled")) ===
        "true" &&
      Boolean(await window.locator('[title*="no satellite imagery"]').count()),
  );
  await hybrid.click({ force: true });
  step(
    "a click on Hybrid changes nothing",
    await window.getByRole("radio", { name: "Map", exact: true }).isChecked(),
  );
  step(
    "the compass says the map does not rotate",
    (
      await window.getByRole("group", { name: "Compass", exact: true }).getAttribute("title")
    )?.includes("does not rotate"),
  );
  await settledShot(page, "find-my-map-types.png");

  await page.getByRole("menuitem", { name: "Find My", exact: true }).click();
  const preferences = page.getByRole("menuitem", { name: /^Preferences/ });
  await preferences.waitFor({ timeout: 5_000 });
  step(
    "Preferences is dimmed, saying why",
    (await preferences.getAttribute("aria-disabled")) === "true" &&
      (await preferences.getAttribute("title")) === "Find My has no preferences",
  );
  await settledShot(page, "find-my-app-menu.png");
  await closeMenus(page);

  // ---- Contextual menus -----------------------------------------------------------------------
  const menuItem = (name) => page.getByRole("menuitem", { name, exact: true });
  const selectedRows = page.locator('.mac-find-my [role="option"][aria-selected="true"]');
  await row("This browser").click();
  await page.keyboard.press(`${COMMAND}+1`);
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const selectAll = page.getByRole("menuitem", { name: "Select All", exact: true });
  await selectAll.waitFor({ timeout: 5_000 });
  step(
    "Select All is dimmed under People, saying why",
    (await selectAll.getAttribute("aria-disabled")) === "true" &&
      (await selectAll.getAttribute("title"))?.includes("Only the Devices list"),
  );
  await closeMenus(page);
  await window
    .getByRole("listbox", { name: "People" })
    .getByRole("option")
    .first()
    .click({ button: "right" });
  await menuItem("Go to Current Location").click();
  await note.getByText("Current Location").waitFor({ timeout: 5_000 });
  step("the person's row has a menu that shows their place", await dotCentred(window));
  await page.keyboard.press(`${COMMAND}+2`);

  await row("Edge on Windows").click({ button: "right" });
  await menuItem("Play Sound").waitFor({ timeout: 5_000 });
  step(
    "a right-click selects the row and opens its menu",
    (await selectedRows.innerText()).includes("Edge on Windows"),
  );
  step(
    "Directions is offered for another device, and dimmed for this browser",
    (await menuItem("Directions").getAttribute("aria-disabled")) !== "true",
  );
  await settledShot(page, "find-my-row-menu.png");
  await menuItem("Play Sound").click();
  const asked = await devicesWhen(
    page,
    (all) => all.find((each) => each.id === edge.id)?.sound_pending,
  );
  step(
    "Play Sound from the row's menu is recorded for that device",
    asked.find((each) => each.id === edge.id)?.sound_pending === true,
  );

  await row("Edge on Windows").click({ button: "right" });
  await menuItem("Directions").click();
  const maps = page.getByRole("region", { name: "Maps", exact: true }).first();
  const end = maps.getByRole("textbox", { name: "End" });
  await end.waitFor({ timeout: 15_000 });
  step(
    "Directions opens Maps with the device at the end of the journey",
    (await end.inputValue()) === "Edge on Windows",
    await end.inputValue(),
  );
  const answered = maps.locator(".mac-maps-journey-summary").or(maps.getByText(/^No route/));
  await answered.first().waitFor({ timeout: 30_000 });
  step(
    "Maps answers with a route to the device",
    (await maps.locator(".mac-maps-journey-summary").count()) === 1,
    await answered.first().innerText(),
  );
  await settledShot(page, "find-my-directions.png");
  await maps.getByRole("button", { name: "Close" }).first().click();
  await maps.waitFor({ state: "hidden", timeout: 5_000 });

  await row("This browser").click({ button: "right" });
  await menuItem("Remove This Device").waitFor({ timeout: 5_000 });
  step(
    "Directions is dimmed for this browser, saying why",
    (await menuItem("Directions").getAttribute("aria-disabled")) === "true" &&
      (await menuItem("Directions").getAttribute("title"))?.includes("already are"),
  );
  step(
    "the menu of this browser's row dims Remove, saying why",
    (await menuItem("Remove This Device").getAttribute("title"))?.includes("cannot remove itself"),
  );
  await closeMenus(page);

  // ---- The marker's menu ----------------------------------------------------------------------
  await page.keyboard.press(`${COMMAND}+l`);
  const marker = window.locator(`[data-marker="${opera.id}"] .mac-find-my-marker-disc`);
  await marker.waitFor({ timeout: 10_000 });
  await marker.click({ button: "right" });
  await menuItem("Play Sound").waitFor({ timeout: 5_000 });
  await settledShot(page, "find-my-marker-menu.png");
  await menuItem("Play Sound").click();
  const rung = await devicesWhen(
    page,
    (all) => all.find((each) => each.id === opera.id)?.sound_pending,
  );
  step(
    "Play Sound from a marker's menu is recorded for that device",
    rung.find((each) => each.id === opera.id)?.sound_pending === true,
  );
  await marker.click({ button: "right" });
  await menuItem("Remove This Device").click();
  const asking = page.getByRole("alertdialog");
  step(
    "Remove from a marker's menu asks about that device",
    (await asking.innerText()).includes("Remove \u201cOpera on Mac\u201d from Find My?"),
  );
  await asking.getByRole("button", { name: "Remove" }).click();
  const gone = await devicesWhen(page, (all) => !all.some((each) => each.id === opera.id));
  step("and removes it on the server", !gone.some((each) => each.id === opera.id));
  await marker.waitFor({ state: "detached", timeout: 10_000 });
  step("and its marker goes", true);

  // ---- Several devices ------------------------------------------------------------------------
  await row("Edge on Windows").click();
  await row("Chrome on Android").click({ modifiers: [COMMAND] });
  step(
    "Command-click selects a second device, and the card goes",
    (await selectedRows.count()) === 2 &&
      (await window.locator(".mac-find-my-device-card").count()) === 0,
  );
  await row("Edge on Windows").click({ button: "right" });
  await menuItem("Remove 2 Devices").waitFor({ timeout: 5_000 });
  step("a right-click inside the selection keeps it", (await selectedRows.count()) === 2);
  await settledShot(page, "find-my-several-menu.png");
  await menuItem("Play Sound").click();
  const both = await devicesWhen(page, (all) =>
    [edge.id, android.id].every((id) => all.find((each) => each.id === id)?.sound_pending),
  );
  step(
    "Play Sound asks each selected device",
    [edge.id, android.id].every((id) => both.find((each) => each.id === id)?.sound_pending),
  );

  await chooseMenu(page, "Edit", "Select All");
  const total = await devicesList.getByRole("option").count();
  step(
    "Edit > Select All selects every device",
    (await selectedRows.count()) === total,
    `${total}`,
  );
  await row("This browser").click();
  await page.keyboard.press(`${COMMAND}+a`);
  step("Command-A does the same", (await selectedRows.count()) === total);
  await page.keyboard.press("Backspace");
  step(
    "Delete leaves this browser out of what it asks about",
    (await asking.innerText()).includes(`Remove ${total - 1} devices from Find My?`),
  );
  await asking.getByRole("button", { name: "Cancel" }).click();
  await asking.waitFor({ state: "hidden", timeout: 5_000 });

  await row("Edge on Windows").click();
  await row("Chrome on Android").click({ modifiers: [COMMAND] });
  await row("Edge on Windows").click({ button: "right" });
  await menuItem("Remove 2 Devices").click();
  step(
    "the row's menu asks about both",
    (await asking.innerText()).includes("Remove 2 devices from Find My?"),
  );
  await asking.getByRole("button", { name: "Remove" }).click();
  const none = await devicesWhen(
    page,
    (all) => !all.some((each) => each.id === edge.id || each.id === android.id),
  );
  step(
    "and removes both on the server, and only them",
    !none.some((each) => each.id === edge.id || each.id === android.id) &&
      none.some((each) => each.id === second.id),
  );

  // ---- Delete ---------------------------------------------------------------------------------
  await row("This browser").click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const dimmedDelete = page.getByRole("menuitem", { name: "Delete", exact: true });
  await dimmedDelete.waitFor({ timeout: 5_000 });
  step(
    "Delete is dimmed on this browser, saying why",
    (await dimmedDelete.getAttribute("title"))?.includes("cannot remove itself"),
  );
  await closeMenus(page);
  await row("This browser").click();
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300);
  step(
    "the Delete key asks nothing on this browser",
    (await page.getByRole("alertdialog").count()) === 0,
  );

  await row("Firefox on Linux").click();
  await page.keyboard.press("Backspace");
  const ask = page.getByRole("alertdialog");
  await ask.waitFor({ timeout: 5_000 });
  step(
    "the Delete key asks before removing the device",
    (await ask.innerText()).includes("Remove \u201cFirefox on Linux\u201d from Find My?"),
  );
  await settledShot(page, "find-my-delete-alert.png");
  await ask.getByRole("button", { name: "Cancel" }).click();
  await ask.waitFor({ state: "hidden", timeout: 5_000 });
  step(
    "Cancel keeps it on the server",
    (await listed(page)).some((each) => each.id === second.id),
  );
  await row("Firefox on Linux").click();
  await page.keyboard.press("Backspace");
  await ask.getByRole("button", { name: "Remove" }).click();
  const left = await devicesWhen(page, (all) => !all.some((each) => each.id === second.id));
  step(
    "Remove takes it off the server, and only it",
    !left.some((each) => each.id === second.id) && left.some((each) => each.id === third.id),
    `${left.length} devices left`,
  );
  await row("Firefox on Linux").waitFor({ state: "detached", timeout: 10_000 });
  step("the row goes from the list", true);

  await row("Safari on iPhone").click();
  await chooseMenu(page, "Edit", "Delete");
  await ask.getByRole("button", { name: "Remove" }).click();
  await devicesWhen(page, (all) => !all.some((each) => each.id === third.id));
  step("Edit > Delete does the same", !(await listed(page)).some((each) => each.id === third.id));

  // ---- Help -----------------------------------------------------------------------------------
  await chooseMenu(page, "Help", "Find My Help");
  await page.getByRole("toolbar", { name: "Help Viewer toolbar" }).waitFor({ timeout: 15_000 });
  step("Help > Find My Help opens Help Viewer", true);
  await settledShot(page, "find-my-help.png");
});

process.exit(0);
