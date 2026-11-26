#!/usr/bin/env node
// Find My's rows of the inventory that had no picture of their own, in a real account with other
// real browsers reporting as its devices: got from the App Store, the Share My Location row, the
// Devices list, map markers, the device's card, Play Sound and Remove asked of the server, the map
// dragged, the devices kept over a reload, and what the window says with no location or no server.
// The browser's location is fixed by the context, and the failed read is a Playwright route.
//
//   node e2e/find-my-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import {
  chooseMenu,
  closeMenus,
  createAccount,
  menuItemState,
  person,
  signIn,
  until,
} from "./media-census-kit.mjs";

const DEVICES = "/api/find-my/devices";
const ME = "/api/find-my/me";
const LIBRARY = "/api/app-store/library";
const HERE = { latitude: 37.8199, longitude: -122.4783, accuracy: 25 };
const located = { permissions: ["geolocation"], geolocation: HERE };
const { base, out } = options();
const { step, run, expectRefusal } = journey("find-my-rows", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: located },
});

const settled = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const devices = async (page) => (await api(page, "GET", DEVICES)).json.devices ?? [];
const windowOf = (page) => page.getByRole("region", { name: "Find My", exact: true }).first();

/** Waits for what the page is reading to end, so a reload aborts none of it. */
function requestsUnderWay(page) {
  const open = new Set();
  page.on("request", (request) => {
    if (!/^\/(live|__forge)\//.test(new URL(request.url()).pathname)) open.add(request);
  });
  for (const end of ["requestfinished", "requestfailed"])
    page.on(end, (request) => open.delete(request));
  return () => until(async () => open.size === 0, 30_000);
}

async function otherDevice(page, who, label, at) {
  const context = await page.context().browser().newContext();
  const other = await context.newPage();
  await signIn(other, base, who);
  const reported = await api(other, "PUT", ME, {
    ...at,
    accuracy_m: 20,
    label,
    reported_at: Date.now(),
  });
  await context.close();
  return reported.json.device;
}

await run(async (page) => {
  const quiet = requestsUnderWay(page);
  const who = person("fmr", Date.now().toString(36).slice(-6));
  await createAccount(page, base, who);
  step("a new account is signed in", true);

  // ---- Got from the App Store ------------------------------------------------------------------
  step(
    "Find My does not come with the desktop",
    !((await api(page, "GET", LIBRARY)).json.installed ?? []).includes("find-my"),
  );
  await launch(page, "App Store");
  const store = page.getByRole("region", { name: "App Store" }).first();
  await store.waitFor({ state: "visible", timeout: 15_000 });
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 30_000 });
  await store.getByRole("searchbox", { name: "Search" }).fill("Find My");
  await store.getByRole("button", { name: "Get, Find My" }).first().click();
  await store.getByRole("button", { name: "Install, Find My" }).first().click();
  const openFromStore = store.getByRole("button", { name: "Open, Find My" }).first();
  await openFromStore.waitFor({ timeout: 30_000 });
  step(
    "the App Store's Get installs it in the account's library",
    ((await api(page, "GET", LIBRARY)).json.installed ?? []).includes("find-my"),
  );
  await settled(page, "find-my-rows-got.png");

  const nearby = { lat: 37.8199, lon: -122.47 };
  const away = { lat: 37.81, lon: -122.4783 };
  const second = await otherDevice(page, who, "Firefox on Linux", nearby);
  const third = await otherDevice(page, who, "Safari on iPhone", away);
  step("two other browsers of the account report as devices", Boolean(second?.id && third?.id));

  await openFromStore.click();
  const window = windowOf(page);
  await window.waitFor({ state: "visible", timeout: 15_000 });
  step("its Open opens the window", true);
  await store.getByRole("button", { name: "Close" }).first().click();
  await store.waitFor({ state: "detached", timeout: 10_000 });

  await window.locator(".mac-maps-tiles-location .mac-maps-tiles-dot").waitFor({ timeout: 20_000 });
  step(
    "this browser reports as a device too",
    await until(async () => (await devices(page)).some((each) => each.this), 15_000),
  );

  // ---- File > Share My Location ----------------------------------------------------------------
  const share = await menuItemState(page, "File", "Share My Location");
  step("File > Share My Location is enabled for someone signed in", !share.disabled, share.title);
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Share My Location", exact: true }).waitFor();
  await settled(page, "find-my-rows-file-menu.png");
  await closeMenus(page);

  // ---- Devices list, markers and the card ------------------------------------------------------
  await chooseMenu(page, "View", "Devices");
  const list = window.getByRole("listbox", { name: "Devices" });
  const row = (name) => list.getByRole("option").filter({ hasText: name }).first();
  await row("Firefox on Linux").waitFor({ timeout: 20_000 });
  await row("Safari on iPhone").waitFor({ timeout: 20_000 });
  await row("This browser").waitFor({ timeout: 20_000 });
  step(
    "Devices lists each browser, with the time it was last seen",
    (await list.getByRole("option").count()) === 3 &&
      /ago|now/i.test(await row("Firefox on Linux").innerText()),
    (await row("Firefox on Linux").innerText()).replace(/\s+/g, " "),
  );
  await page.keyboard.press("ControlOrMeta+-");
  await page.keyboard.press("ControlOrMeta+-");
  await page.waitForTimeout(600);
  const markers = window.locator("[data-marker]");
  step(
    "the map has a marker for each other device, and the blue dot for this one",
    (await markers.count()) === 2 &&
      (await window.locator(".mac-maps-tiles-location .mac-maps-tiles-dot").count()) === 1,
    `${await markers.count()} markers`,
  );
  await settled(page, "find-my-rows-map.png");

  await row("Firefox on Linux").click();
  const card = window.getByRole("region", { name: "Firefox on Linux" });
  await card.waitFor({ timeout: 10_000 });
  step(
    "the card shows the device's position, and its marker names it",
    (await card.getByText("37.81990° N, 122.47000° W", { exact: false }).count()) === 1 &&
      (await window.locator("[data-marker][data-selected]").count()) === 1 &&
      (await window.locator(".mac-find-my-marker-name").innerText()) === "Firefox on Linux",
  );
  await settled(page, "find-my-rows-card.png");

  // ---- Play Sound ------------------------------------------------------------------------------
  await card.getByRole("button", { name: "Play Sound" }).click();
  step(
    "Play Sound is asked of the device on the server, and the window says so",
    (await until(
      async () => (await devices(page)).find((each) => each.id === second.id)?.sound_pending,
      10_000,
    )) &&
      (await until(async () =>
        /plays the sound when Find My is next open/.test(
          await window.locator(".mac-find-my-note").innerText(),
        ),
      )),
  );
  await settled(page, "find-my-rows-play-sound.png");

  // ---- Dragging the map moves it ----------------------------------------------------------------
  const map = window.getByRole("application", { name: /^Map, zoom/ });
  const dot = window.locator(".mac-maps-tiles-location");
  const box = await map.boundingBox();
  const before = await dot.boundingBox();
  const startX = box.x + box.width * 0.6;
  const startY = box.y + box.height * 0.6;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 60, startY - 40, { steps: 4 });
  await page.mouse.move(startX - 120, startY - 80, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await dot.boundingBox();
  step(
    "dragging the map carries what is on it with the pointer",
    Math.abs(before.x - after.x - 120) < 3 && Math.abs(before.y - after.y - 80) < 3,
    `moved ${before.x - after.x}, ${before.y - after.y}`,
  );
  await settled(page, "find-my-rows-dragged.png");

  // ---- Kept on the server over a reload ---------------------------------------------------------
  await quiet();
  await reloadDesktop(page);
  const kept = await devices(page);
  step(
    "after a reload the server still holds all three devices, before the window reports again",
    kept.length === 3 && kept.some((each) => each.id === third.id),
    kept.map((each) => each.label).join(", "),
  );
  const again = windowOf(page);
  if (!(await again.isVisible())) await launch(page, "Find My");
  await again.waitFor({ state: "visible", timeout: 15_000 });
  await chooseMenu(page, "View", "Devices");
  const listAgain = again.getByRole("listbox", { name: "Devices" });
  await listAgain.getByRole("option").filter({ hasText: "Safari on iPhone" }).waitFor({
    timeout: 20_000,
  });
  step("and Devices lists them", (await listAgain.getByRole("option").count()) === 3);
  await settled(page, "find-my-rows-kept.png");

  // ---- Remove This Device ------------------------------------------------------------------------
  await listAgain.getByRole("option").filter({ hasText: "Safari on iPhone" }).click();
  const third2 = again.getByRole("region", { name: "Safari on iPhone" });
  await third2.waitFor({ timeout: 10_000 });
  await third2.getByRole("button", { name: "Remove This Device" }).click();
  const question = page.getByRole("alertdialog");
  await question.waitFor({ timeout: 5_000 });
  await settled(page, "find-my-rows-remove.png");
  await question.getByRole("button", { name: "Remove", exact: true }).click();
  step(
    "Remove This Device asks, then forgets that device and no other on the server",
    await until(async () => {
      const held = await devices(page);
      return held.length === 2 && !held.some((each) => each.id === third.id);
    }, 15_000),
  );
  await listAgain.getByRole("option").filter({ hasText: "Safari on iPhone" }).waitFor({
    state: "detached",
    timeout: 15_000,
  });
  step("and it leaves the list", true);

  // ---- The server does not answer ----------------------------------------------------------------
  for (let refusal = 0; refusal < 6; refusal += 1) expectRefusal(503, DEVICES);
  await page.route(
    (url) => url.pathname === DEVICES,
    (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  const refreshFailed = again.getByRole("alert").filter({ hasText: /could not be refreshed/ });
  await refreshFailed.waitFor({ timeout: 25_000 });
  step("a failed read says the list is as of when it was read", true);
  await settled(page, "find-my-rows-read-failed.png");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await refreshFailed.waitFor({ state: "detached", timeout: 25_000 });
  step("and the next read clears that", true);

  // ---- No location: permission refused, in a browser of the same account ---------------------------
  const refused = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 900 },
    });
  const denied = await refused.newPage();
  // Refused the way a person refuses it: the browser's own permission, set to denied.
  const browserSession = await refused.newCDPSession(denied);
  const { targetInfo } = await browserSession.send("Target.getTargetInfo");
  await browserSession.send("Browser.setPermission", {
    permission: { name: "geolocation" },
    setting: "denied",
    origin: new URL(base).origin,
    browserContextId: targetInfo.browserContextId,
  });
  await signIn(denied, base, who);
  const deniedWindow = windowOf(denied);
  await denied.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = denied.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Find My");
  await denied.waitForTimeout(300);
  await field.press("Enter");
  await deniedWindow.waitFor({ state: "visible", timeout: 15_000 });
  await deniedWindow.getByRole("radio", { name: "People", exact: true }).click();
  const note = deniedWindow.locator(".mac-find-my-note");
  step(
    "with location refused, the window says so and shows no dot",
    await until(async () => /Location access is turned off/.test(await note.innerText()), 15_000),
    await note.innerText(),
  );
  step(
    "and shows no position for this browser",
    (await deniedWindow.locator(".mac-maps-tiles-location").count()) === 0,
  );
  await denied.waitForTimeout(400);
  await shot(denied, path.join(out, "find-my-rows-denied.png"));
  await refused.close();
  await quiet();
});

process.exit(0);
