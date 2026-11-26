#!/usr/bin/env node
// Finder's search rows and Smart Folders on the signed-in person's drive: File > New Smart Folder with
// its rows narrowing what is found by kind, name, size, words and date; Save under a name, in the
// sidebar, kept over a reload, and its rows back when it runs.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-smart-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { driveOps, uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-smart");
const tag = Date.now().toString(36);
const NOTE = `Smart note ${tag}.txt`;
const BIG = `Smart big ${tag}.txt`;
const PICTURE = `Smart picture ${tag}.png`;
const FOLDER = `Smart Folder ${tag}`;
const WORD = `quokka${tag}`;

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const ids = [
    await uploadFile(page, {
      parent: "documents",
      name: NOTE,
      type: "text/plain",
      text: `A line with ${WORD} in it.`,
    }),
    await uploadFile(page, {
      parent: "documents",
      name: BIG,
      type: "text/plain",
      text: "x".repeat(40_000),
    }),
    await uploadFile(page, {
      parent: "documents",
      name: PICTURE,
      type: "image/png",
      text: "not drawn",
    }),
  ];
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const bar = page.getByRole("menubar").first();
  const closed = () => until(async () => (await page.getByRole("menu").count()) === 0, 3_000);
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "New Smart Folder", exact: true }).click();
  await closed();

  const named = (name) => win.getByText(name, { exact: true });
  const shows = (name) => until(async () => (await named(name).count()) > 0);
  const hides = (name) => until(async () => (await named(name).count()) === 0);
  const attribute = win.getByRole("combobox", { name: "Search attribute" }).first();
  const pick = async (trigger, option) => {
    await trigger.click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await attribute.waitFor({ timeout: 5_000 });
  step("New Smart Folder opens with a row and lists everything", await shows(NOTE));
  step(
    "on the whole disk",
    (await win.getByRole("radio", { name: "This Mac" }).isChecked()) === true,
  );
  await shot(page, path.join(out, `finder-smart-new-${browserName}.png`));

  await pick(win.getByRole("combobox", { name: "Kind" }), "Image");
  step(
    "Kind is Image keeps the picture and drops the notes",
    (await shows(PICTURE)) && (await hides(NOTE)),
  );

  await pick(attribute, "Name");
  const value = win.getByRole("textbox", { name: "Search for" });
  await value.fill(`note ${tag}`);
  step("Name contains finds by name", (await shows(NOTE)) && (await hides(BIG)));

  await pick(win.getByRole("combobox", { name: "Comparison" }), "begins with");
  await value.fill("Smart big");
  step("Name begins with", (await shows(BIG)) && (await hides(NOTE)));

  await pick(attribute, "File size");
  await pick(win.getByRole("combobox", { name: "Unit" }), "KB");
  await win.getByRole("spinbutton", { name: "Size" }).fill("20");
  step("File size over 20 KB keeps the big one", (await shows(BIG)) && (await hides(NOTE)));

  await pick(attribute, "Contents");
  await value.fill(WORD);
  step("Contents contains finds by the words inside", (await shows(NOTE)) && (await hides(BIG)));
  await shot(page, path.join(out, `finder-smart-contents-${browserName}.png`));
  await value.fill(`Smart note ${tag}`);
  step("but not by a name, which only Name finds", await hides(NOTE));
  await value.fill(WORD);
  await shows(NOTE);
  await value.fill("x".repeat(201));
  step(
    "Past what the index takes, it says so",
    await until(
      async () =>
        (await win.getByText("The file index could not answer", { exact: false }).count()) === 1,
    ),
  );
  await value.fill(WORD);
  await shows(NOTE);

  await win.getByRole("button", { name: "Add search criterion" }).nth(1).click();
  const secondAttribute = win.getByRole("combobox", { name: "Search attribute" }).nth(1);
  await secondAttribute.click();
  await page.getByRole("option", { name: "Last modified date", exact: true }).waitFor();
  step(
    "A search takes one Contents row",
    (await page.getByRole("option", { name: "Contents", exact: true }).count()) === 0,
  );
  await page.getByRole("option", { name: "Last modified date", exact: true }).click();
  await pick(win.getByRole("combobox", { name: "Comparison" }).nth(1), "is today");
  step("A second row, modified today, keeps it", await shows(NOTE));
  await pick(win.getByRole("combobox", { name: "Comparison" }).nth(1), "is yesterday");
  step("Modified yesterday drops it: every row must hold", await hides(NOTE));
  await pick(win.getByRole("combobox", { name: "Comparison" }).nth(1), "is today");
  await shows(NOTE);

  await win.getByRole("button", { name: "Save", exact: true }).click();
  const save = page.getByRole("textbox", { name: "Save As:" });
  await save.fill(FOLDER);
  await shot(page, path.join(out, `finder-smart-save-${browserName}.png`));
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  const inSidebar = win.getByRole("treeitem", { name: FOLDER, exact: true });
  step(
    "Save puts it in the sidebar under its name",
    await until(async () => (await inSidebar.count()) === 1),
  );

  // Kept for the account: a fresh page runs it, with its rows.
  await until(async () => {
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    return json?.values?.["finder.savedSearches"]?.some((each) => each.name === FOLDER);
  });
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const again = page.locator(".mac-window.mac-finder").first();
  await again.waitFor({ timeout: 10_000 });
  const kept = again.getByRole("treeitem", { name: FOLDER, exact: true });
  step("It is still there after a reload", await until(async () => (await kept.count()) === 1));
  await kept.click();
  step(
    "Clicking it runs it, with both rows",
    (await until(async () => (await again.getByText(NOTE, { exact: true }).count()) > 0)) &&
      (await again.getByRole("combobox", { name: "Search attribute" }).count()) === 2,
  );
  await shot(page, path.join(out, `finder-smart-kept-${browserName}.png`));

  // Save on a saved one updates it, with no question.
  const searches = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json?.values?.[
      "finder.savedSearches"
    ] ?? [];
  const rowsThen = JSON.stringify((await searches()).find((each) => each.name === FOLDER)?.rows);
  await again.getByRole("combobox", { name: "Comparison" }).nth(1).click();
  await page.getByRole("option", { name: "is yesterday", exact: true }).click();
  await again.getByRole("button", { name: "Save", exact: true }).click();
  step(
    "Save on a saved search updates it on the server",
    await until(async () => {
      const named = (await searches()).filter((each) => each.name === FOLDER);
      return named.length === 1 && JSON.stringify(named[0].rows) !== rowsThen;
    }),
  );
  step(
    "without asking for a name",
    (await page.getByRole("textbox", { name: "Save As:" }).count()) === 0,
  );
  step("and it stays one row of the sidebar", (await kept.count()) === 1);

  // Saved without Add To Sidebar: kept, run from Go's menu, and File adds it.
  const OTHER = `Other Smart ${tag}`;
  await again.getByRole("button", { name: "Remove search criterion" }).first().click();
  await again.getByRole("button", { name: "Remove search criterion" }).first().click();
  await until(
    async () => (await again.getByRole("button", { name: "Save", exact: true }).count()) === 0,
  );
  await again.getByRole("searchbox", { name: "Search" }).fill(`Smart note ${tag}`);
  await again.getByRole("searchbox", { name: "Search" }).press("Enter");
  await again.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("textbox", { name: "Save As:" }).fill(OTHER);
  await shot(page, path.join(out, `finder-smart-sheet-${browserName}.png`));
  await page.getByRole("checkbox", { name: "Add To Sidebar" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  const otherRow = again.getByRole("treeitem", { name: OTHER, exact: true });
  step(
    "Without Add To Sidebar it is kept and not in the sidebar",
    (await until(async () => (await searches()).some((each) => each.name === OTHER))) &&
      (await otherRow.count()) === 0,
  );
  await again.getByRole("searchbox", { name: "Search" }).fill("");
  await bar.getByRole("menuitem", { name: "Go", exact: true }).click();
  await page.getByRole("menuitem", { name: "Saved Searches", exact: true }).click();
  await page.getByRole("menuitem", { name: OTHER, exact: true }).click();
  await closed();
  step(
    "Go's Saved Searches runs it",
    await until(async () => (await again.getByText(NOTE, { exact: true }).count()) > 0),
  );
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add to Sidebar", exact: true }).click();
  await closed();
  step("File's Add to Sidebar adds it", await until(async () => (await otherRow.count()) === 1));
  await shot(page, path.join(out, `finder-smart-added-${browserName}.png`));
  await otherRow.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: /^Remove/ })
    .first()
    .click();
  await until(async () => (await otherRow.count()) === 0);
  await kept.click();
  await until(
    async () => (await again.getByRole("combobox", { name: "Search attribute" }).count()) === 2,
  );

  // The minuses end it.
  await again.getByRole("button", { name: "Remove search criterion" }).first().click();
  await again.getByRole("button", { name: "Remove search criterion" }).first().click();
  step(
    "Taking the last row away ends the search",
    await until(
      async () => (await again.getByRole("button", { name: "Save", exact: true }).count()) === 0,
    ),
  );

  await kept.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: /^Remove/ })
    .first()
    .click();
  step("It can be removed from the sidebar", await until(async () => (await kept.count()) === 0));

  await driveOps(
    page,
    ids.map((id) => ({ op: "trash", id })),
  );
});
