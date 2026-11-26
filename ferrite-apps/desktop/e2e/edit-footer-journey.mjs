#!/usr/bin/env node
// Emoji & Symbols from any application's Edit menu, Dictation's row, and Finder's Show Clipboard.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/edit-footer-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("edit-footer");
const tag = Date.now().toString(36);
const FILE = `Copied ${tag}.txt`;

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "documents", name: FILE, type: "text/plain", text: "words" });
  await launch(page, "TextEdit");
  const editor = page
    .locator(
      "[data-window-id^='textedit'] [contenteditable='true'], [data-window-id^='textedit'] textarea",
    )
    .first();
  await editor.waitFor({ timeout: 15_000 });
  await editor.click();
  await page.keyboard.type("hello ");

  const edit = page.getByRole("menuitem", { name: "Edit", exact: true }).first();
  await edit.click();
  const dictation = page.getByRole("menuitem", { name: /^Start Dictation/ });
  await dictation.waitFor({ timeout: 4_000 });
  step(
    "Dictation is offered with a field holding the keyboard",
    (await dictation.getAttribute("aria-disabled")) !== "true",
  );
  await page.getByRole("menuitem", { name: /^Emoji & Symbols/ }).click();
  const viewer = page.getByRole("dialog", { name: "Characters" });
  await viewer.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, `edit-footer-characters-${browserName}.png`));

  // Searching takes the keyboard for a moment; the character still goes where typing was.
  await viewer.getByRole("searchbox", { name: "Search characters" }).fill("pizza");
  await viewer.getByRole("button", { name: "pizza" }).click();
  step(
    "A character goes where the person was typing",
    (await editor.innerText().catch(() => editor.inputValue())).includes("hello 🍕"),
    await editor.innerText().catch(() => editor.inputValue()),
  );
  await viewer.getByRole("button", { name: "Close" }).click();
  step("and the viewer closes", (await viewer.count()) === 0);

  // Finder's Show Clipboard: the file copied.
  await launch(page, "Finder");
  const finder = page.locator('[data-window-id^="finder"]').first();
  await finder.waitFor({ timeout: 10_000 });
  await page.keyboard.press("Shift+Control+O");
  await finder.getByRole("option", { name: FILE }).click();
  await page.keyboard.press("Control+C");
  await page.getByRole("menuitem", { name: "Edit", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Show Clipboard" }).click();
  const clip = page.locator('[data-window-id$="clipboard"]').first();
  await clip.waitFor({ timeout: 5_000 });
  step("Show Clipboard names the file copied", (await clip.innerText()).includes(FILE));
  await page.waitForTimeout(300);
  await shot(page, path.join(out, `edit-footer-clipboard-${browserName}.png`));

  // Text copied in another application while the panel stays open shows in it.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await launch(page, "TextEdit");
  await editor.click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+C");
  await launch(page, "Finder");
  step(
    "Text copied in another application shows in the open panel",
    await clip
      .getByText("crazy ones")
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
    await clip.innerText(),
  );
  await page.waitForTimeout(300);
  await page.getByRole("menuitem", { name: "Edit", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Hide Clipboard" }).click();
  step("and Hide Clipboard takes it away", (await clip.count()) === 0);
});
