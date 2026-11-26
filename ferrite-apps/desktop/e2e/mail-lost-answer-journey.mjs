#!/usr/bin/env node
// A send whose answer is lost, on Ferrite, in a real browser against the running app: the server
// delivers, the browser never hears, and the held window retries under the same key. After reload,
// both accounts still have one copy and no delivered message remains in Drafts. Exits 0 only
// when every step passed; the failed request this journey causes on purpose is allowed.
//
//   node e2e/mail-lost-answer-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                         [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("mail-lost-answer");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `lachris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `lamartin-${id}`, fullName: `Martin ${id}`, password };
const SUBJECT = `Once ${id}`;

allow(/request failed: .*\/api\/mail\/send/);
allow(/console: Failed to load resource/);

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const copies = async (page, mailbox) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  const { messages } = await reply.json();
  return messages.filter((m) => m.subject === SUBJECT && m.mailbox === mailbox);
};
const SEND = /\/api\/mail\/send(\?|$)/;

await run({}, {}, async ({ person }) => {
  const other = await person("martin", martin);
  const page = await person("chris", chris);
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const to = compose(page).getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await compose(page).getByLabel("Subject:").fill(SUBJECT);
  await compose(page).locator('[contenteditable="true"]').first().click();
  await page.keyboard.type(`only once ${id}`);

  // The server does the work and the answer never reaches the page.
  let firstKey = null;
  let firstStatus = null;
  await page.route(SEND, async (route) => {
    firstKey = route.request().headers()["idempotency-key"] ?? null;
    const response = await route.fetch();
    firstStatus = response.status();
    await route.abort();
  });
  await page.keyboard.press("Control+Shift+D");
  step(
    "the window says it cannot tell whether the message went",
    (await within(15_000, () => compose(page).getByText("could not tell whether").isVisible())) !==
      null,
  );
  await shot(page, "mail-lost-answer");
  await page.unroute(SEND);
  step(
    "it reached Martin",
    (await within(10_000, async () => (await copies(other, "inbox")).length === 1)) !== null,
  );

  if (!firstKey || firstStatus !== 201) {
    throw new Error("The lost answer must follow a keyed, accepted first delivery.");
  }
  // A delivered message is deliberately not kept as a draft (SENT_DRAFT_MS). Retry from
  // the held window before reload, while independently observing the original send key.
  const retries = [];
  const observeRetry = (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/mail/send") {
      retries.push(request.headers()["idempotency-key"] ?? null);
    }
  };
  page.on("request", observeRetry);
  try {
    await page.keyboard.press("Control+Shift+D");
    step(
      "sent again from the held window, the window closes",
      (await within(15_000, async () => (await compose(page).count()) === 0)) !== null,
    );
  } finally {
    page.off("request", observeRetry);
  }
  step(
    "the retry used the original key exactly once",
    retries.length === 1 && retries[0] === firstKey,
  );
  step(
    "Martin and Chris each have one delivered copy and no draft",
    (await copies(other, "inbox")).length === 1 &&
      (await copies(page, "sent")).length === 1 &&
      (await copies(page, "drafts")).length === 0,
  );

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
  step(
    "reload preserves one Sent and Inbox copy without resurrecting a delivered draft",
    (await copies(other, "inbox")).length === 1 &&
      (await copies(page, "sent")).length === 1 &&
      (await copies(page, "drafts")).length === 0,
  );
});
