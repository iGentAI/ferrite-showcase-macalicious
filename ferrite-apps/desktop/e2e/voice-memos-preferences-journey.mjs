#!/usr/bin/env node
// Voice Memos' Preferences on the desktop served by `ferrite dev`: the row in the application menu; Audio
// Quality's Lossless, read from the file a take leaves on the drive; Clear Deleted's Immediately, read from the
// drive after a Delete; both kept across a reload. The microphone is Chromium's fake device. Exits 0 only with
// every step passed and no console or HTTP error. It puts the Preferences back as they were.
//
// Immediately erases what is in Recently Deleted, so this journey stops before choosing it on a drive with
// anything in the Trash: each run is a new guest with an empty drive, and a signed-in person's recordings
// are never in reach of it.
//
//   node e2e/voice-memos-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("voice-memos-preferences", {
  launchOptions: {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
});
const URL_ = "/api/voice-memos/preferences";

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
  const win = page.locator('.mac-managed-window[data-window-id="voice-memos"]').first();
  const launch = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("Voice Memos");
    await field.press("Enter");
    await win.waitFor({ timeout: 15_000 });
    await until(async () => (await win.getByRole("button", { name: "New Recording" }).count()) > 0);
  };
  await launch();
  const bar = page.getByRole("menubar").first();
  const choose = async (menu, item) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).first().click();
  };
  const panel = win.locator(".mac-voice-memos-preferences");
  const pick = async (control, option) => {
    await panel.getByRole("combobox", { name: control }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  const kept = async () => (await api(page, "GET", URL_)).json.preferences;
  const entries = async () => (await api(page, "GET", "/api/files/")).json.entries ?? [];

  const inTrash = (await entries()).filter((each) => each.trashed_ms !== undefined);
  step(
    "the drive has nothing in its Trash for Immediately to erase",
    inTrash.length === 0,
    JSON.stringify(inTrash.map((each) => each.name)),
  );
  if (inTrash.length > 0) return;

  await choose("Voice Memos", "Preferences…");
  await panel.waitFor({ timeout: 5_000 });
  await pick("Audio Quality", "Lossless");
  await pick("Clear Deleted", "Immediately");
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "voice-memos-preferences.png"));
  const savedKept = await until(async () => {
    const now = await kept();
    return now?.audioQuality === "lossless" && now?.clearDeleted === "immediately" ? now : false;
  });
  step("Preferences opens from the menu, and its choices are kept", Boolean(savedKept));

  await reloadDesktop(page);
  await launch();
  await choose("Voice Memos", "Preferences…");
  await panel.waitFor({ timeout: 5_000 });
  const shown = await panel.innerText();
  step(
    "they are there after a reload",
    /Lossless/.test(shown) && /Immediately/.test(shown),
    shown.replace(/\s+/g, " "),
  );
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await panel.waitFor({ state: "detached", timeout: 5_000 });

  const rows = () => win.getByRole("option");
  const before = await rows().count();
  await choose("File", "New Recording");
  await win.getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  await win.getByRole("button", { name: "Done" }).click();
  await until(async () => (await rows().count()) === before + 1, 20_000);
  await until(async () => !/Saving|Not saved/.test(await rows().first().innerText()), 20_000);
  const title = (await rows().first().innerText()).split("\n")[0];
  const made = (await entries()).find((each) => each.name.startsWith(title));
  const bytes = made
    ? await page.evaluate(async (id) => {
        const response = await fetch(`/api/files/content/${id}?piece=0&count=8`, {
          credentials: "same-origin",
        });
        const head = new Uint8Array(await response.arrayBuffer()).slice(0, 12);
        return String.fromCharCode(...head);
      }, made.id)
    : "";
  step(
    "Lossless writes a take as a WAV file",
    made?.name.endsWith(".wav") && bytes.startsWith("RIFF") && bytes.slice(8) === "WAVE",
    JSON.stringify({ name: made?.name, type: made?.type }),
  );

  await win.getByRole("option", { name: new RegExp(title) }).click();
  await choose("Edit", "Delete");
  const gone = await until(async () => !(await entries()).some((each) => each.id === made?.id));
  step("Clear Deleted's Immediately takes a deleted recording off the drive", gone === true);

  await api(page, "DELETE", URL_);
});
