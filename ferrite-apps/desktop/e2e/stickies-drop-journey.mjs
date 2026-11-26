#!/usr/bin/env node
// Text into Stickies from outside it, with real mouse input: Services > Make New Sticky Note makes a
// note of the selection, a text file dropped from Finder goes into the note, and a picture or a file
// longer than a note is refused with the note unchanged.
// Exits 0 only when every step passed with no console error, page error or failed request.
//
//   node e2e/stickies-drop-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out } = options();
const { step, run } = journey("stickies-drop");
const tag = Date.now().toString(36);
const TEXT = `Sticky drop ${tag}.txt`;
const LONG = `Sticky long ${tag}.txt`;
const PICTURE = `Sticky drop ${tag}.png`;
const LINE = `dropped line ${tag}`;
const SHARED = `shared${tag}`;

async function centre(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag from or to is not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "documents", name: TEXT, type: "text/plain", text: LINE });
  await uploadFile(page, {
    parent: "documents",
    name: LONG,
    type: "text/plain",
    text: "x".repeat(20_500),
  });
  await uploadFile(page, {
    parent: "documents",
    name: PICTURE,
    type: "image/png",
    bytes: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
      "base64",
    ),
  });

  await launch(page, "Stickies");
  await page.locator('[data-window-id^="stickies"]').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  const bar = page.getByRole("menubar");
  const stored = async () => (await api(page, "GET", "/api/stickies/data")).json?.data?.notes ?? [];
  const keptSoon = async (test) => {
    for (let tries = 0; tries < 12; tries += 1) {
      if ((await stored()).some(test)) return true;
      await page.waitForTimeout(500);
    }
    return false;
  };

  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(200);
  await page
    .getByRole("menuitem", { name: /^New Note/ })
    .last()
    .click();
  await page.waitForTimeout(400);
  await page.keyboard.type(`Target ${tag} ${SHARED}`);
  const target = page.locator(".mac-stickies-note-text", { hasText: `Target ${tag}` });
  await page.waitForTimeout(300);

  await target.evaluate((field, word) => {
    const node = [...field.querySelectorAll("*"), field]
      .flatMap((each) => [...each.childNodes])
      .find((each) => each.nodeType === 3 && each.data.includes(word));
    const at = node.data.indexOf(word);
    document.getSelection().setBaseAndExtent(node, at, node, at + word.length);
  }, SHARED);
  await bar.getByRole("menuitem", { name: "Stickies", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("menuitem", { name: "Services" }).hover();
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "stickies-services.png"));
  await page.getByRole("menuitem", { name: "Make New Sticky Note" }).click();
  step(
    "Make New Sticky Note makes a note of the selection, and it is stored",
    await keptSoon((note) => note.text === SHARED),
  );
  const made = page
    .locator(".mac-stickies-note-text", { hasText: SHARED, hasNotText: `Target ${tag}` })
    .last();
  step("the new note is shown", (await made.innerText()).trim() === SHARED);

  // The new note is in front: the drops land on it.
  const dropAt = await centre(made);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = (name) => finder.getByRole("option", { name, exact: true }).first();
  await file(TEXT).waitFor({ timeout: 10_000 });
  const before = await finder.boundingBox();
  await page.mouse.move(before.x + 300, before.y + 10);
  await page.mouse.down();
  await page.mouse.move(before.x + 300 + (900 - before.x), before.y + 10, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const drag = async (name) => {
    const from = await centre(file(name));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y + 10, { steps: 4 });
    await page.mouse.move(dropAt.x, dropAt.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  const raiseFinder = async () => {
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "Finder" })
      .click();
    await page.waitForTimeout(200);
  };

  await drag(TEXT);
  await page.waitForTimeout(600);
  await shot(page, path.join(out, "stickies-dropped.png"));
  step(
    "a text file dropped on a note goes on a line of its own at its end",
    /shared\w+\s+dropped line/.test(await made.innerText()),
    await made.innerText(),
  );
  step(
    "and it is stored",
    await keptSoon((note) => note.text.includes(SHARED) && note.text.includes(LINE)),
  );

  await raiseFinder();
  const notes = (await stored()).length;
  await drag(PICTURE);
  await made
    .locator("img")
    .first()
    .waitFor({ timeout: 8_000 })
    .catch(() => {});
  step(
    "a picture goes in the note, and no other note is made",
    (await made.locator("img").count()) > 0 && (await stored()).length === notes,
  );

  await raiseFinder();
  const held = await made.innerText();
  await drag(LONG);
  const alert = page.getByRole("alertdialog");
  await alert.getByText("is longer than this note can hold").waitFor();
  await shot(page, path.join(out, "stickies-drop-too-long.png"));
  step("a file longer than the note is refused, saying so", true);
  await alert.getByRole("button", { name: "OK" }).click();
  step("and the note is as it was", (await made.innerText()) === held);

  await page.waitForTimeout(900);
  await reloadDesktop(page);
  await page.locator(".mac-stickies-note-text").first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  step(
    "the dropped text is there after a reload",
    (await page.locator(".mac-stickies-note-text", { hasText: LINE }).count()) === 1,
  );
});
