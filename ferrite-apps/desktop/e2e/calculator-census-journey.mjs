#!/usr/bin/env node
// Calculator's Convert menu, RPN Mode, Speech and the paper tape's file commands, by menu and key on a served desktop.
// Exits 0 only when every step passed with no console error, page error or failed request. Speech calls the browser's real
// speechSynthesis through a wrapper that records what it was asked to say; a sandbox browser may have no voice to hear.
//
//   node e2e/calculator-census-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("calculator-census");

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const row = (page, item) => {
  const menu = page.getByRole("menu").last();
  return menu
    .getByRole("menuitem", { name: item })
    .or(menu.getByRole("menuitemcheckbox", { name: item }))
    .first();
};
async function open(page, title) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
}
async function choose(page, title, ...items) {
  await open(page, title);
  for (const [index, item] of items.entries()) {
    if (index < items.length - 1) {
      await row(page, item).hover();
      await page.waitForTimeout(350);
    } else await row(page, item).click();
  }
  await page.waitForTimeout(250);
}
async function pick(page, sheet, label, option) {
  await sheet.getByRole("combobox", { name: label }).click();
  await page.waitForTimeout(150);
  await page.getByRole("option", { name: option, exact: true }).click();
  await page.waitForTimeout(150);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Calculator");
  const window = page.locator('.mac-calculator[aria-label="Calculator"]');
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const display = window.getByRole("status", { name: "Result" });
  const shown = async () => (await display.innerText()).trim();
  const key = (name) => window.getByRole("button", { name, exact: true });
  const stack = () => window.getByRole("group", { name: "Stack" }).innerText();
  const focus = async () => {
    await window.click({ position: { x: 100, y: 30 } });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  };
  await focus();

  // Convert.
  await page.keyboard.type("1");
  await choose(page, "Convert", "Length…");
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ timeout: 5000 });
  await pick(page, sheet, "From", "Inches");
  await pick(page, sheet, "To", "Centimeters");
  await shot(page, path.join(out, "calculator-convert-sheet.png"));
  const windowBox = await window.boundingBox();
  const sheetBox = await sheet.boundingBox();
  step(
    "the Convert sheet hangs from the window's top, centred on it",
    Math.abs(sheetBox.y - (windowBox.y + 22)) <= 2 &&
      Math.abs(sheetBox.x + sheetBox.width / 2 - (windowBox.x + windowBox.width / 2)) <= 2,
    JSON.stringify({ windowBox, sheetBox }),
  );
  await sheet.getByRole("button", { name: "Convert", exact: true }).click();
  await page.waitForTimeout(300);
  step("Length converts 1 inch to 2.54 centimeters", (await shown()) === "2.54", await shown());
  await page.keyboard.press("ControlOrMeta+z");
  step(
    "Undo takes the conversion back, with the keyboard back on the window",
    (await shown()) === "1",
    await shown(),
  );

  await choose(page, "Convert", "Temperature…");
  await sheet.waitFor({ timeout: 5000 });
  await pick(page, sheet, "From", "Celsius");
  await pick(page, sheet, "To", "Fahrenheit");
  await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForTimeout(300);
  step("Cancel converts nothing", (await shown()) === "1", await shown());

  await page.keyboard.type("00");
  await choose(page, "Convert", "Recent Conversions", "Length: Inches to Centimeters");
  step("Recent Conversions repeats one without a sheet", (await shown()) === "254", await shown());

  await open(page, "Convert");
  const currency = row(page, "Currency…");
  step(
    "Currency is there to choose on a served desktop",
    (await currency.getAttribute("aria-disabled")) !== "true",
  );
  await shot(page, path.join(out, "calculator-convert-menu.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // RPN Mode.
  await focus();
  await choose(page, "View", "RPN Mode");
  await page.waitForTimeout(300);
  const tall = await window.boundingBox();
  step("RPN Mode makes room for its row of keys", tall.height === 352, String(tall.height));
  await focus();
  await page.keyboard.type("3");
  await page.keyboard.press("Enter");
  await page.keyboard.type("4");
  step("Enter pushes X", (await stack()).replace(/\s+/g, " ").includes("Y 3"), await stack());
  await shot(page, path.join(out, "calculator-rpn.png"));
  await page.keyboard.type("*");
  step("An operator takes Y and X", (await shown()) === "12", await shown());
  await page.keyboard.type("5");
  await key("Swap X and Y").click();
  step("x↔y swaps", (await shown()) === "12", await shown());
  await key("Roll down").click();
  step("R↓ rolls down", (await shown()) === "5", await shown());
  await key("Roll up").click();
  step("R↑ rolls up", (await shown()) === "12", await shown());
  await key("Drop").click();
  step("drop drops", (await shown()) === "5", await shown());
  await page.keyboard.press("ControlOrMeta+2");
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "calculator-rpn-scientific.png"));
  await page.keyboard.press("ControlOrMeta+3");
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "calculator-rpn-programmer.png"));
  step("Programmer has the stack keys too", await key("Drop").isVisible());
  await page.keyboard.press("ControlOrMeta+1");
  await page.waitForTimeout(300);

  await page.waitForTimeout(500);
  await reloadDesktop(page, base, step);
  await launch(page, "Calculator");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(500);
  step("RPN Mode survives a reload", await window.getByText("RPN", { exact: true }).isVisible());
  await open(page, "Convert");
  await row(page, "Recent Conversions").hover();
  await page.waitForTimeout(350);
  step(
    "Recent Conversions survives a reload",
    await row(page, "Length: Inches to Centimeters").isVisible(),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await focus();
  await page.keyboard.press("ControlOrMeta+r");
  await page.waitForTimeout(300);
  step(
    "Command-R goes back, without reloading the page",
    (await window.getByText("RPN", { exact: true }).count()) === 0,
  );

  // Speech.
  await page.evaluate(() => {
    window.__said = [];
    const speak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = (utterance) => {
      window.__said.push(utterance.text);
      speak(utterance);
    };
  });
  const said = () => page.evaluate(() => window.__said);
  await choose(page, "Speech", "Speak Result");
  await choose(page, "Speech", "Speaking Button Pressed");
  await focus();
  await key("2").click();
  await key("Add").click();
  await page.keyboard.type("2");
  await page.keyboard.type("=");
  await page.waitForTimeout(200);
  const spoken = await said();
  step(
    "Speech says the keys, then the result",
    JSON.stringify(spoken.slice(-5)) === JSON.stringify(["2", "Add", "2", "Equals", "4"]),
    spoken.join(" | "),
  );
  await choose(page, "Speech", "Speak Result");
  await choose(page, "Speech", "Speaking Button Pressed");
  await choose(page, "Edit", "Speech", "Start Speaking");
  step("Edit > Speech says the display", (await said()).at(-1) === "4", (await said()).at(-1));
  await choose(page, "Edit", "Speech", "Stop Speaking");

  // The paper tape.
  const tape = page.locator('.mac-calculator-tape[aria-label="Paper Tape"]');
  await focus();
  step("The tape is closed after calculations nobody asked it to show", (await tape.count()) === 0);
  await page.keyboard.press("ControlOrMeta+t");
  await page.waitForTimeout(300);
  const shownByKey = (await tape.count()) === 1;
  await page.keyboard.press("ControlOrMeta+t");
  await page.waitForTimeout(300);
  step("Command-T shows and hides the tape", shownByKey && (await tape.count()) === 0);
  await choose(page, "Window", "Show Paper Tape");
  await page.waitForTimeout(300);
  step("Window > Show Paper Tape shows the tape", (await tape.count()) === 1);
  await focus();

  await open(page, "File");
  const pageSetup = row(page, "Page Setup…");
  step(
    "Page Setup is dimmed and says why",
    (await pageSetup.getAttribute("aria-disabled")) === "true" &&
      /print dialog/.test((await pageSetup.getAttribute("title")) ?? ""),
  );
  await shot(page, path.join(out, "calculator-file-menu.png"));
  // The frame leaves as soon as the print is over, which a headless browser reaches at once.
  await page.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.__printed = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await row(page, "Print Tape…").click();
  await page.waitForTimeout(400);
  const printed = await page.evaluate(() => window.__printed ?? "");
  step("Print Tape gives the print frame the tape", printed.includes("= 4"), printed.slice(-120));

  await page.keyboard.press("ControlOrMeta+Shift+s");
  const save = page.getByRole("dialog", { name: "Save Tape As" });
  await save.waitFor({ timeout: 5000 });
  await shot(page, path.join(out, "calculator-save-tape.png"));
  const name = `Tape ${Date.now()}.txt`;
  await save.getByRole("textbox").first().fill(name);
  await save.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(800);
  const drive = await api(page, "GET", "/api/files");
  const entries = drive.json?.entries ?? [];
  const file = entries.find((entry) => entry.name === name);
  step("Save Tape As puts a file on the drive", !!file, `${name}: ${drive.status}`);
  if (file) {
    const text = await page.evaluate(
      ({ id, version }) =>
        fetch(
          `/api/files/content/${encodeURIComponent(id)}?piece=0&count=1&version=${version}`,
        ).then((reply) => reply.text()),
      { id: file.id, version: file.version ?? 0 },
    );
    step("The saved file holds the tape", text.includes("= 4"), text.slice(-40));
  }
});
