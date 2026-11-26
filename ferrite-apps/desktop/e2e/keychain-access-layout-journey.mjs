#!/usr/bin/env node
// Keychain Access's window kept across a reload, on a served desktop: the keychain and category chosen, the order and
// Hide Status Bar and Hide Keychains. The status bar counts the items and says why another keychain has nothing. Nothing
// kept names an item. Exits 0 only when every step passed with no console error, page error, failed request or HTTP
// error.
//
//   node e2e/keychain-access-layout-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const PASSWORD = "layout journey words";
const ITEM = "layout-journey-item";
const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("keychain-access-layout", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const dock = page.getByRole("button", { name: /^Keychain Access$/ }).first();
  await dock.click();
  const window = page.locator("[data-keychain-state]").first();
  await window.waitFor({ timeout: 10_000 });
  let dialog = page.getByRole("dialog", { name: "New Keychain Password" });
  await dialog.getByLabel("New Password:").fill(PASSWORD);
  await dialog.getByLabel("Verify:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });

  const status = window.getByRole("status");
  step("the status bar counts the items", (await status.innerText()) === "0 items");
  await page.keyboard.press("Control+n");
  dialog = page.getByRole("dialog", { name: "New Password Item" });
  await dialog
    .getByLabel(/Keychain Item Name|Name/)
    .first()
    .fill(ITEM);
  await dialog.getByLabel(/Account Name/).fill("someone");
  await dialog
    .getByLabel(/^Password/)
    .first()
    .fill("layout-s3cret");
  await dialog.getByRole("button", { name: "Add" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  step("and follows them", (await status.innerText()) === "1 item");

  await window.getByRole("grid", { name: "Keychains" }).getByText("System Roots").click();
  const why = await status.innerText();
  step("another keychain says why it has nothing", /cannot read .System Roots/.test(why), why);
  await page.screenshot({ path: path.join(out, "keychain-status.png") });
  await window.getByRole("grid", { name: "Keychains" }).getByText("login").click();

  let saved = nextSave(
    page,
    SETTINGS,
    (body) => body?.values?.["keychain-access.layout"]?.category === "passwords",
  );
  await window.getByRole("grid", { name: "Category" }).getByText("Passwords").click();
  await saved;
  saved = nextSave(
    page,
    SETTINGS,
    (body) => body?.values?.["keychain-access.layout"]?.sort?.column === "kind",
  );
  await window.getByRole("button", { name: "Kind", exact: true }).click();
  await saved;
  saved = nextSave(
    page,
    SETTINGS,
    (body) => body?.values?.["keychain-access.layout"]?.statusHidden === true,
  );
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Hide Status Bar" }).click();
  await saved;
  step("Hide Status Bar takes it away", (await status.count()) === 0);
  saved = nextSave(
    page,
    SETTINGS,
    (body) => body?.values?.["keychain-access.layout"]?.sourcesHidden === true,
  );
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Hide Keychains" }).click();
  await saved;
  const keychains = window.getByRole("grid", { name: "Keychains" });
  step("Hide Keychains takes the lists away", !(await keychains.isVisible()));
  await page.screenshot({ path: path.join(out, "keychain-hidden-lists.png") });

  const kept = await page.evaluate(
    (url) => fetch(url, { credentials: "same-origin" }).then((reply) => reply.text()),
    SETTINGS,
  );
  step(
    "nothing kept names an item or holds its secret",
    !kept.includes(ITEM) && !kept.includes("layout-s3cret"),
  );

  // The window comes back with the desktop, locked: its Unlock dialog holds the page until answered.
  await page.reload();
  await window.waitFor({ timeout: 20_000 });
  const unlock = page.getByRole("dialog", { name: /Unlock/ });
  await unlock.waitFor({ timeout: 10_000 });
  await unlock.getByLabel(/Password/).fill(PASSWORD);
  await unlock.getByRole("button", { name: "Unlock" }).click();
  await unlock.waitFor({ state: "hidden", timeout: 20_000 });
  await page.waitForTimeout(500);
  step("after a reload the lists stay hidden", !(await keychains.isVisible()));
  step("and the status bar", (await status.count()) === 0);
  step(
    "and the order is kept",
    (await window.getByRole("columnheader", { name: "Kind" }).getAttribute("aria-sort")) !== "none",
  );
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Show Keychains" }).click();
  await keychains.waitFor({ timeout: 3_000 });
  const passwords = window
    .getByRole("grid", { name: "Category" })
    .getByRole("row", { name: /Passwords/ });
  step("and the category", (await passwords.getAttribute("aria-selected")) === "true");
  await page.screenshot({ path: path.join(out, "keychain-kept.png") });
});
