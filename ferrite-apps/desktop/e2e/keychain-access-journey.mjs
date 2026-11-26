#!/usr/bin/env node
// Keychain Access on Ferrite: open Keychain Access from Spotlight, make the
// "login" keychain with a password and add a password item. Both saves go
// through /api/keychain-access/vault and carry only the encrypted keychain:
// neither the keychain password, the item's name nor its password is in a
// request or in what the server keeps. After a reload the window asks for the
// password, refuses a wrong one, opens with the right one, and shows the
// item's password only on request. Exits 0 only when every step passed and
// the page logged no console error, page error, failed request or HTTP error.
// It removes the keychain at the end.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/keychain-access-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const URL = "/api/keychain-access/vault";
const PASSWORD = "journey horse battery";
const ITEM = "https://journey.example";
const SECRET = "j0urney-s3cret";
const { base, out } = options();
const { step, run } = journey("keychain-access");

const nextSave = (page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" && new globalThis.URL(response.url()).pathname === URL,
    { timeout: 20_000 },
  );

const plain = (text) => [PASSWORD, ITEM, "journey.example", SECRET].filter((s) => text.includes(s));

async function openWithSpotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
}

async function open(page) {
  await openWithSpotlight(page, "Keychain Access");
  const window = page.locator("[data-keychain-state]").first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  return window;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await api(page, "DELETE", URL);
  await reloadDesktop(page);

  let window = await open(page);
  let dialog = page.getByRole("dialog", { name: "New Keychain Password" });
  await dialog.waitFor({ timeout: 10_000 });
  step("a session with no keychain is asked for a new keychain password", true);
  await dialog.getByLabel("New Password:").fill(PASSWORD);
  await dialog.getByLabel("Verify:").fill(PASSWORD);
  const made = nextSave(page);
  await dialog.getByRole("button", { name: "Create" }).click();
  const first = await made;
  step(
    "the new keychain is saved, encrypted",
    first.status() === 200 && plain(first.request().postData() ?? "").length === 0,
  );
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });

  await window.getByRole("button", { name: "New Keychain Item" }).click();
  dialog = page.getByRole("dialog", { name: "New Password Item" });
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByLabel("Keychain Item Name:").fill(ITEM);
  await dialog.getByLabel("Account Name:").fill("jordan");
  await dialog.getByLabel("Password:").fill(SECRET);
  const added = nextSave(page);
  await dialog.getByRole("button", { name: "Add" }).click();
  const second = await added;
  const sent = second.request().postData() ?? "";
  step(
    "the item is saved with nothing readable in the request",
    second.status() === 200 && plain(sent).length === 0,
    plain(sent).join(", "),
  );
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });

  const stored = await api(page, "GET", URL);
  const kept = JSON.stringify(stored.json);
  step(
    "the server keeps only the envelope: KDF, salt, IV and ciphertext",
    stored.json.vault?.kdf?.name === "PBKDF2-SHA-256" &&
      typeof stored.json.vault?.ciphertext === "string" &&
      Object.keys(stored.json.vault).sort().join() === "ciphertext,iv,kdf,version" &&
      plain(kept).length === 0,
    `iterations ${stored.json.vault?.kdf?.iterations}`,
  );

  await reloadDesktop(page);
  window = await open(page);
  dialog = page.getByRole("dialog", { name: "Unlock the “login” Keychain" });
  await dialog.waitFor({ timeout: 10_000 });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .click();
  await page
    .locator('.mac-managed-window[data-window-id^="finder"]')
    .first()
    .waitFor({ timeout: 10_000 });
  const go = page.getByRole("menubar").getByRole("menuitem", { name: "Go", exact: true });
  await go.click();
  await page.getByRole("menuitem", { name: /^Documents/ }).waitFor({ timeout: 5_000 });
  await page.keyboard.press("Escape");
  step(
    "with the password prompt open, the Dock opens Finder and the menu bar opens its Go menu",
    await dialog.isVisible(),
  );
  await page
    .getByRole("button", { name: /^Keychain Access$/ })
    .first()
    .click();
  await page.waitForTimeout(300);
  step(
    "after a reload the keychain is locked and its item is not shown",
    (await window.getAttribute("data-keychain-state")) === "locked" &&
      !(await page.content()).includes("journey.example"),
  );
  await dialog.getByLabel("Password:").fill("not the password");
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.getByText("The password you entered is not correct.").waitFor({ timeout: 20_000 });
  step("a wrong password is refused", true);
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  const row = window.getByRole("row").filter({ hasText: ITEM }).first();
  await row.waitFor({ timeout: 10_000 });
  step(
    "the right password opens it, with the item listed and its password not on the page",
    (await window.getAttribute("data-keychain-state")) === "unlocked" &&
      !(await page.content()).includes(SECRET),
  );

  await row.click();
  await window.getByRole("button", { name: "Info" }).click();
  dialog = page.getByRole("dialog", { name: ITEM });
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByRole("button", { name: "Show Password" }).click();
  step(
    "Show Password shows the item's password",
    (await dialog.getByRole("textbox", { name: "Password" }).inputValue()) === SECRET,
  );
  await shot(page, path.join(out, "keychain-access.png"));
  await dialog.getByRole("button", { name: "Done" }).click();

  await api(page, "DELETE", URL);
});
