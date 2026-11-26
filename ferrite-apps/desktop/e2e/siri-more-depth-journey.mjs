#!/usr/bin/env node
// Siri's rows nothing drove: its window from the held key, moved and kept; settings it changes, read back from the
// server; an earlier answer's card that still opens; a file dragged out of a card; and the language it listens in,
// read from a stub of the browser's speech recognition, since a headless browser has no microphone or speech service.
//
//   node e2e/siri-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("siri-more-depth");
const tag = Date.now().toString(36);
const WORD = `Tamarind${tag}`;
const FILE = `${WORD} list.txt`;
const SETTINGS = "/api/system-preferences/settings";
const TOUCHED = [
  "siri.place",
  "siri.language",
  "sound.mute",
  "sound.outputVolume",
  "displays.brightness",
  "dock.autohide",
];

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const settings = async (page) => (await api(page, "GET", SETTINGS)).json.values ?? {};

await run(async (page) => {
  await page.addInitScript(() => {
    window.heardLangs = [];
    window.SpeechRecognition = class {
      start() {
        window.heardLangs.push(this.lang);
        queueMicrotask(() => this.onresult?.({ results: [[{ transcript: "what time is it" }]] }));
        setTimeout(() => this.onend?.(), 0);
      }
      stop() {}
    };
  });
  await openDesktop(page, base, step);
  const then = await settings(page);
  const made = await uploadFile(page, {
    parent: "documents",
    name: FILE,
    type: "text/plain",
    text: "x",
  });
  const field = page.getByRole("textbox", { name: "Type to Siri" });
  const frame = page.locator(".mac-desktop-shell-siri");
  const ask = async (text) => {
    await field.fill(text);
    await field.press("Enter");
    await until(async () => (await page.getByText(`“${text}”`).count()) > 0);
    await until(async () => (await page.locator("[data-answer]").count()) > 0);
    return (await page.locator("[data-answer]").innerText()).trim();
  };

  try {
    // The held key.
    await page.keyboard.down("Control");
    await page.keyboard.down("Alt");
    await page.keyboard.down("Space");
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await page.keyboard.up("Alt");
    await page.keyboard.up("Control");
    step("Holding the key opens Siri", await until(() => field.isVisible()));
    await shot(page, path.join(out, `siri-held-key-${browserName}.png`));

    // Moved.
    const before = await frame.boundingBox();
    const grip = { x: before.x + 60, y: before.y + 14 };
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x - 200, grip.y + 80, { steps: 6 });
    await page.mouse.up();
    const after = await frame.boundingBox();
    step(
      "Dragging moves the window",
      Math.abs(after.x - (before.x - 200)) < 2 && Math.abs(after.y - (before.y + 80)) < 2,
    );
    await shot(page, path.join(out, `siri-moved-${browserName}.png`));
    step(
      "and its place is kept on the server",
      await until(async () => (await settings(page))["siri.place"]?.x === -200),
    );

    // Settings.
    await field.click();
    step("Mute is answered", (await ask("mute")) === "The sound is off.");
    step("and written", await until(async () => (await settings(page))["sound.mute"] === true));
    await ask("unmute");
    const dim = await ask("turn down the brightness");
    step("Brightness moves", /The brightness is at \d+%/.test(dim), dim);
    step(
      "and is written",
      await until(async () => (await settings(page))["displays.brightness"] < 80.5),
    );
    await shot(page, path.join(out, `siri-setting-${browserName}.png`));
    await ask("hide the Dock");
    step(
      "Hide the Dock is kept, and the Dock goes",
      (await until(async () => (await settings(page))["dock.autohide"] === true)) &&
        (await until(
          async () =>
            (await page.locator(".mac-desktop-shell-dock").getAttribute("data-autohide")) !== null,
        )),
    );
    await ask("show the Dock");
    step(
      "A radio it cannot reach is said, not pretended",
      (await ask("turn off wifi")).includes("can’t change"),
    );

    // An earlier answer's card still opens.
    await page.route(/\/api\/siri\/ask/, (route) =>
      route.fulfill({
        json: {
          text: "Two plain rows.",
          card: { title: "Plain", app: "siri", items: [{ text: "First plain row" }] },
          effects: [],
          via: "commands",
          understood: true,
        },
      }),
    );
    const plainReply = await ask("plain rows please");
    await page.unroute(/\/api\/siri\/ask/);
    await ask("what time is it");
    step(
      "A card's plain rows stay too (the row comes from a stub of Siri's route)",
      await until(() =>
        page
          .getByRole("list", { name: "Earlier answers" })
          .getByText("First plain row")
          .isVisible(),
      ),
      plainReply,
    );
    await ask(`find files about ${WORD}`);
    const inCard = page.getByRole("button", { name: FILE });
    await inCard.first().waitFor({ timeout: 15_000 });
    await ask("what time is it");
    const inEarlier = page
      .getByRole("list", { name: "Earlier answers" })
      .getByRole("button", { name: FILE });
    await inEarlier.waitFor({ timeout: 5_000 });
    await shot(page, path.join(out, `siri-earlier-card-${browserName}.png`));
    step("An earlier answer keeps its card", true);

    // Dragged out.
    await ask(`find files about ${WORD}`);
    const row = page.getByRole("button", { name: FILE }).last();
    const from = await row.boundingBox();
    const trash = await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "TextEdit", exact: true })
      .boundingBox();
    await page.mouse.move(from.x + 10, from.y + 5);
    await page.mouse.down();
    await page.mouse.move(from.x - 10, from.y + 30, { steps: 5 });
    step(
      "A file in a card drags, and Siri gets out of the way",
      await until(async () => !(await field.isVisible())),
    );
    await page.mouse.move(trash.x + trash.width / 2, trash.y + trash.height / 2, { steps: 8 });
    await page.mouse.up();
    step(
      "and dropped on an app's tile it opens there",
      await until(() => page.locator(".mac-window").filter({ hasText: FILE }).first().isVisible()),
    );
    await shot(page, path.join(out, `siri-dragged-out-${browserName}.png`));
    await page
      .locator(".mac-window")
      .getByRole("button", { name: "Close", exact: true })
      .first()
      .click();

    // The place across a reload, and the language.
    await page.waitForTimeout(2_500);
    const { json } = await api(page, "GET", SETTINGS);
    await api(page, "PUT", SETTINGS, {
      values: { ...(json.values ?? {}), "siri.language": "German (Germany)" },
      rev: json.rev,
    });
    await reloadDesktop(page);
    await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
    await field.waitFor({ timeout: 8_000 });
    const back = await frame.boundingBox();
    step(
      "Across a reload it opens where it was left",
      Math.abs(back.x - after.x) < 2 && Math.abs(back.y - after.y) < 2,
    );
    const screen = page.viewportSize();
    const reachable = async () => {
      const box = await frame.boundingBox();
      const { width, height } = page.viewportSize();
      return box.y >= 22 && box.y + 40 <= height && box.x >= 0 && box.x + 40 <= width;
    };
    await page.setViewportSize({ width: 700, height: 300 });
    step("A screen that shrinks while it is open leaves it in reach", await until(reachable));
    await reloadDesktop(page);
    await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
    await field.waitFor({ timeout: 8_000 });
    step("and so does opening on a smaller screen", await until(reachable));
    await page.setViewportSize(screen);
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    step(
      "It listens in the language of its pane (a stub stands in for speech recognition)",
      await until(async () => (await page.evaluate(() => window.heardLangs)).includes("de-DE")),
    );
    await page
      .getByRole("button", { name: "Close", exact: true })
      .first()
      .click()
      .catch(() => {});
  } finally {
    await page.waitForTimeout(1_500);
    const { json } = await api(page, "GET", SETTINGS);
    const values = { ...(json.values ?? {}) };
    for (const key of TOUCHED) {
      if (key in then) values[key] = then[key];
      else delete values[key];
    }
    await api(page, "PUT", SETTINGS, { values, rev: json.rev });
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "trash", id: made }] });
    const back = await settings(page);
    step(
      "The account's own choices are back",
      TOUCHED.every((key) => JSON.stringify(back[key]) === JSON.stringify(then[key])),
    );
  }
});
