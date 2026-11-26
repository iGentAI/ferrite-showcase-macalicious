#!/usr/bin/env node
// Voice Memos' editing rows on the desktop served by `ferrite dev`: the yellow trim handles with Trim and
// Revert, Delete part, Undo and Redo, Replace from the playhead, Resume onto a saved recording, and several
// rows chosen together. Each audio edit is read back by decoding the file the drive stores, after a reload
// where the row asks for it, comparing samples with the file before the edit. The microphone is Chromium's
// fake device. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/voice-memos-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("voice-memos-rows", {
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

const close = (a, b, within = 0.15) => Math.abs(a - b) <= within;

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
  const menuRowDisabled = async (menu, item) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    const row = page.getByRole("menuitem", { name: item, exact: true }).first();
    await row.waitFor({ timeout: 5_000 });
    const disabled =
      (await row.getAttribute("aria-disabled")) === "true" ||
      (await row.getAttribute("data-disabled")) !== null;
    await page.keyboard.press("Escape");
    return disabled;
  };
  const options_ = () => win.getByRole("option");
  const button = (name) => win.getByRole("button", { name, exact: true });
  const positionSlider = win.getByRole("slider", { name: "Recording position" });
  const startSlider = win.getByRole("slider", { name: "Trim start" });
  const endSlider = win.getByRole("slider", { name: "Trim end" });
  const shownLength = async () => Number(await positionSlider.getAttribute("max"));
  const listing = async () => (await api(page, "GET", "/api/files/")).json;
  const entries = async () => (await listing()).entries ?? [];
  const live = async (title) =>
    (await entries()).find(
      (each) =>
        each.kind === "file" && each.trashed_ms === undefined && each.name.startsWith(title),
    );

  /** The samples of a stored file, decoded by the browser, kept on the page under `name`. */
  const decode = async (id, name) => {
    const drive = await listing();
    const size = drive.entries.find((each) => each.id === id)?.size ?? 0;
    return page.evaluate(
      async ({ file, name, pieces }) => {
        const parts = [];
        for (let piece = 0; piece < pieces; piece += 8) {
          const response = await fetch(`/api/files/content/${file}?piece=${piece}&count=8`, {
            credentials: "same-origin",
          });
          parts.push(await response.arrayBuffer());
        }
        const context = new OfflineAudioContext(1, 1, 44_100);
        const buffer = await context.decodeAudioData(await new Blob(parts).arrayBuffer());
        globalThis.__voiceMemosRows ??= {};
        globalThis.__voiceMemosRows[name] = buffer.getChannelData(0);
        return buffer.duration;
      },
      { file: id, name, pieces: Math.max(1, Math.ceil(size / drive.piece_bytes)) },
    );
  };
  /**
   * Whether `[from, to)` seconds of decoded file `a` equal file `b` to 16 bits, and are not silence.
   * `shift` names the two times the app rounded to samples: `b` runs `shift[0] - shift[1]` earlier.
   */
  const sameSound = async (a, b, from, to, shift = [0, 0]) => {
    const found = await page.evaluate(
      ({ a, b, from, to, shift }) => {
        const left = globalThis.__voiceMemosRows[a];
        const right = globalThis.__voiceMemosRows[b];
        const back = Math.round(shift[0] * 44_100) - Math.round(shift[1] * 44_100);
        let loudest = 0;
        for (let i = Math.round(from * 44_100); i < Math.round(to * 44_100); i++) {
          // A WAV file holds full scale at most; a compressed take overshoots it and is clipped.
          const x = left[i] === undefined ? undefined : Math.max(-1, Math.min(1, left[i]));
          const y = right[i - back];
          if (x === undefined || y === undefined || Math.abs(x - y) > 1 / 16_000) {
            return `sample ${i}: ${x} and ${y}`;
          }
          loudest = Math.max(loudest, Math.abs(x));
        }
        return loudest > 0 ? "" : "silence";
      },
      { a, b, from, to, shift },
    );
    if (found) console.log(`note ${a} against ${b}: ${found}`);
    return found === "";
  };
  /** Whether a stretch differs between two decoded files anywhere. */
  const differs = (a, b, from, to) =>
    page.evaluate(
      ({ a, b, from, to }) => {
        const left = globalThis.__voiceMemosRows[a];
        const right = globalThis.__voiceMemosRows[b];
        for (let i = Math.round(from * 44_100); i < Math.round(to * 44_100); i++) {
          if (Math.abs(left[i] - right[i]) > 1 / 1000) return true;
        }
        return false;
      },
      { a, b, from, to },
    );
  /** The red, green and blue of a point of the screen, from a screenshot of it. */
  const pixelAt = async (x, y) => {
    const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
    return page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(1, 1);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    }, png.toString("base64"));
  };
  const box = async (locator) => {
    const found = await locator.boundingBox();
    if (!found) throw new Error("no box");
    return found;
  };

  const record = async (ms) => {
    const before = await options_().count();
    await choose("File", "New Recording");
    await button("Pause Recording").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(ms);
    await button("Done").click();
    await until(async () => (await options_().count()) === before + 1, 20_000);
    await until(async () => !/Saving|Not saved/.test(await options_().first().innerText()), 20_000);
    return (await options_().first().innerText()).split("\n")[0];
  };
  /** Waits for the chosen recording's audio, in the editing view. */
  const audioReady = () =>
    until(() => win.locator("audio").evaluate((each) => each.readyState >= 2), 15_000);

  // A six-second take: long enough to cut into.
  const TITLE = await record(6_000);
  await button("Edit").click();
  await audioReady();
  await until(async () => (await shownLength()) > 5);
  const first = await live(TITLE);
  const firstLength = first ? await decode(first.id, "original") : 0;
  step("a take of about six seconds is on the drive", firstLength > 5, `${firstLength} s`);

  // Trim handles, dragged with the mouse.
  await until(async () => (await button("Trim").getAttribute("aria-disabled")) !== "true");
  await button("Trim").click();
  await startSlider.waitFor({ timeout: 5_000 });
  const strip = await box(win.locator(".mac-waveform-view-strip"));
  const startHandle = await box(startSlider);
  const endHandle = await box(endSlider);
  const stretch = (strip.width * firstLength) / Math.max(firstLength, 20);
  step(
    "the handles stand at either end of the recording on the overview",
    close(startHandle.x + startHandle.width, strip.x, 1.5) &&
      close(endHandle.x, strip.x + stretch, 1.5),
    JSON.stringify({ strip, startHandle, endHandle }),
  );
  const yellow = await pixelAt(
    Math.round(startHandle.x + 2),
    Math.round(startHandle.y + startHandle.height / 4),
  );
  step(
    "the handle is painted yellow",
    yellow[0] > 220 && yellow[1] > 180 && yellow[2] < 80,
    yellow.join(","),
  );
  const drag = async (handle, seconds) => {
    const now = await box(handle);
    const y = now.y + now.height / 2;
    await page.mouse.move(now.x + now.width / 2, y);
    await page.mouse.down();
    const x = strip.x + (stretch * seconds) / firstLength;
    await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.up();
  };
  await drag(startSlider, 1);
  await drag(endSlider, 4);
  const startAt = Number(await startSlider.getAttribute("aria-valuenow"));
  const endAt = Number(await endSlider.getAttribute("aria-valuenow"));
  step(
    "dragging the handles moves them to one second and four",
    close(startAt, 1, 0.2) && close(endAt, 4, 0.2),
    `${startAt} to ${endAt}`,
  );
  const dim = await pixelAt(Math.round(strip.x + stretch * 0.08), Math.round(strip.y + 4));
  const kept = await pixelAt(
    Math.round(strip.x + stretch * 0.4),
    Math.round(strip.y + strip.height - 1),
  );
  step(
    "the stretch between is edged in yellow and the rest is dimmed",
    kept[0] > 220 && kept[1] > 180 && kept[2] < 80 && dim[0] < 60 && dim[1] < 60,
    `edge ${kept.join(",")}, outside ${dim.join(",")}`,
  );
  await shot(page, path.join(out, "voice-memos-rows-handles.png"));

  await win.getByRole("button", { name: "Trim to Selection" }).click();
  const trimmed = await until(async () => close(await shownLength(), endAt - startAt));
  step(
    "Trim keeps only that stretch, in the window, before any save",
    trimmed === true && (await live(TITLE))?.id === first.id,
    `${await shownLength()} s, file ${first.name}`,
  );
  await until(() =>
    win
      .locator("audio")
      .evaluate((each, length) => Math.abs(each.duration - length) < 0.1, endAt - startAt),
  );
  const trimmedAudio = await win.locator("audio").evaluate((each) => each.duration);
  step(
    "the audio element plays the trimmed sound",
    close(trimmedAudio, endAt - startAt),
    `${trimmedAudio} s`,
  );

  await button("Revert").click();
  const reverted = await until(async () => close(await shownLength(), firstLength));
  step("Revert brings the whole recording back", reverted === true, `${await shownLength()} s`);
  await page.keyboard.press("Meta+Shift+z");
  const redone = await until(async () => close(await shownLength(), endAt - startAt));
  step("Shift-Command-Z redoes the trim after Revert", redone === true);
  const nothingToRedo = await menuRowDisabled("Edit", "Redo");
  await page.keyboard.press("Meta+z");
  const undone = await until(async () => close(await shownLength(), firstLength));
  step(
    "Command-Z undoes it, and Redo was dimmed with nothing left to redo",
    undone === true && nothingToRedo === true,
  );
  await choose("Edit", "Redo");
  const menuRedo = await until(async () => close(await shownLength(), endAt - startAt));
  await choose("Edit", "Undo");
  const menuUndo = await until(async () => close(await shownLength(), firstLength));
  step("Edit's Redo and Undo do the same", menuRedo === true && menuUndo === true);
  await shot(page, path.join(out, "voice-memos-rows-undo.png"));

  await page.keyboard.press("Meta+Shift+z");
  const again = await until(async () => close(await shownLength(), endAt - startAt));
  step("Shift-Command-Z redoes it straight after the menu", again === true);
  await until(async () => (await button("Save").isEnabled()) === true);
  await button("Save").click();
  const afterTrim = await until(async () => {
    const now = await live(TITLE);
    return now && now.id !== first.id && now.name.endsWith(".wav") ? now : false;
  }, 20_000);
  await reloadDesktop(page);
  await launch();
  const trimmedLength = afterTrim ? await decode(afterTrim.id, "trimmed") : 0;
  await decode(first.id, "original");
  step(
    "Save writes a WAV file of that length, read back after a reload",
    close(trimmedLength, endAt - startAt),
    `${trimmedLength} s, ${afterTrim?.name}`,
  );
  step(
    "the file's sound is the stretch between the handles, sample by sample",
    await sameSound("original", "trimmed", startAt + 0.01, endAt - 0.01, [startAt, 0]),
  );
  const inTrash = (await entries()).find((each) => each.id === first.id);
  step("the old file is in the Trash", typeof inTrash?.trashed_ms === "number");

  // Delete part: the middle second goes, the sound around it joins up.
  const openRow = async () => {
    await win.getByRole("option").first().click();
    await button("Edit").click();
    await audioReady();
    await until(async () => (await shownLength()) > 0.5);
  };
  await openRow();
  await until(async () => (await button("Trim").getAttribute("aria-disabled")) !== "true");
  await button("Trim").click();
  await startSlider.focus();
  await page.keyboard.press("PageUp");
  await endSlider.focus();
  await page.keyboard.press("PageDown");
  const cutFrom = Number(await startSlider.getAttribute("aria-valuenow"));
  const cutTo = Number(await endSlider.getAttribute("aria-valuenow"));
  await win.getByRole("button", { name: "Delete Selection" }).click();
  const shrunk = await until(async () =>
    close(await shownLength(), trimmedLength - (cutTo - cutFrom)),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "voice-memos-rows-delete-part.png"));
  step(
    "Delete in the trim removes the stretch between the handles from the window",
    shrunk === true,
    `${cutFrom} to ${cutTo}, ${await shownLength()} s left`,
  );
  await until(async () => (await button("Save").isEnabled()) === true);
  await button("Save").click();
  const afterDelete = await until(async () => {
    const now = await live(TITLE);
    return now && now.id !== afterTrim.id ? now : false;
  }, 20_000);
  await reloadDesktop(page);
  await launch();
  const deletedLength = afterDelete ? await decode(afterDelete.id, "deleted") : 0;
  await decode(afterTrim.id, "trimmed");
  step(
    "Save writes the shorter file, read back after a reload",
    close(deletedLength, trimmedLength - (cutTo - cutFrom)),
    `${deletedLength} s`,
  );
  step(
    "its sound is what stood before the stretch and after it, sample by sample",
    (await sameSound("trimmed", "deleted", 0, cutFrom - 0.01)) &&
      (await sameSound("trimmed", "deleted", cutTo + 0.01, trimmedLength - 0.01, [cutTo, cutFrom])),
  );

  // Replace from the playhead: a take goes over what is there, and the rest stays.
  await openRow();
  const beforeReplace = deletedLength;
  await positionSlider.focus();
  await page.keyboard.press("ArrowRight");
  const replacePill = win.getByRole("button", { name: "Replace Recording", exact: true });
  await replacePill.waitFor({ timeout: 5_000 });
  const at = Number(await positionSlider.inputValue());
  step(
    "away from the end, the pill says Replace",
    at > 0.1 && at < 0.5 && (await replacePill.innerText()) === "Replace",
    `playhead ${at}`,
  );
  await until(async () => replacePill.isEnabled());
  await replacePill.click();
  await button("Pause Recording").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await shot(page, path.join(out, "voice-memos-rows-replace.png"));
  const during = await win.locator(".mac-title-bar-title-text").first().innerText();
  step("the window keeps the recording's title during the take", during === TITLE, during);
  await button("Done").click();
  const afterReplace = await until(async () => {
    const now = await live(TITLE);
    return now && now.id !== afterDelete.id ? now : false;
  }, 20_000);
  if (!afterReplace) {
    console.log(`note the window says: ${(await win.innerText()).replace(/\s+/g, " ")}`);
    console.log(`note the drive has: ${(await entries()).map((each) => each.name).join(", ")}`);
    await shot(page, path.join(out, "voice-memos-rows-replace-failed.png"));
  }
  await reloadDesktop(page);
  await launch();
  const replacedLength = afterReplace ? await decode(afterReplace.id, "replaced") : 0;
  await decode(afterDelete.id, "deleted");
  step(
    "Replace saves one file of about the same length, read back after a reload",
    close(replacedLength, Math.max(beforeReplace, at + 0.8), 0.6),
    `${beforeReplace} s to ${replacedLength} s`,
  );
  step(
    "before the playhead it holds the same samples",
    await sameSound("deleted", "replaced", 0, at - 0.02),
  );
  step(
    "from the playhead on it holds the new sound",
    await differs("deleted", "replaced", at, Math.min(replacedLength, beforeReplace)),
  );

  // Resume: at the end the pill says Resume, and the recording grows.
  await openRow();
  await positionSlider.focus();
  await page.keyboard.press("End");
  const resumePill = win.getByRole("button", { name: "Resume Recording", exact: true });
  await resumePill.waitFor({ timeout: 5_000 });
  step("at the end, the pill says Resume", (await resumePill.innerText()) === "Resume");
  await shot(page, path.join(out, "voice-memos-rows-resume.png"));
  await until(async () => resumePill.isEnabled());
  await resumePill.click();
  await button("Pause Recording").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2_000);
  await button("Done").click();
  const afterResume = await until(async () => {
    const now = await live(TITLE);
    return now && now.id !== afterReplace.id ? now : false;
  }, 20_000);
  await reloadDesktop(page);
  await launch();
  const resumedLength = afterResume ? await decode(afterResume.id, "resumed") : 0;
  await decode(afterReplace.id, "replaced");
  step(
    "Resume adds about two seconds to the saved file, read back after a reload",
    close(resumedLength, replacedLength + 2, 0.6),
    `${replacedLength} s to ${resumedLength} s`,
  );
  step(
    "the sound before it is the same, sample by sample",
    await sameSound("replaced", "resumed", 0, replacedLength - 0.02),
  );
  const onlyOne = (await entries()).filter(
    (each) => each.kind === "file" && each.trashed_ms === undefined && each.name.startsWith(TITLE),
  );
  step("there is still one file of that title on the drive", onlyOne.length === 1);

  // Several rows together.
  const second = await record(1_200);
  const third = await record(1_200);
  const row = (title) => options_().filter({ hasText: new RegExp(`^\\s*${title}(?! copy)`) });
  const chosen = () => win.getByRole("option", { selected: true });
  await row(third).click();
  await row(TITLE).click({ modifiers: ["Meta"] });
  const both = await until(
    async () =>
      (await row(third).getAttribute("aria-selected")) === "true" &&
      (await row(TITLE).getAttribute("aria-selected")) === "true" &&
      (await row(second).getAttribute("aria-selected")) === "false",
  );
  step("Command-click adds a row to the selection", both === true);
  step("Rename is dimmed for two rows", (await menuRowDisabled("Edit", "Rename")) === true);
  await row(third).click();
  await row(second).click({ modifiers: ["Shift"] });
  const twoInRange = await until(
    async () =>
      (await row(third).getAttribute("aria-selected")) === "true" &&
      (await row(second).getAttribute("aria-selected")) === "true" &&
      (await row(TITLE).getAttribute("aria-selected")) === "false",
  );
  step("Shift-click takes the rows between", twoInRange === true);
  await shot(page, path.join(out, "voice-memos-rows-multi.png"));
  await until(async () => !(await win.getAttribute("aria-busy")));
  await choose("File", "Duplicate");
  const copied = await until(async () => (await options_().count()) === 5, 20_000);
  const copies = (await entries()).filter(
    (each) => each.trashed_ms === undefined && each.name.includes(" copy."),
  );
  step("Duplicate copies both, on the drive", copied === true && copies.length === 2);
  const secondFile = await live(second);
  const thirdFile = await live(third);
  const pickBoth = async () => {
    await row(third).click();
    await row(second).click({ modifiers: ["Meta"] });
    return until(async () => (await chosen().count()) === 2);
  };
  await pickBoth();
  await choose("Edit", "Delete");
  const moved = await until(async () => {
    const now = await entries();
    return [thirdFile, secondFile].every(
      (file) => typeof now.find((each) => each.id === file?.id)?.trashed_ms === "number",
    );
  });
  step("Delete moves both to the drive's Trash", moved === true);
  await win.getByRole("button", { name: "Recently Deleted" }).click();
  await row(third).waitFor({ timeout: 10_000 });
  await pickBoth();
  await button("Recover").click();
  const back = await until(async () => {
    const now = await entries();
    return [thirdFile, secondFile].every((file) => {
      const entry = now.find((each) => each.id === file?.id);
      return entry && entry.trashed_ms === undefined;
    });
  });
  step("Recover puts both back", back === true);
});
