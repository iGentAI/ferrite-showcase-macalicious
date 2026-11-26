#!/usr/bin/env node
// Richly styled text pasted with the keyboard into Notes is saved: a colour the module does not
// keep goes, the words and the rest stay. As a Guest User with data of its own. Exits 0 only when
// every step passed with no console error, page error or failed request, which a refused save is.
//
//   node e2e/notes-paste-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { api, journey, launch, openDesktop, options } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("notes-paste", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const WORD = `pasted${Date.now().toString(36)}`;
const HTML = `<span style="font-size: 18px; color: color(srgb 0.1 0.2 0.3); font-family: '日本'">${WORD}</span> <b style="color: rgb(1, 2, 3)">bold</b>`;

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: 10_000 });
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(250);
  await page.locator('[role="menu"]').getByRole("menuitem", { name: "New Note" }).first().click();
  await page.waitForTimeout(400);
  await page.keyboard.type("First line");
  await page.keyboard.press("Enter");
  await page.evaluate(async (html) => {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([html], { type: "text/plain" }),
      }),
    ]);
  }, HTML);
  await page.keyboard.press("ControlOrMeta+v");
  let saved;
  for (let i = 0; i < 40 && !saved; i++) {
    await page.waitForTimeout(250);
    const { data } = (await api(page, "GET", "/api/notes/data")).json;
    saved = data?.notes.find((note) => (note.html ?? note.lines?.join("\n") ?? "").includes(WORD));
  }
  step("the pasted words reach the server", saved !== undefined);
  const html = saved?.html ?? "";
  step(
    "the size and the plain colour stay",
    html.includes("18px") && html.includes("rgb(1, 2, 3)"),
    html,
  );
  step(
    "the colour and the font it does not keep go",
    !html.includes("color(") && !html.includes("日本"),
  );
});
