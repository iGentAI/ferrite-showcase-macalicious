#!/usr/bin/env node
// Mail's Tab Bar, three General preferences and Markup of a reopened draft, in a real browser against the running app, two
// people. Each is read from the server. A failed send is a route answering 503 for /api/mail/send: the stand-in for a server
// that is down, the only one here; the Outbox, the retry and the delivery are the real ones.
//
//   node e2e/mail-tabs-prefs-journey.mjs [--url http://127.0.0.1:8787] [--only tabs,prefs,later,markup,downloads]

import { named, stored } from "./calendar-kit.mjs";
import {
  choose,
  closePreferences,
  compose,
  mailboxRow,
  menuPath,
  onServer,
  openPane,
  preferences,
  row,
  values,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot, allow } = twoPeople("mail-tabs-prefs");
allow(/HTTP 503: \S*\/api\/mail\/send/);
allow(/console: Failed to load resource: the server responded with a status of 503/);
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `tpchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `tpmartin-${id}`, fullName: `Martin ${id}`, password };
const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);

const openMail = async (page) => {
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await viewer(page).waitFor({ timeout: 15_000 });
};
const address = async (page, to) => {
  const field = compose(page).getByLabel("To:");
  await field.click();
  await field.pressSequentially(to);
  await field.press("Enter");
};
const newMessage = async (page) => {
  await viewer(page).getByRole("button", { name: "New Message" }).first().click();
  await compose(page).waitFor();
};
const sendIt = (page) =>
  seen(async () => {
    if ((await compose(page).count()) === 0) return true;
    await page.keyboard.press("Control+Shift+D");
    await page.waitForTimeout(1_000);
    return (await compose(page).count()) === 0;
  }, 25_000);
const getMail = (page) => viewer(page).getByRole("button", { name: "Get Mail" }).first().click();
const attach = async (page, file) => {
  await compose(page).getByRole("button", { name: "Attach", exact: true }).click();
  await page.getByLabel("Files from this computer").setInputFiles(file);
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .click({ timeout: 3_000 })
    .catch(() => {});
  const strip = compose(page).getByRole("list", { name: "Attachments" });
  await seen(async () => /KB|bytes/.test(await strip.innerText()), 15_000);
};
const whitePicture = async (page) =>
  Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 200;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 400, 200);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
    }),
    "base64",
  );
const ICS = (uid, summary) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//macalicious//journey//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTAMP:20260601T100000Z",
    "DTSTART:20260610T100000Z",
    "DTEND:20260610T110000Z",
    `SUMMARY:${summary}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

async function tabs(a) {
  const subject = `Tabbed ${id}`;
  await openMail(a);
  await mailboxRow(a, "Inbox").click();
  await newMessage(a);
  await address(a, chris.name);
  await compose(a).getByLabel("Subject:").fill(subject);
  step("a message to oneself goes", await sendIt(a));
  await seen(async () => Boolean(await onServer(a, subject)), 15_000);
  await getMail(a);
  const line = row(a, subject);
  await line.waitFor({ timeout: 15_000 });
  await line.dblclick();
  const reader = a.locator(".mac-mail-reader").first();
  await reader.waitFor({ timeout: 8_000 });
  await reader
    .getByRole("heading")
    .first()
    .click({ timeout: 2_000 })
    .catch(() => {});

  await menuPath(a, "View", "Show Tab Bar");
  const bar = reader.getByRole("tablist", { name: "Tabs" });
  step("View > Show Tab Bar shows it on the message's window", await seen(() => bar.isVisible()));
  await shot(a, "tabs-bar");
  await bar
    .locator("..")
    .getByRole("button", { name: /new tab/i })
    .click();
  await compose(a).waitFor({ timeout: 8_000 });
  const kept = await seen(async () => {
    const record = (await values(a))["mail.tabs"];
    return record?.groups?.[0]?.ids?.length === 2 && record.groups[0].selected.includes("compose-");
  }, 15_000);
  step("+ opens a New Message window as a tab; the group is on the server", kept);
  const tabsShown = compose(a).getByRole("tablist", { name: "Tabs" }).getByRole("tab");
  step("the New Message window shows both tabs", (await tabsShown.count()) === 2);
  const frames = await a.evaluate(() =>
    [
      ...document.querySelectorAll('[data-window-id*="compose-"], [data-window-id*="message-"]'),
    ].map((each) => {
      const box = each.getBoundingClientRect();
      return [box.x, box.y, box.width, box.height, getComputedStyle(each).visibility].join();
    }),
  );
  step(
    "the two stand on one frame, one of them showing",
    frames.length === 2 &&
      frames[0].split(",").slice(0, 4).join() === frames[1].split(",").slice(0, 4).join() &&
      frames.filter((each) => each.endsWith("hidden")).length === 1,
    frames.join(" | "),
  );
  await shot(a, "tabs-two");

  await tabsShown.filter({ hasText: subject }).click();
  step(
    "choosing the message's tab brings its window up",
    await seen(async () => await reader.getByRole("tablist", { name: "Tabs" }).isVisible()),
  );
  await menuPath(a, "View", "Show All Tabs");
  const overview = a.getByRole("region", { name: "All Tabs" });
  await overview.waitFor({ timeout: 5_000 });
  step(
    "View > Show All Tabs covers the window with a card of each",
    (await overview.getByRole("button").count()) === 2,
  );
  await shot(a, "tabs-overview");
  await overview.getByRole("button", { name: "New Message" }).click();
  step(
    "choosing a card selects its tab and ends the overview",
    await seen(async () => (await overview.count()) === 0),
  );
  const selectedTab = async () => (await values(a))["mail.tabs"]?.groups?.[0]?.selected ?? "";
  await menuPath(a, "Window", "Show Previous Tab");
  step(
    "Window > Show Previous Tab selects the message, read from the server",
    await seen(async () => (await selectedTab()).includes("message-"), 15_000),
    await selectedTab(),
  );
  await menuPath(a, "Window", "Show Next Tab");
  step(
    "Window > Show Next Tab selects the New Message, read from the server",
    await seen(async () => (await selectedTab()).includes("compose-"), 15_000),
    await selectedTab(),
  );
  await menuPath(a, "Window", "Move Tab to New Window");
  step(
    "Window > Move Tab to New Window takes the tabs apart",
    await seen(async () => ((await values(a))["mail.tabs"]?.groups ?? []).length === 0, 15_000),
  );
  await menuPath(a, "Window", "Merge All Windows");
  step(
    "Window > Merge All Windows joins them again",
    await seen(async () => ((await values(a))["mail.tabs"]?.groups ?? []).length === 1, 15_000),
  );
  await compose(a).getByRole("button", { name: "Close" }).first().click();
  step(
    "closing a tab leaves the other a window with no group",
    await seen(async () => ((await values(a))["mail.tabs"]?.groups ?? []).length === 0, 15_000),
  );
  await reader.getByRole("button", { name: "Close" }).first().click({ timeout: 5_000 });
  step(
    "the tab left stands in front: its own Close closes it",
    await seen(async () => (await reader.count()) === 0),
  );
  await row(a, subject).click();
  await a.getByRole("menubar").getByRole("menuitem", { name: "View", exact: true }).first().click();
  const dimmed = a.getByRole("menu").last().getByRole("menuitem", { name: "Show Tab Bar" });
  step(
    "the viewer takes no tabs: with it key, Show Tab Bar is dimmed with the reason",
    (await dimmed.getAttribute("aria-disabled")) === "true" &&
      /message viewer stays a window/.test((await dimmed.getAttribute("title")) ?? ""),
  );
  await a.keyboard.press("Escape");
}

async function prefs(a, b) {
  await openMail(a);
  await openPane(a, "General");
  const pane = preferences(a);
  await choose(a, pane, "Downloads folder:", "Desktop");
  await pane.getByRole("checkbox", { name: "Add invitations to Calendar automatically" }).click();
  await pane
    .getByRole("checkbox", {
      name: "Automatically try sending later if outgoing server is unavailable",
    })
    .click();
  const kept = await seen(async () => {
    const settings = (await values(a))["mail.settings"];
    return (
      settings?.downloads === "Desktop" &&
      settings?.invitations === true &&
      settings?.sendLater === true
    );
  }, 15_000);
  step("Downloads folder, invitations and send later are chosen and on the server", kept);
  const stays = [
    ["combobox", "New message notifications:"],
    ["checkbox", "Prefer opening messages in split view when in full screen"],
    ["checkbox", "Encrypted Messages"],
  ];
  for (const [role, name] of stays) {
    const control = pane.getByRole(role, { name });
    step(
      `${name} stays dimmed with its reason`,
      (await control.isDisabled()) || (await control.getAttribute("aria-disabled")) === "true",
    );
  }
  await shot(a, "prefs-general");
  await closePreferences(a);

  const subject = `Invite ${id}`;
  const event = `Crossing ${id}`;
  await newMessage(b);
  await address(b, chris.name);
  await compose(b).getByLabel("Subject:").fill(subject);
  await attach(b, {
    name: "Trip.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(ICS(`uid-${id}`, event)),
  });
  step("Martin sends a calendar file", await sendIt(b));
  const sheet = a.getByText("Import Events", { exact: true });
  const asked = await seen(async () => {
    if (await sheet.isVisible()) return true;
    await getMail(a).catch(() => {});
    return false;
  }, 25_000);
  step("with invitations on, its arrival opens Calendar's import on it, unasked", asked);
  await shot(a, "prefs-invitation");
  await a.getByRole("button", { name: "Import", exact: true }).click();
  const added = await seen(async () => Boolean(named(await stored(a), event)), 15_000);
  step("Import stores the event, read from the server", added);
  const said = a.getByRole("alertdialog").last();
  if (await seen(() => said.isVisible(), 3_000)) await said.getByRole("button").last().click();
  const onDesktop = await a.evaluate(async () => {
    const drive = await fetch("/api/files/").then((reply) => reply.json());
    return drive.entries.filter((each) => each.name === "Trip.ics").map((each) => each.parent);
  });
  step(
    "the file it read is on the Desktop, as the Downloads folder setting says",
    onDesktop.length === 1 && onDesktop[0] === "desktop",
    JSON.stringify(onDesktop),
  );

  await openMail(a);
  await mailboxRow(a, "Inbox").click();
  await row(a, subject).click();
  const button = viewer(a).getByRole("button", { name: "Save to Desktop" });
  step("the message's own button names the Desktop", await seen(() => button.isVisible()));
}

async function later(a, b) {
  await openMail(a);
  const subject = `Later ${id}`;
  await a.route("**/api/mail/send*", (route) => route.fulfill({ status: 503, body: "down" }));
  if ((await values(a))["mail.settings"]?.sendLater !== true) {
    await openPane(a, "General");
    await preferences(a)
      .getByRole("checkbox", {
        name: "Automatically try sending later if outgoing server is unavailable",
      })
      .click();
    await closePreferences(a);
  }
  await newMessage(a);
  await address(a, martin.name);
  await compose(a).getByLabel("Subject:").fill(subject);
  step("with send later on, a send the server fails closes the window", await sendIt(a));
  await a.waitForTimeout(1_000);
  await shot(a, "later-closed");
  const held = await a.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("macalicious.mail.outbox");
        open.onsuccess = () => {
          const read = open.result.transaction("entries").objectStore("entries").getAll();
          read.onsuccess = () => resolve(read.result.map((each) => each.body?.subject));
        };
      }),
  );
  step("this browser's Outbox holds it", held.includes(subject), JSON.stringify(held));
  step("it waits in the Outbox", await seen(() => mailboxRow(a, "Outbox").isVisible(), 8_000));
  await mailboxRow(a, "Outbox").click();
  step("the Outbox lists it", await seen(() => row(a, subject).isVisible(), 8_000));
  await shot(a, "later-outbox");
  await a.unroute("**/api/mail/send*");
  await getMail(a);
  const got = await seen(async () => Boolean(await onServer(b, subject)), 20_000);
  step("Get Mail sends it, and Martin has it from the server", got);
  const reply = await b.request.get(new URL("/api/mail/messages", b.url()).href);
  const copies = (await reply.json()).messages.filter((each) => each.subject === subject);
  step("it is delivered once", copies.length === 1, String(copies.length));
}

async function downloads(a, b) {
  await openMail(a);
  await mailboxRow(a, "Inbox").click();
  const driveEntry = (name) =>
    a.evaluate(async (wanted) => {
      const drive = await fetch("/api/files/").then((reply) => reply.json());
      return drive.entries.find((each) => each.name === wanted) ?? null;
    }, name);
  const trashed = async (name) => {
    const entry = await driveEntry(name);
    return typeof entry?.trashed_ms === "number";
  };
  const saveAll = async (subject, names) => {
    await newMessage(b);
    await address(b, chris.name);
    await compose(b).getByLabel("Subject:").fill(subject);
    for (const name of names) {
      await attach(b, { name, mimeType: "text/plain", buffer: Buffer.from(`${name} ${id}`) });
    }
    step(`Martin sends ${names.join(" and ")}`, await sendIt(b));
    await seen(async () => {
      await getMail(a).catch(() => {});
      return row(a, subject).isVisible();
    }, 25_000);
    await row(a, subject).click();
    for (const name of names) {
      const file = viewer(a).locator(".mac-mail-live-attachment").filter({ hasText: name });
      await file.getByRole("button", { name: /^Save( to \w+)?$/ }).click();
      await file.getByText(/^Saved to /).waitFor({ timeout: 15_000 });
    }
  };
  const erase = async (subject) => {
    await row(a, subject).click();
    await viewer(a).getByRole("button", { name: "Delete" }).first().click();
    await mailboxRow(a, "Trash").click();
    await row(a, subject).click();
    await viewer(a).getByRole("button", { name: "Delete" }).first().click();
    await seen(async () => (await row(a, subject).count()) === 0);
    await mailboxRow(a, "Inbox").click();
  };
  const setRemove = async (option) => {
    await openPane(a, "General");
    await choose(a, preferences(a), "Remove unedited downloads:", option);
    await seen(async () => (await values(a))["mail.settings"]?.remove === option, 15_000);
    await closePreferences(a);
  };

  const same = `Same-${id}.txt`;
  const edited = `Edited-${id}.txt`;
  const first = `Files ${id}`;
  await saveAll(first, [same, edited]);
  const before = await driveEntry(edited);
  const version = await a.evaluate(async (entry) => {
    const send = (path, init) => fetch(`/api/files${path}`, init);
    const json = { "content-type": "application/json" };
    const bytes = new TextEncoder().encode("edited by the person");
    const started = await send("/uploads", {
      method: "POST",
      headers: { ...json, "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        parent: entry.parent,
        name: entry.name,
        size: bytes.length,
        type: "text/plain",
        existing: "overwrite",
        replaces: entry.id,
      }),
    }).then((reply) => reply.json());
    await send(`/uploads/${started.upload}/0`, { method: "PUT", body: bytes });
    const drive = await send(`/uploads/${started.upload}/complete`, {
      method: "POST",
      headers: json,
      body: "{}",
    }).then((reply) => reply.json());
    return drive.entries.find((each) => each.id === entry.id)?.version;
  }, before);
  step(
    "saving over one raises its version",
    version > (before.version ?? 0),
    `${before.version} to ${version}`,
  );
  await erase(first);
  const unedited = await seen(() => trashed(same), 15_000);
  step(
    "After Message is Deleted: erasing the message moves the unedited file to the Trash",
    unedited,
  );
  step(
    "the file saved over since stays where it was",
    !(await trashed(edited)) && (await driveEntry(edited))?.parent === before.parent,
  );

  await setRemove("Never");
  const never = `Never-${id}.txt`;
  const third = `Kept ${id}`;
  await saveAll(third, [never]);
  await erase(third);
  const forgotten = await seen(
    async () => !((await values(a))["mail.downloads"] ?? []).some((each) => each.name === never),
    15_000,
  );
  step(
    "Never: erasing the message leaves the file and forgets it",
    forgotten && !(await trashed(never)),
  );

  await setRemove("When Mail Quits");
  const quits = `Quits-${id}.txt`;
  const second = `Quit ${id}`;
  await saveAll(second, [quits]);
  step("When Mail Quits: the file stays while Mail runs", !(await trashed(quits)));
  await menuPath(a, "Mail", "Quit Mail");
  step(
    "When Mail Quits: Quit Mail moves it to the Trash",
    await seen(() => trashed(quits), 15_000),
  );
  await shot(a, "downloads-after-quit");
}

async function markup(a, b) {
  await openMail(a);
  const subject = `Marked ${id}`;
  const picture = await whitePicture(a);
  await newMessage(a);
  await address(a, martin.name);
  await compose(a).getByLabel("Subject:").fill(subject);
  await attach(a, { name: "plan.png", mimeType: "image/png", buffer: picture });
  await a.waitForTimeout(1_500);
  await compose(a).getByRole("button", { name: "Close" }).first().click();
  await a
    .getByRole("button", { name: /^Save$/ })
    .click({ timeout: 2_000 })
    .catch(() => {});
  await seen(async () => (await compose(a).count()) === 0, 10_000);
  const drafted = await seen(async () => Boolean(await onServer(a, subject)), 15_000);
  step("the picture is in a saved draft", drafted);
  await a.reload({ waitUntil: "load" });
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openMail(a);
  await viewer(a).getByText("Drafts", { exact: true }).first().click();
  await row(a, subject).dblclick();
  await compose(a).waitFor({ timeout: 10_000 });
  const open = compose(a).getByLabel("Markup", { exact: true }).first();
  step(
    "after a reload the reopened draft's picture can be marked up",
    await seen(() => open.isEnabled(), 10_000),
  );
  await open.click();
  const sheet = a.getByRole("dialog", { name: /^Markup: plan\.png/ });
  await sheet.waitFor({ timeout: 10_000 });
  const canvas = sheet.getByLabel("Picture to mark up");
  step(
    "the sheet holds the picture, read from the server",
    await seen(async () => (await canvas.evaluate((each) => each.width)) === 400),
  );
  const place = await canvas.boundingBox();
  const at = (x, y) => [place.x + (x / 400) * place.width, place.y + (y / 200) * place.height];
  await sheet
    .getByRole("toolbar", { name: "Markup tools" })
    .getByRole("button", { name: "Rectangle", exact: true })
    .click();
  await a.mouse.move(...at(20, 20));
  await a.mouse.down();
  await a.mouse.move(...at(120, 80), { steps: 4 });
  await a.mouse.up();
  await shot(a, "markup-reopened");
  await sheet.getByRole("button", { name: "Done" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 8_000 });
  const strip = compose(a).getByRole("list", { name: "Attachments" });
  await seen(
    async () =>
      (await strip.getByRole("listitem").count()) === 1 &&
      /KB|bytes/.test(await strip.innerText()) &&
      !/Uploading/.test(await strip.innerText()),
    15_000,
  );
  step("it was sent", await sendIt(a));
  await seen(async () => Boolean(await onServer(b, subject)), 20_000);
  const received = await onServer(b, subject);
  const pixels = await b.evaluate(
    async ({ url }) => {
      const reply = await fetch(url, { credentials: "same-origin" });
      if (!reply.ok) return { status: reply.status };
      const bitmap = await createImageBitmap(await reply.blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const at = (x, y) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
      return { width: bitmap.width, edge: at(20, 50), inside: at(70, 50) };
    },
    {
      url: `/api/mail/messages/${received?.id}/attachments/${received?.attachments?.[0]?.id}?piece=0&count=8`,
    },
  );
  step(
    "the file Martin receives holds the mark over the draft's picture",
    pixels.width === 400 &&
      pixels.edge?.[0] > 180 &&
      pixels.edge[2] < 120 &&
      pixels.inside?.[1] === 255,
    `${JSON.stringify(pixels)} ${JSON.stringify(received?.attachments)}`,
  );
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openMail(a);
  await openMail(b);
  const parts = process.argv.includes("--only")
    ? process.argv[process.argv.indexOf("--only") + 1].split(",")
    : ["markup", "prefs", "later", "tabs", "downloads"];
  if (parts.includes("markup")) await markup(a, b);
  if (parts.includes("prefs")) await prefs(a, b);
  if (parts.includes("later")) await later(a, b);
  if (parts.includes("tabs")) await tabs(a);
  if (parts.includes("downloads")) await downloads(a, b);
});
