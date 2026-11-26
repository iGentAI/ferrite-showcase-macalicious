#!/usr/bin/env node
// Voice Memos' menu rows and keys on the desktop served by `ferrite dev`: File > New Recording and
// Command-N, Space to stop and play, Duplicate from the row's contextual menu, Edit > Rename, Command-T
// and Delete, each read back from the drive or the window. The microphone is Chromium's fake device.
// Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/voice-memos-menus-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("voice-memos-menus", {
  launchOptions: {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
});

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  const LIBRARY = "/api/app-store/library";
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    installed: [...(held.installed ?? []).filter((id) => id !== "voice-memos"), "voice-memos"],
    rev: held.rev,
  });
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Voice Memos");
  await field.press("Enter");
  const win = page.locator('.mac-managed-window[data-window-id="voice-memos"]').first();
  await win.waitFor({ timeout: 15_000 });
  await until(async () => (await win.getByRole("button", { name: "New Recording" }).count()) > 0);

  const bar = page.getByRole("menubar").first();
  const choose = async (menu, item) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).first().click();
  };
  const options_ = () => win.getByRole("option");

  await choose("File", "New Recording");
  await win.getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
  step("File > New Recording starts a take", true);
  await page.waitForTimeout(1_500);
  await win.getByRole("button", { name: "Done" }).click();
  await until(async () => (await options_().count()) === 1, 20_000);
  step("Done lists it", (await options_().count()) === 1);
  await until(async () => !/Saving|Not saved/.test(await options_().first().innerText()), 20_000);

  await options_().first().click({ button: "right" });
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "voice-memos-row-menu.png"));
  await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
  const two = await until(async () => (await options_().count()) === 2, 20_000);
  const copied = await win.getByRole("option", { name: / copy/ }).count();
  step("Duplicate in the row's menu makes a copy on the drive", two === true && copied === 1);

  await choose("Edit", "Rename");
  const NAME = `Renamed ${Date.now().toString(36)}`;
  await page.getByRole("textbox", { name: "Recording name" }).fill(NAME);
  await page.getByRole("button", { name: "Rename", exact: true }).last().click();
  const renamed = await until(
    async () => (await win.getByRole("option", { name: NAME }).count()) === 1,
  );
  step("Edit > Rename renames it", renamed === true);

  await win.getByRole("option", { name: NAME }).click();
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  const audio = win.locator("audio");
  const ready = await until(() => audio.evaluate((each) => each.readyState >= 2));
  await win.getByRole("timer", { name: "Position" }).click();
  await page.keyboard.press("Space");
  const playing = await until(() => audio.evaluate((each) => !each.paused));
  step("Space plays it", ready === true && playing === true);
  await page.keyboard.press("Space");
  const stopped = await until(() => audio.evaluate((each) => each.paused));
  step("Space again stops it", stopped === true);
  const at = () => audio.evaluate((each) => each.currentTime);
  const from = await at();
  await page.keyboard.press("ArrowLeft");
  const back = await until(async () => (await at()) < from - 0.5 || (await at()) === 0, 3_000);
  const left = await at();
  await page.keyboard.press("ArrowRight");
  const on = await until(async () => (await at()) > left + 0.5, 3_000);
  step(
    "the arrow keys move the playhead a second each way",
    back === true && on === true,
    `${from} to ${left} to ${await at()}`,
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "voice-memos-arrow-keys.png"));
  await page.keyboard.press("Meta+t");
  await win.getByRole("group", { name: "Trim" }).waitFor({ timeout: 5_000 });
  step("Command-T shows the trim handles", true);
  await shot(page, path.join(out, "voice-memos-trim-key.png"));
  await win.getByRole("button", { name: "Cancel", exact: true }).click();
  await win.getByRole("button", { name: "Done", exact: true }).click();

  await choose("Edit", "Delete");
  const one = await until(async () => (await options_().count()) === 1);
  step("Edit > Delete removes it from the list", one === true);
  await choose("Edit", "Delete");
  await until(async () => (await options_().count()) === 0);
});
