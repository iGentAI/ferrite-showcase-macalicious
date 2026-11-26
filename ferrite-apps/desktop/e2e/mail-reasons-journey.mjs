#!/usr/bin/env node

// Mail's dimmed controls say why (round 3, R6 bundle 01). Served `ferrite dev`, real input, one account made at the login
// window. Each dimmed control is hovered and its reason read as a person sees it (the tooltip the page gives):
//   - the New Message window's Include Original Message (was dimmed with no reason);
//   - Move to… > Drafts for a received message (was offered; the server refused the move and the message silently came
//     back), now dimmed with the reason;
//   - a draft's Archive, Junk and Move to… > Inbox (the server lets a draft go only to the Trash), now dimmed with the
//     reason, while Move to… > Trash stays offered;
//   - Mail Preferences' Help button (did nothing when pressed), now dimmed with the reason.
// Exits 0 only when every step passed and the page logged no error.
//
//   node e2e/mail-reasons-journey.mjs --browser chromium|chrome|firefox|webkit [--url http://127.0.0.1:8080]

import { reasonOf } from "./r6-common.mjs";
import {
  account,
  api,
  launchEngine,
  menu,
  openApp,
  options,
  pause,
  signUp,
  within,
} from "./r6-kit.mjs";

const INCLUDE_ORIGINAL =
  "There is no original message to take out or put back: this is a new message, a forward or a saved draft.";
const MOVE_TO_DRAFTS = "Only a draft you save is kept in Drafts: a message cannot be moved there.";
const DRAFT_MOVE = "A draft can only be deleted: send it, or move it to the Trash.";
const MAIL_HELP = "Mail Help is not available: this desktop has no help book for Mail.";
const MAILWIN = /^(Inbox|Drafts|Sent|Junk|Trash|Archive) \(\d+ messages?\)$/;

const o = options();
const results = [];
const errors = [];
const step = (title, ok, detail = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "ok  " : "FAIL"} ${title}${detail ? ` (${detail})` : ""}`);
};
const dimmed = async (locator) =>
  (await locator.isDisabled().catch(() => false)) ||
  (await locator.getAttribute("aria-disabled").catch(() => null)) === "true" ||
  (await locator.getAttribute("data-disabled").catch(() => null)) !== null;

const browser = await launchEngine(o.browserName, { headed: o.headed });
console.log(`mail-reasons in ${o.browserName} ${browser.version()} against ${o.base}`);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
  page.on(
    "console",
    (message) => message.type() === "error" && errors.push(`console: ${message.text()}`),
  );
  await page.goto(`${o.base}/`, { waitUntil: "load" });
  const me = account("reasons", `${o.browserName.slice(0, 2)}${Date.now().toString(36)}`);
  await signUp(page, me);
  await openApp(page, "Mail", MAILWIN);
  const viewer = page.locator(".mac-mail").first();
  const toolbar = (name) => viewer.getByRole("button", { name, exact: true }).first();

  // The New Message window's Include Original Message.
  await toolbar("New Message").click();
  const compose = page.locator(".mac-mail-compose").first();
  await compose.waitFor({ timeout: 10_000 });
  const include = compose.getByRole("button", { name: "Include Original Message", exact: true });
  const includeReason = await reasonOf(page, include);
  step(
    "Include Original Message is dimmed and says why",
    (await dimmed(include)) && includeReason === INCLUDE_ORIGINAL,
    `reason=${JSON.stringify(includeReason)}`,
  );
  // Close it empty (nothing to keep).
  await compose
    .getByRole("group", { name: "Window controls" })
    .first()
    .getByRole("button", { name: "Close" })
    .click();
  await within(8_000, async () => (await compose.count()) === 0);

  // Mail Preferences' Help button, in the General pane and in another pane.
  await menu(page, "Mail", "Preferences…");
  const prefs = page.locator(".mac-mail-preferences").first();
  await prefs.waitFor({ timeout: 8_000 });
  for (const pane of ["General", "Viewing"]) {
    await prefs.getByRole("tab", { name: pane, exact: true }).click();
    const help = prefs.getByRole("button", { name: "Help", exact: true });
    const helpReason = await reasonOf(page, help);
    step(
      `Mail Preferences' Help (${pane}) is dimmed and says why`,
      (await dimmed(help)) && helpReason === MAIL_HELP,
      `dimmed=${await dimmed(help)} reason=${JSON.stringify(helpReason)}`,
    );
  }
  await prefs
    .getByRole("group", { name: "Window controls" })
    .first()
    .getByRole("button", { name: "Close" })
    .click();
  await prefs.waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});

  // A message in the Inbox (sent to oneself through the app's API, as a fixture) and a saved draft.
  const subject = `Reasons ${Date.now().toString(36)}`;
  const sent = await api(page, "POST", "/api/mail/send", {
    to: [me.name],
    cc: [],
    subject,
    text: "For the Move to menu.",
  });
  const draft = await api(page, "POST", "/api/mail/drafts", {
    to: [],
    subject: `Draft ${subject}`,
    text: "Unsent.",
  });
  step(
    "fixtures: a received message and a saved draft",
    (sent.status === 200 || sent.status === 201) && draft.status === 200,
    `send ${sent.status}, draft ${draft.status}`,
  );
  const rows = viewer.getByRole("listbox", { name: "Messages" }).getByRole("option");
  const row = (text) => rows.filter({ has: page.getByText(text, { exact: true }) }).first();
  const mailbox = async (name) => {
    await viewer
      .getByRole("tree", { name: "Mailboxes" })
      .getByRole("treeitem", { name: new RegExp(`^${name}\\b`) })
      .first()
      .click();
    await pause(400);
  };
  await within(20_000, async () => {
    await toolbar("Get Mail").click();
    await pause(600);
    return (await row(subject).count()) > 0;
  });

  // Move to… > Drafts for the received message.
  await row(subject).click();
  await toolbar("Move to…").click();
  const draftsItem = page.getByRole("menuitem", { name: "Drafts", exact: true });
  await draftsItem.waitFor({ timeout: 5_000 });
  const draftsReason = await reasonOf(page, draftsItem);
  const trashOffered = !(await dimmed(page.getByRole("menuitem", { name: "Trash", exact: true })));
  step(
    "Move to… > Drafts is dimmed and says why",
    (await dimmed(draftsItem)) && draftsReason === MOVE_TO_DRAFTS && trashOffered,
    `reason=${JSON.stringify(draftsReason)}; Trash offered=${trashOffered}`,
  );
  await page.keyboard.press("Escape");

  // A draft: Archive, Junk and Move to… > Inbox dimmed with the reason; Move to… > Trash offered.
  await mailbox("Drafts");
  await row(`Draft ${subject}`).click();
  for (const name of ["Archive", "Junk"]) {
    const button = toolbar(name);
    const reason = await reasonOf(page, button);
    step(
      `a draft's ${name} is dimmed and says why`,
      (await dimmed(button)) && reason === DRAFT_MOVE,
      `reason=${JSON.stringify(reason)}`,
    );
  }
  await toolbar("Move to…").click();
  const inbox = page.getByRole("menuitem", { name: "Inbox", exact: true });
  await inbox.waitFor({ timeout: 5_000 });
  const inboxReason = await reasonOf(page, inbox);
  const trash = page.getByRole("menuitem", { name: "Trash", exact: true });
  step(
    "a draft's Move to… > Inbox is dimmed and says why; Trash is offered",
    (await dimmed(inbox)) && inboxReason === DRAFT_MOVE && !(await dimmed(trash)),
    `reason=${JSON.stringify(inboxReason)}`,
  );
  // Trash still works for the draft (a real click), and the server agrees.
  await trash.click();
  const moved = await within(8_000, async () => {
    const list = await api(page, "GET", "/api/mail/messages");
    return (list.json?.messages ?? []).some(
      (m) => m.subject === `Draft ${subject}` && m.mailbox === "trash",
    );
  });
  step("a draft moves to the Trash from Move to…", moved !== null, `moved in ${moved} ms`);
  await context.close();
} catch (error) {
  step("run", false, String(error.message).split("\n")[0]);
} finally {
  await browser.close();
}
for (const e of errors) console.log(`FAIL ${e}`);
const passed = results.filter(Boolean).length;
console.log(
  `mail-reasons ${o.browserName}: ${passed}/${results.length} steps passed, ${errors.length} page errors`,
);
process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
