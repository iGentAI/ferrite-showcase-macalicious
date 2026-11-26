#!/usr/bin/env node
// Automator's other document types on the served desktop, as a new account: Get Selected Finder Items,
// a Quick Action in Finder's context menu and the Services menu, a Folder Action started by a file
// arriving, a Calendar Alarm started by its event's alert, and an Application that runs when its file
// is opened from Finder and from the Dock. Each result is read back from the server's drive and run
// log, and across a reload. Exits 0 only when every step passed with no console error, page error or
// failed request.
//
//   node e2e/automator-types-batch6-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount, newAccount } from "./r3-census-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("automator-types-batch6");
const account = newAccount("types", browserName);
const tag = Date.now().toString(36);

async function until(check, ms = 30_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });

await run(async (page) => {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, account);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  const NOTE = `note ${tag}.txt`;
  const OTHER = `other ${tag}.txt`;
  const DROP = `Drop ${tag}`;
  await uploadFile(page, { parent: "documents", name: NOTE, type: "text/plain", text: "one" });
  await uploadFile(page, { parent: "documents", name: OTHER, type: "text/plain", text: "two" });
  const made = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: DROP }],
  });
  const dropId = made.json.created[0];
  await reloadDesktop(page);

  const entryNamed = async (name) =>
    (await api(page, "GET", "/api/files/")).json.entries.find(
      (entry) => entry.name === name && !entry.trashed_ms,
    );
  /** The text of a drive file, or `null` while it is not there. */
  const textOf = async (name) => {
    const entry = await entryNamed(name);
    if (!entry) return null;
    return page.evaluate(
      async ({ id, version }) => {
        const reply = await fetch(
          `/api/files/content/${encodeURIComponent(id)}?piece=0&count=1&version=${version}`,
          { credentials: "same-origin" },
        );
        return reply.ok ? reply.text() : null;
      },
      { id: entry.id, version: entry.version ?? 0 },
    );
  };
  const runsBy = async (trigger) =>
    ((await api(page, "GET", "/api/automator/runs")).json.runs ?? []).filter(
      (entry) => entry.trigger === trigger,
    );
  const saved = async (name) =>
    (await api(page, "GET", "/api/automator/workflows")).json.library?.workflows.find(
      (entry) => entry.name === name,
    );
  const told = async (title) =>
    ((await api(page, "GET", "/api/notification-center/inbox")).json.items ?? []).find(
      (item) => item.app === "automator" && item.title === title,
    );

  await launch(page, "Automator");
  const actions = page.getByRole("grid", { name: "Actions" });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
  const search = page.getByPlaceholder("Name", { exact: true });
  const nameField = page.getByRole("textbox", { name: "Workflow name" });
  const steps = page.locator(".mac-automator-step");

  const add = async (title, settings = {}) => {
    const before = await steps.count();
    await search.fill(title);
    await actions.getByText(title, { exact: true }).first().dblclick();
    await steps.nth(before).waitFor({ timeout: 5_000 });
    await search.fill("");
    const added = steps.nth(before);
    for (const [label, value] of Object.entries(settings)) {
      if (value === true) await added.getByRole("checkbox", { name: label, exact: true }).click();
      else await added.getByLabel(label, { exact: true }).fill(value);
    }
  };
  const fileRow = async (name) => {
    await bar(page, "File").click();
    await page.waitForTimeout(250);
    await page.getByRole("menuitem", { name }).first().click();
  };
  /** File > New of the type, named. */
  const newOf = async (type, name) => {
    await fileRow(/^New/);
    const sheet = page.getByRole("dialog", { name: /Choose a type/ });
    await sheet.getByRole("radio", { name: type, exact: true }).click();
    await sheet.getByRole("button", { name: "Choose" }).click();
    await sheet.waitFor({ state: "detached" });
    const asked = page.getByRole("button", { name: /Don.t Save/ });
    if (await asked.isVisible({ timeout: 800 }).catch(() => false)) await asked.click();
    await page.waitForTimeout(800);
    if (await asked.isVisible().catch(() => false)) await asked.click();
    await nameField.fill(name);
  };
  const save = async (name) => {
    await fileRow(/^Save/);
    await page
      .locator(".mac-automator-status")
      .getByText(`Saved “${name}”`)
      .waitFor({ timeout: 10_000 });
  };
  const toAutomator = async () => {
    await launch(page, "Automator");
    await page.waitForTimeout(300);
  };

  // Finder's selection, and the workflow that reads it.
  await launch(page, "Finder");
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 8_000 });
  await finder.getByRole("treeitem", { name: "Documents" }).first().click();
  const item = (name) => finder.getByRole("option", { name: new RegExp(name) }).first();
  await item(NOTE).click();
  await toAutomator();
  const SELECTED = `selected ${tag}.txt`;
  await add("Get Selected Finder Items");
  await add("New Text File", { path: `Documents/${SELECTED}` });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page
    .getByText(/^Workflow (completed|failed)$/)
    .first()
    .waitFor({ timeout: 20_000 });
  step(
    "Get Selected Finder Items hands the next step what is selected in Finder",
    (await until(() => textOf(SELECTED), 8_000)) === `Documents/${NOTE}`,
    String(await textOf(SELECTED)),
  );

  // A Quick Action.
  const QUICK = `Tidy ${tag}`;
  const QUICK_OUT = `quick ${tag}.txt`;
  await newOf("Quick Action", QUICK);
  step(
    "File > New makes a workflow of the type chosen",
    /Quick Action/.test(await page.getByRole("combobox", { name: "Workflow type" }).innerText()),
  );
  await add("New Text File", { path: `Documents/${QUICK_OUT}`, replace: true });
  await save(QUICK);
  step(
    "The server keeps a Quick Action with its type",
    (await saved(QUICK))?.kind === "quick-action",
    JSON.stringify((await saved(QUICK))?.kind),
  );

  await launch(page, "Finder");
  await page.waitForTimeout(500);
  await item(NOTE).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Quick Actions", exact: true }).hover();
  await page.getByRole("menuitem", { name: QUICK, exact: true }).click();
  step(
    "Finder's context menu runs the Quick Action on the file",
    (await until(() => textOf(QUICK_OUT))) === `Documents/${NOTE}`,
    String(await textOf(QUICK_OUT)),
  );
  step("Its run is logged as a Quick Action's", (await runsBy("quick-action")).length === 1);
  step(
    "A notification says it ran, on what",
    (await until(() => told(`Quick Action “${QUICK}” ran`), 8_000))?.body === `On “${NOTE}”`,
  );

  await reloadDesktop(page);
  await launch(page, "Finder");
  await finder.waitFor({ timeout: 8_000 });
  await finder.getByRole("treeitem", { name: "Documents" }).first().click();
  await item(OTHER).click();
  await page.waitForTimeout(800);
  await bar(page, "Finder").click();
  await page.getByRole("menuitem", { name: "Services", exact: true }).hover();
  const service = page.getByRole("menuitem", { name: QUICK, exact: true });
  await service.waitFor({ timeout: 8_000 });
  await service.click();
  step(
    "After a reload, the Services menu runs the Quick Action on Finder's selection",
    (await until(async () => (await textOf(QUICK_OUT)) === `Documents/${OTHER}`)) === true,
    String(await textOf(QUICK_OUT)),
  );

  // A Folder Action.
  await toAutomator();
  const FOLDER = `Watch ${tag}`;
  const ARRIVED = `arrived ${tag}.txt`;
  await newOf("Folder Action", FOLDER);
  await add("New Text File", { path: `Documents/${ARRIVED}`, replace: true });
  await page.getByRole("combobox", { name: "Folder Action folder" }).click();
  await page.getByRole("option", { name: `Documents/${DROP}`, exact: true }).click();
  await save(FOLDER);
  step(
    "The server keeps a Folder Action with its folder",
    (await saved(FOLDER))?.folder === dropId,
    JSON.stringify(await saved(FOLDER)),
  );
  await page.waitForTimeout(1_500);
  await uploadFile(page, { parent: dropId, name: "first.txt", type: "text/plain", text: "a" });
  step(
    "A file arriving in the folder runs the Folder Action on it",
    (await until(() => textOf(ARRIVED))) === `Documents/${DROP}/first.txt`,
    String(await textOf(ARRIVED)),
  );
  await reloadDesktop(page);
  await page.waitForTimeout(3_000);
  step(
    "A reload does not run it again on what is already there",
    (await runsBy("folder-action")).length === 1,
    `${(await runsBy("folder-action")).length} runs`,
  );
  await uploadFile(page, { parent: dropId, name: "second.txt", type: "text/plain", text: "b" });
  step(
    "After the reload, the next file that arrives runs it, once",
    (await until(async () => (await textOf(ARRIVED)) === `Documents/${DROP}/second.txt`)) ===
      true && (await until(async () => (await runsBy("folder-action")).length === 2)) === true,
    String(await textOf(ARRIVED)),
  );
  await page.waitForTimeout(2_000);
  step("It ran once for that file", (await runsBy("folder-action")).length === 2);

  // A Calendar Alarm.
  await launch(page, "Automator");
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
  const ALARM = `Wake ${tag}`;
  const RANG = `rang ${tag}.txt`;
  await newOf("Calendar Alarm", ALARM);
  await add("New Text File", { path: `Documents/${RANG}`, text: "rang" });
  await save(ALARM);
  const alarmId = `automator-alarm-${(await saved(ALARM)).id}`;
  const eventOf = async () =>
    (await api(page, "GET", "/api/calendar/events")).json.events?.find(
      (event) => event.id === alarmId,
    );
  const event = await eventOf();
  step(
    "Saving a Calendar Alarm adds an event with an alert to Calendar",
    event?.title === ALARM && event?.alert === 0 && event.start > Date.now(),
    JSON.stringify(event),
  );
  step("Nothing runs before the alert", (await runsBy("calendar-alarm")).length === 0);
  const document = (await api(page, "GET", "/api/calendar/events")).json;
  const start = Date.now() + 4_000;
  const moved = await api(page, "PUT", "/api/calendar/events", {
    events: document.events.map((each) =>
      each.id === alarmId ? { ...each, start, end: start + 1_800_000 } : each,
    ),
    rev: document.rev,
    session: document.session,
  });
  step("The event is moved to now, as Calendar would", moved.status === 200, `${moved.status}`);
  step(
    "The workflow runs when the event's alert shows",
    (await until(() => textOf(RANG), 60_000)) === "rang",
    String(await textOf(RANG)),
  );
  await reloadDesktop(page);
  await page.waitForTimeout(20_000);
  step(
    "A reload while the alert still shows does not run it again",
    (await runsBy("calendar-alarm")).length === 1,
    `${(await runsBy("calendar-alarm")).length} runs`,
  );

  // An Application.
  await launch(page, "Automator");
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
  const APP = `Hello ${tag}`;
  const SAID = `said ${tag}.txt`;
  await newOf("Application", APP);
  step(
    "Automator says a web page cannot make a real application",
    await page.getByText(/A web page cannot make a real application/).isVisible(),
  );
  await add("New Text File", { path: `Documents/${SAID}`, text: "hello", replace: true });
  await save(APP);
  await fileRow(/^Export/);
  const panel = page.getByRole("dialog", { name: "Export" });
  await panel.waitFor({ timeout: 5_000 });
  await panel
    .getByRole("treeitem", { name: "Documents" })
    .first()
    .click()
    .catch(() => {});
  await panel.getByRole("button", { name: "Save" }).click();
  await page
    .locator(".mac-automator-status")
    .getByText(`Exported “${APP}.app”`)
    .waitFor({ timeout: 10_000 });
  const appFile = await entryNamed(`${APP}.app`);
  step("File > Export… writes the Application's .app to the drive", Boolean(appFile));

  await launch(page, "Finder");
  await finder.waitFor({ timeout: 8_000 });
  const parent = (await api(page, "GET", "/api/files/")).json.entries.find(
    (entry) => entry.id === appFile.parent,
  );
  await finder.getByRole("treeitem", { name: parent.name }).first().click();
  const appItem = item(`${APP}\\.app`);
  await appItem.waitFor({ timeout: 8_000 });
  await appItem.dblclick();
  step(
    "Opening the Application from Finder runs it",
    (await until(() => textOf(SAID))) === "hello",
    String(await textOf(SAID)),
  );
  step(
    "Its run is logged as an Application's, and Automator did not open it for editing",
    (await until(async () => (await runsBy("application")).length === 1)) === true &&
      (await nameField.inputValue()) === APP,
  );

  // To the Dock.
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const box = await appItem.boundingBox();
  const divider = await dock.getByRole("separator").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 12, { steps: 4 });
  await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  step(
    "The Application's file can be dragged to the Dock, and the Dock keeps it",
    await until(async () =>
      (
        (await api(page, "GET", "/api/system-preferences/settings")).json?.values?.["dock.kept"] ??
        []
      ).includes(appFile.id),
    ),
  );
  await reloadDesktop(page);
  const tile = dock.getByRole("button", { name: `${APP}.app` });
  await tile.waitFor({ timeout: 10_000 });
  await tile.click();
  step(
    "After a reload, its Dock tile runs it",
    (await until(async () => (await runsBy("application")).length === 2)) === true,
  );
  await shot(page, path.join(out, `automator-types-batch6-${browserName}.png`));
});
