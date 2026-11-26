#!/usr/bin/env node
// Messages' outbox on Ferrite in a real browser against the running app: a message written while the
// server cannot be reached survives a reload and arrives once, and a page out of view sends no read
// receipt. Exits 0 only when every step passed; the failed requests this journey causes on purpose
// are allowed.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/messages-outbox-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("messages-outbox");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mochris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `momartin-${id}`, fullName: `Martin ${id}`, password };

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const transcript = (page) => messagesOf(page).getByRole("log").first();
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();

allow(/request failed: .*\/api\/messages\/conversations\/.*\/messages/);
allow(/console: Failed to load resource/);

async function say(page, text) {
  const field = messagesOf(page).getByRole("textbox", { name: "Message" });
  await field.fill(text);
  await field.press("Enter");
}

await run({}, {}, async ({ person: open }) => {
  const pageM = await open("martin", martin);
  const page = await open("chris", chris);
  await openFromDock(pageM, "Messages");
  await openFromDock(page, "Messages");

  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  await say(page, `hello ${id}`);
  const arrived = await within(20_000, async () => {
    const row = rowOf(pageM, chris.fullName);
    if (await row.isVisible()) await row.click();
    return transcript(pageM).getByText(`hello ${id}`).first().isVisible();
  });
  step("a first message reaches Martin", arrived !== null);

  // The server stops answering this browser's sends; the message waits, and the page is reloaded.
  const held = `while away ${id}`;
  const refuse = (route) => route.abort();
  const sends = /\/api\/messages\/conversations\/[^/?]+\/messages(\?|$)/;
  await page.route(sends, refuse);
  await say(page, held);
  await within(5_000, () => transcript(page).getByText(held).first().isVisible());
  const outboxHolds = (text) =>
    page.evaluate(
      ([name, wanted]) =>
        Object.keys(window.localStorage).some(
          (key) =>
            key.startsWith(`macalicious.messages.outbox.${name}.`) &&
            (window.localStorage.getItem(key) ?? "").includes(wanted),
        ),
      [chris.name, text],
    );
  step("the waiting message is kept in the browser", await outboxHolds(held));
  await shot(page, "messages-outbox-waiting");
  // Still refused across the reload, so nothing the old page sent can be what arrives. Every record
  // removed from the store is noted, to show the message stays stored until it is delivered.
  await page.addInitScript(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (name) {
      window.outboxRemoved = [...(window.outboxRemoved ?? []), name];
      return remove.call(this, name);
    };
  });
  await page.reload();
  await messagesOf(page)
    .waitFor({ timeout: 8_000 })
    .catch(() => openFromDock(page, "Messages"));
  await page.waitForTimeout(1_500);
  const removed = await page.evaluate(() => window.outboxRemoved ?? []);
  step(
    "coming back after the reload never takes it out of the store",
    (await outboxHolds(held)) && !removed.some((name) => name.includes("messages.outbox")),
    removed.join(" "),
  );
  await page.unroute(sends, refuse);

  const delivered = await within(30_000, () =>
    transcript(pageM).getByText(held).first().isVisible(),
  );
  step("after the reload it reaches Martin", delivered !== null);
  await pageM.waitForTimeout(3_000);
  const copies = await transcript(pageM).getByText(held).count();
  step("it arrives once", copies === 1, `${copies} copies`);
  step("the outbox is empty again", !(await outboxHolds(held)));
  await shot(pageM, "messages-outbox-arrived");

  // Martin's page goes out of view: Chris's next message shows no Read until it comes back.
  await pageM.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // Back to Chris's open conversation, whose window came back from the reload.
  const row = rowOf(page, martin.fullName);
  await within(10_000, () => row.isVisible());
  await row.click();
  const quiet = `unseen ${id}`;
  await say(page, quiet);
  await pageM.waitForTimeout(6_000);
  const body = await transcript(page).innerText();
  step(
    "no read receipt while the page is out of view",
    body.includes(quiet) && !body.slice(body.lastIndexOf(quiet)).includes("Read"),
  );
  await pageM.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const read = await within(20_000, async () => {
    const text = await transcript(page).innerText();
    return text.slice(text.lastIndexOf(quiet)).includes("Read");
  });
  step("the receipt comes when the page is in view again", read !== null);

  // A browser that cannot store the message says so in the transcript.
  await page.route(sends, refuse);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("The quota has been exceeded.");
    };
  });
  await say(page, `unkept ${id}`);
  const told = await within(5_000, () =>
    messagesOf(page)
      .getByRole("alert")
      .filter({ hasText: "could not keep your message" })
      .isVisible(),
  );
  step("a browser that refuses to store the message says so", told !== null);
  await shot(page, "messages-outbox-unsaved");
});
