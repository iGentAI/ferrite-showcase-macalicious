#!/usr/bin/env node
// Notifications on Ferrite: Alice on two browsers, Bob on a third, each signed in to an account of
// their own. What happens to Alice reaches every browser she has open, at once, and never Bob's:
//
//   * Bob writes in a Messages room Alice reads: a banner comes in on both of Alice's browsers;
//   * a page of Alice's raises a notification (a finished download): both her browsers show it,
//     Bob's shows nothing and his Notification Center holds none of it;
//   * Notification Center lists her notifications by app; Clear in one browser clears them in
//     the other;
//   * Do Not Disturb, turned on in one browser, silences banners in both, while notifications
//     still collect in Notification Center;
//   * Today shows her own Calendar events, Reminders due and Stocks watchlist;
//   * a contact card she saves in one browser appears in the other's Contacts window, live.
//
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev --egress allow    # in ferrite-apps/desktop
//   node e2e/notifications-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]
//
// Accounts are made fresh for each run, so the journey can run again against one deployment.

import path from "node:path";
import { options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const run = Date.now().toString(36);
const password = `tide-${run}-pool`;
const alice = { name: `alice-${run}`, fullName: "Alice" };
const bob = { name: `bob-${run}`, fullName: "Bob" };
const room = `nj-${run}`;
const sender = `Bob ${run}`;

const problems = [];
const steps = [];
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};

function watch(page, label) {
  // Two browsers of one account save the settings over each other: the loser's 409 is how it learns
  // to merge and write again.
  const lostSave = (text) => /status of 409/.test(text);
  page.on("console", (message) => {
    if (message.type() === "error" && !lostSave(message.text()))
      problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    // Streams the page closes itself: `ferrite dev`'s live reload and the desktop's `/live/`
    // streams (the personal stream it renews, a Messages feed). Nothing else is excused.
    const url = request.url();
    const stream = url.includes("/__forge/reload") || new URL(url).pathname.startsWith("/live/");
    if (stream && /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)) return;
    problems.push(`${label} request failed: ${url} ${text}`);
  });
  page.on("response", (response) => {
    if (response.status() === 409 && response.url().includes("/api/system-preferences/settings"))
      return;
    if (response.status() >= 400)
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
const userTile = (page, name) =>
  page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
const banner = (page, name) =>
  page.locator(".mac-desktop-shell-banners").getByRole("status", { name, exact: true });
const ncButton = (page) =>
  page.getByRole("menuitem", { name: "Notification Center", exact: true }).first();
const panel = (page) => page.getByRole("complementary", { name: "Notification Center" });

async function desktopShown(page) {
  await finder(page).waitFor({ timeout: 20_000 });
  return finder(page).isVisible();
}

async function createAccount(page, person) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Create Account…").click({ timeout: 20_000 });
  const form = page.getByRole("form", { name: "Create Account" });
  await form.getByLabel("Full Name:").fill(person.fullName);
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
}

async function logIn(page, person) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Other…").click({ timeout: 20_000 });
  const form = page.getByRole("form", { name: "Log In" });
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByRole("button", { name: "Log In" }).click();
}

/** Whether `locator` becomes visible within `ms`. */
async function appears(locator, ms = 10_000) {
  try {
    await locator.waitFor({ state: "visible", timeout: ms });
    return true;
  } catch {
    return false;
  }
}

/** Whether the personal stream of `page` has connected (Do Not Disturb's switch is enabled). */
async function streamReady(page) {
  await ncButton(page).click();
  const toggle = panel(page).getByRole("switch", { name: "Do Not Disturb" });
  const ready = await appears(toggle);
  try {
    await page.waitForFunction(
      () => {
        const toggle = document.querySelector(
          'aside[aria-label="Notification Center"] [role="switch"]',
        );
        return (
          toggle !== null &&
          toggle.getAttribute("aria-disabled") !== "true" &&
          !toggle.hasAttribute("data-disabled")
        );
      },
      null,
      { timeout: 15_000 },
    );
  } catch {
    return false;
  }
  await page.keyboard.press("Escape");
  return ready;
}

console.log(`notifications in ${browserName} against ${base}`);
const browser = await ENGINES[browserName].launch();
try {
  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const contexts = [];
  const open = async (label) => {
    const context = await browser.newContext(contextOptions);
    contexts.push(context);
    const page = await context.newPage();
    watch(page, label);
    return page;
  };
  const a1 = await open("alice-1");
  await createAccount(a1, alice);
  step("Alice's account opens her desktop", await desktopShown(a1));
  const a2 = await open("alice-2");
  await logIn(a2, alice);
  step("Alice signs in on a second browser", await desktopShown(a2));
  const b = await open("bob");
  await createAccount(b, bob);
  step("Bob's account opens his own desktop", await desktopShown(b));
  for (const [page, who] of [
    [a1, "Alice's first browser"],
    [a2, "Alice's second browser"],
    [b, "Bob's browser"],
  ]) {
    step(`${who} connects to its person's live stream`, await streamReady(page));
  }

  // 1. A message from Bob in a room Alice reads.
  const joined = await api(a1, "GET", `/api/messages/rooms/${room}`);
  step("Alice reads a Messages room", joined.status === 200);
  const said = await api(b, "POST", `/api/messages/rooms/${room}`, {
    name: sender,
    text: `Lunch at one? ${run}`,
  });
  step("Bob writes in it", said.status === 201, `HTTP ${said.status}`);
  const onA1 = await appears(banner(a1, sender));
  const onA2 = await appears(banner(a2, sender));
  step("a banner comes in on both of Alice's browsers", onA1 && onA2);
  step(
    "the banner shows the message",
    (await banner(a1, sender).textContent())?.includes(`Lunch at one? ${run}`) ?? false,
  );
  await shot(a1, path.join(out, `notifications-banner-${browserName}.png`));
  step("Bob, who wrote it, is not told", (await banner(b, sender).count()) === 0);

  // 2. A notification one of Alice's pages raises (a finished download).
  const title = `Download Finished ${run}`;
  const raised = await api(a2, "POST", "/api/notification-center/notify", {
    app: "finder",
    title,
    body: "report.pdf",
  });
  step("Alice's page raises a notification", raised.status === 201, `HTTP ${raised.status}`);
  step(
    "it comes in on both of her browsers",
    (await appears(banner(a1, title))) && (await appears(banner(a2, title))),
  );
  await b.waitForTimeout(2_000);
  step("Bob's browser shows none of it", (await b.getByText(title).count()) === 0);
  const bobInbox = await api(b, "GET", "/api/notification-center/inbox");
  step(
    "Bob's Notification Center holds nothing of Alice's",
    bobInbox.status === 200 &&
      !JSON.stringify(bobInbox.json).includes(run.toString()) &&
      bobInbox.json?.items?.length === 0,
    JSON.stringify(bobInbox.json),
  );

  // 3. Notification Center, and Clear across browsers: both of Alice's panels are open, and the
  //    clear in one takes the group off the other while it is showing.
  await ncButton(a1).click();
  await panel(a1).getByRole("tab", { name: "Notifications" }).click();
  const otherFinder = panel(a1).getByRole("region", { name: "Finder" });
  await appears(otherFinder);
  await ncButton(a2).click();
  await panel(a2).getByRole("tab", { name: "Notifications" }).click();
  const finderGroup = panel(a2).getByRole("region", { name: "Finder" });
  const messagesGroup = panel(a2).getByRole("region", { name: "Messages" });
  step(
    "Notification Center lists her notifications by app",
    (await appears(finderGroup)) &&
      (await appears(messagesGroup)) &&
      ((await messagesGroup.textContent())?.includes(sender) ?? false) &&
      (await otherFinder.isVisible()),
  );
  await shot(a2, path.join(out, `notifications-center-${browserName}.png`));
  await finderGroup.getByRole("button", { name: "Clear Finder" }).click();
  const gone = await (async () => {
    try {
      await otherFinder.waitFor({ state: "detached", timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  })();
  step(
    "Clear in one browser clears the other",
    gone && (await appears(panel(a1).getByRole("region", { name: "Messages" }))),
    `Finder gone: ${gone}`,
  );
  await a1.keyboard.press("Escape");
  await a2.keyboard.press("Escape");

  // 4. Do Not Disturb.
  await ncButton(a1).click();
  await panel(a1).getByRole("switch", { name: "Do Not Disturb" }).click();
  await a1.keyboard.press("Escape");
  const dnd = await a2.waitForFunction(
    async () => {
      const reply = await fetch("/api/notification-center/inbox", { credentials: "same-origin" });
      return (await reply.json()).dnd === true;
    },
    null,
    { timeout: 10_000 },
  );
  step("Do Not Disturb is on for Alice", Boolean(dnd));
  await a2
    .locator('[aria-label="Notification Center"][data-dnd]')
    .first()
    .waitFor({ timeout: 10_000 });
  step("her other browser dims Notification Center's glyph", true);
  const quiet = `Quiet ${run}`;
  await api(a1, "POST", "/api/notification-center/notify", { app: "finder", title: quiet });
  await a1.waitForTimeout(2_000);
  step(
    "with Do Not Disturb on, no banner comes in",
    (await banner(a1, quiet).count()) === 0 && (await banner(a2, quiet).count()) === 0,
  );
  await ncButton(a2).click();
  await panel(a2).getByRole("tab", { name: "Notifications" }).click();
  step(
    "it still collects in Notification Center",
    await appears(panel(a2).getByText(quiet).first()),
  );
  await panel(a2).getByRole("tab", { name: "Today" }).click();
  await panel(a2).getByRole("switch", { name: "Do Not Disturb" }).click();
  await a2.keyboard.press("Escape");
  const loud = `Loud ${run}`;
  await a2.waitForFunction(
    async () => {
      const reply = await fetch("/api/notification-center/inbox", { credentials: "same-origin" });
      return (await reply.json()).dnd === false;
    },
    null,
    { timeout: 10_000 },
  );
  await a1.waitForTimeout(1_000);
  await api(a2, "POST", "/api/notification-center/notify", { app: "finder", title: loud });
  step(
    "turned off in her other browser, banners come in again on both",
    (await appears(banner(a1, loud))) && (await appears(banner(a2, loud))),
  );

  // 5. Today: Alice's own Calendar, Reminders and Stocks (Stocks when the build has its module).
  const event = `Standup ${run}`;
  const modules = await api(a1, "GET", "/api/apps");
  const hasStocks = (modules.json?.apps ?? []).some((app) => app.name === "stocks");
  const saved = await a1.evaluate(
    async ({ event, hasStocks }) => {
      // Under way now and ending later today, so it is today's whatever the hour.
      const now = Date.now();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const start = now - 60_000;
      const end = Math.min(now + 30 * 60_000, midnight.getTime() - 1);
      const put = (url, body) =>
        fetch(url, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }).then((r) => r.status);
      const day = new Date(now);
      const two = (n) => String(n).padStart(2, "0");
      const today = `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`;
      const nine = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9).getTime();
      return {
        calendar: await put("/api/calendar/events", {
          events: [{ id: "nj", title: event, start, end, calendar: "work" }],
          rev: 0,
        }),
        reminders: await put("/api/reminders/data", {
          base: 0,
          data: {
            lists: [{ id: "l1", name: "Reminders", color: "blue" }],
            reminders: [{ id: "r1", listId: "l1", title: `Water plants ${event}`, due: today }],
          },
          alerts: { r1: nine },
        }),
        stocks: hasStocks ? await put("/api/stocks/watchlist", { symbols: ["AAPL"], rev: 0 }) : 200,
      };
    },
    { event, hasStocks },
  );
  step(
    "Alice saves an event, a reminder and a watchlist",
    Object.values(saved).every((s) => s === 200),
    JSON.stringify(saved),
  );
  await ncButton(a2).click();
  const calendar = panel(a2).getByRole("region", { name: "Calendar" });
  step("Today's Calendar widget shows her event", await appears(calendar.getByText(event)));
  const reminders = panel(a2).getByRole("region", { name: "Reminders" });
  step(
    "Today's Reminders widget shows what is due",
    await appears(reminders.getByText(`Water plants ${event}`)),
  );
  const stocks = panel(a2).getByRole("region", { name: "Stocks" });
  if (hasStocks) {
    step(
      "Today's Stocks widget lists her watchlist",
      await appears(stocks.getByText("AAPL", { exact: true })),
    );
    const quoted = (await stocks.getByText("No quote").count()) === 0;
    console.log(
      `note Stocks widget: ${quoted ? "a live AAPL quote is shown" : "no quote (egress refused?)"}`,
    );
  } else {
    console.log("note this build registers no Stocks module: no Stocks widget is shown");
    step("no Stocks widget without a Stocks module", (await stocks.count()) === 0);
  }
  step(
    "Bob's Today shows none of Alice's data",
    await (async () => {
      await ncButton(b).click();
      const ok = await appears(panel(b).getByRole("region", { name: "Calendar" }));
      const leaked = await panel(b).getByText(event).count();
      await b.keyboard.press("Escape");
      return ok && leaked === 0;
    })(),
  );
  await shot(a2, path.join(out, `notifications-today-${browserName}.png`));
  await a2.keyboard.press("Escape");

  // 6. A change in one browser appears in the other, live.
  const card = `Lovelace${run}`;
  await a2
    .getByRole("button", { name: /^Contacts$/ })
    .or(a2.getByRole("link", { name: /^Contacts$/ }))
    .first()
    .click();
  const contacts = a2.getByRole("region", { name: "Contacts" }).first();
  await contacts.waitFor({ state: "visible", timeout: 10_000 });
  await a2.waitForTimeout(1_000);
  const current = await api(a1, "GET", "/api/contacts/cards");
  const cardSaved = await api(a1, "PUT", "/api/contacts/cards", {
    cards: [{ id: "nj-1", account: "icloud", first: "Ada", last: card }],
    rev: current.json?.rev ?? 0,
  });
  step(
    "Alice saves a contact card in her first browser",
    cardSaved.status === 200,
    `HTTP ${cardSaved.status}`,
  );
  step(
    "her other browser's open Contacts window shows it without a reload",
    await appears(contacts.getByRole("option", { name: `Ada ${card}` }), 15_000),
  );
  const bobsCards = await api(b, "GET", "/api/contacts/cards");
  step(
    "Bob's contacts hold none of it",
    bobsCards.status === 200 && !JSON.stringify(bobsCards.json).includes(card),
    JSON.stringify(bobsCards.json?.cards ?? null),
  );
  await shot(a2, path.join(out, `notifications-live-${browserName}.png`));

  for (const context of contexts) await context.close();
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  await browser.close();
}

console.log(`screenshots in ${out}`);
if (problems.length > 0) {
  console.error(
    `\nnotifications: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\nnotifications: all ${steps.length} steps passed with no console errors`);
