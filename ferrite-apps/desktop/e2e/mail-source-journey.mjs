#!/usr/bin/env node
// Mail's View > Message, in a real browser against the running app: All Headers shows the lines the
// message keeps, Raw Source shows them over its whole text, by the menu and by the key, and choosing
// one again goes back. Exits 0 only when every step passed and no page logged a console error, a page
// error, a failed request or an HTTP error.
//
//   node e2e/mail-source-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                    [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-source");
const id = Date.now().toString(36);
const chris = { name: `mschris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const SUBJECT = `Source ${id}`;
const TEXT = `The words of ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const row = (page) =>
  viewer(page)
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ has: page.getByText(SUBJECT, { exact: true }) })
    .first();
const viewMessage = async (page, name) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: "Message", exact: true })
    .click();
  await page.getByRole("menu").last().getByRole("menuitemcheckbox", { name }).click();
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  await compose(page).getByLabel("To:").fill(`${chris.name}@macalicious`);
  await compose(page).getByLabel("Subject:").fill(SUBJECT);
  await compose(page)
    .getByRole("textbox", { name: /Message/ })
    .last()
    .fill(TEXT);
  await compose(page).getByRole("button", { name: "Send" }).click();
  await within(30_000, () => row(page).isVisible());
  await row(page).click();

  await viewMessage(page, "All Headers");
  const headers = viewer(page).locator("[data-mail-headers]");
  step(
    "All Headers shows the message's lines over its text",
    (await within(8_000, async () =>
      (await headers.innerText()).includes(`Subject: ${SUBJECT}`),
    )) !== null && (await viewer(page).getByText(TEXT).first().isVisible()),
  );

  await page.keyboard.press("Control+Alt+u");
  const source = page.getByRole("article", { name: `Raw source of ${SUBJECT}` });
  step(
    "Its key shows Raw Source: the lines and the whole text",
    (await within(8_000, async () => {
      const text = await source.innerText();
      return text.includes(`From: `) && text.includes(`Subject: ${SUBJECT}`) && text.includes(TEXT);
    })) !== null,
  );
  await page.waitForTimeout(300);
  await shot(page, "mail-source");

  await viewMessage(page, "Raw Source");
  step(
    "Choosing it again goes back to the message as it reads",
    (await within(8_000, async () => (await source.count()) === 0)) !== null &&
      (await viewer(page).getByText(TEXT).first().isVisible()),
  );
});
