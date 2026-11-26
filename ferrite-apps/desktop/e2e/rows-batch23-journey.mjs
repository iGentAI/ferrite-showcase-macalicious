#!/usr/bin/env node
// Preferences… on an application whose own Preferences window is already open: the command brings it
// in front of the application's main window and opens no second one, on every application that
// renders its Preferences itself and is on the Dock. Voice Memos is not, until it is fetched from
// the library; `desktop.test.tsx` holds it. Then All iCloud and All on My Mac, each listing only its
// own account's cards, as the server keeps them.
//
//   node e2e/rows-batch23-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("rows-batch23", { ignoreOtherOrigins: true });

// `behind`: what a press on the main window does to open Preferences. TV's are the modal kind, which
// keeps the main window inert; Music's and Photos' never go behind it.
const APPS = [
  { id: "chess", name: "Chess", behind: "covered" },
  { id: "terminal", name: "Terminal", behind: "covered" },
  { id: "mail", name: "Mail", behind: "covered" },
  { id: "podcasts", name: "Podcasts", behind: "covered" },
  { id: "music", name: "Music", behind: null },
  { id: "tv", name: "TV", behind: "modal" },
  { id: "photos", name: "Photos", behind: null },
];

const windowStates = (page) => page.locator("[data-window-state]");
const mainWindow = (page, id) =>
  page.locator(`[data-window-id="${id}"] [data-window-state]`).first();

const choosePreferences = async (page, name) => {
  await page.getByRole("menubar").getByRole("menuitem", { name, exact: true }).click();
  await page.getByRole("menuitem", { name: /^Preferences…/ }).click();
  await page.waitForTimeout(300);
};

/** The window that has appeared since `markKnownWindows`, marked so that it can be read again. */
const markNewWindow = (page) =>
  page.evaluate(() => {
    const added = document.querySelectorAll("[data-window-state]:not([data-journey-known])");
    for (const element of added) element.setAttribute("data-journey-preferences", "");
    return added.length;
  });

const markKnownWindows = (page) =>
  page.evaluate(() => {
    for (const element of document.querySelectorAll("[data-window-state]")) {
      element.setAttribute("data-journey-known", "");
      element.removeAttribute("data-journey-preferences");
    }
  });

/** A press on a part of the main window that no other window covers and that holds no control. */
const pressMain = async (page, id) => {
  const point = await page.evaluate((id) => {
    const frame = document.querySelector(`[data-window-id="${id}"]`);
    const main = frame.querySelector("[data-window-state]");
    const box = main.getBoundingClientRect();
    const control =
      "button, a, input, select, textarea, [role='button'], [role='tab'], [role='row']";
    for (let y = box.top + 8; y < box.bottom; y += 16) {
      for (let x = box.left + 90; x < box.right - 8; x += 40) {
        const at = document.elementFromPoint(x, y);
        if (at && frame.contains(at) && !at.closest(`[data-journey-preferences], ${control}`)) {
          return { x, y };
        }
      }
    }
    return null;
  }, id);
  if (!point) throw new Error(`no free part of the ${id} window to press`);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
};

const preferencesAtFront = (page) =>
  page.evaluate(() => {
    const window = document.querySelector("[data-journey-preferences]");
    const box = window.getBoundingClientRect();
    const at = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return window.contains(at);
  });

await run(async (page) => {
  await openDesktop(page, base, step);

  for (const { id, name, behind } of APPS) {
    await launch(page, name);
    await mainWindow(page, id).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await markKnownWindows(page);
    await choosePreferences(page, name);
    const added = await markNewWindow(page);
    step(`${name}: the command opens one Preferences window`, added === 1, `${added}`);
    const preferences = page.locator("[data-journey-preferences]");

    await pressMain(page, id);
    if (behind === "modal") {
      const main = mainWindow(page, id);
      step(
        `${name}: a press on its inert main window leaves the modal Preferences key`,
        (await main.evaluate((element) => element.inert)) &&
          (await main.getAttribute("data-window-state")) === "main" &&
          (await preferences.getAttribute("data-window-state")) === "key" &&
          (await preferencesAtFront(page)),
        await main.getAttribute("data-window-state"),
      );
      await launch(page, "Calculator");
      await page.waitForTimeout(500);
      const inactive = await preferences.getAttribute("data-window-state");
      await pressMain(page, id);
      const level = (app) =>
        page
          .locator(`[data-window-id="${app}"]`)
          .evaluate((element) => Number(element.style.zIndex));
      step(
        `${name}: and a press there from another application brings it forward, Preferences key`,
        inactive === "inactive" &&
          (await level(id)) > (await level("calculator")) &&
          (await preferences.getAttribute("data-window-state")) === "key",
        `${inactive} ${await level(id)} ${await level("calculator")}`,
      );
    } else if (behind) {
      step(
        `${name}: a press on its main window makes it key and Preferences ${behind}`,
        (await mainWindow(page, id).getAttribute("data-window-state")) === "key" &&
          (await preferences.getAttribute("data-window-state")) === "inactive" &&
          !(await preferencesAtFront(page)),
      );
      if (id === "chess" || id === "mail") {
        await shot(page, path.join(out, `${id}-preferences-behind.png`));
      }
    }

    const count = await windowStates(page).count();
    await choosePreferences(page, name);
    step(
      `${name}: Preferences… brings the open window to the front, key`,
      await until(
        async () =>
          (await preferences.getAttribute("data-window-state")) === "key" &&
          (await preferencesAtFront(page)),
        3_000,
      ),
      await preferences.getAttribute("data-window-state"),
    );
    step(`${name}: it opens no second window`, (await windowStates(page).count()) === count);
    if (id === "chess") await shot(page, path.join(out, "chess-preferences-raised.png"));

    await pressMain(page, id);
    await page.keyboard.press("ControlOrMeta+,");
    step(
      `${name}: Command-comma does the same`,
      await until(
        async () =>
          (await preferences.getAttribute("data-window-state")) === "key" &&
          (await preferencesAtFront(page)),
        3_000,
      ),
      await preferences.getAttribute("data-window-state"),
    );
  }

  const contacts = page.locator('.mac-contacts[aria-label="Contacts"]').first();
  const openContacts = async () => {
    await launch(page, "Contacts");
    await contacts.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(400);
  };
  const group = (label) =>
    contacts.getByRole("tree", { name: "Groups" }).getByRole("treeitem", { name: label });
  const listed = (name) =>
    contacts.getByRole("listbox").getByRole("option").filter({ hasText: name });
  const accountOf = async (first) =>
    page.evaluate(async (first) => {
      const reply = await fetch("/api/contacts/cards", { credentials: "same-origin" });
      return (await reply.json()).cards.find((card) => card.first === first)?.account;
    }, first);
  const addCard = async (label, first) => {
    await group(label).click();
    await contacts.getByRole("button", { name: "New Contact" }).click();
    await contacts.getByRole("textbox", { name: "First", exact: true }).fill(first);
    await contacts.getByRole("button", { name: "Done", exact: true }).click();
    await contacts.getByRole("button", { name: "Edit", exact: true }).waitFor({ timeout: 5_000 });
  };
  const mark = Date.now().toString(36).slice(-6);
  const cloud = `Cloudy${mark}`;
  const mac = `Macky${mark}`;
  const shows = async (label, wanted) => {
    await group(label).click();
    return until(
      async () =>
        (await listed(cloud).count()) === (wanted.includes(cloud) ? 1 : 0) &&
        (await listed(mac).count()) === (wanted.includes(mac) ? 1 : 0),
      5_000,
    );
  };

  await openContacts();
  await addCard("All iCloud", cloud);
  await addCard("All on My Mac", mac);
  step(
    "Contacts: each new card is kept in the account it was made in",
    await until(
      async () => (await accountOf(cloud)) === "icloud" && (await accountOf(mac)) === "mac",
      5_000,
    ),
    `${await accountOf(cloud)} ${await accountOf(mac)}`,
  );
  step("All iCloud lists the iCloud card and not the other", await shows("All iCloud", [cloud]));
  await shot(page, path.join(out, "contacts-all-icloud.png"));
  step("All on My Mac lists the other", await shows("All on My Mac", [mac]));
  step("All Contacts lists both", await shows("All Contacts", [cloud, mac]));

  await page.reload();
  await page.waitForTimeout(1_500);
  if ((await contacts.count()) === 0) await openContacts();
  await contacts.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  step("All iCloud lists the same after a reload", await shows("All iCloud", [cloud]));
});
