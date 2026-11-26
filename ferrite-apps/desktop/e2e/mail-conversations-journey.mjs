#!/usr/bin/env node
// Conversations on Ferrite, in a real browser against the running app: View > Organize by Conversation
// groups a subject with Re: and Fwd: taken off among the people involved, not a stranger's mail of the
// same subject; the thread's row opens, Expand and Collapse All work, the pane shows all of it, and
// Mute acts on the thread. All of it is on the server and comes back after a reload.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/mail-conversations-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import {
  allOnServer,
  arrive,
  menuPath,
  row,
  rows,
  send,
  values,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-conversations");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `cochris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `comartin-${id}`, fullName: `Martin ${id}`, password };
const subject = `Plans ${id}`;
// The thread of several messages in the Inbox. The note to self is a thread too, of its Inbox and Sent
// copies, with no triangle since the Inbox holds one of them.
const threadRow = (page) =>
  rows(page).filter({
    has: page.getByRole("button", { name: /(Expand|Collapse) Conversation/ }),
  });
const count = (page, wanted) => within(8_000, async () => (await rows(page).count()) === wanted);
const menuChecked = async (page, name) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  const checked = await page
    .getByRole("menu")
    .last()
    .getByRole("menuitemcheckbox", { name })
    .getAttribute("aria-checked");
  await page.keyboard.press("Escape");
  return checked === "true";
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await send(a, martin.name, subject, "First");
  await send(a, martin.name, `Re: ${subject}`, "Second");
  await send(a, martin.name, `Fwd: Re: ${subject}`, "Third");
  await send(a, martin.name, `Dinner ${id}`, "Alone");

  await openFromDock(b, "Mail", undefined).catch(() => {});
  await arrive(b, async () => (await rows(b).count()) === 4);
  await send(b, chris.name, `Re: ${subject}`, "My own reply");
  await send(b, martin.name, subject, "To myself, of another conversation");
  await arrive(b, async () => (await rows(b).count()) === 5);

  await menuPath(b, "View", "Organize by Conversation");
  step(
    "Organize by Conversation groups them: thread, note to self, lone message",
    (await count(b, 3)) !== null && (await threadRow(b).count()) === 1,
  );
  step(
    "the thread's count takes in the reply in Sent",
    (await threadRow(b).getByRole("img", { name: "4 messages" }).count()) === 1,
  );
  await threadRow(b).click();
  const conversation = viewer(b).getByLabel("Conversation");
  step(
    "selecting the thread shows all its messages, with the related one's mailbox",
    (await within(8_000, async () => (await conversation.getByRole("article").count()) === 4)) !==
      null && (await conversation.getByText("In Sent").count()) === 1,
  );
  await b.waitForTimeout(400);
  await shot(b, "mail-conversation-read");

  await viewer(b).getByRole("button", { name: "Expand Conversation" }).click();
  step("its triangle opens it", (await count(b, 6)) !== null);
  await shot(b, "mail-conversation-open");
  await menuPath(b, "View", "Collapse All Conversations");
  step("Collapse All closes it", (await count(b, 3)) !== null);
  await menuPath(b, "View", "Expand All Conversations");
  step("Expand All opens it", (await count(b, 6)) !== null);
  await menuPath(b, "View", "Expand All Conversations");
  await count(b, 6);
  await row(b, `Re: ${subject}`).click();
  await threadRow(b).click({ button: "right" });
  // An open menu hides the page from the queries by role.
  await b.keyboard.press("Escape");
  step(
    "a right click on a thread with one of its messages selected takes the whole thread",
    (await within(
      8_000,
      async () => (await threadRow(b).getAttribute("aria-selected")) === "true",
    )) !== null,
  );
  await row(b, `Re: ${subject}`).click();
  await menuPath(b, "View", "Collapse All Conversations");
  step(
    "closing it with one of its messages selected selects the whole thread",
    (await count(b, 3)) !== null &&
      (await threadRow(b).getAttribute("aria-selected")) === "true" &&
      (await within(8_000, async () => (await conversation.getByRole("article").count()) === 4)) !==
        null,
  );

  await threadRow(b).click();
  await threadRow(b).focus();
  const triangle = threadRow(b).getByRole("button", { name: /(Expand|Collapse) Conversation/ });
  const triangleWhite = await within(5_000, async () => {
    const colour = await triangle.evaluate((each) => getComputedStyle(each).color);
    return colour === "rgb(255, 255, 255)";
  });
  step("the triangle is white on the selected, key-window row", triangleWhite !== null);
  await shot(b, "mail-conversation-selected-triangle");

  await b.keyboard.press("ArrowRight");
  step("the Right arrow opens the selected thread", (await count(b, 6)) !== null);
  await b.keyboard.press("ArrowLeft");
  step("the Left arrow closes it", (await count(b, 3)) !== null);

  await viewer(b).getByRole("button", { name: "Mute" }).click();
  const muted = async () => {
    const all = await allOnServer(b);
    return all.filter(
      (each) =>
        each.subject.endsWith(subject) && each.from.name === chris.name && each.mailbox === "inbox",
    );
  };
  step(
    "Mute acts on the whole thread, on the server, the reply in Sent too",
    (await within(10_000, async () => {
      const all = await allOnServer(b);
      const sent = all.find((each) => each.subject === `Re: ${subject}` && each.mailbox === "sent");
      return (
        (await muted()).every((each) => each.muted) && (await muted()).length === 3 && sent?.muted
      );
    })) !== null,
  );

  await within(10_000, async () => (await values(b))["mail.view"]?.conversations === true);
  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  const afterReload = await muted();
  step(
    "after a reload the server says the thread is muted",
    afterReload.length === 3 && afterReload.every((each) => each.muted),
  );
  step(
    "after a reload the thread's row shows it muted",
    (await within(15_000, async () => {
      return (await threadRow(b).getByRole("img", { name: "Muted" }).count()) === 1;
    })) !== null,
  );
  step(
    "after a reload the list is still organized by conversation",
    (await within(15_000, async () => (await threadRow(b).count()) === 1)) !== null &&
      (await count(b, 3)) !== null &&
      (await menuChecked(b, "Organize by Conversation")),
  );

  await menuPath(b, "View", "Organize by Conversation");
  step("turned off, each message has its row again", (await count(b, 5)) !== null);
});
