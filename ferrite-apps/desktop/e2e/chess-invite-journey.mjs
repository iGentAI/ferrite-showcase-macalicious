#!/usr/bin/env node
// Chess invitations from Messages, two people: Buddies > Invite to Chess… opens New Game with the
// person's account filled in, and the invitation reaches them.
//
//   node e2e/chess-invite-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { chooseMenu, until } from "./media-census-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("chess-invite");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `cichris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `cimartin-${id}`, fullName: `Martin ${id}`, password };
const LIVE_MS = 20_000;

const messages = (page) => page.locator('[aria-label="Messages"]').first();
const chess = (page) => page.locator(".mac-chess").first();

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(b, "Chess", "Chess").catch(() => {});
  await b.getByRole("grid", { name: "Chessboard" }).first().waitFor({ timeout: 15_000 });

  await openFromDock(a, "Messages");
  await messages(a).getByRole("button", { name: "Compose new message" }).click();
  await messages(a).getByRole("textbox", { name: "To" }).fill(martin.name);
  const field = messages(a).getByRole("textbox", { name: "Message" });
  await field.fill(`A game? ${id}`);
  await field.press("Enter");
  await until(
    async () =>
      (await messages(a).locator('[data-direction="sent"]').filter({ hasText: id }).count()) > 0,
    15_000,
  );

  await chooseMenu(a, "Buddies", "Invite to Chess…");
  const sheet = a.getByRole("dialog").filter({ hasText: "New Game" });
  await sheet.waitFor({ timeout: 15_000 });
  const account = sheet.getByRole("textbox", { name: "Account name" });
  step(
    "Buddies > Invite to Chess… opens New Game with the person's account filled in",
    (await account.inputValue()) === martin.name,
    await account.inputValue(),
  );
  await a.waitForTimeout(300);
  await shot(a, "chess-invite-new-game");

  await sheet.getByRole("button", { name: "Send Invitation" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 8_000 });
  step(
    "the invitation is on its way",
    await until(async () =>
      /Waiting for/.test(await chess(a).locator(".mac-chess-status").innerText()),
    ),
  );

  const gamesButton = chess(b).getByRole("button", { name: /^Games/ });
  const received = await within(LIVE_MS, async () => /\(1\)/.test(await gamesButton.innerText()));
  step("and reaches the other person's Chess", received !== null, `${received} ms`);
  await gamesButton.click();
  const list = b.getByRole("dialog").filter({ hasText: "Games" });
  await list.waitFor({ timeout: 10_000 });
  await shot(b, "chess-invite-received");
  await list.getByRole("button", { name: "Accept" }).first().click();
  await list.waitFor({ state: "hidden", timeout: 30_000 });
  step(
    "who accepts, and the game starts on both sides",
    (await within(
      LIVE_MS,
      async () => !/Waiting for/.test(await chess(a).locator(".mac-chess-status").innerText()),
    )) !== null,
  );
});
