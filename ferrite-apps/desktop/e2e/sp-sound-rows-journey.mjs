#!/usr/bin/env node
// Sound's rows on the served desktop. Alert tones follow Alert volume, Output volume and Mute; Play feedback sounds when the volume
// is let go; Play sound effects through is dimmed with its reason, and the pane says the computer's volume is out of reach. Play
// user interface sound effects sounds when Empty Trash empties the Trash, and not when off. A playing media element follows Output
// volume and Mute and its application reads back what it asked for. The menu extra shows and works. All of it holds after a reload.
//
// Stand-ins: the sound itself is not heard. A recorder wrapped around the browser's real Web Audio notes what each tone was asked
// to play (pitch and gain), and the original volume getter reads what a media element really plays at. Besides QuickTime Player, a
// media element the journey makes plays a short tone from a data URL, and a wrapper over play stands in for a browser's refusal.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/sp-sound-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const SETTINGS = "/api/system-preferences/settings";
const MOUTH = 0.3;
const near = (a, b) => typeof a === "number" && Math.abs(a - b) < 0.001;

await journey("sp-sound-rows", async ({ page, base, out, step }) => {
  await page.addInitScript(() => {
    window.__tones = [];
    let gain = null;
    const setValue = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (value, at) {
      gain = value;
      return setValue.call(this, value, at);
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      window.__tones.push({ hertz: this.frequency.value, gain });
      return start.apply(this, args);
    };
    const nativeVolume = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");
    const native = nativeVolume.get;
    window.__nativeVolume = (element) => native.call(element);
    // A browser that refuses to play, as its autoplay rule does.
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.dataset.refuse)
        return Promise.reject(new DOMException("refused", "NotAllowedError"));
      return play.call(this);
    };
  });
  await openDesktop(page, base);

  const prefs = page.locator('[data-window-id="system-preferences"]');
  const output = prefs.getByRole("slider", { name: "Output volume:" });
  const openPane = async () => {
    await page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(700);
    if ((await output.count()) === 0) {
      await prefs.getByRole("button", { name: "Sound", exact: true }).first().click();
    }
    await output.waitFor({ timeout: 8_000 });
  };
  const tones = async () => {
    await page.waitForTimeout(250);
    return page.evaluate(() => window.__tones.splice(0));
  };
  const box = (name) => prefs.getByRole("checkbox", { name, exact: true });
  const saving = (key, value) => nextSave(page, SETTINGS, (body) => body?.values?.[key] === value);
  const alert = (name) => prefs.getByRole("row", { name }).click();

  await openPane();
  await page.screenshot({ path: path.join(out, "sound-pane.png") });

  const through = prefs.getByRole("combobox", { name: "Play sound effects through:" });
  step(
    "Play sound effects through is dimmed, at what is true, with its reason",
    (await through.isDisabled()) &&
      /Selected sound output device/.test(await through.innerText()) &&
      /cannot choose your computer's sound device/.test(
        (await through.getAttribute("title")) ?? "",
      ),
  );
  step(
    "the pane says the computer's volume is out of reach",
    await prefs
      .getByText("A web page cannot change your computer's volume.", { exact: false })
      .isVisible(),
  );
  step("Output volume starts at full", (await output.getAttribute("aria-valuenow")) === "100");

  await alert("Glass");
  let played = await tones();
  step(
    "an alert plays at full with nothing turned down",
    played.length === 1 && played[0].hertz === 1318 && near(played[0].gain, MOUTH),
    JSON.stringify(played),
  );

  let saved = saving("sound.outputVolume", 50);
  await output.focus();
  await page.keyboard.press("Home");
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("PageUp");
  await saved;
  step("Output volume moves to 50", (await output.getAttribute("aria-valuenow")) === "50");
  await tones();
  await alert("Ping");
  played = await tones();
  step(
    "an alert then plays at half",
    played.length === 1 && played[0].hertz === 1046 && near(played[0].gain, MOUTH * 0.5),
    JSON.stringify(played),
  );

  await output.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  step("with Play feedback off, a volume change is silent", (await tones()).length === 0);
  saved = saving("sound.volumeFeedback", true);
  await box("Play feedback when volume is changed").click();
  await saved;
  saved = saving("sound.outputVolume", 52);
  await output.focus();
  await page.keyboard.press("ArrowRight");
  await saved;
  played = await tones();
  step(
    "with Play feedback on, letting go of the volume plays a tone at the new volume",
    played.length === 1 && played[0].hertz === 622 && near(played[0].gain, MOUTH * 0.52),
    JSON.stringify(played),
  );

  saved = saving("sound.mute", true);
  await box("Mute").click();
  await saved;
  await alert("Basso");
  await output.focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  step("muted, neither an alert nor the feedback plays", (await tones()).length === 0);
  saved = saving("sound.mute", false);
  await box("Mute").click();
  await saved;

  await reloadDesktop(page);
  await openPane();
  const level = Number(await output.getAttribute("aria-valuenow"));
  step(
    "after a reload the volume and Play feedback are the same",
    level === 51 && (await box("Play feedback when volume is changed").isChecked()),
    `${level}`,
  );
  await alert("Hero");
  played = await tones();
  step(
    "and an alert still follows the volume",
    played.length === 1 && near(played[0].gain, MOUTH * 0.51),
    JSON.stringify(played),
  );

  // Play user interface sound effects: real files in a real Trash, emptied from the Dock.
  const fill = async (name) => {
    const made = await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "mkdir", parent: "desktop", name }],
    });
    const entry = made.json.entries.find((each) => each.name === name);
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "trash", id: entry.id }] });
    await reloadDesktop(page);
    return entry.id;
  };
  const inDrive = async (id) =>
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).some((each) => each.id === id);
  const emptyFromDock = async (id) => {
    const stored = await inDrive(id);
    const tile = page.locator('[data-dock-target="trash"]').first();
    await tile.waitFor({ timeout: 10_000 });
    await page.waitForFunction(
      () => document.querySelector('[data-dock-target="trash"]')?.hasAttribute("data-full"),
      undefined,
      { timeout: 10_000 },
    );
    await tile.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Empty Trash", exact: true }).click();
    const warning = page.getByRole("alertdialog");
    await warning.waitFor({ timeout: 5_000 });
    const emptied = page.waitForResponse(
      (reply) => new URL(reply.url()).pathname === "/api/files/ops",
      { timeout: 10_000 },
    );
    await warning.getByRole("button", { name: "Empty Trash", exact: true }).click();
    const reply = await emptied;
    await page.waitForTimeout(200);
    step(
      "Empty Trash answered yes and took the item off the drive",
      stored && reply.ok() && !(await inDrive(id)),
      `kept before: ${stored}, status ${reply.status()}`,
    );
  };
  await emptyFromDock(await fill("sp-sound-a"));
  played = await tones();
  step(
    "Empty Trash plays an interface sound, under the volume",
    played.length === 1 && played[0].hertz === 98 && near(played[0].gain, MOUTH * 0.51),
    JSON.stringify(played),
  );
  await openPane();
  saved = saving("sound.interfaceSounds", false);
  await box("Play user interface sound effects").click();
  await saved;
  await emptyFromDock(await fill("sp-sound-b"));
  step(
    "with Play user interface sound effects off, it is silent, also after a reload",
    (await tones()).length === 0,
  );

  // Output volume over a media element: the journey's own, in place of an application's.
  await openPane();
  const media = await page.evaluate(async () => {
    const samples = 8000;
    const wave = new Uint8Array(44 + samples);
    const view = new DataView(wave.buffer);
    const text = (at, words) => {
      for (let each = 0; each < words.length; each += 1)
        view.setUint8(at + each, words.charCodeAt(each));
    };
    text(0, "RIFF");
    view.setUint32(4, 36 + samples, true);
    text(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 8000, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    text(36, "data");
    view.setUint32(40, samples, true);
    for (let each = 0; each < samples; each += 1) wave[44 + each] = 128 + 40 * ((each >> 4) & 1);
    const sound = new Audio(`data:audio/wav;base64,${btoa(String.fromCharCode(...wave))}`);
    sound.loop = true;
    sound.volume = 0.8;
    await sound.play();
    window.__sound = sound;
    return { asked: sound.volume, playing: window.__nativeVolume(sound) };
  });
  step(
    "a playing element plays under Output volume, and its application reads back what it asked",
    near(media.asked, 0.8) && near(media.playing, 0.8 * 0.51),
    JSON.stringify(media),
  );
  const playing = () => page.evaluate(() => window.__nativeVolume(window.__sound));
  saved = saving("sound.outputVolume", 25);
  await output.focus();
  await page.keyboard.press("Home");
  for (let press = 0; press < 25; press += 1) await page.keyboard.press("ArrowRight");
  await saved;
  step(
    "moving Output volume moves what is playing",
    near(await playing(), 0.8 * 0.25),
    `${await playing()}`,
  );
  saved = saving("sound.mute", true);
  await box("Mute").click();
  await saved;
  step("Mute silences what is playing", near(await playing(), 0), `${await playing()}`);
  await page.screenshot({ path: path.join(out, "sound-muted.png") });
  saved = saving("sound.mute", false);
  await box("Mute").click();
  await saved;
  step("and turning it off brings it back", near(await playing(), 0.8 * 0.25));
  // pause then play at once: the pause event arrives when the element is playing again.
  await page.evaluate(async () => {
    window.__sound.pause();
    await window.__sound.play();
  });
  await page.waitForTimeout(200);
  step(
    "pausing and playing at once stays under Output volume",
    near(await playing(), 0.8 * 0.25),
    `${await playing()}`,
  );
  // Elements that stopped by themselves are let go: a later change of level writes to none of them,
  // and they hold what was asked of them again.
  const stopped = await page.evaluate(async () => {
    const made = [];
    for (let each = 0; each < 4; each += 1) {
      const ended = new Audio(window.__sound.src);
      ended.volume = 0.5;
      ended.playbackRate = 16;
      const finished = new Promise((done) => ended.addEventListener("ended", done, { once: true }));
      await ended.play();
      await finished;
      const refused = new Audio(window.__sound.src);
      refused.volume = 0.5;
      refused.dataset.refuse = "yes";
      await refused.play().catch(() => {});
      made.push(ended, refused);
    }
    window.__stopped = made;
    return made.length;
  });
  const stoppedVolumes = () =>
    page.evaluate(() => window.__stopped.map((element) => window.__nativeVolume(element)));
  saved = saving("sound.outputVolume", 30);
  await output.focus();
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("ArrowRight");
  await saved;
  step(
    "a change of level moves what plays and leaves media that ended or was refused alone",
    stopped === 8 &&
      near(await playing(), 0.8 * 0.3) &&
      (await stoppedVolumes()).every((volume) => near(volume, 0.5)),
    JSON.stringify(await stoppedVolumes()),
  );
  saved = saving("sound.outputVolume", 25);
  for (let press = 0; press < 5; press += 1) await page.keyboard.press("ArrowLeft");
  await saved;
  await page.evaluate(() => window.__sound.pause());
  step(
    "an element that was paused holds what it asked again",
    near(await playing(), 0.8),
    `${await playing()}`,
  );

  // A real application: QuickTime Player with a movie, moved by its own volume control.
  await page
    .getByRole("button", { name: /^App Store$/ })
    .first()
    .click();
  const store = page
    .locator(".mac-window")
    .filter({ has: page.getByRole("heading", { name: "Get More Apps" }) })
    .first();
  await store.waitFor({ timeout: 20_000 });
  await store.getByRole("button", { name: "Get, QuickTime Player" }).click();
  await store.getByRole("button", { name: "Install, QuickTime Player" }).click();
  await store.getByRole("button", { name: "Open, QuickTime Player" }).click({ timeout: 30_000 });
  const qt = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
  await qt.waitFor({ state: "visible", timeout: 20_000 });
  const movieFile = page.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await movieFile).setFiles(path.join(here, "fixtures", "test-pattern.webm"));
  const video = qt.locator("video");
  await video.waitFor({ state: "attached", timeout: 90_000 });
  await page.waitForFunction((element) => element.readyState >= 2, await video.elementHandle(), {
    timeout: 30_000,
  });
  const quicktime = page.locator(".mac-quicktime-player").first();
  const toQuickTime = async () => {
    await page
      .getByRole("button", { name: /^QuickTime Player$/ })
      .first()
      .click();
    await page.waitForTimeout(300);
    const shown = await qt.boundingBox();
    await page.mouse.move(shown.x + shown.width / 2, shown.y + shown.height / 2);
    await page.mouse.move(shown.x + shown.width / 2 + 20, shown.y + shown.height / 2 + 10, {
      steps: 3,
    });
  };
  await quicktime.focus();
  await page.keyboard.press("ControlOrMeta+Alt+KeyL");
  await toQuickTime();
  await qt.locator('[data-control="play"]').click();
  await page.waitForFunction((element) => !element.paused, await video.elementHandle(), {
    timeout: 10_000,
  });
  const movieVolume = qt.getByRole("slider", { name: "Volume" });
  const moveVolume = async (key, presses) => {
    await movieVolume.focus();
    for (let press = 0; press < presses; press += 1) await page.keyboard.press(key);
    await page.waitForTimeout(200);
    return Number(await movieVolume.getAttribute("aria-valuenow")) / 100;
  };
  const moviePlaying = () => video.evaluate((element) => window.__nativeVolume(element));
  let askedOfMovie = await moveVolume("ArrowLeft", 30);
  step(
    "QuickTime Player's own volume control plays under Output volume",
    askedOfMovie > 0 && askedOfMovie < 1 && near(await moviePlaying(), askedOfMovie * 0.25),
    `control ${askedOfMovie}, plays at ${await moviePlaying()}`,
  );
  await openPane();
  saved = saving("sound.mute", true);
  await box("Mute").click();
  await saved;
  step("Mute silences the movie", near(await moviePlaying(), 0), `${await moviePlaying()}`);
  await toQuickTime();
  askedOfMovie = await moveVolume("ArrowLeft", 20);
  step(
    "moving QuickTime Player's control while muted makes no sound, and the movie is still playing",
    near(await moviePlaying(), 0) && !(await video.evaluate((element) => element.paused)),
    `control ${askedOfMovie}, plays at ${await moviePlaying()}`,
  );
  await openPane();
  saved = saving("sound.mute", false);
  await box("Mute").click();
  await saved;
  step(
    "with Mute off the movie plays what the control asks, under Output volume",
    askedOfMovie > 0 && near(await moviePlaying(), askedOfMovie * 0.25),
    `control ${askedOfMovie}, plays at ${await moviePlaying()}`,
  );
  await page.screenshot({ path: path.join(out, "sound-quicktime.png") });
  await toQuickTime();
  await qt.locator('[data-control="play"]').click();
  await page.waitForFunction((element) => element.paused, await video.elementHandle(), {
    timeout: 10_000,
  });
  await openPane();

  // Show volume in menu bar.
  const extra = page.locator('[aria-label^="Volume, "]');
  step("the volume is not in the menu bar at first", (await extra.count()) === 0);
  saved = saving("sound.showInMenuBar", true);
  await box("Show volume in menu bar").click();
  await saved;
  await extra.waitFor({ timeout: 5_000 });
  step("Show volume in menu bar puts it there", true);
  await extra.click();
  const inMenu = page.getByRole("slider", { name: "This desktop's volume" });
  await inMenu.waitFor({ timeout: 5_000 });
  step("its menu shows the same volume", (await inMenu.getAttribute("aria-valuenow")) === "25");
  await page.screenshot({ path: path.join(out, "sound-menu-extra.png") });
  saved = saving("sound.mute", true);
  await page.getByRole("menuitemcheckbox", { name: "Mute" }).click();
  await saved;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  step(
    "its Mute is the pane's",
    (await box("Mute").isChecked()) && (await extra.getAttribute("aria-label")) === "Volume, muted",
  );
  await page.waitForTimeout(1_500);
  await reloadDesktop(page);
  await extra.waitFor({ timeout: 10_000 });
  step(
    "the extra and its state hold after a reload",
    (await extra.getAttribute("aria-label")) === "Volume, muted",
  );
  await openPane();
  await page.waitForTimeout(1_000);
  saved = saving("sound.showInMenuBar", false);
  await box("Show volume in menu bar").click();
  await saved;
  await extra.waitFor({ state: "detached", timeout: 5_000 });
  step("turned off, it leaves the menu bar", true);
});
