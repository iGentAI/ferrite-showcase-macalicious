#!/usr/bin/env node
// Contacts' File > Print, Edit > Cut, Copy and Paste and the kept sort order on Ferrite, in a real
// browser against the running app: the page handed to the browser holds the card, the clipboard holds
// it as a vCard, a cut card leaves the server and a pasted one reaches it, and View > Sort By is read
// from the server and back after a reload. A headless browser shows no print dialog, so the page it
// was given is what is checked. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node e2e/contacts-print-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-print");
const id = Date.now().toString(36);
const person = { name: `cpchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const FIRST = `Anna${id}`;

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const names = async (page) => (await rows(page).allInnerTexts()).map((text) => text.trim());
const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).first().click();
const item = async (page, title, name) => {
  await bar(page, title);
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
};
const sortBy = async (page, name) => {
  await bar(page, "View");
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
};

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  await openFromDock(page, "Contacts");
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  const done = windowOf(page).getByRole("button", { name: "Done" });
  await page.waitForTimeout(300);
  for (const [first, last] of [
    [FIRST, "Zed"],
    ["Zoe", "Able"],
  ]) {
    const count = await rows(page).count();
    await page.keyboard.press("Control+N");
    await done.waitFor({ timeout: 3_000 });
    await windowOf(page).getByRole("textbox", { name: /first/i }).first().fill(first);
    await windowOf(page).getByRole("textbox", { name: /last/i }).first().fill(last);
    await done.click();
    await within(5_000, async () => (await rows(page).count()) === count + 1);
  }
  await rows(page).filter({ hasText: FIRST }).first().click();

  await page.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await item(page, "File", /^Print/);
  let html = "";
  await within(10_000, async () => {
    html = (await page.evaluate(() => window.printedPage)) ?? "";
    return html !== "";
  });
  step("File > Print hands the browser the card", html.includes(`${FIRST} Zed`));
  const sheet = await page.context().newPage();
  await sheet.setContent(html);
  await sheet.setViewportSize({ width: 816, height: 300 });
  await shot(sheet, "contacts-print-page");
  await sheet.close();

  await page.bringToFront();
  await item(page, "Edit", /^Copy/);
  step(
    "Edit > Copy puts the card on the clipboard as a vCard",
    (await within(5_000, async () => {
      const text = await page.evaluate(() => navigator.clipboard.readText());
      return text.startsWith("BEGIN:VCARD") && text.includes(FIRST);
    })) !== null,
  );

  // With text selected on the card, Copy copies that text.
  await page.evaluate((first) => {
    const walker = document.createTreeWalker(
      document.querySelector(".mac-contacts-card"),
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const at = walker.currentNode.data.indexOf(first);
      if (at >= 0) {
        const range = document.createRange();
        range.setStart(walker.currentNode, at);
        range.setEnd(walker.currentNode, at + first.length);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        return;
      }
    }
  }, FIRST);
  await item(page, "Edit", /^Copy/);
  step(
    "with text selected on the card, Edit > Copy copies exactly that text",
    (await within(5_000, async () => {
      return (await page.evaluate(() => navigator.clipboard.readText())) === FIRST;
    })) !== null,
  );
  await page.evaluate(() => getSelection().removeAllRanges());

  // Cut and Paste, with no text selected: Zoe's card, by the items and by the keys.
  const zoeListed = async () => (await names(page)).some((name) => name.includes("Zoe"));
  const zoeOnServer = async () => {
    const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
    return JSON.stringify(await reply.json()).includes("Zoe");
  };
  const zoeGone = async () => !(await zoeListed()) && !(await zoeOnServer());
  const zoeBack = async () => (await zoeListed()) && (await zoeOnServer());
  await rows(page).filter({ hasText: "Zoe" }).first().click();
  await item(page, "Edit", /^Cut/);
  step(
    "Edit > Cut puts the card on the clipboard as a vCard and takes it off the server",
    (await within(10_000, async () => {
      const text = await page.evaluate(() => navigator.clipboard.readText());
      return text.startsWith("BEGIN:VCARD") && text.includes("Zoe") && (await zoeGone());
    })) !== null,
  );
  await item(page, "Edit", /^Undo Cut/);
  step("Undo Cut brings it back", (await within(10_000, zoeBack)) !== null);
  await rows(page).filter({ hasText: "Zoe" }).first().click();
  await page.keyboard.press("Control+X");
  step("⌘X cuts it", (await within(10_000, zoeGone)) !== null);
  await item(page, "Edit", /^Paste/);
  step(
    "Edit > Paste adds the card back from the clipboard",
    (await within(10_000, zoeBack)) !== null,
  );
  await item(page, "Edit", /^Undo Paste/);
  step("Undo Paste takes it away", (await within(10_000, zoeGone)) !== null);
  await page.keyboard.press("Control+V");
  step("⌘V pastes it", (await within(10_000, zoeBack)) !== null);

  await sortBy(page, "First Name");
  const anna = async () => (await names(page)).findIndex((name) => name.includes(FIRST));
  const zoe = async () => (await names(page)).findIndex((name) => name.includes("Zoe"));
  await within(5_000, async () => (await anna()) < (await zoe()));
  const server = async () => {
    const reply = await page.request.get(
      new URL("/api/system-preferences/settings", page.url()).href,
    );
    return (await reply.json()).values?.["contacts.sort"];
  };
  step(
    "the sort order is on the server",
    (await within(10_000, async () => (await server()) === "first")) !== null,
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts");
  step(
    "and comes back after a reload",
    (await within(
      15_000,
      async () => (await rows(page).count()) > 1 && (await anna()) < (await zoe()),
    )) !== null,
    (await names(page)).join(),
  );
  await shot(page, "contacts-sort-kept");
});
