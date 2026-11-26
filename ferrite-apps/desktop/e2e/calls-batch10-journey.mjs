#!/usr/bin/env node
// The rows recorded as calls that a page can do, on the served desktop. Split View: the other side shows the
// live windows, scaled. Mail: a send forgets a draft its window saved on the way out, in both orders, and through
// a Force Quit with the send held by a route stub (the one stand-in, which delays the real request and lets it
// through). Safari: the reader-only reply News reads, against the live site. Automator: the toolbar's order and
// what it hides, its context menu, and Results as a table, read from the server across a reload.
//
//   node e2e/calls-batch10-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out } = options();
const tag = Date.now().toString(36);
const { step, run } = journey("calls-batch10", { ignoreOtherOrigins: true });

const settings = async (page) =>
  (await api(page, "GET", "/api/system-preferences/settings")).json.values ?? {};

async function splitView(page) {
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const chooser = page.getByRole("dialog", { name: "Split View" });
  await launch(page, "Finder");
  await shell("finder").waitFor({ timeout: 8_000 });
  await launch(page, "Chess");
  await shell("chess").waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  const from = await shell("finder").boundingBox();
  await chooseMenu(page, "Window", "Tile Window to Left of Screen");
  await chooser.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(400);
  const choice = chooser.getByRole("button").first();
  const onButton = await choice.boundingBox();
  const live = await shell("finder").boundingBox();
  step(
    "Split View: the choice stands over the live window, on the other side",
    Math.abs(onButton.x - live.x) < 1.5 &&
      Math.abs(onButton.y - live.y) < 1.5 &&
      Math.abs(onButton.width - live.width) < 1.5 &&
      Math.abs(onButton.height - live.height) < 1.5 &&
      live.x >= 700,
    JSON.stringify({ onButton, live }),
  );
  step(
    "Split View: it is the window, drawn, not an app tile and a title",
    (await choice.innerText()).trim() === "" &&
      (await shell("finder").getByRole("toolbar").count()) > 0 &&
      (await shell("finder").evaluate((each) => getComputedStyle(each).visibility)) === "visible",
    await choice.getAttribute("aria-label"),
  );
  const atPoint = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.className ?? "",
    { x: onButton.x + onButton.width / 2, y: onButton.y + onButton.height / 2 },
  );
  step(
    "Split View: a press there reaches the choice, not the window",
    String(atPoint).includes("mac-desktop-shell-split-choice"),
    String(atPoint),
  );
  await shot(page, path.join(out, "calls-split-chooser.png"));
  await page.keyboard.press("Escape");
  await chooser.waitFor({ state: "detached", timeout: 4_000 });
  await page.waitForTimeout(400);
  const back = await shell("finder").boundingBox();
  step(
    "Split View: Escape gives the live window back where it stood",
    Math.abs(back.x - from.x) < 1 && Math.abs(back.width - from.width) < 1,
    JSON.stringify(back),
  );
  await chooseMenu(page, "Window", "Tile Window to Left of Screen");
  await chooser.waitFor({ timeout: 4_000 });
  await chooser.getByRole("button").first().click();
  await chooser.waitFor({ state: "detached", timeout: 4_000 });
  const divider = page.getByRole("separator", { name: "Split View divider" });
  await divider.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(400);
  const tiled = await shell("finder").boundingBox();
  step(
    "Split View: choosing tiles that window on its side at full size",
    tiled.x > 700 &&
      tiled.height > 700 &&
      (await shell("finder").getAttribute("style")).includes("z-index"),
    JSON.stringify(tiled),
  );
  await shot(page, path.join(out, "calls-split-tiled.png"));
  await shell("finder").getByRole("button", { name: /Close/ }).first().click();
  await divider.waitFor({ state: "detached", timeout: 6_000 });
}

async function mailDrafts(page, name) {
  const message = (subject) => ({
    to: [name],
    cc: [],
    bcc: [],
    subject,
    text: "Same words",
    attachments: [],
  });
  const copies = async (subject) =>
    ((await api(page, "GET", "/api/mail/messages")).json.messages ?? [])
      .filter((each) => each.subject === subject)
      .map((each) => each.mailbox)
      .sort();

  const first = `Draft first ${tag}`;
  await api(page, "POST", "/api/mail/drafts", message(first));
  const saved = (await copies(first)).join();
  const sentFirst = await api(page, "POST", "/api/mail/send", message(first));
  const left = (await copies(first)).join();
  step(
    "Mail: the send forgets a draft of its text it does not name, read from the server",
    saved === "drafts" && sentFirst.status === 201 && left === "inbox,sent",
    `${saved}, then ${sentFirst.status}, ${left}`,
  );

  const second = `Send first ${tag}`;
  const sentSecond = await api(page, "POST", "/api/mail/send", message(second));
  const late = await api(page, "POST", "/api/mail/drafts", message(second));
  const afterLate = (await copies(second)).join();
  step(
    "Mail: a draft of a message just delivered is not kept",
    sentSecond.status === 201 &&
      late.status === 200 &&
      late.json.message === null &&
      afterLate === "inbox,sent",
    `${sentSecond.status}, ${late.status} ${JSON.stringify(late.json)}, ${afterLate}`,
  );
  const other = await api(page, "POST", "/api/mail/drafts", {
    ...message(second),
    text: "Other words",
  });
  const afterOther = (await copies(second)).join();
  step(
    "Mail: a draft with other words is kept",
    other.status === 200 && afterOther === "drafts,inbox,sent",
    afterOther,
  );

  const subject = `Held ${tag}`;
  await launch(page, "Mail");
  const mail = page.locator(".mac-mail").first();
  await mail.waitFor({ timeout: 15_000 });
  await mail.getByRole("button", { name: "New Message" }).click();
  const compose = page.locator(".mac-mail-compose").first();
  const to = compose.getByLabel("To:");
  await to.click();
  await to.pressSequentially(name);
  await to.press("Enter");
  await compose.getByLabel("Subject:").fill(subject);
  let release;
  const released = new Promise((resolve) => {
    release = resolve;
  });
  let asked = false;
  const SEND = /\/api\/mail\/send(?:\?|$)/;
  await page.route(SEND, async (route) => {
    asked = true;
    await released;
    await route.continue();
  });
  await compose.getByRole("button", { name: "Send" }).click();
  await until(async () => asked, 5_000);
  await page.getByRole("menubar").getByRole("menuitem", { name: "Apple" }).click();
  await page.getByRole("menuitem", { name: /^Force Quit/ }).click();
  const quit = page.locator('[data-window-id="force-quit"]');
  await quit.waitFor({ timeout: 5_000 });
  await quit
    .getByRole("listbox", { name: "Applications" })
    .getByRole("option", { name: "Mail", exact: true })
    .click();
  await quit.getByRole("button", { name: "Force Quit", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Force Quit", exact: true }).click();
  await until(async () => (await page.locator(".mac-mail-compose").count()) === 0, 5_000);
  await quit.waitFor({ state: "detached", timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
  const whileHeld = (await copies(subject)).join();
  const sent = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/mail/send",
    { timeout: 10_000 },
  );
  release();
  const status = await sent.then((response) => response.status()).catch(() => 0);
  await page.unroute(SEND);
  await page.waitForTimeout(500);
  const after = (await copies(subject)).join();
  step(
    "Force Quit during a send: delivered, in Sent and the Inbox, and its draft gone",
    whileHeld === "drafts" && status === 201 && after === "inbox,sent",
    `while held: ${whileHeld}; ${status}; ${after}`,
  );
  await reloadDesktop(page);
  const reloaded = (await copies(subject)).join();
  step("Force Quit during a send: no draft after a reload", reloaded === "inbox,sent", reloaded);
}

async function safariReader(page) {
  const address = "https://en.wikipedia.org/wiki/Aqua_(user_interface)";
  const url = `/api/safari/page?url=${encodeURIComponent(address)}&private=1`;
  const whole = (await api(page, "GET", url)).json;
  const reading = (await api(page, "GET", `${url}&reader=1`)).json;
  const sizes = `${JSON.stringify(whole).length} bytes whole, ${JSON.stringify(reading).length} reader-only`;
  if (whole.ok !== true) {
    console.log(`note Safari could not read the live site here: ${whole.kind}`);
    step(
      "Safari: the reader-only reply says what the page's says",
      reading.ok === false && reading.kind === whole.kind,
      `${whole.kind}; the article was NOT read back from a live page`,
    );
    return;
  }
  step(
    "Safari: the reader-only reply has the same article and no page, from the live site",
    reading.ok === true &&
      !("html" in reading) &&
      typeof whole.html === "string" &&
      JSON.stringify(reading.reader) === JSON.stringify(whole.reader) &&
      JSON.stringify(reading).length < JSON.stringify(whole).length,
    `${sizes}, ${(reading.reader ?? []).length} blocks`,
  );
}

async function automator(page) {
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  await launch(page, "Automator");
  const window = page.locator('[data-window-id="automator"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const actions = page.getByRole("grid", { name: "Actions" });
  await actions.waitFor({ state: "visible", timeout: 15_000 });
  await actions.getByText(ACTION).first().waitFor({ state: "visible", timeout: 15_000 });
  const toolbar = window.getByRole("toolbar", { name: "Toolbar" });
  const names = async () =>
    (await toolbar.locator(".mac-toolbar-labelled-item").allInnerTexts()).map((each) =>
      each.trim(),
    );

  await chooseMenu(page, "View", /^Customize Toolbar/);
  const sheet = page.getByRole("dialog", { name: /items the toolbar shows/ });
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("button", { name: "Move Library Later" }).click();
  await sheet.getByRole("checkbox", { name: "Record" }).click();
  await sheet.getByRole("button", { name: "Move Flexible Space Later" }).click();
  await shot(page, path.join(out, "calls-automator-customize.png"));
  await sheet.getByRole("button", { name: "Done" }).click();
  await sheet.waitFor({ state: "detached", timeout: 4_000 });
  const shown = await names();
  step(
    "Automator: the toolbar takes the new order, without what is hidden",
    shown.join() === "Media,Library,Step,Stop,Run",
    shown.join(),
  );
  const box = await toolbar.boundingBox();
  step("Automator: the toolbar stands as tall as it did", box.height === 46, `${box.height}`);
  await until(async () => (await settings(page))["automator.toolbarOrder"]?.[0] === "Media", 6_000);
  const values = await settings(page);
  step(
    "Automator: the order and what is hidden are on the server",
    JSON.stringify(values["automator.toolbarOrder"]) ===
      JSON.stringify(["Media", "Library", "Record", "Flexible Space", "Step", "Stop", "Run"]) &&
      JSON.stringify(values["automator.toolbarHidden"]) === JSON.stringify(["Record"]),
    JSON.stringify(values["automator.toolbarOrder"]),
  );
  await page.mouse.click(box.x + box.width / 2, box.y + 8, { button: "right" });
  const menu = page.getByRole("menu", { name: "Toolbar commands" });
  await menu.waitFor({ timeout: 4_000 });
  await menu.getByRole("menuitem", { name: "Hide Toolbar" }).click();
  await toolbar.waitFor({ state: "detached", timeout: 4_000 });
  step("Automator: the toolbar's own menu hides it", (await toolbar.count()) === 0);
  await chooseMenu(page, "View", "Show Toolbar");
  await toolbar.waitFor({ timeout: 4_000 });

  await actions.getByText(ACTION, { exact: true }).first().dblclick();
  const area = page.locator('section[aria-label="Workflow"]');
  const group = area.locator(`[role="group"][aria-label="${ACTION}"]`);
  await group.waitFor({ timeout: 5_000 });
  await group.getByRole("textbox").first().fill("first line\nsecond line");
  await group.getByRole("button", { name: "Results" }).click();
  await toolbar
    .locator(".mac-toolbar-labelled-item", { hasText: "Run" })
    .getByRole("button")
    .click();
  const results = group.getByRole("group", { name: `Results of ${ACTION}` });
  await results.getByText("Table", { exact: true }).waitFor({ timeout: 15_000 });
  await results.getByText("Table", { exact: true }).click();
  const table = results.getByRole("grid", { name: `Items of ${ACTION}` });
  await table.waitFor({ timeout: 4_000 });
  const cells = await table.getByRole("row").allInnerTexts();
  step(
    "Automator: Results as a table holds the run's items, numbered",
    cells.length >= 2 && cells.slice(1).every((row, at) => row.startsWith(String(at + 1))),
    cells.join(" | ").replace(/\n/g, " "),
  );
  await shot(page, path.join(out, "calls-automator-results.png"));
  await until(async () => (await settings(page))["automator.resultsTable"] === true, 6_000);
  step(
    "Automator: the choice of a table is on the server",
    (await settings(page))["automator.resultsTable"] === true,
  );

  await reloadDesktop(page);
  const after = page.locator('[data-window-id="automator"]').first();
  if ((await after.count()) === 0) await launch(page, "Automator");
  await toolbar.waitFor({ timeout: 15_000 });
  await until(async () => (await names())[0] === "Media", 8_000);
  const kept = await names();
  step(
    "Automator: the order and what is hidden come back after a reload",
    kept.join() === "Media,Library,Step,Stop,Run",
    kept.join(),
  );
}

const ACTION = "Get Specified Text";

await run(async (page) => {
  await page.goto(`${base}/`, { waitUntil: "load" });
  const name = `calls${tag}`;
  await createAccount(page, { name, fullName: `Calls ${tag}`, password: `pw-${tag}-calls` });
  await splitView(page);
  await safariReader(page);
  await mailDrafts(page, name);
  await automator(page);
});
