#!/usr/bin/env node
// News's menus on Ferrite: the menu bar's commands and their keys, and the contextual menus of a
// story, a channel and a topic, each read back from the server or the window, with real input.
//
//   node e2e/news-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menubar, menuItemState, until } from "./media-census-kit.mjs";

const LIBRARY = "/api/news/library";
const CATALOGUE = /\/api\/news\/catalogue(\?|$)/;
const { base, out } = options();
const { step, run, expectRefusal } = journey("news-depth", { ignoreOtherOrigins: true });
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

const settledShot = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const item = (page, name) => page.getByRole("menuitem", { name, exact: true });

/** Wait until the server's library passes `accept`; it, or `null` after 15 s. */
async function stored(page, accept) {
  for (let waited = 0; waited <= 15_000; waited += 250) {
    const { json } = await api(page, "GET", LIBRARY);
    if (json?.library && accept(json.library)) return json.library;
    await page.waitForTimeout(250);
  }
  return null;
}

await run(async (page) => {
  // ---- Before the channel list is there -------------------------------------------------------
  for (let refusal = 0; refusal < 3; refusal += 1) expectRefusal(503, "/api/news/catalogue");
  let letGo;
  const held = new Promise((resolve) => {
    letGo = resolve;
  });
  await page.route(CATALOGUE, async (route) => {
    await held;
    await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  });
  await openDesktop(page, base, step);
  await launch(page, "News");
  const window = page.getByRole("region", { name: "News", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const whileLoading = await menuItemState(page, "View", "Go to Today");
  step(
    "while the channel list loads, the commands are dimmed and say so",
    whileLoading.disabled && whileLoading.title === "News is still loading.",
    JSON.stringify(whileLoading),
  );
  letGo();
  await window.getByText("News Is Not Available").waitFor({ timeout: 15_000 });
  const whenFailed = await menuItemState(page, "Edit", "Search");
  step(
    "when it could not be read, they say that",
    whenFailed.disabled && whenFailed.title === "News could not read its list of channels.",
    JSON.stringify(whenFailed),
  );
  await page.unroute(CATALOGUE);
  await window.getByRole("button", { name: "Try Again", exact: true }).click();
  const links = window.locator(".mac-news-story-link");
  await links.first().waitFor({ state: "visible", timeout: 40_000 });
  const sidebar = window.getByRole("navigation", { name: "Channels" });
  const reader = window.locator('[data-view="reader"]');
  const stories = () => links.evaluateAll((all) => all.map((link) => link.textContent.trim()));

  // ---- The menu bar ---------------------------------------------------------------------------
  const titles = await menubar(page).getByRole("menuitem").allTextContents();
  step("the menu bar has a Story menu", titles.join(" ").includes("Story"), titles.join(", "));
  const noStory = await menuItemState(page, "Story", "Save Story");
  step(
    "Save Story is dimmed with its reason while no story is open",
    noStory.disabled && noStory.title === "Open a story first.",
    JSON.stringify(noStory),
  );

  // Keys taken while the focus is outside the window: the Dock's click left it there.
  let pageLoads = 0;
  page.on("load", () => {
    pageLoads += 1;
  });
  const reads = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/news/sources/")) reads.push(request.url());
  });
  const outside = await page.evaluate(
    () => !document.activeElement?.closest?.('[data-window-id="news"]'),
  );
  await page.keyboard.press(`${COMMAND}+r`);
  await page.waitForTimeout(1_000);
  step(
    "Command-R reads the feeds again and does not reload the desktop",
    reads.length >= 4 && pageLoads === 0,
    `${reads.length} reads, ${pageLoads} page loads, focus outside the window: ${outside}`,
  );
  reads.length = 0;
  await chooseMenu(page, "View", "Reload");
  await page.waitForTimeout(1_000);
  step("View > Reload reads the feeds again", reads.length >= 4, `${reads.length} reads`);

  await page.keyboard.press(`${COMMAND}+Alt+s`);
  await sidebar.waitFor({ state: "detached", timeout: 5_000 });
  step("Option-Command-S hides the sidebar", true);
  await chooseMenu(page, "View", "Show Sidebar");
  await sidebar.waitFor({ state: "visible", timeout: 5_000 });
  step("View > Show Sidebar shows it", true);

  await page.keyboard.press(`${COMMAND}+f`);
  const search = window.getByRole("searchbox").first();
  step(
    "Command-F puts the keyboard in the search field",
    await search.evaluate((field) => field === document.activeElement),
  );
  await window.locator(".mac-news-masthead").click();
  await chooseMenu(page, "Edit", "Search");
  await page.waitForTimeout(500);
  step(
    "Edit > Search puts the keyboard in the search field",
    await search.evaluate((field) => field === document.activeElement),
  );
  await window.locator(".mac-news-masthead").click();

  // Save and Back on a story.
  const first = (await stories())[0];
  await links.first().click();
  await reader.waitFor({ timeout: 10_000 });
  await page.keyboard.press(`${COMMAND}+s`);
  const savedByKey = await stored(page, (library) => library.saved[0]?.title === first);
  step("Command-S saves the story on the server", savedByKey !== null, first);
  await page.getByRole("button", { name: "Remove from Saved" }).waitFor({ timeout: 5_000 });

  await menubar(page).getByRole("menuitem", { name: "Story", exact: true }).first().click();
  await item(page, "Open in Safari").waitFor({ timeout: 5_000 });
  await settledShot(page, "news-story-menu.png");
  await closeMenus(page);

  await chooseMenu(page, "Story", "Remove from Saved Stories");
  step(
    "Story > Remove from Saved Stories removes it on the server",
    (await stored(page, (library) => library.saved.length === 0)) !== null,
  );
  await chooseMenu(page, "Story", "Save Story");
  step(
    "Story > Save Story keeps it on the server",
    (await stored(page, (library) => library.saved[0]?.title === first)) !== null,
  );

  await chooseMenu(page, "File", "Share Story", "Copy Link");
  await page.waitForTimeout(300);
  await search.click();
  await page.keyboard.press(`${COMMAND}+v`);
  const shared = await search.inputValue();
  step(
    "File > Share Story > Copy Link copies the story's link",
    /^https?:\/\//.test(shared),
    shared,
  );
  await search.fill("");
  await page.waitForTimeout(200);

  // Searching closed the reader: open the story again from Saved Stories.
  await sidebar.getByRole("button", { name: "Saved Stories", exact: true }).click();
  await links.first().click();
  await reader.waitFor({ timeout: 10_000 });

  await page.keyboard.press(`${COMMAND}+BracketLeft`);
  await reader.waitFor({ state: "detached", timeout: 5_000 });
  step("Command-[ goes back from the story to the list", true);
  await links.first().click();
  await reader.waitFor({ timeout: 10_000 });
  await chooseMenu(page, "View", "Go Back");
  await reader.waitFor({ state: "detached", timeout: 5_000 });
  step("View > Go Back goes back", true);

  await chooseMenu(page, "View", "Go to Today");
  await window.locator(".mac-news-masthead").waitFor({ timeout: 5_000 });
  step("View > Go to Today shows Today", true);

  // Follow and Block act on the channel of the page shown, and on the open story's.
  const noChannel = await menuItemState(page, "File", "Follow Channel");
  step(
    "Follow Channel is dimmed on Today with its reason",
    noChannel.disabled && noChannel.title === "Open a story or a channel first.",
    JSON.stringify(noChannel),
  );
  await sidebar.getByRole("button", { name: "Discover Channels", exact: true }).click();
  await window.getByRole("button", { name: "NASA", exact: true }).click();
  await chooseMenu(page, "File", "Follow Channel");
  step(
    "File > Follow Channel follows the channel shown, on the server",
    (await stored(page, (library) => library.following.includes("nasa"))) !== null,
  );
  await sidebar.getByRole("button", { name: "NASA", exact: true }).waitFor({ timeout: 5_000 });
  await chooseMenu(page, "File", "Unfollow Channel");
  step(
    "File > Unfollow Channel unfollows it",
    (await stored(page, (library) => !library.following.includes("nasa"))) !== null,
  );
  await chooseMenu(page, "Story", "Block Channel");
  step(
    "Story > Block Channel blocks it",
    (await stored(page, (library) => library.blocked.includes("nasa"))) !== null,
  );
  await window.getByText("You blocked this channel.").waitFor({ timeout: 5_000 });
  const follow = await menuItemState(page, "File", "Follow Channel");
  step(
    "a blocked channel cannot be followed, and the row says why",
    follow.disabled && follow.title === "Unblock this channel to follow it.",
    JSON.stringify(follow),
  );
  await chooseMenu(page, "Story", "Unblock Channel");
  step(
    "Story > Unblock Channel unblocks it",
    (await stored(page, (library) => library.blocked.length === 0)) !== null,
  );

  // Open in Safari from the menu: Safari opens for it, at the story's link.
  await sidebar.getByRole("button", { name: "Saved Stories", exact: true }).click();
  await links.first().click();
  await reader.waitFor({ timeout: 10_000 });
  await menubar(page).getByRole("menuitem", { name: "View", exact: true }).first().click();
  await item(page, "Go to Today").waitFor({ timeout: 5_000 });
  await settledShot(page, "news-view-menu.png");
  await closeMenus(page);
  const ofStory = await menuItemState(page, "File", "Unfollow Channel");
  step(
    "with a story open, Follow Channel acts on the story's channel, which is followed",
    !ofStory.disabled,
    JSON.stringify(ofStory),
  );
  await menubar(page).getByRole("menuitem", { name: "File", exact: true }).first().click();
  await item(page, "Share Story").hover();
  await item(page, "Copy Link").waitFor({ timeout: 5_000 });
  await settledShot(page, "news-file-menu.png");
  await closeMenus(page);
  await menubar(page).getByRole("menuitem", { name: "Edit", exact: true }).first().click();
  await item(page, "Search").waitFor({ timeout: 5_000 });
  await settledShot(page, "news-edit-menu.png");
  await closeMenus(page);
  await chooseMenu(page, "Story", "Open in Safari");
  const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  const address = safari
    .getByRole("textbox", { name: "Search or enter website name" })
    .or(safari.getByRole("combobox", { name: "Search or enter website name" }))
    .first();
  await until(async () => (await address.inputValue()) !== "", 10_000);
  const opened = await address.inputValue();
  step("Story > Open in Safari opens the story's link in Safari", opened === shared, opened);
  await page.keyboard.press(`${COMMAND}+Shift+w`);
  await safari.waitFor({ state: "detached", timeout: 5_000 });
  await window.locator(".mac-news-title").first().click();
  await page.keyboard.press(`${COMMAND}+BracketLeft`);
  await reader.waitFor({ state: "detached", timeout: 5_000 });

  // ---- A story's menu -------------------------------------------------------------------------
  // Each is picked from the menu of a card on Today, read by role before the menu hides the window.
  await sidebar.getByRole("button", { name: "Today", exact: true }).click();
  await links.nth(2).waitFor({ timeout: 15_000 });
  const shown = await stories();
  const [onOpen, onSave] = [shown[1], shown[2]];
  const card = (name) => window.getByRole("button", { name, exact: true }).first();

  await card(onSave).click({ button: "right" });
  await item(page, "Open Story").waitFor({ timeout: 5_000 });
  await settledShot(page, "news-card-menu.png");
  await item(page, "Save Story").click();
  step(
    "a card's menu saves the story on the server",
    (await stored(page, (library) => library.saved.some((each) => each.title === onSave))) !== null,
    onSave,
  );
  await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);
  step("saving from the menu leaves the list shown", (await reader.count()) === 0);

  await card(onOpen).click({ button: "right" });
  await item(page, "Copy Link").click();
  await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);
  await page.waitForTimeout(300);
  await search.click();
  await page.keyboard.press(`${COMMAND}+v`);
  const copied = await search.inputValue();
  const sources = await Promise.all(
    ["bbc", "npr", "guardian", "ars"].map((id) => api(page, "GET", `/api/news/sources/${id}`)),
  );
  const link = sources
    .flatMap(({ json }) => json?.stories ?? [])
    .find((each) => each.title === onOpen)?.link;
  step(
    "a card's menu copies the story's link",
    Boolean(link) && copied === new URL(link).href,
    copied,
  );
  await search.fill("");
  await page.waitForTimeout(200);

  await card(onOpen).click({ button: "right" });
  await item(page, "Share").hover();
  await item(page, "Mail").waitFor({ timeout: 5_000 });
  step("a card's menu shares the story", await item(page, "Notes").isVisible());
  await closeMenus(page);

  await card(onOpen).click({ button: "right" });
  await item(page, "Open Story").click();
  await reader.waitFor({ timeout: 10_000 });
  step(
    "Open Story opens it, and History keeps it",
    (await stored(page, (library) => library.history[0]?.title === onOpen)) !== null,
    onOpen,
  );
  await page.keyboard.press(`${COMMAND}+BracketLeft`);
  await reader.waitFor({ state: "detached", timeout: 5_000 });

  // ---- Removing one row -----------------------------------------------------------------------
  await sidebar.getByRole("button", { name: "History", exact: true }).click();
  await card(onOpen).click({ button: "right" });
  await item(page, "Remove from History").waitFor({ timeout: 5_000 });
  await settledShot(page, "news-history-menu.png");
  const before = (await api(page, "GET", LIBRARY)).json.library.history.length;
  await item(page, "Remove from History").click();
  const after = await stored(
    page,
    (library) => !library.history.some((each) => each.title === onOpen),
  );
  step(
    "Remove from History removes that row and no other",
    after !== null && after.history.length === before - 1,
    `${before} to ${after?.history.length}`,
  );
  await card(onOpen).waitFor({ state: "detached", timeout: 5_000 });

  await sidebar.getByRole("button", { name: "Saved Stories", exact: true }).click();
  await card(onSave).click({ button: "right" });
  await item(page, "Remove from Saved Stories").click();
  const savedAfter = await stored(
    page,
    (library) => !library.saved.some((each) => each.title === onSave),
  );
  step(
    "Remove from Saved Stories removes that row and keeps the other",
    savedAfter !== null && savedAfter.saved.length === 1,
    savedAfter?.saved.map((each) => each.title).join(" | "),
  );
  await card(onSave).waitFor({ state: "detached", timeout: 5_000 });

  // ---- A channel's and a topic's menu ---------------------------------------------------------
  const channelRow = (name) => sidebar.getByRole("button", { name, exact: true });
  await channelRow("NPR").click({ button: "right" });
  await item(page, "Unfollow Channel").waitFor({ timeout: 5_000 });
  await settledShot(page, "news-channel-menu.png");
  await item(page, "Unfollow Channel").click();
  step(
    "a channel row's menu unfollows it on the server",
    (await stored(page, (library) => !library.following.includes("npr"))) !== null,
  );
  await channelRow("NPR").waitFor({ state: "detached", timeout: 5_000 });

  await channelRow("Ars Technica").click({ button: "right" });
  await item(page, "Block Channel").click();
  step(
    "a channel row's menu blocks it on the server, and it leaves the sidebar",
    (await stored(
      page,
      (library) => library.blocked.includes("ars") && !library.following.includes("ars"),
    )) !== null,
  );
  await channelRow("Ars Technica").waitFor({ state: "detached", timeout: 5_000 });

  await channelRow("BBC News").click({ button: "right" });
  await item(page, "Open Channel").click();
  await window.getByRole("heading", { level: 2, name: "BBC News", exact: true }).waitFor({
    timeout: 5_000,
  });
  step("Open Channel shows the channel", true);

  await channelRow("Science").click({ button: "right" });
  await item(page, "Open Topic").waitFor({ timeout: 5_000 });
  await settledShot(page, "news-topic-menu.png");
  const topicRow = item(page, "Unfollow Topic");
  step("a topic can be unfollowed", (await topicRow.getAttribute("aria-disabled")) !== "true");
  reads.length = 0;
  await item(page, "Reload Topic").click();
  await page.waitForTimeout(1_000);
  step("Reload Topic reads the topic's feeds", reads.length > 0, `${reads.length} reads`);
  await channelRow("Science").click({ button: "right" });
  await item(page, "Open Topic").click();
  await window.getByRole("heading", { level: 2, name: "Science", exact: true }).waitFor({
    timeout: 5_000,
  });
  step("Open Topic shows the topic", true);
});

process.exit(0);
