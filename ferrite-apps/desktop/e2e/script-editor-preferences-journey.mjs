#!/usr/bin/env node
// Script Editor > Preferences on the served desktop: Wrap lines and Tab width reach the open script,
// and are still set after a reload. It reads the script's computed style.
//
//   node e2e/script-editor-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("script-editor-preferences");

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
  const editor = window.getByRole("textbox", { name: "Script", exact: true });
  await editor.waitFor({ timeout: 10_000 });
  const style = () =>
    editor.evaluate((root) => {
      const { whiteSpace, whiteSpaceCollapse, textWrapMode, tabSize } = getComputedStyle(root);
      return {
        wrap: (textWrapMode || whiteSpace) !== "nowrap" && whiteSpace !== "pre",
        whiteSpaceCollapse,
        tabSize,
      };
    });
  step(
    "a script does not wrap at first",
    (await style()).wrap === false,
    JSON.stringify(await style()),
  );

  const bar = page.getByRole("menubar");
  await bar.getByRole("menuitem", { name: "Script Editor", exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  const preferences = page.locator(".mac-preferences-window").first();
  await preferences.waitFor({ timeout: 8000 });
  await preferences.getByRole("checkbox", { name: "Wrap lines" }).click();
  await preferences.getByRole("combobox", { name: /Tab width/ }).click();
  await page.getByRole("option", { name: "43 points" }).click();
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "script-editor-preferences.png"));
  const changed = await style();
  step("Wrap lines reaches the open script", changed.wrap === true, JSON.stringify(changed));
  step("Tab width reaches it", changed.tabSize === "43px", changed.tabSize);

  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  await editor.waitFor({ timeout: 10_000 });
  const kept = await style();
  step(
    "both are set after a reload",
    kept.wrap === true && kept.tabSize === "43px",
    JSON.stringify(kept),
  );
});
