#!/usr/bin/env node
// A song asked of Siri by its name: a real file imported into Music through the window, then played from
// Siri's field, with nothing of the song or the search answered by the journey.
//
//   node e2e/siri-song-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("siri-song", { ignoreOtherOrigins: true });
const TITLE = `Siri tune ${Date.now().toString(36)}`;

/** A mono WAV of six seconds, naming its song in a RIFF INFO list. */
function wav(title) {
  const rate = 8_000;
  const pcm = Buffer.alloc(rate * 2 * 6);
  for (let i = 0; i < pcm.length / 2; i += 1) {
    pcm.writeInt16LE(Math.round(Math.sin(i / 7) * 4000), i * 2);
  }
  const chunk = (id, body) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const info = Buffer.concat([
    Buffer.from("INFO"),
    chunk("INAM", Buffer.from(`${title}\0`)),
    chunk("IART", Buffer.from("Journey\0")),
  ]);
  return chunk(
    "RIFF",
    Buffer.concat([
      Buffer.from("WAVE"),
      chunk("fmt ", fmt),
      chunk("LIST", info),
      chunk("data", pcm),
    ]),
  );
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Music");
  const music = page.getByRole("region", { name: "Music", exact: true }).first();
  await music.waitFor({ state: "visible", timeout: 15_000 });
  const file = path.join(out, "siri-song.wav");
  writeFileSync(file, wav(TITLE));
  const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
  await chooseMenu(page, "File", "Import…");
  await (await chooser).setFiles(file);
  await music
    .getByRole("tree", { name: "Music" })
    .getByRole("treeitem", { name: "Songs", exact: true })
    .click();
  step(
    "The song is in Music, and on the server",
    await until(async () => {
      const { json } = await api(page, "GET", "/api/music/library");
      return (json.library?.songs ?? []).some((song) => song.title === TITLE);
    }, 45_000),
  );
  await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
  const field = page.getByRole("textbox", { name: "Type to Siri" });
  await field.waitFor({ timeout: 8_000 });
  await field.fill(`Play ${TITLE}`);
  await field.press("Enter");
  const said = page.locator("[data-answer]");
  await said.waitFor({ timeout: 25_000 });
  const text = (await said.innerText()).trim();
  step("Siri says it plays the song by its name", text === `Playing “${TITLE}”.`, text);
  await shot(page, path.join(out, `siri-song-${browserName}.png`));
  step(
    "and Music is playing",
    await until(
      async () => (await music.getByRole("button", { name: "Pause", exact: true }).count()) > 0,
    ),
  );
});
