#!/usr/bin/env node
// Accounts on Ferrite: two people, two desktops. Chris and Martin each create
// an account at the login window, in browsers of their own, and each gets a
// desktop of their own: a contact card Chris saves is in Chris's Contacts only,
// and Martin's in Martin's. Then, in Chris's browser: Lock Screen and unlock,
// fast user switching to Martin through the menu bar's user menu, Log Out,
// and signing in again as Chris from the login window's list. A guest gets an
// empty desktop of its own; a browser that held data before anyone signed in
// is asked, once, whether to keep it in the new account.
//
// Exits 0 only when every step passed and no page logged a console error, a
// page error, a failed request or an HTTP error other than the refusals the
// journey provokes on purpose (a wrong password: 401; an app read while the
// screen is locked: 423).
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/accounts-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                 [--browser chromium|chrome|firefox|webkit]
//
// Accounts are made fresh for each run (`chris-<run>`, `martin-<run>`), so the
// journey can run again against the same deployment.

import path from "node:path";
import { options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const run = Date.now().toString(36);
const password = `tide-${run}-pool`;
// Each person keeps one contact card of their own; its name shows in Contacts' list.
const chris = { name: `chris-${run}`, fullName: "Chris", card: ["Ada", `Lovelace${run}`] };
const martin = { name: `martin-${run}`, fullName: "Martin", card: ["Grace", `Hopper${run}`] };
const cardName = (person) => person.card.join(" ");

const problems = [];
const steps = [];
/** Refusals a step provokes on purpose: `${status} ${path}` -> how many are expected. */
const allowed = new Map();
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};
const allow = (status, pathname) => {
  const key = `${status} ${pathname}`;
  allowed.set(key, (allowed.get(key) ?? 0) + 1);
};

function watch(page, label) {
  // A page whose session another tab, or its own switch, has just replaced is refused (409)
  // until it has loaded again.
  const switches = label === "chris" || label === "chris-tab";
  const stale = (status) => switches && status === 409;
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The browser's own line for a refusal this journey provoked.
    if (/status of (401|423)/.test(message.text())) return;
    if (switches && /status of 409/.test(message.text())) return;
    problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    // `ferrite dev`'s live-reload stream and the page's own requests cut short by a reload.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(text)) return;
    // The page's own live streams, which it closes on Lock Screen, a switch or Log Out: Firefox
    // names a stream closed that way NS_ERROR_ABORT.
    if (/NS_ERROR_ABORT/.test(text) && new URL(request.url()).pathname.startsWith("/live/")) return;
    problems.push(`${label} request failed: ${request.url()} ${text}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400 || stale(response.status())) return;
    const key = `${response.status()} ${new URL(response.url()).pathname}`;
    const left = allowed.get(key) ?? 0;
    if (left > 0) allowed.set(key, left - 1);
    else problems.push(`${label} HTTP ${key}`);
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
const passwordField = (page) => page.getByRole("textbox", { name: "Enter Password" });
const menuTitle = (page, name) =>
  page
    .getByRole("menuitem", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first();
const menuItem = (page, name) => page.getByRole("menuitem", { name }).first();

async function desktopShown(page) {
  await finder(page).waitFor({ timeout: 20_000 });
  return finder(page).isVisible();
}

/** The login window's Create Account… form, filled in and sent. */
async function createAccount(page, person) {
  await userTile(page, "Create Account…").click();
  const form = page.getByRole("form", { name: "Create Account" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Full Name:").fill(person.fullName);
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
}

/** Save `card` (first and last name) as the browser's one contact card. */
async function writeCard(page, [first, last]) {
  const saved = await api(page, "PUT", "/api/contacts/cards", {
    cards: [{ id: "new-1", account: "icloud", first, last }],
    rev: 0,
  });
  return saved.status === 200;
}

/** Open Contacts from the Dock and wait for the row of the card named `name`. */
async function openContacts(page, name) {
  await page
    .getByRole("button", { name: /^Contacts$/ })
    .or(page.getByRole("link", { name: /^Contacts$/ }))
    .first()
    .click();
  const window = page.getByRole("region", { name: "Contacts" }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const row = window.getByRole("option", { name });
  await row.waitFor({ state: "visible", timeout: 10_000 });
  return { window, row };
}

async function cardsOf(page) {
  const reply = await api(page, "GET", "/api/contacts/cards");
  return { status: reply.status, text: JSON.stringify(reply.json?.cards ?? null) };
}

console.log(`accounts in ${browserName} against ${base}`);
const browser = await ENGINES[browserName].launch();
try {
  const contextOptions = { viewport: { width: 1440, height: 900 } };

  // Chris, in a browser of his own.
  const chrisContext = await browser.newContext(contextOptions);
  const page = await chrisContext.newPage();
  watch(page, "chris");
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Guest User").waitFor({ timeout: 20_000 });
  step(
    "a visitor sees the login window, not the desktop",
    (await userTile(page, "Other…").isVisible()) &&
      (await userTile(page, "Create Account…").isVisible()) &&
      !(await finder(page).isVisible()),
  );
  await createAccount(page, chris);
  step("Chris's account opens his desktop", await desktopShown(page));
  const session = await api(page, "GET", "/api/session");
  step(
    "the session is Chris's",
    session.json?.account?.name === chris.name && session.json?.account?.full_name === "Chris",
    JSON.stringify(session.json?.account),
  );
  step("the menu bar names Chris", await menuTitle(page, "Chris").isVisible());
  step("Chris saves a contact card", await writeCard(page, chris.card));
  const chrisContacts = await openContacts(page, cardName(chris));
  step("Chris's desktop shows his card", await chrisContacts.row.isVisible());
  await shot(page, path.join(out, `accounts-chris-${browserName}.png`));

  // A second tab of Chris's browser shares his session.
  const tab = await chrisContext.newPage();
  watch(tab, "chris-tab");
  await tab.goto(`${base}/`, { waitUntil: "load" });
  step("a second tab of Chris's browser opens his desktop", await desktopShown(tab));

  // Martin, in another browser.
  const martinContext = await browser.newContext(contextOptions);
  const other = await martinContext.newPage();
  watch(other, "martin");
  await other.goto(`${base}/`, { waitUntil: "load" });
  await userTile(other, "Guest User").waitFor({ timeout: 20_000 });
  step(
    "Martin's fresh browser lists no one's account",
    !(await userTile(other, "Chris").isVisible()),
  );
  await createAccount(other, martin);
  step("Martin's account opens his own desktop", await desktopShown(other));
  const empty = await cardsOf(other);
  step(
    "Martin's desktop has none of Chris's data",
    empty.status === 200 && empty.text === "null",
    empty.text,
  );
  step("Martin saves a contact card", await writeCard(other, martin.card));
  const martinContacts = await openContacts(other, cardName(martin));
  step(
    "Martin's desktop shows his card and not Chris's",
    (await martinContacts.row.isVisible()) && (await other.getByText(chris.card[1]).count()) === 0,
  );
  step("the menu bar names Martin", await menuTitle(other, "Martin").isVisible());
  await shot(other, path.join(out, `accounts-martin-${browserName}.png`));
  const chrisAgain = await cardsOf(page);
  step(
    "Chris's data is still only his",
    chrisAgain.text.includes(chris.card[1]) && !chrisAgain.text.includes(martin.card[1]),
    chrisAgain.text,
  );

  // Lock Screen, in Chris's browser.
  await menuTitle(page, "Apple").click();
  await menuItem(page, "Lock Screen").click();
  await passwordField(page).waitFor({ timeout: 10_000 });
  step("Lock Screen hides Chris's desktop", !(await finder(page).isVisible()));
  allow(423, "/api/contacts/cards");
  const locked = await api(page, "GET", "/api/contacts/cards");
  step("while locked, no app answers", locked.status === 423, `HTTP ${locked.status}`);
  await passwordField(tab).waitFor({ timeout: 15_000 });
  step(
    "the other tab is locked too",
    (await passwordField(tab).isVisible()) && !(await finder(tab).isVisible()),
  );
  allow(401, "/api/session/unlock");
  await passwordField(page).fill("not the password");
  await passwordField(page).press("Enter");
  await page.getByText("The name or password is incorrect.").waitFor({ timeout: 15_000 });
  step("a wrong password does not unlock", !(await finder(page).isVisible()));
  await passwordField(page).fill(password);
  await passwordField(page).press("Enter");
  step("Chris's password unlocks his desktop", await desktopShown(page));
  step("the other tab is unlocked with it", await desktopShown(tab));
  const contactsWindow = page.getByRole("region", { name: "Contacts" }).first();
  step("his Contacts window is still open after unlocking", await contactsWindow.isVisible());

  // Fast user switching: the login window over Chris's session, and back.
  await menuTitle(page, "Chris").click();
  await menuItem(page, "Login Window…").click();
  await userTile(page, "Other…").waitFor({ timeout: 10_000 });
  step("the user menu opens the login window", await userTile(page, "Chris").isVisible());
  await page.getByRole("button", { name: "Cancel" }).click();
  step("Cancel goes back to Chris's desktop", await desktopShown(page));
  step("his Contacts window is still open after Cancel", await contactsWindow.isVisible());

  // Switch to Martin in Chris's browser.
  await menuTitle(page, "Chris").click();
  await menuItem(page, "Login Window…").click();
  await userTile(page, "Other…").click();
  const signIn = page.getByRole("form", { name: "Log In" });
  await signIn.getByLabel("Account Name:").fill(martin.name);
  await signIn.getByLabel("Password:").fill(password);
  await signIn.getByRole("button", { name: "Log In" }).click();
  await page.waitForLoadState("load");
  step("switching opens Martin's desktop", await desktopShown(page));
  await menuTitle(page, "Martin").waitFor({ timeout: 10_000 });
  await menuTitle(tab, "Martin").waitFor({ timeout: 20_000 });
  step(
    "the other tab follows to Martin's desktop, showing none of Chris's windows",
    (await menuTitle(tab, "Martin").isVisible()) &&
      (await tab.getByText(chris.card[1]).count()) === 0,
  );
  await tab.close();
  const switched = await cardsOf(page);
  step(
    "Chris's browser now holds Martin's data only",
    switched.text.includes(martin.card[1]) && !switched.text.includes(chris.card[1]),
    switched.text,
  );

  // Log Out Martin, then sign in again as Chris from the list.
  await menuTitle(page, "Apple").click();
  await menuItem(page, /^Log Out Martin/).click();
  await userTile(page, "Chris").waitFor({ timeout: 20_000 });
  step(
    "Log Out returns to the login window, listing both accounts",
    (await userTile(page, "Martin").isVisible()) && !(await finder(page).isVisible()),
  );
  await userTile(page, "Chris").click();
  await passwordField(page).fill(password);
  await passwordField(page).press("Enter");
  step("Chris signs in again from the list", await desktopShown(page));
  const back = await openContacts(page, cardName(chris));
  step("Chris's card is where he left it", await back.row.isVisible());
  await chrisContext.close();
  await martinContext.close();

  // A guest.
  const guestContext = await browser.newContext(contextOptions);
  const guest = await guestContext.newPage();
  watch(guest, "guest");
  await guest.goto(`${base}/`, { waitUntil: "load" });
  await userTile(guest, "Guest User").click();
  step("Guest User opens a desktop", await desktopShown(guest));
  const guestCards = await cardsOf(guest);
  step("a guest's desktop starts empty", guestCards.text === "null", guestCards.text);
  await guestContext.close();

  // A browser used before anyone signed in keeps its data, once, if asked to.
  const dataContext = await browser.newContext(contextOptions);
  const earlier = await dataContext.newPage();
  watch(earlier, "earlier");
  await earlier.goto(`${base}/`, { waitUntil: "load" });
  await userTile(earlier, "Guest User").waitFor({ timeout: 20_000 });
  const kept = await writeCard(earlier, ["Before", `Signin${run}`]);
  step("this browser held data before signing in", kept);
  await createAccount(earlier, { name: `dana-${run}`, fullName: "Dana" });
  const keep = earlier.getByRole("button", { name: "Keep", exact: true });
  await keep.waitFor({ timeout: 20_000 });
  step("the new account is offered this browser's data", await keep.isVisible());
  await keep.click();
  step("Keep opens the desktop", await desktopShown(earlier));
  const moved = await cardsOf(earlier);
  step("the data moved into the account", moved.text.includes(`Signin${run}`), moved.text);
  await dataContext.close();
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  await browser.close();
}

console.log(`screenshots in ${out}`);
if (problems.length > 0) {
  console.error(
    `\naccounts: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\naccounts: all ${steps.length} steps passed with no console errors`);
