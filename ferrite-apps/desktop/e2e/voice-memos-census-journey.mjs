#!/usr/bin/env node
// Voice Memos census journey (round 3, R7): every control of Voice Memos, verified with real input
// against a served `ferrite dev`. Voice Memos is got from the App Store first. The browser's fake
// microphone records; a browser that refuses the microphone is checked for Voice Memos' own honest
// message. Playback is asserted on the real <audio> element (currentTime, paused, readyState).

import {
  api,
  censusRun,
  chooseMenu,
  createAccount,
  editRowsOnField,
  ensureOpen,
  launchBrowser,
  mainWindow,
  menuItemState,
  openApp,
  person,
  shellRows,
  sleep,
  until,
} from "./media-census-kit.mjs";

const app = {
  slug: "voice-memos",
  name: "Voice Memos",
  menus: ["Voice Memos", "File", "Edit", "View", "Window", "Help"],
  editUnavailable:
    "listed here; voice-memos.edit.field, select-all and trim-select-all prove what each row does",
  preferences: {
    text: "Audio Quality",
    locate: (ctx) => ctx.page.locator(".mac-voice-memos-preferences").first(),
    close: (ctx) =>
      ctx.page
        .locator(".mac-voice-memos-preferences")
        .first()
        .getByRole("button", { name: "Close" })
        .first()
        .click(),
  },
  media: "fake",
  crawlIgnore: [/^menu:Apple\|/, /^menu bar\|menuitem\|Apple$/],
};
const W = (ctx) => mainWindow(ctx.page, app);
const audio = (ctx) => W(ctx).locator("audio").first();
const audioState = (ctx) =>
  audio(ctx).evaluate((a) => ({
    t: a.currentTime,
    paused: a.paused,
    ready: a.readyState,
    d: a.duration,
  }));
/** The census' recordings on the drive, apart from those in the Trash (`trashed_ms` set). */
const recordings = async (page) =>
  ((await api(page, "GET", "/api/files/")).json?.entries ?? []).filter(
    (e) => e.trashed_ms == null && /^(New Recording|Census Memo)/.test(e.name ?? ""),
  );
const trashed = async (page) =>
  ((await api(page, "GET", "/api/files/")).json?.entries ?? []).filter((e) => e.trashed_ms != null);
const row = (ctx, name = /^(New Recording|Census Memo)/) =>
  W(ctx).getByRole("option", { name }).first();
/** Every file on the drive that is not in the Trash. */
const recordings2 = async (page) =>
  ((await api(page, "GET", "/api/files/")).json?.entries ?? []).filter((e) => e.trashed_ms == null);
const NEW_NAME = (ctx) => `Census Memo ${ctx.run}`;

const rows = [];
const R = (id, state, role, name, how, expected, check, extra = {}) =>
  rows.push({ id: `voice-memos.${id}`, state, role, name, how, expected, check, ...extra });

R(
  "record.new",
  "Voice Memos",
  "button",
  "New Recording",
  "click New Recording, let it record 3 s, Done",
  "the fake microphone records: the timer advances while recording, Done keeps the recording on the drive and lists it",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    const before = (await recordings(page)).length;
    await W(ctx).getByRole("button", { name: "New Recording" }).click();
    await W(ctx).getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
    const t0 = await W(ctx).getByRole("timer", { name: "Position" }).textContent();
    await sleep(3000);
    const t1 = await W(ctx).getByRole("timer", { name: "Position" }).textContent();
    await W(ctx).getByRole("button", { name: "Done" }).click();
    const kept = await until(async () => (await recordings(page)).length === before + 1, 20_000);
    const listed = await row(ctx)
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    ctx.data.file = (await recordings(page)).at(-1)?.id;
    return {
      ok: t0 !== t1 && kept && listed,
      detail: `timer ${t0} -> ${t1}, kept ${kept}, listed ${listed}`,
    };
  },
  {
    persists: "restart",
    timeout: 90_000,
    restartCheck: async (ctx) => {
      const kept = (await recordings(ctx.page)).some((e) => e.id === ctx.data.file);
      const listed = await row(ctx)
        .waitFor({ timeout: 15_000 })
        .then(
          () => true,
          () => false,
        );
      return { ok: kept && listed, detail: `kept ${kept} listed ${listed}` };
    },
  },
);
R(
  "record.pause",
  "recording",
  "button",
  "Pause Recording",
  "New Recording, Pause Recording, wait 2 s, then resume and Done",
  "while paused the timer stands still; the recording is kept",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    const before = (await recordings(page)).length;
    await W(ctx).getByRole("button", { name: "New Recording" }).click();
    const pause = W(ctx).getByRole("button", { name: "Pause Recording" });
    await pause.waitFor({ timeout: 15_000 });
    await sleep(1500);
    await pause.click();
    const timer = W(ctx).getByRole("timer", { name: "Position" });
    const a = await timer.textContent();
    await sleep(2000);
    const b = await timer.textContent();
    const resume = W(ctx)
      .getByRole("button", { name: /^(Resume|Record|Resume Recording)$/ })
      .first();
    const resumed = await resume.click({ timeout: 5_000 }).then(
      () => true,
      () => false,
    );
    await W(ctx).getByRole("button", { name: "Done" }).click();
    const kept = await until(async () => (await recordings(page)).length === before + 1, 20_000);
    return {
      ok: a === b && kept && resumed,
      detail: `paused timer ${a} = ${b}, resumed ${resumed}, kept ${kept}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "recordings.list",
  "Voice Memos",
  "listbox",
  "Recordings",
  "the list of recordings",
  "lists every recording on the drive outside the Trash, one option each",
  async (ctx) => {
    await ensureOpen(ctx);
    const listed = await W(ctx)
      .getByRole("listbox", { name: "Recordings" })
      .getByRole("option")
      .count();
    const drive = (await recordings(ctx.page)).length;
    return {
      ok: listed > 0 && listed === drive,
      detail: `${listed} listed, ${drive} on the drive`,
    };
  },
);
R(
  "playback.play",
  "Voice Memos",
  "button",
  "Play",
  "select the first recording, click Play",
  "the <audio> element plays: paused false and currentTime moves",
  async (ctx) => {
    await ensureOpen(ctx);
    await row(ctx).click();
    await W(ctx).getByRole("button", { name: "Play", exact: true }).click();
    const ok = await until(async () => {
      const s = await audioState(ctx);
      return !s.paused && s.t > 0.2;
    }, 8_000);
    return { ok, detail: JSON.stringify(await audioState(ctx)) };
  },
);
R(
  "playback.pause",
  "Voice Memos",
  "button",
  "Pause",
  "while playing, click Pause",
  "the <audio> element pauses and currentTime stands still",
  async (ctx) => {
    const pause = W(ctx).getByRole("button", { name: "Pause", exact: true });
    if (await pause.isVisible().catch(() => false)) await pause.click();
    const s1 = await audioState(ctx);
    await sleep(800);
    const s2 = await audioState(ctx);
    return {
      ok: s1.paused && s2.paused && Math.abs(s2.t - s1.t) < 0.05,
      detail: `${s1.t} -> ${s2.t}`,
    };
  },
);
R(
  "playback.position",
  "Voice Memos",
  "slider",
  "Recording position",
  "focus Recording position, press End then Home",
  "the slider moves the <audio> element to the end and back to the start",
  async (ctx) => {
    await ensureOpen(ctx);
    await row(ctx).click();
    const s = W(ctx).getByRole("slider", { name: "Recording position" });
    await s.focus();
    await ctx.page.keyboard.press("End");
    const end = await until(async () => {
      const a = await audioState(ctx);
      return a.t > a.d - 0.6;
    }, 3_000);
    await ctx.page.keyboard.press("Home");
    const start = await until(async () => (await audioState(ctx)).t < 0.3, 3_000);
    return { ok: end && start, detail: JSON.stringify(await audioState(ctx)) };
  },
);
for (const [slug, name, sign] of [
  ["skip-forward", "Skip Forward 15 Seconds", 1],
  ["skip-back", "Skip Back 15 Seconds", -1],
]) {
  R(
    `playback.${slug}`,
    "Voice Memos",
    "button",
    name,
    `put the position mid-way, click ${name}`,
    `the <audio> element moves ${sign > 0 ? "on 15 s (to its end for a short memo)" : "back 15 s (to its start for a short memo)"}`,
    async (ctx) => {
      await ensureOpen(ctx);
      await row(ctx).click();
      const s = W(ctx).getByRole("slider", { name: "Recording position" });
      await s.focus();
      await ctx.page.keyboard.press("Home");
      await ctx.page.keyboard.press("ArrowRight");
      const before = await audioState(ctx);
      await W(ctx).getByRole("button", { name, exact: true }).click();
      const want = Math.min(before.d, Math.max(0, before.t + 15 * sign));
      const ok = await until(async () => Math.abs((await audioState(ctx)).t - want) < 0.6, 3_000);
      return {
        ok,
        detail: `${before.t.toFixed(2)} -> ${(await audioState(ctx)).t.toFixed(2)} (want ${want.toFixed(2)}, duration ${before.d.toFixed(2)})`,
      };
    },
  );
}
R(
  "recording.rename",
  "Voice Memos",
  "button",
  "Rename",
  "select the recording, Rename, type a name in the sheet, Rename",
  "the list and the drive both keep the new name",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await row(ctx).click();
    await W(ctx).getByRole("button", { name: "Rename", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Rename Recording" });
    await sheet.getByRole("textbox", { name: "Recording name" }).fill(NEW_NAME(ctx));
    await sheet.getByRole("button", { name: "Rename", exact: true }).click();
    const listed = await row(ctx, new RegExp(`^${NEW_NAME(ctx)}`))
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    const kept = await until(
      async () => (await recordings(page)).some((e) => e.name.startsWith(NEW_NAME(ctx))),
      10_000,
    );
    ctx.data.renamedTo = NEW_NAME(ctx);
    return { ok: listed && kept, detail: `listed ${listed}, drive ${kept}` };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => {
      const name = ctx.data.renamedTo;
      if (!name) return { ok: false, detail: "No saved rename from the write phase" };
      const file = (await recordings(ctx.page)).find(
        (e) => e.name.replace(/\.[^./]+$/, "") === name,
      );
      return { ok: Boolean(file), detail: file ? `${file.name} (${file.id})` : `Missing ${name}` };
    },
  },
);
/** The batch rows' pictures, beside the census' own: `--out`. */
const shot = async (ctx, name) => {
  const at = process.argv.indexOf("--out");
  if (at >= 0) await W(ctx).screenshot({ path: `${process.argv[at + 1]}/voice-memos-${name}.png` });
};
const cssScale = (ctx) =>
  W(ctx)
    .locator(".mac-waveform-view-detail")
    .evaluate((detail) => Number(detail.style.getPropertyValue("--_s")));

R(
  "batch.title",
  "Voice Memos",
  "option",
  "New Recording",
  "record a take, read its file's name",
  "the take is called New Recording, or New Recording and the next number",
  async (ctx) => {
    const names = (await recordings(ctx.page)).map((entry) => entry.name);
    return {
      ok: names.some((name) => /^New Recording( \d+)?\.[a-z0-9]+$/.test(name)),
      detail: names.join(", "),
    };
  },
);
R(
  "batch.zoom",
  "Voice Memos",
  "img",
  "Waveform",
  "Control and the wheel over the waveform, as a trackpad's pinch reaches a browser",
  "the waveform's scale grows, and the page does not zoom",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await row(ctx).click();
    const box = await W(ctx).locator(".mac-waveform-view-detail").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const before = await cssScale(ctx);
    const dpr = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -60);
    await page.keyboard.up("Control");
    await sleep(200);
    const after = await cssScale(ctx);
    await shot(ctx, "zoom");
    const still = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    return {
      ok: before === 77 && after > 77 && dpr === still,
      detail: `scale ${before} -> ${after}, page zoom ${dpr} -> ${still}`,
    };
  },
);
R(
  "batch.now-playing",
  "Voice Memos",
  "button",
  "Play",
  "play a recording, read the browser's Media Session",
  "the session names the recording and says it plays",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await row(ctx).click();
    const listed = await row(ctx).textContent();
    await W(ctx).getByRole("button", { name: "Play", exact: true }).click();
    const read = () =>
      page.evaluate(() => ({
        title: navigator.mediaSession.metadata?.title,
        artist: navigator.mediaSession.metadata?.artist,
        state: navigator.mediaSession.playbackState,
      }));
    await sleep(300);
    const during = await read();
    await W(ctx)
      .getByRole("button", { name: "Pause", exact: true })
      .click()
      .catch(() => {});
    return {
      ok:
        Boolean(during.title) &&
        listed?.startsWith(during.title) &&
        during.artist === "Voice Memos" &&
        during.state === "playing",
      detail: `${JSON.stringify(during)}, row ${listed}`,
    };
  },
);
R(
  "batch.place",
  "Voice Memos",
  "slider",
  "Recording position",
  "move the playhead a second, click Edit, reload the page",
  "the same recording opens with the playhead where it was and the list hidden",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await row(ctx).click();
    await W(ctx).getByRole("button", { name: "Edit", exact: true }).click();
    const slider = W(ctx).getByRole("slider", { name: "Recording position" });
    await slider.focus();
    for (let press = 0; press < 4; press++) await page.keyboard.press("ArrowRight");
    await sleep(300);
    const before = await W(ctx).getByRole("timer", { name: "Position" }).textContent();
    // The settings session sends what changed after a moment.
    await sleep(2500);
    await page.reload();
    await ensureOpen(ctx);
    const timer = W(ctx).getByRole("timer", { name: "Position" });
    const back = await until(async () => (await timer.textContent()) === before, 20_000);
    const after = await timer.textContent();
    const hidden = (await W(ctx).getByRole("listbox", { name: "Recordings" }).count()) === 0;
    await shot(ctx, "place");
    await W(ctx).getByRole("button", { name: "Done", exact: true }).click();
    // The list shown again is the place the rows after this one reload into.
    await sleep(2500);
    return { ok: back && hidden, detail: `timer ${before} -> ${after}, list hidden ${hidden}` };
  },
  { timeout: 90_000 },
);
R(
  "batch.decoded",
  "Voice Memos",
  "option",
  "New Recording",
  "read this browser's IndexedDB after the recording has been decoded",
  "the recording's length and waveform are kept under its file's id, and a reload shows the length",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    const kept = () =>
      page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const open = indexedDB.open("macalicious-voice-memos-decoded", 1);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const store = open.result.transaction("decoded").objectStore("decoded");
              const all = store.getAll();
              const keys = store.getAllKeys();
              keys.onsuccess = () => {
                open.result.close();
                resolve(
                  all.result.map((value, at) => ({
                    file: keys.result[at][1],
                    duration: value.duration,
                    peaks: value.peaks.length,
                  })),
                );
              };
            };
          }),
      );
    let found = [];
    await until(async () => {
      found = await kept();
      return found.length > 0;
    }, 15_000);
    await page.reload();
    await ensureOpen(ctx);
    let shown = "";
    await until(async () => {
      shown = (await row(ctx).textContent({ timeout: 15_000 })) ?? "";
      return /\d:\d\d/.test(shown);
    }, 15_000);
    const files = (await recordings(page)).map((entry) => entry.id);
    return {
      ok:
        found.some((each) => files.includes(each.file) && each.duration > 0 && each.peaks > 0) &&
        /\d:\d\d/.test(shown),
      detail: `${JSON.stringify(found)}; row ${shown}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "batch.drag-desktop",
  "Voice Memos",
  "option",
  "New Recording",
  "press a row and drag it out of the window onto the desktop",
  "the desktop gets a copy: the file stays in Music/Voice Memos, and a second of that name is on the drive",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    const target = row(ctx);
    const name = (await recordings(page)).at(-1)?.name;
    const from = await target.boundingBox();
    const window = await W(ctx).boundingBox();
    const view = page.viewportSize();
    const to =
      view.width - window.x - window.width > 40
        ? { x: window.x + window.width + 20, y: window.y + 100 }
        : {
            x: Math.max(window.x - 20, 5),
            y: Math.min(window.y + window.height + 20, view.height - 90),
          };
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 4, { steps: 3 });
    const image = await page.locator(".mac-desktop-drag").textContent({ timeout: 3000 });
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    const copied = await until(async () => {
      const all = ((await api(page, "GET", "/api/files/")).json?.entries ?? []).filter(
        (entry) => entry.trashed_ms == null && entry.name === name,
      );
      return all.length === 2;
    }, 15_000);
    return {
      ok: image === name && copied,
      detail: `drag image ${image}, ${name} on the drive twice ${copied}`,
    };
  },
  { timeout: 60_000 },
);
R(
  "batch.inline-rename",
  "Voice Memos",
  "textbox",
  "Recording name",
  "double-click a row, type a name, Return",
  "the title is a field in the row, no sheet opens, and the list and the drive keep the name",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await row(ctx).dblclick();
    const field = W(ctx).getByRole("textbox", { name: "Recording name" });
    await field.waitFor({ timeout: 5000 });
    const sheets = await page.getByRole("dialog", { name: "Rename Recording" }).count();
    const focused = await field.evaluate((input) => document.activeElement === input);
    const width = (await field.boundingBox())?.width ?? 0;
    await shot(ctx, "inline-rename");
    const name = `Census Inline ${ctx.run}`;
    await field.fill(name);
    await page.keyboard.press("Enter");
    const kept = await until(
      async () => (await recordings2(page)).some((e) => e.name.startsWith(name)),
      10_000,
    );
    return {
      ok: sheets === 0 && focused && width > 100 && kept,
      detail: `sheets ${sheets}, focused ${focused}, field ${width} wide, drive ${kept}`,
    };
  },
);
R(
  "sheet.recording-name",
  "Rename Recording sheet",
  "textbox",
  "Recording name",
  "type into the sheet's field",
  "the recording takes the typed name (checked with Rename)",
  async (ctx) => ({
    ok: (await recordings(ctx.page)).some((e) => e.name.startsWith(NEW_NAME(ctx))),
  }),
);
R(
  "recording.option",
  "Voice Memos",
  "option",
  "/(New Recording|Census Memo [a-z0-9]+).*/",
  "click each recording of the list",
  "the clicked recording is selected and its length shows",
  async (ctx) => {
    await ensureOpen(ctx);
    const all = W(ctx).getByRole("option");
    const n = await all.count();
    const out = [];
    for (const at of [...new Set([0, n - 1])]) {
      await all.nth(at).click();
      out.push((await all.nth(at).getAttribute("aria-selected")) === "true");
    }
    return { ok: n >= 1 && out.every(Boolean), detail: `${n} recordings, ${out}` };
  },
  { notes: "kind: a recording of the list" },
);
R(
  "edit.trim",
  "Voice Memos (Edit)",
  "button",
  "Trim",
  "select the renamed recording, Edit, Trim, move Trim start on (Page Up), Save, Done",
  "the recording is shortened: the <audio> element's duration falls",
  async (ctx) => {
    await ensureOpen(ctx);
    await row(ctx, new RegExp(`^Census Inline ${ctx.run}`)).click();
    await sleep(800);
    const d0 = (await audioState(ctx)).d;
    await W(ctx).getByRole("button", { name: "Edit", exact: true }).click();
    const trim = W(ctx).getByRole("button", { name: "Trim", exact: true });
    const editShown = await trim.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    );
    await trim.click();
    const start = W(ctx).getByRole("slider", { name: "Trim start" });
    const v0 = await start.getAttribute("aria-valuenow");
    await start.focus();
    await ctx.page.keyboard.press("PageUp");
    const v1 = await start.getAttribute("aria-valuenow");
    await W(ctx).getByRole("button", { name: "Save", exact: true }).click();
    await W(ctx)
      .getByRole("button", { name: "Done", exact: true })
      .click()
      .catch(() => {});
    const shorter = await until(async () => {
      const d = (await audioState(ctx)).d;
      return Number.isFinite(d) && d < d0 - 0.2;
    }, 15_000);
    // Each control of the edit is a census row of its own; each reads what this step saw of it.
    ctx.data.trim = { editShown, v0, v1, startMoved: v0 !== null && v0 !== v1, saved: shorter };
    return {
      ok: editShown && v0 !== v1 && shorter,
      detail: `${d0} -> ${(await audioState(ctx)).d}; Trim start ${v0} -> ${v1}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "edit.button",
  "Voice Memos",
  "button",
  "Edit",
  "select a recording, Edit",
  "the edit view shows Trim (seen during voice-memos.edit.trim)",
  async (ctx) => ({
    ok: ctx.data.trim?.editShown === true,
    detail: JSON.stringify(ctx.data.trim ?? null),
  }),
);
R(
  "edit.trim-start",
  "Voice Memos (Edit)",
  "slider",
  "Trim start",
  "Page Up on Trim start",
  "the trim's start moves on: its value changes (seen during voice-memos.edit.trim)",
  async (ctx) => ({
    ok: ctx.data.trim?.startMoved === true,
    detail: `${ctx.data.trim?.v0} -> ${ctx.data.trim?.v1}`,
  }),
);
R(
  "edit.save",
  "Voice Memos (Edit)",
  "button",
  "Save",
  "Save after trimming",
  "the trimmed recording is kept: the <audio> element's duration falls (seen during voice-memos.edit.trim)",
  async (ctx) => ({
    ok: ctx.data.trim?.saved === true,
    detail: JSON.stringify(ctx.data.trim ?? null),
  }),
);
R(
  "edit.done",
  "Voice Memos (Edit) / recording",
  "button",
  "Done",
  "select a recording, Edit, then Done (Done while recording is checked by voice-memos.record.new)",
  "Done leaves the edit view (Trim goes); while recording, Done kept the recording on the drive",
  async (ctx) => {
    await ensureOpen(ctx);
    await row(ctx).click();
    await W(ctx).getByRole("button", { name: "Edit", exact: true }).click();
    const trim = W(ctx).getByRole("button", { name: "Trim", exact: true });
    await trim.waitFor({ timeout: 5_000 });
    await W(ctx).getByRole("button", { name: "Done", exact: true }).click();
    const left = await until(async () => !(await trim.isVisible()), 5_000);
    return {
      ok: left && !!ctx.data.file,
      detail: `edit view left ${left}; recording's Done kept ${ctx.data.file ?? "nothing"}`,
    };
  },
);
R(
  "edit.select-all",
  "Voice Memos",
  "menuitem",
  "Select All",
  "click a recording, so that no field has the keyboard, then Edit > Select All; click one row to end",
  "every recording of the list is chosen; Cut, Copy and Paste are dimmed, each saying why",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await row(ctx).click();
    const reasons = [];
    for (const name of ["Cut", "Copy", "Paste"]) {
      const state = await menuItemState(page, "Edit", name);
      reasons.push(state.disabled && /search field/.test(state.title ?? ""));
    }
    await chooseMenu(page, "Edit", "Select All");
    const options = W(ctx).getByRole("listbox", { name: "Recordings" }).getByRole("option");
    const count = await options.count();
    const all = await until(
      async () =>
        (
          await options.evaluateAll((list) =>
            list.filter((each) => each.getAttribute("aria-selected") === "true"),
          )
        ).length === count,
      5_000,
    );
    await row(ctx).click();
    return {
      ok: count >= 2 && all && reasons.every(Boolean),
      detail: `${count} recordings, all chosen ${all}, dimmed with reasons ${reasons}`,
    };
  },
);
R(
  "edit.field",
  "Voice Memos",
  "menuitem",
  "Undo, Redo, Cut, Copy, Paste, Select All",
  "type in Search recordings, then each of Select All, Cut, Paste, Select All, Copy, Paste, Undo, Redo from the Edit menu",
  "each acts on the search field's text, read back from the field",
  async (ctx) => {
    await ensureOpen(ctx);
    return editRowsOnField(
      ctx.page,
      W(ctx).getByRole("searchbox", { name: "Search recordings" }),
      W(ctx).getByRole("alert").filter({ hasText: "Command-V" }),
    );
  },
);
R(
  "edit.trim-select-all",
  "Voice Memos (Edit)",
  "menuitem",
  "Select All",
  "Edit, Trim, Page Up on Trim start, Edit > Select All, then Cancel and Done",
  "the handles go back to the two ends of the recording; Cut is dimmed, saying a browser takes no sound onto the clipboard",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await row(ctx).click();
    await W(ctx).getByRole("button", { name: "Edit", exact: true }).click();
    await W(ctx).getByRole("button", { name: "Trim", exact: true }).click();
    const start = W(ctx).getByRole("slider", { name: "Trim start" });
    await start.focus();
    await page.keyboard.press("PageUp");
    const moved = await start.getAttribute("aria-valuenow");
    const cut = await menuItemState(page, "Edit", "Cut");
    await chooseMenu(page, "Edit", "Select All");
    const whole = await until(
      async () => Number(await start.getAttribute("aria-valuenow")) === 0,
      5_000,
    );
    await W(ctx).getByRole("button", { name: "Cancel", exact: true }).click();
    await W(ctx).getByRole("button", { name: "Done", exact: true }).click();
    return {
      ok: Number(moved) > 0 && whole && cut.disabled && /clipboard/.test(cut.title ?? ""),
      detail: `start ${moved} -> whole ${whole}; Cut ${JSON.stringify(cut)}`,
    };
  },
);
R(
  "search",
  "Voice Memos",
  "searchbox",
  "Search recordings",
  "type the renamed recording's name, then a word no recording has",
  "the list narrows to the match, then shows none",
  async (ctx) => {
    await ensureOpen(ctx);
    const field = W(ctx).getByRole("searchbox", { name: "Search recordings" });
    await field.fill("Census");
    const one = await until(
      async () =>
        (await W(ctx).getByRole("option").count()) >= 1 &&
        (await W(ctx)
          .getByRole("option", { name: /^New Recording/ })
          .count()) === 0,
      5_000,
    );
    await field.fill(`zz${ctx.run}`);
    const none = await until(async () => (await W(ctx).getByRole("option").count()) === 0, 5_000);
    await field.fill("");
    return { ok: one && none, detail: `match ${one}, none ${none}` };
  },
);
R(
  "recording.delete",
  "Voice Memos",
  "button",
  "Delete",
  "select a New Recording, Delete",
  "it leaves the list and goes to the drive's Trash (recoverable there, as in the Finder)",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    const before = await recordings(page);
    const victim = W(ctx)
      .getByRole("option", { name: /^New Recording/ })
      .first();
    await victim.click();
    await W(ctx).getByRole("button", { name: "Delete", exact: true }).click();
    const gone = await until(
      async () => (await recordings(page)).length === before.length - 1,
      10_000,
    );
    const left = before.filter((e) => !(ctx.data.after ?? []).includes(e.id));
    const now = (await recordings(page)).map((e) => e.id);
    const moved = before.find((e) => !now.includes(e.id));
    const inTrash = !!moved && (await trashed(page)).some((e) => e.id === moved.id);
    return {
      ok: gone && inTrash,
      detail: `${before.length} -> ${now.length} listed; ${moved?.name ?? "none"} in the Trash ${inTrash} (${left.length} before)`,
    };
  },
);
R(
  "microphone.denied",
  "a browser that refuses the microphone",
  "alert",
  "microphone notice",
  "a new account in a browser whose microphone permission is denied, Voice Memos, New Recording",
  "Voice Memos says in its own words that it may not use the microphone, and records nothing",
  async (ctx) => {
    const { browser, contextOptions } = await launchBrowser(ctx.engine, {
      media: "deny",
      headed: ctx.opts.headed,
    });
    try {
      const page = await (await browser.newContext(contextOptions)).newPage();
      await createAccount(page, ctx.base, person("vmdeny", ctx.run));
      await openApp(page, app.name);
      const w = mainWindow(page, app);
      await w.getByRole("button", { name: "New Recording" }).click();
      const alert = w.getByRole("alert");
      const said = await alert.waitFor({ timeout: 15_000 }).then(
        () => true,
        () => false,
      );
      const text = said ? await alert.innerText() : "";
      const nothing =
        (await w.getByRole("button", { name: "Pause Recording" }).count()) === 0 &&
        (await recordings(page)).length === 0;
      return {
        ok: said && /(Permission denied|not allowed)/i.test(text) && nothing,
        detail: text.slice(0, 160),
      };
    } finally {
      await browser.close();
    }
  },
  { timeout: 120_000 },
);
R(
  "isolation.second-account",
  "another account",
  "account",
  "second account",
  "sign up a second account in a new browser context, open its drive",
  "it has no recording of the first account's",
  async (ctx) => {
    const other = await ctx.newPage();
    try {
      await createAccount(other.page, ctx.base, person("vmother", ctx.run));
      const theirs = await recordings(other.page);
      return { ok: theirs.length === 0, detail: `${theirs.length} recordings` };
    } finally {
      await other.context.close();
    }
  },
);

app.rows = [...shellRows(app), ...rows];
app.open = async (ctx) => {
  await openApp(ctx.page, app.name);
  await W(ctx).waitFor({ state: "visible", timeout: 20_000 });
  return W(ctx);
};
app.states = [
  {
    name: "main",
    enter: async (ctx) => {
      await ensureOpen(ctx);
      await row(ctx)
        .click()
        .catch(() => {});
      return W(ctx);
    },
  },
  {
    name: "recording",
    enter: async (ctx) => {
      await W(ctx).getByRole("button", { name: "New Recording" }).click();
      await sleep(1500);
      return W(ctx);
    },
    leave: async (ctx) => {
      await W(ctx).getByRole("button", { name: "Done" }).click();
      await sleep(1500);
    },
    menus: false,
  },
  {
    name: "edit",
    enter: async (ctx) => {
      await row(ctx).click();
      await W(ctx).getByRole("button", { name: "Edit", exact: true }).click();
      await sleep(500);
      return W(ctx);
    },
    leave: async (ctx) => {
      await W(ctx)
        .getByRole("button", { name: "Done", exact: true })
        .click()
        .catch(() => {});
    },
    menus: false,
  },
];

await censusRun(app);
