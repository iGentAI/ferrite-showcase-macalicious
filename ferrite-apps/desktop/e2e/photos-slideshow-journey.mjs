#!/usr/bin/env node
// Photos' saved slideshow on the desktop served by `ferrite dev`: a song from the person's Music library is chosen and kept
// after a reload, the slideshow plays it, and Export… records the show as a movie on the drive, with the pictures in order
// and the song's sound in it. A memory's movie plays and exports with that song as its soundtrack, and says None once Music has
// no song. A mood names another song and sets the movie's pace. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-slideshow-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-slideshow");
const tag = Date.now().toString(36);
const SHOW = `Holiday ${tag}`;
const MOVIE = `Holiday ${tag}.webm`;
const SONG = `Song ${tag}`;

function wav(seconds = 4) {
  const rate = 8000;
  const samples = rate * seconds;
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + samples * 2, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let at = 0; at < samples; at += 1) {
    data.writeInt16LE(Math.round(9000 * Math.sin((at * 2 * Math.PI * 440) / rate)), 44 + at * 2);
  }
  return data;
}

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  const library = async () => (await api(page, "GET", "/api/photos/library")).json;
  const photosWindow = () => page.locator(".mac-window:has(.mac-photos-body)").first();
  const launch = async (name) => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill(name);
    await field.press("Enter");
  };
  await openDesktop(page, base, step);
  await launch("Music");
  const adding = page.locator('input[type="file"][aria-label="Add to Library"]').first();
  await adding.waitFor({ state: "attached", timeout: 30_000 });
  const songFile = { name: `${SONG}.wav`, mimeType: "audio/wav", buffer: wav() };
  await adding.setInputFiles(songFile);
  const stillLoading = page.getByText("Your library is still loading");
  const song = await until(async () => {
    // Music refuses a file until its library has loaded, and says so.
    if (await stillLoading.count()) await adding.setInputFiles(songFile);
    const songs = (await api(page, "GET", "/api/music/library")).json.library?.songs ?? [];
    return songs.find((each) => each.source?.kind === "file");
  }, 90_000);
  step("Music holds the song", Boolean(song));

  await launch("Photos");
  await photosWindow().waitFor({ timeout: 30_000 });
  const transfer = await page.evaluateHandle(async (tagged) => {
    const list = new DataTransfer();
    for (const [name, color] of [
      [`A ${tagged}`, "rgb(200,40,40)"],
      [`B ${tagged}`, "rgb(40,60,200)"],
    ]) {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      context.fillStyle = color;
      context.fillRect(0, 0, 640, 360);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.95));
      list.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    }
    return list;
  }, tag);
  await photosWindow()
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const held = await until(async () => {
    const photos = (await library()).photos ?? [];
    return photos.length >= 2 ? photos : null;
  }, 90_000);
  const a = held.find((each) => each.name.startsWith("A "));
  const b = held.find((each) => each.name.startsWith("B "));
  await api(page, "PUT", `/api/photos/projects/p-${tag}`, {
    name: SHOW,
    photos: [a.id, b.id],
    theme: "cut",
    seconds: 2,
  });
  await reloadDesktop(page);
  const win = photosWindow();
  await win.waitFor({ timeout: 30_000 });
  await win.getByRole("treeitem", { name: SHOW }).click();

  const music = win
    .getByRole("combobox", { name: "Music" })
    .or(win.getByRole("button", { name: "Music" }))
    .first();
  await music.waitFor({ timeout: 10_000 });
  await music.click();
  await page
    .getByRole("option", { name: song.title })
    .or(page.getByRole("menuitemradio", { name: song.title }))
    .first()
    .click();
  const kept = await until(async () => {
    const held = (await library()).projects?.find((each) => each.id === `p-${tag}`);
    return held?.music?.file === song.source.file ? held : null;
  }, 8_000);
  step("the Music menu lists the song, and the choice is kept on the server", Boolean(kept));
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-slideshow-music.png"));

  await page.evaluate(() => {
    window.__played = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function played() {
      window.__played.push(this);
      return play.call(this);
    };
    // How loud a recording is and the pitch of its sound, from its decoded samples.
    window.__toneOf = async (blob) => {
      const context = new OfflineAudioContext(1, 1, 48_000);
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      const samples = decoded.getChannelData(0);
      let energy = 0;
      let crossings = 0;
      for (let at = 1; at < samples.length; at += 1) {
        energy += samples[at] * samples[at];
        if (samples[at - 1] < 0 && samples[at] >= 0) crossings += 1;
      }
      return {
        loudness: Math.sqrt(energy / samples.length),
        pitch: crossings / decoded.duration,
        seconds: decoded.duration,
      };
    };
  });
  await win.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("dialog", { name: "Slideshow" }).waitFor({ timeout: 10_000 });
  const singing = await until(
    () =>
      page.evaluate(async () => {
        const element = window.__played.find(
          (each) =>
            !each.paused && each.currentTime > 0 && each.loop && !each.muted && each.volume > 0,
        );
        if (!element) return null;
        return window.__toneOf(await (await fetch(element.src)).blob());
      }),
    8_000,
  );
  step(
    "Play sounds the chosen song while the pictures run, audibly, at its 440 Hz",
    singing?.loudness > 0.05 && Math.abs(singing.pitch - 440) < 15,
    JSON.stringify(singing),
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Slideshow" })
    .waitFor({ state: "hidden", timeout: 5_000 });

  await win.getByRole("button", { name: "Export…", exact: true }).click();
  const name = page.getByRole("textbox", { name: /Save As/ });
  await name.waitFor({ timeout: 8_000 });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = await until(async () => {
    const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
    return entries.find((each) => each.name === MOVIE);
  }, 30_000);
  step("Export… saves the movie on the drive", Boolean(file), file?.name);

  const movie = await page.evaluate(async ({ id, size }) => {
    const parts = [];
    for (let piece = 0; piece * 262144 < size; piece += 8) {
      const reply = await fetch(`/api/files/content/${id}?piece=${piece}&count=8`, {
        credentials: "same-origin",
      });
      parts.push(await reply.blob());
    }
    const blob = new Blob(parts, { type: "video/webm" });
    const video = document.createElement("video");
    video.muted = true;
    video.src = URL.createObjectURL(blob);
    await new Promise((done) => {
      video.onloadedmetadata = done;
    });
    video.currentTime = 1e6;
    await new Promise((done) => {
      video.onseeked = done;
    });
    const duration = video.currentTime;
    const at = async (time) => {
      video.currentTime = time;
      await new Promise((done) => {
        video.onseeked = done;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 18;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0, 32, 18);
      return [...context.getImageData(16, 9, 1, 1).data];
    };
    return {
      duration,
      tone: await window.__toneOf(blob),
      first: await at(1),
      second: await at(3),
    };
  }, file);
  step(
    "the movie runs as long as the show",
    movie.duration > 3 && movie.duration < 7,
    `${movie.duration}`,
  );
  step(
    "the first picture, then the second, are in it in order",
    movie.first[0] > 150 && movie.first[2] < 100 && movie.second[2] > 140 && movie.second[0] < 100,
    JSON.stringify(movie),
  );
  step(
    "the song's sound is in it, decoded: loud enough and at its 440 Hz",
    movie.tone.loudness > 0.05 && Math.abs(movie.tone.pitch - 440) < 15,
    JSON.stringify(movie.tone),
  );

  // A memory of these pictures and three more, unlike each other so that none is left out as a near-duplicate.
  const moreList = await page.evaluateHandle(async (tagged) => {
    const list = new DataTransfer();
    for (const [seed, tint] of [
      [29, [0.3, 1, 0.3]],
      [53, [1, 1, 0.25]],
      [97, [0.3, 1, 1]],
    ]) {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 480;
      const context = canvas.getContext("2d");
      let state = seed;
      for (let row = 0; row < 8; row += 1) {
        for (let column = 0; column < 9; column += 1) {
          state = (state * 137 + 71) % 1009;
          const [r, g, b] = tint.map((part) => Math.round((50 + (state % 170)) * part));
          context.fillStyle = `rgb(${r},${g},${b})`;
          context.fillRect(column * 80, row * 60, 80, 60);
        }
      }
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.92));
      list.items.add(new File([blob], `M${seed} ${tagged}.jpg`, { type: "image/jpeg" }));
    }
    return list;
  }, tag);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, moreList);
  await until(async () => ((await library()).photos ?? []).length >= 5, 60_000);
  const openMemory = async () => {
    await win.getByRole("treeitem", { name: "Memories", exact: true }).click();
    const tile = win.locator(".mac-photos-memory", { hasNotText: "Best of" }).first();
    await tile.waitFor({ timeout: 15_000 });
    const label = await tile.getAttribute("aria-label");
    await tile.click();
    return Number(/(\d+) Photos/.exec(label ?? "")?.[1] ?? 0);
  };
  const pictures = await openMemory();
  const soundtrack = win.getByText(`Soundtrack: ${song.title}`, { exact: true });
  await soundtrack.waitFor({ timeout: 10_000 });
  step("a memory names the first song of Music as its soundtrack", true, `${pictures} pictures`);
  await shot(page, path.join(out, "photos-memory-soundtrack.png"));

  await page.evaluate(() => {
    window.__played = [];
  });
  await win.getByRole("button", { name: "Play Memory Movie", exact: true }).click();
  await page.getByRole("dialog", { name: "Slideshow" }).waitFor({ timeout: 10_000 });
  const memorySinging = await until(
    () =>
      page.evaluate(async () => {
        const element = window.__played.find(
          (each) =>
            !each.paused && each.currentTime > 0 && each.loop && !each.muted && each.volume > 0,
        );
        if (!element) return null;
        return window.__toneOf(await (await fetch(element.src)).blob());
      }),
    8_000,
  );
  step(
    "Play Memory Movie sounds the song at its 440 Hz",
    memorySinging?.loudness > 0.05 && Math.abs(memorySinging.pitch - 440) < 15,
    JSON.stringify(memorySinging),
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Slideshow" })
    .waitFor({ state: "hidden", timeout: 5_000 });

  await win.getByRole("button", { name: "Export Memory Movie…", exact: true }).click();
  const memoryName = page.getByRole("textbox", { name: /Save As/ });
  await memoryName.waitFor({ timeout: 8_000 });
  const MEMORY_FILE = `Memory ${tag}.webm`;
  await memoryName.fill(MEMORY_FILE);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const memoryFile = await until(async () => {
    const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
    return entries.find((each) => each.name === MEMORY_FILE);
  }, 90_000);
  step("Export Memory Movie saves the movie on the drive", Boolean(memoryFile), memoryFile?.name);
  const memoryMovie = await page.evaluate(async ({ id, size }) => {
    const parts = [];
    for (let piece = 0; piece * 262144 < size; piece += 8) {
      const reply = await fetch(`/api/files/content/${id}?piece=${piece}&count=8`, {
        credentials: "same-origin",
      });
      parts.push(await reply.blob());
    }
    return window.__toneOf(new Blob(parts, { type: "video/webm" }));
  }, memoryFile);
  step(
    "the song's sound is in the memory's movie, decoded: loud enough, at its 440 Hz, for three seconds a picture",
    memoryMovie.loudness > 0.05 &&
      Math.abs(memoryMovie.pitch - 440) < 15 &&
      memoryMovie.seconds > pictures * 3 - 1.5 &&
      memoryMovie.seconds < pictures * 3 + 4,
    JSON.stringify(memoryMovie),
  );

  // Mood: with a second song in Music a mood names another song, the choice stays on the server
  // and over a reload, and a movie exported at Extreme runs a second a picture.
  const SECOND_SONG = `Second ${tag}`;
  const inMusic = (await api(page, "GET", "/api/music/library")).json;
  const secondAdded = await api(page, "PUT", "/api/music/library", {
    library: {
      ...inMusic.library,
      songs: [...inMusic.library.songs, { ...song, id: `second-${tag}`, title: SECOND_SONG }],
    },
    rev: inMusic.rev,
  });
  step("Music holds a second song", secondAdded.status === 200, String(secondAdded.status));
  await reloadDesktop(page);
  await win.waitFor({ timeout: 30_000 });
  await openMemory();
  await soundtrack.waitFor({ timeout: 10_000 });
  const mood = win.getByRole("combobox", { name: "Mood" });
  step("a memory starts Gentle, naming the first song", /Gentle/.test(await mood.textContent()));
  const chooseMood = async (name) => {
    await mood.click();
    await page.getByRole("option", { name, exact: true }).click();
  };
  await chooseMood("Chill");
  await win.getByText(`Soundtrack: ${SECOND_SONG}`, { exact: true }).waitFor({ timeout: 5_000 });
  step("Chill names the second song", true);
  await chooseMood("Extreme");
  const moodKept = await until(async () => {
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    const moods = json?.values?.["photos.memoryMoods"];
    return moods && Object.values(moods).includes("Extreme") ? moods : null;
  }, 10_000);
  step("the server keeps the mood by memory", Boolean(moodKept), JSON.stringify(moodKept));
  await reloadDesktop(page);
  await win.waitFor({ timeout: 30_000 });
  await openMemory();
  step("the mood stays over a reload", /Extreme/.test(await mood.textContent()));
  await win.getByRole("button", { name: "Export Memory Movie…", exact: true }).click();
  const moodName = page.getByRole("textbox", { name: /Save As/ });
  await moodName.waitFor({ timeout: 8_000 });
  const MOOD_FILE = `Extreme ${tag}.webm`;
  await moodName.fill(MOOD_FILE);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const moodFile = await until(async () => {
    const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
    return entries.find((each) => each.name === MOOD_FILE);
  }, 60_000);
  const moodMovie = await page.evaluate(async ({ id, size }) => {
    const parts = [];
    for (let piece = 0; piece * 262144 < size; piece += 8) {
      const reply = await fetch(`/api/files/content/${id}?piece=${piece}&count=8`, {
        credentials: "same-origin",
      });
      parts.push(await reply.blob());
    }
    const decoded = await new OfflineAudioContext(1, 1, 48_000).decodeAudioData(
      await new Blob(parts, { type: "video/webm" }).arrayBuffer(),
    );
    return { seconds: decoded.duration };
  }, moodFile);
  step(
    "the movie runs at Extreme's second a picture, not Gentle's three",
    moodMovie.seconds > pictures - 1 && moodMovie.seconds < pictures + 3,
    JSON.stringify(moodMovie),
  );

  // A movie of the person's own, with its own 880 Hz sound, between the two pictures.
  const filmName = `Film ${tag}`;
  const filmed = await page.evaluateHandle(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d");
    const sound = new AudioContext();
    await sound.resume();
    const tone = sound.createOscillator();
    tone.frequency.value = 880;
    const out = sound.createMediaStreamDestination();
    tone.connect(out);
    tone.start();
    const stream = canvas.captureStream(30);
    stream.addTrack(out.stream.getAudioTracks()[0]);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const parts = [];
    recorder.ondataavailable = (event) => parts.push(event.data);
    const stopped = new Promise((done) => {
      recorder.onstop = done;
    });
    recorder.start();
    const began = performance.now();
    while (performance.now() - began < 2500) {
      context.fillStyle = "rgb(40,200,60)";
      context.fillRect(0, 0, 320, 180);
      context.fillStyle = `rgb(40,${200 + Math.round(performance.now() % 20)},60)`;
      context.fillRect(0, 0, 8, 8);
      await new Promise((done) => setTimeout(done, 30));
    }
    recorder.stop();
    await stopped;
    tone.stop();
    await sound.close();
    const list = new DataTransfer();
    list.items.add(new File(parts, `${name}.webm`, { type: "video/webm" }));
    return list;
  }, filmName);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, filmed);
  const film = await until(async () => {
    const photos = (await library()).photos ?? [];
    return photos.find((each) => each.name.startsWith(filmName));
  }, 60_000);
  step("the movie is in the library", Boolean(film));
  await api(page, "PUT", `/api/photos/projects/p-${tag}`, {
    name: SHOW,
    photos: [a.id, film.id, b.id],
    theme: "cut",
    seconds: 2,
  });
  await reloadDesktop(page);
  await win.waitFor({ timeout: 30_000 });
  await win.getByRole("treeitem", { name: SHOW }).click();
  await win.getByRole("button", { name: "Export…", exact: true }).click();
  const again = page.getByRole("textbox", { name: /Save As/ });
  await again.waitFor({ timeout: 8_000 });
  const FILMED = `Filmed ${tag}.webm`;
  await again.fill(FILMED);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await until(async () => {
    const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
    return entries.find((each) => each.name === FILMED);
  }, 40_000);
  step("Export… saves a show that holds a movie", Boolean(saved), saved?.name);
  const withFilm = await page.evaluate(async ({ id, size }) => {
    const parts = [];
    for (let piece = 0; piece * 262144 < size; piece += 8) {
      const reply = await fetch(`/api/files/content/${id}?piece=${piece}&count=8`, {
        credentials: "same-origin",
      });
      parts.push(await reply.blob());
    }
    const blob = new Blob(parts, { type: "video/webm" });
    const video = document.createElement("video");
    video.muted = true;
    video.src = URL.createObjectURL(blob);
    await new Promise((done) => {
      video.onloadedmetadata = done;
    });
    video.currentTime = 1e6;
    await new Promise((done) => {
      video.onseeked = done;
    });
    const duration = video.currentTime;
    const at = async (time) => {
      video.currentTime = time;
      await new Promise((done) => {
        video.onseeked = done;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 18;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(video, 0, 0, 32, 18);
      return [...context.getImageData(16, 9, 1, 1).data];
    };
    const decoded = await new OfflineAudioContext(1, 1, 48_000).decodeAudioData(
      await blob.arrayBuffer(),
    );
    const samples = decoded.getChannelData(0);
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    return {
      duration,
      tone: { loudness: Math.sqrt(energy / samples.length) },
      frames: [await at(1), await at(3.2), await at(duration - 0.8)],
    };
  }, saved);
  const [red, green, blue] = withFilm.frames;
  step(
    "the show's movie runs for its own length between the pictures, in order",
    withFilm.duration > 5.5 &&
      withFilm.duration < 10 &&
      red[0] > 150 &&
      green[1] > 140 &&
      green[0] < 100 &&
      blue[2] > 140,
    JSON.stringify(withFilm),
  );
  step(
    "the movie's own sound is in it, decoded",
    withFilm.tone.loudness > 0.02,
    JSON.stringify(withFilm.tone),
  );

  const emptied = await api(page, "DELETE", "/api/music/library");
  await reloadDesktop(page);
  await win.waitFor({ timeout: 30_000 });
  await openMemory();
  await win.getByText("Soundtrack: None", { exact: true }).waitFor({ timeout: 10_000 });
  step("with no song in Music, the memory says its soundtrack is None", true, `${emptied.status}`);
});
