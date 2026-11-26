#!/usr/bin/env node

// Messages' dimmed controls say why (round 3, R6 bundle 02). Served `ferrite dev`, real input, two accounts made at the
// login window; Martin's 105 messages to Chris are stored through the server's API first (setup only). Each dimmed
// control is hovered and its reason read as a person sees it (the tooltip the page gives):
//   - Record audio (already said why: the check that the pattern holds);
//   - the Preferences' Help button, in the General and the iMessage pane (now opens Help Viewer);
//   - the iMessage pane's Sign Out (dimmed, no reason);
//   - the tapbacks of a message loaded with Load Earlier Messages (dimmed, no reason), and Remove Tapback on a message
//     Chris gave no tapback (dimmed, no reason); with his Love on it, Remove Tapback is offered and removes it.
// Exits 0 only when every step passed and no page logged an error.
//
//   node e2e/messages-reasons-journey.mjs --browser chromium|chrome|firefox|webkit [--url http://127.0.0.1:8080]

import { reasonOf } from "./r6-common.mjs";
import { account, api, launchEngine, menu, openApp, options, signUp, within } from "./r6-kit.mjs";

const AUDIO =
  "Audio messages are not available here: only a conversation between accounts on the served desktop keeps a recording.";
const SIGN_OUT =
  "Messages uses the account you logged in to this desktop with: to sign out, choose Log Out from the Apple menu.";
const OLDER =
  "Tapbacks change only on the newest messages: this one was loaded with Load Earlier Messages.";
const NONE = "You have given this message no tapback to remove.";
/** More than the 100 a conversation keeps in its document (conversations.rs KEEP), so earlier ones go to pages. */
const SEEDED = 105;
const TAPBACKS = [/Love$/, /Like$/, /Dislike$/, /Laugh$/, /Emphasize$/, /Question$/];

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
console.log(`messages-reasons in ${o.browserName} ${browser.version()} against ${o.base}`);
// Where the run is, and the page to photograph, for a failure's report.
let at = "start";
let photographed = null;
try {
  const tag = `${o.browserName.slice(0, 2)}${Date.now().toString(36)}`;
  const person = async (label) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${label} page error: ${error.message}`));
    page.on(
      "console",
      (message) => message.type() === "error" && errors.push(`${label} console: ${message.text()}`),
    );
    await page.goto(`${o.base}/`, { waitUntil: "load" });
    const me = account(label, tag);
    await signUp(page, me);
    return { context, page, me };
  };
  const martin = await person("martin");
  const chris = await person("chris");

  // Setup: Martin starts a conversation with Chris and writes SEEDED messages to it, each with its idempotency key.
  const id = await martin.page.evaluate(
    async ({ to, count }) => {
      const key = () =>
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const post = async (url, body) => {
        const response = await fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "idempotency-key": key() },
          body: JSON.stringify(body),
        });
        return response.json();
      };
      const started = await post("/api/messages/conversations", { to: [to] });
      const conversation = started?.state?.id;
      if (!conversation) return null;
      for (let n = 1; n <= count; n++) {
        await post(`/api/messages/conversations/${conversation}/messages`, {
          text: `seed ${String(n).padStart(3, "0")}`,
        });
      }
      return conversation;
    },
    { to: chris.me.name, count: SEEDED },
  );
  step(
    `Martin's ${SEEDED} messages to Chris are stored`,
    typeof id === "string",
    `conversation ${id}`,
  );

  const page = chris.page;
  photographed = page;
  at = "opening Messages";
  await openApp(page, "Messages", "Messages");
  const win = page.locator(".mac-messages").first();

  const record = win.getByRole("button", { name: "Record audio", exact: true });
  const recordReason = await reasonOf(page, record);
  step(
    "Record audio is dimmed and says why",
    (await dimmed(record)) && recordReason === AUDIO,
    `reason=${JSON.stringify(recordReason)}`,
  );

  // The Preferences window, from the Messages menu.
  at = "Messages > Preferences…";
  await menu(page, "Messages", "Preferences…");
  const prefs = page.locator(".mac-messages-preferences").first();
  await prefs.waitFor({ timeout: 10_000 });
  for (const pane of ["General", "iMessage"]) {
    await prefs.getByRole("tab", { name: pane, exact: true }).click();
    // Both panes stay in the page: the Help button of the pane on show.
    const help = prefs
      .getByRole("button", { name: "Help", exact: true })
      .filter({ visible: true })
      .first();
    await help.waitFor({ timeout: 5_000 });
    step(`the ${pane} pane's Help button is enabled`, !(await dimmed(help)));
  }
  await prefs
    .getByRole("button", { name: "Help", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const helpWindow = page.locator(".mac-window.mac-help-viewer").first();
  await helpWindow.waitFor({ timeout: 10_000 });
  step("the Help button opens Help Viewer", true);
  await helpWindow.getByRole("button", { name: "Close" }).first().click();
  const signOut = prefs
    .getByRole("button", { name: "Sign Out", exact: true })
    .filter({ visible: true })
    .first();
  const signOutReason = await reasonOf(page, signOut);
  step(
    "Sign Out is dimmed and says why",
    (await dimmed(signOut)) && signOutReason === SIGN_OUT,
    `reason=${JSON.stringify(signOutReason)}`,
  );
  at = "closing the Preferences";
  await prefs
    .getByRole("group", { name: "Window controls" })
    .first()
    .getByRole("button", { name: "Close" })
    .click({ timeout: 10_000 });
  await prefs.waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});

  // Martin's conversation, and its earlier messages.
  at = `choosing the conversation ${martin.me.fullName}`;
  // A row's accessible name is all of its text (unread dot, time, last message): its name is the row's own name label.
  const exactly = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  await win
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({
      has: page.locator(".mac-messages-row-name", { hasText: exactly(martin.me.fullName) }),
    })
    .first()
    .click({ timeout: 20_000 });
  at = "Load Earlier Messages";
  const earlier = win.getByRole("button", { name: "Load Earlier Messages", exact: true });
  await earlier.waitFor({ timeout: 15_000 });
  await earlier.click();
  // The bubble also names its sender for assistive technology, so its text is found within it, not as all of it.
  const first = await within(10_000, () =>
    win
      .getByText(/\bseed 001\b/)
      .first()
      .isVisible(),
  );
  step("Load Earlier Messages shows the first message", first !== null, `in ${first} ms`);

  // Message `seq`'s pull-down, opened with the mouse; `item(name)` is one of its items.
  const menuOf = async (seq) => {
    at = `the menu of message ${seq}`;
    await win
      .getByRole("button", { name: `Tapback or reply to message ${seq}`, exact: true })
      .click({ timeout: 10_000 });
    const open = page.locator('[role="menu"]').filter({ visible: true }).last();
    await open.waitFor({ timeout: 5_000 });
    return {
      item: (name) => open.getByRole("menuitem", { name }).first(),
      close: () => page.keyboard.press("Escape"),
    };
  };

  const older = await menuOf(1);
  const olderReasons = [];
  let olderDimmed = true;
  for (const name of [...TAPBACKS, /^Remove Tapback$/]) {
    const item = older.item(name);
    const reason = await reasonOf(page, item);
    olderReasons.push(reason);
    olderDimmed = olderDimmed && (await dimmed(item)) && reason === OLDER;
  }
  await older.close();
  step(
    "an earlier message's tapbacks and Remove Tapback are dimmed and say why",
    olderDimmed,
    `reasons ${JSON.stringify([...new Set(olderReasons)])}`,
  );

  const newest = await menuOf(SEEDED);
  const love = newest.item(/Love$/);
  const remove = newest.item(/^Remove Tapback$/);
  const removeReason = await reasonOf(page, remove);
  const loveOffered = !(await dimmed(love));
  step(
    "on the newest message Love is offered, and Remove Tapback is dimmed and says why",
    loveOffered && (await dimmed(remove)) && removeReason === NONE,
    `love offered=${loveOffered} reason=${JSON.stringify(removeReason)}`,
  );
  const tapbackOf = async () =>
    (await api(page, "GET", `/api/messages/conversations/${id}`)).json?.state?.messages?.find(
      (m) => m.seq === SEEDED,
    )?.tapbacks?.[chris.me.name];
  if (loveOffered) await love.click();
  else await newest.close();
  const kept = await within(8_000, async () => (await tapbackOf()) === "love");
  // The window shows it once it reads the conversation again (its stream tells it at once).
  const shown = await within(10_000, () =>
    win.getByLabel("Tapbacks").filter({ hasText: "You" }).first().isVisible(),
  );
  step(
    "Love is kept on the server and shows as Chris's",
    kept !== null && shown !== null,
    `kept ${kept} ms, shown ${shown} ms`,
  );

  const again = await menuOf(SEEDED);
  const removeNow = again.item(/^Remove Tapback$/);
  const offered = !(await dimmed(removeNow));
  if (offered) await removeNow.click();
  else await again.close();
  const removed = await within(8_000, async () => (await tapbackOf()) === undefined);
  step(
    "with Chris's Love on it, Remove Tapback is offered and removes it",
    offered && removed !== null,
    `offered=${offered}, removed in ${removed} ms`,
  );
  await martin.context.close();
  await chris.context.close();
} catch (error) {
  const lines = String(error.message).split("\n");
  const waiting = lines.find((line) => /waiting for/.test(line))?.trim() ?? "";
  step(`run, at ${at}`, false, `${lines[0]}${waiting ? ` ${waiting}` : ""}`);
  await photographed
    ?.screenshot({ path: `${o.out}/messages-reasons-failed-${o.browserName}.png` })
    .catch(() => {});
} finally {
  await browser.close();
}
for (const e of errors) console.log(`FAIL ${e}`);
const passed = results.filter(Boolean).length;
console.log(
  `messages-reasons ${o.browserName}: ${passed}/${results.length} steps passed, ${errors.length} page errors`,
);
process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
