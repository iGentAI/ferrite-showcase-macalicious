#!/usr/bin/env node
// Desktop & Screen Saver's rows on the served desktop: Dynamic goes by the clock; Change picture changes the picture
// in order, at random, by the interval, at a new login and on waking from the desktop's display sleep, and stops when
// off, all kept across a reload; the Photos source lists the library; a folder button adds any folder of the drive.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
// Simulated: the page's clock is Playwright's (`page.clock`), set to 10:00 and moved on to 20:00, as a journey cannot
// wait for evening. It runs on in real time, so the 5 second interval is a real one. The picture and the folder that
// hold it are put on the drive through its routes, as the setup.
//
//   node e2e/sp-desktop-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { driveOps, uploadFile } from "./system-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const PICTURE = "desktop-and-screen-saver.picture";
const MORNING = new Date();
MORNING.setHours(10, 0, 0, 0);

await journey("sp-desktop-rows", async ({ page, base, out, step }) => {
  const shot = (name) => page.screenshot({ path: path.join(out, `sp-desktop-${name}.png`) });
  // Requests under way when a reload comes are cut off, and so are those when the clock jumps past their deadline:
  // the journey counts either as a failure.
  let underWay = 0;
  let lastRequest = 0;
  const api_ = (request) => {
    const { pathname } = new URL(request.url());
    return pathname.startsWith("/api/");
  };
  page.on("request", (request) => {
    if (!api_(request)) return;
    underWay += 1;
    lastRequest = Date.now();
  });
  const finished = (request) => {
    if (api_(request)) underWay -= 1;
  };
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  const quiet = async () => {
    await page.waitForTimeout(600);
    const end = Date.now() + 15_000;
    while ((underWay > 0 || Date.now() - lastRequest < 700) && Date.now() < end) {
      await page.waitForTimeout(50);
    }
  };
  const reloadQuietly = async () => {
    await quiet();
    underWay = 0;
    await reloadDesktop(page);
  };
  await page.clock.install({ time: MORNING });
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json?.values?.[key];
  const openPane = async () => {
    await page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    const tab = prefs.getByRole("tab", { name: "Desktop", exact: true });
    if ((await tab.count()) === 0) {
      const pane = prefs.getByRole("button", { name: "Desktop & Screen Saver", exact: true });
      if ((await pane.count()) === 0) {
        await page.getByRole("button", { name: "Show All" }).first().click();
      }
      await pane.first().click();
    }
    await tab.waitFor({ timeout: 8_000 });
    await tab.click();
    await prefs.getByRole("treegrid", { name: "Picture sources" }).waitFor({ timeout: 8_000 });
  };
  const source = (name) =>
    prefs
      .getByRole("treegrid", { name: "Picture sources" })
      .getByText(name, { exact: true })
      .first();
  // The picture on the desktop, drawn: its address, and only once the browser has its pixels.
  const shownPicture = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".mac-desktop-shell-picture img")]
        .filter((image) => image.complete && image.naturalWidth > 0)
        .map((image) => decodeURIComponent(image.src))
        .join(" "),
    );
  const until = async (check, ms = 8_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value || Date.now() > end) return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
  const choose = async (popUp, option) => {
    await popUp.click();
    const saved = nextSave(page, SETTINGS);
    await page.getByRole("option", { name: option, exact: true }).click();
    await saved;
  };
  const chooseSource = async (name) => {
    const saved = nextSave(page, SETTINGS);
    await source(name).click();
    await saved;
  };

  // Dynamic, Light, Dark.
  await openPane();
  await prefs.getByRole("button", { name: "Mojave", exact: true }).click();
  step(
    "Dynamic at 10:00 shows the day picture",
    await until(async () => /mojave-day/.test(await shownPicture())),
    (await shownPicture()).slice(-30),
  );
  step(
    "the pane says it goes by this computer's clock, not a location",
    (await prefs.getByText(/by this computer’s clock/).isVisible()) &&
      (await prefs.getByText(/based on your location/).count()) === 0,
  );
  const wellPicture = () =>
    prefs
      .locator(".mac-image-well img")
      .first()
      .evaluate((image) => decodeURIComponent(image.src));
  step("the well shows the day picture too", /mojave-day/.test(await wellPicture()));
  await shot("dynamic-day");
  await quiet();
  await page.clock.fastForward("10:00:00");
  step(
    "at 20:00 the desktop has gone to the night picture by itself",
    await until(async () => /mojave-night/.test(await shownPicture())),
    (await shownPicture()).slice(-30),
  );
  step("and so has the well", await until(async () => /mojave-night/.test(await wellPicture())));
  await shot("dynamic-night");
  const look = prefs.getByRole("combobox", { name: "Appearance of the desktop picture" });
  await choose(look, "Light (Still)");
  step(
    "Light (Still) keeps the day picture at night",
    await until(async () => /mojave-day/.test(await shownPicture())),
  );
  await page.waitForTimeout(800);
  await choose(look, "Dynamic");
  await page.waitForTimeout(800);
  await reloadQuietly();
  step(
    "Dynamic is kept across a reload and still goes by the clock",
    await until(async () => /mojave-night/.test(await shownPicture())),
  );

  // Change picture.
  await openPane();
  await prefs.getByRole("button", { name: "Mountains", exact: true }).click();
  await until(async () => /mountains/.test(await shownPicture()));
  const change = prefs.getByRole("checkbox", { name: "Change picture:" });
  await page.waitForTimeout(500);
  let saved = nextSave(page, SETTINGS);
  await change.click();
  await saved;
  await choose(prefs.getByRole("combobox", { name: "Change picture" }), "Every 5 seconds");
  const name = () => prefs.locator('[id$="-name"]').first().innerText();
  step(
    "Every 5 seconds goes on to the next picture in order",
    await until(async () => /sunlit-coast/.test(await shownPicture()), 9_000),
    await name(),
  );
  step("the pane names the picture shown", (await name()) === "Sunlit Coast", await name());
  step(
    "and on to the one after",
    await until(async () => /striated-rock/.test(await shownPicture()), 9_000),
    await name(),
  );
  await shot("change-picture");

  // The count survives a reload, starts again when Change picture is turned on again or a picture is chosen.
  const minute = 60_000;
  const pictureSettled = async () => {
    await page.waitForTimeout(800);
    return stored(PICTURE);
  };
  // The page's clock runs on in real time too, and a reload takes seconds: times are from the page's own clock.
  const pageNow = () => page.evaluate(() => Date.now());
  const passTo = async (time) => {
    await quiet();
    await page.clock.fastForward(Math.max(0, time - (await pageNow())));
    await page.waitForTimeout(800);
  };
  await choose(prefs.getByRole("combobox", { name: "Change picture" }), "Every 5 minutes");
  let at = await pictureSettled();
  let since = await pageNow();
  await passTo(since + 2 * minute);
  await reloadQuietly();
  await passTo(since + 4.5 * minute);
  step(
    "Every 5 minutes: 4.5 minutes on, across a reload, the picture stays",
    (await stored(PICTURE)) === at,
  );
  await passTo(since + 5 * minute);
  step(
    "and at 5 minutes it changes, not counted again from the reload",
    await until(async () => (await stored(PICTURE)) !== at, 8_000),
  );

  await openPane();
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("checkbox", { name: "Change picture:" }).click();
  await saved;
  await passTo((await pageNow()) + 10 * minute);
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("checkbox", { name: "Change picture:" }).click();
  await saved;
  at = await pictureSettled();
  since = await pageNow();
  await passTo(since + 2 * minute);
  await reloadQuietly();
  await page.waitForTimeout(1_500);
  step(
    "turned on again after a long while, a reload does not change it at once",
    (await stored(PICTURE)) === at,
  );
  await passTo(since + 5 * minute);
  step(
    "and it changes 5 minutes after it was turned on",
    await until(async () => (await stored(PICTURE)) !== at, 8_000),
  );

  await openPane();
  await passTo((await pageNow()) + 4 * minute);
  await prefs.getByRole("button", { name: "Green Bay", exact: true }).click();
  await until(async () => (await stored(PICTURE)) === "green-bay");
  since = await pageNow();
  await passTo(since + 2 * minute);
  await reloadQuietly();
  await passTo(since + 4.5 * minute);
  step(
    "a picture chosen 4 minutes in starts the count again",
    (await stored(PICTURE)) === "green-bay",
  );
  await passTo(since + 5 * minute);
  step(
    "and it changes 5 minutes after the choice",
    await until(async () => (await stored(PICTURE)) !== "green-bay", 8_000),
  );
  await openPane();
  await choose(prefs.getByRole("combobox", { name: "Change picture" }), "Every 5 seconds");

  const order = [
    "Island at Dusk",
    "Island at Night",
    "Mountains",
    "Sunlit Coast",
    "Striated Rock",
    "Green Bay",
    "Dark Clouds",
    "Cloudy Sea",
  ];
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("checkbox", { name: "Random order" }).click();
  await saved;
  let last = await name();
  let outOfOrder = false;
  await until(async () => {
    const now = await name();
    if (now !== last) {
      outOfOrder ||= order[(order.indexOf(last) + 1) % order.length] !== now;
      last = now;
    }
    return outOfOrder;
  }, 45_000);
  step("Random order leaves the order", outOfOrder);
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("checkbox", { name: "Random order" }).click();
  await saved;

  await chooseSource("Colors");
  step(
    "the Colors source changes among the colours",
    await until(async () => /^color:/.test((await stored(PICTURE)) ?? ""), 15_000),
    await stored(PICTURE),
  );
  await chooseSource("Desktop Pictures");
  await nextSave(page, SETTINGS);
  // Just after a save: the picture changes every 5 seconds, and a reload must not cut one off.
  await reloadQuietly();
  const before = await stored(PICTURE);
  step(
    "after a reload it goes on changing, with the window not opened",
    await until(async () => (await stored(PICTURE)) !== before, 15_000),
    `${before} to ${await stored(PICTURE)}`,
  );

  await openPane();
  const kept = prefs.getByRole("checkbox", { name: "Change picture:" });
  step(
    "the pane shows it kept",
    (await kept.getAttribute("aria-checked")) === "true" &&
      /Every 5 seconds/.test(
        await prefs.getByRole("combobox", { name: "Change picture" }).innerText(),
      ),
  );

  saved = nextSave(page, SETTINGS);
  await kept.click();
  await saved;
  await page.waitForTimeout(800);
  const stopped = await stored(PICTURE);
  await page.waitForTimeout(7_000);
  step("off, the picture stays", (await stored(PICTURE)) === stopped, stopped);

  // When logging in: a new tab is a new login, and a reload is not.
  saved = nextSave(page, SETTINGS);
  await kept.click();
  await saved;
  await choose(prefs.getByRole("combobox", { name: "Change picture" }), "When logging in");
  await page.waitForTimeout(800);
  const atLogin = await stored(PICTURE);
  await reloadQuietly();
  await page.waitForTimeout(2_000);
  step("When logging in: a reload changes nothing", (await stored(PICTURE)) === atLogin, atLogin);
  const second = await page.context().newPage();
  await second.goto(`${base}/`, { waitUntil: "load" });
  await second
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 40_000 });
  step(
    "a new login does",
    await until(async () => (await stored(PICTURE)) !== atLogin, 10_000),
    await stored(PICTURE),
  );
  await second.close();
  await reloadQuietly();

  // When waking from sleep: the desktop's own display sleep, from a hot corner.
  await openPane();
  await choose(prefs.getByRole("combobox", { name: "Change picture" }), "When waking from sleep");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Show All" }).first().click();
  await prefs.getByRole("button", { name: "Mission Control", exact: true }).first().click();
  await prefs.getByRole("button", { name: "Hot Corners…" }).click();
  await page.getByRole("combobox", { name: "Bottom left" }).click();
  await page.getByRole("option", { name: "Put Display to Sleep", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.waitForTimeout(1_500);
  const size = page.viewportSize();
  const asleep = await stored(PICTURE);
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.mouse.move(0, size.height - 1);
  const layer = page.locator(".mac-system-preferences-screen-saver");
  await layer.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_000);
  step("the display sleeps and the picture has not changed", (await stored(PICTURE)) === asleep);
  await page.keyboard.press("Shift");
  await layer.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "When waking from sleep: waking changes it",
    await until(async () => (await stored(PICTURE)) !== asleep, 8_000),
    await stored(PICTURE),
  );

  // A picture the browser can decode, made in the page.
  const png = async (colour) =>
    Buffer.from(
      await page.evaluate((fill) => {
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 180;
        const context = canvas.getContext("2d");
        context.fillStyle = fill;
        context.fillRect(0, 0, 240, 180);
        return canvas.toDataURL("image/png").split(",")[1];
      }, colour),
      "base64",
    );
  const pngBytes = await png("#3a8");

  // The Photos source.
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await page
    .getByRole("option", { name: "Photos", exact: true })
    .first()
    .waitFor({ timeout: 10_000 });
  await field.press("Enter");
  const photos = page.locator(".mac-window:has(.mac-photos-body)").first();
  await photos.waitFor({ timeout: 10_000 });
  await until(async () => !(await photos.getAttribute("aria-busy")));
  await page.getByRole("menuitem", { name: "File", exact: true }).click();
  const choosing = page.waitForEvent("filechooser", { timeout: 10_000 });
  await page.getByRole("menuitem", { name: "Import…", exact: true }).click();
  await (await choosing).setFiles([
    { name: "Library picture.png", mimeType: "image/png", buffer: pngBytes },
    { name: "Second picture.png", mimeType: "image/png", buffer: await png("#a38") },
  ]);
  await page.getByRole("button", { name: "Import All New Items" }).click();
  const library = async () => (await api(page, "GET", "/api/photos/library")).json?.photos ?? [];
  step(
    "two photos are imported into Photos",
    await until(async () => (await library()).length === 2, 30_000),
  );
  const imported = await library();
  const { file, name: photoName } = imported.find(({ name }) => name.startsWith("Library"));
  const otherPhoto = imported.find(({ name }) => name.startsWith("Second"));

  await openPane();
  await chooseSource("Photos");
  const inLibrary = prefs.getByRole("button", { name: photoName, exact: true });
  await inLibrary.waitFor({ timeout: 8_000 });
  step("the Photos source lists the library's picture", await inLibrary.isVisible());
  await shot("photos-source");
  // A rotation is reading the library when the person chooses: the choice stands. Without the guard
  // the rotation, answered after it, goes on to the other picture.
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/photos/library*", async (route) => {
    await held;
    await route.continue();
  });
  const reading = page.waitForRequest("**/api/photos/library*", { timeout: 20_000 });
  await choose(prefs.getByRole("combobox", { name: "Change picture" }), "Every 5 seconds");
  await reading;
  const chosen = prefs.getByRole("button", { name: otherPhoto.name, exact: true });
  await chosen.click();
  await until(async () => (await stored(PICTURE)) === `drive:${otherPhoto.file}`);
  release();
  await page.waitForTimeout(800);
  step(
    "a picture chosen while a rotation reads its source stands, stored",
    (await stored(PICTURE)) === `drive:${otherPhoto.file}`,
    await stored(PICTURE),
  );
  await page.unroute("**/api/photos/library*");
  step("and shown", await until(async () => /blob:/.test(await shownPicture())));
  // The last picture of Change picture must not take over from the choice.
  saved = nextSave(page, SETTINGS);
  await prefs.getByRole("checkbox", { name: "Change picture:" }).click();
  await saved;
  await inLibrary.click();
  step(
    "choosing it makes it the desktop picture, kept as its file",
    await until(async () => (await stored(PICTURE)) === `drive:${file}`),
  );
  await reloadQuietly();
  step(
    "and the desktop shows it after a reload",
    await until(async () => /blob:/.test(await shownPicture())),
    (await shownPicture()).slice(0, 40),
  );

  // Any folder of the drive.
  const folderName = `Trip ${Date.now().toString(36)}`;
  await driveOps(page, [{ op: "mkdir", parent: "documents", name: folderName }]);
  const entries = (await api(page, "GET", "/api/files/")).json.entries;
  const folder = entries.find((entry) => entry.name === folderName).id;
  await uploadFile(page, { parent: folder, name: "Trip.png", type: "image/png", bytes: pngBytes });
  await reloadQuietly();
  await openPane();
  await prefs.getByRole("button", { name: "Add a folder of your drive" }).click();
  const sheet = page.getByRole("dialog", { name: "Choose a folder of your drive" });
  await sheet.waitFor({ timeout: 8_000 });
  const folders = sheet.getByRole("treegrid", { name: "Folders of your drive" });
  await folders.getByText("Documents", { exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await folders.getByText(folderName, { exact: true }).waitFor({ timeout: 5_000 });
  await shot("folder-sheet");
  for (let press = 0; press < 8; press += 1) await page.keyboard.press("Tab");
  step(
    "Tab stays in the sheet",
    await sheet.evaluate((element) => element.contains(document.activeElement)),
  );
  await folders.getByText(folderName, { exact: true }).click();
  saved = nextSave(page, SETTINGS);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await saved;
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  await prefs.getByRole("button", { name: "Trip.png", exact: true }).waitFor({ timeout: 8_000 });
  step("the folder is in the sources and lists its pictures", await source(folderName).isVisible());
  await shot("folder-added");
  await page.waitForTimeout(800);
  await reloadQuietly();
  await openPane();
  step(
    "it is still there after a reload",
    await source(folderName)
      .waitFor({ timeout: 8_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  step(
    "kept on the server",
    ((await stored("desktop-and-screen-saver.folders")) ?? []).includes(`drive:${folder}`),
  );
});
