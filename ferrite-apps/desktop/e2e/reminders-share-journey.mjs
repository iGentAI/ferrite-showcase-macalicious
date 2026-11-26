#!/usr/bin/env node
// Share > Reminders on Ferrite: a link shared from Safari becomes a reminder.
//
// Chris signs up in a browser of his own and opens a page in Safari (example.com, through the
// application's egress). Its Share menu offers Reminders; choosing it opens Reminders, where a
// reminder titled with the page's title is added to the list shown, the page's address in its
// URL field, and saved. With Reminders closed, a second share is kept until Reminders opens and
// takes it. After a reload both are there, in the window and on the server; Anna, signed up in a
// browser of her own, has neither.
//
// Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error of the desktop's own origin (the page Safari shows is another
// origin's, and its own requests are not the desktop's).
//
//   node scripts/pack-site.mjs && ferrite dev --egress allow   # in ferrite-apps/desktop
//   node e2e/reminders-share-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]
//
// Needs `--egress allow` (Safari fetches the page through the application), and Reminders listed
// in `SHARE_RECEIVERS` (`demos/desktop/desktop-share-link.tsx`).

import path from "node:path";
import { options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const run = Date.now().toString(36);
const password = `tide-${run}-pool`;
const chris = { name: `chris-rs-${run}`, fullName: "Chris Share" };
const anna = { name: `anna-rs-${run}`, fullName: "Anna Share" };
const PAGE = "https://example.com/";
const PAGE_TITLE = "Example Domain";
const DATA = "/api/reminders/data";

const problems = [];
const steps = [];
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};
const ours = (page, url) => {
  try {
    return new globalThis.URL(url).origin === new globalThis.URL(page.url()).origin;
  } catch {
    return false;
  }
};

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const at = message.location()?.url ?? "";
    if (at && !ours(page, at)) return;
    problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    if (!ours(page, request.url())) return;
    // `ferrite dev`'s live-reload stream and the page's own requests cut short by a reload.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)) return;
    problems.push(`${label} request failed: ${request.url()} ${text}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && ours(page, response.url()))
      problems.push(`${label} HTTP ${response.status()} ${response.url()}`);
  });
}

/** `fetch` from inside the page, with the browser's own cookie. */
function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json().catch(() => null) };
    },
    { method, url, body },
  );
}

const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

async function signUp(browser, person, label) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const page = await context.newPage();
  watch(page, label);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.getByRole("group", { name: "Users" }).waitFor({ timeout: 20_000 });
  const made = await api(page, "POST", "/api/session/sign-up", {
    name: person.name,
    full_name: person.fullName,
    password,
  });
  step(`${person.fullName} creates an account`, made.status === 201, `HTTP ${made.status}`);
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 20_000 });
  return page;
}

const dock = (page, name) =>
  page
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${name}$`) }))
    .first();
const safari = (page) => page.getByRole("region", { name: "Safari", exact: true }).first();
const reminders = (page) => page.getByRole("region", { name: "Reminders" }).first();
const row = (window, title) =>
  window
    .getByRole("option")
    .filter({ has: window.page().locator(".mac-reminders-text", { hasText: title }) });

/** Safari's window, showing the page at `PAGE`. */
async function openPage(page) {
  await dock(page, "Safari").click();
  const field = safari(page).getByRole("textbox", { name: "Search or enter website name" });
  await field.waitFor({ timeout: 15_000 });
  const answered = page.waitForResponse(
    (response) => new globalThis.URL(response.url()).pathname === "/api/safari/page",
    { timeout: 30_000 },
  );
  await field.click();
  await field.fill(PAGE);
  await field.press("Enter");
  await answered;
  await safari(page).locator(`iframe[title="${PAGE_TITLE}"]`).waitFor({ timeout: 30_000 });
}

/** Share > Reminders in Safari's toolbar: whether the row was offered, and the save it caused. */
async function shareToReminders(page) {
  await safari(page).getByRole("button", { name: "Share" }).click();
  const item = page.getByRole("menuitem", { name: "Reminders" });
  await item.waitFor({ timeout: 5_000 });
  const offered = !(await item.isDisabled());
  if (!offered) {
    console.log(`note: Reminders row: ${await item.getAttribute("title")}`);
    await page.keyboard.press("Escape");
    return { offered, saved: null };
  }
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new globalThis.URL(response.url()).pathname === DATA &&
      JSON.parse(response.request().postData() ?? "{}").data?.reminders?.some(
        (each) => each.url === PAGE,
      ),
    { timeout: 15_000 },
  );
  await item.click();
  return { offered, saved };
}

const stored = async (page) =>
  ((await api(page, "GET", DATA)).json?.data?.reminders ?? []).filter((each) => each.url === PAGE);

const browser = await ENGINES[browserName].launch();
console.log(`reminders share in ${browserName}`);
const pages = [];
try {
  const page = await signUp(browser, chris, "chris");
  pages.push(page);
  await openPage(page);
  step("Safari shows the page", true, PAGE_TITLE);

  // Reminders open: the link is heard and becomes a reminder.
  await dock(page, "Reminders").click();
  await reminders(page).getByRole("button", { name: "New Reminder" }).waitFor({ timeout: 15_000 });
  await dock(page, "Safari").click();
  const first = await shareToReminders(page);
  step("Safari's Share menu offers Reminders", first.offered);
  if (!first.offered) throw new Error("Share > Reminders is dimmed");
  step(
    "Share > Reminders saves a reminder with the page's address",
    (await first.saved).status() === 200,
  );
  const made = row(reminders(page), PAGE_TITLE);
  await made.first().waitFor({ timeout: 10_000 });
  step(
    "the reminder is in the list shown, titled with the page's title, and selected",
    (await made.first().getAttribute("aria-selected")) === "true",
  );
  await made.first().locator("[data-reminder-info]").click();
  const info = page.getByRole("dialog").last();
  await info.waitFor({ timeout: 5_000 });
  step(
    "its info shows the page's address in the URL field",
    (await info.locator('input[type="url"]').inputValue()) === PAGE,
  );
  await page.keyboard.press("Escape");
  await shot(page, path.join(out, `reminders-share-${browserName}-open.png`));

  // Reminders closed: the link is kept, and taken when Reminders opens.
  await reminders(page).getByRole("button", { name: "Close" }).first().click();
  await reminders(page).waitFor({ state: "detached", timeout: 10_000 });
  await dock(page, "Safari").click();
  const second = await shareToReminders(page);
  step(
    "with Reminders closed, Share > Reminders opens it and the kept link is saved",
    second.offered && (await second.saved).status() === 200,
  );
  await row(reminders(page), PAGE_TITLE).nth(1).waitFor({ timeout: 10_000 });
  step("Reminders shows both reminders", (await row(reminders(page), PAGE_TITLE).count()) === 2);

  // A reload keeps both; another account has neither.
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 20_000 });
  await dock(page, "Reminders").click();
  await row(reminders(page), PAGE_TITLE).nth(1).waitFor({ timeout: 15_000 });
  const kept = await stored(page);
  step(
    "after a reload both are in the window and on the server, each titled and with its address",
    kept.length === 2 && kept.every((each) => each.title === PAGE_TITLE),
    JSON.stringify(kept.map((each) => [each.title, each.listId])),
  );
  const annaPage = await signUp(browser, anna, "anna");
  pages.push(annaPage);
  step("Anna has neither, on the server", (await stored(annaPage)).length === 0);
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
  for (const [index, page] of pages.entries())
    await shot(page, path.join(out, `reminders-share-${browserName}-aborted-${index}.png`));
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\nreminders share: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\nreminders share: all ${steps.length} steps passed with no console errors`);
