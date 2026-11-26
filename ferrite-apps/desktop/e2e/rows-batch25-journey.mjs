#!/usr/bin/env node
// The rows of the last batch a page can do, one group per application, against `ferrite dev`.
// Each step names its feature file. The camera is Chromium's fake one playing a public-domain portrait
// (demos/photo-booth/vendor/face-fixture.jpg) that holds on one side of the frame and then the other.
// The movies are made here with ffmpeg, so their text tracks are ffmpeg's real mov_text and WebVTT
// muxing; Dictionary asks the real Free Dictionary API, so the run needs the network.
//
//   node e2e/rows-batch25-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--only photos,booth,...]

import { execFileSync } from "node:child_process";
import { mkdtempSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, openApp } from "./media-census-kit.mjs";

/** The first truthy answer of `check`, itself, or the last answer when the time is up. */
async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value || Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const { base, out } = options();
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt > 0 ? process.argv[onlyAt + 1].split(",") : null;
const wanted = (group) => !only || only.includes(group);
const tag = Date.now().toString(36);
const here = path.dirname(fileURLToPath(import.meta.url));
const PORTRAIT = path.resolve(here, "../../../demos/photo-booth/vendor/face-fixture.jpg");
const folder = mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), "rows25-"));
process.on("exit", () => rmSync(folder, { recursive: true, force: true }));

const [WIDTH, HEIGHT] = [640, 480];
async function cameraFrame(portrait, left) {
  const { data } = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#777" },
  })
    .composite([{ input: portrait, left, top: 0 }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frame = Buffer.alloc((WIDTH * HEIGHT * 3) / 2);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const at = (y * WIDTH + x) * 3;
      const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
      frame[y * WIDTH + x] = 16 + 0.257 * r + 0.504 * g + 0.098 * b;
      if (y % 2 === 0 && x % 2 === 0) {
        const chroma = (y / 2) * (WIDTH / 2) + x / 2;
        frame[WIDTH * HEIGHT + chroma] = 128 - 0.148 * r - 0.291 * g + 0.439 * b;
        frame[(WIDTH * HEIGHT * 5) / 4 + chroma] = 128 + 0.439 * r - 0.368 * g - 0.071 * b;
      }
    }
  }
  return frame;
}
const y4m = path.join(folder, "face.y4m");
const portrait = await sharp(readFileSync(PORTRAIT)).resize({ height: HEIGHT }).toBuffer();
const { width: portraitWidth } = await sharp(portrait).metadata();
const sides = [await cameraFrame(portrait, 0), await cameraFrame(portrait, WIDTH - portraitWidth)];
const camera = openSync(y4m, "w");
writeSync(camera, `YUV4MPEG2 W${WIDTH} H${HEIGHT} F15:1 Ip A1:1 C420\n`);
for (const side of sides) {
  for (let n = 0; n < 45; n += 1) {
    writeSync(camera, "FRAME\n");
    writeSync(camera, side);
  }
}

const { step, run } = journey("rows-batch25", {
  ignoreOtherOrigins: true,
  launchOptions: {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-video-capture=${y4m}`,
        "--enable-blink-features=AudioVideoTracks",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
});

async function row(id, label, body) {
  try {
    const result = await body();
    const [ok, detail] = Array.isArray(result) ? result : [result, ""];
    step(`${id}: ${label}`, Boolean(ok), detail);
  } catch (error) {
    step(`${id}: ${label}`, false, String(error).split("\n")[0]);
  }
}

const vtt = (lines) =>
  `WEBVTT\n\n${lines.map(([from, to, line]) => `00:00:0${from}.000 --> 00:00:0${to}.000\n${line}\n`).join("\n")}`;
const srt = (lines) =>
  lines
    .map(([from, to, line], n) => `${n + 1}\n00:00:0${from},000 --> 00:00:0${to},000\n${line}\n`)
    .join("\n");
const ENGLISH = [
  [0, 3, "The first line"],
  [3, 6, "The second line"],
];
const FRENCH = [
  [0, 3, "La première ligne"],
  [3, 6, "La seconde ligne"],
];
const write = (name, text) => {
  const file = path.join(folder, name);
  writeFileSync(file, text);
  return file;
};
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const movieBase = ["-f", "lavfi", "-i", "testsrc=d=6:s=320x240:r=10"];
const tone = (hz) => ["-f", "lavfi", "-i", `sine=f=${hz}:d=6`];
const webmFile = path.join(folder, "two.webm");
ffmpeg(
  ...movieBase,
  ...tone(440),
  ...tone(880),
  "-i",
  write("en.vtt", vtt(ENGLISH)),
  "-i",
  write("fr.vtt", vtt(FRENCH)),
  ...["-map", "0", "-map", "1", "-map", "2", "-map", "3", "-map", "4"],
  ...["-c:v", "libvpx", "-c:a", "libvorbis", "-c:s", "webvtt"],
  ...["-metadata:s:a:0", "language=eng", "-metadata:s:a:1", "language=fra"],
  ...["-metadata:s:s:0", "language=eng", "-metadata:s:s:1", "language=fra"],
  webmFile,
);
const mp4File = path.join(folder, "text.mp4");
ffmpeg(
  ...movieBase,
  "-i",
  write("de.srt", srt([[0, 6, "Eine deutsche Zeile"]])),
  ...["-map", "0", "-map", "1", "-c:v", "libvpx-vp9", "-c:s", "mov_text"],
  ...["-metadata:s:s:0", "language=deu", "-strict", "-2"],
  mp4File,
);
const plainFile = path.join(folder, "plain.webm");
ffmpeg(...movieBase, "-c:v", "libvpx", plainFile);

/** A file of the drive, uploaded through the page's own session. */
const upload = (page, name, bytes, type, parent = "documents") =>
  page.evaluate(
    async ({ name, data, type, parent }) => {
      const blob = new Blob([Uint8Array.from(atob(data), (each) => each.charCodeAt(0))], { type });
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: blob.size, type, existing: "fail" }),
      }).then((reply) => reply.json());
      for (let index = 0; index < started.pieces; index += 1) {
        await fetch(`/api/files/uploads/${started.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await blob
            .slice(index * started.piece_bytes, (index + 1) * started.piece_bytes)
            .arrayBuffer(),
        });
      }
      await fetch(`/api/files/uploads/${started.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
    },
    { name, data: Buffer.from(bytes).toString("base64"), type, parent },
  );
const drive = async (page) => (await api(page, "GET", "/api/files")).json.entries ?? [];
const fileNamed = async (page, name) => (await drive(page)).find((each) => each.name === name);
const bytesOf = (page, id) =>
  page.evaluate(async (file) => {
    const { entries } = await fetch("/api/files", { credentials: "same-origin" }).then((reply) =>
      reply.json(),
    );
    const version = entries.find((each) => each.id === file)?.version ?? 0;
    const reply = await fetch(`/api/files/content/${file}?piece=0&count=8&version=${version}`, {
      credentials: "same-origin",
    });
    return reply.ok ? [...new Uint8Array(await reply.arrayBuffer())] : null;
  }, id);
const textOf = async (page, id) => {
  const bytes = await bytesOf(page, id);
  return bytes ? Buffer.from(bytes).toString("latin1") : "";
};

const spotlight = async (page, name, selector) => {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await page.waitForTimeout(400);
  await field.press("Enter");
  const window = page.locator(selector).first();
  await window.waitFor({ state: "visible", timeout: 20_000 });
  return window;
};
const install = async (page, id) => {
  const held = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...(held.installed ?? []), id],
    rev: held.rev,
  });
};
const openInFinder = async (page, name) => {
  const dock = page.getByRole("toolbar", { name: "Dock" });
  await dock.getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  await finder.getByText(name, { exact: true }).first().dblclick();
  return finder;
};
const closeFront = async (page) => {
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+w");
  await page.waitForTimeout(300);
};

async function photos(page) {
  const win = await spotlight(page, "Photos", ".mac-window:has(.mac-photos-body)");
  await until(async () => !(await win.getAttribute("aria-busy")));
  const name = `row25-${tag}`;
  const transfer = await page.evaluateHandle(async (title) => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 200;
    canvas.getContext("2d").fillRect(0, 0, 300, 200);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg"));
    const data = new DataTransfer();
    data.items.add(new File([blob], `${title}.jpg`, { type: "image/jpeg" }));
    return data;
  }, name);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  await until(async () => {
    const photos = (await api(page, "GET", "/api/photos/library")).json.photos ?? [];
    return photos.some((each) => each.name === name);
  }, 30_000);
  await win.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await win.getByRole("button", { name: "All Photos", exact: true }).click();
  await win.getByRole("option", { name, exact: true }).click();
  const info = page.locator(".mac-photos-info-window");
  if (!(await info.isVisible())) await page.keyboard.press("ControlOrMeta+i");
  await info.waitFor({ timeout: 5_000 });
  const people = info.getByRole("textbox", { name: "People" });
  await people.fill("Ann");
  await people.press("Enter");
  await until(async () => {
    const photos = (await api(page, "GET", "/api/photos/library")).json.photos ?? [];
    return photos.find((each) => each.name === name)?.people?.includes("Ann");
  }, 10_000);
  await page.keyboard.press("ControlOrMeta+i");
  const peopleRow = win.getByRole("treeitem", { name: "People", exact: true });
  const tile = win.getByRole("button", { name: /^Ann, / });
  await peopleRow.click();
  await tile.waitFor({ timeout: 5_000 });
  await tile.click();
  const list = win.getByRole("listbox", { name: "Ann" });
  await list.waitFor({ timeout: 5_000 });
  await row("photos.people", "a click on the selected People row returns to People", async () => {
    await peopleRow.click();
    await tile.waitFor({ timeout: 3_000 });
    return (await list.count()) === 0;
  });
  await tile.click();
  await list.getByRole("option").first().dblclick();
  await page.waitForTimeout(400);
  await row("photos.people.open", "also with one of the person's photos open", async () => {
    await peopleRow.click();
    await tile.waitFor({ timeout: 3_000 });
    return true;
  });
  await closeFront(page);
}

async function booth(page) {
  await install(page, "photo-booth");
  await reloadDesktop(page);
  const window = await spotlight(page, "Photo Booth", '[data-window-id="photo-booth"]');
  await until(async () => !(await window.getAttribute("aria-busy")));
  const grid = window.getByRole("group", { name: /^Effects, page/ });
  const toPage = async (n) => {
    if (!(await grid.isVisible().catch(() => false))) {
      await window.getByRole("button", { name: "Effects", exact: true }).click();
    }
    await window.getByRole("button", { name: `Page ${n} of 4`, exact: true }).click();
    await window
      .getByRole("group", { name: `Effects, page ${n} of 4` })
      .waitFor({ timeout: 5_000 });
  };
  const choose = async (n, name) => {
    await toPage(n);
    await window.getByRole("button", { name, exact: true }).click();
    await window.locator(".mac-photo-booth-frame video").waitFor({ timeout: 10_000 });
  };
  const canvas = (id) => window.locator(`.mac-photo-booth-frame canvas[data-effect="${id}"]`);
  await toPage(3);
  await row(
    "photo-booth.124.names",
    "page 3 has the tracked effects in place of invented ones",
    async () => {
      const names = await window
        .getByRole("group", { name: "Effects, page 3 of 4" })
        .getByRole("button")
        .allTextContents();
      return [
        ["Hearts", "Lovestruck", "Nose Twirl", "Chipmunk", "Frog"].every((name) =>
          names.some((each) => each.includes(name)),
        ) && !names.some((each) => /Fade|Haze|Negative/.test(each)),
        names.join(", "),
      ];
    },
  );
  /** How many of the canvas's pixels differ from the camera's plain frame under it. */
  const changed = (id) =>
    canvas(id).evaluate((element) => {
      const video = element.parentElement.querySelector("video");
      const plain = document.createElement("canvas");
      plain.width = element.width;
      plain.height = element.height;
      const context = plain.getContext("2d");
      const aspect = video.clientWidth / video.clientHeight;
      const [vw, vh] = [video.videoWidth, video.videoHeight];
      const w = vw / vh > aspect ? Math.round(vh * aspect) : vw;
      const h = vw / vh > aspect ? vh : Math.round(vw / aspect);
      context.setTransform(-1, 0, 0, 1, element.width, 0);
      context.drawImage(
        video,
        Math.round((vw - w) / 2),
        Math.round((vh - h) / 2),
        w,
        h,
        0,
        0,
        element.width,
        element.height,
      );
      const a = context.getImageData(0, 0, element.width, element.height).data;
      const b = element.getContext("2d").getImageData(0, 0, element.width, element.height).data;
      const face = (element.dataset.faces ?? "").split("\n")[0].split(" ").map(Number);
      let inside = 0;
      let outside = 0;
      for (let y = 0, at = 0; y < element.height; y += 1) {
        for (let x = 0; x < element.width; x += 1, at += 4) {
          if (
            Math.abs(a[at] - b[at]) +
              Math.abs(a[at + 1] - b[at + 1]) +
              Math.abs(a[at + 2] - b[at + 2]) >
            90
          ) {
            const [fx, fy] = [x / element.width, y / element.height];
            const near =
              Math.abs(fx - (face[0] + face[2] / 2)) < face[2] * 1.5 &&
              Math.abs(fy - (face[1] + face[3] / 2)) < face[3] * 1.8;
            if (near) inside += 1;
            else outside += 1;
          }
        }
      }
      return { inside, outside, faces: element.dataset.faces ?? "" };
    });
  for (const [name, id] of [
    ["Hearts", "hearts"],
    ["Lovestruck", "lovestruck"],
    ["Nose Twirl", "nose-twirl"],
    ["Chipmunk", "chipmunk"],
    ["Frog", "frog"],
  ]) {
    await row(
      `photo-booth.124.${id}`,
      `${name} changes the frame around the face found`,
      async () => {
        await choose(3, name);
        const seen = await until(async () => {
          const read = await changed(id);
          return read.faces && read.inside > 150 ? read : null;
        }, 30_000);
        await shot(page, path.join(out, `booth-${id}.png`));
        return [Boolean(seen) && seen.inside > seen.outside, JSON.stringify(seen)];
      },
    );
  }
  await row(
    "photo-booth.warps",
    "Bulge is centred on the face and follows it across the frame",
    async () => {
      await choose(1, "Bulge");
      const centre = () =>
        canvas("bulge").evaluate((element) => {
          const [x] = (element.dataset.centre ?? "").split(" ").map(Number);
          return Number.isFinite(x) && element.dataset.centre ? x : null;
        });
      const seen = new Set();
      await until(async () => {
        const x = await centre();
        if (x !== null) seen.add(Math.round(x * 10) / 10);
        return Math.max(...seen, 0) - Math.min(...seen, 1) > 0.25;
      }, 30_000);
      await shot(page, path.join(out, "booth-bulge.png"));
      return [Math.max(...seen, 0) - Math.min(...seen, 1) > 0.25, [...seen].join(" ")];
    },
  );
  await row(
    "photo-booth.124.still",
    "a still of Nose Twirl keeps the warp and its effect",
    async () => {
      await choose(3, "Nose Twirl");
      await until(async () => (await changed("nose-twirl")).inside > 150, 20_000);
      const before = ((await api(page, "GET", "/api/photos/library")).json.photos ?? []).length;
      await window.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
      const taken = await until(async () => {
        const all = (await api(page, "GET", "/api/photos/library")).json.photos ?? [];
        return all.length > before ? all.at(-1) : null;
      }, 20_000);
      return [JSON.stringify(taken ?? {}).includes("nose-twirl"), taken?.id];
    },
  );
  await closeFront(page);
}

async function quicktime(page) {
  await install(page, "quicktime-player");
  await upload(page, `two-${tag}.webm`, readFileSync(webmFile), "video/webm");
  await upload(page, `text-${tag}.mp4`, readFileSync(mp4File), "video/mp4");
  await upload(page, `plain-${tag}.webm`, readFileSync(plainFile), "video/webm");
  await reloadDesktop(page);
  const video = () => page.locator(".mac-quicktime-player video").first();
  const viewRow = (name) => page.getByRole("menuitem", { name, exact: true });
  const bar = page.getByRole("menubar").first();
  const openView = async () => {
    await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  };
  const activeCue = () =>
    video().evaluate((element) =>
      [...element.textTracks]
        .filter((track) => track.mode === "showing")
        .flatMap((track) => [...(track.activeCues ?? [])].map((cue) => cue.text)),
    );
  const seek = (seconds) =>
    video().evaluate(async (element, at) => {
      element.currentTime = at;
      await new Promise((done) => element.addEventListener("seeked", done, { once: true }));
    }, seconds);

  await openInFinder(page, `plain-${tag}.webm`);
  await video().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
  await row(
    "quicktime.92.none",
    "a movie with no text track dims both rows, saying why",
    async () => {
      await openView();
      const show = viewRow("Show Subtitles");
      const disabled = await show.getAttribute("aria-disabled");
      const reason = await show.getAttribute("data-reason");
      await page.keyboard.press("Escape");
      return [disabled === "true" && /no subtitles/.test(reason ?? ""), reason];
    },
  );
  await closeFront(page);

  await openInFinder(page, `text-${tag}.mp4`);
  await video().waitFor({ timeout: 20_000 });
  await row("quicktime.92.mp4", "an MP4's tx3g track shows, in German, at its time", async () => {
    await page.waitForTimeout(1_000);
    await openView();
    await viewRow("Show Subtitles").click();
    await seek(2);
    const cues = await until(async () => {
      const found = await activeCue();
      return found.length > 0 ? found : null;
    }, 5_000);
    await shot(page, path.join(out, "qt-mp4-subtitles.png"));
    return [cues?.[0] === "Eine deutsche Zeile", JSON.stringify(cues)];
  });
  await closeFront(page);

  await openInFinder(page, `two-${tag}.webm`);
  await video().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1_000);
  await row(
    "quicktime.92.webm",
    "a WebM's WebVTT tracks show the first, and Hide turns it off",
    async () => {
      await openView();
      await viewRow("Show Subtitles").click();
      await seek(4);
      const first = await until(async () => {
        const found = await activeCue();
        return found.length > 0 ? found : null;
      }, 5_000);
      await openView();
      await viewRow("Hide Subtitles").click();
      await page.waitForTimeout(200);
      const off = await activeCue();
      return [first?.[0] === "The second line" && off.length === 0, JSON.stringify({ first, off })];
    },
  );
  await row(
    "quicktime.93.subtitles",
    "Languages chooses the French track by its name",
    async () => {
      await openView();
      await viewRow("Languages").hover();
      await page.getByRole("menuitemradio", { name: "French", exact: true }).last().click();
      await seek(1);
      const cues = await until(async () => {
        const found = await activeCue();
        return found.length > 0 ? found : null;
      }, 5_000);
      await shot(page, path.join(out, "qt-webm-french.png"));
      return [cues?.[0] === "La première ligne", JSON.stringify(cues)];
    },
  );
  await row(
    "quicktime.93.audio",
    "Languages offers the audio tracks the browser exposes",
    async () => {
      const exposed = await video().evaluate((element) => element.audioTracks?.length ?? -1);
      await openView();
      await viewRow("Languages").hover();
      const rows = await page.getByRole("menuitemradio").allTextContents();
      if (exposed < 2) {
        await page.keyboard.press("Escape");
        return [false, `this browser exposes ${exposed} audio tracks; rows ${rows.join(", ")}`];
      }
      const second = page.getByRole("menuitemradio", { name: "French", exact: true }).first();
      await second.waitFor();
      await second.click();
      const enabled = await video().evaluate((element) =>
        [...Array(element.audioTracks.length).keys()].map((n) => element.audioTracks[n].enabled),
      );
      return [enabled.filter(Boolean).length === 1, JSON.stringify({ rows, enabled })];
    },
  );
  await closeFront(page);
}

async function textedit(page) {
  const png = await sharp({
    create: { width: 48, height: 32, channels: 3, background: "#3a7" },
  })
    .png()
    .toBuffer();
  const hex = png.toString("hex");
  const rtf =
    "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\\f0\\fs24 Before " +
    `{\\pict\\pngblip\\picw48\\pich32\\picwgoal960\\pichgoal640\n${hex}} after\\par}`;
  const name = `lock-${tag}.rtf`;
  await upload(page, name, Buffer.from(rtf), "application/rtf");
  await reloadDesktop(page);
  await openInFinder(page, name);
  const window = page.locator(".mac-window:has(.mac-textedit-view)").first();
  await window.waitFor({ timeout: 20_000 });
  const title = window.locator(".mac-textedit-title").first();
  await title.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await row(
    "textedit.150",
    "the title's Locked locks the drive's file, and the title says so",
    async () => {
      await title.click();
      await page.waitForTimeout(400);
      const popover = page.getByRole("dialog", { name: "Document" });
      await popover.getByRole("checkbox", { name: "Locked" }).click();
      const locked = await until(async () => (await fileNamed(page, name))?.locked === true, 5_000);
      await page.keyboard.press("Escape");
      const shown = await window
        .getByText("— Locked")
        .first()
        .isVisible()
        .catch(() => false);
      return [locked && shown, `locked ${locked}, title ${shown}`];
    },
  );
  await row(
    "textedit.150.keys",
    "typing asks: the file is not changed, and Unlock ends it",
    async () => {
      await window.locator(".mac-textedit-view").first().click();
      await page.keyboard.type("x");
      const sheet = page.getByRole("dialog").filter({ hasText: "is locked" });
      await sheet.waitFor({ timeout: 4_000 });
      await shot(page, path.join(out, "textedit-locked.png"));
      const before = await textOf(page, (await fileNamed(page, name)).id);
      await sheet.getByRole("button", { name: "Unlock" }).click();
      const open = await until(async () => (await fileNamed(page, name))?.locked !== true, 5_000);
      return [open && !before.includes("xBefore"), `unlocked ${open}`];
    },
  );
  await row(
    "textedit.206.save",
    "Save As .rtfd makes a folder with TXT.rtf and the picture",
    async () => {
      await chooseMenu(page, "File", "Duplicate");
      await page.waitForTimeout(500);
      await page.keyboard.press("ControlOrMeta+s");
      const dialog = page.getByRole("dialog", { name: "Save" });
      await dialog.waitFor({ timeout: 5_000 });
      await dialog.getByRole("combobox", { name: "File Format:" }).click();
      await page.getByRole("option", { name: /\.rtfd\)$/ }).click();
      const field = dialog.getByRole("textbox").first();
      await field.fill(`bundle-${tag}.rtfd`);
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      const entry = await until(async () => {
        const all = await drive(page);
        const made = all.find((each) => each.name === `bundle-${tag}.rtfd`);
        if (!made) return null;
        const inside = all.filter((each) => each.parent === made.id && !each.trashed_ms);
        return inside.length === 2 ? { made, inside } : null;
      }, 10_000);
      const main = entry?.inside.find((each) => each.name === "TXT.rtf");
      const picture = entry?.inside.find((each) => /^Pasted Graphic .*\.png$/.test(each.name));
      const text = main ? await textOf(page, main.id) : "";
      const bytes = picture ? await bytesOf(page, picture.id) : null;
      return [
        entry?.made.kind === "folder" &&
          text.includes(`NeXTGraphic ${picture?.name}`) &&
          !text.includes("\\pict") &&
          bytes?.length === png.length,
        `${entry?.inside.map((each) => each.name).join(", ")}; ${text.length} bytes of RTF`,
      ];
    },
  );
  await row(
    "textedit.206.edit",
    "an edit goes on into TXT.rtf, with one picture still",
    async () => {
      const view = window.locator(".mac-textedit-view").first();
      await view.click();
      await page.keyboard.press("ControlOrMeta+End");
      await page.keyboard.type(`later ${tag}`);
      await page.keyboard.press("ControlOrMeta+s");
      const held = await until(async () => {
        const all = await drive(page);
        const made = all.find((each) => each.name === `bundle-${tag}.rtfd`);
        const inside = all.filter((each) => each.parent === made?.id && !each.trashed_ms);
        const main = inside.find((each) => each.name === "TXT.rtf");
        if (!main) return null;
        return (await textOf(page, main.id)).includes(`later ${tag}`) ? inside : null;
      }, 15_000);
      return [held?.length === 2, held?.map((each) => each.name).join(", ")];
    },
  );
  await row(
    "textedit.206.open",
    "after a reload, File > Open opens the .rtfd with its picture",
    async () => {
      await page.keyboard.press("Escape");
      await reloadDesktop(page);
      await spotlight(page, "TextEdit", ".mac-window:has(.mac-textedit-view)");
      await chooseMenu(page, "File", "Open…");
      const panel = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("button", { name: "Open", exact: true }) })
        .last();
      await panel.waitFor({ timeout: 5_000 });
      await panel.getByText(`bundle-${tag}.rtfd`, { exact: true }).first().click();
      await panel.getByRole("button", { name: "Open", exact: true }).click();
      const opened = page.locator(".mac-textedit-view:has(img)").first();
      await opened.waitFor({ timeout: 10_000 });
      const text = await opened.innerText();
      await shot(page, path.join(out, "textedit-rtfd.png"));
      return [text.includes(`later ${tag}`), text.slice(0, 80)];
    },
  );
  await closeFront(page);
}

async function preview(page) {
  const png = await sharp({
    create: { width: 600, height: 400, channels: 3, background: "#ddd" },
  })
    .png()
    .toBuffer();
  const name = `marks-${tag}.png`;
  await upload(page, name, png, "image/png");
  await reloadDesktop(page);
  await openInFinder(page, name);
  const window = page
    .locator(".mac-window:has(.mac-preview-app-toolbar), .mac-window.mac-preview-app")
    .first();
  await page.waitForTimeout(1_200);
  await chooseMenu(page, "View", "Show Markup Toolbar").catch(() => {});
  await row(
    "preview.214",
    "Text Style's Show Fonts sets a family outside the menu's five, kept across a reload",
    async () => {
      const style = page.getByRole("button", { name: "Text Style" }).first();
      await style.click();
      await page.getByRole("menuitem", { name: "Show Fonts", exact: true }).click();
      const panel = page.locator(".mac-preview-app-fonts");
      await panel.waitFor({ timeout: 5_000 });
      await shot(page, path.join(out, "preview-fonts.png"));
      const dimmed = await panel.getByText(/not installed/).count();
      const family = "Arial";
      await panel.getByRole("option", { name: family, exact: true }).click();
      await page.waitForTimeout(600);
      await style.click();
      const row = page.getByRole("menuitemradio", { name: family, exact: true });
      await row.waitFor({ timeout: 3_000 });
      const listed = await row.isVisible();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Text", exact: true }).first().click();
      const box = await page.locator('[data-page="1"] canvas').first().boundingBox();
      await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6);
      const typing = page.getByRole("textbox", { name: "Text" }).first();
      await typing.waitFor({ timeout: 5_000 });
      await typing.fill(`Hello ${tag}`);
      await typing.press("Enter");
      const id = (await fileNamed(page, name)).id;
      const mark = await until(async () => {
        const { markup } = (await api(page, "GET", `/api/preview/markup/${id}`)).json;
        return markup?.pages?.[0]?.items?.find((each) => each.text === `Hello ${tag}`);
      }, 8_000);
      await shot(page, path.join(out, "preview-font-mark.png"));
      return [listed && mark?.font === family, `${JSON.stringify(mark)}; dimmed note ${dimmed}`];
    },
  );
  await window.isVisible().catch(() => false);
  await closeFront(page);
}

async function about(page) {
  await reloadDesktop(page);
  const bar = page.getByRole("menubar").first();
  await bar
    .getByRole("menuitem", { name: "Apple" })
    .click()
    .catch(() => bar.locator("[role=menuitem]").first().click());
  await page.getByRole("menuitem", { name: "About This Mac" }).click();
  await page
    .locator(".mac-about-this-mac, [aria-label='About This Mac']")
    .first()
    .waitFor({ timeout: 10_000 });
  const open = (name) => bar.getByRole("menuitem", { name, exact: true }).click();
  const rows = async () =>
    (await page.getByRole("menuitem").allTextContents()).map((each) => each.trim()).filter(Boolean);
  await row("about.14.edit", "Edit is Finder's own, dimmed with nothing selected", async () => {
    await open("Edit");
    const copy = page.getByRole("menuitem", { name: /^Copy/ }).first();
    const dimmed = await copy.getAttribute("aria-disabled");
    const all = await rows();
    await page.keyboard.press("Escape");
    return [
      dimmed === "true" && all.some((each) => each.startsWith("Show Clipboard")),
      all.join(" | "),
    ];
  });
  await row("about.14.help", "Help is Finder's own rows", async () => {
    await open("Help");
    const all = await rows();
    await page.keyboard.press("Escape");
    return [
      all.some((each) => each.startsWith("Finder Help")) &&
        all.some((each) => each.startsWith("Tips for Your Mac")),
      all.join(" | "),
    ];
  });
  await row("about.14.go", "Go's Documents opens Finder there", async () => {
    await open("Go");
    const all = await rows();
    await page
      .getByRole("menuitem", { name: /^Documents/ })
      .first()
      .click();
    const finder = page.locator(".mac-window.mac-finder").first();
    await finder.waitFor({ timeout: 10_000 });
    const selected = finder.getByRole("treeitem", { name: "Documents", exact: true }).first();
    const shown = await until(
      async () => (await selected.getAttribute("aria-selected")) === "true",
      5_000,
    );
    await shot(page, path.join(out, "about-go.png"));
    return [shown && all.some((each) => each.startsWith("Enclosing Folder")), all.join(" | ")];
  });
}

async function services(page, id, name, selectText) {
  const bar = page.getByRole("menubar").first();
  await row(
    `${id}.preferences`,
    `${name} has no preferences: the row is dimmed and says so`,
    async () => {
      await bar.getByRole("menuitem", { name, exact: true }).click();
      const row = page.getByRole("menuitem", { name: "Preferences…" }).first();
      const dimmed = await row.getAttribute("aria-disabled");
      const note = await page
        .getByText(`${name} has no preferences`)
        .first()
        .isVisible()
        .catch(() => false);
      await page.keyboard.press("Escape");
      return [dimmed === "true" && note, `dimmed ${dimmed}, says so ${note}`];
    },
  );
  await row(
    `${id}.services`,
    "Services lists what applies to the text selected, and none without",
    async () => {
      const list = async () => {
        await bar.getByRole("menuitem", { name, exact: true }).click();
        await page.getByRole("menuitem", { name: "Services", exact: true }).hover();
        await page.waitForTimeout(400);
        const rows = await page.getByRole("menuitem").allTextContents();
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
        return rows;
      };
      const selected = await selectText();
      const some = await list();
      return [
        selected
          ? some.some((each) => /New Note|New TextEdit|Look Up|Search With|Make/i.test(each))
          : some.some((each) => each === "No Services Apply"),
        some.slice(-8).join(" | "),
      ];
    },
  );
}

async function home(page) {
  await reloadDesktop(page);
  const window = await spotlight(page, "Home", '[data-window-id="home"]');
  await page.waitForTimeout(1_000);
  const inSheet = page.getByRole("dialog");
  const add = async (name, kind) => {
    await chooseMenu(page, "File", "Add Accessory…");
    await inSheet.getByRole("textbox", { name: "Name:" }).fill(name);
    if (kind) {
      await inSheet.getByRole("combobox", { name: "Kind:" }).click();
      await page.getByRole("option", { name: kind, exact: true }).click();
    }
    await inSheet.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForTimeout(400);
  };
  const homes = async () => (await api(page, "GET", "/api/home/homes")).json.homes ?? [];
  const stamp = `${tag}`;
  await add(`Lamp ${stamp}`, null);
  await add(`Fan ${stamp}`, "Outlet");
  await row("home.65", "Add Scene sets any accessory, not only one room's lights", async () => {
    await chooseMenu(page, "File", "Add Scene…");
    await inSheet.getByRole("textbox", { name: "Name:" }).fill(`Fan Only ${stamp}`);
    await inSheet.getByRole("combobox", { name: "Room:" }).click();
    await page.getByRole("option", { name: "No Room", exact: true }).click();
    const unset = await inSheet
      .getByRole("button", { name: "Add", exact: true })
      .getAttribute("aria-disabled");
    await inSheet.getByRole("combobox", { name: new RegExp(`Fan ${stamp}:$`) }).click();
    await page.getByRole("option", { name: "On", exact: true }).click();
    await shot(page, path.join(out, "home-add-scene.png"));
    await inSheet.getByRole("button", { name: "Add", exact: true }).click();
    const scene = await until(async () => {
      for (const each of await homes()) {
        const fan = each.accessories.find((a) => a.name === `Fan ${stamp}`);
        const made = each.scenes.find((s) => s.name === `Fan Only ${stamp}`);
        if (made && fan) return Object.entries(made.sets).join() === `${fan.id},true` ? made : null;
      }
      return null;
    }, 6_000);
    return [Boolean(scene), `empty Add ${unset}; ${JSON.stringify(scene?.sets)}`];
  });
  await services(page, "home", "Home", async () => false);
  await window.isVisible().catch(() => false);
}

async function network(page) {
  await reloadDesktop(page);
  await spotlight(page, "Network Utility", '[data-window-id="network-utility"]');
  await services(page, "network", "Network Utility", async () => {
    const field = page.locator('[data-window-id="network-utility"] input:visible').first();
    await field.fill("example.com");
    await field.selectText();
    return true;
  });
}

async function dictionary(page) {
  await install(page, "dictionary");
  await reloadDesktop(page);
  const window = await openApp(page, "Dictionary");
  await page.waitForTimeout(600);
  const search = window.getByRole("searchbox", { name: "Search" });
  await search.waitFor({ timeout: 15_000 });
  await search.fill("tomato");
  await search.press("Enter");
  const said = window.locator(".mac-dictionary-pronunciation").first();
  await said.waitFor({ timeout: 25_000 });
  const us = await api(page, "GET", "/api/dictionary/entry?word=tomato");
  const accents = us.json.dictionary?.accents ?? {};
  await row("dictionary.118.server", "the entry carries each accent the source has", async () => [
    Object.keys(accents).length > 0,
    JSON.stringify(accents),
  ]);
  await row(
    "dictionary.118.pref",
    "Preferences' Pronunciation changes the word's, and stays",
    async () => {
      const before = await said.innerText();
      await page.keyboard.press("ControlOrMeta+,");
      const pop = page.getByRole("combobox", { name: "Pronunciation" });
      await pop.waitFor({ timeout: 5_000 });
      const dimmed = await pop.getAttribute("aria-disabled");
      await pop.click();
      await page.getByRole("option", { name: "British English", exact: true }).click();
      await shot(page, path.join(out, "dictionary-pronunciation.png"));
      const expected = accents.uk?.pronunciation;
      const changed = await until(async () => (await said.innerText()).includes(expected), 5_000);
      await page.keyboard.press("ControlOrMeta+w");
      await reloadDesktop(page);
      const again = await openApp(page, "Dictionary");
      const field = again.getByRole("searchbox", { name: "Search" });
      await field.waitFor({ timeout: 15_000 });
      await field.fill("tomato");
      await field.press("Enter");
      const kept = again.locator(".mac-dictionary-pronunciation").first();
      await kept.waitFor({ timeout: 25_000 });
      const stays = await until(async () => (await kept.innerText()).includes(expected), 5_000);
      return [
        Boolean(expected) && !before.includes(expected) && dimmed !== "true" && changed && stays,
        `${before} -> uk ${expected}; changed ${changed}; after a reload ${await kept.innerText()}`,
      ];
    },
  );
}

await run(async (page) => {
  await openDesktop(page, base, step);
  for (const [group, body] of [
    ["photos", photos],
    ["booth", booth],
    ["quicktime", quicktime],
    ["textedit", textedit],
    ["preview", preview],
    ["about", about],
    ["home", home],
    ["network", network],
    ["dictionary", dictionary],
  ]) {
    if (!wanted(group)) continue;
    try {
      await body(page);
    } catch (error) {
      step(`${group}: the group ran to its end`, false, String(error).split("\n")[0]);
    }
  }
});
