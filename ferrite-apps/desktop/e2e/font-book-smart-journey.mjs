#!/usr/bin/env node
// Font Book's File > New Smart Collection and Edit > Edit Smart Collection: rules decide what the
// collection holds, an edit changes it, it survives a reload, and it can be deleted.
// Exits 0 only when every step passed with no console error, page error or failed request.
//
//   node e2e/font-book-smart-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("font-book-smart");
const NAME = `Wings ${Date.now().toString(36)}`;

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Font Book");
  const window = page.locator('[data-window-id="font-book"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  const bar = page.getByRole("menubar");
  const choose = async (menu, row) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.waitForTimeout(200);
    await page.getByRole("menuitem", { name: row }).click();
    await page.waitForTimeout(300);
  };
  const sheet = page.getByRole("dialog");
  const listed = () =>
    window
      .getByRole("treegrid", { name: "Fonts" })
      .or(window.getByRole("tree", { name: "Fonts" }))
      .innerText();
  const title = () => window.locator(".mac-title-bar").first().innerText();

  await choose("File", /^New Smart Collection/);
  await sheet.getByRole("textbox", { name: "Collection Name" }).fill(NAME);
  const ok = sheet.getByRole("button", { name: "OK" });
  step("OK waits for a rule that asks something", await ok.isDisabled());
  await sheet.getByRole("textbox", { name: "Rule 1 value" }).fill("Wingdings");
  await shot(page, path.join(out, "font-book-smart-sheet.png"));
  await ok.click();
  await page.waitForTimeout(400);
  let fonts = await listed();
  step(
    "the collection holds the families that meet the rule",
    fonts.includes("Wingdings") && !fonts.includes("Zapfino") && (await title()).includes(NAME),
    `${await title()} / ${fonts.replace(/\n/g, ", ")}`,
  );
  await shot(page, path.join(out, "font-book-smart-collection.png"));

  await choose("Edit", /^Edit Smart Collection/);
  await sheet.getByRole("button", { name: "Add a rule after rule 1" }).click();
  await sheet.getByRole("textbox", { name: "Rule 2 value" }).fill("Zapf");
  await sheet.getByRole("combobox", { name: "Match" }).click();
  await page.getByRole("option", { name: "Any of the rules" }).click();
  await ok.click();
  await page.waitForTimeout(400);
  fonts = await listed();
  step(
    "an edit changes what it holds",
    fonts.includes("Wingdings") && fonts.includes("Zapfino"),
    fonts.replace(/\n/g, ", "),
  );

  await page.waitForTimeout(900);
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(1200);
  fonts = await listed();
  step(
    "it is there after a reload, selected, with its rules",
    (await title()).includes(NAME) && fonts.includes("Wingdings") && fonts.includes("Zapfino"),
    `${await title()} / ${fonts.replace(/\n/g, ", ")}`,
  );

  await choose("Edit", /^Delete Collection/);
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForTimeout(900);
  step(
    "it can be deleted",
    (await window.locator("[data-font-collection]", { hasText: NAME }).count()) === 0,
  );
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(1200);
  step(
    "and it stays deleted after a reload",
    (await window.locator("[data-font-collection]", { hasText: NAME }).count()) === 0,
  );
});
