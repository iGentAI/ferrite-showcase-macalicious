#!/usr/bin/env node
// Terminal's window on a served desktop, an account made at the login window, the real mouse and keys: Preferences from
// the Terminal menu and what a profile does to a window; the Inspector, Edit Title and Print; New Command; Export Text As
// read back from the drive; a real reload that brings back windows, tabs, title, folder, scrollback and history; a file
// dragged from Finder that types its path; and a `.command` opened from Finder.
//
//   node e2e/terminal-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium [--out dir]

import {
  census,
  createAccount,
  managedOf,
  menuItem,
  menuOpen,
  moveTo,
  openFromDock,
  person,
} from "./r2-census-kit.mjs";

const V = "terminal-census-journey.mjs";
const row = (id, role, name, how, expected, extra = {}) => ({
  id: `terminal.${id}`,
  app: "terminal",
  window_or_state: "window:Terminal",
  role,
  name,
  how_reached: how,
  expected_outcome: expected,
  verified_by: `${V} ${id}`,
  persists: "none",
  notes: "",
  ...extra,
});

const rows = [
  row(
    "preferences",
    "menuitem",
    "Preferences…",
    "Terminal > Preferences…",
    "the window opens with General, Profiles, Window Groups and Encodings",
  ),
  row(
    "profile.default",
    "button",
    "Default",
    "Profiles, Ocean, Default; Shell > New Window",
    "the new window has Ocean's colours",
    { persists: "account" },
  ),
  row(
    "inspector",
    "menuitem",
    "Edit Title",
    "Shell > Edit Title, typed",
    "the Inspector opens at the title, and the window takes it",
  ),
  row(
    "new-command",
    "menuitem",
    "New Command…",
    "Shell > New Command…, typed, Run",
    "a new window runs the command",
  ),
  row(
    "export-text",
    "menuitem",
    "Export Text As…",
    "Shell > Export Text As…, Save",
    "the file on the drive holds the screen's text",
    { persists: "account" },
  ),
  row(
    "reload",
    "window",
    "Terminal",
    "a tab, a folder, a title and a line, then a reload",
    "windows, tabs, title, folder, scrollback and history come back",
    { persists: "account" },
  ),
  row(
    "drop",
    "window",
    "Terminal",
    "a file dragged from Finder on the screen",
    "its escaped path is at the prompt",
  ),
  row(
    "command-file",
    "file",
    ".command",
    "a .command file double-clicked in Finder",
    "a new window runs it and its shell ends",
  ),
];

await census("terminal", rows, async ({ base, out, run, newPage, check }) => {
  const page = await newPage("terminal");
  page.setDefaultTimeout(12_000);
  const shot = (name) => page.screenshot({ path: `${out}/terminal-${name}.png` });
  const who = person(run, "terminal", `Terminal ${run}`);
  await createAccount(page, base, who);
  const stamp = `t${run}`;
  const term = await openFromDock(page, "Terminal", "terminal");
  const log = (win) => win.getByRole("log", { name: "Terminal output" }).first();
  await log(term).getByText("%").first().waitFor();
  const type = async (line) => {
    await page.keyboard.type(line);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  };
  const choose = async (menu, item) => {
    const open = await menuOpen(page, menu);
    await menuItem(open, item).click();
    await page.waitForTimeout(300);
  };
  const windows = () => page.locator(".mac-terminal");

  await choose("Terminal", "Preferences…");
  const prefs = managedOf(page, "terminal:settings");
  await prefs.waitFor();
  const panes = ["General", "Profiles", "Window Groups", "Encodings"];
  let shown = true;
  for (const name of panes) {
    shown &&= await prefs.getByRole("tab", { name, exact: true }).isVisible();
  }
  check("terminal.preferences", shown);
  await shot("preferences-general");

  await prefs.getByRole("tab", { name: "Profiles", exact: true }).click();
  await prefs.getByRole("option", { name: "Ocean", exact: true }).click();
  await page.waitForTimeout(300);
  await shot("preferences-profiles");
  await prefs.getByRole("button", { name: "Default", exact: true }).click();
  await prefs.getByRole("button", { name: "Close" }).first().click();
  await term.click({ position: { x: 200, y: 100 } });
  await choose("Shell", "New Window");
  await page.waitForTimeout(500);
  const background = await windows()
    .last()
    .evaluate((element) => element.style.getPropertyValue("--_background"));
  check("terminal.profile.default", background === "#224fbc", background);
  await shot("ocean-window");
  await choose("Shell", "Close Window");

  await term.click({ position: { x: 200, y: 100 } });
  await choose("Shell", "Edit Title");
  const inspector = managedOf(page, "terminal:inspector");
  await inspector.waitFor();
  await page.keyboard.type(`Named ${stamp}`);
  await page.waitForTimeout(300);
  await shot("inspector");
  check(
    "terminal.inspector",
    (await page.getByRole("region", { name: new RegExp(`^Named ${stamp}`) }).count()) > 0,
  );
  await inspector.getByRole("button", { name: "Close" }).first().click();

  await term.click({ position: { x: 200, y: 100 } });
  await choose("Shell", "New Command…");
  await page.getByRole("textbox", { name: "Command", exact: true }).fill(`echo ran-${stamp}`);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForTimeout(800);
  check(
    "terminal.new-command",
    (await windows().count()) === 2 &&
      (await log(windows().last()).innerText()).split(`ran-${stamp}`).length >= 3,
  );
  await choose("Shell", "Close Window");

  await term.click({ position: { x: 200, y: 100 } });
  await type(`echo line-${stamp}`);
  await choose("Shell", "Export Text As…");
  const name = `export-${stamp}`;
  const field = page.getByRole("textbox", { name: /Save As/ }).first();
  await field.fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(1200);
  await type(`grep -c line-${stamp} ~/Documents/${name}.txt && echo found-${stamp}`);
  await page.waitForTimeout(800);
  check("terminal.export-text", (await log(term).innerText()).split(`found-${stamp}`).length >= 3);

  await term.click({ position: { x: 200, y: 100 } });
  await type("cd Documents");
  await choose("Shell", "New Tab");
  await type(`echo second-${stamp}`);
  await page.waitForTimeout(2200);
  await page.reload({ waitUntil: "load" });
  const back = managedOf(page, "terminal");
  await back.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  const tabs = await back.getByRole("tab").count();
  const second = await log(back).innerText();
  await back.getByRole("tab").first().click();
  await page.waitForTimeout(300);
  const firstTab = await log(back).innerText();
  await shot("restored");
  const title = await page.getByRole("region", { name: new RegExp(`^Named ${stamp}`) }).count();
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  const recalled = await log(back).innerText();
  check(
    "terminal.reload",
    tabs === 2 &&
      second.includes(`second-${stamp}`) &&
      firstTab.includes(`line-${stamp}`) &&
      firstTab.includes("Restored session:") &&
      /Documents %/.test(firstTab) &&
      title > 0 &&
      recalled.trimEnd().endsWith(`echo second-${stamp}`),
    `tabs ${tabs}, title ${title}`,
  );

  // The line recalled above stays unsent; Control-U clears it, as zsh's kill-whole-line.
  await page.keyboard.press("Control+u");
  const fileName = `drop ${stamp}.txt`;
  await type(`touch ~/Documents/'${fileName}'`);
  await type(`echo 'echo ran-file-${stamp}' > ~/Documents/run-${stamp}.command`);
  await page.waitForTimeout(800);
  await moveTo(page, back, 700, 60);
  const finder = await openFromDock(page, "Finder", "finder");
  await moveTo(page, finder, 20, 60);
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const icon = finder.getByRole("option", { name: fileName, exact: true }).first();
  await icon.waitFor();
  const from = await icon.boundingBox();
  const to = await back.locator(".mac-terminal-body").boundingBox();
  // The right of the screen: Finder, in front, covers its left.
  const into = { x: to.x + to.width - 40, y: to.y + to.height / 2 };
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y + from.height / 2 + 25, { steps: 5 });
  await page.mouse.move(into.x, into.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const dropped = await log(back).innerText();
  check(
    "terminal.drop",
    dropped.includes(`Documents/drop\\ ${stamp}.txt`),
    dropped.split("\n").at(-1) ?? "",
  );

  await finder
    .getByRole("option", { name: `run-${stamp}.command`, exact: true })
    .first()
    .dblclick();
  await page.waitForTimeout(1500);
  const last = await log(windows().last()).innerText();
  check(
    "terminal.command-file",
    last.includes(`ran-file-${stamp}`) && last.includes("[Process completed]"),
    last.split("\n").slice(-3).join(" / "),
  );
});
