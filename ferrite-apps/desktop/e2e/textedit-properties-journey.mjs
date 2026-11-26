#!/usr/bin/env node
// TextEdit's File > Show Properties: a rich text document's properties apply as typed and survive a
// reload, and plain text has none to show.
//
//   node e2e/textedit-properties-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-properties");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await text.click();
  await page.keyboard.type("the letter");

  await page.keyboard.press("ControlOrMeta+Alt+P");
  const sheet = page.getByRole("dialog", { name: "Document Properties" });
  await sheet.waitFor();
  await sheet.getByLabel("Author:").fill("Ada Lovelace");
  await sheet.getByLabel("Keywords:").fill("engines, notes — été");
  await sheet.getByLabel("Comment:").fill("A first draft");
  await page.waitForTimeout(500);
  const reach = await sheet.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const field = [...node.querySelectorAll("input")].map((input) => {
      const at = input.getBoundingClientRect();
      const hit = document.elementFromPoint(at.x + at.width / 2, at.y + at.height / 2);
      return hit === input || input.contains(hit);
    });
    const lefts = [...node.querySelectorAll("input")].map(
      (input) => input.getBoundingClientRect().left,
    );
    return {
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      field,
      lined: new Set(lefts).size === 1,
    };
  });
  step(
    "every field of the panel can be reached, and they line up",
    reach.field.length === 7 && reach.field.every(Boolean) && reach.lined,
    JSON.stringify(reach),
  );
  await shot(page, path.join(out, "textedit-properties.png"));
  await page.keyboard.press("ControlOrMeta+Alt+P");
  await sheet.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  await page.keyboard.type("!");
  step("the keyboard goes back to the document", (await text.innerText()).includes("letter!"));

  await page.waitForTimeout(1_800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await text.click();
  await page.keyboard.press("ControlOrMeta+Alt+P");
  await sheet.waitFor();
  step(
    "they are there after a reload",
    (await sheet.getByLabel("Author:").inputValue()) === "Ada Lovelace" &&
      (await sheet.getByLabel("Keywords:").inputValue()) === "engines, notes — été" &&
      (await sheet.getByLabel("Comment:").inputValue()) === "A first draft",
  );

  await page.keyboard.press("ControlOrMeta+Alt+P");
  await sheet.waitFor({ state: "detached" });
  await page.waitForTimeout(300);

  await page.getByRole("menubar").getByRole("menuitem", { name: "Format", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("menuitem", { name: "Make Plain Text" }).last().click();
  const convert = page.getByRole("button", { name: "OK" });
  await page.waitForTimeout(400);
  if (await convert.isVisible().catch(() => false)) await convert.click();
  await page.waitForTimeout(300);
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(300);
  const item = page.getByRole("menuitem", { name: /^Show Properties/ }).last();
  step(
    "plain text has no properties to show",
    (await item.getAttribute("aria-disabled")) === "true" ||
      (await item.getAttribute("data-disabled")) !== null,
  );
  await page.keyboard.press("Escape");
});
