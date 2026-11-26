#!/usr/bin/env node
// Finder's rows built long ago that nothing drove one by one: the window's rows, the sidebar's places, selecting
// by keyboard, what several selected do, its keys, drags between windows and refused ones, Get Info's tags,
// Quick Look, the Replace alert, Go to Folder, and opening in the right application. In a folder of its own,
// read back from the server where the server keeps it.
//
//   node e2e/finder-rows-drive-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-rows-drive");
const tag = Date.now().toString(36);
const FOLDER = `Drive ${tag}`;
const SUB = `Sub ${tag}`;
const ALPHA = `Alpha ${tag}.txt`;
const BRAVO = `Bravo ${tag}.txt`;
const CHARLIE = `Charlie ${tag}.txt`;
const DELTA = `Delta ${tag}.txt`;
const PICTURE = `Picture ${tag}.png`;

const entries = async (page) => (await api(page, "GET", "/api/files/")).json.entries ?? [];
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
  const made = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
  });
  const folderId = made.json.created?.[0];
  const subId = (
    await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "mkdir", parent: folderId, name: SUB }],
    })
  ).json.created?.[0];
  for (const name of [ALPHA, BRAVO, CHARLIE, DELTA]) {
    await uploadFile(page, {
      parent: folderId,
      name,
      type: "text/plain",
      text: "Words only the file holds",
    });
  }
  await uploadFile(page, { parent: subId, name: DELTA, type: "text/plain", text: "other" });
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    canvas.getContext("2d").fillRect(0, 0, 8, 8);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await uploadFile(page, {
    parent: folderId,
    name: PICTURE,
    type: "image/png",
    bytes: Buffer.from(png, "base64"),
  });

  try {
    const bar = page.getByRole("menubar").first();
    const dock = page.getByRole("toolbar", { name: "Dock" });
    await dock.getByRole("button", { name: "Finder" }).click();
    const win = page.locator(".mac-window.mac-finder").first();
    await win.waitFor({ timeout: 10_000 });
    const shell = page.locator('[data-window-id="finder"]');
    const menus = page.getByRole("menu");
    const closed = () => until(async () => (await menus.count()) === 0, 3_000);
    const choose = async (title, name, role = "menuitem") => {
      await bar.getByRole("menuitem", { name: title, exact: true }).click();
      await menus.first().getByRole(role, { name, exact: true }).first().click();
      await closed();
    };
    const picture = (name) =>
      shot(page, path.join(out, `finder-rows-drive-${name}-${browserName}.png`));
    const option = (name) => win.getByRole("option", { name, exact: true }).first();
    const title = win.locator(".mac-title-bar-title").first();
    const titleIs = (name) => until(async () => (await title.innerText()).trim() === name);
    const place = (name) => win.getByRole("treeitem", { name, exact: true }).first();
    const selected = () =>
      win
        .locator('[role="option"][aria-selected="true"]')
        .evaluateAll((rows) =>
          rows.map((row) => row.querySelector(".mac-icon-view-label-text")?.textContent ?? ""),
        );
    const goHome = async () => {
      await place("Documents").click();
      await option(FOLDER).dblclick();
      await titleIs(FOLDER);
      await option(ALPHA).waitFor({ timeout: 10_000 });
    };
    const dragTo = async (from, to) => {
      const a = await from.boundingBox();
      const b = await to.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
      await page.waitForTimeout(200);
    };

    // The sidebar's places.
    await place("Recents").click();
    step("Recents lists what was made lately", await titleIs("Recents"));
    await place("Applications").click();
    await titleIs("Applications");
    step(
      "Applications lists the applications",
      await until(() =>
        option("Calculator")
          .isVisible()
          .catch(() => false),
      ),
    );
    await picture("applications");
    for (const name of ["Desktop", "Documents", "Downloads"]) {
      await place(name).click();
      step(`The sidebar goes to ${name}`, await titleIs(name));
    }
    await goHome();
    await choose("View", "as Icons", "menuitemradio");

    // The window.
    const size = () => shell.boundingBox();
    const windowed = await size();
    await win
      .locator(".mac-title-bar")
      .first()
      .dblclick({ position: { x: 300, y: 10 } });
    step(
      "A double click on the title bar zooms",
      await until(async () => (await size()).width !== windowed.width),
    );
    await win
      .locator(".mac-title-bar")
      .first()
      .dblclick({ position: { x: 300, y: 10 } });
    await until(async () => (await size()).width === windowed.width);
    await choose("View", "Enter Full Screen");
    const full = page.viewportSize();
    step(
      "Enter Full Screen fills the screen",
      await until(async () => (await size()).width === full.width),
    );
    await picture("full-screen");
    await page.mouse.move(600, 0);
    await page.waitForTimeout(400);
    await choose("View", "Exit Full Screen");
    await until(async () => (await size()).width === windowed.width);
    await page.mouse.move(600, 400);
    await dock.getByRole("button", { name: "Calculator" }).click();
    await page.locator('[data-window-id="calculator"]').waitFor({ timeout: 8_000 });
    await dock.getByRole("button", { name: "Finder" }).click();
    await page.waitForTimeout(1_500);
    await page.keyboard.press("Control+KeyN");
    const another = page.locator('[data-window-id="finder:2"]');
    await another.waitFor({ timeout: 5_000 });
    const calculator = page.locator('[data-window-id="calculator"]');
    const stacked = (one) => one.evaluate((element) => Number(getComputedStyle(element).zIndex));
    await dock.getByRole("button", { name: "Calculator" }).click();
    await page.waitForTimeout(400);
    await another
      .locator(".mac-title-bar")
      .first()
      .click({ position: { x: 300, y: 10 } });
    const behind = (await stacked(shell)) < (await stacked(calculator));
    await choose("Window", "Bring All to Front");
    step(
      "Bring All to Front brings the window behind Calculator forward",
      behind && (await until(async () => (await stacked(shell)) > (await stacked(calculator)))),
    );
    await another.getByRole("button", { name: "Close" }).first().click();
    await until(async () => (await another.count()) === 0, 4_000);

    // Selecting.
    const grid = win.getByRole("listbox", { name: FOLDER, exact: true });
    await option(ALPHA).click();
    await page.keyboard.type("cha");
    step(
      "Typing selects the item whose name starts so",
      await until(async () => (await selected()).join() === CHARLIE),
      (await selected()).join(),
    );
    await page.keyboard.press("Home");
    const firstThen = (await selected()).join();
    await page.keyboard.press("End");
    const lastThen = (await selected()).join();
    step("Home and End go to the first and the last", firstThen !== lastThen && firstThen !== "");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    step("An arrow key moves on", (await selected()).join() !== firstThen);
    const gridBox = await grid.boundingBox();
    await page.mouse.click(gridBox.x + gridBox.width - 20, gridBox.y + gridBox.height - 20);
    step(
      "A click on the background deselects",
      await until(async () => (await selected()).length === 0),
    );

    // Several at once.
    await option(ALPHA).click();
    await option(BRAVO).click({ modifiers: ["Control"] });
    step("Control-click selects several", (await selected()).length === 2);
    await bar.getByRole("menuitem", { name: "File", exact: true }).click();
    await menus.first().getByRole("menuitemcheckbox", { name: "Red", exact: true }).click();
    await closed();
    const named = async (name) => (await entries(page)).find((each) => each.name === name);
    step(
      "A tag goes on both, on the server",
      await until(async () =>
        [await named(ALPHA), await named(BRAVO)].every((each) => each?.tags?.includes("Red")),
      ),
    );
    await choose("File", "Duplicate");
    const copyOf = (name) => name.replace(".txt", " copy.txt");
    step(
      "Duplicate copies both",
      await until(async () => (await named(copyOf(ALPHA))) && (await named(copyOf(BRAVO)))),
    );
    await picture("several");
    await option(copyOf(ALPHA)).click();
    await option(copyOf(BRAVO)).click({ modifiers: ["Control"] });
    await dragTo(option(copyOf(BRAVO)), option(SUB));
    await page.mouse.up();
    step(
      "Dragged onto a folder, both move into it",
      await until(async () =>
        [await named(copyOf(ALPHA)), await named(copyOf(BRAVO))].every(
          (each) => each?.parent === subId,
        ),
      ),
    );

    // Refused.
    await dragTo(option(SUB), option(ALPHA));
    const refused = page.locator('[data-desktop-drop="refuse"]');
    const overFile = await refused.count();
    await page.mouse.up();
    await page.waitForTimeout(300);
    step(
      "A folder let go on a file is marked refused and stays where it is",
      overFile > 0 && (await named(SUB))?.parent === folderId,
      `refused marks: ${overFile}`,
    );

    // Keys.
    await option(ALPHA).click();
    const view = async (key, role) => {
      await page.keyboard.press(`Control+${key}`);
      return until(async () => (await win.getByRole(role).count()) > 0, 3_000);
    };
    step("⌘2 shows the list", await view("Digit2", "treegrid"));
    await view("Digit1", "listbox");
    await option(ALPHA).click();
    await page.keyboard.press("Control+i");
    const info = page.locator('[data-window-id^="finder:info"]').first();
    step("⌘I opens Get Info", await until(() => info.isVisible()));
    await picture("info");
    const tags = info
      .getByRole("textbox", { name: /tags/i })
      .or(info.getByRole("combobox", { name: /tags/i }))
      .first();
    await tags.fill("Blue");
    await tags.press("Enter");
    step(
      "Its Tags field is saved",
      await until(async () => (await named(ALPHA))?.tags?.includes("Blue")),
    );
    step("and it gives the facts", (await info.innerText()).includes("bytes"));
    await info.getByRole("button", { name: "Close" }).first().click();

    // Quick Look.
    await win
      .locator(".mac-title-bar")
      .first()
      .click({ position: { x: 300, y: 10 } });
    await option(ALPHA).click();
    await page.keyboard.press(" ");
    const look = page.locator(".mac-finder-quick-look").first();
    await look.waitFor({ timeout: 5_000 });
    step(
      "Quick Look shows a file's own text",
      await until(async () => (await look.innerText()).includes("Words only the file holds")),
    );
    await option(PICTURE).click();
    // The stage draws the file as its CSS background, under the overlay Markup draws on.
    step(
      "and follows the selection, to a picture's own pixels",
      await until(() =>
        look
          .locator(".mac-finder-quick-look-picture")
          .evaluate(async (stage) => {
            const url = /url\("(.+?)"\)/.exec(getComputedStyle(stage).backgroundImage)?.[1];
            if (!url) return false;
            const image = new Image();
            image.src = url;
            await image.decode();
            return image.naturalWidth === 8;
          })
          .catch(() => false),
      ),
    );
    await picture("quick-look");
    await page.keyboard.press(" ");
    await until(async () => (await look.count()) === 0, 3_000);

    // Go to Folder, and the Replace alert.
    await choose("Go", "Go to Folder…");
    const go = page.getByRole("dialog", { name: "Go to Folder" });
    await go.getByRole("combobox").fill("~/Downloads");
    await page.keyboard.press("Enter");
    step("Go to Folder goes to the path typed", await titleIs("Downloads"));
    await goHome();
    const deltas = () => entries(page).then((all) => all.filter((each) => each.name === DELTA));
    await dragTo(option(DELTA), option(SUB));
    await page.mouse.up();
    const ask = page.getByRole("alertdialog").first();
    step("A name already there asks first", await until(() => ask.isVisible()));
    await picture("replace");
    await ask.getByRole("button", { name: "Stop" }).click();
    await page.waitForTimeout(300);
    step(
      "and Stop leaves it where it was",
      (await deltas()).some((each) => each.parent === folderId && each.trashed_ms === undefined),
    );
    await dragTo(option(DELTA), option(SUB));
    await page.mouse.up();
    await ask.getByRole("button", { name: "Replace" }).click();
    step(
      "Replace takes the other's place",
      await until(async () => {
        const here = (await deltas()).filter(
          (each) => each.parent === subId && each.trashed_ms === undefined,
        );
        return here.length === 1 && (await option(DELTA).count()) === 0;
      }),
    );
    await bar.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await menus
      .first()
      .getByRole("menuitem", { name: /^Undo Move/ })
      .click();
    await closed();
    step(
      "and Undo gives back both",
      await until(async () => {
        const all = (await deltas()).filter((each) => each.trashed_ms === undefined);
        return (
          all.some((each) => each.parent === folderId) && all.some((each) => each.parent === subId)
        );
      }),
    );
    await option(DELTA).waitFor({ timeout: 8_000 });
    await dragTo(option(DELTA), option(SUB));
    await page.mouse.up();
    await ask.getByRole("button", { name: "Keep Both" }).click();
    const keptName = DELTA.replace(".txt", " 2.txt");
    step(
      "Keep Both puts it beside the other under the next name",
      await until(async () => (await named(keptName))?.parent === subId),
    );

    // Opening in the right application.
    await option(ALPHA).dblclick();
    step(
      "Text opens in TextEdit",
      await until(() => page.locator('[data-window-id^="textedit"]').first().isVisible()),
    );
    await dock.getByRole("button", { name: "Finder" }).click();
    await option(PICTURE).dblclick();
    step(
      "A picture opens in Preview",
      await until(() => page.locator('[data-window-id^="preview"]').first().isVisible()),
    );
    await picture("opened");
  } finally {
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "trash", id: folderId }] });
  }
});
