#!/usr/bin/env node
// Mail's Favorites bar, the Flagged rows per colour and the classic layout on Ferrite, in a real browser against
// the running app, each kept on the server and shown again after a reload. Exits 0 only when every step passed and
// no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-favorites-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-favorites");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mfchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mfmartin-${id}`, fullName: `Martin ${id}`, password };
const subjects = [`One ${id}`, `Two ${id}`, `Three ${id}`];

const seen = (check) => within(8_000, check).then((took) => took !== null);
const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const row = (page, text) =>
  rows(page)
    .filter({ has: page.getByText(text, { exact: true }) })
    .first();
const tree = (page) => viewer(page).getByRole("tree", { name: "Mailboxes" });
const mailboxRow = (page, name) =>
  tree(page).getByRole("treeitem", { name: new RegExp(`^${name}`) });
const favorites = (page) => viewer(page).getByRole("radiogroup", { name: "Favorites" });
const favoriteNames = (page) => favorites(page).getByRole("radio").allInnerTexts();
const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};
const flagAs = async (page, colour) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Message", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: "Flag" }).click();
  await page.getByRole("menuitem", { name: colour, exact: true }).first().click();
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  for (const subject of subjects) {
    await viewer(a).getByRole("button", { name: "New Message" }).click();
    const to = compose(a).getByLabel("To:");
    await to.click();
    await to.pressSequentially(martin.name);
    await to.press("Enter");
    await compose(a).getByLabel("Subject:").fill(subject);
    await a.keyboard.press("Control+Shift+D");
    if (!(await within(15_000, async () => (await compose(a).count()) === 0))) {
      throw new Error(`the message ${subject} did not go`);
    }
  }
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(20_000, async () => {
    await b.keyboard.press("Control+Shift+N");
    return (await rows(b).count()) === 3;
  });

  // Flagged per colour: red, then blue.
  await row(b, subjects[0]).click();
  await flagAs(b, "Red");
  await within(5_000, () => mailboxRow(b, "Flagged").isVisible());
  step(
    "one colour in use gives no rows under Flagged",
    (await mailboxRow(b, "Flagged").getAttribute("aria-expanded")) === null,
  );
  await row(b, subjects[1]).click();
  await flagAs(b, "Blue");
  await row(b, subjects[2]).click();
  await flagAs(b, "Blue");
  const flagged = mailboxRow(b, "Flagged");
  await seen(async () => (await flagged.getAttribute("aria-expanded")) !== null);
  await flagged.locator("[data-sidebar-triangle], button").first().click();
  await within(5_000, () => mailboxRow(b, "Blue").isVisible());
  await mailboxRow(b, "Blue").getByText("Blue", { exact: true }).click();
  step(
    "the Blue row lists the two flagged blue",
    await seen(async () => (await rows(b).count()) === 2),
  );
  await shot(b, "mail-flagged-colours");
  await mailboxRow(b, "Red").getByText("Red", { exact: true }).click();
  step(
    "the Red row lists the one flagged red",
    await seen(
      async () => (await rows(b).count()) === 1 && (await row(b, subjects[0]).isVisible()),
    ),
  );
  await b.keyboard.press("Control+1");

  // Favorites by a mailbox's menu.
  await mailboxRow(b, "Flagged").getByText("Flagged", { exact: true }).click({ button: "right" });
  await b.getByRole("menuitem", { name: "Add to Favorites Bar" }).click();
  step(
    "Add to Favorites Bar puts the mailbox on the bar",
    await seen(async () => (await favoriteNames(b)).join(",").includes("Flagged")),
  );
  await favorites(b).getByRole("radio", { name: "Flagged" }).click();
  step("its button opens it", await seen(async () => (await rows(b).count()) === 3));
  const checked = (page, name) =>
    seen(
      async () =>
        (await favorites(page).getByRole("radio", { name }).getAttribute("aria-checked")) ===
        "true",
    );
  await b.keyboard.press("Control+1");
  step("Go To's first key opens the Inbox", await checked(b, "Inbox"));
  await b.keyboard.press("Control+4");
  step("Go To's fourth key opens the mailbox added fourth", await checked(b, "Flagged"));

  // Favorites by dragging a mailbox onto the bar, in front of Sent.
  await mailboxRow(b, "Red")
    .getByText("Red", { exact: true })
    .dragTo(favorites(b).getByRole("radio", { name: "Sent" }));
  step(
    "a mailbox dragged onto the bar lands before the button dropped on",
    await seen(async () => {
      const names = await favoriteNames(b);
      return names.indexOf("Red") === names.indexOf("Sent") - 1;
    }),
  );
  await shot(b, "mail-favorites-bar");
  await favorites(b).getByRole("radio", { name: "Flagged" }).click({ button: "right" });
  await shot(b, "mail-favorites-menu");
  await b.getByRole("menuitem", { name: "Remove from Favorites Bar" }).click();
  step(
    "Remove from Favorites Bar takes it off",
    await seen(async () => !(await favoriteNames(b)).includes("Flagged")),
  );
  step(
    "the bar is kept on the server",
    await seen(async () => {
      const kept = (await values(b))["mail.view"]?.favoriteBoxes ?? [];
      return kept.includes("smart-flagged-red") && !kept.includes("smart-flagged");
    }),
  );

  // The classic layout.
  await b.keyboard.press("Control+,");
  const preferences = b.locator(".mac-preferences-window").first();
  await preferences.getByRole("tab", { name: "Viewing" }).click();
  await preferences.getByRole("checkbox", { name: "Use classic layout" }).click();
  await preferences.getByRole("button", { name: "Close" }).first().click();
  const list = viewer(b).locator(".mac-mail-list").first();
  const message = viewer(b).locator(".mac-mail-viewer").first();
  const above = async () => {
    const [top, bottom] = await Promise.all([list.boundingBox(), message.boundingBox()]);
    return Boolean(
      top && bottom && top.y + top.height <= bottom.y + 2 && top.width === bottom.width,
    );
  };
  step("Use classic layout puts the list above the message", await seen(above));
  await row(b, subjects[0])
    .click()
    .catch(() => {});
  await shot(b, "mail-classic-layout");
  const handle = viewer(b).getByRole("separator", { name: "Resize message list" });
  const before = (await list.boundingBox())?.height ?? 0;
  const box = await handle.boundingBox();
  if (box) {
    await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await b.mouse.down();
    await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60, { steps: 4 });
    await b.mouse.up();
  }
  step(
    "its divider resizes the list",
    await seen(async () => ((await list.boundingBox())?.height ?? 0) > before + 40),
  );

  await b.waitForTimeout(1_500);
  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  step(
    "after a reload the bar and the classic layout are as they were",
    (await seen(async () => {
      const names = await favoriteNames(b);
      return names.includes("Red") && !names.includes("Flagged");
    })) && (await seen(above)),
  );
});
