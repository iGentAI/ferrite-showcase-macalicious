#!/usr/bin/env node
// Maps census (R5, round 3): one `ok`/`FAIL` line per census id of Maps, real input only, against `ferrite dev
// --fresh` serving the packed site, signed in as a real account made at the login window. Places come from the
// server's search (Nominatim, through the app's declared egress); the map is OpenStreetMap's tiles. The browser's
// location is granted and set to Paris, so Show Your Current Location has somewhere to go.
//
// Phases: `write` drives every control and leaves a state file; `restart-check` runs after a real same-root
// restart of `ferrite dev` and checks that the favourite and the guide are kept for the account and not seen by a
// second account.
//
//   node e2e/maps-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase all|write|restart-check] [--out <dir>] [--headed] [--only <id prefix,...>]

import { execSync } from "node:child_process";
import { engineFamily } from "./journey-kit.mjs";
import { messagesComposerHolds } from "./media-census-kit.mjs";
import {
  accountFor,
  api,
  appWindow,
  census,
  closeAppWindow,
  closeMenus,
  crawlMenus,
  launchBrowser,
  loadState,
  openApp,
  options,
  person,
  reloadDesktop,
  saveState,
} from "./r5-census-kit.mjs";
import { commonRows } from "./r5-common-rows.mjs";
import { mapRows } from "./r5-map-rows.mjs";

const opts = options();
const { base, out, browserName, phase } = opts;
const c = census("maps", opts);
const PLACES = "/api/maps/places";
const QUERY = "Golden Gate Bridge";
const GUIDE = "R5 Trips";
const PARIS = { latitude: 48.8584, longitude: 2.2945, accuracy: 25 };
const BRIDGE = { latitude: 37.8199, longitude: -122.4783, accuracy: 25 };
const meta = (state, role, name, how, expect, persists = "none") => ({
  state,
  role,
  name,
  how,
  expect,
  persists,
});

const maps = (page) => appWindow(page, "Maps");
const field = (page) =>
  maps(page).getByRole("searchbox", { name: "Search for a place or address" });
// The place card is a popover the page holds outside the window's element (it is not inside the region in the DOM).
const card = (page) => page.getByRole("dialog", { name: QUERY });
const tree = (page) => maps(page).getByRole("tree", { name: "Places" });
const places = async (page) => (await api(page, "GET", PLACES)).text;
/** Whether the places document has a guide named `guide` holding a place named `place`. */
function guideHolds(doc, guide, place) {
  const nodes = [doc];
  while (nodes.length > 0) {
    const node = nodes.pop();
    if (!node || typeof node !== "object") continue;
    if (node.name === guide && Array.isArray(node.places))
      return node.places.some((held) => JSON.stringify(held).includes(place));
    nodes.push(...Object.values(node));
  }
  return false;
}
// Geolocation for Show Your Current Location; in the Chromium family the page may also write the clipboard, as a
// browser lets the page in front do (Copy Link, then Control+V in the search field).
const context = {
  contextOptions: {
    permissions: [
      "geolocation",
      ...(engineFamily(browserName) === "chromium" ? ["clipboard-read", "clipboard-write"] : []),
    ],
    geolocation: BRIDGE,
  },
};

function providerEvidence() {
  try {
    const code = execSync(
      'curl -sS -o /dev/null -w "%{http_code}" --max-time 10 https://nominatim.openstreetmap.org/',
      { encoding: "utf8" },
    );
    return `nominatim.openstreetmap.org ${code} at ${new Date().toISOString()}`;
  } catch (error) {
    return `nominatim.openstreetmap.org unreachable (${String(error.message).split("\n")[0].slice(0, 80)}) at ${new Date().toISOString()}`;
  }
}
async function search(page) {
  await field(page).click();
  await field(page).fill(QUERY);
  await field(page).press("Enter");
  // Several places are listed first, and the card comes with the row chosen; one place shows at once.
  const results = page.getByRole("listbox", { name: "Search Results" });
  const shown = card(page)
    .waitFor({ timeout: 20_000 })
    .then(
      () => true,
      () => false,
    );
  const listed = results
    .getByRole("option", { name: new RegExp(QUERY) })
    .first()
    .waitFor({ timeout: 20_000 })
    .then(
      () => true,
      () => false,
    );
  if (await Promise.race([shown, listed.then((there) => there || shown)])) {
    if (await results.isVisible().catch(() => false)) {
      await results
        .getByRole("option", { name: new RegExp(QUERY) })
        .first()
        .click();
    }
  }
  return card(page)
    .waitFor({ timeout: 20_000 })
    .then(
      () => true,
      () => false,
    );
}
const showPlaces = async (page) => {
  if (
    !(await tree(page)
      .isVisible()
      .catch(() => false))
  )
    await maps(page).getByRole("button", { name: "Places" }).click();
  await tree(page).waitFor({ timeout: 5_000 });
};
/** Where a link of the place card went: Safari's address field (a listed site), or a new browser tab. */
async function followLink(page, link) {
  const href = await link.getAttribute("href");
  const tab = page
    .context()
    .waitForEvent("page", { timeout: 8_000 })
    .catch(() => null);
  await link.click();
  const safari = appWindow(page, "Safari");
  const inSafari = await safari.waitFor({ timeout: 8_000 }).then(
    () => true,
    () => false,
  );
  let where = "";
  if (inSafari) {
    const f = safari.getByRole("textbox", { name: "Search or enter website name" });
    for (let i = 0; i < 40 && !where.startsWith("http"); i += 1) {
      where = await f.inputValue();
      await page.waitForTimeout(250);
    }
    await closeAppWindow(page, "Safari").catch(() => {});
  }
  const opened = await tab;
  if (!inSafari && opened) where = opened.url();
  await opened?.close().catch(() => {});
  return { href, where, inSafari };
}

async function writePhase(browser, page) {
  const kept = {};
  await openApp(page, "Maps");
  await page.waitForTimeout(1_500);
  await c.crawl("window", maps(page));

  await c.check(
    "maps.search.place",
    async () => {
      const answered = page
        .waitForResponse((r) => new URL(r.url()).pathname === "/api/maps/search", {
          timeout: 20_000,
        })
        .catch(() => null);
      const shown = await search(page);
      const reply = await (await answered)?.json().catch(() => null);
      if (!shown)
        return {
          ok: false,
          detail: `no place card; reply ${JSON.stringify(reply)?.slice(0, 120)}; ${providerEvidence()}`,
        };
      await c.crawl("place card", card(page));
      return {
        ok: true,
        detail: `${(reply?.places ?? reply?.results ?? []).length} places from the server; the card shows ${QUERY}`,
      };
    },
    meta(
      "window",
      "searchbox",
      "Search for a place or address",
      `type "${QUERY}" and press Return`,
      "the place's card opens, from the server's search",
      "restart",
    ),
  );
  await c.check(
    "maps.search.clear",
    async () => {
      await maps(page).getByRole("button", { name: "Clear" }).click();
      const empty = (await field(page).inputValue()) === "";
      await search(page);
      return { ok: empty, detail: `the field is empty: ${empty}` };
    },
    meta("window", "button", "Clear", "click Clear in the search field", "the field empties"),
  );
  await c.check(
    "maps.map.pin",
    async () => {
      await page.keyboard.press("Escape");
      await card(page)
        .waitFor({ state: "hidden", timeout: 5_000 })
        .catch(() => {});
      await maps(page)
        .getByRole("application")
        .getByRole("button", { name: QUERY })
        .first()
        .click();
      return card(page)
        .waitFor({ timeout: 8_000 })
        .then(() => true);
    },
    meta(
      "window",
      "button",
      QUERY,
      "close the card, click the place's pin on the map",
      "the place's card opens again",
    ),
  );
  await c.check(
    "maps.place.favorite",
    async () => {
      const saved = page.waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === PLACES,
        { timeout: 10_000 },
      );
      saved.catch(() => {});
      await card(page).getByRole("button", { name: "Favorite" }).click();
      const status = (await saved).status();
      await showPlaces(page);
      const listed = await tree(page)
        .getByRole("group", { name: "Favorites" })
        .getByRole("treeitem", { name: QUERY })
        .count();
      kept.favorite = QUERY;
      return {
        ok: status === 200 && listed === 1 && (await places(page)).includes(QUERY),
        detail: `PUT ${status}; in Favorites ${listed}`,
      };
    },
    meta(
      "place card",
      "button",
      "Favorite",
      "on the place's card, click Favorite",
      "the place is in Favorites, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "maps.place.add-to-guide",
    async () => {
      // Add to Guide lists the person's guides, each to tick; with none it says to make one in the
      // sidebar. So the guide is made there first (New Guide), then ticked on the card.
      await showPlaces(page);
      const guides = tree(page).getByRole("group", { name: "Guides" });
      if ((await guides.getByRole("treeitem", { name: GUIDE }).count()) === 0) {
        await maps(page).getByRole("button", { name: "New Guide" }).click();
        const name = maps(page).getByRole("textbox", { name: "New guide name" });
        await name.fill(GUIDE);
        await name.press("Enter");
        await guides.getByRole("treeitem", { name: GUIDE }).first().waitFor({ timeout: 10_000 });
      }
      if (
        !(await card(page)
          .isVisible()
          .catch(() => false))
      )
        await search(page);
      await card(page).getByRole("button", { name: "Add to Guide" }).click();
      const menu = page.getByRole("menu", { name: "Add to Guide" });
      await c.crawl("add to guide menu", menu);
      const saved = page.waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === PLACES,
        { timeout: 10_000 },
      );
      saved.catch(() => {});
      await menu.getByRole("menuitemcheckbox", { name: GUIDE }).click();
      const status = (await saved).status();
      await closeMenus(page);
      const held = guideHolds(JSON.parse((await places(page)) || "null"), GUIDE, QUERY);
      kept.guide = held ? GUIDE : null;
      return {
        ok: status === 200 && held,
        detail: `PUT ${status}; ${GUIDE} holds ${QUERY}: ${held}`,
      };
    },
    meta(
      "place card",
      "button",
      "Add to Guide",
      "make a guide in the sidebar, then on the card click Add to Guide and tick it",
      "the guide holds the place, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "maps.place.wikipedia",
    async () => {
      if (
        !(await card(page)
          .isVisible()
          .catch(() => false))
      )
        await search(page);
      const r = await followLink(page, card(page).getByRole("link", { name: "Open Wikipedia" }));
      await openApp(page, "Maps");
      return {
        ok: Boolean(r.href) && r.where === new URL(r.href).href,
        detail: `${r.href} -> ${r.inSafari ? "Safari" : "a browser tab"} at ${r.where}`,
      };
    },
    meta(
      "place card",
      "link",
      "Open Wikipedia",
      "on the card, click Open Wikipedia",
      "the article opens (in Safari, a listed site)",
    ),
  );
  await c.check(
    "maps.place.openstreetmap",
    async () => {
      if (
        !(await card(page)
          .isVisible()
          .catch(() => false))
      )
        await search(page);
      const r = await followLink(page, card(page).getByRole("link", { name: "Open Map" }));
      await openApp(page, "Maps");
      return {
        ok: Boolean(r.href) && r.where.startsWith("https://www.openstreetmap.org/"),
        detail: `${r.href} -> ${r.inSafari ? "Safari" : "a browser tab"} at ${r.where}`,
      };
    },
    meta(
      "place card",
      "link",
      "Open Map",
      "on the card, click Open Map",
      "OpenStreetMap's page of the place opens",
    ),
  );
  const share = async (scope) => {
    await scope.getByRole("button", { name: "Share" }).first().click();
    return page.getByRole("menu").last();
  };
  /** What Copy Link put on the clipboard: pasted into the search field once Maps says it copied it. */
  const pasteInField = async () => {
    const said = await maps(page)
      .getByText(/Link Copied|could not be copied|cannot copy/)
      .first()
      .innerText({ timeout: 5_000 })
      .catch(() => "(nothing said)");
    await page.keyboard.press("Escape");
    await field(page).click();
    await field(page).fill("");
    await page.keyboard.press("Control+KeyV");
    const pasted = await field(page).inputValue();
    return pasted || `(empty; Maps said "${said}")`;
  };
  await c.check(
    "maps.place.share-copy-link",
    async () => {
      if (
        !(await card(page)
          .isVisible()
          .catch(() => false))
      )
        await search(page);
      // Copy Link copies the place's OpenStreetMap link: the card's Open Map link.
      const expected = await card(page)
        .getByRole("link", { name: "Open Map" })
        .getAttribute("href");
      const menu = await share(card(page));
      await c.crawl("share menu", menu);
      await menu.getByRole("menuitem", { name: "Copy Link" }).click();
      kept.link = await pasteInField();
      await search(page);
      return { ok: Boolean(expected) && kept.link === expected, detail: `pasted "${kept.link}"` };
    },
    meta(
      "place card",
      "menuitem",
      "Copy Link",
      "on the card, Share > Copy Link, Control+V in the search field",
      "the place's OpenStreetMap link is on the clipboard",
    ),
  );
  // The Share menus, the card's and the toolbar's, each hand the place's link to Messages
  // (desktop-share-link.tsx `shareLink`), which opens: what was handed on is heard on the page.
  const shareToMessages = async (scope) => {
    if (
      !(await card(page)
        .isVisible()
        .catch(() => false))
    )
      await search(page);
    await page.evaluate(() => {
      window.__mapsShared = null;
      window.addEventListener(
        "macalicious:share-link",
        (event) => {
          window.__mapsShared = event.detail;
        },
        { once: true },
      );
    });
    await (await share(scope())).getByRole("menuitem", { name: "Messages", exact: true }).click();
    const shared = await page.evaluate(() => window.__mapsShared);
    const composed = await messagesComposerHolds(page, kept.link);
    await openApp(page, "Maps");
    return {
      ok:
        composed && shared?.to === "messages" && shared.url === kept.link && shared.title === QUERY,
      detail: `the message holds the link ${composed}; handed ${JSON.stringify(shared)}`,
    };
  };
  await c.check(
    "maps.place.share-messages",
    async () => shareToMessages(() => card(page)),
    meta(
      "place card",
      "menuitem",
      "Messages",
      "on the card, Share > Messages",
      "the place's link is handed to Messages, whose new message holds it",
    ),
  );
  await c.check(
    "maps.share.messages",
    async () => shareToMessages(() => maps(page).getByRole("toolbar")),
    meta(
      "toolbar share menu",
      "menuitem",
      "Messages",
      "the toolbar's Share > Messages",
      "the place's link is handed to Messages, whose new message holds it",
    ),
  );
  await c.check(
    "maps.share.copy-link",
    async () => {
      if (
        !(await card(page)
          .isVisible()
          .catch(() => false))
      )
        await search(page);
      await (await share(maps(page).getByRole("toolbar")))
        .getByRole("menuitem", { name: "Copy Link" })
        .click();
      const pasted = await pasteInField();
      await search(page);
      return { ok: Boolean(kept.link) && pasted === kept.link, detail: `pasted "${pasted}"` };
    },
    meta(
      "toolbar share menu",
      "menuitem",
      "Copy Link",
      "the toolbar's Share > Copy Link, Control+V in the search field",
      "the place's OpenStreetMap link is on the clipboard",
    ),
  );
  await c.check(
    "maps.options.show-scale",
    async () => {
      const open = async () => {
        await maps(page).getByRole("button", { name: "Show", exact: true }).click();
        return page.getByRole("menu", { name: "Show" });
      };
      let menu = await open();
      await c.crawl("show menu", menu);
      const item = () =>
        page.getByRole("menu", { name: "Show" }).getByRole("menuitemcheckbox", { name: "Scale" });
      const before = await item().getAttribute("aria-checked");
      await item().click();
      menu = await open();
      const after = await item().getAttribute("aria-checked");
      await item().click();
      await closeMenus(page);
      return { ok: before !== after, detail: `Scale ${before} -> ${after}` };
    },
    meta(
      "window",
      "menuitemcheckbox",
      "Scale",
      "click Show, choose Scale, open Show again",
      "Scale is checked or unchecked in turn",
    ),
  );
  await c.check(
    "maps.toolbar.places",
    async () => {
      const button = maps(page).getByRole("button", { name: "Places" });
      await showPlaces(page);
      const pressed = await button.getAttribute("aria-pressed");
      await button.click();
      const hidden = !(await tree(page)
        .isVisible()
        .catch(() => false));
      await button.click();
      const shown = await tree(page).isVisible();
      await c.crawl("places sidebar", maps(page));
      return {
        ok: pressed === "true" && hidden && shown,
        detail: `pressed ${pressed}; hides ${hidden}; shows ${shown}`,
      };
    },
    meta("window", "button", "Places", "click Places, twice", "the Places sidebar hides and shows"),
  );
  await c.check(
    "maps.sidebar.favorite-item",
    async () => {
      await page.keyboard.press("Escape");
      await tree(page)
        .getByRole("group", { name: "Favorites" })
        .getByRole("treeitem", { name: QUERY })
        .click();
      return card(page)
        .waitFor({ timeout: 8_000 })
        .then(() => true);
    },
    meta(
      "places sidebar",
      "treeitem",
      "/.+/",
      "click a favourite in Places",
      "its card opens",
      "restart",
    ),
  );
  await c.check(
    "maps.sidebar.recent-item",
    async () => {
      await page.keyboard.press("Escape");
      await tree(page)
        .getByRole("group", { name: "Recents" })
        .getByRole("treeitem", { name: QUERY })
        .click();
      return card(page)
        .waitFor({ timeout: 8_000 })
        .then(() => true);
    },
    meta("places sidebar", "treeitem", "/.+/", "click a recent place in Places", "its card opens"),
  );
  await c.check(
    "maps.sidebar.new-guide",
    async () => {
      await maps(page).getByRole("button", { name: "New Guide" }).click();
      const name = maps(page).getByRole("textbox", { name: "New guide name" });
      await name.fill("R5 Scratch");
      const saved = page.waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === PLACES,
        { timeout: 10_000 },
      );
      await name.press("Enter");
      const status = (await saved).status();
      const listed = await tree(page)
        .getByRole("group", { name: "Guides" })
        .getByRole("treeitem", { name: /R5 Scratch/ })
        .count();
      return { ok: status === 200 && listed === 1, detail: `PUT ${status}; listed ${listed}` };
    },
    meta(
      "places sidebar",
      "button",
      "New Guide",
      "click New Guide, type a name, press Return",
      "the guide is in Guides, kept on the server",
    ),
  );
  await c.check(
    "maps.sidebar.remove",
    async () => {
      await tree(page)
        .getByRole("group", { name: "Guides" })
        .getByRole("treeitem", { name: /R5 Scratch/ })
        .click();
      const remove = maps(page).getByRole("button", { name: "Remove" });
      const enabled = await remove.isEnabled();
      const saved = page.waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === PLACES,
        { timeout: 10_000 },
      );
      await remove.click();
      const status = (await saved).status();
      const gone =
        (await tree(page)
          .getByRole("group", { name: "Guides" })
          .getByRole("treeitem", { name: /R5 Scratch/ })
          .count()) === 0;
      return {
        ok: enabled && status === 200 && gone && !(await places(page)).includes("R5 Scratch"),
        detail: `enabled with the guide chosen ${enabled}; PUT ${status}; gone ${gone}`,
      };
    },
    meta(
      "places sidebar",
      "button",
      "Remove",
      "choose the new guide, click Remove",
      "the guide leaves Places and the server",
    ),
  );
  await c.check(
    "maps.sidebar.clear-recents",
    async () => {
      const saved = page.waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname === PLACES,
        { timeout: 10_000 },
      );
      await maps(page).getByRole("button", { name: "Clear Recents" }).click();
      const status = (await saved).status();
      const none = await tree(page)
        .getByRole("group", { name: "Recents" })
        .getByRole("treeitem", { name: QUERY })
        .count();
      return { ok: status === 200 && none === 0, detail: `PUT ${status}; recent left ${none}` };
    },
    meta(
      "places sidebar",
      "button",
      "Clear Recents",
      "click Clear Recents",
      "Recents empties, on the server too",
    ),
  );
  await page.keyboard.press("Escape");
  // The browser moves to Paris, so that Show Your Current Location has somewhere else to go.
  await page.context().setGeolocation(PARIS);
  await mapRows(c, page, () => maps(page), "maps", meta);
  await commonRows(c, page, { id: "maps", name: "Maps" });
  for (const control of (await crawlMenus(page)).rows) c.crawled.push(control);

  await c.check(
    "maps.persist.reload",
    async () => {
      await reloadDesktop(page);
      await openApp(page, "Maps");
      return persisted(page, kept);
    },
    meta(
      "window",
      "reload",
      "Places",
      "reload the desktop, open Maps, show Places",
      "the favourite and the guide are there",
      "reload",
    ),
  );
  await isolation(browser, "maps.isolation.write");
  return kept;
}

async function persisted(page, kept) {
  await showPlaces(page);
  const group = (name) =>
    tree(page).getByRole("group", { name }).getByRole("treeitem").allInnerTexts();
  // The window asks the server for them as it opens, and shows none until it has answered.
  for (let waited = 0; waited < 10_000; waited += 200) {
    if ((await group("Favorites")).join(" | ").includes(QUERY)) break;
    await page.waitForTimeout(200);
  }
  const favorites = (await group("Favorites")).join(" | ");
  const guides = (await group("Guides")).join(" | ");
  const server = await places(page);
  const ok =
    favorites.includes(QUERY) && (!kept.guide || guides.includes(GUIDE)) && server.includes(QUERY);
  return {
    ok,
    detail: `Favorites: ${favorites}; Guides: ${guides}${kept.guide ? "" : " (no guide was made)"}`,
  };
}

async function isolation(browser, id) {
  await c.check(
    id,
    async () => {
      const other = await person(
        browser,
        c,
        base,
        accountFor("maps", `b${phase === "restart-check" ? "r" : "w"}`),
        { label: "second account", ...context },
      );
      try {
        const theirs = await api(other, "GET", PLACES);
        await openApp(other, "Maps");
        await appWindow(other, "Maps").getByRole("button", { name: "Places" }).click();
        const fav = await appWindow(other, "Maps").getByRole("treeitem", { name: QUERY }).count();
        return {
          ok: !theirs.text.includes(QUERY) && !theirs.text.includes(GUIDE) && fav === 0,
          detail: `their places ${theirs.text.slice(0, 120)}; ${QUERY} listed ${fav}`,
        };
      } finally {
        await other.context().close();
      }
    },
    meta(
      "second account",
      "isolation",
      "Maps places",
      "sign up a second account, read its places, open Maps' Places",
      "none of the first account's favourites, guides or recents",
      "restart",
    ),
  );
}

async function restartPhase(browser) {
  const state = loadState(out, "maps", browserName);
  const page = await person(browser, c, base, state.account, { create: false, ...context });
  await openApp(page, "Maps");
  await c.check(
    "maps.persist.restart",
    async () => persisted(page, state.kept),
    meta(
      "window",
      "restart",
      "Places",
      "restart ferrite dev on the same root, sign in, open Maps, show Places",
      "the favourite and the guide are there",
      "restart",
    ),
  );
  await isolation(browser, "maps.isolation.restart");
}

const browser = await launchBrowser(browserName, { headed: opts.headed });
try {
  if (phase === "restart-check") await restartPhase(browser);
  else {
    const account = accountFor("maps", "a");
    const page = await person(browser, c, base, account, context);
    const kept = await writePhase(browser, page);
    saveState(out, "maps", browserName, { account, kept });
  }
} catch (error) {
  c.row("maps.run.completed", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  await browser.close();
}
c.finish();
