#!/usr/bin/env node
// Dictionary on Ferrite: look a word up and see the module's answer from
// Wiktionary, Datamuse and Wikipedia (through the application's declared
// egress) in the window's Dictionary, Thesaurus and Wikipedia scopes, with the
// sources credited; select a word in TextEdit and press Look Up
// (Control-Command-D), which shows it in Dictionary; reload and find the
// look-up in the person's recent words. Needs `ferrite dev --egress allow`.
// Exits 0 only when every step passed and the page logged no console error,
// page error, failed request or HTTP error. It runs in a fresh browser signed in as Guest User
// (journey-kit's openDesktop), so the history it adds to is that new guest's own.
//
//   ferrite dev --egress allow                        # in ferrite-apps/desktop
//   node e2e/dictionary-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                   [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const ENTRY = "/api/dictionary/entry";
const HISTORY = "/api/dictionary/history";
const WORD = "serendipity";
/** The word typed into TextEdit and looked up from there. */
const LOOKED_UP = "luminous";
const { base, out, browserName } = options();
const { step, run } = journey("dictionary");

/** The next answer of the entry route for `word`. */
const nextEntry = (page, word) =>
  page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return url.pathname === ENTRY && url.searchParams.get("word") === word;
    },
    { timeout: 20_000 },
  );

async function openWithSpotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
}

const dictionaryWindow = (page) => page.getByRole("region", { name: /^Dictionary/ }).first();

const LIBRARY = "/api/app-store/library";

/** Get `id` from the App Store (it does not come with the desktop); answers the list to restore. */
async function install(page, id) {
  const library = await api(page, "GET", LIBRARY);
  const before = library.json.installed;
  const installed = [...new Set([...(before ?? []), id])];
  await api(page, "PUT", LIBRARY, { installed, rev: library.json.rev });
  await reloadDesktop(page);
  return before;
}

/** Put the App Store library back as it was. */
async function restore(page, before) {
  const library = await api(page, "GET", LIBRARY);
  if (before === null || before === undefined) await api(page, "DELETE", LIBRARY);
  else await api(page, "PUT", LIBRARY, { installed: before, rev: library.json.rev });
}

await run(async (page) => {
  // A reload here is not about a save in flight (other journeys are): the page's saves finish first.
  const writing = new Set();
  page.on("request", (request) => {
    if (request.method() !== "GET") writing.add(request);
  });
  page.on("requestfinished", (request) => writing.delete(request));
  page.on("requestfailed", (request) => writing.delete(request));
  const reloadSaved = async () => {
    const end = Date.now() + 5_000;
    await page.waitForTimeout(500);
    while (writing.size > 0 && Date.now() < end) await page.waitForTimeout(100);
    await reloadDesktop(page);
  };
  await openDesktop(page, base, step);
  const started = Date.now();
  const library = await install(page, "dictionary");

  await openWithSpotlight(page, "Dictionary");
  let window = dictionaryWindow(page);
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.fill("");
  const answered = nextEntry(page, WORD);
  answered.catch(() => {});
  await field.fill(WORD);
  const reply = await answered;
  const body = await reply.json();
  step(
    "the module answers a real entry from its sources",
    reply.status() === 200 &&
      body.found === true &&
      body.dictionary?.parts?.length > 0 &&
      body.thesaurus?.length > 0 &&
      typeof body.wikipedia?.extract === "string",
    `parts ${body.dictionary?.parts?.map((p) => p.part).join(",")}; thesaurus ${body.thesaurus?.length}; failed ${JSON.stringify(body.failed)}`,
  );
  const firstSense = body.dictionary?.parts?.[0]?.senses?.[0]?.text ?? "";
  const entry = window.getByRole("region", { name: `Entry for ${WORD}` });
  const senseShown =
    firstSense.trim() !== "" &&
    (await entry
      .getByText(firstSense.slice(0, 80), { exact: false })
      .first()
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      ));
  step("the Dictionary scope shows Wiktionary's first sense", senseShown, firstSense.slice(0, 60));
  step(
    "the entry credits Wiktionary",
    (await entry.getByRole("link", { name: /Wiktionary, CC BY-SA 4.0/ }).count()) === 1,
  );
  await shot(page, path.join(out, `dictionary-${browserName}.png`));

  await window.getByRole("radio", { name: "Thesaurus" }).click();
  const synonym = body.thesaurus?.[0]?.synonyms?.[0] ?? "";
  step(
    "the Thesaurus scope shows Datamuse's synonyms",
    synonym !== "" && (await entry.getByText(synonym, { exact: false }).count()) > 0,
    synonym,
  );
  await window.getByRole("radio", { name: "Wikipedia" }).click();
  const more = entry.getByRole("link", { name: "Read More on Wikipedia" });
  step(
    "the Wikipedia scope shows the article's introduction and links to it",
    (await more.getAttribute("href"))?.startsWith("https://en.wikipedia.org/") &&
      (await entry.innerText()).includes(body.wikipedia.extract.slice(0, 40)),
  );
  await window.getByRole("radio", { name: "Dictionary" }).click();

  // Look Up from TextEdit, with no Dictionary window open: type a word into its document, select
  // it and press Control-Command-D.
  await reloadSaved();
  await launch(page, "TextEdit");
  const textEdit = page.getByRole("region", { name: /^512 Pixels/ });
  await textEdit.waitFor({ state: "visible", timeout: 10_000 });
  const editor = textEdit.getByRole("textbox", { name: "Document" });
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(` ${LOOKED_UP}`);
  const selected = await editor.evaluate((element, word) => {
    if ("setSelectionRange" in element) {
      const at = element.value.lastIndexOf(word);
      if (at < 0) return "";
      element.setSelectionRange(at, at + word.length);
      return word;
    }
    // A rich text editor: select the word in the text node that holds it.
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.data.lastIndexOf(word);
      if (at >= 0) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + word.length);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return selection.toString();
      }
    }
    return "";
  }, LOOKED_UP);
  const lookedUp = nextEntry(page, selected);
  lookedUp.catch(() => {});
  await page.keyboard.press("Control+Meta+KeyD");
  await page
    .locator(".mac-dictionary-look-up")
    .getByRole("button", { name: "Open in Dictionary" })
    .click({ timeout: 10_000 });
  window = dictionaryWindow(page);
  await window.waitFor({ state: "visible", timeout: 10_000 });
  step(
    "Look Up in TextEdit shows the selected word in Dictionary",
    selected !== "" &&
      (await window.getByRole("searchbox", { name: "Search" }).inputValue()) === selected,
    selected,
  );
  const second = await lookedUp;
  const lookedUpBody = await second.json().catch(() => null);
  const definition = lookedUpBody?.dictionary?.parts?.[0]?.senses?.[0]?.text ?? "";
  const lookedEntry = window.getByRole("region", { name: `Entry for ${selected}` });
  const definitionShown =
    definition.trim() !== "" &&
    (await lookedEntry
      .getByText(definition.slice(0, 80), { exact: false })
      .first()
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      ));
  step(
    "and Dictionary looks it up and shows its definition",
    second.status() === 200 && lookedUpBody?.found === true && definitionShown,
    `HTTP ${second.status()}; ${definition.slice(0, 60)}`,
  );
  await shot(page, path.join(out, `dictionary-look-up-${browserName}.png`));

  await reloadSaved();
  await openWithSpotlight(page, "Dictionary");
  window = dictionaryWindow(page);
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await window.getByRole("searchbox", { name: "Search" }).fill("");
  const words = window.getByRole("listbox", { name: "Words" });
  await words.getByRole("option", { name: WORD, exact: true }).waitFor({ timeout: 10_000 });
  // The recent look-ups as the window lists them, the latest first: the word looked up from
  // TextEdit, then the one typed in Dictionary.
  const listed = (await words.getByRole("option").allInnerTexts()).map((text) => text.trim());
  const listedAt = (word) => listed.indexOf(word);
  step(
    "after a reload the empty search lists both look-ups, the one from TextEdit first",
    listedAt(LOOKED_UP) >= 0 && listedAt(WORD) > listedAt(LOOKED_UP),
    listed.slice(0, 3).join(", "),
  );

  // The stored history holds both of this run's look-ups, the TextEdit one newest, each made
  // during this run.
  const history = (await api(page, "GET", HISTORY)).json?.history ?? [];
  const looked = history.map((past) => past.word);
  const at = (word) => history.find((past) => past.word === word)?.at ?? 0;
  step(
    "the person's history keeps this run's look-ups, newest first",
    looked[0] === LOOKED_UP &&
      looked.indexOf(WORD) > 0 &&
      at(WORD) >= started &&
      at(LOOKED_UP) >= at(WORD),
    looked.slice(0, 3).join(", "),
  );
  await restore(page, library);
});
