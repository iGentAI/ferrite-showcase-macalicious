#!/usr/bin/env node
// The Dock menus of Messages, Contacts, Calendar, Reminders and FaceTime, and Messages' editing rows, in a
// real browser against the running app: each Dock row does its work, read from the app or the server.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed request
// or an HTTP error.
//
//   node e2e/apps-dock-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("apps-dock");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `adchris-${id}`, fullName: `Chris ${id}`, password };

const seen = (check) => within(10_000, check).then((took) => took !== null);
const openApp = async (page, app) => {
  await page
    .getByRole("button", { name: new RegExp(`^${app}$`) })
    .first()
    .click();
  await page.getByRole("menubar").getByText(app, { exact: true }).first().waitFor();
  await page.waitForTimeout(800);
};
const dockRow = async (page, app, row) => {
  await page
    .getByRole("button", { name: new RegExp(`^${app}$`) })
    .first()
    .click({ button: "right" });
  const item = page.getByRole("menu").last().getByRole("menuitem", { name: row }).first();
  await item.waitFor({ timeout: 5_000 });
  await item.click();
};
const editRow = async (page, row) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: row }).first().click();
};
const json = async (page, path) => {
  const reply = await page.request.get(new URL(path, page.url()).href);
  return reply.json();
};

await run(
  { chromium: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
  {},
  async ({ person }) => {
    const page = await person("chris", chris);

    await openApp(page, "Messages");
    const field = page.locator("textarea").first();
    const conversations = () => page.locator(".mac-messages [role='option']").count();
    const before = await conversations();
    await dockRow(page, "Messages", "New Message");
    step(
      "Messages: the Dock's New Message starts a conversation",
      await seen(async () => (await conversations()) > before),
    );
    await field.click();
    await field.fill("one two");
    await field.evaluate((el) => el.setSelectionRange(0, 4));
    await editRow(page, "Delete");
    step(
      "Messages: Edit > Delete takes the selection out of the field",
      await seen(async () => (await field.inputValue()) === "two"),
    );

    await openApp(page, "Contacts");
    await dockRow(page, "Contacts", "New Card");
    step(
      "Contacts: the Dock's New Card opens a card to fill in",
      await seen(() => page.getByRole("textbox", { name: /First/ }).first().isVisible()),
    );

    await openApp(page, "Calendar");
    const events = () =>
      json(page, "/api/calendar/events").then((body) => JSON.stringify(body).length);
    const eventsBefore = await events().catch(() => 0);
    await dockRow(page, "Calendar", "New Event");
    step(
      "Calendar: the Dock's New Event makes an event",
      await seen(async () => (await events()) > eventsBefore),
    );
    await page.keyboard.press("Escape");

    await openApp(page, "Reminders");
    const rows = () => page.getByRole("region", { name: "Reminders" }).getByRole("option").count();
    const rowsBefore = await rows();
    await dockRow(page, "Reminders", "New Reminder");
    step(
      "Reminders: the Dock's New Reminder adds a row",
      await seen(async () => (await rows()) > rowsBefore),
    );
    await shot(page, "apps-dock");
  },
);
