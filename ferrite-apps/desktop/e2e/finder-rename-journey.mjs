#!/usr/bin/env node
// Renaming in Finder, with real keys and clicks: Return edits the name in place with the name
// selected before its extension, Return keeps it and Escape does not, a slow second click on the
// name starts it and a double click does not, a name already taken is told, and Rename N Items
// renames several. Names are read back from the server.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-rename-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("finder-rename");
const tag = Date.now().toString(36);
const A = `Name A ${tag}.txt`;
const B = `Name B ${tag}.txt`;
const C = `Name C ${tag}.txt`;
const D = `Name D ${tag}.txt`;

const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const nameOf = async (page, id) => (await drive(page)).entries.find((e) => e.id === id)?.name;

async function until(check, ms = 8_000) {
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
  const ids = {};
  for (const name of [A, B, C, D]) {
    ids[name] = await uploadFile(page, {
      parent: "documents",
      name,
      type: "text/plain",
      text: name,
    });
  }
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const item = (name) => win.getByRole("option", { name, exact: true }).first();
  const field = win.getByRole("textbox", { name: "Name", exact: true });
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await item(A).waitFor({ timeout: 10_000 });

  // Return.
  await item(A).click();
  await page.keyboard.press("Enter");
  await field.waitFor({ timeout: 4_000 });
  const selected = await field.evaluate((e) => e.value.slice(e.selectionStart, e.selectionEnd));
  step(
    "Return edits the name, selected before its extension",
    selected === `Name A ${tag}`,
    selected,
  );
  step(
    "no file opened",
    (await page.locator('.mac-managed-window[data-window-id^="textedit"]').count()) === 0,
  );
  await shot(page, path.join(out, `finder-rename-field-${browserName}.png`));

  // Escape keeps the old name.
  await page.keyboard.type("Nope");
  await page.keyboard.press("Escape");
  await until(async () => (await field.count()) === 0);
  step("Escape keeps the old name, on the server", (await nameOf(page, ids[A])) === A);

  // The keyboard stays with the item: Return again, with no click.
  await page.keyboard.press("Enter");
  step(
    "Return after Escape edits the name again, with no click",
    await field.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    ),
  );

  // Return keeps the new one.
  const renamed = `Renamed ${tag}.txt`;
  // An input method's own Return confirms what it composes and ends nothing.
  const composing = () =>
    field.evaluate((input) => {
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
      );
      input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    });
  await composing();
  await page.waitForTimeout(200);
  step(
    "Return during input method composition keeps editing, and renames nothing",
    (await field.count()) === 1 && (await nameOf(page, ids[A])) === A,
  );
  await page.keyboard.type(`Renamed ${tag}`);
  await page.keyboard.press("Enter");
  step(
    "Return keeps the new name and its extension, on the server",
    await until(async () => (await nameOf(page, ids[A])) === renamed),
  );
  await item(renamed).waitFor({ timeout: 6_000 });
  await until(async () => (await item(renamed).getAttribute("aria-selected")) === "true");

  // Two renames in a row from the keyboard.
  await page.keyboard.press("Enter");
  step(
    "Return after a rename edits the renamed item again",
    (await field.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    )) && (await field.inputValue()) === renamed,
  );
  await page.keyboard.press("Escape");
  await until(async () => (await field.count()) === 0);

  // A reply that comes after the person selected more leaves their selection alone.
  const held = `Held ${tag}.txt`;
  await page.route("**/api/files/ops*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.continue();
  });
  await item(D).click();
  await page.keyboard.press("Enter");
  await field.waitFor({ timeout: 3_000 });
  await page.keyboard.type(`Held ${tag}`);
  await page.keyboard.press("Enter");
  await until(async () => (await field.count()) === 0);
  await item(C).click();
  await item(B).click({ modifiers: ["Control"] });
  await until(async () => (await nameOf(page, ids[D])) === held);
  await item(held).waitFor({ timeout: 6_000 });
  await page.waitForTimeout(400);
  await page.unroute("**/api/files/ops*");
  step(
    "a late reply keeps what was selected meanwhile",
    (await item(C).getAttribute("aria-selected")) === "true" &&
      (await item(B).getAttribute("aria-selected")) === "true" &&
      (await item(held).getAttribute("aria-selected")) !== "true",
  );

  // A slow second click on the name; a double click on it opens instead.
  const label = (name) => item(name).locator(".mac-icon-view-label-text");
  await item(B).click();
  await page.waitForTimeout(700);
  await label(B).click();
  step(
    "a slow click on the selected item's name edits it",
    await field.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    ),
  );
  await page.keyboard.press("Escape");
  await until(async () => (await field.count()) === 0);
  // A slow click followed at once by anything else is no slow rename.
  await page.waitForTimeout(700);
  await label(B).click();
  await page.keyboard.press("Enter");
  await field.waitFor({ timeout: 3_000 });
  await page.keyboard.press("Escape");
  await until(async () => (await field.count()) === 0);
  await page.waitForTimeout(900);
  step("a slow click then Return and Escape leaves the field closed", (await field.count()) === 0);
  await page.waitForTimeout(700);
  await label(B).click();
  await win.getByRole("button", { name: "Action", exact: true }).click();
  await page.waitForTimeout(900);
  step("a slow click then opening a menu starts no rename", (await field.count()) === 0);
  await page.keyboard.press("Escape");

  // A folder that cannot be renamed: Return neither edits nor opens, and Command-O opens.
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Go", exact: true })
    .click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Home", exact: true }).click();
  await item("Music").waitFor({ timeout: 6_000 });
  await item("Music").click();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  const shownNow = () => win.getByRole("listbox").first().getAttribute("aria-label");
  step(
    "Return on Music neither edits nor opens",
    (await field.count()) === 0 && (await shownNow()) !== "Music",
  );
  await page.keyboard.press("Control+o");
  step("Command-O opens it", await until(async () => (await shownNow()) === "Music"));
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await item(B).waitFor({ timeout: 6_000 });

  await page.waitForTimeout(700);
  await label(B).dblclick();
  const editor = page.locator('.mac-managed-window[data-window-id^="textedit"]').first();
  await editor.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  step("a double click on the name opens the file and edits no name", (await field.count()) === 0);
  await page.keyboard.press("Control+q");
  await editor.waitFor({ state: "detached", timeout: 6_000 });

  // A name already taken.
  await win.click({ position: { x: 400, y: 12 } });
  await item(B).click();
  await page.keyboard.press("Enter");
  await field.waitFor({ timeout: 4_000 });
  await page.keyboard.press("Control+a");
  await page.keyboard.type(C);
  expectRefusal(409, "/api/files/ops");
  await page.keyboard.press("Enter");
  const alert = page.getByRole("alertdialog").first();
  step(
    "a name already taken is told, and the item keeps its own",
    (await alert.waitFor({ timeout: 4_000 }).then(
      () => true,
      () => false,
    )) && (await nameOf(page, ids[B])) === B,
  );
  await shot(page, path.join(out, `finder-rename-taken-${browserName}.png`));
  await alert.getByRole("button", { name: "OK", exact: true }).click();

  // Rename 2 Items, from Return.
  await item(C).click();
  await item(held).click({ modifiers: ["Control"] });
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Rename 2 Items" });
  await dialog.waitFor({ timeout: 4_000 });
  step("Return with two selected opens Rename 2 Items", true);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 4_000 });

  // Rename 2 Items, from the menu.
  await item(held).click({ button: "right" });
  await page
    .getByRole("menu")
    .getByRole("menuitem", { name: "Rename 2 Items…", exact: true })
    .click();
  await dialog.waitFor({ timeout: 4_000 });
  await until(async () => (await page.locator('[role="menu"]').count()) === 0, 3_000);
  await dialog.getByRole("textbox", { name: "Find", exact: true }).fill("absent");
  await dialog.getByRole("textbox", { name: "Replace with", exact: true }).fill("x");
  await dialog.getByRole("button", { name: "Rename", exact: true }).click();
  await dialog.waitFor({ state: "hidden", timeout: 4_000 });
  await page.waitForTimeout(500);
  step(
    "Find text no name holds leaves both names alone",
    (await nameOf(page, ids[C])) === C && (await nameOf(page, ids[D])) === held,
  );
  await item(held).click({ button: "right" });
  await page
    .getByRole("menu")
    .getByRole("menuitem", { name: "Rename 2 Items…", exact: true })
    .click();
  await dialog.waitFor({ timeout: 4_000 });
  await until(async () => (await page.locator('[role="menu"]').count()) === 0, 3_000);
  await dialog.getByRole("textbox", { name: "Find", exact: true }).fill(tag);
  await dialog.getByRole("textbox", { name: "Replace with", exact: true }).fill(`done ${tag}`);
  step(
    "Rename 2 Items shows an example",
    (await dialog.innerText()).includes(`Example: Name C done ${tag}.txt`),
  );
  await shot(page, path.join(out, `finder-rename-items-${browserName}.png`));
  await dialog.getByRole("button", { name: "Rename", exact: true }).click();
  step(
    "Rename 2 Items renames both, on the server",
    await until(
      async () =>
        (await nameOf(page, ids[C])) === `Name C done ${tag}.txt` &&
        (await nameOf(page, ids[D])) === `Held done ${tag}.txt`,
    ),
  );
});
