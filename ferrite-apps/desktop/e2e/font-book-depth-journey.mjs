#!/usr/bin/env node
// Font Book at depth: the File, Edit and View menus and their keys. Exits 0 only when every step
// passed with no console error, page error or failed request.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/font-book-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("font-book-depth", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
async function choose(page, title, ...items) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
  for (const [index, item] of items.entries()) {
    const entry = page
      .getByRole("menuitem", { name: item })
      .or(page.getByRole("menuitemradio", { name: item }))
      .first();
    if (index < items.length - 1) {
      await entry.hover();
      await page.waitForTimeout(250);
    } else await entry.click();
  }
  await page.waitForTimeout(250);
}
/** Open a menu, keep it open, take its picture, and close it. */
async function menuShot(page, title, file) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
  await shot(page, path.join(out, file));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}
const saved = async (page) => (await api(page, "GET", "/api/font-book/library")).json;
async function settled(page, test) {
  for (let i = 0; i < 40; i++) {
    const library = await saved(page);
    if (test(library)) return library;
    await page.waitForTimeout(250);
  }
  return saved(page);
}

await run(async (page) => {
  // The browser reports a Mac, so Command is the Meta key: off Apple platforms the window manager
  // keeps Control-Option-F for full screen, which is what Option-Command-F types there.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }),
  );
  await openDesktop(page, base, step);
  await launch(page, "Font Book");
  const window = page.locator(".mac-font-book");
  await window
    .getByRole("tree", { name: "Collections" })
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(800);
  const pressed = () =>
    window
      .getByRole("group", { name: "Preview" })
      .getByRole("button", { pressed: true })
      .getAttribute("aria-label");
  const size = () => window.getByRole("combobox", { name: "Size:" }).inputValue();
  const collection = (name) => window.getByRole("treeitem", { name, exact: true });
  const fontRow = (name, options) =>
    window.getByRole("treegrid", { name: "Fonts" }).getByRole("row", { name, ...options });

  // The menus are there, with their keys.
  await menuShot(page, "File", "font-book-file-menu.png");
  await menuShot(page, "Edit", "font-book-edit-menu.png");
  await menuShot(page, "View", "font-book-view-menu.png");

  // File: a new collection from the menu and the key, read back from the server.
  const before = (await saved(page)).collections?.length ?? 0;
  await choose(page, "File", "New Collection");
  let library = await settled(page, (each) => (each.collections?.length ?? 0) === before + 1);
  step("File > New Collection makes a saved collection", library.collections.length === before + 1);
  await page.keyboard.press("Meta+n");
  library = await settled(page, (each) => (each.collections?.length ?? 0) === before + 2);
  step("Command-N makes another", library.collections.length === before + 2);

  // File: Add Fonts opens the chooser.
  let chooser = page.waitForEvent("filechooser", { timeout: 5000 });
  await choose(page, "File", "Add Fonts");
  step("File > Add Fonts opens the file chooser", (await chooser).isMultiple());
  chooser = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.keyboard.press("Meta+o");
  step("Command-O opens the file chooser", (await chooser).isMultiple());

  // Edit: Disable and Enable, saved.
  await collection("Fixed Width").click();
  await page.waitForTimeout(200);
  await choose(page, "Edit", /Disable “Andale Mono” Family/);
  library = await settled(page, (each) => each.disabled?.includes("andale-mono"));
  step("Edit > Disable saves the family as off", library.disabled.includes("andale-mono"));
  step(
    "the row says Off",
    (
      await fontRow(/Andale Mono/)
        .first()
        .innerText()
    ).includes("Off"),
  );
  await shot(page, path.join(out, "font-book-disabled-family.png"));
  await page.keyboard.press("Meta+Shift+d");
  library = await settled(page, (each) => !each.disabled?.includes("andale-mono"));
  step("Shift-Command-D enables it again", !library.disabled.includes("andale-mono"));

  // Find.
  await choose(page, "Edit", "Find", "Search");
  await page.waitForTimeout(300);
  const field = window.getByRole("searchbox", { name: "Search" });
  step(
    "Edit > Find > Search gives the field the keyboard",
    await field.evaluate((element) => element === document.activeElement),
  );
  await page.keyboard.type("Menlo");
  await page.waitForTimeout(200);
  step(
    "typing there narrows the list",
    (await window.getByRole("treegrid", { name: "Fonts" }).getByRole("row").count()) === 1,
  );
  await page.keyboard.press("Escape");
  await window.getByRole("treegrid", { name: "Fonts" }).focus();
  await page.keyboard.press("Meta+Alt+f");
  await page.waitForTimeout(150);
  step(
    "Option-Command-F gives it the keyboard too",
    await field.evaluate((element) => element === document.activeElement),
  );
  await page.keyboard.press("Escape");

  // View: the three views, Info and back.
  await choose(page, "View", "Repertoire");
  step(
    "View > Repertoire shows the grid",
    await window.getByRole("group", { name: "Repertoire" }).isVisible(),
  );
  await shot(page, path.join(out, "font-book-repertoire.png"));
  await page.keyboard.press("Meta+3");
  step("Command-3 shows Custom", (await pressed()) === "Custom");
  await page.keyboard.press("Meta+i");
  step("Command-I shows Info", (await pressed()) === "Info");
  await shot(page, path.join(out, "font-book-info.png"));
  await choose(page, "View", "Hide Font Info");
  step("View > Hide Font Info goes back to Custom", (await pressed()) === "Custom");

  // Edit on the custom text: Select All, Copy, and typed text undone from the menu.
  const custom = window.getByRole("textbox", { name: "Custom text" });
  await custom.click();
  await choose(page, "Edit", "Select All");
  const selection = () =>
    custom.evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd));
  step(
    "Edit > Select All selects the custom text",
    (await selection()) === "The quick brown fox jumps over the lazy dog.",
  );
  const original = "The quick brown fox jumps over the lazy dog.";
  await choose(page, "Edit", "Cut");
  step("Edit > Cut takes the selected text out", (await custom.inputValue()) === "");
  await choose(page, "Edit", "Paste");
  step("Edit > Paste puts it back", (await custom.inputValue()) === original);
  await choose(page, "Edit", "Undo");
  step("Edit > Undo takes the paste back", (await custom.inputValue()) === "");
  await choose(page, "Edit", "Redo");
  step("Edit > Redo makes it again", (await custom.inputValue()) === original);
  await choose(page, "Edit", "Select All");
  await choose(page, "Edit", "Copy");
  step(
    "Edit > Copy puts the selection on the clipboard",
    (await page.evaluate(() => navigator.clipboard.readText())) === original,
  );
  await page.waitForTimeout(100);
  await menuShot(page, "Edit", "font-book-edit-menu-custom-text.png");

  // Size: Bigger, Smaller and Fit.
  await page.keyboard.press("Meta+1");
  const start = Number(await size());
  await choose(page, "View", "Bigger");
  const bigger = Number(await size());
  step(
    `View > Bigger goes from ${start} to the next size of the list`,
    start === 42 && bigger === 48,
  );
  await window.getByRole("treegrid", { name: "Fonts" }).focus();
  await page.keyboard.press("Meta+-");
  step("Command-Minus goes to the size before", Number(await size()) === 36);
  await page.keyboard.press("Meta+=");
  step("Command-Equals goes up again", Number(await size()) === 48);
  await choose(page, "View", "Fit");
  const fitted = Number(await size());
  const sample = window.locator(".mac-font-book-sample");
  const box = await sample.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    fontSize: getComputedStyle(element).fontSize,
  }));
  step(
    "View > Fit sets a size at which the sample fills the view and does not overflow it",
    fitted !== 48 && box.scrollHeight <= box.clientHeight + 1 && box.fontSize === `${fitted}px`,
    JSON.stringify({ fitted, ...box }),
  );
  await shot(page, path.join(out, "font-book-fit.png"));

  // Hide and show the panes.
  await choose(page, "View", "Hide Collections");
  step(
    "View > Hide Collections hides them",
    !(await window.getByRole("tree", { name: "Collections" }).isVisible()),
  );
  await choose(page, "View", "Hide Fonts");
  step(
    "View > Hide Fonts hides the list",
    !(await window.getByRole("treegrid", { name: "Fonts" }).isVisible()),
  );
  await shot(page, path.join(out, "font-book-panes-hidden.png"));
  await choose(page, "View", "Show Fonts");
  await choose(page, "View", "Show Collections");
  step(
    "the two come back",
    (await window.getByRole("tree", { name: "Collections" }).isVisible()) &&
      (await window.getByRole("treegrid", { name: "Fonts" }).isVisible()),
  );

  // What was saved survives a reload.
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window
    .getByRole("tree", { name: "Collections" })
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(800);
  step(
    "the new collections survive a reload",
    await collection(library.collections.at(-1).name).isVisible(),
  );

  // Collections: named in place, fonts added by context menu and by drag, renamed, deleted.
  const trip = `Trip ${Date.now()}`;
  const ownNamed = (each, name) => each.collections?.find((one) => one.name === name);
  await choose(page, "File", "New Collection");
  await window.getByRole("textbox", { name: "Collection name" }).waitFor({ state: "visible" });
  await shot(page, path.join(out, "font-book-rename-new-collection.png"));
  await page.keyboard.type(trip);
  await page.keyboard.press("Enter");
  library = await settled(page, (each) => ownNamed(each, trip));
  step("a new collection's name is typed in place, and saved", !!ownNamed(library, trip));

  await collection("Fixed Width").click();
  await page.waitForTimeout(150);
  const list = window.getByRole("treegrid", { name: "Fonts" });
  const chosen = () => list.locator('[aria-selected="true"]').count();
  await choose(page, "Edit", "Select All");
  step("Edit > Select All selects the whole list", (await chosen()) === 6);
  await shot(page, path.join(out, "font-book-select-all.png"));
  await fontRow("Courier", { exact: true }).click();
  await fontRow("Menlo").click({ modifiers: ["Shift"] });
  step("Shift-click selects a range of fonts", (await chosen()) === 3);
  await fontRow("PT Mono").click({ modifiers: ["Meta"] });
  step("Command-click adds a font to the selection", (await chosen()) === 4);
  step(
    "the Sample view shows each selected font",
    (await window.locator(".mac-font-book-several").count()) === 4 &&
      (await window.locator(".mac-font-book-title").innerText()) === "4 Fonts",
  );
  await shot(page, path.join(out, "font-book-several-selected.png"));

  await fontRow("Menlo").click({ button: "right" });
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "font-book-font-context-menu.png"));
  await page.getByRole("menuitem", { name: "Add to Collection" }).hover();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: trip }).click();
  library = await settled(page, (each) => ownNamed(each, trip)?.families.length === 4);
  step(
    "Add to Collection saves every selected font in it",
    ownNamed(library, trip)?.families.join() === "courier,courier-new,menlo,pt-mono",
    ownNamed(library, trip)?.families.join(),
  );

  // Drag one font, and then two, by the pointer alone.
  await collection("PDF").click();
  await page.waitForTimeout(150);
  const dragTo = async (from, name, picture) => {
    const start = await from.boundingBox();
    const end = await collection(name).boundingBox();
    await page.mouse.move(start.x + 30, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y + 30, { steps: 3 });
    await page.mouse.move(end.x + 40, end.y + end.height / 2, { steps: 6 });
    await page.waitForTimeout(100);
    if (picture) await shot(page, path.join(out, picture));
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  await fontRow("Helvetica").click();
  await dragTo(fontRow("Helvetica"), trip, "font-book-drag-to-collection.png");
  library = await settled(page, (each) => ownNamed(each, trip)?.families.includes("helvetica"));
  step(
    "a font dragged to a collection goes in it",
    ownNamed(library, trip)?.families.includes("helvetica"),
  );
  await fontRow("Symbol").click();
  await fontRow("Times").click({ modifiers: ["Meta"] });
  await dragTo(fontRow("Times"), trip, "font-book-drag-several.png");
  library = await settled(page, (each) => ownNamed(each, trip)?.families.includes("times"));
  step(
    "several fonts dragged go in together",
    ownNamed(library, trip)?.families.includes("symbol") &&
      ownNamed(library, trip)?.families.includes("times"),
  );
  const countBefore = ownNamed(library, trip).families.length;
  await dragTo(fontRow("Courier", { exact: true }), "Fun");
  step(
    "a fixed collection takes no fonts",
    !(await saved(page)).collections.some((one) => one.name === "Fun") &&
      ownNamed(await saved(page), trip).families.length === countBefore,
  );

  // Delete on a selected font takes it out of the collection.
  await collection(trip).click();
  await page.waitForTimeout(150);
  step(
    "the collection lists what went in",
    (await list.getByRole("row").count()) === countBefore,
    String(await list.getByRole("row").count()),
  );
  await fontRow("Helvetica").click();
  await page.keyboard.press("Backspace");
  library = await settled(page, (each) => !ownNamed(each, trip)?.families.includes("helvetica"));
  step(
    "Delete takes the font out of the collection",
    !ownNamed(library, trip).families.includes("helvetica"),
  );

  // A font's context menu: off and on, out of the collection, and a new collection of it.
  const fontMenu = async (name, item) => {
    await fontRow(name).first().click({ button: "right" });
    await page.waitForTimeout(250);
    await page.getByRole("menuitem", { name: item }).click();
    await page.waitForTimeout(250);
  };
  await fontMenu("Courier New", /Disable “Courier New” Family/);
  library = await settled(page, (each) => each.disabled?.includes("courier-new"));
  step("a font's context menu disables it", library.disabled.includes("courier-new"));
  await fontMenu(/Courier New/, /Enable “Courier New” Family/);
  library = await settled(page, (each) => !each.disabled?.includes("courier-new"));
  step("and enables it", !library.disabled.includes("courier-new"));
  await fontMenu("Times", new RegExp(`Remove “Times” from “${trip}”`));
  library = await settled(page, (each) => !ownNamed(each, trip)?.families.includes("times"));
  step("and takes it out of the collection", !ownNamed(library, trip).families.includes("times"));
  const fromSelection = `From ${trip}`;
  await fontMenu("Symbol", "New Collection from Selection");
  await window.getByRole("textbox", { name: "Collection name" }).waitFor({ state: "visible" });
  await page.keyboard.type(fromSelection);
  await page.keyboard.press("Enter");
  library = await settled(page, (each) => ownNamed(each, fromSelection));
  step(
    "New Collection from Selection makes a collection of the font",
    ownNamed(library, fromSelection)?.families.join() === "symbol",
  );

  // A collection's context menu: a new one, and Delete, which asks.
  await collection("All Fonts").click({ button: "right" });
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "New Collection", exact: true }).click();
  await window.getByRole("textbox", { name: "Collection name" }).waitFor({ state: "visible" });
  await page.keyboard.press("Enter");
  const before2 = library.collections.length;
  library = await settled(page, (each) => each.collections?.length === before2 + 1);
  step("a collection's context menu makes a new one", library.collections.length === before2 + 1);
  await collection(fromSelection).click({ button: "right" });
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "Delete Collection" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  library = await settled(page, (each) => !ownNamed(each, fromSelection));
  step("and deletes one, after asking", !ownNamed(library, fromSelection));
  await collection(trip).click();
  await page.waitForTimeout(150);

  // Rename from the context menu, then by a double click; the fixed ones refuse.
  const named = `${trip} B`;
  await collection(trip).click({ button: "right" });
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "font-book-collection-context-menu.png"));
  await page.getByRole("menuitem", { name: "Rename Collection" }).click();
  await window.getByRole("textbox", { name: "Collection name" }).waitFor({ state: "visible" });
  await page.waitForTimeout(150);
  await page.keyboard.type(named);
  await page.keyboard.press("Enter");
  library = await settled(page, (each) => ownNamed(each, named));
  step("the context menu renames a collection", !!ownNamed(library, named));
  const again = `${trip} C`;
  await collection(named).dblclick();
  await window.getByRole("textbox", { name: "Collection name" }).fill(again);
  await page.keyboard.press("Enter");
  library = await settled(page, (each) => ownNamed(each, again));
  step("a double click renames it too", !!ownNamed(library, again));
  await collection("Fun").click({ button: "right" });
  await page.waitForTimeout(250);
  step(
    "a fixed collection's Rename is dimmed, with the reason",
    (await page
      .getByRole("menuitem", { name: "Rename Collection" })
      .getAttribute("aria-disabled")) === "true" &&
      (await page
        .getByRole("menuitem", { name: "Only a collection you made can change" })
        .isVisible()),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Disable every font of a collection from its menu, and turn them on again.
  await collection(again).click({ button: "right" });
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "Disable Collection" }).click();
  library = await settled(page, (each) => each.disabled?.includes("pt-mono"));
  step(
    "the collection's menu disables its fonts, but not one the system needs",
    library.disabled.includes("courier-new") &&
      library.disabled.includes("pt-mono") &&
      !library.disabled.includes("menlo"),
  );
  await collection(again).click({ button: "right" });
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "Enable Collection" }).click();
  library = await settled(page, (each) => !each.disabled?.includes("pt-mono"));
  step("and enables them again", !library.disabled.includes("pt-mono"));

  // Edit > Delete Collection asks, and goes.
  await collection(again).click();
  await page.waitForTimeout(150);
  await choose(page, "Edit", "Delete Collection");
  const question = page.getByRole("alertdialog");
  await question.waitFor({ state: "visible" });
  await shot(page, path.join(out, "font-book-delete-collection.png"));
  await question.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);
  step("Cancel keeps the collection", await collection(again).isVisible());
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window
    .getByRole("tree", { name: "Collections" })
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(800);
  await collection(again).click();
  await page.waitForTimeout(200);
  step(
    "the renamed collection and its fonts survive a reload",
    (await list.getByRole("row").count()) === countBefore - 2,
  );
  await page.getByRole("tree", { name: "Collections" }).focus();
  await page.keyboard.press("Backspace");
  await question.waitFor({ state: "visible" });
  await question.getByRole("button", { name: "Delete" }).click();
  library = await settled(page, (each) => !ownNamed(each, again));
  step("Delete in the sidebar deletes the collection", !ownNamed(library, again));
  step(
    "the window falls back to All Fonts",
    (await window.getByRole("treeitem", { name: "All Fonts" }).getAttribute("aria-selected")) ===
      "true",
  );

  // Keep a font: on the drive, back after a reload, and gone from both when it is removed.
  const fontName = `Depth Font ${Date.now()}`;
  const fontId = fontName.toLowerCase().replace(/ /g, "-");
  const driveEntry = async () => {
    const { json } = await api(page, "GET", "/api/files/");
    const entry = json.entries.find((one) => one.name === `${fontName}.woff2`);
    const folder = json.entries.find((one) => one.id === entry?.parent);
    return { entry, folder };
  };
  const fileShows = async (test) => {
    for (let i = 0; i < 40; i++) {
      const found = await driveEntry();
      if (test(found)) return found;
      await page.waitForTimeout(250);
    }
    return driveEntry();
  };
  const facesLoaded = () =>
    page.evaluate(
      (name) =>
        [...document.fonts].some(
          (face) => face.family.replace(/"/g, "") === name && face.status === "loaded",
        ),
      fontName,
    );
  const fontChooser = page.waitForEvent("filechooser", { timeout: 5000 });
  await page.keyboard.press("Meta+o");
  await (await fontChooser).setFiles({
    name: `${fontName}.woff2`,
    mimeType: "font/woff2",
    buffer: readFileSync(
      fileURLToPath(
        new URL(
          "../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
          import.meta.url,
        ),
      ),
    ),
  });
  await window
    .locator(".mac-font-book-title", { hasText: fontName })
    .waitFor({ state: "visible", timeout: 10_000 });
  step("an added font is listed, selected and loaded on the page", await facesLoaded());
  const onDrive = await fileShows(({ entry }) => entry);
  step(
    "its file goes to Documents/Fonts on the drive",
    onDrive.folder?.name === "Fonts" && onDrive.folder?.parent === "documents",
    onDrive.folder?.name,
  );
  await shot(page, path.join(out, "font-book-added-font.png"));

  await page.keyboard.press("Meta+Shift+d");
  library = await settled(page, (each) => each.disabled?.includes(fontId));
  step("an added font can be turned off, and that is saved", library.disabled.includes(fontId));
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window
    .getByRole("tree", { name: "Collections" })
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(800);
  await window.getByRole("searchbox", { name: "Search" }).fill(fontName);
  await fontRow(new RegExp(fontName)).first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(300);
  step("after a reload the font is back, read from the drive", await facesLoaded());
  step("and still off", (await fontRow(new RegExp(fontName)).first().innerText()).includes("Off"));
  await shot(page, path.join(out, "font-book-added-font-after-reload.png"));

  await fontRow(new RegExp(fontName)).first().click();
  await choose(page, "Edit", new RegExp(`Remove “${fontName}” Family`));
  const removeQuestion = page.getByRole("alertdialog");
  await removeQuestion.waitFor({ state: "visible" });
  await shot(page, path.join(out, "font-book-remove-font.png"));
  await removeQuestion.getByRole("button", { name: "Remove" }).click();
  const trashed = await fileShows(({ entry }) => entry?.trashed_ms !== undefined);
  step("Remove sends the file to the Trash", trashed.entry?.trashed_ms !== undefined);
  step("and takes the font off the page", !(await facesLoaded()));
  library = await settled(page, (each) => !each.disabled?.includes(fontId));
  step("and out of the disabled list", !library.disabled.includes(fontId));
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window
    .getByRole("tree", { name: "Collections" })
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(1500);
  await window.getByRole("searchbox", { name: "Search" }).fill(fontName);
  await page.waitForTimeout(300);
  step("after a reload it stays gone", (await list.getByRole("row").count()) === 0);
  await window.getByRole("searchbox", { name: "Search" }).fill("");

  // It changes nothing it did not make, so the collections it made stay in the library, to be
  // deleted by hand: run it on a test account.
});
