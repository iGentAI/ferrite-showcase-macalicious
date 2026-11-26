#!/usr/bin/env node
// Keyboard on a served desktop: a text replacement added in the Text tab is still there after a reload, and
// typing its word and a space in TextEdit gives the replacement and one undo takes it back, but not in Terminal,
// whose text turns spelling off. Shortcuts lists the keys and the other tabs say what is true of a web page.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/keyboard-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("keyboard");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;

await run({}, {}, async ({ person }) => {
  const a = await person("ana", { name: `kbana-${id}`, fullName: `Ana ${id}`, password });
  await person("other", { name: `kbother-${id}`, fullName: `Other ${id}`, password });
  await openFromDock(a, "System Preferences");
  const window = a.locator('[data-window-id="system-preferences"]');
  await window
    .getByRole("button", { name: /^Keyboard/ })
    .first()
    .click();
  await window.getByRole("tab", { name: "Text" }).click();
  await window.getByRole("textbox", { name: "Replace" }).fill("brb");
  await window.getByRole("textbox", { name: "With" }).fill("be right back");
  await window.getByRole("button", { name: "Add", exact: true }).click();
  const table = window.getByRole("grid", { name: "Text replacements" });
  await table.getByText("be right back").waitFor();
  step("a replacement is added to the list", (await table.getByText("On my way!").count()) === 1);
  await shot(a, "keyboard-text");

  await window.getByRole("tab", { name: "Shortcuts" }).click();
  const shortcuts = window.getByRole("grid", { name: "Keyboard shortcuts" });
  await shortcuts.getByText("Force Quit…").waitFor();
  step("Shortcuts lists the desktop's keys", (await shortcuts.getByText("⌥⌘⎋").count()) === 1);
  await shot(a, "keyboard-shortcuts");
  await window.getByRole("tab", { name: "Input Sources" }).click();
  step(
    "Input Sources says what a page can say",
    await window.getByText(/cannot add or switch input sources/).isVisible(),
  );
  await window.getByRole("tab", { name: "Dictation" }).click();
  step(
    "Dictation says what a page can say",
    await window.getByText(/Edit > Start Dictation types what/).isVisible(),
  );

  await a.reload();
  await a.locator(".mac-desktop-shell-menu-bar").waitFor();
  const fromDock = async (name, id) => {
    await a
      .getByRole("button", { name: new RegExp(`^${name}$`) })
      .first()
      .click();
    await a.locator(`[data-window-id^="${id}"]`).first().waitFor({ timeout: 10_000 });
  };
  await fromDock("TextEdit", "textedit");
  await a.waitForFunction(() => {
    const body = document.querySelector(".mac-textedit-body");
    return body && !body.hasAttribute("inert");
  });
  const page = a.locator(".mac-textedit").getByRole("textbox", { name: "Document" }).first();
  await page.click();
  await a.keyboard.type(" brb soon, omw ");
  const typed = await within(3_000, async () =>
    (await page.innerText()).replace(/\s+/g, " ").includes("be right back soon, On my way!"),
  );
  step(
    "typing the words in TextEdit replaces them, after a reload",
    typed !== null,
    await page.innerText(),
  );
  await a.keyboard.press("ControlOrMeta+z");
  const undone = await within(3_000, async () => (await page.innerText()).includes("omw"));
  step("one undo takes the replacement back", undone !== null, await page.innerText());

  const typing = async (keys) => {
    await a.keyboard.press("ControlOrMeta+a");
    await a.keyboard.press("Delete");
    for (const key of keys) {
      if (key.startsWith("press:")) await a.keyboard.press(key.slice(6));
      else await a.keyboard.type(key);
    }
    await a.waitForTimeout(100);
    return page.innerText();
  };
  const BOLD = "press:ControlOrMeta+b";
  const cases = [
    ["a word typed in two styles is replaced", ["om", BOLD, "w "], true],
    ["a word running on from a letter in another style stays", ["x", BOLD, "omw "], false],
    ["a word beginning a styled run in mid-line is replaced", ["hello ", BOLD, "omw "], true],
    ["a word at the start of a later line is replaced", ["x", "press:Enter", "omw "], true],
    ["a word running on from a letter stays", ["xomw "], false],
    ["a word after punctuation is replaced", ["ordinary (omw "], true],
    ["a word after whitespace in its own text is replaced", ["ordinary omw "], true],
    ["a word alone at the start of the document is replaced", ["omw "], true],
    ["a word in a styled sentence is replaced", [BOLD, "hello omw "], true],
  ];
  for (const [name, keys, replaced] of cases) {
    const after = await typing(keys);
    step(name, after.includes("On my way!") === replaced, after);
  }
  for (const mark of ['"', "—", "。", "/"]) {
    await a.keyboard.press("ControlOrMeta+a");
    await a.keyboard.press("Delete");
    await a.keyboard.type(` omw${mark}`);
    const replaced = await within(3_000, async () =>
      (await page.innerText()).includes("On my way!"),
    );
    step(`a word followed by ${mark} is replaced`, replaced !== null, await page.innerText());
  }
  await fromDock("Terminal", "terminal");
  const terminal = a.locator('[data-window-id^="terminal"] textarea').first();
  await terminal.focus();
  await a.keyboard.type("omw ");
  const screen = a.locator('[data-window-id^="terminal"]');
  await screen.getByText(/omw/).first().waitFor({ timeout: 3_000 });
  step("Terminal keeps what was typed", (await screen.getByText("On my way!").count()) === 0);

  await fromDock("System Preferences", "system-preferences");
  const field = window.getByRole("searchbox").or(window.getByRole("combobox")).first();
  await field.fill("𠀀omw");
  await a.keyboard.type(" ");
  step(
    "in a text field a word running on from any letter stays",
    (await field.inputValue()) === "𠀀omw ",
    await field.inputValue(),
  );
  await field.fill("omw");
  await a.keyboard.type(" ");
  const inField = await within(3_000, async () => (await field.inputValue()) === "On my way! ");
  step("in a text field a word is replaced", inField !== null, await field.inputValue());
  for (const mark of ["+", "€", "😀"]) {
    await field.fill("");
    await a.keyboard.type(`omw${mark}`);
    step(
      `in a text field ${mark} does not replace`,
      (await field.inputValue()) === `omw${mark}`,
      await field.inputValue(),
    );
  }
});
