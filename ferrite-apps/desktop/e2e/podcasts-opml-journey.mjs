#!/usr/bin/env node
// Podcasts on Ferrite: File > Import Shows from OPML follows the feeds a file lists, on real feeds,
// says which it could not read and keeps them across a reload; Export writes the list to Downloads,
// read back from the drive; a file that is not OPML is refused. It runs in a fresh browser signed in
// as a new Guest User, so the library it changes is that guest's own.
//
//   node e2e/podcasts-opml-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("podcasts-opml", { ignoreOtherOrigins: true });
const LIBRARY = "/api/podcasts/library";
const FEEDS = [
  "https://feeds.npr.org/510289/podcast.xml",
  "https://feeds.npr.org/510318/podcast.xml",
];
const REFUSED = "https://example.com/feed.xml";
const THIRD = "https://feeds.npr.org/381444908/podcast.xml";
const FOURTH = "https://feeds.npr.org/344098539/podcast.xml";

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Podcasts");
  const window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const picker = window.locator('input[type="file"][aria-label="Import Shows from OPML"]');
  const fileOf = (name, text) => {
    const file = path.join(out, name);
    writeFileSync(file, text);
    return file;
  };

  const empty = await menuItemState(page, "File", "Export Shows as OPML…");
  step("Export is dimmed with no shows, saying why", empty.disabled === true, empty.title ?? "");
  const account = await menuItemState(page, "Account", "Sign In…");
  step("Account > Sign In is dimmed, saying why", account.disabled === true, account.title ?? "");

  await picker.setInputFiles(fileOf("not-opml.opml", "this is not a list"));
  await window.getByText(/lists no shows/).waitFor({ timeout: 5_000 });
  step("a file that is not OPML is refused, saying why", true);

  expectRefusal(400, "/api/podcasts/feed");
  await picker.setInputFiles(
    fileOf(
      "subscriptions.opml",
      `<opml version="1.1"><body><outline text="Folder"><outline xmlUrl="${FEEDS[0]}"/><outline xmlUrl="${FEEDS[1]}"/><outline xmlUrl="${REFUSED}"/></outline></body></opml>`,
    ),
  );
  await window.getByText(/2 shows added\. 1 could not be read here\./).waitFor({ timeout: 45_000 });
  step("importing follows the feeds it can read and says what it could not", true);
  await shot(page, path.join(out, "podcasts-opml-imported.png"));
  await page.waitForTimeout(1_000);

  // Room for one more, an unreadable feed first: the readable one after it still gets the place.
  const before = (await api(page, "GET", LIBRARY)).json;
  const filler = before.library.shows[0];
  const LIMIT = 100;
  // Stand-ins so the window's refresh of the padding asks no publisher; every other feed is real.
  await page.route(/\/api\/podcasts\/feed\?.*filler-/, (route) =>
    route.fulfill({
      json: { feed: { title: "Filler", episodes: [] }, stale: false, error: null },
    }),
  );
  const padded = Array.from({ length: LIMIT - 3 }, (_, at) => ({
    ...filler,
    id: `filler-${at}`,
    feed: `https://feeds.npr.org/filler-${at}`,
  }));
  const put = await api(page, "PUT", LIBRARY, {
    library: { ...before.library, shows: [...before.library.shows, ...padded] },
    rev: before.rev,
  });
  step(
    "the journey fills the library to one short of the limit",
    put.status === 200,
    `${put.status}`,
  );
  await reloadDesktop(page);
  await launch(page, "Podcasts");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  expectRefusal(400, "/api/podcasts/feed");
  await picker.setInputFiles(
    fileOf(
      "one-place.opml",
      `<opml version="1.1"><body><outline xmlUrl="${REFUSED}"/><outline xmlUrl="${THIRD}"/><outline xmlUrl="${FOURTH}"/></body></opml>`,
    ),
  );
  await window
    .getByText(/1 show added\. 1 could not be read here\. 1 left out/)
    .waitFor({ timeout: 45_000 });
  await page.waitForTimeout(1_000);
  const full = (await api(page, "GET", LIBRARY)).json.library;
  step(
    "with one place left, an unreadable feed does not take it, and the limit holds",
    full.shows.length === LIMIT && full.shows.some((each) => each.feed === THIRD),
    `${full.shows.length} shows`,
  );
  await api(page, "PUT", LIBRARY, {
    library: { ...full, shows: full.shows.filter((each) => !each.id.startsWith("filler-")) },
    rev: (await api(page, "GET", LIBRARY)).json.rev,
  });

  await reloadDesktop(page);
  const stored = (await api(page, "GET", LIBRARY)).json.library;
  step(
    "both shows are kept across a reload",
    FEEDS.every((feed) => stored?.shows?.some((show) => show.feed === feed)),
    stored?.shows?.map((show) => show.title).join(", "),
  );

  await launch(page, "Podcasts");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await chooseMenu(page, "File", "Export Shows as OPML…");
  await window.getByText(/were saved as “.*” in Downloads/).waitFor({ timeout: 15_000 });
  await shot(page, path.join(out, "podcasts-opml-exported.png"));
  const exported = await page.evaluate(async () => {
    const find = (value) => {
      if (Array.isArray(value)) return value.map(find).find(Boolean);
      if (value && typeof value === "object")
        return value.name === "Podcasts Subscriptions.opml"
          ? value
          : Object.values(value).map(find).find(Boolean);
      return undefined;
    };
    const entry = find(await fetch("/api/files/").then((reply) => reply.json()));
    if (!entry) return "";
    const reply = await fetch(`/api/files/content/${encodeURIComponent(entry.id)}?piece=0&count=8`);
    return reply.text();
  });
  step(
    "Export writes an OPML file to Downloads that lists the followed shows, read back from the drive",
    exported.includes("<opml") && [...FEEDS, THIRD].every((feed) => exported.includes(feed)),
    exported.slice(0, 60),
  );
});

process.exit(0);
