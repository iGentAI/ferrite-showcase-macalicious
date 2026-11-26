#!/usr/bin/env node
// The small rows of batch 9 on the served desktop. Script Editor: JavaScript's strings, numbers, patterns and
// template strings in their own colours, kept per person across a reload, what a script runs unchanged, and
// Edit > Paste keeping formats until Compile. News: a story's article read through Safari's route and the reason
// when its host is not listed. Storage Management: a row for each app, File Browser, and Unsupported Apps dimmed
// with its reason. About This Mac: two screens, from a real Chromium given two (`--screen-info`). Force Quit with a
// Mail send held by a route stub (the one stand-in, which delays the real request and then lets it through). Today:
// a pin that only reads is asked again, and one that acted is not.
//
//   node e2e/small-rows-batch9-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";
import { createAccount } from "./people-kit.mjs";
import { openWithSpotlight, uploadFile } from "./system-kit.mjs";

const { base, out } = options();
const tag = Date.now().toString(36);
const { step, run } = journey("small-rows-batch9", {
  ignoreOtherOrigins: true,
  launchOptions: { chromium: { args: ["--screen-info={1600x1000}{1280x800}"] } },
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

const setSetting = async (page, key, value) => {
  await page.waitForTimeout(1_500);
  const { json } = await api(page, "GET", "/api/system-preferences/settings");
  await api(page, "PUT", "/api/system-preferences/settings", {
    values: { ...(json.values ?? {}), [key]: value },
    rev: json.rev,
  });
};

async function scriptEditor(page) {
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "script-editor"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  const open = async () => {
    await launch(page, "Script Editor");
    const script = page.getByRole("textbox", { name: "Script", exact: true });
    await script.waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(600);
    const frame = page.locator('.mac-managed-window[data-window-id^="script-editor"]').first();
    await frame.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "JavaScript" }).click();
    await page.waitForTimeout(300);
    return { script, frame };
  };
  const typeIn = async ({ script }, text) => {
    await script.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(text);
  };
  const compile = async ({ frame }) => {
    await frame.getByRole("button", { name: "Compile" }).first().click();
    await page.waitForTimeout(400);
  };
  const colours = ({ script }) =>
    script
      .locator("[data-style]")
      .evaluateAll((nodes) =>
        Object.fromEntries(
          nodes
            .filter((node) =>
              ["string", "number", "pattern", "template"].includes(node.dataset.style),
            )
            .map((node) => [node.dataset.style, [node.textContent, getComputedStyle(node).color]]),
        ),
      );

  const SCRIPT = "const s = 'hi', n = 40, r = /h/g, t = `x`;\nreturn s.length + n; // ";
  let editor = await open();
  await typeIn(editor, SCRIPT);
  await page.evaluate(() =>
    navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob(["<b>pasted bold</b>"], { type: "text/html" }),
        "text/plain": new Blob(["pasted bold"], { type: "text/plain" }),
      }),
    ]),
  );
  await chooseMenu(page, "Edit", "Paste");
  const weight = () =>
    editor.script.evaluate((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeValue.includes("pasted"))
          return getComputedStyle(node.parentElement).fontWeight;
      }
      return "absent";
    });
  step(
    "Script Editor: Edit > Paste keeps the clipboard's bold in the script",
    await until(async () => Number(await weight()) >= 600, 5_000),
    await weight(),
  );
  await compile(editor);
  step(
    "and Compile sets it back in the script's own style",
    Number(await weight()) < 600,
    await weight(),
  );
  const first = await colours(editor);
  step(
    "Compile gives a string, a number, a pattern and a template their own colours",
    JSON.stringify(first) ===
      JSON.stringify({
        string: ["'hi'", "rgb(196, 26, 22)"],
        number: ["40", "rgb(28, 0, 207)"],
        pattern: ["/h/g", "rgb(138, 75, 8)"],
        template: ["`x`", "rgb(162, 33, 127)"],
      }),
    JSON.stringify(first),
  );
  await shot(page, path.join(out, "small-rows-script-styles.png"));
  await editor.frame.getByRole("button", { name: "Run" }).first().click();
  const result = page.getByRole("textbox", { name: "Result" });
  step(
    "and what the script runs is unchanged: 'hi'.length + 40",
    await until(
      async () => (await result.inputValue().catch(async () => result.innerText())).includes("42"),
      10_000,
    ),
  );

  await setSetting(page, "scriptEditor.formatting", { string: "#112233" });
  await reloadDesktop(page);
  editor = await open();
  await typeIn(editor, "const s = 'hi';");
  await compile(editor);
  const after = await colours(editor);
  step(
    "a colour chosen for strings comes back from the server after a reload",
    after.string?.[1] === "rgb(17, 34, 51)",
    JSON.stringify(after),
  );
  await setSetting(page, "scriptEditor.formatting", {});
  await reloadDesktop(page);
  editor = await open();
  await chooseMenu(page, "Script Editor", "Preferences…");
  await page
    .getByRole("button", { name: "Formatting", exact: true })
    .or(page.getByRole("tab", { name: "Formatting" }))
    .first()
    .click();
  for (const name of [
    "JavaScript strings",
    "JavaScript numbers",
    "JavaScript patterns",
    "JavaScript template strings",
  ]) {
    step(
      `Preferences > Formatting has a well for ${name}`,
      (await page.getByLabel(name, { exact: true }).count()) === 1,
    );
  }
  await shot(page, path.join(out, "small-rows-script-formatting.png"));
}

async function news(page) {
  await reloadDesktop(page);
  await launch(page, "News");
  const window = page.getByRole("region", { name: "News", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 20_000 });
  const catalogue = (await api(page, "GET", "/api/news/catalogue")).json;
  const sidebar = window.getByRole("navigation", { name: "Channels" });
  const reader = window.locator('[data-view="reader"]');
  const line = reader.locator("[data-article]");
  const openFirst = async (id) => {
    const channel = catalogue.channels.find((each) => each.id === id);
    const feed = await api(page, "GET", `/api/news/sources/${id}`);
    const story = feed.json.stories?.[0];
    await sidebar.getByRole("button", { name: channel.name, exact: true }).click();
    await window.getByRole("button", { name: story.title, exact: true }).first().click();
    await reader.waitFor({ timeout: 10_000 });
    await until(async () => (await line.getAttribute("data-article")) !== "reading", 12_000);
    return story;
  };
  const back = () =>
    window
      .getByRole("button", { name: /^Back$/ })
      .first()
      .click();

  const elsewhere = await openFirst("guardian");
  const host = new URL(elsewhere.link).host;
  step(
    "News: a story on a host the server does not list says so and shows its feed's words",
    (await line.getAttribute("data-article")) === "none" &&
      (await line.innerText()) ===
        `This desktop’s server reads only the sites it lists, and ${host} is not one of them. This is what the feed says.`,
    await line.innerText(),
  );
  await back();

  const listed = await openFirst("ars");
  const page2 = await api(
    page,
    "GET",
    `/api/safari/page?url=${encodeURIComponent(listed.link)}&private=1`,
  );
  const state = await line.getAttribute("data-article");
  const shown = await reader.locator(".mac-news-paragraph").allInnerTexts();
  const paragraphs = (page2.json.reader ?? [])
    .filter((block) => block.kind === "p")
    .map((block) => block.text);
  if (page2.json.ok && paragraphs.length > 0) {
    step(
      "a story on a listed site opens as its article, every paragraph Safari's reader found",
      state === "ready" && JSON.stringify(shown) === JSON.stringify(paragraphs),
      `${shown.length} paragraphs from ${listed.link}`,
    );
  } else {
    step(
      "a story whose page could not be read says why and keeps its feed's words",
      state === "none" && (await line.innerText()).length > 0,
      `${page2.json.kind ?? "no reader"}: ${await line.innerText()}`,
    );
  }
  await shot(page, path.join(out, "small-rows-news-reader.png"));
  const history = (await api(page, "GET", "/api/safari/history")).json.history ?? [];
  step(
    "reading it left nothing in Safari's History",
    !history.some((each) => each.url === listed.link),
  );
  await back();
}

async function storage(page) {
  await uploadFile(page, {
    parent: "documents",
    name: `Browser ${tag}.txt`,
    type: "text/plain",
    text: "seen in File Browser",
  });
  await reloadDesktop(page);
  await openWithSpotlight(page, "Storage Management");
  let win = page.locator('[data-window-id="storage-management"]');
  await win.waitFor({ timeout: 10_000 });
  await win.getByText(/Ferrite Drive - .* available of /).waitFor({ timeout: 10_000 });
  const row = (name) => win.getByRole("treeitem", { name });
  const usage = (await api(page, "GET", "/api/storage-management/usage")).json;
  const apps = usage.apps.filter((each) => each.bytes > 0);
  const shownRows = (await win.getByRole("treeitem").allInnerTexts()).filter((text) =>
    text.startsWith("Kept by "),
  );
  step(
    "Storage Management has a row for each app the server counts",
    shownRows.length === apps.length &&
      apps.every((each) => shownRows.some((text) => text.startsWith(`Kept by ${each.title}`))),
    shownRows.join(" | ").replace(/\s+/g, " "),
  );
  const countedOnly = apps.find((each) => each.documents.length === 0);
  if (countedOnly) {
    await row(new RegExp(`^Kept by ${countedOnly.title}`)).click();
    await win.getByText(`Everything ${countedOnly.title} keeps`).waitFor({ timeout: 5_000 });
    step(
      `what ${countedOnly.title} only counts has no Delete`,
      (await win.getByRole("button", { name: "Delete…" }).count()) === 0 ||
        (await win.getByRole("button", { name: "Delete…" }).first().isDisabled()),
    );
  }
  await row(/^File Browser/).click();
  const grid = win.getByRole("grid", { name: "File Browser files" });
  await grid.getByText(`Browser ${tag}.txt — Documents`).waitFor({ timeout: 5_000 });
  step("File Browser lists a file of the drive with its folder", true);
  await shot(page, path.join(out, "small-rows-storage-browser.png"));
  const unsupported = row(/^Unsupported Apps/);
  step(
    "Unsupported Apps is dimmed and says why",
    (await unsupported.getAttribute("aria-disabled")) === "true" &&
      (await unsupported.getAttribute("title")) ===
        "A browser runs no Mac applications, so none can be unsupported here.",
    await unsupported.getAttribute("title"),
  );
  await page.waitForTimeout(1_500);
  await reloadDesktop(page);
  await openWithSpotlight(page, "Storage Management");
  win = page.locator('[data-window-id="storage-management"]');
  await win
    .getByRole("grid", { name: "File Browser files" })
    .getByText(`Browser ${tag}.txt — Documents`)
    .waitFor({ timeout: 15_000 });
  step("and the window comes back on File Browser after a reload", true);
}

async function screens(page) {
  const cdp = await page.context().newCDPSession(page);
  const { targetInfo } = await cdp.send("Target.getTargetInfo");
  await cdp.send("Browser.grantPermissions", {
    origin: base,
    browserContextId: targetInfo.browserContextId,
    permissions: ["windowManagement"],
  });
  await reloadDesktop(page);
  await page.getByRole("menubar").getByRole("menuitem", { name: "Apple" }).click();
  await page.getByRole("menuitem", { name: "About This Mac", exact: true }).first().click();
  const window = page.locator('[data-window-id="about-this-mac"]');
  await window.waitFor({ timeout: 10_000 });
  await window.getByRole("tab", { name: "Displays" }).click();
  await window
    .getByText("Screen 2")
    .or(window.getByText(/1280 × 800/))
    .first()
    .waitFor({ timeout: 5_000 });
  const reported = await page.evaluate(async () =>
    (await window.getScreenDetails()).screens.map((each) => `${each.width} × ${each.height}`),
  );
  const text = await window.innerText();
  step(
    "About This Mac lists each of the two screens this Chromium has",
    reported.length === 2 && reported.every((each) => text.includes(each)),
    reported.join(", "),
  );
  await shot(page, path.join(out, "small-rows-two-screens.png"));
  await cdp.detach();
}

async function forceQuit(guest) {
  // A Guest User cannot send mail: this part signs up in a browser context of its own.
  const context = await guest
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const name = `held${tag}`;
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, { name, fullName: `Held ${tag}`, password: `pw-${tag}-held` });
  const subject = `Held send ${tag}`;
  await launch(page, "Mail");
  const mail = page.locator(".mac-mail").first();
  await mail.waitFor({ timeout: 15_000 });
  await mail.getByRole("button", { name: "New Message" }).click();
  const compose = page.locator(".mac-mail-compose").first();
  const to = compose.getByLabel("To:");
  await to.click();
  await to.pressSequentially(name);
  await to.press("Enter");
  await compose.getByLabel("Subject:").fill(subject);

  let release;
  const released = new Promise((resolve) => {
    release = resolve;
  });
  let asked = false;
  const SEND = /\/api\/mail\/send(?:\?|$)/;
  await page.route(SEND, async (route) => {
    asked = true;
    await released;
    await route.continue();
  });
  await compose.getByRole("button", { name: "Send" }).click();
  await until(async () => asked, 5_000);
  step("Force Quit: the send is in flight, held on its way", asked);
  step(
    "the composer stays open while its send is held",
    (await page.locator(".mac-mail-compose").count()) === 1,
  );

  await page.getByRole("menubar").getByRole("menuitem", { name: "Apple" }).click();
  await page.getByRole("menuitem", { name: /^Force Quit/ }).click();
  const quit = page.locator('[data-window-id="force-quit"]');
  await quit.waitFor({ timeout: 5_000 });
  await quit
    .getByRole("listbox", { name: "Applications" })
    .getByRole("option", { name: "Mail", exact: true })
    .click();
  await quit.getByRole("button", { name: "Force Quit", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Force Quit", exact: true }).click();
  step(
    "Force Quit takes the composer and Mail off the desktop without waiting for the send",
    await until(
      async () =>
        (await page.locator(".mac-mail-compose").count()) === 0 &&
        (await page.locator('[data-window-id^="mail"]').count()) === 0,
      5_000,
    ),
  );
  await shot(page, path.join(out, "small-rows-force-quit.png"));
  const sent = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/mail/send",
    { timeout: 10_000 },
  );
  release();
  const status = await sent.then((response) => response.status()).catch(() => 0);
  await page.unroute(SEND);
  const heldIn = async () =>
    ((await api(page, "GET", "/api/mail/messages")).json.messages ?? [])
      .filter((message) => message.subject === subject)
      .map((message) => message.mailbox ?? message.folder ?? JSON.stringify(Object.keys(message)));
  step(
    "the request already on its way still reaches the server and the message is delivered",
    status >= 200 && status < 300 && (await until(async () => (await heldIn()).length > 0, 10_000)),
    `HTTP ${status}, in ${(await heldIn()).join(", ")}`,
  );
  await context.close();
}

async function today(page) {
  const LIVE = "what time is it";
  const ACTED = `Make a note that says Pin ${tag}`;
  await setSetting(page, "today.siriPins", [
    { id: `live-${tag}`, asked: LIVE, text: "words from yesterday" },
    { id: `acted-${tag}`, asked: ACTED, text: "kept as it was" },
  ]);
  const asks = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/siri/ask") asks.push(request.postDataJSON().text);
  });
  await reloadDesktop(page);
  await page.waitForTimeout(1_000);
  step("Today: nothing is asked while it is not shown", asks.length === 0, asks.join());
  await page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  const panel = page.getByRole("complementary", { name: "Notification Center" });
  await panel.waitFor({ timeout: 8_000 });
  await page.getByRole("tab", { name: "Today" }).click();
  const clock = /\d{1,2}:\d{2}/;
  step(
    "a pin that only reads shows today's answer, not the words kept",
    await until(
      async () =>
        (await panel.getByText("words from yesterday").count()) === 0 &&
        (await panel.getByText(clock).count()) > 0,
      10_000,
    ),
  );
  await shot(page, path.join(out, "small-rows-today-pin.png"));
  step(
    "a pin that acted keeps its words and is not asked again",
    (await panel.getByText("kept as it was").count()) === 1 && !asks.includes(ACTED),
    asks.join(),
  );
  const notes = JSON.stringify((await api(page, "GET", "/api/notes/data")).json ?? {});
  step("so no second note was made", !notes.includes(`Pin ${tag}`));
  await setSetting(page, "today.siriPins", []);
  await reloadDesktop(page);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  for (const part of [scriptEditor, news, storage, screens, forceQuit, today]) {
    console.log(`-- ${part.name}`);
    try {
      await part(page);
    } catch (error) {
      step(`${part.name} ran to its end`, false, String(error).split("\n")[0]);
      await shot(page, path.join(out, `small-rows-${part.name}-failed.png`));
    }
  }
});
