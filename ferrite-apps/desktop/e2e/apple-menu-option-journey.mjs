#!/usr/bin/env node
// The Apple menu with Option held: System Information for About This Mac, and no question from Restart
// or Shut Down; without it they still ask.
//
//   node e2e/apple-menu-option-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("apple-menu-option");

await run(async (page) => {
  await openDesktop(page, base, step);
  const openApple = async () => {
    await page.getByRole("menubar").first().getByRole("menuitem", { name: "Apple" }).click();
    await page.getByRole("menu").first().waitFor({ timeout: 4_000 });
    await page.waitForTimeout(200);
  };
  const rows = async () =>
    (await page.getByRole("menu").first().getByRole("menuitem").allInnerTexts()).map((row) =>
      row.split("\n")[0].trim(),
    );

  await openApple();
  const plain = await rows();
  step(
    "Without Option the rows are as ever",
    plain.includes("About This Mac") &&
      plain.includes("Restart…") &&
      plain.includes("Shut Down…") &&
      plain.some((row) => /^Log Out .+…$/.test(row)),
    plain.join(", "),
  );
  await page.keyboard.down("Alt");
  await page.waitForTimeout(150);
  const held = await rows();
  step(
    "Option held turns About This Mac into System Information…",
    held.includes("System Information…") && !held.includes("About This Mac"),
    held.join(", "),
  );
  step(
    "and takes the dots from what will no longer ask",
    held.includes("Restart") &&
      held.includes("Shut Down") &&
      held.some((row) => /^Log Out [^…]+$/.test(row)),
  );
  await shot(page, path.join(out, `apple-menu-option-${browserName}.png`));
  await page.keyboard.up("Alt");
  await page.waitForTimeout(150);
  step("Letting go puts them back", (await rows()).includes("About This Mac"));

  await page.getByRole("menuitem", { name: "Restart…" }).click();
  const asking = page.getByRole("alertdialog");
  await asking.waitFor({ timeout: 4_000 });
  step("Restart… asks", (await asking.innerText()).includes("restart"));
  await asking.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);

  await openApple();
  await page.keyboard.down("Alt");
  await page.waitForTimeout(150);
  await page.getByRole("menuitem", { name: "System Information…" }).click();
  await page.keyboard.up("Alt");
  const report = page.locator('[data-window-id^="system-information"]');
  await report.waitFor({ timeout: 8_000 });
  step("System Information… opens System Information", await report.isVisible());

  await openApple();
  await page.keyboard.down("Alt");
  await page.waitForTimeout(150);
  const loaded = page.waitForEvent("load", { timeout: 15_000 });
  await page.getByRole("menuitem", { name: "Restart", exact: true }).click();
  await page.keyboard.up("Alt");
  step(
    "Restart with Option restarts the desktop at once, with no question",
    await loaded.then(
      () => true,
      () => false,
    ),
  );
});
