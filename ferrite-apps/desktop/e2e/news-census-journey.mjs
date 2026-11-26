#!/usr/bin/env node
// News census (R5, round 3): one `ok`/`FAIL` line per census id of News, real input only, against `ferrite dev
// --fresh` serving the packed site, signed in as a real account made at the login window. Stories are real: the
// server reads publishers' feeds through its declared `news` egress. When a feed cannot be read, News must say so
// (its status line), which the steps accept as the honest state and note.
//
// Phases: `write` drives every control and leaves a state file; `restart-check` runs after a real same-root
// restart of `ferrite dev` and checks that Saved Stories, History, followed and blocked channels are kept for the
// account and not seen by a second account.
//
//   node e2e/news-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase all|write|restart-check] [--out <dir>] [--headed] [--only <id prefix,...>]

import { execSync } from "node:child_process";
import {
  accountFor,
  api,
  appWindow,
  census,
  closeAppWindow,
  closeMenus,
  crawlMenus,
  launchBrowser,
  loadState,
  openApp,
  options,
  person,
  reloadDesktop,
  saveState,
  shareLanded,
  shot,
} from "./r5-census-kit.mjs";
import { commonRows } from "./r5-common-rows.mjs";

const opts = options();
const { base, out, browserName, phase } = opts;
const c = census("news", opts);
const LIBRARY = "/api/news/library";
const FOLLOWED = ["BBC News", "NPR", "The Guardian", "Ars Technica"];
const TOPICS = [
  "Business",
  "Entertainment",
  "Fashion",
  "Food",
  "Health",
  "Politics",
  "Science",
  "Sports",
  "Technology",
  "Travel",
];
/** A headline: a story button's name, which is never a channel's Follow or Block button. */
const HEADLINE = "/(?!(?:Un)?(?:[Ff]ollow|[Bb]lock) ).{20,}/";
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const meta = (state, role, name, how, expect, persists = "none") => ({
  state,
  role,
  name,
  how,
  expect,
  persists,
});

const news = (page) => appWindow(page, "News");
const sidebar = (page) => news(page).getByRole("navigation", { name: "Channels" });
const storyLinks = (page) => news(page).locator(".mac-news-story-link");
const storyHeading = (page, title) =>
  news(page).getByRole("heading", { level: 2, name: title, exact: true });
const library = async (page) => (await api(page, "GET", LIBRARY)).json?.library ?? null;
const text = async (page) =>
  (
    await news(page)
      .innerText()
      .catch(() => "")
  ).replace(/\s+/g, " ");

/** Open News and wait until it has stopped loading. */
async function openNews(page) {
  const window = await openApp(page, "News");
  await page
    .waitForFunction((frame) => !frame.hasAttribute("aria-busy"), await window.elementHandle(), {
      timeout: 20_000,
    })
    .catch(() => {});
  return window;
}
/** The next PUT of the library whose body passes `accept`. */
const nextSave = (page, accept) => {
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      new URL(r.url()).pathname === LIBRARY &&
      accept(JSON.parse(r.request().postData() ?? "null")?.library),
    { timeout: 15_000 },
  );
  saved.catch(() => {});
  return saved;
};
/** The stories of the view in front once at least one shows, or News's honest word that it has none. */
async function storiesOrStatus(page) {
  const shown = await storyLinks(page)
    .first()
    .waitFor({ timeout: 30_000 })
    .then(
      () => true,
      () => false,
    );
  const titles = shown ? await storyLinks(page).allInnerTexts() : [];
  const said = await text(page);
  const honest =
    /No Stories|could not|can’t|cannot|unavailable|Try Again|blocked this channel|Follow a channel/i.test(
      said,
    );
  return { titles: titles.map((t) => t.trim()).filter(Boolean), honest, said: said.slice(0, 160) };
}
/** Open the story `title` from the view in front; answers once its headline is the story's heading. */
async function openStory(page, title) {
  await news(page).locator(".mac-news-story-link", { hasText: title }).first().click();
  await storyHeading(page, title).waitFor({ timeout: 10_000 });
}
const back = (page) => news(page).getByRole("button", { name: "Back", exact: true }).click();
/** In-run evidence for an outside host: each followed channel's feed host, curled now (the brief's rule). */
function feedEvidence() {
  const hosts = [
    "feeds.bbci.co.uk",
    "feeds.npr.org",
    "www.theguardian.com",
    "feeds.arstechnica.com",
  ];
  return hosts
    .map((host) => {
      try {
        const code = execSync(
          `curl -sS -o /dev/null -w "%{http_code}" --max-time 10 https://${host}/`,
          { encoding: "utf8" },
        );
        return `${host} ${code} at ${new Date().toISOString()}`;
      } catch (error) {
        return `${host} unreachable (${String(error.message).split("\n")[0].slice(0, 80)}) at ${new Date().toISOString()}`;
      }
    })
    .join("; ");
}
/** The rows that need a story to open. */
const STORY_IDS = [
  "news.story.save",
  "news.story.remove-from-saved",
  "news.toolbar.share",
  "news.share.copy-link",
  "news.share.save-story",
  "news.share.mail",
  "news.share.messages",
  "news.share.notes",
  "news.share.reminders",
  "news.share.open-in-safari",
  "news.story.read-full-story",
  "news.toolbar.back",
  "news.sidebar.saved-stories",
  "news.sidebar.history",
  "news.history.clear",
];

async function writePhase(browser, page) {
  const kept = {};
  await openNews(page);
  await c.crawl("window", news(page));

  // ── Today: real headlines from the followed channels' feeds; the first, a middle and the last open ──
  const today = await storiesOrStatus(page);
  await c.check(
    "news.today.stories",
    async () => {
      if (today.titles.length === 0)
        return { ok: today.honest, detail: `no stories; News says "${today.said}"` };
      const picks = [
        ...new Set([0, Math.floor((today.titles.length - 1) / 2), today.titles.length - 1]),
      ].map((i) => today.titles[i]);
      for (const title of picks) {
        await openStory(page, title);
        await back(page);
        await storyLinks(page).first().waitFor({ timeout: 10_000 });
      }
      return {
        ok: true,
        detail: `${today.titles.length} stories; opened ${picks.map((t) => t.slice(0, 30)).join(" | ")}`,
      };
    },
    meta(
      "window",
      "button",
      HEADLINE,
      "click a headline (the first, a middle and the last of Today)",
      "the story opens with its headline as its heading",
    ),
  );
  kept.first = today.titles[0] ?? null;
  await c.check(
    "news.today.from-feeds",
    async () => {
      const feeds = {};
      for (const id of ["bbc", "npr", "guardian", "ars"])
        feeds[id] = await api(page, "GET", `/api/news/sources/${id}`);
      const titles = new Set(
        Object.values(feeds).flatMap((f) => (f.json?.stories ?? []).map((s) => s.title)),
      );
      const read = Object.entries(feeds).map(
        ([id, f]) => `${id}: ${f.status} ${f.json?.stories?.length ?? f.json?.error ?? ""}`,
      );
      const fromFeeds = today.titles.slice(0, 5).every((t) => titles.has(t));
      return { ok: today.titles.length > 0 ? fromFeeds : today.honest, detail: read.join(", ") };
    },
    meta(
      "window",
      "server",
      "Today",
      "read the four followed channels' feeds through the app's API",
      "every headline shown comes from those feeds",
    ),
  );

  // ── A story: Save Story, Read Full Story, the Share menu, Back ──
  // Without a story to open (no feed could be read), each of these rows fails with what News says and the
  // feed hosts curled in the same minute: never a pass, and never a step that times out against nothing.
  if (!kept.first) {
    const evidence = feedEvidence();
    for (const id of STORY_IDS)
      if (c.wanted(id))
        c.row(id, false, `no story to open: News says "${today.said}"; ${evidence}`);
  } else {
    await openStory(page, kept.first);
    await c.crawl("story", news(page));
    await c.check(
      "news.story.save",
      async () => {
        const saved = nextSave(page, (body) => body?.saved?.some((s) => s.title === kept.first));
        await news(page).getByRole("button", { name: "Save Story", exact: true }).click();
        const status = (await saved).status();
        const flipped = await news(page)
          .getByRole("button", { name: "Remove from Saved", exact: true })
          .isVisible();
        return {
          ok: status === 200 && flipped,
          detail: `PUT ${status}; the button now says Remove from Saved: ${flipped}`,
        };
      },
      meta(
        "story",
        "button",
        "Save Story",
        "open a story, click Save Story",
        "kept in Saved Stories on the server; the button says Remove from Saved",
        "restart",
      ),
    );
    await c.check(
      "news.story.remove-from-saved",
      async () => {
        const removed = nextSave(page, (body) => !body?.saved?.some((s) => s.title === kept.first));
        await news(page).getByRole("button", { name: "Remove from Saved", exact: true }).click();
        const status = (await removed).status();
        const again = nextSave(page, (body) => body?.saved?.some((s) => s.title === kept.first));
        await news(page).getByRole("button", { name: "Save Story", exact: true }).click();
        return {
          ok: status === 200 && (await again).status() === 200,
          detail: "removed, then saved again for the persistence checks",
        };
      },
      meta(
        "story",
        "button",
        "Remove from Saved",
        "click Remove from Saved on a saved story",
        "it leaves Saved Stories on the server",
      ),
    );
    const share = async () => {
      await news(page).getByRole("button", { name: "Share" }).click();
      return page.getByRole("menu").last();
    };
    const storyLink = async () => {
      const entry = (await library(page))?.saved?.find((s) => s.title === kept.first);
      return entry?.link ? new URL(entry.link).href : null;
    };
    kept.link = await storyLink();
    await c.check(
      "news.toolbar.share",
      async () => {
        const menu = await share();
        await c.crawl("share menu", menu);
        const rows = (await menu.getByRole("menuitem").allInnerTexts()).map((r) =>
          r.split("\n")[0].trim(),
        );
        await closeMenus(page);
        return {
          ok: rows.includes("Open in Safari") && rows.includes("Copy Link"),
          detail: rows.join(" | "),
        };
      },
      meta(
        "story",
        "button",
        "Share",
        "with a story open, click Share",
        "the Share menu: Open in Safari, Copy Link, the apps, Save Story",
      ),
    );
    await c.check(
      "news.share.copy-link",
      async () => {
        await (await share()).getByRole("menuitem", { name: "Copy Link" }).click();
        const search = news(page).getByRole("searchbox").first();
        await search.click();
        await page.keyboard.press("Control+KeyV");
        const pasted = await search.inputValue();
        await search.fill("");
        if (
          !(await storyHeading(page, kept.first)
            .isVisible()
            .catch(() => false))
        )
          await openStory(page, kept.first);
        return { ok: Boolean(kept.link) && pasted === kept.link, detail: `pasted "${pasted}"` };
      },
      meta(
        "share menu",
        "menuitem",
        "Copy Link",
        "Share > Copy Link, then Control+V in the search field",
        "the story's link is on the clipboard",
      ),
    );
    await c.check(
      "news.share.save-story",
      async () => {
        const removed = nextSave(page, (body) => !body?.saved?.some((s) => s.title === kept.first));
        await (await share()).getByRole("menuitem", { name: "Remove from Saved Stories" }).click();
        const first = (await removed).status();
        const again = nextSave(page, (body) => body?.saved?.some((s) => s.title === kept.first));
        await (await share()).getByRole("menuitem", { name: "Save Story" }).click();
        return {
          ok: first === 200 && (await again).status() === 200,
          detail: "Share > Remove from Saved Stories, then Share > Save Story",
        };
      },
      meta(
        "share menu",
        "menuitem",
        "/Save Story|Remove from Saved Stories/",
        "Share > Remove from Saved Stories, then Share > Save Story",
        "the story leaves and rejoins Saved Stories on the server",
      ),
    );
    for (const [key, row] of [
      ["mail", "Mail"],
      ["messages", "Messages"],
      ["notes", "Notes"],
      ["reminders", "Reminders"],
    ]) {
      await c.check(
        `news.share.${key}`,
        async () => {
          const item = (await share()).getByRole("menuitem", { name: row, exact: true });
          if ((await item.getAttribute("aria-disabled")) === "true") {
            const why = (await item.getAttribute("title")) ?? "";
            await closeMenus(page);
            return { ok: /can’t take a shared link/.test(why), detail: `dimmed: "${why}"` };
          }
          await item.click();
          const landed = await shareLanded(page, key, { title: kept.first, url: kept.link });
          await shot(page, out, `news-share-${key}-${browserName}`);
          await closeAppWindow(page, landed.window);
          await closeAppWindow(page, row);
          await openNews(page);
          if (
            !(await storyHeading(page, kept.first)
              .isVisible()
              .catch(() => false))
          ) {
            await sidebar(page).getByRole("button", { name: "Saved Stories" }).click();
            await openStory(page, kept.first);
          }
          return landed;
        },
        meta("share menu", "menuitem", row, `Share > ${row}`, `${row} opens with the story's link`),
      );
    }
    await c.check(
      "news.share.open-in-safari",
      async () => {
        await (await share()).getByRole("menuitem", { name: "Open in Safari" }).click();
        const safari = appWindow(page, "Safari");
        await safari.waitFor({ state: "visible", timeout: 15_000 });
        const field = safari.getByRole("textbox", { name: "Search or enter website name" });
        let value = "";
        for (let i = 0; i < 40 && value !== kept.link; i += 1) {
          value = await field.inputValue();
          await page.waitForTimeout(250);
        }
        await closeAppWindow(page, "Safari");
        await openNews(page);
        return { ok: value === kept.link, detail: `Safari's field: ${value}` };
      },
      meta(
        "share menu",
        "menuitem",
        "Open in Safari",
        "Share > Open in Safari",
        "Safari opens the story's link in a new tab in front",
      ),
    );
    await c.check(
      "news.story.read-full-story",
      async () => {
        if (
          !(await storyHeading(page, kept.first)
            .isVisible()
            .catch(() => false))
        ) {
          await sidebar(page).getByRole("button", { name: "Saved Stories" }).click();
          await openStory(page, kept.first);
        }
        await news(page).getByRole("button", { name: "Read Full Story" }).click();
        const said = (
          await news(page)
            .locator(".mac-news-actions + .mac-news-status")
            .innerText()
            .catch(() => "")
        ).trim();
        const safari = appWindow(page, "Safari");
        await safari.waitFor({ state: "visible", timeout: 15_000 });
        const field = safari.getByRole("textbox", { name: "Search or enter website name" });
        let value = "";
        for (let i = 0; i < 40 && value !== kept.link; i += 1) {
          value = await field.inputValue();
          await page.waitForTimeout(250);
        }
        await closeAppWindow(page, "Safari");
        await openNews(page);
        return {
          ok: value === kept.link && /Safari/.test(said),
          detail: `News says "${said}"; Safari's field ${value}`,
        };
      },
      meta(
        "story",
        "button",
        "Read Full Story",
        "click Read Full Story",
        "Safari opens the story in a new tab in front; News says so",
      ),
    );
    await c.check(
      "news.toolbar.back",
      async () => {
        if (
          !(await storyHeading(page, kept.first)
            .isVisible()
            .catch(() => false))
        ) {
          await sidebar(page).getByRole("button", { name: "Saved Stories" }).click();
          await openStory(page, kept.first);
        }
        await back(page);
        await storyHeading(page, kept.first).waitFor({ state: "detached", timeout: 5_000 });
        const dimmed = await news(page)
          .getByRole("button", { name: "Back", exact: true })
          .isDisabled();
        return { ok: dimmed, detail: "the story closed; Back is dimmed again" };
      },
      meta("story", "button", "Back", "click Back in a story", "the list again; Back dims"),
    );

    // ── The sidebar: Today, Saved Stories, History, each followed channel, each topic ──
    await c.check(
      "news.sidebar.saved-stories",
      async () => {
        await sidebar(page).getByRole("button", { name: "Saved Stories" }).click();
        const titles = (await storiesOrStatus(page)).titles;
        await c.crawl("saved stories", news(page));
        return { ok: titles.includes(kept.first), detail: `${titles.length} saved` };
      },
      meta(
        "window",
        "button",
        "Saved Stories",
        "click Saved Stories in the sidebar",
        "the saved story is listed",
        "restart",
      ),
    );
    await c.check(
      "news.sidebar.history",
      async () => {
        await sidebar(page).getByRole("button", { name: "History" }).click();
        const titles = (await storiesOrStatus(page)).titles;
        await c.crawl("history", news(page));
        return { ok: titles.includes(kept.first), detail: `${titles.length} in History` };
      },
      meta(
        "window",
        "button",
        "History",
        "click History in the sidebar",
        "the stories opened are listed, newest first",
        "restart",
      ),
    );
    await c.check(
      "news.history.clear",
      async () => {
        const cleared = nextSave(
          page,
          (body) => Array.isArray(body?.history) && body.history.length === 0,
        );
        await news(page).getByRole("button", { name: "Clear History" }).click();
        const status = (await cleared).status();
        const empty = await news(page).getByText("No History").isVisible();
        // Read one story again, so History has something for the persistence checks.
        await sidebar(page).getByRole("button", { name: "Saved Stories" }).click();
        await openStory(page, kept.first);
        await back(page);
        return {
          ok: status === 200 && empty,
          detail: `PUT ${status}; "No History" shown ${empty}`,
        };
      },
      meta(
        "history",
        "button",
        "Clear History",
        "in History, click Clear History",
        "History empties, on the server too",
      ),
    );
  }
  await c.check(
    "news.sidebar.today",
    async () => {
      await sidebar(page).getByRole("button", { name: "Today" }).click();
      const now = await storiesOrStatus(page);
      return { ok: now.titles.length > 0 || now.honest, detail: `${now.titles.length} stories` };
    },
    meta("window", "button", "Today", "click Today in the sidebar", "Today's stories again"),
  );
  await c.check(
    "news.today.more-top-stories",
    async () => {
      await news(page)
        .getByRole("button", { name: /More\s*Top Stories/ })
        .click();
      await news(page)
        .getByRole("heading", { name: "Top Stories" })
        .first()
        .waitFor({ timeout: 10_000 });
      const now = await storiesOrStatus(page);
      return {
        ok: now.titles.length > 5 || now.honest,
        detail: `${now.titles.length} top stories`,
      };
    },
    meta(
      "window",
      "button",
      "More Top Stories",
      "on Today, click More Top Stories",
      "the Top Stories list, longer than Today's five",
    ),
  );
  for (const channel of FOLLOWED) {
    await c.check(
      `news.sidebar.channel-${slug(channel)}`,
      async () => {
        await sidebar(page).getByRole("button", { name: channel, exact: true }).click();
        await news(page)
          .getByRole("heading", { name: channel })
          .first()
          .waitFor({ timeout: 10_000 });
        const now = await storiesOrStatus(page);
        const following = await news(page)
          .getByRole("button", { name: "Unfollow", exact: true })
          .isVisible();
        return {
          ok: (now.titles.length > 0 || now.honest) && following,
          detail: `${now.titles.length} stories; Unfollow shown ${following}`,
        };
      },
      meta(
        "window",
        "button",
        channel,
        `click ${channel} in the sidebar`,
        "the channel's stories, with Unfollow and Block Channel",
      ),
    );
  }
  await c.crawl("channel page", news(page));
  for (const topic of TOPICS) {
    await c.check(
      `news.sidebar.topic-${slug(topic)}`,
      async () => {
        await sidebar(page).getByRole("button", { name: topic, exact: true }).click();
        await news(page).getByRole("heading", { name: topic }).first().waitFor({ timeout: 10_000 });
        const now = await storiesOrStatus(page);
        return {
          ok: now.titles.length > 0 || now.honest,
          detail: now.titles.length ? `${now.titles.length} stories` : `News says "${now.said}"`,
        };
      },
      meta(
        "window",
        "button",
        topic,
        `click ${topic} in the sidebar`,
        "the topic's stories from several publishers, or News's honest word",
      ),
    );
  }

  // ── A channel's page: Unfollow / Follow, Block Channel / Unblock Channel (NPR, restored) ──
  await sidebar(page).getByRole("button", { name: "NPR", exact: true }).click();
  await c.check(
    "news.channel.unfollow-follow",
    async () => {
      const off = nextSave(page, (body) => !body?.following?.includes("npr"));
      await news(page).getByRole("button", { name: "Unfollow", exact: true }).click();
      const first = (await off).status();
      const on = nextSave(page, (body) => body?.following?.includes("npr"));
      await news(page).getByRole("button", { name: "Follow", exact: true }).click();
      return {
        ok: first === 200 && (await on).status() === 200,
        detail: "NPR unfollowed, then followed again",
      };
    },
    meta(
      "channel page",
      "button",
      "/Unfollow|Follow/",
      "on a channel's page, click Unfollow, then Follow",
      "the channel leaves and rejoins the followed channels, on the server",
    ),
  );
  await c.check(
    "news.channel.block-unblock",
    async () => {
      const blocked = nextSave(page, (body) => body?.blocked?.includes("npr"));
      await news(page).getByRole("button", { name: "Block Channel", exact: true }).click();
      const first = (await blocked).status();
      const said = await news(page).getByText("You blocked this channel.").isVisible();
      const followDimmed = await news(page)
        .getByRole("button", { name: /^(Un)?[Ff]ollow$/ })
        .first()
        .isDisabled();
      const unblocked = nextSave(page, (body) => !body?.blocked?.includes("npr"));
      await news(page).getByRole("button", { name: "Unblock Channel", exact: true }).click();
      const second = (await unblocked).status();
      // Blocking unfollows: follow NPR again so Today keeps its four channels.
      const follow = news(page).getByRole("button", { name: "Follow", exact: true });
      if (await follow.isVisible().catch(() => false)) await follow.click();
      return {
        ok: first === 200 && said && followDimmed && second === 200,
        detail: `blocked (says so ${said}, Follow dimmed ${followDimmed}), unblocked`,
      };
    },
    meta(
      "channel page",
      "button",
      "/Block Channel|Unblock Channel/",
      "click Block Channel, then Unblock Channel",
      "blocked: no stories, it says so, Follow is dimmed; unblocked again",
    ),
  );

  // ── Discover Channels: follow NASA, block Ars Technica (kept), a channel's own page ──
  await c.check(
    "news.sidebar.discover",
    async () => {
      await sidebar(page).getByRole("button", { name: "Discover Channels" }).click();
      await news(page).getByRole("button", { name: "Follow NASA" }).waitFor({ timeout: 10_000 });
      await c.crawl("discover", news(page));
      return true;
    },
    meta(
      "window",
      "button",
      "Discover Channels",
      "click Discover Channels in the sidebar",
      "every channel, each with Follow and Block",
    ),
  );
  await c.check(
    "news.discover.follow",
    async () => {
      const followed = nextSave(page, (body) => body?.following?.includes("nasa"));
      await news(page).getByRole("button", { name: "Follow NASA" }).click();
      const status = (await followed).status();
      const listed = await sidebar(page).getByRole("button", { name: "NASA" }).isVisible();
      return {
        ok: status === 200 && listed,
        detail: `PUT ${status}; NASA in the sidebar ${listed}`,
      };
    },
    meta(
      "discover",
      "button",
      "/Follow (?!.*Channel$).+/",
      "in Discover, click Follow NASA",
      "NASA joins the sidebar, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "news.discover.unfollow",
    async () => {
      const off = nextSave(page, (body) => !body?.following?.includes("bbc"));
      await news(page).getByRole("button", { name: "Unfollow BBC News" }).click();
      const first = (await off).status();
      const on = nextSave(page, (body) => body?.following?.includes("bbc"));
      await news(page).getByRole("button", { name: "Follow BBC News" }).click();
      return {
        ok: first === 200 && (await on).status() === 200,
        detail: "BBC News unfollowed, then followed again",
      };
    },
    meta(
      "discover",
      "button",
      "/Unfollow .+/",
      "in Discover, click Unfollow BBC News, then Follow BBC News",
      "it leaves and rejoins the sidebar",
    ),
  );
  await c.check(
    "news.discover.block",
    async () => {
      const blocked = nextSave(
        page,
        (body) => body?.blocked?.includes("ars") && !body.following.includes("ars"),
      );
      await news(page).getByRole("button", { name: "Block Ars Technica" }).click();
      const status = (await blocked).status();
      const gone = !(await sidebar(page)
        .getByRole("button", { name: "Ars Technica" })
        .isVisible()
        .catch(() => false));
      return {
        ok: status === 200 && gone,
        detail: `PUT ${status}; Ars Technica gone from the sidebar ${gone}`,
      };
    },
    meta(
      "discover",
      "button",
      "/Block (?!Channel$).+/",
      "in Discover, click Block Ars Technica",
      "blocked and unfollowed, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "news.discover.unblock",
    async () => {
      const blocked = nextSave(page, (body) => body?.blocked?.includes("nasa"));
      await news(page).getByRole("button", { name: "Block NASA" }).click();
      await blocked;
      const unblocked = nextSave(page, (body) => !body?.blocked?.includes("nasa"));
      await news(page).getByRole("button", { name: "Unblock NASA" }).click();
      const status = (await unblocked).status();
      const follow = nextSave(page, (body) => body?.following?.includes("nasa"));
      await news(page).getByRole("button", { name: "Follow NASA" }).click();
      return {
        ok: status === 200 && (await follow).status() === 200,
        detail: "NASA blocked, unblocked and followed again",
      };
    },
    meta(
      "discover",
      "button",
      "/Unblock (?!Channel$).+/",
      "in Discover, Block NASA then click Unblock NASA",
      "unblocked, kept on the server",
    ),
  );
  await c.check(
    "news.discover.channel",
    async () => {
      const list = news(page).getByRole("list", { name: "Channels" });
      await list.getByRole("button", { name: "NASA", exact: true }).click();
      await news(page).getByRole("heading", { name: "NASA" }).first().waitFor({ timeout: 10_000 });
      const now = await storiesOrStatus(page);
      return { ok: now.titles.length > 0 || now.honest, detail: `${now.titles.length} stories` };
    },
    meta(
      "discover",
      "button",
      "/(NASA|CNN|Reuters|Al Jazeera|The Verge|TechCrunch|Wired|NPR|BBC News|The Guardian|Ars Technica|[A-Z][\\w .&’'-]{1,30})/",
      "in Discover, click a channel's name",
      "the channel's page with its stories",
    ),
  );

  // ── Search, Hide/Show Sidebar ──
  await c.check(
    "news.toolbar.search",
    async () => {
      await sidebar(page).getByRole("button", { name: "Today" }).click();
      const now = await storiesOrStatus(page);
      const word = (now.titles.join(" ").match(/[A-Za-z]{6,}/) ?? ["science"])[0];
      const search = news(page).getByRole("searchbox").first();
      await search.click();
      await page.keyboard.type(word, { delay: 20 });
      await page.waitForTimeout(800);
      const found = (await storyLinks(page).allInnerTexts()).map((t) => t.trim());
      const emptyShown = found.length === 0 && /No (Results|Stories)/.test(await text(page));
      await search.fill("");
      // Each result must hold the word in its headline, publisher or summary (what News's search looks in), and
      // every headline of Today that holds the word must be among the results. The search looks through every
      // feed the window has read (news-live-window.tsx: channels and topics read earlier in this run), so the
      // fields come from every feed of the catalogue, merged per headline (two feeds can carry one story).
      const catalogue = (await api(page, "GET", "/api/news/catalogue")).json ?? {};
      const ids = [
        ...new Set([
          ...(catalogue.channels ?? []).map((channel) => channel.id),
          ...(catalogue.topics ?? []).flatMap((topic) => topic.sources ?? []),
        ]),
      ];
      const feeds = await Promise.all(
        ids.map((id) => api(page, "GET", `/api/news/sources/${encodeURIComponent(id)}`)),
      );
      const fields = new Map();
      for (const feed of feeds) {
        const publisher = feed.json?.source?.publisher ?? "";
        for (const story of feed.json?.stories ?? [])
          fields.set(
            story.title,
            `${fields.get(story.title) ?? ""} ${publisher} ${story.summary ?? ""} ${story.description ?? ""}`,
          );
      }
      const holds = (s) => s.toLowerCase().includes(word.toLowerCase());
      const unmatched = found.filter((t) => !holds(t) && !holds(fields.get(t) ?? ""));
      const missing = now.titles.filter(holds).filter((t) => !found.includes(t));
      const ok = missing.length === 0 && (found.length > 0 ? unmatched.length === 0 : emptyShown);
      return {
        ok,
        detail: `"${word}": ${found.length} found in ${ids.length} feeds; not holding it ${JSON.stringify(unmatched.slice(0, 3))}; headlines holding it but not found ${JSON.stringify(missing.slice(0, 3))}`,
      };
    },
    meta(
      "window",
      "searchbox",
      "Search",
      "type a word of a headline in the search field",
      "only stories holding the word are listed",
    ),
  );
  await c.check(
    "news.toolbar.sidebar",
    async () => {
      await news(page).getByRole("button", { name: "Hide Sidebar" }).click();
      const hidden = !(await sidebar(page)
        .isVisible()
        .catch(() => false));
      await news(page).getByRole("button", { name: "Show Sidebar" }).click();
      const shown = await sidebar(page).isVisible();
      return { ok: hidden && shown, detail: `hidden ${hidden}, shown ${shown}` };
    },
    meta(
      "window",
      "button",
      "/Hide Sidebar|Show Sidebar/",
      "click Hide Sidebar, then Show Sidebar",
      "the sidebar hides and shows",
    ),
  );

  // ── Window chrome and the desktop-filled menu rows ──
  await commonRows(c, page, { id: "news", name: "News" });
  for (const control of (await crawlMenus(page)).rows) c.crawled.push(control);

  // ── After a reload ──
  await c.check(
    "news.persist.reload",
    async () => {
      await reloadDesktop(page);
      await openNews(page);
      return persisted(page, kept);
    },
    meta(
      "window",
      "reload",
      "News library",
      "reload the desktop, open News",
      "NASA followed, Ars Technica not; the story in Saved Stories and History",
      "reload",
    ),
  );
  await isolation(browser, "news.isolation.write");
  return kept;
}

/** What a reload or a restart must keep: the sidebar's channels, Saved Stories and History, on screen and server. */
async function persisted(page, kept) {
  const following = await sidebar(page).getByRole("button").allInnerTexts();
  await sidebar(page).getByRole("button", { name: "Saved Stories" }).click();
  const saved = (await storiesOrStatus(page)).titles;
  await sidebar(page).getByRole("button", { name: "History" }).click();
  const history = (await storiesOrStatus(page)).titles;
  const server = await library(page);
  const channels =
    following.some((t) => t.includes("NASA")) &&
    !following.some((t) => t.includes("Ars Technica")) &&
    server?.following?.includes("nasa") &&
    server?.blocked?.includes("ars");
  // A story is only claimed kept when there was one to keep.
  const stories = Boolean(kept.first) && saved.includes(kept.first) && history.includes(kept.first);
  const ok = channels && stories;
  return {
    ok,
    detail: `NASA ${following.some((t) => t.includes("NASA"))}, Ars ${following.some((t) => t.includes("Ars Technica"))}, ${kept.first ? `saved ${saved.includes(kept.first)}, history ${history.includes(kept.first)}` : "no story was available to keep, so story persistence is untested"}`,
  };
}

async function isolation(browser, id) {
  await c.check(
    id,
    async () => {
      const other = await person(
        browser,
        c,
        base,
        accountFor("news", `b${phase === "restart-check" ? "r" : "w"}`),
        { label: "second account" },
      );
      try {
        const theirs = await api(other, "GET", LIBRARY);
        await openNews(other);
        await appWindow(other, "News")
          .getByRole("navigation", { name: "Channels" })
          .getByRole("button", { name: "Saved Stories" })
          .click();
        const none = await appWindow(other, "News").getByText("No Saved Stories").isVisible();
        const nasa = await appWindow(other, "News")
          .getByRole("navigation", { name: "Channels" })
          .getByRole("button", { name: "NASA" })
          .count();
        return {
          ok: theirs.status === 200 && theirs.json?.library === null && none && nasa === 0,
          detail: `library ${JSON.stringify(theirs.json?.library)}; "No Saved Stories" ${none}; NASA ${nasa}`,
        };
      } finally {
        await other.context().close();
      }
    },
    meta(
      "second account",
      "isolation",
      "News library",
      "sign up a second account in another browser context, read its News library, open Saved Stories",
      "empty: none of the first account's stories or channels",
      "restart",
    ),
  );
}

async function restartPhase(browser) {
  const state = loadState(out, "news", browserName);
  const page = await person(browser, c, base, state.account, { create: false });
  await openNews(page);
  await c.check(
    "news.persist.restart",
    async () => persisted(page, state.kept),
    meta(
      "window",
      "restart",
      "News library",
      "restart ferrite dev on the same root, sign in, open News",
      "NASA followed, Ars Technica not; the story in Saved Stories and History",
      "restart",
    ),
  );
  await isolation(browser, "news.isolation.restart");
}

const browser = await launchBrowser(browserName, { headed: opts.headed });
try {
  if (phase === "restart-check") await restartPhase(browser);
  else {
    const account = accountFor("news", "a");
    const page = await person(browser, c, base, account);
    const kept = await writePhase(browser, page);
    saveState(out, "news", browserName, { account, kept });
  }
} catch (error) {
  c.row("news.run.completed", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  await browser.close();
}
c.finish();
