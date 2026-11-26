#!/usr/bin/env node
// Script Editor on Ferrite: under `ferrite dev`, sign in as a Guest User, get
// Script Editor from the App Store's library, write a JavaScript script that
// makes a note through the desktop's actions and opens Notes, run it on the
// server, read its Result and Log, find the note on the server and in Notes,
// save the script to the drive and find it under Open, and see a script that
// reaches for the network refused.
//
//   ferrite dev                       # in ferrite-apps/desktop
//   node e2e/script-editor-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output] [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { out, base, browserName } = options();
const { step, run } = journey("script-editor");
const tag = `${browserName}-${Date.now().toString(36)}`;

/** Get apps from the App Store for this person (its own library route). */
async function getApps(page, ids) {
  const library = await api(page, "GET", "/api/app-store/library");
  const installed = [...new Set([...(library.json.installed ?? []), ...ids])];
  return api(page, "PUT", "/api/app-store/library", { installed, rev: library.json.rev });
}

/** Put `code` in the script view, replacing what is there. */
async function write(window, code) {
  const script = window.getByRole("textbox", { name: "Script" });
  await script.click();
  await script.fill(code);
}

/** Press Run and resolve with the server's answer. */
async function runScript(page, window) {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/script-editor/run",
    { timeout: 30_000 },
  );
  await window.getByRole("button", { name: "Run", exact: true }).click();
  const response = await answered;
  return { status: response.status(), body: await response.json() };
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const got = await getApps(page, ["script-editor", "automator"]);
  step("Script Editor is got from the App Store", got.status === 200, `HTTP ${got.status}`);
  await reloadDesktop(page);

  await launch(page, "Script Editor");
  // The window's name follows its script's title, so it is found by its id.
  const window = page.locator('[data-window-id="script-editor"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  step(
    "Script Editor opens from the Dock on a JavaScript script",
    (await page.getByRole("region", { name: "Untitled" }).count()) > 0,
  );

  const title = `From Script Editor ${tag}`;
  await write(
    window,
    [
      `const made = Notes.make({ title: "${title}", text: "written by a script" });`,
      'console.log("made", made.length);',
      'Desktop.open("Notes");',
      "return made[0].title;",
    ].join("\n"),
  );
  const ran = await runScript(page, window);
  step(
    "the script runs on the server and completes",
    ran.status === 200 && ran.body.outcome === "completed",
    `${ran.status} ${ran.body.outcome} ${ran.body.error ?? ""}`,
  );
  const result = window.getByRole("textbox", { name: "Result" });
  await result.waitFor({ timeout: 10_000 });
  step(
    "the Result view shows what it returned",
    ((await result.inputValue().catch(() => null)) ?? (await result.textContent()) ?? "").includes(
      title,
    ),
  );

  const notes = page.getByRole("region", { name: "Notes" }).first();
  await notes.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  step("Desktop.open opens Notes when the run ends", await notes.isVisible());
  const stored = await api(page, "GET", "/api/notes/data");
  const lines = (stored.json.data?.notes ?? []).flatMap((note) => note.lines ?? []);
  step("the note the script made is in the person's Notes", lines.includes(title));
  await shot(page, path.join(out, `script-editor-${browserName}.png`));
  // Notes came to the front: close it to go on in Script Editor.
  await notes.getByRole("button", { name: "Close", exact: true }).first().click();
  await notes.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});

  await window.getByRole("button", { name: "Log", exact: true }).click();
  const log = window.getByRole("textbox", { name: "Log" });
  const logText = (await log.inputValue().catch(() => null)) ?? (await log.textContent()) ?? "";
  step(
    "the Log view shows its console output and its app calls",
    logText.includes("made 1") && logText.includes("notes.make"),
    logText.split("\n").slice(0, 3).join(" | "),
  );

  // Save the script to the drive, then find it under Open.
  await window.getByRole("button", { name: "Save Script" }).click();
  const sheet = page.getByRole("dialog", { name: "Save Script" });
  await sheet.waitFor({ timeout: 10_000 });
  const name = `Journey ${tag}`;
  await sheet.getByRole("textbox", { name: "Save As:" }).fill(name);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/script-editor/scripts",
    { timeout: 15_000 },
  );
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  const savedResponse = await saved;
  const savedBody = await savedResponse.json();
  step(
    "Save stores the script as a file in Documents/Scripts",
    savedResponse.status() === 201 && savedBody.path === `Documents/Scripts/${name}.js`,
    `${savedResponse.status()} ${savedBody.path}`,
  );
  const drive = await api(page, "GET", "/api/files/");
  step(
    "the drive lists the saved script",
    (drive.json.entries ?? []).some((entry) => entry.name === `${name}.js`),
  );
  await window.getByRole("button", { name: "Open Script" }).click();
  const item = page.getByRole("menuitem", { name }).first();
  await item.waitFor({ timeout: 10_000 }).catch(() => {});
  step("Open lists the saved script", await item.isVisible());
  await page.keyboard.press("Escape");

  // A script cannot reach the network.
  await write(window, 'return fetch("https://example.com/");');
  const refused = await runScript(page, window);
  step(
    "a script that reaches for the network is refused",
    refused.body.outcome === "threw" && /network/i.test(refused.body.error ?? ""),
    refused.body.error,
  );
});
