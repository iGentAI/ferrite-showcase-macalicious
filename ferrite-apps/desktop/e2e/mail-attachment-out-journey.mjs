#!/usr/bin/env node
// A Mail attachment dragged out, with real mouse input: into a Finder window and onto the desktop. Each keeps the
// attachment's own bytes on the drive.
//
//   node e2e/mail-attachment-out-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-attachment-out");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `maochris-${id}`, fullName: `Chris ${id}`, password };
const subject = `Out ${id}`;
const FILE = `chart-${id}.txt`;
const BODY = `the chart ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();

const copies = (page) =>
  page.evaluate(async (name) => {
    const reply = await fetch("/api/files/", { credentials: "same-origin" });
    return (await reply.json()).entries.filter((each) => each.name === name);
  }, FILE);

const bytesOf = (page, entry) =>
  page.evaluate(async ({ id, version }) => {
    const reply = await fetch(`/api/files/content/${id}?piece=0&count=8&version=${version}`, {
      credentials: "same-origin",
    });
    return reply.ok ? reply.text() : `HTTP ${reply.status}`;
  }, entry);

async function dragTo(page, from, x, y) {
  const box = await from.boundingBox();
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(120);
  await page.mouse.up();
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  await a.setViewportSize({ width: 2400, height: 1000 });
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  const to = compose(a).getByLabel("To:");
  await to.click();
  await to.pressSequentially(chris.name);
  await to.press("Enter");
  await compose(a).getByLabel("Subject:").fill(subject);
  await compose(a)
    .getByLabel("Files from this computer")
    .setInputFiles({ name: FILE, mimeType: "text/plain", buffer: Buffer.from(BODY) });
  await within(15_000, async () =>
    (await compose(a).getByRole("list", { name: "Attachments" }).innerText()).includes("byte"),
  );
  await compose(a).getByRole("button", { name: "Send" }).click();

  const row = viewer(a)
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: subject })
    .first();
  await row.waitFor({ timeout: 20_000 });
  await row.click();
  const attachment = viewer(a)
    .getByRole("list", { name: "Attachments" })
    .getByRole("listitem")
    .first();
  await attachment.waitFor({ timeout: 10_000 });
  step("The message shows its attachment", (await attachment.innerText()).includes(FILE));

  await openFromDock(a, "Finder", undefined).catch(() => {});
  const finder = a.locator('[data-window-id^="finder"]').first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents" }).first().click();
  // Mail at the left of a wide screen and Finder at the right, so that neither covers the other.
  const title = await finder.boundingBox();
  await a.mouse.move(title.x + title.width / 2, title.y + 10);
  await a.mouse.down();
  await a.mouse.move(2400 - title.width / 2 - 10, title.y + 60, { steps: 8 });
  await a.mouse.up();
  const mailTitle = await viewer(a).boundingBox();
  await a.mouse.move(mailTitle.x + mailTitle.width / 2, mailTitle.y + 10);
  await a.mouse.down();
  await a.mouse.move(mailTitle.width / 2 + 150, mailTitle.y + 10, { steps: 8 });
  await a.mouse.up();

  const place = await finder.boundingBox();
  const mail = await viewer(a).boundingBox();
  const inFinder = {
    x: Math.max(place.x + 240, mail.x + mail.width + 60),
    y: place.y + place.height - 60,
  };
  await dragTo(a, attachment, inFinder.x, inFinder.y);
  const copyIn = async (parent) => (await copies(a)).find((each) => each.parent === parent);
  step(
    "Dragged into Finder, it is on the drive in that folder",
    await within(15_000, () => copyIn("documents")),
  );
  await shot(a, "mail-attachment-in-finder");

  await dragTo(a, attachment, 60, 300);
  step("Dragged onto the desktop, it is there too", await within(15_000, () => copyIn("desktop")));
  await shot(a, "mail-attachment-on-desktop");

  for (const parent of ["documents", "desktop"]) {
    const entry = await copyIn(parent);
    const bytes = entry ? await bytesOf(a, { id: entry.id, version: entry.version ?? 0 }) : null;
    step(`The copy in ${parent} holds the attachment's own bytes`, bytes === BODY, String(bytes));
  }
});
