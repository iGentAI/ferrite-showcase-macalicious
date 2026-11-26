#!/usr/bin/env node
// Terminal's grep -r and several -e, a line taller than the screen, narrowing with a cursor high and on
// the alternate screen, and ps's titles; TextEdit's table changes on the Undo stack, Column Width and
// Data Detectors; the Script menu from Script Editor's Preferences. Settings and table widths are read
// back from the server and across a reload. It removes the folder, file and setting it makes.
//
//   node e2e/text-tools-batch7-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("text-tools-batch7");
const SETTINGS = "/api/system-preferences/settings";
const stamp = Date.now().toString(36);
const FOLDER = `Batch7${stamp}`;
const SCRIPT = `Answer${stamp}`;

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  const stored = async (key, wanted) => {
    for (let at = 0; at < 40; at += 1) {
      const { values } = (await api(page, "GET", SETTINGS)).json;
      if (values?.[key] === wanted) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  const menu = async (top, ...rest) => {
    await page.getByRole("menubar").getByRole("menuitem", { name: top, exact: true }).click();
    for (const name of rest.slice(0, -1)) {
      await page.getByRole("menuitem", { name, exact: true }).last().hover();
    }
    await page
      .getByRole("menuitem", { name: rest.at(-1), exact: true })
      .last()
      .click();
    await page.waitForTimeout(300);
  };

  await openDesktop(page, base, step);
  // A run on one account starts as the first did.
  const { json: first } = await api(page, "GET", SETTINGS);
  await api(page, "PUT", SETTINGS, {
    values: { ...first.values, "textedit.dataDetectors": false, "scriptEditor.scriptMenu": false },
    rev: first.rev,
  });
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "script-editor"])],
    rev: library.json?.rev ?? 0,
  });
  await reloadDesktop(page);

  // Terminal.
  await launch(page, "Terminal");
  const log = page.getByRole("log", { name: "Terminal output" }).first();
  await log.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  const screen = () => log.innerText();
  const type = async (line) => {
    await page.keyboard.type(line);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        /%\s*$/.test(
          document.querySelector('[role="log"][aria-label="Terminal output"]')?.innerText ?? "",
        ),
      undefined,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(200);
  };
  await type(`cd Documents; mkdir -p Scripts ${FOLDER}/deep; clear`);
  await type(`echo pear 1 > ${FOLDER}/one.txt; echo pear 2 > ${FOLDER}/deep/two.txt; clear`);
  await type(`grep -r pear ${FOLDER}`);
  const found = await screen();
  step(
    "grep -r finds the files under a folder on the real drive and names each",
    found.includes(`${FOLDER}/deep/two.txt:pear 2`) && found.includes(`${FOLDER}/one.txt:pear 1`),
    found.slice(-200),
  );
  await type(`echo plum > ${FOLDER}/three.txt; clear`);
  await type(`cat ${FOLDER}/three.txt ${FOLDER}/one.txt | grep -c -e plum -e pear`);
  step("several -e match a line by any of them", /\n2\s/.test(await screen()), await screen());

  await type("clear");
  const wide = `echo START${"abcdefghij".repeat(240)}END`;
  await page.keyboard.type(wide, { delay: 0 });
  await page.waitForTimeout(400);
  const atEnd = await screen();
  step(
    "a line taller than the screen shows its end, its start out of sight",
    atEnd.includes("END") && !atEnd.includes("START"),
  );
  await page.keyboard.press("Control+a");
  await page.waitForTimeout(300);
  const atStart = await screen();
  step(
    "going to its start draws its start, with the prompt",
    /%\s+echo STARTabc/.test(atStart) && !atStart.includes("END"),
    atStart.slice(0, 120),
  );
  for (let at = 0; at < 5; at += 1) await page.keyboard.press("ArrowRight");
  await page.keyboard.type("QQ");
  await page.waitForTimeout(300);
  step(
    "an edit there lands in its place and draws over itself",
    /echo QQSTARTabc/.test((await screen()).replace(/\s/g, " ")) &&
      (await screen()).split("QQSTART").length === 2,
    (await screen()).slice(0, 120),
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  const entered = await screen();
  step(
    "entering it runs the line as edited",
    entered.includes("END") && /%\s*$/.test(entered),
    entered.slice(-60),
  );

  await type("clear");
  await type(`echo ${"wrapme".repeat(14)}`);
  await page.keyboard.type(`less ${FOLDER}/one.txt`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  const terminalWindow = page.locator('[data-window-id^="terminal"]').first();
  const box = await terminalWindow.boundingBox();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 250, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const narrowed = (await terminalWindow.boundingBox()).width < box.width - 100;
  step("the window narrows with a full-screen program up", narrowed);
  await page.keyboard.press("q");
  await page.waitForTimeout(500);
  const widest = await log.evaluate((node) =>
    Math.max(...node.innerText.split("\n").map((line) => line.length)),
  );
  const back = await screen();
  step(
    "coming back from it the shell's text is wrapped to the new width, all of it",
    back.replace(/\s/g, "").includes("wrapme".repeat(14)) && widest < 84,
    `widest ${widest}`,
  );

  await launch(page, "TextEdit");
  await page.locator('[data-window-id^="textedit"]').first().waitFor();
  await launch(page, "Terminal");
  await page.waitForTimeout(400);
  const editorTitle = (
    await page.locator('[data-window-id^="textedit"] .mac-title-bar-title').first().innerText()
  )
    .split("\n")[0]
    .trim();
  await type("clear; ps");
  const listed = (await screen()).replace(/\s+/g, " ");
  step(
    "ps gives TextEdit's window the title its bar shows",
    editorTitle !== "" && listed.includes(`textedit ${editorTitle}`),
    `${editorTitle}: ${listed.slice(0, 200)}`,
  );

  // TextEdit.
  await launch(page, "TextEdit");
  await page.waitForTimeout(300);
  const editor = page.locator('[data-window-id^="textedit"]').first();
  const text = editor.getByRole("textbox", { name: "Document" });
  await text.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  const openSheet = async () => {
    await menu("Format", "Table…");
    const sheet = page.getByRole("dialog", { name: "Table" });
    await sheet.waitFor();
    return sheet;
  };
  const tables = () => text.locator("table").count();
  const before = await tables();
  let sheet = await openSheet();
  await sheet.getByLabel("Rows:").fill("2");
  await sheet.getByLabel("Columns:").fill("2");
  await sheet.getByLabel("Column Width:").fill("150");
  await shot(page, path.join(out, "textedit-table-width-sheet.png"));
  await sheet.getByRole("button", { name: "OK" }).click();
  await sheet.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  const table = text.locator("table").last();
  const cellWidths = () =>
    table.evaluate((node) =>
      [...node.rows[0].cells].map((cell) => Math.round(cell.getBoundingClientRect().width)),
    );
  const zoom = await table.evaluate(
    (node) => node.getBoundingClientRect().width / node.offsetWidth || 1,
  );
  const widths = await cellWidths();
  step(
    "Column Width sets the columns of a new table, as drawn",
    (await tables()) === before + 1 && widths.every((width) => Math.abs(width / zoom - 150) <= 2),
    widths.join(),
  );
  await menu("Edit", "Undo");
  step("Undo takes the new table away", (await tables()) === before);
  await menu("Edit", "Redo");
  step("Redo brings it back", (await tables()) === before + 1);

  await text.locator("td").last().click();
  sheet = await openSheet();
  await sheet.getByLabel("Column Width:").fill("220");
  await sheet.getByLabel("Rows:").fill("3");
  await sheet.getByRole("button", { name: "OK" }).click();
  await sheet.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  const shape = () =>
    table.evaluate((node) => ({
      rows: node.rows.length,
      widths: [...node.querySelectorAll("col")].map((col) => col.getAttribute("width")),
    }));
  const grown = JSON.stringify({ rows: 3, widths: ["150", "220"] });
  step(
    "the sheet changes the column of the selected cell and the rows",
    JSON.stringify(await shape()) === grown,
    JSON.stringify(await shape()),
  );
  await menu("Edit", "Undo");
  step(
    "Undo takes that change back as one step",
    JSON.stringify(await shape()) === JSON.stringify({ rows: 2, widths: ["150", "150"] }),
    JSON.stringify(await shape()),
  );
  await menu("Edit", "Redo");
  step("Redo does it again", JSON.stringify(await shape()) === grown);
  await page.waitForTimeout(1_800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  step(
    "the widths are there after a reload",
    JSON.stringify(await shape()) === grown,
    JSON.stringify(await shape()),
  );

  // Data Detectors.
  await text.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Ring 415-555-0134 or come to 1 Infinite Loop Way tomorrow at 5pm");
  const commands = page.getByRole("menu", { name: "Text commands" });
  const clickOn = async (words) => {
    const at = await text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let each = walker.nextNode(); each; each = walker.nextNode()) {
        const start = each.data.indexOf(wanted);
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(each, start + 2);
        range.setEnd(each, start + 3);
        const { x, y, height } = range.getBoundingClientRect();
        return { x: x + 1, y: y + height / 2 };
      }
      return null;
    }, words);
    await page.mouse.click(at.x, at.y, { button: "right" });
    await commands.waitFor();
  };
  const closeCommands = async () => {
    await page.keyboard.press("Escape");
    await commands.waitFor({ state: "detached" });
  };
  const row = (name) => page.getByRole("menuitem", { name, exact: true });
  await clickOn("415-555-0134");
  step(
    "Data Detectors starts off, with no action in the menu",
    (await row("Copy “415-555-0134”").count()) === 0,
  );
  await closeCommands();
  const toggleDetectors = async () => {
    await page.getByRole("menubar").getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.getByRole("menuitem", { name: "Substitutions", exact: true }).last().hover();
    await page.getByRole("menuitemcheckbox", { name: "Data Detectors" }).last().click();
    await page.waitForTimeout(300);
  };
  await toggleDetectors();
  step("Data Detectors is kept on the server", await stored("textedit.dataDetectors", true));
  await clickOn("415-555-0134");
  step(
    "a phone number offers Copy, and says why it cannot call",
    (await row("Copy “415-555-0134”").count()) === 1 &&
      (await row("Call with FaceTime").getAttribute("aria-disabled")) === "true",
  );
  await shot(page, path.join(out, "textedit-data-detectors.png"));
  await closeCommands();
  await clickOn("tomorrow at 5pm");
  step(
    "a date offers Create Event",
    (await row("Create Event").count()) === 1,
    (await commands.getByRole("menuitem").allInnerTexts()).slice(0, 4).join("|"),
  );
  await closeCommands();
  await clickOn("1 Infinite Loop Way");
  await row("Show in Maps").click();
  const maps = page.locator('[data-window-id^="maps"]').first();
  await maps.waitFor({ timeout: 10_000 });
  step("an address's Show in Maps opens Maps", await maps.isVisible());
  await launch(page, "TextEdit");
  await page.waitForTimeout(300);
  await toggleDetectors();
  step("Data Detectors goes off again", await stored("textedit.dataDetectors", false));

  // The Script menu.
  await launch(page, "Terminal");
  await page.waitForTimeout(400);
  await type(`cd ~/Documents; echo 'return 40 + 2' > Scripts/${SCRIPT}.js; clear`);
  await launch(page, "Script Editor");
  await page.locator('[data-window-id^="script-editor"]').first().waitFor();
  const extra = page.locator('[aria-label="Script Menu"]').first();
  step("the Script menu is not in the bar until asked for", (await extra.count()) === 0);
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Script Editor", exact: true })
    .click();
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  const preferences = page.locator(".mac-preferences-window").first();
  await preferences.waitFor({ timeout: 8_000 });
  await preferences.getByText("General", { exact: true }).click();
  await preferences.getByRole("checkbox", { name: "Show Script menu in menu bar" }).click();
  step("the preference is kept on the server", await stored("scriptEditor.scriptMenu", true));
  await extra.waitFor({ timeout: 5_000 });
  await reloadDesktop(page);
  await extra.waitFor({ timeout: 10_000 });
  step("the Script menu is in the bar after a reload", await extra.isVisible());
  await extra.click();
  await row(SCRIPT).waitFor();
  await shot(page, path.join(out, "script-menu.png"));
  const ran = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/script-editor/run",
  );
  await row(SCRIPT).click();
  const answer = await (await ran).json();
  step(
    "choosing a script runs it on the server",
    /42/.test(JSON.stringify(answer)),
    JSON.stringify(answer),
  );
  await page.waitForTimeout(300);
  await extra.click();
  await row(`“${SCRIPT}”: 42`).waitFor({ timeout: 5_000 });
  step("the menu says what the last script gave", true);
  await row("Open Script Editor").click();
  await page.locator('[data-window-id^="script-editor"]').first().waitFor();
  step("Open Script Editor opens it", true);

  // Leave the account as it was.
  await launch(page, "Terminal");
  await log.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await type(`cd ~/Documents; rm -r ${FOLDER}; rm Scripts/${SCRIPT}.js; clear`);
  await launch(page, "Script Editor");
  await page.waitForTimeout(300);
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Script Editor", exact: true })
    .click();
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  await preferences.waitFor({ timeout: 8_000 });
  await preferences.getByText("General", { exact: true }).click();
  await preferences.getByRole("checkbox", { name: "Show Script menu in menu bar" }).click();
  step("turned off, the setting is kept", await stored("scriptEditor.scriptMenu", false));
  await extra.waitFor({ state: "detached", timeout: 5_000 });
  step("and the Script menu leaves the bar", true);
});
