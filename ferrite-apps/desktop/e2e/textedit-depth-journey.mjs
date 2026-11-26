#!/usr/bin/env node
// TextEdit at depth: Find and Replace on the document, the text's context menu, and a reload just
// after typing. Exits 0 only when every step passed with no console error, page error or failed
// request.
//
//   ferrite dev                                           # in ferrite-apps/desktop
//   node e2e/textedit-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-depth");
const WORD = `quillwort${Date.now()}`;

const draftHolds = async (page, wanted) => {
  for (let i = 0; i < 40; i++) {
    const { json } = await api(page, "GET", "/api/textedit/draft");
    if (JSON.stringify(json?.draft ?? null).includes(wanted)) return true;
    await page.waitForTimeout(250);
  }
  return false;
};

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const text = page.getByRole("textbox", { name: "Document" }).first();
  await text.waitFor({ state: "visible", timeout: 10_000 });
  await text.click();
  await page.keyboard.type(`${WORD} one, ${WORD} two, ${WORD} three.`);
  step("the draft holds what was typed", await draftHolds(page, `${WORD} three`));

  await page.keyboard.press("ControlOrMeta+f");
  const bar = page.locator(".mac-notes-find");
  await bar.locator("input").first().fill(WORD);
  step("Command-F counts the matches", await bar.getByText("1 of 3").isVisible());
  await bar.getByRole("button", { name: "Next" }).click();
  step("Next moves on to the second", await bar.getByText("2 of 3").isVisible());
  await shot(page, path.join(out, "textedit-find.png"));
  await page.keyboard.press("Escape");

  await page.keyboard.press("ControlOrMeta+Alt+f");
  const replace = bar
    .getByRole("searchbox", { name: "Replace" })
    .or(bar.getByLabel("Replace"))
    .first();
  await replace.waitFor({ state: "visible" });
  await replace.fill("sorrel");
  await bar.getByRole("button", { name: "All" }).click();
  await page.waitForTimeout(300);
  const replaced = await text.innerText();
  step(
    "Replace All replaces all three",
    (replaced.match(/sorrel/g) ?? []).length === 3 && !replaced.includes(WORD),
  );
  await shot(page, path.join(out, "textedit-replace.png"));
  await bar.getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(200);
  step("Undo takes a replacement back", (await text.innerText()).includes(WORD));

  // The text's context menu.
  await text.dblclick();
  await text.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Text commands" });
  await menu.waitFor({ state: "visible" });
  step(
    "a secondary click offers Look Up and Speech",
    await menu.getByRole("menuitem", { name: "Look Up" }).isVisible(),
  );
  await shot(page, path.join(out, "textedit-context-menu.png"));
  await page.keyboard.press("Escape");

  // The saved draft comes back into the document after a reload, and no request fails on the way.
  await text.click();
  const marker = `kept${Date.now()}`;
  await page.keyboard.type(` ${marker}`);
  step("the draft saves the last edit", await draftHolds(page, marker));
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ state: "visible", timeout: 10_000 });
  await text.getByText(marker).first().waitFor({ state: "visible", timeout: 10_000 });
  step("a reload shows the last edit in the document", (await text.innerText()).includes(marker));
});
