#!/usr/bin/env node
// A message in a window of its own on Ferrite, in a real browser against the running app: opened by
// a double click and by File > Open Message, its text read from the server, answered with Reply and
// sent to the Trash from the window. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-message-window-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                            [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-message-window");
const id = Date.now().toString(36);
const chris = { name: `mwchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const SUBJECT = `Window ${id}`;
const TEXT = `The text of ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const reader = (page) => page.locator(".mac-mail-reader");
const row = (page) =>
  viewer(page)
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: SUBJECT })
    .first();
const server = async (page) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  const { messages } = await reply.json();
  return messages.filter((message) => message.subject === SUBJECT);
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(page).isVisible());

  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const to = compose(page).getByLabel("To:");
  await to.click();
  await to.pressSequentially(chris.name);
  await to.press("Enter");
  await compose(page).getByLabel("Subject:").fill(SUBJECT);
  await compose(page).locator('[contenteditable="true"]').first().click();
  await page.keyboard.type(TEXT);
  await page.keyboard.press("Control+Shift+D");
  if (!(await within(15_000, async () => (await compose(page).count()) === 0))) {
    throw new Error("the message did not go");
  }
  await within(20_000, async () => {
    await page.keyboard.press("Control+Shift+N");
    return row(page).isVisible();
  });

  await row(page).dblclick();
  await reader(page).first().waitFor({ timeout: 10_000 });
  step(
    "a double click opens the message in a window, with its text",
    (await within(10_000, () => reader(page).getByText(TEXT).isVisible())) !== null,
  );
  await shot(page, "mail-message-window");

  await reader(page).getByRole("button", { name: "Close" }).click();
  await reader(page).first().waitFor({ state: "detached", timeout: 5_000 });
  step("its close button closes it", (await reader(page).count()) === 0);

  await row(page).click();
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: "Open Message" }).click();
  await reader(page).first().waitFor({ timeout: 10_000 });
  step("File > Open Message opens it too", (await reader(page).count()) === 1);

  await reader(page).getByRole("button", { name: "Reply", exact: true }).click();
  await compose(page).waitFor({ timeout: 10_000 });
  step(
    "Reply in the window answers that message",
    (await compose(page).getByLabel("Subject:").inputValue()) === `Re: ${SUBJECT}`,
  );
  await compose(page).getByRole("button", { name: "Close" }).click();
  await compose(page).waitFor({ state: "detached", timeout: 10_000 });

  await reader(page).getByRole("button", { name: "Delete" }).click();
  step(
    "Delete in the window closes it and moves the message to the Trash on the server",
    (await within(10_000, async () => {
      const inbox = await server(page);
      return (await reader(page).count()) === 0 && inbox.some((m) => m.mailbox === "trash");
    })) !== null,
  );

  // The menu bar acts on the window in front, not on what the viewer has selected.
  const send = async (subject) => {
    await viewer(page).getByRole("button", { name: "New Message" }).click();
    const field = compose(page).getByLabel("To:");
    await field.click();
    await field.pressSequentially(chris.name);
    await field.press("Enter");
    await compose(page).getByLabel("Subject:").fill(subject);
    await page.keyboard.press("Control+Shift+D");
    await within(15_000, async () => (await compose(page).count()) === 0);
  };
  const rowOf = (subject) =>
    viewer(page)
      .getByRole("listbox", { name: "Messages" })
      .getByRole("option")
      .filter({ hasText: subject })
      .first();
  const inboxRows = async () => {
    const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
    return (await reply.json()).messages;
  };
  const mailboxesOf = async (subject) =>
    (await inboxRows())
      .filter((m) => m.subject === subject && m.mailbox !== "sent")
      .map((m) => m.mailbox);
  // The window goes to the right of the list, so that a row can be clicked with it open.
  const moveReaderAside = async () => {
    const box = await reader(page).first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(800 + box.width / 2, box.y + 10, { steps: 8 });
    await page.mouse.up();
  };
  const messageDelete = async () => {
    const box = await reader(page).first().boundingBox();
    // Below the title bar: notification banners cover its right end.
    await page.mouse.click(1350, box.y + 300);
    await page
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Message", exact: true })
      .first()
      .click();
    await page.getByRole("menu").last().getByRole("menuitem", { name: "Delete" }).click();
  };
  const A = `Alpha ${id}`;
  const B = `Bravo ${id}`;
  await send(A);
  await send(B);
  await within(20_000, async () => {
    await page.keyboard.press("Control+Shift+N");
    return (await rowOf(A).isVisible()) && (await rowOf(B).isVisible());
  });
  await rowOf(A).dblclick();
  await reader(page).first().waitFor({ timeout: 10_000 });
  await moveReaderAside();
  await rowOf(B).click();
  await messageDelete();
  step(
    "Message > Delete in the window takes its own message, not the one selected in the viewer",
    (await within(10_000, async () => {
      const [a, b] = [await mailboxesOf(A), await mailboxesOf(B)];
      return a.includes("trash") && b.length > 0 && !b.includes("trash");
    })) !== null,
  );

  // In the Trash, Delete erases for good: only the window's message goes.
  await rowOf(B).click();
  await viewer(page).getByRole("button", { name: "Delete" }).click();
  await within(10_000, async () => (await mailboxesOf(B)).every((box) => box === "trash"));
  await viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: /^Trash/ })
    .click();
  await rowOf(A).dblclick();
  await reader(page).first().waitFor({ timeout: 10_000 });
  await moveReaderAside();
  await rowOf(B).click();
  await messageDelete();
  step(
    "from the Trash, the window's message is erased and the selected one stays",
    (await within(10_000, async () => {
      const [a, b] = [await mailboxesOf(A), await mailboxesOf(B)];
      return a.length === 0 && b.length > 0 && b.every((box) => box === "trash");
    })) !== null,
  );
});
