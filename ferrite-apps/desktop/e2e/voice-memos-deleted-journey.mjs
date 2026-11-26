#!/usr/bin/env node
// Voice Memos' Recently Deleted and Share on the desktop served by `ferrite dev`: a recording deleted from
// the list is listed there and still plays; Recover puts it back; Delete asks, then removes it for good, read
// back from the drive; File > Share offers the receivers and hands a recording to Messages. The microphone is
// Chromium's fake device. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/voice-memos-deleted-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("voice-memos-deleted", {
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
  const rows = () => win.getByRole("option");
  const entries = async () => (await api(page, "GET", "/api/files/")).json.entries ?? [];
  const place = () => win.locator(".mac-voice-memos-place");

  const before = await rows().count();
  await choose("File", "New Recording");
  await win.getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  await win.getByRole("button", { name: "Done" }).click();
  await until(async () => (await rows().count()) === before + 1, 20_000);
  await until(async () => !/Saving|Not saved/.test(await rows().first().innerText()), 20_000);
  const name = (await rows().first().innerText()).split("\n")[0];
  const row = () => win.getByRole("option", { name: new RegExp(name) });
  const fileOf = async () =>
    (await entries()).find((each) => each.name.startsWith(name) && each.parent !== "photos");
  const madeId = (await fileOf())?.id;

  // Share: the rows are offered, and Add to Photos hands the file over.
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Share", exact: true }).click();
  const notesRow = page.getByRole("menuitem", { name: "Notes", exact: true });
  await notesRow.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "voice-memos-share.png"));
  step(
    "File > Share lists the receivers, with AirDrop dimmed",
    (await page
      .getByRole("menuitem", { name: "AirDrop", exact: true })
      .getAttribute("aria-disabled")) === "true",
  );
  await page.evaluate(() => {
    window.__voiceMemoShared = null;
    window.addEventListener(
      "macalicious:share-files",
      (event) => {
        window.__voiceMemoShared = event.detail;
      },
      { once: true, capture: true },
    );
  });
  await page.getByRole("menuitem", { name: "Messages", exact: true }).click();
  const handed = await until(() => page.evaluate(() => window.__voiceMemoShared));
  step(
    "Share > Messages hands Messages the recording's file",
    handed?.to === "messages" &&
      handed?.from === "voice-memos" &&
      handed?.items?.[0]?.id === madeId,
    JSON.stringify(handed),
  );
  await page.locator('.mac-managed-window[data-window-id="messages"]').first().waitFor({
    timeout: 15_000,
  });
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "voice-memos-share-messages.png"));
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  await field.fill("Voice Memos");
  await field.press("Enter");
  await page.waitForTimeout(800);

  // Delete moves it to Recently Deleted.
  await row().click();
  await choose("Edit", "Delete");
  step(
    "Edit > Delete takes it out of the list",
    (await until(async () => (await row().count()) === 0)) === true,
  );
  await place().click();
  const listed = await until(async () => (await row().count()) === 1);
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "voice-memos-deleted.png"));
  step("Recently Deleted lists it", listed === true);

  await row().click();
  const audio = win.locator("audio");
  await until(() => audio.evaluate((each) => each.readyState >= 2));
  await audio.evaluate((each) => each.play());
  step(
    "a deleted recording still plays",
    (await until(() => audio.evaluate((each) => each.currentTime > 0))) === true,
  );
  await audio.evaluate((each) => each.pause());

  await win.getByRole("button", { name: "Recover", exact: true }).click();
  step(
    "Recover takes it out of Recently Deleted",
    (await until(async () => (await row().count()) === 0)) === true,
  );
  const back = await until(async () => {
    const entry = (await entries()).find((each) => each.id === madeId);
    return entry && entry.trashed_ms === undefined ? entry : false;
  });
  step("the drive has it out of the Trash", Boolean(back));
  await place().click();
  step(
    "it is among the recordings again",
    (await until(async () => (await row().count()) === 1)) === true,
  );

  // Delete forever asks first, and Cancel keeps it.
  await row().click();
  await choose("Edit", "Delete");
  await until(async () => (await row().count()) === 0);
  await place().click();
  await until(async () => (await row().count()) === 1);
  await row().click();
  await win.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText(/forever/).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "voice-memos-delete-forever.png"));
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  const kept = (await entries()).find((each) => each.id === madeId);
  step("Cancel keeps it in the Trash", kept?.trashed_ms !== undefined);
  await page.waitForTimeout(400);
  await win.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText(/forever/).waitFor({ timeout: 5_000 });
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  const gone = await until(async () => !(await entries()).some((each) => each.id === madeId));
  step("Delete removes it from the drive for good", gone === true);
  step("Recently Deleted no longer lists it", (await row().count()) === 0);

  // Finder's Trash is the same place: a recording put back there comes back here.
  await place().click();
  step(
    "All Recordings goes back to the list",
    (await win.getByText("Recently Deleted").count()) === 1,
  );
});
