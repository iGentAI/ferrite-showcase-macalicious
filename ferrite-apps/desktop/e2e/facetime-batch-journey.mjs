#!/usr/bin/env node
// Scratch: this batch's rows in a real browser.
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("facetime-batch");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `fbchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `fbmartin-${id}`, fullName: `Martin ${id}`, password };
const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const contactsOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const menu = async (page, title) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
};
const dimmed = async (row) => (await row.getAttribute("aria-disabled")) === "true";

await run(
  {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
      ],
    },
  },
  {},
  async ({ person }) => {
    const other = await person("martin", martin);
    const page = await person("chris", chris);
    await openFromDock(other, "FaceTime");
    await openFromDock(page, "FaceTime");
    const face = windowOf(page);
    const field = face.getByRole("textbox", { name: "Recipient" });
    await within(10_000, () => field.isVisible());
    await openFromDock(page, "Contacts");
    await contactsOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
    await contactsOf(page).getByRole("button", { name: "Contacts commands" }).click();
    await page.getByRole("menuitem", { name: "Add Desktop User…" }).click();
    const sheet = page.getByRole("dialog", { name: "Add a Desktop User" });
    await sheet.getByRole("textbox", { name: "Account Name" }).fill(martin.name);
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await within(6_000, async () => (await sheet.count()) === 0);
    await page.waitForTimeout(1_500);
    await shot(page, "batch-contacts");

    // A real drag: the Contacts row onto what shows of the FaceTime window.
    const row = contactsOf(page).locator("[data-index]", { hasText: martin.fullName }).first();
    const boxes = await page.evaluate(() => {
      const of = (sel) => document.querySelector(sel)?.getBoundingClientRect().toJSON();
      return {
        face: of('[aria-label="FaceTime"]'),
        contacts: of('.mac-contacts[aria-label="Contacts"]'),
      };
    });
    console.log("boxes", JSON.stringify(boxes));
    const header = face.locator(".mac-facetime-header");
    const start = await header.boundingBox();
    const rowBox = await row.boundingBox();
    console.log("row", JSON.stringify(rowBox), "header", JSON.stringify(start));
    await page.mouse.move(start.x + 240, start.y + 6);
    await page.mouse.down();
    await page.mouse.move(700 + 240, start.y + 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    await contactsOf(page)
      .click({ position: { x: 4, y: 4 }, force: true })
      .catch(() => {});
    await page.waitForTimeout(300);
    const rowNow = await row.boundingBox();
    const camera = await face.locator(".mac-facetime-camera").boundingBox();
    console.log("moved", JSON.stringify(rowNow), JSON.stringify(camera));
    await page.mouse.move(rowNow.x + 20, rowNow.y + 8);
    await page.mouse.down();
    await page.mouse.move(rowNow.x + 40, rowNow.y + 12, { steps: 3 });
    await page.mouse.move(camera.x + camera.width - 30, camera.y + 60, { steps: 10 });
    await page.mouse.up();
    const dropped = await within(3_000, async () => (await field.inputValue()) === martin.name);
    step(
      "a contact dragged onto the window fills the field",
      dropped !== null,
      await field.inputValue(),
    );
    await shot(page, "batch-dropped");

    await face.click({ position: { x: 300, y: 300 } });
    await field.fill(martin.fullName.slice(0, 8));
    const offers = face.getByRole("group", { name: "Contacts" });
    await within(5_000, () => offers.isVisible());
    const fieldBox = await field.boundingBox();
    const offerBox = await offers.boundingBox();
    step(
      "the offers lie right under the field",
      offerBox.y >= fieldBox.y + fieldBox.height && offerBox.y < fieldBox.y + fieldBox.height + 6,
      `${JSON.stringify(fieldBox)} ${JSON.stringify(offerBox)}`,
    );
    await shot(page, "batch-offers");
    const topAt = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest("fieldset") !== null,
      {
        x: offerBox.x + 40,
        y: offerBox.y + offerBox.height / 2,
      },
    );
    step("the offers paint over the rows", topAt);
    await field.press("ArrowDown");
    await page.keyboard.press("Enter");
    step(
      "ArrowDown and Return choose the offer",
      (await field.inputValue()) === martin.name,
      await field.inputValue(),
    );

    await field.selectText();
    await menu(page, "Edit");
    const cut = page.getByRole("menuitem", { name: /^Cut/ });
    step("Edit > Cut is live with the field's text selected", !(await dimmed(cut)));
    await shot(page, "batch-edit");
    await page.getByRole("menuitem", { name: /^Copy/ }).click();
    await page.waitForTimeout(500);
    step(
      "the field keeps the keyboard after Edit > Copy",
      await field.evaluate((el) => el === document.activeElement),
    );

    await menu(page, "Video");
    const enter = page.getByRole("menuitem", { name: /^Enter Full Screen/ });
    step("Video > Enter Full Screen is live", !(await dimmed(enter)));
    await page.keyboard.press("Escape");

    await menu(page, "Help");
    const help = page.getByRole("menuitem", { name: /^FaceTime Help/ });
    await help.waitFor({ timeout: 3_000 });
    step(
      "Help has the search field and FaceTime Help",
      (await help.isVisible()) &&
        (await page.locator(".mac-desktop-shell-help-search input").count()) > 0,
    );
    await page.keyboard.press("Escape");

    await field.fill(martin.name);
    await field.press("Enter");
    const incoming = windowOf(other).locator('[aria-label="Incoming call"]');
    await within(15_000, () => incoming.isVisible());
    await incoming.getByRole("button", { name: "Accept" }).click();
    const on = await within(
      30_000,
      async () => (await face.getAttribute("data-call-state")) === "connected",
    );
    step("the call connects", on !== null);
    const hud = face.locator('[aria-label="Call"]');
    await page.waitForTimeout(1_500);
    await shot(page, "batch-call");
    const clipped = await hud
      .locator(".mac-facetime-hud-line")
      .evaluateAll((lines) => lines.some((line) => line.scrollWidth > line.clientWidth));
    step("the panel's lines are not cut off", !clipped);

    const live = hud.getByRole("button", { name: "Live Photo" });
    await within(10_000, () => live.isEnabled());
    await live.click();
    const notice = face.locator('[aria-label="Notice"]');
    const said = await within(20_000, async () =>
      /saved to Photos/.test((await notice.innerText().catch(() => "")) ?? ""),
    );
    step("Live Photo says it is saved", said !== null, await notice.innerText().catch(() => ""));
    await shot(page, "batch-live-photo");
    const library = await page.evaluate(async () =>
      (await fetch("/api/photos/library", { credentials: "same-origin" })).text(),
    );
    step(
      "the photo is in the library on the server",
      library.includes("FaceTime Photo of"),
      library.slice(0, 300),
    );

    const frame = page
      .locator("[data-window-id]", { has: page.locator('[aria-label="FaceTime"]') })
      .first();
    await hud.getByRole("button", { name: "Full Screen", exact: true }).click();
    const full = await within(
      5_000,
      async () => (await frame.getAttribute("data-full-screen")) !== null,
    );
    step("the panel's Full Screen enters full screen", full !== null);
    await page.waitForTimeout(1_200);
    await shot(page, "batch-full-screen");
    await hud.getByRole("button", { name: "Exit Full Screen" }).click();
    const back = await within(
      5_000,
      async () => (await frame.getAttribute("data-full-screen")) === null,
    );
    step("Exit Full Screen comes back", back !== null);
    await page.waitForTimeout(1_200);
    await hud.getByRole("button", { name: "End" }).click();
    await within(10_000, async () => (await face.getAttribute("data-call-state")) === "idle");

    const info = face.getByRole("button", { name: `Show ${martin.fullName} in Contacts` });
    await within(10_000, () => info.isEnabled());
    await shot(page, "batch-row");
    await info.click();
    const card = await within(8_000, async () =>
      (await contactsOf(page).innerText()).includes(martin.fullName),
    );
    step("the info button opens the person's card in Contacts", card !== null);
    await page.waitForTimeout(600);
    await shot(page, "batch-info");
  },
);
