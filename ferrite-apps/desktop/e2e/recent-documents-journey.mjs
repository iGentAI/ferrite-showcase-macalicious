#!/usr/bin/env node
// Apple > Recent Items lists documents as well as applications: a file opened in Finder is listed, its
// row opens it, the list is there after a reload, and Clear Menu forgets it across a reload too.
//
//   node e2e/recent-documents-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("recent-documents");
const tag = Date.now().toString(36);
const NOTE = `Recent ${tag}.txt`;
const WORDS = `recent words ${tag}`;

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "documents", name: NOTE, type: "text/plain", text: WORDS });
  const recentItems = async () => {
    await page.getByRole("menuitem", { name: "Apple", exact: true }).click();
    await page.getByRole("menuitem", { name: "Recent Items", exact: true }).hover();
    return page.getByRole("menu").last();
  };
  const rowOf = (menu, name) => menu.getByRole("menuitem", { name, exact: true });

  let menu = await recentItems();
  await rowOf(menu, "No Recent Documents").waitFor({ timeout: 5_000 });
  step("Nothing opened yet: No Recent Documents", true);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await win.getByRole("option", { name: NOTE, exact: true }).first().dblclick();
  const document = page.getByRole("textbox", { name: "Document" }).first();
  await document.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);

  await reloadDesktop(page);
  const opened = (await api(page, "GET", "/api/files/")).json.entries.find(
    (each) => each.name === NOTE,
  );
  step("The server notes it was opened", Boolean(opened?.opened_ms), String(opened?.opened_ms));
  menu = await recentItems();
  await rowOf(menu, NOTE).waitFor({ timeout: 8_000 });
  step("A file opened in Finder is listed, after a reload", true);
  await shot(page, path.join(out, `recent-documents-${browserName}.png`));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Its row opens it, from a window closed.
  const closing = page.locator(".mac-window").filter({ has: document }).first();
  if ((await closing.count()) > 0) {
    await closing.getByRole("button", { name: "Close" }).first().click();
  }
  await page.waitForTimeout(500);
  menu = await recentItems();
  await rowOf(menu, NOTE).click();
  const shown = page.getByRole("textbox", { name: "Document" }).first();
  await shown.waitFor({ timeout: 10_000 });
  const read = () =>
    shown.evaluate((element) => element.value ?? element.textContent).catch(() => "");
  let text = "";
  for (let tries = 0; tries < 40 && !text.includes(WORDS); tries += 1) {
    text = await read();
    await page.waitForTimeout(150);
  }
  step("Its row opens the file in its application", text.includes(WORDS), text.slice(0, 60));

  menu = await recentItems();
  await rowOf(menu, "Clear Menu").click();
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  menu = await recentItems();
  await rowOf(menu, "No Recent Documents").waitFor({ timeout: 8_000 });
  step("Clear Menu forgets it, after a reload too", (await rowOf(menu, NOTE).count()) === 0);
});
