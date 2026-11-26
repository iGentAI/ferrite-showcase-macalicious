#!/usr/bin/env node
// Mail keeps what is written, on Ferrite, in a real browser against the running app: a New Message
// window's text is saved as a draft while it is written, survives a reload of the page, survives
// closing the Mail viewer and quitting Mail with the window open, is one draft however many saves
// it took, and leaves Drafts when it is sent. Exits 0 only when every step passed and no page
// logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/mail-drafts-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                    [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-drafts");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mdchris-${id}`, fullName: `Chris ${id}`, password };

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const drafts = async (page) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return ((await reply.json()).messages ?? []).filter((m) => m.mailbox === "drafts");
};
const draftsAre = (page, check) => within(12_000, async () => check(await drafts(page)));
const write = async (page, subject, words) => {
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  await compose(page).getByLabel("Subject:").fill(subject);
  const text = compose(page).getByRole("textbox", { name: "Message" });
  await text.click();
  await text.pressSequentially(words);
};
const desktop = async (page) => {
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
};
const openMail = async (page) => {
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  await openMail(a);

  await write(a, `Saved ${id}`, "first words");
  step(
    "the message is saved as one draft a few seconds after it is written",
    (await draftsAre(a, (all) => all.length === 1 && all[0].subject === `Saved ${id}`)) !== null,
  );
  const text = compose(a).getByRole("textbox", { name: "Message" });
  await text.pressSequentially(" and more");
  await a.keyboard.press("Control+S");
  step(
    "Command-S saves it now, and it stays one draft",
    (await draftsAre(a, (all) => all.length === 1 && all[0].text.includes("and more"))) !== null,
  );

  // A reload right after the last words: the page's going away saves them.
  await text.pressSequentially(" before reload");
  await a.reload({ waitUntil: "load" });
  await desktop(a);
  step(
    "reloading the page right after typing keeps the last words",
    (await draftsAre(a, (all) => all.length === 1 && all[0].text.includes("before reload"))) !==
      null,
  );

  await openMail(a);
  await viewer(a)
    .getByRole("radio", { name: /^Drafts/ })
    .click();
  await shot(a, "mail-draft-after-reload");
  const [saved] = await drafts(a);
  await viewer(a).getByRole("option").filter({ hasText: saved.subject }).dblclick();
  await compose(a).waitFor({ timeout: 10_000 });
  const reopened = await compose(a).getByRole("textbox", { name: "Message" }).innerText();
  step("the draft opens again with all its text", reopened.includes("before reload"), reopened);

  // Closing the viewer, with the window open, keeps what was just typed.
  await compose(a).getByRole("textbox", { name: "Message" }).pressSequentially(" viewer gone");
  await viewer(a).getByRole("button", { name: "Close" }).first().click();
  step(
    "closing the Mail viewer with the window open keeps the last words, in one draft",
    (await draftsAre(a, (all) => all.length === 1 && all[0].text.includes("viewer gone"))) !== null,
  );

  await openMail(a);
  await write(a, `Quit ${id}`, "quit words");
  await a.keyboard.press("Control+Q");
  step(
    "quitting Mail with the window open keeps a new message as a draft",
    (await draftsAre(a, (all) => all.some((m) => m.subject === `Quit ${id}`))) !== null,
  );

  // A message sent leaves no draft behind.
  await openMail(a);
  await write(a, `Sent ${id}`, "going out");
  await compose(a).getByLabel("To:").click();
  await compose(a).getByLabel("To:").pressSequentially(chris.name);
  await compose(a).getByLabel("To:").press("Enter");
  await draftsAre(a, (all) => all.some((m) => m.subject === `Sent ${id}`));
  await a.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(a).count()) === 0);
  await a.waitForTimeout(500);
  step(
    "sending a message whose draft was saved leaves no draft of it",
    (await draftsAre(a, (all) => !all.some((m) => m.subject === `Sent ${id}`))) !== null,
  );
});
