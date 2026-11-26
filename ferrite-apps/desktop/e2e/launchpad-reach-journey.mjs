#!/usr/bin/env node
// Reaching and editing Launchpad: F4 and a Hot Corner, the grid following the screen, Option held and a
// long press making the applications jiggle, and an application dragged to the Dock, kept across a reload.
//
//   node e2e/launchpad-reach-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("launchpad-reach");
const SETTINGS = "/api/system-preferences/settings";
const APP = "calculator";

async function until(check, ms = 6_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const items = page.locator(".mac-launchpad-item[data-app]");
  const shown = () =>
    items
      .first()
      .isVisible()
      .catch(() => false);
  // The journey writes settings as a second writer. The app's own save that meets that write is answered
  // 409, documented (`serverDocument`): it merges onto the server's copy and sends again, which is checked
  // at the end, so each such refusal is excused only together with its resend.
  const WRITE_HEADER = "x-macalicious-write";
  let unsent = 0;
  /** What the journey's last write set, which an app save on an older revision must not take back. */
  const ownValues = new Map();
  /** The last app save the server accepted, to be read back. */
  let accepted = null;
  let refused = null;
  let merged = 0;
  const lost = [];
  /** Each answer in turn: a 409's body is read before the resend that follows it is looked at. */
  let answers = Promise.resolve();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hear = async (response) => {
    const request = response.request();
    if (
      request.method() !== "PUT" ||
      !new URL(response.url()).pathname.endsWith(SETTINGS) ||
      !(WRITE_HEADER in request.headers())
    ) {
      return;
    }
    const sent = JSON.parse(request.postData() ?? "{}").values ?? {};
    if (response.status() === 409) {
      unsent += 1;
      const server = (await response.json().catch(() => ({}))).values ?? {};
      refused ??= { sent, server };
    } else if (response.ok()) {
      unsent = 0;
      accepted = sent;
      if (!refused) return;
      const wanted = refused;
      refused = null;
      merged += 1;
      // The app's refused edits go out again, and what the journey wrote meanwhile goes out as it wrote it.
      for (const key of new Set([...Object.keys(wanted.sent), ...Object.keys(wanted.server)])) {
        if (same(wanted.sent[key], wanted.server[key])) continue;
        const expected = ownValues.has(key) ? ownValues.get(key) : wanted.sent[key];
        if (!same(sent[key], expected)) lost.push(key);
      }
    }
  };
  page.on("response", (response) => {
    answers = answers.then(() => hear(response)).catch((error) => lost.push(String(error)));
  });
  /** A write of the journey's own: on a revision the app has just moved, it reads and tries again. */
  const writeSettings = async (change) => {
    for (let tries = 0; ; tries += 1) {
      const { json } = await api(page, "GET", SETTINGS);
      const before = json.values ?? {};
      const next = change(before);
      ownValues.clear();
      for (const key of new Set([...Object.keys(before), ...Object.keys(next)])) {
        if (!same(before[key], next[key])) ownValues.set(key, next[key]);
      }
      expectRefusal(409, SETTINGS);
      const { status } = await api(page, "PUT", SETTINGS, { values: next, rev: json.rev });
      if (status === 200) return;
      if (tries === 3) throw new Error(`settings answered ${status}`);
      await page.waitForTimeout(500);
    }
  };
  const setting = async (values) => {
    await page.waitForTimeout(1_500);
    await writeSettings((now) => ({
      ...now,
      ...(typeof values === "function" ? values(now) : values),
    }));
    await page.reload();
    await dock.getByRole("button", { name: "Finder", exact: true }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(500);
  };
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json.values?.[key];
  const jiggles = (locator) =>
    locator.evaluate((each) => getComputedStyle(each).animationName !== "none");

  // What the journey changes, undone at the end whatever happens, and nothing else: it may run on a
  // person's account, who may have changed something else meanwhile.
  const LIBRARY = "/api/app-store/library";
  const HOT_CORNER = "mission-control.hotCorner.bottomRight";
  const settingsThen = (await api(page, "GET", SETTINGS)).json.values ?? {};
  const installedThen = (await api(page, "GET", LIBRARY)).json.installed ?? [];
  const withAppAsItWas = (now, then) => {
    const others = (now ?? []).filter((id) => id !== APP);
    if (then?.includes(APP)) others.splice(then.indexOf(APP), 0, APP);
    return others;
  };
  const putBack = async () => {
    await page.waitForTimeout(1_000);
    await writeSettings((now) => {
      const values = { ...now };
      for (const key of ["dock.removed", "dock.order"]) {
        if (key in values) values[key] = withAppAsItWas(values[key], settingsThen[key]);
        if (!(key in settingsThen) && values[key]?.length === 0) delete values[key];
      }
      if (HOT_CORNER in settingsThen) values[HOT_CORNER] = settingsThen[HOT_CORNER];
      else delete values[HOT_CORNER];
      return values;
    });
    const removedNow = (await stored("dock.removed")) ?? [];
    step(
      "Taking the application back out leaves what else was out of the Dock as it was",
      same(
        removedNow.filter((id) => id !== APP),
        (settingsThen["dock.removed"] ?? []).filter((id) => id !== APP),
      ),
      JSON.stringify(removedNow),
    );
    step(
      "Every save of the app's that met the journey's own write was merged and sent again",
      (await until(async () => {
        await answers;
        return unsent === 0 && refused === null && merged > 0;
      })) && lost.length === 0,
      `merged ${merged}, refused ${unsent}, lost: ${lost.join(", ")}`,
    );
    if (!installedThen.includes("books")) {
      const now = (await api(page, "GET", LIBRARY)).json;
      await api(page, "PUT", LIBRARY, {
        ...now,
        installed: (now.installed ?? []).filter((id) => id !== "books"),
      });
    }
  };

  try {
    // F4.
    await page.keyboard.press("F4");
    step("F4 opens Launchpad", await until(shown));
    await page.waitForTimeout(300);
    await page.keyboard.press("F4");
    step("and F4 again closes it", await until(async () => !(await shown())));

    // The grid.
    const measure = async () => {
      const grid = page.locator(".mac-launchpad-grid").first();
      return {
        columns: Number(await grid.getAttribute("data-columns")),
        onPage: await grid.locator(".mac-launchpad-item, .mac-launchpad-folder").count(),
      };
    };
    await page.keyboard.press("F4");
    await until(shown);
    await page.waitForTimeout(300);
    const wide = await measure();
    step("A wide screen has seven columns", wide.columns === 7, JSON.stringify(wide));
    await page.setViewportSize({ width: 660, height: 560 });
    step(
      "A smaller one has six columns and three rows",
      await until(async () => {
        const now = await measure();
        return now.columns === 6 && now.onPage === 18;
      }),
      JSON.stringify(await measure()),
    );
    await shot(page, path.join(out, `launchpad-small-${browserName}.png`));
    await page.setViewportSize({ width: 1440, height: 900 });
    await until(async () => (await measure()).columns === 7);

    // Option.
    await page.keyboard.down("Alt");
    step("Option held makes the applications jiggle", await until(() => jiggles(items.first())));
    await page.keyboard.up("Alt");
    step("and letting go stops them", await until(async () => !(await jiggles(items.first()))));

    // A long press.
    const first = items.first();
    const box = await first.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.down();
    await page.waitForTimeout(1_200);
    await page.mouse.up();
    step(
      "A long press makes them jiggle and opens nothing",
      (await jiggles(first)) && (await shown()),
    );
    await shot(page, path.join(out, `launchpad-jiggle-${browserName}.png`));
    await page.keyboard.press("Escape");
    step(
      "Escape ends the jiggling, with Launchpad still open",
      (await until(async () => !(await jiggles(first)))) && (await shown()),
    );
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.down();
    await page.waitForTimeout(1_200);
    await page.mouse.up();
    await until(() => jiggles(first));
    const other = await items.nth(1).boundingBox();
    await page.mouse.click(other.x + other.width / 2, other.y + other.height / 3);
    step(
      "A click on an application ends it too, and opens nothing",
      (await until(async () => !(await jiggles(first)))) && (await shown()),
    );
    await page.keyboard.press("Escape");
    await until(async () => !(await shown()));

    // An application got from the store: a click on its tile ends the jiggling, on its badge it asks.
    const library = (await api(page, "GET", LIBRARY)).json;
    await api(page, "PUT", LIBRARY, {
      ...library,
      installed: [...new Set([...(library.installed ?? []), "books"])],
    });
    await page.reload();
    await dock.getByRole("button", { name: "Finder", exact: true }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await page.keyboard.press("F4");
    await until(shown);
    await page.waitForTimeout(300);
    const books = page.locator('.mac-launchpad-item[data-app="books"]');
    const question = page.getByRole("alertdialog", { name: /Delete “Books”/ });
    const hold = async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
      await page.mouse.down();
      await page.waitForTimeout(1_200);
      await page.mouse.up();
      await until(() => jiggles(first));
    };
    await hold();
    const place = await books.boundingBox();
    await page.mouse.click(place.x + place.width / 2, place.y + place.height / 3);
    step(
      "A click on the tile of one from the store ends it too, and asks nothing",
      (await until(async () => !(await jiggles(first)))) &&
        (await question.count()) === 0 &&
        (await shown()),
    );
    await hold();
    const again = await books.boundingBox();
    await page.mouse.click(again.x + Math.max(2, again.width / 2 - 54) + 10, again.y + 12);
    await question.waitFor({ timeout: 4_000 });
    step("A click on its badge asks whether to delete it", await question.isVisible());
    await question.getByRole("button", { name: "Cancel" }).click();
    await question.waitFor({ state: "detached", timeout: 4_000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await until(async () => !(await shown()));

    // A press cut short by closing Launchpad starts nothing.
    await page.keyboard.press("F4");
    await until(shown);
    await page.waitForTimeout(300);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.down();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1_200);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.keyboard.press("F4");
    await until(shown);
    step("A press cut short by closing Launchpad starts no jiggling", !(await jiggles(first)));
    // Let go off the application.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.down();
    await page.mouse.move(700, 880);
    await page.mouse.up();
    await page.waitForTimeout(1_200);
    step("Nor does one let go off the application", !(await jiggles(first)));
    await page.keyboard.press("Escape");
    await until(async () => !(await shown()));

    // To the Dock.
    await page.route("**/live/me*", () => undefined);
    await setting((now) => ({
      "dock.removed": [...new Set([...(now["dock.removed"] ?? []), APP])],
    }));
    // While Launchpad is open, Base UI hides the rest of the page from the accessibility tree.
    const tile = page.locator(`[data-dock-target="${APP}"]`);
    step("An application out of the Dock has no tile", (await tile.count()) === 0);
    await page.keyboard.press("F4");
    await until(shown);
    await page.waitForTimeout(300);
    // The app's save of this drag meets a write of the journey's, every time. With the live stream held
    // the app does not hear of that write, so it saves on the revision before it and has to merge and resend.
    await writeSettings((now) => ({ ...now, [HOT_CORNER]: "Launchpad" }));
    await page.locator(`.mac-launchpad-item[data-app="${APP}"]`).dragTo(page.locator(".mac-dock"));
    step("Dragged from Launchpad to the Dock it has one", await until(() => tile.isVisible()));
    step(
      "and the Dock keeps it, on the server",
      await until(async () => {
        const removed = (await stored("dock.removed")) ?? [];
        return !removed.includes(APP) && ((await stored("dock.order")) ?? []).includes(APP);
      }),
    );
    await page.unroute("**/live/me*");
    await until(async () => {
      await answers;
      return merged > 0 && refused === null;
    });
    let differing = [];
    const heldNow = await until(async () => {
      await answers;
      const now = (await api(page, "GET", SETTINGS)).json.values ?? {};
      differing = [...new Set([...Object.keys(now), ...Object.keys(accepted ?? {})])].filter(
        (key) => !same(now[key], accepted?.[key]),
      );
      return differing.length === 0 && now;
    });
    step(
      "What the merge sent is what the server holds: the Dock's change and the journey's write",
      merged > 0 &&
        heldNow?.[HOT_CORNER] === "Launchpad" &&
        !(heldNow?.["dock.removed"] ?? []).includes(APP),
      `merged ${merged}, differing: ${differing.join(", ")}`,
    );
    await shot(page, path.join(out, `launchpad-dock-${browserName}.png`));
    await page.keyboard.press("Escape");
    await until(async () => !(await shown()));
    await page.waitForTimeout(1_000);
    await page.reload();
    await dock.getByRole("button", { name: "Finder", exact: true }).waitFor({ timeout: 20_000 });
    step("It is there after a reload", await until(() => tile.isVisible(), 10_000));

    // A Hot Corner.
    await setting({ "mission-control.hotCorner.bottomRight": "Launchpad" });
    await page.mouse.move(700, 400);
    await page.mouse.move(1439, 899, { steps: 5 });
    step("A Hot Corner set to Launchpad opens it", await until(shown));
    await page.keyboard.press("Escape");
    await until(async () => !(await shown()));
    await page.mouse.move(700, 400);
  } finally {
    await putBack();
  }
});
