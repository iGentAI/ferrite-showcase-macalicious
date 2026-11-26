#!/usr/bin/env node
// A card in a window of its own, in a real browser against the running app: Card > Open in New Window, its
// key and a double click on a name; the window is the same card, edited in place and saved; the menu bar
// follows it; closing it leaves the main window; several selected cards open one window each. Exits 0 only
// when every step passed and no page logged a console error, a page error, a failed request or an HTTP
// error.
//
//   node e2e/contacts-window-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-window");
const id = Date.now().toString(36);
const chris = { name: `cwchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const main = (page) => page.locator('.mac-contacts[aria-label="Contacts"]').first();
const list = (page) => main(page).getByRole("listbox");
const cardWindow = (page, name) => page.getByRole("region", { name: `Card of ${name}` });
const cardWindows = (page) => page.locator(".mac-contacts-card-window");
const seen = (check) => within(8_000, check).then((took) => took !== null);
const menu = async (page, title, name) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
};
const addCard = async (page, first, last) => {
  await page.keyboard.press("Control+N");
  await main(page).getByRole("textbox", { name: "First", exact: true }).fill(first);
  await main(page).getByRole("textbox", { name: "Last", exact: true }).fill(last);
  await main(page).getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(600);
};
const storedCards = async (page) => {
  const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
  return JSON.stringify(await reply.json());
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openFromDock(page, "Contacts");
  await main(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  const ada = `Ada${id}`;
  const bea = `Bea${id}`;
  await addCard(page, ada, "One");
  await addCard(page, bea, "Two");

  await list(page)
    .getByRole("option", { name: `${ada} One` })
    .click();
  await menu(page, "Card", "Open in New Window");
  const adaWindow = cardWindow(page, `${ada} One`);
  step(
    "Card > Open in New Window shows the card in a window of its own",
    await seen(() => adaWindow.isVisible()),
  );
  await shot(page, "contacts-card-window");

  await menu(page, "Card", "Edit Card");
  await adaWindow.getByRole("textbox", { name: "Last", exact: true }).fill("Oneself");
  await adaWindow.getByRole("button", { name: "Done" }).click();
  step(
    "Edit Card in the menu bar edits the window's card, and the main window's list follows",
    await seen(() =>
      list(page)
        .getByRole("option", { name: `${ada} Oneself` })
        .isVisible(),
    ),
  );
  step("the edit is saved", await seen(async () => (await storedCards(page)).includes("Oneself")));
  step(
    "the window's title follows the card",
    await seen(() => cardWindow(page, `${ada} Oneself`).isVisible()),
  );

  const opened = cardWindow(page, `${ada} Oneself`);
  await opened.getByRole("button", { name: "Close" }).first().click();
  step(
    "its close button closes it and leaves the main window",
    await seen(
      async () => (await cardWindows(page).count()) === 0 && (await main(page).isVisible()),
    ),
  );

  await main(page)
    .click({ position: { x: 300, y: 300 } })
    .catch(() => {});
  await list(page)
    .getByRole("option", { name: `${bea} Two` })
    .click();
  await page.keyboard.press("Control+i");
  step(
    "its key opens the card selected",
    await seen(() => cardWindow(page, `${bea} Two`).isVisible()),
  );
  await cardWindow(page, `${bea} Two`).getByRole("button", { name: "Close" }).first().click();

  await list(page)
    .getByRole("option", { name: `${ada} Oneself` })
    .dblclick();
  step(
    "a double click on a name opens its card",
    await seen(() => cardWindow(page, `${ada} Oneself`).isVisible()),
  );
  await list(page)
    .getByRole("option", { name: `${ada} Oneself` })
    .dispatchEvent("dblclick");
  await page.waitForTimeout(300);
  step("a second double click opens no second window", (await cardWindows(page).count()) === 1);
  await cardWindow(page, `${ada} Oneself`).getByRole("button", { name: "Close" }).first().click();

  await list(page)
    .getByRole("option", { name: `${ada} Oneself` })
    .click();
  await list(page)
    .getByRole("option", { name: `${bea} Two` })
    .click({ modifiers: ["Shift"] });
  await menu(page, "Card", "Open in New Window");
  step(
    "several cards selected open one window each",
    await seen(async () => (await cardWindows(page).count()) === 2),
  );

  await cardWindow(page, `${bea} Two`).getByRole("button", { name: "Close" }).first().click();
  await cardWindow(page, `${ada} Oneself`).getByRole("button", { name: "Close" }).first().click();

  await list(page)
    .getByRole("option", { name: `${ada} Oneself` })
    .click();
  await list(page)
    .getByRole("option", { name: `${bea} Two` })
    .click({ modifiers: ["Shift"] });
  await list(page)
    .getByRole("option", { name: `${bea} Two` })
    .dblclick();
  step(
    "a double click on one of the names selected opens them all, once each",
    await seen(async () => (await cardWindows(page).count()) === 2),
  );
  await cardWindow(page, `${bea} Two`).getByRole("button", { name: "Close" }).first().click();
  await cardWindow(page, `${ada} Oneself`).getByRole("button", { name: "Close" }).first().click();

  // An edit left open when the desktop closes the window is finished, as one Undo step.
  await list(page)
    .getByRole("option", { name: `${bea} Two` })
    .dblclick();
  const beaWindow = cardWindow(page, `${bea} Two`);
  await beaWindow.waitFor({ timeout: 8_000 });
  await menu(page, "Card", "Edit Card");
  await beaWindow.getByRole("textbox", { name: "Last", exact: true }).fill("Closed");
  await page.keyboard.press("Control+w");
  step(
    "the window's close from the desktop keeps the edit",
    await seen(
      async () =>
        (await cardWindows(page).count()) === 0 &&
        (await list(page)
          .getByRole("option", { name: `${bea} Closed` })
          .isVisible()),
    ),
  );
  await list(page)
    .getByRole("option", { name: `${bea} Closed` })
    .click();
  await page.keyboard.press("Control+z");
  step(
    "one Undo takes that edit back",
    await seen(() =>
      list(page)
        .getByRole("option", { name: `${bea} Two` })
        .isVisible(),
    ),
  );

  // One card edited from both windows: one edit at a time, each its own Undo step.
  await list(page)
    .getByRole("option", { name: `${bea} Two` })
    .click();
  await main(page).getByRole("button", { name: "Edit" }).click();
  await main(page).getByRole("textbox", { name: "Last", exact: true }).fill("Main");
  await menu(page, "Card", "Open in New Window");
  const edited = cardWindow(page, `${bea} Main`);
  await edited.waitFor({ timeout: 8_000 });
  await edited.getByRole("button", { name: "Edit" }).click();
  step(
    "editing in the window ends the main window's edit of that card",
    await seen(async () => (await main(page).getByRole("button", { name: "Edit" }).count()) > 0),
  );
  await edited.getByRole("textbox", { name: "Last", exact: true }).fill("Window");
  await cardWindows(page).first().getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(300);
  await cardWindow(page, `${bea} Window`).getByRole("button", { name: "Close" }).first().click();
  await list(page)
    .getByRole("option", { name: `${bea} Window` })
    .click();
  await page.keyboard.press("Control+z");
  step(
    "Undo takes the window's edit back to the main window's",
    await seen(() =>
      list(page)
        .getByRole("option", { name: `${bea} Main` })
        .isVisible(),
    ),
  );
  await page.keyboard.press("Control+z");
  step(
    "a second Undo takes the main window's edit back",
    await seen(() =>
      list(page)
        .getByRole("option", { name: `${bea} Two` })
        .isVisible(),
    ),
  );
  await page.keyboard.press("Control+Shift+z");
  await page.keyboard.press("Control+Shift+z");
  step(
    "Redo gives both again",
    await seen(() =>
      list(page)
        .getByRole("option", { name: `${bea} Window` })
        .isVisible(),
    ),
  );

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Contacts").catch(() => {});
  await main(page).locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  step(
    "after a reload the edit is still there",
    await seen(() =>
      list(page)
        .getByRole("option", { name: `${ada} Oneself` })
        .isVisible(),
    ),
  );

  // A card left being edited in its window keeps what was typed through Undo and Redo of another.
  await list(page)
    .getByRole("option", { name: `${ada} Oneself` })
    .click();
  await menu(page, "Card", "Open in New Window");
  await cardWindow(page, `${ada} Oneself`).getByRole("button", { name: "Edit" }).click();
  await cardWindows(page)
    .first()
    .getByRole("textbox", { name: "Last", exact: true })
    .fill("Typing");
  await cardWindows(page).first().getByRole("button", { name: "Minimize" }).first().click();
  await list(page)
    .getByRole("option", { name: `${bea} Window` })
    .click();
  await page.keyboard.press("Control+l");
  await main(page).getByRole("textbox", { name: "Last", exact: true }).fill("Other");
  await main(page).getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+z");
  step(
    "Undo of another card leaves what is being typed in a window",
    await seen(
      async () =>
        (await list(page)
          .getByRole("option", { name: `${bea} Window` })
          .isVisible()) &&
        (await list(page)
          .getByRole("option", { name: `${ada} Typing` })
          .isVisible()),
    ),
  );
  await page.keyboard.press("Control+Shift+z");
  step(
    "Redo leaves it too",
    await seen(
      async () =>
        (await list(page)
          .getByRole("option", { name: `${bea} Other` })
          .isVisible()) &&
        (await list(page)
          .getByRole("option", { name: `${ada} Typing` })
          .isVisible()),
    ),
  );
});
