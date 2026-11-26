#!/usr/bin/env node
// Stickies' File menu on the desktop: Export Text writes the note to a drive file, Import Text makes
// a note of one, both after a reload, and Print Active Note and Print All Notes print them.
//
//   node e2e/stickies-files-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("stickies-files");
const stamp = Date.now().toString(36);
const TEXT = `Exported ${stamp}`;
const NAME = `Sticky ${stamp}`;

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Stickies");
  const notes = page.locator('[data-window-id^="stickies"]');
  await notes.first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const bar = page.getByRole("menubar");
  const choose = async (item) => {
    await bar.getByRole("menuitem", { name: "File", exact: true }).click();
    await page.waitForTimeout(300);
    await page
      .getByRole("menuitem", { name: new RegExp(`^${item}`) })
      .last()
      .click();
    await page.waitForTimeout(300);
  };
  const stored = async () => (await api(page, "GET", "/api/stickies/data")).json?.data?.notes ?? [];

  await choose("New Note");
  await page.keyboard.type(TEXT);
  await page.waitForTimeout(900);

  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(300);
  const setup = page.getByRole("menuitem", { name: /^Page Setup/ });
  step("Page Setup is offered", (await setup.getAttribute("aria-disabled")) !== "true");
  step(
    "the File menu has Save All and both Print rows",
    (await page.getByRole("menuitem", { name: /^Save All/ }).count()) === 1 &&
      (await page.getByRole("menuitem", { name: /^Print Active Note/ }).count()) === 1 &&
      (await page.getByRole("menuitem", { name: /^Print All Notes/ }).count()) === 1,
  );
  await shot(page, path.join(out, "stickies-file-menu.png"));
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    window.printed = [];
    const real = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      get() {
        const view = real.get.call(this);
        if (view && this.hasAttribute("data-textedit-print")) {
          view.print = () => window.printed.push(this.contentDocument.body.innerText);
        }
        return view;
      },
    });
  });
  const printed = async (count) => {
    await page.waitForFunction((n) => window.printed.length >= n, count, { timeout: 5_000 });
    return page.evaluate(() => window.printed);
  };
  await choose("Print Active Note");
  const one = await printed(1);
  step("Print Active Note prints this note and no other", one[0]?.trim() === TEXT, one[0]);
  await choose("Print All Notes");
  const all = await printed(2);
  const everyNote = await stored();
  step(
    "Print All Notes prints every note",
    everyNote.some((note) => note.text === TEXT) &&
      everyNote.every((note) => all[1].includes(note.text.split("\n")[0] ?? "")),
    all[1],
  );

  await choose("Export Text");
  const sheet = page.getByRole("dialog", { name: "Export Text" });
  await sheet.waitFor();
  await sheet.getByRole("textbox").first().fill(NAME);
  await shot(page, path.join(out, "stickies-export.png"));
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await sheet.waitFor({ state: "hidden" });
  await page.waitForTimeout(800);
  const entries = (await api(page, "GET", "/api/files/")).json?.entries ?? [];
  const file = entries.find((entry) => entry.name === `${NAME}.txt`);
  step("Export Text writes a text file to the drive", file !== undefined, file?.name);

  await reloadDesktop(page);
  await launch(page, "Stickies");
  await notes.first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  const count = (await stored()).length;
  step(
    "the note survives a reload",
    (await stored()).some((note) => note.text === TEXT),
    String(count),
  );

  // The note Window > Collapse leaves is as tall as its title bar, and comes back at its height.
  const noteBox = () =>
    page.evaluate(() => {
      const key = document.querySelector(
        '[data-window-id^="stickies"]:has([data-window-state="key"])',
      );
      return key?.getBoundingClientRect().height ?? 0;
    });
  const full = await noteBox();
  const windowMenu = async (item) => {
    await bar.getByRole("menuitem", { name: "Window", exact: true }).click();
    await page.waitForTimeout(300);
    await page
      .getByRole("menuitem", { name: new RegExp(`^${item}`) })
      .last()
      .click();
    await page.waitForTimeout(400);
  };
  await windowMenu("Collapse");
  const small = await noteBox();
  step(
    "Collapse leaves only the title bar in the way",
    small < 30 && full > 100,
    `${small} of ${full}`,
  );
  const edges = () =>
    page.evaluate(() => {
      const key = document.querySelector(
        '[data-window-id^="stickies"]:has([data-window-state="key"])',
      );
      return [...(key?.querySelectorAll(":scope > .mac-managed-window-resize") ?? [])].filter(
        (edge) => getComputedStyle(edge).display !== "none",
      ).length;
    });
  step("a collapsed note has no edge to resize by", (await edges()) === 0, String(await edges()));
  await page.keyboard.press("Control+f");
  const findField = page.getByRole("searchbox", { name: "Find" }).last();
  await findField.waitFor({ timeout: 3_000 });
  await page.waitForTimeout(300);
  step(
    "Find in a collapsed note opens it, the bar showing with the keyboard",
    (await noteBox()) === full &&
      (await findField.isVisible()) &&
      (await findField.evaluate((node) => node === document.activeElement)) &&
      (await edges()) > 0,
    `${await noteBox()} of ${full}`,
  );
  await page.keyboard.press("Escape");
  await windowMenu("Collapse");
  await page.waitForTimeout(700);
  await reloadDesktop(page);
  await launch(page, "Stickies");
  await notes.first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await windowMenu("Expand");
  step(
    "Expand after a reload brings its height back",
    (await noteBox()) === full,
    String(await noteBox()),
  );

  await choose("Import Text");
  const panel = page
    .getByRole("dialog", { name: "Open" })
    .or(page.locator(".mac-stickies-panel-layer"));
  await panel.first().waitFor();
  await shot(page, path.join(out, "stickies-import.png"));
  await page.locator(".mac-stickies-panel-layer").getByText(`${NAME}.txt`).first().click();
  await page
    .locator(".mac-stickies-panel-layer")
    .getByRole("button", { name: "Open", exact: true })
    .click();
  let after = await stored();
  for (let tries = 0; tries < 40 && after.length <= count; tries += 1) {
    await page.waitForTimeout(250);
    after = await stored();
  }
  step(
    "Import Text makes a new note of the file",
    after.length === count + 1 && after.filter((note) => note.text === TEXT).length === 2,
    String(after.length),
  );
  await shot(page, path.join(out, "stickies-imported.png"));
});
