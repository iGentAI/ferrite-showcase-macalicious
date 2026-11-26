#!/usr/bin/env node
// Spaces on the desktop: a Desktop added in Mission Control's bar, windows on their own Space, switching
// by the bar and the keys, a window brought forward taking the person to its Space, a window dragged to
// another Space, reordering, removing, and all of it kept across a reload and on the server.
//
//   node e2e/spaces-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("spaces");

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const front = async () =>
    (await page.getByRole("menubar").first().getByRole("menuitem").nth(1).innerText()).trim();
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const bar = overview.getByRole("group", { name: "Spaces" });
  const space = (name) => bar.getByRole("button", { name, exact: true });
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const showing = (id) => shell(id).isVisible();
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.["desktop.spaces"];
  const openOverview = async () => {
    await page.keyboard.press("F3");
    await overview.waitFor({ timeout: 4_000 });
    await page.waitForTimeout(400);
  };
  const currentName = async () => {
    await openOverview();
    const name = await bar
      .locator('[aria-current="true"]')
      .getAttribute("aria-label")
      .catch(() => null);
    const text = name ?? (await bar.locator('[aria-current="true"]').innerText());
    await page.keyboard.press("Escape");
    await overview.waitFor({ state: "detached", timeout: 4_000 });
    return text.trim();
  };

  await launch(page, "Chess");
  await until(async () => (await front()) === "Chess");

  await openOverview();
  step("The bar has one Desktop", (await bar.getByRole("button").count()) === 2);
  await bar.getByRole("button", { name: "Add Desktop" }).click();
  await space("Desktop 2").waitFor({ timeout: 4_000 });
  step(
    "Add Desktop makes Desktop 2, with Mission Control still showing",
    await overview.isVisible(),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, `spaces-bar-${browserName}.png`));
  await space("Desktop 2").click();
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  step(
    "Choosing Desktop 2 shows it: the other Space's window goes",
    await until(async () => !(await showing("chess"))),
  );
  step(
    "On an empty Space no window is key and Finder is in front",
    await until(async () => (await front()) === "Finder"),
    await front(),
  );

  await launch(page, "Calculator");
  await until(async () => (await front()) === "Calculator");
  step("A window opened now is on this Space", await showing("calculator"));

  await page.keyboard.press("Control+ArrowLeft");
  step(
    "Control-Left goes to Desktop 1, its window in front",
    await until(
      async () =>
        (await showing("chess")) && !(await showing("calculator")) && (await front()) === "Chess",
    ),
  );
  await page.keyboard.press("Control+Alt+Digit2");
  step(
    "Control-Option-2 goes to Desktop 2",
    await until(
      async () =>
        (await showing("calculator")) &&
        !(await showing("chess")) &&
        (await front()) === "Calculator",
    ),
  );

  const saved = await until(async () => {
    const now = await stored();
    return now?.spaces?.length === 2 && now.windows?.chess !== now.windows?.calculator;
  });
  step(
    "The Spaces and their windows are kept on the server",
    saved,
    JSON.stringify(await stored()),
  );
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  await shell("calculator").waitFor({ state: "attached", timeout: 10_000 });
  await shell("chess").waitFor({ state: "attached", timeout: 10_000 });
  step(
    "After a reload Desktop 2 is showing, each window on its own Space",
    await until(async () => (await showing("calculator")) && !(await showing("chess"))),
  );

  // A window brought forward from elsewhere takes the person to its Space.
  await launch(page, "Chess");
  step(
    "The Dock's tile for a window on another Space goes there",
    await until(
      async () =>
        (await showing("chess")) && !(await showing("calculator")) && (await front()) === "Chess",
    ),
  );

  // A thumbnail dragged onto a Space.
  await openOverview();
  const thumb = overview.getByRole("button", { name: "Chess", exact: true });
  const from = await thumb.boundingBox();
  const to = await space("Desktop 2").boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 - 12, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await shot(page, path.join(out, `spaces-drag-${browserName}.png`));
  await page.mouse.up();
  step(
    "A thumbnail dragged onto Desktop 2 leaves this Space",
    await until(
      async () =>
        (await overview.getByRole("button", { name: "Chess", exact: true }).count()) === 0,
    ),
  );
  step("and Mission Control stays", await overview.isVisible());

  // Reordering: names go by where a Space stands, the windows stay on their Space.
  await page.waitForTimeout(300);
  const before = await stored();
  const first = await space("Desktop 1").boundingBox();
  const second = await space("Desktop 2").boundingBox();
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width / 2 - 20, second.y + second.height / 2, {
    steps: 3,
  });
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2, { steps: 10 });
  await page.mouse.up();
  step(
    "Dragging a Space along the bar reorders it",
    await until(async () => {
      const now = await stored();
      return now?.spaces?.[0] === before.spaces[1] && now?.spaces?.[1] === before.spaces[0];
    }),
    JSON.stringify((await stored())?.spaces),
  );
  step("and does not choose it", await overview.isVisible());

  // Removing: its windows go to the Space beside it.
  await space("Desktop 2").hover();
  await bar.getByRole("button", { name: "Remove Desktop 2" }).click();
  await space("Desktop 2").waitFor({ state: "detached", timeout: 4_000 });
  step("Remove takes the Desktop out of the bar", (await space("Desktop 1").count()) === 1);
  await page.keyboard.press("Escape");
  await overview.waitFor({ state: "detached", timeout: 4_000 });
  step(
    "and its windows come to the Space left",
    await until(async () => (await showing("chess")) && (await showing("calculator"))),
  );
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  await shell("chess").waitFor({ state: "attached", timeout: 10_000 });
  step(
    "After a reload there is one Desktop with both windows",
    await until(
      async () =>
        (await stored())?.spaces?.length === 1 &&
        (await showing("chess")) &&
        (await showing("calculator")),
    ),
  );
  step(
    "and it is the one Mission Control marks current",
    (await currentName()).includes("Desktop 1"),
  );
});
