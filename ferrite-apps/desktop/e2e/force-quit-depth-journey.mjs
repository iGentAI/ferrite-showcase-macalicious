#!/usr/bin/env node
// Force Quit's depth on a served desktop: the Dock's icons in the list, several applications selected
// and quit together with the count asked first, and an application with unsaved text ending without a
// question of its own. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/force-quit-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();

await journey("force-quit-depth", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  for (const [name, id] of [
    ["Calculator", "calculator"],
    ["Maps", "maps"],
    ["TextEdit", "textedit"],
  ]) {
    await dock(page, name).click();
    await page.locator(`[data-window-id^="${id}"]`).first().waitFor({ timeout: 10_000 });
  }
  const document = page.locator('[data-window-id^="textedit"] [contenteditable="true"]').first();
  await document.click();
  await page.keyboard.type("unsaved words");
  step("TextEdit holds unsaved words", (await document.innerText()).includes("unsaved words"));

  await page.keyboard.press("Control+Alt+Escape");
  const window = page.locator('[data-window-id="force-quit"]');
  await window.waitFor({ timeout: 5_000 });
  const list = window.getByRole("listbox", { name: "Applications" });
  const row = (name) => list.getByRole("option", { name, exact: true });
  await row("Calculator").waitFor();
  step(
    "the rows show the Dock's icons",
    (await list.locator(".mac-force-quit-icon > *").count()) ===
      (await list.getByRole("option").count()),
  );

  await row("Calculator").click();
  await row("Maps").click({ modifiers: ["Control"] });
  await window.getByRole("button", { name: "Force Quit" }).click();
  await page.getByText("Do you want to force these 2 applications to quit?").waitFor();
  await page.screenshot({ path: path.join(out, "force-quit-several.png") });
  step("the sheet names how many", true);
  await page.getByRole("dialog").getByRole("button", { name: "Force Quit" }).click();
  await page
    .locator('[data-window-id="calculator"]')
    .waitFor({ state: "detached", timeout: 5_000 });
  await page.locator('[data-window-id="maps"]').waitFor({ state: "detached", timeout: 5_000 });
  step(
    "both windows end, and both leave the list",
    (await row("Calculator").count()) === 0 && (await row("Maps").count()) === 0,
  );

  await row("TextEdit").click();
  await window.getByRole("button", { name: "Force Quit" }).click();
  await page.getByText("You will lose any unsaved changes.").waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Force Quit" }).click();
  await page
    .locator('[data-window-id^="textedit"]')
    .first()
    .waitFor({ state: "detached", timeout: 5_000 });
  step(
    "TextEdit with unsaved text ends at once, after the warning, with no question of its own",
    (await page.getByText(/Do you want to (save|keep)/i).count()) === 0,
  );
});
