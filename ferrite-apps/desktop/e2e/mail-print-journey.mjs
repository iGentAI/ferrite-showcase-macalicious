#!/usr/bin/env node
// Printing and redirecting a message on Ferrite, in a real browser against the running app: File >
// Print and Export as PDF hand the browser a page holding the message's whole text, and Message >
// Redirect opens a New Message with the same subject and text and nobody addressed. Exits 0 only
// when every step passed and no page logged a console error, a page error, a failed request or an
// HTTP error. A headless browser shows no print dialog, so the page it was given is what is checked.
//
//   node e2e/mail-print-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                   [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-print");
const id = Date.now().toString(36);
const chris = { name: `mpchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const SUBJECT = `Printed ${id}`;
const TEXT = `The whole text of ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const row = (page) =>
  viewer(page)
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: SUBJECT })
    .first();
const menu = async (page, title, item) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: item }).click();
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const to = compose(page).getByLabel("To:");
  await to.click();
  await to.pressSequentially(chris.name);
  await to.press("Enter");
  await compose(page).getByLabel("Subject:").fill(SUBJECT);
  await compose(page).locator('[contenteditable="true"]').first().click();
  await page.keyboard.type(TEXT);
  await page.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(page).count()) === 0);
  await within(20_000, async () => {
    await page.keyboard.press("Control+Shift+N");
    return row(page).isVisible();
  });
  await row(page).click();

  // The frame goes as soon as printing ends, which a headless browser does at once.
  await page.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await menu(page, "File", /^Print/);
  let html = "";
  await within(10_000, async () => {
    html = (await page.evaluate(() => window.printedPage)) ?? "";
    return html !== "";
  });
  step(
    "File > Print gives the browser a page with the message's headers and whole text",
    html.includes(SUBJECT) && html.includes(TEXT) && html.includes(chris.fullName),
  );
  const sheet = await page.context().newPage();
  await sheet.setContent(html);
  await sheet.setViewportSize({ width: 816, height: 500 });
  await shot(sheet, "mail-print-page");
  await sheet.close();

  await menu(page, "Message", /^Redirect/);
  await compose(page).waitFor({ timeout: 10_000 });
  step(
    "Redirect opens a New Message with the same subject and text, addressed to nobody",
    (await compose(page).getByLabel("Subject:").inputValue()) === SUBJECT &&
      (await within(5_000, async () => (await compose(page).innerText()).includes(TEXT))) !==
        null &&
      (await compose(page).getByLabel("To:").inputValue()) === "",
  );
});
