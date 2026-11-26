#!/usr/bin/env node
// Music's census journey (round 3, R7): one ok/FAIL line per census id, real input only, against
// a served `ferrite dev`, in the engine --browser names (chromium, chrome, firefox, webkit). Built
// on media-census-kit.mjs; see its header for the options (--phase write|restart-check, --crawl,
// --explore-minutes, --list).
//
// Songs are WAV files made here and chosen in the file chooser of Add Songs…. Playback is asserted
// on the real media element (Music plays a detached Audio object, registered by the kit when it
// plays): currentTime advancing, paused, readyState, volume. The Internet Archive is an outside
// host: a failure there passes only as an honest message on screen together with a curl to
// archive.org in the same minute that fails too (recorded in the row's detail).

import { execSync } from "node:child_process";
import {
  api,
  censusRun,
  chooseMenu,
  closeMenus,
  createAccount,
  ensureOpen,
  mainWindow,
  newestWindow,
  openApp,
  person,
  playingMedia,
  shellRows,
  sleep,
  until,
} from "./media-census-kit.mjs";

const W = (ctx) => mainWindow(ctx.page, app);
const LIB = "/api/music/library";
const PLAYBACK = "/api/music/playback";
const PREFS = "/api/music/preferences";
const getJson = async (ctx, url) => (await api(ctx.page, "GET", url)).json;
const text = async (ctx, url) => JSON.stringify(await getJson(ctx, url));
const ctl = (ctx, name) => W(ctx).getByRole("button", { name, exact: true }).first();
const side = (ctx, name) => W(ctx).getByRole("treeitem", { name, exact: true }).first();
const titles = (ctx) => ctx.data.songs ?? [];
/** A song of the library list, whatever role the list gives it. */
const song = (ctx, title) => {
  const name = new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return W(ctx)
    .getByRole("row", { name })
    .or(W(ctx).getByRole("option", { name }))
    .or(W(ctx).getByRole("gridcell", { name }))
    .first();
};
/** Play a song by double-clicking it in Songs (the view chosen first: a reload opens Music elsewhere). */
const playSong = async (ctx, title) => {
  await side(ctx, "Songs").click();
  await song(ctx, title).dblclick();
};
const saved = (page, path, timeout = 10_000) => {
  const reply = page.waitForResponse(
    (r) => ["PUT", "POST"].includes(r.request().method()) && new URL(r.url()).pathname === path,
    { timeout },
  );
  reply.catch(() => {});
  return reply;
};

/** A mono 16-bit PCM WAV of a sine tone. */
function wav(seconds, freq, rate = 8000) {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8, "latin1");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "latin1");
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1)
    b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000), 44 + i * 2);
  return b;
}

/** Whether the media element plays: not paused, data enough, and its time advancing. */
async function advancing(ctx, ms = 10_000) {
  let first = null;
  return until(async () => {
    const m = await playingMedia(ctx.page);
    if (!m || m.paused || m.readyState < 2) return false;
    if (first === null) {
      first = m.currentTime;
      return false;
    }
    return m.currentTime > first + 0.2;
  }, ms);
}
const mediaLine = async (ctx) => {
  const m = await playingMedia(ctx.page);
  return m
    ? `t=${m.currentTime.toFixed(2)} paused=${m.paused} ready=${m.readyState} vol=${m.volume.toFixed(2)} err=${m.error}`
    : "no media element";
};
/** Pause playback (the Pause button) when it plays, so a row starts from a known state. */
async function pauseIfPlaying(ctx) {
  const pause = ctl(ctx, "Pause");
  if (await pause.isVisible().catch(() => false)) await pause.click();
}

const app = {
  slug: "music",
  name: "Music",
  menus: ["Music", "File", "Edit", "Song", "View", "Controls", "Account", "Window", "Help"],
  editUnavailable:
    "dimmed placeholder rows of the shell's Edit menu: Music puts no Edit commands of its own there",
  preferences: {
    text: "General",
    locate: (ctx) => prefsWindow(ctx),
    close: async (ctx) =>
      prefsWindow(ctx).getByRole("button", { name: "Cancel", exact: true }).click(),
  },
  crawlIgnore: [/^menu:Apple\|/, /^menu bar\|menuitem\|Apple$/],
  open: async (ctx) => {
    await openApp(ctx.page, "Music");
    await W(ctx).waitFor({ state: "visible", timeout: 20_000 });
    return W(ctx);
  },
};

const rows = [];
const R = (id, state, role, name, how, expected, check, extra = {}) =>
  rows.push({ id: `music.${id}`, state, role, name, how, expected, check, ...extra });

// --- Library ---------------------------------------------------------------------------------
R(
  "library.add-songs.refuses-corrupt",
  "library (empty)",
  "button",
  "Add Songs…",
  "Add Songs…, choose a corrupt broken.mp3 in the file chooser",
  "the file is refused by name with why; the library on the server stays empty",
  async (ctx) => {
    const { page } = ctx;
    const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
    await ctl(ctx, "Add Songs…").click();
    const junk = Buffer.alloc(3000);
    for (let i = 0; i < junk.length; i += 1) junk[i] = (i * 7919) & 0xff;
    await (await chooser).setFiles({ name: "broken.mp3", mimeType: "audio/mpeg", buffer: junk });
    const said = await until(async () => /broken\.mp3/.test(await W(ctx).innerText()), 15_000);
    const message =
      (await W(ctx).innerText()).split("\n").find((line) => /broken\.mp3/.test(line)) ?? "";
    const empty = !(await text(ctx, LIB)).includes("broken");
    return { ok: said && empty, detail: `${message.slice(0, 160)}; library empty ${empty}` };
  },
  { notes: "error state: a file that is not audio" },
);
R(
  "library.add-songs",
  "library (empty)",
  "button",
  "Add Songs…",
  "Add Songs…, choose three WAV files in the file chooser",
  "the three songs are on the server's library and listed",
  async (ctx) => {
    const { page } = ctx;
    ctx.data.songs = ["Alpha", "Beta", "Gamma"].map((word) => `Census ${word} ${ctx.run}`);
    const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
    await ctl(ctx, "Add Songs…").click();
    await (await chooser).setFiles(
      titles(ctx).map((title, i) => ({
        name: `${title}.wav`,
        mimeType: "audio/wav",
        buffer: wav(6, 330 + i * 110),
      })),
    );
    const stored = await until(async () => {
      const t = await text(ctx, LIB);
      return titles(ctx).every((title) => t.includes(title));
    }, 45_000);
    await side(ctx, "Songs")
      .click()
      .catch(() => {});
    const listed = await until(() => song(ctx, titles(ctx)[0]).isVisible(), 15_000);
    return { ok: stored && listed, detail: `server ${stored}, listed ${listed}` };
  },
  {
    persists: "restart",
    timeout: 90_000,
    restartCheck: async (ctx) => {
      const t = await text(ctx, LIB);
      await side(ctx, "Songs")
        .click()
        .catch(() => {});
      const listed = await until(() => song(ctx, titles(ctx)[2]).isVisible(), 15_000);
      return {
        ok: titles(ctx).every((title) => t.includes(title)) && listed,
        detail: `listed ${listed}`,
      };
    },
  },
);
R(
  "library.song",
  "Songs",
  "row",
  "/(?:Love|Unlove) .+/",
  "double-click the first, the middle and the last song",
  "each plays: the media element's source changes and its time advances",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const sources = [];
    for (const title of titles(ctx)) {
      await playSong(ctx, title);
      const ok = await advancing(ctx);
      sources.push(ok ? (await playingMedia(ctx.page)).src : "not playing");
    }
    const distinct = new Set(sources).size === 3 && !sources.includes("not playing");
    return { ok: distinct, detail: sources.map((s) => s.slice(-24)).join(" | ") };
  },
  {
    notes: "kind: a song row of the library's list (first, middle and last checked)",
    timeout: 60_000,
  },
);
R(
  "library.header",
  "Songs",
  "row",
  "Title Time Artist Album Genre Plays",
  "open Songs and read the list's header row",
  "it names the list's six columns in order",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const header = W(ctx).getByRole("row", { name: "Title Time Artist Album Genre Plays" });
    const cols = await header
      .getByRole("columnheader")
      .evaluateAll((all) => all.map((e) => e.textContent.trim()));
    return {
      ok: cols.filter(Boolean).join(",") === "Title,Time,Artist,Album,Genre,Plays",
      detail: cols.join(","),
    };
  },
);
R(
  "library.love",
  "Songs",
  "button",
  "/(?:Love|Unlove) .+/",
  "click the first and the last song's Love, then (now Unlove) again",
  "the song is loved: Loved Songs lists it and the button turns to Unlove; the second click takes it back",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const buttons = W(ctx).getByRole("button", { name: /^(Love|Unlove) / });
    const n = await buttons.count();
    const out = [];
    for (const at of [...new Set([0, n - 1])]) {
      await side(ctx, "Songs").click();
      const label = (await buttons.nth(at).getAttribute("aria-label")) ?? "";
      const title = label.replace(/^(Love|Unlove) /, "");
      // Start from not loved, whatever an earlier row left.
      if (label.startsWith("Unlove")) await buttons.nth(at).click();
      await W(ctx)
        .getByRole("button", { name: `Love ${title}`, exact: true })
        .click();
      const turned = await until(
        () =>
          W(ctx)
            .getByRole("button", { name: `Unlove ${title}`, exact: true })
            .isVisible(),
        3_000,
      );
      // The song list's rows, not the window's text: Now Playing names the song playing too.
      const rowsOf = () =>
        W(ctx)
          .getByRole("row", { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
          .count();
      await side(ctx, "Loved Songs").click();
      const listed = await until(async () => (await rowsOf()) > 0, 5_000);
      await side(ctx, "Songs").click();
      await W(ctx)
        .getByRole("button", { name: `Unlove ${title}`, exact: true })
        .click();
      await side(ctx, "Loved Songs").click();
      const gone = await until(async () => (await rowsOf()) === 0, 5_000);
      out.push(`${title.slice(0, 30)}: turned ${turned}, loved ${listed}, unloved ${gone}`);
    }
    await side(ctx, "Songs").click();
    ctx.data.love = out;
    return {
      ok: n >= 1 && out.every((x) => /turned true, loved true, unloved true$/.test(x)),
      detail: out.join("; "),
    };
  },
  { notes: "kind: a song's Love button, named Unlove while the song is loved" },
);
/** Click a cell of a song row and answer whether the row became selected. */
const selectsRow = async (_ctx, cell) => {
  await cell.click();
  const row = cell.locator("xpath=ancestor::*[@role='row'][1]");
  return until(async () => (await row.getAttribute("aria-selected")) === "true", 3_000);
};
R(
  "library.cell.love",
  "Songs",
  "gridcell",
  "/(?:Love|Unlove) .+/",
  "the Love cell of a song row",
  "holds exactly the song's Love button, which music.library.love performs (a click in the cell lands on that button)",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const cell = W(ctx)
      .getByRole("gridcell", { name: /^(Love|Unlove) / })
      .first();
    const holds = (await cell.getByRole("button").count()) === 1;
    return {
      ok:
        holds &&
        Array.isArray(ctx.data.love) &&
        ctx.data.love.every((x) => /turned true, loved true, unloved true$/.test(x)),
      detail: `holds the button ${holds}; ${(ctx.data.love ?? []).join("; ")}`,
    };
  },
  { notes: "kind: the Love cell of a song row" },
);
R(
  "library.cell.plays",
  "Songs",
  "gridcell",
  "/\\d+/",
  "click a song's Plays cell",
  "the click selects that song's row",
  async (ctx) => {
    await side(ctx, "Songs").click();
    return selectsRow(ctx, W(ctx).getByRole("gridcell", { name: /^\d+$/ }).first());
  },
  { notes: "kind: the play count cell of a song row" },
);
R(
  "library.cell.title",
  "Songs",
  "gridcell",
  "/(Census (Alpha|Beta|Gamma) [a-z0-9]+|\\d\\d [^:]+:.+)/",
  "click a song's title cell",
  "the click selects that song's row",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const cell = W(ctx)
      .getByRole("gridcell", { name: /^(Census (Alpha|Beta|Gamma) [a-z0-9]+|\d\d [^:]+:.+)$/ })
      .first();
    return selectsRow(ctx, cell);
  },
  { notes: "kind: the title cell of a song row" },
);
R(
  "library.cell.time",
  "Songs",
  "gridcell",
  "/\\d+:\\d\\d/",
  "click a song's time cell",
  "the click selects that song's row",
  async (ctx) => {
    await side(ctx, "Songs").click();
    return selectsRow(
      ctx,
      W(ctx)
        .getByRole("gridcell", { name: /^\d+:\d\d$/ })
        .first(),
    );
  },
  { notes: "kind: the time cell of a song row" },
);
R(
  "library.cell.empty",
  "Songs",
  "gridcell",
  "",
  "click a song's empty cell (no genre in its tags)",
  "the click selects that song's row",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const cells = W(ctx).getByRole("gridcell");
    const at = await cells.evaluateAll((all) =>
      all.findIndex((e) => e.textContent.trim() === "" && !e.querySelector("button")),
    );
    if (at < 0) return { ok: false, detail: "no empty cell" };
    return selectsRow(ctx, cells.nth(at));
  },
  { notes: "kind: a cell with nothing in it (a song whose tags give no genre)" },
);
R(
  "library.sort",
  "Songs",
  "button",
  "/(Title|Time|Artist|Album|Genre|Plays)/",
  "click Title, Album and Plays at the head of the list",
  "each sorts the list by its column: the column's values read in order",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const columns = await W(ctx)
      .getByRole("columnheader")
      .evaluateAll((all) => all.map((e) => e.textContent.trim()));
    const out = [];
    for (const column of ["Title", "Album", "Plays"]) {
      await W(ctx).getByRole("button", { name: column, exact: true }).first().click();
      await sleep(400);
      const at = columns.indexOf(column);
      const values = await W(ctx)
        .getByRole("row")
        .evaluateAll(
          (rows, at) =>
            rows
              .map((r) => [...r.querySelectorAll('[role="gridcell"]')][at]?.textContent.trim())
              .filter((v) => v !== undefined),
          at,
        );
      const compare = (a, b) =>
        column === "Plays"
          ? Number(a) - Number(b)
          : a.localeCompare(b, undefined, { numeric: true });
      const up = values.every((v, i) => i === 0 || compare(values[i - 1], v) <= 0);
      const down = values.every((v, i) => i === 0 || compare(values[i - 1], v) >= 0);
      out.push(`${column}:${values.length > 1 && (up || down)}`);
    }
    return { ok: out.every((x) => x.endsWith("true")), detail: out.join(", ") };
  },
  { notes: "kind: a column's sort button at the head of the song list" },
);
R(
  "library.cell.artist",
  "Songs",
  "gridcell",
  "/(Unknown Artist|Thomas Tapper)/",
  "click a song's artist cell",
  "the click selects that song's row",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const cell = W(ctx)
      .getByRole("gridcell", { name: /^(Unknown Artist|Thomas Tapper)$/ })
      .first();
    await cell.click();
    const row = cell.locator("xpath=ancestor::*[@role='row'][1]");
    return until(async () => (await row.getAttribute("aria-selected")) === "true", 3_000);
  },
  {
    notes:
      "kind: the artist cell of a song row (artists from the files' tags or the Internet Archive item)",
  },
);
R(
  "library.cell.album",
  "Songs",
  "gridcell",
  "/(Unknown Album|Stories of Great Composers for Children)/",
  "click a song's album cell",
  "the click selects that song's row",
  async (ctx) => {
    await side(ctx, "Songs").click();
    const cell = W(ctx)
      .getByRole("gridcell", { name: /^(Unknown Album|Stories of Great Composers for Children)$/ })
      .first();
    await cell.click();
    const row = cell.locator("xpath=ancestor::*[@role='row'][1]");
    return until(async () => (await row.getAttribute("aria-selected")) === "true", 3_000);
  },
  { notes: "kind: the album cell of a song row" },
);
R(
  "library.search",
  "library",
  "searchbox",
  "Search your library",
  "type the middle song's word",
  "only the matching song is listed",
  async (ctx) => {
    const field = W(ctx).getByRole("searchbox", { name: "Search your library" });
    await field.click();
    await field.pressSequentially("Beta");
    const ok = await until(
      async () =>
        (await song(ctx, titles(ctx)[1]).isVisible()) &&
        !(await song(ctx, titles(ctx)[0]).isVisible()),
      8_000,
    );
    await field.press("ControlOrMeta+a");
    await field.press("Backspace");
    return ok;
  },
);
for (const name of [
  "Recently Added",
  "Artists",
  "Albums",
  "Songs",
  "Browse",
  "Loved Songs",
  "Recently Played",
  "Top 25 Most Played",
]) {
  R(
    `sidebar.${name.toLowerCase().replace(/\W+/g, "-")}`,
    "sidebar",
    "treeitem",
    name,
    `click ${name} in the sidebar`,
    `${name} is selected and its view shows`,
    async (ctx) => {
      await side(ctx, name).click();
      const selected = await until(
        async () => (await side(ctx, name).getAttribute("aria-selected")) === "true",
        5_000,
      );
      const shown = await until(async () => (await W(ctx).innerText()).includes(name), 5_000);
      return { ok: selected && shown, detail: `selected ${selected}, shown ${shown}` };
    },
  );
}

// --- Playback controls ----------------------------------------------------------------------
R(
  "controls.play",
  "playback controls",
  "button",
  "Play",
  "pause, then click Play",
  "the media element plays: time advances, readyState >= 2",
  async (ctx) => {
    await side(ctx, "Songs").click();
    await pauseIfPlaying(ctx);
    await ctl(ctx, "Play").click();
    const ok = await advancing(ctx);
    return { ok, detail: await mediaLine(ctx) };
  },
);
R(
  "controls.pause",
  "playback controls (playing)",
  "button",
  "Pause",
  "while a song plays, click Pause",
  "the media element pauses and its time stops",
  async (ctx) => {
    if (
      !(await ctl(ctx, "Pause")
        .isVisible()
        .catch(() => false))
    )
      await ctl(ctx, "Play").click();
    await advancing(ctx);
    await ctl(ctx, "Pause").click();
    const paused = await until(async () => (await playingMedia(ctx.page))?.paused === true, 5_000);
    const t1 = (await playingMedia(ctx.page))?.currentTime;
    await sleep(800);
    const t2 = (await playingMedia(ctx.page))?.currentTime;
    return { ok: paused && t1 === t2, detail: await mediaLine(ctx) };
  },
);
R(
  "controls.next",
  "playback controls",
  "button",
  "Next",
  "while a song plays, click Next",
  "the next song plays: the source changes and time advances",
  async (ctx) => {
    await playSong(ctx, titles(ctx)[0]);
    await advancing(ctx);
    const before = (await playingMedia(ctx.page))?.src;
    await ctl(ctx, "Next").click();
    const changed = await until(async () => (await playingMedia(ctx.page))?.src !== before, 6_000);
    const ok = changed && (await advancing(ctx));
    ctx.data.afterNext = (await playingMedia(ctx.page))?.src;
    ctx.data.beforeNext = before;
    return { ok, detail: await mediaLine(ctx) };
  },
);
R(
  "controls.previous",
  "playback controls",
  "button",
  "Previous",
  "right after Next, click Previous",
  "the earlier song plays again",
  async (ctx) => {
    await ctl(ctx, "Previous").click();
    const back = await until(
      async () => (await playingMedia(ctx.page))?.src === ctx.data.beforeNext,
      6_000,
    );
    return { ok: back && (await advancing(ctx)), detail: await mediaLine(ctx) };
  },
);
R(
  "controls.shuffle",
  "playback controls",
  "button",
  "Shuffle",
  "click Shuffle, reload the desktop, then click Shuffle again",
  "Shuffle turns on (pressed), the page keeps it across a reload, and it turns off again",
  async (ctx) => {
    const { page } = ctx;
    const button = ctl(ctx, "Shuffle");
    const before = await button.getAttribute("aria-pressed");
    // The player saves its settings a moment after a change: the reload waits for that save.
    const put = saved(page, PLAYBACK);
    await button.click();
    const on = await until(
      async () => (await button.getAttribute("aria-pressed")) !== before,
      3_000,
    );
    const reply = await put.catch(() => null);
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 20_000 });
    await ensureOpen(ctx);
    const kept = await until(
      async () => (await ctl(ctx, "Shuffle").getAttribute("aria-pressed")) !== before,
      5_000,
    );
    await ctl(ctx, "Shuffle").click();
    const off = await until(
      async () => (await ctl(ctx, "Shuffle").getAttribute("aria-pressed")) === before,
      3_000,
    );
    return {
      ok: on && kept && off,
      detail: `pressed ${before}: on ${on}, saved ${reply?.status() ?? "no save seen"}, kept after reload ${kept}, off ${off}`,
    };
  },
  {
    persists: "reload",
    notes:
      "shuffle, repeat and volume are the page's own settings (music-server.ts), not the server's",
  },
);
R(
  "controls.repeat",
  "playback controls",
  "button",
  "/Repeat: (Off|All|One)/",
  "click Repeat three times",
  "it cycles Off, All, One, Off",
  async (ctx) => {
    const button = W(ctx)
      .getByRole("button", { name: /^Repeat: / })
      .first();
    const seen = [(await button.getAttribute("aria-label")) ?? (await button.textContent())];
    for (let n = 0; n < 3; n += 1) {
      await button.click();
      await sleep(400);
      seen.push((await button.getAttribute("aria-label")) ?? (await button.textContent()));
    }
    const ok = seen.join(",") === "Repeat: Off,Repeat: All,Repeat: One,Repeat: Off";
    return { ok, detail: seen.join(" > ") };
  },
  { notes: "kind: the Repeat button, named by its mode (a setting of the page, not the server)" },
);
R(
  "controls.volume",
  "playback controls",
  "slider",
  "Volume",
  "focus Volume, press Left Arrow 5 times, reload the desktop",
  "the media element's volume falls with the slider, and the page keeps the volume across a reload",
  async (ctx) => {
    const { page } = ctx;
    await playSong(ctx, titles(ctx)[0]);
    await advancing(ctx);
    const slider = () => W(ctx).getByRole("slider", { name: "Volume" }).first();
    const before = Number(await slider().getAttribute("aria-valuenow"));
    await slider().focus();
    for (let n = 0; n < 5; n += 1) await page.keyboard.press("ArrowLeft");
    const after = Number(await slider().getAttribute("aria-valuenow"));
    const mediaVolume = await until(
      async () => Math.abs((await playingMedia(page)).volume - after / 100) < 0.02,
      4_000,
    );
    const line = await mediaLine(ctx);
    await pauseIfPlaying(ctx);
    // An older save may land before the one sent as the page unloads, which is then refused: the next
    // page sends it again (`leftPlaybackToSend`), so this does not wait for the server.
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 20_000 });
    await ensureOpen(ctx);
    const kept = await until(
      async () => Number(await slider().getAttribute("aria-valuenow")) === after,
      6_000,
    );
    ctx.data.volume = after;
    return {
      ok: after < before && mediaVolume && kept,
      detail: `${before} -> ${after}; ${line}; after reload ${await slider().getAttribute("aria-valuenow")}`,
    };
  },
  { persists: "reload" },
);
R(
  "controls.position",
  "playback controls",
  "slider",
  "Playback position",
  "while a song plays, focus Playback position, press Right Arrow 3 times",
  "the media element jumps ahead",
  async (ctx) => {
    if (!(await advancing(ctx, 3_000))) {
      await playSong(ctx, titles(ctx)[1]);
      await advancing(ctx);
    }
    await ctl(ctx, "Pause").click();
    const before = (await playingMedia(ctx.page)).currentTime;
    const slider = W(ctx).getByRole("slider", { name: "Playback position" }).first();
    await slider.focus();
    for (let n = 0; n < 3; n += 1) await ctx.page.keyboard.press("ArrowRight");
    const jumped = await until(
      async () => (await playingMedia(ctx.page)).currentTime > before + 0.5,
      4_000,
    );
    return { ok: jumped, detail: `${before.toFixed(2)} -> ${await mediaLine(ctx)}` };
  },
);
R(
  "controls.up-next",
  "playback controls",
  "button",
  "Up Next",
  "while the first song plays, click Up Next",
  "the Up Next list shows the songs that follow",
  async (ctx) => {
    await playSong(ctx, titles(ctx)[0]);
    await advancing(ctx);
    await ctl(ctx, "Up Next").click();
    const list = ctx.page
      .getByRole("list", { name: "Upcoming songs" })
      .or(ctx.page.getByLabel("Upcoming songs"))
      .last();
    const shown = await until(async () => (await list.innerText()).includes(titles(ctx)[1]), 5_000);
    await ctl(ctx, "Up Next")
      .click()
      .catch(() => {});
    await ctx.page.keyboard.press("Escape");
    return shown;
  },
);
R(
  "controls.lyrics",
  "playback controls",
  "button",
  "Lyrics",
  "click Lyrics, then again",
  "the lyrics pane opens (saying when a song has none) and closes",
  async (ctx) => {
    const before = await W(ctx).innerText();
    await ctl(ctx, "Lyrics").click();
    const opened = await until(
      async () => (await W(ctx).innerText()) !== before && /lyric/i.test(await W(ctx).innerText()),
      5_000,
    );
    const said = (await W(ctx).innerText()).split("\n").find((line) => /lyric/i.test(line)) ?? "";
    await ctl(ctx, "Lyrics").click();
    return { ok: opened, detail: said.slice(0, 120) };
  },
);
R(
  "controls.audio-output",
  "playback controls",
  "button",
  "Audio output",
  "while a song plays, click Audio output",
  "a menu lists where the sound goes; dimmed with its reason where the browser offers no choice of output",
  async (ctx) => {
    await playSong(ctx, titles(ctx)[0]);
    await advancing(ctx);
    const button = ctl(ctx, "Audio output");
    const dimmed =
      (await button.getAttribute("aria-disabled")) === "true" || (await button.isDisabled());
    if (dimmed) {
      const reason = (await button.getAttribute("title")) ?? "";
      await pauseIfPlaying(ctx);
      return {
        ok: reason.length > 0,
        unavailable: `dimmed: ${reason}`,
        detail: `dimmed while playing; title "${reason}"`,
      };
    }
    await button.click();
    const menu = ctx.page.getByRole("menu").or(ctx.page.getByRole("dialog")).last();
    const shown = await menu.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    );
    const items = shown ? (await menu.innerText()).replace(/\s+/g, " ").slice(0, 120) : "";
    await closeMenus(ctx.page);
    await ctx.page.keyboard.press("Escape");
    await pauseIfPlaying(ctx);
    return { ok: shown && items.length > 0, detail: items };
  },
);

// --- MiniPlayer -----------------------------------------------------------------------------
/** The MiniPlayer: a region of the desktop (not a window of its own) with its controls toolbar. */
const mini = (ctx) => ctx.page.getByRole("region", { name: "MiniPlayer" }).first();
R(
  "miniplayer.open",
  "playback controls",
  "button",
  "MiniPlayer",
  "while the first song plays, click MiniPlayer",
  "the MiniPlayer opens with its controls and names the song playing",
  async (ctx) => {
    await playSong(ctx, titles(ctx)[0]);
    await advancing(ctx);
    if ((await ctl(ctx, "MiniPlayer").getAttribute("aria-pressed")) !== "true")
      await ctl(ctx, "MiniPlayer").click();
    const open = await mini(ctx)
      .waitFor({ timeout: 8_000 })
      .then(
        () => true,
        () => false,
      );
    const controls =
      open && (await mini(ctx).getByRole("toolbar", { name: "MiniPlayer controls" }).count()) === 1;
    const naming = open && (await mini(ctx).innerText()).includes(titles(ctx)[0]);
    return {
      ok: open && controls && naming,
      detail: `open ${open}, controls ${controls}, names the song ${naming}`,
    };
  },
);
R(
  "miniplayer.pause",
  "MiniPlayer",
  "button",
  "Pause",
  "click Pause in the MiniPlayer, then Play",
  "the media element pauses, then plays again",
  async (ctx) => {
    const m = mini(ctx);
    await m.getByRole("button", { name: "Pause", exact: true }).click();
    const paused = await until(async () => (await playingMedia(ctx.page))?.paused === true, 5_000);
    await m.getByRole("button", { name: "Play", exact: true }).click();
    const again = await advancing(ctx);
    return { ok: paused && again, detail: await mediaLine(ctx) };
  },
);
R(
  "miniplayer.next",
  "MiniPlayer",
  "button",
  "Next",
  "click Next in the MiniPlayer",
  "the next song plays",
  async (ctx) => {
    const before = (await playingMedia(ctx.page))?.src;
    await mini(ctx).getByRole("button", { name: "Next", exact: true }).click();
    const ok = await until(async () => (await playingMedia(ctx.page))?.src !== before, 6_000);
    return { ok: ok && (await advancing(ctx)), detail: await mediaLine(ctx) };
  },
);
R(
  "miniplayer.close",
  "MiniPlayer",
  "button",
  "Close",
  "click the MiniPlayer's Close",
  "the MiniPlayer closes and Music's window stays",
  async (ctx) => {
    await mini(ctx).getByRole("button", { name: "Close", exact: true }).first().click();
    const closed = await until(async () => !(await mini(ctx).isVisible()), 5_000);
    await pauseIfPlaying(ctx);
    return { ok: closed && (await W(ctx).isVisible()), detail: `closed ${closed}` };
  },
);

// --- Internet Archive (outside host) ------------------------------------------------------------
const curlArchive = () => {
  try {
    return execSync(
      "curl -s -o /dev/null -m 20 -w '%{http_code}' 'https://archive.org/advancedsearch.php?q=bach&fl%5B%5D=identifier&rows=1&output=json'",
    )
      .toString()
      .trim();
  } catch (error) {
    return `curl failed: ${String(error).split("\n")[0]}`;
  }
};
R(
  "archive.browse",
  "library (empty) / sidebar",
  "button",
  "Browse the Internet Archive",
  "click Browse the Internet Archive",
  "the Internet Archive search shows",
  async (ctx) => {
    const button = ctl(ctx, "Browse the Internet Archive");
    if (await button.isVisible().catch(() => false)) await button.click();
    else await side(ctx, "Browse").click();
    const shown = await W(ctx)
      .getByRole("searchbox", { name: "Search the Internet Archive" })
      .or(W(ctx).getByRole("textbox", { name: "Search the Internet Archive" }))
      .first()
      .waitFor({ timeout: 8_000 })
      .then(
        () => true,
        () => false,
      );
    return shown;
  },
);
R(
  "archive.search",
  "Internet Archive",
  "searchbox",
  "Search the Internet Archive",
  "type bach, press Return",
  "results from the Internet Archive are listed, or an honest message when archive.org cannot be reached (curl in the same minute)",
  async (ctx) => {
    const field = W(ctx)
      .getByRole("searchbox", { name: "Search the Internet Archive" })
      .or(W(ctx).getByRole("textbox", { name: "Search the Internet Archive" }))
      .first();
    await field.click();
    await field.pressSequentially("bach");
    await field.press("Enter");
    const cards = W(ctx).locator(".mac-card-grid-card");
    const found = await until(async () => (await cards.count()) > 0, 30_000);
    if (found) return { ok: true, detail: `${await cards.count()} results` };
    const curl = curlArchive();
    const status =
      (await W(ctx)
        .locator(".mac-music-desktop-status")
        .innerText()
        .catch(() => "")) ||
      (await W(ctx)
        .getByRole("status")
        .first()
        .innerText()
        .catch(() => ""));
    // An explicit failure message, never a lingering "Searching…".
    const explicit =
      /(could not|couldn’t|can’t|cannot|unavailable|not reach|error|failed|try again)/i.test(
        status,
      ) && !/^Searching/i.test(status.trim());
    return {
      ok: curl !== "200" && explicit,
      detail: `no results; message "${status.slice(0, 120)}"; curl archive.org ${curl} at ${new Date().toISOString()}`,
    };
  },
  { timeout: 75_000 },
);
R(
  "archive.add-to-library",
  "Internet Archive item",
  "button",
  "Add to Library",
  "open the first result, click Add to Library",
  "the item's tracks join the library on the server and one plays from archive.org",
  async (ctx) => {
    const cards = W(ctx).locator(".mac-card-grid-card");
    if ((await cards.count()) === 0) {
      const curl = curlArchive();
      return {
        ok: false,
        detail: `no archive results to add; curl archive.org ${curl} at ${new Date().toISOString()}`,
      };
    }
    const before = await text(ctx, LIB);
    await cards.first().click();
    const add = W(ctx).getByRole("button", { name: "Add to Library" }).first();
    await add.waitFor({ timeout: 30_000 });
    await add.click();
    const grew = await until(async () => (await text(ctx, LIB)).length > before.length, 30_000);
    // One of the added tracks plays, from archive.org.
    await side(ctx, "Songs").click();
    const added = W(ctx)
      .getByRole("row")
      .filter({ hasNotText: /Census (Alpha|Beta|Gamma)/ })
      .filter({ hasText: /\S/ });
    const count = await added.count();
    let played = "no added track listed";
    if (count > 1) {
      await added.nth(1).dblclick();
      const playing = await advancing(ctx, 30_000);
      const src = (await playingMedia(ctx.page))?.src ?? "";
      played =
        playing && /archive\.org/.test(src)
          ? `plays ${src.slice(0, 80)}`
          : `not playing from archive.org (${src.slice(0, 80)}; ${await mediaLine(ctx)})`;
      await pauseIfPlaying(ctx);
    }
    return {
      ok: grew && played.startsWith("plays"),
      detail: `library ${before.length} -> ${(await text(ctx, LIB)).length} bytes; ${played}; curl archive.org ${curlArchive()}`,
    };
  },
  { timeout: 90_000 },
);

// --- Preferences ----------------------------------------------------------------------------
/** Music's Preferences: a dialog inside its window, with General, Playback and Advanced tabs, saved by OK. */
const prefsWindow = (ctx) =>
  ctx.page
    .getByRole("dialog")
    .filter({
      has: ctx.page
        .getByRole("tablist", { name: "Music preferences" })
        .or(ctx.page.getByRole("toolbar", { name: "Music preferences" })),
    })
    .first();
async function openPrefs(ctx) {
  if (
    await prefsWindow(ctx)
      .isVisible()
      .catch(() => false)
  )
    return prefsWindow(ctx);
  await ensureOpen(ctx);
  await chooseMenu(ctx.page, "Music", "Preferences…");
  await prefsWindow(ctx).waitFor({ timeout: 8_000 });
  return prefsWindow(ctx);
}
/** OK in Preferences, answering the PUT it sends. */
async function prefsOk(ctx) {
  const put = saved(ctx.page, PREFS);
  await prefsWindow(ctx).getByRole("button", { name: "OK", exact: true }).click();
  const reply = await put.catch(() => null);
  await prefsWindow(ctx)
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => {});
  return reply;
}
for (const tab of ["General", "Playback", "Files", "Restrictions", "Advanced"]) {
  R(
    `preferences.tab.${tab.toLowerCase()}`,
    "Preferences",
    "tab",
    tab,
    `Music > Preferences…, click the ${tab} tab`,
    `the ${tab} pane shows`,
    async (ctx) => {
      const w = await openPrefs(ctx);
      await w.getByRole("tab", { name: tab, exact: true }).first().click();
      return until(
        async () =>
          (await w.getByRole("tab", { name: tab, exact: true }).getAttribute("aria-selected")) ===
          "true",
        4_000,
      );
    },
  );
}
const PREF_BOXES = [
  ["General", "When song changes"],
  ["Playback", "Crossfade songs"],
  ["Playback", "Sound Enhancer"],
  ["Playback", "Sound Check"],
  ["Advanced", "Keep on top of all other windows"],
];
for (const [tab, label] of PREF_BOXES) {
  R(
    `preferences.${label.toLowerCase().replace(/\W+/g, "-")}`,
    `Preferences (${tab})`,
    "checkbox",
    label,
    `in Preferences > ${tab}, click ${label}, OK; open Preferences again`,
    "the box toggles, OK saves it (PUT 200, the server's preferences change) and Preferences shows it again; it holds across a restart",
    async (ctx) => {
      const w = await openPrefs(ctx);
      await w.getByRole("tab", { name: tab, exact: true }).first().click();
      const box = w.getByRole("checkbox", { name: label }).first();
      if ((await box.getAttribute("aria-disabled")) === "true" || (await box.isDisabled())) {
        // Dimmed on this desktop: it passes only with its reason shown.
        const reason = ((await box.getAttribute("title")) ?? "").trim();
        await w
          .getByRole("button", { name: "Cancel", exact: true })
          .click()
          .catch(() => {});
        return {
          ok: reason.length > 0,
          unavailable: `dimmed: ${reason}`,
          detail: `dimmed; reason "${reason}"`,
        };
      }
      const before = await box.isChecked();
      const serverBefore = await text(ctx, PREFS);
      await box.click();
      const now = await box.isChecked();
      const reply = await prefsOk(ctx);
      const server = await text(ctx, PREFS);
      const w2 = await openPrefs(ctx);
      await w2.getByRole("tab", { name: tab, exact: true }).first().click();
      const shown = await w2.getByRole("checkbox", { name: label }).first().isChecked();
      await w2.getByRole("button", { name: "Cancel", exact: true }).click();
      ctx.data.prefs = { ...(ctx.data.prefs ?? {}), [label]: now };
      return {
        ok: now !== before && reply?.status() === 200 && server !== serverBefore && shown === now,
        detail: `${before} -> ${now}; PUT ${reply?.status()}; shown again ${shown}`,
      };
    },
    {
      persists: "restart",
      restartCheck: async (ctx) => {
        if (!Object.hasOwn(ctx.data.prefs ?? {}, label))
          return { ok: true, unavailable: "dimmed on this desktop: nothing was changed to keep" };
        const w = await openPrefs(ctx);
        await w.getByRole("tab", { name: tab, exact: true }).first().click();
        const now = await w.getByRole("checkbox", { name: label }).first().isChecked();
        await w
          .getByRole("button", { name: "Cancel", exact: true })
          .click()
          .catch(() => {});
        return {
          ok: now === ctx.data.prefs?.[label],
          detail: `${now} vs ${ctx.data.prefs?.[label]}`,
        };
      },
    },
  );
}
R(
  "preferences.list-size",
  "Preferences (General)",
  "combobox",
  "List Size:",
  "in Preferences > General, choose Large in List Size, OK",
  "Large is chosen and OK saves it on the server",
  async (ctx) => {
    const w = await openPrefs(ctx);
    await w.getByRole("tab", { name: "General", exact: true }).first().click();
    const select = w.getByRole("combobox", { name: "List Size:" }).first();
    await select.click();
    await ctx.page
      .getByRole("option", { name: "Large" })
      .or(ctx.page.getByRole("menuitemradio", { name: "Large" }))
      .first()
      .click();
    const reply = await prefsOk(ctx);
    const server = await text(ctx, PREFS);
    return { ok: reply?.status() === 200 && /large/i.test(server), detail: server.slice(0, 160) };
  },
);
R(
  "preferences.ok",
  "Preferences",
  "button",
  "OK",
  "change a setting, OK",
  "Preferences closes and the change is saved (checked with every setting above)",
  async (ctx) => {
    const w = await openPrefs(ctx);
    await w.getByRole("tab", { name: "General", exact: true }).first().click();
    const reply = await prefsOk(ctx);
    const closed = !(await prefsWindow(ctx)
      .isVisible()
      .catch(() => false));
    return {
      ok: closed && (reply === null || reply.status() === 200),
      detail: `closed ${closed}, PUT ${reply?.status() ?? "none (nothing changed)"}`,
    };
  },
);
R(
  "preferences.cancel",
  "Preferences",
  "button",
  "Cancel",
  "choose another List Size, then Cancel",
  "Preferences closes and nothing is saved: the server's preferences are unchanged",
  async (ctx) => {
    const w = await openPrefs(ctx);
    await w.getByRole("tab", { name: "General", exact: true }).first().click();
    const before = await text(ctx, PREFS);
    const select = w.getByRole("combobox", { name: "List Size:" }).first();
    const shown = ((await select.textContent()) ?? "").trim();
    await select.click();
    await ctx.page
      .getByRole("option", { name: shown === "Small" ? "Medium" : "Small", exact: true })
      .click();
    await w.getByRole("button", { name: "Cancel", exact: true }).click();
    await sleep(800);
    const closed = !(await prefsWindow(ctx)
      .isVisible()
      .catch(() => false));
    return { ok: closed && (await text(ctx, PREFS)) === before, detail: `closed ${closed}` };
  },
);

R(
  "preferences.playback-sliders",
  "Preferences (Playback)",
  "slider",
  "Crossfade length",
  "in Preferences > Playback, tick Crossfade songs and Sound Enhancer and move their sliders, then Cancel",
  "each slider follows its box, and the crossfade's says its seconds",
  async (ctx) => {
    const w = await openPrefs(ctx);
    await w.getByRole("tab", { name: "Playback", exact: true }).first().click();
    const box = w.getByRole("checkbox", { name: "Crossfade songs" }).first();
    if (!(await box.isChecked())) await box.click();
    const slider = w.getByRole("slider", { name: "Crossfade length" }).first();
    await slider.focus();
    await ctx.page.keyboard.press("End");
    const said = await w.getByText("12 seconds").isVisible();
    const enhancer = w.getByRole("checkbox", { name: "Sound Enhancer" }).first();
    if (await enhancer.isChecked()) await enhancer.click();
    const off = await w.getByRole("slider", { name: "Sound Enhancer amount" }).first().isDisabled();
    await w.getByRole("button", { name: "Cancel", exact: true }).click();
    return { ok: said && off, detail: `12 seconds ${said}, enhancer slider off ${off}` };
  },
);

// --- State across reload and restart, isolation -------------------------------------------------
const DIMMED_BOXES = [
  "iTunes Store",
  "Keep Music Media folder organized",
  "Copy files to Music Media folder",
  "Shared Libraries",
  "Music with explicit content",
  "Add songs to Library when adding to playlists",
  "Automatically update artwork",
];
R(
  "preferences.dimmed-settings",
  "Preferences (every pane)",
  "checkbox",
  `/(${DIMMED_BOXES.join("|")})/`,
  "Music > Preferences…, each pane in turn",
  "each of these settings is dimmed with its reason as its title (this desktop has no store, sync or media folder)",
  async (ctx) => {
    const w = await openPrefs(ctx);
    const out = [];
    let reason = "";
    for (const tab of ["General", "Playback", "Files", "Restrictions", "Advanced"]) {
      await w.getByRole("tab", { name: tab, exact: true }).first().click();
      const boxes = w.getByRole("checkbox", { name: new RegExp(`^(${DIMMED_BOXES.join("|")})$`) });
      for (const at of [...Array(await boxes.count()).keys()]) {
        const box = boxes.nth(at);
        if (!(await box.isVisible())) continue;
        const dimmed =
          (await box.getAttribute("aria-disabled")) === "true" || (await box.isDisabled());
        const title = ((await box.getAttribute("title")) ?? "").trim();
        reason ||= title;
        out.push(`${tab}/${(await box.textContent())?.trim()}: ${dimmed && title.length > 0}`);
      }
    }
    await w
      .getByRole("button", { name: "Cancel", exact: true })
      .click()
      .catch(() => {});
    const seen = out.length;
    return {
      ok: seen >= DIMMED_BOXES.length && out.every((x) => x.endsWith("true")),
      unavailable: `dimmed: ${reason}`,
      detail: `${seen} boxes; ${out.filter((x) => x.endsWith("false")).join(", ") || "all dimmed with a reason"}`,
    };
  },
  { notes: "kind: a Preferences setting this desktop cannot change (each one checked)" },
);
R(
  "upnext.list",
  "Up Next",
  "listbox",
  "Upcoming songs",
  "play the first song, click Up Next",
  "the Up Next list holds the songs after it, as options",
  async (ctx) => {
    await playSong(ctx, titles(ctx)[0]);
    await advancing(ctx);
    await ctl(ctx, "Up Next").click();
    const list = ctx.page.getByRole("listbox", { name: "Upcoming songs" });
    const shown = await list.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    );
    const names = shown
      ? await list.getByRole("option").evaluateAll((all) => all.map((e) => e.textContent.trim()))
      : [];
    ctx.data.upNext = names;
    return {
      ok:
        names.some((n) => n.includes(titles(ctx)[1])) &&
        names.some((n) => n.includes(titles(ctx)[2])),
      detail: names.join(" | ").slice(0, 200),
    };
  },
);
R(
  "upnext.song",
  "Up Next",
  "option",
  "/Census (Alpha|Beta|Gamma) [a-z0-9]+.*/",
  "in the open Up Next list, double-click the last song",
  "that song plays: Now Playing names it and the media element's time advances",
  async (ctx) => {
    const list = ctx.page.getByRole("listbox", { name: "Upcoming songs" });
    if (!(await list.isVisible().catch(() => false))) {
      await playSong(ctx, titles(ctx)[0]);
      await ctl(ctx, "Up Next").click();
    }
    await list
      .getByRole("option")
      .filter({ hasText: titles(ctx)[2] })
      .first()
      .dblclick();
    const named = await until(
      async () =>
        (await W(ctx).getByRole("group", { name: "Now Playing" }).innerText()).includes(
          titles(ctx)[2],
        ),
      6_000,
    );
    const plays = await advancing(ctx);
    await ctx.page.keyboard.press("Escape");
    await pauseIfPlaying(ctx);
    return { ok: named && plays, detail: `now playing ${named}; ${await mediaLine(ctx)}` };
  },
  { notes: "kind: a song of the Up Next list" },
);
R(
  "archive.search-button",
  "Internet Archive",
  "button",
  "Search",
  "Browse the Internet Archive, type mozart, click Search",
  "results from the Internet Archive are listed, or an honest message when archive.org cannot be reached (curl in the same minute)",
  async (ctx) => {
    await side(ctx, "Browse").click();
    const field = W(ctx)
      .getByRole("searchbox", { name: "Search the Internet Archive" })
      .or(W(ctx).getByRole("textbox", { name: "Search the Internet Archive" }))
      .first();
    await field.fill("mozart");
    await W(ctx).getByRole("button", { name: "Search", exact: true }).first().click();
    const cards = W(ctx).locator(".mac-card-grid-card");
    const found = await until(
      async () => (await cards.count()) > 0 && /mozart/i.test(await W(ctx).innerText()),
      30_000,
    );
    if (found) return { ok: true, detail: `${await cards.count()} results` };
    const curl = curlArchive();
    const status =
      (await W(ctx)
        .locator(".mac-music-desktop-status")
        .innerText()
        .catch(() => "")) ||
      (await W(ctx)
        .getByRole("status")
        .first()
        .innerText()
        .catch(() => ""));
    // An explicit failure message, never a lingering "Searching…", with archive.org failing curl too.
    const explicit =
      /(could not|couldn’t|can’t|cannot|unavailable|not reach|error|failed|try again)/i.test(
        status,
      ) && !/^Searching/i.test(status.trim());
    return {
      ok: curl !== "200" && explicit,
      detail: `no results; message "${status.slice(0, 120)}"; curl archive.org ${curl} at ${new Date().toISOString()}`,
    };
  },
  { timeout: 75_000 },
);
// --- State across reload and restart, isolation (continued) ---------------------------------------
R(
  "preferences.help",
  "Preferences",
  "button",
  "Help",
  "Music > Preferences…, the Help button under the pane",
  "Help Viewer opens on Music's help; where Help Viewer has no Music help (Music's Help menu item is dimmed saying so), the button is dimmed with that reason shown",
  async (ctx) => {
    const { page } = ctx;
    const w = await openPrefs(ctx);
    const help = w.getByRole("button", { name: "Help", exact: true }).first();
    const dimmed =
      (await help.getAttribute("aria-disabled")) === "true" || (await help.isDisabled());
    const reason = ((await help.getAttribute("title")) ?? "").trim();
    if (dimmed) {
      await w
        .getByRole("button", { name: "Cancel", exact: true })
        .click()
        .catch(() => {});
      return {
        ok: reason.length > 0,
        unavailable: `dimmed: ${reason}`,
        detail: `dimmed; reason "${reason}"`,
      };
    }
    const before = await page.locator(".mac-managed-window:not([data-minimized])").count();
    await help.click();
    const opened = await until(
      async () =>
        (await page.locator(".mac-managed-window:not([data-minimized])").count()) > before,
      8_000,
    );
    const viewer = await newestWindow(page, app.slug);
    const text = viewer && opened ? await viewer.innerText() : "";
    if (viewer && opened)
      await viewer
        .getByRole("button", { name: "Close", exact: true })
        .first()
        .click()
        .catch(() => {});
    if (
      await prefsWindow(ctx)
        .isVisible()
        .catch(() => false)
    )
      await prefsWindow(ctx)
        .getByRole("button", { name: "Cancel", exact: true })
        .click()
        .catch(() => {});
    return {
      ok: opened && /Music/.test(text),
      detail: `enabled; opened ${opened}: ${text.replace(/\s+/g, " ").slice(0, 100)}`,
    };
  },
);
R(
  "state.reload",
  "Music",
  "state",
  "song and position",
  "play the middle song a few seconds, pause, reload the desktop, open Music",
  "the server keeps the song and its position; after the reload the player shows that song and Play resumes it at that place",
  async (ctx) => {
    const { page } = ctx;
    await side(ctx, "Songs").click();
    await playSong(ctx, titles(ctx)[1]);
    await advancing(ctx);
    await sleep(1500);
    await ctl(ctx, "Pause").click();
    await sleep(1500);
    const kept = (await getJson(ctx, PLAYBACK))?.playback;
    ctx.data.playback = kept;
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 20_000 });
    await ensureOpen(ctx);
    const nowPlaying = W(ctx).getByRole("group", { name: "Now Playing" });
    const shows = await until(
      async () => (await nowPlaying.innerText()).includes(titles(ctx)[1]),
      10_000,
    );
    const after = (await getJson(ctx, PLAYBACK))?.playback;
    await ctl(ctx, "Play").click();
    const plays = await advancing(ctx);
    const m = await playingMedia(page);
    const resumed = !!m && m.currentTime >= (kept?.position ?? 99) - 0.5;
    await pauseIfPlaying(ctx);
    const samePlace =
      typeof kept?.position === "number" &&
      kept.position > 0.5 &&
      Math.abs((after?.position ?? -1) - kept.position) < 1;
    return {
      ok: shows && samePlace && plays && resumed,
      detail: `position ${kept?.position} -> ${after?.position}; now playing shows it ${shows}; resumed at ${m?.currentTime?.toFixed(2)}`,
    };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => {
      const after = (await getJson(ctx, PLAYBACK))?.playback;
      const nowPlaying = W(ctx).getByRole("group", { name: "Now Playing" });
      const shows = await until(
        async () => (await nowPlaying.innerText()).includes(titles(ctx)[1]),
        10_000,
      );
      await ctl(ctx, "Play").click();
      const plays = await advancing(ctx);
      const m = await playingMedia(ctx.page);
      const resumed = !!m && m.currentTime >= (ctx.data.playback?.position ?? 99) - 0.5;
      await pauseIfPlaying(ctx);
      return {
        ok:
          shows &&
          plays &&
          resumed &&
          Math.abs((after?.position ?? -1) - (ctx.data.playback?.position ?? -2)) < 1,
        detail: `position ${ctx.data.playback?.position} -> ${after?.position}; resumed at ${m?.currentTime?.toFixed(2)}`,
      };
    },
  },
);
R(
  "isolation.second-account",
  "Music (another account)",
  "isolation",
  "another account",
  "sign up a second account in a new browser context and open Music",
  "it has no songs and no playback of the first account",
  async (ctx) => {
    const other = await ctx.newPage();
    try {
      await createAccount(other.page, ctx.base, person("musicother", ctx.run));
      await openApp(other.page, "Music");
      const theirs = JSON.stringify((await api(other.page, "GET", LIB)).json);
      const shown = await other.page
        .locator('.mac-managed-window[data-window-id="music"]')
        .innerText();
      const leaks = titles(ctx).some((title) => theirs.includes(title) || shown.includes(title));
      return {
        ok: !leaks,
        detail: `server library ${theirs.length} bytes, no first-account title ${!leaks}`,
      };
    } finally {
      await other.context.close();
    }
  },
  { timeout: 90_000 },
);

await censusRun({
  ...app,
  media: "none",
  rows: [...shellRows(app), ...rows],
  states: [
    {
      name: "main",
      enter: async (ctx) => {
        await ensureOpen(ctx);
        await side(ctx, "Songs").click();
        return W(ctx);
      },
    },
    {
      name: "preferences General",
      enter: async (ctx) => {
        const w = await openPrefs(ctx);
        await w.getByRole("tab", { name: "General", exact: true }).first().click();
        return w;
      },
      window: (ctx) => prefsWindow(ctx),
      menus: false,
    },
    {
      name: "preferences Playback",
      enter: async (ctx) => {
        const w = await openPrefs(ctx);
        await w.getByRole("tab", { name: "Playback", exact: true }).first().click();
        return w;
      },
      window: (ctx) => prefsWindow(ctx),
      menus: false,
    },
    {
      name: "preferences Advanced",
      enter: async (ctx) => {
        const w = await openPrefs(ctx);
        await w.getByRole("tab", { name: "Advanced", exact: true }).first().click();
        return w;
      },
      window: (ctx) => prefsWindow(ctx),
      menus: false,
      leave: async (ctx) =>
        prefsWindow(ctx).getByRole("button", { name: "Cancel", exact: true }).first().click(),
    },
    {
      name: "miniplayer",
      enter: async (ctx) => {
        await ensureOpen(ctx);
        if ((await ctl(ctx, "MiniPlayer").getAttribute("aria-pressed")) !== "true")
          await ctl(ctx, "MiniPlayer").click();
        await mini(ctx).waitFor({ timeout: 8_000 });
        return mini(ctx);
      },
      window: (ctx) => mini(ctx),
      menus: false,
      leave: async (ctx) =>
        mini(ctx).getByRole("button", { name: "Close", exact: true }).first().click(),
    },
    {
      name: "up next",
      enter: async (ctx) => {
        await ensureOpen(ctx);
        await ctl(ctx, "Up Next").click();
        return W(ctx);
      },
      menus: false,
      leave: async (ctx) => ctx.page.keyboard.press("Escape"),
    },
    // Audio output is dimmed while nothing plays: a song plays first, and a menu it opens is crawled.
    {
      name: "audio output",
      enter: async (ctx) => {
        await ensureOpen(ctx);
        await playSong(ctx, titles(ctx)[0]);
        await advancing(ctx);
        const b = ctl(ctx, "Audio output");
        if (!(await b.isDisabled())) await b.click();
        return W(ctx);
      },
      window: async (ctx) =>
        (await ctx.page.getByRole("menu").count()) > 0 ? ctx.page.getByRole("menu").last() : W(ctx),
      menus: false,
      leave: async (ctx) => {
        await closeMenus(ctx.page);
        await pauseIfPlaying(ctx);
      },
    },
    {
      name: "archive",
      enter: async (ctx) => {
        await ensureOpen(ctx);
        await side(ctx, "Browse").click();
        return W(ctx);
      },
      menus: false,
    },
  ],
});
