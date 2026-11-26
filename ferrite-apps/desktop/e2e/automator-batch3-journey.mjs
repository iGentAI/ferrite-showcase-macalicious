#!/usr/bin/env node
// Automator's actions that reach other apps, on the served desktop, as a new account (a Guest User
// sends no mail): whole items across a page step, the User variables, Mail, Photos, Music, images,
// PDFs, Safari's tabs and refusal, and Browse All Versions. Each result is read back from the app
// that keeps it, and after a reload. Exits 0 only when every step passed with no console error, page
// error or failed request.
//
// Whether a listed site answers Get Text from Webpage and Download URLs depends on this machine's
// network, so those two print what happened rather than fail.
//
//   node e2e/automator-batch3-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount, newAccount } from "./r3-census-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("automator-batch3");
const account = newAccount("batch", browserName);
const stamp = Date.now().toString(36);

/** A PDF of one page for each text, with a true cross-reference table. */
function pdfOf(pages) {
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    `<</Type/Pages/Count ${pages.length}/Kids[${pages.map((_, at) => `${4 + at * 2} 0 R`).join(" ")}]>>`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  pages.forEach((text, at) => {
    const content = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET`;
    objects.push(
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<</Font<</F1 3 0 R>>>>/Contents ${5 + at * 2} 0 R>>`,
      `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    );
  });
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

/** A quarter of a second of silence as a WAV file. */
function wav() {
  const samples = 2000;
  const file = Buffer.alloc(44 + samples);
  file.write("RIFF", 0);
  file.writeUInt32LE(36 + samples, 4);
  file.write("WAVEfmt ", 8);
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(1, 22);
  file.writeUInt32LE(8000, 24);
  file.writeUInt32LE(8000, 28);
  file.writeUInt16LE(1, 32);
  file.writeUInt16LE(8, 34);
  file.write("data", 36);
  file.writeUInt32LE(samples, 40);
  file.fill(128, 44);
  return file.toString("base64");
}

/** A small red PNG, as this browser's own canvas writes it. */
const pngOf = (page) =>
  page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext("2d");
    context.fillStyle = "red";
    context.fillRect(0, 0, 8, 8);
    return canvas.toDataURL("image/png").split(",")[1];
  });

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

/** The drive's entries, by the name asked for, from the server. */
async function entryNamed(page, name) {
  const drive = (await api(page, "GET", "/api/files/")).json;
  return drive.entries.find((entry) => entry.name === name);
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

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const row = (page, name) => page.getByRole("menuitem", { name }).first();

await run(async (page) => {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, account);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  await upload(page, "documents", "one.pdf", "application/pdf", pdfOf(["Page one", "Page two"]));
  await upload(page, "documents", "two.pdf", "application/pdf", pdfOf(["Page three"]));
  await upload(page, "pictures", "red.png", "image/png", await pngOf(page));
  await upload(page, "music", "tone.wav", "audio/wav", wav());
  await reloadDesktop(page);
  await launch(page, "Automator");

  const actions = page.getByRole("grid", { name: "Actions" });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 20_000 });
  const search = page.getByRole("searchbox", { name: "Search" });
  const nameField = page.getByRole("textbox", { name: "Workflow name" });
  const steps = page.locator(".mac-automator-step");

  /** Add one action by its title and fill its settings: text by label, a pop-up by its choice. */
  async function add(title, settings = {}) {
    const before = await steps.count();
    await search.fill(title);
    await actions.getByText(title, { exact: true }).first().dblclick();
    await steps.nth(before).waitFor({ timeout: 5_000 });
    if (title === "Change Type of Images") {
      await page.getByRole("button", { name: /Don.t Add/ }).click();
    }
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

  /** A new workflow of these steps, run: the text of the log. */
  async function flow(name, list) {
    await bar(page, "File").click();
    await page.waitForTimeout(250);
    await row(page, /^New/).click();
    const sheet = page.getByRole("dialog", { name: /Choose a type/ });
    await sheet.getByRole("button", { name: "Choose" }).click();
    await sheet.waitFor({ state: "detached" });
    await nameField.fill(name);
    for (const [title, settings] of list) await add(title, settings);
    await page.getByRole("button", { name: "Run", exact: true }).click();
    const ended = page.getByText(/^Workflow (completed|failed)$/).first();
    await ended.waitFor({ timeout: 60_000 });
    const log = await page.locator(".mac-automator-lower").first().textContent();
    await page.getByRole("button", { name: "Save Workflow" }).click();
    await page.getByText(`Saved “${name}”`).first().waitFor({ timeout: 10_000 });
    return log ?? "";
  }

  /* ------------------------------------------------------------- whole items and variables */
  let log = await flow(`Whole ${stamp}`, [
    ["Run JavaScript", { code: 'return ["1", "2", "3", "4", "5", "6", "7"];' }],
    ["Get Value of Variable", { variable: "Short name" }],
    ["Run JavaScript", { code: 'return input.length + ":" + input[7].text;' }],
  ]);
  step(
    "seven items and a User variable cross a page step whole",
    log.includes(`8:${account.name}`) && log.includes("Workflow completed"),
    log.slice(0, 300),
  );

  await page.getByRole("radio", { name: "Variables", exact: true }).click();
  const outline = page.getByRole("treegrid", { name: /categories/ }).first();
  await outline.getByText("User", { exact: true }).click();
  step(
    "the Variables library lists the User category",
    await page
      .getByRole("grid", { name: "Variables" })
      .getByText("Full name", { exact: true })
      .isVisible(),
  );
  await page.getByRole("radio", { name: "Actions", exact: true }).click();
  await actions.waitFor({ timeout: 5_000 });
  await outline.getByText("Library", { exact: true }).first().click();

  /* ---------------------------------------------------------------------------------- Mail */
  const SUBJECT = `Report ${stamp}`;
  log = await flow(`Mail ${stamp}`, [
    ["New Mail Message", { to: account.name, subject: SUBJECT, message: "Attached." }],
    ["Get Specified Finder Items", { paths: "Documents/two.pdf" }],
    ["Add Attachments to Front Message", {}],
    ["Send Outgoing Messages", {}],
    ["Find Mail Items", { contains: SUBJECT, mailbox: { choose: "Inbox" } }],
  ]);
  step(
    "the workflow sent a message and found it in the Inbox",
    log.includes("Workflow completed") && log.includes(`${SUBJECT}, from`),
    log.slice(0, 400),
  );
  const mail = async () => (await api(page, "GET", "/api/mail/messages")).json.messages;
  const inMail = (await mail()).filter((message) => message.subject === SUBJECT);
  step(
    "Mail holds the Inbox and Sent copies, with the attachment, and no draft",
    inMail.some((message) => message.mailbox === "inbox") &&
      inMail.some((message) => message.mailbox === "sent") &&
      !inMail.some((message) => message.mailbox === "drafts") &&
      inMail.every((message) => (message.attachments ?? []).length === 1),
    JSON.stringify(inMail.map((message) => [message.mailbox, message.attachments?.length])),
  );

  /* -------------------------------------------------------------------------------- Photos */
  const ALBUM = `Album ${stamp}`;
  const OTHER = `Other ${stamp}`;
  log = await flow(`Photos ${stamp}`, [
    ["New Photo Album", { name: OTHER }],
    ["Get Specified Finder Items", { paths: "Pictures/red.png" }],
    ["Import Files into Photos", {}],
    ["Add to Album", { album: OTHER }],
    ["New Photo Album", { name: ALBUM }],
  ]);
  step("the Photos workflow completed", log.includes("Workflow completed"), log.slice(0, 400));
  const photos = async () => (await api(page, "GET", "/api/photos/library")).json;
  const held = await photos();
  const photo = held.photos.find((each) => each.name === "red");
  const holds = (name) =>
    JSON.stringify(held.albums.find((album) => album.name === name) ?? {}).includes(
      photo?.id ?? "-",
    );
  step(
    "Photos holds the imported picture in both albums",
    Boolean(photo) && holds(ALBUM) && holds(OTHER),
    JSON.stringify(held.albums.map((album) => album.name)),
  );

  /* --------------------------------------------------------------------------------- Music */
  const LIST = `List ${stamp}`;
  const music = [
    ["Get Specified Finder Items", { paths: "Music/tone.wav" }],
    ["Add Songs to Playlist", { playlist: LIST }],
  ];
  log = await flow(`Music ${stamp}`, music);
  step("the Music workflow completed", log.includes("Workflow completed"), log.slice(0, 400));
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.waitForTimeout(3000);
  const songs = (await api(page, "GET", "/api/music/library")).json.library;
  const list = songs.playlists.find((each) => each.name === LIST);
  step(
    "running it twice leaves one song, once, in the playlist",
    songs.songs.length === 1 && list?.songs.length === 1 && list.songs[0] === songs.songs[0].id,
    JSON.stringify({ songs: songs.songs.length, list }),
  );

  /* -------------------------------------------------------------------------------- Images */
  log = await flow(`Type ${stamp}`, [
    ["Get Specified Finder Items", { paths: "Pictures/red.png" }],
    ["Change Type of Images", { to: { choose: "JPEG" } }],
  ]);
  const jpeg = await entryNamed(page, "red.jpg");
  const jpegBytes = jpeg ? await bytesOf(page, jpeg) : [];
  step(
    "Change Type of Images wrote a real JPEG and put the original in the Trash",
    jpegBytes[0] === 0xff &&
      jpegBytes[1] === 0xd8 &&
      Boolean((await entryNamed(page, "red.png"))?.trashed_ms),
    log.slice(0, 300),
  );
  const BANNER = `Banner ${stamp}`;
  log = await flow(`Draw ${stamp}`, [
    ["Create Banner Image from Text", { text: "Hello", size: "48", name: BANNER }],
  ]);
  const banner = await entryNamed(page, `${BANNER}.png`);
  const bannerBytes = banner ? await bytesOf(page, banner) : [];
  const widthOf = (bytes) => (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  step(
    "the banner is a PNG on the Desktop, wider than its margins",
    bannerBytes[1] === 0x50 && widthOf(bannerBytes) > 48 && banner?.parent === "desktop",
    `${widthOf(bannerBytes)} pixels wide; ${log.slice(0, 200)}`,
  );

  /* ---------------------------------------------------------------------------------- PDFs */
  const buildRequire = createRequire(path.join(process.cwd(), "package.json"));
  const pdfjs = await import(
    pathToFileURL(buildRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
  );
  const pagesIn = async (entry) => {
    const data = new Uint8Array(await bytesOf(page, entry));
    const task = pdfjs.getDocument({ data, useSystemFonts: true });
    const count = (await task.promise).numPages;
    await task.destroy();
    return count;
  };
  const BOTH = `Both ${stamp}`;
  log = await flow(`Combine ${stamp}`, [
    ["Get Specified Finder Items", { paths: "Documents/one.pdf\nDocuments/two.pdf" }],
    ["Combine PDF Pages", { name: BOTH }],
  ]);
  const both = await entryNamed(page, `${BOTH}.pdf`);
  step(
    "Combine PDF Pages wrote one PDF of three pages",
    Boolean(both) && (await pagesIn(both)) === 3,
    log.slice(0, 300),
  );
  log = await flow(`Split ${stamp}`, [
    ["Get Specified Finder Items", { paths: "Documents/one.pdf" }],
    ["Split PDF", {}],
  ]);
  const parts = [await entryNamed(page, "one 1.pdf"), await entryNamed(page, "one 2.pdf")];
  step(
    "Split PDF wrote a PDF of one page for each page",
    parts.every(Boolean) && (await pagesIn(parts[0])) === 1 && (await pagesIn(parts[1])) === 1,
    log.slice(0, 300),
  );
  log = await flow(`Extract ${stamp}`, [
    ["Get Specified Finder Items", { paths: "Documents/one.pdf" }],
    ["Extract PDF Text", {}],
  ]);
  const words = await entryNamed(page, "one.txt");
  const wordsText = words ? Buffer.from(await bytesOf(page, words)).toString() : "";
  step(
    "Extract PDF Text saved the words of every page",
    wordsText === "Page one\n\nPage two",
    wordsText,
  );

  /* -------------------------------------------------------------------------------- Safari */
  const ADDRESS = "https://en.wikipedia.org/wiki/Macintosh";
  const tabs = (await api(page, "GET", "/api/safari/tabs")).json;
  await api(page, "PUT", "/api/safari/tabs", { tabs: [ADDRESS], active: 0, rev: tabs.rev ?? 0 });
  log = await flow(`Tab ${stamp}`, [["Get Current Webpage from Safari", {}]]);
  step(
    "Get Current Webpage hands on the tab Safari keeps",
    log.includes(ADDRESS),
    log.slice(0, 300),
  );
  log = await flow(`Refused ${stamp}`, [
    ["Get Specified Text", { text: "https://not-a-listed-site.example/" }],
    ["Get Text from Webpage", {}],
  ]);
  step(
    "Get Text from Webpage fails a site Safari cannot open, and says why",
    log.includes("Get Text from Webpage failed") && log.includes("Workflow failed"),
    log.slice(0, 400),
  );
  log = await flow(`Read ${stamp}`, [
    ["Get Specified Text", { text: "https://en.wikipedia.org/wiki/Zzyzx,_California" }],
    ["Get Text from Webpage", {}],
  ]);
  console.log(`note: Get Text from Webpage on a listed site: ${log.slice(0, 260)}`);
  log = await flow(`Fetch ${stamp}`, [
    ["Get Specified Text", { text: "https://www.gutenberg.org/files/11/11-0.txt" }],
    ["Download URLs", {}],
  ]);
  console.log(`note: Download URLs on a listed site: ${log.slice(0, 260)}`);

  /* ------------------------------------------------------------------------------ versions */
  const KEPT = `Kept ${stamp}`;
  await flow(KEPT, [["Get Specified Text", { text: "first" }]]);
  await add("Change Case of Text");
  await page.getByRole("button", { name: "Save Workflow" }).click();
  await page.waitForFunction(
    async (name) => {
      const reply = await fetch("/api/automator/workflows", { credentials: "same-origin" });
      const { library } = await reply.json();
      return library?.workflows.find((each) => each.name === name)?.steps.length === 2;
    },
    KEPT,
    { timeout: 10_000 },
  );
  const stored = (await api(page, "GET", "/api/automator/workflows")).json.library.workflows.find(
    (each) => each.name === KEPT,
  );
  const versions = async () =>
    (await api(page, "GET", `/api/automator/versions/${stored.id}`)).json.versions;
  const kept = await versions();
  step(
    "the server keeps each save, newest first",
    kept.length === 2 && kept[0].workflow.steps.length === 2 && kept[1].workflow.steps.length === 1,
    String(kept.length),
  );
  async function browse() {
    await bar(page, "File").click();
    await page.waitForTimeout(250);
    await row(page, "Revert To").hover();
    await page.waitForTimeout(300);
    await row(page, /^Browse All Versions/).click();
    return page.getByRole("dialog", { name: `Versions of “${KEPT}”` });
  }
  await reloadDesktop(page);
  await launch(page, "Automator");
  await steps.first().waitFor({ timeout: 20_000 });
  const sheet = await browse();
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("row").nth(1).click();
  await shot(page, path.join(out, "automator-versions.png"));
  await sheet.getByRole("button", { name: "Restore" }).click();
  await sheet.waitFor({ state: "detached" });
  step("Restore puts the older version in the window, after a reload", (await steps.count()) === 1);
  await page.getByRole("button", { name: "Save Workflow" }).click();
  await page.waitForFunction(
    async (id) => {
      const reply = await fetch(`/api/automator/versions/${id}`, { credentials: "same-origin" });
      return (await reply.json()).versions.length === 3;
    },
    stored.id,
    { timeout: 10_000 },
  );
  step(
    "saving the restored version keeps it as the newest",
    (await versions())[0].workflow.steps.length === 1,
  );

  /* ------------------------------------------------------------------------- after a reload */
  await reloadDesktop(page);
  const again = await mail();
  const songsAgain = (await api(page, "GET", "/api/music/library")).json.library;
  const heldAgain = await photos();
  step(
    "Mail, Music and Photos still hold it all after a reload",
    again.some((message) => message.subject === SUBJECT && message.mailbox === "inbox") &&
      songsAgain.playlists.some((each) => each.name === LIST) &&
      heldAgain.albums.some((album) => album.name === ALBUM),
  );
});
