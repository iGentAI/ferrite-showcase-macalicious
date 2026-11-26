#!/usr/bin/env node

// Find My census (R5, round 3): one `ok`/`FAIL` line per census id of Find My, real input only, against `ferrite
// dev --fresh` serving the packed site, signed in as a real account made at the login window. Find My is not
// preinstalled: the account gets it from the App Store with the store's own Get and Install buttons. The browser
// shares its location (granted, at the Golden Gate Bridge); the account's browsers are its devices.
//
// Phases: `write` drives every control and leaves a state file; `restart-check` runs after a real same-root
// restart of `ferrite dev` and checks that this browser is still among the account's devices, and that a second
// account does not see it.
//
//   node e2e/find-my-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase all|write|restart-check] [--out <dir>] [--headed] [--only <id prefix,...>]

import {
  accountFor,
  api,
  appWindow,
  census,
  closeWindow,
  crawlMenus,
  getFromAppStore,
  launchBrowser,
  loadState,
  openApp,
  options,
  person,
  reloadDesktop,
  saveState,
} from "./r5-census-kit.mjs";
import { commonRows } from "./r5-common-rows.mjs";
import { mapRows } from "./r5-map-rows.mjs";

const opts = options();
const { base, out, browserName, phase } = opts;
const c = census("find-my", opts);
const _ME = "/api/find-my/me";
const DEVICES = "/api/find-my/devices";
const HERE = { latitude: 37.8199, longitude: -122.4783, accuracy: 25 };
const context = { contextOptions: { permissions: ["geolocation"], geolocation: HERE } };
const meta = (state, role, name, how, expect, persists = "none") => ({
  state,
  role,
  name,
  how,
  expect,
  persists,
});

const findMy = (page) => appWindow(page, "Find My");
const devices = async (page) => (await api(page, "GET", DEVICES)).json?.devices ?? [];

async function writePhase(browser, page) {
  const kept = {};
  await c.check(
    "find-my.app-store.get",
    async () => {
      await getFromAppStore(page, "Find My");
      const library = await api(page, "GET", "/api/app-store/library");
      return {
        ok: library.json?.installed?.includes("find-my"),
        detail: JSON.stringify(library.json?.installed),
      };
    },
    meta(
      "App Store",
      "button",
      "Get, Find My",
      "App Store: Get, then Install, on Find My",
      "Find My is in the account's library and the Dock",
      "restart",
    ),
  );
  await openApp(page, "Find My");
  await page.waitForTimeout(2_000);
  await c.crawl("window", findMy(page));

  await c.check(
    "find-my.people.radio",
    async () => {
      await findMy(page).getByRole("radio", { name: "People" }).click();
      const list = findMy(page).getByRole("listbox", { name: "People" });
      await list.waitFor({ timeout: 5_000 });
      const me = (await list.getByRole("option").allInnerTexts()).map((t) =>
        t.replace(/\s+/g, " ").trim(),
      );
      return {
        ok:
          (await findMy(page).getByRole("radio", { name: "People" }).isChecked()) &&
          me.some((t) => /^Me\b.*This browser/.test(t)),
        detail: me.join(" | "),
      };
    },
    meta(
      "window",
      "radio",
      "People",
      "click People",
      "People lists Me, this browser, with how near it is",
    ),
  );
  await c.check(
    "find-my.people.me",
    async () => {
      const option = findMy(page)
        .getByRole("listbox", { name: "People" })
        .getByRole("option")
        .first();
      await option.click();
      const selected = await option.getAttribute("aria-selected");
      return { ok: selected === "true", detail: `Me selected ${selected}` };
    },
    meta(
      "window",
      "option",
      "/Me .*This browser.*/",
      "click Me in People",
      "Me is chosen and shown on the map",
    ),
  );
  await c.check(
    "find-my.share-my-location",
    async () => {
      // Signed in, it asks whom to share with; signed out, it says to sign in.
      await findMy(page).getByRole("button", { name: "Share My Location" }).click();
      const sheet = page.getByRole("dialog", { name: "Share My Location" });
      const note = findMy(page).getByText(/Sign in to share your location\./);
      const said = await sheet
        .or(note.first())
        .first()
        .waitFor({ timeout: 5_000 })
        .then(
          async () =>
            (await sheet.isVisible()) ? "asks who to share with" : await note.first().innerText(),
          () => "",
        );
      if (await sheet.isVisible()) await sheet.getByRole("button", { name: "Cancel" }).click();
      return { ok: said !== "", detail: said || "nothing said" };
    },
    {
      ...meta(
        "window",
        "button",
        "Share My Location",
        "click Share My Location",
        "asks who to share with, or says to sign in",
      ),
    },
  );
  await c.check(
    "find-my.devices.radio",
    async () => {
      await findMy(page).getByRole("radio", { name: "Devices" }).click();
      const list = findMy(page).getByRole("listbox", { name: "Devices" });
      await list.waitFor({ timeout: 5_000 });
      const shown = (await list.getByRole("option").allInnerTexts()).map((t) =>
        t.replace(/\s+/g, " ").trim(),
      );
      kept.devices = (await devices(page)).map((d) => d.label ?? d.name ?? d.id);
      return {
        ok: shown.some((t) => /This browser/.test(t)),
        detail: `${shown.join(" | ")}; server ${JSON.stringify(kept.devices)}`,
      };
    },
    meta("window", "radio", "Devices", "click Devices", "Devices lists this browser", "restart"),
  );
  await c.check(
    "find-my.devices.option",
    async () => {
      const option = findMy(page)
        .getByRole("listbox", { name: "Devices" })
        .getByRole("option")
        .first();
      const label = (await option.innerText()).split("\n")[0].trim();
      await option.click();
      const region = findMy(page).getByRole("region", { name: label });
      await region.waitFor({ timeout: 8_000 });
      kept.device = label;
      await c.crawl("device", findMy(page));
      return { ok: await region.getByRole("heading", { name: label }).isVisible(), detail: label };
    },
    meta(
      "window",
      "option",
      "/.+ on .+ This browser.*/",
      "click this browser in Devices",
      "its card opens with Play Sound",
    ),
  );
  await c.check(
    "find-my.device.play-sound",
    async () => {
      const region = findMy(page).getByRole("region", { name: kept.device });
      const asked = page
        .waitForResponse(
          (r) =>
            r.request().method() !== "GET" && new URL(r.url()).pathname.startsWith("/api/find-my"),
          { timeout: 10_000 },
        )
        .catch(() => null);
      await region.getByRole("button", { name: "Play Sound" }).click();
      const reply = await asked;
      await page.waitForTimeout(800);
      const said = (await region.innerText()).replace(/\s+/g, " ");
      return {
        ok: Boolean(reply) && reply.status() < 300,
        detail: `${reply ? `${reply.request().method()} ${new URL(reply.url()).pathname} ${reply.status()}` : "no request"}; the card says "${said.slice(0, 120)}"`,
      };
    },
    meta(
      "device",
      "button",
      "Play Sound",
      "on this browser's card, click Play Sound",
      "the server is asked to play a sound on the device",
    ),
  );
  await c.unavailable(
    "find-my.device.remove",
    findMy(page).getByRole("button", { name: "Remove This Device" }),
    /cannot remove\s+itself/i,
    findMy(page).getByText(/cannot remove\s+itself/),
    meta(
      "device",
      "button",
      "Remove This Device",
      "look at Remove This Device on this browser's own card",
      "unavailable: dimmed; the card says this browser cannot remove itself",
    ),
  );
  // Back to People: the device's card no longer covers the map's controls.
  await findMy(page).getByRole("radio", { name: "People" }).click();
  await page.waitForTimeout(500);
  await mapRows(c, page, () => findMy(page), "find-my", meta);
  await commonRows(c, page, { id: "find-my", name: "Find My" });
  for (const control of (await crawlMenus(page)).rows) c.crawled.push(control);
  // The Help row left Help Viewer open. It floats over every app, also after a reload, and would cover Devices.
  await closeWindow(page, page.locator('[data-window-id="help-viewer"]'));

  await c.check(
    "find-my.persist.reload",
    async () => {
      await reloadDesktop(page);
      await openApp(page, "Find My");
      return persisted(page, kept);
    },
    meta(
      "window",
      "reload",
      "Devices",
      "reload the desktop, open Find My, Devices",
      "this browser is still listed",
      "reload",
    ),
  );
  kept.ids = (await devices(page)).map((d) => d.id);
  if (kept.ids.length === 0)
    c.row(
      "find-my.devices.server",
      false,
      "the server lists no device for this account, so isolation has no baseline",
    );
  await isolation(browser, "find-my.isolation.write", kept);
  return kept;
}

async function persisted(page, kept) {
  await findMy(page).getByRole("radio", { name: "Devices" }).click();
  const shown = (
    await findMy(page).getByRole("listbox", { name: "Devices" }).getByRole("option").allInnerTexts()
  ).map((t) => t.replace(/\s+/g, " ").trim());
  const server = (await devices(page)).map((d) => d.label ?? d.name ?? d.id);
  return {
    ok:
      shown.some((t) => t.startsWith(kept.device)) && kept.devices.every((d) => server.includes(d)),
    detail: `${shown.join(" | ")}; server ${JSON.stringify(server)}`,
  };
}

async function isolation(browser, id, kept) {
  await c.check(
    id,
    async () => {
      const other = await person(
        browser,
        c,
        base,
        accountFor("findmy", `b${phase === "restart-check" ? "r" : "w"}`),
        { label: "second account" },
      );
      try {
        const theirs = await api(other, "GET", DEVICES);
        const ids = (theirs.json?.devices ?? []).map((d) => d.id);
        const mine = kept.ids.filter((x) => ids.includes(x));
        const library = await api(other, "GET", "/api/app-store/library");
        return {
          ok:
            theirs.status === 200 &&
            kept.ids.length > 0 &&
            mine.length === 0 &&
            !library.json?.installed?.includes("find-my"),
          detail: `the first account's devices ${JSON.stringify(kept.ids)}; theirs ${JSON.stringify(ids)}`,
        };
      } finally {
        await other.context().close();
      }
    },
    meta(
      "second account",
      "isolation",
      "Find My devices",
      "sign up a second account, read its devices and App Store library",
      "none of the first account's browsers; Find My not got",
      "restart",
    ),
  );
}

async function restartPhase(browser) {
  const state = loadState(out, "find-my", browserName);
  const page = await person(browser, c, base, state.account, { create: false, ...context });
  await openApp(page, "Find My");
  await c.check(
    "find-my.persist.restart",
    async () => persisted(page, state.kept),
    meta(
      "window",
      "restart",
      "Devices",
      "restart ferrite dev on the same root, sign in, open Find My, Devices",
      "this browser is still listed",
      "restart",
    ),
  );
  await isolation(browser, "find-my.isolation.restart", state.kept);
}

const browser = await launchBrowser(browserName, { headed: opts.headed });
try {
  if (phase === "restart-check") await restartPhase(browser);
  else {
    const account = accountFor("findmy", "a");
    const page = await person(browser, c, base, account, context);
    const kept = await writePhase(browser, page);
    saveState(out, "find-my", browserName, { account, kept });
  }
} catch (error) {
  c.row("find-my.run.completed", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  await browser.close();
}
c.finish();
