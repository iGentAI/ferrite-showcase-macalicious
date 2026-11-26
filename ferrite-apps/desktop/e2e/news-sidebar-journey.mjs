#!/usr/bin/env node
// News: the channels of the sidebar reordered by a real drag and by their menu, kept on the server and
// over a reload, and the arrow keys moving between listed stories. The feeds are the live ones.
//
//   node e2e/news-sidebar-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("news-sidebar", { ignoreOtherOrigins: true });
const LIBRARY = "/api/news/library";

const openNews = async (page) => {
  await launch(page, "News");
  const window = page.getByRole("region", { name: "News", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 20_000 },
  );
  return window;
};

await run(async (page) => {
  await openDesktop(page, base, step);
  const { channels } = (await api(page, "GET", "/api/news/catalogue")).json;
  const three = channels.slice(0, 3);
  const ids = three.map(({ id }) => id);
  const names = three.map(({ name }) => name);
  const held = (await api(page, "GET", LIBRARY)).json;
  const stories = Array.from({ length: 5 }, (_, at) => ({
    id: `story-${at}`,
    source: ids[0],
    publisher: names[0],
    title: `Kept story ${at}`,
    link: `https://example.com/story-${at}`,
  }));
  // A new browser signs in as a guest of its own, whose library nobody else has: nothing to restore.
  await api(page, "PUT", LIBRARY, {
    library: { following: ids, blocked: [], saved: stories, history: [] },
    rev: held.rev,
  });

  await reloadDesktop(page);
  let window = await openNews(page);
  const rows = () =>
    window
      .locator(".mac-news-channel-row .mac-catalyst-chrome-sidebar-item")
      .allInnerTexts()
      .then((texts) => texts.flatMap((text) => names.find((name) => text.includes(name)) ?? []));
  const row = (name) => window.locator(".mac-news-channel-row", { hasText: name }).first();
  const stored = async () =>
    ((await api(page, "GET", LIBRARY)).json?.library?.following ?? []).filter((id) =>
      ids.includes(id),
    );
  await row(names[0]).waitFor({ timeout: 10_000 });
  step(
    "the sidebar lists the channels in the person's order",
    (await rows()).join() === names.join(),
    (await rows()).join(),
  );

  // ---- A real drag: the last channel to the top --------------------------------------------------
  const from = await row(names[2]).boundingBox();
  const to = await row(names[0]).boundingBox();
  await page.mouse.move(from.x + 60, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + from.height / 2 - 6, { steps: 4 });
  await page.mouse.move(to.x + 60, to.y + 3, { steps: 10 });
  const line = await row(names[0]).getAttribute("data-drop");
  await shot(page, path.join(out, "news-channel-drag.png"));
  await page.mouse.up();
  const dragged = [ids[2], ids[0], ids[1]];
  step("a line shows where it would land", line === "before", String(line));
  step(
    "dragging a channel to the top moves it there, on the server too",
    await until(async () => (await stored()).join() === dragged.join(), 5_000),
    JSON.stringify(await stored()),
  );

  // ---- The menu ----------------------------------------------------------------------------------
  await row(names[2]).click({ button: "right" });
  const up = page.getByRole("menuitem", { name: "Move Up" });
  step("Move Up is dimmed for the first", (await up.getAttribute("aria-disabled")) === "true");
  await page.getByRole("menuitem", { name: "Move Down" }).click();
  const moved = [ids[0], ids[2], ids[1]];
  step(
    "Move Down in a channel's menu moves it one down",
    await until(async () => (await stored()).join() === moved.join(), 5_000),
    JSON.stringify(await stored()),
  );

  await reloadDesktop(page);
  window = await openNews(page);
  await row(names[0]).waitFor({ timeout: 10_000 });
  step(
    "over a reload the order is as it was left",
    (await rows()).join() === [names[0], names[2], names[1]].join(),
    (await rows()).join(),
  );

  // ---- The arrow keys ----------------------------------------------------------------------------
  await window
    .locator(".mac-catalyst-chrome-sidebar-item", { hasText: "Saved Stories" })
    .first()
    .click();
  const links = window.locator(".mac-news-story-link");
  await links.first().waitFor({ timeout: 8_000 });
  await links.first().focus();
  const focused = () => page.evaluate(() => document.activeElement?.textContent);
  const start = await focused();
  await page.keyboard.press("ArrowRight");
  const right = await focused();
  await page.keyboard.press("ArrowDown");
  const down = await focused();
  await page.keyboard.press("ArrowLeft");
  const left = await focused();
  await page.keyboard.press("ArrowUp");
  const up2 = await focused();
  step(
    "the arrow keys walk the stories in both directions",
    start === "Kept story 0" &&
      right === "Kept story 1" &&
      down === "Kept story 3" &&
      left === "Kept story 2" &&
      up2 === "Kept story 0",
    [start, right, down, left, up2].join(" > "),
  );
  await page.keyboard.press("Enter");
  await window.locator('[data-view="reader"]').waitFor({ timeout: 5_000 });
  step("Return opens the story the keys reached", true);
});
