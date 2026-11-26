#!/usr/bin/env node
// TextEdit's Format > Table…: a table made, typed in with Tab, given a background and a merged cell,
// and the same after a reload.
//
//   node e2e/textedit-table-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-table");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await text.click();
  const openSheet = async () => {
    await page.getByRole("menubar").getByRole("menuitem", { name: "Format", exact: true }).click();
    await page.waitForTimeout(300);
    await page
      .getByRole("menuitem", { name: /^Table/ })
      .last()
      .click();
    const sheet = page.getByRole("dialog", { name: "Table" });
    await sheet.waitFor();
    return sheet;
  };
  const sheet = await openSheet();
  await sheet.getByLabel("Rows:").fill("2");
  await sheet.getByLabel("Columns:").fill("3");
  await sheet.getByLabel("Cell Background:").click();
  await page.getByRole("option", { name: "Green" }).click();
  await shot(page, path.join(out, "textedit-table-sheet.png"));
  await sheet.getByRole("button", { name: "OK" }).click();
  await sheet.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  const table = text.locator("table");
  const rows = () =>
    table.evaluate((node) =>
      [...node.rows].map((row) => [...row.cells].map((cell) => cell.innerText.trim())),
    );
  step("OK makes a table of that shape", (await table.locator("tr").count()) === 2);
  step(
    "a new table takes the background chosen",
    (await table
      .locator("td")
      .last()
      .evaluate((cell) => getComputedStyle(cell).backgroundColor)) === "rgb(125, 255, 120)",
  );
  await page.keyboard.type("one");
  await page.keyboard.press("Tab");
  await page.keyboard.type("two");
  await page.keyboard.press("Tab");
  await page.keyboard.type("three");
  await page.keyboard.press("Tab");
  await page.keyboard.type("four");
  step(
    "Tab goes from cell to cell",
    JSON.stringify((await rows())[0]) === '["one","two","three"]' &&
      (await rows())[1][0] === "four",
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  step("Tab after the last cell adds a row", (await table.locator("tr").count()) === 3);

  // With the keyboard on a control, Tab goes on through the controls, the selection in a cell or not.
  await text.evaluate((node) =>
    node.closest('[data-window-id^="textedit"]').querySelector("button:not([disabled])").focus(),
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  step(
    "Tab on a control leaves the table alone",
    (await table.locator("tr").count()) === 3 &&
      (await text.evaluate((node) => !node.contains(document.activeElement))),
  );

  // Select the first row's first two cells by dragging across them with the mouse.
  const fromCell = await table.locator("td").nth(0).boundingBox();
  const toCell = await table.locator("td").nth(1).boundingBox();
  await page.mouse.move(fromCell.x + 4, fromCell.y + fromCell.height / 2);
  await page.mouse.down();
  await page.mouse.move(toCell.x + toCell.width / 2, toCell.y + toCell.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const again = await openSheet();
  await again.getByLabel("Cell Background:").click();
  await page.getByRole("option", { name: "Yellow" }).click();
  await again.getByRole("button", { name: "OK" }).click();
  await again.waitFor({ state: "detached" });
  const shade = await table
    .locator("td")
    .first()
    .evaluate((cell) => getComputedStyle(cell).backgroundColor);
  step("a cell takes its background", shade === "rgb(255, 234, 0)");
  await shot(page, path.join(out, "textedit-table.png"));

  const merging = await openSheet();
  await merging.getByRole("button", { name: "Merge Cells" }).click();
  await merging.waitFor({ state: "detached" });
  step("Merge Cells makes one of them", (await rows())[0].length === 2);

  // A table in a cell has its own border, whichever of the two is heavier.
  const outerTable = table.first();
  const borders = () =>
    outerTable.evaluate((node) => {
      const width = (element) => getComputedStyle(element).borderTopWidth;
      const inner = node.querySelector("table").querySelector("td");
      return [width(node.rows[1].cells[0]), width(inner), width(node.tHead.rows[0].cells[0])];
    });
  await outerTable.evaluate((node) => {
    node.dataset.border = "3";
    const inner = node.ownerDocument.createElement("table");
    inner.dataset.border = "0";
    inner.innerHTML = "<tbody><tr><td><div>in</div></td></tr></tbody>";
    node.rows[1].cells[1].append(inner);
    node.createTHead().insertRow().insertCell();
  });
  const heavyOutside = await borders();
  await outerTable.evaluate((node) => {
    node.dataset.border = "0";
    node.querySelector("table").dataset.border = "3";
  });
  const heavyInside = await borders();
  await outerTable.evaluate((node) => {
    node.dataset.border = "1";
    node.deleteTHead();
    node.querySelector("table").remove();
  });
  step(
    "a table in a cell has its own border",
    JSON.stringify(heavyOutside) === '["3px","0px","3px"]' &&
      JSON.stringify(heavyInside) === '["0px","3px","0px"]',
    JSON.stringify([heavyOutside, heavyInside]),
  );

  // A colour the sheet has no name for, and two different ones, stay when only the border changes.
  await table.locator("td").first().click();
  await page.evaluate(() => {
    const row = document.querySelector('[data-window-id^="textedit"] table').rows[2];
    row.cells[0].style.backgroundColor = "rgb(1, 2, 3)";
    row.cells[1].style.backgroundColor = "rgb(4, 5, 6)";
    const range = document.createRange();
    range.setStart(row.cells[0], 0);
    range.setEnd(row.cells[1], row.cells[1].childNodes.length);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.waitForTimeout(200);
  const bordering = await openSheet();
  await bordering.getByLabel("Cell Border:").click();
  await page.getByRole("option", { name: "2 pt" }).click();
  await bordering.getByRole("button", { name: "OK" }).click();
  await bordering.waitFor({ state: "detached" });
  const colours = (node) =>
    [...node.rows[2].cells].slice(0, 2).map((cell) => cell.style.backgroundColor);
  const COLOURS = '["rgb(1, 2, 3)","rgb(4, 5, 6)"]';
  step(
    "changing the border leaves cells' colours alone",
    (await table.evaluate((node) => node.dataset.border)) === "2" &&
      JSON.stringify(await table.evaluate(colours)) === COLOURS,
  );

  // Shrinking a table with text in what goes asks first, and Cancel keeps it.
  await table.locator("td").first().click();
  const shrinking = await openSheet();
  await shrinking.getByLabel("Rows:").fill("1");
  await shrinking.getByRole("button", { name: "OK" }).click();
  const asking = page.getByRole("dialog", { name: "Remove cells with text in them?" });
  await asking.getByRole("button", { name: "Remove" }).waitFor();
  await asking.getByRole("button", { name: "Cancel" }).click();
  await shrinking.getByRole("button", { name: "Cancel" }).click();
  await shrinking.waitFor({ state: "detached" });
  step("cancelling keeps what would have gone", (await rows()).length === 3);

  // A file's uneven rows stay as they are when the sheet changes only the border.
  const uneven = await text.locator("table").evaluate((node) => {
    node.rows[2].cells[2].remove();
    return JSON.stringify([...node.rows].map((row) => row.cells.length));
  });
  const levelling = await openSheet();
  await levelling.getByLabel("Cell Border:").click();
  await page.getByRole("option", { name: "1 pt" }).click();
  await levelling.getByRole("button", { name: "OK" }).click();
  await levelling.waitFor({ state: "detached" });
  step(
    "a table of uneven rows keeps them",
    (await text
      .locator("table")
      .evaluate((node) => JSON.stringify([...node.rows].map((row) => row.cells.length)))) ===
      uneven,
  );

  await page.waitForTimeout(1_800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  const kept = await text.locator("table").evaluate((node) => ({
    rows: node.rows.length,
    span: node.rows[0].cells[0].colSpan,
    shade: getComputedStyle(node.rows[0].cells[0]).backgroundColor,
    last: node.rows[1].cells[0].innerText.trim(),
    colours: [...node.rows[2].cells].slice(0, 2).map((cell) => cell.style.backgroundColor),
  }));
  step(
    "it is all there after a reload",
    kept.rows === 3 &&
      kept.span === 2 &&
      kept.shade === "rgb(255, 234, 0)" &&
      kept.last === "four" &&
      JSON.stringify(kept.colours) === COLOURS,
  );
});
