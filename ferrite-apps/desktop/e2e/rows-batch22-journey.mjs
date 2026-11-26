#!/usr/bin/env node
// Batch 22 of rows, on Ferrite, in a real browser against the running app. Mail: Edit > Attachments' rows act, a file
// placed at the insertion point reaches the reader there with its own bytes, and Download attachments automatically off
// reads nothing until asked. Contacts: an account turned off hides its cards and keeps them on the server, Default
// Account decides where a new card goes, and merging keeps one picture and loses none. Script Editor: Record writes what
// the desktop reported, and running that script does it again. Music: the rows that need Apple's services are dimmed and
// say why. State is read from the server. Exits 0 only when every step passed and no page logged an error.
//
//   node e2e/rows-batch22-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//   ONLY=mail,contacts,script,music node e2e/rows-batch22-journey.mjs

import {
  arrive,
  closePreferences,
  compose,
  menuPath,
  onServer,
  openPane,
  preferences,
  row,
  values,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("rows-batch22");
allow(/console: Failed to load resource/);
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `rbchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `rbmartin-${id}`, fullName: `Martin ${id}`, password };
const only = process.env.ONLY?.split(",") ?? ["mail", "contacts", "script", "music"];
const subject = (word) => `${word} ${id}`;
const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_URL = `data:image/png;base64,${PNG.toString("base64")}`;

const openMail = async (page) => {
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
};
const newMessage = async (page, to, word) => {
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const field = compose(page).getByLabel("To:");
  await field.click();
  await field.pressSequentially(to);
  await field.press("Enter");
  await compose(page).getByLabel("Subject:").fill(subject(word));
};
const editor = (page) => compose(page).getByRole("textbox", { name: "Message" });
const attachRow = (page, name) =>
  page.getByRole("menu").last().getByRole("menuitemcheckbox", { name, exact: true });
const closeMenus = async (page) => {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
};
const attach = async (page, name, mimeType, buffer) => {
  await compose(page)
    .getByLabel("Files from this computer")
    .setInputFiles({ name, mimeType, buffer });
  return seen(() =>
    compose(page)
      .getByRole("listitem")
      .filter({ hasText: name })
      .filter({ hasText: "byte" })
      .isVisible(),
  );
};
const sendIt = async (page) => {
  await page.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(page).count()) === 0);
};

async function mail(c, m) {
  await newMessage(m, chris.name, "Placed");
  await menuPath(m, "Edit", "Attachments");
  const always = attachRow(m, "Always Send Windows-Friendly Attachments");
  await always.waitFor({ timeout: 5_000 });
  step(
    "Windows-Friendly: the rows are checks that can be chosen, saying a file here has no fork to strip",
    (await always.getAttribute("aria-disabled")) !== "true" &&
      /no resource fork/.test((await always.getAttribute("title")) ?? ""),
  );
  const atEnd = attachRow(m, "Insert Attachments at End of Message");
  step(
    "Insert Attachments at End of Message starts unchecked and can be chosen",
    (await atEnd.getAttribute("aria-checked")) === "false" &&
      (await atEnd.getAttribute("aria-disabled")) !== "true",
  );
  await always.click();
  step(
    "Always Send Windows-Friendly is kept with the person's settings",
    await seen(async () => (await values(m))["mail.windowsFriendly"] === true),
  );
  await closeMenus(m);
  await menuPath(m, "Edit", "Attachments");
  step(
    "Send Windows-Friendly follows it for this message",
    (await attachRow(m, "Send Windows-Friendly Attachments").getAttribute("aria-checked")) ===
      "true",
  );
  await attachRow(m, "Insert Attachments at End of Message").click();
  step(
    "turning Insert at End on is kept with the person's settings",
    await seen(async () => (await values(m))["mail.attachmentsAtEnd"] === true),
  );
  await closeMenus(m);
  await menuPath(m, "Edit", "Attachments");
  await attachRow(m, "Insert Attachments at End of Message").click();
  step(
    "turning it off again is kept too",
    await seen(async () => (await values(m))["mail.attachmentsAtEnd"] === false),
  );
  await closeMenus(m);

  await editor(m).click();
  await m.keyboard.insertText(`before${id} after${id}`);
  for (let at = 0; at < `after${id}`.length; at += 1) await m.keyboard.press("ArrowLeft");
  const name = `placed-${id}.txt`;
  const bytes = `the bytes of ${id}`;
  await attach(m, name, "text/plain", Buffer.from(bytes));
  const written = await editor(m).evaluate((node) => node.innerHTML);
  step(
    "off, the file takes its place at the insertion point of the text",
    new RegExp(`before${id} <span[^>]*data-mail-file="${name}"[^>]*>${name}</span>after${id}`).test(
      written,
    ),
    written.slice(0, 200),
  );
  const removedName = `removed-${id}.txt`;
  await attach(m, removedName, "text/plain", Buffer.from("gone"));
  await compose(m)
    .getByRole("listitem")
    .filter({ hasText: removedName })
    .getByRole("button", { name: "Remove" })
    .click();
  step(
    "removing a file takes its place out of the text",
    await seen(
      async () => !(await editor(m).evaluate((node) => node.innerHTML)).includes(removedName),
    ),
  );
  await shot(m, "rows22-file-in-text");
  await sendIt(m);

  await arrive(c, () => row(c, subject("Placed")).isVisible());
  await row(c, subject("Placed")).click();
  const shown = viewer(c).locator(".mac-mail-live-styled");
  await seen(() => shown.locator("[data-mail-file] .mac-mail-live-attachment").isVisible());
  step(
    "the reader shows the file between the words, not under them",
    await shown.evaluate(
      (node, [word, file]) => {
        const mark = node.querySelector("[data-mail-file]");
        if (!mark) return false;
        const before = document.createRange();
        before.setStart(node, 0);
        before.setEndBefore(mark);
        const after = document.createRange();
        after.setStartAfter(mark);
        after.setEnd(node, node.childNodes.length);
        return (
          before.toString().includes(`before${word}`) &&
          after.toString().includes(`after${word}`) &&
          mark.textContent.includes(file)
        );
      },
      [id, name],
    ),
  );
  step(
    "and does not list it again under the text",
    (await viewer(c).locator(".mac-mail-live-received").count()) === 0,
  );
  await shot(c, "rows22-file-in-reader");
  const delivered = await onServer(c, subject("Placed"));
  const file = delivered?.attachments?.[0];
  const reply = await c.request.get(
    new URL(`/api/mail/messages/${delivered.id}/attachments/${file.id}`, c.url()).href,
  );
  step(
    "Windows-Friendly on, the bytes that arrive are the bytes chosen",
    (await reply.text()) === bytes,
  );

  await newMessage(m, chris.name, "Under");
  await menuPath(m, "Edit", "Attachments");
  await attachRow(m, "Insert Attachments at End of Message").click();
  await closeMenus(m);
  await editor(m).click();
  await m.keyboard.insertText(`text ${id}`);
  const under = `under-${id}.txt`;
  await attach(m, under, "text/plain", Buffer.from("under"));
  step(
    "on again, a file goes under the text and not in it",
    !(await editor(m).evaluate((node) => node.innerHTML)).includes("data-mail-file"),
  );
  await sendIt(m);
  await arrive(c, () => row(c, subject("Under")).isVisible());
  await row(c, subject("Under")).click();
  step(
    "and the reader lists it under the text",
    await seen(() =>
      viewer(c).locator(".mac-mail-live-received").getByText(under, { exact: true }).isVisible(),
    ),
  );

  await openPane(c, "Accounts");
  const download = preferences(c).getByRole("checkbox", {
    name: "Download attachments automatically",
  });
  const mailDrop = preferences(c).getByRole("checkbox", {
    name: "Send large attachments with Mail Drop",
  });
  step(
    "Accounts names the person, and Mail Drop is dimmed",
    (await preferences(c).getByText(`${chris.name}@macalicious`).isVisible()) &&
      (await mailDrop.getAttribute("aria-disabled")) === "true",
  );
  await shot(c, "rows22-mail-accounts");
  await download.click();
  step(
    "Download attachments automatically off is kept with the person's settings",
    await seen(async () => (await values(c))["mail.downloadAttachments"] === false),
  );
  await closePreferences(c);
  await newMessage(m, chris.name, "Picture");
  await attach(m, `picture-${id}.png`, "image/png", PNG);
  await sendIt(m);
  await arrive(c, () => row(c, subject("Picture")).isVisible());
  const reads = [];
  const heard = (request) => {
    if (/\/attachments\/.*piece=/.test(request.url())) reads.push(request.url());
  };
  c.on("request", heard);
  await row(c, subject("Picture")).click();
  const show = viewer(c).getByRole("button", { name: "Show Picture" });
  await seen(() => show.isVisible());
  await c.waitForTimeout(1_500);
  step(
    "off, a picture is not read from the server until asked for",
    reads.length === 0 && (await viewer(c).locator(".mac-mail-live-picture").count()) === 0,
    reads.join(),
  );
  await show.click();
  step(
    "Show Picture reads it and shows it",
    (await seen(() => viewer(c).locator(".mac-mail-live-picture").isVisible())) && reads.length > 0,
  );
  c.off("request", heard);
}

const contactsWindow = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const contactRows = (page, name) =>
  contactsWindow(page).getByRole("listbox").getByRole("option").filter({ hasText: name });
const contactPrefs = (page) => page.locator(".mac-contacts-preferences");
const cardsOf = async (page) => {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  const body = await reply.json();
  return { ...body, cards: body.cards ?? [] };
};
const storedPictures = async (page, ids) => {
  const reply = await page.request.get(
    new URL(`/api/contacts/pictures?ids=${ids.join(",")}`, page.url()).href,
  );
  return (await reply.json()).pictures ?? {};
};
const addCards = async (page, more, picturesOf = {}) => {
  for (const [card, version] of Object.entries(picturesOf)) {
    const put = await page.request.put(new URL(`/api/contacts/pictures/${card}`, page.url()).href, {
      data: { version, image: PNG_URL },
    });
    if (!put.ok()) throw new Error(`could not store a picture: ${put.status()}`);
  }
  const { cards = [], rev } = await cardsOf(page);
  const reply = await page.request.put(new URL("/api/contacts/cards", page.url()).href, {
    data: { cards: [...cards, ...more], rev },
  });
  if (!reply.ok()) throw new Error(`could not store the cards: ${reply.status()}`);
};
const reopenContacts = async (page) => {
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts").catch(() => {});
  await contactsWindow(page)
    .locator(".mac-contacts-split:not([inert])")
    .waitFor({ timeout: 15_000 });
};
const chooseBoth = async (page, name) => {
  await contactsWindow(page).getByText("All Contacts").first().click();
  await within(10_000, async () => (await contactRows(page, name).count()) === 2);
  await contactRows(page, name).nth(0).click();
  await contactRows(page, name)
    .nth(1)
    .click({ modifiers: ["Control"] });
  await within(5_000, () => contactsWindow(page).getByText("2 Cards").isVisible());
};

async function contacts(c) {
  await openFromDock(c, "Contacts");
  await contactsWindow(c).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  const zed = `Zed${id}`;
  await addCards(c, [{ id: `${zed}-m`, account: "mac", first: zed, last: "" }]);
  await reopenContacts(c);
  await within(10_000, async () => (await contactRows(c, zed).count()) === 1);
  await menuPath(c, "Contacts", "Preferences");
  await contactPrefs(c).getByRole("tab", { name: "Accounts" }).click();
  const accounts = contactPrefs(c).getByRole("listbox", { name: "Accounts" });
  step(
    "Accounts lists iCloud and On My Mac",
    (await accounts.getByRole("option").allTextContents()).join() === "iCloud,On My Mac",
  );
  await accounts.getByRole("option", { name: "On My Mac" }).click();
  const enable = contactPrefs(c).getByRole("checkbox", { name: "Enable this account" });
  await enable.click();
  step(
    "turned off, the account's cards leave the list and its group the sidebar",
    (await seen(async () => (await contactRows(c, zed).count()) === 0)) &&
      (await contactsWindow(c).getByText("All on My Mac").count()) === 0,
  );
  await shot(c, "rows22-contacts-accounts");
  step(
    "the card is still on the server",
    (await cardsOf(c)).cards.some((card) => card.first === zed),
  );
  await accounts.getByRole("option", { name: "iCloud" }).click();
  step(
    "the last account on stays on, and says why",
    (await enable.getAttribute("aria-disabled")) === "true",
  );
  await reopenContacts(c);
  step(
    "still off after a reload",
    (await contactRows(c, zed).count()) === 0 &&
      (await values(c))["contacts.accountsOff"]?.join() === "mac",
  );
  await menuPath(c, "Contacts", "Preferences");
  await contactPrefs(c).getByRole("tab", { name: "Accounts" }).click();
  await contactPrefs(c)
    .getByRole("listbox", { name: "Accounts" })
    .getByRole("option", { name: "On My Mac" })
    .click();
  await contactPrefs(c).getByRole("checkbox", { name: "Enable this account" }).click();
  step(
    "turned on again, the card comes back",
    await seen(async () => (await contactRows(c, zed).count()) === 1),
  );
  await contactPrefs(c).getByRole("tab", { name: "General" }).click();
  await contactPrefs(c).getByRole("combobox", { name: "Default Account" }).click();
  await c.getByRole("option", { name: "On My Mac", exact: true }).last().click();
  await seen(async () => (await values(c))["contacts.defaultAccount"] === "mac");
  await contactPrefs(c).getByRole("button", { name: "Close" }).first().click();
  const una = `Una${id}`;
  await contactsWindow(c)
    .click({ position: { x: 300, y: 300 } })
    .catch(() => {});
  await contactsWindow(c).getByText("All Contacts").first().click();
  await menuPath(c, "File", "New Card");
  await c.keyboard.insertText(una);
  await contactsWindow(c).getByRole("button", { name: "Done" }).click();
  step(
    "Default Account: a new card from All Contacts goes to it",
    await seen(async () =>
      (await cardsOf(c)).cards.some((card) => card.first === una && card.account === "mac"),
    ),
  );

  // Two cards with a picture each: one stays, the other goes to Downloads, nothing is refused.
  const ida = `Ida${id}`;
  await addCards(
    c,
    [
      { id: `${ida}-a`, account: "icloud", first: ida, last: "", image: "va" },
      { id: `${ida}-b`, account: "icloud", first: ida, last: "", image: "vb", company: "B" },
    ],
    { [`${ida}-a`]: "va", [`${ida}-b`]: "vb" },
  );
  await reopenContacts(c);
  await chooseBoth(c, ida);
  await pictureRead(c);
  await menuPath(c, "Card", "Merge Selected Cards");
  const stored = async () => (await cardsOf(c)).cards.filter((card) => card.first === ida);
  step(
    "two cards with pictures merge into one, with its picture and what both held",
    await seen(async () => {
      const [only, more] = await stored();
      return only && !more && only.image === "va" && only.company === "B";
    }),
  );
  const notice = c
    .getByRole("alertdialog")
    .or(c.getByRole("alert"))
    .filter({ hasText: "Downloads" });
  step("a notice says where the other picture went", await seen(() => notice.first().isVisible()));
  await shot(c, "rows22-merge-pictures");
  await notice
    .first()
    .getByRole("button")
    .first()
    .click()
    .catch(() => {});
  const entries = await (await c.request.get(new URL("/api/files/", c.url()).href)).json();
  step(
    "the other picture is a file in Downloads",
    (entries.entries ?? []).some((entry) => entry.name === `${ida} picture.png`),
    (entries.entries ?? [])
      .map((entry) => entry.name)
      .join()
      .slice(0, 160),
  );
  const kept = await storedPictures(c, [`${ida}-a`, `${ida}-b`]);
  step(
    "the server keeps the picture of the card that stayed and not the other's",
    kept[`${ida}-a`]?.version === "va" && kept[`${ida}-b`] === undefined,
  );
  await menuPath(c, "Edit", "Undo");
  step(
    "Undo brings the other card back, naming no picture that is gone",
    await seen(async () => {
      const back = await stored();
      return back.length === 2 && back.find((card) => card.id === `${ida}-b`)?.image === undefined;
    }),
  );

  // The person's own card has none: it stays, and takes the other's picture.
  const mine = (await cardsOf(c)).cards.find((card) => card.me);
  await addCards(
    c,
    [{ id: `same-${id}`, account: "icloud", first: mine.first, last: mine.last, image: "vm" }],
    { [`same-${id}`]: "vm" },
  );
  await reopenContacts(c);
  await chooseBoth(c, chris.fullName);
  await pictureRead(c);
  await menuPath(c, "Card", "Merge Selected Cards");
  step(
    "merged into My Card, which has no picture, the other card's picture moves to it",
    await seen(async () => {
      const after = (await cardsOf(c)).cards;
      const me = after.find((card) => card.me);
      if (!me?.image || after.some((card) => card.id === `same-${id}`)) return false;
      const stillKept = await storedPictures(c, [me.id, `same-${id}`]);
      return stillKept[me.id]?.image === PNG_URL && stillKept[`same-${id}`] === undefined;
    }),
  );
}

// The pictures are read as the window opens; a merge a moment later finds them.
const pictureRead = (page) => page.waitForTimeout(1_500);

async function script(c) {
  const library = await (
    await c.request.get(new URL("/api/app-store/library", c.url()).href)
  ).json();
  await c.request.put(new URL("/api/app-store/library", c.url()).href, {
    data: {
      installed: [...new Set([...(library.installed ?? []), "script-editor"])],
      rev: library.rev,
    },
  });
  await c.reload({ waitUntil: "load" });
  await within(15_000, () => c.getByRole("menubar").isVisible());
  const tile = (name) =>
    c
      .getByRole("button", { name: new RegExp(`^${name}$`) })
      .or(c.getByRole("link", { name: new RegExp(`^${name}$`) }))
      .first();
  const managed = (app) => c.locator(`.mac-managed-window[data-window-id^="${app}"]`).first();
  if (!(await tile("Script Editor").isVisible())) {
    await c.keyboard.press("Control+Space");
    await c.keyboard.insertText("Script Editor");
    await c.keyboard.press("Enter");
  } else await tile("Script Editor").click();
  const scriptText = c.getByRole("textbox", { name: "Script", exact: true });
  await scriptText.waitFor({ state: "visible", timeout: 15_000 });
  const prefs = managed("system-preferences");
  const appearance = () =>
    c.evaluate(() => document.documentElement.getAttribute("data-appearance"));
  const setAppearance = async (radio) => {
    await tile("System Preferences").click();
    await prefs.waitFor({ timeout: 15_000 });
    const radioShown = prefs.getByRole("radio", { name: radio });
    if (!(await radioShown.isVisible())) {
      await prefs.getByRole("button", { name: "General" }).first().click();
    }
    await radioShown.click();
    await within(5_000, async () => (await appearance()) === radio.toLowerCase());
    await c.waitForTimeout(500);
  };

  const rounds = [
    [
      "AppleScript",
      /tell application "Calculator"\s+activate\s+end tell\s+tell application "System Preferences"\s+activate\s+end tell\s+tell application "System Events"\s+tell appearance preferences\s+set dark mode to true/,
    ],
    [
      "JavaScript",
      /Application\("Calculator"\)\.activate\(\);\s+Application\("System Preferences"\)\.activate\(\);\s+Appearance\.set\(\{ mode: "dark" \}\);/,
    ],
  ];
  for (const [language, expected] of rounds) {
    await tile("Script Editor").click();
    await managed("script-editor").getByRole("combobox", { name: "Language" }).click();
    await c.getByRole("option", { name: language }).click();
    await c.waitForTimeout(300);
    await scriptText.click();
    await c.keyboard.press("Control+a");
    await c.keyboard.press("Delete");
    await managed("script-editor").getByRole("button", { name: "Record" }).first().click();

    await tile("Calculator").click();
    await managed("calculator").waitFor({ timeout: 15_000 });
    await setAppearance("Dark");
    await tile("Script Editor").click();
    await c.waitForTimeout(500);
    await managed("script-editor").getByRole("button", { name: "Stop" }).first().click();
    await c.waitForTimeout(500);
    const written = await scriptText.innerText();
    step(
      `Record wrote ${language}: the applications brought forward and the appearance, not Script Editor`,
      expected.test(written) && !written.includes("Script Editor"),
      written.replace(/\s+/g, " ").slice(0, 240),
    );
    await shot(c, `rows22-recorded-${language}`);

    await setAppearance("Light");
    await tile("Calculator").click();
    await c.waitForTimeout(300);
    await menuPath(c, "Calculator", "Quit Calculator");
    await within(5_000, async () => (await managed("calculator").count()) === 0);
    await tile("Script Editor").click();
    await managed("script-editor").getByRole("button", { name: "Run" }).first().click();
    step(
      `running the recorded ${language} does it again: Calculator opens and the appearance turns dark`,
      (await seen(async () => (await managed("calculator").count()) === 1, 15_000)) &&
        (await seen(async () => (await appearance()) === "dark")),
    );
    await shot(c, `rows22-replayed-${language}`);
    await setAppearance("Light");
    await tile("Calculator").click();
    await c.waitForTimeout(300);
    await menuPath(c, "Calculator", "Quit Calculator");
    await within(5_000, async () => (await managed("calculator").count()) === 0);
  }
}

async function music(c) {
  await openFromDock(c, "Music");
  await c.waitForTimeout(1_000);
  const dimmed = async (label, path, name, why) => {
    await menuPath(c, ...path);
    const item = c.getByRole("menu").last().getByRole("menuitem", { name });
    await item.waitFor({ timeout: 5_000 });
    step(
      `${label} is dimmed and says why`,
      (await item.getAttribute("aria-disabled")) === "true" &&
        why.test((await item.getAttribute("title")) ?? ""),
    );
    await closeMenus(c);
  };
  await dimmed("Update Cloud Library", ["File", "Library"], "Update Cloud Library", /your drive/);
  await dimmed("Burn Playlist to Disc", ["File"], "Burn Playlist to Disc", /no disc drive/);
  await dimmed("Genius Playlist", ["File", "New"], "Genius Playlist", /Select a song/);
  await dimmed("Show in iTunes Store", ["Song"], "Show in iTunes Store", /iTunes Store/);
}

await run({}, {}, async ({ person }) => {
  const c = await person("chris", chris);
  if (only.includes("mail")) {
    const m = await person("martin", martin);
    await openMail(m);
    await openMail(c);
    await mail(c, m);
  }
  if (only.includes("contacts")) await contacts(c);
  if (only.includes("script")) await script(c);
  if (only.includes("music")) await music(c);
});
