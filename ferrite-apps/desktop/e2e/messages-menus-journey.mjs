#!/usr/bin/env node
// Messages' menus and keys on Ferrite in a real browser against the running app. Exits 0 only when
// every step passed and no page logged a console error, a page error, a failed request or an HTTP
// error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/messages-menus-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-menus");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mmchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mmmartin-${id}`, fullName: `Martin ${id}`, password };

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const selectedRow = (page) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option", { selected: true });

async function menu(page, title, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name }).first().click();
}

await run({}, {}, async ({ person: open }) => {
  await open("martin", martin);
  const page = await open("chris", chris);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openFromDock(page, "Messages");
  await within(10_000, () => messagesOf(page).isVisible());

  await menu(page, "File", "New Message");
  const to = messagesOf(page).getByRole("textbox", { name: "To" });
  step(
    "File > New Message asks for a recipient",
    (await within(3_000, () => to.isVisible())) !== null,
  );
  await to.fill(martin.name);
  const message = messagesOf(page).getByRole("textbox", { name: "Message" });
  await message.fill(`first ${id}`);
  await message.press("Enter");
  const list = messagesOf(page).getByRole("listbox", { name: "Conversations" }).getByRole("option");
  await within(15_000, async () => (await list.count()) === 2);
  step("there are two conversations", (await list.count()) === 2);
  await within(15_000, async () => (await to.count()) === 0);

  await page.waitForTimeout(300);
  await page.keyboard.press("Control+F");
  const searching = await within(3_000, () =>
    messagesOf(page)
      .getByRole("searchbox")
      .evaluate((node) => node === document.activeElement),
  );
  step("Command-F goes to the search field", searching !== null);

  const before = await selectedRow(page).innerText();
  // The shared room may hold messages from before: once read it can move up the list, so the keys
  // are checked against the order the list has now.
  await page.keyboard.press("Control+2");
  const moved = await within(3_000, async () => (await selectedRow(page).innerText()) !== before);
  step("Command-2 goes to the second conversation", moved !== null);
  await page.keyboard.press("Control+1");
  const back = await within(
    3_000,
    async () => (await selectedRow(page).innerText()) === (await list.first().innerText()),
  );
  step("Command-1 goes to the first", back !== null);
  const atFirst = await selectedRow(page).innerText();
  await menu(page, "Buddies", "Next Conversation");
  const next = await within(3_000, async () => (await selectedRow(page).innerText()) !== atFirst);
  step("Buddies > Next Conversation goes to the next", next !== null);
  await shot(page, "messages-buddies");
  await menu(page, "Buddies", "Previous Conversation");
  await within(3_000, async () => (await selectedRow(page).innerText()) === atFirst);
  await list.filter({ hasText: martin.fullName }).click();

  const bubble = messagesOf(page).locator(".mac-messages-pane").getByText(`first ${id}`).first();
  const size = () => bubble.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  const normal = await size();
  await page.keyboard.press("Control+=");
  const larger = await within(3_000, async () => (await size()) > normal);
  step("Command-= makes the text bigger", larger !== null, `${await size()} from ${normal}`);
  await menu(page, "View", "Make Text Smaller");
  const same = await within(3_000, async () => (await size()) === normal);
  step("View > Make Text Smaller makes it smaller", same !== null);
  await page.keyboard.press("Control+=");
  await within(3_000, async () => (await size()) > normal);
  await page.keyboard.press("Control+0");
  step(
    "Command-0 is the normal size",
    (await within(3_000, async () => (await size()) === normal)) !== null,
  );

  await page.keyboard.press("Control+I");
  const info = await within(3_000, () => page.getByRole("dialog").first().isVisible());
  step("Command-I shows the conversation's details", info !== null);
  await shot(page, "messages-details");
  await page.keyboard.press("Escape");

  await message.fill(`pasted ${id}`);
  await menu(page, "Edit", "Select All");
  await menu(page, "Edit", "Cut");
  step(
    "Edit > Cut takes the text",
    (await within(3_000, async () => (await message.inputValue()) === "")) !== null,
  );
  await menu(page, "Edit", "Paste");
  step(
    "Edit > Paste brings it back",
    (await within(3_000, async () => (await message.inputValue()) === `pasted ${id}`)) !== null,
    await message.inputValue(),
  );
  await menu(page, "Edit", "Undo");
  step(
    "Edit > Undo takes the paste back",
    (await within(3_000, async () => (await message.inputValue()) === "")) !== null,
    await message.inputValue(),
  );

  // The browser takes its time to answer, and the keyboard goes to the search field meanwhile.
  const startSlowPaste = async () => {
    await page.evaluate(() => {
      window.clipboardRequested = false;
      window.answerClipboard = null;
      navigator.clipboard.readText = () =>
        new Promise((resolve) => {
          window.answerClipboard = () => {
            window.answerClipboard = null;
            resolve("from the clipboard");
          };
          window.clipboardRequested = true;
        });
    });
    await menu(page, "Edit", "Paste");
    // Paste first reads clipboard pictures asynchronously. Wait until this
    // attempt reaches readText, rather than answering a no-op or an old read.
    await page.waitForFunction(
      () => window.clipboardRequested && typeof window.answerClipboard === "function",
      null,
      { timeout: 10_000 },
    );
  };
  await startSlowPaste();
  const searchbox = messagesOf(page).getByRole("searchbox");
  await searchbox.focus();
  await page.evaluate(() => window.answerClipboard());
  await within(3_000, async () => (await message.inputValue()) !== "");
  step(
    "a slow Paste goes to the message field, not to where the keyboard moved",
    (await searchbox.inputValue()) === "" && (await message.inputValue()) === "from the clipboard",
  );

  await message.fill("");
  await startSlowPaste();
  await page.keyboard.press("Control+2");
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+1");
  await page.waitForTimeout(200);
  await page.evaluate(() => window.answerClipboard());
  await page.waitForTimeout(300);
  step(
    "a slow Paste lands nowhere once the conversation has changed, even back again",
    (await message.inputValue()) === "",
    await message.inputValue(),
  );
});
