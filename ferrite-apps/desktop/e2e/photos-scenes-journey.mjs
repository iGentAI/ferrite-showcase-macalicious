#!/usr/bin/env node
// Photos reads what real pictures show, in the page, with the model on the site's own assets: a dog
// and a beach from Wikimedia Commons, imported through the window; the words read back from the
// server stay over a reload and a search finds each picture by them. Needs the network for the two
// pictures. Chromium.
//
//   node e2e/photos-scenes-journey.mjs [--url http://127.0.0.1:8787] [--browser ...]

import { api, journey, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("photos-scenes", { ignoreOtherOrigins: true });
const tag = Date.now().toString(36);

const PICTURES = [
  ["YellowLabradorLooking_new.jpg", `Dog ${tag}.jpg`, "Dogs"],
  ["Anse_Source_d%27Argent_2-La_Digue.jpg", `Shore ${tag}.jpg`, "Beach"],
];

const fetched = await Promise.all(
  PICTURES.map(async ([commons, name]) => {
    const reply = await fetch(
      `https://commons.wikimedia.org/wiki/Special:FilePath/${commons}?width=640`,
      { headers: { "user-agent": "Macalicious-journey/1.0" } },
    );
    if (!reply.ok) throw new Error(`Wikimedia Commons answered ${reply.status} for ${commons}`);
    return { name, mimeType: "image/jpeg", buffer: Buffer.from(await reply.arrayBuffer()) };
  }),
);

await run(async (page) => {
  const library = async () => (await api(page, "GET", "/api/photos/library")).json;
  const until = async (check, ms) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value) return value;
      if (Date.now() > end) return null;
      await page.waitForTimeout(500);
    }
  };
  const launch = async (name) => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill(name);
    await field.press("Enter");
  };
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();

  await openDesktop(page, base, step);
  await launch("Photos");
  await win.waitFor({ timeout: 30_000 });
  await win.locator("input[type=file]").first().setInputFiles(fetched);

  const read = await until(async () => {
    const photos = (await library()).photos ?? [];
    const ours = photos.filter((each) => each.name.includes(tag));
    return ours.length === 2 && ours.every((each) => each.scenes) ? ours : null;
  }, 60_000);
  step(
    "the server holds what the page read in both pictures",
    Boolean(read),
    JSON.stringify(read?.map((each) => [each.name, each.scenes])),
  );
  for (const [, name, scene] of PICTURES) {
    const photo = read?.find((each) => `${each.name}.jpg` === name);
    step(
      `${name} is read as ${scene}`,
      photo?.scenes?.[0] === scene,
      JSON.stringify(photo?.scenes),
    );
  }

  const searching = win
    .getByRole("searchbox")
    .or(win.getByRole("textbox", { name: /search/i }))
    .first();
  const shown = (name) => win.getByRole("option", { name, exact: true });
  const dog = `Dog ${tag}`;
  const shore = `Shore ${tag}`;
  await searching.fill("puppy");
  step(
    "a search for a word of the scene finds the dog alone",
    await until(
      async () => (await shown(dog).isVisible()) && !(await shown(shore).isVisible()),
      10_000,
    ),
  );
  await searching.fill("beach");
  step(
    "a search for beach finds the shore alone",
    await until(
      async () => (await shown(shore).isVisible()) && !(await shown(dog).isVisible()),
      10_000,
    ),
  );
  await searching.fill("");

  await reloadDesktop(page);
  const after = (await library()).photos.filter((each) => each.name.includes(tag));
  step(
    "the words stay over a reload",
    after.every((each) => each.scenes?.length > 0),
  );
});
