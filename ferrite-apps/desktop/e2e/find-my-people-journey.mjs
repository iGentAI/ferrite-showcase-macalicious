#!/usr/bin/env node
// Find My's People between two real accounts: File > Share My Location, a name that is no account,
// the other person's list, marker and card, a notification in their inbox, sharing back, a rule
// that fires on a real report, Message, stopping, a reload, and Remove. Dropping a contact on Share
// My Location answers /api/contacts/cards from a Playwright route with a card naming the account;
// the drop itself is a synthetic DataTransfer.
//
//   node e2e/find-my-people-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { api, reloadDesktop } from "./app-journey.mjs";
import { twoPeople, within } from "./people-kit.mjs";

const PEOPLE = "/api/find-my/people";
const LIBRARY = "/api/app-store/library";
const { step, allow, run, shot } = twoPeople("find-my-people");
// The name that is no account is refused on purpose.
allow(/HTTP 404: \S*\/api\/find-my\/people\/nobody/);
allow(/console: Failed to load resource: the server responded with a status of 404/);
const id = Date.now().toString(36).slice(-6);
const password = `tide-${id}-pool`;
const ann = { name: `fmann${id}`, fullName: `Ann ${id}`, password };
const bob = { name: `fmbob${id}`, fullName: `Bob ${id}`, password };
const HERE = { latitude: 37.8199, longitude: -122.4783, accuracy: 25 };
const FAR = { lat: 37.33, lon: -121.89 };

const windowOf = (page) => page.getByRole("region", { name: "Find My", exact: true }).first();
const listed = async (page) => (await api(page, "GET", PEOPLE)).json.people ?? [];
const report = (page, at, label = "Chromium on Linux") =>
  api(page, "PUT", "/api/find-my/me", {
    ...at,
    accuracy_m: 20,
    label,
    reported_at: Date.now(),
  });

async function openFindMy(page) {
  const library = await api(page, "GET", LIBRARY);
  await api(page, "PUT", LIBRARY, {
    installed: [...new Set([...(library.json.installed ?? []), "find-my"])],
    rev: library.json.rev,
  });
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Find My");
  await page.waitForTimeout(300);
  await field.press("Enter");
  const window = windowOf(page);
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
}

await run(
  {},
  { chromium: { permissions: ["geolocation"], geolocation: HERE } },
  async ({ person }) => {
    const pageA = await person("ann", ann);
    const pageB = await person("bob", bob);
    const windowA = await openFindMy(pageA);
    const windowB = await openFindMy(pageB);

    await windowB.getByText("No Friends").waitFor({ timeout: 15_000 });
    step("someone with no friends is told so", true);

    // ---- File > Share My Location, then a name that is no account ----------------------------
    await pageA
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "File", exact: true })
      .first()
      .click();
    await pageA.getByRole("menuitem", { name: "Share My Location", exact: true }).click();
    const sheet = pageA.getByRole("dialog", { name: "Share My Location" });
    await sheet.waitFor({ timeout: 10_000 });
    const to = sheet.getByRole("textbox", { name: "To" });
    await to.fill("nobody");
    await sheet.getByRole("button", { name: "Send" }).click();
    await sheet.getByRole("alert").waitFor({ timeout: 10_000 });
    step(
      "a name that is no account is refused in the sheet",
      /no account/.test(await sheet.getByRole("alert").innerText()),
      await sheet.getByRole("alert").innerText(),
    );
    await shot(pageA, "find-my-people-sheet");
    await to.fill(bob.name);
    await sheet.getByRole("button", { name: "Send" }).click();
    await sheet.waitFor({ state: "hidden", timeout: 10_000 });
    await windowA
      .getByRole("option", { name: bob.fullName })
      .waitFor({ state: "visible", timeout: 10_000 });
    step(
      "the person appears in the sharer's list and says they can see the location",
      /Can see your location/.test(
        await windowA.getByRole("option", { name: bob.fullName }).innerText(),
      ),
    );

    // ---- The other person sees it ---------------------------------------------------------------
    await report(pageA, FAR);
    const rowOfAnn = windowB.getByRole("option", { name: ann.fullName });
    await rowOfAnn.waitFor({ state: "visible", timeout: 20_000 });
    step("the other person's list shows the sharer", true);
    await rowOfAnn.click();
    const card = windowB.getByRole("region", { name: ann.fullName });
    await card.waitFor({ timeout: 10_000 });
    step(
      "the card says how far away they are",
      / away/.test(await card.innerText()),
      await card.innerText(),
    );
    step(
      "the map holds a marker for them",
      (await windowB.locator(`[data-marker="person:${ann.name}"]`).count()) === 1,
    );
    await shot(pageB, "find-my-people-card");
    const inbox = await api(pageB, "GET", "/api/notification-center/inbox");
    step(
      "Notification Center told them",
      inbox.json.items?.some(
        (item) => item.title === `${ann.fullName} started sharing location with you`,
      ),
    );
    const position = (await listed(pageB)).find((each) => each.name === ann.name)?.position;
    step(
      "the server shows only the newest position, with no device name",
      position?.lat === FAR.lat && position?.lon === FAR.lon && !("label" in position),
      JSON.stringify(position),
    );

    // ---- Sharing back ---------------------------------------------------------------------------
    await card.getByRole("button", { name: "Share My Location" }).click();
    step(
      "sharing back reaches the first person",
      (await within(20_000, async () =>
        (await listed(pageA)).some((each) => each.name === bob.name && each.following),
      )) !== null,
    );

    // ---- A rule -----------------------------------------------------------------------------------
    await windowB
      .locator(".mac-maps-tiles-location .mac-maps-tiles-dot")
      .waitFor({ timeout: 20_000 });
    await card.getByRole("button", { name: "Add Notification…" }).click();
    const notify = pageB.getByRole("dialog", { name: "Add Notification" });
    await notify.waitFor({ timeout: 10_000 });
    await notify.getByRole("button", { name: "Add" }).click();
    await notify.waitFor({ state: "hidden", timeout: 10_000 });
    await card.getByText("Notify me when").waitFor({ timeout: 15_000 });
    step("the card shows the rule", true);
    await report(pageA, { lat: HERE.latitude, lon: HERE.longitude });
    const told = await within(15_000, async () => {
      const items = (await api(pageB, "GET", "/api/notification-center/inbox")).json.items ?? [];
      return items.some((item) => item.title === `${ann.fullName} arrived at your location`);
    });
    step("their arrival raises the notification", told !== null);

    // ---- Message ----------------------------------------------------------------------------------
    await card.getByRole("button", { name: "Message" }).click();
    const messages = pageB.getByRole("region", { name: "Messages" }).first();
    await messages.waitFor({ timeout: 15_000 });
    step("Message opens Messages", true);
    await messages.getByRole("button", { name: "Close" }).first().click();

    // ---- Stopping, and a reload -------------------------------------------------------------------
    await windowA.getByRole("option", { name: bob.fullName }).click();
    await windowA
      .getByRole("region", { name: bob.fullName })
      .getByRole("button", { name: "Stop Sharing My Location" })
      .click();
    step(
      "the other person can no longer read the position",
      (await within(10_000, async () => {
        const seen = (await listed(pageB)).find((each) => each.name === ann.name);
        return seen && !seen.following && seen.position === null;
      })) !== null,
    );
    await reloadDesktop(pageB);
    step(
      "what the other person still shares stands after a reload",
      (await listed(pageB)).find((each) => each.name === ann.name)?.sharing === true,
    );

    // ---- Dropping a contact ----------------------------------------------------------------------
    await pageA.route(/\/api\/contacts\/cards/, (route) =>
      route.fulfill({
        json: { cards: [{ id: "card-bob", user: bob.name, first: "Bob" }] },
      }),
    );
    await windowA
      .locator(".mac-find-my-column")
      .getByRole("button", { name: "Share My Location" })
      .evaluate((button) => {
        const data = new DataTransfer();
        data.setData("application/x-macalicious-contact-cards", JSON.stringify(["card-bob"]));
        for (const type of ["dragover", "drop"])
          button.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
          );
      });
    step(
      "a contact dropped on Share My Location shares with its account",
      (await within(10_000, async () =>
        (await listed(pageA)).some((each) => each.name === bob.name && each.sharing),
      )) !== null,
    );

    // ---- Remove -----------------------------------------------------------------------------------
    const row = windowA.getByRole("option", { name: bob.fullName });
    await row.click();
    await windowA
      .getByRole("region", { name: bob.fullName })
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    const alert = pageA.getByRole("alertdialog").last();
    await alert.getByRole("button", { name: "Remove" }).click();
    await row.waitFor({ state: "hidden", timeout: 15_000 });
    step("Remove takes them off the list", true);
    step(
      "and off the server",
      !(await listed(pageA)).some((each) => each.name === bob.name && each.sharing),
    );
  },
);
