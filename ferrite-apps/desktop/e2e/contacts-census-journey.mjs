#!/usr/bin/env node
// Contacts census (R6, round 3): one ok/FAIL line per census id (census/contacts.rows.mjs), real input, served.
//   node e2e/contacts-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url ...] [--phase all|write|restart-check]
//
// With --batch it walks instead the commands of features/contacts.md that this census does not reach, by real input,
// read back from the server: Preferences' panes and the settings they keep, Discard Changes, Make This My Card,
// Reorder, Sort By's bold name, the Delete Smart Group alert, the archive, pictures in vCard files, a picture dropped
// on a card, the value menu, web addresses, a name's vCard drag, Share, Transformations, Speech, and the group
// and card kept across a reload. Each step's label starts with its row's name. Screenshots `contacts-batch-<section>`.
//   node e2e/contacts-census-journey.mjs --batch [--url ...] [--out ...] [--browser chromium]

import { readFile } from "node:fs/promises";
import { ROWS } from "./census/contacts.rows.mjs";
import { familyCensus } from "./census/r6-family.mjs";
import { twoPeople, within } from "./people-kit.mjs";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/Ul1gnQAAAABJRU5ErkJggg==";

async function batch() {
  const { step, run, shot } = twoPeople("contacts-batch");
  const id = Date.now().toString(36);
  const chris = { name: `cbchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
  const ADA = `Ada${id}`;
  const BEN = `Ben${id}`;

  const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
  const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
  const rowOf = (page, name) => rows(page).filter({ hasText: name }).first();
  const seen = (check, ms = 8_000) => within(ms, check).then((took) => took !== null);
  const fetched = async (page, path) =>
    (await page.request.get(new URL(path, page.url()).href)).json();
  const cards = async (page) => (await fetched(page, "/api/contacts/cards")).cards ?? [];
  const cardNamed = async (page, first) => (await cards(page)).find((card) => card.first === first);
  const settings = async (page) =>
    (await fetched(page, "/api/system-preferences/settings")).values ?? {};
  const openMenu = async (page, title) => {
    await page
      .getByRole("menubar")
      .getByRole("menuitem", { name: title, exact: true })
      .first()
      .click();
    await page.getByRole("menu").last().waitFor({ timeout: 5_000 });
  };
  const row = (page, name) =>
    page.getByRole("menu").last().locator('[role^="menuitem"]').filter({ hasText: name }).first();
  const menu = async (page, title, name) => {
    await openMenu(page, title);
    await row(page, name).click();
  };
  const submenu = async (page, title, parent, name) => {
    await openMenu(page, title);
    await row(page, parent).click();
    await row(page, name).waitFor({ timeout: 5_000 });
    await row(page, name).click();
  };
  const closeMenus = async (page) => {
    for (let tries = 0; tries < 4 && (await page.getByRole("menu").count()) > 0; tries += 1) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(80);
    }
  };
  const command = async (page, item) => {
    await windowOf(page).getByRole("button", { name: "Contacts commands" }).click();
    await page.getByRole("menuitem", { name: item }).click();
  };
  const alertOf = (page) => page.getByRole("alertdialog").last();
  const notice = async (page) => {
    const alert = alertOf(page);
    await alert.waitFor({ timeout: 10_000 });
    const text = (await alert.innerText()).replace(/\s+/g, " ");
    await alert.getByRole("button", { name: "OK" }).click();
    return text;
  };
  const downloaded = async (page, open) => {
    const waiting = page.waitForEvent("download", { timeout: 15_000 });
    await open();
    const download = await waiting;
    return {
      name: download.suggestedFilename(),
      text: await readFile(await download.path(), "utf8"),
    };
  };
  const importFile = async (page, file) => {
    const choosing = page.waitForEvent("filechooser", { timeout: 8_000 });
    await menu(page, "File", /^Import…/);
    await (await choosing).setFiles(file);
  };
  const heading = (page) => windowOf(page).locator(".mac-contacts-name").first();
  const tile = (page, name) =>
    page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });
  const front = async (page) => {
    const cardMenu = page.getByRole("menubar").getByRole("menuitem", { name: "Card", exact: true });
    for (let tries = 0; tries < 3; tries += 1) {
      await tile(page, "Contacts").click();
      await windowOf(page).waitFor({ state: "visible", timeout: 15_000 });
      if ((await within(5_000, () => cardMenu.first().isVisible())) !== null) return;
      console.log("note: Contacts was not frontmost after a click on its Dock tile");
    }
  };
  const vcard = (first, last, extra = []) => ({
    name: `${first}.vcf`,
    mimeType: "text/vcard",
    buffer: Buffer.from(
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${last};${first};;;`,
        `FN:${first} ${last}`,
        ...extra,
        "END:VCARD",
        "",
      ].join("\r\n"),
    ),
  });

  await run({}, {}, async ({ person }) => {
    const page = await person("chris", chris);
    await front(page);
    await seen(() => rowOf(page, chris.fullName).isVisible(), 15_000);

    // Preferences, and what they keep on the server.
    await menu(page, "Contacts", /^Preferences/);
    const prefs = page.locator(".mac-contacts-preferences").first();
    await prefs.waitFor({ timeout: 8_000 });
    await prefs.getByRole("combobox", { name: "Address Format" }).click();
    await page.getByRole("option", { name: "Germany" }).click();
    await shot(page, "contacts-batch-prefs-general");
    await prefs.getByRole("tab", { name: "Template" }).click();
    await prefs.getByRole("checkbox", { name: "Nickname" }).click();
    await shot(page, "contacts-batch-prefs-template");
    await prefs.getByRole("tab", { name: "Phone" }).click();
    await prefs.getByRole("checkbox", { name: /format phone numbers/ }).click();
    await shot(page, "contacts-batch-prefs-phone");
    await prefs.getByRole("tab", { name: "vCard" }).click();
    await prefs.getByRole("checkbox", { name: /notes/ }).click();
    await shot(page, "contacts-batch-prefs-vcard");
    let kept = {};
    const allKept = await seen(async () => {
      kept = await settings(page);
      return (
        kept["contacts.addressFormat"] === "de" &&
        kept["contacts.phoneFormat"] === true &&
        kept["contacts.vcardNotes"] === false &&
        JSON.stringify(kept["contacts.template"]) === '["nickname"]'
      );
    }, 12_000);
    step(
      "Preferences: contacts.* settings are taken by the settings route and read back from the server",
      allKept,
      JSON.stringify(
        Object.fromEntries(Object.entries(kept).filter(([key]) => key.startsWith("contacts."))),
      ),
    );
    await prefs.getByRole("button", { name: /close/i }).first().click();
    await front(page);

    // Pictures in vCard files, the phone format and the address format.
    await importFile(
      page,
      vcard(ADA, "Marsh", [
        "TEL;TYPE=CELL:5550100000",
        "ADR;TYPE=HOME:;;1 Quay;Bonn;;53111;",
        "URL:https://example.com/ada",
        "NOTE:ferry",
        `PHOTO;ENCODING=b;TYPE=PNG:${PNG}`,
      ]),
    );
    const imported = await notice(page);
    step(
      "Pictures in vCard files: the import does not say a picture was left out",
      !/left out/.test(imported),
      imported,
    );
    const framed = await seen(async () => Boolean((await cardNamed(page, ADA))?.image));
    const ada = await cardNamed(page, ADA);
    const stored = framed ? await fetched(page, `/api/contacts/pictures?ids=${ada.id}`) : {};
    step(
      "Pictures in vCard files: an imported PNG is the card's picture, read from the server",
      stored.pictures?.[ada.id]?.image === `data:image/png;base64,${PNG}`,
    );
    await rowOf(page, ADA).click();
    step(
      "Phone preference: the number on a finished card reads formatted",
      await seen(() => windowOf(page).getByText("(555) 010-0000").first().isVisible()),
    );
    step(
      "Address format: the card lays the address out for Germany",
      await seen(async () =>
        (await windowOf(page).getByRole("group", { name: "address" }).innerText()).includes(
          "53111 Bonn",
        ),
      ),
    );
    await shot(page, "contacts-batch-card");
    await importFile(page, vcard(BEN, "Abbot"));
    await notice(page);
    await rowOf(page, ADA).click();

    // Export reads the vCard preference, with the picture.
    const exportVCard = () =>
      downloaded(page, async () => {
        await submenu(page, "File", /^Export$/, /^Export vCard…/);
      });
    const bare = await exportVCard();
    step(
      "Preferences vCard: notes off leaves NOTE out, and the picture is written",
      !bare.text.includes("NOTE:") && bare.text.replace(/\r\n /g, "").includes(`TYPE=PNG:${PNG}`),
      bare.name,
    );

    // Discard Changes.
    await menu(page, "Card", /^Edit Card/);
    const firstField = windowOf(page).getByRole("textbox", { name: "First", exact: true });
    await firstField.fill(`Zed${id}`);
    await menu(page, "Card", /^Discard Changes/);
    await shot(page, "contacts-batch-discard");
    step(
      "Discard an edit: the card is as it was, and no longer being edited",
      await seen(async () => (await heading(page).innerText()).includes(ADA)),
    );
    step(
      "Discard an edit: the server keeps the name from before",
      await seen(
        async () =>
          (await cardNamed(page, ADA)) !== undefined && !(await cardNamed(page, `Zed${id}`)),
      ),
    );
    await menu(page, "File", /^New Card/);
    step(
      "Template: a new card starts with the field Preferences named",
      await seen(() =>
        windowOf(page).getByRole("textbox", { name: "Nickname" }).first().isVisible(),
      ),
    );
    await shot(page, "contacts-batch-new-card");
    const before = (await cards(page)).length;
    await menu(page, "Card", /^Discard Changes/);
    step(
      "Discard an edit: a card just made goes",
      await seen(
        async () => (await cards(page)).length <= before && (await rows(page).count()) === 3,
      ),
    );
    await rowOf(page, ADA).click();

    // Make This My Card.
    await menu(page, "Card", /^Make This My Card/);
    const moved = await seen(async () => {
      const list = await cards(page);
      const mine = list.filter((card) => card.me);
      return mine.length === 1 && mine[0].first === ADA && mine[0].user === chris.name;
    });
    step("Make This My Card: the mark and the account name move, on the server", moved);
    await shot(page, "contacts-batch-my-card");
    await menu(page, "Edit", /^Undo Make This My Card/);
    step(
      "Make This My Card: Undo gives them back",
      await seen(async () => (await cards(page)).find((card) => card.me)?.first === "Chris"),
    );

    // Reorder.
    await menu(page, "Card", /^Reorder Last Name/);
    step(
      "Reorder Last Name Before First: the names change places, on the server",
      await seen(async () => (await cardNamed(page, "Marsh"))?.last === ADA),
    );
    await shot(page, "contacts-batch-reorder");
    await menu(page, "Edit", /^Undo Reorder/);
    await seen(async () => Boolean(await cardNamed(page, ADA)));

    // Sort By's bold name.
    const sortBy = async (name) => {
      await openMenu(page, "View");
      await row(page, /^Sort By/).click();
      await row(page, name).click();
    };
    const bold = () => rowOf(page, ADA).locator(".mac-contacts-sort").innerText();
    const boldBefore = await bold();
    await sortBy(/^First Name/);
    step(
      "Sort By First or Last Name: the bold name follows",
      boldBefore === "Marsh" && (await seen(async () => (await bold()) === ADA)),
      boldBefore,
    );
    await shot(page, "contacts-batch-sort-first");
    await sortBy(/^Last Name/);
    step(
      "Sort By First or Last Name: back on Last Name, the names read first then last",
      await seen(
        async () =>
          (await bold()) === "Marsh" && (await rowOf(page, ADA).innerText()).startsWith(ADA),
      ),
    );

    // Delete Smart Group asks.
    await command(page, /^New Smart Group/);
    const sheet = page.getByRole("dialog").last();
    await sheet.getByRole("textbox", { name: "Smart Group Name" }).fill("Desk");
    await sheet.getByRole("button", { name: /^(OK|Add|Save|Create)$/ }).click();
    const groupRow = windowOf(page).getByRole("treeitem", { name: "Desk" });
    await groupRow.waitFor({ timeout: 8_000 });
    await command(page, /^Delete Smart Group/);
    const asks = await alertOf(page).isVisible();
    await shot(page, "contacts-batch-delete-smart-group");
    await alertOf(page).getByRole("button", { name: "Cancel" }).click();
    const stays = await groupRow.isVisible();
    await command(page, /^Delete Smart Group/);
    await alertOf(page).getByRole("button", { name: "Delete" }).click();
    step(
      "Delete Smart Group: it asks, Cancel keeps it, and Delete takes it from the server",
      asks &&
        stays &&
        (await seen(
          async () =>
            ((await fetched(page, "/api/contacts/smart-groups")).smart_groups ?? []).length === 0,
        )),
    );

    // The archive.
    await rowOf(page, ADA).click();
    const archive = await downloaded(page, () =>
      submenu(page, "File", /^Export$/, /^Contacts Archive/),
    );
    const parsed = JSON.parse(archive.text);
    step(
      "Export > Contacts Archive…: a .abbu of cards, groups and pictures, one JSON document",
      archive.name.endsWith(".abbu") &&
        parsed.format === "macalicious-contacts-archive" &&
        parsed.cards.some((card) => card.first === BEN) &&
        parsed.pictures[ada.id]?.image.includes(PNG),
      archive.name,
    );
    await windowOf(page).getByRole("button", { name: "New Contact" }).click();
    await windowOf(page).getByRole("textbox", { name: "First", exact: true }).fill(`Later${id}`);
    await windowOf(page).getByRole("button", { name: "Done" }).click();
    await seen(async () => Boolean(await cardNamed(page, `Later${id}`)));
    await importFile(page, {
      name: archive.name,
      mimeType: "application/json",
      buffer: Buffer.from(archive.text),
    });
    await alertOf(page).waitFor({ timeout: 8_000 });
    const asksToReplace = (await alertOf(page).innerText()).includes(archive.name);
    await shot(page, "contacts-batch-archive-alert");
    const stillThere = Boolean(await cardNamed(page, `Later${id}`));
    await alertOf(page).getByRole("button", { name: "Replace" }).click();
    step(
      "Export > Contacts Archive…: Import asks, then replaces what is there, on the server",
      asksToReplace &&
        stillThere &&
        (await seen(async () => {
          const list = await cards(page);
          return (
            !list.some((card) => card.first === `Later${id}`) &&
            list.some((card) => card.first === ADA)
          );
        })),
    );
    const after = await cardNamed(page, ADA);
    step(
      "Export > Contacts Archive…: the picture comes back with its card",
      (await fetched(page, `/api/contacts/pictures?ids=${after.id}`)).pictures?.[
        after.id
      ]?.image.includes(PNG) && after.image === ada.image,
    );

    // A picture dropped on a card.
    await rowOf(page, BEN).click();
    await page.waitForTimeout(150);
    await page.evaluate(async (png) => {
      const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], "pic.png", { type: "image/png" }));
      const head = document.querySelector('.mac-contacts .mac-contacts-head[data-mode="view"]');
      head.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }),
      );
      head.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }),
      );
    }, PNG);
    step(
      "Picture onto a card: a file dropped on the head is its picture, on the server",
      await seen(async () => Boolean((await cardNamed(page, BEN))?.image)),
    );
    await shot(page, "contacts-batch-picture-drop");

    // The value menu.
    await rowOf(page, ADA).click();
    const number = windowOf(page).getByText("(555) 010-0000").first();
    await number.waitFor({ timeout: 8_000 });
    await number.click({ button: "right" });
    const fieldMenu = page.getByRole("menu", { name: "Field commands" });
    await fieldMenu.waitFor({ timeout: 5_000 });
    const offered = await fieldMenu.locator('[role="menuitem"]').allInnerTexts();
    await shot(page, "contacts-batch-value-menu");
    await fieldMenu.getByRole("menuitem", { name: "Search in Contacts" }).click();
    step(
      "Field value: Copy, Search and Look Up, and Search fills the search field",
      offered.map((text) => text.trim()).join(",") === "Copy,Search in Contacts,Look Up" &&
        (await windowOf(page).getByRole("searchbox").inputValue()) === "(555) 010-0000",
      offered.join(","),
    );
    await windowOf(page).getByRole("searchbox").fill("");

    // Transformations and Speech.
    await rowOf(page, BEN).click();
    await menu(page, "Card", /^Edit Card/);
    const benField = windowOf(page).getByRole("textbox", { name: "First", exact: true });
    await benField.click();
    await benField.selectText();
    await page.waitForTimeout(100);
    await submenu(page, "Edit", /^Transformations/, /^Make Upper Case/);
    step(
      "Transformations: Make Upper Case changes the text selected in the field",
      await seen(async () => (await benField.inputValue()) === BEN.toUpperCase()),
      await benField.inputValue(),
    );
    await windowOf(page).getByRole("button", { name: "Done" }).click();
    step(
      "Transformations: the change is on the server after Done",
      await seen(async () => Boolean(await cardNamed(page, BEN.toUpperCase()))),
    );
    await openMenu(page, "Edit");
    await row(page, /^Speech/).click();
    const speakRow = row(page, /^Start Speaking/);
    await speakRow.waitFor({ timeout: 5_000 });
    step(
      "Speech: Start Speaking is there, and is dimmed only for a browser without a voice",
      (await speakRow.getAttribute("aria-disabled")) !== "true" ||
        (await speakRow.getAttribute("title")) === "This browser has no voice to speak with.",
    );
    await shot(page, "contacts-batch-edit-menu");
    await closeMenus(page);
    await openMenu(page, "Edit");
    const dictation = row(page, /^Start Dictation/);
    step(
      "Start Dictation: dimmed, saying why",
      (await dictation.getAttribute("aria-disabled")) === "true" &&
        /speech service|text field/.test((await dictation.getAttribute("title")) ?? ""),
    );
    step("Emoji & Symbols: in the Edit menu", await row(page, /^Emoji & Symbols/).isVisible());
    await closeMenus(page);
    await openMenu(page, "Window");
    step(
      "Tile Window: both rows in the Window menu",
      (await row(page, /^Tile Window to Left/).isVisible()) &&
        (await row(page, /^Tile Window to Right/).isVisible()),
    );
    await closeMenus(page);

    // A name dragged out carries the card as a vCard; Finder and the desktop keep it as a file
    // (`contacts-calendar-batch3-journey` reads it). A target on the desktop takes the drop at the
    // window, before the document hears it, so the window is listened to first.
    await page.evaluate(() => {
      window.addEventListener(
        "drop",
        (event) => {
          window.droppedVCard = event.dataTransfer.getData("text/vcard");
        },
        true,
      );
    });
    const source = await rowOf(page, ADA).boundingBox();
    await page.mouse.move(source.x + 40, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + 60, source.y + 30, { steps: 4 });
    await page.mouse.move(1400, 760, { steps: 8 });
    await page.mouse.up();
    let carried = "";
    await seen(async () => {
      carried = (await page.evaluate(() => window.droppedVCard)) ?? "";
      return carried !== "";
    });
    step(
      "Card to Finder as a vCard: the drag of a name carries the card as text/vcard",
      carried.includes(`N:Marsh;${ADA}`),
    );
    await shot(page, "contacts-batch-drag");
    step(
      "Card to Finder as a vCard: the drag does not add the card again",
      (await cards(page)).filter((card) => card.first === ADA).length === 1,
    );

    // The group shown and the card chosen, across a reload.
    await front(page);
    await windowOf(page).getByRole("treeitem", { name: "All iCloud" }).click();
    await rowOf(page, BEN.toUpperCase()).click();
    const placeKept = await seen(async () => {
      const values = await settings(page);
      return (
        values["contacts.groupShown"] === "icloud" &&
        typeof values["contacts.cardChosen"] === "string"
      );
    }, 12_000);
    step("Group shown, card chosen: on the server", placeKept);
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    await front(page);
    step(
      "Group shown, card chosen: both back after a reload",
      (await seen(
        async () => (await heading(page).innerText()).includes(BEN.toUpperCase()),
        15_000,
      )) &&
        (await windowOf(page)
          .getByRole("treeitem", { name: "All iCloud" })
          .getAttribute("aria-selected")) === "true",
    );
    await shot(page, "contacts-batch-after-reload");

    // Share, last: each opens another application over the window.
    await rowOf(page, ADA).click();
    await windowOf(page).getByRole("button", { name: /share/i }).click();
    await page.getByRole("menu").last().waitFor({ timeout: 5_000 });
    const airdrop = row(page, /^AirDrop/);
    step(
      "Share menu: AirDrop is dimmed, saying it needs another machine",
      (await airdrop.getAttribute("aria-disabled")) === "true" &&
        Boolean(await airdrop.getAttribute("title")),
      (await airdrop.getAttribute("title")) ?? "",
    );
    await shot(page, "contacts-batch-share-menu");
    await row(page, /^Mail/).click();
    step(
      "Share menu: Mail takes the card, as a .vcf attached to a new message",
      await seen(
        () =>
          page
            .getByText(new RegExp(`${ADA} Marsh\\.vcf`))
            .first()
            .isVisible(),
        15_000,
      ),
    );
    await shot(page, "contacts-batch-share-mail");
    await front(page);
    await submenu(page, "Card", /^Share My Card/, /^Notes/);
    step(
      "Share My Card…: Notes takes the person's own card, as a .vcf",
      await seen(
        () =>
          page
            .getByText(/Chris .*\.vcf/)
            .first()
            .isVisible(),
        15_000,
      ),
    );
    await shot(page, "contacts-batch-share-notes");

    // Web addresses, opening Safari.
    await front(page);
    await rowOf(page, ADA).click();
    await windowOf(page).locator("a.mac-contacts-link").first().click();
    step(
      "Web addresses: a click opens the address in Safari",
      await seen(
        () =>
          page
            .getByRole("region", { name: /Safari|example\.com/ })
            .first()
            .isVisible(),
        15_000,
      ),
    );
    await shot(page, "contacts-batch-web-address");
  });
}

if (process.argv.includes("--batch")) await batch();
else {
  // The row before it leaves the window on All on My Mac, which the person's own card is not in.
  const myCard = ROWS.find((row) => row.id === "contacts.person-my-card");
  myCard.probe = { ...myCard.probe, reach: [{ role: "treeitem", name: "All Contacts" }] };
  await familyCensus("contacts", ROWS);
}
