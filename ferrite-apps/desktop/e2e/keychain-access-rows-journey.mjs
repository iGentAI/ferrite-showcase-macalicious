#!/usr/bin/env node
// Keychain Access's everyday parts on a served desktop, each with a screenshot: the first password and the Unlock dialog,
// the keychain across a reload with nothing of it in the clear on the server, closing the window locks it, the toolbar,
// the search field, the category list, resizing the lists and a column, sorting, the summary, arrow keys, Return and a
// double click, Edit's Undo to Select All, Command-L and Lock All, the conflict dialog from a second browser, and forgetting
// the keychain from Storage Management. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/keychain-access-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

const VAULT = "/api/keychain-access/vault";
const PASSWORD = "journey horse battery";
const SECRETS = { "rows-alpha": "alpha-s3cret", "rows-beta": "beta-s3cret" };
const NOTE = { name: "rows-note", text: "a private note" };

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

const unlock = async (page) => {
  const dialog = page.getByRole("dialog", { name: /Unlock/ });
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
};

await journey("keychain-access-rows", async ({ page, base, out, step }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `keychain-rows-${name}.png`) });
  };
  await openDesktop(page, base);
  const open = () =>
    page
      .getByRole("button", { name: /^Keychain Access$/ })
      .first()
      .click();
  await open();
  const window = page.locator("[data-keychain-state]").first();
  await window.waitFor({ timeout: 10_000 });
  const state = () => window.getAttribute("data-keychain-state");
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const grid = window.getByRole("grid", { name: "Items" });
  const row = (name) => grid.getByRole("row").filter({ hasText: name }).first();
  const names = async () =>
    grid
      .locator("[data-keychain-item]")
      .allInnerTexts()
      .then((all) => all.map((n) => n.replace(/\s+/g, "")));

  let dialog = page.getByRole("dialog", { name: "New Keychain Password" });
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByLabel("New Password:").fill("short");
  await shot("new-keychain-password");
  step(
    "New Keychain Password waits for a long enough password",
    await dialog.getByRole("button", { name: "Create" }).isDisabled(),
  );
  await dialog.getByLabel("New Password:").fill(PASSWORD);
  await dialog.getByLabel("Verify:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });

  await window.getByRole("button", { name: "New Keychain Item" }).click();
  for (const [name, secret] of Object.entries(SECRETS)) {
    if (name !== "rows-alpha") await page.keyboard.press("Control+n");
    dialog = page.getByRole("dialog", { name: "New Password Item" });
    await dialog.waitFor({ timeout: 5_000 });
    await dialog.getByLabel("Keychain Item Name:").fill(name);
    await dialog.getByLabel("Password:", { exact: true }).fill(secret);
    const saved = nextSave(page, VAULT);
    await dialog.getByRole("button", { name: "Add" }).click();
    await saved;
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  }
  step("the toolbar's + asks for a new item", (await row("rows-alpha").count()) === 1);
  await page.keyboard.press("Control+Shift+n");
  dialog = page.getByRole("dialog", { name: "New Secure Note Item" });
  await dialog.waitFor({ timeout: 5_000 });
  step("Command-Shift-N asks for a secure note", true);
  await dialog.getByLabel("Keychain Item Name:").fill(NOTE.name);
  await dialog.getByRole("textbox", { name: "Note:" }).fill(NOTE.text);
  const noted = nextSave(page, VAULT);
  await dialog.getByRole("button", { name: "Add" }).click();
  await noted;
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });

  await row("rows-alpha").click();
  await shot("summary");
  const summary = window.getByRole("group", { name: "Selected item" });
  step(
    "the summary describes the selected item",
    (await summary.innerText()).includes("rows-alpha"),
  );
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  step("Arrow Down selects the next row", (await summary.innerText()).includes("rows-beta"));
  await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog", { name: "rows-beta" });
  await dialog.waitFor({ timeout: 3_000 });
  await shot("return-opens-info");
  step("Return opens the item's info", true);
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.waitFor({ state: "hidden" });
  await row("rows-alpha").dblclick();
  dialog = page.getByRole("dialog", { name: "rows-alpha" });
  await dialog.waitFor({ timeout: 3_000 });
  step("a double click opens it too", true);
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.waitFor({ state: "hidden" });
  await window.getByRole("button", { name: "Info" }).click();
  dialog = page.getByRole("dialog", { name: "rows-alpha" });
  await dialog.waitFor({ timeout: 3_000 });
  step("the toolbar's Info opens it", true);
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.waitFor({ state: "hidden" });

  const search = window.getByRole("searchbox").or(window.getByPlaceholder("Search")).first();
  await search.fill("beta");
  await page.waitForTimeout(200);
  await shot("search");
  step(
    "the search field lists what matches",
    (await names()).join() === "rows-beta",
    (await names()).join(),
  );
  await search.selectText();
  await menu(page, "Edit");
  await shot("edit-menu");
  for (const name of ["Undo", "Redo"]) {
    const item = page.getByRole("menuitem", { name: new RegExp(`^${name}`) });
    step(
      `${name} is dimmed and says why`,
      (await item.getAttribute("aria-disabled")) === "true" &&
        (await item.getAttribute("data-reason"))?.includes("no history") === true,
    );
  }
  await page.getByRole("menuitem", { name: /^Cut/ }).click();
  await page.waitForTimeout(500);
  step(
    "Edit > Cut takes the search words to the clipboard",
    (await clipboard()) === "beta" && (await search.inputValue()) === "",
  );
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Paste/ }).click();
  await page.waitForTimeout(500);
  step("Edit > Paste puts them back", (await search.inputValue()) === "beta");
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(500);
  step(
    "Edit > Select All selects the field's words while the field has the keyboard",
    await search.evaluate((field) => field.selectionEnd - field.selectionStart === 4),
  );
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy$/ }).click();
  await page.waitForTimeout(300);
  step("Edit > Copy copies them", (await clipboard()) === "beta");
  await search.fill("");
  await page.waitForTimeout(200);

  await row("rows-alpha").click();
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(300);
  await menu(page, "Edit");
  await shot("select-all");
  step(
    "Edit > Select All selects every row while the table has the keyboard",
    (await grid.locator("[role='row'][aria-selected='true']").count()) === 3,
  );
  await page.getByRole("menuitem", { name: /^Copy$/ }).click();
  await page.waitForTimeout(300);
  const copied = await clipboard();
  step(
    "Edit > Copy copies the items' names and no secret",
    copied.includes("rows-alpha") &&
      copied.includes("rows-note") &&
      !Object.values(SECRETS).some((secret) => copied.includes(secret)),
  );
  await row("rows-beta").click({ button: "right" });
  await shot("item-menu");
  await page.getByRole("menuitem", { name: /^Copy$/ }).click();
  await page.waitForTimeout(300);
  step(
    "the row menu's Copy copies the selection's names",
    (await clipboard()).includes("rows-beta"),
  );

  // The search field's words stay out of it once the table has the keyboard, and rows once the field has it.
  await search.fill("rows");
  await search.selectText();
  await row("rows-beta").click();
  await page.evaluate(() => navigator.clipboard.writeText("sentinel"));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Cut/ }).click();
  await page.waitForTimeout(500);
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Paste/ }).click();
  await page.waitForTimeout(500);
  step(
    "with the table last, Cut and Paste leave the search field and the clipboard",
    (await search.inputValue()) === "rows" && (await clipboard()) === "sentinel",
  );
  await search.click();
  await search.evaluate((field) => field.setSelectionRange(0, 0));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy$/ }).click();
  await page.waitForTimeout(300);
  step(
    "with the field last and nothing selected in it, Copy leaves the clipboard",
    (await clipboard()) === "sentinel",
  );
  await search.fill("");
  await page.waitForTimeout(200);

  const categories = window.getByRole("grid", { name: "Category" });
  await categories.getByText("Secure Notes", { exact: true }).click();
  await page.waitForTimeout(200);
  await shot("category");
  step("a category lists its kind", (await names()).join() === NOTE.name, (await names()).join());
  await categories.getByText("All Items", { exact: true }).click();
  await page.waitForTimeout(200);

  const heading = window.getByRole("columnheader", { name: "Name" });
  await heading.click();
  await page.waitForTimeout(200);
  const topName = (await names())[0];
  await heading.click();
  await page.waitForTimeout(200);
  await shot("sorted");
  step(
    "a heading sorts the table, and a second press reverses it",
    topName !== (await names())[0],
    `${topName} then ${(await names())[0]}`,
  );
  const kind = window.getByRole("columnheader", { name: "Kind" });
  const before = await kind.boundingBox();
  await page.mouse.move(before.x + before.width - 1, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width + 50, before.y + before.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const wider = await kind.boundingBox();
  await shot("column-wide");
  step("a heading's edge resizes the column", wider.width >= before.width + 30, `${wider.width}`);

  const pane = window.getByRole("grid", { name: "Category" });
  const paneBefore = await pane.boundingBox();
  const divider = window.getByRole("separator", { name: "Resize the keychain list" });
  const line = await divider.boundingBox();
  // A point above the line, in the divider's hit area: at the line's very centre the title below it answers.
  await page.mouse.move(line.x + line.width / 2, line.y - 1);
  await page.mouse.down();
  await page.mouse.move(line.x + line.width / 2, line.y - 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await shot("lists-resized");
  const paneAfter = await pane.boundingBox();
  step(
    "the divider between the lists moves",
    paneAfter.height >= paneBefore.height + 40,
    `${paneBefore.height} to ${paneAfter.height}`,
  );

  await page.keyboard.press("Control+l");
  await page.waitForTimeout(200);
  step("Command-L locks it", (await state()) === "locked");
  await page.keyboard.press("Control+l");
  await page.getByRole("dialog", { name: /Unlock/ }).waitFor({ timeout: 3_000 });
  await shot("unlock");
  step("and again asks for the password", true);
  await unlock(page);
  await menu(page, "File");
  await page.getByRole("menuitem", { name: /^Lock All Keychains/ }).click();
  await page.waitForTimeout(300);
  await shot("lock-all");
  step("File > Lock All Keychains locks it", (await state()) === "locked");

  await reloadDesktop(page);
  await window.waitFor({ timeout: 15_000 });
  await unlock(page);
  await row("rows-alpha").waitFor({ timeout: 5_000 });
  await shot("after-reload");
  const stored = await page.evaluate((url) => fetch(url).then((reply) => reply.text()), VAULT);
  step(
    "the keychain comes back after a reload, with nothing of it in the clear on the server",
    ![...Object.keys(SECRETS), ...Object.values(SECRETS), NOTE.name, PASSWORD].some((word) =>
      stored.includes(word),
    ),
  );

  await page.keyboard.press("Control+w");
  await window.waitFor({ state: "detached", timeout: 5_000 });
  await open();
  await page.getByRole("dialog", { name: /Unlock/ }).waitFor({ timeout: 5_000 });
  await shot("closed-locks");
  step("closing the window locks it", (await state()) === "locked");
  await unlock(page);
  await row("rows-alpha").waitFor({ timeout: 5_000 });

  // A second browser of the same account saves first: this window has not heard of it yet. These two pages are
  // not the journey's own, as a refused save logs its 409 by design.
  const held = [];
  const browser = page.context().browser();
  const storageState = await page.context().storageState();
  const here = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const first = await here.newPage();
  await first.goto(base);
  await first
    .getByRole("button", { name: /^Keychain Access$/ })
    .first()
    .click();
  await unlock(first);
  await first.route("**/api/keychain-access/vault*", async (route) => {
    if (route.request().method() === "GET") held.push(route);
    else await route.continue();
  });
  const other = await browser.newContext({ storageState });
  const second = await other.newPage();
  await second.goto(base);
  await second
    .getByRole("button", { name: /^Keychain Access$/ })
    .first()
    .click();
  await unlock(second);
  await second.keyboard.press("Control+n");
  dialog = second.getByRole("dialog", { name: "New Password Item" });
  await dialog.getByLabel("Keychain Item Name:").fill("from-elsewhere");
  await dialog.getByLabel("Password:", { exact: true }).fill("elsewhere-s3cret");
  const elsewhere = nextSave(second, VAULT);
  await dialog.getByRole("button", { name: "Add" }).click();
  await elsewhere;
  await other.close();

  await first.keyboard.press("Control+n");
  dialog = first.getByRole("dialog", { name: "New Password Item" });
  await dialog.getByLabel("Keychain Item Name:").fill("from-here");
  await dialog.getByLabel("Password:", { exact: true }).fill("here-s3cret");
  await dialog.getByRole("button", { name: "Add" }).click();
  await first.unroute("**/api/keychain-access/vault*");
  for (const route of held) await route.continue();
  dialog = first.getByRole("dialog", { name: "Your Keychain Change Was Not Saved" });
  await dialog.waitFor({ timeout: 15_000 });
  await first.waitForTimeout(350);
  await first.screenshot({ path: path.join(out, "keychain-rows-conflict.png") });
  step("a change another browser beat is not lost: the window asks", true);
  await dialog.getByRole("button", { name: "Use Saved Version" }).click();
  const firstGrid = first
    .locator("[data-keychain-state]")
    .first()
    .getByRole("grid", { name: "Items" });
  await firstGrid.getByRole("row").filter({ hasText: "from-elsewhere" }).first().waitFor({
    timeout: 8_000,
  });
  step(
    "Use Saved Version shows what the other browser saved",
    (await firstGrid.getByRole("row").filter({ hasText: "from-here" }).count()) === 0,
  );
  await here.close();

  await openWithSpotlight(page, "Storage Management");
  const storage = page.locator('[data-window-id="storage-management"]');
  await storage.waitFor({ timeout: 10_000 });
  await storage.getByRole("treeitem", { name: /^App Data/ }).click();
  await storage
    .getByRole("grid", { name: "App Data files" })
    .getByText("Encrypted Keychain")
    .click();
  await storage.getByRole("button", { name: "Delete…" }).click();
  const forgot = page.waitForResponse(
    (reply) => new URL(reply.url()).pathname === VAULT && reply.request().method() === "DELETE",
  );
  await page
    .getByRole("alertdialog")
    .or(page.getByRole("dialog"))
    .last()
    .getByRole("button", { name: /Delete/ })
    .click();
  await forgot;
  for (let tries = 0; tries < 40 && (await state()) !== "none"; tries += 1) {
    await page.waitForTimeout(100);
  }
  await shot("forgotten");
  step(
    "forgetting it in Storage Management leaves Keychain Access with none",
    (await state()) === "none",
  );
});
