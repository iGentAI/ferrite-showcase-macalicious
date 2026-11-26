#!/usr/bin/env node
// News: several stories. In Saved Stories and History, Command-click and Shift-click choose stories, a
// plain click still opens one, their menu, Select All, Delete and Escape act on them, and each change
// is read back from the server. A story's address drags into a text field. It runs as the guest of a
// new browser, whose library nobody else has.
//
//   node e2e/news-several-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("news-several", { ignoreOtherOrigins: true });
const LIBRARY = "/api/news/library";
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

await run(async (page) => {
  await openDesktop(page, base, step);
  const { channels } = (await api(page, "GET", "/api/news/catalogue")).json;
  const source = channels[0];
  const kept = (id, title) => ({
    id,
    source: source.id,
    publisher: source.name,
    title,
    link: `https://example.com/${id}`,
  });
  const saved = [0, 1, 2, 3, 4].map((at) => kept(`saved-${at}`, `Saved story ${at}`));
  const history = [0, 1, 2].map((at) => kept(`read-${at}`, `Read story ${at}`));
  const held = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    library: { following: [source.id], blocked: [], saved, history },
    rev: held.rev,
  });

  await reloadDesktop(page);
  await launch(page, "News");
  const window = page.getByRole("region", { name: "News", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const go = (name) =>
    window.locator(".mac-catalyst-chrome-sidebar-item", { hasText: name }).first().click();
  await go("Saved Stories");
  const link = (title) => window.locator(".mac-news-story-link", { hasText: title }).first();
  await link("Saved story 0").waitFor({ timeout: 10_000 });
  const chosen = () => window.locator('.mac-news-story-link[aria-pressed="true"]').allInnerTexts();
  const library = async () => (await api(page, "GET", LIBRARY)).json?.library;
  const titles = (list) => list.map(({ title }) => title).join();

  await link("Saved story 2").click({ modifiers: [COMMAND] });
  await link("Saved story 0").click({ modifiers: [COMMAND] });
  step(
    "Command-click chooses stories and opens none",
    (await chosen()).join() === "Saved story 0,Saved story 2" &&
      (await window.locator('[data-view="reader"]').count()) === 0,
    (await chosen()).join(),
  );
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "news-several.png"));

  await link("Saved story 3").click({ modifiers: ["Shift"] });
  step(
    "Shift-click chooses the run",
    (await chosen()).join() === "Saved story 0,Saved story 1,Saved story 2,Saved story 3",
    (await chosen()).join(),
  );

  await chooseMenu(page, "Edit", "Select All");
  step(
    "Edit > Select All chooses the list",
    (await chosen()).length === 5,
    (await chosen()).join(),
  );
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  step("Escape lets go of them", (await chosen()).length === 0, (await chosen()).join());

  await chooseMenu(page, "Edit", "Select All");
  step(
    "Edit > Select All chooses the list with nothing chosen before",
    (await chosen()).length === 5,
    (await chosen()).join(),
  );
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.keyboard.press(`${COMMAND}+a`);
  step(
    "Command-A chooses the list with nothing chosen before",
    (await chosen()).length === 5,
    (await chosen()).join(),
  );
  await page.keyboard.press("Escape");

  await link("Saved story 0").click({ modifiers: [COMMAND] });
  await link("Saved story 1").click({ modifiers: [COMMAND] });
  await link("Saved story 1").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove 2 from Saved Stories" }).click();
  step(
    "A chosen story's menu removes them all, and only them",
    await until(
      async () => titles((await library()).saved) === "Saved story 2,Saved story 3,Saved story 4",
      5_000,
    ),
    titles((await library()).saved),
  );

  await go("History");
  await link("Read story 0").waitFor({ timeout: 5_000 });
  step("Going to another view lets go of them", (await chosen()).length === 0);
  await link("Read story 0").click({ modifiers: [COMMAND] });
  await link("Read story 2").click({ modifiers: [COMMAND] });
  await page.keyboard.press("Delete");
  step(
    "Delete removes the chosen from History",
    await until(async () => titles((await library()).history) === "Read story 1", 5_000),
    titles((await library()).history),
  );

  // ---- A plain click, and a drag ------------------------------------------------------------------
  await go("Saved Stories");
  await link("Saved story 2").waitFor({ timeout: 5_000 });
  const from = await link("Saved story 2").boundingBox();
  const field = window.getByRole("searchbox").first();
  const to = await field.boundingBox();
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + from.height / 2 - 8, { steps: 4 });
  await page.mouse.move(to.x + 40, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  const typed = await field.inputValue();
  step(
    "A story dragged to a text field drops its address",
    typed === "https://example.com/saved-2",
    typed,
  );
  await field.fill("");

  await link("Saved story 2").click();
  await window.locator('[data-view="reader"]').waitFor({ timeout: 5_000 });
  step("A plain click still opens a story", true);
});
