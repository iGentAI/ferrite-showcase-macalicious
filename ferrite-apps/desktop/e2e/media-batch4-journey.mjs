#!/usr/bin/env node
// The media rows that lacked a browser run or were built in this batch, in the running desktop. Mouse
// drags are real ones. Feeds, tiles and the store's catalogue are the real ones.
//
//   node e2e/media-batch4-journey.mjs [--part maps,news,podcasts,...] --url http://127.0.0.1:8868 --out <dir>

import { randomBytes } from "node:crypto";
import path from "node:path";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, until } from "./media-census-kit.mjs";
import { createAccount } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out } = options();
const at = process.argv.indexOf("--part");
const parts = at > 0 ? process.argv[at + 1].split(",") : null;
const wanted = (name) => parts === null || parts.includes(name);
const HERE = { latitude: 37.8106, longitude: -122.4769, accuracy: 25 };
const { step, run } = journey("media-batch4", {
  ignoreOtherOrigins: true,
  launchOptions: { chromium: { args: ["--autoplay-policy=no-user-gesture-required"] } },
  contextOptions: {
    chromium: {
      permissions: ["geolocation", "clipboard-read", "clipboard-write"],
      geolocation: HERE,
    },
  },
});
const SERVER = 60_000;
const tag = Date.now().toString(36);
const settled = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const safely = async (label, body) => {
  if (!wanted(label)) return;
  try {
    await body();
  } catch (error) {
    step(`${label} ran to its end`, false, String(error).slice(0, 400));
  }
};
const middle = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const shown = (locator, timeout = 15_000) =>
  locator.waitFor({ timeout }).then(
    () => true,
    () => false,
  );

/** A real drag: pressing, a first move past the threshold, then the way to `to`. */
async function pointerDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.waitForTimeout(200);
  await page.mouse.up();
}

/**
 * Moves `source` to the screen's left edge and `target` beside it, by their top edges, and answers
 * where `field` (in `target`) can be reached past `source`, which comes to the front when a drag
 * starts in it.
 */
async function sideBySide(page, source, target, field) {
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  const drag = async (window, x, grip) => {
    const box = await window.boundingBox();
    await page.mouse.move(box.x + grip, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + grip + (x - box.x), box.y + 10, { steps: 10 });
    await page.mouse.up();
  };
  const made = await target.boundingBox();
  const grip = Math.min(made.width / 2, 300);
  await drag(target, 1040, grip);
  await drag(source, 0, 300);
  const left = await source.boundingBox();
  const there = await target.boundingBox();
  const inside = await field.boundingBox();
  const wanted = 1430 - (inside.x - there.x) - inside.width;
  if (wanted < there.x) await drag(target, Math.max(wanted, 0), grip);
  const box = await field.boundingBox();
  return {
    x: Math.min(Math.max(box.x + 20, left.x + left.width + 12), box.x + box.width - 10),
    y: box.y + Math.min(30, box.height / 2),
  };
}

const documentOf = (page) =>
  page
    .locator(".mac-window")
    .filter({ has: page.getByRole("textbox", { name: "Document" }) })
    .last();
const textOf = (field) =>
  field.evaluate((element) => ("value" in element ? element.value : element.textContent) ?? "");

const SETTINGS = "/api/system-preferences/settings";
const setting = async (page, key) => (await api(page, "GET", SETTINGS)).json.values?.[key];
const dockItem = (page, name) =>
  page.locator(".mac-dock").getByRole("button", { name: new RegExp(`^${name}$`) });

/** Notes with a new note, and its editor. */
async function newNote(page, line) {
  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: SERVER });
  await notes.getByRole("button", { name: "New Note" }).click();
  await page.keyboard.type(line);
  return { notes, editor: notes.locator('[aria-label="Note"]:visible') };
}

const bodyOf = (composer) => composer.locator('[contenteditable="true"], textarea').last();

/** A New Message window, and its body. */
async function newMessage(page) {
  await launch(page, "Mail");
  await page.locator(".mac-mail").first().waitFor({ timeout: SERVER });
  await page.keyboard.press("ControlOrMeta+n");
  const composer = page.locator(".mac-mail-compose").last();
  await composer.waitFor({ timeout: SERVER });
  const body = bodyOf(composer);
  await body.waitFor({ timeout: SERVER });
  return { composer, body };
}

const closeNew = async (page, window) => {
  await window
    .getByRole("button", { name: /^Close/ })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => {});
  await page
    .getByRole("button", { name: /Don.t Save|Delete/ })
    .first()
    .click({ timeout: 2_000 })
    .catch(() => {});
};

await run(async (page) => {
  const id = Date.now().toString(36);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: `mb4${id}`,
    fullName: `Batch ${id}`,
    password: randomBytes(12).toString("base64url"),
  });
  step(
    "the desktop is served from the site blob the app published",
    (await api(page, "GET", "/ferrite-site.json")).status === 200,
  );

  await safely("maps", async () => {
    await launch(page, "Maps");
    const window = page.getByRole("region", { name: "Maps", exact: true }).first();
    const map = window.getByRole("application");
    await map.waitFor({ timeout: SERVER });
    const field = window.getByRole("searchbox", { name: "Search for a place or address" });
    await field.fill("Hotel Adlon, Berlin");
    for (let tries = 0; tries < 4; tries += 1) {
      const asked = page.waitForResponse((reply) => reply.url().includes("/api/maps/search"), {
        timeout: 30_000,
      });
      await field.press("Enter");
      if ((await asked).status() === 200) break;
      await page.waitForTimeout(2_000);
    }
    await page
      .getByRole("listbox", { name: "Search Results" })
      .getByRole("option", { name: /Adlon/ })
      .first()
      .click({ timeout: SERVER });
    const card = page.getByRole("dialog");
    await card.waitFor({ timeout: SERVER });
    const placeName = (await card.getByRole("heading").first().innerText()).trim();
    await page.keyboard.press("Escape");
    const pin = window.locator(".mac-maps-pin[data-selected]");
    await pin.waitFor({ timeout: SERVER });

    // ---- Share to Mail and Reminders --------------------------------------------------------------
    const share = async (row) => {
      await window.locator(".mac-maps-share").first().click();
      await page.getByRole("menuitem", { name: row, exact: true }).click();
    };
    await share("Mail");
    const composer = page.locator(".mac-mail-compose").last();
    await composer.waitFor({ timeout: SERVER });
    step(
      "Share > Mail starts a message holding the place's link",
      await until(async () => /openstreetmap\.org/.test(await textOf(bodyOf(composer))), SERVER),
    );
    await settled(page, "batch4-maps-share-mail.png");
    await closeNew(page, composer);
    await launch(page, "Maps");
    await share("Reminders");
    step(
      "Share > Reminders makes a reminder with the place's link, on the server",
      await until(async () => {
        const data = JSON.stringify((await api(page, "GET", "/api/reminders/data")).json);
        return data.includes("openstreetmap.org");
      }, SERVER),
    );
    await settled(page, "batch4-maps-share-reminders.png");
    await launch(page, "Maps");

    // ---- Report an Issue --------------------------------------------------------------------------
    const box = await map.boundingBox();
    await page.mouse.click(box.x + 200, box.y + box.height - 120, { button: "right" });
    await page.getByRole("menuitem", { name: "Report an Issue" }).click();
    const address = page.locator(".mac-safari-field input").first();
    step(
      "Report an Issue opens OpenStreetMap's fix-the-map page in Safari",
      await until(async () => /fixthemap/.test(await address.inputValue()), SERVER),
      await address.inputValue().catch(() => "no field"),
    );
    await settled(page, "batch4-maps-report.png");
    await closeNew(page, page.locator(".mac-window").filter({ has: address }).last());

    // ---- A place and a pin dragged to Notes and Mail --------------------------------------------
    const places = window.getByRole("button", { name: "Places" }).first();
    const row = window
      .locator(".mac-maps-sidebar [role='treeitem'][data-value]", {
        hasText: placeName.slice(0, 12),
      })
      .first();
    if (!(await row.isVisible())) await places.click();
    await row.waitFor({ timeout: 15_000 });
    const { notes, editor } = await newNote(page, `Places ${tag} `);
    const noteSpot = await sideBySide(page, window, notes, editor);
    await pointerDrag(page, await middle(row), noteSpot);
    const links = async () => (await editor.innerText()).match(/openstreetmap\.org/g)?.length ?? 0;
    step(
      "A place's row dragged to Notes gives the note its name and link",
      await until(async () => (await links()) > 0, 8_000),
      (await editor.innerText()).slice(0, 120),
    );
    await settled(page, "batch4-maps-drag-notes.png");
    await notes.getByRole("button", { name: "New Note" }).click();
    await page.keyboard.type("Pin ");
    await window.click({ position: { x: 300, y: 10 } });
    await row.click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    await pointerDrag(page, await middle(pin), noteSpot);
    step(
      "A pin on the map drags out to Notes as its name and link",
      await until(async () => (await links()) > 0, 8_000),
      (await editor.innerText()).slice(0, 120),
    );
    const { composer: message, body } = await newMessage(page);
    const mailSpot = await sideBySide(page, window, message, body);
    await pointerDrag(page, await middle(row), mailSpot);
    step(
      "A place's row dragged to a Mail message gives it its name and link",
      await until(async () => /openstreetmap\.org/.test(await textOf(body)), 8_000),
      (await textOf(body)).slice(0, 120),
    );
    await settled(page, "batch4-maps-drag-mail.png");
    await closeNew(page, message);
    await closeNew(page, notes);

    // ---- The compass ----------------------------------------------------------------------------
    await launch(page, "Maps");
    const layer = map.locator(".mac-maps-tiles-layer");
    const compass = window.getByRole("group", { name: "Compass" });
    const face = await compass.boundingBox();
    const pinBefore = await middle(pin);
    const centre = { x: face.x + face.width / 2, y: face.y + face.height / 2 };
    await page.mouse.move(centre.x, centre.y - face.height / 2 + 4);
    await page.mouse.down();
    await page.mouse.move(centre.x + face.width / 2 - 4, centre.y, { steps: 10 });
    await page.mouse.up();
    const heading = Number(await layer.getAttribute("data-heading"));
    step(
      "Going round the compass a quarter turn turns the map by that much",
      heading > 260 && heading < 280,
      String(heading),
    );
    const rose = await compass
      .locator(".mac-map-controls-compass-rose")
      .evaluate((element) => element.style.rotate);
    step("The compass's rose turns with it", Number.parseFloat(rose) === -heading, rose);
    const mapBox = await map.boundingBox();
    const mapMiddle = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };
    const pinTurned = await middle(pin);
    const angle = (-heading * Math.PI) / 180;
    const [fromX, fromY] = [pinBefore.x - mapMiddle.x, pinBefore.y - mapMiddle.y];
    const expected = {
      x: mapMiddle.x + fromX * Math.cos(angle) - fromY * Math.sin(angle),
      y: mapMiddle.y + fromX * Math.sin(angle) + fromY * Math.cos(angle),
    };
    step(
      "The pin goes round the map's middle with the tiles",
      Math.hypot(pinTurned.x - expected.x, pinTurned.y - expected.y) < 40,
      `${JSON.stringify(pinTurned)} vs ${JSON.stringify(expected)}`,
    );
    const tile = map.locator("img[data-tile]");
    step(
      "The tiles cover the turned map",
      await until(
        () => tile.evaluateAll((all) => all.filter((each) => each.naturalWidth === 256).length > 8),
        20_000,
      ),
    );
    await settled(page, "batch4-maps-turned.png");
    step(
      "The heading is kept on the server",
      await until(async () => (await setting(page, "maps.heading")) === heading, SERVER),
      String(await setting(page, "maps.heading")),
    );
    const dragFrom = await middle(pin);
    await page.mouse.move(mapBox.x + 500, mapBox.y + 400);
    await page.mouse.down();
    await page.mouse.move(mapBox.x + 420, mapBox.y + 340, { steps: 8 });
    await page.mouse.up();
    const dragTo = await middle(pin);
    step(
      "A drag on the turned map moves it with the pointer",
      Math.abs(dragTo.x - dragFrom.x + 80) < 3 && Math.abs(dragTo.y - dragFrom.y + 60) < 3,
      `${dragTo.x - dragFrom.x}, ${dragTo.y - dragFrom.y}`,
    );
    const spot = { x: mapBox.x + 320, y: mapBox.y + mapBox.height - 160 };
    await page.mouse.click(spot.x, spot.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Drop Pin" }).click();
    step(
      "A pin dropped on the turned map lands under the pointer",
      await until(async () => {
        for (const each of await window.locator(".mac-maps-pin").all()) {
          const pinAt = await middle(each);
          if (Math.hypot(pinAt.x - spot.x, pinAt.y - spot.y) < 45) return true;
        }
        return false;
      }, SERVER),
    );
    await reloadDesktop(page);
    await launch(page, "Maps");
    const again = page.getByRole("region", { name: "Maps", exact: true }).first();
    await again.getByRole("application").waitFor({ timeout: SERVER });
    const layerAgain = again.locator(".mac-maps-tiles-layer");
    step(
      "The map is still turned after a reload",
      await until(
        async () => Number(await layerAgain.getAttribute("data-heading")) === heading,
        15_000,
      ),
    );
    await again.getByRole("button", { name: "Face north" }).click({ position: { x: 5, y: 26 } });
    step(
      "The compass's ring faces north again",
      await until(async () => (await layerAgain.getAttribute("data-heading")) === null, 5_000),
    );
    step(
      "and north is kept on the server",
      await until(async () => (await setting(page, "maps.heading")) === 0, SERVER),
    );
    await settled(page, "batch4-maps-north.png");
    await closeNew(page, again);
  });

  await safely("news", async () => {
    await launch(page, "News");
    const window = page
      .locator(".mac-window")
      .filter({ has: page.locator(".mac-news-column") })
      .first();
    await window.waitFor({ timeout: SERVER });
    const link = window.locator(".mac-news-story-link").first();
    await link.waitFor({ timeout: SERVER });
    const anAddress = /https?:\/\/\S+\.\S+/;
    const { notes, editor } = await newNote(page, `Stories ${tag} `);
    const noteSpot = await sideBySide(page, window, notes, editor);
    await pointerDrag(page, await middle(link), noteSpot);
    step(
      "A story dragged to Notes gives the note its address",
      await until(async () => anAddress.test(await editor.innerText()), 8_000),
      (await editor.innerText()).slice(0, 120),
    );
    await settled(page, "batch4-news-drag-notes.png");
    await closeNew(page, notes);
    const { composer, body } = await newMessage(page);
    const mailSpot = await sideBySide(page, window, composer, body);
    await pointerDrag(page, await middle(link), mailSpot);
    step(
      "A story dragged to a Mail message gives it its address",
      await until(async () => anAddress.test(await textOf(body)), 8_000),
      (await textOf(body)).slice(0, 120),
    );
    await closeNew(page, composer);
    await launch(page, "Safari");
    const address = page.locator(".mac-safari-field input").first();
    await address.waitFor({ timeout: SERVER });
    const safari = page.locator(".mac-window").filter({ has: address }).last();
    const startPage = await address.inputValue();
    const safariSpot = await sideBySide(page, window, safari, address);
    await pointerDrag(page, await middle(link), safariSpot);
    step(
      "A story dragged to Safari's address field goes there",
      await until(async () => {
        const now = await address.inputValue();
        return now !== startPage && anAddress.test(now);
      }, 15_000),
      await address.inputValue(),
    );
    await settled(page, "batch4-news-drag-safari.png");
    await closeNew(page, safari);

    // ---- View > Reload reads the publisher ------------------------------------------------------
    await launch(page, "News");
    const asked = [];
    const hear = (request) => {
      if (request.url().includes("/api/news/sources/")) asked.push(request.url());
    };
    page.on("request", hear);
    await page.waitForTimeout(1_000);
    await chooseMenu(page, "View", "Reload");
    step(
      "View > Reload asks the server for a read from the publisher",
      await until(async () => asked.some((url) => url.includes("fresh=1")), SERVER),
      asked.slice(0, 2).join(" "),
    );
    page.off("request", hear);
    const one = new URL(asked.find((url) => url.includes("fresh=1"))).pathname;
    const kept = (await api(page, "GET", one)).json.fetched;
    const within = (await api(page, "GET", `${one}?fresh=1`)).json.fetched;
    step("A reload within a minute of a read answers the kept copy", within === kept);
    await closeNew(page, window);
  });

  await safely("podcasts", async () => {
    const LIBRARY = "/api/podcasts/library";
    const stored = async () => (await api(page, "GET", LIBRARY)).json?.library ?? null;
    await launch(page, "Podcasts");
    const window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
    await window.waitFor({ timeout: SERVER });
    await chooseMenu(page, "File", "Add a Show by URL…");
    const adding = page.getByRole("dialog").filter({ hasText: "Add a Show by URL" });
    await adding
      .getByRole("textbox", { name: "Feed address" })
      .fill("https://feeds.npr.org/510318/podcast.xml");
    await adding.getByRole("button", { name: "Add" }).click();
    await adding.waitFor({ state: "hidden", timeout: SERVER });
    await until(async () => ((await stored())?.shows ?? []).length > 0, SERVER);
    const tree = page.getByRole("tree", { name: "Podcasts" });
    await tree.getByRole("treeitem", { name: "Episodes" }).click();
    const card = window.locator("[data-episode-id]").first();
    await card.waitFor({ timeout: SERVER });
    const first = card.locator(".mac-card-grid-card-text");
    const named = (await first.innerText()).split("\n").filter(Boolean);

    // ---- Episode menu: Play Episode ---------------------------------------------------------------
    await first.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Play Episode" }).click();
    step(
      "Play Episode in the menu loads it, kept on the server",
      await until(async () => Boolean((await stored())?.current), SERVER),
      (await stored())?.current?.title,
    );
    await chooseMenu(page, "Controls", "Stop").catch(() => closeMenus(page));

    // ---- Drag an episode out to TextEdit ----------------------------------------------------------
    await launch(page, "TextEdit");
    const editor = documentOf(page);
    const text = editor.getByRole("textbox", { name: "Document" }).first();
    await text.waitFor({ timeout: SERVER });
    const to = await sideBySide(page, window, editor, text);
    await pointerDrag(page, await middle(first), to);
    step(
      "An episode dragged out to TextEdit gives it the episode's link",
      await until(async () => /https?:\/\/\S+/.test(await textOf(text)), 5_000),
      (await textOf(text)).slice(0, 90),
    );
    await settled(page, "batch4-podcasts-drag-out.png");
    await closeNew(page, editor);

    // ---- The episode page -------------------------------------------------------------------------
    await launch(page, "Podcasts");
    await first.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Go to Episode" }).click();
    const episodePage = window.getByRole("region", { name: "Episode", exact: true });
    await episodePage.waitFor({ timeout: 8_000 });
    step(
      "Go to Episode opens its page, with its title and notes",
      (await episodePage.getByRole("heading").innerText()).trim() === named[0],
      (await episodePage.innerText()).slice(0, 160),
    );
    const download = episodePage.getByRole("button", { name: "Download" });
    step(
      "Download is dimmed with its reason",
      (await download.isDisabled()) &&
        /never downloaded/.test((await download.getAttribute("title")) ?? ""),
    );
    await settled(page, "batch4-podcasts-episode.png");
    await episodePage.getByRole("button", { name: /^Back to / }).click();
    step("Back leaves the page", await until(async () => (await episodePage.count()) === 0, 5_000));

    // ---- The server's watch delivers a new episode's notification ---------------------------------
    const held = (await api(page, "GET", LIBRARY)).json;
    const firstShow = held.library.shows[0];
    const inbox = async () =>
      ((await api(page, "GET", "/api/notification-center/inbox")).json.items ?? []).filter(
        (each) => (each.note?.app ?? each.app) === "podcasts",
      );
    await api(page, "PUT", LIBRARY, {
      library: {
        ...held.library,
        shows: held.library.shows.map((show) => ({ ...show, seen: 1000 })),
      },
      rev: held.rev,
      session: held.session,
    });
    const watched = await api(page, "GET", "/api/podcasts/watch");
    step(
      "With episodes newer than the last look, the watch delivers them",
      watched.status === 200 && watched.json.delivered === 3,
      JSON.stringify(watched.json),
    );
    const notes = await inbox();
    step(
      "Notification Center holds them, naming the show and the episode",
      notes.length === 3 && JSON.stringify(notes).includes(named[0].slice(0, 20)),
      JSON.stringify(notes[0]).slice(0, 240),
    );
    const again = await api(page, "GET", "/api/podcasts/watch");
    step(
      "A second look delivers them no second time",
      again.json.delivered === 0,
      JSON.stringify(again.json),
    );
    await reloadDesktop(page);
    step("They are still there after a reload", (await inbox()).length === 3);
    await settled(page, "batch4-podcasts-notified.png");

    // ---- Show menu: Unsubscribe -------------------------------------------------------------------
    await launch(page, "Podcasts");
    const reopened = page.getByRole("region", { name: "Podcasts", exact: true }).first();
    await reopened.waitFor({ timeout: SERVER });
    await page
      .getByRole("tree", { name: "Podcasts" })
      .getByRole("treeitem", { name: "Shows" })
      .click();
    const showCard = reopened.locator(".mac-card-grid-card", { hasText: firstShow.title }).first();
    await showCard.waitFor({ timeout: SERVER });
    await showCard.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Unsubscribe" }).click();
    step(
      "Unsubscribe in the show's menu unfollows it on the server",
      await until(async () => ((await stored())?.shows ?? []).length === 0, SERVER),
    );
    await closeNew(page, reopened);
  });

  await safely("stocks", async () => {
    const held = (await api(page, "GET", "/api/app-store/library")).json;
    await api(page, "PUT", "/api/app-store/library", {
      installed: [...new Set([...(held.installed ?? []), "stocks"])],
      rev: held.rev,
    });
    await reloadDesktop(page);
    await launch(page, "Stocks");
    const window = page.getByRole("region", { name: "Stocks", exact: true }).first();
    await window.waitFor({ timeout: SERVER });
    const stories = (await api(page, "GET", "/api/stocks/news")).json.stories ?? [];
    const story = window.locator(".mac-stocks-story-link").first();
    await story.waitFor({ timeout: SERVER });
    const headline = (await story.innerText()).trim();
    const served = stories.find((each) => each.headline.trim() === headline);
    step("The story is the server's", served !== undefined, headline);
    await story.click();
    const reader = window.getByRole("article", { name: "Story" });
    await reader.waitFor({ timeout: 8_000 });
    step(
      "A story opens in the window, with what the feed says of it",
      (await reader.getByRole("heading").innerText()).trim() === headline &&
        (!served?.summary || (await reader.innerText()).includes(served.summary.slice(0, 40))),
      (await reader.innerText()).slice(0, 160),
    );
    await settled(page, "batch4-stocks-reader.png");
    await reader.getByRole("button", { name: /^Read the Whole Story at / }).click();
    const address = page.locator(".mac-safari-field input").first();
    const host = new URL(served.url).host;
    step(
      "Its button opens the whole story at the publisher, in Safari",
      await until(async () => (await address.inputValue()).includes(host), SERVER),
      await address.inputValue().catch(() => "no field"),
    );
    await closeNew(page, page.locator(".mac-window").filter({ has: address }).last());
    await launch(page, "Stocks");
    await reader.waitFor({ timeout: 8_000 });
    await window.getByRole("button", { name: "Back" }).click();
    step("Back returns to the stories", await shown(story, 8_000));

    // ---- Stories about the symbol ---------------------------------------------------------------
    const symbols = [];
    for (const row of await window.locator("button.mac-stock-row-main").all()) {
      symbols.push((await row.innerText()).trim().split(/\s+/)[0]);
    }
    const mentions = (each, name) =>
      new RegExp(`(^|[^\\p{L}\\p{N}])${name}($|[^\\p{L}\\p{N}])`, "u").test(
        `${each.headline} ${each.summary ?? ""}`,
      );
    const named = symbols
      .map((symbol) => ({
        symbol,
        about: stories.filter((each) => mentions(each, symbol)),
      }))
      .find(({ about }) => about.length > 0);
    if (named) {
      await window
        .getByRole("button", { name: new RegExp(`^${named.symbol}`) })
        .first()
        .click();
      const first = window.locator(".mac-stocks-story-link").first();
      await first.waitFor({ timeout: SERVER });
      const lead = (await first.innerText()).trim();
      step(
        `A story naming ${named.symbol} leads its view, from the real feed`,
        named.about.map((each) => each.headline.trim()).includes(lead),
        lead,
      );
      await settled(page, "batch4-stocks-about.png");
    } else {
      console.log("note today's feed names no watchlist symbol: the order is the unit test's");
    }
    await closeNew(page, window);
  });

  await safely("appstore", async () => {
    await launch(page, "App Store");
    const store = page.getByRole("region", { name: "App Store" }).first();
    await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: SERVER });
    await store.getByRole("button", { name: "Get, Books" }).first().click({ timeout: SERVER });
    await store.getByRole("button", { name: "Install, Books" }).first().click();
    await store.getByRole("button", { name: "Open, Books" }).first().waitFor({ timeout: SERVER });
    await dockItem(page, "Books").waitFor({ timeout: SERVER });
    await dockItem(page, "Books").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Options" }).click();
    await page.getByRole("menuitem", { name: /Keep in Dock|Remove from Dock/ }).click();
    await until(async () => (await dockItem(page, "Books").count()) === 0, 15_000);
    step("Books is taken out of the Dock first", (await dockItem(page, "Books").count()) === 0);
    const lockup = store
      .locator(".mac-card-grid-card")
      .filter({ has: page.getByRole("button", { name: "Open, Books" }) })
      .first();
    await lockup.scrollIntoViewIfNeeded();
    const dock = await page.locator(".mac-dock").boundingBox();
    await pointerDrag(page, await middle(lockup.locator(".mac-card-grid-card-subtitle").first()), {
      x: dock.x + dock.width / 2,
      y: dock.y + dock.height / 2,
    });
    step(
      "An installed app dragged to the Dock is kept there",
      await shown(dockItem(page, "Books"), 10_000),
    );
    step(
      "and on the server",
      await until(
        async () => ((await setting(page, "dock.order")) ?? []).includes("books"),
        SERVER,
      ),
      JSON.stringify(await setting(page, "dock.order")),
    );
    await settled(page, "batch4-appstore-dock.png");
    await reloadDesktop(page);
    step("and over a reload", await shown(dockItem(page, "Books"), SERVER));
  });

  await safely("messages", async () => {
    const NAME = `chart-${tag}.txt`;
    await uploadFile(page, { parent: "documents", name: NAME, type: "text/plain", text: NAME });
    await reloadDesktop(page);
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "Finder" })
      .click();
    const finder = page.locator(".mac-window.mac-finder").first();
    await finder.waitFor({ timeout: SERVER });
    await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    const file = finder.getByRole("option", { name: NAME, exact: true }).first();
    await file.waitFor({ timeout: SERVER });
    await file.click();
    await finder.getByRole("button", { name: "Share", exact: true }).first().click();
    await page.getByRole("menu").last().getByRole("menuitem", { name: "Messages" }).click();
    const messages = page.locator('.mac-messages[aria-label="Messages"]').first();
    const carried = messages.getByRole("list", { name: "Files to send" });
    step(
      "Share > Messages starts a new message carrying the file",
      await shown(carried.getByText(NAME), SERVER),
    );
    const heldFiles = async () =>
      ((await setting(page, "messages.sharedFiles")) ?? []).map((each) => each.name);
    step(
      "The file is kept on the server",
      await until(async () => (await heldFiles()).includes(NAME), SERVER),
      JSON.stringify(await heldFiles()),
    );
    await reloadDesktop(page);
    await launch(page, "Messages");
    step(
      "After a reload Messages starts a new message carrying it again",
      await shown(carried.getByText(NAME), SERVER),
    );
    await settled(page, "batch4-messages-kept.png");
    await messages.getByRole("button", { name: `Remove ${NAME}` }).click();
    step(
      "Remove takes it off the server too",
      await until(async () => (await heldFiles()).length === 0, SERVER),
      JSON.stringify(await heldFiles()),
    );
    await reloadDesktop(page);
    await launch(page, "Messages");
    await messages.waitFor({ timeout: SERVER });
    await page.waitForTimeout(1_500);
    step("and it does not come back over a reload", (await carried.count()) === 0);
  });

  await safely("tv", async () => {
    const NAME = `Float ${tag}`;
    const made = await page.evaluate(async (name) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext("2d");
      const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
      const pieces = [];
      recorder.ondataavailable = (event) => pieces.push(event.data);
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.start();
      const started = performance.now();
      while (performance.now() - started < 4000) {
        context.fillStyle = `hsl(${Math.round((performance.now() - started) / 6)} 80% 50%)`;
        context.fillRect(0, 0, 320, 180);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      recorder.stop();
      await stopped;
      const blob = new Blob(pieces, { type: "video/webm" });
      const json = { "content-type": "application/json" };
      const uploading = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "movies",
          name: `${name}.webm`,
          size: blob.size,
          type: blob.type,
          existing: "fail",
        }),
      }).then((reply) => reply.json());
      for (let index = 0; index < uploading.pieces; index += 1) {
        const piece = blob.slice(
          index * uploading.piece_bytes,
          (index + 1) * uploading.piece_bytes,
        );
        await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await piece.arrayBuffer(),
        });
      }
      const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((reply) => reply.json());
      return done.created[0];
    }, NAME);
    const library = (await api(page, "GET", "/api/tv/library")).json;
    await api(page, "PUT", "/api/tv/library", {
      library: {
        videos: [],
        history: [],
        upNext: [],
        watchLater: [],
        positions: {},
        ...library.library,
        homeVideos: [...(library.library?.homeVideos ?? []), { id: made, place: 0 }],
      },
      rev: library.rev ?? 0,
      session: library.session,
    });
    await reloadDesktop(page);
    await launch(page, "TV");
    const window = page.getByRole("region", { name: "TV", exact: true }).first();
    await window.waitFor({ timeout: SERVER });
    await window.getByRole("button", { name: "Library", exact: true }).click({ timeout: 5_000 });
    await window
      .locator(".mac-card-grid-card", { hasText: NAME })
      .first()
      .click({ timeout: SERVER });
    const video = window.locator(".mac-tv-player-video video");
    await video.waitFor({ timeout: SERVER });
    await until(() => video.evaluate((element) => element.readyState >= 1), SERVER);
    const float = window.getByRole("button", { name: "Picture in Picture" });
    step("A home video's Picture in Picture is enabled", await float.isEnabled());
    await float.click();
    step(
      "Its button floats the video, and the browser says so",
      await until(
        () => page.evaluate(() => document.pictureInPictureElement?.tagName === "VIDEO"),
        8_000,
      ),
    );
    await settled(page, "batch4-tv-float.png");
    await float.click();
    step(
      "Pressed again, it brings the video back",
      await until(() => page.evaluate(() => document.pictureInPictureElement === null), 8_000),
    );
    await closeNew(page, window);
  });
});
