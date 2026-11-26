#!/usr/bin/env node
// The Details of a Messages conversation, in a real browser against the running app: its members,
// naming a group, which the other members see and which a reload keeps, and FaceTime from Details.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/messages-details-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                         [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-details");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mdchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mdmartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `mdann-${id}`, fullName: `Ann ${id}`, password };
const NAME = `Crew ${id}`;
// The desktop adds its session to every request.
const TITLE_URL = /\/title(\?|$)/;

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const field = (page) => messagesOf(page).getByRole("textbox", { name: "Message" });
const details = (page) => messagesOf(page).getByRole("button", { name: "Details", exact: true });

async function start(page, to, words) {
  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(to);
  await field(page).fill(words);
  await field(page).press("Enter");
  await within(15_000, () =>
    messagesOf(page).getByRole("log").getByText(words).first().isVisible(),
  );
}

await run({}, {}, async ({ person: open }) => {
  const other = await open("martin", martin);
  await open("ann", ann);
  const page = await open("chris", chris);
  await openFromDock(page, "Messages");
  await openFromDock(other, "Messages");

  await start(page, `${martin.name}, ${ann.name}`, `group ${id}`);
  await details(page).click();
  const members = page.getByRole("list", { name: "Members" });
  step(
    "Details lists a group's members",
    (await within(10_000, async () =>
      (await members.getByRole("listitem").allInnerTexts()).join("|").includes(martin.fullName),
    )) !== null && (await members.getByRole("listitem").count()) === 3,
  );
  const name = page.getByRole("textbox", { name: "Group Name" });
  // Cleared while a name is on its way: both go, and the group ends up with no name.
  let answered = 0;
  const countAnswers = (response) => {
    if (/\/title(\?|$)/.test(response.url()) && response.request().method() === "PUT")
      answered += 1;
  };
  page.on("response", countAnswers);
  let letGo;
  const waiting = new Promise((resolve) => {
    letGo = resolve;
  });
  await page.route(TITLE_URL, async (route) => {
    await waiting;
    await route.continue();
  });
  await name.fill(`Short lived ${id}`);
  await name.press("Enter");
  await name.fill("");
  await name.press("Enter");
  letGo();
  const titles = async () => {
    const reply = await page.request.get(new URL("/api/messages/conversations", page.url()).href);
    return (await reply.json()).conversations.map((each) => each.title ?? null);
  };
  const bothAnswered = await within(10_000, async () => answered === 2);
  page.off("response", countAnswers);
  await page.unroute(TITLE_URL);
  step(
    "Clearing the name while one is on its way sends both, and leaves the group unnamed on the server",
    bothAnswered !== null && (await titles()).every((title) => title === null),
    `${answered} answered; ${JSON.stringify(await titles())}`,
  );
  // Return keeps it; going on typing while the answer is on its way keeps what is typed.
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(TITLE_URL, async (route) => {
    await held;
    await route.continue();
  });
  await name.fill(NAME.slice(0, -1));
  const firstAnswer = page.waitForResponse(
    (response) => TITLE_URL.test(response.url()) && response.request().method() === "PUT",
  );
  await name.press("Enter");
  await name.pressSequentially(NAME.slice(-1));
  // The first name's answer arrives while the last letter is typed and not yet kept.
  release();
  await firstAnswer;
  await page.unroute(TITLE_URL);
  await page.waitForTimeout(800);
  step(
    "Text typed while a name is being kept stays, with the keyboard",
    (await name.inputValue()) === NAME &&
      (await name.evaluate((node) => node === document.activeElement)),
    await name.inputValue(),
  );
  await name.press("Enter");
  await page.waitForTimeout(400);
  await shot(page, "messages-details");
  await page.keyboard.press("Escape");
  const row = (where) =>
    messagesOf(where)
      .getByRole("listbox", { name: "Conversations" })
      .getByRole("option")
      .filter({ hasText: NAME })
      .first();
  step(
    "Naming the group renames it in the list",
    (await within(10_000, () => row(page).isVisible())) !== null,
  );
  step(
    "and the other member sees the name",
    (await within(30_000, () => row(other).isVisible())) !== null,
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Messages").catch(() => {});
  step(
    "and it is there after a reload",
    (await within(20_000, () => row(page).isVisible())) !== null,
  );

  await start(page, martin.name, `one ${id}`);
  await details(page).click();
  step(
    "A conversation of two has no name to give",
    (await within(10_000, () => page.getByRole("list", { name: "Members" }).isVisible())) !==
      null && (await page.getByRole("textbox", { name: "Group Name" }).count()) === 0,
  );
  await page.getByRole("button", { name: "FaceTime Video" }).click();
  const facetime = page.getByRole("region", { name: "FaceTime" }).first();
  step(
    "FaceTime Video in Details rings the other person, on the server",
    (await within(20_000, async () => {
      if (!(await facetime.isVisible())) return false;
      const reply = await other.request.get(new URL("/api/facetime/calls", other.url()).href);
      const { incoming } = await reply.json();
      return incoming?.state?.members.some((member) => member.name === chris.name) === true;
    })) !== null,
  );
});
