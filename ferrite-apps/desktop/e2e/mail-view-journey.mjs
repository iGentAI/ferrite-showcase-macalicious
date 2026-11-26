#!/usr/bin/env node
// What Mail keeps for a person on Ferrite, in a real browser against the running app: the mailbox,
// sort, filter, panes and a preference, read back from the server and shown again after a reload.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/mail-view-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                  [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-view");
const id = Date.now().toString(36);
const chris = { name: `mvchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const viewer = (page) => page.locator(".mac-mail").first();
const menuPath = async (page, ...names) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: names[0], exact: true })
    .first()
    .click();
  for (const name of names.slice(1)) {
    await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
  }
};
const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());

  await viewer(page)
    .getByRole("group", { name: "Favorites" })
    .or(viewer(page).getByRole("radiogroup", { name: "Favorites" }))
    .getByText("Sent", { exact: true })
    .click();
  await viewer(page)
    .getByRole("button", { name: /^Sort by/ })
    .click();
  await page.getByRole("menuitemradio", { name: "Subject" }).click();
  await menuPath(page, "View", /Hide Favorites Bar/);

  const list = viewer(page).locator(".mac-mail-list");
  const before = await list.boundingBox();
  const divider = viewer(page).getByRole("separator", { name: "Resize message list" });
  const handle = await divider.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 200);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 60, handle.y + 200, { steps: 6 });
  await page.mouse.up();
  const wider = (await list.boundingBox()).width;
  step("the message list is dragged wider", wider > before.width + 30, `${wider}`);

  await menuPath(page, "Mail", /^Preferences/);
  const box = page.getByRole("checkbox", { name: /Trash when searching|Trash/ }).first();
  await box.waitFor({ timeout: 10_000 });
  const was = await box.isChecked();
  await box.click();

  step(
    "the server holds what the window shows and the preference",
    (await within(10_000, async () => {
      const now = await values(page);
      return (
        now["mail.view"]?.mailbox === "sent" &&
        now["mail.view"]?.sort === "subject" &&
        now["mail.view"]?.favorites === false &&
        now["mail.settings"]?.searchTrash === !was
      );
    })) !== null,
  );

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  step(
    "after a reload the window shows Sent, sorted by Subject, without the Favorites bar",
    (await within(10_000, async () => {
      const title = await viewer(page)
        .locator(".mac-title-bar, .mac-window-title")
        .first()
        .innerText();
      return (
        /Sent \(/.test(title) &&
        (await viewer(page).getByRole("button", { name: "Sort by Subject" }).isVisible()) &&
        !(await viewer(page).locator(".mac-mail-favorites").isVisible())
      );
    })) !== null,
  );
  const after = (await viewer(page).locator(".mac-mail-list").boundingBox()).width;
  step("the message list keeps its width", Math.abs(after - wider) <= 2, `${wider} then ${after}`);
  await menuPath(page, "Mail", /^Preferences/);
  const again = page.getByRole("checkbox", { name: /Trash when searching|Trash/ }).first();
  await again.waitFor({ timeout: 10_000 });
  step("the preference is as it was left", (await again.isChecked()) === !was);
  await shot(page, "mail-view-kept");

  // Changed and closed at once: the choice is kept for the next window.
  const sortBy = async (name) => {
    await viewer(page)
      .getByRole("button", { name: /^Sort by/ })
      .click();
    await page.getByRole("menuitemradio", { name }).click();
  };
  await again
    .locator("xpath=ancestor::*[contains(concat(' ', @class, ' '), ' mac-window ')][1]")
    .getByRole("button", { name: "Close" })
    .click();
  await sortBy("From");
  await viewer(page).getByRole("button", { name: "Close" }).first().click();
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  step(
    "a sort chosen just before Mail's window closes is there when it opens again",
    (await within(10_000, () =>
      viewer(page).getByRole("button", { name: "Sort by From" }).isVisible(),
    )) !== null,
  );

  // Changed and reloaded at once.
  await sortBy("To");
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  step(
    "a sort chosen just before a reload is there after it",
    (await within(10_000, () =>
      viewer(page).getByRole("button", { name: "Sort by To" }).isVisible(),
    )) !== null,
  );
});
