#!/usr/bin/env node
// Music's Radio in the running app against the real Radio Browser directory and a real station: the
// list comes through the server, a genre and a name ask again, a station plays with its clock moving
// over a reload of its place, and Add keeps it in the library as a stream. Needs the network and a
// browser that decodes MP3 (WebKit or Firefox; Playwright's Chromium does not), and for Firefox an
// audio output (PulseAudio's null sink: `pulseaudio --start --exit-idle-time=-1`).
//
//   node e2e/music-radio-journey.mjs [--url http://127.0.0.1:8787] [--browser webkit]

import { api, journey, launch, openDesktop, options, reloadDesktop } from "./app-journey.mjs";
import { until } from "./media-census-kit.mjs";

const { base } = options();
const { step, run } = journey("music-radio", { ignoreOtherOrigins: true });

const LIBRARY = "/api/music/library";
const PLAYBACK = "/api/music/playback";

await run(async (page) => {
  await page.addInitScript(() => {
    const Real = window.Audio;
    window.__audios = [];
    window.Audio = function Audio(...args) {
      const element = new Real(...args);
      window.__audios.push(element);
      return element;
    };
  });
  await openDesktop(page, base, step);
  await launch(page, "Music");
  const music = page.getByRole("region", { name: "Music", exact: true }).first();
  await music.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await music.elementHandle(),
    { timeout: 15_000 },
  );

  const direct = await api(page, "GET", "/api/music/radio/stations?name=&genre=&page=1");
  step(
    "the server reads a page of stations from the directory, https only",
    direct.status === 200 &&
      direct.json.stations.length > 5 &&
      direct.json.stations.every((each) => each.url.startsWith("https://")),
    `${direct.status}, ${direct.json?.stations?.length} stations`,
  );

  await music.getByRole("treeitem", { name: "Radio", exact: true }).click();
  const list = music.getByRole("grid", { name: "Stations" });
  await list.waitFor({ timeout: 30_000 });
  const firstRow = () => list.getByRole("row").nth(1);
  await firstRow().waitFor({ timeout: 30_000 });
  const firstName = (await firstRow().innerText()).split("\n")[0];
  step("Radio lists the stations", Boolean(firstName), String(firstName));

  await music.getByRole("radio", { name: "Jazz" }).click();
  step(
    "Jazz asks again",
    await until(async () => {
      const now = await firstRow()
        .innerText({ timeout: 1_000 })
        .catch(() => null);
      return Boolean(now) && now.split("\n")[0] !== firstName;
    }, 30_000),
  );
  await music.getByRole("radio", { name: "All" }).click();
  await music.getByRole("searchbox", { name: "Search for a station" }).fill("radio paradise");
  await page.keyboard.press("Enter");
  const named = music
    .getByRole("grid", { name: "Stations" })
    .getByRole("row", { name: /paradise/i });
  await named.first().waitFor({ timeout: 30_000 });
  step("a name finds its station", (await named.count()) > 0, `${await named.count()} rows`);

  // A popular station from the directory, tried until one sends sound: a station may be down, and
  // that says nothing of this window.
  let played = null;
  const rowCount = Math.min(await named.count(), 4);
  for (let at = 0; at < rowCount && !played; at += 1) {
    const row = named.nth(at);
    const name = (await row.innerText()).split("\n")[0];
    await row.dblclick();
    let address = null;
    await until(async () => {
      address = await page.evaluate(
        () =>
          window.__audios.find(
            (audio) => !audio.paused && audio.currentTime > 2 && audio.src.startsWith("https://"),
          )?.src ?? null,
      );
      return Boolean(address);
    }, 20_000);
    if (address) played = `${name} at ${address}`;
  }
  step("a station plays from its own address, its clock moving", Boolean(played), String(played));
  let guests = [];
  await until(async () => {
    guests = (await api(page, "GET", PLAYBACK)).json?.playback?.guests ?? [];
    return guests.length > 0;
  }, 15_000);
  step(
    "the station is kept with the playback as a stream, outside the library",
    guests[0]?.source?.kind === "stream" && guests[0].id.startsWith("radio-"),
    JSON.stringify(guests[0]?.source ?? null),
  );

  const before = (await api(page, "GET", LIBRARY)).json?.library?.songs?.length ?? 0;
  await music.getByRole("button", { name: /^Add / }).first().click();
  let songs = [];
  await until(async () => {
    songs = (await api(page, "GET", LIBRARY)).json?.library?.songs ?? [];
    return songs.length === before + 1;
  }, 15_000);
  const added = songs.at(-1);
  step(
    "Add keeps a station in the library as a stream",
    added?.source?.kind === "stream" && added.album === "Internet Radio",
    JSON.stringify(added?.source ?? null),
  );

  await reloadDesktop(page, step);
  await launch(page, "Music");
  await music.waitFor({ state: "visible", timeout: 15_000 });
  const after = (await api(page, "GET", LIBRARY)).json?.library?.songs ?? [];
  step(
    "the station stays in the library over a reload",
    after.some((each) => each.id === added?.id),
  );
});
