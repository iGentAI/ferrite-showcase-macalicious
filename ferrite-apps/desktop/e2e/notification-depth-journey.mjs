#!/usr/bin/env node
// Notification Center's depth: World Clock's cities chosen and kept, Do Not Disturb's schedule holding
// banners back, and a message answered on its banner, read from the server and by the other person.
//
//   node e2e/notification-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("notification-depth");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `ndchris-${id}`, fullName: `Chris ${id}`, password };
const ada = { name: `ndada-${id}`, fullName: `Ada ${id}`, password };
const SETTINGS = "/api/system-preferences/settings";

const url = (page, where) => new URL(where, page.url()).href;
const settings = async (page) => await (await page.request.get(url(page, SETTINGS))).json();
const setValues = async (page, values) => {
  const now = await settings(page);
  await page.request.put(url(page, SETTINGS), {
    data: { values: { ...(now.values ?? {}), ...values }, rev: now.rev },
  });
};
const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);
const panel = (page) => page.locator(".mac-notification-center");
const openPanel = async (page) => {
  await page
    .getByRole("button", { name: "Notification Center" })
    .or(page.locator('[aria-label="Notification Center"]'))
    .first()
    .click();
  await panel(page).getByRole("tab", { name: "Today" }).waitFor({ timeout: 8_000 });
};
const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const banner = (page, words) =>
  page.locator(".mac-desktop-shell-banners > *").filter({ hasText: words });

await run({}, {}, async ({ person }) => {
  const adaPage = await person("ada", ada);
  // Counted from the next reload on: what a notification's sound makes.
  await adaPage.addInitScript(() => {
    const make = BaseAudioContext.prototype.createOscillator;
    window.__tones = 0;
    BaseAudioContext.prototype.createOscillator = function () {
      window.__tones += 1;
      return make.call(this);
    };
  });
  const tones = () => adaPage.evaluate(() => window.__tones);
  const chrisPage = await person("chris", chris);

  // World Clock.
  await openPanel(adaPage);
  const today = panel(adaPage);
  await today.getByRole("tab", { name: "Today" }).click();
  const clocks = today.locator(".mac-desktop-shell-today-clock-city");
  step("World Clock starts with four cities", (await clocks.count()) === 4);
  await today.getByRole("button", { name: "Choose Cities…" }).click();
  await today.getByRole("button", { name: "Remove London" }).click();
  step(
    "Remove takes a city away, on the server",
    await seen(async () => (await settings(adaPage)).values?.["today.worldClocks"]?.length === 3),
  );
  await today.getByRole("textbox", { name: "Find a city" }).fill("pari");
  await today.getByRole("button", { name: "Add Paris" }).click();
  step(
    "A city found by name is added, on the server",
    await seen(async () =>
      (await settings(adaPage)).values?.["today.worldClocks"]?.includes("Europe/Paris"),
    ),
  );
  await shot(adaPage, "notification-cities");
  await today.getByRole("button", { name: "Done" }).click();
  step(
    "and shows its own clock",
    (await clocks.filter({ hasText: "Paris" }).count()) === 1 &&
      (await clocks.filter({ hasText: "London" }).count()) === 0,
  );
  await adaPage.waitForTimeout(800);
  await adaPage.reload({ waitUntil: "load" });
  await adaPage.getByRole("toolbar", { name: "Dock" }).waitFor({ timeout: 20_000 });
  await adaPage.waitForTimeout(800);
  await openPanel(adaPage);
  step(
    "It is there after a reload",
    await seen(async () => (await clocks.filter({ hasText: "Paris" }).count()) === 1),
  );
  await adaPage.keyboard.press("Escape");

  // Chris writes; Ada answers on the banner.
  await openFromDock(chrisPage, "Messages");
  await messagesOf(chrisPage).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(chrisPage).getByRole("textbox", { name: "To" }).fill(ada.name);
  const first = `hello ${id}`;
  await field(chrisPage).fill(first);
  await field(chrisPage).press("Enter");
  const note = banner(adaPage, first);
  await note.waitFor({ timeout: 15_000 });
  await note.getByRole("button", { name: "Reply" }).click();
  const reply = note.getByRole("textbox");
  await reply.waitFor({ timeout: 3_000 });
  await adaPage.waitForTimeout(6_000);
  step("The banner stays while the person answers", await reply.isVisible());
  const words = `answered ${id}`;
  await reply.fill(words);
  await shot(adaPage, "notification-reply");
  await reply.press("Enter");
  step(
    "Reply goes to the other person's conversation",
    await seen(() => messagesOf(chrisPage).getByRole("log").getByText(words).first().isVisible()),
  );
  step("and the banner goes", await seen(async () => (await note.count()) === 0));

  // The schedule, turned on inside its times from System Preferences: Do Not Disturb follows.
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  await setValues(adaPage, {
    "notifications.selected": "do-not-disturb",
    "notifications.from": (minutes + 1440 - 5) % 1440,
    "notifications.to": (minutes + 10) % 1440,
  });
  await adaPage.reload({ waitUntil: "load" });
  await adaPage.getByRole("toolbar", { name: "Dock" }).waitFor({ timeout: 20_000 });
  await adaPage.waitForTimeout(1_500);
  await adaPage
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const prefs = adaPage.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor();
  await prefs
    .getByRole("group", { name: "All preferences" })
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await prefs.getByRole("checkbox", { name: "From:" }).click();
  const inbox = async () =>
    (await (await adaPage.request.get(url(adaPage, "/api/notification-center/inbox"))).json()).dnd;
  step("Turned on inside its times, the schedule turns Do Not Disturb on", await seen(inbox));
  await field(chrisPage).fill(`quiet ${id}`);
  await field(chrisPage).press("Enter");
  await adaPage.waitForTimeout(3_000);
  step(
    "Inside the schedule no banner comes in",
    (await banner(adaPage, `quiet ${id}`).count()) === 0,
  );
  step("and no sound", (await tones()) === 0, String(await tones()));
  await openPanel(adaPage);
  await panel(adaPage).getByRole("tab", { name: "Notifications" }).click();
  step(
    "and the message still collects",
    await seen(() => panel(adaPage).getByText(`quiet ${id}`).first().isVisible()),
  );
  await panel(adaPage).getByRole("tab", { name: "Today" }).click();
  await panel(adaPage).getByRole("switch", { name: "Do Not Disturb" }).click();
  step("The person's own switch stands inside it", await seen(async () => !(await inbox())));
  await adaPage.keyboard.press("Escape");
  await adaPage.waitForTimeout(1_000);
  const loud = `loud ${id}`;
  await field(chrisPage).fill(loud);
  await field(chrisPage).press("Enter");
  step(
    "and a banner comes in again",
    await seen(async () => (await banner(adaPage, loud).count()) === 1),
  );
  step("with its sound", await seen(async () => (await tones()) > 0), String(await tones()));

  // Swiped away.
  const swiped = `swiped ${id}`;
  await field(chrisPage).fill(swiped);
  await field(chrisPage).press("Enter");
  const going = banner(adaPage, swiped);
  await going.waitFor({ timeout: 15_000 });
  const appeared = Date.now();
  const box = await going.boundingBox();
  await adaPage.mouse.move(box.x + 60, box.y + box.height / 2);
  await adaPage.mouse.down();
  await adaPage.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 3 });
  await adaPage.mouse.up();
  const back = await going.boundingBox();
  step(
    "Let go short, a banner comes back to where it was",
    (await going.count()) === 1 && Math.abs(back.x - box.x) < 1,
    `${box.x} and ${back.x}`,
  );
  await adaPage.mouse.move(back.x + 60, back.y + back.height / 2);
  await adaPage.mouse.down();
  await adaPage.mouse.move(back.x + 160, back.y + back.height / 2, { steps: 5 });
  const held = await going.boundingBox();
  step(
    "The banner follows the pointer",
    Math.abs(held.x - back.x - 100) < 2,
    `${back.x} to ${held.x}`,
  );
  await shot(adaPage, "notification-swiping");
  await adaPage.mouse.up();
  const left = await seen(async () => (await going.count()) === 0, 1_500);
  const took = Date.now() - appeared;
  // Its own time is 5 seconds from when it came: this is well inside that.
  step("Dragged to the right, it goes, before its time is up", left && took < 4_500, `${took} ms`);
  await openPanel(adaPage);
  await panel(adaPage).getByRole("tab", { name: "Notifications" }).click();
  step(
    "and stays in Notification Center",
    await seen(() => panel(adaPage).getByText(swiped).first().isVisible()),
  );
});
