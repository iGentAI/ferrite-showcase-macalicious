#!/usr/bin/env node
// The Window menu's main-window row of Mail, Messages, Reminders, Calendar and FaceTime, in a real browser
// against the running app: with the application's Preferences window in front, the row brings the main window
// forward, and so does Command-0. Contacts has no second window to come forward from, so its row is only
// looked for. Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/apps-window-menu-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("apps-window-menu");
const id = Date.now().toString(36);
const chris = { name: `awchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const APPS = [
  ["Messages", "messages", "Messages"],
  ["Reminders", "reminders", "Reminders"],
  ["Calendar", "calendar", "Calendar"],
  ["FaceTime", "facetime", "FaceTime"],
];

const openMenu = async (page, title) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  return page.getByRole("menu").last();
};
const openApp = async (page, app) => {
  await page
    .getByRole("button", { name: new RegExp(`^${app}$`) })
    .first()
    .click();
  await page.getByRole("menubar").getByText(app, { exact: true }).first().waitFor();
  await page.waitForTimeout(800);
};
const stateOf = (page, windowId) =>
  page
    .locator(`[data-window-id="${windowId}"] [data-window-state]`)
    .first()
    .getAttribute("data-window-state");
const seen = (check) => within(8_000, check).then((took) => took !== null);
// The row itself shows the key, as a menu of a Mac does; the key works whether it does or not.
const showsKey = async (row) => /\+0$/.test((await row.getAttribute("aria-keyshortcuts")) ?? "");
const openPreferences = async (page, app, windowId) => {
  const menu = await openMenu(page, app);
  await menu.getByRole("menuitem", { name: /^Preferences/ }).click();
  return seen(async () => (await stateOf(page, windowId)) !== "key");
};

await run(
  { chromium: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
  {},
  async ({ person: open }) => {
    const page = await open("chris", chris);
    // Mail's Preferences stay in its window: a New Message is the other window to come back from.
    await openApp(page, "Mail");
    const newMessage = async () => {
      const file = await openMenu(page, "File");
      await file.getByRole("menuitem", { name: /^New Message/ }).click();
      return seen(async () => (await stateOf(page, "mail")) !== "key");
    };
    const composing = await newMessage();
    const windows = await openMenu(page, "Window");
    const viewerRow = windows.getByRole("menuitem", { name: /^Message Viewer/ }).first();
    const viewerShowsKey = await showsKey(viewerRow);
    await viewerRow.click();
    step(
      "Mail: the row names Command-0 and brings the viewer forward from a New Message",
      viewerShowsKey &&
        composing &&
        (await seen(async () => (await stateOf(page, "mail")) === "key")),
    );
    const composingAgain = await newMessage();
    step("Mail: New Message with one open brings that one forward", composingAgain);
    await page.keyboard.press("Control+0");
    step("Mail: so does its key", await seen(async () => (await stateOf(page, "mail")) === "key"));
    for (const [app, windowId, item] of APPS) {
      await openApp(page, app);
      const behind = await openPreferences(page, app, windowId);
      const menu = await openMenu(page, "Window");
      const row = menu.getByRole("menuitem", { name: new RegExp(`^${item}`) }).first();
      const rowShowsKey = await showsKey(row);
      await row.click();
      step(
        `${app}: the row names Command-0 and brings the main window forward from Preferences`,
        rowShowsKey &&
          behind &&
          (await seen(async () => (await stateOf(page, windowId)) === "key")),
      );
      const again = await openPreferences(page, app, windowId);
      await page.keyboard.press("Control+0");
      step(
        `${app}: so does its key`,
        again && (await seen(async () => (await stateOf(page, windowId)) === "key")),
      );
    }
    await openApp(page, "Contacts");
    const menu = await openMenu(page, "Window");
    const contactsRow = menu.getByRole("menuitem", { name: /^Contacts/ }).first();
    step(
      "Contacts has its row, naming Command-0",
      await contactsRow.waitFor({ timeout: 5_000 }).then(
        () => showsKey(contactsRow),
        () => false,
      ),
    );
    await page.keyboard.press("Escape");
    await shot(page, "apps-window-menu");
  },
);
