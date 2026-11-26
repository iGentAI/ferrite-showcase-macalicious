#!/usr/bin/env node
// Safari's history on Ferrite: the row menu, several rows deleted, Clear History with a range and the
// History menu, each read back from the server. Visits are added through the app's own route.
//
//   node e2e/safari-history-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("safari-history", { ignoreOtherOrigins: true });
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";
const URLS = ["a", "b", "c", "d", "e", "f"].map((name) => `https://${name}.example.org/`);
const urlsOf = async (page) =>
  ((await api(page, "GET", "/api/safari/history")).json.history ?? []).map((one) => one.url);

await run(async (page) => {
  await openDesktop(page, base, step);
  for (const url of URLS) {
    await api(page, "POST", "/api/safari/history", { url, title: url });
  }
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await chooseMenu(page, "History", "Show All History");
  const row = (url) => window.locator(`[data-history-url="${url}"]`);
  await row(URLS[0]).waitFor({ timeout: 10_000 });

  await row(URLS[5]).click({ button: "right" });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-history-menu.png"));
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await row(URLS[5]).waitFor({ state: "detached", timeout: 5_000 });
  step("a row's menu deletes the page", !(await urlsOf(page)).includes(URLS[5]));

  await row(URLS[4]).click({ modifiers: [COMMAND] });
  await row(URLS[2]).click({ modifiers: ["Shift"] });
  step(
    "Command-click, then Shift-click, selects the rows between",
    (await window.locator(".mac-safari-history-row[data-selected]").count()) === 3,
  );
  await page.keyboard.press("Backspace");
  await row(URLS[3]).waitFor({ state: "detached", timeout: 5_000 });
  const left = await urlsOf(page);
  step(
    "Delete forgets them, and only them",
    left.includes(URLS[0]) && left.includes(URLS[1]) && !left.includes(URLS[2]),
    left.join(" "),
  );

  await chooseMenu(page, "History", "Clear History…");
  const sheet = page.getByRole("dialog", { name: /Clearing history/ });
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("combobox", { name: "Clear" }).click();
  await page.getByRole("option", { name: "the last hour", exact: true }).click();
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-clear-history.png"));
  await sheet.getByRole("button", { name: "Clear History", exact: true }).click();
  await window.getByText("No History").waitFor({ timeout: 8_000 });
  step(
    "Clear History for the last hour empties a history made just now",
    (await urlsOf(page)).length === 0,
  );
});

process.exit(0);
