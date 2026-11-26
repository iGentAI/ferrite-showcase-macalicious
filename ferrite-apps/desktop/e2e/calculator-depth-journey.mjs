#!/usr/bin/env node
// Calculator at depth: Copy, Paste and Undo, by menu and keyboard, with a number copied from
// Notes. Exits 0 only when every step passed with no console error, page error or failed request.
//
//   node e2e/calculator-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("calculator-depth", {
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
      .or(page.getByRole("menuitemcheckbox", { name: item }))
      .first();
    if (index < items.length - 1) {
      await entry.hover();
      await page.waitForTimeout(250);
    } else await entry.click();
  }
  // The keyboard goes back to the window once the menu has faded out.
  await page.waitForFunction(
    () =>
      document.activeElement &&
      document.activeElement !== document.body &&
      !document.activeElement.closest('[role="menu"], [role="menubar"]'),
    undefined,
    { timeout: 5000 },
  );
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const setClipboard = (text) => page.evaluate((each) => navigator.clipboard.writeText(each), text);

  await launch(page, "Calculator");
  const window = page.locator('.mac-calculator[aria-label="Calculator"]');
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const display = window.getByRole("status", { name: "Result" });
  const shown = async () => (await display.innerText()).trim();
  const key = (name) => window.getByRole("button", { name, exact: true });
  await window.click({ position: { x: 100, y: 30 } });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Feature 1: the Edit menu, its keys and the clipboard.
  await page.keyboard.type("6*7=");
  step("keys calculate 6 × 7 = 42", (await shown()) === "42", await shown());
  await page.keyboard.press("ControlOrMeta+c");
  await page.waitForTimeout(100);
  step("Command-C copies the display", (await clipboard()) === "42", await clipboard());

  await key("All clear").or(key("Clear")).first().click();
  await key("All clear").or(key("Clear")).first().click();
  await setClipboard("1,234.5");
  await page.keyboard.press("ControlOrMeta+v");
  await page.waitForTimeout(150);
  step("Command-V pastes a number", (await shown()) === "1234.5", await shown());
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForTimeout(100);
  step("Command-Z takes the paste back", (await shown()) === "0", await shown());
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.waitForTimeout(100);
  step("Shift-Command-Z brings it back", (await shown()) === "1234.5", await shown());

  await menuBar(page, "Edit").click();
  await page.waitForTimeout(250);
  const rows = await page.getByRole("menu").last().getByRole("menuitem").allInnerTexts();
  step(
    "the Edit menu lists Calculator's commands",
    ["Undo", "Redo", "Cut", "Copy", "Paste", "Delete", "Select All"].every((name) =>
      rows.some((row) => row.startsWith(name)),
    ),
    rows.join(" | ").replaceAll("\n", " "),
  );
  await shot(page, path.join(out, "calculator-edit-menu.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  await choose(page, "Edit", "Undo");
  step("Edit > Undo works", (await shown()) === "0", await shown());
  await choose(page, "Edit", "Redo");
  step("Edit > Redo works", (await shown()) === "1234.5", await shown());
  await setClipboard("");
  await choose(page, "Edit", "Copy");
  await page.waitForTimeout(100);
  step("Edit > Copy writes the clipboard", (await clipboard()) === "1234.5", await clipboard());
  await choose(page, "Edit", "Cut");
  await page.waitForTimeout(100);
  step("Edit > Cut clears the display", (await shown()) === "0", await shown());
  await setClipboard("7");
  await choose(page, "Edit", "Paste");
  await page.waitForTimeout(200);
  step("Edit > Paste reads the clipboard", (await shown()) === "7", await shown());
  await page.keyboard.type("*6=");
  step("the keyboard is back in the window after a menu", (await shown()) === "42", await shown());
  await choose(page, "Edit", "Select All");
  const selected = await page.evaluate(() => document.getSelection()?.toString());
  step("Edit > Select All selects the number", selected === "42", selected);
  await shot(page, path.join(out, "calculator-selected.png"));
  await page.keyboard.type("c");
  await page.keyboard.press("Escape");
  await page.keyboard.type("5");
  await choose(page, "Edit", "Delete");
  step("Edit > Delete clears the display", (await shown()) === "0", await shown());

  // 77 goes to Notes, and 42 comes back from it, each by the keyboard's Copy and Paste.
  await page.keyboard.type("77");
  await page.keyboard.press("ControlOrMeta+c");
  await page.waitForTimeout(100);
  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ state: "visible" });
  await choose(page, "File", "New Note");
  await page.keyboard.press("ControlOrMeta+v");
  await page.waitForTimeout(200);
  const note = await notes.locator('[aria-label="Note"]:visible').innerText();
  step("a number copied in Calculator pastes into Notes", note.trim() === "77", note);
  await shot(page, path.join(out, "calculator-copy-to-notes.png"));
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("42");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+c");
  await page.waitForTimeout(150);
  await launch(page, "Calculator");
  await page.waitForFunction(() => document.activeElement?.closest(".mac-calculator"), undefined, {
    timeout: 5000,
  });
  await page.keyboard.press("ControlOrMeta+v");
  await page.waitForTimeout(200);
  step(
    "42 copied in Notes pastes into Calculator",
    (await shown()) === "42",
    `${await shown()}, clipboard ${await clipboard()}`,
  );
  await shot(page, path.join(out, "calculator-paste-from-notes.png"));

  // Feature 2: the View menu and what survives a reload.
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values ?? {};
  const settled = async (test) => {
    for (let i = 0; i < 40; i++) {
      const values = await stored();
      if (test(values)) return values;
      await page.waitForTimeout(250);
    }
    return stored();
  };
  if ((await stored())["calculator.separators"] === true) {
    await page.keyboard.press("ControlOrMeta+Shift+t");
  }
  await page.keyboard.press("ControlOrMeta+1");
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.type("1234567.891");
  await page.keyboard.press("Enter");
  await choose(page, "View", "Show Thousands Separators");
  step(
    "View > Show Thousands Separators groups the digits",
    (await shown()) === "1,234,567.891",
    await shown(),
  );
  await page.keyboard.press("ControlOrMeta+Shift+t");
  await page.waitForTimeout(150);
  step("Shift-Command-T turns them off", (await shown()) === "1234567.891", await shown());
  await page.keyboard.press("ControlOrMeta+Shift+t");

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  const typedPi = "3.14159265358979";
  await page.keyboard.type(typedPi);
  await page.keyboard.press("Enter");
  const places = [];
  for (let count = 0; count <= 15; count++) {
    await choose(page, "View", "Decimal Places", new RegExp(`^${count}$`));
    const expected = count === 15 ? typedPi : String(Number(Number(typedPi).toFixed(count)));
    if ((await shown()) !== expected) places.push(`${count}: ${await shown()}`);
  }
  step(
    "each of the Decimal Places 0 to 15 rounds the display",
    places.length === 0,
    places.join(", "),
  );
  await choose(page, "View", "Decimal Places", /^2$/);
  step("two places show 3.14", (await shown()) === "3.14", await shown());
  await menuBar(page, "View").click();
  await page.waitForTimeout(250);
  const radios = await page.getByRole("menu").last().getByRole("menuitemradio").allInnerTexts();
  step(
    "the View menu offers the three layouts",
    ["Basic", "Scientific", "Programmer"].every((name) =>
      radios.some((row) => row.startsWith(name)),
    ),
    radios.join(" | ").replaceAll("\n", " "),
  );
  await page.getByRole("menuitem", { name: "Decimal Places" }).hover();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "calculator-view-menu.png"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await window.click({ position: { x: 100, y: 30 } });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.type("9876.54321");
  await page.keyboard.press("Enter");
  const before = await settled((values) => values["calculator.saved"]?.value === 9876.54321);
  step(
    "the display, separators and places are saved with the desktop's values",
    before["calculator.saved"]?.value === 9876.54321 &&
      before["calculator.separators"] === true &&
      before["calculator.decimals"] === 2,
    JSON.stringify(before["calculator.saved"]),
  );
  await reloadDesktop(page);
  await launch(page, "Calculator");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    () => document.querySelector(".mac-calculator output")?.textContent === "9,876.54",
    undefined,
    { timeout: 10_000 },
  );
  step(
    "the display comes back after a reload, written the same way",
    (await shown()) === "9,876.54",
    await shown(),
  );
  await shot(page, path.join(out, "calculator-after-reload.png"));

  // Feature 3: the Scientific layout, its keys against known values, and the memory after a reload.
  await choose(page, "View", "Decimal Places", /^15$/);
  await choose(page, "View", "Show Thousands Separators");
  await choose(page, "View", "Scientific");
  const frameOf = async () => page.locator('[data-window-id="calculator"]').boundingBox();
  await window.getByRole("button", { name: "sin", exact: true }).waitFor();
  let box = await frameOf();
  step(
    "View > Scientific grows the window to take the keys",
    box.width === 580 && box.height === 321,
    `${box.width} by ${box.height}`,
  );
  await shot(page, path.join(out, "calculator-scientific.png"));
  const clear = async () => {
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  };
  const pressKeys = async (...names) => {
    for (const name of names) await key(name).click();
  };
  const science = async (typed, names, expected, label) => {
    await clear();
    await page.keyboard.type(typed);
    await pressKeys(...names);
    step(`${label} is ${expected}`, (await shown()) === expected, await shown());
  };
  await science("30", ["sin"], "0.5", "sin 30°");
  await science("60", ["cos"], "0.5", "cos 60°");
  await science("45", ["tan"], "1", "tan 45°");
  await science("12", ["x²"], "144", "12 squared");
  await science("3", ["x³"], "27", "3 cubed");
  await science("2", ["xʸ"], "2", "2 xʸ waits for its power at");
  await page.keyboard.type("10=");
  step("2 xʸ 10 = is 1024", (await shown()) === "1024", await shown());
  await science("2", ["10ˣ"], "100", "10ˣ of 2");
  await science("1", ["eˣ"], "2.71828182845905", "eˣ of 1");
  await science("4", ["1/x"], "0.25", "1/x of 4");
  await science("81", ["√x"], "9", "√81");
  await science("27", ["∛x"], "3", "∛27");
  await science("32", ["ʸ√x"], "32", "32 ʸ√x waits for its degree at");
  await page.keyboard.type("5=");
  step("the fifth root of 32 is 2", (await shown()) === "2", await shown());
  await science("1000", ["log10"], "3", "log10 of 1000");
  await science("1", ["eˣ", "ln"], "1", "ln of e");
  await science("5", ["x!"], "120", "5!");
  await science("1", ["sinh"], "1.1752011936438", "sinh 1");
  await science("1", ["cosh"], "1.54308063481524", "cosh 1");
  await science("1", ["tanh"], "0.761594155955765", "tanh 1");
  await science("", ["π"], "3.14159265358979", "π");
  await science("", ["e"], "2.71828182845905", "e");
  await clear();
  await page.keyboard.type("2");
  await key("EE").click();
  await page.keyboard.type("3=");
  step("2 EE 3 is 2000", (await shown()) === "2000", await shown());
  await clear();
  await page.keyboard.type("2*");
  await key("(").click();
  await page.keyboard.type("3+4");
  await key(")").click();
  await page.keyboard.type("=");
  step("2 × ( 3 + 4 ) is 14", (await shown()) === "14", await shown());
  await key("Rand").click();
  const random = Number(await shown());
  step("Rand gives a number from 0 to 1", random >= 0 && random < 1, await shown());

  await key("Rad").click();
  step(
    "Rad names radians on the display",
    await window.locator(".mac-calculator-angle").isVisible(),
  );
  await science("", ["π", "sin"], "0", "sin π radians");
  await key("Deg").click();
  await key("2nd").click();
  await shot(page, path.join(out, "calculator-scientific-second.png"));
  await science("1", ["sin⁻¹"], "90", "sin⁻¹ 1");
  await science("0.5", ["cos⁻¹"], "60", "cos⁻¹ 0.5");
  await science("1", ["tan⁻¹"], "45", "tan⁻¹ 1");
  await science("1", ["sinh⁻¹"], "0.881373587019543", "sinh⁻¹ 1");
  await science("1", ["cosh⁻¹"], "0", "cosh⁻¹ 1");
  await science("0.5", ["tanh⁻¹"], "0.549306144334055", "tanh⁻¹ 0.5");
  await science("8", ["log2"], "3", "log2 of 8");
  await science("10", ["2ˣ"], "1024", "2ˣ of 10");
  await science("2", ["yˣ"], "2", "2 yˣ waits for its base at");
  await page.keyboard.type("5=");
  step("2 yˣ 5 = is 25", (await shown()) === "25", await shown());
  await science("8", ["logy"], "8", "8 logy waits for its base at");
  await page.keyboard.type("2=");
  step("log of 8 to base 2 is 3", (await shown()) === "3", await shown());
  await key("2nd").click();

  await clear();
  await key("mc").click();
  await page.keyboard.type("12");
  await key("m+").click();
  await page.keyboard.type("5");
  await key("m-").click();
  await clear();
  await key("mr").click();
  step("m+, m- and mr keep 12 − 5 in the memory", (await shown()) === "7", await shown());
  await clear();
  await page.keyboard.type("55");
  const memoryKept = await settled(
    (values) =>
      values["calculator.saved"]?.memory === 7 && values["calculator.saved"]?.value === 55,
  );
  step(
    "the memory is saved with the display",
    memoryKept["calculator.saved"]?.memory === 7,
    JSON.stringify(memoryKept["calculator.saved"]),
  );
  await reloadDesktop(page);
  await launch(page, "Calculator");
  await window.getByRole("button", { name: "sin", exact: true }).waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    () => document.querySelector(".mac-calculator output")?.textContent === "55",
    undefined,
    { timeout: 10_000 },
  );
  box = await frameOf();
  step(
    "the layout and the window's size come back after a reload",
    box.width === 580 && box.height === 321,
    `${box.width} by ${box.height}`,
  );
  await key("mr").click();
  step("the memory comes back after a reload", (await shown()) === "7", await shown());
  await shot(page, path.join(out, "calculator-scientific-after-reload.png"));
  await key("mc").click();
  await page.keyboard.press("ControlOrMeta+1");
  await page.waitForTimeout(150);
  box = await frameOf();
  step("Command-1 goes back to the basic window", box.width === 232 && box.height === 321);

  // Feature 4: the Programmer layout, 64 bits exact, its bases, bits, logic and shifts.
  await clear();
  await page.keyboard.type("65");
  await choose(page, "View", "Programmer");
  await key("Base 16").waitFor();
  box = await frameOf();
  step(
    "View > Programmer sizes the window and carries the number in",
    box.width === 412 && box.height === 402 && (await shown()) === "65",
    `${box.width} by ${box.height}, ${await shown()}`,
  );
  await key("Base 16").click();
  step("Base 16 shows 65 as 0x41", (await shown()) === "0x41", await shown());
  await key("ASCII").click();
  const character = window.getByRole("status", { name: "Character" });
  step("ASCII shows A", (await character.innerText()).trim() === "A");
  await shot(page, path.join(out, "calculator-programmer.png"));
  await key("Base 8").click();
  step("Base 8 shows 101", (await shown()) === "101", await shown());
  await key("Base 10").click();
  step("Base 10 shows 65", (await shown()) === "65", await shown());
  await key("Base 16").click();
  await key("Unicode").click();
  await key("All clear").click();
  await page.keyboard.type("263a");
  step("Unicode shows ☺", (await character.innerText()).trim() === "☺");
  await key("Unicode").click();
  await window.click({ position: { x: 100, y: 30 } });
  await page.keyboard.press("Escape");
  await page.keyboard.type("abc");
  step("letter keys type hexadecimal digits", (await shown()) === "0xABC", await shown());

  const bits = async (typed, names, expected, label) => {
    await key("All clear").click();
    await page.keyboard.type(typed);
    for (const name of names) await key(name).click();
    step(`${label} is ${expected}`, (await shown()) === expected, await shown());
  };
  const logic = async (left, name, right, expected) => {
    await bits(left, [name], left.toUpperCase().replace(/^/, "0x"), `0x${left} ${name} waits at`);
    await page.keyboard.type(`${right}=`);
    step(
      `0x${left} ${name} 0x${right} is ${expected}`,
      (await shown()) === expected,
      await shown(),
    );
  };
  await logic("ff", "AND", "f", "0xF");
  await logic("f0", "OR", "f", "0xFF");
  await logic("f0", "NOR", "f", "0xFFFFFFFFFFFFFF00");
  await logic("ff", "XOR", "f", "0xF0");
  await logic("1", "X<<Y", "8", "0x100");
  await logic("100", "X>>Y", "8", "0x1");
  await bits("1", ["<<"], "0x2", "<< of 1");
  await bits("3", [">>"], "0x1", ">> of 3");
  await bits("1234", ["Byte Flip"], "0x3412000000000000", "Byte Flip of 0x1234");
  await bits("1234", ["Word Flip"], "0x1234000000000000", "Word Flip of 0x1234");
  await bits("8000000000000000", ["RoL"], "0x1", "RoL of the top bit");
  await bits("1", ["RoR"], "0x8000000000000000", "RoR of 1");
  await bits("1", ["2's"], "0xFFFFFFFFFFFFFFFF", "2's complement of 1");
  await bits("f0", ["1's"], "0xFFFFFFFFFFFFFF0F", "1's complement of 0xF0");
  await key("All clear").click();
  for (const name of ["A", "B", "C", "D", "E", "F"]) await key(name).click();
  step("the keys A to F type hexadecimal", (await shown()) === "0xABCDEF", await shown());
  await key("All clear").click();
  await key("FF").click();
  await key("00").click();
  step("the keys FF and 00 type two digits", (await shown()) === "0xFF00", await shown());

  await key("All clear").click();
  await key("Bit 63").click();
  await key("Bit 0").click();
  step(
    "the bit field sets bits 63 and 0, exactly",
    (await shown()) === "0x8000000000000001",
    await shown(),
  );
  await shot(page, path.join(out, "calculator-programmer-bits.png"));
  await page.keyboard.press("ControlOrMeta+c");
  await page.waitForTimeout(100);
  step("Copy gives the number in the base shown", (await clipboard()) === "0x8000000000000001");
  const exact = await settled(
    (values) => values["calculator.saved"]?.programmer === "9223372036854775809",
  );
  step(
    "the 64-bit number is saved in full",
    exact["calculator.saved"]?.programmer === "9223372036854775809" &&
      exact["calculator.saved"]?.base === 16,
    JSON.stringify(exact["calculator.saved"]),
  );
  await reloadDesktop(page);
  await launch(page, "Calculator");
  await key("Base 16").waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    () => document.querySelector(".mac-calculator output")?.textContent === "0x8000000000000001",
    undefined,
    { timeout: 10_000 },
  );
  step(
    "the layout, the base and all 64 bits come back after a reload",
    (await key("Bit 63").getAttribute("aria-pressed")) === "true",
    await shown(),
  );
  await shot(page, path.join(out, "calculator-programmer-after-reload.png"));
  await key("All clear").click();
  await key("Base 10").click();
  await choose(page, "View", "Basic");
  box = await frameOf();
  step("View > Basic comes back from Programmer", box.width === 232 && box.height === 321);
});
