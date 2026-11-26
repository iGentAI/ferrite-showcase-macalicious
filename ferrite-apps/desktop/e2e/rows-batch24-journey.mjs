#!/usr/bin/env node
// Automator's Apply Quartz Filter to PDF Documents and Create Annotated Movie File, on the served
// desktop, as a new account. A filtered PDF is read back from the drive and drawn by pdf.js here and
// by Preview in the browser; an annotated movie is read back with ffprobe and decoded with ffmpeg.
// Exits 0 only when every step passed with no console error, page error or failed request.
//
//   node e2e/rows-batch24-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount, newAccount } from "./r3-census-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("rows-batch24");
const account = newAccount("batch24", browserName);
const stamp = Date.now().toString(36);
const buildRequire = createRequire(path.join(process.cwd(), "package.json"));
const pdfjs = await import(
  pathToFileURL(buildRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
);

/** One 200 by 200 page: a red square, a light gray square and black text on a white page. */
function pdfOf(text, picture = false) {
  const content = `1 0 0 rg 0 0 100 50 re f 0.8 0.8 0.8 rg 100 0 100 50 re f 0 0 0 rg BT /F1 18 Tf 20 100 Td (${text}) Tj ET${picture ? " q 180 0 0 180 10 10 cm /P Do Q" : ""}`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Count 1/Kids[3 0 R]>>",
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<</Font<</F1 5 0 R>>${picture ? "/XObject<</P 6 0 R>>" : ""}>>/Contents 4 0 R>>`,
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  if (picture) {
    const side = 200;
    let raw = "";
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) raw += String.fromCharCode(x, y, 128);
    }
    objects.push(
      `<</Type/XObject/Subtype/Image/Width ${side}/Height ${side}/ColorSpace/DeviceRGB/BitsPerComponent 8/Length ${raw.length}>>\nstream\n${raw}\nendstream`,
    );
  }
  let file = "%PDF-1.4\n";
  const offsets = objects.map((object, at) => {
    const offset = file.length;
    file += `${at + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const start = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) file += `${String(offset).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(file, "latin1").toString("base64");
}

const upload = (page, parent, name, type, data) =>
  page.evaluate(
    async ({ parent, name, type, data }) => {
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: bytes.length, type, existing: "rename" }),
      });
      if (started.status !== 201) throw new Error(`upload refused: HTTP ${started.status}`);
      const { upload } = await started.json();
      await fetch(`/api/files/uploads/${upload}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: bytes,
      });
      const done = await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
      if (done.status !== 200) throw new Error(`upload not finished: HTTP ${done.status}`);
    },
    { parent, name, type, data },
  );

async function entryNamed(page, name) {
  const drive = (await api(page, "GET", "/api/files/")).json;
  return drive.entries.find((entry) => entry.name === name && entry.trashed_ms === undefined);
}

const bytesOf = (page, entry) =>
  page.evaluate(
    async ({ id, version, size }) => {
      const bytes = [];
      for (let piece = 0; bytes.length < size; piece += 1) {
        const reply = await fetch(
          `/api/files/content/${encodeURIComponent(id)}?piece=${piece}&count=1&version=${version}`,
          { credentials: "same-origin" },
        );
        bytes.push(...new Uint8Array(await reply.arrayBuffer()));
      }
      return bytes;
    },
    { id: entry.id, version: entry.version ?? 0, size: entry.size },
  );

/** The text of a PDF's first page, and its colours at the red square, the gray square and the paper. */
async function pdfFacts(data) {
  const task = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true });
  const document = await task.promise;
  const page = await document.getPage(1);
  const text = (await page.getTextContent()).items.map((item) => item.str).join("");
  const viewport = page.getViewport({ scale: 1 });
  const { canvas, context } = document.canvasFactory.create(viewport.width, viewport.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const at = (x, y) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)];
  const colours = { red: at(50, 175), gray: at(150, 175), paper: at(150, 40) };
  await task.destroy();
  return { text, ...colours };
}

const near = (colour, expected) => colour.every((value, at) => Math.abs(value - expected[at]) <= 3);

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const row = (page, name) => page.getByRole("menuitem", { name }).first();

const automator = async (page) => {
  const window = page.locator(".mac-window.mac-automator").first();
  const actions = window.getByRole("grid", { name: "Actions" });
  const search = window.getByRole("searchbox", { name: "Search" });
  const nameField = window.getByRole("textbox", { name: "Workflow name" });
  const steps = window.locator(".mac-automator-step");
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
  async function add(title, settings = {}) {
    const before = await steps.count();
    await search.fill(title);
    await actions.getByText(title, { exact: true }).first().dblclick();
    await steps.nth(before).waitFor({ timeout: 5_000 });
    await search.fill("");
    const added = steps.nth(before);
    for (const [label, value] of Object.entries(settings)) {
      if (typeof value === "object") {
        await added.getByRole("combobox", { name: label }).click();
        await page.getByRole("option", { name: value.choose, exact: true }).click();
      } else {
        await added.getByLabel(label, { exact: true }).fill(value);
      }
    }
  }
  async function flow(name, list) {
    await bar(page, "File").click();
    await page.waitForTimeout(250);
    await row(page, /^New/).click();
    const sheet = page.getByRole("dialog", { name: /Choose a type/ });
    await sheet.getByRole("button", { name: "Choose" }).click();
    await sheet.waitFor({ state: "detached" });
    const unsaved = page.getByRole("button", { name: "Don’t Save" });
    if (await unsaved.isVisible().catch(() => false)) await unsaved.click();
    await nameField.fill(name);
    for (const [title, settings] of list) await add(title, settings);
    await page.getByRole("button", { name: "Run", exact: true }).click();
    const end = page.getByText(/^Workflow (completed|failed)$/).first();
    await end.waitFor({ timeout: 60_000 });
    return (await page.locator(".mac-automator-lower").first().textContent()) ?? "";
  }
  return { flow, search, actions };
};

const PATHS = "Get Specified Finder Items";
const FILTER = "Apply Quartz Filter to PDF Documents";
const ANNOTATE = "Create Annotated Movie File";

// What each filter makes of the red square, the gray square (0.8) and the white paper.
const EXPECTED = [
  ["Gray Tone", "gray tone", [76, 76, 76], [204, 204, 204], [255, 255, 255]],
  ["Sepia Tone", "sepia tone", [73, 66, 53], [196, 177, 143], [245, 222, 179]],
  ["Blue Tone", "blue tone", [55, 62, 76], [147, 167, 204], [184, 209, 255]],
  ["Black & White", "black & white", [0, 0, 0], [255, 255, 255], [255, 255, 255]],
  ["Lightness Increase", "lightness increase", [255, 64, 64], [217, 217, 217], [255, 255, 255]],
  ["Lightness Decrease", "lightness decrease", [191, 0, 0], [153, 153, 153], [191, 191, 191]],
];

await run(async (page) => {
  page.setDefaultTimeout(15_000);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, account);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  const words = `Page ${stamp}`;
  await upload(page, "documents", "one.pdf", "application/pdf", pdfOf(words));
  await upload(page, "documents", "big.pdf", "application/pdf", pdfOf("Picture", true));

  const scratch = mkdtempSync(path.join(tmpdir(), "batch24-"));
  const source = path.join(scratch, "clip.mp4");
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=64x64:rate=10:duration=1",
    "-c:v",
    "mpeg4",
    source,
  ]);
  const webm = path.join(scratch, "clip.webm");
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=64x64:rate=10:duration=1",
    "-c:v",
    "libvpx",
    webm,
  ]);
  await upload(page, "movies", "clip.mp4", "video/mp4", readFileSync(source).toString("base64"));
  await upload(page, "movies", "clip.webm", "video/webm", readFileSync(webm).toString("base64"));
  await reloadDesktop(page);
  await launch(page, "Automator");
  const flows = await automator(page);

  /* ------------------------------------------------------------------------------- Quartz */
  for (const [filter, mark, red, gray, paper] of EXPECTED) {
    const log = await flows.flow(`${filter} ${stamp}`, [
      [PATHS, { paths: "Documents/one.pdf" }],
      [FILTER, { filter: { choose: filter } }],
    ]);
    const made = await entryNamed(page, `one (${mark}).pdf`);
    const data = made ? await bytesOf(page, made) : [];
    if (made) {
      const kept = path.join(out, `rows-batch24-${filter.replace(/\W+/g, "-")}.pdf`);
      writeFileSync(kept, Buffer.from(data));
    }
    const facts = made ? await pdfFacts(data) : null;
    step(
      `${filter} saves a copy on the Desktop: its colours changed, its text still text`,
      made?.parent === "desktop" &&
        facts?.text === words &&
        near(facts.red, red) &&
        near(facts.gray, gray) &&
        near(facts.paper, paper),
      `${JSON.stringify(facts)} ${log.slice(0, 120)}`,
    );
  }
  let log = await flows.flow(`Reduce ${stamp}`, [
    [PATHS, { paths: "Documents/big.pdf" }],
    [FILTER, { filter: { choose: "Reduce File Size" } }],
  ]);
  const big = await entryNamed(page, "big.pdf");
  const small = await entryNamed(page, "big (reduce file size).pdf");
  step(
    "Reduce File Size saves a smaller copy with the same text",
    small !== undefined &&
      small.size < big.size / 2 &&
      (await pdfFacts(await bytesOf(page, small))).text === "Picture",
    `${big?.size} to ${small?.size} ${log.slice(0, 120)}`,
  );

  log = await flows.flow(`Untouched ${stamp}`, [
    [PATHS, { paths: "Documents/one.pdf" }],
    [FILTER, {}],
  ]);
  step(
    "With the pop-up left as it opens the action runs its first filter, Black & White",
    /one \(black & white\) 2\.pdf/.test(log),
    log.slice(0, 200),
  );

  /* ------------------------------------------------------------------------------ Preview */
  await launch(page, "Finder");
  const finder = page.locator(".mac-finder").first();
  await finder.getByRole("treeitem", { name: "Desktop", exact: true }).first().click();
  await finder.getByRole("option", { name: "one (sepia tone).pdf", exact: true }).dblclick();
  const preview = page.locator(".mac-window.mac-preview").first();
  await preview.waitFor({ timeout: 20_000 });
  const shown = preview.locator("canvas").first();
  await shown.waitFor({ timeout: 20_000 });
  let colours = null;
  for (
    let tries = 0;
    tries < 40 && !(colours && near(colours.paper, [245, 222, 179]));
    tries += 1
  ) {
    await page.waitForTimeout(250);
    colours = await shown.evaluate((canvas) => {
      const context = canvas.getContext("2d");
      const at = (x, y) => [
        ...context
          .getImageData(Math.round(canvas.width * x), Math.round(canvas.height * y), 1, 1)
          .data.slice(0, 3),
      ];
      return { red: at(0.25, 0.875), paper: at(0.75, 0.2) };
    });
  }
  step(
    "Preview, drawing in the browser, shows the sepia page",
    colours !== null && near(colours.paper, [245, 222, 179]) && near(colours.red, [73, 66, 53]),
    JSON.stringify(colours),
  );
  await shot(page, path.join(out, "rows-batch24-sepia.png"));
  await launch(page, "Automator");

  /* ------------------------------------------------------------------------------- Movies */
  log = await flows.flow(`Annotate ${stamp}`, [
    [PATHS, { paths: "Movies/clip.mp4" }],
    [
      ANNOTATE,
      {
        title: "Beach é",
        author: "Ann",
        description: "Waves",
        copyright: "2019 Ann",
      },
    ],
  ]);
  const annotated = await entryNamed(page, "clip (annotated).mp4");
  const copy = path.join(scratch, "annotated.mp4");
  if (annotated) writeFileSync(copy, Buffer.from(await bytesOf(page, annotated)));
  const probe = (file) =>
    JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-show_format", "-print_format", "json", file]),
    ).format;
  const facts = annotated ? probe(copy) : null;
  step(
    "Create Annotated Movie File saves a copy whose annotations ffprobe reads",
    annotated?.parent === "desktop" &&
      facts?.tags?.title === "Beach é" &&
      facts.tags.artist === "Ann" &&
      facts.tags.comment === "Waves" &&
      facts.tags.copyright === "2019 Ann",
    `${JSON.stringify(facts?.tags)} ${log.slice(0, 120)}`,
  );
  const frames = (file) =>
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-count_frames",
      "-select_streams",
      "v",
      "-show_entries",
      "stream=nb_read_frames",
      "-of",
      "csv=p=0",
      file,
    ])
      .toString()
      .trim();
  step(
    "and every frame of the movie still decodes",
    annotated !== undefined && frames(copy) === "10" && frames(copy) === frames(source),
    `${annotated ? frames(copy) : ""} of ${frames(source)}`,
  );

  log = await flows.flow(`Annotate WebM ${stamp}`, [
    [PATHS, { paths: "Movies/clip.webm" }],
    [ANNOTATE, { title: "No" }],
  ]);
  step(
    "A WebM movie fails the step and says why",
    /only a QuickTime or MP4 file has a place for them/.test(log),
    log.slice(0, 200),
  );

  /* ------------------------------------------------------------------------------- Dimmed */
  await flows.search.fill("Apply ColorSync Profile to Images");
  await flows.actions.getByText("Apply ColorSync Profile to Images", { exact: true }).click();
  step(
    "Apply ColorSync stays dimmed, saying what a page lacks",
    await page
      .getByRole("region", { name: "Description" })
      .getByText(/colour profiles macOS keeps/)
      .isVisible(),
  );
  await flows.search.fill("");
  await shot(page, path.join(out, "rows-batch24-automator.png"));
});
