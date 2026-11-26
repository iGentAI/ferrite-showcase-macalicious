import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("notes-files");
const tag = Date.now().toString(36);
const PDF = `report ${tag}.pdf`;
const PNG = `large ${tag}.png`;
const TITLE = `Files ${tag}`;

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes", exact: true });
  const list = notes.getByRole("listbox", { name: "Notes" });
  await list.waitFor({ timeout: 10_000 });
  await notes.getByRole("button", { name: "New Note" }).click();
  await page.keyboard.type(
    `${TITLE}\nSee https://example.com/page and https://maps.apple.com/?q=Cupertino\n`,
  );
  const editor = notes.locator('[aria-label="Note"]:visible');

  const large = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 700;
    canvas.height = 500;
    const context = canvas.getContext("2d");
    const pixels = context.createImageData(700, 500);
    for (let i = 0; i < pixels.data.length; i++) {
      pixels.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const picture = Buffer.from(large, "base64");
  step(`the picture is over the saved limit (${picture.length} bytes)`, picture.length > 96_000);
  await page.getByLabel("Choose a file").setInputFiles([
    { name: PDF, mimeType: "application/pdf", buffer: Buffer.alloc(300 * 1024, 65) },
    { name: PNG, mimeType: "image/png", buffer: picture },
  ]);
  await editor.getByText(PDF).first().waitFor({ timeout: 20_000 });
  await editor.locator(`img[alt="${PNG}"]`).waitFor({ timeout: 20_000 });
  step("a PDF stands in the note with its name", await editor.getByText(PDF).first().isVisible());
  await page.waitForTimeout(1500);
  await shot(page, path.join(out, "note-files.png"));

  await reloadDesktop(page);
  await launch(page, "Notes");
  await list.waitFor({ timeout: 10_000 });
  const again = notes.locator('[aria-label="Note"]:visible');
  await again.getByText(PDF).first().waitFor({ timeout: 20_000 });
  step("the PDF comes back after a reload", await again.getByText(PDF).first().isVisible());
  const image = again.locator(`img[alt="${PNG}"]`);
  await page.waitForFunction(
    (alt) => (document.querySelector(`img[alt="${alt}"]`)?.naturalWidth ?? 0) === 700,
    PNG,
    { timeout: 20_000 },
  );
  step("the large picture's bytes come back after a reload", (await image.count()) === 1);
  const thumb = list.getByRole("option").first().locator("img");
  step("the list shows the picture's thumbnail", (await thumb.count()) === 1);
  await shot(page, path.join(out, "note-files-after-reload.png"));

  await notes.getByRole("button", { name: "Attachments Browser" }).click();
  const kinds = notes.getByRole("group", { name: "Kind of attachment" });
  await kinds.waitFor({ timeout: 5_000 });
  const photo = notes
    .getByRole("listbox", { name: "Photos & Videos" })
    .getByRole("option", { name: new RegExp(PNG) });
  await photo.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(800);
  await shot(page, path.join(out, "browser-photos.png"));
  step("the browser lists the picture", await photo.isVisible());
  await kinds.getByRole("button", { name: "Maps" }).click();
  step(
    "Maps lists the map address",
    await notes
      .getByRole("listbox", { name: "Maps" })
      .getByRole("option", { name: /maps\.apple\.com/ })
      .isVisible(),
  );
  await kinds.getByRole("button", { name: "Scans" }).click();
  step("Scans says why it is empty", await notes.getByText("can’t reach an iPhone").isVisible());
  await shot(page, path.join(out, "browser-scans.png"));
  await kinds.getByRole("button", { name: "Documents" }).click();
  await notes
    .getByRole("listbox", { name: "Documents" })
    .getByRole("option", { name: new RegExp(PDF) })
    .dblclick();
  await list.waitFor({ timeout: 5_000 });
  step("a double click shows the note", (await again.innerText()).includes(TITLE));

  // Services in the text's context menu.
  await again
    .getByText(TITLE)
    .first()
    .dblclick({ position: { x: 12, y: 8 } });
  console.log("selected before", await page.evaluate(() => document.getSelection()?.toString()));
  await again
    .getByText(TITLE)
    .first()
    .click({ button: "right", position: { x: 12, y: 8 } });
  console.log("selected after", await page.evaluate(() => document.getSelection()?.toString()));
  await page.getByRole("menuitem", { name: "Services", exact: true }).hover();
  await page.waitForTimeout(600);
  await shot(page, path.join(out, "text-services-open.png"));
  console.log(await page.getByRole("menu").allInnerTexts());
  await page.getByRole("menuitem", { name: "New Note With Selection" }).waitFor({ timeout: 5_000 });
  step("Services offers a new note with the selection", true);
  await shot(page, path.join(out, "text-services.png"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Accounts and Close All Locked Notes in the application menu.
  await page.getByRole("menubar").getByRole("menuitem", { name: "Notes", exact: true }).click();
  const accounts = page.getByRole("menuitem", { name: "Accounts…" });
  await accounts.waitFor({ timeout: 5_000 });
  step(
    "Accounts is dimmed with its reason",
    (await accounts.getAttribute("aria-disabled")) === "true" &&
      !!(await accounts.getAttribute("data-reason")),
  );
  await shot(page, path.join(out, "app-menu.png"));
  await page.keyboard.press("Escape");

  // The note's own window.
  const row = list.getByRole("option").filter({ hasText: TITLE });
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open in New Window" }).click();
  const own = page.getByRole("region", { name: TITLE, exact: true });
  await own.waitFor({ timeout: 5_000 });
  const ownText = own.locator('[aria-label="Note"]');
  await ownText.getByText(TITLE).first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");
  await page.waitForTimeout(500);
  step(
    "typing in the note's own window reaches the note list",
    (
      await row
        .first()
        .innerText()
        .catch(() => "")
    ).length >= 0 &&
      (await list
        .getByRole("option")
        .filter({ hasText: `${TITLE} edited` })
        .count()) === 1,
  );
  await shot(page, path.join(out, "note-window.png"));
  await page
    .getByRole("region", { name: `${TITLE} edited`, exact: true })
    .getByRole("button", { name: /close/i })
    .first()
    .click();

  // The gallery's Pinned group.
  await page.waitForTimeout(300);
  const pin = list.getByRole("option").filter({ hasText: TITLE });
  await pin.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Pin Note" }).click();
  await notes.getByRole("button", { name: "Gallery View" }).click();
  const pinned = notes.getByRole("listbox", { name: "Pinned" });
  await pinned.waitFor({ timeout: 5_000 });
  step("the gallery groups the pinned note", (await pinned.getByRole("option").count()) === 1);
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "gallery-pinned.png"));
  await notes.getByRole("button", { name: "List View" }).click();
});
