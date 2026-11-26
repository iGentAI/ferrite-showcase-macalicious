#!/usr/bin/env node
// Keyboard's rows on the served desktop. What belongs to the computer (Key Repeat, Delay Until Repeat, the backlight, the Touch Bar,
// Fn and Control Strip settings, and the three buttons) is dimmed with its reason and says it shows Catalina's defaults. The viewers'
// check box puts a menu extra in the menu bar that opens the desktop's character viewer. Text replacements typed in TextEdit are
// replaced in every shape a word can have in rich text, and one undo takes one back, after a reload. Input Sources and Dictation say
// what the browser really reports. Exits 0 only when every step passed with no console error, page error, failed request or HTTP
// error.
//
//   node e2e/sp-keyboard-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const REASON = "A web page can neither read nor change how your keyboard works.";

await journey("sp-keyboard-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const tabs = prefs.getByRole("tablist", { name: "Keyboard" });
  const openPane = async () => {
    await page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(700);
    if ((await tabs.count()) === 0) {
      await prefs.getByRole("button", { name: "Keyboard", exact: true }).first().click();
    }
    await tabs.waitFor({ timeout: 8_000 });
    await prefs.getByRole("tab", { name: "Keyboard", exact: true }).click();
  };
  await openPane();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "keyboard-pane.png") });

  for (const name of ["Key Repeat", "Delay Until Repeat"]) {
    const slider = prefs.getByRole("slider", { name });
    step(`${name} is dimmed`, await slider.isDisabled());
  }
  for (const name of [
    "Adjust keyboard brightness in low light",
    "Turn keyboard backlight off after",
    "Show Control Strip",
  ]) {
    const box = prefs.getByRole("checkbox", { name });
    step(
      `${name} is dimmed with the reason`,
      (await box.isDisabled()) && (await box.getAttribute("title")) === REASON,
    );
  }
  for (const name of ["Turn keyboard backlight off after", "Touch Bar shows", "Press Fn key to"]) {
    const choice = prefs.getByRole("combobox", { name });
    step(
      `${name}'s pop-up is dimmed with the reason`,
      (await choice.isDisabled()) && (await choice.getAttribute("title")) === REASON,
    );
  }
  for (const name of ["Customize Control Strip…", "Modifier Keys…", "Set Up Bluetooth Keyboard…"]) {
    const button = prefs.getByRole("button", { name });
    step(
      `${name} is dimmed with the reason`,
      (await button.isDisabled()) && (await button.getAttribute("title")) === REASON,
    );
  }
  step(
    "the pane says the dimmed values are not this computer's",
    await prefs.getByText(/show Catalina's defaults, not this computer's/).isVisible(),
  );

  // The character viewer, offered from the menu bar.
  const viewers = prefs.getByRole("checkbox", {
    name: "Show keyboard and emoji viewers in menu bar",
  });
  const extra = page.locator('[aria-label="Viewers"]');
  step("the viewers are not in the menu bar at first", (await extra.count()) === 0);
  let saved = nextSave(page, SETTINGS, (body) => body?.values?.["keyboard.showViewers"] === true);
  await viewers.click();
  await saved;
  await extra.waitFor({ timeout: 5_000 });
  step("Show keyboard and emoji viewers puts them there", true);
  await extra.click();
  const keyboardViewer = page.getByRole("menuitem", { name: "Keyboard Viewer" });
  await keyboardViewer.waitFor({ timeout: 5_000 });
  step(
    "Keyboard Viewer is dimmed: the desktop draws none",
    (await keyboardViewer.getAttribute("aria-disabled")) === "true",
  );
  await page.screenshot({ path: path.join(out, "keyboard-viewers-extra.png") });
  await page.getByRole("menuitem", { name: "Emoji & Symbols" }).click();
  const characters = page.getByRole("dialog", { name: "Characters" });
  await characters.waitFor({ timeout: 5_000 });
  step("its Emoji & Symbols opens the character viewer", true);
  await characters.getByRole("button", { name: "Close" }).click();

  // Text replacements.
  await prefs.getByRole("tab", { name: "Text", exact: true }).click();
  await prefs.getByRole("textbox", { name: "Replace" }).fill("brb");
  await prefs.getByRole("textbox", { name: "With" }).fill("be right back");
  saved = nextSave(page, SETTINGS, (body) =>
    Array.isArray(body?.values?.["keyboard.replacements"]),
  );
  await prefs.getByRole("button", { name: "Add", exact: true }).click();
  await saved;
  const table = prefs.getByRole("grid", { name: "Text replacements" });
  await table.getByText("be right back").waitFor({ timeout: 5_000 });
  step("a replacement is added under the list", true);

  await prefs.getByRole("tab", { name: "Input Sources" }).click();
  const languages = await page.evaluate(() => navigator.languages.join(", "));
  step(
    "Input Sources says a page cannot switch them, and gives the browser's languages",
    await prefs
      .getByText(new RegExp(`cannot add or switch input sources.*${languages}`))
      .isVisible(),
    languages,
  );
  await prefs.getByRole("tab", { name: "Dictation" }).click();
  const speech = await page.evaluate(
    () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
  );
  step(
    "Dictation says whether this browser offers speech recognition",
    await prefs
      .getByText(`This browser ${speech ? "offers" : "does not offer"} speech recognition`)
      .isVisible(),
    `${speech}`,
  );
  await page.screenshot({ path: path.join(out, "keyboard-dictation.png") });

  await reloadDesktop(page);
  await extra.waitFor({ timeout: 10_000 });
  step("after a reload the viewers are still in the menu bar", true);

  await page
    .getByRole("button", { name: /^TextEdit$/ })
    .first()
    .click();
  await page.waitForFunction(() => {
    const body = document.querySelector(".mac-textedit-body");
    return body && !body.hasAttribute("inert");
  });
  const sheet = page.locator(".mac-textedit").getByRole("textbox", { name: "Document" }).first();
  await sheet.click();
  await page.keyboard.type("brb soon ");
  await page.waitForTimeout(100);
  step(
    "a replacement added before the reload works after it",
    (await sheet.innerText()).includes("be right back soon"),
    await sheet.innerText(),
  );

  const BOLD = "press:ControlOrMeta+b";
  const typing = async (keys) => {
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
    for (const key of keys) {
      if (key.startsWith("press:")) await page.keyboard.press(key.slice(6));
      else await page.keyboard.type(key);
    }
    await page.waitForTimeout(100);
    return sheet.innerText();
  };
  const cases = [
    ["a word typed in two styles is replaced", ["om", BOLD, "w ", BOLD], "On my way!"],
    [
      "a word beginning a styled run is replaced",
      ["hello ", BOLD, "omw ", BOLD],
      "hello On my way!",
    ],
    [
      "a word at the start of a later line is replaced",
      ["x", "press:Enter", "omw "],
      "x On my way!",
    ],
    ["a word after punctuation is replaced", ["ordinary (omw "], "ordinary (On my way!"],
    ["a word alone at the start of the document is replaced", ["omw "], "On my way!"],
    ["a word running on from a letter stays", ["xomw "], "xomw"],
    ["a word running on from a letter in another style stays", ["x", BOLD, "omw ", BOLD], "xomw"],
    ["a word in a line above the caret is not touched", ["omw", "press:Enter", "ok "], "omw ok"],
  ];
  const words = (text) => text.replace(/\s+/g, " ").trim();
  for (const [name, keys, expected] of cases) {
    const after = await typing(keys);
    step(name, words(after) === expected, JSON.stringify(after));
  }
  // A word typed across anything that is not styled text stays, with what it runs across.
  for (const [what, html, selector] of [
    [
      "an embedded picture",
      '<img alt="" width="8" height="8" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">',
      "img",
    ],
    ["a meter", '<meter value="0.5"></meter>', "meter"],
    ["a progress bar", '<progress value="0.5"></progress>', "progress"],
  ]) {
    await typing([]);
    // Set out as the word and what stands in it, with the caret after it: then only the space is typed.
    await page.evaluate((markup) => {
      const host = document.activeElement;
      host.innerHTML = `<div>om${markup}w</div>`;
      const caret = document.createRange();
      caret.setStart(host.firstChild.lastChild, 1);
      caret.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(caret);
    }, html);
    await page.keyboard.type(" ");
    await page.waitForTimeout(100);
    const across = await sheet.innerText();
    step(
      `a word running across ${what} stays, with it`,
      words(across) === "omw" && (await sheet.locator(selector).count()) === 1,
      JSON.stringify(across),
    );
  }
  await typing(["om", BOLD, "w ", BOLD]);
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(150);
  const undone = await sheet.innerText();
  step("one undo takes the replacement back", words(undone) === "omw", JSON.stringify(undone));
  await page.screenshot({ path: path.join(out, "keyboard-textedit.png") });

  await openPane();
  saved = nextSave(page, SETTINGS, (body) => body?.values?.["keyboard.showViewers"] === false);
  await viewers.click();
  await saved;
  await extra.waitFor({ state: "detached", timeout: 5_000 });
  step("turned off, the viewers leave the menu bar", true);
});
