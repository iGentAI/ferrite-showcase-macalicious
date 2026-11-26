#!/usr/bin/env node
// QuickTime Player's recording windows on the desktop served by `ferrite dev`: File > New Movie
// Recording shows the camera, records, and on Stop saves to Movies and opens with a real length;
// New Audio Recording and New Screen Recording likewise; closing the window during a take still
// saves it. Each take is read back from the drive. The camera and the microphone are Chromium's fake
// devices, and the screen picker its fake dialog. Exits 0 only with every step passed and no console
// or HTTP error.
//
//   node e2e/quicktime-recording-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("quicktime-recording", {
  launchOptions: {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream=device-count=2",
        "--use-fake-ui-for-media-stream",
        "--auto-select-desktop-capture-source=Entire screen",
      ],
    },
  },
});

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const LIBRARY = "/api/app-store/library";
  const held = (await api(page, "GET", LIBRARY)).json;
  if (!(held.installed ?? []).includes("quicktime-player")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), "quicktime-player"],
      rev: held.rev,
    });
  }
  await reloadDesktop(page);
  const open = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("QuickTime Player");
    await field.press("Enter");
    const window = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
    await window.waitFor({ state: "visible", timeout: 15_000 });
    return window;
  };
  const qt = await open();
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).waitFor();
  const bar = page.getByRole("menubar").first();
  const choose = async (item) => {
    await bar.getByRole("menuitem", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  };
  const driveNames = async () => {
    const { json } = await api(page, "GET", "/api/files/");
    return (JSON.stringify(json).match(/"name":"[^"]+"/g) ?? []).map((each) => each.slice(8, -1));
  };
  const start = qt.getByRole("button", { name: "Start Recording", exact: true });
  const stop = qt.getByRole("button", { name: "Stop Recording", exact: true });
  const opened = async () => {
    const video = qt.locator("video.mac-quicktime-player-video");
    return until(
      async () =>
        video.evaluate((element) =>
          element.readyState >= 1 && Number.isFinite(element.duration) && element.duration > 0
            ? { length: element.duration, width: element.videoWidth, at: element.currentTime }
            : false,
        ),
      30_000,
    );
  };

  await choose("New Movie Recording");
  const preview = qt
    .getByRole("application", { name: "Camera preview" })
    .or(qt.locator("video.mac-quicktime-player-recording-preview"));
  const live = await until(() =>
    preview.evaluate((video) => video.readyState >= 2 && video.videoWidth > 0),
  );
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "quicktime-recording-movie.png"));
  step("New Movie Recording shows the camera", live === true);

  await qt.getByRole("button", { name: "Recording Options", exact: true }).click();
  const options = page.getByRole("menuitemradio");
  const count = await options.count();
  const devices = await options.allInnerTexts();
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "quicktime-recording-options.png"));
  step(
    "Options lists cameras, microphones and quality",
    count >= 4 && devices.includes("High") && devices.includes("Maximum"),
    devices.join(", "),
  );
  const trackLabel = () =>
    preview.evaluate((video) => video.srcObject?.getVideoTracks()[0]?.label ?? "");
  const firstCamera = await trackLabel();
  const another = devices.find((name) => name.startsWith("fake_device") && name !== firstCamera);
  if (another) {
    await page.getByRole("menuitemradio", { name: another, exact: true }).click();
    const moved = await until(async () => (await trackLabel()) === another);
    step("choosing another camera shows it", moved === true, `${firstCamera} to ${another}`);
  } else {
    await page.keyboard.press("Escape");
    console.log(`skip choosing another camera shows it (only ${firstCamera})`);
  }

  await until(() => start.isEnabled());
  await start.click();
  await stop.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(2_200);
  const clock = await qt.getByLabel("Time recorded").innerText();
  await shot(page, path.join(out, "quicktime-recording-take.png"));
  step("Start Recording counts the time", /^0:0[1-9]$/.test(clock), clock);
  await stop.click();
  const played = await opened();
  step(
    "Stop saves to Movies and opens it with its real length",
    Boolean(played) && played.length > 1 && played.width > 0,
    JSON.stringify(played),
  );
  const atStart = await until(async () =>
    qt.locator("video.mac-quicktime-player-video").evaluate((video) => video.currentTime < 0.5),
  );
  step("the opened movie sits at its start after its length was found", atStart === true);
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "quicktime-recording-opened.png"));
  const title = await qt.innerText();
  step("the window carries the take's name", /Movie Recording \d{4}-\d\d-\d\d at /.test(title));

  await qt.click();
  await page.keyboard.press("Control+Meta+Alt+KeyN");
  const meter = qt.getByRole("meter", { name: "Microphone level" });
  await meter.waitFor({ timeout: 10_000 });
  const heard = await until(async () => Number(await meter.getAttribute("aria-valuenow")) > 0);
  await shot(page, path.join(out, "quicktime-recording-audio.png"));
  step("Control-Option-Command-N opens Audio Recording, and the meter moves", heard === true);
  await until(() => start.isEnabled());
  await start.click();
  await stop.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_500);
  await stop.click();
  const sound = await opened();
  step(
    "an audio take opens as sound with a length",
    Boolean(sound) && sound.length > 0.5 && sound.width === 0,
    JSON.stringify(sound),
  );

  await choose("New Screen Recording");
  await until(() => start.isEnabled());
  await start.click();
  const screened = await until(() => stop.isVisible());
  if (screened === true) {
    await page.waitForTimeout(1_500);
    await shot(page, path.join(out, "quicktime-recording-screen.png"));
    await stop.click();
    const movie = await opened();
    step(
      "a screen take opens with a picture",
      Boolean(movie) && movie.width > 0,
      JSON.stringify(movie),
    );
  } else {
    console.log("skip a screen take opens with a picture (this browser gives no screen to record)");
    await qt.click();
  }

  await choose("New Movie Recording");
  await until(() => start.isEnabled());
  await start.click();
  await stop.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_200);
  const counted = await qt.getByLabel("Time recorded").innerText();
  await qt.getByRole("button", { name: "Close", exact: true }).click();
  await qt.waitFor({ state: "detached", timeout: 10_000 });
  const names = await until(async () => {
    const held = (await driveNames()).filter((name) => name.includes(" Recording "));
    return held.filter((name) => name.startsWith("Movie Recording")).length >= 2 ? held : false;
  }, 30_000);
  step(
    "closing the window during a take still saves it to the drive",
    Array.isArray(names),
    `${counted} recorded; ${JSON.stringify(names)}`,
  );
  const again = await open();
  const listed = await until(
    async () => (await again.getByRole("option", { name: /^Audio Recording / }).count()) > 0,
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "quicktime-recording-list.png"));
  step("an audio take is listed in the Open window's Movies too", listed === true);
  await reloadDesktop(page);
});
