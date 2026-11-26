#!/usr/bin/env node
// Mail on Ferrite: the New Message window on the editors' shared path. A word is written in a new
// message, and from the desktop menu bar's Edit menu: Copy (the keyboard's Paste then puts it in
// again), Undo and Redo, Cut (the keyboard pastes it back), Select All, and Paste, which reads the
// clipboard where this engine lets a menu do so (Firefox, Chromium with --grant-clipboard) and is
// dimmed with the reason where it refuses (WebKit, Chromium without the grant). Then the Fonts
// panel (Command-T): a family is dimmed exactly when it does not render in this browser, measured
// apart by layout, with the reason; a family that renders, chosen there, is the selected word's
// computed font. Exits 0 only when every step passed and the page logged no console error, page
// error, failed request or HTTP error.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/mail-compose-editor-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                            [--browser chromium|chrome|firefox|webkit] [--grant-clipboard]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { engineFamily } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const grant =
  process.argv.includes("--grant-clipboard") && engineFamily(browserName) === "chromium";
const { step, run } = journey(
  "mail-compose-editor",
  grant
    ? { contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } } }
    : {},
);
const pasteAllowed = browserName === "firefox" || grant;
const stamp = String(Date.now()).slice(-6);
const COPY = `Quince${stamp}`;
const CUT = `Sorrel${stamp}`;

// By its class: the window is named after its subject once one is typed.
const composer = (page) => page.locator(".mac-mail-compose").last();
const message = (page) => composer(page).getByRole("textbox", { name: "Message" });

/** Select `word` in the editor, focused. */
const selectWord = (editor, word) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      root.focus();
      const range = root.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      root.ownerDocument.getSelection().removeAllRanges();
      root.ownerDocument.getSelection().addRange(range);
      return true;
    }
    return false;
  }, word);

/** Put the insertion point at the end of the editor's last text, focused. */
const caretAtEnd = (editor) =>
  editor.evaluate((root) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.trim()) last = node;
    }
    root.focus();
    const range = root.ownerDocument.createRange();
    if (last) range.setStart(last, last.nodeValue.length);
    else range.selectNodeContents(root);
    range.collapse(true);
    root.ownerDocument.getSelection().removeAllRanges();
    root.ownerDocument.getSelection().addRange(range);
  });

const count = (editor, word) =>
  editor.evaluate((root, wanted) => root.textContent.split(wanted).length - 1, word);

const openEdit = (page) =>
  page.getByRole("menubar").first().getByRole("menuitem", { name: "Edit", exact: true }).click();
const editItem = (page, name) =>
  page
    .getByRole("menu")
    .getByRole("menuitem", { name: new RegExp(`^${name}`) })
    .first();
async function chooseEdit(page, name) {
  await openEdit(page);
  const entry = editItem(page, name);
  await entry.waitFor({ timeout: 5_000 });
  await entry.click();
  await page.waitForTimeout(400);
}
const pasteKeys = async (page) => {
  await page.keyboard.press("ControlOrMeta+V");
  await page.waitForTimeout(400);
};

/** Whether each family renders as itself, measured by layout (span widths against fallbacks). */
const rendersByLayout = (page, names) =>
  page.evaluate((list) => {
    const box = document.createElement("div");
    box.style.cssText = "position:absolute;left:-9999px;top:0;white-space:nowrap;font-size:48px";
    document.body.append(box);
    const width = (family) => {
      const span = document.createElement("span");
      span.textContent = "mmmmmmmmmmlli1WQ@#&";
      span.style.fontFamily = family;
      box.append(span);
      const measured = span.getBoundingClientRect().width;
      span.remove();
      return measured;
    };
    const result = {};
    for (const name of list) {
      result[name] =
        name === "System Font" ||
        ["monospace", "serif", "sans-serif"].some(
          (fallback) => width(`"${name}", ${fallback}`) !== width(fallback),
        );
    }
    box.remove();
    return result;
  }, names);

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Mail");
  const viewer = page.getByRole("button", { name: "New Message" }).first();
  await viewer.waitFor({ timeout: 15_000 });
  await viewer.click();
  await message(page).waitFor({ timeout: 10_000 });
  await composer(page).getByLabel("Subject:").fill(`Editor journey ${stamp}`);
  await message(page).click();
  await page.keyboard.type(`${COPY} and ${CUT} words`);
  const editor = message(page);

  await selectWord(editor, COPY);
  await chooseEdit(page, "Copy");
  await caretAtEnd(editor);
  await pasteKeys(page);
  step(
    "Edit > Copy puts the message's selection on the clipboard (the keyboard's Paste puts it in again)",
    (await count(editor, COPY)) === 2,
  );
  await chooseEdit(page, "Undo");
  step("Edit > Undo takes that paste back", (await count(editor, COPY)) === 1);
  await chooseEdit(page, "Redo");
  step("Edit > Redo puts it back", (await count(editor, COPY)) === 2);

  await selectWord(editor, CUT);
  await chooseEdit(page, "Cut");
  const gone = (await count(editor, CUT)) === 0;
  await caretAtEnd(editor);
  await pasteKeys(page);
  step(
    "Edit > Cut takes the selection out, and the keyboard pastes it back",
    gone && (await count(editor, CUT)) === 1,
  );

  await chooseEdit(page, "Select All");
  const all = await editor.evaluate((root) => {
    const flat = (text) => text.replace(/\s+/g, "");
    return {
      same: flat(root.ownerDocument.getSelection().toString()) === flat(root.textContent),
      keyboard: root.contains(root.ownerDocument.activeElement),
    };
  });
  step(
    "Edit > Select All selects the whole message, and the message keeps the keyboard",
    all.same && all.keyboard,
    JSON.stringify(all),
  );

  await caretAtEnd(editor);
  await openEdit(page);
  const paste = editItem(page, "Paste");
  await paste.waitFor({ timeout: 5_000 });
  if (pasteAllowed) {
    await paste.click();
    await page.waitForFunction(() => !document.querySelector('[role="menu"]'), undefined, {
      timeout: 5_000,
    });
    await page.waitForTimeout(400);
    step(
      "Edit > Paste reads the clipboard and puts it in the message",
      (await count(editor, CUT)) === 2,
    );
  } else {
    if ((await paste.getAttribute("aria-disabled")) !== "true") await paste.click();
    const reason = page.getByRole("menu").getByRole("menuitem", { name: /still pastes/ });
    await reason.waitFor({ timeout: 5_000 });
    step(
      "Edit > Paste, refused by this browser, is dimmed in the open menu, saying the keyboard still pastes",
      (await editItem(page, "Paste").getAttribute("aria-disabled")) === "true" &&
        (await count(editor, CUT)) === 1,
      await reason.innerText(),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  await shot(page, path.join(out, `mail-compose-${browserName}-edit.png`));

  // The Fonts panel: dimmed exactly where the family does not render here, with the reason.
  await selectWord(editor, COPY);
  await page.keyboard.press("ControlOrMeta+t");
  const fonts = page.getByRole("region", { name: "Fonts" }).last();
  await fonts.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  const rows = await fonts.getByRole("listbox", { name: "Family" }).evaluate((list) =>
    [...list.querySelectorAll('[role="option"]')].map((row) => ({
      name: row.textContent.trim(),
      dimmed: row.getAttribute("aria-disabled") === "true",
    })),
  );
  const renders = await rendersByLayout(
    page,
    rows.map((row) => row.name),
  );
  const disagree = rows.filter((row) => row.dimmed === renders[row.name]);
  const dimmedCount = rows.filter((row) => row.dimmed).length;
  step(
    "the Fonts panel dims exactly the families this browser does not render",
    rows.length > 0 && disagree.length === 0,
    `${rows.length - dimmedCount} render, ${dimmedCount} dimmed${disagree.length ? `; disagree: ${disagree.map((row) => row.name).join(", ")}` : ""}`,
  );
  step(
    "and says why when any is dimmed",
    dimmedCount === 0 ||
      (await fonts.getByRole("note").innerText()).includes("not installed on this computer"),
  );
  const chosen = rows.find((row) => !row.dimmed && row.name !== "System Font")?.name;
  if (chosen) {
    await fonts
      .getByRole("listbox", { name: "Family" })
      .getByRole("option", { name: chosen, exact: true })
      .click();
    await page.waitForTimeout(400);
    const computed = await editor.evaluate((root, wanted) => {
      const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeValue.includes(wanted)) return getComputedStyle(node.parentElement).fontFamily;
      }
      return "";
    }, COPY);
    step(
      `a family that renders (${chosen}), chosen there, is the selected word's computed font`,
      computed.replace(/["']/g, "").startsWith(chosen),
      computed,
    );
  }
  await shot(page, path.join(out, `mail-compose-${browserName}-fonts.png`));
});
