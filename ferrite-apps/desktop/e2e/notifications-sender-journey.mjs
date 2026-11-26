#!/usr/bin/env node
// A real sender and System Preferences > Notifications: Chris and Martin each have an account in a
// browser of their own. Chris writes to Martin in the Messages window; Martin gets a banner and a row
// in Notification Center. Martin turns Messages off in Notifications; Chris's next message is delivered
// to Martin's Messages window with neither. Exits 0 only when every step passed and no page logged a
// console error, a page error, a failed request or an HTTP error.
//
//   node e2e/notifications-sender-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("notifications-sender");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `nschris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `nsmartin-${id}`, fullName: `Martin ${id}`, password };

const messages = (page) => page.locator('[aria-label="Messages"]').first();
const banner = (page, text) => page.locator(".mac-desktop-shell-banners").getByText(text);
const inCenter = async (page, text) => {
  await page.getByRole("menuitem", { name: "Notification Center" }).click();
  const shell = page.locator(".mac-desktop-shell-notification-center");
  await shell.waitFor();
  await shell.getByRole("tab", { name: "Notifications" }).click();
  await page.waitForTimeout(250);
  const found = (await shell.getByText(text).count()) > 0;
  await page.keyboard.press("Escape");
  await shell.waitFor({ state: "detached", timeout: 3_000 }).catch(() => {});
  await page.waitForTimeout(300);
  return found;
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  for (const page of [b, a]) await openFromDock(page, "Messages");

  const first = `Ferry at eight ${id}`;
  await messages(a).getByRole("button", { name: "Compose new message" }).click();
  await messages(a).getByRole("textbox", { name: "To" }).fill(martin.name);
  const field = messages(a).getByRole("textbox", { name: "Message" });
  await field.fill(first);
  await field.press("Enter");
  const shown = await within(20_000, async () => (await banner(b, first).count()) > 0);
  step("Chris's message comes to Martin as a banner", shown !== null);
  step("and a row in Notification Center", await inCenter(b, first));

  await openFromDock(b, "System Preferences");
  const window = b.locator('[data-window-id="system-preferences"]');
  await window
    .getByRole("button", { name: /^Notifications/ })
    .first()
    .click();
  const list = window.getByRole("listbox", { name: "Applications" });
  await list.getByRole("option", { name: /^Messages/ }).click();
  await window.getByRole("checkbox", { name: "Allow Notifications from Messages" }).click();
  await b.waitForTimeout(800);
  await shot(b, "notifications-sender-off");

  const second = `Ferry moved ${id}`;
  const answer = messages(a).getByRole("textbox", { name: "Message" });
  await answer.click();
  await answer.pressSequentially(second);
  await answer.press("Enter");
  await openFromDock(b, "Messages");
  await messages(b)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: chris.fullName })
    .first()
    .click();
  const delivered = await within(20_000, async () =>
    (
      await messages(b)
        .getByRole("log")
        .first()
        .innerText()
        .catch(() => "")
    ).includes(second),
  );
  step("with Messages off, the next message still reaches Martin's window", delivered !== null);
  await b.waitForTimeout(2_000);
  step(
    "with neither a banner nor a row",
    (await banner(b, second).count()) === 0 && !(await inCenter(b, second)),
  );
});
