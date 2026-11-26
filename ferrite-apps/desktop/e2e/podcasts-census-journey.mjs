#!/usr/bin/env node
// Podcasts census journey (round 3, R7): every control of Podcasts, verified with real input against
// a served `ferrite dev`. Shows, feeds and episode audio come from outside hosts (Apple's podcast
// directory, the shows' feeds and audio hosts) through the app's egress: an outside failure counts
// as infrastructure only with a curl to the host in the same minute, and Podcasts must then say so
// in its own words. Playback is asserted on the real <audio> element; the episode place is kept
// across a reload and a real restart.

import { execSync } from "node:child_process";
import {
  api,
  censusRun,
  chooseMenu,
  closeMenus,
  createAccount,
  ensureOpen,
  mainWindow,
  menubar,
  menuItemState,
  openApp,
  person,
  shellRows,
  sleep,
  until,
} from "./media-census-kit.mjs";

const LIB = "/api/podcasts/library";
const SHOW = "Up First";
const app = {
  slug: "podcasts",
  name: "Podcasts",
  menus: ["Podcasts", "File", "Edit", "View", "Controls", "Account", "Window", "Help"],
  editUnavailable:
    "dimmed placeholder rows of the shell's Edit menu: Podcasts puts no Edit commands of its own there",
  preferences: {
    text: "Playback",
    locate: (ctx) => ctx.page.locator(".mac-podcasts-preferences").first(),
    close: async (ctx) =>
      ctx.page
        .locator(".mac-podcasts-preferences")
        .first()
        .getByRole("button", { name: "Close" })
        .first()
        .click(),
  },
  crawlIgnore: [/^menu bar\|menuitem\|Apple$/],
};
const W = (ctx) => mainWindow(ctx.page, app);
const audio = (ctx) => W(ctx).locator("audio").first();
const astate = (ctx) =>
  audio(ctx)
    .evaluate((a) => ({
      t: a.currentTime,
      paused: a.paused,
      ready: a.readyState,
      rate: a.playbackRate,
      volume: a.volume,
      src: a.currentSrc.slice(0, 80),
    }))
    .catch(() => null);
const lib = async (ctx) => (await api(ctx.page, "GET", LIB)).json;
const side = (ctx, name) => W(ctx).getByRole("treeitem", { name, exact: true }).first();
const curl = (url) => {
  try {
    return execSync(`curl -s -o /dev/null -m 15 -w '%{http_code}' '${url}'`, {
      encoding: "utf8",
    }).trim();
  } catch {
    return "curl failed";
  }
};
const outside = () =>
  `curl itunes.apple.com ${curl("https://itunes.apple.com/search?term=up+first&media=podcast&limit=1")} at ${new Date().toISOString()}`;
/** Search for the show, open it and its episodes (outside hosts); answers whether episodes listed. */
async function openShow(ctx) {
  if (
    ctx.data.showOpen &&
    (await W(ctx)
      .getByRole("region", { name: "Episodes" })
      .isVisible()
      .catch(() => false))
  )
    return true;
  await ensureOpen(ctx);
  const field = W(ctx).getByRole("searchbox", { name: "Search" });
  await field.fill(SHOW);
  await field.press("Enter");
  const show = W(ctx)
    .getByRole("region", { name: "Shows" })
    .getByRole("button", { name: new RegExp(`^${SHOW}`) })
    .first();
  if (
    !(await show.waitFor({ timeout: 30_000 }).then(
      () => true,
      () => false,
    ))
  )
    return false;
  await show.click();
  ctx.data.showOpen = await W(ctx)
    .getByRole("region", { name: "Episodes" })
    .getByRole("button", { name: /^Play / })
    .first()
    .waitFor({ timeout: 30_000 })
    .then(
      () => true,
      () => false,
    );
  return ctx.data.showOpen;
}
async function playing(ctx) {
  if (!(await openShow(ctx))) return false;
  const s = await astate(ctx);
  if (s && !s.paused) return true;
  const play = W(ctx)
    .getByRole("region", { name: "Episodes" })
    .getByRole("button", { name: /^Play / })
    .first();
  ctx.data.episode = ((await play.getAttribute("aria-label")) ?? "").replace(/^Play /, "");
  await play.click();
  return until(async () => {
    const a = await astate(ctx);
    return a && !a.paused && a.t > 0.5;
  }, 30_000);
}

const rows = [];
const R = (id, state, role, name, how, expected, check, extra = {}) =>
  rows.push({ id: `podcasts.${id}`, state, role, name, how, expected, check, ...extra });

for (const name of [
  "Listen Now",
  "Browse",
  "Top Charts",
  "Shows",
  "Episodes",
  "Downloaded",
  "Recently Updated",
]) {
  R(
    `sidebar.${name.toLowerCase().replace(/ /g, "-")}`,
    "Podcasts",
    "treeitem",
    name,
    `click ${name} in the sidebar`,
    `${name} is selected and its view shows (its heading)`,
    async (ctx) => {
      await ensureOpen(ctx);
      await side(ctx, name).click();
      const sel = await until(
        async () => (await side(ctx, name).getAttribute("aria-selected")) === "true",
        3_000,
      );
      const head = await until(
        async () =>
          (await W(ctx)
            .getByRole("heading", { name: new RegExp(name, "i") })
            .count()) > 0,
        8_000,
      );
      return { ok: sel && head, detail: `selected ${sel}, heading ${head}` };
    },
  );
}
R(
  "search",
  "Podcasts",
  "searchbox",
  "Search",
  `type "${SHOW}", Return`,
  "Apple's directory answers through the app's egress and the show is listed; or Podcasts says why not",
  async (ctx) => {
    const ok = await openShow(ctx);
    return { ok, detail: ok ? "listed and opened" : `not listed; ${outside()}` };
  },
  { timeout: 90_000 },
);
R(
  "show.subscribe",
  "show page",
  "button",
  "Subscribe",
  "on the show's page, Subscribe",
  "the server keeps the subscription; Shows lists it",
  async (ctx) => {
    if (!(await openShow(ctx))) return { ok: false, detail: outside() };
    const before = JSON.stringify(await lib(ctx));
    await W(ctx).getByRole("button", { name: "Subscribe", exact: true }).click();
    const kept = await until(
      async () =>
        JSON.stringify(await lib(ctx)).includes(SHOW) && JSON.stringify(await lib(ctx)) !== before,
      10_000,
    );
    return { ok: kept };
  },
  {
    persists: "restart",
    timeout: 90_000,
    restartCheck: async (ctx) => ({ ok: JSON.stringify(await lib(ctx)).includes(SHOW) }),
  },
);
R(
  "episode.play",
  "show page (Episodes)",
  "button",
  "/Play .+/",
  "click the first episode's Play",
  "the episode plays: the <audio> element's currentTime moves, paused false, readyState >= 2",
  async (ctx) => {
    const ok = await playing(ctx);
    const s = await astate(ctx);
    return {
      ok: ok && s.ready >= 2,
      detail: ok ? JSON.stringify(s) : `${JSON.stringify(s)}; ${outside()}`,
    };
  },
  { timeout: 90_000, notes: "kind: an episode's Play button of the Episodes list" },
);
R(
  "player.pause-play",
  "player",
  "button",
  "Play",
  "the player's Pause, then Play",
  "the <audio> element pauses (currentTime stands), then plays on",
  async (ctx) => {
    if (!(await playing(ctx))) return { ok: false, detail: outside() };
    await W(ctx).getByRole("button", { name: "Pause", exact: true }).click();
    const a = await astate(ctx);
    await sleep(800);
    const b = await astate(ctx);
    ctx.data.pauseOk = a.paused && Math.abs(b.t - a.t) < 0.05;
    await W(ctx).getByRole("button", { name: "Play", exact: true }).click();
    const on = await until(async () => {
      const c = await astate(ctx);
      return !c.paused && c.t > b.t + 0.2;
    }, 8_000);
    return {
      ok: a.paused && Math.abs(b.t - a.t) < 0.05 && on,
      detail: `${a.t} -> ${b.t}, played on ${on}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "player.pause",
  "player (playing)",
  "button",
  "Pause",
  "while an episode plays, the player's Pause",
  "the <audio> element pauses and its time stands still (seen during podcasts.player.pause-play)",
  async (ctx) => ({
    ok: ctx.data.pauseOk === true,
    detail: `paused and still ${ctx.data.pauseOk}`,
  }),
);
R(
  "player.forward-30",
  "player",
  "button",
  "Forward 30 seconds",
  "while playing, Forward 30 seconds",
  "the <audio> element moves on 30 s",
  async (ctx) => {
    if (!(await playing(ctx))) return { ok: false, detail: outside() };
    const a = await astate(ctx);
    await W(ctx).getByRole("button", { name: "Forward 30 seconds" }).click();
    const ok = await until(async () => (await astate(ctx)).t >= a.t + 28, 5_000);
    return { ok, detail: `${a.t.toFixed(1)} -> ${(await astate(ctx)).t.toFixed(1)}` };
  },
  { timeout: 90_000 },
);
R(
  "player.back-15",
  "player",
  "button",
  "Back 15 seconds",
  "after Forward, Back 15 seconds",
  "the <audio> element moves back 15 s",
  async (ctx) => {
    if (!(await playing(ctx))) return { ok: false, detail: outside() };
    const a = await astate(ctx);
    await W(ctx).getByRole("button", { name: "Back 15 seconds" }).click();
    const ok = await until(async () => {
      const t = (await astate(ctx)).t;
      return t <= a.t - 13 && t >= a.t - 17;
    }, 5_000);
    return { ok, detail: `${a.t.toFixed(1)} -> ${(await astate(ctx)).t.toFixed(1)}` };
  },
  { timeout: 90_000 },
);
R(
  "player.speed",
  "player",
  "button",
  "/Playback speed [0-9.]+×/",
  "click Playback speed 1×, then 1.25×, then back round to 1×",
  "each click steps the speed and the <audio> element's playbackRate follows (1 -> 1.25 -> 1.5 ...)",
  async (ctx) => {
    if (!(await playing(ctx))) return { ok: false, detail: outside() };
    const seen = [];
    for (let n = 0; n < 6; n += 1) {
      const b = W(ctx).getByRole("button", { name: /^Playback speed / });
      const label = await b.getAttribute("aria-label");
      seen.push(`${label}=${(await astate(ctx)).rate}`);
      await b.click();
      await sleep(200);
      if (n > 0 && /1×$/.test((await b.getAttribute("aria-label")) ?? "")) break;
    }
    const ok =
      seen.every((s) => {
        const [label, rate] = s.split("=");
        return Math.abs(Number(label.match(/([0-9.]+)×/)[1]) - Number(rate)) < 0.01;
      }) && seen.length >= 2;
    return { ok, detail: seen.join(", ") };
  },
  { timeout: 90_000, notes: "kind: the player's speed button, named by the current speed" },
);
R(
  "player.volume",
  "player",
  "slider",
  "Volume",
  "focus Volume, Home, then End",
  "the <audio> element's volume goes to 0, then 1",
  async (ctx) => {
    await ensureOpen(ctx);
    const v = W(ctx).getByRole("slider", { name: "Volume" });
    await v.focus();
    await ctx.page.keyboard.press("Home");
    const low = await until(
      async () =>
        ((await astate(ctx))?.volume ?? 1) === 0 || (await v.getAttribute("aria-valuenow")) === "0",
      3_000,
    );
    await ctx.page.keyboard.press("End");
    const high = await until(
      async () =>
        ((await astate(ctx))?.volume ?? 0) === 1 ||
        (await v.getAttribute("aria-valuenow")) === (await v.getAttribute("aria-valuemax")),
      3_000,
    );
    return { ok: low && high, detail: JSON.stringify(await astate(ctx)) };
  },
);
R(
  "player.place-kept",
  "player",
  "behaviour",
  "the episode place",
  "play, move on (Forward 30 seconds), Pause, reload, open Podcasts",
  "the server keeps the episode and its place; after the reload the player resumes there (currentTime within 3 s)",
  async (ctx) => {
    const { page } = ctx;
    if (!(await playing(ctx))) return { ok: false, detail: outside() };
    await W(ctx).getByRole("button", { name: "Forward 30 seconds" }).click();
    await sleep(500);
    await W(ctx).getByRole("button", { name: "Pause", exact: true }).click();
    await sleep(2500);
    const place = (await astate(ctx)).t;
    ctx.data.place = place;
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    ctx.data.showOpen = false;
    await ensureOpen(ctx);
    await W(ctx).getByRole("button", { name: "Play", exact: true }).click();
    const resumed = await until(async () => {
      const a = await astate(ctx);
      return a && a.t >= place - 3 && a.t <= place + 6;
    }, 30_000);
    await W(ctx)
      .getByRole("button", { name: "Pause", exact: true })
      .click()
      .catch(() => {});
    return {
      ok: resumed,
      detail: `place ${place.toFixed(1)}, resumed at ${(await astate(ctx))?.t?.toFixed(1)}`,
    };
  },
  {
    persists: "restart",
    timeout: 120_000,
    restartCheck: async (ctx) => {
      await ensureOpen(ctx);
      await W(ctx).getByRole("button", { name: "Play", exact: true }).click();
      const ok = await until(async () => {
        const a = await astate(ctx);
        return a && a.t >= (ctx.data.place ?? 0) - 3;
      }, 30_000);
      await W(ctx)
        .getByRole("button", { name: "Pause", exact: true })
        .click()
        .catch(() => {});
      return { ok, detail: `place ${ctx.data.place}, after restart ${(await astate(ctx))?.t}` };
    },
  },
);
for (const [slug, name, prepare, check] of [
  [
    "play",
    "Play",
    async (ctx) => {
      if ((await astate(ctx))?.paused === false) {
        await W(ctx)
          .getByRole("button", { name: "Pause", exact: true })
          .first()
          .click()
          .catch(() => {});
        await until(async () => (await astate(ctx))?.paused === true, 3_000);
      }
    },
    async (ctx) => {
      const a = await astate(ctx);
      return a && !a.paused;
    },
  ],
  [
    "pause",
    "Pause",
    async () => {},
    async (ctx) => {
      const a = await astate(ctx);
      return a?.paused;
    },
  ],
  [
    "skip-back",
    "Skip Back 15 Seconds",
    async (ctx) => {
      await W(ctx).getByRole("button", { name: "Forward 30 seconds" }).click();
      await sleep(300);
    },
    async (ctx, before) => (await astate(ctx)).t <= before.t - 13,
  ],
  [
    "skip-forward",
    "Skip Forward 30 Seconds",
    async () => {},
    async (ctx, before) => (await astate(ctx)).t >= before.t + 28,
  ],
]) {
  R(
    `menu.controls.${slug}`,
    "menu:Controls",
    "menuitem",
    name,
    `with an episode loaded${slug === "play" ? " and paused" : slug === "pause" ? " and playing" : ""}, Controls > ${name}`,
    `acts on the <audio> element as the player's own button does`,
    async (ctx) => {
      if (!(await playing(ctx))) return { ok: false, detail: outside() };
      await prepare(ctx);
      const before = await astate(ctx);
      try {
        await chooseMenu(ctx.page, "Controls", name);
      } catch (error) {
        // Say what the menu holds instead, so the failure names the state the app was in.
        await menubar(ctx.page)
          .getByRole("menuitem", { name: "Controls", exact: true })
          .first()
          .click();
        await ctx.page
          .getByRole("menu")
          .first()
          .waitFor({ timeout: 3_000 })
          .catch(() => {});
        const items = await ctx.page
          .getByRole("menu")
          .first()
          .getByRole("menuitem")
          .evaluateAll((all) => all.map((e) => e.textContent.trim()));
        await closeMenus(ctx.page);
        return {
          ok: false,
          detail: `${String(error).split("\n")[0]}; the Controls menu holds ${items.join(", ")}; audio ${JSON.stringify(before)}`,
        };
      }
      const ok = await until(() => check(ctx, before), 5_000);
      return { ok, detail: `${JSON.stringify(before)} -> ${JSON.stringify(await astate(ctx))}` };
    },
    { timeout: 90_000 },
  );
}
R(
  "menu.controls.play-next",
  "menu:Controls",
  "menuitem",
  "Play Next in Up Next",
  "with an episode loaded, Controls > Play Next in Up Next",
  "plays the next episode of Up Next, or is dimmed when Up Next is empty",
  async (ctx) => {
    await ensureOpen(ctx);
    const state = await menuItemState(ctx.page, "Controls", "Play Next in Up Next");
    if (state.disabled)
      return {
        ok: true,
        unavailable: "dimmed in the Controls menu: Up Next is empty",
        detail: JSON.stringify(state),
      };
    const before = (await astate(ctx))?.src;
    await chooseMenu(ctx.page, "Controls", "Play Next in Up Next");
    const ok = await until(async () => (await astate(ctx))?.src !== before, 15_000);
    return { ok };
  },
  { timeout: 60_000 },
);
R(
  "player.up-next",
  "player",
  "button",
  "Up Next",
  "click Up Next",
  "the Up Next list opens (the queue, or that it is empty)",
  async (ctx) => {
    await ensureOpen(ctx);
    const upNext = W(ctx).getByRole("button", { name: "Up Next", exact: true });
    await upNext.click();
    const ok = await until(
      async () =>
        (await upNext.getAttribute("aria-expanded")) === "true" ||
        (await upNext.getAttribute("aria-pressed")) === "true" ||
        (await ctx.page
          .getByRole("dialog")
          .or(ctx.page.getByRole("region", { name: /Up Next/ }))
          .or(ctx.page.getByRole("heading", { name: /Up Next/ }))
          .count()) > 0,
      5_000,
    );
    const said = {
      expanded: await upNext.getAttribute("aria-expanded"),
      pressed: await upNext.getAttribute("aria-pressed"),
    };
    await ctx.page.keyboard.press("Escape");
    return { ok, detail: JSON.stringify(said) };
  },
);
R(
  "player.episode-notes",
  "player",
  "button",
  "Episode Notes",
  "with an episode loaded, click Episode Notes",
  "the playing episode's notes show",
  async (ctx) => {
    await ensureOpen(ctx);
    await W(ctx).getByRole("button", { name: "Episode Notes" }).click();
    const ok = await until(
      async () =>
        (await ctx.page
          .getByRole("dialog")
          .or(ctx.page.getByRole("region", { name: /Notes/ }))
          .count()) > 0,
      5_000,
    );
    await ctx.page.keyboard.press("Escape");
    return { ok };
  },
);
R(
  "prefs.continuous-playback",
  "Preferences (Playback)",
  "checkbox",
  "Continuous Playback",
  "Control-Comma, Playback tab, click Continuous Playback, Close",
  "the server keeps the setting; reopened, Preferences shows it",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await W(ctx).getByRole("searchbox").focus();
    await page.keyboard.press("Control+Comma");
    const prefs = page.locator(".mac-podcasts-preferences").first();
    await prefs.waitFor({ timeout: 10_000 });
    await prefs.getByRole("tab", { name: "Playback" }).click();
    const box = prefs.getByRole("checkbox", { name: "Continuous Playback" });
    const was = await box.isChecked();
    const before = JSON.stringify(await lib(ctx));
    await box.click();
    const kept = await until(async () => JSON.stringify(await lib(ctx)) !== before, 8_000);
    ctx.data.continuous = !was;
    await prefs.getByRole("button", { name: "Close" }).first().click();
    return { ok: kept && (await box.isChecked().catch(() => !was)) === !was, detail: `was ${was}` };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => {
      await ensureOpen(ctx);
      await W(ctx).getByRole("searchbox").focus();
      await ctx.page.keyboard.press("Control+Comma");
      const prefs = ctx.page.locator(".mac-podcasts-preferences").first();
      await prefs.getByRole("tab", { name: "Playback" }).click();
      const now = await prefs.getByRole("checkbox", { name: "Continuous Playback" }).isChecked();
      await prefs.getByRole("button", { name: "Close" }).first().click();
      return { ok: now === ctx.data.continuous, detail: `now ${now}` };
    },
  },
);
R(
  "prefs.playback-tab",
  "Preferences",
  "tab",
  "Playback",
  "Control-Comma, Playback tab",
  "the Playback settings show (checked by Continuous Playback)",
  async () => ({ ok: true, detail: "checked by podcasts.prefs.continuous-playback" }),
);
R(
  "show.add-to-up-next",
  "show page (Episodes)",
  "button",
  "/Add .+ to Up Next/",
  "on the show's page, click the first episode's Add … to Up Next",
  "the server's library changes to hold the episode in Up Next",
  async (ctx) => {
    if (!(await openShow(ctx))) return { ok: false, detail: outside() };
    const add = W(ctx)
      .getByRole("button", { name: /^Add .+ to Up Next$/ })
      .first();
    const title = ((await add.getAttribute("aria-label")) ?? "")
      .replace(/^Add /, "")
      .replace(/ to Up Next$/, "");
    const before = JSON.stringify(await lib(ctx));
    await add.click();
    const needle = JSON.stringify(title.slice(0, 30)).slice(1, -1);
    const kept = await until(async () => {
      const now = JSON.stringify(await lib(ctx));
      return now !== before && now.includes(needle);
    }, 10_000);
    return { ok: kept, detail: title.slice(0, 80) };
  },
  { timeout: 90_000, notes: "kind: an episode's Add to Up Next button of the show page" },
);
R(
  "show.unsubscribe",
  "show page",
  "button",
  "Unsubscribe",
  "on the subscribed show's page, Unsubscribe, then Subscribe again",
  "the server's library drops the subscription (the button turns to Subscribe), then holds it again",
  async (ctx) => {
    if (!(await openShow(ctx))) return { ok: false, detail: outside() };
    const before = JSON.stringify(await lib(ctx));
    await W(ctx).getByRole("button", { name: "Unsubscribe", exact: true }).click();
    const dropped = await until(
      async () =>
        JSON.stringify(await lib(ctx)) !== before &&
        (await W(ctx).getByRole("button", { name: "Subscribe", exact: true }).isVisible()),
      10_000,
    );
    const middle = JSON.stringify(await lib(ctx));
    await W(ctx).getByRole("button", { name: "Subscribe", exact: true }).click();
    const again = await until(async () => {
      const now = JSON.stringify(await lib(ctx));
      return now !== middle && now.includes(SHOW);
    }, 10_000);
    return { ok: dropped && again, detail: `dropped ${dropped}, subscribed again ${again}` };
  },
  { timeout: 90_000 },
);
R(
  "show.back-to-search",
  "show page",
  "button",
  "Back to Search",
  "on the show's page, Back to Search",
  "the search results show again, listing the show",
  async (ctx) => {
    if (!(await openShow(ctx))) return { ok: false, detail: outside() };
    await W(ctx).getByRole("button", { name: "Back to Search", exact: true }).click();
    ctx.data.showOpen = false;
    const ok = await until(
      () =>
        W(ctx)
          .getByRole("region", { name: "Shows" })
          .getByRole("button", { name: new RegExp(`^${SHOW}`) })
          .first()
          .isVisible(),
      10_000,
    );
    return { ok };
  },
  { timeout: 90_000 },
);
R(
  "show.search-clear",
  "show page (search)",
  "button",
  "Clear",
  "with a search typed, click the search field's Clear",
  "the search field empties",
  async (ctx) => {
    if (!(await openShow(ctx))) return { ok: false, detail: outside() };
    const field = W(ctx).getByRole("searchbox", { name: "Search" });
    const typed = await field.inputValue();
    await W(ctx).getByRole("button", { name: "Clear", exact: true }).first().click();
    ctx.data.showOpen = false;
    const ok = await until(async () => (await field.inputValue()) === "", 3_000);
    return { ok: typed.length > 0 && ok, detail: `"${typed}" -> "${await field.inputValue()}"` };
  },
  { timeout: 90_000 },
);
R(
  "show.position",
  "show page (player)",
  "slider",
  "Playback position",
  "while an episode plays, focus Playback position, press Right Arrow 3 times",
  "the <audio> element jumps ahead",
  async (ctx) => {
    if (!(await playing(ctx))) return { ok: false, detail: outside() };
    const before = (await astate(ctx)).t;
    const { rate } = await astate(ctx);
    const started = Date.now();
    await W(ctx).getByRole("slider", { name: "Playback position" }).first().focus();
    for (let n = 0; n < 3; n += 1) await ctx.page.keyboard.press("ArrowRight");
    const ok = await until(
      async () => (await astate(ctx)).t > before + (rate * (Date.now() - started)) / 1000 + 2,
      5_000,
    );
    return { ok, detail: `${before.toFixed(1)} -> ${(await astate(ctx)).t.toFixed(1)}` };
  },
  { timeout: 90_000 },
);
/** Open a library view of the sidebar (by way of Listen Now, so a show page left open is left) and give its outside data a moment. */
const view = async (ctx, name) => {
  await ensureOpen(ctx);
  if (name !== "Listen Now") await side(ctx, "Listen Now").click();
  await side(ctx, name).click();
  await sleep(1500);
};
const named = async (locator) =>
  (await locator.getAttribute("aria-label")) ?? ((await locator.textContent()) ?? "").trim();
R(
  "chart.open",
  "Top Charts",
  "button",
  "/Open .+/",
  "Top Charts, click the first show's Open",
  "that show's page opens, its episodes listed",
  async (ctx) => {
    await view(ctx, "Top Charts");
    const open = W(ctx)
      .getByRole("button", { name: /^Open .+/ })
      .first();
    if (
      !(await open.waitFor({ timeout: 30_000 }).then(
        () => true,
        () => false,
      ))
    )
      return { ok: false, detail: outside() };
    const title = (await named(open)).replace(/^Open /, "");
    await open.click();
    ctx.data.showOpen = false;
    const ok = await until(
      () => W(ctx).getByRole("region", { name: "Episodes" }).isVisible(),
      30_000,
    );
    return { ok, detail: title };
  },
  { timeout: 90_000, notes: "kind: a Top Charts entry's Open button (the chart is Apple's)" },
);
R(
  "chart.subscribe",
  "Top Charts",
  "button",
  "/Subscribe to .+/",
  "Top Charts, click a show's Subscribe to …",
  "the server's library holds the show",
  async (ctx) => {
    await view(ctx, "Top Charts");
    const subscribe = W(ctx)
      .getByRole("button", { name: /^Subscribe to .+/ })
      .first();
    if (
      !(await subscribe.waitFor({ timeout: 30_000 }).then(
        () => true,
        () => false,
      ))
    )
      return { ok: false, detail: outside() };
    const title = (await named(subscribe)).replace(/^Subscribe to /, "");
    await subscribe.click();
    const needle = JSON.stringify(title).slice(1, -1);
    const kept = await until(async () => JSON.stringify(await lib(ctx)).includes(needle), 10_000);
    ctx.data.chartTitle = title;
    return { ok: kept, detail: title };
  },
  { timeout: 90_000, notes: "kind: a Top Charts entry's Subscribe button" },
);
R(
  "chart.unfollowable",
  "Top Charts",
  "button",
  "/.+ cannot be followed here: .+/",
  "Top Charts, a show whose feed the app may not fetch",
  "its Subscribe is dimmed, the reason in its name",
  async (ctx) => {
    await view(ctx, "Top Charts");
    const loaded = await W(ctx)
      .getByRole("button", { name: /^Open .+/ })
      .first()
      .waitFor({ timeout: 30_000 })
      .then(
        () => true,
        () => false,
      );
    if (!loaded) return { ok: false, detail: `Top Charts did not load; ${outside()}` };
    const entry = W(ctx)
      .getByRole("button", { name: /cannot be followed here: / })
      .first();
    if ((await entry.count()) === 0)
      return {
        ok: true,
        na: "today's chart from Apple holds no show whose feed the app may not fetch",
        detail: "chart loaded; every entry can be followed",
      };
    const label = await named(entry);
    const dimmed =
      (await entry.getAttribute("aria-disabled")) === "true" || (await entry.isDisabled());
    return {
      ok: dimmed,
      unavailable: label
        .replace(/^.+? cannot be followed here: /, "cannot be followed here: ")
        .slice(0, 160),
      detail: `dimmed ${dimmed}: ${label.slice(0, 160)}`,
    };
  },
  {
    timeout: 90_000,
    notes: "kind: a chart entry whose feed is published where the app may not fetch it",
  },
);
// A show card of Browse or Recently Updated is named by its title and its publisher, which come
// from outside; the pattern names every two-word button that is not one of Podcasts' verbs.
const CARD =
  "(?!(?:Open|Subscribe to|Subscribe|Unsubscribe|Add|Play|Pause|Back|Clear|Refresh|Episode Notes|Up Next|Audio output|Forward|Skip|Playback|Close|Minimize|Zoom|Enter Full Screen)\\b)[^:]+ [^:]+";
R(
  "browse.show",
  "Browse / Recently Updated",
  "button",
  `/${CARD}/`,
  "Browse, click the first, a middle and the last show card",
  "each opens that show's page, its episodes listed",
  async (ctx) => {
    const out = [];
    await view(ctx, "Browse");
    const cards = W(ctx).getByRole("button", { name: new RegExp(`^${CARD}$`) });
    if (
      !(await cards
        .first()
        .waitFor({ timeout: 30_000 })
        .then(
          () => true,
          () => false,
        ))
    )
      return { ok: false, detail: outside() };
    const n = await cards.count();
    // First, middle and last of the cards a click at their centre reaches (read with elementFromPoint),
    // clicked by name: a shelf scrolls sideways, and the list may change as outside data arrives.
    const visible = await cards.evaluateAll((all) =>
      all
        .map((e, at) => {
          const r = e.getBoundingClientRect();
          if (!r.width) return -1;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return hit && e.contains(hit) ? at : -1;
        })
        .filter((at) => at >= 0),
    );
    const labels = await cards.evaluateAll((all) =>
      all.map((e) => e.getAttribute("aria-label") ?? e.innerText.replace(/\s+/g, " ").trim()),
    );
    const picks = [
      ...new Set([
        visible[0],
        visible[Math.floor(visible.length / 2)],
        visible[visible.length - 1],
      ]),
    ].filter((at) => at !== undefined);
    for (const at of picks) {
      await view(ctx, "Browse");
      const title = labels[at];
      await W(ctx).getByRole("button", { name: title, exact: true }).first().click();
      const ok = await until(
        () => W(ctx).getByRole("region", { name: "Episodes" }).isVisible(),
        30_000,
      );
      out.push(`${title.slice(0, 40)}:${ok}`);
    }
    ctx.data.showOpen = false;
    return {
      ok: picks.length >= 1 && out.length === picks.length && out.every((x) => x.endsWith("true")),
      detail: `${visible.length} of ${n} cards in view; ${out.join(", ")}`,
    };
  },
  {
    timeout: 180_000,
    notes: "kind: a show card of Browse and Recently Updated (title and publisher, from outside)",
  },
);
R(
  "recent.refresh",
  "Recently Updated",
  "button",
  "Refresh",
  "Recently Updated, click Refresh",
  "it says Refreshing… while the subscribed shows' feeds are fetched again (answered), then Refresh again",
  async (ctx) => {
    await view(ctx, "Recently Updated");
    const refresh = W(ctx)
      .getByRole("button", { name: /^(Refresh|Refreshing…)$/ })
      .first();
    await refresh.waitFor({ timeout: 10_000 });
    const fetched = ctx.page
      .waitForResponse((r) => new URL(r.url()).pathname.startsWith("/api/podcasts/feed"), {
        timeout: 30_000,
      })
      .catch(() => null);
    await refresh.click();
    const reply = await fetched;
    const back = await until(
      async () => ((await refresh.textContent()) ?? "").trim() === "Refresh",
      30_000,
    );
    return {
      ok: !!reply && reply.status() < 400 && back,
      detail: `feed answered ${reply?.status() ?? "never"}; back to Refresh ${back}`,
    };
  },
  { timeout: 90_000 },
);
const prefsBox = (ctx) => ctx.page.locator(".mac-podcasts-preferences").first();
async function openPrefs(ctx) {
  if (
    await prefsBox(ctx)
      .isVisible()
      .catch(() => false)
  )
    return prefsBox(ctx);
  await ensureOpen(ctx);
  // A click into the window (its search field) makes Podcasts the app that takes Control-Comma.
  await W(ctx).getByRole("searchbox").click();
  await ctx.page.keyboard.press("Control+Comma");
  await prefsBox(ctx).waitFor({ timeout: 10_000 });
  return prefsBox(ctx);
}
for (const tab of ["General", "Advanced"]) {
  R(
    `prefs.tab.${tab.toLowerCase()}`,
    "Preferences",
    "tab",
    tab,
    `Control-Comma, click the ${tab} tab`,
    `the ${tab} pane shows (its tab selected)`,
    async (ctx) => {
      const p = await openPrefs(ctx);
      await p.getByRole("tab", { name: tab, exact: true }).click();
      return until(
        async () =>
          (await p.getByRole("tab", { name: tab, exact: true }).getAttribute("aria-selected")) ===
          "true",
        4_000,
      );
    },
  );
}
R(
  "prefs.refresh-podcasts",
  "Preferences (General)",
  "combobox",
  "Refresh Podcasts:",
  "Control-Comma, General, open Refresh Podcasts and choose another interval",
  "the pop-up names the new interval and the server keeps it; reopened, Preferences shows it",
  async (ctx) => {
    const p = await openPrefs(ctx);
    await p.getByRole("tab", { name: "General", exact: true }).click();
    const pop = p.getByRole("combobox", { name: "Refresh Podcasts:" });
    const before = ((await pop.textContent()) ?? "").trim();
    const server = JSON.stringify(await lib(ctx));
    await pop.click();
    const options = ctx.page.getByRole("option");
    await options.first().waitFor({ timeout: 5_000 });
    const names = await options.evaluateAll((all) => all.map((e) => e.textContent.trim()));
    const other = names.find((n) => n && n !== before);
    if (other) await ctx.page.getByRole("option", { name: other, exact: true }).click();
    const after = ((await pop.textContent()) ?? "").trim();
    const kept = await until(async () => JSON.stringify(await lib(ctx)) !== server, 8_000);
    ctx.data.refreshChoice = after;
    return {
      ok: !!other && after === other && kept,
      detail: `${before} -> ${after} of ${names.join(", ")}; server changed ${kept}`,
    };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => {
      const p = await openPrefs(ctx);
      await p.getByRole("tab", { name: "General", exact: true }).click();
      const now = (
        (await p.getByRole("combobox", { name: "Refresh Podcasts:" }).textContent()) ?? ""
      ).trim();
      await p
        .getByRole("button", { name: "Close" })
        .first()
        .click()
        .catch(() => {});
      return { ok: now === ctx.data.refreshChoice, detail: now };
    },
  },
);
R(
  "prefs.auto-download",
  "Preferences (General)",
  "combobox",
  "Automatically Download Episodes:",
  "Control-Comma, General",
  "dimmed, and the pane says why (the desktop does not download episodes)",
  async (ctx) => {
    const p = await openPrefs(ctx);
    await p.getByRole("tab", { name: "General", exact: true }).click();
    const pop = p.getByRole("combobox", { name: "Automatically Download Episodes:" });
    const dimmed = (await pop.getAttribute("aria-disabled")) === "true" || (await pop.isDisabled());
    const title = ((await pop.getAttribute("title")) ?? "").trim();
    const reason =
      title ||
      ((await p.innerText())
        .split("\n")
        .find((line) => /download/i.test(line) && line.length > 40) ??
        "");
    return {
      ok: dimmed && reason.length > 0,
      unavailable: `dimmed: ${reason.slice(0, 160)}`,
      detail: `dimmed ${dimmed}; "${reason.slice(0, 160)}"`,
    };
  },
);
R(
  "prefs.close",
  "Preferences",
  "button",
  "Close",
  "Control-Comma, then Preferences' Close",
  "Preferences closes",
  async (ctx) => {
    const p = await openPrefs(ctx);
    await p.getByRole("button", { name: "Close" }).first().click();
    return until(async () => !(await prefsBox(ctx).isVisible()), 5_000);
  },
);
R(
  "chart.unsubscribe",
  "Top Charts",
  "button",
  "/Unsubscribe from .+/",
  "Top Charts, after subscribing to a show there, click its Unsubscribe from …",
  "the server's library no longer holds the show",
  async (ctx) => {
    const title = ctx.data.chartTitle;
    if (!title)
      return {
        ok: false,
        detail: "no show was subscribed from the chart (podcasts.chart.subscribe)",
      };
    await view(ctx, "Top Charts");
    const button = W(ctx)
      .getByRole("button", { name: `Unsubscribe from ${title}`, exact: true })
      .first();
    await button.waitFor({ timeout: 30_000 });
    await button.click();
    const needle = JSON.stringify(title).slice(1, -1);
    const dropped = await until(
      async () => !JSON.stringify(await lib(ctx)).includes(needle),
      10_000,
    );
    return { ok: dropped, detail: title };
  },
  { timeout: 90_000, notes: "kind: a subscribed chart entry's Unsubscribe button" },
);
R(
  "episode.pause",
  "show page (Episodes)",
  "button",
  "/Pause .+/",
  "while an episode plays, click its own Pause in the Episodes list",
  "the <audio> element pauses",
  async (ctx) => {
    if (!(await playing(ctx))) return { ok: false, detail: outside() };
    const pause = W(ctx)
      .getByRole("region", { name: "Episodes" })
      .getByRole("button", { name: /^Pause .+/ })
      .first();
    const label = (await pause.getAttribute("aria-label")) ?? "";
    await pause.click();
    const ok = await until(async () => (await astate(ctx))?.paused === true, 5_000);
    return { ok, detail: label.slice(0, 80) };
  },
  { timeout: 90_000, notes: "kind: the playing episode's Pause button of the Episodes list" },
);
R(
  "prefs.zoom",
  "Preferences",
  "button",
  "Zoom",
  "Control-Comma; Preferences' green button",
  "dimmed: a Preferences window has a fixed size, and the reason is shown on the button",
  async (ctx) => {
    await openPrefs(ctx);
    const win = ctx.page
      .locator(".mac-managed-window")
      .filter({ has: prefsBox(ctx) })
      .first();
    const zoom = prefsBox(ctx)
      .getByRole("button", { name: "Zoom", exact: true })
      .or(win.getByRole("button", { name: "Zoom", exact: true }))
      .first();
    const dimmed =
      (await zoom.getAttribute("aria-disabled")) === "true" || (await zoom.isDisabled());
    const reason = ((await zoom.getAttribute("title")) ?? "").trim();
    if (!dimmed) {
      // An enabled Zoom must zoom: try it, so a failure says what the click did.
      const before = await win.boundingBox();
      await zoom.click();
      const zoomed = await until(
        async () => (await win.getAttribute("data-zoomed")) !== null,
        3_000,
      );
      const after = await win.boundingBox();
      return {
        ok: false,
        detail: `enabled; a click zoomed ${zoomed} (${before?.width} -> ${after?.width})`,
      };
    }
    return {
      ok: reason.length > 0,
      unavailable: `dimmed: ${reason}`,
      detail: `dimmed; reason shown "${reason}"`,
    };
  },
);
R(
  "isolation.second-account",
  "another account",
  "account",
  "second account",
  "sign up a second account in a new browser context",
  "its Podcasts library holds no subscription or place of the first account's",
  async (ctx) => {
    const other = await ctx.newPage();
    try {
      await createAccount(other.page, ctx.base, person("podother", ctx.run));
      const theirs = JSON.stringify((await api(other.page, "GET", LIB)).json);
      return { ok: !theirs.includes(SHOW), detail: theirs.slice(0, 160) };
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
      return W(ctx);
    },
  },
  ...["Browse", "Top Charts", "Shows", "Episodes", "Downloaded", "Recently Updated"].map(
    (name) => ({
      name,
      enter: async (ctx) => {
        await side(ctx, name).click();
        await sleep(1500);
        return W(ctx);
      },
      menus: false,
    }),
  ),
  {
    name: "show page",
    enter: async (ctx) => {
      ctx.data.showOpen = false;
      await openShow(ctx);
      return W(ctx);
    },
    menus: false,
  },
  {
    name: "preferences",
    enter: async (ctx) => {
      await W(ctx).getByRole("searchbox").focus();
      await ctx.page.keyboard.press("Control+Comma");
      await ctx.page.locator(".mac-podcasts-preferences").first().waitFor({ timeout: 10_000 });
      return W(ctx);
    },
    window: async (ctx) => ctx.page.locator(".mac-podcasts-preferences").first(),
    leave: async (ctx) =>
      ctx.page
        .locator(".mac-podcasts-preferences")
        .first()
        .getByRole("button", { name: "Close" })
        .first()
        .click(),
    menus: false,
  },
];

await censusRun(app);
