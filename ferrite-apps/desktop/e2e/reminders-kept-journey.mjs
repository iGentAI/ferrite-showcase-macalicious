#!/usr/bin/env node
// What Reminders keeps for a person on Ferrite, and File > Print, in a real browser against the
// running app: the list shown, the sort and Show Completed are read from the server and back after a
// reload, and the page handed to the browser holds the reminders of the list. A headless browser
// shows no print dialog, so the page it was given is what is checked. Exits 0 only when every step
// passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/reminders-kept-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-kept");
const id = Date.now().toString(36);
const person = { name: `rkchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const TITLE = `Mango ${id}`;
const OTHER = `Apple ${id}`;

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const row = (page, title) => windowOf(page).getByRole("option").filter({ hasText: title }).first();
const order = async (page) => {
  const rows = await windowOf(page).getByRole("option").allInnerTexts();
  return rows.map((text) => [TITLE, OTHER].find((title) => text.includes(title))).filter(Boolean);
};
const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).first().click();
const sortBy = async (page, name) => {
  await bar(page, "View");
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
  await page.keyboard.press("Escape");
};

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Reminders");
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(500);
  for (const title of [TITLE, OTHER]) {
    await page.keyboard.press("Control+N");
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
    await row(page, title).waitFor({ timeout: 5_000 });
  }
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await bar(page, "File");
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Print/ })
    .click();
  let html = "";
  await within(10_000, async () => {
    html = (await page.evaluate(() => window.printedPage)) ?? "";
    return html !== "";
  });
  step(
    "File > Print hands the browser the list's reminders",
    html.includes(`[ ] ${TITLE}`) && html.includes(`[ ] ${OTHER}`),
  );
  const sheet = await page.context().newPage();
  await sheet.setContent(html);
  await sheet.setViewportSize({ width: 816, height: 300 });
  await shot(sheet, "reminders-print-page");
  await sheet.close();
  await page.bringToFront();

  await sortBy(page, "Title");
  await bar(page, "View");
  await page.getByRole("menuitemcheckbox", { name: "Show Completed" }).click();
  await page.keyboard.press("Escape");
  await within(5_000, async () => (await order(page))[0] === OTHER);
  const stored = async () => {
    const reply = await page.request.get(
      new URL("/api/system-preferences/settings", page.url()).href,
    );
    return (await reply.json()).values?.["reminders.view"];
  };
  step(
    "the sort and Show Completed are on the server",
    (await within(10_000, async () => {
      const view = await stored();
      return view?.sort === "title" && view.showCompleted === true;
    })) !== null,
  );

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders");
  step(
    "after a reload the list shown is sorted as it was left",
    (await within(15_000, async () => {
      const rows = await order(page);
      return rows.length === 2 && rows[0] === OTHER;
    })) !== null,
    (await order(page)).join(),
  );
  await bar(page, "View");
  step(
    "and Show Completed is still on",
    (await page
      .getByRole("menuitemcheckbox", { name: "Show Completed" })
      .getAttribute("aria-checked")) === "true",
  );
  await page.keyboard.press("Escape");
  await shot(page, "reminders-kept");
});
