#!/usr/bin/env node
// A recording the drive refuses is not lost when Voice Memos closes. On the desktop served by
// `ferrite dev`, with Chromium's fake microphone and the drive's uploads answered 503 by the
// journey: a finished take stays "Not saved" through closing the window and reloading the page;
// Retry saves it once the drive answers. A take under way when the window closes reaches the drive
// the next time Voice Memos opens. A recording held for someone else in this browser is not
// shown. Exits 0 only with every step passed and no console or HTTP error other than the refusals
// it provokes. It deletes only what it made.
//
//   node e2e/voice-memos-holding-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const LIBRARY = "/api/app-store/library";
const UPLOADS = "/api/files/uploads";
const { base, out } = options();
const { step, run, expectRefusal } = journey("voice-memos-holding", {
  launchOptions: {
    chromium: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
});

/** A save the drive refuses tries again by itself; each of its refusals is excused. */
const excuseSave = () => {
  for (let at = 0; at < 6; at += 1) expectRefusal(503, UPLOADS);
};

const frame = (page) => page.locator('[data-window-id="voice-memos"]').first();
const win = (page) => page.locator('[data-window-id="voice-memos"] .mac-voice-memos').first();

async function open(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Voice Memos");
  await field.press("Enter");
  await win(page).waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (element) => !element.hasAttribute("aria-busy"),
    await win(page).elementHandle(),
    { timeout: 15_000 },
  );
}

async function record(page, ms) {
  await win(page).getByRole("button", { name: "New Recording" }).click();
  await win(page).getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(ms);
}

const closeWindow = async (page) => {
  await frame(page).getByRole("button", { name: "Close", exact: true }).first().click();
};

const dismissAlert = async (page) => {
  const ok = page.getByRole("alert").getByRole("button", { name: "OK" });
  await ok.waitFor({ timeout: 10_000 }).catch(async (error) => {
    await shot(page, path.join(out, "voice-memos-no-alert.png"));
    throw error;
  });
  await ok.click();
};

const memos = async (page) => {
  const { entries = [] } = (await api(page, "GET", "/api/files/")).json;
  const folder = entries.find((each) => each.kind === "folder" && each.name === "Voice Memos");
  return folder
    ? entries.filter((each) => each.parent === folder.id && each.trashed_ms === undefined)
    : [];
};

const holdingKeys = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const opening = indexedDB.open("macalicious-voice-memos", 1);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const all = opening.result
            .transaction("held-takes")
            .objectStore("held-takes")
            .getAllKeys();
          all.onsuccess = () => {
            opening.result.close();
            resolve(all.result);
          };
        };
      }),
  );

const plantForeign = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const opening = indexedDB.open("macalicious-voice-memos", 1);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const put = opening.result
            .transaction("held-takes", "readwrite")
            .objectStore("held-takes")
            .put(
              {
                id: "foreign",
                title: "Someone Else",
                name: "Someone Else.webm",
                blob: new Blob(["x"], { type: "audio/webm" }),
                created: Date.now(),
              },
              ["someone-else", "foreign"],
            );
          put.onsuccess = () => {
            opening.result.close();
            resolve(null);
          };
        };
      }),
  );

await run(async (page) => {
  const made = new Set();
  let hadApp = true;
  await openDesktop(page, base, step);
  // The takes this run recorded, by the ids their held records have.
  const takes = [];
  /** The recordings this run put on the drive. */
  const fresh = async () =>
    (await memos(page)).filter((each) =>
      takes.some(
        (take) =>
          each.name.replace(/\.[^.]+$/, "") ===
          (take.startsWith("New Recording ") ? take : `New Recording ${take}`),
      ),
    );
  const refuse = (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
      : route.continue();
  try {
    const library = (await api(page, "GET", LIBRARY)).json;
    hadApp = (library.installed ?? []).includes("voice-memos");
    await api(page, "PUT", LIBRARY, {
      installed: [...(library.installed ?? []).filter((id) => id !== "voice-memos"), "voice-memos"],
      rev: library.rev,
    });
    await reloadDesktop(page);
    await page.route(`**${UPLOADS}*`, refuse);

    // A finished take the drive refuses.
    await open(page);
    excuseSave();
    await record(page, 1500);
    await win(page).getByRole("button", { name: "Done" }).click();
    const row = win(page).getByRole("option", { name: /Not saved/ });
    await row.waitFor({ timeout: 20_000 });
    await dismissAlert(page);
    step("a take the drive refuses is a Not saved row", true);

    await closeWindow(page);
    const asking = page.getByRole("dialog").filter({ hasText: "Close Voice Memos?" });
    await asking.waitFor({ timeout: 5_000 });
    step(
      "closing says the recording waits in this browser",
      (await asking.textContent()).includes("waits in this browser"),
    );
    await shot(page, path.join(out, "voice-memos-closing.png"));
    await asking.getByRole("button", { name: "Close", exact: true }).click();

    const keys = await holdingKeys(page);
    takes.push(keys[0][1]);
    const session = (await api(page, "GET", "/api/session")).json;
    const person = session.account?.name ?? session.session;
    step(
      "the browser holds it under this person's name",
      keys.length === 1 && keys[0][0] === person,
      JSON.stringify(keys.map((key) => key[0] === person)),
    );
    await plantForeign(page);

    excuseSave();
    await reloadDesktop(page);
    await page.route(`**${UPLOADS}*`, refuse);
    await open(page);
    await row.waitFor({ timeout: 20_000 });
    await dismissAlert(page);
    step("after closing and a reload the recording is there, Not saved", true);
    step(
      "a recording held for someone else in this browser is not shown",
      (await win(page)
        .getByRole("option", { name: /Someone Else/ })
        .count()) === 0,
    );
    await shot(page, path.join(out, "voice-memos-not-saved-after-reload.png"));

    await page.unroute(`**${UPLOADS}*`, refuse);
    await row.click();
    await win(page).getByRole("button", { name: "Retry" }).click();
    const held = async () => (await holdingKeys(page)).filter((key) => key[0] !== "someone-else");
    const settled = async (check) => {
      const end = Date.now() + 20_000;
      while (!(await check()) && Date.now() < end) await page.waitForTimeout(300);
    };
    await settled(async () => (await held()).length === 0);
    const saved = await fresh();
    for (const each of saved) made.add(each.id);
    step("Retry saves it to the drive, once", saved.length === 1, saved.map((f) => f.name).join());
    step("the browser no longer holds it", (await held()).length === 0);

    // A take under way when the window closes, and the drive refuses it.
    await page.route(`**${UPLOADS}*`, refuse);
    excuseSave();
    await record(page, 1500);
    // A session that cannot be asked for either: the window already knows whose take this is.
    const noSession = (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    await page.route("**/api/session*", noSession);
    for (let at = 0; at < 3; at += 1) expectRefusal(503, "/api/session");
    await closeWindow(page);
    const stopping = page.getByRole("dialog").filter({ hasText: "Close Voice Memos?" });
    await stopping.getByRole("button", { name: "Close", exact: true }).click();
    await settled(async () => (await held()).length === 1);
    takes.push((await held())[0]?.[1]);
    await page.waitForTimeout(1000);
    step(
      "a take under way when the window closes is held, once, when the drive refuses it",
      (await held()).length === 1,
      JSON.stringify(await held()),
    );
    await page.unroute("**/api/session*", noSession);
    await page.unroute(`**${UPLOADS}*`, refuse);
    await open(page);
    await settled(async () => (await fresh()).length === 2 && (await held()).length === 0);
    const both = await fresh();
    for (const each of both) made.add(each.id);
    step(
      "it reaches the drive, once, when Voice Memos next opens",
      both.length === 2 && (await held()).length === 0,
      both.map((each) => each.name).join(),
    );
    await shot(page, path.join(out, "voice-memos-saved-on-next-open.png"));
  } finally {
    await page.unroute(`**${UPLOADS}*`, refuse).catch(() => {});
    for (const each of await fresh()) made.add(each.id);
    if (made.size > 0) {
      await api(page, "POST", "/api/files/ops", {
        ops: [...made].map((id) => ({ op: "delete", id })),
      });
    }
    // This browser's context is the journey's own; only what it held and planted is taken out.
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const opening = indexedDB.open("macalicious-voice-memos", 1);
          opening.onerror = () => resolve(null);
          opening.onsuccess = () => {
            const transaction = opening.result.transaction("held-takes", "readwrite");
            const store = transaction.objectStore("held-takes");
            store.getAllKeys().onsuccess = (event) => {
              for (const key of event.target.result) store.delete(key);
            };
            transaction.oncomplete = transaction.onabort = () => {
              opening.result.close();
              resolve(null);
            };
          };
        }),
    );
    if (!hadApp) {
      const left = (await api(page, "GET", LIBRARY)).json;
      await api(page, "PUT", LIBRARY, {
        installed: (left.installed ?? []).filter((id) => id !== "voice-memos"),
        rev: left.rev,
      });
    }
  }
});
