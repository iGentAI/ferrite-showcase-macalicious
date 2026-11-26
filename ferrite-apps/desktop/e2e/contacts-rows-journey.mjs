#!/usr/bin/env node
// The rows of Contacts' inventory (features/contacts.md) that had only code behind them, each by real input in a real
// browser against the running app, read back from the server and after a reload where the row keeps data. Each step's
// label starts with its row's name, and each section leaves a screenshot `contacts-rows-<section>`. Two accounts: Chris
// and Martin, a desktop user for the account's rows. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node e2e/contacts-rows-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import { readFile } from "node:fs/promises";
import { twoPeople, within } from "./people-kit.mjs";

const { step, allow, run, shot } = twoPeople("contacts-rows");
const id = Date.now().toString(36);
const chris = { name: `kcchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const martin = { name: `kcmartin-${id}`, fullName: `Martin ${id}`, password: `tide-${id}-pool` };
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/Ul1gnQAAAABJRU5ErkJggg==",
  "base64",
);

const windowOf = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const rows = (page) => windowOf(page).getByRole("listbox").getByRole("option");
const rowOf = (page, name) => rows(page).filter({ hasText: name }).first();
const tree = (page) => windowOf(page).getByRole("tree", { name: "Groups" });
const groupRow = (page, name) => tree(page).getByRole("treeitem", { name });
const seen = (check, ms = 8_000) => within(ms, check).then((took) => took !== null);
// In the open pop-up only: Playwright holds on to the element it first finds, and the pop-up closing a moment ago stays
// mounted, hidden, with the same options.
const choice = (page, name) =>
  page.locator('[role="listbox"][data-open]').getByRole("option", { name, exact: true });
const fetched = async (page, path) => {
  const reply = await page.request.get(new URL(path, page.url()).href);
  return reply.json();
};
const cards = async (page) => (await fetched(page, "/api/contacts/cards")).cards ?? [];
const cardNamed = async (page, first) => (await cards(page)).find((card) => card.first === first);
const bar = (page) => page.getByRole("menubar");
const openMenu = async (page, title) => {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).first().click();
  await page.getByRole("menu").last().waitFor({ timeout: 5_000 });
};
const row = (page, name) =>
  page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name })
    .or(page.getByRole("menu").last().getByRole("menuitemcheckbox", { name }))
    .first();
const menu = async (page, title, name) => {
  await openMenu(page, title);
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
  await page.getByRole("menuitem", { name: item, exact: true }).click();
};
const notice = async (page) => {
  const alert = page.getByRole("alertdialog").or(page.getByRole("dialog")).last();
  await alert.waitFor({ timeout: 10_000 });
  const text = (await alert.innerText()).replace(/\s+/g, " ");
  await alert.getByRole("button", { name: "OK" }).click();
  return text;
};
const downloaded = async (page, open) => {
  const waiting = page.waitForEvent("download", { timeout: 10_000 });
  await open();
  const download = await waiting;
  return {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), "utf8"),
  };
};
const driveFile = async (page, name) => {
  let found = null;
  await within(15_000, async () => {
    const { entries } = await fetched(page, "/api/files/");
    found = entries?.find((entry) => entry.name === name && !entry.trashed_ms) ?? null;
    return found !== null;
  });
  return found;
};
const driveText = async (page, file) => {
  const url = new URL(`/api/files/content/${file.id}?piece=0&count=8`, page.url()).href;
  return (await page.request.get(url)).text();
};
const printed = async (page, open) => {
  await page.evaluate(() => {
    window.printedPage = "";
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await open();
  let html = "";
  await within(10_000, async () => {
    html = (await page.evaluate(() => window.printedPage)) ?? "";
    return html !== "";
  });
  return html;
};
const tile = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });
const shellOf = (page, windowId) => page.locator(`[data-window-id="${windowId}"]`);
const hidden = (page, windowId) =>
  shellOf(page, windowId).evaluate((shell) => shell.hasAttribute("data-minimized"));
const zOf = (page, windowId) =>
  shellOf(page, windowId).evaluate((shell) => Number(getComputedStyle(shell).zIndex));
const stateOf = (page, windowId) =>
  shellOf(page, windowId).locator("[data-window-state]").first().getAttribute("data-window-state");
const boxOf = (page, windowId) => shellOf(page, windowId).boundingBox();
const open = async (page) => {
  await tile(page, "Contacts").click();
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
};
const reopen = async (page) => {
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
  if ((await windowOf(page).count()) === 0) await tile(page, "Contacts").click();
  await windowOf(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
};
const editor = (page) => windowOf(page).getByRole("button", { name: "Done", exact: true });
const field = (page, name) => windowOf(page).getByRole("textbox", { name, exact: true });
const newCard = async (page, first, last = "") => {
  await windowOf(page).getByRole("button", { name: "New Contact" }).click();
  await field(page, "First").fill(first);
  if (last) await field(page, "Last").fill(last);
  await editor(page).click();
  await seen(async () => Boolean(await cardNamed(page, first)));
  await rowOf(page, first).waitFor({ timeout: 5_000 });
};
const heading = (page) => windowOf(page).getByRole("heading", { level: 2 });

await run(
  { chromium: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
  {},
  async ({ person }) => {
    const martinPage = await person("martin", martin);
    martinPage.setDefaultTimeout(8_000);
    const page = await person("chris", chris);
    page.setDefaultTimeout(8_000);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const FIRST = `Ada${id}`;
    const section = async (name, body) => {
      try {
        await closeMenus(page);
        await body();
      } catch (error) {
        step(`${name}: the section ran to its end`, false, String(error.message).split("\n")[0]);
        await shot(page, `contacts-rows-${name}-failed`);
        await closeMenus(page);
        if (
          await editor(page)
            .isVisible()
            .catch(() => false)
        )
          await editor(page).click();
      }
    };
    await open(page);

    await section("windows", async () => {
      step(
        "Three panes: groups, the list of names and the card",
        (await tree(page).isVisible()) &&
          (await windowOf(page).getByRole("listbox").isVisible()) &&
          (await heading(page).isVisible()),
      );
      step(
        "Rows, sort name in semibold: the person's card, with the sort name in bold",
        (await rowOf(page, chris.fullName)
          .locator(".mac-contacts-sort")
          .evaluate((node) => Number(getComputedStyle(node).fontWeight) >= 500)) &&
          (await rowOf(page, chris.fullName).locator(".mac-contacts-sort").innerText()) === id,
        await rowOf(page, chris.fullName).innerText(),
      );
      step(
        "My card's mark: on the person's own row and no other",
        (await rowOf(page, chris.fullName).locator(".mac-contacts-me").count()) === 1,
      );
      step(
        "Account row: shows the person's account",
        (await windowOf(page).locator("[data-account]").first().innerText()).includes(chris.name),
      );
      await shot(page, "contacts-rows-windows");
    });

    await section("editing", async () => {
      await windowOf(page).getByRole("button", { name: "New Contact" }).click();
      step(
        "Plus, New Contact: a new card opens to fill in",
        await seen(() => editor(page).isVisible(), 3_000),
      );
      await field(page, "First").fill(FIRST);
      await field(page, "Last").fill("Ringer");
      await field(page, "Company name").fill("Harbor Ferry");
      await field(page, "mobile phone").fill("555 0100");
      step(
        "Empty row adds a field: typing in the phone's empty row gives another below it",
        await seen(
          () =>
            windowOf(page)
              .getByRole("group", { name: "phone" })
              .getByRole("textbox")
              .nth(1)
              .isVisible(),
          3_000,
        ),
      );
      await field(page, "home email").fill("ada@ringer.example");
      await field(page, "home user name").fill("adachat");
      await windowOf(page)
        .getByRole("group", { name: "note" })
        .getByRole("textbox")
        .or(field(page, "note"))
        .first()
        .fill("Runs the crossings");
      const server = () => cardNamed(page, FIRST);
      await windowOf(page).getByRole("combobox", { name: "email label" }).first().click();
      await choice(page, "work").click();
      const labelChanged = await seen(
        async () =>
          (await windowOf(page).getByRole("textbox", { name: "work email" }).count()) === 1,
        3_000,
      );
      await shot(page, "contacts-rows-editing");
      step("Label pop-ups: choosing another label names the field", labelChanged);

      await windowOf(page).getByRole("combobox", { name: "phone label" }).first().click();
      await choice(page, "Custom…").click();
      const custom = windowOf(page).getByRole("textbox", { name: "Custom label" });
      await custom.fill("ferry");
      await custom.press("Enter");
      const byReturn = await seen(
        async () =>
          (await windowOf(page).getByRole("textbox", { name: "ferry phone" }).count()) === 1,
        3_000,
      );
      step("Custom label: typed for a field, and named by it", byReturn);
      await windowOf(page).getByRole("combobox", { name: "phone label" }).first().click();
      await choice(page, "Custom…").click();
      await custom.fill("gone");
      await custom.press("Escape");
      const byEscape = await seen(
        async () =>
          (await custom.count()) === 0 &&
          (await windowOf(page).getByRole("textbox", { name: "ferry phone" }).count()) === 1,
        3_000,
      );
      step(
        "Return and Escape in a custom label: Return keeps it, Escape gives it up",
        byReturn && byEscape,
      );
      const customAgain = async (typed) => {
        await windowOf(page)
          .getByRole("combobox", { name: /phone label/ })
          .first()
          .click();
        await choice(page, "Custom…").click();
        await custom.fill(typed);
      };
      await customAgain("quick");
      await custom.press("Tab");
      step(
        "Leaving a custom label names the field, however soon",
        await seen(
          async () =>
            (await windowOf(page).getByRole("textbox", { name: "quick phone" }).count()) === 1,
          3_000,
        ),
      );
      await customAgain("ferry");
      await custom.press("Enter");
      await seen(
        async () =>
          (await windowOf(page).getByRole("textbox", { name: "ferry phone" }).count()) === 1,
        3_000,
      );

      await field(page, "home URL")
        .or(field(page, "home page URL"))
        .first()
        .fill("https://ringer.example");
      await windowOf(page)
        .getByRole("button", { name: /^Remove .* URL$/ })
        .click();
      step(
        "Remove a field: its red button takes it away",
        await seen(
          async () =>
            (await windowOf(page)
              .getByRole("button", { name: /^Remove .* URL$/ })
              .count()) === 0,
          3_000,
        ),
      );

      const box = windowOf(page).getByRole("checkbox", { name: "Company" });
      await box.click();
      const company = await seen(async () => (await server())?.isCompany === true);
      await box.click();
      step(
        "Company checkbox: on the server, and off again",
        company && (await seen(async () => !(await server())?.isCompany)),
      );
      step(
        "Text fields for every value: what is typed is on the server",
        await seen(async () => {
          const card = await server();
          return (
            card?.last === "Ringer" &&
            card.company === "Harbor Ferry" &&
            card.phones?.[0]?.value === "555 0100" &&
            card.emails?.[0]?.value === "ada@ringer.example" &&
            card.ims?.[0]?.value === "adachat" &&
            card.note === "Runs the crossings"
          );
        }),
        JSON.stringify(await server()),
      );

      const segments = windowOf(page).getByRole("group", { name: "Card" });
      await segments.getByRole("button", { name: "Picture" }).click();
      const picturePane = await seen(
        () => windowOf(page).getByRole("radio", { name: "Silhouette" }).isVisible(),
        3_000,
      );
      await segments.getByRole("button", { name: "Info" }).click();
      const infoPane = await seen(() => field(page, "First").isVisible(), 3_000);
      step("Info and Picture segments: each shows its pane", picturePane && infoPane);
      await segments.getByRole("button", { name: "Picture" }).click();
      await windowOf(page).getByRole("radio", { name: "Silhouette" }).click();
      const silhouette = await seen(async () => (await server())?.picture === "silhouette");
      await shot(page, "contacts-rows-picture-pane");
      await windowOf(page).getByRole("radio", { name: "Monogram" }).click();
      step(
        "Monogram and Silhouette: the choice is on the server",
        silhouette && (await seen(async () => (await server())?.picture !== "silhouette")),
      );
      const choosing = page.waitForEvent("filechooser", { timeout: 8_000 });
      await windowOf(page).getByRole("button", { name: "Choose Picture…" }).click();
      await (await choosing).setFiles({ name: "face.png", mimeType: "image/png", buffer: PNG });
      const pictured = await seen(async () => Boolean((await server())?.image));
      await seen(
        () => windowOf(page).locator("img.mac-contacts-picture-image").first().isVisible(),
        5_000,
      );
      await shot(page, "contacts-rows-picture");
      const panel = page.locator(".mac-contacts-panel-layer");
      await windowOf(page).getByRole("button", { name: "Choose from Drive…" }).click();
      const driveOpens = await seen(() => panel.isVisible(), 5_000);
      await page.keyboard.press("Escape");
      await panel
        .getByRole("button", { name: "Cancel" })
        .click({ timeout: 2_000 })
        .catch(() => {});
      await seen(async () => (await panel.count()) === 0, 3_000);
      await windowOf(page).getByRole("button", { name: "Remove Picture" }).click();
      step(
        "Choose Picture…, Choose from Drive…, Remove Picture: a picture on the server, the drive's panel, and removed",
        pictured && driveOpens && (await seen(async () => !(await server())?.image)),
        `${pictured} ${driveOpens}`,
      );
      await segments.getByRole("button", { name: "Info" }).click();
      await editor(page).click();
      const leftEditing = await seen(
        () => windowOf(page).getByRole("button", { name: "Edit", exact: true }).isVisible(),
        3_000,
      );
      await windowOf(page).getByRole("button", { name: "Edit", exact: true }).click();
      const reentered = await seen(() => editor(page).isVisible(), 3_000);
      step(
        "Edit and Done: Done leaves editing, and Edit comes back to it",
        leftEditing && reentered,
      );
      await editor(page).click();
    });

    await section("finished-card", async () => {
      await rowOf(page, FIRST).click();
      await seen(async () => (await heading(page).innerText()).includes(FIRST), 3_000);
      const head = await windowOf(page).locator(".mac-contacts-head").innerText();
      step(
        "Name and company: both at the head of the card",
        head.includes(`${FIRST} Ringer`) && head.includes("Harbor Ferry"),
        head.replace(/\s+/g, " "),
      );
      const text = await windowOf(page).locator(".mac-contacts-fields").innerText();
      step(
        "Phones: its label and number",
        /ferry[\s\S]*555 0100/.test(text),
        text.replace(/\s+/g, " "),
      );
      step("Email addresses: its label and address", /work[\s\S]*ada@ringer\.example/.test(text));
      step("Messaging names: the name and its service", text.includes("adachat"));
      step("Note: on the card", text.includes("Runs the crossings"));
      const monogram = await windowOf(page)
        .locator(".mac-contacts-head")
        .innerText()
        .then(() =>
          windowOf(page)
            .locator(
              ".mac-contacts-head .mac-contacts-picture, .mac-contacts-head [class*=monogram]",
            )
            .first()
            .isVisible(),
        );
      step("Picture or monogram: a card with no picture shows its monogram", monogram);
      await shot(page, "contacts-rows-finished-card");
    });

    await section("keyboard", async () => {
      await newCard(page, `Bea${id}`, "Zed");
      await newCard(page, `Cleo${id}`, "Moss");
      await groupRow(page, "All Contacts").click();
      const selected = () => windowOf(page).getByRole("listbox").locator('[aria-selected="true"]');
      await rowOf(page, FIRST).click();
      await page.keyboard.press("ArrowDown");
      const first = await seen(
        async () => !(await selected().first().innerText()).includes(FIRST),
        2_000,
      );
      const after = await selected().first().innerText();
      await page.keyboard.press("ArrowUp");
      step(
        "Arrow keys in the list: down and up move the card shown",
        first && (await seen(async () => (await heading(page).innerText()).includes(FIRST), 2_000)),
        after,
      );
      await page.keyboard.type(`Cleo`);
      step(
        "Type-select in the list: letters typed go to the name",
        await seen(async () => (await heading(page).innerText()).includes("Cleo"), 3_000),
        await heading(page).innerText(),
      );
      await page.waitForTimeout(1_200);
      await shot(page, "contacts-rows-keyboard");
    });

    await section("sidebar", async () => {
      const search = windowOf(page).getByRole("searchbox");
      await search.fill("crossings");
      const byNote = await seen(
        async () => (await rows(page).count()) === 1 && (await rowOf(page, FIRST).isVisible()),
        3_000,
      );
      await search.fill("ADA@RINGER");
      const byField = await seen(async () => (await rows(page).count()) === 1, 3_000);
      await search.fill("no such thing");
      const none = await seen(() => windowOf(page).getByText("No Results").isVisible(), 3_000);
      await shot(page, "contacts-rows-search");
      await search.fill("");
      step(
        "Search: a note and a field find the card, ignoring case, and other words find none",
        byNote && byField && none,
        `${byNote} ${byField} ${none}`,
      );

      const allCount = await rows(page).count();
      step(
        "All Contacts: every card",
        (await groupRow(page, "All Contacts").getAttribute("aria-selected")) === "true" &&
          allCount === 4,
        String(allCount),
      );
      await groupRow(page, "All iCloud").click();
      const icloud = await seen(async () => (await rows(page).count()) === allCount, 3_000);
      await shot(page, "contacts-rows-sidebar");
      step(
        "All iCloud lists every card, since every card here is in that account",
        icloud,
        String(await rows(page).count()),
      );
      await groupRow(page, "All on My Mac").click();
      const mac = await seen(
        () =>
          windowOf(page)
            .getByText(/No Cards/)
            .isVisible(),
        3_000,
      );
      step(
        "All on My Mac: the cards of that account, and none yet",
        mac,
        String(await rows(page).count()),
      );
      await groupRow(page, "All Contacts").click();
      await menu(page, "View", /^Hide Groups/);
      const hid = await seen(async () => (await tree(page).count()) === 0, 3_000);
      const controls = await windowOf(page).locator(".mac-contacts-controls").isVisible();
      await shot(page, "contacts-rows-groups-hidden");
      step(
        "Hiding the sidebar: View > Hide Groups, and the window controls move onto the list",
        hid && controls,
      );
      await page.keyboard.press("Control+1");
      const back = await seen(() => tree(page).isVisible(), 3_000);
      step("Show or Hide Groups ⌘1: the item and the key", hid && back);
    });

    await section("file", async () => {
      const search = windowOf(page).getByRole("searchbox");
      await search.fill("Ringer");
      await seen(async () => (await rows(page).count()) === 1, 3_000);
      await menu(page, "File", /^New Smart Group from Current Search/);
      const madeGroup = await seen(() => groupRow(page, /Ringer/).isVisible(), 4_000);
      await search.fill("");
      await groupRow(page, /Ringer/).click();
      step(
        "New Smart Group from Current Search: named for the search, finding what it finds",
        madeGroup &&
          (await seen(async () => (await rows(page).count()) === 1, 3_000)) &&
          (await rowOf(page, FIRST).isVisible()) &&
          (await seen(async () =>
            JSON.stringify(await fetched(page, "/api/contacts/smart-groups")).includes("Ringer"),
          )),
      );
      await shot(page, "contacts-rows-smart-search");
      await groupRow(page, "All Contacts").click();
      await menu(page, "File", /^New Smart Group…/);
      const sheet = page.getByRole("dialog", { name: "New Smart Group" });
      await sheet.waitFor({ timeout: 5_000 });
      await shot(page, "contacts-rows-smart-sheet");
      await sheet.getByRole("textbox", { name: "Smart Group Name" }).fill(`Filed ${id}`);
      await sheet.getByRole("button", { name: "OK", exact: true }).click();
      step(
        "New Smart Group ⌥⌘N: its sheet makes a group, on the server",
        (await seen(() => groupRow(page, `Filed ${id}`).isVisible(), 4_000)) &&
          (await seen(async () =>
            JSON.stringify(await fetched(page, "/api/contacts/smart-groups")).includes(
              `Filed ${id}`,
            ),
          )),
      );
      step(
        "Smart Groups section: lists both under its title",
        /Smart Groups[\s\S]*Filed/.test(await tree(page).innerText()),
      );
      await groupRow(page, "All Contacts").click();
      await rowOf(page, FIRST).click();

      const choosing = page.waitForEvent("filechooser", { timeout: 8_000 });
      await menu(page, "File", /^Import…/);
      await (await choosing).setFiles({
        name: "edna.vcf",
        mimeType: "text/vcard",
        buffer: Buffer.from(
          `BEGIN:VCARD\r\nVERSION:3.0\r\nN:Imported;Edna${id};;;\r\nFN:Edna${id} Imported\r\nEND:VCARD\r\n`,
        ),
      });
      const read = await notice(page);
      step(
        "Import… ⌘O: a vCard from the computer, on the server",
        read.includes("1 card was imported") &&
          (await seen(async () => Boolean(await cardNamed(page, `Edna${id}`)))),
        read,
      );
      await rowOf(page, FIRST).click();
      const exported = await downloaded(page, async () => {
        await openMenu(page, "File");
        await page.getByRole("menu").last().getByText("Export", { exact: true }).click();
        await page.getByRole("menu").last().getByText("Export vCard…").click();
      });
      step(
        "Export > Export vCard…: downloads the card shown",
        exported.name.endsWith(".vcf") && exported.text.includes(`N:Ringer;${FIRST}`),
        exported.name,
      );
      const html = await printed(page, () => menu(page, "File", /^Export as PDF/));
      step(
        "Export as PDF…: the page handed to the print dialog holds the card",
        html.includes(`${FIRST} Ringer`) && html.includes("555 0100"),
      );
      const printedAgain = await printed(page, () => menu(page, "File", /^Print/));
      step(
        "Print… ⌘P: the page handed to the print dialog holds its name, company and fields",
        printedAgain.includes(`${FIRST} Ringer`) &&
          printedAgain.includes("Harbor Ferry") &&
          printedAgain.includes("ada@ringer.example"),
      );
      await shot(page, "contacts-rows-file");
      await menu(page, "File", /^Close Window/);
      const closed = await seen(async () => (await windowOf(page).count()) === 0, 3_000);
      await open(page);
      await page.keyboard.press("Control+w");
      step(
        "Close Window ⌘W: the item and the key close it",
        closed && (await seen(async () => (await windowOf(page).count()) === 0, 3_000)),
      );
      await open(page);
    });

    await section("card-menu", async () => {
      await rowOf(page, FIRST).click();
      const server = () => cardNamed(page, FIRST);
      await menu(page, "Card", /^Mark as a Company/);
      const on = await seen(async () => (await server())?.isCompany === true);
      await shot(page, "contacts-rows-card-menu");
      await page.keyboard.press("Control+\\");
      step(
        "Mark as a Company ⌘\\: the item and the key, on the server",
        on && (await seen(async () => !(await server())?.isCompany)),
      );
      const choosing = page.waitForEvent("filechooser", { timeout: 8_000 });
      await menu(page, "Card", /^Choose Custom Image/);
      await (await choosing).setFiles({ name: "face.png", mimeType: "image/png", buffer: PNG });
      const imaged = await seen(async () => Boolean((await server())?.image));
      step("Choose Custom Image… ⌥⌘I: a picture on the server", imaged);
      await menu(page, "Card", /^Clear Custom Image/);
      step(
        "Clear Custom Image: taken off, on the server",
        await seen(async () => !(await server())?.image),
      );
      await openMenu(page, "Card");
      await row(page, /^Add Field/).hover();
      await page.getByRole("menuitem", { name: "Nickname", exact: true }).click();
      const nick = field(page, "Nickname");
      await nick.waitFor({ timeout: 3_000 });
      const focused = await nick.evaluate((node) => node === document.activeElement);
      await nick.fill("Addie");
      await shot(page, "contacts-rows-add-field");
      await editor(page).click();
      step(
        "Add Field submenu: goes to editing with the keyboard in the field, and it is on the server",
        focused && (await seen(async () => (await server())?.nickname === "Addie")),
      );
    });

    await section("commands", async () => {
      await command(page, "Add Desktop User…");
      const sheet = page.getByRole("dialog", { name: "Add a Desktop User" });
      await sheet.getByRole("textbox", { name: "Account Name" }).fill(martin.name);
      await shot(page, "contacts-rows-commands");
      await sheet.getByRole("button", { name: "Add", exact: true }).click();
      await sheet.waitFor({ state: "hidden", timeout: 8_000 });
      step(
        "Add Desktop User…: makes the card of that account",
        await seen(async () => (await heading(page).innerText()).includes(martin.fullName)),
      );
      step(
        "Commands pull-down: its commands act, as the rows below",
        (await windowOf(page).locator("[data-account]").first().innerText()).includes(martin.name),
      );
      const peopleHas = await seen(async () =>
        (await fetched(page, "/api/contacts/people")).people?.some(
          (one) => one.user === martin.name,
        ),
      );
      step("GET /api/contacts/people lists the desktop user", peopleHas);
      const placed = [];
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          new URL(request.url()).pathname === "/api/facetime/calls"
        ) {
          placed.push(request.postDataJSON()?.kind);
        }
      });
      await windowOf(page).getByRole("button", { name: "FaceTime video" }).click();
      const callState = page.locator("[data-call-state]").first();
      const videoCalled = await seen(async () => {
        const state = await callState.getAttribute("data-call-state");
        return state === "calling" || state === "ringing" || state === "outgoing";
      }, 10_000);
      await shot(page, "contacts-rows-video");
      step(
        "Video button places a FaceTime call: asks FaceTime to call the account",
        videoCalled,
        await callState.getAttribute("data-call-state"),
      );
      const end = page.getByRole("button", { name: /End|Cancel|Hang/ }).first();
      if (await end.isVisible()) await end.click();
      await page.waitForTimeout(800);
      await tile(page, "Contacts").click();
      await page.waitForTimeout(500);
      await windowOf(page).getByRole("button", { name: "FaceTime audio" }).click();
      const audio = await seen(async () => {
        const state = await callState.getAttribute("data-call-state");
        return state === "calling" || state === "ringing" || state === "outgoing";
      }, 10_000);
      await shot(page, "contacts-rows-audio");
      step(
        "the card's FaceTime audio button leaves FaceTime in a call state",
        audio && (await seen(() => placed.at(-1) === "audio", 5_000)),
        `calls placed: ${placed.join(", ")}`,
      );
      if (await end.isVisible()) await end.click();
      await page.waitForTimeout(800);
      await tile(page, "Contacts").click();
      await page.waitForTimeout(500);

      const one = await downloaded(page, () => command(page, "Export Card as vCard"));
      const every = await downloaded(page, () => command(page, "Export All Cards as vCard"));
      step(
        "Export Card and Export All Cards as vCard: one card, then every card",
        one.text.match(/BEGIN:VCARD/g)?.length === 1 &&
          (every.text.match(/BEGIN:VCARD/g)?.length ?? 0) >= 5 &&
          every.text.includes(FIRST),
        `${one.name} ${every.name}`,
      );
      await rowOf(page, `Bea${id}`).click();
      await command(page, "Save Card to Drive…");
      const save = page.getByRole("dialog", { name: "Save" });
      await save.waitFor({ timeout: 8_000 });
      await save.getByLabel("Save As:").fill(`bea-${id}.vcf`);
      await save.getByRole("button", { name: "Save", exact: true }).click();
      await save.waitFor({ state: "hidden", timeout: 8_000 });
      const oneFile = await driveFile(page, `bea-${id}.vcf`);
      await command(page, "Save All Cards to Drive…");
      await save.waitFor({ timeout: 8_000 });
      await save.getByLabel("Save As:").fill(`all-${id}.vcf`);
      await save.getByRole("button", { name: "Save", exact: true }).click();
      await save.waitFor({ state: "hidden", timeout: 8_000 });
      const allFile = await driveFile(page, `all-${id}.vcf`);
      step(
        "Save Card and Save All Cards to Drive…: each file on the drive",
        oneFile !== null &&
          allFile !== null &&
          (await driveText(page, oneFile)).includes(`Bea${id}`) &&
          (await driveText(page, allFile)).includes(FIRST),
      );

      const choosing = page.waitForEvent("filechooser", { timeout: 8_000 });
      await command(page, "Import vCard…");
      await (await choosing).setFiles({
        name: "fay.vcf",
        mimeType: "text/vcard",
        buffer: Buffer.from(
          `BEGIN:VCARD\r\nVERSION:3.0\r\nN:Imported;Fay${id};;;\r\nFN:Fay${id} Imported\r\nEND:VCARD\r\n`,
        ),
      });
      const read = await notice(page);
      step(
        "Import vCard…: a card from the computer, on the server",
        read.includes("1 card was imported") &&
          (await seen(async () => Boolean(await cardNamed(page, `Fay${id}`)))),
        read,
      );
      const before = (await cards(page)).length;
      await command(page, "Import vCard from Drive…");
      const panel = page.locator(".mac-contacts-panel-layer");
      await panel.waitFor({ timeout: 8_000 });
      await shot(page, "contacts-rows-import-drive");
      await panel.getByRole("option", { name: `bea-${id}.vcf` }).dblclick();
      const fromDrive = await notice(page);
      step(
        "Import vCard from Drive…: the file on the drive makes a card",
        fromDrive.includes("1 card was imported") &&
          (await seen(async () => (await cards(page)).length === before + 1)),
        fromDrive,
      );
    });

    await section("drag", async () => {
      await groupRow(page, "All Contacts").click();
      await menu(page, "File", /^New Group$/);
      const naming = windowOf(page).getByRole("textbox", { name: "Group name" });
      await naming.fill("Crew");
      await naming.press("Enter");
      await seen(() => groupRow(page, "Crew").isVisible(), 3_000);
      await groupRow(page, "All Contacts").click();
      const groups = async () => (await fetched(page, "/api/contacts/groups")).groups ?? [];
      const crew = async () => (await groups()).find((group) => group.name === "Crew");
      const bea = (await cardNamed(page, `Bea${id}`))?.id;
      await rowOf(page, `Bea${id}`).dragTo(groupRow(page, "Crew"));
      step(
        "Card onto a group: dragged, it joins, on the server",
        await seen(async () => (await crew())?.members.includes(bea)),
      );
      const list = windowOf(page).getByRole("listbox");
      const before = (await cards(page)).length;
      const transfer = await page.evaluateHandle((id2) => {
        const data = new DataTransfer();
        data.items.add(
          new File(
            [
              `BEGIN:VCARD\r\nVERSION:3.0\r\nN:Dropped;Gil${id2};;;\r\nFN:Gil${id2} Dropped\r\nEND:VCARD\r\n`,
            ],
            "gil.vcf",
            { type: "text/vcard" },
          ),
        );
        return data;
      }, id);
      await list.dispatchEvent("dragenter", { dataTransfer: transfer });
      await list.dispatchEvent("dragover", { dataTransfer: transfer });
      await list.dispatchEvent("drop", { dataTransfer: transfer });
      const dropped = await notice(page);
      step(
        "vCard file onto the list of names: a file dropped on the list makes a card",
        dropped.includes("1 card was imported") &&
          (await seen(async () => (await cards(page)).length === before + 1)),
        dropped,
      );

      await groupRow(page, "All Contacts").click();
      await rowOf(page, `Fay${id}`).click();
      await rowOf(page, `Edna${id}`).click({ modifiers: ["Control"] });
      const several = await downloaded(page, async () => {
        await openMenu(page, "File");
        await page.getByRole("menu").last().getByText("Export", { exact: true }).click();
        await page.getByRole("menu").last().getByText("Export vCard…").click();
      });
      const exportBoth = several.text.match(/BEGIN:VCARD/g)?.length === 2;
      await menu(page, "File", /^New Group from Selection/);
      await naming.fill("Pair");
      await naming.press("Enter");
      const paired = await seen(
        async () => (await groups()).find((one) => one.name === "Pair")?.members.length === 2,
      );
      await groupRow(page, "All Contacts").click();
      await rowOf(page, `Fay${id}`).click();
      await rowOf(page, `Edna${id}`).click({ modifiers: ["Control"] });
      await shot(page, "contacts-rows-several");
      await page.keyboard.press("Delete");
      const ask = page.getByRole("alertdialog");
      await ask.waitFor({ timeout: 3_000 });
      await ask.getByRole("button", { name: /Delete/ }).click();
      const removed = await seen(
        async () => !(await cardNamed(page, `Fay${id}`)) && !(await cardNamed(page, `Edna${id}`)),
      );
      step(
        "Delete, export or group several: exported as one file, grouped, then deleted after asking",
        exportBoth && paired && removed,
        `${exportBoth} ${paired} ${removed}`,
      );
      await groupRow(page, "Crew").click({ button: "right" });
      await page.getByRole("menuitem", { name: "Delete Group" }).first().click();
      await ask.waitFor({ timeout: 3_000 });
      await ask.getByRole("button", { name: /Delete/ }).click();
      const deleted = await seen(async () => !(await crew()));
      await groupRow(page, "Pair").click();
      await menu(page, "Edit", /^Delete Group/);
      await ask.waitFor({ timeout: 3_000 });
      await shot(page, "contacts-rows-delete-group");
      await ask.getByRole("button", { name: /Delete/ }).click();
      step(
        "Delete Group: asks, and the group goes with its cards left, by the row's menu and by Edit",
        deleted &&
          (await seen(async () => (await groups()).every((one) => one.name !== "Pair"))) &&
          Boolean(await cardNamed(page, `Bea${id}`)),
      );
    });

    await section("view-menu", async () => {
      const before = await boxOf(page, "contacts");
      await menu(page, "View", /^Enter Full Screen/);
      await seen(async () => (await boxOf(page, "contacts")).width >= 1400, 3_000);
      const full = await boxOf(page, "contacts");
      await shot(page, "contacts-rows-full-screen");
      await page.waitForTimeout(800);
      await page.mouse.move(700, 0);
      await page.waitForTimeout(600);
      await menu(page, "View", /^Exit Full Screen/);
      await seen(
        async () => Math.abs((await boxOf(page, "contacts")).width - before.width) < 8,
        3_000,
      );
      await page.waitForTimeout(800);
      const back = await boxOf(page, "contacts");
      step(
        "Enter Full Screen ⌃⌘F: fills the screen, and Exit brings back its size",
        full.width >= 1400 && full.height >= 800 && Math.abs(back.width - before.width) < 8,
        `${before.width} ${full.width}x${full.height} ${back.width}`,
      );
    });

    await section("cross-app", async () => {
      await rowOf(page, FIRST).click();
      await menu(page, "Edit", /^Copy/);
      step(
        "Copy a card as vCard: the clipboard holds it",
        await seen(async () => {
          const text = await page.evaluate(() => navigator.clipboard.readText());
          return text.startsWith("BEGIN:VCARD") && text.includes(FIRST);
        }, 4_000),
      );
      const before = (await cards(page)).length;
      await tile(page, "Contacts").click({ button: "right" });
      await page.getByRole("menu").last().getByRole("menuitem", { name: "New Card" }).click();
      const editing = await seen(() => field(page, "First").isVisible(), 4_000);
      await field(page, "First").fill(`Dock${id}`);
      await editor(page).click();
      step(
        "Dock icon menu: New Card opens one to fill in, on the server",
        editing && (await seen(async () => (await cards(page)).length === before + 1)),
      );

      await tile(page, "Messages").click();
      await page
        .locator('.mac-messages[aria-label="Messages"]')
        .first()
        .waitFor({ timeout: 10_000 });
      await page.waitForTimeout(800);
      await page.keyboard.press("Control+n");
      const to = page
        .locator('.mac-messages[aria-label="Messages"]')
        .first()
        .getByRole("textbox", { name: "To" });
      await to.waitFor({ timeout: 5_000 });
      await to.pressSequentially(martin.fullName.slice(0, 5));
      const offered = page.getByRole("option").filter({ hasText: martin.fullName }).first();
      const messagesOffers = await seen(() => offered.isVisible(), 5_000);
      await shot(page, "contacts-rows-messages-to");
      step(
        "Messages' To field: offers the desktop user from Contacts as it is typed",
        messagesOffers,
      );
      await to.fill("");

      await tile(page, "Contacts").click();
      await page.waitForTimeout(400);
      await windowOf(page).getByRole("button", { name: "Close" }).first().click();
      await seen(async () => (await windowOf(page).count()) === 0, 3_000);
      await page.getByRole("menuitem", { name: "Spotlight" }).click();
      const spotlight = page.getByRole("combobox", { name: "Spotlight Search" });
      await spotlight.fill(FIRST);
      const option = page
        .getByRole("option", { name: new RegExp(FIRST) })
        .filter({ hasNotText: /Search|Web/ })
        .first();
      await option.waitFor({ timeout: 15_000 });
      await option.click();
      await spotlight.press("Enter");
      const opened = await seen(
        async () => (await heading(page).innerText()).includes(FIRST),
        12_000,
      );
      await shot(page, "contacts-rows-spotlight");
      step("Spotlight finds and opens a contact: Contacts opens on the card", opened);
    });

    await section("app-menu", async () => {
      await menu(page, "Contacts", /^About Contacts/);
      const about = page.locator(".mac-about-window");
      const aboutShown = await seen(() => about.getByText("Contacts").first().isVisible(), 5_000);
      await shot(page, "contacts-rows-about");
      await about.getByRole("button", { name: "Close" }).first().click();
      step(
        "About Contacts: the window opens, and its close button closes it",
        aboutShown && (await seen(async () => (await about.count()) === 0, 3_000)),
      );
      const finder = page.locator('[data-window-id^="finder"]').first();
      await tile(page, "Finder").click();
      await finder.waitFor({ timeout: 8_000 });
      await page.waitForTimeout(400);
      await tile(page, "Contacts").click();
      await page.waitForTimeout(500);
      await menu(page, "Contacts", /^Hide Others/);
      const others = await seen(
        () => finder.evaluate((shell) => shell.hasAttribute("data-minimized")),
        3_000,
      );
      const stays = await windowOf(page).isVisible();
      await shot(page, "contacts-rows-hide-others");
      step("Hide Others ⌥⌘H: other applications' windows go, and Contacts' stays", others && stays);
      await menu(page, "Contacts", /^Show All/);
      step(
        "Show All: what was hidden comes back",
        await seen(() => finder.evaluate((shell) => !shell.hasAttribute("data-minimized")), 3_000),
      );
      await tile(page, "Contacts").click();
      await page.waitForTimeout(400);
      await menu(page, "Contacts", /^Hide Contacts/);
      const byItem = await seen(() => hidden(page, "contacts"), 3_000);
      await tile(page, "Contacts").click();
      await seen(async () => !(await hidden(page, "contacts")), 3_000);
      await page.waitForTimeout(400);
      await page.keyboard.press("Control+h");
      const byKey = await seen(() => hidden(page, "contacts"), 3_000);
      await tile(page, "Contacts").click();
      await seen(async () => !(await hidden(page, "contacts")), 3_000);
      await page.waitForTimeout(400);
      step("Hide Contacts ⌘H: the item and the key", byItem && byKey);
      await menu(page, "Contacts", /^Quit Contacts/);
      const quit = await seen(async () => (await windowOf(page).count()) === 0, 3_000);
      await open(page);
      await page.keyboard.press("Control+q");
      step(
        "Quit Contacts ⌘Q: the item and the key close its windows",
        quit && (await seen(async () => (await windowOf(page).count()) === 0, 3_000)),
      );
      await open(page);
    });

    await section("window-menu", async () => {
      const windowId = "contacts";
      await menu(page, "Window", /^Minimize/);
      const minimized = await seen(() => hidden(page, windowId), 3_000);
      await page.waitForTimeout(400);
      const ownTile = page
        .getByRole("toolbar", { name: "Dock" })
        .getByRole("button", { name: /minimized window/ });
      const tileShown = (await ownTile.count()) === 1;
      await shot(page, "contacts-rows-minimized");
      await ownTile.click();
      await seen(async () => !(await hidden(page, windowId)), 3_000);
      await page.waitForTimeout(500);
      await page.keyboard.press("Control+m");
      const byKey = await seen(() => hidden(page, windowId), 3_000);
      await page.waitForTimeout(400);
      await ownTile.click();
      await seen(async () => !(await hidden(page, windowId)), 3_000);
      await page.waitForTimeout(500);
      step(
        "Minimize ⌘M: the item and the key take it to the Dock",
        minimized && tileShown && byKey,
      );
      const before = await boxOf(page, windowId);
      await menu(page, "Window", /^Zoom/);
      await seen(async () => (await boxOf(page, windowId)).width !== before.width, 3_000);
      await page.waitForTimeout(500);
      const zoomed = await boxOf(page, windowId);
      await shot(page, "contacts-rows-zoomed");
      await menu(page, "Window", /^Zoom/);
      await seen(async () => (await boxOf(page, windowId)).width === before.width, 3_000);
      await page.waitForTimeout(500);
      step(
        "Zoom: the window grows, and again brings back its frame",
        zoomed.width > before.width + 100 &&
          Math.abs((await boxOf(page, windowId)).width - before.width) < 2,
      );
      await rowOf(page, FIRST).click();
      await menu(page, "Card", /^Open in New Window/);
      const cardShell = page.locator('[data-window-id^="contacts:"]').first();
      await cardShell.waitFor({ timeout: 5_000 });
      const cardId = await cardShell.getAttribute("data-window-id");
      await openMenu(page, "Window");
      await page.waitForTimeout(150);
      const listed = await page
        .getByRole("menu")
        .last()
        .getByRole("menuitemcheckbox")
        .allInnerTexts();
      await shot(page, "contacts-rows-window-menu");
      await page
        .getByRole("menu")
        .last()
        .getByRole("menuitemcheckbox", { name: /^Contacts$/ })
        .click();
      step(
        "Open windows list: names both windows, and a row brings its window forward",
        listed.length >= 2 &&
          (await seen(async () => (await stateOf(page, windowId)) === "key", 3_000)),
        listed.join(" | "),
      );
      const toCard = async () => {
        await openMenu(page, "Window");
        await page
          .getByRole("menu")
          .last()
          .getByRole("menuitemcheckbox", { name: /Ringer/ })
          .click();
        await seen(async () => (await stateOf(page, cardId)) === "key", 3_000);
      };
      await toCard();
      await openMenu(page, "Window");
      await row(page, /^Contacts/).click();
      const byRow = await seen(async () => (await stateOf(page, windowId)) === "key", 3_000);
      await toCard();
      await page.keyboard.press("Control+0");
      step(
        "Contacts ⌘0: the row and the key bring the main window forward",
        byRow && (await seen(async () => (await stateOf(page, windowId)) === "key", 3_000)),
      );
      await toCard();
      await tile(page, "Calculator").click();
      await shellOf(page, "calculator").waitFor({ timeout: 8_000 });
      await page.waitForTimeout(500);
      await cardShell.click({ position: { x: 200, y: 10 } });
      await seen(async () => (await stateOf(page, cardId)) === "key", 3_000);
      const under = (await zOf(page, "calculator")) > (await zOf(page, windowId));
      await menu(page, "Window", /^Bring All to Front/);
      await page.waitForTimeout(400);
      await shot(page, "contacts-rows-bring-all");
      step(
        "Bring All to Front: its windows come over another application's",
        under && (await zOf(page, windowId)) > (await zOf(page, "calculator")),
      );
      await page.keyboard.press("Control+w");
      await seen(async () => (await cardShell.count()) === 0, 3_000);
      await tile(page, "Contacts").click();
      await page.waitForTimeout(400);
    });

    await section("saved", async () => {
      if ((await windowOf(page).count()) === 0) await open(page);
      const settings = async () =>
        (await fetched(page, "/api/system-preferences/settings")).values ?? {};
      await rowOf(page, FIRST).click();
      const choosing = page.waitForEvent("filechooser", { timeout: 8_000 });
      await menu(page, "Card", /^Choose Custom Image/);
      await (await choosing).setFiles({ name: "face.png", mimeType: "image/png", buffer: PNG });
      await seen(async () => Boolean((await cardNamed(page, FIRST))?.image));
      await menu(page, "File", /^New Group$/);
      const naming = windowOf(page).getByRole("textbox", { name: "Group name" });
      await naming.fill("Kept group");
      await naming.press("Enter");
      await seen(async () =>
        JSON.stringify(await fetched(page, "/api/contacts/groups")).includes("Kept group"),
      );
      await menu(page, "View", /^Hide Groups/);
      const hiddenSaved = await seen(
        async () => (await settings())["contacts.groupsHidden"] === true,
      );
      await page.waitForTimeout(600);
      await reopen(page);
      await seen(() => windowOf(page).getByRole("listbox").isVisible(), 8_000);
      const stayedHidden = await seen(async () => (await tree(page).count()) === 0, 5_000);
      step(
        "Groups shown, Card Only: Groups stay hidden after a reload",
        hiddenSaved && stayedHidden,
        `${hiddenSaved} ${stayedHidden} ${JSON.stringify(await settings())}`,
      );
      if (stayedHidden) await page.keyboard.press("Control+1");
      await seen(() => tree(page).isVisible(), 3_000);
      await seen(async () => (await settings())["contacts.groupsHidden"] === false);
      // The reload brought back the group shown last, the new and empty Kept group.
      const groupKept = await seen(
        async () =>
          (await groupRow(page, "Kept group").getAttribute("aria-selected")) === "true" &&
          (await rows(page).count()) === 0,
        3_000,
      );
      step("The group shown: after a reload the window shows it again", groupKept);
      await groupRow(page, "All Contacts").click();
      await seen(() => rowOf(page, FIRST).isVisible());
      step(
        "Cards: after a reload the list holds them, and the server too",
        (await rowOf(page, FIRST).isVisible()) &&
          (await cardNamed(page, FIRST))?.phones?.[0]?.value === "555 0100",
      );
      await rowOf(page, FIRST).click();
      step(
        "Pictures: after a reload the card shows its picture",
        await seen(
          () =>
            windowOf(page)
              .locator(".mac-contacts-head img.mac-contacts-picture-image")
              .first()
              .isVisible(),
          6_000,
        ),
      );
      step(
        "Smart groups: after a reload the group from the search and the sheet are listed",
        (await groupRow(page, /Ringer/).isVisible()) &&
          (await groupRow(page, `Filed ${id}`).isVisible()),
      );
      step(
        "Groups of the person's own: after a reload the group is listed",
        await groupRow(page, "Kept group").isVisible(),
      );
      await shot(page, "contacts-rows-saved");
      const doc = await fetched(page, "/api/contacts/cards");
      const elsewhere = `Elsewhere${id}`;
      const put = await page.request.put(new URL("/api/contacts/cards", page.url()).href, {
        data: {
          rev: doc.rev,
          cards: [
            ...doc.cards,
            { id: `card-elsewhere-${id}`, account: "icloud", first: elsewhere, last: "Browser" },
          ],
        },
      });
      // The window's next save meets the other browser's revision: the refusal is its cue to merge.
      allow(/HTTP 409: .*\/api\/contacts\/cards/);
      allow(/status of 409/);
      await rowOf(page, FIRST).click();
      await menu(page, "Card", /^Edit Card/);
      await field(page, "Company name").fill("Merged Ferry");
      await editor(page).click();
      const merged = await seen(async () => {
        const now = await cards(page);
        return (
          now.some((card) => card.first === elsewhere) &&
          now.find((card) => card.first === FIRST)?.company === "Merged Ferry"
        );
      }, 12_000);
      await shot(page, "contacts-rows-merge");
      step(
        "A change from another browser: this window's next change keeps both, on the server",
        put.status() === 200 && merged,
        `HTTP ${put.status()} ${merged}`,
      );
    });
  },
);
