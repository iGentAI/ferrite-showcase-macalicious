#!/usr/bin/env node
// The shared pieces nothing drove: a file from the computer dropped into a Finder window, a PDF opening in
// Preview, Spotlight opening an application and a file through the same queue, a notification's Show opening
// its application, the Share menu's AirDrop dimmed with its reason, and Copy of an answer reaching the
// clipboard. Read back from the server.
//
//   node e2e/cross-app-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("cross-app-rows", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const tag = Date.now().toString(36);
const FOLDER = `Cross ${tag}`;
const TEXT = `Crossnote ${tag}.txt`;
const PDF = `Crosspaper ${tag}.pdf`;
const DROPPED = `From outside ${tag}.txt`;
const PDF_BYTES = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const entries = async (page) => (await api(page, "GET", "/api/files/")).json.entries ?? [];
async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const folderId = (
    await api(page, "POST", "/api/files/ops", {
      ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
    })
  ).json.created?.[0];
  await uploadFile(page, { parent: folderId, name: TEXT, type: "text/plain", text: "Some words" });
  await uploadFile(page, {
    parent: folderId,
    name: PDF,
    type: "application/pdf",
    bytes: PDF_BYTES,
  });
  await page.reload();
  await openDesktop(page, base, step);
  const picture = (name) => shot(page, path.join(out, `cross-app-rows-${name}-${browserName}.png`));

  try {
    const dock = page.getByRole("toolbar", { name: "Dock" });
    await dock.getByRole("button", { name: "Finder" }).click();
    const win = page.locator(".mac-window.mac-finder").first();
    await win.waitFor({ timeout: 10_000 });
    await win.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    await win.getByRole("option", { name: FOLDER, exact: true }).first().dblclick();
    const option = (name) => win.getByRole("option", { name, exact: true }).first();
    await option(TEXT).waitFor({ timeout: 10_000 });

    // A file from the computer, as a browser's drop brings it.
    const box = await win.getByRole("listbox").first().boundingBox();
    await page.evaluate(
      ({ name, at }) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(["from outside"], name, { type: "text/plain" }));
        const under = document.elementFromPoint(at.x, at.y);
        const init = {
          bubbles: true,
          cancelable: true,
          clientX: at.x,
          clientY: at.y,
          dataTransfer: transfer,
        };
        under.dispatchEvent(new DragEvent("dragover", init));
        under.dispatchEvent(new DragEvent("drop", init));
      },
      { name: DROPPED, at: { x: box.x + box.width - 60, y: box.y + box.height - 60 } },
    );
    step(
      "A file from the computer lands in the folder shown, on the server",
      await until(async () =>
        (await entries(page)).some((each) => each.name === DROPPED && each.parent === folderId),
      ),
    );
    await option(DROPPED).waitFor({ timeout: 8_000 });
    await picture("dropped");

    // A PDF opens in Preview.
    await option(PDF).dblclick();
    const preview = page.locator('[data-window-id^="preview"]').first();
    step(
      "A PDF opens in Preview, its name in the title",
      await until(async () => {
        if (!(await preview.isVisible())) return false;
        const title = await preview.locator(".mac-title-bar-title").first().innerText();
        return title.includes("Crosspaper") && !(await preview.innerText()).includes("Opening");
      }, 20_000),
    );
    await picture("pdf");

    // AirDrop in the Share menu.
    await dock.getByRole("button", { name: "Finder" }).click();
    await option(TEXT).click();
    await win.getByRole("button", { name: "Share" }).click();
    const airdrop = page.getByRole("menuitem", { name: "AirDrop", exact: true }).first();
    await airdrop.waitFor({ timeout: 5_000 });
    step(
      "AirDrop is dimmed, with its reason",
      (await airdrop.getAttribute("aria-disabled")) === "true" &&
        /nearby devices/.test(
          `${await airdrop.getAttribute("title")} ${await airdrop.getAttribute("data-reason")}`,
        ),
    );
    await picture("airdrop");
    await page.keyboard.press("Escape");

    // Spotlight through the same queue.
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await page.getByRole("menuitem", { name: "Spotlight" }).first().click();
    await field.fill("Crossnote");
    const found = page
      .getByRole("group", { name: /^(?:Files|Top Hit)$/ })
      .getByRole("option", { name: TEXT })
      .first();
    await found.waitFor({ timeout: 15_000 });
    await found.click();
    await field.press("Enter");
    step(
      "Spotlight opens a file in its application",
      await until(() =>
        page
          .locator('[data-window-id^="textedit"]')
          .first()
          .getByText("Some words")
          .first()
          .isVisible()
          .catch(() => false),
      ),
    );
    await page.getByRole("menuitem", { name: "Spotlight" }).first().click();
    await field.fill("Calculator");
    await page.getByRole("group", { name: "Top Hit" }).getByRole("option").first().waitFor();
    await field.press("Enter");
    step(
      "and an application by name",
      await until(() => page.locator('[data-window-id="calculator"]').isVisible()),
    );
    await picture("spotlight-opened");

    // A notification opens its application.
    const said = await api(page, "POST", "/api/notification-center/notify", {
      app: "chess",
      title: `Your move ${tag}`,
    });
    step("A notification comes", said.status === 201, String(said.status));
    const banner = page.locator('.mac-desktop-shell-banners [data-app="chess"]');
    await banner.getByRole("button", { name: "Show" }).click({ timeout: 15_000 });
    step(
      "Its Show opens its application",
      await until(() => page.locator('[data-window-id="chess"]').isVisible()),
    );
    await picture("notification-opened");

    // A press on a banner itself opens its application, as on a Mac.
    await api(page, "POST", "/api/notification-center/notify", {
      app: "stocks",
      title: `Markets ${tag}`,
    });
    await page
      .locator('.mac-desktop-shell-banners [data-app="stocks"]')
      .getByText(`Markets ${tag}`)
      .click({ timeout: 15_000 });
    step(
      "A press on the banner opens its application",
      await until(() => page.locator('[data-window-id="stocks"]').isVisible()),
    );

    // Copy reaches the clipboard, and says so by what is there.
    await page.getByRole("menuitem", { name: "Siri" }).first().click();
    const siri = page.locator(".mac-desktop-shell-siri");
    const ask = siri.getByRole("textbox", { name: "Type to Siri" });
    await ask.fill("What is 6 times 7");
    await ask.press("Enter");
    await siri.locator("[data-answer]").waitFor({ timeout: 15_000 });
    await siri.getByRole("button", { name: "Copy" }).click();
    step(
      "Copy puts an answer on the clipboard",
      await until(async () =>
        (await page.evaluate(() => navigator.clipboard.readText())).includes("42"),
      ),
    );
  } finally {
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "trash", id: folderId }] });
  }
});
