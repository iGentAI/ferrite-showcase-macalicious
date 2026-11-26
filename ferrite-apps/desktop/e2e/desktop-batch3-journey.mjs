#!/usr/bin/env node
// The Desktop and Dock, Siri and Notification Center rows of batch 3, in one person's desktop with a second to write to:
// Mail's Dock count of the Inbox's unread messages as Preferences says; Calendar's tile with today's date; Sort By Date
// Added and a stack's Automatic view, read back from the server and across a reload; Show Notification Center's key
// from Keyboard's Shortcuts; Siri's found card, new event and sent mail, read from the server; the Window menu's key for
// Music; New Window among Help's results; Option-Command-D where the page takes it for a Mac; Copy's own words; and a
// row of Today that shows the reminder it names.
//
//   node e2e/desktop-batch3-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]
//
// `--finder-app-drag` also drags Calculator from Finder's Applications to the Dock.

import { twoPeople, within } from "./people-kit.mjs";
import { openWithSpotlight, uploadFile } from "./system-kit.mjs";

const { step, run, shot, allow } = twoPeople("desktop-batch3");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const bea = { name: `b3bea-${id}`, fullName: `Bea ${id}`, password };
const ada = { name: `b3ada-${id}`, fullName: `Ada ${id}`, password };
const SETTINGS = "/api/system-preferences/settings";
const seen = (check, ms = 15_000) => within(ms, check).then((took) => took !== null);
const dragsFinderApp = process.argv.includes("--finder-app-drag");

const call = (page, method, url, body) =>
  page.evaluate(
    async ([method, url, body]) => {
      const reply = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: reply.status, json: await reply.json().catch(() => null) };
    },
    [method, url, body],
  );

const settings = async (page) => (await call(page, "GET", SETTINGS)).json.values ?? {};
const setSettings = async (page, change) => {
  // The page saves what just changed after a moment: this comes after that.
  await page.waitForTimeout(2_500);
  const { json } = await call(page, "GET", SETTINGS);
  await call(page, "PUT", SETTINGS, { values: { ...json.values, ...change }, rev: json.rev });
};
const reload = async (page) => {
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
};

await run({}, {}, async ({ person }) => {
  // Siri's refusal of an outside address is a step below.
  allow(/HTTP 422: \S*\/api\/mail\/send/);
  allow(/console: Failed to load resource: the server responded with a status of 422/);
  const page = await person("bea", bea);
  const other = await person("ada", ada);
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const mailBadge = dock.locator('[data-dock-target="mail"] [data-dock-badge]');
  const menu = (name) => page.getByRole("menuitem", { name, exact: true }).first();

  // Mail's count.
  const subjects = [`First ${id}`, `Second ${id}`];
  for (const subject of subjects) {
    const sent = await call(other, "POST", "/api/mail/send", {
      to: [bea.name],
      subject,
      text: "For you.",
    });
    step(`Ada sends “${subject}”`, sent.status < 300, `HTTP ${sent.status}`);
  }
  step(
    "Mail's tile counts the two unread messages",
    await seen(async () => (await mailBadge.innerText()) === "2"),
  );
  const inbox = (await call(page, "GET", "/api/mail/messages")).json.messages;
  const first = inbox.find((each) => each.subject === subjects[0]);
  await call(page, "PATCH", `/api/mail/messages/${first.id}`, { unread: false });
  await reload(page);
  step(
    "One read leaves one, though its notification is not cleared",
    await seen(async () => (await mailBadge.innerText()) === "1"),
  );
  const second = inbox.find((each) => each.subject === subjects[1]);
  await call(page, "PATCH", `/api/mail/messages/${second.id}`, { mailbox: "archive" });
  await reload(page);
  step(
    "Inbox Only leaves out what is in another mailbox",
    await seen(async () => (await mailBadge.count()) === 0),
  );
  await setSettings(page, { "mail.settings": { dock: "All Mailboxes" } });
  await reload(page);
  step(
    "All Mailboxes in Mail's Preferences counts it",
    await seen(async () => (await mailBadge.innerText()) === "1"),
  );
  await shot(page, "batch3-mail-badge");

  // Calendar's tile.
  const today = new Date();
  const date = dock.locator('[data-dock-target="calendar"] svg[data-dock-date]');
  step(
    "Calendar's tile shows today's date",
    (await date.getAttribute("data-dock-date")) === String(today.getDate()) &&
      (await date.textContent()).includes(
        today.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      ),
    await date.textContent(),
  );

  // Siri.
  const cards = await call(page, "GET", "/api/contacts/cards");
  await call(page, "PUT", "/api/contacts/cards", {
    cards: [
      {
        id: "c1",
        account: "icloud",
        first: "Ada",
        last: id,
        user: ada.name,
        phones: [{ label: "mobile", value: "555-0142" }],
        emails: [{ label: "home", value: "ada@example.org" }],
      },
    ],
    rev: cards.json?.rev ?? 0,
  });
  await reload(page);
  const siri = page.locator(".mac-desktop-shell-siri");
  const field = siri.getByRole("textbox", { name: "Type to Siri" });
  await menu("Siri").click();
  await field.waitFor({ timeout: 8_000 });
  const said = siri.locator(".mac-siri-demo-reply[data-answer]");
  const ask = async (words, shows) => {
    await field.fill(words);
    await field.press("Enter");
    return seen(async () => (await siri.innerText()).includes(shows));
  };
  // What the answer to this request says, not what an earlier one said.
  const answered = async (words, shows) => {
    await field.fill(words);
    await field.press("Enter");
    return seen(async () => (await said.innerText()).includes(shows));
  };
  step(
    "Siri finds a person in Contacts",
    await ask(`find ${id} in my contacts`, "555-0142"),
    await siri.innerText(),
  );
  const MEETING = `Dock review ${id}`;
  step(
    "Siri adds an event",
    await ask(`schedule a meeting called ${MEETING} tomorrow at 10am`, "to your calendar"),
  );
  const events = (await call(page, "GET", "/api/calendar/events")).json.events ?? [];
  const event = events.find((each) => each.title === MEETING);
  const start = new Date(event?.start ?? 0);
  step(
    "and it is on the server, tomorrow at ten",
    start.getDate() === new Date(Date.now() + 86_400_000).getDate() && start.getHours() === 10,
    JSON.stringify(event),
  );

  const adaMail = async () => (await call(other, "GET", "/api/mail/messages")).json.messages;
  step(
    "Siri holds a message with its words said",
    await answered(`email Ada about the ferry ${id} saying we leave at ten`, "Ready to send it?"),
    await siri.innerText(),
  );
  await shot(page, "batch3-siri-draft");
  step(
    "and nothing has gone yet",
    !(await adaMail()).some((each) => each.subject === `The ferry ${id}`),
  );
  await siri.getByRole("button", { name: "Send", exact: true }).click();
  step(
    "Send sends it",
    await seen(async () => (await said.innerText()).includes("was sent")),
    await siri.innerText(),
  );
  const delivered = (await adaMail()).find((each) => each.subject === `The ferry ${id}`);
  step("and it is in Ada's Inbox", delivered?.mailbox === "inbox", JSON.stringify(delivered));
  const opened = await call(other, "GET", `/api/mail/messages/${delivered?.id}`);
  step(
    "with what was said in it",
    JSON.stringify(opened.json).includes("we leave at ten"),
    `HTTP ${opened.status}`,
  );

  await answered(`mail Ada saying said aloud ${id}`, "Ready to send it?");
  await answered("send it", "was sent");
  step(
    "“Send it” sends the message on the screen",
    await seen(async () => JSON.stringify(await adaMail()).includes(`said aloud ${id}`)),
  );
  await answered(`mail Ada saying kept back ${id}`, "Ready to send it?");
  await siri.getByRole("button", { name: "Cancel", exact: true }).click();
  await seen(async () => (await said.innerText()).includes("won’t send"));
  step("Cancel sends nothing", !JSON.stringify(await adaMail()).includes(`kept back ${id}`));
  await answered("mail nobody@example.org saying outside", "Ready to send it?");
  await siri.getByRole("button", { name: "Send", exact: true }).click();
  step(
    "A refusal says the server's words and keeps the message",
    (await seen(async () => (await said.innerText()).includes("only to its own accounts"))) &&
      (await siri.getByRole("button", { name: "Send", exact: true }).isVisible()),
    await siri.innerText(),
  );

  // Copy says whether it worked.
  await ask("what is six times seven", "42");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("refused")) },
    });
    document.execCommand = () => false;
  });
  await siri.getByRole("button", { name: "Copy", exact: true }).click();
  step(
    "Copy says when the browser refuses it",
    await seen(async () => (await siri.innerText()).includes("refused to copy")),
  );
  await siri.getByRole("button", { name: "Close" }).first().click();

  // Sort By Date Added. Each file arrives after the desktop noted the one before it.
  const names = [`Zz first ${id}.txt`, `Mm second ${id}.txt`, `Aa third ${id}.txt`];
  const noted = async () => Object.keys((await settings(page))["desktop.addedAt"] ?? {}).length;
  for (const [at, name] of names.entries()) {
    await uploadFile(page, { parent: "desktop", name, type: "text/plain", text: name });
    await reload(page);
    await seen(async () => (await noted()) >= at + 1);
  }
  step("The server knows when each arrived", (await noted()) === 3, String(await noted()));
  const shownOrder = () =>
    page
      .locator(".mac-desktop-icon[data-drive-item]")
      .evaluateAll((icons) => icons.map((icon) => icon.textContent));
  const desktopSpot = await page.evaluate(() => ({ x: innerWidth / 2 - 200, y: innerHeight / 2 }));
  await page.mouse.click(desktopSpot.x, desktopSpot.y, { button: "right" });
  await menu("Sort By").hover();
  await page.getByRole("menuitemradio", { name: "Date Added", exact: true }).click();
  step(
    "Sort By Date Added is kept on the server",
    await seen(async () => (await settings(page))["desktop.sortBy"] === "added"),
  );
  const inOrder = (order) =>
    order.length === 3 && order[0].includes(names[2]) && order[2].includes(names[0]);
  step(
    "and puts the last to arrive first",
    await seen(async () => inOrder(await shownOrder())),
    JSON.stringify(await shownOrder()),
  );
  await shot(page, "batch3-date-added");
  await reload(page);
  step("and stays so across a reload", await seen(async () => inOrder(await shownOrder())));

  // A stack's Automatic view.
  const downloads = dock.locator('[data-dock-target="folder:downloads"]').first();
  for (let n = 0; n < 2; n += 1) {
    await uploadFile(page, {
      parent: "downloads",
      name: `Down ${n} ${id}.txt`,
      type: "text/plain",
      text: "x",
    });
  }
  await reload(page);
  await downloads.click({ button: "right" });
  await menu("View content as").click();
  step(
    "A stack offers Automatic, and it is the one chosen at first",
    (await page
      .getByRole("menuitemradio", { name: "Automatic", exact: true })
      .getAttribute("aria-checked")) === "true",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await seen(async () => (await page.getByRole("menu").count()) === 0, 3_000);
  const popupView = () => page.locator(".mac-dock-stack-popup").getAttribute("data-view");
  await downloads.click();
  step("Automatic fans out a few items", (await popupView()) === "fan", await popupView());
  await page.keyboard.press("Escape");
  await seen(async () => (await page.locator(".mac-dock-stack-popup").count()) === 0, 3_000);
  for (let n = 2; n < 11; n += 1) {
    await uploadFile(page, {
      parent: "downloads",
      name: `Down ${n} ${id}.txt`,
      type: "text/plain",
      text: "x",
    });
  }
  await reload(page);
  await downloads.click();
  step("and shows many as a grid", (await popupView()) === "grid", await popupView());
  await shot(page, "batch3-stack-grid");
  await page.keyboard.press("Escape");

  // Show Notification Center's key.
  await menu("Siri").click();
  await field.waitFor({ timeout: 8_000 });
  await field.fill("open keyboard preferences");
  await field.press("Enter");
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  await prefs.getByRole("tab", { name: "Shortcuts" }).click();
  await prefs.getByRole("combobox", { name: "Show Notification Center:" }).click();
  await page.getByRole("option", { name: "F6", exact: true }).click();
  step(
    "Keyboard's Shortcuts keeps the key on the server",
    await seen(async () => (await settings(page))["keyboard.showNotificationCenter"] === "F6"),
  );
  await shot(page, "batch3-shortcut");
  const center = page.locator('aside[aria-label="Notification Center"]');
  await page.keyboard.press("F6");
  step(
    "and the key opens Notification Center",
    await seen(async () => (await center.count()) === 1),
  );
  await page.keyboard.press("F6");
  step("and closes it", await seen(async () => (await center.count()) === 0));
  await reload(page);
  await page.keyboard.press("F6");
  step("after a reload as well", await seen(async () => (await center.count()) === 1));
  await page.keyboard.press("F6");

  // A row of Today shows its reminder.
  const two = (n) => String(n).padStart(2, "0");
  const dayText = `${today.getFullYear()}-${two(today.getMonth() + 1)}-${two(today.getDate())}`;
  const REMINDER = `Water plants ${id}`;
  const data = await call(page, "GET", "/api/reminders/data");
  await call(page, "PUT", "/api/reminders/data", {
    base: data.json?.rev ?? 0,
    data: {
      lists: [{ id: "l1", name: "Reminders", color: "blue" }],
      reminders: [{ id: "r1", listId: "l1", title: REMINDER, due: dayText }],
    },
    alerts: { r1: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9).getTime() },
  });
  await reload(page);
  await menu("Notification Center").click();
  const row = center.getByRole("button", { name: new RegExp(REMINDER) });
  await row.waitFor({ timeout: 10_000 });
  await row.click();
  await page.locator('[data-window-id="reminders"]').waitFor({ timeout: 10_000 });
  step(
    "A reminder's row opens Reminders with that reminder selected",
    await seen(async () => {
      const option = page
        .locator('[data-window-id="reminders"] [role="option"]')
        .filter({ hasText: REMINDER });
      return (await option.getAttribute("aria-selected")) === "true";
    }),
  );
  await shot(page, "batch3-reminder-row");

  // Music's key in the Window menu, and New Window among Help's results.
  await dock
    .getByRole("button", { name: /^Music$/ })
    .first()
    .click();
  await page.locator('[data-window-id="music"]').waitFor({ timeout: 15_000 });
  await menu("Window").click();
  const musicRow = page.getByRole("menuitemcheckbox", { name: /^Music/ }).first();
  step(
    "The Window menu's row for Music shows ⌥⌘1",
    (await musicRow.textContent()).includes("⌥⌘1"),
    await musicRow.textContent(),
  );
  await page.keyboard.press("Escape");
  await dock
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .click();
  await seen(async () => (await page.locator('[data-window-id^="finder"]').count()) > 0);
  await menu("Help").click();
  await page.locator(".mac-desktop-shell-help-search input").fill("New Finder");
  step(
    "Help's search finds the File menu's New Window row",
    await seen(async () =>
      page
        .getByRole("menuitem", { name: /New Finder Window/ })
        .first()
        .isVisible(),
    ),
  );
  await shot(page, "batch3-help-new-window");
  await page.keyboard.press("Escape");

  if (dragsFinderApp) {
    await setSettings(page, { "dock.removed": ["calculator"] });
    await reload(page);
    step(
      "Calculator is out of the Dock",
      await seen(async () => (await dock.locator('[data-dock-target="calculator"]').count()) === 0),
    );
    await dock
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .click();
    const finder = page.locator(".mac-window.mac-finder").first();
    await finder.waitFor({ timeout: 10_000 });
    await finder
      .getByRole("option", { name: "Applications" })
      .or(finder.getByText("Applications", { exact: true }))
      .first()
      .click();
    const calculator = finder.getByRole("option", { name: "Calculator", exact: true }).first();
    await calculator.waitFor({ timeout: 10_000 });
    const from = await calculator.boundingBox();
    const to = await dock.getByRole("separator").first().boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 40, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    step(
      "Calculator dragged from Applications is kept in the Dock",
      await seen(async () => (await dock.locator('[data-dock-target="calculator"]').count()) === 1),
    );
    await reload(page);
    step(
      "and is still there after a reload",
      await seen(async () => (await dock.locator('[data-dock-target="calculator"]').count()) === 1),
    );
  }

  // Notes' File > Share > Reminders makes a reminder of the note's text. Preview's and Automator's Open panels take several.
  const openFile = page.getByRole("menuitem", { name: "File", exact: true }).first();
  const line = `Buy pears ${id}`;
  await openWithSpotlight(page, "Notes");
  await page.getByRole("textbox", { name: "Note" }).first().waitFor({ timeout: 15_000 });
  // A new note made before the window has read the account's notes would be lost to that read.
  await page.waitForTimeout(2_000);
  await page.getByRole("button", { name: "New Note", exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.keyboard.type(line);
  await page.keyboard.press("Enter");
  await page.keyboard.type("from the market");
  await page.waitForTimeout(600);
  await openFile.click();
  await page.getByRole("menuitem", { name: "Share", exact: true }).first().hover();
  await page.getByRole("menuitem", { name: "Reminders", exact: true }).click();
  step(
    "Notes shares its text with Reminders: on the server, a reminder of its first line with the rest in its notes",
    await seen(async () => {
      const text = JSON.stringify((await call(page, "GET", "/api/reminders/data")).json);
      return text.includes(line) && text.includes("from the market");
    }),
  );
  await shot(page, "batch3-notes-to-reminders");
  await reload(page);
  step(
    "and it is still there after a reload",
    JSON.stringify((await call(page, "GET", "/api/reminders/data")).json).includes(line),
  );

  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAAMBAQAY3Y2wAAAAAElFTkSuQmCC",
    "base64",
  );
  const pictures = [`One ${id}.png`, `Two ${id}.png`];
  for (const name of pictures) {
    await uploadFile(page, { parent: "pictures", name, type: "image/png", bytes: PNG });
  }
  const library = (await call(page, "GET", "/api/app-store/library")).json;
  await call(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator", "preview"])],
    rev: library.rev,
  });
  await reload(page);
  await openWithSpotlight(page, "Preview");
  await page.waitForTimeout(1_500);
  const previewSheet = page.getByRole("dialog", { name: "Choose a document" });
  if ((await previewSheet.count()) === 0) {
    await openFile.click();
    await page
      .getByRole("menuitem", { name: /^Open…/ })
      .first()
      .click();
  }
  await shot(page, "batch3-preview-sheet");
  await previewSheet.getByRole("option", { name: pictures[0] }).click({ timeout: 15_000 });
  await previewSheet
    .getByRole("option", { name: pictures[1] })
    .click({ modifiers: ["ControlOrMeta"] });
  await previewSheet.getByRole("button", { name: "Open", exact: true }).click();
  step(
    "Preview's File > Open takes two pictures: both share the window, with a thumbnail each",
    await seen(
      async () =>
        (await page.locator(".mac-preview-app-thumbnail-label").filter({ hasText: id }).count()) ===
        2,
    ),
  );
  await shot(page, "batch3-preview-several");

  await openWithSpotlight(page, "Automator");
  const actions = page.getByRole("grid", { name: "Actions" });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 15_000 });
  const search = page.locator('[data-window-id^="automator"]').getByRole("searchbox", {
    name: "Search",
  });
  await search.fill("Ask for Photos");
  await actions.getByText("Ask for Photos", { exact: true }).dblclick();
  await search.fill("Ask for Finder Items");
  await actions.getByText("Ask for Finder Items", { exact: true }).dblclick();
  await search.fill("");
  const runWorkflow = page
    .getByRole("toolbar", { name: "Toolbar" })
    .getByRole("button", { name: "Run" });
  const alerts = page.locator(".mac-reminders-alerts").getByRole("button", { name: "Close" });
  while ((await alerts.count()) > 0) await alerts.first().click();
  await runWorkflow.click();
  const panel = page.locator(".mac-automator-panel-layer");
  await panel.getByRole("option", { name: pictures[0] }).click({ timeout: 15_000 });
  await panel.getByRole("option", { name: pictures[1] }).click({ modifiers: ["ControlOrMeta"] });
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await panel.getByRole("button", { name: "Open", exact: true }).click({ timeout: 15_000 });
  const log = page.getByRole("grid", { name: "Log" });
  await log.getByText(/^Workflow (completed|failed)$/).waitFor({ timeout: 20_000 });
  const logged = (await log.getByRole("row").allInnerTexts()).join(" | ");
  step(
    "Automator's Ask for Photos takes two pictures",
    /Ask for Photos completed, 2 items/.test(logged),
    logged,
  );
  step(
    "and Ask for Finder Items takes the folder shown, handing on all three",
    /Ask for Finder Items completed, 3 items.*Desktop/.test(logged),
    logged,
  );
  await shot(page, "batch3-automator-several");

  // Option-Command-D, which only a Mac's keyboard can press: off a Mac Control-Option-D is Show Desktop's.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }),
  );
  await reload(page);
  const hiding = (await settings(page))["dock.autohide"] === true;
  await page.keyboard.press("Meta+Alt+KeyD");
  step(
    "Option-Command-D turns the Dock's hiding on, on the server",
    await seen(async () => ((await settings(page))["dock.autohide"] === true) === !hiding),
  );
  await page.keyboard.press("Meta+Alt+KeyD");
  step(
    "and off again",
    await seen(async () => ((await settings(page))["dock.autohide"] === true) === hiding),
  );
});
