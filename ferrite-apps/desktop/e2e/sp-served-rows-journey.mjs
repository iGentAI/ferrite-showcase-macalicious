#!/usr/bin/env node
// System Preferences' panes that a web page cannot carry out, and what is real in them. Each served page is reached from
// Show All's menu, read for what it says is true and what it says it cannot do, and photographed. The check boxes that
// show the menu bar's menus are driven and read back on the menu bar across a reload; Users & Groups' Login Items open at
// a real login, by logging out and back in at the login window as an account made for the run; Screen Time's chart
// chooses a day; Siri's and Sidecar's dimmed settings say why. Exits 0 only when every step passed with no console error,
// page error, failed request or HTTP error.
//
// Simulated: the page's clock (Playwright's `page.clock`), moved on so that Screen Time's meter has time to count.
//
//   node e2e/sp-served-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";

/** Each pane's title on its page, what it says it cannot do, and a fact it must show. */
const PAGES = [
  ["Network", "This Browser's Connection", /cannot see or change Wi-Fi/, "Status:"],
  ["Bluetooth", "Bluetooth", /cannot turn Bluetooth on or off/, "Bluetooth in this browser:"],
  ["Printers & Scanners", "Printers & Scanners", /cannot list printers/, null],
  ["Time Machine", "Time Machine", /no Time Machine disk/, "Latest backup:"],
  ["Startup Disk", "Startup Disk", /cannot choose your computer's startup disk/, "Deployment:"],
  ["Software Update", "Software Update", /updated on its server/, "Site build:"],
  ["Apple ID", "Your Account", /no Apple ID and no iCloud/, "Account name:"],
  ["Family Sharing", "Family Sharing", /needs Apple IDs/, null],
  ["Internet Accounts", "Internet Accounts", /No outside accounts can be added/, "Signed in as:"],
  ["Wallet & Apple Pay", "Wallet & Apple Pay", /Cards cannot be added/, null],
  ["Touch ID", "Touch ID", /./, null],
  [
    "Users & Groups",
    "Users & Groups",
    /New accounts are made at the login window/,
    "Current user:",
  ],
  ["Sharing", "Sharing", /cannot share your computer's screen/, "This desktop's address:"],
  ["Screen Time", "Screen Time", /cannot see your other apps/, "Today:"],
  ["Energy Saver", "Energy Saver", /cannot change when your computer sleeps/, "Battery level:"],
];

await journey("sp-served-rows", async ({ page, base, out, step }) => {
  // A write under way when a reload comes is cut off, which the journey counts as a failure.
  let underWay = 0;
  const isApi = (request) => new URL(request.url()).pathname.startsWith("/api/");
  page.on("request", (request) => {
    if (isApi(request)) underWay += 1;
  });
  const finished = (request) => {
    if (isApi(request)) underWay -= 1;
  };
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  const reloadQuietly = async () => {
    await page.waitForTimeout(1_200);
    const end = Date.now() + 15_000;
    while (underWay > 0 && Date.now() < end) await page.waitForTimeout(50);
    underWay = 0;
    await reloadDesktop(page);
  };
  await page.clock.install({ time: new Date() });
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const bar = page.locator(".mac-desktop-shell-menu-bar");
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json?.values?.[key];
  const until = async (check, ms = 8_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value || Date.now() > end) return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
  const tile = (name) => page.getByRole("button", { name, exact: true }).first();
  const openPrefs = async () => {
    await tile("System Preferences").click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
  };
  const showAll = prefs.getByRole("button", { name: "Show All" });
  // Held, the Show All button lists the panes; a Control-click does too.
  const holdForMenu = async () => {
    const box = await showAll.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
  };
  const toPane = async (name) => {
    await showAll.click({ button: "right" });
    await page.getByRole("menu").getByRole("menuitem", { name, exact: true }).click();
    await page.waitForTimeout(300);
  };

  await openPrefs();
  await holdForMenu();
  const listed = page.getByRole("menuitem", { name: "Family Sharing", exact: true });
  step("Show All held: the panes by name", await listed.isVisible());
  await page.screenshot({ path: path.join(out, "sp-served-show-all-menu.png") });
  await listed.click();
  step(
    "and choosing one opens it",
    await prefs
      .getByRole("heading", { name: "Family Sharing" })
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await showAll.click();
  await page.waitForTimeout(400);
  step(
    "a plain click still shows all",
    (await prefs.getByRole("heading", { name: "Family Sharing" }).count()) === 0,
  );

  for (const [name, title, says, fact] of PAGES) {
    await toPane(name);
    const heading = prefs.getByRole("heading", { name: title, exact: true });
    const shown = await heading
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    const text = shown ? await prefs.locator(".mac-system-preferences-served").innerText() : "";
    step(
      `${name}: says what is true and what a page cannot do`,
      shown && says.test(text) && (fact === null || text.includes(fact)),
      text.slice(0, 80).replace(/\n/g, " "),
    );
    await page.screenshot({
      path: path.join(out, `sp-served-${name.toLowerCase().replace(/[^a-z]+/g, "-")}.png`),
    });
  }

  // Network Utility stays off the desktop: nothing here offers it.
  await toPane("Network");
  step(
    "Network offers no Network Utility",
    (await prefs.getByRole("button", { name: /Network Utility/ }).count()) === 0,
  );

  // The menu bar's menus.
  const extra = (name) =>
    bar.getByRole("menuitem", { name, exact: true }).or(bar.getByLabel(name, { exact: true }));
  const shownExtra = async (name) =>
    (await extra(name).count()) > 0 && (await extra(name).first().isVisible());
  const setExtra = async (pane, box, on) => {
    await toPane(pane);
    const check = prefs.getByRole("checkbox", { name: box });
    if ((await check.getAttribute("aria-checked")) === String(on)) return;
    const saved = nextSave(page, SETTINGS);
    await check.click();
    await saved;
    await page.waitForTimeout(200);
  };
  const WITHOUT = [
    ["Energy Saver", "Show battery status in menu bar", "Battery"],
    ["Time Machine", "Show Time Machine in menu bar", "Time Machine"],
    ["Network", "Show Wi-Fi status in menu bar", "Wi-Fi"],
  ];
  for (const [pane, box, name] of WITHOUT) {
    step(`${name} is in the menu bar at first`, await shownExtra(name));
    await setExtra(pane, box, false);
    step(`${box}, off: it goes`, !(await shownExtra(name)));
  }
  step("Bluetooth is not in the menu bar at first", !(await shownExtra("Bluetooth")));
  await setExtra("Bluetooth", "Show Bluetooth in menu bar", true);
  step("Show Bluetooth in menu bar: it comes", await until(() => shownExtra("Bluetooth")));
  await page.screenshot({ path: path.join(out, "sp-served-extras.png") });
  await reloadQuietly();
  await page.waitForTimeout(1_000);
  step(
    "they stay so after a reload",
    !(await shownExtra("Battery")) &&
      !(await shownExtra("Time Machine")) &&
      !(await shownExtra("Wi-Fi")) &&
      (await shownExtra("Bluetooth")),
  );
  for (const [pane, box] of WITHOUT) {
    await prefs.waitFor({ timeout: 10_000 });
    await setExtra(pane, box, true);
  }
  step("on again: the Battery menu is back", await shownExtra("Battery"));

  // Restore Defaults puts Energy Saver's two settings back.
  await setExtra("Energy Saver", "Show battery status in menu bar", false);
  const restored = nextSave(page, SETTINGS);
  await prefs.getByRole("button", { name: "Restore Defaults" }).click();
  await restored;
  step(
    "Energy Saver's Restore Defaults: the Battery menu is back",
    await until(() => shownExtra("Battery")),
  );

  // The Time Machine menu says there is no backup, and dims what needs one.
  await extra("Time Machine").first().click();
  await page.waitForTimeout(300);
  step(
    "Time Machine's menu says no disk and dims Back Up Now",
    (await page.getByRole("menuitem", { name: /no Time Machine disk/ }).isVisible()) &&
      (await page.getByRole("menuitem", { name: "Back Up Now" }).getAttribute("aria-disabled")) ===
        "true",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // System Preferences' own menu has no Preferences row, as on a Mac.
  await prefs.getByRole("button", { name: "Show All" }).click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "System Preferences", exact: true })
    .click();
  await page.waitForTimeout(300);
  step(
    "the application menu has no Preferences row",
    (await page.getByRole("menuitem", { name: "About System Preferences" }).isVisible()) &&
      (await page.getByRole("menuitem", { name: "Preferences…", exact: true }).count()) === 0,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Startup Disk's Restart asks first, as the Apple menu's does.
  await toPane("Startup Disk");
  await prefs.getByRole("button", { name: "Restart…" }).click();
  const asked = page.getByRole("alertdialog").filter({ hasText: "want to restart" });
  step(
    "Startup Disk's Restart asks first",
    await asked
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false),
  );
  await asked.getByRole("button", { name: "Cancel" }).click();

  // Login Items.
  await toPane("Users & Groups");
  const add = prefs.getByRole("button", { name: "Add Login Item…" });
  let saved = nextSave(page, SETTINGS);
  await add.click();
  await page.getByRole("menuitem", { name: "Calculator", exact: true }).click();
  await saved;
  const items = prefs.getByRole("list", { name: "Login Items" });
  step("Add Login Item: Calculator is listed", /Calculator/.test(await items.innerText()));
  await page.screenshot({ path: path.join(out, "sp-served-login-items.png") });
  step("and kept on the server", ((await stored("dock.openAtLogin")) ?? []).includes("calculator"));
  await page.waitForTimeout(1_200);
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("button", { name: "Remove Calculator" }).click();
  await saved;
  step(
    "the minus takes it off",
    await until(async () => !((await stored("dock.openAtLogin")) ?? []).includes("calculator")),
  );

  // A real login: an account of this run adds Calculator, logs out and signs in again at the login window, in a browser
  // of its own, so this journey's page clock and guest are not involved. Calculator was never opened, so only the login
  // items can open it.
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  const person = await context.newPage();
  const personProblems = [];
  person.on("pageerror", (error) => personProblems.push(error.message));
  person.on("console", (message) => {
    if (message.type() === "error" && !/status of (401|409)/.test(message.text()))
      personProblems.push(message.text());
  });
  const run = Date.now().toString(36);
  const fullName = `Login ${run}`;
  const password = `tide-${run}-pool`;
  const userTile = (name) =>
    person.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
  await person.goto(`${base}/`, { waitUntil: "load" });
  await userTile("Create Account…").click({ timeout: 40_000 });
  const form = person.getByRole("form", { name: "Create Account" });
  await form.getByLabel("Full Name:").fill(fullName);
  await form.getByLabel("Account Name:").fill(`login-${run}`);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
  const personPrefs = person.locator('[data-window-id="system-preferences"]');
  const personDock = (name) => person.getByRole("button", { name, exact: true }).first();
  await personDock("System Preferences").click({ timeout: 40_000 });
  await personPrefs.waitFor({ timeout: 10_000 });
  await personPrefs.getByRole("button", { name: "Show All" }).click({ button: "right" });
  await person
    .getByRole("menu")
    .getByRole("menuitem", { name: "Users & Groups", exact: true })
    .click();
  const personSaved = nextSave(person, SETTINGS);
  await personPrefs.getByRole("button", { name: "Add Login Item…" }).click();
  await person.getByRole("menuitem", { name: "Calculator", exact: true }).click();
  await personSaved;
  await person.waitForTimeout(1_200);
  const calculator = person.locator('[data-window-id="calculator"]');
  step("Calculator is not open before the login", (await calculator.count()) === 0);
  await person
    .getByRole("menuitem", { name: "Apple", exact: true })
    .or(person.getByRole("button", { name: "Apple", exact: true }))
    .first()
    .click();
  await person
    .getByRole("menuitem", { name: /^Log Out / })
    .first()
    .click();
  await userTile(fullName).click({ timeout: 30_000 });
  const field = person.getByRole("textbox", { name: "Enter Password" });
  await field.fill(password);
  await field.press("Enter");
  step(
    "logged out and in at the login window: the login item opens",
    await calculator
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false),
  );
  const kept = (await api(person, "GET", SETTINGS)).json?.values?.["dock.openAtLogin"] ?? [];
  step("and it is still kept on the server", kept.includes("calculator"), JSON.stringify(kept));
  await person.waitForTimeout(1_200);
  await reloadDesktop(person);
  step("no page error in that browser", personProblems.length === 0, personProblems.join("; "));
  await context.close();

  // Siri and Sidecar.
  await toPane("Siri");
  const dimmedWithReason = async (control, reason) =>
    (await control.getAttribute("aria-disabled")) === "true" ||
    (await control.isDisabled().catch(() => false))
      ? reason.test((await control.getAttribute("title")) ?? "")
      : false;
  step(
    "Siri: Hey Siri is dimmed and says why",
    await dimmedWithReason(prefs.getByRole("checkbox", { name: /Hey Siri/ }), /web page/),
  );
  step(
    "Allow Siri when locked is dimmed and says why",
    await dimmedWithReason(
      prefs.getByRole("checkbox", { name: "Allow Siri when locked" }),
      /locked/,
    ),
  );
  step(
    "the shortcut can be chosen, saying what a page cannot see",
    (await prefs.getByRole("combobox", { name: "Keyboard Shortcut:" }).isEnabled()) &&
      /Fn key/.test(
        (await prefs.getByRole("combobox", { name: "Keyboard Shortcut:" }).getAttribute("title")) ??
          "",
      ),
  );
  step(
    "the language can be chosen",
    await prefs.getByRole("combobox", { name: "Language:" }).isEnabled(),
  );
  step(
    "the voice says why",
    await dimmedWithReason(prefs.getByRole("combobox", { name: "Siri Voice:" }), /browser/),
  );
  await page.screenshot({ path: path.join(out, "sp-served-siri.png") });
  await toPane("Sidecar");
  step(
    "Sidecar: double tap is dimmed and says why",
    await dimmedWithReason(prefs.getByRole("checkbox", { name: /double tap/ }), /Pencil/),
  );

  // Extensions' other categories.
  await toPane("Extensions");
  const categories = [
    ["Actions", /built in/],
    ["Finder Extensions", /takes no extensions/],
    ["Quick Look", /takes no extensions/],
    ["Finder", /built in/],
  ];
  for (const [name, says] of categories) {
    await prefs.getByText(name, { exact: true }).first().click();
    await page.waitForTimeout(200);
    step(`Extensions, ${name}: says what is true`, says.test(await prefs.innerText()));
  }
  await page.screenshot({ path: path.join(out, "sp-served-extensions.png") });

  // Screen Time counts an application in front, and its chart chooses a day.
  await tile("Calculator").click();
  await page.locator('[data-window-id="calculator"]').waitFor({ timeout: 10_000 });
  await page.mouse.move(300, 300);
  await page.waitForTimeout(800);
  // The clock is not moved past a request's deadline: one under way would be cut off.
  const quiet = async () => {
    await page.waitForTimeout(700);
    const end = Date.now() + 15_000;
    while (underWay > 0 && Date.now() < end) await page.waitForTimeout(50);
  };
  for (let minute = 0; minute < 3; minute += 1) {
    await page.mouse.move(300 + minute, 300);
    await quiet();
    await page.clock.fastForward(60_000);
    await quiet();
  }
  await openPrefs();
  await toPane("Screen Time");
  const chart = prefs.getByRole("group", { name: "The last seven days" });
  const days = chart.getByRole("button");
  step("Screen Time: seven days are charted", (await days.count()) === 7);
  const counted = await until(async () => /Calculator:/.test(await prefs.innerText()));
  step("today lists the application that was in front", counted);
  const barOfToday = await days
    .last()
    .locator("span")
    .first()
    .evaluate((bar) => bar.style.height);
  step("and its bar has height", barOfToday !== "0%", barOfToday);
  await page.screenshot({ path: path.join(out, "sp-served-screen-time.png") });
  await prefs.getByRole("button", { name: "Earlier day" }).click();
  step(
    "the arrow chooses the day before, on which nothing is counted",
    (await days.nth(5).getAttribute("aria-pressed")) === "true" &&
      !/Calculator:/.test(await prefs.innerText()),
  );
  await days.last().click();
  step("a bar chooses its day", /Calculator:/.test(await prefs.innerText()));

  // Screen Time's other sections keep their settings on the server, and say what they do not enforce.
  const section = (name) =>
    prefs.getByRole("listbox", { name: "Screen Time" }).getByRole("option", { name, exact: true });
  step("the eight sections are listed", (await section("Options").count()) === 1);
  await section("Downtime").click();
  step(
    "Downtime says it does not stop an application",
    /does not close or block an application/.test(await prefs.innerText()),
  );
  await prefs.getByRole("button", { name: "Turn On", exact: true }).click();
  step(
    "Downtime on is kept on the server, and says when it applies",
    await until(async () => (await stored("screen-time.downtime"))?.on === true),
  );
  step("with what it means now", /Now:\s*(In downtime until|Starts)/.test(await prefs.innerText()));
  await page.screenshot({ path: path.join(out, "sp-served-screen-time-downtime.png") });

  await section("App Limits").click();
  await prefs.getByRole("button", { name: "Turn On", exact: true }).click();
  await prefs.getByRole("button", { name: "Add a limit" }).click();
  const sheet = page.getByRole("dialog", { name: "Add Limit" });
  await sheet.getByRole("checkbox", { name: "Calculator", exact: true }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  step(
    "App Limits: a limit is kept on the server",
    await until(async () =>
      (await stored("screen-time.appLimits"))?.limits?.some(
        (limit) => limit.apps.includes("calculator") && limit.minutes === 30,
      ),
    ),
  );
  step("and shows today's use of it", /of 30 min today/.test(await prefs.innerText()));
  await page.screenshot({ path: path.join(out, "sp-served-screen-time-limits.png") });

  await section("Always Allowed").click();
  await prefs.getByRole("checkbox", { name: "Calculator", exact: true }).click();
  step(
    "Always Allowed: a choice is kept on the server",
    await until(async () => (await stored("screen-time.alwaysAllowed"))?.includes("calculator")),
  );

  await section("Content & Privacy").click();
  await prefs.getByRole("button", { name: "Turn On", exact: true }).click();
  await prefs.getByRole("radio", { name: "Limit Adult Websites" }).click();
  step(
    "Content & Privacy: a choice is kept on the server",
    await until(async () => (await stored("screen-time.contentPrivacy"))?.web === "limit-adult"),
  );
  await page.screenshot({ path: path.join(out, "sp-served-screen-time-content.png") });

  await reloadQuietly();
  if (!(await prefs.isVisible())) await openPrefs();
  await toPane("Screen Time");
  await section("Content & Privacy").click();
  step(
    "and after a reload the section shows it",
    await prefs.getByRole("radio", { name: "Limit Adult Websites" }).isChecked(),
  );
  await section("App Limits").click();
  step(
    "as App Limits shows its limit",
    await prefs.getByRole("checkbox", { name: "Calculator", exact: true }).isVisible(),
  );
  await section("Options").click();
  step(
    "Options: what needs an Apple ID is dimmed and says so",
    (await prefs
      .getByRole("checkbox", { name: "Share across devices" })
      .evaluate((box) => box.closest("[title]")?.getAttribute("title"))) ===
      "Sharing across devices needs an Apple ID, and this desktop has none.",
  );
  // The journey's end closes the page: nothing it writes is to be cut off.
  await page.waitForTimeout(1_500);
  const end = Date.now() + 15_000;
  while (underWay > 0 && Date.now() < end) await page.waitForTimeout(50);
});
