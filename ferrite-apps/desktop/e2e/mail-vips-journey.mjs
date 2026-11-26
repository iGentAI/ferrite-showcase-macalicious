#!/usr/bin/env node
// The Flagged mailbox and VIPs on Ferrite, in a real browser against the running app: flagged mail is
// listed under Flagged, Add Sender to VIPs marks the sender and gives them a mailbox and the From VIPs
// filter, all kept on the server and shown again after a reload. Exits 0 only when every step passed
// and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-vips-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                  [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-vips");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `vipchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `vipmartin-${id}`, fullName: `Martin ${id}`, password };
const subjects = [`One ${id}`, `Two ${id}`];

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const row = (page, text) =>
  rows(page)
    .filter({ has: page.getByText(text, { exact: true }) })
    .first();
const mailboxRow = (page, name) =>
  viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: new RegExp(`^${name}`) });
const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};
async function menuPath(page, ...names) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: names[0], exact: true })
    .first()
    .click();
  for (const name of names.slice(1)) {
    const menu = page.getByRole("menu").last();
    await menu
      .getByRole("menuitem", { name })
      .or(menu.getByRole("menuitemcheckbox", { name }))
      .click();
  }
}
const count = (page, wanted) => within(8_000, async () => (await rows(page).count()) === wanted);

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
    return (await rows(b).count()) === 2;
  });

  step("no Flagged row while nothing is flagged", (await mailboxRow(b, "Flagged").count()) === 0);
  await row(b, subjects[0]).click();
  await menuPath(b, "Message", "Flag");
  await b.getByRole("menuitem", { name: "Red", exact: true }).first().click();
  await within(5_000, () => mailboxRow(b, "Flagged").isVisible());
  await mailboxRow(b, "Flagged").click();
  step(
    "Flagged lists the one flagged message",
    (await count(b, 1)) !== null && (await row(b, subjects[0]).isVisible()),
  );

  await row(b, subjects[0]).click();
  await menuPath(b, "Message", "Add Sender to VIPs");
  const vipRow = mailboxRow(b, `Chris ${id}`);
  step(
    "Add Sender to VIPs lists them, on the server",
    (await within(5_000, () => vipRow.isVisible())) !== null &&
      (await within(10_000, async () => {
        const now = await values(b);
        return now["mail.vips"]?.[0]?.address === `${chris.name}@macalicious`;
      })) !== null,
  );
  await vipRow.click();
  step("their mailbox holds both messages", (await count(b, 2)) !== null);
  step("each row has the star", (await rows(b).getByRole("img", { name: "VIP" }).count()) === 2);
  await shot(b, "mail-vips");

  await menuPath(b, "View", "Filter", "Enable Message Filter");
  await menuPath(b, "View", "Filter", "Unread");
  await menuPath(b, "View", "Filter", "From VIPs");
  step("the filter From VIPs keeps them", (await count(b, 2)) !== null);
  await menuPath(b, "View", "Filter", "Enable Message Filter");

  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  step(
    "after a reload the VIP is listed, and is the mailbox shown",
    (await within(15_000, () => vipRow.isVisible())) !== null && (await count(b, 2)) !== null,
  );

  await rows(b).first().click();
  await menuPath(b, "Message", "Remove Sender from VIPs");
  step(
    "Remove Sender from VIPs takes them off, on the server, and goes to the Inbox",
    (await within(10_000, async () => ((await values(b))["mail.vips"] ?? []).length === 0)) !==
      null && (await within(5_000, async () => (await vipRow.count()) === 0)) !== null,
  );
});
