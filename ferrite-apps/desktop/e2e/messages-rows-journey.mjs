#!/usr/bin/env node
// Messages' batch rows that a unit test cannot show, in a real browser against the running app.
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot, allow } = twoPeople("messages-rows");
// The room step aborts its own POST to stand for an outage.
allow(/api\/messages\/rooms\/\S* net::ERR_FAILED/);
allow(/console: Failed to load resource: net::ERR_FAILED/);
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mrchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mrmartin-${id}`, fullName: `Martin ${id}`, password };

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const bubbles = (page) => messagesOf(page).locator("[data-message-index]");
const api = async (page, path) =>
  (await page.request.get(new URL(`/api/messages/${path}`, page.url()).href)).json();
const openMenu = async (page, title) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  return page.getByRole("menu").last();
};
const say = async (page, text) => {
  await field(page).fill(text);
  await field(page).press("Enter");
  await within(15_000, () => messagesOf(page).getByText(text).first().isVisible());
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await person("martin", martin);
  await openFromDock(page, "Messages");
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  const box = await field(page).boundingBox();
  step("the field keeps its width inside its menu's trigger", box.width > 200, `${box.width} pt`);

  await field(page).click();
  await page.keyboard.type("it's");
  step(
    "Smart Quotes turn a typed quote",
    (await field(page).inputValue()) === "it’s",
    await field(page).inputValue(),
  );
  await field(page).fill("");
  await page.keyboard.type(`one ${id}`);
  await page.keyboard.press("Enter");
  await within(15_000, () => messagesOf(page).getByText(`one ${id}`).first().isVisible());
  await say(page, `two ${id}`);
  await say(page, `three ${id}`);

  let menu = await openMenu(page, "Edit");
  for (const name of ["Spelling and Grammar", "Substitutions", "Speech"]) {
    await page.getByRole("menuitem", { name, exact: true }).first().waitFor({ timeout: 5000 });
    step(`Edit has ${name}`, true);
  }
  await shot(page, "messages-edit-rows");
  await page.keyboard.press("Escape");

  menu = await openMenu(page, "Buddies");
  const screen = menu.getByRole("menuitem", { name: "Invite to Share My Screen" });
  step(
    "screen sharing is dimmed with its reason",
    (await screen.getAttribute("aria-disabled")) === "true" &&
      Boolean(await screen.getAttribute("title")),
  );
  await page.keyboard.press("Escape");

  await field(page).click({ button: "right" });
  const fieldMenu = page.getByRole("menu", { name: "Message field commands" });
  await fieldMenu.waitFor();
  step(
    "the field's menu opens",
    await fieldMenu.getByRole("menuitem", { name: "Paste" }).isVisible(),
  );
  await shot(page, "messages-field-menu");
  await fieldMenu.getByRole("menuitem", { name: "Spelling and Grammar" }).hover();
  await page.getByRole("menuitem", { name: "Show Spelling and Grammar" }).click();
  const panel = page.getByRole("dialog", { name: "Spelling and Grammar" });
  await panel.waitFor();
  await shot(page, "messages-spelling-panel");
  await panel.getByRole("button", { name: /close/i }).click();

  await bubbles(page)
    .nth(0)
    .click({ modifiers: ["Control"] });
  await bubbles(page)
    .nth(1)
    .click({ modifiers: ["Control"] });
  step(
    "Command-click selects two messages",
    (await messagesOf(page).locator("[data-marked]").count()) === 2,
  );
  await shot(page, "messages-two-selected");
  await page.keyboard.press("Delete");
  await page.getByText("Are you sure you want to delete these 2 messages?").waitFor();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  const [conversation] = (await api(page, "conversations")).conversations;
  await within(
    15_000,
    async () => (await api(page, `conversations/${conversation.id}`)).state.messages.length === 1,
  );
  step(
    "the server keeps the third alone",
    (await api(page, `conversations/${conversation.id}`)).state.messages[0]?.text === `three ${id}`,
  );

  await bubbles(page).first().dblclick();
  const bubbleMenu = page.getByRole("menu", { name: "Message commands" });
  await bubbleMenu.waitFor();
  step(
    "a double click offers the tapbacks",
    await bubbleMenu.getByRole("menuitem", { name: "Love" }).isVisible(),
  );
  await shot(page, "messages-double-click");
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    const bubble = document.querySelector("[data-message-index]");
    const selection = window.getSelection();
    selection.removeAllRanges();
    const range = document.createRange();
    const text = bubble.querySelector(".mac-message-bubble-text") ?? bubble;
    range.selectNodeContents(text);
    selection.addRange(range);
  });
  const from = await bubbles(page).first().boundingBox();
  const into = await field(page).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(into.x + 20, into.y + into.height / 2, { steps: 8 });
  await page.mouse.up();
  step(
    "text dragged from a bubble lands in the field",
    (await field(page).inputValue()).includes(`three ${id}`),
    await field(page).inputValue(),
  );
  await field(page).fill("");

  await page.keyboard.press("Control+o");
  const open = page.locator(".mac-mail-panel-layer");
  await open.waitFor();
  step(
    "File > Open shows the drive's Open panel",
    await open.getByRole("button", { name: "Cancel" }).isVisible(),
  );
  await shot(page, "messages-open-panel");
  await open.getByRole("button", { name: "Cancel" }).click();

  // The shared room: a message that cannot go out comes back after a reload, and arrives once.
  await messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: "Ferrite Room" })
    .click();
  const held = (route) => (route.request().method() === "POST" ? route.abort() : route.continue());
  await page.route("**/api/messages/rooms/*", held);
  await field(page).fill(`room ${id}`);
  await field(page).press("Enter");
  await within(5_000, () => messagesOf(page).getByText(`room ${id}`).first().isVisible());
  await page.unroute("**/api/messages/rooms/*", held);
  await page.reload();
  await openFromDock(page, "Messages").catch(() => {});
  const stored = async () => {
    const reply = await api(page, "rooms/desktop");
    return (reply.state?.messages ?? []).filter((each) => each.text === `room ${id}`).length;
  };
  await within(30_000, async () => (await stored()) >= 1);
  step("the room's message left behind arrives after the reload, once", (await stored()) === 1);
});
