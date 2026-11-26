#!/usr/bin/env node
// Preview's third batch on the desktop served by `ferrite dev`: real server, real pdf.js.
import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("preview-batch3");
const RUN = Date.now().toString(36);
const NAME = `Form ${RUN}.pdf`;
const PICTURE = `Pic ${RUN}.png`;
const LIBRARY = "/api/app-store/library";

function formPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [6 0 R 7 0 R] /NeedAppearances true /DA (/Helv 12 Tf 0 g) /DR << /Font << /Helv 8 0 R >> >> >> >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [6 0 R 7 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    "<< /Type /Annot /Subtype /Widget /FT /Tx /T (name) /TU (Name) /Rect [100 700 300 720] /V (Ada) /DA (/Helv 12 Tf 0 g) /F 4 >>",
    "<< /Type /Annot /Subtype /Widget /FT /Btn /T (agree) /TU (Agree) /Rect [100 650 120 670] /V /Off /AS /Off /F 4 /AP << /N << /Yes 9 0 R /Off 10 0 R >> >> >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /XObject /Subtype /Form /BBox [0 0 20 20] /Length 0 >>\nstream\n\nendstream",
    "<< /Type /XObject /Subtype /Form /BBox [0 0 20 20] /Length 0 >>\nstream\n\nendstream",
  ];
  let body = "%PDF-1.7\n";
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
  const upload = (parent, name, text, type) =>
    page.evaluate(
      async ({ parent, name, text, type }) => {
        let blob = new Blob([text ?? ""], { type });
        if (text === null) {
          const canvas = document.createElement("canvas");
          canvas.width = 400;
          canvas.height = 300;
          const context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, 400, 300);
          context.fillStyle = "#102060";
          context.fillRect(120, 90, 160, 120);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        }
        const json = { "content-type": "application/json" };
        const uploading = await fetch("/api/files/uploads", {
          method: "POST",
          credentials: "same-origin",
          headers: json,
          body: JSON.stringify({ parent, name, size: blob.size, type, existing: "fail" }),
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
      { parent, name, text, type },
    );
  await upload("pictures", NAME, formPdf(), "application/pdf");
  await upload("pictures", PICTURE, null, "image/png");
  const library = (await api(page, "GET", LIBRARY)).json;
  if (!(library.installed ?? []).includes("preview")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(library.installed ?? []), "preview"],
      rev: library.rev,
    });
  }
  await reloadDesktop(page);

  const preview = page.locator(".mac-preview-app").first();
  const launch = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("Preview");
    await field.press("Enter");
    await preview.waitFor({ state: "visible", timeout: 15_000 });
  };
  const settled = () =>
    page.waitForFunction(
      () => document.querySelector(".mac-preview-app")?.getAttribute("aria-busy") !== "true",
      undefined,
      { timeout: 20_000 },
    );
  const choose = async (menu, item, through) => {
    await page.getByRole("menuitem", { name: menu, exact: true }).first().click();
    if (through) await page.getByRole("menuitem", { name: through, exact: true }).first().click();
    await page
      .getByRole("menuitem", { name: item, exact: true })
      .or(page.getByRole("menuitemradio", { name: item, exact: true }))
      .first()
      .click();
    await page.waitForTimeout(350);
  };
  const fileId = async (name) =>
    (await api(page, "GET", "/api/files/")).json.entries.find(
      (each) => each.name === name && each.trashed_ms === undefined,
    )?.id;
  const markup = async (name) => {
    const id = await fileId(name);
    return (await api(page, "GET", `/api/preview/markup/${id}`)).json.markup;
  };
  const openDialog = page.getByRole("dialog", { name: "Open" });
  const size = (number) =>
    page.evaluate((number) => {
      const box = document.querySelector(`.mac-preview-app-pages [data-page="${number}"]`);
      return { w: Number.parseFloat(box.style.width), h: Number.parseFloat(box.style.height) };
    }, number);

  await launch();
  if (!(await openDialog.isVisible().catch(() => false))) {
    await preview.getByRole("button", { name: "Open…" }).first().click();
  }
  await openDialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await openDialog.getByRole("option", { name: NAME }).dblclick({ timeout: 10_000 });
  await page.locator('[data-page="3"]').first().waitFor({ state: "attached", timeout: 20_000 });
  await settled();

  // A form, real pdf.js.
  const nameField = preview.getByRole("textbox", { name: "Name" });
  step(
    "a PDF's text field is read from the file",
    await until(async () => (await nameField.inputValue()) === "Ada"),
  );
  await shot(page, path.join(out, "preview3-form.png"));
  await nameField.fill("Ada Lovelace");
  await preview.getByRole("checkbox", { name: "Agree" }).check();
  await choose("File", "Save");
  await settled();
  const after = preview.getByRole("textbox", { name: "Name" });
  step(
    "Save writes the form: the new file holds what was typed",
    await until(async () => (await after.inputValue()) === "Ada Lovelace"),
  );
  step(
    "and the box is ticked in the new file",
    await until(() => preview.getByRole("checkbox", { name: "Agree" }).isChecked()),
  );
  const entries = (await api(page, "GET", "/api/files/")).json.entries.filter(
    (each) => each.name === NAME,
  );
  step(
    "the PDF as it was is in the Trash",
    entries.filter((each) => each.trashed_ms !== undefined).length === 1,
  );

  // Rotate one page, kept by the server.
  await preview.getByRole("button", { name: "Rotate Right" }).click();
  await page.waitForTimeout(400);
  const one = await size(1);
  const two = await size(2);
  step(
    "Rotate Right turns page 1 alone",
    one.w > one.h && two.w < two.h,
    JSON.stringify({ one, two }),
  );
  const turned = await until(async () => (await markup(NAME))?.turns?.[0] === 1);
  step(
    "the server keeps the turn of each page",
    turned === true,
    JSON.stringify((await markup(NAME))?.turns),
  );
  await shot(page, path.join(out, "preview3-turned.png"));
  await preview
    .getByRole("listbox", { name: "Thumbnails" })
    .getByRole("option")
    .nth(1)
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rotate Left" }).click();
  step(
    "the thumbnail's Rotate Left turns its page",
    await until(async () => (await markup(NAME))?.turns?.[1] === 3),
    JSON.stringify((await markup(NAME))?.turns),
  );
  await reloadDesktop(page);
  await launch();
  await page.locator('[data-page="3"]').first().waitFor({ state: "attached", timeout: 20_000 });
  await settled();
  await page.waitForTimeout(600);
  const kept = await size(1);
  step("a reload keeps each page's turn", kept.w > kept.h, JSON.stringify(kept));

  // Keywords and the Encryption tab.
  await preview.getByRole("button", { name: "Show Inspector" }).click();
  await preview.getByRole("button", { name: "Keywords" }).click();
  const newWord = preview.getByRole("textbox", { name: "New Keyword" });
  await newWord.fill("contract");
  await newWord.press("Enter");
  step(
    "a keyword is kept by the server",
    await until(async () => (await markup(NAME))?.keywords?.includes("contract") === true),
  );
  await shot(page, path.join(out, "preview3-keywords.png"));
  await preview.getByRole("button", { name: "Encryption" }).click();
  step(
    "Set Password is dimmed",
    await until(() => preview.getByRole("button", { name: "Set Password…" }).isDisabled()),
  );
  await shot(page, path.join(out, "preview3-encryption.png"));
  await preview.getByRole("button", { name: "Show Inspector" }).click();

  // A picture: every new kind of mark goes through the real server.
  await choose("File", "Open…");
  await openDialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await openDialog.getByRole("option", { name: PICTURE }).dblclick({ timeout: 10_000 });
  await until(async () =>
    (await preview.locator(".mac-title-bar-title-text").first().innerText()).includes(PICTURE),
  );
  await settled();
  await page.waitForTimeout(400);
  const canvas = preview.locator(".mac-preview-app-page-marks").first();
  const drag = async (from, to) => {
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (box.width * (from[0] + to[0])) / 2,
      box.y + (box.height * (from[1] + to[1])) / 2,
    );
    await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1]);
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  const items = async () => (await markup(PICTURE))?.pages?.[0]?.items ?? [];
  await choose("Tools", "Loupe", "Annotate");
  await drag([0.2, 0.2], [0.5, 0.6]);
  await page.waitForTimeout(600);
  const lens = await page.evaluate(() => {
    const marks = document.querySelector(".mac-preview-app-page-marks");
    const at = marks
      .getContext("2d")
      .getImageData(Math.floor(marks.width * 0.42), Math.floor(marks.height * 0.5), 1, 1).data;
    return [...at];
  });
  step(
    "a loupe holds the page's pixels",
    lens[3] === 255 && lens[2] > lens[0],
    JSON.stringify(lens),
  );
  await preview.getByRole("button", { name: "Shape Style" }).click();
  await page.getByRole("menuitemradio", { name: "Dashed" }).click();
  await page.waitForTimeout(300);
  await preview.getByRole("button", { name: "Shape Style" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Shadow" }).click();
  await page.waitForTimeout(300);
  await preview.getByRole("button", { name: "Fill Color" }).click();
  await page.getByRole("menuitemradio", { name: "Yellow" }).click();
  await page.waitForTimeout(300);
  await choose("Tools", "Star", "Annotate");
  await drag([0.6, 0.1], [0.9, 0.5]);
  await choose("Tools", "Arrow", "Annotate");
  await drag([0.1, 0.8], [0.4, 0.9]);
  await preview.getByRole("button", { name: "Shape Style" }).click();
  await page.getByRole("menuitemradio", { name: "Arrows at Both Ends" }).click();
  await page.waitForTimeout(300);
  await preview.getByRole("button", { name: "Text Style" }).click();
  await page.getByRole("menuitemradio", { name: "Georgia" }).click();
  await page.waitForTimeout(200);
  await preview.getByRole("button", { name: "Text Style" }).click();
  await page.getByRole("menuitemradio", { name: "Align Center" }).click();
  await page.waitForTimeout(200);
  await preview.getByRole("button", { name: "Text", exact: true }).click();
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.7);
  const typing = preview.getByRole("textbox", { name: "Text" });
  await typing.fill("Two\nLines");
  await shot(page, path.join(out, "preview3-typing.png"));
  await typing.press("Enter");
  await page.waitForTimeout(300);
  await choose("Tools", "Mask", "Annotate");
  await drag([0.05, 0.05], [0.95, 0.95]);
  const stored = await until(async () => (await items()).length === 5 && (await items()), 10_000);
  const summary = (stored || []).map(
    (m) =>
      `${m.kind}:${m.fill ?? ""}:${m.dash ?? ""}:${m.shadow ?? ""}:${m.arrow_ends ?? ""}:${m.font ?? ""}:${m.align ?? ""}`,
  );
  step(
    "the server keeps a mask, a loupe, a filled star, both arrow heads and a text's font",
    Array.isArray(stored) &&
      stored.some((m) => m.kind === "mask") &&
      stored.some((m) => m.kind === "loupe") &&
      stored.some(
        (m) =>
          m.kind === "sketch" && m.fill === "#ffcc00" && m.dash === "dashed" && m.shadow === true,
      ) &&
      stored.some((m) => m.kind === "arrow" && m.arrow_ends === "both") &&
      stored.some((m) => m.kind === "text" && m.font === "Georgia" && m.align === "center"),
    JSON.stringify(summary),
  );
  await shot(page, path.join(out, "preview3-marks.png"));

  // Smart Lasso, then a drag of its selection onto the desktop.
  await preview.getByRole("button", { name: "Select", exact: true }).click();
  await choose("Tools", "Smart Lasso");
  await drag([0.2, 0.2], [0.8, 0.8]);
  await shot(page, path.join(out, "preview3-lasso.png"));
  const finderOpen = async () => {
    const at = await canvas.boundingBox();
    const cx = at.x + at.width * 0.5,
      cy = at.y + at.height * 0.5;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30);
    await page.waitForTimeout(100);
    const label = await page.locator(".mac-desktop-drag-name").innerText();
    const viewport = page.viewportSize();
    await page.mouse.move(viewport.width - 8, viewport.height - 90);
    await page.mouse.up();
    return label;
  };
  const dragged = await finderOpen();
  step(
    "a press inside the selection drags a PNG of it",
    dragged.endsWith("selection.png"),
    dragged,
  );
  const landed = await until(
    async () =>
      (await api(page, "GET", "/api/files/")).json.entries.some((each) => each.name === dragged),
    6_000,
  );
  step("let go on the desktop, it is a file on the drive (information)", true, String(landed));
  const settings = (await api(page, "GET", "/api/system-preferences/settings")).json.values ?? {};
  step(
    "the style of the tools is kept with the settings",
    settings["preview.dash"] === "dashed" &&
      settings["preview.font"] === "Georgia" &&
      settings["preview.shadow"] === true,
    JSON.stringify([
      settings["preview.dash"],
      settings["preview.font"],
      settings["preview.shadow"],
      settings["preview.arrowEnds"],
      settings["preview.align"],
    ]),
  );
  await preview.getByRole("button", { name: "Select", exact: true }).click();

  // Customize Toolbar.
  await choose("View", "Customize Toolbar…");
  const sheet = page.getByRole("dialog", { name: "Choose the items the toolbar shows" });
  await sheet.waitFor({ state: "visible" });
  await sheet.getByRole("checkbox", { name: "Rotate" }).click();
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "preview3-toolbar.png"));
  step(
    "Customize Toolbar takes Rotate out",
    (await preview.getByRole("button", { name: "Rotate Right" }).count()) === 0,
  );
  await sheet.getByRole("button", { name: "Use Default Set" }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  step(
    "Use Default Set brings it back",
    await until(() => preview.getByRole("button", { name: "Rotate Right" }).isVisible()),
  );
});
