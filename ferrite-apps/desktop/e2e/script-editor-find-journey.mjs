#!/usr/bin/env node
// Script Editor's Edit menu below Select All on the desktop, and Tab: a find bar with its count and
// Replace, a transformation and Delete chosen from the menu bar, read back from the script.
//
//   node e2e/script-editor-find-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("script-editor-find");
const stamp = String(Date.now()).slice(-6);
const WORD = `quince${stamp}`;

/** Selects `word` in the text `field`, which takes the keyboard. */
const select2 = (field, word) =>
  field.evaluate((root, wanted) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      root.focus();
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(range);
      return;
    }
  }, word);

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "script-editor"])],
    rev: library.json?.rev ?? 0,
  });
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  const window = page.locator('[data-window-id="script-editor"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const editor = window.getByRole("textbox", { name: "Script", exact: true });
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(`// ${WORD} ${WORD}`);
  await page.keyboard.press("Enter");

  await page.keyboard.press("Tab");
  await page.keyboard.type("indented");
  step(
    "Tab puts a tab in the script and keeps the keyboard there",
    (await editor.evaluate((root) => root.innerText)).includes("\tindented") &&
      (await editor.evaluate((root) => root.contains(document.activeElement))),
  );

  await page.keyboard.press("ControlOrMeta+F");
  const field = window.getByRole("searchbox", { name: "Find" });
  await field.waitFor({ timeout: 5_000 });
  await field.fill(WORD);
  const count = window.getByRole("status").filter({ hasText: / of / }).first();
  await count.waitFor({ timeout: 5_000 });
  step("Command-F opens the find bar and counts both", /1 of 2/.test(await count.innerText()));
  await page.keyboard.press("ControlOrMeta+G");
  await page.waitForTimeout(200);
  step("Command-G moves to the next", /2 of 2/.test(await count.innerText()));
  await shot(page, path.join(out, "script-editor-find.png"));

  const bar = page.getByRole("menubar").first();
  const choose = async (...names) => {
    await bar.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.waitForTimeout(200);
    for (const name of names) {
      await page
        .getByRole("menuitem", { name: new RegExp(`^${name}`) })
        .last()
        .click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(300);
  };

  // Off a Mac Control-Option-F is the window manager's full screen, which reaches it first.
  await choose("Find", "Find and Replace");
  const replace = window.getByRole("searchbox", { name: "Replace" });
  await replace.waitFor({ timeout: 5_000 });
  await replace.fill("sorrel");
  await window.getByRole("button", { name: "All", exact: true }).click();
  await page.waitForTimeout(300);
  const text = () => editor.evaluate((root) => root.textContent);
  step(
    "Replace All changes every match",
    !(await text()).includes(WORD) && (await text()).split("sorrel").length === 3,
  );
  await window.getByRole("button", { name: "Done" }).click();
  step("the find bar closes", (await field.count()) === 0);

  const select = (word) => select2(editor, word);

  await select("indented");
  await page.waitForTimeout(100);
  await choose("Transformations", "Make Upper Case");
  step(
    "Transformations > Make Upper Case changes the selection",
    (await text()).includes("INDENTED"),
  );
  await select("INDENTED");
  await page.waitForTimeout(100);
  await choose("Delete");
  step("Edit > Delete takes the selection out", !(await text()).includes("INDENTED"));

  // File > Save, > Revert To > Last Saved, and > Print: a frame with the script's text is printed.
  const fileMenu = async (...names) => {
    await bar.getByRole("menuitem", { name: "File", exact: true }).click();
    await page.waitForTimeout(200);
    for (const name of names) {
      await page
        .getByRole("menuitem", { name: new RegExp(`^${name}`) })
        .last()
        .click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(400);
  };
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  const kept = `kept${stamp}`;
  await page.keyboard.type(`// ${kept}`);
  await fileMenu("Save");
  const sheetName = page.getByRole("textbox", { name: /Save As|Name/ }).last();
  await sheetName.fill(`Reverted ${stamp}`);
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await page.waitForTimeout(1200);
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" unkept");
  await page.waitForTimeout(200);
  await fileMenu("Revert To", "Last Saved");
  await page
    .waitForFunction(
      (wanted) =>
        document
          .querySelector('[data-window-id="script-editor"] [aria-label="Script"]')
          ?.textContent.includes(wanted) === false,
      "unkept",
      { timeout: 5_000 },
    )
    .catch(() => {});
  const reverted = await text();
  step(
    "Revert To > Last Saved puts the saved script back",
    reverted.includes(kept) && !reverted.includes("unkept"),
    reverted,
  );
  await page.evaluate(() => {
    new MutationObserver(() => {
      const frame = document.querySelector("iframe[data-textedit-print]");
      if (frame) window.__printed = frame.srcdoc;
    }).observe(document.body, { childList: true });
  });
  await fileMenu("Print");
  const printFrame = await page.evaluate(() => window.__printed ?? null);
  step("File > Print prints the script's text", printFrame?.includes(kept) === true, printFrame);

  // The Description: Edit's rows act on the text last in use, and it is kept with the script.
  await window.getByRole("button", { name: "Description" }).click();
  const description = window.getByRole("textbox", { name: "Description" });
  await description.click();
  await page.keyboard.type("plum notes");
  await select2(description, "plum");
  await page.waitForTimeout(100);
  const scriptBefore = await text();
  await choose("Transformations", "Make Upper Case");
  step(
    "Edit's rows act on the Description while it is in use, not the script",
    (await description.innerText()).includes("PLUM") && (await text()) === scriptBefore,
    await description.innerText(),
  );
  await window.getByRole("button", { name: "Bundle contents" }).click();
  await window.getByRole("textbox", { name: "Version:" }).fill("2.5");
  // No wait: a reload straight after a change keeps it.
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  await editor.waitFor({ timeout: 10_000 });
  await window.getByRole("button", { name: "Description" }).click();
  await description.waitFor({ timeout: 10_000 });
  step(
    "the Description comes back after a reload",
    (await description.innerText()).includes("PLUM notes"),
    await description.innerText(),
  );
  await window.getByRole("button", { name: "Bundle contents" }).click();
  step(
    "and the bundle's field",
    (await window.getByRole("textbox", { name: "Version:" }).inputValue()) === "2.5",
  );
  await shot(page, path.join(out, "script-editor-description.png"));
});
