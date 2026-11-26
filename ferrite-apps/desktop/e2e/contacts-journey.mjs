#!/usr/bin/env node
// Contacts on Ferrite, two people: Chris and Martin each make an account at the login window, in
// browsers of their own. Chris opens Contacts and finds only his own card, made from his
// account. He adds Martin by his account name with Add Desktop User… (a name no account has is
// refused first), gives Martin's card a picture from the computer, makes a card for Lena, saves
// her card to his drive as a vCard and imports it back from the drive, and downloads his own card
// as a vCard. After a reload all of it is there, picture included, and Messages' and Mail's
// address book (`/api/contacts/people`) lists Martin. Martin's Contacts holds none of Chris's
// cards; he imports Chris's downloaded vCard from the computer, which gives him a card for
// Chris's account, and keeps a smart group of the desktop's people across a reload. Exits 0 only
// when every step passed and no page logged a console error, a page error, a failed request or
// an HTTP error (other than the one refused name).
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/contacts-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                 [--browser chromium|chrome|firefox|webkit]

import { readFile } from "node:fs/promises";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("contacts");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `cochris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `comartin-${id}`, fullName: `Martin ${id}`, password };
const nobody = `conobody-${id}`;
const lenaFile = `lena-${id}.vcf`;

// Add Desktop User… asks for a name no account has, on purpose: its 404 is expected.
allow(new RegExp(`/api/contacts/users/${nobody}`));
allow(/status of 404/);

/** A same-origin request from the page, as the desktop makes it. */
const api = (page, method, url) =>
  page.evaluate(
    async ({ method, url }) => {
      const response = await fetch(url, { method, credentials: "same-origin" });
      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return { status: response.status, json, text };
    },
    { method, url },
  );

const names = async (window) =>
  (await window.getByRole("listbox").first().getByRole("option").allTextContents()).map((name) =>
    name.replace(/\s+/g, " ").trim(),
  );
/**
 * Waits for a sheet to finish sliding in. Playwright's WebKit can pass a button that is still moving as stable, and the
 * press then lands on the button and the release beside it, so no click happens.
 */
const slidIn = (sheet) =>
  sheet.evaluate(async (element) => {
    while (element.hasAttribute("data-starting-style")) await new Promise(requestAnimationFrame);
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });

const heading = (window) => window.getByRole("heading", { level: 2 });
const account = (window) => window.locator("[data-account]").first();
const ready = (window) =>
  window.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });

/** Choose `item` in the bar's pull-down of desktop commands. */
async function command(page, window, item) {
  await window.getByRole("button", { name: "Contacts commands" }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

/** The notice an import shows: its text, after which it is closed with OK. */
async function notice(page) {
  const alert = page.getByRole("alertdialog").or(page.getByRole("dialog")).last();
  await alert.waitFor({ timeout: 15_000 });
  const text = (await alert.innerText()).replace(/\s+/g, " ");
  await alert.getByRole("button", { name: "OK" }).click();
  return text;
}

/** A PNG drawn by the page itself: a 200 by 120 picture, so the browser scales and crops it. */
const png = (page) =>
  page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 120;
    const context = canvas.getContext("2d");
    context.fillStyle = "#2a7ab0";
    context.fillRect(0, 0, 200, 120);
    context.fillStyle = "#f0c419";
    context.beginPath();
    context.arc(100, 60, 40, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL("image/png").split(",")[1];
  });

/** The drive's file named `name`, once the drive lists it. */
async function driveFile(page, name) {
  let found = null;
  await within(15_000, async () => {
    const drive = await api(page, "GET", "/api/files/");
    found = drive.json?.entries?.find((entry) => entry.name === name && !entry.trashed_ms) ?? null;
    return found !== null;
  });
  return found;
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);

  // ── Chris's Contacts starts with his own card only ──
  let contacts = await openFromDock(a, "Contacts");
  await ready(contacts);
  step(
    "Chris's Contacts holds only his own card",
    JSON.stringify(await names(contacts)) === JSON.stringify([`${chris.fullName}, my card`]),
    (await names(contacts)).join(" | "),
  );
  step(
    "My Card shows his account",
    (await account(contacts).innerText()).includes(`${chris.name}@macalicious`),
  );

  // ── Add Desktop User… ──
  await command(a, contacts, "Add Desktop User…");
  const sheet = a.getByRole("dialog", { name: "Add a Desktop User" });
  await sheet.waitFor({ timeout: 10_000 });
  await slidIn(sheet);
  const nameField = sheet.getByRole("textbox", { name: "Account Name" });
  await nameField.fill(nobody);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  const refused = sheet.getByRole("alert");
  await refused.waitFor({ timeout: 10_000 });
  step(
    "a name no account has is refused",
    (await refused.innerText()).includes(`No one on this desktop has the account name`),
    await refused.innerText(),
  );
  await nameField.fill(martin.name);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await sheet.waitFor({ state: "hidden", timeout: 10_000 });
  await within(10_000, async () => (await heading(contacts).innerText()).includes(martin.fullName));
  step("Martin's card opens", (await heading(contacts).innerText()).includes(martin.fullName));
  step(
    "it shows his desktop account",
    (await account(contacts).innerText()).includes(`${martin.name}@macalicious`),
  );
  const actions = contacts.getByRole("group", { name: "Actions" });
  step(
    "its message and mail buttons are available",
    (await actions.getByRole("button", { name: "message" }).isEnabled()) &&
      (await actions.getByRole("button", { name: "mail" }).isEnabled()),
  );
  const listed = await within(10_000, async () => {
    const people = await api(a, "GET", "/api/contacts/people");
    return people.json?.people?.some((p) => p.user === martin.name);
  });
  step("Messages and Mail find Martin in Chris's address book", listed !== null);

  // ── A picture from the computer for Martin's card ──
  await contacts.getByRole("button", { name: "Edit", exact: true }).click();
  await contacts
    .getByRole("group", { name: "Card" })
    .getByRole("button", { name: "Picture" })
    .click();
  const chooser = a.waitForEvent("filechooser");
  await contacts.getByRole("button", { name: "Choose Picture…" }).click();
  (await chooser).setFiles({
    name: "harbor.png",
    mimeType: "image/png",
    buffer: Buffer.from(await png(a), "base64"),
  });
  const pictured = await within(15_000, () =>
    contacts.locator(".mac-contacts-head img.mac-contacts-picture-image").first().isVisible(),
  );
  step("the picture shows on Martin's card", pictured !== null);
  await contacts.getByRole("button", { name: "Done", exact: true }).click();

  // ── A card for Lena, saved to the drive as a vCard and imported back ──
  await contacts.getByRole("button", { name: "New Contact" }).click();
  await contacts.getByRole("textbox", { name: "First" }).fill("Lena");
  await contacts.getByRole("textbox", { name: "Last" }).fill("Brandt");
  await contacts.getByRole("textbox", { name: "home email" }).fill("lena@brandt.example");
  await contacts.getByRole("button", { name: "Done", exact: true }).click();
  await within(10_000, async () => (await heading(contacts).innerText()).includes("Lena Brandt"));
  await command(a, contacts, "Save Card to Drive…");
  const save = a.getByRole("dialog", { name: "Save" });
  await save.waitFor({ timeout: 10_000 });
  await slidIn(save);
  await save.getByLabel("Save As:").fill(lenaFile);
  await save.getByRole("button", { name: "Save", exact: true }).click();
  await save.waitFor({ state: "hidden", timeout: 10_000 });
  const file = await driveFile(a, lenaFile);
  step("Lena's vCard is on Chris's drive", file !== null, file?.parent);
  const content = file
    ? await api(a, "GET", `/api/files/content/${file.id}?piece=0&count=8`)
    : { text: "" };
  step(
    "it is a vCard 3.0 with her name and address",
    content.text.includes("VERSION:3.0") &&
      content.text.includes("N:Brandt;Lena;;;") &&
      content.text.includes("lena@brandt.example"),
  );
  await command(a, contacts, "Import vCard from Drive…");
  const panel = a.locator(".mac-contacts-panel-layer");
  await panel.waitFor({ timeout: 10_000 });
  await panel.getByRole("option", { name: lenaFile }).dblclick();
  const imported = await notice(a);
  step("importing it back adds her card", imported.includes("1 card was imported"), imported);
  step(
    "the list has both of Lena's cards",
    (await names(contacts)).filter((name) => name === "Lena Brandt").length === 2,
    (await names(contacts)).join(" | "),
  );

  // ── Chris's own card, downloaded as a vCard ──
  await contacts.getByRole("option", { name: new RegExp(`^${chris.fullName}\\b`) }).click();
  const downloading = a.waitForEvent("download");
  await command(a, contacts, "Export Card as vCard");
  const download = await downloading;
  const card = await readFile(await download.path(), "utf8");
  step(
    "Chris's card downloads as a vCard naming his account",
    card.includes(`X-MACALICIOUS-USER:${chris.name}`) &&
      download.suggestedFilename().endsWith(".vcf"),
    download.suggestedFilename(),
  );
  await shot(a, "contacts-chris");

  // ── After a reload all of it is kept ──
  await a.reload({ waitUntil: "load" });
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  contacts = await openFromDock(a, "Contacts");
  await ready(contacts);
  const kept = await names(contacts);
  step(
    "after a reload Chris has his card, Martin's and both of Lena's",
    kept.includes(`${chris.fullName}, my card`) &&
      kept.includes(martin.fullName) &&
      kept.filter((name) => name === "Lena Brandt").length === 2 &&
      kept.length === 4,
    kept.join(" | "),
  );
  await contacts.getByRole("option", { name: new RegExp(`^${martin.fullName}\\b`) }).click();
  const stillPictured = await within(15_000, () =>
    contacts.locator(".mac-contacts-head img.mac-contacts-picture-image").first().isVisible(),
  );
  step("Martin's picture is kept", stillPictured !== null);

  // ── Martin's Contacts is his own ──
  let his = await openFromDock(b, "Contacts");
  await ready(his);
  step(
    "Martin's Contacts holds only his own card, none of Chris's",
    JSON.stringify(await names(his)) === JSON.stringify([`${martin.fullName}, my card`]),
    (await names(his)).join(" | "),
  );
  const empty = await api(b, "GET", "/api/contacts/people");
  step("Martin's address book lists nobody yet", JSON.stringify(empty.json) === '{"people":[]}');

  // He imports Chris's downloaded card from the computer: it names Chris's account.
  const picker = b.waitForEvent("filechooser");
  await command(b, his, "Import vCard…");
  (await picker).setFiles({
    name: download.suggestedFilename(),
    mimeType: "text/vcard",
    buffer: Buffer.from(card),
  });
  const read = await notice(b);
  step("Martin imports Chris's vCard", read.includes("1 card was imported"), read);
  await within(10_000, async () => (await heading(his).innerText()).includes(chris.fullName));
  step(
    "the card is for Chris's desktop account",
    (await account(his).innerText()).includes(`${chris.name}@macalicious`),
  );
  const found = await within(10_000, async () => {
    const people = await api(b, "GET", "/api/contacts/people");
    return people.json?.people?.some((p) => p.user === chris.name);
  });
  step("Martin's address book now lists Chris", found !== null);

  // A smart group of the desktop's people, kept across a reload.
  await command(b, his, "New Smart Group…");
  const group = b.getByRole("dialog", { name: "New Smart Group" });
  await group.waitFor({ timeout: 10_000 });
  await slidIn(group);
  await group.getByRole("textbox", { name: "Smart Group Name" }).fill("On this desktop");
  await group.getByRole("button", { name: "OK", exact: true }).click();
  await group.waitFor({ state: "hidden", timeout: 10_000 });
  await within(5_000, async () => (await names(his)).length === 1);
  step(
    "the smart group lists Chris only",
    JSON.stringify(await names(his)) === JSON.stringify([chris.fullName]),
    (await names(his)).join(" | "),
  );
  await shot(b, "contacts-martin");
  await b.reload({ waitUntil: "load" });
  await b
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  his = await openFromDock(b, "Contacts");
  await ready(his);
  const groupRow = his.getByRole("treeitem", { name: "On this desktop" });
  step("after a reload Martin's smart group is kept", await groupRow.isVisible());
  await groupRow.click();
  step(
    "and still lists Chris",
    JSON.stringify(await names(his)) === JSON.stringify([chris.fullName]),
  );
  const chrisKept = await api(a, "GET", "/api/contacts/cards");
  step(
    "nothing of Martin's reached Chris's cards",
    !JSON.stringify(chrisKept.json).includes("On this desktop") &&
      chrisKept.json?.cards?.length === 4,
  );
});
