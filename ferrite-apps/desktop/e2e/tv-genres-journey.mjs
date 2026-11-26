#!/usr/bin/env node
// TV: a Genre set in Get Info, kept on the server, and the Library's Genres. A film's card and a home
// video's card each take a Genre by their own menu; the Genres list names both; choosing a row shows
// that genre's videos; a reload keeps it; clearing the field or removing the home video takes the row.
//
//   node e2e/tv-genres-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-genres", { ignoreOtherOrigins: true });
const LIBRARY = "/api/tv/library";
const SINTEL = "eRsGyueVLvQ";
const SERVER = 60_000;
const MOVIE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/test-pattern.webm");
const NAME = `Genre ${Date.now().toString(36)}`;

const upload = (page, name, base64) =>
  page.evaluate(
    async ({ name, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "movies",
          name,
          size: bytes.length,
          type: "video/webm",
          existing: "fail",
        }),
      }).then((reply) => reply.json());
      for (let index = 0; index < started.pieces; index += 1) {
        await fetch(`/api/files/uploads/${started.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: bytes.slice(index * started.piece_bytes, (index + 1) * started.piece_bytes),
        });
      }
      const done = await fetch(`/api/files/uploads/${started.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((reply) => reply.json());
      return done.created[0];
    },
    { name, base64 },
  );

async function openTv(page) {
  await launch(page, "TV");
  const window = page.getByRole("region", { name: "TV", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: SERVER });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: SERVER },
  );
  return window;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const file = await upload(page, `${NAME}.webm`, readFileSync(MOVIE).toString("base64"));
  const genres = async () => (await api(page, "GET", LIBRARY)).json?.library?.genres ?? {};
  try {
    await reloadDesktop(page);
    let window = await openTv(page);
    const section = (name) => window.getByRole("button", { name, exact: true }).first().click();
    const row = (name) => window.getByRole("treeitem", { name, exact: true });
    const card = (name) => window.locator(".mac-card-grid-card", { hasText: name }).first();
    const getInfo = async (name) => {
      await card(name).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Get Info", exact: true }).click();
      const field = page.getByLabel("Genre:");
      await field.waitFor({ timeout: 5_000 });
      return field;
    };

    await section("Movies");
    const typed = await getInfo("Sintel");
    await typed.fill("Fantasy");
    await page.waitForTimeout(400);
    const bar = await page.locator(".mac-tv .mac-title-bar").boundingBox();
    const sheet = await page.locator(".mac-sheet-positioner").boundingBox();
    const ok = await page.getByRole("button", { name: "OK", exact: true }).boundingBox();
    const frame = await page.locator(".mac-tv").boundingBox();
    step(
      "The sheet hangs from the title bar, with its buttons inside the window",
      Math.abs(sheet.y - (bar.y + bar.height)) <= 1 && ok.y + ok.height <= frame.y + frame.height,
      JSON.stringify({ bar, sheet, ok }),
    );
    await shot(page, path.join(out, "tv-get-info.png"));
    await page.getByRole("button", { name: "OK", exact: true }).click();
    step(
      "Get Info on a film's card keeps the Genre on the server",
      await until(async () => (await genres())[SINTEL] === "Fantasy", SERVER),
      JSON.stringify(await genres()),
    );

    await chooseMenu(page, "File", "Import…");
    const panel = page.locator(".mac-tv-panel-layer");
    await panel.getByText(`${NAME}.webm`, { exact: true }).first().click();
    await panel.getByRole("button", { name: "Open", exact: true }).click();
    await window.getByRole("region", { name: "Home Videos" }).waitFor({ timeout: SERVER });
    const picked = await getInfo(NAME);
    await page.getByRole("button", { name: "Show choices" }).click();
    const listed = await page.getByRole("option").allInnerTexts();
    await shot(page, path.join(out, "tv-get-info-choices.png"));
    await page.getByRole("option", { name: "Kids & Family", exact: true }).click();
    const chosen = await picked.inputValue();
    await page.getByRole("button", { name: "OK", exact: true }).click();
    step(
      "Genre's list offers the store's genres and the library's; a home video keeps the one chosen",
      listed.includes("Fantasy") &&
        listed.includes("Western") &&
        chosen === "Kids & Family" &&
        (await until(async () => (await genres())[file] === "Kids & Family", SERVER)),
      JSON.stringify({ count: listed.length, genres: await genres() }),
    );

    await row("Fantasy").waitFor({ timeout: 5_000 });
    await shot(page, path.join(out, "tv-genres-list.png"));
    const names = await window.getByRole("treeitem").allInnerTexts();
    step(
      "The Library's Genres lists both by name",
      names.join("|") === "All Videos|Fantasy|Kids & Family",
      names.join("|"),
    );

    await row("Kids & Family").click();
    await window.getByRole("region", { name: "Home Videos" }).waitFor({ timeout: 5_000 });
    const homeOnly = (await window.locator(".mac-card-grid-card").allInnerTexts()).join("|");
    await row("Fantasy").click();
    await window.getByRole("region", { name: "Fantasy" }).waitFor({ timeout: 5_000 });
    const filmOnly = (await window.locator(".mac-card-grid-card").allInnerTexts()).join("|");
    await shot(page, path.join(out, "tv-genre-chosen.png"));
    step(
      "A genre's row shows that genre's videos alone",
      homeOnly.includes(NAME) &&
        !homeOnly.includes("Sintel") &&
        filmOnly.includes("Sintel") &&
        !filmOnly.includes(NAME),
      `${homeOnly} / ${filmOnly}`,
    );

    await until(async () => Object.keys(await genres()).length === 2, SERVER);
    await reloadDesktop(page);
    window = await openTv(page);
    await section("Library");
    await row("Fantasy").waitFor({ timeout: SERVER });
    step(
      "The genres are there after a reload",
      (await row("Kids & Family").count()) === 1,
      JSON.stringify(await genres()),
    );

    await card(NAME).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Remove from Library" }).click();
    await row("Kids & Family").waitFor({ state: "detached", timeout: 5_000 });
    step(
      "Removing the home video takes its genre and its row",
      await until(async () => !(file in (await genres())), SERVER),
      JSON.stringify(await genres()),
    );

    await row("Fantasy").click();
    const cleared = await getInfo("Sintel");
    await cleared.fill("");
    await page.getByRole("button", { name: "OK", exact: true }).click();
    await window.getByRole("treeitem").first().waitFor({ state: "detached", timeout: 5_000 });
    step(
      "Clearing the field takes the last genre, and the list goes with it",
      await until(async () => Object.keys(await genres()).length === 0, SERVER),
      JSON.stringify(await genres()),
    );

    await section("Movies");
    await card("Sintel").click();
    await chooseMenu(page, "Edit", "Get Info");
    const fromMenu = await page.getByLabel("Genre:").isVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    step("Edit > Get Info opens on the video shown", fromMenu);
  } finally {
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: file }] }).catch(
      () => {},
    );
  }
});
