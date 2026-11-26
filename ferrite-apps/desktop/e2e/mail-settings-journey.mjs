#!/usr/bin/env node
// The Composing, Viewing and Fonts & Colors settings on Ferrite, in a real browser against the running
// app. Quote the original off leaves a reply unquoted and Include Original puts it back; Cc myself
// delivers a copy; Show To/Cc, contact photos and Smart Addresses change the list; the message font
// changes the message's computed font; each is on the server and comes back after a reload; settings
// that mean nothing here are dimmed and say why. Exits 0 only when every step passed and no page logged
// a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-settings-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import {
  allOnServer,
  arrive,
  choose,
  closePreferences,
  compose,
  openPane,
  preferences,
  row,
  rows,
  send,
  values,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-settings");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `sechris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `semartin-${id}`, fullName: `Martin ${id}`, password };
const message = (page) => compose(page).getByRole("textbox", { name: "Message" });
const setting = (page, name) => preferences(page).getByRole("checkbox", { name });
const kept = async (page) => (await values(page))["mail.settings"] ?? {};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  const subject = `Tide ${id}`;
  await send(a, martin.name, subject, "High water at noon");
  await arrive(b, async () => (await rows(b).count()) === 1);
  await row(b, subject).click();

  await b.keyboard.press("Control+R");
  await within(5_000, () => compose(b).isVisible());
  step(
    "a reply quotes the original at first",
    (await message(b).innerText()).includes("High water"),
  );
  const include = compose(b).getByRole("button", { name: "Include Original Message" });
  await include.click();
  step(
    "Include Original Message takes the quote out",
    !(await message(b).innerText()).includes("High water"),
  );
  await compose(b).getByRole("button", { name: "Close" }).first().click();
  await within(10_000, async () => (await compose(b).count()) === 0);

  await openPane(b, "Composing");
  await setting(b, "Quote the text of the original message").click();
  await setting(b, "Automatically Cc myself").click();
  await setting(b, "Check spelling as I type").click();
  step(
    "a setting with no meaning here is dimmed and says why",
    (await setting(b, /When sending to a group/).isDisabled()) &&
      (await setting(b, /When sending to a group/).getAttribute("title")) !== null,
  );
  await shot(b, "mail-settings-composing");
  await closePreferences(b);
  step(
    "they are on the server",
    (await within(10_000, async () => {
      const now = await kept(b);
      return now.quoteOriginal === false && now.ccMyself === true && now.spelling === false;
    })) !== null,
  );

  await row(b, subject).click();
  await b.keyboard.press("Control+R");
  await within(5_000, () => compose(b).isVisible());
  step(
    "with Quote off a reply does not quote",
    !(await message(b).innerText()).includes("High water"),
  );
  await include.click();
  step("Include Original puts it back", (await message(b).innerText()).includes("High water"));
  step(
    "Cc myself puts the person on Cc",
    (await compose(b)
      .getByRole("button", { name: new RegExp(martin.name) })
      .count()) +
      (await compose(b).getByText(`Martin ${id}`).count()) >
      0,
  );
  step("spelling is off in the message", (await message(b).getAttribute("spellcheck")) === "false");
  const replySubject = `Re: ${subject}`;
  await b.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(b).count()) === 0);
  step(
    "Cc myself delivers a copy to the person's own Inbox",
    (await arrive(b, async () =>
      (
        await allOnServer(b)
      ).some((each) => each.subject === replySubject && each.mailbox === "inbox"),
    )) !== null,
  );

  await openPane(b, "Viewing");
  await setting(b, "Show To/Cc label in the message list").click();
  await setting(b, "Show contact photos in the message list").click();
  await setting(b, "Use Smart Addresses").click();
  step(
    "Load remote content is dimmed and says why",
    (await setting(b, "Load remote content in messages").isDisabled()) &&
      (await setting(b, "Load remote content in messages").getAttribute("title")) !== null,
  );
  await closePreferences(b);
  const first = row(b, subject);
  await first.click();
  step("To/Cc shows on the row", await first.locator(".mac-mail-row-tocc").isVisible());
  step("a contact photo shows on the row", await first.locator(".mac-mail-row-photo").isVisible());
  step(
    "Smart Addresses off shows the sender's address",
    (await first.innerText()).includes(`${chris.name}@macalicious`),
  );
  await shot(b, "mail-settings-viewing");

  await openPane(b, "Fonts & Colors");
  const box = viewer(b).locator(".mac-mail-live-styled").first();
  await choose(b, preferences(b), "Message Font", "Georgia");
  await choose(b, preferences(b), "Message Font Size", "18");
  const computed = () =>
    box.evaluate((node) => {
      const { fontFamily, fontSize } = getComputedStyle(node);
      return { fontFamily, fontSize };
    });
  step(
    "the message font changes the message shown",
    (await within(5_000, async () => {
      const now = await computed();
      return now.fontSize === "18px" && now.fontFamily.includes("Georgia");
    })) !== null,
  );
  await closePreferences(b);
  await shot(b, "mail-settings-font");
  await viewer(b).getByRole("button", { name: "New Message" }).click();
  await within(5_000, () => compose(b).isVisible());
  const typed = await message(b).evaluate((node) => getComputedStyle(node).fontSize);
  step("a New Message is written in it", typed === "18px");
  await compose(b).getByRole("button", { name: "Close" }).first().click();
  await within(10_000, async () => (await compose(b).count()) === 0);

  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  await within(15_000, async () => (await rows(b).count()) > 0);
  await row(b, subject).click();
  step(
    "after a reload the font and the row's settings still act",
    (await within(10_000, async () => (await computed()).fontSize === "18px")) !== null &&
      (await row(b, subject).locator(".mac-mail-row-photo").isVisible()),
  );
});
