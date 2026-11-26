#!/usr/bin/env node
// Photo Booth census journey (round 3, R7): every control of Photo Booth, verified with real input
// against a served `ferrite dev` in the engine --browser names. Photo Booth is got from the App
// Store first (not preinstalled). The browser's fake camera (Chromium, Chrome, Firefox) or mock
// camera (WebKit) supplies frames; a browser with no camera and one that refuses it are checked
// for Photo Booth's own honest message with Take Photo dimmed.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  api,
  censusRun,
  createAccount,
  ensureOpen,
  launchBrowser,
  mainWindow,
  openApp,
  person,
  shellRows,
  sleep,
  until,
} from "./media-census-kit.mjs";

const app = {
  slug: "photo-booth",
  name: "Photo Booth",
  menus: ["Photo Booth", "File", "Edit", "View", "Camera", "Window", "Help"],
  editUnavailable: "Photo Booth has no text to edit",
  preferences: {
    unavailable: "dimmed in the Photo Booth menu: Photo Booth has no preferences",
  },
  media: "fake",
  crawlIgnore: [/^menu:Apple\|/, /^menu bar\|menuitem\|Apple$/],
};
const W = (ctx) => mainWindow(ctx.page, app);
const LIB = "/api/photos/library";
const booth = async (page) =>
  ((await api(page, "GET", LIB)).json?.photos ?? []).filter((p) =>
    /^Photo Booth/.test(p.name ?? ""),
  );
const strip = (ctx) => W(ctx).getByRole("list", { name: "Photos" }).getByRole("button");
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
const driveSha = (page, id) =>
  page.evaluate(async (id) => {
    const listing = await (await fetch("/api/files/", { credentials: "same-origin" })).json();
    const entry = listing.entries?.find((each) => each.id === id);
    if (!entry) return "no such file";
    const pieces = Math.max(1, Math.ceil(entry.size / listing.piece_bytes));
    const parts = [];
    for (let first = 0; first < pieces; first += 8) {
      const r = await fetch(
        `/api/files/content/${encodeURIComponent(id)}?piece=${first}&count=8&version=${entry.version ?? 0}`,
        { credentials: "same-origin" },
      );
      if (!r.ok) return `HTTP ${r.status}`;
      parts.push(new Uint8Array(await r.arrayBuffer()));
    }
    const all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let at = 0;
    for (const p of parts) {
      all.set(p, at);
      at += p.length;
    }
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", all))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }, id);
/** The effects of each page of the grid; Photo Booth opens on page 2, the colour effects. */
const PAGES = {
  1: [
    "Bulge",
    "Dent",
    "Twirl",
    "Squeeze",
    "Normal",
    "Mirror",
    "Light Tunnel",
    "Fish Eye",
    "Stretch",
  ],
  2: [
    "Sepia",
    "Black and White",
    "Plastic Camera",
    "Comic Book",
    "Normal",
    "Color Pencil",
    "Glow",
    "Thermal Camera",
    "X-Ray",
  ],
  3: [
    "Dizzy",
    "Love Birds",
    "Balloons",
    "Hearts",
    "Normal",
    "Lovestruck",
    "Nose Twirl",
    "Chipmunk",
    "Frog",
  ],
};
const ALL_EFFECTS = [...new Set(Object.values(PAGES).flat())];
/** Back to the effects grid, on page `n` (its page dot clicked when another page shows). */
async function grid(ctx, n = 2) {
  await ensureOpen(ctx);
  const group = W(ctx).getByRole("group", { name: /^Effects, page/ });
  if (!(await group.isVisible().catch(() => false)))
    await W(ctx).getByRole("button", { name: "Effects", exact: true }).click();
  await group.waitFor({ timeout: 8_000 });
  const wanted = W(ctx).getByRole("group", { name: `Effects, page ${n} of 4` });
  if (!(await wanted.isVisible().catch(() => false)))
    await W(ctx)
      .getByRole("button", { name: `Page ${n} of 4`, exact: true })
      .click();
  await wanted.waitFor({ timeout: 5_000 });
}
async function camera(ctx, effect = "Normal") {
  // A picture chosen in the strip stays shown until the window goes back to the camera.
  const back = W(ctx).getByRole("button", { name: "Back to Camera" });
  if (await back.isVisible().catch(() => false)) await back.click();
  const page =
    effect === "Normal"
      ? 2
      : Number(Object.keys(PAGES).find((n) => PAGES[n].includes(effect)) ?? 2);
  await grid(ctx, page);
  await W(ctx).getByRole("button", { name: effect, exact: true }).click();
  await W(ctx).getByRole("button", { name: "Take Photo" }).waitFor({ timeout: 10_000 });
}

const rows = [];
const R = (id, state, role, name, how, expected, check, extra = {}) =>
  rows.push({ id: `photo-booth.${id}`, state, role, name, how, expected, check, ...extra });

R(
  "effects.tile",
  "effects grid (pages 1 to 3)",
  "button",
  `/(${ALL_EFFECTS.join("|")})/`,
  "click the first effect of page 1, the middle one of page 2 and the last of page 3",
  "each opens the camera view with that effect (Take Photo shown, the effect named in the window)",
  async (ctx) => {
    const out = [];
    for (const [n, effect] of [
      [1, PAGES[1][0]],
      [2, PAGES[2][4]],
      [3, PAGES[3][8]],
    ]) {
      await grid(ctx, n);
      await W(ctx).getByRole("button", { name: effect, exact: true }).click();
      const take = await W(ctx)
        .getByRole("button", { name: "Take Photo" })
        .waitFor({ timeout: 10_000 })
        .then(
          () => true,
          () => false,
        );
      const named = (await W(ctx).innerText()).includes(effect);
      out.push(`${effect}:${take && named}`);
    }
    return { ok: out.every((x) => x.endsWith("true")), detail: out.join(", ") };
  },
  { notes: "kind: an effect tile of the effects grid (all three pages)" },
);
R(
  "effects.button",
  "camera view",
  "button",
  "Effects",
  "in the camera view, click Effects",
  "the effects grid shows again",
  async (ctx) => {
    await camera(ctx, "Sepia");
    await W(ctx).getByRole("button", { name: "Effects", exact: true }).click();
    return until(
      () =>
        W(ctx)
          .getByRole("group", { name: /^Effects, page/ })
          .isVisible(),
      5_000,
    );
  },
);
for (const n of [1, 2, 3]) {
  R(
    `effects.page-${n}`,
    "effects grid",
    "button",
    `Page ${n} of 4`,
    `click the page ${n} dot`,
    `the grid shows page ${n} of 4 of the effects`,
    async (ctx) => {
      await grid(ctx);
      await W(ctx)
        .getByRole("button", { name: `Page ${n} of 4`, exact: true })
        .click();
      const ok = await until(
        () =>
          W(ctx)
            .getByRole("group", { name: `Effects, page ${n} of 4` })
            .isVisible(),
        5_000,
      );
      ctx.data[`page${n}`] = await W(ctx)
        .getByRole("group", { name: /^Effects, page/ })
        .getByRole("button")
        .evaluateAll((b) => b.map((e) => e.getAttribute("aria-label") ?? e.textContent.trim()));
      return { ok, detail: ctx.data[`page${n}`].join(", ") };
    },
  );
}
R(
  "effects.next-page",
  "effects grid",
  "button",
  "Next page",
  "on page 1, click Next page",
  "the grid moves on to page 2",
  async (ctx) => {
    await grid(ctx);
    await W(ctx).getByRole("button", { name: "Page 1 of 4", exact: true }).click();
    await W(ctx).getByRole("button", { name: "Next page" }).click();
    return until(
      () => W(ctx).getByRole("group", { name: "Effects, page 2 of 4" }).isVisible(),
      5_000,
    );
  },
);
R(
  "effects.previous-page",
  "effects grid",
  "button",
  "Previous page",
  "on page 2, click Previous page",
  "the grid moves back to page 1",
  async (ctx) => {
    await grid(ctx);
    await W(ctx).getByRole("button", { name: "Page 2 of 4", exact: true }).click();
    await W(ctx).getByRole("button", { name: "Previous page" }).click();
    return until(
      () => W(ctx).getByRole("group", { name: "Effects, page 1 of 4" }).isVisible(),
      5_000,
    );
  },
);
R(
  "effects.previews",
  "effects grid (pages 1 and 2)",
  "group",
  "Effects, page",
  "show pages 1 and 2 of the Effects browser and read the canvases over the previews",
  "eight of each page's nine previews have a canvas painted with its computed effect; Normal has none",
  async (ctx) => {
    const out = [];
    const at = process.argv.indexOf("--out");
    for (const n of [1, 2]) {
      await grid(ctx, n);
      const canvases = W(ctx).locator(".mac-photo-booth-preview canvas");
      const painted = () =>
        canvases.evaluateAll((all) =>
          all.filter((canvas) => {
            if (canvas.width === 0 || canvas.height === 0) return false;
            const { data } = canvas
              .getContext("2d")
              .getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1);
            return data[3] === 255;
          }),
        );
      await until(async () => (await painted()).length === 8, 20_000);
      out.push(`page ${n}: ${(await painted()).length} painted of ${await canvases.count()}`);
      if (at >= 0) {
        await W(ctx).screenshot({
          path: `${process.argv[at + 1]}/photo-booth-effects-page-${n}.png`,
        });
      }
    }
    return {
      ok: out.every((line) => line.includes("8 painted of 8")),
      detail: out.join(", "),
    };
  },
);
R(
  "effects.computed",
  "camera view",
  "canvas",
  "computed effect",
  "choose Comic Book, read the canvas over the camera; choose Bulge and Normal likewise; take a Comic Book picture",
  "Comic Book's canvas holds only black and white, Bulge paints a canvas, Normal has none, and the saved Comic Book picture is colourless too",
  async (ctx) => {
    const painted = (name) =>
      W(ctx)
        .locator(`.mac-photo-booth-frame canvas[data-effect="${name}"]`)
        .evaluate((canvas) => {
          const { width, height } = canvas;
          const { data } = canvas.getContext("2d").getImageData(0, 0, width, height);
          let pure = 0;
          let lit = 0;
          let total = 0;
          for (let at = 0; at < data.length; at += 4) {
            total += 1;
            if (data[at + 3] === 255) lit += 1;
            const same = data[at] === data[at + 1] && data[at + 1] === data[at + 2];
            if (same && (data[at] === 0 || data[at] === 255)) pure += 1;
          }
          return { width, height, pure, lit, total };
        });
    await camera(ctx, "Comic Book");
    let comic;
    await until(async () => {
      comic = await painted("comic-book").catch(() => null);
      return comic !== null && comic.lit === comic.total && comic.total > 0;
    }, 15_000);
    const pure = comic?.pure === comic?.total;
    const take = W(ctx).getByRole("button", { name: "Take Photo" });
    await until(() => take.isEnabled(), 10_000);
    const added = ctx.page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/photos/photos",
      { timeout: 30_000 },
    );
    await take.click({ modifiers: ["Alt"] });
    await added;
    const shot = strip(ctx).last().locator("img");
    await shot.waitFor({ timeout: 15_000 });
    await until(() => shot.evaluate((img) => img.complete && img.naturalWidth > 0), 15_000);
    const saved = await shot.evaluate((img) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(img, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let colourless = 0;
      for (let at = 0; at < data.length; at += 4) {
        if (Math.abs(data[at] - data[at + 1]) < 16 && Math.abs(data[at + 1] - data[at + 2]) < 16) {
          colourless += 1;
        }
      }
      return colourless / (data.length / 4);
    });
    // The rows after this one expect the strip as they left it.
    await strip(ctx).last().focus();
    await ctx.page.keyboard.press("Delete");
    await W(ctx).getByRole("button", { name: "Effects", exact: true }).click();
    await grid(ctx, 1);
    await W(ctx).getByRole("button", { name: "Bulge", exact: true }).click();
    let bulge;
    await until(async () => {
      bulge = await painted("bulge").catch(() => null);
      return bulge !== null && bulge.lit === bulge.total && bulge.total > 0;
    }, 15_000);
    await W(ctx).getByRole("button", { name: "Effects", exact: true }).click();
    await grid(ctx, 1);
    await W(ctx).getByRole("button", { name: "Normal", exact: true }).click();
    const none = await until(
      async () => (await W(ctx).locator(".mac-photo-booth-frame canvas").count()) === 0,
      5_000,
    );
    return {
      ok: pure && saved > 0.98 && bulge !== null && none,
      detail: `comic ${comic?.pure}/${comic?.total} pure, saved ${saved.toFixed(3)} colourless, bulge lit ${bulge?.lit}/${bulge?.total}, normal has no canvas: ${none}`,
    };
  },
);
R(
  "effects.tracked",
  "camera view",
  "canvas",
  "effect that follows a face",
  "choose each of Dizzy, Love Birds and Balloons, and read the canvas over the camera",
  "each paints the camera on its canvas, and the window names no failure of the model; finding a face is faces-batch16-journey's, as this fake camera shows none",
  async (ctx) => {
    const models = [];
    const onRequest = (request) => {
      if (/blaze_face_short_range/.test(request.url())) models.push(request.url());
    };
    ctx.page.context().on("request", onRequest);
    const out = [];
    for (const [name, id] of [
      ["Dizzy", "dizzy"],
      ["Love Birds", "love-birds"],
      ["Balloons", "balloons"],
    ]) {
      await camera(ctx, name);
      const canvas = W(ctx).locator(`.mac-photo-booth-frame canvas[data-effect="${id}"]`);
      const painted = await until(
        () =>
          canvas.evaluate((each) => {
            const { data } = each
              .getContext("2d")
              .getImageData(each.width >> 1, each.height >> 1, 1, 1);
            return data[3] === 255;
          }),
        15_000,
      );
      out.push(`${name}:${painted}`);
    }
    ctx.page.context().off("request", onRequest);
    const failed = await W(ctx).getByText("could not load its face model").count();
    return {
      ok: out.every((line) => line.endsWith("true")) && failed === 0,
      detail: `${out.join(", ")}; model read ${models.length} time(s) this row`,
    };
  },
);
R(
  "strip.share",
  "camera view, a picture shown large",
  "button",
  "Share",
  "take a picture, click it in the strip, click Share in the bar",
  "the bar shows Share only once a picture is chosen; its menu lists Mail, Messages, AirDrop, Notes and Set Desktop Picture",
  async (ctx) => {
    await camera(ctx, "Sepia");
    const take = W(ctx).getByRole("button", { name: "Take Photo" });
    await until(() => take.isEnabled(), 10_000);
    if ((await strip(ctx).count()) === 0) {
      const added = ctx.page.waitForResponse(
        (r) =>
          r.request().method() === "POST" && new URL(r.url()).pathname === "/api/photos/photos",
        { timeout: 30_000 },
      );
      await take.click({ modifiers: ["Alt"] });
      await added;
      await strip(ctx).first().waitFor({ timeout: 15_000 });
    }
    const share = W(ctx).getByRole("button", { name: "Share", exact: true });
    const hiddenFirst = (await share.count()) === 0;
    await strip(ctx).last().click();
    await share.waitFor({ timeout: 5_000 });
    await share.click();
    const menu = ctx.page.getByRole("menu").last();
    await menu.getByRole("menuitem").first().waitFor({ timeout: 5_000 });
    const rows = await menu
      .getByRole("menuitem")
      .evaluateAll((items) => items.map((each) => each.textContent.trim()));
    await ctx.page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden", timeout: 5_000 });
    await W(ctx).getByRole("button", { name: "Back to Camera" }).click();
    return {
      ok:
        hiddenFirst &&
        ["Mail", "Messages", "AirDrop", "Notes", "Set Desktop Picture"].every((row) =>
          rows.includes(row),
        ),
      detail: rows.join(", "),
    };
  },
);
R(
  "strip.drag-out",
  "camera view",
  "button",
  "a picture of the strip",
  "take a picture, then drag it from the strip onto the desktop",
  "the desktop gains a copy with the same bytes, and the picture stays in Photos and on the strip",
  async (ctx) => {
    const { page } = ctx;
    await camera(ctx, "Sepia");
    const take = W(ctx).getByRole("button", { name: "Take Photo" });
    await until(() => take.isEnabled(), 10_000);
    if ((await strip(ctx).count()) === 0) {
      await take.click({ modifiers: ["Alt"] });
      await strip(ctx).first().waitFor({ timeout: 15_000 });
    }
    const listing = async () =>
      (await api(page, "GET", "/api/files/")).json?.entries?.filter(
        (each) => each.kind !== "folder" && /^Photo Booth \d/.test(each.name ?? ""),
      ) ?? [];
    await until(async () => (await booth(page)).length > 0, 15_000);
    await sleep(500);
    const before = await listing();
    const kept = await booth(page);
    const inStrip = await strip(ctx).count();
    const dragged = kept.at(-1);
    const from = await strip(ctx).last().boundingBox();
    const frame = await W(ctx).boundingBox();
    const size = page.viewportSize();
    // The desktop is whichever side of the window has room, away from the Dock.
    const x = frame.x > 80 ? 40 : Math.min(size.width - 40, frame.x + frame.width + 40);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y - 30, { steps: 5 });
    await page.mouse.move(x, 200, { steps: 8 });
    await page.mouse.up();
    let fresh = [];
    await until(async () => {
      const now = await listing();
      fresh = now.filter((each) => !before.some((was) => was.id === each.id));
      return fresh.length === 1;
    }, 15_000);
    const same =
      fresh[0] !== undefined &&
      dragged !== undefined &&
      (await driveSha(page, fresh[0].id)) === (await driveSha(page, dragged.file));
    return {
      ok:
        fresh.length === 1 &&
        same &&
        (await booth(page)).length === kept.length &&
        (await strip(ctx).count()) === inStrip,
      detail: `new on the drive: ${fresh.map((each) => each.name).join(", ") || "none"}, same bytes: ${same}, Photos ${kept.length}, strip ${inStrip}`,
    };
  },
);
R(
  "camera.take-photo",
  "camera view",
  "button",
  "Take Photo",
  "choose Sepia, click Take Photo",
  "the browser's camera frame is kept: Photos gains one Photo Booth picture (POST 201), its original in Pictures/Photo Booth on the drive, and the strip shows it",
  async (ctx) => {
    const { page } = ctx;
    await camera(ctx, "Sepia");
    const before = (await booth(page)).length;
    const take = W(ctx).getByRole("button", { name: "Take Photo" });
    const enabled = await until(() => take.isEnabled(), 10_000);
    const added = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/photos/photos",
      { timeout: 30_000 },
    );
    await take.click();
    const status = (await added).status();
    const after = await booth(page);
    const pic =
      after.find((p) => !ctx.data.pic || p.id !== ctx.data.pic.id) ?? after[after.length - 1];
    ctx.data.pic = pic;
    const shown = await until(async () => (await strip(ctx).count()) > 0, 10_000);
    ctx.data.stripName = shown
      ? ((await strip(ctx).first().getAttribute("aria-label")) ??
        (await strip(ctx).first().textContent()))
      : "";
    return {
      ok: enabled && status === 201 && after.length === before + 1 && !!pic?.file && shown,
      detail: `${status} ${pic?.name} strip ${ctx.data.stripName}`,
    };
  },
  {
    persists: "restart",
    timeout: 90_000,
    restartCheck: async (ctx) => {
      const pics = await booth(ctx.page);
      return {
        ok: pics.some((p) => p.id === ctx.data.pic?.id && p.deleted_ms === null),
        detail: `${pics.length} Photo Booth pictures kept`,
      };
    },
  },
);
R(
  "strip.photo",
  "camera view (strip)",
  "button",
  "/Photo \\d+, .+/",
  "reload, choose Sepia, find the picture in the strip, click it",
  "after a reload the strip still shows the picture, named by its number and effect, and a click selects it",
  async (ctx) => {
    const { page } = ctx;
    await page.reload({ waitUntil: "load" });
    await page
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    await ensureOpen(ctx);
    await camera(ctx, "Sepia");
    const ok = await until(async () => (await strip(ctx).count()) > 0, 10_000);
    const first = strip(ctx).first();
    await first.click();
    const name = (await first.getAttribute("aria-label")) ?? (await first.textContent());
    return { ok: ok && /Photo \d+, Sepia/.test(name ?? ""), detail: name };
  },
  { persists: "reload", notes: "kind: a picture of the strip under the camera view" },
);
R(
  "context.export",
  "strip context menu",
  "menuitem",
  "Export…",
  "right-click the strip's picture, Export…",
  "the picture's original is saved to the computer byte for byte (SHA-256 equal to the drive's original)",
  async (ctx) => {
    const { page } = ctx;
    await camera(ctx, "Sepia");
    const download = page.waitForEvent("download", { timeout: 20_000 });
    await strip(ctx).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Export…", exact: true }).click();
    const file = await download;
    const bytes = readFileSync(await file.path());
    const originals = await Promise.all(
      (await booth(page)).map((each) => driveSha(page, each.file)),
    );
    return {
      ok: originals.includes(sha(bytes)) && bytes[0] === 0xff && bytes[1] === 0xd8,
      detail: `${file.suggestedFilename()} ${bytes.length} bytes`,
    };
  },
);
R(
  "context.delete",
  "strip context menu",
  "menuitem",
  "Delete",
  "take a picture with Comic Book, right-click it in the strip, Delete",
  "it moves to Photos' Recently Deleted (deleted_ms set on the server) and leaves the strip",
  async (ctx) => {
    const { page } = ctx;
    await camera(ctx, "Comic Book");
    const before = await booth(page);
    const added = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/photos/photos",
      { timeout: 30_000 },
    );
    await W(ctx).getByRole("button", { name: "Take Photo" }).click();
    await added;
    const pic = (await booth(page)).find((p) => !before.some((b) => b.id === p.id));
    const tile = W(ctx)
      .getByRole("list", { name: "Photos" })
      .getByRole("button", { name: /Comic Book/ })
      .last();
    await tile.waitFor({ timeout: 10_000 });
    const count = await strip(ctx).count();
    await tile.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const gone = await until(
      async () => typeof (await booth(page)).find((p) => p.id === pic?.id)?.deleted_ms === "number",
      10_000,
    );
    const left = await until(async () => (await strip(ctx).count()) === count - 1, 5_000);
    return {
      ok: !!pic && gone && left,
      detail: `${pic?.name} deleted ${gone}, strip ${count} -> ${await strip(ctx).count()}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "strip.delete",
  "camera view (strip)",
  "shortcut",
  "Delete",
  "take a second picture, focus it in the strip, press Delete",
  "it moves to Photos' Recently Deleted (deleted_ms set on the server) and leaves the strip",
  async (ctx) => {
    const { page } = ctx;
    await camera(ctx, "Glow");
    const before = await booth(page);
    const added = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/photos/photos",
      { timeout: 30_000 },
    );
    await W(ctx).getByRole("button", { name: "Take Photo" }).click();
    await added;
    const pic = (await booth(page)).find((p) => !before.some((b) => b.id === p.id));
    const count = await strip(ctx).count();
    const tile = strip(ctx)
      .filter({ hasText: /Glow/ })
      .or(W(ctx).getByRole("button", { name: /Glow$/ }))
      .last();
    await tile.focus();
    await page.keyboard.press("Delete");
    const gone = await until(
      async () => typeof (await booth(page)).find((p) => p.id === pic?.id)?.deleted_ms === "number",
      10_000,
    );
    const left = await until(async () => (await strip(ctx).count()) === count - 1, 5_000);
    return {
      ok: !!pic && gone && left,
      detail: `${pic?.name} deleted ${gone}, strip ${count} -> ${await strip(ctx).count()}`,
    };
  },
  { timeout: 90_000 },
);
const refusal = (id, media, expected) =>
  R(
    id,
    `a browser ${media === "none" ? "with no camera" : "that refuses the camera"}`,
    "status",
    "camera notice",
    `a new account in a browser ${media === "none" ? "with no camera device" : "whose camera permission is denied"}, Photo Booth, Sepia`,
    `Photo Booth says ${expected} in its own words and Take Photo is dimmed`,
    async (ctx) => {
      const { browser, contextOptions } = await launchBrowser(ctx.engine, { media });
      try {
        const page = await (await browser.newContext(contextOptions)).newPage();
        await createAccount(
          page,
          ctx.base,
          person(media === "none" ? "pbnocam" : "pbdeny", ctx.run),
        );
        await openApp(page, app.name);
        const w = mainWindow(page, app);
        await w.getByRole("button", { name: "Sepia", exact: true }).click();
        const notice = w.locator(".mac-photo-booth-notice");
        const said = await until(async () => {
          const shown = await notice.innerText().catch(() => "");
          return shown.length > 10 && !shown.startsWith("Waiting for the camera");
        }, 15_000);
        const text = await notice.innerText().catch(() => "");
        const dimmed = await w
          .getByRole("button", { name: "Take Photo" })
          .isDisabled()
          .catch(() => false);
        const honest = /(No camera is connected|not allowed to use the camera)/.test(text);
        return { ok: said && honest && dimmed, detail: text };
      } finally {
        await browser.close();
      }
    },
    { timeout: 120_000 },
  );
refusal("camera.none", "none", "that no camera is connected (or that it may not use one)");
refusal("camera.denied", "deny", "that it is not allowed to use the camera");
R(
  "isolation.second-account",
  "another account",
  "account",
  "second account",
  "sign up a second account in a new browser context",
  "it has no Photo Booth picture of the first account's",
  async (ctx) => {
    const other = await ctx.newPage();
    try {
      await createAccount(other.page, ctx.base, person("pbother", ctx.run));
      const theirs = await booth(other.page);
      return {
        ok: theirs.length === 0 && !theirs.some((p) => p.id === ctx.data.pic?.id),
        detail: `${theirs.length} pictures`,
      };
    } finally {
      await other.context.close();
    }
  },
);

app.rows = [...shellRows(app), ...rows];
app.open = async (ctx) => {
  await openApp(ctx.page, app.name);
  await W(ctx).waitFor({ state: "visible", timeout: 20_000 });
  return W(ctx);
};
app.states = [
  {
    name: "main",
    enter: async (ctx) => {
      await grid(ctx);
      return W(ctx);
    },
  },
  ...[1, 3].map((n) => ({
    name: `effects page ${n}`,
    enter: async (ctx) => {
      await grid(ctx, n);
      return W(ctx);
    },
    menus: false,
  })),
  {
    name: "camera view",
    enter: async (ctx) => {
      await camera(ctx, "Sepia");
      return W(ctx);
    },
    menus: false,
  },
  {
    name: "strip context menu",
    enter: async (ctx) => {
      await camera(ctx, "Sepia");
      await strip(ctx).first().click({ button: "right" });
      await sleep(300);
      return W(ctx);
    },
    window: async (ctx) => ctx.page.getByRole("menu").last(),
    leave: async (ctx) => ctx.page.keyboard.press("Escape"),
    menus: false,
  },
];

await censusRun(app);
