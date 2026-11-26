#!/usr/bin/env node
// Script Editor's File > Export… and New from Template, and the Log's tabs, on the served desktop. The
// exported file is read back from the drive, and the script that made the log runs on the server.
//
//   node e2e/script-editor-export-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("script-editor-export");
const NAME = `Export ${String(Date.now()).slice(-6)}`;

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });

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

  // New from Template.
  await bar(page, "File").click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "New from Template" }).hover();
  await page.waitForTimeout(350);
  await shot(page, path.join(out, "script-editor-templates.png"));
  await page.getByRole("menuitem", { name: "Log Messages", exact: true }).click();
  await page.waitForTimeout(300);
  const text = await editor.evaluate((root) => root.innerText);
  step(
    "New from Template puts the template in the window",
    text.includes('console.log("Started")'),
  );

  // The Log's tabs on a real run.
  await window.getByRole("button", { name: "Run", exact: true }).click();
  const result = window.getByRole("textbox", { name: "Result" });
  await result.waitFor({ timeout: 10_000 });
  for (let i = 0; i < 40 && !(await result.inputValue()).includes("Done"); i++) {
    await page.waitForTimeout(250);
  }
  step(
    "the template runs on the server",
    (await result.inputValue()).includes("Done"),
    await result.inputValue(),
  );
  await window.getByRole("button", { name: "Log", exact: true }).click();
  const log = window.getByRole("textbox", { name: "Log", exact: true });
  await log.waitFor({ timeout: 5000 });
  step(
    "Replies, the first tab shown, has the script's message",
    (await log.inputValue()).includes("Started"),
  );
  await window.getByRole("button", { name: "Messages", exact: true }).click();
  step("Messages keeps it", (await log.inputValue()).includes("Started"));
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "script-editor-log-tabs.png"));
  await window.getByRole("button", { name: "Replies", exact: true }).click();

  // Export: a new text file, and the window stays what it was.
  await bar(page, "File").click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: /^Export/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ timeout: 5000 });
  await sheet.getByRole("textbox").fill(NAME);
  await sheet.getByRole("combobox", { name: /File Format/ }).click();
  await page.getByRole("option", { name: "Text (.txt)" }).click();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "script-editor-export.png"));
  await sheet.getByRole("button", { name: "Export", exact: true }).click();
  await sheet.waitFor({ state: "hidden", timeout: 10_000 });
  step("the Log says what was exported", (await log.inputValue()).includes(`${NAME}.txt`));
  const entries = (await api(page, "GET", "/api/files/")).json?.entries ?? [];
  const file = entries.find((entry) => entry.name === `${NAME}.txt`);
  step("the drive holds the exported file", !!file, file?.id);
  const scripts = (await api(page, "GET", "/api/script-editor/scripts")).json?.scripts ?? [];
  step(
    "it is not one of the saved scripts the window opens",
    !scripts.some((script) => script.name === `${NAME}.js`),
  );
  step(
    "the window's script is unchanged",
    (await editor.evaluate((root) => root.innerText)) === text,
  );
});
