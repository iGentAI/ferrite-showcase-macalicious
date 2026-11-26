#!/usr/bin/env node
// TextEdit's Format menu on the desktop: Make Plain Text warns first, Prevent Editing holds the
// document across a reload, Allow Hyphenation is saved, and Open Recent > Clear Menu empties the list.
//
//   node e2e/textedit-format-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-format");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  const bar = page.getByRole("menubar");
  const open = async (menu) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.waitForTimeout(300);
  };
  const choose = async (menu, item) => {
    await open(menu);
    await page
      .getByRole("menuitem", { name: new RegExp(`^${item}`) })
      .last()
      .click();
    await page.waitForTimeout(300);
  };

  await choose("Format", "Make Plain Text");
  const alert = page.getByRole("alertdialog");
  await alert.waitFor();
  step(
    "Make Plain Text asks first, and says what is lost",
    (await alert.innerText()).includes("lose all text styles"),
  );
  await shot(page, path.join(out, "textedit-plain-warning.png"));
  await alert.getByRole("button", { name: "Cancel" }).click();
  step("Cancel leaves it rich", (await text.evaluate((node) => node.tagName)) !== "TEXTAREA");
  await choose("Format", "Make Plain Text");
  await alert.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(300);
  step("OK makes it plain", (await text.evaluate((node) => node.tagName)) === "TEXTAREA");
  await choose("Format", "Make Rich Text");
  step("Make Rich Text does not ask", (await alert.count()) === 0);

  await text.click();
  await page.keyboard.type("before ");
  await choose("Format", "Prevent Editing");
  const held = await text.innerText();
  await text.click();
  await page.keyboard.type("typed while held");
  step("Prevent Editing refuses typing", (await text.innerText()) === held);
  await open("Format");
  step(
    "the Format menu says Allow Editing, with Font dimmed",
    (await page.getByRole("menuitem", { name: "Allow Editing" }).count()) === 1 &&
      (await page.getByRole("menuitem", { name: "Font" }).getAttribute("aria-disabled")) === "true",
  );
  await shot(page, path.join(out, "textedit-prevent-editing.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1_500);

  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await text.click();
  const reloaded = await text.innerText();
  await page.keyboard.type("typed after reload");
  step("after a reload it is still held", (await text.innerText()) === reloaded);
  await choose("Format", "Allow Editing");
  await text.click();
  await page.keyboard.type("x");
  step("Allow Editing lets typing in again", (await text.innerText()).includes("x"));

  await choose("Format", "Allow Hyphenation");
  const hyphens = () => text.evaluate((node) => getComputedStyle(node).hyphens);
  step("Allow Hyphenation breaks words", (await hyphens()) === "auto", await hyphens());
  await choose("Format", "Make Plain Text");
  await alert.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(300);
  step("plain text too", (await hyphens()) === "auto", await hyphens());
  await choose("Format", "Make Rich Text");
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  step("and it survives a reload", (await hyphens()) === "auto", await hyphens());

  // A recent document, then the menu that lists it cleared.
  await text.click();
  await page.keyboard.press("ControlOrMeta+s");
  const sheet = page.getByRole("dialog", { name: "Save" });
  await sheet.waitFor();
  await sheet
    .getByRole("textbox")
    .first()
    .fill(`Recents ${Date.now().toString(36)}`);
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await sheet.waitFor({ state: "hidden" });
  await page.waitForTimeout(600);
  const openRecent = page.getByRole("menuitem", { name: "Open Recent" });
  await open("File");
  await openRecent.hover();
  await page.getByRole("menuitem", { name: "Clear Menu" }).click();
  await page.waitForTimeout(400);
  await open("File");
  step(
    "Clear Menu empties Open Recent",
    (await openRecent.getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
});
