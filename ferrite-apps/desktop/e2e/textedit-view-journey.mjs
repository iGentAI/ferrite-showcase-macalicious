#!/usr/bin/env node
// TextEdit's view of a document on the desktop: View > Zoom In, Zoom Out and Actual Size, Format >
// Wrap to Page and Format > Text > Hide Ruler, each from the menu bar, and all of them after a reload.
//
//   node e2e/textedit-view-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-view");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  const bar = page.getByRole("menubar");
  const choose = async (menu, ...items) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    for (const item of items) {
      const row = page.getByRole("menuitem", { name: new RegExp(`^${item}`) }).last();
      await page.waitForTimeout(300);
      await row.click();
    }
    await page.waitForTimeout(250);
  };
  const zoom = () => text.evaluate((element) => getComputedStyle(element).zoom);
  const ruler = window.getByRole("group", { name: "Ruler" }).or(window.getByLabel("Ruler"));
  const width = () => text.evaluate((element) => element.getBoundingClientRect().width);

  step("a document starts at its actual size", (await zoom()) === "1", await zoom());
  await choose("View", "Zoom In");
  await choose("View", "Zoom In");
  step("View > Zoom In twice is 150%", (await zoom()) === "1.5", await zoom());
  await choose("View", "Zoom Out");
  step("View > Zoom Out is 125%", (await zoom()) === "1.25", await zoom());

  const before = await width();
  await choose("Format", "Wrap to Page");
  step(
    "Format > Wrap to Page makes the text a Letter page, at the zoom",
    before !== (await width()) && Math.round(await width()) === 765,
    String(await width()),
  );
  await choose("Format", "Text", "Hide Ruler");
  step("Format > Text > Hide Ruler hides it", (await ruler.count()) === 0);
  await shot(page, path.join(out, "textedit-view.png"));
  await page.waitForTimeout(800);

  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  step("after a reload the zoom is still 125%", (await zoom()) === "1.25", await zoom());
  step("after a reload the ruler is still hidden", (await ruler.count()) === 0);
  await choose("View", "Actual Size");
  step("View > Actual Size goes back to 100%", (await zoom()) === "1", await zoom());
  await choose("Format", "Wrap to Window");
  await choose("Format", "Text", "Show Ruler");
  step("Show Ruler brings it back", (await ruler.count()) === 1);

  // The ruler is drawn at the text's magnification: a marker stays over what it moves.
  await choose("View", "Zoom In");
  await choose("View", "Zoom In");
  await choose("View", "Zoom In");
  step("three more steps are 200%", (await zoom()) === "2", await zoom());
  const drag = async (slider) => {
    const box = await slider.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 144, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    return Number(await slider.getAttribute("aria-valuenow"));
  };
  // The head indent's marker lies on the first line's: it is dragged first, and leaves the other free.
  const hanging = await drag(window.getByRole("slider", { name: /head indent/i }));
  const moved = await drag(window.getByRole("slider", { name: /first line indent/i }));
  step(
    "at 200% a 144-pixel drag moves either indent 72 points",
    hanging === 72 && moved === 72,
    `${hanging}, ${moved}`,
  );
  const aligned = await page.evaluate(() => {
    const field = document.querySelector('[data-window-id^="textedit"] [role="textbox"]');
    const line = field.firstElementChild;
    const range = document.createRange();
    range.selectNodeContents(line);
    const slider = [...document.querySelectorAll('[role="slider"]')].find((each) =>
      /first line indent/i.test(each.getAttribute("aria-label") ?? ""),
    );
    const mark = slider.getBoundingClientRect();
    return range.getBoundingClientRect().left - (mark.left + mark.width / 2);
  });
  step(
    "and the marker stands over the text it moved",
    Math.abs(aligned) < 12,
    `${aligned.toFixed(1)} px apart`,
  );
  await shot(page, path.join(out, "textedit-view-zoomed.png"));

  // On a wrapped page the ruler is on the page: the marker stays over the text, centred or scrolled.
  const apart = () =>
    page.evaluate(() => {
      const field = document.querySelector('[data-window-id^="textedit"] [role="textbox"]');
      const range = document.createRange();
      range.selectNodeContents(field.firstElementChild);
      const mark = [...document.querySelectorAll('[role="slider"]')]
        .find((each) => /first line indent/i.test(each.getAttribute("aria-label") ?? ""))
        .getBoundingClientRect();
      return range.getBoundingClientRect().left - (mark.left + mark.width / 2);
    });
  await choose("Format", "Wrap to Page");
  const wrapped = await apart();
  step(
    "Wrap to Page at 200% keeps the marker over the text",
    Math.abs(wrapped) < 12,
    String(wrapped),
  );
  await window.locator(".mac-textedit-body").evaluate((body) => {
    body.scrollLeft = 120;
  });
  const scrolled = await apart();
  step("and scrolled sideways too", Math.abs(scrolled) < 12, String(scrolled));
  await shot(page, path.join(out, "textedit-view-wrapped.png"));
  await choose("View", "Actual Size");
  const centred = await apart();
  step("and at actual size, on the centred page", Math.abs(centred) < 12, String(centred));

  // A menu command gives the keyboard back to the document.
  await window.getByRole("textbox", { name: "Document" }).click();
  const original = await text.innerText();
  await page.keyboard.press("ControlOrMeta+a");
  await choose("View", "Zoom In");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Document",
    undefined,
    { timeout: 5_000 },
  );
  await page.keyboard.type("replaced");
  await page.waitForTimeout(300);
  step(
    "typing after View > Zoom In replaces the selection",
    (await text.innerText()).trim() === "replaced",
    await text.innerText(),
  );
  // The browser's own undo takes typing back in runs of its choosing.
  for (let tries = 0; tries < 12 && (await text.innerText()) !== original; tries += 1) {
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(100);
  }
  step(
    "and Undo restores it exactly",
    (await text.innerText()) === original,
    await text.innerText(),
  );
  await choose("Format", "Wrap to Window");
  await choose("View", "Actual Size");
});
