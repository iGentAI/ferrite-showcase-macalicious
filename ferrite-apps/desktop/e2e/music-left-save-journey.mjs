#!/usr/bin/env node
// Music: a change made as an older save lands. The older save is held on its way and then landed, so
// the server refuses the save sent as the page goes, on the revision before it; the next page must
// send it again. Every save is logged, and the server's own value decides.
//
//   node e2e/music-left-save-journey.mjs [--url http://127.0.0.1:8787]

import { journey, launch, openDesktop, options } from "./app-journey.mjs";

const { base } = options();
const { step, run, expectRefusal } = journey("music-left-save");

await run(async (page) => {
  page.setDefaultTimeout(15_000);
  await openDesktop(page, base, step);
  await launch(page, "Music");
  const slider = page.getByRole("slider", { name: "Volume" }).first();
  await slider.waitFor();
  const volume = async () => Number(await slider.getAttribute("aria-valuenow"));
  await slider.focus();
  for (let n = 0; n < 5; n += 1) await page.keyboard.press("ArrowLeft");
  const first = await volume();
  await page.waitForTimeout(2_500);

  // A save before the page goes is held; when the one sent as it goes arrives, the held one (or, with
  // none, an older value) lands first, as a save already on its way does, and moves the revision.
  let older = null;
  let leaving = false;
  let url = null;
  const sent = [];
  const onServer = async () =>
    (await (await page.context().request.get(url)).json())?.playback?.volume;
  await page.route("**/api/music/playback*", async (route) => {
    const request = route.request();
    if (request.method() !== "PUT") return route.continue();
    const body = JSON.parse(request.postData() ?? "{}");
    if (!leaving) {
      // Held unanswered: the save on its way, whose answer this page never hears.
      url = request.url();
      older ??= body;
      return undefined;
    }
    const response = await route.fetch();
    sent.push(`rev ${body.rev} volume ${body.playback?.volume}: ${response.status()}`);
    return route.fulfill({ response }).catch(() => {});
  });

  expectRefusal(409, "/api/music/playback");
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  const saving = await volume();
  for (let n = 0; n < 60 && older === null; n += 1) await page.waitForTimeout(100);
  step("a save of an earlier value is on its way", older !== null);
  for (let n = 0; n < 4; n += 1) await page.keyboard.press("ArrowLeft");
  const after = await volume();
  step("a later change moved the slider", after < saving, `${first} -> ${saving} -> ${after}`);
  const landed = await page.context().request.put(url, {
    headers: { "content-type": "application/json" },
    data: JSON.stringify(older),
  });
  step("the older save landed", landed.status() === 200, `answered ${landed.status()}`);
  leaving = true;
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(500);
  console.log(
    `saves as the page went: ${sent.join("; ") || "none seen"}; on the server ${await onServer()}, older ${older.playback.volume}, wanted ${after}`,
  );
  await page.unroute("**/api/music/playback*");

  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 20_000 });
  await launch(page, "Music");
  await slider.waitFor();
  for (let n = 0; n < 60 && (await onServer()) !== after; n += 1) await page.waitForTimeout(100);
  step(
    "the server holds the change after the next page has read it",
    (await onServer()) === after,
    `${await onServer()}`,
  );
  for (let n = 0; n < 40 && (await volume()) !== after; n += 1) await page.waitForTimeout(100);
  step(
    "the next page shows the change, not the older save",
    (await volume()) === after,
    `${await volume()}`,
  );
  await page.waitForTimeout(2_500);

  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 20_000 });
  await launch(page, "Music");
  await slider.waitFor();
  await page.waitForTimeout(1_000);
  step("the server holds it: it is there after another reload", (await volume()) === after);
});
