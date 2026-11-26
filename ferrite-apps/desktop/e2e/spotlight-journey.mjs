#!/usr/bin/env node
// Spotlight on Ferrite: the signed-in person's own things are found through
// Spotlight's per-person index. With a contact, a sticky note, a text file in
// the drive whose words hold the search word, and a Safari bookmark, the
// search route finds each (the file by its words, with them in the detail),
// another person finds none, and a rename in the drive reaches the index at
// once. The desktop's Spotlight then lists them by kind, works out a sum and a
// unit conversion as they are typed, opens a contact in Contacts, and opens a
// web search as a new Safari tab. Exits 0 only when every step passed and the
// page logged no console error, page error, failed request or HTTP error. A
// one-word query also asks Dictionary for a definition, so run `ferrite dev`
// with `--egress allow` (without egress Dictionary answers 502, which counts).
// It removes what it wrote.
//
//   ferrite dev --egress allow                        # in ferrite-apps/desktop
//   node e2e/spotlight-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                  [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";
import { driveOps, uploadFile } from "./system-kit.mjs";

const CARDS = "/api/contacts/cards";
const STICKIES = "/api/stickies/data";
const BOOKMARKS = "/api/safari/bookmarks";
const TABS = "/api/safari/tabs";
const SEARCH = "/api/spotlight/search";
const WORD = "Zephyrine";
const { base, out } = options();
const { step, run } = journey("spotlight");

const card = {
  id: "journey-zephyrine",
  account: "icloud",
  first: WORD,
  last: "Journey",
  emails: [{ label: "work", value: "zephyrine@example.com" }],
};
const sticky = { id: "journey-sticky", color: "yellow", text: `Call ${WORD}\nabout the tea` };

const search = async (page, query) =>
  (await api(page, "GET", `${SEARCH}?q=${encodeURIComponent(query)}`)).json.results ?? [];

await run(async (page) => {
  await openDesktop(page, base, step);
  const cards = await api(page, "GET", CARDS);
  // Listed before the one searched for, so that showing the first card would not pass for finding it.
  const first = { id: "journey-first", account: "icloud", first: "Aaron", last: "Aardvark" };
  const putCards = await api(page, "PUT", CARDS, { cards: [first, card], rev: cards.json.rev });
  const notes = await api(page, "GET", STICKIES);
  const putNotes = await api(page, "PUT", STICKIES, {
    base: notes.json.rev,
    data: { notes: [sticky] },
  });
  const file = await uploadFile(page, {
    parent: "documents",
    name: "Garden plan.txt",
    type: "text/plain",
    text: `Plant the tulip bulbs for ${WORD} before the first frost.`,
  });
  const links = await api(page, "GET", BOOKMARKS);
  const putLinks = await api(page, "PUT", BOOKMARKS, {
    favorites: [{ title: `${WORD} on Wikipedia`, url: "https://en.wikipedia.org/wiki/Zephyr" }],
    bookmarks: [],
    rev: links.json.rev,
  });
  step(
    "the person keeps a contact, a sticky note, a text file in the drive and a bookmark",
    putCards.status === 200 && putNotes.status === 200 && Boolean(file) && putLinks.status === 200,
    `${putCards.status} ${putNotes.status} ${file} ${putLinks.status}`,
  );

  const found = await search(page, WORD.toLowerCase());
  const kinds = found.map((result) => `${result.kind}:${result.title}`);
  const byWords = found.find((result) => result.kind === "files");
  step(
    "the index finds the contact, the note, the file by its words and the bookmark",
    kinds.includes(`contacts:${WORD} Journey`) &&
      kinds.includes(`stickies:Call ${WORD}`) &&
      kinds.includes("files:Garden plan.txt") &&
      kinds.includes(`web:${WORD} on Wikipedia`),
    kinds.join(", "),
  );
  step(
    "the file's result shows the words around the match",
    /tulip bulbs/.test(byWords?.detail ?? ""),
    byWords?.detail,
  );
  await driveOps(page, [{ op: "rename", id: file, name: "Spring plan.txt" }]);
  const renamed = await search(page, "frost");
  step(
    "a rename in the drive reaches the index at the next search",
    renamed.some((result) => result.title === "Spring plan.txt") &&
      !renamed.some((result) => result.title === "Garden plan.txt"),
    renamed.map((result) => result.title).join(", "),
  );

  // A second person, in a browser of their own, makes an account at the login window.
  const run = Date.now().toString(36);
  const person = { name: `seeker-${run}`, fullName: "Other Seeker", password: `tide-${run}-pool` };
  const other = await page.context().browser().newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(otherPage, person);
  const who = await api(otherPage, "GET", "/api/session");
  step(
    "a second person signs in at the login window",
    who.status === 200 && who.json?.account?.name === person.name,
    JSON.stringify(who.json?.account),
  );
  const theirs = await api(otherPage, "GET", `${SEARCH}?q=${WORD}`);
  step(
    "that person's search finds none of it",
    theirs.status === 200 && Array.isArray(theirs.json.results) && theirs.json.results.length === 0,
    JSON.stringify(theirs.json.results?.map((result) => result.title)),
  );
  await other.close();

  // The rename above went straight to the server: a fresh page holds the drive as it is.
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("12*12+6");
  await page.getByRole("option", { name: "= 150" }).waitFor({ timeout: 5_000 });
  step("a sum is worked out as it is typed", true);
  await field.fill("5 km to miles");
  await page.getByRole("option", { name: "= 3.106855961 miles" }).waitFor({ timeout: 5_000 });
  step("and a unit conversion", true);
  await shot(page, path.join(out, "spotlight-conversion.png"));

  await field.fill(WORD);
  const contact = page.getByRole("option", { name: `${WORD} Journey` });
  await contact.waitFor({ timeout: 10_000 });
  const inGroup = (name, option) =>
    page
      .getByRole("group", { name: new RegExp(`^(?:${name}|Top Hit)$`) })
      .getByRole("option", { name: option })
      .first();
  await inGroup("Files", "Spring plan.txt").waitFor({ timeout: 10_000 });
  step(
    "Spotlight lists the contact, the note, the file and the bookmark in their own groups",
    (await inGroup("Contacts", `${WORD} Journey`).count()) === 1 &&
      (await inGroup("Stickies", `Call ${WORD}`).count()) === 1 &&
      (await inGroup("Files", "Spring plan.txt").count()) === 1 &&
      (await inGroup("Bookmarks & History", `${WORD} on Wikipedia`).count()) === 1 &&
      (await page.getByRole("group", { name: "Search the Web" }).count()) === 1,
  );
  step(
    "the preview shows the contact's email and the application that opens it",
    (await page.getByText("Opens in Contacts").count()) === 1 &&
      (await page.getByText("zephyrine@example.com").count()) >= 1,
  );
  await shot(page, path.join(out, "spotlight-data.png"));

  await field.press("Enter");
  const menus = page.getByRole("menubar").first();
  await page.waitForFunction(
    () => !document.querySelector('[role="combobox"][aria-label="Spotlight Search"]'),
    undefined,
    { timeout: 10_000 },
  );
  const front = await menus.getByRole("menuitem").nth(1).textContent();
  step("Return opens Contacts", front?.trim() === "Contacts", front ?? "");
  await page
    .locator('[data-window-id="contacts"]')
    .getByText("zephyrine@example.com")
    .first()
    .waitFor({
      timeout: 10_000,
    });
  step("on the card that was found", true);
  await shot(page, path.join(out, "spotlight-contact-card.png"));

  // With Command held a file shows in Finder, selected.
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  await field.fill("frost");
  const planOption = page.getByRole("group", { name: /^(?:Files|Top Hit)$/ }).getByRole("option", {
    name: "Spring plan.txt",
  });
  await planOption.waitFor({ timeout: 10_000 });
  await planOption.click();
  await field.press("Meta+Enter");
  await page
    .locator(".mac-window.mac-finder")
    .first()
    .getByText("Spring plan.txt")
    .first()
    .waitFor({
      timeout: 10_000,
    });
  step("Command-Return shows the file in Finder", true);
  await shot(page, path.join(out, "spotlight-reveal.png"));

  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  await field.fill("apollo moon landing");
  const web = page.getByRole("option", { name: "Search the Web for “apollo moon landing”" });
  await web.waitFor({ timeout: 10_000 });
  await field.press("Enter");
  await page.locator('[data-window-id="safari"]').waitFor({ state: "visible", timeout: 10_000 });
  // The server keeps Safari's tabs once a window took the address.
  const tabbed = await page
    .waitForFunction(
      async (url) => {
        const reply = await fetch(url);
        const { tabs: open = [] } = await reply.json();
        return open.some((tab) => tab.includes("search=apollo+moon+landing"));
      },
      TABS,
      { timeout: 10_000, polling: 300 },
    )
    .then(
      () => true,
      () => false,
    );
  step("a web search opens in a new tab of the person's Safari", tabbed);
  await shot(page, path.join(out, "spotlight-web-search.png"));

  const forgot = await api(page, "DELETE", CARDS);
  const now = await api(page, "GET", STICKIES);
  const cleared = await api(page, "PUT", STICKIES, { base: now.json.rev, data: { notes: [] } });
  const deleted = await driveOps(page, [{ op: "delete", id: file }]);
  await api(page, "DELETE", BOOKMARKS);
  await api(page, "DELETE", TABS);
  // One more search: Spotlight forgets the deleted file's words.
  const after = await api(page, "GET", `${SEARCH}?q=${WORD}`);
  step(
    "the journey removes what it wrote",
    forgot.status === 200 &&
      cleared.status === 200 &&
      deleted === 200 &&
      after.status === 200 &&
      (after.json.results ?? []).length === 0,
    JSON.stringify(after.json.results ?? []),
  );
});
