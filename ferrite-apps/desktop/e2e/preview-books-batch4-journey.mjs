#!/usr/bin/env node
// The batch of Preview, Music, Stickies, QuickTime Player and Voice Memos rows on the desktop served
// by `ferrite dev`: real server, real pdf.js, Chromium's fake camera, microphone and screen picker.
// One stand-in: Maps' /api/maps/reverse answers from this journey, since the sandbox has no route to
// OpenStreetMap, so Location-based Naming proves its use of that answer and not the geocoder.
// A small server on 127.0.0.1 is the stream Music opens. Every other value is read back from the
// server or the drive.
//
// Outside Chromium two more stand-ins, as no other browser lets a page read the computer's clipboard
// here and Firefox's print preview would hold the page until a person closes it: Clipboard.write and
// read keep the picture in memory, and print() does nothing. Firefox's fake devices give the microphone
// and not the screen (the part of the screen to record never appeared in 20 seconds), so its run says
// so and leaves out the recorded portion. WebKit on Linux has no MediaRecorder and no screen capture, so
// its run says so and leaves out the recorded portion and the recorded memo.
//
//   node e2e/preview-books-batch4-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]
//        [--browser chromium|chrome|firefox|webkit]

import { createServer } from "node:http";
import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const isChromium = ["chromium", "chrome"].includes(browserName);
const AT_LONDON = { geolocation: { latitude: 51.5, longitude: -0.12 } };
const { step, run } = journey("preview-books-batch4", {
  ignoreOtherOrigins: true,
  // The Dock's Trash is one picture whose source goes from empty to full when the drive's listing
  // arrives. If that is before the empty one has loaded, Firefox cancels it.
  ignoreRequests: (url, errorText) =>
    browserName === "firefox" &&
    errorText === "NS_BINDING_ABORTED" &&
    /\/assets\/trash-empty-[^/]+\.webp$/.test(url),
  launchOptions: {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--auto-select-desktop-capture-source=Entire screen",
      ],
    },
    firefox: {
      firefoxUserPrefs: {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": true,
      },
    },
  },
  contextOptions: {
    chromium: {
      permissions: ["clipboard-read", "clipboard-write", "geolocation", "microphone", "camera"],
      ...AT_LONDON,
    },
    firefox: { permissions: ["geolocation"], ...AT_LONDON },
    webkit: { permissions: ["geolocation"], ...AT_LONDON },
  },
});
const RUN = Date.now().toString(36);
const PICTURE = `Cut ${RUN}.png`;
const MARKS = `Marks ${RUN}.png`;
const TEXTUAL = `Text ${RUN}.pdf`;
const EXPORTED = `Kept ${RUN}.pdf`;
const WORDS = "Ferries leave at ten";
const LIBRARY = "/api/app-store/library";

function textPdf() {
  const stream = `BT /F1 28 Tf 72 700 Td (${WORDS}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) body += `${String(at).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return body;
}

/** A second of a sine wave as a mono WAV. */
function wav() {
  const rate = 8_000;
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + rate * 2, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(rate * 2, 40);
  const pcm = Buffer.alloc(rate * 2);
  for (let i = 0; i < rate; i += 1) pcm.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), i * 2);
  return Buffer.concat([head, pcm]);
}

const stream = createServer((_request, response) => {
  response.writeHead(200, {
    "content-type": "audio/wav",
    "access-control-allow-origin": "*",
  });
  response.end(wav());
});
await new Promise((resolve) => stream.listen(0, "127.0.0.1", resolve));
const STREAM_URL = `http://127.0.0.1:${stream.address().port}/radio%20one.wav`;

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
  page.setDefaultTimeout(15_000);
  if (!isChromium) {
    await page.addInitScript(() => {
      let items = [];
      Clipboard.prototype.write = async (given) => {
        items = given;
      };
      Clipboard.prototype.read = async () => items;
    });
  }
  await openDesktop(page, base, step);
  const upload = (name, text, type) =>
    page.evaluate(
      async ({ name, text, type }) => {
        let blob = new Blob([text ?? ""], { type });
        if (text === null) {
          const canvas = document.createElement("canvas");
          canvas.width = 400;
          canvas.height = 300;
          const context = canvas.getContext("2d");
          context.fillStyle = "#204080";
          context.fillRect(0, 0, 400, 300);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        }
        const json = { "content-type": "application/json" };
        const uploading = await fetch("/api/files/uploads", {
          method: "POST",
          credentials: "same-origin",
          headers: json,
          body: JSON.stringify({
            parent: "pictures",
            name,
            size: blob.size,
            type,
            existing: "fail",
          }),
        }).then((response) => response.json());
        await fetch(`/api/files/uploads/${uploading.upload}/0`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await blob.arrayBuffer(),
        });
        const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
          method: "POST",
          credentials: "same-origin",
          headers: json,
          body: "{}",
        }).then((response) => response.json());
        return done.created[0];
      },
      { name, text, type },
    );
  await upload(PICTURE, null, "image/png");
  await upload(MARKS, null, "image/png");
  await upload(TEXTUAL, textPdf(), "application/pdf");
  const held = (await api(page, "GET", LIBRARY)).json;
  const wanted = ["preview", "quicktime-player", "voice-memos"].filter(
    (each) => !(held.installed ?? []).includes(each),
  );
  if (wanted.length > 0) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), ...wanted],
      rev: held.rev,
    });
  }
  await reloadDesktop(page);

  const launch = async (_page, name) => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill(name);
    await page.waitForTimeout(400);
    await field.press("Enter");
  };
  const bar = page.getByRole("menubar").first();
  const choose = async (menu, item, through) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).first().click();
    if (through) await page.getByRole("menuitem", { name: through, exact: true }).first().click();
    await page
      .getByRole("menuitem", { name: item, exact: true })
      .or(page.getByRole("menuitemradio", { name: item, exact: true }))
      .first()
      .click();
    await page.waitForTimeout(350);
  };
  const entries = async () => (await api(page, "GET", "/api/files/")).json.entries ?? [];
  const fileId = async (name) =>
    (await entries()).find((each) => each.name === name && each.trashed_ms === undefined)?.id;

  /* Preview. */

  const preview = page
    .locator(
      '.mac-managed-window[data-window-id^="preview"]:has([data-window-state="key"]) .mac-preview-app',
    )
    .first();
  const openFile = async (name) => {
    await until(async () => {
      const dialog = page.getByRole("dialog", { name: "Open" });
      if (await dialog.isVisible()) return true;
      await choose("File", "Open…");
      return dialog.isVisible();
    });
    const dialog = page.getByRole("dialog", { name: "Open" });
    await page.waitForTimeout(600);
    await dialog.getByRole("option", { name }).dblclick();
    await page.locator('[data-page="1"] canvas').first().waitFor({ state: "attached" });
    await page.waitForTimeout(600);
  };
  const overlay = () => preview.locator('[data-page="1"] .mac-preview-app-page-marks');
  const at = async ([u, v]) => {
    const box = await overlay().boundingBox();
    return [box.x + box.width * u, box.y + box.height * v];
  };
  const drag = async (from, to) => {
    await page.mouse.move(...(await at(from)));
    await page.mouse.down();
    await page.mouse.move(...(await at(to)), { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  const marksOf = async (name) => {
    const id = await fileId(name);
    const { markup } = (await api(page, "GET", `/api/preview/markup/${id}`)).json;
    return markup?.pages?.find((each) => each.page === 1)?.items ?? [];
  };

  await launch(page, "Preview");
  await preview.waitFor({ state: "visible" });
  await openFile(PICTURE);
  await choose("Tools", "Rectangular Selection");
  await drag([0.25, 0.25], [0.75, 0.75]);
  await choose("Edit", "Cut");
  await shot(page, path.join(out, "batch4-preview-cut.png"));
  // Preview writes the clipboard once the canvas has given its picture, some time after the menu closes.
  let copied = [];
  await until(async () => {
    copied = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      if (!item) return [];
      const bitmap = await createImageBitmap(await item.getType("image/png"));
      return [bitmap.width, bitmap.height];
    });
    return copied.length > 0;
  }, 10_000);
  step(
    "Cut puts the picture's selection on the clipboard",
    Math.abs(copied[0] - 200) <= 2 && Math.abs(copied[1] - 150) <= 2,
    copied.join("x"),
  );
  await choose("File", "Save");
  const cutPixels = await until(async () => {
    const id = await fileId(PICTURE);
    return page.evaluate(async (id) => {
      const blob = await fetch(`/api/files/content/${id}?piece=0&count=8`, {
        credentials: "same-origin",
      }).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const middle = context.getImageData(200, 150, 1, 1).data[3];
      const corner = context.getImageData(20, 20, 1, 1).data[3];
      return middle === 0 && corner === 255 ? { middle, corner } : false;
    }, id);
  });
  step(
    "the saved picture is clear where it was cut and whole elsewhere",
    Boolean(cutPixels),
    JSON.stringify(cutPixels),
  );

  await openFile(MARKS);
  await choose("View", "Show Markup Toolbar").catch(() => {});
  await choose("Tools", "Polygon", "Annotate");
  await drag([0.1, 0.1], [0.5, 0.5]);
  const polygon = await until(async () => (await marksOf(MARKS)).find((each) => each.sides === 6));
  step(
    "a polygon is kept with its six sides",
    polygon?.points?.length === 7,
    JSON.stringify(polygon?.points?.length),
  );
  const selectTool = async () => {
    await preview.getByRole("button", { name: "Select", exact: true }).click();
    await page.waitForTimeout(150);
  };
  await selectTool();
  // The sides handle slides across the middle of the box, from 20% to 80% of its width.
  const sideAt = 0.1 + 0.4 * (0.2 + (0.6 * (6 - 3)) / 9);
  await drag([sideAt, 0.3], [0.1 + 0.4 * 0.8, 0.3]);
  const twelve = await until(async () => (await marksOf(MARKS)).find((each) => each.sides === 12));
  step(
    "the green handle asks for twelve sides, and the server keeps them",
    twelve?.points?.length === 13,
  );
  const [topX, topY] = twelve?.points?.[3] ?? [0, 0];
  await drag([topX, topY], [0.6, 0.3]);
  const moved = await until(async () => {
    const mark = (await marksOf(MARKS)).find((each) => each.sides === 12);
    return Math.abs((mark?.points?.[3]?.[0] ?? 0) - 0.6) < 0.01 ? mark : false;
  });
  step(
    "one corner's handle moves that corner alone",
    Boolean(moved) && moved.points[4][0] === twelve.points[4][0],
  );

  await choose("Tools", "Loupe", "Annotate");
  await drag([0.6, 0.6], [0.9, 0.9]);
  await until(async () => (await marksOf(MARKS)).some((each) => each.kind === "loupe"));
  await selectTool();
  // A power of 2 stands at a quarter of the handle's way.
  await drag([0.6 + 0.3 * (0.2 + 0.6 * 0.25), 0.75], [0.6 + 0.3 * 0.8, 0.75]);
  const loupe = await until(async () =>
    (await marksOf(MARKS)).find((each) => each.kind === "loupe" && each.power === 5),
  );
  step("the loupe's second handle sets how far it magnifies", Boolean(loupe));

  await choose("Tools", "Speech Bubble", "Annotate");
  await drag([0.1, 0.55], [0.5, 0.95]);
  const typing = preview.getByRole("textbox", { name: "Text" });
  await typing.fill("Hello there");
  await typing.press("Enter");
  const bubble = await until(async () =>
    (await marksOf(MARKS)).find((each) => each.bubble && each.text === "Hello there"),
  );
  step("what a speech bubble says is kept in it", Boolean(bubble));
  await shot(page, path.join(out, "batch4-preview-shapes.png"));
  await preview.getByRole("button", { name: "Select", exact: true }).click();
  await drag([0.3, 0.7], [0.45, 0.8]);
  const shifted = await until(async () => {
    const mark = (await marksOf(MARKS)).find((each) => each.bubble);
    return mark && mark.points[0][0] > (bubble?.points?.[0]?.[0] ?? 1) + 0.05 ? mark : false;
  });
  step(
    "the words go with the bubble when it moves",
    shifted?.text === "Hello there" &&
      (await marksOf(MARKS)).filter((each) => each.kind === "text").length === 0,
  );

  for (const name of ["Bold", "Italic", "Underline"]) {
    await preview.getByRole("button", { name: "Text Style" }).click();
    const row = page.getByRole("menuitemcheckbox", { name, exact: true });
    await row.waitFor({ state: "visible" });
    await page.waitForTimeout(250);
    await row.click();
    await page.waitForTimeout(350);
  }
  const styledBubble = await until(async () => {
    const mark = (await marksOf(MARKS)).find((each) => each.bubble);
    return mark?.bold && mark.italic && mark.underline ? mark : false;
  });
  step("Text Style's Bold, Italic and Underline go to the bubble chosen", Boolean(styledBubble));
  await preview.getByRole("button", { name: "Text", exact: true }).click();
  await page.mouse.click(...(await at([0.7, 0.2])));
  await typing.fill("Styled");
  await typing.press("Enter");
  const styled = await until(async () =>
    (await marksOf(MARKS)).find((each) => each.kind === "text" && each.text === "Styled"),
  );
  step(
    "and to the next text, which the server keeps",
    styled?.bold === true && styled?.italic === true && styled?.underline === true,
    JSON.stringify(styled ?? null).slice(0, 160),
  );
  await shot(page, path.join(out, "batch4-preview-style.png"));
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  const afterReload = await marksOf(MARKS);
  step(
    "a reload keeps the polygon, the power, the words and the style",
    afterReload.some((each) => each.sides === 12) &&
      afterReload.some((each) => each.power === 5) &&
      afterReload.some((each) => each.bubble && each.text === "Hello there") &&
      afterReload.some((each) => each.bold && each.kind === "text"),
  );
  await launch(page, "Preview");
  await preview.waitFor({ state: "visible" });
  await openFile(TEXTUAL);
  await page
    .locator('[data-page="1"] .mac-preview-app-page-text span', { hasText: "Ferries" })
    .first()
    .waitFor({ state: "attached", timeout: 20_000 });
  await choose("Tools", "Rectangle", "Annotate");
  await drag([0.2, 0.3], [0.6, 0.5]);
  await until(async () => (await marksOf(TEXTUAL)).length === 1);
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Export as PDF…", exact: true }).click();
  const sheet = page.getByRole("dialog").last();
  const saveAs = sheet.getByRole("textbox", { name: "Save As:" });
  await page.waitForTimeout(400);
  for (let tries = 0; tries < 5 && (await saveAs.inputValue()) !== EXPORTED; tries += 1) {
    await saveAs.fill(EXPORTED);
    await page.waitForTimeout(150);
  }
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  step("Export as PDF writes the marked PDF", Boolean(await until(() => fileId(EXPORTED))));
  await openFile(EXPORTED);
  const kept = await until(() =>
    page
      .locator('[data-page="1"] .mac-preview-app-page-text')
      .first()
      .evaluate((layer) => layer.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .then((said) => (said.includes(WORDS) ? said : false)),
  );
  step("pdf.js finds the page's words in what Export wrote", Boolean(kept), String(kept));
  await shot(page, path.join(out, "batch4-preview-export.png"));

  /* Music. */

  const MUSIC = "/api/music/library";
  const songs = async () => (await api(page, "GET", MUSIC)).json.library?.songs ?? [];
  await launch(page, "Music");
  await page
    .getByRole("button", { name: "Songs" })
    .or(page.getByText("Songs", { exact: true }))
    .first()
    .waitFor();
  await page.waitForTimeout(800);
  await choose("File", "Open Stream…");
  const opening = page.getByRole("dialog", { name: "Open Stream" });
  await opening.getByRole("textbox", { name: "URL" }).fill("not an address");
  step(
    "Open Stream takes only a web address",
    await opening.getByRole("button", { name: "OK" }).isDisabled(),
  );
  await opening.getByRole("textbox", { name: "URL" }).fill(STREAM_URL);
  await shot(page, path.join(out, "batch4-music-stream.png"));
  await opening.getByRole("button", { name: "OK" }).click();
  const kept2 = await until(async () =>
    (await songs()).find((song) => song.source.kind === "stream"),
  );
  step(
    "the stream is in the library, as the server keeps it",
    kept2?.source?.url === STREAM_URL && kept2?.title === "radio one.wav",
    JSON.stringify(kept2?.source ?? null),
  );
  const playing = await until(() =>
    page
      .evaluate(() => [...document.querySelectorAll("audio")].length >= 0)
      .then(async () => {
        const { json } = await api(page, "GET", "/api/music/playback");
        return json.playback?.queue?.includes(kept2?.id);
      }),
  );
  step("and it is what plays", Boolean(playing));

  await page
    .locator('input[type="file"][aria-label="Add to Library"]')
    .setInputFiles({ name: `Tone ${RUN}.wav`, mimeType: "audio/wav", buffer: wav() });
  const tone = await until(async () =>
    (await songs()).find((song) => song.source.name === `Tone ${RUN}.wav`),
  );
  step("a real song is added to convert", Boolean(tone));
  await page
    .getByRole("treeitem", { name: "Songs" })
    .or(page.getByRole("option", { name: "Songs" }))
    .or(page.getByRole("button", { name: "Songs", exact: true }))
    .first()
    .click();
  await page
    .getByRole("row", { name: new RegExp(`Tone ${RUN}`) })
    .first()
    .click();
  await choose("File", "Create WAV Version", "Convert");
  const converted = await until(async () => {
    const list = await songs();
    const made = list.filter(
      (song) => song.source.kind === "file" && song.source.name?.startsWith(`Tone ${RUN}`),
    );
    return made.length === 2 ? made : false;
  }, 30_000);
  step(
    "Convert keeps a new song, with the first's title, whose file a browser decodes",
    Boolean(converted) && converted[0].title === converted[1].title,
    JSON.stringify(converted?.map((song) => song.source.name)),
  );
  if (converted) {
    const seconds = await page.evaluate(async (id) => {
      const blob = await fetch(`/api/files/content/${id}?piece=0&count=8`, {
        credentials: "same-origin",
      }).then((response) => response.arrayBuffer());
      const sound = await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(blob);
      return sound.duration;
    }, converted[1].source.file);
    step(
      "the converted file is the same second of sound",
      Math.abs(seconds - 1) < 0.05,
      `${seconds}`,
    );
  }
  await choose("File", "Page Setup…");
  const musicSheet = page.getByRole("dialog", { name: "Page Setup" }).last();
  await musicSheet.getByRole("radio", { name: "Landscape" }).click();
  await musicSheet.getByRole("button", { name: "OK", exact: true }).click();
  /** Records the page a print frame is given, and keeps its print() from opening anything. */
  const watchPrinting = () =>
    page.evaluate(() => {
      window.__printed = null;
      new MutationObserver((_, watch) => {
        const frame = document.querySelector(
          "iframe[data-music-print], iframe[data-textedit-print]",
        );
        if (!frame) return;
        watch.disconnect();
        window.__printed = frame.srcdoc;
        frame.addEventListener(
          "load",
          () => {
            frame.contentWindow.print = () => {};
          },
          { capture: true },
        );
      }).observe(document.body, { childList: true });
    });
  await watchPrinting();
  await choose("File", "Print…");
  step(
    "Music prints on the paper Page Setup chose",
    await until(async () =>
      /@page\{size:Letter landscape\}/.test((await page.evaluate(() => window.__printed)) ?? ""),
    ),
  );

  /* Stickies. */

  await launch(page, "Stickies");
  await page.locator('[data-window-id^="stickies"]').first().waitFor();
  await page.waitForTimeout(600);
  await choose("File", "Page Setup…");
  const stickySheet = page.getByRole("dialog", { name: "Page Setup" }).last();
  await stickySheet.getByRole("radio", { name: "Landscape" }).click();
  await shot(page, path.join(out, "batch4-stickies-page-setup.png"));
  await stickySheet.getByRole("button", { name: "OK", exact: true }).click();
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  await launch(page, "Stickies");
  await page.locator('[data-window-id^="stickies"]').first().waitFor();
  await page.waitForTimeout(600);
  await watchPrinting();
  await choose("File", "Print Active Note");
  step(
    "after a reload Stickies prints on the paper Page Setup chose",
    await until(async () =>
      /size:Letter landscape/.test((await page.evaluate(() => window.__printed)) ?? ""),
    ),
  );

  /* QuickTime Player. */

  const records = browserName !== "webkit";
  if (!isChromium) {
    console.log(
      `note not run in ${browserName}: QuickTime's selected portion${records ? "" : " and the recorded memo"}`,
    );
  } else {
    await launch(page, "QuickTime Player");
    const qt = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
    await qt.waitFor({ state: "visible" });
    await page.waitForTimeout(600);
    await choose("File", "New Screen Recording");
    await qt.getByRole("button", { name: "Recording Options", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Selected Portion", exact: true }).click();
    await page.waitForTimeout(200);
    const moviesBefore = (await entries()).length;
    await qt.getByRole("button", { name: "Start Recording", exact: true }).click();
    const area = qt.getByRole("application", { name: "Part of the screen to record" });
    await area.waitFor({ timeout: 20_000 });
    const wholeWidth = await until(() =>
      area.locator("video").evaluate((video) => (video.videoWidth > 0 ? video.videoWidth : false)),
    );
    const box = await area.boundingBox();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75, { steps: 6 });
    await page.mouse.up();
    await shot(page, path.join(out, "batch4-quicktime-area.png"));
    await qt.getByRole("button", { name: "Record Selection" }).click();
    await qt
      .getByRole("button", { name: "Stop Recording", exact: true })
      .waitFor({ timeout: 15_000 });
    await page.waitForTimeout(2_000);
    await qt.getByRole("button", { name: "Stop Recording", exact: true }).click();
    const movie = await until(async () => (await entries()).length > moviesBefore, 30_000);
    const video = page.locator("video.mac-quicktime-player-video").first();
    const recorded = await until(
      () => video.evaluate((element) => (element.videoWidth > 0 ? element.videoWidth : false)),
      30_000,
    );
    step(
      "a selected portion records half the width of what the picker shared",
      Boolean(movie) && Math.abs(recorded / wholeWidth - 0.5) < 0.02,
      `${recorded} of ${wholeWidth}`,
    );
  }

  /* Voice Memos. */

  await page.route("**/api/maps/reverse*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: "51.5,-0.12",
        places: [
          {
            id: "way-1",
            name: `Strand ${RUN}`,
            category: "road",
            lat: 51.5,
            lon: -0.12,
            address: [],
          },
        ],
        cached: false,
        attribution: "© OpenStreetMap contributors",
      }),
    }),
  );
  await launch(page, "Voice Memos");
  const memos = page.locator('.mac-managed-window[data-window-id="voice-memos"]').first();
  await memos.waitFor({ state: "visible" });
  await page.waitForTimeout(800);
  await choose("Voice Memos", "Preferences…");
  const naming = page.getByRole("checkbox", { name: "Location-based Naming" });
  await naming.click();
  const stored = await until(async () => {
    const reply = (await api(page, "GET", "/api/voice-memos/preferences")).json;
    return reply.preferences?.locationNaming === true;
  });
  step("the server keeps Location-based Naming", Boolean(stored));
  await page.waitForTimeout(1_000);
  await page.keyboard.press("Escape");
  await page
    .locator(".mac-voice-memos-preferences")
    .getByRole("button", { name: /close/i })
    .first()
    .click()
    .catch(() => {});
  if (records) {
    await memos.getByRole("button", { name: "New Recording" }).click();
    await memos.getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    await memos.getByRole("button", { name: "Done", exact: true }).click();
    const named = await until(
      async () => (await entries()).find((each) => each.name?.startsWith(`Strand ${RUN}`)),
      20_000,
    );
    step(
      "a recording is named after the place, on the drive",
      Boolean(named),
      named?.name ?? "no such file",
    );
  }
  await api(page, "PUT", "/api/voice-memos/preferences", {
    preferences: { audioQuality: "compressed", clearDeleted: "month" },
    rev: (await api(page, "GET", "/api/voice-memos/preferences")).json.rev,
  });
  stream.close();
});
