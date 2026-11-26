#!/usr/bin/env node
// FaceTime's recent calls on Ferrite in a real browser against the running app: calls next to each
// other with one person are one row with their count; a row's contextual menu removes that row,
// Command-click chooses more for the same, and Remove All Recents the rest, read back from the server and
// after a reload. Chromium's fake camera and microphone stand in for real devices. Exits 0 only when
// every step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/facetime-recents-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("facetime-recents");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `frchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `frmartin-${id}`, fullName: `Martin ${id}`, password };
const ana = { name: `frana-${id}`, fullName: `Ana ${id}`, password };

const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const stateOf = (page) => windowOf(page).getAttribute("data-call-state");
const list = (page) => windowOf(page).getByRole("tree", { name: "Recent calls" });
const rows = (page) => list(page).getByRole("treeitem");
const recents = async (page) => {
  const reply = await page.request.get(new URL("/api/facetime/calls", page.url()).href);
  return (await reply.json()).recents ?? [];
};
const stored = (page, count) => within(8_000, async () => (await recents(page)).length === count);

await run(
  {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
      ],
    },
  },
  {},
  async ({ person }) => {
    await person("martin", martin);
    await person("ana", ana);
    const page = await person("chris", chris);
    const known = page.waitForResponse(
      (response) => /\/api\/facetime\/me(\?|$)/.test(response.url()) && response.ok(),
      { timeout: 20_000 },
    );
    await openFromDock(page, "FaceTime");
    await known;
    await page.waitForTimeout(300);
    // Oldest first: the list then shows Martin's audio, Ana's video, Martin's two videos, Ana's audio.
    for (const [to, kind] of [
      [ana, "Audio"],
      [martin, "Video"],
      [martin, "Video"],
      [ana, "Video"],
      [martin, "Audio"],
    ]) {
      await windowOf(page).getByRole("textbox", { name: "Recipient" }).fill(to.name);
      await windowOf(page).getByRole("button", { name: kind, exact: true }).click();
      await within(10_000, async () => (await stateOf(page)) === "calling");
      await windowOf(page).getByRole("button", { name: "End" }).click();
      await within(10_000, async () => (await stateOf(page)) === "idle");
      // The window goes idle as End is pressed; the hang-up is on the server only when it answers.
      await within(10_000, async () => {
        const reply = await page.request.get(new URL("/api/facetime/calls", page.url()).href);
        return !(await reply.json()).active;
      });
    }
    step("five calls are in the recent calls", (await stored(page, 5)) !== null);
    step(
      "two next to each other with one person are one row, with their count",
      (await within(8_000, async () => (await rows(page).count()) === 4)) !== null &&
        (await rows(page).nth(2).innerText()).includes(`${martin.fullName} (2)`),
    );

    await rows(page).first().click({ button: "right" });
    const menu = page.getByRole("menu", { name: "Recent call commands" });
    await menu.waitFor({ timeout: 5_000 });
    await shot(page, "facetime-recents-menu");
    await menu.getByRole("menuitem", { name: "Add to Contacts" }).click();
    step(
      "Add to Contacts makes a card naming that account, on the server",
      (await within(15_000, async () => {
        const reply = await page.request.get(new URL("/api/contacts/cards", page.url()).href);
        return ((await reply.json()).cards ?? []).some((card) => card.user === martin.name);
      })) !== null,
    );
    await openFromDock(page, "FaceTime");
    await within(8_000, () => rows(page).first().isVisible());
    await rows(page).first().click({ button: "right" });
    await menu.waitFor({ timeout: 5_000 });
    await menu.getByRole("menuitem", { name: "Remove from Recents" }).click();
    step("Remove from Recents removes that call on the server", (await stored(page, 4)) !== null);
    step(
      "and from the list",
      (await within(5_000, async () => (await rows(page).count()) === 3)) !== null,
    );

    await rows(page).nth(0).click();
    await rows(page)
      .nth(1)
      .click({ modifiers: ["Control"] });
    step(
      "Command-click chooses a second row",
      (await list(page).locator("[data-chosen]").count()) === 1,
    );
    await shot(page, "facetime-recents-several");
    await rows(page).nth(1).click({ button: "right" });
    await menu.waitFor({ timeout: 5_000 });
    await menu.getByRole("menuitem", { name: "Remove from Recents" }).click();
    step(
      "Remove takes every call of the rows chosen, on the server",
      (await stored(page, 1)) !== null,
    );
    step(
      "and from the list",
      (await within(5_000, async () => (await rows(page).count()) === 1)) !== null,
    );

    await page.reload();
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    if (!(await windowOf(page).isVisible())) await openFromDock(page, "FaceTime");
    step(
      "a reload keeps it gone",
      (await within(10_000, async () => (await rows(page).count()) === 1)) !== null,
    );

    await page
      .getByRole("button", { name: /^FaceTime$/ })
      .first()
      .click({ button: "right" });
    const dockRow = page
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: new RegExp(`${id}$`) })
      .first();
    await dockRow.waitFor({ timeout: 5_000 });
    await shot(page, "facetime-dock-menu");
    await dockRow.click();
    step(
      "the Dock's menu names the person called and calls them back",
      (await within(10_000, async () => (await stateOf(page)) === "calling")) !== null,
    );
    await windowOf(page).getByRole("button", { name: "End" }).click();
    await within(10_000, async () => (await stateOf(page)) === "idle");
    await within(10_000, async () => {
      const reply = await page.request.get(new URL("/api/facetime/calls", page.url()).href);
      return !(await reply.json()).active;
    });

    await rows(page).first().click({ button: "right" });
    await menu.getByRole("menuitem", { name: "Remove All Recents" }).click();
    step("Remove All Recents empties them on the server", (await stored(page, 0)) !== null);
    step(
      "and the list",
      (await within(5_000, async () => (await rows(page).count()) === 0)) !== null,
    );
  },
);
