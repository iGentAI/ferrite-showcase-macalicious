#!/usr/bin/env node

// Photos census (round 3, R7): one ok/FAIL line per census id of campaign/round3/r7/census/photos.tsv.
// Real input only (mouse, keyboard, the file chooser, pointer drags); the server's library is read
// back through /api/photos/library and the drive's bytes through /api/files.
//
//   node e2e/photos-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase write|restart-check|all] [--crawl] [--explore-minutes 3] [--list] [--out <dir>]

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  api,
  box,
  censusRun,
  chooseMenu,
  closeMenus,
  createAccount,
  ensureOpen,
  mainWindow,
  menuItemState,
  openApp,
  person,
  shellRows,
  signIn,
  sleep,
  until,
} from "./media-census-kit.mjs";

const app = {
  slug: "photos",
  name: "Photos",
  menus: ["Photos", "File", "Edit", "Image", "View", "Window", "Help"],
  // The second-browser row has two writers: the revision rule answers one of them 409, which the browser logs.
  allowedErrors: [/status of 409/],
  editItems: [],
  about: {},
  preferences: {
    text: "Library Location",
    locate: (ctx) => ctx.page.locator(".mac-window", { hasText: "Library Location" }).first(),
    close: (ctx) =>
      ctx.page
        .locator(".mac-window", { hasText: "Library Location" })
        .first()
        .getByRole("button", { name: "Close", exact: true })
        .first()
        .click(),
  },
  crawlIgnore: [/^menu:Apple\|/, /^menu bar\|menuitem\|Apple$/],
  recover: photosRecover,
};

/**
 * After each row: no menu or pop-up left open. After a row that failed, also the editor cancelled
 * and the viewer left, so a row that failed half-way never leaves an overlay over the next one; a
 * passing row keeps the state the next row builds on (the filter rows, then Done).
 */
async function photosRecover(ctx, _row, { failed = false } = {}) {
  const { page } = ctx;
  for (
    let n = 0;
    n < 3 &&
    (await page
      .getByRole("menu")
      .or(page.getByRole("listbox", { name: /Aspect/ }))
      .count()) > 0;
    n += 1
  ) {
    await page.keyboard.press("Escape");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!failed) return;
  const w = mainWindow(page, app);
  const cancel = w.getByRole("button", { name: "Cancel", exact: true });
  if (await cancel.isVisible().catch(() => false))
    await cancel.click({ timeout: 5_000 }).catch(() => {});
  const back = w.getByRole("button", { name: "Back", exact: true });
  if ((await back.isVisible().catch(() => false)) && (await back.isEnabled().catch(() => false)))
    await back.click({ timeout: 5_000 }).catch(() => {});
  for (let n = 0; n < 2 && (await page.getByRole("dialog").count()) > 0; n += 1)
    await page.keyboard.press("Escape");
}
const LIB = "/api/photos/library";
const FACE_FIXTURE = new URL("../../../demos/photo-booth/vendor/face-fixture.jpg", import.meta.url);
const W = (ctx) => mainWindow(ctx.page, app);
const lib = async (ctx) => (await api(ctx.page, "GET", LIB)).json;
const photoNamed = async (ctx, name) => (await lib(ctx)).photos?.find((p) => p.name === name);
const albumNamed = async (ctx, name) => (await lib(ctx)).albums?.find((a) => a.name === name);
const tile = (ctx, name) => W(ctx).getByRole("button", { name, exact: true });
const opt = (scope, name) => scope.getByRole("option", { name, exact: true });
const selected = (ctx) => W(ctx).locator('.mac-photos-cell[aria-pressed="true"]');
/** A sidebar row: a library view by its name, or an album by its name with its photo count after it. */
const side = (ctx, name) =>
  W(ctx)
    .getByRole("treeitem", {
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\d+)?$`),
    })
    .first();
/** A pointer drag with real mouse events: press at (x, y), move by (dx, dy) in steps, release. */
const drag = async (page, x, y, dx, dy) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
};
const heading = (ctx) => W(ctx).getByRole("heading", { level: 1 }).first();
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
const posted = (page, path, timeout = 15_000) => {
  const reply = page.waitForResponse(
    (r) =>
      ["POST", "DELETE", "PUT"].includes(r.request().method()) &&
      new URL(r.url()).pathname === path,
    { timeout },
  );
  reply.catch(() => {});
  return reply;
};

/** The SHA-256 of a drive file as the drive serves it (read only). */
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
    const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      all.set(p, at);
      at += p.length;
    }
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", all));
    return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
  }, id);

/** A picture drawn and encoded in the page (fixture bytes only; nothing of the app is touched). */
const drawn = (page, { width, height, type, noise }) =>
  page
    .evaluate(
      async ({ width, height, type, noise }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const c = canvas.getContext("2d");
        const img = c.createImageData(width, height);
        let seed = 7;
        for (let at = 0; at < img.data.length; at += 4) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          const x = (at / 4) % width;
          const y = Math.floor(at / 4 / width);
          img.data[at] = (x / width) * 255;
          img.data[at + 1] = noise ? seed & 0xff : (y / height) * 255;
          img.data[at + 2] = noise ? (seed >> 8) & 0xff : 160;
          img.data[at + 3] = 255;
        }
        c.putImageData(img, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let text = "";
        for (let at = 0; at < bytes.length; at += 0x8000)
          text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
        return btoa(text);
      },
      { width, height, type, noise },
    )
    .then((b64) => Buffer.from(b64, "base64"));

/** A JPEG with a camera's EXIF block (Make, Model, DateTimeOriginal) right after its start. */
function withExif(jpeg, { make, model, taken }) {
  const strings = [make, model, taken].map((text) => Buffer.from(`${text}\0`, "latin1"));
  const ifd0 = 8;
  const exifIfd = ifd0 + 2 + 3 * 12 + 4;
  const data = exifIfd + 2 + 12 + 4;
  const tiff = Buffer.alloc(data + strings.reduce((n, s) => n + s.length, 0));
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(ifd0, 4);
  let at = data;
  const offsets = strings.map((s) => {
    const o = at;
    s.copy(tiff, at);
    at += s.length;
    return o;
  });
  const entry = (o, tag, type, count, value) => {
    tiff.writeUInt16LE(tag, o);
    tiff.writeUInt16LE(type, o + 2);
    tiff.writeUInt32LE(count, o + 4);
    tiff.writeUInt32LE(value, o + 8);
  };
  tiff.writeUInt16LE(3, ifd0);
  entry(ifd0 + 2, 0x010f, 2, strings[0].length, offsets[0]);
  entry(ifd0 + 14, 0x0110, 2, strings[1].length, offsets[1]);
  entry(ifd0 + 26, 0x8769, 4, 1, exifIfd);
  tiff.writeUInt32LE(0, ifd0 + 38);
  tiff.writeUInt16LE(1, exifIfd);
  entry(exifIfd + 2, 0x9003, 2, strings[2].length, offsets[2]);
  tiff.writeUInt32LE(0, exifIfd + 14);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const marker = Buffer.alloc(4);
  marker.writeUInt16BE(0xffe1, 0);
  marker.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
}

/** The natural size of the full-size picture the viewer shows, once it is in. */
async function shownSize(ctx, want) {
  const image = W(ctx).locator("img.mac-photos-picture[data-full]");
  await image.waitFor({ state: "attached", timeout: 30_000 });
  await until(async () => {
    const s = await image.evaluate((e) => [e.complete, e.naturalWidth, e.naturalHeight]);
    return s[0] && (!want || (s[1] === want.width && s[2] === want.height));
  }, 30_000);
  return image.evaluate((e) => ({ width: e.naturalWidth, height: e.naturalHeight }));
}

/** Choose files through the file chooser a real click opens. */
async function chooseFiles(page, click, files) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10_000 }),
    click(),
  ]);
  await chooser.setFiles(files);
}

/** Back to the library's Photos (Days) view with nothing selected and no viewer open. */
async function home(ctx) {
  const { page } = ctx;
  await ensureOpen(ctx);
  for (let n = 0; n < 3 && (await page.getByRole("menu").count()) > 0; n += 1)
    await page.keyboard.press("Escape");
  const back = W(ctx).getByRole("button", { name: "Back", exact: true });
  if (await back.isEnabled().catch(() => false)) await back.click();
  await side(ctx, "Photos").click();
  await W(ctx).getByRole("button", { name: "Days", exact: true }).click();
  await page.keyboard.press("Escape");
  await showAll(ctx);
}

/** Showing back to All Items (a row may leave the library filtered), answering whether it is. */
async function showAll(ctx) {
  const { page } = ctx;
  const pop = W(ctx).getByRole("button", { name: /^Showing: / });
  const all = async () => /All Items/.test((await pop.textContent().catch(() => "")) ?? "");
  for (let n = 0; n < 3 && !(await all()); n += 1) {
    await closeMenus(page);
    await pop.click();
    const item = page.getByRole("menuitemradio", { name: "All Items", exact: true });
    if (
      await item.waitFor({ timeout: 3_000 }).then(
        () => true,
        () => false,
      )
    )
      await item.click();
    await sleep(300);
  }
  return all();
}

/** A real pointer drag from one element's centre to another's. */
async function pointerDrag(page, from, to) {
  const s = await box(from);
  const t = await box(to);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 12, s.y + s.height / 2 + 12, { steps: 4 });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 16 });
  await sleep(150);
  await page.mouse.up();
}

const rows = [];
const R = (id, state, role, name, how, expected, check, extra = {}) =>
  rows.push({ id: `photos.${id}`, state, role, name, how, expected, check, ...extra });
const names = (ctx) => ctx.data.names;

// --- Import, originals, selection -------------------------------------------------------------
R(
  "import.toolbar",
  "library",
  "button",
  "Import",
  "Import (toolbar), choose a JPEG with EXIF data and a PNG in the file chooser",
  "both join the library on the server and show as thumbnails",
  async (ctx) => {
    const { page } = ctx;
    const run = ctx.run;
    ctx.data.names = { a: `Lighthouse ${run}`, b: `Harbour ${run}`, c: `Meadow ${run}` };
    const a = withExif(await drawn(page, { width: 640, height: 480, type: "image/jpeg" }), {
      make: "Canon",
      model: "Canon EOS R",
      taken: "2019:10:07 14:03:00",
    });
    const b = await drawn(page, { width: 300, height: 200, type: "image/png" });
    ctx.data.sha = { a: sha(a), b: sha(b) };
    await chooseFiles(
      page,
      () => W(ctx).getByRole("button", { name: "Import", exact: true }).click(),
      [
        { name: `${names(ctx).a}.jpg`, mimeType: "image/jpeg", buffer: a },
        { name: `${names(ctx).b}.png`, mimeType: "image/png", buffer: b },
      ],
    );
    const ok = await until(
      async () =>
        !!(await photoNamed(ctx, names(ctx).a)) && !!(await photoNamed(ctx, names(ctx).b)),
      45_000,
    );
    await tile(ctx, names(ctx).a).waitFor({ timeout: 15_000 });
    const pa = await photoNamed(ctx, names(ctx).a);
    ctx.data.ids = { a: pa?.id, b: (await photoNamed(ctx, names(ctx).b))?.id };
    ctx.data.files = { a: pa?.file, b: (await photoNamed(ctx, names(ctx).b))?.file };
    return {
      ok: ok && pa?.camera === "Canon EOS R" && pa?.width === 640,
      detail: `${pa?.camera} ${pa?.width}x${pa?.height}`,
    };
  },
  {
    setup: true,
    persists: "restart",
    timeout: 90_000,
    restartCheck: async (ctx) => {
      const a = await photoNamed(ctx, names(ctx).a);
      await side(ctx, "Photos").click();
      await tile(ctx, names(ctx).a).waitFor({ timeout: 20_000 });
      return { ok: !!a && a.camera === "Canon EOS R", detail: `after restart: ${a?.name}` };
    },
  },
);
R(
  "import.originals-sha256",
  "drive",
  "file",
  "original",
  "read the imported originals back from the drive",
  "each original is kept byte for byte (SHA-256 equal to the chosen file)",
  async (ctx) => {
    const a = await driveSha(ctx.page, ctx.data.files.a);
    const b = await driveSha(ctx.page, ctx.data.files.b);
    return {
      ok: a === ctx.data.sha.a && b === ctx.data.sha.b,
      detail: `${a.slice(0, 12)} ${b.slice(0, 12)}`,
    };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => {
      const a = await driveSha(ctx.page, ctx.data.files.a);
      const c = await driveSha(ctx.page, ctx.data.files.c);
      return {
        ok: a === ctx.data.sha.a && c === ctx.data.sha.c,
        detail: `after restart ${a.slice(0, 12)} ${c.slice(0, 12)}`,
      };
    },
  },
);
R(
  "menu.file.import",
  "menu:File",
  "menuitem",
  "Import…",
  "File > Import…, choose a 1.2 MB noisy JPEG",
  "the picture is uploaded in pieces and joins the library",
  async (ctx) => {
    const { page } = ctx;
    const c = await drawn(page, { width: 1200, height: 800, type: "image/jpeg", noise: true });
    ctx.data.sha.c = sha(c);
    await chooseFiles(page, () => chooseMenu(page, "File", "Import…"), [
      { name: `${names(ctx).c}.jpg`, mimeType: "image/jpeg", buffer: c },
    ]);
    await page.getByRole("button", { name: "Import All New Items" }).click();
    const ok = await until(async () => !!(await photoNamed(ctx, names(ctx).c)), 60_000);
    const pc = await photoNamed(ctx, names(ctx).c);
    ctx.data.ids.c = pc?.id;
    ctx.data.files.c = pc?.file;
    return {
      ok: ok && pc?.bytes === c.length && (await driveSha(page, pc.file)) === ctx.data.sha.c,
      detail: `${c.length} bytes`,
    };
  },
  { setup: true, timeout: 120_000 },
);
R(
  "library.thumbnail",
  "library (Days)",
  "button",
  "/(Lighthouse|Harbour|Meadow) [a-z0-9]+/",
  "the Days view's photo tiles",
  "each tile shows its picture's thumbnail; clicking one selects it",
  async (ctx) => {
    await home(ctx);
    const list = [names(ctx).a, names(ctx).b, names(ctx).c];
    const loaded = [];
    for (const name of list) {
      const t = tile(ctx, name);
      await t.waitFor({ timeout: 15_000 });
      loaded.push(
        await until(
          () => t.locator("img").evaluate((i) => i.complete && i.naturalWidth > 0),
          15_000,
        ),
      );
      await t.click();
      loaded.push((await t.getAttribute("aria-pressed")) === "true");
    }
    await ctx.page.keyboard.press("Escape");
    return { ok: loaded.every(Boolean), detail: JSON.stringify(loaded) };
  },
  { notes: "kind: a photo tile of the Days view (first, middle and last checked)" },
);
R(
  "select.shift-click",
  "library (Days)",
  "shortcut",
  "Shift-click",
  "click the first tile, Shift-click the third",
  "the range of three is selected",
  async (ctx) => {
    await home(ctx);
    const order = await W(ctx)
      .locator(".mac-photos-cell")
      .evaluateAll((cells) => cells.map((c) => c.getAttribute("aria-label")));
    ctx.data.order = order;
    await tile(ctx, order[0]).click();
    await tile(ctx, order[2]).click({ modifiers: ["Shift"] });
    return {
      ok: (await selected(ctx).count()) === 3,
      detail: `${await selected(ctx).count()} selected`,
    };
  },
);
R(
  "select.command-click",
  "library (Days)",
  "shortcut",
  "Command-click",
  "Command-click the middle tile of the selection",
  "it leaves the selection",
  async (ctx) => {
    await tile(ctx, ctx.data.order[1]).click({ modifiers: ["ControlOrMeta"] });
    return { ok: (await selected(ctx).count()) === 2 };
  },
);
R(
  "select.escape",
  "library (Days)",
  "shortcut",
  "Escape",
  "press Escape",
  "the selection is cleared",
  async (ctx) => {
    await ctx.page.keyboard.press("Escape");
    return { ok: (await selected(ctx).count()) === 0 };
  },
);
R(
  "select.command-a",
  "library (Days)",
  "shortcut",
  "Command-A",
  "click a tile, press Command-A",
  "every photo shown is selected",
  async (ctx) => {
    await tile(ctx, ctx.data.order[0]).click();
    await ctx.page.keyboard.press("ControlOrMeta+a");
    const n = await selected(ctx).count();
    await ctx.page.keyboard.press("Escape");
    return { ok: n === 3, detail: `${n}` };
  },
);
R(
  "menu.edit.select-all",
  "menu:Edit",
  "menuitem",
  "Select All",
  "Edit > Select All",
  "every photo shown is selected",
  async (ctx) => {
    await home(ctx);
    await chooseMenu(ctx.page, "Edit", "Select All");
    return { ok: (await selected(ctx).count()) === 3 };
  },
);
R(
  "menu.edit.deselect-all",
  "menu:Edit",
  "menuitem",
  "Deselect All",
  "with all selected, Edit > Deselect All",
  "nothing is selected",
  async (ctx) => {
    await chooseMenu(ctx.page, "Edit", "Deselect All");
    return { ok: (await selected(ctx).count()) === 0 };
  },
);

// --- Info, favourite, rotate, share -----------------------------------------------------------
const infoPanel = (ctx) => ctx.page.locator(".mac-photos-info-window");
const infoShows = async (ctx) => {
  const ok = await infoPanel(ctx)
    .waitFor({ timeout: 8_000 })
    .then(
      () => true,
      () => false,
    );
  const text = ok ? await infoPanel(ctx).innerText() : "";
  await ctx.page.keyboard.press("Escape");
  await W(ctx).getByRole("button", { name: "Info", exact: true }).click();
  await infoPanel(ctx)
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => {});
  return {
    ok:
      ok &&
      text.includes("Canon EOS R") &&
      text.includes("640 × 480") &&
      text.includes("October 7, 2019"),
    detail: text.replace(/\s+/g, " ").slice(0, 140),
  };
};
R(
  "toolbar.info",
  "library (Days)",
  "button",
  "Info",
  "select the EXIF photo, click Info",
  "Info shows its date taken, size and camera",
  async (ctx) => {
    await home(ctx);
    await tile(ctx, names(ctx).a).click();
    await W(ctx).getByRole("button", { name: "Info", exact: true }).click();
    return infoShows(ctx);
  },
);
R(
  "shortcut.command-i",
  "library (Days)",
  "shortcut",
  "Command-I",
  "select the EXIF photo, press Command-I",
  "Info opens",
  async (ctx) => {
    await tile(ctx, names(ctx).a).click();
    await ctx.page.keyboard.press("ControlOrMeta+i");
    return infoShows(ctx);
  },
);
R(
  "menu.image.get-info",
  "menu:Image",
  "menuitem",
  "Get Info",
  "Image > Get Info",
  "Info opens",
  async (ctx) => {
    await tile(ctx, names(ctx).a).click();
    await chooseMenu(ctx.page, "Image", "Get Info");
    return infoShows(ctx);
  },
);
const favoriteRow = (id, state, role, name, how, act) =>
  R(
    id,
    state,
    role,
    name,
    how,
    "the photo is a favourite on the server, and the second time it is not",
    async (ctx) => {
      await home(ctx);
      await tile(ctx, names(ctx).b).click();
      const p = `/api/photos/photos/${ctx.data.ids.b}`;
      let saved = posted(ctx.page, p);
      await act(ctx);
      await saved;
      const on = (await photoNamed(ctx, names(ctx).b))?.favorite === true;
      saved = posted(ctx.page, p);
      await act(ctx);
      await saved;
      const off = (await photoNamed(ctx, names(ctx).b))?.favorite === false;
      return { ok: on && off, detail: `on ${on}, off ${off}` };
    },
  );
favoriteRow(
  "toolbar.favorite",
  "library (Days)",
  "button",
  "Favorite",
  "select a photo, click Favorite twice",
  (ctx) => W(ctx).getByRole("button", { name: "Favorite", exact: true }).click(),
);
favoriteRow(
  "shortcut.period",
  "library (Days)",
  "shortcut",
  ".",
  "select a photo, press . twice",
  (ctx) => ctx.page.keyboard.press("."),
);
favoriteRow(
  "menu.image.favorite",
  "menu:Image",
  "menuitem",
  "Favorite",
  "Image > Favorite, twice",
  (ctx) =>
    chooseMenu(ctx.page, "Image", "Favorite").catch(() =>
      chooseMenu(ctx.page, "Image", "Unfavorite"),
    ),
);
R(
  "toolbar.rotate",
  "library (Days)",
  "button",
  "Rotate",
  "select the PNG, click Rotate",
  "the turn is kept as an edit on the server",
  async (ctx) => {
    await home(ctx);
    await tile(ctx, names(ctx).b).click();
    const saved = posted(ctx.page, `/api/photos/photos/${ctx.data.ids.b}`);
    await W(ctx).getByRole("button", { name: "Rotate", exact: true }).click();
    await saved;
    const p = await photoNamed(ctx, names(ctx).b);
    return { ok: (p?.edit?.rotate ?? 0) !== 0, detail: JSON.stringify(p?.edit) };
  },
);
R(
  "menu.image.rotate-left",
  "menu:Image",
  "menuitem",
  "Rotate Left",
  "Image > Rotate Left",
  "the turn is undone or turned further on the server",
  async (ctx) => {
    const before = (await photoNamed(ctx, names(ctx).b))?.edit?.rotate ?? 0;
    const saved = posted(ctx.page, `/api/photos/photos/${ctx.data.ids.b}`);
    await chooseMenu(ctx.page, "Image", "Rotate Left");
    await saved;
    const after = (await photoNamed(ctx, names(ctx).b))?.edit?.rotate ?? 0;
    return { ok: after !== before, detail: `${before} -> ${after}` };
  },
);
R(
  "menu.image.revert-to-original",
  "menu:Image",
  "menuitem",
  "Revert to Original",
  "Rotate it, then Image > Revert to Original",
  "the edit is forgotten on the server; the original's bytes are unchanged",
  async (ctx) => {
    const p = `/api/photos/photos/${ctx.data.ids.b}`;
    let saved = posted(ctx.page, p);
    await W(ctx).getByRole("button", { name: "Rotate", exact: true }).click();
    await saved;
    saved = posted(ctx.page, p);
    await chooseMenu(ctx.page, "Image", "Revert to Original");
    await saved;
    const edit = (await photoNamed(ctx, names(ctx).b))?.edit;
    const same = (await driveSha(ctx.page, ctx.data.files.b)) === ctx.data.sha.b;
    return { ok: edit === null && same, detail: `${JSON.stringify(edit)} original same ${same}` };
  },
);
R(
  "toolbar.share",
  "library (Days)",
  "button",
  "Share",
  "select a photo, click Share",
  "the Share menu opens listing where to share (its items are R5's census)",
  async (ctx) => {
    await home(ctx);
    await tile(ctx, names(ctx).a).click();
    await W(ctx).getByRole("button", { name: "Share", exact: true }).click();
    const menu = ctx.page.getByRole("menu").last();
    const ok = await menu.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    );
    const text = ok ? await menu.innerText() : "";
    await ctx.page.keyboard.press("Escape");
    return { ok: ok && text.trim().length > 0, detail: text.replace(/\s+/g, " ").slice(0, 100) };
  },
);

// --- Views, zoom, search, Showing ---------------------------------------------------------------
for (const view of ["Years", "Months", "Days", "All Photos"]) {
  R(
    `view.${view.toLowerCase().replace(/ /g, "-")}`,
    "library",
    "button",
    view,
    `click ${view} in the View group`,
    `${view} is pressed and the library shows in it`,
    async (ctx) => {
      await home(ctx);
      const b = W(ctx).getByRole("button", { name: view, exact: true });
      await b.click();
      const pressed = await until(
        async () => (await b.getAttribute("aria-pressed")) === "true",
        5_000,
      );
      const shown = await W(ctx)
        .locator(".mac-photos-cell, [role=option], .mac-photos-group")
        .first()
        .isVisible()
        .catch(() => false);
      return { ok: pressed && shown, detail: `pressed ${pressed}, shown ${shown}` };
    },
  );
}
const zoomValue = async (ctx) =>
  Number(
    await W(ctx)
      .getByRole("slider", { name: "Zoom" })
      .getAttribute("aria-valuenow")
      .catch(() => "NaN"),
  );
const cellWidth = async (ctx) =>
  (await box(W(ctx).locator(".mac-photos-cell").first()))?.width ?? 0;
R(
  "toolbar.zoom-slider",
  "library (Days)",
  "slider",
  "Zoom",
  "focus the Zoom slider, press Right Arrow 3 times, then Left Arrow 3 times",
  "the value rises and the tiles grow; it falls back",
  async (ctx) => {
    await home(ctx);
    const s = W(ctx).getByRole("slider", { name: "Zoom" });
    const v0 = await zoomValue(ctx);
    const w0 = await cellWidth(ctx);
    // The slider is focused and moved by keyboard (its thumb is drawn over a native range input).
    await s.focus();
    const v1a = await zoomValue(ctx);
    for (let n = 0; n < 3; n += 1) await ctx.page.keyboard.press("ArrowRight");
    const v1 = await zoomValue(ctx);
    const w1 = await until(async () => (await cellWidth(ctx)) > w0, 3_000);
    for (let n = 0; n < 3; n += 1) await ctx.page.keyboard.press("ArrowLeft");
    const v2 = await zoomValue(ctx);
    return { ok: v1 > v1a && w1 && v2 < v1, detail: `${v0}/${v1a} -> ${v1} -> ${v2}` };
  },
);
R(
  "menu.view.zoom-in",
  "menu:View",
  "menuitem",
  "Zoom In",
  "View > Zoom In",
  "the Zoom slider's value rises",
  async (ctx) => {
    await home(ctx);
    const v0 = await zoomValue(ctx);
    await chooseMenu(ctx.page, "View", "Zoom In");
    const ok = await until(async () => (await zoomValue(ctx)) > v0, 3_000);
    return { ok, detail: `${v0} -> ${await zoomValue(ctx)}` };
  },
);
R(
  "menu.view.zoom-out",
  "menu:View",
  "menuitem",
  "Zoom Out",
  "View > Zoom Out",
  "the Zoom slider's value falls",
  async (ctx) => {
    const v0 = await zoomValue(ctx);
    await chooseMenu(ctx.page, "View", "Zoom Out");
    const ok = await until(async () => (await zoomValue(ctx)) < v0, 3_000);
    return { ok, detail: `${v0} -> ${await zoomValue(ctx)}` };
  },
);
R(
  "toolbar.search",
  "library",
  "searchbox",
  "Search",
  "type the camera's name, then a word nothing has",
  "only the photo taken with it is found; then No Results",
  async (ctx) => {
    await home(ctx);
    const field = W(ctx).getByRole("searchbox", { name: "Search" });
    await field.click();
    await field.pressSequentially("canon");
    const found = await until(
      async () =>
        (await opt(W(ctx), names(ctx).a).isVisible()) &&
        !(await opt(W(ctx), names(ctx).c).isVisible()),
      8_000,
    );
    await field.press("ControlOrMeta+a");
    await field.pressSequentially(`nothing${ctx.run}`);
    const none = await until(
      () => W(ctx).getByRole("status").filter({ hasText: "No Results" }).first().isVisible(),
      8_000,
    );
    await field.press("ControlOrMeta+a");
    await field.press("Backspace");
    return { ok: found && none, detail: `found ${found}, none ${none}` };
  },
);
R(
  "filter.showing",
  "library",
  "button",
  "/Showing: .+/",
  "favourite one photo (. key), click the Showing pop-up, choose Favorites, then All Items",
  "under Favorites only the favourite shows; under All Items every photo shows again; the pop-up names its choice",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    const n = names(ctx);
    const shown = (name) =>
      tile(ctx, name)
        .or(opt(W(ctx), name))
        .first()
        .isVisible()
        .catch(() => false);
    // Seed a known pair with real input: the JPEG favourite, the noisy JPEG not.
    const wasA = (await photoNamed(ctx, n.a))?.favorite === true;
    const wasC = (await photoNamed(ctx, n.c))?.favorite === true;
    for (const [name, was, want] of [
      [n.a, wasA, true],
      [n.c, wasC, false],
    ]) {
      if (was === want) continue;
      await tile(ctx, name).click();
      const saved = posted(page, `/api/photos/photos/${(await photoNamed(ctx, name)).id}`);
      await page.keyboard.press(".");
      await saved;
      await page.keyboard.press("Escape");
    }
    const pop = W(ctx).getByRole("button", { name: /^Showing: / });
    await pop.click();
    const choices = page
      .getByRole("menuitemradio")
      .or(page.getByRole("option"))
      .or(page.getByRole("menuitem"));
    await choices.first().waitFor({ timeout: 5_000 });
    const list = await choices.evaluateAll((items) => items.map((i) => i.textContent.trim()));
    ctx.data.showing = list;
    const choose = (label) =>
      page
        .getByRole("menuitemradio", { name: label })
        .or(page.getByRole("option", { name: label }))
        .or(page.getByRole("menuitem", { name: label }))
        .first()
        .click();
    await choose("Favorites");
    const named = await until(async () => /Favorites/.test((await pop.textContent()) ?? ""), 3_000);
    const onlyFavourite = await until(async () => (await shown(n.a)) && !(await shown(n.c)), 5_000);
    await pop.click();
    await choose("All Items");
    const back = await until(async () => /All Items/.test((await pop.textContent()) ?? ""), 3_000);
    const allAgain = await until(async () => (await shown(n.a)) && (await shown(n.c)), 5_000);
    // Put the favourites back as they were.
    for (const [name, was, now] of [
      [n.a, wasA, true],
      [n.c, wasC, false],
    ]) {
      if (was === now) continue;
      await tile(ctx, name).click();
      const saved = posted(page, `/api/photos/photos/${(await photoNamed(ctx, name)).id}`);
      await page.keyboard.press(".");
      await saved;
      await page.keyboard.press("Escape");
    }
    return {
      ok: named && onlyFavourite && back && allAgain,
      detail: `named ${named}, only favourite ${onlyFavourite}, back ${back}, all again ${allAgain}; ${list.join(", ")}`,
    };
  },
  { notes: "kind: the library's Showing filter pop-up, named by its current choice" },
);
for (const choice of ["All Items", "Favorites", "Edited"]) {
  const what = choice === "All Items" ? "live" : choice === "Favorites" ? "favourite" : "edited";
  R(
    `filter.showing.${choice.toLowerCase().replace(/ /g, "-")}`,
    "Showing pop-up",
    "menuitemradio",
    choice,
    `click the Showing pop-up, choose ${choice}; reopen it`,
    `the pop-up names ${choice}, its item is checked when reopened, and the Days grid shows exactly the photos the server holds as ${what}`,
    async (ctx) => {
      const { page } = ctx;
      await home(ctx);
      const pop = W(ctx).getByRole("button", { name: /^Showing: / });
      await pop.click();
      await page.getByRole("menuitemradio", { name: choice, exact: true }).click();
      const named = await until(
        async () => ((await pop.textContent()) ?? "").includes(choice),
        3_000,
      );
      await pop.click();
      const checked =
        (await page
          .getByRole("menuitemradio", { name: choice, exact: true })
          .getAttribute("aria-checked")) === "true";
      await page.keyboard.press("Escape");
      const live = ((await lib(ctx)).photos ?? []).filter((p) => p.deleted_ms === null);
      const want = live
        .filter(
          (p) =>
            choice === "All Items" ||
            (choice === "Favorites" ? p.favorite === true : p.edit !== null),
        )
        .map((p) => p.name)
        .sort();
      let shown = [];
      const same = await until(async () => {
        shown = (
          await W(ctx)
            .locator(".mac-photos-cell")
            .evaluateAll((cells) => cells.map((c) => c.getAttribute("aria-label")))
        ).sort();
        return JSON.stringify(shown) === JSON.stringify(want);
      }, 5_000);
      const reset = choice === "All Items" || (await showAll(ctx));
      return {
        ok: named && checked && same && reset,
        detail: `named ${named}, checked ${checked}, back to All Items ${reset}; shown ${JSON.stringify(shown)} wanted ${JSON.stringify(want)}`,
      };
    },
  );
}

// --- Viewer and editor --------------------------------------------------------------------------
R(
  "viewer.open",
  "library (Days)",
  "shortcut",
  "double-click a tile",
  "double-click the noisy JPEG's tile",
  "the viewer shows the original full size (1200 x 800)",
  async (ctx) => {
    await home(ctx);
    await tile(ctx, names(ctx).c).dblclick();
    const s = await shownSize(ctx, { width: 1200, height: 800 });
    return { ok: s.width === 1200 && s.height === 800, detail: `${s.width}x${s.height}` };
  },
);
for (const [dir, name] of [
  ["next", "Next"],
  ["previous", "Previous"],
]) {
  R(
    `viewer.${dir}`,
    "viewer",
    "button",
    name,
    `in the viewer, click ${name}`,
    "the viewer shows another photo of the library",
    async (ctx) => {
      const img = W(ctx).locator("img.mac-photos-picture").first();
      const before = await img.getAttribute("src").catch(() => "");
      const b = W(ctx).getByRole("button", { name, exact: true });
      if (!(await b.isEnabled().catch(() => false))) {
        const other = W(ctx).getByRole("button", {
          name: name === "Next" ? "Previous" : "Next",
          exact: true,
        });
        await other.click();
      }
      const start = await img.getAttribute("src").catch(() => "");
      await b.click();
      const changed = await until(
        async () => (await img.getAttribute("src").catch(() => "")) !== start,
        8_000,
      );
      return { ok: changed, detail: `${before?.slice(0, 30)}` };
    },
  );
}
R(
  "viewer.back",
  "viewer",
  "button",
  "Back",
  "in the viewer, click Back",
  "the library grid shows again",
  async (ctx) => {
    await W(ctx).getByRole("button", { name: "Back", exact: true }).click();
    const ok = await until(() => tile(ctx, names(ctx).a).isVisible(), 8_000);
    return { ok };
  },
);
const openEditor = async (ctx, how = "button") => {
  await home(ctx);
  await tile(ctx, names(ctx).c).dblclick();
  await shownSize(ctx);
  if (how === "menu") await ctx.page.keyboard.press("Enter");
  else await W(ctx).getByRole("button", { name: "Edit", exact: true }).click();
  return W(ctx)
    .locator("canvas.mac-photos-edit-canvas")
    .waitFor({ timeout: 20_000 })
    .then(
      () => true,
      () => false,
    );
};
const doneEdit = async (ctx) => {
  const saved = posted(ctx.page, `/api/photos/photos/${ctx.data.ids.c}`, 20_000);
  await W(ctx).getByRole("button", { name: "Done", exact: true }).click();
  return (await saved).status() === 200;
};
const revertC = async (ctx) => {
  if ((await photoNamed(ctx, names(ctx).c))?.edit) {
    await openEditor(ctx);
    const saved = posted(ctx.page, `/api/photos/photos/${ctx.data.ids.c}`, 20_000);
    await W(ctx).getByRole("button", { name: "Revert to Original", exact: true }).click();
    await saved.catch(() => {});
  }
  await home(ctx);
};
R(
  "viewer.edit",
  "viewer",
  "button",
  "Edit",
  "open a photo, click Edit",
  "the editor opens on the photo",
  async (ctx) => ({ ok: await openEditor(ctx) }),
);
R(
  "editor.cancel",
  "editor",
  "button",
  "Cancel",
  "in the editor, change Exposure, click Cancel",
  "the editor closes and nothing is saved",
  async (ctx) => {
    const s = W(ctx).getByRole("slider", { name: "Exposure" });
    await s.focus();
    await ctx.page.keyboard.press("ArrowRight");
    await W(ctx).getByRole("button", { name: "Cancel", exact: true }).click();
    const closed = await until(
      async () => !(await W(ctx).locator("canvas.mac-photos-edit-canvas").isVisible()),
      8_000,
    );
    return { ok: closed && (await photoNamed(ctx, names(ctx).c))?.edit === null };
  },
);
R(
  "shortcut.return-edit",
  "viewer",
  "key",
  "Return",
  "open a photo, press Return (Image has no Edit row in this app)",
  "the editor opens",
  async (ctx) => ({ ok: await openEditor(ctx, "menu") }),
);
const ADJUST = [
  "Exposure",
  "Brightness",
  "Contrast",
  "Highlights",
  "Shadows",
  "Saturation",
  "Warmth",
  "Tint",
];
for (const name of ADJUST) {
  R(
    `editor.adjust.${name.toLowerCase()}`,
    "editor (Adjust)",
    "slider",
    name,
    `in the editor's Adjust pane, focus ${name} and press Right Arrow 5 times; Done`,
    `the ${name} value rises and Done keeps it in the edit recipe on the server; the original is untouched`,
    async (ctx) => {
      if (!(await W(ctx).locator("canvas.mac-photos-edit-canvas").isVisible()))
        await openEditor(ctx);
      const adjust = W(ctx)
        .getByRole("button", { name: "Adjust", exact: true })
        .or(W(ctx).getByRole("tab", { name: "Adjust" }));
      if (
        await adjust
          .first()
          .isVisible()
          .catch(() => false)
      )
        await adjust.first().click();
      const s = W(ctx).getByRole("slider", { name, exact: true });
      const v0 = Number(await s.getAttribute("aria-valuenow"));
      await s.focus();
      for (let n = 0; n < 5; n += 1) await ctx.page.keyboard.press("ArrowRight");
      const v1 = Number(await s.getAttribute("aria-valuenow"));
      const saved = await doneEdit(ctx);
      const edit = (await photoNamed(ctx, names(ctx).c))?.edit;
      const key = name.toLowerCase();
      const kept = (edit?.adjust?.[key] ?? 0) > 0;
      await revertC(ctx);
      return {
        ok: v1 > v0 && saved && kept,
        detail: `${v0} -> ${v1}; ${JSON.stringify(edit?.adjust)}`,
      };
    },
    { timeout: 90_000 },
  );
}
R(
  "editor.auto-enhance",
  "editor (Adjust)",
  "button",
  "Auto Enhance",
  "click Auto Enhance, Done",
  "adjustments are set and kept on the server",
  async (ctx) => {
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Auto Enhance" }).click();
    const saved = await doneEdit(ctx);
    const edit = (await photoNamed(ctx, names(ctx).c))?.edit;
    const set = Object.values(edit?.adjust ?? {}).some((v) => v !== 0);
    await revertC(ctx);
    return { ok: saved && set, detail: JSON.stringify(edit?.adjust) };
  },
  { timeout: 90_000 },
);
R(
  "editor.reset-adjustments",
  "editor (Adjust)",
  "button",
  "Reset Adjustments",
  "change Exposure, click Reset Adjustments",
  "every adjustment slider is back at 0",
  async (ctx) => {
    await openEditor(ctx);
    const s = W(ctx).getByRole("slider", { name: "Exposure" });
    await s.focus();
    for (let n = 0; n < 4; n += 1) await ctx.page.keyboard.press("ArrowRight");
    await W(ctx).getByRole("button", { name: "Reset Adjustments" }).click();
    const v = Number(await s.getAttribute("aria-valuenow"));
    await W(ctx).getByRole("button", { name: "Cancel", exact: true }).click();
    await home(ctx);
    return { ok: v === 0, detail: `${v}` };
  },
  { timeout: 90_000 },
);
R(
  "editor.filters",
  "editor",
  "button",
  "Filters",
  "click Filters in the editor",
  "the Filters pane lists the filters",
  async (ctx) => {
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Filters", exact: true }).click();
    const ok = await W(ctx).getByRole("radio", { name: "Mono" }).isVisible();
    return { ok };
  },
);
const FILTERS = [
  "Original",
  "Vivid",
  "Vivid Warm",
  "Vivid Cool",
  "Dramatic",
  "Dramatic Warm",
  "Dramatic Cool",
  "Mono",
  "Silvertone",
  "Noir",
];
const GREY_FILTERS = new Set(["Mono", "Silvertone", "Noir"]);
/**
 * What the editor's canvas shows, read back (never drawn on): its image downsampled to 24 x 24,
 * as the mean colour, the mean channel spread (0 for grey) and the pixels themselves.
 */
const canvasLook = (ctx) =>
  W(ctx)
    .locator("canvas.mac-photos-edit-canvas")
    .evaluate(async (canvas) => {
      const image = new Image();
      image.src = canvas.toDataURL();
      await image.decode();
      const small = document.createElement("canvas");
      small.width = 24;
      small.height = 24;
      const g = small.getContext("2d");
      g.drawImage(image, 0, 0, 24, 24);
      const data = [...g.getImageData(0, 0, 24, 24).data];
      let r = 0,
        gr = 0,
        b = 0,
        spread = 0;
      for (let at = 0; at < data.length; at += 4) {
        r += data[at];
        gr += data[at + 1];
        b += data[at + 2];
        spread += Math.abs(data[at] - data[at + 1]) + Math.abs(data[at + 1] - data[at + 2]);
      }
      const n = data.length / 4;
      return { r: r / n, g: gr / n, b: b / n, spread: spread / n, data };
    });
const lookDistance = (one, two) => {
  let sum = 0;
  for (let at = 0; at < one.data.length; at += 4)
    sum +=
      Math.abs(one.data[at] - two.data[at]) +
      Math.abs(one.data[at + 1] - two.data[at + 1]) +
      Math.abs(one.data[at + 2] - two.data[at + 2]);
  return sum / (one.data.length / 4);
};
for (const name of FILTERS) {
  R(
    `editor.filter.${name.toLowerCase().replace(/ /g, "-")}`,
    "editor (Filters)",
    "radio",
    name,
    `in Filters, choose ${name}`,
    name === "Original"
      ? "Original is checked and the preview is redrawn as the unfiltered photo"
      : `${name} is checked and the preview is redrawn with it: its pixels differ from Original's${GREY_FILTERS.has(name) ? " and are grey" : ""}`,
    async (ctx) => {
      if (
        !(await W(ctx)
          .getByRole("radio", { name: "Mono" })
          .isVisible()
          .catch(() => false))
      ) {
        await openEditor(ctx);
        await W(ctx).getByRole("button", { name: "Filters", exact: true }).click();
      }
      // The unfiltered baseline, taken once with Original chosen by a real click.
      if (!ctx.data.originalLook) {
        const original = W(ctx).getByRole("radio", { name: "Original", exact: true });
        await original.click();
        await sleep(500);
        ctx.data.originalLook = await canvasLook(ctx);
      }
      const base = ctx.data.originalLook;
      const r = W(ctx).getByRole("radio", { name, exact: true });
      await r.click();
      const checked = await until(
        async () =>
          (await r.getAttribute("aria-checked")) === "true" ||
          (await r.isChecked().catch(() => false)),
        3_000,
      );
      let look = null;
      let distance = 0;
      const drawn = await until(async () => {
        look = await canvasLook(ctx);
        distance = lookDistance(look, base);
        if (name === "Original") return distance < 2;
        return (
          distance > 6 && (!GREY_FILTERS.has(name) || look.spread < (name === "Silvertone" ? 8 : 3))
        );
      }, 6_000);
      const summary = look
        ? `distance from Original ${distance.toFixed(1)}, spread ${look.spread.toFixed(1)}, mean ${look.r.toFixed(0)}/${look.g.toFixed(0)}/${look.b.toFixed(0)}`
        : "no look";
      return { ok: checked && drawn, detail: `checked ${checked}; ${summary}` };
    },
  );
}
R(
  "editor.filter.done",
  "editor (Filters)",
  "button",
  "Done",
  "choose Mono, click Done",
  "the server keeps filter mono beside the untouched original; the viewer shows it",
  async (ctx) => {
    await W(ctx).getByRole("radio", { name: "Mono", exact: true }).click();
    const saved = await doneEdit(ctx);
    const edit = (await photoNamed(ctx, names(ctx).c))?.edit;
    const same = (await driveSha(ctx.page, ctx.data.files.c)) === ctx.data.sha.c;
    return {
      ok: saved && edit?.filter === "mono" && same,
      detail: `${JSON.stringify(edit)} original same ${same}`,
    };
  },
);
R(
  "editor.revert-to-original",
  "editor",
  "button",
  "Revert to Original",
  "open the edited photo's editor, click Revert to Original",
  "the server forgets the edit",
  async (ctx) => {
    await openEditor(ctx);
    const saved = posted(ctx.page, `/api/photos/photos/${ctx.data.ids.c}`, 20_000);
    await W(ctx).getByRole("button", { name: "Revert to Original", exact: true }).click();
    await saved;
    const ok = (await photoNamed(ctx, names(ctx).c))?.edit === null;
    await home(ctx);
    return { ok };
  },
);
R(
  "editor.crop",
  "editor",
  "button",
  "Crop",
  "click Crop in the editor",
  "the Crop pane shows Straighten, Aspect, Rotate and Reset",
  async (ctx) => {
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
    const ok = await W(ctx).getByRole("slider", { name: "Straighten" }).isVisible();
    return { ok };
  },
);
R(
  "editor.crop.straighten",
  "editor (Crop)",
  "slider",
  "Straighten",
  "focus Straighten, Right Arrow 5 times, Done",
  "the server keeps the straighten angle in the edit",
  async (ctx) => {
    const s = W(ctx).getByRole("slider", { name: "Straighten" });
    await s.focus();
    for (let n = 0; n < 5; n += 1) await ctx.page.keyboard.press("ArrowRight");
    const saved = await doneEdit(ctx);
    const edit = (await photoNamed(ctx, names(ctx).c))?.edit;
    await revertC(ctx);
    return { ok: saved && (edit?.straighten ?? 0) !== 0, detail: JSON.stringify(edit) };
  },
  { timeout: 90_000 },
);
R(
  "editor.crop.aspect",
  "editor (Crop)",
  "combobox",
  "Aspect",
  "choose Square in Aspect, Done",
  "the crop is square on the server",
  async (ctx) => {
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
    const aspect = W(ctx)
      .getByRole("combobox", { name: "Aspect" })
      .or(W(ctx).getByRole("button", { name: /Aspect/ }))
      .first();
    await aspect.click();
    const square = ctx.page
      .getByRole("option", { name: /Square/ })
      .or(ctx.page.getByRole("menuitemradio", { name: /Square/ }))
      .or(ctx.page.getByRole("menuitemcheckbox", { name: /Square/ }))
      .or(ctx.page.getByRole("menuitem", { name: /Square/ }))
      .first();
    const offered = await square.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    );
    if (offered) await square.click();
    else await ctx.page.keyboard.press("Escape");
    const saved = await doneEdit(ctx);
    const edit = (await photoNamed(ctx, names(ctx).c))?.edit;
    const crop = edit?.crop;
    const sq = crop
      ? Math.abs(crop.width * 1200 - crop.height * 800) < 12 ||
        Math.abs(crop.w * 1200 - crop.h * 800) < 12
      : false;
    await revertC(ctx);
    return { ok: saved && sq, detail: JSON.stringify(crop) };
  },
  { timeout: 90_000 },
);
R(
  "editor.crop.rotate",
  "editor (Crop)",
  "button",
  "Rotate",
  "in Crop, click Rotate, Done",
  "the viewer shows the photo turned (800 x 1200) and the server keeps rotate 1",
  async (ctx) => {
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
    await W(ctx).getByRole("button", { name: "Rotate", exact: true }).click();
    const saved = await doneEdit(ctx);
    const edit = (await photoNamed(ctx, names(ctx).c))?.edit;
    const s = await shownSize(ctx, { width: 800, height: 1200 });
    await revertC(ctx);
    return {
      ok: saved && edit?.rotate === 1 && s.width === 800,
      detail: `${JSON.stringify(edit)} ${s.width}x${s.height}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "editor.crop.flip",
  "editor (Crop)",
  "button",
  "Flip",
  "in Crop, click Flip, Done",
  "the server keeps the flip in the edit",
  async (ctx) => {
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
    await W(ctx).getByRole("button", { name: /Flip/ }).first().click();
    const saved = await doneEdit(ctx);
    const edit = (await photoNamed(ctx, names(ctx).c))?.edit;
    await revertC(ctx);
    return { ok: saved && !!edit?.flip, detail: JSON.stringify(edit) };
  },
  { timeout: 90_000 },
);
R(
  "editor.adjust",
  "editor",
  "button",
  "Adjust",
  "in the editor, click Crop, then Adjust",
  "the Adjust pane shows its sliders again (Exposure)",
  async (ctx) => {
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
    await W(ctx).getByRole("slider", { name: "Straighten" }).waitFor({ timeout: 5_000 });
    await W(ctx).getByRole("button", { name: "Adjust", exact: true }).click();
    const ok = await until(
      () => W(ctx).getByRole("slider", { name: "Exposure" }).isVisible(),
      5_000,
    );
    await W(ctx).getByRole("button", { name: "Cancel", exact: true }).click();
    return { ok };
  },
);
R(
  "editor.crop.corner",
  "editor (Crop)",
  "button",
  "/(Top|Bottom) (left|right) corner of the crop/",
  "in Crop, drag each of the four corners inward by 60 px, then Cancel",
  "each drag shrinks the crop frame (Move the crop) from that corner; Cancel leaves the photo unedited",
  async (ctx) => {
    const { page } = ctx;
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
    const mover = W(ctx).getByRole("button", { name: "Move the crop" });
    const results = [];
    for (const [name, dx, dy] of [
      ["Top left", 60, 60],
      ["Top right", -60, 60],
      ["Bottom left", 60, -60],
      ["Bottom right", -60, -60],
    ]) {
      const before = await box(mover);
      const c = await box(W(ctx).getByRole("button", { name: `${name} corner of the crop` }));
      await drag(page, c.x + c.width / 2, c.y + c.height / 2, dx, dy);
      const after = await box(mover);
      results.push(
        `${name}:${after.width < before.width - 20 && after.height < before.height - 20}`,
      );
    }
    await W(ctx).getByRole("button", { name: "Cancel", exact: true }).click();
    const edit = (await photoNamed(ctx, names(ctx).c))?.edit ?? null;
    return {
      ok: results.every((r) => r.endsWith("true")) && edit === null,
      detail: `${results.join(", ")}; edit after Cancel ${JSON.stringify(edit)}`,
    };
  },
  {
    notes: "kind: the four corner handles of the crop frame; every one is dragged",
    timeout: 90_000,
  },
);
R(
  "editor.crop.move",
  "editor (Crop)",
  "button",
  "Move the crop",
  "in Crop, drag the bottom right corner inward, drag Move the crop by (40, 30), Done",
  "the crop frame moves with the drag and the server keeps the crop in the edit",
  async (ctx) => {
    const { page } = ctx;
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
    const c = await box(W(ctx).getByRole("button", { name: "Bottom right corner of the crop" }));
    await drag(page, c.x + c.width / 2, c.y + c.height / 2, -120, -90);
    const mover = W(ctx).getByRole("button", { name: "Move the crop" });
    const before = await box(mover);
    await drag(page, before.x + before.width / 2, before.y + before.height / 2, 40, 30);
    const after = await box(mover);
    const saved = await doneEdit(ctx);
    const crop = (await photoNamed(ctx, names(ctx).c))?.edit?.crop;
    await revertC(ctx);
    const moved = after.x > before.x + 20 && after.y > before.y + 15;
    return {
      ok: saved && moved && !!crop,
      detail: `moved ${moved} (${before.x},${before.y}) -> (${after.x},${after.y}); crop ${JSON.stringify(crop)}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "editor.crop.reset",
  "editor (Crop)",
  "button",
  "Reset",
  "in Crop, Straighten then Reset",
  "Straighten is back at 0",
  async (ctx) => {
    await openEditor(ctx);
    await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
    const s = W(ctx).getByRole("slider", { name: "Straighten" });
    await s.focus();
    for (let n = 0; n < 3; n += 1) await ctx.page.keyboard.press("ArrowRight");
    await W(ctx).getByRole("button", { name: "Reset", exact: true }).click();
    const v = Number(await s.getAttribute("aria-valuenow"));
    await W(ctx).getByRole("button", { name: "Cancel", exact: true }).click();
    await home(ctx);
    return { ok: v === 0, detail: `${v}` };
  },
  { timeout: 90_000 },
);

// --- Export -------------------------------------------------------------------------------------
let exportCount = 0;
const download = async (ctx, item) => {
  const { page } = ctx;
  await home(ctx);
  await tile(ctx, names(ctx).a).click();
  await chooseMenu(page, "File", item);
  return exportedFile(ctx);
};
/** The open Export sheet, through Other… and the Save panel: the file as the drive then holds it. */
async function exportedFile(ctx) {
  const { page } = ctx;
  await page.getByRole("combobox", { name: "Save To" }).click();
  await page.getByRole("option", { name: "Other…", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const panel = page.locator(".mac-save-panel").first();
  await panel.waitFor({ timeout: 10_000 });
  exportCount += 1;
  const stem = `Exported ${ctx.run} ${exportCount}`;
  await panel.getByRole("textbox").first().fill(stem);
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await panel.waitFor({ state: "hidden", timeout: 10_000 });
  let entry;
  await until(async () => {
    const listed = await page.evaluate(() =>
      fetch("/api/files/", { credentials: "same-origin" }).then((reply) => reply.json()),
    );
    entry = listed.entries?.find((each) => each.name.startsWith(stem));
    return Boolean(entry);
  }, 20_000);
  const read = await page.evaluate(
    async ({ id, size }) => {
      const parts = [];
      for (let piece = 0; piece * 262144 < size; piece += 8) {
        const reply = await fetch(`/api/files/content/${id}?piece=${piece}&count=8`, {
          credentials: "same-origin",
        });
        parts.push(...new Uint8Array(await reply.arrayBuffer()));
      }
      return parts;
    },
    { id: entry?.id, size: entry?.size ?? 0 },
  );
  return { bytes: Buffer.from(read), name: entry?.name };
}
R(
  "menu.file.export-unmodified-original",
  "menu:File",
  "menuitem",
  "Export Unmodified Original…",
  "select the EXIF photo, turn it with Rotate, File > Export Unmodified Original…, then Image > Revert to Original",
  "once the photo is edited, the original's exact bytes are saved on the drive through the Export sheet (SHA-256 equal); whether the item is dimmed while the photo is unedited is recorded",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    await tile(ctx, names(ctx).a).click();
    const unedited = await menuItemState(page, "File", "Export Unmodified Original…");
    const a = await photoNamed(ctx, names(ctx).a);
    const turned = posted(page, `/api/photos/photos/${a.id}`);
    await W(ctx).getByRole("button", { name: "Rotate", exact: true }).click();
    await turned;
    const { bytes, name } = await download(ctx, "Export Unmodified Original…");
    const reverted = posted(page, `/api/photos/photos/${a.id}`);
    await chooseMenu(page, "Image", "Revert to Original");
    await reverted;
    const after = (await photoNamed(ctx, names(ctx).a))?.edit ?? null;
    return {
      ok: sha(bytes) === ctx.data.sha.a && after === null,
      detail: `dimmed while unedited ${unedited.disabled}; ${name} ${bytes.length} bytes; reverted ${after === null}`,
    };
  },
);
R(
  "menu.file.export",
  "menu:File",
  "menuitem",
  "Export…",
  "select the EXIF photo, File > Export…",
  "a JPEG of the photo as shown is saved to the computer",
  async (ctx) => {
    const { bytes, name } = await download(ctx, "Export…");
    return {
      ok: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.length > 1000,
      detail: `${name} ${bytes.length} bytes`,
    };
  },
);

// --- Albums -------------------------------------------------------------------------------------
const dialogName = (ctx) => ctx.page.getByRole("textbox", { name: "Name" });
R(
  "menu.image.unfavorite",
  "menu:Image",
  "menuitem",
  "Unfavorite",
  "favourite the EXIF photo with the . key, then Image > Unfavorite",
  "the Image menu names the command Unfavorite for a favourite, and choosing it takes the favourite away on the server",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    await tile(ctx, names(ctx).a).click();
    const a = await photoNamed(ctx, names(ctx).a);
    if (!a?.favorite) {
      const starred = posted(page, `/api/photos/photos/${a.id}`);
      await page.keyboard.press(".");
      await starred;
    }
    const unstarred = posted(page, `/api/photos/photos/${a.id}`);
    await chooseMenu(page, "Image", "Unfavorite");
    await unstarred;
    return { ok: (await photoNamed(ctx, names(ctx).a))?.favorite === false };
  },
);
R(
  "menu.file.new-album-with-selection",
  "menu:File",
  "menuitem",
  "New Album with Selection",
  "select the PNG, File > New Album with Selection, name it, Create; then Delete Album",
  "an album holding just the selected photo is kept on the server (and deleted after)",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    const name = `Picked ${ctx.run}`;
    await tile(ctx, names(ctx).b).click();
    await chooseMenu(page, "File", "New Album with Selection");
    await dialogName(ctx).fill(name);
    const made = posted(page, "/api/photos/albums");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await made;
    // The album is made first, and the selection added to it in a second write.
    await until(async () => ((await albumNamed(ctx, name))?.photos?.length ?? 0) > 0, 10_000);
    const al = await albumNamed(ctx, name);
    const b = await photoNamed(ctx, names(ctx).b);
    await side(ctx, name).click();
    const gone = posted(page, `/api/photos/albums/${al?.id}`);
    await W(ctx).getByRole("button", { name: "Delete Album" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await gone;
    await home(ctx);
    return {
      ok: al?.photos?.length === 1 && al.photos[0] === b?.id && !(await albumNamed(ctx, name)),
      detail: JSON.stringify(al?.photos),
    };
  },
);
R(
  "library.grid",
  "library (a view or album)",
  "listbox",
  "/(Favorites|Recents|Imports|Photo Booth|Recently Deleted|(Trip|Second|Best) [a-z0-9]+)/",
  "open Recents and Imports in the sidebar; click the first photo of each grid",
  "each view's grid lists its photos as options and a click selects one",
  async (ctx) => {
    await home(ctx);
    const out = [];
    for (const view of ["Recents", "Imports"]) {
      await side(ctx, view).click();
      // A grid's options, or in Imports the cells of a section for each import.
      const cells = W(ctx).locator('.mac-photos-cell, [role="option"]');
      const shown = await cells
        .first()
        .waitFor({ timeout: 5_000 })
        .then(
          () => true,
          () => false,
        );
      const options = shown ? await cells.count() : 0;
      let picked = false;
      if (options > 0) {
        const first = cells.first();
        await first.click();
        picked = await until(
          async () =>
            (await first.getAttribute("aria-selected")) === "true" ||
            (await first.getAttribute("aria-pressed")) === "true",
          3_000,
        );
      }
      out.push(`${view}:${shown}/${options}/${picked}`);
    }
    await home(ctx);
    return { ok: out.every((x) => /:true\/[1-9]\d*\/true$/.test(x)), detail: out.join(", ") };
  },
  { notes: "kind: the photo grid (listbox) of a sidebar view or album, named after it" },
);
R(
  "sidebar.new-album",
  "library",
  "button",
  "New Album",
  "select two photos, click New Album, type a name, Create",
  "the album is kept on the server holding both photos, and listed in My Albums",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    ctx.data.trip = `Trip ${ctx.run}`;
    await tile(ctx, names(ctx).a).click();
    await tile(ctx, names(ctx).c).click({ modifiers: ["ControlOrMeta"] });
    await W(ctx).getByRole("button", { name: "New Album", exact: true }).click();
    await dialogName(ctx).fill(ctx.data.trip);
    const made = posted(page, "/api/photos/albums");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await made;
    // The album is made first and the photos join it in a second request.
    await until(async () => (await albumNamed(ctx, ctx.data.trip))?.photos?.length === 2, 8_000);
    const al = await albumNamed(ctx, ctx.data.trip);
    ctx.data.tripId = al?.id;
    await side(ctx, ctx.data.trip).waitFor({ timeout: 8_000 });
    return { ok: al?.photos?.length === 2, detail: JSON.stringify(al?.photos) };
  },
);
R(
  "dialog.album-name",
  "New Album sheet",
  "textbox",
  "Name",
  "type into the sheet's Name field",
  "the album takes the typed name (checked with New Album)",
  async (ctx) => ({ ok: !!(await albumNamed(ctx, ctx.data.trip)) }),
);
R(
  "dialog.create",
  "New Album sheet",
  "button",
  "Create",
  "click Create in the sheet",
  "the album is made (checked with New Album)",
  async (ctx) => ({ ok: !!ctx.data.tripId }),
);
R(
  "dialog.escape",
  "New Album popover",
  "shortcut",
  "Escape",
  "File > New Album, type a name, press Escape",
  "the popover closes and no album is made (the popover has no Cancel button: Escape or a click outside dismisses it)",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    const before = (await lib(ctx)).albums.length;
    await chooseMenu(page, "File", "New Album");
    await dialogName(ctx).fill(`Never ${ctx.run}`);
    await page.keyboard.press("Escape");
    const closed = await until(
      async () =>
        !(await dialogName(ctx)
          .isVisible()
          .catch(() => false)),
      5_000,
    );
    await sleep(800);
    return { ok: closed && (await lib(ctx)).albums.length === before, detail: `closed ${closed}` };
  },
);
R(
  "menu.file.new-album",
  "menu:File",
  "menuitem",
  "New Album",
  "with nothing selected, File > New Album, type a name, Create",
  "an empty album is kept on the server",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    ctx.data.second = `Second ${ctx.run}`;
    await chooseMenu(page, "File", "New Album");
    await dialogName(ctx).fill(ctx.data.second);
    const made = posted(page, "/api/photos/albums");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await made;
    const al = await albumNamed(ctx, ctx.data.second);
    ctx.data.secondId = al?.id;
    await side(ctx, ctx.data.second).waitFor({ timeout: 8_000 });
    return { ok: al?.photos?.length === 0 };
  },
);
R(
  "sidebar.album",
  "library",
  "treeitem",
  "/(Trip|Second|Best) [a-z0-9]+( \\d+)?/",
  "click an album in My Albums",
  "its photos show in a grid named after it",
  async (ctx) => {
    await side(ctx, ctx.data.trip).click();
    const grid = W(ctx).getByRole("listbox", { name: ctx.data.trip });
    const ok = await opt(grid, names(ctx).a)
      .waitFor({ timeout: 8_000 })
      .then(
        () => true,
        () => false,
      );
    await side(ctx, ctx.data.second).click();
    const empty = await until(
      () =>
        W(ctx)
          .getByRole("listbox", { name: ctx.data.second })
          .or(W(ctx).getByRole("status"))
          .first()
          .isVisible(),
      5_000,
    );
    return { ok: ok && empty };
  },
  { notes: "kind: an album row of the sidebar's My Albums (each album checked)" },
);
R(
  "album.photo",
  "album",
  "option",
  "/(Lighthouse|Harbour|Meadow) [a-z0-9]+/",
  "an album's or a smart album's photos",
  "each is listed in the album's grid and opens in the viewer on double-click",
  async (ctx) => {
    await side(ctx, ctx.data.trip).click();
    const grid = W(ctx).getByRole("listbox", { name: ctx.data.trip });
    const all = await grid
      .getByRole("option")
      .evaluateAll((o) => o.map((e) => (e.getAttribute("aria-label") ?? e.textContent).trim()));
    await grid.getByRole("option").last().dblclick();
    const s = await shownSize(ctx);
    await W(ctx).getByRole("button", { name: "Back", exact: true }).click();
    return { ok: all.length === 2 && s.width > 0, detail: JSON.stringify(all) };
  },
  {
    notes:
      "kind: a photo of an album's grid (first and last checked; also in search results and smart albums)",
  },
);
R(
  "context.move-to",
  "album (context menu)",
  "menuitem",
  "Move to",
  "right-click a photo of Trip, Move to, Second",
  "the photo leaves Trip and joins Second on the server, in one change",
  async (ctx) => {
    const { page } = ctx;
    await side(ctx, ctx.data.trip).click();
    const grid = W(ctx).getByRole("listbox", { name: ctx.data.trip });
    await opt(grid, names(ctx).a).click({ button: "right" });
    const moved = posted(page, `/api/photos/albums/${ctx.data.secondId}`);
    await page.getByRole("menuitem", { name: "Move to", exact: true }).click();
    await page.getByRole("menuitem", { name: ctx.data.second, exact: true }).click();
    await moved;
    const t = await albumNamed(ctx, ctx.data.trip);
    const s = await albumNamed(ctx, ctx.data.second);
    return {
      ok: !t.photos.includes(ctx.data.ids.a) && s.photos.includes(ctx.data.ids.a),
      detail: `${t.photos} | ${s.photos}`,
    };
  },
  { notes: "kind: Move to an album, one item per other album" },
);
R(
  "context.add-to",
  "album (context menu)",
  "menuitem",
  "Add to",
  "right-click the other photo of Trip, Add to, Second",
  "the photo is in both albums on the server",
  async (ctx) => {
    const { page } = ctx;
    const grid = W(ctx).getByRole("listbox", { name: ctx.data.trip });
    await opt(grid, names(ctx).c).click({ button: "right" });
    const added = posted(page, `/api/photos/albums/${ctx.data.secondId}`);
    await page.getByRole("menuitem", { name: "Add to", exact: true }).click();
    await page.getByRole("menuitem", { name: ctx.data.second, exact: true }).click();
    await added;
    const t = await albumNamed(ctx, ctx.data.trip);
    const s = await albumNamed(ctx, ctx.data.second);
    return { ok: t.photos.includes(ctx.data.ids.c) && s.photos.includes(ctx.data.ids.c) };
  },
  { notes: "kind: Add to an album, one item per other album" },
);
R(
  "drag.photo-to-album",
  "library -> sidebar",
  "drag",
  "photo onto album row",
  "drag a Days tile with the mouse onto Trip's row in My Albums",
  "the row shows it will take the photo, and the photo joins Trip on the server",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    const target = side(ctx, ctx.data.trip);
    const added = posted(page, `/api/photos/albums/${ctx.data.tripId}`, 10_000).catch(() => null);
    await pointerDrag(page, tile(ctx, names(ctx).a), target);
    await added;
    const t = await albumNamed(ctx, ctx.data.trip);
    return { ok: t.photos.includes(ctx.data.ids.a), detail: JSON.stringify(t.photos) };
  },
);
const SORTS = [
  ["title", "Keep Sorted By Title"],
  ["newest", "Keep Sorted By Newest First"],
  ["oldest", "Keep Sorted By Oldest First"],
  ["added", "Order Added"],
];
for (const [key, name] of SORTS) {
  R(
    `menu.view.sort-${key}`,
    "menu:View",
    "menuitemradio",
    name,
    `with Second open, View > ${name}`,
    "the album's sort is kept on the server and the item is checked",
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      await side(ctx, ctx.data.second).click();
      const saved = posted(page, `/api/photos/albums/${ctx.data.secondId}`).catch(() => null);
      await chooseMenu(page, "View", "Sort", name);
      await saved;
      const al = await albumNamed(ctx, ctx.data.second);
      const state = await menuItemState(page, "View", "Sort", name);
      return {
        ok:
          state.checked === "true" &&
          (al?.sort ?? "added") !== undefined &&
          (key === "added"
            ? ["added", "custom", null, undefined].includes(al?.sort)
            : al?.sort === key),
        detail: `${al?.sort} ${JSON.stringify(state)}`,
      };
    },
  );
}
R(
  "album.rename",
  "album",
  "button",
  "Rename…",
  "with Second open, Rename…, type a new name, Rename",
  "the server keeps the album's new name",
  async (ctx) => {
    const { page } = ctx;
    await side(ctx, ctx.data.second).click();
    ctx.data.best = `Best ${ctx.run}`;
    await W(ctx).getByRole("button", { name: "Rename…" }).click();
    await dialogName(ctx).fill(ctx.data.best);
    const saved = posted(page, `/api/photos/albums/${ctx.data.secondId}`);
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await saved;
    return { ok: (await albumNamed(ctx, ctx.data.best))?.id === ctx.data.secondId };
  },
);
R(
  "dialog.rename",
  "Rename Album sheet",
  "button",
  "Rename",
  "click Rename in the sheet",
  "the album is renamed (checked with Rename…)",
  async (ctx) => ({ ok: !!(await albumNamed(ctx, ctx.data.best)) }),
);
R(
  "context.remove-from-album",
  "album (context menu)",
  "menuitem",
  "Remove from Album",
  "right-click a photo of Best, Remove from Album",
  "it leaves the album and stays in the library",
  async (ctx) => {
    const { page } = ctx;
    await side(ctx, ctx.data.best).click();
    const grid = W(ctx).getByRole("listbox", { name: ctx.data.best });
    await opt(grid, names(ctx).c).click({ button: "right" });
    const saved = posted(page, `/api/photos/albums/${ctx.data.secondId}`);
    await page.getByRole("menuitem", { name: "Remove from Album" }).click();
    await saved;
    const al = await albumNamed(ctx, ctx.data.best);
    const p = await photoNamed(ctx, names(ctx).c);
    return { ok: !al.photos.includes(ctx.data.ids.c) && p?.deleted_ms === null };
  },
);
// --- An album photo's context menu (the EXIF photo in Best) ---------------------------------------
/** Right-click the EXIF photo in Best and choose `item` from its context menu. */
const albumContext = async (ctx, item) => {
  await ensureOpen(ctx);
  await side(ctx, ctx.data.best).click();
  const grid = W(ctx).getByRole("listbox", { name: ctx.data.best });
  await opt(grid, names(ctx).a).click({ button: "right" });
  const menu = ctx.page.getByRole("menu").last();
  await menu.waitFor({ timeout: 5_000 });
  await menu.getByRole("menuitem", { name: item, exact: true }).first().click();
};
const contextDownload = async (ctx, item) => {
  await albumContext(ctx, item);
  return exportedFile(ctx);
};
R(
  "context.open",
  "album (context menu)",
  "menuitem",
  "Open",
  "right-click a photo of Best, Open; then Back",
  "the viewer shows the photo full size; Back returns to the album",
  async (ctx) => {
    await albumContext(ctx, "Open");
    const s = await shownSize(ctx);
    await W(ctx).getByRole("button", { name: "Back", exact: true }).click();
    const back = await until(
      () => W(ctx).getByRole("listbox", { name: ctx.data.best }).isVisible(),
      8_000,
    );
    return { ok: s.width > 0 && back, detail: `${s.width}x${s.height}, back ${back}` };
  },
);
R(
  "context.favorite",
  "album (context menu)",
  "menuitem",
  "/(Favorite|Unfavorite)/",
  "right-click a photo of Best, Favorite (or Unfavorite), then the other",
  "the server's favourite flips and flips back; the menu names the command by the photo's state",
  async (ctx) => {
    const { page } = ctx;
    const id = ctx.data.ids.a;
    const was = (await photoNamed(ctx, names(ctx).a))?.favorite === true;
    let saved = posted(page, `/api/photos/photos/${id}`);
    await albumContext(ctx, was ? "Unfavorite" : "Favorite");
    await saved;
    const flipped = (await photoNamed(ctx, names(ctx).a))?.favorite === !was;
    saved = posted(page, `/api/photos/photos/${id}`);
    await albumContext(ctx, was ? "Favorite" : "Unfavorite");
    await saved;
    const back = (await photoNamed(ctx, names(ctx).a))?.favorite === was;
    return { ok: flipped && back, detail: `was ${was}, flipped ${flipped}, back ${back}` };
  },
  { notes: "kind: the context menu's favourite command, named by the photo's state" },
);
R(
  "context.rotate-left",
  "album (context menu)",
  "menuitem",
  "Rotate Left",
  "right-click a photo of Best, Rotate Left; then select it and Image > Revert to Original",
  "the server keeps the turn as an edit; the revert forgets it",
  async (ctx) => {
    const { page } = ctx;
    const id = ctx.data.ids.a;
    let saved = posted(page, `/api/photos/photos/${id}`);
    await albumContext(ctx, "Rotate Left");
    await saved;
    const turned = ((await photoNamed(ctx, names(ctx).a))?.edit?.rotate ?? 0) !== 0;
    await opt(W(ctx).getByRole("listbox", { name: ctx.data.best }), names(ctx).a).click();
    saved = posted(page, `/api/photos/photos/${id}`);
    await chooseMenu(page, "Image", "Revert to Original");
    await saved;
    const reverted = ((await photoNamed(ctx, names(ctx).a))?.edit ?? null) === null;
    return { ok: turned && reverted, detail: `turned ${turned}, reverted ${reverted}` };
  },
);
R(
  "context.export",
  "album (context menu)",
  "menuitem",
  "Export…",
  "right-click a photo of Best, Export…",
  "a JPEG of the photo as shown is saved to the computer",
  async (ctx) => {
    const { bytes, name } = await contextDownload(ctx, "Export…");
    return {
      ok: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.length > 1000,
      detail: `${name} ${bytes.length} bytes`,
    };
  },
);
R(
  "context.export-unmodified-original",
  "album (context menu)",
  "menuitem",
  "Export Unmodified Original…",
  "right-click a photo of Best, Export Unmodified Original…",
  "the original's exact bytes are saved to the computer (SHA-256 equal to the imported file)",
  async (ctx) => {
    const { bytes, name } = await contextDownload(ctx, "Export Unmodified Original…");
    return {
      ok: sha(bytes) === ctx.data.sha.a,
      detail: `${name} ${bytes.length} bytes, sha ${sha(bytes).slice(0, 12)}`,
    };
  },
);
R(
  "context.set-desktop-picture",
  "album (context menu)",
  "menuitem",
  "Set Desktop Picture",
  "right-click a photo of Best, Set Desktop Picture",
  "the desktop picture becomes the photo: the change is saved (answered), the settings read back hold a Photos picture, and the desktop shows the drawn picture",
  async (ctx) => {
    const { page } = ctx;
    const SETTINGS = "/api/system-preferences/settings";
    const values = async () => {
      const json = (await api(page, "GET", SETTINGS)).json ?? {};
      return json.values ?? json;
    };
    // The desktop's own picture element: its background and images, read back.
    const desktopPicture = () =>
      page
        .locator(".mac-desktop-shell-picture")
        .first()
        .evaluate((e) =>
          [
            getComputedStyle(e).backgroundImage,
            ...[...e.querySelectorAll("img")].map((i) => i.currentSrc || i.src),
            ...[...e.querySelectorAll("*")].map((c) => getComputedStyle(c).backgroundImage),
          ].join(" "),
        )
        .catch(() => "");
    const before = await values();
    const pictureBefore = await desktopPicture();
    const PICTURE = "desktop-and-screen-saver.picture";
    // Other panes save the same settings document (Screen Time's usage comes every so often): only the save that
    // carries a new picture answers this row.
    const saved = page
      .waitForResponse(
        (r) => {
          if (r.request().method() === "GET" || !new URL(r.url()).pathname.startsWith(SETTINGS))
            return false;
          const sent = JSON.parse(r.request().postData() ?? "{}").values?.[PICTURE];
          return sent !== undefined && JSON.stringify(sent) !== JSON.stringify(before[PICTURE]);
        },
        { timeout: 20_000 },
      )
      .catch(() => null);
    await albumContext(ctx, "Set Desktop Picture");
    const reply = await saved;
    if (!reply) return { ok: false, detail: "no save was sent" };
    const after = await values();
    // setDesktopPicture keeps the picture with source "photos": the settings field that changed holds it.
    const changed = Object.keys(after).filter(
      (key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]),
    );
    // The desktop picture's own setting is the one that changed.
    const kept = changed.includes(PICTURE);
    let pictureAfter = "";
    const shown = await until(async () => {
      pictureAfter = await desktopPicture();
      return pictureAfter !== pictureBefore && /blob:|data:image/.test(pictureAfter);
    }, 5_000);
    return {
      ok: reply.status() < 400 && kept && shown,
      detail: `${reply.request().method()} ${reply.status()}; changed ${changed.join(",") || "nothing"}, the desktop picture setting ${kept}; the desktop picture changed to the drawn image ${shown}`,
    };
  },
);
R(
  "context.delete-photo",
  "album (context menu)",
  "menuitem",
  "Delete Photo",
  "right-click a photo of Best, Delete Photo; then Recently Deleted, Recover",
  "it moves to Recently Deleted on the server, and Recover brings it back, still in Best",
  async (ctx) => {
    const { page } = ctx;
    const id = ctx.data.ids.a;
    let saved = posted(page, `/api/photos/photos/${id}`);
    await albumContext(ctx, "Delete Photo");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await saved;
    const deleted = typeof (await photoNamed(ctx, names(ctx).a))?.deleted_ms === "number";
    await side(ctx, "Recently Deleted").click();
    await opt(W(ctx), names(ctx).a).click();
    saved = posted(page, `/api/photos/photos/${id}`);
    await W(ctx).getByRole("button", { name: "Recover" }).click();
    await saved;
    const back = (await photoNamed(ctx, names(ctx).a))?.deleted_ms === null;
    const inBest = !!(await albumNamed(ctx, ctx.data.best))?.photos?.includes(id);
    return {
      ok: deleted && back && inBest,
      detail: `deleted ${deleted}, recovered ${back}, still in Best ${inBest}`,
    };
  },
  { timeout: 90_000 },
);
R(
  "album.delete",
  "album",
  "button",
  "Delete Album",
  "with Trip open, Delete Album",
  "the album is deleted and its photos stay in the library",
  async (ctx) => {
    const { page } = ctx;
    await side(ctx, ctx.data.trip).click();
    const gone = posted(page, `/api/photos/albums/${ctx.data.tripId}`);
    await W(ctx).getByRole("button", { name: "Delete Album" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await gone;
    const l = await lib(ctx);
    return {
      ok:
        !l.albums.some((a) => a.id === ctx.data.tripId) &&
        l.photos.filter((p) => p.deleted_ms === null).length === 3,
    };
  },
);

// --- Delete and restore -------------------------------------------------------------------------
R(
  "shortcut.delete",
  "library (Days)",
  "shortcut",
  "Delete",
  "select the PNG, press Delete",
  "it moves to Recently Deleted on the server",
  async (ctx) => {
    await home(ctx);
    await tile(ctx, names(ctx).b).click();
    const saved = posted(ctx.page, `/api/photos/photos/${ctx.data.ids.b}`);
    await ctx.page.keyboard.press("Delete");
    await ctx.page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await saved;
    return { ok: typeof (await photoNamed(ctx, names(ctx).b))?.deleted_ms === "number" };
  },
);
R(
  "recently-deleted.recover",
  "Recently Deleted",
  "button",
  "Recover",
  "Recently Deleted, select the photo, Recover",
  "it is back in the library on the server",
  async (ctx) => {
    await side(ctx, "Recently Deleted").click();
    await opt(W(ctx), names(ctx).b).click();
    const saved = posted(ctx.page, `/api/photos/photos/${ctx.data.ids.b}`);
    await W(ctx).getByRole("button", { name: "Recover" }).click();
    await saved;
    return { ok: (await photoNamed(ctx, names(ctx).b))?.deleted_ms === null };
  },
);
R(
  "menu.edit.delete-photo",
  "menu:Edit",
  "menuitem",
  "Delete Photo",
  "select the PNG, Edit > Delete Photo",
  "it moves to Recently Deleted on the server",
  async (ctx) => {
    await home(ctx);
    await tile(ctx, names(ctx).b).click();
    const saved = posted(ctx.page, `/api/photos/photos/${ctx.data.ids.b}`);
    await chooseMenu(ctx.page, "Edit", "Delete Photo");
    await ctx.page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await saved;
    return { ok: typeof (await photoNamed(ctx, names(ctx).b))?.deleted_ms === "number" };
  },
  {
    persists: "restart",
    restartCheck: async (ctx) => {
      await side(ctx, "Recently Deleted").click();
      const ok = await opt(W(ctx), names(ctx).b)
        .waitFor({ timeout: 15_000 })
        .then(
          () => true,
          () => false,
        );
      return { ok: ok && typeof (await photoNamed(ctx, names(ctx).b))?.deleted_ms === "number" };
    },
  },
);
R(
  "recently-deleted.photo",
  "Recently Deleted",
  "option",
  "/(Lighthouse|Harbour|Meadow) [a-z0-9]+/",
  "Recently Deleted's grid",
  "the deleted photo is listed with the days left before it goes",
  async (ctx) => {
    await side(ctx, "Recently Deleted").click();
    const text = await opt(W(ctx), names(ctx).b).innerText();
    return { ok: /days?/.test(text), detail: text.replace(/\s+/g, " ") };
  },
  { notes: "kind: a photo of Recently Deleted's grid" },
);
R(
  "recently-deleted.delete-immediately",
  "Recently Deleted",
  "button",
  "Delete Immediately",
  "a fourth picture imported then deleted; in Recently Deleted, Delete Immediately",
  "it is gone from the library and its original from the drive",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    const d = await drawn(page, { width: 200, height: 150, type: "image/png" });
    const name = `Doomed ${ctx.run}`;
    await chooseFiles(
      page,
      () => W(ctx).getByRole("button", { name: "Import", exact: true }).click(),
      [{ name: `${name}.png`, mimeType: "image/png", buffer: d }],
    );
    await until(async () => !!(await photoNamed(ctx, name)), 30_000);
    const p = await photoNamed(ctx, name);
    await tile(ctx, name).click();
    let saved = posted(page, `/api/photos/photos/${p.id}`);
    await page.keyboard.press("Delete");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await saved;
    await side(ctx, "Recently Deleted").click();
    await opt(W(ctx), name).click();
    saved = posted(page, "/api/photos/purged", 20_000);
    await W(ctx).getByRole("button", { name: "Delete Immediately" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await saved;
    const l = await lib(ctx);
    const files = (await api(page, "GET", "/api/files/")).json.entries ?? [];
    return { ok: !l.photos.some((x) => x.id === p.id) && !files.some((f) => f.id === p.file) };
  },
  { timeout: 90_000 },
);

// --- Sidebar ------------------------------------------------------------------------------------
for (const name of [
  "Photos",
  "Favorites",
  "Recents",
  "Imports",
  "Photo Booth",
  "Recently Deleted",
]) {
  R(
    `sidebar.${name.toLowerCase().replace(/ /g, "-")}`,
    "library",
    "treeitem",
    name,
    `click ${name} in the sidebar`,
    `${name} is selected and its heading shows`,
    async (ctx) => {
      await ensureOpen(ctx);
      await side(ctx, name).click();
      const sel = await until(
        async () => (await side(ctx, name).getAttribute("aria-selected")) === "true",
        5_000,
      );
      const h = await heading(ctx)
        .textContent()
        .catch(() => "");
      return { ok: sel && h.includes(name), detail: h };
    },
  );
}
R(
  "sidebar.resize",
  "library",
  "separator",
  "Resize the sidebar",
  "drag the sidebar's edge 60 px right, then back",
  "the sidebar widens by the drag and narrows back",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    const tree = W(ctx).getByRole("tree", { name: "Library" });
    const w0 = (await box(tree)).width;
    const sep = await box(W(ctx).getByRole("separator", { name: "Resize the sidebar" }));
    const x = sep.x + sep.width / 2;
    const y = sep.y + sep.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 8 });
    await page.mouse.up();
    const w1 = (await box(tree)).width;
    await page.mouse.move(x + 60, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.up();
    const w2 = (await box(tree)).width;
    return { ok: w1 - w0 > 40 && Math.abs(w2 - w0) < 4, detail: `${w0} -> ${w1} -> ${w2}` };
  },
);

// --- Persistence, other browsers, other accounts --------------------------------------------------
R(
  "persist.reload",
  "library",
  "page",
  "reload",
  "favourite the EXIF photo, rotate it, add it to Best; reload the page",
  "after the reload: it is in Favorites, turned, in Best (sorted by title), and the PNG in Recently Deleted",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    await tile(ctx, names(ctx).a).click();
    let saved = posted(page, `/api/photos/photos/${ctx.data.ids.a}`);
    await W(ctx).getByRole("button", { name: "Favorite", exact: true }).click();
    await saved;
    saved = posted(page, `/api/photos/photos/${ctx.data.ids.a}`);
    await W(ctx).getByRole("button", { name: "Rotate", exact: true }).click();
    await saved;
    await side(ctx, ctx.data.best).click();
    saved = posted(page, `/api/photos/albums/${ctx.data.secondId}`).catch(() => null);
    await chooseMenu(page, "View", "Sort", "Keep Sorted By Title");
    await saved;
    await page.reload({ waitUntil: "load" });
    await signIn(page, ctx.base, ctx.account);
    await ensureOpen(ctx);
    await side(ctx, "Favorites").click();
    const fav = await opt(W(ctx), names(ctx).a)
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      );
    await side(ctx, ctx.data.best).click();
    const inBest = await opt(W(ctx).getByRole("listbox", { name: ctx.data.best }), names(ctx).a)
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    const a = await photoNamed(ctx, names(ctx).a);
    return {
      ok: fav && inBest && a?.edit?.rotate === 1 && a?.favorite === true,
      detail: `fav ${fav}, best ${inBest}, ${JSON.stringify(a?.edit)}`,
    };
  },
  {
    persists: "restart",
    timeout: 90_000,
    restartCheck: async (ctx) => {
      await side(ctx, "Favorites").click();
      const fav = await opt(W(ctx), names(ctx).a)
        .waitFor({ timeout: 20_000 })
        .then(
          () => true,
          () => false,
        );
      const best = await albumNamed(ctx, ctx.data.best);
      await opt(W(ctx), names(ctx).a).dblclick();
      const s = await shownSize(ctx, { width: 480, height: 640 });
      await W(ctx).getByRole("button", { name: "Back", exact: true }).click();
      return {
        ok:
          fav && best?.sort === "title" && best.photos.includes(ctx.data.ids.a) && s.width === 480,
        detail: `fav ${fav}, ${JSON.stringify(best)}, ${s.width}x${s.height}`,
      };
    },
  },
);
R(
  "second-browser.live",
  "second browser",
  "browser",
  "same account elsewhere",
  "sign in to the account in a second browser; favourite in the first; make an album in the second; refresh the second",
  "each sees the other's change without reopening Photos, and the second still shows them after its refresh",
  async (ctx) => {
    const { browser } = ctx;
    const other = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await other.newPage();
    const errors = [];
    p2.on("pageerror", (e) => errors.push(e.message));
    try {
      await signIn(p2, ctx.base, ctx.account);
      await openApp(p2, "Photos");
      const W2 = mainWindow(p2, app);
      await W2.getByRole("treeitem", { name: ctx.data.best }).waitFor({ timeout: 15_000 });
      await W2.getByRole("treeitem", { name: "Favorites", exact: true }).click();
      await home(ctx);
      await tile(ctx, names(ctx).c).click();
      await W(ctx).getByRole("button", { name: "Favorite", exact: true }).click();
      const live1 = await until(
        () => W2.getByRole("option", { name: names(ctx).c, exact: true }).isVisible(),
        30_000,
      );
      const elsewhere = `Elsewhere ${ctx.run}`;
      await W2.getByRole("button", { name: "New Album", exact: true }).click();
      await p2.getByRole("textbox", { name: "Name" }).fill(elsewhere);
      await p2.getByRole("button", { name: "Create", exact: true }).click();
      const live2 = await until(() => side(ctx, elsewhere).isVisible(), 30_000);
      await p2.reload({ waitUntil: "load" });
      await signIn(p2, ctx.base, ctx.account);
      await openApp(p2, "Photos");
      const kept = await mainWindow(p2, app)
        .getByRole("treeitem", { name: elsewhere })
        .waitFor({ timeout: 15_000 })
        .then(
          () => true,
          () => false,
        );
      await mainWindow(p2, app).getByRole("treeitem", { name: elsewhere }).click();
      await mainWindow(p2, app).getByRole("button", { name: "Delete Album" }).click();
      await p2
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      const gone = await until(async () => (await side(ctx, elsewhere).count()) === 0, 30_000);
      return {
        ok: live1 && live2 && kept && gone && errors.length === 0,
        detail: `live ${live1}/${live2}, after refresh ${kept}, delete seen ${gone}, errors ${errors.join("; ")}`,
      };
    } finally {
      await other.close();
    }
  },
  { timeout: 150_000 },
);
R(
  "people.faces",
  "library",
  "treeitem",
  "People",
  "import a portrait, let the page look at it while idle, name its face in People",
  "the server keeps one box and the name, and the person's round tile is cropped to the face",
  async (ctx) => {
    const { page } = ctx;
    await home(ctx);
    const name = `Portrait ${ctx.run}`;
    const who = `Ann ${ctx.run}`;
    await chooseFiles(
      page,
      () => W(ctx).getByRole("button", { name: "Import", exact: true }).click(),
      [{ name: `${name}.jpg`, mimeType: "image/jpeg", buffer: readFileSync(FACE_FIXTURE) }],
    );
    await until(async () => !!(await photoNamed(ctx, name))?.faces, 90_000);
    const looked = await photoNamed(ctx, name);
    await side(ctx, "People").click();
    const field = W(ctx).locator(`[data-face="${looked?.id}:0"]`).getByRole("combobox");
    await field.fill(who);
    await field.press("Enter");
    const person = W(ctx).getByRole("button", { name: `${who}, 1 Photo`, exact: true });
    await person.waitFor({ timeout: 10_000 });
    await until(async () => (await person.locator(".mac-photos-face-image").count()) === 1, 8_000);
    const kept = await photoNamed(ctx, name);
    return {
      ok:
        looked?.faces?.length === 1 &&
        kept?.faces?.[0]?.name === who &&
        !!kept?.people?.includes(who) &&
        (await person.locator(".mac-photos-face-image").count()) === 1,
      detail: `${looked?.faces?.length} face, named ${kept?.faces?.[0]?.name}`,
    };
  },
  { timeout: 150_000 },
);
R(
  "isolation.second-account",
  "another account",
  "account",
  "second account",
  "sign up a second account in another browser and open Photos",
  "it sees no photo, album, thumbnail or original of the first, and cannot change them (404)",
  async (ctx) => {
    const { browser } = ctx;
    const other = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await other.newPage();
    try {
      await createAccount(p2, ctx.base, person("photosother", ctx.run));
      await openApp(p2, "Photos");
      const theirs = (await api(p2, "GET", LIB)).json;
      const ids = Object.values(ctx.data.ids).join(",");
      const thumbs = (await api(p2, "GET", `/api/photos/thumbs?ids=${ids}`)).json;
      const meddle = await api(p2, "POST", `/api/photos/photos/${ctx.data.ids.a}`, {
        favorite: false,
      });
      const files = (await api(p2, "GET", "/api/files/")).json.entries ?? [];
      const empty = await mainWindow(p2, app)
        .getByRole("status")
        .innerText()
        .catch(() => "");
      const ok =
        theirs.photos.length === 0 &&
        theirs.albums.length === 0 &&
        Object.keys(thumbs?.thumbs ?? {}).length === 0 &&
        meddle.status === 404 &&
        !Object.values(ctx.data.files).some((f) => files.some((e) => e.id === f)) &&
        /No Photos/.test(empty);
      return {
        ok,
        detail: `${theirs.photos.length} photos, ${theirs.albums.length} albums, meddle ${meddle.status}, "${empty}"`,
      };
    } finally {
      await other.close();
    }
  },
  { timeout: 120_000 },
);

app.rows = [...shellRows(app), ...rows];
app.open = async (ctx) => {
  await openApp(ctx.page, "Photos");
  const w = mainWindow(ctx.page, app);
  await w.waitFor({ state: "visible", timeout: 20_000 });
  await until(async () => (await w.locator("[aria-busy]").count()) === 0, 15_000);
  return w;
};
app.recover = async (ctx) => {
  for (let n = 0; n < 3 && (await ctx.page.getByRole("menu").count()) > 0; n += 1)
    await ctx.page.keyboard.press("Escape");
  if (
    await ctx.page
      .getByRole("textbox", { name: "Name" })
      .isVisible()
      .catch(() => false)
  )
    await ctx.page.keyboard.press("Escape");
};
// The states the crawl visits, besides the library with its menus.
app.states = [
  { name: "main", enter: (ctx) => home(ctx).then(() => W(ctx)), menus: true },
  {
    name: "selection",
    enter: async (ctx) => {
      await home(ctx);
      await tile(ctx, names(ctx).a).click();
      return W(ctx);
    },
    menus: true,
  },
  {
    name: "viewer",
    enter: async (ctx) => {
      await home(ctx);
      await tile(ctx, names(ctx).c).dblclick();
      await shownSize(ctx);
      return W(ctx);
    },
  },
  {
    name: "editor",
    enter: async (ctx) => {
      await openEditor(ctx);
      return W(ctx);
    },
  },
  {
    name: "editor filters",
    enter: async (ctx) => {
      await W(ctx).getByRole("button", { name: "Filters", exact: true }).click();
      return W(ctx);
    },
  },
  {
    name: "editor crop",
    enter: async (ctx) => {
      await W(ctx).getByRole("button", { name: "Crop", exact: true }).click();
      return W(ctx);
    },
    leave: async (ctx) => {
      await W(ctx).getByRole("button", { name: "Cancel", exact: true }).click();
    },
  },
  {
    name: "album",
    enter: async (ctx) => {
      await home(ctx);
      await side(ctx, ctx.data.best).click();
      return W(ctx);
    },
    menus: true,
  },
  {
    name: "album context menu",
    enter: async (ctx) => {
      await opt(W(ctx).getByRole("listbox", { name: ctx.data.best }), names(ctx).a).click({
        button: "right",
      });
      return W(ctx);
    },
    window: async (ctx) => ctx.page.getByRole("menu").last(),
    leave: async (ctx) => ctx.page.keyboard.press("Escape"),
  },
  {
    name: "recently deleted",
    enter: async (ctx) => {
      await side(ctx, "Recently Deleted").click();
      await opt(W(ctx), names(ctx).b).click();
      return W(ctx);
    },
  },
  {
    name: "showing pop-up",
    enter: async (ctx) => {
      await home(ctx);
      await W(ctx)
        .getByRole("button", { name: /^Showing: / })
        .click();
      return W(ctx);
    },
    window: async (ctx) => ctx.page.getByRole("menu").last(),
    leave: async (ctx) => ctx.page.keyboard.press("Escape"),
  },
  {
    name: "new album sheet",
    enter: async (ctx) => {
      await home(ctx);
      await chooseMenu(ctx.page, "File", "New Album");
      return W(ctx);
    },
    window: async (ctx) => ctx.page.getByRole("dialog").last(),
    leave: async (ctx) => ctx.page.keyboard.press("Escape"),
  },
  {
    name: "info",
    enter: async (ctx) => {
      await home(ctx);
      await tile(ctx, names(ctx).a).click();
      await ctx.page.keyboard.press("ControlOrMeta+i");
      return W(ctx);
    },
    window: async (ctx) => infoPanel(ctx),
    leave: async (ctx) => ctx.page.keyboard.press("Escape"),
  },
];

await censusRun(app);
