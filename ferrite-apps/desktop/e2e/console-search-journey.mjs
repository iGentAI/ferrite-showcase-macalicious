#!/usr/bin/env node
// Console's search token and Share on a served desktop. The pop-ups beside a search say where its words are looked for
// and how they compare, each read back from which rows are listed and kept across a reload; Share hands the selected
// message to Notes, which makes a note of it, and to Mail, which attaches it as a text file; that message is sent to the
// journey's own account, as a Guest User sends no mail, and its attachment is read back. Nothing is simulated but the page
// error the journey raises to have a row of its own. Exits 0 only when every step passed with no console error, page
// error, failed request or HTTP error.
//
//   node e2e/console-search-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, nextSave, reloadDesktop } from "./journey-kit.mjs";
import { createAccount, person } from "./r2-census-kit.mjs";

const RUN = Date.now().toString(36);
const WORD = `findme${RUN}`;
const MESSAGE = `${WORD} middle tail${RUN}`;
const SETTINGS = "/api/system-preferences/settings";

await journey("console-search", async ({ page, base, out, step }) => {
  const me = person(RUN, "console", "Console Search");
  await createAccount(page, base, me);
  const window = page.locator('[data-window-id="console"]');
  const open = async () => {
    await page
      .getByRole("button", { name: /^Console$/ })
      .first()
      .click();
    await window.waitFor({ timeout: 10_000 });
  };
  await open();
  await page.waitForTimeout(500);
  const raise = () =>
    page.evaluate((message) => {
      globalThis.dispatchEvent(new ErrorEvent("error", { message }));
    }, MESSAGE);
  await raise();
  const row = window
    .getByRole("grid", { includeHidden: true })
    .first()
    .locator('[role="row"][aria-selected]')
    .filter({ hasText: WORD });
  await row.first().waitFor({ timeout: 8_000 });

  const search = window
    .getByRole("searchbox")
    .or(window.getByRole("textbox", { name: /search/i }))
    .first();
  const field = window.getByRole("combobox", { name: "Search in" });
  const comparison = window.getByRole("combobox", { name: "Compare by" });
  step("with no words in the search, no pop-up", (await field.count()) === 0);
  await search.fill(WORD);
  await field.waitFor({ timeout: 5_000 });
  const shows = async () => {
    await page.waitForTimeout(250);
    return (await row.count()) > 0;
  };
  const choose = async (popUp, option) => {
    await popUp.click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  step("Any, Contains: the words are found", await shows());
  await page.screenshot({ path: path.join(out, "console-search-popups.png") });
  await choose(field, "Process");
  step("Process: they are not in the process", !(await shows()));
  await choose(field, "Message");
  step("Message: they are in the message", await shows());
  await choose(comparison, "Is");
  step("Is: part of the message is not the message", !(await shows()));
  await search.fill(MESSAGE);
  step("Is: the whole message is", await shows());
  await search.fill(WORD);
  await choose(comparison, "Begins With");
  step("Begins With: the first word", await shows());
  await search.fill(`tail${RUN}`);
  step("Begins With: not the last", !(await shows()));
  await choose(comparison, "Ends With");
  step("Ends With: the last word", await shows());
  await choose(comparison, "Doesn’t Contain");
  step("Doesn't Contain: the message goes", !(await shows()));

  await search.fill(WORD);
  const saved = nextSave(page, SETTINGS);
  await choose(comparison, "Begins With");
  await saved;
  await page.waitForTimeout(600);
  const layout = (await api(page, "GET", SETTINGS)).json?.values?.["console.layout"];
  step(
    "the choices are on the server",
    layout?.searchField === "message" && layout?.searchComparison === "begins",
    JSON.stringify([layout?.searchField, layout?.searchComparison]),
  );
  await reloadDesktop(page);
  await window.waitFor({ timeout: 15_000 });
  await field.waitFor({ timeout: 8_000 });
  step(
    "and shown after a reload",
    /Message/.test(await field.innerText()) && /Begins With/.test(await comparison.innerText()),
  );

  // Share.
  await search.fill("");
  await raise();
  await row.first().waitFor({ timeout: 8_000 });
  await row.first().click();
  const share = async (name) => {
    await window.getByRole("button", { name: "Share" }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  };
  await share("Notes");
  const note = page.locator('[data-window-id="notes"]').getByText(WORD).first();
  await note.waitFor({ timeout: 15_000 });
  step("Share > Notes: a new note holds the message", await note.isVisible());
  await page.screenshot({ path: path.join(out, "console-share-notes.png") });
  await page
    .locator('[data-window-id="notes"]')
    .getByRole("button", { name: "Close" })
    .first()
    .click();
  await window.click({ position: { x: 300, y: 10 } });
  await share("Mail");
  const attached = page
    .locator('[data-window-id^="mail"]')
    .getByText("Console Messages.txt")
    .first();
  await attached.waitFor({ timeout: 15_000 });
  step("Share > Mail: a new message with the file attached", await attached.isVisible());
  await page.screenshot({ path: path.join(out, "console-share-mail.png") });

  const compose = page.locator(".mac-mail-compose").first();
  await compose
    .getByRole("list", { name: "Attachments" })
    .getByText("byte")
    .waitFor({ timeout: 15_000 });
  const to = compose.getByLabel("To:");
  await to.click();
  await to.pressSequentially(me.name);
  await to.press("Enter");
  const subject = `Console ${RUN}`;
  await compose.getByLabel("Subject:").fill(subject);
  await compose.getByRole("button", { name: "Send", exact: true }).click();
  const mail = page.locator(".mac-mail").first();
  const sent = mail
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: subject })
    .first();
  await sent.waitFor({ timeout: 20_000 });
  await sent.click();
  const arrived = mail
    .getByRole("list", { name: "Attachments" })
    .getByText("Console Messages.txt")
    .first();
  await arrived.waitFor({ timeout: 10_000 });
  step("and it arrives with the file", await arrived.isVisible());
  const listed = (await api(page, "GET", "/api/mail/messages")).json?.messages ?? [];
  const message = listed.find((each) => each.subject === subject && each.attachments?.length);
  const bytes = message
    ? await page.evaluate(
        ({ id, file }) =>
          fetch(`/api/mail/messages/${id}/attachments/${file}`).then((reply) => reply.text()),
        { id: message.id, file: message.attachments[0].id },
      )
    : "";
  step("and the file holds the message", bytes.includes(WORD), bytes.slice(0, 60));
  await page.screenshot({ path: path.join(out, "console-share-mail-arrived.png") });
});
