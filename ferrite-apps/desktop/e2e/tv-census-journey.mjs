#!/usr/bin/env node
// TV census journey (round 3, R7): every control of TV, verified with real input against a served
// `ferrite dev`, in the engine --browser names. One ok/FAIL line per census id (see
// media-census-kit.mjs for the options and phases).
//
// YouTube refuses to play to data-centre networks (player error 150/101). TV must then say so in
// its own words and dim what it cannot do; that honest state is what the playback rows verify
// here, with a curl to youtube.com in the same minute recorded beside it.

import { execSync } from "node:child_process";
import {
  api,
  censusRun,
  chooseMenu,
  createAccount,
  ensureOpen,
  mainWindow,
  menuItemState,
  newestWindow,
  openApp,
  person,
  shellRows,
  signIn,
  sleep,
  until,
} from "./media-census-kit.mjs";

const VIDEO = "aqz-KE-bpKQ";
const LINK = `https://www.youtube.com/watch?v=${VIDEO}`;
const LIB = "/api/tv/library";
const PREFS = "/api/tv/preferences";

const app = {
  slug: "tv",
  name: "TV",
  menus: ["TV", "File", "Edit", "View", "Controls", "Account", "Window", "Help"],
  editUnavailable:
    "dimmed placeholder rows of the shell's Edit menu: TV puts no Edit commands of its own there",
  preferences: {
    text: "List Size",
    locate: (ctx) => prefsDialog(ctx),
    close: async (ctx) =>
      prefsDialog(ctx).getByRole("button", { name: "Cancel", exact: true }).click(),
  },
  crawlIgnore: [/^menu:Apple\|/, /^menu bar\|menuitem\|Apple$/],
  recover: tvRecover,
};

const W = (ctx) => mainWindow(ctx.page, app);
/**
 * Indices of the matched cards a click at their centre would reach: in view and not covered (read
 * from the page with elementFromPoint; the click itself is a real mouse click).
 */
const reachable = (cards) =>
  cards.evaluateAll((all) =>
    all
      .map((e, at) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return -1;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit && e.contains(hit) ? at : -1;
      })
      .filter((at) => at >= 0),
  );
const getJson = async (ctx, url) => (await api(ctx.page, "GET", url)).json;
const nav = (ctx, name) => W(ctx).getByRole("button", { name, exact: true });
/**
 * Show one of the toolbar's views, leaving a title page first by its Back (choosing a view in the
 * toolbar leaves a title page open).
 */
const view = async (ctx, name) => {
  await ensureOpen(ctx);
  const back = W(ctx).getByRole("button", { name: "Back", exact: true });
  for (let n = 0; n < 3 && (await back.isVisible().catch(() => false)); n += 1) {
    await back.click();
    await sleep(300);
  }
  await nav(ctx, name).click();
};
const player = (ctx) => W(ctx).locator("section.mac-tv-player");
const putTo = (page, path, timeout = 15_000) => {
  const reply = page.waitForResponse(
    (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === path,
    { timeout },
  );
  reply.catch(() => {});
  return reply;
};
/** youtube.com's answer from this machine, in the same minute as the step that needed it. */
const curlYouTube = () => {
  try {
    return execSync(
      "curl -s -o /dev/null -m 15 -w '%{http_code}' https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "curl failed";
  }
};

async function tvRecover(ctx, _row, { failed = false } = {}) {
  const { page } = ctx;
  for (let n = 0; n < 3 && (await page.getByRole("menu").count()) > 0; n += 1)
    await page.keyboard.press("Escape");
  if (!failed) return;
  const done = player(ctx).getByRole("button", { name: "Done" });
  if (await done.isVisible().catch(() => false))
    await done.click({ timeout: 5_000 }).catch(() => {});
  const prefs = page.getByRole("dialog", { name: "General" });
  if (await prefs.isVisible().catch(() => false))
    await prefs
      .getByRole("button", { name: "Cancel" })
      .click({ timeout: 5_000 })
      .catch(() => {});
}

const rows = [];
const R = (id, state, role, name, how, expected, check, extra = {}) =>
  rows.push({ id: `tv.${id}`, state, role, name, how, expected, check, ...extra });

// --- Navigation -------------------------------------------------------------------------------
for (const name of ["Watch Now", "Movies", "TV Shows", "Kids", "Library"]) {
  R(
    `nav.${name.toLowerCase().replace(/ /g, "-")}`,
    "TV",
    "button",
    name,
    `click ${name} in the toolbar`,
    `${name} is the pressed view and its content shows`,
    async (ctx) => {
      await ensureOpen(ctx);
      const before = await W(ctx).innerText();
      await nav(ctx, name).click();
      const pressed = await until(
        async () =>
          (await nav(ctx, name).getAttribute("aria-pressed")) === "true" ||
          (await nav(ctx, name).getAttribute("aria-current")) !== null ||
          (await nav(ctx, name).getAttribute("aria-selected")) === "true",
        5_000,
      );
      const after = await W(ctx).innerText();
      return {
        ok: pressed && (name === "Watch Now" || after !== before),
        detail: `pressed ${pressed}`,
      };
    },
  );
}
R(
  "card.title",
  "Watch Now",
  "button",
  "/(Big Buck Bunny|Caminandes 3: Llamigos|Sintel|Tears of Steel)( Blender)?/",
  "click the first, a middle and the last title card",
  "each opens that title's page, named by it",
  async (ctx) => {
    await ensureOpen(ctx);
    await view(ctx, "Watch Now");
    const cards = W(ctx).getByRole("button", {
      name: /^(Big Buck Bunny|Caminandes 3: Llamigos|Sintel|Tears of Steel)( Blender)?$/,
    });
    const names = await cards.evaluateAll((all) =>
      all.map((e) => e.getAttribute("aria-label") ?? e.textContent.trim()),
    );
    // First, middle and last of the cards the shelves show now (the rest are reached with More).
    const visible = await reachable(cards);
    const picks = [
      ...new Set([
        visible[0],
        visible[Math.floor(visible.length / 2)],
        visible[visible.length - 1],
      ]),
    ].filter((at) => at !== undefined);
    const opened = [];
    for (const at of picks) {
      await view(ctx, "Watch Now");
      await cards.nth(at).click();
      const title = names[at].replace(/\s*Blender$/, "").trim();
      const ok = await until(
        async () =>
          (await W(ctx)
            .getByRole("heading", { name: new RegExp(title) })
            .count()) > 0 || (await player(ctx).count()) > 0,
        8_000,
      );
      opened.push(`${names[at]}:${ok}`);
      if (
        await player(ctx)
          .isVisible()
          .catch(() => false)
      )
        await player(ctx)
          .getByRole("button", { name: "Done" })
          .click()
          .catch(() => {});
    }
    await view(ctx, "Watch Now");
    return {
      ok:
        picks.length >= 1 &&
        opened.length === picks.length &&
        opened.every((each) => each.endsWith("true")),
      detail: `${visible.length} of ${names.length} cards in view; ${opened.join(", ")}`,
    };
  },
  { notes: "kind: a title card of the Watch Now shelves (open movies)", timeout: 90_000 },
);
/**
 * Where a shelf (a region named after it) stands: the name of its first card and the scroll of its
 * row. A shelf pages by showing other cards in the same places (round 3 probe).
 */
const firstCardX = async (ctx, shelf) => {
  const region = W(ctx).getByRole("region", { name: shelf, exact: true });
  return region.evaluate((r) => {
    const scroller = [r, ...r.querySelectorAll("*")].find(
      (e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== "visible",
    );
    const card = [...r.querySelectorAll("button")].find(
      (b) => !/^(More in|Previous in) /.test(b.getAttribute("aria-label") ?? ""),
    );
    return `${scroller ? scroller.scrollLeft : 0}|${card ? (card.getAttribute("aria-label") ?? card.textContent).trim() : ""}`;
  });
};
R(
  "shelf.more",
  "Watch Now",
  "button",
  "/More in (Open Movies|For Everyone|Up Next)/",
  "click More in each shelf shown",
  "the shelf moves on: its first card slides left; dimmed when it holds nothing more",
  async (ctx) => {
    await ensureOpen(ctx);
    await view(ctx, "Watch Now");
    const buttons = W(ctx).getByRole("button", { name: /^More in / });
    const count = await buttons.count();
    const moved = [];
    for (let at = 0; at < count; at += 1) {
      const b = buttons.nth(at);
      const shelf = ((await b.getAttribute("aria-label")) ?? "").replace(/^More in /, "");
      const disabled = (await b.getAttribute("aria-disabled")) === "true" || (await b.isDisabled());
      if (disabled) {
        moved.push(`${shelf}: dimmed (nothing more)`);
        continue;
      }
      const before = await firstCardX(ctx, shelf);
      await b.click();
      // A shelf pages by showing other cards in its place: its first card changes.
      const ok = await until(async () => (await firstCardX(ctx, shelf)) !== before, 3_000);
      moved.push(`${shelf}: ${ok}`);
    }
    ctx.data.shelvesMoved = moved;
    return {
      ok:
        count >= 1 &&
        moved.every((m) => !m.endsWith("false")) &&
        moved.some((m) => m.endsWith("true")),
      detail: moved.join(", "),
    };
  },
  { notes: "kind: a shelf's More (scroll on) button" },
);
R(
  "shelf.previous",
  "Watch Now",
  "button",
  "/Previous in (Open Movies|For Everyone|Up Next)/",
  "after More, click Previous in each shelf",
  "the shelf moves back: its first card slides right; dimmed at its start",
  async (ctx) => {
    await ensureOpen(ctx);
    const buttons = W(ctx).getByRole("button", { name: /^Previous in / });
    const count = await buttons.count();
    const states = [];
    for (let at = 0; at < count; at += 1) {
      const b = buttons.nth(at);
      const shelf = ((await b.getAttribute("aria-label")) ?? "").replace(/^Previous in /, "");
      const disabled = (await b.getAttribute("aria-disabled")) === "true" || (await b.isDisabled());
      if (disabled) {
        states.push(`${shelf}: dimmed at start`);
        continue;
      }
      const before = await firstCardX(ctx, shelf);
      await b.click();
      const ok = await until(async () => (await firstCardX(ctx, shelf)) !== before, 3_000);
      states.push(`${shelf}: ${ok}`);
    }
    return {
      ok:
        count >= 1 &&
        states.every((s) => !s.endsWith("false")) &&
        states.some((s) => s.endsWith("true")),
      detail: states.join(", "),
    };
  },
  { notes: "kind: a shelf's Previous (scroll back) button" },
);

// --- A YouTube link: title, Watch Later, Up Next, the player ----------------------------------
R(
  "search.youtube-link",
  "TV",
  "searchbox",
  "Search",
  "paste a YouTube link into Search",
  "YouTube's own title shows in a YouTube Link card (oEmbed through the app's egress), or the app says why not",
  async (ctx) => {
    await ensureOpen(ctx);
    const field = W(ctx).getByRole("searchbox", { name: "Search" });
    await until(async () => {
      await field.fill(LINK);
      return (await field.inputValue()) === LINK;
    }, 10_000);
    const card = W(ctx).getByRole("region", { name: "YouTube Link" });
    const titled = await until(
      async () => /Big Buck Bunny/.test(await card.innerText().catch(() => "")),
      20_000,
    );
    const curl = titled
      ? ""
      : `; curl youtube.com oEmbed ${curlYouTube()} at ${new Date().toISOString()}`;
    return {
      ok: titled,
      detail: `${(await card.innerText().catch(() => "")).slice(0, 80)}${curl}`,
    };
  },
  { timeout: 60_000 },
);
R(
  "youtube.add-watch-later",
  "YouTube Link card",
  "button",
  "Add to Watch Later",
  "click Add to Watch Later on the link's card",
  "the server keeps the video in Watch Later",
  async (ctx) => {
    const saved = putTo(ctx.page, LIB);
    await W(ctx).getByRole("button", { name: "Add to Watch Later" }).first().click();
    await saved;
    const lib = await getJson(ctx, LIB);
    return {
      ok: !!lib.library?.watchLater?.includes(VIDEO),
      detail: JSON.stringify(lib.library?.watchLater),
    };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => ({
      ok: !!(await getJson(ctx, LIB)).library?.watchLater?.includes(VIDEO),
    }),
  },
);
R(
  "youtube.add-up-next",
  "YouTube Link card",
  "button",
  "Add to Up Next",
  "click Add to Up Next on the link's card",
  "the server keeps the video in Up Next",
  async (ctx) => {
    const saved = putTo(ctx.page, LIB);
    await W(ctx).getByRole("button", { name: "Add to Up Next" }).first().click();
    await saved;
    const lib = await getJson(ctx, LIB);
    return {
      ok: !!lib.library?.upNext?.includes(VIDEO),
      detail: JSON.stringify(lib.library?.upNext),
    };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => ({
      ok: !!(await getJson(ctx, LIB)).library?.upNext?.includes(VIDEO),
    }),
  },
);
R(
  "youtube.play",
  "TV",
  "shortcut",
  "Return in Search",
  "press Return with the link in Search",
  "TV's player opens with YouTube's official embed and either plays (its time moves) or says in TV's words that YouTube will not play here, offering Watch on YouTube; History keeps the video",
  async (ctx) => {
    const { page } = ctx;
    const saved = putTo(page, LIB);
    await W(ctx).getByRole("searchbox", { name: "Search" }).press("Enter");
    await player(ctx).waitFor({ timeout: 15_000 });
    await saved;
    // YouTube's embed is sampled while the player loads: TV takes it away once YouTube refuses.
    let frame = 0;
    let outcome = "neither";
    await until(async () => {
      frame = Math.max(frame, await player(ctx).locator(`iframe[src*="/embed/${VIDEO}"]`).count());
      const code = await player(ctx).getAttribute("data-error");
      if (code !== null) {
        outcome = `error ${code}`;
        return true;
      }
      const t =
        (await player(ctx)
          .locator('[data-time="elapsed"]')
          .textContent()
          .catch(() => "0:00")) ?? "0:00";
      if (t !== "0:00" && t !== "0:01") {
        outcome = "playing";
        return true;
      }
      return false;
    }, 45_000);
    ctx.data.youtube = outcome;
    const history = (await getJson(ctx, LIB)).library?.history?.[0]?.id === VIDEO;
    if (outcome === "playing") return { ok: frame === 1 && history, detail: "playing" };
    const message =
      (await player(ctx)
        .getByRole("alert")
        .textContent()
        .catch(() => "")) ?? "";
    const honest =
      /YouTube will not play this video here/.test(message) &&
      (await player(ctx).getByRole("button", { name: "Watch on YouTube" }).count()) === 1;
    const refusal = outcome === "error 150" || outcome === "error 101";
    const frameOk = frame === 1;
    const watch = await player(ctx).getByRole("button", { name: "Watch on YouTube" }).count();
    return {
      ok: frameOk && history && refusal && honest,
      detail: `${outcome}: ${message.slice(0, 100)}; embed frames ${frame}, history ${history}, Watch on YouTube ${watch}; curl youtube.com ${curlYouTube()} at ${new Date().toISOString()}`,
    };
  },
  {
    timeout: 90_000,
    notes:
      "YouTube refuses data-centre networks (player error 150/101): the honest refusal is what passes here",
  },
);
R(
  "player.watch-on-youtube",
  "player (refused)",
  "button",
  "Watch on YouTube",
  "click Watch on YouTube in the refused player",
  "YouTube's page for the video opens in a new browser tab",
  async (ctx) => {
    const { page } = ctx;
    if (ctx.data.youtube === "playing")
      return { ok: true, unavailable: "not shown: YouTube played here", detail: "playing" };
    const popup = page.context().waitForEvent("page", { timeout: 10_000 });
    await player(ctx).getByRole("button", { name: "Watch on YouTube" }).click();
    const tab = await popup;
    const url =
      tab.url() === "about:blank"
        ? await tab
            .waitForURL(/youtube/, { timeout: 10_000 })
            .then(() => tab.url())
            .catch(() => tab.url())
        : tab.url();
    await tab.close();
    return { ok: /youtube\.com\/watch\?v=aqz-KE-bpKQ/.test(url), detail: url };
  },
);
R(
  "player.enter-full-screen",
  "player",
  "button",
  "Enter Full Screen",
  "click Enter Full Screen in the player's controls; then leave full screen",
  "the player fills the screen (the browser's full screen); Escape or the player's own Exit Full Screen control brings it back",
  async (ctx) => {
    const { page } = ctx;
    const controls = player(ctx).getByRole("group", { name: "Playback controls" });
    await controls.getByRole("button", { name: "Enter Full Screen" }).click();
    const full = await page
      .waitForFunction(
        () => document.fullscreenElement?.classList.contains("mac-tv-player") ?? false,
        null,
        { timeout: 5_000 },
      )
      .then(
        () => true,
        () => false,
      );
    await page.keyboard.press("Escape");
    const out = () =>
      page
        .waitForFunction(() => !document.fullscreenElement, null, { timeout: 4_000 })
        .then(
          () => true,
          () => false,
        );
    let how = "Escape";
    let left = await out();
    if (!left) {
      // Escape does not leave the browser's full screen under Playwright: the player's own control.
      how = "Exit Full Screen";
      await page.mouse.move(400, 400);
      await page.mouse.move(420, 420, { steps: 3 });
      await controls
        .getByRole("button", { name: /Exit Full Screen/ })
        .first()
        .click({ timeout: 5_000 })
        .catch(() => {});
      left = await out();
    }
    return { ok: full && left, detail: `full ${full}, left by ${how} ${left}` };
  },
);
const refused = (ctx) => ctx.data.youtube?.startsWith("error ");
const elapsed = async (ctx) =>
  (await player(ctx)
    .locator('[data-time="elapsed"]')
    .textContent()
    .catch(() => "")) ?? "";
/** The player's elapsed time in seconds (m:ss or h:mm:ss). */
const seconds = (text) => text.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
for (const [slug, name] of [
  ["play", "Play"],
  ["skip-back", "Skip Back 10 Seconds"],
  ["skip-forward", "Skip Forward 10 Seconds"],
]) {
  R(
    `menu.controls.${slug}`,
    "menu:Controls",
    "menuitem",
    name,
    `Controls > ${name} with the player open`,
    slug === "play"
      ? "plays YouTube's player (its time moves); dimmed when YouTube refused this network"
      : `moves YouTube's player ${slug === "skip-back" ? "back" : "on"} 10 s from a place away from the ends; dimmed when YouTube refused this network`,
    async (ctx) => {
      const state = await menuItemState(ctx.page, "Controls", name);
      if (refused(ctx))
        return {
          ok: state.disabled,
          unavailable: "dimmed in the Controls menu: YouTube will not play this video here",
          detail: JSON.stringify(state),
        };
      if (slug === "play") {
        const before = await elapsed(ctx);
        await chooseMenu(ctx.page, "Controls", name);
        const moved = await until(async () => (await elapsed(ctx)) !== before, 5_000);
        return { ok: !state.disabled && moved, detail: `${before} -> ${await elapsed(ctx)}` };
      }
      // Away from the ends first (the 10-minute film), so a clamp cannot hide the jump.
      if (seconds(await elapsed(ctx)) < 30)
        for (let n = 0; n < 4; n += 1)
          await chooseMenu(ctx.page, "Controls", "Skip Forward 10 Seconds");
      const t0 = seconds(await elapsed(ctx));
      const started = Date.now();
      await chooseMenu(ctx.page, "Controls", name);
      await sleep(1000);
      const t1 = seconds(await elapsed(ctx));
      const played = (Date.now() - started) / 1000;
      const jump = t1 - t0 - played;
      const ok = slug === "skip-back" ? jump < -8 && jump > -13 : jump > 8 && jump < 13;
      return {
        ok: !state.disabled && ok,
        detail: `${t0} s -> ${t1} s in ${played.toFixed(1)} s of playing: jump ${jump.toFixed(1)} s`,
      };
    },
  );
}
R(
  "player.play",
  "player",
  "button",
  "Play",
  "the player's own Play",
  "plays YouTube's player (its time moves); dimmed when YouTube refused this network",
  async (ctx) => {
    const play = player(ctx)
      .getByRole("group", { name: "Playback controls" })
      .getByRole("button", { name: "Play", exact: true });
    const dimmed =
      (await play.getAttribute("aria-disabled")) === "true" || (await play.isDisabled());
    if (refused(ctx))
      return { ok: dimmed, unavailable: "dimmed: YouTube will not play this video here" };
    const before = await elapsed(ctx);
    await play.click();
    const moved = await until(async () => (await elapsed(ctx)) !== before, 5_000);
    return { ok: moved, detail: `${before} -> ${await elapsed(ctx)}` };
  },
);
R(
  "player.done",
  "player",
  "button",
  "Done",
  "click Done in the player",
  "the player closes, back to TV's views",
  async (ctx) => {
    await player(ctx).getByRole("button", { name: "Done" }).click();
    return until(async () => !(await player(ctx).isVisible()), 5_000);
  },
);
R(
  "menu.controls.watch-later",
  "menu:Controls",
  "menuitem",
  "/(Add to|Remove from) Watch Later/",
  "open the video's page (Up Next card), Controls > Remove from Watch Later, then Add to Watch Later",
  "the video leaves Watch Later and comes back, each kept by the server",
  async (ctx) => {
    const { page } = ctx;
    await ensureOpen(ctx);
    await W(ctx).getByRole("searchbox", { name: "Search" }).fill("");
    await view(ctx, "Watch Now");
    await W(ctx)
      .getByRole("region", { name: "Up Next" })
      .getByRole("button")
      .filter({ hasText: "Big Buck Bunny" })
      .first()
      .click();
    await W(ctx)
      .getByRole("button", { name: "Remove from Watch Later" })
      .waitFor({ timeout: 10_000 });
    let saved = putTo(page, LIB);
    await chooseMenu(page, "Controls", "Remove from Watch Later");
    await saved;
    const out = !(await getJson(ctx, LIB)).library?.watchLater?.includes(VIDEO);
    saved = putTo(page, LIB);
    await chooseMenu(page, "Controls", "Add to Watch Later");
    await saved;
    const back = !!(await getJson(ctx, LIB)).library?.watchLater?.includes(VIDEO);
    return { ok: out && back, detail: `out ${out}, back ${back}` };
  },
  { notes: "kind: the Controls menu's Watch Later toggle, named by the video's state" },
);
R(
  "menu.controls.add-to-up-next",
  "menu:Controls",
  "menuitem",
  "/(Add to|Remove from) Up Next/",
  "on the video's page, Controls > Remove from Up Next (or Add to Up Next), then the other",
  "the video leaves Up Next and comes back (or the reverse), each kept by the server; Up Next ends as it began",
  async (ctx) => {
    const { page } = ctx;
    const inUpNext = async () => !!(await getJson(ctx, LIB)).library?.upNext?.includes(VIDEO);
    const was = await inUpNext();
    const [first, second] = was
      ? ["Remove from Up Next", "Add to Up Next"]
      : ["Add to Up Next", "Remove from Up Next"];
    let saved = putTo(page, LIB);
    await chooseMenu(page, "Controls", first);
    await saved;
    const middle = await inUpNext();
    saved = putTo(page, LIB);
    await chooseMenu(page, "Controls", second);
    await saved;
    const end = await inUpNext();
    return {
      ok: middle !== was && end === was,
      detail: `in Up Next ${was} -> ${middle} -> ${end} (${first}, then ${second})`,
    };
  },
  { notes: "kind: the Controls menu's Up Next toggle, named by the video's state" },
);

// --- Preferences --------------------------------------------------------------------------------
const prefsDialog = (ctx) =>
  ctx.page
    .getByRole("dialog")
    .filter({ has: ctx.page.getByRole("tablist", { name: "TV preferences" }) })
    .first();
const openPrefs = async (ctx) => {
  await ensureOpen(ctx);
  if (
    !(await prefsDialog(ctx)
      .isVisible()
      .catch(() => false))
  )
    await chooseMenu(ctx.page, "TV", "Preferences…");
  await prefsDialog(ctx).waitFor({ timeout: 10_000 });
  return prefsDialog(ctx);
};
R(
  "prefs.downloads",
  "Preferences (General)",
  "checkbox",
  "Always check for available downloads",
  "TV > Preferences…",
  "dimmed, saying why (TV has no store); the window says dimmed settings are not available here",
  async (ctx) => {
    const g = await openPrefs(ctx);
    const box = g.getByRole("checkbox", { name: "Always check for available downloads" });
    const reason = (await box.getAttribute("title")) ?? "";
    const dimmed = (await box.getAttribute("aria-disabled")) === "true" || (await box.isDisabled());
    return {
      ok:
        dimmed &&
        /no store/.test(reason) &&
        /Dimmed settings are not available here/.test(await g.innerText()),
      detail: reason,
    };
  },
  {
    unavailable:
      "dimmed: TV here has no store to download from (the reason is the checkbox's own title)",
  },
);
R(
  "prefs.list-size",
  "Preferences (General)",
  "combobox",
  "List Size:",
  "choose Large in List Size, OK",
  "the server keeps List Size Large and the Library's cards are that wide (288 px)",
  async (ctx) => {
    const { page } = ctx;
    const g = await openPrefs(ctx);
    await g.getByRole("combobox", { name: "List Size:" }).click();
    await page.getByRole("option", { name: "Large" }).click();
    const kept = putTo(page, PREFS);
    await g.getByRole("button", { name: "OK" }).click();
    await kept;
    const stored = (await getJson(ctx, PREFS)).preferences?.listSize;
    await view(ctx, "Library");
    const width = await W(ctx)
      .getByRole("region", { name: "Watch Later" })
      .evaluate((e) => e.style.getPropertyValue("--mac-card-grid-min-card-width"))
      .catch(() => "");
    return { ok: stored === "large" && width === "288px", detail: `${stored} ${width}` };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => ({
      ok: (await getJson(ctx, PREFS)).preferences?.listSize === "large",
    }),
  },
);
R(
  "prefs.ok",
  "Preferences (General)",
  "button",
  "OK",
  "change List Size, OK",
  "the window closes and the choice is saved (verified with List Size)",
  async (ctx) => {
    const g = await openPrefs(ctx);
    await g.getByRole("button", { name: "OK" }).click();
    return until(async () => !(await g.isVisible()), 5_000);
  },
);
R(
  "prefs.cancel",
  "Preferences (General)",
  "button",
  "Cancel",
  "choose Small, then Cancel",
  "the window closes and nothing is saved: the server still holds Large",
  async (ctx) => {
    const { page } = ctx;
    const g = await openPrefs(ctx);
    await g.getByRole("combobox", { name: "List Size:" }).click();
    await page.getByRole("option", { name: "Small" }).click();
    await g.getByRole("button", { name: "Cancel" }).click();
    await sleep(800);
    const stored = (await getJson(ctx, PREFS)).preferences?.listSize;
    return { ok: !(await g.isVisible()) && stored === "large", detail: String(stored) };
  },
);
R(
  "prefs.save-race",
  "Preferences (General)",
  "combobox",
  "List Size:",
  "save Small and wait for it; then two quick saves: Medium then OK, reopen at once, Large then OK",
  "each save is answered; whatever order they land in the server ends with the last choice (Large); a 409 on a stale revision is answered by the client saving again on the new one; the rate of 409s is recorded",
  async (ctx) => {
    const { page } = ctx;
    const choose = async (size) => {
      const g = await openPrefs(ctx);
      await g.getByRole("combobox", { name: "List Size:" }).click();
      await page.getByRole("option", { name: size }).click();
      await g.getByRole("button", { name: "OK" }).click();
    };
    // A known starting value first, saved and confirmed, so the race below must change it.
    const first = putTo(page, PREFS);
    await choose("Small");
    await first;
    const start = (await getJson(ctx, PREFS)).preferences?.listSize;
    const statuses = [];
    const listen = (r) => {
      if (r.request().method() === "PUT" && new URL(r.url()).pathname === PREFS)
        statuses.push(r.status());
    };
    page.on("response", listen);
    await choose("Medium");
    await choose("Large");
    // Until the saves have been answered (two, plus one more per 409 answered by a retry) and none is in flight.
    const answered = await until(
      async () =>
        statuses.filter((s) => s === 200).length >= 1 &&
        statuses.length >= 2 + statuses.filter((s) => s === 409).length,
      20_000,
    );
    await sleep(1500);
    page.off("response", listen);
    const final = (await getJson(ctx, PREFS)).preferences?.listSize;
    const conflicts = statuses.filter((s) => s === 409).length;
    ctx.data.saveRace = { statuses, conflicts };
    return {
      ok:
        start === "small" && answered && final === "large" && statuses[statuses.length - 1] === 200,
      detail: `start ${start}; PUT statuses ${statuses.join(",")}: ${conflicts} of ${statuses.length} answered 409; final ${final}`,
    };
  },
  {
    notes:
      "R8 finding 2 (Firefox 409 on PUT /api/tv/preferences): settled here as behaviour, with the rate recorded per engine",
  },
);
R(
  "prefs.conflict",
  "Preferences (General), two browsers",
  "combobox",
  "List Size:",
  "sign in to the same account in a second browser whose live updates are cut off (as a browser that lost its live connection) and open TV there; choose Medium in the first browser (OK), then Small in the second, which still holds the older revision (OK)",
  "the second save is answered 409 on its stale revision and the client saves again on the new one (200); the server ends with Small and both browsers show it; the 409s and the revisions sent are recorded",
  async (ctx) => {
    const { page } = ctx;
    // The second browser's live stream (/live/me) is refused, so the first browser's save does not
    // reach it and its next save carries the older revision. Its page is not watched for console
    // errors: the refused stream is expected to log.
    const otherContext = await ctx.browser.newContext({ viewport: { width: 1440, height: 900 } });
    otherContext.setDefaultTimeout(10_000);
    await otherContext.route(
      (url) => url.pathname === "/live/me",
      (route) => route.abort(),
    );
    const other = { context: otherContext, page: await otherContext.newPage() };
    const pageErrors = [];
    other.page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 160)));
    try {
      await signIn(other.page, ctx.base, ctx.account);
      const loaded = other.page
        .waitForResponse(
          (r) => r.request().method() === "GET" && new URL(r.url()).pathname === PREFS,
          { timeout: 20_000 },
        )
        .catch(() => null);
      await openApp(other.page, "TV");
      const stale = await loaded;
      const staleRev = stale ? (await stale.json().catch(() => ({})))?.rev : undefined;
      const dialogOn = (p) =>
        p
          .getByRole("dialog")
          .filter({ has: p.getByRole("tablist", { name: "TV preferences" }) })
          .first();
      const choose = async (p, size) => {
        const d = dialogOn(p);
        if (!(await d.isVisible().catch(() => false))) await chooseMenu(p, "TV", "Preferences…");
        await d.waitFor({ timeout: 10_000 });
        await d.getByRole("combobox", { name: "List Size:" }).click();
        await p.getByRole("option", { name: size }).click();
        await d.getByRole("button", { name: "OK" }).click();
      };
      const shown = async (p) => {
        await chooseMenu(p, "TV", "Preferences…");
        const d = dialogOn(p);
        await d.waitFor({ timeout: 10_000 });
        const size = (
          (await d.getByRole("combobox", { name: "List Size:" }).textContent()) ?? ""
        ).trim();
        await d.getByRole("button", { name: "Cancel" }).click();
        return size;
      };
      const statuses = [];
      const sent = [];
      other.page.on("response", (r) => {
        if (r.request().method() !== "PUT" || new URL(r.url()).pathname !== PREFS) return;
        statuses.push(r.status());
        sent.push(r.request().postDataJSON()?.rev);
      });
      await ensureOpen(ctx);
      const firstSaved = putTo(page, PREFS).catch(() => null);
      await choose(page, "Medium");
      const first = (await firstSaved)?.status();
      await choose(other.page, "Small");
      const settled = await until(
        async () =>
          statuses.includes(200) && statuses.length >= 1 + statuses.filter((s) => s === 409).length,
        20_000,
      );
      await sleep(1000);
      const final = (await getJson(ctx, PREFS)).preferences?.listSize;
      const conflicts = statuses.filter((s) => s === 409).length;
      ctx.data.conflict = { statuses, conflicts };
      const there = await shown(other.page);
      const here = await shown(page);
      // Only a 409 answered by a successful save again shows the stale-revision path ran; a second
      // browser already current never met it, and that is reported, not passed.
      const recovered =
        conflicts > 0 && statuses.indexOf(200, statuses.indexOf(409)) > statuses.indexOf(409);
      const path =
        conflicts === 0
          ? "the stale-revision path was not exercised: the second browser's save met no 409"
          : `recovered ${recovered}`;
      return {
        ok:
          first === 200 &&
          settled &&
          recovered &&
          final === "small" &&
          /Small/.test(there) &&
          /Small/.test(here) &&
          pageErrors.length === 0,
        detail: `second browser loaded rev ${staleRev}; first browser PUT ${first}; second browser PUT statuses ${statuses.join(",")} sending revs ${sent.join(",")} (${conflicts} answered 409; ${path}); server ${final}; second browser shows ${there}, first browser shows ${here}; page errors ${pageErrors.join(" | ") || "none"}`,
      };
    } finally {
      await other.context.close();
    }
  },
  {
    timeout: 150_000,
    notes:
      "R8 finding 2: the stale-revision path, met with two browsers of one account; the 409 count is recorded",
  },
);

// --- Library after a reload, isolation ------------------------------------------------------------
R(
  "library.sections",
  "Library",
  "button",
  "Library",
  "reload, open TV, Library",
  "Watch Later and History hold the video, Up Next too (Watch Now), as the server keeps them",
  async (ctx) => {
    const { page } = ctx;
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    await openApp(page, "TV");
    await view(ctx, "Watch Now");
    const upNext = await W(ctx)
      .getByRole("region", { name: "Up Next" })
      .innerText()
      .catch(() => "");
    await view(ctx, "Library");
    const later = await W(ctx)
      .getByRole("region", { name: "Watch Later" })
      .innerText()
      .catch(() => "");
    const history = await W(ctx)
      .getByRole("region", { name: "History" })
      .innerText()
      .catch(() => "");
    return {
      ok:
        /Big Buck Bunny/.test(upNext) &&
        /Big Buck Bunny/.test(later) &&
        /Big Buck Bunny/.test(history),
      detail: `up next ${/Big Buck Bunny/.test(upNext)}, later ${/Big Buck Bunny/.test(later)}, history ${/Big Buck Bunny/.test(history)}`,
    };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => {
      await view(ctx, "Library");
      const later = await W(ctx)
        .getByRole("region", { name: "Watch Later" })
        .innerText()
        .catch(() => "");
      const history = await W(ctx)
        .getByRole("region", { name: "History" })
        .innerText()
        .catch(() => "");
      const lib = (await getJson(ctx, LIB)).library;
      return {
        ok:
          /Big Buck Bunny/.test(later) &&
          /Big Buck Bunny/.test(history) &&
          lib?.history?.[0]?.id === VIDEO,
        detail: `rev ${(await getJson(ctx, LIB)).rev}`,
      };
    },
  },
);
R(
  "isolation.second-account",
  "another account",
  "account",
  "second account",
  "sign up a second account in a new browser context and open TV",
  "it has no TV library or preferences of the first account's",
  async (ctx) => {
    const other = await ctx.newPage();
    try {
      await createAccount(other.page, ctx.base, person("tvother", ctx.run));
      const lib = (await api(other.page, "GET", LIB)).json;
      const prefs = (await api(other.page, "GET", PREFS)).json;
      return {
        ok: !JSON.stringify(lib).includes(VIDEO) && prefs.preferences?.listSize !== "large",
        detail: `${JSON.stringify(lib.library)} ${JSON.stringify(prefs.preferences)}`,
      };
    } finally {
      await other.context.close();
    }
  },
);

// --- Crawled controls of the other views and of Preferences ------------------------------------
R(
  "card.movies",
  "Movies",
  "button",
  "/(Spring|Cosmos Laundromat|Agent 327: Operation Barbershop|Charge)( Blender( Studio)?| Blender Studio)?/",
  "in Movies, click the first, a middle and the last title card",
  "each opens that title's page, named by it",
  async (ctx) => {
    await ensureOpen(ctx);
    await view(ctx, "Movies");
    const cards = W(ctx).getByRole("button", {
      name: /^(Spring|Cosmos Laundromat|Agent 327: Operation Barbershop|Charge)( Blender( Studio)?| Blender Studio)?$/,
    });
    const n = await cards.count();
    const opened = [];
    const visible = await reachable(cards);
    for (const at of [
      ...new Set([
        visible[0],
        visible[Math.floor(visible.length / 2)],
        visible[visible.length - 1],
      ]),
    ].filter((at) => at !== undefined)) {
      await view(ctx, "Movies");
      const label = ((await cards.nth(at).textContent()) ?? "")
        .replace(/\s*Blender( Studio)?$/, "")
        .trim();
      await cards.nth(at).click();
      const ok = await until(
        async () =>
          (await W(ctx)
            .getByRole("heading", { name: new RegExp(label.split(":")[0]) })
            .count()) > 0,
        8_000,
      );
      opened.push(`${label}:${ok}`);
    }
    await view(ctx, "Watch Now");
    return {
      ok: n >= 3 && opened.length >= 1 && opened.every((x) => x.endsWith("true")),
      detail: `${visible.length} of ${n} cards in view; ${opened.join(", ")}`,
    };
  },
  { notes: "kind: a title card of the Movies view (open movies)", timeout: 90_000 },
);
R(
  "title.back",
  "title page",
  "button",
  "Back",
  "open Sintel's title page from Watch Now, click Back",
  "Watch Now shows again",
  async (ctx) => {
    await ensureOpen(ctx);
    await view(ctx, "Watch Now");
    await W(ctx)
      .getByRole("button", { name: /^Sintel/ })
      .first()
      .click();
    const back = W(ctx).getByRole("button", { name: "Back", exact: true });
    await back.waitFor({ timeout: 8_000 });
    await back.click();
    const ok = await until(
      async () =>
        !(await back.isVisible()) &&
        (await W(ctx)
          .getByRole("button", { name: /^More in / })
          .count()) > 0,
      5_000,
    );
    return ok;
  },
);
R(
  "card.library",
  "Library",
  "button",
  "/Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film( Blender)?/",
  "in Library, click the YouTube video's card; then Back",
  "the video's title page opens, named by it, offering Play; Back returns to Library",
  async (ctx) => {
    await view(ctx, "Library");
    await W(ctx)
      .getByRole("button", { name: /^Big Buck Bunny 60fps 4K/ })
      .first()
      .click();
    const titled = await until(
      async () =>
        (await W(ctx)
          .getByRole("heading", { name: /Big Buck Bunny 60fps 4K/ })
          .count()) > 0,
      8_000,
    );
    const play = await W(ctx)
      .getByRole("button", { name: "Play", exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    const back = W(ctx).getByRole("button", { name: "Back", exact: true });
    await back.click();
    const library = await until(
      async () =>
        !(await back.isVisible()) &&
        (await W(ctx).getByRole("region", { name: "Watch Later" }).isVisible()),
      5_000,
    );
    return {
      ok: titled && play && library,
      detail: `title page ${titled}, Play ${play}, back to Library ${library}`,
    };
  },
  { notes: "kind: a YouTube video's card in Library (Watch Later and History)" },
);
R(
  "library.clear-history",
  "Library",
  "button",
  "Clear History",
  "a new account: paste the link in Search, Return, Done, then Library > Clear History",
  "History empties on screen and on the server (other accounts' and other sections untouched)",
  async (ctx) => {
    const other = await ctx.newPage();
    try {
      const { page } = other;
      await createAccount(page, ctx.base, person("tvhist", ctx.run));
      await openApp(page, "TV");
      const w = mainWindow(page, app);
      const field = w.getByRole("searchbox", { name: "Search" });
      await until(async () => {
        await field.fill(LINK);
        return (await field.inputValue()) === LINK;
      }, 10_000);
      // Return plays the link once TV has recognised it (its YouTube Link card shows).
      await w.getByRole("region", { name: "YouTube Link" }).waitFor({ timeout: 20_000 });
      await field.press("Enter");
      const p = w.locator("section.mac-tv-player");
      await p.waitFor({ timeout: 15_000 });
      await until(
        async () => (await api(page, "GET", LIB)).json.library?.history?.length > 0,
        10_000,
      );
      await p.getByRole("button", { name: "Done" }).click();
      await w.getByRole("button", { name: "Library", exact: true }).click();
      const cleared = putTo(page, LIB);
      await w.getByRole("button", { name: "Clear History" }).click();
      await cleared;
      const history = (await api(page, "GET", LIB)).json.library?.history ?? [];
      const shown = await w
        .getByRole("region", { name: "History" })
        .innerText()
        .catch(() => "");
      return {
        ok: history.length === 0 && !/Big Buck Bunny/.test(shown),
        detail: `server history ${history.length}`,
      };
    } finally {
      await other.context.close();
    }
  },
  { timeout: 120_000 },
);
for (const tab of ["General", "Playback", "Files", "Restrictions", "Advanced"]) {
  R(
    `prefs.tab.${tab.toLowerCase()}`,
    "Preferences",
    "tab",
    tab,
    `TV > Preferences…, click the ${tab} tab`,
    `the ${tab} pane shows (its tab selected)`,
    async (ctx) => {
      const g = await openPrefs(ctx);
      await g.getByRole("tab", { name: tab, exact: true }).click();
      const ok = await until(
        async () =>
          (await g.getByRole("tab", { name: tab, exact: true }).getAttribute("aria-selected")) ===
            "true" && (await g.getByRole("tabpanel", { name: tab }).isVisible()),
        4_000,
      );
      await g.getByRole("tab", { name: "General", exact: true }).click();
      return ok;
    },
  );
}
R(
  "prefs.checkboxes-in-library",
  "Preferences (General)",
  "checkbox",
  "Checkboxes in library",
  "TV > Preferences…, General",
  "offered, as it now acts on the library",
  async (ctx) => {
    const g = await openPrefs(ctx);
    const box = g.getByRole("checkbox", { name: "Checkboxes in library", exact: true });
    const enabled = (await box.getAttribute("aria-disabled")) !== "true" && (await box.isEnabled());
    return { ok: enabled, detail: `enabled ${enabled}` };
  },
);
for (const label of ["Movies", "TV Shows"]) {
  R(
    `prefs.${label.toLowerCase().replace(/\W+/g, "-")}`,
    "Preferences (General)",
    "checkbox",
    label,
    "TV > Preferences…, General",
    "dimmed, and the pane says why (no store, nothing synced to a device)",
    async (ctx) => {
      const g = await openPrefs(ctx);
      const box = g.getByRole("checkbox", { name: label, exact: true });
      const dimmed =
        (await box.getAttribute("aria-disabled")) === "true" || (await box.isDisabled());
      const said = /Dimmed settings are not available here/.test(await g.innerText());
      return { ok: dimmed && said, detail: `dimmed ${dimmed}, reason shown ${said}` };
    },
    {
      unavailable:
        "dimmed: TV here plays YouTube videos: there is no store, nothing is bought or downloaded, and nothing is synced to a device (said in the pane)",
    },
  );
}
R(
  "prefs.help",
  "Preferences",
  "button",
  "Help",
  "TV > Preferences…, Help",
  "Help Viewer opens on TV's help; where Help Viewer has no TV help (its Help menu item is dimmed saying so), the button is dimmed with that reason shown",
  async (ctx) => {
    const { page } = ctx;
    const g = await openPrefs(ctx);
    const help = g.getByRole("button", { name: "Help", exact: true });
    const dimmed =
      (await help.getAttribute("aria-disabled")) === "true" || (await help.isDisabled());
    if (dimmed) {
      const described = await help.getAttribute("aria-describedby");
      const reason =
        ((await help.getAttribute("title")) ?? "") ||
        (described
          ? ((await page
              .locator(`[id="${described}"]`)
              .textContent()
              .catch(() => "")) ?? "")
          : "");
      await g
        .getByRole("button", { name: "Cancel" })
        .click()
        .catch(() => {});
      return {
        ok: reason.trim().length > 0,
        unavailable: `dimmed: ${reason.trim()}`,
        detail: `dimmed; reason "${reason.trim()}"`,
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
    const text = viewer ? await viewer.innerText() : "";
    if (viewer && opened)
      await viewer
        .getByRole("button", { name: "Close", exact: true })
        .first()
        .click()
        .catch(() => {});
    if (
      await prefsDialog(ctx)
        .isVisible()
        .catch(() => false)
    )
      await prefsDialog(ctx)
        .getByRole("button", { name: "Cancel" })
        .click()
        .catch(() => {});
    return {
      ok: opened && /TV/.test(text),
      detail: `opened ${opened}: ${text.replace(/\s+/g, " ").slice(0, 120)}`,
    };
  },
);

app.rows = [...shellRows(app), ...rows];
app.open = async (ctx) => {
  await openApp(ctx.page, "TV");
  await mainWindow(ctx.page, app).waitFor({ state: "visible", timeout: 20_000 });
  return mainWindow(ctx.page, app);
};
app.states = [
  {
    name: "main",
    enter: async (ctx) => {
      await ensureOpen(ctx);
      await view(ctx, "Watch Now");
    },
  },
  {
    name: "movies",
    enter: async (ctx) => {
      await view(ctx, "Movies");
    },
    menus: false,
  },
  {
    name: "tv shows",
    enter: async (ctx) => {
      await nav(ctx, "TV Shows").click();
    },
    menus: false,
  },
  {
    name: "kids",
    enter: async (ctx) => {
      await nav(ctx, "Kids").click();
    },
    menus: false,
  },
  {
    name: "library",
    enter: async (ctx) => {
      await view(ctx, "Library");
    },
    menus: false,
  },
  {
    name: "title page",
    enter: async (ctx) => {
      await view(ctx, "Watch Now");
      await W(ctx)
        .getByRole("button", { name: /^Sintel/ })
        .first()
        .click();
      await sleep(800);
    },
    menus: false,
  },
  {
    name: "preferences",
    enter: async (ctx) => {
      await chooseMenu(ctx.page, "TV", "Preferences…");
      await prefsDialog(ctx).waitFor({ timeout: 10_000 });
    },
    window: async (ctx) => (await newestWindow(ctx.page, app.slug)) ?? prefsDialog(ctx),
    leave: async (ctx) => prefsDialog(ctx).getByRole("button", { name: "Cancel" }).click(),
    menus: false,
  },
];

await censusRun(app);
