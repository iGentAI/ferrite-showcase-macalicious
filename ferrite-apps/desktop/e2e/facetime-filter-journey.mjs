#!/usr/bin/env node
// FaceTime's All and Missed on Ferrite, in a real browser against the running app: the choice is read
// from the server and is still chosen after a reload. Exits 0 only when every step passed and no
// page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/facetime-filter-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("facetime-filter");
const id = Date.now().toString(36);
const person = { name: `ffchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const facetime = (page) => page.getByRole("region", { name: "FaceTime" }).first();
const missed = (page) =>
  facetime(page)
    .getByRole("group", { name: "Calls shown" })
    .getByRole("button", { name: "Missed" });

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "FaceTime");
  await within(15_000, () => facetime(page).isVisible());
  await missed(page).click();
  const kept = async () => {
    const reply = await page.request.get(
      new URL("/api/system-preferences/settings", page.url()).href,
    );
    return (await reply.json()).values?.["facetime.filter"];
  };
  step(
    "Missed is on the server",
    (await within(10_000, async () => (await kept()) === "missed")) !== null,
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "FaceTime");
  step(
    "and still chosen after a reload",
    (await within(
      15_000,
      async () => (await missed(page).getAttribute("aria-pressed")) === "true",
    )) !== null,
  );
  await shot(page, "facetime-filter");
});
