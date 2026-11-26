#!/usr/bin/env node
// Stickies at depth: three notes as windows at their saved frames, New Note, Close with its alert,
// the Window menu, the colour keys and the defaults, the Edit and context menus and Find across
// notes, then that it all survives a reload. Exits 0 only when every step passed with no console
// error, page error or failed request.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/stickies-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("stickies-depth");
const stamp = Date.now();
const A = `Apple ${stamp}`;
const B = `Banana ${stamp}`;
const C = `Cherry ${stamp}`;
const WORD = `plum${stamp}`;

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
async function choose(page, title, ...items) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
  for (const [index, item] of items.entries()) {
    const menus = page.locator('[role="menu"]');
    const entry = menus
      .getByRole("menuitem", { name: item })
      .or(menus.getByRole("menuitemradio", { name: item }))
      .or(menus.getByRole("menuitemcheckbox", { name: item }))
      .first();
    if (index < items.length - 1) {
      await entry.hover();
      await page.waitForTimeout(250);
    } else await entry.click();
  }
  await page.waitForTimeout(400);
}
const saved = async (page) => (await api(page, "GET", "/api/stickies/data")).json.data;
const settings = async (page) =>
  (await api(page, "GET", "/api/system-preferences/settings")).json.values ?? {};
const noteOf = (data, title) => data?.notes?.find((note) => note.text.startsWith(title));
async function settled(page, read, test) {
  for (let i = 0; i < 40; i++) {
    const data = await read(page);
    if (test(data)) return data;
    await page.waitForTimeout(250);
  }
  return read(page);
}
const note = (page, title) => page.locator(".mac-stickies-note").filter({ hasText: title }).first();
const windowOf = (page, title) =>
  page
    .locator("[data-window-id]")
    .filter({ has: note(page, title) })
    .first();
async function place(page, title) {
  const box = await note(page, title).boundingBox();
  return { x: Math.round(box.x), y: Math.round(box.y) };
}
/** Drag a note by its band to a place on the desktop; returns where it stands after. */
async function drag(page, title, target) {
  const band = await note(page, title).locator(".mac-sticky-note-title-bar").boundingBox();
  await page.mouse.move(band.x + band.width / 2, band.y + 5);
  await page.mouse.down();
  await page.mouse.move(target.x + band.width / 2, target.y + 5, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  return place(page, title);
}
const selectWord = (page, title, word) =>
  note(page, title)
    .getByRole("textbox", { name: "Note" })
    .evaluate((field, wanted) => {
      field.focus();
      const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.nodeValue.indexOf(wanted);
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + wanted.length);
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
    }, word);
const typeInEnd = async (page, title, typed) => {
  await note(page, title).getByRole("textbox", { name: "Note" }).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(typed);
  await page.waitForTimeout(150);
};
/** Select a word and press the right button on it, as a person does on a selection. */
async function rightClickWord(page, title, word) {
  await selectWord(page, title, word);
  await page.waitForTimeout(100);
  const box = await page.evaluate(() => {
    const rect = document.getSelection().getRangeAt(0).getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await page.mouse.click(box.x, box.y, { button: "right" });
}
/**
 * Takes out only the notes this run wrote, which carry its stamp, and puts back the frame of a note
 * it found, which Arrange By moved. Every other note stays as it is now.
 */
async function removeOurNotes(page, found) {
  const before = new Map(found.map((each) => [each.id, each]));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { json } = await api(page, "GET", "/api/stickies/data");
    const notes = (json.data?.notes ?? [])
      .filter((each) => !each.text.includes(String(stamp)))
      .map((each) => (before.has(each.id) ? { ...each, frame: before.get(each.id).frame } : each));
    const put = await api(page, "PUT", "/api/stickies/data", {
      base: json.rev,
      data: { ...json.data, notes },
    });
    if (put.status === 200) return;
  }
  throw new Error("could not take out the journey's notes");
}

let found = [];
let floatingAtStart = 0;
const count = (data) => data?.notes?.length ?? 0;

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Stickies");
  await page.locator(".mac-stickies-note").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(1000);
  found = (await saved(page))?.notes ?? [];
  floatingAtStart = (await settings(page))["stickies.floating"]?.length ?? 0;
  try {
    await theJourney(page);
  } finally {
    await removeOurNotes(page, found);
  }
});

async function theJourney(page) {
  const windowsAtStart = await page.locator("[data-window-id^='stickies']").count();

  // ---- Many notes on the desktop ------------------------------------------------------------
  await choose(page, "File", "New Note");
  await page.keyboard.type(A);
  await page.waitForTimeout(200);
  await choose(page, "File", "New Note");
  await page.keyboard.type(B);
  await page.waitForTimeout(200);
  await page.keyboard.press("ControlOrMeta+n");
  await page.waitForTimeout(400);
  await page.keyboard.type(C);
  await page.waitForTimeout(200);
  step(
    "File > New Note and Command-N make notes that take the keyboard",
    (await note(page, A).count()) === 1 &&
      (await note(page, B).count()) === 1 &&
      (await note(page, C).count()) === 1,
  );
  const windows = await page.locator("[data-window-id^='stickies']").count();
  step("each note is its own window", windows === windowsAtStart + 3, `${windows} windows`);

  // The note furthest back first: its band still shows, and it then leaves no edge under the press
  // on the next.
  const aAt = await drag(page, A, { x: 60, y: 60 });
  const bAt = await drag(page, B, { x: 460, y: 60 });
  const cAt = await drag(page, C, { x: 860, y: 60 });
  let data = await settled(
    page,
    saved,
    (each) =>
      noteOf(each, A)?.frame?.x !== undefined &&
      noteOf(each, B)?.frame?.x !== undefined &&
      noteOf(each, C)?.frame?.x !== undefined,
  );
  step(
    "moving a note saves its frame",
    Boolean(noteOf(data, A)?.frame && noteOf(data, B)?.frame && noteOf(data, C)?.frame),
  );
  await shot(page, path.join(out, "stickies-many-notes.png"));

  await menuBar(page, "Window").click();
  await page.waitForTimeout(250);
  step(
    "the Window menu lists every note by its title",
    (await page.getByRole("menuitemcheckbox", { name: A }).count()) === 1 &&
      (await page.getByRole("menuitemcheckbox", { name: B }).count()) === 1 &&
      (await page.getByRole("menuitemcheckbox", { name: C }).count()) === 1,
  );
  await shot(page, path.join(out, "stickies-window-menu.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await settled(page, saved, (each) => noteOf(each, C)?.text === C);
  await reloadDesktop(page);
  await launch(page, "Stickies");
  await note(page, C).waitFor({ state: "visible", timeout: 10_000 });
  const near = (a, b) => Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2;
  const aAfter = await place(page, A);
  const bAfter = await place(page, B);
  const cAfter = await place(page, C);
  step(
    "after a reload all three notes reopen at the frames they were moved to",
    near(aAfter, aAt) && near(bAfter, bAt) && near(cAfter, cAt),
    JSON.stringify({ aAt, aAfter, bAt, bAfter, cAt, cAfter }),
  );
  await shot(page, path.join(out, "stickies-frames-after-reload.png"));

  // ---- Close with an alert, which removes the note ------------------------------------------
  const notesBefore = count(await saved(page));
  await note(page, C).getByRole("textbox", { name: "Note" }).click();
  await page.keyboard.press("ControlOrMeta+n");
  await page.waitForTimeout(400);
  await page.keyboard.press("ControlOrMeta+w");
  await page.waitForTimeout(300);
  data = await settled(page, saved, (each) => count(each) === notesBefore);
  step(
    "Close on an empty note removes it without asking",
    count(data) === notesBefore && (await page.getByRole("alertdialog").count()) === 0,
    `${count(data)} notes`,
  );

  await choose(page, "File", "New Note");
  await page.keyboard.type(`Going away ${stamp}`);
  await page.waitForTimeout(300);
  await note(page, "Going away").getByRole("button", { name: "Close" }).click({ force: true });
  const alert = page.getByRole("alertdialog");
  await alert.waitFor({ state: "visible", timeout: 5000 });
  step(
    "the close box asks before it removes a note with text",
    (await alert.getByText("Going away").count()) === 1,
  );
  await shot(page, path.join(out, "stickies-close-alert.png"));
  await alert.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);
  step("Cancel keeps the note", (await note(page, "Going away").count()) === 1);
  await note(page, "Going away").getByRole("button", { name: "Close" }).click({ force: true });
  await alert.getByRole("button", { name: "Remove Note" }).click();
  data = await settled(page, saved, (each) => !noteOf(each, "Going away"));
  step(
    "Remove Note takes the note out of the saved notes",
    !noteOf(data, "Going away") && (await note(page, "Going away").count()) === 0,
  );

  // ---- Window menu --------------------------------------------------------------------------
  await note(page, A).getByRole("textbox", { name: "Note" }).click();
  await choose(page, "Window", "Translucent");
  const opacity = await note(page, A).evaluate((each) => getComputedStyle(each).opacity);
  step("Window > Translucent makes the note see-through", Number(opacity) < 1, opacity);
  data = await settled(page, saved, (each) => noteOf(each, A)?.translucent === true);
  step("Translucent is saved on the note", noteOf(data, A)?.translucent === true);
  await shot(page, path.join(out, "stickies-translucent.png"));
  await page.keyboard.press("ControlOrMeta+Alt+t");
  await page.waitForTimeout(600);
  const clear = await note(page, A).evaluate((each) => getComputedStyle(each).opacity);
  await page.keyboard.press("ControlOrMeta+Alt+t");
  await page.waitForTimeout(600);
  const again = await note(page, A).evaluate((each) => getComputedStyle(each).opacity);
  step(
    "Option-Command-T turns Translucent off and on",
    clear === "1" && Number(again) < 1,
    `${clear} ${again}`,
  );

  await note(page, B).getByRole("textbox", { name: "Note" }).click();
  await choose(page, "Window", "Floating Window");
  await note(page, C).getByRole("textbox", { name: "Note" }).click();
  await page.waitForTimeout(200);
  const z = async (title) =>
    Number(await windowOf(page, title).evaluate((each) => getComputedStyle(each).zIndex));
  step(
    "Window > Floating Window keeps the note above a window brought in front",
    (await z(B)) > (await z(C)),
    `${await z(B)} > ${await z(C)}`,
  );
  const floats = await settled(
    page,
    settings,
    (values) => values["stickies.floating"]?.length === floatingAtStart + 1,
  );
  step("the floating note is saved", floats["stickies.floating"]?.length === floatingAtStart + 1);
  await shot(page, path.join(out, "stickies-floating.png"));
  await note(page, B).getByRole("textbox", { name: "Note" }).click();
  await page.keyboard.press("ControlOrMeta+Alt+f");
  await page.waitForTimeout(250);
  const zOff = await z(B);
  await page.keyboard.press("ControlOrMeta+Alt+f");
  await page.waitForTimeout(250);
  step("Option-Command-F floats it off and on", zOff < 400 && (await z(B)) > 400);

  await note(page, C).getByRole("textbox", { name: "Note" }).click();
  await choose(page, "Window", "Collapse");
  const collapsed = await note(page, C).boundingBox();
  step(
    "Window > Collapse folds the note to its band",
    collapsed.height <= 14,
    `${collapsed.height}`,
  );
  data = await settled(page, saved, (each) => noteOf(each, C)?.collapsed === true);
  step("Collapse is saved", noteOf(data, C)?.collapsed === true);
  await shot(page, path.join(out, "stickies-collapsed.png"));
  await page.keyboard.press("ControlOrMeta+m");
  await page.waitForTimeout(250);
  const opened = await note(page, C).boundingBox();
  step("Command-M expands it", opened.height > 40, `${opened.height}`);

  // ---- Colour keys and defaults -------------------------------------------------------------
  await note(page, C).getByRole("textbox", { name: "Note" }).click();
  const shortcuts = ["yellow", "blue", "green", "pink", "purple", "gray"];
  const seen = [];
  for (const [index] of shortcuts.entries()) {
    await page.keyboard.press(`ControlOrMeta+${index + 1}`);
    await page.waitForTimeout(120);
    seen.push(await note(page, C).getAttribute("data-color"));
  }
  step("Command-1 to Command-6 set the six colours", seen.join() === shortcuts.join(), seen.join());
  await page.keyboard.press("ControlOrMeta+4");
  await page.waitForTimeout(200);
  step(
    "Command-4 makes the note pink",
    (await note(page, C).getAttribute("data-color")) === "pink",
  );
  await menuBar(page, "Color").click();
  await page.waitForTimeout(250);
  step(
    "the Color menu names the keys and checks the colour",
    (await page.getByRole("menuitemradio", { name: "Pink" }).getAttribute("aria-checked")) ===
      "true" &&
      (await page
        .getByRole("menuitemradio", { name: "Pink" })
        .getAttribute("aria-keyshortcuts")) !== null,
  );
  await shot(page, path.join(out, "stickies-color-keys.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.keyboard.press("ControlOrMeta+2");
  await page.waitForTimeout(200);
  data = await settled(page, saved, (each) => noteOf(each, C)?.color === "blue");
  step("Command-2 makes it blue, and it is saved", noteOf(data, C)?.color === "blue");

  await selectWord(page, C, C);
  await choose(page, "Font", "Bigger");
  await choose(page, "Font", "Bigger");
  await choose(page, "Window", "Use as Default");
  const kept = await settled(
    page,
    settings,
    (values) => values["stickies.defaults"]?.color === "blue",
  );
  step(
    "Window > Use as Default keeps the colour and the font",
    kept["stickies.defaults"]?.color === "blue" && kept["stickies.defaults"]?.size === 14,
    JSON.stringify(kept["stickies.defaults"]),
  );
  await choose(page, "File", "New Note");
  await page.keyboard.type(`Default ${stamp}`);
  await page.waitForTimeout(300);
  const made = note(page, `Default ${stamp}`);
  step("a new note takes the default colour", (await made.getAttribute("data-color")) === "blue");
  const fontSize = await made.getByRole("textbox", { name: "Note" }).evaluate((field) => {
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
    return getComputedStyle(walker.nextNode().parentElement).fontSize;
  });
  step("and its text the default font size, 14", fontSize === "14px", fontSize);
  await shot(page, path.join(out, "stickies-defaults.png"));

  // ---- Edit and context menus ---------------------------------------------------------------
  await typeInEnd(page, A, ` ${WORD} words`);
  await typeInEnd(page, B, ` ${WORD}`);
  await selectWord(page, A, "words");
  await choose(page, "Edit", "Transformations", "Make Upper Case");
  await page.waitForTimeout(300);
  step(
    "Edit > Transformations > Make Upper Case changes the selection",
    (await note(page, A).innerText()).includes("WORDS"),
  );
  await shot(page, path.join(out, "stickies-transformed.png"));

  await rightClickWord(page, A, "WORDS");
  const context = page.getByRole("menu", { name: "Note" });
  await context.waitFor({ state: "visible", timeout: 5000 });
  const enabled = async (name) =>
    (await context.getByRole("menuitem", { name, exact: true }).getAttribute("aria-disabled")) !==
    "true";
  step(
    "the note's context menu offers Cut, Copy, Look Up and Paste for the selected word, and Speech",
    (await enabled("Cut")) &&
      (await enabled("Copy")) &&
      (await enabled("Paste")) &&
      (await enabled("Look Up")) &&
      (await enabled("Speech")),
  );
  await shot(page, path.join(out, "stickies-context-menu.png"));
  await context.getByRole("menuitem", { name: "Transformations" }).hover();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "Make Lower Case" }).click();
  await page.waitForTimeout(400);
  step(
    "the context menu's Make Lower Case changes the word",
    (await note(page, A).innerText()).includes(" words"),
  );
  await rightClickWord(page, A, "words");
  await context.waitFor({ state: "visible", timeout: 5000 });
  await context.getByRole("menuitem", { name: "Cut", exact: true }).click();
  await page.waitForTimeout(400);
  step(
    "the context menu's Cut takes the word out of the note",
    !(await note(page, A).innerText()).includes("words"),
  );
  data = await settled(page, saved, (each) => !noteOf(each, A)?.text.includes("words"));
  step("and it is saved", !noteOf(data, A)?.text.includes("words"));

  await menuBar(page, "Edit").click();
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "stickies-edit-menu.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  // ---- Find across notes --------------------------------------------------------------------
  await note(page, B).getByRole("textbox", { name: "Note" }).click();
  await choose(page, "Window", "Collapse");
  await note(page, A).getByRole("textbox", { name: "Note" }).click();
  await page.keyboard.press("ControlOrMeta+f");
  const barA = note(page, A).getByRole("search", { name: "Find" });
  await barA.waitFor({ state: "visible", timeout: 5000 });
  await barA.getByRole("searchbox", { name: "Find" }).fill(WORD);
  await page.waitForTimeout(200);
  step(
    "Command-F shows the find bar and finds in the note",
    (await barA.getByRole("status").innerText()) === "1 of 1",
  );
  await shot(page, path.join(out, "stickies-find.png"));
  await page.keyboard.press("ControlOrMeta+g");
  const barB = note(page, B).getByRole("search", { name: "Find" });
  await barB.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(300);
  step(
    "Command-G goes on in the next note that holds it",
    (await barB.getByRole("status").innerText()) === "1 of 1" && (await barA.count()) === 0,
  );
  await shot(page, path.join(out, "stickies-find-next-note.png"));
  const expanded = await note(page, B).boundingBox();
  step("and expands that note when it was collapsed", expanded.height > 40, `${expanded.height}`);
  await page.keyboard.press("Enter");
  await barA.waitFor({ state: "visible", timeout: 5000 });
  step("Return in the field goes on again, round to the first note", (await barB.count()) === 0);
  await page.keyboard.press("ControlOrMeta+Shift+g");
  await barB.waitFor({ state: "visible", timeout: 5000 });
  step("Shift-Command-G goes back to the note before", (await barA.count()) === 0);
  await shot(page, path.join(out, "stickies-find-previous.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await selectWord(page, B, WORD);
  await page.keyboard.press("ControlOrMeta+e");
  await page.waitForTimeout(100);
  await page.keyboard.press("ControlOrMeta+f");
  const barSelection = note(page, B).getByRole("search", { name: "Find" });
  await barSelection.waitFor({ state: "visible", timeout: 5000 });
  step(
    "Command-E uses the selection for Find",
    (await barSelection.getByRole("searchbox", { name: "Find" }).inputValue()) === WORD,
  );
  await shot(page, path.join(out, "stickies-use-selection.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // ---- Arrange By ---------------------------------------------------------------------------
  await choose(page, "Window", A);
  await page.keyboard.press("ControlOrMeta+4");
  await page.waitForTimeout(250);
  await choose(page, "Window", "Arrange By", "Color");
  await page.waitForTimeout(400);
  const xOf = async (title) => (await place(page, title)).x;
  step(
    "Arrange By > Color puts the pink note after the yellow and the blue",
    (await xOf(B)) < (await xOf(C)) && (await xOf(C)) < (await xOf(A)),
  );
  await shot(page, path.join(out, "stickies-arranged-color.png"));
  await choose(page, "Window", "Arrange By", "Date");
  await page.waitForTimeout(400);
  step(
    "Arrange By > Date puts them in the order they were made",
    (await xOf(A)) < (await xOf(B)) && (await xOf(B)) < (await xOf(C)),
  );
  await shot(page, path.join(out, "stickies-arranged-date.png"));
  await choose(page, "Window", "Arrange By", "Content");
  await page.waitForTimeout(400);
  const stack = [await place(page, A), await place(page, B), await place(page, C)];
  step(
    "Window > Arrange By > Content stacks the notes in the order of their titles",
    stack[0].x < stack[1].x && stack[1].x < stack[2].x && stack[0].y < stack[1].y,
    JSON.stringify(stack),
  );
  data = await settled(
    page,
    saved,
    (each) =>
      noteOf(each, A)?.frame?.x < noteOf(each, B)?.frame?.x &&
      noteOf(each, B)?.frame?.x < noteOf(each, C)?.frame?.x,
  );
  step("the arranged frames are saved", noteOf(data, A)?.frame?.x < noteOf(data, C)?.frame?.x);
  await shot(page, path.join(out, "stickies-arranged.png"));

  // ---- All of it after a reload -------------------------------------------------------------
  await settled(page, saved, (each) => noteOf(each, B)?.text.includes(WORD));
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await launch(page, "Stickies");
  await note(page, C).waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(500);
  const opacityAgain = await note(page, A).evaluate((each) => getComputedStyle(each).opacity);
  step(
    "after a reload: the translucent note, the colour and the frames are as they were",
    Number(opacityAgain) < 1 && (await note(page, C).getAttribute("data-color")) === "blue",
    opacityAgain,
  );
  const sizeAgain = await note(page, B).boundingBox();
  step("and a note's saved size", sizeAgain.width === 300 && sizeAgain.height === 200);
  await choose(page, "Window", C);
  await page.waitForTimeout(200);
  step(
    "and the floating note floats again",
    (await z(B)) > (await z(C)),
    `${await z(B)} > ${await z(C)}`,
  );
  await page.keyboard.press("ControlOrMeta+n");
  await page.waitForTimeout(400);
  await page.keyboard.type(`Second default ${stamp}`);
  await page.waitForTimeout(300);
  step(
    "and a new note still takes the default colour",
    (await note(page, `Second default ${stamp}`).getAttribute("data-color")) === "blue",
  );
  await shot(page, path.join(out, "stickies-after-reload.png"));
  await settled(page, saved, (each) => noteOf(each, `Second default ${stamp}`)?.text.length > 0);
  await page.waitForTimeout(1500);
}
