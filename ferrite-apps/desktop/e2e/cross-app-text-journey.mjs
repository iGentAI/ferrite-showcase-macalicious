#!/usr/bin/env node
// Words between applications, with real input: text and its bold copied in TextEdit and pasted in Notes,
// by the key and by Edit > Paste; copied in Notes and pasted in TextEdit; selected text dragged from one
// window into the other. What Notes holds is read back from the server.
//
//   node e2e/cross-app-text-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("cross-app-text", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const tag = Date.now().toString(36);
const WORDS = `copied words ${tag}`;
const BACK = `from notes ${tag}`;
const DRAGGED = `dragged words ${tag}`;
const CLIPPED = `clipped words ${tag}`;

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const savedNote = async (page, text) => {
  const { data } = (await api(page, "GET", "/api/notes/data")).json;
  return data?.notes.find((note) => (note.html ?? note.lines?.join("\n") ?? "").includes(text));
};

const editRow = async (page, row) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page
    .locator('[role="menu"]')
    .getByRole("menuitem", { name: row, exact: true })
    .first()
    .click();
  await until(async () => (await page.getByRole("menu").count()) === 0);
  await page.waitForTimeout(400);
};

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);

  await launch(page, "TextEdit");
  const document = page.getByRole("textbox", { name: "Document" }).first();
  await document.waitFor({ timeout: 10_000 });
  await document.click();
  await page.keyboard.type(WORDS);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.press("ControlOrMeta+c");

  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: 10_000 });
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await page.locator('[role="menu"]').getByRole("menuitem", { name: "New Note" }).first().click();
  await page.waitForTimeout(400);
  await page.keyboard.type("First line");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+v");
  const pasted = await until(() => savedNote(page, WORDS));
  step("Text copied in TextEdit pastes into Notes by the key, on the server", Boolean(pasted));
  step(
    "and those words are bold",
    await page.evaluate(
      ({ html, words }) => {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const walker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          if (!text.textContent.includes(words)) continue;
          for (let at = text.parentElement; at && at !== parsed.body; at = at.parentElement) {
            if (/^(B|STRONG)$/.test(at.tagName)) return true;
            if (/^(bold|[6-9]00)$/.test(at.style.fontWeight)) return true;
          }
        }
        return false;
      },
      { html: pasted?.html ?? "", words: WORDS },
    ),
    (pasted?.html ?? "").slice(0, 200),
  );

  await page.keyboard.press("Enter");
  await editRow(page, "Paste");
  step(
    "Edit > Paste from the menu bar pastes it again",
    await until(async () => {
      const html = (await savedNote(page, WORDS))?.html ?? "";
      return html.split(WORDS).length === 3;
    }),
  );

  await page.keyboard.press("Enter");
  await page.keyboard.type(BACK);
  await page.keyboard.press("Shift+Home");
  await editRow(page, "Copy");
  await launch(page, "TextEdit");
  await document.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await editRow(page, "Paste");
  step(
    "Text copied by Edit > Copy in Notes pastes into TextEdit by Edit > Paste",
    await until(async () => (await document.innerText()).includes(BACK)),
  );
  await shot(page, path.join(out, `cross-app-text-paste-${browserName}.png`));

  // A drag of selected text, into the part of the note that TextEdit's window does not cover.
  await page.keyboard.press("Enter");
  await page.keyboard.type(DRAGGED);
  await page.keyboard.press("Shift+Home");
  const placed = await page.evaluate(() => {
    const range = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
    return range ? { x: range.x + range.width / 2, y: range.y + range.height / 2 } : null;
  });
  const windowOf = page.locator(".mac-window").filter({ has: document }).first();
  const beside = await windowOf.boundingBox();
  const editor = await notes.getByRole("textbox", { name: "Note" }).boundingBox();
  const end = {
    x: (beside.x + beside.width + editor.x + editor.width) / 2,
    y: editor.y + editor.height / 2,
  };
  await page.mouse.move(placed.x, placed.y);
  await page.mouse.down();
  await page.mouse.move(placed.x + 8, placed.y + 8, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await shot(page, path.join(out, `cross-app-text-drag-${browserName}.png`));
  step(
    "Selected text dragged from TextEdit lands in the note",
    await until(() => savedNote(page, DRAGGED)),
  );

  const onDesktop = async (name) =>
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).find(
      (each) => each.parent === "desktop" && each.name.startsWith(name),
    );
  const dragSelection = async (to) => {
    const from = await page.evaluate(() => {
      const range = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
      return { x: range.x + range.width / 2, y: range.y + range.height / 2 };
    });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 8, from.y + 8, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  };

  // Words dropped on the picture leave a text file there, where they were let go.
  await launch(page, "TextEdit");
  await document.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(CLIPPED);
  await page.keyboard.press("Shift+Home");
  await dragSelection({ x: 120, y: 500 });
  const clipping = await until(() => onDesktop(CLIPPED));
  const contentOf = (entry) =>
    page.evaluate(
      async ({ id, version }) => {
        const response = await fetch(
          `/api/files/content/${id}?piece=0&count=8&version=${version}`,
          { credentials: "same-origin" },
        );
        return response.ok ? response.text() : `HTTP ${response.status}`;
      },
      { id: entry?.id, version: entry?.version ?? 0 },
    );
  step(
    "Words dropped on the desktop make a text file holding them, on the server",
    (await contentOf(clipping)) === CLIPPED,
    clipping?.name,
  );
  const iconOf = (name) =>
    page
      .getByRole("group", { name: "Desktop", exact: true })
      .locator(".mac-desktop-icon", { hasText: name })
      .first();
  const atDrop = (name, x) =>
    until(async () => {
      const box = await iconOf(name)
        .boundingBox({ timeout: 500 })
        .catch(() => null);
      return box && Math.abs(box.x + box.width / 2 - x) < 10 ? box : null;
    });
  const clippedAt = await atDrop(CLIPPED, 120);
  step("where they were let go", Boolean(clippedAt), JSON.stringify(clippedAt));

  // A link dropped on the picture leaves a saved link.
  const dropData = (data, at) =>
    page.evaluate(
      ({ data, at }) => {
        const transfer = new DataTransfer();
        for (const [type, value] of Object.entries(data)) transfer.setData(type, value);
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
      { data, at },
    );
  const LINK = `Link ${tag}`;
  await dropData(
    { "text/uri-list": `https://example.com/${tag}`, "text/plain": LINK },
    { x: 120, y: 650 },
  );
  const link = await until(() => onDesktop(LINK));
  step(
    "A link dropped on the desktop makes a saved link",
    link?.name === `${LINK}.webloc`,
    link?.name,
  );
  step(
    "holding its address, on the server",
    (await contentOf(link)).includes(`<string>https://example.com/${tag}</string>`),
  );

  // Files from the computer, as a browser hands them over: the upload of the first is refused.
  const OUTSIDE = `Outside ${tag}.txt`;
  const REFUSED = `Refused ${tag}.txt`;
  await page.route("**/api/files/uploads*", async (route) => {
    if (route.request().postData()?.includes(REFUSED)) {
      await route.fulfill({
        status: 413,
        contentType: "application/json",
        body: JSON.stringify({ error: "The file is too large." }),
      });
    } else await route.continue();
  });
  expectRefusal(413, "/api/files/uploads");
  await page.evaluate(
    ({ names, at }) => {
      const transfer = new DataTransfer();
      for (const name of names) {
        transfer.items.add(new File(["from outside"], name, { type: "text/plain" }));
      }
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
    { names: [REFUSED, OUTSIDE], at: { x: 120, y: 770 } },
  );
  step(
    "A file from the computer dropped on the desktop goes there, though another is refused",
    Boolean(await until(() => onDesktop(OUTSIDE))) && !(await onDesktop(REFUSED)),
  );
  const refusal = page.getByRole("alertdialog");
  step(
    "and the refusal is told",
    await refusal
      .getByText("The file is too large.")
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await refusal.getByRole("button").first().click();
  const outsideAt = await atDrop(OUTSIDE, 120);
  step(
    "and the file that was saved is where it was let go",
    Boolean(outsideAt),
    JSON.stringify(outsideAt),
  );
  await shot(page, path.join(out, `cross-app-text-desktop-${browserName}.png`));
});
