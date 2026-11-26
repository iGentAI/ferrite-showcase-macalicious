#!/usr/bin/env node
// Extensions, Trackpad, Mouse and Sharing on a served desktop: Extensions' Share Menu reaches Finder's Share
// menu, and the tabs that a web page cannot fill say what is true. Exits 0 only when every step passed with no
// console error, page error, failed request or HTTP error.
//
//   node e2e/preference-tabs-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const SHARED = "share-me.txt";

const { step, run, shot } = twoPeople("preference-tabs");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;

await run({}, {}, async ({ person }) => {
  const a = await person("ana", { name: `ptana-${id}`, fullName: `Ana ${id}`, password });
  await person("other", { name: `ptother-${id}`, fullName: `Other ${id}`, password });
  const dock = a.getByRole("toolbar", { name: "Dock" });
  const prefs = a.locator('[data-window-id="system-preferences"]');
  const openPane = async (name) => {
    await dock.getByRole("button", { name: "System Preferences" }).click();
    await prefs.waitFor();
    await prefs.getByRole("button", { name: "Show All" }).click();
    await prefs
      .getByRole("group", { name: "All preferences" })
      .getByRole("button", { name, exact: true })
      .click();
  };
  const says = (text) => prefs.getByText(text).first().isVisible();

  const shareRows = async () => {
    await dock.getByRole("button", { name: "Finder" }).click();
    const finder = a.locator('[data-window-id^="finder"]').first();
    await finder.waitFor();
    await finder.getByText("Documents", { exact: true }).first().click();
    await finder.getByRole("option", { name: SHARED, exact: true }).first().click();
    await finder.getByRole("button", { name: "Share", exact: true }).first().click();
    const menu = a.getByRole("menu").last();
    await menu.waitFor();
    const rows = (await menu.getByRole("menuitem").allInnerTexts()).map((row) => row.trim());
    await a.keyboard.press("Escape");
    return rows;
  };
  await uploadFile(a, { parent: "documents", name: SHARED, type: "text/plain", text: "shared" });
  const before = await shareRows();
  step("Finder's Share menu starts with Notes", before.includes("Notes"), before.join(", "));

  await openPane("Extensions");
  await prefs.getByRole("option", { name: /^Share Menu/ }).click();
  await prefs.getByRole("checkbox", { name: "Notes", exact: true }).click();
  await a.waitForTimeout(800);
  const after = await shareRows();
  step(
    "turned off in Extensions, Notes leaves it and Mail stays",
    !after.includes("Notes") && after.includes("Mail"),
    after.join(", "),
  );
  await dock.getByRole("button", { name: "System Preferences" }).click();
  await prefs.getByRole("option", { name: /^Today/ }).click();
  step("another category says what is true", await says(/takes no extensions/));
  await shot(a, "extensions-today");

  await openPane("Trackpad");
  await prefs.getByRole("tab", { name: "Scroll & Zoom" }).click();
  step("Trackpad's Scroll & Zoom says what reaches a page", await says(/two fingers scroll/));
  await shot(a, "trackpad-scroll");
  await prefs.getByRole("tab", { name: "More Gestures" }).click();
  step("Trackpad's More Gestures says what reaches a page", await says(/do not reach a web page/));

  await openPane("Mouse");
  step("Mouse names no battery level", (await prefs.getByText("100%").count()) === 0);
  await prefs.getByRole("tab", { name: "More Gestures" }).click();
  step("Mouse's More Gestures says what reaches a page", await says(/do not reach a web page/));

  await openPane("Sharing");
  const shown = await within(3_000, async () => says(new URL(a.url()).origin));
  step("Sharing gives this desktop's address", shown !== null);
});
