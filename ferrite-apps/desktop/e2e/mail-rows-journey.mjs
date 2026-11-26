#!/usr/bin/env node
// Mail's menu rows on Ferrite, in a real browser against the running app: each item of the Mail, File, Edit,
// View, Mailbox and Message menus that had no check of its own, as far as Redirect, is chosen and what it
// changed is read back, from the server where it stores something. mail-rows-more-journey holds the rest of
// Message and the Window menu. Chris and Ann write to Martin; everything else happens in Martin's Mail. Exits
// 0 only when every step passed and no page logged a console error, a page error, a failed request or an
// HTTP error.
//
//   node e2e/mail-rows-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//   ONLY=file,edit node e2e/mail-rows-journey.mjs     # the setup and the sections named

import { readFile } from "node:fs/promises";
import { sameDownloadName } from "./journey-kit.mjs";
import {
  allOnServer,
  arrive,
  choose,
  closePreferences,
  compose,
  mailboxRow,
  menuPath,
  onServer,
  openPane,
  preferences,
  row,
  rows,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot, browserName, allow } = twoPeople("mail-rows");
// A second page of Martin's, reading as a Mac, writes the same settings as his first while it is open.
let macOpen = false;
allow({ test: (text) => macOpen && /status of 409|HTTP 409: .*\/settings/.test(text) });
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mrchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mrmartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `mrann-${id}`, fullName: `Ann ${id}`, password };
const [alpha, bravo, charlie, delta, echo, foxtrot] = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
].map((word) => `${word} ${id}`);
const long = Array.from({ length: 200 }, (_, line) =>
  line === 190 ? "The needle and a heron are here" : `Line ${line} of the text`,
).join("\n");
const only = process.env.ONLY?.split(",") ?? ["mail", "file", "edit", "view", "mailbox", "message"];

const seen = (check, ms = 8_000) => within(ms, check).then((took) => took !== null);
const settle = (page) => page.waitForTimeout(250);
const menu = async (page, ...path) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: path[0], exact: true })
    .first()
    .click();
  for (const name of path.slice(1)) {
    const depth = await page.getByRole("menu").count();
    const open = page.getByRole("menu").last();
    await open
      .getByRole("menuitem", { name })
      .or(open.getByRole("menuitemcheckbox", { name }))
      .first()
      .click();
    // A submenu opens a moment after its row is clicked: the next name is looked for in it.
    if (name !== path.at(-1)) {
      await within(3_000, async () => (await page.getByRole("menu").count()) > depth);
    }
  }
  await settle(page);
};
const windowOf = (page, windowId) => page.locator(`[data-window-id="${windowId}"]`);
const stateOf = (page, windowId) =>
  windowOf(page, windowId).locator("[data-window-state]").first().getAttribute("data-window-state");
const hidden = (page, windowId) =>
  windowOf(page, windowId).evaluate(
    (shell) =>
      shell.hasAttribute("data-minimized") &&
      getComputedStyle(shell.firstElementChild).visibility === "hidden",
  );
const inFront = (page, windowId) =>
  windowOf(page, windowId).evaluate((shell) => !shell.hasAttribute("data-minimized"));
const dockTile = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });
const minimizedTiles = (page) =>
  page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: /minimized window/ })
    .count();
const box = (locator) =>
  locator.evaluate((el) => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x, y, width, height };
  });
const goTo = async (page, name) => {
  await mailboxRow(page, name).getByText(name, { exact: true }).first().click();
  await settle(page);
};
const server = async (page, subject, mailbox) => {
  const all = await allOnServer(page);
  return all.find(
    (each) =>
      each.subject === subject && (mailbox ? each.mailbox === mailbox : each.mailbox !== "drafts"),
  );
};
const fieldOf = (page, label) =>
  compose(page).getByRole("listbox", { name: `${label} recipients` });
const closeCompose = async (page) => {
  await compose(page).getByRole("button", { name: "Close" }).first().click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^(Save|Delete|Discard|Don.t Save)/ })
    .first()
    .click({ timeout: 500 })
    .catch(() => {});
  await within(10_000, async () => (await compose(page).count()) === 0);
  await settle(page);
};
const composing = async (page, subject) =>
  (await seen(() => compose(page).isVisible())) &&
  (await seen(async () => (await compose(page).getByLabel("Subject:").inputValue()) === subject));
const download = async (page, act) => {
  const [file] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), act()]);
  return { name: file.suggestedFilename(), text: await readFile(await file.path(), "utf8") };
};
const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText());
const selectWords = (page, words) =>
  viewer(page)
    .locator(".mac-mail-message-content")
    .getByText(words)
    .first()
    .evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const at = text.nodeValue.indexOf(wanted);
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(text, at);
        range.setEnd(text, at + wanted.length);
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      throw new Error(`no ${wanted} in the message`);
    }, words);
const findField = (page) => viewer(page).getByRole("searchbox", { name: "Find in Message" });
const findSays = (page, text) =>
  seen(
    async () =>
      (await viewer(page).locator(".mac-mail-find").getByRole("status").innerText()).trim() ===
      text,
  );
const paneTop = (page) =>
  viewer(page)
    .locator(".mac-mail-find-text .mac-scroll-view-viewport")
    .first()
    .evaluate((el) => el.scrollTop);
const paneToTop = (page) =>
  viewer(page)
    .locator(".mac-mail-find-text .mac-scroll-view-viewport")
    .first()
    .evaluate((el) => {
      el.scrollTop = 0;
    });
const printedPage = async (page, act) => {
  await page.evaluate(() => {
    window.printedPage = "";
    window.printWatch?.disconnect();
    window.printWatch = new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    });
    window.printWatch.observe(document.body, { childList: true });
  });
  await act();
  let html = "";
  await within(10_000, async () => {
    html = await page.evaluate(() => window.printedPage);
    return html !== "";
  });
  return html;
};

/** One section: a failure is its step's, and the next section still runs from a calm window. */
const section = async (page, name, body) => {
  if (!only.includes(name)) return;
  try {
    await body();
  } catch (error) {
    step(`section ${name} ran to its end`, false, String(error.message).split("\n")[0]);
    await shot(page, `mail-rows-failed-${name}`);
    await page.keyboard.press("Escape").catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    for (const each of await compose(page).all()) {
      await each
        .getByRole("button", { name: "Close" })
        .first()
        .click({ timeout: 2_000 })
        .catch(() => {});
    }
  }
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const c = await person("ann", ann);
  const b = await person("martin", martin);
  for (const page of [a, c, b]) page.setDefaultTimeout(10_000);
  await b.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const mail = async (subject, text, cc = []) => {
    const sent = await a.request.post(new URL("/api/mail/send", a.url()).href, {
      headers: { "idempotency-key": `rows-${id}-${subject}`, "x-requested-with": "macalicious" },
      data: { to: [martin.name], cc, subject, text },
    });
    if (!sent.ok()) throw new Error(`${subject} did not go: ${sent.status()}`);
  };
  await mail(alpha, `The text of ${alpha}`);
  await mail(bravo, `The text of ${bravo}`);
  await mail(charlie, `The text of ${charlie}`, [ann.name]);
  await mail(delta, long);
  await mail(echo, `The text of ${echo}`);
  await mail(foxtrot, `The text of ${foxtrot}`);
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  await arrive(b, async () => (await rows(b).count()) === 6);
  const calm = async () => {
    await goTo(b, "Inbox");
    await row(b, alpha).click();
    await settle(b);
  };

  await section(b, "mail", async () => {
    await menu(b, "Mail", /^About Mail/);
    const about = b.locator('.mac-desktop-shell-about[data-app="mail"]');
    step(
      "About Mail shows Mail's name and version",
      (await seen(() => about.isVisible())) && /Mail[\s\S]*10\.15/.test(await about.innerText()),
    );
    await shot(b, "mail-rows-about");
    await about.getByRole("button", { name: "Close" }).first().click();

    await menu(b, "Mail", /^Preferences/);
    step(
      "Preferences… ⌘, opens Mail's Preferences window",
      await seen(() => preferences(b).isVisible()),
    );
    await closePreferences(b);
    await seen(async () => (await preferences(b).count()) === 0);

    await dockTile(b, "Calculator").click();
    await windowOf(b, "calculator").waitFor({ timeout: 10_000 });
    await settle(b);
    await dockTile(b, "Mail").click();
    await seen(() => b.getByRole("menubar").getByText("Mail", { exact: true }).first().isVisible());
    await settle(b);
    await menu(b, "Mail", "Hide Others");
    step(
      "Hide Others ⌥⌘H hides Calculator and leaves Mail",
      (await seen(() => hidden(b, "calculator"))) && (await inFront(b, "mail")),
    );
    await shot(b, "mail-rows-hide-others");
    await menu(b, "Mail", "Show All");
    step("Show All brings Calculator back", await seen(() => inFront(b, "calculator")));
    await dockTile(b, "Mail").click();
    await settle(b);
    await menu(b, "Mail", "Hide Mail");
    step(
      "Hide Mail ⌘H takes Mail's window away, with no tile of its own",
      (await seen(() => hidden(b, "mail"))) && (await minimizedTiles(b)) === 0,
    );
    await dockTile(b, "Mail").click();
    await seen(() => inFront(b, "mail"));
    await settle(b);
    await dockTile(b, "Calculator").click();
    await settle(b);
    await windowOf(b, "calculator").getByRole("button", { name: "Close" }).first().click();
    await dockTile(b, "Mail").click();
    await settle(b);
    await calm();
  });

  await section(b, "file", async () => {
    await menu(b, "File", /^New Message/);
    step("File > New Message ⌘N opens a New Message", await seen(() => compose(b).isVisible()));
    await closeCompose(b);

    await calm();
    const eml = await download(b, () => menuPath(b, "File", /^Save As/));
    step(
      "Save As… ⇧⌘S gives one message as an .eml, with its text",
      sameDownloadName(eml.name, `${alpha}.eml`, browserName) &&
        eml.text.includes(`Subject: ${alpha}`) &&
        eml.text.includes(`The text of ${alpha}`),
      eml.name,
    );
    await row(b, bravo).click({ modifiers: ["Control"] });
    const mbox = await download(b, () => menuPath(b, "File", /^Save As/));
    step(
      "Save As… gives several as an mbox, with each one's text",
      /\.mbox$/.test(mbox.name) &&
        mbox.text.includes(`The text of ${alpha}`) &&
        mbox.text.includes(`The text of ${bravo}`),
      mbox.name,
    );
    await row(b, alpha).click();
    const pdf = await printedPage(b, () => menuPath(b, "File", /^Export as PDF/));
    step(
      "Export as PDF… hands the browser the message's page to save",
      pdf.includes(alpha) && pdf.includes(`The text of ${alpha}`) && pdf.includes(chris.fullName),
    );
    const sheet = await b.context().newPage();
    await sheet.setContent(pdf);
    await sheet.setViewportSize({ width: 816, height: 500 });
    await shot(sheet, "mail-rows-export-pdf");
    await sheet.close();

    // With Option held the File menu's first row is Close All, as on a Mac.
    await viewer(b).getByRole("button", { name: "New Message" }).click();
    await compose(b).getByLabel("Subject:").fill(`Kept by Close All ${id}`);
    await b.keyboard.down("Alt");
    await b
      .getByRole("menubar")
      .getByRole("menuitem", { name: "File", exact: true })
      .first()
      .click();
    const rowClose = b.getByRole("menu").last().getByRole("menuitem", { name: "Close All" });
    const shown = await rowClose.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    );
    await shot(b, "mail-rows-close-all");
    if (shown) await rowClose.click();
    await b.keyboard.up("Alt");
    step(
      "Close All ⌥⌘W closes the New Message and the viewer, and the message stays a draft",
      shown &&
        (await seen(
          async () => (await compose(b).count()) === 0 && (await viewer(b).count()) === 0,
        )) &&
        (await seen(
          async () => (await server(b, `Kept by Close All ${id}`, "drafts")) !== undefined,
        )),
    );
    await dockTile(b, "Mail").click();
    await viewer(b).waitFor({ timeout: 15_000 });
    await viewer(b).getByRole("button", { name: "New Message" }).click();
    await compose(b).waitFor({ timeout: 10_000 });
    await b.keyboard.press("Control+Alt+W");
    step(
      "and its key",
      await seen(async () => (await compose(b).count()) === 0 && (await viewer(b).count()) === 0),
    );
    await dockTile(b, "Mail").click();
    await viewer(b).waitFor({ timeout: 15_000 });
    await within(10_000, async () => (await rows(b).count()) > 0);
    await calm();
    await b.keyboard.press("Control+N");
    step("⌘N opens one too", await seen(() => compose(b).isVisible()));
    await closeCompose(b);
    await calm();
  });

  await section(b, "edit", async () => {
    await calm();
    await menu(b, "Message", "Flag", /^Orange/);
    await seen(async () => (await server(b, alpha))?.flag === "orange");
    await menu(b, "Edit", /^Undo/);
    await seen(async () => !(await server(b, alpha))?.flag);
    await menu(b, "Edit", /^Redo/);
    step(
      "Edit > Redo ⇧⌘Z puts back what Undo took back, on the server",
      await seen(async () => (await server(b, alpha))?.flag === "orange"),
    );
    await b.keyboard.press("Control+Z");
    await seen(async () => !(await server(b, alpha))?.flag);
    await b.keyboard.press("Control+Shift+Z");
    step("and its key", await seen(async () => (await server(b, alpha))?.flag === "orange"));
    await b.keyboard.press("Control+Z");
    await seen(async () => !(await server(b, alpha))?.flag);

    await seen(() => viewer(b).getByText(`The text of ${alpha}`).first().isVisible());
    await b.evaluate(() => document.getSelection().removeAllRanges());
    await menu(b, "Edit", /^Copy/);
    step(
      "Copy ⌘C puts the message selected on the clipboard: sender, subject and text",
      await seen(async () => {
        const copied = await clipboard(b);
        return (
          copied.includes(chris.fullName) &&
          copied.includes(alpha) &&
          copied.includes(`The text of ${alpha}`)
        );
      }),
    );
    await selectWords(b, `The text of ${alpha}`);
    await menu(b, "Edit", /^Copy/);
    step(
      "and the text selected, when some is",
      await seen(async () => (await clipboard(b)) === `The text of ${alpha}`),
    );
    await b.evaluate(() => document.getSelection().removeAllRanges());

    await menu(b, "Edit", /^Cut/);
    step(
      "Cut ⌘X puts the message on the clipboard and moves it to the Trash, on the server",
      await seen(async () => {
        const copied = await clipboard(b);
        return (
          copied.includes(`The text of ${alpha}`) && (await server(b, alpha))?.mailbox === "trash"
        );
      }),
    );
    await menu(b, "Edit", /^Undo/);
    step(
      "and Undo brings it back",
      await seen(async () => (await server(b, alpha))?.mailbox === "inbox"),
    );
    await row(b, alpha).click();

    await menu(b, "Edit", /^Select All/);
    step(
      "Select All ⌘A selects the whole message list",
      await seen(() => viewer(b).getByText("6 Messages Selected").isVisible()),
    );
    await shot(b, "mail-rows-select-all");
    await row(b, bravo).click();
    await rows(b).first().focus();
    await b.keyboard.press("Control+A");
    step(
      "Select All in the list, by its key",
      await seen(() => viewer(b).getByText("6 Messages Selected").isVisible()),
    );

    await row(b, bravo).click();
    await menu(b, "Edit", /^Delete/);
    step(
      "Edit > Delete moves the message to the Trash",
      await seen(async () => (await server(b, bravo))?.mailbox === "trash"),
    );
    await b.keyboard.press("Control+Z");
    await seen(async () => (await server(b, bravo))?.mailbox === "inbox");

    const search = viewer(b).getByRole("searchbox");
    await menu(b, "Edit", "Find", "Mailbox Search");
    const focused = await seen(() => search.evaluate((node) => node === document.activeElement));
    await b.keyboard.type(`Echo ${id}`);
    step(
      "Find > Mailbox Search ⌥⌘F gives the search field the keyboard, and what is typed narrows the list",
      focused && (await seen(async () => (await rows(b).count()) === 1)),
    );
    await shot(b, "mail-rows-mailbox-search");
    await search.fill("");
    await seen(async () => (await rows(b).count()) === 6);
    await row(b, alpha).click();
    await b.keyboard.press("Control+Alt+F");
    const shellOf = windowOf(b, "mail").locator("> *").first();
    step(
      "off a Mac Control-Option-F is the desktop's full screen, not Mailbox Search's key",
      await seen(async () => (await box(shellOf)).width === b.viewportSize().width),
    );
    await b.waitForTimeout(800);
    await b.keyboard.press("Control+Alt+F");
    await seen(async () => (await box(shellOf)).width < b.viewportSize().width);
    await b.waitForTimeout(600);

    // The key itself, in a page that reads as a Mac's: Command is Meta there, and the chord is Mail's.
    const mac = await b.context().newPage();
    macOpen = true;
    await mac.addInitScript(() => {
      Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
    });
    await mac.goto(new URL("/", b.url()).href, { waitUntil: "load" });
    await openFromDock(mac, "Mail", undefined).catch(() => {});
    await within(15_000, () => viewer(mac).isVisible());
    await within(10_000, async () => (await rows(mac).count()) > 0);
    await mac.keyboard.press("Meta+Alt+F");
    step(
      "and Find > Mailbox Search's key on a Mac gives the search field the keyboard",
      await seen(() =>
        viewer(mac)
          .getByRole("searchbox")
          .evaluate((node) => node === document.activeElement),
      ),
    );
    await mac.close();
    await b.waitForTimeout(1_500);
    macOpen = false;

    await row(b, delta).click();
    await seen(() =>
      viewer(b)
        .getByText(/The needle/)
        .first()
        .isVisible(),
    );
    await menu(b, "Edit", "Find", "Find…");
    await findField(b).fill("of the");
    const counted = await findSays(b, "1 of 199");
    await menu(b, "Edit", "Find", "Find Next");
    const menuNext = await findSays(b, "2 of 199");
    await b.keyboard.press("Control+G");
    const keyNext = await findSays(b, "3 of 199");
    await viewer(b).locator(".mac-mail-find").getByRole("button", { name: /Next/ }).click();
    const barNext = await findSays(b, "4 of 199");
    await findField(b).press("Enter");
    const enterNext = await findSays(b, "5 of 199");
    step(
      "Find > Find Next ⌘G goes on by the menu, its key, the bar's button and Return",
      counted && menuNext && keyNext && barNext && enterNext,
    );
    await menu(b, "Edit", "Find", "Find Previous");
    const menuBack = await findSays(b, "4 of 199");
    await b.keyboard.press("Control+Shift+G");
    const keyBack = await findSays(b, "3 of 199");
    await viewer(b)
      .locator(".mac-mail-find")
      .getByRole("button", { name: /Previous/ })
      .click();
    const barBack = await findSays(b, "2 of 199");
    await findField(b).press("Shift+Enter");
    const shiftBack = await findSays(b, "1 of 199");
    step(
      "Find > Find Previous ⇧⌘G goes back by the menu, its key, the bar's button and Shift-Return",
      menuBack && keyBack && barBack && shiftBack,
    );
    await shot(b, "mail-rows-find-next");

    await findField(b).fill("needle");
    await findSays(b, "1 of 1");
    await paneToTop(b);
    const top = await paneTop(b);
    await menu(b, "Edit", "Find", "Jump to Selection");
    step(
      "Find > Jump to Selection ⌘J scrolls to the current match",
      top === 0 && (await seen(async () => (await paneTop(b)) > 0)),
    );
    await paneToTop(b);
    await viewer(b)
      .locator(".mac-mail-message-content")
      .getByText(/The needle/)
      .first()
      .evaluate((node) => node.scrollIntoView());
    await selectWords(b, "heron");
    await paneToTop(b);
    await b.keyboard.press("Control+J");
    step("and to the selection, by its key", await seen(async () => (await paneTop(b)) > 0));
    await selectWords(b, "heron");
    await menu(b, "Edit", "Find", "Use Selection for Find");
    step(
      "Find > Use Selection for Find ⌘E searches for the words selected",
      (await findSays(b, "1 of 1")) && (await findField(b).inputValue()) === "heron",
    );
    await selectWords(b, "needle");
    await b.keyboard.press("Control+E");
    step(
      "and by its key",
      (await findSays(b, "1 of 1")) && (await findField(b).inputValue()) === "needle",
    );
    await shot(b, "mail-rows-jump");
    await viewer(b).getByRole("button", { name: "Done" }).click();
    await calm();
  });

  await section(b, "view", async () => {
    await calm();
    await goTo(b, "Inbox");
    await row(b, bravo).click();
    await seen(async () => !(await server(b, bravo))?.unread);
    await row(b, alpha).click();
    await seen(async () => !(await server(b, alpha))?.unread);
    await menu(b, "View", "Filter", "Enable Message Filter");
    step(
      "Filter > Enable Message Filter ⌘L lists only unread mail, by default",
      await seen(async () => {
        const on = await viewer(b)
          .getByRole("button", { name: /^Filter/ })
          .getAttribute("aria-pressed");
        const unread = (await allOnServer(b)).filter(
          (each) => each.mailbox === "inbox" && each.unread,
        );
        const listed = await viewer(b).locator(".mac-mail-row-subject").allInnerTexts();
        return (
          on === "true" &&
          unread.every((each) => listed.includes(each.subject)) &&
          listed.includes(echo) &&
          !listed.includes(bravo)
        );
      }),
    );
    await shot(b, "mail-rows-filter");
    await b.keyboard.press("Control+L");
    step(
      "and its key turns it off, listing all six again",
      await seen(async () => (await rows(b).count()) === 6),
    );
    await calm();

    const shell = windowOf(b, "mail").locator("> *").first();
    const size = await box(shell);
    await menu(b, "View", "Enter Full Screen");
    const viewport = b.viewportSize();
    const filled = await seen(async () => {
      const now = await box(shell);
      return now.width === viewport.width && now.height === viewport.height;
    });
    step(
      "Enter Full Screen ⌃⌘F fills the screen with Mail's window",
      filled,
      JSON.stringify(await box(shell)),
    );
    await b.waitForTimeout(900);
    await shot(b, "mail-rows-full-screen");
    await b.mouse.move(400, 0);
    await b.waitForTimeout(700);
    await menu(b, "View", "Exit Full Screen");
    step(
      "and Exit Full Screen gives its size back",
      await seen(async () => (await box(shell)).width === size.width),
    );
    await b.waitForTimeout(600);
  });

  await section(b, "mailbox", async () => {
    await calm();
    const mbox = await download(b, () => menuPath(b, "Mailbox", /^Export Mailbox/));
    step(
      "Export Mailbox… gives the Inbox as an mbox with the whole text of each",
      mbox.name === "Inbox.mbox" &&
        mbox.text.includes(alpha) &&
        mbox.text.includes("Line 199 of the text") &&
        mbox.text.includes(foxtrot),
    );
    await mailboxRow(b, "Inbox").click({ button: "right" });
    const fromRow = await download(b, () =>
      b
        .getByRole("menu", { name: "Mailbox commands" })
        .getByRole("menuitem", { name: /^Export Mailbox/ })
        .click(),
    );
    step(
      "and from a mailbox's row",
      fromRow.name === "Inbox.mbox" && fromRow.text.includes(foxtrot),
    );
    await calm();
  });

  await section(b, "message", async () => {
    await calm();
    const replyTo = async () =>
      (await fieldOf(b, "To").innerText()).includes(chris.name) ||
      (await fieldOf(b, "To").innerText()).includes(chris.fullName);
    await menu(b, "Message", /^Reply/);
    step(
      "Reply ⌘R writes back to the sender, with Re:",
      (await composing(b, `Re: ${alpha}`)) && (await replyTo()),
    );
    await closeCompose(b);
    await row(b, alpha).click();
    await b.keyboard.press("Control+R");
    step("and its key", (await composing(b, `Re: ${alpha}`)) && (await replyTo()));
    await shot(b, "mail-rows-reply");
    await closeCompose(b);

    await row(b, charlie).click();
    await menu(b, "Message", "Reply All");
    const addressed = async () =>
      (await composing(b, `Re: ${charlie}`)) &&
      (await replyTo()) &&
      (await fieldOf(b, "Cc").innerText()).includes(ann.name) &&
      !`${await fieldOf(b, "To").innerText()}${await fieldOf(b, "Cc").innerText()}`.includes(
        martin.name,
      );
    step("Reply All ⇧⌘R writes to the sender, with the others in Cc", await addressed());
    await closeCompose(b);
    await row(b, charlie).click();
    await b.keyboard.press("Control+Shift+R");
    step("and its key", await addressed());
    await closeCompose(b);

    await row(b, bravo).click();
    await menu(b, "Message", /^Forward$/);
    const forwarded = async () =>
      (await composing(b, `Fwd: ${bravo}`)) &&
      (await compose(b).getByLabel("To:").inputValue()) === "" &&
      (await seen(async () => (await compose(b).innerText()).includes(`The text of ${bravo}`)));
    step("Forward ⇧⌘F opens a New Message with the text, addressed to nobody", await forwarded());
    await shot(b, "mail-rows-forward");
    await closeCompose(b);
    await row(b, bravo).click();
    await b.keyboard.press("Control+Shift+F");
    step("and its key", await forwarded());
    await closeCompose(b);

    await row(b, bravo).click();
    const redirected = async () =>
      (await composing(b, bravo)) &&
      (await compose(b).getByLabel("To:").inputValue()) === "" &&
      (await seen(async () => (await compose(b).innerText()).includes(`The text of ${bravo}`)));
    await menu(b, "Message", /^Redirect/);
    step("Redirect ⇧⌘E opens a New Message with the same subject and text", await redirected());
    await closeCompose(b);
    await row(b, bravo).click();
    await b.keyboard.press("Control+Shift+E");
    step("and its key", await redirected());
    await closeCompose(b);
  });

  await section(b, "message-more", async () => {
    // A message of Martin's own, for Send Again.
    await viewer(b).getByRole("button", { name: "New Message" }).click();
    const to = compose(b).getByLabel("To:");
    await to.click();
    await to.pressSequentially(chris.name);
    await to.press("Enter");
    await compose(b).getByLabel("Subject:").fill(`Sent by Martin ${id}`);
    await b.keyboard.press("Control+Shift+D");
    await within(15_000, async () => (await compose(b).count()) === 0);
    await goTo(b, "Sent");
    await row(b, `Sent by Martin ${id}`).click();
    const again = async () =>
      (await composing(b, `Sent by Martin ${id}`)) &&
      (await fieldOf(b, "To").innerText()).includes(chris.name);
    await menu(b, "Message", /^Send Again/);
    step("Send Again ⇧⌘D opens a New Message from a sent message", await again());
    await closeCompose(b);
    await row(b, `Sent by Martin ${id}`).click();
    await b.keyboard.press("Control+Shift+D");
    step("and its key", await again());
    await closeCompose(b);
    await calm();

    await row(b, bravo).click();
    await menu(b, "Message", "Mark", "As High Priority");
    const high = await seen(async () => (await server(b, bravo))?.priority === "high");
    const highMark = await seen(() => row(b, bravo).getByLabel("High priority").isVisible());
    await shot(b, "mail-rows-priority");
    await menu(b, "Message", "Mark", "As Low Priority");
    const low = await seen(async () => (await server(b, bravo))?.priority === "low");
    const lowMark = await seen(() => row(b, bravo).getByLabel("Low priority").isVisible());
    await menu(b, "Message", "Mark", "As Normal Priority");
    const normal = await seen(async () => {
      const priority = (await server(b, bravo))?.priority;
      return !priority || priority === "normal";
    });
    step(
      "Mark > Low, Normal and High Priority are stored on the server and marked on the row",
      high &&
        highMark &&
        low &&
        lowMark &&
        normal &&
        (await seen(
          async () =>
            (await row(b, bravo)
              .getByLabel(/priority/)
              .count()) === 0,
        )),
    );

    await row(b, bravo).click();
    await menu(b, "Message", "Move to");
    await b
      .getByRole("menu")
      .filter({ has: b.getByRole("menuitem", { name: "Inbox", exact: true }) })
      .getByRole("menuitem", { name: "Archive", exact: true })
      .click();
    step(
      "Move to submenu files the message in Archive, on the server",
      await seen(async () => (await server(b, bravo))?.mailbox === "archive"),
    );
    await shot(b, "mail-rows-move");
    await b
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Edit", exact: true })
      .first()
      .click();
    const undoLabel = await b
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: /^Undo/ })
      .innerText();
    await b.keyboard.press("Escape");
    await b.keyboard.press("Escape");
    await settle(b);
    step(
      "and Undo names it a Move, so the submenu's row did it",
      /Undo Move/.test(undoLabel),
      undoLabel,
    );
    await row(b, echo).click();
    await b
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Message", exact: true })
      .first()
      .click();
    const againRow = b.getByRole("menu").last().getByRole("menuitem", { name: "Move Again" });
    await againRow.waitFor();
    const offeredAgain = (await againRow.getAttribute("aria-disabled")) !== "true";
    let againMenu = false;
    if (offeredAgain) {
      await againRow.click();
      againMenu = await seen(async () => (await server(b, echo))?.mailbox === "archive");
    } else {
      await b.keyboard.press("Escape");
      await b.keyboard.press("Escape");
    }
    await settle(b);
    await row(b, foxtrot).click();
    await b.keyboard.press("Control+Alt+T");
    step(
      "Move Again ⌥⌘T sends the next one to the same place, by the menu and its key",
      offeredAgain &&
        againMenu &&
        (await seen(async () => (await server(b, foxtrot))?.mailbox === "archive")),
      JSON.stringify({ offeredAgain, againMenu }),
    );
    for (const subject of offeredAgain ? [foxtrot, echo, bravo] : [bravo]) {
      await b.keyboard.press("Control+Z");
      await seen(async () => (await server(b, subject))?.mailbox === "inbox");
    }
    step(
      "and Undo brings each back",
      await seen(async () => {
        const all = await allOnServer(b);
        return [bravo, echo, foxtrot].every(
          (subject) =>
            all.find((each) => each.subject === subject && each.mailbox !== "drafts")?.mailbox ===
            "inbox",
        );
      }),
    );

    await row(b, echo).click();
    await menu(b, "Message", "Copy to");
    await b
      .getByRole("menu")
      .filter({ has: b.getByRole("menuitem", { name: "Inbox", exact: true }) })
      .getByRole("menuitem", { name: "Archive", exact: true })
      .click();
    step(
      "Copy to submenu keeps the message and adds it to Archive, on the server",
      await seen(async () => {
        const copies = (await allOnServer(b)).filter(
          (each) => each.subject === echo && each.mailbox !== "drafts",
        );
        return (
          copies.length === 2 &&
          copies.some((each) => each.mailbox === "inbox") &&
          copies.some((each) => each.mailbox === "archive")
        );
      }),
    );

    await row(b, foxtrot).click();
    await menu(b, "Message", /^Delete/);
    const item = await seen(async () => (await server(b, foxtrot))?.mailbox === "trash");
    await b.keyboard.press("Control+Z");
    await seen(async () => (await server(b, foxtrot))?.mailbox === "inbox");
    await row(b, foxtrot).click();
    await b.keyboard.press("Control+Backspace");
    const key = await seen(async () => (await server(b, foxtrot))?.mailbox === "trash");
    await b.keyboard.press("Control+Z");
    await seen(async () => (await server(b, foxtrot))?.mailbox === "inbox");
    await row(b, foxtrot).click();
    await b.keyboard.press("Delete");
    const plainKey = await seen(async () => (await server(b, foxtrot))?.mailbox === "trash");
    await b.keyboard.press("Control+Z");
    await seen(async () => (await server(b, foxtrot))?.mailbox === "inbox");
    await row(b, foxtrot).click();
    await row(b, echo).click({ modifiers: ["Control"] });
    await b.keyboard.press("Backspace");
    const several = await seen(async () => {
      const all = await allOnServer(b);
      return (
        all.find((each) => each.subject === foxtrot)?.mailbox === "trash" &&
        all.some((each) => each.subject === echo && each.mailbox === "trash")
      );
    });
    await b.keyboard.press("Control+Z");
    step(
      "Delete ⌫ moves to the Trash by the item, ⌘⌫, the Delete key, and on the whole selection",
      item && key && plainKey && several,
      JSON.stringify({ item, key, plainKey, several }),
    );
    await seen(async () => (await server(b, foxtrot))?.mailbox === "inbox");

    await openPane(b, "Rules");
    await preferences(b).getByRole("button", { name: "Add Rule" }).click();
    const sheet = b.getByRole("dialog").filter({ hasText: "Add Rule" });
    await sheet.waitFor({ timeout: 5_000 });
    await sheet.getByRole("textbox", { name: "Description" }).fill("Charlie's");
    await choose(b, sheet, "Field", "Subject");
    await sheet.getByRole("textbox", { name: "Value" }).fill("Charlie");
    await sheet.getByRole("button", { name: "OK" }).click();
    const asking = b.getByRole("alertdialog");
    await asking.waitFor({ timeout: 5_000 });
    await asking.getByRole("button", { name: /Don.t Apply/ }).click();
    await closePreferences(b);
    await seen(async () => (await preferences(b).count()) === 0);
    await row(b, charlie).click();
    await menu(b, "Message", "Apply Rules");
    const byItem = await seen(async () => (await server(b, charlie))?.mailbox === "archive");
    await shot(b, "mail-rows-apply-rules");
    await b.keyboard.press("Control+Z");
    const undone = await seen(async () => (await server(b, charlie))?.mailbox === "inbox");
    await row(b, charlie).click();
    await b.keyboard.press("Control+Alt+L");
    const byKey = await seen(async () => (await server(b, charlie))?.mailbox === "archive");
    step(
      "Apply Rules ⌥⌘L runs the rule on the selection, by the item and its key, and Undo takes it back",
      byItem && undone && byKey,
      JSON.stringify({ byItem, undone, byKey }),
    );
    await b.keyboard.press("Control+Z");
    await seen(async () => (await server(b, charlie))?.mailbox === "inbox");
    await calm();
  });

  await section(b, "window", async () => {
    await calm();
    const shell = windowOf(b, "mail").locator("> *").first();
    await menu(b, "Window", "Minimize");
    step(
      "Window > Minimize ⌘M takes Mail to a tile of its own in the Dock",
      await seen(async () => (await hidden(b, "mail")) && (await minimizedTiles(b)) === 1),
    );
    await shot(b, "mail-rows-minimized");
    await b
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: /minimized window/ })
      .click();
    await seen(() => inFront(b, "mail"));
    await b.waitForTimeout(500);
    await row(b, alpha).click();
    await b.keyboard.press("Control+M");
    step("and its key", await seen(async () => (await minimizedTiles(b)) === 1));
    await b
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: /minimized window/ })
      .click();
    await seen(() => inFront(b, "mail"));
    await b.waitForTimeout(500);

    await row(b, alpha).click();
    const small = await box(shell);
    await menu(b, "Window", "Zoom");
    const grown = await seen(async () => (await box(shell)).width > small.width);
    await b.waitForTimeout(500);
    await shot(b, "mail-rows-zoom");
    await menu(b, "Window", "Zoom");
    step(
      "Window > Zoom grows the window, and again gives its size back",
      grown && (await seen(async () => (await box(shell)).width === small.width)),
    );
    await b.waitForTimeout(400);

    await viewer(b).getByRole("button", { name: "New Message" }).click();
    await compose(b).getByLabel("Subject:").fill(`Listed ${id}`);
    await settle(b);
    const composeWindow = await compose(b).evaluate(
      (el) => el.closest("[data-window-id]")?.getAttribute("data-window-id") ?? "",
    );
    await dockTile(b, "Calculator").click();
    await windowOf(b, "calculator").waitFor({ timeout: 10_000 });
    await b.waitForTimeout(500);
    const zOf = (windowId) =>
      windowOf(b, windowId).evaluate((el) => Number(getComputedStyle(el).zIndex) || 0);
    await viewer(b).click({ position: { x: 300, y: 12 } });
    await settle(b);
    const behind = composeWindow !== "" && (await zOf(composeWindow)) < (await zOf("calculator"));
    await menu(b, "Window", "Bring All to Front");
    step(
      "Bring All to Front brings Mail's windows above Calculator",
      behind &&
        (await seen(
          async () =>
            (await zOf(composeWindow)) > (await zOf("calculator")) &&
            (await zOf("mail")) > (await zOf("calculator")),
        )),
      JSON.stringify({ composeWindow, behind }),
    );
    await shot(b, "mail-rows-bring-all");

    await b
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Window", exact: true })
      .first()
      .click();
    const list = b.getByRole("menu").last().getByRole("menuitemcheckbox");
    await list.first().waitFor();
    const titles = await list.allInnerTexts();
    await shot(b, "mail-rows-window-list");
    await list
      .filter({ hasText: /^Mail$/ })
      .first()
      .click();
    const toViewer = await seen(async () => (await stateOf(b, "mail")) === "key");
    await b
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Window", exact: true })
      .first()
      .click();
    await b
      .getByRole("menu")
      .last()
      .getByRole("menuitemcheckbox")
      .filter({ hasText: "New Message" })
      .first()
      .click();
    step(
      "Open windows list names both windows, and choosing one brings it forward",
      titles.some((title) => title.includes("New Message")) &&
        titles.some((title) => title.includes("Mail")) &&
        toViewer &&
        (await seen(async () => (await stateOf(b, composeWindow)) === "key")),
      `${titles.join(" | ")} ${toViewer}`,
    );
    await closeCompose(b);
    await dockTile(b, "Calculator").click();
    await settle(b);
    await windowOf(b, "calculator").getByRole("button", { name: "Close" }).first().click();
  });

  await onServer(c, charlie);
});
