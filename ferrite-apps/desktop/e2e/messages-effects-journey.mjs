#!/usr/bin/env node
// Message effects in Messages on Ferrite, in a real browser against the running app: a phrase plays its screen effect
// once for the person who sent it and the person who got it, not again after a reload, and never for someone who asks
// for less motion. Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/messages-effects-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("messages-effects");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mefchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mefmartin-${id}`, fullName: `Martin ${id}`, password };

const seen = (check, wait = 15_000) => within(wait, check).then((took) => took !== null);
const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const transcript = (page) => messagesOf(page).getByRole("log").first();
const effect = (page, kind) =>
  messagesOf(page).locator(`.mac-messages-effect[data-effect="${kind}"]`);
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();
const send = async (page, words) => {
  const field = messagesOf(page).getByRole("textbox", { name: "Message" });
  await field.fill(words);
  await field.press("Enter");
};

await run({}, {}, async ({ person }) => {
  const b = await person("martin", martin);
  const a = await person("chris", chris);
  await openFromDock(b, "Messages");
  await openFromDock(a, "Messages");
  await messagesOf(a).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(a).getByRole("textbox", { name: "To" }).fill(martin.name);
  await send(a, "Happy Birthday!");
  step(
    "the first message of a conversation plays for its sender",
    await seen(() => effect(a, "balloons").isVisible()),
  );
  await within(20_000, async () => {
    const row = rowOf(b, chris.fullName);
    if (await row.isVisible()) await row.click();
    return transcript(b).getByText("Happy Birthday!").first().isVisible();
  });
  step("and for the person who gets it", await seen(() => effect(b, "balloons").isVisible()));
  await b.waitForTimeout(1_200);
  await shot(b, "messages-effect-balloons");
  step(
    "they go by themselves",
    await seen(async () => (await effect(b, "balloons").count()) === 0, 8_000),
  );

  await send(a, "Happy Birthday!");
  await seen(() => effect(a, "balloons").isVisible());
  const firstPlay = await effect(a, "balloons").getAttribute("data-play");
  await send(a, "Happy Birthday!");
  step(
    "the same words sent again straight away play again",
    await seen(async () => {
      const now = await effect(a, "balloons").getAttribute("data-play", { timeout: 500 });
      return now !== null && Number(now) === Number(firstPlay) + 1;
    }),
  );
  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Messages");
  await within(15_000, () => rowOf(b, chris.fullName).isVisible());
  await rowOf(b, chris.fullName).click();
  await transcript(b).getByText("Happy Birthday!").first().waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_000);
  step("a reload does not play them again", (await effect(b, "balloons").count()) === 0);

  await b.emulateMedia({ reducedMotion: "reduce" });
  await send(a, "Congratulations!");
  await transcript(b).getByText("Congratulations!").first().waitFor({ timeout: 20_000 });
  await b.waitForTimeout(500);
  step(
    "nothing plays for someone who asks for less motion",
    (await effect(b, "confetti").count()) === 0,
  );
});
