#!/usr/bin/env node
// Automator's actions that now work on real files and TextEdit's tab stops, on the served desktop, as
// a new account. Each result is read back from where it is kept: a PDF from the drive and through
// pdf.js, a font from the drive and Font Book's library, tab stops from a saved RTF file, the print
// frame and after a reload. Exits 0 only when every step passed with no console error, page error or
// failed request.
//
//   node e2e/automator-textedit-batch5-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount, newAccount } from "./r3-census-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("automator-textedit-batch5");
const account = newAccount("batch5", browserName);
const stamp = Date.now().toString(36);
const buildRequire = createRequire(path.join(process.cwd(), "package.json"));
const pdfjs = await import(
  pathToFileURL(buildRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
);
const FONT = readFileSync(
  buildRequire.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"),
);

/** A PDF of one page holding `text`, and a raw RGB picture of a gradient when asked. */
function pdfOf(text, picture = false) {
  const content = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET${picture ? " q 180 0 0 180 10 10 cm /P Do Q" : ""}`;
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

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const row = (page, name) => page.getByRole("menuitem", { name }).first();

/** The page of a PDF as pdf.js reads it: its text and how many of the operators asked for it draws. */
async function pdfFacts(data, password) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    ...(password === undefined ? {} : { password }),
  });
  const document = await task.promise;
  const page = await document.getPage(1);
  const { items } = await page.getTextContent();
  const { fnArray } = await page.getOperatorList();
  const count = (op) => fnArray.filter((each) => each === op).length;
  const facts = {
    pages: document.numPages,
    text: items.map((item) => item.str).join(""),
    strokes: count(pdfjs.OPS.stroke) + count(pdfjs.OPS.constructPath),
    images: count(pdfjs.OPS.paintImageXObject) + count(pdfjs.OPS.paintInlineImageXObject),
  };
  await task.destroy();
  return facts;
}

const automator = async (page) => {
  const actions = page.getByRole("grid", { name: "Actions" });
  const search = page.getByRole("searchbox", { name: "Search" });
  const nameField = page.getByRole("textbox", { name: "Workflow name" });
  const steps = page.locator(".mac-automator-step");
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
  async function fresh(name) {
    await bar(page, "File").click();
    await page.waitForTimeout(250);
    await row(page, /^New/).click();
    const sheet = page.getByRole("dialog", { name: /Choose a type/ });
    await sheet.getByRole("button", { name: "Choose" }).click();
    await sheet.waitFor({ state: "detached" });
    const unsaved = page.getByRole("button", { name: "Don’t Save" });
    if (await unsaved.isVisible().catch(() => false)) await unsaved.click();
    await nameField.fill(name);
  }
  const runNow = () => page.getByRole("button", { name: "Run", exact: true }).click();
  async function ended() {
    const end = page.getByText(/^Workflow (completed|failed)$/).first();
    await end.waitFor({ timeout: 60_000 });
    return (await page.locator(".mac-automator-lower").first().textContent()) ?? "";
  }
  async function flow(name, list) {
    await fresh(name);
    for (const [title, settings] of list) await add(title, settings);
    await runNow();
    return ended();
  }
  return { add, fresh, flow, runNow, ended, steps };
};

await run(async (page) => {
  page.setDefaultTimeout(15_000);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, account);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  await upload(page, "documents", "one.pdf", "application/pdf", pdfOf(`Page ${stamp}`));
  await upload(page, "documents", "big.pdf", "application/pdf", pdfOf("Picture", true));
  await upload(page, "pictures", "red.png", "image/png", await pngOf(page));
  await upload(page, "documents", `Fair${stamp}.ttf`, "font/ttf", FONT.toString("base64"));
  await reloadDesktop(page);
  await launch(page, "Automator");
  const flows = await automator(page);
  const paths = "Get Specified Finder Items";

  /* ---------------------------------------------------------------------------- PDF actions */
  let log = await flows.flow(`Grid ${stamp}`, [
    [paths, { paths: "Documents/one.pdf" }],
    ["Add Grid to PDF Documents", { spacing: "20" }],
  ]);
  const plain = await pdfFacts(await bytesOf(page, await entryNamed(page, "one.pdf")));
  const grid = await entryNamed(page, "one (grid).pdf");
  const gridFacts = grid ? await pdfFacts(await bytesOf(page, grid)) : null;
  step(
    "Add Grid saves a copy on the Desktop whose page draws lines over the same text",
    grid?.parent === "desktop" &&
      gridFacts?.text === `Page ${stamp}` &&
      gridFacts.strokes > plain.strokes + 10,
    `${JSON.stringify({ plain, gridFacts })} ${log.slice(0, 120)}`,
  );

  log = await flows.flow(`Mark ${stamp}`, [
    [paths, { paths: "Documents/one.pdf" }],
    ["Watermark PDF Documents", { picture: "Pictures/red.png", opacity: "40", scale: "500" }],
  ]);
  const marked = await entryNamed(page, "one (watermark).pdf");
  const markFacts = marked ? await pdfFacts(await bytesOf(page, marked)) : null;
  step(
    "Watermark saves a copy that draws the picture over the same text",
    markFacts?.text === `Page ${stamp}` && markFacts.images === 1 && plain.images === 0,
    `${JSON.stringify(markFacts)} ${log.slice(0, 120)}`,
  );

  log = await flows.flow(`Small ${stamp}`, [
    [paths, { paths: "Documents/big.pdf" }],
    ["Compress Images in PDF Documents", { quality: { choose: "Low" } }],
  ]);
  const big = await entryNamed(page, "big.pdf");
  const small = await entryNamed(page, "big (compressed).pdf");
  const smallFacts = small ? await pdfFacts(await bytesOf(page, small)) : null;
  step(
    "Compress Images saves a smaller copy that still has its picture and text",
    small !== undefined &&
      small.size < big.size / 2 &&
      smallFacts?.images === 1 &&
      smallFacts.text === "Picture",
    `${big?.size} to ${small?.size} bytes; ${JSON.stringify(smallFacts)} ${log.slice(0, 120)}`,
  );

  await flows.fresh(`Lock ${stamp}`);
  await flows.add(paths, { paths: "Documents/one.pdf" });
  await flows.add("Encrypt PDF Documents");
  await flows.runNow();
  const password = `pw-${stamp}`;
  for (const asked of [/A password/, /password again/]) {
    const sheet = page.getByRole("dialog", { name: asked });
    await sheet.waitFor();
    const field = sheet.getByRole("textbox", { name: "Your answer" });
    await field.fill(password);
    await sheet.getByRole("button", { name: "OK" }).click();
    await sheet.waitFor({ state: "detached" });
  }
  log = await flows.ended();
  const locked = await entryNamed(page, "one (locked).pdf");
  const lockedBytes = locked ? await bytesOf(page, locked) : [];
  let refused = "";
  await pdfFacts(lockedBytes, "wrong").catch((error) => {
    refused = error.name;
  });
  const lockedFacts = locked ? await pdfFacts(lockedBytes, password) : null;
  step(
    "Encrypt saves a copy that opens with the password alone and holds the same page",
    refused === "PasswordException" && lockedFacts?.text === `Page ${stamp}`,
    `${refused}; ${JSON.stringify(lockedFacts)} ${log.slice(0, 120)}`,
  );
  log = await flows.flow(`Relock ${stamp}`, [
    [paths, { paths: "Desktop/one (locked).pdf" }],
    ["Add Grid to PDF Documents"],
  ]);
  step("A locked PDF fails Add Grid and says why", /is locked/.test(log), log.slice(0, 200));

  /* ---------------------------------------------------------------------------------- Fonts */
  const fontName = `Fair${stamp}.ttf`;
  log = await flows.flow(`Fonts ${stamp}`, [
    [paths, { paths: `Documents/${fontName}` }],
    ["Add to Font Library"],
  ]);
  const drive = (await api(page, "GET", "/api/files/")).json;
  const fontsFolder = drive.entries.find((entry) => entry.name === "Fonts");
  const kept = drive.entries.filter(
    (entry) => entry.name === fontName && entry.parent === fontsFolder?.id,
  );
  step(
    "Add to Font Library keeps the font where Font Book reads it",
    fontsFolder?.parent === "documents" && kept.length === 1,
    `${kept.length} in Documents/Fonts; ${log.slice(0, 120)}`,
  );
  const fontId = `fair${stamp}`;
  const held = (await api(page, "GET", "/api/font-book/library")).json;
  await api(page, "PUT", "/api/font-book/library", {
    collections: held.collections ?? [],
    disabled: [fontId],
    rev: held.rev,
    ...(held.session ? { session: held.session } : {}),
  });
  log = await flows.flow(`Activate ${stamp}`, [
    [paths, { paths: `Documents/Fonts/${fontName}` }],
    ["Activate Fonts"],
  ]);
  const after = (await api(page, "GET", "/api/font-book/library")).json;
  step(
    "Activate Fonts takes the font off Font Book's turned-off list on the server",
    Array.isArray(after.disabled) && !after.disabled.includes(fontId) && after.rev > held.rev,
    `${JSON.stringify(after.disabled)} rev ${after.rev}; ${log.slice(0, 120)}`,
  );
  log = await flows.flow(`Not ${stamp}`, [
    [paths, { paths: "Documents/one.pdf" }],
    ["Add to Font Library"],
  ]);
  step(
    "A file that is not a font fails the step and says so",
    /not a font file/.test(log),
    log.slice(0, 200),
  );

  /* -------------------------------------------------------------------------- Media Browser */
  await flows.fresh(`Ask ${stamp}`);
  await flows.add("Ask for Photos", { show: { choose: "Media List" } });
  await flows.runNow();
  const list = page.getByRole("dialog", { name: "Choose from your drive" });
  await list.getByText("Pictures/red.png", { exact: true }).click();
  await list.getByRole("button", { name: "OK" }).click();
  log = await flows.ended();
  step(
    "Ask for Photos can show the list, and hands on what was chosen",
    /Ask for Photos completed, 1 item: Pictures\/red\.png/.test(log),
    log.slice(0, 120),
  );
  await flows.fresh(`Media ${stamp}`);
  await bar(page, "View").click();
  await page.waitForTimeout(250);
  await row(page, /^Media Browser/).click();
  const media = page.getByRole("dialog", { name: "Media Browser" });
  await media.waitFor();
  await media
    .getByRole("radio", { name: "Photos" })
    .or(media.getByRole("button", { name: "Photos" }))
    .first()
    .click();
  const redRow = media.getByText("Pictures/red.png", { exact: true });
  await redRow.waitFor({ timeout: 10_000 });
  step("The Media Browser lists a picture on the drive by its path", await redRow.isVisible());
  await shot(page, path.join(out, "automator-media-browser.png"));
  await redRow.click();
  await media.getByRole("button", { name: "Add to Workflow" }).click();
  await media.waitFor({ state: "detached" });
  const added = await flows.steps.last().getByLabel("paths", { exact: true }).inputValue();
  step(
    "Add to Workflow makes a step that holds the picture's path",
    added === "Pictures/red.png",
    added,
  );
  await flows.runNow();
  log = await flows.ended();
  step("That step runs on the real file", /Workflow completed/.test(log), log.slice(0, 120));

  /* ---------------------------------------------------------------- A workflow as a file */
  const fileName = `Media ${stamp}.workflow`;
  await bar(page, "File").click();
  await page.waitForTimeout(250);
  await row(page, /^Export/).click();
  const saveSheet = page.getByRole("dialog", { name: "Export" });
  await saveSheet.waitFor();
  await saveSheet.getByRole("button", { name: "Save" }).click();
  await saveSheet.waitFor({ state: "detached" });
  await page.getByText(`Exported “${fileName}”`).first().waitFor();
  const exported = await entryNamed(page, fileName);
  const fileText = Buffer.from(await bytesOf(page, exported)).toString();
  step(
    "File > Export puts the workflow on the drive as a .workflow file",
    exported?.parent === "documents" && JSON.parse(fileText).steps.length === 1,
    fileText.slice(0, 120),
  );
  await flows.fresh(`Other ${stamp}`);
  await reloadDesktop(page);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor();
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  await finder.getByRole("option", { name: fileName, exact: true }).first().dblclick();
  // The window still holds the unsaved workflow from before the reload, so it asks first.
  await page.getByRole("button", { name: "Don’t Save" }).click();
  await page.getByText(`Opened “Media ${stamp}” from your drive`).first().waitFor();
  const opened = await page
    .locator(".mac-automator-step")
    .first()
    .getByLabel("paths", { exact: true })
    .inputValue();
  step(
    "Finder opens the .workflow file in Automator with its steps",
    opened === "Pictures/red.png",
    opened,
  );

  /* ------------------------------------------------------------------------ TextEdit's stops */
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await text.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type("Plain line");
  await page.keyboard.press("Enter");
  await page.keyboard.type("L\tM\tC\tR\t3.25");

  const ruler = window.getByRole("group", { name: "Ruler" });
  const tabs = window.getByRole("slider", { name: /tab stop/ });
  const count = await tabs.count();
  for (let at = 0; at < count; at += 1) {
    const box = await tabs.first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 80, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
  step("Dragging a stop off the ruler removes it", (await tabs.count()) === 0, `${count} to 0`);

  const rulerBox = await ruler.boundingBox();
  const originX = rulerBox.x + 5;
  const clickAt = (points, options) =>
    page.mouse.click(originX + points, rulerBox.y + rulerBox.height - 6, options);
  await clickAt(90);
  await page.waitForTimeout(150);
  step(
    "A click on the ruler adds a left stop there",
    (await window.getByRole("slider", { name: "left tab stop" }).count()) === 1,
  );
  const kindAt = async (points, kind) => {
    await clickAt(points, { button: "right" });
    await page.getByRole("menuitem", { name: kind, exact: true }).click();
    await page.waitForTimeout(150);
  };
  await kindAt(216, "Center Tab");
  await kindAt(324, "Right Tab");
  await kindAt(405, "Decimal Tab");

  /** Where each letter or number after a tab stands, from the ruler's origin. */
  const placed = (where) =>
    where.evaluate(
      (node, wanted) => {
        const out = {};
        const zero = (
          node.querySelector("div[data-tabs]") ?? node.lastElementChild
        ).getBoundingClientRect().left;
        const walker = node.ownerDocument.createTreeWalker(node, 4);
        while (walker.nextNode()) {
          const holder = walker.currentNode;
          for (const [name, part] of Object.entries(wanted)) {
            const at = holder.data.indexOf(part);
            if (at < 0) continue;
            const range = node.ownerDocument.createRange();
            range.setStart(holder, at);
            range.setEnd(holder, at + part.length);
            const box = range.getBoundingClientRect();
            out[name] = [box.left - zero, box.right - zero];
          }
        }
        return out;
      },
      { left: "M", center: "C", right: "R", whole: "3", point: "." },
    );
  const checked = (seen) => ({
    left: Math.abs(seen.left[0] - 90) < 1.5,
    center: Math.abs((seen.center[0] + seen.center[1]) / 2 - 216) < 1.5,
    right: Math.abs(seen.right[1] - 324) < 1.5,
    decimal: Math.abs(seen.point[0] - 405) < 1.5,
  });
  let seen = await placed(text);
  let ok = checked(seen);
  step("The left stop starts its text there", ok.left, JSON.stringify(seen.left));
  step("The centre stop centres its text", ok.center, JSON.stringify(seen.center));
  step("The right stop ends its text there", ok.right, JSON.stringify(seen.right));
  step("The decimal stop lines up the point", ok.decimal, JSON.stringify(seen.point));
  await shot(page, path.join(out, "textedit-tab-stops.png"));

  const plainTabs = await text.evaluate(
    (node) => node.firstElementChild.dataset.tabs === undefined && node.children.length >= 2,
  );
  step("The stops are the second paragraph's alone", plainTabs);

  await page.keyboard.press("End");
  await page.keyboard.type("5");
  await page.waitForTimeout(100);
  seen = await placed(text);
  step(
    "Typing after the decimal stop keeps the point in place",
    checked(seen).decimal,
    JSON.stringify(seen.point),
  );
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(100);
  seen = await placed(text);
  step(
    "Undo takes the typing back, and the stops hold",
    !(await text.innerText()).includes("3.255") && checked(seen).decimal,
    (await text.innerText()).slice(-20),
  );

  const printed = page.evaluate(
    () =>
      new Promise((resolve) => {
        const real = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
        Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
          configurable: true,
          get() {
            const view = real.get.call(this);
            if (view && this.hasAttribute("data-textedit-print")) {
              view.print = () => {
                // The print frame stands at no width until the browser lays it out on paper.
                this.style.width = "800px";
                const frame = this.contentDocument;
                const line = frame.querySelector("[data-tabs]");
                const zero = line.getBoundingClientRect().left;
                const walker = frame.createTreeWalker(line, 4);
                const out = {};
                while (walker.nextNode()) {
                  const holder = walker.currentNode;
                  for (const [name, part] of [
                    ["right", "R"],
                    ["point", "."],
                  ]) {
                    const at = holder.data.indexOf(part);
                    if (at < 0) continue;
                    const range = frame.createRange();
                    range.setStart(holder, at);
                    range.setEnd(holder, at + 1);
                    const box = range.getBoundingClientRect();
                    out[name] = [box.left - zero, box.right - zero];
                  }
                }
                resolve(out);
              };
            }
            return view;
          },
        });
      }),
  );
  await bar(page, "File").click();
  await page.waitForTimeout(300);
  await page
    .getByRole("menuitem", { name: /^Print/ })
    .last()
    .click();
  const printSheet = page.getByRole("dialog", { name: /print/i });
  await printSheet.waitFor();
  await printSheet.getByRole("button", { name: "Print", exact: true }).click();
  const frame = await printed;
  step(
    "The print frame keeps the right and decimal stops",
    Math.abs(frame.right[1] - 324) < 1.5 && Math.abs(frame.point[0] - 405) < 1.5,
    JSON.stringify(frame),
  );

  const rtfName = `Stops ${stamp}.rtf`;
  await bar(page, "File").click();
  await page.waitForTimeout(300);
  await page
    .getByRole("menuitem", { name: "Save…", exact: true })
    .or(page.getByRole("menuitem", { name: "Save", exact: true }))
    .first()
    .click();
  const save = page.getByRole("dialog", { name: "Save" });
  await save.waitFor();
  await save.getByRole("textbox").first().fill(`Stops ${stamp}`);
  await save.getByRole("button", { name: "Save", exact: true }).click();
  await save.waitFor({ state: "detached" });
  await page.waitForTimeout(800);
  const rtfEntry = await entryNamed(page, rtfName);
  const rtf = Buffer.from(await bytesOf(page, rtfEntry)).toString("latin1");
  step(
    "The saved RTF holds each stop with its kind",
    /\\tx1800\\tqc\\tx4320\\tqr\\tx6480\\tqdec\\tx8100/.test(rtf),
    /\\pard[^\n]*\\tqdec[^\n]*/.exec(rtf)?.[0]?.slice(0, 100),
  );

  await reloadDesktop(page);
  await launch(page, "TextEdit");
  const again = page.locator('[data-window-id^="textedit"]').first();
  const textAgain = again.getByRole("textbox", { name: "Document" });
  await textAgain.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_000);
  const reloaded = await textAgain.evaluate((node) => node.innerText);
  seen = await placed(textAgain);
  ok = reloaded.includes("3.25") ? checked(seen) : {};
  step(
    "After a reload the stops still place the text",
    ok.center === true && ok.right === true && ok.decimal === true,
    JSON.stringify(seen),
  );
});
