#!/usr/bin/env node
// Find My on Ferrite: the browser's location (fixed by the context at the
// Golden Gate Bridge, with geolocation granted) is reported to the find-my
// module as this browser's device; the Devices list shows it with that
// position; Play Sound asks the module, the window sees the request on its
// next read, plays the sound with Web Audio and clears it; after a reload the
// device is still listed; a late report older than the stored one changes
// nothing. Exits 0 only when every step passed and the page
// logged no console error, page error, failed request or HTTP error. It
// removes the device it made.
//
//   ferrite dev                                    # in ferrite-apps/desktop
//   node e2e/find-my-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const ME = "/api/find-my/me";
const DEVICES = "/api/find-my/devices";
const HERE = { latitude: 37.8199, longitude: -122.4783, accuracy: 25 };
const located = { permissions: ["geolocation"], geolocation: HERE };

const { base, out, browserName } = options();
const { step, run } = journey("find-my", {
  contextOptions: { chromium: located, firefox: located, webkit: located },
});

/** Find My does not come with the desktop: get it from the App Store first (`install`), then open
 * it with Spotlight. */
async function openFindMy(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Find My");
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Find My", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  return window;
}

/** Resolves with the next answer to `method` on `pathname`. Marked as handled at once, so that
 * a step failing before it is awaited is reported as that step's failure. */
function next(page, method, pathname, timeout = 20_000) {
  const answer = page.waitForResponse(
    (response) =>
      response.request().method() === method && new URL(response.url()).pathname === pathname,
    { timeout },
  );
  answer.catch(() => {});
  return answer;
}

const LIBRARY = "/api/app-store/library";

/** Get `id` from the App Store; answers the list to restore. */
async function install(page, id) {
  const library = await api(page, "GET", LIBRARY);
  const before = library.json.installed;
  const installed = [...new Set([...(before ?? []), id])];
  await api(page, "PUT", LIBRARY, { installed, rev: library.json.rev });
  await reloadDesktop(page);
  return before;
}

/** Put the App Store library back as it was. */
async function restore(page, before) {
  const library = await api(page, "GET", LIBRARY);
  if (before === null || before === undefined) await api(page, "DELETE", LIBRARY);
  else await api(page, "PUT", LIBRARY, { installed: before, rev: library.json.rev });
}

await run(async (page) => {
  // Count the Web Audio tones the page starts, and record in one ordered log each tone started and
  // each Play Sound clear the page sends, so the journey sees the sound played before it is cleared.
  await page.addInitScript(() => {
    window.__findMyTones = 0;
    window.__findMyOrder = [];
    const sent = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input?.url ?? String(input));
      const method = (init?.method ?? input?.method ?? "GET").toUpperCase();
      if (method === "DELETE" && /\/sound\?request=/.test(url)) {
        window.__findMyOrder.push({ what: "clear", at: performance.now() });
      }
      return sent.call(this, input, init);
    };
    const Oscillator = window.OscillatorNode;
    if (!Oscillator) return;
    const start = Oscillator.prototype.start;
    Oscillator.prototype.start = function (...args) {
      window.__findMyTones += 1;
      window.__findMyOrder.push({ what: "tone", at: performance.now() });
      return start.apply(this, args);
    };
  });
  await openDesktop(page, base, step);
  const library = await install(page, "find-my");
  const reported = next(page, "PUT", ME);
  let window = await openFindMy(page);
  const report = await reported;
  const { device } = await report.json();
  step(
    "the window reports the browser's location as this browser's device",
    report.status() === 200 &&
      device?.this === true &&
      Math.abs(device.lat - HERE.latitude) < 1e-6 &&
      Math.abs(device.lon - HERE.longitude) < 1e-6,
    device ? `${device.label} at ${device.lat}, ${device.lon} ±${device.accuracy_m} m` : "",
  );
  // The location is a zero-size anchor; the dot hung on it is what shows.
  await window.locator(".mac-maps-tiles-location .mac-maps-tiles-dot").waitFor({ timeout: 10_000 });
  step("the map shows the browser's location", true);

  await window.getByRole("radio", { name: "Devices" }).click();
  const rows = window.getByRole("listbox", { name: "Devices" }).getByRole("option");
  const first = rows.filter({ hasText: "This browser" }).first();
  await first.waitFor({ timeout: 15_000 });
  step(
    "Devices lists this browser with its last time",
    (await first.innerText()).includes(device?.label ?? "?"),
    (await first.innerText()).replace(/\s+/g, " "),
  );
  await first.click();
  const card = window.getByRole("region", { name: device?.label ?? "" });
  await card.waitFor({ timeout: 10_000 });
  step(
    "the device's card shows its position and offers Play Sound",
    (await card.getByText("37.81990° N, 122.47830° W", { exact: false }).count()) === 1 &&
      (await card.getByRole("button", { name: "Play Sound" }).isEnabled()),
  );
  await shot(page, path.join(out, `find-my-device-${browserName}.png`));

  // Play Sound: the request goes to the module, the window sees it, plays it with Web Audio and
  // only then clears that request.
  const sound = `${DEVICES}/${device?.id}/sound`;
  const asked = next(page, "POST", sound);
  const cleared = next(page, "DELETE", sound, 30_000);
  const tonesBefore = await page.evaluate(() => window.__findMyTones ?? 0);
  const orderBefore = await page.evaluate(() => window.__findMyOrder?.length ?? 0);
  await card.getByRole("button", { name: "Play Sound" }).click();
  const askedReply = await asked;
  const request = askedReply.status() === 200 ? (await askedReply.json()).sound_request : null;
  step(
    "Play Sound is recorded for the device, as a request with its own id",
    askedReply.status() === 200 && /^[0-9a-f]{16}$/.test(request ?? ""),
    request ?? "",
  );
  // Whether this browser can play Web Audio at all here: headless Firefox without an audio device
  // keeps every AudioContext suspended, even after a click.
  const audioRuns = await page.evaluate(async () => {
    const context = new AudioContext();
    await Promise.race([
      context.resume().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1_500)),
    ]);
    const running = context.state === "running";
    void context.close().catch(() => {});
    return running;
  });
  if (audioRuns) {
    const clearedReply = await cleared;
    const order = await page.evaluate(
      (from) => (window.__findMyOrder ?? []).slice(from),
      orderBefore,
    );
    const firstTone = order.find((event) => event.what === "tone");
    const firstClear = order.find((event) => event.what === "clear");
    const clearAt = order.findIndex((event) => event.what === "clear");
    const tonesBeforeClear = order
      .slice(0, clearAt === -1 ? order.length : clearAt)
      .filter((event) => event.what === "tone").length;
    step(
      "the window plays the sound with Web Audio before clearing the request",
      firstTone !== undefined &&
        firstClear !== undefined &&
        firstTone.at <= firstClear.at &&
        tonesBeforeClear >= 3 &&
        clearedReply.status() === 200,
      `first tone at ${firstTone?.at.toFixed(1)} ms, clear sent at ${firstClear?.at.toFixed(1)} ms, ${tonesBeforeClear} tones before it`,
    );
    step(
      "the window clears that request, by its id",
      new URL(clearedReply.url()).searchParams.get("request") === request,
      clearedReply.url(),
    );
  } else {
    // The sound cannot play: the window must say so and keep the request, never clear it unheard.
    const blocked = window
      .getByRole("status")
      .getByText("did not let the page play it", { exact: false });
    await blocked.waitFor({ timeout: 20_000 });
    const held = await api(page, "GET", DEVICES);
    const waiting = held.json.devices?.find((item) => item.id === device?.id);
    const tones = (await page.evaluate(() => window.__findMyTones ?? 0)) - tonesBefore;
    step(
      "where Web Audio cannot run, the window says the sound was blocked and keeps the request",
      waiting?.sound_pending === true && waiting?.sound_request === request && tones === 0,
      `${browserName} cannot run Web Audio here; ${tones} tones, request ${waiting?.sound_request}`,
    );
    // The journey clears it itself, as the device would once a click let it play.
    await api(page, "DELETE", `${sound}?request=${request}`);
  }
  const note = await window.getByRole("status").innerText();
  const listed = await api(page, "GET", DEVICES);
  const mine = listed.json.devices?.find((item) => item.id === device?.id);
  step(
    "the server no longer holds a sound for the device",
    listed.status === 200 && mine?.sound_pending === false,
    note,
  );

  // After a reload the device is still there: the server lists it before the window is opened
  // again (which would report this browser afresh), and then the reopened window lists it.
  await reloadDesktop(page);
  const kept = await api(page, "GET", DEVICES);
  step(
    "after a reload the server still holds the device, before the window reports again",
    kept.status === 200 && kept.json.devices?.some((item) => item.id === device?.id) === true,
    `${kept.json.devices?.length ?? 0} devices listed`,
  );
  window = await openFindMy(page);
  await window.getByRole("radio", { name: "Devices" }).click();
  await window
    .getByRole("listbox", { name: "Devices" })
    .getByRole("option")
    .filter({ hasText: "This browser" })
    .first()
    .waitFor({ timeout: 15_000 });
  step("after a reload Devices still lists this browser", true);
  await shot(page, path.join(out, `find-my-reload-${browserName}.png`));

  // Close the window, so that it reports no more, then forget the device.
  await window.getByRole("button", { name: "Close" }).first().click();
  await window.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  // A report made long before the window's own, arriving now, leaves the device where the newer
  // report put it: the module keeps a device's newest report by the report's own time.
  const late = await api(page, "PUT", ME, {
    lat: 40.7128,
    lon: -74.006,
    accuracy_m: 10,
    label: device?.label ?? "Browser",
    reported_at: 1,
  });
  const held = await api(page, "GET", DEVICES);
  const still = held.json.devices?.find((item) => item.id === device?.id);
  step(
    "a late report older than the stored one changes nothing",
    late.status === 200 &&
      late.json.applied === false &&
      Math.abs((still?.lat ?? 0) - HERE.latitude) < 1e-6,
    `applied ${late.json.applied}, kept ${still?.lat}, ${still?.lon}`,
  );
  const removed = await api(page, "DELETE", `${DEVICES}/${device?.id}`);
  const after = await api(page, "GET", DEVICES);
  step(
    "the journey removes the device it made, and only that one",
    removed.status === 200 && !after.json.devices?.some((item) => item.id === device?.id),
  );
  await restore(page, library);
});
