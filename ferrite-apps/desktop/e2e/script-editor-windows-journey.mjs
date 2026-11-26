#!/usr/bin/env node
// Batch 2 of Script Editor's rows on the served desktop, with the real server and drive.
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("script-editor-batch2");
const stamp = Date.now().toString(36);

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "script-editor"])],
    rev: library.json?.rev ?? 0,
  });
  const resource = `res-${stamp}.txt`;
  const wrote = await api(page, "POST", "/api/script-editor/run", {
    code: `await Files.write({ path: "Documents/${resource}", text: "held" }); return "written";`,
    tz: 0,
  });
  step(
    "a file for the bundle is on the drive",
    wrote.json?.outcome === "completed",
    JSON.stringify(wrote.json?.result),
  );
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  const window = page.locator('[data-window-id="script-editor"]').first();
  const editor = window.getByRole("textbox", { name: "Script", exact: true });
  await editor.waitFor({ timeout: 10_000 });
  const bar = page.getByRole("menubar");
  const menu = async (title, ...rows) => {
    await bar.getByRole("menuitem", { name: title, exact: true }).click();
    await page.waitForTimeout(250);
    for (const row of rows) {
      await page
        .getByRole("menuitem", { name: new RegExp(`^${row}`) })
        .first()
        .click();
      await page.waitForTimeout(250);
    }
  };
  const replace = async (text) => {
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Delete");
    await page.keyboard.insertText(text);
    await page.waitForTimeout(150);
  };
  const resultView = () => window.getByRole("textbox", { name: "Result" });

  // AppleScript's tell block reaches Notes, through the real server.
  await window.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "AppleScript" }).click();
  await page.waitForTimeout(200);
  const title = `Told ${stamp}`;
  await replace(
    `tell application "Notes"\nmake new note with properties {name:"${title}", body:"From AppleScript"}\nset all_notes to every note\nend tell\nreturn all_notes`,
  );
  await window.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForFunction(
    (wanted) =>
      document
        .querySelector('[data-window-id="script-editor"] [aria-label="Result"]')
        ?.value?.includes(wanted),
    title,
    { timeout: 15_000 },
  );
  step(
    "a tell block makes a note, and every note reads it back",
    true,
    await resultView().inputValue(),
  );
  await shot(page, path.join(out, "script-editor-applescript-tell.png"));

  await replace('tell application "Notes"\nbeep\nend tell');
  await window.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForTimeout(400);
  const refused = await resultView().inputValue();
  step("an unknown statement is refused, naming it", refused.includes("carry out: beep"), refused);

  // Compile error's place.
  await window.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "JavaScript" }).click();
  await page.waitForTimeout(200);
  await replace("const a = 1;\nconst b = ;\nreturn a;");
  await window.getByRole("button", { name: "Compile", exact: true }).click();
  await page.waitForTimeout(300);
  const chosen = await page.evaluate(() => document.getSelection()?.toString());
  step(
    "Compile selects the line of a syntax error",
    chosen?.includes("const b = ;") === true,
    chosen,
  );

  // Complete.
  await replace("return Notes");
  await page.keyboard.press("Alt+Escape");
  const list = page.getByRole("listbox", { name: "Completions" });
  await list.waitFor({ timeout: 5000 });
  step(
    "Option-Escape lists the dictionary's calls",
    (await list.innerText()).includes("Notes.make"),
    await list.innerText(),
  );
  await shot(page, path.join(out, "script-editor-complete.png"));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  step(
    "Return takes the first",
    (await editor.innerText()).includes("return Notes."),
    await editor.innerText(),
  );

  // Paste Reply, after a run.
  await replace('return "reply text";');
  await window.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-window-id="script-editor"] [aria-label="Result"]')
        ?.value?.includes("reply text"),
    undefined,
    { timeout: 15_000 },
  );
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await menu("Edit", "Paste Reply");
  const pasted = await editor.innerText();
  step(
    "Paste Reply puts the result in the script",
    pasted.includes('"reply text";reply text'),
    pasted,
  );

  // Library and Dictionary windows.
  await menu("Window", "Library");
  const libraryWindow = page.locator('[data-window-id="script-editor:library"]');
  await libraryWindow.waitFor({ timeout: 8000 });
  await libraryWindow.getByText("Notes", { exact: true }).waitFor({ timeout: 8000 });
  await libraryWindow.getByText("Notes", { exact: true }).click();
  await page.keyboard.down("Shift");
  await libraryWindow.getByText("Reminders", { exact: true }).click();
  await page.keyboard.up("Shift");
  await shot(page, path.join(out, "script-editor-library.png"));
  await libraryWindow.getByText("Notes", { exact: true }).dblclick();
  const dictionaryWindow = page.locator('[data-window-id="script-editor:dictionary-notes"]');
  await dictionaryWindow.waitFor({ timeout: 8000 });
  await dictionaryWindow.getByText("Notes Suite").click();
  await dictionaryWindow.getByText("New Note").click();
  await dictionaryWindow
    .getByText("Notes.make({ title, text, folder })")
    .waitFor({ timeout: 5000 });
  step("the Dictionary shows the real action's call", true, "Notes.make({ title, text, folder })");
  await shot(page, path.join(out, "script-editor-dictionary.png"));

  // Log History, kept across a reload.
  await menu("Window", "Log History");
  const historyWindow = page.locator('[data-window-id="script-editor:history"]');
  await historyWindow.waitFor({ timeout: 8000 });
  await historyWindow.getByText("reply text").first().click();
  await shot(page, path.join(out, "script-editor-log-history.png"));
  step(
    "Log History shows a run's result",
    (await historyWindow.getByRole("textbox", { name: "Selected runs" }).inputValue()).includes(
      "reply text",
    ),
  );

  // Export as a script bundle: read back from the drive.
  await window.click({ position: { x: 200, y: 10 } });
  await bar.getByRole("menuitem", { name: "Window", exact: true }).click();
  await page.waitForTimeout(250);
  const named = await page.getByRole("menu").getByRole("menuitemcheckbox").allInnerTexts();
  step(
    "the Window menu names the script's window for the script",
    named.some((row) => /Untitled/.test(row)),
    named.join(" | "),
  );
  await page.keyboard.press("Escape");
  await replace('return "bundled";');
  await window.getByRole("button", { name: "Bundle contents" }).click();
  await window.getByRole("button", { name: "Add to Resources" }).click();
  const panel = page.locator(".mac-script-editor-panel-layer");
  await panel.getByText(resource).click({ timeout: 8000 });
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await window
    .getByRole("listbox", { name: "Resources" })
    .getByText(resource)
    .waitFor({ timeout: 5000 });
  step("a file of the drive goes in the bundle's Resources", true, resource);
  await menu("File", "Export");
  const sheet = page.getByRole("dialog", { name: /^Export/ });
  await sheet.waitFor({ timeout: 5000 });
  await sheet.getByRole("textbox", { name: "Export As:" }).fill(`Bundle ${stamp}`);
  await sheet.getByRole("combobox", { name: /File Format/ }).click();
  await page.getByRole("option", { name: /Script Bundle/ }).click();
  await shot(page, path.join(out, "script-editor-export-bundle.png"));
  await sheet.getByRole("button", { name: "Export" }).click();
  await sheet.waitFor({ state: "detached", timeout: 15_000 });
  const drive = (await api(page, "GET", "/api/files")).json;
  const names = (drive?.entries ?? []).map((entry) => entry.name);
  const copies = (drive?.entries ?? []).filter((entry) => entry.name === resource).length;
  step("the bundle holds a copy of the resource", copies === 2, String(copies));
  step(
    "the bundle's folder, Info.plist and main.js are on the drive",
    names.includes(`Bundle ${stamp}.scptd`) &&
      names.includes("Info.plist") &&
      names.includes("main.js"),
    names.filter((name) => /scptd|plist|main\.js/.test(name)).join(", "),
  );

  // Format.
  await menu("Format", "Text", "Show Ruler");
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "script-editor-ruler.png"));
  step(
    "Show Ruler shows the ruler over the script",
    (await window.locator(".mac-script-editor-ruler").count()) === 1,
  );

  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  await editor.waitFor({ timeout: 10_000 });
  await menu("Window", "Log History");
  await page
    .locator('[data-window-id="script-editor:history"]')
    .getByText("reply text")
    .first()
    .waitFor({ timeout: 8000 });
  step("Log History comes back after a reload", true);

  // Preferences.
  await page
    .locator('[data-window-id="script-editor:history"]')
    .click({ position: { x: 100, y: 10 } });
  await bar.getByRole("menuitem", { name: "Script Editor", exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  const preferences = page.locator(".mac-preferences-window").first();
  await preferences.waitFor({ timeout: 8000 });
  await preferences.getByRole("tab", { name: "Formatting" }).click();
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "script-editor-preferences-formatting.png"));
  step("Preferences has the Formatting pane", await preferences.getByText("Comments:").isVisible());
});
