#!/usr/bin/env node
// Script Editor at depth: the File, Script and View menus and their keys, Save into the script's own
// file, Duplicate, Rename, Move To, the Open panel, Open Recent, a second window, and an unsaved
// script that survives a reload. Saved values are read back from the server. Exits 0 only when every
// step passed with no console error, page error or failed request.
//
//   ferrite dev                                                 # in ferrite-apps/desktop
//   node e2e/script-editor-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("script-editor-depth");
const stamp = String(Date.now()).slice(-7);
const NAME = `Depth ${stamp}`;
const RENAMED = `Renamed ${stamp}`;
const picture = (name) => path.join(out, `script-editor-${name}.png`);

const menuBar = (page, title) =>
  page.getByRole("menubar").first().getByRole("menuitem", { name: title, exact: true });
const entry = (page, item) =>
  page
    .getByRole("menu")
    .getByRole("menuitem", { name: item })
    .or(page.getByRole("menu").getByRole("menuitemradio", { name: item }))
    .first();
async function choose(page, title, item) {
  await menuBar(page, title).click();
  await entry(page, item).waitFor({ timeout: 5000 });
  await entry(page, item).click();
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'), undefined, {
    timeout: 5000,
  });
  await page.waitForTimeout(200);
}
async function pictureOfMenu(page, title, name) {
  await menuBar(page, title).click();
  await page.getByRole("menu").first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(200);
  await shot(page, picture(name));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

const read = (locator) => locator.inputValue();
const stored = async (page, key) => {
  const answer = await api(page, "GET", "/api/system-preferences/settings");
  return answer.json.values?.[key];
};
async function until(page, test, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const value = await test();
    if (value) return value;
    await page.waitForTimeout(250);
  }
  return test();
}
const savedScripts = async (page) =>
  (await api(page, "GET", "/api/script-editor/scripts")).json.scripts ?? [];
const codeOf = async (page, id) =>
  (await api(page, "GET", `/api/script-editor/scripts/${id}`)).json.code;
const driveEntry = async (page, id) =>
  (await api(page, "GET", "/api/files/")).json.entries?.find((each) => each.id === id);

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = await api(page, "GET", "/api/app-store/library");
  const got = await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "script-editor"])],
    rev: library.json?.rev ?? 0,
  });
  step("Script Editor is got from the App Store", got.status === 200, `HTTP ${got.status}`);
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  const window = page.locator('[data-window-id="script-editor"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const script = window.getByRole("textbox", { name: "Script" });
  const result = window.getByRole("textbox", { name: "Result" });
  const log = window.getByRole("textbox", { name: "Log" });
  const titleIs = (name) =>
    until(
      page,
      async () => (await window.locator(".mac-title-bar-title-text").innerText()) === name,
    );

  // Script: Run, Compile, Record, Stop.
  await script.click();
  await script.fill("return 1 + 2;");
  await pictureOfMenu(page, "Script", "menu-script");
  await choose(page, "Script", /^Run/);
  step(
    "Script > Run runs the script on the server and shows its Result",
    await until(page, async () => (await read(result)) === "3"),
    await read(result),
  );
  await script.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("return 40 + 2;");
  await page.keyboard.press("ControlOrMeta+r");
  step(
    "Command-R runs what was typed",
    await until(page, async () => (await read(result)) === "42"),
    await read(result),
  );
  await script.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("ControlOrMeta+k");
  await page.waitForTimeout(300);
  step(
    "Command-K compiles and says what Compile checks",
    (await read(result)) === "Compiled: this JavaScript script has no syntax errors.",
  );
  await page.keyboard.type(" // kept");
  step(
    "after a compilation the keyboard is still where it was in the script",
    (await script.innerText()).trim() === "return 40 + 2; // kept",
    await script.innerText(),
  );
  await page.keyboard.press("ControlOrMeta+Shift+r");
  step(
    "Shift-Command-R starts a recording",
    (await window
      .getByRole("button", { name: "Stop", exact: true })
      .getAttribute("aria-disabled")) === "false",
  );
  await page.keyboard.press("ControlOrMeta+.");
  await page.keyboard.press("ControlOrMeta+3");
  step(
    "Command-. stops it, and Command-3 shows it in the Log",
    (await read(log)).endsWith("(*Recording stopped.*)"),
    (await read(log)).split("\n").at(-1),
  );
  await shot(page, picture("script-keys"));

  // View.
  await pictureOfMenu(page, "View", "menu-view");
  await choose(page, "View", /^Show Bundle Contents/);
  step(
    "View > Show Bundle Contents shows the pane",
    await window.getByRole("textbox", { name: "Identifier:" }).isVisible(),
  );
  await shot(page, picture("view-bundle"));
  await page.keyboard.press("ControlOrMeta+0");
  step(
    "Command-0 hides it",
    (await window.getByRole("textbox", { name: "Identifier:" }).count()) === 0,
  );
  await page.keyboard.press("ControlOrMeta+Alt+0");
  step("Option-Command-0 hides the accessory view", (await log.count()) === 0);
  await choose(page, "View", /^Description/);
  step(
    "View > Description shows that view again",
    await window.getByRole("textbox", { name: "Description" }).isVisible(),
  );
  await page.keyboard.press("ControlOrMeta+2");
  step("Command-2 shows the Result", await result.isVisible());

  // File > Save asks for a name once, then writes into the script's file.
  await pictureOfMenu(page, "File", "menu-file");
  await choose(page, "File", /^Save/);
  const saveSheet = page.getByRole("dialog", { name: "Save Script" });
  await saveSheet.getByRole("textbox", { name: "Save As:" }).fill(NAME);
  await saveSheet.getByRole("button", { name: "Save", exact: true }).click();
  await titleIs(NAME);
  const first = await until(page, async () =>
    (await savedScripts(page)).find((each) => each.name === `${NAME}.js`),
  );
  step(
    "File > Save without a file asks for a name, and saves it on the drive",
    first !== undefined && (await codeOf(page, first.id)) === "return 40 + 2; // kept",
  );
  await script.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" second");
  await page.keyboard.press("ControlOrMeta+s");
  step(
    "Command-S writes into the same file without asking",
    (await until(page, async () => (await codeOf(page, first.id)).endsWith("second"))) &&
      (await saveSheet.count()) === 0 &&
      (await savedScripts(page)).filter((each) => each.name.startsWith(NAME)).length === 1,
  );

  // An unsaved script survives a reload, with its file.
  await script.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" unsaved");
  const draft = await until(page, async () => {
    const value = await stored(page, "scriptEditor.draft");
    return value?.code?.endsWith("unsaved") ? value : null;
  });
  step(
    "the unsaved script is kept on the server",
    draft?.file?.id === first.id,
    draft?.title ?? "",
  );
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await until(page, async () => (await script.innerText()).trim().endsWith("unsaved"));
  step(
    "after a reload the window holds the unsaved script, under its name",
    (await script.innerText()).trim() === "return 40 + 2; // kept second unsaved" &&
      (await titleIs(NAME)) === true,
    await script.innerText(),
  );
  await shot(page, picture("draft-after-reload"));
  step(
    "the file itself still holds what was last saved",
    (await codeOf(page, first.id)) === "return 40 + 2; // kept second",
  );
  await script.click();
  await page.keyboard.press("ControlOrMeta+s");
  await until(page, async () => (await codeOf(page, first.id)).endsWith("unsaved"));
  step(
    "Command-S after the reload writes into that file, and the draft is gone from the server",
    (await codeOf(page, first.id)) === "return 40 + 2; // kept second unsaved" &&
      (await until(page, async () => (await stored(page, "scriptEditor.draft")) === null)),
  );

  // Rename and Move To, read back from the drive.
  await choose(page, "File", /^Rename/);
  const renameSheet = page.getByRole("dialog", { name: "Rename Script" });
  await renameSheet.getByRole("textbox", { name: "Name:" }).fill(RENAMED);
  await shot(page, picture("rename"));
  await renameSheet.getByRole("button", { name: "Rename", exact: true }).click();
  await titleIs(RENAMED);
  const renamed = await until(page, async () => {
    const found = await driveEntry(page, first.id);
    return found?.name === `${RENAMED}.js` ? found : null;
  });
  step("File > Rename renames the file on the drive", renamed !== null && renamed !== undefined);

  await choose(page, "File", /^Move To/);
  const moveSheet = page.getByRole("dialog", { name: `Move “${RENAMED}”` });
  const where = moveSheet.getByRole("combobox", { name: "Where:" });
  await until(page, async () => (await where.innerText()) === "Documents/Scripts");
  await where.click();
  await page.getByRole("option", { name: "Documents", exact: true }).click();
  await page.waitForTimeout(200);
  await shot(page, picture("move-to"));
  await moveSheet.getByRole("button", { name: "Move", exact: true }).click();
  const moved = await until(page, async () => {
    const found = await driveEntry(page, first.id);
    return found?.parent === "documents" ? found : null;
  });
  step("File > Move To moves the file on the drive", Boolean(moved), moved?.parent);

  await script.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" moved");
  await page.keyboard.press("ControlOrMeta+s");
  step(
    "Command-S writes into the moved file, and leaves no second one in Scripts",
    (await until(page, async () => (await codeOf(page, first.id)).endsWith("moved"))) &&
      !(await savedScripts(page)).some((each) => each.name.startsWith(RENAMED)),
  );

  // Duplicate.
  await script.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" more");
  await page.keyboard.press("ControlOrMeta+Shift+s");
  step(
    "Shift-Command-S writes the changes, and an unsaved copy takes the window",
    (await titleIs(`${RENAMED} copy`)) === true &&
      (await codeOf(page, first.id)).endsWith("moved more") &&
      (await script.innerText()).trim().endsWith("moved more"),
  );
  await shot(page, picture("duplicate"));

  // Open Recent, over the copy's unsaved changes.
  await menuBar(page, "File").click();
  await entry(page, "Open Recent").hover();
  const recent = page.getByRole("menuitem", { name: `${RENAMED}.js` });
  await recent.waitFor({ timeout: 5000 });
  await shot(page, picture("open-recent"));
  await recent.click();
  const discard = page.getByRole("dialog", { name: new RegExp(`${RENAMED} copy`) });
  await discard.getByRole("button", { name: "Don’t Save" }).click();
  step(
    "File > Open Recent opens the script again, after asking about the changes",
    (await titleIs(RENAMED)) === true &&
      (await until(page, async () => (await script.innerText()).trim().endsWith("moved more"))),
  );
  step(
    "the Don’t Save leaves no draft on the server",
    await until(page, async () => (await stored(page, "scriptEditor.draft")) === null),
  );

  // The Open panel.
  const seed = await api(page, "POST", "/api/script-editor/scripts", {
    name: `Panel ${stamp}`,
    code: "return 'panel';",
  });
  step("a script is saved in Documents/Scripts for the panel", seed.status === 201);
  await page.keyboard.press("ControlOrMeta+o");
  const panel = page.locator(".mac-script-editor-panel-layer");
  const row = panel.getByText(`Panel ${stamp}.js`, { exact: true }).first();
  await row.waitFor({ timeout: 10_000 });
  step("Command-O opens the panel on Documents/Scripts", await row.isVisible());
  await shot(page, picture("open-panel"));
  await row.dblclick();
  step(
    "choosing a script in the panel opens it",
    (await titleIs(`Panel ${stamp}`)) === true &&
      (await until(page, async () => (await script.innerText()).trim() === "return 'panel';")) &&
      (await panel.count()) === 0,
  );

  // A second window, with a script and a draft of its own.
  await choose(page, "File", /^New/);
  const second = page.locator('[data-window-id="script-editor:2"]').first();
  await second.waitFor({ state: "visible", timeout: 10_000 });
  const secondScript = second.getByRole("textbox", { name: "Script" });
  await secondScript.click();
  await secondScript.fill(`return 'second ${stamp}';`);
  await shot(page, picture("two-windows"));
  step(
    "File > New opens another window, and the first keeps its script",
    (await script.innerText()).trim() === "return 'panel';",
  );
  step(
    "the second window's unsaved script is kept under its own value",
    await until(page, async () =>
      (await stored(page, "scriptEditor.draft2"))?.code?.includes(`second ${stamp}`),
    ),
  );
  await reloadDesktop(page);
  await launch(page, "Script Editor");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await second.waitFor({ state: "visible", timeout: 10_000 });
  step(
    "after a reload, the second window is back with its script",
    await until(page, async () => (await secondScript.innerText()).includes(`second ${stamp}`)),
  );

  await menuBar(page, "Window").click();
  await page.getByRole("menu").first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(200);
  const listed = page
    .getByRole("menu")
    .first()
    .getByText(/script|Untitled/i);
  step("the Window menu lists both windows, by their scripts", (await listed.count()) >= 2);
  await shot(page, picture("window-list"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await page.keyboard.press("ControlOrMeta+n");
  const third = page.locator('[data-window-id="script-editor:3"]').first();
  await third.waitFor({ state: "visible", timeout: 10_000 });
  step("Command-N opens another window", await third.isVisible());

  // A script too long to keep says so.
  const thirdScript = third.getByRole("textbox", { name: "Script" });
  await thirdScript.click();
  await thirdScript.fill(`// ${"x".repeat(100_000)}`);
  const banner = third.getByRole("status");
  await banner.waitFor({ timeout: 5000 });
  step(
    "a script too long to keep across a reload says so",
    (await banner.innerText()).startsWith("This script is too long"),
  );
  await shot(page, picture("too-long"));
});
