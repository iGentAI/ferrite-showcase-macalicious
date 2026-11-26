#!/usr/bin/env node
// FaceTime's Preferences, Block and Turn Off on Ferrite, in a real browser against the running app,
// with the browser's fake camera. The ringtone is kept; a person added to Blocked no longer rings, and
// rings again once removed; a recent row's Block This Caller joins the same list; ⌘K turns FaceTime
// off, which lets the camera go and survives a reload, and Turn On brings it back. Exits 0 only when
// every step passed and no page logged a console error, a page error, a failed request or an HTTP
// error.
//
//   node e2e/facetime-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("facetime-preferences");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `fpchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `fpmartin-${id}`, fullName: `Martin ${id}`, password };

const windowOf = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const preferences = (page) => page.locator(".mac-facetime-preferences");
const incoming = (page) => windowOf(page).locator('[aria-label="Incoming call"]');
const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};
const blockedOnServer = async (page) => {
  const reply = await page.request.get(new URL("/api/messages/blocked", page.url()).href);
  return (await reply.json()).blocked.map((each) => each.name);
};
const call = async (page) => {
  await windowOf(page).getByRole("textbox", { name: "Recipient" }).fill(martin.name);
  await windowOf(page).getByRole("button", { name: "Video", exact: true }).click();
  await within(
    10_000,
    async () => (await windowOf(page).getAttribute("data-call-state")) === "calling",
  );
};
const hangUp = async (page) => {
  await windowOf(page).locator('[aria-label="Call"]').getByRole("button", { name: "End" }).click();
  await within(
    15_000,
    async () => (await windowOf(page).getAttribute("data-call-state")) === "idle",
  );
};
const stillQuiet = async (page) => {
  await page.waitForTimeout(4_000);
  return !(await incoming(page).isVisible());
};

await run(
  {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  {},
  async ({ person }) => {
    const a = await person("chris", chris);
    const b = await person("martin", martin);
    await openFromDock(a, "FaceTime");
    await openFromDock(b, "FaceTime");

    await b
      .getByRole("menubar")
      .getByRole("menuitem", { name: "FaceTime", exact: true })
      .first()
      .click();
    await b
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: /^Preferences/ })
      .click();
    await preferences(b).waitFor({ timeout: 10_000 });
    step(
      "Settings names the account",
      (await within(10_000, async () =>
        (await preferences(b).innerText()).includes(`${martin.name}@macalicious`),
      )) !== null,
    );
    await preferences(b).getByRole("combobox", { name: "Ringtone" }).click();
    await b.getByRole("option", { name: "Silk", exact: true }).click();
    step(
      "the ringtone is on the server",
      (await within(10_000, async () => (await values(b))["facetime.ringtone"] === "Silk")) !==
        null,
    );
    await b.waitForTimeout(300);
    await shot(b, "facetime-preferences-settings");
    step(
      "what needs Apple's servers is dimmed and says why",
      (await preferences(b)
        .getByRole("checkbox", { name: /Live Photos/ })
        .isDisabled()) &&
        (await preferences(b)
          .getByRole("checkbox", { name: /Live Photos/ })
          .getAttribute("title")) !== null,
    );

    await preferences(b).getByRole("tab", { name: "Blocked" }).click();
    await preferences(b)
      .getByRole("textbox", { name: /Account name/ })
      .fill(chris.name);
    await preferences(b).getByRole("button", { name: "Add" }).click();
    step(
      "a person added is listed, and blocked on the server",
      (await within(
        10_000,
        async () =>
          (await preferences(b).getByRole("option", { name: chris.fullName }).count()) === 1 &&
          (await blockedOnServer(b)).includes(chris.name),
      )) !== null,
    );
    await shot(b, "facetime-preferences-blocked");

    await call(a);
    step("a blocked person's call does not ring", await stillQuiet(b));
    await hangUp(a);

    await preferences(b).getByRole("option", { name: chris.fullName }).click();
    await preferences(b).getByRole("button", { name: "Remove" }).click();
    step(
      "Remove takes them off the list, on the server",
      (await within(10_000, async () => !(await blockedOnServer(b)).includes(chris.name))) !== null,
    );
    await call(a);
    step(
      "and their call rings again",
      (await within(10_000, () => incoming(b).isVisible())) !== null,
    );
    await incoming(b).getByRole("button", { name: "Decline" }).click();
    await within(
      10_000,
      async () => (await windowOf(a).getAttribute("data-call-state")) === "idle",
    );

    // Answering the call raised FaceTime over the Preferences: the menu brings them back.
    await b
      .getByRole("menubar")
      .getByRole("menuitem", { name: "FaceTime", exact: true })
      .first()
      .click();
    await b
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: /^Preferences/ })
      .click();
    await preferences(b).getByRole("button", { name: "Close" }).first().click({ timeout: 5_000 });
    const row = windowOf(b)
      .getByRole("tree", { name: "Recent calls" })
      .getByRole("treeitem")
      .first();
    await within(10_000, () => row.isVisible());
    await row.click({ button: "right" });
    await b.getByRole("menuitem", { name: "Block This Caller" }).click();
    step(
      "a recent row's Block This Caller blocks them",
      (await within(10_000, async () => (await blockedOnServer(b)).includes(chris.name))) !== null,
    );
    await row.click({ button: "right" });
    await b.getByRole("menuitem", { name: "Unblock This Caller" }).click();
    step(
      "and it says Unblock, and does",
      (await within(10_000, async () => !(await blockedOnServer(b)).includes(chris.name))) !== null,
    );

    await windowOf(b).click({ position: { x: 500, y: 300 } });
    await b.keyboard.press("Control+K");
    const offPanel = windowOf(b).locator('[aria-label="FaceTime is off"]');
    step("⌘K turns FaceTime off", (await within(5_000, () => offPanel.isVisible())) !== null);
    step(
      "the camera is let go",
      (await within(5_000, async () => (await b.locator("video[data-self]").count()) === 0)) !==
        null,
    );
    step(
      "it is on the server",
      (await within(10_000, async () => (await values(b))["facetime.off"] === true)) !== null,
    );
    await shot(b, "facetime-off");
    await call(a);
    step("a call does not ring while it is off", await stillQuiet(b));
    await hangUp(a);
    await b.reload({ waitUntil: "load" });
    await openFromDock(b, "FaceTime").catch(() => {});
    step(
      "it stays off after a reload",
      (await within(10_000, () => offPanel.isVisible())) !== null,
    );
    // Contacts' call button asks FaceTime without going through its window: it places nothing.
    const contacts = b.locator('.mac-contacts[aria-label="Contacts"]').first();
    await openFromDock(b, "Contacts");
    await contacts.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
    await contacts.getByRole("button", { name: "Contacts commands" }).click();
    await b.getByRole("menuitem", { name: "Add Desktop User…" }).click();
    const sheet = b.getByRole("dialog", { name: "Add a Desktop User" });
    await sheet.getByRole("textbox", { name: "Account Name" }).fill(chris.name);
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await within(6_000, async () => (await sheet.count()) === 0);
    await contacts.getByRole("button", { name: "FaceTime video" }).click();
    step(
      "a call asked for from Contacts is refused while it is off, and says why",
      (await within(10_000, async () =>
        (await windowOf(b).innerText()).includes("FaceTime is off. Turn it on"),
      )) !== null &&
        (await (await b.request.get(new URL("/api/facetime/calls", b.url()).href)).json())
          .active === null,
    );
    await offPanel.getByRole("button", { name: "Turn On" }).click();
    step(
      "Turn On brings the camera back",
      (await within(10_000, async () => (await b.locator("video[data-self]").count()) === 1)) !==
        null,
    );

    // Off from Preferences, during a call: the call ends for both.
    await call(a);
    await within(10_000, () => incoming(b).isVisible());
    await incoming(b).getByRole("button", { name: "Accept" }).click();
    await within(
      30_000,
      async () =>
        (await windowOf(a).getAttribute("data-call-state")) === "connected" &&
        (await windowOf(b).getAttribute("data-call-state")) === "connected",
    );
    await b
      .getByRole("menubar")
      .getByRole("menuitem", { name: "FaceTime", exact: true })
      .first()
      .click();
    await b
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: /^Preferences/ })
      .click();
    await preferences(b).getByRole("tab", { name: "Settings" }).click();
    await preferences(b).getByRole("checkbox", { name: "Enable this account" }).click();
    step(
      "turning the account off in Preferences ends a call under way, for both",
      (await within(
        15_000,
        async () =>
          (await windowOf(a).getAttribute("data-call-state")) === "idle" &&
          (await windowOf(b).getAttribute("data-call-state")) === "idle",
      )) !== null,
    );
  },
);
