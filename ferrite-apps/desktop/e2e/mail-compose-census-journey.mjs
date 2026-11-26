#!/usr/bin/env node

// Mail New Message census journey (R4): the text-editing controls of Mail's New Message window only (R6 owns sending
// and the rest of Mail), with real input, in chromium, chrome, firefox or webkit: the shared editing rows (Edit,
// Format > Font, Format > Text, the Fonts and Colors panels), the format bar and the Emoji menu.
//
//   node e2e/mail-compose-census-journey.mjs --browser chromium|chrome|firefox|webkit

import { choosePopup, popupOptions } from "./r4-app-rows.mjs";
import { census, doubleClickWord, openFromDock, sleep, styleOf, until } from "./r4-census-kit.mjs";
import { editorRows, line, rgbOf, slug, tidy } from "./r4-editor-rows.mjs";

const { row, run } = census("mail-compose");
const S = "Mail New Message window";
const m = (role, name, how, expect, covers = []) => ({
  meta: { state: S, role, name, how, expect, persists: "none", covers },
});
const composer = (page) => page.locator(".mac-mail-compose").last();
const message = (page) => composer(page).getByRole("textbox", { name: "Message" });
const bar = (page) => composer(page).getByRole("toolbar", { name: "Format" });

/** The New Message window, opened from Mail's toolbar (Mail opened from the Dock first). */
async function compose(page) {
  if (
    await composer(page)
      .isVisible()
      .catch(() => false)
  )
    return composer(page);
  const button = page.getByRole("button", { name: "New Message" }).first();
  if (!(await button.isVisible().catch(() => false)))
    await openFromDock(page, "Mail", { selector: '[data-window-id="mail"]' });
  await button.click();
  await message(page).waitFor({ timeout: 15_000 });
  await sleep(400);
  return composer(page);
}

/** The format bar, shown with the toolbar's Show Format Bar button when it is hidden. */
async function formatBar(page) {
  await compose(page);
  if (
    !(await bar(page)
      .isVisible()
      .catch(() => false))
  ) {
    await composer(page)
      .getByRole("button", { name: /Show Format Bar|Format/ })
      .first()
      .click();
    await bar(page).waitFor({ timeout: 4_000 });
  }
  return bar(page);
}

editorRows(row, {
  P: "mail-compose",
  state: S,
  editor: async (page) => {
    await compose(page);
    return message(page);
  },
  font: ["Format", "Font"],
  text: ["Format", "Text"],
  strike: false,
  aligns: [
    ["Align Left", "left", "Control+{"],
    ["Center", "center", "Control+|"],
    ["Justify", "justify", null],
    ["Align Right", "right", "Control+}"],
  ],
  keys: {
    bold: "Control+B",
    italic: "Control+I",
    underline: "Control+U",
    bigger: "Control+Plus",
    smaller: "Control+-",
    fonts: "Control+T",
    colors: "Shift+Control+C",
  },
});

/** A fresh line in the message with its word selected, the format bar showing. */
async function selected(page) {
  const toolbar = await formatBar(page);
  const word = await line(page, message(page), "Mb");
  await doubleClickWord(page, message(page), word);
  return { toolbar, word };
}

row(
  "mail-compose.format-bar.toggle",
  async ({ page }) => {
    await compose(page);
    const toggle = composer(page)
      .getByRole("button", { name: /Show Format Bar|Hide Format Bar/ })
      .first();
    const before = await bar(page)
      .isVisible()
      .catch(() => false);
    await toggle.click();
    const flipped = await until(
      async () =>
        (await bar(page)
          .isVisible()
          .catch(() => false)) !== before,
      3_000,
    );
    await composer(page)
      .getByRole("button", { name: /Show Format Bar|Hide Format Bar/ })
      .first()
      .click();
    const back = await until(
      async () =>
        (await bar(page)
          .isVisible()
          .catch(() => false)) === before,
      3_000,
    );
    return {
      ok: flipped && back,
      detail: `format bar ${before} -> ${!before} -> ${before}: ${flipped}/${back}`,
    };
  },
  m(
    "button",
    "Show Format Bar",
    "click the toolbar's format bar button, twice",
    "the format bar shows, then hides",
    [
      ["button", "Show Format Bar", /toolbar:Message toolbar/],
      ["button", "Hide Format Bar", /toolbar:Message toolbar/],
    ],
  ),
);
for (const [label, check] of [
  ["Bold", (s) => s.bold],
  ["Italic", (s) => s.italic],
  ["Underline", (s) => s.underline],
  ["Strikethrough", (s) => s.strike],
]) {
  row(
    `mail-compose.format-bar.${slug(label)}`,
    async ({ page }) => {
      const { toolbar, word } = await selected(page);
      await toolbar
        .getByRole("group", { name: "Text style" })
        .getByRole("button", { name: label, exact: true })
        .click();
      const ok = await until(async () => check(await styleOf(message(page), word)), 3_000);
      return { ok, detail: `${label} applied=${ok}` };
    },
    m(
      "button",
      label,
      `click ${label} in the format bar`,
      `the selected word becomes ${label.toLowerCase()}`,
      [["button", label, /group:Text style/]],
    ),
  );
}
for (const [label, css] of [
  ["Align left", /^(left|start)$/],
  ["Center", /^center$/],
  ["Align right", /^right$/],
  ["Justify", /^justify$/],
]) {
  row(
    `mail-compose.format-bar.${slug(label)}`,
    async ({ page }) => {
      const { toolbar, word } = await selected(page);
      const group = toolbar.getByRole("group", { name: "Alignment" });
      await group
        .getByRole("button", { name: label === "Center" ? "Align right" : "Center", exact: true })
        .click();
      await doubleClickWord(page, message(page), word);
      await group.getByRole("button", { name: label, exact: true }).click();
      const ok = await until(
        async () => css.test((await styleOf(message(page), word)).align),
        3_000,
      );
      return { ok, detail: `align=${(await styleOf(message(page), word)).align}` };
    },
    m("button", label, `click ${label} in the format bar`, "the line takes the alignment", [
      ["button", label, /group:Alignment/],
    ]),
  );
}
row(
  "mail-compose.format-bar.font-family",
  async ({ page }) => {
    const { toolbar, word } = await selected(page);
    const control = toolbar.getByRole("combobox", { name: "Font family" });
    const names = await popupOptions(page, control);
    const pick = names.find((name) => /Courier|Times|Arial|Helvetica/.test(name)) ?? names[1];
    await doubleClickWord(page, message(page), word);
    await choosePopup(page, control, pick);
    const ok = await until(
      async () => (await styleOf(message(page), word)).family.includes(pick),
      3_000,
    );
    return { ok, detail: `chose ${pick}; family ${(await styleOf(message(page), word)).family}` };
  },
  m(
    "combobox",
    "Font family",
    "choose a family in the format bar",
    "the selected word takes the family",
    [["combobox", "Font family", /toolbar:Format/]],
  ),
);
row(
  "mail-compose.format-bar.font-size",
  async ({ page }) => {
    const { toolbar, word } = await selected(page);
    const control = toolbar.getByRole("combobox", { name: "Font size" });
    const names = await popupOptions(page, control);
    const pick = names.find((name) => name.trim() === "24") ?? names.at(-1);
    await doubleClickWord(page, message(page), word);
    await choosePopup(page, control, pick);
    const ok = await until(
      async () =>
        Math.round((await styleOf(message(page), word)).size) === Number.parseInt(pick, 10),
      3_000,
    );
    return { ok, detail: `chose ${pick}; size ${(await styleOf(message(page), word)).size}px` };
  },
  m(
    "combobox",
    "Font size",
    "choose a size in the format bar",
    "the selected word takes the size",
    [["combobox", "Font size", /toolbar:Format/]],
  ),
);
row(
  "mail-compose.format-bar.text-color",
  async ({ page }) => {
    const { toolbar, word } = await selected(page);
    await toolbar.getByLabel("Text color").fill("#118833");
    const ok = await until(
      async () => (await styleOf(message(page), word)).color === rgbOf("#118833"),
      3_000,
    );
    return { ok, detail: `colour ${(await styleOf(message(page), word)).color}` };
  },
  m(
    "textbox",
    "Text color",
    "enter a colour in the format bar's colour well (the browser's colour input)",
    "the selected word takes the colour",
    [["textbox", "Text color", /toolbar:Format/]],
  ),
);
const EMOJI = [
  "🙂 Slightly Smiling Face",
  "😀 Grinning Face",
  "👍 Thumbs Up",
  "🎉 Party Popper",
  "⛴️  Ferry",
];
for (const emoji of EMOJI) {
  row(
    `mail-compose.emoji.${slug(emoji.split(" ").slice(1).join(" "))}`,
    async ({ page }) => {
      await compose(page);
      await line(page, message(page), "Em");
      const glyph = emoji.split(" ")[0];
      const before = (await message(page).innerText()).split(glyph).length;
      await composer(page).getByRole("button", { name: "Emoji" }).first().click();
      await page.getByRole("menuitem", { name: emoji }).last().click();
      const ok = await until(
        async () => (await message(page).innerText()).split(glyph).length > before,
        3_000,
      );
      return { ok, detail: ok ? `${glyph} inserted` : "not inserted" };
    },
    m(
      "menuitem",
      emoji,
      "Emoji button, choose the emoji",
      "the emoji is inserted at the insertion point",
      [
        ["menuitem", emoji.replace(/\s+/g, " "), /menu:Emoji/],
        ["button", "Emoji", /toolbar/],
      ],
    ),
  );
}

await run({
  beforeEach: async ({ page }) => {
    await tidy(page);
  },
});
