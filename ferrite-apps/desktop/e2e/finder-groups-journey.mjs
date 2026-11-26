#!/usr/bin/env node
// Use Groups in Finder: the sections of icon and list views, chosen from the menu bar and the toolbar's
// Group, kept for the folder over a reload, with Show All and selection across sections.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-groups-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-groups");
const tag = Date.now().toString(36);
const TEXTS = Array.from({ length: 12 }, (_, at) => `Group note ${at} ${tag}.txt`);
const PICTURE = `Group picture ${tag}.png`;
const HOLDER = `Group holder ${tag}`;
const INNER = `Inner ${tag}.txt`;

await run(async (page) => {
  await openDesktop(page, base, step);
  for (const name of TEXTS) {
    await uploadFile(page, { parent: "documents", name, type: "text/plain", text: "words" });
  }
  await uploadFile(page, { parent: "documents", name: PICTURE, type: "image/png", text: "x" });
  const made = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: HOLDER }],
  });
  await uploadFile(page, {
    parent: made.json.created[0],
    name: INNER,
    type: "text/plain",
    text: "in",
  });
  await launch(page, "Finder");
  const win = page.locator('[data-window-id^="finder"]').first();
  await win.waitFor({ timeout: 10_000 });
  await page.keyboard.press("Shift+Control+O");
  await win.getByRole("option", { name: PICTURE }).waitFor({ timeout: 10_000 });
  await page.keyboard.press("Control+1");

  // Use Groups from the View menu: sections by kind.
  await page.getByRole("menuitem", { name: "View", exact: true }).first().click();
  await page.getByRole("menuitemcheckbox", { name: /^Use Groups/ }).click();
  const section = (name) => win.getByRole("region", { name, exact: true });
  const headed = win.locator(".mac-finder-group-title");
  await headed.first().waitFor({ timeout: 5_000 });
  const titles = await headed.allInnerTexts();
  step("Use Groups draws a section per kind", titles.length >= 2, titles.join(", "));
  const texts = win.locator("section", {
    has: page.getByRole("option", { name: TEXTS[0].replace(/\.txt$/, "") }),
  });

  // Show All: one row that scrolls sideways at first, wrapped after, with every item there either way.
  const showAll = texts.first().getByRole("button", { name: /^Show All/ });
  const before = (await texts.first().boundingBox())?.height ?? 0;
  const items = await texts.first().getByRole("option").count();
  await showAll.click();
  await win.getByRole("button", { name: "Show Less" }).first().waitFor({ timeout: 4_000 });
  const after = (await texts.first().boundingBox())?.height ?? 0;
  step(
    "Show All wraps the whole section, whose items were all there",
    after > before && items === TEXTS.length,
    `${before} -> ${after} pt, ${items} items`,
  );
  await page.waitForTimeout(400);
  await shot(page, path.join(out, `finder-groups-icons-${browserName}.png`));

  // A selection across sections, with Command.
  await win.getByRole("option", { name: PICTURE }).click();
  await win
    .getByRole("option", { name: new RegExp(TEXTS[1].replace(/\.txt$/, "")) })
    .click({ modifiers: ["Control"] });
  const selected = await win.locator('[role="option"][aria-selected="true"]').count();
  step("Command-click adds across sections", selected === 2, `${selected} selected`);

  // Group by Tags: an item with two tags is in both sections, in both views, and selecting it marks it in each.
  const tagged = TEXTS[2];
  const { json: drive } = await api(page, "GET", "/api/files/");
  const id = drive.entries.find((each) => each.name === tagged)?.id;
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "tag", id, tags: ["Red", "Blue"] }],
  });
  await page.waitForTimeout(800);
  await page.reload();
  await win.getByRole("button", { name: "Group", exact: true }).waitFor({ timeout: 30_000 });
  await win
    .getByRole("option", { name: new RegExp(tag) })
    .first()
    .waitFor({ timeout: 15_000 });
  await win.getByRole("button", { name: "Group", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Tags", exact: true }).click();
  const inSection = (name) =>
    win.locator("section", { has: page.getByRole("heading", { name, exact: true }) });
  await inSection("Red").waitFor({ timeout: 10_000 });
  await inSection("Blue").waitFor({ timeout: 5_000 });
  step(
    "An item with two tags is in both sections",
    (await inSection("Red").getByRole("option").count()) === 1 &&
      (await inSection("Blue").getByRole("option").count()) === 1,
  );
  await page.keyboard.press("Control+2");
  const twice = win.getByRole("row", { name: new RegExp(tagged.replace(/\.txt$/, "")) });
  await win.getByRole("row", { name: "Red", exact: true }).waitFor({ timeout: 5_000 });
  step("and has a row under each in the list", (await twice.count()) === 2);
  await twice.first().click();
  step(
    "and selecting it marks it in each",
    (await win.locator('[role="row"][aria-selected="true"]').count()) === 2,
  );
  await win
    .getByRole("row", { name: new RegExp(TEXTS[3].replace(/\.txt$/, "")) })
    .click({ modifiers: ["Control"] });
  await twice.last().click({ modifiers: ["Control"] });
  step(
    "and Command-clicking either row takes it off in both, leaving the rest",
    (await win.locator('[role="row"][aria-selected="true"]').count()) === 1,
  );
  await page.keyboard.press("Control+1");

  // The toolbar's Group changes the sections.
  await win.getByRole("button", { name: "Group", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Name", exact: true }).click();
  await section("G").waitFor({ timeout: 5_000 });
  step("Group by Name heads the section with the letter", true);

  // The list view has the same sections, as rows that fold.
  await page.keyboard.press("Control+2");
  const headRow = win.getByRole("row", { name: "G", exact: true });
  await headRow.waitFor({ timeout: 5_000 });
  const rowsOpen = await win.getByRole("row", { name: new RegExp(tag) }).count();
  step("List view shows the section's rows under its heading", rowsOpen >= 13, `${rowsOpen} rows`);
  await page.waitForTimeout(400);
  await shot(page, path.join(out, `finder-groups-list-${browserName}.png`));

  // Kept for the folder.
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("toolbar", { name: "Dock" }).waitFor({ timeout: 30_000 });
  const again = page.locator('[data-window-id^="finder"]').first();
  await again.waitFor({ timeout: 15_000 });
  step(
    "The grouping is there after a reload",
    await again
      .getByRole("row", { name: "G", exact: true })
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      ),
  );

  // None: back to the plain list, and the toolbar's Group is off in Column view.
  await again.getByRole("button", { name: "Group", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "None", exact: true }).click();
  await again
    .getByRole("row", { name: "G", exact: true })
    .waitFor({ state: "detached", timeout: 5_000 });
  step("None takes the sections away", true);

  // A row inside an expanded folder is out of sight in a grouped list, so it is no longer selected.
  const holder = again.getByRole("row", { name: new RegExp(`^${HOLDER}`) });
  await holder.click();
  await page.keyboard.press("ArrowRight");
  const inner = again.getByRole("row", { name: new RegExp(INNER.replace(/\.txt$/, "")) });
  await inner.click();
  const status = again.getByRole("status");
  step("A row inside a folder is selected", (await status.innerText()).includes("1 of"));
  await again.getByRole("button", { name: "Group", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Kind", exact: true }).click();
  await inner.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "and is deselected when grouping hides it",
    !(await status.innerText()).includes("selected"),
    await status.innerText(),
  );
  await again.getByRole("button", { name: "Group", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "None", exact: true }).click();
  await page.keyboard.press("Control+3");
  step(
    "Column view has no groups",
    await again.getByRole("button", { name: "Group", exact: true }).isDisabled(),
  );
});
