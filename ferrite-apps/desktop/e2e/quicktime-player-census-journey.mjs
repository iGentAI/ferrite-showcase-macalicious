#!/usr/bin/env node
// QuickTime Player census journey (round 3, R7): every control of QuickTime Player, verified with
// real input against a served `ferrite dev`. QuickTime Player is got from the App Store first; it
// opens on its Open panel. A real movie (e2e/fixtures/test-pattern.webm, 12 s) is opened from the
// computer by the file chooser; playback is asserted on the real <video> element; Open Recent and
// resuming at the saved place are checked across a reload and a real restart.

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  api,
  box,
  censusRun,
  chooseMenu,
  closeMenus,
  createAccount,
  editRowsOnField,
  ensureOpen,
  mainWindow,
  menuItemState,
  openApp,
  person,
  shellRows,
  sleep,
  until,
} from "./media-census-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const MOVIE = path.join(here, "fixtures", "test-pattern.webm");
const MOVIE_NAME = "test-pattern.webm";
const RECENTS = "/api/quicktime-player/recents";
const app = {
  slug: "quicktime-player",
  name: "QuickTime Player",
  menus: ["QuickTime Player", "File", "Edit", "View", "Window", "Help"],
  editUnavailable:
    "listed here; quicktime-player.edit.select-all and edit.panel-field prove what the rows do",
  preferences: {
    unavailable: "dimmed in the QuickTime Player menu: QuickTime Player has no preferences",
  },
  crawlIgnore: [/^menu:Apple\|/, /^menu bar\|menuitem\|Apple$/],
  /** After a row: out of the browser's full screen (double-clicking the picture, as a person does), no menu or dialog left open. */
  recover: async (ctx) => {
    if (await ctx.page.evaluate(() => !!document.fullscreenElement).catch(() => false))
      await W(ctx)
        .locator(".mac-quicktime-player-movie")
        .dblclick()
        .catch(() => {});
    await closeMenus(ctx.page);
    for (let n = 0; n < 2 && (await ctx.page.getByRole("menu").count()) > 0; n += 1)
      await ctx.page.keyboard.press("Escape");
    // A pop-up button's list left open by a row.
    for (
      let n = 0;
      n < 2 &&
      (await popupList(ctx.page)
        .isVisible()
        .catch(() => false));
      n += 1
    )
      await ctx.page.keyboard.press("Escape");
  },
};
const W = (ctx) => mainWindow(ctx.page, app);
const video = (ctx) => W(ctx).locator("video").first();
const vstate = (ctx) =>
  video(ctx).evaluate((v) => ({
    t: v.currentTime,
    paused: v.paused,
    ready: v.readyState,
    d: v.duration,
    muted: v.muted,
    volume: v.volume,
  }));
const controls = (ctx) => W(ctx).getByRole("group", { name: "Playback controls" });
// The Open panel lives in QuickTime Player's window: a Finder window behind it has a Recents place,
// Back, Forward and Open buttons of its own.
const panelButton = (ctx, name) => W(ctx).getByRole("button", { name, exact: true }).first();
/** Wake the controller of a playing movie (a real move over the picture). */
async function wake(ctx) {
  const b = await box(W(ctx));
  await ctx.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await ctx.page.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2 + 10, { steps: 3 });
}
/** A place of the Open panel's sidebar, by its tree item. */
const place = (page, name) =>
  page
    .locator(`.mac-managed-window[data-window-id="quicktime-player"]`)
    .getByRole("treeitem", { name, exact: true })
    .first();
/**
 * The list an open pop-up button shows (Location, View): it is rendered outside every window, so
 * a Finder window's lists never answer for it.
 */
const popupList = (page) =>
  page
    .locator('[role="listbox"]:not(.mac-managed-window [role="listbox"])')
    .filter({ visible: true })
    .last();
/** Open the movie from the computer through the Open panel's file chooser. */
async function openMovie(ctx) {
  const { page } = ctx;
  // Cancel on the Open panel closes the window: QuickTime Player is opened again first.
  await ensureOpen(ctx);
  if (await video(ctx).count()) return;
  if (
    !(await panelButton(ctx, "From This Computer…")
      .isVisible()
      .catch(() => false))
  )
    await chooseMenu(page, "File", "Open File…");
  const chooser = page.waitForEvent("filechooser", { timeout: 15_000 });
  await panelButton(ctx, "From This Computer…").click();
  await (await chooser).setFiles(MOVIE);
  await until(
    async () =>
      (await video(ctx)
        .evaluate((v) => v.readyState)
        .catch(() => 0)) >= 2,
    30_000,
  );
}

const rows = [];
const R = (id, state, role, name, how, expected, check, extra = {}) =>
  rows.push({ id: `quicktime-player.${id}`, state, role, name, how, expected, check, ...extra });

R(
  "panel.from-this-computer",
  "Open panel",
  "button",
  "From This Computer…",
  "click From This Computer… and choose test-pattern.webm in the file chooser",
  "the movie opens in QuickTime Player's window, named after it, its <video> ready (readyState >= 2), and is kept in Movies on the drive",
  async (ctx) => {
    await ensureOpen(ctx);
    await openMovie(ctx);
    const named =
      (await W(ctx)
        .getAttribute("aria-label")
        .catch(() => "")) ?? "";
    const s = await vstate(ctx);
    const drive = ((await api(ctx.page, "GET", "/api/files/")).json?.entries ?? []).some((e) =>
      e.name?.startsWith("test-pattern"),
    );
    return {
      ok: s.ready >= 2 && Math.abs(s.d - 12) < 1 && drive,
      detail: `${named} ${JSON.stringify(s)} drive ${drive}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "controls.play",
  "movie",
  "button",
  "Play",
  "click Play in the controller",
  "the <video> plays: paused false, currentTime moves",
  async (ctx) => {
    await openMovie(ctx);
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Play", exact: true }).click();
    const ok = await until(async () => {
      const s = await vstate(ctx);
      return !s.paused && s.t > 0.3;
    }, 8_000);
    return { ok, detail: JSON.stringify(await vstate(ctx)) };
  },
);
R(
  "controls.pause",
  "movie",
  "button",
  "Pause",
  "while playing, Pause",
  "the <video> pauses; currentTime stands still",
  async (ctx) => {
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Pause", exact: true }).click();
    const a = await vstate(ctx);
    await sleep(700);
    const b = await vstate(ctx);
    return { ok: a.paused && Math.abs(b.t - a.t) < 0.05, detail: `${a.t} -> ${b.t}` };
  },
);
R(
  "controls.timeline",
  "movie",
  "slider",
  "Timeline",
  "focus the Timeline, Page Up, then Home",
  "the movie moves on 10 s, then back to its start",
  async (ctx) => {
    await openMovie(ctx);
    await wake(ctx);
    await controls(ctx).getByRole("slider", { name: "Timeline" }).focus();
    await ctx.page.keyboard.press("PageUp");
    const on = await until(async () => (await vstate(ctx)).t >= 9.5, 3_000);
    await ctx.page.keyboard.press("Home");
    const back = await until(async () => (await vstate(ctx)).t < 0.5, 3_000);
    return { ok: on && back, detail: JSON.stringify(await vstate(ctx)) };
  },
);
R(
  "controls.mute",
  "movie",
  "button",
  "Mute",
  "click Mute",
  "the <video> is muted (volume 0)",
  async (ctx) => {
    await openMovie(ctx);
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Mute" }).click();
    const s = await vstate(ctx);
    return { ok: s.muted === true || s.volume === 0, detail: JSON.stringify(s) };
  },
);
R(
  "controls.full-volume",
  "movie",
  "button",
  "Full Volume",
  "click Full Volume",
  "the <video> is unmuted at volume 1",
  async (ctx) => {
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Full Volume" }).click();
    const s = await vstate(ctx);
    return { ok: s.muted === false && s.volume === 1, detail: JSON.stringify(s) };
  },
);
R(
  "controls.picture-in-picture",
  "movie",
  "button",
  "Picture in Picture",
  "play, click Picture in Picture, then (moving onto it) click it again",
  "the movie floats (the browser's own Picture in Picture window where it has one, else the floating window in the desktop), and comes back",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await wake(ctx);
    await controls(ctx)
      .getByRole("button", { name: "Play", exact: true })
      .click()
      .catch(() => {});
    const pip = controls(ctx).getByRole("button", { name: "Picture in Picture" });
    await pip.click();
    const floating = await page
      .waitForFunction(
        () =>
          document.pictureInPictureElement
            ? "browser"
            : document.querySelector(".mac-picture-in-picture canvas.mac-quicktime-player-mirror")
              ? "desktop"
              : null,
        null,
        { timeout: 10_000 },
      )
      .then((h) => h.jsonValue())
      .catch(() => null);
    const at = await box(pip);
    await page.mouse.move(at.x + at.width / 2, at.y - 80);
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2, { steps: 5 });
    await sleep(400);
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    const back = await page
      .waitForFunction(
        () =>
          !document.pictureInPictureElement &&
          !document.querySelector(".mac-picture-in-picture canvas.mac-quicktime-player-mirror"),
        null,
        { timeout: 10_000 },
      )
      .then(
        () => true,
        () => false,
      );
    await controls(ctx)
      .getByRole("button", { name: "Pause", exact: true })
      .click()
      .catch(() => {});
    return { ok: floating !== null && back, detail: `${floating}, back ${back}` };
  },
);
R(
  "movie.double-click",
  "movie",
  "shortcut",
  "double-click the picture",
  "double-click the movie's picture, then double-click it again",
  "the movie fills the screen (the browser's full screen); the second double-click brings it back to its window",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    const movie = W(ctx).locator(".mac-quicktime-player-movie");
    await movie.dblclick();
    const full = await page
      .waitForFunction(
        () => document.fullscreenElement?.classList.contains("mac-quicktime-player") ?? false,
        null,
        { timeout: 5_000 },
      )
      .then(
        () => true,
        () => false,
      );
    await sleep(500);
    await movie.dblclick();
    const left = await page
      .waitForFunction(() => !document.fullscreenElement, null, { timeout: 5_000 })
      .then(
        () => true,
        () => false,
      );
    return { ok: full && left, detail: `full ${full}, left ${left}` };
  },
);
R(
  "resume.saved-place",
  "movie",
  "behaviour",
  "resume at the saved place",
  "from the start (Timeline: Home), play 4.5 s and pause, close the window, File > Open Recent > the movie",
  "it opens again at the saved place (the paused place in whole seconds, about 4 s), kept on the server's Recents; a place within 5 s of the end would be kept as the start, by design (RECENT_FINISHED_WITHIN)",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await wake(ctx);
    const t = controls(ctx).getByRole("slider", { name: "Timeline" });
    await t.focus();
    await page.keyboard.press("Home");
    // The Timeline's arrow keys step single frames: the place is reached by playing from the start
    // and pausing (a paused place is kept exactly, in whole seconds).
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Play", exact: true }).click();
    await sleep(4500);
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Pause", exact: true }).click();
    await sleep(1500);
    const saved = (await vstate(ctx)).t;
    ctx.data.saved = saved;
    await chooseMenu(page, "File", "Close Window");
    await until(async () => !(await W(ctx).isVisible()), 5_000);
    await ensureOpen(ctx);
    await chooseMenu(page, "File", "Open Recent", MOVIE_NAME);
    ctx.data.recentListed = true;
    const ready = await until(
      async () => (await vstate(ctx).catch(() => ({ ready: 0 }))).ready >= 1,
      15_000,
    );
    const at = ready ? (await vstate(ctx)).t : -1;
    const recents = JSON.stringify((await api(page, "GET", RECENTS)).json);
    ctx.data.recentOpened = ready && Math.abs(at - saved) < 1.2;
    return {
      ok:
        ready &&
        Math.abs(at - saved) < 1.2 &&
        saved > 1 &&
        saved < 7 &&
        recents.includes("test-pattern"),
      detail: `saved ${saved.toFixed(2)}, reopened at ${at.toFixed(2)}`,
    };
  },
  {
    persists: "restart",
    timeout: 90_000,
    restartCheck: async (ctx) => {
      await ensureOpen(ctx);
      await chooseMenu(ctx.page, "File", "Open Recent", MOVIE_NAME);
      const ready = await until(
        async () => (await vstate(ctx).catch(() => ({ ready: 0 }))).ready >= 1,
        20_000,
      );
      const at = ready ? (await vstate(ctx)).t : -1;
      return {
        ok: ready && Math.abs(at - (ctx.data.saved ?? 0)) < 1.2,
        detail: `saved ${ctx.data.saved}, after restart ${at}`,
      };
    },
  },
);
R(
  "menu.file.open-recent",
  "menu:File",
  "menuitem",
  "Open Recent",
  "File > Open Recent",
  "the submenu lists the movie opened before (seen during quicktime-player.resume.saved-place, whose choice of it from the submenu succeeded)",
  async (ctx) => ({
    ok: ctx.data.recentListed === true,
    detail: `listed ${ctx.data.recentListed}`,
  }),
);
R(
  "menu.file.open-recent.movie",
  "menu:File > Open Recent",
  "menuitem",
  MOVIE_NAME,
  "File > Open Recent > test-pattern.webm",
  "the movie opens again at its saved place (seen during quicktime-player.resume.saved-place)",
  async (ctx) => ({
    ok: ctx.data.recentOpened === true,
    detail: `opened at the saved place ${ctx.data.recentOpened}`,
  }),
);
R(
  "menu.file.open-file",
  "menu:File",
  "menuitem",
  "Open File…",
  "File > Open File…",
  "the Open panel shows, offering From This Computer… and the drive's Movies",
  async (ctx) => {
    await ensureOpen(ctx);
    await chooseMenu(ctx.page, "File", "Open File…");
    const ok = await until(() => panelButton(ctx, "From This Computer…").isVisible(), 8_000);
    return { ok };
  },
);
R(
  "panel.movies-option",
  "Open panel",
  "option",
  "/test-pattern( \\d+)?\\.webm/",
  "in the Open panel's Movies, click the movie, then Open",
  "the movie opens from the drive",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    if (
      !(await panelButton(ctx, "From This Computer…")
        .isVisible()
        .catch(() => false))
    )
      await chooseMenu(page, "File", "Open File…");
    await place(page, "Movies").click();
    const sidebarSelected = await until(
      async () => (await place(page, "Movies").getAttribute("aria-selected")) === "true",
      3_000,
    );
    const listbox = page.getByRole("listbox", { name: "Movies" }).first();
    await listbox
      .getByRole("option", { name: /test-pattern\.webm/ })
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => {});
    const listed = await listbox
      .getByRole("option", { name: /test-pattern\.webm/ })
      .count()
      .catch(() => 0);
    await W(ctx)
      .getByRole("option", { name: /test-pattern\.webm/ })
      .first()
      .click();
    await panelButton(ctx, "Open").click();
    const ok = await until(
      async () => (await vstate(ctx).catch(() => ({ ready: 0 }))).ready >= 1,
      15_000,
    );
    // The panel's sidebar, file list and Open button are census rows of their own; each reads what this step saw.
    ctx.data.panel = { sidebarSelected, listed, opened: ok };
    return { ok, detail: JSON.stringify(ctx.data.panel) };
  },
  { notes: "kind: a movie of the Open panel's file list" },
);
R(
  "panel.movies-listbox",
  "Open panel",
  "listbox",
  "/(Movies|Recents)/",
  "the Open panel's file list, with Movies chosen",
  "lists the drive's movies (the census movie seen in it during quicktime-player.panel.movies-option); the list is named after the place shown",
  async (ctx) => ({
    ok: (ctx.data.panel?.listed ?? 0) > 0,
    detail: JSON.stringify(ctx.data.panel ?? null),
  }),
);
R(
  "panel.sidebar-movies",
  "Open panel",
  "treeitem",
  "Movies",
  "click Movies in the panel's sidebar",
  "Movies is selected (seen during quicktime-player.panel.movies-option)",
  async (ctx) => ({
    ok: ctx.data.panel?.sidebarSelected === true,
    detail: JSON.stringify(ctx.data.panel ?? null),
  }),
);
R(
  "panel.sidebar-recents",
  "Open panel",
  "treeitem",
  "Recents",
  "click Recents in the panel's sidebar",
  "the list shows the recently opened movie",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    if (
      !(await panelButton(ctx, "From This Computer…")
        .isVisible()
        .catch(() => false))
    )
      await chooseMenu(page, "File", "Open File…");
    await place(page, "Recents").click();
    const ok = await until(
      async () =>
        (await W(ctx)
          .getByRole("option", { name: /test-pattern/ })
          .count()) > 0,
      5_000,
    );
    return { ok };
  },
);
R(
  "panel.cancel",
  "Open panel",
  "button",
  "Cancel",
  "File > Open File…, Cancel",
  "the Open panel closes and nothing opens",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    if (
      !(await panelButton(ctx, "From This Computer…")
        .isVisible()
        .catch(() => false))
    )
      await chooseMenu(page, "File", "Open File…");
    await panelButton(ctx, "Cancel").click();
    const ok = await until(
      async () =>
        !(await panelButton(ctx, "From This Computer…")
          .isVisible()
          .catch(() => false)),
      5_000,
    );
    return { ok };
  },
);
R(
  "panel.open",
  "Open panel",
  "button",
  "Open",
  "select a movie, Open",
  "the selected movie opens (seen during quicktime-player.panel.movies-option)",
  async (ctx) => ({
    ok: ctx.data.panel?.opened === true,
    detail: JSON.stringify(ctx.data.panel ?? null),
  }),
);
R(
  "panel.search",
  "Open panel",
  "searchbox",
  "Search",
  'type "test", then a word no file has',
  "the list narrows to the movie, then to none",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    if (
      !(await panelButton(ctx, "From This Computer…")
        .isVisible()
        .catch(() => false))
    )
      await chooseMenu(page, "File", "Open File…");
    await place(page, "Movies").click();
    const field = W(ctx).getByRole("searchbox", { name: "Search" }).first();
    await field.fill("test");
    await field.press("Enter");
    const one = await until(
      async () =>
        (await W(ctx)
          .getByRole("option", { name: /test-pattern/ })
          .count()) > 0,
      5_000,
    );
    await field.fill(`zz${ctx.run}`);
    await field.press("Enter");
    const none = await until(
      async () =>
        (await W(ctx)
          .getByRole("option", { name: /test-pattern/ })
          .count()) === 0,
      5_000,
    );
    await field.fill("");
    return { ok: one && none, detail: `one ${one}, none ${none}` };
  },
);
for (const name of ["Back", "Forward"]) {
  R(
    `panel.${name.toLowerCase()}`,
    "Open panel",
    "button",
    name,
    `in the panel, open Movies then Recents, click ${name}`,
    `the panel goes ${name.toLowerCase()} through the places visited (or is dimmed with nowhere to go)`,
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      if (
        !(await panelButton(ctx, "From This Computer…")
          .isVisible()
          .catch(() => false))
      )
        await chooseMenu(page, "File", "Open File…");
      await place(page, "Movies").click();
      await place(page, "Recents").click();
      if (name === "Forward") {
        const back = panelButton(ctx, "Back");
        if (await back.isEnabled().catch(() => false)) await back.click();
      }
      const b = panelButton(ctx, name);
      if (await b.isDisabled()) {
        // Dimmed passes only with its reason shown to the person.
        const reason = ((await b.getAttribute("title")) ?? "").trim();
        return {
          ok: reason.length > 0,
          unavailable: `dimmed: ${reason}`,
          detail: `dimmed after visiting Movies then Recents; reason shown "${reason}"`,
        };
      }
      await b.click();
      const where = name === "Back" ? "Movies" : "Recents";
      const ok = await until(
        async () =>
          (
            await W(ctx)
              .getByRole("combobox", { name: "Location" })
              .first()
              .textContent()
              .catch(() => "")
          )?.includes(where),
        5_000,
      );
      return {
        ok,
        detail: await W(ctx)
          .getByRole("combobox", { name: "Location" })
          .first()
          .textContent()
          .catch(() => ""),
      };
    },
  );
}
R(
  "panel.location",
  "Open panel",
  "combobox",
  "Location",
  "open the Location pop-up and choose another place",
  "the panel shows the chosen place",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    if (
      !(await panelButton(ctx, "From This Computer…")
        .isVisible()
        .catch(() => false))
    )
      await chooseMenu(page, "File", "Open File…");
    const loc = W(ctx).getByRole("combobox", { name: "Location" }).first();
    const before = await loc.textContent();
    // A pop-up list left open by an earlier row is closed first.
    for (let n = 0; n < 2 && (await popupList(page).count()) > 0; n += 1)
      await page.keyboard.press("Escape");
    await loc.click();
    // The pop-up's own choices, by their names (whatever role the pop-up gives them), never the
    // menu bar's items or the panel's file list.
    const choices = popupList(page).getByRole("option");
    await choices.first().waitFor({ timeout: 3_000 });
    const names = await choices.evaluateAll((c) =>
      c.map((e) => e.textContent.trim()).filter(Boolean),
    );
    const other = names.find((n) => n !== before?.trim());
    if (other) await choices.filter({ hasText: other }).first().click();
    else await page.keyboard.press("Escape");
    await until(async () => (await loc.textContent()) !== before, 3_000);
    const after = await loc.textContent();
    return {
      ok: !!other && after !== before,
      detail: `${before} -> ${after} of ${names.join(", ")}`,
    };
  },
);
R(
  "panel.view",
  "Open panel",
  "combobox",
  "View",
  "open the View pop-up and choose another view",
  "the file list shows the chosen view",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    if (
      !(await panelButton(ctx, "From This Computer…")
        .isVisible()
        .catch(() => false))
    )
      await chooseMenu(page, "File", "Open File…");
    const view = W(ctx).getByRole("combobox", { name: "View" }).first();
    const before = await view.textContent();
    // A pop-up list left open by an earlier row is closed first, and fades before it goes.
    for (let n = 0; n < 2 && (await popupList(page).count()) > 0; n += 1)
      await page.keyboard.press("Escape");
    await until(async () => (await popupList(page).count()) === 0, 2_000);
    await view.click();
    const choices = popupList(page).getByRole("option");
    await choices.first().waitFor({ timeout: 3_000 });
    const names = await choices.evaluateAll((c) =>
      c.map((e) => e.textContent.trim()).filter(Boolean),
    );
    const other = names.find((n) => n !== before?.trim());
    if (other) {
      // Chosen by keyboard, as a person may: the next view down (or up from the last), then Return.
      const at = names.indexOf(before?.trim() ?? "");
      await page.keyboard.press(at >= 0 && at < names.length - 1 ? "ArrowDown" : "ArrowUp");
      await page.keyboard.press("Enter");
    } else await page.keyboard.press("Escape");
    await until(async () => (await view.textContent()) !== before, 3_000);
    const after = await view.textContent();
    // Later rows read the list, as a new window shows it.
    await view.click();
    await popupList(page).getByRole("option", { name: "as List" }).click();
    return {
      ok: !!other && after !== before,
      detail: `${before} -> ${after} of ${names.join(", ")}`,
    };
  },
);
/** Put the movie at `at` seconds through the Timeline (Home, then Page Up for 10 s), paused. */
async function seek(ctx, tenSeconds) {
  await openMovie(ctx);
  await wake(ctx);
  const pause = controls(ctx).getByRole("button", { name: "Pause", exact: true });
  if (await pause.isVisible().catch(() => false)) await pause.click();
  await controls(ctx).getByRole("slider", { name: "Timeline" }).focus();
  await ctx.page.keyboard.press("Home");
  if (tenSeconds) await ctx.page.keyboard.press("PageUp");
  await sleep(300);
}
/** Stop a running movie: its Pause, wherever the controller shows it. */
async function stop(ctx) {
  await wake(ctx);
  await W(ctx)
    .getByRole("button", { name: "Pause", exact: true })
    .first()
    .click({ timeout: 3_000 })
    .catch(() => {});
}
R(
  "controls.volume",
  "movie",
  "slider",
  "Volume",
  "focus the controller's Volume, press Home, then End",
  "the <video>'s volume goes to 0 (or it is muted), then to 1 unmuted",
  async (ctx) => {
    await openMovie(ctx);
    await wake(ctx);
    const volume = W(ctx).getByRole("slider", { name: "Volume" }).first();
    await volume.focus();
    await ctx.page.keyboard.press("Home");
    const low = await until(async () => {
      const s = await vstate(ctx);
      return s.volume === 0 || s.muted;
    }, 3_000);
    await ctx.page.keyboard.press("End");
    const high = await until(async () => {
      const s = await vstate(ctx);
      return s.volume === 1 && !s.muted;
    }, 3_000);
    return {
      ok: low && high,
      detail: `low ${low}, high ${high}; ${JSON.stringify(await vstate(ctx))}`,
    };
  },
);
R(
  "controls.fast-forward",
  "movie",
  "button",
  "Fast Forward",
  "from the start, click Fast Forward, wait 1.5 s, Pause",
  "the movie runs faster than real time (at least 1.5×)",
  async (ctx) => {
    await seek(ctx, false);
    await wake(ctx);
    await W(ctx).getByRole("button", { name: "Fast Forward" }).first().click();
    // Measured once the movie runs (the first press starts a paused movie).
    const start = (await vstate(ctx)).t;
    await until(async () => (await vstate(ctx)).t > start + 0.05, 4_000);
    const t0 = (await vstate(ctx)).t;
    const started = Date.now();
    await sleep(1500);
    const t1 = (await vstate(ctx)).t;
    const real = (Date.now() - started) / 1000;
    await stop(ctx);
    return {
      ok: t1 - t0 > real * 1.5,
      detail: `${t0.toFixed(2)} -> ${t1.toFixed(2)} s in ${real.toFixed(1)} s`,
    };
  },
);
R(
  "controls.rewind",
  "movie",
  "button",
  "Rewind",
  "from 10 s, click Rewind, wait 1.5 s, Pause",
  "the movie runs backwards: its time falls",
  async (ctx) => {
    await seek(ctx, true);
    await wake(ctx);
    const t0 = (await vstate(ctx)).t;
    await W(ctx).getByRole("button", { name: "Rewind" }).first().click();
    await sleep(1500);
    const t1 = (await vstate(ctx)).t;
    await stop(ctx);
    return { ok: t0 > 5 && t1 < t0 - 0.5, detail: `${t0.toFixed(2)} -> ${t1.toFixed(2)} s` };
  },
);
R(
  "controls.airplay",
  "movie",
  "button",
  "AirPlay",
  "click AirPlay on the controller",
  "the browser's own screen picker opens where the browser has one; elsewhere the button is dimmed and says why",
  async (ctx) => {
    await openMovie(ctx);
    await wake(ctx);
    const airplay = W(ctx).getByRole("button", { name: "AirPlay" }).first();
    const dimmed =
      (await airplay.getAttribute("aria-disabled")) === "true" || (await airplay.isDisabled());
    const reason = ((await airplay.getAttribute("title")) ?? "").trim();
    if (dimmed)
      return {
        ok: reason.length > 0,
        unavailable: `dimmed: ${reason}`,
        detail: `dimmed; reason shown "${reason}"`,
      };
    await airplay.click();
    const menu = ctx.page.getByRole("menu").last();
    const shown = await menu.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    );
    const items = shown ? (await menu.innerText()).replace(/\s+/g, " ") : "";
    await ctx.page.keyboard.press("Escape");
    if (!shown) {
      // The browser's picker found no screen: the button dims, saying so.
      const after = ((await airplay.getAttribute("title")) ?? "").trim();
      const dimmedNow =
        (await airplay.getAttribute("aria-disabled")) === "true" || (await airplay.isDisabled());
      return {
        ok: dimmedNow && after.length > 0,
        unavailable: `dimmed after the picker found no screen: ${after}`,
        detail: `no picker; dimmed ${dimmedNow}, reason "${after}"`,
      };
    }
    // No invented device: only real screens the browser offers.
    return { ok: !/Living Room/.test(items), detail: items.slice(0, 120) };
  },
);
const SERVICES = ["Mail", "Messages", "AirDrop", "Notes"];
R(
  "controls.share",
  "movie",
  "button",
  "Share",
  "click Share on the controller",
  "the Share menu opens listing Mail, Messages, AirDrop and Notes (the sharing itself is R5's census of the Share menus)",
  async (ctx) => {
    await openMovie(ctx);
    await wake(ctx);
    await W(ctx).getByRole("button", { name: "Share" }).first().click();
    const menu = ctx.page.getByRole("menu").last();
    await menu.waitFor({ timeout: 5_000 });
    const items = await menu
      .getByRole("menuitem")
      .evaluateAll((all) =>
        all.map(
          (e) =>
            `${e.textContent.trim()}${e.getAttribute("aria-disabled") === "true" ? " (dimmed)" : ""}`,
        ),
      );
    await ctx.page.keyboard.press("Escape");
    return {
      ok: SERVICES.every((s) => items.some((i) => i.startsWith(s))),
      detail: items.join(", "),
    };
  },
);
R(
  "share.service",
  "share menu",
  "menuitem",
  `/(${SERVICES.join("|")})/`,
  "open the controller's Share menu",
  "each service can be chosen, or is dimmed with its reason as its title (AirDrop needs nearby devices)",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await wake(ctx);
    await W(ctx).getByRole("button", { name: "Share" }).first().click();
    const menu = page.getByRole("menu").last();
    await menu.waitFor({ timeout: 5_000 });
    const out = [];
    for (const service of SERVICES) {
      const item = menu.getByRole("menuitem", { name: service }).first();
      const dimmed = (await item.getAttribute("aria-disabled")) === "true";
      const reason = ((await item.getAttribute("title")) ?? "").trim();
      out.push(`${service}: ${!dimmed ? "can be chosen" : reason || "NOT dimmed with a reason"}`);
    }
    await page.keyboard.press("Escape");
    return {
      ok: out.every((x) => !x.endsWith("NOT dimmed with a reason")),
      detail: out.join("; "),
    };
  },
  { notes: "kind: a service of the Share menu (each one checked)", timeout: 90_000 },
);
R(
  "panel.place",
  "Location pop-up",
  "option",
  "/(Movies|Recents)/",
  "open the Open panel's Location pop-up and choose Recents, then again and choose Movies",
  "the pop-up names each choice, the sidebar's Places selects it, and the file list follows (it lists the movie in both)",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    if (
      !(await panelButton(ctx, "From This Computer…")
        .isVisible()
        .catch(() => false))
    )
      await chooseMenu(page, "File", "Open File…");
    const loc = W(ctx).getByRole("combobox", { name: "Location" }).first();
    const out = [];
    for (const name of ["Recents", "Movies"]) {
      // A pop-up list left open by an earlier row is closed first.
      for (let n = 0; n < 2 && (await popupList(page).count()) > 0; n += 1)
        await page.keyboard.press("Escape");
      await loc.click();
      await popupList(page).getByRole("option", { name, exact: true }).click();
      const shown = await until(
        async () => ((await loc.textContent()) ?? "").includes(name),
        3_000,
      );
      const selected = await until(
        async () => (await place(page, name).getAttribute("aria-selected")) === "true",
        3_000,
      );
      const lists = await until(
        async () =>
          (await W(ctx)
            .getByRole("option", { name: /test-pattern/ })
            .count()) > 0,
        5_000,
      );
      out.push(`${name}: shown ${shown}, selected ${selected}, lists ${lists}`);
    }
    ctx.data.places = out.every((x) => !x.includes("false"));
    return { ok: ctx.data.places, detail: out.join("; ") };
  },
  { notes: "kind: a place of the Location pop-up's list" },
);
R(
  "panel.places",
  "Location pop-up",
  "listbox",
  "",
  "the Location pop-up's list of places (it has no accessible name)",
  "lists Movies and Recents, each choosing what the panel shows (performed by quicktime-player.panel.place)",
  async (ctx) => ({ ok: ctx.data.places === true, detail: `places chosen ${ctx.data.places}` }),
  { notes: "the pop-up's listbox has no accessible name: an accessibility gap to name" },
);
R(
  "edit.select-all",
  "movie",
  "menuitem",
  "Select All",
  "open the movie, Edit > Select All, read Cut's state, Edit > Copy, Edit > Paste, wait for the replay, Edit > Undo, Done in the strip",
  "the strip opens with every clip chosen; Cut is dimmed, since a movie keeps one clip; the pasted copy of the whole movie doubles its length, and Undo brings the movie back",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    const before = (await vstate(ctx)).d;
    await chooseMenu(page, "Edit", "Select All");
    const clips = W(ctx).getByRole("button", { name: /^Clip \d+ of \d+/ });
    await clips.first().waitFor({ timeout: 5_000 });
    const pressed = await clips.evaluateAll((list) =>
      list.every((each) => each.getAttribute("aria-pressed") === "true"),
    );
    const cut = await menuItemState(page, "Edit", "Cut");
    await chooseMenu(page, "Edit", "Copy");
    await chooseMenu(page, "Edit", "Paste");
    const doubled = await until(async () => (await vstate(ctx)).d > before * 1.8, 90_000);
    const twice = (await vstate(ctx)).d;
    await chooseMenu(page, "Edit", "Undo");
    const back = await until(async () => Math.abs((await vstate(ctx)).d - before) < 1, 15_000);
    await W(ctx).getByRole("button", { name: "Done", exact: true }).click();
    return {
      ok: pressed && cut.disabled && /at least one clip/.test(cut.title ?? "") && doubled && back,
      detail: `every clip chosen ${pressed}; Cut ${JSON.stringify(cut)}; ${before} -> ${twice} -> ${(await vstate(ctx)).d}`,
    };
  },
  { timeout: 150_000 },
);
R(
  "edit.panel-field",
  "Open panel",
  "menuitem",
  "Undo, Redo, Cut, Copy, Paste, Select All",
  "File > Open File…, type in the panel's search field, then each of Select All, Cut, Paste, Select All, Copy, Paste, Undo, Redo from the Edit menu",
  "each acts on the search field's text, read back from the field",
  async (ctx) => {
    await openMovie(ctx);
    await chooseMenu(ctx.page, "File", "Open File…");
    return editRowsOnField(
      ctx.page,
      W(ctx).getByRole("searchbox"),
      W(ctx).getByRole("status").filter({ hasText: "Command-V" }),
    );
  },
);
R(
  "isolation.second-account",
  "another account",
  "account",
  "second account",
  "sign up a second account in a new browser context",
  "its QuickTime Recents and drive hold nothing of the first account's",
  async (ctx) => {
    const other = await ctx.newPage();
    try {
      await createAccount(other.page, ctx.base, person("qtother", ctx.run));
      const rec = JSON.stringify((await api(other.page, "GET", RECENTS)).json);
      const drive = ((await api(other.page, "GET", "/api/files/")).json?.entries ?? []).some((e) =>
        e.name?.startsWith("test-pattern"),
      );
      return { ok: !rec.includes("test-pattern") && !drive, detail: rec.slice(0, 120) };
    } finally {
      await other.context.close();
    }
  },
);

/*
 * The rows built after the first census, run with `--only rows.`. Each drives the real desktop with real
 * input and reads the result back from the element, the drive or the person's settings.
 */
const rowsPanel = async (ctx) => {
  await ensureOpen(ctx);
  if (
    !(await panelButton(ctx, "From This Computer…")
      .isVisible()
      .catch(() => false))
  ) {
    await openMovie(ctx);
    await chooseMenu(ctx.page, "File", "Open File…");
  }
};
/** Waits until no replay or reading is under way in the window. */
const rowsSettled = (ctx) =>
  until(async () => (await W(ctx).getByRole("progressbar").count()) === 0, 40_000);
const rowsShot = (ctx, name) =>
  ctx.page
    .screenshot({ path: path.join(process.env.QT_SHOTS ?? "/tmp", `${name}.png`) })
    .catch(() => {});
const driveNames = async (ctx) =>
  ((await api(ctx.page, "GET", "/api/files/")).json?.entries ?? []).map((each) => each.name);

R(
  "rows.sidebar-folders",
  "Open panel",
  "treeitem",
  "Documents",
  "click Documents in the sidebar, then Movies",
  "the sidebar lists the drive's folders; the list is named after the folder chosen",
  async (ctx) => {
    await rowsPanel(ctx);
    const before = await place(ctx.page, "Downloads").isVisible();
    await place(ctx.page, "Documents").click();
    const documents = await until(
      () =>
        W(ctx)
          .getByRole("listbox", { name: "Documents" })
          .isVisible()
          .catch(() => false),
      5_000,
    );
    await rowsShot(ctx, "open-sidebar");
    await place(ctx.page, "Movies").click();
    return { ok: before && documents, detail: `Downloads ${before}, Documents ${documents}` };
  },
  { timeout: 90_000 },
);
R(
  "rows.list-columns",
  "Open panel",
  "listbox",
  "Movies",
  "look at the Movies list, then choose as Icons from the View pop-up and go back",
  "Name, Date Modified and Size head the list, a row has its size; as Icons has no columns and the same movie",
  async (ctx) => {
    await openMovie(ctx);
    await rowsPanel(ctx);
    const row = W(ctx)
      .getByRole("option", { name: /test-pattern/ })
      .first();
    await row.waitFor({ timeout: 10_000 });
    const text = await row.textContent();
    const heading = await W(ctx).getByText("Date Modified").isVisible();
    const nameBox = await box(row.locator(".mac-list-view-row-title"));
    const headingBox = await box(W(ctx).getByText("Date Modified"));
    const dateBox = await box(row.locator("span[aria-hidden]").first());
    const lined = nameBox.width > 40 && Math.abs(dateBox.x - headingBox.x) < 2;
    const view = W(ctx).getByRole("combobox", { name: "View" }).first();
    await rowsShot(ctx, "open-columns");
    await view.click();
    await popupList(ctx.page).getByRole("option", { name: "as Icons" }).click();
    const gone = await until(
      async () => (await W(ctx).getByText("Date Modified").count()) === 0,
      3_000,
    );
    const icon = await W(ctx)
      .getByRole("option", { name: /test-pattern/ })
      .count();
    await rowsShot(ctx, "open-icons");
    await view.click();
    await popupList(ctx.page).getByRole("option", { name: "as Columns" }).click();
    await W(ctx)
      .getByRole("option", { name: /test-pattern/ })
      .first()
      .click();
    const columnFacts = await until(
      () =>
        W(ctx)
          .locator(".mac-quicktime-player-preview")
          .first()
          .isVisible()
          .catch(() => false),
      3_000,
    );
    await view.click();
    await popupList(ctx.page).getByRole("option", { name: "as Gallery" }).click();
    const galleryRow = await until(
      async () =>
        (await W(ctx)
          .getByRole("option", { name: /test-pattern/ })
          .count()) > 0,
      3_000,
    );
    await view.click();
    await popupList(ctx.page).getByRole("option", { name: "as List" }).click();
    return {
      ok:
        heading &&
        lined &&
        /\d+(\.\d+)? (KB|MB|bytes)/.test(text ?? "") &&
        gone &&
        icon > 0 &&
        columnFacts &&
        galleryRow,
      detail: `${text} heading ${heading} name ${nameBox.width} date ${dateBox.x} under ${headingBox.x} icons ${icon} columns ${columnFacts} gallery ${galleryRow}`,
    };
  },
);
R(
  "rows.several-movies",
  "Open panel",
  "button",
  "Open",
  "File > Duplicate makes a second movie; in the Open window click one, Command-click the other, Open; then View > Play All Movies",
  "each opens in a window of its own, and both play",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await chooseMenu(page, "File", "Duplicate");
    await until(async () => (await driveNames(ctx)).some((name) => /copy/.test(name)), 10_000);
    await rowsSettled(ctx);
    await chooseMenu(page, "File", "Open File…");
    const options = W(ctx).getByRole("option", { name: /test-pattern/ });
    await until(async () => (await options.count()) >= 2, 10_000);
    await options.nth(0).click();
    await options.nth(1).click({ modifiers: ["Meta"] });
    await panelButton(ctx, "Open").click();
    const windows = page.locator(".mac-quicktime-player");
    const two = await until(async () => (await windows.count()) === 2, 20_000);
    await until(
      async () =>
        (await page
          .locator(".mac-quicktime-player video")
          .evaluateAll((all) => all.every((v) => v.readyState >= 1))) === true,
      15_000,
    );
    await rowsShot(ctx, "several-movies");
    await chooseMenu(page, "View", "Play All Movies");
    const playing = await until(
      () =>
        page
          .locator(".mac-quicktime-player video")
          .evaluateAll(
            (all) => all.length === 2 && all.every((v) => !v.paused && v.currentTime > 0),
          ),
      8_000,
    );
    await page.locator(".mac-quicktime-player video").evaluateAll((all) => {
      for (const each of all) each.pause();
    });
    const second = page.locator('.mac-managed-window[data-window-id="quicktime-player:2"]');
    const named = await second.count();
    await second
      .getByRole("button", { name: "Close" })
      .click({ force: true })
      .catch(() => {});
    return { ok: two && playing, detail: `two ${two} playing ${playing} second window ${named}` };
  },
  { timeout: 120_000 },
);
R(
  "rows.reload",
  "movie",
  "button",
  "Mute",
  "with a movie open, press Mute and reload the page",
  "the window comes back showing the same movie, silent; Full Volume then gives the sound back",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Mute" }).click();
    const label = await W(ctx).getAttribute("aria-label");
    await sleep(1_500);
    await page.reload({ waitUntil: "load" });
    await page.getByRole("toolbar", { name: "Dock" }).waitFor({ timeout: 30_000 });
    const back = await until(
      async () =>
        (await video(ctx)
          .evaluate((v) => v.readyState)
          .catch(() => 0)) >= 1,
      25_000,
    );
    const s = back ? await vstate(ctx) : null;
    await rowsShot(ctx, "after-reload");
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Full Volume" }).click();
    return {
      ok: back && s?.volume === 0,
      detail: `${label} -> ${await W(ctx).getAttribute("aria-label")} ${JSON.stringify(s)}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "rows.title-menu",
  "movie",
  "button",
  "/test-pattern/",
  "click the title in the title bar",
  "a menu with Rename…, Move To…, Duplicate and a Browse All Versions… that says what it does in its title opens under it",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await wake(ctx);
    await W(ctx)
      .getByRole("button", { name: /test-pattern/ })
      .first()
      .click();
    const menu = page.getByRole("menu", { name: "Document" });
    await menu.waitFor({ timeout: 5_000 });
    const rename = await menu.getByRole("menuitem", { name: "Rename…" }).isVisible();
    const versions = await menu
      .getByRole("menuitem", { name: "Browse All Versions…" })
      .getAttribute("title");
    await rowsShot(ctx, "title-menu");
    await page.keyboard.press("Escape");
    return { ok: rename && !!versions, detail: `${rename} ${versions}` };
  },
);
R(
  "rows.proxy-drag",
  "movie",
  "image",
  "proxy icon",
  "drag the title bar's proxy icon onto the desktop",
  "the movie's file goes to the Desktop folder of the drive, and the window does not move",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await wake(ctx);
    const before = await box(W(ctx));
    const grip = await box(W(ctx).locator("[data-proxy-drag]"));
    await page.mouse.move(grip.x + 8, grip.y + 8);
    await page.mouse.down();
    await page.mouse.move(grip.x + 30, grip.y + 30, { steps: 4 });
    const free = before.x > 40 ? 10 : before.x + before.width + 10;
    await page.mouse.move(free, 400, { steps: 8 });
    await rowsShot(ctx, "proxy-drag");
    await page.mouse.up();
    const entries = async () => (await api(page, "GET", "/api/files/")).json?.entries ?? [];
    const moved = await until(
      async () =>
        (await entries()).some((e) => /^test-pattern/.test(e.name) && e.parent === "desktop"),
      8_000,
    );
    const after = await box(W(ctx));
    const named = (await entries()).find(
      (e) => e.parent === "desktop" && /^test-pattern/.test(e.name),
    );
    if (named) {
      await api(page, "POST", "/api/files/ops", {
        ops: [{ op: "move", id: named.id, parent: "movies" }],
      }).catch(() => {});
    }
    return {
      ok: moved && after.x === before.x && after.y === before.y,
      detail: `moved ${moved} from ${before.x},${before.y} to ${after.x},${after.y}`,
    };
  },
);
R(
  "rows.controller",
  "movie",
  "group",
  "Playback controls",
  "drag the controller by its time code; focus a controller's button and press Right, then Left",
  "the controller stays where it was dropped; the frame steps forward and back with the focus on a button",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await wake(ctx);
    const hud = controls(ctx);
    const before = await box(hud);
    const time = await box(hud.locator("[data-time='duration']"));
    await page.mouse.move(time.x + 4, time.y + 4);
    await page.mouse.down();
    await page.mouse.move(time.x - 10, time.y - 50, { steps: 5 });
    await page.mouse.up();
    const after = await box(hud);
    const moved = Math.round(before.x - after.x) === 14 && Math.round(before.y - after.y) === 54;
    await rowsShot(ctx, "controller-moved");
    await hud.getByRole("button", { name: "Rewind" }).focus();
    await page.keyboard.press("Home").catch(() => {});
    const elapsed = () => hud.locator("[data-time='elapsed']").textContent();
    const start = await elapsed();
    await page.keyboard.press("ArrowRight");
    const on = await until(async () => (await elapsed()) !== start, 2_000);
    await sleep(500);
    const stepped = await elapsed();
    await page.keyboard.press("ArrowRight");
    await sleep(500);
    const twice = await elapsed();
    await page.keyboard.press("ArrowLeft");
    await sleep(500);
    await page.keyboard.press("ArrowLeft");
    const backed = await until(async () => (await elapsed()) === start, 2_000);
    const frame = (code) => Number(code.split(":").pop());
    return {
      ok:
        moved &&
        on &&
        backed &&
        frame(stepped) === frame(start) + 1 &&
        frame(twice) === frame(start) + 2,
      detail: `${before.x},${before.y} -> ${after.x},${after.y}; ${start} -> ${stepped} -> ${twice}`,
    };
  },
);
R(
  "rows.now-playing",
  "movie",
  "button",
  "Play",
  "click Play and read the browser's Media Session",
  "the session names the movie and says it is playing",
  async (ctx) => {
    await openMovie(ctx);
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Play", exact: true }).click();
    await until(async () => !(await vstate(ctx)).paused, 4_000);
    const session = await ctx.page.evaluate(() => ({
      title: navigator.mediaSession?.metadata?.title,
      state: navigator.mediaSession?.playbackState,
    }));
    await wake(ctx);
    await controls(ctx).getByRole("button", { name: "Pause", exact: true }).click();
    return {
      ok: /test-pattern/.test(session.title ?? "") && session.state === "playing",
      detail: JSON.stringify(session),
    };
  },
);
R(
  "rows.inspector",
  "movie",
  "menuitem",
  "Show Movie Inspector",
  "play the movie and open the Inspector",
  "Format, Data Size, Data Rate and a measured FPS are shown",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await chooseMenu(page, "Window", "Show Movie Inspector");
    // The panel lies over the controller of a window this small: the key plays the movie.
    await W(ctx).locator(".mac-quicktime-player").focus();
    await page.keyboard.press(" ");
    const rows = W(ctx).locator(".mac-quicktime-player-inspector-rows");
    const measured = await until(
      async () => /FPS\d/.test((await rows.textContent()) ?? ""),
      10_000,
    );
    const text = await rows.textContent();
    await rowsShot(ctx, "inspector");
    await video(ctx).evaluate((v) => v.pause());
    await chooseMenu(page, "Window", "Hide Movie Inspector");
    return {
      ok:
        measured && /FormatWebM/.test(text) && /Data Size\d/.test(text) && /Data Rate\d/.test(text),
      detail: text,
    };
  },
);
R(
  "rows.export-progress",
  "movie",
  "menuitem",
  "Show Export Progress",
  "open Export Progress, export Audio Only and press Stop, then export it again to its end",
  "the panel lists each export: Stopped, then Finished, with the file in Movies",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await chooseMenu(page, "Window", "Show Export Progress");
    const panel = W(ctx).locator(".mac-quicktime-player-exports");
    await panel.getByText("No exports.").waitFor({ timeout: 3_000 });
    // With the browser's encoders this short sound is done before Stop can be pressed: the replay, in real time, can be stopped.
    const encoder = await page.evaluateHandle(() => {
      const held = window.AudioEncoder;
      window.AudioEncoder = undefined;
      return held;
    });
    await chooseMenu(page, "File", "Export As", "Audio Only");
    await panel.getByRole("button", { name: "Stop" }).waitFor({ timeout: 5_000 });
    await rowsShot(ctx, "export-running");
    await panel.getByRole("button", { name: "Stop" }).click();
    await panel.getByText("Stopped").waitFor({ timeout: 5_000 });
    await page.evaluate((held) => {
      window.AudioEncoder = held;
    }, encoder);
    await rowsSettled(ctx);
    await chooseMenu(page, "File", "Export As", "Audio Only");
    await panel.getByText("Finished").waitFor({ timeout: 40_000 });
    await rowsShot(ctx, "export-finished");
    const kept = (await driveNames(ctx)).some((name) => /audio only/.test(name));
    await chooseMenu(page, "Window", "Hide Export Progress");
    return { ok: kept, detail: `in Movies ${kept}` };
  },
  { timeout: 120_000 },
);
R(
  "rows.clips",
  "movie",
  "button",
  "/^Clip /",
  "split the movie twice; Command-click two clips; drag a clip out of the strip onto the desktop; Undo aside, Insert Clip After Selection…",
  "both clips show chosen; the clip dragged out becomes a file of the Desktop folder; the insert leaves one more clip",
  async (ctx) => {
    const { page } = ctx;
    await openMovie(ctx);
    await video(ctx).evaluate((v) => {
      v.currentTime = 2;
    });
    await sleep(400);
    await chooseMenu(page, "Edit", "Split Clip");
    await video(ctx).evaluate((v) => {
      v.currentTime = 4;
    });
    await sleep(400);
    await chooseMenu(page, "Edit", "Split Clip");
    const clips = W(ctx).getByRole("button", { name: /^Clip \d+ of/ });
    await until(async () => (await clips.count()) === 3, 3_000);
    await clips.nth(0).click();
    await clips.nth(1).click({ modifiers: ["Meta"] });
    const pressed = await clips.evaluateAll((all) =>
      all.map((each) => each.getAttribute("aria-pressed")),
    );
    await rowsShot(ctx, "clips-chosen");
    const first = await box(clips.nth(0));
    const frame = await box(W(ctx));
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + first.width / 2, first.y - 60, { steps: 5 });
    const free = frame.x > 40 ? 10 : frame.x + frame.width + 10;
    await page.mouse.move(free, 400, { steps: 8 });
    await page.mouse.up();
    const out = await until(
      async () => (await driveNames(ctx)).some((n) => /clip 1/.test(n)),
      25_000,
    );
    await rowsSettled(ctx);
    await clips.nth(0).click();
    await chooseMenu(page, "Edit", "Insert Clip After Selection…");
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("option").first().click();
    await dialog.getByRole("button", { name: "Insert" }).click();
    const more = await until(async () => (await clips.count()) === 4, 60_000);
    await rowsShot(ctx, "clips-inserted");
    await rowsSettled(ctx);
    return {
      ok: pressed.join() === "true,true,false" && out && more,
      detail: `${pressed.join()} out ${out} four clips ${more}`,
    };
  },
  { timeout: 180_000 },
);
R(
  "rows.timer",
  "menu",
  "menuitemradio",
  "5 Seconds",
  "after closing the edited movie, File > New Screen Recording, open its Options",
  "the Timer rows show, and Show Mouse Clicks can be turned on, saying what a page sees",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    if (await W(ctx).locator(".mac-quicktime-player").count()) {
      await W(ctx).getByRole("button", { name: "Close" }).first().click({ force: true });
      const dont = page.getByRole("button", { name: "Don’t Save" });
      if (await dont.isVisible({ timeout: 1_000 }).catch(() => false)) await dont.click();
      await ensureOpen(ctx);
    }
    await chooseMenu(page, "File", "New Screen Recording");
    await W(ctx).getByRole("button", { name: "Recording Options" }).click();
    const fiveRow = page.getByRole("menuitemradio", { name: "5 Seconds" });
    await fiveRow.waitFor({ timeout: 3_000 });
    const five = await fiveRow.isVisible();
    const clicks = await page
      .getByRole("menuitemcheckbox", { name: "Show Mouse Clicks" })
      .getAttribute("title");
    await rowsShot(ctx, "screen-options");
    await page.keyboard.press("Escape");
    return { ok: five && !!clicks, detail: `${five} ${clicks}` };
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
      return W(ctx);
    },
  },
  {
    name: "open panel",
    enter: async (ctx) => {
      if (
        !(await panelButton(ctx, "From This Computer…")
          .isVisible()
          .catch(() => false))
      )
        await chooseMenu(ctx.page, "File", "Open File…");
      return W(ctx);
    },
    window: async (ctx) => ctx.page.getByRole("dialog").or(W(ctx)).first(),
    menus: false,
  },
  {
    name: "movie",
    enter: async (ctx) => {
      await panelButton(ctx, "Cancel")
        .click()
        .catch(() => {});
      await openMovie(ctx);
      await wake(ctx);
      return W(ctx);
    },
  },
  {
    name: "share menu",
    enter: async (ctx) => {
      await wake(ctx);
      await controls(ctx).getByRole("button", { name: "Share" }).click();
      await sleep(300);
      return W(ctx);
    },
    window: async (ctx) => ctx.page.getByRole("menu").last(),
    leave: async (ctx) => ctx.page.keyboard.press("Escape"),
    menus: false,
  },
];

await censusRun(app);
