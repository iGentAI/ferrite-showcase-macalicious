#!/usr/bin/env node
// Script Editor's JavaScript on the served desktop: keywords and comments styled after Compile, a
// syntax error refused without running, and the script's context menu. Exits 0 only when every step
// passed with no console error, page error or failed request.
//
//   node e2e/script-editor-javascript-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("script-editor-javascript", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "script-editor"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  const script = page.getByRole("textbox", { name: "Script", exact: true });
  await script.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(600);
  const windowOf = page.locator('.mac-managed-window[data-window-id^="script-editor"]').first();
  await windowOf.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "JavaScript" }).click();
  await page.waitForTimeout(300);

  await script.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('const a = "b"; // c');
  const compile = windowOf.getByRole("button", { name: "Compile" }).first();
  await compile.click();
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "script-editor-javascript.png"));
  step("Compile accepts a script that parses", !/Syntax Error/.test(await windowOf.textContent()));
  const styled = (style) =>
    script
      .locator(`[data-style="${style}"]`)
      .evaluateAll((nodes) => nodes.map((node) => node.textContent));
  step("Compile sets a keyword", (await styled("keyword")).includes("const"));
  step("and a comment", (await styled("comment")).includes("// c"));

  await script.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("anything {");
  await compile.click();
  await page.waitForTimeout(400);
  const whole = await windowOf.textContent();
  step("Compile refuses a syntax error and says so", /Syntax Error/.test(whole));
  await page.keyboard.press("Escape");
  const dismiss = page.getByRole("alertdialog").getByRole("button", { name: "OK" });
  if (await dismiss.count()) await dismiss.click();

  await script.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("word");
  await page.keyboard.press("ControlOrMeta+a");
  await script.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Script commands" });
  await menu.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "script-editor-menu.png"));
  step(
    "the script's context menu has the Edit rows, Find and Speech",
    (await menu.getByRole("menuitem", { name: /^Copy/ }).count()) === 1 &&
      (await menu.getByRole("menuitem", { name: /^Find$/ }).count()) === 1 &&
      (await menu.getByRole("menuitem", { name: /^Speech$/ }).count()) === 1,
  );
});
